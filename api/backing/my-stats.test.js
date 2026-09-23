// api/backing/my-stats.test.js
//
// GET /api/backing/my-stats — Backing Beta PR 5, MY BACKING STATS (spec V1.3
// §5, §10 the baseline, D-v). THE ROW THIS FILE EXISTS FOR: OWNER ONLY —
// another user's stakes and wallet are seeded beside the viewer's and never
// appear; a `uid` query parameter is ignored (mutation check 5 reds it).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the route's real import is the
// runtime guard for its api/ -> src/ imports. Never mock the constants.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ flag: true, uid: 'viewer-1' }));
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
}));
let DB = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => DB.db }));

const { makeInMemoryDb } = await import('../_utils/__fixtures__/inMemoryFirestore.js');
const { default: handler } = await import('./my-stats.js');

const UID = 'viewer-1';
const OTHER = 'rival-9';
const NOW = new Date('2026-10-05T14:00:00.000Z');
const resolved = (over = {}) => ({
  status: 'resolved', battleMondayEtDate: '2026-09-28', monthKey: '2026-09', closedAt: '2026-09-28T04:00:00.000Z', settledAt: '2026-10-02T22:30:00.000Z',
  winnerOdUserIds: ['od-a'], teams: [{ odUserId: 'od-a', isCpu: false }, { odUserId: 'od-b', isCpu: false }, { odUserId: 'cpu-1', isCpu: true }], ...over,
});
const world = () => ({
  [`backingWallets/${UID}`]: { careerNet: 250, seasons: { '2026-09': { net: 250 } }, allowanceRemaining: 400, lastAllowanceWeek: '2026-W41', appliedEntries: {} },
  [`backingWallets/${OTHER}`]: { careerNet: -900, seasons: { '2026-09': { net: -900 } }, allowanceRemaining: 0, lastAllowanceWeek: '2026-W41', appliedEntries: {} },
  'backingStakes/v1': { userId: UID, groupId: 'g-a', teamOdUserId: 'od-a', amount: 250, status: 'won', payout: 500, weekKey: '2026-W40' },
  'backingStakes/v2': { userId: UID, groupId: 'g-b', teamOdUserId: 'od-b', amount: 100, status: 'lost', payout: 0, weekKey: '2026-W40' },
  'backingStakes/v3': { userId: UID, groupId: 'g-c', teamOdUserId: 'od-a', amount: 100, status: 'live', weekKey: '2026-W41' },
  'backingStakes/r1': { userId: OTHER, groupId: 'g-a', teamOdUserId: 'od-b', amount: 500, status: 'lost', payout: 0, weekKey: '2026-W40' },
  'backingStakes/r2': { userId: OTHER, groupId: 'g-x', teamOdUserId: 'od-a', amount: 400, status: 'lost', payout: 0, weekKey: '2026-W39' },
  'backingPools/g-a': resolved(),
  'backingPools/g-b': resolved({ winnerOdUserIds: ['od-a'], teams: [{ odUserId: 'od-p' }, { odUserId: 'od-q' }] }),
  'backingPools/g-c': { status: 'open', battleMondayEtDate: '2026-10-12' },
  'backingPools/g-x': resolved(),
  'tournamentRanks/od-a': { history: [{ groupId: 'g-old', placement: 2, appliedAt: '2026-09-18T21:00:00.000Z' }, { groupId: 'g-a', placement: 1, appliedAt: '2026-10-02T21:00:00.000Z' }] },
  'tournamentRanks/od-b': { history: [{ groupId: 'g-old2', placement: 1, appliedAt: '2026-09-18T21:00:00.000Z' }] },
});

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
async function get(query = {}, { method = 'GET' } = {}) {
  const res = mkRes();
  await handler({ method, headers: {}, query }, res);
  return res;
}

