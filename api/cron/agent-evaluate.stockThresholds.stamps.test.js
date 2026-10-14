// Isolated corrected lifecycle with tick stamps ON (as shipped); real writers,
// scorer and stamp composer, mocked market/model infrastructure. Header shared
// with agent-evaluate.stockThresholds.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  makeTickBattle,
  makeRankingsDoc,
  makeHoldResult,
  makeSwapResult,
  makeToolUseResponse,
  makeTickDb,
} from '../_utils/__fixtures__/tickStampsHarness.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(),
  fetchIntradayBatch: vi.fn(),
  create: vi.fn(),
}));
const runtime = vi.hoisted(() => ({ launch: 'autopilot', route: null, executed: [] }));
vi.mock('../_utils/executionAuthority.js', async original => ({ ...await original(), get LAUNCH_EXECUTION_MODE() { return runtime.launch; } }));
vi.mock('../_utils/agentSwapExecution.js', async original => {
  const actual = await original();
  return { ...actual, executeSwapServer: async (...args) => {
    runtime.executed.push(args);
    const { stockObservation } = await import('../_utils/__fixtures__/stockThresholdHarness.js');
    args[10] = { ...args[10], collector: symbol => stockObservation(symbol) };
    return actual.executeSwapServer(...args);
  } };
});
vi.mock('../_utils/agentRiskManager.js', async original => {
  const actual = await original(); return { ...actual, evaluateRisk: (...args) => runtime.route === 'risk' ? { action: 'EMERGENCY_SWAP', reason: 'bust_avoidance', detail: 'Isolated forced risk verdict' } : actual.evaluateRisk(...args) };
});
vi.mock('../_utils/agentGuardrails.js', async original => {
  const actual = await original(); return { ...actual, applyGuardrails: (...args) => runtime.route === 'suppression' ? { decision: 'SWAP', symbolOut: 'AAPL', symbolIn: 'MSFT', tier: 'star', slotIndex: 0, overrideApplied: true, sourceNote: 'guardrail_stopLoss', statusMessage: 'Isolated forced directive', overrides: [] } : actual.applyGuardrails(...args) };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    constructor() { this.messages = { create: (...args) => mocks.create(...args) }; }
  },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  // The session filter passes the fixture's candles through as today's RTH
  // session (the real parser is covered in marketDataCache.test.js; review
  // E1 ran this suite with the real filter — identical results).
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
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
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({
  ...(await importOriginal()),
  generateAnticipation: vi.fn(async () => null),
}));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({
  ...(await importOriginal()),
  generateTradeNarration: vi.fn(async () => null),
}));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({
  ...(await importOriginal()),
  logEvaluation: vi.fn(async () => false),
  logVisionTransition: vi.fn(async () => false),
  logAnticipation: vi.fn(async () => false),
}));
// Tick stamps ON, as shipped. Everything else in featureFlags.js is live.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  TICK_STAMPS_ENABLED: true,
  // Tick capture ships dark; the golden this suite pins is the flag-OFF write,
  // so the flag is pinned FALSE here explicitly rather than inherited (Phase 0
  // Part 3: "a new capture flag also needs an explicit false mock in legacy
  // fixture tests"). A future flip must move this line deliberately.
  TICK_CAPTURE_ENABLED: true,
  // Cockpit Build 0: the call records are pinned OFF here explicitly (this suite's
  // exact entry-key lists are the off shape), so the shadow flip moves no line here.
  CALL_RECORDS_MODE: 'off',
  // Pilot P6: SWAP_IDENTITY_MODE pinned 'off' too — this suite's fixture is the off shape (writer arguments, trade rows, entry keys), so the founder's flip moves no line here.
  SWAP_IDENTITY_MODE: 'off',
}));

const { processAgentBattle } = await import('./agent-evaluate.js');
const { correctedStockBattle, STOCK_TEST_NOW } = await import('../_utils/__fixtures__/stockThresholdHarness.js');
const { withCaptureStore } = await import('../_utils/__fixtures__/tickCaptureHarness.js');

