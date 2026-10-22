// api/_utils/hypothesisRecords/carriage.voidUnwind.test.js
//
// Pilot P1c — THE VOID UNWIND AT DEPLOY (founder ruling E3; review L2-1 /
// L4-4). A carrying battle that never ran was no deploy of the idea, so the
// deploy applies the review pass's OWN unwind (reviewPass.js
// unwindVoidCarriage: the pass's decision and writer, stateSource 'deploy')
// before it judges or carries an activated version — the record ends the same
// whichever of the pass and the next deploy reaches the row first:
//   · the only carrying battle never ran → Ready again, and the idea rides
//     THIS battle as a first deploy (a new clock, no review, no notice) —
//     voided, or expired while still marked active (the Shadow class);
//   · an earlier carrying battle ran → the record steps back to it, then the
//     version is judged as P1b judges it (a battle-end idea whose earlier
//     battle is over is due; a timed one not yet due rides, clock untouched);
//   · a chain of battles that never ran unwinds step by step (bounded);
//   · a battle that ran, or one armed before the look-back, is never unwound;
//   · judged once: a version that moved meanwhile is left alone.
// The store is the general optimistic double with the deploy harness's
// auto-ids; the battle writer and the creation transaction are the real ones.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stored } from '../__fixtures__/callsFirestore.js';
import { makeDeployDb } from '../__fixtures__/deployHarness.js';

const state = vi.hoisted(() => ({ flag: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return state.flag; } };
});

const C = await import('./carriage.js');
const { runHypothesisReviewPass, REVIEW_VOID_TRADING_DAYS } = await import('./reviewPass.js');
const { createAgentBattle } = await import('../agentBattleService.js');
const { buildVersionDoc } = await import('./model.js');
const { computeReviewDueAt, tradingDaysCutoffMs } = await import('./horizon.js');

const OWNER = 'unwind-deploy-owner-1';
const WL = 'wl-unwind-1';
const ENV = 'COCKPIT_ALLOWLIST_UIDS';
// Thu 15 Oct 2026, 11:00 ET — the look-back reaches back to Tue 13 Oct 00:00 ET.
const NOW = '2026-10-15T15:00:00.000Z';
const B1_AT = '2026-10-14T15:38:00.000Z'; // the newest carrying battle (Wed)
const B0_AT = '2026-10-13T17:21:40.668Z'; // an earlier carrying battle (Tue)
const MON = '2026-10-12T15:00:00.000Z'; // before the look-back
const LIT = Object.freeze({ dark: false, descriptor: null });

const vPath = (n = 1) => `watchlists/${WL}/hypothesisVersions/v${n}`;
const rowPath = (n = 1) => `hypothesisReviewQueue/${WL}:${n}`;
const UNSPECIFIED = { horizonEnum: 'unspecified', horizonSource: 'default' };
const dueOf = (horizon, at) => computeReviewDueAt(horizon, Date.parse(at));

/** An activated version as P1b + P1c write it, carried last by `b-1`. */
function act(lifecycle = {}, content = {}) {
  const swing = content.horizonEnum === undefined || content.horizonEnum === 'swing';
  return {
    ...buildVersionDoc({
      version: 1, watchlistId: WL, userId: OWNER, opId: 'op-1', opFingerprint: 'f'.repeat(64), createdAt: '2026-10-01T14:00:00.000Z',
      content: {
        statement: 'idea v1', horizonEnum: 'swing', horizonSource: 'player', activation: [], invalidation: [],
        evidenceRefs: [], publishedAt: null, origin: 'manual', ...content,
      },
      status: 'ready', stateSource: 'player', stateReason: 'player_ready',
    }),
    status: 'activated', stateChangedAt: B1_AT, stateSource: 'deploy', stateReason: 'deployed',
    firstDeployedAt: B1_AT, lastDeployedAt: B1_AT, lastDeployedBattleId: 'b-1',
    reviewDueAt: swing ? new Date(dueOf('swing', B1_AT)).toISOString() : null, deployedBattleIds: ['b-1'],
    ...lifecycle,
  };
}
const row = (v, over = {}) => ({
  userId: OWNER, watchlistId: WL, version: 1, battleId: v.lastDeployedBattleId,
  dueAtMs: v.reviewDueAt == null ? null : Date.parse(v.reviewDueAt), armedAt: Date.parse(v.lastDeployedAt), ...over,
});
const neverRan = (over = {}) => ({ ownerId: OWNER, status: 'completed', completionReason: 'voided', createdAt: B1_AT, trades: [], ...over });
// Shadow, 14 Oct: deployed in the evening, expired at 20:00 ET without a single check, still `active` until agent-evaluate's next weekday tick.
const expiredUnrun = (over = {}) => ({ ownerId: OWNER, status: 'active', createdAt: B1_AT, expiresAt: '2026-10-15T00:00:00.000Z', trades: [], ...over });
const ran = (over = {}) => ({ ownerId: OWNER, status: 'completed', createdAt: B0_AT, cronState: { evalSeq: 3 }, trades: [], ...over });

