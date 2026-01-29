// /src/utils/timerFormatters.js
// Centralized timer formatting utilities for Clash cards

/**
 * Timer display colors
 */
export const TIMER_COLORS = {
  normal: '#00d9ff',      // Cyan - plenty of time
  training: '#9333ea',    // Purple - training mode
  warning: '#ef4444',     // Red - time running low
};

/**
 * Format remaining time for clash timer display
 *
 * @param {number} remainingMs - Remaining time in milliseconds
 * @param {Object} options
 * @param {boolean} options.isTraining - Use training (purple) color scheme
 * @param {boolean} options.includeUrgent - Include urgent flag in response (default: true)
 * @returns {{ text: string, color: string, pulse: boolean, urgent?: boolean }}
 */
export function formatClashTimer(remainingMs, options = {}) {
  const { isTraining = false, includeUrgent = true } = options;

  // Ended state
  if (remainingMs <= 0) {
    return {
      text: 'ENDED',
      color: TIMER_COLORS.warning,
      pulse: false,
      ...(includeUrgent && { urgent: false }),
    };
  }

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

  // More than 1 hour remaining
  if (hours >= 1) {
    return {
      text: `${hours}h ${minutes}m`,
      color: isTraining ? TIMER_COLORS.training : TIMER_COLORS.normal,
      pulse: false,
      ...(includeUrgent && { urgent: false }),
    };
  }

  // Less than 1 hour but more than 5 minutes
  if (minutes > 5) {
    return {
      text: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      color: TIMER_COLORS.warning,
      pulse: true,
      ...(includeUrgent && { urgent: false }),
    };
  }

  // 5 minutes or less - urgent
  return {
    text: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}!!`,
    color: TIMER_COLORS.warning,
    pulse: true,
    ...(includeUrgent && { urgent: true }),
  };
}

/**
 * Format timer specifically for training mode (no urgent flag)
 * Convenience wrapper for training card usage
 *
 * @param {number} remainingMs - Remaining time in milliseconds
 * @returns {{ text: string, color: string, pulse: boolean }}
 */
export function formatTrainingTimer(remainingMs) {
  const result = formatClashTimer(remainingMs, {
    isTraining: true,
    includeUrgent: false
  });
  return result;
}
