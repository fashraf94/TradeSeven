// api/agent/change-archetype.leanrider.test.js
//
// Release 2 /code-review hardening — the lean-invalidation rider must NOT be
// silenced by a RULE_COMPAT_MODE rollback (the two flags walk separately).
// This file pins RULE_COMPAT_MODE to 'off' (so the WS1 rescan never runs)
// and proves the rider still records via its standalone stage. The
// compat-ON attachment path is covered by change-archetype.compat.test.js.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { authReturnValue, shadowLogCalls } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  shadowLogCalls: { current: [] },
}));

let activeFirestore = null;

vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => activeFirestore,
}));
vi.mock('../_utils/security.js', () => ({
  applySecurityMiddleware: () => false,
}));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async () => authReturnValue.current,
}));
vi.mock('../_utils/shadowLogger.js', () => ({
  logSignalDrops: async (record) => {
    shadowLogCalls.current.push(record);
  },
}));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));
vi.mock('../../src/config/featureFlags.js', () => ({
  RULE_COMPAT_MODE: 'off',
}));

const { default: changeArchetypeHandler } = await import('./change-archetype.js');

function makeFakeFirestore({ agentDocs = {} } = {}) {
  const state = { agentDocs };
  const buildAgentRef = (id) => ({
    get: async () => ({ exists: !!state.agentDocs[id], data: () => state.agentDocs[id] }),
    update: async (updates) => { state.agentDocs[id] = { ...state.agentDocs[id], ...updates }; },
    collection: () => ({ get: async () => ({ docs: [] }) }),
  });
  return {
    collection: (name) => {
      if (name === 'agents') return { doc: (id) => buildAgentRef(id) };
      throw new Error(`Unmocked collection: ${name}`);
    },
    runTransaction: async (fn) =>
      fn({ get: async (ref) => ref.get(), update: async (ref, updates) => ref.update(updates) }),
    _state: state,
  };
}

function makeReqRes(body) {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return [{ method: 'POST', body }, res];
}

const AGENT_ID = 'agent-1';

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  shadowLogCalls.current = [];
  activeFirestore = null;
});

describe('change-archetype — lean rider survives RULE_COMPAT_MODE=off (standalone stage)', () => {
  it('records the invalidation via standing_lean_invalidation when the rescan cannot run', async () => {
    activeFirestore = makeFakeFirestore({
      agentDocs: {
        [AGENT_ID]: {
          ownerId: 'test-user',
          archetype: 'momentum_chaser',
          activeBattleId: null,
          equippedTraits: [],
          standingLeans: [{ adjustmentId: 'TF-02', version: 1, equippedAt: 't' }],
        },
      },
    });
    const [req, res] = makeReqRes({ agentId: AGENT_ID, archetype: 'guardian' });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(200);
    // No rescan (compat off) — response stays byte-identical to legacy off…
    expect(res.body).not.toHaveProperty('rescanLogged');
    expect(shadowLogCalls.current.filter((r) => r.stage === 'rule_compat')).toHaveLength(0);
    // …but the lean rider still recorded, standalone.
    const rider = shadowLogCalls.current.find((r) => r.stage === 'standing_lean_invalidation');
    expect(rider).toMatchObject({
      agentId: AGENT_ID,
      archetype: 'guardian',
      previousArchetype: 'momentum_chaser',
      equippedCount: 1,
      invalidatedCount: 1,
      invalidated: [{ adjustmentId: 'TF-02', version: 1, reason: 'not_in_menu' }],
    });
    // Lean DATA untouched (durable desired state).
    expect(activeFirestore._state.agentDocs[AGENT_ID].standingLeans).toHaveLength(1);
  });

  it('agents without leans add no standalone record (byte-identical off behavior)', async () => {
    activeFirestore = makeFakeFirestore({
      agentDocs: {
        [AGENT_ID]: { ownerId: 'test-user', archetype: 'momentum_chaser', activeBattleId: null, equippedTraits: [] },
      },
    });
    const [req, res] = makeReqRes({ agentId: AGENT_ID, archetype: 'guardian' });
    await changeArchetypeHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(shadowLogCalls.current.filter((r) => r.stage === 'standing_lean_invalidation')).toHaveLength(0);
  });
});
