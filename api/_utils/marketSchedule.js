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
