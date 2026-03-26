/**
 * Market Schedule Utility — Centralized market hours logic for market-aware caching.
 *
 * Used by client cache service and UI components to determine:
 * - Whether the stock market is currently open
 * - Dynamic cache TTLs based on market state (freeze stock caches when closed)
 * - Pre-market warm-up window detection
 *
 * All times are in ET (Eastern Time) since NYSE/NASDAQ operate on ET.
 * IMPORTANT: Never rely on the browser's local timezone — always convert to ET.
 *
 * TODO: Update NYSE_EARLY_CLOSE and holidays for 2027 by December 2026
 */

import { isMarketHoliday, formatDateString, getNextTradingDay } from './marketHolidays';

// Normal TTLs by data type (mirroring CACHE_TIERS in cacheService.js — defined here
// to avoid circular dependency since cacheService imports from this module)
const NORMAL_TTL_MS = {
  // AGGRESSIVE (24h)
  fundamentals: 24 * 60 * 60 * 1000,
  historical: 24 * 60 * 60 * 1000,
  technicals: 24 * 60 * 60 * 1000,
  earnings: 24 * 60 * 60 * 1000,
  volatility: 24 * 60 * 60 * 1000,
  // MODERATE (1h)
  news: 60 * 60 * 1000,
  analyst: 60 * 60 * 1000,
  weekAhead: 60 * 60 * 1000,
  metrics: 60 * 60 * 1000,
  // INTRADAY (5min) — 30m/1h candles need frequent refresh during market hours
  intraday: 5 * 60 * 1000,
  // LIGHT (2min)
  prices: 2 * 60 * 1000,
  crypto: 2 * 60 * 1000,
  quotes: 2 * 60 * 1000,
  // NONE
  realtime: 0,
  ai: 0,
};

// ============================================
// NYSE/NASDAQ SCHEDULE CONSTANTS
// ============================================

const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MIN = 30;
const MARKET_CLOSE_HOUR = 16;
const MARKET_CLOSE_MIN = 0;

// Early close days (1:00 PM ET close)
const EARLY_CLOSE_HOUR = 13;
const EARLY_CLOSE_MIN = 0;

const NYSE_EARLY_CLOSE_2026 = [
  '2026-11-27', // Day after Thanksgiving
  '2026-12-24', // Christmas Eve
];

// Pre-market warm-up window (minutes before market open)
const PRE_MARKET_WINDOW_MINUTES = 10; // 9:20-9:30 AM ET

// Smart polling intervals
const POLL_INTERVAL_OPEN = 60_000;      // 60s during market hours
const POLL_INTERVAL_CLOSED = 300_000;   // 5min after hours (crypto only)
const POLL_INTERVAL_WEEKEND = 600_000;  // 10min on weekends (crypto only)

// ============================================
// TIMEZONE HELPER
// ============================================

/**
 * Get current time in Eastern Time, regardless of server/browser timezone.
 * @returns {Date} Date object representing current ET time
 */
function getETDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Check if today is an early close day (1:00 PM ET instead of 4:00 PM).
 * @param {string} [dateStr] - Optional date string (YYYY-MM-DD). Defaults to today ET.
 * @returns {boolean}
 */
export function isEarlyCloseDay(dateStr) {
  const ds = dateStr || formatDateString(getETDate());
  return NYSE_EARLY_CLOSE_2026.includes(ds);
}

/**
 * Check if today is a market holiday.
 * @returns {boolean}
 */
export function isTodayHoliday() {
  const todayStr = formatDateString(getETDate());
  return isMarketHoliday(todayStr);
}

/**
 * Check if the stock market is currently open (regular trading hours).
 * Accounts for weekends, holidays, and early close days.
 * @returns {boolean}
 */
export function isMarketOpen() {
  const now = getETDate();
  const day = now.getDay();

  // Weekend check
  if (day === 0 || day === 6) return false;

  // Holiday check
  const todayStr = formatDateString(now);
  if (isMarketHoliday(todayStr)) return false;

  // Time check
  const minutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MIN;    // 570 (9:30 AM)

  // Close time depends on early close
  const closeHour = isEarlyCloseDay(todayStr) ? EARLY_CLOSE_HOUR : MARKET_CLOSE_HOUR;
  const closeMin = isEarlyCloseDay(todayStr) ? EARLY_CLOSE_MIN : MARKET_CLOSE_MIN;
  const closeMinutes = closeHour * 60 + closeMin;

  return minutes >= openMinutes && minutes < closeMinutes;
}

/**
 * Get comprehensive market state information.
 * @returns {{ isOpen: boolean, state: string, nextOpenTime: Date, nextCloseTime: Date, isEarlyClose: boolean }}
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
    nextCloseTime: _getNextCloseTime(now, isOpen, earlyClose),
    isEarlyClose: earlyClose,
  };
}

/**
 * Get the next market open time, skipping weekends and holidays.
 * @returns {Date} Next market open time in ET
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
  const nextTradingDay = getNextTradingDay(now);
  nextTradingDay.setHours(MARKET_OPEN_HOUR, MARKET_OPEN_MIN, 0, 0);
  return nextTradingDay;
}

/**
 * Get milliseconds until the next market open.
 * @returns {number} Milliseconds until next market open
 */
