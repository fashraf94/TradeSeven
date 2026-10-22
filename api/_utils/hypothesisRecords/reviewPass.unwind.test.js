// api/_utils/hypothesisRecords/reviewPass.unwind.test.js
//
// Pilot P1c — THE VOID UNWIND (founder ruling E3; build prompt acceptance row
// 4), inside P1a's review pass (runHypothesisReviewPass). A carrying battle
// that never ran — terminal, zero evaluations, no trades — is not a deploy of
// the idea:
//   · the ONLY carrying battle → the version back to `ready` (review_pass,
//     deploy_voided), its deploy stamps and clock cleared, the row deleted —
//     from P1c's deployedBattleIds, or from a pre-P1c record whose
//     lastDeployedBattleId is that battle and whose firstDeployedAt is its
//     createdAt;
//   · EARLIER carrying battles → this id leaves deployedBattleIds,
//     lastDeployed* point at the previous battle, the row re-armed to it with
//     the same dueAtMs;
//   · judged once in the row's own transaction: a concurrent transition, or a
//     redeploy re-arming the row, loses cleanly;
//   · a battle with evaluations or trades is never unwound; a live battle is
//     not; a row armed before the 3-trading-day look-back is never read for it;
//   · every phase judges it (a due row and a battle-end row unwind instead of
//     flagging), and the 'recent' phase reaches a timed row not yet due,
//     passing over the rows the other phases own (each row judged once a pass).
//
// The store is the general optimistic double (callsFirestore.js).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeCallsFirestore, stored } from '../__fixtures__/callsFirestore.js';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return flag.on; } };
});

const {
  runHypothesisReviewPass, decideReview, battleNeverRan, voidBranchOf, REVIEW_QUEUE_COLLECTION, REVIEW_VOID_TRADING_DAYS,
} = await import('./reviewPass.js');

const OWNER = 'unwind-owner-1';
const ENV = 'COCKPIT_ALLOWLIST_UIDS';
// Thu 15 Oct 2026, 11:00 ET — the look-back reaches back to Tue 13 Oct 00:00 ET.
const NOW = Date.parse('2026-10-15T15:00:00Z');
const CUTOFF = Date.parse('2026-10-13T04:00:00Z');
const B1_AT = '2026-10-14T15:38:00.000Z'; // the voided battle (Wed)
const B0_AT = '2026-10-13T17:21:40.668Z'; // an earlier carrying battle (Tue)
const DUE = '2026-10-16T20:00:00.000Z';

const vPath = (n = 1) => `watchlists/wl-u/hypothesisVersions/v${n}`;
const rowPath = (n = 1) => `${REVIEW_QUEUE_COLLECTION}/wl-u:${n}`;
const version = (over = {}) => ({
  version: 1, watchlistId: 'wl-u', userId: OWNER, statement: 'idea', horizonEnum: 'intraday', contentHash: 'c'.repeat(64),
  status: 'activated', stateChangedAt: B1_AT, stateSource: 'deploy', stateReason: 'deployed',
  firstDeployedAt: B1_AT, reviewDueAt: DUE, lastDeployedAt: B1_AT, lastDeployedBattleId: 'b-1',
  deployedBattleIds: ['b-1'], successorVersion: null, missingEvidence: null, ...over,
});
const row = (over = {}) => ({ userId: OWNER, watchlistId: 'wl-u', version: 1, battleId: 'b-1', dueAtMs: Date.parse(DUE), armedAt: Date.parse(B1_AT), ...over });
const neverRan = (over = {}) => ({ ownerId: OWNER, status: 'completed', completionReason: 'voided', createdAt: B1_AT, trades: [], ...over });
const ran = (over = {}) => ({ ownerId: OWNER, status: 'completed', createdAt: B0_AT, cronState: { evalSeq: 4 }, evaluations: [{}, {}, {}, {}], trades: [], ...over });

function store(docs) { return makeCallsFirestore({ docs }); }
const run = (db, over = {}) => runHypothesisReviewPass({ db, handlerStartMs: Date.now(), nowMs: NOW, ...over });

