// api/_utils/practiceField/corporateActionSequences.test.js
//
// Practice Field T1a-2b-3, FIX ROUND 2 — Amendment F revision 1, S-6: THE INVARIANTS, TESTED OVER GENERATED SEQUENCES.
// A seeded generator writes vendor histories for one idea (AAPL and MSFT, entered on S[0]): purchases on ex-dates,
// conflicts, revisions, re-dates, coverage failures, catch-ups whose backfill agrees or disagrees with the archive,
// split-shaped price paths, founder rulings and re-run closes. Each history is driven through the REAL close, catch-up and
// founder action against the fake database, and after EVERY close:
//   I-1  no id is both applied and declined on a ledger;
//   I-2  an id that ever became ambiguous has moved no cash and no shares except by the founder's ruling, holds no
//        replayable record, and while any record stays open the row is below full quality;
//        AND (final fix, Astra round 2) by the INDEPENDENT oracle (__testsupport__/caOracle.js): an id ambiguous by the
//        emitted inputs alone moves cash or shares only under an accepted CONFLICT ruling the harness made for it choosing
//        that payload, and every movement is accounted for by its receipt (dividends, share chain, income);
//   I-3  the book reconciles to its ideas (reconcile.js), and the same-stock comparison stays tied to the idea;
//   I-5  re-running the close (the book's cursor put back one session) adds nothing — no cash, no shares, no id settled.
// And at the end of a history with complete coverage and no ambiguity:
//   I-4  the money is what the ENGINE'S OWN APPLIER gives over the same rows in date order with entitlement
//        (mandateCorporateActions.js applyCorporateAction — never the ledger's applyActions, which is under test).
// The classes the seeds produce are counted, so a generator that never reaches an order cannot pass vacuously.

import { describe, it, expect } from 'vitest';
import { generate, run, FIXED, ASTRA_R2, SOAK_R3, reached, installSequenceHooks } from './__testsupport__/caSequences.js';

installSequenceHooks();

const SEEDS = Array.from({ length: 48 }, (_, k) => 1001 + k);

describe('S-6 — the generator reaches every order it is meant to (no vacuous pass)', () => {
  it('the fixed seeds produce clean histories and every kind of event, each at least a few times', () => {
    const plans = SEEDS.map(generate);
    const count = (k) => plans.filter((p) => p.kinds.includes(k)).length;
    const clean = plans.filter((p) => p.clean);
    expect(clean.length).toBeGreaterThanOrEqual(10);
    expect(clean.filter((p) => p.kinds.includes('split')).length).toBeGreaterThanOrEqual(4);
    expect(clean.filter((p) => p.kinds.includes('dividend')).length).toBeGreaterThanOrEqual(4);
    expect(clean.filter((p) => p.kinds.includes('purchase_on_ex_date')).length).toBeGreaterThanOrEqual(2);
    for (const k of ['conflict', 'revision', 'redate', 'coverage_failure', 'backfill_agrees', 'backfill_disagrees', 'split_shaped_move', 'founder_ruling', 'purchase_on_ex_date', 'c01_chain', 'c04_chain']) {
      expect(count(k), k).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('S-6 — every reproduction from Astra\'s reviews, as a fixed case: I-1 to I-5 after every close, and the money rev 1 gives', () => {
  it.each(FIXED.map((p) => [p.seed, p]))('%s', async (_seed, plan) => {
    await run(plan);
  }, 60_000);
});

// Final fix (Astra's round-2 confirmation, docs/audits/20261119_ASTRA_CONFIRMATION_T1A2B3_ROUND2.md): her two replay seeds
// VERBATIM (T2D-D01, T2D-D02), and the regressions around each fix.
describe('S-6 — Astra round 2: T2D-D01 and T2D-D02, her replay seeds verbatim and the rows around each fix', () => {
  it.each(ASTRA_R2.map((p) => [p.seed, p]))('%s', async (_seed, plan) => {
    await run(plan);
  }, 60_000);
});

// …and the final soak's finding SOAK-R3-1, as fixed cases.
describe('S-6 — the final soak\'s findings: a founder split under a possible re-date', () => {
  it.each(SOAK_R3.map((p) => [p.seed, p]))('%s', async (_seed, plan) => {
    await run(plan);
  }, 60_000);
});

describe('S-6 — I-1 to I-5 after every close of every generated history', () => {
  it.each(SEEDS)('seed %i', async (seed) => {
    await run(generate(seed));
  }, 60_000);
  // (Runs after the seeds, in file order: what the histories REACHED in the product, not only what was generated — AR2-C's
  // test-integrity finding: a payload added to a record later, a re-date matched against an ambiguous record, a halving
  // kept at an uncovered close, a ruled id revised. Each class must have been driven at least once.)
  it('the seeds reached each of the product paths the fixed cases pin (payload kept later, re-date of an ambiguous record, uncovered transition, revision after a ruling)', () => {
    expect(reached.payloadAddedLater, 'payloadAddedLater').toBeGreaterThanOrEqual(2);
    expect(reached.redateOfAmbiguous, 'redateOfAmbiguous').toBeGreaterThanOrEqual(2);
    expect(reached.uncoveredTransition, 'uncoveredTransition').toBeGreaterThanOrEqual(2);
    expect(reached.revisedAfterRuling, 'revisedAfterRuling').toBeGreaterThanOrEqual(1);
  });
});
