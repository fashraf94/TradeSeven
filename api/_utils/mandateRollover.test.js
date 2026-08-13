// api/_utils/mandateRollover.test.js
// Spec 1 §5.3 — the rollover core: FR-1 capital carry (transaction-asserted, I15),
// I4 summary derivation from tagged rows, F21 catch-up, F7 idempotency, F23
// cadence recompute, FR-7 stable manager identity, open-batch disposal (I1), and
// two-writer contention against the transaction-faithful fake.

import { describe, it, expect } from 'vitest';
import { rollOneBoundary, catchUpBook, assertCapitalConserved } from './mandateRollover.js';
import { makeMandateFakeDb } from './__testsupport__/mandateFakeFirestore.js';
import { buildNewMandateDoc, buildDailyRow, deriveManagerAgentId } from './mandateSchema.js';

const CAPITAL = 10_000_000;

function book(over = {}) {
  const doc = buildNewMandateDoc({
    mandateId: 'm1', userId: 'u1', archetype: 'analyst',
    managerAgentId: deriveManagerAgentId('u1', 'analyst'),
    vintageRef: 'archetypeVintages/analyst_OLD',
    cadenceTier: 'slow',
    createdAt: new Date('2026-06-01T13:00:00Z'),
    quarterStartAt: new Date('2026-06-01T13:00:00Z'),
    nextRolloverAt: new Date('2026-09-01T20:00:00Z'), // the boundary (past `now` below)
    escapeHatchEligibleUntil: new Date('2026-06-15T13:00:00Z'),
  });
  // Simulate a quarter of trading: capital grew to 10.5M, a position, HWM history.
  return {
    ...doc,
    revision: 42,
    portfolio: {
      ...doc.portfolio,
      cash: 500000,
      positions: { AAPL: { shares: 50000, costBasisTotal: 9000000, avgCost: 180, lastMark: 200, lastMarkSource: 'snapshot', sector: 'Technology', openedAt: '2026-06-02' } },
      totalValue: 10500000, initialValue: CAPITAL,
      lifetimeHighWaterMark: 10600000, lifetimeDrawdownFromPeak: 0.0094,
      quarterHighWaterMark: 10600000, quarterDrawdownFromPeak: 0.0094,
    },
    health: { ...doc.health, consecutiveMissedMarks: 1, lastEvalSweepAt: new Date('2026-08-31T14:00:00Z'), lastCloseAttemptAt: new Date('2026-08-31T20:30:00Z') },
    execState: { ...doc.execState, submitted: 20, executed: 12, staleRejectStreak: 1, lastCloseKey: '2026-09-01' },
    ...over,
  };
}

function q1Rows() {
  return {
    'mandates/m1/dailyRows/2026-06-02': buildDailyRow({ date: '2026-06-02', quarterIndex: 1, totalValue: 10000000, dayReturnPct: null, partial: true, regime: 'risk_on', agencyState: 'full', dayFrictionPaid: null }),
    'mandates/m1/dailyRows/2026-07-15': buildDailyRow({ date: '2026-07-15', quarterIndex: 1, totalValue: 10250000, dayReturnPct: 0.005, regime: 'risk_on', agencyState: 'full', dayFrictionPaid: 120, dividendIncomeUsd: 5000 }),
    'mandates/m1/dailyRows/2026-09-01': buildDailyRow({ date: '2026-09-01', quarterIndex: 1, totalValue: 10500000, dayReturnPct: 0.004, regime: 'neutral', agencyState: 'full', dayFrictionPaid: 90 }),
  };
}

const NOW = new Date('2026-09-02T12:00:00Z'); // after the 2026-09-01 boundary

