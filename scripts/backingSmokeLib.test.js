// scripts/backingSmokeLib.test.js
//
// Backing activation — the smoke script's pure half, and THE WALK end to end
// on the versioned Firestore harness (the same primitives, in the same order
// the script calls them: seed → the synthetic stakes through placeStake → the
// founder's stake through the REAL checker → close → the synthetic week →
// settle; and the refund ending). The script itself needs credentials and
// exits the process, so its decisions live in scripts/backingSmokeLib.js and
// are held here:
//   · no id a run mints is inside the `dev-` space the primitives refuse;
//   · the seed stamps the UPCOMING battle week (D-SEEDWEEK);
//   · the synthetic week banks five days, every human seat with a non-zero
//     agent half (D-ae), the named winner alone on top — and settlement pays;
//   · the walk writes NOTHING outside the dev namespace but the founder's
//     eligibility document (which the walk does not write — the attest door
//     does; here it is seeded, and the row says so);
//   · the cleanup verdict refuses every non-dev target (mutation check 4);
//   · the ledger invariants, the manifest, the command line.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FALLBACK_USER_POOL, SMOKE_STAKES, SMOKE_TOOL, addDays, addRun, buildSmokeGroup, buildSyntheticWeek, devTargetVerdict,
  emptyManifest, latestRun, ledgerInvariant, parseArgs, readOnlyHandle, removeRun, runFromLiveGroup, runStamp, smokeEligibilityFor, smokeIds,
  syntheticToken, upcomingBattleWeek, validSmokeRun,
} from './backingSmokeLib.js';
import { SMOKE_POD_TOOL, smokeListablePod } from '../api/_utils/backingPools.js';
import { makeVersionedDb } from '../api/_utils/__fixtures__/versionedFirestore.js';
import { poolEligible } from '../api/_utils/backingWeek.js';
import { BACKING_POOLS_COLLECTION, BACKING_STAKES_COLLECTION, POOL_STATUS, VOID_REASONS, closePool, materializePool, poolIdFor, walletIdFor as _unused } from '../api/_utils/backingPools.js';
import { BACKING_WALLETS_COLLECTION, walletIdFor } from '../api/_utils/backingWallet.js';
import { SETTLEMENT_SOURCE, agentLayerAbsent, refundPool, settlePool, settlementPredicate, winningSet } from '../api/_utils/backingSettlement.js';
import { placeStake } from '../api/_utils/backingStake.js';
import { ELIGIBILITY_COLLECTION } from '../api/_utils/eligibility.js';
import { TERMS_VERSION } from '../src/constants/eligibility.js';
import { GROUP_STATUS, getWeeklyComposite, isWeekBanked } from '../src/constants/leagueTournament.js';

void _unused;

// A Tuesday of the backing week before the battle Monday 2026-09-28 (ET).
const NOW = new Date('2026-09-22T14:00:00.000Z');
const STAMP = '20260922_abc123';
const FOUNDER = 'founder-real-uid';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe('ids', () => {
  it('mints ids outside the `dev-` space the primitives refuse, and the pool/wallet ids they derive are `dev-`', () => {
    const ids = smokeIds(STAMP);
    for (const id of [ids.groupId, ...ids.seatUids, ...ids.backerUids]) expect(id.startsWith('dev-'), id).toBe(false);
    expect(ids.groupId).toBe('smk_20260922_abc123');
    expect(ids.poolId).toBe('dev-smk_20260922_abc123');
    expect(poolIdFor({ id: ids.groupId, isDev: true })).toBe(ids.poolId);
    expect(walletIdFor(ids.backerUids[0], { dev: true })).toBe(`dev-${ids.backerUids[0]}`);
    expect(ids.cpuIds).toEqual(['cpu-98', 'cpu-99']);
    expect(() => smokeIds('bad stamp!')).toThrow();
  });
  it('a run stamp is the UTC date and six characters', () => {
    expect(runStamp(NOW, () => 0)).toMatch(/^20260922_[a-z0-9]{6}$/);
  });
});

