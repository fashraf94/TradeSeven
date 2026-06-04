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

import { doc, getDoc, getDocs, collection, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  createRule,
  createBundle,
  addRuleToBundle,
  getRules,
  removeRuleFromBundle,
  softDeleteRule,
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

/**
 * Re-seed an agent's default traits for a (usually just-changed) archetype as a
 * CLEAN REPLACE: the new archetype's defaults fully replace the old trait
 * loadout, leaving exactly ONE draft 'My Strategy' bundle and no orphaned trait
 * rule docs. Used by the dashboard archetype picker's "Load defaults" offer.
 * (The creation path uses seedDefaultTraits above, which is unchanged.)
 *
 * Write order keeps the trait LAYER new-first and the doc SOFT-DELETE last —
 * interruption-safe at every step, because decide.js projects activeRules by
 * `traitId ∈ equippedTraits` and filters `isDeleted`, INDEPENDENT of bundle
 * membership (api/_utils/projectActiveRules.js):
 *   1. Read current equippedTraits + rule docs; capture the OLD trait rule doc
 *      IDs BY ID now, before any writes. Old and new archetypes can SHARE a
 *      trait (e.g. trait-iron-discipline ∈ contrarian/analyst/guardian), so a
 *      post-write `traitId` filter would wrongly delete the freshly-created
 *      shared-trait rules — capturing ids up front avoids that.
 *   2. Reuse the single existing draft 'My Strategy' bundle (find-or-create).
 *   3. UNLINK the old trait rules from that bundle — frees its per-level rule-cap
 *      room BEFORE the new set is added (addRuleToBundle throws at
 *      maxRulesPerBundle, so old+new can't coexist in one bundle at low levels).
 *      Unlink is projection-neutral (trait rules are bundle-independent), and the
 *      old DOCS still exist + project (equippedTraits still old) until step 6.
 *   4. Create the new archetype's rule docs into that one bundle.
 *   5. Overwrite equippedTraits with the new set — the new loadout goes live here.
 *   6. LAST: soft-delete the captured OLD rule docs.
 * Before step 5 the old loadout still projects intact; after it the new loadout
 * projects (old rules ignored — wrong traitId — until step 6 removes them).
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

  // 2. Reuse the single existing draft bundle (find-or-create). If the prior
  //    seeder bug left multiple drafts, reuse the first — extras are harmless to
  //    the projection (it never selects trait rules by bundle membership).
  let bundleId = null;
  try {
    const draftSnap = await getDocs(
      query(collection(db, 'agents', agentId, 'bundles'), where('status', '==', 'draft'))
    );
    if (draftSnap.docs.length > 0) bundleId = draftSnap.docs[0].id;
  } catch (err) {
    console.warn('[reseedDefaultTraits] draft-bundle lookup failed; will create fresh:', err);
  }
  if (!bundleId) {
    try {
      bundleId = await createBundle(agentId, { name: BUNDLE_NAME });
    } catch (err) {
      console.error('[reseedDefaultTraits] createBundle failed:', err);
      return { seeded: false, reason: 'bundle_failed' };
    }
  }

  // 3. UNLINK the old trait rules from the reused bundle FIRST — frees its
  //    per-level rule-cap room before the new set is added (addRuleToBundle
  //    throws at maxRulesPerBundle, so old+new can't coexist in one bundle at low
  //    levels). Unlink is projection-neutral: trait rules are selected by
  //    traitId ∈ equippedTraits (still old here) + !isDeleted regardless of bundle
  //    membership, so the old loadout keeps projecting until step 6.
  for (const ruleId of oldRuleDocIds) {
    try {
      await removeRuleFromBundle(agentId, bundleId, ruleId);
    } catch {
      // Rule may live in a different/legacy bundle — the step-6 soft-delete still
      // removes it from the projection.
    }
  }

  // 4. Create the NEW archetype's rule docs into that one bundle.
  let rulesAdded = 0;
  for (const spec of ruleSpecs) {
    try {
      const ruleDocId = await createRule(agentId, spec);
      await addRuleToBundle(agentId, bundleId, ruleDocId);
      rulesAdded += 1;
    } catch (err) {
      console.warn(`[reseedDefaultTraits] rule create/add failed (${spec.sourceRef}):`, err);
    }
  }
  if (rulesAdded === 0) {
    return { seeded: false, reason: 'no_rules_added', bundleId };
  }

  // 5. Overwrite the trait layer — the new loadout goes live from here.
  try {
    await updateDoc(agentRef, {
      equippedTraits,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[reseedDefaultTraits] equippedTraits write failed:', err);
  }

  // 6. LAST: soft-delete the captured OLD rule docs. Soft-delete is the codebase
  //    convention and is enough for the projection (isDeleted is filtered); the
  //    unlink in step 3 already removed them from the reused bundle's ruleIds.
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
    bundleId,
    rulesAdded,
    rulesRemoved,
    traitCount: equippedTraits.length,
  };
}
