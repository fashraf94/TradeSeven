// api/_utils/projectActiveRules.js
//
// Re-project agent.activeRules from the LIVE equipped state at deploy time — the
// fix for the edit→activate gap. activeRules used to be a frozen one-shot
// snapshot (forgeService.equipBundle), so trait-strength / equip edits never
// reached the next battle. This rebuilds it fresh from the current rule docs on
// every deploy, the one guaranteed choke point (decide.js).
//
// Pure + Firestore-free (operates on plain doc objects), so it is unit-tested
// directly and needs no src/ import. The emitted item shape matches
// equipBundle's output field-for-field, so every activeRules reader stays
// unchanged: agentPromptAssembly (resolveRuleText re-interpolates
// textTemplate+params+paramValues), agentBattleService snapshot,
// agentEvalPromptAssembly, ForgeCitationCard, forgeStatsService.
//
// Selection (confirmed in Phase 0):
//   trait rules     — docs whose traitId is in equippedTraits, deduped by
//                     (traitId, sourceRef) keeping the newest createdAt
//                     (collapses unequip→re-equip orphan docs; preserves
//                     legitimately-distinct cross-trait shared ruleIds).
//   non-trait rules — docs with no traitId whose id is in a NON-archived bundle
//                     (manual Advanced-Firmware rules + StarterKit rules).
//                     Excludes rules unlinked via removeRuleFromBundle (which
//                     does not delete the doc) and agent-learned rules (never
//                     bundled).

import { classifyByCategory } from './ruleHardness.js';

// Normalize any Firestore/JS timestamp representation to epoch millis.
function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis(); // Admin SDK Timestamp
  if (typeof ts.seconds === 'number') return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6;
  if (ts instanceof Date) return ts.getTime();
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// Map a live rule doc → the activeRules item shape produced by equipBundle.
function toActiveRuleItem(r, ruleIdToBundleName, ruleIdToHardness) {
  return {
    ruleId: r.id,
    text: r.text ?? null,
    textTemplate: r.textTemplate ?? null,
    params: r.params ?? null,
    paramValues: r.paramValues ?? null,
    category: r.category ?? null,
    bundleName: ruleIdToBundleName[r.id] ?? null,
    // Phase 3 — THE single hard/soft resolution point. Always populated with the
    // resolved value: an authored per-rule override wins, else the category
    // default. Every consumer (the strategy/eval/news prompt builders, the
    // citation stats) reads this carried field and never re-derives from
    // category. With no override this equals the category-derived value, so the
    // assembled prompts stay byte-identical to pre-Phase-3.
    hardness: ruleIdToHardness?.[r.id] ?? classifyByCategory(r.category),
  };
}

/**
 * @param {Array<{traitId?:string}>} equippedTraits - agent.equippedTraits
 * @param {Array<Object>} ruleDocs - docs from agents/{id}/rules (each with `id`)
 * @param {Array<Object>} bundles  - docs from agents/{id}/bundles (each with `id`)
 * @returns {Array<Object>} activeRules items
 */
export function projectActiveRules(equippedTraits, ruleDocs, bundles) {
  const equippedIds = new Set(
    (equippedTraits || []).map((t) => t && t.traitId).filter(Boolean)
  );

  // Union of ruleIds across non-archived bundles (+ a ruleId → bundleName map and
  // a ruleId → authored hard/soft override map).
  const bundleRuleIds = new Set();
  const ruleIdToBundleName = {};
  const ruleIdToHardness = {};
  for (const b of bundles || []) {
    if (!b || b.status === 'archived') continue;
    const hardnessMap = b.ruleHardness || {};
    for (const rid of b.ruleIds || []) {
      bundleRuleIds.add(rid);
      if (!(rid in ruleIdToBundleName)) ruleIdToBundleName[rid] = b.name ?? null;
      // First non-archived bundle that carries an explicit override for this rule
      // wins (mirrors bundleName first-wins). Only 'hard'/'soft' are honored;
      // anything else is ignored so the item's hardness stays null (→ category).
      if (!(rid in ruleIdToHardness)) {
        const v = hardnessMap[rid];
        if (v === 'hard' || v === 'soft') ruleIdToHardness[rid] = v;
      }
    }
  }

  const docs = (ruleDocs || []).filter((r) => r && !r.isDeleted);

  // Trait rules — by equippedTraits, deduped (traitId, sourceRef) keep newest.
  const newestByKey = new Map();
  for (const r of docs) {
    if (!r.traitId || !equippedIds.has(r.traitId)) continue;
    // Collision-safe composite key (no control bytes) — distinct (traitId, sourceRef)
    // pairs map to distinct JSON, so cross-trait shared ruleIds stay separate.
    const key = JSON.stringify([r.traitId, r.sourceRef ?? '']);
    const prev = newestByKey.get(key);
    if (!prev || toMillis(r.createdAt) >= toMillis(prev.createdAt)) {
      newestByKey.set(key, r);
    }
  }
  const traitItems = [...newestByKey.values()].map((r) => toActiveRuleItem(r, ruleIdToBundleName, ruleIdToHardness));

  // Non-trait rules — no traitId, currently a member of a non-archived bundle.
  const nonTraitItems = docs
    .filter((r) => !r.traitId && bundleRuleIds.has(r.id))
    .map((r) => toActiveRuleItem(r, ruleIdToBundleName, ruleIdToHardness));

  return [...traitItems, ...nonTraitItems];
}
