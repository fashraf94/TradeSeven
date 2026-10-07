// api/cron/agent-evaluate.qw1.test.js
//
// EODHD Quick Wins QW-1 — the four evaluator price sites (build report
// docs/audits/20261007_BUILD_EODHD_QUICK_WINS.md §2).
//
//   • FLAG OFF: every site still passes `forceRefresh: true` — proven three
//     ways: the helper's flag-off value, a source scan that every one of the
//     four sites (and only those) routes through the helper, and the REAL
//     processAgentBattle (CPU-passive path, the goldenPath harness) observed
//     calling the price fetch with exactly the pre-build options.
//   • FLAG ON: the same sites ask for the session-current policy instead and
//     never force a refresh; the real-time quote is still requested.
//   • The policy literal is local to agent-evaluate (hermetic marketDataCache
//     mocks omit it); it is pinned equal to DAILY_POLICY_SESSION_CURRENT here.
//
// The flag is mocked through a getter over hoisted state, so one file drives
// both values against the same imported module (the flag is read at call time).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const flag = vi.hoisted(() => ({ on: false }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get EODHD_QUICK_WINS_ENABLED() { return flag.on; } };
});

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

const { processAgentBattle, evaluatorQuoteOptions, EVALUATOR_DAILY_POLICY } = await import('./agent-evaluate.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(HERE, 'agent-evaluate.js'), 'utf8');
// CODE only (the rsPercentileNull.test.js idiom): comments may quote the old call.
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const FORCED = { forceRefresh: true, fields: ['daily', 'price'] };

beforeEach(() => {
  flag.on = false;
  mocks.getStockAnalysisData.mockReset();
});

describe('QW-1 — the shared options helper', () => {
  it('flag OFF → exactly the pre-build forced refresh', () => {
    expect(evaluatorQuoteOptions()).toEqual(FORCED);
  });

  it('flag ON → the session-current policy, no forced refresh, the quote still requested', () => {
    flag.on = true;
    const opts = evaluatorQuoteOptions();
    expect(opts).toEqual({ fields: ['daily', 'price'], dailyPolicy: 'session_current' });
    expect(opts).not.toHaveProperty('forceRefresh');
  });

  it('the local policy literal equals marketDataCache DAILY_POLICY_SESSION_CURRENT', async () => {
    const real = await vi.importActual('../_utils/marketDataCache.js');
    expect(EVALUATOR_DAILY_POLICY).toBe(real.DAILY_POLICY_SESSION_CURRENT);
  });
});

describe('QW-1 — source: all four sites, and only those, route through the helper', () => {
  it('exactly four getStockAnalysisData( calls, each passing evaluatorQuoteOptions()', () => {
    const calls = CODE.match(/getStockAnalysisData\([^)]*\)/g) || [];
    expect(calls).toHaveLength(4);
    for (const c of calls) expect(c).toMatch(/^getStockAnalysisData\((symbol|ticker), evaluatorQuoteOptions\(\)$/);
  });

  it('the forced-refresh literal survives ONLY as the helper\'s flag-off branch', () => {
    expect(CODE.match(/forceRefresh:\s*true/g)).toHaveLength(1);
    expect(CODE).toContain(": { forceRefresh: true, fields: ['daily', 'price'] };");
  });

  it('the flag read sits inside a fail-safe (a hermetic featureFlags mock must read as OFF, never throw)', () => {
    expect(CODE).toMatch(/function eodhdQuickWinsOn\(\)\s*\{\s*try\s*\{\s*return EODHD_QUICK_WINS_ENABLED === true;\s*\}\s*catch\s*\{\s*return false;\s*\}\s*\}/);
  });
});

// ── The REAL processAgentBattle (agent-evaluate.goldenPath.test.js harness) ──
function baseBattle() {
  const now = new Date().toISOString();
  return {
    id: 'battle-qw1', isCpu: true, activatedAt: now, agentId: 'agent-qw1', strategyPreset: 'balanced',
    timing: { tradingDays: [] }, agentContext: {},
    executionMode: 'copilot', pendingProposal: null, proposalHistory: [], battleLedger: [],
    statusFeed: [], gameplanMeeting: null, gameplanMeetingHistory: [], chatExchanges: [],
    chatBudgetUsed: 0, dailyReviews: [], dailyGrades: {}, trades: [],
    scoreState: { peakScore: 0, bankedBadgePoints: { total: 0 } }, thresholdHistory: {},
    cronState: { evaluatingAt: null, vwapTicks: {}, intradayMomentum: {}, stagnationTicks: {}, lastTickPrice: {}, lastTickTimestamp: {}, vwapFireGuard: {} },
    portfolio: {
      star: [{ symbol: 'AAPL', baseATR: 2.5, direction: null }], core: [{ symbol: 'MSFT', baseATR: 2.5, direction: null }], support: [],
      bench: { stocks: [{ symbol: 'NVDA', baseATR: 3 }], crypto: null }, startingPrices: { AAPL: 149, MSFT: 400 },
    },
    opponent: { portfolio: { star: [{ symbol: 'KO', baseATR: 1.5 }], core: [], support: [], bench: { stocks: [], crypto: null }, startingPrices: {} } },
  };
}
function makeDb(battle) {
  const updates = [];
  return {
    updates,
    db: {
      collection() { return { doc: () => ({ update: async (p) => { updates.push(p); } }) }; },
      runTransaction: async (cb) => cb({ get: async () => ({ data: () => battle }), update: () => {} }),
    },
  };
}
function stubPrices() {
  mocks.getStockAnalysisData.mockImplementation(async () => ({ price: { current: 150, previousClose: 149, changePercent: 0.6 }, daily: [] }));
}

describe('QW-1 — the REAL tick (site :1068 for every symbol of the battle)', () => {
  it('flag OFF: every price fetch passes exactly { forceRefresh: true, fields: [daily, price] }', async () => {
    stubPrices();
    const battle = baseBattle();
    const { db } = makeDb(battle);
    await processAgentBattle(db, battle, { evaluated: 0, held: 0 }, Date.now(), new Map(), { everEnabled: false });
    const calls = mocks.getStockAnalysisData.mock.calls;
    expect(calls.map(([s]) => s).sort()).toEqual(['AAPL', 'BTC-USD.CC', 'KO', 'MSFT', 'NVDA', 'QQQ', 'SPY'].sort());
    for (const [, opts] of calls) expect(opts).toEqual(FORCED);
  });

  it('flag ON: the same symbols, each with the session-current policy and no forced refresh', async () => {
    flag.on = true;
    stubPrices();
    const battle = baseBattle();
    const { db } = makeDb(battle);
    await processAgentBattle(db, battle, { evaluated: 0, held: 0 }, Date.now(), new Map(), { everEnabled: false });
    const calls = mocks.getStockAnalysisData.mock.calls;
    expect(calls).toHaveLength(7);
    for (const [, opts] of calls) expect(opts).toEqual({ fields: ['daily', 'price'], dailyPolicy: 'session_current' });
  });

  // WIRING identity only: both flag states get the SAME mocked fetch result, so this
  // proves no other branch of the tick reads the flag. The cache-vs-fresh identity of
  // the fetch itself is proven in api/_utils/marketDataCache.qw1.test.js (review E1-2).
  it('wiring: flag OFF and ON write the identical score set when the fetch returns the same result', async () => {
    const run = async (on) => {
      flag.on = on;
      mocks.getStockAnalysisData.mockReset();
      stubPrices();
      const battle = baseBattle();
      const { db, updates } = makeDb(battle);
      await processAgentBattle(db, battle, { evaluated: 0, held: 0 }, Date.now(), new Map(), { everEnabled: false });
      const merged = Object.assign({}, ...updates);
      for (const k of Object.keys(merged)) if (/At$|Timestamp|lastScoredAt/.test(k)) delete merged[k];
      return merged;
    };
    expect(await run(true)).toEqual(await run(false));
  });
});
