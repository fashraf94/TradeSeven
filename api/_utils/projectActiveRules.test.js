// Tests for the deploy-time activeRules projection (edit→activate fix).
// Covers the Phase 0 edge cases where a regression would silently corrupt the
// live rule set, plus a base-case parity check against the forge-produced shape.

import { describe, it, expect } from 'vitest';
import { projectActiveRules } from './projectActiveRules.js';
import { buildSeedPlan } from '../../src/data/traitEquip.js';
import { ARCHETYPE_DEFAULT_TRAITS } from '../../src/data/traitLibrary.js';

const doc = (over) => ({ isDeleted: false, ...over });

describe('projectActiveRules — edge cases', () => {
  it('0.6 unequip→re-equip dedup: same (traitId, sourceRef) → newest createdAt survives', () => {
    const docs = [
      doc({ id: 'old', traitId: 'trait-iron-discipline', sourceRef: 'mb-09', text: 'old', createdAt: 1000 }),
      doc({ id: 'new', traitId: 'trait-iron-discipline', sourceRef: 'mb-09', text: 'new', createdAt: 2000 }),
    ];
    const result = projectActiveRules([{ traitId: 'trait-iron-discipline' }], docs, []);
    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe('new');
    expect(result[0].text).toBe('new');
  });

  it('0.6 keeps cross-trait shared sourceRef (distinct traitId, not collapsed)', () => {
    // patient-holder + let-winners-run both reference mb-08 → two distinct live rules.
    const docs = [
      doc({ id: 'a', traitId: 'trait-patient-holder', sourceRef: 'mb-08', createdAt: 1 }),
      doc({ id: 'b', traitId: 'trait-let-winners-run', sourceRef: 'mb-08', createdAt: 2 }),
    ];
    const result = projectActiveRules(
      [{ traitId: 'trait-patient-holder' }, { traitId: 'trait-let-winners-run' }],
      docs,
      [],
    );
    expect(result.map((r) => r.ruleId).sort()).toEqual(['a', 'b']);
  });

  it('0.1 excludes a removed (unlinked) manual rule not in any non-archived bundle', () => {
    const docs = [
      doc({ id: 'm1', traitId: null, text: 'in bundle' }),
      doc({ id: 'm2', traitId: null, text: 'unlinked' }),
    ];
    const bundles = [{ id: 'b1', name: 'My Strategy', status: 'draft', ruleIds: ['m1'] }];
    const result = projectActiveRules([], docs, bundles);
    expect(result.map((r) => r.ruleId)).toEqual(['m1']);
  });

  it('0.1 excludes manual rules whose only bundle is archived', () => {
    const docs = [doc({ id: 'm1', traitId: null })];
    const bundles = [{ id: 'b1', name: 'Old', status: 'archived', ruleIds: ['m1'] }];
    expect(projectActiveRules([], docs, bundles)).toEqual([]);
  });

  it('0.2 keeps StarterKit rules (traitId:null in the equipped bundle) for a StarterKit-only agent', () => {
    const docs = [
      doc({ id: 'sk1', traitId: null, text: 'starter A', category: 'risk' }),
      doc({ id: 'sk2', traitId: null, text: 'starter B' }),
    ];
    const bundles = [{ id: 'b1', name: 'Starter Strategy', status: 'equipped', ruleIds: ['sk1', 'sk2'] }];
    const result = projectActiveRules([], docs, bundles); // empty equippedTraits
    expect(result.map((r) => r.ruleId).sort()).toEqual(['sk1', 'sk2']);
    expect(result.every((r) => r.bundleName === 'Starter Strategy')).toBe(true);
  });

  it('disjoint: a trait rule whose id is also in a bundle is counted once (not double)', () => {
    const docs = [
      doc({ id: 't1', traitId: 'trait-trend-rider', sourceRef: 'tech-moving-average-trend', createdAt: 1 }),
      doc({ id: 'm1', traitId: null }),
    ];
    const bundles = [{ id: 'b1', name: 'My Strategy', status: 'draft', ruleIds: ['t1', 'm1'] }];
    const result = projectActiveRules([{ traitId: 'trait-trend-rider' }], docs, bundles);
    expect(result.filter((r) => r.ruleId === 't1')).toHaveLength(1);
    expect(result.map((r) => r.ruleId).sort()).toEqual(['m1', 't1']);
  });

  it('empty equippedTraits with no bundled manual rules → []', () => {
    const docs = [
      doc({ id: 'orphan', traitId: 'trait-x' }), // trait not equipped
      doc({ id: 'unbundled', traitId: null }), // manual, not in any bundle
    ];
    expect(projectActiveRules([], docs, [])).toEqual([]);
  });

  it('excludes soft-deleted docs', () => {
    const docs = [doc({ id: 'd', traitId: 'trait-x', isDeleted: true })];
    expect(projectActiveRules([{ traitId: 'trait-x' }], docs, [])).toEqual([]);
  });
});

describe('projectActiveRules — base-case parity (Phase 1, while seeder still forges)', () => {
  it('unedited seeded agent → projection matches the forge-produced activeRules (order/bundleName aside)', () => {
    const { ruleSpecs, equippedTraits } = buildSeedPlan(ARCHETYPE_DEFAULT_TRAITS.momentum_chaser, 'moderate');
    // Simulate createRule: assign ids + createdAt; the rule doc is the spec + metadata.
    const ruleDocs = ruleSpecs.map((spec, i) => doc({ id: `rule-${i}`, createdAt: i + 1, ...spec }));
    const bundle = { id: 'b1', name: 'My Strategy', status: 'equipped', ruleIds: ruleDocs.map((d) => d.id) };

    // What equipBundle would produce from the same docs (its item shape).
    const forgeStyle = ruleDocs.map((d) => ({
      ruleId: d.id,
      text: d.text,
      textTemplate: d.textTemplate ?? null,
      params: d.params ?? null,
      paramValues: d.paramValues ?? null,
      category: d.category ?? null,
    }));

    const projected = projectActiveRules(equippedTraits, ruleDocs, [bundle]);

    // Compare the brain-relevant fields only (drop cosmetic bundleName, ignore order).
    const norm = (arr) =>
      arr
        .map((r) => ({
          ruleId: r.ruleId,
          text: r.text,
          textTemplate: r.textTemplate,
          params: r.params,
          paramValues: r.paramValues,
          category: r.category,
        }))
        .sort((a, b) => a.ruleId.localeCompare(b.ruleId));

    expect(projected).toHaveLength(ruleSpecs.length);
    expect(norm(projected)).toEqual(norm(forgeStyle));
  });
});
