// api/agent/change-archetype.compat.test.js
//
// WS1 Phase 2 — the compat_archetype_change_rescan rider (fence-lite rider 3).
// Separate file from change-archetype.test.js because the rescan is gated on
// RULE_COMPAT_MODE, a code constant bound at module load: THIS file mocks the
// flag to 'observe' with a rescan-capable fake; the base file runs the REAL
// flag — which is ALSO 'observe' live (header corrected at the Phase-5
// review; it was never 'off') — against a fake without rule/bundle
// subcollections, so its happy paths exercise the rescan's swallowed-error
// branch (rescanLogged:false, asserted there). The true off-surface proof
// lives in change-archetype.leanrider.test.js under a mocked 'off'.
//
// The rescan kernel (ruleCompatCleanup → projectActiveRules + the compat map)
// is exercised un-mocked here. The §4 dependency-surface guard for the
// handler's api → src edges (including featureFlags, which THIS file mocks by
// design) is the base change-archetype.test.js — see its header.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { authReturnValue, shadowLogCalls, shadowLogReturnsFalse } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  shadowLogCalls: { current: [] },
  shadowLogReturnsFalse: { current: false },
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
    // Mirrors appendToStream: true on persist, false on a swallowed GCS write.
    return !shadowLogReturnsFalse.current;
  },
}));
vi.mock('@vercel/functions', () => ({
  waitUntil: (p) => p,
}));
// The rider under test: flag pinned to observe for this file only.
vi.mock('../../src/config/featureFlags.js', () => ({
  COMPILER_ENABLED: false, // P2.4a: keep the dark compiler dark under this suite's flag mock
  RULE_COMPAT_MODE: 'observe',
}));

const { default: changeArchetypeHandler } = await import('./change-archetype.js');

// Fake Firestore: agents collection + per-agent rules/bundles subcollections.
// A mutable store backs both in-tx writes (the seed's tx.set) and post-tx reads
// (the cleanup + rescan). failSubreads gates only READS (the seed writes docs
// even when reads are down — only the best-effort cleanup/rescan degrade).
function makeFakeFirestore({ agentDocs = {}, subcollections = {}, failSubreads = false } = {}) {
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
      get: async () => {
        if (failSubreads) throw new Error('subcollection read down');
        return { docs: store(id, sub).map((d) => ({ id: d.id, data: () => d })) };
      },
      doc: (docId) => buildDocRef(id, sub, docId ?? `seed-${++autoSeq}`),
    }),
  });
  return {
    collection: (name) => {
      if (name === 'agents') return { doc: (id) => buildAgentRef(id) };
      throw new Error(`Unmocked collection: ${name}`);
    },
    runTransaction: async (fn) =>
      fn({
        get: async (ref) => ref.get(),
        set: async (ref, data) => ref.set(data),
        update: async (ref, updates) => ref.update(updates),
      }),
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

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  shadowLogCalls.current = [];
  shadowLogReturnsFalse.current = false;
  activeFirestore = null;
});

// Fixture: agent flips momentum_chaser → guardian holding one equipped bundle
// whose rule doc is a-05 (allocation ⇒ hard; core_conflict for guardian).
const AGENT_ID = 'agent-1';
function conflictFixture() {
  return makeFakeFirestore({
    agentDocs: {
      [AGENT_ID]: {
        ownerId: 'test-user',
        archetype: 'momentum_chaser',
        activeBattleId: null,
        equippedTraits: [],
      },
    },
    subcollections: {
      [AGENT_ID]: {
        rules: [
          { id: 'r1', sourceRef: 'a-05', category: 'allocation', isDeleted: false, traitId: null },
          { id: 'r2', sourceRef: 'ts-01', category: 'tier_strategy', isDeleted: false, traitId: null }, // guardian-NATIVE
        ],
        bundles: [
          { id: 'b1', status: 'equipped', name: 'B', ruleIds: ['r1', 'r2'], ruleHardness: {} },
        ],
      },
    },
  });
}