const list = () => ({ watchlistId: WL, userId: OWNER, name: 'AI capex', status: 'committed', tickers: [{ symbol: 'NVDA' }, { symbol: 'AMD' }] });
const snapshot = () => ({ watchlistId: WL, name: 'AI capex', tickers: ['NVDA', 'AMD'] });
const seed = (docs) => makeDeployDb({ [`watchlists/${WL}`]: list(), ...docs });
const resolve = (db) => C.resolveDeployCarriage(db, { ownerUid: OWNER, watchlistId: WL, watchlist: list(), snapshot: snapshot(), pin: LIT });
const agentData = () => ({
  id: 'agent-unwind-1', ownerId: OWNER, name: 'Shadow', archetype: 'momentum_chaser', activeRules: [], equippedBundleIds: [],
  lastDecision: {
    portfolio: {
      star: [{ symbol: 'AAPL', baseATR: 3 }, { symbol: 'MSFT', baseATR: 3 }],
      core: [{ symbol: 'NVDA' }, { symbol: 'AMD' }],
      support: [{ symbol: 'JPM' }, { symbol: 'XOM' }, { symbol: 'BTC', isCrypto: true }],
    },
    bench: { stocks: [{ symbol: 'COST' }, { symbol: 'LLY' }, { symbol: 'UNH' }], crypto: { symbol: 'ETH', isCrypto: true } },
    strategyBrief: 'brief', innerMonologue: {},
    watchlist: { active: [], hotBench: [], monitoring: [], lastRefreshed: null, totalStocks: 0 },
  },
});
/** Create the battle through the REAL writer and the REAL creation transaction. */
const deploy = (db, sibling) => createAgentBattle(db, agentData(), {}, {}, { equippedWatchlist: snapshot(), equippedHypothesis: sibling, activationPin: LIT });

let savedEnv;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  state.flag = true;
  savedEnv = process.env[ENV];
  process.env[ENV] = OWNER;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV]; else process.env[ENV] = savedEnv;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const READY_AGAIN = {
  status: 'ready', stateChangedAt: NOW, stateSource: 'deploy', stateReason: 'deploy_voided',
  firstDeployedAt: null, reviewDueAt: null, lastDeployedAt: null, lastDeployedBattleId: null, reviewClockFault: null, deployedBattleIds: [],
};

describe('the ONLY carrying battle never ran → Ready again, and the idea rides THIS battle as a first deploy', () => {
  it('a battle-end idea (voided battle): no review, no notice — the deploy carries it, and the battle starts a fresh record', async () => {
    const v = act({ reviewDueAt: null }, UNSPECIFIED);
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan() });
    const r = await resolve(db);
    expect(r).toMatchObject({ outcome: 'carry', version: 1, status: 'ready' });
    expect(r.reason).toBeUndefined();
    expect(stored(db, vPath())).toEqual({ ...v, ...READY_AGAIN });
    expect(stored(db, rowPath())).toBeNull();
    const { id } = await deploy(db, r.equippedHypothesis);
    expect(stored(db, vPath())).toMatchObject({
      status: 'activated', stateSource: 'deploy', stateReason: 'deployed', firstDeployedAt: NOW, lastDeployedAt: NOW,
      lastDeployedBattleId: id, reviewDueAt: null, deployedBattleIds: [id],
    });
    expect(stored(db, rowPath())).toEqual({ userId: OWNER, watchlistId: WL, version: 1, battleId: id, dueAtMs: null, armedAt: Date.parse(NOW) });
  });
  it('the same for a battle that EXPIRED still marked active with no check and no trade (the Shadow class)', async () => {
    const v = act({ reviewDueAt: null }, UNSPECIFIED);
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': expiredUnrun() });
    expect(await resolve(db)).toMatchObject({ outcome: 'carry', status: 'ready' });
    expect(stored(db, vPath())).toEqual({ ...v, ...READY_AGAIN });
  });
  it('a TIMED idea not yet due: it rides as a first deploy — a NEW clock anchored at this battle', async () => {
    const v = act();
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan() });
    const r = await resolve(db);
    expect(r).toMatchObject({ outcome: 'carry', status: 'ready' });
    const { id } = await deploy(db, r.equippedHypothesis);
    const fresh = dueOf('swing', NOW);
    expect(fresh).not.toBe(Date.parse(v.reviewDueAt));
    expect(stored(db, vPath())).toMatchObject({ status: 'activated', firstDeployedAt: NOW, reviewDueAt: new Date(fresh).toISOString(), deployedBattleIds: [id] });
    expect(stored(db, rowPath())).toMatchObject({ battleId: id, dueAtMs: fresh });
  });
});

