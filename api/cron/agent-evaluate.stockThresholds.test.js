// Isolated corrected lifecycle; real writers/scorer, mocked market/model infrastructure.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW,
  PRE_PHASE_B_ENTRY_KEYS,
  BASE_ENTRY_KEYS,
  TIMING_ENTRY_KEYS,
  FAIL_CLOSED_ENTRY_KEYS,
  makeTickBattle,
  makeRankingsDoc,
  makeHoldResult,
  makeSwapResult,
  serverMeetingOverrides,
  makeToolUseResponse,
  makeTickDb,
  POST_GOLDEN_UPDATE_KEYS,
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

const { processAgentBattle, completeBattle, feedScore, resolveCompletionDisposition, RESULT_UNAVAILABLE_CONTEXT } = await import('./agent-evaluate.js');
const { correctedStockBattle, STOCK_TEST_NOW } = await import('../_utils/__fixtures__/stockThresholdHarness.js');
const { deriveFlagView } = await import('../_utils/masteryConfig.js');
const { maybeBuildEligibilityStampFields } = await import('../_utils/masterySettlement.js');
const { readFileSync } = await import('node:fs');
const { stockWriterDb } = await import('../_utils/__fixtures__/stockThresholdHarness.js');
const { correctedScorePatch, scoreCorrectedPosition } = await import('../_utils/stockThresholdAdmission.js');
const { withCaptureStore, permanentDoc } = await import('../_utils/__fixtures__/tickCaptureHarness.js');

beforeEach(() => {
  runtime.launch = 'autopilot';
  runtime.route = null; runtime.executed = [];
  mocks.create.mockClear(); // v2 rows assert whether this tick reached the model
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(STOCK_TEST_NOW));
  process.env.EODHD_API_KEY = 'isolated-key';
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
  mocks.getStockAnalysisData.mockImplementation(async () => ({ price: { current: 103.27, previousClose: 103.27, changePercent: 0, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 }, daily: [] }));
  mocks.fetchIntradayBatch.mockResolvedValue({});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); delete process.env.EODHD_API_KEY; });
