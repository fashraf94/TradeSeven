// api/forge/watchlists.test.js
//
// Sprint 6 Phase 4A — handler-level coverage for the new watchlists
// endpoints. One unified file covers all four handlers (POST create,
// GET/PATCH at [id], POST commit + POST uncommit at [id]/...) since they
// share the same Firestore mock + auth mock + shadow-log mock.
//
// Test count target (per Phase 4A audit Section 8): 31 server tests.
// Phase 4B adds the POST uncommit handler coverage.
// Phase 4D adds GET list + POST delete + soft-delete-is-gone coverage.
//
// Pattern reference: api/forge/watchlist-dialogue-abandon.test.js (mock
// shape, request/response helper, beforeEach reset). The new fixture
// extends runTransaction with tx.set routing — first multi-doc transaction
// in the codebase.
//
// Note on auto-id allocation: the POST create handler calls
// db.collection('watchlists').doc() which the test fixture treats as a
// request for the allocatedWatchlistId. Tests that need a specific id can
// override via makeFakeFirestore({ allocatedWatchlistId }).

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const { default: createHandler } = await import('./watchlists.js');
const { default: itemHandler } = await import('./watchlists/[id].js');
const { default: commitHandler } = await import('./watchlists/[id]/commit.js');
const { default: uncommitHandler } = await import('./watchlists/[id]/uncommit.js');
const { default: deleteHandler } = await import('./watchlists/[id]/delete.js');

// ==================== FIRESTORE MOCK ====================

function makeFakeFirestore({
  sessionDocs = {},
  watchlistDocs = {},
  allocatedWatchlistId = 'new-watchlist-456',
  inTxSessionOverride = null,  // simulates state changing between pre-tx + in-tx reads
} = {}) {
  // Mutable state object so tests can poke / inspect after a handler runs.
  const state = { sessionDocs, watchlistDocs, allocatedWatchlistId, inTxSessionOverride };

  const buildSessionRef = (id) => ({
    id,
    get: async () => ({
      exists: !!state.sessionDocs[id],
      data: () => state.sessionDocs[id],
    }),
    set: async (data) => {
      state.sessionDocs[id] = data;
    },
    update: async (updates) => {
      state.sessionDocs[id] = { ...state.sessionDocs[id], ...updates };
    },
  });

  const buildWatchlistRef = (id) => ({
    id,
    get: async () => ({
      exists: !!state.watchlistDocs[id],
      data: () => state.watchlistDocs[id],
    }),
    set: async (data) => {
      state.watchlistDocs[id] = data;
    },
    update: async (updates) => {
      state.watchlistDocs[id] = { ...state.watchlistDocs[id], ...updates };
    },
  });

  const collection = (name) => {
    if (name === 'watchlistSessions') {
      return { doc: (id) => buildSessionRef(id) };
    }
    if (name === 'watchlists') {
      return {
        // .doc() with no args → auto-id allocation. .doc(id) → named ref.
        doc: (id) => buildWatchlistRef(id || state.allocatedWatchlistId),
        // Phase 4D: collection query for the GET list endpoint. Only the
        // '==' operator is exercised (handleList filters by userId).
        where: (field, op, value) => ({
          get: async () => {
            const docs = Object.entries(state.watchlistDocs)
              .filter(([, v]) => v && (op === '==' ? v[field] === value : true))
              .map(([id, v]) => ({ id, exists: true, data: () => v }));
            return { docs, empty: docs.length === 0 };
          },
        }),
      };
    }
    throw new Error(`Unmocked collection: ${name}`);
  };

  // Phase 4A: extended runTransaction supports tx.set in addition to
  // tx.get + tx.update. The set router uses ref.id presence in the
  // backing maps to disambiguate between sessionDocs and watchlistDocs.
  // For new docs (created via .doc() auto-id allocation), the ref.id
  // matches state.allocatedWatchlistId — those route to watchlistDocs.
  const runTransaction = async (fn) => {
    const tx = {
      get: async (ref) => {
        // Simulate a race: pre-tx ref.get() returns the original sessionDocs
        // entry, but tx.get inside the transaction body sees a different
        // state (e.g., another writer flipped status between reads).
        if (
          state.inTxSessionOverride &&
          state.sessionDocs[ref.id] !== undefined
        ) {
          return {
            exists: true,
            data: () => state.inTxSessionOverride,
          };
        }
        return ref.get();
      },
      set: async (ref, data) => {
        if (
          state.watchlistDocs[ref.id] !== undefined ||
          ref.id === state.allocatedWatchlistId
        ) {
          state.watchlistDocs[ref.id] = data;
        } else if (state.sessionDocs[ref.id] !== undefined) {
          state.sessionDocs[ref.id] = data;
        } else {
          // Best-effort: route to watchlists by default since that's where
          // new-doc tx.set primarily fires in Phase 4A.
          state.watchlistDocs[ref.id] = data;
        }
      },
      update: async (ref, updates) => {
        if (state.sessionDocs[ref.id] !== undefined) {
          state.sessionDocs[ref.id] = { ...state.sessionDocs[ref.id], ...updates };
        } else if (state.watchlistDocs[ref.id] !== undefined) {
          state.watchlistDocs[ref.id] = { ...state.watchlistDocs[ref.id], ...updates };
        }
      },
    };
    return fn(tx);
  };

  return { db: { collection, runTransaction }, state };
}

