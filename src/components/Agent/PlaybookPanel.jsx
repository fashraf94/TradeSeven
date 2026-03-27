import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Pin, PinOff, ToggleLeft, ToggleRight, Trash2, Plus } from 'lucide-react';
import CenteredModal from '../shared/CenteredModal';
import { toggleDirective, pinDirective, removeDirective, addCoachingRule } from '../../services/agentService';

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

function getMaxSlots(gamesPlayed) {
  if (gamesPlayed >= 15) return 20;
  if (gamesPlayed >= 5) return 10;
  return 5;
}

function getLevelLabel(gamesPlayed) {
  if (gamesPlayed >= 15) return 'Partner';
  if (gamesPlayed >= 5) return 'Starter';
  return 'Rookie';
}

const PlaybookPanel = ({ isOpen, onClose, agent, tokens }) => {
  const [addingRule, setAddingRule] = useState(false);
  const [newRuleText, setNewRuleText] = useState('');
  const [saving, setSaving] = useState(false);

  const directives = agent?.directives || [];
  const gamesPlayed = agent?.stats?.gamesPlayed || 0;
  const maxSlots = getMaxSlots(gamesPlayed);

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
    // Sort active: pinned first (priority > 0), then by createdAt descending
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

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
        {/* Slot counter */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '14px', padding: '8px 12px', borderRadius: '10px',
          background: hexToRgba(tokens.teal, 0.06),
        }}>
          <span style={{ fontSize: '12px', color: tokens.textSecondary }}>
            {active.length} / {maxSlots} slots used
          </span>
          <span style={{ fontSize: '10px', fontWeight: 600, color: tokens.teal }}>
            {getLevelLabel(gamesPlayed)} level
          </span>
        </div>

        {/* Active rules */}
        <div style={{ fontSize: '10px', fontWeight: 600, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '8px' }}>
          Active Rules ({active.length})
        </div>
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
