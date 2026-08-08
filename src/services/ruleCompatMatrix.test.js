// src/services/ruleCompatMatrix.test.js
//
// WS1 Phase 3 — the BLOCK-COVERAGE FIXTURE MATRIX (spec §6.2/§6.3), driven
// through the REAL forgeService against an in-memory Firestore fake:
// every guarded path × every mode × conflict-hard / conflict-soft / native /
// unknown-template / unknown-archetype cells. Phase 2's evaluator matrix
// proved the decision core; THIS suite proves a core_conflict rule cannot
// become hard through the actual service functions, that observe changes
// nothing but telemetry, and that off is a zero-delta surface (no
// classification, no extra reads, byte-equal writes).
//
// MIGRATION NOTE (WS1 enforce Phase 2): the two ruleHardness writers moved
// server-side — B1 setRuleHardness → POST /api/agent/set-rule-hardness, B3
// reforgeBundle → POST /api/agent/reforge-bundle (the B6/D3 equip precedent).
// Their write-path cells live in the endpoint compat suites
// (api/agent/set-rule-hardness.compat.test.js,
// api/agent/reforge-bundle.compat.test.js); here they are thin-client
// wrapper contracts. A1 createRule and B2 updateRule remain client-guarded
// rule-doc writes and keep their full cells below.
//
// Mock seams (and only these):
//  - firebase/firestore + ../firebase/config → the in-memory store below
//  - ../utils/fetchWithAuth → transport capture (the observe stream)
//  - ../config/featureFlags → getter-backed RULE_COMPAT_MODE so one file can
//    walk off/observe/enforce (a code constant in prod; mutable only here)
// Everything else — forgeService, ruleCompatGuard, compatSurfaceCopy, the
// compatibility map, hardSoftHelper — is REAL (BUILD_RULES §4: the real
// imports are the dependency-surface guard).

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== HOISTED MOCK STATE ====================

const { flagState, store, transportCalls } = vi.hoisted(() => ({
  flagState: { mode: 'off' },
  // path → doc data. Also counts reads per path (the zero-extra-reads proofs).
  store: { docs: new Map(), reads: [], autoId: 0, failReadPaths: new Set() },
  transportCalls: { current: [] },
}));

// ==================== MOCKS ====================

vi.mock('../config/featureFlags', () => ({
  get RULE_COMPAT_MODE() { return flagState.mode; },
  CONFLICT_RECONCILER_DETECT_ENABLED: false, // keep equip minimal; reconciler is out of scope here
}));

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));

vi.mock('../utils/fetchWithAuth', () => ({
  fetchWithAuth: async (url, options) => {
    transportCalls.current.push({ url, body: JSON.parse(options.body) });
    // B6 wrapper tests install a per-test responder (real fetch responses
    // carry .json); every other path only cares about .ok.
    if (typeof transportCalls.responder === 'function') return transportCalls.responder(url, options);
    return { ok: true, json: async () => ({}) };
  },
}));

const DELETE_SENTINEL = { __delete: true };
const TS_SENTINEL = '__server_ts__';

function applyUpdates(target, updates) {
  for (const [key, value] of Object.entries(updates)) {
    if (key.includes('.')) {
      const parts = key.split('.');
      let obj = target;
      for (const p of parts.slice(0, -1)) {
        if (typeof obj[p] !== 'object' || obj[p] === null) obj[p] = {};
        obj = obj[p];
      }
      const leaf = parts[parts.length - 1];
      if (value === DELETE_SENTINEL) delete obj[leaf];
      else obj[leaf] = value;
    } else if (value === DELETE_SENTINEL) {
      delete target[key];
    } else {
      target[key] = value;
    }
  }
}

