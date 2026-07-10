// api/agent/unequip-bundle.test.js
//
// Release 2 settingsRev migration (D3) — handler-level coverage for
// POST /api/agent/unequip-bundle. Verifies ownership, equipped-status
// validation, the activeRules rebuild from REMAINING bundles, the settingsRev
// increment, and the DELIBERATE absence of a battle-lock (the client
// unequipBundle never had one; reforge unequips as a sub-step — preserved).
//
// Pattern reference: api/agent/equip-bundle.test.js.

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

const { default: unequipBundleHandler } = await import('./unequip-bundle.js');

function makeFakeFirestore({ agentDocs = {}, bundleDocs = {} } = {}) {
  const state = { agentDocs, bundleDocs };

  const buildBundleRef = (agentId, bundleId) => ({
    id: bundleId,
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

function makeReqRes({ body, method = 'POST' } = {}) {
  const req = { method, body: body || {} };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return { req, res };
}

const AGENT_ID = 'agent-1';

function seed({ agent = {} } = {}) {
  const fake = makeFakeFirestore({
    agentDocs: {
      [AGENT_ID]: {
        ownerId: 'test-user',
        activeBattleId: null,
        equippedBundleIds: ['bundle-1', 'bundle-2'],
        ...agent,
      },
    },
    bundleDocs: {
      [`${AGENT_ID}/bundle-1`]: {
        name: 'Bundle One',
        status: 'equipped',
        ruleSnapshots: [{ id: 'r1', text: 'Rule one.', category: 'risk', sourceRef: null }],
      },
      [`${AGENT_ID}/bundle-2`]: {
        name: 'Bundle Two',
        status: 'equipped',
        ruleSnapshots: [{ id: 'r2', text: 'Rule two.', category: 'technical', sourceRef: null }],
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

describe('unequip-bundle', () => {
  it('unequips: bundle → forged, agent loses the id, activeRules rebuilt from the remainder, settingsRev bumped', async () => {
    const fake = seed();
    const { req, res } = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-1' } });
    await unequipBundleHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.equippedBundleIds).toEqual(['bundle-2']);
    const agent = fake.state.agentDocs[AGENT_ID];
    expect(agent.equippedBundleIds).toEqual(['bundle-2']);
    expect(agent.activeRules.map((r) => r.ruleId)).toEqual(['r2']);
    expect(agent.activeRules[0].bundleName).toBe('Bundle Two');
    expect(agent.settingsRev).toBeDefined();
    expect(fake.state.bundleDocs[`${AGENT_ID}/bundle-1`]).toMatchObject({ status: 'forged', equippedAt: null });
    expect(shadowLogCalls.current.some((c) => c.stage === 'bundle_unequip')).toBe(true);
  });

  it('DELIBERATELY does not battle-lock (reforge unequips mid-flow; historical client semantics preserved)', async () => {
    seed({ agent: { activeBattleId: 'battle-9' } });
    const { req, res } = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-1' } });
    await unequipBundleHandler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('400s a bundle that is not equipped', async () => {
    const fake = seed();
    fake.state.bundleDocs[`${AGENT_ID}/bundle-1`].status = 'forged';
    const { req, res } = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-1' } });
    await unequipBundleHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('not_equipped');
  });

  it('403s a foreign agent and 404s unknown agent/bundle', async () => {
    seed({ agent: { ownerId: 'someone-else' } });
    const foreign = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-1' } });
    await unequipBundleHandler(foreign.req, foreign.res);
    expect(foreign.res.statusCode).toBe(403);

    seed();
    const noBundle = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-9' } });
    await unequipBundleHandler(noBundle.req, noBundle.res);
    expect(noBundle.res.statusCode).toBe(404);
  });
});

describe('unequip-bundle — drifted state (status says equipped, agent never lists it)', () => {
  it('heals the bundle doc, skips the agent write entirely (no phantom settingsRev), logs nothing', async () => {
    const fake = seed({ agent: { equippedBundleIds: ['bundle-2'] } }); // bundle-1 NOT listed
    const { req, res } = makeReqRes({ body: { agentId: AGENT_ID, bundleId: 'bundle-1' } });
    await unequipBundleHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(res.body.equippedBundleIds).toEqual(['bundle-2']);
    // Bundle status healed…
    expect(fake.state.bundleDocs[`${AGENT_ID}/bundle-1`].status).toBe('forged');
    // …but the agent doc is untouched: no settingsRev mint, no activeRules rewrite.
    const agent = fake.state.agentDocs[AGENT_ID];
    expect(agent.settingsRev).toBeUndefined();
    expect(agent.activeRules).toBeUndefined();
    expect(shadowLogCalls.current).toHaveLength(0);
  });
});
