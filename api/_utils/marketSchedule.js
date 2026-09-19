/**
 * Server-Side Market Schedule Utility — Market hours logic for Vercel serverless functions.
 *
 * Self-contained version of /src/utils/marketSchedule.js for server-side use.
 * Cannot import from /src/ since Vercel serverless functions run independently.
 *
 * All times are in ET (Eastern Time) since NYSE/NASDAQ operate on ET.
 * IMPORTANT: Vercel servers run in various regions — always convert to ET explicitly.
 *
 * TODO: Update NYSE holidays and early close days for 2028 by December 2027
 *
 * NOTE (Wire arc, Jul 2026 — F2-9): 2027 was added HERE ONLY. Eight sibling
 * copies of the 2026 holiday list exist across the repo and are now further
 * divergent; consolidation is on the platform-hygiene backlog (Wire spec §14).
 * This file is the SINGLE holiday source for the Wire session walker
 * (wireCalendar.js) — new holiday years land here first.
 */

// ============================================
// NYSE/NASDAQ SCHEDULE CONSTANTS
// ============================================

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

// Pre-market warm-up window (minutes before market open)
const PRE_MARKET_WINDOW_MINUTES = 10;

// Server-side cache TTLs (matching client CACHE_TIERS for getEffectiveTTL)
const SERVER_TTL = {
  price: 60,          // 60 seconds
  daily: 300,         // 5 minutes
  technicals: 3600,   // 1 hour
  fundamentals: 86400, // 24 hours
  news: 1800,         // 30 minutes
  earnings: 86400,    // 24 hours
};

// ============================================
// TIMEZONE HELPERS
// ============================================

export function getETDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

export function formatDateString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ============================================
// CORE FUNCTIONS
// ============================================

export function isMarketHoliday(dateStr) {
  return NYSE_HOLIDAYS_ALL.includes(dateStr);
}

/**
 * Check whether a given date (default: today in ET) is a trading day.
 * Trading day = Mon-Fri AND not a NYSE holiday.
 * @param {Date|null} date - optional Date to check; null = today in ET
 * @returns {boolean}
 */
export function isTradingDay(date = null) {
  const d = date || getETDate();
  const day = d.getDay();
  if (day < 1 || day > 5) return false;
  return !isMarketHoliday(formatDateString(d));
}

export function isEarlyCloseDay(dateStr) {
  const ds = dateStr || formatDateString(getETDate());
  return NYSE_EARLY_CLOSE_ALL.includes(ds);
}

export function isTodayHoliday() {
  return isMarketHoliday(formatDateString(getETDate()));
}

/**
 * Get the previous trading day before a given date string (YYYY-MM-DD).
 * Walks backwards, skipping weekends and NYSE holidays.
 */
export function getPreviousTradingDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  for (let i = 0; i < 10; i++) {
    date.setDate(date.getDate() - 1);
    const day = date.getDay();
    if (day === 0 || day === 6) continue;
    const ds = formatDateString(date);
    if (!isMarketHoliday(ds)) return ds;
  }
  // Fallback: shouldn't happen with 10 iterations
  return formatDateString(date);
}

// ============================================
// CALENDAR SESSIONS BY DATE (Intraday Data — Build 1, contract §5.1 / G5)
// ============================================

/**
 * The regular-session bounds for an ET calendar date, as epoch-ms instants,
 * from THIS file's tables (the calendar of record through 2027; the eight
 * sibling holiday copies are not consulted). Pure: no clock is read.
 *
 * Returns null when `etDate` is malformed or its year is outside
 * MAINTAINED_HOLIDAY_YEARS — the caller exits with `calendar_missing` and
 * never guesses (contract §5.1). A weekend or holiday returns
 * `{ isTradingDay: false }` with null bounds.
 *
 * The instants are computed with Intl (`America/New_York`) — never a
 * hand-rolled offset (BUILD_RULES §6) — by probing the UTC candidates for
 * the wall-clock open/close and picking the one whose ET rendering matches.
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
  const isEarlyClose = isEarlyCloseDay(etDate);
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

/**
 * The epoch-ms instant of an ET wall-clock time on an ET date, resolved with
 * Intl by probing the two candidate UTC offsets (EST −5 / EDT −4) and keeping
 * the one that renders back to the requested wall clock. Returns null when
 * neither does (a wall-clock time inside a DST gap — never a market time).
 */
