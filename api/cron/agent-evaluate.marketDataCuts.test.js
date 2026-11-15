// api/cron/agent-evaluate.marketDataCuts.test.js
//
// Capacity Build 1, Part 3 in the real check (docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md).
// One battle, checked twice against the SAME market data and the same frozen
// clock: once with EVAL_MARKET_DATA_CUTS_ENABLED off (every symbol fetched by
// the battle, daily + price), once on (daily bars from the session series, the
// macros from the run's share). Every battle write and the model request must
// be identical — the per-battle effects of a fetched quote (the prices map,
// the calls step's detached quote and its instant, the quote guard, the
// prompt, the score) are the same whether the battle fetched the quote or took
// the run's copy. And with the flag off, the fan-out is today's call exactly.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs,
  makeIntradayCandles, makeHoldResult, makeToolUseResponse, makeTickDb, deepClone,
} from '../_utils/__fixtures__/tickStampsHarness.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn(), recorded: [] }));
const flags = vi.hoisted(() => ({ cuts: false }));

// The calls step's detached-quote record, observed (real function, wrapped): which instant each quote carries.
vi.mock('../_utils/callRecords/observe.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, recordFetchedQuote: (ctx, symbol, price, fetchedAtMs) => { mocks.recorded.push({ symbol, fetchedAtMs }); return real.recordFetchedQuote(ctx, symbol, price, fetchedAtMs); } };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock { constructor() { this.messages = { create: (...a) => mocks.create(...a) }; } },
}));
vi.mock('../_utils/marketDataCache.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((c) => ({ candles: c || [], sessionDate: '2026-09-09' })),
}));
// The calls step runs only for an allowlisted owner at CALL_RECORDS_MODE 'on' (its real value): the
// fixture battle's owner is allowlisted, so every row below runs the calls path too (callsOn suite precedent).
vi.mock('../_utils/callRecords/allowlist.js', async (importOriginal) => ({ ...(await importOriginal()), readCockpitAllowlist: () => ['owner-uid-1'] }));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(),
  reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
vi.mock('../_utils/learning/captureReceipt.js', () => ({
  captureSwapReceipt: vi.fn(async () => {}), resolveEntrySnapshot: vi.fn(async () => ({ snapshotIn: null, techDocIn: null, entrySnapshotSource: 'unavailable' })),
  classifyEntryAtrSource: vi.fn(() => 'bench_atr'), classifyEvidence: vi.fn(() => 'live_agent'),
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  TICK_CAPTURE_ENABLED: false,
  get EVAL_MARKET_DATA_CUTS_ENABLED() { return flags.cuts; },
}));

const { processAgentBattle } = await import('./agent-evaluate.js');
const { prepareRunMarketShare, resetSessionDailyMemo, SHARED_MACRO_SYMBOLS } = await import('../_utils/evalMarketData.js');

const BOTH = { forceRefresh: true, fields: ['daily', 'price'] };

/** 62 weekday bars, newest first, ending Tue 2026-09-08 — the session before the frozen Wed 2026-09-09. */
function dailyRows(seed) {
  const rows = [];
  let t = Date.parse('2026-09-08T12:00:00Z');
  while (rows.length < 62) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) {
      const c = seed + rows.length;
      rows.push({ date: d.toISOString().slice(0, 10), open: c, high: c + 1, low: c - 1, close: c, rawClose: c, volume: 10 });
    }
    t -= 86_400_000;
  }
  return rows;
}

/** The market-data double: answers daily and/or price by `fields`, as getStockAnalysisData does. */
function installMarketData({ priceless = [] } = {}) {
  const table = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (symbol, opts = {}) => {
    const fields = opts.fields || ['daily', 'price'];
    const out = {};
    if (fields.includes('daily')) out.daily = dailyRows(symbol.length * 10);
    if (fields.includes('price') && table[symbol] && !priceless.includes(symbol)) out.price = deepClone(table[symbol]);
    return out;
  });
}

