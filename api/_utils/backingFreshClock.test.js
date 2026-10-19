// api/_utils/backingFreshClock.test.js
//
// Backing safety fix 1, item D — A FRESH CLOCK ON EVERY ATTEMPT (Astra's
// BKG-006; Amendment D R5, the founder's Oct 18, 2026 ruling): every
// transaction attempt that admits a stake, claims a slot seat or releases one
// reads the clock itself, and refuses at or after the pool's close or the
// slot's fire instant. A replay of an already-committed stake still answers
// its original success after close — the replay probe stays first.
//
// THE ROWS (the build prompt's §3 D):
//   · P6 — a stake entering at 23:59:58.900 ET on the Sunday close, whose body
//     runs after Monday 00:00 ET → refused, nothing written (MUTATION: use the
//     entry time again → this row fails);
//   · a replay after close still succeeds;
//   · a slot claim and a slot release that cross the fire instant → refused;
//   · the clock is read per ATTEMPT: a retry that runs past the instant refuses.
//
// The real Date is faked (`placeStake`'s default clock is `new Date()`); the
// slot writers take an explicit `clock`, the routes' production default being
// the real clock read inside the transaction.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real imports below are the
// guard — never mock them.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeVersionedDb } from './__fixtures__/versionedFirestore.js';
import { placeStake, stakeIdFor } from './backingStake.js';
import { POOL_STATUS, STAKE_STATUS } from './backingPools.js';
import { SLOT_SENTINEL_PREFIX, claimSlotSeat, releaseSlotSeat, slotGroupId } from './liveDraftFormation.js';
import { ALLOWANCE_BP, MIN_STAKE_BP } from '../../src/constants/backing.js';
import { TERMS_VERSION } from '../../src/constants/eligibility.js';

const NOW = new Date('2026-09-22T14:00:00.000Z');
const GID = 'clock-pod';
const POOL = `backingPools/${GID}`;
const SEATS = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
// The lobby pool closes Sunday 23:59:59 ET (EDT): 2026-09-28T03:59:59Z.
const CLOSES_AT = '2026-09-28T03:59:59.000Z';
const ENTRY = new Date('2026-09-28T03:59:58.900Z');   // Sun 23:59:58.900 ET
const PAST_MIDNIGHT = new Date('2026-09-28T04:00:02.000Z'); // Mon 00:00:02 ET
const STARTED = `${SLOT_SENTINEL_PREFIX}draft_already_started`;

const group = () => ({
  status: 'forming', isLiveDraft: false, baseLayerWeek: '2026-W40', createdAt: NOW.toISOString(),
  groupMembers: SEATS, players: SEATS.map((odUserId) => ({ odUserId, picks: [] })),
});
const auth = (uid) => ({ uid, firebase: { sign_in_provider: 'password' } });
function seedBacker(store, uid) {
  store.set(`eligibility/${uid}`, { termsVersion: TERMS_VERSION, adultAttestedAt: NOW.toISOString(), acceptedAt: NOW.toISOString() });
  store.set(`agentBattles/done-${uid}`, { ownerId: uid, status: 'completed', completedAt: '2026-09-10T20:00:00.000Z' });
}
const args = (uid, team, over = {}) => ({ uid, decodedToken: auth(uid), groupId: GID, teamOdUserId: team, amount: MIN_STAKE_BP, requestId: `${uid}-${team}`, now: NOW, ...over });

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

/** A pool opened and qualified (3 backers, 2 teams) well inside its window. */
async function openPool() {
  const w = makeVersionedDb({ [`tournamentGroups/${GID}`]: group() });
  for (const [uid, team] of [['b1', 'seat-a'], ['b2', 'seat-b'], ['b3', 'seat-a']]) {
    seedBacker(w.store, uid);
    expect((await placeStake(w.db, args(uid, team))).refusal).toBeUndefined();
  }
  expect(w.store.get(POOL).closesAt).toBe(CLOSES_AT);
  return w;
}