// ==================== TEST HELPERS ====================

function makeReqRes({ body, query, method = 'POST' }) {
  const req = { method, body: body || {}, query: query || {} };
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
  return { req, res };
}

const ACTIVE_SESSION = {
  userId: 'test-user',
  agentId: 'agent-1',
  dropId: 'drop-abc-123',
  status: 'active',
  startedAt: '2026-05-08T12:00:00.000Z',
  updatedAt: '2026-05-08T12:00:00.000Z',
  phase: 'finalize',
  candidateTickers: [
    {
      symbol: 'AAPL',
      reasoning: 'Direct AI inference play',
      category: 'core',
      slot: 'core',
      status: 'kept',
      proposedAt: '2026-05-08T12:01:00.000Z',
      proposedAtPhase: 'propose',
    },
    {
      symbol: 'NVDA',
      reasoning: 'Picks-and-shovels for the inference layer',
      category: 'discovery',
      slot: 'discovery',
      status: 'proposed',
      proposedAt: '2026-05-08T12:02:00.000Z',
      proposedAtPhase: 'propose',
    },
    {
      symbol: 'INTC',
      reasoning: 'Considered, dropped after dialogue',
      category: 'discovery',
      slot: null,
      status: 'removed',
      proposedAt: '2026-05-08T12:03:00.000Z',
      proposedAtPhase: 'refine',
    },
  ],
  anatomy: {
    thesis: 'Apple is leaning into on-device AI inference as a moat.',
    activationConditions: ['Apple announces Neural Engine v2', 'Inference benchmarks leak'],
    invalidationConditions: ['Tim Cook walks back on-device strategy in earnings'],
  },
  messagesUsed: 5,
  messageBudget: 20,
  dropListId: null,
};

const VALID_BODY = {
  sessionId: 'session-1',
  agentId: 'agent-1',
  dropId: 'drop-abc-123',
};

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  shadowLogCalls.current = [];
  activeFirestore = null;
});

// ============================================================
// POST /api/forge/watchlists — create
// ============================================================

