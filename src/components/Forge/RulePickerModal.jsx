// src/components/Forge/RulePickerModal.jsx
// Modal for selecting rules to add to a bundle.

import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import CenteredModal from '../shared/CenteredModal';

const CATEGORY_META = {
  technical:    { label: 'Technical',    color: '#5eead4' },
  fundamental:  { label: 'Fundamental',  color: '#a78bfa' },
  risk:         { label: 'Risk',         color: '#f97066' },
  allocation:   { label: 'Allocation',   color: '#f59e0b' },
  mid_battle:   { label: 'Mid-Battle',   color: '#38bdf8' },
  game_state:   { label: 'Game State',   color: '#fb923c' },
  threshold:    { label: 'Threshold',    color: '#e879f9' },
  tier_strategy:{ label: 'Tier Strategy', color: '#fbbf24' },
};

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'technical', label: 'Technical' },
  { id: 'fundamental', label: 'Fundamental' },
  { id: 'risk', label: 'Risk' },
  { id: 'allocation', label: 'Allocation' },
  { id: 'mid_battle', label: 'Mid-Battle' },
  { id: 'game_state', label: 'Game State' },
  { id: 'threshold', label: 'Threshold' },
  { id: 'tier_strategy', label: 'Tier Strategy' },
];

export default function RulePickerModal({ isOpen, onClose, rules, bundleRuleIds, onAdd, tokens }) {
  const [catFilter, setCatFilter] = useState('all');
  const [addingId, setAddingId] = useState(null);

  const availableRules = useMemo(() => {
    const excluded = new Set(bundleRuleIds || []);
    let available = (rules || []).filter(r => !excluded.has(r.id));
    if (catFilter !== 'all') {
      available = available.filter(r => r.category === catFilter);
    }
    return available;
  }, [rules, bundleRuleIds, catFilter]);

  const handleAdd = async (ruleId) => {
    setAddingId(ruleId);
    await onAdd(ruleId);
    setAddingId(null);
    onClose();
  };

  return (
    <CenteredModal isOpen={isOpen} onClose={onClose} title="Add Rule to Bundle">
      <div style={{ padding: '0 20px 20px', maxHeight: '60vh', overflowY: 'auto' }}>
        {/* Category filter pills */}
        <div style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '14px',
          flexWrap: 'wrap',
        }}>
          {CATEGORY_FILTERS.map(f => {
            const isActive = catFilter === f.id;
            const color = f.id === 'all' ? (tokens?.teal || '#5eead4') : CATEGORY_META[f.id]?.color;
            return (
              <button
                key={f.id}
                onClick={() => setCatFilter(f.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '14px',
                  fontSize: '11px',
                  fontWeight: isActive ? 600 : 500,
                  border: isActive ? `1px solid ${color}4D` : '1px solid rgba(255,255,255,0.08)',
                  background: isActive ? `${color}20` : 'rgba(255,255,255,0.04)',
                  color: isActive ? color : (tokens?.textMuted || '#8b949e'),
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Rule list */}
        {availableRules.length === 0 ? (
          <div style={{
            padding: '30px 20px',
            textAlign: 'center',
            borderRadius: '12px',
            background: tokens?.bgCard || '#161b22',
            border: `1px solid ${tokens?.borderDefault || '#30363d'}`,
          }}>
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>🔍</div>
            <div style={{ fontSize: '13px', color: tokens?.textMuted || '#8b949e' }}>
              No more rules available.
            </div>
            <div style={{ fontSize: '11px', color: tokens?.textFaint || '#484f58', marginTop: '4px' }}>
              Discover more in the Discover tab.
            </div>
          </div>
        ) : (
          availableRules.map(rule => {
            const meta = CATEGORY_META[rule.category];
            const isAdding = addingId === rule.id;
            return (
              <div
                key={rule.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  marginBottom: '6px',
                  background: tokens?.bgCard || '#161b22',
                  border: `1px solid ${tokens?.borderDefault || '#30363d'}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {meta && (
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '9px',
                      fontWeight: 600,
                      color: meta.color,
                      background: `${meta.color}18`,
                      marginBottom: '4px',
                    }}>
                      {meta.label}
                    </span>
                  )}
                  <div style={{
                    fontSize: '12px',
                    color: tokens?.textPrimary || '#e6edf3',
                    lineHeight: '1.4',
                  }}>
                    {rule.text}
                  </div>
                </div>
                <button
                  onClick={() => handleAdd(rule.id)}
                  disabled={isAdding}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: tokens?.teal || '#5eead4',
                    color: '#000',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: isAdding ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: isAdding ? 0.5 : 1,
                  }}
                >
                  <Plus size={12} />
                  {isAdding ? '...' : 'Add'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </CenteredModal>
  );
}
