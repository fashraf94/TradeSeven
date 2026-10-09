// api/agent/decide.carriage.test.js
//
// Pilot P1b — THE DEPLOY ENDPOINT WITH THE GATE ON (acceptance rows 2–5 end to
// end; founder rulings B2, B5, B6). The same real deploy the off golden
// photographs (api/agent/decide.carriageOffGolden.test.js — the same harness,
// the same scenarios, the same doubles), now with the record slice ON for the
// owner, compared against the golden captured from `main`:
//   · CARRIED: the prompt bytes, the voice opener's prompt, the shadow logs, the
//     response and the agent document are byte-identical to gate off; the
//     battle is identical except for the sibling; equippedConfigHash is
//     unchanged; every non-hypothesis store write is unchanged; the creation
//     transaction ALSO reads the version and writes its activation and row;
//   · the prescribed tournament branch, a deploy with no equip and an
//     uncommitted list are byte-identical to gate off (zero version reads);
//   · a due idea is REFUSED before any battle work: no model call, no battle,
//     the cooldown untouched, the ceremony told "no battle";
//   · drafts only, and an existing active battle, deploy exactly as gate off
//     (one version read, nothing written to any record);
//   · B6 redeploy and the B5 clock fallback through the handler;
//   · THE RACE through the handler: the deploy fails cleanly — 500 with the
//     race sentence as `details`, errorPhase post_decision, no battle, no
//     version change, no row, the lock released;
//   · the attacker lens: a client body naming a version is ignored; an equip
//     pointer to a list the owner does not own carries nothing.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const state = vi.hoisted(() => ({ db: null, anthropic: null, gemmaCalls: [], shadow: { decisions: [], firstMessages: [] }, flag: false }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicDouble {
    constructor() { this.messages = { create: (args) => state.anthropic.create(args) }; }
  },
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));
vi.mock('../_utils/security.js', async (importOriginal) => ({ ...(await importOriginal()), applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', async (importOriginal) => ({ ...(await importOriginal()), requireAuth: async () => ({ uid: 'p1b-owner-1' }) }));
vi.mock('../_utils/marketDataCache.js', async (importOriginal) => {
  const { priceAnswer } = await import('../_utils/__fixtures__/deployHarness.js');
  return { ...(await importOriginal()), getStockAnalysisData: (symbol) => priceAnswer(symbol) };
});
vi.mock('../_utils/shadowLogger.js', () => ({
  logDecision: async (args) => { state.shadow.decisions.push(JSON.parse(JSON.stringify(args))); },
  logFirstMessage: async (args) => { state.shadow.firstMessages.push(JSON.parse(JSON.stringify(args))); },
}));
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: async ({ systemPrompt, conversationHistory, userMessage }) => {
    state.gemmaCalls.push({ systemPrompt, conversationHistory, userMessage });
    return '{"response":"Opening line."}';
  },
  parseVoiceLayerResponse: () => ({ response: 'Opening line.', _scratchpad: null }),
}));
vi.mock('firebase-admin/firestore', async () => {
  const { FieldValueDouble } = await import('../_utils/__fixtures__/callsFirestore.js');
  return { FieldValue: FieldValueDouble };
});
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return state.flag; } };
});