describe('POST /api/forge/watchlists — happy paths', () => {
  it('creates a watchlist from a finalize_intent session and flips status to completed', async () => {
    const fixture = makeFakeFirestore({
      sessionDocs: {
        'session-1': {
          ...ACTIVE_SESSION,
          status: 'finalize_intent',
          abandonReason: 'finalize_intent',
          abandonedAt: '2026-05-08T13:00:00.000Z',
        },
      },
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.watchlistId).toBe('new-watchlist-456');
    expect(res.body.status).toBe('draft');
    expect(res.body.idempotent).toBe(false);
    expect(typeof res.body.createdAt).toBe('string');

    // Session transitioned to 'completed' with dropListId pointing at watchlist
    const session = fixture.state.sessionDocs['session-1'];
    expect(session.status).toBe('completed');
    expect(session.dropListId).toBe('new-watchlist-456');

    // Watchlist doc created
    const watchlist = fixture.state.watchlistDocs['new-watchlist-456'];
    expect(watchlist).toBeDefined();
    expect(watchlist.userId).toBe('test-user');
    expect(watchlist.agentId).toBe('agent-1');
    expect(watchlist.status).toBe('draft');
  });

  it('creates a watchlist from an active session (no abandon needed)', async () => {
    const fixture = makeFakeFirestore({
      sessionDocs: { 'session-1': { ...ACTIVE_SESSION } },
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(false);
    expect(fixture.state.sessionDocs['session-1'].status).toBe('completed');
    expect(fixture.state.watchlistDocs['new-watchlist-456']).toBeDefined();
  });

  it('filters tickers — keeps proposed + kept, drops removed', async () => {
    const fixture = makeFakeFirestore({
      sessionDocs: { 'session-1': { ...ACTIVE_SESSION } },
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);

    const watchlist = fixture.state.watchlistDocs['new-watchlist-456'];
    expect(watchlist.tickers).toHaveLength(2); // AAPL + NVDA, INTC dropped
    const symbols = watchlist.tickers.map((t) => t.symbol);
    expect(symbols).toEqual(['AAPL', 'NVDA']);
    expect(symbols).not.toContain('INTC');
    expect(res.body.tickerCount).toBe(2);
  });

  it('persists tickers with addedBy/addedAt and strips slot/status/proposedAt fields', async () => {
    const fixture = makeFakeFirestore({
      sessionDocs: { 'session-1': { ...ACTIVE_SESSION } },
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);

    const watchlist = fixture.state.watchlistDocs['new-watchlist-456'];
    for (const t of watchlist.tickers) {
      expect(t.addedBy).toBe('agent');
      expect(typeof t.addedAt).toBe('string');
      expect(t).not.toHaveProperty('slot');
      expect(t).not.toHaveProperty('status');
      expect(t).not.toHaveProperty('proposedAt');
      expect(t).not.toHaveProperty('proposedAtPhase');
    }
    // Sanity: kept content
    expect(watchlist.tickers[0].symbol).toBe('AAPL');
    expect(watchlist.tickers[0].reasoning).toBe('Direct AI inference play');
    expect(watchlist.tickers[0].category).toBe('core');
  });
});

describe('POST /api/forge/watchlists — anatomy extraction', () => {
  it('copies thesis and both condition arrays from session.anatomy', async () => {
    const fixture = makeFakeFirestore({
      sessionDocs: { 'session-1': { ...ACTIVE_SESSION } },
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);

    const watchlist = fixture.state.watchlistDocs['new-watchlist-456'];
    expect(watchlist.thesis).toBe('Apple is leaning into on-device AI inference as a moat.');
    expect(watchlist.activationConditions).toEqual([
      'Apple announces Neural Engine v2',
      'Inference benchmarks leak',
    ]);
    expect(watchlist.invalidationConditions).toEqual([
      'Tim Cook walks back on-device strategy in earnings',
    ]);
  });

  it('handles empty anatomy with defaults', async () => {
    const fixture = makeFakeFirestore({
      sessionDocs: {
        'session-1': {
          ...ACTIVE_SESSION,
          anatomy: { thesis: null, activationConditions: [], invalidationConditions: [] },
        },
      },
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);

    const watchlist = fixture.state.watchlistDocs['new-watchlist-456'];
    expect(watchlist.thesis).toBe('');
    expect(watchlist.activationConditions).toEqual([]);
    expect(watchlist.invalidationConditions).toEqual([]);
  });
});

describe('POST /api/forge/watchlists — idempotency', () => {
  it('pre-tx shortcut: returns existing watchlistId when session is already completed', async () => {
    const fixture = makeFakeFirestore({
      sessionDocs: {
        'session-1': {
          ...ACTIVE_SESSION,
          status: 'completed',
          dropListId: 'existing-watchlist-789',
        },
      },
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.watchlistId).toBe('existing-watchlist-789');
    expect(res.body.idempotent).toBe(true);
    // No new watchlist created
    expect(fixture.state.watchlistDocs['new-watchlist-456']).toBeUndefined();

    // Shadow log records the pre-tx idempotent path
    const log = shadowLogCalls.current.find((r) => r.stage === 'watchlist_create');
    expect(log).toBeDefined();
    expect(log.idempotent).toBe(true);
    expect(log.idempotentSource).toBe('pre_tx');
  });

  it('in-tx race: pre-tx read sees active, in-tx re-read sees completed → 200 idempotent', async () => {
    // Pre-tx read: session is 'active' (so we enter the transaction).
    // In-tx re-read: session has flipped to 'completed' with dropListId
    // (a parallel writer raced us). Handler should return 200 idempotent
    // with the existing watchlistId, NOT create a duplicate watchlist.
    const fixture = makeFakeFirestore({
      sessionDocs: { 'session-1': { ...ACTIVE_SESSION } },
      inTxSessionOverride: {
        ...ACTIVE_SESSION,
        status: 'completed',
        dropListId: 'racing-watchlist-999',
      },
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.watchlistId).toBe('racing-watchlist-999');
    expect(res.body.idempotent).toBe(true);
    // No new watchlist created
    expect(fixture.state.watchlistDocs['new-watchlist-456']).toBeUndefined();
  });

  it('returns 409 inconsistent_state when session is completed without dropListId', async () => {
    // The pre-tx shortcut requires both status=completed AND dropListId set.
    // This test triggers the in-tx inconsistent_state branch by leaving
    // dropListId null on a completed session — defensive against impossible
    // states that shouldn't arise in production.
    const fixture = makeFakeFirestore({
      sessionDocs: {
        'session-1': {
          ...ACTIVE_SESSION,
          status: 'completed',
          dropListId: null,
        },
      },
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('inconsistent_state');
  });
});

describe('POST /api/forge/watchlists — validation', () => {
  it('rejects malformed sessionId (400 invalid_session_id)', async () => {
    activeFirestore = makeFakeFirestore().db;
    const { req, res } = makeReqRes({
      body: { ...VALID_BODY, sessionId: '../../../etc/passwd' },
    });
    await createHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_session_id');
  });

  it('rejects malformed agentId (400 invalid_agent_id)', async () => {
    activeFirestore = makeFakeFirestore().db;
    const { req, res } = makeReqRes({
      body: { ...VALID_BODY, agentId: 'has spaces' },
    });
    await createHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_agent_id');
  });

  it('rejects malformed dropId (400 invalid_drop_id)', async () => {
    activeFirestore = makeFakeFirestore().db;
    const { req, res } = makeReqRes({
      body: { ...VALID_BODY, dropId: 'has/slashes' },
    });
    await createHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_drop_id');
  });
});

describe('POST /api/forge/watchlists — auth + ownership', () => {
  it('returns 401 when no auth token is present', async () => {
    authReturnValue.current = null;
    activeFirestore = makeFakeFirestore({
      sessionDocs: { 'session-1': { ...ACTIVE_SESSION } },
    }).db;
    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 when session belongs to a different user', async () => {
    const fixture = makeFakeFirestore({
      sessionDocs: { 'session-1': { ...ACTIVE_SESSION, userId: 'other-user' } },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('forbidden');
    // Don't mutate session on auth failure
    expect(fixture.state.sessionDocs['session-1'].status).toBe('active');
  });

  it('returns 404 when session not found', async () => {
    activeFirestore = makeFakeFirestore().db;
    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('session_not_found');
  });

  it('returns 400 agent_session_mismatch when agentId differs from session', async () => {
    activeFirestore = makeFakeFirestore({
      sessionDocs: { 'session-1': { ...ACTIVE_SESSION } },
    }).db;
    const { req, res } = makeReqRes({
      body: { ...VALID_BODY, agentId: 'different-agent' },
    });
    await createHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('agent_session_mismatch');
  });

  it('returns 400 drop_session_mismatch when dropId differs from session.dropId (per A-A-2)', async () => {
    activeFirestore = makeFakeFirestore({
      sessionDocs: { 'session-1': { ...ACTIVE_SESSION } },
    }).db;
    const { req, res } = makeReqRes({
      body: { ...VALID_BODY, dropId: 'different-drop' },
    });
    await createHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('drop_session_mismatch');
  });

  it('returns 409 invalid_status when session is abandoned', async () => {
    activeFirestore = makeFakeFirestore({
      sessionDocs: {
        'session-1': {
          ...ACTIVE_SESSION,
          status: 'abandoned',
          abandonReason: 'user_close',
        },
      },
    }).db;
    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('invalid_status');
  });
});

describe('POST /api/forge/watchlists — observability', () => {
  it('writes a shadow log entry with stage=watchlist_create on the happy path', async () => {
    activeFirestore = makeFakeFirestore({
      sessionDocs: { 'session-1': { ...ACTIVE_SESSION } },
    }).db;
    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);

    expect(res.statusCode).toBe(200);
    const log = shadowLogCalls.current.find((r) => r.stage === 'watchlist_create');
    expect(log).toBeDefined();
    expect(log.userId).toBe('test-user');
    expect(log.agentId).toBe('agent-1');
    expect(log.sessionId).toBe('session-1');
    expect(log.dropId).toBe('drop-abc-123');
    expect(log.watchlistId).toBe('new-watchlist-456');
    expect(log.idempotent).toBe(false);
    expect(log.tickerCount).toBe(2);
  });

  it('writes session.dropListId atomically with the watchlist creation', async () => {
    const fixture = makeFakeFirestore({
      sessionDocs: { 'session-1': { ...ACTIVE_SESSION } },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ body: VALID_BODY });
    await createHandler(req, res);

    expect(res.statusCode).toBe(200);
    const session = fixture.state.sessionDocs['session-1'];
    const watchlist = fixture.state.watchlistDocs['new-watchlist-456'];
    expect(session.dropListId).toBe(watchlist.watchlistId);
    expect(session.dropListId).toBe('new-watchlist-456');
  });
});

// ============================================================
// PATCH /api/forge/watchlists/[id]
// ============================================================

const DRAFT_WATCHLIST = {
  watchlistId: 'wl-1',
  userId: 'test-user',
  agentId: 'agent-1',
  sourceSessionId: 'session-1',
  sourceDropId: 'drop-abc-123',
  thesis: 'starter thesis',
  activationConditions: [],
  invalidationConditions: [],
  tickers: [
    {
      symbol: 'AAPL',
      reasoning: 'Direct play',
      category: 'core',
      addedBy: 'agent',
      addedAt: '2026-05-08T13:00:00.000Z',
    },
  ],
  name: '',
  notes: '',
  status: 'draft',
  createdAt: '2026-05-08T13:00:00.000Z',
  updatedAt: '2026-05-08T13:00:00.000Z',
  committedAt: null,
};

describe('PATCH /api/forge/watchlists/[id]', () => {
  it('happy path: updates only provided fields, leaves others unchanged', async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST } },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      method: 'PATCH',
      query: { id: 'wl-1' },
      body: { name: 'My AI watchlist', notes: 'tracking inference plays' },
    });
    await itemHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.watchlistId).toBe('wl-1');
    expect(typeof res.body.updatedAt).toBe('string');
    const after = fixture.state.watchlistDocs['wl-1'];
    expect(after.name).toBe('My AI watchlist');
    expect(after.notes).toBe('tracking inference plays');
    expect(after.thesis).toBe('starter thesis'); // unchanged
    expect(after.tickers).toHaveLength(1);
  });

  it('trims string fields silently when over the length cap', async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST } },
    });
    activeFirestore = fixture.db;
    const longName = 'x'.repeat(200);
    const { req, res } = makeReqRes({
      method: 'PATCH',
      query: { id: 'wl-1' },
      body: { name: longName },
    });
    await itemHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(fixture.state.watchlistDocs['wl-1'].name).toHaveLength(100);
  });

  it('returns 409 invalid_status when watchlist is committed', async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: {
        'wl-1': { ...DRAFT_WATCHLIST, status: 'committed', committedAt: '2026-05-09T12:00:00.000Z' },
      },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      method: 'PATCH',
      query: { id: 'wl-1' },
      body: { name: 'try to edit committed' },
    });
    await itemHandler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('invalid_status');
    // Don't mutate
    expect(fixture.state.watchlistDocs['wl-1'].name).toBe('');
  });

  it('returns 403 when watchlist belongs to a different user; 404 when not found', async () => {
    // 403 case
    const fixture403 = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST, userId: 'other-user' } },
    });
    activeFirestore = fixture403.db;
    const r1 = makeReqRes({ method: 'PATCH', query: { id: 'wl-1' }, body: { name: 'x' } });
    await itemHandler(r1.req, r1.res);
    expect(r1.res.statusCode).toBe(403);
    expect(r1.res.body.error).toBe('forbidden');

    // 404 case
    activeFirestore = makeFakeFirestore({}).db;
    const r2 = makeReqRes({ method: 'PATCH', query: { id: 'wl-missing' }, body: { name: 'x' } });
    await itemHandler(r2.req, r2.res);
    expect(r2.res.statusCode).toBe(404);
    expect(r2.res.body.error).toBe('not_found');
  });

  it('rejects non-GET/PATCH methods with 405', async () => {
    activeFirestore = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST } },
    }).db;
    const { req, res } = makeReqRes({
      method: 'DELETE',
      query: { id: 'wl-1' },
    });
    await itemHandler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

