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
    return { ok: true };
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
  createRule, updateRule, setRuleHardness, reforgeBundle, equipBundle,
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

describe('matrix — B1 setRuleHardness (explicit promote)', () => {
  const seedDraftBundle = () => {
    seedRule('rc', { sourceRef: 'tech-bollinger-squeeze', category: 'technical' }); // guardian conflict (soft cat)
    seedRule('rn', { sourceRef: 'ts-01', category: 'tier_strategy' });              // guardian native
    store.docs.set(bundlePath('b1'), { status: 'draft', name: 'B', ruleIds: ['rc', 'rn'], ruleHardness: {} });
  };

  it("ENFORCE × conflict → 'hard': throws, override NOT written, blocked event", async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    seedDraftBundle();
    await expect(setRuleHardness(AGENT, 'b1', 'rc', 'hard', { archetype: 'guardian' }))
      .rejects.toBeInstanceOf(RuleCompatBlockError);
    expect(store.docs.get(bundlePath('b1')).ruleHardness).toEqual({});
    expect(events()[0]).toMatchObject({ type: 'compat_promote_blocked', blocked: true, path: 'set_rule_hardness', ruleDocId: 'rc' });
  });

  it("ENFORCE × native → 'hard' and conflict → 'soft': both succeed, no events", async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    seedDraftBundle();
    await setRuleHardness(AGENT, 'b1', 'rn', 'hard', { archetype: 'guardian' });
    await setRuleHardness(AGENT, 'b1', 'rc', 'soft', { archetype: 'guardian' }); // demote direction: never guarded
    expect(store.docs.get(bundlePath('b1')).ruleHardness).toEqual({ rn: 'hard', rc: 'soft' });
    expect(events()).toHaveLength(0);
  });

  it("OBSERVE × conflict → 'hard': override IS written, attempt logged", async () => {
    flagState.mode = 'observe';
    seedAgent('guardian');
    seedDraftBundle();
    await setRuleHardness(AGENT, 'b1', 'rc', 'hard', { archetype: 'guardian' });
    expect(store.docs.get(bundlePath('b1')).ruleHardness).toEqual({ rc: 'hard' });
    expect(events()[0]).toMatchObject({ type: 'compat_promote_blocked', blocked: false });
  });

  it("OFF × conflict → 'hard': written with zero classification (no rule-doc read beyond the service's own bundle read)", async () => {
    flagState.mode = 'off';
    seedAgent('guardian');
    seedDraftBundle();
    await setRuleHardness(AGENT, 'b1', 'rc', 'hard');
    expect(store.docs.get(bundlePath('b1')).ruleHardness).toEqual({ rc: 'hard' });
    expect(store.reads).toEqual([bundlePath('b1')]); // exactly the pre-existing read
    expect(transportCalls.current).toHaveLength(0);
  });

  it("ENFORCE × NULL-CLEAR promote: clearing a 'soft' override on a hard-CATEGORY conflict rule resolves hard → BLOCKED (the UI's Hard toggle sends exactly null)", async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    // The post-cleanup shape: a-05 (allocation ⇒ hard by category) demoted 'soft'.
    seedRule('ra', { sourceRef: 'a-05', category: 'allocation' });
    store.docs.set(bundlePath('b1'), { status: 'draft', name: 'B', ruleIds: ['ra'], ruleHardness: { ra: 'soft' } });
    await expect(setRuleHardness(AGENT, 'b1', 'ra', null, { archetype: 'guardian' }))
      .rejects.toBeInstanceOf(RuleCompatBlockError);
    expect(store.docs.get(bundlePath('b1')).ruleHardness).toEqual({ ra: 'soft' }); // demote intact
    expect(events()[0]).toMatchObject({ type: 'compat_promote_blocked', blocked: true, hardnessRequested: 'hard' });
  });

  it("ENFORCE × null-clear on a NATIVE hard-category rule (and a conflict clear that resolves SOFT) both pass", async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    seedRule('rn2', { sourceRef: 'alloc-sector-cap', category: 'allocation' }); // guardian NATIVE hard-category
    seedRule('rc2', { sourceRef: 'tech-bollinger-squeeze', category: 'technical' }); // conflict, soft category
    store.docs.set(bundlePath('b2'), { status: 'draft', name: 'B2', ruleIds: ['rn2', 'rc2'], ruleHardness: { rn2: 'soft', rc2: 'hard' } });
    await setRuleHardness(AGENT, 'b2', 'rn2', null, { archetype: 'guardian' }); // native: clear→hard is fine
    await setRuleHardness(AGENT, 'b2', 'rc2', null, { archetype: 'guardian' }); // conflict: clear→soft (category) is a demote
    expect(store.docs.get(bundlePath('b2')).ruleHardness).toEqual({});
    expect(events()).toHaveLength(0);
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
    expect(store.reads).toEqual([]); // no rule pre-read, no agent read
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
    expect(store.reads).toEqual([]);
    expect(transportCalls.current).toHaveLength(0);
  });
});

