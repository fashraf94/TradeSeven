// api/_utils/mandateExecution.test.js
// Spec 1 §3.5 / §4.1 / §3.3 — execution boundary, average-cost math, quantity
// clamps, the price-drift guard, and the exactly-once transaction.

import { describe, it, expect } from 'vitest';
import {
  bankersRound, executedPriceFor, driftBps, validateEnvelope,
  computeExecution, executeDecision, defaultFriction,
} from './mandateExecution.js';

// ── Fake Firestore with subcollections + transactions ────────────────────────
function makeFakeDb(seed = {}) {
  const store = new Map(Object.entries(seed));
  function ref(path) {
    return {
      path,
      collection: (sub) => ({ doc: (id) => ref(`${path}/${sub}/${id}`) }),
      async get() { const d = store.get(path); return { exists: d !== undefined, data: () => d }; },
      async set(data) { store.set(path, data); },
      async update(patch) {
        const cur = store.get(path) || {};
        const next = { ...cur };
        for (const [k, v] of Object.entries(patch)) {
          if (k.includes('.')) {
            const [a, b] = k.split('.');
            next[a] = { ...(next[a] || {}), [b]: v };
          } else next[k] = v;
        }
        store.set(path, next);
      },
    };
  }
  return {
    _store: store,
    collection: (c) => ({ doc: (id) => ref(`${c}/${id}`) }),
    async runTransaction(fn) {
      return fn({
        get: (r) => r.get(),
        set: (r, d) => r.set(d),
        update: (r, d) => r.update(d),
      });
    },
  };
}

const SNAP = { tickKey: '2026-08-12_open30', symbols: { AAPL: { complete: true, price: 200, sector: 'Technology', priceAsOf: '2026-08-12T14:00:00Z' } } };
const NOW = new Date('2026-08-12T14:00:05Z');

function baseBook(overrides = {}) {
  return {
    revision: 5, quarterKey: 'm1:1', status: 'active', voided: false,
    portfolio: { cash: 100000, positions: {}, totalValue: 100000 },
    execState: { openBatchId: null, submitted: 0, executed: 0 },
    ...overrides,
  };
}
const ENV = {
  baseRevision: 5, quarterKey: 'm1:1', sessionDate: '2026-08-12',
  submittedAt: new Date('2026-08-12T14:00:00Z').toISOString(),
  vintageRef: 'archetypeVintages/analyst_abc', submitTickKey: '2026-08-12_open30',
};

describe('rounding + price + drift primitives', () => {
  it('bankers rounds half to even', () => {
    expect(bankersRound(2.5, 0)).toBe(2);
    expect(bankersRound(3.5, 0)).toBe(4);
    expect(bankersRound(1.005, 2)).toBeCloseTo(1.0, 5); // 1.005 → 1.00 (even)
  });
  it('P2 friction is zero → executedPrice == mark', () => {
    expect(executedPriceFor('BUY', 200, defaultFriction())).toBe(200);
    expect(executedPriceFor('SELL', 200, defaultFriction())).toBe(200);
  });
  it('driftBps measures the move from submit to harvest', () => {
    expect(driftBps(200, 200)).toBe(0);
    expect(driftBps(200, 203)).toBeCloseTo(150, 5); // exactly the P2 cap
    expect(driftBps(200, 210)).toBeCloseTo(500, 5);
  });
});

