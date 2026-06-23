// src/data/traitEquip.test.js
//
// Anti-drift guard for the archetype default-trait seeder. The "expected" shapes
// here are NOT hand-typed literals — they are reproduced from the real hand-equip
// construction (useForge.addRuleToBundle + useTraits.equipTrait) using the same
// template/profile data, so if either the helper OR the referenced hand-equip
// code changes, this test must change in lockstep.

import { describe, it, expect } from 'vitest';
import {
  expandTraitToRuleSpecs,
  buildEquippedTraitEntry,
  buildSeedPlan,
} from './traitEquip';
import { TRAIT_BY_ID, ARCHETYPE_DEFAULT_TRAITS } from './traitLibrary';
import { FORGE_RULE_TEMPLATES } from './forgeKnowledgeBase';

const TEMPLATE_MAP = new Map(FORGE_RULE_TEMPLATES.map((t) => [t.id, t]));

// Reference reproduction of the createRule payload built in
// useForge.addRuleToBundle, with the options useTraits.equipTrait always passes:
// { status:'active', priority:1, traitId }. This is the oracle — derived from
// the real construction — EXCEPT for provenance, which intentionally differs
// between the seeder (archetype_default) and hand-equip (user_equipped); see note below.
function referenceSpec(ruleId, paramOverrides, traitId) {
  const template = TEMPLATE_MAP.get(ruleId);
  const firstTemplate = template.forgeTemplates[0];
  let text = firstTemplate.text;
  if (firstTemplate.params) {
    for (const [key, config] of Object.entries(firstTemplate.params)) {
      const val =
        paramOverrides?.[key] !== undefined ? paramOverrides[key] : config.default;
      text = text.replace(`{${key}}`, val);
    }
  }
  return {
    text,
    textTemplate: firstTemplate.text,
    source: 'forge_discover',
    sourceRef: template.id,
    category: firstTemplate.category || template.category,
    params: firstTemplate.params || null,
    paramValues: paramOverrides || {},
    status: 'active',
    priority: 1,
    traitId,
    // DELIBERATE DIVERGENCE from hand-equip: the seeder stamps archetype_default
    // (tier-2 built-in identity), whereas the user hand-equip path stamps
    // user_equipped (tier-1). This is the source-tier split the conflict
    // reconciler relies on — see traitEquip.js / useForge.js provenance stamps.
    provenance: 'archetype_default',
  };
}

describe('expandTraitToRuleSpecs — byte-identical to hand-equip', () => {
  it('matches the reference createRule payload for every ruleId (trait-iron-discipline @ moderate)', () => {
    const def = TRAIT_BY_ID['trait-iron-discipline'];
    const specs = expandTraitToRuleSpecs(def, 'moderate');
    const expected = def.ruleIds
      .filter((rid) => TEMPLATE_MAP.has(rid))
      .map((rid) => referenceSpec(rid, def.strengthProfiles.moderate[rid] || {}, def.id));
    expect(specs).toEqual(expected);
  });

  it('sets the trait-layer invariants on each spec', () => {
    const def = TRAIT_BY_ID['trait-trend-rider'];
    const specs = expandTraitToRuleSpecs(def, 'moderate');
    expect(specs.length).toBe(def.ruleIds.length); // all templates resolve
    for (const spec of specs) {
      expect(spec.source).toBe('forge_discover');
      expect(def.ruleIds).toContain(spec.sourceRef);
      expect(spec.status).toBe('active');
      expect(spec.priority).toBe(1);
      expect(spec.traitId).toBe(def.id);
      expect(spec.paramValues).toEqual(def.strengthProfiles.moderate[spec.sourceRef] || {});
    }
  });

  it('returns [] for an unknown trait or invalid strength', () => {
    expect(expandTraitToRuleSpecs(undefined, 'moderate')).toEqual([]);
    expect(expandTraitToRuleSpecs(TRAIT_BY_ID['trait-iron-discipline'], 'nope')).toEqual([]);
  });
});

