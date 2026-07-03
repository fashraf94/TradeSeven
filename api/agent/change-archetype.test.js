// api/agent/change-archetype.test.js
//
// Handler-level coverage for POST /api/agent/change-archetype. Verifies the
// battle-lock (409), idempotency, archetype validation, ownership, and the
// archetype_change shadow log.
//
// Pattern reference: api/agent/equip-watchlist.test.js (hoisted mock state,
// request/response helper, beforeEach reset). The fake Firestore here covers
// only the `agents` collection (single-doc read+write).
//
// WS1: this file's REAL (un-mocked) import of the handler — whose graph pulls
// src/config/featureFlags + api/_utils/ruleCompatCleanup (→ the compat map) —
// IS the BUILD_RULES §4 dependency-surface guard for those api → src edges.
// NEVER mock featureFlags here (the .compat.test.js sibling mocks it by
// design; THIS file is the guard).

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

const { default: changeArchetypeHandler } = await import('./change-archetype.js');

// ==================== FIRESTORE MOCK ====================

function makeFakeFirestore({ agentDocs = {} } = {}) {
  const state = { agentDocs };

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

  const collection = (name) => {
    if (name === 'agents') return { doc: (id) => buildAgentRef(id) };
    throw new Error(`Unmocked collection: ${name}`);
  };

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
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
  return { req, res };
}

const CHANGEABLE_AGENT = {
  ownerId: 'test-user',
  activeBattleId: null,
  archetype: 'analyst',
};

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  shadowLogCalls.current = [];
  activeFirestore = null;
});

// ============================================================
// POST /api/agent/change-archetype
// ============================================================

describe('POST /api/agent/change-archetype', () => {
  it('happy path: 200, archetype + updatedAt written, shadow log emitted', async () => {
    const fx = makeFakeFirestore({ agentDocs: { 'agent-1': { ...CHANGEABLE_AGENT } } });
    activeFirestore = fx.db;

    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', archetype: 'guardian' } });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.agentId).toBe('agent-1');
    expect(res.body.archetype).toBe('guardian');
    expect(res.body.idempotent).toBe(false);

    const agent = fx.state.agentDocs['agent-1'];
    expect(agent.archetype).toBe('guardian');
    expect(typeof agent.updatedAt).toBe('string');

    const log = shadowLogCalls.current.find((r) => r.stage === 'archetype_change');
    expect(log).toBeDefined();
    expect(log.userId).toBe('test-user');
    expect(log.agentId).toBe('agent-1');
    expect(log.fromArchetype).toBe('analyst');
    expect(log.toArchetype).toBe('guardian');
  });

  it('idempotent: same archetype → 200 idempotent, no write, no shadow log', async () => {
    const fx = makeFakeFirestore({ agentDocs: { 'agent-1': { ...CHANGEABLE_AGENT, archetype: 'degen' } } });
    activeFirestore = fx.db;

    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', archetype: 'degen' } });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(res.body.archetype).toBe('degen');
    // No write occurred → updatedAt was never stamped.
    expect(fx.state.agentDocs['agent-1'].updatedAt).toBeUndefined();
    expect(shadowLogCalls.current.find((r) => r.stage === 'archetype_change')).toBeUndefined();
  });

  it('agent has an active battle → 409 battle_active, archetype unchanged', async () => {
    const fx = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...CHANGEABLE_AGENT, activeBattleId: 'battle-99' } },
    });
    activeFirestore = fx.db;

    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', archetype: 'guardian' } });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('battle_active');
    expect(fx.state.agentDocs['agent-1'].archetype).toBe('analyst');
    expect(shadowLogCalls.current).toHaveLength(0);
  });

  it('unknown archetype code → 400 invalid_archetype, no write', async () => {
    const fx = makeFakeFirestore({ agentDocs: { 'agent-1': { ...CHANGEABLE_AGENT } } });
    activeFirestore = fx.db;

    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', archetype: 'Trend Follower' } });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_archetype');
    expect(fx.state.agentDocs['agent-1'].archetype).toBe('analyst');
  });

  it('all six code-ids are accepted', async () => {
    for (const code of ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian']) {
      const fx = makeFakeFirestore({ agentDocs: { 'agent-1': { ...CHANGEABLE_AGENT, archetype: 'momentum_chaser' } } });
      activeFirestore = fx.db;
      const { req, res } = makeReqRes({ body: { agentId: 'agent-1', archetype: code } });
      await changeArchetypeHandler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.archetype).toBe(code);
    }
  });

  it('agent owned by a different user → 403 forbidden, no write', async () => {
    const fx = makeFakeFirestore({
      agentDocs: { 'agent-1': { ...CHANGEABLE_AGENT, ownerId: 'other-user' } },
    });
    activeFirestore = fx.db;

    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', archetype: 'guardian' } });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('forbidden');
    expect(fx.state.agentDocs['agent-1'].archetype).toBe('analyst');
  });

  it('agent does not exist → 404 agent_not_found', async () => {
    activeFirestore = makeFakeFirestore({}).db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-missing', archetype: 'guardian' } });
    await changeArchetypeHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('agent_not_found');
  });

  it('no auth → 401', async () => {
    authReturnValue.current = null;
    activeFirestore = makeFakeFirestore({ agentDocs: { 'agent-1': { ...CHANGEABLE_AGENT } } }).db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', archetype: 'guardian' } });
    await changeArchetypeHandler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects a malformed agentId with 400 invalid_agent_id', async () => {
    activeFirestore = makeFakeFirestore({}).db;
    const { req, res } = makeReqRes({ body: { agentId: '../../etc/passwd', archetype: 'guardian' } });
    await changeArchetypeHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_agent_id');
  });

  it('rejects non-POST methods with 405', async () => {
    activeFirestore = makeFakeFirestore({}).db;
    const { req, res } = makeReqRes({ method: 'GET', body: {} });
    await changeArchetypeHandler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
