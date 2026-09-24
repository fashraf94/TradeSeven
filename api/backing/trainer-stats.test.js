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
// THE READS (the pre-flip fixes 2 review record): a close that lands between
// the stakes query and the pool read reveals nothing the close did not
// (SEAL-A1); what the reply COSTS — every read, in order — is identical
// whatever the open book holds (SEAL-A2); the seal never comes from an earlier
// week's pool or a dev pod (WIRE-A2, WIRE-A3); a pool this route reads past its
// close is closed by this route (PLACE-A3).
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
const G_C_CLOSES = '2026-10-12T03:59:00.000Z'; // g-c's pool closes Sunday 23:59 ET, before its battle Monday
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
  'backingPools/g-c': { status: 'open', battleMondayEtDate: '2026-10-12', closesAt: G_C_CLOSES },
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

  it('reads the sealed meta of every COUNTABLE stake (the exclusion flag) — never one on the open pool (SEAL-A2) — and the pools once each, writing nothing while no close is due', async () => {
    await get();
    const metaReads = DB.readLog.filter(([, p]) => /^backingStakes\/[a-z]\/private\/meta$/.test(p)).map(([, p]) => p).sort();
    expect(metaReads).toEqual(['backingStakes/a/private/meta', 'backingStakes/b/private/meta', 'backingStakes/c/private/meta', 'backingStakes/e/private/meta']);
    for (const poolPath of ['backingPools/g-a', 'backingPools/g-b', 'backingPools/g-c']) {
      expect(DB.readLog.filter(([, p]) => p === poolPath), poolPath).toHaveLength(1);
    }
    expect(DB.writeLog).toEqual([]);
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
        'backingPools/dev-g-dev': { status: 'open', battleMondayEtDate: '2026-10-12', closesAt: G_C_CLOSES, isDev: true },
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

describe('the trainer\'s reads — the pre-flip fixes 2 review (SEAL-A1, SEAL-A2, WIRE-A2, WIRE-A3, PLACE-A3)', () => {
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
  const OTHERS = { // three more backers on g-c's open book, beside stake d (u3 · 100): 4 human backers, 3 on the trainer
    'backingStakes/o1': { userId: 'u1', groupId: 'g-c', teamOdUserId: 'me', amount: 250, status: 'live', weekKey: '2026-W42' },
    'backingStakes/o3': { userId: 'u7', groupId: 'g-c', teamOdUserId: 'me', amount: 50, status: 'live', weekKey: '2026-W42' },
    'backingStakes/o4': { userId: 'u8', groupId: 'g-c', teamOdUserId: 'od-x', amount: 200, status: 'live', weekKey: '2026-W42' },
  };
  const LEFT = { groupMembers: ['od-x', 'cpu-1', 'cpu-2'], players: [{ odUserId: 'od-x' }, { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'cpu-2', isCpu: true }] };
  /** Run `first` (another request) at the Nth read of `backingPools/{id}` — after the stakes query, before this request reads that pool. */
  function onPoolRead(id, n, first) {
    const realCollection = DB.db.collection;
    const realDb = { ...DB.db, collection: realCollection };
    let reads = 0;
    DB.db.collection = (name) => {
      const col = realCollection(name);
      if (name !== 'backingPools') return col;
      return {
        ...col,
        doc: (docId) => {
          const ref = col.doc(docId);
          if (docId !== id) return ref;
          return { ...ref, get: async () => { if ((reads += 1) === n) await first(realDb); return ref.get(); } };
        },
      };
    };
  }
  const groupOf = (id) => ({ id, ...DB.store.get(`tournamentGroups/${id}`) });

  it('SEAL-A1 — ANOTHER request\'s close commits between the stakes query and the pool read: the live copies it voided (a seat that left, a pod deleted, below the floor) reach no figure — the reply is the one the close leaves, never "3 backers · 400 BP"', async () => {
    const CLOSE_AT = new Date('2026-10-12T04:00:00.000Z');
    const cases = {
      'the seat left, then the close (seat_left)': async (realDb) => {
        DB.store.set('tournamentGroups/g-c', { ...DB.store.get('tournamentGroups/g-c'), ...LEFT });
        await closePool(realDb, groupOf('g-c'), CLOSE_AT);
      },
      'the pod deleted, then the tombstone close (refunded)': async (realDb) => {
        DB.store.delete('tournamentGroups/g-c');
        await closePool(realDb, { id: 'g-c', isDev: false, missing: true }, CLOSE_AT);
      },
    };
    for (const [why, race] of Object.entries(cases)) {
      DB = makeInMemoryDb({ ...world(), ...OTHERS });
      onPoolRead('g-c', 1, race);
      const raced = await get();
      expect(raced.statusCode, why).toBe(200);
      expect(DB.store.get('backingPools/g-c').status, why).not.toBe('open');
      // The same store, read again now the close has landed: the reply the close leaves.
      const settled = (await get()).body;
      expect(walk(raced.body), why).toEqual(walk(settled));
      expect(raced.body.career, why).toMatchObject({ uniqueBackers: 2, bpBacked: 500, pending: 0, poolsBackedOn: 2 });
      expect(raced.body, why).not.toHaveProperty('thisWeek');
    }
    // Below the floor: the one stake on a thin book is voided `insufficient` — the copy counts nowhere.
    DB = makeInMemoryDb(world());
    onPoolRead('g-c', 1, async (realDb) => { await closePool(realDb, groupOf('g-c'), CLOSE_AT); });
    const thin = await get();
    expect(DB.store.get('backingPools/g-c').status).toBe('insufficient');
    expect(thin.body.career).toMatchObject({ uniqueBackers: 2, bpBacked: 500, pending: 0, poolsBackedOn: 2 });
    // Not vacuous: a close that KEEPS the seat (the book above the floor) reveals its figures in the same raced read.
    DB = makeInMemoryDb({ ...world(), ...OTHERS });
    onPoolRead('g-c', 1, async (realDb) => { await closePool(realDb, groupOf('g-c'), CLOSE_AT); });
    const kept = await get();
    expect(DB.store.get('backingPools/g-c').status).toBe('closed');
    expect(kept.body.career).toMatchObject({ uniqueBackers: 4, bpBacked: 900, pending: 400, poolsBackedOn: 3 });
  });

  it('SEAL-A2 — what the reply COSTS is the seal\'s, not the book\'s: every read, in order, is identical whatever the open pool holds — for a trainer with closed weeks, a first-week trainer, and a departed seat', async () => {
    const BOOKS = {
      empty: {},
      one: { 'backingStakes/d': world()['backingStakes/d'] },
      thick: { 'backingStakes/d': world()['backingStakes/d'], ...OTHERS, 'backingStakes/o1/private/meta': { ipHash: 'h', uaHash: 'h', excluded: true } },
    };
    const base = world();
    delete base['backingStakes/d'];
    const firstWeek = { 'tournamentGroups/g-c': base['tournamentGroups/g-c'], 'backingPools/g-c': base['backingPools/g-c'] };
    const trainers = {
      'closed weeks behind them': base,
      'a first week (nothing closed yet)': firstWeek,
      'a departed seat': { ...base, 'tournamentGroups/g-c': { ...base['tournamentGroups/g-c'], ...LEFT } },
    };
    for (const [who, store] of Object.entries(trainers)) {
      const logs = {};
      const bodies = {};
      for (const [book, stakes] of Object.entries(BOOKS)) {
        DB = makeInMemoryDb({ ...store, ...stakes });
        const res = await get();
        expect(res.statusCode).toBe(200);
        logs[book] = DB.readLog.map(([channel, p]) => `${channel} ${p}`);
        bodies[book] = walk(res.body);
      }
      expect(logs.one, `${who}: one backer`).toEqual(logs.empty);
      expect(logs.thick, `${who}: four backers, one excluded`).toEqual(logs.empty);
      expect(bodies.thick, who).toEqual(bodies.empty);
      // Never a read of an open pool's stake meta, never a pool read keyed on a stake of a departed seat.
      expect(logs.thick.filter((l) => /backingStakes\/(d|o\d)\//.test(l)), who).toEqual([]);
    }
  });

  it('WIRE-A2 — the seal is bounded to this week or later: an earlier week\'s pod whose pool no path closed never seals "next week" and is never read; forty old pods cost no pool read', async () => {
    const store = { ...world(), 'backingPools/g-c': { ...world()['backingPools/g-c'], status: 'closed', teams: [{ odUserId: 'me' }] } };
    store['tournamentGroups/g-w30'] = { ...world()['tournamentGroups/g-c'], status: 'voided', baseLayerWeek: '2026-W30' };
    store['backingPools/g-w30'] = { status: 'open', battleMondayEtDate: '2026-07-20', closesAt: '2026-07-20T03:59:00.000Z' };
    for (let w = 1; w <= 40; w += 1) store[`tournamentGroups/old-${w}`] = { ...world()['tournamentGroups/g-c'], status: 'complete', baseLayerWeek: `2025-W${String(w).padStart(2, '0')}` };
    DB = makeInMemoryDb(store);
    const res = await get();
    expect(res.body).not.toHaveProperty('thisWeek');
    expect(DB.readLog.filter(([, p]) => p === 'backingPools/g-w30' || p.startsWith('backingPools/old-'))).toEqual([]);
    expect(DB.store.get('backingPools/g-w30').status).toBe('open'); // never read, never written here
  });

  it('WIRE-A3 — a seated DEV pod with an open dev pool never seals the production record (the fold skips dev pools), and is never closed here', async () => {
    const store = { ...world(), 'backingPools/g-c': { ...world()['backingPools/g-c'], status: 'closed', teams: [{ odUserId: 'me' }] } };
    store['tournamentGroups/g-dev'] = { ...world()['tournamentGroups/g-c'], isDev: true };
    store['backingPools/dev-g-dev'] = { status: 'open', battleMondayEtDate: '2026-10-12', closesAt: G_C_CLOSES, isDev: true };
    DB = makeInMemoryDb(store);
    expect((await get()).body).not.toHaveProperty('thisWeek');
    vi.setSystemTime(new Date('2026-10-12T04:30:00.000Z'));
    DB = makeInMemoryDb(store);
    expect((await get()).body).not.toHaveProperty('thisWeek');
    expect(DB.writeLog).toEqual([]);
  });

  it('PLACE-A3 — a pool this route reads past its close is CLOSED by this route (the lazy close every pool reader runs): the seal lifts and the figures appear at the close, not when another reader happens by', async () => {
    DB = makeInMemoryDb({ ...world(), ...OTHERS });
    expect((await get()).body.thisWeek).toEqual({ sealed: true });
    vi.setSystemTime(new Date('2026-10-12T04:30:00.000Z')); // Monday 00:30 ET — g-c's close has passed; nobody else has read it
    const res = await get();
    expect(DB.store.get('backingPools/g-c').status).toBe('closed');
    expect(res.body).not.toHaveProperty('thisWeek');
    expect(res.body.career).toMatchObject({ uniqueBackers: 4, bpBacked: 900, pending: 400, poolsBackedOn: 3 });
    expect(res.body.season).toMatchObject({ monthKey: '2026-10', uniqueBackers: 3, bpBacked: 400, pending: 400, poolsBackedOn: 1 });
  });

  it('PLACE-A3 — a close that FAILS is logged and the pool re-read: still open → still sealed (never a figure); committed before the failure → the reveal', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.setSystemTime(new Date('2026-10-12T04:30:00.000Z'));
    // The transaction never commits: the re-read pool is still open — sealed, and no figure of it.
    DB = makeInMemoryDb({ ...world(), ...OTHERS });
    DB.db.runTransaction = async () => { throw new Error('contention'); };
    const failed = await get();
    expect(failed.statusCode).toBe(200);
    expect(failed.body.thisWeek).toEqual({ sealed: true });
    expect(failed.body.career).toMatchObject({ uniqueBackers: 2, bpBacked: 500, pending: 0, poolsBackedOn: 2 });
    expect(console.warn).toHaveBeenCalled();
    expect(DB.readLog.filter(([, p]) => p === 'backingPools/g-c').length).toBeGreaterThanOrEqual(2);
    // The transaction commits, then its acknowledgement is lost: the re-read pool is closed — the reveal, no seal.
    DB = makeInMemoryDb({ ...world(), ...OTHERS });
    const realTx = DB.db.runTransaction;
    DB.db.runTransaction = async (fn) => { await realTx(fn); throw new Error('ack lost'); };
    const lost = await get();
    expect(DB.store.get('backingPools/g-c').status).toBe('closed');
    expect(lost.body).not.toHaveProperty('thisWeek');
    expect(lost.body.career).toMatchObject({ uniqueBackers: 4, bpBacked: 900, pending: 400 });
    // A re-read that fails too is the request's 500 — never an answer built on a guess. (g-c's
    // pool is read by round 2, then by ensureClosed's own cheap read, then re-read: the third.)
    DB = makeInMemoryDb({ ...world(), ...OTHERS });
    DB.db.runTransaction = async () => { throw new Error('contention'); };
    onPoolRead('g-c', 3, async () => { throw new Error('unavailable'); });
    expect((await get()).statusCode).toBe(500);
  });
});
