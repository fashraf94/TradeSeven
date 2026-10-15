// api/_utils/agentEvalPromptAssembly.invalidQuoteBench.test.js
//
// An unpriced bench row no longer crashes prompt construction
// (docs/audits/20261014_BUILD_NA_QUOTE_INVALID_PRICE.md). The prices map is
// built as the evaluation cron builds it, from the REAL getStockAnalysisData
// over a stubbed network, and handed to the REAL (fenced, unmodified)
// buildLiveContextBlock, whose bench CSV formats `price?.current || 0` with
// `.toFixed(2)`.
//
// Before the fix a stale bench symbol arrived as `{ current: "NA" }`, so
// `"NA".toFixed` threw on every model call; the cron caught it as a model
// failure and the agent held all day while the battle looked healthy.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: () => ({}), cert: () => ({}) }));
vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const { cacheDbDouble } = await import('./__fixtures__/eodhdQuoteFixtures.js');
  return { ...(await importOriginal()), getFirestore: () => cacheDbDouble() };
});

const { getStockAnalysisData } = await import('./marketDataCache.js');
const { buildLiveContextBlock } = await import('./agentEvalPromptAssembly.js');
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

const BATTLE = {
  timing: { tradingDays: ['2026-10-14'] },
  scoreState: {},
  portfolio: {
    star: [], core: [], support: [],
    bench: {
      stocks: [
        { symbol: 'EQR', sector: 'Real Estate', baseATR: 2.5 },
        { symbol: 'WBD', sector: 'Communication Services', baseATR: 2.5 },
        { symbol: 'MPC', sector: 'Energy', baseATR: 2.5 },
      ],
      crypto: null,
    },
  },
};

describe('buildLiveContextBlock — a bench symbol with an unusable quote', () => {
  it('builds the prompt: the stale rows read $0.00, the live row keeps its price', async () => {
    stubEodhdFetch(vi, {
      realTime: { 'EQR.US': REAL_TIME.EQR_ALL_NA, 'WBD.US': REAL_TIME.WBD_MIXED, 'MPC.US': REAL_TIME.MPC_LIVE },
      eod: { 'EQR.US': DAILY.EQR },
    });
    const prices = {};
    for (const symbol of ['EQR', 'WBD', 'MPC']) {
      const data = await getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily', 'price'] });
      if (data?.price) prices[symbol] = data.price; // agent-evaluate.js:1104-1107
    }
    const block = await buildLiveContextBlock(BATTLE, prices, { SPY: 0, QQQ: 0, BTC: 0 }, [], [], [], [], {}, null);
    expect(block).toContain('EQR,Real Estate,$0.00,');
    expect(block).toContain('WBD,Communication Services,$0.00,');
    expect(block).toContain('MPC,Energy,$482.65,');
  });
});
