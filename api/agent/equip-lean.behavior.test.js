// api/agent/equip-lean.behavior.test.js
//
// Release 2 PR-a — the lean-service behavior matrix with STANDING_LEANS_ENABLED
// getter-mocked ON (a code constant in prod; mutable only here — the
// change-archetype.compat.test.js precedent). The real-flag dark-surface proof
// + §4 dependency guard is equip-lean.test.js. The archetypeAdjustments
// menu/version/conflict-group kernel runs UN-mocked.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { flagState, authReturnValue, shadowLogCalls } = vi.hoisted(() => ({
  flagState: { leansEnabled: true },
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
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));
vi.mock('../../src/config/featureFlags.js', () => ({
  get STANDING_LEANS_ENABLED() { return flagState.leansEnabled; },
}));

const { default: equipLeanHandler } = await import('./equip-lean.js');
const { default: unequipLeanHandler } = await import('./unequip-lean.js');

function makeFakeFirestore({ agentDocs = {} } = {}) {
  const state = { agentDocs };
  const buildAgentRef = (id) => ({
    get: async () => ({ exists: !!state.agentDocs[id], data: () => state.agentDocs[id] }),
    update: async (updates) => { state.agentDocs[id] = { ...state.agentDocs[id], ...updates }; },
  });
  const collection = (name) => {
    if (name === 'agents') return { doc: (id) => buildAgentRef(id) };
    throw new Error(`Unmocked collection: ${name}`);
  };
  const runTransaction = async (fn) => fn({
    get: async (ref) => ref.get(),
    update: async (ref, updates) => ref.update(updates),
  });
  return { db: { collection, runTransaction }, state };
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

const AGENT_ID = 'agent-1';

function seed(agent = {}) {
  const fake = makeFakeFirestore({
    agentDocs: {
      [AGENT_ID]: {
        ownerId: 'test-user',
        archetype: 'guardian',
        activeBattleId: null,
        standingLeans: [],
        ...agent,
      },
    },
  });
  activeFirestore = fake.db;
  return fake;
}

beforeEach(() => {
  flagState.leansEnabled = true;
  authReturnValue.current = { uid: 'test-user' };
  shadowLogCalls.current = [];
  activeFirestore = null;
});

describe('equip-lean — validation matrix (fail closed, never trust future UI)', () => {
  it('equips a valid current-version menu lean and bumps settingsRev', async () => {
    const fake = seed();
    const { req, res } = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-04', version: 1 });
    await equipLeanHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.standingLeans).toHaveLength(1);
    expect(res.body.standingLeans[0]).toMatchObject({ adjustmentId: 'CP-04', version: 1 });
    const agent = fake.state.agentDocs[AGENT_ID];
    expect(agent.standingLeans[0].equippedAt).toBeDefined();
    expect(agent.settingsRev).toBeDefined();
    expect(shadowLogCalls.current.some((c) => c.stage === 'standing_lean_equip')).toBe(true);
  });

  it('400s a cross-archetype id (menu membership under the CURRENT archetype)', async () => {
    seed();
    const { req, res } = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'DV-01', version: 1 });
    await equipLeanHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('not_in_menu');
  });

  it('409s a stale/deprecated version pin (client must re-confirm current wording)', async () => {
    seed();
    const { req, res } = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-04', version: 0 });
    await equipLeanHandler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('deprecated_version');
  });

  it('400s a missing/non-integer version (the UI must assert what it displayed)', async () => {
    seed();
    const noVersion = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-04' });
    await equipLeanHandler(noVersion.req, noVersion.res);
    expect(noVersion.res.statusCode).toBe(400);
    expect(noVersion.res.body.error).toBe('invalid_version');
  });

  it('REJECTS an opposing lean combination at equip (conflict groups, changelog #8)', async () => {
    seed({ standingLeans: [{ adjustmentId: 'CP-04', version: 1, equippedAt: 't' }] });
    const { req, res } = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-05', version: 1 });
    await equipLeanHandler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('conflicting_lean');
    expect(res.body.conflictsWith).toEqual(['CP-04']);
  });

  it('allows a non-opposing second lean, then enforces the cap of 2', async () => {
    const fake = seed({ standingLeans: [{ adjustmentId: 'CP-04', version: 1, equippedAt: 't' }] });
    const second = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-01', version: 1 });
    await equipLeanHandler(second.req, second.res);
    expect(second.res.statusCode).toBe(200);
    expect(fake.state.agentDocs[AGENT_ID].standingLeans).toHaveLength(2);

    const third = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-02', version: 1 });
    await equipLeanHandler(third.req, third.res);
    expect(third.res.statusCode).toBe(409);
    expect(third.res.body.error).toBe('lean_limit');
  });

  it('is idempotent for the same id at the same version (no write, no log)', async () => {
    seed({ standingLeans: [{ adjustmentId: 'CP-04', version: 1, equippedAt: 't' }] });
    const { req, res } = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-04', version: 1 });
    await equipLeanHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(shadowLogCalls.current).toHaveLength(0);
  });

  it('battle-locks lean writes (409 while a battle is active)', async () => {
    seed({ activeBattleId: 'battle-9' });
    const { req, res } = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-04', version: 1 });
    await equipLeanHandler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('battle_active');
  });

  it('403s a foreign agent', async () => {
    seed({ ownerId: 'someone-else' });
    const { req, res } = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-04', version: 1 });
    await equipLeanHandler(req, res);
    expect(res.statusCode).toBe(403);
  });
});

describe('unequip-lean', () => {
  it('removes an equipped lean and bumps settingsRev', async () => {
    const fake = seed({
      standingLeans: [
        { adjustmentId: 'CP-04', version: 1, equippedAt: 't' },
        { adjustmentId: 'CP-01', version: 1, equippedAt: 't' },
      ],
    });
    const { req, res } = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-04' });
    await unequipLeanHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.standingLeans.map((l) => l.adjustmentId)).toEqual(['CP-01']);
    expect(fake.state.agentDocs[AGENT_ID].settingsRev).toBeDefined();
    expect(shadowLogCalls.current.some((c) => c.stage === 'standing_lean_unequip')).toBe(true);
  });

  it('is idempotent when the lean is not equipped (no write, no log)', async () => {
    seed();
    const { req, res } = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-04' });
    await unequipLeanHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(shadowLogCalls.current).toHaveLength(0);
  });

  it('battle-locks unequips too (lean state is snapshot-frozen at battle creation)', async () => {
    seed({ activeBattleId: 'battle-9', standingLeans: [{ adjustmentId: 'CP-04', version: 1, equippedAt: 't' }] });
    const { req, res } = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-04' });
    await unequipLeanHandler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('battle_active');
  });

  it('the getter-mocked flag OFF restores the dark 404 (round-trip sanity)', async () => {
    flagState.leansEnabled = false;
    seed();
    const equip = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-04', version: 1 });
    await equipLeanHandler(equip.req, equip.res);
    expect(equip.res.statusCode).toBe(404);
    const unequip = makeReqRes({ agentId: AGENT_ID, adjustmentId: 'CP-04' });
    await unequipLeanHandler(unequip.req, unequip.res);
    expect(unequip.res.statusCode).toBe(404);
  });
});
