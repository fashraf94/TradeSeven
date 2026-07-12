// api/_utils/learning/detectorClassifiers.js
//
// Agent Learning System — L1 Foundation, Phase 3.
// PURE classification functions for detectors D1, D2, and D3.
//
// SCOPE LINE (binding): classification is IN; everything downstream of
// classification is OUT. Each function here takes a snapshot / raw inputs and
// returns a CLASS LABEL. None of them takes class labels and returns a number.
// No estimator, no aggregation, no MPE, no regret, no bootstrap, no narration.
//
// Sources of truth (self-contained, L1 Foundation Build Spec):
//   D1 truth table            ANNEX A2
//   D2 three-state families   ANNEX A3
//   D3 predicate              ANNEX A4
//   thresholds                ANNEX A1 (constructThresholds.js)
//   numeric fail-closed rule  ANNEX A6 (NaN/±∞ → UNSCORABLE, never coerced to 0)
//
// Comparisons use FULL STORED PRECISION — no rounding before any comparison.

import { D1_THRESHOLDS, D2_THRESHOLDS } from './constructThresholds.js';
import { isAllowlistedDiscretionary } from './learningEnums.js';

// ── D1 class labels ─────────────────────────────────────────────────────────
export const D1_CLASSES = Object.freeze({
  EXTENDED: 'EXTENDED',
  ROOM: 'ROOM',
  INDETERMINATE: 'INDETERMINATE',
  UNSCORABLE: 'UNSCORABLE',
});

// ── D2 class labels ─────────────────────────────────────────────────────────
export const D2_CLASSES = Object.freeze({
  CONFIRMED: 'CONFIRMED',
  UNCONFIRMED: 'UNCONFIRMED',
  INDETERMINATE: 'INDETERMINATE',
  UNSCORABLE: 'UNSCORABLE',
});

export const D2_FAMILY_STATES = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  UNKNOWN: 'UNKNOWN',
});

// ── D3 counting scope (ANNEX A4 — injected; default is same-agent, same-battle) ─
export const D3_COUNTING_SCOPES = Object.freeze({
  SAME_AGENT_SAME_BATTLE: 'same_agent_same_battle', // DEFAULT
  SAME_AGENT_GLOBAL: 'same_agent_global', // per-agent across parallel battles (open contract, Fable B6)
});

// A sentinel distinguishing a genuinely-missing input (null → "missing data",
// which D2's three-state model reasons about) from a CORRUPT input (NaN/±∞/wrong
// type → fail-closed UNSCORABLE, ANNEX A6). Never coerce corrupt to 0.
const CORRUPT = Symbol('corrupt');

/**
 * Normalize a numeric predicate input.
 * @returns {number|null|typeof CORRUPT} finite number, null (missing), or CORRUPT.
 */
function numericInput(v) {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) return CORRUPT;
  return v;
}

/**
 * Normalize a boolean predicate input.
 * @returns {boolean|null|typeof CORRUPT} boolean, null (missing), or CORRUPT.
 */
function booleanInput(v) {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'boolean') return CORRUPT;
  return v;
}

// ════════════════════════════════════════════════════════════════════════════
// D1 — extension state (ANNEX A2). Disjoint by construction; no precedence rule.
//   EXTENDED      iff (≥2 extended markers) OR (severe marker pB ≥ 1.00)
//   ROOM          iff (≥2 room markers) AND (zero extended markers)
//   INDETERMINATE otherwise
//   UNSCORABLE    if any of pB, dR, d52 is null/corrupt
// ════════════════════════════════════════════════════════════════════════════
/**
 * @param {Object} inputs
 * @param {number|null} inputs.bbPercentB               volatility.bbPercentB
 * @param {number|null} inputs.distanceToResistancePct  levels.distanceToResistancePct
 * @param {number|null} inputs.distTo52wkHigh           smaStack.distTo52wkHigh
 * @returns {{class: string, extendedMarkers: number, roomMarkers: number, severe: boolean}}
 */
