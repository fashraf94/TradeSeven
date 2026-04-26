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
  // Battle-end retirement transitions accept two actors:
  //   - 'cron': the scheduled task in api/cron/agent-evaluate.js writes this
  //     transition synchronously inside completeBattle(). This is the dominant
  //     case — the cron retires Visions on battle expiry.
  //   - 'sonnet': reserved for future Sonnet-authored retirement paths
  //     (e.g., user-triggered early-end flows where Sonnet authors the
  //     retirement decision rather than just consuming a retired Vision).
  // The two actors distinguish "infrastructure-driven retirement" from
  // "AI-reasoning-driven retirement" in the shadow log, which matters for
  // training data slicing and ops debugging.
  {
    from: 'unformed',
    to: 'retired',
    allowedCauses: Object.freeze(['battle_end']),
    allowedActors: Object.freeze(['sonnet', 'cron']),
  },
  {
    from: 'proposed',
    to: 'retired',
    allowedCauses: Object.freeze(['battle_end']),
    allowedActors: Object.freeze(['sonnet', 'cron']),
  },
  {
    from: 'active',
    to: 'retired',
    allowedCauses: Object.freeze(['battle_end']),
    allowedActors: Object.freeze(['sonnet', 'cron']),
  },
  {
    from: 'under_debate',
    to: 'retired',
    allowedCauses: Object.freeze(['battle_end']),
    allowedActors: Object.freeze(['sonnet', 'cron']),
  },
  {
    from: 'stale',
    to: 'retired',
    allowedCauses: Object.freeze(['battle_end']),
    allowedActors: Object.freeze(['sonnet', 'cron']),
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