describe('an EARLIER carrying battle ran → the record steps back to it, then the version is judged as before', () => {
  it('a battle-end idea: its earlier battle is over, so it is due — nothing rides, review_due (the notice), judged at deploy', async () => {
    const v = act({ firstDeployedAt: B0_AT, deployedBattleIds: ['b-0', 'b-1'], reviewDueAt: null }, UNSPECIFIED);
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan(), 'agentBattles/b-0': ran() });
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'review_due', version: 1 });
    expect(stored(db, vPath())).toMatchObject({
      status: 'review_due', stateSource: 'deploy', stateReason: 'battle_ended',
      deployedBattleIds: ['b-0'], lastDeployedBattleId: 'b-0', lastDeployedAt: B0_AT, firstDeployedAt: B0_AT,
    });
    expect(stored(db, rowPath())).toBeNull();
  });
  it('a timed idea not yet due: it rides (B6) — the clock untouched, the list [b-0, this battle], the row re-armed with the SAME dueAtMs', async () => {
    const due = new Date(dueOf('swing', B0_AT)).toISOString();
    const v = act({ firstDeployedAt: B0_AT, deployedBattleIds: ['b-0', 'b-1'], reviewDueAt: due });
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan(), 'agentBattles/b-0': ran() });
    const r = await resolve(db);
    expect(r).toMatchObject({ outcome: 'carry', status: 'activated' });
    const { id } = await deploy(db, r.equippedHypothesis);
    expect(stored(db, vPath())).toMatchObject({
      status: 'activated', firstDeployedAt: B0_AT, reviewDueAt: due, deployedBattleIds: ['b-0', id], lastDeployedBattleId: id,
    });
    expect(stored(db, rowPath())).toMatchObject({ battleId: id, dueAtMs: Date.parse(due) });
  });
  it('a chain — the earlier battle never ran either: both unwind, step by step, and the idea is Ready again', async () => {
    const v = act({ firstDeployedAt: B0_AT, deployedBattleIds: ['b-0', 'b-1'], reviewDueAt: null }, UNSPECIFIED);
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan(), 'agentBattles/b-0': neverRan({ createdAt: B0_AT }) });
    expect(await resolve(db)).toMatchObject({ outcome: 'carry', status: 'ready' });
    expect(stored(db, vPath())).toEqual({ ...v, ...READY_AGAIN });
  });
  it(`the steps are bounded (${C.CARRIAGE_UNWIND_STEPS_MAX} a deploy): past them nothing rides and the record keeps what it reached — the review pass continues`, async () => {
    const at = (i) => new Date(Date.parse(B0_AT) + i * 3_600_000).toISOString();
    const ids = Array.from({ length: 7 }, (_, i) => `b-${i}`);
    const docs = {};
    ids.forEach((id, i) => { docs[`agentBattles/${id}`] = neverRan({ createdAt: at(i) }); });
    const v = act({ firstDeployedAt: at(0), lastDeployedAt: at(6), lastDeployedBattleId: 'b-6', deployedBattleIds: ids, reviewDueAt: null }, UNSPECIFIED);
    const db = seed({ ...docs, [vPath()]: v, [rowPath()]: row(v) });
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'unwind_steps' });
    expect(stored(db, vPath())).toMatchObject({ status: 'activated', deployedBattleIds: ['b-0', 'b-1'], lastDeployedBattleId: 'b-1' });
    expect(stored(db, rowPath())).toMatchObject({ battleId: 'b-1', armedAt: Date.parse(at(1)) });
  });
});

