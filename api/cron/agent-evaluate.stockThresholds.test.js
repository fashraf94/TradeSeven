// Isolated corrected lifecycle; real writers/scorer, mocked market/model infrastructure.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW,
  PRE_PHASE_B_ENTRY_KEYS,
  BASE_ENTRY_KEYS,
  TIMING_ENTRY_KEYS,
  FAIL_CLOSED_ENTRY_KEYS,
  makeTickBattle,
  makePriceTable,
  makeRankingsDoc,
  makeTechDocs,
  makeIntradayCandles,
  makeHoldResult,
  makeSwapResult,
  serverMeetingOverrides,
  makeToolUseResponse,
  makeTickDb,
  undefinedPaths,
  POST_GOLDEN_UPDATE_KEYS,
  withoutPostGoldenKeys,
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
// THE FLAG — explicit false (hermetic). Everything else in featureFlags.js is live.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  TICK_STAMPS_ENABLED: false,
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

const { processAgentBattle, completeBattle } = await import('./agent-evaluate.js');
const { correctedStockBattle, STOCK_TEST_NOW, stockRows } = await import('../_utils/__fixtures__/stockThresholdHarness.js');
const { stockWriterDb } = await import('../_utils/__fixtures__/stockThresholdHarness.js');
const { correctedScorePatch, scoreCorrectedPosition } = await import('../_utils/stockThresholdAdmission.js');
const { withCaptureStore, permanentDoc } = await import('../_utils/__fixtures__/tickCaptureHarness.js');

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
async function stockTick(variant = 'final') {
  const { battle: corrected, inputs } = await correctedStockBattle();
  const original = makeTickBattle();
  const battle = { ...original, ...corrected, timing: { tradingDays: ['2026-10-14'], currentTradingDay: 1 }, cronState: { ...original.cronState, lastGameplanDate: '10/14/2026' }, scoreState: { ...original.scoreState, ...corrected.scoreState }, scoring: { ...original.scoring, ...corrected.scoring } };
  if (variant === 'passive') battle.isCpu = true;
  if (variant === 'gameplan_pending') { battle.gameplanMeeting = { id: 'meeting', createdAt: STOCK_TEST_NOW, expiresAt: '2026-10-14T14:12:00Z', status: 'pending', suggestedSwaps: [] }; battle.cronState.gameplanMeeting = { meetingId: 'meeting', createdAt: STOCK_TEST_NOW, expiresAt: '2026-10-14T14:12:00Z', legs: [] }; }
  if (variant === 'trigger_skipped') { battle.evaluations = [{ evalId: 'prior', timestamp: STOCK_TEST_NOW, decision: 'hold', scores: { active: 3, banked: 4, total: 7 } }]; battle.cronState.lastTriggeredAt = STOCK_TEST_NOW; }
  if (variant === 'proposal_pending') { runtime.launch = 'manual'; battle.pendingProposal = { id: 'proposal', mode: 'manual', symbolOut: 'AAPL', symbolIn: 'MSFT', createdAt: STOCK_TEST_NOW, expiresAt: '2026-10-14T14:12:00Z' }; }
  if (['risk', 'haiku', 'approved', 'expired', 'suppression', 'meeting'].includes(variant)) {
    runtime.route = variant;
    vi.setSystemTime(new Date('2026-10-14T14:03:00Z'));
    mocks.getStockAnalysisData.mockImplementation(async symbol => ({ price: { current: symbol === 'MSFT' ? 106 : 103.27, previousClose: 103.27, changePercent: symbol === 'MSFT' ? 4 : 0, timestamp: Date.now() / 1000 }, daily: [] }));
    if (variant === 'haiku') mocks.create.mockImplementation(async () => makeToolUseResponse(makeSwapResult({ symbolOut: 'AAPL', symbolIn: 'MSFT', tier: 'star' })));
    if (variant === 'suppression') battle.agentContext.deployedGuardrails = [{ type: 'stopLoss', value: 0.5 }];
    if (variant === 'approved' || variant === 'expired') {
      runtime.launch = 'copilot'; battle.pendingProposal = { proposalId: 'proposal', evalId: 'prior', mode: 'copilot', symbolOut: 'AAPL', symbolIn: 'MSFT', tier: 'star', slotIndex: 0, conviction: 80, rationale: 'fixture', outgoingSwappedInAt: STOCK_TEST_NOW, createdAt: STOCK_TEST_NOW, expiresAt: '2026-10-14T14:02:30Z', resolvedAt: variant === 'approved' ? '2026-10-14T14:02:20Z' : null, resolution: variant === 'approved' ? 'approved' : null };
    }
    if (variant === 'suppression' || variant === 'meeting') Object.assign(battle, serverMeetingOverrides({ id: 'meeting', status: variant === 'meeting' ? 'approved' : 'pending', createdAt: STOCK_TEST_NOW, expiresAt: '2026-10-14T14:12:00Z', diagnosis: 'fixture', suggestedSwaps: [{ symbolOut: 'AAPL', symbolIn: 'MSFT', swappedInAt: STOCK_TEST_NOW, rationale: 'fixture' }] }));
  }
  if (variant === 'gameplan_created') {
    battle.cronState.lastGameplanDate = null;
    battle.trades = [1, 2, 3].map(n => ({ id: `closed-${n}`, lockedPoints: -10 }));
    const { canonicalContentHash } = await import('../_utils/canonicalHash.js');
    for (const t of battle.trades) { const c = { positionId: t.id, side: 'agent', status: 'closed', points: -10, closedAt: STOCK_TEST_NOW, receiptHash: null }; battle.scoring.stockScoreComponents[t.id] = { ...c, componentHash: canonicalContentHash(c) }; }
  }
  const db = withCaptureStore(makeTickDb({ battle, rankingsDoc: { ...makeRankingsDoc(), stocks: [{ symbol: 'AAPL', baseATR: 2.5 }, { symbol: 'MSFT', baseATR: 3 }] }, techDocs: {} }));
  db.__stockLearning = new Map();
  const collection = db.collection.bind(db);
  db.collection = name => name === 'learningReceipts' ? { doc: id => ({ collection: sub => ({ doc: rid => ({ create: async value => { const p = `${id}/${sub}/${rid}`; if (db.__stockLearning.has(p)) throw Error('already exists'); db.__stockLearning.set(p, structuredClone(value)); } }) }) }) } : collection(name);
  db.doc = path => ({ path, id: path.split('/').at(-1), get: async () => ({ exists: !!inputs[path], data: () => structuredClone(inputs[path]) }) });
  const runTx = db.runTransaction.bind(db);
  db.runTransaction = cb => runTx(tx => cb({ ...tx, create: (ref, data) => { if (inputs[ref.path]) throw Error('already exists'); inputs[ref.path] = structuredClone(data); } }));
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0, errors: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  return { db, battle, summary };
}
describe('corrected evaluator and settlement use pinned model with admission false', () => {
  it.each(['risk', 'haiku', 'approved', 'expired', 'suppression', 'meeting'])('real common swap writer on evaluator route %s', async route => {
    const { db } = await stockTick(route);
    expect(runtime.executed.length, route).toBeGreaterThan(0);
    expect(db.__store.battle.portfolio.star[0].symbol, route).toBe('MSFT');
    expect(db.__store.battle.portfolio.star[0].stockThresholdReceipt.modelId).toBe('stock_measured_atr14_fullday_v1');
    expect(Object.keys(db.__store.battle.scoring.stockScoreComponents)).toContain('position-agent');
    const tick = permanentDoc(db, 'stock-battle', `stock-battle:${db.__store.battle.cronState.tickSeq}`);
    expect(tick.scores.total).toBe(db.__store.battle.scoreState.currentScore);
    expect(tick.scores.opponent).toBe(db.__store.battle.scoreState.opponentScore);
    const learning = [...db.__stockLearning.values()][0];
    expect(learning.stockRewardContract.incomingReceipt.receiptHash).toBe(db.__store.battle.portfolio.star[0].stockThresholdReceipt.receiptHash);
  });
  it.each(['passive', 'proposal_pending', 'gameplan_pending', 'gameplan_created', 'trigger_skipped', 'final'])('actual score exit %s commits supported finite operands', async variant => {
    const { db, summary } = await stockTick(variant);
    expect(summary.errors).toBe(0);
    expect(db.__store.battle.scoreState.stockScoreEvidence.status).toBe('valid');
    expect(db.__store.battle.scoreState.currentScore).toBe(variant === 'gameplan_created' ? -30 : 0); expect(db.__store.battle.scoreState.opponentScore).toBe(0);
    expect(db.__updates.some(p => p['scoreState.stockScoreEvidence']?.status === 'valid')).toBe(true);
    if (variant === 'trigger_skipped') expect(db.__store.battle.evaluations[0].scores).toEqual({ active: 3, banked: 4, total: 7 });
    if (variant === 'final') expect(db.__store.battle.evaluations.length).toBeGreaterThan(0);
    if (variant === 'gameplan_created') expect(db.__store.battle.gameplanMeeting).not.toBe(null);
  });
  it('the real completion writer refuses incomplete evidence before terminal/stats/reflection writes', async () => {
    const { battle, inputs } = await correctedStockBattle(); const h = stockWriterDb({ [`agentBattles/${battle.id}`]: battle, ...inputs });
    expect(await completeBattle(h.db, battle, {}, { everEnabled: false })).toMatchObject({ committed: false, reason: 'corrected_score_unavailable' }); expect(h.writes).toEqual([]);
  });
  it('the real completion writer preserves legitimate zero draw and one terminal mutation', async () => {
    const { battle, inputs } = await correctedStockBattle(); battle.statusFeed = []; battle.evaluations = []; battle.cronState = {};
    const h = stockWriterDb({ [`agentBattles/${battle.id}`]: battle, ...inputs });
    const prices = { AAPL: { current: 103.27, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
    const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
    await h.db.doc(`agentBattles/${battle.id}`).update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW));
    expect(await completeBattle(h.db, battle, {}, { everEnabled: false })).toMatchObject({ committed: true, disposition: { result: 'draw' } });
    const done = h.store.get(`agentBattles/${battle.id}`); expect(done.pendingReflection).toBe(true);
    const n = h.writes.length; expect(await completeBattle(h.db, battle, {}, { everEnabled: false })).toMatchObject({ committed: false }); expect(h.writes).toHaveLength(n);
  });
  it.each(['win', 'loss'])('qualified %s updates career and reflection exactly once from committed scores', async result => {
    const { battle, inputs } = await correctedStockBattle({ fill: result === 'win' ? 100 : 120, cpuFill: result === 'win' ? 120 : 100 });
    battle.statusFeed = []; battle.evaluations = []; battle.cronState = {};
    const path = `agentBattles/${battle.id}`;
    const h = stockWriterDb({ [path]: battle, ...inputs, 'agents/agent': { ownerId: 'owner', activeBattleId: battle.id, stats: {} } });
    const prices = { AAPL: { current: 103.27, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
    const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
    await h.db.doc(path).update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW));
    const committedScore = h.store.get(path).scoreState.currentScore;
    expect(await completeBattle(h.db, battle, {}, { everEnabled: false })).toMatchObject({ committed: true, disposition: { result, pendingReflection: true, updateAgentStats: true } });
    expect(h.store.get(path)).toMatchObject({ status: 'completed', pendingReflection: true, reviewPending: true });
    expect(h.store.get(path).statusFeed.at(-1).message).toContain(`Result: ${result === 'win' ? 'Win' : 'Loss'}`);
    expect(h.store.get('agents/agent')).toMatchObject({ activeBattleId: null, stats: { gamesPlayed: 1, wins: result === 'win' ? 1 : 0, losses: result === 'loss' ? 1 : 0, totalScore: Math.round(committedScore * 100) / 100 } });
    const n = h.writes.length; await completeBattle(h.db, battle, {}, { everEnabled: false }); expect(h.writes).toHaveLength(n);
  });
  it('bare corrected GC repair requires evidence and keeps the original completion instant', async () => {
    const { battle, inputs } = await correctedStockBattle(); Object.assign(battle, { status: 'completed', completedAt: STOCK_TEST_NOW, completionReason: 'expired', statusFeed: [], evaluations: [], cronState: {} });
    const path = `agentBattles/${battle.id}`, h = stockWriterDb({ [path]: battle, ...inputs });
    expect(await completeBattle(h.db, battle, {}, { everEnabled: false })).toMatchObject({ committed: false, reason: 'corrected_score_unavailable' }); expect(h.writes).toHaveLength(0);
    const prices = { AAPL: { current: 103.27, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
    const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
    await h.db.doc(path).update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW));
    vi.setSystemTime(new Date(Date.parse(STOCK_TEST_NOW) + 60000));
    expect(await completeBattle(h.db, battle, {}, { everEnabled: false })).toMatchObject({ committed: true, repaired: true });
    expect(h.store.get(path)).toMatchObject({ completedAt: STOCK_TEST_NOW, completionReason: 'expired_repaired', pendingReflection: true });
  });
  it('a concurrent roster change retries completion and refuses without terminal or career writes', async () => {
    const { battle, inputs } = await correctedStockBattle(); battle.statusFeed = []; battle.evaluations = []; battle.cronState = {};
    const path = `agentBattles/${battle.id}`; let raced = false;
    const h = stockWriterDb({ [path]: battle, ...inputs, 'agents/agent': { activeBattleId: battle.id, stats: {} } }, { beforeCommit: ({ store, versions }) => {
      if (raced) return; raced = true; store.get(path).scoring.stockRosterVersion++; versions.set(path, (versions.get(path) || 0) + 1);
    } });
    const prices = { AAPL: { current: 103.27, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
    const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
    await h.db.doc(path).update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW)); h.writes.length = 0;
    expect(await completeBattle(h.db, battle, {}, { everEnabled: false })).toMatchObject({ committed: false, reason: 'corrected_score_unavailable' });
    expect(h.attempts()).toBe(2); expect(h.writes).toHaveLength(0); expect(h.store.get(path).status).toBe('active'); expect(h.store.get('agents/agent').stats).toEqual({});
  });
});
