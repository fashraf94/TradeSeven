// api/_utils/backingCloseReread.test.js
//
// Backing safety fix 1, item B — THE CLOSE READS MEMBERSHIP IN ITS OWN
// TRANSACTION (Astra's BKG-002; Amendment D R4, the founder's Oct 18, 2026
// ruling).
//
// THE DEFECT. `closePool` used to read the pool and the stakes inside its
// transaction but freeze the seats from the CALLER's group object, read
// earlier by `ensureClosed`. Astra's probe P11: a seat released after that
// read and before the close committed was frozen as still seated — its
// backer's stake counted as a LOSS and paid to the other backers, when it
// should have been voided and refunded. These rows drive the REAL slot
// claim / release writers (liveDraftFormation.js) on the shared versioned
// harness (`slotWriters: true`), and the real stake, close and settlement.
//
// THE ROWS (the build prompt's §3 B):
//   1. P11 — a release commits between the caller's read and the close: the
//      departed seat's stake is voided `seat_left` and refunded, the pool goes
//      `insufficient` with one backed team left, and nobody is paid from it;
//   2. a transaction RETRY when the group changes mid-close;
//   3. the group DELETED between the caller's read and the close;
//   4. the group RECREATED between them (slot ids are deterministic) — both the
//      same seats re-claimed and different seats;
//   5. a backer SEATED at close: their stakes voided `backer_seated` (R4).
// MUTATION (the build's): decide from the caller's object again → row 1 fails.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real imports below are the
// guard — never mock them.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeVersionedDb } from './__fixtures__/versionedFirestore.js';
import { placeStake, stakeIdFor } from './backingStake.js';
import { POOL_STATUS, STAKE_STATUS, VOID_REASONS, closePool, ensureClosed, readGroup } from './backingPools.js';
import { SETTLEMENT_REASON, SETTLEMENT_SOURCE, settlePool } from './backingSettlement.js';
import { claimSlotSeat, releaseSlotSeat, slotGroupId } from './liveDraftFormation.js';
import { ALLOWANCE_BP, MIN_STAKE_BP } from '../../src/constants/backing.js';
import { TERMS_VERSION } from '../../src/constants/eligibility.js';

const NOW = new Date('2026-09-22T14:00:00.000Z');        // Tue — the window is open
const FIRE = new Date('2026-09-27T23:00:00.000Z');       // Sun 19:00 EDT — sun-1900's fire, the pool's close
const END = new Date('2026-10-02T22:30:00.000Z');
const SLOT = 'sun-1900';
const GID = slotGroupId(SLOT, '2026-09-27');
const GROUP = `tournamentGroups/${GID}`;
const POOL = `backingPools/${GID}`;

const auth = (uid) => ({ uid, firebase: { sign_in_provider: 'password' } });
function seedBacker(store, uid) {
  store.set(`eligibility/${uid}`, { termsVersion: TERMS_VERSION, adultAttestedAt: NOW.toISOString(), acceptedAt: NOW.toISOString() });
  store.set(`agentBattles/done-${uid}`, { ownerId: uid, status: 'completed', completedAt: '2026-09-10T20:00:00.000Z' });
}
const slotDb = (initial = {}, opts = {}) => makeVersionedDb(initial, { slotWriters: true, ...opts });
const claim = (w, uid, now = NOW) => claimSlotSeat(w.db, { slotId: SLOT, odUserId: uid, now });
const release = (w, uid, now = new Date(FIRE.getTime() - 1)) => releaseSlotSeat(w.db, GID, { odUserId: uid, now });
async function stake(w, uid, team) {
  seedBacker(w.store, uid);
  const out = await placeStake(w.db, { uid, decodedToken: auth(uid), groupId: GID, teamOdUserId: team, amount: MIN_STAKE_BP, requestId: `${uid}-${team}`, now: NOW });
  expect(out.refusal, `${uid} → ${team}: ${JSON.stringify(out.refusal)}`).toBeUndefined();
  return out;
}
const stakeDoc = (w, uid, team) => w.store.get(`backingStakes/${stakeIdFor(uid, GID, team)}`);
const wallet = (w, uid) => w.store.get(`backingWallets/${uid}`);
const groupWith = (w, seats) => ({ ...w.store.get(GROUP), groupMembers: seats, players: seats.map((odUserId) => ({ odUserId, picks: [] })) });

