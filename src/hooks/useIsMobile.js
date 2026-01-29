// /src/hooks/useIsMobile.js
// Centralized responsive hook with SSR safety and resize debouncing

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BREAKPOINTS } from '../constants/breakpoints';

/**
 * Debounce utility for resize handler
 */
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Get initial window width with SSR safety
 * @param {number} fallback - Value to return during SSR
 * @returns {number}
 */
const getWindowWidth = (fallback = BREAKPOINTS.mobile + 1) => {
  if (typeof window === 'undefined') return fallback;
  return window.innerWidth;
};

/**
 * Hook for responsive mobile/tablet detection
 * Features:
 * - SSR-safe initialization
 * - Debounced resize handling (100ms)
 * - Memoized breakpoint calculations
 *
 * @param {Object} options
 * @param {number} options.mobileBreakpoint - Override mobile breakpoint (default: 430)
 * @param {number} options.tabletBreakpoint - Override tablet breakpoint (default: 768)
 * @param {number} options.debounceMs - Debounce delay in ms (default: 100)
 * @returns {{ isMobile: boolean, isTablet: boolean, isDesktop: boolean, width: number }}
 */
export function useIsMobile(options = {}) {
  const {
    mobileBreakpoint = BREAKPOINTS.mobile,
    tabletBreakpoint = BREAKPOINTS.tablet,
    debounceMs = 100,
  } = options;

  // Initialize with actual window width to prevent layout flash
  const [width, setWidth] = useState(() => getWindowWidth(mobileBreakpoint + 1));

  // Memoized resize handler
  const handleResize = useCallback(() => {
    setWidth(window.innerWidth);
  }, []);

  // Debounced version
  const debouncedResize = useMemo(
    () => debounce(handleResize, debounceMs),
    [handleResize, debounceMs]
  );

  useEffect(() => {
    // Sync state on mount (handles SSR hydration mismatch)
    handleResize();

    window.addEventListener('resize', debouncedResize);
    return () => window.removeEventListener('resize', debouncedResize);
  }, [debouncedResize, handleResize]);

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(() => ({
    isMobile: width <= mobileBreakpoint,
    isTablet: width > mobileBreakpoint && width <= tabletBreakpoint,
    isDesktop: width > tabletBreakpoint,
    width,
  }), [width, mobileBreakpoint, tabletBreakpoint]);
}

export default useIsMobile;
