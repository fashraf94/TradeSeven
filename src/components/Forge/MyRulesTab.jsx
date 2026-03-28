// src/components/Forge/MyRulesTab.jsx
// Displays all rules the user has collected, grouped by source, with filter, refine, and delete.

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit3 } from 'lucide-react';

const CATEGORY_META = {
  technical:    { label: 'Technical',    color: '#5eead4' },
  fundamental:  { label: 'Fundamental',  color: '#a78bfa' },
  risk:         { label: 'Risk',         color: '#f97066' },
  allocation:   { label: 'Allocation',   color: '#f59e0b' },
};

const FILTER_PILLS = [
  { id: 'all',        label: 'All' },
  { id: 'public',     label: 'Public' },
  { id: 'private',    label: 'Private' },
  { id: 'unassigned', label: 'Unassigned' },
];

const CATEGORIES = ['technical', 'fundamental', 'risk', 'allocation'];

function getSourceLabel(rule) {
  switch (rule.source) {
    case 'forge_discover': return 'From Discover';
    case 'manual': return 'Added manually';
    case 'forge_custom': return 'Custom built';
    case 'agent_batch_review': return 'From Film Room';
    case 'agent_open_chat': return 'From Chat';
    case 'agent_debate': return 'From Debate';
    case 'agent_reflection': return 'From Reflection';
    default: return rule.source || 'Unknown source';
  }
}

function getBundleName(rule, bundles) {
  if (!rule.bundleIds || rule.bundleIds.length === 0) return null;
  const bundle = bundles.find(b => rule.bundleIds.includes(b.id));
  return bundle ? bundle.name : null;
}

