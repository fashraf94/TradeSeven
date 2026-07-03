// src/utils/compatSurfaceCopy.test.js
//
// WS1 Phase 2 — copy-rule tests for the compat surfaces (the
// conflictSurfaceCopy.test.js discipline). The real imports are the
// BUILD_RULES §4 dependency-surface guard; never mock.
//
// Copy rules under test (adjudication close-out riders §4.1–4.2):
//  - Case 1 soft warn: names the archetype + the Zone 1 statement + says the
//    rule runs as a SOFT PREFERENCE (never implies a block).
//  - Case 2 override-promote block: says soft is fine, must-obey is not.
//  - Case 3 category-hard block: NEVER claims the rule is available soft-only
//    (false for category-derived hardness) — says it is must-obey BY CATEGORY
//    and points to on-style alternatives.
//  - Param-swing rules acknowledge the in-style setting (rider 4.2).

import { describe, it, expect } from 'vitest';
import {
  buildConflictEquipWarning,
  buildPromoteBlockedMessage,
  buildConflictBadge,
  buildBundleEquipCompatWarning,
  nativeAlternatives,
} from './compatSurfaceCopy.js';
import { getConflictsForArchetype, ZONE1_REFS } from '../data/archetypeRuleCompatibility.js';

describe('case 1 — soft conflict-equip warning', () => {
  it('names the archetype, cites the Zone 1 statement, and promises soft-preference behavior', () => {
    const msg = buildConflictEquipWarning({
      archetype: 'momentum_chaser', templateId: 'tech-rsi-oversold', zone1Ref: 'TF-Z1-BUY-STRENGTH',
    });
    expect(msg).toContain('Trend Follower');
    expect(msg).toContain(ZONE1_REFS['TF-Z1-BUY-STRENGTH'].statement);
    expect(msg).toMatch(/soft preference/);
    expect(msg).not.toMatch(/can't be equipped|blocked/i);
  });
});

describe('cases 2+3 — promote-block copy splits by path kind', () => {
  it("override paths (set_rule_hardness / reforge_carry) say soft-yes, must-obey-no", () => {
    for (const path of ['set_rule_hardness', 'reforge_carry']) {
      const msg = buildPromoteBlockedMessage({
        archetype: 'momentum_chaser', templateId: 'tech-rsi-oversold', path, zone1Ref: 'TF-Z1-BUY-STRENGTH',
      });
      expect(msg, path).toMatch(/can run as a soft preference/);
      expect(msg, path).toMatch(/can't be made must-obey/);
    }
  });

  it('category paths (create_rule / update_rule_category) NEVER claim soft-only availability and point to alternatives', () => {
    for (const path of ['create_rule', 'update_rule_category']) {
      const msg = buildPromoteBlockedMessage({
        archetype: 'guardian', templateId: 'a-05', path, zone1Ref: 'CP-Z1-NO-JUICE',
      });
      expect(msg, path).toContain('Capital Preserver');
      expect(msg, path).toMatch(/must-obey rule by category/);
      expect(msg, path).not.toMatch(/can run as a soft preference/);
      // Points somewhere useful: either named alternatives or the category browse hint.
      expect(msg, path).toMatch(/on-style/);
    }
  });

  it('names up to two same-category NATIVE alternatives when they exist (a-05 × guardian → allocation natives)', () => {
    const alts = nativeAlternatives('a-05', 'guardian');
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.length).toBeLessThanOrEqual(2);
    const msg = buildPromoteBlockedMessage({
      archetype: 'guardian', templateId: 'a-05', path: 'create_rule', zone1Ref: 'CP-Z1-NO-JUICE',
    });
    expect(msg).toContain(alts[0].headline);
  });
});

describe('param-swing acknowledgment (rider 4.2)', () => {
  it('alloc-tier-preference × contrarian carries the in-style-setting hint in warn AND block copy', () => {
    const warn = buildConflictEquipWarning({
      archetype: 'contrarian', templateId: 'alloc-tier-preference', zone1Ref: 'CN-Z1-DONT-CHASE',
    });
    const block = buildPromoteBlockedMessage({
      archetype: 'contrarian', templateId: 'alloc-tier-preference', path: 'create_rule', zone1Ref: 'CN-Z1-DONT-CHASE',
    });
    for (const msg of [warn, block]) {
      expect(msg).toMatch(/default setting/);
      expect(msg).toMatch(/Undervalued/);
    }
  });

  it('the swing hint never leaks onto other archetypes for the same rule', () => {
    const msg = buildConflictEquipWarning({
      archetype: 'guardian', templateId: 'alloc-tier-preference', zone1Ref: 'CP-Z1-NO-JUICE',
    });
    expect(msg).not.toMatch(/default setting/);
  });
});

describe('badge + bundle-equip warning', () => {
  it('badge is short and archetype-named', () => {
    const badge = buildConflictBadge({ archetype: 'degen' });
    expect(badge).toBe('Off-style for Speculator');
  });

  it('bundle warning is count-honest, bundle-scoped, and null when clean', () => {
    expect(buildBundleEquipCompatWarning({ archetype: 'guardian', conflicts: [] })).toBeNull();
    const one = buildBundleEquipCompatWarning({
      archetype: 'guardian', conflicts: [{ templateId: 'a-05' }],
    });
    expect(one).toMatch(/is off-style/);
    expect(one).toMatch(/Checked this bundle only/);
    const many = buildBundleEquipCompatWarning({
      archetype: 'guardian',
      conflicts: [{ templateId: 'a-05' }, { templateId: 'tech-bollinger-squeeze' }, { templateId: 't-12' }],
    });
    expect(many).toMatch(/3 rules in this bundle are/);
  });
});

describe('copy ↔ map integrity', () => {
  it('every shipped conflict cell renders a non-empty soft warning and block message without throwing', () => {
    for (const archetype of ['momentum_chaser', 'contrarian', 'degen', 'guardian', 'analyst', 'diversifier']) {
      for (const c of getConflictsForArchetype(archetype)) {
        const warn = buildConflictEquipWarning({ archetype, templateId: c.ruleId, zone1Ref: c.zone1Ref });
        const block = buildPromoteBlockedMessage({ archetype, templateId: c.ruleId, path: 'create_rule', zone1Ref: c.zone1Ref });
        expect(warn.length, `${archetype}/${c.ruleId}`).toBeGreaterThan(40);
        expect(block.length, `${archetype}/${c.ruleId}`).toBeGreaterThan(40);
      }
    }
  });
});
