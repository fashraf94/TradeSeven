// src/hooks/useForge.js
// Manages Forge state: tabs, category filter, expanded card, rules, bundles, addRuleToBundle action.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FORGE_RULE_TEMPLATES, FORGE_CATEGORIES } from '../data/forgeKnowledgeBase';
import { createRule, createBundle, addRuleToBundle as addRuleToBundleSvc, getRules } from '../services/forgeService';

export function useForge(agentId) {
  const [activeTab, setActiveTab] = useState('discover');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [rules, setRules] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

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
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [agentId]);

  // Filter templates by selected category
  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') return FORGE_RULE_TEMPLATES;
    return FORGE_RULE_TEMPLATES.filter(t => t.category === selectedCategory);
  }, [selectedCategory]);

  // Show toast with auto-dismiss
  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Add a rule from a template to a draft bundle
  const addRuleToBundle = useCallback(async (template) => {
    if (!agentId) return;

    try {
      // Find or create a draft bundle
      let draftBundle = bundles.find(b => b.status === 'draft');
      let bundleId;

      if (!draftBundle) {
        bundleId = await createBundle(agentId, { name: 'My Strategy' });
        draftBundle = { id: bundleId, name: 'My Strategy', status: 'draft', ruleIds: [] };
        setBundles(prev => [draftBundle, ...prev]);
      } else {
        bundleId = draftBundle.id;
      }

      // Create the rule from the template
      const firstTemplate = template.forgeTemplates[0];
      // Resolve default param values into the text
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

      // Add rule to bundle
      await addRuleToBundleSvc(agentId, bundleId, ruleId);

      // Update local state
      const newRule = { id: ruleId, text: ruleText, category: template.category };
      setRules(prev => [newRule, ...prev]);
      setBundles(prev => prev.map(b =>
        b.id === bundleId
          ? { ...b, ruleIds: [...(b.ruleIds || []), ruleId] }
          : b
      ));

      const updatedBundle = bundles.find(b => b.id === bundleId) || draftBundle;
      const ruleCount = (updatedBundle.ruleIds?.length || 0) + 1;
      showToast(`Rule added to '${updatedBundle.name || 'My Strategy'}' bundle! (${ruleCount} rules)`);
    } catch (err) {
      console.error('[useForge] addRuleToBundle failed:', err);
      showToast(err.message || 'Failed to add rule');
    }
  }, [agentId, bundles, showToast]);

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
    toast,
  };
}