// ============================================================
// POST /api/forge/watchlists/[id]/commit
// ============================================================

describe('POST /api/forge/watchlists/[id]/commit', () => {
  it('happy path: draft → committed, sets committedAt', async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST } },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await commitHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('committed');
    expect(res.body.idempotent).toBe(false);
    expect(typeof res.body.committedAt).toBe('string');
    const after = fixture.state.watchlistDocs['wl-1'];
    expect(after.status).toBe('committed');
    expect(after.committedAt).toBe(res.body.committedAt);
  });

  it('idempotent: already committed returns 200 with the original committedAt', async () => {
    const originalTs = '2026-05-09T12:00:00.000Z';
    const fixture = makeFakeFirestore({
      watchlistDocs: {
        'wl-1': { ...DRAFT_WATCHLIST, status: 'committed', committedAt: originalTs },
      },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await commitHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(res.body.committedAt).toBe(originalTs);
  });

  it('returns 400 not_commit_ready when ticker count is 0 (per D-A-2)', async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST, tickers: [] } },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await commitHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('not_commit_ready');
    expect(fixture.state.watchlistDocs['wl-1'].status).toBe('draft');
  });

  it('returns 403 wrong owner; 404 not found', async () => {
    const fixture403 = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST, userId: 'other-user' } },
    });
    activeFirestore = fixture403.db;
    const r1 = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await commitHandler(r1.req, r1.res);
    expect(r1.res.statusCode).toBe(403);
    expect(r1.res.body.error).toBe('forbidden');

    activeFirestore = makeFakeFirestore({}).db;
    const r2 = makeReqRes({ query: { id: 'wl-missing' }, body: {} });
    await commitHandler(r2.req, r2.res);
    expect(r2.res.statusCode).toBe(404);
    expect(r2.res.body.error).toBe('not_found');
  });
});

