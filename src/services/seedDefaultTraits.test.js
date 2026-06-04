// src/services/seedDefaultTraits.test.js
//
// Coverage for the archetype trait seeders. seedDefaultTraits (creation path) is
// locked to its existing behavior; reseedDefaultTraits (clean replace) is
// verified for the two properties most likely to regress and that can't be
// eyeballed: the NEW-LAYER-FIRST write order (new rules → equippedTraits →
// soft-delete old) and capture-of-old-rule-docs BY ID (so a shared trait's
// freshly-created rules are never deleted).
//
// firebase/firestore + ./forgeService are mocked; traitLibrary + traitEquip are
// the real (pure) modules, so buildSeedPlan produces real rule specs.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ARCHETYPE_DEFAULT_TRAITS } from '../data/traitLibrary';

// ==================== HOISTED MOCK STATE ====================

const { state } = vi.hoisted(() => ({
  state: {
    calls: [],        // ordered log of every mocked Firestore/forge write
    ruleSeq: 0,       // monotonic id source for createRule → "new-N"
    agentData: { equippedTraits: [] },
    existingRules: [], // what getRules() returns
    draftBundles: [],  // what the bundles "status==draft" query returns
  },
}));

// ==================== MOCKS ====================

vi.mock('../firebase/config', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: (...args) => ({ __ref: 'doc', args }),
  collection: (...args) => ({ __ref: 'collection', args }),
  query: (ref, ...constraints) => ({ __ref: 'query', ref, constraints }),
  where: (f, op, v) => ({ __ref: 'where', f, op, v }),
  getDoc: async () => ({ exists: () => true, data: () => state.agentData }),
  getDocs: async () => ({ docs: state.draftBundles.map((b) => ({ id: b.id })) }),
  updateDoc: async (ref, updates) => { state.calls.push({ fn: 'updateDoc', updates }); },
  serverTimestamp: () => '__ts__',
}));

vi.mock('./forgeService', () => ({
  createBundle: async () => { state.calls.push({ fn: 'createBundle' }); return 'new-bundle'; },
  createRule: async (agentId, spec) => {
    const id = `new-${state.ruleSeq++}`;
    state.calls.push({ fn: 'createRule', id, sourceRef: spec.sourceRef, traitId: spec.traitId });
    return id;
  },
  addRuleToBundle: async (agentId, bundleId, ruleId) => { state.calls.push({ fn: 'addRuleToBundle', bundleId, ruleId }); },
  getRules: async () => state.existingRules,
  removeRuleFromBundle: async (agentId, bundleId, ruleId) => { state.calls.push({ fn: 'removeRuleFromBundle', bundleId, ruleId }); },
  softDeleteRule: async (agentId, ruleId) => { state.calls.push({ fn: 'softDeleteRule', ruleId }); },
}));

const { seedDefaultTraits, reseedDefaultTraits } = await import('./seedDefaultTraits.js');

// ==================== HELPERS ====================

const equippedFor = (codeId) =>
  ARCHETYPE_DEFAULT_TRAITS[codeId].map((traitId) => ({ traitId, strength: 'moderate', isCustom: false, equippedAt: 1 }));

const callsOf = (fn) => state.calls.filter((c) => c.fn === fn);
const softDeletedIds = () => callsOf('softDeleteRule').map((c) => c.ruleId);

beforeEach(() => {
  state.calls = [];
  state.ruleSeq = 0;
  state.agentData = { equippedTraits: [] };
  state.existingRules = [];
  state.draftBundles = [];
});

// ============================================================
// seedDefaultTraits — creation path (must stay unchanged)
// ============================================================

describe('seedDefaultTraits (creation path)', () => {
  it('creates a fresh bundle + rules + equippedTraits, and never deletes anything', async () => {
    const res = await seedDefaultTraits('agent-1', 'analyst');

    expect(res.seeded).toBe(true);
    // Unconditional createBundle (the documented creation behavior).
    expect(callsOf('createBundle')).toHaveLength(1);
    expect(callsOf('createRule').length).toBeGreaterThan(0);
    expect(callsOf('addRuleToBundle').length).toBe(callsOf('createRule').length);
    // equippedTraits written.
    const upd = callsOf('updateDoc').find((c) => c.updates && c.updates.equippedTraits);
    expect(upd).toBeDefined();
    // Creation never cleans up.
    expect(callsOf('softDeleteRule')).toHaveLength(0);
    expect(callsOf('removeRuleFromBundle')).toHaveLength(0);
  });
});

