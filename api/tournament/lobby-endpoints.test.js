// api/tournament/lobby-endpoints.test.js
//
// P10b — the authed, flag-gated lobby-* endpoints, end to end over the REAL
// P10a service against an in-memory Firestore (the proven tournamentLobbyService
// harness). Covers: the flag gate (refuses when off), auth, the method guard,
// quick-play solo formation, the join/matchmake fill-the-4th-seat formation
// trigger, join-code resolution (and honest no-match), "Start now" ownership,
// and the universe_unavailable -> 503 mapping (S5).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL import of the
// endpoint modules is the runtime guard for their api/ -> src/ import surface
// (lobbyEndpoint.js -> src/config/featureFlags.js; tournamentLobbyService.js ->
// src/constants/leagueTournament.js + tournamentCpu.js). Only the admin/auth
// boundary and the (zero-import) flag are mocked; the service graph is real.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ flag: true, db: null, user: { uid: 'u1', name: 'Ada' } }));

vi.mock('../../src/config/featureFlags.js', () => ({
  get LEAGUE_LOBBY_ENABLED() { return h.flag; },
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (h.user) return h.user;
    res.status(401).json({ error: 'Authentication required' });
    return null;
  },
}));

import quickplayHandler from './lobby-quickplay.js';
import createHandler from './lobby-create.js';
import joinHandler from './lobby-join.js';
import matchmakeHandler from './lobby-matchmake.js';
import formHandler from './lobby-form.js';
import { createLobby, joinLobby } from '../_utils/tournamentLobbyService.js';
import { LOBBY_STATUS, LOBBY_MODE, GROUP_STATUS, GROUP_SIZE } from '../../src/constants/leagueTournament.js';

// ==================== IN-MEMORY FIRESTORE (the lobby-service harness) ====================
function applyDotPathUpdate(target, updates) {
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split('.');
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] == null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
}
function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  let autoSeq = 0;
  function makeDocRef(path) {
    return {
      path,
      id: path.split('/').pop(),
      get: async () => {
        const data = store.get(path);
        return { exists: data !== undefined, id: path.split('/').pop(), data: () => structuredClone(data) };
      },
      set: async (data) => { store.set(path, structuredClone(data)); },
      update: async (updates) => {
        const data = store.get(path);
        if (data === undefined) throw new Error(`update on missing doc ${path}`);
        applyDotPathUpdate(data, updates);
      },
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
  }
  function topLevelDocs(prefix) {
    const docs = [];
    for (const [path, data] of store.entries()) {
      if (!path.startsWith(`${prefix}/`)) continue;
      const rel = path.slice(prefix.length + 1);
      if (rel.includes('/')) continue;
      docs.push({ id: rel, data: () => structuredClone(data) });
    }
    return docs;
  }
  function snapshotOf(docs) {
    return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
  }
  function makeCollection(prefix) {
    const filtered = (field, value) => topLevelDocs(prefix).filter(d => d.data()[field] === value);
    return {
      doc: (id) => makeDocRef(`${prefix}/${id ?? `auto-${++autoSeq}`}`),
      where: (field, op, value) => ({
        get: async () => snapshotOf(filtered(field, value)),
        limit: (n) => ({ get: async () => snapshotOf(filtered(field, value).slice(0, n)) }),
        select: () => ({ get: async () => snapshotOf(filtered(field, value)) }),
      }),
      get: async () => snapshotOf(topLevelDocs(prefix)),
    };
  }
  const db = {
    collection: (name) => makeCollection(name),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      getAll: async (...refs) => Promise.all(refs.map(r => r.get())),
      set: (ref, data) => { store.set(ref.path, structuredClone(data)); },
      update: (ref, updates) => {
        const data = store.get(ref.path);
        if (data === undefined) throw new Error(`tx.update on missing doc ${ref.path}`);
        applyDotPathUpdate(data, updates);
      },
    }),
  };
  return { db, store };
}
const STOCKS = Array.from({ length: 40 }, (_, i) => ({ symbol: `SYM${i}` }));
const NOW = new Date('2026-06-10T15:00:00.000Z');
function withRankings(initial = {}) {
  return makeDb({ 'indexIntelligence/stockRankings': { stocks: STOCKS }, ...initial });
}
function makeReqRes(body = {}, { method = 'POST' } = {}) {
  const req = { method, headers: {}, body };
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.body = p; return res; };
  return { req, res };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  h.flag = true;
  h.user = { uid: 'u1', name: 'Ada' };
  h.db = null;
});
afterEach(() => vi.restoreAllMocks());