// ============================================================
// POST /api/forge/watchlists/[id]/uncommit
// ============================================================

describe('POST /api/forge/watchlists/[id]/uncommit', () => {
  it('happy path: committed → draft, clears committedAt, stamps uncommittedAt', async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: {
        'wl-1': { ...DRAFT_WATCHLIST, status: 'committed', committedAt: '2026-05-09T12:00:00.000Z' },
      },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await uncommitHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.idempotent).toBe(false);
    expect(typeof res.body.uncommittedAt).toBe('string');
    const after = fixture.state.watchlistDocs['wl-1'];
    expect(after.status).toBe('draft');
    expect(after.committedAt).toBe(null);
    expect(after.uncommittedAt).toBe(res.body.uncommittedAt);

    const log = shadowLogCalls.current.find((r) => r.stage === 'watchlist_uncommit');
    expect(log).toBeDefined();
    expect(log.idempotent).toBe(false);
  });

  it('idempotent: already a draft returns 200 preserving the existing uncommittedAt', async () => {
    const originalTs = '2026-05-10T08:00:00.000Z';
    const fixture = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST, uncommittedAt: originalTs } },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await uncommitHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(res.body.uncommittedAt).toBe(originalTs);
  });

  it('idempotent: a never-committed draft returns uncommittedAt null', async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST } }, // no uncommittedAt field
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await uncommitHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(res.body.uncommittedAt).toBe(null);
  });

  it('still emits a shadow log on the idempotent path', async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST } },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await uncommitHandler(req, res);

    expect(res.statusCode).toBe(200);
    const log = shadowLogCalls.current.find((r) => r.stage === 'watchlist_uncommit');
    expect(log).toBeDefined();
    expect(log.idempotent).toBe(true);
  });

  it('returns 403 wrong owner without mutating the doc; 404 not found', async () => {
    const fixture403 = makeFakeFirestore({
      watchlistDocs: {
        'wl-1': {
          ...DRAFT_WATCHLIST,
          status: 'committed',
          committedAt: '2026-05-09T12:00:00.000Z',
          userId: 'other-user',
        },
      },
    });
    activeFirestore = fixture403.db;
    const r1 = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await uncommitHandler(r1.req, r1.res);
    expect(r1.res.statusCode).toBe(403);
    expect(r1.res.body.error).toBe('forbidden');
    expect(fixture403.state.watchlistDocs['wl-1'].status).toBe('committed');

    activeFirestore = makeFakeFirestore({}).db;
    const r2 = makeReqRes({ query: { id: 'wl-missing' }, body: {} });
    await uncommitHandler(r2.req, r2.res);
    expect(r2.res.statusCode).toBe(404);
    expect(r2.res.body.error).toBe('not_found');
  });

  it('rejects non-POST methods with 405', async () => {
    activeFirestore = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST } },
    }).db;
    const { req, res } = makeReqRes({ method: 'GET', query: { id: 'wl-1' } });
    await uncommitHandler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects a malformed watchlist id with 400 invalid_watchlist_id', async () => {
    activeFirestore = makeFakeFirestore({}).db;
    const { req, res } = makeReqRes({ query: { id: '../../../etc/passwd' }, body: {} });
    await uncommitHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_watchlist_id');
  });
});

