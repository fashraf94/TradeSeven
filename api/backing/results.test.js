// api/backing/results.test.js
//
// GET /api/backing/results — Backing Beta PR 5, THE RESULTS READER and the
// SETTLE-ON-READ host (spec V1.3 §5, §7 "Retries", D-o; the PR 3 review
// record's finding 1). The LIT suite; the darkness suite is the sibling
// backing-routes.dark.test.js.
//
// THE ROWS THIS FILE EXISTS FOR:
//   · THE FREEZE (mutation check 6): under TOURNAMENT_ADVANCEMENT_FROZEN the
//     primitive is never CALLED — the settle-on-read pass stops in front of
//     the call, not inside it;
//   · settle-on-read reaches the pod the pod list never could: a CLOSED pool
//     whose pod has completed is settled by this read, a voided / expired /
//     deleted pod's pool is refunded by it, and a RESOLVING hold is never
//     touched;
//   · the card's payout is `stake.payout` (mutation check 3);
//   · the reader loads the VIEWER's pools only, newest week first.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the route's real import is the
// runtime guard for its api/ -> src/ imports. The settlement module is
// wrapped with a spy that CALLS THE REAL primitive, never a stub.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ flag: true, frozen: false, uid: 'viewer-1' }));
const spy = vi.hoisted(() => ({ settlePool: null }));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (!state.uid) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: state.uid, firebase: { sign_in_provider: 'password' } };
  },
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return state.flag; },
  get TOURNAMENT_ADVANCEMENT_FROZEN() { return state.frozen; },
}));
// The REAL primitive behind a spy — so "never called" is a fact about the route.
vi.mock('../_utils/backingSettlement.js', async (importOriginal) => {
  const actual = await importOriginal();
  spy.settlePool = vi.fn((...args) => actual.settlePool(...args));
  return { ...actual, settlePool: spy.settlePool };
});

let DB = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => DB.db }));

const { makeInMemoryDb } = await import('../_utils/__fixtures__/inMemoryFirestore.js');
const { default: handler, DEFAULT_WEEKS, MAX_WEEKS, SETTLE_ON_READ_SKIP, settleOnRead } = await import('./results.js');
const { BACKING_POOLS_COLLECTION, BACKING_STAKES_COLLECTION, POOL_STATUS, STAKE_STATUS, totalsFromStakes } = await import('../_utils/backingPools.js');
const { BACKING_WALLETS_COLLECTION } = await import('../_utils/backingWallet.js');
const { SETTLEMENT_SOURCE } = await import('../_utils/backingSettlement.js');
const { GROUP_STATUS, round2 } = await import('../../src/constants/leagueTournament.js');

// ==================== FIXTURES ====================
const UID = 'viewer-1';
const NOW = new Date('2026-10-05T14:00:00.000Z'); // Monday after the W40 battle week
const PLAYERS = [{ odUserId: 'od-a' }, { odUserId: 'od-b' }, { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'cpu-2', isCpu: true }];
const SEAT_NAMES = { 'od-a': 'Mira', 'od-b': 'Draco' };

function bankedWeek(days = 5, monday = '2026-09-28') {
  const final = { 'od-a': [60, 30], 'od-b': [40, 20], 'cpu-1': [20, 10], 'cpu-2': [10, 5] };
  const dailyScores = {};
  for (let i = 0; i < days; i += 1) {
    const d = new Date(`${monday}T12:00:00.000Z`); d.setUTCDate(d.getUTCDate() + i);
    const closeScores = {};
    for (const [id, [user, agent]] of Object.entries(final)) closeScores[id] = { totalPoints: user, agentPoints: agent, compositePoints: round2(agent + 1.5 * user), picks: [] };
    dailyScores[`day${i + 1}`] = { recordedDate: d.toISOString().slice(0, 10), closeScores };
  }
  return dailyScores;
}
const group = (over = {}) => ({
  status: GROUP_STATUS.COMPLETE, isLiveDraft: false, baseLayerWeek: '2026-W40', seatNames: SEAT_NAMES,
  createdAt: '2026-09-22T14:00:00.000Z', updatedAt: NOW.toISOString(), groupMembers: PLAYERS.map((p) => p.odUserId), players: PLAYERS, dailyScores: bankedWeek(), ...over,
});