const H = await import('../_utils/__fixtures__/deployHarness.js');
const { SCENARIOS, version, DEPLOYED } = await import('../_utils/__fixtures__/deployScenarios.js');
const { stored } = await import('../_utils/__fixtures__/callsFirestore.js');
const { SIBLING_KEYS, siblingOf } = await import('../_utils/hypothesisRecords/carriage.js');
const { computeReviewDueAt } = await import('../_utils/hypothesisRecords/horizon.js');
const { DUE_DEPLOY_LINE, CARRIAGE_RACE_MESSAGE } = await import('../../src/constants/hypothesisRecords.js');
const { default: handler } = await import('./decide.js');
const { runHypothesisReviewPass } = await import('../_utils/hypothesisRecords/reviewPass.js');
const { default: versionsRoute } = await import('../forge/watchlists/[id]/hypothesis-versions.js');
const { lifecycleLineFor } = await import('../../src/components/Forge/Watchlist/ideaCopy.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(resolve(HERE, '../_utils/__fixtures__/deployCarriageOffGolden.json'), 'utf8').replace(/\r\n/g, '\n'));
const ALLOWLIST_ENV = 'COCKPIT_ALLOWLIST_UIDS';
const vPath = (n) => `watchlists/${H.WATCHLIST_ID}/hypothesisVersions/v${n}`;
const rowPath = (n) => `hypothesisReviewQueue/${H.WATCHLIST_ID}:${n}`;
const isHyp = (p) => typeof p === 'string' && /hypothesisVersions|hypothesisReviewQueue|hypothesisReviewState/.test(p);

/** Run one deploy with the gate ON (flag true, the owner allowlisted) or OFF. */
async function run({ docs, req }, { gate = 'on', beforeHandler = null } = {}) {
  state.db = H.makeDeployDb(docs);
  state.anthropic = H.makeAnthropicDouble();
  state.gemmaCalls = [];
  state.shadow = { decisions: [], firstMessages: [] };
  state.flag = gate === 'on';
  process.env[ALLOWLIST_ENV] = H.OWNER;
  Math.random.mockImplementation(H.seededRandom());
  if (beforeHandler) beforeHandler(state.db);
  const res = H.makeRes();
  await handler(req, res);
  await new Promise((r) => setTimeout(r, 0));
  return { cap: H.captureDeploy({ db: state.db, res, anthropic: state.anthropic, gemmaCalls: state.gemmaCalls, shadow: state.shadow }), db: state.db };
}
const stripSibling = (battle) => {
  if (!battle?.agentContext || !('equippedHypothesis' in battle.agentContext)) return battle;
  const agentContext = { ...battle.agentContext };
  delete agentContext.equippedHypothesis;
  return { ...battle, agentContext };
};
/**
 * The capture with every hypothesis-record access and document removed, and
 * the sibling taken off the battle (its create write and its final document) —
 * what must equal gate off exactly.
 */
function withoutRecords(cap) {
  const isBattle = (p) => /^agentBattles\/[^/]+$/.test(p);
  const docs = Object.fromEntries(Object.entries(cap.docs).filter(([p]) => !isHyp(p)).map(([p, d]) => [p, isBattle(p) ? stripSibling(d) : d]));
  return {
    ...cap,
    store: {
      reads: cap.store.reads.filter((p) => !isHyp(p)),
      queries: cap.store.queries.filter((q) => !isHyp(`${q.collectionPath}/`)),
      writes: cap.store.writes.filter((w) => !isHyp(w.path)).map((w) => (w.op === 'create' && isBattle(w.path) ? { ...w, data: stripSibling(w.data) } : w)),
      txAttempts: cap.store.txAttempts,
    },
    docs,
  };
}

let savedEnv;
beforeEach(() => {
  savedEnv = { allow: process.env[ALLOWLIST_ENV], cron: process.env.CRON_SECRET };
  process.env.CRON_SECRET = H.CRON_SECRET;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(H.FROZEN_NOW));
  vi.spyOn(Math, 'random').mockImplementation(H.seededRandom());
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (savedEnv.allow === undefined) delete process.env[ALLOWLIST_ENV]; else process.env[ALLOWLIST_ENV] = savedEnv.allow;
  if (savedEnv.cron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = savedEnv.cron;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
describe('acceptance row 2 — gate ON, carried: everything the agent and the manifest see is gate OFF\'s, byte for byte', () => {
  it('the newest ready version rides as the sibling; prompts, voice opener, shadow logs, response, agent doc and every non-record write equal main\'s capture; equippedConfigHash unchanged', async () => {
    const { cap } = await run(SCENARIOS.self_select_ready_over_activated());
    const off = GOLDEN.scenarios.self_select_ready_over_activated;
    expect(cap.response).toEqual(off.response);
    expect(cap.modelRequests).toEqual(off.modelRequests); // prompt bytes, tool schemas, model, temperature
    expect(cap.voiceRequests).toEqual(off.voiceRequests);
    expect(cap.shadow).toEqual(off.shadow);
    const id = cap.response.body.agentBattleId;
    const battle = cap.docs[`agentBattles/${id}`];
    const offBattle = off.docs[`agentBattles/${id}`];
    expect(stripSibling(battle)).toEqual(offBattle);
    expect(battle.resolvedAgentManifest.equippedConfigHash).toBe(offBattle.resolvedAgentManifest.equippedConfigHash);
    expect(Object.keys(battle.agentContext.equippedHypothesis)).toEqual([...SIBLING_KEYS]);
    expect(battle.agentContext.equippedHypothesis).toMatchObject({ watchlistId: H.WATCHLIST_ID, hypothesisVersion: 2, statement: 'Idea version 2' });
    expect(battle.agentContext.equippedWatchlist).toEqual(offBattle.agentContext.equippedWatchlist); // the snapshot is untouched
    expect(cap.docs[`agents/${H.AGENT_ID}`]).toEqual(off.docs[`agents/${H.AGENT_ID}`]);
    expect(withoutRecords(cap)).toEqual(withoutRecords(off));
    // What the record slice added: one bounded version read before the battle work, the fresh read inside the
    // creation transaction, and — in that same commit — the activation and the armed row.
    expect(cap.store.queries.filter((q) => isHyp(`${q.collectionPath}/`))).toHaveLength(1);
    expect(cap.store.writes.filter((w) => isHyp(w.path)).map((w) => `${w.op}:${w.path}`)).toEqual([`update:${vPath(2)}`, `set:${rowPath(2)}`]);
    const createAt = cap.store.writes.findIndex((w) => w.op === 'create' && w.path === `agentBattles/${id}`);
    expect(cap.store.writes[createAt + 1].path).toBe(vPath(2));
    expect(cap.docs[vPath(2)]).toMatchObject({ status: 'activated', firstDeployedAt: battle.createdAt, lastDeployedBattleId: id, stateSource: 'deploy', stateReason: 'deployed' });
    expect(cap.docs[vPath(1)]).toEqual(off.docs[vPath(1)]); // the older activated version is untouched
    expect(cap.docs[rowPath(2)]).toEqual({
      userId: H.OWNER, watchlistId: H.WATCHLIST_ID, version: 2, battleId: id,
      dueAtMs: computeReviewDueAt('swing', Date.parse(battle.createdAt)), armedAt: Date.parse(battle.createdAt),
    });
  }, 20_000);
  it('the prescribed TOURNAMENT branch never carries: byte-identical to main, zero version reads, the ready idea untouched', async () => {
    const { cap } = await run(SCENARIOS.tournament_prescribed_with_ready_idea());
    expect(cap).toEqual(GOLDEN.scenarios.tournament_prescribed_with_ready_idea);
    expect(H.hypothesisAccess(cap)).toEqual({ reads: [], queries: [], writes: [] });
  }, 20_000);
  it('no equip, or an uncommitted list (no frozen snapshot): byte-identical to main, zero version reads', async () => {
    for (const name of ['self_select_no_equip', 'self_select_uncommitted_list']) {
      const { cap } = await run(SCENARIOS[name]());
      expect(cap, name).toEqual(GOLDEN.scenarios[name]);
    }
  }, 30_000);
});

describe('acceptance row 3 — B2 through the endpoint', () => {
  it('DUE with no ready successor → 409 with table C\'s line, BEFORE any battle work: no model call, no battle, no record write, the cooldown untouched, the ceremony told no battle', async () => {
    const { cap } = await run(SCENARIOS.self_select_due_no_ready());
    expect(cap.response).toEqual({ status: 409, body: { error: 'hypothesis_review_due', message: DUE_DEPLOY_LINE } });
    expect(cap.modelRequests).toEqual([]);
    expect(cap.voiceRequests).toEqual([]);
    expect(Object.keys(cap.docs).filter((p) => p.startsWith('agentBattles/'))).toEqual([]);
    expect(cap.store.writes.filter((w) => isHyp(w.path))).toEqual([]);
    const agent = cap.docs[`agents/${H.AGENT_ID}`];
    expect(agent.deployingAt).toBeNull();
    expect(agent.lastDeployedAt).toBe('2026-10-12T15:00:00.000Z'); // not consumed
    expect(agent.lastDecision).toBeUndefined();
    expect(agent.deployProgress).toMatchObject({ stage: 'error', errorPhase: 'pre_decision' });
    // The refusal is the last write; nothing after it.
    expect(cap.store.writes.at(-1)).toMatchObject({ op: 'update', path: `agents/${H.AGENT_ID}`, data: { deployingAt: null, 'deployProgress.stage': 'error', 'deployProgress.errorPhase': 'pre_decision' } });
  }, 20_000);
  it('a REAFFIRMED successor deploys (v1 due, v2 ready by reaffirmation → v2 carried and activated; v1 keeps its record)', async () => {
    const due = version(1, { status: 'review_due', ...DEPLOYED('battle-old-1'), stateSource: 'review_pass', stateReason: 'horizon_elapsed', successorVersion: 2 });
    const { cap } = await run({ docs: H.seedDeploy({ versions: [due, version(2, { stateReason: 'reaffirmed' })] }), req: H.clientRequest() });
    expect(cap.response.status).toBe(200);
    const battle = cap.docs[`agentBattles/${cap.response.body.agentBattleId}`];
    expect(battle.agentContext.equippedHypothesis.hypothesisVersion).toBe(2);
    expect(cap.docs[vPath(2)].status).toBe('activated');
    expect(cap.docs[vPath(1)]).toEqual(due);
  }, 20_000);
  it('drafts or terminal statuses only → nothing carried; the deploy equals the same deploy gate-off except the one version read', async () => {
    const seedOf = () => ({ docs: H.seedDeploy({ versions: [version(1, { status: 'retired' }), version(2, { status: 'rejected' }), version(3, { status: 'draft' })] }), req: H.clientRequest() });
    const { cap: on } = await run(seedOf());
    const { cap: off } = await run(seedOf(), { gate: 'off' });
    expect(H.hypothesisAccess(off)).toEqual({ reads: [], queries: [], writes: [] });
    expect(H.hypothesisAccess(on).queries).toHaveLength(1);
    expect(H.hypothesisAccess(on).writes).toEqual([]);
    expect(withoutRecords(on)).toEqual(withoutRecords(off));
    expect('equippedHypothesis' in on.docs[`agentBattles/${on.response.body.agentBattleId}`].agentContext).toBe(false);
  }, 30_000);
  it('an existing ACTIVE battle (the portfolio refresh): no battle is created, so nothing is activated — equal to main except the version read', async () => {
    const { cap } = await run(SCENARIOS.self_select_existing_active_battle());
    const off = GOLDEN.scenarios.self_select_existing_active_battle;
    expect(H.hypothesisAccess(cap).writes).toEqual([]);
    expect(withoutRecords(cap)).toEqual(withoutRecords(off));
    expect(cap.docs[vPath(1)]).toEqual(off.docs[vPath(1)]);
  }, 20_000);
});

describe('acceptance row 4 — activation through the endpoint', () => {
  it('B6 — redeploying an ACTIVE idea: no restamp; lastDeployed* move to the new battle; the row re-armed with the same dueAtMs and the new battle id', async () => {
    const v1 = version(1, { status: 'activated', ...DEPLOYED('battle-old-1') });
    const { cap } = await run({ docs: H.seedDeploy({ versions: [v1] }), req: H.clientRequest() });
    const id = cap.response.body.agentBattleId;
    expect(cap.docs[vPath(1)]).toEqual({ ...v1, lastDeployedAt: H.FROZEN_NOW, lastDeployedBattleId: id });
    expect(cap.docs[rowPath(1)]).toEqual({ userId: H.OWNER, watchlistId: H.WATCHLIST_ID, version: 1, battleId: id, dueAtMs: Date.parse(v1.reviewDueAt), armedAt: Date.parse(H.FROZEN_NOW) });
  }, 20_000);
  it('an UNSPECIFIED horizon arms a battle-end row (dueAtMs null)', async () => {
    const { cap } = await run({ docs: H.seedDeploy({ versions: [version(1, {}, { horizonEnum: 'unspecified', horizonSource: 'default' })] }), req: H.clientRequest() });
    expect(cap.docs[vPath(1)]).toMatchObject({ status: 'activated', reviewDueAt: null });
    expect(cap.docs[rowPath(1)]).toMatchObject({ battleId: cap.response.body.agentBattleId, dueAtMs: null });
  }, 20_000);
  it('B5 — calendar_unavailable: the deploy SUCCEEDS (200, a battle), the version carries reviewClockFault, the row is a battle-end review', async () => {
    vi.setSystemTime(new Date('2027-12-01T15:00:00.000Z'));
    const docs = H.seedDeploy({ versions: [version(1, {}, { horizonEnum: 'longterm' })], agent: H.agentDoc({ lastDeployedAt: '2027-11-30T15:00:00.000Z' }) });
    const { cap } = await run({ docs, req: H.clientRequest() });
    expect(cap.response.status).toBe(200);
    expect(cap.response.body.battleCreated).toBe(true);
    expect(cap.docs[vPath(1)]).toMatchObject({ status: 'activated', reviewDueAt: null, reviewClockFault: 'calendar_unavailable', firstDeployedAt: '2027-12-01T15:00:00.000Z' });
    expect(cap.docs[rowPath(1)]).toMatchObject({ dueAtMs: null, battleId: cap.response.body.agentBattleId });
  }, 20_000);
});

describe('acceptance row 5 — the race through the endpoint: the deploy fails cleanly', () => {
  it('the version is retired between the deploy\'s read and the battle\'s creation → 500 with the race sentence as details; no battle, no version change, no row; the lock released; errorPhase post_decision', async () => {
    const scenario = SCENARIOS.self_select_ready_over_activated();
    let raced = false;
    const { cap, db } = await run(scenario, {
      beforeHandler: (d) => {
        d.__hooks.afterQuery = async ({ collectionPath }) => {
          if (raced || !collectionPath.endsWith('/hypothesisVersions')) return;
          raced = true;
          d.__docs.set(vPath(2), { ...d.__docs.get(vPath(2)), status: 'retired', stateSource: 'player', stateReason: 'player_retired' });
        };
      },
    });
    expect(raced).toBe(true);
    expect(cap.response).toEqual({ status: 500, body: { error: 'Failed to generate portfolio', details: CARRIAGE_RACE_MESSAGE } });
    expect(Object.keys(cap.docs).filter((p) => p.startsWith('agentBattles/'))).toEqual([]);
    expect(stored(db, vPath(2))).toMatchObject({ status: 'retired', firstDeployedAt: null, lastDeployedBattleId: null });
    expect(stored(db, vPath(1))).toEqual(scenario.docs[vPath(1)]);
    expect(cap.store.writes.filter((w) => isHyp(w.path))).toEqual([]);
    const agent = cap.docs[`agents/${H.AGENT_ID}`];
    expect(agent.deployingAt).toBeNull();
    expect(agent.activeBattleId).toBeNull();
    expect(agent.deployProgress).toMatchObject({ stage: 'error', errorPhase: 'post_decision' });
  }, 20_000);
});

describe('the attacker lens — a deploy carries only what the owner\'s server-written records support', () => {
  it('a client body naming a version, a sibling or a hash is IGNORED: the capture equals the plain gate-on deploy', async () => {
    const { cap: plain } = await run(SCENARIOS.self_select_ready_over_activated());
    const forged = SCENARIOS.self_select_ready_over_activated();
    forged.req.body = {
      ...forged.req.body, hypothesisVersion: 1, equippedHypothesis: { ...siblingOf(version(1)), statement: 'forged' }, contentHash: 'x'.repeat(64),
    };
    const { cap } = await run(forged);
    expect(cap).toEqual(plain);
  }, 30_000);
  it('an equip pointer to a list ANOTHER player owns (with a ready idea) carries nothing and reads no version', async () => {
    const docs = H.seedDeploy({ watchlist: H.watchlistDoc({ userId: 'someone-else' }), versions: [{ ...version(1), userId: 'someone-else' }] });
    const { cap } = await run({ docs, req: H.clientRequest() });
    expect(cap.response.status).toBe(200);
    expect(H.hypothesisAccess(cap)).toEqual({ reads: [], queries: [], writes: [] });
    expect('equippedHypothesis' in cap.docs[`agentBattles/${cap.response.body.agentBattleId}`].agentContext).toBe(false);
  }, 20_000);
});

// ════════════════════════════════════════════════════════════════════════════
describe('acceptance row 6 — end to end: deploy → the armed row → the review pass (P1a) → review_due → the Forge\'s line, from the FROZEN list only', () => {
  const cond = (symbol) => ({ symbol, side: 'above', level: 100, basis: 'daily_close' });

  /** Deploy (gate on), end the battle or pass the due instant, run the review pass, rename the LIVE list, then GET the versions as the Forge does. */
  async function journey({ tickers, content, ending }) {
    const docs = H.seedDeploy({ watchlist: H.watchlistDoc({ tickers }), versions: [version(1, {}, content)] });
    const { cap, db } = await run({ docs, req: H.clientRequest() });
    const battleId = cap.response.body.agentBattleId;
    const row = stored(db, rowPath(1));
    expect(row).toMatchObject({ battleId });
    if (ending === 'battle_ended') {
      db.__docs.set(`agentBattles/${battleId}`, { ...db.__docs.get(`agentBattles/${battleId}`), status: 'completed' });
    } else {
      vi.setSystemTime(new Date(row.dueAtMs + 60_000));
    }
    const pass = await runHypothesisReviewPass({ db, handlerStartMs: Date.now(), nowMs: Date.now() });
    expect(pass[ending === 'battle_ended' ? 'battleEnded' : 'horizonElapsed']).toBe(1);
    expect(stored(db, rowPath(1))).toBeNull();
    // The live list changes after the battle: the line must not follow it.
    db.__docs.set(`watchlists/${H.WATCHLIST_ID}`, H.watchlistDoc({ name: 'Renamed live list', tickers: ['TSLA'] }));
    const res = H.makeRes();
    await versionsRoute({ method: 'GET', headers: {}, query: { id: H.WATCHLIST_ID }, body: {} }, res);
    expect(res.statusCode).toBe(200);
    const v = res.body.versions.find((x) => x.version === 1);
    expect(v).toMatchObject({ status: 'review_due', stateReason: ending });
    return { line: lifecycleLineFor(v, res.body.deployedLists[1]), body: res.body, battleId };
  }

  it('[SYM], horizon elapsed — the battle froze ONE ticker', async () => {
    const { line, body, battleId } = await journey({ tickers: ['NVDA'], content: {}, ending: 'horizon_elapsed' });
    expect(body.deployedLists).toEqual({ 1: { battleId, name: 'AI capex', tickers: ['NVDA'] } });
    expect(line).toBe("Your NVDA idea reached its time-frame (Swing, 10 trading sessions). Nothing was sold and nothing was deleted — it's flagged for your review. Reaffirm it to make a fresh version, or retire it.");
  }, 20_000);
  it('[LIST], horizon elapsed — the battle froze three tickers; [LIST] is the FROZEN name', async () => {
    const { line } = await journey({ tickers: ['NVDA', 'PLTR', 'AMD'], content: {}, ending: 'horizon_elapsed' });
    expect(line).toBe("Your AI capex idea reached its time-frame (Swing, 10 trading sessions). Nothing was sold and nothing was deleted — it's flagged for your review. Reaffirm it to make a fresh version, or retire it.");
  }, 20_000);
  it('[SYM], battle ended (unspecified) — the idea\'s OWN conditions name one symbol', async () => {
    const { line } = await journey({ tickers: ['NVDA', 'PLTR', 'AMD'], content: { horizonEnum: 'unspecified', horizonSource: 'default', activation: [cond('AMD')] }, ending: 'battle_ended' });
    expect(line).toBe("The battle ended with your AMD idea still open-ended. It's flagged for review — reaffirm or retire when you're ready.");
  }, 20_000);
  it('[LIST], battle ended (unspecified)', async () => {
    const { line } = await journey({ tickers: ['NVDA', 'PLTR', 'AMD'], content: { horizonEnum: 'unspecified', horizonSource: 'default' }, ending: 'battle_ended' });
    expect(line).toBe("The battle ended with your AI capex idea still open-ended. It's flagged for review — reaffirm or retire when you're ready.");
  }, 20_000);
  it('B5 — a version whose clock fell back to a battle-end review is flagged at the battle\'s end, and shows NO line (it was never open-ended)', async () => {
    vi.setSystemTime(new Date('2027-12-01T15:00:00.000Z'));
    const docs = H.seedDeploy({ versions: [version(1, {}, { horizonEnum: 'longterm' })], agent: H.agentDoc({ lastDeployedAt: '2027-11-30T15:00:00.000Z' }) });
    const { cap, db } = await run({ docs, req: H.clientRequest() });
    const battleId = cap.response.body.agentBattleId;
    db.__docs.set(`agentBattles/${battleId}`, { ...db.__docs.get(`agentBattles/${battleId}`), status: 'completed' });
    await runHypothesisReviewPass({ db, handlerStartMs: Date.now(), nowMs: Date.now() });
    const res = H.makeRes();
    await versionsRoute({ method: 'GET', headers: {}, query: { id: H.WATCHLIST_ID }, body: {} }, res);
    const v = res.body.versions[0];
    expect(v).toMatchObject({ status: 'review_due', stateReason: 'battle_ended', reviewClockFault: 'calendar_unavailable', horizonEnum: 'longterm' });
    expect(lifecycleLineFor(v, res.body.deployedLists[1])).toBeNull();
  }, 20_000);
});
