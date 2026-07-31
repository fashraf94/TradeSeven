// src/components/Forge/ParamControls/ParamToggle.jsx
// iOS-style toggle for 'toggle' type params in the Rule Config Drawer.

import React from 'react';
import { motion } from 'framer-motion';
import { snappy } from '../../../theme/motion';

export default function ParamToggle({ param, value, onChange, categoryColor }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {/* Row: label + toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#E6EDF3',
        }}>
          {param.label}
        </span>

        {/* Toggle track */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChange(!value);
          }}
          style={{
            width: 44,
            height: 24,
            borderRadius: 12,
            border: 'none',
            background: value ? categoryColor : '#2A2D35',
            cursor: 'pointer',
            position: 'relative',
            padding: 0,
            flexShrink: 0,
            transition: 'background 0.2s ease',
          }}
        >
          {/* Knob */}
          <motion.div
            animate={{ x: value ? 20 : 0 }}
            transition={snappy}
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              background: '#ffffff',
              position: 'absolute',
              top: 2,
              left: 2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </button>
      </div>

      {/* Hint */}
      {param.hint && (
        <div style={{
          fontSize: 11,
          color: '#6E7681',
          marginTop: 4,
          lineHeight: 1.4,
        }}>
          {param.hint}
        </div>
      )}
    </div>
  );
}
