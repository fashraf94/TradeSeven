// src/components/Forge/MechVisorStrip.jsx
// 48px sticky header showing Class Title + Bundle Name when mech scrolls away (mobile).

import React from 'react';

export default function MechVisorStrip({ comboLabel, archetype, activeBundleName, onTapToExpand }) {
  return (
    <div
      onClick={onTapToExpand}
      style={{
        height: 48,
        background: '#0D0E12',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: '1px solid #2A2D35',
        cursor: 'pointer',
      }}
    >
      {/* Left: Class Title */}
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        fontStyle: 'italic',
        color: '#5EEAD4',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '50%',
      }}>
        {comboLabel ? `The ${comboLabel.label}` : archetype || 'Agent'}
      </div>

      {/* Right: Bundle Name */}
      <div style={{
        fontSize: 12,
        color: '#718096',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '45%',
      }}>
        {activeBundleName || 'No Strategy'}
      </div>
    </div>
  );
}
