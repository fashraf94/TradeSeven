// src/utils/traitEnforcement.js
//
// Pure, framework-free helper behind the dashboard "enforced" badge.
//
// The live agent has no injectionClass. The eval-prompt assembler splits an
// equipped trait's rules by CATEGORY into hard "CONSTRAINTS (must obey)" vs soft
// "STRATEGY PREFERENCES". So a personality-flavored trait can silently arm hard
// constraints — this surfaces that honestly: a trait is "enforced" if ANY of its
// rules is risk/allocation.
//
// This file is a client-side PREDICTOR of server behavior, kept in sync by hand.
// It is NOT test-linked to the source sites, so if any of the anchors below
// change, update this file in lockstep:
//
//   • ENFORCED_CATEGORIES mirrors the server's constraint set —
//     api/_utils/agentEvalPromptAssembly.js:285 `constraintCats = new Set(['risk',
//     'allocation'])` (the line that actually classifies CONSTRAINTS vs STRATEGY
//     PREFERENCES for the eval prompt).
//   • Category is resolved exactly as the persisted rule doc records it — see
//     useForge.addRuleToBundle (useForge.js:336 `firstTemplate = forgeTemplates[0]`,
//     :350 `category: firstTemplate.category || template.category`) — so the badge
//     reads the same category the rule is stored with and the assembler classifies.
//
// We only READ category; Stream B owns categorization in forgeKnowledgeBase.
// No React, no Firestore.

import { FORGE_RULE_TEMPLATES } from '../data/forgeKnowledgeBase';
import { TRAIT_BY_ID } from '../data/traitLibrary';

// ruleId → canonical (persisted) category — resolved as useForge.js:336/:350 does
// (see the anchors above). Mirrors the TEMPLATE_MAP pattern in traitEquip.js.
const CATEGORY_BY_RULE_ID = new Map(
  FORGE_RULE_TEMPLATES.map((t) => [t.id, t.forgeTemplates?.[0]?.category || t.category])
);

// The hard-constraint categories — mirrors agentEvalPromptAssembly.js:285 (anchors above).
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
