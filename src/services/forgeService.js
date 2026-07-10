// src/services/forgeService.js
// Forge data layer — Rules and Bundles CRUD for the agent rule system.
// Rules live in agents/{agentId}/rules/, Bundles in agents/{agentId}/bundles/.

import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, orderBy, serverTimestamp, deleteField
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getAgentLevel } from '../constants/agentProgression';
import { FORGE_LIMITS } from '../constants/agentProgression';
import { RULE_COMPAT_MODE } from '../config/featureFlags';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { toEquipError } from './agentService';
// WS1 L1 write-path guard (fence-lite-approved sites: createRule,
// setRuleHardness, updateRule category flip, reforgeBundle carry-forward,
// plus the equipBundle conflict-equip surface). All guard work is gated on
// isRuleCompatActive() so RULE_COMPAT_MODE='off' stays byte-identical —
// zero extra reads, zero classification.
import {
  isRuleCompatActive,
  guardRuleCompatWrite,
  evaluateRuleCompatWrite,
  emitRuleCompatEvents,
} from './ruleCompatGuard';
import { resolveRuleHardness } from '../components/Forge/workshop/hardSoftHelper';

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
  const ruleDoc = {
    text: ruleData.text,
    source: ruleData.source,
    sourceRef: ruleData.sourceRef || null,
    visibility: ruleData.visibility || 'private',
    category: ruleData.category || null,
    params: ruleData.params || null,
    paramValues: ruleData.paramValues || null,
    textTemplate: ruleData.textTemplate || null,
    status: ruleData.status || 'active',
    priority: ruleData.priority || 0,
    traitId: ruleData.traitId || null,
    // Source-tier provenance for the conflict reconciler (tier-1 vs tier-2).
    // null when unstamped — the reconciler treats missing as tier-2 (assumed).
    provenance: ruleData.provenance || null,
    isRefined: false,
    isDeleted: false,
    bundleIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(rulesRef, ruleDoc);
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

  await updateDoc(ruleRef, filtered);
};

/**
 * Soft-delete a rule (sets isDeleted: true).
 * Does NOT remove from bundles — forged bundles keep their snapshots.
 */