describe('buildEquippedTraitEntry — matches useTraits.equipTrait entry shape', () => {
  it('produces { traitId, strength, isCustom, equippedAt:number }', () => {
    const before = Date.now();
    const entry = buildEquippedTraitEntry('trait-iron-discipline', 'moderate');
    const after = Date.now();
    expect(Object.keys(entry).sort()).toEqual(['equippedAt', 'isCustom', 'strength', 'traitId']);
    expect(entry.traitId).toBe('trait-iron-discipline');
    expect(entry.strength).toBe('moderate');
    expect(entry.isCustom).toBe(false);
    expect(typeof entry.equippedAt).toBe('number');
    expect(entry.equippedAt).toBeGreaterThanOrEqual(before);
    expect(entry.equippedAt).toBeLessThanOrEqual(after);
  });

  it('honors an explicit isCustom flag', () => {
    expect(buildEquippedTraitEntry('x', 'subtle', true).isCustom).toBe(true);
  });
});

describe('ARCHETYPE_DEFAULT_TRAITS — map integrity', () => {
  it('has exactly 3 known traits per archetype', () => {
    for (const [arch, ids] of Object.entries(ARCHETYPE_DEFAULT_TRAITS)) {
      expect(ids.length, arch).toBe(3);
      for (const id of ids) expect(TRAIT_BY_ID[id], `${arch} → ${id}`).toBeTruthy();
    }
  });
});

describe('buildSeedPlan — every archetype default set', () => {
  it('preserves trait order, stages all rules, and fits the rookie bundle cap (10)', () => {
    for (const [archetype, traitIds] of Object.entries(ARCHETYPE_DEFAULT_TRAITS)) {
      const { ruleSpecs, equippedTraits } = buildSeedPlan(traitIds, 'moderate');
      expect(equippedTraits.map((e) => e.traitId), archetype).toEqual(traitIds);
      const expectedCount = traitIds
        .map((id) => TRAIT_BY_ID[id].ruleIds.filter((rid) => TEMPLATE_MAP.has(rid)).length)
        .reduce((a, b) => a + b, 0);
      expect(ruleSpecs.length, archetype).toBe(expectedCount);
      expect(ruleSpecs.length, archetype).toBeGreaterThan(0);
      expect(ruleSpecs.length, archetype).toBeLessThanOrEqual(10);
    }
  });

  it('marks no traits isCustom for a collision-free set (momentum_chaser)', () => {
    const { equippedTraits } = buildSeedPlan(ARCHETYPE_DEFAULT_TRAITS.momentum_chaser, 'moderate');
    expect(equippedTraits.every((e) => e.isCustom === false)).toBe(true);
  });

  it('Diversifier (diversifier) is collision-free after the de-overlap', () => {
    // smart-money-tracker no longer claims tv-14 (sector-rotator's core rule), so
    // nothing is marked isCustom and tv-14 appears exactly once.
    const { ruleSpecs, equippedTraits } = buildSeedPlan(ARCHETYPE_DEFAULT_TRAITS.diversifier, 'moderate');
    expect(equippedTraits.every((e) => e.isCustom === false)).toBe(true);
    expect(ruleSpecs.filter((s) => s.sourceRef === 'tv-14').length).toBe(1);
    expect(
      expandTraitToRuleSpecs(TRAIT_BY_ID['trait-smart-money-tracker'], 'moderate').map((s) => s.sourceRef)
    ).toEqual(['tv-04', 'mb-05']);
  });

  it('still applies "Last Equipped Wins" when traits genuinely share a ruleId (mb-08)', () => {
    // patient-holder(mb-08) + let-winners-run(mb-08): the earlier trait becomes
    // isCustom and the shared rule doc is created twice — guards buildSeedPlan's
    // conflict branch now that no default set triggers it.
    const { ruleSpecs, equippedTraits } = buildSeedPlan(
      ['trait-patient-holder', 'trait-let-winners-run'],
      'moderate'
    );
    const byId = Object.fromEntries(equippedTraits.map((e) => [e.traitId, e]));
    expect(byId['trait-patient-holder'].isCustom).toBe(true);
    expect(byId['trait-let-winners-run'].isCustom).toBe(false);
    expect(ruleSpecs.filter((s) => s.sourceRef === 'mb-08').length).toBe(2);
  });
});
