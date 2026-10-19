// api/_utils/liveDraftFormation.backedThisPod.test.js
//
// Backing safety fix 1, item C — BACK-THEN-JOIN IS REFUSED (Astra's BKG-005;
// Amendment D R3, the founder's Oct 18, 2026 ruling), and the close belt
// behind it (R4).
//
// Astra's probe P9: a spectator backs seat A, then claims an empty seat in the
// same slot pod — and keeps a live stake on a pod they now play in. The stake
// route refuses the other order (own-pod, backingEligibility.js); the claim
// never looked. `claimSlotSeat` now reads the claimant's live stakes for the
// pod INSIDE its transaction (both branches) and refuses `backed_this_pod`.
//
// FLAG DISCIPLINE: the read runs only while `BACKING_BETA_ENABLED` is true at
// call time, or on a dev pod. The flag is a call-time getter here, so each row
// sets it; flag off, a production claim is exactly today's — no stake read, the
// same write.
//
// THE ROWS (the build prompt's §3 C):
//   · back, then claim → refused, nothing written (MUTATION: drop the read →
//     this row fails);
//   · a claim with no stake → unchanged;
//   · join-then-back → still refused (the existing own-pod check);
//   · flag off with a production pod → unchanged (no stake read, same write);
//   · a stake and a claim INTERLEAVED in both orders on the versioned harness
//     → after close, a seated backer never holds a live stake (R4's belt).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real imports below are the
// guard — never mock them. Only the flag module is stood in for.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const flags = vi.hoisted(() => ({ backing: true }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return flags.backing; },
}));

const { makeVersionedDb } = await import('./__fixtures__/versionedFirestore.js');
const { makeInMemoryDb } = await import('./__fixtures__/inMemoryFirestore.js');
const { placeStake, stakeIdFor } = await import('./backingStake.js');
const { BACKING_POOLS_COLLECTION, BACKING_STAKES_COLLECTION, STAKE_STATUS, VOID_REASONS, ensureClosed, poolIdFor, seatedIdsFor } = await import('./backingPools.js');
const {
  CLAIM_LIVE_STAKE_STATUS, CLAIM_POOLS_COLLECTION, CLAIM_STAKES_COLLECTION, SLOT_SENTINEL_PREFIX, backedThisPodCheckApplies, claimPoolIdFor, claimSlotSeat, releaseSlotSeat, slotGroupId,
} = await import('./liveDraftFormation.js');
const { MIN_STAKE_BP } = await import('../../src/constants/backing.js');
const { TERMS_VERSION } = await import('../../src/constants/eligibility.js');

const NOW = new Date('2026-09-22T14:00:00.000Z');
const FIRE = new Date('2026-09-27T23:00:00.000Z');
const SLOT = 'sun-1900';
const GID = slotGroupId(SLOT, '2026-09-27');
const GROUP = `tournamentGroups/${GID}`;
const BACKED = `${SLOT_SENTINEL_PREFIX}backed_this_pod`;

const auth = (uid) => ({ uid, firebase: { sign_in_provider: 'password' } });
function seedBacker(store, uid) {
  store.set(`eligibility/${uid}`, { termsVersion: TERMS_VERSION, adultAttestedAt: NOW.toISOString(), acceptedAt: NOW.toISOString() });
  store.set(`agentBattles/done-${uid}`, { ownerId: uid, status: 'completed', completedAt: '2026-09-10T20:00:00.000Z' });
}
const slotDb = (initial = {}) => makeVersionedDb(initial, { slotWriters: true });
const claim = (w, uid, now = NOW) => claimSlotSeat(w.db, { slotId: SLOT, odUserId: uid, now });
function stakeArgs(uid, team) {
  return { uid, decodedToken: auth(uid), groupId: GID, teamOdUserId: team, amount: MIN_STAKE_BP, requestId: `${uid}-${team}`, now: NOW };
}
async function stake(w, uid, team) {
  seedBacker(w.store, uid);
  return placeStake(w.db, stakeArgs(uid, team));
}
const stakeDoc = (w, uid, team) => w.store.get(`backingStakes/${stakeIdFor(uid, GID, team)}`);
/** After the close: does any backer SEATED in the pod still hold a live stake on it? */
function seatedBackerLiveStakes(w) {
  const seated = seatedIdsFor(w.store.get(GROUP));
  return [...w.store.values()].filter((d) => d?.groupId === GID && d?.status === STAKE_STATUS.LIVE && seated.has(d.userId));
}

