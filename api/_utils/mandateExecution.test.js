// api/_utils/mandateExecution.test.js
// Spec 1 §3.5 / §4.1 / §3.3 — execution boundary, average-cost math, quantity
// clamps, the price-drift guard, and the exactly-once transaction.
//
// P3 friction reconciliation: the cap-tier model is ON by default (§4.1), so
// tests whose SUBJECT is basis arithmetic inject an explicit ZERO friction to
// keep their numbers exact; the friction-model behavior itself (tier pricing,
// default wiring, frictionPaidCum, conservation under friction) has its own
// describe block below.

import { describe, it, expect } from 'vitest';
import {
  bankersRound, executedPriceFor, driftBps, validateEnvelope,
  computeExecution, executeDecision,
} from './mandateExecution.js';
import { zeroFriction, frictionFor } from './mandateFrictionModel.js';
import { MANDATE_FRICTION_TIERS, MANDATE_FRICTION_MODEL_VERSION } from './mandateConfig.js';

// Explicit zero-friction injection for arithmetic-subject tests.
const ZERO = zeroFriction();

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
  it('explicit zero friction → executedPrice == mark (arithmetic baseline)', () => {
    expect(executedPriceFor('BUY', 200, ZERO)).toBe(200);
    expect(executedPriceFor('SELL', 200, ZERO)).toBe(200);
  });
  it('P3 cap-tier friction adjusts the price: buys pay more, sells receive less (§4.1)', () => {
    const mega = MANDATE_FRICTION_TIERS.mega; // 1 + 2 = 3 bps
    const fx = { slippageBps: mega.slippageBps, spreadProxyBps: mega.spreadProxyBps };
    expect(executedPriceFor('BUY', 200, fx)).toBeCloseTo(200 * (1 + 3 / 10000), 10);
    expect(executedPriceFor('SELL', 200, fx)).toBeCloseTo(200 * (1 - 3 / 10000), 10);
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
    const r = computeExecution({ decision: { verb: 'BUY', ticker: 'AAPL' }, execSizeUsd: 10000, positions: {}, cash: 100000, snapshot: SNAP, friction: ZERO });
    expect(r.ok).toBe(true);
    expect(r.mutation.positions.AAPL).toMatchObject({ shares: 50, costBasisTotal: 10000, avgCost: 200, sector: 'Technology' });
    expect(r.mutation.cash).toBe(90000);
    expect(r.receipt.executedSizeUsd).toBe(10000);
  });
  it('ADD blends the average cost', () => {
    const positions = { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, sector: 'Technology' } };
    const r = computeExecution({ decision: { verb: 'ADD', ticker: 'AAPL' }, execSizeUsd: 5000, positions, cash: 90000, snapshot: SNAP, friction: ZERO });
    expect(r.mutation.positions.AAPL.shares).toBe(75);
    expect(r.mutation.positions.AAPL.costBasisTotal).toBe(15000);
    expect(r.mutation.positions.AAPL.avgCost).toBe(200);
  });
  it('SELL full exit realizes P&L and removes the position', () => {
    const snap = { ...SNAP, symbols: { AAPL: { complete: true, price: 220, sector: 'Technology' } } };
    const positions = { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, sector: 'Technology' } };
    const r = computeExecution({ decision: { verb: 'SELL', ticker: 'AAPL' }, positions, cash: 90000, snapshot: snap, friction: ZERO });
    expect(r.mutation.positions.AAPL).toBeUndefined();
    expect(r.mutation.cash).toBe(90000 + 11000); // 50*220
    expect(r.receipt.realizedPnl).toBe(1000);     // 11000 proceeds - 10000 basis
  });
  it('TRIM reduces basis proportionally', () => {
    const snap = { ...SNAP, symbols: { AAPL: { complete: true, price: 220, sector: 'Technology' } } };
    const positions = { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, sector: 'Technology' } };
    const r = computeExecution({ decision: { verb: 'TRIM', ticker: 'AAPL' }, execSizeUsd: 2200, positions, cash: 90000, snapshot: snap, friction: ZERO });
    // wantShares = floor(2200/220)=10; deltaBasis = 10000*(10/50)=2000; realized = 2200-2000=200
    expect(r.mutation.positions.AAPL.shares).toBe(40);
    expect(r.mutation.positions.AAPL.costBasisTotal).toBe(8000);
    expect(r.receipt.realizedPnl).toBe(200);
    expect(r.receipt.clamped).toBe(false);
  });
  it('SELL of a FROZEN held symbol fills at the carry-over mark (C-21: never suppressed)', () => {
    const frozenSnap = { tickKey: 't', symbols: { AAPL: { complete: false, price: null } } }; // no fresh mark
    const positions = { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, lastMark: 210, sector: 'Technology' } };
    const r = computeExecution({ decision: { verb: 'SELL', ticker: 'AAPL' }, positions, cash: 90000, snapshot: frozenSnap, friction: ZERO });
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
      friction: ZERO, // arithmetic-subject test; friction-on coverage below
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
      friction: ZERO,
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

describe('P3 friction model — default wiring, honesty labels, conservation (§4.1/F14)', () => {
  const MEGA_SNAP = { tickKey: '2026-08-12_open30', symbols: { AAPL: { complete: true, price: 200, sector: 'Technology', marketCap: 3e12, priceAsOf: '2026-08-12T14:00:00Z' } } };

  it('friction defaults through the cap-tier model when no override is passed', () => {
    const r = computeExecution({ decision: { verb: 'BUY', ticker: 'AAPL' }, execSizeUsd: 10000, positions: {}, cash: 100000, snapshot: MEGA_SNAP });
    expect(r.ok).toBe(true);
    const mega = MANDATE_FRICTION_TIERS.mega;
    expect(r.receipt.friction.slippageBps).toBe(mega.slippageBps);
    expect(r.receipt.friction.spreadProxyBps).toBe(mega.spreadProxyBps);
    // Honesty labels survive with real numbers (D-15/O-3): proxy spread, idealized basis.
    expect(r.receipt.friction.spreadBasis).toBe('proxy');
    expect(r.receipt.friction.frictionBasis).toBe('idealized_no_market_impact');
    // Buys pay MORE than the mark: fewer shares per dollar than at zero friction.
    expect(r.receipt.executedPrice).toBeGreaterThan(200);
    expect(r.receipt.friction.frictionPaid).toBeGreaterThan(0);
  });

  it('unknown market cap prices at the WIDEST tier (fail-conservative)', () => {
    const noCap = { tickKey: 't', symbols: { AAPL: { complete: true, price: 200, sector: 'Technology' } } };
    const r = computeExecution({ decision: { verb: 'BUY', ticker: 'AAPL' }, execSizeUsd: 10000, positions: {}, cash: 100000, snapshot: noCap });
    expect(r.receipt.friction.slippageBps).toBe(MANDATE_FRICTION_TIERS.unknown.slippageBps);
    expect(r.receipt.friction.spreadProxyBps).toBe(MANDATE_FRICTION_TIERS.unknown.spreadProxyBps);
  });

  it('HOLD pays zero friction (no trade, nothing enters through cash)', () => {
    const r = computeExecution({ decision: { verb: 'HOLD', ticker: null }, positions: {}, cash: 100000, snapshot: MEGA_SNAP });
    expect(r.ok).toBe(true);
    expect(r.receipt.friction.frictionPaid).toBe(0);
    expect(r.mutation.cash).toBe(100000);
  });

  it('friction enters EXACTLY ONCE through cash: proceeds already net, receipt is reporting-only (F14)', () => {
    const positions = { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, sector: 'Technology' } };
    const r = computeExecution({ decision: { verb: 'SELL', ticker: 'AAPL' }, positions, cash: 90000, snapshot: MEGA_SNAP });
    const execPrice = r.receipt.executedPrice;
    expect(execPrice).toBeLessThan(200); // sells receive less
    // Cash moved by shares × execPrice exactly — frictionPaid is NOT deducted again.
    expect(r.mutation.cash).toBeCloseTo(90000 + 50 * execPrice, 2);
    // Gross reconstruction: net proceeds + frictionPaid ≈ mark value (added back once).
    expect(r.receipt.executedSizeUsd + r.receipt.friction.frictionPaid).toBeCloseTo(50 * 200, 1);
  });

  it('executeDecision with friction on: conservation invariant holds and frictionPaidCum accumulates', async () => {
    const db = makeFakeDb({ 'mandates/m1': baseBook() });
    const ref = db.collection('mandates').doc('m1');
    const r = await executeDecision(db, {
      mandateRef: ref, decisionId: 'fx1', decision: { verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000 },
      gateResult: { passed: true, execSizeUsd: 10000, gateOutcome: { rule: 'buy', passed: true } },
      envelope: ENV, snapshot: MEGA_SNAP, submitMark: 200, currentSessionDate: '2026-08-12', now: NOW,
    });
    expect(r.status).toBe('executed'); // value_reconcile invariant did NOT fire under friction
    const book = db._store.get('mandates/m1');
    expect(book.portfolio.frictionPaidCum).toBeGreaterThan(0);
    expect(book.portfolio.frictionPaidCum).toBeCloseTo(r.receipt.friction.frictionPaid, 2);
    expect(book.execState.staleRejectStreak).toBe(0);
  });
});