vi.mock('firebase/firestore', () => ({
  doc: (_db, ...segments) => ({ __path: segments.join('/') }),
  collection: (_db, ...segments) => ({ __path: segments.join('/') }),
  getDoc: async (ref) => {
    store.reads.push(ref.__path);
    if (store.failReadPaths.has(ref.__path)) throw new Error(`fake read failure: ${ref.__path}`);
    const data = store.docs.get(ref.__path);
    return { exists: () => data !== undefined, data: () => data };
  },
  addDoc: async (colRef, data) => {
    const id = `auto-${++store.autoId}`;
    store.docs.set(`${colRef.__path}/${id}`, JSON.parse(JSON.stringify(data)));
    return { id };
  },
  updateDoc: async (ref, updates) => {
    const data = store.docs.get(ref.__path);
    if (data === undefined) throw new Error(`fake updateDoc on missing doc: ${ref.__path}`);
    applyUpdates(data, updates);
  },
  writeBatch: () => {
    const ops = [];
    return {
      update: (ref, updates) => ops.push({ ref, updates }),
      commit: async () => {
        for (const { ref, updates } of ops) {
          const data = store.docs.get(ref.__path);
          if (data === undefined) throw new Error(`fake batch update on missing doc: ${ref.__path}`);
          applyUpdates(data, updates);
        }
      },
    };
  },
  getDocs: async () => { throw new Error('getDocs not used by the matrix paths'); },
  query: () => { throw new Error('query not used by the matrix paths'); },
  orderBy: () => { throw new Error('orderBy not used by the matrix paths'); },
  serverTimestamp: () => TS_SENTINEL,
  deleteField: () => DELETE_SENTINEL,
}));

const {
  createRule, updateRule, setRuleHardness, reforgeBundle, equipBundle, unequipBundle,
} = await import('./forgeService.js');
const { RuleCompatBlockError } = await import('./ruleCompatGuard.js');

// ==================== FIXTURES ====================

const AGENT = 'agent-1';
const agentPath = `agents/${AGENT}`;
const rulePath = (id) => `agents/${AGENT}/rules/${id}`;
const bundlePath = (id) => `agents/${AGENT}/bundles/${id}`;

// Cell vocabulary (shipped map):
//  guardian × a-05                  → core_conflict, allocation (hard by category)
//  guardian × tech-bollinger-squeeze → core_conflict, technical (soft by category)
//  guardian × ts-01                 → NATIVE, tier_strategy
//  degen    × fund-market-cap       → neutral fall-through
const seedAgent = (archetype = 'guardian') => {
  store.docs.set(agentPath, { ownerId: 'u1', archetype, activeBattleId: null, stats: { gamesPlayed: 0 }, equippedBundleIds: [] });
};
const seedRule = (id, { sourceRef, category }) => {
  store.docs.set(rulePath(id), { sourceRef, category, text: `text-${id}`, isDeleted: false, traitId: null });
};
const ruleData = (sourceRef, category) => ({
  text: `rule for ${sourceRef ?? 'manual'}`,
  source: sourceRef ? 'forge_discover' : 'manual',
  sourceRef: sourceRef ?? null,
  category,
  provenance: 'user_equipped',
});

const agentReads = () => store.reads.filter((p) => p === agentPath).length;
const events = () => transportCalls.current.flatMap((c) => c.body.events);

beforeEach(() => {
  flagState.mode = 'off';
  store.docs.clear();
  store.reads.length = 0;
  store.failReadPaths.clear();
  store.autoId = 0;
  transportCalls.current = [];
  transportCalls.responder = null;
});

// ==================== A1 — createRule ====================

