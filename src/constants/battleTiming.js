// MarketClash - Battle Timing Constants and Utilities
// Defines timing rules for PvP 1v1, Training, and Snake Draft battles
//
// All times are in Eastern Time (ET)

import { isMarketHoliday, formatDateString } from '../utils/marketHolidays';

// ============================================
// PVP 1V1 TIMING CONSTANTS
// ============================================

export const PVP_TIMING = {
  // Commitment deadline: 3:55 PM ET (5 minutes before market close)
  COMMITMENT_DEADLINE_HOUR: 15,
  COMMITMENT_DEADLINE_MINUTE: 55,

  // Baseline price lock: 4:00 PM ET (market close)
  BASELINE_LOCK_HOUR: 16,
  BASELINE_LOCK_MINUTE: 0,

  // Battle start: 9:30 AM ET (next market open)
  BATTLE_START_HOUR: 9,
  BATTLE_START_MINUTE: 30,

  // Battle end: 8:00 PM ET (same day)
  BATTLE_END_HOUR: 20,
  BATTLE_END_MINUTE: 0,

  // Session boundaries (ET)
  SESSIONS: {
    MORNING_BELL: { start: { hour: 9, minute: 30 }, end: { hour: 11, minute: 30 } },
    MIDDAY: { start: { hour: 11, minute: 30 }, end: { hour: 14, minute: 0 } },
    POWER_HOUR: { start: { hour: 14, minute: 0 }, end: { hour: 16, minute: 0 } },
    NIGHT_GAME: { start: { hour: 16, minute: 0 }, end: { hour: 20, minute: 0 } }
  },

  // Substitution windows (15 minutes each)
  SUBSTITUTION_WINDOWS: [
    { start: { hour: 11, minute: 30 }, end: { hour: 11, minute: 45 } },
    { start: { hour: 14, minute: 0 }, end: { hour: 14, minute: 15 } }
  ],

  // Maximum substitutions per battle
  MAX_SUBSTITUTIONS: 2,

  // Challenge code expiry: same day at 3:55 PM ET
  CODE_EXPIRY_HOURS: 0 // Expires at deadline, not X hours from creation
};

// ============================================
// TRAINING MODE CONFIGURATION
// ============================================

export const TRAINING_CONFIG = {
  // Thresholds reduced by 30% for more action
  THRESHOLD_REDUCTION: 0.3,

  // XP rewards (reduced from PvP)
  XP_WIN: 10,
  XP_LOSS: 5,

  // No conviction multipliers
  USE_CONVICTION: false,

  // No session bonuses
  USE_SESSION_BONUSES: false,

  // No bench/substitutions
  HAS_BENCH: false
};

// ============================================
// SNAKE DRAFT CONFIGURATION
// ============================================

export const SNAKE_DRAFT_CONFIG = {
  // No conviction multipliers (equal weight)
  USE_CONVICTION: false,

  // No session bonuses
  USE_SESSION_BONUSES: false,

  // Daily reset at market open
  DAILY_RESET_HOUR: 9,
  DAILY_RESET_MINUTE: 30,

  // Battle duration
  STOCKS_END_DAY: 'friday',
  STOCKS_END_HOUR: 15, // 3 PM CT = 4 PM ET
  CRYPTO_DURATION_DAYS: 7
};

// ============================================
// TIMEZONE UTILITIES
// ============================================

/**
 * Get current time in Eastern timezone
 * @returns {Date} Current time as Date object in ET
 */
export function getEasternTime() {
  const now = new Date();
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(etString);
}

/**
 * Get current day of week in Eastern timezone
 * @returns {number} Day of week (0 = Sunday, 6 = Saturday)
 */
export function getEasternDayOfWeek() {
  return getEasternTime().getDay();
}

/**
 * Check if today is a weekday (Mon-Fri)
 * @returns {boolean}
 */
export function isWeekday() {
  const day = getEasternDayOfWeek();
  return day >= 1 && day <= 5;
}