export function classifyD1({ bbPercentB, distanceToResistancePct, distTo52wkHigh } = {}) {
  const pB = numericInput(bbPercentB);
  const dR = numericInput(distanceToResistancePct);
  const d52 = numericInput(distTo52wkHigh);

  // Fail closed: any null (missing) or corrupt (NaN/±∞) input → UNSCORABLE.
  if (pB === null || dR === null || d52 === null || pB === CORRUPT || dR === CORRUPT || d52 === CORRUPT) {
    return { class: D1_CLASSES.UNSCORABLE, extendedMarkers: 0, roomMarkers: 0, severe: false };
  }

  const t = D1_THRESHOLDS;
  const extended = [
    pB >= t.bbPercentB.extendedGte,
    dR <= t.distanceToResistancePct.extendedLte,
    d52 <= t.distTo52wkHigh.extendedLte,
  ];
  const room = [
    pB <= t.bbPercentB.roomLte,
    dR >= t.distanceToResistancePct.roomGte,
    d52 >= t.distTo52wkHigh.roomGte,
  ];
  const extendedMarkers = extended.filter(Boolean).length;
  const roomMarkers = room.filter(Boolean).length;
  const severe = pB >= t.bbPercentB.severeGte;

  let cls;
  if (extendedMarkers >= 2 || severe) {
    cls = D1_CLASSES.EXTENDED;
  } else if (roomMarkers >= 2 && extendedMarkers === 0) {
    cls = D1_CLASSES.ROOM;
  } else {
    cls = D1_CLASSES.INDETERMINATE;
  }
  return { class: cls, extendedMarkers, roomMarkers, severe };
}

// ── D1 dR-abstain VARIANT (L1 Phase A.5 — MEASUREMENT, not an adoption) ────────
// The `distanceToResistancePct` (dR) predicate is null ~59% of the time (no
// ≥2-touch resistance strictly above price — the breakout/new-high case), which
// A2's any-null→UNSCORABLE rule routes to UNSCORABLE, starving EXTENDED. This
// variant records what a proposed rule WOULD do so Fable can adjudicate on
// evidence: a null dR ABSTAINS (contributes no marker, does not trigger
// UNSCORABLE); the ≥2-marker rule then runs over the AVAILABLE markers (pB, d52).
//
// classifyD1 above is left BYTE-FOR-BYTE UNTOUCHED — this delegates to it for
// every case except a null dR, so abstain forgives ONLY a missing dR (a corrupt
// dR still fails closed, and pB/d52 null/corrupt still → UNSCORABLE).
export const D1_DR_NULL_REASONS = Object.freeze({
  PRESENT: 'present',
  BLUE_SKY: 'blue_sky', // dR null but a support level exists → structure present, nothing overhead
  AMBIGUOUS: 'ambiguous', // dR null AND no support → insufficient-bars / detector-failed / thin structure collapse (O1/O2/O4)
});

/**
 * D1 under the dR-abstain rule. Identical to classifyD1 unless dR is null.
 * @param {Object} inputs same shape as classifyD1
 * @returns {{class: string, extendedMarkers: number, roomMarkers: number, severe: boolean}}
 */
export function classifyD1DrAbstain(inputs = {}) {
  const dR = numericInput(inputs.distanceToResistancePct);
  // dR present (finite) OR corrupt → identical to the as-specced rule; abstain
  // forgives ONLY a null (missing) dR, never a corrupt one.
  if (dR !== null) return classifyD1(inputs);

  // dR null → ABSTAIN: classify over pB and d52 only.
  const pB = numericInput(inputs.bbPercentB);
  const d52 = numericInput(inputs.distTo52wkHigh);
  if (pB === null || pB === CORRUPT || d52 === null || d52 === CORRUPT) {
    return { class: D1_CLASSES.UNSCORABLE, extendedMarkers: 0, roomMarkers: 0, severe: false };
  }
  const t = D1_THRESHOLDS;
  // 2-of-2 asymmetry: with dR abstained, EXTENDED needs BOTH pB and d52 extended.
  const extendedMarkers = [pB >= t.bbPercentB.extendedGte, d52 <= t.distTo52wkHigh.extendedLte].filter(Boolean).length;
  const roomMarkers = [pB <= t.bbPercentB.roomLte, d52 >= t.distTo52wkHigh.roomGte].filter(Boolean).length;
  const severe = pB >= t.bbPercentB.severeGte;

  let cls;
  if (extendedMarkers >= 2 || severe) cls = D1_CLASSES.EXTENDED;
  else if (roomMarkers >= 2 && extendedMarkers === 0) cls = D1_CLASSES.ROOM;
  else cls = D1_CLASSES.INDETERMINATE;
  return { class: cls, extendedMarkers, roomMarkers, severe };
}

/**
 * Classify WHY dR is null, so blue-sky (information) is not silently conflated
 * with detector-failure (missing data). The discriminator is `nearestSupport`:
 * dR null with a support level present proves swing structure exists and nothing
 * is overhead (blue sky); dR null with no support collapses origins O1/O2/O4 and
 * is irreducibly `ambiguous` (no bar-count/detector-ran flag exists today).
 * @param {{distanceToResistancePct: number|null, nearestSupport: number|null}} levels
 * @returns {'present'|'blue_sky'|'ambiguous'}
 */
export function drNullReason({ distanceToResistancePct, nearestSupport } = {}) {
  const dR = numericInput(distanceToResistancePct);
  if (dR !== null && dR !== CORRUPT) return D1_DR_NULL_REASONS.PRESENT;
  const ns = numericInput(nearestSupport);
  if (ns !== null && ns !== CORRUPT) return D1_DR_NULL_REASONS.BLUE_SKY;
  return D1_DR_NULL_REASONS.AMBIGUOUS;
}

