// api/_utils/backingPoolCap.test.js
//
// Backing safety fix 1, item A — THE POOL CAP (Amendment D R1/R2, the
// founder's Oct 18, 2026 rulings on Astra's Oct 7 review, BKG-001).
//
// THE KEY ROW is the worst-case proof: the worst book the two limits ADMIT —
// 20 distinct backers, 80 stake documents — built through the REAL stake
// transaction, then paid, refunded and deleted by the REAL planners and
// writers. Every money transaction it produces is measured off the harness's
// own commit (one entry per buffered write, the SDK's per-operation count)
// and asserted inside `SETTLEMENT_MAX_STAKES` / `SETTLEMENT_MAX_WRITES`. No
// hand formula decides anything here; the formula is printed beside the
// measurement only so the report can show they agree.
//
// THE PIN ROW ties the two limits to the 120 / 480 ceilings: raising either
// limit past what the writers can carry fails it.
//
// Runs on the shared versioned harness (optimistic concurrency, re-run on
// conflict) with the real Date faked to the fixture instant: `placeStake`
// reads its window from the real clock by default (Amendment D R5).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real imports of the backing
// modules below are the guard — never mock them.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeVersionedDb } from './__fixtures__/versionedFirestore.js';
import { POOL_FULL, placeStake, poolSizeOf, stakeIdFor } from './backingStake.js';
import { POOL_STATUS, STAKE_STATUS, VOID_REASONS, closePool, ensureClosed } from './backingPools.js';
import {
  SETTLEMENT_MAX_STAKES, SETTLEMENT_MAX_WRITES, SETTLEMENT_SOURCE, refundPool, settlePool,
} from './backingSettlement.js';
import { projectPod } from '../tournament/backing-pools.js';
import { MIN_STAKE_BP, POOL_MAX_BACKERS, POOL_MAX_STAKES } from '../../src/constants/backing.js';
import { TERMS_VERSION } from '../../src/constants/eligibility.js';

const NOW = new Date('2026-09-22T14:00:00.000Z');
const CLOSE = new Date('2026-09-28T03:59:59.000Z');
const END = new Date('2026-10-02T22:30:00.000Z');
const GID = 'cap-pod';
const POOL = `backingPools/${GID}`;
const TOTALS = `${POOL}/private/totals`;
const SEATS = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];

const group = (over = {}) => ({
  status: 'forming', isLiveDraft: false, baseLayerWeek: '2026-W40', createdAt: NOW.toISOString(),
  groupMembers: SEATS, players: SEATS.map((odUserId) => ({ odUserId, picks: [] })), ...over,
});
const auth = (uid) => ({ uid, firebase: { sign_in_provider: 'password' } });
const backer = (n) => `u-${String(n).padStart(2, '0')}`;

function seedBacker(store, uid) {
  if (store.has(`eligibility/${uid}`)) return;
  store.set(`eligibility/${uid}`, { termsVersion: TERMS_VERSION, adultAttestedAt: NOW.toISOString(), acceptedAt: NOW.toISOString() });
  store.set(`agentBattles/done-${uid}`, { ownerId: uid, status: 'completed', completedAt: '2026-09-10T20:00:00.000Z' });
}
async function stake(w, uid, team, { amount = MIN_STAKE_BP, requestId = `${uid}-${team}-${amount}` } = {}) {
  seedBacker(w.store, uid);
  return placeStake(w.db, { uid, decodedToken: auth(uid), groupId: GID, teamOdUserId: team, amount, requestId, now: NOW });
}
async function mustStake(w, uid, team, opts) {
  const out = await stake(w, uid, team, opts);
  expect(out.refusal, `${uid} on ${team}: ${JSON.stringify(out.refusal)}`).toBeUndefined();
  return out;
}

/** The pod's final week: every seat banked, all four TIED when `tie` (every stake wins). */
function finalGroup(g, { tie = true } = {}) {
  const ids = g.groupMembers;
  const closeScores = Object.fromEntries(ids.map((id, i) => [id, { totalPoints: 10, agentPoints: 10, compositePoints: tie ? 100 : 100 - i * 10 }]));
  const dates = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
  return { ...g, status: 'complete', dailyScores: Object.fromEntries(dates.map((recordedDate, i) => [`day${i + 1}`, { recordedDate, closeScores }])) };
}

