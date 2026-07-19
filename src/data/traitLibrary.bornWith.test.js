// src/data/traitLibrary.bornWith.test.js
//
// Item-4 guard for the archetype→born-with-traits invariant. Every archetype's
// born-with set (ARCHETYPE_DEFAULT_TRAITS) is what the atomic archetype-change
// seed loads (api/agent/change-archetype.js → api/_utils/archetypeSeeding.js and
// the client src/services/seedDefaultTraits.js). Auto-loading a broken set would
// produce exactly the archetype/traits mismatch the invariant exists to prevent,
// so this pins:
//   * all SIX archetypes are covered — incl. Capital Preserver (guardian) — no
//     extras, no gaps;
//   * every trait ID resolves against the library (no dead ID);
//   * every set is within the DNA cap (≤2 per group, ≤6 total);
//   * every born-with trait resolves to at least one KB-template rule (no trait
//     that seeds zero rules);
//   * buildSeedPlan seeds the FULL set — NO runtime clamping (a silent
//     truncation is worse than an overflow — founder ruling).

import { describe, it, expect } from 'vitest';
import { ARCHETYPE_DEFAULT_TRAITS, TRAIT_BY_ID } from './traitLibrary';
import { DNA_GROUPS, TOTAL_TRAIT_SLOTS } from './dnaGroups';
import { buildSeedPlan, expandTraitToRuleSpecs } from './traitEquip';

// The six archetype CODE-IDS and their display names — every archetype the
// six-card picker offers. Capital Preserver (guardian) is explicitly included.
const ARCHETYPES = [
  ['momentum_chaser', 'Trend Follower'],
  ['contrarian', 'Contrarian'],
  ['diversifier', 'Diversifier'],
  ['degen', 'Speculator'],
  ['analyst', 'Fundamental Investor'],
  ['guardian', 'Capital Preserver'],
];

const PER_GROUP_CAP = 2; // DNA model: 2 traits per group

describe('archetype born-with trait sets (ARCHETYPE_DEFAULT_TRAITS)', () => {
  it('covers exactly the six archetypes — incl. Capital Preserver (guardian) — no extras, no gaps', () => {
    const keys = Object.keys(ARCHETYPE_DEFAULT_TRAITS).sort();
    expect(keys).toEqual(ARCHETYPES.map(([id]) => id).sort());
    // Capital Preserver called out explicitly (the archetype the task's 5-name
    // list omits — it must not be forgotten).
    expect(ARCHETYPE_DEFAULT_TRAITS.guardian, 'Capital Preserver (guardian) missing').toBeTruthy();
  });

  it('the DNA cap is 2 per group / 6 total (guards against a silent cap change)', () => {
    for (const g of Object.values(DNA_GROUPS)) expect(g.maxTraits).toBe(PER_GROUP_CAP);
    expect(TOTAL_TRAIT_SLOTS).toBe(6);
  });

  for (const [codeId, displayName] of ARCHETYPES) {
    describe(`${codeId} — ${displayName}`, () => {
      const traitIds = ARCHETYPE_DEFAULT_TRAITS[codeId];

      it('has a non-empty born-with set', () => {
        expect(Array.isArray(traitIds)).toBe(true);
        expect(traitIds.length).toBeGreaterThan(0);
      });

      it('every trait ID resolves against the library (no dead ID)', () => {
        for (const id of traitIds) {
          expect(TRAIT_BY_ID[id], `${id} not found in traitLibrary`).toBeTruthy();
        }
      });

      it('is within the DNA cap: ≤2 per group and ≤6 total', () => {
        expect(traitIds.length).toBeLessThanOrEqual(TOTAL_TRAIT_SLOTS);
        const perGroup = {};
        for (const id of traitIds) {
          const group = TRAIT_BY_ID[id].dnaGroup;
          expect(DNA_GROUPS[group], `unknown dnaGroup "${group}" for ${id}`).toBeTruthy();
          perGroup[group] = (perGroup[group] || 0) + 1;
        }
        for (const [group, n] of Object.entries(perGroup)) {
          expect(n, `${codeId} exceeds ${PER_GROUP_CAP} traits in group ${group}`).toBeLessThanOrEqual(DNA_GROUPS[group].maxTraits);
        }
      });

      it('every born-with trait resolves to ≥1 KB-template rule (no dead-rule trait)', () => {
        for (const id of traitIds) {
          const specs = expandTraitToRuleSpecs(TRAIT_BY_ID[id], 'moderate');
          expect(specs.length, `${id} seeds zero rules`).toBeGreaterThan(0);
        }
      });

      it('buildSeedPlan seeds the FULL set with NO runtime clamping', () => {
        const { ruleSpecs, equippedTraits } = buildSeedPlan(traitIds, 'moderate');
        // No trait dropped — the seeder never clamps (overflow > silent truncation).
        expect(equippedTraits.map((t) => t.traitId)).toEqual(traitIds);
        expect(ruleSpecs.length).toBeGreaterThanOrEqual(traitIds.length);
        // Every seeded rule carries the tier-2 provenance the reconciler reads.
        expect(ruleSpecs.every((s) => s.provenance === 'archetype_default')).toBe(true);
      });
    });
  }
});
