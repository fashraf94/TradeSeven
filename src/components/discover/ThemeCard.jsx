// src/components/discover/ThemeCard.jsx
//
// Presentational card for a single Discover theme. Renders the
// summary fields written by scripts/seed-discover-themes.js into the
// discoverThemes Firestore collection — the rich nested DKB content
// (full chain layer descriptions, sub-thesis bodies, risks,
// inflection points) lives in dkb/thematic/*.json and is consumed by
// ThemeDetailModal in Phase 3.
//
// Edge cases handled:
//   - 5-layer chain (7 themes)
//   - 3-layer chain (Dollar Strength Regimes)
//   - 4-ticker primary (Cybersecurity Buildout)
// The chain pill row and ticker chip row both use flex-wrap and do
// not assume any fixed slot count.

import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

export default function ThemeCard({ theme, onTap }) {
  const { tokens } = useTheme();

  if (!theme) return null;

  const chain = Array.isArray(theme.chain) ? theme.chain : [];
  const tickers = Array.isArray(theme.tickers) ? theme.tickers : [];
  const subAngleCount = Array.isArray(theme.subAngles) ? theme.subAngles.length : 0;

  return (
    <motion.button
      type="button"
      onClick={() => onTap?.(theme)}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        appearance: 'none',
        textAlign: 'left',
        background: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
        borderRadius: 16,
        padding: 20,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        color: 'inherit',
        font: 'inherit',
        width: '100%',
        boxShadow: tokens.obsidianShadow,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = tokens.teal;
        e.currentTarget.style.boxShadow = `${tokens.obsidianShadow}, 0 0 0 1px ${tokens.teal}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = tokens.borderDefault;
        e.currentTarget.style.boxShadow = tokens.obsidianShadow;
      }}
    >
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: tokens.textPrimary,
          lineHeight: 1.25,
        }}
      >
        {theme.title}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: tokens.textMuted,
          lineHeight: 1.5,
        }}
      >
        {theme.narrative}
      </p>

      {chain.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {chain.map((label, idx) => (
            <React.Fragment key={`${label}-${idx}`}>
              {idx > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    color: tokens.textFaint,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  →
                </span>
              )}
              <span
                style={{
                  background: tokens.bgIcon,
                  border: `1px solid ${tokens.borderDefault}`,
                  color: tokens.textSecondary,
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
              >
                {label}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}

      {tickers.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          {tickers.map((t) => (
            <span
              key={t}
              style={{
                background: tokens.bgAgent,
                border: `1px solid ${tokens.borderDefault}`,
                color: tokens.teal,
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 11,
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

      <div
        style={{
          fontSize: 10,
          color: tokens.textFaint,
          fontWeight: 700,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          marginTop: 'auto',
          paddingTop: 4,
        }}
      >
        {subAngleCount} {subAngleCount === 1 ? 'angle' : 'angles'}
      </div>
    </motion.button>
  );
}
