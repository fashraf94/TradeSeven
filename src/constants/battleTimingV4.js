// battleTimingV4.js — V4 BaggerBomb timing constants and utilities
// Supports 3-day PvP battles, 1-day training, free agent rotation modes
//
// All times are in Eastern Time (ET)

import { getEasternTime } from './battleTiming';

// ============================================
// PVP TIMING CONSTANTS (V4)
// ============================================

export const V4_PVP_TIMING = {
  TRADING_DAYS: 3,
  SWAPS_PER_DAY: 3,
  DAILY_START_HOUR: 9,
  DAILY_START_MINUTE: 30,
  DAILY_END_HOUR: 20,
  DAILY_END_MINUTE: 0,
  MARKET_CLOSE_HOUR: 16,
  MARKET_CLOSE_MINUTE: 0,
};

// ============================================
// TRAINING TIMING CONSTANTS (V4)
// ============================================

export const V4_TRAINING_TIMING = {
  TRADING_DAYS: 1,
  TOTAL_SWAPS: 1,
  DURATION_HOURS: 24,
  LABEL: '24 Hours',
  DAILY_START_HOUR: 9,
  DAILY_START_MINUTE: 30,
  DAILY_END_HOUR: 20,
  DAILY_END_MINUTE: 0,
};

// ============================================
// FREE AGENT CONFIGURATION
// ============================================

export const FREE_AGENT_CONFIG = {
  POOL_SIZE: 4,
  MARKET_HOURS_ROTATION_MS: 5_400_000,  // 90 minutes during market hours
  AFTER_HOURS_ROTATION_MS: 10_800_000,  // 3 hours after hours (crypto-only)
  CRYPTO_ROTATION_INTERVAL: 2,          // every other market-hours rotation includes crypto
};

// ============================================
// US MARKET HOLIDAYS 2026
// ============================================

