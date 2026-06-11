// api/tournament/reconcile-ledger.test.js
//
// Manual reconciliation trigger — the preview smoke path for the P2 agent
// held-set ledger. Locks the admin gate, the guard sentinels, and the happy
// path's derived rebuild (divergence report + corrected sibling doc).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of the REAL endpoint
// module below is the runtime guard for its api/ -> src/ import chain
// (leagueTournament.js via tournamentAgentLedger.js and the group service) —
// it explodes in this Node test environment if a browser-only dependency
// ever enters the graph. Never mock that part of the graph.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));

import handler from './reconcile-ledger.js';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';

const SECRET = 'test-admin-secret';
const LEDGER_KEY = 'group-1/ledger/agentHeldSet';

function makeDb({ groupDoc = null, agentBattles = [], ledgerDocs = {} } = {}) {
  const captured = { txSets: [] };
  const db = {
    collection: (name) => ({
      where: () => {
        const runQuery = async () => ({
          docs: [],
          forEach: (cb) => (name === 'agentBattles' ? agentBattles : []).forEach(d => cb({ id: d.id, data: () => d.data })),
        });
        // select() is a field-mask hint — the fake returns full docs.
        return { get: runQuery, select: () => ({ get: runQuery }) };
      },
      doc: (id) => ({
        get: async () => ({ id: 'group-1', exists: groupDoc != null, data: () => groupDoc }),
        collection: (sub) => ({
          doc: (subId) => ({
            get: async () => {
              const key = `${id}/${sub}/${subId}`;
              return { exists: ledgerDocs[key] != null, data: () => ledgerDocs[key] };
            },
          }),
        }),
      }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      set: (_ref, data) => { captured.txSets.push(data); },
    }),
  };
  return { db, captured };
}

function makeReqRes(body = {}, headers = {}) {
  const req = { method: 'POST', headers: { 'x-admin-secret': SECRET, ...headers }, body };
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return { req, res };
}

function battleGroup(overrides = {}) {
  return {
    status: 'battle',
    groupMembers: ['u1', 'u2', 'u3', 'u4'],
    players: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv('ADMIN_SECRET', SECRET);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('guards', () => {
  it('405 on non-POST, 401 without the admin secret, 400 on a malformed groupId', async () => {
    h.db = makeDb().db;

    const get = makeReqRes();
    get.req.method = 'GET';
    await handler(get.req, get.res);
    expect(get.res.statusCode).toBe(405);

    const unauth = makeReqRes({ groupId: 'group-1' }, { 'x-admin-secret': 'wrong' });
    await handler(unauth.req, unauth.res);
    expect(unauth.res.statusCode).toBe(401);

    const bad = makeReqRes({ groupId: 'no spaces allowed!' });
    await handler(bad.req, bad.res);
    expect(bad.res.statusCode).toBe(400);
    expect(bad.res.body.error).toBe('invalid_group_id');
  });

  it('404 on a missing group, 409 on a group not in battle', async () => {
    h.db = makeDb().db;
    const missing = makeReqRes({ groupId: 'group-1' });
    await handler(missing.req, missing.res);
    expect(missing.res.statusCode).toBe(404);

    h.db = makeDb({ groupDoc: battleGroup({ status: 'forming' }) }).db;
    const forming = makeReqRes({ groupId: 'group-1' });
    await handler(forming.req, forming.res);
    expect(forming.res.statusCode).toBe(409);
    expect(forming.res.body.error).toBe('not_battle');
  });
});

describe('happy path — the derived rebuild', () => {
  it('repairs the ledger to portfolio truth and returns the divergence report', async () => {
    const { db, captured } = makeDb({
      groupDoc: battleGroup(),
      agentBattles: [{
        id: 'b1',
        data: {
          gameMode: TOURNAMENT_GAME_MODE,
          agentId: 'agent-1',
          groupId: 'group-1',
          status: 'completed',
          createdAt: '2026-06-15T13:00:00.000Z',
          portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [], bench: { stocks: [], crypto: null } },
        },
      }],
      ledgerDocs: {
        [LEDGER_KEY]: {
          held: { GHOST: { heldBy: 'agent-1', since: 'T0', source: 'swap' } },
          reservations: {},
          doubleDowns: [],
          updatedAt: 'T0',
        },
      },
    });
    h.db = db;

    const { req, res } = makeReqRes({ groupId: 'group-1' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ groupId: 'group-1', battles: 1, holders: 1, heldCount: 1, staleCleared: 0 });
    expect(res.body.divergences.map(d => d.type).sort()).toEqual(['missing_in_ledger', 'not_in_portfolio']);

    expect(captured.txSets).toHaveLength(1);
    expect(captured.txSets[0].held.AMD.heldBy).toBe('agent-1');
    expect(captured.txSets[0].held.GHOST).toBeUndefined();
  });

  it('500s with the sentinel body when the rebuild throws', async () => {
    const db = makeDb({ groupDoc: battleGroup() }).db;
    db.runTransaction = async () => { throw new Error('boom'); };
    h.db = db;
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { req, res } = makeReqRes({ groupId: 'group-1' });
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('server_error');
  });
});