describe('the seed', () => {
  it('stamps the UPCOMING battle week — the week the pool will belong to, never the formation week (D-SEEDWEEK)', () => {
    const ids = smokeIds(STAMP);
    const doc = buildSmokeGroup({ ids, nowIso: NOW.toISOString(), userPool: [] });
    expect(doc.baseLayerWeek).toBe('2026-W40');
    expect(upcomingBattleWeek(NOW.toISOString())).toEqual({ battleMondayEtDate: '2026-09-28', baseLayerWeek: '2026-W40' });
    // …and the pool the production rule would open for it belongs to that week.
    const elig = poolEligible({ id: ids.groupId, ...doc, isDev: false }, NOW);
    expect(elig.eligible).toBe(true);
    expect(elig.weekKey).toBe('2026-W40');
    expect(elig.closesAt).toBe('2026-09-28T03:59:59.999Z'.slice(0, 19) + elig.closesAt.slice(19));
  });
  it('is a real lobby pod through the tournament factory: isDev, forming, two humans with seat names, two CPUs, the smoke marker; the fallback pool when the universe is short', () => {
    const ids = smokeIds(STAMP);
    const doc = buildSmokeGroup({ ids, nowIso: NOW.toISOString(), userPool: ['AAPL'] });
    expect(doc).toMatchObject({ status: 'forming', isDev: true, roundNumber: 1, smoke: { tool: SMOKE_TOOL, stamp: STAMP } });
    expect(doc.groupMembers).toEqual([...ids.seatUids, ...ids.cpuIds]);
    expect(doc.players.filter((p) => p.isCpu === true).map((p) => p.odUserId)).toEqual(ids.cpuIds);
    expect(doc.seatNames).toEqual({ [ids.seatUids[0]]: 'Smoke Rival A', [ids.seatUids[1]]: 'Smoke Rival B' });
    expect(doc.userPool).toEqual([...FALLBACK_USER_POOL]);
    expect(doc.isTraining).toBeUndefined();
    expect(buildSmokeGroup({ ids, nowIso: NOW.toISOString(), userPool: Array.from({ length: 20 }, (_, i) => `S${i}`) }).userPool).toHaveLength(20);
  });
  it('the marker is the ONE constant the smoke pod list admits on, and carries the run\'s backers (and the founder when named) so cleanup can rebuild the run from the live pod (SCRIPT-07, SCRIPT-08)', () => {
    const ids = smokeIds(STAMP);
    expect(SMOKE_TOOL).toBe(SMOKE_POD_TOOL);
    const doc = buildSmokeGroup({ ids, nowIso: NOW.toISOString(), userPool: [] });
    expect(doc.smoke).toEqual({ tool: SMOKE_TOOL, stamp: STAMP, createdAt: NOW.toISOString(), backerUids: ids.backerUids });
    expect(smokeListablePod({ id: ids.groupId, ...doc })).toBe(true);
    expect(smokeListablePod({ id: ids.groupId, ...doc, smoke: undefined })).toBe(false);
    const named = buildSmokeGroup({ ids, nowIso: NOW.toISOString(), userPool: [], founderUid: FOUNDER });
    expect(named.smoke.founderUid).toBe(FOUNDER);
    expect(buildSmokeGroup({ ids, nowIso: NOW.toISOString(), userPool: [], founderUid: '' }).smoke.founderUid).toBeUndefined();
  });
});

