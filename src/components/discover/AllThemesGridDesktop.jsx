// src/components/discover/AllThemesGridDesktop.jsx
//
// Desktop variant of the All Themes catalog. Lifts the existing
// inline grid from DiscoverPanel.jsx (Phase 1) into its own component
// so the showcase router can swap it for the mobile carousel without
// special-casing in the parent. Grid CSS is preserved byte-for-byte:
//   gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16

import React from 'react';
import ThemeCard from './ThemeCard';

export default function AllThemesGridDesktop({ themes, onTap }) {
  if (!Array.isArray(themes) || themes.length === 0) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 16,
      }}
    >
      {themes.map((theme) => (
        <ThemeCard key={theme.id} theme={theme} onTap={onTap} />
      ))}
    </div>
  );
}
