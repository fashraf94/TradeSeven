// src/components/FantasyTimes/FeaturedDeepdiveBand.jsx
// Full-width "Featured Research" band for Vera's latest deepdive. Sits below the hero on
// the desktop broadsheet front page (BroadsheetFrontPage > DesktopFrontPage) and is reused,
// stacked, on Vera's reporter desk (ReporterDesk > VeraDesk).
//
// Visual language mirrors the other broadsheet surfaces (inline styles, BROADSHEET_TOKENS):
//   - distinct navy treatment: navy gradient background built from vera.primary
//   - left-edge accent stripe + eyebrow + CTA in vera.onDarkAccent (readable on navy — plain
//     primary would be invisible on a primary-navy background; primary stays for stripes that
//     sit against non-navy content, per reporterTheme.js)
//   - serif headline (slightly smaller than the hero), body subheadline, mono meta row
//
// Whole-area tappable (role=button + keyboard); the CTA is a visual cue, not the only target.

import React, { useState } from 'react';
import { Telescope } from 'lucide-react';
import { REPORTER_COLORS, BROADSHEET_TOKENS } from '../../constants/reporterTheme';
import { timeAgo } from '../../utils/timeAgo';

const VERA = REPORTER_COLORS.vera;

// Match VeraDeepDive's read-time math (~220 wpm). Returns null when wordCount is absent
// (e.g. a deepdive ingested before the wordCount mirror), so the meta row can gracefully
// drop the segment instead of rendering a bogus "1 min read".
const readMinutes = (wordCount) => (wordCount ? Math.max(1, Math.round(wordCount / 220)) : null);

export default function FeaturedDeepdiveBand({ story, onSelect, isDesktop = true }) {
  const [hover, setHover] = useState(false);
  if (!story) return null;

  // fullDeepdiveId is what VeraDeepDive fetches by; if it's missing the tap still navigates
  // and VeraDeepDive shows its "unavailable" state. Warn for observability.
  if (!story.visualConfig?.fullDeepdiveId) {
    // eslint-disable-next-line no-console
    console.warn('[FeaturedDeepdiveBand] deepdive story missing visualConfig.fullDeepdiveId:', story.id);
  }

  const minutes = readMinutes(story.wordCount);
  const subheadline = story.subheadline ? story.subheadline.replace(/\*\*/g, '') : '';

  return (
    <article
      onClick={() => onSelect?.()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      tabIndex={0}
      role="button"
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        padding: isDesktop ? '32px 48px' : '24px 16px',
        background: `linear-gradient(135deg, ${VERA.primary} 0%, #15263c 100%)`,
        borderLeft: `4px solid ${VERA.onDarkAccent}`,
        borderTop: `1px solid ${BROADSHEET_TOKENS.foldLine}`,
        borderBottom: `1px solid ${BROADSHEET_TOKENS.foldLine}`,
      }}
    >
      {/* Ambient glow for depth (mirrors KimMobilePreview's corner glow) */}
      <div style={{
        position: 'absolute', top: -90, right: -60,
        width: 280, height: 280, borderRadius: '50%',
        background: 'rgba(127, 176, 230, 0.10)',
        filter: 'blur(90px)', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 900 }}>
        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Telescope size={14} color={VERA.onDarkAccent} />
          <span style={{
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 12, fontWeight: 700, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: VERA.onDarkAccent,
          }}>
            FEATURED RESEARCH
          </span>
        </div>

        {/* Headline — hero treatment, slightly smaller */}
        <h2 style={{
          fontFamily: BROADSHEET_TOKENS.fontHeadline,
          fontSize: isDesktop ? 30 : 24, fontWeight: 800,
          letterSpacing: '-0.01em', lineHeight: 1.15,
          color: '#f0f3f7', margin: '0 0 10px', textWrap: 'balance',
        }}>
          {story.headline}
        </h2>

        {/* Subheadline (1-2 lines) */}
        {subheadline && (
          <p style={{
            fontFamily: BROADSHEET_TOKENS.fontBody,
            fontSize: isDesktop ? 16 : 14, lineHeight: 1.5,
            color: '#c7d4e2', margin: '0 0 16px', maxWidth: 720,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {subheadline}
          </p>
        )}

        {/* Meta row */}
        <div style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 12, color: '#9db2c8',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          marginBottom: 16,
        }}>
          <span style={{ fontWeight: 700, color: '#dce6f0', textTransform: 'uppercase' }}>
            BY {VERA.name.toUpperCase()}
          </span>
          {minutes && (<><span>·</span><span>{minutes} min read</span></>)}
          <span>·</span>
          <span>{timeAgo(story.publishedAt)}</span>
        </div>

        {/* CTA — visual cue; the whole band is the tap target */}
        <span style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 12, fontWeight: 700, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: VERA.onDarkAccent,
          borderBottom: `1px solid ${hover ? VERA.onDarkAccent : 'transparent'}`,
          paddingBottom: 2,
        }}>
          Read full deepdive →
        </span>
      </div>
    </article>
  );
}