// ==================== B3 — reforgeBundle ====================

describe('matrix — B3 reforgeBundle (hard-override carry-forward)', () => {
  const seedForgedBundle = () => {
    seedRule('rc', { sourceRef: 'tech-bollinger-squeeze', category: 'technical' }); // guardian conflict
    seedRule('rn', { sourceRef: 'ts-01', category: 'tier_strategy' });              // guardian native
    seedRule('rs', { sourceRef: 'a-05', category: 'allocation' });                  // guardian conflict (soft override below)
    store.docs.set(bundlePath('b1'), {
      status: 'forged', name: 'B', version: 1, ruleIds: ['rc', 'rn', 'rs'],
      ruleHardness: { rc: 'hard', rn: 'hard', rs: 'soft' },
      ruleSnapshots: [],
    });
  };
  const newDraft = () =>
    [...store.docs.entries()].find(([p, d]) => p.includes('/bundles/auto-') && d.status === 'draft')?.[1];

  it('ENFORCE: strips ONLY the conflict hard-override, logs it blocked:true, returns it for the inline notice', async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    seedForgedBundle();
    const { bundleId, strippedConflicts } = await reforgeBundle(AGENT, 'b1', { archetype: 'guardian' });
    expect(bundleId).toMatch(/^auto-/);
    expect(strippedConflicts).toEqual([{ templateId: 'tech-bollinger-squeeze', ruleDocId: 'rc' }]);
    expect(newDraft().ruleHardness).toEqual({ rn: 'hard', rs: 'soft' }); // native carry + soft conflict untouched
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({ type: 'compat_promote_blocked', blocked: true, path: 'reforge_carry', ruleDocId: 'rc' });
  });

  it("ENFORCE: a hard-CATEGORY conflict override strips to an explicit 'soft' — deletion would resurrect must-obey via the category default", async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    seedRule('rh', { sourceRef: 'a-05', category: 'allocation' }); // conflict, hard category
    store.docs.set(bundlePath('b3'), {
      status: 'forged', name: 'B3', version: 1, ruleIds: ['rh'],
      ruleHardness: { rh: 'hard' }, ruleSnapshots: [],
    });
    const { strippedConflicts } = await reforgeBundle(AGENT, 'b3', { archetype: 'guardian' });
    expect(strippedConflicts).toEqual([{ templateId: 'a-05', ruleDocId: 'rh' }]);
    const draft = [...store.docs.values()].find((d) => d.status === 'draft' && d.name === 'B3');
    expect(draft.ruleHardness).toEqual({ rh: 'soft' }); // explicit demote, NOT a delete
  });

  it('OBSERVE: carry unchanged (would-strip logged blocked:false), nothing stripped', async () => {
    flagState.mode = 'observe';
    seedAgent('guardian');
    seedForgedBundle();
    const { strippedConflicts } = await reforgeBundle(AGENT, 'b1', { archetype: 'guardian' });
    expect(strippedConflicts).toEqual([]);
    expect(newDraft().ruleHardness).toEqual({ rc: 'hard', rn: 'hard', rs: 'soft' });
    expect(events()[0]).toMatchObject({ blocked: false, path: 'reforge_carry' });
  });

  it('OFF: carry byte-equal, zero guard reads (only the service’s own bundle read), no transport', async () => {
    flagState.mode = 'off';
    seedAgent('guardian');
    seedForgedBundle();
    const { strippedConflicts } = await reforgeBundle(AGENT, 'b1');
    expect(strippedConflicts).toEqual([]);
    expect(newDraft().ruleHardness).toEqual({ rc: 'hard', rn: 'hard', rs: 'soft' });
    expect(store.reads).toEqual([bundlePath('b1')]);
    expect(transportCalls.current).toHaveLength(0);
  });
});

// ==================== B6 — equipBundle ====================

