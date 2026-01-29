// /src/constants/breakpoints.js
// Centralized responsive breakpoint definitions
// Standardized on: mobile (<= 430px), tablet (<= 768px), desktop (> 768px)

/**
 * Breakpoint pixel values
 * Based on common device widths:
 * - 430px: iPhone 14 Pro Max viewport width
 * - 768px: iPad portrait / standard tablet breakpoint
 */
export const BREAKPOINTS = {
  mobile: 430,   // Max width for mobile layouts
  tablet: 768,   // Max width for tablet layouts
  // desktop: > 768px (implicit)
};

/**
 * Media query strings for CSS-in-JS usage
 */
export const MEDIA_QUERIES = {
  mobile: `(max-width: ${BREAKPOINTS.mobile}px)`,
  tablet: `(max-width: ${BREAKPOINTS.tablet}px)`,
  desktop: `(min-width: ${BREAKPOINTS.tablet + 1}px)`,
};

/**
 * Helper to check if a width qualifies as mobile
 * @param {number} width - Window inner width
 * @returns {boolean}
 */
export const isMobileWidth = (width) => width <= BREAKPOINTS.mobile;

/**
 * Helper to check if a width qualifies as tablet
 * @param {number} width - Window inner width
 * @returns {boolean}
 */
export const isTabletWidth = (width) => width > BREAKPOINTS.mobile && width <= BREAKPOINTS.tablet;

/**
 * Helper to check if a width qualifies as desktop
 * @param {number} width - Window inner width
 * @returns {boolean}
 */
export const isDesktopWidth = (width) => width > BREAKPOINTS.tablet;
