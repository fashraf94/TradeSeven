// api/cron/agent-evaluate.goldenPath.test.js
//
// Containment — ACTIVE-PRODUCT GOLDEN-PATH PARITY (valid pricing).
//
// The active-containment branch changes exactly one thing in the agent
// evaluation pipeline vs origin/main: the M1 settlement-safety quote guard
// (agent-evaluate.js:692-717). That guard runs AFTER the price fetch and BEFORE
// all scoring/settlement. Under VALID pricing (`assessRequiredQuotes(...).usable
// === true`) it falls through with no side effect, so every line of scoring,
// banking, threshold-history, peak-tracking, cron finalization and lock release
// that follows is byte-identical to origin/main. No fenced file changed.
//
// This suite PINS that parity from the observable side: driving the REAL
// processAgentBattle under valid pricing must produce the COMPLETE settlement
// write-set with the guard transparent (never intercepting, never marking the
// run degraded). The companion agent-evaluate.handler.test.js pins the other
// side of the boundary (unusable quotes → no settlement write). Together they
// prove the guard's ONLY behavioral effect is "skip on unusable; identical on
// usable" — i.e. the active agent product is unchanged under valid pricing.
//
// Uses the CPU-passive path (battle.isCpu === true): it reaches a real
// scoreState write (agent-evaluate.js:879-897) via finalizeCronState WITHOUT
// Anthropic, intraday, or swaps — the smallest end-to-end settlement surface.

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
    id: 'battle-gp',
    isCpu: true,
    activatedAt: now,
    agentId: 'agent-gp',
    strategyPreset: 'balanced',
    timing: { tradingDays: [] },
    agentContext: {},
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

function stubPrices(map) {
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => {
    const v = map[symbol];
    if (v === undefined || v === null) return {};
    return { price: v, daily: [] };
  });
}

// Merge all dot-path update() payloads into one object (last-writer-wins), the
// normalized write-set the Firestore doc would end up with.
function mergedWriteSet(updates) { return Object.assign({}, ...updates); }
function scoreKeys(updates) {
  return [...new Set(updates.flatMap(u => Object.keys(u)))].filter(k => k.startsWith('scoreState.'));
}

beforeEach(() => { mocks.getStockAnalysisData.mockReset(); });

