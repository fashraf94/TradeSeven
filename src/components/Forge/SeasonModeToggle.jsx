// src/components/Forge/SeasonModeToggle.jsx
// Segmented pill control for Forge mode filter: Clash | Season | All.
// Uses Framer Motion layoutId for the animated active background.

import React from 'react';
import { motion } from 'framer-motion';

const MODES = [
  { key: 'clash', label: 'Clash', activeColor: '#00D9FF' },
  { key: 'season', label: 'Experiment', activeColor: '#F0C75E' },
  { key: 'all', label: 'All', activeColor: '#5EEAD4' },
];

export default function SeasonModeToggle({ mode = 'clash', onModeChange }) {
  return (
    <div style={{
      display: 'flex',
      background: '#15171E',
      borderRadius: 18,
      padding: 2,
      gap: 2,
    }}>
      {MODES.map((m) => {
        const isActive = mode === m.key;
        return (
          <button
            key={m.key}
            onClick={() => onModeChange && onModeChange(m.key)}
            style={{
              flex: 1,
              position: 'relative',
              padding: '8px 0',
              border: 'none',
              background: 'transparent',
              color: isActive ? m.activeColor : '#8B949E',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              zIndex: 1,
              borderRadius: 14,
            }}
          >
            {isActive && (
              <motion.div
                layoutId="modeTogglePill"
                transition={{ type: 'spring', duration: 0.3 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 14,
                  background: `${m.activeColor}33`, // 20% opacity
                }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 2 }}>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
