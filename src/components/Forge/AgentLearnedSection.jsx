// src/components/Forge/AgentLearnedSection.jsx
// Collapsible section for rules learned from non-Forge sources (debates, coaching, reflections).

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown } from 'lucide-react';

const SOURCE_BADGES = {
  batch_review: { label: 'Coached', color: '#a78bfa' },
  agent_batch_review: { label: 'Coached', color: '#a78bfa' },
  debate: { label: 'Debated', color: '#f97066' },
  agent_debate: { label: 'Debated', color: '#f97066' },
  open_chat: { label: 'Coached', color: '#5eead4' },
  agent_open_chat: { label: 'Coached', color: '#5eead4' },
  reflection: { label: 'Reflected', color: '#f59e0b' },
  agent_reflection: { label: 'Reflected', color: '#f59e0b' },
};

function LearnedRuleCard({ rule }) {
  const badge = SOURCE_BADGES[rule.source] || { label: 'Learned', color: '#8b949e' };

  return (
    <div style={{
      background: '#15171E',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.06)',
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Source badge dot */}
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: badge.color,
          background: `${badge.color}1A`,
          borderRadius: 6,
          padding: '2px 8px',
          flexShrink: 0,
          marginTop: 2,
        }}>
          {badge.label}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            color: '#e6edf3',
            lineHeight: 1.4,
          }}>
            {rule.text}
          </div>
          {rule.category && (
            <div style={{
              fontSize: 10,
              color: '#4a5568',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginTop: 4,
            }}>
              {rule.category}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentLearnedSection({ rules, isExpanded, onToggle }) {
  if (!rules || rules.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '12px 14px',
          background: '#15171E',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          gap: 10,
        }}
      >
        <Brain size={16} color="#a78bfa" />
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#e6edf3',
          flex: 1,
          textAlign: 'left',
        }}>
          Agent Learned ({rules.length} rule{rules.length !== 1 ? 's' : ''})
        </span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <ChevronDown size={16} color="#4a5568" />
        </motion.div>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '8px 0 0 0' }}>
              {rules.map(rule => (
                <LearnedRuleCard key={rule.id} rule={rule} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
