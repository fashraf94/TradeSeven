// src/types/vision/visionTypes.js
// JSDoc typedefs for the Vision object.
// Source of truth: SPEC_A_VISION_REFERENCE_V1_0 §2.1-§2.3.
//
// This module exports NO runtime values (only typedefs). Enum VALUES live in
// src/constants/visionEnums.js. Transition tables live in visionTransitions.js.
//
// Phase 1 decisions baked in:
//   - FLAG A: JSDoc translation, TS reference reproduced verbatim in the header
//     comment below for documentation parity.
//   - FLAG B: Timestamps are duck-typed as "{ seconds: number, nanoseconds:
//     number, toDate?: () => Date }" so both the firebase-admin and firebase
//     client Timestamp classes satisfy the type. Validators check the duck
//     shape, not instanceof.
//   - FLAG C: `conditionSnapshot` MAY be null while state === 'unformed'; MUST
//     be non-null in any other state. The type union below reflects this; the
//     state-gated invariant is enforced in visionValidators.js.
//
// =============================================================================
// TS REFERENCE (documentation-only; authoritative source is the reference doc)
// =============================================================================
//
// interface Vision {
//   thesis: Thesis;
//   confidence: ConfidenceLevel;
//   source: VisionSource;
//   state: LifecycleState;
//   constraints: Constraint[];
//   evidenceTrail: EvidenceEntry[];
//   conflicts: Conflict[];
//   lastUserTouchAt: Timestamp;
//   conditionSnapshot: ConditionSnapshot | null;   // null iff state==='unformed'
//   nextCheckInAt: Timestamp | null;
//   transitionHistory: TransitionEntry[];
//   createdAt: Timestamp;
//   lastTransitionAt: Timestamp;
//   version: number;
// }
//
// type ConfidenceLevel = 'low' | 'medium' | 'high';
//
// type VisionSource =
//   | 'user-authored'
//   | 'agent-proposed-user-confirmed'
//   | 'agent-generated-fallback'
//   | 'carried-over-from-previous-tick';
//
// type LifecycleState =
//   | 'unformed' | 'proposed' | 'active' | 'under_debate' | 'stale' | 'retired';
//
// type TransitionCause =
//   | 'user_input' | 'scheduled_check_in' | 'directional_trigger'
//   | 'staleness_detected' | 'battle_start' | 'battle_end' | 'autopilot_fallback';
//
// interface Thesis {
//   statement: string;
//   structuredSummary: {
//     direction: 'bullish' | 'bearish' | 'neutral' | 'mixed';
//     scope: string[];
//     drivers: string[];
//   };
//   authoredBy: 'user' | 'gemma' | 'sonnet';
// }
//
// interface EvidenceEntry {
//   id: string;
//   type: 'news' | 'sector_perf' | 'macro' | 'user_intuition' | 'forge_signature' | 'price_action';
//   reference: string;
//   note: string | null;
//   addedAt: Timestamp;
//   addedBy: 'user' | 'gemma' | 'sonnet';
// }
//
// interface ConditionSnapshot {
//   vix: number;
//   pointDifferential: number;
//   marketPhase: 'pre' | 'open' | 'mid' | 'late' | 'final_hour' | 'close' | 'post';
//   takenAt: Timestamp;
// }
//
// interface TransitionEntry {
//   fromState: LifecycleState;
//   toState: LifecycleState;
//   timestamp: Timestamp;
//   actor: 'gemma' | 'haiku' | 'sonnet' | 'risk_manager' | 'layer1' | 'trigger_gate' | 'cron' | 'battle_creation';
//   cause: TransitionCause;
// }
//
// interface Constraint {
//   id: string;
//   type: 'user_carveout' | 'category_b_forge' | 'system_injected';
//   source: string;
//   payload: UserCarveoutPayload | CategoryBPayload | SystemInjectedPayload;
//   createdAt: Timestamp;
//   expiresAt: Timestamp | null;
//   lifecycleBinding: 'vision' | 'battle' | 'event' | 'explicit';
//   createdBy: 'user' | 'gemma' | 'risk_manager' | 'forge';
// }
//
// interface UserCarveoutPayload {
//   statement: string;
//   tags: { tickers: string[]; sectors: string[]; behaviors: string[]; };
// }
//
// interface CategoryBPayload {
//   ruleId: string;
//   ruleSnapshot: object;
//   ruleKind: 'stop_loss' | 'position_cap' | 'sector_concentration' | 'event_exclusion' | 'other';
// }
//
// interface SystemInjectedPayload {
//   eventCause: string;
//   scope: 'position' | 'portfolio' | 'time_window';
//   target: string | null;
//   reason: string;
// }
//
// interface Conflict {
//   id: string;
//   constraintIdA: string;
//   constraintIdB: string;
//   type: 'direct_contradiction' | 'scope_overlap' | 'temporal_succession';
//   status: 'detected' | 'acknowledged' | 'resolved';
//   detectedAt: Timestamp;
//   resolvedAt: Timestamp | null;
//   resolution: {
//     winner: 'A' | 'B' | 'both' | 'neither';
//     arbiter: 'user' | 'gemma' | 'risk_manager' | 'sonnet';
//     note: string | null;
//   } | null;
// }
//
// =============================================================================

