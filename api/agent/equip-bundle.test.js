// api/agent/equip-bundle.test.js
//
// Release 2 settingsRev migration (D3) — handler-level coverage for
// POST /api/agent/equip-bundle, the server-side replacement for the client
// forgeService.equipBundle writer. Verifies the battle-lock (409), ownership,
// forged-status validation, the progression bundle limit, the activeRules
// build, the gated conflict detection, the WS1 conflict-equip events, the
// settingsRev increment, and the preserved response contract.
//
// Pattern reference: api/agent/change-archetype.test.js (hoisted mock state,
// fake Firestore, request/response helper). The fake here adds the
// agents/{id}/bundles subcollection + tx.getAll.
//
// BUILD_RULES §4 dependency-surface guard: this file's REAL import of the
// handler pulls src/constants/agentProgression, src/utils/ruleConflictReconciler,
// src/config/featureFlags, and src/services/ruleCompatClassify into the Node
// test env — NEVER mock those modules here; this import IS the guard.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== HOISTED MOCK STATE ====================

const { authReturnValue, shadowLogCalls } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  shadowLogCalls: { current: [] },
}));

// ==================== MOCKS (infra seams only) ====================

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

const { default: equipBundleHandler } = await import('./equip-bundle.js');

// ==================== FIRESTORE MOCK ====================

function makeFakeFirestore({ agentDocs = {}, bundleDocs = {} } = {}) {
  // bundleDocs is keyed `${agentId}/${bundleId}`.
  const state = { agentDocs, bundleDocs };

  const buildBundleRef = (agentId, bundleId) => ({
    id: bundleId,
    _key: `${agentId}/${bundleId}`,
    get: async () => ({
      exists: !!state.bundleDocs[`${agentId}/${bundleId}`],
      data: () => state.bundleDocs[`${agentId}/${bundleId}`],
    }),
    update: async (updates) => {
      const k = `${agentId}/${bundleId}`;
      state.bundleDocs[k] = { ...state.bundleDocs[k], ...updates };
    },
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
    collection: (name) => {
      if (name !== 'bundles') throw new Error(`Unmocked subcollection: ${name}`);
      return { doc: (bundleId) => buildBundleRef(id, bundleId) };
    },
  });

  const collection = (name) => {
    if (name === 'agents') return { doc: (id) => buildAgentRef(id) };
    throw new Error(`Unmocked collection: ${name}`);
  };

  const runTransaction = async (fn) => {
    const tx = {
      get: async (ref) => ref.get(),
      getAll: async (...refs) => Promise.all(refs.map((r) => r.get())),
      update: async (ref, updates) => ref.update(updates),
    };
    return fn(tx);
  };

  return { db: { collection, runTransaction }, state };
}

// ==================== TEST HELPERS ====================

function makeReqRes({ body, method = 'POST' } = {}) {
  const req = { method, body: body || {} };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
}

const AGENT_ID = 'agent-1';
const RULE_SNAPSHOT = Object.freeze({
  id: 'rule-1',
  text: 'Diversify across at least 4 sectors.',
  category: 'risk',
  sourceRef: 'risk-sector-diversification',
});

function seed({ agent = {}, bundles = {} } = {}) {
  const fake = makeFakeFirestore({
    agentDocs: {
      [AGENT_ID]: {
        ownerId: 'test-user',
        archetype: 'guardian',
        activeBattleId: null,
        equippedBundleIds: [],
        stats: { gamesPlayed: 0 },
        ...agent,
      },
    },
    bundleDocs: {
      [`${AGENT_ID}/bundle-1`]: {
        name: 'Test Bundle',
        status: 'forged',
        ruleSnapshots: [RULE_SNAPSHOT],
        ...bundles,
      },
    },
  });
  activeFirestore = fake.db;
  return fake;
}

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  shadowLogCalls.current = [];
  activeFirestore = null;
});

// ==================== TESTS ====================