/**
 * Check if today is a weekend (Sat-Sun)
 * @returns {boolean}
 */
export function isWeekend() {
  return !isWeekday();
}

// ============================================
// PVP TIMING UTILITIES
// ============================================

/**
 * Check if current time is within commitment window
 * (After market open 9:30 AM, before deadline 3:55 PM)
 * @returns {boolean}
 */
export function isWithinCommitmentWindow() {
  const now = new Date();
  const et = getEasternTime();
  const hour = et.getHours();
  const minute = et.getMinutes();
  const day = et.getDay();

  // Weekdays only (Mon-Fri = 1-5)
  if (day === 0 || day === 6) return false;

  // After market open (9:30 AM) and before deadline (3:55 PM)
  const afterOpen = hour > 9 || (hour === 9 && minute >= 30);
  const beforeDeadline = hour < 15 || (hour === 15 && minute < 55);

  return afterOpen && beforeDeadline;
}

/**
 * Get the commitment deadline for today
 * @returns {Date} Today's 3:55 PM ET deadline
 */
export function getTodayDeadline() {
  const et = getEasternTime();
  et.setHours(PVP_TIMING.COMMITMENT_DEADLINE_HOUR, PVP_TIMING.COMMITMENT_DEADLINE_MINUTE, 0, 0);
  return et;
}

/**
 * Get time remaining until commitment deadline
 * @returns {{ hours: number, minutes: number, expired: boolean }}
 */
export function getTimeUntilDeadline() {
  const now = new Date();
  const deadline = getTodayDeadline();
  const diff = deadline - now;

  if (diff <= 0) {
    return { hours: 0, minutes: 0, expired: true };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { hours, minutes, expired: false };
}

/**
 * Get the baseline price lock time (4:00 PM ET)
 * @returns {Date}
 */
export function getBaselineLockTime() {
  const et = getEasternTime();
  et.setHours(PVP_TIMING.BASELINE_LOCK_HOUR, PVP_TIMING.BASELINE_LOCK_MINUTE, 0, 0);
  return et;
}

/**
 * Get the next battle start time
 * @returns {Date} Next market open (9:30 AM ET)
 */
export function getNextBattleStart() {
  const et = getEasternTime();

  // Set to 9:30 AM
  et.setHours(PVP_TIMING.BATTLE_START_HOUR, PVP_TIMING.BATTLE_START_MINUTE, 0, 0);

  // If it's past 9:30 AM, move to tomorrow
  if (new Date() >= et) {
    et.setDate(et.getDate() + 1);
  }

  // Skip weekends
  while (et.getDay() === 0 || et.getDay() === 6) {
    et.setDate(et.getDate() + 1);
  }

  return et;
}

/**
 * Get the battle end time for a given start date
 * @param {Date} startDate - Battle start date
 * @returns {Date} 8:00 PM ET on the same day
 */
export function getBattleEndTime(startDate) {
  const endTime = new Date(startDate);
  endTime.setHours(PVP_TIMING.BATTLE_END_HOUR, PVP_TIMING.BATTLE_END_MINUTE, 0, 0);
  return endTime;
}

/**
 * Check if currently within a substitution window
 * @returns {{ inWindow: boolean, windowIndex: number, minutesRemaining: number }}
 */
export function isInSubstitutionWindow() {
  const et = getEasternTime();
  const hour = et.getHours();
  const minute = et.getMinutes();
  const currentMinutes = hour * 60 + minute;

  for (let i = 0; i < PVP_TIMING.SUBSTITUTION_WINDOWS.length; i++) {
    const window = PVP_TIMING.SUBSTITUTION_WINDOWS[i];
    const startMinutes = window.start.hour * 60 + window.start.minute;
    const endMinutes = window.end.hour * 60 + window.end.minute;

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return {
        inWindow: true,
        windowIndex: i,
        minutesRemaining: endMinutes - currentMinutes
      };
    }
  }

  return { inWindow: false, windowIndex: -1, minutesRemaining: 0 };
}

