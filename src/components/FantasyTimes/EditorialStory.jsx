// src/components/FantasyTimes/EditorialStory.jsx
// Story rendered in newspaper style — serif headline, mono dateline, no card containers.
// Variants: hero, secondary, compact, dense.
// Phase 3: inline accordion expansion with Framer Motion layout animations.

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { REPORTER_COLORS, SENTIMENT_COLORS, BROADSHEET_TOKENS } from '../../constants/reporterTheme';
import ReporterAvatar from './ReporterAvatar';
import StoryVisualSafe from './StoryVisualSafe';
import { timeAgo } from '../../utils/timeAgo';

const EASE = { duration: 0.3, ease: [0.4, 0, 0.2, 1] };

function getReadTime(body) {
  if (!body) return 1;
  return Math.max(1, Math.ceil(body.length / 1200));
}

function renderBody(bodyText) {
  if (!bodyText) return null;
  const cleaned = bodyText.replace(/\*\*(.*?)\*\*/g, '$1');
  return cleaned.split('\n').filter(p => p.trim()).map((paragraph, i) => (
    <p key={i} style={{ marginBottom: 12 }}>{paragraph}</p>
  ));
}

function handleKeyDown(onClick) {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
  };
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

// ── Expanded Content (shared by hero + secondary + compact) ──

function ExpandedContent({ story, onCollapse, onResearch }) {
  const hasVisual = story.visualType && story.visualType !== 'none';
  const ticker = story.primaryTicker || (story.tickers && story.tickers[0]);
  const sentimentColor = SENTIMENT_COLORS[story.sentiment] || '#64748b';

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={EASE}
      style={{ overflow: 'hidden' }}
    >
      {/* Awakened Art Director Visual */}
      {hasVisual && (
        <div style={{
          marginTop: 20,
          marginBottom: 24,
          filter: 'none',
          opacity: 1,
        }}>
          <StoryVisualSafe
            visualType={story.visualType}
            visualConfig={story.visualConfig}
            size="expanded"
          />
        </div>
      )}

      {/* Full Body Text */}
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontBody,
        fontSize: 15,
        lineHeight: 1.65,
        color: '#e6edf3',
        maxWidth: 600,
        textWrap: 'pretty',
      }}>
        {renderBody(story.body)}
      </div>

      {/* Sentiment Badge */}
      {story.sentiment && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 20,
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: sentimentColor,
            display: 'inline-block',
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 11,
            textTransform: 'uppercase',
            color: '#8b949e',
            letterSpacing: '0.1em',
          }}>
            {story.sentiment}
          </span>
        </div>
      )}

      {/* CTA Link */}
      {ticker && onResearch && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onResearch(ticker);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onResearch(ticker); }
          }}
          tabIndex={0}
          role="button"
          style={{
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 12,
            color: '#00d9ff',
            marginTop: 16,
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          Research {ticker} →
        </div>
      )}

      {/* Fold Button */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (onCollapse) onCollapse();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (onCollapse) onCollapse(); }
        }}
        tabIndex={0}
        role="button"
        aria-label="Collapse article"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 24,
          paddingTop: 16,
          borderTop: `1px solid ${BROADSHEET_TOKENS.sectionRule}`,
          cursor: 'pointer',
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 11,
          color: '#8b949e',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        <span>−</span> Fold
      </div>
    </motion.div>
  );
}

// ── Hero Variant ──

