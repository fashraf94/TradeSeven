// src/services/forgeService.js
// Forge data layer — Rules and Bundles CRUD for the agent rule system.
// Rules live in agents/{agentId}/rules/, Bundles in agents/{agentId}/bundles/.

import { withEpochToken } from './compositionIdentityClient';
import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getAgentLevel } from '../constants/agentProgression';
import { FORGE_LIMITS } from '../constants/agentProgression';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { toEquipError } from './agentService';
// WS1 L1 write-path guard. CLIENT-guarded sites: createRule (A1) and the
// updateRule category flip (B2) — rule-doc writes, gated on
// isRuleCompatActive() so RULE_COMPAT_MODE='off' stays byte-identical (zero
// extra reads, zero classification). The ruleHardness writers (B1
// setRuleHardness, B3 reforgeBundle carry) moved SERVER-side at WS1 enforce
// Phase 2 (set-rule-hardness / reforge-bundle endpoints — the equip-bundle D3
// pattern), where the same kernel gates them; their thin clients live below.
import {
  isRuleCompatActive,
  guardRuleCompatWrite,
} from './ruleCompatGuard';
import { resolveRuleHardness } from '../components/Forge/workshop/hardSoftHelper';
import { buildRuleDocFields } from '../data/ruleDocFields';

// ============================================
// VALIDATION
// ============================================

const VALID_CATEGORIES = ['technical', 'fundamental', 'risk', 'allocation', 'mid_battle', 'game_state', 'threshold', 'tier_strategy'];
const VALID_SOURCES = [
  'forge_discover',       // Rules created from Discover templates
  'forge_custom',         // User-created custom rules
  'discover',             // Legacy/test source
  'manual',               // Manual entry
  'agent_batch_review',   // Agent communication — batch review
  'agent_open_chat',      // Agent communication — open chat
  'agent_debate',         // Agent communication — debate
  'agent_reflection',     // Agent communication — reflection
];
const VALID_VISIBILITIES = ['public', 'private'];
const VALID_STATUSES = ['draft', 'testing', 'active', 'proven', 'queued'];
// Source-tier provenance for the Rule Conflict Reconciler. Stamped at write-time
// (user_equipped = tier-1 deliberate; archetype_default = tier-2 built-in/seeded).
// Missing/null is allowed (legacy rows) and the reconciler defaults it to tier-2.
const VALID_PROVENANCES = ['user_equipped', 'archetype_default'];
const MAX_RULE_TEXT_LENGTH = 1000;
const MAX_PARAMS_KEYS = 5;

