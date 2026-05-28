// src/components/FantasyTimes/VeraMobilePreview.jsx
// Mobile counterpart to FeaturedDeepdiveBand — a dedicated card between the hero and the
// compact list on the mobile broadsheet front page (BroadsheetFrontPage > MobileFrontPage).
// Same navy treatment + vera.onDarkAccent accents, sized for mobile: vertical layout with
// line-clamped headline/subheadline. Structure mirrors KimMobilePreview.
//
// Whole-area tappable (role=button + keyboard); the CTA is a visual cue, not the only target.

import React from 'react';
import { Telescope } from 'lucide-react';
import { REPORTER_COLORS, BROADSHEET_TOKENS } from '../../constants/reporterTheme';

const VERA = REPORTER_COLORS.vera;

// Match VeraDeepDive's read-time math (~220 wpm). Null when wordCount is absent so the meta
// row can gracefully drop the segment instead of showing a bogus value.
const readMinutes = (wordCount) => (wordCount ? Math.max(1, Math.round(wordCount / 220)) : null);

export default function VeraMobilePreview({ story, onSelect }) {
  if (!story) return null;

  if (!story.visualConfig?.fullDeepdiveId) {
    console.warn('[VeraMobilePreview] deepdive story missing visualConfig.fullDeepdiveId:', story.id);
  }

  const minutes = readMinutes(story.wordCount);
  const subheadline = story.subheadline ? story.subheadline.replace(/\*\*/g, '') : '';

  return (
    <article
      onClick={() => onSelect?.()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(); } }}
      tabIndex={0}
      role="button"
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        padding: 20,
        background: `linear-gradient(135deg, ${VERA.primary} 0%, #15263c 100%)`,
        borderLeft: `4px solid ${VERA.onDarkAccent}`,
        borderTop: `1px solid ${BROADSHEET_TOKENS.foldLine}`,
        borderBottom: `1px solid ${BROADSHEET_TOKENS.foldLine}`,
      }}
    >
      {/* Ambient glow for depth */}
      <div style={{
        position: 'absolute', bottom: -80, right: -60,
        width: 220, height: 220, borderRadius: '50%',
        background: 'rgba(127, 176, 230, 0.10)',
        filter: 'blur(80px)', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Telescope size={12} color={VERA.onDarkAccent} />
          <span style={{
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.25em',
            textTransform: 'uppercase', color: VERA.onDarkAccent,
          }}>
            RESEARCH
          </span>
        </div>

        {/* Headline (2-3 lines) */}
        <h3 style={{
          fontFamily: BROADSHEET_TOKENS.fontHeadline,
          fontSize: 20, fontWeight: 700, lineHeight: 1.2,
          color: '#f0f3f7', margin: '0 0 8px', textWrap: 'balance',
          display: '-webkit-box', WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {story.headline}
        </h3>

        {/* Subheadline (2 lines) */}
        {subheadline && (
          <p style={{
            fontFamily: BROADSHEET_TOKENS.fontBody,
            fontSize: 13, lineHeight: 1.5, color: '#c7d4e2',
            margin: '0 0 12px',
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {subheadline}
          </p>
        )}

        {/* Meta row */}
        <div style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 10, color: '#9db2c8',
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          marginBottom: 12, textTransform: 'uppercase',
        }}>
          <span style={{ fontWeight: 700, color: '#dce6f0' }}>BY {VERA.name.toUpperCase()}</span>
          {minutes && (<><span>·</span><span>{minutes} min</span></>)}
        </div>

        {/* CTA — visual cue; the whole card is the tap target */}
        <span style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: VERA.onDarkAccent,
          borderBottom: `1px solid ${VERA.onDarkAccent}`,
          paddingBottom: 2,
        }}>
          Read full →
        </span>
      </div>
    </article>
  );
}
