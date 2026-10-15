// api/_utils/agentSwapExecution.invalidQuote.test.js
//
// The swap executor commits NO trade into a symbol whose real-time quote is
// unusable (docs/audits/20261014_BUILD_NA_QUOTE_INVALID_PRICE.md). The prices
// map is built exactly as the evaluation cron builds it
// (agent-evaluate.js:1104-1107: `if (data?.price) prices[symbol] = data.price`)
// from the REAL marketDataCache.getStockAnalysisData over a stubbed network,
// then handed to the REAL (fenced, unmodified) executeSwapServer.
//
// Before the fix the executor received `{ current: "NA" }` for EQR; its own
// check (`getPrice(in) || 0`, then `<= 0`) does not reject a string
// (`"NA" <= 0` is false), so the swap committed with `swapPrice: "NA"`.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: () => ({}), cert: () => ({}) }));
vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const { cacheDbDouble } = await import('./__fixtures__/eodhdQuoteFixtures.js');
  return { ...(await importOriginal()), getFirestore: () => cacheDbDouble() };
});

const { getStockAnalysisData } = await import('./marketDataCache.js');
const { executeSwapServer } = await import('./agentSwapExecution.js');
const { REAL_TIME, DAILY, stubEodhdFetch } = await import('./__fixtures__/eodhdQuoteFixtures.js');

let savedKey;
beforeEach(() => {
  savedKey = process.env.EODHD_API_KEY;
  process.env.EODHD_API_KEY = 'test-eodhd-key';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = savedKey;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The cron's own prices-map construction over the real producer. */
async function cronPrices(symbols) {
  const prices = {};
  for (const symbol of symbols) {
    const data = await getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily', 'price'] });
    if (data?.price) prices[symbol] = data.price;
  }
  return prices;
}

function battleWithBench(benchSymbol) {
  return {
    status: 'active',
    portfolio: {
      star: [{ symbol: 'MU', name: 'Micron', baseATR: 2.5, isCrypto: false, swapPrice: 100 }],
      core: [],
      support: [],
      bench: { stocks: [{ symbol: benchSymbol, name: benchSymbol, baseATR: 2.5, isCrypto: false }], crypto: null },
      startingPrices: { MU: 100 },
    },
    scoring: { thresholds: {} },
    thresholdHistory: { MU: { maxMultiplier: 0, minMultiplier: 0 } },
    trades: [],
    scoreState: { tradeCount: 0 },
  };
}

function mockDb(liveData) {
  let captured = null;
  const transaction = {
    get: vi.fn(async () => ({ exists: true, data: () => liveData })),
    update: vi.fn((ref, updates) => { captured = updates; }),
  };
  const db = {
    collection: vi.fn(() => ({ doc: vi.fn(() => ({ __ref: 'battleRef' })) })),
    runTransaction: vi.fn(async (fn) => fn(transaction)),
  };
  return { db, captured: () => captured };
}

const noDailyReference = async () => ({ daily: [] });

describe('executeSwapServer — an incoming symbol with an unusable quote', () => {
  it('EQR\'s real all-"NA" quote: the cron map has no EQR price, the swap is refused, nothing is written', async () => {
    stubEodhdFetch(vi, {
      realTime: { 'MU.US': { ...REAL_TIME.MPC_LIVE, code: 'MU.US', close: 110 }, 'EQR.US': REAL_TIME.EQR_ALL_NA },
      eod: { 'EQR.US': DAILY.EQR },
    });
    const prices = await cronPrices(['MU', 'EQR']);
    expect(prices.EQR).toBeUndefined();
    const liveData = battleWithBench('EQR');
    const { db, captured } = mockDb(liveData);
    await expect(executeSwapServer(
      db, 'battle-1', liveData, 'star', 0,
      { symbol: 'EQR', name: 'EQR', baseATR: 2.5, isCrypto: false }, 1, prices,
      { id: 'trade_eqr', action: 'SWAP' }, null, { fetchDailyReference: noDailyReference },
    )).rejects.toThrow(/no valid price for EQR/);
    expect(captured()).toBeNull();
  });

  it('close "NA" beside a numeric previousClose (WBD\'s shape): refused, nothing written', async () => {
    stubEodhdFetch(vi, {
      realTime: { 'MU.US': { ...REAL_TIME.MPC_LIVE, code: 'MU.US', close: 110 }, 'WBD.US': REAL_TIME.WBD_MIXED },
      eod: {},
    });
    const prices = await cronPrices(['MU', 'WBD']);
    const liveData = battleWithBench('WBD');
    const { db, captured } = mockDb(liveData);
    await expect(executeSwapServer(
      db, 'battle-1', liveData, 'star', 0,
      { symbol: 'WBD', name: 'WBD', baseATR: 2.5, isCrypto: false }, 1, prices,
      { id: 'trade_wbd', action: 'SWAP' }, null, { fetchDailyReference: noDailyReference },
    )).rejects.toThrow(/no valid price for WBD/);
    expect(captured()).toBeNull();
  });

  it('control — a live incoming quote commits the swap at the producer\'s numeric price', async () => {
    stubEodhdFetch(vi, {
      realTime: { 'MU.US': { ...REAL_TIME.MPC_LIVE, code: 'MU.US', close: 110 }, 'MPC.US': REAL_TIME.MPC_LIVE },
      eod: {},
    });
    const prices = await cronPrices(['MU', 'MPC']);
    const liveData = battleWithBench('MPC');
    const { db, captured } = mockDb(liveData);
    await executeSwapServer(
      db, 'battle-1', liveData, 'star', 0,
      { symbol: 'MPC', name: 'MPC', baseATR: 2.5, isCrypto: false }, 1, prices,
      { id: 'trade_mpc', action: 'SWAP' }, null, { fetchDailyReference: noDailyReference },
    );
    const updates = captured();
    expect(updates).not.toBeNull();
    expect(updates['portfolio.star'][0]).toMatchObject({ symbol: 'MPC', swapPrice: 482.65 });
  });
});