let savedEnv;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  flag.on = true;
  savedEnv = process.env[ENV];
  process.env[ENV] = OWNER;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV]; else process.env[ENV] = savedEnv;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('battleNeverRan — the battle\'s own state', () => {
  it('terminal with no evaluation on any counter and no trade', () => {
    expect(battleNeverRan(neverRan())).toBe(true);
    expect(battleNeverRan(neverRan({ status: 'expired' }))).toBe(true);
    expect(battleNeverRan({ status: 'completed' })).toBe(true); // no counters at all
  });
  it('NOT when it ran: an evaluation on ANY counter, or a trade; NOT while it is active', () => {
    expect(battleNeverRan(neverRan({ evaluations: [{}] }))).toBe(false);
    expect(battleNeverRan(neverRan({ cronState: { evalSeq: 1 } }))).toBe(false);
    expect(battleNeverRan(neverRan({ scoreState: { evaluationCount: 2 } }))).toBe(false);
    expect(battleNeverRan(neverRan({ trades: [{ symbol: 'NVDA' }] }))).toBe(false);
    expect(battleNeverRan(neverRan({ status: 'active' }))).toBe(false);
    expect(battleNeverRan(null)).toBe(false);
  });
});

describe('voidBranchOf — which unwind, from the version\'s own record', () => {
  it('P1c records: [it] → only; [earlier, it] → previous (the one before it); it not the newest → unresolved', () => {
    expect(voidBranchOf({ version: version(), battleId: 'b-1', battle: neverRan() })).toEqual({ branch: 'only' });
    expect(voidBranchOf({ version: version({ deployedBattleIds: ['b-0', 'b-1'] }), battleId: 'b-1', battle: neverRan() }))
      .toEqual({ branch: 'previous', previousBattleId: 'b-0', remaining: ['b-0'] });
    expect(voidBranchOf({ version: version({ deployedBattleIds: ['b-1', 'b-2'] }), battleId: 'b-1', battle: neverRan() })).toEqual({ unresolved: 'void_not_latest' });
  });
  it('pre-P1c records (no list): only when lastDeployedBattleId is it AND firstDeployedAt is its createdAt; earlier battles it cannot name → unresolved', () => {
    const pre = (over) => { const v = version(over); delete v.deployedBattleIds; return v; };
    expect(voidBranchOf({ version: pre(), battleId: 'b-1', battle: neverRan() })).toEqual({ branch: 'only' });
    expect(voidBranchOf({ version: pre({ firstDeployedAt: B0_AT }), battleId: 'b-1', battle: neverRan() })).toEqual({ unresolved: 'void_previous_unknown' });
    expect(voidBranchOf({ version: pre({ lastDeployedBattleId: 'b-9' }), battleId: 'b-1', battle: neverRan() })).toEqual({ unresolved: 'void_not_latest' });
  });
});

