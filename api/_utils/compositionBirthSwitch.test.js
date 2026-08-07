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

function makeAgentRefFake() {
  const docs = {};
  let auto = 0;
  return {
    docs,
    collection: (name) => ({
      doc: (id) => {
        const docId = id ?? `auto-${auto += 1}`;
        return {
          id: docId,
          set: async (data) => { docs[`${name}/${docId}`] = data; },
        };
      },
    }),
  };
}

const seededSourceRefs = (docs) => Object.values(docs).map((d) => d.sourceRef).sort();

describe('A24 — both sides through the WIRED server birth path', () => {
  it('identityVersion null (no record): guardian seeds the OLD defaults — risk-single-stock-limit still present, byte-identical births', async () => {
    const ref = makeAgentRefFake();
    const out = await seedArchetypeTraitsDeterministic(ref, 'guardian');
    expect(out.equippedTraits.map((t) => t.traitId)).toContain('trait-steady-anchor');
    expect(seededSourceRefs(ref.docs)).toContain('risk-single-stock-limit');
    expect(seededSourceRefs(ref.docs)).not.toContain('alloc-sector-cap');
  });

  it('the record selecting the CANDIDATE: guardian seeds the SUBSTITUTED defaults — alloc-sector-cap in, the deprecated rule never again', async () => {
    const ref = makeAgentRefFake();
    const out = await seedArchetypeTraitsDeterministic(ref, 'guardian', { identityVersion: CANDIDATE_IDENTITY_VERSION });
    expect(out.equippedTraits.map((t) => t.traitId)).toContain('trait-steady-anchor');
    const refs = seededSourceRefs(ref.docs);
    expect(refs).toContain('alloc-sector-cap');
    expect(refs).not.toContain('risk-single-stock-limit');
    // the candidate ladder value seeds verbatim (moderate: pct 35)
    const cap = Object.values(ref.docs).find((d) => d.sourceRef === 'alloc-sector-cap');
    expect(cap.paramValues.pct).toBe(35);
  });

  it('diversifier at the candidate version seeds the RESHAPED traits (crowding-sentinel + balanced-optionality)', async () => {
    const ref = makeAgentRefFake();
    const out = await seedArchetypeTraitsDeterministic(ref, 'diversifier', { identityVersion: CANDIDATE_IDENTITY_VERSION });
    expect(out.equippedTraits.map((t) => t.traitId).sort()).toEqual(
      ['trait-balanced-optionality', 'trait-crowding-sentinel', 'trait-sector-rotator'],
    );
    const refs = seededSourceRefs(ref.docs);
    for (const gone of ['tv-04', 'mb-05', 'gs-05', 'gs-06']) expect(refs).not.toContain(gone);
    expect(refs).toContain('i-05');
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
