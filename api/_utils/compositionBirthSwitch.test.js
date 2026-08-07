// api/_utils/compositionBirthSwitch.test.js
//
// Composition PR 4 — A24, BOTH SIDES through the WIRED birth-path switch
// (completing the structural + candidate arms in
// traitLibraryCandidate.composition.test.js):
//
//   NO record (identityVersion null) → the seed writes the OLD defaults —
//     byte-identical births (guardian still seeds risk-single-stock-limit);
//   the record selecting the CANDIDATE → the seed writes the SUBSTITUTED
//     defaults (alloc-sector-cap; the deprecated rule never seeds again);
//   an UNRESOLVABLE version → FAIL CLOSED (an activated world must never
//     silently seed the wrong identity);
//   the CLIENT resolver mirrors the same three-way contract.
//
// The wiring itself (change-archetype passes the pinned record's version;
// trainingClone passes it per provisioning run; seedDefaultTraits reads the
// record) is pinned by the derived-write census tokens
// (compositionDerivedWrites.census.test.js).

import { describe, it, expect } from 'vitest';
import { seedArchetypeTraitsDeterministic, hasBornWithSet } from './archetypeSeeding.js';
import { CANDIDATE_IDENTITY_VERSION } from './archetypeRegistry.js';
import { resolveClientSeedSource } from '../../src/services/compositionIdentityClient.js';
import {
  CANDIDATE_ARCHETYPE_DEFAULT_TRAITS, getCandidateTraitById,
} from '../../src/data/traitLibraryCandidate.js';
import { ARCHETYPE_DEFAULT_TRAITS, TRAIT_BY_ID } from '../../src/data/traitLibrary.js';

function makeAgentRefFake() {
  const docs = {};
  return {
    docs,
    collection: (name) => ({
      doc: (id) => {
        // §2 pass-2 L2-5: admin-SDK parity — .doc(undefined) throws in
        // production; a forgiving auto-id here would hide a candidate-path
        // doc-id defect (and break the deterministic-id idempotency contract).
        if (typeof id !== 'string' || id.length === 0) {
          throw new Error(`doc() requires a non-empty string id, got ${String(id)} (admin SDK parity)`);
        }
        return {
          id,
          set: async (data) => { docs[`${name}/${id}`] = data; },
        };
      },
    }),
  };
}

const seededSourceRefs = (docs) => Object.values(docs).map((d) => d.sourceRef).sort();

// The COMPLETE expected seed for an archetype at a version, derived from the
// trait library the seeder claims to seed (§2 pass-2 L2-4): every ruleId of
// every default trait, as deterministic born-with doc keys. A silently
// dropped rule (e.g. a candidate ruleId with no forge template riding the
// "unknown template — skip" path) breaks the equality — the exact defect the
// header names ("never silently seed the wrong identity").
function expectedSeed(archetype, { candidate = false } = {}) {
  const traitIds = candidate ? CANDIDATE_ARCHETYPE_DEFAULT_TRAITS[archetype] : ARCHETYPE_DEFAULT_TRAITS[archetype];
  const traitOf = candidate ? getCandidateTraitById : (id) => TRAIT_BY_ID[id];
  const docKeys = [];
  const sourceRefs = [];
  for (const traitId of traitIds) {
    for (const ruleId of traitOf(traitId).ruleIds) {
      docKeys.push(`rules/bornwith__${traitId}__${ruleId}`);
      sourceRefs.push(ruleId);
    }
  }
  return { docKeys: docKeys.sort(), sourceRefs: sourceRefs.sort() };
}