describe('CA-frozen symbols (§4.3/I7) — entries gated, exits at last-good', () => {
  const CA_SNAP = { tickKey: 't', symbols: { AAPL: { complete: true, price: 100, sector: 'Technology', marketCap: 3e12 } } }; // post-split fresh mark (÷2)
  const heldPreSplit = { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, lastMark: 200, sector: 'Technology' } };

  it('an ENTRY on a CA-frozen symbol is gated (never fills at the phantom mark)', () => {
    const r = computeExecution({
      decision: { verb: 'BUY', ticker: 'AAPL' }, execSizeUsd: 5000, positions: {}, cash: 100000,
      snapshot: CA_SNAP, caFrozen: new Set(['AAPL']),
    });
    expect(r).toMatchObject({ ok: false, status: 'gated', reason: 'suspected_ca' });
  });

  it('an EXIT on a CA-frozen symbol fills at the LAST-GOOD mark, not the adjusted fresh one (C-21 path)', () => {
    const r = computeExecution({
      decision: { verb: 'SELL', ticker: 'AAPL' }, positions: heldPreSplit, cash: 0,
      snapshot: CA_SNAP, caFrozen: new Set(['AAPL']), friction: ZERO,
    });
    expect(r.ok).toBe(true);
    expect(r.receipt.markSource).toBe('carry_over');
    expect(r.mutation.cash).toBe(50 * 200); // pre-split last-good, NOT 50 × 100 phantom
  });

  it('stale-rejection streak increments on rejected_stale and resets on a live fill (I9)', async () => {
    const db = makeFakeDb({ 'mandates/m1': baseBook({ revision: 9 }) });
    const ref = db.collection('mandates').doc('m1');
    const r1 = await executeDecision(db, {
      mandateRef: ref, decisionId: 's1', decision: { verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000 },
      gateResult: { passed: true, execSizeUsd: 10000, gateOutcome: { rule: 'buy', passed: true } },
      envelope: ENV, snapshot: SNAP, submitMark: 200, currentSessionDate: '2026-08-12', now: NOW,
    });
    expect(r1.status).toBe('rejected_stale');
    expect(db._store.get('mandates/m1').execState.staleRejectStreak).toBe(1);

    // Fix the revision (simulating the next tick's fresh base state) and fill.
    const cur = db._store.get('mandates/m1');
    db._store.set('mandates/m1', { ...cur, revision: ENV.baseRevision });
    const r2 = await executeDecision(db, {
      mandateRef: ref, decisionId: 's2', decision: { verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000 },
      gateResult: { passed: true, execSizeUsd: 10000, gateOutcome: { rule: 'buy', passed: true } },
      envelope: ENV, snapshot: SNAP, submitMark: 200, currentSessionDate: '2026-08-12', now: NOW, friction: ZERO,
    });
    expect(r2.status).toBe('executed');
    expect(db._store.get('mandates/m1').execState.staleRejectStreak).toBe(0);
  });
});

