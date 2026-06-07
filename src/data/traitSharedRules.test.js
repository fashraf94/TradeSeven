// src/data/traitSharedRules.test.js
//
// Phase 1B step 2 — the presentational shared-rule "controlled by" resolver.
// Pure vitest. Asserts the auto-derived owners and the isCustom-based controller.

import { describe, it, expect } from 'vitest';
import { SHARED_RULE_OWNERS, resolveSharedRuleControl } from './traitSharedRules';

describe('SHARED_RULE_OWNERS (auto-derived from TRAIT_LIBRARY)', () => {
  it('is exactly th-01 and mb-08 with their two owners each', () => {
    expect(Object.keys(SHARED_RULE_OWNERS).sort()).toEqual(['mb-08', 'th-01']);
    expect(SHARED_RULE_OWNERS['th-01'].sort()).toEqual(['trait-let-winners-run', 'trait-threshold-harvester']);
    expect(SHARED_RULE_OWNERS['mb-08'].sort()).toEqual(['trait-let-winners-run', 'trait-patient-holder']);
  });
});

describe('resolveSharedRuleControl', () => {
  it('controller = the non-isCustom equipped sharer (Last Equipped Wins)', () => {
    const ctrl = resolveSharedRuleControl([
      { traitId: 'trait-threshold-harvester', isCustom: true, equippedAt: 1 },
      { traitId: 'trait-let-winners-run', isCustom: false, equippedAt: 2 },
    ]);
    expect(ctrl['th-01'].controllerTraitId).toBe('trait-let-winners-run');
    expect(ctrl['th-01'].controllerName).toBe('Let Winners Run');
    expect(ctrl['th-01'].sharerTraitIds.sort())
      .toEqual(['trait-let-winners-run', 'trait-threshold-harvester']);
  });

  it('resolves mb-08 (Patient Holder ↔ Let Winners Run) to the non-custom card', () => {
    const ctrl = resolveSharedRuleControl([
      { traitId: 'trait-patient-holder', isCustom: false, equippedAt: 5 },
      { traitId: 'trait-let-winners-run', isCustom: true, equippedAt: 3 },
    ]);
    expect(ctrl['mb-08'].controllerTraitId).toBe('trait-patient-holder');
  });

  it('no contention when only one sharer is equipped', () => {
    expect(resolveSharedRuleControl([{ traitId: 'trait-let-winners-run', isCustom: false }])).toEqual({});
  });

  it('falls back to the latest-equipped sharer when none is non-custom (defensive)', () => {
    const ctrl = resolveSharedRuleControl([
      { traitId: 'trait-threshold-harvester', isCustom: true, equippedAt: 1 },
      { traitId: 'trait-let-winners-run', isCustom: true, equippedAt: 9 },
    ]);
    expect(ctrl['th-01'].controllerTraitId).toBe('trait-let-winners-run');
  });

  it('empty / null input → {}', () => {
    expect(resolveSharedRuleControl([])).toEqual({});
    expect(resolveSharedRuleControl(null)).toEqual({});
  });
});
