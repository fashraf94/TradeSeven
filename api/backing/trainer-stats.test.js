// api/backing/trainer-stats.test.js
//
// GET /api/backing/trainer-stats — Backing Beta PR 5, TRAINER STATS, private,
// labeled "beta stats" (spec V1.3 §5, §8, D-w). Computed at read time from the
// stakes that name the viewer's seat, through the committed
// `(teamOdUserId, status)` composite; an admin-excluded stake is dropped.
//
// CLOSED WEEKS ONLY (SEAL-1, the desktop review record): an OPEN pool is
// sealed even to the trainer. The seal rows walk the WHOLE reply by key —
// every path and every value — and demand it be identical whatever the open
// pool's book holds, with `thisWeek: { sealed: true }` read from the pool,
// never from the stakes (SEAL-R-2); then close the pool (the real close) and
// watch the figures arrive. MUTATION CHECK (the build's A): an open pool
// counted reds the walk row.
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
const { closePool } = await import('../_utils/backingPools.js');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NOW = new Date('2026-10-05T14:00:00.000Z');
const resolved = { status: 'resolved', battleMondayEtDate: '2026-09-28', monthKey: '2026-09' };
// The trainer's own pod for next week — g-c, whose pool is OPEN (stake d rides on it).
const seatedPod = (over = {}) => ({
  status: 'forming', baseLayerWeek: '2026-W42', isLiveDraft: false,
  groupMembers: ['me', 'od-x', 'cpu-1', 'cpu-2'],
  players: [{ odUserId: 'me' }, { odUserId: 'od-x' }, { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'cpu-2', isCpu: true }],
  ...over,
});
const world = () => ({
  'tournamentGroups/g-c': seatedPod(),
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
  it('unique backers on the seat, BP backed on it, the backers\' net on it — the excluded stake dropped, the voided one never counted, another seat\'s stake never seen, the OPEN pool\'s stake never read (SEAL-1)', async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ viewerUid: 'me', label: 'beta stats', seasonKey: '2026-10' });
    // Stake d rides on g-c, an OPEN pool: before SEAL-1 it counted (3 backers,
    // 600 BP, 100 BP in play on 3 pools; October 1 · 100) — the trainer's own sealed book.
    expect(res.body.career).toMatchObject({ uniqueBackers: 2, bpBacked: 500, backersNet: 100, pending: 0, poolsBackedOn: 2, stakes: 3, decidedStakes: 3 });
    expect(res.body.excludedStakes).toBe(1);
    expect(res.body.seasons['2026-09']).toMatchObject({ uniqueBackers: 2, bpBacked: 500, backersNet: 100, poolsBackedOn: 2 });
    expect(res.body.season).toMatchObject({ monthKey: '2026-10', uniqueBackers: 0, bpBacked: 0, pending: 0 });
    // …and says so, from the pool: this week is sealed.
    expect(res.body.thisWeek).toEqual({ sealed: true });
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

describe('SEAL-1 — closed weeks only: a trainer with an OPEN pool sees no live figure anywhere in the reply (the desktop review record)', () => {
  /** The WHOLE reply as [path, value] pairs, keys sorted at every level — nothing skipped, nothing spot-checked. */
  const walk = (value, at = '$', out = []) => {
    if (value !== null && typeof value === 'object') {
      const keys = Object.keys(value).sort();
      if (keys.length === 0) out.push([at, Array.isArray(value) ? '[]' : '{}']);
      for (const key of keys) walk(value[key], `${at}.${key}`, out);
    } else {
      out.push([at, value]);
    }
    return out;
  };
  /** The base world with g-c's OPEN book replaced by `book` (stake d is its first entry in the base world). */
  const withBook = (book, over = {}) => {
    const w = { ...world(), ...over };
    delete w['backingStakes/d'];
    for (const [id, stake, excluded] of book) {
      w[`backingStakes/${id}`] = { groupId: 'g-c', weekKey: '2026-W42', status: 'live', ...stake };
      if (excluded) w[`backingStakes/${id}/private/meta`] = { ipHash: 'h', uaHash: 'h', excluded: true };
    }
    return w;
  };
  const BOOKS = {
    empty: [],
    one: [['d', { userId: 'u3', teamOdUserId: 'me', amount: 100 }]],
    thick: [
      ['d', { userId: 'u3', teamOdUserId: 'me', amount: 100 }],
      ['o1', { userId: 'u1', teamOdUserId: 'me', amount: 250 }],        // a backer from the closed weeks, again
      ['o2', { userId: 'u6', teamOdUserId: 'me', amount: 500 }, true],  // admin-excluded
      ['o3', { userId: 'u7', teamOdUserId: 'me', amount: 50 }],
      ['o4', { userId: 'u8', teamOdUserId: 'od-x', amount: 200 }],      // another team in the pod
    ],
  };
  const replyFor = async (store) => { DB = makeInMemoryDb(store); const res = await get(); expect(res.statusCode).toBe(200); return res.body; };

  it('the whole reply, walked by key, is IDENTICAL whatever the open pool\'s book holds — nobody, one backer, five with one excluded, an open dev pool beside it — and carries the seal instead', async () => {
    const empty = await replyFor(withBook(BOOKS.empty));
    expect(empty.thisWeek).toEqual({ sealed: true });
    const paths = walk(empty).map(([p]) => p);
    expect(paths).toContain('$.thisWeek.sealed');
    for (const [name, store] of [
      ['one backer', withBook(BOOKS.one)],
      ['five backers, one excluded', withBook(BOOKS.thick)],
      ['an open DEV pod beside it, staked', withBook(BOOKS.thick, {
        'tournamentGroups/g-dev': seatedPod({ isDev: true }),
        'backingPools/dev-g-dev': { status: 'open', battleMondayEtDate: '2026-10-12', isDev: true },
        'backingStakes/dv': { userId: 'u9', groupId: 'g-dev', teamOdUserId: 'me', amount: 300, status: 'live', weekKey: '2026-W42' },
      })],
    ]) {
      const body = await replyFor(store);
      expect(walk(body), `${name}: a sealed figure moved the reply`).toEqual(walk(empty));
    }
    // Not vacuous: the reply does carry the closed weeks' figures.
    expect(empty.career).toMatchObject({ uniqueBackers: 2, bpBacked: 500, backersNet: 100 });
  });

  it('the figures appear once the pool CLOSES (the real close): the open book counts, and the seal is gone', async () => {
    DB = makeInMemoryDb(withBook(BOOKS.thick));
    expect((await get()).body.career).toMatchObject({ uniqueBackers: 2, bpBacked: 500, pending: 0, poolsBackedOn: 2 });
    const closed = await closePool(DB.db, { id: 'g-c', ...DB.store.get('tournamentGroups/g-c') }, new Date('2026-10-12T04:00:00.000Z'));
    expect(closed).toMatchObject({ closed: true, status: 'closed' });
    const res = await get();
    expect(res.body).not.toHaveProperty('thisWeek');
    // d (u3, 100), o1 (u1, 250) and o3 (u7, 50) are in play on the trainer; o2 stays excluded; o4 is another team's.
    expect(res.body.career).toMatchObject({ uniqueBackers: 4, bpBacked: 900, pending: 400, poolsBackedOn: 3, stakes: 6 });
    expect(res.body.excludedStakes).toBe(2);
    expect(res.body.season).toMatchObject({ monthKey: '2026-10', uniqueBackers: 3, bpBacked: 400, pending: 400, poolsBackedOn: 1 });
  });

  it('the seal is the POOL\'s fact, never the stakes\' (SEAL-R-2): seated in an open pool nobody backed → sealed; a seat LEFT → neither a figure nor the seal', async () => {
    // Nobody has staked on the trainer this week, and it still says sealed.
    const nobody = await replyFor(withBook(BOOKS.empty));
    expect(nobody.thisWeek).toEqual({ sealed: true });
    // The trainer LEFT g-c (a slot pod before its fire): the stakes on the
    // departed seat are voided at the close and never count; nothing here
    // may say they exist — no figure, and no seal keyed on them.
    const leftPod = { 'tournamentGroups/g-c': seatedPod({ groupMembers: ['od-x', 'cpu-1', 'cpu-2'], players: [{ odUserId: 'od-x' }, { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'cpu-2', isCpu: true }] }) };
    const leftEmpty = await replyFor(withBook(BOOKS.empty, leftPod));
    const leftThick = await replyFor(withBook(BOOKS.thick, leftPod));
    expect(leftEmpty).not.toHaveProperty('thisWeek');
    expect(walk(leftThick)).toEqual(walk(leftEmpty));
  });
});