describe('validateEnvelope — harvest validation (§3.3)', () => {
  const common = { currentSessionDate: '2026-08-12', now: NOW, submitMark: 200, harvestMark: 200, verb: 'BUY', ticker: 'AAPL' };
  it('passes when all conditions hold', () => {
    expect(validateEnvelope(baseBook(), ENV, common).ok).toBe(true);
  });
  it('rejects a stale baseRevision', () => {
    expect(validateEnvelope(baseBook({ revision: 9 }), ENV, common)).toMatchObject({ ok: false, status: 'rejected_stale', failCondition: 'base_revision' });
  });
  it('rejects a cross-session result (F3)', () => {
    expect(validateEnvelope(baseBook(), ENV, { ...common, currentSessionDate: '2026-08-13' })).toMatchObject({ failCondition: 'cross_session' });
  });
  it('expires an aged-out result', () => {
    const old = { ...ENV, submittedAt: new Date('2026-08-12T05:00:00Z').toISOString() };
    expect(validateEnvelope(baseBook(), old, common)).toMatchObject({ ok: false, status: 'expired', failCondition: 'result_age' });
  });
  it('rejects on price drift beyond the cap (I3)', () => {
    expect(validateEnvelope(baseBook(), ENV, { ...common, harvestMark: 210 })).toMatchObject({ ok: false, status: 'rejected_stale', failCondition: 'price_drift' });
  });
  it('rejects a voided / non-active book', () => {
    expect(validateEnvelope(baseBook({ voided: true }), ENV, common)).toMatchObject({ failCondition: 'quarter_or_status' });
  });
});

describe('computeExecution — average-cost math (§4.1)', () => {
  it('BUY opens a position at avg cost, cash reduced', () => {
    const r = computeExecution({ decision: { verb: 'BUY', ticker: 'AAPL' }, execSizeUsd: 10000, positions: {}, cash: 100000, snapshot: SNAP });
    expect(r.ok).toBe(true);
    expect(r.mutation.positions.AAPL).toMatchObject({ shares: 50, costBasisTotal: 10000, avgCost: 200, sector: 'Technology' });
    expect(r.mutation.cash).toBe(90000);
    expect(r.receipt.executedSizeUsd).toBe(10000);
  });
  it('ADD blends the average cost', () => {
    const positions = { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, sector: 'Technology' } };
    const r = computeExecution({ decision: { verb: 'ADD', ticker: 'AAPL' }, execSizeUsd: 5000, positions, cash: 90000, snapshot: SNAP });
    expect(r.mutation.positions.AAPL.shares).toBe(75);
    expect(r.mutation.positions.AAPL.costBasisTotal).toBe(15000);
    expect(r.mutation.positions.AAPL.avgCost).toBe(200);
  });
  it('SELL full exit realizes P&L and removes the position', () => {
    const snap = { ...SNAP, symbols: { AAPL: { complete: true, price: 220, sector: 'Technology' } } };
    const positions = { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, sector: 'Technology' } };
    const r = computeExecution({ decision: { verb: 'SELL', ticker: 'AAPL' }, positions, cash: 90000, snapshot: snap });
    expect(r.mutation.positions.AAPL).toBeUndefined();
    expect(r.mutation.cash).toBe(90000 + 11000); // 50*220
    expect(r.receipt.realizedPnl).toBe(1000);     // 11000 proceeds - 10000 basis
  });
  it('TRIM reduces basis proportionally', () => {
    const snap = { ...SNAP, symbols: { AAPL: { complete: true, price: 220, sector: 'Technology' } } };
    const positions = { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, sector: 'Technology' } };
    const r = computeExecution({ decision: { verb: 'TRIM', ticker: 'AAPL' }, execSizeUsd: 2200, positions, cash: 90000, snapshot: snap });
    // wantShares = floor(2200/220)=10; deltaBasis = 10000*(10/50)=2000; realized = 2200-2000=200
    expect(r.mutation.positions.AAPL.shares).toBe(40);
    expect(r.mutation.positions.AAPL.costBasisTotal).toBe(8000);
    expect(r.receipt.realizedPnl).toBe(200);
    expect(r.receipt.clamped).toBe(false);
  });
  it('SELL of a FROZEN held symbol fills at the carry-over mark (C-21: never suppressed)', () => {
    const frozenSnap = { tickKey: 't', symbols: { AAPL: { complete: false, price: null } } }; // no fresh mark
    const positions = { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, lastMark: 210, sector: 'Technology' } };
    const r = computeExecution({ decision: { verb: 'SELL', ticker: 'AAPL' }, positions, cash: 90000, snapshot: frozenSnap });
    expect(r.ok).toBe(true);
    expect(r.receipt.markSource).toBe('carry_over');
    expect(r.mutation.cash).toBe(90000 + 50 * 210); // filled at last-good mark 210
    expect(r.mutation.positions.AAPL).toBeUndefined();
  });

  it('BUY of a symbol with no fresh mark is rejected_stale (entries stay fail-closed, no carry-over)', () => {
    const frozenSnap = { tickKey: 't', symbols: { AAPL: { complete: false, price: null } } };
    const r = computeExecution({ decision: { verb: 'BUY', ticker: 'AAPL' }, execSizeUsd: 5000, positions: {}, cash: 100000, snapshot: frozenSnap });
    expect(r).toMatchObject({ ok: false, status: 'rejected_stale', reason: 'no_mark' });
  });

  it('a zero mark never opens a position (M3 guard)', () => {
    const zeroSnap = { tickKey: 't', symbols: { AAPL: { complete: true, price: 0, sector: 'Technology' } } };
    const r = computeExecution({ decision: { verb: 'BUY', ticker: 'AAPL' }, execSizeUsd: 5000, positions: {}, cash: 100000, snapshot: zeroSnap });
    expect(r.ok).toBe(false);
    expect(r.status).toBe('rejected_stale');
  });

  it('TRIM over-sell CLAMPS to held shares (§4.1, Q4 hazard excluded)', () => {
    const snap = { ...SNAP, symbols: { AAPL: { complete: true, price: 220, sector: 'Technology' } } };
    const positions = { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, sector: 'Technology' } };
    const r = computeExecution({ decision: { verb: 'TRIM', ticker: 'AAPL' }, execSizeUsd: 99999, positions, cash: 90000, snapshot: snap });
    expect(r.receipt.shares).toBe(50); // clamped to held, never over-sold
    expect(r.receipt.clamped).toBe(true);
    expect(r.mutation.positions.AAPL).toBeUndefined(); // full exit after clamp
  });
});

