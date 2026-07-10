// api/agent/update-agent-settings.test.js
//
// R1(a) settingsRev-completeness migration — handler coverage for the
// allowlisted settings write path. Verifies the exact-allowlist rejection
// (including prototype-chain key names), per-field validation, ownership,
// the identical-value idempotent no-op (key-order-blind — no phantom
// settingsRev), the rev bump on real writes, and the server-side ISO
// strategyLastDeployedAt stamp for non-null deployedStrategy only
// (lastDeployedAt itself is never written — decide.js cooldown parity).
//
// BUILD_RULES §4 dependency-surface guard: the REAL handler import pulls
// api/_utils/agentSettingsTx (→ firebase-admin FieldValue) — never mock the
// settings helper here.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { authReturnValue } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
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

const { default: handler } = await import('./update-agent-settings.js');

function makeFakeFirestore({ agentDocs = {} } = {}) {
  const state = { agentDocs };
  const buildAgentRef = (id) => ({
    get: async () => ({ exists: !!state.agentDocs[id], data: () => state.agentDocs[id] }),
    update: async (updates) => { state.agentDocs[id] = { ...state.agentDocs[id], ...updates }; },
  });
  return {
    db: {
      collection: (name) => {
        if (name === 'agents') return { doc: (id) => buildAgentRef(id) };
        throw new Error(`Unmocked collection: ${name}`);
      },
      runTransaction: async (fn) =>
        fn({ get: async (ref) => ref.get(), update: async (ref, updates) => ref.update(updates) }),
    },
    state,
  };
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
    agentDocs: { [AGENT_ID]: { ownerId: 'test-user', activeBattleId: null, ...agent } },
  });
  activeFirestore = fake.db;
  return fake;
}

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  activeFirestore = null;
});

