// api/agent/composition.endpoints.test.js
//
// Composition PR 2 — the ENDPOINT-boundary acceptance rows: A4 (core_conflict
// equip → server reject), A5 (deferred equip → reject), A6 (rejected save
// leaves stored state byte-identical), A27 (whole-config save with a banned
// pairing rejects unchanged), A41 (closed epoch → 409 at the endpoint), and
// the endpoint half of A23 (flags dark ⇒ no composition reads, behavior
// unchanged — the full-suite regression evidence is api/agent's 27 suites
// passing untouched). Harness cloned from equip-bundle.test.js (infra seams
// only; the REAL endpoint modules + kernel run).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mutable flag holder: the compositionConfig mock reads through getters ──
const flagState = { mode: 'off', fence: false };
vi.mock('../_utils/compositionConfig.js', () => ({
  get COMPOSITION_ENFORCEMENT_MODE() { return flagState.mode; },
  get COMPOSITION_EPOCH_FENCE_ENABLED() { return flagState.fence; },
  get COMPOSITION_MIGRATION_FEED_ENABLED() { return false; },
  get COMPOSITION_COMPILED_IDENTITY_ENABLED() { return false; },
}));

let activeFirestore = null;
const authReturnValue = { current: { uid: 'owner-1' } };
const shadowLogCalls = { current: [] };

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
  logSignalDrops: async (record) => { shadowLogCalls.current.push(record); },
}));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));

const { default: equipBundleHandler } = await import('./equip-bundle.js');
const { default: updateSettingsHandler } = await import('./update-agent-settings.js');
const { default: changeArchetypeHandler } = await import('./change-archetype.js');
const { ensureCasualClone } = await import('../_utils/casualClone.js');

// ── fake Firestore: agents + bundles + the composition epoch doc, with
// write- and epoch-read counters for the byte-identity assertions ──────────
function makeFakeFirestore({ agentDocs = {}, bundleDocs = {}, epochDoc = null } = {}) {
  const state = { agentDocs, bundleDocs, epochDoc, writes: 0, epochReads: 0 };

  const buildBundleRef = (agentId, bundleId) => ({
    id: bundleId,
    get: async () => ({
      exists: !!state.bundleDocs[`${agentId}/${bundleId}`],
      data: () => state.bundleDocs[`${agentId}/${bundleId}`],
    }),
    update: async (updates) => {
      state.writes += 1;
      const k = `${agentId}/${bundleId}`;
      state.bundleDocs[k] = { ...state.bundleDocs[k], ...updates };
    },
  });

  const buildAgentRef = (id) => ({
    id,
    get: async () => ({ exists: !!state.agentDocs[id], data: () => state.agentDocs[id] }),
    update: async (updates) => {
      state.writes += 1;
      state.agentDocs[id] = { ...state.agentDocs[id], ...updates };
    },
    collection: (name) => {
      if (name === 'bundles') return { doc: (bundleId) => buildBundleRef(id, bundleId) };
      // generic subcollection (rules docs for the change-archetype seed path):
      // set/update count as writes; queries return empty (fresh agent).
      const store = {};
      return {
        doc: (docId) => ({
          id: docId,
          get: async () => ({ exists: !!store[docId], data: () => store[docId] }),
          set: async (data) => { state.writes += 1; store[docId] = data; },
          update: async (u) => { state.writes += 1; store[docId] = { ...store[docId], ...u }; },
        }),
        where: () => ({ get: async () => ({ docs: [], empty: true }) }),
      };
    },
  });

  const buildEpochRef = () => ({
    get: async () => {
      state.epochReads += 1;
      return { exists: !!state.epochDoc, data: () => state.epochDoc };
    },
  });

  const collection = (name) => {
    if (name === 'agents') return { doc: (id) => buildAgentRef(id) };
    if (name === 'composition') {
      return { doc: (docId) => {
        // Review C2: pin the doc ADDRESS — a helper reading any other id is a
        // permanently fail-open fence in production and must fail here.
        if (docId !== 'writeEpoch') throw new Error(`wrong epoch doc id: ${docId}`);
        return buildEpochRef();
      } };
    }
    throw new Error(`Unmocked collection: ${name}`);
  };

  const runTransaction = async (fn) => fn({
    get: async (ref) => ref.get(),
    getAll: async (...refs) => Promise.all(refs.map((r) => r.get())),
    update: async (ref, updates) => ref.update(updates),
    set: async (ref, data) => { state.writes += 1; ref._set = data; },
  });

  return { db: { collection, runTransaction }, state };
}

