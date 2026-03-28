import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, PinOff, ToggleLeft, ToggleRight, Trash2, Plus, Hammer, ArrowRight } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import CenteredModal from '../shared/CenteredModal';
import { toggleDirective, pinDirective, removeDirective, addCoachingRule } from '../../services/agentService';
import { unequipBundle } from '../../services/forgeService';
import { getLevelConfig, FORGE_LIMITS } from '../../constants/agentProgression';

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const SOURCE_COLORS = {
  coaching: '#5eead4',
  batch_review: '#f59e0b',
  debate: '#8b5cf6',
  open_chat: '#3b82f6',
  pinned: '#ec4899',
  strategy_session: '#6366f1',
  system: '#6b7280',
};

const SOURCE_LABELS = {
  coaching: 'Coaching',
  batch_review: 'Film Room',
  debate: 'Debate',
  open_chat: 'Chat',
  pinned: 'Pinned',
  strategy_session: 'Strategy',
  system: 'System',
};

const CATEGORY_META = {
  technical:    { label: 'Technical',    color: '#5eead4' },
  fundamental:  { label: 'Fundamental',  color: '#a78bfa' },
  risk:         { label: 'Risk',         color: '#f97066' },
  allocation:   { label: 'Allocation',   color: '#f59e0b' },
};

function getAgentLevel(agent) {
  const gamesPlayed = agent?.stats?.gamesPlayed || 0;
  if (gamesPlayed >= 15) return 'partner';
  if (gamesPlayed >= 5) return 'starter';
  return 'rookie';
}

