// src/components/discover/WatchListEventCard.jsx
//
// Single event card for the Watch List rail. Wire-service / desk-briefing
// register — distinct from FeaturedThemeCard's editorial serif and
// SectorCard's tactical layout. Mono accents on the date pill, time chip,
// and kind tag; bold sans label is the visual anchor.
//
// Card layout (top → bottom):
//   1. Header row: date pill (mono) + time chip (mono) + kind tag (right, color-coded)
//   2. Label — large bold sans
//   3. whyItMatters — body text, line-clamp 3
//   4. Ticker chips — bottom row, each tap fires onTickerTap to open AssetResearchModal
//
// Color-coded kind tag (locked Phase 3 decision):
//   macro    → tokens.teal
//   earnings → tokens.medalGold
//   fed      → tokens.warmCopper
//   speech   → tokens.textFaint
//   auction  → tokens.textFaint
//
// The card itself is not interactive (no CTA — Workshop handoff is Phase 5).
// Only ticker chips are buttons.

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const MONO_STACK =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Parse the ISO eventDate as UTC midnight to avoid TZ-shift drift between
// the date string the cron emits and the user's local clock.
function formatDatePill(eventDate) {
  if (!eventDate) return '';
  const d = new Date(`${eventDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  const weekday = d
    .toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
    .toUpperCase();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${weekday} ${month}/${day}`;
}

function getKindColor(kind, tokens) {
  switch (kind) {
    case 'macro':
      return tokens.teal;
    case 'earnings':
      return tokens.medalGold;
    case 'fed':
      return tokens.warmCopper;
    case 'speech':
    case 'auction':
    default:
      return tokens.textFaint;
  }
}

export default function WatchListEventCard({ event, onTickerTap }) {
  const { tokens } = useTheme();

  if (!event) return null;

  const datePill = formatDatePill(event.eventDate);
  const timeChip = event.eventTime || '';
  const kindLabel = (event.kind || '').toUpperCase();
  const kindColor = getKindColor(event.kind, tokens);
  const tickers = Array.isArray(event.tickers) ? event.tickers : [];

  return (
    <div
      style={{
        flexShrink: 0,
        scrollSnapAlign: 'start',
        width: 288,
        minHeight: 180,
        background: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: tokens.obsidianShadow,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {datePill && (
          <span
            style={{
              fontFamily: MONO_STACK,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.5px',
              color: tokens.textPrimary,
              background: tokens.bgAgent,
              border: `1px solid ${tokens.borderDefault}`,
              borderRadius: 4,
              padding: '3px 7px',
              whiteSpace: 'nowrap',
            }}
          >
            {datePill}
          </span>
        )}
        {timeChip && (
          <span
            style={{
              fontFamily: MONO_STACK,
              fontSize: 10,
              fontWeight: 600,
              color: tokens.textMuted,
              letterSpacing: '0.3px',
              whiteSpace: 'nowrap',
            }}
          >
            {timeChip}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {kindLabel && (
          <span
            style={{
              fontFamily: MONO_STACK,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.8px',
              color: kindColor,
              border: `1px solid ${kindColor}`,
              borderRadius: 4,
              padding: '2px 6px',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {kindLabel}
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: tokens.textPrimary,
          lineHeight: 1.3,
        }}
      >
        {event.label}
      </div>

      {event.whyItMatters && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: tokens.textSecondary,
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {event.whyItMatters}
        </p>
      )}

      {tickers.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            marginTop: 'auto',
            paddingTop: 4,
          }}
        >
          {tickers.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTickerTap?.(t)}
              style={{
                appearance: 'none',
                cursor: 'pointer',
                background: tokens.bgAgent,
                border: `1px solid ${tokens.borderDefault}`,
                color: tokens.teal,
                padding: '2px 6px',
                borderRadius: 5,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: MONO_STACK,
                letterSpacing: '0.3px',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