describe('the ONLY carrying battle never ran → Ready again, its clock never started', () => {
  it('a timed row NOT yet due, armed within the look-back: the \'recent\' phase unwinds it — stamps and clock cleared, the row deleted', async () => {
    const db = store({ [vPath()]: version({ reviewClockFault: 'calendar_unavailable' }), [rowPath()]: row(), 'agentBattles/b-1': neverRan() });
    const before = stored(db, vPath());
    const res = await run(db);
    expect(res).toMatchObject({ voidUnwound: 1, horizonElapsed: 0 });
    expect(stored(db, vPath())).toEqual({
      ...before, status: 'ready', stateChangedAt: new Date(NOW).toISOString(), stateSource: 'review_pass', stateReason: 'deploy_voided',
      firstDeployedAt: null, reviewDueAt: null, lastDeployedAt: null, lastDeployedBattleId: null, reviewClockFault: null, deployedBattleIds: [],
    });
    expect(stored(db, rowPath())).toBeNull();
    // The content is untouched: the same idea, ready to ride again.
    expect(stored(db, vPath()).contentHash).toBe(before.contentHash);
  });
  it('a pre-P1c record (lastDeployedBattleId is it, firstDeployedAt its createdAt) unwinds the same way', async () => {
    const v = version(); delete v.deployedBattleIds;
    const db = store({ [vPath()]: v, [rowPath()]: row(), 'agentBattles/b-1': neverRan() });
    expect(await run(db)).toMatchObject({ voidUnwound: 1 });
    expect(stored(db, vPath())).toMatchObject({ status: 'ready', stateReason: 'deploy_voided', firstDeployedAt: null, deployedBattleIds: [] });
  });
  it('a DUE row whose only battle never ran unwinds instead of flagging (the due phase\'s judge)', async () => {
    const db = store({ [vPath()]: version({ reviewDueAt: '2026-10-15T14:00:00.000Z' }), [rowPath()]: row({ dueAtMs: Date.parse('2026-10-15T14:00:00.000Z') }), 'agentBattles/b-1': neverRan() });
    const res = await run(db);
    expect(res).toMatchObject({ voidUnwound: 1, horizonElapsed: 0 });
    expect(stored(db, vPath()).status).toBe('ready');
  });
  it('a BATTLE-END row whose only battle never ran unwinds instead of battle_ended (the unspecified phase\'s judge)', async () => {
    const db = store({ [vPath()]: version({ horizonEnum: 'unspecified', reviewDueAt: null }), [rowPath()]: row({ dueAtMs: null }), 'agentBattles/b-1': neverRan() });
    const res = await run(db);
    expect(res).toMatchObject({ voidUnwound: 1, battleEnded: 0 });
    expect(stored(db, vPath())).toMatchObject({ status: 'ready', stateReason: 'deploy_voided' });
  });
});

describe('EARLIER carrying battles → the record points back at the previous battle', () => {
  it('this id leaves deployedBattleIds, lastDeployed* = the previous battle, the row re-armed to it with the SAME dueAtMs; the clock untouched', async () => {
    const db = store({
      [vPath()]: version({ firstDeployedAt: B0_AT, deployedBattleIds: ['b-0', 'b-1'] }),
      [rowPath()]: row(), 'agentBattles/b-1': neverRan(), 'agentBattles/b-0': ran(),
    });
    const before = stored(db, vPath());
    const res = await run(db);
    expect(res).toMatchObject({ voidSteppedBack: 1 });
    expect(stored(db, vPath())).toEqual({ ...before, deployedBattleIds: ['b-0'], lastDeployedAt: B0_AT, lastDeployedBattleId: 'b-0' });
    expect(stored(db, rowPath())).toEqual({ userId: OWNER, watchlistId: 'wl-u', version: 1, battleId: 'b-0', dueAtMs: Date.parse(DUE), armedAt: Date.parse(B0_AT) });
  });
  it('the previous battle cannot be read → no unwind: a row not yet due is left alone (judged as before — review L2-5)', async () => {
    const db = store({ [vPath()]: version({ firstDeployedAt: B0_AT, deployedBattleIds: ['b-0', 'b-1'] }), [rowPath()]: row(), 'agentBattles/b-1': neverRan() });
    const before = stored(db, vPath());
    await run(db);
    expect(stored(db, vPath())).toEqual(before);
    expect(stored(db, rowPath())).toEqual(row());
  });
  it('a pre-P1c record whose earlier battles it cannot name → no unwind: judged as before (a timed row not due is left alone)', async () => {
    const v = version({ firstDeployedAt: B0_AT }); delete v.deployedBattleIds;
    const db = store({ [vPath()]: v, [rowPath()]: row(), 'agentBattles/b-1': neverRan() });
    const res = await run(db);
    expect(res.voidUnwound ?? 0).toBe(0);
    expect(res.voidUnresolved).toBe(1);
    expect(stored(db, vPath())).toEqual(v);
  });
});

