// src/components/Forge/MechVisorStrip.jsx
// 70px sticky header that appears when user scrolls past the mech hero zone.

import React from 'react';
import MechSVG from './MechSVG';

export default function MechVisorStrip({ bundleName, capacity, onTapToExpand }) {
  return (
    <div
      onClick={onTapToExpand}
      style={{
        height: 70,
        background: '#0D0E12',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        cursor: 'pointer',
        gap: 12,
      }}
    >
      {/* Visor crop */}
      <div style={{ flexShrink: 0, width: 120 }}>
        <MechSVG size="visor" state="idle" />
      </div>

      {/* Bundle name */}
      <div style={{
        flex: 1,
        fontSize: 14,
        fontWeight: 700,
        color: '#ffffff',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {bundleName || 'The Forge'}
      </div>

      {/* Capacity */}
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        color: '#5EEAD4',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        flexShrink: 0,
      }}>
        {capacity.current}/{capacity.max} rules
      </div>
    </div>
  );
}
