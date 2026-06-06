// src/components/Search/ReturnRow.jsx
//
// Research Engine — Conversational Performance: the row for a RETURN-ranked screen.
//
// A sibling to RankRow, which is left byte-for-byte unchanged. RankRow renders a
// 0–100, one-directional score bar; a realized return is signed, so it needs a
// different visual shape — a DIVERGING bar from a center zero: green to the right
// when up, red to the left when down, normalized by the max-abs return across the
// result set so -3% and -30% read at different lengths. The row scaffold (rank ·
// ticker · sector chip · tap-to-research) matches RankRow so the screener's rows
// stay visually consistent, but it's implemented separately.
//
// Returns are REALIZED, PAST results. The label is a signed percent (+12.4% / -3.1%)
// colored by direction (tokens.emerald / tokens.red — distinct from the teal accent)
// with a magnitude-scaled background tint mirroring SectorPerformanceTable's idiom.

import React from 'react';
import { motion } from 'framer-motion';
import { resolveSectorInfo } from '../../utils/sectorUtils';
import { formatSignedPercent, returnColor } from './screenerAdapter';

// Local hex→rgba (matches the codebase idiom in DaySummaryCard / CategoryBadge) so
// the magnitude-scaled tint follows the active theme's emerald/red token.
function hexToRgba(hex, alpha) {
  const h = String(hex || '').replace('#', '');
  if (h.length < 6) return `rgba(127,127,127,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const TRACK_BG = 'rgba(255,255,255,0.06)';
const CENTER_TICK = 'rgba(255,255,255,0.18)';

const ReturnRow = ({ stock, rank, value, maxAbs, onTap, tokens }) => {
  const sectorInfo = resolveSectorInfo(stock);
  const n = Number(value);
  const hasValue = value != null && Number.isFinite(n);
  const isPositive = hasValue && n >= 0;
  const color = returnColor(value, tokens);

  // Each half spans the full max-abs range; the fill is |value| / maxAbs of its half.
  // Guard maxAbs === 0 (an all-null / all-zero set) so we never divide by zero.
  const fillPct = hasValue && maxAbs > 0 ? Math.min(100, (Math.abs(n) / maxAbs) * 100) : 0;
  // Magnitude-scaled tint behind the label (SectorPerformanceTable:90 precedent).
  const chipBg = hasValue ? hexToRgba(color, Math.min(Math.abs(n) * 0.02, 0.15)) : 'transparent';

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => onTap?.(stock)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 8px',
        cursor: 'pointer',
        borderBottom: '0.5px solid rgba(255,255,255,0.04)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(94,234,212,0.03)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Rank number — matches RankRow */}
      <span style={{
        width: '24px',
        textAlign: 'right',
        fontSize: '12px',
        fontWeight: 700,
        color: 'rgba(255,255,255,0.4)',
        flexShrink: 0,
      }}>
        {rank}
      </span>

      {/* Ticker — matches RankRow */}
      <span style={{
        width: '48px',
        fontSize: '14px',
        fontWeight: 700,
        color: '#ffffff',
        flexShrink: 0,
      }}>
        {stock.symbol}
      </span>

      {/* Sector pill — matches RankRow */}
      <span style={{
        fontSize: '10px',
        color: sectorInfo.color,
        background: `${sectorInfo.color}15`,
        borderLeft: `2px solid ${sectorInfo.color}`,
        padding: '2px 6px',
        borderRadius: '0 4px 4px 0',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        maxWidth: '80px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {sectorInfo.name}
      </span>

      {/* Diverging bar — center zero; fill left (red, down) or right (green, up) */}
      <div style={{ flex: 1, minWidth: '40px', display: 'flex', alignItems: 'center', height: '5px' }}>
        {/* negative (left) half — fill grows leftward from the center */}
        <div style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          justifyContent: 'flex-end',
          background: TRACK_BG,
          borderRadius: '3px 0 0 3px',
          overflow: 'hidden',
        }}>
          {hasValue && !isPositive && fillPct > 0 && (
            <div style={{ width: `${fillPct}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
          )}
        </div>

        {/* center zero tick */}
        <div style={{ width: '1px', height: '100%', background: CENTER_TICK, flexShrink: 0 }} />

        {/* positive (right) half — fill grows rightward from the center */}
        <div style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          justifyContent: 'flex-start',
          background: TRACK_BG,
          borderRadius: '0 3px 3px 0',
          overflow: 'hidden',
        }}>
          {hasValue && isPositive && fillPct > 0 && (
            <div style={{ width: `${fillPct}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
          )}
        </div>
      </div>

      {/* Signed-percent label — colored by direction, magnitude-tinted background */}
      <span style={{
        minWidth: '54px',
        textAlign: 'right',
        fontSize: '12px',
        fontWeight: 700,
        color,
        background: chipBg,
        padding: '2px 6px',
        borderRadius: '4px',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        {formatSignedPercent(value)}
      </span>
    </motion.div>
  );
};

export default ReturnRow;
