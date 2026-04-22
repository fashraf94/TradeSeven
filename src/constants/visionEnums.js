// src/constants/visionEnums.js
// Enum-like constant sets for the Vision object.
// Source of truth: SPEC_A_VISION_REFERENCE_V1_0 §2.2.
//
// Pattern matches the rest of src/constants/: named `export const NAME = { ... }`
// frozen objects plus a helper function where useful. The arrays below mirror the
// reference doc's union types so they can be used for runtime membership checks
// in validators without reimporting individual typedefs.

/** @type {readonly ['low','medium','high']} */
export const VISION_CONFIDENCE_LEVELS = Object.freeze(['low', 'medium', 'high']);

/** @type {readonly ['user-authored','agent-proposed-user-confirmed','agent-generated-fallback','carried-over-from-previous-tick']} */
export const VISION_SOURCES = Object.freeze([
  'user-authored',
  'agent-proposed-user-confirmed',
  'agent-generated-fallback',
  'carried-over-from-previous-tick',
]);

/** @type {readonly ['unformed','proposed','active','under_debate','stale','retired']} */
export const VISION_LIFECYCLE_STATES = Object.freeze([
  'unformed',
  'proposed',
  'active',
  'under_debate',
  'stale',
  'retired',
]);

/** @type {readonly ['user_input','scheduled_check_in','directional_trigger','staleness_detected','battle_start','battle_end','autopilot_fallback']} */
export const VISION_TRANSITION_CAUSES = Object.freeze([
  'user_input',
  'scheduled_check_in',
  'directional_trigger',
  'staleness_detected',
  'battle_start',
  'battle_end',
  'autopilot_fallback',
]);

/** @type {readonly ['gemma','haiku','sonnet','risk_manager','layer1','trigger_gate','cron','battle_creation']} */
export const VISION_TRANSITION_ACTORS = Object.freeze([
  'gemma',
  'haiku',
  'sonnet',
  'risk_manager',
  'layer1',
  'trigger_gate',
  'cron',
  'battle_creation',
]);

/** @type {readonly ['user_carveout','category_b_forge','system_injected']} */
export const VISION_CONSTRAINT_TYPES = Object.freeze([
  'user_carveout',
  'category_b_forge',
  'system_injected',
]);

/** @type {readonly ['vision','battle','event','explicit']} */
export const VISION_LIFECYCLE_BINDINGS = Object.freeze([
  'vision',
  'battle',
  'event',
  'explicit',
]);

/** @type {readonly ['direct_contradiction','scope_overlap','temporal_succession']} */
export const VISION_CONFLICT_TYPES = Object.freeze([
  'direct_contradiction',
  'scope_overlap',
  'temporal_succession',
]);

/** @type {readonly ['detected','acknowledged','resolved']} */
export const VISION_CONFLICT_STATUSES = Object.freeze([
  'detected',
  'acknowledged',
  'resolved',
]);

// Thesis.structuredSummary.direction
export const VISION_THESIS_DIRECTIONS = Object.freeze([
  'bullish',
  'bearish',
  'neutral',
  'mixed',
]);

// Thesis.authoredBy
export const VISION_THESIS_AUTHORS = Object.freeze(['user', 'gemma', 'sonnet']);

// EvidenceEntry.type
export const VISION_EVIDENCE_TYPES = Object.freeze([
  'news',
  'sector_perf',
  'macro',
  'user_intuition',
  'forge_signature',
  'price_action',
]);

// EvidenceEntry.addedBy
export const VISION_EVIDENCE_AUTHORS = Object.freeze(['user', 'gemma', 'sonnet']);

// ConditionSnapshot.marketPhase
export const VISION_MARKET_PHASES = Object.freeze([
  'pre',
  'open',
  'mid',
  'late',
  'final_hour',
  'close',
  'post',
]);

// Constraint.createdBy
export const VISION_CONSTRAINT_AUTHORS = Object.freeze([
  'user',
  'gemma',
  'risk_manager',
  'forge',
]);

// CategoryBPayload.ruleKind
export const VISION_CATEGORY_B_RULE_KINDS = Object.freeze([
  'stop_loss',
  'position_cap',
  'sector_concentration',
  'event_exclusion',
  'other',
]);

// SystemInjectedPayload.scope
export const VISION_SYSTEM_INJECTED_SCOPES = Object.freeze([
  'position',
  'portfolio',
  'time_window',
]);

// Conflict.resolution.winner
export const VISION_CONFLICT_WINNERS = Object.freeze(['A', 'B', 'both', 'neither']);

// Conflict.resolution.arbiter
export const VISION_CONFLICT_ARBITERS = Object.freeze([
  'user',
  'gemma',
  'risk_manager',
  'sonnet',
]);

// ============================================================================
// Canonical confidence -> float mapping
// ----------------------------------------------------------------------------
// Not stored on the Vision object. Applied by consumers that need numerical
// weighting (Haiku prompt-assembly, Sonnet grading). Values tunable here
// without a schema change.
// ============================================================================

/** @type {Readonly<Record<'low'|'medium'|'high', number>>} */
export const CONFIDENCE_FLOAT_MAP = Object.freeze({
  low: 0.3,
  medium: 0.6,
  high: 0.9,
});

/**
 * Map a confidence enum to its canonical float weight.
 *
 * @param {'low'|'medium'|'high'} level
 * @returns {number}
 */
export function confidenceToFloat(level) {
  const value = CONFIDENCE_FLOAT_MAP[level];
  if (value === undefined) {
    throw new Error(`confidenceToFloat: unknown confidence level "${level}"`);
  }
  return value;
}
