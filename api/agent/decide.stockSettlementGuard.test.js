// Real handler, prescribed helper, stored-model dispatcher and qualified
// completion writer: Node-clean dependency-surface guard, never mocked.
// Only provider/model/auth/infrastructure edges are replaced; no live data.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stored } from '../_utils/__fixtures__/callsFirestore.js';
import * as H from '../_utils/__fixtures__/deployHarness.js';
import { correctedStockBattle, STOCK_TEST_NOW } from '../_utils/__fixtures__/stockThresholdHarness.js';
const state = vi.hoisted(() => ({ db: null, admission: false, model: vi.fn(), prices: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class { constructor() { this.messages = { create: state.model }; } } }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));
vi.mock('../_utils/security.js', async original => ({ ...await original(), applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', async original => ({ ...await original(), requireAuth: async () => ({ uid: H.OWNER }) }));
vi.mock('../_utils/marketDataCache.js', async original => ({ ...await original(), getStockAnalysisData: (...args) => state.prices(...args) }));
vi.mock('../../src/config/featureFlags.js', async original => ({ ...await original(), get STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED() { return state.admission; } }));
import handler, { runPrescribedTournamentDeploy } from './decide.js';
import { completeBattle } from '../cron/agent-evaluate.js';
import { correctedScorePatch, scoreCorrectedPosition } from '../_utils/stockThresholdAdmission.js';
import { STOCK_MODEL } from '../../src/utils/stockThresholdModel.js';
const PATH = `agents/${H.AGENT_ID}`, BATTLE = 'agentBattles/prior';
let env;
beforeEach(() => {
  env = { cron: process.env.CRON_SECRET, key: process.env.EODHD_API_KEY };
  process.env.CRON_SECRET = H.CRON_SECRET; process.env.EODHD_API_KEY = 'isolated-key';
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(STOCK_TEST_NOW));
  state.admission = false; state.model.mockReset(); state.prices.mockReset().mockImplementation(H.priceAnswer);
});
afterEach(() => {
  for (const [key, value] of [['CRON_SECRET', env.cron], ['EODHD_API_KEY', env.key]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  vi.useRealTimers(); vi.restoreAllMocks();
});
async function fixture({ stamp = STOCK_MODEL, pointer = 'prior', active = true, expired = true } = {}) {
  const { battle, inputs } = await correctedStockBattle();
  Object.assign(battle, { id: 'prior', agentId: H.AGENT_ID, status: active ? 'active' : 'completed', expiresAt: expired ? '2026-10-14T14:01:00.000Z' : '2026-10-14T15:00:00.000Z' });
  battle.scoring.stockThresholdModel = stamp === STOCK_MODEL ? { ...STOCK_MODEL, admittedAt: STOCK_TEST_NOW } : stamp;
  const agent = H.agentDoc({ over: { activeBattleId: pointer, deployingAt: STOCK_TEST_NOW, lastDecision: { saved: 'decision' }, activeRules: [{ saved: 'rules' }], updatedAt: '2026-10-12T15:00:00Z', lastConflictReport: { saved: 'report' }, deployProgress: { saved: 'progress' } } });
  state.db = H.makeDeployDb(H.seedDeploy({ agent, extra: { [BATTLE]: battle, ...inputs } }));
  return { agent, battle, res: H.makeRes(), before: structuredClone(stored(state.db, PATH)) };
}
async function deploy(f, fullHandler = false, body = {}) {
  const req = H.tournamentRequest({ isCpu: true, ...body });
  if (fullHandler) {
    await state.db.collection('agents').doc(H.AGENT_ID).update({ deployingAt: null }); state.db.__access.writes.length = 0;
    await handler(req, f.res);
  } else {
    await runPrescribedTournamentDeploy({ db: state.db, req, res: f.res, agentRef: state.db.collection('agents').doc(H.AGENT_ID), agent: f.agent, agentId: H.AGENT_ID });
  }
}
function protectedState(f, fullHandler = false) {
  expect(f.res.statusCode).toBe(503);
  expect(f.res.body).toMatchObject({ reason: 'prior_corrected_battle_requires_settlement', retriable: true, existingBattleId: 'prior' });
  expect(stored(state.db, BATTLE)).toEqual(f.battle);
  expect(stored(state.db, PATH)).toEqual({ ...f.before, deployingAt: null });
  const writes = state.db.__access.writes;
  expect(writes).toHaveLength(fullHandler ? 2 : 1);
  expect(writes.every(w => w.path === PATH && Object.keys(w.data).join() === 'deployingAt')).toBe(true);
  expect(state.model).not.toHaveBeenCalled(); expect(state.prices).not.toHaveBeenCalled();
  expect([...state.db.__docs.keys()].filter(p => p.startsWith('agentBattles/'))).toEqual([BATTLE]);
}
describe('owner-approved prescribed tournament stock settlement refusal', () => {
  it.each([false, true])('expired corrected helper protection is independent of admission %s', async enabled => {
    state.admission = enabled; const f = await fixture(); await deploy(f); protectedState(f); expect(f.res.body.modelStatus).toBe('corrected');
  });
  it.each([null, {}, { ...STOCK_MODEL, admittedAt: STOCK_TEST_NOW, policyHash: 'bad' }, { ...STOCK_MODEL, admittedAt: STOCK_TEST_NOW, modelId: 'future' }])('present invalid/unsupported stamp %j refuses without durable writes', async stamp => {
    const f = await fixture({ stamp }); await deploy(f); protectedState(f); expect(f.res.body.modelStatus).toBe('unavailable');
  });
  it.each(['prior', null])('real handler refuses before loadout persistence with pointer %j', async pointer => {
    const f = await fixture({ pointer }); await deploy(f, true); protectedState(f, true);
    expect(state.db.__access.writes.some(w => Object.hasOwn(w.data, 'activeRules'))).toBe(false);
  });
  it('refusal does not restore stale metadata over a concurrent agent edit', async () => {
    const f = await fixture();
    await state.db.collection('agents').doc(H.AGENT_ID).update({ lastDecision: { edited: true }, lastDeployedAt: '2026-10-13T22:00:00Z', activeBattleId: 'new-pointer', updatedAt: '2026-10-13T22:00:00Z' });
    f.before = structuredClone(stored(state.db, PATH)); state.db.__access.writes.length = 0;
    await deploy(f); protectedState(f);
  });
  it.each(['prior', null])('helper rechecks a corrected battle appearing during loadout reads, pointer %j', async pointer => {
    const f = await fixture({ pointer, active: false }); let injected = false;
    state.db.__hooks.afterQuery = async ({ collectionPath }) => {
      if (collectionPath !== 'indexIntelligence' && collectionPath !== `agents/${H.AGENT_ID}/rules`) return;
      if (!injected) { injected = true; state.db.__docs.get(BATTLE).status = 'active'; f.battle.status = 'active'; }
    };
    await deploy(f, true); protectedState(f, true); expect(injected).toBe(true);
  });
  it('unstamped expired game keeps legacy GC, prescribed creation and calibrated rules', async () => {
    const f = await fixture(); delete f.battle.scoring.stockThresholdModel; state.db.__docs.set(BATTLE, structuredClone(f.battle));
    await deploy(f);
    expect(f.res.statusCode).toBe(200); expect(f.res.body.battleCreated).toBe(true);
    expect(stored(state.db, BATTLE)).toEqual({ ...f.battle, status: 'completed', completedAt: STOCK_TEST_NOW, completionReason: 'expired' });
    expect(stored(state.db, PATH).lastDeployedAt).toBe(STOCK_TEST_NOW); expect(stored(state.db, PATH).lastDecision.models.portfolio).toBe('prescribed');
    const created = stored(state.db, `agentBattles/${f.res.body.agentBattleId}`);
    expect(created.gameMode).toBe('baggerbomb_tournament'); expect(created.opponent).toBeNull(); expect(created.scoring.stockThresholdModel).toBeUndefined();
    expect(state.model).not.toHaveBeenCalled();
  });
  it('nonexpired legacy battle keeps portfolio-update response and existing pointer', async () => {
    const f = await fixture({ expired: false }); delete f.battle.scoring.stockThresholdModel; state.db.__docs.set(BATTLE, structuredClone(f.battle));
    await deploy(f); expect(f.res.statusCode).toBe(200); expect(f.res.body).toMatchObject({ battleCreated: false, portfolioUpdated: true, existingBattleId: 'prior' });
    expect(stored(state.db, BATTLE)).toEqual(f.battle); expect(stored(state.db, PATH).activeBattleId).toBe('prior'); expect(state.prices).not.toHaveBeenCalled();
  });
  it('crossing expiry during the decision write never sends a corrected snapshot into legacy GC', async () => {
    const f = await fixture({ expired: false }); f.battle.expiresAt = new Date(Date.parse(STOCK_TEST_NOW) + 1000).toISOString(); state.db.__docs.set(BATTLE, structuredClone(f.battle));
    const ref = state.db.collection('agents').doc(H.AGENT_ID), update = ref.update.bind(ref);
    ref.update = async patch => { await update(patch); if (patch.lastDecision) vi.setSystemTime(new Date(Date.parse(STOCK_TEST_NOW) + 2000)); };
    await runPrescribedTournamentDeploy({ db: state.db, req: H.tournamentRequest({ isCpu: true }), res: f.res, agentRef: ref, agent: f.agent, agentId: H.AGENT_ID });
    expect(f.res.body).toMatchObject({ battleCreated: false, existingBattleId: 'prior' }); expect(stored(state.db, BATTLE)).toEqual(f.battle);
    expect(state.db.__access.writes.some(w => w.path === BATTLE)).toBe(false);
  });
  it.each(['projection_stale_generation', 'epoch_closed'])('deferred projection %s retains the original 409 before durable deployment writes', async code => {
    const f = await fixture({ pointer: null, active: false });
    state.db.__hooks.beforeCommit = async ({ writes }) => {
      if (writes.some(w => Object.hasOwn(w.data, 'activeRules'))) { const error = new Error('isolated projection refusal'); error.code = code; throw error; }
    };
    await deploy(f, true); expect(f.res.statusCode).toBe(409); expect(f.res.body).toEqual({ error: code });
    expect(stored(state.db, PATH)).toEqual({ ...f.before, deployingAt: null }); expect(stored(state.db, BATTLE)).toEqual(f.battle);
    expect(state.db.__access.writes).toHaveLength(2); expect(state.db.__access.writes.every(w => Object.keys(w.data).join() === 'deployingAt')).toBe(true);
    expect(state.model).not.toHaveBeenCalled(); expect(state.prices).not.toHaveBeenCalled();
  });
  it('ordinary deferred projection error preserves the original fail-open prescribed deployment', async () => {
    const f = await fixture({ pointer: null, active: false }); let injected = false;
    state.db.__hooks.beforeCommit = async ({ writes }) => {
      if (!injected && writes.some(w => Object.hasOwn(w.data, 'activeRules'))) { injected = true; throw Error('isolated projection transport error'); }
    };
    await deploy(f, true); expect(injected).toBe(true); expect(f.res.statusCode).toBe(200); expect(f.res.body.battleCreated).toBe(true);
    expect(stored(state.db, PATH).activeRules).toEqual(f.before.activeRules); expect(stored(state.db, PATH).lastDecision.models.portfolio).toBe('prescribed');
    expect(state.model).not.toHaveBeenCalled();
  });
  it.each(['group', 'rankings', 'prescription'])('legacy %s validation failure preserves the original projected loadout and durable metadata', async failure => {
    const f = await fixture({ pointer: null, active: false });
    if (failure === 'rankings') state.db.__docs.delete('indexIntelligence/stockRankings');
    const body = failure === 'group' ? { groupId: '' } : failure === 'prescription' ? { prescribedPortfolio: ['AAPL'] } : {};
    await deploy(f, true, body);
    expect(f.res.statusCode).toBe(failure === 'rankings' ? 503 : 400);
    expect(stored(state.db, PATH)).toEqual({ ...f.before, activeRules: [], deployingAt: null });
    expect(state.db.__access.writes.map(w => Object.keys(w.data).join())).toEqual(['deployingAt', 'activeRules', 'deployingAt']);
    expect(stored(state.db, BATTLE)).toEqual(f.battle); expect(state.model).not.toHaveBeenCalled(); expect(state.prices).not.toHaveBeenCalled();
  });
  it('retry proceeds only after the real qualified completion writer settles the existing game', async () => {
    // Use receipt-bound IDs from the arithmetic fixture; rewrite only agentId,
    // never receipt-bound battle ID, before putting it in the store.
    const { battle, inputs } = await correctedStockBattle(); battle.agentId = H.AGENT_ID; Object.assign(battle, { statusFeed: [], evaluations: [], cronState: {}, expiresAt: '2026-10-14T14:01:00Z' });
    const path = `agentBattles/${battle.id}`, agent = H.agentDoc({ over: { activeBattleId: battle.id, deployingAt: STOCK_TEST_NOW } });
    state.db = H.makeDeployDb(H.seedDeploy({ agent, extra: { [path]: battle, ...inputs } }));
    const req = H.tournamentRequest({ isCpu: true }), args = { db: state.db, req, agentRef: state.db.collection('agents').doc(H.AGENT_ID), agent, agentId: H.AGENT_ID };
    const refused = H.makeRes(); await runPrescribedTournamentDeploy({ ...args, res: refused }); expect(refused.statusCode).toBe(503);
    const q = { AAPL: { current: 103.27, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
    const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, q, STOCK_TEST_NOW));
    await state.db.collection('agentBattles').doc(battle.id).update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW));
    expect(await completeBattle(state.db, battle, {}, { everEnabled: false })).toMatchObject({ committed: true });
    const settled = structuredClone(stored(state.db, path)); state.db.__access.writes.length = 0;
    const retry = H.makeRes(); await runPrescribedTournamentDeploy({ ...args, res: retry });
    expect(retry.statusCode).toBe(200); expect(retry.body.battleCreated).toBe(true); expect(stored(state.db, path)).toEqual(settled);
    expect(state.db.__access.writes.some(w => w.path === path)).toBe(false); expect(stored(state.db, PATH).stats.gamesPlayed).toBe(5);
  });
});