describe('matrix — B6 equipBundle (conflict-equip surface; never blocks)', () => {
  const seedForgedForEquip = () => {
    store.docs.set(bundlePath('b1'), {
      status: 'forged', name: 'B', ruleIds: ['s1', 's2', 's3', 's4'],
      ruleHardness: {},
      ruleSnapshots: [
        { id: 's1', sourceRef: 'a-05', category: 'allocation', text: 't1' },              // conflict, hard
        { id: 's2', sourceRef: 'tech-bollinger-squeeze', category: 'technical', text: 't2' }, // conflict, soft
        { id: 's3', sourceRef: 'ts-01', category: 'tier_strategy', text: 't3' },          // native
        { id: 's4', sourceRef: null, category: 'risk', text: 't4' },                      // manual — outside map
      ],
    });
  };

  it('ENFORCE: equip PROCEEDS (warn-only surface), both conflicts returned + logged with resolved hardness', async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    seedForgedForEquip();
    const { compatConflicts, archetype } = await equipBundle(AGENT, 'b1');
    expect(archetype).toBe('guardian'); // returned so un-threaded equip surfaces render correct warning copy
    expect(store.docs.get(agentPath).equippedBundleIds).toEqual(['b1']);   // equip landed
    expect(store.docs.get(agentPath).activeRules).toHaveLength(4);          // nothing filtered
    expect(compatConflicts).toHaveLength(2);
    expect(compatConflicts.find((c) => c.ruleDocId === 's1')).toMatchObject({ resolvedHardness: 'hard' });
    expect(compatConflicts.find((c) => c.ruleDocId === 's2')).toMatchObject({ resolvedHardness: 'soft' });
    expect(events()).toHaveLength(2);
    expect(events().every((e) => e.type === 'compat_conflict_equip' && e.path === 'equip_bundle' && e.blocked === false)).toBe(true);
  });

  it('MODE SNAPSHOT (§6.3): the written agent state is deep-equal across off / observe / enforce', async () => {
    const run = async (mode) => {
      store.docs.clear(); store.reads.length = 0; transportCalls.current = [];
      flagState.mode = mode;
      seedAgent('guardian');
      seedForgedForEquip();
      await equipBundle(AGENT, 'b1');
      const state = JSON.parse(JSON.stringify({ agent: store.docs.get(agentPath), bundle: store.docs.get(bundlePath('b1')) }));
      // equippedAt is a wall-clock stamp (new Date() in the service, unrelated
      // to the mode) — normalize it so the cross-mode compare tests BEHAVIOR,
      // not millisecond timing between the three runs.
      expect(typeof state.bundle.equippedAt).toBe('string');
      state.bundle.equippedAt = '<wall-clock>';
      return state;
    };
    const off = await run('off');
    const observe = await run('observe');
    const enforce = await run('enforce');
    expect(observe).toEqual(off);
    expect(enforce).toEqual(off); // the only enforce delta is telemetry + the toast — never the written state
  });

  it('OFF: compatConflicts [] with zero classification and no transport', async () => {
    flagState.mode = 'off';
    seedAgent('guardian');
    seedForgedForEquip();
    const { compatConflicts } = await equipBundle(AGENT, 'b1');
    expect(compatConflicts).toEqual([]);
    expect(transportCalls.current).toHaveLength(0);
  });
});

// ==================== cross-path invariant ====================

describe('matrix — the §6.2 promise: a core_conflict rule cannot become hard through ANY guarded path under enforce', () => {
  it('create-as-hard, promote, category-flip, and reforge-carry all end with no hard conflict in the store', async () => {
    flagState.mode = 'enforce';
    seedAgent('guardian');
    // A1
    await expect(createRule(AGENT, ruleData('a-05', 'allocation'), { archetype: 'guardian' })).rejects.toThrow();
    // B1
    seedRule('rc', { sourceRef: 'tech-bollinger-squeeze', category: 'technical' });
    store.docs.set(bundlePath('b1'), { status: 'draft', name: 'B', ruleIds: ['rc'], ruleHardness: {} });
    await expect(setRuleHardness(AGENT, 'b1', 'rc', 'hard', { archetype: 'guardian' })).rejects.toThrow();
    // B2
    await expect(updateRule(AGENT, 'rc', { category: 'allocation' }, { archetype: 'guardian' })).rejects.toThrow();
    // B3
    store.docs.set(bundlePath('b2'), {
      status: 'forged', name: 'B2', version: 1, ruleIds: ['rc'], ruleHardness: { rc: 'hard' }, ruleSnapshots: [],
    });
    const { strippedConflicts } = await reforgeBundle(AGENT, 'b2', { archetype: 'guardian' });
    expect(strippedConflicts).toHaveLength(1);

    // Final state: no rule doc with a hard category conflict, no bundle map
    // carrying 'hard' for the conflict doc.
    expect(store.docs.get(rulePath('rc')).category).toBe('technical');
    expect(store.docs.get(bundlePath('b1')).ruleHardness).toEqual({});
    const draft = [...store.docs.values()].find((d) => d.status === 'draft' && d.name === 'B2');
    expect(draft.ruleHardness).toEqual({});
  });
});