// v2: `cpuSymbol` places the CPU's lifetime on its own ticker; `undated` strips
// the provider timestamp from those symbols' quotes (they still pass the M1
// quote gate), so that side's reward context is unavailable this tick.
async function stockTick(variant = 'final', { quoteLagSec = 0, failRefreshRead = false, cpuSymbol = 'AAPL', undated = [] } = {}) {
  const { battle: corrected, inputs } = await correctedStockBattle({ cpuSymbol });
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
  // Review R1: a forced exit enters MSFT, then a catalyst-added GOOG lets the
  // model rotate that fresh lifetime out in the same tick and price map.
  if (variant === 'risk_then_model') {
    runtime.route = 'risk';
    vi.setSystemTime(new Date('2026-10-14T14:03:00Z'));
    const quote = { MSFT: 106, GOOG: 100 };
    // v2: only the MSFT quote carries the lag — whether it predates the fresh MSFT fill quote.
    mocks.getStockAnalysisData.mockImplementation(async symbol => ({ price: { current: quote[symbol] ?? 103.27, previousClose: 103.27, changePercent: symbol === 'MSFT' ? 4 : symbol === 'GOOG' ? 9 : 0, timestamp: Date.now() / 1000 - (symbol === 'MSFT' ? quoteLagSec : 0) }, daily: [] }));
    mocks.create.mockImplementation(async () => makeToolUseResponse(makeSwapResult({ symbolOut: 'MSFT', symbolIn: 'GOOG', tier: 'star' })));
  }
  if (variant === 'gameplan_created') {
    battle.cronState.lastGameplanDate = null;
    battle.trades = [1, 2, 3].map(n => ({ id: `closed-${n}`, lockedPoints: -10 }));
    const { canonicalContentHash } = await import('../_utils/canonicalHash.js');
    for (const t of battle.trades) { const c = { positionId: t.id, side: 'agent', status: 'closed', points: -10, closedAt: STOCK_TEST_NOW, receiptHash: null }; battle.scoring.stockScoreComponents[t.id] = { ...c, componentHash: canonicalContentHash(c) }; }
  }
  if (undated.length) {
    const inner = mocks.getStockAnalysisData.getMockImplementation();
    mocks.getStockAnalysisData.mockImplementation(async (symbol, o) => {
      const r = await inner(symbol, o);
      if (!undated.includes(symbol) || !r?.price) return r;
      const { timestamp: _dropped, ...price } = r.price;
      return { ...r, price };
    });
  }
  const ranked = [{ symbol: 'AAPL', baseATR: 2.5 }, { symbol: 'MSFT', baseATR: 3 }, ...(variant === 'risk_then_model' || cpuSymbol === 'GOOG' ? [{ symbol: 'GOOG', baseATR: 3 }] : [])];
  const db = withCaptureStore(makeTickDb({ battle, rankingsDoc: { ...makeRankingsDoc(), stocks: ranked }, techDocs: {} }));
  db.__stockLearning = new Map();
  const collection = db.collection.bind(db);
  const stories = variant === 'risk_then_model' ? [{ id: 'story-goog', data: () => ({ tickers: ['MSFT', 'GOOG'], headline: 'GOOG catalyst', summary: 'fixture', publishedAt: new Date(), category: 'catalyst' }) }] : [];
  const storyQuery = { where: () => storyQuery, orderBy: () => storyQuery, limit: () => storyQuery, get: async () => ({ docs: stories, empty: !stories.length, size: stories.length }) };
  db.collection = name => name === 'fantasyTimesStories' && stories.length ? storyQuery : name === 'learningReceipts' ? { doc: id => ({ collection: sub => ({ doc: rid => ({ create: async value => { const p = `${id}/${sub}/${rid}`; if (db.__stockLearning.has(p)) throw Error('already exists'); db.__stockLearning.set(p, structuredClone(value)); } }) }) }) } : collection(name);
  // Review K2-7: one transient battle read failure right after a committed swap.
  let refreshArmed = false;
  if (failRefreshRead) {
    const inner = db.collection;
    db.collection = name => { const c = inner(name); return name !== 'agentBattles' ? c : { ...c, doc: id => { const r = c.doc(id); return { ...r, get: async () => { if (refreshArmed) { refreshArmed = false; throw Object.assign(Error('14 UNAVAILABLE: transient read failure'), { code: 14 }); } return r.get(); } }; } }; };
  }
  db.doc = path => ({ path, id: path.split('/').at(-1), get: async () => ({ exists: !!inputs[path], data: () => structuredClone(inputs[path]) }) });
  const runTx = db.runTransaction.bind(db);
  db.runTransaction = cb => runTx(tx => cb({ ...tx, create: (ref, data) => { if (inputs[ref.path]) throw Error('already exists'); inputs[ref.path] = structuredClone(data); }, update: (ref, patch) => { tx.update(ref, patch); if (failRefreshRead && Object.hasOwn(patch, 'scoring.stockRosterVersion')) refreshArmed = true; } }));
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0, errors: 0 };
  let thrown = null;
  try { await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false }); } catch (err) { if (!failRefreshRead) throw err; thrown = err; }
  return { db, battle, summary, thrown };
}
describe('corrected evaluator and settlement use pinned model with admission false', () => {
  it.each(['risk', 'haiku', 'approved', 'expired', 'suppression', 'meeting'])('real common swap writer on evaluator route %s', async route => {
    const { db } = await stockTick(route);
    expect(runtime.executed.length, route).toBeGreaterThan(0);
    expect(db.__store.battle.portfolio.star[0].symbol, route).toBe('MSFT');
    expect(db.__store.battle.portfolio.star[0].stockThresholdReceipt.modelId).toBe('stock_measured_atr14_fullday_v2');
    expect(Object.keys(db.__store.battle.scoring.stockScoreComponents)).toContain('position-agent');
    const tick = permanentDoc(db, 'stock-battle', `stock-battle:${db.__store.battle.cronState.tickSeq}`);
    expect(tick.scores.total).toBe(db.__store.battle.scoreState.currentScore);
    expect(tick.scores.opponent).toBe(db.__store.battle.scoreState.opponentScore);
    // v2 Ruling 16: the capture row names the committed frame it copies.
    expect(tick.scores.stockModel).toEqual({ modelId: 'stock_measured_atr14_fullday_v2', policyHash: db.__store.battle.scoring.stockThresholdModel.policyHash, scoreVersion: db.__store.battle.scoring.stockScoreVersion, evidence: 'valid' });
    const learning = [...db.__stockLearning.values()][0];
    // v2 Ruling 16: L1 keeps its legacy fields beside the corrected references.
    expect(learning.guardrailReplay).toMatchObject({ outgoingBaseATR: 2.5, outgoingEntryPrice: 103.27 });
    expect(learning.stockRewardContract).toMatchObject({ stockThresholdModel: { modelId: 'stock_measured_atr14_fullday_v2' }, outgoingPositionId: 'position-agent', rewardContext: { status: 'valid' } });
    expect(learning.stockRewardContract.incomingReceipt.receiptHash).toBe(db.__store.battle.portfolio.star[0].stockThresholdReceipt.receiptHash);
    // Review K1-7: the calibrated lifetime history rides the corrected contract.
    expect(learning.stockRewardContract.outgoingRiskHistory).toEqual(db.__store.battle.scoring.stockRiskHistory.agent['position-agent']);
    expect(learning.stockRewardContract.outgoingRiskHistory).toMatchObject({ positionId: 'position-agent' });
  });
  // Review R1 sequencing, v2 form (Ruling 1). The fresh MSFT fill quote is
  // stamped 13:47 (15 minutes behind its fixture clock). A tick MSFT quote 17
  // minutes behind the 14:03 tick (13:46) predates that fill: the held lifetime
  // stands in at its fill and the exit has no post-fill evidence, so it refuses
  // with nothing written. Lag 0 (14:03) is strictly later: the exit banks.
  it.each([[17 * 60, 'refused'], [0, 'banked']])('R1: the fresh lifetime rotated out in its entry tick needs a post-fill exit quote (MSFT lag %ss → %s)', async (lag, outcome) => {
    const { db, summary } = await stockTick('risk_then_model', { quoteLagSec: lag });
    const b = db.__store.battle, fresh = b.trades[0].incomingPositionId;
    expect(runtime.executed.map(args => args[5].symbol)).toEqual(['MSFT', 'GOOG']);
    expect(summary.errors).toBe(0); expect(b.scoreState.stockScoreEvidence.status).toBe('valid');
    expect(b.trades[0]).toMatchObject({ symbolOut: 'AAPL', symbolIn: 'MSFT' });
    if (outcome === 'refused') {
      expect(b.portfolio.star[0]).toMatchObject({ symbol: 'MSFT', positionId: fresh });
      expect(b.trades).toHaveLength(1); expect(Object.keys(b.scoring.stockScoreComponents)).toEqual(['position-agent']);
      expect(b.evaluations.at(-1).validationErrors.join(' ')).toContain('missing_post_entry_quote');
      expect(b.scoreState.currentScore).toBe(0);
      return;
    }
    const t = b.trades[1];
    expect(t).toMatchObject({ symbolOut: 'MSFT', symbolIn: 'GOOG', outgoingPositionId: fresh, entryPrice: 103.27, exitPrice: 106, lockedGainPct: (106 - 103.27) / 103.27 * 100, lockedPoints: 68, rewardContext: { currentPrice: 106, quoteEvidence: { kind: 'post_fill_quote', providerAsOf: '2026-10-14T14:03:00.000Z' } } });
    expect(b.scoring.stockScoreComponents[fresh]).toMatchObject({ points: 68, exitPrice: 106, exitQuoteAsOf: '2026-10-14T14:03:00.000Z' });
    const captured = [...db.__stockLearning.values()].map(r => r.stockRewardContract).find(c => c?.outgoingPositionId === fresh);
    expect(captured).toMatchObject({ exitPrice: 106, lockedPoints: 68, rewardContext: { currentPrice: 106 } });
  });
  it('K2-7: a failed roster re-read after a committed model swap errors the tick and never logs a failed swap', async () => {
    const errors = []; vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args.map(String).join(' ')); });
    const { db, thrown } = await stockTick('haiku', { failRefreshRead: true });
    expect(thrown?.message).toContain('transient read failure');
    expect(db.__store.battle.portfolio.star[0].symbol).toBe('MSFT'); expect(db.__store.battle.trades).toHaveLength(1);
    expect(errors.some(e => e.includes('Swap execution failed'))).toBe(false);
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
  it('v2 Ruling 4: incomplete evidence ends the battle as result unavailable — no stats, reflection or review queue', async () => {
    const { battle, inputs } = await correctedStockBattle(); const h = stockWriterDb({ [`agentBattles/${battle.id}`]: battle, ...inputs });
    expect(await completeBattle(h.db, battle, {}, { everEnabled: false })).toMatchObject({ committed: true, resultUnavailable: true, disposition: { result: null, completionContext: 'corrected_score_unavailable', updateAgentStats: false, pendingReflection: false } });
    expect(h.store.get(`agentBattles/${battle.id}`)).toMatchObject({ status: 'completed', pendingReflection: false, reviewPending: false, completionContext: 'corrected_score_unavailable' });
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
  it('a concurrent roster change retries completion; the retry sees no valid final frame and ends result-unavailable with no career write', async () => {
    const { battle, inputs } = await correctedStockBattle(); battle.statusFeed = []; battle.evaluations = []; battle.cronState = {};
    const path = `agentBattles/${battle.id}`; let raced = false;
    const h = stockWriterDb({ [path]: battle, ...inputs, 'agents/agent': { activeBattleId: battle.id, stats: {} } }, { beforeCommit: ({ store, versions }) => {
      if (raced) return; raced = true; store.get(path).scoring.stockRosterVersion++; versions.set(path, (versions.get(path) || 0) + 1);
    } });
    const prices = { AAPL: { current: 103.27, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
    const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
    await h.db.doc(path).update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW)); h.writes.length = 0;
    expect(await completeBattle(h.db, battle, {}, { everEnabled: false })).toMatchObject({ committed: true, resultUnavailable: true });
    expect(h.attempts()).toBe(2); expect(h.store.get(path)).toMatchObject({ status: 'completed', completionContext: 'corrected_score_unavailable' });
    expect(h.store.get('agents/agent')).toEqual({ activeBattleId: null, stats: {} });
  });
});

// The real completion-time vision fixture (agent-evaluate.masteryCompletion.test.js).
const VISION = Object.freeze({
  state: 'active', thesis: 'test thesis', createdAt: { seconds: 1752000000, nanoseconds: 0 },
  transitionHistory: [{ fromState: 'forming', toState: 'active', actor: 'sonnet', cause: 'initial', timestamp: { seconds: 1752000000, nanoseconds: 0 } }],
});
const FLAG_ON = deriveFlagView({ entries: [{ state: 'enabled', at: '2026-07-19T00:00:00.000Z' }] }, true);
const commitValidFrame = async (h, battle) => {
  const prices = { AAPL: { current: 103.27, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
  const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
  await h.db.doc(`agentBattles/${battle.id}`).update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW));
};
describe('v2 Rulings 4 and 11: the result-unavailable terminal', () => {
  async function expired({ pointer = 'current', frame = 'none', stamp = null } = {}) {
    const { battle, inputs } = await correctedStockBattle();
    Object.assign(battle, { statusFeed: [], evaluations: [], cronState: { evaluatingAt: STOCK_TEST_NOW }, vision: VISION, agentContext: { archetype: 'degen' }, createdAt: STOCK_TEST_NOW, expiresAt: '2026-10-14T20:00:00.000Z' });
    if (stamp) battle.scoring.stockThresholdModel = stamp;
    const path = `agentBattles/${battle.id}`;
    const h = stockWriterDb({ [path]: battle, ...inputs, 'agents/agent': { ownerId: 'owner', activeBattleId: pointer === 'current' ? battle.id : 'next-battle', stats: { gamesPlayed: 3, wins: 1 } } });
    if (frame === 'valid' || frame === 'corrupt') await commitValidFrame(h, battle);
    if (frame === 'corrupt') h.store.get(battle.portfolio.star[0].stockThresholdReceipt.inputRef).general.Code = 'WRONG';
    h.writes.length = 0;
    return { battle, inputs, h, path, before: structuredClone(h.store.get(path)) };
  }
  it('writes exactly the §E3 set plus the retired vision; scoring, scores, trades, evaluations and inputs untouched; no stamp, stats or completionReason', async () => {
    const { battle, h, path, before } = await expired();
    // A stamp WOULD apply to this battle on a normal completion (a mastery subject after epoch 1).
    expect(Object.keys(maybeBuildEligibilityStampFields(before, FLAG_ON, '2026-10-14T20:05:00.000Z')).length).toBeGreaterThan(0);
    const out = await completeBattle(h.db, battle, {}, FLAG_ON);
    expect(out).toMatchObject({ committed: true, resultUnavailable: true, masteryStamped: false, disposition: { result: null, completionContext: RESULT_UNAVAILABLE_CONTEXT } });
    const battleWrites = h.writes.filter(([, p]) => p === path);
    expect(battleWrites).toHaveLength(1);
    const payload = battleWrites[0][2];
    expect(Object.keys(payload).sort()).toEqual(['completedAt', 'completionContext', 'cronState.evaluatingAt', 'pendingReflection', 'reviewPending', 'status', 'statusFeed', 'vision']);
    expect(payload).toMatchObject({ status: 'completed', completionContext: 'corrected_score_unavailable', pendingReflection: false, reviewPending: false, 'cronState.evaluatingAt': null });
    expect(payload.statusFeed).toEqual([{ timestamp: payload.completedAt, message: 'Result unavailable: incomplete pinned stock evidence.', action: 'battle_complete', source: 'system', score: null }]);
    expect(payload.vision).toMatchObject({ state: 'retired' });
    const after = h.store.get(path);
    for (const k of ['scoring', 'scoreState', 'trades', 'evaluations', 'portfolio', 'opponent', 'thresholdHistory']) expect(after[k], k).toEqual(before[k]);
    for (const k of ['completionReason', 'reflectedAt', 'masteryEligibility', 'masteryAwardPending', 'receiptCoverage', 'result']) expect(Object.hasOwn(after, k), k).toBe(false);
    expect(h.store.get('agents/agent')).toEqual({ ownerId: 'owner', activeBattleId: null, stats: { gamesPlayed: 3, wins: 1 } });
    expect(h.writes.filter(([, p]) => p !== path && p !== 'agents/agent')).toEqual([]);
    // A completed result-unavailable battle reads as no result for every later reader (film tape).
    expect(resolveCompletionDisposition({ id: battle.id, ...after })).toMatchObject({ result: null, completionContext: 'corrected_score_unavailable' });
    // Idempotent: a second run writes nothing.
    const n = h.writes.length; expect(await completeBattle(h.db, battle, {}, FLAG_ON)).toMatchObject({ committed: false }); expect(h.writes).toHaveLength(n);
  });
  it('releases the agent pointer only while it still names this battle', async () => {
    const { battle, h } = await expired({ pointer: 'moved' });
    await completeBattle(h.db, battle, {}, FLAG_ON);
    expect(h.store.get('agents/agent')).toEqual({ ownerId: 'owner', activeBattleId: 'next-battle', stats: { gamesPlayed: 3, wins: 1 } });
    expect(h.writes.filter(([, p]) => p === 'agents/agent')).toEqual([]);
  });
  it('corrupt inputs behind a valid-looking final frame still end the battle (never depends on readCorrectedInputs)', async () => {
    const { battle, h, path } = await expired({ frame: 'corrupt' });
    expect(await completeBattle(h.db, battle, {}, FLAG_ON)).toMatchObject({ committed: true, resultUnavailable: true });
    expect(h.store.get(path)).toMatchObject({ status: 'completed', completionContext: 'corrected_score_unavailable', pendingReflection: false });
    expect(h.store.get('agents/agent').stats).toEqual({ gamesPlayed: 3, wins: 1 });
  });
  it('a transient read failure while replaying inputs is retried next run, never a terminal write', async () => {
    const { battle, h, path, before } = await expired({ frame: 'valid' });
    const runTx = h.db.runTransaction;
    h.db.runTransaction = fn => runTx(tx => fn({ ...tx, get: async r => { if (r.path.startsWith('stockThresholdInputs/')) throw Object.assign(Error('14 UNAVAILABLE'), { code: 14 }); return tx.get(r); } }));
    await expect(completeBattle(h.db, battle, {}, FLAG_ON)).rejects.toThrow('14 UNAVAILABLE');
    expect(h.writes).toEqual([]); expect(h.store.get(path)).toEqual(before);
  });
  it('a valid final frame with replaying inputs settles normally (win/loss/draw, stats, reflection)', async () => {
    const { battle, h, path } = await expired({ frame: 'valid' });
    expect(await completeBattle(h.db, battle, {}, { everEnabled: false })).toMatchObject({ committed: true, disposition: { result: 'draw', pendingReflection: true } });
    expect(h.store.get(path).completionContext).toBeUndefined();
    expect(h.store.get('agents/agent').stats.gamesPlayed).toBe(4);
  });
  it('a route-unavailable stamp (a retired v1 tuple) still ends the battle', async () => {
    const v1 = { modelId: 'stock_measured_atr14_fullday_v1', publicationRuleId: 'eodhd_us_completed_session_observation_v1', policyHash: 'baa2b39688b673c93190540f500307ae7ad4aba7a07228ca23ba1f2afe1bf9f8', publicationRuleHash: '3ad8e14b203acd660faba9b8ec7e78c7dcb9f312741ec04cd062bcf79741a85f', approvedPolicyRef: 'owner_baggerbomb_stock_thresholds_v1_20261013@v1', admittedAt: STOCK_TEST_NOW };
    const { battle, h, path } = await expired({ stamp: v1 });
    expect(await completeBattle(h.db, battle, {}, FLAG_ON)).toMatchObject({ committed: true, resultUnavailable: true });
    expect(h.store.get(path)).toMatchObject({ status: 'completed', completionContext: 'corrected_score_unavailable' });
  });
});

describe('v2 Ruling 3: an unavailable corrected frame continues the tick', () => {
  const nowIso = () => new Date().toISOString();
  it('the calibrated risk pass still executes an EMERGENCY exit; the model is withheld; every score written is null, never 0', async () => {
    const { db, summary } = await stockTick('risk', { cpuSymbol: 'GOOG', undated: ['GOOG'] });
    const b = db.__store.battle;
    expect(runtime.executed).toHaveLength(1); expect(b.portfolio.star[0].symbol).toBe('MSFT'); expect(b.trades).toHaveLength(1);
    expect(b.scoreState).toMatchObject({ currentScore: null, opponentScore: null, stockScoreEvidence: { status: 'unavailable' } });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(b.cronState.evaluatingAt).toBe(null); expect(b.cronState.lastEvaluatedAt).toBe(nowIso());
    const scored = (b.statusFeed || []).filter(e => Object.hasOwn(e, 'score'));
    expect(scored.length).toBeGreaterThan(0); expect(scored.map(e => e.score)).toEqual(scored.map(() => null));
    expect(summary.errors).toBe(0);
  });
  it.each(['final', 'passive', 'proposal_pending', 'gameplan_pending'])('the %s exit on an unavailable frame runs finalizeCronState and the normal final write', async variant => {
    const { db, summary } = await stockTick(variant, { cpuSymbol: 'GOOG', undated: ['GOOG'] });
    const b = db.__store.battle;
    expect(summary.errors).toBe(0);
    expect(b.scoreState).toMatchObject({ currentScore: null, opponentScore: null, stockScoreEvidence: { status: 'unavailable' } });
    expect(b.cronState.evaluatingAt).toBe(null); expect(b.cronState.lastEvaluatedAt).toBe(nowIso());
    expect(mocks.create).not.toHaveBeenCalled();
    expect((b.statusFeed || []).filter(e => Object.hasOwn(e, 'score') && e.score === 0)).toEqual([]);
  });
  it('the R11 deterministic pass runs its standing orders on an unavailable frame, and its beats carry a null score', async () => {
    const { db } = await stockTick('suppression', { cpuSymbol: 'GOOG', undated: ['GOOG'] });
    const b = db.__store.battle;
    expect(runtime.executed).toHaveLength(1); expect(b.portfolio.star[0].symbol).toBe('MSFT');
    const scored = (b.statusFeed || []).filter(e => Object.hasOwn(e, 'score'));
    expect(scored.length).toBeGreaterThan(0); expect(scored.every(e => e.score === null)).toBe(true);
    expect(b.cronState.evaluatingAt).toBe(null);
  });
  it('every feed, proposal and completion score site rounds through feedScore (null stays null; legacy rounding unchanged)', () => {
    const source = readFileSync(new URL('./agent-evaluate.js', import.meta.url), 'utf8');
    expect(source.match(/(score|scoreAtProposal): Math\.round\(currentScore \* 100\) \/ 100/g)).toBe(null);
    expect((source.match(/(score|scoreAtProposal): feedScore\(currentScore\)/g) || []).length).toBe(18);
    expect([feedScore(null), feedScore(undefined), feedScore(0), feedScore(-12.344), feedScore(7.005)]).toEqual([null, null, 0, -12.34, Math.round(7.005 * 100) / 100]);
  });
  it('a valid frame still reaches the model, whose system prompt names the frozen measured % as the divisor (Ruling 10)', async () => {
    await stockTick('final');
    expect(mocks.create).toHaveBeenCalled();
    const request = JSON.stringify(mocks.create.mock.calls[0][0]);
    expect(request).toContain('FROZEN MEASURED %'); expect(request).toContain('the divisor is never baseATR');
    expect(request).not.toContain('ATR multiplier = priceChange% / baseATR crosses level');
  });
});
