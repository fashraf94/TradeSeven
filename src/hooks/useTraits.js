/**
 * useTraits — Manages trait equip/unequip/strength for the agent.
 *
 * Traits are a UI abstraction over Forge rules. Equipping a trait writes 2-4
 * bundle-independent, traitId-keyed rule docs (via useForge.addTraitRule); the
 * deploy projection selects them by traitId ∈ equippedTraits, NOT by bundle
 * membership (api/_utils/projectActiveRules.js).
 *
 * This hook provides:
 * - equippedTraits: array of equipped trait objects with current strength
 * - equipTrait(traitId, strength): equip a trait at a strength level
 * - unequipTrait(traitId): remove a trait and soft-delete its traitId-keyed rules
 * - setTraitStrength(traitId, strength): change strength (re-writes params)
 * - getGroupSlotUsage(groupId): { used, max } for a DNA group
 * - activeComboLabel: the current combo label or null
 * - canEquip(traitId): boolean — checks slot availability
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { softDeleteRule } from '../services/forgeService';
import { FORGE_RULE_TEMPLATES } from '../data/forgeKnowledgeBase';
import { DNA_GROUPS } from '../data/dnaGroups';
import { TRAIT_LIBRARY, TRAIT_BY_ID } from '../data/traitLibrary';
import { getActiveComboLabel } from '../data/traitCombos';

// Build a Map of template ID → full KB template object for O(1) lookup
const TEMPLATE_MAP = new Map(
  FORGE_RULE_TEMPLATES.map(t => [t.id, t])
);

// Client-side battle-lock copy. Exported so the dashboard TraitsSheet's ERROR_COPY
// reuses the exact same string for its battle_active banner.
export const BATTLE_LOCK_MSG =
  "Can't change traits while a battle is live — changes apply to your next deploy.";

/**
 * @param {string} agentId - The agent's Firestore document ID
 * @param {Object} forge - The return value of useForge(agentId) from the parent component
 */
