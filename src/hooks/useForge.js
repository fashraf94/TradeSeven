// src/hooks/useForge.js
// Manages Forge state: tabs, category filter, expanded card, rules, bundles,
// and all CRUD actions (add, refine, delete, forge, equip, unequip, reforge).

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, query, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FORGE_RULE_TEMPLATES, FORGE_CATEGORIES } from '../data/forgeKnowledgeBase';
import { FORGE_COLLECTIONS } from '../data/forgeCollections';
import {
  createRule,
  createBundle,
  addRuleToBundle as addRuleToBundleSvc,
  removeRuleFromBundle as removeRuleFromBundleSvc,
  setRuleHardness as setRuleHardnessSvc,
  getRules,
  updateRule,
  softDeleteRule,
  forgeBundle as forgeBundleSvc,
  equipBundle as equipBundleSvc,
  unequipBundle as unequipBundleSvc,
  reforgeBundle as reforgeBundleSvc,
  archiveBundle as archiveBundleSvc,
} from '../services/forgeService';
import { computeForgeStats } from '../services/forgeStatsService';
import { buildEquipWarning } from '../utils/conflictSurfaceCopy';

// Pre-compute total available rules per category for radar proportional fill
const categoryTotals = {};
FORGE_RULE_TEMPLATES.forEach(r => {
  const cat = r.forgeTemplates?.[0]?.category || r.category;
  if (cat) categoryTotals[cat] = (categoryTotals[cat] || 0) + 1;
});

// Category group mappings (kept for reference but no longer used in UI toggle)
const STRATEGY_CATEGORIES = ['technical', 'fundamental', 'threshold', 'tier_strategy'];
const CONTROLS_CATEGORIES = ['risk', 'allocation', 'mid_battle', 'game_state'];

// Display order for all 13 categories — universal first, clash next, season last.
// Universal categories apply to both modes; clash/season categories are mode-scoped.
export const CATEGORY_ORDER = [
  // Universal (both modes)
  'technical', 'fundamental', 'risk', 'allocation', 'institutional',
  // Clash-only
  'mid_battle', 'game_state', 'threshold', 'tier_strategy',
  // Season-only
  'entry_criteria', 'exit_stops', 'rebalancing', 'season_state',
];

