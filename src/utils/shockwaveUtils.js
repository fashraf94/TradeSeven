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

// ── BaggerBomb Threshold Shockwave Config ─────────────────────
// Smaller, more frequent, directional shockwaves for live battle events.

export const BAGGER_SHOCKWAVE_CONFIG = {
  // Wave properties
  waveDuration: 0.6,                    // shorter than draft — these happen often
  waveMaxScale: 8,                      // doesn't need to cover full viewport
  waveEasing: [0.1, 0.9, 0.2, 1],
  maxConcurrent: 3,                     // drop oldest if exceeded

  // Colors
  positiveColor: {
    gradient: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.08) 40%, transparent 70%)',
    glow: '0 0 40px 20px rgba(16,185,129,0.3), 0 0 80px 40px rgba(16,185,129,0.15)',
    border: '1px solid rgba(16,185,129,0.3)',
  },
  negativeColor: {
    gradient: 'radial-gradient(circle, rgba(255,51,102,0.2) 0%, rgba(255,51,102,0.08) 40%, transparent 70%)',
    glow: '0 0 40px 20px rgba(255,51,102,0.3), 0 0 80px 40px rgba(255,51,102,0.15)',
    border: '1px solid rgba(255,51,102,0.3)',
  },

  // Tier intensity multipliers (bigger shockwave for bigger events)
  tierScale: {
    bagger: 1.0,
    doubleBagger: 1.3,
    tenBagger: 1.6,
    bust: 1.0,
    crash: 1.3,
    meltdown: 1.6,
  },

  // Audio
  positiveAudioPath: '/sounds/bagger-hit.mp3',
  negativeAudioPath: '/sounds/bust-hit.mp3',
  audioVolume: 0.5,                     // quieter than draft — these are ambient

  // Haptic
  positiveHaptic: [10, 20, 15],
  negativeHaptic: [20, 10, 30, 10, 20], // more jarring pattern for busts

  // Matchup row flinch
  flinchScale: 0.97,
  flinchDuration: 250,                  // ms
};

// Threshold event type sets for quick membership checks
export const THRESHOLD_EVENT_TYPES = new Set([
  'bagger', 'doubleBagger', 'tenBagger', 'bust', 'crash', 'meltdown',
]);

export const POSITIVE_THRESHOLD_TYPES = new Set([
  'bagger', 'doubleBagger', 'tenBagger',
]);
