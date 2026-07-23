// api/agent/equip-bundle.compat.test.js
//
// WS1 §6.2/§6.3 coverage for the equip surface AT ITS NEW HOME — the matrix
// suite (src/services/ruleCompatMatrix.test.js) proved these against the
// client equipBundle until the Release 2 settingsRev migration (D3) moved the
// write server-side. Separate file from equip-bundle.test.js because
// RULE_COMPAT_MODE is a code constant bound at module load: THIS file walks
// it off/observe/enforce via a getter mock; the base file runs the real flag
// and is the §4 dependency-surface guard (see its header — never mock flags
// there).
//
// CONFLICT_RECONCILER_DETECT_ENABLED is pinned false here (the old matrix
// did the same — "keep equip minimal") so the mode walk isolates the WS1
// surface. The compat map + classifier kernel run UN-mocked.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { flagState, authReturnValue, shadowLogCalls, shadowLogReturnsFalse } = vi.hoisted(() => ({
  flagState: { mode: 'off' },
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
  requireAuth: async () => authReturnValue.current,
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
vi.mock('../../src/config/featureFlags.js', () => ({
  COMPILER_ENABLED: false, // P2.4a: keep the dark compiler dark under this suite's flag mock
  get RULE_COMPAT_MODE() { return flagState.mode; },
  CONFLICT_RECONCILER_DETECT_ENABLED: false,
}));

const { default: equipBundleHandler } = await import('./equip-bundle.js');

// ==================== FIRESTORE FAKE (agents + bundles subcollection) ====================

function makeFakeFirestore({ agentDocs = {}, bundleDocs = {} } = {}) {
  const state = { agentDocs, bundleDocs };
  const buildBundleRef = (agentId, bundleId) => ({
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
    get: async () => ({ exists: !!state.agentDocs[id], data: () => state.agentDocs[id] }),
    update: async (updates) => { state.agentDocs[id] = { ...state.agentDocs[id], ...updates }; },
    collection: (name) => {
      if (name !== 'bundles') throw new Error(`Unmocked subcollection: ${name}`);
      return { doc: (bundleId) => buildBundleRef(id, bundleId) };
    },
  });
  const collection = (name) => {
    if (name === 'agents') return { doc: (id) => buildAgentRef(id) };
    throw new Error(`Unmocked collection: ${name}`);
  };
  const runTransaction = async (fn) => fn({
    get: async (ref) => ref.get(),
    getAll: async (...refs) => Promise.all(refs.map((r) => r.get())),
    update: async (ref, updates) => ref.update(updates),
  });
  return { db: { collection, runTransaction }, state };
}

function makeReqRes(body) {
  const req = { method: 'POST', body };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return { req, res };
}

const AGENT_ID = 'agent-1';

// The matrix's §6.2 fixture cells (real compat map): conflict-hard,
// conflict-soft, native, manual-outside-map — against a guardian.
const FIXTURE_SNAPSHOTS = [
  { id: 's1', sourceRef: 'a-05', category: 'allocation', text: 't1' },
  { id: 's2', sourceRef: 'tech-bollinger-squeeze', category: 'technical', text: 't2' },
  { id: 's3', sourceRef: 'ts-01', category: 'tier_strategy', text: 't3' },
  { id: 's4', sourceRef: null, category: 'risk', text: 't4' },
];