/** ONE pod's world: the group, a pool in `status`, its stakes and wallets. */
function pod(groupId, { status = POOL_STATUS.CLOSED, g = group(), stakes = [], weekKey = '2026-W40', monday = '2026-09-28', withGroup = true, poolOver = {} } = {}) {
  const dev = g?.isDev === true;
  const poolId = dev ? `dev-${groupId}` : groupId;
  const totals = totalsFromStakes(stakes);
  const seats = PLAYERS.map((p) => ({ odUserId: p.odUserId, isCpu: p.isCpu === true }));
  const initial = {
    [`${BACKING_POOLS_COLLECTION}/${poolId}`]: {
      groupId, status, formationPath: 'lobby', slotId: null, battleMondayEtDate: monday, backingWeekStart: '2026-09-21T04:00:00.000Z',
      opensAt: '2026-09-22T14:00:00.000Z', closesAt: `${monday}T03:59:59.000Z`, closeReason: 'clock', baseLayerWeek: weekKey, isDev: dev,
      teams: seats.map((t) => ({ odUserId: t.odUserId, isCpu: t.isCpu, stakeTotal: totals.byTeam[t.odUserId]?.stakeTotal ?? 0, backerCount: totals.byTeam[t.odUserId]?.backerCount ?? 0 })),
      humanTeams: 2, potTotal: totals.private.potTotal, uniqueBackers: totals.private.uniqueBackers, teamsBacked: totals.private.teamsBacked,
      closedAt: `${monday}T04:00:00.000Z`, createdAt: '2026-09-22T14:00:00.000Z', updatedAt: `${monday}T04:00:00.000Z`, ...poolOver,
    },
    [`${BACKING_POOLS_COLLECTION}/${poolId}/private/totals`]: { ...totals.private, updatedAt: `${monday}T04:00:00.000Z` },
  };
  if (withGroup && g) initial[`tournamentGroups/${groupId}`] = g;
  stakes.forEach((s, i) => { initial[`${BACKING_STAKES_COLLECTION}/${s.id ?? `${groupId}-s${i}`}`] = { userId: s.userId, groupId, teamOdUserId: s.teamOdUserId, amount: s.amount, hashAtStake: s.hashAtStake ?? null, placedAt: '2026-09-23T14:00:00.000Z', weekKey, requestId: `r-${i}`, status: s.status ?? STAKE_STATUS.LIVE, ...(s.payout !== undefined ? { payout: s.payout } : {}), ...(s.voidReason ? { voidReason: s.voidReason } : {}) }; });
  for (const uid of new Set(stakes.map((s) => s.userId))) {
    const spent = stakes.filter((s) => s.userId === uid).reduce((sum, s) => sum + s.amount, 0);
    initial[`${BACKING_WALLETS_COLLECTION}/${dev ? `dev-${uid}` : uid}`] = { lastAllowanceWeek: weekKey, allowanceRemaining: 1000 - spent, careerNet: -spent, seasons: {}, appliedEntries: {}, createdAt: 'x', updatedAt: 'x' };
  }
  return initial;
}
/** The §3 book: od-a 700 (viewer 500 + u2 200), od-b 300 (u3) — pot 1,000; od-a wins → the viewer's 500 pays floor(500 × 1000 ÷ 700) = 714, not 500 × 1.43 = 715. */
const BOOK = () => [
  { id: 'v1', userId: UID, teamOdUserId: 'od-a', amount: 500, hashAtStake: 'hash-monday' },
  { id: 'o1', userId: 'u2', teamOdUserId: 'od-a', amount: 200 },
  { id: 'o2', userId: 'u3', teamOdUserId: 'od-b', amount: 300 },
];

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
async function get(query = {}, { method = 'GET' } = {}) {
  const res = mkRes();
  await handler({ method, headers: {}, query }, res);
  return res;
}
const poolOf = (id) => DB.store.get(`${BACKING_POOLS_COLLECTION}/${id}`);
const stakeOf = (id) => DB.store.get(`${BACKING_STAKES_COLLECTION}/${id}`);

