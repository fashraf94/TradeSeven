// api/_utils/learning/learningEnums.js
//
// Agent Learning System — L1 Foundation, Phase 2.
// Closed enums for the raw capture layer. Source of truth: L1 Foundation Build
// Spec ANNEX A5 (self-contained; reproduced from Detector Appendix §6.3).
//
// Pattern matches src/constants/visionEnums.js: named `export const NAME`
// frozen collections plus membership helpers used by validators.
//
// FAIL-CLOSED CONTRACT: any `source` / `exitReason` value outside these enums is
// EXCLUDED and logged — never silently accepted, never coerced. These arrays are
// the whole enum; there is no "unknown → default" branch anywhere downstream.

/**
 * Closed `source` enum — how a decision opportunity originated.
 * @type {readonly ['haiku','archetype','risk_manager','guardrail','gameplan_meeting']}
 */
export const RECEIPT_SOURCES = Object.freeze([
  'haiku',
  'archetype',
  'risk_manager',
  'guardrail',
  'gameplan_meeting',
]);

/**
 * Closed `exitReason` enum — why the outgoing position was exited.
 * @type {readonly string[]}
 */
export const RECEIPT_EXIT_REASONS = Object.freeze([
  'haiku_decision',
  'bust_avoidance',
  'vwap_failure',
  'stepped_trail',
  'stagnation',
  'guardrail_stopLoss',
  'guardrail_trailingStop',
  'gameplan_rotation',
]);

/**
 * D3's positive allowlist (ANNEX A5): a swap is an allowlisted *discretionary*
 * swap iff `exitReason === 'haiku_decision'` (tied 1:1 to `source === 'haiku'`
 * at agent-evaluate.js:1859). This is deliberately NOT `EMERGENCY_BYPASS_REASONS`
 * — that is a Knob-C bypass concept and omits `stagnation` and
 * `gameplan_rotation`, so it is the wrong set for this allowlist.
 * @type {readonly ['haiku_decision']}
 */
export const D3_DISCRETIONARY_EXIT_REASONS = Object.freeze(['haiku_decision']);

/** @returns {boolean} true iff `value` is a member of the closed source enum. */
export function isValidSource(value) {
  return RECEIPT_SOURCES.includes(value);
}

/** @returns {boolean} true iff `value` is a member of the closed exitReason enum. */
export function isValidExitReason(value) {
  return RECEIPT_EXIT_REASONS.includes(value);
}

/**
 * @returns {boolean} true iff this swap is an allowlisted discretionary swap for
 * D3 (exitReason === 'haiku_decision'). Fail-closed: any non-member (including
 * an out-of-enum value) returns false.
 */
export function isAllowlistedDiscretionary(exitReason) {
  return D3_DISCRETIONARY_EXIT_REASONS.includes(exitReason);
}
