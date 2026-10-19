import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs,
  makeIntradayCandles, makeHoldResult, makeToolUseResponse, makeTickDb,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCandidateUniverse } from '../_utils/__fixtures__/archetypeCandidateMenu.js';
import { ARCHETYPE_WEIGHTS, computeArchetypeRankings } from '../_utils/archetypeScoring.js';

const mocks = vi.hoisted(() => ({ prices: vi.fn(), intraday: vi.fn(), create: vi.fn(), tournament: null }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class {
  constructor() { this.messages = { create: (...args) => mocks.create(...args) }; }
} }));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.prices, fetchIntradayBatch: mocks.intraday,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: candles => ({ candles: candles || [], sessionDate: '2026-09-09' }),
}));
vi.mock('../_utils/tournamentAgentLedger.js', async original => ({
  ...(await original()), resolveTournamentContext: async () => mocks.tournament,
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/agentTriggerGate.js', async original => ({ ...(await original()), fetchRecentNews: async () => [] }));
vi.mock('../_utils/voiceLayerAnticipation.js', async original => ({ ...(await original()), generateAnticipation: async () => null }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async original => ({ ...(await original()), generateTradeNarration: async () => null }));
vi.mock('../_utils/shadowLogger.js', async original => ({
  ...(await original()), logEvaluation: async () => false, logVisionTransition: async () => false, logAnticipation: async () => false,
}));

// Real orchestration, scorer, menu, equip helper, prompt assembly and entry
// gates. External I/O is doubled. The unmocked Node import guard also lives in
// agent-evaluate.shouldRebuildHotBench.test.js (BUILD_RULES §4).
const { processAgentBattle } = await import('./agent-evaluate.js');
const symbols = rows => rows.map(row => row.symbol);
const universe = makeCandidateUniverse();
const rankings = { ...makeRankingsDoc(), stocks: [...makeRankingsDoc().stocks, ...universe] };

function battleFor(archetype = 'analyst', overrides = {}) {
  const battle = makeTickBattle(overrides);
  battle.agentContext.archetype = archetype;
  battle.watchlist = { active: [], hotBench: ['S001'], monitoring: ['S002'] };
  return battle;
}

async function runTick(battle) {
  const db = makeTickDb({ battle, rankingsDoc: rankings, techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const update = db.__updates.find(u => u.watchlist);
  expect(update, JSON.stringify(summary)).toBeTruthy();
  return { db, update, summary };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.tournament = null;
  mocks.create.mockReset().mockResolvedValue(makeToolUseResponse(makeHoldResult()));
  const priceTable = makePriceTable();
  mocks.prices.mockReset().mockImplementation(async symbol => ({
    price: priceTable[symbol] || { current: 100, previousClose: 100, changePercent: 0 }, daily: [],
  }));
  mocks.intraday.mockReset().mockResolvedValue({ NVDA: makeIntradayCandles() });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('real refresh writes and model candidate consumption', () => {
  it.each(Object.keys(ARCHETYPE_WEIGHTS))('%s reaches storage and the model with its ranked candidate membership', async archetype => {
    const battle = battleFor(archetype);
    const expected = symbols(computeArchetypeRankings(rankings.stocks, archetype, { gameMode: 'baggerBomb' }))
      .filter(s => s.startsWith('S'));
    const { db, update } = await runTick(battle);
    expect(update.watchlist.hotBench).toEqual(expected.slice(0, 15));
    expect(update.watchlist.monitoring).toEqual(expected.slice(15, 33));
    expect(db.__store.battle.watchlist).toEqual(update.watchlist);
    expect(update['cronState.lastHotBenchComputedAt']).toBe(rankings.computedAt.toMillis());
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const request = mocks.create.mock.calls[0][0];
    const prompt = JSON.stringify(request.messages);
    for (const symbol of expected.slice(0, 15)) {
      expect(prompt).toContain(`${symbol},`);
      expect(mocks.prices.mock.calls.some(([s]) => s === symbol)).toBe(true);
    }
  });

  it('keeps equipped priority during overflow in the real refresh', async () => {
    const battle = battleFor();
    const equipped = universe.slice(80, 88).map(s => s.symbol);
    battle.agentContext.equippedWatchlist = { tickers: equipped };
    const { update } = await runTick(battle);
    for (const symbol of equipped) expect(update.watchlist.hotBench).toContain(symbol);
    expect(update.watchlist.hotBench.length).toBeLessThanOrEqual(20);
    expect(update.watchlist.monitoring.some(s => update.watchlist.hotBench.includes(s))).toBe(false);
  });

  it.each(['baggerbomb_tournament', 'league'])('%s retains fit selection and equipped/rival exclusions', async gameMode => {
    const battle = battleFor('analyst', { gameMode });
    // Distinct fit scores and a fixed expected list characterize the OLD path.
    mocks.tournament = { heldByOthers: new Set(['S009']), groupId: 'group', agentId: 'agent-1' };
    battle.agentContext.equippedWatchlist = { tickers: ['S009', 'NVDA', 'AMD', 'S095'] };
    const { update } = await runTick(battle);
    expect(update.watchlist.hotBench).toEqual([
      'S018', 'S027', 'S036', 'S045', 'S054', 'S063', 'S072', 'S081', 'S090',
      'S002', 'S011', 'S020', 'S029', 'S038', 'S047', 'S095',
    ]);
    expect(update.watchlist.monitoring).toEqual([
      'S056', 'S065', 'S074', 'S083', 'S092', 'S004', 'S013', 'S022', 'S031',
      'S040', 'S049', 'S058', 'S067', 'S076', 'S085', 'S094', 'S006', 'S015',
    ]);
  });

  it('uses legacy fit selection and a diagnostic for an unknown frozen identity', async () => {
    const { update } = await runTick(battleFor('unknown'));
    expect(update.watchlist.hotBench.slice(0, 3)).toEqual(['S009', 'S018', 'S027']);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[archetype-menu] legacy refresh: unknown archetype'));
  });
});
