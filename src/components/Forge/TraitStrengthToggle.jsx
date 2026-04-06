// src/components/Forge/TraitStrengthToggle.jsx
// Three-segment toggle for trait strength: Subtle | Moderate | Dominant

import React from 'react';
import { motion } from 'framer-motion';

const STRENGTHS = ['subtle', 'moderate', 'dominant'];
const LABELS = { subtle: 'Subtle', moderate: 'Moderate', dominant: 'Dominant' };

export default function TraitStrengthToggle({ value, onChange, color = '#5EEAD4', disabled = false, showCustom = false, onReset }) {
  if (showCustom && value === 'custom') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 6, border: '1px solid #2A2D35', padding: '4px 12px',
          fontSize: 11, fontWeight: 600, color: '#F59E0B',
          background: 'rgba(245, 158, 11, 0.1)',
          width: '100%',
        }}>
          Custom*
        </div>
        {onReset && (
          <button
            onClick={onReset}
            disabled={disabled}
            style={{
              background: 'none', border: 'none', color: '#718096',
              fontSize: 10, cursor: disabled ? 'default' : 'pointer',
              textDecoration: 'underline', padding: 0,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            Reset to preset
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', borderRadius: 6, border: '1px solid #2A2D35',
      overflow: 'hidden', position: 'relative',
    }}>
      {STRENGTHS.map(s => {
        const isActive = value === s;
        return (
          <motion.button
            key={s}
            layout
            onClick={() => !disabled && onChange(s)}
            style={{
              flex: 1, padding: '4px 8px', fontSize: 11, fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer',
              border: 'none', outline: 'none',
              backgroundColor: isActive ? color : 'transparent',
              color: isActive ? '#ffffff' : '#718096',
              opacity: disabled ? 0.5 : 1,
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
          >
            {LABELS[s]}
          </motion.button>
        );
      })}
    </div>
  );
}
