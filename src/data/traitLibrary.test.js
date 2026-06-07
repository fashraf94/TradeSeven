// src/data/traitLibrary.test.js
//
// Phase 1A regression safety net (characterization). These lock the STRUCTURAL
// invariants the V2.2 re-family must NOT break — the data that the (untouched)
// equip/seeding/slot mechanisms read:
//   - traitId set (combos, defaults, equip, orphan-cleanup all key on traitId)
//   - dnaGroup per trait (the real slot grouping — families are presentation only
//     and must NOT change these)
//   - ruleIds per trait (equip → rule docs → projection inputs; the honest-copy
//     rewrite must not touch rules)
//   - strengthProfiles completeness (setTraitStrength reads profile[ruleId])
//   - ARCHETYPE_DEFAULT_TRAITS: exactly 3 per archetype, ≤2 per dnaGroup (the
//     seeding + 2-per-group cap invariants — acceptance tests 4 & 5)
//
// Plain vitest, no rendering / no firebase — matches traitEquip.test.js +
// traitSlotSummary.test.js conventions. Snapshots are explicit literals so a
// silent rename/regroup/drop fails loudly.
//
// NOTE (scope): canEquip / setTraitStrength / unequip orphan-cleanup live inside
// the useTraits React hook. The repo has no jsdom test env or React Testing
// Library, so those runtime closures are not unit-testable here without new test
// infra. Phase 1A does not modify useTraits.js, so their behavior is protected by
// (a) the hook code being untouched and (b) the data invariants locked below
// (dnaGroup, maxTraits, traitId, strengthProfiles). The enrichment "drops unknown
// id" path is already covered by traitSlotSummary.test.js.

import { describe, it, expect } from 'vitest';
import {
  TRAIT_LIBRARY,
  TRAIT_BY_ID,
  ARCHETYPE_DEFAULT_TRAITS,
  getTraitsForGroup,
  getAllTraitRuleIds,
  UNAMBIGUOUS_RULE_TO_TRAIT,
} from './traitLibrary';
import { DNA_GROUPS } from './dnaGroups';

// ── Frozen current shape (HEAD 12c322f) ──────────────────────────────
// traitId → dnaGroup. Locks the slot grouping the re-family must preserve.
const TRAIT_GROUPS = {
  'trait-trend-rider': 'instincts',
  'trait-bargain-hunter': 'instincts',
  'trait-squeeze-whisperer': 'instincts',
  'trait-volume-believer': 'instincts',
  'trait-breakout-chaser': 'instincts',
  'trait-smart-money-tracker': 'instincts',
  'trait-threshold-harvester': 'strategy',
  'trait-dual-conviction': 'strategy',
  'trait-score-adaptor': 'strategy',
  'trait-sector-rotator': 'strategy',
  'trait-penalty-dodger': 'strategy',
  'trait-iron-discipline': 'discipline',
  'trait-patient-holder': 'discipline',
  'trait-active-trader': 'discipline',
  'trait-diversifier': 'discipline',
  'trait-let-winners-run': 'discipline',
};

// traitId → ruleIds. Locks the equip/projection inputs (copy rewrite must not
// touch these).
const TRAIT_RULE_IDS = {
  'trait-trend-rider': ['tech-moving-average-trend', 't-09', 'tv-01'],
  'trait-bargain-hunter': ['tech-rsi-oversold', 'tv-06', 'tv-07'],
  'trait-squeeze-whisperer': ['t-12', 'tv-05', 't-15'],
  'trait-volume-believer': ['t-14', 'tv-13', 'tv-08'],
  'trait-breakout-chaser': ['tv-11', 't-11', 'tv-02'],
  'trait-smart-money-tracker': ['tv-04', 'mb-05'],
  'trait-threshold-harvester': ['th-01', 'tv-15', 'th-10'],
  'trait-dual-conviction': ['tv-10', 'tv-12'],
  'trait-score-adaptor': ['gs-05', 'gs-06'],
  'trait-sector-rotator': ['tv-14', 'a-08'],
  'trait-penalty-dodger': ['ts-07', 'ts-01'],
  'trait-iron-discipline': ['mb-09', 'mb-04', 'mb-07'],
  'trait-patient-holder': ['mb-01', 'mb-08', 'tv-03'],
  'trait-active-trader': ['mb-03', 'ts-04'],
  'trait-diversifier': ['a-05', 'a-09'],
  'trait-let-winners-run': ['mb-08', 'th-01'],
};

const ALL_TRAIT_IDS = Object.keys(TRAIT_GROUPS);
const STRENGTHS = ['subtle', 'moderate', 'dominant'];

describe('traitId stability (acceptance #1)', () => {
  it('the library is exactly these 16 traitIds', () => {
    expect(TRAIT_LIBRARY.map((t) => t.id).sort()).toEqual([...ALL_TRAIT_IDS].sort());
  });

  it('TRAIT_BY_ID resolves every library trait by its id', () => {
    for (const t of TRAIT_LIBRARY) {
      expect(TRAIT_BY_ID[t.id]).toBe(t);
    }
    expect(Object.keys(TRAIT_BY_ID).length).toBe(16);
  });
});