// -----------------------------------------------------------------------------
// Primitive shapes
// -----------------------------------------------------------------------------

/**
 * Firestore-compatible timestamp. Duck-typed so both the firebase (client) and
 * firebase-admin (server) Timestamp classes satisfy it. `toDate` is optional
 * because ISO-string-serialized timestamps (e.g., after JSON round-trip) lose
 * their prototype; validators only require { seconds, nanoseconds }.
 *
 * @typedef {Object} FirestoreTimestampLike
 * @property {number} seconds
 * @property {number} nanoseconds
 * @property {() => Date} [toDate]
 */

/**
 * @typedef {'low'|'medium'|'high'} VisionConfidenceLevel
 */

/**
 * @typedef {(
 *   'user-authored'
 *   | 'agent-proposed-user-confirmed'
 *   | 'agent-generated-fallback'
 *   | 'carried-over-from-previous-tick'
 * )} VisionSource
 */

/**
 * @typedef {(
 *   'unformed' | 'proposed' | 'active' | 'under_debate' | 'stale' | 'retired'
 * )} VisionLifecycleState
 */

/**
 * @typedef {(
 *   'user_input'
 *   | 'scheduled_check_in'
 *   | 'directional_trigger'
 *   | 'staleness_detected'
 *   | 'battle_start'
 *   | 'battle_end'
 *   | 'autopilot_fallback'
 * )} VisionTransitionCause
 */

/**
 * @typedef {(
 *   'gemma' | 'haiku' | 'sonnet' | 'risk_manager' | 'layer1' | 'trigger_gate'
 *   | 'cron' | 'battle_creation'
 * )} VisionTransitionActor
 */

// -----------------------------------------------------------------------------
// Thesis
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} VisionThesisStructuredSummary
 * @property {'bullish'|'bearish'|'neutral'|'mixed'} direction
 * @property {string[]} scope    Tickers, sectors, themes.
 * @property {string[]} drivers  Named catalysts.
 */

/**
 * @typedef {Object} VisionThesis
 * @property {string} statement                         User-facing prose.
 * @property {VisionThesisStructuredSummary} structuredSummary
 * @property {'user'|'gemma'|'sonnet'} authoredBy
 */

// -----------------------------------------------------------------------------
// EvidenceEntry
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} VisionEvidenceEntry
 * @property {string} id
 * @property {'news'|'sector_perf'|'macro'|'user_intuition'|'forge_signature'|'price_action'} type
 * @property {string} reference
 * @property {string|null} note
 * @property {FirestoreTimestampLike} addedAt
 * @property {'user'|'gemma'|'sonnet'} addedBy
 */