// ════════════════════════════════════════════════════════════════════════════
// D2 — volume/momentum confirmation (ANNEX A3). Three-state families.
//   Family PASS    — any OBSERVED member passes
//   Family FAIL    — EVERY member present and none passes
//   Family UNKNOWN — missing data could change the result
// ════════════════════════════════════════════════════════════════════════════
/**
 * Resolve a family from its per-member results.
 * @param {Array<boolean|null|typeof CORRUPT>} members
 * @returns {string|typeof CORRUPT} a D2_FAMILY_STATES value, or CORRUPT.
 */
function resolveFamily(members) {
  if (members.some((m) => m === CORRUPT)) return CORRUPT; // fail closed
  if (members.some((m) => m === true)) return D2_FAMILY_STATES.PASS; // any observed pass
  if (members.some((m) => m === null)) return D2_FAMILY_STATES.UNKNOWN; // missing could flip
  return D2_FAMILY_STATES.FAIL; // all present, none pass
}

/**
 * @param {Object} inputs
 * @param {number|null} inputs.volumeRatio          volume.ratio                (family: volume)
 * @param {number|null} inputs.upDayVolRatio        momentum.upDayVolRatio      (family: volume)
 * @param {boolean|null} inputs.macdAboveSignal     momentum.macdAboveSignal    (family: momentum)
 * @param {boolean|null} [inputs.macdFreshBullishCross] STRENGTH TIER only — never a vote.
 * @param {'premarket'|'intraday'|string|null} [inputs.dataMode] source-doc write mode.
 *        Under 'intraday', volume.ratio is a NEUTRALIZED placeholder and is
 *        relabeled MISSING (see below).
 * @returns {{class: string, volume: string, momentum: string, momentumStrength: string|null}}
 */
export function classifyD2({ volumeRatio, upDayVolRatio, macdAboveSignal, macdFreshBullishCross, dataMode } = {}) {
  // BAR-BASIS FIX (L1 Phase A): under an intraday source-doc write, volume.ratio
  // is a NEUTRALIZED ~1.0 placeholder (compute-index-intelligence.js's
  // injectIntradayBar sets the synthetic index-0 bar's volume to the trailing
  // average — see barBasis.js), NOT an observed value. Reading it as observed
  // makes ~1.0 < 1.5 return the volume vote as FAIL, silently polluting the
  // UNCONFIRMED arm with entries that may have had genuine confirmation. So it is
  // MISSING, not observed and not failing. This is INPUT-LABELING ONLY — the
  // three-state resolveFamily and the truth table below are UNTOUCHED; the family
  // rule already reasons about a missing member correctly. Only volume.ratio is
  // affected; upDayVolRatio (a 20-bar ratio, 19 bars genuine) stays observed.
  const observedVolumeRatio = dataMode === 'intraday' ? null : volumeRatio;

  const vr = numericInput(observedVolumeRatio);
  const uv = numericInput(upDayVolRatio);
  const macd = booleanInput(macdAboveSignal);

  // Volume family: ratio ≥ 1.5 OR upDayVolRatio ≥ 1.2.
  const volumeMembers = [
    vr === CORRUPT ? CORRUPT : vr === null ? null : vr >= D2_THRESHOLDS.volumeRatioGte,
    uv === CORRUPT ? CORRUPT : uv === null ? null : uv >= D2_THRESHOLDS.upDayVolRatioGte,
  ];
  // Momentum family: macdAboveSignal (boolean).
  const momentumMembers = [macd];

  const volume = resolveFamily(volumeMembers);
  const momentum = resolveFamily(momentumMembers);

  if (volume === CORRUPT || momentum === CORRUPT) {
    return { class: D2_CLASSES.UNSCORABLE, volume: 'UNSCORABLE', momentum: 'UNSCORABLE', momentumStrength: null };
  }

  const F = D2_FAMILY_STATES;
  let cls;
  if (volume === F.UNKNOWN || momentum === F.UNKNOWN) {
    cls = D2_CLASSES.UNSCORABLE;
  } else if (volume === F.PASS && momentum === F.PASS) {
    cls = D2_CLASSES.CONFIRMED;
  } else if (volume === F.FAIL && momentum === F.FAIL) {
    cls = D2_CLASSES.UNCONFIRMED;
  } else {
    cls = D2_CLASSES.INDETERMINATE; // (PASS,FAIL) or (FAIL,PASS)
  }

  // macdFreshBullishCross is a STRENGTH TIER on a PASSING momentum vote — never a
  // vote. It annotates, it does not classify. Only meaningful when momentum PASSed.
  const fresh = booleanInput(macdFreshBullishCross);
  const momentumStrength =
    momentum === F.PASS && fresh === true ? 'fresh_bullish_cross' : null;

  return { class: cls, volume, momentum, momentumStrength };
}

