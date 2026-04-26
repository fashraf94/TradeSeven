// api/_utils/visionRuntime.js
// Runtime helpers for consuming Vision objects in api/ code paths.
// Pure functions only; no Firestore I/O.
//
// Spec A Phase 2a — Vision Consumers.
// See SPEC_A_VISION_REFERENCE_V1.md §2.6 + Decision 5 (constraint expiry).

/**
 * Filter constraints to those still active at a given moment.
 *
 * Implements the union-of-death-conditions rule: a constraint is alive iff
 * (no time-expiry OR time-expiry not yet reached) AND (lifecycleBinding is
 * still alive given the current Vision state).
 *
 * @param {import('../../src/types/vision/visionTypes.js').VisionConstraint[]} constraints
 * @param {string} visionState - LifecycleState (one of 'unformed' | 'proposed' | 'active' | 'under_debate' | 'stale' | 'retired')
 * @param {number} nowMs - Date.now()-style epoch milliseconds
 * @returns {import('../../src/types/vision/visionTypes.js').VisionConstraint[]}
 */
export function filterActiveConstraints(constraints, visionState, nowMs) {
  if (!Array.isArray(constraints) || constraints.length === 0) return [];

  return constraints.filter((c) => {
    // Time-based expiry check
    if (c.expiresAt) {
      const expiryMs = typeof c.expiresAt.toMillis === 'function'
        ? c.expiresAt.toMillis()
        : (typeof c.expiresAt.seconds === 'number' ? c.expiresAt.seconds * 1000 : null);
      if (expiryMs !== null && expiryMs <= nowMs) return false;
    }

    // Lifecycle-binding expiry check
    switch (c.lifecycleBinding) {
      case 'vision':
        // Dies when Vision retires
        if (visionState === 'retired') return false;
        return true;
      case 'battle':
        // If we're running, the battle is still alive
        return true;
      case 'event':
        // Event-bound constraints are manually cleaned by their event handler.
        // If still in the array, treat as active.
        return true;
      case 'explicit':
        // Never auto-expires; only removed by explicit operation
        return true;
      default:
        // Unknown lifecycleBinding — fail closed (treat as inactive) to avoid
        // surprise behavior from corrupted data.
        return false;
    }
  });
}