// ============================================================
// GET /api/forge/watchlists/[id]
// ============================================================

describe('GET /api/forge/watchlists/[id]', () => {
  it('returns the full watchlist document on the happy path', async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST } },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ method: 'GET', query: { id: 'wl-1' } });
    await itemHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.watchlist.watchlistId).toBe('wl-1');
    expect(res.body.watchlist.thesis).toBe('starter thesis');
    expect(res.body.watchlist.tickers).toHaveLength(1);
  });

  it('returns 403 wrong owner; 404 not found', async () => {
    const fixture403 = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST, userId: 'other-user' } },
    });
    activeFirestore = fixture403.db;
    const r1 = makeReqRes({ method: 'GET', query: { id: 'wl-1' } });
    await itemHandler(r1.req, r1.res);
    expect(r1.res.statusCode).toBe(403);

    activeFirestore = makeFakeFirestore({}).db;
    const r2 = makeReqRes({ method: 'GET', query: { id: 'wl-missing' } });
    await itemHandler(r2.req, r2.res);
    expect(r2.res.statusCode).toBe(404);
  });
});

// ============================================================
// GET /api/forge/watchlists — list (Phase 4D)
// ============================================================

describe('GET /api/forge/watchlists — list', () => {
  it("returns only the authenticated user's watchlists", async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: {
        'wl-1': { ...DRAFT_WATCHLIST, watchlistId: 'wl-1' },
        'wl-2': { ...DRAFT_WATCHLIST, watchlistId: 'wl-2' },
        'wl-other': { ...DRAFT_WATCHLIST, watchlistId: 'wl-other', userId: 'other-user' },
      },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ method: 'GET' });
    await createHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.watchlists)).toBe(true);
    const ids = res.body.watchlists.map((w) => w.watchlistId).sort();
    expect(ids).toEqual(['wl-1', 'wl-2']);
  });

  it('excludes soft-deleted docs but keeps docs with no deletedAt field', async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: {
        // No deletedAt field at all — must NOT be filtered out.
        'wl-live': { ...DRAFT_WATCHLIST, watchlistId: 'wl-live' },
        'wl-deleted': {
          ...DRAFT_WATCHLIST,
          watchlistId: 'wl-deleted',
          deletedAt: '2026-05-15T10:00:00.000Z',
        },
      },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ method: 'GET' });
    await createHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.watchlists.map((w) => w.watchlistId)).toEqual(['wl-live']);
  });

  it('attaches watchlistId from the firestore doc id', async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: { 'doc-key-1': { ...DRAFT_WATCHLIST, watchlistId: 'stale-value' } },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ method: 'GET' });
    await createHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.watchlists[0].watchlistId).toBe('doc-key-1');
  });

  it('returns an empty array when the user has no watchlists', async () => {
    activeFirestore = makeFakeFirestore({}).db;
    const { req, res } = makeReqRes({ method: 'GET' });
    await createHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.watchlists).toEqual([]);
  });

  it('returns 401 when no auth token is present', async () => {
    authReturnValue.current = null;
    activeFirestore = makeFakeFirestore({}).db;
    const { req, res } = makeReqRes({ method: 'GET' });
    await createHandler(req, res);
    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// POST /api/forge/watchlists/[id]/delete (Phase 4D)
// ============================================================

describe('POST /api/forge/watchlists/[id]/delete', () => {
  it('happy path: stamps deletedAt, bumps updatedAt, preserves status', async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST } },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await deleteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(false);
    expect(typeof res.body.deletedAt).toBe('string');
    const after = fixture.state.watchlistDocs['wl-1'];
    expect(after.deletedAt).toBe(res.body.deletedAt);
    expect(after.updatedAt).toBe(res.body.deletedAt);
    expect(after.status).toBe('draft');
  });

  it('idempotent: re-deleting returns 200 and preserves the original deletedAt', async () => {
    const originalTs = '2026-05-14T09:00:00.000Z';
    const fixture = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST, deletedAt: originalTs } },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await deleteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(res.body.deletedAt).toBe(originalTs);
  });

  it('preserves committed status on a committed watchlist', async () => {
    const fixture = makeFakeFirestore({
      watchlistDocs: {
        'wl-1': { ...DRAFT_WATCHLIST, status: 'committed', committedAt: '2026-05-09T12:00:00.000Z' },
      },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await deleteHandler(req, res);

    expect(res.statusCode).toBe(200);
    const after = fixture.state.watchlistDocs['wl-1'];
    expect(after.status).toBe('committed');
    expect(typeof after.deletedAt).toBe('string');
  });

  it('returns 403 wrong owner without mutating; 404 not found', async () => {
    const fixture403 = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST, userId: 'other-user' } },
    });
    activeFirestore = fixture403.db;
    const r1 = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await deleteHandler(r1.req, r1.res);
    expect(r1.res.statusCode).toBe(403);
    expect(r1.res.body.error).toBe('forbidden');
    expect(fixture403.state.watchlistDocs['wl-1'].deletedAt).toBeUndefined();

    activeFirestore = makeFakeFirestore({}).db;
    const r2 = makeReqRes({ query: { id: 'wl-missing' }, body: {} });
    await deleteHandler(r2.req, r2.res);
    expect(r2.res.statusCode).toBe(404);
    expect(r2.res.body.error).toBe('not_found');
  });

  it('returns 401 when no auth token is present', async () => {
    authReturnValue.current = null;
    activeFirestore = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST } },
    }).db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await deleteHandler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects non-POST methods with 405', async () => {
    activeFirestore = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST } },
    }).db;
    const { req, res } = makeReqRes({ method: 'GET', query: { id: 'wl-1' } });
    await deleteHandler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects a malformed watchlist id with 400 invalid_watchlist_id', async () => {
    activeFirestore = makeFakeFirestore({}).db;
    const { req, res } = makeReqRes({ query: { id: '../../../etc/passwd' }, body: {} });
    await deleteHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_watchlist_id');
  });

  it('emits a shadow log entry with stage=watchlist_delete', async () => {
    activeFirestore = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...DRAFT_WATCHLIST } },
    }).db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await deleteHandler(req, res);

    expect(res.statusCode).toBe(200);
    const log = shadowLogCalls.current.find((r) => r.stage === 'watchlist_delete');
    expect(log).toBeDefined();
    expect(log.watchlistId).toBe('wl-1');
    expect(log.idempotent).toBe(false);
  });
});

