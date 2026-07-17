// api/agent/reforge-bundle.compat.test.js
//
// WS1 §6.2/§6.3 coverage for the B3 carry path AT ITS NEW HOME — the matrix
// suite (src/services/ruleCompatMatrix.test.js) proved these against the
// client reforgeBundle until WS1 enforce Phase 2 moved the write server-side
// (the equip-bundle.compat.test.js D3 precedent). RULE_COMPAT_MODE is a code
// constant bound at module load: THIS file walks it off/observe/enforce via
// a getter mock; reforge-bundle.test.js runs the REAL flags and is the §4
// dependency-surface guard (never mock flags there).
//
// The compat map + evaluator kernel run UN-mocked.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { flagState, authReturnValue, shadowLogCalls, sentinels } = vi.hoisted(() => ({
  flagState: { mode: 'off' },
  authReturnValue: { current: { uid: 'test-user' } },
  shadowLogCalls: { current: [] },
  sentinels: {
    DELETE: { __sentinel: 'delete' },
    TS: '__server_ts__',
  },
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
  requireAuth: async () => authReturnValue.current,
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
vi.mock('../../src/config/featureFlags.js', () => ({
  get RULE_COMPAT_MODE() { return flagState.mode; },
}));

const { default: handler } = await import('./reforge-bundle.js');

// ============ FIRESTORE FAKE (dotted paths, delete/increment sentinels, tx.set) ============

function applyUpdates(target, updates) {
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split('.');
    let obj = target;
    for (const p of parts.slice(0, -1)) {
      if (typeof obj[p] !== 'object' || obj[p] === null) obj[p] = {};
      obj = obj[p];
    }
    const leaf = parts[parts.length - 1];
    if (value === sentinels.DELETE) delete obj[leaf];
    else if (value && typeof value === 'object' && '__inc' in value) obj[leaf] = (obj[leaf] || 0) + value.__inc;
    else obj[leaf] = value;
  }
}

function makeFakeFirestore({ docs = {} } = {}) {
  const state = { docs, reads: [], autoId: 0 };
  const makeRef = (path) => ({
    __path: path,
    id: path.split('/').pop(),
    get: async () => {
      state.reads.push(path);
      return { exists: !!state.docs[path], data: () => state.docs[path] };
    },
    update: async (updates) => {
      if (!state.docs[path]) throw new Error(`update on missing doc: ${path}`);
      applyUpdates(state.docs[path], updates);
    },
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
const agentPath = `agents/${AGENT}`;
const bundlePath = (id) => `agents/${AGENT}/bundles/${id}`;
const rulePath = (id) => `agents/${AGENT}/rules/${id}`;

// Cell vocabulary (shipped map — the matrix suite's B3 fixtures):
//  guardian × tech-bollinger-squeeze → core_conflict, technical (soft category)
//  guardian × ts-01                  → NATIVE, tier_strategy
//  guardian × a-05                   → core_conflict, allocation (hard category)
function seedForged({ agent = {}, bundle = {}, extraDocs = {} } = {}) {
  const fake = makeFakeFirestore({
    docs: {
      [agentPath]: { ownerId: 'test-user', archetype: 'guardian', activeBattleId: null, equippedBundleIds: [], settingsRev: 3, ...agent },
      [bundlePath('b1')]: {
        status: 'forged', name: 'B', version: 1, ruleIds: ['rc', 'rn', 'rs'],
        ruleHardness: { rc: 'hard', rn: 'hard', rs: 'soft' },
        ruleSnapshots: [],
        ...bundle,
      },
      [rulePath('rc')]: { sourceRef: 'tech-bollinger-squeeze', category: 'technical', isDeleted: false },
      [rulePath('rn')]: { sourceRef: 'ts-01', category: 'tier_strategy', isDeleted: false },
      [rulePath('rs')]: { sourceRef: 'a-05', category: 'allocation', isDeleted: false },
      ...extraDocs,
    },
  });
  activeFirestore = fake.db;
  return fake;
}

const newDraft = (fake) =>
  Object.entries(fake.state.docs).find(([p, d]) => p.includes('/bundles/auto-') && d.status === 'draft')?.[1];

const ruleCompatEvents = () =>
  shadowLogCalls.current.filter((c) => c.stage === 'rule_compat').flatMap((c) => c.events || []);

beforeEach(() => {
  flagState.mode = 'off';
  authReturnValue.current = { uid: 'test-user' };
  shadowLogCalls.current = [];
  activeFirestore = null;
});

describe('reforge-bundle × RULE_COMPAT_MODE (the migrated B3 matrix cells)', () => {
  it('ENFORCE: strips ONLY the conflict hard-override, logs it blocked:true, returns it for the inline notice', async () => {
    flagState.mode = 'enforce';
    const fake = seedForged();
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.bundleId).toMatch(/^auto-/);
    expect(res.body.strippedConflicts).toEqual([{ templateId: 'tech-bollinger-squeeze', ruleDocId: 'rc' }]);
    expect(newDraft(fake).ruleHardness).toEqual({ rn: 'hard', rs: 'soft' }); // native carry + soft conflict untouched
    expect(fake.state.docs[bundlePath('b1')].status).toBe('archived');
    const events = ruleCompatEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'compat_promote_blocked', blocked: true, path: 'reforge_carry', ruleDocId: 'rc',
    });
    // At-rest per-event shape: envelope carries agentId/archetype/mode.
    expect(events[0]).not.toHaveProperty('agentId');
    const envelope = shadowLogCalls.current.find((c) => c.stage === 'rule_compat');
    expect(envelope).toMatchObject({ agentId: AGENT, archetype: 'guardian', mode: 'enforce' });
  });

  it("ENFORCE: a hard-CATEGORY conflict override strips to an explicit 'soft' — deletion would resurrect must-obey via the category default", async () => {
    flagState.mode = 'enforce';
    const fake = seedForged({
      bundle: { name: 'B3', ruleIds: ['rh'], ruleHardness: { rh: 'hard' } },
      extraDocs: { [rulePath('rh')]: { sourceRef: 'a-05', category: 'allocation', isDeleted: false } },
    });
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.strippedConflicts).toEqual([{ templateId: 'a-05', ruleDocId: 'rh' }]);
    expect(newDraft(fake).ruleHardness).toEqual({ rh: 'soft' }); // explicit demote, NOT a delete
  });

  it('OBSERVE: carry unchanged (would-strip logged blocked:false), nothing stripped', async () => {
    flagState.mode = 'observe';
    const fake = seedForged();
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.strippedConflicts).toEqual([]);
    expect(newDraft(fake).ruleHardness).toEqual({ rc: 'hard', rn: 'hard', rs: 'soft' });
    expect(ruleCompatEvents()[0]).toMatchObject({ blocked: false, path: 'reforge_carry' });
  });

  it('OFF: carry byte-equal, ZERO gate rule-doc reads, no events', async () => {
    flagState.mode = 'off';
    const fake = seedForged();
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.strippedConflicts).toEqual([]);
    expect(newDraft(fake).ruleHardness).toEqual({ rc: 'hard', rn: 'hard', rs: 'soft' });
    expect(fake.state.reads.filter((p) => p.includes('/rules/'))).toEqual([]);
    expect(ruleCompatEvents()).toHaveLength(0);
  });

  it('new draft shape: version+1, previousVersionId, draft status, empty snapshots, zeroed performanceData', async () => {
    flagState.mode = 'off';
    const fake = seedForged({ bundle: { version: 4 } });
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(newDraft(fake)).toMatchObject({
      name: 'B', version: 5, previousVersionId: 'b1', status: 'draft',
      ruleIds: ['rc', 'rn', 'rs'], ruleSnapshots: [], conflictCheckResult: null,
      forgedAt: null, equippedAt: null, archivedAt: null,
      performanceData: { battlesEquipped: 0, totalCitations: 0, successfulCitations: 0 },
    });
  });
});

