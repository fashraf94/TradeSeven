// src/components/Forge/Watchlist/TickerChip.jsx
//
// Sprint 6 Phase 4B — shared ticker chip for the watchlist editor. Renders a
// symbol with a visual distinction between individual stocks and ETFs:
// ETFs (sector or industry) get a purple-tinted border and a small "ETF"
// tag; stocks get the neutral border.
//
// B1 renders the chip static. B2 adds the slide-to-delete affordance.

import React from 'react';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export default function TickerChip({ symbol, type, tokens }) {
  const isEtf = type === 'sector_etf' || type === 'industry_etf';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: tokens.bgAgent,
        border: `1px solid ${isEtf ? tokens.borderPurple : tokens.borderDefault}`,
        color: tokens.teal,
        padding: '4px 9px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: MONO,
        letterSpacing: '0.3px',
      }}
    >
      {symbol}
      {isEtf && (
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            color: tokens.purpleText,
            letterSpacing: '0.5px',
          }}
        >
          ETF
        </span>
      )}
    </span>
  );
}