// Helper to read persisted forge UI state from localStorage
function loadPersistedState(agentId) {
  if (!agentId) return null;
  try {
    const raw = localStorage.getItem(`forge_state_${agentId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      expandedAccordions: new Set(parsed.expandedAccordions || []),
    };
  } catch {
    return null;
  }
}

function savePersistedState(agentId, expandedAccordions) {
  if (!agentId) return;
  try {
    localStorage.setItem(`forge_state_${agentId}`, JSON.stringify({
      expandedAccordions: [...expandedAccordions],
    }));
  } catch { /* ignore quota errors */ }
}

export function useForge(agentId) {
  const [activeTab, setActiveTab] = useState('forge');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [rules, setRules] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [addingRuleId, setAddingRuleId] = useState(null);

  // Mech Bay state — accordion expansion
  const [expandedAccordions, setExpandedAccordions] = useState(new Set());
  const persistedInit = useRef(false);

  // Stats state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [archivedBundles, setArchivedBundles] = useState([]);

  // UI state for My Rules / My Bundles
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [showRulePicker, setShowRulePicker] = useState(null); // bundleId or null
  const [forgingBundleId, setForgingBundleId] = useState(null);
  const [equippingBundleId, setEquippingBundleId] = useState(null);

  // Restore persisted UI state on mount
  useEffect(() => {
    if (!agentId || persistedInit.current) return;
    const saved = loadPersistedState(agentId);
    if (saved) {
      setExpandedAccordions(saved.expandedAccordions);
    } else {
      // Default: first category expanded
      setExpandedAccordions(new Set([CATEGORY_ORDER[0]]));
    }
    persistedInit.current = true;
  }, [agentId]);

  const toggleAccordion = useCallback((categoryId) => {
    setExpandedAccordions(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      if (agentId) savePersistedState(agentId, next);
      return next;
    });
  }, [agentId]);

  // Show toast with auto-dismiss
  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Load user's rules and bundles from Firestore
  const loadData = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const agentRules = await getRules(agentId);
      const bundlesRef = collection(db, 'agents', agentId, 'bundles');
      const bundlesQ = query(bundlesRef, orderBy('createdAt', 'desc'));
      const bundlesSnap = await getDocs(bundlesQ);
      const agentBundles = bundlesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(b => b.status !== 'archived' && !b.hiddenFromBundleList);
      setRules(agentRules);
      setBundles(agentBundles);
    } catch (err) {
      console.error('[useForge] Failed to load forge data:', err);
      if (err.code === 'permission-denied') {
        showToast('Permission denied loading rules. Try signing out and back in.');
      } else {
        showToast('Failed to load forge data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [agentId, showToast]);

  // Load on mount / agentId change
  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    const doLoad = async () => {
      setLoading(true);
      try {
        const agentRules = await getRules(agentId);
        const bundlesRef = collection(db, 'agents', agentId, 'bundles');
        const bundlesQ = query(bundlesRef, orderBy('createdAt', 'desc'));
        const bundlesSnap = await getDocs(bundlesQ);
        const agentBundles = bundlesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(b => b.status !== 'archived' && !b.hiddenFromBundleList);
        if (!cancelled) {
          setRules(agentRules);
          setBundles(agentBundles);
        }
      } catch (err) {
        console.error('[useForge] Failed to load forge data:', err);
        if (!cancelled) {
          if (err.code === 'permission-denied') {
            showToast('Permission denied loading rules. Try signing out and back in.');
          } else {
            showToast('Failed to load forge data. Please try again.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    doLoad();
    return () => { cancelled = true; };
  }, [agentId, showToast]);

  // Load stats from battle citation data (on-demand)
  const loadStats = useCallback(async () => {
    if (!agentId) return;
    setStatsLoading(true);
    try {
      // Fetch ALL bundles including archived (main loadData filters them out).
      // Ephemeral dimension-sourced bundles (hiddenFromBundleList) are excluded
      // from stats + archive views so they don't pollute Forge analytics or the
      // 5-bundle creation limit (see Phase 3 audit).
      const bundlesRef = collection(db, 'agents', agentId, 'bundles');
      const bundlesQ = query(bundlesRef, orderBy('createdAt', 'desc'));
      const bundlesSnap = await getDocs(bundlesQ);
      const allBundles = bundlesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(b => !b.hiddenFromBundleList);
      setArchivedBundles(allBundles.filter(b => b.status === 'archived'));

      const result = await computeForgeStats(agentId, allBundles);
      setStats(result);
    } catch (err) {
      console.error('[useForge] Failed to load stats:', err);
      showToast('Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  }, [agentId, showToast]);

  // Lazy-load stats when Proving Grounds tab is first visited
  useEffect(() => {
    if (activeTab === 'provingGrounds' && stats === null && !statsLoading) {
      loadStats();
    }
  }, [activeTab, stats, statsLoading, loadStats]);

  // Filter templates by selected category
  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') return FORGE_RULE_TEMPLATES;
    return FORGE_RULE_TEMPLATES.filter(t => t.category === selectedCategory);
  }, [selectedCategory]);

  // All 92 templates grouped by category for flat accordion display
  const templatesByCategory = useMemo(() => {
    const map = {};
    CATEGORY_ORDER.forEach(catId => { map[catId] = []; });
    FORGE_RULE_TEMPLATES.forEach(t => {
      if (map[t.category]) map[t.category].push(t);
    });
    return map;
  }, []);

  // Pre-compute collection data with resolved rules and category colors
  const collectionData = useMemo(() => {
    return FORGE_COLLECTIONS.map(collection => {
      const ids = collection.ruleIds || [];
      const resolvedRules = ids
        .map(id => FORGE_RULE_TEMPLATES.find(t => t.id === id))
        .filter(Boolean);
      const catColorSet = new Set();
      resolvedRules.forEach(r => {
        const cat = FORGE_CATEGORIES.find(c => c.id === r.category);
        if (cat) catColorSet.add(cat.color);
      });
      // For style collections, attach paramOverrides + rationale from collection.rules
      const rulesWithOverrides = collection.rules
        ? resolvedRules.map(r => {
            const collRule = collection.rules.find(cr => cr.ruleId === r.id);
            return collRule
              ? { ...r, paramOverrides: collRule.paramOverrides, rationale: collRule.rationale }
              : r;
          })
        : resolvedRules;
      return {
        ...collection,
        rules: rulesWithOverrides,
        categoryColors: [...catColorSet],
      };
    });
  }, []);

  // Compute overlay weights from equipped bundle rules for RadarChart
  // Uses proportional fill: equipped-in-category / total-available-in-category
  const overlayWeights = useMemo(() => {
    const defaultWeights = FORGE_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: 0 }), {});
    const equipped = bundles.filter(b => b.status === 'equipped');
    const allRuleIds = equipped.flatMap(b => b.ruleIds || []);
    if (allRuleIds.length === 0) return defaultWeights;

    // Resolve rules, filtering out soft-deleted/unresolvable IDs
    const resolvedRules = allRuleIds
      .map(id => rules.find(r => r.id === id))
      .filter(Boolean);
    if (resolvedRules.length === 0) return defaultWeights;

    // Count rules per category from resolved rules only
    const catCounts = {};
    FORGE_CATEGORIES.forEach(cat => { catCounts[cat.id] = 0; });
    for (const rule of resolvedRules) {
      if (catCounts[rule.category] !== undefined) {
        catCounts[rule.category]++;
      }
    }

    // Normalize by total available rules per category (proportional fill)
    const weights = {};
    FORGE_CATEGORIES.forEach(cat => {
      const available = categoryTotals[cat.id] || 1;
      weights[cat.id] = catCounts[cat.id] / available;
    });
    return weights;
  }, [bundles, rules]);

  // ── Computed values ──────────────────────────
  const unassignedRules = useMemo(
    () => rules.filter(r => !r.bundleIds || r.bundleIds.length === 0),
    [rules]
  );

  const draftBundles = useMemo(
    () => bundles.filter(b => b.status === 'draft'),
    [bundles]
  );

  const forgedBundles = useMemo(
    () => bundles.filter(b => b.status === 'forged'),
    [bundles]
  );

  const equippedBundles = useMemo(
    () => bundles.filter(b => b.status === 'equipped'),
    [bundles]
  );

  // ── Actions ──────────────────────────────────

  // Add a rule from a Discover template to a draft bundle
  const addRuleToBundle = useCallback(async (template, paramValues, options = {}) => {
    if (!agentId || addingRuleId) return;
    setAddingRuleId(template.id);

    try {
      let targetBundle = bundles.find(b => b.status === 'draft');
      if (!targetBundle) {
        const bundleId = await createBundle(agentId, { name: 'My Strategy' });
        targetBundle = { id: bundleId, name: 'My Strategy', status: 'draft', ruleIds: [] };
      }

      const firstTemplate = template.forgeTemplates[0];
      let ruleText = firstTemplate.text;
      if (firstTemplate.params) {
        for (const [key, config] of Object.entries(firstTemplate.params)) {
          const val = paramValues?.[key] !== undefined ? paramValues[key] : config.default;
          ruleText = ruleText.replace(`{${key}}`, val);
        }
      }

      const ruleId = await createRule(agentId, {
        text: ruleText,
        textTemplate: firstTemplate.text,
        source: 'forge_discover',
        sourceRef: template.id,
        category: firstTemplate.category || template.category,
        params: firstTemplate.params || null,
        paramValues: paramValues || null,
        // User added this rule by hand → tier-1 (deliberate) for the reconciler.
        provenance: 'user_equipped',
        ...(options.status && { status: options.status }),
        ...(options.priority != null && { priority: options.priority }),
        ...(options.traitId && { traitId: options.traitId }),
      });

      try {
        await addRuleToBundleSvc(agentId, targetBundle.id, ruleId);
      } catch (bundleErr) {
        console.error('[useForge] Failed to add rule to bundle, rolling back:', bundleErr);
        await softDeleteRule(agentId, ruleId).catch(() => {});
        throw bundleErr;
      }

      // Reload data to stay in sync
      await loadData();
      const ruleCount = (targetBundle.ruleIds?.length || 0) + 1;
      showToast(`Rule added to '${targetBundle.name}' bundle! (${ruleCount} rules)`);
    } catch (err) {
      console.error('[useForge] addRuleToBundle failed:', err);
      showToast(err.message || 'Failed to add rule');
    } finally {
      setAddingRuleId(null);
    }
  }, [agentId, addingRuleId, bundles, showToast, loadData]);

  // Create a trait-derived rule DOC WITHOUT adding it to any bundle. Trait rules
  // are an identity layer projected at deploy by `traitId ∈ equippedTraits`
  // (api/_utils/projectActiveRules.js), independent of bundle membership — so
  // materializing them into a bundle would wrongly count them against the
  // per-level bundle rule cap. Used by useTraits.equipTrait.
  const addTraitRule = useCallback(async (template, paramValues, options = {}) => {
    if (!agentId) return null;
    const firstTemplate = template.forgeTemplates[0];
    let ruleText = firstTemplate.text;
    if (firstTemplate.params) {
      for (const [key, config] of Object.entries(firstTemplate.params)) {
        const val = paramValues?.[key] !== undefined ? paramValues[key] : config.default;
        ruleText = ruleText.replace(`{${key}}`, val);
      }
    }
    const ruleId = await createRule(agentId, {
      text: ruleText,
      textTemplate: firstTemplate.text,
      source: 'forge_discover',
      sourceRef: template.id,
      category: firstTemplate.category || template.category,
      params: firstTemplate.params || null,
      paramValues: paramValues || null,
      // User hand-equipped this trait → tier-1 (deliberate) for the reconciler.
      // (The archetype-default SEEDER stamps 'archetype_default' in traitEquip.js.)
      provenance: 'user_equipped',
      ...(options.status && { status: options.status }),
      ...(options.priority != null && { priority: options.priority }),
      ...(options.traitId && { traitId: options.traitId }),
    });
    await loadData();
    return ruleId;
  }, [agentId, loadData]);

  // Refine a rule (update text + category)
  const refineRule = useCallback(async (ruleId, updates) => {
    if (!agentId) return;
    try {
      await updateRule(agentId, ruleId, { ...updates, isRefined: true });
      setRules(prev => prev.map(r =>
        r.id === ruleId ? { ...r, ...updates, isRefined: true } : r
      ));
      setEditingRuleId(null);
      showToast('Rule refined');
    } catch (err) {
      console.error('[useForge] refineRule failed:', err);
      showToast(err.message || 'Failed to refine rule');
    }
  }, [agentId, showToast]);

  // Delete a rule (soft delete + reload bundles to clear orphaned ruleIds)
  const deleteRule = useCallback(async (ruleId) => {
    if (!agentId) return;
    try {
      await softDeleteRule(agentId, ruleId);
      setRules(prev => prev.filter(r => r.id !== ruleId));
      await loadData();
      showToast('Rule deleted');
    } catch (err) {
      console.error('[useForge] deleteRule failed:', err);
      showToast(err.message || 'Failed to delete rule');
    }
  }, [agentId, showToast, loadData]);

  // Create a manual rule
  const createManualRule = useCallback(async ({ text, category }) => {
    if (!agentId) return;
    try {
      const ruleId = await createRule(agentId, {
        text,
        category,
        source: 'manual',
        visibility: 'private',
        // User authored this rule by hand → tier-1 (deliberate) for the reconciler.
        provenance: 'user_equipped',
      });
      setRules(prev => [
        { id: ruleId, text, category, source: 'manual', visibility: 'private', bundleIds: [], isRefined: false },
        ...prev,
      ]);
      showToast('Rule created');
    } catch (err) {
      console.error('[useForge] createManualRule failed:', err);
      showToast(err.message || 'Failed to create rule');
    }
  }, [agentId, showToast]);

  // Create a new draft bundle
  const createNewBundle = useCallback(async (name = 'New Strategy') => {
    if (!agentId) return;
    if (bundles.length >= 5) {
      showToast('Maximum 5 bundles. Archive a bundle to create a new one.');
      return;
    }
    try {
      const bundleId = await createBundle(agentId, { name });
      setBundles(prev => [
        { id: bundleId, name, status: 'draft', ruleIds: [], ruleSnapshots: [], version: 1 },
        ...prev,
      ]);
      showToast('Bundle created');
      return bundleId;
    } catch (err) {
      console.error('[useForge] createNewBundle failed:', err);
      showToast(err.message || 'Failed to create bundle');
    }
  }, [agentId, bundles, showToast]);

  // Add a rule to a specific bundle (from rule picker)
  const addRuleToBundleById = useCallback(async (bundleId, ruleId) => {
    if (!agentId) return;
    try {
      await addRuleToBundleSvc(agentId, bundleId, ruleId);
      await loadData();
      showToast('Rule added to bundle');
    } catch (err) {
      console.error('[useForge] addRuleToBundleById failed:', err);
      showToast(err.message || 'Failed to add rule to bundle');
    }
  }, [agentId, showToast, loadData]);

  // Author a per-rule hard/soft override on a draft bundle (Phase 3).
  // value: 'hard' | 'soft' | null (null clears → reverts to category default).
  const setRuleHardness = useCallback(async (bundleId, ruleId, value) => {
    if (!agentId) return;
    try {
      await setRuleHardnessSvc(agentId, bundleId, ruleId, value);
      await loadData();
    } catch (err) {
      console.error('[useForge] setRuleHardness failed:', err);
      showToast(err.message || 'Failed to update rule');
    }
  }, [agentId, showToast, loadData]);

  // Remove a rule from a bundle
  const removeRuleFromBundle = useCallback(async (bundleId, ruleId) => {
    if (!agentId) return;
    try {
      await removeRuleFromBundleSvc(agentId, bundleId, ruleId);
      await loadData();
      showToast('Rule removed from bundle');
    } catch (err) {
      console.error('[useForge] removeRuleFromBundle failed:', err);
      showToast(err.message || 'Failed to remove rule');
    }
  }, [agentId, showToast, loadData]);

  // Forge a bundle
  const forgeBundleFn = useCallback(async (bundleId) => {
    if (!agentId || forgingBundleId) return;
    setForgingBundleId(bundleId);
    try {
      await forgeBundleSvc(agentId, bundleId);
      await loadData();
      showToast('Bundle forged!');
    } catch (err) {
      console.error('[useForge] forgeBundle failed:', err);
      showToast(err.message || 'Failed to forge bundle');
    } finally {
      setForgingBundleId(null);
    }
  }, [agentId, forgingBundleId, showToast, loadData]);

  // Equip a bundle
  const equipBundleFn = useCallback(async (bundleId) => {
    if (!agentId || equippingBundleId) return;
    setEquippingBundleId(bundleId);
    try {
      // equipBundleSvc returns the gated equip-time detection result (null when
      // DETECT is off). Warn, don't block — the equip already succeeded.
      const conflictCheckResult = await equipBundleSvc(agentId, bundleId);
      // Report the (committed) equip result BEFORE reloading, and isolate the
      // reload: a transient loadData() failure must not misreport a successful
      // equip as a failure (or swallow the conflict warning).
      const warning = buildEquipWarning(conflictCheckResult);
      showToast(warning || 'Bundle equipped! Your agent will use these rules in the next battle.');
      try {
        await loadData();
      } catch (reloadErr) {
        console.error('[useForge] equip post-reload failed (equip itself succeeded):', reloadErr);
      }
    } catch (err) {
      console.error('[useForge] equipBundle failed:', err);
      showToast(err.message || 'Failed to equip bundle');
    } finally {
      setEquippingBundleId(null);
    }
  }, [agentId, equippingBundleId, showToast, loadData]);

  // Unequip a bundle
  const unequipBundleFn = useCallback(async (bundleId) => {
    if (!agentId || equippingBundleId) return;
    try {
      await unequipBundleSvc(agentId, bundleId);
      await loadData();
      showToast('Bundle unequipped');
    } catch (err) {
      console.error('[useForge] unequipBundle failed:', err);
      showToast(err.message || 'Failed to unequip bundle');
    }
  }, [agentId, equippingBundleId, showToast, loadData]);

  // Reforge a bundle
  const reforgeBundleFn = useCallback(async (bundleId) => {
    if (!agentId || forgingBundleId) return;
    try {
      await reforgeBundleSvc(agentId, bundleId);
      await loadData();
      showToast('Bundle reforged — new draft created');
    } catch (err) {
      console.error('[useForge] reforgeBundle failed:', err);
      showToast(err.message || 'Failed to reforge bundle');
    }
  }, [agentId, forgingBundleId, showToast, loadData]);

  // Archive (delete) a bundle
  const archiveBundleFn = useCallback(async (bundleId) => {
    if (!agentId) return;
    try {
      await archiveBundleSvc(agentId, bundleId);
      await loadData();
      showToast('Bundle deleted');
    } catch (err) {
      console.error('[useForge] archiveBundle failed:', err);
      showToast(err.message || 'Failed to delete bundle');
    }
  }, [agentId, showToast, loadData]);

  // Rename a draft bundle (sanitized Firestore update)
  const renameDraftBundle = useCallback(async (bundleId, newName) => {
    if (!agentId || !newName?.trim()) return;
    // Sanitize: allow only alphanumeric, spaces, hyphens, underscores; cap at 50 chars
    const sanitized = newName.trim().replace(/[^a-zA-Z0-9 \-_]/g, '').slice(0, 50);
    if (!sanitized) {
      showToast('Bundle name must contain valid characters (letters, numbers, spaces, hyphens)');
      return;
    }
    try {
      const bundleRef = doc(db, 'agents', agentId, 'bundles', bundleId);
      await updateDoc(bundleRef, { name: sanitized });
      await loadData();
    } catch (err) {
      console.error('[useForge] renameDraftBundle failed:', err);
      showToast(err.message || 'Failed to rename bundle');
    }
  }, [agentId, showToast, loadData]);

  return {
    // Tab / UI state
    activeTab,
    setActiveTab,
    selectedCategory,
    setSelectedCategory,
    expandedCardId,
    setExpandedCardId,
    loading,
    toast,
    showToast,

    // Mech Bay state
    expandedAccordions,
    toggleAccordion,

    // Data
    rules,
    bundles,
    filteredTemplates,
    templatesByCategory,
    collectionData,
    categories: FORGE_CATEGORIES,

    // Computed
    unassignedRules,
    draftBundles,
    forgedBundles,
    equippedBundles,
    overlayWeights,

    // UI state for My Rules / My Bundles
    editingRuleId,
    setEditingRuleId,
    showRulePicker,
    setShowRulePicker,
    forgingBundleId,
    equippingBundleId,

    // Actions — Discover
    addRuleToBundle,
    addTraitRule,
    addingRuleId,

    // Actions — My Rules
    refineRule,
    deleteRule,
    createManualRule,

    // Stats
    stats,
    statsLoading,
    archivedBundles,
    loadStats,

    // Actions — My Bundles
    createNewBundle,
    addRuleToBundleById,
    removeRuleFromBundle,
    setRuleHardness,
    forgeBundleFn,
    equipBundleFn,
    unequipBundleFn,
    reforgeBundleFn,
    archiveBundleFn,
    renameDraftBundle,
    reloadData: loadData,
  };
}