const PlaybookPanel = ({ isOpen, onClose, agent, tokens, onNavigateToForge }) => {
  const [addingRule, setAddingRule] = useState(false);
  const [newRuleText, setNewRuleText] = useState('');
  const [saving, setSaving] = useState(false);
  const [equippedBundles, setEquippedBundles] = useState([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [expandedBundleId, setExpandedBundleId] = useState(null);
  const [unequippingId, setUnequippingId] = useState(null);
  const [confirmUnequipId, setConfirmUnequipId] = useState(null);

  const directives = agent?.directives || [];
  const gamesPlayed = agent?.stats?.gamesPlayed || 0;
  const levelCfg = getLevelConfig(gamesPlayed);
  const maxSlots = levelCfg.playbookSlots;
  const agentLevel = getAgentLevel(agent);
  const forgeLimits = FORGE_LIMITS[agentLevel] || FORGE_LIMITS.rookie;
  const equippedBundleIds = agent?.equippedBundleIds || [];

  // Fetch equipped bundle docs
  useEffect(() => {
    if (!isOpen || !agent?.id || equippedBundleIds.length === 0) {
      setEquippedBundles([]);
      return;
    }

    let cancelled = false;
    const fetchBundles = async () => {
      setBundlesLoading(true);
      try {
        const results = [];
        for (const bundleId of equippedBundleIds) {
          const snap = await getDoc(doc(db, 'agents', agent.id, 'bundles', bundleId));
          if (snap.exists()) {
            results.push({ id: snap.id, ...snap.data() });
          }
        }
        if (!cancelled) setEquippedBundles(results);
      } catch (err) {
        console.error('[Playbook] Failed to load bundles:', err);
      } finally {
        if (!cancelled) setBundlesLoading(false);
      }
    };

    fetchBundles();
    return () => { cancelled = true; };
  }, [isOpen, agent?.id, equippedBundleIds.length]);

  const { active, inactive } = useMemo(() => {
    const now = new Date();
    const act = [];
    const inact = [];
    for (const d of directives) {
      const expired = d.expiresAt && new Date(d.expiresAt) < now;
      const toggled = d.isActive === false;
      if (expired || toggled) {
        inact.push({ ...d, reason: expired ? 'expired' : 'toggled off' });
      } else {
        act.push(d);
      }
    }
    act.sort((a, b) => {
      const pa = a.priority || 0;
      const pb = b.priority || 0;
      if (pa !== pb) return pb - pa;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return { active: act, inactive: inact };
  }, [directives]);

  const handleToggle = async (d) => {
    const newActive = d.isActive === false ? true : false;
    try {
      await toggleDirective(agent.id, d.id, newActive);
    } catch (err) {
      console.error('[Playbook] Toggle failed:', err.message);
    }
  };

  const handlePin = async (d) => {
    const isPinned = (d.priority || 0) > 0;
    try {
      await pinDirective(agent.id, d.id, !isPinned);
    } catch (err) {
      console.error('[Playbook] Pin failed:', err.message);
    }
  };

  const handleDelete = async (d) => {
    try {
      await removeDirective(agent.id, d);
    } catch (err) {
      console.error('[Playbook] Delete failed:', err.message);
    }
  };

  const handleAddRule = async () => {
    if (!newRuleText.trim() || saving || !agent?.id) return;
    if (active.length >= maxSlots) return;
    setSaving(true);
    try {
      await addCoachingRule(agent.id, newRuleText.trim());
      setNewRuleText('');
      setAddingRule(false);
    } catch (err) {
      console.error('[Playbook] Add rule failed:', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnequip = async (bundleId) => {
    if (agent?.activeBattleId) {
      setConfirmUnequipId(null);
      return;
    }
    setUnequippingId(bundleId);
    setConfirmUnequipId(null);
    try {
      await unequipBundle(agent.id, bundleId);
      // Re-fetch equipped bundles locally
      setEquippedBundles(prev => prev.filter(b => b.id !== bundleId));
    } catch (err) {
      console.error('[Playbook] Unequip failed:', err.message);
    } finally {
      setUnequippingId(null);
    }
  };

  const handleNavigateToForge = () => {
    onClose();
    if (onNavigateToForge) onNavigateToForge();
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format rules in C1/C2/S1/S2 style
  // Constraints = risk + allocation, Strategy = technical + fundamental
  const formatBundleRules = (snapshots) => {
    const constraints = (snapshots || []).filter(s => s.category === 'risk' || s.category === 'allocation');
    const strategy = (snapshots || []).filter(s => s.category === 'technical' || s.category === 'fundamental');
    const result = [];
    constraints.forEach((s, i) => result.push({ label: `C${i + 1}`, ...s }));
    strategy.forEach((s, i) => result.push({ label: `S${i + 1}`, ...s }));
    return result;
  };

  const renderDirective = (d, showActions = true) => {
    const sourceColor = SOURCE_COLORS[d.source] || tokens.textMuted;
    const isPinned = (d.priority || 0) > 0;
    return (
      <div key={d.id} style={{
        padding: '10px 12px', borderRadius: '10px', marginBottom: '6px',
        background: hexToRgba(sourceColor, 0.05),
        border: `1px solid ${hexToRgba(sourceColor, 0.15)}`,
      }}>
        <div style={{ fontSize: '12px', color: tokens.textPrimary, fontWeight: 500, marginBottom: '4px', lineHeight: '1.4' }}>
          {isPinned && <Pin size={10} color={sourceColor} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
          {d.text}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              padding: '1px 6px', borderRadius: '6px', fontSize: '9px', fontWeight: 600,
              color: sourceColor, background: hexToRgba(sourceColor, 0.12),
            }}>
              {SOURCE_LABELS[d.source] || d.source}
            </span>
            <span style={{ fontSize: '10px', color: tokens.textFaint }}>
              {formatDate(d.createdAt)}
            </span>
          </div>
          {showActions && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => handleToggle(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: tokens.textMuted }}>
                {d.isActive === false
                  ? <ToggleLeft size={14} />
                  : <ToggleRight size={14} color={tokens.teal} />}
              </button>
              <button onClick={() => handlePin(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: isPinned ? '#ec4899' : tokens.textMuted }}>
                {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
              </button>
              <button onClick={() => handleDelete(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: tokens.textMuted }}>
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <CenteredModal isOpen={isOpen} onClose={onClose} title="Playbook">
      <div style={{ padding: '0 20px 20px', overflowY: 'auto', maxHeight: '65vh' }}>
        {/* Bundle slot counter */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '14px', padding: '8px 12px', borderRadius: '10px',
          background: hexToRgba(tokens.teal, 0.06),
        }}>
          <span style={{ fontSize: '12px', color: tokens.textSecondary }}>
            {equippedBundles.length} / {forgeLimits.maxBundles} bundle{forgeLimits.maxBundles !== 1 ? 's' : ''} equipped
          </span>
          <span style={{ fontSize: '10px', fontWeight: 600, color: tokens.teal }}>
            {levelCfg.label} level
          </span>
        </div>

        {/* ── EQUIPPED BUNDLES ── */}
        <div style={{
          fontSize: '10px', fontWeight: 600, color: tokens.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '8px',
        }}>
          Equipped Bundles ({equippedBundles.length})
        </div>

        {bundlesLoading ? (
          <div style={{ padding: '12px', fontSize: '12px', color: tokens.textFaint, textAlign: 'center' }}>
            Loading bundles...
          </div>
        ) : equippedBundles.length > 0 ? (
          equippedBundles.map(bundle => {
            const isExpanded = expandedBundleId === bundle.id;
            const formattedRules = formatBundleRules(bundle.ruleSnapshots);
            const ruleCount = bundle.ruleSnapshots?.length || 0;
            const equippedDate = bundle.equippedAt ? formatDate(bundle.equippedAt) : '';

            return (
              <div key={bundle.id} style={{
                padding: '12px',
                borderRadius: '10px',
                marginBottom: '8px',
                background: hexToRgba('#22c55e', 0.05),
                border: `1px solid ${hexToRgba('#22c55e', 0.15)}`,
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Hammer size={13} color="#22c55e" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: tokens.textPrimary }}>
                      {bundle.name} v{bundle.version || 1}
                    </span>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 700,
                    color: '#22c55e', background: 'rgba(34,197,94,0.12)', textTransform: 'uppercase',
                  }}>
                    Equipped
                  </span>
                </div>

                <div style={{ fontSize: '10px', color: tokens.textMuted, marginBottom: '8px' }}>
                  {ruleCount} rule{ruleCount !== 1 ? 's' : ''}
                  {equippedDate && ` · Equipped ${equippedDate}`}
                </div>

                {/* Rules in C1/S1 format — always visible */}
                <div style={{
                  borderRadius: '8px',
                  border: `1px solid ${tokens.borderDefault}`,
                  overflow: 'hidden',
                  marginBottom: '8px',
                }}>
                  {formattedRules.map((rule, idx) => {
                    const catMeta = CATEGORY_META[rule.category];
                    return (
                      <div key={rule.id || idx} style={{
                        padding: '6px 10px',
                        borderBottom: idx < formattedRules.length - 1 ? `1px solid ${tokens.borderDefault}` : 'none',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: catMeta?.color || tokens.textMuted,
                          flexShrink: 0,
                          marginTop: '1px',
                        }}>
                          {rule.label}.
                        </span>
                        <span style={{ fontSize: '11px', color: tokens.textPrimary, lineHeight: '1.4' }}>
                          {rule.text}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {confirmUnequipId === bundle.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: tokens.textMuted }}>Unequip?</span>
                      <button
                        onClick={() => handleUnequip(bundle.id)}
                        disabled={unequippingId === bundle.id}
                        style={{
                          padding: '4px 10px', borderRadius: '6px', border: 'none',
                          background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                          opacity: unequippingId === bundle.id ? 0.5 : 1,
                        }}
                      >
                        {unequippingId === bundle.id ? '...' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmUnequipId(null)}
                        style={{
                          padding: '4px 10px', borderRadius: '6px',
                          border: `1px solid ${tokens.borderDefault}`,
                          background: 'transparent', color: tokens.textMuted,
                          fontSize: '10px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmUnequipId(bundle.id)}
                      style={{
                        padding: '4px 10px', borderRadius: '6px',
                        border: '1px solid rgba(239,68,68,0.2)',
                        background: 'transparent', color: '#ef4444',
                        fontSize: '10px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Unequip
                    </button>
                  )}
                  {onNavigateToForge && (
                    <button
                      onClick={handleNavigateToForge}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '4px 10px', borderRadius: '6px',
                        border: `1px solid ${tokens.borderDefault}`,
                        background: 'transparent', color: tokens.textMuted,
                        fontSize: '10px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      View in Forge <ArrowRight size={10} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: '12px', fontSize: '12px', color: tokens.textFaint, textAlign: 'center' }}>
            No bundles equipped yet.
          </div>
        )}

        {/* Equip a bundle CTA */}
        {equippedBundles.length < forgeLimits.maxBundles && onNavigateToForge && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleNavigateToForge}
            style={{
              width: '100%', padding: '10px', borderRadius: '10px',
              border: `1px dashed ${tokens.borderDefault}`,
              background: 'transparent', color: tokens.textMuted,
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              fontFamily: 'inherit', marginBottom: '6px',
            }}
          >
            <Plus size={14} />
            Equip a Bundle
          </motion.button>
        )}

        {/* Divider */}
        <div style={{
          margin: '16px 0 12px',
          borderTop: `1px solid ${tokens.borderDefault}`,
          paddingTop: '12px',
        }}>
          <div style={{
            fontSize: '10px', fontWeight: 600, color: tokens.textFaint,
            textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '8px',
          }}>
            Legacy Rules ({active.length})
          </div>
        </div>

        {/* Active rules (legacy directives) */}
        {active.length > 0 ? (
          active.map(d => renderDirective(d))
        ) : (
          <div style={{ padding: '12px', fontSize: '12px', color: tokens.textFaint, textAlign: 'center' }}>
            No active rules. Add one below or accept rules from the Film Room.
          </div>
        )}

        {/* Inactive rules */}
        {inactive.length > 0 && (
          <>
            <div style={{ fontSize: '10px', fontWeight: 600, color: tokens.textFaint, textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '16px', marginBottom: '8px' }}>
              Inactive ({inactive.length})
            </div>
            {inactive.map(d => renderDirective(d, true))}
          </>
        )}

        {/* Add rule */}
        <div style={{ marginTop: '16px' }}>
          {addingRule ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={newRuleText}
                onChange={e => setNewRuleText(e.target.value)}
                placeholder="Type a new rule..."
                maxLength={100}
                autoFocus
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: '10px',
                  border: `1px solid ${tokens.borderDefault}`, background: tokens.bgCard,
                  color: tokens.textPrimary, fontSize: '12px', fontFamily: 'inherit', outline: 'none',
                }}
                onKeyDown={e => e.key === 'Enter' && handleAddRule()}
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleAddRule}
                disabled={!newRuleText.trim() || saving || active.length >= maxSlots}
                style={{
                  padding: '8px 14px', borderRadius: '10px', border: 'none',
                  background: tokens.teal, color: '#000',
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: !newRuleText.trim() || saving ? 0.5 : 1,
                }}
              >
                {saving ? '...' : 'Add'}
              </motion.button>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (active.length >= maxSlots) return;
                setAddingRule(true);
              }}
              style={{
                width: '100%', padding: '10px', borderRadius: '10px',
                border: `1px dashed ${tokens.borderDefault}`,
                background: 'transparent', color: tokens.textMuted,
                fontSize: '12px', fontWeight: 600, cursor: active.length >= maxSlots ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                fontFamily: 'inherit', opacity: active.length >= maxSlots ? 0.5 : 1,
              }}
            >
              <Plus size={14} />
              {active.length >= maxSlots
                ? `Playbook full. Delete a rule or play more games to unlock slots.`
                : 'Add Rule Manually'}
            </motion.button>
          )}
        </div>
      </div>
    </CenteredModal>
  );
};

export default PlaybookPanel;
