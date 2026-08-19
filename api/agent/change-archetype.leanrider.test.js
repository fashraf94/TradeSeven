// api/agent/change-archetype.leanrider.test.js
//
// Release 2 /code-review hardening — the lean-invalidation rider must NOT be
// silenced by a RULE_COMPAT_MODE rollback (the two flags walk separately).
// This file pins RULE_COMPAT_MODE to 'off' (so the WS1 rescan never runs)
// and proves the rider still records via its standalone stage. The
// compat-ON attachment path is covered by change-archetype.compat.test.js.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeCompositionStoreDouble } from '../_utils/__fixtures__/compositionStoreDouble.js';

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
  COMPILER_ENABLED: false, // P2.4a: keep the dark compiler dark under this suite's flag mock
  PROFIT_TARGET_EXECUTOR_ENABLED: false, // Ask 3: dark; compileBuild reads it at module scope (via compileOnSettingsChange) — a hermetic mock must list it
  RULE_COMPAT_MODE: 'off',
}));

const { default: changeArchetypeHandler } = await import('./change-archetype.js');

function makeFakeFirestore({ agentDocs = {}, subcollections = {} } = {}) {
  // ACTIVATION_RUNBOOK step 1.1: the write-epoch fence is LIVE, so the
  // endpoint's validateWriteEpochInTx genuinely reads composition/writeEpoch
  // inside the transaction. Model the PRE-GENESIS store (both docs absent =>
  // the fence fails open) instead of mocking the flag back to dark.
  const __composition = makeCompositionStoreDouble();
  const state = { agentDocs, subcollections };
  let autoSeq = 0;
  const store = (id, sub) => {
    state.subcollections[id] = state.subcollections[id] || {};
    state.subcollections[id][sub] = state.subcollections[id][sub] || [];
    return state.subcollections[id][sub];
  };
  const buildDocRef = (id, sub, docId) => ({
    id: docId,
    get: async () => { const d = store(id, sub).find((x) => x.id === docId); return { exists: !!d, id: docId, data: () => d }; },
    set: async (data) => { const arr = store(id, sub); const i = arr.findIndex((x) => x.id === docId); const doc = { id: docId, ...data }; if (i >= 0) arr[i] = doc; else arr.push(doc); },
    update: async (updates) => { const arr = store(id, sub); const i = arr.findIndex((x) => x.id === docId); if (i >= 0) arr[i] = { ...arr[i], ...updates }; },
  });
  const buildAgentRef = (id) => ({
    id,
    get: async () => ({ exists: !!state.agentDocs[id], data: () => state.agentDocs[id] }),
    update: async (updates) => { state.agentDocs[id] = { ...state.agentDocs[id], ...updates }; },
    collection: (sub) => ({
      get: async () => ({ docs: store(id, sub).map((d) => ({ id: d.id, data: () => d })) }),
      doc: (docId) => buildDocRef(id, sub, docId ?? `seed-${++autoSeq}`),
    }),
  });
  return {
    collection: (name) => {
      if (name === 'agents') return { doc: (id) => buildAgentRef(id) };
      const __c = __composition.collection(name);
      if (__c) return __c;
      throw new Error(`Unmocked collection: ${name}`);
    },
    runTransaction: async (fn) =>
      fn({ get: async (ref) => ref.get(), set: async (ref, data) => ref.set(data), update: async (ref, updates) => ref.update(updates) }),
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