describe('change-archetype — compat rescan (RULE_COMPAT_MODE=observe)', () => {
  it('real change → rescan event logged with projected conflict counts, rescanLogged:true', async () => {
    activeFirestore = conflictFixture();
    const [req, res] = makeReqRes({ agentId: AGENT_ID, archetype: 'guardian' });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ archetype: 'guardian', idempotent: false, rescanLogged: true });

    const rescans = shadowLogCalls.current.filter((r) => r.stage === 'rule_compat');
    expect(rescans).toHaveLength(1);
    const record = rescans[0];
    expect(record).toMatchObject({ agentId: AGENT_ID, archetype: 'guardian', mode: 'observe', eventCount: 1 });
    expect(record.events[0]).toMatchObject({
      type: 'compat_archetype_change_rescan',
      path: 'archetype_change_rescan',
      previousArchetype: 'momentum_chaser',
      conflictCount: 1,       // a-05 only — ts-01 is guardian-native
      hardConflictCount: 1,   // allocation ⇒ hard
      blocked: false,
    });
    expect(record.events[0].conflicts[0]).toMatchObject({ ruleId: 'a-05', ruleDocId: 'r1', hardness: 'hard' });
    // The archetype_change legacy log still fires alongside.
    expect(shadowLogCalls.current.some((r) => r.stage === 'archetype_change')).toBe(true);
  });

  it('idempotent re-select → no rescan record, rescanLogged:null (mode-active response field present)', async () => {
    activeFirestore = conflictFixture();
    activeFirestore._state.agentDocs[AGENT_ID].archetype = 'guardian';
    const [req, res] = makeReqRes({ agentId: AGENT_ID, archetype: 'guardian' });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ idempotent: true, rescanLogged: null });
    expect(shadowLogCalls.current.filter((r) => r.stage === 'rule_compat')).toHaveLength(0);
  });

  it('rescan failure is loud but never fails the committed change → 200 with rescanLogged:false', async () => {
    activeFirestore = makeFakeFirestore({
      agentDocs: {
        [AGENT_ID]: { ownerId: 'test-user', archetype: 'momentum_chaser', activeBattleId: null, equippedTraits: [] },
      },
      failSubreads: true,
    });
    const [req, res] = makeReqRes({ agentId: AGENT_ID, archetype: 'guardian' });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ archetype: 'guardian', idempotent: false, rescanLogged: false });
    // The archetype write itself landed.
    expect(activeFirestore._state.agentDocs[AGENT_ID].archetype).toBe('guardian');
  });

  it('SWALLOWED rescan write (logSignalDrops resolves false, no throw) → rescanLogged:false, change still committed', async () => {
    // The real bug class: the rescan computes fine and logSignalDrops resolves,
    // but the GCS write was swallowed (false). rescanLogged must be honest (not
    // hard-coded true) so a broken logger is distinguishable from a quiet stream.
    activeFirestore = conflictFixture();
    shadowLogReturnsFalse.current = true;
    const [req, res] = makeReqRes({ agentId: AGENT_ID, archetype: 'guardian' });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ archetype: 'guardian', idempotent: false, rescanLogged: false });
    // The rescan was attempted (record pushed) but reported not-persisted.
    expect(shadowLogCalls.current.filter((r) => r.stage === 'rule_compat')).toHaveLength(1);
    // The archetype write itself landed.
    expect(activeFirestore._state.agentDocs[AGENT_ID].archetype).toBe('guardian');
  });
});

describe('change-archetype — Release 2 lean-invalidation rider (rides the rescan event)', () => {
  it('an agent WITHOUT leans emits a byte-identical rescan event (no leanInvalidation key)', async () => {
    activeFirestore = conflictFixture();
    const [req, res] = makeReqRes({ agentId: AGENT_ID, archetype: 'guardian' });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(200);
    const log = shadowLogCalls.current.find((r) => r.stage === 'rule_compat');
    expect(log.events[0]).not.toHaveProperty('leanInvalidation');
  });

  it('an agent WITH leans gets the rider: leans invalid under the NEW archetype are recorded (data never mutated)', async () => {
    activeFirestore = conflictFixture();
    // Two momentum_chaser leans equipped; the flip to guardian invalidates both
    // (not_in_menu) — recorded on the event, NEVER cleared from the agent doc
    // (leans are durable desired state; a switch-back revalidates them in).
    activeFirestore._state.agentDocs[AGENT_ID].standingLeans = [
      { adjustmentId: 'TF-02', version: 1, equippedAt: 't' },
      { adjustmentId: 'TF-05', version: 1, equippedAt: 't' },
    ];
    const [req, res] = makeReqRes({ agentId: AGENT_ID, archetype: 'guardian' });
    await changeArchetypeHandler(req, res);

    expect(res.statusCode).toBe(200);
    const log = shadowLogCalls.current.find((r) => r.stage === 'rule_compat');
    expect(log.events[0].leanInvalidation).toEqual({
      equippedCount: 2,
      invalidatedCount: 2,
      invalidated: [
        { adjustmentId: 'TF-02', version: 1, reason: 'not_in_menu' },
        { adjustmentId: 'TF-05', version: 1, reason: 'not_in_menu' },
      ],
    });
    // Lean DATA untouched on the agent doc.
    expect(activeFirestore._state.agentDocs[AGENT_ID].standingLeans.map((l) => l.adjustmentId)).toEqual(['TF-02', 'TF-05']);
  });
});
