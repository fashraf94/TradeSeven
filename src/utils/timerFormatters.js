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

/**
 * Format time elapsed since a timestamp
 * Returns human-readable format: "Just now", "5m ago", "2h ago", "1d ago"
 *
 * @param {string|Date|number} createdAt - Timestamp to compare against now
 * @returns {string} Formatted time ago string
 */
export function formatTimeAgo(createdAt) {
  if (!createdAt) return 'Just now';

  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

/**
 * Format countdown time until a scheduled start time
 * Returns compact format: "5m", "1h 30m", "Starting now!"
 *
 * @param {string|Date|number} scheduledStart - Future timestamp
 * @returns {string|null} Formatted countdown string, or null if no scheduledStart
 */
export function getTimeUntilStart(scheduledStart) {
  if (!scheduledStart) return null;
  const start = new Date(scheduledStart);
  const now = new Date();
  const diffMs = start - now;

  if (diffMs <= 0) return 'Starting now!';

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;

  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  if (remainingMins === 0) return `${diffHours}h`;
  return `${diffHours}h ${remainingMins}m`;
}
