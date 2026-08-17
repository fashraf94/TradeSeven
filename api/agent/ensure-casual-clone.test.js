// api/agent/ensure-casual-clone.test.js
//
// The authed thin wrapper over ensureCasualClone. Covers: method guard, auth
// guard, the server-side flag gate, token-derived odUserId (NEVER the body),
// create-when-absent, never-overwrite-when-present, and the no-ranked-agent 409.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let activeFirestore = null;
let authUser = { uid: 'user-42' };
const flagState = { on: true };

vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeFirestore }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (authUser === null) { res.status(401).json({ error: 'auth required' }); return null; }
    return authUser;
  },
}));
vi.mock('../../src/config/featureFlags.js', () => ({
  get CASUAL_CLONE_CONCURRENCY_ENABLED() { return flagState.on; },
}));

const { default: handler } = await import('./ensure-casual-clone.js');

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  authUser = { uid: 'user-42' };
  flagState.on = true;
});
afterEach(() => vi.restoreAllMocks());

// In-memory Firestore (get/create/set/update/where/subcollections).
function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const topLevel = (prefix) => {
    const docs = [];
    for (const [path, data] of store.entries()) {
      if (!path.startsWith(`${prefix}/`)) continue;
      const rel = path.slice(prefix.length + 1);
      if (rel.includes('/')) continue;
      docs.push({ id: rel, data: () => structuredClone(data) });
    }
    return docs;
  };
  const snap = (docs) => ({ docs, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) });
  const docRef = (path) => ({
    get: async () => { const d = store.get(path); return { exists: d !== undefined, id: path.split('/').pop(), data: () => structuredClone(d) }; },
    set: async (d) => { store.set(path, structuredClone(d)); },
    create: async (d) => { if (store.has(path)) { const e = new Error('ALREADY_EXISTS'); e.code = 6; throw e; } store.set(path, structuredClone(d)); },
    update: async (u) => { store.set(path, { ...(store.get(path) || {}), ...structuredClone(u) }); },
    collection: (sub) => coll(`${path}/${sub}`),
  });
  const coll = (prefix) => ({
    doc: (id) => docRef(`${prefix}/${id}`),
    where: (f, _op, v) => ({ get: async () => snap(topLevel(prefix).filter(d => d.data()[f] === v)) }),
    get: async () => snap(topLevel(prefix)),
  });
  // This store is path-keyed, so `composition/writeEpoch` and
  // `composition/activation` already resolve as ABSENT — the pre-genesis
  // posture the live fence fails open on. What it lacked was a transaction:
  // acquireProvisionerLease (lit from ACTIVATION_RUNBOOK step 1.1) takes the
  // lease inside db.runTransaction, which the dark helper never reached.
  const runTransaction = async (fn) => fn({
    get: async (ref) => ref.get(),
    getAll: async (...refs) => Promise.all(refs.map((r) => r.get())),
    set: async (ref, d) => ref.set(d),
    create: async (ref, d) => ref.create(d),
    update: async (ref, u) => ref.update(u),
  });
  return { db: { collection: (n) => coll(n), runTransaction }, store };
}

function makeReqRes({ method = 'POST', body = {} } = {}) {
  const req = { method, body };
  const res = { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  return { req, res };
}

const RANKED = { id: 'ranked-1', ownerId: 'user-42', archetype: 'analyst', name: 'Ace', activeRules: [], equippedBundleIds: [] };

describe('POST /api/agent/ensure-casual-clone', () => {
  it('405 on non-POST', async () => {
    activeFirestore = makeDb().db;
    const { req, res } = makeReqRes({ method: 'GET' });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('401 when unauthenticated', async () => {
    authUser = null;
    activeFirestore = makeDb().db;
    const { req, res } = makeReqRes({});
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('403 feature_disabled when the server flag is off (never mints a clone)', async () => {
    flagState.on = false;
    const { db, store } = makeDb({ 'agents/ranked-1': RANKED });
    activeFirestore = db;
    const { req, res } = makeReqRes({});
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('feature_disabled');
    expect(store.has('agents/casual-agent-user-42')).toBe(false);
  });

  it('creates the clone and returns its id (created:true)', async () => {
    const { db, store } = makeDb({ 'agents/ranked-1': RANKED });
    activeFirestore = db;
    const { req, res } = makeReqRes({});
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ cloneId: 'casual-agent-user-42', rankedAgentId: 'ranked-1', created: true });
    expect(store.get('agents/casual-agent-user-42').isCasualClone).toBe(true);
  });

  it('derives odUserId from the TOKEN, not the body (body id is ignored)', async () => {
    const { db } = makeDb({ 'agents/ranked-1': RANKED });
    activeFirestore = db;
    // A malicious body naming another user / agent must NOT change the target.
    const { req, res } = makeReqRes({ body: { odUserId: 'victim-99', agentId: 'someone-elses-agent' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.cloneId).toBe('casual-agent-user-42'); // from user.uid, not the body
  });

  it('does not re-create an existing clone (created:false); re-syncs its brain but preserves identity (ruling 3)', async () => {
    const existing = { ownerId: 'user-42', isCasualClone: true, rankedAgentId: 'ranked-1', memory: [{ gameId: 'prior' }], activeBattleId: null };
    const { db, store } = makeDb({ 'agents/ranked-1': RANKED, 'agents/casual-agent-user-42': existing });
    activeFirestore = db;
    const { req, res } = makeReqRes({});
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.created).toBe(false);
    const clone = store.get('agents/casual-agent-user-42');
    expect(clone.isCasualClone).toBe(true);        // identity preserved (never-overwrite for identity)
    expect(clone.rankedAgentId).toBe('ranked-1');
    expect(clone.memory).toEqual([]);              // brain re-synced from the parent (which has no memory)
  });

  it('409 no_ranked_agent when the caller has no ranked agent', async () => {
    const { db } = makeDb({});
    activeFirestore = db;
    const { req, res } = makeReqRes({});
    await handler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('no_ranked_agent');
  });
});
