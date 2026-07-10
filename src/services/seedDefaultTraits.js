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

import { doc, getDoc } from 'firebase/firestore';
import { updateAgentSettings } from './agentService';
import { db } from '../firebase/config';
import {
  createRule,
  getRules,
  softDeleteRule,
} from './forgeService';
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

/**
 * Re-seed an agent's default traits for a (usually just-changed) archetype as a
 * CLEAN REPLACE: the new archetype's defaults fully replace the old trait
 * loadout, leaving no orphaned trait rule docs. Used by the dashboard archetype
 * picker's "Load defaults" offer. (Creation uses seedDefaultTraits above.)
 *
 * Trait rules are bundle-independent (projected at deploy by
 * `traitId ∈ equippedTraits` + `!isDeleted`, api/_utils/projectActiveRules.js),
 * so the replace never touches a bundle. Write order keeps the trait LAYER
 * new-first and the doc SOFT-DELETE last — interruption-safe at every step:
 *   1. Read current equippedTraits + rule docs; capture the OLD trait rule doc
 *      IDs BY ID now, before any writes. Old and new archetypes can SHARE a
 *      trait (e.g. trait-iron-discipline ∈ contrarian/analyst/guardian), so a
 *      post-write `traitId` filter would wrongly delete the freshly-created
 *      shared-trait rules — capturing ids up front avoids that.
 *   2. Create the new archetype's rule docs (with traitId).
 *   3. Overwrite equippedTraits with the new set — the new loadout goes live here.
 *   4. LAST: soft-delete the captured OLD rule docs.
 * Before step 3 the old loadout still projects intact; after it the new loadout
 * projects (old docs ignored — still old traitId until step 4 removes them).
 *
 * ROBUSTNESS: never throws. Per-step failures log and degrade.
 *
 * @param {string} agentId
 * @param {string} archetype - archetype CODE-ID
 * @param {Object} [options]
 * @param {string} [options.strength='moderate']
 * @returns {Promise<Object>} result summary (never rejects)
 */
export async function reseedDefaultTraits(agentId, archetype, { strength = 'moderate' } = {}) {
  if (!agentId) return { seeded: false, reason: 'no_agent' };

  const traitIds = ARCHETYPE_DEFAULT_TRAITS[archetype];
  if (!traitIds || traitIds.length === 0) {
    return { seeded: false, reason: 'no_defaults', archetype };
  }

  const { ruleSpecs, equippedTraits } = buildSeedPlan(traitIds, strength);
  if (ruleSpecs.length === 0) {
    return { seeded: false, reason: 'no_rules', archetype };
  }

  const agentRef = doc(db, 'agents', agentId);

  // 1. Read phase (no writes). Capture the OLD trait rule doc IDs by id, before
  //    creating anything, so a shared trait's NEW rules are never caught below.
  let oldRuleDocIds = [];
  try {
    const [agentSnap, existingRules] = await Promise.all([
      getDoc(agentRef),
      getRules(agentId), // excludes already-soft-deleted rules
    ]);
    const oldTraitIds = new Set(
      (agentSnap.exists() ? (agentSnap.data().equippedTraits || []) : [])
        .map((t) => t && t.traitId)
        .filter(Boolean)
    );
    oldRuleDocIds = existingRules
      .filter((r) => r && r.traitId && oldTraitIds.has(r.traitId))
      .map((r) => r.id);
  } catch (err) {
    console.warn('[reseedDefaultTraits] read phase failed; proceeding without cleanup:', err);
  }

  // 2. Create the NEW archetype's rule docs (bundle-independent — see header).
  let rulesAdded = 0;
  for (const spec of ruleSpecs) {
    try {
      // Archetype threaded — see seedDefaultTraits above (fence-lite rider 2).
      await createRule(agentId, spec, { archetype });
      rulesAdded += 1;
    } catch (err) {
      console.warn(`[reseedDefaultTraits] rule create failed (${spec.sourceRef}):`, err);
    }
  }
  if (rulesAdded === 0) {
    return { seeded: false, reason: 'no_rules_added' };
  }

  // 3. Overwrite the trait layer — the new loadout goes live from here. The new
  //    docs project by `traitId ∈ equippedTraits`; the old docs stop projecting
  //    the moment their traitId leaves equippedTraits.
  try {
    // R1(a): via the rev-bumping server endpoint (settingsRev discipline).
    await updateAgentSettings(agentId, { equippedTraits });
  } catch (err) {
    console.warn('[reseedDefaultTraits] equippedTraits write failed:', err);
  }

  // 4. LAST: soft-delete the captured OLD rule docs (the projection filters
  //    isDeleted). Shared-trait NEW docs are safe — old docs were captured by id
  //    in step 1 before any writes, so only genuinely-old docs are removed.
  let rulesRemoved = 0;
  for (const ruleId of oldRuleDocIds) {
    try {
      await softDeleteRule(agentId, ruleId);
      rulesRemoved += 1;
    } catch (err) {
      console.warn(`[reseedDefaultTraits] soft-delete failed (${ruleId}):`, err);
    }
  }

  return {
    seeded: true,
    replaced: true,
    rulesAdded,
    rulesRemoved,
    traitCount: equippedTraits.length,
  };
}
