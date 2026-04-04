// src/services/forgeService.js
// Forge data layer — Rules and Bundles CRUD for the agent rule system.
// Rules live in agents/{agentId}/rules/, Bundles in agents/{agentId}/bundles/.

import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, orderBy, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getAgentLevel } from '../constants/agentProgression';
import { FORGE_LIMITS } from '../constants/agentProgression';

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
const MAX_RULE_TEXT_LENGTH = 200;
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

  return errors;
}

// ============================================
// RULES CRUD
// ============================================

/**
 * Create a new rule in the agent's rules subcollection.
 * @param {string} agentId
 * @param {Object} ruleData - { text, source, sourceRef?, visibility?, category?, params? }
 * @returns {string} The new rule document ID
 */
export const createRule = async (agentId, ruleData) => {
  const errors = validateRuleInput(ruleData);
  if (errors.length > 0) {
    throw new Error(`Invalid rule: ${errors.join('; ')}`);
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
 */
export const updateRule = async (agentId, ruleId, updates) => {
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

  const allowed = ['text', 'category', 'visibility', 'params', 'isRefined', 'paramValues', 'textTemplate'];
  const filtered = {};
  for (const key of allowed) {
    if (key in updates) filtered[key] = updates[key];
  }
  filtered.updatedAt = serverTimestamp();
  const ruleRef = doc(db, 'agents', agentId, 'rules', ruleId);
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
 * SECURITY NOTE (V1): This function runs client-side using the Firebase JS SDK.
 * The battle-active check uses the agent's activeBattleId field (also enforced
 * in the UI by MyBundlesTab). For V1 with trusted beta users this is acceptable.
 * Before public launch, migrate this to a server-side Cloud Function or API
 * endpoint using Admin SDK to enforce the check server-side.
 */
export const equipBundle = async (agentId, bundleId) => {
  // 1. Read agent doc for current equip state, progression level, and battle check
  const agentRef = doc(db, 'agents', agentId);
  const agentSnap = await getDoc(agentRef);
  if (!agentSnap.exists()) throw new Error('Agent not found');
  const agentData = agentSnap.data();

  // Check no active battle (mirrors MyBundlesTab UI guard)
  if (agentData.activeBattleId) {
    throw new Error('Cannot equip bundle while agent has an active battle. Wait for the battle to complete.');
  }

  // 2. Read bundle and validate status
  const bundleRef = doc(db, 'agents', agentId, 'bundles', bundleId);
  const bundleSnap = await getDoc(bundleRef);
  if (!bundleSnap.exists()) throw new Error('Bundle not found');
  const bundle = bundleSnap.data();
  if (bundle.status !== 'forged') throw new Error('Bundle must be forged before equipping');

  const currentEquipped = agentData?.equippedBundleIds || [];

  // Amendment 4: Check equipped bundle limit against progression level
  const level = getAgentLevel(agentData?.stats?.gamesPlayed || 0);
  const limits = FORGE_LIMITS[level];
  if (currentEquipped.length >= limits.maxBundles) {
    throw new Error(
      `Bundle limit reached for your agent's level (${limits.maxBundles} bundles at ${level}). Unequip a bundle first or level up by playing more games.`
    );
  }

  // 4. Gather rule snapshots from all equipped bundles + this one
  const allSnapshots = [];
  for (const eid of currentEquipped) {
    const eSnap = await getDoc(doc(db, 'agents', agentId, 'bundles', eid));
    if (eSnap.exists()) {
      const eData = eSnap.data();
      allSnapshots.push(...(eData.ruleSnapshots || []).map(r => ({
        ...r, bundleName: eData.name,
      })));
    }
  }
  allSnapshots.push(...(bundle.ruleSnapshots || []).map(r => ({
    ...r, bundleName: bundle.name,
  })));

  // 5. Build activeRules array
  const activeRules = allSnapshots.map(snap => ({
    ruleId: snap.id,
    text: snap.text,
    textTemplate: snap.textTemplate || null,
    params: snap.params || null,
    paramValues: snap.paramValues || null,
    category: snap.category || null,
    bundleName: snap.bundleName,
  }));

  // 6. Batch write: update bundle status + agent doc
  const batch = writeBatch(db);
  batch.update(bundleRef, {
    status: 'equipped',
    equippedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
  batch.update(agentRef, {
    equippedBundleIds: [...currentEquipped, bundleId],
    activeRules,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
};

/**
 * Unequip a bundle — revert to forged status and rebuild activeRules.
 */
export const unequipBundle = async (agentId, bundleId) => {
  const bundleRef = doc(db, 'agents', agentId, 'bundles', bundleId);
  const bundleSnap = await getDoc(bundleRef);
  if (!bundleSnap.exists()) throw new Error('Bundle not found');
  const bundle = bundleSnap.data();
  if (bundle.status !== 'equipped') throw new Error('Bundle is not equipped');

  const agentRef = doc(db, 'agents', agentId);
  const agentSnap = await getDoc(agentRef);
  const agentData = agentSnap.data();
  const remainingIds = (agentData?.equippedBundleIds || []).filter(id => id !== bundleId);

  // Rebuild activeRules from remaining equipped bundles
  const allSnapshots = [];
  for (const eid of remainingIds) {
    const eSnap = await getDoc(doc(db, 'agents', agentId, 'bundles', eid));
    if (eSnap.exists()) {
      const eData = eSnap.data();
      allSnapshots.push(...(eData.ruleSnapshots || []).map(r => ({
        ...r, bundleName: eData.name,
      })));
    }
  }

  const activeRules = allSnapshots.map(snap => ({
    ruleId: snap.id,
    text: snap.text,
    textTemplate: snap.textTemplate || null,
    params: snap.params || null,
    paramValues: snap.paramValues || null,
    category: snap.category || null,
    bundleName: snap.bundleName,
  }));

  const batch = writeBatch(db);
  batch.update(bundleRef, {
    status: 'forged',
    equippedAt: null,
    updatedAt: serverTimestamp(),
  });
  batch.update(agentRef, {
    equippedBundleIds: remainingIds,
    activeRules,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
};

/**
 * Reforge a bundle — archive old version and create a new draft from its rules.
 * @returns {string} New bundle document ID
 */
export const reforgeBundle = async (agentId, bundleId) => {
  const bundleRef = doc(db, 'agents', agentId, 'bundles', bundleId);
  const bundleSnap = await getDoc(bundleRef);
  if (!bundleSnap.exists()) throw new Error('Bundle not found');
  const bundle = bundleSnap.data();

  if (bundle.status === 'draft') throw new Error('Cannot reforge a draft bundle — edit it directly');

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
  return docRef.id;
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
