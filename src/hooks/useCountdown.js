// useCountdown - Reusable countdown timer hook
// Used for lobby expiration, scheduled starts, and other time-based countdowns

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Format milliseconds into human-readable countdown
 * @param {number} ms - Milliseconds remaining
 * @param {Object} options - Formatting options
 * @returns {string} Formatted time string
 */
function formatCountdown(ms, options = {}) {
  const { showSeconds = true, compact = false } = options;

  if (ms <= 0) return compact ? '0s' : 'Expired';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    if (compact) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    if (showSeconds && minutes < 5) {
      return `${minutes}m ${seconds}s`;
    }
    return `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * useCountdown - Hook for countdown timer functionality
 *
 * @param {string|Date|number|null} targetTime - Target timestamp to count down to
 * @param {Object} options - Configuration options
 * @param {number} options.interval - Update interval in ms (default: 1000)
 * @param {Function} options.onExpire - Callback when countdown reaches zero
 * @param {boolean} options.autoStart - Start automatically (default: true)
 * @param {boolean} options.showSeconds - Include seconds in formatted output (default: true)
 * @param {boolean} options.compact - Use compact format (default: false)
 *
 * @returns {Object} Countdown state and controls
 */
export function useCountdown(targetTime, options = {}) {
  const {
    interval = 1000,
    onExpire = null,
    autoStart = true,
    showSeconds = true,
    compact = false,
  } = options;

  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef(null);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  // Keep onExpire callback updated
  onExpireRef.current = onExpire;

  // Calculate time remaining
  const calculateRemaining = useCallback(() => {
    if (!targetTime) return 0;
    const target = new Date(targetTime).getTime();
    const now = Date.now();
    return Math.max(0, target - now);
  }, [targetTime]);

  // Update countdown
  const update = useCallback(() => {
    const remaining = calculateRemaining();
    setTimeRemaining(remaining);

    // Fire onExpire callback once when timer reaches zero
    if (remaining <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      if (onExpireRef.current) {
        onExpireRef.current();
      }
    }
  }, [calculateRemaining]);

  // Start/stop interval
  useEffect(() => {
    if (!targetTime || !isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Reset expired flag when target changes
    hasExpiredRef.current = false;

    // Initial update
    update();

    // Set up interval
    intervalRef.current = setInterval(update, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [targetTime, isRunning, interval, update]);

  // Control functions
  const start = useCallback(() => setIsRunning(true), []);
  const stop = useCallback(() => setIsRunning(false), []);
  const restart = useCallback((newTarget) => {
    hasExpiredRef.current = false;
    if (newTarget !== undefined) {
      // Note: This requires the parent to update targetTime prop
      // This is just a signal to restart the countdown
    }
    setIsRunning(true);
    update();
  }, [update]);

  // Derived values
  const totalSeconds = Math.floor(timeRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const isExpired = timeRemaining <= 0;
  const formatted = formatCountdown(timeRemaining, { showSeconds, compact });

  return {
    // Time values
    timeRemaining,     // Raw milliseconds
    totalSeconds,      // Total seconds remaining
    hours,             // Hours component
    minutes,           // Minutes component
    seconds,           // Seconds component

    // State
    isExpired,         // True when countdown has reached zero
    isRunning,         // True when countdown is active
    formatted,         // Human-readable string

    // Controls
    start,             // Start the countdown
    stop,              // Pause the countdown
    restart,           // Restart the countdown
  };
}

/**
 * useExpirationStatus - Hook for lobby expiration status with periodic updates
 *
 * @param {Object} lobby - Lobby document
 * @param {Function} getStatusFn - Function to get status (default: getLobbyExpirationStatus)
 * @param {number} interval - Update interval in ms (default: 10000)
 *
 * @returns {Object|null} Expiration status object
 */
export function useExpirationStatus(lobby, getStatusFn, interval = 10000) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!lobby || !getStatusFn) {
      setStatus(null);
      return;
    }

    const updateStatus = () => {
      setStatus(getStatusFn(lobby));
    };

    updateStatus();
    const timer = setInterval(updateStatus, interval);

    return () => clearInterval(timer);
  }, [lobby, getStatusFn, interval]);

  return status;
}

// Export formatCountdown for external use
export { formatCountdown };