// ==================== THE GATE (flag / auth / method) ====================
describe('the wrapper gate', () => {
  it('refuses EVERY lobby endpoint with 404 lobby_disabled while the flag is off', async () => {
    h.flag = false;
    h.db = withRankings().db;
    for (const handler of [quickplayHandler, createHandler, joinHandler, matchmakeHandler, formHandler]) {
      const { req, res } = makeReqRes({ lobbyId: 'x' });
      await handler(req, res);
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('lobby_disabled');
    }
  });

  it('refuses without auth (401) and on a non-POST method (405)', async () => {
    h.db = withRankings().db;
    h.user = null;
    const noAuth = makeReqRes();
    await quickplayHandler(noAuth.req, noAuth.res);
    expect(noAuth.res.statusCode).toBe(401);

    h.user = { uid: 'u1', name: 'Ada' };
    const wrongMethod = makeReqRes({}, { method: 'GET' });
    await quickplayHandler(wrongMethod.req, wrongMethod.res);
    expect(wrongMethod.res.statusCode).toBe(405);
  });
});

// ==================== QUICK PLAY (solo formation) ====================
describe('lobby-quickplay', () => {
  it('forms a solo CPU-padded base-layer group, production (no isDev)', async () => {
    const { db, store } = withRankings();
    h.db = db;
    const { req, res } = makeReqRes({ displayName: 'Ada' });
    await quickplayHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.groupId).toBe(res.body.lobbyId);
    expect(res.body.cpuNs).toEqual([1, 2, 3]);

    const group = store.get(`tournamentGroups/${res.body.groupId}`);
    expect(group.status).toBe(GROUP_STATUS.FORMING);
    expect(group.players).toHaveLength(GROUP_SIZE);
    expect(group.players[0].odUserId).toBe('u1');
    expect(group).not.toHaveProperty('isDev'); // production scope
    expect(store.get(`tournamentLobby/${res.body.lobbyId}`).status).toBe(LOBBY_STATUS.FORMED);
  });

  it('maps a below-floor universe to an HONEST 503 (never a 500)', async () => {
    h.db = makeDb({ 'indexIntelligence/stockRankings': { stocks: STOCKS.slice(0, 5) } }).db;
    const { req, res } = makeReqRes();
    await quickplayHandler(req, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe('universe_unavailable');
  });
});

// ==================== CREATE ====================
describe('lobby-create', () => {
  it('opens a PRIVATE lobby with a shareable join code (default), no forming', async () => {
    const { db } = withRankings();
    h.db = db;
    const { req, res } = makeReqRes({ displayName: 'Ada' });
    await createHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lobby.mode).toBe(LOBBY_MODE.PRIVATE);
    expect(res.body.lobby.status).toBe(LOBBY_STATUS.OPEN);
    expect(res.body.lobby.joinCode).toMatch(/^[A-Z2-9]{6}$/);
  });
});

