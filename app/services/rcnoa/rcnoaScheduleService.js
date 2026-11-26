import { RCNOA_DEFAULTS } from './rcnoaCore.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const LEGACY_TIME_ZONE = 'America/New_York';

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, Number(value)]));
}

function zonedDateTimeToUtc({ year, month, day, hour, minute }, timeZone) {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = new Date(target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(candidate, timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    candidate = new Date(candidate.getTime() + target - actualAsUtc);
  }
  return candidate;
}

export function validateRcnoaSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object') throw new Error('Schedule is required');
  if (typeof schedule.enabled !== 'boolean') throw new Error('Schedule enabled must be a boolean');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(schedule.startTime || ''))) {
    throw new Error('Schedule start time must use HH:mm');
  }
  if (![RCNOA_DEFAULTS.timeZone, LEGACY_TIME_ZONE].includes(schedule.timeZone)) {
    throw new Error(`Schedule time zone must be ${RCNOA_DEFAULTS.timeZone}`);
  }

  const unit = schedule.frequency?.unit;
  if (!['daily', 'weekdays', 'monthly'].includes(unit)) {
    throw new Error('Schedule frequency must be daily, weekdays, or monthly');
  }
  const daysOfWeek = schedule.frequency?.daysOfWeek || [];
  if (unit === 'weekdays') {
    if (!Array.isArray(daysOfWeek) || !daysOfWeek.length) {
      throw new Error('Selected-weekday schedules require at least one day');
    }
    if (daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new Error('Schedule days must be integers from 0 through 6');
    }
  }
  const dayOfMonth = Number(schedule.frequency?.dayOfMonth);
  if (unit === 'monthly' && (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)) {
    throw new Error('Schedule day of month must be an integer from 1 through 31');
  }

  return {
    enabled: schedule.enabled,
    startTime: schedule.startTime,
    timeZone: RCNOA_DEFAULTS.timeZone,
    frequency: {
      unit,
      interval: 1,
      daysOfWeek: unit === 'weekdays' ? [...new Set(daysOfWeek)].sort() : [],
      dayOfMonth: unit === 'monthly' ? dayOfMonth : null,
    },
  };
}

export function calculateNextRcnoaRun(schedule, after = new Date()) {
  const normalized = validateRcnoaSchedule(schedule);
  if (!normalized.enabled) return null;
  if (!(after instanceof Date) || Number.isNaN(after.getTime())) throw new Error('A valid reference date is required');

  const [hour, minute] = normalized.startTime.split(':').map(Number);
  const localNow = zonedParts(after, normalized.timeZone);
  const localMidnight = Date.UTC(localNow.year, localNow.month - 1, localNow.day);

  for (let offset = 0; offset <= 370; offset += 1) {
    const date = new Date(localMidnight + offset * DAY_MS);
    const dayOfWeek = date.getUTCDay();
    const lastDayOfMonth = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      0,
    )).getUTCDate();
    const scheduledDayOfMonth = Math.min(normalized.frequency.dayOfMonth, lastDayOfMonth);
    const isEligible = normalized.frequency.unit === 'daily'
      || (normalized.frequency.unit === 'weekdays'
        && normalized.frequency.daysOfWeek.includes(dayOfWeek))
      || (normalized.frequency.unit === 'monthly'
        && date.getUTCDate() === scheduledDayOfMonth);
    if (!isEligible) continue;

    const candidate = zonedDateTimeToUtc({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour,
      minute,
    }, normalized.timeZone);
    if (candidate.getTime() > after.getTime()) return candidate;
  }

  throw new Error('Unable to calculate the next RCNOA schedule occurrence');
}

export function buildRcnoaScheduleIdempotencyKey(scheduleId, scheduledAt) {
  if (!scheduleId || !(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) {
    throw new Error('Schedule ID and scheduled time are required');
  }
  return `schedule:${scheduleId}:${scheduledAt.toISOString()}`;
}