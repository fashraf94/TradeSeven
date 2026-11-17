// src/components/Research/Sheet/setupReadContract.js
//
// The chart's evidence — THE READ'S CONTRACT (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md
// RR-5, RR-6). What GET /api/research/setup-read answers, as closed lists: the three
// answers, the body's keys, and the projection's exact field list. The server's
// projection (api/_utils/setupRead/projection.js) builds exactly these keys and its
// tests pin them here; the client function (setupRead.js) and the Chart view's read
// in the next build read them. DATA ONLY: no imports, no logic.

/** The three answers, never merged (RR-5). */
export const SETUP_READ_ANSWERS = Object.freeze(['measured', 'refused', 'absent']);

/** The 200 body's keys, in order. `read` is the projection, or null when the answer is `absent`. */
export const SETUP_READ_BODY_KEYS = Object.freeze(['answer', 'symbol', 'servedAt', 'sessionsTried', 'read']);

/**
 * The projection's keys, in order (RR-6): copied from the stored record, never derived.
 *   session, asOf, capturedAt, behind                 when, and whether it is the earlier session
 *   ruleSet { setupVersion, thresholdsHash, semanticsId } the rule set that measured it
 *   basis                                             the record's own basis ('raw')
 *   verdict, reason, pattern, regime                  the verdict and its reason
 *   patternsSatisfied, patterns { breakout, pullback_resume }  each pattern's state
 *   checks [{ id, lhs, op, rhs, result }]             every check, both sides
 *   facts { the nine }, missing                       the facts' values, and the null ones
 *   swingHigh { value, date }, swingLow { value, date }
 *   pullbackLows [{ date, low }]                      the three lows the touch check compares
 *   adjustmentMetadata ('present' | 'absent')         whether the split check could run (a reading, spec §4.3)
 */
export const SETUP_READ_FIELDS = Object.freeze([
  'session', 'asOf', 'capturedAt', 'behind',
  'ruleSet', 'basis',
  'verdict', 'reason', 'pattern', 'regime',
  'patternsSatisfied', 'patterns',
  'checks', 'facts', 'missing',
  'swingHigh', 'swingLow', 'pullbackLows',
  'adjustmentMetadata',
]);

export const SETUP_READ_RULE_SET_FIELDS = Object.freeze(['setupVersion', 'thresholdsHash', 'semanticsId']);
export const SETUP_READ_CHECK_FIELDS = Object.freeze(['id', 'lhs', 'op', 'rhs', 'result']);
/** The evaluator's nine facts (tfSetupV1.js FACT_NAMES; pinned equal). */
export const SETUP_READ_FACTS = Object.freeze(['C', 'SMA_fast', 'SMA_slow', 'SMA_slow_5ago', 'swingHigh', 'swingLow', 'ATR', 'V', 'V_avg']);
/** The evaluator's patterns in priority order (tfSetupV1.js PATTERN_ORDER; pinned equal). */
export const SETUP_READ_PATTERNS = Object.freeze(['breakout', 'pullback_resume']);