async function check({ cuts, battle = makeTickBattle(), priceless = [] }) {
  flags.cuts = cuts;
  resetSessionDailyMemo();
  installMarketData({ priceless });
  mocks.getStockAnalysisData.mockClear();
  mocks.create.mockClear();
  const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  // Every collection the check opens, so a row can say what it never touched (review DK-2).
  const collections = [];
  const baseCollection = db.collection.bind(db);
  db.collection = (name) => { collections.push(name); return baseCollection(name); };
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  if (cuts) await prepareRunMarketShare(db, summary);
  const shareCalls = mocks.getStockAnalysisData.mock.calls.map((c) => c[0]);
  mocks.getStockAnalysisData.mockClear();
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  return {
    updates: db.__updates,
    request: mocks.create.mock.calls.map((c) => c[0]),
    summary,
    shareCalls,
    collections,
    tickCalls: mocks.getStockAnalysisData.mock.calls.map(([s, o]) => [s, o]),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { flags.cuts = false; vi.useRealTimers(); vi.restoreAllMocks(); });

describe('the shared list is the evaluator\'s own list', () => {
  it('SHARED_MACRO_SYMBOLS equals processAgentBattle\'s `macroSymbols` literal', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./agent-evaluate.js', import.meta.url), 'utf8');
    const m = /const macroSymbols = (\[[^\]]*\]);/.exec(src);
    expect(m).not.toBeNull();
    expect(JSON.parse(m[1].replace(/'/g, '"'))).toEqual([...SHARED_MACRO_SYMBOLS]);
  });
});

describe('flag OFF — the fan-out is today\'s fetch, exactly', () => {
  it('every fan-out call is (symbol, { forceRefresh: true, fields: [daily, price] }); the session store is never opened', async () => {
    const off = await check({ cuts: false });
    expect(off.collections.length).toBeGreaterThan(3); // anti-vacuous: the recorder sees the check's collections
    expect(off.collections).not.toContain('evalSessionDaily');
    expect(off.tickCalls.length).toBeGreaterThan(10);
    for (const [, opts] of off.tickCalls) expect(opts).toEqual(BOTH);
    for (const m of SHARED_MACRO_SYMBOLS) expect(off.tickCalls.filter(([s]) => s === m)).toHaveLength(1);
  });
});

describe('flag ON — same effects as a per-battle fetch', () => {
  it('SPY and QQQ come from the run (not fetched in the check); BTC-USD.CC is the battle\'s own (it holds "BTC" — one instrument, review GC-3); every write and the request are identical', async () => {
    const off = await check({ cuts: false });
    const on = await check({ cuts: true });
    expect(on.collections).toContain('evalSessionDaily'); // the cut path really ran
    expect(on.shareCalls.filter((s) => SHARED_MACRO_SYMBOLS.includes(s)).length).toBeGreaterThanOrEqual(3);
    for (const m of ['SPY', 'QQQ']) expect(on.tickCalls.filter(([s]) => s === m)).toEqual([]);
    expect(on.tickCalls.filter(([s]) => s === 'BTC-USD.CC').length).toBeGreaterThan(0);
    expect(off.request).toHaveLength(1); // anti-vacuous: the check reached the model
    expect(on.request).toEqual(off.request);
    expect(on.updates).toEqual(off.updates);
    expect(on.summary).toEqual(off.summary);
  });

  it('a battle that benches SPY fetches SPY itself (never the run\'s copy), and its writes are still identical', async () => {
    const battle = makeTickBattle();
    battle.portfolio.bench.stocks.push({ symbol: 'SPY', baseATR: 1.2, isCrypto: false, sector: 'ETF' });
    const off = await check({ cuts: false, battle: deepClone(battle) });
    const on = await check({ cuts: true, battle: deepClone(battle) });
    expect(on.tickCalls.filter(([s]) => s === 'SPY').length).toBeGreaterThan(0);
    expect(on.tickCalls.filter(([s]) => s === 'QQQ')).toEqual([]);
    expect(on.updates).toEqual(off.updates);
    expect(on.request).toEqual(off.request);
  });

  it('a macro the run could not price is fetched by the battle, as before', async () => {
    // QQQ unpriced everywhere: the share holds no QQQ, so the check asks for it.
    const off = await check({ cuts: false, priceless: ['QQQ'] });
    const on = await check({ cuts: true, priceless: ['QQQ'] });
    expect(on.tickCalls.filter(([s]) => s === 'QQQ').length).toBeGreaterThan(0);
    expect(on.updates).toEqual(off.updates);
  });

  it('a shared quote is recorded with the RUN fetch\'s instant; the battle\'s own quotes with the check\'s', async () => {
    flags.cuts = true;
    installMarketData();
    resetSessionDailyMemo();
    mocks.recorded.length = 0;
    const db = makeTickDb({ battle: makeTickBattle(), rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
    const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
    const shareAt = Date.now();
    await prepareRunMarketShare(db, summary);
    vi.setSystemTime(new Date(shareAt + 45_000)); // the battle is checked 45 s into the run
    await processAgentBattle(db, makeTickBattle(), summary, shareAt, new Map(), { everEnabled: false });
    const at = (s) => mocks.recorded.filter((r) => r.symbol === s).map((r) => r.fetchedAtMs);
    expect(at('SPY')).toEqual([shareAt]);
    expect(at('QQQ')).toEqual([shareAt]);
    expect(at('NVDA')).toEqual([shareAt + 45_000]);
  });

  it('the daily bars came from the session series: with the series warm, a second check fetches no /eod/ for any symbol', async () => {
    flags.cuts = true;
    installMarketData();
    const db = makeTickDb({ battle: makeTickBattle(), rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
    resetSessionDailyMemo();
    const s1 = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
    await prepareRunMarketShare(db, s1);
    await processAgentBattle(db, makeTickBattle(), s1, Date.now(), new Map(), { everEnabled: false });
    mocks.getStockAnalysisData.mockClear();
    const s2 = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
    await prepareRunMarketShare(db, s2);
    await processAgentBattle(db, makeTickBattle(), s2, Date.now(), new Map(), { everEnabled: false });
    const dailyCalls = mocks.getStockAnalysisData.mock.calls.filter(([, o]) => (o?.fields || []).includes('daily'));
    expect(dailyCalls).toEqual([]);
    expect(mocks.getStockAnalysisData.mock.calls.length).toBeGreaterThan(5); // the quotes, every check
  });
});