describe('reforge-bundle — the unequip sub-step (client-parity semantics)', () => {
  const EQUIPPED_SETUP = () => seedForged({
    agent: { equippedBundleIds: ['b1', 'b2'], settingsRev: 3, activeRules: [{ ruleId: 'old' }] },
    bundle: { status: 'equipped', equippedAt: 'sometime' },
    extraDocs: {
      [bundlePath('b2')]: {
        status: 'equipped', name: 'Other', ruleIds: ['rx'],
        ruleSnapshots: [{ id: 'rx', text: 'keep me', category: 'technical' }],
        ruleHardness: {},
      },
    },
  });

  it('equipped bundle: unequips (remaining activeRules rebuilt via the shared projection, settingsRev bumped), archives, creates the draft, logs bundle_unequip', async () => {
    flagState.mode = 'off';
    const fake = EQUIPPED_SETUP();
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const agent = fake.state.docs[agentPath];
    expect(agent.equippedBundleIds).toEqual(['b2']);
    expect(agent.activeRules).toHaveLength(1);
    expect(agent.activeRules[0]).toMatchObject({ ruleId: 'rx', text: 'keep me', bundleName: 'Other' });
    expect(agent.settingsRev).toBe(4); // the structural increment (agentSettingsTx)
    expect(fake.state.docs[bundlePath('b1')]).toMatchObject({ status: 'archived', equippedAt: null });
    expect(newDraft(fake)).toBeTruthy();
    expect(shadowLogCalls.current.filter((c) => c.stage === 'bundle_unequip')).toHaveLength(1);
  });

  it('DRIFTED equipped bundle (agent never lists it): archives with NO agent write — no phantom settingsRev, no bundle_unequip log', async () => {
    flagState.mode = 'off';
    const fake = seedForged({
      agent: { equippedBundleIds: ['b2'], settingsRev: 3 },
      bundle: { status: 'equipped', equippedAt: 'sometime' },
      extraDocs: {
        [bundlePath('b2')]: { status: 'equipped', name: 'Other', ruleIds: [], ruleSnapshots: [], ruleHardness: {} },
      },
    });
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(fake.state.docs[agentPath].settingsRev).toBe(3); // untouched
    expect(fake.state.docs[agentPath].equippedBundleIds).toEqual(['b2']);
    expect(fake.state.docs[bundlePath('b1')].status).toBe('archived');
    expect(shadowLogCalls.current.filter((c) => c.stage === 'bundle_unequip')).toHaveLength(0);
  });
});

describe('reforge-bundle — write-path validation (fail closed)', () => {
  it('draft bundle → 400 is_draft (the client throw copy)', async () => {
    flagState.mode = 'off';
    seedForged({ bundle: { status: 'draft' } });
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: 'is_draft' });
  });

  it('non-owner → 403; missing agent → 404; missing bundle → 404', async () => {
    flagState.mode = 'off';
    seedForged();
    authReturnValue.current = { uid: 'someone-else' };
    let rr = makeReqRes({ agentId: AGENT, bundleId: 'b1' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(403);

    authReturnValue.current = { uid: 'test-user' };
    rr = makeReqRes({ agentId: 'no-such-agent', bundleId: 'b1' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(404);

    rr = makeReqRes({ agentId: AGENT, bundleId: 'no-such-bundle' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(404);
  });
});
