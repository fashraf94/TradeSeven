// src/components/Forge/DNAGroupCard.jsx
// Expandable card for one DNA group (Instincts, Strategy, Discipline).

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Eye, Brain, Shield } from 'lucide-react';

const GROUP_ICONS = { Eye, Brain, Shield };

function getIcon(name, props) {
  const Icon = GROUP_ICONS[name];
  return Icon ? <Icon {...props} /> : null;
}

export default function DNAGroupCard({
  group,
  equippedTraits,
  slotUsage,
  totalRulesInGroup,
  equippedRuleCount,
  isExpanded,
  onToggle,
  children,
}) {
  const { used, max } = slotUsage;
  const fillPct = totalRulesInGroup > 0 ? Math.min((equippedRuleCount / totalRulesInGroup) * 100, 100) : 0;

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Header (clickable) */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#15171E',
          border: 'none',
          borderLeft: `4px solid ${group.color}`,
          borderRadius: 8,
          padding: '12px 14px',
          cursor: 'pointer',
          textAlign: 'left',
          position: 'relative',
        }}
      >
        {/* Icon + text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            {getIcon(group.icon, { size: 20, color: group.color, strokeWidth: 2 })}
            <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
              {group.name}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#718096', marginBottom: 8 }}>
            {group.description}
          </div>

          {/* Fill bar */}
          <div style={{
            height: 3, borderRadius: 2, background: '#1C1A27',
            marginBottom: 6, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2, background: group.color,
              width: `${fillPct}%`, transition: 'width 0.3s ease',
            }} />
          </div>

          {/* Slot usage + equipped trait names */}
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, marginTop: 4 }}>
            <span style={{ color: used > 0 ? '#5EEAD4' : '#4A5568' }}>
              {used === 0 && `Choose up to ${max} traits`}
              {used > 0 && used < max && `${used} of ${max} chosen`}
              {used >= max && `${max} of ${max} chosen (max)`}
            </span>
            {equippedTraits.length > 0 && (
              <span style={{ color: '#5EEAD4', fontSize: 11, marginLeft: 8 }}>
                — {equippedTraits.map(t => t.name).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Right side: rule count + chevron */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#718096', whiteSpace: 'nowrap' }}>
            {equippedRuleCount} / {totalRulesInGroup} rules
          </span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={16} color="#718096" />
          </motion.div>
        </div>
      </button>

      {/* Expanded content: trait cards */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 8 }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