function seed() {
  const fake = makeFakeFirestore({
    agentDocs: {
      [AGENT_ID]: {
        ownerId: 'test-user',
        archetype: 'guardian',
        activeBattleId: null,
        equippedBundleIds: [],
        stats: { gamesPlayed: 0 },
      },
    },
    bundleDocs: {
      [`${AGENT_ID}/b1`]: { name: 'B', status: 'forged', ruleSnapshots: FIXTURE_SNAPSHOTS, ruleHardness: {} },
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

describe('equip-bundle × RULE_COMPAT_MODE (the migrated §6.2/§6.3 matrix cells)', () => {
  it('ENFORCE: equip PROCEEDS (warn-only surface), both conflicts returned + logged with resolved hardness', async () => {
    flagState.mode = 'enforce';
    const fake = seed();
    const { req, res } = makeReqRes({ agentId: AGENT_ID, bundleId: 'b1' });
    await equipBundleHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.archetype).toBe('guardian');
    expect(fake.state.agentDocs[AGENT_ID].equippedBundleIds).toEqual(['b1']); // equip landed
    expect(fake.state.agentDocs[AGENT_ID].activeRules).toHaveLength(4);       // nothing filtered
    expect(res.body.compatConflicts).toHaveLength(2);
    expect(res.body.compatConflicts.find((c) => c.ruleDocId === 's1')).toMatchObject({ resolvedHardness: 'hard' });
    expect(res.body.compatConflicts.find((c) => c.ruleDocId === 's2')).toMatchObject({ resolvedHardness: 'soft' });
    const events = ruleCompatEvents();
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.type === 'compat_conflict_equip' && e.path === 'equip_bundle' && e.blocked === false)).toBe(true);
  });

  it('MODE SNAPSHOT (§6.3): the written agent+bundle state is deep-equal across off / observe / enforce', async () => {
    const run = async (mode) => {
      flagState.mode = mode;
      shadowLogCalls.current = [];
      const fake = seed();
      const { req, res } = makeReqRes({ agentId: AGENT_ID, bundleId: 'b1' });
      await equipBundleHandler(req, res);
      expect(res.statusCode).toBe(200);
      const state = JSON.parse(JSON.stringify({
        agent: fake.state.agentDocs[AGENT_ID],
        bundle: fake.state.bundleDocs[`${AGENT_ID}/b1`],
      }));
      // Wall-clock stamps are mode-independent — normalize so the cross-mode
      // compare tests BEHAVIOR, not millisecond timing between runs.
      expect(typeof state.bundle.equippedAt).toBe('string');
      state.bundle.equippedAt = '<wall-clock>';
      state.bundle.updatedAt = '<wall-clock>';
      state.agent.updatedAt = '<wall-clock>';
      return state;
    };
    const off = await run('off');
    const observe = await run('observe');
    const enforce = await run('enforce');
    expect(observe).toEqual(off);
    expect(enforce).toEqual(off); // the only enforce delta is telemetry + the toast — never the written state
  });

  it('OFF: compatConflicts [] with zero classification events', async () => {
    flagState.mode = 'off';
    seed();
    const { req, res } = makeReqRes({ agentId: AGENT_ID, bundleId: 'b1' });
    await equipBundleHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.compatConflicts).toEqual([]);
    expect(ruleCompatEvents()).toHaveLength(0);
  });

  it('SWALLOWED conflict-equip write (logSignalDrops resolves false): equip still 200, events attempted, loud error (WS1 Phase-1 discipline — finishes the emitter set)', async () => {
    flagState.mode = 'enforce';
    shadowLogReturnsFalse.current = true;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const fake = seed();
      const { req, res } = makeReqRes({ agentId: AGENT_ID, bundleId: 'b1' });
      await equipBundleHandler(req, res);
      expect(res.statusCode).toBe(200); // telemetry never fails the committed equip
      expect(fake.state.agentDocs[AGENT_ID].equippedBundleIds).toEqual(['b1']);
      expect(ruleCompatEvents()).toHaveLength(2); // the batch was attempted
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('did not persist'),
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('OBSERVE: conflicts logged blocked:false with the SANITIZED per-event shape (envelope carries agentId/archetype/mode)', async () => {
    flagState.mode = 'observe';
    const fake = seed();
    const { req, res } = makeReqRes({ agentId: AGENT_ID, bundleId: 'b1' });
    await equipBundleHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(fake.state.agentDocs[AGENT_ID].equippedBundleIds).toEqual(['b1']);
    const events = ruleCompatEvents();
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.blocked === false)).toBe(true);
    // Per-event shape matches what log-rule-compat-event.js's sanitizeEvent
    // PERSISTS for every other producer: no per-event agentId/archetype/mode
    // (those live on the envelope), and the envelope carries them.
    for (const e of events) {
      expect(e).not.toHaveProperty('agentId');
      expect(e).not.toHaveProperty('archetype');
      expect(e).not.toHaveProperty('mode');
    }
    const envelope = shadowLogCalls.current.find((c) => c.stage === 'rule_compat');
    expect(envelope).toMatchObject({ agentId: AGENT_ID, archetype: 'guardian', mode: 'observe' });
  });
});
