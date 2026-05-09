// api/forge/watchlist-dialogue-abandon.test.js
//
// Sprint 6 Phase 3.6 PR 1 — handler-level coverage for the abandon endpoint.
// Tests the lifecycle transitions (active → abandoned / finalize_intent),
// idempotency on already-terminal sessions, validation, and auth.
//
// Per Phase 3.5 Finding 5 carry-forward (deferred to Phase 3.6 PR 3): real
// concurrent_modification stress coverage uses a more sophisticated
// runTransaction mock. PR 1 uses the simplified passthrough mock — the
// abandon endpoint's status-decision logic is the value here, not concurrency.

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

const { default: handler } = await import('./watchlist-dialogue-abandon.js');

// ==================== FIRESTORE MOCK ====================

function makeFakeFirestore({ initialSession }) {
  const state = {
    sessionDocs: {
      'session-1': initialSession ? { ...initialSession } : null,
    },
  };

  const buildSessionRef = (id) => ({
    id,
    get: async () => ({
      exists: !!state.sessionDocs[id],
      data: () => state.sessionDocs[id],
    }),
  });

  const collection = (name) => {
    if (name === 'watchlistSessions') {
      return { doc: (id) => buildSessionRef(id) };
    }
    throw new Error(`Unmocked collection: ${name}`);
  };

  // Simplified passthrough mock — same shape as watchlist-dialogue.test.js.
  // Real concurrency stress coverage lands in Phase 3.6 PR 3.
  const runTransaction = async (fn) => {
    const tx = {
      get: async (ref) => ref.get(),
      update: async (ref, updates) => {
        state.sessionDocs[ref.id] = { ...state.sessionDocs[ref.id], ...updates };
      },
    };
    return fn(tx);
  };

  return { db: { collection, runTransaction }, state };
}

// ==================== TEST HELPERS ====================

function makeReqRes(body, method = 'POST') {
  const req = { method, body };
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

const ACTIVE_SESSION = {
  userId: 'test-user',
  agentId: 'agent-1',
  status: 'active',
  startedAt: '2026-05-08T12:00:00.000Z',
  updatedAt: '2026-05-08T12:00:00.000Z',
};

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  shadowLogCalls.current = [];
  activeFirestore = null;
});

// ==================== HAPPY PATH ====================

describe('watchlist-dialogue-abandon — happy path', () => {
  it('flips active → abandoned with reason=user_close', async () => {
    const fixture = makeFakeFirestore({ initialSession: ACTIVE_SESSION });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-1',
      reason: 'user_close',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('abandoned');
    expect(res.body.abandonReason).toBe('user_close');
    expect(res.body.idempotent).toBe(false);
    expect(typeof res.body.abandonedAt).toBe('string');
    expect(fixture.state.sessionDocs['session-1'].status).toBe('abandoned');
    expect(fixture.state.sessionDocs['session-1'].abandonReason).toBe('user_close');
  });

  it('flips active → finalize_intent with reason=finalize_intent', async () => {
    const fixture = makeFakeFirestore({ initialSession: ACTIVE_SESSION });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-1',
      reason: 'finalize_intent',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('finalize_intent');
    expect(res.body.abandonReason).toBe('finalize_intent');
    expect(res.body.idempotent).toBe(false);
    expect(fixture.state.sessionDocs['session-1'].status).toBe('finalize_intent');
  });

  it('updates updatedAt alongside status fields', async () => {
    const fixture = makeFakeFirestore({ initialSession: ACTIVE_SESSION });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-1',
      reason: 'user_close',
    });
    await handler(req, res);
    const after = fixture.state.sessionDocs['session-1'];
    expect(after.updatedAt).toBe(after.abandonedAt);
    expect(after.updatedAt).not.toBe(ACTIVE_SESSION.updatedAt);
  });

  it('shadow logs with stage=dialogue_abandon and previousStatus=active', async () => {
    const fixture = makeFakeFirestore({ initialSession: ACTIVE_SESSION });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-1',
      reason: 'user_close',
    });
    await handler(req, res);
    expect(shadowLogCalls.current).toHaveLength(1);
    const logged = shadowLogCalls.current[0];
    expect(logged.stage).toBe('dialogue_abandon');
    expect(logged.reason).toBe('user_close');
    expect(logged.previousStatus).toBe('active');
    expect(logged.newStatus).toBe('abandoned');
    expect(logged.idempotent).toBe(false);
  });
});

// ==================== IDEMPOTENCY ====================