describe('never unwound', () => {
  it('a battle that RAN (evaluations, or a trade) — or one still live', async () => {
    for (const battle of [neverRan({ cronState: { evalSeq: 2 } }), neverRan({ trades: [{ symbol: 'AMD' }] }), neverRan({ status: 'active', completionReason: undefined })]) {
      const db = store({ [vPath()]: version(), [rowPath()]: row(), 'agentBattles/b-1': battle });
      const res = await run(db);
      expect(res.voidUnwound ?? 0, JSON.stringify(battle)).toBe(0);
      expect(stored(db, vPath()).status).toBe('activated');
    }
  });
  it('a row armed BEFORE the look-back is never read for it: its battle is not read and its version stays activated', async () => {
    const old = Date.parse('2026-10-12T15:00:00Z'); // Monday — before Tue 00:00 ET
    expect(old).toBeLessThan(CUTOFF);
    const db = store({ [vPath()]: version(), [rowPath()]: row({ armedAt: old }), 'agentBattles/b-1': neverRan() });
    const res = await run(db);
    expect(db.__access.reads.filter((p) => p === 'agentBattles/b-1')).toEqual([]);
    expect(res.voidUnwound ?? 0).toBe(0);
    expect(stored(db, vPath()).status).toBe('activated');
  });
  it('the look-back is three trading days, and the recent phase\'s query starts at its cutoff', async () => {
    expect(REVIEW_VOID_TRADING_DAYS).toBe(3);
    const db = store({});
    await run(db);
    const recent = db.__access.queries.find((q) => q.filters.some((f) => f.field === 'armedAt'));
    expect(recent.filters).toEqual([{ field: 'armedAt', op: '>=', value: CUTOFF }]);
  });
  it('the gate off → no read at all (the pass\'s own gate)', async () => {
    flag.on = false;
    const db = store({ [vPath()]: version(), [rowPath()]: row(), 'agentBattles/b-1': neverRan() });
    await run(db);
    expect(db.__access).toEqual({ reads: [], writes: [], queries: [] });
  });
});

describe('judged once', () => {
  it('the version moved between the page read and the transaction (the player retired it): no unwind — the stale row is deleted, as the pass does', async () => {
    const db = store({ [vPath()]: version(), [rowPath()]: row(), 'agentBattles/b-1': neverRan() });
    db.__hooks.afterQuery = async ({ collectionPath }) => {
      if (collectionPath !== REVIEW_QUEUE_COLLECTION) return;
      db.__docs.set(vPath(), { ...db.__docs.get(vPath()), status: 'retired', stateSource: 'player', stateReason: 'player_retired' });
    };
    const res = await run(db);
    expect(res.voidUnwound ?? 0).toBe(0);
    expect(stored(db, vPath())).toMatchObject({ status: 'retired', firstDeployedAt: B1_AT });
  });
  it('a redeploy re-armed the row to a NEW live battle in the meantime: the fresh row decides — nothing unwound', async () => {
    const db = store({ [vPath()]: version(), [rowPath()]: row(), 'agentBattles/b-1': neverRan(), 'agentBattles/b-2': { ownerId: OWNER, status: 'active', createdAt: '2026-10-15T14:00:00.000Z' } });
    let once = false;
    db.__hooks.afterQuery = async ({ collectionPath }) => {
      if (once || collectionPath !== REVIEW_QUEUE_COLLECTION) return;
      once = true;
      db.__docs.set(rowPath(), row({ battleId: 'b-2', armedAt: Date.parse('2026-10-15T14:00:00.000Z') }));
      db.__docs.set(vPath(), { ...db.__docs.get(vPath()), lastDeployedBattleId: 'b-2', deployedBattleIds: ['b-1', 'b-2'] });
    };
    const res = await run(db);
    expect(res.voidUnwound ?? 0).toBe(0);
    expect(stored(db, vPath())).toMatchObject({ status: 'activated', lastDeployedBattleId: 'b-2' });
  });
  it('a competing commit landing between the body and the commit (the battle gained an evaluation) → the transaction re-runs on fresh reads and unwinds nothing', async () => {
    const db = store({ [vPath()]: version(), [rowPath()]: row(), 'agentBattles/b-1': neverRan() });
    let landed = false;
    // Between the body and the commit, the battle is written (its first evaluation): the double's conflict check
    // sees the moved read, re-runs the body on fresh reads, and the battle has run.
    db.__hooks.afterTxBody = async ({ writes }) => {
      if (landed || !writes.some((w) => w.path === vPath())) return;
      landed = true;
      await db.doc('agentBattles/b-1').set(neverRan({ cronState: { evalSeq: 1 } }));
    };
    const res = await run(db);
    expect(landed).toBe(true);
    expect(res.voidUnwound ?? 0).toBe(0);
    expect(stored(db, vPath()).status).toBe('activated');
  });
});

