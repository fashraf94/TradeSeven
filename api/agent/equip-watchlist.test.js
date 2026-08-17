// api/agent/equip-watchlist.test.js
//
// Phase 5B1 — handler-level coverage for the equip + unequip endpoints. One
// file covers both handlers (they share the Firestore / auth / shadow-log
// mocks). Maps to verification matrix V-1 through V-10.
//
// Pattern reference: api/forge/watchlists.test.js (hoisted mock state, request/
// response helper, beforeEach reset). The fake Firestore here covers the
// `agents` + `watchlists` collections; runTransaction delegates get/update to
// the collection-correct refs.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCompositionStoreDouble } from '../_utils/__fixtures__/compositionStoreDouble.js';

// ==================== HOISTED MOCK STATE ====================

const { authReturnValue, shadowLogCalls } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  shadowLogCalls: { current: [] },
}));

// ==================== MOCKS ====================

let activeFirestore = null;

vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => activeFirestore,
}));

vi.mock('../_utils/security.js', () => ({
  applySecurityMiddleware: () => false,
}));

vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (authReturnValue.current === null) {
      res.status(401).json({ error: 'auth required' });
      return null;
    }
    return authReturnValue.current;
  },
}));

vi.mock('../_utils/shadowLogger.js', () => ({
  logSignalDrops: async (record) => {
    shadowLogCalls.current.push(record);
  },
}));

vi.mock('@vercel/functions', () => ({
  waitUntil: (p) => p,
}));

const { default: equipHandler } = await import('./equip-watchlist.js');
const { default: unequipHandler } = await import('./unequip-watchlist.js');

// ==================== FIRESTORE MOCK ====================

function makeFakeFirestore({ agentDocs = {}, watchlistDocs = {} } = {}) {
  // ACTIVATION_RUNBOOK step 1.1: the write-epoch fence is LIVE, so the
  // endpoint's validateWriteEpochInTx genuinely reads composition/writeEpoch
  // inside the transaction. Model the PRE-GENESIS store (both docs absent =>
  // the fence fails open) instead of mocking the flag back to dark.
  const __composition = makeCompositionStoreDouble();
  const state = { agentDocs, watchlistDocs };

  const buildAgentRef = (id) => ({
    id,
    get: async () => ({
      exists: !!state.agentDocs[id],
      data: () => state.agentDocs[id],
    }),
    update: async (updates) => {
      state.agentDocs[id] = { ...state.agentDocs[id], ...updates };
    },
  });

  const buildWatchlistRef = (id) => ({
    id,
    get: async () => ({
      exists: !!state.watchlistDocs[id],
      data: () => state.watchlistDocs[id],
    }),
    update: async (updates) => {
      state.watchlistDocs[id] = { ...state.watchlistDocs[id], ...updates };
    },
  });

  const collection = (name) => {
    if (name === 'agents') return { doc: (id) => buildAgentRef(id) };
    if (name === 'watchlists') return { doc: (id) => buildWatchlistRef(id) };
    const __c = __composition.collection(name);
    if (__c) return __c;
    throw new Error(`Unmocked collection: ${name}`);
  };

  // get/update delegate to the ref's own (collection-correct) methods.
  const runTransaction = async (fn) => {
    const tx = {
      get: async (ref) => ref.get(),
      update: async (ref, updates) => ref.update(updates),
    };
    return fn(tx);
  };

  return { db: { collection, runTransaction }, state };
}

// ==================== TEST HELPERS ====================

function makeReqRes({ body, method = 'POST' }) {
  const req = { method, body: body || {} };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  return { req, res };
}

const COMMITTED_WATCHLIST = {
  watchlistId: 'wl-1',
  userId: 'test-user',
  agentId: null,
  name: 'AI inference plays',
  thesis: 'On-device inference is a moat.',
  status: 'committed',
  tickers: [{ symbol: 'AAPL' }, { symbol: 'NVDA' }],
  committedAt: '2026-05-09T12:00:00.000Z',
  createdAt: '2026-05-08T13:00:00.000Z',
  updatedAt: '2026-05-09T12:00:00.000Z',
};

const EQUIPPABLE_AGENT = {
  ownerId: 'test-user',
  activeBattleId: null,
  equippedWatchlistId: null,
  equippedWatchlistName: null,
  equippedAt: null,
};

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  shadowLogCalls.current = [];
  activeFirestore = null;
});

// ============================================================
// POST /api/agent/equip-watchlist
// ============================================================

