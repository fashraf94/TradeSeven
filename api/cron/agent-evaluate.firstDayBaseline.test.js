// api/cron/agent-evaluate.firstDayBaseline.test.js
//
// BaggerBomb cleanup C2 (Flash, Oct 27, 2026): the day-1 badge baseline follows
// the first trading day. In processAgentBattle's day-1 gate a tiered battle's
// activation day is `timing.tradingDays[0]` (falling back to `activatedAt` when
// the list is absent), so a battle created in the last 45 minutes before a
// close — which plays the NEXT session (BR-2) — scores its badges from the
// creation price (`portfolio.startingPrices`), the price its score runs from,
// not from the previous close. Legacy stocks and the crypto slot are affected;
// measured stocks never were; tournaments and other modes are byte-identical.
//
// The seam is the REAL processAgentBattle and the REAL scorer; market data, the
// model and the firebase edges are doubled (the agent-evaluate.measuredFollowup
// precedent). The observable is the badge history the tick writes: a
// previous-close baseline that sits far above the quote reads as a deep loss
// (a negative minMultiplier); the creation-price baseline reads as a small gain.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs,
  makeIntradayCandles, makeHoldResult, makeToolUseResponse, makeTickDb,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCandidateUniverse } from '../_utils/__fixtures__/archetypeCandidateMenu.js';
import { tieredFullDayTarget } from '../../src/utils/stockAdmissionWindow.js';
import { etWallClockToMs } from '../../src/utils/marketCalendar.js';

const mocks = vi.hoisted(() => ({ prices: vi.fn(), intraday: vi.fn(), create: vi.fn(), marketOpen: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class {
  constructor() { this.messages = { create: (...args) => mocks.create(...args) }; }
} }));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.prices, fetchIntradayBatch: mocks.intraday,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: candles => ({ candles: candles || [], sessionDate: '2026-09-10' }),
}));
vi.mock('../_utils/marketSchedule.js', async (importOriginal) => ({ ...(await importOriginal()), isMarketOpen: () => mocks.marketOpen() }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/battlePatternLogger.js', () => ({ logBattlePattern: vi.fn(async () => {}) }));
vi.mock('../_utils/agentTriggerGate.js', async original => ({ ...(await original()), fetchRecentNews: async () => [] }));
vi.mock('../_utils/voiceLayerAnticipation.js', async original => ({ ...(await original()), generateAnticipation: async () => null }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async original => ({ ...(await original()), generateTradeNarration: async () => null }));
vi.mock('../_utils/shadowLogger.js', async original => ({
  ...(await original()), logEvaluation: async () => false, logVisionTransition: async () => false, logAnticipation: async () => false,
}));

const { processAgentBattle } = await import('./agent-evaluate.js');

const ET = (date, h, m = 0) => etWallClockToMs(date, h, m);
const SEP9 = '2026-09-09', SEP10 = '2026-09-10';
const universe = makeCandidateUniverse();
const rankings = { ...makeRankingsDoc(), stocks: [...makeRankingsDoc().stocks, ...universe] };

// NVDA bought at 120.5 and BTC at 67,000; both quote near that now (123.4,
// 67,450) against a previous close far above it.
const GAP = { NVDA: { current: 123.4, previousClose: 140, changePercent: -11.9 }, BTC: { current: 67450, previousClose: 75000, changePercent: -10 } };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  mocks.marketOpen.mockReset().mockReturnValue(true);
  mocks.create.mockReset().mockResolvedValue(makeToolUseResponse(makeHoldResult()));
  const table = { ...makePriceTable(), ...GAP, 'BTC-USD.CC': GAP.BTC };
  mocks.prices.mockReset().mockImplementation(async symbol => ({ price: table[symbol] || { current: 100, previousClose: 100, changePercent: 0 }, daily: [] }));
  mocks.intraday.mockReset().mockResolvedValue({ NVDA: makeIntradayCandles() });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

/** A tiered battle created at `createdMs`, shaped as BR-2 shapes it (its trading day from the window rule). */
function created(createdMs, over = {}) {
  const target = tieredFullDayTarget(createdMs, true);
  expect(target.status).toBe('ok');
  const at = new Date(createdMs).toISOString();
  const base = makeTickBattle();
  return makeTickBattle({
    createdAt: at, activatedAt: at, expiresAt: target.expiresAt,
    timing: { ...base.timing, tradingDays: [target.targetDateStr] },
    cronState: { ...base.cronState, lastGameplanDate: `${Number(target.targetDateStr.slice(5, 7))}/${Number(target.targetDateStr.slice(8, 10))}/2026` },
    ...over,
  });
}

/** One check at `atMs`; the badge history the tick wrote for `symbol`. */
async function checkAt(battle, atMs, symbol) {
  vi.setSystemTime(new Date(atMs));
  const db = makeTickDb({ battle, rankingsDoc: rankings, techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0, errors: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const scored = db.__updates.find((u) => `thresholdHistory.${symbol}` in u);
  expect(scored, JSON.stringify(summary)).toBeTruthy();
  return scored[`thresholdHistory.${symbol}`];
}

describe('C2 — a next-session battle scores its first day from the creation price', () => {
  it.each([['NVDA', 'a legacy stock'], ['BTC', 'the crypto slot']])('%s (%s): created Wed 15:20 ET, its Thursday check baselines at the creation price, not the previous close', async (symbol) => {
    const battle = created(ET(SEP9, 15, 20));
    expect(battle.timing.tradingDays).toEqual([SEP10]);
    const history = await checkAt(battle, ET(SEP10, 10, 0), symbol);
    expect(history.minMultiplier).toBe(0); // up from the creation price: no loss recorded
    expect(history.maxMultiplier).toBeGreaterThanOrEqual(0);
  });

  it.each(['NVDA', 'BTC'])('%s: a same-day battle is unchanged — created Thursday 10:00 ET it baselines at the creation price too', async (symbol) => {
    const battle = created(ET(SEP10, 10, 0));
    expect(battle.timing.tradingDays).toEqual([SEP10]);
    const history = await checkAt(battle, ET(SEP10, 11, 0), symbol);
    expect(history.minMultiplier).toBe(0);
  });

  it.each(['NVDA', 'BTC'])('%s: from the second day the baseline is the previous close, as before', async (symbol) => {
    const battle = created(ET(SEP9, 10, 0), { timing: { ...makeTickBattle().timing, tradingDays: [SEP9, SEP10], currentTradingDay: 2 } });
    const history = await checkAt(battle, ET(SEP10, 10, 0), symbol);
    expect(history.minMultiplier).toBeLessThan(0); // −11.9% / −10% against the previous close
  });

  it.each(['NVDA', 'BTC'])('%s: a battle with no trading-day list falls back to activatedAt (Wednesday), so Thursday is day 2 of its baseline', async (symbol) => {
    const battle = created(ET(SEP9, 15, 20));
    delete battle.timing.tradingDays;
    const history = await checkAt(battle, ET(SEP10, 10, 0), symbol);
    expect(history.minMultiplier).toBeLessThan(0);
  });

  it.each(['NVDA', 'BTC'])('%s: a tournament battle is byte-identical — activatedAt decides, whatever its list says', async (symbol) => {
    const battle = created(ET(SEP9, 15, 20), { gameMode: 'baggerbomb_tournament' });
    battle.timing.tradingDays = [SEP10];
    const history = await checkAt(battle, ET(SEP10, 10, 0), symbol);
    expect(history.minMultiplier).toBeLessThan(0); // Wednesday's activation, so Thursday baselines at the previous close
  });
});
