// /src/services/scoring/timingUtils.js

import { SESSIONS, SESSION_ORDER, PVP_TIMING, SUBSTITUTION } from './constants';

/**
 * Convert a Date to Eastern Time components
 * @param {Date} date - Date to convert
 * @returns {object} { hour, minute, dayOfWeek }
 */
export const toEasternTime = (date = new Date()) => {
  const et = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return {
    hour: et.getHours(),
    minute: et.getMinutes(),
    dayOfWeek: et.getDay(),  // 0 = Sunday, 6 = Saturday
    date: et
  };
};

/**
 * Check if current time is a weekday (Mon-Fri)
 * @param {Date} date - Date to check (defaults to now)
 * @returns {boolean}
 */
export const isWeekday = (date = new Date()) => {
  const { dayOfWeek } = toEasternTime(date);
  return dayOfWeek >= 1 && dayOfWeek <= 5;
};

/**
 * Check if current time is within market hours (9:30 AM - 8:00 PM ET)
 * @param {Date} date - Date to check (defaults to now)
 * @returns {boolean}
 */
export const isMarketHours = (date = new Date()) => {
  if (!isWeekday(date)) return false;

  const { hour, minute } = toEasternTime(date);
  const currentMinutes = hour * 60 + minute;

  const marketOpen = 9 * 60 + 30;   // 9:30 AM = 570 minutes
  const marketClose = 20 * 60;       // 8:00 PM = 1200 minutes

  return currentMinutes >= marketOpen && currentMinutes < marketClose;
};

/**
 * Check if current time is within stock trading hours (9:30 AM - 4:00 PM ET)
 * @param {Date} date - Date to check (defaults to now)
 * @returns {boolean}
 */
export const isStockTradingHours = (date = new Date()) => {
  if (!isWeekday(date)) return false;

  const { hour, minute } = toEasternTime(date);
  const currentMinutes = hour * 60 + minute;

  const marketOpen = 9 * 60 + 30;   // 9:30 AM
  const marketClose = 16 * 60;       // 4:00 PM

  return currentMinutes >= marketOpen && currentMinutes < marketClose;
};

/**
 * Get the current session based on time
 * @param {Date} date - Date to check (defaults to now)
 * @returns {object|null} { key, name, start, end, remainingMinutes } or null if outside sessions
 */
export const getCurrentSession = (date = new Date()) => {
  if (!isWeekday(date)) return null;

  const { hour, minute } = toEasternTime(date);
  const currentMinutes = hour * 60 + minute;

  for (const key of SESSION_ORDER) {
    const session = SESSIONS[key];
    const startMinutes = session.start.hour * 60 + session.start.minute;
    const endMinutes = session.end.hour * 60 + session.end.minute;

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return {
        key,
        name: session.name,
        start: session.start,
        end: session.end,
        cryptoOnly: session.cryptoOnly || false,
        remainingMinutes: endMinutes - currentMinutes,
        progressPercent: Math.round(((currentMinutes - startMinutes) / (endMinutes - startMinutes)) * 100)
      };
    }
  }

  return null;
};

/**
 * Get the next session (for displaying countdown)
 * @param {Date} date - Date to check (defaults to now)
 * @returns {object|null} { key, name, startsIn } or null
 */
export const getNextSession = (date = new Date()) => {
  const { hour, minute, dayOfWeek } = toEasternTime(date);
  const currentMinutes = hour * 60 + minute;

  // If weekend, next session is Monday Morning Bell
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
    return {
      key: 'MORNING_BELL',
      name: 'Morning Bell',
      startsIn: `${daysUntilMonday} day${daysUntilMonday > 1 ? 's' : ''}`
    };
  }

  // Find next session today
  for (const key of SESSION_ORDER) {
    const session = SESSIONS[key];
    const startMinutes = session.start.hour * 60 + session.start.minute;

    if (currentMinutes < startMinutes) {
      const minutesUntil = startMinutes - currentMinutes;
      const hours = Math.floor(minutesUntil / 60);
      const mins = minutesUntil % 60;

      return {
        key,
        name: session.name,
        startsIn: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
      };
    }
  }

  // Past all sessions today, next is tomorrow's Morning Bell
  return {
    key: 'MORNING_BELL',
    name: 'Morning Bell',
    startsIn: 'Tomorrow 9:30 AM ET'
  };
};

