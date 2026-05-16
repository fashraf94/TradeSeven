// src/components/Forge/Watchlist/WatchlistStatusFilter.jsx
//
// Sprint 6 Phase 4D — All / Drafts / Committed filter pills for the
// "My Watchlists" tab. Controlled component: the panel owns the active
// filter and the counts.

import React from 'react';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'committed', label: 'Committed' },
];

export default function WatchlistStatusFilter({ tokens, active, counts, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {FILTERS.map((f) => {
        const isActive = f.id === active;
        const count = counts?.[f.id] ?? 0;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              border: `1px solid ${isActive ? tokens.medalGold : tokens.borderDefault}`,
              background: isActive ? `${tokens.medalGold}1f` : 'transparent',
              color: isActive ? tokens.medalGold : tokens.textMuted,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {f.label}
            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