describe('the \'recent\' phase passes over the rows the other phases own — each row judged once a pass', () => {
  it('a due row and a battle-end row armed within the look-back are judged once (no double count), and the recent cursor wraps on a short page', async () => {
    const db = store({
      [vPath(1)]: version({ version: 1 }), [rowPath(1)]: row({ version: 1, dueAtMs: NOW - 60_000, battleId: 'b-ran' }),
      [vPath(2)]: version({ version: 2, horizonEnum: 'unspecified', reviewDueAt: null }), [rowPath(2)]: row({ version: 2, dueAtMs: null, battleId: 'b-live' }),
      'agentBattles/b-ran': ran({ createdAt: B1_AT }), 'agentBattles/b-live': { ownerId: OWNER, status: 'active', createdAt: B1_AT },
    });
    const res = await run(db);
    expect(res).toMatchObject({ horizonElapsed: 1, battleLive: 1, rows: 2 });
    expect(stored(db, 'hypothesisReviewState/cursor')?.recentLastDocId).toBeUndefined();
  });
  it('the recent cursor persists when a tick is cut mid-page, and the next tick resumes after it', async () => {
    const docs = {};
    for (let i = 0; i < 25; i++) {
      const wl = `wl-r${String(i).padStart(2, '0')}`;
      docs[`watchlists/${wl}/hypothesisVersions/v1`] = version({ watchlistId: wl });
      docs[`${REVIEW_QUEUE_COLLECTION}/${wl}:1`] = row({ watchlistId: wl, battleId: `b-${wl}`, armedAt: Date.parse(B1_AT) + i });
      docs[`agentBattles/b-${wl}`] = { ownerId: OWNER, status: 'active', createdAt: B1_AT };
    }
    const db = store(docs);
    let seen = 0;
    db.__hooks.afterTxBody = async () => { seen += 1; if (seen === 3) vi.setSystemTime(NOW + 60_000); };
    const first = await run(db, { handlerStartMs: NOW });
    expect(first.cut).toBe(true);
    expect(first.recentCursorAfter).toEqual({ armedAt: Date.parse(B1_AT) + 2, id: 'wl-r02:1' });
    expect(stored(db, 'hypothesisReviewState/cursor')).toMatchObject({ recentLastArmedAt: Date.parse(B1_AT) + 2, recentLastDocId: 'wl-r02:1' });
    db.__hooks.afterTxBody = null;
    vi.setSystemTime(NOW + 120_000);
    const second = await run(db, { handlerStartMs: Date.now(), nowMs: Date.now() });
    expect(second.recentCursorBefore).toEqual({ armedAt: Date.parse(B1_AT) + 2, id: 'wl-r02:1' });
    expect(second.notDue).toBe(22); // the rest of the rows, from the cursor on
  });
  it('a pass with no void adds no void counter (they appear only when something happened)', async () => {
    const db = store({ [vPath()]: version(), [rowPath()]: row({ dueAtMs: NOW - 60_000 }), 'agentBattles/b-1': ran({ createdAt: B1_AT }) });
    const res = await run(db);
    expect(res.horizonElapsed).toBe(1);
    for (const k of ['voidUnwound', 'voidSteppedBack', 'voidUnresolved', 'recentCursorBefore', 'recentCursorAfter', 'voidLookback']) expect(k in res, k).toBe(false);
  });
});

