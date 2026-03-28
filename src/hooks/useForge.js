// src/hooks/useForge.js
// Manages Forge state: tabs, category filter, expanded card, rules, bundles, addRuleToBundle action.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FORGE_RULE_TEMPLATES, FORGE_CATEGORIES } from '../data/forgeKnowledgeBase';
import { createRule, createBundle, addRuleToBundle as addRuleToBundleSvc, getRules, softDeleteRule } from '../services/forgeService';

export function useForge(agentId) {
  const [activeTab, setActiveTab] = useState('discover');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [rules, setRules] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [addingRuleId, setAddingRuleId] = useState(null);

  // Show toast with auto-dismiss
  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Load user's rules and bundles from Firestore on mount
  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        // Load rules
        const agentRules = await getRules(agentId);

        // Load bundles (no getBundles in forgeService, query directly)
        const bundlesRef = collection(db, 'agents', agentId, 'bundles');
        const bundlesQ = query(bundlesRef, orderBy('createdAt', 'desc'));
        const bundlesSnap = await getDocs(bundlesQ);
        const agentBundles = bundlesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

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

    load();
    return () => { cancelled = true; };
  }, [agentId, showToast]);

  // Filter templates by selected category
  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') return FORGE_RULE_TEMPLATES;
    return FORGE_RULE_TEMPLATES.filter(t => t.category === selectedCategory);
  }, [selectedCategory]);

  // Add a rule from a template to a draft bundle
  const addRuleToBundle = useCallback(async (template) => {
    if (!agentId || addingRuleId) return;
    setAddingRuleId(template.id);

    try {
      // Step 1: Find or create a draft bundle
      let targetBundle = bundles.find(b => b.status === 'draft');
      if (!targetBundle) {
        const bundleId = await createBundle(agentId, { name: 'My Strategy' });
        targetBundle = { id: bundleId, name: 'My Strategy', status: 'draft', ruleIds: [] };
      }

      // Step 2: Create the rule from the template
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

      // Step 3: Add rule to bundle — if this fails, clean up the orphaned rule
      try {
        await addRuleToBundleSvc(agentId, targetBundle.id, ruleId);
      } catch (bundleErr) {
        console.error('[useForge] Failed to add rule to bundle, rolling back:', bundleErr);
        await softDeleteRule(agentId, ruleId).catch(() => {});
        throw bundleErr;
      }

      // Step 4: Only update local state after BOTH writes succeed
      const newRule = { id: ruleId, text: ruleText, category: template.category };
      setRules(prev => [newRule, ...prev]);

      // Update bundles — add new bundle if it was just created, or update existing
      setBundles(prev => {
        const exists = prev.some(b => b.id === targetBundle.id);
        if (!exists) {
          return [{ ...targetBundle, ruleIds: [ruleId] }, ...prev];
        }
        return prev.map(b =>
          b.id === targetBundle.id
            ? { ...b, ruleIds: [...(b.ruleIds || []), ruleId] }
            : b
        );
      });

      const ruleCount = (targetBundle.ruleIds?.length || 0) + 1;
      showToast(`Rule added to '${targetBundle.name}' bundle! (${ruleCount} rules)`);
    } catch (err) {
      console.error('[useForge] addRuleToBundle failed:', err);
      showToast(err.message || 'Failed to add rule');
    } finally {
      setAddingRuleId(null);
    }
  }, [agentId, addingRuleId, bundles, showToast]);

  return {
    activeTab,
    setActiveTab,
    selectedCategory,
    setSelectedCategory,
    expandedCardId,
    setExpandedCardId,
    rules,
    bundles,
    loading,
    filteredTemplates,
    categories: FORGE_CATEGORIES,
    addRuleToBundle,
    addingRuleId,
    toast,
  };
}
