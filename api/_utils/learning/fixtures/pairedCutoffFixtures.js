// api/_utils/learning/fixtures/pairedCutoffFixtures.js
//
// Agent Learning System — L1 Foundation, Phase 3, Suite 2 (Paired cutoff).
// Source of truth: Build Spec §4.2 — "data identical through the entry
// timestamp, EVERY later bar mutated; the entry-time snapshot and its
// classification must be BYTE-IDENTICAL. This is the only construct that tests
// the no-lookahead promise."
//
// Construction: each fixture pairs one entry-time predicate snapshot with TWO
// arbitrarily-different "later bar" payloads (attached as the decoy `_laterBars`
// field). The classifiers must consume ONLY the entry-time fields, so both
// variants must project to a byte-identical entry snapshot and classify
// identically. If any classifier ever peeks at a later bar, the two variants
// diverge and the suite fails — that is the regression this suite locks in.

import { D1_CLASSES, D2_CLASSES } from '../detectorClassifiers.js';

// The predicate keys a classifier is allowed to read at the entry instant. The
// entry-time projection is exactly these; everything else (e.g. `_laterBars`)
// is post-cutoff data the classifier must never touch.
export const ENTRY_SNAPSHOT_KEYS = Object.freeze([
  'bbPercentB', 'distanceToResistancePct', 'distTo52wkHigh', // D1
  'volumeRatio', 'upDayVolRatio', 'macdAboveSignal', 'macdFreshBullishCross', // D2
]);

/** Project only the entry-time snapshot (drops all post-cutoff / decoy fields). */
export function projectEntrySnapshot(inputs) {
  const out = {};
  for (const k of ENTRY_SNAPSHOT_KEYS) out[k] = inputs[k] ?? null;
  return out;
}

export const PAIRED_CUTOFF = Object.freeze([
  {
    name: 'EXTENDED/CONFIRMED entry — later bars reverse hard, classification frozen',
    entryInputs: {
      bbPercentB: 0.97, distanceToResistancePct: 0.6, distTo52wkHigh: 4.0,
      volumeRatio: 2.0, upDayVolRatio: 1.3, macdAboveSignal: true, macdFreshBullishCross: true,
    },
    laterBarsA: { closes: [101, 99, 98], bbPercentB: 0.10, volumeRatio: 0.2, macdAboveSignal: false },
    laterBarsB: { closes: [140, 160, 200], bbPercentB: 1.30, volumeRatio: 9.9, macdAboveSignal: true },
    expectedD1: D1_CLASSES.EXTENDED,
    expectedD2: D2_CLASSES.CONFIRMED,
  },
  {
    name: 'ROOM/UNCONFIRMED entry — later bars spike, classification frozen',
    entryInputs: {
      bbPercentB: 0.55, distanceToResistancePct: 6.0, distTo52wkHigh: 9.0,
      volumeRatio: 1.0, upDayVolRatio: 1.0, macdAboveSignal: false, macdFreshBullishCross: false,
    },
    laterBarsA: { bbPercentB: 0.99, distanceToResistancePct: 0.2, volumeRatio: 5.0, macdAboveSignal: true },
    laterBarsB: { bbPercentB: 0.05, distanceToResistancePct: 12.0, volumeRatio: 0.1, macdAboveSignal: false },
    expectedD1: D1_CLASSES.ROOM,
    expectedD2: D2_CLASSES.UNCONFIRMED,
  },
  {
    name: 'INDETERMINATE/INDETERMINATE entry — later bars irrelevant',
    entryInputs: {
      bbPercentB: 0.90, distanceToResistancePct: 2.0, distTo52wkHigh: 1.0,
      volumeRatio: 2.0, upDayVolRatio: 0.9, macdAboveSignal: false, macdFreshBullishCross: false,
    },
    laterBarsA: { bbPercentB: 1.10, macdAboveSignal: true },
    laterBarsB: { bbPercentB: 0.10, macdAboveSignal: false },
    expectedD1: D1_CLASSES.INDETERMINATE,
    expectedD2: D2_CLASSES.INDETERMINATE,
  },
  {
    name: 'UNSCORABLE entry (missing pB) stays UNSCORABLE no matter the future',
    entryInputs: {
      bbPercentB: null, distanceToResistancePct: 0.6, distTo52wkHigh: 4.0,
      volumeRatio: null, upDayVolRatio: 1.0, macdAboveSignal: true, macdFreshBullishCross: false,
    },
    laterBarsA: { bbPercentB: 0.99, volumeRatio: 3.0 }, // a later bar HAS the value — must NOT heal the entry
    laterBarsB: { bbPercentB: 0.01, volumeRatio: 0.1 },
    expectedD1: D1_CLASSES.UNSCORABLE,
    expectedD2: D2_CLASSES.UNSCORABLE,
  },
]);
