// api/cron/mandate-evaluate.test.js
// Spec 1 §3.1 — the eval pipeline end-to-end (snapshot → prompt → model → gate →
// execute), driven with a fake db + an injected model call (no network).

import { describe, it, expect, vi } from 'vitest';
import { unionHeldTickers, runBookEval, telemetryPatch } from './mandate-evaluate.js';

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
    // P3 friction (§4.1): the fixture symbol has no marketCap → widest tier
    // (20bps) → execPrice 200.40; the BUY is sized DOWN to fit its $10,000
    // (cash moves exactly $10,000; shares absorb the friction).
    expect(book.portfolio.cash).toBe(90000);
    expect(book.portfolio.positions.AAPL.shares).toBe(49.900199);
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

describe('P3 — quarantine exit-only, gap-frozen symbols, regime, telemetry', () => {
  it('a QUARANTINED book: the tool schema is restricted and a smuggled BUY dies as bad_decision', async () => {
    const quarantinedBook = bookFixture({ health: { quarantined: true, consecutiveEvalFailures: 5 } });
    const db = makeFakeDb({ 'mandates/m1': quarantinedBook });
    const ref = db.collection('mandates').doc('m1');
    let toolVerbs = null;
    const spyModel = async (seat, content) => {
      toolVerbs = content.tools[0].input_schema.properties.verb.enum;
      return { decision: { ok: true, input: { verb: 'BUY', ticker: 'AAPL', sizeUsd: 1000, rationale: 'x' } }, usage: null };
    };
    const r = await runBookEval(db, {
      book: { _id: 'm1', ...quarantinedBook }, mandateRef: ref, vintage: VINTAGE, snapshot: SNAP,
      sessionDate: '2026-08-12', slot: 'open30', now: NOW, callModel: spyModel,
    });
    expect(toolVerbs).toEqual(['SELL', 'TRIM', 'HOLD']); // the model never even sees BUY
    expect(r.outcome).toBe('bad_decision');              // and a smuggled BUY is rejected at normalize
  });

  it('a quarantined book still EXITS freely (C-21): SELL executes', async () => {
    const held = bookFixture({
      health: { quarantined: true },
      portfolio: { cash: 90000, positions: { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, lastMark: 200, sector: 'Technology' } }, totalValue: 100000, initialValue: 100000, quarterDrawdownFromPeak: 0 },
    });
    const db = makeFakeDb({ 'mandates/m1': held });
    const ref = db.collection('mandates').doc('m1');
    const r = await runBookEval(db, {
      book: { _id: 'm1', ...held }, mandateRef: ref, vintage: VINTAGE, snapshot: SNAP,
      sessionDate: '2026-08-12', slot: 'open30', now: NOW,
      callModel: fakeModel({ verb: 'SELL', ticker: 'AAPL', rationale: 'de-risk' }),
    });
    expect(r.status).toBe('executed');
    expect(db._store.get('mandates/m1').portfolio.positions.AAPL).toBeUndefined();
  });

  it('a gap-frozen symbol (÷2 overnight, no feed): SELL fills at LAST-GOOD, never the phantom mark', async () => {
    const preSplitHeld = bookFixture({
      portfolio: { cash: 0, positions: { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, lastMark: 400, sector: 'Technology' } }, totalValue: 20000, initialValue: 20000, quarterDrawdownFromPeak: 0 },
    });
    // Fresh mark 200 vs lastMark 400 → exactly ÷2, no CA in the snapshot feed.
    const db = makeFakeDb({ 'mandates/m1': preSplitHeld });
    const ref = db.collection('mandates').doc('m1');
    const r = await runBookEval(db, {
      book: { _id: 'm1', ...preSplitHeld }, mandateRef: ref, vintage: VINTAGE, snapshot: SNAP,
      sessionDate: '2026-08-12', slot: 'open30', now: NOW,
      callModel: fakeModel({ verb: 'SELL', ticker: 'AAPL', rationale: 'exit' }),
    });
    expect(r.status).toBe('executed');
    const book = db._store.get('mandates/m1');
    // Last-good fill at 400 (NOT the ÷2 phantom 200), less the widest-tier
    // 20bps friction — a frozen symbol has no snapshot marketCap, so the exit
    // prices fail-conservative: 50 × 400 × (1 − 0.002) = 19,960.
    expect(book.portfolio.cash).toBe(19960);
    const dec = db._store.get(`mandates/m1/decisions/${r.decisionId}`);
    expect(dec.fillMarkQuality).toBe('carry_over');
  });

  it('a gap-frozen symbol: BUY is gated as suspected_ca', async () => {
    const preSplitHeld = bookFixture({
      portfolio: { cash: 50000, positions: { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, lastMark: 400, sector: 'Technology' } }, totalValue: 70000, initialValue: 70000, quarterDrawdownFromPeak: 0 },
    });
    const db = makeFakeDb({ 'mandates/m1': preSplitHeld });
    const ref = db.collection('mandates').doc('m1');
    const r = await runBookEval(db, {
      book: { _id: 'm1', ...preSplitHeld }, mandateRef: ref, vintage: VINTAGE, snapshot: SNAP,
      sessionDate: '2026-08-12', slot: 'open30', now: NOW,
      callModel: fakeModel({ verb: 'ADD', ticker: 'AAPL', sizeUsd: 1000, rationale: 'double down' }),
    });
    expect(r.status).toBe('gated');
  });

  it('regime data reaches the prompt context (§6.1) and usage is returned for telemetry (§6.2)', async () => {
    const db = makeFakeDb({ 'mandates/m1': bookFixture() });
    const ref = db.collection('mandates').doc('m1');
    let sawRegime = false;
    const model = async (seat, content) => {
      sawRegime = content.messages[0].content.includes('Regime: risk_on');
      return { decision: { ok: true, input: { verb: 'HOLD', rationale: 'wait' } }, usage: { input_tokens: 9000, output_tokens: 300 } };
    };
    const r = await runBookEval(db, {
      book: { _id: 'm1', ...bookFixture() }, mandateRef: ref, vintage: VINTAGE, snapshot: SNAP,
      sessionDate: '2026-08-12', slot: 'open30', now: NOW, callModel: model,
      regime: { regime: 'risk_on', regimeAsOf: '2026-08-12T14:00:00.000Z' },
    });
    expect(sawRegime).toBe(true);
    expect(r.usage).toEqual({ input_tokens: 9000, output_tokens: 300 });
  });
});