beforeEach(() => {
  state.flag = true; state.frozen = false; state.uid = UID;
  spy.settlePool.mockClear();
  DB = makeInMemoryDb({ ...pod('g-w40', { stakes: BOOK() }) });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// ============================================================================
describe('the pipeline, in order', () => {
  it('405s anything but GET; 401s without a caller BEFORE the flag; 404s while dark AFTER auth', async () => {
    expect((await get({}, { method: 'POST' })).statusCode).toBe(405);
    state.uid = null;
    expect((await get()).statusCode).toBe(401);
    state.uid = UID; state.flag = false;
    const res = await get();
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(DB.readLog).toEqual([]);
  });

  it('400s a bad groupId, a bad before and a bad limit, reading nothing', async () => {
    for (const [query, error] of [[{ groupId: 'a/b' }, 'invalid_group_id'], [{ before: 'W40' }, 'invalid_before'], [{ limit: '0' }, 'invalid_limit'], [{ limit: String(MAX_WEEKS + 1) }, 'invalid_limit'], [{ limit: 'four' }, 'invalid_limit']]) {
      const res = await get(query);
      expect(res.statusCode, JSON.stringify(query)).toBe(400);
      expect(res.body.error).toBe(error);
    }
    expect(DB.readLog).toEqual([]);
    expect(DEFAULT_WEEKS).toBe(4);
  });
});

// ============================================================================
describe('SETTLE-ON-READ — the path the pod list never had (finding 1)', () => {
  it('a CLOSED pool whose pod has completed is SETTLED by this read: the primitive is called once, source settle_on_read, and the card shows the result', async () => {
    const res = await get({ groupId: 'g-w40' });
    expect(res.statusCode).toBe(200);
    expect(spy.settlePool).toHaveBeenCalledTimes(1);
    expect(spy.settlePool.mock.calls[0][1]).toBe('g-w40');
    expect(spy.settlePool.mock.calls[0][2]).toMatchObject({ source: SETTLEMENT_SOURCE.SETTLE_ON_READ });
    expect(poolOf('g-w40')).toMatchObject({ status: POOL_STATUS.RESOLVED, settlementRef: SETTLEMENT_SOURCE.SETTLE_ON_READ, settledAt: NOW.toISOString(), winnerOdUserIds: ['od-a'] });
    expect(res.body.pod).toMatchObject({ groupId: 'g-w40', outcome: 'settled', winners: ['od-a'], potTotal: 1000, seatNames: SEAT_NAMES });
  });

  it('MUTATION CHECK 3 — the viewer\'s payout is `stake.payout` (714), never stake × paysX (715)', async () => {
    const res = await get({ groupId: 'g-w40' });
    const mine = res.body.pod.myStakes.find((s) => s.stakeId === 'v1');
    expect(stakeOf('v1')).toMatchObject({ status: STAKE_STATUS.WON, payout: 714 });
    expect(mine).toMatchObject({ amount: 500, status: STAKE_STATUS.WON, payout: 714, net: 214 });
    const teamA = res.body.pod.teams.find((t) => t.odUserId === 'od-a');
    expect(teamA.paysX).toBe(1.43);
    expect(mine.payout).not.toBe(Math.round(mine.amount * teamA.paysX));
    expect(teamA).toMatchObject({ backerCount: 2, stakeTotal: 700, sharePct: 70, won: true });
    expect(res.body.pod.teams.find((t) => t.odUserId === 'od-b')).toMatchObject({ backerCount: 1, sharePct: 30, paysX: 3.33, won: false });
    expect(res.body.pod.teams.find((t) => t.odUserId === 'cpu-1')).toMatchObject({ paysX: null, sharePct: 0 });
  });

  it('MUTATION CHECK 6 — FROZEN: the primitive is NEVER CALLED; the pool stays closed; the card says settling', async () => {
    state.frozen = true;
    const res = await get({ groupId: 'g-w40' });
    expect(res.statusCode).toBe(200);
    expect(spy.settlePool).not.toHaveBeenCalled();
    expect(DB.writeLog).toEqual([]);
    expect(poolOf('g-w40').status).toBe(POOL_STATUS.CLOSED);
    expect(res.body.pod).toMatchObject({ outcome: 'settling', winners: [] });
    expect(res.body.pod.myStakes[0]).toMatchObject({ status: STAKE_STATUS.LIVE, payout: null });
  });

  it('a RESOLVING hold is never touched — admin-only; the card says settling with the hold', async () => {
    DB = makeInMemoryDb(pod('g-held', { status: POOL_STATUS.RESOLVING, stakes: BOOK(), poolOver: { holdReason: 'agent_layer_absent' } }));
    const res = await get({ groupId: 'g-held' });
    expect(spy.settlePool).not.toHaveBeenCalled();
    expect(DB.writeLog).toEqual([]);
    expect(res.body.pod).toMatchObject({ outcome: 'settling', holdReason: 'agent_layer_absent' });
  });

  it('a pod that is NOT final (in battle) is left alone — the primitive is not called for it', async () => {
    DB = makeInMemoryDb(pod('g-play', { g: group({ status: GROUP_STATUS.BATTLE, dailyScores: bankedWeek(2) }), stakes: BOOK() }));
    const res = await get({ groupId: 'g-play' });
    expect(spy.settlePool).not.toHaveBeenCalled();
    expect(res.body.pod.outcome).toBe('settling');
  });

  it('a VOIDED pod\'s closed pool is REFUNDED by this read (settlePool routes): every stake voided group_voided, stated plainly on the card', async () => {
    DB = makeInMemoryDb(pod('g-void', { g: group({ status: GROUP_STATUS.VOIDED, dailyScores: bankedWeek(1) }), stakes: BOOK() }));
    const res = await get({ groupId: 'g-void' });
    expect(spy.settlePool).toHaveBeenCalledTimes(1);
    expect(poolOf('g-void')).toMatchObject({ status: POOL_STATUS.REFUNDED, refundReason: 'group_voided', refundRef: SETTLEMENT_SOURCE.SETTLE_ON_READ });
    expect(res.body.pod).toMatchObject({ outcome: 'refunded', refundReason: 'group_voided', refundedAt: NOW.toISOString() });
    expect(res.body.pod.myStakes[0]).toMatchObject({ status: STAKE_STATUS.VOIDED, voidReason: 'group_voided', payout: null, net: 0 });
    expect(DB.store.get(`${BACKING_WALLETS_COLLECTION}/${UID}`).careerNet).toBe(0);
  });

  it('an EXPIRED pod and a DELETED pod refund too — group_expired / group_deleted', async () => {
    DB = makeInMemoryDb(pod('g-exp', { g: group({ status: GROUP_STATUS.EXPIRED, dailyScores: {} }), stakes: BOOK() }));
    expect((await get({ groupId: 'g-exp' })).body.pod).toMatchObject({ outcome: 'refunded', refundReason: 'group_expired' });
    DB = makeInMemoryDb(pod('g-gone', { withGroup: false, stakes: BOOK() }));
    const res = await get({ groupId: 'g-gone' });
    expect(res.body.pod).toMatchObject({ outcome: 'refunded', refundReason: 'group_deleted', seatNames: {} });
  });

  it('an OPEN pool past its close is CLOSED first (the lazy close), then judged', async () => {
    DB = makeInMemoryDb(pod('g-late', { status: POOL_STATUS.OPEN, stakes: BOOK(), poolOver: { teams: undefined, potTotal: undefined, uniqueBackers: undefined, teamsBacked: undefined } }));
    const res = await get({ groupId: 'g-late' });
    expect(poolOf('g-late')).toMatchObject({ status: POOL_STATUS.RESOLVED, closedAt: NOW.toISOString() });
    expect(res.body.pod.outcome).toBe('settled');
  });

  it('WIRE-1 — a lazy close that VOIDS the viewer\'s stakes without the primitive (two backers → insufficient) is reflected on the same read: the stake copies are re-read', async () => {
    // Two backers only: the close lands `insufficient` and voids every stake
    // itself; the primitive is never called (`not_closed` after the close), so
    // the reply must come from the re-read documents, not the pre-close copies.
    DB = makeInMemoryDb(pod('g-thin', { status: POOL_STATUS.OPEN, stakes: BOOK().slice(0, 2), poolOver: { teams: undefined, potTotal: undefined, uniqueBackers: undefined, teamsBacked: undefined } }));
    const res = await get({ groupId: 'g-thin' });
    expect(spy.settlePool).not.toHaveBeenCalled();
    expect(poolOf('g-thin').status).toBe(POOL_STATUS.INSUFFICIENT);
    expect(stakeOf('v1')).toMatchObject({ status: STAKE_STATUS.VOIDED, voidReason: 'insufficient' });
    // No stake was DECIDED, so there is no net to state (the card says the
    // refund is score-neutral instead); each voided stake nets to zero.
    expect(res.body.pod).toMatchObject({ outcome: 'insufficient', myNet: null, myWon: null });
    expect(res.body.pod.myStakes[0]).toMatchObject({ stakeId: 'v1', status: STAKE_STATUS.VOIDED, voidReason: 'insufficient', net: 0, payout: null });
    // …and the weeks path shows the same re-read copy.
    const weeks = await get();
    const thin = weeks.body.weeks.flatMap((w) => w.pools).find((p) => p.groupId === 'g-thin');
    expect(thin.myStakes[0]).toMatchObject({ status: STAKE_STATUS.VOIDED, net: 0 });
  });

  it('HON-3 — a results week never lists the closed pool of a pod STILL PLAYING (that is Your Backing\'s); the pod\'s own read answers it as settling for a pod in play', async () => {
    DB = makeInMemoryDb({
      ...pod('g-play', { status: POOL_STATUS.CLOSED, g: group({ status: GROUP_STATUS.BATTLE, dailyScores: {} }), stakes: [{ id: 'p1', userId: UID, teamOdUserId: 'od-a', amount: 100 }] }),
      ...pod('g-done', { status: POOL_STATUS.INSUFFICIENT, stakes: [{ id: 'd1', userId: UID, teamOdUserId: 'od-a', amount: 100, status: STAKE_STATUS.VOIDED, voidReason: 'insufficient' }] }),
    });
    const res = await get();
    expect(res.body.weeks.map((w) => w.weekKey)).toEqual(['2026-W40']);
    expect(res.body.weeks[0].pools.map((p) => p.groupId)).toEqual(['g-done']);
    expect(JSON.stringify(res.body)).not.toContain('g-play');
    expect(spy.settlePool).not.toHaveBeenCalled();
    const single = await get({ groupId: 'g-play' });
    expect(single.body.pod).toMatchObject({ groupId: 'g-play', outcome: 'settling', status: POOL_STATUS.CLOSED, podStatus: GROUP_STATUS.BATTLE });
  });

  it('ONE pod\'s failing settlement never takes down the reader: the pod projects as it stands, the failure is logged', async () => {
    DB.db.runTransaction = async () => { throw new Error('Firestore is on fire'); };
    const res = await get({ groupId: 'g-w40' });
    expect(res.statusCode).toBe(200);
    expect(res.body.pod).toMatchObject({ outcome: 'settling' });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('settle-on-read failed for g-w40'), 'Firestore is on fire');
  });

  it('settleOnRead names why it did not call: no pool, not closed, frozen, not final', async () => {
    expect(await settleOnRead(DB.db, { groupId: 'x', group: null, pool: null, now: NOW })).toMatchObject({ called: false, skipped: SETTLE_ON_READ_SKIP.NO_POOL });
    expect(await settleOnRead(DB.db, { groupId: 'x', group: group(), pool: { status: POOL_STATUS.RESOLVED }, now: NOW })).toMatchObject({ called: false, skipped: SETTLE_ON_READ_SKIP.NOT_CLOSED });
    state.frozen = true;
    expect(await settleOnRead(DB.db, { groupId: 'x', group: group(), pool: { status: POOL_STATUS.CLOSED }, now: NOW })).toMatchObject({ called: false, skipped: SETTLE_ON_READ_SKIP.FROZEN });
    state.frozen = false;
    expect(await settleOnRead(DB.db, { groupId: 'x', group: group({ status: GROUP_STATUS.BATTLE }), pool: { status: POOL_STATUS.CLOSED }, now: NOW })).toMatchObject({ called: false, skipped: SETTLE_ON_READ_SKIP.NOT_FINAL });
    expect(spy.settlePool).not.toHaveBeenCalled();
  });

  it('an unknown pod (no pool) answers pod: null with no write', async () => {
    const res = await get({ groupId: 'nobody' });
    expect(res.body).toEqual({ viewerUid: UID, pod: null });
    expect(DB.writeLog).toEqual([]);
  });
});

// ============================================================================
describe('WEEKS — the last completed week first, then history', () => {
  beforeEach(() => {
    DB = makeInMemoryDb({
      // W38: settled two weeks ago.
      ...pod('g-w38', { status: POOL_STATUS.RESOLVED, weekKey: '2026-W38', monday: '2026-09-14', g: group({ baseLayerWeek: '2026-W38', dailyScores: bankedWeek(5, '2026-09-14') }),
        stakes: [{ id: 'w38', userId: UID, teamOdUserId: 'od-b', amount: 100, status: STAKE_STATUS.LOST, payout: 0 }],
        poolOver: { winnerOdUserIds: ['od-a'], winningStakes: 0, paysX: null, settledAt: '2026-09-18T22:30:00.000Z', settlementRef: 'friday_duty', monthKey: '2026-09' } }),
      // W39: an INSUFFICIENT pool (the viewer's stake voided at close).
      ...pod('g-w39', { status: POOL_STATUS.INSUFFICIENT, weekKey: '2026-W39', monday: '2026-09-21', g: group({ baseLayerWeek: '2026-W39', dailyScores: bankedWeek(5, '2026-09-21') }),
        stakes: [{ id: 'w39', userId: UID, teamOdUserId: 'od-a', amount: 100, status: STAKE_STATUS.VOIDED, voidReason: 'insufficient' }] }),
      // W40: closed, the pod complete — settled BY THIS READ.
      ...pod('g-w40', { stakes: BOOK() }),
      // W41: the open window — in play, never a result.
      ...pod('g-w41', { status: POOL_STATUS.OPEN, weekKey: '2026-W41', monday: '2026-10-12', g: group({ status: GROUP_STATUS.FORMING, baseLayerWeek: '2026-W41', dailyScores: {} }),
        stakes: [{ id: 'w41', userId: UID, teamOdUserId: 'od-a', amount: 50 }], poolOver: { closesAt: '2026-10-12T03:59:59.000Z', teams: undefined } }),
      // Someone ELSE's settled pool, never the viewer's.
      ...pod('g-other', { status: POOL_STATUS.RESOLVED, stakes: [{ id: 'oth', userId: 'u9', teamOdUserId: 'od-a', amount: 100, status: STAKE_STATUS.WON, payout: 100 }] }),
    });
  });

  it('lists the viewer\'s completed weeks NEWEST first, settles W40 on the way, skips the open window, and never shows another user\'s pool', async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.weeks.map((w) => w.weekKey)).toEqual(['2026-W40', '2026-W39', '2026-W38']);
    expect(res.body.nextBefore).toBeNull();
    const w40 = res.body.weeks[0].pools[0];
    expect(w40).toMatchObject({ groupId: 'g-w40', outcome: 'settled', weekKey: '2026-W40' });
    expect(w40.myStakes[0]).toMatchObject({ payout: 714, loadoutChanged: null });
    expect(res.body.weeks[1].pools[0]).toMatchObject({ groupId: 'g-w39', outcome: 'insufficient' });
    expect(res.body.weeks[1].pools[0].myStakes[0]).toMatchObject({ status: STAKE_STATUS.VOIDED, voidReason: 'insufficient', net: 0 });
    expect(res.body.weeks[2].pools[0]).toMatchObject({ groupId: 'g-w38', outcome: 'settled', winners: ['od-a'] });
    expect(JSON.stringify(res.body)).not.toContain('g-other');
    expect(JSON.stringify(res.body)).not.toContain('u9');
    expect(poolOf('g-w41').status).toBe(POOL_STATUS.OPEN);
  });

  it('pages: limit=1 gives the last completed week and a cursor; before=<that week> gives the next', async () => {
    const first = await get({ limit: '1' });
    expect(first.body.weeks.map((w) => w.weekKey)).toEqual(['2026-W40']);
    expect(first.body.nextBefore).toBe('2026-W40');
    const second = await get({ limit: '1', before: first.body.nextBefore });
    expect(second.body.weeks.map((w) => w.weekKey)).toEqual(['2026-W39']);
    expect(second.body.nextBefore).toBe('2026-W39');
    const third = await get({ limit: '2', before: '2026-W39' });
    expect(third.body.weeks.map((w) => w.weekKey)).toEqual(['2026-W38']);
    expect(third.body.nextBefore).toBeNull();
  });

  it('WIRE-2 — the scan cap: 26 in-play weeks then a settled one; the cursor is the LAST WEEK EXAMINED, so the next page reaches the settled week', async () => {
    // 27 weeks older than every fixture week: W27…W02 closed pools over pods
    // still in battle (in play → skipped), W01 resolved. `before` scopes the
    // walk to them.
    const inPlay = group({ status: GROUP_STATUS.BATTLE, dailyScores: {} });
    let initial = {};
    for (let n = 27; n >= 1; n -= 1) {
      const weekKey = `2025-W${String(n).padStart(2, '0')}`;
      const id = `g-old-${n}`;
      const resolved = n === 1;
      initial = { ...initial, ...pod(id, {
        status: resolved ? POOL_STATUS.RESOLVED : POOL_STATUS.CLOSED,
        g: resolved ? group() : inPlay,
        weekKey, monday: '2025-01-06',
        stakes: [{ id: `s-old-${n}`, userId: UID, teamOdUserId: 'od-a', amount: 10, ...(resolved ? { status: STAKE_STATUS.WON, payout: 10 } : {}) }],
        poolOver: resolved ? { winners: ['od-a'], paysX: 1, winningStakes: 10, settledAt: '2025-01-11T00:00:00.000Z' } : {},
      }) };
    }
    DB = makeInMemoryDb(initial);
    const first = await get({ limit: '1', before: '2026-W01' });
    expect(first.statusCode).toBe(200);
    expect(first.body.weeks).toEqual([]);
    expect(first.body.nextBefore).toBe('2025-W02');
    expect(first.body.weeksAvailable).toBe(27);
    const second = await get({ limit: '1', before: first.body.nextBefore });
    expect(second.body.weeks.map((w) => w.weekKey)).toEqual(['2025-W01']);
    expect(second.body.nextBefore).toBeNull();
    expect(spy.settlePool).not.toHaveBeenCalled();
  });

  it('a viewer with no stakes gets an empty page, and reads only their own stake query', async () => {
    state.uid = 'nobody';
    const res = await get();
    expect(res.body).toEqual({ viewerUid: 'nobody', weeks: [], nextBefore: null, weeksAvailable: 0 });
    expect(DB.readLog).toEqual([['get', BACKING_STAKES_COLLECTION]]);
  });

  it('the FREEZE holds across the whole page: no primitive call, W40 stays closed — and, its pod complete with nothing left to play, it IS listed, as settling (HON-R-1 / HON-R-3)', async () => {
    state.frozen = true;
    const res = await get();
    expect(spy.settlePool).not.toHaveBeenCalled();
    expect(poolOf('g-w40').status).toBe(POOL_STATUS.CLOSED);
    expect(res.body.weeks.map((w) => w.weekKey)).toEqual(['2026-W40', '2026-W39', '2026-W38']);
    expect(res.body.weeks[0].pools[0]).toMatchObject({ groupId: 'g-w40', outcome: 'settling', status: POOL_STATUS.CLOSED, podStatus: GROUP_STATUS.COMPLETE });
  });

  it('HON-R-3 — a LONE held pool of an older week is listed (as held): the only surface it has once Your Backing\'s window rolls', async () => {
    DB = makeInMemoryDb({
      ...pod('g-w40', { stakes: BOOK() }),
      ...pod('g-held', { status: POOL_STATUS.RESOLVING, weekKey: '2026-W37', monday: '2026-09-07', stakes: [{ id: 'h1', userId: UID, teamOdUserId: 'od-a', amount: 100 }], poolOver: { holdReason: 'agent_layer_absent', heldAt: '2026-09-11T22:00:00.000Z' } }),
    });
    const res = await get();
    expect(res.body.weeks.map((w) => w.weekKey)).toEqual(['2026-W40', '2026-W37']);
    expect(res.body.weeks[1].pools[0]).toMatchObject({ groupId: 'g-held', outcome: 'settling', status: POOL_STATUS.RESOLVING, holdReason: 'agent_layer_absent' });
    // The hold is the admin's: the pass never touched it.
    expect(poolOf('g-held').status).toBe(POOL_STATUS.RESOLVING);
  });
});
