// api/_utils/learning/fixtures/withinBarFixtures.js
//
// Agent Learning System — L1 Foundation, Phase 3, Suite 3 (Within-bar).
// Source of truth: Build Spec §4.3 — "the entry's own unfinished bar mutated
// AFTER the decision timestamp; the snapshot must not change UNLESS the field's
// contract explicitly permits partial-bar data available at that instant."
//
// PREREQUISITE (Build Spec §4): "every predicate field's bar basis must be
// pinned." barBasis.js is that pinned table; this suite asserts it is complete
// and honors the dual-mode finding, then proves that a partial-bar mutation
// landing AFTER the decision instant never alters the captured snapshot.
//
// The dual-mode reality (VERIFIED): under a PREMARKET source-doc write, every
// field's basis is the LAST FULLY-CLOSED DAILY BAR; under an INTRADAY write, the
// live quote is spliced onto index 0 → POINT-IN-TIME PARTIAL BAR. Intraday, the
// field contract DOES permit partial-bar data available AT the decision instant
// (contemporaneous, not forward-lookahead). What it never permits is data from
// AFTER the decision instant — the captured snapshot is frozen.

import { BAR_BASIS, PREDICATE_BAR_BASIS } from '../barBasis.js';

export const WITHIN_BAR = Object.freeze([
  {
    name: 'INTRADAY capture — partial bar keeps ticking AFTER the decision; snapshot frozen',
    dataMode: 'intraday',
    // The snapshot as captured at the decision instant T (point-in-time partial).
    capturedInputs: {
      bbPercentB: 0.96, distanceToResistancePct: 0.7, distTo52wkHigh: 3.0,
      volumeRatio: 1.0 /* neutralized intraday placeholder */, upDayVolRatio: 1.25,
      macdAboveSignal: true, macdFreshBullishCross: false,
    },
    // Mutation of the SAME unfinished bar, arriving AFTER T. Must be ignored —
    // the captured snapshot already froze the instant-T values.
    postDecisionMutation: {
      bbPercentB: 0.40, distanceToResistancePct: 5.0, distTo52wkHigh: 8.0,
      volumeRatio: 6.0, upDayVolRatio: 0.5, macdAboveSignal: false, macdFreshBullishCross: false,
    },
  },
  {
    name: 'PREMARKET capture — basis is the last fully-closed daily bar; intraday churn irrelevant',
    dataMode: 'premarket',
    capturedInputs: {
      bbPercentB: 0.55, distanceToResistancePct: 6.0, distTo52wkHigh: 9.0,
      volumeRatio: 1.0, upDayVolRatio: 1.0, macdAboveSignal: false, macdFreshBullishCross: false,
    },
    postDecisionMutation: {
      bbPercentB: 0.99, distanceToResistancePct: 0.1, distTo52wkHigh: 0.2,
      volumeRatio: 8.0, upDayVolRatio: 2.0, macdAboveSignal: true, macdFreshBullishCross: true,
    },
  },
]);

/** Fields whose basis goes point-in-time-partial under an intraday write. */
export const PARTIAL_UNDER_INTRADAY = Object.freeze(
  Object.entries(PREDICATE_BAR_BASIS)
    .filter(([, row]) => row.intraday === BAR_BASIS.PARTIAL)
    .map(([field]) => field),
);
