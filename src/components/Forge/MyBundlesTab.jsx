// DEPRECATED: Replaced by BundleStrip + CategoryAccordion in ForgeScreen (Phase 1 Mech Bay).
// Kept for rollback purposes — do not add new features here.
//
// src/components/Forge/MyBundlesTab.jsx
// Bundle workbench — draft and forged bundles, forge flow, equip flow.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, Eye, EyeOff, Zap, Edit3, Hammer } from 'lucide-react';
import { FORGE_LIMITS } from '../../constants/agentProgression';
import RulePickerModal from './RulePickerModal';

const CATEGORY_META = {
  technical:    { label: 'Technical',    color: '#5eead4' },
  fundamental:  { label: 'Fundamental',  color: '#a78bfa' },
  risk:         { label: 'Risk',         color: '#f97066' },
  allocation:   { label: 'Allocation',   color: '#f59e0b' },
  mid_battle:   { label: 'Mid-Battle',   color: '#6366F1' },
  game_state:   { label: 'Game State',   color: '#94A3B8' },
  threshold:    { label: 'Threshold',    color: '#e879f9' },
  tier_strategy:{ label: 'Tier Strategy', color: '#fbbf24' },
};

const ALL_CATEGORIES = ['technical', 'fundamental', 'risk', 'allocation', 'mid_battle', 'game_state', 'threshold', 'tier_strategy'];

function getAgentLevel(agent) {
  const gamesPlayed = agent?.stats?.gamesPlayed || 0;
  if (gamesPlayed >= 15) return 'partner';
  if (gamesPlayed >= 5) return 'starter';
  return 'rookie';
}

function getLevelLabel(level) {
  return { rookie: 'Rookie', starter: 'Starter', partner: 'Partner' }[level] || 'Rookie';
}