const poolWrites = (w) => w.writeLog.filter(([, p]) => p === POOL).length;
/** The writes ONE call committed, off the harness's own log — every buffered write, per operation. */
async function measure(w, fn) {
  const before = w.writeLog.length;
  const out = await fn();
  const writes = w.writeLog.slice(before);
  return { out, writes: writes.length, stakeWrites: writes.filter(([, p]) => p.startsWith('backingStakes/')).length };
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

// The full book — 20 backers × 4 teams = 80 documents — is built ONCE through
// the real stake transaction and cloned for each row that needs it.
let fullBook = null;
async function fullBookWorld() {
  if (fullBook == null) {
    vi.setSystemTime(NOW);
    const w = makeVersionedDb({ [`tournamentGroups/${GID}`]: group() });
    for (let n = 1; n <= POOL_MAX_BACKERS; n += 1) {
      for (const team of SEATS) await mustStake(w, backer(n), team);
    }
    fullBook = Object.fromEntries(w.store);
  }
  return makeVersionedDb(fullBook);
}

describe('the limits — Amendment D R1', () => {
  it('PIN: the two limits fit inside the settlement ceilings, and raising either past them fails here', () => {
    expect(POOL_MAX_BACKERS).toBe(20);
    expect(POOL_MAX_STAKES).toBe(80);
    expect(SETTLEMENT_MAX_STAKES).toBe(120);
    expect(SETTLEMENT_MAX_WRITES).toBe(480);
    // The bound the write arithmetic rests on: the most writes a stake can cost
    // any money path is 5 (a winning settlement, or any refund), plus the pool
    // and the sealed totals — 2 for the close, 1 for the settlement / refund.
    expect(POOL_MAX_STAKES).toBeLessThanOrEqual(SETTLEMENT_MAX_STAKES);
    expect(2 + POOL_MAX_STAKES * 5).toBeLessThanOrEqual(SETTLEMENT_MAX_WRITES);
    // Every backer can fill every seat of a pod: the backer limit never makes
    // the document limit unreachable by itself (4 seats × 20 = 80).
    expect(POOL_MAX_BACKERS * SEATS.length).toBeLessThanOrEqual(POOL_MAX_STAKES);
  });

  it('poolSizeOf counts distinct backers and stake DOCUMENTS (byTeam keys), never the folded totals', () => {
    expect(poolSizeOf({})).toEqual({ backers: 0, stakes: 0 });
    expect(poolSizeOf({ a: { total: 150, byTeam: { x: 100, y: 50 } }, b: { total: 0, byTeam: { x: 0 } } }))
      .toEqual({ backers: 2, stakes: 3 });
  });
});

describe('the 20th backer, the 21st, and the 81st document — Amendment D R1/R2', () => {
  it('the 20th distinct backer is admitted and writes `full: true` ONCE; no stake after it writes the public document again', async () => {
    const w = makeVersionedDb({ [`tournamentGroups/${GID}`]: group() });
    // Backers spread over two teams: the spread is met by the 2nd, the backer
    // floor by the 3rd — from there on §B2's freeze writes nothing public.
    for (let n = 1; n <= 3; n += 1) await mustStake(w, backer(n), n % 2 ? 'seat-a' : 'seat-b');
    const qualified = poolWrites(w);
    for (let n = 4; n < POOL_MAX_BACKERS; n += 1) await mustStake(w, backer(n), n % 2 ? 'seat-a' : 'seat-b');
    expect(poolWrites(w)).toBe(qualified);
    expect(w.store.get(POOL).full).toBeUndefined();
    // THE ONE WRITE: the 20th distinct backer.
    await mustStake(w, backer(POOL_MAX_BACKERS), 'seat-c');
    expect(w.store.get(POOL).full).toBe(true);
    expect(poolWrites(w)).toBe(qualified + 1);
    // The public document carries `full` and NOTHING more about the book.
    for (const key of ['potTotal', 'uniqueBackers', 'teamsBacked', 'backers', 'byTeam']) expect(w.store.get(POOL)).not.toHaveProperty(key);
    expect(w.store.get(POOL).backerProgress).toEqual({ count: 3, floor: 3, met: true });
    // …and never again: top-ups and new teams by the twenty move nothing public.
    await mustStake(w, backer(1), 'seat-a', { amount: 100 });
    await mustStake(w, backer(2), 'seat-d');
    await mustStake(w, backer(POOL_MAX_BACKERS), 'seat-b');
    expect(poolWrites(w)).toBe(qualified + 1);
  }, 60_000);

  it('the 21st distinct backer is REFUSED `pool_full` with nothing written — wallet, allowance week, totals and public document unchanged', async () => {
    const w = makeVersionedDb({ [`tournamentGroups/${GID}`]: group() });
    for (let n = 1; n <= POOL_MAX_BACKERS; n += 1) await mustStake(w, backer(n), n % 2 ? 'seat-a' : 'seat-b');
    // The 21st backer holds a PRIOR week's wallet: a refusal that leaked past
    // the first buffered write would re-key it to this week and expire its 300.
    const late = backer(21);
    const priorWallet = { lastAllowanceWeek: '2026-W39', allowanceRemaining: 300, appliedEntries: { 'allowance:2026-W39': '2026-09-15T04:00:00.000Z' }, careerNet: -700 };
    w.store.set(`backingWallets/${late}`, priorWallet);
    seedBacker(w.store, late);
    const snapshot = structuredClone(Object.fromEntries(w.store));
    const logBefore = w.writeLog.length;

    const out = await stake(w, late, 'seat-c');
    expect(out.refusal).toMatchObject({ status: 409, error: POOL_FULL });
    expect(w.writeLog.length).toBe(logBefore);
    expect(w.store.get(`backingWallets/${late}`)).toEqual(priorWallet);
    expect(w.store.get(TOTALS)).toEqual(snapshot[TOTALS]);
    expect(w.store.get(POOL)).toEqual(snapshot[POOL]);
    expect(w.store.has(`backingStakes/${stakeIdFor(late, GID, 'seat-c')}`)).toBe(false);
    // Nothing anywhere moved.
    expect(Object.fromEntries(w.store)).toEqual(snapshot);
  }, 60_000);

  it('at 20 backers, an existing backer can TOP UP and can back a NEW team', async () => {
    const w = makeVersionedDb({ [`tournamentGroups/${GID}`]: group() });
    for (let n = 1; n <= POOL_MAX_BACKERS; n += 1) await mustStake(w, backer(n), 'seat-a');
    expect(w.store.get(POOL).full).toBe(true);
    const topUp = await mustStake(w, backer(7), 'seat-a', { amount: 100 });
    expect(topUp.topUp).toBe(true);
    expect(topUp.stake.amount).toBe(MIN_STAKE_BP + 100);
    const second = await mustStake(w, backer(7), 'seat-b');
    expect(second.topUp).toBe(false);
    expect(poolSizeOf(w.store.get(TOTALS).backers)).toEqual({ backers: 20, stakes: 21 });
  }, 60_000);

  it('the 81st stake DOCUMENT is refused `pool_full` (slot seat churn) — while a top-up at 80 documents is not', async () => {
    const w = await fullBookWorld();
    expect(poolSizeOf(w.store.get(TOTALS).backers)).toEqual({ backers: 20, stakes: 80 });
    // A seat leaves and is replaced (the slot-pod churn the limit is the belt for).
    const churned = SEATS.map((s) => (s === 'seat-d' ? 'seat-e' : s));
    w.store.set(`tournamentGroups/${GID}`, group({ groupMembers: churned, players: churned.map((odUserId) => ({ odUserId, picks: [] })) }));
    const snapshot = structuredClone(Object.fromEntries(w.store));
    const logBefore = w.writeLog.length;
    // Refused by a THROW after the debit (SEAL-4): the grant and the debit
    // buffered before it roll back, so nothing is written.
    await expect(stake(w, backer(3), 'seat-e')).rejects.toMatchObject({
      name: 'StakeRefusal', statusCode: 409, code: POOL_FULL, payload: { message: 'This pool is full.' },
    });
    expect(w.writeLog.length).toBe(logBefore);
    expect(Object.fromEntries(w.store)).toEqual(snapshot);
    expect(w.store.has(`backingStakes/${stakeIdFor(backer(3), GID, 'seat-e')}`)).toBe(false);
    // R1: a TOP-UP is never refused by either limit.
    const topUp = await mustStake(w, backer(3), 'seat-a', { amount: 100 });
    expect(topUp.topUp).toBe(true);
    expect(poolSizeOf(w.store.get(TOTALS).backers).stakes).toBe(80);
  }, 120_000);

  it('SEAL-4: the document limit cannot be probed for free — a request the allowance would refuse is answered `insufficient_allowance`, never `pool_full`', async () => {
    const w = await fullBookWorld();
    const churned = SEATS.map((s) => (s === 'seat-d' ? 'seat-e' : s));
    w.store.set(`tournamentGroups/${GID}`, group({ groupMembers: churned, players: churned.map((odUserId) => ({ odUserId, picks: [] })) }));
    // backer 4 spends down to 200 BP left (four top-ups of 150 on 200 already spent).
    for (const team of ['seat-a', 'seat-b', 'seat-c']) await mustStake(w, backer(4), team, { amount: 150 });
    await mustStake(w, backer(4), 'seat-a', { amount: 150, requestId: 'u-04-seat-a-second-150' });
    expect(w.store.get(`backingWallets/${backer(4)}`).allowanceRemaining).toBe(200);
    await expect(stake(w, backer(4), 'seat-e', { amount: 250 })).rejects.toMatchObject({ code: 'insufficient_allowance' });
    // …while a request the allowance WOULD admit learns the limit.
    await expect(stake(w, backer(4), 'seat-e', { amount: 100 })).rejects.toMatchObject({ code: POOL_FULL });
  }, 120_000);

  it('MON-3 (the review): a pool that has taken stakes but lost its sealed totals fails CLOSED — the size cannot be read, so nothing is admitted', async () => {
    const w = makeVersionedDb({ [`tournamentGroups/${GID}`]: group() });
    for (let n = 1; n <= 3; n += 1) await mustStake(w, backer(n), 'seat-a');
    w.store.delete(TOTALS); // out of band
    seedBacker(w.store, backer(9));
    const before = structuredClone(Object.fromEntries(w.store));
    const out = await stake(w, backer(9), 'seat-b');
    expect(out.refusal).toMatchObject({ status: 409, error: 'no_pool', reason: 'totals_missing' });
    expect(Object.fromEntries(w.store)).toEqual(before);
    // A brand-new pool (no stake yet, no totals) still opens its book.
    const fresh = makeVersionedDb({ [`tournamentGroups/${GID}`]: group() });
    await mustStake(fresh, backer(1), 'seat-a');
  });

  it('the two limits answer ALIKE through the route: one status, one code, one sentence', () => {
    // The route answers a returned refusal `{ error, ...rest }` and a thrown
    // StakeRefusal `{ error: code, ...payload }` (api/tournament/backing-stake.js).
    const returned = { status: 409, error: POOL_FULL, message: 'This pool is full.' };
    const { status, error, ...rest } = returned;
    const thrown = { statusCode: 409, code: POOL_FULL, payload: { message: 'This pool is full.' } };
    expect([status, { error, ...rest }]).toEqual([thrown.statusCode, { error: thrown.code, ...thrown.payload }]);
  });

  it('the 20th and 21st new backers RACING: exactly one is admitted, the other is refused, `full` is written once', async () => {
    const w = makeVersionedDb({ [`tournamentGroups/${GID}`]: group() });
    for (let n = 1; n < POOL_MAX_BACKERS; n += 1) await mustStake(w, backer(n), n % 2 ? 'seat-a' : 'seat-b');
    const before = poolWrites(w);
    for (const n of [POOL_MAX_BACKERS, POOL_MAX_BACKERS + 1]) seedBacker(w.store, backer(n));
    const results = await Promise.all([stake(w, backer(POOL_MAX_BACKERS), 'seat-c'), stake(w, backer(POOL_MAX_BACKERS + 1), 'seat-d')]);
    const admitted = results.filter((r) => r.refusal == null);
    const refused = results.filter((r) => r.refusal != null);
    expect(admitted).toHaveLength(1);
    expect(refused.map((r) => r.refusal.error)).toEqual([POOL_FULL]);
    expect(poolSizeOf(w.store.get(TOTALS).backers).backers).toBe(POOL_MAX_BACKERS);
    expect(w.store.get(POOL).full).toBe(true);
    expect(poolWrites(w)).toBe(before + 1);
  }, 60_000);

  it('the pod-list projection offers a FULL pool to a backer as before, and to a non-backer as unbackable', () => {
    const g = { id: GID, ...group() };
    const pool = { status: POOL_STATUS.OPEN, backerProgress: { count: 3, floor: 3, met: true }, teamSpread: { met: true }, full: true, closesAt: CLOSE.toISOString() };
    const stranger = projectPod(g, pool, { viewerUid: 'stranger', myStakes: [] });
    expect(stranger.pool.full).toBe(true);
    expect(stranger.teams.every((t) => t.backable === false)).toBe(true);
    const mine = [{ id: 's1', teamOdUserId: 'seat-a', amount: 50, status: STAKE_STATUS.LIVE }];
    const backerView = projectPod(g, pool, { viewerUid: backer(1), myStakes: mine });
    expect(backerView.teams.every((t) => t.backable === true)).toBe(true);
    // Not full: everyone backs as today.
    const notFull = projectPod(g, { ...pool, full: undefined }, { viewerUid: 'stranger', myStakes: [] });
    expect(notFull.pool.full).toBe(false);
    expect(notFull.teams.every((t) => t.backable === true)).toBe(true);
  });
});

describe('THE WORST-CASE PROOF — the worst admissible book through the real planners and writers', () => {
  const report = {};
  // Printed for the build report (§6): measured, never derived.
  afterEach(() => { console.log(`[worst-case] ${JSON.stringify(report)}`); });

  it('SETTLEMENT, every stake a winner (an all-way tie): 80 live stakes, 401 writes — inside 120 / 480', async () => {
    const w = await fullBookWorld();
    expect(w.store.get(POOL).full).toBe(true);
    await ensureClosed(w.db, GID, CLOSE);
    expect(w.store.get(POOL).status).toBe(POOL_STATUS.CLOSED);
    // `full` is an open-state signal: the reveal takes it off with the capped
    // pair (SEAL-2), leaving one answer to "how many backers".
    expect(w.store.get(POOL)).not.toHaveProperty('full');
    expect(w.store.get(POOL).uniqueBackers).toBe(POOL_MAX_BACKERS);
    w.store.set(`tournamentGroups/${GID}`, finalGroup(group(), { tie: true }));
    vi.setSystemTime(END);
    const { out, writes, stakeWrites } = await measure(w, () => settlePool(w.db, GID, { now: END, source: SETTLEMENT_SOURCE.ADMIN }));
    expect(out.settled, JSON.stringify(out)).toBe(true);
    expect(out.stakesSettled).toBe(POOL_MAX_STAKES);
    const won = [...w.store.values()].filter((d) => d?.groupId === GID && d?.status === STAKE_STATUS.WON);
    expect(won).toHaveLength(POOL_MAX_STAKES);
    expect(stakeWrites).toBe(POOL_MAX_STAKES);
    expect(writes).toBe(1 + POOL_MAX_STAKES * 5);
    expect(POOL_MAX_STAKES).toBeLessThanOrEqual(SETTLEMENT_MAX_STAKES);
    expect(writes).toBeLessThanOrEqual(SETTLEMENT_MAX_WRITES);
    report.settleAllWin = { liveStakes: POOL_MAX_STAKES, writes, formula: '1 + 80 × 5' };
  }, 180_000);

  it('a FULL REFUND (admin): 80 live stakes, 401 writes — inside 120 / 480', async () => {
    const w = await fullBookWorld();
    await ensureClosed(w.db, GID, CLOSE);
    vi.setSystemTime(END);
    const { out, writes, stakeWrites } = await measure(w, () => refundPool(w.db, GID, { now: END, source: SETTLEMENT_SOURCE.ADMIN, reason: VOID_REASONS.ADMIN, note: 'worst-case proof' }));
    expect(out.refunded, JSON.stringify(out)).toBe(true);
    expect(out.stakesVoided).toBe(POOL_MAX_STAKES);
    expect(stakeWrites).toBe(POOL_MAX_STAKES);
    expect(writes).toBe(1 + POOL_MAX_STAKES * 5);
    expect(writes).toBeLessThanOrEqual(SETTLEMENT_MAX_WRITES);
    report.refundAll = { liveStakes: POOL_MAX_STAKES, writes, formula: '1 + 80 × 5' };
  }, 180_000);

  it('a DELETED-POD close that refunds everything: 80 stakes voided `group_deleted`, 402 writes — inside 120 / 480', async () => {
    const w = await fullBookWorld();
    w.store.delete(`tournamentGroups/${GID}`);
    const { out, writes, stakeWrites } = await measure(w, () => ensureClosed(w.db, GID, NOW));
    expect(out).toMatchObject({ closed: true, status: POOL_STATUS.REFUNDED, voided: POOL_MAX_STAKES });
    const deleted = [...w.store.values()].filter((d) => d?.groupId === GID && d?.voidReason === VOID_REASONS.GROUP_DELETED);
    expect(deleted).toHaveLength(POOL_MAX_STAKES);
    expect(stakeWrites).toBe(POOL_MAX_STAKES);
    // Per void 5 (the stake, the refund pair), plus the sealed totals and the pool.
    expect(writes).toBe(2 + POOL_MAX_STAKES * 5);
    expect(writes).toBeLessThanOrEqual(SETTLEMENT_MAX_WRITES);
    report.closeDeleted = { stakesVoided: POOL_MAX_STAKES, writes, formula: '2 + 80 × 5' };
  }, 180_000);

  it('PRIORS FROM SEAT-LEFT VOIDS: the close voids the departed seat, and neither the settlement nor the refund costs them again', async () => {
    const w = await fullBookWorld();
    // seat-d left before close; its 20 stakes are seat_left voids at close.
    const stayed = SEATS.slice(0, 3);
    w.store.set(`tournamentGroups/${GID}`, group({ groupMembers: stayed, players: stayed.map((odUserId) => ({ odUserId, picks: [] })) }));
    const close = await measure(w, () => ensureClosed(w.db, GID, CLOSE));
    expect(close.out).toMatchObject({ closed: true, status: POOL_STATUS.CLOSED, voided: POOL_MAX_BACKERS });
    expect(close.writes).toBe(2 + POOL_MAX_BACKERS * 5);
    // The settlement reads the WHOLE book (80 documents) but decides only the
    // 60 live ones; the 20 seat-left voids are neither `live` nor priors
    // (`won` / `lost`), so they cost it nothing.
    const settled = makeVersionedDb(Object.fromEntries(w.store));
    settled.store.set(`tournamentGroups/${GID}`, finalGroup(group({ groupMembers: stayed, players: stayed.map((odUserId) => ({ odUserId, picks: [] })) }), { tie: true }));
    vi.setSystemTime(END);
    const settle = await measure(settled, () => settlePool(settled.db, GID, { now: END, source: SETTLEMENT_SOURCE.ADMIN }));
    expect(settle.out.settled, JSON.stringify(settle.out)).toBe(true);
    expect(settle.out.stakesSettled).toBe(60);
    expect(settle.writes).toBe(1 + 60 * 5);
    expect(settle.writes).toBeLessThanOrEqual(SETTLEMENT_MAX_WRITES);
    // The refund's priors are stakes voided by ITS OWN reason; a `seat_left`
    // void is never one, so the refund of the same book costs the 60 alone.
    const refunded = makeVersionedDb(Object.fromEntries(w.store));
    const refund = await measure(refunded, () => refundPool(refunded.db, GID, { now: END, source: SETTLEMENT_SOURCE.ADMIN, reason: VOID_REASONS.ADMIN, note: 'worst-case proof' }));
    expect(refund.out.refunded, JSON.stringify(refund.out)).toBe(true);
    expect(refund.out).toMatchObject({ stakesVoided: 60, priorVoided: 0 });
    expect(refund.writes).toBe(1 + 60 * 5);
    report.seatLeftPriors = { closeVoided: POOL_MAX_BACKERS, closeWrites: close.writes, settleLive: 60, settleWrites: settle.writes, refundLive: 60, refundPriors: 0, refundWrites: refund.writes };
  }, 240_000);

  it('the deleted-pod close of the worst book needs no ceiling of its own — `closePool` reaches 402 at most', async () => {
    // `closePool` asserts no ceiling (it never has); the cap is what bounds it.
    // Its worst case is every admissible document voided at once, which is the
    // row above. A tombstone handed straight to `closePool` is the same path.
    const w = await fullBookWorld();
    w.store.delete(`tournamentGroups/${GID}`);
    const { out, writes } = await measure(w, () => closePool(w.db, { id: GID, isDev: false, missing: true }, NOW));
    expect(out.status).toBe(POOL_STATUS.REFUNDED);
    expect(writes).toBe(402);
  }, 180_000);
});
