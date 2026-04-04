// src/components/Forge/ParamControls/ParamPicker.jsx
// Segmented pill picker for 'select' type params in the Rule Config Drawer.

import React from 'react';

export default function ParamPicker({ param, value, onChange, categoryColor }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {/* Label */}
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: '#E6EDF3',
        marginBottom: 6,
      }}>
        {param.label}
      </div>

      {/* Pill row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
      }}>
        {param.options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                onChange(option.value);
              }}
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: isSelected ? categoryColor : '#8b949e',
                background: isSelected ? `${categoryColor}1A` : '#15171E',
                border: `1px solid ${isSelected ? categoryColor : '#2A2D35'}`,
                borderRadius: 8,
                padding: '5px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Hint */}
      {param.hint && (
        <div style={{
          fontSize: 11,
          color: '#6E7681',
          marginTop: 6,
          lineHeight: 1.4,
        }}>
          {param.hint}
        </div>
      )}
    </div>
  );
}