// ════════════════════════════════════════════════════════════════════════════
// D3 — chop-AND-churn opportunity predicate (ANNEX A4). PURE classification.
//   Chop:        symbolOut per-stock regime === 'choppy' at swap time.
//   Churn-state: count prior ALLOWLISTED DISCRETIONARY swaps (exitReason ===
//                'haiku_decision') in the half-open interval (t − W, t), scoped;
//                qualifies iff count ≥ 2.
//   Ties:        swaps sharing a timestamp order by receiptSeq; only STRICTLY-
//                PRIOR receipts count.
//   Opportunity: chop AND churn-state. (A label, not a number.)
//   W:           NOT CALIBRATED — injected, REQUIRED. Never hardcode/derive.
//   Scope:       injected; default SAME_AGENT_SAME_BATTLE (open contract, Fable B6).
// ════════════════════════════════════════════════════════════════════════════
/**
 * @param {Object} args
 * @param {string} args.outgoingRegime  symbolOut per-stock regime at swap time (e.g. stockRegimes[symbolOut]).
 * @param {Object} args.decision        the swap under test: { agentId, battleId, timestamp:number(ms), receiptSeq:number }
 * @param {Array<Object>} args.priorSwaps  candidate prior swaps: { agentId, battleId, timestamp:number(ms), receiptSeq:number, exitReason }
 * @param {number} args.windowMs        W in milliseconds — REQUIRED (injected). No default.
 * @param {string} [args.countingScope] one of D3_COUNTING_SCOPES; default SAME_AGENT_SAME_BATTLE.
 * @returns {{opportunity: boolean, chop: boolean, churnState: boolean, churnCount: number, countingScope: string, windowMs: number}}
 */
export function classifyD3Predicate({
  outgoingRegime,
  decision,
  priorSwaps = [],
  windowMs,
  countingScope = D3_COUNTING_SCOPES.SAME_AGENT_SAME_BATTLE,
} = {}) {
  // W is an injected calibration input; without it the churn-state is undefined.
  // Fail closed on absent/invalid config (a programming/config error, not data).
  if (typeof windowMs !== 'number' || !Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error('classifyD3Predicate: windowMs (W) is REQUIRED and must be a positive finite number — it is injected, never hardcoded or derived.');
  }
  if (countingScope !== D3_COUNTING_SCOPES.SAME_AGENT_SAME_BATTLE && countingScope !== D3_COUNTING_SCOPES.SAME_AGENT_GLOBAL) {
    throw new Error(`classifyD3Predicate: unknown countingScope ${JSON.stringify(countingScope)}`);
  }
  if (!decision || typeof decision.timestamp !== 'number' || !Number.isFinite(decision.timestamp)) {
    throw new Error('classifyD3Predicate: decision.timestamp (ms) is required and must be finite.');
  }

  const chop = outgoingRegime === 'choppy';

  const t = decision.timestamp;
  const lowerBound = t - windowMs; // interval (t − W, t) — lower edge OPEN (excluded)
  const decSeq = typeof decision.receiptSeq === 'number' ? decision.receiptSeq : Infinity;

  const churnCount = (Array.isArray(priorSwaps) ? priorSwaps : []).reduce((count, s) => {
    if (!s || typeof s.timestamp !== 'number' || !Number.isFinite(s.timestamp)) return count;

    // Scope: same agent always; same battle unless GLOBAL.
    if (s.agentId !== decision.agentId) return count;
    if (countingScope === D3_COUNTING_SCOPES.SAME_AGENT_SAME_BATTLE && s.battleId !== decision.battleId) {
      return count;
    }

    // Allowlist: only discretionary (haiku_decision) swaps count. Fail closed on
    // any out-of-allowlist / out-of-enum value.
    if (!isAllowlistedDiscretionary(s.exitReason)) return count;

    // Lower bound OPEN at (t − W): strictly greater than.
    if (!(s.timestamp > lowerBound)) return count;

    // Strictly-prior to the decision: earlier timestamp, or equal timestamp with
    // a strictly-smaller receiptSeq (ties broken by receiptSeq).
    const sSeq = typeof s.receiptSeq === 'number' ? s.receiptSeq : -Infinity;
    const strictlyPrior = s.timestamp < t || (s.timestamp === t && sSeq < decSeq);
    if (!strictlyPrior) return count;

    return count + 1;
  }, 0);

  const churnState = churnCount >= 2;
  return {
    opportunity: chop && churnState,
    chop,
    churnState,
    churnCount,
    countingScope,
    windowMs,
  };
}
