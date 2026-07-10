// api/agent/set-tempo-dial.behavior.test.js
//
// Release 2 PR-b — the dial-service behavior matrix with TEMPO_DIAL_ENABLED
// getter-mocked ON (the equip-lean.behavior.test.js pattern). The fake agent
// ref applies dotted-path updates ('dials.tempo') the way Firestore does, so
// the merge-not-clobber write shape is actually exercised.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { flagState, authReturnValue, shadowLogCalls } = vi.hoisted(() => ({
  flagState: { dialEnabled: true },
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
  requireAuth: async () => authReturnValue.current,
}));
vi.mock('../_utils/shadowLogger.js', () => ({
  logSignalDrops: async (record) => {
    shadowLogCalls.current.push(record);
  },
}));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));
vi.mock('../../src/config/featureFlags.js', () => ({
  get TEMPO_DIAL_ENABLED() { return flagState.dialEnabled; },
}));

const { default: setTempoDialHandler } = await import('./set-tempo-dial.js');

function applyDotted(target, updates) {
  const out = { ...target };
  for (const [key, value] of Object.entries(updates)) {
    if (key.includes('.')) {
      const [head, ...rest] = key.split('.');
      out[head] = { ...(out[head] || {}) };
      let obj = out[head];
      for (const p of rest.slice(0, -1)) {
        obj[p] = { ...(obj[p] || {}) };
        obj = obj[p];
      }
      obj[rest[rest.length - 1]] = value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

function makeFakeFirestore({ agentDocs = {} } = {}) {
  const state = { agentDocs };
  const buildAgentRef = (id) => ({
    get: async () => ({ exists: !!state.agentDocs[id], data: () => state.agentDocs[id] }),
    update: async (updates) => { state.agentDocs[id] = applyDotted(state.agentDocs[id], updates); },
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

function seed(agent = {}) {
  const fake = makeFakeFirestore({
    agentDocs: {
      [AGENT_ID]: { ownerId: 'test-user', activeBattleId: null, ...agent },
    },
  });
  activeFirestore = fake.db;
  return fake;
}

beforeEach(() => {
  flagState.dialEnabled = true;
  authReturnValue.current = { uid: 'test-user' };
  shadowLogCalls.current = [];
  activeFirestore = null;
});

describe('set-tempo-dial — behavior (flag ON)', () => {
  it('writes the DESIRED tempo via the dotted path (future dial siblings survive) and bumps settingsRev', async () => {
    const fake = seed({ dials: { futureDial: 'x' } });
    const { req, res } = makeReqRes({ agentId: AGENT_ID, tempo: 'aggressive' });
    await setTempoDialHandler(req, res);
    expect(res.statusCode).toBe(200);
    const agent = fake.state.agentDocs[AGENT_ID];
    expect(agent.dials.tempo).toBe('aggressive');
    expect(agent.dials.futureDial).toBe('x'); // merge-not-clobber
    expect(agent.settingsRev).toBeDefined();
    expect(shadowLogCalls.current.some((c) => c.stage === 'tempo_dial_set')).toBe(true);
  });

  it('stores an EXPLICIT standard (distinguishable from default-absent at the clamp)', async () => {
    const fake = seed();
    const { req, res } = makeReqRes({ agentId: AGENT_ID, tempo: 'standard' });
    await setTempoDialHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(fake.state.agentDocs[AGENT_ID].dials.tempo).toBe('standard');
  });

  it('400s an unknown tempo value', async () => {
    seed();
    const { req, res } = makeReqRes({ agentId: AGENT_ID, tempo: 'turbo' });
    await setTempoDialHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_tempo');
  });

  it('is idempotent at the current tempo (no write, no log)', async () => {
    seed({ dials: { tempo: 'measured' } });
    const { req, res } = makeReqRes({ agentId: AGENT_ID, tempo: 'measured' });
    await setTempoDialHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(shadowLogCalls.current).toHaveLength(0);
  });

  it('battle-locks dial writes (409 — dial state is snapshot-frozen at battle creation)', async () => {
    seed({ activeBattleId: 'battle-9' });
    const { req, res } = makeReqRes({ agentId: AGENT_ID, tempo: 'aggressive' });
    await setTempoDialHandler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('battle_active');
  });

  it('403s a foreign agent; flag OFF restores the dark 404', async () => {
    seed({ ownerId: 'someone-else' });
    const foreign = makeReqRes({ agentId: AGENT_ID, tempo: 'aggressive' });
    await setTempoDialHandler(foreign.req, foreign.res);
    expect(foreign.res.statusCode).toBe(403);

    flagState.dialEnabled = false;
    const dark = makeReqRes({ agentId: AGENT_ID, tempo: 'aggressive' });
    await setTempoDialHandler(dark.req, dark.res);
    expect(dark.res.statusCode).toBe(404);
  });
});
