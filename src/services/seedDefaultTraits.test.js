// src/services/seedDefaultTraits.test.js
//
// Coverage for the archetype trait seeder. seedDefaultTraits (the agent-CREATION
// path) is locked to its existing behavior: it writes equippedTraits + one trait
// rule doc per ruleId (each carrying traitId), bundle-independent (trait rules are
// projected at deploy by traitId ∈ equippedTraits, never added to a bundle).
// (The archetype-CHANGE clean replace now lives server-side in
// api/_utils/archetypeSeeding.js — see change-archetype.js — so the old client
// reseedDefaultTraits was removed.)
//
// firebase/firestore + ./forgeService are mocked; traitLibrary + traitEquip are
// the real (pure) modules.

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

// R1(a): the equippedTraits write goes through the rev-bumping settings
// endpoint's thin client — captured in the SAME ordered log so the
// write-order assertions keep proving create → trait-layer flip → delete.
vi.mock('./agentService', () => ({
  updateAgentSettings: async (agentId, set) => {
    state.calls.push({ fn: 'updateAgentSettings', set });
  },
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

const { seedDefaultTraits } = await import('./seedDefaultTraits.js');

// ==================== HELPERS ====================

const callsOf = (fn) => state.calls.filter((c) => c.fn === fn);

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
    expect(callsOf('updateAgentSettings').find((c) => c.set?.equippedTraits)).toBeDefined();
    // Creation never deletes/unlinks anything.
    expect(callsOf('softDeleteRule')).toHaveLength(0);
    expect(callsOf('removeRuleFromBundle')).toHaveLength(0);
    // Every created rule carries the traitId (the deploy-projection key).
    expect(callsOf('createRule').every((c) => Boolean(c.traitId))).toBe(true);
  });
});