describe('review fixes — one "over" rule, the step-back judged as before, the first deploy (L2-1, L2-3, L2-5, L2-10)', () => {
  it('an EXPIRED battle still marked active, with no check and no trade, never ran (the Shadow class): unwound like a voided one', async () => {
    const shadow = { ownerId: OWNER, status: 'active', createdAt: B1_AT, expiresAt: '2026-10-15T00:00:00.000Z', trades: [] };
    expect(battleNeverRan(shadow, NOW)).toBe(true);
    expect(battleNeverRan(shadow, Date.parse('2026-10-14T23:59:00.000Z'))).toBe(false); // before its expiry it may still run
    expect(battleNeverRan(shadow)).toBe(false); // no instant: the terminal rule alone
    const db = store({ [vPath()]: version({ horizonEnum: 'unspecified', reviewDueAt: null }), [rowPath()]: row({ dueAtMs: null }), 'agentBattles/b-1': shadow });
    expect(await run(db)).toMatchObject({ voidUnwound: 1, battleLive: 0 });
    expect(stored(db, vPath())).toMatchObject({ status: 'ready', stateReason: 'deploy_voided' });
  });
  it('a battle-end review fires at the EXPIRY of its battle, not when agent-evaluate later completes it: expired + ran → battle_ended; before the expiry → live', async () => {
    const expired = ran({ status: 'active', createdAt: B1_AT, expiresAt: '2026-10-15T00:00:00.000Z' });
    const seedIt = () => store({ [vPath()]: version({ horizonEnum: 'unspecified', reviewDueAt: null }), [rowPath()]: row({ dueAtMs: null }), 'agentBattles/b-1': expired });
    const db = seedIt();
    expect(await run(db)).toMatchObject({ battleEnded: 1, battleLive: 0 });
    expect(stored(db, vPath())).toMatchObject({ status: 'review_due', stateReason: 'battle_ended', stateSource: 'review_pass' });
    vi.setSystemTime(Date.parse('2026-10-14T23:00:00.000Z'));
    const early = seedIt();
    expect(await run(early, { handlerStartMs: Date.now(), nowMs: Date.now() })).toMatchObject({ battleLive: 1, battleEnded: 0 });
    expect(stored(early, vPath()).status).toBe('activated');
  });
  it('a step-back whose previous battle cannot be read is judged as before: a DUE row transitions, counted voidUnresolved', async () => {
    const due = '2026-10-15T14:00:00.000Z';
    const db = store({
      [vPath()]: version({ firstDeployedAt: B0_AT, deployedBattleIds: ['b-0', 'b-1'], reviewDueAt: due }),
      [rowPath()]: row({ dueAtMs: Date.parse(due) }), 'agentBattles/b-1': neverRan(),
    });
    expect(await run(db)).toMatchObject({ horizonElapsed: 1, voidUnresolved: 1 });
    expect(stored(db, vPath())).toMatchObject({ status: 'review_due', stateReason: 'horizon_elapsed' });
    expect(stored(db, rowPath())).toBeNull();
  });
  it('one carrying battle on the list that is NOT the first deploy (a pre-P1c seed, or a list stepped back to a later battle) is never `only`', async () => {
    expect(voidBranchOf({ version: version({ firstDeployedAt: B0_AT, deployedBattleIds: ['b-1'] }), battleId: 'b-1', battle: neverRan() })).toEqual({ unresolved: 'void_previous_unknown' });
    const db = store({ [vPath()]: version({ firstDeployedAt: B0_AT, deployedBattleIds: ['b-1'] }), [rowPath()]: row(), 'agentBattles/b-1': neverRan() });
    const res = await run(db);
    expect(res.voidUnwound ?? 0).toBe(0);
    expect(res.voidUnresolved).toBe(1);
    expect(stored(db, vPath()).status).toBe('activated');
  });
});