// ============================================================
// Soft-deleted watchlists 404 on the single-item endpoints (Phase 4D)
// ============================================================

describe('soft-deleted watchlists read as gone on every single-item endpoint', () => {
  const deletedDoc = () => ({ ...DRAFT_WATCHLIST, deletedAt: '2026-05-15T10:00:00.000Z' });

  it('GET /[id] returns 404 for a soft-deleted watchlist', async () => {
    activeFirestore = makeFakeFirestore({ watchlistDocs: { 'wl-1': deletedDoc() } }).db;
    const { req, res } = makeReqRes({ method: 'GET', query: { id: 'wl-1' } });
    await itemHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('PATCH /[id] returns 404 for a soft-deleted watchlist without mutating it', async () => {
    const fixture = makeFakeFirestore({ watchlistDocs: { 'wl-1': deletedDoc() } });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ method: 'PATCH', query: { id: 'wl-1' }, body: { name: 'x' } });
    await itemHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('not_found');
    expect(fixture.state.watchlistDocs['wl-1'].name).toBe('');
  });

  it('POST /[id]/commit returns 404 for a soft-deleted watchlist', async () => {
    activeFirestore = makeFakeFirestore({ watchlistDocs: { 'wl-1': deletedDoc() } }).db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await commitHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('POST /[id]/uncommit returns 404 for a soft-deleted watchlist', async () => {
    activeFirestore = makeFakeFirestore({
      watchlistDocs: { 'wl-1': { ...deletedDoc(), status: 'committed' } },
    }).db;
    const { req, res } = makeReqRes({ query: { id: 'wl-1' }, body: {} });
    await uncommitHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