describe('the synthetic week', () => {
  const ids = smokeIds(STAMP);
  const group = { id: ids.groupId, ...buildSmokeGroup({ ids, nowIso: NOW.toISOString(), userPool: [] }) };
  it('banks five days Monday–Friday, every human seat with a NON-ZERO agent half (D-ae), the named winner alone on top', () => {
    const dailyScores = buildSyntheticWeek({ group, battleMondayEtDate: '2026-09-28', winnerOdUserId: ids.seatUids[1], recordedAtIso: NOW.toISOString() });
    expect(Object.keys(dailyScores)).toEqual(['day1', 'day2', 'day3', 'day4', 'day5']);
    expect([1, 2, 3, 4, 5].map((d) => dailyScores[`day${d}`].recordedDate)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    const banked = { ...group, dailyScores, status: GROUP_STATUS.COMPLETE };
    expect(isWeekBanked(banked)).toBe(true);
    expect(settlementPredicate(banked)).toEqual({ final: true, reason: null });
    expect(agentLayerAbsent(banked)).toBe(false);
    for (const uid of ids.seatUids) expect(dailyScores.day5.closeScores[uid].agentPoints).toBeGreaterThan(0);
    const { winners, composites } = winningSet(banked);
    expect(winners).toEqual([ids.seatUids[1]]);
    const values = Object.values(composites);
    expect(new Set(values).size).toBe(values.length); // no ties
    expect(getWeeklyComposite(banked, ids.seatUids[1])).toBe(Math.max(...values));
  });
  it('a CPU seat named winner IS the winner — on both layers, no ties (SCRIPT-03: `--winner=cpu-98` is honoured, never silently overridden)', () => {
    for (const winner of group.groupMembers) {
      const dailyScores = buildSyntheticWeek({ group, battleMondayEtDate: '2026-09-28', winnerOdUserId: winner, recordedAtIso: NOW.toISOString() });
      const banked = { ...group, dailyScores, status: GROUP_STATUS.COMPLETE };
      const { winners, composites } = winningSet(banked);
      expect(winners, winner).toEqual([winner]);
      expect(new Set(Object.values(composites)).size).toBe(4);
      expect(agentLayerAbsent(banked)).toBe(false);
      for (const uid of ids.seatUids) expect(dailyScores.day1.closeScores[uid].agentPoints, uid).toBeGreaterThan(0);
    }
  });
  it('refuses a winner who is not seated, and a missing Monday', () => {
    expect(() => buildSyntheticWeek({ group, battleMondayEtDate: '2026-09-28', winnerOdUserId: 'nobody', recordedAtIso: NOW.toISOString() })).toThrow(/not a member/);
    expect(() => buildSyntheticWeek({ group, battleMondayEtDate: null, winnerOdUserId: ids.seatUids[0], recordedAtIso: NOW.toISOString() })).toThrow(/battleMondayEtDate/);
  });
  it('addDays walks the calendar alone', () => {
    expect(addDays('2026-09-28', 4)).toBe('2026-10-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(() => addDays('nope', 1)).toThrow();
  });
});

describe('the synthetic eligibility checker', () => {
  const ids = smokeIds(STAMP);
  const group = { id: ids.groupId, ...buildSmokeGroup({ ids, nowIso: NOW.toISOString(), userPool: [] }) };
  const check = smokeEligibilityFor(ids.backerUids);
  it('asserts the two account facts for a SYNTHETIC uid, still refuses an anonymous provider, and still runs own-pod and seat-present', async () => {
    const db = { collection: () => { throw new Error('a synthetic backer reads nothing'); } };
    expect(await check(db, { uid: ids.backerUids[0], decodedToken: syntheticToken(ids.backerUids[0]), group, teamOdUserId: ids.seatUids[0] })).toEqual({ allowed: true, reason: null });
    expect(await check(db, { uid: ids.backerUids[0], decodedToken: { uid: ids.backerUids[0], firebase: { sign_in_provider: 'anonymous' } }, group, teamOdUserId: ids.seatUids[0] })).toEqual({ allowed: false, reason: 'account_required' });
    // Own-pod, on a synthetic backer who is (in this fixture) also seated.
    const seatedBacker = { ...group, players: [...group.players, { odUserId: ids.backerUids[1], picks: [] }] };
    expect(await check(db, { uid: ids.backerUids[1], decodedToken: syntheticToken(ids.backerUids[1]), group: seatedBacker, teamOdUserId: ids.seatUids[1] })).toEqual({ allowed: false, reason: 'own_pod' });
    expect(await check(db, { uid: ids.backerUids[0], decodedToken: syntheticToken(ids.backerUids[0]), group, teamOdUserId: 'not-seated' })).toEqual({ allowed: false, reason: 'seat_not_present' });
  });
  it('delegates a NON-synthetic uid to the real checker unchanged — the founder is never synthetic', async () => {
    const reads = [];
    const db = { collection: (name) => { reads.push(name); return { doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }), where: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }) }) }; } };
    const out = await check(db, { uid: FOUNDER, decodedToken: { uid: FOUNDER, firebase: { sign_in_provider: 'password' } }, group, teamOdUserId: ids.seatUids[0] });
    expect(out).toEqual({ allowed: false, reason: 'eligibility_required' });
    expect(reads).toContain('eligibility');
  });
});

