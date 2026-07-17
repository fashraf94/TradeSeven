// api/agent/set-rule-hardness.compat.test.js
//
// WS1 §6.2/§6.3 coverage for the B1 explicit-promote path AT ITS NEW HOME —
// the matrix suite (src/services/ruleCompatMatrix.test.js) proved these
// against the client setRuleHardness until WS1 enforce Phase 2 moved the
// write server-side (the equip-bundle.compat.test.js D3 precedent). Separate
// file from set-rule-hardness.off.test.js because RULE_COMPAT_MODE and
// FORGE_HARDSOFT_AUTHORING_ENABLED are code constants bound at module load:
// THIS file walks/pins them via getter mocks; the off file runs the REAL
// flags and is the §4 dependency-surface guard (never mock flags there).
//
// The compat map + evaluator kernel run UN-mocked (the migrated cells prove
// the real classification through the real endpoint).

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { flagState, authReturnValue, shadowLogCalls, shadowLogReturnsFalse, sentinels } = vi.hoisted(() => ({
  flagState: { mode: 'off' },
  authReturnValue: { current: { uid: 'test-user' } },
  shadowLogCalls: { current: [] },
  shadowLogReturnsFalse: { current: false },
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
    // Mirrors appendToStream: true on persist, false on a swallowed GCS write.
    return !shadowLogReturnsFalse.current;
  },
}));
vi.mock('../../src/config/featureFlags.js', () => ({
  get RULE_COMPAT_MODE() { return flagState.mode; },
  FORGE_HARDSOFT_AUTHORING_ENABLED: true, // the endpoint's dark gate, opened for this file
}));

const { default: handler } = await import('./set-rule-hardness.js');

// ============ FIRESTORE FAKE (agents + bundles/rules subcollections) ============
// Dotted-path + delete-sentinel aware (the matrix fake's applyUpdates), with
// per-path read tracking for the off-surface zero-classification proofs.

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
  const state = { docs, reads: [] };
  const makeRef = (path) => ({
    __path: path,
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
  let autoId = 0;
  const makeCol = (colPath) => ({
    doc: (id) => makeRef(`${colPath}/${id ?? `auto-${++autoId}`}`),
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

// Cell vocabulary (shipped map — the matrix suite's fixtures):
//  guardian × tech-bollinger-squeeze → core_conflict, technical (soft by category)
//  guardian × ts-01                  → NATIVE, tier_strategy
//  guardian × a-05                   → core_conflict, allocation (hard by category)
//  guardian × alloc-sector-cap       → NATIVE, allocation (hard by category)
function seed({ bundle = {}, rules = {} } = {}) {
  const fake = makeFakeFirestore({
    docs: {
      [agentPath]: { ownerId: 'test-user', archetype: 'guardian', activeBattleId: null },
      [bundlePath('b1')]: { status: 'draft', name: 'B', ruleIds: ['rc', 'rn'], ruleHardness: {}, ...bundle },
      [rulePath('rc')]: { sourceRef: 'tech-bollinger-squeeze', category: 'technical', isDeleted: false },
      [rulePath('rn')]: { sourceRef: 'ts-01', category: 'tier_strategy', isDeleted: false },
      ...Object.fromEntries(Object.entries(rules).map(([id, data]) => [rulePath(id), data])),
    },
  });
  activeFirestore = fake.db;
  return fake;
}

const ruleCompatEvents = () =>
  shadowLogCalls.current.filter((c) => c.stage === 'rule_compat').flatMap((c) => c.events || []);

beforeEach(() => {
  flagState.mode = 'off';
  authReturnValue.current = { uid: 'test-user' };
  shadowLogCalls.current = [];
  shadowLogReturnsFalse.current = false;
  activeFirestore = null;
});

describe('set-rule-hardness × RULE_COMPAT_MODE (the migrated B1 matrix cells)', () => {
  it("ENFORCE × conflict → 'hard': 409 rule_compat_blocked, override NOT written, blocked:true event", async () => {
    flagState.mode = 'enforce';
    const fake = seed();
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1', ruleId: 'rc', value: 'hard' });
    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'rule_compat_blocked' });
    expect(typeof res.body.message).toBe('string'); // the user-facing block copy rides the response
    expect(fake.state.docs[bundlePath('b1')].ruleHardness).toEqual({});
    const events = ruleCompatEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'compat_promote_blocked', blocked: true, path: 'set_rule_hardness', ruleDocId: 'rc',
    });
  });

  it("ENFORCE × native → 'hard' and conflict → 'soft': both succeed, no events", async () => {
    flagState.mode = 'enforce';
    const fake = seed();
    let rr = makeReqRes({ agentId: AGENT, bundleId: 'b1', ruleId: 'rn', value: 'hard' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(200);
    rr = makeReqRes({ agentId: AGENT, bundleId: 'b1', ruleId: 'rc', value: 'soft' }); // demote: never guarded
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(200);
    expect(fake.state.docs[bundlePath('b1')].ruleHardness).toEqual({ rn: 'hard', rc: 'soft' });
    expect(ruleCompatEvents()).toHaveLength(0);
  });

  it("OBSERVE × conflict → 'hard': override IS written, attempt logged blocked:false, compatLogged:true", async () => {
    flagState.mode = 'observe';
    const fake = seed();
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1', ruleId: 'rc', value: 'hard' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ruleId: 'rc', value: 'hard', compatLogged: true });
    expect(fake.state.docs[bundlePath('b1')].ruleHardness).toEqual({ rc: 'hard' });
    const events = ruleCompatEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'compat_promote_blocked', blocked: false });
    // At-rest per-event shape (the equip-bundle precedent): envelope carries
    // agentId/archetype/mode; the events must NOT.
    expect(events[0]).not.toHaveProperty('agentId');
    expect(events[0]).not.toHaveProperty('archetype');
    expect(events[0]).not.toHaveProperty('mode');
    const envelope = shadowLogCalls.current.find((c) => c.stage === 'rule_compat');
    expect(envelope).toMatchObject({ agentId: AGENT, archetype: 'guardian', mode: 'observe' });
  });

  it("OFF × conflict → 'hard': written with ZERO classification — no rule-doc read, no events, compatLogged:null", async () => {
    flagState.mode = 'off';
    const fake = seed();
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1', ruleId: 'rc', value: 'hard' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ value: 'hard', compatLogged: null });
    expect(fake.state.docs[bundlePath('b1')].ruleHardness).toEqual({ rc: 'hard' });
    expect(fake.state.reads).not.toContain(rulePath('rc')); // the gate's read is skipped under off
    expect(ruleCompatEvents()).toHaveLength(0);
  });

  it("ENFORCE × NULL-CLEAR promote: clearing a 'soft' override on a hard-CATEGORY conflict rule resolves hard → 409 (the UI's Hard toggle sends exactly null)", async () => {
    flagState.mode = 'enforce';
    const fake = seed({
      bundle: { ruleIds: ['ra'], ruleHardness: { ra: 'soft' } }, // the post-cleanup shape
      rules: { ra: { sourceRef: 'a-05', category: 'allocation', isDeleted: false } },
    });
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1', ruleId: 'ra', value: null });
    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(fake.state.docs[bundlePath('b1')].ruleHardness).toEqual({ ra: 'soft' }); // demote intact
    expect(ruleCompatEvents()[0]).toMatchObject({
      type: 'compat_promote_blocked', blocked: true, hardnessRequested: 'hard',
    });
  });

  it('ENFORCE × null-clear on a NATIVE hard-category rule (and a conflict clear that resolves SOFT) both pass', async () => {
    flagState.mode = 'enforce';
    const fake = seed({
      bundle: { ruleIds: ['rn2', 'rc2'], ruleHardness: { rn2: 'soft', rc2: 'hard' } },
      rules: {
        rn2: { sourceRef: 'alloc-sector-cap', category: 'allocation', isDeleted: false }, // guardian NATIVE, hard category
        rc2: { sourceRef: 'tech-bollinger-squeeze', category: 'technical', isDeleted: false }, // conflict, soft category
      },
    });
    let rr = makeReqRes({ agentId: AGENT, bundleId: 'b1', ruleId: 'rn2', value: null }); // native: clear→hard fine
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(200);
    rr = makeReqRes({ agentId: AGENT, bundleId: 'b1', ruleId: 'rc2', value: null }); // conflict: clear→soft is a demote
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(200);
    expect(fake.state.docs[bundlePath('b1')].ruleHardness).toEqual({});
    expect(ruleCompatEvents()).toHaveLength(0);
  });

  it('OBSERVE × SWALLOWED compat write (logSignalDrops resolves false): write proceeds, compatLogged:false (honest boolean, Phase-1 discipline)', async () => {
    flagState.mode = 'observe';
    shadowLogReturnsFalse.current = true;
    const fake = seed();
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1', ruleId: 'rc', value: 'hard' });
    await handler(req, res);

    expect(res.statusCode).toBe(200); // telemetry never fails the user's write
    expect(res.body).toMatchObject({ value: 'hard', compatLogged: false });
    expect(fake.state.docs[bundlePath('b1')].ruleHardness).toEqual({ rc: 'hard' });
  });
});