function validateRuleInput(ruleData) {
  const errors = [];

  if (!ruleData.text || typeof ruleData.text !== 'string') {
    errors.push('Rule text is required and must be a string');
  } else if (ruleData.text.trim().length === 0) {
    errors.push('Rule text cannot be empty');
  } else if (ruleData.text.length > MAX_RULE_TEXT_LENGTH) {
    errors.push(`Rule text must be ${MAX_RULE_TEXT_LENGTH} characters or less`);
  }

  if (ruleData.category && !VALID_CATEGORIES.includes(ruleData.category)) {
    errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (ruleData.source && !VALID_SOURCES.includes(ruleData.source)) {
    errors.push(`Source must be one of: ${VALID_SOURCES.join(', ')}`);
  }

  if (ruleData.visibility && !VALID_VISIBILITIES.includes(ruleData.visibility)) {
    errors.push(`Visibility must be one of: ${VALID_VISIBILITIES.join(', ')}`);
  }

  if (ruleData.params && typeof ruleData.params === 'object') {
    if (Object.keys(ruleData.params).length > MAX_PARAMS_KEYS) {
      errors.push(`Params must have ${MAX_PARAMS_KEYS} or fewer keys`);
    }
  }

  // Validate paramValues: plain object, max 5 keys, values must be string/number/boolean, strings max 50 chars
  if (ruleData.paramValues != null) {
    if (typeof ruleData.paramValues !== 'object' || Array.isArray(ruleData.paramValues)) {
      errors.push('paramValues must be a plain object');
    } else {
      const pvKeys = Object.keys(ruleData.paramValues);
      if (pvKeys.length > MAX_PARAMS_KEYS) {
        errors.push(`paramValues must have ${MAX_PARAMS_KEYS} or fewer keys`);
      }
      for (const k of pvKeys) {
        const v = ruleData.paramValues[k];
        const t = typeof v;
        if (t !== 'string' && t !== 'number' && t !== 'boolean') {
          errors.push(`paramValues.${k} must be a string, number, or boolean`);
        }
        if (t === 'string' && v.length > 50) {
          errors.push(`paramValues.${k} must be 50 characters or less`);
        }
      }
    }
  }

  // Validate textTemplate: string, max 500 chars
  if (ruleData.textTemplate != null) {
    if (typeof ruleData.textTemplate !== 'string') {
      errors.push('textTemplate must be a string');
    } else if (ruleData.textTemplate.length > 500) {
      errors.push('textTemplate must be 500 characters or less');
    }
  }

  // Validate status: must be one of VALID_STATUSES if provided
  if (ruleData.status != null && !VALID_STATUSES.includes(ruleData.status)) {
    errors.push(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  // Validate priority: must be a number if provided
  if (ruleData.priority != null && typeof ruleData.priority !== 'number') {
    errors.push('Priority must be a number');
  }

  // Validate traitId: must be a string or null if provided
  if (ruleData.traitId != null && typeof ruleData.traitId !== 'string') {
    errors.push('traitId must be a string or null');
  }

  // Validate provenance: one of the allowed source-tier values, or null/absent
  if (ruleData.provenance != null && !VALID_PROVENANCES.includes(ruleData.provenance)) {
    errors.push(`Provenance must be one of: ${VALID_PROVENANCES.join(', ')}`);
  }

  return errors;
}

// ============================================
// RULES CRUD
// ============================================

// Resolve the agent's archetype for a compat check: prefer the value threaded
// by the caller (fence-lite rider: batch flows pass it so the guard never does
// per-rule reads); fall back to ONE agent-doc read. Only called when the guard
// is active. null (unknown agent/archetype) fails open to 'neutral' downstream.
// Exported so UI pre-checks (useTraits, StarterKit) share the exact resolution.
export async function resolveArchetypeForCompat(agentId, threadedArchetype) {
  if (threadedArchetype) return threadedArchetype;
  try {
    const agentSnap = await getDoc(doc(db, 'agents', agentId));
    return agentSnap.exists() ? (agentSnap.data().archetype || null) : null;
  } catch (err) {
    console.error('[forgeService] compat archetype read failed (failing open):', err);
    return null;
  }
}

/**
 * Create a new rule in the agent's rules subcollection.
 * @param {string} agentId
 * @param {Object} ruleData - { text, source, sourceRef?, visibility?, category?, params? }
 * @param {Object} [opts]
 * @param {string} [opts.archetype] - caller-threaded archetype for the compat
 *   guard (avoids the fallback agent read; see resolveArchetypeForCompat)
 * @returns {string} The new rule document ID
 */
export const createRule = async (agentId, ruleData, opts = {}) => {
  const errors = validateRuleInput(ruleData);
  if (errors.length > 0) {
    throw new Error(`Invalid rule: ${errors.join('; ')}`);
  }

  // WS1 A1 guard — create-as-hard block + conflict-equip logging. Template-
  // derived rules only (sourceRef); manual free-text rules are outside the map.
  if (isRuleCompatActive() && ruleData.sourceRef) {
    const archetype = await resolveArchetypeForCompat(agentId, opts.archetype);
    await guardRuleCompatWrite({
      archetype,
      templateId: ruleData.sourceRef,
      resolvedHardness: resolveRuleHardness({ category: ruleData.category || null }),
      path: 'create_rule',
      agentId,
    }); // throws RuleCompatBlockError under enforce for hard-category conflicts
  }

  const rulesRef = collection(db, 'agents', agentId, 'rules');
  // Field shape comes from the ONE shared definition (src/data/ruleDocFields.js)
  // so the client and the archetype-seeder rule docs cannot drift; only the
  // client-SDK timestamps are stamped here. (provenance carries the reconciler
  // source-tier: null → treated as tier-2/assumed.)
  const ruleDoc = {
    ...buildRuleDocFields(ruleData),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(rulesRef, await withEpochToken(ruleDoc)); // #1: epoch-bound identity write
  return docRef.id;
};

/**
 * Get all non-deleted rules for an agent.
 * @param {string} agentId
 * @param {Object} [options]
 * @param {boolean} [options.includeDeleted=false]
 * @returns {Object[]} Array of rule objects with id
 */
export const getRules = async (agentId, { includeDeleted = false } = {}) => {
  const rulesRef = collection(db, 'agents', agentId, 'rules');
  const q = query(rulesRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  const rules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if (includeDeleted) return rules;
  return rules.filter(r => !r.isDeleted);
};

/**
 * Update specific fields on a rule document.
 * @param {string} agentId
 * @param {string} ruleId
 * @param {Object} updates - Allowed: text, category, visibility, params, isRefined
 * @param {Object} [opts]
 * @param {string} [opts.archetype] - caller-threaded archetype for the compat guard
 */
export const updateRule = async (agentId, ruleId, updates, opts = {}) => {
  // Validate fields being updated
  if (updates.text !== undefined) {
    if (typeof updates.text !== 'string' || updates.text.trim().length === 0) {
      throw new Error('Rule text must be a non-empty string');
    }
    if (updates.text.length > MAX_RULE_TEXT_LENGTH) {
      throw new Error(`Rule text must be ${MAX_RULE_TEXT_LENGTH} characters or less`);
    }
  }
  if (updates.category !== undefined && updates.category !== null && !VALID_CATEGORIES.includes(updates.category)) {
    throw new Error(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }
  if (updates.visibility !== undefined && !VALID_VISIBILITIES.includes(updates.visibility)) {
    throw new Error(`Visibility must be one of: ${VALID_VISIBILITIES.join(', ')}`);
  }
  if (updates.paramValues != null) {
    if (typeof updates.paramValues !== 'object' || Array.isArray(updates.paramValues)) {
      throw new Error('paramValues must be a plain object');
    }
    const pvKeys = Object.keys(updates.paramValues);
    if (pvKeys.length > MAX_PARAMS_KEYS) {
      throw new Error(`paramValues must have ${MAX_PARAMS_KEYS} or fewer keys`);
    }
    for (const k of pvKeys) {
      const v = updates.paramValues[k];
      const t = typeof v;
      if (t !== 'string' && t !== 'number' && t !== 'boolean') {
        throw new Error(`paramValues.${k} must be a string, number, or boolean`);
      }
      if (t === 'string' && v.length > 50) {
        throw new Error(`paramValues.${k} must be 50 characters or less`);
      }
    }
  }
  if (updates.textTemplate !== undefined && updates.textTemplate !== null) {
    if (typeof updates.textTemplate !== 'string') {
      throw new Error('textTemplate must be a string');
    }
    if (updates.textTemplate.length > 500) {
      throw new Error('textTemplate must be 500 characters or less');
    }
  }
  if (updates.status !== undefined && updates.status !== null && !VALID_STATUSES.includes(updates.status)) {
    throw new Error(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (updates.priority !== undefined && updates.priority !== null && typeof updates.priority !== 'number') {
    throw new Error('Priority must be a number');
  }
  if (updates.traitId !== undefined && updates.traitId !== null && typeof updates.traitId !== 'string') {
    throw new Error('traitId must be a string or null');
  }

  const allowed = ['text', 'category', 'visibility', 'params', 'isRefined', 'paramValues', 'textTemplate', 'status', 'priority', 'traitId'];
  const filtered = {};
  for (const key of allowed) {
    if (key in updates) filtered[key] = updates[key];
  }
  filtered.updatedAt = serverTimestamp();
  const ruleRef = doc(db, 'agents', agentId, 'rules', ruleId);

  // WS1 B2 guard — a category FLIP that lands must-obey (risk/allocation) is a
  // promote path. Guarded only when the category actually transitions
  // soft→hard: an update that re-sends an unchanged hard category (the refine
  // flow always sends { text, category }) is not a promotion and must pass.
  if (
    isRuleCompatActive() &&
    'category' in filtered &&
    resolveRuleHardness({ category: filtered.category || null }) === 'hard'
  ) {
    const ruleSnap = await getDoc(ruleRef);
    const prev = ruleSnap.exists() ? ruleSnap.data() : null;
    const sourceRef = prev?.sourceRef || null;
    const prevCategoryHard = resolveRuleHardness({ category: prev?.category || null }) === 'hard';
    if (sourceRef && !prevCategoryHard) {
      const archetype = await resolveArchetypeForCompat(agentId, opts.archetype);
      await guardRuleCompatWrite({
        archetype,
        templateId: sourceRef,
        resolvedHardness: 'hard',
        path: 'update_rule_category',
        agentId,
        ruleDocId: ruleId,
      }); // throws RuleCompatBlockError under enforce
    }
  }

  await updateDoc(ruleRef, await withEpochToken(filtered)); // #1: epoch-bound identity write
};

/**
 * Soft-delete a rule (sets isDeleted: true).
 * Does NOT remove from bundles — forged bundles keep their snapshots.
 */
export const softDeleteRule = async (agentId, ruleId) => {
  const ruleRef = doc(db, 'agents', agentId, 'rules', ruleId);
  await updateDoc(ruleRef, await withEpochToken({
    isDeleted: true,
    updatedAt: serverTimestamp(),
  })); // #1: epoch-bound identity write
};

// ============================================
// BUNDLES CRUD
// ============================================

/**
 * Create a new draft bundle.
 * @param {string} agentId
 * @param {Object} bundleData - { name }
 * @returns {string} The new bundle document ID
 */
export const createBundle = async (agentId, bundleData) => {
  const bundlesRef = collection(db, 'agents', agentId, 'bundles');
  const bundleDoc = {
    name: bundleData.name,
    version: 1,
    previousVersionId: null,
    status: 'draft',
    ruleIds: [],
    // ruleHardness (the authored per-rule hard/soft override map) is
    // deliberately ABSENT since WS1 enforce Phase 2: the field is
    // server-mintable only (set-rule-hardness / reforge-bundle endpoints;
    // client writes are denied by the bundles field allowlist), and every
    // consumer treats a missing map as empty (projectActiveRules:78,
    // hardSoftHelper.bundleRuleHardness), so omitting it is behavior-identical.
    ruleSnapshots: [],
    conflictCheckResult: null,
    createdAt: serverTimestamp(),
    forgedAt: null,
    equippedAt: null,
    archivedAt: null,
    performanceData: {
      battlesEquipped: 0,
      totalCitations: 0,
      successfulCitations: 0,
    },
  };
  const docRef = await addDoc(bundlesRef, await withEpochToken(bundleDoc)); // #1: epoch-bound identity write
  return docRef.id;
};

/**
 * Add a rule to a draft bundle. Only modifies ruleIds (Amendment 3).
 * Validates rule count against progression level limits (Amendment 4).
 * @param {string} agentId
 * @param {string} bundleId
 * @param {string} ruleId
 */
export const addRuleToBundle = async (agentId, bundleId, ruleId) => {
  const bundleRef = doc(db, 'agents', agentId, 'bundles', bundleId);
  const bundleSnap = await getDoc(bundleRef);
  if (!bundleSnap.exists()) throw new Error('Bundle not found');
  const bundle = bundleSnap.data();
  if (bundle.status !== 'draft') throw new Error('Can only add rules to draft bundles');
  if (bundle.ruleIds.includes(ruleId)) throw new Error('Rule already in bundle');

  // Amendment 4: Check rule count against level limit
  const agentRef = doc(db, 'agents', agentId);
  const agentSnap = await getDoc(agentRef);
  const agentData = agentSnap.data();
  const level = getAgentLevel(agentData?.stats?.gamesPlayed || 0);
  const limits = FORGE_LIMITS[level];
  if (bundle.ruleIds.length >= limits.maxRulesPerBundle) {
    throw new Error(`Rule limit reached (${limits.maxRulesPerBundle} rules for ${level} level). Level up by playing more games to increase the limit.`);
  }

  // Verify rule exists and is not deleted
  const ruleRef = doc(db, 'agents', agentId, 'rules', ruleId);
  const ruleSnap = await getDoc(ruleRef);
  if (!ruleSnap.exists()) throw new Error('Rule not found');
  if (ruleSnap.data().isDeleted) throw new Error('Cannot add a deleted rule to a bundle');

  await updateDoc(bundleRef, await withEpochToken({
    ruleIds: [...bundle.ruleIds, ruleId],
    updatedAt: serverTimestamp(),
  })); // #1: epoch-bound identity write
};

/**
 * Remove a rule from a draft bundle. Only modifies ruleIds (Amendment 3).
 */
export const removeRuleFromBundle = async (agentId, bundleId, ruleId) => {
  const bundleRef = doc(db, 'agents', agentId, 'bundles', bundleId);
  const bundleSnap = await getDoc(bundleRef);
  if (!bundleSnap.exists()) throw new Error('Bundle not found');
  const bundle = bundleSnap.data();
  if (bundle.status !== 'draft') throw new Error('Can only remove rules from draft bundles');

  await updateDoc(bundleRef, await withEpochToken({
    ruleIds: bundle.ruleIds.filter(id => id !== ruleId),
    // NOTE (WS1 enforce Phase 2): the old client-side prune of the removed
    // rule's ruleHardness entry is GONE — ruleHardness is server-mintable only
    // (the bundles field allowlist denies client writes to it). The orphaned
    // entry is harmless at rest: the projection and every display read
    // overrides only for ruleIds still listed on the bundle. A re-add resumes
    // the prior authored override rather than the category default; any
    // future tidy-up belongs to the server writers.
    updatedAt: serverTimestamp(),
  })); // #1: epoch-bound identity write
};

/**
 * Author a per-rule hard/soft override on a draft bundle (Phase 3).
 *
 * Sets bundle.ruleHardness[ruleId]. Pass 'hard' | 'soft' to store an explicit
 * override, or null to CLEAR it (revert that rule to its category-derived
 * default). Callers should clear (null) when the chosen value equals the
 * category default, so a bundle with no genuine overrides keeps an empty map —
 * that is what makes the assembled prompt byte-identical to today until a user
 * explicitly authors a value.
 *
 * Server-side since WS1 enforce Phase 2 (the equip-bundle D3 pattern): the
 * write moved to POST /api/agent/set-rule-hardness — one Admin-SDK transaction
 * enforcing ownership + draft-only + rule-in-bundle server-side and running
 * the WS1 B1 promote gate with the same kernel this client used
 * (ruleCompatEvaluate; observe logs, enforce blocks with a 409 whose message
 * is the old RuleCompatBlockError copy). bundles.ruleHardness is
 * server-mintable only — the bundles field allowlist denies client writes.
 * This thin client preserves the prior throw-message behavior (callers
 * surface err.message via toast). The old opts.archetype threading is gone:
 * the server resolves the agent's REAL archetype in-transaction.
 *
 * @param {string} agentId
 * @param {string} bundleId
 * @param {string} ruleId
 * @param {'hard'|'soft'|null} value
 */
export const setRuleHardness = async (agentId, bundleId, ruleId, value) => {
  if (value !== null && value !== 'hard' && value !== 'soft') {
    throw new Error("Rule hardness must be 'hard', 'soft', or null");
  }
  const response = await fetchWithAuth('/api/agent/set-rule-hardness', {
    method: 'POST',
    body: JSON.stringify({ agentId, bundleId, ruleId, value }),
  });
  if (!response.ok) throw await toEquipError(response);
};

/**
 * Forge a bundle — freeze rule snapshots from live data (Amendment 2 & 3).
 * Reads all rules referenced by ruleIds, builds ruleSnapshots with category.
 * Changes status from 'draft' to 'forged'.
 */
export const forgeBundle = async (agentId, bundleId) => {
  const bundleRef = doc(db, 'agents', agentId, 'bundles', bundleId);
  const bundleSnap = await getDoc(bundleRef);
  if (!bundleSnap.exists()) throw new Error('Bundle not found');
  const bundle = bundleSnap.data();
  if (bundle.status !== 'draft') throw new Error('Can only forge draft bundles');
  if (bundle.ruleIds.length === 0) throw new Error('Cannot forge an empty bundle');

  // Read all rules to build frozen snapshots
  const ruleSnapshots = [];
  for (const ruleId of bundle.ruleIds) {
    const ruleRef = doc(db, 'agents', agentId, 'rules', ruleId);
    const ruleSnap = await getDoc(ruleRef);
    if (!ruleSnap.exists()) continue;
    const rule = ruleSnap.data();
    if (rule.isDeleted) continue;
    ruleSnapshots.push({
      id: ruleId,
      text: rule.text,
      textTemplate: rule.textTemplate || null,
      params: rule.params || null,
      paramValues: rule.paramValues || null,
      category: rule.category,     // MUST be present — prompt assembly depends on this (Amendment 2)
      visibility: rule.visibility,
      // Carried for the conflict reconciler: sourceRef keys the descriptor table,
      // provenance carries the source tier. Pre-reconciler bundles lack these and
      // the reconciler degrades them to unchecked / tier-2-assumed (no false flags).
      sourceRef: rule.sourceRef || null,
      provenance: rule.provenance || null,
    });
  }

  if (ruleSnapshots.length === 0) {
    throw new Error('No valid (non-deleted) rules to forge');
  }

  await updateDoc(bundleRef, await withEpochToken({
    ruleSnapshots,
    status: 'forged',
    forgedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  })); // #1: epoch-bound identity write
};

/**
 * Equip a forged bundle on the agent.
 *
 * Release 2 (settingsRev migration, founder ruling D3 2026-07-10): the V1
 * client-side read-check-write (the SECURITY NOTE here used to promise this
 * exact migration) moved to POST /api/agent/equip-bundle — one Admin-SDK
 * transaction enforcing ownership + the battle-lock server-side, bumping
 * agent.settingsRev, and emitting the WS1 conflict-equip events. This thin
 * client preserves the prior return contract
 * ({ conflictCheckResult, compatConflicts, archetype }) and throw-message
 * behavior (callers surface err.message strings).
 */
export const equipBundle = async (agentId, bundleId) => {
  const response = await fetchWithAuth('/api/agent/equip-bundle', {
    method: 'POST',
    body: JSON.stringify({ agentId, bundleId }),
  });
  // The shared equip-endpoint error shape (message + status + code) — the
  // same mapper every /api/agent/* thin client uses.
  if (!response.ok) throw await toEquipError(response);
  const data = await response.json().catch(() => ({}));
  return {
    conflictCheckResult: data.conflictCheckResult ?? null,
    compatConflicts: data.compatConflicts ?? [],
    archetype: data.archetype ?? null,
  };
};

/**
 * Unequip a bundle — revert to forged status and rebuild activeRules.
 * Server-side since the Release 2 settingsRev migration (see equipBundle).
 * Deliberately keeps the historical no-battle-lock semantics (reforge
 * unequips as a sub-step); the server endpoint preserves that.
 */
export const unequipBundle = async (agentId, bundleId) => {
  const response = await fetchWithAuth('/api/agent/unequip-bundle', {
    method: 'POST',
    body: JSON.stringify({ agentId, bundleId }),
  });
  if (!response.ok) throw await toEquipError(response);
};

/**
 * Reforge a bundle — archive old version and create a new draft from its rules.
 *
 * Server-side since WS1 enforce Phase 2 (the equip/unequip D3 pattern): the
 * whole reforge moved to POST /api/agent/reforge-bundle — one Admin-SDK
 * transaction running the WS1 B3 carry gate server-side (under `enforce`,
 * 'hard' overrides on core_conflict rules are STRIPPED from the carry, each
 * strip logged + reported back for the inline notice — fence-lite rider 1;
 * under `observe` the carry is unchanged and each would-strip is logged
 * blocked:false), unequipping as a sub-step when equipped (historical
 * no-battle-lock semantics preserved), archiving the old version, and
 * creating the new draft with the carried map. bundles.ruleHardness is
 * server-mintable only — the bundles field allowlist denies client writes,
 * which is why the carry (a ruleHardness re-write) had to move with it.
 * This thin client preserves the prior return contract and throw-message
 * behavior. The old opts.archetype threading is gone: the server resolves
 * the agent's REAL archetype in-transaction.
 *
 * @returns {{ bundleId: string, strippedConflicts: Array<{templateId: string, ruleDocId: string}> }}
 */
export const reforgeBundle = async (agentId, bundleId) => {
  const response = await fetchWithAuth('/api/agent/reforge-bundle', {
    method: 'POST',
    body: JSON.stringify({ agentId, bundleId }),
  });
  if (!response.ok) throw await toEquipError(response);
  const data = await response.json().catch(() => ({}));
  return {
    bundleId: data.bundleId ?? null,
    strippedConflicts: data.strippedConflicts ?? [],
  };
};

/**
 * Archive a bundle. If equipped, also cleans up activeRules on the agent.
 */
export const archiveBundle = async (agentId, bundleId) => {
  const bundleRef = doc(db, 'agents', agentId, 'bundles', bundleId);
  const bundleSnap = await getDoc(bundleRef);
  if (!bundleSnap.exists()) throw new Error('Bundle not found');
  const bundle = bundleSnap.data();

  if (bundle.status === 'archived') throw new Error('Bundle is already archived');

  // If equipped, unequip first to rebuild activeRules
  if (bundle.status === 'equipped') {
    await unequipBundle(agentId, bundleId);
  }

  await updateDoc(bundleRef, await withEpochToken({
    status: 'archived',
    archivedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  })); // #1: epoch-bound identity write
};
