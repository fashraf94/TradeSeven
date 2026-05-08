// src/components/SignalDrop/components/ChatBubble.jsx
//
// Sprint 6 Phase 3B — chat message bubble for the WatchlistChat dialogue.
// Role-aware styling (user vs agent) plus an optional phase tag that
// indicates which dialogue phase the message was sent in. Workshop's
// inline ChatBubble doesn't carry a phase, so this is the dialogue-
// specific variant rather than a generic refactor.
//
// Markdown is intentionally not parsed — content is rendered verbatim
// with whiteSpace: pre-wrap so paragraphs and line breaks survive.

import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../../contexts/ThemeContext';

const PHASE_LABELS = {
  explore: 'Explore',
  propose: 'Propose',
  refine: 'Refine',
  finalize: 'Finalize',
};

function phaseTagColor(phase, tokens) {
  switch (phase) {
    case 'explore':
      return tokens.teal;
    case 'propose':
      return tokens.emerald;
    case 'refine':
      return tokens.amber;
    case 'finalize':
      return tokens.medalGold;
    default:
      return tokens.textMuted;
  }
}

export default function ChatBubble({ role, content, phase, agentName }) {
  const { tokens } = useTheme();
  const isUser = role === 'user';
  const phaseLabel = phase && PHASE_LABELS[phase] ? PHASE_LABELS[phase] : null;
  const phaseColor = phaseTagColor(phase, tokens);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
        width: '100%',
      }}
    >
      {!isUser && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4,
            paddingLeft: 4,
          }}
        >
          <span
            style={{
              color: tokens.teal,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {agentName || 'Gemma'}
          </span>
          {phaseLabel && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                padding: '2px 6px',
                borderRadius: 4,
                background: `${phaseColor}1a`,
                color: phaseColor,
                border: `1px solid ${phaseColor}40`,
              }}
            >
              {phaseLabel}
            </span>
          )}
        </div>
      )}

      <div
        style={{
          background: isUser ? tokens.bgAgent : tokens.bgCard,
          borderLeft: isUser ? 'none' : `3px solid ${tokens.teal}`,
          borderRadius: isUser ? '12px 12px 0 12px' : '0 12px 12px 12px',
          padding: '10px 14px',
          maxWidth: '85%',
          color: tokens.textPrimary,
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content}
      </div>

      {isUser && phaseLabel && (
        <div
          style={{
            marginTop: 4,
            paddingRight: 4,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              padding: '2px 6px',
              borderRadius: 4,
              background: `${phaseColor}14`,
              color: phaseColor,
              border: `1px solid ${phaseColor}33`,
            }}
          >
            {phaseLabel}
          </span>
        </div>
      )}
    </motion.div>
  );
}
