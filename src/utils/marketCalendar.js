// src/utils/marketCalendar.js
//
// THE NYSE SESSION CALENDAR — one module for the server and the browser
// (Film Room spec V1.2 Amendment A, BA-28). ZERO imports and no clock: the
// holiday and early-close tables, the maintained horizon, and the pure
// session functions over them. api/_utils/marketSchedule.js imports these
// (BUILD_RULES §4: api/ may import a Node-clean src/ module; its test's import
// is the dependency-surface guard), and so do the tape's close pass and the
// hub helper (src/utils/tapeSchedule.js) — so the helper can never promise a
// pass the server's calendar will not run. Moved verbatim from
// api/_utils/marketSchedule.js, where 2027 was added first (Wire arc, F2-9).
//
// TODO: Update NYSE holidays and early close days for 2028 by December 2027.

const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MIN = 30;
const MARKET_CLOSE_HOUR = 16;
const MARKET_CLOSE_MIN = 0;

const EARLY_CLOSE_HOUR = 13;
const EARLY_CLOSE_MIN = 0;

// 2026 NYSE Holidays (market fully closed)
const NYSE_HOLIDAYS_2026 = [
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Day
  '2026-02-16', // Presidents' Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
];

// Early close days (1:00 PM ET close)
const NYSE_EARLY_CLOSE_2026 = [
  '2026-11-27', // Day after Thanksgiving
  '2026-12-24', // Christmas Eve
];

// 2027 NYSE Holidays (market fully closed) — published NYSE calendar
const NYSE_HOLIDAYS_2027 = [
  '2027-01-01', // New Year's Day
  '2027-01-18', // MLK Day
  '2027-02-15', // Presidents' Day
  '2027-03-26', // Good Friday
  '2027-05-31', // Memorial Day
  '2027-06-18', // Juneteenth (observed — Jun 19 is a Saturday)
  '2027-07-05', // Independence Day (observed — Jul 4 is a Sunday)
  '2027-09-06', // Labor Day
  '2027-11-25', // Thanksgiving
  '2027-12-24', // Christmas (observed — Dec 25 is a Saturday)
];

// 2027 early close days (1:00 PM ET close). Jul 3 2027 is a Saturday and
// Dec 24 2027 is the observed Christmas holiday, so the day after
// Thanksgiving is 2027's only early close.
const NYSE_EARLY_CLOSE_2027 = [
  '2027-11-26', // Day after Thanksgiving
];

// Combined lookups + the maintained-horizon record (Wire walker coverage
// guard reads MAINTAINED_HOLIDAY_YEARS to refuse walking into an
// unmaintained year instead of silently treating its holidays as sessions).
const NYSE_HOLIDAYS_ALL = [...NYSE_HOLIDAYS_2026, ...NYSE_HOLIDAYS_2027];
const NYSE_EARLY_CLOSE_ALL = [...NYSE_EARLY_CLOSE_2026, ...NYSE_EARLY_CLOSE_2027];
export const MAINTAINED_HOLIDAY_YEARS = [2026, 2027];

/** Is `dateStr` (YYYY-MM-DD, ET) a NYSE full-day holiday? */
export function isMarketHoliday(dateStr) {
  return NYSE_HOLIDAYS_ALL.includes(dateStr);
}

/** Is `dateStr` (YYYY-MM-DD, ET) a NYSE 1:00 PM early close? No clock is read. */
export function isEarlyCloseDate(dateStr) {
  return NYSE_EARLY_CLOSE_ALL.includes(dateStr);
}

/**
 * The epoch-ms instant of an ET wall-clock time on an ET date, resolved with
 * Intl by probing the two candidate UTC offsets (EST −5 / EDT −4) and keeping
 * the one that renders back to the requested wall clock. Returns null when
 * neither does (a wall-clock time inside a DST gap — never a market time).
 */