// ============================================================
// reseedDefaultTraits — clean replace
// ============================================================

describe('reseedDefaultTraits (clean replace)', () => {
  it('write order is NEW-LAYER-FIRST: new rules → equippedTraits → soft-delete old', async () => {
    state.agentData = { equippedTraits: equippedFor('analyst') };
    state.existingRules = [
      { id: 'old-dc', traitId: 'trait-dual-conviction', sourceRef: 'tv-10' },
      { id: 'old-iron', traitId: 'trait-iron-discipline', sourceRef: 'mb-09' },
    ];
    state.draftBundles = [{ id: 'draft-1' }];

    const res = await reseedDefaultTraits('agent-1', 'guardian');
    expect(res.seeded).toBe(true);
    expect(res.replaced).toBe(true);

    const lastAddRule = state.calls.map((c, i) => (c.fn === 'addRuleToBundle' ? i : -1)).filter((i) => i >= 0).pop();
    const equippedWrite = state.calls.findIndex((c) => c.fn === 'updateDoc' && c.updates?.equippedTraits);
    const firstSoftDelete = state.calls.findIndex((c) => c.fn === 'softDeleteRule');

    expect(lastAddRule).toBeGreaterThanOrEqual(0);
    expect(equippedWrite).toBeGreaterThan(lastAddRule);  // new rules created before the trait layer flips
    expect(firstSoftDelete).toBeGreaterThan(equippedWrite); // old cleanup happens LAST
  });

  it('captures OLD rule docs by id — a shared trait\'s new rules survive, old ones are deleted', async () => {
    // analyst → guardian share trait-iron-discipline.
    state.agentData = { equippedTraits: equippedFor('analyst') };
    state.existingRules = [
      { id: 'old-dc', traitId: 'trait-dual-conviction', sourceRef: 'tv-10' },
      { id: 'old-iron-a', traitId: 'trait-iron-discipline', sourceRef: 'mb-09' },
      { id: 'old-iron-b', traitId: 'trait-iron-discipline', sourceRef: 'mb-04' },
      { id: 'manual-rule', sourceRef: 'x-99' }, // no traitId — a manual rule, must be untouched
    ];
    state.draftBundles = [{ id: 'draft-1' }];

    await reseedDefaultTraits('agent-1', 'guardian');

    const deleted = softDeletedIds();
    // Old shared-trait (iron-discipline) docs are deleted...
    expect(deleted).toContain('old-iron-a');
    expect(deleted).toContain('old-iron-b');
    // ...as is the old non-shared trait doc.
    expect(deleted).toContain('old-dc');
    // The freshly-created rules (incl. the new iron-discipline ones) are NOT deleted.
    expect(deleted.some((id) => id.startsWith('new-'))).toBe(false);
    // A non-trait manual rule is never touched.
    expect(deleted).not.toContain('manual-rule');
  });

  it('reuses the existing draft bundle (no duplicate createBundle)', async () => {
    state.agentData = { equippedTraits: equippedFor('analyst') };
    state.draftBundles = [{ id: 'draft-1' }];

    await reseedDefaultTraits('agent-1', 'guardian');

    expect(callsOf('createBundle')).toHaveLength(0);
    expect(callsOf('addRuleToBundle').every((c) => c.bundleId === 'draft-1')).toBe(true);
  });

  it('creates a draft bundle when none exists', async () => {
    state.agentData = { equippedTraits: [] };
    state.draftBundles = [];

    await reseedDefaultTraits('agent-1', 'guardian');

    expect(callsOf('createBundle')).toHaveLength(1);
    expect(callsOf('addRuleToBundle').every((c) => c.bundleId === 'new-bundle')).toBe(true);
    // Nothing to clean up when there were no old equipped traits.
    expect(callsOf('softDeleteRule')).toHaveLength(0);
  });

  it('unknown archetype → no-op, no writes', async () => {
    const res = await reseedDefaultTraits('agent-1', 'not_a_real_archetype');
    expect(res.seeded).toBe(false);
    expect(res.reason).toBe('no_defaults');
    expect(state.calls).toHaveLength(0);
  });
});
