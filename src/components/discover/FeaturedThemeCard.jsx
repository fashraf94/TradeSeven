// src/components/discover/FeaturedThemeCard.jsx
//
// Editorial-treatment card for the Featured Themes showcase. Replaces
// Phase 1's ThemeCardRail.jsx. Distinct from ThemeCard.jsx (used by
// the All Themes surface) so the editorial register lands without
// stealing the larger card's content density.
//
// Three combined design treatments distinguish this card:
//   1. Serif title using Newsreader (matches FantasyTimes V3 register;
//      font-family chain mirrors src/constants/reporterTheme.js
//      fontHeadline). Weight 500 — never 600/700 in the editorial
//      register. Falls back to Georgia → Times New Roman → serif if
//      Newsreader hasn't loaded yet (e.g., CSP propagation lag).
//   2. Teal accent bar on the left edge, 4px wide, full card height.
//      Card padding compensates with extra left inset so content
//      doesn't crowd the bar.
//   3. Teal-tinted border (rgba teal at 0.15) instead of the neutral
//      borderDefault. Hover intensifies the same hue to 0.3 — no
//      hue change, no scale, no shadow lift.
//
// No medal badge — Phase 1.5 removed the hot-3 hierarchy. Selection
// is random (Phase 2 cron concern); all three featured cards are
// peers.

import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

const SERIF_STACK = "'Newsreader', Georgia, 'Times New Roman', serif";
const TEAL_BORDER_REST = 'rgba(94, 234, 212, 0.15)';
const TEAL_BORDER_HOVER = 'rgba(94, 234, 212, 0.3)';

export default function FeaturedThemeCard({ theme, onTap }) {
  const { tokens } = useTheme();

  if (!theme) return null;

  const tickers = Array.isArray(theme.tickers) ? theme.tickers.slice(0, 4) : [];
  const subAngleCount = Array.isArray(theme.subAngles) ? theme.subAngles.length : 0;

  return (
    <motion.button
      type="button"
      layout
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      onClick={() => onTap?.(theme)}
      style={{
        position: 'relative',
        flexShrink: 0,
        scrollSnapAlign: 'start',
        width: 240,
        minHeight: 180,
        appearance: 'none',
        textAlign: 'left',
        background: tokens.bgCard,
        border: `1px solid ${TEAL_BORDER_REST}`,
        borderRadius: 14,
        // Extra left padding (16) accounts for the 4px teal bar at left
        // edge so card content doesn't crowd it.
        padding: '14px 14px 14px 16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        color: 'inherit',
        font: 'inherit',
        boxShadow: tokens.obsidianShadow,
        transition: 'border-color 0.2s ease',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = TEAL_BORDER_HOVER;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = TEAL_BORDER_REST;
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 4,
          background: tokens.teal,
        }}
      />

      <div
        style={{
          fontFamily: SERIF_STACK,
          fontSize: 19,
          fontWeight: 500,
          color: tokens.textPrimary,
          lineHeight: 1.25,
        }}
      >
        {theme.title}
      </div>

      {theme.narrative && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: tokens.textSecondary,
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
