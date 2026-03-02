// src/utils/shockwaveUtils.js
// Shockwave "Lock-In" Effect — centralized config + pure utility functions.
// All tuning variables live here for easy post-implementation adjustment.

export const SHOCKWAVE_CONFIG = {
  // Wave expansion (overlay)
  waveDuration: 0.8,                    // seconds for overlay to fully expand
  waveMaxScale: 15,                     // how much the circle scales
  waveEasing: [0.1, 0.9, 0.2, 1],      // cubic-bezier: burst fast, decelerate

  // Card ripple
  delayMultiplier: 0.0015,              // seconds per pixel of distance
  minDelay: 0.05,                       // seconds — closest card
  maxDelay: 0.6,                        // seconds — cap for furthest card

  // Card flinch
  flinchScale: 0.95,
  flinchTranslateY: 2,                  // pixels
  flinchSpring: { stiffness: 400, damping: 25 },

  // Button recoil
  recoilScale: 0.88,
  recoilDuration: 0.08,                 // seconds for compression
  recoilSpring: { stiffness: 300, damping: 15 },

  // Audio
  audioVolume: 0.7,
  audioPath: '/sounds/draft-thud.mp3',

  // Haptic
  hapticPattern: [15, 30, 25],          // vibrate burst
};

/**
 * Check if the user prefers reduced motion.
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Calculate per-card animation delays based on distance from shockwave origin.
 *
 * @param {number} originX — shockwave center X (px, viewport coords)
 * @param {number} originY — shockwave center Y (px, viewport coords)
 * @param {Map<string, HTMLElement>} cardRefs — Map of symbol → DOM element
 * @returns {Map<string, number>} — Map of symbol → delay in seconds
 */
export function calculateCardDelays(originX, originY, cardRefs) {
  const delays = new Map();
  if (!cardRefs || cardRefs.size === 0) return delays;

  const { delayMultiplier, minDelay, maxDelay } = SHOCKWAVE_CONFIG;

  cardRefs.forEach((el, symbol) => {
    const rect = el.getBoundingClientRect();
    const cardCenterX = rect.left + rect.width / 2;
    const cardCenterY = rect.top + rect.height / 2;
    const distance = Math.hypot(cardCenterX - originX, cardCenterY - originY);
    const rawDelay = distance * delayMultiplier;
    delays.set(symbol, Math.min(Math.max(rawDelay, minDelay), maxDelay));
  });

  return delays;
}

/**
 * Get the longest delay from a delays map (for cleanup timer calculation).
 * @param {Map<string, number>} delays
 * @returns {number} seconds
 */
export function getMaxDelay(delays) {
  let max = 0;
  delays.forEach((d) => { if (d > max) max = d; });
  return max;
}