describe('item D — the stake window is read on the attempt, not on entry (R5)', () => {
  it('P6: entered at 23:59:58.900 ET, the body runs after Monday 00:00 ET → `pool_closed`, nothing written', async () => {
    const w = await openPool();
    seedBacker(w.store, 'late');
    vi.setSystemTime(ENTRY);
    // The clock moves past midnight before the body runs (Astra's shape: the
    // request was admitted at entry; its transaction executes later).
    const run = w.db.runTransaction;
    w.db.runTransaction = async (fn) => { vi.setSystemTime(PAST_MIDNIGHT); return run(fn); };
    const before = structuredClone(Object.fromEntries(w.store));
    const logBefore = w.writeLog.length;
    let out;
    try {
      out = await placeStake(w.db, args('late', 'seat-c', { now: ENTRY }));
    } finally {
      w.db.runTransaction = run;
    }
    expect(out.refusal).toMatchObject({ status: 409, error: 'pool_closed' });
    expect(w.writeLog.length).toBe(logBefore);
    expect(Object.fromEntries(w.store)).toEqual(before);
    expect(w.store.has(`backingStakes/${stakeIdFor('late', GID, 'seat-c')}`)).toBe(false);
    expect(w.store.has('backingWallets/late')).toBe(false);
  });

  it('the CONTROL: the same entry, a body that runs before midnight → admitted', async () => {
    const w = await openPool();
    seedBacker(w.store, 'late');
    vi.setSystemTime(ENTRY);
    const out = await placeStake(w.db, args('late', 'seat-c', { now: ENTRY }));
    expect(out.refusal).toBeUndefined();
    expect(out.stake.status).toBe(STAKE_STATUS.LIVE);
  });

  it('an injected clock is read on EVERY attempt — a retry that runs past the close refuses', async () => {
    const built = await openPool();
    seedBacker(built.store, 'late');
    // Attempt 1 reads a clock 0.5 s inside the window, then loses a race on the
    // pool document (a competing write lands between its reads and its
    // commit); attempt 2 reads the clock again — past the close.
    const readings = [new Date(Date.parse(CLOSES_AT) - 500), PAST_MIDNIGHT];
    let calls = 0;
    let moved = false;
    const clock = () => readings[Math.min(calls++, readings.length - 1)];
    const w = makeVersionedDb(Object.fromEntries(built.store), {
      // Only the stake transaction reads the clock, so `calls === 1` is its
      // first attempt (the lazy jobs' transactions read none).
      beforeCommit: ({ store, commitWrites }) => {
        if (calls === 1 && !moved) { moved = true; commitWrites([[POOL, { ...store.get(POOL) }]]); }
      },
    });
    const out = await placeStake(w.db, args('late', 'seat-c', { now: ENTRY, clock }));
    expect(moved).toBe(true);
    expect(calls).toBe(2);
    expect(out.refusal).toMatchObject({ status: 409, error: 'pool_closed' });
    expect(w.store.has(`backingStakes/${stakeIdFor('late', GID, 'seat-c')}`)).toBe(false);
    expect(w.store.has('backingWallets/late')).toBe(false);
  });

  it('a REPLAY of a committed request still answers its original success after close — the replay probe stays first', async () => {
    const w = await openPool();
    seedBacker(w.store, 'early');
    const first = await placeStake(w.db, args('early', 'seat-b', { requestId: 'r-early' }));
    expect(first.refusal).toBeUndefined();
    // Past the close: the request's own lazy close closes the pool, and the
    // replay is still answered from the document it funded.
    vi.setSystemTime(PAST_MIDNIGHT);
    const stakeWritesBefore = w.writeLog.filter(([, p]) => p.startsWith('backingStakes/')).length;
    const replay = await placeStake(w.db, args('early', 'seat-b', { requestId: 'r-early', now: PAST_MIDNIGHT }));
    expect(replay.refusal).toBeUndefined();
    expect(replay.replay).toBe(true);
    expect(replay.stake.amount).toBe(MIN_STAKE_BP);
    expect(w.store.get(POOL).status).toBe(POOL_STATUS.CLOSED);
    expect(w.writeLog.filter(([, p]) => p.startsWith('backingStakes/')).length).toBe(stakeWritesBefore);
    expect(w.store.get('backingWallets/early').allowanceRemaining).toBe(ALLOWANCE_BP - MIN_STAKE_BP);
    // …while a NEW request after close is refused.
    const fresh = await placeStake(w.db, args('early', 'seat-b', { requestId: 'r-new', now: PAST_MIDNIGHT }));
    expect(fresh.refusal?.error).toBe('pool_closed');
  });
});