/** The pod's final banked week (for the settlement leg of row 1). */
function finalGroup(g) {
  const closeScores = Object.fromEntries(g.groupMembers.map((id, i) => [id, { totalPoints: 10, agentPoints: 10, compositePoints: 100 - i * 10 }]));
  const dates = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
  return { ...g, status: 'complete', dailyScores: Object.fromEntries(dates.map((recordedDate, i) => [`day${i + 1}`, { recordedDate, closeScores }])) };
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe('item B — the close decides from its OWN read of the group', () => {
  it('ROW 1 (Astra P11): a release between the caller\'s read and the close voids the departed seat\'s stake and refunds it; the pool goes insufficient; nobody is paid', async () => {
    const w = slotDb();
    for (const seat of ['seat-a', 'seat-b', 'seat-c']) await claim(w, seat);
    await stake(w, 'u1', 'seat-a');
    await stake(w, 'u2', 'seat-b');
    await stake(w, 'u3', 'seat-b');
    // The CALLER's read — what `ensureClosed` hands the close.
    const stale = await readGroup(w.db, GID);
    // …and the REAL release writer commits after it.
    expect((await release(w, 'seat-a')).released).toBe(true);
    const closed = await closePool(w.db, stale, FIRE);

    expect(closed).toMatchObject({ closed: true, status: POOL_STATUS.INSUFFICIENT, voided: 3 });
    expect(w.store.get(POOL).teams.map((t) => t.odUserId)).toEqual(['seat-b', 'seat-c']);
    expect(stakeDoc(w, 'u1', 'seat-a')).toMatchObject({ status: STAKE_STATUS.VOIDED, voidReason: VOID_REASONS.SEAT_LEFT });
    for (const uid of ['u2', 'u3']) expect(stakeDoc(w, uid, 'seat-b')).toMatchObject({ status: STAKE_STATUS.VOIDED, voidReason: VOID_REASONS.INSUFFICIENT });
    // Refunded to the record — score-neutral — and nobody holds a payout.
    for (const uid of ['u1', 'u2', 'u3']) {
      expect(wallet(w, uid).careerNet).toBe(0);
      expect(wallet(w, uid).allowanceRemaining).toBe(ALLOWANCE_BP - MIN_STAKE_BP); // the week's allowance is not restored
    }
    const anyPayout = [...w.store.entries()].some(([p, d]) => p.includes('/entries/payout:') || d?.status === STAKE_STATUS.WON);
    expect(anyPayout).toBe(false);
    // The settlement has nothing to pay from: the pool is terminal.
    w.store.set(GROUP, finalGroup({ id: GID, ...w.store.get(GROUP) }));
    vi.setSystemTime(END);
    const settled = await settlePool(w.db, GID, { now: END, source: SETTLEMENT_SOURCE.ADMIN });
    expect(settled).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.TERMINAL });
  });

  it('ROW 2: a transaction RETRY when the group changes mid-close re-reads the group — the re-run decides on the new membership', async () => {
    const build = slotDb();
    for (const seat of ['seat-a', 'seat-b', 'seat-c']) await claim(build, seat);
    for (const [uid, team] of [['u1', 'seat-a'], ['u2', 'seat-b'], ['u3', 'seat-c'], ['u4', 'seat-a']]) await stake(build, uid, team);
    // A fresh db over the same store, whose FIRST close attempt is overtaken by
    // a seat-a release landing between its read and its commit.
    let landed = false;
    const w = slotDb(Object.fromEntries(build.store), {
      beforeCommit: ({ attempt, commitWrites }) => {
        if (attempt !== 1 || landed) return;
        landed = true;
        commitWrites([[GROUP, groupWith(build, ['seat-b', 'seat-c'])]]);
      },
    });
    const closed = await closePool(w.db, { id: GID, ...build.store.get(GROUP) }, FIRE);
    expect(landed).toBe(true);
    expect(w.stats.conflicts).toBeGreaterThanOrEqual(1);
    // The re-run saw seat-a gone: its two stakes are seat-left voids, and the
    // two survivors on two teams are short of three backers.
    expect(closed).toMatchObject({ closed: true, status: POOL_STATUS.INSUFFICIENT });
    for (const uid of ['u1', 'u4']) expect(stakeDoc(w, uid, 'seat-a')).toMatchObject({ voidReason: VOID_REASONS.SEAT_LEFT });
    expect(w.store.get(POOL).teams.map((t) => t.odUserId)).toEqual(['seat-b', 'seat-c']);
  });

  it('ROW 3: the group DELETED between the caller\'s read and the close — the deleted path, every stake `group_deleted`', async () => {
    const w = slotDb();
    for (const seat of ['seat-a', 'seat-b', 'seat-c']) await claim(w, seat);
    for (const [uid, team] of [['u1', 'seat-a'], ['u2', 'seat-b'], ['u3', 'seat-c']]) await stake(w, uid, team);
    const stale = await readGroup(w.db, GID);
    // The last three humans leave — the real writer deletes the doc.
    for (const seat of ['seat-a', 'seat-b', 'seat-c']) await release(w, seat);
    expect(w.store.has(GROUP)).toBe(false);
    const closed = await closePool(w.db, stale, FIRE);
    expect(closed).toMatchObject({ closed: true, status: POOL_STATUS.REFUNDED, voided: 3 });
    for (const [uid, team] of [['u1', 'seat-a'], ['u2', 'seat-b'], ['u3', 'seat-c']]) {
      expect(stakeDoc(w, uid, team)).toMatchObject({ status: STAKE_STATUS.VOIDED, voidReason: VOID_REASONS.GROUP_DELETED });
      expect(wallet(w, uid).careerNet).toBe(0);
    }
    expect(w.store.get(POOL).teams).toEqual([]);
  });

  describe('ROW 4: the group RECREATED between the caller\'s read and the close (a slot id is deterministic)', () => {
    async function deletedWithStakes() {
      const w = slotDb();
      for (const seat of ['seat-a', 'seat-b', 'seat-c']) await claim(w, seat);
      for (const [uid, team] of [['u1', 'seat-a'], ['u2', 'seat-b'], ['u3', 'seat-a'], ['u4', 'seat-c']]) await stake(w, uid, team);
      for (const seat of ['seat-a', 'seat-b', 'seat-c']) await release(w, seat, NOW);
      expect(w.store.has(GROUP)).toBe(false);
      // What `ensureClosed` builds when its read finds the doc gone.
      return { w, tombstone: { id: GID, isDev: false, missing: true } };
    }

    it('a tombstone handed in, a live pod found, the window still OPEN → NOT closed, nothing written', async () => {
      const { w, tombstone } = await deletedWithStakes();
      await claim(w, 'seat-a');
      const before = w.writeLog.length;
      const out = await closePool(w.db, tombstone, NOW);
      expect(out).toMatchObject({ closed: false, reason: 'still_open' });
      expect(w.writeLog.length).toBe(before);
      expect(w.store.get(POOL).status).toBe(POOL_STATUS.OPEN);
      // …and `ensureClosed` itself, on the recreated pod, leaves it open too.
      expect((await ensureClosed(w.db, GID, NOW)).reason).toBe('still_open');
    });

    it('SAME seats re-claimed: at the close the live pod decides — stakes on re-seated teams survive, the rest are seat-left', async () => {
      const { w, tombstone } = await deletedWithStakes();
      await claim(w, 'seat-a');
      await claim(w, 'seat-b');
      const out = await closePool(w.db, tombstone, FIRE);
      expect(out).toMatchObject({ closed: true, status: POOL_STATUS.CLOSED, voided: 1 });
      expect(stakeDoc(w, 'u4', 'seat-c')).toMatchObject({ voidReason: VOID_REASONS.SEAT_LEFT });
      for (const [uid, team] of [['u1', 'seat-a'], ['u2', 'seat-b'], ['u3', 'seat-a']]) expect(stakeDoc(w, uid, team).status).toBe(STAKE_STATUS.LIVE);
      expect(w.store.get(POOL).teams.map((t) => t.odUserId)).toEqual(['seat-a', 'seat-b']);
    });

    it('DIFFERENT seats: every old stake is on a seat that is not in the pod — seat-left, refunded, and the pool is insufficient', async () => {
      const { w, tombstone } = await deletedWithStakes();
      await claim(w, 'seat-x');
      await claim(w, 'seat-y');
      const out = await closePool(w.db, tombstone, FIRE);
      expect(out).toMatchObject({ closed: true, status: POOL_STATUS.INSUFFICIENT, voided: 4 });
      for (const [uid, team] of [['u1', 'seat-a'], ['u2', 'seat-b'], ['u3', 'seat-a'], ['u4', 'seat-c']]) {
        expect(stakeDoc(w, uid, team)).toMatchObject({ status: STAKE_STATUS.VOIDED, voidReason: VOID_REASONS.SEAT_LEFT });
        expect(wallet(w, uid).careerNet).toBe(0);
      }
    });
  });

  it('ROW 5 (R4): a backer SEATED at close has their stakes voided `backer_seated` — refunded to the record, the allowance not restored', async () => {
    const w = slotDb();
    for (const seat of ['seat-a', 'seat-b', 'seat-c']) await claim(w, seat);
    for (const [uid, team] of [['joiner', 'seat-a'], ['u2', 'seat-b'], ['u3', 'seat-c'], ['u4', 'seat-a']]) await stake(w, uid, team);
    // BACKING_BETA_ENABLED is false here, so the claim-side refusal (R3) does
    // not run — Astra's P9 shape: the backer takes the empty fourth seat.
    expect((await claim(w, 'joiner')).joined).toBe(true);
    const closed = await ensureClosed(w.db, GID, FIRE);
    expect(closed).toMatchObject({ closed: true, status: POOL_STATUS.CLOSED, voided: 1 });
    expect(stakeDoc(w, 'joiner', 'seat-a')).toMatchObject({ status: STAKE_STATUS.VOIDED, voidReason: VOID_REASONS.BACKER_SEATED });
    expect(wallet(w, 'joiner').careerNet).toBe(0);
    expect(wallet(w, 'joiner').allowanceRemaining).toBe(ALLOWANCE_BP - MIN_STAKE_BP);
    // The seated backer is out of the book: three backers on three teams remain.
    const totals = w.store.get(`${POOL}/private/totals`);
    expect(Object.keys(totals.backers).sort()).toEqual(['u2', 'u3', 'u4']);
    expect(w.store.get(POOL).teams.map((t) => t.odUserId)).toEqual(['seat-a', 'seat-b', 'seat-c', 'joiner']);
  });

  it('R4 precedence: a seated backer whose BACKED TEAM left is `seat_left` — step 2\'s own reason wins', async () => {
    const w = slotDb();
    for (const seat of ['seat-a', 'seat-b', 'seat-c']) await claim(w, seat);
    for (const [uid, team] of [['joiner', 'seat-a'], ['u2', 'seat-b'], ['u3', 'seat-c'], ['u4', 'seat-b']]) await stake(w, uid, team);
    await release(w, 'seat-a', NOW);
    await claim(w, 'joiner');
    await ensureClosed(w.db, GID, FIRE);
    expect(stakeDoc(w, 'joiner', 'seat-a')).toMatchObject({ voidReason: VOID_REASONS.SEAT_LEFT });
  });

  it('MON-1 / CON-2 (the review): a stake that commits BETWEEN the close\'s reads and its commit is in the closed book — the close reads the sealed totals, so the two serialize', async () => {
    const w = slotDb();
    for (const seat of ['seat-a', 'seat-b']) await claim(w, seat);
    // Above both floors — from here a stake writes NO pool document.
    for (const [uid, team] of [['u1', 'seat-a'], ['u2', 'seat-b'], ['u3', 'seat-a'], ['u4', 'seat-b']]) await stake(w, uid, team);
    seedBacker(w.store, 'u5');
    const poolWritesBefore = w.writeLog.filter(([, p]) => p === POOL).length;
    // When the CLOSE's live-stakes query returns, u5's whole stake runs to
    // commit (its clock just inside the window); then the close commits.
    const run = w.db.runTransaction;
    let landed = false;
    w.db.runTransaction = (fn) => run(async (tx) => fn({
      ...tx,
      get: async (ref) => {
        const snap = await tx.get(ref);
        if (!landed && !ref._isDoc && ref.path === 'backingStakes' && snap.size === 4) {
          landed = true;
          w.db.runTransaction = run;
          const out = await placeStake(w.db, { uid: 'u5', decodedToken: auth('u5'), groupId: GID, teamOdUserId: 'seat-a', amount: 200, requestId: 'u5-late', now: NOW, clock: () => new Date(FIRE.getTime() - 1) });
          expect(out.refusal).toBeUndefined();
        }
        return snap;
      },
    }));
    let closed;
    try {
      closed = await closePool(w.db, { id: GID, ...w.store.get(GROUP) }, FIRE);
    } finally {
      w.db.runTransaction = run;
    }
    expect(landed).toBe(true);
    // u5's stake wrote no pool document (above the floors) — only the totals tie them.
    expect(w.writeLog.filter(([, p]) => p === POOL).length).toBe(poolWritesBefore + 1); // the close's own write
    expect(closed).toMatchObject({ closed: true, status: POOL_STATUS.CLOSED });
    expect(stakeDoc(w, 'u5', 'seat-a').status).toBe(STAKE_STATUS.LIVE);
    const totals = w.store.get(`${POOL}/private/totals`);
    expect(Object.keys(totals.backers).sort()).toEqual(['u1', 'u2', 'u3', 'u4', 'u5']);
    expect(totals.potTotal).toBe(4 * MIN_STAKE_BP + 200);
    expect(w.store.get(POOL).potTotal).toBe(4 * MIN_STAKE_BP + 200);
  });

  it('MON-5 (the review): the settlement\'s deleted-pod branch answers `refunded` only for a REFUNDED close — a pod that came back is not mislabelled', async () => {
    const w = slotDb();
    for (const seat of ['seat-a', 'seat-b', 'seat-c']) await claim(w, seat);
    for (const [uid, team] of [['u1', 'seat-a'], ['u2', 'seat-b'], ['u3', 'seat-c']]) await stake(w, uid, team);
    // The settlement's cheap read misses the group (a race with a re-claim);
    // the close's own read then finds the live pod and closes it as such.
    const realCollection = w.db.collection;
    let hidden = true;
    w.db.collection = (name) => {
      const col = realCollection(name);
      if (name !== 'tournamentGroups') return col;
      return {
        ...col,
        doc: (id) => {
          const ref = col.doc(id);
          if (id !== GID) return ref;
          return { ...ref, get: async () => { if (hidden) { hidden = false; return { exists: false, id, data: () => undefined }; } return ref.get(); } };
        },
      };
    };
    vi.setSystemTime(END);
    let out;
    try {
      out = await settlePool(w.db, GID, { now: END, source: SETTLEMENT_SOURCE.ADMIN });
    } finally {
      w.db.collection = realCollection;
    }
    expect(w.store.get(POOL).status).toBe(POOL_STATUS.CLOSED);
    expect(out.refunded).not.toBe(true);
    expect(out).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.NOT_FINAL });
  });

  it('CON-1b (the review): a resend of a COMMITTED request whose pod is deleted and re-claimed mid-request is answered as its replay — never `no_pod`, never a second debit', async () => {
    const w = slotDb();
    await claim(w, 'seat-a');
    await stake(w, 'u1', 'seat-a');                 // committed: request `u1-seat-a`
    await release(w, 'seat-a', NOW);                // the last human leaves — the doc is deleted, the pool stays open
    expect(w.store.has(GROUP)).toBe(false);
    // The resend's first group read finds nothing; right after it, the pod is re-claimed.
    const realCollection = w.db.collection;
    let recreated = false;
    w.db.collection = (name) => {
      const col = realCollection(name);
      if (name !== 'tournamentGroups') return col;
      return {
        ...col,
        doc: (id) => {
          const ref = col.doc(id);
          if (id !== GID) return ref;
          return {
            ...ref,
            get: async () => {
              const snap = await ref.get();
              if (!recreated && !snap.exists) {
                recreated = true;
                w.db.collection = realCollection;
                await claim(w, 'seat-a');
              }
              return snap;
            },
          };
        },
      };
    };
    let out;
    try {
      out = await placeStake(w.db, { uid: 'u1', decodedToken: auth('u1'), groupId: GID, teamOdUserId: 'seat-a', amount: MIN_STAKE_BP, requestId: 'u1-seat-a', now: NOW });
    } finally {
      w.db.collection = realCollection;
    }
    expect(recreated).toBe(true);
    expect(out.refusal).toBeUndefined();
    expect(out.replay).toBe(true);
    expect(stakeDoc(w, 'u1', 'seat-a')).toMatchObject({ status: STAKE_STATUS.LIVE, amount: MIN_STAKE_BP });
    expect(wallet(w, 'u1').allowanceRemaining).toBe(ALLOWANCE_BP - MIN_STAKE_BP);
  });

  it('a live group that routes to ANOTHER pool namespace than the pointer named is refused — nothing written', async () => {
    const w = slotDb();
    await claim(w, 'seat-a');
    await stake(w, 'u1', 'seat-a');
    w.store.set(GROUP, { ...w.store.get(GROUP), isDev: true });
    const before = w.writeLog.length;
    const out = await closePool(w.db, { id: GID, isDev: false, missing: true }, FIRE);
    expect(out).toMatchObject({ closed: false, reason: 'namespace_mismatch' });
    expect(w.writeLog.length).toBe(before);
  });
});