describe('set-rule-hardness — write-path validation (fail closed)', () => {
  it('draft-only: a forged bundle → 400 not_draft, nothing written', async () => {
    flagState.mode = 'observe';
    const fake = seed({ bundle: { status: 'forged' } });
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1', ruleId: 'rc', value: 'hard' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: 'not_draft' });
    expect(fake.state.docs[bundlePath('b1')].ruleHardness).toEqual({});
  });

  it('rule not in bundle → 400 rule_not_in_bundle', async () => {
    flagState.mode = 'observe';
    seed();
    const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1', ruleId: 'ghost', value: 'hard' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: 'rule_not_in_bundle' });
  });

  it('non-owner → 403; missing agent → 404; missing bundle → 404', async () => {
    flagState.mode = 'observe';
    seed();
    authReturnValue.current = { uid: 'someone-else' };
    let rr = makeReqRes({ agentId: AGENT, bundleId: 'b1', ruleId: 'rc', value: 'hard' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(403);

    authReturnValue.current = { uid: 'test-user' };
    rr = makeReqRes({ agentId: 'no-such-agent', bundleId: 'b1', ruleId: 'rc', value: 'hard' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(404);

    rr = makeReqRes({ agentId: AGENT, bundleId: 'no-such-bundle', ruleId: 'rc', value: 'hard' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(404);
  });

  it("value must be explicit 'hard' | 'soft' | null → 400 invalid_value otherwise (incl. missing)", async () => {
    flagState.mode = 'observe';
    seed();
    for (const value of [undefined, 'HARD', 'firm', 0, true]) {
      const { req, res } = makeReqRes({ agentId: AGENT, bundleId: 'b1', ruleId: 'rc', value });
      await handler(req, res);
      expect(res.statusCode, String(value)).toBe(400);
      expect(res.body).toMatchObject({ error: 'invalid_value' });
    }
  });

  it('non-POST → 405', async () => {
    seed();
    const { req, res } = makeReqRes({}, 'GET');
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
