// src/components/FantasyTimes/EditorialStory.jsx
// Story rendered in newspaper style — serif headline, mono dateline, no card containers.
// Variants: hero, secondary, compact, dense.

import React, { useState } from 'react';
import { REPORTER_COLORS, BROADSHEET_TOKENS } from '../../constants/reporterTheme';
import ReporterAvatar from './ReporterAvatar';
import StoryVisualSafe from './StoryVisualSafe';
import { timeAgo } from '../../utils/timeAgo';

function getReadTime(body) {
  if (!body) return 1;
  return Math.max(1, Math.ceil(body.length / 1200));
}

function BeatBadge({ reporter, style: extraStyle }) {
  const color = REPORTER_COLORS[reporter];
  if (!color) return null;
  return (
    <span style={{
      fontFamily: BROADSHEET_TOKENS.fontMono,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: color.hex,
      backgroundColor: `rgba(${color.rgb}, 0.1)`,
      padding: '4px 12px',
      display: 'inline-block',
      ...extraStyle,
    }}>
      {color.beat}
    </span>
  );
}

function Byline({ story, reporter, style: extraStyle }) {
  const color = REPORTER_COLORS[reporter];
  const name = color?.name || reporter;
  return (
    <div style={{
      fontFamily: BROADSHEET_TOKENS.fontMono,
      fontSize: 12,
      color: '#859398',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      ...extraStyle,
    }}>
      <span style={{ fontWeight: 700, color: '#e3e2e7', textTransform: 'uppercase' }}>
        BY {name}
      </span>
      <span>•</span>
      <span>{getReadTime(story.body)} MIN READ</span>
      <span>•</span>
      <span>{timeAgo(story.publishedAt)}</span>
    </div>
  );
}

// ── Hero Variant ──
function HeroStory({ story, isDesktop, onClick, showVisual }) {
  const [isHovered, setIsHovered] = useState(false);
  const reporterColor = REPORTER_COLORS[story.reporter];
  const hasVisual = showVisual && story.visualType && story.visualType !== 'none';

  return (
    <article
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: isDesktop ? 48 : 16,
        cursor: 'pointer',
      }}
    >
      <BeatBadge reporter={story.reporter} style={{ marginBottom: 16 }} />

      <h2 style={{
        fontFamily: BROADSHEET_TOKENS.fontHeadline,
        fontSize: isDesktop ? 56 : 32,
        fontWeight: 900,
        letterSpacing: '-0.04em',
        lineHeight: 1.05,
        color: '#e3e2e7',
        maxWidth: 960,
        margin: '16px 0',
        textWrap: 'balance',
      }}>
        {story.headline}
      </h2>

      <Byline story={story} reporter={story.reporter} style={{ marginBottom: 24 }} />

      {hasVisual && (
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <div style={{
            width: '100%',
            aspectRatio: '21 / 9',
            overflow: 'hidden',
            border: '1px solid rgba(60, 73, 77, 0.3)',
            position: 'relative',
          }}>
            <div style={{
              filter: isHovered ? BROADSHEET_TOKENS.activeFilter : BROADSHEET_TOKENS.dormantFilter,
              mixBlendMode: isHovered ? 'normal' : BROADSHEET_TOKENS.dormantBlend,
              transition: 'all 0.7s ease',
              width: '100%',
              height: '100%',
            }}>
              <StoryVisualSafe
                visualType={story.visualType}
                visualConfig={story.visualConfig}
                size="hero"
              />
            </div>
          </div>
          {/* Gradient overlay at bottom */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            background: 'linear-gradient(to top, #121317, transparent)',
            pointerEvents: 'none',
          }} />
        </div>
      )}

      {story.subheadline && (
        <p style={{
          fontFamily: BROADSHEET_TOKENS.fontBody,
          fontSize: isDesktop ? 18 : 15,
          lineHeight: 1.6,
          color: '#bbc9ce',
          maxWidth: 720,
          margin: 0,
          textWrap: 'pretty',
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {story.subheadline.replace(/\*\*/g, '')}
        </p>
      )}
    </article>
  );
}

