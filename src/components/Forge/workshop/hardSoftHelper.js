// src/components/Forge/workshop/hardSoftHelper.js
//
// SINGLE SOURCE for the hard/soft classification shown in the Rules area.
//
// Phase 1: hard/soft is *derived from category* (risk + allocation = hard
// limits; everything else = preferences) and shown as informative display.
//
// Phase 3 (this layer): a bundle may carry an AUTHORED per-rule override —
// `bundle.ruleHardness = { [ruleId]: 'hard' | 'soft' }`. When an explicit value
// is present for a rule it wins; otherwise hard/soft falls back to the
// category-derived default. With NO override present the result is byte-identical
// to Phase 1, so display — and, once the fenced prompt path consults the same
// override, calibration — is provably unchanged except where a user explicitly
// authors a value.
//
// Because every hard/soft indicator (MixMeter, the Hard/Soft hero, bundle
// cards) reads through this module, honoring the override is a data change here
// — not a UI rebuild. Keep all callers routed through these helpers.
//
// NOTE on the fence: this module lives in src/ (client) and cannot be imported
// by the server prompt path (api/). The server makes its OWN, independent
// hardness determination (api/_utils/agentPromptAssembly.js +
// agentEvalPromptAssembly.js) and must consult the same `ruleHardness` map via
// projectActiveRules for the override to actually affect the prompt. This client
// half only governs DISPLAY + authoring/persistence.

// Categories whose rules are treated as firm limits the agent must follow.
export const HARD_CATEGORIES = new Set(['risk', 'allocation']);

// Derive hard/soft from a rule's category (the Phase-1 default).
export function classifyRuleHardSoft(category) {
  return HARD_CATEGORIES.has(category) ? 'hard' : 'soft';
}

// Resolve a category from either a loaded rule doc or a KB template.
export function ruleCategory(rule) {
  if (!rule) return null;
  return rule.category || rule.forgeTemplates?.[0]?.category || null;
}

// Normalize an authored override value to 'hard' | 'soft' | null.
export function normalizeHardness(value) {
  return value === 'hard' || value === 'soft' ? value : null;
}

// Read a rule's authored override off a bundle doc (undefined when unset).
export function bundleRuleHardness(bundle, ruleId) {
  return bundle?.ruleHardness?.[ruleId];
}

// Effective hard/soft for a rule: an explicit authored override wins; otherwise
// fall back to the category-derived default. `override` is the per-rule value
// pulled from a bundle's ruleHardness map (or undefined when unset). With no
// override this is exactly the Phase-1 category result — the parity guarantee.
export function resolveRuleHardness(rule, override) {
  return normalizeHardness(override) || classifyRuleHardSoft(ruleCategory(rule));
}

// Is a single rule a hard limit? Honors an optional authored override; with no
// override this is the Phase-1 category result (informative, unchanged).
export function isHardRule(rule, override) {
  return resolveRuleHardness(rule, override) === 'hard';
}

// Count hard vs soft across a bundle's rules, honoring authored overrides.
//   bundle      : { ruleIds: string[], ruleHardness?: { [id]: 'hard'|'soft' } }
//   rulesById   : Map<id, ruleDoc> | Record<id, ruleDoc>  (loaded rule docs)
// Rules that can't be resolved (and carry no override) default to soft so the
// meter never overstates.
export function bundleHardSoftCounts(bundle, rulesById) {
  const ids = bundle?.ruleIds || [];
  const get = rulesById?.get ? (id) => rulesById.get(id) : (id) => rulesById?.[id];
  let hard = 0;
  for (const id of ids) {
    if (isHardRule(get(id), bundleRuleHardness(bundle, id))) hard += 1;
  }
  return { hard, soft: ids.length - hard, total: ids.length };
}
