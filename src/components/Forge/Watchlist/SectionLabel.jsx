// src/components/Forge/Watchlist/SectionLabel.jsx
//
// Small uppercase teal section header. Extracted verbatim from
// SignalDrop/SignalDropEntry.jsx so the watchlist editor can reuse it
// without duplicating the style block.

import React from 'react';

export default function SectionLabel({ tokens, children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.6px',
        textTransform: 'uppercase',
        color: tokens.teal,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}