describe('matrix — A1 createRule (create-as-hard)', () => {
  it('ENFORCE × conflict-hard: rejects RuleCompatBlockError, doc NOT created, blocked:true event', async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    await expect(createRule(AGENT, ruleData('a-05', 'allocation'), { archetype: 'guardian' }))
      .rejects.toBeInstanceOf(RuleCompatBlockError);
    expect([...store.docs.keys()].filter((p) => p.includes('/rules/'))).toHaveLength(0);
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({ type: 'compat_promote_blocked', blocked: true, path: 'create_rule', ruleId: 'a-05' });
  });

  it('ENFORCE × conflict-soft: created, compat_conflict_equip logged, write proceeds', async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    const id = await createRule(AGENT, ruleData('tech-bollinger-squeeze', 'technical'), { archetype: 'guardian' });
    expect(store.docs.get(rulePath(id))).toMatchObject({ sourceRef: 'tech-bollinger-squeeze', category: 'technical' });
    expect(events()[0]).toMatchObject({ type: 'compat_conflict_equip', blocked: false, hardnessRequested: 'soft' });
  });

  it('ENFORCE × native / unknown-template / unknown-archetype: created, zero events (fail-open)', async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    await createRule(AGENT, ruleData('ts-01', 'tier_strategy'), { archetype: 'guardian' });   // native
    await createRule(AGENT, ruleData(null, 'risk'), { archetype: 'guardian' });               // manual, hard category
    await createRule(AGENT, ruleData('a-05', 'allocation'), { archetype: 'not-a-real-one' }); // unknown archetype
    expect([...store.docs.keys()].filter((p) => p.includes('/rules/'))).toHaveLength(3);
    expect(events()).toHaveLength(0);
  });

  it('OBSERVE × conflict-hard: doc IS created, blocked:false attempt logged', async () => {
    flagState.mode = 'observe';
    seedAgent('guardian');
    const id = await createRule(AGENT, ruleData('a-05', 'allocation'), { archetype: 'guardian' });
    expect(store.docs.get(rulePath(id))).toBeDefined();
    expect(events()[0]).toMatchObject({ type: 'compat_promote_blocked', blocked: false, mode: 'observe' });
  });

  it('OFF × conflict-hard: created with zero classification — no agent read, no transport', async () => {
    flagState.mode = 'off';
    seedAgent('guardian');
    const id = await createRule(AGENT, ruleData('a-05', 'allocation'))
    expect(store.docs.get(rulePath(id))).toBeDefined();
    expect(agentReads()).toBe(0);
    expect(transportCalls.current).toHaveLength(0);
  });

  it('getDoc FALLBACK: enforce without threaded archetype reads the agent once and still blocks', async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    await expect(createRule(AGENT, ruleData('a-05', 'allocation'))).rejects.toBeInstanceOf(RuleCompatBlockError);
    expect(agentReads()).toBe(1);
  });

  it('RIDER (review add 1): fallback resolution failure errors LOUDLY, fails open, emits nothing', async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    store.failReadPaths.add(agentPath);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const id = await createRule(AGENT, ruleData('a-05', 'allocation')); // archetype unresolvable → neutral fail-open
      expect(store.docs.get(rulePath(id))).toBeDefined();
      expect(events()).toHaveLength(0);
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('compat archetype read failed'),
        expect.anything()
      );
    } finally {
      errSpy.mockRestore();
    }
  });
});

// ==================== B1 — setRuleHardness ====================
//
// WS1 enforce Phase 2: the explicit-promote write moved server-side
// (POST /api/agent/set-rule-hardness — the B6/D3 pattern below), because
// bundles.ruleHardness is server-mintable only once the bundles field
// allowlist publishes. The write-path matrix coverage that lived here
// (enforce block, observe log-not-block, off zero-classification, the
// null-clear promote) moved WITH the write path to
// api/agent/set-rule-hardness.compat.test.js. What remains client-side to
// prove is the wrapper contract.

describe('matrix — B1 setRuleHardness (thin client wrapper since the WS1 enforce Phase 2 migration)', () => {
  it('POSTs to /api/agent/set-rule-hardness with the explicit value (null clear included)', async () => {
    transportCalls.current = [];
    transportCalls.responder = () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });
    await setRuleHardness(AGENT, 'b1', 'rc', 'hard');
    await setRuleHardness(AGENT, 'b1', 'rc', null);
    expect(transportCalls.current).toHaveLength(2);
    expect(transportCalls.current[0]).toMatchObject({
      url: '/api/agent/set-rule-hardness',
      body: { agentId: AGENT, bundleId: 'b1', ruleId: 'rc', value: 'hard' },
    });
    expect(transportCalls.current[1].body).toMatchObject({ value: null });
  });

  it('surfaces the server 409 block copy as err.message (callers toast it)', async () => {
    transportCalls.current = [];
    transportCalls.responder = () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: 'rule_compat_blocked', message: 'Off-style for your archetype: blocked by the server gate.' }),
    });
    await expect(setRuleHardness(AGENT, 'b1', 'rc', 'hard'))
      .rejects.toThrow('Off-style for your archetype: blocked by the server gate.');
  });

  it("rejects a bad value client-side without a network call ('hard' | 'soft' | null only)", async () => {
    transportCalls.current = [];
    await expect(setRuleHardness(AGENT, 'b1', 'rc', 'firm'))
      .rejects.toThrow("Rule hardness must be 'hard', 'soft', or null");
    expect(transportCalls.current).toHaveLength(0);
  });
});