export const US_MARKET_HOLIDAYS_2026 = [
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Day
  '2026-02-16', // Presidents' Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format a date to YYYY-MM-DD string
 * @param {Date} date
 * @returns {string}
 */
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check if a date is a trading day (weekday AND not a US market holiday)
 * @param {Date} date
 * @returns {boolean}
 */
export function isTradingDay(date) {
  const day = date.getDay();
  // Weekend check
  if (day === 0 || day === 6) return false;
  // Holiday check
  const dateKey = formatDateKey(date);
  return !US_MARKET_HOLIDAYS_2026.includes(dateKey);
}

/**
 * Get array of trading day dates starting from a given date, skipping weekends and holidays
 * @param {Date} startDate - First potential trading day
 * @param {number} numDays - Number of trading days needed (e.g. 3 for PvP)
 * @returns {string[]} Array of ISO date strings (YYYY-MM-DD)
 */
export function getTradingDayDates(startDate, numDays = 3) {
  const dates = [];
  const current = new Date(startDate);

  while (dates.length < numDays) {
    if (isTradingDay(current)) {
      dates.push(formatDateKey(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Get current trading day number (1-indexed) based on trading day dates
 * Returns 0 if before start, numDays+1 if after end
 * @param {string[]} tradingDayDates - Array of date strings from getTradingDayDates
 * @returns {number} 1, 2, 3, etc. (or 0 if not started, tradingDayDates.length + 1 if past end)
 */
export function getCurrentTradingDay(tradingDayDates) {
  if (!tradingDayDates || tradingDayDates.length === 0) return 1;

  const et = getEasternTime();
  const today = formatDateKey(et);

  const index = tradingDayDates.indexOf(today);
  if (index >= 0) return index + 1;

  // Check if before first day
  if (today < tradingDayDates[0]) return 0;

  // Check if after last day
  if (today > tradingDayDates[tradingDayDates.length - 1]) {
    return tradingDayDates.length + 1;
  }

  // Between trading days (weekend/holiday) — return the next trading day number
  for (let i = 0; i < tradingDayDates.length; i++) {
    if (today < tradingDayDates[i]) return i + 1;
  }

  return tradingDayDates.length;
}

/**
 * Get battle end time (8:00 PM ET on last trading day)
 * @param {string[]} tradingDayDates - Array of trading day dates
 * @returns {Date}
 */
export function getBattleEndTimeV4(tradingDayDates) {
  if (!tradingDayDates || tradingDayDates.length === 0) {
    const et = getEasternTime();
    et.setHours(V4_PVP_TIMING.DAILY_END_HOUR, V4_PVP_TIMING.DAILY_END_MINUTE, 0, 0);
    return et;
  }

  const lastDay = tradingDayDates[tradingDayDates.length - 1];
  const [year, month, day] = lastDay.split('-').map(Number);
  const endTime = new Date(year, month - 1, day);
  endTime.setHours(V4_PVP_TIMING.DAILY_END_HOUR, V4_PVP_TIMING.DAILY_END_MINUTE, 0, 0);
  return endTime;
}

/**
 * Get daily swaps remaining for the current day
 * @param {Object} swaps - Player's swaps object: { remaining: { day1: 3, day2: 3, day3: 3 } }
 * @param {number} currentDay - Current trading day (1-indexed)
 * @returns {number}
 */
export function getDailySwapsRemaining(swaps, currentDay) {
  if (!swaps || !swaps.remaining) return 0;
  // Clamp to valid range — if before day 1 or after last day, use nearest valid day
  const days = Object.keys(swaps.remaining).length;
  if (days === 0) return 0;
  const clampedDay = Math.max(1, Math.min(currentDay, days));
  return swaps.remaining[`day${clampedDay}`] ?? 0;
}

/**
 * Get free agent rotation configuration based on current time of day
 * Market hours: mixed stocks+crypto, 90-minute rotation
 * After hours: crypto-only, 3-hour rotation
 *
 * @param {Date} [now] - Optional current time (defaults to Eastern Time now)
 * @returns {{ rotationMs: number, mode: 'mixed' | 'crypto_only', includeStocks: boolean }}
 */
export function getFreeAgentConfig(now) {
  const et = now || getEasternTime();
  const hour = et.getHours();
  const minute = et.getMinutes();
  const day = et.getDay();
  const currentMinutes = hour * 60 + minute;

  const marketOpen = V4_PVP_TIMING.DAILY_START_HOUR * 60 + V4_PVP_TIMING.DAILY_START_MINUTE; // 9:30 = 570
  const marketClose = V4_PVP_TIMING.MARKET_CLOSE_HOUR * 60 + V4_PVP_TIMING.MARKET_CLOSE_MINUTE; // 16:00 = 960

  const isWeekday = day >= 1 && day <= 5;
  const isDuringMarketHours = isWeekday && currentMinutes >= marketOpen && currentMinutes < marketClose;

  // Also check if it's a holiday
  const dateKey = formatDateKey(et);
  const isHoliday = US_MARKET_HOLIDAYS_2026.includes(dateKey);

  if (isDuringMarketHours && !isHoliday) {
    return {
      rotationMs: FREE_AGENT_CONFIG.MARKET_HOURS_ROTATION_MS,
      mode: 'mixed',
      includeStocks: true,
    };
  }

  return {
    rotationMs: FREE_AGENT_CONFIG.AFTER_HOURS_ROTATION_MS,
    mode: 'crypto_only',
    includeStocks: false,
  };
}

/**
 * Initialize the swaps object for a new V4 battle
 * @param {boolean} isTraining - Whether this is a training battle
 * @param {number} tradingDays - Number of trading days
 * @returns {Object} swaps structure
 */
export function initializeSwaps(isTraining = false, tradingDays = 3) {
  const remaining = {};

  if (isTraining) {
    remaining.day1 = V4_TRAINING_TIMING.TOTAL_SWAPS;
  } else {
    for (let i = 1; i <= tradingDays; i++) {
      remaining[`day${i}`] = V4_PVP_TIMING.SWAPS_PER_DAY;
    }
  }

  return {
    remaining,
    history: [],
  };
}

/**
 * Initialize dailyOpenPrices object for a new V4 battle
 * @param {number} tradingDays - Number of trading days
 * @returns {Object} dailyOpenPrices structure with empty day objects
 */
export function initializeDailyOpenPrices(tradingDays = 3) {
  const prices = {};
  for (let i = 1; i <= tradingDays; i++) {
    prices[`day${i}`] = {};
  }
  return prices;
}
