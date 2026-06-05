// src/utils/traitEnforcement.test.js
//
// Phase 1 — unit tests for the pure trait-enforcement helper. Plain vitest, no
// rendering — matches the pure-function convention (watchlistEquipUI.test.js,
// traitEquip.test.js). Verifies the "enforced" badge classification: a trait
// whose rules include any 'risk'/'allocation' rule is enforced; a preference-only
// trait (all 'technical') is not. Unknown / empty inputs are handled gracefully.

import { describe, it, expect } from 'vitest';
import { getEnforcementForRuleIds, getTraitEnforcement } from './traitEnforcement.js';

describe('getTraitEnforcement', () => {
  it('marks trait-diversifier enforced (a-05 / a-09 are allocation)', () => {
    expect(getTraitEnforcement('trait-diversifier')).toEqual({
      isEnforced: true,
      enforcedRuleIds: ['a-05', 'a-09'],
    });
  });

  it('marks trait-sector-rotator enforced (tv-14 / a-08 are allocation)', () => {
    expect(getTraitEnforcement('trait-sector-rotator')).toEqual({
      isEnforced: true,
      enforcedRuleIds: ['tv-14', 'a-08'],
    });
  });

  it('leaves a preference-only trait unenforced (trait-trend-rider is all technical)', () => {
    expect(getTraitEnforcement('trait-trend-rider')).toEqual({
      isEnforced: false,
      enforcedRuleIds: [],
    });
  });

  it('treats an unknown trait id as not enforced', () => {
    expect(getTraitEnforcement('trait-does-not-exist')).toEqual({
      isEnforced: false,
      enforcedRuleIds: [],
    });
  });
});

describe('getEnforcementForRuleIds', () => {
  it('returns not-enforced for an empty list', () => {
    expect(getEnforcementForRuleIds([])).toEqual({ isEnforced: false, enforcedRuleIds: [] });
  });

  it('handles a missing/undefined list gracefully', () => {
    expect(getEnforcementForRuleIds(undefined)).toEqual({ isEnforced: false, enforcedRuleIds: [] });
  });

  it('ignores unknown rule ids and keeps the enforced ones', () => {
    expect(getEnforcementForRuleIds(['totally-unknown', 'a-05'])).toEqual({
      isEnforced: true,
      enforcedRuleIds: ['a-05'],
    });
  });

  it('is not enforced when every rule is a soft (non-risk/allocation) category', () => {
    // trait-trend-rider's rules — all 'technical'
    expect(getEnforcementForRuleIds(['tech-moving-average-trend', 't-09', 'tv-01'])).toEqual({
      isEnforced: false,
      enforcedRuleIds: [],
    });
  });
});
