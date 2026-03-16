// src/components/FantasyTimes/visuals/SectorHeatmap.jsx
// Kim's sector grid — CSS grid of colored tiles showing sector performance.

import React from 'react';
import { motion } from 'framer-motion';
import { DARK_TOKENS } from '../../../theme/tokens';
import { VISUAL_HEIGHTS } from '../StoryVisualSafe';

const SECTOR_NAMES = {
  XLK: 'Tech',
  XLF: 'Finance',
  XLV: 'Health',
  XLE: 'Energy',
  XLI: 'Industrial',
  XLY: 'Consumer',
  XLP: 'Staples',
  XLU: 'Utilities',
  XLRE: 'Real Estate',
  XLC: 'Comms',
  XLB: 'Materials',
};

function getTileColor(pctChange) {
  const abs = Math.abs(pctChange || 0);
  const intensity = Math.min(abs / 3, 1);

  if (abs < 0.1) return DARK_TOKENS.bgCard;
  if (pctChange > 0) return `rgba(16,185,129,${0.15 + intensity * 0.45})`;
  return `rgba(239,68,68,${0.15 + intensity * 0.45})`;
}

export default function SectorHeatmap({ config, size }) {
  const height = VISUAL_HEIGHTS[size] || VISUAL_HEIGHTS.compact;
  const allSectors = (config.sectors || [])
    .slice()
    .sort((a, b) => Math.abs(b.pctChange || 0) - Math.abs(a.pctChange || 0));

  if (allSectors.length === 0) return null;

  let sectors, columns, gap;
  if (size === 'micro') {
    sectors = allSectors.slice(0, 3);
    columns = 3;
    gap = 4;
  } else if (size === 'compact') {
    sectors = allSectors.slice(0, 6);
    columns = 3;
    gap = 4;
  } else {
    sectors = allSectors.slice(0, 12);
    columns = 4;
    gap = 6;
  }

  const top3 = allSectors.slice(0, 3);
  const ariaLabel = `Sector performance: ${top3.map(s => `${SECTOR_NAMES[s.symbol] || s.symbol} ${s.pctChange > 0 ? '+' : ''}${(s.pctChange || 0).toFixed(1)}%`).join(', ')}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
      style={{
        height,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: size === 'micro' ? '4px' : '8px',
        boxSizing: 'border-box',
      }}
      role="img"
      aria-label={ariaLabel}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: gap,
        width: '100%',
        height: '100%',
      }}>
        {sectors.map((sector, i) => {
          const name = SECTOR_NAMES[sector.symbol] || sector.name || sector.symbol;
          const pct = sector.pctChange || 0;

          return (
            <div
              key={sector.symbol || i}
              style={{
                backgroundColor: getTileColor(pct),
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: size === 'micro' ? 2 : 4,
                overflow: 'hidden',
              }}
            >
              <span style={{
                color: '#e6edf3',
                fontSize: size === 'micro' ? 10 : 11,
                fontWeight: 700,
                lineHeight: 1.2,
              }}>
                {sector.symbol}
              </span>
              {size !== 'micro' && (
                <span style={{
                  color: '#8b949e',
                  fontSize: 9,
                  lineHeight: 1.2,
                  marginTop: 1,
                }}>
                  {name}
                </span>
              )}
              {size === 'expanded' && (
                <span style={{
                  color: pct >= 0 ? '#10b981' : '#ef4444',
                  fontSize: 9,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  marginTop: 2,
                }}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
