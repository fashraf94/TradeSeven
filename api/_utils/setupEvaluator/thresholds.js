// api/_utils/setupEvaluator/thresholds.js
//
// Measured Trend Evidence, slice 1 (P3) — the frozen `tf-setup-v1` thresholds
// and the rule-set identity every evaluator record carries.
//
// The numbers are the founder's blessing sheet of 24 Sep 2026
// (docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md §8), slot for slot. They
// are never tuned to an example. Changing any number or pattern mints a new
// SETUP_VERSION per the definition §7; this file is where that happens, by a
// founder PR, never in place.
//
// Three identities, each naming something the others do not:
//   SETUP_VERSION    — the structure and the blessed numbers (definition §7).
//   THRESHOLDS_HASH  — sha256 of the canonical JSON of TF_SETUP_V1_THRESHOLDS in
//                      the key order declared below, first 12 hex characters.
//                      A changed value or a changed key order changes it.
//   SEMANTICS_ID     — what the hash cannot see: the calculation and meaning
//                      choices recorded in SEMANTICS_NOTES (clarification C1,
//                      the raw basis, the windows, the equality boundaries, the
//                      volume policy, the rounding, the calendar rule, the split
//                      heuristic). Any change of calculation or meaning bumps it
//                      (sem-2, …) and appends an entry to the golden baseline
//                      (__fixtures__/goldenBaseline.json). A semantics bump never
//                      substitutes for a new SETUP_VERSION.
//
// Pure module: node:crypto only. No clock, no I/O, no product imports.

import { createHash } from 'node:crypto';

/** The blessed slots S1–S10, in the key order the hash is computed over. */
export const TF_SETUP_V1_THRESHOLDS = Object.freeze({
  smaFastLength: 20,            // S1
  smaSlowLength: 50,            // S2
  swingLookbackBars: 20,        // S3
  atrLength: 14,                // S4
  volumeAverageLength: 20,      // S5
  slowSmaRisingWindowBars: 5,   // S6
  breakoutVolumeMultiple: 1.5,  // S7
  pullbackTouchWindowBars: 3,   // S8
  pullbackVolumeRule: 'none',   // S9
  extensionGuardAtrMultiple: 2.0, // S10
});

export const SETUP_VERSION = 'tf-setup-v1';

/**
 * sha256 of the canonical JSON (JSON.stringify in the object's own key order,
 * no whitespace), first 12 hex characters. Exported so a test can prove that a
 * changed value or key order changes the hash, and that THRESHOLDS_HASH is this
 * function applied to the frozen object, never a pasted constant.
 */
export function hashThresholds(thresholds) {
  return createHash('sha256').update(JSON.stringify(thresholds), 'utf8').digest('hex').slice(0, 12);
}

export const THRESHOLDS_HASH = hashThresholds(TF_SETUP_V1_THRESHOLDS);

/**
 * The initial interpretation of the definition, recorded 28 Oct 2026 with the
 * founder's rulings FD-P3-1 (option (a), pattern-scoped) and FD-P3-2 (raw).
 */
export const SEMANTICS_ID = 'tf-setup-v1/sem-1';

/** What THRESHOLDS_HASH does not identify. Frozen strings; a test asserts their presence. */
export const SEMANTICS_NOTES = Object.freeze([
  'C1 (FD-P3-1 option (a), 28 Oct 2026): missing facts are pattern-scoped. A missing fact makes unknown the conditions that consume it; valid needs a fully supported pattern, the uptrend regime and a completed extension check; invalid(regime) needs only the regime facts; invalid(no_setup) needs every pattern fully evaluable and failed; otherwise unknown, listing the missing facts. A missing breakout volume never invalidates a supported pullback.',
  'Pattern assessment: satisfied when every check of the pattern is true; failed only when every check is evaluable and at least one is false; untestable when any check is unknown.',
  'Raw basis (FD-P3-2): every fact is computed on the raw (unadjusted) close, high, low and volume; the adjusted close is used only by the split heuristic.',
  'Bar order: newest first; bar 0 is the last completed session (asOf).',
  'Windows (bar indexes, newest first): SMA_fast bars 0..19; SMA_slow bars 0..49; SMA_slow_5ago bars 5..54; swingHigh and swingLow bars 1..20 (bar 0 excluded); ATR the 14 true ranges of bars 0..13 against their prior closes (bars 0..14 read); V bar 0; V_avg bars 1..20; pullback touch bars 0..2. MIN_COMPLETED_BARS = 55 is the smallest count that fills every window.',
  'Equality boundaries: regime_stack C > SMA_fast > SMA_slow (strict); slow_rising SMA_slow > SMA_slow_5ago (strict); breakout_close C >= swingHigh; breakout_volume V >= 1.5 x V_avg; pullback_touch min(low[0..2]) <= SMA_fast; pullback_close C > SMA_fast; extension C <= SMA_fast + 2.0 x ATR. The downtrend mirrors are strict <.',
  'Volume policy: a volume is usable only when it is a finite number greater than zero; null, zero, negative and non-finite values are unusable with a recorded reason. V is bar 0 when usable, else null. V_avg is the arithmetic mean of bars 1..20 only when all 20 are usable, else null with the unusable dates listed; no reduced-sample mean (the platform volume profile 10-of-20 rule is not adopted).',
  'Rounding: SMA and ATR values are the 4-decimal results of calculateSMA and calculateATR (api/_utils/technicalCalculations.js); swing extremes, volumes and the close are unrounded inputs.',
  'Calendar-expected session: the adapter computes the expected completed session from the calendar before reading rows (asOf must be a trading day in the maintained years and not in the future; today before the close means the previous session); rows after it are dropped and the newest remaining row must be that session, never an older fallback.',
  'Split heuristic and provenance: with adjustment metadata present on every window row, a day-over-day change above 10% in adjustedClose / close is basis_discontinuity; without it the check is not_available. A ratio of 1 proves nothing and presence is never inferred.',
  'Regime: uptrend when regime_stack and slow_rising are both true; downtrend when both mirrors are true; otherwise no_trend; unknown when any regime fact is null.',
  'Swing extremes on a tie: the most recent bar (the lowest index) supplies the recorded date.',
  'Holding: the chart leg shares MIN_COMPLETED_BARS — below it every holding check is unknown; the anchor swing low is a price, so null, non-finite or non-positive reads absent and structure_break is unknown; holding records carry no pattern assessment.',
  'Split heuristic threshold: symmetric — 1 − min(ratioAfter, ratioBefore) / max(ratioAfter, ratioBefore) > 0.10, so a step above 10% trips in either direction and a step of 10% or less never does; adjustment metadata is present only when every window adjustedClose is finite and greater than zero; a window row dated on a non-session is refused.',
]);

/** The smallest bar count that fills every window above (SMA_slow_5ago reads bars 5..54). */
export const MIN_COMPLETED_BARS = 55;

/** The rule-set identity every entry and holding record carries. */
export function describeRuleSet() {
  return Object.freeze({ setupVersion: SETUP_VERSION, thresholdsHash: THRESHOLDS_HASH, semanticsId: SEMANTICS_ID });
}
