// api/_utils/ruleHardness.js
//
// SINGLE server-side source for hard/soft — i.e. whether a rule is injected as a
// CONSTRAINT (must obey) or a STRATEGY PREFERENCE (should follow). The fence
// forbids api/ importing the client src/components/Forge/workshop/hardSoftHelper.js,
// so the server keeps exactly ONE copy here, and every server consumer
// (projectActiveRules + the strategy, eval, and news prompt builders) routes
// through it so they cannot drift from one another.
//
// Resolution order: an authored per-rule override carried on the active-rule item
// (item.hardness === 'hard' | 'soft') wins; otherwise the category-derived
// default applies. projectActiveRules bakes `override ?? category` into
// item.hardness at deploy (the single resolution point), so for projected items
// resolveRuleHardness simply READS the carried field — it never re-derives. The
// category fallback below only fires for items that never went through projection
// (legacy battle snapshots, the projection-failure fallback), which keeps the
// no-override result byte-identical to pre-Phase-3.
//
// NOTE: HARD_CATEGORIES here MUST stay in lockstep with the client
// hardSoftHelper.HARD_CATEGORIES. That client/server pair is the one duplication
// the fence makes unavoidable; everything else funnels through these two.

export const HARD_CATEGORIES = new Set(['risk', 'allocation']);

// Category-derived default (the pre-Phase-3 rule). Returns 'hard' | 'soft'.
export function classifyByCategory(category) {
  return HARD_CATEGORIES.has(category) ? 'hard' : 'soft';
}

// Effective hard/soft for an active-rule item: the carried override wins, else
// the category default. Always returns 'hard' | 'soft' (never null).
export function resolveRuleHardness(rule) {
  const h = rule && rule.hardness;
  if (h === 'hard' || h === 'soft') return h;
  return classifyByCategory(rule && rule.category);
}

// Convenience predicate for the constraint/strategy split.
export function isHardRule(rule) {
  return resolveRuleHardness(rule) === 'hard';
}