/**
 * Get the next substitution window
 * @returns {{ start: Date, end: Date } | null}
 */
export function getNextSubstitutionWindow() {
  const et = getEasternTime();
  const hour = et.getHours();
  const minute = et.getMinutes();
  const currentMinutes = hour * 60 + minute;

  for (const window of PVP_TIMING.SUBSTITUTION_WINDOWS) {
    const startMinutes = window.start.hour * 60 + window.start.minute;

    if (currentMinutes < startMinutes) {
      const startDate = new Date(et);
      startDate.setHours(window.start.hour, window.start.minute, 0, 0);

      const endDate = new Date(et);
      endDate.setHours(window.end.hour, window.end.minute, 0, 0);

      return { start: startDate, end: endDate };
    }
  }

  return null; // No more windows today
}

// ============================================
// TRAINING MODE UTILITIES
// ============================================

/**
 * Get current session info for training
 * @returns {object} { sessionName, endTime, remainingMinutes, isMarketHours }
 */
export function getCurrentSession() {
  const now = new Date();
  const et = getEasternTime();
  const hour = et.getHours();
  const minute = et.getMinutes();

  const sessions = [
    { name: 'MORNING_BELL', start: 9.5, end: 11.5 },
    { name: 'MIDDAY', start: 11.5, end: 14 },
    { name: 'POWER_HOUR', start: 14, end: 16 },
    { name: 'NIGHT_GAME', start: 16, end: 20 }
  ];

  const currentTime = hour + minute / 60;

  for (const session of sessions) {
    if (currentTime >= session.start && currentTime < session.end) {
      const endHour = Math.floor(session.end);
      const endMinute = (session.end % 1) * 60;
      const endTime = new Date(et);
      endTime.setHours(endHour, endMinute, 0, 0);

      const remainingMs = endTime - now;
      const remainingMinutes = Math.floor(remainingMs / 60000);

      return {
        sessionName: session.name,
        endTime,
        remainingMinutes,
        isMarketHours: true
      };
    }
  }

  return {
    sessionName: null,
    endTime: null,
    remainingMinutes: 0,
    isMarketHours: false
  };
}

/**
 * Check if training is available (market hours only, weekdays only)
 * @returns {boolean}
 */
export function isTrainingAvailable() {
  const { isMarketHours } = getCurrentSession();
  const day = getEasternDayOfWeek();

  // Weekdays only
  if (day === 0 || day === 6) return false;

  return isMarketHours;
}

/**
 * Get reduced threshold for training mode
 * @param {number} threshold - Original threshold
 * @returns {number} Reduced threshold (30% lower)
 */
export function getTrainingThreshold(threshold) {
  return threshold * (1 - TRAINING_CONFIG.THRESHOLD_REDUCTION);
}

// ============================================
// SNAKE DRAFT UTILITIES
// ============================================

/**
 * Get next trading day
 * @returns {Date}
 */
export function getNextTradingDay() {
  const et = getEasternTime();
  et.setDate(et.getDate() + 1);

  // Skip weekends
  while (et.getDay() === 0 || et.getDay() === 6) {
    et.setDate(et.getDate() + 1);
  }

  et.setHours(SNAKE_DRAFT_CONFIG.DAILY_RESET_HOUR, SNAKE_DRAFT_CONFIG.DAILY_RESET_MINUTE, 0, 0);
  return et;
}

/**
 * Determine the correct battle start date based on when a draft completes.
 *
 * Rules:
 * - Weekday, before 9:30 AM ET  -> today (market hasn't opened yet)
 * - Weekday, >= 9:30 AM ET      -> next trading day
 * - Weekend                      -> Monday (next trading day)
 *
 * @param {Date|string} completionTime - When the draft completed (defaults to now)
 * @returns {string} YYYY-MM-DD string in Eastern Time representing Day 1
 */