// ── Secondary Variant ──
function SecondaryStory({ story, isDesktop, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const reporterColor = REPORTER_COLORS[story.reporter];

  return (
    <article
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: isDesktop ? 48 : 24,
        cursor: 'pointer',
        backgroundColor: isHovered ? BROADSHEET_TOKENS.bgHoverStory : 'transparent',
        transition: 'background-color 0.2s ease',
      }}
    >
      <BeatBadge reporter={story.reporter} style={{ marginBottom: 12 }} />

      <h3 style={{
        fontFamily: BROADSHEET_TOKENS.fontHeadline,
        fontSize: isDesktop ? 30 : 22,
        fontWeight: 700,
        lineHeight: 1.2,
        color: isHovered ? '#00d9ff' : '#e3e2e7',
        margin: '12px 0',
        transition: 'color 0.2s ease',
        textWrap: 'balance',
      }}>
        {story.headline}
      </h3>

      {story.subheadline && (
        <p style={{
          fontFamily: BROADSHEET_TOKENS.fontBody,
          fontSize: isDesktop ? 16 : 14,
          lineHeight: 1.6,
          color: '#bbc9ce',
          maxWidth: 600,
          margin: '0 0 16px',
          textWrap: 'pretty',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {story.subheadline.replace(/\*\*/g, '')}
        </p>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <ReporterAvatar reporter={story.reporter} size={40} />
        <div>
          <div style={{
            fontFamily: BROADSHEET_TOKENS.fontBody,
            fontSize: 13,
            fontWeight: 600,
            color: '#e3e2e7',
          }}>
            {reporterColor?.name || story.reporter}
          </div>
          <div style={{
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 11,
            color: '#859398',
            textTransform: 'uppercase',
          }}>
            {reporterColor?.beat} • {timeAgo(story.publishedAt)}
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Compact Variant (mobile below-fold) ──
function CompactStory({ story, onClick }) {
  const reporterColor = REPORTER_COLORS[story.reporter];

  return (
    <article
      onClick={onClick}
      style={{
        padding: '12px 16px 12px 18px',
        borderLeft: `2px solid ${reporterColor?.hex || '#859398'}`,
        cursor: 'pointer',
      }}
    >
      <span style={{
        fontFamily: BROADSHEET_TOKENS.fontMono,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: reporterColor?.hex || '#859398',
      }}>
        {reporterColor?.name} // {reporterColor?.beat}
      </span>

      <h4 style={{
        fontFamily: BROADSHEET_TOKENS.fontHeadline,
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1.25,
        color: '#e3e2e7',
        margin: '6px 0',
        textWrap: 'balance',
      }}>
        {story.headline}
      </h4>

      {story.subheadline && (
        <p style={{
          fontFamily: BROADSHEET_TOKENS.fontBody,
          fontSize: 13,
          lineHeight: 1.5,
          color: '#bbc9ce',
          margin: '0 0 6px',
          display: '-webkit-box',
          WebkitLineClamp: 1,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {story.subheadline.replace(/\*\*/g, '')}
        </p>
      )}

      <span style={{
        fontFamily: BROADSHEET_TOKENS.fontMono,
        fontSize: 10,
        color: '#859398',
        textTransform: 'uppercase',
      }}>
        {reporterColor?.name} • {timeAgo(story.publishedAt)}
      </span>
    </article>
  );
}

// ── Dense Variant (older stories list) ──
function DenseStory({ story, onClick }) {
  return (
    <article
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
        padding: '10px 0',
        borderBottom: `1px solid ${BROADSHEET_TOKENS.storyDivider}`,
        cursor: 'pointer',
      }}
    >
      <h4 style={{
        fontFamily: BROADSHEET_TOKENS.fontHeadline,
        fontSize: 15,
        fontWeight: 600,
        lineHeight: 1.3,
        color: '#e3e2e7',
        margin: 0,
        flex: 1,
      }}>
        {story.headline}
      </h4>
      <span style={{
        fontFamily: BROADSHEET_TOKENS.fontMono,
        fontSize: 10,
        color: '#859398',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        {timeAgo(story.publishedAt)}
      </span>
    </article>
  );
}

// ── Main Component ──
export default function EditorialStory({
  story,
  variant = 'secondary',
  isDesktop = false,
  isExpanded = false,
  onExpand,
  onCollapse,
  showVisual = true,
}) {
  if (!story) return null;

  const handleClick = () => {
    if (onExpand) onExpand(story.id);
  };

  switch (variant) {
    case 'hero':
      return <HeroStory story={story} isDesktop={isDesktop} onClick={handleClick} showVisual={showVisual} />;
    case 'secondary':
      return <SecondaryStory story={story} isDesktop={isDesktop} onClick={handleClick} />;
    case 'compact':
      return <CompactStory story={story} onClick={handleClick} />;
    case 'dense':
      return <DenseStory story={story} onClick={handleClick} />;
    default:
      return <SecondaryStory story={story} isDesktop={isDesktop} onClick={handleClick} />;
  }
}