function makeReqRes({ body, method = 'POST' } = {}) {
  const req = { method, body: body || {} };
  const res = {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return { req, res };
}

const BANNED_SNAP = { id: 'rd1', sourceRef: 'r-09', paramValues: { pct: 10 }, params: { pct: {} } };       // core_conflict for degen (R-14)
const DEFERRED_SNAP = { id: 'rd2', sourceRef: 'f-12', paramValues: {}, params: {} };                        // deferred (all archetypes)
const OUT_OF_DOMAIN_SNAP = { id: 'rd3', sourceRef: 'alloc-sector-cap', paramValues: { pct: 90 }, params: { pct: {} } }; // mc domain {40..80}
const LEGAL_SNAP = { id: 'rd4', sourceRef: 'tech-volume-surge', paramValues: {}, params: {} };

function fleet({ archetype = 'degen', snaps = [BANNED_SNAP], epochDoc = null } = {}) {
  return makeFakeFirestore({
    agentDocs: { 'agent-1': { ownerId: 'owner-1', archetype, equippedBundleIds: [], activeRules: [], settingsRev: 3 } },
    bundleDocs: { 'agent-1/bundle-1': { status: 'forged', ruleIds: snaps.map((s) => s.id), ruleSnapshots: snaps, ruleHardness: {} } },
    epochDoc,
  });
}

beforeEach(() => {
  flagState.mode = 'off';
  flagState.fence = false;
  shadowLogCalls.current = [];
});

describe('A4/A5/A6 — the equip boundary rejects banned pairings with stored state byte-identical', () => {
  it.each([
    ['A4 core_conflict', [BANNED_SNAP], 'degen'],
    ['A5 deferred', [DEFERRED_SNAP], 'guardian'],
    ['A7-at-save out-of-domain param', [OUT_OF_DOMAIN_SNAP], 'momentum_chaser'],
  ])('%s → 409 composition_blocked, nothing written', async (_label, snaps, archetype) => {
    flagState.mode = 'enforce';
    const { db, state } = fleet({ archetype, snaps });
    activeFirestore = db;
    const before = JSON.parse(JSON.stringify({ a: state.agentDocs, b: state.bundleDocs }));

    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', bundleId: 'bundle-1' } });
    await equipBundleHandler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('composition_blocked');
    expect(res.body.compositionViolations?.length).toBeGreaterThan(0);
    expect(state.writes).toBe(0);                                             // A6: zero writes
    expect({ a: state.agentDocs, b: state.bundleDocs }).toEqual(before);      // A6: byte-identical
  });

  it('a legal bundle equips under enforce (the gate blocks pairings, not the boundary)', async () => {
    flagState.mode = 'enforce';
    const { db, state } = fleet({ archetype: 'degen', snaps: [LEGAL_SNAP] });
    activeFirestore = db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', bundleId: 'bundle-1' } });
    await equipBundleHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(state.agentDocs['agent-1'].equippedBundleIds).toEqual(['bundle-1']);
  });

  it("observe mode computes violations, attaches them, and NEVER blocks", async () => {
    flagState.mode = 'observe';
    const { db, state } = fleet({ archetype: 'degen', snaps: [BANNED_SNAP] });
    activeFirestore = db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', bundleId: 'bundle-1' } });
    await equipBundleHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.compositionViolations?.length).toBeGreaterThan(0);
    expect(state.agentDocs['agent-1'].equippedBundleIds).toEqual(['bundle-1']);
  });

  it('A23 (endpoint half): mode off ⇒ the banned bundle equips exactly as today — zero composition compute, zero epoch reads', async () => {
    const { db, state } = fleet({ archetype: 'degen', snaps: [BANNED_SNAP] });
    activeFirestore = db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', bundleId: 'bundle-1' } });
    await equipBundleHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.compositionViolations).toBeUndefined();
    expect(state.epochReads).toBe(0);
  });
});

describe('A27 — whole-config save with a banned trait pairing rejects, stored config unchanged', () => {
  it('equippedTraits carrying trait-bargain-hunter on a momentum_chaser → 409, byte-identical', async () => {
    flagState.mode = 'enforce';
    const { db, state } = makeFakeFirestore({
      agentDocs: { 'agent-1': { ownerId: 'owner-1', archetype: 'momentum_chaser', equippedTraits: [], settingsRev: 3 } },
    });
    activeFirestore = db;
    const before = JSON.parse(JSON.stringify(state.agentDocs));

    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', set: { equippedTraits: [{ traitId: 'trait-bargain-hunter' }] } } });
    await updateSettingsHandler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('composition_blocked');
    expect(state.writes).toBe(0);
    expect(state.agentDocs).toEqual(before);
  });

  it('a legal trait set saves under enforce', async () => {
    flagState.mode = 'enforce';
    const { db, state } = makeFakeFirestore({
      agentDocs: { 'agent-1': { ownerId: 'owner-1', archetype: 'contrarian', equippedTraits: [], settingsRev: 3 } },
    });
    activeFirestore = db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', set: { equippedTraits: [{ traitId: 'trait-bargain-hunter' }] } } });
    await updateSettingsHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(state.agentDocs['agent-1'].equippedTraits).toEqual([{ traitId: 'trait-bargain-hunter' }]);
  });
});

