// src/components/SignalDrop/components/TypingIndicator.jsx
//
// Sprint 6 Phase 3B — three-dot typing indicator that reads as a Gemma
// agent bubble. Uses the `signaldrop-typing` keyframe (namespaced to
// match the existing `signaldrop-spin` from SignalDropEntry).
//
// Inline <style> block for the keyframe matches the project convention
// for one-shot animations rather than polluting the global stylesheet.

import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../../contexts/ThemeContext';

export default function TypingIndicator({ agentName }) {
  const { tokens } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          color: tokens.teal,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: 4,
          paddingLeft: 4,
        }}
      >
        {agentName || 'Gemma'}
      </div>
      <div
        style={{
          background: tokens.bgCard,
          borderLeft: `3px solid ${tokens.teal}`,
          borderRadius: '0 12px 12px 12px',
          padding: '12px 16px',
          display: 'flex',
          gap: 5,
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              background: tokens.teal,
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'signaldrop-typing 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes signaldrop-typing {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </motion.div>
  );
}