export default function MyBundlesTab({ forge, tokens, isMobile, agent }) {
  const [expandedForgedId, setExpandedForgedId] = useState(null);
  const [forgeSuccessBundle, setForgeSuccessBundle] = useState(null);
  const [showNamePrompt, setShowNamePrompt] = useState(null); // bundleId
  const [namePromptValue, setNamePromptValue] = useState('');
  const [deletingBundleId, setDeletingBundleId] = useState(null);
  const [editingNameBundleId, setEditingNameBundleId] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  const level = getAgentLevel(agent);
  const limits = FORGE_LIMITS[level] || FORGE_LIMITS.rookie;
  const totalBundles = forge.bundles.length;
  const hasActiveBattle = !!agent?.activeBattleId;

  // Get rule object by ID
  const getRuleById = (ruleId) => forge.rules.find(r => r.id === ruleId);

  // Count equipped bundles from forge state
  const equippedCount = forge.equippedBundles.length;

  // Can create new bundle?
  const canCreate = totalBundles < limits.maxBundles;

  const handleCreateBundle = async () => {
    if (!canCreate) {
      forge.showToast(`Bundle limit reached (${limits.maxBundles} at ${getLevelLabel(level)} level)`);
      return;
    }
    await forge.createNewBundle('New Strategy');
  };

  // Forge flow
  const handleForgeClick = (bundle) => {
    if (!bundle.ruleIds || bundle.ruleIds.length === 0) {
      forge.showToast('Add at least 1 rule before forging');
      return;
    }
    const isGenericName = ['My Strategy', 'New Strategy'].includes(bundle.name);
    if (isGenericName) {
      setShowNamePrompt(bundle.id);
      setNamePromptValue(bundle.name);
    } else {
      doForge(bundle.id);
    }
  };

  const doForge = async (bundleId) => {
    setShowNamePrompt(null);
    // Capture bundle info before the async forge call (state will be stale after)
    const bundle = forge.draftBundles.find(b => b.id === bundleId);
    await forge.forgeBundleFn(bundleId);
    setForgeSuccessBundle({
      id: bundleId,
      name: bundle?.name || 'Bundle',
      ruleCount: bundle?.ruleIds?.length || 0,
    });
  };

  const handleNamePromptConfirm = async () => {
    const bundleId = showNamePrompt;
    if (namePromptValue?.trim() && !['My Strategy', 'New Strategy'].includes(namePromptValue.trim())) {
      await forge.renameDraftBundle(bundleId, namePromptValue.trim());
    }
    setShowNamePrompt(null);
    await doForge(bundleId);
  };

  const handleEquip = async (bundleId) => {
    if (hasActiveBattle) {
      forge.showToast('Bundle changes take effect after your current battle ends');
      return;
    }
    if (equippedCount >= limits.maxBundles) {
      forge.showToast(`All bundle slots full. Unequip a bundle first or level up.`);
      return;
    }
    await forge.equipBundleFn(bundleId);
    setForgeSuccessBundle(null);
  };

  const handleUnequip = async (bundleId) => {
    if (hasActiveBattle) {
      forge.showToast('Bundle changes take effect after your current battle ends');
      return;
    }
    await forge.unequipBundleFn(bundleId);
  };

  const handleReforge = async (bundleId) => {
    await forge.reforgeBundleFn(bundleId);
  };

  // Composition summary for a draft bundle
  const getComposition = (ruleIds) => {
    const counts = {};
    for (const id of (ruleIds || [])) {
      const rule = getRuleById(id);
      if (rule?.category) {
        counts[rule.category] = (counts[rule.category] || 0) + 1;
      }
    }
    return counts;
  };

  const renderCategoryBadge = (category) => {
    const meta = CATEGORY_META[category];
    if (!meta) return null;
    return (
      <span style={{
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '9px',
        fontWeight: 600,
        color: meta.color,
        background: `${meta.color}18`,
      }}>
        {meta.label}
      </span>
    );
  };

  // ── Draft bundle card ──
  const renderDraftBundle = (bundle) => {
    const ruleCount = bundle.ruleIds?.length || 0;
    const composition = getComposition(bundle.ruleIds);
    const missingCategories = ALL_CATEGORIES.filter(c => !composition[c]);

    return (
      <motion.div
        key={bundle.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '16px',
          borderRadius: '14px',
          background: tokens.bgCard,
          border: `1px solid ${tokens.borderDefault}`,
          marginBottom: '12px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <Package size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
            {editingNameBundleId === bundle.id ? (
              <input
                autoFocus
                value={editingNameValue}
                onChange={(e) => setEditingNameValue(e.target.value)}
                onBlur={() => {
                  if (editingNameValue.trim() && editingNameValue.trim() !== bundle.name) {
                    forge.renameDraftBundle(bundle.id, editingNameValue.trim());
                  }
                  setEditingNameBundleId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.target.blur();
                  if (e.key === 'Escape') setEditingNameBundleId(null);
                }}
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: tokens.textWhite,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${tokens.teal}`,
                  outline: 'none',
                  padding: '0 0 2px',
                  fontFamily: 'inherit',
                  width: '100%',
                }}
              />
            ) : (
              <button
                onClick={() => {
                  setEditingNameBundleId(bundle.id);
                  setEditingNameValue(bundle.name);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  minWidth: 0,
                }}
              >
                <span style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: tokens.textWhite,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {bundle.name}
                </span>
                <Edit3 size={12} color={tokens.textMuted} style={{ flexShrink: 0 }} />
              </button>
            )}
          </div>
          <span style={{
            padding: '3px 10px',
            borderRadius: '8px',
            fontSize: '10px',
            fontWeight: 700,
            color: '#f59e0b',
            background: 'rgba(245, 158, 11, 0.12)',
            textTransform: 'uppercase',
          }}>
            Draft
          </span>
        </div>

        {/* Rule count */}
        <div style={{ fontSize: '12px', color: tokens.textMuted, marginBottom: '10px' }}>
          {ruleCount} / {limits.maxRulesPerBundle} rules
        </div>

        {/* Rule list */}
        <div style={{
          borderRadius: '10px',
          border: `1px solid ${tokens.borderDefault}`,
          overflow: 'hidden',
          marginBottom: '12px',
        }}>
          {(bundle.ruleIds || []).map((ruleId, idx) => {
            const rule = getRuleById(ruleId);
            if (!rule) return null;
            return (
              <div
                key={ruleId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderBottom: idx < (bundle.ruleIds.length - 1) ? `1px solid ${tokens.borderDefault}` : 'none',
                  background: 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  {renderCategoryBadge(rule.category)}
                  <span style={{
                    fontSize: '12px',
                    color: tokens.textPrimary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {rule.text}
                  </span>
                </div>
                <button
                  onClick={() => forge.removeRuleFromBundle(bundle.id, ruleId)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(239,68,68,0.2)',
                    background: 'transparent',
                    color: '#ef4444',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                    marginLeft: '8px',
                  }}
                >
                  Remove
                </button>
              </div>
            );
          })}

          {/* Empty slots */}
          {Array.from({ length: Math.min(limits.maxRulesPerBundle - ruleCount, 2) }).map((_, i) => (
            <button
              key={`empty-${i}`}
              onClick={() => forge.setShowRulePicker(bundle.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: '100%',
                padding: '10px 12px',
                border: 'none',
                borderTop: (ruleCount > 0 || i > 0) ? `1px dashed ${tokens.borderDefault}` : `1px dashed ${tokens.borderDefault}`,
                background: 'transparent',
                color: tokens.textMuted,
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Plus size={12} />
              Add rule from My Rules
            </button>
          ))}
        </div>

        {/* Composition summary */}
        {ruleCount > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: tokens.textMuted, marginBottom: '6px' }}>
              Composition: {Object.entries(composition).map(([cat, count]) =>
                `${count} ${CATEGORY_META[cat]?.label || cat}`
              ).join(', ')}
            </div>
            {missingCategories.length > 0 && missingCategories.length < 4 && (
              <div style={{ fontSize: '11px', color: '#f59e0b' }}>
                No {missingCategories.map(c => CATEGORY_META[c]?.label?.toLowerCase()).join(' or ')} rule — explore more?
              </div>
            )}
          </div>
        )}

        {/* Forge button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => handleForgeClick(bundle)}
          disabled={ruleCount === 0 || forge.forgingBundleId === bundle.id}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            border: 'none',
            background: ruleCount === 0 ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${tokens.teal}, ${tokens.teal}cc)`,
            color: ruleCount === 0 ? tokens.textFaint : '#000',
            fontSize: '14px',
            fontWeight: 700,
            cursor: ruleCount === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: forge.forgingBundleId === bundle.id ? 0.5 : 1,
          }}
        >
          <Hammer size={16} />
          {forge.forgingBundleId === bundle.id ? 'Forging...' : 'Forge Bundle'}
        </motion.button>

        {/* Delete Draft */}
        <button
          onClick={() => {
            if (deletingBundleId === bundle.id) {
              forge.archiveBundleFn(bundle.id);
              setDeletingBundleId(null);
            } else {
              setDeletingBundleId(bundle.id);
              setTimeout(() => setDeletingBundleId(null), 3000);
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: deletingBundleId === bundle.id ? '#ef4444' : tokens.textFaint,
            fontSize: '12px',
            fontWeight: 500,
            padding: '8px 0',
            width: '100%',
            textAlign: 'center',
            fontFamily: 'inherit',
            transition: 'color 0.15s',
          }}
        >
          {deletingBundleId === bundle.id ? 'Tap again to confirm' : 'Delete Draft'}
        </button>
      </motion.div>
    );
  };

  // ── Forged / Equipped bundle card ──
  const renderForgedBundle = (bundle) => {
    const isEquipped = bundle.status === 'equipped';
    const isExpanded = expandedForgedId === bundle.id;
    const ruleCount = bundle.ruleSnapshots?.length || 0;
    const statusColor = isEquipped ? '#22c55e' : tokens.teal;
    const statusLabel = isEquipped ? 'EQUIPPED' : 'FORGED';
    const forgedDate = bundle.forgedAt ? new Date(bundle.forgedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

    return (
      <motion.div
        key={bundle.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '16px',
          borderRadius: '14px',
          background: tokens.bgCard,
          border: `1px solid ${statusColor}22`,
          marginBottom: '12px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Hammer size={16} color={statusColor} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: tokens.textWhite }}>
              {bundle.name} v{bundle.version || 1}
            </span>
          </div>
          <span style={{
            padding: '3px 10px',
            borderRadius: '8px',
            fontSize: '10px',
            fontWeight: 700,
            color: statusColor,
            background: `${statusColor}15`,
            textTransform: 'uppercase',
          }}>
            {statusLabel}
          </span>
        </div>

        {/* Meta */}
        <div style={{ fontSize: '12px', color: tokens.textMuted, marginBottom: '12px' }}>
          {ruleCount} rule{ruleCount !== 1 ? 's' : ''}
          {forgedDate && ` · Forged ${forgedDate}`}
        </div>

        {/* Expandable rules */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                borderRadius: '10px',
                border: `1px solid ${tokens.borderDefault}`,
                overflow: 'hidden',
                marginBottom: '12px',
              }}
            >
              {(bundle.ruleSnapshots || []).map((snap, idx) => (
                <div
                  key={snap.id || idx}
                  style={{
                    padding: '8px 12px',
                    borderBottom: idx < ruleCount - 1 ? `1px solid ${tokens.borderDefault}` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {renderCategoryBadge(snap.category)}
                  <span style={{ fontSize: '12px', color: tokens.textPrimary, lineHeight: '1.4' }}>
                    {snap.text}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setExpandedForgedId(isExpanded ? null : bundle.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '7px 14px',
              borderRadius: '8px',
              border: `1px solid ${tokens.borderDefault}`,
              background: 'transparent',
              color: tokens.textMuted,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {isExpanded ? <EyeOff size={13} /> : <Eye size={13} />}
            {isExpanded ? 'Hide Rules' : 'View Rules'}
          </button>

          {isEquipped ? (
            <button
              onClick={() => handleUnequip(bundle.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(239,68,68,0.2)',
                background: 'transparent',
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Unequip
            </button>
          ) : (
            <button
              onClick={() => handleEquip(bundle.id)}
              disabled={forge.equippingBundleId === bundle.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                background: `${tokens.teal}`,
                color: '#000',
                fontSize: '12px',
                fontWeight: 700,
                cursor: forge.equippingBundleId === bundle.id ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                opacity: forge.equippingBundleId === bundle.id ? 0.5 : 1,
              }}
            >
              <Zap size={13} />
              {forge.equippingBundleId === bundle.id ? 'Equipping...' : 'Equip on Agent'}
            </button>
          )}

          <button
            onClick={() => handleReforge(bundle.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '7px 14px',
              borderRadius: '8px',
              border: `1px solid ${tokens.borderDefault}`,
              background: 'transparent',
              color: tokens.textMuted,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Edit3 size={13} />
            Reforge
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div style={{ padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: tokens.textWhite, margin: 0 }}>
          My Bundles
        </h2>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: tokens.textMuted }}>
            {totalBundles} / {limits.maxBundles} bundle slot{limits.maxBundles !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: '10px', color: tokens.textFaint }}>
            {getLevelLabel(level)} level
          </div>
        </div>
      </div>

      {/* Forge success screen */}
      <AnimatePresence>
        {forgeSuccessBundle && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              padding: '24px',
              borderRadius: '16px',
              background: `linear-gradient(135deg, ${tokens.bgCard}, ${tokens.teal}08)`,
              border: `1px solid ${tokens.teal}33`,
              textAlign: 'center',
              marginBottom: '16px',
              boxShadow: `0 4px 24px ${tokens.teal}10`,
            }}
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
              style={{ fontSize: '40px', marginBottom: '12px' }}
            >
              <Hammer size={40} color={tokens.teal} />
            </motion.div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: tokens.textWhite, marginBottom: '4px' }}>
              Bundle Forged!
            </div>
            <div style={{ fontSize: '13px', color: tokens.textMuted, marginBottom: '16px' }}>
              {forgeSuccessBundle.name || 'Your bundle'} is ready to equip
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => handleEquip(forgeSuccessBundle.id)}
                disabled={forge.equippingBundleId === forgeSuccessBundle.id}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: tokens.teal,
                  color: '#000',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: forge.equippingBundleId === forgeSuccessBundle.id ? 0.5 : 1,
                }}
              >
                <Zap size={14} />
                {forge.equippingBundleId === forgeSuccessBundle.id ? 'Equipping...' : 'Equip on Agent'}
              </motion.button>
              <button
                onClick={() => setForgeSuccessBundle(null)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: `1px solid ${tokens.borderDefault}`,
                  background: 'transparent',
                  color: tokens.textMuted,
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Later
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Name prompt modal (inline) */}
      <AnimatePresence>
        {showNamePrompt && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{
              padding: '16px',
              borderRadius: '14px',
              background: tokens.bgCard,
              border: `1px solid ${tokens.teal}33`,
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 600, color: tokens.textWhite, marginBottom: '10px' }}>
              Name your bundle
            </div>
            <input
              value={namePromptValue}
              onChange={e => setNamePromptValue(e.target.value)}
              placeholder="Name your bundle"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${tokens.borderDefault}`,
                background: tokens.bgApp,
                color: tokens.textPrimary,
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: '10px',
              }}
              onKeyDown={e => e.key === 'Enter' && handleNamePromptConfirm()}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleNamePromptConfirm}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: tokens.teal,
                  color: '#000',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Forge
              </button>
              <button
                onClick={() => { doForge(showNamePrompt); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${tokens.borderDefault}`,
                  background: 'transparent',
                  color: tokens.textMuted,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Skip
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draft bundles */}
      {forge.draftBundles.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          {forge.draftBundles.map(b => renderDraftBundle(b))}
        </div>
      )}

      {/* Create new bundle */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleCreateBundle}
        disabled={!canCreate}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '12px',
          border: `1px dashed ${canCreate ? tokens.borderDefault : 'rgba(255,255,255,0.04)'}`,
          background: 'transparent',
          color: canCreate ? tokens.textMuted : tokens.textFaint,
          fontSize: '13px',
          fontWeight: 600,
          cursor: canCreate ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontFamily: 'inherit',
          marginBottom: '20px',
          opacity: canCreate ? 1 : 0.5,
        }}
      >
        <Plus size={14} />
        {canCreate
          ? 'Create New Bundle'
          : `Bundle limit reached (${getLevelLabel(level)} level)`}
      </motion.button>

      {/* Forged + Equipped bundles */}
      {(forge.forgedBundles.length > 0 || forge.equippedBundles.length > 0) && (
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: tokens.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '10px',
            paddingBottom: '6px',
            borderBottom: `1px solid ${tokens.borderDefault}`,
          }}>
            Forged Bundles
          </div>
          {forge.equippedBundles.map(b => renderForgedBundle(b))}
          {forge.forgedBundles.map(b => renderForgedBundle(b))}
        </div>
      )}

      {/* Empty state */}
      {forge.bundles.length === 0 && (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          borderRadius: '12px',
          background: tokens.bgCard,
          border: `1px solid ${tokens.borderDefault}`,
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>
            <Package size={32} color={tokens.textFaint} />
          </div>
          <div style={{ fontSize: '14px', color: tokens.textMuted, marginBottom: '4px' }}>
            No bundles yet
          </div>
          <div style={{ fontSize: '12px', color: tokens.textFaint }}>
            Add rules from the Discover tab, then create a bundle here
          </div>
        </div>
      )}

      {/* Rule Picker Modal */}
      <RulePickerModal
        isOpen={!!forge.showRulePicker}
        onClose={() => forge.setShowRulePicker(null)}
        rules={forge.rules}
        bundleRuleIds={
          forge.showRulePicker
            ? (forge.bundles.find(b => b.id === forge.showRulePicker)?.ruleIds || [])
            : []
        }
        onAdd={(ruleId) => forge.addRuleToBundleById(forge.showRulePicker, ruleId)}
        tokens={tokens}
      />
    </div>
  );
}