export const softDeleteRule = async (agentId, ruleId) => {
  const ruleRef = doc(db, 'agents', agentId, 'rules', ruleId);
  await updateDoc(ruleRef, {
    isDeleted: true,
    updatedAt: serverTimestamp(),
  });
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
    // Phase 3 — authored per-rule hard/soft overrides: { [ruleId]: 'hard'|'soft' }.
    // Empty by default so hard/soft stays category-derived (parity). Consumed by
    // hardSoftHelper (display) and projectActiveRules (the prompt, once fenced).
    ruleHardness: {},
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
  const docRef = await addDoc(bundlesRef, bundleDoc);
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

  await updateDoc(bundleRef, {
    ruleIds: [...bundle.ruleIds, ruleId],
    updatedAt: serverTimestamp(),
  });
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

  await updateDoc(bundleRef, {
    ruleIds: bundle.ruleIds.filter(id => id !== ruleId),
    // Drop any authored hard/soft override for the removed rule so the map
    // never accumulates orphans (and a re-add starts from the category default).
    [`ruleHardness.${ruleId}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
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
 * Only draft bundles are editable (Amendment 3), mirroring add/removeRuleToBundle.
 * The override is consumed by hardSoftHelper (display) and, once the fenced
 * prompt path honors it, projectActiveRules (the real prompt).
 *
 * @param {string} agentId
 * @param {string} bundleId
 * @param {string} ruleId
 * @param {'hard'|'soft'|null} value
 * @param {Object} [opts]
 * @param {string} [opts.archetype] - caller-threaded archetype for the compat guard
 */
export const setRuleHardness = async (agentId, bundleId, ruleId, value, opts = {}) => {
  if (value !== null && value !== 'hard' && value !== 'soft') {
    throw new Error("Rule hardness must be 'hard', 'soft', or null");
  }
  const bundleRef = doc(db, 'agents', agentId, 'bundles', bundleId);
  const bundleSnap = await getDoc(bundleRef);
  if (!bundleSnap.exists()) throw new Error('Bundle not found');
  const bundle = bundleSnap.data();
  if (bundle.status !== 'draft') throw new Error('Can only edit rules on draft bundles');
  if (!(bundle.ruleIds || []).includes(ruleId)) throw new Error('Rule is not in this bundle');

  // WS1 B1 guard — THE explicit promote path. A promote is any write whose
  // RESULTING resolved hardness is 'hard' when the current resolution is not:
  // that includes value === 'hard' AND value === null on a hard-CATEGORY rule
  // (clearing a 'soft' override reverts to the category default 'hard' — the
  // UI sends exactly null when the desired value equals the default, so the
  // Hard toggle on a demoted risk/allocation rule takes the null path).
  // Demote-direction writes ('soft', or clears that resolve soft) never guard.
  if (isRuleCompatActive() && value !== 'soft') {
    const ruleSnap = await getDoc(doc(db, 'agents', agentId, 'rules', ruleId));
    const ruleData = ruleSnap.exists() ? ruleSnap.data() : null;
    const sourceRef = ruleData?.sourceRef || null;
    const prevResolved = resolveRuleHardness({ category: ruleData?.category || null }, (bundle.ruleHardness || {})[ruleId]);
    const newResolved = resolveRuleHardness({ category: ruleData?.category || null }, value ?? undefined);
    if (sourceRef && newResolved === 'hard' && prevResolved !== 'hard') {
      const archetype = await resolveArchetypeForCompat(agentId, opts.archetype);
      await guardRuleCompatWrite({
        archetype,
        templateId: sourceRef,
        resolvedHardness: 'hard',
        path: 'set_rule_hardness',
        agentId,
        ruleDocId: ruleId,
      }); // throws RuleCompatBlockError under enforce
    }
  }

  await updateDoc(bundleRef, {
    [`ruleHardness.${ruleId}`]: value === null ? deleteField() : value,
    updatedAt: serverTimestamp(),
  });
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

  await updateDoc(bundleRef, {
    ruleSnapshots,
    status: 'forged',
    forgedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
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
 * WS1 B3 guard: the carried `ruleHardness` map is a re-write of authored
 * overrides into a new doc. Under `enforce`, 'hard' overrides on core_conflict
 * rules are STRIPPED from the carry (each strip logged + reported back for the
 * inline notice — fence-lite rider 1); under `observe` the carry is unchanged
 * and each would-strip is logged (blocked:false).
 *
 * @param {Object} [opts]
 * @param {string} [opts.archetype] - caller-threaded archetype for the compat guard
 * @returns {{ bundleId: string, strippedConflicts: Array<{templateId: string, ruleDocId: string}> }}
 */
export const reforgeBundle = async (agentId, bundleId, opts = {}) => {
  const bundleRef = doc(db, 'agents', agentId, 'bundles', bundleId);
  const bundleSnap = await getDoc(bundleRef);
  if (!bundleSnap.exists()) throw new Error('Bundle not found');
  const bundle = bundleSnap.data();

  if (bundle.status === 'draft') throw new Error('Cannot reforge a draft bundle — edit it directly');

  // WS1 B3 — evaluate the hard overrides being carried forward. A blocked
  // carry is DEMOTED in the new draft's map, not deleted-blindly: deleting the
  // entry only demotes SOFT-category rules (they revert to the soft category
  // default); a hard-CATEGORY rule must carry an explicit 'soft' or deletion
  // resurrects must-obey via the category fallback.
  const carriedHardness = { ...(bundle.ruleHardness || {}) };
  const strippedConflicts = [];
  const hardOverrideIds = Object.keys(carriedHardness).filter((rid) => carriedHardness[rid] === 'hard');
  if (isRuleCompatActive() && hardOverrideIds.length > 0) {
    const [archetype, ...ruleSnaps] = await Promise.all([
      resolveArchetypeForCompat(agentId, opts.archetype),
      ...hardOverrideIds.map((rid) => getDoc(doc(db, 'agents', agentId, 'rules', rid))),
    ]);
    const events = [];
    hardOverrideIds.forEach((rid, i) => {
      const ruleData = ruleSnaps[i].exists() ? ruleSnaps[i].data() : null;
      const sourceRef = ruleData?.sourceRef || null;
      if (!sourceRef) return;
      const result = evaluateRuleCompatWrite({
        archetype,
        templateId: sourceRef,
        resolvedHardness: 'hard',
        path: 'reforge_carry',
        agentId,
        ruleDocId: rid,
      });
      events.push(...result.events);
      if (result.decision === 'block') {
        // Strip instead of blocking the whole reforge (approved treatment).
        if (resolveRuleHardness({ category: ruleData?.category || null }) === 'hard') {
          carriedHardness[rid] = 'soft'; // hard category: explicit demote
        } else {
          delete carriedHardness[rid];   // soft category: revert to default
        }
        strippedConflicts.push({ templateId: sourceRef, ruleDocId: rid });
      }
    });
    if (events.length > 0) {
      await emitRuleCompatEvents({ agentId, archetype, mode: RULE_COMPAT_MODE, events });
    }
  }

  // If equipped, unequip first
  if (bundle.status === 'equipped') {
    await unequipBundle(agentId, bundleId);
  }

  // Archive old bundle
  await updateDoc(bundleRef, {
    status: 'archived',
    archivedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });

  // Create new draft with same rules, incremented version
  const bundlesRef = collection(db, 'agents', agentId, 'bundles');
  const newBundleDoc = {
    name: bundle.name,
    version: (bundle.version || 1) + 1,
    previousVersionId: bundleId,
    status: 'draft',
    ruleIds: bundle.ruleIds || [],
    // Carry authored hard/soft overrides forward to the reforged draft
    // (minus any enforce-mode conflict strips above).
    ruleHardness: carriedHardness,
    ruleSnapshots: [],   // Draft bundles don't have snapshots (Amendment 3)
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
  const docRef = await addDoc(bundlesRef, newBundleDoc);
  return { bundleId: docRef.id, strippedConflicts };
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

  await updateDoc(bundleRef, {
    status: 'archived',
    archivedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
};