describe('decideReview — the pure judge, with and without the look-back', () => {
  it('without unwindFromMs (the default) nothing is unwound — P1a\'s decisions exactly', () => {
    expect(decideReview({ row: row({ dueAtMs: null }), version: version(), battle: neverRan(), nowMs: NOW })).toEqual({ act: 'transition', reason: 'battle_ended' });
  });
  it('with it: unwind when armed at or after the cutoff; P1a\'s decision when armed before', () => {
    expect(decideReview({ row: row({ armedAt: CUTOFF }), version: version(), battle: neverRan(), nowMs: NOW, unwindFromMs: CUTOFF })).toEqual({ act: 'unwind', branch: 'only' });
    expect(decideReview({ row: row({ armedAt: CUTOFF - 1 }), version: version(), battle: neverRan(), nowMs: NOW, unwindFromMs: CUTOFF })).toEqual({ act: 'skip', why: 'not_due' });
    expect(decideReview({ row: row(), version: version({ status: 'review_due' }), battle: neverRan(), nowMs: NOW, unwindFromMs: CUTOFF })).toEqual({ act: 'delete_stale' });
  });
});

// ── The mutation lens's rows (review L5b), each proven red on its mutant and green on the original ──
describe('L5b mutation lens rows — the pass', () => {
  it('P01 a row armed EXACTLY at the look-back cutoff is within it: its battle is read and the void carriage unwound (>=, as the judge)', async () => {
    const db = store({ [vPath()]: version(), [rowPath()]: row({ armedAt: CUTOFF }), 'agentBattles/b-1': neverRan() });
    expect(await run(db)).toMatchObject({ voidUnwound: 1 });
    expect(stored(db, vPath())).toMatchObject({ status: 'ready', stateReason: 'deploy_voided' });
    expect(stored(db, rowPath())).toBeNull();
  });

  it('P02 two void carriages in one pass are both counted', async () => {
    const vPathW = 'watchlists/wl-w/hypothesisVersions/v1';
    const db = store({
      [vPath()]: version(), [rowPath()]: row(), 'agentBattles/b-1': neverRan(),
      [vPathW]: version({ watchlistId: 'wl-w', lastDeployedBattleId: 'b-2', deployedBattleIds: ['b-2'] }),
      [`${REVIEW_QUEUE_COLLECTION}/wl-w:1`]: row({ watchlistId: 'wl-w', battleId: 'b-2' }), 'agentBattles/b-2': neverRan(),
    });
    expect(await run(db)).toMatchObject({ voidUnwound: 2 });
    expect([stored(db, vPath()).status, stored(db, vPathW).status]).toEqual(['ready', 'ready']);
  });

  it('P03 a calendar that cannot place the look-back unwinds nothing: the summary says so, no \'recent\' query runs, a due row is judged as before', async () => {
    const at = Date.parse('2028-03-01T15:00:00Z'); // outside MAINTAINED_HOLIDAY_YEARS (2026, 2027)
    vi.setSystemTime(at);
    const db = store({ [vPath()]: version(), [rowPath()]: row({ dueAtMs: at - 60_000, armedAt: at - 3_600_000 }), 'agentBattles/b-1': neverRan() });
    const res = await run(db, { handlerStartMs: at, nowMs: at });
    expect(res.voidLookback).toBe('calendar_unavailable');
    expect(res.voidUnwound ?? 0).toBe(0);
    expect(res.horizonElapsed).toBe(1);
    expect(db.__access.queries.some((q) => q.filters.some((f) => f.field === 'armedAt'))).toBe(false);
  });

  it('P04 a step-back whose previous battle has no parseable createdAt cannot be anchored: judged as before, never a failed transaction', async () => {
    const due = '2026-10-15T14:00:00.000Z';
    const db = store({
      [vPath()]: version({ firstDeployedAt: B0_AT, deployedBattleIds: ['b-0', 'b-1'], reviewDueAt: due }),
      [rowPath()]: row({ dueAtMs: Date.parse(due) }), 'agentBattles/b-1': neverRan(), 'agentBattles/b-0': ran({ createdAt: 'not-a-date' }),
    });
    expect(await run(db)).toMatchObject({ horizonElapsed: 1, voidUnresolved: 1, failed: 0 });
    expect(stored(db, vPath())).toMatchObject({ status: 'review_due', deployedBattleIds: ['b-0', 'b-1'], lastDeployedBattleId: 'b-1' });
  });

  it('P05 the previous battle is a fresh read of the unwind\'s own transaction: gone before the commit, the step-back re-runs and is not anchored to it', async () => {
    const db = store({
      [vPath()]: version({ firstDeployedAt: B0_AT, deployedBattleIds: ['b-0', 'b-1'] }),
      [rowPath()]: row(), 'agentBattles/b-1': neverRan(), 'agentBattles/b-0': ran(),
    });
    const before = stored(db, vPath());
    let landed = false;
    db.__hooks.afterTxBody = async ({ writes }) => {
      if (landed || !writes.some((w) => w.path === vPath())) return;
      landed = true;
      await db.doc('agentBattles/b-0').delete();
    };
    const res = await run(db);
    expect(landed).toBe(true);
    expect(res.voidSteppedBack ?? 0).toBe(0);
    expect(stored(db, vPath())).toEqual(before);
    expect(stored(db, rowPath())).toEqual(row());
  });

  it('P10 a BATTLE-END row armed BEFORE the look-back still reads its battle for its own review: over → review_due / battle_ended (judged as before, never unwound)', async () => {
    const old = Date.parse('2026-10-12T15:00:00Z'); // Monday — before Tue 00:00 ET
    const db = store({
      [vPath()]: version({ horizonEnum: 'unspecified', reviewDueAt: null }), [rowPath()]: row({ dueAtMs: null, armedAt: old }),
      'agentBattles/b-1': neverRan(),
    });
    const res = await run(db);
    expect(res).toMatchObject({ battleEnded: 1, battleLive: 0 });
    expect(res.voidUnwound ?? 0).toBe(0);
    expect(stored(db, vPath())).toMatchObject({ status: 'review_due', stateReason: 'battle_ended', firstDeployedAt: B1_AT });
    expect(stored(db, rowPath())).toBeNull();
  });

  it('P07 the \'recent\' phase passes over a row already due (here exactly at now) that the due phase\'s cursor is past this tick — the due phase judges it on its wrap', async () => {
    const db = store({
      [vPath()]: version(), [rowPath()]: row({ dueAtMs: NOW }), 'agentBattles/b-1': ran({ createdAt: B1_AT }),
      'hypothesisReviewState/cursor': { lastDocId: null, dueLastDueAtMs: NOW, dueLastDocId: 'wl-u:1' },
    });
    const res = await run(db);
    expect(res).toMatchObject({ rows: 0, horizonElapsed: 0 });
    expect(stored(db, vPath()).status).toBe('activated');
    const next = await run(db);
    expect(next).toMatchObject({ rows: 1, horizonElapsed: 1 });
  });

  it('P09 a missing first deploy never matches a missing createdAt (null is not a stamp): unresolved, with or without the list', () => {
    const pre = (over) => { const v = version(over); delete v.deployedBattleIds; return v; };
    const unstamped = neverRan({ createdAt: null });
    expect(voidBranchOf({ version: pre({ firstDeployedAt: null }), battleId: 'b-1', battle: unstamped })).toEqual({ unresolved: 'void_previous_unknown' });
    expect(voidBranchOf({ version: version({ firstDeployedAt: null }), battleId: 'b-1', battle: unstamped })).toEqual({ unresolved: 'void_previous_unknown' });
  });

  it('P08 a stale row (its version no longer activated) never reads its battle — deleted on the version alone', async () => {
    const db = store({ [vPath()]: version({ status: 'retired' }), [rowPath()]: row(), 'agentBattles/b-1': neverRan() });
    const res = await run(db);
    expect(res.staleDeleted).toBe(1);
    expect(db.__access.reads.filter((p) => p === 'agentBattles/b-1')).toEqual([]);
  });
});