// ==================== B2 — updateRule ====================

describe('matrix — B2 updateRule (category-flip promote)', () => {
  it("ENFORCE × conflict rule, category → 'risk' (hard): throws, doc unchanged", async () => {
    flagState.mode = 'enforce';
    seedAgent('momentum_chaser');
    seedRule('r1', { sourceRef: 'tech-rsi-oversold', category: 'technical' }); // TF conflict
    await expect(updateRule(AGENT, 'r1', { category: 'risk' }, { archetype: 'momentum_chaser' }))
      .rejects.toBeInstanceOf(RuleCompatBlockError);
    expect(store.docs.get(rulePath('r1')).category).toBe('technical');
    expect(events()[0]).toMatchObject({ path: 'update_rule_category', blocked: true, ruleId: 'tech-rsi-oversold' });
  });

  it("ENFORCE × soft-direction flip and native flips: succeed unguarded", async () => {
    flagState.mode = 'enforce';
    seedAgent('momentum_chaser');
    seedRule('r1', { sourceRef: 'tech-rsi-oversold', category: 'risk' });
    seedRule('r2', { sourceRef: 'tech-moving-average-trend', category: 'technical' }); // TF native
    await updateRule(AGENT, 'r1', { category: 'technical' }, { archetype: 'momentum_chaser' }); // hard→soft: demote
    await updateRule(AGENT, 'r2', { category: 'allocation' }, { archetype: 'momentum_chaser' }); // native promote: fine
    expect(store.docs.get(rulePath('r1')).category).toBe('technical');
    expect(store.docs.get(rulePath('r2')).category).toBe('allocation');
    expect(events()).toHaveLength(0);
  });

  it('ENFORCE × NON-FLIP: the refine flow re-sending an UNCHANGED hard category on a conflict rule passes (no promotion occurred)', async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    seedRule('r9', { sourceRef: 'a-05', category: 'allocation' }); // already hard by category
    await updateRule(AGENT, 'r9', { text: 'reworded', category: 'allocation' }, { archetype: 'guardian' });
    expect(store.docs.get(rulePath('r9')).text).toBe('reworded');
    expect(events()).toHaveLength(0);
  });

  it('ENFORCE × text-only update on a conflict rule: no guard reads at all', async () => {
    flagState.mode = 'enforce';
    seedAgent('momentum_chaser');
    seedRule('r1', { sourceRef: 'tech-rsi-oversold', category: 'technical' });
    await updateRule(AGENT, 'r1', { text: 'new text' }, { archetype: 'momentum_chaser' });
    // Sol re-review #1: every identity write now captures the epoch token at
    // formation (one composition/writeEpoch read) — the ZERO-GUARD-READS
    // claim is about the COMPAT guard, so the token read is filtered out.
    expect(store.reads.filter((p) => p !== 'composition/writeEpoch')).toEqual([]); // no rule pre-read, no agent read
    expect(store.docs.get(rulePath('r1')).text).toBe('new text');
  });

  it('OBSERVE × conflict hard-flip: written + attempt logged; OFF: written, silent, zero reads', async () => {
    flagState.mode = 'observe';
    seedAgent('momentum_chaser');
    seedRule('r1', { sourceRef: 'tech-rsi-oversold', category: 'technical' });
    await updateRule(AGENT, 'r1', { category: 'risk' }, { archetype: 'momentum_chaser' });
    expect(store.docs.get(rulePath('r1')).category).toBe('risk');
    expect(events()[0]).toMatchObject({ blocked: false, path: 'update_rule_category' });

    flagState.mode = 'off';
    store.reads.length = 0;
    transportCalls.current = [];
    seedRule('r3', { sourceRef: 'tech-rsi-oversold', category: 'technical' });
    await updateRule(AGENT, 'r3', { category: 'risk' });
    expect(store.docs.get(rulePath('r3')).category).toBe('risk');
    expect(store.reads.filter((p) => p !== 'composition/writeEpoch')).toEqual([]); // #1: the epoch-token read is not a guard read
    expect(transportCalls.current).toHaveLength(0);
  });
});

