// api/_utils/archetypeSeeding.js
//
// Server-side archetype default-trait seeding — the ONE seeding call the
// archetype-change surfaces converge on. It loads the target archetype's
// born-with trait set INSIDE the caller's Firestore transaction, so
// archetype + equippedTraits + the new trait rule docs all commit as one atomic
// action (the invariant: an agent's archetype always carries that archetype's
// born-with traits — there is no persisted state where they disagree).
//
// This is the admin-SDK sibling of the client clean-replace in
// src/services/seedDefaultTraits.js (reseedDefaultTraits). Both build the loadout
// from the SAME pure planner (src/data/traitEquip.js buildSeedPlan) reading the
// SAME source of truth (src/data/traitLibrary.js ARCHETYPE_DEFAULT_TRAITS), so
// the two paths cannot drift. The api → src import is Node-clean (traitEquip →
// forgeKnowledgeBase + traitLibrary, no React/firebase); the caller's real
// (never-mocked) import of THIS module is the BUILD_RULES §4 dependency-surface
// guard (see change-archetype.test.js).
//
// Rule-doc shape is byte-compatible with forgeService.createRule so every
// activeRules reader (projectActiveRules → decide.js) and the conflict reconciler
// (provenance tier tagging) stay unchanged. Seeded rules carry
// provenance:'archetype_default' → the reconciler's tier 2 (built-in identity),
// so a later user equip (tier 1) still outranks them.
//
// ATOMICITY SHAPE: the seed is WRITE-ONLY inside the tx — create the new rule
// docs (tx.set) and hand the caller the equippedTraits to write alongside the
// archetype (tx.update). It reads NOTHING (a Firestore tx needs reads-before-
// writes, and forcing a rules read into the tx would make a transient read
// outage abort an otherwise-valid change). The OUTGOING trait docs need no in-tx
// delete: they stop projecting the instant equippedTraits changes
// (projectActiveRules gates on traitId ∈ equippedTraits AND dedups
// (traitId, sourceRef) newest-wins), so they are inert immediately. Soft-deleting
// them is post-commit hygiene (softDeleteReplacedTraitRuleDocs), best-effort and
// non-fatal — a failure only leaves inert orphan docs, never the bad state.
//
// NO runtime clamping: buildSeedPlan writes the born-with set verbatim. The
// 2-per-group / 6-total cap is guaranteed by the authored sets themselves and
// pinned by traitLibrary.bornWith.test.js — a silent truncation here would be
// worse than an overflow (founder ruling).

import { FieldValue } from 'firebase-admin/firestore';
import { ARCHETYPE_DEFAULT_TRAITS } from '../../src/data/traitLibrary.js';
import { buildSeedPlan } from '../../src/data/traitEquip.js';
import { buildRuleDocFields } from '../../src/data/ruleDocFields.js';

/**
 * Map one buildSeedPlan ruleSpec → the Firestore rule-doc body. Uses the ONE
 * shared field shape (src/data/ruleDocFields.js) so it cannot drift from
 * forgeService.createRule; only the admin-SDK server timestamps differ.
 * (Seeded specs carry provenance:'archetype_default' → reconciler tier 2.)
 */
