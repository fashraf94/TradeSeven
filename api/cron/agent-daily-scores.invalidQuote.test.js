// api/cron/agent-daily-scores.invalidQuote.test.js
//
// Daily scoring invents no badges for a held symbol whose real-time quote is
// unusable (docs/audits/20261014_BUILD_NA_QUOTE_INVALID_PRICE.md). The REAL
// agent-daily-scores handler runs with the REAL getStockAnalysisData over a
// stubbed network; only the battle list, the battle write and the Firestore
// edges are doubles.
//
// The case that matters is AVB: its adjusted daily close (65.90) sits far below
// the raw close every baseline uses (184.0601). Had an unusable quote been sent
// down the daily-close fallback, AVB would score −64% and bank Bust + Crash +
// Meltdown. Under the fix it has no price and is skipped (`!priceData?.current`).

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ battles: [], updates: [] }));

vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: () => ({}), cert: () => ({}) }));
vi.mock('firebase-admin/firestore', async () => {
  const { cacheDbDouble } = await import('../_utils/__fixtures__/eodhdQuoteFixtures.js');
  return { getFirestore: () => cacheDbDouble(), FieldValue: { increment: (n) => ({ __increment: n }) } };
});
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => ({
    collection: () => ({ doc: (id) => ({ update: async (u) => { state.updates.push({ id, u }); } }) }),
  }),
}));
vi.mock('../_utils/agentBattleService.js', () => ({ findActiveAgentBattles: async () => state.battles }));
vi.mock('../_utils/marketSchedule.js', async (importOriginal) => ({ ...(await importOriginal()), isTradingDay: () => true }));

const { default: handler } = await import('./agent-daily-scores.js');
const { REAL_TIME, DAILY, stubEodhdFetch } = await import('../_utils/__fixtures__/eodhdQuoteFixtures.js');

const NOW = '2026-10-14T20:30:00.000Z';
const MPC_START = 400; // MPC's live 482.65 is +20.7% on this baseline: a real move that banks badges

function battle(held) {
  const assets = held.map((symbol) => ({ symbol, name: symbol, baseATR: 2.5, isCrypto: false }));
  return {
    id: `b-${held.join('-')}`,
    status: 'active',
    activatedAt: '2026-10-14T15:38:12.983Z',
    timing: { tradingDays: ['2026-10-14'] },
    portfolio: { star: assets, core: [], support: [], startingPrices: { AVB: 184.0601, MPC: MPC_START } },
    scoreState: {},
    thresholdHistory: {},
  };
}

async function runDailyScores(held) {
  state.battles = [battle(held)];
  state.updates = [];
  stubEodhdFetch(vi, {
    realTime: { 'AVB.US': { ...REAL_TIME.EQR_ALL_NA, code: 'AVB.US' }, 'MPC.US': REAL_TIME.MPC_LIVE },
    eod: { 'AVB.US': DAILY.AVB, 'MPC.US': [{ date: '2026-10-13', open: 470, high: 478, low: 469, close: 476.98, adjusted_close: 476.98, volume: 1000000 }] },
  });
  const res = { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ headers: { 'x-vercel-cron': '1' } }, res);
  expect(res.statusCode).toBe(200);
  expect(state.updates).toHaveLength(1);
  return state.updates[0].u['scoreState.bankedBadgePoints.breakdown.day1'];
}

let savedKey;
beforeEach(() => {
  savedKey = process.env.EODHD_API_KEY;
  process.env.EODHD_API_KEY = 'test-eodhd-key';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = savedKey;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('agent-daily-scores — a held symbol with an unusable quote', () => {
  it('banks nothing for AVB (no price → skipped); the same battle\'s live MPC still scores', async () => {
    const both = await runDailyScores(['AVB', 'MPC']);
    const mpcOnly = await runDailyScores(['MPC']);
    expect(mpcOnly.points).toBeGreaterThan(0); // the scorer really runs on a live quote
    expect(both.badges).not.toHaveProperty('AVB');
    expect(both.points).toBe(mpcOnly.points); // AVB added exactly nothing
    expect(both.badges).toEqual(mpcOnly.badges);
  });
});