describe('never unwound at deploy', () => {
  it('a battle that RAN: the battle-end idea is due as P1b judges it — review_due', async () => {
    const v = act({ reviewDueAt: null }, UNSPECIFIED);
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': ran({ createdAt: B1_AT }) });
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'review_due', version: 1 });
    expect(stored(db, vPath())).toMatchObject({ status: 'review_due', stateReason: 'battle_ended', firstDeployedAt: B1_AT });
  });
  it('a battle that never ran but was ARMED BEFORE the look-back: judged as before (due)', async () => {
    const v = act({ firstDeployedAt: MON, lastDeployedAt: MON, reviewDueAt: null }, UNSPECIFIED);
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan({ createdAt: MON }) });
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'review_due', version: 1 });
  });
  it('a timed idea whose battle is still running: carried (B6), its battle read once, nothing unwound', async () => {
    const v = act();
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': { ownerId: OWNER, status: 'active', createdAt: B1_AT, expiresAt: '2026-10-16T00:00:00.000Z' } });
    expect(await resolve(db)).toMatchObject({ outcome: 'carry', status: 'activated' });
    expect(db.__access.reads.filter((p) => p === 'agentBattles/b-1')).toHaveLength(1);
    expect(db.__access.writes).toEqual([]);
  });
});

describe('one judge — the pass and the deploy end the record the same, and either may go first', () => {
  it('the pass on the same record writes the same version (but for its stateSource) and deletes the same row', async () => {
    const v = act({ reviewDueAt: null }, UNSPECIFIED);
    const docs = { [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': expiredUnrun() };
    const byPass = seed(docs);
    const summary = await runHypothesisReviewPass({ db: byPass, handlerStartMs: Date.now(), nowMs: Date.now() });
    expect(summary).toMatchObject({ voidUnwound: 1 });
    const byDeploy = seed(docs);
    await resolve(byDeploy);
    expect({ ...stored(byPass, vPath()), stateSource: 'x' }).toEqual({ ...stored(byDeploy, vPath()), stateSource: 'x' });
    expect(stored(byPass, vPath()).stateSource).toBe('review_pass');
    expect(stored(byPass, rowPath())).toBeNull();
    expect(stored(byDeploy, rowPath())).toBeNull();
  });
  it('the pass got there first: the deploy finds the version Ready and carries it as a first deploy', async () => {
    const v = act({ reviewDueAt: null }, UNSPECIFIED);
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan() });
    await runHypothesisReviewPass({ db, handlerStartMs: Date.now(), nowMs: Date.now() });
    expect(await resolve(db)).toMatchObject({ outcome: 'carry', status: 'ready' });
  });
  it('judged once: the version moved (the player retired it) after the deploy read it → nothing rides, nothing unwound', async () => {
    const v = act({ reviewDueAt: null }, UNSPECIFIED);
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan() });
    db.__hooks.afterQuery = async () => { db.__docs.set(vPath(), { ...db.__docs.get(vPath()), status: 'retired', stateSource: 'player', stateReason: 'player_retired' }); };
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'state_moved' });
    expect(stored(db, vPath())).toMatchObject({ status: 'retired', firstDeployedAt: B1_AT });
    expect(stored(db, rowPath())).toEqual(row(v));
  });
  it('the unwind cannot commit → nothing rides (read_failed), nothing written', async () => {
    const v = act({ reviewDueAt: null }, UNSPECIFIED);
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan() });
    db.runTransaction = async () => { throw new Error('ABORTED'); };
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'read_failed' });
    expect(stored(db, vPath())).toEqual(v);
  });
});

