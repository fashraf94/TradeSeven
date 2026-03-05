import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Generic cooldown hook for rate-limiting expensive UI actions.
 * Prevents rapid-fire calls to AI endpoints, bug submission, etc.
 *
 * @param {number} cooldownMs - Cooldown duration in milliseconds
 * @returns {{ isOnCooldown: boolean, trigger: (fn) => Promise, remainingSeconds: number }}
 */
export function useCooldown(cooldownMs = 10000) {
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const trigger = useCallback(async (fn) => {
    if (isOnCooldown) return null;

    setIsOnCooldown(true);
    setRemainingSeconds(Math.ceil(cooldownMs / 1000));

    intervalRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    timerRef.current = setTimeout(() => {
      setIsOnCooldown(false);
      setRemainingSeconds(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }, cooldownMs);

    try {
      return await fn();
    } catch (error) {
      throw error;
    }
  }, [isOnCooldown, cooldownMs]);

  return { isOnCooldown, trigger, remainingSeconds };
}
