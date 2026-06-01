// src/services/seedDefaultTraits.js
//
// Seeds a freshly-created agent with its archetype's three default traits,
// producing a loadout indistinguishable from one the user equipped by hand:
//   * equippedTraits[] on the agent doc — same entry shape as useTraits.equipTrait
//   * one rule doc per trait ruleId under agents/{id}/rules — same shape as
//     useForge.addRuleToBundle
//   * all funneled into a single lazily-created draft 'My Strategy' bundle
//
// LIVENESS: defaults go live at DEPLOY, not at seed. decide.js re-projects
// agent.activeRules from the current equipped state on every deploy
// (api/_utils/projectActiveRules.js), selecting trait rules by
// traitId ∈ equippedTraits. So the seeder only writes equippedTraits + the
// trait rule docs into a single DRAFT bundle — byte-identical to hand-equip,
// which also leaves the bundle draft — and the deploy projection makes them
// live on the first battle. (An earlier version forged+equipped the bundle;
// that's removed now the projection is the commit point, which also keeps a
// later trait-add appending to this draft instead of spawning a 2nd bundle.)
//
// ROBUSTNESS: never throws. Per-rule failures log and continue; nothing here
// can block agent creation. The caller (AgentCreationFlow) also wraps this in
// try/catch as defense in depth.

import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  createRule,
  createBundle,
  addRuleToBundle,
} from './forgeService';
import { ARCHETYPE_DEFAULT_TRAITS } from '../data/traitLibrary';
import { buildSeedPlan } from '../data/traitEquip';

const BUNDLE_NAME = 'My Strategy';

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

  // 1. Create the single draft 'My Strategy' bundle (mirrors useForge's lazy create).
  let bundleId;
  try {
    bundleId = await createBundle(agentId, { name: BUNDLE_NAME });
  } catch (err) {
    console.error('[seedDefaultTraits] createBundle failed:', err);
    return { seeded: false, reason: 'bundle_failed' };
  }

  // 2. Create each rule and link it into the bundle. Per-rule failures continue.
  let rulesAdded = 0;
  for (const spec of ruleSpecs) {
    try {
      const ruleDocId = await createRule(agentId, spec);
      await addRuleToBundle(agentId, bundleId, ruleDocId);
      rulesAdded += 1;
    } catch (err) {
      console.warn(`[seedDefaultTraits] rule create/add failed (${spec.sourceRef}):`, err);
    }
  }
  if (rulesAdded === 0) {
    return { seeded: false, reason: 'no_rules_added', bundleId };
  }

  // 3. Persist the equippedTraits trait-layer (byte-identical to hand-equip).
  try {
    await updateDoc(doc(db, 'agents', agentId), {
      equippedTraits,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[seedDefaultTraits] equippedTraits write failed:', err);
  }

  // Defaults go live at DEPLOY via the activeRules projection (see header). The
  // seeder intentionally leaves the bundle DRAFT — like hand-equip — and does
  // NOT forge/equip; decide.js selects these by traitId ∈ equippedTraits.
  return { seeded: true, bundleId, rulesAdded, traitCount: equippedTraits.length };
}