export function getTimeUntilNextOpen() {
  const now = getETDate();
  const nextOpen = getNextMarketOpen();
  return Math.max(0, nextOpen.getTime() - now.getTime());
}

/**
 * Get the effective cache TTL for a data type based on current market state.
 *
 * This is THE KEY FUNCTION for market-aware caching:
 * - Crypto: always returns normal TTL (crypto trades 24/7)
 * - Stock prices/quotes when market OPEN: normal TTL (2 min)
 * - Stock prices/quotes when market CLOSED: ms until next market open
 * - News/analyst: always normal TTL (news publishes off-hours)
 * - Fundamentals/historical/earnings: already 24h, unchanged
 *
 * @param {string} dataType - Cache data type ('prices', 'crypto', 'news', etc.)
 * @returns {number} TTL in milliseconds
 */
export function getEffectiveTTL(dataType) {
  // Crypto never sleeps — always use normal TTL
  if (dataType === 'crypto') {
    return NORMAL_TTL_MS['crypto'] || 2 * 60 * 1000;
  }

  const normalTTL = NORMAL_TTL_MS[dataType] || 2 * 60 * 1000; // Default to LIGHT (2min)

  // If TTL is 0 (NONE tier), never cache regardless of market state
  if (normalTTL === 0) return 0;

  // If market is open, use normal TTL
  if (isMarketOpen()) return normalTTL;

  // Market is closed — decide which types to extend
  // News and analyst data publishes off-hours, keep normal TTL
  const NON_EXTENDABLE = ['news', 'analyst', 'weekAhead', 'metrics', 'ai', 'realtime'];
  if (NON_EXTENDABLE.includes(dataType)) return normalTTL;

  // For price-sensitive stock data, extend TTL to next market open
  // This covers: 'prices', 'quotes', 'technicals', 'fundamentals', 'historical', 'earnings', 'volatility'
  const timeUntilOpen = getTimeUntilNextOpen();

  // Use the longer of normal TTL and time-until-open
  // (fundamentals already have 24h TTL which may exceed time-until-open on weeknights)
  return Math.max(normalTTL, timeUntilOpen);
}

/**
 * Check if we're in the pre-market warm-up window (9:20-9:30 AM ET on a trading day).
 * @returns {boolean}
 */
export function isPreMarketWindow() {
  const now = getETDate();
  const day = now.getDay();

  // Weekend check
  if (day === 0 || day === 6) return false;

  // Holiday check
  if (isMarketHoliday(formatDateString(now))) return false;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MIN;
  const preMarketStart = openMinutes - PRE_MARKET_WINDOW_MINUTES;

  return minutes >= preMarketStart && minutes < openMinutes;
}

/**
 * Get smart polling interval based on current market state.
 * @returns {number} Polling interval in milliseconds
 */
export function getSmartPollInterval() {
  const { state } = getMarketState();
  switch (state) {
    case 'OPEN':
    case 'PRE_MARKET':
      return POLL_INTERVAL_OPEN;
    case 'CLOSED_WEEKEND':
    case 'CLOSED_HOLIDAY':
      return POLL_INTERVAL_WEEKEND;
    default:
      return POLL_INTERVAL_CLOSED;
  }
}

/**
 * Whether stock data should be polled right now.
 * Returns true during market hours and pre-market window.
 * @returns {boolean}
 */
export function shouldPollStocks() {
  return isMarketOpen() || isPreMarketWindow();
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Get the next market close time.
 */
function _getNextCloseTime(now, currentlyOpen, earlyClose) {
  if (currentlyOpen) {
    const closeTime = new Date(now);
    const closeHour = earlyClose ? EARLY_CLOSE_HOUR : MARKET_CLOSE_HOUR;
    const closeMin = earlyClose ? EARLY_CLOSE_MIN : MARKET_CLOSE_MIN;
    closeTime.setHours(closeHour, closeMin, 0, 0);
    return closeTime;
  }

  // Market not currently open — next close is after next open
  const nextOpen = getNextMarketOpen();
  const nextOpenDateStr = formatDateString(nextOpen);
  const nextEarlyClose = isEarlyCloseDay(nextOpenDateStr);
  const closeHour = nextEarlyClose ? EARLY_CLOSE_HOUR : MARKET_CLOSE_HOUR;
  const closeMin = nextEarlyClose ? EARLY_CLOSE_MIN : MARKET_CLOSE_MIN;

  const closeTime = new Date(nextOpen);
  closeTime.setHours(closeHour, closeMin, 0, 0);
  return closeTime;
}
