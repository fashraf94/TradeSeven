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
// src/config/featureFlags + api/_utils/ruleCompatCleanup (→ the compat map)
// + api/_utils/leanRevalidation (→ src/data/archetypeAdjustments, the
// Release-2 lean rider) + api/_utils/archetypeSeeding (→ src/data/traitLibrary
// + src/data/traitEquip, the born-with seed planner) — IS the BUILD_RULES §4
// dependency-surface guard for those api → src edges. NEVER mock featureFlags
// here (the .compat.test.js / .leanrider.test.js siblings mock it by design;
// THIS file is the guard).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ARCHETYPE_DEFAULT_TRAITS } from '../../src/data/traitLibrary.js';

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

// Fake Firestore: agents collection + per-agent rules/bundles subcollections
// (the seed creates rule docs via tx.set; the post-commit cleanup + rescan read
// them back). A shared mutable store backs both in-tx writes and post-tx reads.
function makeFakeFirestore({ agentDocs = {}, subcollections = {} } = {}) {
  const state = { agentDocs, subcollections };
  let autoSeq = 0;

  const store = (agentId, sub) => {
    state.subcollections[agentId] = state.subcollections[agentId] || {};
    state.subcollections[agentId][sub] = state.subcollections[agentId][sub] || [];
    return state.subcollections[agentId][sub];
  };

  const buildDocRef = (agentId, sub, docId) => ({
    id: docId,
    get: async () => {
      const d = store(agentId, sub).find((x) => x.id === docId);
      return { exists: !!d, id: docId, data: () => d };
    },
    set: async (data) => {
      const arr = store(agentId, sub);
      const i = arr.findIndex((x) => x.id === docId);
      const doc = { id: docId, ...data };
      if (i >= 0) arr[i] = doc; else arr.push(doc);
    },
    update: async (updates) => {
      const arr = store(agentId, sub);
      const i = arr.findIndex((x) => x.id === docId);
      if (i >= 0) arr[i] = { ...arr[i], ...updates };
    },
  });

  const buildCollectionRef = (agentId, sub) => ({
    get: async () => ({ docs: store(agentId, sub).map((d) => ({ id: d.id, data: () => d })) }),
    doc: (docId) => buildDocRef(agentId, sub, docId ?? `seed-${++autoSeq}`),
  });

  const buildAgentRef = (id) => ({
    id,
    get: async () => ({
      exists: !!state.agentDocs[id],
      data: () => state.agentDocs[id],
    }),
    update: async (updates) => {
      state.agentDocs[id] = { ...state.agentDocs[id], ...updates };
    },
    collection: (sub) => buildCollectionRef(id, sub),
  });

  const collection = (name) => {
    if (name === 'agents') return { doc: (id) => buildAgentRef(id) };
    throw new Error(`Unmocked collection: ${name}`);
  };

  const runTransaction = async (fn) => {
    const tx = {
      get: async (ref) => ref.get(),
      set: async (ref, data) => ref.set(data),
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
  it('happy path: 200, archetype + born-with traits written atomically, shadow log emitted', async () => {
    const fx = makeFakeFirestore({ agentDocs: { 'agent-1': { ...CHANGEABLE_AGENT } } });
    activeFirestore = fx.db;

    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', archetype: 'guardian' } });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.agentId).toBe('agent-1');
    expect(res.body.archetype).toBe('guardian');
    expect(res.body.idempotent).toBe(false);
    // The mocked logSignalDrops resolves undefined (never true), so the honest
    // rescanLogged stays false — the archetype change itself still committed.
    expect(res.body.rescanLogged).toBe(false);

    const agent = fx.state.agentDocs['agent-1'];
    expect(agent.archetype).toBe('guardian');
    expect(typeof agent.updatedAt).toBe('string');

    // THE INVARIANT: archetype change loaded guardian's born-with set atomically.
    expect(agent.equippedTraits.map((t) => t.traitId)).toEqual(ARCHETYPE_DEFAULT_TRAITS.guardian);
    expect(res.body.seeded).toMatchObject({ traitCount: ARCHETYPE_DEFAULT_TRAITS.guardian.length });
    expect(res.body.seeded.rulesAdded).toBeGreaterThan(0);
    // Rule docs created under agents/{id}/rules — all born-with (traitId set,
    // provenance archetype_default → reconciler tier 2), none pre-deleted.
    const rules = fx.state.subcollections['agent-1'].rules;
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((r) => r.traitId && r.provenance === 'archetype_default' && r.isDeleted === false)).toBe(true);
    expect(new Set(rules.map((r) => r.traitId))).toEqual(new Set(ARCHETYPE_DEFAULT_TRAITS.guardian));

    const log = shadowLogCalls.current.find((r) => r.stage === 'archetype_change');
    expect(log).toBeDefined();
    expect(log.userId).toBe('test-user');
    expect(log.agentId).toBe('agent-1');
    expect(log.fromArchetype).toBe('analyst');
    expect(log.toArchetype).toBe('guardian');
  });

  it('atomic replace: the trait layer swaps to the new born-with set; old trait docs soft-deleted, manual rules survive', async () => {
    const fx = makeFakeFirestore({
      agentDocs: {
        'agent-1': {
          ...CHANGEABLE_AGENT,
          archetype: 'momentum_chaser',
          equippedTraits: [{ traitId: 'trait-trend-rider', strength: 'moderate', isCustom: false, equippedAt: 1 }],
        },
      },
      subcollections: {
        'agent-1': {
          rules: [
            // outgoing trait doc — its traitId leaves equippedTraits, so it must
            // be soft-deleted by the post-commit cleanup.
            { id: 'old-1', traitId: 'trait-trend-rider', sourceRef: 'tech-moving-average-trend', isDeleted: false, provenance: 'archetype_default' },
            // a manual rule (no traitId) — MUST survive the replace untouched.
            { id: 'manual-1', traitId: null, sourceRef: 'custom', isDeleted: false },
          ],
        },
      },
    });
    activeFirestore = fx.db;

    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', archetype: 'guardian' } });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(200);
    const agent = fx.state.agentDocs['agent-1'];
    expect(agent.equippedTraits.map((t) => t.traitId)).toEqual(ARCHETYPE_DEFAULT_TRAITS.guardian);

    const rules = fx.state.subcollections['agent-1'].rules;
    // Outgoing trait doc soft-deleted (traitId ∉ guardian's born-with set).
    expect(rules.find((r) => r.id === 'old-1').isDeleted).toBe(true);
    // Manual rule (no traitId) untouched.
    expect(rules.find((r) => r.id === 'manual-1').isDeleted).toBe(false);
    // The only ACTIVE trait docs are guardian's born-with set.
    const activeTraitIds = new Set(rules.filter((r) => r.traitId && !r.isDeleted).map((r) => r.traitId));
    expect(activeTraitIds).toEqual(new Set(ARCHETYPE_DEFAULT_TRAITS.guardian));
  });

  it('idempotent: same archetype → 200 idempotent, no write, no shadow log', async () => {
    const fx = makeFakeFirestore({ agentDocs: { 'agent-1': { ...CHANGEABLE_AGENT, archetype: 'degen' } } });
    activeFirestore = fx.db;

    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', archetype: 'degen' } });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(res.body.archetype).toBe('degen');
    // No write occurred → updatedAt never stamped, NO re-seed (equippedTraits
    // untouched, no seed summary in the response).
    expect(fx.state.agentDocs['agent-1'].updatedAt).toBeUndefined();
    expect(fx.state.agentDocs['agent-1'].equippedTraits).toBeUndefined();
    expect(res.body.seeded).toBeUndefined();
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