describe('telemetryPatch — §6.2 accumulation', () => {
  const priced = { tokensIn: 12000, tokensOut: 600, cacheHitTokens: 0, estUsd: 0.015, priced: true };
  it('accumulates within the month and the day', () => {
    const book = { costTelemetry: { monthKey: '2026-08', tokensIn: 100, tokensOut: 10, estUsd: 0.001, cacheHitTokens: 0, unpricedCalls: 0, today: { date: '2026-08-12', evalCount: 1, tokensIn: 100, tokensOut: 10, estUsd: 0.001, cacheHitTokens: 0 } } };
    const p = telemetryPatch(book, '2026-08-12', priced);
    expect(p.costTelemetry.tokensIn).toBe(12100);
    expect(p.costTelemetry.estUsd).toBeCloseTo(0.016, 9);
    expect(p.costTelemetry.today.evalCount).toBe(2);
    expect(p.costTelemetry.today.tokensIn).toBe(12100);
  });
  it('resets on month rollover and day rollover', () => {
    const book = { costTelemetry: { monthKey: '2026-07', tokensIn: 999999, estUsd: 9, today: { date: '2026-07-31', evalCount: 9, tokensIn: 5, tokensOut: 5, estUsd: 1 } } };
    const p = telemetryPatch(book, '2026-08-03', priced);
    expect(p.costTelemetry.tokensIn).toBe(12000);   // fresh month
    expect(p.costTelemetry.monthKey).toBe('2026-08');
    expect(p.costTelemetry.today).toMatchObject({ date: '2026-08-03', evalCount: 1, tokensIn: 12000 });
  });
  it('an unpriced call counts tokens and increments unpricedCalls (never a silent $0 understatement)', () => {
    const p = telemetryPatch({ costTelemetry: { monthKey: '2026-08', unpricedCalls: 0 } }, '2026-08-12', { tokensIn: 500, tokensOut: 50, cacheHitTokens: 0, estUsd: null, priced: false });
    expect(p.costTelemetry.unpricedCalls).toBe(1);
    expect(p.costTelemetry.tokensIn).toBe(500);
    expect(p.costTelemetry.estUsd).toBe(0); // unchanged, flagged via unpricedCalls
  });
});