describe('POST /api/agent/equip-watchlist', () => {
  it('V-1 happy path: 200, agent doc updated, shadow log emitted', async () => {
    const fx = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...EQUIPPABLE_AGENT } },
      watchlistDocs: { 'wl-1': { ...COMMITTED_WATCHLIST } },
    });
    activeFirestore = fx.db;

    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', watchlistId: 'wl-1' } });
    await equipHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.agentId).toBe('agent-1');
    expect(res.body.equippedWatchlistId).toBe('wl-1');
    expect(res.body.equippedWatchlistName).toBe('AI inference plays');
    expect(typeof res.body.equippedAt).toBe('string');
    expect(res.body.idempotent).toBe(false);

    const agent = fx.state.agentDocs['agent-1'];
    expect(agent.equippedWatchlistId).toBe('wl-1');
    expect(agent.equippedWatchlistName).toBe('AI inference plays');
    expect(agent.equippedAt).toBe(res.body.equippedAt);

    const log = shadowLogCalls.current.find((r) => r.stage === 'watchlist_equip');
    expect(log).toBeDefined();
    expect(log.userId).toBe('test-user');
    expect(log.agentId).toBe('agent-1');
    expect(log.watchlistId).toBe('wl-1');
  });

  it('V-2 no auth → 401', async () => {
    authReturnValue.current = null;
    activeFirestore = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...EQUIPPABLE_AGENT } },
      watchlistDocs: { 'wl-1': { ...COMMITTED_WATCHLIST } },
    }).db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', watchlistId: 'wl-1' } });
    await equipHandler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('V-3 watchlist does not exist → 404 watchlist_not_found', async () => {
    activeFirestore = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...EQUIPPABLE_AGENT } },
    }).db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', watchlistId: 'wl-missing' } });
    await equipHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('watchlist_not_found');
  });

  it('V-4 watchlist status draft → 400 not_committed', async () => {
    const fx = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...EQUIPPABLE_AGENT } },
      watchlistDocs: { 'wl-1': { ...COMMITTED_WATCHLIST, status: 'draft', committedAt: null } },
    });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', watchlistId: 'wl-1' } });
    await equipHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('not_committed');
    expect(fx.state.agentDocs['agent-1'].equippedWatchlistId).toBeNull();
  });

  it('V-5 soft-deleted watchlist → 404 watchlist_not_found', async () => {
    activeFirestore = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...EQUIPPABLE_AGENT } },
      watchlistDocs: {
        'wl-1': { ...COMMITTED_WATCHLIST, deletedAt: '2026-05-15T10:00:00.000Z' },
      },
    }).db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', watchlistId: 'wl-1' } });
    await equipHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('watchlist_not_found');
  });

  it('V-6 watchlist owned by a different user → 403 forbidden', async () => {
    const fx = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...EQUIPPABLE_AGENT } },
      watchlistDocs: { 'wl-1': { ...COMMITTED_WATCHLIST, userId: 'other-user' } },
    });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', watchlistId: 'wl-1' } });
    await equipHandler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('forbidden');
    expect(fx.state.agentDocs['agent-1'].equippedWatchlistId).toBeNull();
  });

  it('V-7 agent has an active battle → 409 battle_active', async () => {
    const fx = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...EQUIPPABLE_AGENT, activeBattleId: 'battle-99' } },
      watchlistDocs: { 'wl-1': { ...COMMITTED_WATCHLIST } },
    });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', watchlistId: 'wl-1' } });
    await equipHandler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('battle_active');
    expect(fx.state.agentDocs['agent-1'].equippedWatchlistId).toBeNull();
  });

  it('V-8 equip the same watchlist twice → 200 idempotent, no shadow log on the second', async () => {
    const fx = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...EQUIPPABLE_AGENT } },
      watchlistDocs: { 'wl-1': { ...COMMITTED_WATCHLIST } },
    });
    activeFirestore = fx.db;

    const first = makeReqRes({ body: { agentId: 'agent-1', watchlistId: 'wl-1' } });
    await equipHandler(first.req, first.res);
    expect(first.res.body.idempotent).toBe(false);

    shadowLogCalls.current = []; // only inspect logs from the second call

    const second = makeReqRes({ body: { agentId: 'agent-1', watchlistId: 'wl-1' } });
    await equipHandler(second.req, second.res);
    expect(second.res.statusCode).toBe(200);
    expect(second.res.body.idempotent).toBe(true);
    expect(second.res.body.equippedWatchlistId).toBe('wl-1');
    expect(second.res.body.equippedWatchlistName).toBe('AI inference plays');
    expect(
      shadowLogCalls.current.find((r) => r.stage === 'watchlist_equip')
    ).toBeUndefined();
  });

  it('equipping a different watchlist overwrites the previous equip (3.3)', async () => {
    const fx = makeFakeFirestore({
      agentDocs: {
        'agent-1': {
          ...EQUIPPABLE_AGENT,
          equippedWatchlistId: 'wl-1',
          equippedWatchlistName: 'AI inference plays',
          equippedAt: '2026-05-10T00:00:00.000Z',
        },
      },
      watchlistDocs: {
        'wl-1': { ...COMMITTED_WATCHLIST },
        'wl-2': { ...COMMITTED_WATCHLIST, watchlistId: 'wl-2', name: 'Energy rotation' },
      },
    });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', watchlistId: 'wl-2' } });
    await equipHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(false);
    expect(res.body.equippedWatchlistId).toBe('wl-2');
    expect(fx.state.agentDocs['agent-1'].equippedWatchlistName).toBe('Energy rotation');
  });

  it('agent does not exist → 404 agent_not_found', async () => {
    activeFirestore = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...COMMITTED_WATCHLIST } },
    }).db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-missing', watchlistId: 'wl-1' } });
    await equipHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('agent_not_found');
  });

  it('agent owned by a different user → 403 forbidden', async () => {
    activeFirestore = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...EQUIPPABLE_AGENT, ownerId: 'other-user' } },
      watchlistDocs: { 'wl-1': { ...COMMITTED_WATCHLIST } },
    }).db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', watchlistId: 'wl-1' } });
    await equipHandler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('rejects a malformed agentId / watchlistId with 400', async () => {
    activeFirestore = makeFakeFirestore({}).db;
    const r1 = makeReqRes({ body: { agentId: '../../etc/passwd', watchlistId: 'wl-1' } });
    await equipHandler(r1.req, r1.res);
    expect(r1.res.statusCode).toBe(400);
    expect(r1.res.body.error).toBe('invalid_agent_id');

    const r2 = makeReqRes({ body: { agentId: 'agent-1', watchlistId: 'has spaces' } });
    await equipHandler(r2.req, r2.res);
    expect(r2.res.statusCode).toBe(400);
    expect(r2.res.body.error).toBe('invalid_watchlist_id');
  });

  it('rejects non-POST methods with 405', async () => {
    activeFirestore = makeFakeFirestore({}).db;
    const { req, res } = makeReqRes({ method: 'GET', body: {} });
    await equipHandler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

// ============================================================
// POST /api/agent/unequip-watchlist
// ============================================================

describe('POST /api/agent/unequip-watchlist', () => {
  it('V-9 happy path: agent doc cleared, shadow log emitted', async () => {
    const fx = makeFakeFirestore({
      agentDocs: {
        'agent-1': {
          ...EQUIPPABLE_AGENT,
          equippedWatchlistId: 'wl-1',
          equippedWatchlistName: 'AI inference plays',
          equippedAt: '2026-05-10T00:00:00.000Z',
        },
      },
    });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1' } });
    await unequipHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.agentId).toBe('agent-1');
    expect(res.body.equippedWatchlistId).toBeNull();
    expect(res.body.idempotent).toBe(false);

    const agent = fx.state.agentDocs['agent-1'];
    expect(agent.equippedWatchlistId).toBeNull();
    expect(agent.equippedWatchlistName).toBeNull();
    expect(agent.equippedAt).toBeNull();

    const log = shadowLogCalls.current.find((r) => r.stage === 'watchlist_unequip');
    expect(log).toBeDefined();
    expect(log.agentId).toBe('agent-1');
  });

  it('V-10 nothing equipped → 200 idempotent no-op, no shadow log', async () => {
    const fx = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...EQUIPPABLE_AGENT } },
    });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1' } });
    await unequipHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(res.body.equippedWatchlistId).toBeNull();
    expect(
      shadowLogCalls.current.find((r) => r.stage === 'watchlist_unequip')
    ).toBeUndefined();
  });

  it('no auth → 401', async () => {
    authReturnValue.current = null;
    activeFirestore = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...EQUIPPABLE_AGENT } },
    }).db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1' } });
    await unequipHandler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('agent does not exist → 404 agent_not_found', async () => {
    activeFirestore = makeFakeFirestore({}).db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-missing' } });
    await unequipHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('agent_not_found');
  });

  it('agent owned by a different user → 403 forbidden', async () => {
    activeFirestore = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...EQUIPPABLE_AGENT, ownerId: 'other-user' } },
    }).db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1' } });
    await unequipHandler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('agent has an active battle → 409 battle_active', async () => {
    const fx = makeFakeFirestore({
      agentDocs: {
        'agent-1': {
          ...EQUIPPABLE_AGENT,
          activeBattleId: 'battle-99',
          equippedWatchlistId: 'wl-1',
        },
      },
    });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1' } });
    await unequipHandler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('battle_active');
    expect(fx.state.agentDocs['agent-1'].equippedWatchlistId).toBe('wl-1');
  });

  it('rejects a malformed agentId with 400', async () => {
    activeFirestore = makeFakeFirestore({}).db;
    const { req, res } = makeReqRes({ body: { agentId: 'has/slashes' } });
    await unequipHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_agent_id');
  });

  it('rejects non-POST methods with 405', async () => {
    activeFirestore = makeFakeFirestore({}).db;
    const { req, res } = makeReqRes({ method: 'GET', body: {} });
    await unequipHandler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
