// src/components/Forge/workshop/hardSoftHelper.js
//
// SINGLE SOURCE for the hard/soft classification shown in the Rules area.
//
// Phase 1: hard/soft is *derived from category* and shown as informative
// display only (risk + allocation = hard limits; everything else = preferences).
// It is NOT user-settable yet.
//
// Phase 3 will introduce an authored per-bundle override (ruleId → 'hard' |
// 'soft', defaulting to this category-derived value) and wire it into prompt
// assembly. Because every hard/soft indicator (MixMeter, the hero, bundle
// cards) reads through this module, that swap is a data change here — not a UI
// rebuild. Keep all callers routed through these helpers.

// Categories whose rules are treated as firm limits the agent must follow.
export const HARD_CATEGORIES = new Set(['risk', 'allocation']);

// Derive hard/soft from a rule's category (the Phase-1 rule).
export function classifyRuleHardSoft(category) {
  return HARD_CATEGORIES.has(category) ? 'hard' : 'soft';
}

// Resolve a category from either a loaded rule doc or a KB template.
export function ruleCategory(rule) {
  if (!rule) return null;
  return rule.category || rule.forgeTemplates?.[0]?.category || null;
}

// Is a single rule (doc or template) a hard limit? (informative)
export function isHardRule(rule) {
  return classifyRuleHardSoft(ruleCategory(rule)) === 'hard';
}

// Count hard vs soft across a bundle's rules.
//   bundle      : { ruleIds: string[] }  (rule doc ids)
//   rulesById   : Map<id, ruleDoc> | Record<id, ruleDoc>  (loaded rule docs)
// Rules that can't be resolved default to soft so the meter never overstates.
export function bundleHardSoftCounts(bundle, rulesById) {
  const ids = bundle?.ruleIds || [];
  const get = rulesById?.get ? (id) => rulesById.get(id) : (id) => rulesById?.[id];
  let hard = 0;
  for (const id of ids) {
    if (isHardRule(get(id))) hard += 1;
  }
  return { hard, soft: ids.length - hard, total: ids.length };
}