function HeroStory({ story, isDesktop, onClick, showVisual, isExpanded, onCollapse, onResearch }) {
  const [isHovered, setIsHovered] = useState(false);
  const hasVisual = showVisual && story.visualType && story.visualType !== 'none';

  return (
    <article
      onClick={onClick}
      onKeyDown={handleKeyDown(onClick)}
      tabIndex={0}
      role="button"
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
        fontSize: isDesktop ? (isExpanded ? 42 : 56) : 32,
        fontWeight: 900,
        letterSpacing: '-0.04em',
        lineHeight: 1.05,
        color: '#e3e2e7',
        maxWidth: 960,
        margin: '16px 0',
        textWrap: 'balance',
        transition: 'font-size 0.3s ease',
      }}>
        {story.headline}
      </h2>

      <Byline story={story} reporter={story.reporter} style={{ marginBottom: 24 }} />

      {/* Dormant visual — only show when collapsed */}
      {hasVisual && !isExpanded && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{
            width: '100%',
            maxHeight: 280,
            overflow: 'hidden',
            border: '1px solid rgba(60, 73, 77, 0.3)',
            position: 'relative',
          }}>
            <div style={{
              filter: (!isDesktop || isHovered) ? BROADSHEET_TOKENS.activeFilter : BROADSHEET_TOKENS.dormantFilter,
              mixBlendMode: (!isDesktop || isHovered) ? 'normal' : BROADSHEET_TOKENS.dormantBlend,
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
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0, height: 80,
            background: 'linear-gradient(to top, #121317, transparent)',
            pointerEvents: 'none',
          }} />
        </div>
      )}

      {/* Preview — only when collapsed */}
      {!isExpanded && story.subheadline && (
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

      {/* Body preview — only when collapsed */}
      {!isExpanded && story.body && (
        <p style={{
          fontFamily: BROADSHEET_TOKENS.fontBody,
          fontSize: isDesktop ? 15 : 14,
          lineHeight: 1.6,
          color: '#8b949e',
          maxWidth: 720,
          margin: 0,
          marginTop: story.subheadline ? 8 : 0,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {story.body.replace(/\*\*(.*?)\*\*/g, '$1').slice(0, 300)}
          {story.body.length > 300 ? '...' : ''}
        </p>
      )}

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <ExpandedContent story={story} onCollapse={onCollapse} onResearch={onResearch} />
        )}
      </AnimatePresence>
    </article>
  );
}

// ── Secondary Variant ──
function SecondaryStory({ story, isDesktop, onClick, isExpanded, onCollapse, onResearch }) {
  const [isHovered, setIsHovered] = useState(false);
  const reporterColor = REPORTER_COLORS[story.reporter];

  return (
    <article
      onClick={onClick}
      onKeyDown={handleKeyDown(onClick)}
      tabIndex={0}
      role="button"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: isDesktop ? 48 : 24,
        cursor: 'pointer',
        backgroundColor: isHovered && !isExpanded ? BROADSHEET_TOKENS.bgHoverStory : 'transparent',
        transition: 'background-color 0.2s ease',
      }}
    >
      <BeatBadge reporter={story.reporter} style={{ marginBottom: 12 }} />

      <h3 style={{
        fontFamily: BROADSHEET_TOKENS.fontHeadline,
        fontSize: isDesktop ? (isExpanded ? 34 : 30) : 22,
        fontWeight: 700,
        lineHeight: 1.2,
        color: (isHovered && !isExpanded) ? '#00d9ff' : '#e3e2e7',
        margin: '12px 0',
        transition: 'color 0.2s ease, font-size 0.3s ease',
        textWrap: 'balance',
      }}>
        {story.headline}
      </h3>

      {/* Preview — only when collapsed */}
      {!isExpanded && story.subheadline && (
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

      {!isExpanded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ReporterAvatar reporter={story.reporter} size={40} />
          <div>
            <div style={{
              fontFamily: BROADSHEET_TOKENS.fontBody,
              fontSize: 13, fontWeight: 600, color: '#e3e2e7',
            }}>
              {reporterColor?.name || story.reporter}
            </div>
            <div style={{
              fontFamily: BROADSHEET_TOKENS.fontMono,
              fontSize: 11, color: '#859398', textTransform: 'uppercase',
            }}>
              {reporterColor?.beat} • {timeAgo(story.publishedAt)}
            </div>
          </div>
        </div>
      )}

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <ExpandedContent story={story} onCollapse={onCollapse} onResearch={onResearch} />
        )}
      </AnimatePresence>
    </article>
  );
}

