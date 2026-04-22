// src/types/vision/visionTransitions.js
// Valid Vision state-machine transitions.
// Source of truth: SPEC_A_VISION_REFERENCE_V1_0 §2.5.
//
// `VALID_TRANSITIONS` is a flat array of edges. `from: null` denotes the
// initial battle-creation transition (no prior state). Every call to
// `isValidTransition` must match at least one edge on all four dimensions
// (from, to, cause, actor) for the transition to be allowed.

/**
 * @typedef {import('./visionTypes.js').VisionLifecycleState} VisionLifecycleState
 * @typedef {import('./visionTypes.js').VisionTransitionCause} VisionTransitionCause
 * @typedef {import('./visionTypes.js').VisionTransitionActor} VisionTransitionActor
 */

/**
 * @typedef {Object} ValidTransition
 * @property {VisionLifecycleState|null} from   null = battle creation (no prior state).
 * @property {VisionLifecycleState} to
 * @property {readonly VisionTransitionCause[]} allowedCauses
 * @property {readonly VisionTransitionActor[]} allowedActors
 */

/** @type {readonly ValidTransition[]} */
export const VALID_TRANSITIONS = Object.freeze([
  // Initial ----------------------------------------------------------------
  {
    from: null,
    to: 'unformed',
    allowedCauses: Object.freeze(['battle_start']),
    allowedActors: Object.freeze(['battle_creation', 'layer1']),
  },

  // From unformed ----------------------------------------------------------
  {
    from: 'unformed',
    to: 'proposed',
    allowedCauses: Object.freeze(['user_input', 'directional_trigger']),
    allowedActors: Object.freeze(['gemma']),
  },
  {
    from: 'unformed',
    to: 'active',
    allowedCauses: Object.freeze(['autopilot_fallback']),
    allowedActors: Object.freeze(['gemma', 'cron']),
  },

  // From proposed ----------------------------------------------------------
  {
    from: 'proposed',
    to: 'active',
    allowedCauses: Object.freeze(['user_input']),
    allowedActors: Object.freeze(['gemma']),
  },
  {
    from: 'proposed',
    to: 'unformed',
    allowedCauses: Object.freeze(['user_input']),
    allowedActors: Object.freeze(['gemma']),
  },

  // From active ------------------------------------------------------------
  {
    from: 'active',
    to: 'under_debate',
    allowedCauses: Object.freeze(['directional_trigger']),
    allowedActors: Object.freeze(['gemma']),
  },
  {
    from: 'active',
    to: 'stale',
    allowedCauses: Object.freeze(['staleness_detected', 'scheduled_check_in']),
    allowedActors: Object.freeze(['gemma', 'cron']),
  },

  // From under_debate ------------------------------------------------------
  {
    from: 'under_debate',
    to: 'active',
    allowedCauses: Object.freeze(['user_input']),
    allowedActors: Object.freeze(['gemma']),
  },
  {
    from: 'under_debate',
    to: 'unformed',
    allowedCauses: Object.freeze(['user_input']),
    allowedActors: Object.freeze(['gemma']),
  },

  // From stale -------------------------------------------------------------
  {
    from: 'stale',
    to: 'active',
    allowedCauses: Object.freeze(['user_input']),
    allowedActors: Object.freeze(['gemma']),
  },
  {
    from: 'stale',
    to: 'unformed',
    allowedCauses: Object.freeze(['user_input']),
    allowedActors: Object.freeze(['gemma']),
  },

  // To retired (from any non-retired state) --------------------------------
  {
    from: 'unformed',
    to: 'retired',
    allowedCauses: Object.freeze(['battle_end']),
    allowedActors: Object.freeze(['sonnet']),
  },
  {
    from: 'proposed',
    to: 'retired',
    allowedCauses: Object.freeze(['battle_end']),
    allowedActors: Object.freeze(['sonnet']),
  },
  {
    from: 'active',
    to: 'retired',
    allowedCauses: Object.freeze(['battle_end']),
    allowedActors: Object.freeze(['sonnet']),
  },
  {
    from: 'under_debate',
    to: 'retired',
    allowedCauses: Object.freeze(['battle_end']),
    allowedActors: Object.freeze(['sonnet']),
  },
  {
    from: 'stale',
    to: 'retired',
    allowedCauses: Object.freeze(['battle_end']),
    allowedActors: Object.freeze(['sonnet']),
  },
]);

/**
 * Check whether a (from, to, cause, actor) tuple is a valid edge.
 *
 * @param {VisionLifecycleState|null} from
 * @param {VisionLifecycleState} to
 * @param {VisionTransitionCause} cause
 * @param {VisionTransitionActor} actor
 * @returns {boolean}
 */
export function isValidTransition(from, to, cause, actor) {
  return VALID_TRANSITIONS.some(
    (t) =>
      t.from === from &&
      t.to === to &&
      t.allowedCauses.includes(cause) &&
      t.allowedActors.includes(actor),
  );
}