describe('A24 — both sides through the WIRED server birth path', () => {
  it('identityVersion null (no record): guardian seeds the COMPLETE OLD default set — risk-single-stock-limit still present, byte-identical births', async () => {
    const ref = makeAgentRefFake();
    const out = await seedArchetypeTraitsDeterministic(ref, 'guardian');
    expect(out.equippedTraits.map((t) => t.traitId)).toContain('trait-steady-anchor');
    const expected = expectedSeed('guardian');
    expect(seededSourceRefs(ref.docs)).toEqual(expected.sourceRefs);
    expect(Object.keys(ref.docs).sort()).toEqual(expected.docKeys); // deterministic ids, complete
    expect(out.rulesAdded).toBe(expected.sourceRefs.length);
    expect(expected.sourceRefs).toContain('risk-single-stock-limit');
    expect(expected.sourceRefs).not.toContain('alloc-sector-cap');
  });

  it('the record selecting the CANDIDATE: guardian seeds the COMPLETE SUBSTITUTED set — alloc-sector-cap in, the deprecated rule never again, nothing silently dropped', async () => {
    const ref = makeAgentRefFake();
    const out = await seedArchetypeTraitsDeterministic(ref, 'guardian', { identityVersion: CANDIDATE_IDENTITY_VERSION });
    expect(out.equippedTraits.map((t) => t.traitId)).toContain('trait-steady-anchor');
    const expected = expectedSeed('guardian', { candidate: true });
    expect(seededSourceRefs(ref.docs)).toEqual(expected.sourceRefs); // FULL equality (L2-4)
    expect(Object.keys(ref.docs).sort()).toEqual(expected.docKeys);
    expect(out.rulesAdded).toBe(expected.sourceRefs.length);
    expect(expected.sourceRefs).toContain('alloc-sector-cap');
    expect(expected.sourceRefs).not.toContain('risk-single-stock-limit');
    // the candidate ladder value seeds verbatim (moderate: pct 35)
    const cap = Object.values(ref.docs).find((d) => d.sourceRef === 'alloc-sector-cap');
    expect(cap.paramValues.pct).toBe(35);
  });

  it('diversifier at the candidate version seeds the RESHAPED traits COMPLETELY (crowding-sentinel + balanced-optionality — every rule of every trait, deterministic ids)', async () => {
    const ref = makeAgentRefFake();
    const out = await seedArchetypeTraitsDeterministic(ref, 'diversifier', { identityVersion: CANDIDATE_IDENTITY_VERSION });
    expect(out.equippedTraits.map((t) => t.traitId).sort()).toEqual(
      ['trait-balanced-optionality', 'trait-crowding-sentinel', 'trait-sector-rotator'],
    );
    const expected = expectedSeed('diversifier', { candidate: true });
    expect(seededSourceRefs(ref.docs)).toEqual(expected.sourceRefs); // a half-seeded trait fails HERE (L2-4)
    expect(Object.keys(ref.docs).sort()).toEqual(expected.docKeys);
    expect(out.rulesAdded).toBe(expected.sourceRefs.length);
    for (const gone of ['tv-04', 'mb-05', 'gs-05', 'gs-06']) expect(expected.sourceRefs).not.toContain(gone);
    expect(expected.sourceRefs).toContain('i-05');
    expect(expected.sourceRefs).toContain('r-07'); // BOTH crowding-sentinel rules — the L2-4 mutation target
  });

  it('an UNRESOLVABLE version FAILS CLOSED — never a silent wrong-identity seed', async () => {
    const ref = makeAgentRefFake();
    await expect(seedArchetypeTraitsDeterministic(ref, 'guardian', { identityVersion: 9 }))
      .rejects.toThrow(/unresolvable identityVersion 9/);
    expect(Object.keys(ref.docs)).toEqual([]);
    expect(() => hasBornWithSet('guardian', { identityVersion: 9 })).toThrow(/fail closed/);
  });
});

describe('A24 — the CLIENT resolver mirrors the contract', () => {
  it('null / live → live lists; the candidate version → candidate lists + candidate trait view; unknown → live (fail-safe)', () => {
    const live = resolveClientSeedSource('guardian', null);
    expect(live.traitOf('trait-steady-anchor').ruleIds).toContain('risk-single-stock-limit');
    const cand = resolveClientSeedSource('guardian', CANDIDATE_IDENTITY_VERSION);
    expect(cand.traitOf('trait-steady-anchor').ruleIds).toContain('alloc-sector-cap');
    expect(resolveClientSeedSource('diversifier', CANDIDATE_IDENTITY_VERSION).traitIds).toContain('trait-crowding-sentinel');
    // the client's narrow fallback: an unknown version resolves LIVE — the
    // record-driven server boundaries carry the fail-closed semantics.
    expect(resolveClientSeedSource('guardian', 9).traitOf('trait-steady-anchor').ruleIds).toContain('risk-single-stock-limit');
  });
});
