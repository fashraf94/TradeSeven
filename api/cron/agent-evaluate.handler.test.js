// api/cron/agent-evaluate.handler.test.js
//
// Containment M1 — HANDLER-LEVEL behavioral proof. Drives the REAL
// processAgentBattle (the smallest exported production orchestration unit) with
// mocked market data / tournament ledger / firebase init, and asserts that an
// unusable quote set produces NO scoreState/settlement write, releases the eval
// lock exactly once, emits only sanitized telemetry, and does not contaminate a
// concurrent valid battle — while valid quotes still score exactly as before.
//
// The CPU-passive path (battle.isCpu === true) is used because it reaches a real
// scoreState write via finalizeCronState + battleRef.update WITHOUT Haiku,
// intraday fetch, or swaps — so the guard's effect is observable end-to-end with
// a bounded mock surface.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn() }));

vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: vi.fn(async () => ({})),
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn(() => ({ candles: [], sessionDate: null })),
}));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null),
  excludeHeldByOthers: vi.fn(),
  excludeHeldSymbols: vi.fn(),
  reserveSymbol: vi.fn(),
  confirmSwap: vi.fn(),
  releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

const { processAgentBattle } = await import('./agent-evaluate.js');

const FLAT_VIEW = { everEnabled: false };

function baseBattle(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: 'battle-1',
    isCpu: true,
    activatedAt: now,
    agentId: 'agent-1',
    strategyPreset: 'balanced',
    timing: { tradingDays: [] },
    agentContext: {},
    // migration fields present so no migration write occurs before the guard
    executionMode: 'copilot', pendingProposal: null, proposalHistory: [], battleLedger: [],
    statusFeed: [], gameplanMeeting: null, gameplanMeetingHistory: [], chatExchanges: [],
    chatBudgetUsed: 0, dailyReviews: [], dailyGrades: {},
    trades: [],
    scoreState: { peakScore: 0, bankedBadgePoints: { total: 0 } },
    thresholdHistory: {},
    cronState: {
      evaluatingAt: null,
      vwapTicks: {}, intradayMomentum: {}, stagnationTicks: {},
      lastTickPrice: {}, lastTickTimestamp: {}, vwapFireGuard: {},
    },
    portfolio: {
      star: [{ symbol: 'AAPL', baseATR: 2.5, direction: null }],
      core: [], support: [],
      bench: { stocks: [], crypto: null },
      startingPrices: { AAPL: 149 },
    },
    opponent: { portfolio: { star: [], core: [], support: [], bench: { stocks: [], crypto: null }, startingPrices: {} } },
    ...overrides,
  };
}

function makeDb(battle) {
  const updates = [];
  const db = {
    collection() {
      return { doc: () => ({ update: async (payload) => { updates.push(payload); } }) };
    },
    runTransaction: async (cb) => cb({
      get: async () => ({ data: () => battle }),
      update: () => {},
    }),
  };
  return { db, updates };
}

// stub getStockAnalysisData: map symbol -> price object | null (omit) | 'throw'
function stubPrices(map) {
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => {
    const v = map[symbol];
    if (v === undefined || v === null) return {};
    if (v === 'throw') throw new Error('EODHD 401 Unauthorized');
    return { price: v, daily: [] };
  });
}

function keysOf(updates) { return updates.flatMap(u => Object.keys(u)); }
function hasScoreWrite(updates) { return keysOf(updates).some(k => k.startsWith('scoreState.')); }

beforeEach(() => { mocks.getStockAnalysisData.mockReset(); });