/**
 * Check if within PvP commitment window (9:30 AM - 3:55 PM ET, weekdays)
 * @param {Date} date - Date to check (defaults to now)
 * @returns {boolean}
 */
export const isWithinCommitmentWindow = (date = new Date()) => {
  if (!isWeekday(date)) return false;

  const { hour, minute } = toEasternTime(date);
  const currentMinutes = hour * 60 + minute;

  const windowOpen = 9 * 60 + 30;   // 9:30 AM
  const windowClose = PVP_TIMING.COMMITMENT_DEADLINE.hour * 60 +
                      PVP_TIMING.COMMITMENT_DEADLINE.minute;  // 3:55 PM

  return currentMinutes >= windowOpen && currentMinutes < windowClose;
};

/**
 * Get time until commitment deadline
 * @param {Date} date - Date to check (defaults to now)
 * @returns {object} { isOpen, minutesRemaining, formatted }
 */
export const getCommitmentDeadlineInfo = (date = new Date()) => {
  const isOpen = isWithinCommitmentWindow(date);

  if (!isOpen) {
    return {
      isOpen: false,
      minutesRemaining: 0,
      formatted: 'Closed'
    };
  }

  const { hour, minute } = toEasternTime(date);
  const currentMinutes = hour * 60 + minute;
  const deadlineMinutes = PVP_TIMING.COMMITMENT_DEADLINE.hour * 60 +
                          PVP_TIMING.COMMITMENT_DEADLINE.minute;

  const remaining = deadlineMinutes - currentMinutes;
  const hours = Math.floor(remaining / 60);
  const mins = remaining % 60;

  return {
    isOpen: true,
    minutesRemaining: remaining,
    formatted: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  };
};

/**
 * Check if within a substitution window
 * @param {Date} date - Date to check (defaults to now)
 * @returns {object} { isOpen, windowName, remainingMinutes }
 */
export const getSubstitutionWindowStatus = (date = new Date()) => {
  if (!isWeekday(date)) {
    return { isOpen: false, windowName: null, remainingMinutes: 0 };
  }

  const { hour, minute } = toEasternTime(date);
  const currentMinutes = hour * 60 + minute;

  for (const window of SUBSTITUTION.WINDOWS) {
    const startMinutes = window.start.hour * 60 + window.start.minute;
    const endMinutes = window.end.hour * 60 + window.end.minute;

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return {
        isOpen: true,
        windowName: window.name,
        remainingMinutes: endMinutes - currentMinutes
      };
    }
  }

  return { isOpen: false, windowName: null, remainingMinutes: 0 };
};

/**
 * Get the next trading day (skips weekends)
 * @param {Date} date - Starting date (defaults to now)
 * @returns {Date} Next trading day at 9:30 AM ET
 */
export const getNextTradingDay = (date = new Date()) => {
  const et = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  // Move to next day
  et.setDate(et.getDate() + 1);

  // Skip weekends
  while (et.getDay() === 0 || et.getDay() === 6) {
    et.setDate(et.getDate() + 1);
  }

  // Set to market open
  et.setHours(9, 30, 0, 0);

  return et;
};

/**
 * Get today's commitment deadline
 * @param {Date} date - Date to check (defaults to now)
 * @returns {Date} Today's 3:55 PM ET
 */
export const getTodayDeadline = (date = new Date()) => {
  const et = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  et.setHours(
    PVP_TIMING.COMMITMENT_DEADLINE.hour,
    PVP_TIMING.COMMITMENT_DEADLINE.minute,
    0, 0
  );
  return et;
};

/**
 * Format remaining time for display
 * @param {number} minutes - Minutes remaining
 * @returns {string} Formatted string like "2h 15m" or "45m"
 */
export const formatRemainingTime = (minutes) => {
  if (minutes <= 0) return 'Ended';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};
