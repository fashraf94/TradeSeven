// src/components/Search/IndustryRow.jsx
//
// Research Engine — Phase 2: the row for an INDUSTRY-ROLLUP result ("top performing
// industries"). A sibling to RankRow / ReturnRow, both left byte-for-byte unchanged.
//
// Renders one industry: rank · short display name · member count · the ranked value.
// For a return horizon it mirrors ReturnRow's DIVERGING bar (green right / up, red left /
// down, normalized by the set's max-abs). For momentumScore it uses a neutral one-directional
// 0–100 fill bar like RankRow. Industry rows are NOT tappable in V1 — tap-to-drill into the
// member stocks is deferred.
//
// Returns are REALIZED, PAST medians across the industry's members — never a forecast.

import React from 'react';
import { motion } from 'framer-motion';
import { formatSignedPercent, returnColor } from './screenerAdapter';

// Local hex→rgba (matches ReturnRow / the codebase idiom) for the magnitude-scaled tint.
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
const BAR_WIDTH = '90px';

// One side of the diverging (return) bar — mirrors ReturnRow's BarHalf.
function BarHalf({ filled, justify, radius, color, fillPct }) {
  return (
    <div style={{
      flex: 1, height: '100%', display: 'flex', justifyContent: justify,
      background: TRACK_BG, borderRadius: radius, overflow: 'hidden',
    }}>
      {filled && (
        <div style={{ width: `${fillPct}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
      )}
    </div>
  );
}

const IndustryRow = ({ displayName, totalStocks, rank, value, isReturn, maxAbs, maxScore, tokens }) => {
  const n = Number(value);
  const hasValue = value != null && Number.isFinite(n);
  const isPositive = n >= 0; // only consulted under hasValue gates

  const teal = (tokens && tokens.teal) || '#5eead4';
  const color = isReturn ? returnColor(value, tokens) : teal;

  const fillPct = !hasValue ? 0
    : isReturn
      ? (maxAbs > 0 ? Math.min(100, (Math.abs(n) / maxAbs) * 100) : 0)
      : (maxScore > 0 ? Math.min(100, (n / maxScore) * 100) : 0);

  const chipBg = hasValue
    ? hexToRgba(color, isReturn ? Math.min(Math.abs(n) * 0.02, 0.15) : 0.12)
    : 'transparent';
  const label = !hasValue ? '—' : (isReturn ? formatSignedPercent(value) : String(Math.round(n)));

  return (
    <motion.div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 8px',
        borderBottom: '0.5px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* Rank — matches RankRow / ReturnRow */}
      <span style={{
        width: '24px', textAlign: 'right', fontSize: '12px', fontWeight: 700,
        color: 'rgba(255,255,255,0.4)', flexShrink: 0,
      }}>
        {rank}
      </span>

      {/* Industry short name */}
      <span style={{
        flex: 1, minWidth: 0, fontSize: '13px', fontWeight: 600, color: '#ffffff',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {displayName}
      </span>

      {/* Member count */}
      <span style={{
        fontSize: '10px', color: 'rgba(255,255,255,0.4)', flexShrink: 0,
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      }}>
        {Number.isFinite(totalStocks) ? `${totalStocks} ${totalStocks === 1 ? 'stock' : 'stocks'}` : null}
      </span>

      {/* Bar: diverging for returns, neutral left-fill for momentumScore */}
      {isReturn ? (
        <div style={{ width: BAR_WIDTH, display: 'flex', alignItems: 'center', height: '5px', flexShrink: 0 }}>
          <BarHalf filled={hasValue && !isPositive} justify="flex-end" radius="3px 0 0 3px" color={color} fillPct={fillPct} />
          <div style={{ width: '1px', height: '100%', background: CENTER_TICK, flexShrink: 0 }} />
          <BarHalf filled={hasValue && isPositive} justify="flex-start" radius="0 3px 3px 0" color={color} fillPct={fillPct} />
        </div>
      ) : (
        <div style={{ width: BAR_WIDTH, height: '5px', background: TRACK_BG, borderRadius: '3px', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ width: `${fillPct}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
        </div>
      )}

      {/* Value label — signed % (returns) or rounded score (momentum) */}
      <span style={{
        minWidth: '54px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color,
        background: chipBg, padding: '2px 6px', borderRadius: '4px',
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {label}
      </span>
    </motion.div>
  );
};

export default IndustryRow;
