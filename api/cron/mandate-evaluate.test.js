// api/cron/mandate-evaluate.test.js
// Spec 1 §3.1 — the eval pipeline end-to-end (snapshot → prompt → model → gate →
// execute), driven with a fake db + an injected model call (no network).

import { describe, it, expect, vi } from 'vitest';
import { unionHeldTickers, runBookEval } from './mandate-evaluate.js';

// Fake Firestore with subcollections, transactions, and ref.id.
function makeFakeDb(seed = {}) {
  const store = new Map(Object.entries(seed));
  function ref(path) {
    const id = path.split('/').pop();
    return {
      path, id,
      collection: (sub) => ({ doc: (docId) => ref(`${path}/${sub}/${docId}`) }),
      async get() { const d = store.get(path); return { exists: d !== undefined, id, data: () => d }; },
      async set(data, opts) {
        if (opts?.merge && store.has(path)) {
          const cur = store.get(path);
          const next = { ...cur };
          for (const [k, v] of Object.entries(data)) {
            next[k] = (v && typeof v === 'object' && !Array.isArray(v) && cur[k] && typeof cur[k] === 'object') ? { ...cur[k], ...v } : v;
          }
          store.set(path, next);
        } else store.set(path, data);
      },
      async update(patch) {
        const cur = store.get(path) || {};
        const next = { ...cur };
        for (const [k, v] of Object.entries(patch)) {
          if (k.includes('.')) { const [a, b] = k.split('.'); next[a] = { ...(next[a] || {}), [b]: v }; }
          else next[k] = v;
        }
        store.set(path, next);
      },
    };
  }
  return {
    _store: store,
    collection: (c) => ({ doc: (id) => ref(`${c}/${id}`) }),
    doc: (p) => ref(p),
    async runTransaction(fn) {
      return fn({ get: (r) => r.get(), set: (r, d) => r.set(d), update: (r, d) => r.update(d) });
    },
  };
}

const VINTAGE = {
  codeId: 'analyst',
  displayVintage: 'Fundamental Investor v2',
  archetypeContent: { displayName: 'Fundamental Investor', identity: { reveal: 'You buy good businesses.', voice: 'v' }, character: { factors: {} } },
  gateConfig: { cashFloorPct: 0.02, minPositions: 5, maxPositions: 15, maxSinglePositionWeightPct: 0.35, sectorConcentrationCap: 0.30, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] },
  modelSeat: { model: 'claude-haiku-4-5-20251001', params: { temperature: 0.7, maxTokens: 600 } },
};
const SNAP = { tickKey: '2026-08-12_open30', symbols: { AAPL: { complete: true, price: 200, sector: 'Technology' }, XOM: { complete: true, price: 100, sector: 'Energy' } } };
const NOW = new Date('2026-08-12T14:05:00Z');

function bookFixture(overrides = {}) {
  return {
    revision: 5, quarterKey: 'm1:1', status: 'active', voided: false, cadenceTier: 'fast',
    vintageRef: 'archetypeVintages/analyst_x',
    portfolio: { cash: 100000, positions: {}, totalValue: 100000, initialValue: 100000, quarterDrawdownFromPeak: 0 },
    quarterStartAt: new Date('2026-07-01T00:00:00Z'),
    execState: { submitted: 0, executed: 0, openBatchId: null },
    ...overrides,
  };
}
const fakeModel = (input) => vi.fn(async () => ({ decision: { ok: true, input }, usage: null }));

describe('unionHeldTickers', () => {
  it('unions position keys across active books', () => {
    const held = unionHeldTickers([
      { portfolio: { positions: { AAPL: {}, MSFT: {} } } },
      { portfolio: { positions: { AAPL: {}, XOM: {} } } },
      { portfolio: {} },
    ]);
    expect(held.sort()).toEqual(['AAPL', 'MSFT', 'XOM']);
  });
});