describe('agent-evaluate M1 — degraded quote sets never write settlement state', () => {
  it('empty quote set: only the lock release is written, sanitized telemetry, evaluated=0', async () => {
    const battle = baseBattle();
    const { db, updates } = makeDb(battle);
    const summary = { evaluated: 0, skipped: 0, held: 0, errors: 0 };
    const warns = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...a) => warns.push(a.join(' ')));

    stubPrices({}); // AAPL has no price
    await processAgentBattle(db, battle, summary, Date.now(), new Map(), FLAT_VIEW);
    warnSpy.mockRestore();

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ 'cronState.evaluatingAt': null }); // lock release ONLY
    expect(hasScoreWrite(updates)).toBe(false);
    expect(summary.degradedQuotes).toBe(1);
    expect(summary.evaluated).toBe(0);

    const msg = warns.find(w => w.includes('[degraded-quotes]'));
    expect(msg).toBeTruthy();
    expect(msg).toContain('battle=battle-1');
    expect(msg).toContain('AAPL');
    // sanitized: no URL, token, or full payload
    expect(msg).not.toMatch(/http|api_token|:\/\//i);
    expect(msg).not.toContain('{');
  });

  it('authentication-failure-shaped result (fetch throws): same no-write behavior', async () => {
    const battle = baseBattle();
    const { db, updates } = makeDb(battle);
    const summary = { evaluated: 0, skipped: 0 };
    stubPrices({ AAPL: 'throw' });
    await processAgentBattle(db, battle, summary, Date.now(), new Map(), FLAT_VIEW);
    expect(updates).toEqual([{ 'cronState.evaluatingAt': null }]);
    expect(hasScoreWrite(updates)).toBe(false);
    expect(summary.evaluated).toBe(0);
  });

  it('one missing required symbol: entire battle score update is skipped (no partial flat score)', async () => {
    const battle = baseBattle({
      portfolio: {
        star: [{ symbol: 'AAPL', baseATR: 2.5, direction: null }],
        core: [{ symbol: 'NVDA', baseATR: 2.5, direction: null }],
        support: [],
        bench: { stocks: [], crypto: null },
        startingPrices: { AAPL: 149, NVDA: 800 },
      },
    });
    const { db, updates } = makeDb(battle);
    const summary = { evaluated: 0 };
    stubPrices({ AAPL: { current: 150, previousClose: 149 } }); // NVDA missing
    await processAgentBattle(db, battle, summary, Date.now(), new Map(), FLAT_VIEW);
    expect(hasScoreWrite(updates)).toBe(false);
    expect(updates).toEqual([{ 'cronState.evaluatingAt': null }]);
    expect(summary.degradedQuotes).toBe(1);
  });

  it.each([
    ['zero', { current: 0 }],
    ['NaN', { current: NaN }],
    ['Infinity', { current: Infinity }],
    ['negative', { current: -5 }],
    ['synthetic-fallback', { current: 150, fallback: true }],
  ])('unusable value (%s): no settlement write', async (_label, price) => {
    const battle = baseBattle();
    const { db, updates } = makeDb(battle);
    const summary = { evaluated: 0 };
    stubPrices({ AAPL: price });
    await processAgentBattle(db, battle, summary, Date.now(), new Map(), FLAT_VIEW);
    expect(hasScoreWrite(updates)).toBe(false);
    expect(updates).toEqual([{ 'cronState.evaluatingAt': null }]);
  });
});

describe('agent-evaluate M1 — valid quotes still score, no cross-contamination', () => {
  it('valid complete quotes: scoreState written, evaluated++, guard does not fire', async () => {
    const battle = baseBattle();
    const { db, updates } = makeDb(battle);
    const summary = { evaluated: 0, held: 0 };
    stubPrices({ AAPL: { current: 150, previousClose: 149, changePercent: 0.67 } });
    await processAgentBattle(db, battle, summary, Date.now(), new Map(), FLAT_VIEW);

    expect(summary.degradedQuotes).toBeUndefined();
    expect(summary.evaluated).toBe(1);
    const merged = Object.assign({}, ...updates);
    expect(merged).toHaveProperty('scoreState.activeScore');
    expect(merged).toHaveProperty('scoreState.currentScore');
    expect(merged).toHaveProperty('scoreState.opponentScore');
    expect(merged['cronState.evaluatingAt']).toBeNull(); // lock finalized
  });

  it('degraded battle does not block a concurrent valid battle', async () => {
    const summary = { evaluated: 0, held: 0, skipped: 0 };

    const degraded = baseBattle({ id: 'degraded' });
    const dctx = makeDb(degraded);
    stubPrices({}); // no price
    await processAgentBattle(dctx.db, degraded, summary, Date.now(), new Map(), FLAT_VIEW);

    const valid = baseBattle({ id: 'valid' });
    const vctx = makeDb(valid);
    stubPrices({ AAPL: { current: 150, previousClose: 149 } });
    await processAgentBattle(vctx.db, valid, summary, Date.now(), new Map(), FLAT_VIEW);

    // degraded: lock release only, no score
    expect(hasScoreWrite(dctx.updates)).toBe(false);
    expect(dctx.updates).toEqual([{ 'cronState.evaluatingAt': null }]);
    // valid: scored
    expect(hasScoreWrite(vctx.updates)).toBe(true);
    expect(summary.evaluated).toBe(1);
    expect(summary.degradedQuotes).toBe(1);
  });
});

describe('agent-evaluate M1 — lock handling', () => {
  it('degraded exit releases the lock exactly once (no double release / no stuck lock)', async () => {
    const battle = baseBattle();
    const { db, updates } = makeDb(battle);
    const summary = {};
    stubPrices({});
    await processAgentBattle(db, battle, summary, Date.now(), new Map(), FLAT_VIEW);
    const releases = updates.filter(u => 'cronState.evaluatingAt' in u && u['cronState.evaluatingAt'] === null);
    expect(releases).toHaveLength(1);
  });

  it('lock already held by another process: skips with no write', async () => {
    const battle = baseBattle({ cronState: { evaluatingAt: new Date().toISOString(), vwapTicks: {}, intradayMomentum: {}, stagnationTicks: {}, lastTickPrice: {}, lastTickTimestamp: {}, vwapFireGuard: {} } });
    const { db, updates } = makeDb(battle);
    const summary = { skipped: 0 };
    stubPrices({ AAPL: { current: 150, previousClose: 149 } });
    await processAgentBattle(db, battle, summary, Date.now(), new Map(), FLAT_VIEW);
    expect(updates).toHaveLength(0);
    expect(summary.skipped).toBe(1);
  });
});