// -----------------------------------------------------------------------------
// ConditionSnapshot
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} VisionConditionSnapshot
 * @property {number} vix
 * @property {number} pointDifferential
 * @property {'pre'|'open'|'mid'|'late'|'final_hour'|'close'|'post'} marketPhase
 * @property {FirestoreTimestampLike} takenAt
 */

// -----------------------------------------------------------------------------
// TransitionEntry
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} VisionTransitionEntry
 * @property {VisionLifecycleState} fromState
 * @property {VisionLifecycleState} toState
 * @property {FirestoreTimestampLike} timestamp
 * @property {VisionTransitionActor} actor
 * @property {VisionTransitionCause} cause
 */

// -----------------------------------------------------------------------------
// Constraint payloads (discriminated on Constraint.type)
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} VisionUserCarveoutPayload
 * @property {string} statement
 * @property {{ tickers: string[], sectors: string[], behaviors: string[] }} tags
 */

/**
 * @typedef {Object} VisionCategoryBPayload
 * @property {string} ruleId
 * @property {Record<string, unknown>} ruleSnapshot  Immutable parameter snapshot at activation.
 * @property {'stop_loss'|'position_cap'|'sector_concentration'|'event_exclusion'|'other'} ruleKind
 */

/**
 * @typedef {Object} VisionSystemInjectedPayload
 * @property {string} eventCause
 * @property {'position'|'portfolio'|'time_window'} scope
 * @property {string|null} target
 * @property {string} reason
 */

// -----------------------------------------------------------------------------
// Constraint
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} VisionConstraint
 * @property {string} id
 * @property {'user_carveout'|'category_b_forge'|'system_injected'} type
 * @property {string} source
 * @property {VisionUserCarveoutPayload|VisionCategoryBPayload|VisionSystemInjectedPayload} payload
 * @property {FirestoreTimestampLike} createdAt
 * @property {FirestoreTimestampLike|null} expiresAt
 * @property {'vision'|'battle'|'event'|'explicit'} lifecycleBinding
 * @property {'user'|'gemma'|'risk_manager'|'forge'} createdBy
 */

// -----------------------------------------------------------------------------
// Conflict
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} VisionConflictResolution
 * @property {'A'|'B'|'both'|'neither'} winner
 * @property {'user'|'gemma'|'risk_manager'|'sonnet'} arbiter
 * @property {string|null} note
 */

/**
 * @typedef {Object} VisionConflict
 * @property {string} id
 * @property {string} constraintIdA
 * @property {string} constraintIdB
 * @property {'direct_contradiction'|'scope_overlap'|'temporal_succession'} type
 * @property {'detected'|'acknowledged'|'resolved'} status
 * @property {FirestoreTimestampLike} detectedAt
 * @property {FirestoreTimestampLike|null} resolvedAt
 * @property {VisionConflictResolution|null} resolution
 */

// -----------------------------------------------------------------------------
// Vision (top-level)
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} Vision
 * @property {VisionThesis} thesis
 * @property {VisionConfidenceLevel} confidence
 * @property {VisionSource} source
 * @property {VisionLifecycleState} state
 * @property {VisionConstraint[]} constraints
 * @property {VisionEvidenceEntry[]} evidenceTrail
 * @property {VisionConflict[]} conflicts
 * @property {FirestoreTimestampLike} lastUserTouchAt
 * @property {VisionConditionSnapshot|null} conditionSnapshot
 *   FLAG C invariant: null ONLY while state === 'unformed'; non-null otherwise.
 * @property {FirestoreTimestampLike|null} nextCheckInAt
 * @property {VisionTransitionEntry[]} transitionHistory
 * @property {FirestoreTimestampLike} createdAt
 * @property {FirestoreTimestampLike} lastTransitionAt
 * @property {number} version
 */

// No runtime exports; JSDoc-only module. An empty named export keeps bundlers
// and test runners happy with ESM module shape while making the fact that this
// file carries only type information explicit.
export const VISION_TYPES_MODULE = /** @type {const} */ (Object.freeze({
  __jsdocOnly: true,
}));