describe('sole peak writer (I6) — the execution txn NEVER writes HWM/drawdown', () => {
  it('an executed BUY leaves every peak field byte-identical (the close pass owns them)', async () => {
    const seeded = baseBook({
      portfolio: {
        cash: 100000, positions: {}, totalValue: 100000,
        lifetimeHighWaterMark: 123456, lifetimeDrawdownFromPeak: 0.07,
        quarterHighWaterMark: 111111, quarterDrawdownFromPeak: 0.03,
      },
    });
    const db = makeFakeDb({ 'mandates/m1': seeded });
    const ref = db.collection('mandates').doc('m1');
    const r = await executeDecision(db, {
      mandateRef: ref, decisionId: 'peaks1', decision: { verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000 },
      gateResult: { passed: true, execSizeUsd: 10000, gateOutcome: { rule: 'buy', passed: true } },
      envelope: ENV, snapshot: SNAP, submitMark: 200, currentSessionDate: '2026-08-12', now: NOW, friction: ZERO,
    });
    expect(r.status).toBe('executed');
    const book = db._store.get('mandates/m1');
    expect(book.portfolio.lifetimeHighWaterMark).toBe(123456);
    expect(book.portfolio.lifetimeDrawdownFromPeak).toBe(0.07);
    expect(book.portfolio.quarterHighWaterMark).toBe(111111);
    expect(book.portfolio.quarterDrawdownFromPeak).toBe(0.03);
  });
});

// ── P3 verification-pass regression guards (money findings 4/5 + entitlement substrate) ─