describe('C3 — the change-archetype target-archetype gate (offer/equip boundary)', () => {
  it('switching INTO an archetype banned by an equipped bundle → 409, byte-identical (review C3)', async () => {
    flagState.mode = 'enforce';
    // contrarian agent holds an r-09 bundle (legal for contrarian: tension);
    // switching to DEGEN would pair it core_conflict (R-14) → blocked.
    const { db, state } = makeFakeFirestore({
      agentDocs: { 'agent-1': { ownerId: 'owner-1', archetype: 'contrarian', equippedBundleIds: ['bundle-1'], settingsRev: 3 } },
      bundleDocs: { 'agent-1/bundle-1': { status: 'equipped', ruleIds: ['rd1'], ruleSnapshots: [BANNED_SNAP] } },
    });
    activeFirestore = db;
    const before = JSON.parse(JSON.stringify({ a: state.agentDocs, b: state.bundleDocs }));

    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', archetype: 'degen' } });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('composition_blocked');
    expect(state.writes).toBe(0);
    expect({ a: state.agentDocs, b: state.bundleDocs }).toEqual(before);
  });

  it('a switch whose equipped bundles are legal for the TARGET proceeds under enforce (the gate reads the target, not the current archetype)', async () => {
    flagState.mode = 'enforce';
    // degen agent holds an r-09 bundle... banned for degen but LEGAL for
    // contrarian (tension) — switching degen → contrarian must NOT block.
    // (A gate mistakenly checking the CURRENT archetype fails this row.)
    const { db, state } = makeFakeFirestore({
      agentDocs: { 'agent-1': { ownerId: 'owner-1', archetype: 'degen', equippedBundleIds: ['bundle-1'], settingsRev: 3 } },
      bundleDocs: { 'agent-1/bundle-1': { status: 'equipped', ruleIds: ['rd1'], ruleSnapshots: [BANNED_SNAP] } },
    });
    activeFirestore = db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', archetype: 'contrarian' } });
    await changeArchetypeHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(state.agentDocs['agent-1'].archetype).toBe('contrarian');
  });
});

describe('A41 (endpoint) — the write-epoch fence at the boundary', () => {
  it('closed epoch → 409 epoch_closed, nothing written', async () => {
    flagState.fence = true;
    const { db, state } = fleet({ archetype: 'degen', snaps: [LEGAL_SNAP], epochDoc: { state: 'closed', epochId: 'e-2' } });
    activeFirestore = db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', bundleId: 'bundle-1' } });
    await equipBundleHandler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('epoch_closed');
    expect(state.writes).toBe(0);
  });

  it('fence on + epoch doc ABSENT (pre-runbook world) → the write proceeds (fail-open)', async () => {
    flagState.fence = true;
    const { db, state } = fleet({ archetype: 'degen', snaps: [LEGAL_SNAP], epochDoc: null });
    activeFirestore = db;
    const { req, res } = makeReqRes({ body: { agentId: 'agent-1', bundleId: 'bundle-1' } });
    await equipBundleHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(state.epochReads).toBe(1); // it DID validate — and admitted
  });

  it('the provisioner class (casualClone, PR #716 merge reconciliation): closed epoch rejects ensureCasualClone at entry, NOTHING written', async () => {
    // The raw-write clone provisioner births + re-syncs identity state (incl.
    // the rules/bundles subcollections) outside any transaction — its declared
    // guard is assertWriteEpochOpen at entry (census row). Under the defect
    // (guard deleted), this test fails: the helper would proceed into the
    // fake's unmocked query surface instead of rejecting cleanly.
    flagState.fence = true;
    const { db, state } = fleet({ epochDoc: { state: 'closed', epochId: 'e-2' } });
    await expect(ensureCasualClone(db, { odUserId: 'owner-1' })).rejects.toMatchObject({ code: 'epoch_closed' });
    expect(state.epochReads).toBe(1);
    expect(state.writes).toBe(0);
  });
});
