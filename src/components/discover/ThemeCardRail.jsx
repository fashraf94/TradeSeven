// src/components/discover/ThemeCardRail.jsx
//
// Single theme card for the Discover Themes rail. 240px wide, fixed
// scroll-snap target — mirrors SectorCard's geometry so the two rails
// share visual rhythm.
//
// Card content (per Sprint 3 decision 7):
//   - Medal badge top-right with label "LIVE" — only when
//     theme.isLiveThisWeek === true and a medalRank is provided.
//     The cron writes isLiveThisWeek; this component is read-only.
//   - Title (theme.title, 17px)
//   - Subtitle (theme.narrative) clamped to 2 lines via WebkitLineClamp
//   - Ticker chips row: theme.tickers.slice(0, 4). Render whatever is
//     available — do not pad. Some themes have 4 tickers, others may
//     have fewer; both render correctly.
//   - "{N} angles" footer when theme.subAngles is present.
//
// Distinct from src/components/discover/ThemeCard.jsx (used by the
// "All Themes" grid below the rail). Kept as a separate file because
// the rail's fixed 240px width + scroll-snap + medal badge shape is
// different enough from the responsive grid card that a parameterized
// shared component would be more confusing than two siblings.

import React from 'react';
import { motion } from 'framer-motion';
import { Medal } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

function medalColor(rank, tokens) {
  if (rank === 1) return tokens.medalGold;
  if (rank === 2) return tokens.medalSilver;
  if (rank === 3) return tokens.medalBronze;
  return null;
}

export default function ThemeCardRail({ theme, medalRank, onTap }) {
  const { tokens } = useTheme();

  if (!theme) return null;

  const tickers = Array.isArray(theme.tickers) ? theme.tickers.slice(0, 4) : [];
  const subAngleCount = Array.isArray(theme.subAngles) ? theme.subAngles.length : 0;
  const showMedal = theme.isLiveThisWeek === true && medalRank != null;
  const badgeColor = showMedal ? medalColor(medalRank, tokens) : null;

  return (
    <motion.button
      type="button"
      layout
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onTap?.(theme)}
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
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (badgeColor) return;
        e.currentTarget.style.borderColor = tokens.teal;
        e.currentTarget.style.boxShadow = `${tokens.obsidianShadow}, 0 0 0 1px ${tokens.teal}`;
      }}
      onMouseLeave={(e) => {
        if (badgeColor) return;
        e.currentTarget.style.borderColor = tokens.borderDefault;
        e.currentTarget.style.boxShadow = tokens.obsidianShadow;
      }}
    >
      {badgeColor && (
        <div
          aria-label={`Live this week: rank ${medalRank}`}
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
          <span>LIVE</span>
        </div>
      )}

      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: tokens.textPrimary,
          lineHeight: 1.25,
          // Reserve space for the badge so long titles don't overlap it.
          paddingRight: badgeColor ? 56 : 0,
        }}
      >
        {theme.title}
      </div>

      {theme.narrative && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: tokens.textMuted,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {theme.narrative}
        </p>
      )}

      {tickers.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
          }}
        >
          {tickers.map((t) => (
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

      {subAngleCount > 0 && (
        <div
          style={{
            fontSize: 9,
            color: tokens.textFaint,
            fontWeight: 700,
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            marginTop: 'auto',
            paddingTop: 2,
          }}
        >
          {subAngleCount} {subAngleCount === 1 ? 'angle' : 'angles'}
        </div>
      )}
    </motion.button>
  );
}
