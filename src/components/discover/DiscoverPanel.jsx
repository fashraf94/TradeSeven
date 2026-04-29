// src/components/discover/DiscoverPanel.jsx
//
// Discover panel — the inspiration surface of the Forge.
//
// Sprint 1 Phase 1: placeholder shell. Subsequent phases populate the
// panel with the ThemeCard grid, modal interaction, and analytics
// writes (Phase 2 + Phase 3 of the Discover sprint).

import React from 'react';

const TEXT_PRIMARY = '#F1F5F9';
const TEXT_SECONDARY = '#8B949E';

export default function DiscoverPanel() {
  return (
    <div style={{ padding: '24px 4px' }}>
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
          color: TEXT_PRIMARY,
          lineHeight: 1.2,
        }}
      >
        Discover
      </h2>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 14,
          color: TEXT_SECONDARY,
          lineHeight: 1.5,
        }}
      >
        Explore investable themes.
      </p>
    </div>
  );
}