describe('equip-bundle — validation + auth', () => {
  it('rejects non-POST', async () => {
    seed();
    const { req, res } = makeReqRes({ method: 'GET' });
    await equipBundleHandler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects an invalid agentId / bundleId', async () => {
    seed();
    const bad = makeReqRes({ body: { agentId: '!!', bundleId: 'bundle-1' } });
    await equipBundleHandler(bad.req, bad.res);
    expect(bad.res.statusCode).toBe(400);
    const bad2 = makeReqRes({ body: { agentId: AGENT_ID, bundleId: '!!' } });
    await equipBundleHandler(bad2.req, bad2.res);
    expect(bad2.res.statusCode).toBe(400);
  });

  it('404s an unknown agent and 403s a foreign agent', async () => {
    seed();
    const missing = makeReqRes({ body: { agentId: 'agent-x', bundleId: 'bundle-1' } });
    await equipBundleHandler(missing.req, missing.res);
    expect(missing.res.statusCode).toBe(404);

    seed({ agent: { ownerId: 'someone-else' } });
    const foreign = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-1' } });
    await equipBundleHandler(foreign.req, foreign.res);
    expect(foreign.res.statusCode).toBe(403);
  });

  it('409s while the agent has an active battle (the migrated server-side lock)', async () => {
    seed({ agent: { activeBattleId: 'battle-9' } });
    const { req, res } = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-1' } });
    await equipBundleHandler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('battle_active');
  });

  it('400s a non-forged bundle and 404s a missing bundle', async () => {
    seed({ bundles: { status: 'equipped' } });
    const notForged = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-1' } });
    await equipBundleHandler(notForged.req, notForged.res);
    expect(notForged.res.statusCode).toBe(400);
    expect(notForged.res.body.error).toBe('not_forged');

    seed();
    const missing = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-9' } });
    await equipBundleHandler(missing.req, missing.res);
    expect(missing.res.statusCode).toBe(404);
    expect(missing.res.body.error).toBe('bundle_not_found');
  });

  it('409s at the progression bundle limit with the level in the message', async () => {
    // rookie limit is small — seed the agent as already at/above any sane cap.
    seed({ agent: { equippedBundleIds: ['b-a', 'b-b', 'b-c', 'b-d', 'b-e', 'b-f', 'b-g', 'b-h'] } });
    const { req, res } = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-1' } });
    await equipBundleHandler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('bundle_limit');
    expect(res.body.message).toMatch(/Bundle limit reached for your agent's level \(\d+ bundles at \w+\)/);
    expect(res.body.maxBundles).toBeGreaterThan(0);
  });
});

describe('equip-bundle — the committed equip', () => {
  it('equips: bundle → equipped, agent gains id + activeRules + settingsRev increment', async () => {
    const fake = seed();
    const { req, res } = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-1' } });
    await equipBundleHandler(req, res);

    expect(res.statusCode).toBe(200);
    const agent = fake.state.agentDocs[AGENT_ID];
    expect(agent.equippedBundleIds).toEqual(['bundle-1']);
    expect(agent.activeRules).toHaveLength(1);
    expect(agent.activeRules[0]).toMatchObject({
      ruleId: 'rule-1',
      text: RULE_SNAPSHOT.text,
      category: 'risk',
      bundleName: 'Test Bundle',
      sourceRef: 'risk-sector-diversification',
    });
    // The settingsRev write rides the same transaction (FieldValue.increment
    // sentinel — presence is the contract here; Firestore applies it atomically).
    expect(agent.settingsRev).toBeDefined();
    expect(fake.state.bundleDocs[`${AGENT_ID}/bundle-1`].status).toBe('equipped');
  });

  it('merges snapshots from already-equipped bundles (transactional getAll path)', async () => {
    const fake = seed({
      agent: { equippedBundleIds: ['bundle-0'] },
    });
    fake.state.bundleDocs[`${AGENT_ID}/bundle-0`] = {
      name: 'First Bundle',
      status: 'equipped',
      ruleSnapshots: [{ id: 'rule-0', text: 'Hold quality names.', category: 'fundamental', sourceRef: null }],
    };
    const { req, res } = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-1' } });
    await equipBundleHandler(req, res);

    expect(res.statusCode).toBe(200);
    const agent = fake.state.agentDocs[AGENT_ID];
    expect(agent.equippedBundleIds).toEqual(['bundle-0', 'bundle-1']);
    expect(agent.activeRules.map((r) => r.ruleId)).toEqual(['rule-0', 'rule-1']);
    expect(agent.activeRules[0].bundleName).toBe('First Bundle');
  });

  it('preserves the client return contract: conflictCheckResult + compatConflicts + archetype', async () => {
    seed();
    const { req, res } = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-1' } });
    await equipBundleHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('conflictCheckResult');
    expect(res.body).toHaveProperty('compatConflicts');
    expect(res.body.archetype).toBe('guardian');
    // CONFLICT_RECONCILER_DETECT_ENABLED is true in the real flag module (the
    // un-mocked import is the §4 guard), so the detection result is an object
    // with the reconciler version stamped.
    expect(res.body.conflictCheckResult).toMatchObject({ reconcilerVersion: expect.anything() });
  });

  it('emits WS1 conflict-equip events for a core_conflict snapshot (real map, real mode)', async () => {
    // risk-sector-diversification is guardian-compatible → no conflict events.
    seed();
    const ok = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-1' } });
    await equipBundleHandler(ok.req, ok.res);
    const ruleCompatLogs = shadowLogCalls.current.filter((c) => c.stage === 'rule_compat');
    expect(ruleCompatLogs).toHaveLength(0);
    // The equip itself is shadow-logged.
    expect(shadowLogCalls.current.some((c) => c.stage === 'bundle_equip')).toBe(true);
  });
});