describe('executeDecision — atomic transaction (§3.5)', () => {
  function seedBook(book = baseBook()) {
    return makeFakeDb({ 'mandates/m1': book });
  }
  const gatePass = { passed: true, execSizeUsd: 10000, gateOutcome: { rule: 'buy', passed: true } };

  it('executes a BUY: mutates money, bumps revision, clears openBatchId, counts liveness', async () => {
    const db = seedBook();
    const ref = db.collection('mandates').doc('m1');
    const r = await executeDecision(db, {
      mandateRef: ref, decisionId: 'd1', decision: { verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000 },
      gateResult: gatePass, envelope: ENV, snapshot: SNAP, submitMark: 200, currentSessionDate: '2026-08-12', now: NOW,
    });
    expect(r.status).toBe('executed');
    const book = db._store.get('mandates/m1');
    expect(book.portfolio.cash).toBe(90000);
    expect(book.portfolio.positions.AAPL.shares).toBe(50);
    expect(book.revision).toBe(6);
    expect(book.execState.openBatchId).toBe(null);
    expect(book.execState.submitted).toBe(1);
    expect(book.execState.executed).toBe(1);
    // within-slot idempotency stamp, written atomically with the money commit
    expect(book.execState.lastEvalTickKey).toBe('2026-08-12_open30');
    const dec = db._store.get('mandates/m1/decisions/d1');
    expect(dec.status).toBe('executed');
    expect(dec.fillMarkQuality).toBe('fresh');     // filled at the tick snapshot (rider)
    expect(dec.realizedPnl).toBe(0);
    expect(dec.executedShares).toBe(50);
  });

  it('records fillMarkQuality:carry_over when a frozen exit fills at the last-good mark (rider)', async () => {
    const db = makeFakeDb({ 'mandates/m1': baseBook({ portfolio: { cash: 90000, positions: { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, lastMark: 210, sector: 'Technology' } }, totalValue: 100500 } }) });
    const ref = db.collection('mandates').doc('m1');
    const frozenSnap = { tickKey: '2026-08-12_open30', symbols: { AAPL: { complete: false, price: null } } };
    const r = await executeDecision(db, {
      mandateRef: ref, decisionId: 'dx', decision: { verb: 'SELL', ticker: 'AAPL', sizeUsd: null },
      gateResult: { passed: true, execSizeUsd: null, gateOutcome: { rule: 'exit_lane', passed: true } },
      envelope: ENV, snapshot: frozenSnap, submitMark: null, currentSessionDate: '2026-08-12', now: NOW,
    });
    expect(r.status).toBe('executed');
    expect(db._store.get('mandates/m1/decisions/dx').fillMarkQuality).toBe('carry_over');
  });

  it('is exactly-once: a replay of the same decisionId no-ops (F2)', async () => {
    const db = seedBook();
    const ref = db.collection('mandates').doc('m1');
    const args = {
      mandateRef: ref, decisionId: 'd1', decision: { verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000 },
      gateResult: gatePass, envelope: ENV, snapshot: SNAP, submitMark: 200, currentSessionDate: '2026-08-12', now: NOW,
    };
    await executeDecision(db, args);
    const r2 = await executeDecision(db, args);
    expect(r2.idempotent).toBe(true);
    expect(db._store.get('mandates/m1').portfolio.cash).toBe(90000); // not double-applied
    expect(db._store.get('mandates/m1').revision).toBe(6);           // not double-bumped
  });

  it('a gate rejection records `gated`, mutates no money, still clears the gate', async () => {
    const db = seedBook();
    const ref = db.collection('mandates').doc('m1');
    const r = await executeDecision(db, {
      mandateRef: ref, decisionId: 'd2', decision: { verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000 },
      gateResult: { passed: false, rule: 'sector_cap', reason: 'sector_cap_exceeded', gateOutcome: { rule: 'sector_cap', passed: false } },
      envelope: ENV, snapshot: SNAP, submitMark: 200, currentSessionDate: '2026-08-12', now: NOW,
    });
    expect(r.status).toBe('gated');
    expect(db._store.get('mandates/m1').portfolio.cash).toBe(100000); // untouched
    expect(db._store.get('mandates/m1').revision).toBe(6);            // terminal transition bumps revision
    expect(db._store.get('mandates/m1').execState.openBatchId).toBe(null);
  });

  it('a stale baseRevision is rejected_stale, not applied', async () => {
    const db = seedBook(baseBook({ revision: 9 }));
    const ref = db.collection('mandates').doc('m1');
    const r = await executeDecision(db, {
      mandateRef: ref, decisionId: 'd3', decision: { verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000 },
      gateResult: gatePass, envelope: ENV, snapshot: SNAP, submitMark: 200, currentSessionDate: '2026-08-12', now: NOW,
    });
    expect(r.status).toBe('rejected_stale');
    expect(r.failCondition).toBe('base_revision');
    expect(db._store.get('mandates/m1').portfolio.cash).toBe(100000);
  });

  it('a price-drifted harvest is rejected_stale (P2-10)', async () => {
    const drifted = { tickKey: 't', symbols: { AAPL: { complete: true, price: 210, sector: 'Technology' } } };
    const db = seedBook();
    const ref = db.collection('mandates').doc('m1');
    const r = await executeDecision(db, {
      mandateRef: ref, decisionId: 'd4', decision: { verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000 },
      gateResult: gatePass, envelope: ENV, snapshot: drifted, submitMark: 200, currentSessionDate: '2026-08-12', now: NOW,
    });
    expect(r.status).toBe('rejected_stale');
    expect(r.failCondition).toBe('price_drift');
    expect(db._store.get('mandates/m1').portfolio.cash).toBe(100000); // no fill at a drifted price
  });
});
