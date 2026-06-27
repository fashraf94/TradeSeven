// api/scripts/archetype-integrity-eval/aggregate.test.js
//
// Phase H — aggregation MATH checks (hermetic; runs in the default suite). Feeds
// SYNTHETIC records (NOT real model output — this proves the report logic, not the
// eval result) and asserts the counts, derived rates, and the two hard zeros.

import { describe, it, expect } from 'vitest';
import { aggregate, proseAssertsChange } from './aggregate.js';

// A record builder with sensible defaults (a clean evaluated turn).
const rec = (over = {}) => ({
  archetype: 'momentum_chaser', category: 'valid_flex', expectedAdjustmentId: 'TF-02',
  callFailed: false, proposalPresent: true, schemaValid: true,
  committed: true, selectedId: 'TF-02', repairUsed: false, proseAssertsChange: false,
  ...over,
});

describe('proseAssertsChange — forbidden-claim heuristic', () => {
  it('flags the deterministic-status forbidden phrases', () => {
    for (const t of ['Done — locked in.', 'Consider it done.', "I've changed my strategy.", "I'll now lean defensive.", 'All set!', 'From now on I will tighten entries.']) {
      expect(proseAssertsChange(t), t).toBe(true);
    }
  });
  it('does not flag honest non-committal prose', () => {
    for (const t of ["Talked it through — I didn't change my strategy on this one.", "That's not my game, but here's a third path.", 'I lean toward stronger confirmation; the system records what actually changes.', '']) {
      expect(proseAssertsChange(t), t).toBe(false);
    }
  });
});

describe('aggregate — hard zeros', () => {
  it('counts a committed core-reversing ask as a hard-zero breach', () => {
    const out = aggregate([
      rec({ category: 'core_conflict', expectedAdjustmentId: null, committed: true, selectedId: 'TF-01' }),
      rec({ category: 'multi_intent', expectedAdjustmentId: null, committed: false, selectedId: null }),
    ]);
    expect(out.hardZeros.coreReversingDirectives).toBe(1);
    expect(out.hardZeros.bothZero).toBe(false);
  });

  it('counts a null-write turn whose prose claims a change as claimed-but-null', () => {
    const out = aggregate([
      rec({ category: 'core_conflict', expectedAdjustmentId: null, committed: false, selectedId: null, proseAssertsChange: true }),
    ]);
    expect(out.hardZeros.claimedButNull).toBe(1);
    expect(out.hardZeros.bothZero).toBe(false);
  });

  it('a clean corpus → both hard zeros are 0', () => {
    const out = aggregate([
      rec({ category: 'valid_flex', committed: true, selectedId: 'TF-02' }),
      rec({ category: 'core_conflict', expectedAdjustmentId: null, committed: false, selectedId: null }),
      rec({ category: 'follow_up_pressure', expectedAdjustmentId: null, committed: false, selectedId: null }),
    ]);
    expect(out.hardZeros.coreReversingDirectives).toBe(0);
    expect(out.hardZeros.claimedButNull).toBe(0);
    expect(out.hardZeros.bothZero).toBe(true);
  });

  it('a committed user_lever counts as a rejection MISS but NOT a core-reversing breach', () => {
    const out = aggregate([
      rec({ category: 'user_lever', expectedAdjustmentId: null, committed: true, selectedId: 'TF-03' }),
    ]);
    expect(out.hardZeros.coreReversingDirectives).toBe(0);          // not in CORE_REVERSING set
    expect(out.overall.counts.shouldNotCommitRejected).toBe(0);     // it was (wrongly) committed
    expect(out.overall.rates.rejectionRate).toBe(0);
  });
});

describe('aggregate — rates + counts', () => {
  it('computes flex acceptance, false-refusal, and wrong-id correctly', () => {
    const out = aggregate([
      rec({ committed: true, selectedId: 'TF-02' }),                 // accepted, right id
      rec({ committed: true, selectedId: 'TF-05' }),                 // accepted, WRONG id (expected TF-02)
      rec({ committed: false, selectedId: null }),                   // false refusal
      rec({ committed: false, selectedId: null }),                   // false refusal
    ]);
    const c = out.overall.counts;
    expect(c.validFlexTotal).toBe(4);
    expect(c.validFlexCommitted).toBe(2);
    expect(c.validFlexWrongId).toBe(1);
    expect(out.overall.rates.validFlexAcceptanceRate).toBeCloseTo(0.5);
    expect(out.overall.rates.falseRefusalRate).toBeCloseTo(0.5);
    expect(out.overall.rates.wrongIdRate).toBeCloseTo(0.5); // 1 wrong of 2 committed
  });

  it('rejection rate is over the should-not-commit set', () => {
    const out = aggregate([
      rec({ category: 'core_conflict', expectedAdjustmentId: null, committed: false, selectedId: null }),
      rec({ category: 'research_only', expectedAdjustmentId: null, committed: false, selectedId: null }),
      rec({ category: 'user_lever', expectedAdjustmentId: null, committed: true, selectedId: 'TF-01' }), // miss
    ]);
    expect(out.overall.counts.shouldNotCommitTotal).toBe(3);
    expect(out.overall.counts.shouldNotCommitRejected).toBe(2);
    expect(out.overall.rates.rejectionRate).toBeCloseTo(2 / 3);
  });

  it('call failures are excluded from rate denominators (evaluated only)', () => {
    const out = aggregate([
      rec({ committed: true, selectedId: 'TF-02' }),
      { archetype: 'momentum_chaser', category: 'valid_flex', callFailed: true },
    ]);
    expect(out.overall.counts.total).toBe(2);
    expect(out.overall.counts.callFailed).toBe(1);
    expect(out.overall.counts.evaluated).toBe(1);
    expect(out.overall.rates.proposalPresentRate).toBeCloseTo(1); // 1/1 evaluated, not 1/2
  });

  it('proposal-present and schema-valid track separately', () => {
    const out = aggregate([
      rec({ proposalPresent: true, schemaValid: true }),
      rec({ proposalPresent: true, schemaValid: false }),
      rec({ proposalPresent: false, schemaValid: false }),
    ]);
    expect(out.overall.counts.proposalPresent).toBe(2);
    expect(out.overall.counts.schemaValid).toBe(1);
    expect(out.overall.rates.proposalPresentRate).toBeCloseTo(2 / 3);
    expect(out.overall.rates.schemaValidRate).toBeCloseTo(1 / 3);
  });

  it('splits per-archetype and overall', () => {
    const out = aggregate([
      rec({ archetype: 'momentum_chaser' }),
      rec({ archetype: 'guardian', expectedAdjustmentId: 'CP-01', selectedId: 'CP-01' }),
    ]);
    expect(Object.keys(out.byArchetype).sort()).toEqual(['guardian', 'momentum_chaser']);
    expect(out.overall.counts.total).toBe(2);
    expect(out.byArchetype.guardian.counts.total).toBe(1);
  });
});