describe('rollOneBoundary — FR-1 capital carry + lens reset + carry-through', () => {
  it('carries capital UNCHANGED, resets the tenure lens, re-pins vintage, advances the quarter', async () => {
    const db = makeMandateFakeDb({ 'mandates/m1': book(), ...q1Rows() });
    const r = await rollOneBoundary(db, db.doc('mandates/m1'), { now: NOW });
    expect(r.rolled).toBe(true);
    expect(r.oldQuarterIndex).toBe(1);
    expect(r.newQuarterIndex).toBe(2);

    const b = db._get('mandates/m1');
    // FR-1: capital fields byte-identical.
    expect(b.portfolio.cash).toBe(500000);
    expect(b.portfolio.positions.AAPL.shares).toBe(50000);
    expect(b.portfolio.totalValue).toBe(10500000);
    expect(b.portfolio.initialValue).toBe(CAPITAL);
    // Lifetime lens untouched; tenure lens reset to the carried total.
    expect(b.portfolio.lifetimeHighWaterMark).toBe(10600000);
    expect(b.portfolio.lifetimeDrawdownFromPeak).toBe(0.0094);
    expect(b.portfolio.quarterHighWaterMark).toBe(10500000); // reset to totalValue
    expect(b.portfolio.quarterDrawdownFromPeak).toBe(0);
    // Quarter identity advanced; boundary is the logical instant.
    expect(b.quarterIndex).toBe(2);
    expect(b.quarterKey).toBe('m1:2');
    expect(b.quarterStartAt).toEqual(new Date('2026-09-01T20:00:00Z'));
    expect(b.nextRolloverAt.getTime()).toBeGreaterThan(new Date('2026-11-30').getTime()); // ~+3mo
    // Vintage re-pinned to the current published (content-addressed) ref.
    expect(b.vintageRef).toMatch(/^archetypeVintages\/analyst_/);
    expect(b.vintageRef).not.toBe('archetypeVintages/analyst_OLD');
    // cadenceTier recomputed from the archetype (analyst → slow).
    expect(b.cadenceTier).toBe('slow');
    // Idempotency + failure-streak reset + revision bump.
    expect(b.execState.lastProcessedRolloverKey).toBe('m1:1');
    expect(b.health.consecutiveRolloverFailures).toBe(0);
    expect(b.revision).toBe(43);
    // Health/exec carry-through preserved (not re-seeded).
    expect(b.health.consecutiveMissedMarks).toBe(1);
    expect(b.execState.submitted).toBe(20);
    expect(b.execState.staleRejectStreak).toBe(1);
  });

  it('writes the OLD quarter summary derived from its tagged rows (I4), scoring:true', async () => {
    const db = makeMandateFakeDb({ 'mandates/m1': book(), ...q1Rows() });
    await rollOneBoundary(db, db.doc('mandates/m1'), { now: NOW });
    const s = db._get('mandates/m1/quarterSummaries/1');
    expect(s.quarterIndex).toBe(1);
    expect(s.openingValue).toBe(10000000); // first tagged row
    expect(s.closingValue).toBe(10500000); // last tagged row
    expect(s.archetype).toBe('analyst');
    expect(s.vintageRef).toBe('archetypeVintages/analyst_OLD'); // what SERVED q1
    expect(s.scoring).toBe(true);
    expect(s.empty).toBe(false);
    expect(s.dividendIncomeTotalUsd).toBe(5000);
    expect(s.frictionTotalUsd).toBe(210); // 120 + 90 (first-row null → 0)
    expect(s.agencyStateMix).toEqual({ full: 3 });
  });

  it('FR-1 assertion FIRES on an injected capital mutation → txn aborts, book unchanged', async () => {
    const db = makeMandateFakeDb({ 'mandates/m1': book(), ...q1Rows() });
    await expect(rollOneBoundary(db, db.doc('mandates/m1'), {
      now: NOW,
      patchMutator: (p) => ({ ...p, 'portfolio.totalValue': 999 }), // a rollover must NEVER do this
    })).rejects.toThrow(/FR-1 violation/);
    // Atomicity: nothing committed.
    const b = db._get('mandates/m1');
    expect(b.quarterIndex).toBe(1);
    expect(b.portfolio.totalValue).toBe(10500000);
    expect(db._get('mandates/m1/quarterSummaries/1')).toBeUndefined();
  });
});