describe('item D — the slot writers read the fire instant on the attempt (R5)', () => {
  const SLOT = 'sun-1900';
  const SLOT_GID = slotGroupId(SLOT, '2026-09-27');
  const FIRE = new Date('2026-09-27T23:00:00.000Z');
  const justBefore = new Date(FIRE.getTime() - 1000);
  const slotDb = () => makeVersionedDb({}, { slotWriters: true });

  it('a JOIN that entered before the fire and executes at/after it → `draft_already_started`, nothing written', async () => {
    const w = slotDb();
    await claimSlotSeat(w.db, { slotId: SLOT, odUserId: 'seat-a', now: NOW });
    const before = structuredClone(w.store.get(`tournamentGroups/${SLOT_GID}`));
    await expect(claimSlotSeat(w.db, { slotId: SLOT, odUserId: 'late', now: justBefore, clock: () => FIRE })).rejects.toThrow(STARTED);
    expect(w.store.get(`tournamentGroups/${SLOT_GID}`)).toEqual(before);
    // Control: the same entry executing before the fire joins.
    expect((await claimSlotSeat(w.db, { slotId: SLOT, odUserId: 'late', now: justBefore, clock: () => justBefore })).joined).toBe(true);
  });

  it('a CREATE that entered before the fire and executes after it → refused; no pod is created for a slot that has fired', async () => {
    const w = slotDb();
    await expect(claimSlotSeat(w.db, { slotId: SLOT, odUserId: 'first', now: justBefore, clock: () => new Date(FIRE.getTime() + 1) })).rejects.toThrow(STARTED);
    expect(w.store.has(`tournamentGroups/${SLOT_GID}`)).toBe(false);
  });

  it('a RELEASE that entered before the fire and executes at/after it → refused; the seat stays', async () => {
    const w = slotDb();
    await claimSlotSeat(w.db, { slotId: SLOT, odUserId: 'seat-a', now: NOW });
    await claimSlotSeat(w.db, { slotId: SLOT, odUserId: 'seat-b', now: NOW });
    await expect(releaseSlotSeat(w.db, SLOT_GID, { odUserId: 'seat-b', now: justBefore, clock: () => FIRE })).rejects.toThrow(STARTED);
    expect(w.store.get(`tournamentGroups/${SLOT_GID}`).groupMembers).toEqual(['seat-a', 'seat-b']);
    // Control.
    expect((await releaseSlotSeat(w.db, SLOT_GID, { odUserId: 'seat-b', now: justBefore, clock: () => justBefore })).released).toBe(true);
  });

  it('the slot clock is read on EVERY attempt: a join whose first attempt loses a race, and whose retry runs past the fire, is refused', async () => {
    let attempts = 0;
    const w = makeVersionedDb({}, {
      slotWriters: true,
      beforeCommit: ({ attempt, store, commitWrites }) => {
        const path = `tournamentGroups/${SLOT_GID}`;
        // On the join's first attempt, another claimant's join lands first.
        if (attempt === 1 && attempts === 1 && store.has(path)) {
          const g = store.get(path);
          commitWrites([[path, { ...g, groupMembers: [...g.groupMembers, 'racer'], players: [...g.players, { odUserId: 'racer', picks: [] }] }]]);
        }
      },
    });
    await claimSlotSeat(w.db, { slotId: SLOT, odUserId: 'seat-a', now: NOW });
    const clock = () => { attempts += 1; return attempts === 1 ? justBefore : FIRE; };
    await expect(claimSlotSeat(w.db, { slotId: SLOT, odUserId: 'late', now: justBefore, clock })).rejects.toThrow(STARTED);
    expect(attempts).toBe(2);
    expect(w.store.get(`tournamentGroups/${SLOT_GID}`).groupMembers).toEqual(['seat-a', 'racer']);
  });

  it('the routes pass no `now` — the default reads the real clock inside the transaction', async () => {
    const w = slotDb();
    vi.setSystemTime(NOW);
    await claimSlotSeat(w.db, { slotId: SLOT, odUserId: 'seat-a' });
    // Entry resolves the occurrence at NOW; the system clock reaches the fire
    // before the transaction body runs.
    const run = w.db.runTransaction;
    w.db.runTransaction = async (fn) => { vi.setSystemTime(FIRE); return run(fn); };
    try {
      await expect(releaseSlotSeat(w.db, SLOT_GID, { odUserId: 'seat-a' })).rejects.toThrow(STARTED);
    } finally {
      w.db.runTransaction = run;
    }
  });
});

describe('item D — the production callers leave the slot clock unpinned (DARK-4, the review)', () => {
  // `slotClockFor` pins the in-transaction clock to a caller's `now` (the
  // suites' fixed instants). R5 therefore rests on the production callers
  // passing NEITHER `now` nor a clock — asserted on their source, every call.
  it('slot-claim.js and slot-release.js call the writers without `now`', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const read = (rel) => readFileSync(path.resolve(here, '..', rel), 'utf8').replace(/\r\n/g, '\n');
    const claimCalls = read('tournament/slot-claim.js').match(/claimSlotSeat\(db,[^)]*\)/g) ?? [];
    const releaseCalls = read('tournament/slot-release.js').match(/releaseSlotSeat\(db,[^)]*\)/g) ?? [];
    expect(claimCalls).toHaveLength(1);
    expect(releaseCalls).toHaveLength(1);
    for (const call of [...claimCalls, ...releaseCalls]) {
      expect(call, call).not.toMatch(/\bnow\b/);
      expect(call, call).not.toMatch(/\bclock\b/);
    }
  });
});
