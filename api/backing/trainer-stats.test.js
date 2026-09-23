// api/backing/trainer-stats.test.js
//
// GET /api/backing/trainer-stats — Backing Beta PR 5, TRAINER STATS, private,
// labeled "beta stats" (spec V1.3 §5, §8, D-w). Computed at read time from the
// stakes that name the viewer's seat, through the committed
// `(teamOdUserId, status)` composite; an admin-excluded stake is dropped.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the route's real import is the
// runtime guard for its api/ -> src/ imports. Never mock the constants.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const state = vi.hoisted(() => ({ flag: true, uid: 'me' }));
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
const { default: handler } = await import('./trainer-stats.js');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NOW = new Date('2026-10-05T14:00:00.000Z');
const resolved = { status: 'resolved', battleMondayEtDate: '2026-09-28', monthKey: '2026-09' };
const world = () => ({
  'backingStakes/a': { userId: 'u1', groupId: 'g-a', teamOdUserId: 'me', amount: 300, status: 'won', payout: 450, weekKey: '2026-W40' },
  'backingStakes/b': { userId: 'u2', groupId: 'g-a', teamOdUserId: 'me', amount: 100, status: 'won', payout: 150, weekKey: '2026-W40' },
  'backingStakes/c': { userId: 'u1', groupId: 'g-b', teamOdUserId: 'me', amount: 100, status: 'lost', payout: 0, weekKey: '2026-W39' },
  'backingStakes/d': { userId: 'u3', groupId: 'g-c', teamOdUserId: 'me', amount: 100, status: 'live', weekKey: '2026-W41' },
  'backingStakes/e': { userId: 'u4', groupId: 'g-a', teamOdUserId: 'me', amount: 500, status: 'won', payout: 750, weekKey: '2026-W40' },
  'backingStakes/e/private/meta': { ipHash: 'h', uaHash: 'h', excluded: true },
  'backingStakes/f': { userId: 'u5', groupId: 'g-d', teamOdUserId: 'me', amount: 100, status: 'voided', voidReason: 'insufficient', weekKey: '2026-W39' },
  'backingStakes/z': { userId: 'u1', groupId: 'g-a', teamOdUserId: 'someone-else', amount: 400, status: 'won', payout: 800, weekKey: '2026-W40' },
  'backingPools/g-a': resolved,
  'backingPools/g-b': { ...resolved, battleMondayEtDate: '2026-09-21' },
  'backingPools/g-c': { status: 'open', battleMondayEtDate: '2026-10-12' },
  'backingPools/g-d': { status: 'insufficient', battleMondayEtDate: '2026-09-21' },
});

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
async function get(query = {}, { method = 'GET' } = {}) {
  const res = mkRes();
  await handler({ method, headers: {}, query }, res);
  return res;
}

beforeEach(() => {
  state.flag = true; state.uid = 'me';
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
    state.uid = 'me'; state.flag = false;
    expect((await get()).statusCode).toBe(404);
    expect(DB.readLog).toEqual([]);
  });
});

describe('the trainer\'s three figures, season and career, labeled beta stats', () => {
  it('unique backers on the seat, BP backed on it, the backers\' net on it — the excluded stake dropped, the voided one never counted, another seat\'s stake never seen', async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ viewerUid: 'me', label: 'beta stats', seasonKey: '2026-10' });
    expect(res.body.career).toMatchObject({ uniqueBackers: 3, bpBacked: 600, backersNet: 100, pending: 100, poolsBackedOn: 3, stakes: 4, decidedStakes: 3 });
    expect(res.body.excludedStakes).toBe(1);
    expect(res.body.seasons['2026-09']).toMatchObject({ uniqueBackers: 2, bpBacked: 500, backersNet: 100, poolsBackedOn: 2 });
    expect(res.body.season).toMatchObject({ monthKey: '2026-10', uniqueBackers: 1, bpBacked: 100, pending: 100 });
    expect(JSON.stringify(res.body)).not.toContain('someone-else');
    expect(JSON.stringify(res.body)).not.toContain('800');
  });

  it('OWNER ONLY: the seat is the token\'s uid; a query parameter naming another seat is ignored', async () => {
    const own = await get();
    for (const query of [{ odUserId: 'someone-else' }, { uid: 'someone-else' }, { teamOdUserId: 'someone-else' }]) {
      expect((await get(query)).body).toEqual(own.body);
    }
    const stakeReads = DB.readLog.filter(([, p]) => p === 'backingStakes');
    expect(stakeReads.length).toBeGreaterThan(0);
  });

  it('reads the sealed meta of every counted stake (the exclusion flag) and the pools once each', async () => {
    await get();
    const metaReads = DB.readLog.filter(([, p]) => /^backingStakes\/[a-z]\/private\/meta$/.test(p)).map(([, p]) => p).sort();
    expect(metaReads).toEqual(['backingStakes/a/private/meta', 'backingStakes/b/private/meta', 'backingStakes/c/private/meta', 'backingStakes/d/private/meta', 'backingStakes/e/private/meta']);
    expect(DB.readLog.filter(([, p]) => p === 'backingPools/g-a')).toHaveLength(1);
  });

  it('the query is the committed (teamOdUserId, status) composite — firestore.indexes.json carries it', () => {
    const indexes = JSON.parse(readFileSync(path.join(REPO, 'firestore.indexes.json'), 'utf8'));
    const hit = indexes.indexes.find((ix) => ix.collectionGroup === 'backingStakes' && ix.fields.map((f) => f.fieldPath).join(',') === 'teamOdUserId,status');
    expect(hit).toBeDefined();
    expect(hit.queryScope).toBe('COLLECTION');
  });

  it('a seat nobody backed reads zeros; never a ranking word', async () => {
    state.uid = 'lonely';
    const res = await get();
    expect(res.body.career).toMatchObject({ uniqueBackers: 0, bpBacked: 0, backersNet: 0, pending: 0, poolsBackedOn: 0 });
    expect(JSON.stringify(res.body)).not.toMatch(/rank|leaderboard|position/i);
  });
});