function buildSeedRuleDoc(spec) {
  return {
    ...buildRuleDocFields(spec),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/**
 * Does this archetype have a non-empty born-with set? (Guards the caller from
 * wiping an agent's trait layer for an archetype with no defaults.)
 * @param {string} archetype - archetype CODE-ID
 * @returns {boolean}
 */
export function hasBornWithSet(archetype) {
  const ids = ARCHETYPE_DEFAULT_TRAITS[archetype];
  return Array.isArray(ids) && ids.length > 0;
}

/**
 * Stage `archetype`'s born-with rule docs onto the caller's transaction (WRITES
 * ONLY — no reads) and return the equippedTraits the caller must write onto the
 * agent doc in the SAME tx (alongside the archetype field) for the seed to take
 * effect. See the module header for why this reads/deletes nothing.
 *
 * @param {FirebaseFirestore.Transaction} tx
 * @param {FirebaseFirestore.DocumentReference} agentRef - agents/{id}
 * @param {string} archetype - archetype CODE-ID
 * @param {Object} [options]
 * @param {string} [options.strength='moderate']
 * @returns {{ equippedTraits: Array<Object>|null, rulesAdded: number }}
 */
export function seedArchetypeTraitsInTx(tx, agentRef, archetype, { strength = 'moderate' } = {}) {
  const traitIds = ARCHETYPE_DEFAULT_TRAITS[archetype];
  if (!Array.isArray(traitIds) || traitIds.length === 0) {
    // No defaults → do NOT touch the trait layer (defensive; every
    // VALID_ARCHETYPES has a born-with set, pinned by traitLibrary.bornWith.test).
    return { equippedTraits: null, rulesAdded: 0 };
  }

  const { ruleSpecs, equippedTraits } = buildSeedPlan(traitIds, strength);
  const rulesRef = agentRef.collection('rules');

  let rulesAdded = 0;
  for (const spec of ruleSpecs) {
    tx.set(rulesRef.doc(), buildSeedRuleDoc(spec));
    rulesAdded += 1;
  }

  return { equippedTraits, rulesAdded };
}

/**
 * Post-commit hygiene: soft-delete the outgoing trait-layer rule docs the new
 * born-with set replaced — any doc carrying a traitId that is NOT in the new
 * equippedTraits. BEST-EFFORT and NON-FATAL: these docs are already inert (they
 * no longer project), so a failure here can never produce the bad state; it only
 * leaves dead docs for a later census. Manual / agent-learned rules (no traitId)
 * and the freshly-seeded docs (traitId ∈ new set) are untouched. A shared trait's
 * stale doc (traitId still in the new set) is left too but is deduped out by
 * projectActiveRules (newest createdAt wins), so it never projects.
 *
 * @param {FirebaseFirestore.DocumentReference} agentRef - agents/{id}
 * @param {Array<Object>} equippedTraits - the NEW born-with equippedTraits
 * @returns {Promise<number>} count soft-deleted
 */
export async function softDeleteReplacedTraitRuleDocs(agentRef, equippedTraits) {
  const keep = new Set((equippedTraits || []).map((t) => t && t.traitId).filter(Boolean));
  const rulesRef = agentRef.collection('rules');
  const snap = await rulesRef.get();
  let removed = 0;
  for (const d of snap.docs) {
    const data = d.data() || {};
    if (data.traitId && !data.isDeleted && !keep.has(data.traitId)) {
      await rulesRef.doc(d.id).update({ isDeleted: true, updatedAt: FieldValue.serverTimestamp() });
      removed += 1;
    }
  }
  return removed;
}

// Deterministic rule-doc id for a seeded born-with rule. (traitId, sourceRef) is
// unique per born-with spec (a trait's ruleIds are distinct; the set's traitIds
// are distinct), so this is a stable key — a re-run overwrites rather than
// duplicating. Both parts are KB template / trait ids (kebab-case, slash-free),
// so the id is a valid Firestore doc id.
function bornWithRuleDocId(spec) {
  return `bornwith__${spec.traitId}__${spec.sourceRef}`;
}

/**
 * NON-transactional born-with seed for a FRESHLY-PROVISIONED agent (the League
 * training clone, whose provisioning is a sentinel-ordered get-or-create, not a
 * transaction). Creates `archetype`'s born-with rule docs with DETERMINISTIC ids
 * (so an interrupted-and-re-run provision overwrites rather than duplicating —
 * idempotency preserved) and returns the equippedTraits the caller writes onto
 * the agent doc. Deletes NOTHING: the caller sets the doc's equippedTraits to the
 * returned set, so any inherited/copied trait docs whose traitId isn't in it are
 * inert by the projectActiveRules gate (harmless on an ephemeral per-pod clone).
 *
 * @param {FirebaseFirestore.DocumentReference} agentRef - agents/{id} (the clone)
 * @param {string} archetype - archetype CODE-ID
 * @param {Object} [options]
 * @param {string} [options.strength='moderate']
 * @returns {Promise<{ equippedTraits: Array<Object>|null, rulesAdded: number }>}
 */
export async function seedArchetypeTraitsDeterministic(agentRef, archetype, { strength = 'moderate' } = {}) {
  const traitIds = ARCHETYPE_DEFAULT_TRAITS[archetype];
  if (!Array.isArray(traitIds) || traitIds.length === 0) {
    return { equippedTraits: null, rulesAdded: 0 };
  }
  const { ruleSpecs, equippedTraits } = buildSeedPlan(traitIds, strength);
  const rulesRef = agentRef.collection('rules');
  let rulesAdded = 0;
  for (const spec of ruleSpecs) {
    await rulesRef.doc(bornWithRuleDocId(spec)).set(buildSeedRuleDoc(spec));
    rulesAdded += 1;
  }
  return { equippedTraits, rulesAdded };
}
