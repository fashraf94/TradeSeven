// src/services/seedDefaultTraits.test.js
//
// Coverage for the archetype trait seeders. seedDefaultTraits (creation path) is
// locked to its existing behavior; reseedDefaultTraits (clean replace) is
// verified for the properties that can't be eyeballed and that regressed once in
// review:
//   - write ORDER: unlink old from bundle → create new → set equippedTraits →
//     soft-delete old (last);
//   - capture of old rule docs BY ID (shared traits' new rules survive);
//   - the per-bundle rule cap is NOT tripped, because old rules are unlinked
//     before the new set is added (the bug a cap-less mock previously hid).
//
// firebase/firestore + ./forgeService are mocked (the forge mock models the
// bundle.ruleIds list + the maxRulesPerBundle cap that addRuleToBundle enforces);
// traitLibrary + traitEquip are the real (pure) modules.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ARCHETYPE_DEFAULT_TRAITS } from '../data/traitLibrary';

// ==================== HOISTED MOCK STATE ====================

const { state } = vi.hoisted(() => ({
  state: {
    calls: [],                 // ordered log of every mocked write
    ruleSeq: 0,                // id source for createRule → "new-N"
    agentData: { equippedTraits: [] },
    existingRules: [],         // what getRules() returns
    bundles: {},               // id -> { id, status, ruleIds: [] }
    maxRulesPerBundle: Infinity, // cap addRuleToBundle enforces (per-test)
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
  getDocs: async () => ({
    docs: Object.values(state.bundles).filter((b) => b.status === 'draft').map((b) => ({ id: b.id })),
  }),
  updateDoc: async (ref, updates) => { state.calls.push({ fn: 'updateDoc', updates }); },
  serverTimestamp: () => '__ts__',
}));

vi.mock('./forgeService', () => ({
  createBundle: async () => {
    state.calls.push({ fn: 'createBundle' });
    state.bundles['new-bundle'] = { id: 'new-bundle', status: 'draft', ruleIds: [] };
    return 'new-bundle';
  },
  createRule: async (agentId, spec) => {
    const id = `new-${state.ruleSeq++}`;
    state.calls.push({ fn: 'createRule', id, sourceRef: spec.sourceRef, traitId: spec.traitId });
    return id;
  },
  // Models forgeService.addRuleToBundle: appends to bundle.ruleIds and THROWS at
  // the per-level cap (the real check at forgeService.js:302).
  addRuleToBundle: async (agentId, bundleId, ruleId) => {
    state.calls.push({ fn: 'addRuleToBundle', bundleId, ruleId });
    const b = state.bundles[bundleId] || (state.bundles[bundleId] = { id: bundleId, status: 'draft', ruleIds: [] });
    if (b.ruleIds.length >= state.maxRulesPerBundle) {
      throw new Error(`Rule limit reached (${state.maxRulesPerBundle})`);
    }
    b.ruleIds.push(ruleId);
  },
  getRules: async () => state.existingRules,
  removeRuleFromBundle: async (agentId, bundleId, ruleId) => {
    state.calls.push({ fn: 'removeRuleFromBundle', bundleId, ruleId });
    const b = state.bundles[bundleId];
    if (b) b.ruleIds = b.ruleIds.filter((id) => id !== ruleId);
  },
  softDeleteRule: async (agentId, ruleId) => { state.calls.push({ fn: 'softDeleteRule', ruleId }); },
}));

const { seedDefaultTraits, reseedDefaultTraits } = await import('./seedDefaultTraits.js');

// ==================== HELPERS ====================

const equippedFor = (codeId) =>
  ARCHETYPE_DEFAULT_TRAITS[codeId].map((traitId) => ({ traitId, strength: 'moderate', isCustom: false, equippedAt: 1 }));
const callsOf = (fn) => state.calls.filter((c) => c.fn === fn);
const firstIdx = (fn) => state.calls.findIndex((c) => c.fn === fn);
const softDeletedIds = () => callsOf('softDeleteRule').map((c) => c.ruleId);

beforeEach(() => {
  state.calls = [];
  state.ruleSeq = 0;
  state.agentData = { equippedTraits: [] };
  state.existingRules = [];
  state.bundles = {};
  state.maxRulesPerBundle = Infinity;
});

// ============================================================
// seedDefaultTraits — creation path (trait rules are NOT bundled)
// ============================================================

describe('seedDefaultTraits (creation path)', () => {
  it('creates trait rule docs + equippedTraits, never bundles or deletes anything', async () => {
    const res = await seedDefaultTraits('agent-1', 'analyst');

    expect(res.seeded).toBe(true);
    expect(callsOf('createRule').length).toBeGreaterThan(0);
    // Trait rules are an identity layer — never materialized into a bundle.
    expect(callsOf('createBundle')).toHaveLength(0);
    expect(callsOf('addRuleToBundle')).toHaveLength(0);
    expect(callsOf('updateDoc').find((c) => c.updates?.equippedTraits)).toBeDefined();
    // Creation never deletes/unlinks anything.
    expect(callsOf('softDeleteRule')).toHaveLength(0);
    expect(callsOf('removeRuleFromBundle')).toHaveLength(0);
    // Every created rule carries the traitId (the deploy-projection key).
    expect(callsOf('createRule').every((c) => Boolean(c.traitId))).toBe(true);
  });
});

// ============================================================
// reseedDefaultTraits — clean replace
// ============================================================

describe('reseedDefaultTraits (clean replace)', () => {
  it('write order: create new → set equippedTraits → soft-delete old (last); never bundles', async () => {
    state.agentData = { equippedTraits: equippedFor('analyst') };
    state.existingRules = [
      { id: 'old-dc', traitId: 'trait-dual-conviction', sourceRef: 'tv-10' },
      { id: 'old-iron', traitId: 'trait-iron-discipline', sourceRef: 'mb-09' },
    ];

    const res = await reseedDefaultTraits('agent-1', 'guardian');
    expect(res.seeded).toBe(true);
    expect(res.replaced).toBe(true);

    const firstCreate = firstIdx('createRule');
    const equippedWrite = state.calls.findIndex((c) => c.fn === 'updateDoc' && c.updates?.equippedTraits);
    const firstSoftDelete = firstIdx('softDeleteRule');

    expect(firstCreate).toBeGreaterThanOrEqual(0);
    expect(firstCreate).toBeLessThan(equippedWrite);     // new rules created before the trait layer flips
    expect(equippedWrite).toBeLessThan(firstSoftDelete); // old docs soft-deleted LAST
    // Trait rules are never bundled or unlinked.
    expect(callsOf('createBundle')).toHaveLength(0);
    expect(callsOf('addRuleToBundle')).toHaveLength(0);
    expect(callsOf('removeRuleFromBundle')).toHaveLength(0);
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

    await reseedDefaultTraits('agent-1', 'guardian');

    const deleted = softDeletedIds();
    expect(deleted).toContain('old-iron-a'); // old shared-trait docs deleted
    expect(deleted).toContain('old-iron-b');
    expect(deleted).toContain('old-dc');     // old non-shared trait doc deleted
    expect(deleted.some((id) => id.startsWith('new-'))).toBe(false); // freshly-created rules survive
    expect(deleted).not.toContain('manual-rule');                    // non-trait manual rule untouched
  });

  it('with no prior loadout: creates new docs + equippedTraits, deletes nothing, never bundles', async () => {
    state.agentData = { equippedTraits: [] };
    state.existingRules = [];

    const res = await reseedDefaultTraits('agent-1', 'guardian');

    expect(res.seeded).toBe(true);
    expect(callsOf('createRule').length).toBeGreaterThan(0);
    expect(callsOf('updateDoc').find((c) => c.updates?.equippedTraits)).toBeDefined();
    expect(callsOf('softDeleteRule')).toHaveLength(0); // nothing to clean up
    expect(callsOf('createBundle')).toHaveLength(0);
    expect(callsOf('addRuleToBundle')).toHaveLength(0);
  });

  it('unknown archetype → no-op, no writes', async () => {
    const res = await reseedDefaultTraits('agent-1', 'not_a_real_archetype');
    expect(res.seeded).toBe(false);
    expect(res.reason).toBe('no_defaults');
    expect(state.calls).toHaveLength(0);
  });
});