describe('watchlist-dialogue-abandon — idempotency', () => {
  it('returns 200 idempotent when session is already abandoned', async () => {
    const fixture = makeFakeFirestore({
      initialSession: {
        ...ACTIVE_SESSION,
        status: 'abandoned',
        abandonReason: 'user_close',
        abandonedAt: '2026-05-08T13:00:00.000Z',
      },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-1',
      reason: 'user_close',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(res.body.status).toBe('abandoned');
    expect(res.body.abandonedAt).toBe('2026-05-08T13:00:00.000Z');
  });

  it('returns 200 idempotent when session is already finalize_intent', async () => {
    const fixture = makeFakeFirestore({
      initialSession: {
        ...ACTIVE_SESSION,
        status: 'finalize_intent',
        abandonReason: 'finalize_intent',
        abandonedAt: '2026-05-08T13:00:00.000Z',
      },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-1',
      reason: 'finalize_intent',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(res.body.status).toBe('finalize_intent');
  });

  it('preserves the original reason on cross-reason idempotent calls', async () => {
    // First call wins. If a second call arrives with a different reason
    // (e.g., user double-clicked the close X after also tapping finalize),
    // the response reflects the original terminal state, not the new reason.
    const fixture = makeFakeFirestore({
      initialSession: {
        ...ACTIVE_SESSION,
        status: 'abandoned',
        abandonReason: 'user_close',
        abandonedAt: '2026-05-08T13:00:00.000Z',
      },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-1',
      reason: 'finalize_intent',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(res.body.status).toBe('abandoned');
    expect(res.body.abandonReason).toBe('user_close');
  });

  it('shadow logs idempotent calls with previousStatus matching current state', async () => {
    const fixture = makeFakeFirestore({
      initialSession: {
        ...ACTIVE_SESSION,
        status: 'abandoned',
        abandonReason: 'user_close',
        abandonedAt: '2026-05-08T13:00:00.000Z',
      },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-1',
      reason: 'user_close',
    });
    await handler(req, res);
    const logged = shadowLogCalls.current[0];
    expect(logged.idempotent).toBe(true);
    expect(logged.previousStatus).toBe('abandoned');
    expect(logged.newStatus).toBe('abandoned');
  });
});

// ==================== AUTH + OWNERSHIP ====================

describe('watchlist-dialogue-abandon — auth + ownership', () => {
  it('returns 403 when sessionId belongs to a different user', async () => {
    const fixture = makeFakeFirestore({
      initialSession: { ...ACTIVE_SESSION, userId: 'other-user' },
    });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-1',
      reason: 'user_close',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('forbidden');
    // Don't mutate state on auth failure
    expect(fixture.state.sessionDocs['session-1'].status).toBe('active');
  });

  it('returns 400 agent_session_mismatch when agentId differs from session', async () => {
    const fixture = makeFakeFirestore({ initialSession: ACTIVE_SESSION });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-2',
      reason: 'user_close',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('agent_session_mismatch');
    expect(fixture.state.sessionDocs['session-1'].status).toBe('active');
  });

  it('returns 401 when no auth token is present', async () => {
    authReturnValue.current = null;
    const fixture = makeFakeFirestore({ initialSession: ACTIVE_SESSION });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-1',
      reason: 'user_close',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});

// ==================== VALIDATION ====================

describe('watchlist-dialogue-abandon — validation', () => {
  it('returns 400 when reason is missing', async () => {
    const fixture = makeFakeFirestore({ initialSession: ACTIVE_SESSION });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-1',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_reason');
  });

  it('returns 400 when reason is not in the 2-value enum (rejects budget_exceeded)', async () => {
    const fixture = makeFakeFirestore({ initialSession: ACTIVE_SESSION });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-1',
      reason: 'budget_exceeded',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_reason');
  });

  it('returns 400 when sessionId is missing', async () => {
    const fixture = makeFakeFirestore({ initialSession: ACTIVE_SESSION });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      reason: 'user_close',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_session_id');
  });

  it('returns 400 when sessionId contains slashes (path injection guard)', async () => {
    const fixture = makeFakeFirestore({ initialSession: ACTIVE_SESSION });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'evil/../other',
      agentId: 'agent-1',
      reason: 'user_close',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_session_id');
  });

  it('returns 400 when agentId is malformed', async () => {
    const fixture = makeFakeFirestore({ initialSession: ACTIVE_SESSION });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'has spaces',
      reason: 'user_close',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_agent_id');
  });

  it('returns 405 for non-POST methods', async () => {
    const fixture = makeFakeFirestore({ initialSession: ACTIVE_SESSION });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes(
      { sessionId: 'session-1', agentId: 'agent-1', reason: 'user_close' },
      'GET',
    );
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

// ==================== NOT FOUND ====================

describe('watchlist-dialogue-abandon — not found', () => {
  it('returns 404 when sessionId does not exist', async () => {
    const fixture = makeFakeFirestore({ initialSession: null });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      sessionId: 'session-1',
      agentId: 'agent-1',
      reason: 'user_close',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