beforeEach(() => {
  state.flag = true; state.uid = UID;
  DB = makeInMemoryDb(world());
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('the pipeline, in order', () => {
  it('405s anything but GET; 401s BEFORE the flag; 404s while dark AFTER auth, reading nothing', async () => {
    expect((await get({}, { method: 'POST' })).statusCode).toBe(405);
    state.uid = null;
    expect((await get()).statusCode).toBe(401);
    state.uid = UID; state.flag = false;
    const res = await get();
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(DB.readLog).toEqual([]);
  });
});

describe('OWNER ONLY — the token is the only identity (mutation check 5)', () => {
  it('returns the viewer\'s OWN record: their wallet\'s net, their pools, their accuracy — and nothing of the other user\'s', async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    // Net BP follows §2's one definition in both columns: the live 100 on
    // October's pod (g-c) is counted from placement — career carries it in the
    // wallet's debit, the season subtracts it here (HON-4).
    expect(res.body).toMatchObject({ viewerUid: UID, label: 'beta stats', seasonKey: '2026-10', net: { career: 250, season: -100 }, excludedStakes: 0 });
    expect(res.body.season).toMatchObject({ pending: 1, inPlayBp: 100, net: -100 });
    expect(res.body.career).toMatchObject({ poolsBacked: 2, poolsWon: 1, weeksPlayed: 1, pending: 1, net: 250, stakedBp: 350, paidBp: 500 });
    expect(res.body.seasons['2026-09']).toMatchObject({ net: 250, poolsBacked: 2, poolsWon: 1 });
    // Accuracy: g-a — priors od-a 2 (g-old), od-b 1 → baseline od-b, winner od-a; viewer backed od-a → youWon 1, baselineWon 0.
    //           g-b — teams od-p / od-q have no rank docs → EXCLUDED.
    expect(res.body.accuracy.career).toEqual({ pools: 1, youWon: 1, baselineWon: 0, both: 0, excluded: 1 });
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(OTHER);
    expect(text).not.toContain('-900');
    expect(text).not.toContain('g-x');
    expect(res.body.career.poolsBacked).not.toBe(3);
  });

  it('a `uid` / `userId` / `odUserId` query parameter is IGNORED — the caller gets their own record, byte for byte', async () => {
    const own = await get();
    for (const query of [{ uid: OTHER }, { userId: OTHER }, { odUserId: OTHER }, { viewerUid: OTHER }]) {
      const res = await get(query);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(own.body);
      expect(JSON.stringify(res.body)).not.toContain(OTHER);
    }
  });

  it('reads the viewer\'s wallet and the viewer\'s stake query only — never the other user\'s wallet', async () => {
    await get();
    const walletReads = DB.readLog.filter(([, p]) => p.startsWith('backingWallets/')).map(([, p]) => p);
    expect(walletReads).toEqual([`backingWallets/${UID}`]);
    expect(DB.readLog.some(([, p]) => p === `backingWallets/${OTHER}`)).toBe(false);
  });

  it('an admin-EXCLUDED stake leaves the viewer\'s stats AND their net (§8; HON-5): the won stake on g-a drops out of the counts, the accuracy and both nets', async () => {
    DB = makeInMemoryDb({ ...world(), 'backingStakes/v1/private/meta': { ipHash: 'x', uaHash: 'y', excluded: true, at: 'x' } });
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.excludedStakes).toBe(1);
    // g-a had only the excluded stake → no longer a pool backed or won; g-b stays.
    expect(res.body.career).toMatchObject({ poolsBacked: 1, poolsWon: 0, stakedBp: 100, paidBp: 0 });
    // The wallet's +250 from v1 (500 paid on 250) is taken back out of career and of September.
    expect(res.body.net).toEqual({ career: 0, season: -100 });
    expect(res.body.seasons['2026-09'].net).toBe(0);
    // Its pool leaves the accuracy count too (g-b remains EXCLUDED for want of history).
    expect(res.body.accuracy.career).toEqual({ pools: 0, youWon: 0, baselineWon: 0, both: 0, excluded: 1 });
  });

  it('a viewer with nothing gets zeros — not the other user\'s figures, not a 404', async () => {
    state.uid = 'newcomer';
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ viewerUid: 'newcomer', net: { career: 0, season: 0 }, career: { poolsBacked: 0, poolsWon: 0, weeksPlayed: 0 } });
    expect(res.body.accuracy.career).toEqual({ pools: 0, youWon: 0, baselineWon: 0, both: 0, excluded: 0 });
  });

  it('never a ranking: the body carries no rank, position, leaderboard or other players\' names', async () => {
    const res = await get();
    expect(JSON.stringify(res.body)).not.toMatch(/rank|position|leaderboard|percentile/i);
  });

  it('500s on a failing read with a generic body', async () => {
    DB.db.collection = () => { throw new Error('Firestore is on fire'); };
    const res = await get();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'server_error', message: 'Could not load your backing record.' });
  });
});