beforeEach(() => {
  runtime.launch = 'autopilot';
  runtime.route = null; runtime.executed = [];
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(STOCK_TEST_NOW));
  process.env.EODHD_API_KEY = 'isolated-key';
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
  mocks.getStockAnalysisData.mockImplementation(async () => ({ price: { current: 103.27, previousClose: 103.27, changePercent: 0, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 }, daily: [] }));
  mocks.fetchIntradayBatch.mockResolvedValue({});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); delete process.env.EODHD_API_KEY; });
// Review K3-7: the stamp names the bench the prompt's FUNDAMENTALS block was
// built from (AAPL vintage 10-01, MSFT 10-13). A corrected model swap moves
// MSFT out of the bench; its roster re-read must come after the stamp.
async function haikuTick({ corrected }) {
  const { battle: pinned, inputs } = await correctedStockBattle();
  const original = makeTickBattle();
  const battle = { ...original, ...pinned, timing: { tradingDays: ['2026-10-14'], currentTradingDay: 1 }, cronState: { ...original.cronState, lastGameplanDate: '10/14/2026' }, scoreState: { ...original.scoreState, ...pinned.scoreState }, scoring: { ...original.scoring, ...pinned.scoring } };
  if (!corrected) delete battle.scoring.stockThresholdModel;
  vi.setSystemTime(new Date('2026-10-14T14:03:00Z'));
  mocks.getStockAnalysisData.mockImplementation(async symbol => ({ price: { current: symbol === 'MSFT' ? 106 : 103.27, previousClose: 103.27, changePercent: symbol === 'MSFT' ? 4 : 0, timestamp: Date.now() / 1000 }, daily: [] }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeSwapResult({ symbolOut: 'AAPL', symbolIn: 'MSFT', tier: 'star' })));
  const db = withCaptureStore(makeTickDb({ battle, rankingsDoc: { ...makeRankingsDoc(), stocks: [{ symbol: 'AAPL', baseATR: 2.5, fundamentals: { computedAt: Date.parse('2026-10-01T00:00:00Z') } }, { symbol: 'MSFT', baseATR: 3, fundamentals: { computedAt: Date.parse('2026-10-13T00:00:00Z') } }] }, techDocs: {} }));
  const collection = db.collection.bind(db);
  db.collection = name => name === 'learningReceipts' ? { doc: () => ({ collection: () => ({ doc: () => ({ create: async () => {} }) }) }) } : collection(name);
  db.doc = path => ({ path, id: path.split('/').at(-1), get: async () => ({ exists: !!inputs[path], data: () => structuredClone(inputs[path]) }) });
  const runTx = db.runTransaction.bind(db);
  db.runTransaction = cb => runTx(tx => cb({ ...tx, create: (ref, data) => { if (inputs[ref.path]) throw Error('already exists'); inputs[ref.path] = structuredClone(data); } }));
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0, errors: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  return { live: db.__store.battle, summary };
}
describe('K3-7: tick stamps after a corrected model swap', () => {
  it('the stamp keeps the prompt-time bench vintage, exactly as the legacy control does', async () => {
    const legacy = await haikuTick({ corrected: false });
    const pinned = await haikuTick({ corrected: true });
    for (const { live, summary } of [legacy, pinned]) {
      expect(summary.swapped).toBe(1); expect(live.portfolio.star[0].symbol).toBe('MSFT');
      expect((live.portfolio.bench?.stocks || []).map(s => s.symbol)).not.toContain('MSFT');
    }
    expect(legacy.live.evaluations.at(-1).vintages.fundAsOf).toBe('2026-10-13');
    expect(pinned.live.evaluations.at(-1).vintages.fundAsOf).toBe(legacy.live.evaluations.at(-1).vintages.fundAsOf);
    expect(pinned.live.scoreState.stockScoreEvidence.status).toBe('valid');
  });
});
