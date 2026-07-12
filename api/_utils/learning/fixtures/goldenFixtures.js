// api/_utils/learning/fixtures/goldenFixtures.js
//
// Agent Learning System — L1 Foundation, Phase 3, Suite 1 (Golden fixtures).
// Known market examples → expected classification. Source of truth: Build Spec
// §4.1 — "Covers every D1 state ... and every D2 truth-table cell INCLUDING all
// null-combination cases (volume PASS/FAIL/UNKNOWN × momentum PASS/FAIL/UNKNOWN)."
//
// Data only. The assertions live in goldenFixtures.test.js. Thresholds are
// P-CONSTRUCT-THRESHOLDS (construct-fixed from market semantics).

import { D1_CLASSES, D2_CLASSES } from '../detectorClassifiers.js';

// ── D1: every extension state ────────────────────────────────────────────────
export const D1_GOLDEN = Object.freeze([
  {
    name: 'EXTENDED via ≥2 markers — pressed to upper band AND resistance',
    inputs: { bbPercentB: 0.97, distanceToResistancePct: 0.6, distTo52wkHigh: 4.0 },
    expected: D1_CLASSES.EXTENDED, // pB≥0.95 + dR≤1.0 = 2 extended markers
  },
  {
    name: 'EXTENDED via severe marker alone — blown through the upper band',
    inputs: { bbPercentB: 1.02, distanceToResistancePct: 5.0, distTo52wkHigh: 3.0 },
    expected: D1_CLASSES.EXTENDED, // pB≥1.00 severe; 2 room markers cannot override
  },
  {
    name: 'ROOM — mid-band, far from resistance and 52w high',
    inputs: { bbPercentB: 0.60, distanceToResistancePct: 5.0, distTo52wkHigh: 8.0 },
    expected: D1_CLASSES.ROOM, // 3 room markers, 0 extended
  },
  {
    name: 'ROOM via exactly two markers (third neutral)',
    inputs: { bbPercentB: 0.80, distanceToResistancePct: 4.0, distTo52wkHigh: 1.0 },
    expected: D1_CLASSES.ROOM, // pB room + dR room; d52=1.0 neutral; 0 extended
  },
  {
    name: 'INDETERMINATE — all three fields neutral',
    inputs: { bbPercentB: 0.90, distanceToResistancePct: 2.0, distTo52wkHigh: 1.0 },
    expected: D1_CLASSES.INDETERMINATE,
  },
  {
    name: 'INDETERMINATE — one extended, one room (no majority)',
    inputs: { bbPercentB: 0.97, distanceToResistancePct: 5.0, distTo52wkHigh: 1.0 },
    expected: D1_CLASSES.INDETERMINATE, // 1 extended (pB), 1 room (dR)
  },
  {
    name: 'UNSCORABLE — bbPercentB missing',
    inputs: { bbPercentB: null, distanceToResistancePct: 0.6, distTo52wkHigh: 4.0 },
    expected: D1_CLASSES.UNSCORABLE,
  },
  {
    name: 'UNSCORABLE — distTo52wkHigh missing',
    inputs: { bbPercentB: 0.97, distanceToResistancePct: 0.6, distTo52wkHigh: null },
    expected: D1_CLASSES.UNSCORABLE,
  },
]);

// ── D2: all nine truth-table cells (volume × momentum), plus null-path variants ──
// volume family: [volume.ratio ≥ 1.5, momentum.upDayVolRatio ≥ 1.2]
// momentum family: [momentum.macdAboveSignal]
export const D2_GOLDEN = Object.freeze([
  // ── volume PASS row ──
  {
    name: '(PASS, PASS) → CONFIRMED',
    inputs: { volumeRatio: 2.0, upDayVolRatio: 0.9, macdAboveSignal: true },
    expected: D2_CLASSES.CONFIRMED,
  },
  {
    name: '(PASS, FAIL) → INDETERMINATE',
    inputs: { volumeRatio: 2.0, upDayVolRatio: 0.9, macdAboveSignal: false },
    expected: D2_CLASSES.INDETERMINATE,
  },
  {
    name: '(PASS, UNKNOWN) → UNSCORABLE (momentum member missing)',
    inputs: { volumeRatio: 2.0, upDayVolRatio: 0.9, macdAboveSignal: null },
    expected: D2_CLASSES.UNSCORABLE,
  },
  // ── volume FAIL row (both members present, none passes) ──
  {
    name: '(FAIL, PASS) → INDETERMINATE',
    inputs: { volumeRatio: 1.0, upDayVolRatio: 1.0, macdAboveSignal: true },
    expected: D2_CLASSES.INDETERMINATE,
  },
  {
    name: '(FAIL, FAIL) → UNCONFIRMED',
    inputs: { volumeRatio: 1.0, upDayVolRatio: 1.0, macdAboveSignal: false },
    expected: D2_CLASSES.UNCONFIRMED,
  },
  {
    name: '(FAIL, UNKNOWN) → UNSCORABLE',
    inputs: { volumeRatio: 1.0, upDayVolRatio: 1.0, macdAboveSignal: null },
    expected: D2_CLASSES.UNSCORABLE,
  },
  // ── volume UNKNOWN row (a member missing AND the observed member fails) ──
  {
    name: '(UNKNOWN, PASS) → UNSCORABLE',
    inputs: { volumeRatio: null, upDayVolRatio: 1.0, macdAboveSignal: true },
    expected: D2_CLASSES.UNSCORABLE,
  },
  {
    name: '(UNKNOWN, FAIL) → UNSCORABLE',
    inputs: { volumeRatio: null, upDayVolRatio: 1.0, macdAboveSignal: false },
    expected: D2_CLASSES.UNSCORABLE,
  },
  {
    name: '(UNKNOWN, UNKNOWN) → UNSCORABLE (both volume members and momentum missing)',
    inputs: { volumeRatio: null, upDayVolRatio: null, macdAboveSignal: null },
    expected: D2_CLASSES.UNSCORABLE,
  },
  // ── volume-PASS-despite-a-missing-sibling (the "any observed member passes" path) ──
  {
    name: '(PASS via one observed member, sibling null; momentum PASS) → CONFIRMED',
    inputs: { volumeRatio: null, upDayVolRatio: 1.5, macdAboveSignal: true },
    expected: D2_CLASSES.CONFIRMED,
  },
  {
    name: '(PASS via ratio only, upDay null; momentum FAIL) → INDETERMINATE',
    inputs: { volumeRatio: 1.6, upDayVolRatio: null, macdAboveSignal: false },
    expected: D2_CLASSES.INDETERMINATE,
  },
]);