export function useTraits(agentId, forge) {
  const [equippedTraitEntries, setEquippedTraitEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  // ── Load equipped traits from agent doc ──────────────────
  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;

    const loadTraits = async () => {
      setLoading(true);
      try {
        const agentRef = doc(db, 'agents', agentId);
        const snap = await getDoc(agentRef);
        if (!cancelled && snap.exists()) {
          const data = snap.data();
          setEquippedTraitEntries(data.equippedTraits || []);
        }
      } catch (err) {
        console.error('[useTraits] Failed to load equipped traits:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadTraits();
    return () => { cancelled = true; };
  }, [agentId]);

  // ── Persist equipped traits to agent doc ─────────────────
  const persistTraits = useCallback(async (entries) => {
    if (!agentId) return;
    try {
      const agentRef = doc(db, 'agents', agentId);
      await updateDoc(agentRef, { equippedTraits: entries });
    } catch (err) {
      console.error('[useTraits] Failed to persist equipped traits:', err);
    }
  }, [agentId]);

  // ── Auto-unequip traits whose rule docs no longer exist ──
  // Trait rules are bundle-independent (projected at deploy by traitId), so a
  // trait is orphaned only when it has zero surviving (non-deleted) rule docs —
  // e.g. a rule was deleted, or an archetype reseed removed the old set. The
  // loading guard avoids judging "orphaned" before forge.rules has loaded.
  useEffect(() => {
    if (forge?.loading) return;
    if (!equippedTraitEntries.length || !forge?.rules) return;

    const orphaned = equippedTraitEntries.filter(et => {
      const traitRules = forge.rules.filter(r => r.traitId === et.traitId && !r.isDeleted);
      return traitRules.length === 0;
    });

    if (orphaned.length === 0) return;

    // Silently remove orphaned traits (no toast)
    const cleaned = equippedTraitEntries.filter(
      et => !orphaned.some(o => o.traitId === et.traitId)
    );
    setEquippedTraitEntries(cleaned);
    persistTraits(cleaned);
  }, [forge?.loading, forge?.rules, equippedTraitEntries, persistTraits]);

  // ── Enriched equipped traits (merge entries with trait definitions) ──
  const equippedTraits = useMemo(() => {
    return equippedTraitEntries
      .map(entry => {
        const def = TRAIT_BY_ID[entry.traitId];
        if (!def) return null;
        return { ...def, ...entry };
      })
      .filter(Boolean);
  }, [equippedTraitEntries]);

  // ── Active combo label ───────────────────────────────────
  const activeComboLabel = useMemo(() => {
    const ids = equippedTraitEntries.map(e => e.traitId);
    return getActiveComboLabel(ids);
  }, [equippedTraitEntries]);

  // ── Slot usage per DNA group ─────────────────────────────
  const getGroupSlotUsage = useCallback((groupId) => {
    const group = DNA_GROUPS[groupId];
    if (!group) return { used: 0, max: 0 };
    const used = equippedTraitEntries.filter(e => {
      const def = TRAIT_BY_ID[e.traitId];
      return def && def.dnaGroup === groupId;
    }).length;
    return { used, max: group.maxTraits };
  }, [equippedTraitEntries]);

  // ── Can equip check ──────────────────────────────────────
  const canEquip = useCallback((traitId) => {
    const def = TRAIT_BY_ID[traitId];
    if (!def) return false;
    // Already equipped?
    if (equippedTraitEntries.some(e => e.traitId === traitId)) return false;
    // Slot available?
    const { used, max } = getGroupSlotUsage(def.dnaGroup);
    return used < max;
  }, [equippedTraitEntries, getGroupSlotUsage]);

  // ── Battle-lock (defensive) ──────────────────────────────
  // Refuse trait writes while a battle is live — protects BOTH callers: the
  // dashboard TraitsSheet (also slot-disabled via benchLocked) and the Forge
  // trait UI (which had no guard). Fresh getDoc is authoritative (no stale prop);
  // fail-open on a read error is acceptable for a client-side backstop on a
  // single-user-per-agent, soon-to-retire mechanism. The Forge path surfaces the
  // message via forge.showToast; the dashboard reads the returned
  // { error: 'battle_active' } for its ErrorBanner.
  const refusedForBattle = useCallback(async () => {
    if (!agentId) return false;
    try {
      const snap = await getDoc(doc(db, 'agents', agentId));
      if (snap.exists() && snap.data().activeBattleId) {
        forge?.showToast?.(BATTLE_LOCK_MSG);
        return true;
      }
    } catch (err) {
      console.error('[useTraits] battle-lock check failed (allowing write):', err);
    }
    return false;
  }, [agentId, forge]);

  // ── Equip a trait ────────────────────────────────────────
  const equipTrait = useCallback(async (traitId, strength = 'moderate') => {
    if (await refusedForBattle()) return { success: false, error: 'battle_active' };
    const def = TRAIT_BY_ID[traitId];
    if (!def) return { success: false, error: 'unknown_trait' };

    // Slot check
    const { used, max } = getGroupSlotUsage(def.dnaGroup);
    if (used >= max) return { success: false, error: 'slots_full' };

    // Already equipped?
    if (equippedTraitEntries.some(e => e.traitId === traitId)) {
      return { success: false, error: 'already_equipped' };
    }

    const profile = def.strengthProfiles[strength];
    if (!profile) return { success: false, error: 'invalid_strength' };

    // Check for rule conflicts with already-equipped traits
    const conflictsOverridden = [];
    const existingRuleIds = new Set();
    for (const entry of equippedTraitEntries) {
      const entryDef = TRAIT_BY_ID[entry.traitId];
      if (entryDef) {
        for (const rid of entryDef.ruleIds) existingRuleIds.add(rid);
      }
    }

    // Add each rule to the bundle
    // Note: if this fails partway through, some rules may remain in the bundle
    // without a trait entry. These act as standalone rules and can be cleaned up manually.
    try {
      for (const ruleId of def.ruleIds) {
        const template = TEMPLATE_MAP.get(ruleId);
        if (!template) {
          console.warn(`[useTraits] Template not found for ruleId: ${ruleId}`);
          continue;
        }

        const paramOverrides = profile[ruleId] || {};

        // "Last Equipped Wins" — if this ruleId already exists from another trait
        if (existingRuleIds.has(ruleId)) {
          conflictsOverridden.push(ruleId);
        }

        await forge.addTraitRule(template, paramOverrides, {
          status: 'active',
          priority: 1,
          traitId: traitId,
        });
      }
    } catch (err) {
      console.error('[useTraits] Failed to add rules for trait:', err);
      return { success: false, error: 'rule_creation_failed' };
    }

    // Mark conflicting traits as isCustom
    const newEntries = equippedTraitEntries.map(entry => {
      if (conflictsOverridden.length > 0) {
        const entryDef = TRAIT_BY_ID[entry.traitId];
        if (entryDef) {
          const hasConflict = entryDef.ruleIds.some(rid => conflictsOverridden.includes(rid));
          if (hasConflict) return { ...entry, isCustom: true };
        }
      }
      return entry;
    });

    // Add the new trait entry
    const traitEntry = {
      traitId,
      strength,
      isCustom: false,
      equippedAt: Date.now(),
    };
    const updatedEntries = [...newEntries, traitEntry];

    setEquippedTraitEntries(updatedEntries);
    await persistTraits(updatedEntries);

    return {
      success: true,
      conflictsOverridden: conflictsOverridden.length > 0 ? conflictsOverridden : undefined,
    };
  }, [equippedTraitEntries, getGroupSlotUsage, forge, persistTraits, refusedForBattle]);

  // ── Unequip a trait ──────────────────────────────────────
  const unequipTrait = useCallback(async (traitId) => {
    if (await refusedForBattle()) return { success: false, error: 'battle_active' };
    const def = TRAIT_BY_ID[traitId];
    if (!def) return { success: false, error: 'unknown_trait' };

    // Drop the trait LAYER first so it stops projecting at deploy, then clean up
    // its rule docs. Trait rules are bundle-independent and keyed by traitId, so
    // soft-deleting this trait's own docs never touches another trait's rules
    // (cross-trait shared rules live as separate docs under their own traitId).
    const updatedEntries = equippedTraitEntries.filter(e => e.traitId !== traitId);
    setEquippedTraitEntries(updatedEntries);
    await persistTraits(updatedEntries);
    // Best-effort cleanup — never let a reloadData hiccup mask a completed unequip.
    try {
      if (forge?.rules) {
        const traitRules = forge.rules.filter(r => r.traitId === traitId && !r.isDeleted);
        for (const rule of traitRules) {
          try { await softDeleteRule(agentId, rule.id); }
          catch (err) { console.error(`[useTraits] Failed to soft-delete trait rule ${rule.id}:`, err); }
        }
        if (traitRules.length && forge.reloadData) await forge.reloadData();
      }
    } catch (err) {
      console.error('[useTraits] unequip cleanup hiccup (unequip already persisted):', err);
    }

    return { success: true };
  }, [agentId, equippedTraitEntries, forge, persistTraits, refusedForBattle]);

  // ── Set trait strength ───────────────────────────────────
  const setTraitStrength = useCallback(async (traitId, newStrength) => {
    if (await refusedForBattle()) return { success: false, error: 'battle_active' };
    const def = TRAIT_BY_ID[traitId];
    if (!def) return { success: false, error: 'unknown_trait' };

    const profile = def.strengthProfiles[newStrength];
    if (!profile) return { success: false, error: 'invalid_strength' };

    // Update paramValues on each bundled rule in Firestore
    if (forge?.rules) {
      for (const ruleId of def.ruleIds) {
        const rule = forge.rules.find(r => r.traitId === traitId && r.sourceRef === ruleId && !r.isDeleted);
        if (rule) {
          const paramOverrides = profile[ruleId] || {};
          try {
            const ruleRef = doc(db, 'agents', agentId, 'rules', rule.id);
            await updateDoc(ruleRef, { paramValues: paramOverrides });
          } catch (err) {
            console.error(`[useTraits] Failed to update rule ${ruleId} params:`, err);
          }
        }
      }
    }

    // Update the trait entry
    const updatedEntries = equippedTraitEntries.map(e => {
      if (e.traitId === traitId) {
        return { ...e, strength: newStrength, isCustom: false };
      }
      return e;
    });
    setEquippedTraitEntries(updatedEntries);
    await persistTraits(updatedEntries);

    // Reload forge data to reflect param changes
    if (forge?.reloadData) {
      await forge.reloadData();
    }
    return { success: true };
  }, [agentId, equippedTraitEntries, forge, persistTraits, refusedForBattle]);

  return {
    equippedTraits,
    equipTrait,
    unequipTrait,
    setTraitStrength,
    getGroupSlotUsage,
    activeComboLabel,
    canEquip,
    loading,
  };
}