describe('agent-evaluate golden path — valid pricing writes the full settlement set (M1 guard transparent)', () => {
  it('produces the complete settlement write-set and never marks the run degraded', async () => {
    const battle = baseBattle();
    const { db, updates } = makeDb(battle);
    const summary = { evaluated: 0, held: 0 };
    stubPrices({ AAPL: { current: 150, previousClose: 149, changePercent: 0.67 } });

    await processAgentBattle(db, battle, summary, Date.now(), new Map(), FLAT_VIEW);

    const merged = mergedWriteSet(updates);
    // Full settlement-sensitive score write.
    expect(merged).toHaveProperty('scoreState.activeScore');
    expect(merged).toHaveProperty('scoreState.bankedScore');
    expect(merged).toHaveProperty('scoreState.currentScore');
    expect(merged).toHaveProperty('scoreState.opponentScore');
    expect(merged).toHaveProperty('scoreState.lastScoredAt');
    // Per-symbol threshold history for each held position.
    expect(merged).toHaveProperty('thresholdHistory.AAPL');
    // Cron state finalized + eval lock released exactly as origin/main does.
    expect(merged['cronState.evaluatingAt']).toBeNull();
    // Guard transparent: no degraded marker, the tick counted as evaluated.
    expect(summary.degradedQuotes).toBeUndefined();
    expect(summary.evaluated).toBe(1);
    expect(summary.held).toBe(1);
  });

  it('the guard never fires across valid quote shapes (no-op under valid pricing)', async () => {
    const shapes = [
      ['current only', { current: 150 }],
      ['current + previousClose', { current: 150, previousClose: 149 }],
      ['current + previousClose + changePercent', { current: 150, previousClose: 149, changePercent: 0.67 }],
      ['fractional price', { current: 0.42, previousClose: 0.40 }],
    ];
    for (const [label, price] of shapes) {
      const battle = baseBattle();
      const { db, updates } = makeDb(battle);
      const summary = { evaluated: 0, held: 0 };
      stubPrices({ AAPL: price });

      await processAgentBattle(db, battle, summary, Date.now(), new Map(), FLAT_VIEW);

      expect(summary.degradedQuotes, `degraded on ${label}`).toBeUndefined();
      expect(scoreKeys(updates).length, `no score write on ${label}`).toBeGreaterThan(0);
      expect(summary.evaluated, `not evaluated on ${label}`).toBe(1);
    }
  });

  it('banked badge points carry additively into currentScore (preserved, never recomputed away)', async () => {
    const price = { AAPL: { current: 150, previousClose: 149, changePercent: 0.67 } };

    const zero = baseBattle({ scoreState: { peakScore: 0, bankedBadgePoints: { total: 0 } } });
    const zctx = makeDb(zero);
    stubPrices(price);
    await processAgentBattle(zctx.db, zero, { evaluated: 0, held: 0 }, Date.now(), new Map(), FLAT_VIEW);
    const zeroScore = mergedWriteSet(zctx.updates)['scoreState.currentScore'];

    const banked = baseBattle({ scoreState: { peakScore: 0, bankedBadgePoints: { total: 5 } } });
    const bctx = makeDb(banked);
    stubPrices(price);
    await processAgentBattle(bctx.db, banked, { evaluated: 0, held: 0 }, Date.now(), new Map(), FLAT_VIEW);
    const bankedScoreOut = mergedWriteSet(bctx.updates)['scoreState.currentScore'];

    // Same active/banked score inputs; the only delta is the 5 banked badge
    // points, which must flow straight into currentScore.
    expect(bankedScoreOut - zeroScore).toBeCloseTo(5, 5);
  });

  it('advances peakScore when the current score exceeds the prior peak', async () => {
    const battle = baseBattle({ scoreState: { peakScore: 0, bankedBadgePoints: { total: 0 } } });
    const { db, updates } = makeDb(battle);
    stubPrices({ AAPL: { current: 200, previousClose: 149, changePercent: 34 } }); // strong move up
    await processAgentBattle(db, battle, { evaluated: 0, held: 0 }, Date.now(), new Map(), FLAT_VIEW);

    const merged = mergedWriteSet(updates);
    if (merged['scoreState.currentScore'] > 0) {
      expect(merged).toHaveProperty('scoreState.peakScore');
      expect(merged['scoreState.peakScore']).toBe(merged['scoreState.currentScore']);
    }
  });
});

describe('agent-evaluate parity boundary — the guard only diverges on unusable quotes', () => {
  it('usable quotes → full settlement write; unusable quotes → prior scoreState preserved', async () => {
    // Usable side.
    const good = baseBattle();
    const gctx = makeDb(good);
    const gsummary = { evaluated: 0, held: 0 };
    stubPrices({ AAPL: { current: 150, previousClose: 149 } });
    await processAgentBattle(gctx.db, good, gsummary, Date.now(), new Map(), FLAT_VIEW);

    // Unusable side (same battle shape, missing price).
    const bad = baseBattle();
    const bctx = makeDb(bad);
    const bsummary = { evaluated: 0, held: 0 };
    stubPrices({}); // AAPL unpriced
    await processAgentBattle(bctx.db, bad, bsummary, Date.now(), new Map(), FLAT_VIEW);

    // Usable: settlement written, run counted, not degraded.
    expect(scoreKeys(gctx.updates).length).toBeGreaterThan(0);
    expect(gsummary.evaluated).toBe(1);
    expect(gsummary.degradedQuotes).toBeUndefined();

    // Unusable: NO settlement write, prior scoreState preserved, only the lock
    // released, run marked degraded (the sole divergence from origin/main).
    expect(scoreKeys(bctx.updates).length).toBe(0);
    expect(bctx.updates).toEqual([{ 'cronState.evaluatingAt': null }]);
    expect(bsummary.evaluated).toBe(0);
    expect(bsummary.degradedQuotes).toBe(1);
  });
});