describe('assertCapitalConserved (exported guard)', () => {
  it('passes a clean patch, throws on every capital-touching key', () => {
    expect(() => assertCapitalConserved(10500000, { 'portfolio.quarterHighWaterMark': 10500000, quarterIndex: 2 })).not.toThrow();
    for (const k of ['portfolio.totalValue', 'portfolio.cash', 'portfolio.positions.AAPL.shares', 'portfolio.initialValue', 'portfolio.lifetimeHighWaterMark']) {
      expect(() => assertCapitalConserved(10500000, { [k]: 1 })).toThrow(/FR-1 violation/);
    }
  });
  it('throws when the tenure HWM reset != carried total, or the pre-read is not positive', () => {
    expect(() => assertCapitalConserved(10500000, { 'portfolio.quarterHighWaterMark': 9999999 })).toThrow(/FR-1 violation/);
    expect(() => assertCapitalConserved(0, {})).toThrow(/FR-1/);
    expect(() => assertCapitalConserved(NaN, {})).toThrow(/FR-1/);
  });
  it('MONEY-P4-1: a COARSE portfolio parent-write (or bracket index) is caught, not just dotted leaves', () => {
    // The whitelist closes the hole a leaf-only blacklist left open: replacing the
    // whole portfolio map — or a would-be array index — smuggles capital past a
    // check that only inspected `portfolio.<leaf>` strings. Both must throw.
    expect(() => assertCapitalConserved(10500000, { portfolio: { totalValue: 999 } })).toThrow(/FR-1 violation/);
    expect(() => assertCapitalConserved(10500000, { 'portfolio[0]': 999 })).toThrow(/FR-1 violation/);
    // ...while the two tenure-lens leaves the rollover is ALLOWED to reset still pass.
    expect(() => assertCapitalConserved(10500000, {
      'portfolio.quarterHighWaterMark': 10500000, 'portfolio.quarterDrawdownFromPeak': 0,
    })).not.toThrow();
  });
});

describe('rollOneBoundary — idempotency (F7 / acceptance #4)', () => {
  it('a replay after the boundary advanced is skipped:not_due — exactly one summary', async () => {
    const db = makeMandateFakeDb({ 'mandates/m1': book(), ...q1Rows() });
    const r1 = await rollOneBoundary(db, db.doc('mandates/m1'), { now: NOW });
    expect(r1.rolled).toBe(true);
    const r2 = await rollOneBoundary(db, db.doc('mandates/m1'), { now: NOW });
    expect(r2.rolled).toBe(false);
    expect(r2.skipped).toBe('not_due'); // nextRolloverAt advanced to +3mo, now < it
    // Still exactly one summary, one advance.
    expect(db._get('mandates/m1').quarterIndex).toBe(2);
    expect(db._get('mandates/m1/quarterSummaries/2')).toBeUndefined();
  });
});

describe('catchUpBook — logical-time catch-up (F21)', () => {
  it('processes multiple elapsed boundaries oldest-first, one summary each', async () => {
    // now is far in the future → the book lags several boundaries.
    const farNow = new Date('2027-01-15T12:00:00Z'); // ~2 quarters past the 2026-09-01 boundary
    const db = makeMandateFakeDb({ 'mandates/m1': book(), ...q1Rows() });
    const { processed, boundaries } = await catchUpBook(db, db.doc('mandates/m1'), { now: farNow });
    expect(boundaries).toBeGreaterThanOrEqual(2);
    const b = db._get('mandates/m1');
    expect(b.quarterIndex).toBe(1 + boundaries);
    expect(b.portfolio.totalValue).toBe(10500000); // capital carried across EVERY boundary (FR-1)
    // A summary per processed boundary.
    for (let qi = 1; qi <= boundaries; qi++) {
      expect(db._get(`mandates/m1/quarterSummaries/${qi}`)).toBeDefined();
    }
    // The final nextRolloverAt is now in the future — caught up.
    expect(b.nextRolloverAt.getTime()).toBeGreaterThan(farNow.getTime());
    expect(processed[0].oldQuarterIndex).toBe(1); // oldest first
  });

  it('a catch-up quarter with NO rows records empty:true, never fabricated', async () => {
    // Only q1 has rows; q2+ have none (a mid-life outage). Catch-up derives each
    // from its own (empty) range.
    const farNow = new Date('2027-01-15T12:00:00Z');
    const db = makeMandateFakeDb({ 'mandates/m1': book(), ...q1Rows() });
    const { boundaries } = await catchUpBook(db, db.doc('mandates/m1'), { now: farNow });
    // q1 has rows (not empty); q2 has none (empty).
    expect(db._get('mandates/m1/quarterSummaries/1').empty).toBe(false);
    if (boundaries >= 2) expect(db._get('mandates/m1/quarterSummaries/2').empty).toBe(true);
  });
});