function etWallClockToMs(etDate, hour, minute) {
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
 * Check if the stock market is currently open (regular trading hours).
 */
export function isMarketOpen() {
  const now = getETDate();
  const day = now.getDay();

  if (day === 0 || day === 6) return false;

  const todayStr = formatDateString(now);
  if (isMarketHoliday(todayStr)) return false;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MIN;
  const earlyClose = isEarlyCloseDay(todayStr);
  const closeHour = earlyClose ? EARLY_CLOSE_HOUR : MARKET_CLOSE_HOUR;
  const closeMin = earlyClose ? EARLY_CLOSE_MIN : MARKET_CLOSE_MIN;
  const closeMinutes = closeHour * 60 + closeMin;

  return minutes >= openMinutes && minutes < closeMinutes;
}

/**
 * Get comprehensive market state information.
 */
export function getMarketState() {
  const now = getETDate();
  const day = now.getDay();
  const todayStr = formatDateString(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MIN;
  const earlyClose = isEarlyCloseDay(todayStr);
  const closeHour = earlyClose ? EARLY_CLOSE_HOUR : MARKET_CLOSE_HOUR;
  const closeMin = earlyClose ? EARLY_CLOSE_MIN : MARKET_CLOSE_MIN;
  const closeMinutes = closeHour * 60 + closeMin;

  let state;
  let isOpen = false;

  if (day === 0 || day === 6) {
    state = 'CLOSED_WEEKEND';
  } else if (isMarketHoliday(todayStr)) {
    state = 'CLOSED_HOLIDAY';
  } else if (minutes >= openMinutes && minutes < closeMinutes) {
    state = 'OPEN';
    isOpen = true;
  } else if (minutes >= (openMinutes - PRE_MARKET_WINDOW_MINUTES) && minutes < openMinutes) {
    state = 'PRE_MARKET';
  } else {
    state = 'CLOSED_AFTERHOURS';
  }

  return {
    isOpen,
    state,
    nextOpenTime: getNextMarketOpen(),
    isEarlyClose: earlyClose,
  };
}

/**
 * Get the next market open time, skipping weekends and holidays.
 */
export function getNextMarketOpen() {
  const now = getETDate();
  const day = now.getDay();
  const todayStr = formatDateString(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MIN;

  // If it's a trading day and before market open, next open is today
  const isWeekday = day >= 1 && day <= 5;
  const isHoliday = isMarketHoliday(todayStr);

  if (isWeekday && !isHoliday && minutes < openMinutes) {
    const openTime = new Date(now);
    openTime.setHours(MARKET_OPEN_HOUR, MARKET_OPEN_MIN, 0, 0);
    return openTime;
  }

  // Otherwise, find the next trading day
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  while (true) {
    const d = next.getDay();
    const ds = formatDateString(next);
    if (d >= 1 && d <= 5 && !isMarketHoliday(ds)) {
      next.setHours(MARKET_OPEN_HOUR, MARKET_OPEN_MIN, 0, 0);
      return next;
    }
    next.setDate(next.getDate() + 1);
  }
}

/**
 * Get the next market close time, skipping weekends and holidays.
 * If the market is currently open (or within crypto-extended hours), returns today's close.
 * Otherwise, returns the close time on the next trading day.
 *
 * @param {Object} [options]
 * @param {boolean} [options.cryptoExtended=false] - If true, close is 20:00 ET (Night Game end) instead of 16:00
 * @returns {Date} Next market close time in ET
 */
export function getNextMarketClose(options = {}) {
  const { cryptoExtended = false } = options;
  const now = getETDate();
  const day = now.getDay();
  const todayStr = formatDateString(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const isWeekday = day >= 1 && day <= 5;
  const isHoliday = isMarketHoliday(todayStr);
  const earlyClose = isEarlyCloseDay(todayStr);

  const standardCloseHour = earlyClose ? EARLY_CLOSE_HOUR : MARKET_CLOSE_HOUR;
  const standardCloseMin = earlyClose ? EARLY_CLOSE_MIN : MARKET_CLOSE_MIN;
  const effectiveCloseHour = cryptoExtended && !earlyClose ? 20 : standardCloseHour;
  const effectiveCloseMin = cryptoExtended && !earlyClose ? 0 : standardCloseMin;
  const closeMinutes = effectiveCloseHour * 60 + effectiveCloseMin;

  // If it's a trading day and before the effective close, close is today
  if (isWeekday && !isHoliday && minutes < closeMinutes) {
    const closeTime = new Date(now);
    closeTime.setHours(effectiveCloseHour, effectiveCloseMin, 0, 0);
    return closeTime;
  }

  // Otherwise, next trading day's close
  const nextOpen = getNextMarketOpen();
  const nextDateStr = formatDateString(nextOpen);
  const nextEarly = isEarlyCloseDay(nextDateStr);
  const nextCloseHour = cryptoExtended && !nextEarly ? 20 : (nextEarly ? EARLY_CLOSE_HOUR : MARKET_CLOSE_HOUR);
  const nextCloseMin = cryptoExtended && !nextEarly ? 0 : (nextEarly ? EARLY_CLOSE_MIN : MARKET_CLOSE_MIN);

  const closeTime = new Date(nextOpen);
  closeTime.setHours(nextCloseHour, nextCloseMin, 0, 0);
  return closeTime;
}

/**
 * Get milliseconds until the next market open.
 */
export function getTimeUntilNextOpen() {
  const now = getETDate();
  const nextOpen = getNextMarketOpen();
  return Math.max(0, nextOpen.getTime() - now.getTime());
}

/**
 * Get the effective cache TTL for a data type based on current market state.
 *
 * Server-side version — TTLs are in SECONDS (matching serverCache.js convention).
 *
 * @param {string} dataType - Cache data type ('price', 'daily', 'technicals', etc.)
 * @param {object} [options] - Options
 * @param {boolean} [options.isCrypto] - Whether this is crypto data
 * @returns {number} TTL in seconds
 */
export function getEffectiveTTL(dataType, options = {}) {
  const { isCrypto = false } = options;

  // Crypto never sleeps — always use normal TTL
  if (isCrypto) {
    return SERVER_TTL[dataType] || SERVER_TTL.price;
  }

  const normalTTL = SERVER_TTL[dataType] || SERVER_TTL.price;

  // If market is open, use normal TTL
  if (isMarketOpen()) return normalTTL;

  // Market is closed — decide which types to extend
  // These types publish/update off-hours, keep normal TTL
  const NON_EXTENDABLE = ['news', 'analyst', 'weekAhead', 'metrics', 'ai', 'realtime'];
  if (NON_EXTENDABLE.includes(dataType)) return normalTTL;

  // For price-sensitive stock data, extend TTL to next market open
  const timeUntilOpenSec = Math.ceil(getTimeUntilNextOpen() / 1000);

  return Math.max(normalTTL, timeUntilOpenSec);
}

/**
 * Get the effective cache TTL in milliseconds (for Firestore TTL checks).
 *
 * @param {string} dataType - Cache field type ('daily', 'technicals', etc.)
 * @param {number} normalTTLMs - The normal TTL in milliseconds
 * @param {object} [options] - Options
 * @param {boolean} [options.isCrypto] - Whether this is crypto data
 * @returns {number} TTL in milliseconds
 */
export function getEffectiveTTLMs(dataType, normalTTLMs, options = {}) {
  const { isCrypto = false } = options;

  if (isCrypto) return normalTTLMs;
  if (isMarketOpen()) return normalTTLMs;
  if (dataType === 'news') return normalTTLMs;

  const timeUntilOpen = getTimeUntilNextOpen();
  return Math.max(normalTTLMs, timeUntilOpen);
}

/**
 * Check if we're in the pre-market warm-up window (9:20-9:30 AM ET on a trading day).
 */
export function isPreMarketWindow() {
  const now = getETDate();
  const day = now.getDay();

  if (day === 0 || day === 6) return false;
  if (isMarketHoliday(formatDateString(now))) return false;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MIN;
  const preMarketStart = openMinutes - PRE_MARKET_WINDOW_MINUTES;

  return minutes >= preMarketStart && minutes < openMinutes;
}
