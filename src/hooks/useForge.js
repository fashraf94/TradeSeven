// src/hooks/useForge.js
// Manages Forge state: tabs, category filter, expanded card, rules, bundles,
// and all CRUD actions (add, refine, delete, forge, equip, unequip, reforge).

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FORGE_RULE_TEMPLATES, FORGE_CATEGORIES } from '../data/forgeKnowledgeBase';
import {
  createRule,
  createBundle,
  addRuleToBundle as addRuleToBundleSvc,
  removeRuleFromBundle as removeRuleFromBundleSvc,
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

// Category group mappings for Strategy/Controls toggle
export const STRATEGY_CATEGORIES = ['technical', 'fundamental', 'threshold', 'tier_strategy'];
export const CONTROLS_CATEGORIES = ['risk', 'allocation', 'mid_battle', 'game_state'];

// Helper to read persisted forge UI state from localStorage
function loadPersistedState(agentId) {
  if (!agentId) return null;
  try {
    const raw = localStorage.getItem(`forge_state_${agentId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      categoryGroup: parsed.categoryGroup || 'strategy',
      expandedAccordions: new Set(parsed.expandedAccordions || []),
    };
  } catch {
    return null;
  }
}

function savePersistedState(agentId, categoryGroup, expandedAccordions) {
  if (!agentId) return;
  try {
    localStorage.setItem(`forge_state_${agentId}`, JSON.stringify({
      categoryGroup,
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

  // Mech Bay state — category group toggle + accordion expansion
  const [categoryGroup, setCategoryGroupRaw] = useState('strategy');
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
      setCategoryGroupRaw(saved.categoryGroup);
      setExpandedAccordions(saved.expandedAccordions);
    } else {
      // Default: first category in strategy group expanded
      setExpandedAccordions(new Set([STRATEGY_CATEGORIES[0]]));
    }
    persistedInit.current = true;
  }, [agentId]);

  // Persist categoryGroup + expandedAccordions to localStorage
  const setCategoryGroup = useCallback((group) => {
    setCategoryGroupRaw(group);
    // When switching groups, expand the first category of the new group
    const firstCat = group === 'strategy' ? STRATEGY_CATEGORIES[0] : CONTROLS_CATEGORIES[0];
    const newExpanded = new Set([firstCat]);
    setExpandedAccordions(newExpanded);
    if (agentId) savePersistedState(agentId, group, newExpanded);
  }, [agentId]);

  const toggleAccordion = useCallback((categoryId) => {
    setExpandedAccordions(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      if (agentId) savePersistedState(agentId, categoryGroup, next);
      return next;
    });
  }, [agentId, categoryGroup]);

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
        .filter(b => b.status !== 'archived');
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
          .filter(b => b.status !== 'archived');
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
      // Fetch ALL bundles including archived (main loadData filters them out)
      const bundlesRef = collection(db, 'agents', agentId, 'bundles');
      const bundlesQ = query(bundlesRef, orderBy('createdAt', 'desc'));
      const bundlesSnap = await getDocs(bundlesQ);
      const allBundles = bundlesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
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

  // Group templates by active category group (Strategy or Controls)
  const groupedTemplates = useMemo(() => {
    const cats = categoryGroup === 'strategy' ? STRATEGY_CATEGORIES : CONTROLS_CATEGORIES;
    return FORGE_RULE_TEMPLATES.filter(t => cats.includes(t.category));
  }, [categoryGroup]);

  // Compute overlay weights from equipped bundle rules for RadarChart
  const overlayWeights = useMemo(() => {
    const defaultWeights = FORGE_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: 0 }), {});
    const equipped = bundles.filter(b => b.status === 'equipped');
    const allRuleIds = equipped.flatMap(b => b.ruleIds || []);
    if (allRuleIds.length === 0) return defaultWeights;

    // Resolve rules, filtering out soft-deleted/unresolvable IDs
    const resolvedRules = allRuleIds
      .map(id => rules.find(r => r.id === id))
      .filter(Boolean);
    const total = resolvedRules.length;
    if (total === 0) return defaultWeights;

    // Count rules per category from resolved rules only
    const catCounts = {};
    FORGE_CATEGORIES.forEach(cat => { catCounts[cat.id] = 0; });
    for (const rule of resolvedRules) {
      if (catCounts[rule.category] !== undefined) {
        catCounts[rule.category]++;
      }
    }
    const weights = {};
    FORGE_CATEGORIES.forEach(cat => {
      weights[cat.id] = catCounts[cat.id] / total;
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
  const addRuleToBundle = useCallback(async (template) => {
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
          ruleText = ruleText.replace(`{${key}}`, config.default);
        }
      }

      const ruleId = await createRule(agentId, {
        text: ruleText,
        source: 'forge_discover',
        sourceRef: template.id,
        category: firstTemplate.category || template.category,
        params: firstTemplate.params || null,
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
  }, [agentId, showToast]);

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
      await equipBundleSvc(agentId, bundleId);
      await loadData();
      showToast('Bundle equipped! Your agent will use these rules in the next battle.');
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
    categoryGroup,
    setCategoryGroup,
    expandedAccordions,
    toggleAccordion,

    // Data
    rules,
    bundles,
    filteredTemplates,
    groupedTemplates,
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
    forgeBundleFn,
    equipBundleFn,
    unequipBundleFn,
    reforgeBundleFn,
    archiveBundleFn,
    renameDraftBundle,
    reloadData: loadData,
  };
}