describe('rollOneBoundary — archetype change (DEF-1 param) + FR-7 stability', () => {
  it('same archetype keeps the SAME managerAgentId (FR-7); a different one changes identity, not capital', async () => {
    const db = makeMandateFakeDb({ 'mandates/m1': book(), ...q1Rows() });
    const before = db._get('mandates/m1').managerAgentId;
    await rollOneBoundary(db, db.doc('mandates/m1'), { now: NOW }); // default: continue analyst
    expect(db._get('mandates/m1').managerAgentId).toBe(before); // stable per user×archetype

    const db2 = makeMandateFakeDb({ 'mandates/m1': book(), ...q1Rows() });
    await rollOneBoundary(db2, db2.doc('mandates/m1'), { now: NOW, archetype: 'contrarian' });
    const b = db2._get('mandates/m1');
    expect(b.archetype).toBe('contrarian');
    expect(b.managerAgentId).toBe(deriveManagerAgentId('u1', 'contrarian')); // new archetype → new stable id
    expect(b.cadenceTier).toBe('standard'); // contrarian → standard (F23 recompute)
    expect(b.portfolio.totalValue).toBe(10500000); // FR-1: capital untouched by the manager change
  });
});

describe('rollOneBoundary — two-writer contention (three revision writers)', () => {
  it('two fires on the same boundary → one rolls, the other skips; exactly one summary + one advance', async () => {
    const db = makeMandateFakeDb({ 'mandates/m1': book(), ...q1Rows() });
    // Writer B commits the boundary inside writer A's transaction window.
    db.setBarrier(async () => {
      await rollOneBoundary(db, db.doc('mandates/m1'), { now: NOW });
    });
    const rA = await rollOneBoundary(db, db.doc('mandates/m1'), { now: NOW });
    expect(rA.rolled).toBe(false); // A lost; its retry re-read the advanced book and skipped
    const b = db._get('mandates/m1');
    expect(b.quarterIndex).toBe(2);        // exactly one advance
    expect(b.revision).toBe(43);           // exactly one bump
    expect(db._get('mandates/m1/quarterSummaries/1')).toBeDefined();
    expect(db._get('mandates/m1/quarterSummaries/2')).toBeUndefined(); // no double summary
  });
});

describe('rollOneBoundary — open-batch disposal (I1)', () => {
  it('cancels an open batch inside the rollover transaction (never crosses a boundary)', async () => {
    const db = makeMandateFakeDb({
      'mandates/m1': book({ execState: { ...book().execState, openBatchId: 'batch_xyz', openBatchSubmittedAt: new Date('2026-09-01T15:00:00Z') } }),
      ...q1Rows(),
    });
    const r = await rollOneBoundary(db, db.doc('mandates/m1'), { now: NOW });
    expect(r.rolled).toBe(true);
    expect(r.cancelledBatch).toBe('batch_xyz');
    const b = db._get('mandates/m1');
    expect(b.execState.openBatchId).toBeNull();
    expect(b.execState.openBatchSubmittedAt).toBeNull();
    expect(db._get('mandates/m1/decisions/batch_xyz').status).toBe('cancelled');
  });
});