export function getBattleStartDate(completionTime) {
  const completed = completionTime ? new Date(completionTime) : new Date();
  const etString = completed.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etString);

  const dayOfWeek = et.getDay(); // 0=Sun, 6=Sat
  const currentMinutesOfDay = et.getHours() * 60 + et.getMinutes();
  const marketOpenMinutes = 9 * 60 + 30; // 9:30 AM = 570 minutes

  let startDate = new Date(et);

  const isNonTradingDay = (d) =>
    d.getDay() === 0 || d.getDay() === 6 || isMarketHoliday(formatDateString(d));

  if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isMarketHoliday(formatDateString(startDate))) {
    // Trading day
    if (currentMinutesOfDay >= marketOpenMinutes) {
      // Market already open or closed — next trading day
      startDate.setDate(startDate.getDate() + 1);
      while (isNonTradingDay(startDate)) {
        startDate.setDate(startDate.getDate() + 1);
      }
    }
    // else: before market open — today is Day 1
  } else {
    // Weekend or holiday — advance to next trading day
    while (isNonTradingDay(startDate)) {
      startDate.setDate(startDate.getDate() + 1);
    }
  }

  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, '0');
  const day = String(startDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate the battle end date as 5 trading days from start.
 * @param {string} startDate - YYYY-MM-DD string for Day 1
 * @returns {string} YYYY-MM-DD string for Day 5
 */
export function calculateBattleEndDate(startDate) {
  // Parse with noon time to avoid DST midnight edge cases
  const date = new Date(startDate + 'T12:00:00');
  let tradingDays = 0;

  while (tradingDays < 5) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isMarketHoliday(formatDateString(date))) {
      tradingDays++;
      if (tradingDays === 5) break;
    }
    date.setDate(date.getDate() + 1);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get Snake Draft end date based on asset type
 * @param {string} assetType - 'stocks' or 'crypto'
 * @returns {Date}
 */
export function getSnakeDraftEndDate(assetType) {
  const et = getEasternTime();

  if (assetType === 'crypto') {
    // Crypto: 7 days from now
    et.setDate(et.getDate() + SNAKE_DRAFT_CONFIG.CRYPTO_DURATION_DAYS);
  } else {
    // Stocks: Next Friday at 4 PM ET
    const currentDay = et.getDay();
    const daysUntilFriday = (5 - currentDay + 7) % 7 || 7; // If today is Friday, go to next Friday
    et.setDate(et.getDate() + daysUntilFriday);
    et.setHours(16, 0, 0, 0); // 4 PM ET
  }

  return et;
}

/**
 * Get day name for display
 * @param {Date} date
 * @returns {string}
 */
export function getDayName(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

// ============================================
// FORMATTING UTILITIES
// ============================================

/**
 * Format time for display (12-hour format with AM/PM)
 * @param {Date} date
 * @returns {string}
 */
export function formatTimeET(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York'
  }) + ' ET';
}

/**
 * Format countdown for display
 * @param {number} minutes - Minutes remaining
 * @returns {string}
 */
export function formatCountdown(minutes) {
  if (minutes <= 0) return 'Expired';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  // Constants
  PVP_TIMING,
  TRAINING_CONFIG,
  SNAKE_DRAFT_CONFIG,

  // Timezone utilities
  getEasternTime,
  getEasternDayOfWeek,
  isWeekday,
  isWeekend,

  // PvP utilities
  isWithinCommitmentWindow,
  getTodayDeadline,
  getTimeUntilDeadline,
  getBaselineLockTime,
  getNextBattleStart,
  getBattleEndTime,
  isInSubstitutionWindow,
  getNextSubstitutionWindow,

  // Training utilities
  getCurrentSession,
  isTrainingAvailable,
  getTrainingThreshold,

  // Snake Draft utilities
  getNextTradingDay,
  getBattleStartDate,
  calculateBattleEndDate,
  getSnakeDraftEndDate,
  getDayName,

  // Formatting
  formatTimeET,
  formatCountdown
};