describe('runBookEval — end-to-end pipeline', () => {
  it('a BUY decision executes: money moves, decision receipt written', async () => {
    const db = makeFakeDb({ 'mandates/m1': bookFixture() });
    const ref = db.collection('mandates').doc('m1');
    const r = await runBookEval(db, {
      book: { _id: 'm1', ...bookFixture() }, mandateRef: ref, vintage: VINTAGE, snapshot: SNAP,
      sessionDate: '2026-08-12', slot: 'open30', now: NOW,
      callModel: fakeModel({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'quality' }),
    });
    expect(r.outcome).toBe('terminal');
    expect(r.status).toBe('executed');
    const book = db._store.get('mandates/m1');
    expect(book.portfolio.cash).toBe(90000);
    expect(book.portfolio.positions.AAPL.shares).toBe(50);
    expect(book.revision).toBe(6);
  });

  it('a HOLD decision reaches an executed terminal with no money change', async () => {
    const db = makeFakeDb({ 'mandates/m1': bookFixture() });
    const ref = db.collection('mandates').doc('m1');
    const r = await runBookEval(db, {
      book: { _id: 'm1', ...bookFixture() }, mandateRef: ref, vintage: VINTAGE, snapshot: SNAP,
      sessionDate: '2026-08-12', slot: 'open30', now: NOW,
      callModel: fakeModel({ verb: 'HOLD', rationale: 'nothing compelling' }),
    });
    expect(r.status).toBe('executed');
    expect(db._store.get('mandates/m1').portfolio.cash).toBe(100000);
  });

  it('a BUY of a symbol absent from the snapshot is gated (universe)', async () => {
    const db = makeFakeDb({ 'mandates/m1': bookFixture() });
    const ref = db.collection('mandates').doc('m1');
    const r = await runBookEval(db, {
      book: { _id: 'm1', ...bookFixture() }, mandateRef: ref, vintage: VINTAGE, snapshot: SNAP,
      sessionDate: '2026-08-12', slot: 'open30', now: NOW,
      callModel: fakeModel({ verb: 'BUY', ticker: 'TSLA', sizeUsd: 5000, rationale: 'x' }),
    });
    expect(r.status).toBe('gated');
    expect(db._store.get('mandates/m1').portfolio.cash).toBe(100000);
  });

  it('a slow-tier book is skipped at a slot it does not evaluate', async () => {
    const db = makeFakeDb({ 'mandates/m1': bookFixture({ cadenceTier: 'slow' }) });
    const ref = db.collection('mandates').doc('m1');
    const model = fakeModel({ verb: 'HOLD', rationale: 'x' });
    const r = await runBookEval(db, {
      book: { _id: 'm1', ...bookFixture({ cadenceTier: 'slow' }) }, mandateRef: ref, vintage: VINTAGE, snapshot: SNAP,
      sessionDate: '2026-08-12', slot: 'preClose', now: NOW, callModel: model,
    });
    expect(r.outcome).toBe('skipped_tier');
    expect(model).not.toHaveBeenCalled(); // no model call for an ineligible tier
  });

  it('exactly-once: the deterministic decisionId makes a replay a no-op', async () => {
    const db = makeFakeDb({ 'mandates/m1': bookFixture() });
    const ref = db.collection('mandates').doc('m1');
    const args = {
      book: { _id: 'm1', ...bookFixture() }, mandateRef: ref, vintage: VINTAGE, snapshot: SNAP,
      sessionDate: '2026-08-12', slot: 'open30', now: NOW,
      callModel: fakeModel({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'x' }),
    };
    await runBookEval(db, args);
    // Re-run against the SAME base state (revision unchanged in the passed book): same requestId → replay no-ops.
    const r2 = await runBookEval(db, { ...args, book: { _id: 'm1', ...bookFixture() } });
    expect(r2.status).toBe('executed'); // returns the committed decision's status
    expect(db._store.get('mandates/m1').portfolio.cash).toBe(90000); // not double-applied
    expect(db._store.get('mandates/m1').revision).toBe(6);
  });
});
