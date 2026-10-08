/**
 * Server-Side Market Schedule Utility — Market hours logic for Vercel serverless functions.
 *
 * All times are in ET (Eastern Time) since NYSE/NASDAQ operate on ET.
 * IMPORTANT: Vercel servers run in various regions — always convert to ET explicitly.
 *
 * THE CALENDAR ITSELF — the NYSE holiday and early-close tables, the
 * maintained horizon (MAINTAINED_HOLIDAY_YEARS) and the pure session
 * functions (getSessionForDate, getPreviousSessionDate) — lives in ONE
 * dependency-free module, src/utils/marketCalendar.js, imported here and by
 * the Film Room hub helper (Film Room spec V1.2 Amendment A, BA-28), so the
 * helper and the server can never disagree about a session. api/ importing a
 * Node-clean src/ module is the BUILD_RULES §4 rule of record; this file's
 * test (marketSchedule.sessions.test.js) imports it unmocked — that import is
 * the dependency-surface guard. The functions are re-exported unchanged, so
 * every caller of this file sees the same calendar as before.
 *
 * NOTE (Wire arc, Jul 2026 — F2-9): 2027 was added to the calendar of record
 * only. Eight sibling copies of the 2026 holiday list exist across the repo
 * and are further divergent; consolidation is on the platform-hygiene backlog
 * (Wire spec §14). The calendar of record is the SINGLE holiday source for the
 * Wire session walker (wireCalendar.js) — new holiday years land there first.
 */

import {
  MAINTAINED_HOLIDAY_YEARS, MARKET_HOURS, isMarketHoliday, isEarlyCloseDate, getSessionForDate, getPreviousSessionDate,
} from '../../src/utils/marketCalendar.js';

export { MAINTAINED_HOLIDAY_YEARS, isMarketHoliday, getSessionForDate, getPreviousSessionDate };

// ============================================
// NYSE/NASDAQ SCHEDULE CONSTANTS (from the calendar module)
// ============================================

const MARKET_OPEN_HOUR = MARKET_HOURS.open.hour;
const MARKET_OPEN_MIN = MARKET_HOURS.open.minute;
const MARKET_CLOSE_HOUR = MARKET_HOURS.close.hour;
const MARKET_CLOSE_MIN = MARKET_HOURS.close.minute;

const EARLY_CLOSE_HOUR = MARKET_HOURS.earlyClose.hour;
const EARLY_CLOSE_MIN = MARKET_HOURS.earlyClose.minute;

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

/** The ET wall-clock date for `at` (now, by default) — Pilot P6 passes its injected clock's instant. */
export function getETDate(at = new Date()) {
  return new Date(at.toLocaleString('en-US', { timeZone: 'America/New_York' }));
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
  return isEarlyCloseDate(ds);
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
//
// getSessionForDate and getPreviousSessionDate are the calendar module's own
// (src/utils/marketCalendar.js), re-exported above: the regular-session bounds
// for an ET date as epoch-ms instants — null outside MAINTAINED_HOLIDAY_YEARS
// or for a malformed date (the caller exits with calendar_missing, never a
// guess) — and the previous trading day, null when the walk leaves the
// maintained horizon.

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
