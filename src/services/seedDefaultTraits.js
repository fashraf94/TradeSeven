// src/services/seedDefaultTraits.js
//
// Seeds a freshly-created agent with its archetype's three default traits,
// producing a loadout indistinguishable from one the user equipped by hand:
//   * equippedTraits[] on the agent doc — same entry shape as useTraits.equipTrait
//   * one rule doc per trait ruleId under agents/{id}/rules (with traitId) —
//     same shape as useForge.addTraitRule
//
// Trait rules are an identity layer and are NOT added to any bundle: bundling
// would count them against the per-level bundle rule cap and pre-fill the user's
// rule bundle (the conflation removed in the trait-cap fix).
//
// LIVENESS: defaults go live at DEPLOY, not at seed. decide.js re-projects
// agent.activeRules from the current equipped state on every deploy
// (api/_utils/projectActiveRules.js), selecting trait rules by
// traitId ∈ equippedTraits — INDEPENDENT of bundle membership. So the seeder
// only writes equippedTraits + the trait rule docs, and the deploy projection
// makes them live on the first battle.
//
// ROBUSTNESS: never throws. Per-rule failures log and continue; nothing here
// can block agent creation. The caller (AgentCreationFlow) also wraps this in
// try/catch as defense in depth.

import { updateAgentSettings } from './agentService';
import { createRule } from './forgeService';
import { ARCHETYPE_DEFAULT_TRAITS } from '../data/traitLibrary';
import { buildSeedPlan } from '../data/traitEquip';

/**
 * @param {string} agentId
 * @param {string} archetype - archetype CODE-ID (momentum_chaser, degen, …)
 * @param {Object} [options]
 * @param {string} [options.strength='moderate']
 * @returns {Promise<Object>} result summary (never rejects)
 */
export async function seedDefaultTraits(agentId, archetype, { strength = 'moderate' } = {}) {
  if (!agentId) return { seeded: false, reason: 'no_agent' };

  const traitIds = ARCHETYPE_DEFAULT_TRAITS[archetype];
  if (!traitIds || traitIds.length === 0) {
    // Unknown/absent archetype → nothing to seed. Not an error.
    return { seeded: false, reason: 'no_defaults', archetype };
  }

  const { ruleSpecs, equippedTraits } = buildSeedPlan(traitIds, strength);
  if (ruleSpecs.length === 0) {
    return { seeded: false, reason: 'no_rules', archetype };
  }

  // 1. Create each trait rule DOC. Trait rules are an identity layer projected at
  //    deploy by `traitId ∈ equippedTraits` (api/_utils/projectActiveRules.js),
  //    INDEPENDENT of bundle membership — so they are NOT added to any bundle
  //    (that would wrongly count them against the per-level bundle rule cap and
  //    pre-fill the user's rule bundle). Per-rule failures continue; nothing here
  //    blocks agent creation.
  let rulesAdded = 0;
  for (const spec of ruleSpecs) {
    try {
      // Archetype threaded so the WS1 compat guard never falls back to a
      // per-rule agent read (fence-lite rider 2). Seeded kits classify
      // native/neutral by construction (the seeded-rule invariant), so the
      // guard never blocks here.
      await createRule(agentId, spec, { archetype });
      rulesAdded += 1;
    } catch (err) {
      console.warn(`[seedDefaultTraits] rule create failed (${spec.sourceRef}):`, err);
    }
  }
  if (rulesAdded === 0) {
    return { seeded: false, reason: 'no_rules_added' };
  }

  // 2. Persist the equippedTraits trait-layer (byte-identical to hand-equip).
  //    R1(a): via the rev-bumping server endpoint (settingsRev discipline);
  //    warn-swallow semantics preserved.
  try {
    await updateAgentSettings(agentId, { equippedTraits });
  } catch (err) {
    console.warn('[seedDefaultTraits] equippedTraits write failed:', err);
  }

  // Defaults go live at DEPLOY via the activeRules projection (see header):
  // decide.js selects these by traitId ∈ equippedTraits — no bundle needed.
  return { seeded: true, rulesAdded, traitCount: equippedTraits.length };
}