// ── The mutation lens's rows (review L5a), each proven red on its mutant and green on the original ──
describe('L5a mutation lens rows — the void unwind at deploy (C04, C22, C26, C36, C37, C38)', () => {
  it('C04 — a battle armed EXACTLY at the look-back\'s first instant is inside it (the pass\'s >=): a timed idea whose only battle never ran is Ready again', async () => {
    const CUT = new Date(tradingDaysCutoffMs(Date.parse(NOW), REVIEW_VOID_TRADING_DAYS)).toISOString(); // Tue 13 Oct 00:00 ET
    const v = act({ firstDeployedAt: CUT, lastDeployedAt: CUT, stateChangedAt: CUT, reviewDueAt: new Date(dueOf('swing', CUT)).toISOString() });
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan({ createdAt: CUT }) });
    expect(await resolve(db)).toMatchObject({ outcome: 'carry', status: 'ready' });
    expect(stored(db, vPath())).toEqual({ ...v, ...READY_AGAIN });
  });
  it('C22 — a calendar that cannot place the look-back unwinds NOTHING (the pass\'s posture): a battle-end idea whose battle never ran is judged as before — review_due', async () => {
    const AT = '2028-01-05T15:00:00.000Z'; // past the calendar of record: tradingDaysCutoffMs throws calendar_unavailable
    expect(() => tradingDaysCutoffMs(Date.parse(AT), REVIEW_VOID_TRADING_DAYS)).toThrow(expect.objectContaining({ code: 'calendar_unavailable' }));
    vi.setSystemTime(new Date(AT));
    const B = '2028-01-04T15:38:00.000Z';
    const v = act({ firstDeployedAt: B, lastDeployedAt: B, stateChangedAt: B, reviewDueAt: null }, UNSPECIFIED);
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan({ createdAt: B }) });
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'review_due', version: 1 });
    expect(stored(db, vPath())).toMatchObject({ status: 'review_due', stateReason: 'battle_ended', firstDeployedAt: B, deployedBattleIds: ['b-1'] });
  });
  it('C26 — a TIMED chain (both carrying battles never ran): the step back keeps the look-back, so both unwind and the idea is Ready again', async () => {
    const due = new Date(dueOf('swing', B0_AT)).toISOString();
    const v = act({ firstDeployedAt: B0_AT, deployedBattleIds: ['b-0', 'b-1'], reviewDueAt: due });
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan(), 'agentBattles/b-0': neverRan({ createdAt: B0_AT }) });
    expect(await resolve(db)).toMatchObject({ outcome: 'carry', status: 'ready' });
    expect(stored(db, vPath())).toEqual({ ...v, ...READY_AGAIN });
  });
  it('C36 — judged once, a TIMED idea not yet due: the version moved (the player retired it) after the deploy read it → nothing rides; the stale record is never carried', async () => {
    const v = act();
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan() });
    db.__hooks.afterQuery = async () => { db.__docs.set(vPath(), { ...db.__docs.get(vPath()), status: 'retired', stateSource: 'player', stateReason: 'player_retired' }); };
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'state_moved' });
    expect(stored(db, vPath())).toMatchObject({ status: 'retired', firstDeployedAt: B1_AT });
    expect(stored(db, rowPath())).toEqual(row(v));
  });
  it('C37 — kept: the step back cannot be anchored (the earlier carrying battle is gone) → no unwind; the version is judged as before (a battle-end idea whose battle is over: review_due)', async () => {
    const v = act({ firstDeployedAt: B0_AT, deployedBattleIds: ['b-0', 'b-1'], reviewDueAt: null }, UNSPECIFIED);
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan() }); // no agentBattles/b-0
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'review_due', version: 1 });
    expect(stored(db, vPath())).toMatchObject({
      status: 'review_due', stateSource: 'deploy', stateReason: 'battle_ended', deployedBattleIds: ['b-0', 'b-1'], lastDeployedBattleId: 'b-1',
    });
    expect(stored(db, rowPath())).toBeNull();
  });
  it('C38 — the version moved between the unwind\'s commit and the deploy\'s re-read (the player retired it): nothing rides (state_moved), never the re-read record', async () => {
    const v = act({ reviewDueAt: null }, UNSPECIFIED);
    const db = seed({ [vPath()]: v, [rowPath()]: row(v), 'agentBattles/b-1': neverRan() });
    db.__hooks.afterCommit = async ({ writes }) => {
      if (writes.some((w) => w.path === vPath() && w.data?.stateReason === 'deploy_voided')) {
        db.__docs.set(vPath(), { ...db.__docs.get(vPath()), status: 'retired', stateSource: 'player', stateReason: 'player_retired' });
      }
    };
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'state_moved' });
    expect(stored(db, vPath())).toMatchObject({ status: 'retired' });
  });
});