// ==================== JOIN (by id, by code, and the fill-4th-seat form) ====================
describe('lobby-join', () => {
  it('joins an open lobby by id and stays waiting (no form before 4)', async () => {
    const { db } = withRankings();
    h.db = db;
    const seed = await createLobby(db, { createdBy: 'host', mode: LOBBY_MODE.MATCHMAKING, now: NOW });
    const { req, res } = makeReqRes({ lobbyId: seed.id });
    await joinHandler(req, res); // u1 joins
    expect(res.statusCode).toBe(200);
    expect(res.body.joined).toBe(true);
    expect(res.body.full).toBe(false);
    expect(res.body.formed).toBeNull();
  });

  it('FORMS synchronously when the join seats the 4th human (no cron)', async () => {
    const { db, store } = withRankings();
    h.db = db;
    const seed = await createLobby(db, { createdBy: 'h1', mode: LOBBY_MODE.MATCHMAKING, now: NOW });
    await joinLobby(db, seed.id, { odUserId: 'h2', now: NOW });
    await joinLobby(db, seed.id, { odUserId: 'h3', now: NOW });
    const { req, res } = makeReqRes({ lobbyId: seed.id }); // u1 is the 4th
    await joinHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.full).toBe(true);
    expect(res.body.formed.groupId).toBe(seed.id);
    const group = store.get(`tournamentGroups/${seed.id}`);
    expect(group.players.map(p => p.odUserId)).toEqual(['h1', 'h2', 'h3', 'u1']);
    expect(group.players.some(p => p.isCpu)).toBe(false);
  });

  it('resolves a typed join code, and 404s an unknown one (honest no-match)', async () => {
    const { db } = withRankings();
    h.db = db;
    const seed = await createLobby(db, { createdBy: 'host', mode: LOBBY_MODE.PRIVATE, now: NOW });
    const ok = makeReqRes({ joinCode: seed.doc.joinCode.toLowerCase() });
    await joinHandler(ok.req, ok.res);
    expect(ok.res.statusCode).toBe(200);
    expect(ok.res.body.joined).toBe(true);

    const bad = makeReqRes({ joinCode: 'ZZZZZZ' });
    await joinHandler(bad.req, bad.res);
    expect(bad.res.statusCode).toBe(404);
    expect(bad.res.body.error).toBe('code_not_found');
  });

  it('400s when neither a lobbyId nor a code is supplied', async () => {
    h.db = withRankings().db;
    const { req, res } = makeReqRes({});
    await joinHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('missing_target');
  });
});

// ==================== MATCHMAKE ====================
describe('lobby-matchmake', () => {
  it('opens a fresh lobby when none are joinable (created, still waiting)', async () => {
    const { db } = withRankings();
    h.db = db;
    const { req, res } = makeReqRes();
    await matchmakeHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.created).toBe(true);
    expect(res.body.formed).toBeNull();
  });

  it('FORMS when matchmaking seats the 4th human', async () => {
    const { db, store } = withRankings();
    h.db = db;
    const seed = await createLobby(db, { createdBy: 'm1', mode: LOBBY_MODE.MATCHMAKING, now: NOW });
    await joinLobby(db, seed.id, { odUserId: 'm2', now: NOW });
    await joinLobby(db, seed.id, { odUserId: 'm3', now: NOW });
    const { req, res } = makeReqRes(); // u1 fills it
    await matchmakeHandler(req, res);
    expect(res.body.full).toBe(true);
    expect(res.body.formed.groupId).toBe(seed.id);
    expect(store.get(`tournamentLobby/${seed.id}`).status).toBe(LOBBY_STATUS.FORMED);
  });
});

// ==================== FORM ("Start now", owner-only) ====================
describe('lobby-form', () => {
  it('only the creator can start it (403 for a non-owner)', async () => {
    const { db } = withRankings();
    h.db = db;
    const seed = await createLobby(db, { createdBy: 'owner-x', mode: LOBBY_MODE.PRIVATE, now: NOW });
    h.user = { uid: 'someone-else', name: 'Mallory' };
    const { req, res } = makeReqRes({ lobbyId: seed.id });
    await formHandler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('not_lobby_owner');
  });

  it('the creator starts now → a CPU-padded group forms', async () => {
    const { db, store } = withRankings();
    h.db = db;
    const seed = await createLobby(db, { createdBy: 'u1', mode: LOBBY_MODE.PRIVATE, now: NOW });
    const { req, res } = makeReqRes({ lobbyId: seed.id });
    await formHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.groupId).toBe(seed.id);
    expect(res.body.cpuNs).toEqual([1, 2, 3]);
    expect(store.get(`tournamentLobby/${seed.id}`).status).toBe(LOBBY_STATUS.FORMED);
  });

  it('404s a missing lobby', async () => {
    h.db = withRankings().db;
    const { req, res } = makeReqRes({ lobbyId: 'does-not-exist' });
    await formHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('lobby_not_found');
  });
});
