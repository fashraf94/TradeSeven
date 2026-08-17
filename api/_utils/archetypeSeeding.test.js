// api/_utils/archetypeSeeding.test.js
//
// Direct unit + DEPENDENCY-SURFACE test for the server-side born-with seeder.
// This file's REAL import of archetypeSeeding.js — whose graph pulls
// src/data/traitLibrary + src/data/traitEquip + src/data/ruleDocFields — IS the
// BUILD_RULES §4 runtime guard that this api -> src edge stays Node-clean: the
// import below explodes in this Node test env if a browser-only dep ever enters
// the graph. Never mock that import. (The change-archetype.js and trainingClone.js
// tests guard the same edge transitively; this is the direct guard.)

import { describe, it, expect } from 'vitest';
import {
  hasBornWithSet,
  seedArchetypeTraitsInTx,
  seedArchetypeTraitsDeterministic,
  softDeleteReplacedTraitRuleDocs,
} from './archetypeSeeding.js';
import { ARCHETYPE_DEFAULT_TRAITS } from '../../src/data/traitLibrary.js';
import { makeCompositionStoreDouble } from './__fixtures__/compositionStoreDouble.js';

// Minimal admin-SDK-shaped fake: one agent's rules subcollection as a Map that
// both the in-tx writes and the post-tx reads share (via closure).
function makeAgent() {
  const rules = new Map(); // docId -> data
  let autoSeq = 0;
  const rulesRef = {
    doc: (id) => {
      const docId = id ?? `auto-${++autoSeq}`;
      return {
        id: docId,
        set: (data) => { rules.set(docId, { id: docId, ...data }); },
        update: (updates) => { rules.set(docId, { ...rules.get(docId), ...updates }); },
      };
    },
    get: async () => ({ docs: [...rules.values()].map((d) => ({ id: d.id, data: () => d })) }),
  };
  // softDeleteReplacedTraitRuleDocs runs assertWriteEpochOpen(agentRef.firestore)
  // — live from ACTIVATION_RUNBOOK step 1.1, a no-op read while the fence was
  // dark. A real DocumentReference carries `.firestore`; model it, pointing at
  // the PRE-GENESIS store (epoch doc absent ⇒ open).
  const composition = makeCompositionStoreDouble();
  const firestore = {
    collection: (name) => {
      const c = composition.collection(name);
      if (c) return c;
      throw new Error(`Unmocked collection: ${name}`);
    },
  };
  const agentRef = {
    firestore,
    collection: (sub) => (sub === 'rules' ? rulesRef : { doc: () => ({ set() {}, update() {} }), get: async () => ({ docs: [] }) }),
  };
  const tx = { set: (ref, data) => ref.set(data), update: (ref, updates) => ref.update(updates) };
  return { agentRef, tx, rules, composition };
}

describe('archetypeSeeding — hasBornWithSet', () => {
  it('true for a real archetype, false for an unknown one', () => {
    expect(hasBornWithSet('guardian')).toBe(true);
    expect(hasBornWithSet('not_a_real_archetype')).toBe(false);
  });
});

describe('archetypeSeeding — seedArchetypeTraitsInTx (Command Center / transactional)', () => {
  it('stages the born-with rule docs on the tx and returns the born-with equippedTraits', () => {
    const { agentRef, tx, rules } = makeAgent();
    const res = seedArchetypeTraitsInTx(tx, agentRef, 'guardian');
    expect(res.equippedTraits.map((t) => t.traitId)).toEqual(ARCHETYPE_DEFAULT_TRAITS.guardian);
    expect(res.rulesAdded).toBeGreaterThan(0);
    expect(rules.size).toBe(res.rulesAdded);
    for (const d of rules.values()) {
      expect(d.traitId).toBeTruthy();
      expect(d.provenance).toBe('archetype_default'); // reconciler tier 2
      expect(d.isDeleted).toBe(false);
    }
  });

  it('returns null equippedTraits and writes nothing for an unknown archetype', () => {
    const { agentRef, tx, rules } = makeAgent();
    const res = seedArchetypeTraitsInTx(tx, agentRef, 'not_a_real_archetype');
    expect(res.equippedTraits).toBeNull();
    expect(rules.size).toBe(0);
  });
});

describe('archetypeSeeding — seedArchetypeTraitsDeterministic (clone / non-tx)', () => {
  it('creates born-with docs with deterministic ids — a re-run overwrites, no duplicates', async () => {
    const { agentRef, rules } = makeAgent();
    const res = await seedArchetypeTraitsDeterministic(agentRef, 'guardian');
    expect(res.equippedTraits.map((t) => t.traitId)).toEqual(ARCHETYPE_DEFAULT_TRAITS.guardian);
    const firstCount = rules.size;
    expect(firstCount).toBeGreaterThan(0);
    expect([...rules.keys()].every((id) => id.startsWith('bornwith__'))).toBe(true);
    await seedArchetypeTraitsDeterministic(agentRef, 'guardian');
    expect(rules.size).toBe(firstCount); // deterministic ids → in-place overwrite
  });

  it('returns null equippedTraits and writes nothing for an unknown archetype', async () => {
    const { agentRef, rules } = makeAgent();
    const res = await seedArchetypeTraitsDeterministic(agentRef, 'not_a_real_archetype');
    expect(res.equippedTraits).toBeNull();
    expect(rules.size).toBe(0);
  });
});

describe('archetypeSeeding — softDeleteReplacedTraitRuleDocs', () => {
  it('soft-deletes trait docs whose traitId left equippedTraits; keeps kept-trait + manual docs', async () => {
    const { agentRef, rules } = makeAgent();
    rules.set('old', { id: 'old', traitId: 'trait-trend-rider', isDeleted: false });
    rules.set('keep', { id: 'keep', traitId: 'trait-iron-discipline', isDeleted: false });
    rules.set('manual', { id: 'manual', traitId: null, isDeleted: false });

    const removed = await softDeleteReplacedTraitRuleDocs(agentRef, [{ traitId: 'trait-iron-discipline' }]);

    expect(removed).toBe(1);
    expect(rules.get('old').isDeleted).toBe(true);     // traitId not in equipped → removed
    expect(rules.get('keep').isDeleted).toBe(false);   // traitId in equipped → kept
    expect(rules.get('manual').isDeleted).toBe(false); // no traitId → untouched
  });
});
