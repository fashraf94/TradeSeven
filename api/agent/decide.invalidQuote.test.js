// api/agent/decide.invalidQuote.test.js
//
// Both deploy paths refuse a held symbol whose real-time quote is unusable
// (docs/audits/20261014_BUILD_NA_QUOTE_INVALID_PRICE.md). The REAL deploy
// endpoint (the self-select handler and the prescribed tournament branch) runs
// end to end on the P1b deploy harness; one held pick, JPM, is priced by the
// REAL marketDataCache.getStockAnalysisData over a stubbed network, so the
// producer's output meets the real deploy guards (Guard 1, the baseline
// completeness gate, the cooldown rollback). Every other symbol keeps the
// harness's complete quote.
//
// Before the fix, EQR's all-"NA" body went through: Guard 1 replaced "NA" with
// the stale daily close and the gate admitted a battle the evaluation cron
// could never score (Shadow, 14 Oct 2026).

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ db: null, anthropic: null, gemmaCalls: [], shadow: { decisions: [], firstMessages: [] }, viaProducer: new Set() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicDouble {
    constructor() { this.messages = { create: (args) => state.anthropic.create(args) }; }
  },
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));
vi.mock('../_utils/security.js', async (importOriginal) => ({ ...(await importOriginal()), applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', async (importOriginal) => ({ ...(await importOriginal()), requireAuth: async () => ({ uid: 'p1b-owner-1' }) }));
vi.mock('../_utils/marketDataCache.js', async (importOriginal) => {
  const real = await importOriginal();
  const { priceAnswer } = await import('../_utils/__fixtures__/deployHarness.js');
  return {
    ...real,
    getStockAnalysisData: (symbol, opts) => (state.viaProducer.has(symbol) ? real.getStockAnalysisData(symbol, opts) : priceAnswer(symbol)),
  };
});
vi.mock('../_utils/shadowLogger.js', () => ({
  logDecision: async (args) => { state.shadow.decisions.push(JSON.parse(JSON.stringify(args))); },
  logFirstMessage: async (args) => { state.shadow.firstMessages.push(JSON.parse(JSON.stringify(args))); },
}));
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: async () => '{"response":"Opening line."}',
  parseVoiceLayerResponse: () => ({ response: 'Opening line.', _scratchpad: null }),
}));
// The real producer's own Firestore (its cache writer) and app init.
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: () => ({}), cert: () => ({}) }));
vi.mock('firebase-admin/firestore', async () => {
  const { FieldValueDouble } = await import('../_utils/__fixtures__/callsFirestore.js');
  const { cacheDbDouble } = await import('../_utils/__fixtures__/eodhdQuoteFixtures.js');
  return { FieldValue: FieldValueDouble, getFirestore: () => cacheDbDouble() };
});

const H = await import('../_utils/__fixtures__/deployHarness.js');
const { SCENARIOS } = await import('../_utils/__fixtures__/deployScenarios.js');
const { REAL_TIME, stubEodhdFetch } = await import('../_utils/__fixtures__/eodhdQuoteFixtures.js');
const { default: handler } = await import('./decide.js');

const PRIOR_DEPLOY = '2026-10-12T15:00:00.000Z'; // agentDoc()'s lastDeployedAt — the cooldown to restore
// JPM's daily bars in the API's own field names: a raw close the harness price agrees with.
const JPM_DAILY = [{ date: '2026-10-12', open: 103.4, high: 104.2, low: 103.1, close: 103.5, adjusted_close: 103.5, volume: 9000000 }];
const JPM_LIVE = { code: 'JPM.US', timestamp: 1792006920, gmtoffset: 0, open: 103.6, high: 104.6, low: 103.4, close: 104, volume: 8000000, previousClose: 103.5, change: 0.5, change_p: 0.4831 };

/** Run one deploy with JPM priced by the real producer from `jpmBody`. */
async function deploy(scenario, jpmBody) {
  const { docs, req } = scenario();
  state.db = H.makeDeployDb(docs);
  state.anthropic = H.makeAnthropicDouble();
  state.gemmaCalls = [];
  state.shadow = { decisions: [], firstMessages: [] };
  state.viaProducer = new Set(['JPM']);
  stubEodhdFetch(vi, { realTime: { 'JPM.US': jpmBody }, eod: { 'JPM.US': JPM_DAILY } });
  Math.random.mockImplementation(H.seededRandom());
  const res = H.makeRes();
  await handler(req, res);
  await H.settle();
  const docsAfter = H.finalDocs(state.db);
  const battles = Object.entries(docsAfter).filter(([p]) => /^agentBattles\/[^/]+$/.test(p));
  return { res, battles, agent: docsAfter[`agents/${H.AGENT_ID}`] };
}

let savedEnv;
beforeEach(() => {
  savedEnv = { cron: process.env.CRON_SECRET, key: process.env.EODHD_API_KEY };
  process.env.CRON_SECRET = H.CRON_SECRET;
  process.env.EODHD_API_KEY = 'test-eodhd-key';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(H.FROZEN_NOW));
  vi.spyOn(Math, 'random').mockImplementation(H.seededRandom());
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (savedEnv.cron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = savedEnv.cron;
  if (savedEnv.key === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = savedEnv.key;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The existing retryable refusal: no battle, lock released, cooldown restored. */
function expectPricingRefusal({ res, battles, agent }) {
  expect(res.statusCode).toBe(503);
  expect(res.body).toMatchObject({ error: 'pricing_unavailable', reason: 'pricing_unavailable', retriable: true, missingSymbols: ['JPM'] });
  expect(battles).toEqual([]);
  expect(agent.deployingAt).toBeNull();
  expect(agent.lastDeployedAt).toBe(PRIOR_DEPLOY);
  expect(agent.activeBattleId ?? null).toBeNull();
}

const PATHS = [
  ['self-select (tiered handler)', SCENARIOS.self_select_no_equip],
  ['prescribed tournament branch', SCENARIOS.tournament_prescribed_with_ready_idea],
];

describe.each(PATHS)('deploy — %s', (_name, scenario) => {
  it('refuses EQR\'s real all-"NA" quote on a held pick: 503 pricing_unavailable, no battle, cooldown restored', async () => {
    expectPricingRefusal(await deploy(scenario, { ...REAL_TIME.EQR_ALL_NA, code: 'JPM.US' }));
  }, 20_000);

  it('refuses close "NA" beside a numeric previousClose (WBD\'s shape)', async () => {
    expectPricingRefusal(await deploy(scenario, { ...REAL_TIME.WBD_MIXED, code: 'JPM.US', previousClose: 103.5 }));
  }, 20_000);

  it('refuses a malformed price string', async () => {
    expectPricingRefusal(await deploy(scenario, { ...JPM_LIVE, close: '104junk' }));
  }, 20_000);

  it('a valid numeric quote deploys: one active battle, JPM\'s baseline is the live price', async () => {
    const { res, battles, agent } = await deploy(scenario, JPM_LIVE);
    expect(res.statusCode).toBe(200);
    expect(battles).toHaveLength(1);
    const [[path, battle]] = battles;
    expect(battle.status).toBe('active');
    expect(battle.portfolio.startingPrices.JPM).toBe(104);
    expect(agent.activeBattleId).toBe(path.split('/')[1]);
  }, 20_000);

  it('a complete decimal string quote deploys with a numeric baseline', async () => {
    const { res, battles } = await deploy(scenario, { ...JPM_LIVE, close: '104.00' });
    expect(res.statusCode).toBe(200);
    expect(battles).toHaveLength(1);
    expect(battles[0][1].portfolio.startingPrices.JPM).toBe(104);
  }, 20_000);
});
