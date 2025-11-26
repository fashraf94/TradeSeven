// src/config/featureFlags.js
// Feature flags for gradual Firebase migration

/**
 * Feature Flags for MarketClash Firebase Migration
 *
 * ROLLOUT PLAN:
 * ===============
 * Week 1: FIREBASE_AUTH = true (test with beta users)
 * Week 2: FIREBASE_BATTLES = true (test battle sync)
 * Week 3: REALTIME_SYNC = true (full feature set)
 * Week 4: Remove localStorage fallbacks
 *
 * USAGE:
 * ======
 * import { isFeatureEnabled } from './config/featureFlags';
 *
 * if (isFeatureEnabled('FIREBASE_AUTH')) {
 *   // Use Firebase Auth
 * } else {
 *   // Use localStorage fallback
 * }
 */

export const FEATURE_FLAGS = {
  // Authentication
  // true = Firebase Auth, false = localStorage
  FIREBASE_AUTH: false,

  // Battles
  // true = Firestore battles, false = localStorage
  FIREBASE_BATTLES: false,

  // Challenges
  // true = Firestore challenges, false = localStorage
  FIREBASE_CHALLENGES: false,

  // Real-time sync
  // true = Live updates via Firestore listeners, false = manual refresh
  REALTIME_SYNC: false,

  // Debug mode
  // true = Log migration info to console
  DEBUG_MODE: true
};

/**
 * Check if a feature is enabled
 *
 * @param {string} flagName - Name of the feature flag
 * @returns {boolean} - True if enabled, false otherwise
 */
export function isFeatureEnabled(flagName) {
  const enabled = FEATURE_FLAGS[flagName] === true;

  if (FEATURE_FLAGS.DEBUG_MODE && enabled) {
    console.log(`🚩 Feature flag enabled: ${flagName}`);
  }

  return enabled;
}

/**
 * Enable a feature flag (for testing)
 *
 * @param {string} flagName - Name of the feature flag
 */
export function enableFeature(flagName) {
  if (!(flagName in FEATURE_FLAGS)) {
    console.error(`❌ Unknown feature flag: ${flagName}`);
    return;
  }

  FEATURE_FLAGS[flagName] = true;

  if (FEATURE_FLAGS.DEBUG_MODE) {
    console.log(`✅ Feature enabled: ${flagName}`);
  }
}

/**
 * Disable a feature flag (for rollback)
 *
 * @param {string} flagName - Name of the feature flag
 */
export function disableFeature(flagName) {
  if (!(flagName in FEATURE_FLAGS)) {
    console.error(`❌ Unknown feature flag: ${flagName}`);
    return;
  }

  FEATURE_FLAGS[flagName] = false;

  if (FEATURE_FLAGS.DEBUG_MODE) {
    console.log(`❌ Feature disabled: ${flagName}`);
  }
}

/**
 * Get all feature flags and their status
 *
 * @returns {Object} - All feature flags
 */
export function getAllFlags() {
  return { ...FEATURE_FLAGS };
}

/**
 * Set multiple feature flags at once
 *
 * @param {Object} flags - Object with flag names as keys and boolean values
 */
export function setFlags(flags) {
  Object.keys(flags).forEach(flagName => {
    if (flagName in FEATURE_FLAGS) {
      FEATURE_FLAGS[flagName] = flags[flagName];
    } else {
      console.error(`❌ Unknown feature flag: ${flagName}`);
    }
  });

  if (FEATURE_FLAGS.DEBUG_MODE) {
    console.log('🚩 Feature flags updated:', FEATURE_FLAGS);
  }
}

/**
 * Export flag names as constants for type safety
 */
export const FLAGS = {
  FIREBASE_AUTH: 'FIREBASE_AUTH',
  FIREBASE_BATTLES: 'FIREBASE_BATTLES',
  FIREBASE_CHALLENGES: 'FIREBASE_CHALLENGES',
  REALTIME_SYNC: 'REALTIME_SYNC',
  DEBUG_MODE: 'DEBUG_MODE'
};

export default {
  FEATURE_FLAGS,
  FLAGS,
  isFeatureEnabled,
  enableFeature,
  disableFeature,
  getAllFlags,
  setFlags
};
