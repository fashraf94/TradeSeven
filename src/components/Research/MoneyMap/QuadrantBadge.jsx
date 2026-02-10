// /src/components/Research/MoneyMap/QuadrantBadge.jsx

import React from 'react';

// UI-specific labels and arrows (different from engine's QUADRANT_LABELS)
const QUADRANT_UI = {
  LEADING:   { arrow: '\u2197', label: 'Market Leader', bg: 'rgba(16,185,129,0.15)',  text: '#10b981' },
  WEAKENING: { arrow: '\u2198', label: 'Cooling Off',   bg: 'rgba(245,158,11,0.15)',  text: '#f59e0b' },
  LAGGING:   { arrow: '\u2199', label: 'Underdog',      bg: 'rgba(239,68,68,0.15)',   text: '#ef4444' },
  IMPROVING: { arrow: '\u2196', label: 'Comeback Kid',  bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6' },
  NEUTRAL:   { arrow: '\u2192', label: 'Market Pace',   bg: 'rgba(139,148,158,0.15)', text: '#8b949e' },
};

/**
 * QuadrantBadge — Small pill-shaped badge displaying the momentum quadrant
 * @param {{ quadrant: string }} props
 */
const QuadrantBadge = ({ quadrant }) => {
  const ui = QUADRANT_UI[quadrant] || QUADRANT_UI.NEUTRAL;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: '600',
      background: ui.bg,
      color: ui.text,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: '10px' }}>{ui.arrow}</span>
      {ui.label}
    </span>
  );
};

export default QuadrantBadge;
