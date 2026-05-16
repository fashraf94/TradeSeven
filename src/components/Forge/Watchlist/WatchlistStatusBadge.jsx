// src/components/Forge/Watchlist/WatchlistStatusBadge.jsx
//
// Sprint 6 Phase 4D — draft/committed status pill for watchlist list cards.
// Draft = teal; committed = trophy gold (tokens.medalGold). Anything that
// isn't 'committed' is treated as a draft.

import React from 'react';

export default function WatchlistStatusBadge({ tokens, status }) {
  const isCommitted = status === 'committed';
  const color = isCommitted ? tokens.medalGold : tokens.teal;
  const label = isCommitted ? 'Committed' : 'Draft';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        color,
        background: `${color}1f`,
        border: `1px solid ${color}3d`,
      }}
    >
      {label}
    </span>
  );
}