describe('dnaGroup per trait is stable (slot grouping — families must not change it)', () => {
  it('each trait keeps its frozen dnaGroup', () => {
    const actual = Object.fromEntries(TRAIT_LIBRARY.map((t) => [t.id, t.dnaGroup]));
    expect(actual).toEqual(TRAIT_GROUPS);
  });

  it('getTraitsForGroup returns 6 instincts / 5 strategy / 5 discipline', () => {
    expect(getTraitsForGroup('instincts').map((t) => t.id).sort())
      .toEqual(ALL_TRAIT_IDS.filter((id) => TRAIT_GROUPS[id] === 'instincts').sort());
    expect(getTraitsForGroup('strategy')).toHaveLength(5);
    expect(getTraitsForGroup('discipline')).toHaveLength(5);
  });
});

describe('ruleIds per trait are stable (equip/projection inputs)', () => {
  it('each trait keeps its frozen ruleIds in order', () => {
    const actual = Object.fromEntries(TRAIT_LIBRARY.map((t) => [t.id, t.ruleIds]));
    expect(actual).toEqual(TRAIT_RULE_IDS);
  });

  it('getAllTraitRuleIds is the de-duped union of every trait ruleId', () => {
    const expected = [...new Set(Object.values(TRAIT_RULE_IDS).flat())];
    expect(getAllTraitRuleIds().sort()).toEqual(expected.sort());
  });
});

describe('strengthProfiles completeness (setTraitStrength reads profile[ruleId])', () => {
  it('every trait has subtle/moderate/dominant profiles', () => {
    for (const t of TRAIT_LIBRARY) {
      for (const s of STRENGTHS) {
        expect(t.strengthProfiles?.[s], `${t.id}.${s}`).toBeTruthy();
      }
    }
  });

  it('each strength profile keys exactly the trait ruleIds', () => {
    for (const t of TRAIT_LIBRARY) {
      for (const s of STRENGTHS) {
        expect(Object.keys(t.strengthProfiles[s]).sort(), `${t.id}.${s}`)
          .toEqual([...t.ruleIds].sort());
      }
    }
  });
});

describe('ARCHETYPE_DEFAULT_TRAITS — seeding & 2-per-group cap (acceptance #4 & #5)', () => {
  const archetypes = Object.keys(ARCHETYPE_DEFAULT_TRAITS);

  it('covers the 6 archetypes', () => {
    expect(archetypes.sort()).toEqual(
      ['analyst', 'contrarian', 'degen', 'diversifier', 'guardian', 'momentum_chaser'].sort()
    );
  });

  it('every archetype seeds exactly 3 known traits', () => {
    for (const code of archetypes) {
      const ids = ARCHETYPE_DEFAULT_TRAITS[code];
      expect(ids, code).toHaveLength(3);
      for (const id of ids) expect(TRAIT_BY_ID[id], `${code} → ${id}`).toBeTruthy();
    }
  });

  it('no default set exceeds 2 traits in any dnaGroup (the cap holds at seed time)', () => {
    for (const code of archetypes) {
      const perGroup = {};
      for (const id of ARCHETYPE_DEFAULT_TRAITS[code]) {
        const g = TRAIT_BY_ID[id].dnaGroup;
        perGroup[g] = (perGroup[g] || 0) + 1;
      }
      for (const [g, n] of Object.entries(perGroup)) {
        expect(n, `${code} group ${g}`).toBeLessThanOrEqual(DNA_GROUPS[g].maxTraits);
      }
    }
  });
});

describe('UNAMBIGUOUS_RULE_TO_TRAIT (read-side attribution map — Phase 1B)', () => {
  it('OMITS the shared ruleIds th-01 and mb-08 (never attribute an ambiguous rule)', () => {
    expect(UNAMBIGUOUS_RULE_TO_TRAIT['th-01']).toBeUndefined();
    expect(UNAMBIGUOUS_RULE_TO_TRAIT['mb-08']).toBeUndefined();
  });

  it('maps a uniquely-owned ruleId to its sole owning trait', () => {
    expect(UNAMBIGUOUS_RULE_TO_TRAIT['mb-09']).toBe('trait-iron-discipline');
    expect(UNAMBIGUOUS_RULE_TO_TRAIT['ts-07']).toBe('trait-penalty-dodger');
    expect(UNAMBIGUOUS_RULE_TO_TRAIT['a-05']).toBe('trait-diversifier');
  });

  it('every entry points to a trait that actually owns that ruleId, and only one trait does', () => {
    const ownerCount = {};
    for (const t of TRAIT_LIBRARY) for (const rid of t.ruleIds) ownerCount[rid] = (ownerCount[rid] || 0) + 1;
    for (const [ruleId, traitId] of Object.entries(UNAMBIGUOUS_RULE_TO_TRAIT)) {
      expect(ownerCount[ruleId], ruleId).toBe(1);
      expect(TRAIT_BY_ID[traitId].ruleIds, `${traitId} owns ${ruleId}`).toContain(ruleId);
    }
  });
});

describe('DNA group cap shape (the rule canEquip enforces at runtime)', () => {
  it('every DNA group caps at 2 traits', () => {
    for (const g of Object.values(DNA_GROUPS)) {
      expect(g.maxTraits).toBe(2);
    }
  });

  it('every group has at least 2 traits so a full group is reachable', () => {
    for (const groupId of Object.keys(DNA_GROUPS)) {
      expect(getTraitsForGroup(groupId).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('total trait-library size matches the sum of group memberships', () => {
    const summed = Object.keys(DNA_GROUPS).reduce((n, g) => n + getTraitsForGroup(g).length, 0);
    expect(summed).toBe(TRAIT_LIBRARY.length);
  });
});