// ==================== B3 — reforgeBundle ====================
//
// WS1 enforce Phase 2: the whole reforge moved server-side
// (POST /api/agent/reforge-bundle) — the carry is a ruleHardness re-write,
// so it moved with setRuleHardness (server-mintable only). The write-path
// matrix coverage that lived here (enforce strip / hard-category explicit
// demote / observe carry-unchanged / off byte-equal) moved WITH the write
// path to api/agent/reforge-bundle.compat.test.js. What remains client-side
// to prove is the wrapper contract.

describe('matrix — B3 reforgeBundle (thin client wrapper since the WS1 enforce Phase 2 migration)', () => {
  it('POSTs to /api/agent/reforge-bundle and unwraps { bundleId, strippedConflicts }', async () => {
    transportCalls.current = [];
    transportCalls.responder = () => ({
      ok: true,
      status: 200,
      json: async () => ({
        agentId: AGENT,
        bundleId: 'new-draft-1',
        strippedConflicts: [{ templateId: 'tech-bollinger-squeeze', ruleDocId: 'rc' }],
        compatLogged: true,
      }),
    });
    const out = await reforgeBundle(AGENT, 'b1');
    expect(transportCalls.current).toHaveLength(1);
    expect(transportCalls.current[0]).toMatchObject({
      url: '/api/agent/reforge-bundle',
      body: { agentId: AGENT, bundleId: 'b1' },
    });
    // The pre-migration return contract, preserved for useForge's inline notice.
    expect(out).toEqual({
      bundleId: 'new-draft-1',
      strippedConflicts: [{ templateId: 'tech-bollinger-squeeze', ruleDocId: 'rc' }],
    });
  });

  it('throws the server message string on a non-2xx (callers surface err.message)', async () => {
    transportCalls.current = [];
    transportCalls.responder = () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'is_draft', message: 'Cannot reforge a draft bundle — edit it directly' }),
    });
    await expect(reforgeBundle(AGENT, 'b1'))
      .rejects.toThrow('Cannot reforge a draft bundle — edit it directly');
  });
});

// ==================== B6 — equipBundle ====================
//
// Release 2 settingsRev migration (D3, 2026-07-10): the equip write moved
// server-side (POST /api/agent/equip-bundle) — the client function is now a
// thin authenticated wrapper. The write-path matrix coverage that lived here
// (warn-only equip, classification + equip_bundle events, §6.3 written-state
// deep-equality across modes) moved WITH the write path to
// api/agent/equip-bundle.test.js + api/agent/equip-bundle.compat.test.js.
// What remains client-side to prove is the wrapper contract.

