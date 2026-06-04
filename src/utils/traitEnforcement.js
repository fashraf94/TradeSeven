// src/utils/traitEnforcement.js
//
// Pure, framework-free helper behind the dashboard "enforced" badge.
//
// The live agent has no injectionClass. decide.js classifies an equipped trait's
// rules by CATEGORY: 'risk' + 'allocation' rules inject as hard "CONSTRAINTS
// (must obey)", everything else as a soft "STRATEGY PREFERENCE". So a
// personality-flavored trait can silently arm hard constraints — this surfaces
// that honestly: a trait is "enforced" if ANY of its rules is risk/allocation.
//
// Category is resolved exactly as the persisted rule doc records it
// (forgeTemplates[0].category || template.category — see useForge.addRuleToBundle),
// so the badge matches what decide.js actually injects. We only READ category;
// Stream B owns categorization in forgeKnowledgeBase. No React, no Firestore.

import { FORGE_RULE_TEMPLATES } from '../data/forgeKnowledgeBase';
import { TRAIT_BY_ID } from '../data/traitLibrary';

// ruleId → canonical (persisted) category. Mirrors the TEMPLATE_MAP pattern in
// traitEquip.js / useTraits.js and the category resolution in useForge.js.
const CATEGORY_BY_RULE_ID = new Map(
  FORGE_RULE_TEMPLATES.map((t) => [t.id, t.forgeTemplates?.[0]?.category || t.category])
);

// The categories decide.js injects as hard constraints ("must obey").
const ENFORCED_CATEGORIES = new Set(['risk', 'allocation']);

/**
 * Classify a raw list of ruleIds. Unknown / unresolvable ids are ignored.
 * @param {string[]} ruleIds
 * @returns {{ isEnforced: boolean, enforcedRuleIds: string[] }}
 */
export function getEnforcementForRuleIds(ruleIds) {
  const enforcedRuleIds = (ruleIds || []).filter((rid) =>
    ENFORCED_CATEGORIES.has(CATEGORY_BY_RULE_ID.get(rid))
  );
  return { isEnforced: enforcedRuleIds.length > 0, enforcedRuleIds };
}

/**
 * Classify a trait by id (resolves its ruleIds from the trait library).
 * Unknown trait → not enforced.
 * @param {string} traitId
 * @returns {{ isEnforced: boolean, enforcedRuleIds: string[] }}
 */
export function getTraitEnforcement(traitId) {
  return getEnforcementForRuleIds(TRAIT_BY_ID[traitId]?.ruleIds || []);
}
