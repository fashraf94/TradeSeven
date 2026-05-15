// src/components/Forge/Watchlist/TickerChip.jsx
//
// Sprint 6 Phase 4B — shared ticker chip for the watchlist editor. Renders a
// symbol with a visual distinction between individual stocks and ETFs:
// ETFs (sector or industry) get a purple-tinted border and a small "ETF"
// tag; stocks get the neutral border.
//
// When an `onRemove` handler is supplied the chip becomes slide-to-delete:
// drag it left past the threshold to remove it (Phase 4B audit D-A-7).
// Without `onRemove` the chip is static — used for read-only / committed
// watchlists.

import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SLIDE_THRESHOLD = 80;

// Aliased to a capitalized name: this lint config has no eslint-plugin-react,
// so a bare `motion.span` in JSX would read as an unused `motion` import.
const MotionSpan = motion.span;

export default function TickerChip({ symbol, type, tokens, onRemove }) {
  const isEtf = type === 'sector_etf' || type === 'industry_etf';

  const chipStyle = {
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
  };

  const inner = (
    <>
      {symbol}
      {isEtf && (
        <span style={{ fontSize: 8.5, fontWeight: 700, color: tokens.purpleText, letterSpacing: '0.5px' }}>
          ETF
        </span>
      )}
    </>
  );

  if (!onRemove) {
    return <span style={chipStyle}>{inner}</span>;
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Red remove affordance, revealed as the chip is dragged off it. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 7,
          borderRadius: 6,
          background: tokens.red,
        }}
      >
        <X size={12} color="#ffffff" />
      </div>
      <MotionSpan
        drag="x"
        dragConstraints={{ left: -(SLIDE_THRESHOLD + 24), right: 0 }}
        dragSnapToOrigin
        dragElastic={0.12}
        onDragEnd={(event, info) => {
          if (info.offset.x <= -SLIDE_THRESHOLD) onRemove();
        }}
        whileDrag={{ cursor: 'grabbing' }}
        title={`Slide left to remove ${symbol}`}
        style={{ ...chipStyle, position: 'relative', cursor: 'grab', touchAction: 'pan-y' }}
      >
        {inner}
      </MotionSpan>
    </div>
  );
}