export default function MyRulesTab({ forge, tokens, isMobile }) {
  const [filter, setFilter] = useState('all');
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualCategory, setManualCategory] = useState('technical');
  const [savingManual, setSavingManual] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Inline refine state
  const [refineText, setRefineText] = useState('');
  const [refineCategory, setRefineCategory] = useState('');
  const [savingRefine, setSavingRefine] = useState(false);

  const filteredRules = useMemo(() => {
    const all = forge.rules || [];
    switch (filter) {
      case 'public':     return all.filter(r => r.visibility === 'public');
      case 'private':    return all.filter(r => r.visibility === 'private');
      case 'unassigned': return all.filter(r => !r.bundleIds || r.bundleIds.length === 0);
      default:           return all;
    }
  }, [forge.rules, filter]);

  const publicRules = useMemo(() => filteredRules.filter(r => r.visibility === 'public'), [filteredRules]);
  const privateRules = useMemo(() => filteredRules.filter(r => r.visibility !== 'public'), [filteredRules]);

  const handleStartRefine = (rule) => {
    forge.setEditingRuleId(rule.id);
    setRefineText(rule.text);
    setRefineCategory(rule.category || 'technical');
  };

  const handleSaveRefine = async (ruleId) => {
    if (!refineText.trim()) return;
    setSavingRefine(true);
    await forge.refineRule(ruleId, { text: refineText.trim(), category: refineCategory });
    setSavingRefine(false);
  };

  const handleCancelRefine = () => {
    forge.setEditingRuleId(null);
    setRefineText('');
    setRefineCategory('');
  };

  const handleDelete = async (ruleId) => {
    await forge.deleteRule(ruleId);
    setConfirmDeleteId(null);
  };

  const handleManualAdd = async () => {
    if (!manualText.trim() || savingManual) return;
    setSavingManual(true);
    await forge.createManualRule({ text: manualText.trim(), category: manualCategory });
    setManualText('');
    setManualCategory('technical');
    setShowManualAdd(false);
    setSavingManual(false);
  };

  const renderCategoryBadge = (category) => {
    const meta = CATEGORY_META[category];
    if (!meta) return null;
    return (
      <span style={{
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '10px',
        fontWeight: 600,
        color: meta.color,
        background: `${meta.color}18`,
        textTransform: 'capitalize',
      }}>
        {meta.label}
      </span>
    );
  };

  const renderRuleCard = (rule) => {
    const isEditing = forge.editingRuleId === rule.id;
    const isUnassigned = !rule.bundleIds || rule.bundleIds.length === 0;
    const bundleName = getBundleName(rule, forge.bundles);

    return (
      <motion.div
        key={rule.id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        style={{
          padding: '14px 16px',
          borderRadius: '12px',
          background: tokens.bgCard,
          border: `1px solid ${tokens.borderDefault}`,
          marginBottom: '8px',
        }}
      >
        {/* Badges row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
          {renderCategoryBadge(rule.category)}
          {isUnassigned && (
            <span style={{
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 600,
              color: '#f59e0b',
              background: 'rgba(245, 158, 11, 0.12)',
            }}>
              Unassigned
            </span>
          )}
          {rule.isRefined && (
            <span style={{
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 600,
              color: tokens.teal,
              background: `${tokens.teal}15`,
            }}>
              Refined
            </span>
          )}
        </div>

        {/* Rule text or inline edit */}
        {isEditing ? (
          <div style={{ marginBottom: '10px' }}>
            <textarea
              value={refineText}
              onChange={e => setRefineText(e.target.value)}
              maxLength={200}
              autoFocus
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${tokens.teal}44`,
                background: `${tokens.teal}08`,
                color: tokens.textPrimary,
                fontSize: '13px',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <select
                value={refineCategory}
                onChange={e => setRefineCategory(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: `1px solid ${tokens.borderDefault}`,
                  background: tokens.bgApp,
                  color: tokens.textPrimary,
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                ))}
              </select>
              <button
                onClick={() => handleSaveRefine(rule.id)}
                disabled={!refineText.trim() || savingRefine}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: tokens.teal,
                  color: '#000',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: !refineText.trim() || savingRefine ? 0.5 : 1,
                }}
              >
                {savingRefine ? '...' : 'Save'}
              </button>
              <button
                onClick={handleCancelRefine}
                style={{
                  padding: '6px 14px',
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
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            fontSize: '13px',
            fontWeight: 500,
            color: tokens.textPrimary,
            marginBottom: '8px',
            lineHeight: '1.5',
          }}>
            {rule.text}
          </div>
        )}

        {/* Source + bundle membership */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: tokens.textMuted }}>
              {getSourceLabel(rule)}
            </span>
            {bundleName && (
              <>
                <span style={{ fontSize: '11px', color: tokens.textFaint }}>·</span>
                <span style={{ fontSize: '11px', color: tokens.textMuted }}>
                  In: {bundleName}
                </span>
              </>
            )}
          </div>

          {/* Action buttons */}
          {!isEditing && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => handleStartRefine(rule)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${tokens.borderDefault}`,
                  background: 'transparent',
                  color: tokens.textMuted,
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Edit3 size={11} /> Refine
              </button>
              <button
                onClick={() => setConfirmDeleteId(rule.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(239,68,68,0.2)',
                  background: 'transparent',
                  color: '#ef4444',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          )}
        </div>

        {/* Delete confirmation */}
        <AnimatePresence>
          {confirmDeleteId === rule.id && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                marginTop: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <div style={{ fontSize: '12px', color: tokens.textPrimary, marginBottom: '8px' }}>
                Delete this rule? This can't be undone.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleDelete(rule.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  style={{
                    padding: '6px 14px',
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
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderSection = (title, rules) => {
    if (rules.length === 0) return null;
    return (
      <div style={{ marginBottom: '20px' }}>
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
          {title} ({rules.length})
        </div>
        <AnimatePresence>
          {rules.map(rule => renderRuleCard(rule))}
        </AnimatePresence>
      </div>
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
        <h2 style={{
          fontSize: '16px',
          fontWeight: 700,
          color: tokens.textWhite,
          margin: 0,
        }}>
          My Rules
        </h2>
        <span style={{
          fontSize: '12px',
          color: tokens.textMuted,
        }}>
          {forge.rules.length} rule{forge.rules.length !== 1 ? 's' : ''} total
        </span>
      </div>

      {/* Filter pills */}
      <div style={{
        display: 'flex',
        gap: '6px',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}>
        {FILTER_PILLS.map(pill => {
          const isActive = filter === pill.id;
          const count = pill.id === 'unassigned' ? forge.unassignedRules.length : null;
          return (
            <button
              key={pill.id}
              onClick={() => setFilter(pill.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 500,
                border: isActive ? `1px solid ${tokens.teal}4D` : '1px solid rgba(255,255,255,0.08)',
                background: isActive ? `${tokens.teal}20` : 'rgba(255,255,255,0.04)',
                color: isActive ? tokens.teal : tokens.textMuted,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {pill.label}
              {count !== null && ` (${count})`}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {filteredRules.length === 0 && (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          borderRadius: '12px',
          background: tokens.bgCard,
          border: `1px solid ${tokens.borderDefault}`,
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>
            {filter === 'unassigned' ? '🎯' : '📜'}
          </div>
          <div style={{ fontSize: '14px', color: tokens.textMuted, marginBottom: '4px' }}>
            {filter === 'unassigned'
              ? 'All rules are assigned to bundles'
              : 'No rules yet'}
          </div>
          <div style={{ fontSize: '12px', color: tokens.textFaint }}>
            {filter === 'all'
              ? 'Discover rules in the Discover tab or add one manually below'
              : 'Try a different filter'}
          </div>
        </div>
      )}

      {/* Rules grouped by visibility — show both sections for 'all' filter */}
      {filter === 'all' || filter === 'unassigned' ? (
        <>
          {renderSection('Public Rules (from Discover)', publicRules)}
          {renderSection('Private Rules (Custom / Agent)', privateRules)}
        </>
      ) : filter === 'public' ? (
        renderSection('Public Rules', filteredRules)
      ) : (
        renderSection('Private Rules', filteredRules)
      )}

      {/* Add Rule Manually */}
      <div style={{ marginTop: '12px' }}>
        {showManualAdd ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              background: tokens.bgCard,
              border: `1px solid ${tokens.teal}33`,
            }}
          >
            <textarea
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder="Write your rule..."
              maxLength={200}
              autoFocus
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${tokens.borderDefault}`,
                background: tokens.bgApp,
                color: tokens.textPrimary,
                fontSize: '13px',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <select
                value={manualCategory}
                onChange={e => setManualCategory(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: `1px solid ${tokens.borderDefault}`,
                  background: tokens.bgApp,
                  color: tokens.textPrimary,
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                ))}
              </select>
              <button
                onClick={handleManualAdd}
                disabled={!manualText.trim() || savingManual}
                style={{
                  padding: '6px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: tokens.teal,
                  color: '#000',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: !manualText.trim() || savingManual ? 0.5 : 1,
                }}
              >
                {savingManual ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setShowManualAdd(false); setManualText(''); }}
                style={{
                  padding: '6px 14px',
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
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowManualAdd(true)}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: `1px dashed ${tokens.borderDefault}`,
              background: 'transparent',
              color: tokens.textMuted,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            <Plus size={14} />
            Add Rule Manually
          </motion.button>
        )}
      </div>
    </div>
  );
}