describe('the cleanup verdict (mutation check 4: a non-dev target reds these rows)', () => {
  const run = { groupId: 'smk_1', poolId: 'dev-smk_1', backerUids: ['smk_backer_1_1'], uids: ['smk_backer_1_1', FOUNDER] };
  const ok = (p, d) => expect(devTargetVerdict(p, d, run).ok, p).toBe(true);
  const refused = (p, d, why) => { const v = devTargetVerdict(p, d, run); expect(v.ok, p).toBe(false); if (why) expect(v.reason).toMatch(why); };
  it('admits exactly this run\'s dev-namespaced documents', () => {
    ok('backingPools/dev-smk_1', {}); ok('backingPools/dev-smk_1/private/totals', {});
    ok('backingWallets/dev-smk_backer_1_1', {}); ok(`backingWallets/dev-${FOUNDER}/entries/allowance:2026-W40`, {});
    ok('backingStakes/stk_abc', { groupId: 'smk_1', poolId: 'dev-smk_1' }); ok('backingStakes/stk_abc/private/meta', { groupId: 'smk_1', poolId: 'dev-smk_1' });
    ok('backingEvents/stake_confirmed:dev:dbt_1', { userId: FOUNDER, props: { isDev: true } });
    ok('backingEvents/dev:bev_window_viewed_x', { userId: FOUNDER, isDev: true });
    ok('tournamentGroups/smk_1', { isDev: true, smoke: { tool: SMOKE_TOOL } });
    ok('tournamentGroups/smk_1/boards/x', { isDev: true, smoke: { tool: SMOKE_TOOL } });
  });
  it('REFUSES a pool, wallet, stake, event, pod or collection outside the dev namespace or outside this run', () => {
    refused('backingPools/smk_1', {}, /outside the dev namespace/);
    refused('backingPools/dev-other', {}, /not this run/);
    refused(`backingWallets/${FOUNDER}`, {}, /outside the dev namespace/);
    refused('backingWallets/dev-x/other/y', {}, /unexpected subcollection/);
    refused('backingStakes/stk_abc', { groupId: 'prod-pod', poolId: 'dev-smk_1' }, /does not name this run's pod/);
    refused('backingStakes/stk_abc', { groupId: 'smk_1', poolId: 'smk_1' }, /does not name this run's dev pool/);
    refused('backingStakes/stk_abc', { groupId: 'smk_1' }, /does not name this run's dev pool/);
    refused('backingStakes/stk_abc/private/other', { groupId: 'smk_1', poolId: 'dev-smk_1' }, /unexpected subcollection/);
    refused('backingEvents/bev_window_viewed_x', { userId: FOUNDER }, /without the dev marker/);
    refused('backingEvents/dev:bev_x', { userId: 'stranger', isDev: true }, /outside this run/);
    refused('tournamentGroups/prod-pod', { isDev: true, smoke: { tool: SMOKE_TOOL } }, /not this run/);
    refused('tournamentGroups/smk_1', { isDev: false, smoke: { tool: SMOKE_TOOL } }, /not isDev/);
    refused('tournamentGroups/smk_1', { isDev: true }, /without the smoke marker/);
    refused(`eligibility/${FOUNDER}`, { termsVersion: TERMS_VERSION }, /never touches/);
    refused('users/x', {}, /never touches/);
    refused('agentBattles/x', {}, /never touches/);
    refused('backingPools', {}, /not a document path/);
    refused('backingPools/dev-smk_1/private', {}, /not a document path/);
  });
  it('REFUSES EVERYTHING for a run outside the smoke shape — a bent manifest naming a production pod can admit nothing, not even a dev wallet (DEV-3)', () => {
    const bent = [
      { groupId: 'prod-pod-abc', poolId: 'dev-prod-pod-abc', backerUids: [] },           // not the smoke prefix
      { groupId: 'smk_1', poolId: 'smk_1', backerUids: [] },                             // a production pool id
      { groupId: 'smk_1', poolId: 'dev-smk_2', backerUids: [] },                         // another pod's pool
      { groupId: 'smk_1', poolId: 'dev-smk_1' },                                         // no backers list
      { groupId: 'smk_1', poolId: 'dev-smk_1', backerUids: ['ok', 42] },                 // a non-string backer
      null,
    ];
    for (const r of bent) {
      expect(validSmokeRun(r), JSON.stringify(r)).toBe(false);
      for (const p of ['backingStakes/stk_1', 'backingWallets/dev-x', 'backingPools/dev-smk_1', 'tournamentGroups/smk_1', 'backingEvents/dev:bev_1']) {
        const v = devTargetVerdict(p, { groupId: 'prod-pod-abc', poolId: 'prod-pod-abc', isDev: true, smoke: { tool: SMOKE_TOOL }, userId: 'ok', isDev_: true }, r);
        expect(v.ok, `${JSON.stringify(r)} ${p}`).toBe(false);
        expect(v.reason).toMatch(/not a smoke run/);
      }
    }
    expect(validSmokeRun(run)).toBe(true);
    expect(validSmokeRun({ groupId: 'smk_1', poolId: 'dev-smk_1', backerUids: [] })).toBe(true);
  });
});

describe('a run rebuilt from the LIVE pod (cleanup --pod on a machine without the manifest — SCRIPT-07)', () => {
  const ids = smokeIds(STAMP);
  const doc = buildSmokeGroup({ ids, nowIso: NOW.toISOString(), userPool: [], founderUid: FOUNDER });
  it('rebuilds exactly the manifest\'s shape from a marked isDev pod, marked `recovered`', () => {
    const run = runFromLiveGroup(ids.groupId, doc);
    expect(run).toMatchObject({
      groupId: ids.groupId, poolId: ids.poolId, stamp: STAMP, createdAt: NOW.toISOString(), baseLayerWeek: '2026-W40',
      seatUids: ids.seatUids, cpuIds: ids.cpuIds, backerUids: ids.backerUids, founderUid: FOUNDER, uids: ids.backerUids, stakes: [], recovered: true,
    });
    expect(validSmokeRun(run)).toBe(true);
    expect(runFromLiveGroup(ids.groupId, { ...doc, smoke: { tool: SMOKE_TOOL, stamp: STAMP } }).backerUids).toEqual([]);
  });
  it('is null — never a guess — for an unmarked pod, a production pod, a foreign dev pod, a `dev-` id, or a pod outside the smoke prefix', () => {
    expect(runFromLiveGroup(ids.groupId, { ...doc, smoke: undefined })).toBeNull();
    expect(runFromLiveGroup(ids.groupId, { ...doc, smoke: { tool: 'scripts/seed-tournament-group.js' } })).toBeNull();
    expect(runFromLiveGroup(ids.groupId, { ...doc, isDev: false })).toBeNull();
    expect(runFromLiveGroup('prod-pod', { ...doc })).toBeNull();
    expect(runFromLiveGroup(`dev-${ids.groupId}`, { ...doc })).toBeNull();
    expect(runFromLiveGroup(ids.groupId, null)).toBeNull();
  });
});

describe('the read-only handle (status and every --dry-run — DEV-6 / SCRIPT-10)', () => {
  const fake = () => {
    const doc = { set: () => 'wrote', update: () => 'wrote', delete: () => 'wrote', get: async () => ({ exists: true, data: () => ({ a: 1 }), ref: { set: () => 'wrote' } }), collection: () => query, path: 'c/d', id: 'd', parent: { doc: () => doc }, firestore: {} };
    const query = { where: () => query, orderBy: () => query, limit: () => query, get: async () => ({ size: 1, forEach: (f) => f({ id: 'x', data: () => ({}), ref: doc }) }), doc: () => doc, add: () => 'wrote', listCollections: async () => [query] };
    const db = { collection: () => query, batch: () => ({ delete: () => {}, commit: () => 'wrote' }), runTransaction: async () => 'wrote', doc: () => doc, collectionGroup: () => query };
    return db;
  };
  it('every write path THROWS — on the handle and on everything chained from it — and reads pass through', async () => {
    const db = readOnlyHandle(fake());
    expect(() => db.batch()).toThrow(/READ-ONLY VIOLATION/);
    expect(() => db.runTransaction()).toThrow(/READ-ONLY VIOLATION/);
    expect(() => db.collection('x').doc('y').set({})).toThrow(/READ-ONLY VIOLATION: db\.collection\.doc\.set/);
    expect(() => db.collection('x').doc('y').update({})).toThrow(/READ-ONLY VIOLATION/);
    expect(() => db.collection('x').doc('y').delete()).toThrow(/READ-ONLY VIOLATION/);
    expect(() => db.collection('x').add({})).toThrow(/READ-ONLY VIOLATION/);
    expect(() => db.collection('x').where('a', '==', 1).doc('y').set({})).toThrow(/READ-ONLY VIOLATION/);
    expect(() => db.collection('x').doc('y').collection('z').doc('w').delete()).toThrow(/READ-ONLY VIOLATION/);
    // The escape hatches are blocked on ACCESS.
    expect(() => db.collection('x').doc('y').parent).toThrow(/escape hatch/);
    expect(() => db.collection('x').doc('y').firestore).toThrow(/escape hatch/);
    // Reads, chaining, plain properties and Promise results pass.
    expect(db.collection('x').doc('y').path).toBe('c/d');
    expect(db.collection('x').doc('y').id).toBe('d');
    const snap = await db.collection('x').doc('y').get();
    expect(snap.exists).toBe(true);
    expect(snap.data()).toEqual({ a: 1 });
    expect((await db.collection('x').where('a', '==', 1).orderBy('b').limit(5).get()).size).toBe(1);
    expect(await db.collection('x').doc('y').listCollections?.()).toBeUndefined();
    expect((await db.collection('x').listCollections()).length).toBe(1);
  });
});

describe('the ledger invariants', () => {
  it('Σ entries = the cached balances, per field, per month; a drift reads MISMATCH', () => {
    const entries = [
      { type: 'allowance', delta: 1000, weekKey: '2026-W40' },
      { type: 'stake', delta: -200, weekKey: '2026-W40' },
      { type: 'stake', delta: -100, weekKey: '2026-W40' },
      { type: 'loss', delta: -300, monthKey: '2026-09' },
      { type: 'payout', delta: 450, monthKey: '2026-09' },
    ];
    const good = ledgerInvariant({ allowanceRemaining: 700, careerNet: 150, seasons: { '2026-09': { net: 150 } } }, entries);
    expect(good.ok).toBe(true);
    expect(good.allowance).toEqual({ cached: 700, summed: 700, ok: true });
    expect(good.career).toEqual({ cached: 150, summed: 150, ok: true });
    expect(good.seasons).toEqual([{ monthKey: '2026-09', cached: 150, summed: 150, ok: true }]);
    const drift = ledgerInvariant({ allowanceRemaining: 800, careerNet: 150, seasons: { '2026-09': { net: 0 } } }, entries);
    expect(drift.ok).toBe(false);
    expect(drift.allowance.ok).toBe(false);
    expect(drift.seasons[0].ok).toBe(false);
    expect(ledgerInvariant(null, []).ok).toBe(true);
  });
});

describe('the manifest and the command line', () => {
  it('adds, replaces, removes and picks the latest run', () => {
    let m = addRun(emptyManifest(), { groupId: 'a' });
    m = addRun(m, { groupId: 'b' });
    m = addRun(m, { groupId: 'a', again: true });
    expect(m.runs.map((r) => r.groupId)).toEqual(['b', 'a']);
    expect(latestRun(m)).toEqual({ groupId: 'a', again: true });
    expect(removeRun(m, 'a').runs.map((r) => r.groupId)).toEqual(['b']);
    expect(latestRun(emptyManifest())).toBeNull();
    expect(addRun(null, { groupId: 'x' }).runs).toHaveLength(1);
  });
  it('parses the command, --pod, --winner, --founder, --dry-run, --json and reports unknown arguments', () => {
    expect(parseArgs(['seed', '--dry-run'])).toEqual({ command: 'seed', flags: { dryRun: true, json: false, pod: null, winner: null, founder: null }, unknown: [] });
    expect(parseArgs(['advance', '--pod=smk_1', '--winner=u2'])).toMatchObject({ command: 'advance', flags: { pod: 'smk_1', winner: 'u2' } });
    expect(parseArgs(['status', '--founder=me', '--json'])).toMatchObject({ command: 'status', flags: { founder: 'me', json: true } });
    expect(parseArgs(['nuke'])).toMatchObject({ command: null });
    expect(parseArgs(['cleanup', '--force'])).toMatchObject({ command: 'cleanup', unknown: ['--force'] });
    // `seed` mints a run; a --pod there is a mistake, reported, not ignored (SCRIPT-12).
    expect(parseArgs(['seed', '--pod=smk_1'])).toMatchObject({ command: 'seed', flags: { pod: null }, unknown: ['--pod=smk_1'] });
    expect(parseArgs(['cleanup', '--pod=smk_1', '--founder=me'])).toMatchObject({ command: 'cleanup', flags: { pod: 'smk_1', founder: 'me' }, unknown: [] });
  });
});

// ============================================================================
// THE WALK, end to end, on the versioned harness — the script's plan with the
// real primitives.
describe('the walk — seed, the founder\'s stake, close, the synthetic week, settle; and the refund ending', () => {
  const ids = smokeIds(STAMP);
  const nowIso = NOW.toISOString();
  const groupDoc = buildSmokeGroup({ ids, nowIso, userPool: [] });
  const founderWorld = () => ({
    // The founder's consent record — written by the attest door on the preview, never by the script; seeded here.
    [`${ELIGIBILITY_COLLECTION}/${FOUNDER}`]: { adultAttestedAt: nowIso, termsVersion: TERMS_VERSION, acceptedAt: nowIso, source: 'backing_beta' },
    // …and his one completed battle (the §8 speed bump) — real data he already holds.
    'agentBattles/b-founder': { ownerId: FOUNDER, status: 'completed', completedAt: '2026-09-10T20:00:00.000Z', gameMode: 'baggerbomb' },
  });
  const founderToken = { uid: FOUNDER, firebase: { sign_in_provider: 'password' } };
  const fp = { ipHash: 'h', uaHash: 'h' };

  async function seedOn(DB) {
    await DB.db.collection('tournamentGroups').doc(ids.groupId).set(groupDoc);
    const group = { id: ids.groupId, ...groupDoc };
    const m = await materializePool(DB.db, group, NOW, { allowDev: true });
    expect(m.created).toBe(true);
    const check = smokeEligibilityFor(ids.backerUids);
    for (const plan of SMOKE_STAKES) {
      const uid = ids.backerUids[plan.backer];
      const out = await placeStake(DB.db, { uid, decodedToken: syntheticToken(uid), groupId: ids.groupId, teamOdUserId: ids.seatUids[plan.seat], amount: plan.amount, requestId: `smoke-${STAMP}-${plan.backer + 1}`, fingerprint: fp, now: NOW, smoke: true, allowDev: true, checkEligibility: check });
      expect(out.refusal, uid).toBeUndefined();
    }
    return group;
  }
  const founderStakes = async (DB, team, amount, requestId) => placeStake(DB.db, { uid: FOUNDER, decodedToken: founderToken, groupId: ids.groupId, teamOdUserId: team, amount, requestId, fingerprint: fp, now: NOW, smoke: true, allowDev: true });

  it('the seed: the pool opens at dev-{groupId}; two synthetic backers on two teams; the founder\'s stake (the REAL checker) makes three backers — then a top-up', async () => {
    const DB = makeVersionedDb(founderWorld());
    await seedOn(DB);
    const totals = () => DB.store.get(`${BACKING_POOLS_COLLECTION}/${ids.poolId}/private/totals`);
    expect(totals()).toMatchObject({ uniqueBackers: 2, teamsBacked: 2, potTotal: 350 });
    const first = await founderStakes(DB, ids.seatUids[0], 100, 'founder-1');
    expect(first.refusal).toBeUndefined();
    expect(first.stake.poolId).toBe(ids.poolId);
    const topUp = await founderStakes(DB, ids.seatUids[0], 150, 'founder-2');
    expect(topUp.topUp).toBe(true);
    expect(totals()).toMatchObject({ uniqueBackers: 3, teamsBacked: 2, potTotal: 600 });
    expect(DB.store.get(`${BACKING_POOLS_COLLECTION}/${ids.poolId}`)).toMatchObject({ backerProgress: { count: 3, met: true }, teamSpread: { met: true } });
    expect(DB.store.get(`${BACKING_WALLETS_COLLECTION}/dev-${FOUNDER}`).careerNet).toBe(-250);
    expect(DB.store.has(`${BACKING_WALLETS_COLLECTION}/${FOUNDER}`)).toBe(false);
  });

  // EVERY path the harness saw written, through the cleanup verdict: a dev
  // pool, a dev wallet, a stake of the dev pod (naming the dev pool), or the
  // dev pod itself — nothing else, ever (the dev-only row; DEV-7: run after
  // the seed, after advance and after refund alike).
  const run = { groupId: ids.groupId, poolId: ids.poolId, backerUids: ids.backerUids, uids: [...ids.backerUids, FOUNDER] };
  function expectOnlyDevWrites(DB, atLeast) {
    const written = [...new Set(DB.writeLog.map(([, p]) => p))];
    expect(written.length).toBeGreaterThanOrEqual(atLeast);
    for (const p of written) {
      const [col, id] = p.split('/');
      // A stake's sealed meta is judged by its PARENT (the script passes the parent too).
      const doc = col === 'backingStakes' ? DB.store.get(`${col}/${id}`) : (DB.store.get(p) ?? DB.store.get(`${col}/${id}`));
      expect(devTargetVerdict(p, doc, run).ok, p).toBe(true);
    }
    expect(written.some((p) => p.startsWith(`${ELIGIBILITY_COLLECTION}/`))).toBe(false);
    expect(written.some((p) => /^backingPools\/(?!dev-)/.test(p) || /^backingWallets\/(?!dev-)/.test(p))).toBe(false);
    return written;
  }

  it('the walk writes NOTHING outside the dev namespace — every written path is a dev pool, a dev wallet, a stake of the dev pod, or the dev pod itself; the founder\'s eligibility is READ, never written', async () => {
    const DB = makeVersionedDb(founderWorld());
    await seedOn(DB);
    await founderStakes(DB, ids.seatUids[1], 100, 'founder-1');
    expectOnlyDevWrites(DB, 10);
  });

  it('advance: close at a simulated instant, bank the synthetic week, complete, settle — the winner\'s backers are paid, Σ entries = the cached balances everywhere', async () => {
    const DB = makeVersionedDb(founderWorld());
    const group = await seedOn(DB);
    await founderStakes(DB, ids.seatUids[0], 100, 'founder-1');
    const closed = await closePool(DB.db, group, NOW);
    expect(closed).toMatchObject({ closed: true, status: POOL_STATUS.CLOSED, voided: 0 });
    const dailyScores = buildSyntheticWeek({ group, battleMondayEtDate: '2026-09-28', winnerOdUserId: ids.seatUids[0], recordedAtIso: nowIso });
    const current = DB.store.get(`tournamentGroups/${ids.groupId}`);
    await DB.db.collection('tournamentGroups').doc(ids.groupId).set({ ...current, dailyScores, status: GROUP_STATUS.COMPLETE, completedAt: nowIso, updatedAt: nowIso });
    const result = await settlePool(DB.db, ids.groupId, { now: NOW, source: SETTLEMENT_SOURCE.ADMIN_SIM, actor: SMOKE_TOOL });
    expect(result.settled, JSON.stringify(result)).toBe(true);
    expect(result.winners).toEqual([ids.seatUids[0]]);
    // Pot 450: seat A holds 200 (backer 1) + 100 (founder) = 300 winning; seat B 150. pays 1.5×.
    expect(result.pool.potTotal).toBe(450);
    expect(result.paysX).toBe(1.5);
    const stakes = [...DB.store.entries()].filter(([p]) => p.startsWith(`${BACKING_STAKES_COLLECTION}/`) && !p.includes('/private/')).map(([, d]) => d);
    const byUser = Object.fromEntries(stakes.map((s) => [s.userId, s]));
    expect(byUser[ids.backerUids[0]]).toMatchObject({ status: 'won', payout: 300 });
    expect(byUser[FOUNDER]).toMatchObject({ status: 'won', payout: 150 });
    expect(byUser[ids.backerUids[1]]).toMatchObject({ status: 'lost', payout: 0 });
    for (const uid of [...ids.backerUids, FOUNDER]) {
      const wid = `${BACKING_WALLETS_COLLECTION}/dev-${uid}`;
      const wallet = DB.store.get(wid);
      const entries = [...DB.store.entries()].filter(([p]) => p.startsWith(`${wid}/entries/`)).map(([, d]) => d);
      const inv = ledgerInvariant(wallet, entries);
      expect(inv.ok, `${uid}: ${JSON.stringify(inv)}`).toBe(true);
    }
    expect(DB.store.get(`${BACKING_WALLETS_COLLECTION}/dev-${FOUNDER}`).careerNet).toBe(50);
    expect(DB.store.get(`${BACKING_WALLETS_COLLECTION}/dev-${ids.backerUids[1]}`).careerNet).toBe(-150);
    // No production wallet, no production pool, ever — and every path the
    // close, the banking write and the settlement touched passes the verdict.
    expect([...DB.store.keys()].filter((p) => /^backingWallets\/(?!dev-)/.test(p) || /^backingPools\/(?!dev-)/.test(p))).toEqual([]);
    const written = expectOnlyDevWrites(DB, 12);
    expect(written).toContain(`tournamentGroups/${ids.groupId}`);
    expect(written.some((p) => p.startsWith(`${BACKING_WALLETS_COLLECTION}/dev-${FOUNDER}/entries/`))).toBe(true);
  });

  it('refund: close, void the dev pod, refund through the real primitive — every stake voided group_voided, every backer nets to zero', async () => {
    const DB = makeVersionedDb(founderWorld());
    const group = await seedOn(DB);
    await founderStakes(DB, ids.seatUids[1], 100, 'founder-1');
    expect((await closePool(DB.db, group, NOW)).status).toBe(POOL_STATUS.CLOSED);
    const current = DB.store.get(`tournamentGroups/${ids.groupId}`);
    await DB.db.collection('tournamentGroups').doc(ids.groupId).set({ ...current, status: GROUP_STATUS.VOIDED, voidedAt: nowIso, voidedReason: 'backing_smoke_refund', updatedAt: nowIso });
    const result = await refundPool(DB.db, ids.groupId, { now: NOW, source: SETTLEMENT_SOURCE.ADMIN_SIM, reason: VOID_REASONS.GROUP_VOIDED, actor: SMOKE_TOOL, note: 'walk' });
    expect(result).toMatchObject({ refunded: true, stakesVoided: 3, refundReason: VOID_REASONS.GROUP_VOIDED });
    for (const uid of [...ids.backerUids, FOUNDER]) {
      const wid = `${BACKING_WALLETS_COLLECTION}/dev-${uid}`;
      const wallet = DB.store.get(wid);
      expect(wallet.careerNet, uid).toBe(0);
      const entries = [...DB.store.entries()].filter(([p]) => p.startsWith(`${wid}/entries/`)).map(([, d]) => d);
      expect(ledgerInvariant(wallet, entries).ok, uid).toBe(true);
    }
    expect(DB.store.get(`${BACKING_POOLS_COLLECTION}/${ids.poolId}`).status).toBe(POOL_STATUS.REFUNDED);
    // …and every path the close, the void write and the refund touched passes the verdict.
    expectOnlyDevWrites(DB, 12);
  });

  it('a Sunday seed is refused by the same rule the production path applies — the window is too short', () => {
    const sunday = new Date('2026-09-27T16:00:00.000Z');
    const doc = buildSmokeGroup({ ids, nowIso: sunday.toISOString(), userPool: [] });
    const elig = poolEligible({ id: ids.groupId, ...doc, isDev: false }, sunday);
    expect(elig).toMatchObject({ eligible: false, reason: 'window_too_short' });
  });
});