describe('matrix — B6 equipBundle (thin client wrapper since the D3 migration)', () => {
  it('POSTs to /api/agent/equip-bundle and unwraps the preserved return contract', async () => {
    transportCalls.current = [];
    transportCalls.responder = () => ({
      ok: true,
      status: 200,
      json: async () => ({
        agentId: AGENT,
        bundleId: 'b1',
        conflictCheckResult: null,
        compatConflicts: [{ templateId: 'a-05', ruleDocId: 's1', zone1Ref: 'z', resolvedHardness: 'hard' }],
        archetype: 'guardian',
        equippedBundleIds: ['b1'],
      }),
    });
    const out = await equipBundle(AGENT, 'b1');
    expect(transportCalls.current).toHaveLength(1);
    expect(transportCalls.current[0]).toMatchObject({
      url: '/api/agent/equip-bundle',
      body: { agentId: AGENT, bundleId: 'b1' },
    });
    // The pre-migration return contract, preserved for the equip hooks.
    expect(out).toEqual({
      conflictCheckResult: null,
      compatConflicts: [{ templateId: 'a-05', ruleDocId: 's1', zone1Ref: 'z', resolvedHardness: 'hard' }],
      archetype: 'guardian',
    });
  });

  it('throws the server message string on a non-2xx (callers surface err.message)', async () => {
    transportCalls.current = [];
    transportCalls.responder = () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: 'battle_active', message: 'Cannot equip bundle while agent has an active battle. Wait for the battle to complete.' }),
    });
    await expect(equipBundle(AGENT, 'b1')).rejects.toThrow(/Cannot equip bundle while agent has an active battle/);
  });

  it('unequipBundle POSTs to /api/agent/unequip-bundle and throws the server message on failure', async () => {
    transportCalls.current = [];
    transportCalls.responder = () => ({ ok: true, status: 200, json: async () => ({ equippedBundleIds: [] }) });
    await unequipBundle(AGENT, 'b1');
    expect(transportCalls.current[0]).toMatchObject({
      url: '/api/agent/unequip-bundle',
      body: { agentId: AGENT, bundleId: 'b1' },
    });
    transportCalls.responder = () => ({ ok: false, status: 400, json: async () => ({ message: 'Bundle is not equipped.' }) });
    await expect(unequipBundle(AGENT, 'b1')).rejects.toThrow('Bundle is not equipped.');
  });
});

// ==================== cross-path invariant ====================

describe('matrix — the §6.2 promise: a core_conflict rule cannot become hard through ANY guarded path under enforce', () => {
  it('create-as-hard and category-flip block CLIENT-side; promote and reforge-carry surface the SERVER gate (their store-level proof lives in the endpoint compat suites)', async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    // A1 — client-guarded rule-doc write.
    await expect(createRule(AGENT, ruleData('a-05', 'allocation'), { archetype: 'guardian' })).rejects.toThrow();
    // B2 — client-guarded rule-doc write.
    seedRule('rc', { sourceRef: 'tech-bollinger-squeeze', category: 'technical' });
    await expect(updateRule(AGENT, 'rc', { category: 'allocation' }, { archetype: 'guardian' })).rejects.toThrow();
    // B1 — server-guarded since WS1 enforce Phase 2: the thin client surfaces
    // the endpoint's 409 block; the override-not-written proof lives in
    // api/agent/set-rule-hardness.compat.test.js.
    transportCalls.responder = (url) =>
      url === '/api/agent/set-rule-hardness'
        ? { ok: false, status: 409, json: async () => ({ error: 'rule_compat_blocked', message: 'blocked by the server gate' }) }
        : { ok: true, status: 200, json: async () => ({}) };
    await expect(setRuleHardness(AGENT, 'b1', 'rc', 'hard')).rejects.toThrow('blocked by the server gate');
    // B3 — server-guarded: the strip lands server-side and is REPORTED back
    // for the inline notice; the carried-map proof lives in
    // api/agent/reforge-bundle.compat.test.js.
    transportCalls.responder = (url) =>
      url === '/api/agent/reforge-bundle'
        ? {
            ok: true,
            status: 200,
            json: async () => ({
              bundleId: 'new-1',
              strippedConflicts: [{ templateId: 'tech-bollinger-squeeze', ruleDocId: 'rc' }],
            }),
          }
        : { ok: true, status: 200, json: async () => ({}) };
    const { strippedConflicts } = await reforgeBundle(AGENT, 'b2');
    expect(strippedConflicts).toHaveLength(1);

    // Client-guarded final state: the rule doc never flipped to a hard category.
    expect(store.docs.get(rulePath('rc')).category).toBe('technical');
  });
});