beforeEach(() => { flags.backing = true; vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe('the names this module keeps for the cycle-free read', () => {
  it('match backingPools.js — one collection, one live status', () => {
    expect(CLAIM_STAKES_COLLECTION).toBe(BACKING_STAKES_COLLECTION);
    expect(CLAIM_LIVE_STAKE_STATUS).toBe(STAKE_STATUS.LIVE);
    expect(CLAIM_POOLS_COLLECTION).toBe(BACKING_POOLS_COLLECTION);
    expect(claimPoolIdFor('lds_x', { isDev: false })).toBe(poolIdFor({ id: 'lds_x', isDev: false }));
    expect(claimPoolIdFor('lds_x', { isDev: true })).toBe(poolIdFor({ id: 'lds_x', isDev: true }));
  });
  it('the check applies with the flag on, or on a dev pod — never otherwise', () => {
    flags.backing = false;
    expect(backedThisPodCheckApplies(null)).toBe(false);
    expect(backedThisPodCheckApplies({ isDev: false })).toBe(false);
    expect(backedThisPodCheckApplies({ isDev: true })).toBe(true);
    flags.backing = true;
    expect(backedThisPodCheckApplies(null)).toBe(true);
  });
});

describe('item C — back-then-join (Amendment D R3)', () => {
  it('BACK, THEN CLAIM → refused `backed_this_pod`, nothing written', async () => {
    const w = slotDb();
    await claim(w, 'seat-a');
    await claim(w, 'seat-b');
    expect((await stake(w, 'u1', 'seat-a')).refusal).toBeUndefined();
    const before = structuredClone(Object.fromEntries(w.store));
    const logBefore = w.writeLog.length;
    await expect(claim(w, 'u1')).rejects.toThrow(BACKED);
    expect(w.writeLog.length).toBe(logBefore);
    expect(Object.fromEntries(w.store)).toEqual(before);
  });

  it('the CREATE branch too: a pod deleted and re-claimed keeps its id and its open pool — its backer cannot recreate it', async () => {
    const w = slotDb();
    await claim(w, 'seat-a');
    expect((await stake(w, 'u1', 'seat-a')).refusal).toBeUndefined();
    await releaseSlotSeat(w.db, GID, { odUserId: 'seat-a', now: NOW });
    expect(w.store.has(GROUP)).toBe(false);
    await expect(claim(w, 'u1')).rejects.toThrow(BACKED);
    expect(w.store.has(GROUP)).toBe(false);
    // Anyone without a stake there may.
    expect((await claim(w, 'u9')).created).toBe(true);
  });

  it('a claim with NO stake → unchanged (joins)', async () => {
    const w = slotDb();
    await claim(w, 'seat-a');
    await stake(w, 'u1', 'seat-a');
    const r = await claim(w, 'u2');
    expect(r).toMatchObject({ joined: true, humanCount: 2 });
    // A stake on ANOTHER pod, or one that is no longer live, does not block.
    w.store.set('backingStakes/other', { userId: 'u3', groupId: 'lds_wed-1900_2026-09-23', weekKey: '2026-W40', status: 'live', teamOdUserId: 'x', amount: 50 });
    w.store.set('backingStakes/voided', { userId: 'u3', groupId: GID, weekKey: '2026-W40', status: 'voided', teamOdUserId: 'seat-a', amount: 50 });
    expect((await claim(w, 'u3')).joined).toBe(true);
  });

  it('JOIN, THEN BACK → still refused by the stake route\'s own-pod check', async () => {
    const w = slotDb();
    await claim(w, 'seat-a');
    await claim(w, 'u1');
    const out = await stake(w, 'u1', 'seat-a');
    expect(out.refusal).toMatchObject({ status: 403, error: 'own_pod' });
  });

  it('FLAG OFF, production pod → today\'s claim exactly: no stake read inside the transaction, the same write', async () => {
    flags.backing = false;
    // The back-then-join shape (Astra P9) — a live stake exists, and the claim still joins.
    const seeded = () => {
      const w = makeInMemoryDb();
      return w;
    };
    const withStake = seeded();
    await claimSlotSeat(withStake.db, { slotId: SLOT, odUserId: 'seat-a', now: NOW });
    withStake.store.set(`backingStakes/${stakeIdFor('u1', GID, 'seat-a')}`, { userId: 'u1', groupId: GID, weekKey: '2026-W40', status: 'live', teamOdUserId: 'seat-a', amount: 50 });
    const control = seeded();
    await claimSlotSeat(control.db, { slotId: SLOT, odUserId: 'seat-a', now: NOW });

    const readsBefore = withStake.readLog.length;
    const joined = await claimSlotSeat(withStake.db, { slotId: SLOT, odUserId: 'u1', now: NOW });
    const controlJoined = await claimSlotSeat(control.db, { slotId: SLOT, odUserId: 'u1', now: NOW });
    expect(joined).toEqual(controlJoined);
    expect(withStake.store.get(GROUP)).toEqual(control.store.get(GROUP));
    const stakeReads = withStake.readLog.slice(readsBefore).filter(([, p]) => p.startsWith('backingStakes'));
    expect(stakeReads).toEqual([]);
  });

  it('FLAG OFF, the CREATE branch too (DARK-2): a claim that creates the pod makes no stake read, even with a live stake on its id', async () => {
    flags.backing = false;
    const w = makeInMemoryDb();
    w.store.set(`backingStakes/${stakeIdFor('u1', GID, 'seat-a')}`, { userId: 'u1', groupId: GID, weekKey: '2026-W40', status: 'live', teamOdUserId: 'seat-a', amount: 50 });
    const readsBefore = w.readLog.length;
    const created = await claimSlotSeat(w.db, { slotId: SLOT, odUserId: 'u1', now: NOW });
    expect(created.created).toBe(true);
    expect(w.readLog.slice(readsBefore).filter(([, p]) => p.startsWith('backingStakes'))).toEqual([]);
    // …and with the flag ON the same claim reads, and refuses.
    flags.backing = true;
    const on = makeInMemoryDb();
    on.store.set(`backingStakes/${stakeIdFor('u1', GID, 'seat-a')}`, { userId: 'u1', groupId: GID, weekKey: '2026-W40', status: 'live', teamOdUserId: 'seat-a', amount: 50 });
    await expect(claimSlotSeat(on.db, { slotId: SLOT, odUserId: 'u1', now: NOW })).rejects.toThrow(BACKED);
    expect(on.readLog.some(([ch, p]) => ch === 'tx.get' && p.startsWith('backingStakes'))).toBe(true);
  });

  it('flag off, a DEV pod → the check runs (no writer creates a dev slot pod today; the clause is belt)', async () => {
    flags.backing = false;
    const w = slotDb();
    await claim(w, 'seat-a');
    w.store.set(GROUP, { ...w.store.get(GROUP), isDev: true });
    w.store.set(`backingStakes/${stakeIdFor('u1', GID, 'seat-a')}`, { userId: 'u1', groupId: GID, weekKey: '2026-W40', status: 'live', teamOdUserId: 'seat-a', amount: 50 });
    await expect(claim(w, 'u1')).rejects.toThrow(BACKED);
  });
});

describe('CON-3 (the review): a release that read the clock just before the fire cannot commit after the close froze its seat', () => {
  it('the release reads the pool; a close that commits first sends it round again, and the re-run\'s fresh clock refuses — the frozen seat is still seated', async () => {
    const w = slotDb();
    for (const seat of ['seat-a', 'seat-b', 'seat-c']) await claim(w, seat);
    for (const [uid, team] of [['u1', 'seat-a'], ['u2', 'seat-b'], ['u3', 'seat-c']]) await stake(w, uid, team);
    const POOL = `backingPools/${GID}`;
    const readings = [new Date(FIRE.getTime() - 1), new Date(FIRE.getTime() + 1)];
    let reads = 0;
    const clock = () => readings[Math.min(reads++, readings.length - 1)];
    // When the RELEASE reads the pool, the close at the fire instant runs to commit.
    const run = w.db.runTransaction;
    let closedFirst = false;
    w.db.runTransaction = (fn) => run(async (tx) => fn({
      ...tx,
      get: async (ref) => {
        const snap = await tx.get(ref);
        if (!closedFirst && ref.path === POOL) {
          closedFirst = true;
          w.db.runTransaction = run;
          expect((await ensureClosed(w.db, GID, FIRE)).closed).toBe(true);
        }
        return snap;
      },
    }));
    try {
      await expect(releaseSlotSeat(w.db, GID, { odUserId: 'seat-a', now: new Date(FIRE.getTime() - 1), clock })).rejects.toThrow(`${SLOT_SENTINEL_PREFIX}draft_already_started`);
    } finally {
      w.db.runTransaction = run;
    }
    expect(closedFirst).toBe(true);
    expect(reads).toBe(2);
    // The seat the close froze is still in the pod; its backer's stake stands.
    expect(w.store.get(GROUP).groupMembers).toContain('seat-a');
    expect(w.store.get(POOL).teams.map((t) => t.odUserId)).toContain('seat-a');
    expect(stakeDoc(w, 'u1', 'seat-a').status).toBe(STAKE_STATUS.LIVE);
  });

  it('FLAG OFF: the release reads no pool — the production path unchanged', async () => {
    flags.backing = false;
    const w = makeInMemoryDb();
    await claimSlotSeat(w.db, { slotId: SLOT, odUserId: 'seat-a', now: NOW });
    await claimSlotSeat(w.db, { slotId: SLOT, odUserId: 'seat-b', now: NOW });
    const readsBefore = w.readLog.length;
    expect((await releaseSlotSeat(w.db, GID, { odUserId: 'seat-b', now: NOW })).released).toBe(true);
    expect(w.readLog.slice(readsBefore).filter(([, p]) => p.startsWith('backingPools'))).toEqual([]);
  });
});

describe('item C — a stake and a claim INTERLEAVED, both orders: after close no seated backer holds a live stake', () => {
  it('ORDER 1 — the stake commits first: the claim reads it and refuses', async () => {
    const w = slotDb();
    for (const seat of ['seat-a', 'seat-b', 'seat-c']) await claim(w, seat);
    for (const [uid, team] of [['u2', 'seat-b'], ['u3', 'seat-c'], ['u4', 'seat-a']]) await stake(w, uid, team);
    await stake(w, 'u1', 'seat-a');
    await expect(claim(w, 'u1')).rejects.toThrow(BACKED);
    await ensureClosed(w.db, GID, FIRE);
    expect(seatedBackerLiveStakes(w)).toEqual([]);
    expect(stakeDoc(w, 'u1', 'seat-a').status).toBe(STAKE_STATUS.LIVE);
  });

  it('ORDER 2 — the claim reads first (no stake yet), the stake commits inside its window, the claim commits: R4\'s belt voids the stake `backer_seated` at close', async () => {
    const w = slotDb();
    for (const seat of ['seat-a', 'seat-b', 'seat-c']) await claim(w, seat);
    for (const [uid, team] of [['u2', 'seat-b'], ['u3', 'seat-c'], ['u4', 'seat-a']]) await stake(w, uid, team);
    seedBacker(w.store, 'u1');
    // The claim transaction's stake read returns NOTHING; before it commits,
    // u1's stake runs to commit (its group read sees u1 unseated). A query's
    // read set is the documents it matched, so the claim then commits too —
    // the phantom the close belt exists for.
    const run = w.db.runTransaction;
    let interleaved = false;
    w.db.runTransaction = (fn) => run(async (tx) => fn({
      ...tx,
      get: async (ref) => {
        const snap = await tx.get(ref);
        if (!interleaved && !ref._isDoc && ref.path === BACKING_STAKES_COLLECTION && snap.empty) {
          interleaved = true;
          w.db.runTransaction = run;
          const out = await placeStake(w.db, stakeArgs('u1', 'seat-a'));
          expect(out.refusal).toBeUndefined();
        }
        return snap;
      },
    }));
    let joined;
    try {
      joined = await claim(w, 'u1');
    } finally {
      w.db.runTransaction = run;
    }
    expect(interleaved).toBe(true);
    expect(joined.joined).toBe(true);
    expect(stakeDoc(w, 'u1', 'seat-a').status).toBe(STAKE_STATUS.LIVE);   // both landed
    const closed = await ensureClosed(w.db, GID, FIRE);
    expect(closed.closed).toBe(true);
    expect(stakeDoc(w, 'u1', 'seat-a')).toMatchObject({ status: STAKE_STATUS.VOIDED, voidReason: VOID_REASONS.BACKER_SEATED });
    expect(seatedBackerLiveStakes(w)).toEqual([]);
  });

  it('ORDER 2b — the stake reads the group first, the claim commits: the stake re-runs and refuses own-pod', async () => {
    const w = slotDb();
    for (const seat of ['seat-a', 'seat-b']) await claim(w, seat);
    seedBacker(w.store, 'u1');
    // The STAKE transaction (first read: its stake document) is overtaken,
    // after its group read, by u1's claim committing.
    const run = w.db.runTransaction;
    let interleaved = false;
    w.db.runTransaction = (fn) => run(async (tx) => {
      let stakeTx = null;
      return fn({
        ...tx,
        get: async (ref) => {
          const snap = await tx.get(ref);
          if (stakeTx === null) stakeTx = ref.path.startsWith(`${BACKING_STAKES_COLLECTION}/`);
          if (stakeTx && !interleaved && ref.path === GROUP) {
            interleaved = true;
            w.db.runTransaction = run;
            expect((await claim(w, 'u1')).joined).toBe(true);
          }
          return snap;
        },
      });
    });
    let out;
    try {
      out = await placeStake(w.db, stakeArgs('u1', 'seat-a'));
    } finally {
      w.db.runTransaction = run;
    }
    expect(interleaved).toBe(true);
    expect(out.refusal).toMatchObject({ status: 403, error: 'own_pod' });
    expect(stakeDoc(w, 'u1', 'seat-a')).toBeUndefined();
    expect(w.stats.conflicts).toBeGreaterThanOrEqual(1);
  });
});