describe('frozen-exit friction tier + frozen-entry terminal (money review P3 findings 4/5)', () => {
  it('MONEY-4: a CA-frozen exit prices at the symbol\'s REAL cap tier from the original snapshot, never the widest', async () => {
    // FRZN: $30B (large tier 2+3 = 5bps) present on the tick snapshot, gap-frozen.
    const snap = { tickKey: 't', symbols: { FRZN: { complete: true, price: 95, sector: 'Energy', marketCap: 30e9 } } };
    const seeded = baseBook({
      revision: 4,
      portfolio: { ...baseBook().portfolio, cash: 0, positions: { FRZN: { shares: 200, costBasisTotal: 16000, avgCost: 80, lastMark: 90, lastMarkSource: 'close', sector: 'Energy' } } },
    });
    const db = makeFakeDb({ 'mandates/m1': seeded });
    const r = await executeDecision(db, {
      mandateRef: db.collection('mandates').doc('m1'), decisionId: 'fz1',
      decision: { verb: 'SELL', ticker: 'FRZN' },
      gateResult: { passed: true, gateOutcome: { rule: 'exit_lane', passed: true } },
      envelope: { ...ENV, baseRevision: 4 }, snapshot: snap, submitMark: 90,
      currentSessionDate: '2026-08-12', now: NOW, caFrozen: new Set(['FRZN']),
    });
    expect(r.status).toBe('executed');
    // Large tier 5bps on the carry-over mark 90 → 89.955; the old vSnap lookup
    // degraded to unknown 20bps → 89.82 ($27 undercredited on this exit).
    expect(r.decision.friction.slippageBps).toBe(2);
    expect(r.decision.friction.spreadProxyBps).toBe(3);
    expect(db._store.get('mandates/m1').portfolio.cash).toBe(17991);
  });

  it('MONEY-5: an ENTRY on a CA-frozen symbol terminates gated/suspected_ca — never rejected_stale (no I9 streak pollution)', async () => {
    const snap = { tickKey: 't', symbols: { FRZN: { complete: true, price: 95, sector: 'Energy', marketCap: 30e9 } } };
    const db = makeFakeDb({ 'mandates/m1': baseBook({ revision: 4 }) });
    const r = await executeDecision(db, {
      mandateRef: db.collection('mandates').doc('m1'), decisionId: 'fz2',
      decision: { verb: 'BUY', ticker: 'FRZN', sizeUsd: 5000 },
      gateResult: { passed: true, execSizeUsd: 5000, gateOutcome: { rule: 'buy', passed: true } }, // gate wrongly passed — the executor restates the freeze
      envelope: { ...ENV, baseRevision: 4 }, snapshot: snap, submitMark: 95,
      currentSessionDate: '2026-08-12', now: NOW, caFrozen: new Set(['FRZN']),
    });
    expect(r.status).toBe('gated');
    expect(r.failCondition).toBe('suspected_ca');
    expect(db._store.get('mandates/m1').execState.staleRejectStreak).toBe(0); // gated = live answer, streak reset — not +1
  });
});

describe('openedAt entitlement substrate (spec+money review P3 — the position knows when its holding began)', () => {
  it('a BUY creating a position stamps openedAt with the session date; a top-up preserves the ORIGINAL', () => {
    const first = computeExecution({
      decision: { verb: 'BUY', ticker: 'AAPL' }, execSizeUsd: 10000, positions: {}, cash: 100000,
      snapshot: SNAP, friction: ZERO, sessionDate: '2026-08-12',
    });
    expect(first.ok).toBe(true);
    expect(first.mutation.positions.AAPL.openedAt).toBe('2026-08-12');

    const topUp = computeExecution({
      decision: { verb: 'ADD', ticker: 'AAPL' }, execSizeUsd: 5000,
      positions: first.mutation.positions, cash: 90000,
      snapshot: SNAP, friction: ZERO, sessionDate: '2026-09-01',
    });
    expect(topUp.ok).toBe(true);
    expect(topUp.mutation.positions.AAPL.openedAt).toBe('2026-08-12'); // continuous holding keeps its origin
  });
  it('an exit-and-rebuy starts a NEW holding (fresh openedAt — not entitled to pre-rebuy actions)', () => {
    const held = { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, lastMark: 200, sector: 'Technology', openedAt: '2026-08-01' } };
    const out = computeExecution({
      decision: { verb: 'SELL', ticker: 'AAPL' }, positions: held, cash: 0,
      snapshot: SNAP, friction: ZERO, sessionDate: '2026-08-12',
    });
    expect(out.ok).toBe(true);
    expect(out.mutation.positions.AAPL).toBeUndefined();
    const rebuy = computeExecution({
      decision: { verb: 'BUY', ticker: 'AAPL' }, execSizeUsd: 5000, positions: out.mutation.positions, cash: out.mutation.cash,
      snapshot: SNAP, friction: ZERO, sessionDate: '2026-09-15',
    });
    expect(rebuy.mutation.positions.AAPL.openedAt).toBe('2026-09-15');
  });
});
