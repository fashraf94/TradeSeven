// src/components/Forge/StrategyControlsToggle.jsx
// Segmented control for switching between Strategy and Controls rule groups.

import React from 'react';
import { motion } from 'framer-motion';

const SEGMENTS = [
  { id: 'strategy', label: '\u{1F9E0} STRATEGY' },
  { id: 'controls', label: '\u{2699}\u{FE0F} CONTROLS' },
];

export default function StrategyControlsToggle({ activeGroup, onToggle }) {
  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: 44,
      borderRadius: 10,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {SEGMENTS.map(seg => {
        const isActive = activeGroup === seg.id;
        return (
          <button
            key={seg.id}
            onClick={() => onToggle(seg.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              background: isActive ? '#1C1A27' : '#15171E',
              color: isActive ? '#5EEAD4' : '#718096',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              transition: 'background 0.2s, color 0.2s',
              boxShadow: isActive ? '0 0 15px rgba(94,234,212,0.1)' : 'none',
            }}
          >
            {isActive && (
              <motion.div
                layoutId="toggle-active"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 10,
                  border: '1px solid rgba(94,234,212,0.2)',
                  pointerEvents: 'none',
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{seg.label}</span>
          </button>
        );
      })}
    </div>
  );
}