// ── Compact Variant (mobile below-fold) ──
function CompactStory({ story, onClick, isExpanded, onCollapse, onResearch }) {
  const reporterColor = REPORTER_COLORS[story.reporter];

  return (
    <article
      onClick={onClick}
      onKeyDown={handleKeyDown(onClick)}
      tabIndex={0}
      role="button"
      style={{
        padding: '12px 16px 12px 18px',
        borderLeft: `2px solid ${reporterColor?.hex || '#859398'}`,
        cursor: 'pointer',
      }}
    >
      <span style={{
        fontFamily: BROADSHEET_TOKENS.fontMono,
        fontSize: 9, fontWeight: 700, letterSpacing: '0.15em',
        textTransform: 'uppercase', color: reporterColor?.hex || '#859398',
      }}>
        {reporterColor?.name} // {reporterColor?.beat}
      </span>

      <h4 style={{
        fontFamily: BROADSHEET_TOKENS.fontHeadline,
        fontSize: 20, fontWeight: 700, lineHeight: 1.25,
        color: '#e3e2e7', margin: '6px 0', textWrap: 'balance',
      }}>
        {story.headline}
      </h4>

      {/* Preview — only when collapsed */}
      {!isExpanded && story.subheadline && (
        <p style={{
          fontFamily: BROADSHEET_TOKENS.fontBody,
          fontSize: 13, lineHeight: 1.5, color: '#bbc9ce',
          margin: '0 0 6px',
          display: '-webkit-box', WebkitLineClamp: 1,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {story.subheadline.replace(/\*\*/g, '')}
        </p>
      )}

      {!isExpanded && (
        <span style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 10, color: '#859398', textTransform: 'uppercase',
        }}>
          {reporterColor?.name} • {timeAgo(story.publishedAt)}
        </span>
      )}

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <ExpandedContent story={story} onCollapse={onCollapse} onResearch={onResearch} />
        )}
      </AnimatePresence>
    </article>
  );
}

// ── Dense Variant (older stories list — no expansion) ──
function DenseStory({ story, onClick }) {
  return (
    <article
      onClick={onClick}
      onKeyDown={handleKeyDown(onClick)}
      tabIndex={0}
      role="button"
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
        fontSize: 15, fontWeight: 600, lineHeight: 1.3,
        color: '#e3e2e7', margin: 0, flex: 1,
      }}>
        {story.headline}
      </h4>
      <span style={{
        fontFamily: BROADSHEET_TOKENS.fontMono,
        fontSize: 10, color: '#859398', whiteSpace: 'nowrap', flexShrink: 0,
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
  onResearch,
  showVisual = true,
}) {
  if (!story) return null;

  const storyRef = useRef(null);

  const handleClick = () => {
    if (onExpand) onExpand(story.id);
  };

  // Auto-collapse when story scrolls fully above viewport
  useEffect(() => {
    if (!isExpanded || !storyRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && entry.boundingClientRect.bottom < 0) {
          if (onCollapse) onCollapse();
        }
      },
      { threshold: 0 }
    );
    observer.observe(storyRef.current);
    return () => observer.disconnect();
  }, [isExpanded, onCollapse]);

  // Scroll into view on expansion
  useEffect(() => {
    if (isExpanded && storyRef.current) {
      const timer = setTimeout(() => {
        storyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  return (
    <motion.div ref={storyRef} layout transition={{ layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } }}>
      {variant === 'hero' && (
        <HeroStory story={story} isDesktop={isDesktop} onClick={handleClick} showVisual={showVisual}
          isExpanded={isExpanded} onCollapse={onCollapse} onResearch={onResearch} />
      )}
      {variant === 'secondary' && (
        <SecondaryStory story={story} isDesktop={isDesktop} onClick={handleClick}
          isExpanded={isExpanded} onCollapse={onCollapse} onResearch={onResearch} />
      )}
      {variant === 'compact' && (
        <CompactStory story={story} onClick={handleClick}
          isExpanded={isExpanded} onCollapse={onCollapse} onResearch={onResearch} />
      )}
      {variant === 'dense' && (
        <DenseStory story={story} onClick={handleClick} />
      )}
    </motion.div>
  );
}
