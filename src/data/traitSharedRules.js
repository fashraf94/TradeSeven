// src/data/traitSharedRules.js
//
// Two library traits can define the same ruleId (th-01: Threshold Harvester +
// Let Winners Run; mb-08: Patient Holder + Let Winners Run). When BOTH are
// equipped, "Last Equipped Wins" marks the earlier as isCustom and both rule
// docs still project (a Phase 2 mechanics question — NOT changed here).
//
// This module is PRESENTATIONAL ONLY: from the existing isCustom flag it names
// which equipped card currently "controls" a shared rule, so the UI can show
// "controlled by …" next to that rule. It does NOT change projection, dedupe the
// double-created docs, or touch canEquip / seeding.

import { TRAIT_LIBRARY, TRAIT_BY_ID } from './traitLibrary';

// ruleId → [traitId, …] for every ruleId owned by 2+ library traits. Auto-derived
// so a future shared rule is picked up without editing this file.
export const SHARED_RULE_OWNERS = (() => {
  const byRule = {};
  for (const t of TRAIT_LIBRARY) {
    for (const rid of t.ruleIds) (byRule[rid] ||= []).push(t.id);
  }
  return Object.fromEntries(Object.entries(byRule).filter(([, ids]) => ids.length > 1));
})();

/**
 * For the currently equipped traits, resolve which equipped card controls each
 * shared rule that is LIVE-contended (2+ of its owners equipped). The controller
 * is the equipped sharer NOT marked isCustom (Last-Equipped-Wins); a defensive
 * fallback picks the latest-equipped if none is un-custom.
 *
 * @param {Array<{traitId:string, isCustom?:boolean, equippedAt?:number}>} equippedTraits
 * @returns {Record<string, { controllerTraitId:string, controllerName:string, sharerTraitIds:string[] }>}
 *   keyed by ruleId; only includes rules with 2+ equipped owners.
 */
export function resolveSharedRuleControl(equippedTraits) {
  const entryByTraitId = new Map((equippedTraits || []).map((e) => [e.traitId, e]));
  const out = {};
  for (const [ruleId, owners] of Object.entries(SHARED_RULE_OWNERS)) {
    const equippedOwners = owners.filter((tid) => entryByTraitId.has(tid));
    if (equippedOwners.length < 2) continue; // no live contention → nothing to disambiguate
    let controllerId = equippedOwners.find((tid) => !entryByTraitId.get(tid)?.isCustom);
    if (!controllerId) {
      controllerId = [...equippedOwners].sort(
        (a, b) => (entryByTraitId.get(b)?.equippedAt || 0) - (entryByTraitId.get(a)?.equippedAt || 0)
      )[0];
    }
    out[ruleId] = {
      controllerTraitId: controllerId,
      controllerName: TRAIT_BY_ID[controllerId]?.name || controllerId,
      sharerTraitIds: equippedOwners,
    };
  }
  return out;
}
