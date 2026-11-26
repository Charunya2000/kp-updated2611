import {
  buildRcnoaScheduleIdempotencyKey,
  calculateNextRcnoaRun,
  validateRcnoaSchedule,
} from '../rcnoaScheduleService.js';

const dailySchedule = {
  enabled: true,
  frequency: { unit: 'daily', daysOfWeek: [] },
  startTime: '08:30',
  timeZone: 'America/Los_Angeles',
};

describe('rcnoaScheduleService', () => {
  test('validates and normalizes selected weekdays', () => {
    expect(validateRcnoaSchedule({
      ...dailySchedule,
      frequency: { unit: 'weekdays', daysOfWeek: [5, 1, 1] },
    }).frequency.daysOfWeek).toEqual([1, 5]);
  });

  test('calculates Pacific time before and after daylight saving transition', () => {
    expect(calculateNextRcnoaRun(dailySchedule, new Date('2026-03-07T15:00:00Z')).toISOString())
      .toBe('2026-03-07T16:30:00.000Z');
    expect(calculateNextRcnoaRun(dailySchedule, new Date('2026-11-01T14:00:00Z')).toISOString())
      .toBe('2026-11-01T16:30:00.000Z');
  });

  test('skips unselected weekdays', () => {
    const mondayOnly = {
      ...dailySchedule,
      frequency: { unit: 'weekdays', daysOfWeek: [1] },
    };
    expect(calculateNextRcnoaRun(mondayOnly, new Date('2026-08-07T18:00:00Z')).toISOString())
      .toBe('2026-08-10T15:30:00.000Z');
  });

  test('normalizes the legacy Eastern time zone to Pacific time', () => {
    expect(validateRcnoaSchedule({
      ...dailySchedule,
      timeZone: 'America/New_York',
    }).timeZone).toBe('America/Los_Angeles');
  });

  test('runs monthly schedules on the selected day', () => {
    const monthly = {
      ...dailySchedule,
      frequency: { unit: 'monthly', dayOfMonth: 15 },
    };

    expect(calculateNextRcnoaRun(monthly, new Date('2026-08-14T18:00:00Z')).toISOString())
      .toBe('2026-08-15T15:30:00.000Z');
  });

  test('uses the last day of shorter months', () => {
    const monthly = {
      ...dailySchedule,
      frequency: { unit: 'monthly', dayOfMonth: 31 },
    };

    expect(calculateNextRcnoaRun(monthly, new Date('2027-02-01T00:00:00Z')).toISOString())
      .toBe('2027-02-28T16:30:00.000Z');
  });

  test('builds a deterministic schedule idempotency key', () => {
    expect(buildRcnoaScheduleIdempotencyKey('schedule-id', new Date('2026-08-10T12:30:00Z')))
      .toBe('schedule:schedule-id:2026-08-10T12:30:00.000Z');
  });
});