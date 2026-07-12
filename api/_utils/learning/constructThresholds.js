// api/_utils/learning/constructThresholds.js
//
// Agent Learning System — L1 Foundation, Phase 3.
// P-CONSTRUCT-THRESHOLDS — the D1/D2 detector marker thresholds.
// Source of truth: L1 Foundation Build Spec ANNEX A1 (self-contained;
// Calibration Manifest V5.0 §10). FROZEN.
//
// These come from MARKET SEMANTICS, not from data, and are NOT affected by any
// open contract. They are safe to build now.
//
// Field anchors (buildTechnicalSnapshot.js, VERIFIED at this HEAD):
//   volatility.bbPercentB              :58
//   levels.distanceToResistancePct     :90   (spec cited :89 — 1-line drift; bound by field name)
//   smaStack.distTo52wkHigh            :78
//   volume.ratio                       :67
//   momentum.upDayVolRatio             :54
//   momentum.macdAboveSignal           :49
//   momentum.macdFreshBullishCross     :50
//
// BOUNDARY OPERATORS ARE AS WRITTEN: exact equality satisfies the inclusive
// operator (≥, ≤). Comparisons use FULL STORED PRECISION — no rounding before
// any comparison (rounding is display-only, ANNEX A6).

// ── D1 markers ──────────────────────────────────────────────────────────────
// Each marker fires when the field crosses its threshold in the stated direction.
export const D1_THRESHOLDS = Object.freeze({
  bbPercentB: Object.freeze({
    extendedGte: 0.95, // pB ≥ 0.95  → extended marker
    severeGte: 1.0, //    pB ≥ 1.00  → SEVERE-extension marker (alone forces EXTENDED)
    roomLte: 0.85, //     pB ≤ 0.85  → room marker
  }),
  distanceToResistancePct: Object.freeze({
    extendedLte: 1.0, //  dR ≤ 1.0%  → extended marker
    roomGte: 3.0, //      dR ≥ 3.0%  → room marker
  }),
  distTo52wkHigh: Object.freeze({
    extendedLte: 0.5, //  d52 ≤ 0.5% → extended marker
    roomGte: 2.0, //      d52 ≥ 2.0% → room marker
  }),
});

// ── D2 votes ────────────────────────────────────────────────────────────────
// Volume family members: volume.ratio ≥ 1.5, momentum.upDayVolRatio ≥ 1.2.
// Momentum family member: momentum.macdAboveSignal (boolean, no threshold).
// macdFreshBullishCross is a STRENGTH TIER on a passing momentum vote — NEVER an
// independent vote (it carries no threshold and never resolves a family).
export const D2_THRESHOLDS = Object.freeze({
  volumeRatioGte: 1.5, //     volume.ratio ≥ 1.5        → volume vote passes
  upDayVolRatioGte: 1.2, //   momentum.upDayVolRatio ≥ 1.2 → volume vote passes
  // macdAboveSignal: boolean, no threshold → momentum vote.
  // macdFreshBullishCross: boolean strength tier only.
});
