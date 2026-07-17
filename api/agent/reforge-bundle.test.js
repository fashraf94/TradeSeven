// api/agent/reforge-bundle.test.js
//
// WS1 enforce Phase 2 — base endpoint coverage under the REAL flags (no flag
// mocks!). This file is the §4 dependency-surface guard for the endpoint's
// api → src imports (featureFlags, ruleCompatEvaluate → the compat map +
// compatSurfaceCopy): the import below is REAL — it explodes in the Node test
// env if a browser dep ever enters the graph. NEVER mock featureFlags or the
// evaluator here; the mode walk lives in reforge-bundle.compat.test.js.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { authReturnValue, shadowLogCalls, sentinels } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  shadowLogCalls: { current: [] },
  sentinels: { DELETE: { __sentinel: 'delete' }, TS: '__server_ts__' },
}));

let activeFirestore = null;

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    delete: () => sentinels.DELETE,
    serverTimestamp: () => sentinels.TS,
    increment: (n) => ({ __inc: n }),
  },
}));
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
    return true;
  },
}));
vi.mock('@vercel/functions', () => ({
  waitUntil: (p) => p,
}));

// REAL flags + REAL evaluator graph — the dependency-surface guard.
const { default: handler } = await import('./reforge-bundle.js');

function makeFakeFirestore({ docs = {} } = {}) {
  const state = { docs, autoId: 0 };
  const makeRef = (path) => ({
    __path: path,
    id: path.split('/').pop(),
    get: async () => ({ exists: !!state.docs[path], data: () => state.docs[path] }),
    update: async (updates) => { Object.assign(state.docs[path], updates); },
    collection: (name) => makeCol(`${path}/${name}`),
  });
  const makeCol = (colPath) => ({
    doc: (id) => makeRef(`${colPath}/${id ?? `auto-${++state.autoId}`}`),
  });
  const runTransaction = async (fn) => fn({
    get: async (ref) => ref.get(),
    getAll: async (...refs) => Promise.all(refs.map((r) => r.get())),
    update: async (ref, updates) => ref.update(updates),
    set: async (ref, data) => { state.docs[ref.__path] = JSON.parse(JSON.stringify(data)); },
  });
  return { db: { collection: (name) => makeCol(name), runTransaction }, state };
}

function makeReqRes(body, method = 'POST') {
  const req = { method, body };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return { req, res };
}

const AGENT = 'agent-1';

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  shadowLogCalls.current = [];
  activeFirestore = null;
});

describe('POST /api/agent/reforge-bundle (real flags)', () => {
  it('happy path: forged bundle with no hard overrides → 200, archived + new draft, empty strippedConflicts', async () => {
    const fake = makeFakeFirestore({
      docs: {
        [`agents/${AGENT}`]: { ownerId: 'test-user', archetype: 'guardian', equippedBundleIds: [] },
        [`agents/${AGENT}/bundles/b1`]: {
          status: 'forged', name: 'B', version: 1, ruleIds: ['r1'], ruleHardness: {}, ruleSnapshots: [],
        },
      },
    });
    activeFirestore = fake.db;
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.strippedConflicts).toEqual([]);
    expect(res.body.bundleId).toMatch(/^auto-/);
    expect(fake.state.docs[`agents/${AGENT}/bundles/b1`].status).toBe('archived');
    const draft = fake.state.docs[`agents/${AGENT}/bundles/${res.body.bundleId}`];
    expect(draft).toMatchObject({ status: 'draft', version: 2, previousVersionId: 'b1', ruleIds: ['r1'] });
  });

  it('validation: bad agentId / bad bundleId → 400; non-POST → 405; unauthenticated → 401', async () => {
    let rr = makeReqRes({ agentId: 'bad id!', bundleId: 'b1' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(400);

    rr = makeReqRes({ agentId: AGENT, bundleId: 'bad id!' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(400);

    rr = makeReqRes({}, 'GET');
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(405);

    authReturnValue.current = null;
    rr = makeReqRes({ agentId: AGENT, bundleId: 'b1' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(401);
  });
});