export function etWallClockToMs(etDate, hour, minute) {
  const [y, m, d] = etDate.split('-').map(Number);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  for (const offsetHours of [4, 5]) {
    const candidate = Date.UTC(y, m - 1, d, hour + offsetHours, minute, 0);
    const parts = fmt.formatToParts(new Date(candidate));
    const get = (t) => parts.find((p) => p.type === t)?.value;
    let h = parseInt(get('hour'), 10);
    if (h === 24) h = 0;
    if (`${get('year')}-${get('month')}-${get('day')}` === etDate && h === hour && parseInt(get('minute'), 10) === minute) return candidate;
  }
  return null;
}

/**
 * The regular-session bounds for an ET calendar date, as epoch-ms instants,
 * from THIS file's tables (the calendar of record through 2027). Pure: no
 * clock is read.
 *
 * Returns null when `etDate` is malformed or its year is outside
 * MAINTAINED_HOLIDAY_YEARS — the caller exits with `calendar_missing` and
 * never guesses. A weekend or holiday returns `{ isTradingDay: false }` with
 * null bounds.
 *
 * @param {string} etDate YYYY-MM-DD in ET
 * @returns {{ etDate: string, isTradingDay: boolean, isEarlyClose: boolean, openMs: number|null,
 *            closeMs: number|null, sessionLenMin: number|null, previousEtDate: string|null }|null}
 */
export function getSessionForDate(etDate) {
  if (typeof etDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(etDate)) return null;
  const [y, m, d] = etDate.split('-').map(Number);
  if (!MAINTAINED_HOLIDAY_YEARS.includes(y)) return null;
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  if (Number.isNaN(probe.getTime())) return null;
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(probe);
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const holiday = isMarketHoliday(etDate);
  if (isWeekend || holiday) {
    return { etDate, isTradingDay: false, isEarlyClose: false, openMs: null, closeMs: null, sessionLenMin: null, previousEtDate: getPreviousSessionDate(etDate) };
  }
  const isEarlyClose = isEarlyCloseDate(etDate);
  const openMs = etWallClockToMs(etDate, MARKET_OPEN_HOUR, MARKET_OPEN_MIN);
  const closeMs = isEarlyClose
    ? etWallClockToMs(etDate, EARLY_CLOSE_HOUR, EARLY_CLOSE_MIN)
    : etWallClockToMs(etDate, MARKET_CLOSE_HOUR, MARKET_CLOSE_MIN);
  if (openMs === null || closeMs === null) return null;
  return {
    etDate,
    isTradingDay: true,
    isEarlyClose,
    openMs,
    closeMs,
    sessionLenMin: (closeMs - openMs) / 60_000,
    previousEtDate: getPreviousSessionDate(etDate),
  };
}

/**
 * The previous trading day (Mon–Fri, not a NYSE holiday) before `etDate`, as
 * a date string, walking THIS file's tables. Null when the walk leaves the
 * maintained horizon.
 */
export function getPreviousSessionDate(etDate) {
  if (typeof etDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(etDate)) return null;
  const [y, m, d] = etDate.split('-').map(Number);
  let cursor = Date.UTC(y, m - 1, d, 12, 0, 0);
  for (let i = 0; i < 15; i++) {
    cursor -= 86_400_000;
    const dt = new Date(cursor);
    const ds = dt.toISOString().slice(0, 10);
    if (!MAINTAINED_HOLIDAY_YEARS.includes(dt.getUTCFullYear())) return null;
    const dow = dt.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    if (isMarketHoliday(ds)) continue;
    return ds;
  }
  return null;
}

/** The market hours, for callers that compose ET clock checks from the same constants. */
export const MARKET_HOURS = Object.freeze({
  open: Object.freeze({ hour: MARKET_OPEN_HOUR, minute: MARKET_OPEN_MIN }),
  close: Object.freeze({ hour: MARKET_CLOSE_HOUR, minute: MARKET_CLOSE_MIN }),
  earlyClose: Object.freeze({ hour: EARLY_CLOSE_HOUR, minute: EARLY_CLOSE_MIN }),
});
