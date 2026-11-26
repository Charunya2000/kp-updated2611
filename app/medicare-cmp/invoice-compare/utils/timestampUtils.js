/**
 * Oracle→local-time timestamp parsing utilities.
 *
 * Oracle TIMESTAMP columns arrive over JSON either as:
 *   - A JS Date (when the driver converts natively)
 *   - A number (epoch ms)
 *   - A string in Oracle display format: "DD-MON-YY HH.MI.SS.FF AM"
 *     e.g. "08-APR-26 07.09.54.100887000 PM"
 *
 * JavaScript's built-in Date constructor mis-parses that last form, which
 * causes runtime and date-display columns to show the wrong time.  The
 * functions below handle all three shapes and always anchor the result to
 * the user's local timezone.
 */

const ORACLE_MONTH_INDEX = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

/**
 * Parse any timestamp value Oracle may return and convert it to a
 * millisecond epoch value in the user's LOCAL timezone.
 *
 * Returns null when the value is absent or unparseable.
 *
 * @param {Date|number|string|null|undefined} value
 * @returns {number|null}
 */
export function parseOracleLocalTimestamp(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  // Oracle display format: DD-MON-YY HH.MI.SS.FF AM|PM
  // e.g. "08-APR-26 07.09.54.100887000 PM"
  const oracleMatch = raw.match(
    /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})\s+(\d{1,2})\.(\d{2})\.(\d{2})(?:\.(\d{1,9}))?\s*(AM|PM)$/i,
  );

  if (oracleMatch) {
    const [, dayStr, monthStr, yearStr, hourStr, minuteStr, secondStr, fractionStr, meridiem] = oracleMatch;

    const monthIndex = ORACLE_MONTH_INDEX[monthStr.toUpperCase()];
    if (monthIndex === undefined) {
      return null;
    }

    const year = yearStr.length === 2 ? 2000 + Number(yearStr) : Number(yearStr);
    const day = Number(dayStr);
    const minute = Number(minuteStr);
    const second = Number(secondStr);
    let hour = Number(hourStr);

    if (meridiem.toUpperCase() === 'PM' && hour < 12) {
      hour += 12;
    }
    if (meridiem.toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }

    // Truncate nanosecond fractions to milliseconds
    const milliseconds = Number(((fractionStr || '').slice(0, 3)).padEnd(3, '0') || 0);

    // Use local Date constructor so result is anchored to client timezone
    const localDate = new Date(year, monthIndex, day, hour, minute, second, milliseconds);
    const localMs = localDate.getTime();
    return Number.isNaN(localMs) ? null : localMs;
  }

  // Fallback: ISO strings, epoch strings, etc.
  const fallbackMs = new Date(raw).getTime();
  return Number.isNaN(fallbackMs) ? null : fallbackMs;
}

/**
 * Format a timestamp value as a locale-friendly date-time string.
 * Handles Oracle, ISO, Date, and numeric inputs.
 *
 * @param {Date|number|string|null|undefined} ts
 * @returns {string}
 */
export function formatOracleLocalDate(ts) {
  if (!ts) return '—';
  const ms = parseOracleLocalTimestamp(ts);
  if (ms === null) return '—';
  return new Date(ms).toLocaleString();
}

/**
 * Format the elapsed time between two timestamp values as "hh:mm".
 *
 * @param {Date|number|string|null|undefined} startTs
 * @param {Date|number|string|null|undefined} endTs
 * @returns {string}
 */
export function formatOracleLocalDuration(startTs, endTs) {
  const startMs = parseOracleLocalTimestamp(startTs);
  const endMs = parseOracleLocalTimestamp(endTs);
  if (startMs === null || endMs === null) return '—';
  const diffMs = endMs - startMs;
  if (diffMs < 0) return '—';
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
