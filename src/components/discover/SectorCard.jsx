// src/components/discover/SectorCard.jsx
//
// Single sector card for the Discover Sectors rail. Displays ticker,
// name, 1-day and 5-day % change, top holdings, and (when applicable)
// a "What's Hot This Week" medal badge in the top-right corner.
//
// Phase 2 contract:
//   - sparklineData prop is accepted but always passed null. The render
//     branch is wired so a future sprint can supply real sparkline data
//     without restructuring the component.
//   - onTap is invoked with the sector ticker. The tap stub for Phase 2
//     is owned by SectorRail (analytics + toast). Phase 3 wires the
//     real SectorDetailModal.

import React from 'react';
import { motion } from 'framer-motion';
import { Medal } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

function formatPct(val) {
  if (val == null || Number.isNaN(val)) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function formatMedalLabel(fiveDayPct) {
  if (fiveDayPct == null || Number.isNaN(fiveDayPct)) return '5d —';
  const sign = fiveDayPct >= 0 ? '+' : '';
  return `5d ${sign}${fiveDayPct.toFixed(1)}%`;
}

function pctColor(val, tokens) {
  if (val == null || Number.isNaN(val)) return tokens.textFaint;
  if (val > 0) return tokens.emerald;
  if (val < 0) return tokens.red;
  return tokens.textMuted;
}

function medalColor(rank, tokens) {
  if (rank === 1) return tokens.medalGold;
  if (rank === 2) return tokens.medalSilver;
  if (rank === 3) return tokens.medalBronze;
  return null;
}

export default function SectorCard({
  ticker,
  name,
  oneDayPct,
  fiveDayPct,
  medalRank,
  topHoldings,
  // Phase 2 always passes null. Hook preserved for a future sprint to
  // supply price-point data without restructuring this component.
  sparklineData,
  onTap,
}) {
  const { tokens } = useTheme();
  const holdings = Array.isArray(topHoldings) ? topHoldings : [];
  const badgeColor = medalColor(medalRank, tokens);

  return (
    <motion.button
      type="button"
      layout
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onTap?.(ticker)}
      style={{
        position: 'relative',
        flexShrink: 0,
        scrollSnapAlign: 'start',
        width: 240,
        minHeight: 168,
        appearance: 'none',
        textAlign: 'left',
        background: tokens.bgCard,
        border: `1px solid ${badgeColor || tokens.borderDefault}`,
        borderRadius: 14,
        padding: 14,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        color: 'inherit',
        font: 'inherit',
        boxShadow: tokens.obsidianShadow,
      }}
    >
      {badgeColor && (
        <div
          aria-label={`Hot this week: rank ${medalRank}`}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px 3px 6px',
            background: tokens.bgIcon,
            border: `1px solid ${badgeColor}`,
            borderRadius: 999,
            color: badgeColor,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.3px',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          }}
        >
          <Medal size={11} strokeWidth={2.5} />
          <span style={{ color: pctColor(fiveDayPct, tokens) }}>
            {formatMedalLabel(fiveDayPct)}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: tokens.textPrimary,
            lineHeight: 1.2,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            letterSpacing: '0.5px',
          }}
        >
          {ticker}
        </div>
        <div
          style={{
            fontSize: 12,
            color: tokens.textMuted,
            lineHeight: 1.3,
            // Reserve space for the badge so long names don't overlap it.
            paddingRight: badgeColor ? 60 : 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: tokens.textFaint,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
            }}
          >
            1d
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: pctColor(oneDayPct, tokens),
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatPct(oneDayPct)}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: tokens.textFaint,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
            }}
          >
            5d
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: pctColor(fiveDayPct, tokens),
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatPct(fiveDayPct)}
          </span>
        </div>
      </div>

      {sparklineData && sparklineData.length > 0 && (
        <div style={{ height: 24 }}>
          {/* Phase 2 ships sparklineData=null. Future sprint will render here. */}
        </div>
      )}

      {holdings.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            marginTop: 'auto',
            paddingTop: 4,
          }}
        >
          {holdings.map((t) => (
            <span
              key={t}
              style={{
                background: tokens.bgAgent,
                border: `1px solid ${tokens.borderDefault}`,
                color: tokens.teal,
                padding: '2px 6px',
                borderRadius: 5,
                fontSize: 10,
                fontWeight: 600,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                letterSpacing: '0.3px',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </motion.button>
  );
}