describe('update-agent-settings — the exact allowlist', () => {
  it('rejects a non-allowlisted field by name', async () => {
    seed();
    const { req, res } = makeReqRes({ agentId: AGENT_ID, set: { archetype: 'degen' } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('field_not_allowlisted');
  });

  it('bounds equippedTraits entries: oversized traitIds and oversized payloads are 400s (the 1 MiB battle-doc class)', async () => {
    seed();
    const bigId = makeReqRes({ agentId: AGENT_ID, set: { equippedTraits: [{ traitId: 'x'.repeat(65) }] } });
    await handler(bigId.req, bigId.res);
    expect(bigId.res.statusCode).toBe(400);
    expect(bigId.res.body.error).toBe('invalid_field');

    const bigPayload = makeReqRes({
      agentId: AGENT_ID,
      set: { equippedTraits: [{ traitId: 'trait-1', junk: 'y'.repeat(70 * 1024) }] },
    });
    await handler(bigPayload.req, bigPayload.res);
    expect(bigPayload.res.statusCode).toBe(400);
    expect(bigPayload.res.body.message).toContain('too large');
  });

  it('rejects malformed equippedTraits and deployedStrategy shapes', async () => {
    seed();
    const badTraits = makeReqRes({ agentId: AGENT_ID, set: { equippedTraits: [{ noTraitId: true }] } });
    await handler(badTraits.req, badTraits.res);
    expect(badTraits.res.statusCode).toBe(400);
    expect(badTraits.res.body.error).toBe('invalid_field');

    const badStrategy = makeReqRes({ agentId: AGENT_ID, set: { deployedStrategy: ['not', 'an', 'object'] } });
    await handler(badStrategy.req, badStrategy.res);
    expect(badStrategy.res.statusCode).toBe(400);
  });

  it('rejects prototype-chain key names as not-allowlisted (never a crash or a chain lookup)', async () => {
    // JSON bodies can carry own "__proto__"/"constructor"/"hasOwnProperty"
    // keys; a bare FIELD_VALIDATORS[key] would resolve them THROUGH the
    // prototype chain to non-validator functions. Object.hasOwn treats them
    // as stranger keys like any other.
    for (const key of ['__proto__', 'constructor', 'hasOwnProperty']) {
      seed();
      // JSON.parse (not an object literal): a literal __proto__ key sets the
      // prototype instead of an own property — the wire shape is the attack.
      const set = JSON.parse(`{"${key}": {"x": 1}}`);
      const { req, res } = makeReqRes({ agentId: AGENT_ID, set });
      await handler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('field_not_allowlisted');
    }
  });

  it('rejects an empty/absent set and 403s a foreign agent', async () => {
    seed();
    const empty = makeReqRes({ agentId: AGENT_ID, set: {} });
    await handler(empty.req, empty.res);
    expect(empty.res.statusCode).toBe(400);

    seed({ ownerId: 'someone-else' });
    const foreign = makeReqRes({ agentId: AGENT_ID, set: { equippedTraits: [] } });
    await handler(foreign.req, foreign.res);
    expect(foreign.res.statusCode).toBe(403);
  });
});

describe('update-agent-settings — writes + settingsRev discipline', () => {
  it('writes equippedTraits with a settingsRev bump (no deploy stamp)', async () => {
    const fake = seed();
    const entries = [{ traitId: 'trait-iron-discipline', strength: 'moderate' }];
    const { req, res } = makeReqRes({ agentId: AGENT_ID, set: { equippedTraits: entries } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(false);
    const agent = fake.state.agentDocs[AGENT_ID];
    expect(agent.equippedTraits).toEqual(entries);
    expect(agent.settingsRev).toBeDefined();
    expect(agent.strategyLastDeployedAt).toBeUndefined();
  });

  it('stamps ISO strategyLastDeployedAt for non-null deployedStrategy — NEVER lastDeployedAt (decide.js cooldown parity); the null CLEAR does not stamp', async () => {
    const fake = seed();
    const strategy = { experimentId: 'e1', bundleId: 'b1', guardrails: [], deployedAt: 't' };
    const deploy = makeReqRes({ agentId: AGENT_ID, set: { deployedStrategy: strategy } });
    await handler(deploy.req, deploy.res);
    const agent = fake.state.agentDocs[AGENT_ID];
    expect(agent.deployedStrategy).toEqual(strategy);
    expect(typeof agent.strategyLastDeployedAt).toBe('string'); // ISO, additive field
    // The cooldown field decide.js:157-162 reads stays untouched — the old
    // client writer's Timestamp misparse meant strategy deploys never armed
    // it, and this migration must not change that.
    expect(agent.lastDeployedAt).toBeUndefined();

    const stampBefore = agent.strategyLastDeployedAt;
    const clear = makeReqRes({ agentId: AGENT_ID, set: { deployedStrategy: null } });
    await handler(clear.req, clear.res);
    expect(clear.res.statusCode).toBe(200);
    expect(fake.state.agentDocs[AGENT_ID].deployedStrategy).toBeNull();
    expect(fake.state.agentDocs[AGENT_ID].strategyLastDeployedAt).toBe(stampBefore); // clear never re-stamps
  });

  it('identical-value writes are idempotent no-ops (no phantom settingsRev)', async () => {
    const entries = [{ traitId: 'trait-iron-discipline' }];
    const fake = seed({ equippedTraits: entries });
    const { req, res } = makeReqRes({ agentId: AGENT_ID, set: { equippedTraits: entries } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(fake.state.agentDocs[AGENT_ID].settingsRev).toBeUndefined();
  });

  it('the idempotence check is key-order-blind (Firestore returns sorted map keys)', async () => {
    // At rest: the order Firestore would hand back. The client re-sends the
    // same values with different insertion order — same data, so this must
    // be a no-op, not a phantom settingsRev.
    const fake = seed({
      deployedStrategy: { bundleId: 'b1', experimentId: 'e1', nested: { a: 1, b: 2 } },
    });
    const { req, res } = makeReqRes({
      agentId: AGENT_ID,
      set: { deployedStrategy: { nested: { b: 2, a: 1 }, experimentId: 'e1', bundleId: 'b1' } },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(fake.state.agentDocs[AGENT_ID].settingsRev).toBeUndefined();
    expect(fake.state.agentDocs[AGENT_ID].strategyLastDeployedAt).toBeUndefined();
  });

  it('deliberately has NO battle-lock (parity with the migrated client writers)', async () => {
    const fake = seed({ activeBattleId: 'battle-9' });
    const { req, res } = makeReqRes({ agentId: AGENT_ID, set: { equippedTraits: [] } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    // A real write ([] differs from absent) — it lands and bumps the rev
    // even mid-battle, exactly like the client writers it replaced.
    expect(fake.state.agentDocs[AGENT_ID].equippedTraits).toEqual([]);
    expect(fake.state.agentDocs[AGENT_ID].settingsRev).toBeDefined();
  });
});
