// src/components/FantasyTimes/BroadsheetFrontPage.jsx
// Editorial front page layout — hero zone + fold + below-fold sections + movers.

import React, { useMemo } from 'react';
import { REPORTER_COLORS, BROADSHEET_TOKENS } from '../../constants/reporterTheme';
import EditorialStory from './EditorialStory';
import ReporterAvatar from './ReporterAvatar';
import { toDate } from '../../utils/timeAgo';
import { ChevronUp } from 'lucide-react';

// ── Story Selection Logic ──

function selectFrontPageStories(stories) {
  if (!stories || stories.length === 0) return { hero: null, sidebar: null, belowFold: [], movers: [] };

  // Sort all stories by publishedAt desc
  const sorted = [...stories].sort((a, b) => toDate(b.publishedAt).getTime() - toDate(a.publishedAt).getTime());

  // Hero: most recent with urgency "breaking" or "timely", fallback to most recent
  const hero = sorted.find(s => s.urgency === 'breaking' || s.urgency === 'timely') || sorted[0];

  // Sidebar: most recent Kim story (sector_column), fallback to most recent evergreen
  const sidebar = sorted.find(s => s.type === 'sector_column' && s.id !== hero?.id)
    || sorted.find(s => s.urgency === 'evergreen' && s.id !== hero?.id)
    || null;

  // Below-fold: Alex market_mover + Neta econ story, excluding hero/sidebar
  const used = new Set([hero?.id, sidebar?.id].filter(Boolean));
  const belowFoldLeft = sorted.find(s => s.type === 'market_mover' && !used.has(s.id)) || null;
  if (belowFoldLeft) used.add(belowFoldLeft.id);
  const belowFoldRight = sorted.find(s =>
    (s.type === 'econ_recap' || s.type === 'econ_preview') && !used.has(s.id)
  ) || null;

  const belowFold = [belowFoldLeft, belowFoldRight].filter(Boolean);

  // Movers: all market_mover stories, sorted by |percentChange| desc
  const movers = sorted
    .filter(s => s.type === 'market_mover')
    .sort((a, b) => {
      const aChange = Math.abs(a.dataSnapshot?.percentChange || 0);
      const bChange = Math.abs(b.dataSnapshot?.percentChange || 0);
      return bChange - aChange;
    });

  return { hero, sidebar, belowFold, movers };
}

function isBreakingRecent(story) {
  if (!story || story.urgency !== 'breaking') return false;
  const publishedMs = toDate(story.publishedAt).getTime();
  return (Date.now() - publishedMs) < 2 * 60 * 60 * 1000; // 2 hours
}

// ── Mover Card (inline, no separate component for Phase 1) ──

function MoverCard({ story }) {
  const reporterColor = REPORTER_COLORS[story.reporter];
  const change = story.dataSnapshot?.percentChange || 0;
  const isPositive = change >= 0;
  const ticker = story.primaryTicker || (story.tickers && story.tickers[0]) || '';

  return (
    <div style={{
      backgroundColor: '#343439',
      padding: 24,
      borderRadius: 0,
      cursor: 'pointer',
    }}>
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontMono,
        fontSize: 10,
        color: '#859398',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 4,
      }}>
        {ticker}
      </div>
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontHeadline,
        fontSize: 20,
        fontWeight: 700,
        color: '#e3e2e7',
        marginBottom: 8,
      }}>
        {story.headline?.split(':')[0] || ticker}
      </div>
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontMono,
        fontSize: 12,
        fontWeight: 600,
        color: isPositive ? '#00d9ff' : '#ffb4ab',
      }}>
        {isPositive ? '+' : ''}{change.toFixed(2)}%
      </div>
    </div>
  );
}

// ── Mobile Breaking Hero ──

function MobileBreakingHero({ hero, onStoryExpand }) {
  const reporterColor = REPORTER_COLORS[hero.reporter];

  return (
    <div
      onClick={() => onStoryExpand && onStoryExpand(hero.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStoryExpand?.(hero.id); } }}
      tabIndex={0}
      role="button"
      style={{
        minHeight: '75vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '24px 16px 32px',
        position: 'relative',
        cursor: 'pointer',
        overflow: 'hidden',
        backgroundColor: '#0D0E12',
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: -40,
        width: 256,
        height: 256,
        borderRadius: '50%',
        background: `rgba(${reporterColor?.rgb || '0,217,255'}, 0.15)`,
        filter: 'blur(100px)',
        pointerEvents: 'none',
      }} />

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, transparent 30%, rgba(13,14,18,0.4) 60%, #0D0E12 100%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <span style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 12,
          fontWeight: 700,
          color: reporterColor?.hex || '#00d9ff',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: 12,
          display: 'block',
        }}>
          BREAKING
        </span>

        <h2 style={{
          fontFamily: BROADSHEET_TOKENS.fontHeadline,
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          color: '#e3e2e7',
          margin: '0 0 16px',
          textWrap: 'balance',
        }}>
          {hero.headline}
        </h2>

        {hero.subheadline && (
          <p style={{
            fontFamily: BROADSHEET_TOKENS.fontBody,
            fontSize: 14,
            lineHeight: 1.5,
            color: '#bbc9ce',
            margin: '0 0 16px',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {hero.subheadline.replace(/\*\*/g, '')}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ReporterAvatar reporter={hero.reporter} size={32} />
          <span style={{
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 11,
            color: '#859398',
            textTransform: 'uppercase',
          }}>
            {reporterColor?.name} • {reporterColor?.beat}
          </span>
        </div>
      </div>

      {/* Swipe-up indicator */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: 0.4,
      }}>
        <ChevronUp size={18} color="#859398" />
        <span style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 9,
          color: '#859398',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}>
          MORE
        </span>
      </div>
    </div>
  );
}

// ── Mobile Normal Lead ──

function MobileNormalLead({ hero, onStoryExpand }) {
  return (
    <EditorialStory
      story={hero}
      variant="hero"
      isDesktop={false}
      onExpand={onStoryExpand}
      showVisual={true}
    />
  );
}

// ── Desktop Front Page ──

function DesktopFrontPage({ hero, sidebar, belowFold, movers, onStoryExpand }) {
  return (
    <div>
      {/* ═══ ABOVE THE FOLD ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: sidebar ? '3fr 1fr' : '1fr',
        minHeight: BROADSHEET_TOKENS.heroMinHeight,
        backgroundColor: '#121317',
      }}>
        {/* Hero (left) */}
        <div style={{
          borderRight: sidebar ? `1px solid ${BROADSHEET_TOKENS.sectionRule}` : 'none',
        }}>
          {hero && (
            <EditorialStory
              story={hero}
              variant="hero"
              isDesktop={true}
              onExpand={onStoryExpand}
              showVisual={true}
            />
          )}
        </div>

        {/* Sidebar (right — typically Kim) */}
        {sidebar && (
          <div
            onClick={() => onStoryExpand && onStoryExpand(sidebar.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStoryExpand?.(sidebar.id); } }}
            tabIndex={0}
            role="button"
            style={{
              backgroundColor: BROADSHEET_TOKENS.bgSidebarStory,
              padding: 32,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span style={{
              fontFamily: BROADSHEET_TOKENS.fontMono,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: REPORTER_COLORS[sidebar.reporter]?.hex || '#ffdbd8',
              marginBottom: 12,
            }}>
              {REPORTER_COLORS[sidebar.reporter]?.beat || 'OPINION'}
            </span>

            <h3 style={{
              fontFamily: BROADSHEET_TOKENS.fontHeadline,
              fontSize: 24,
              fontWeight: 700,
              lineHeight: 1.25,
              color: '#e3e2e7',
              margin: '0 0 12px',
              textWrap: 'balance',
            }}>
              {sidebar.headline}
            </h3>

            {sidebar.subheadline && (
              <p style={{
                fontFamily: BROADSHEET_TOKENS.fontBody,
                fontSize: 14,
                lineHeight: 1.6,
                color: '#bbc9ce',
                margin: '0 0 16px',
                flex: 1,
                display: '-webkit-box',
                WebkitLineClamp: 5,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {sidebar.subheadline.replace(/\*\*/g, '')}
              </p>
            )}

            <div style={{
              fontFamily: BROADSHEET_TOKENS.fontMono,
              fontSize: 10,
              color: '#859398',
              textTransform: 'uppercase',
            }}>
              BY {REPORTER_COLORS[sidebar.reporter]?.name || sidebar.reporter}
            </div>
          </div>
        )}
      </div>

      {/* ═══ THE FOLD ═══ */}
      {belowFold.length > 0 && (
        <div style={{
          height: 1,
          backgroundColor: BROADSHEET_TOKENS.foldLine,
        }} />
      )}

      {/* ═══ BELOW THE FOLD ═══ */}
      {belowFold.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: belowFold.length > 1 ? '1fr 1fr' : '1fr',
        }}>
          {belowFold.map((story, idx) => (
            <div
              key={story.id}
              style={{
                borderRight: idx === 0 && belowFold.length > 1
                  ? `1px solid ${BROADSHEET_TOKENS.sectionRule}`
                  : 'none',
              }}
            >
              <EditorialStory
                story={story}
                variant="secondary"
                isDesktop={true}
                onExpand={onStoryExpand}
              />
            </div>
          ))}
        </div>
      )}

      {/* ═══ MOVERS & SPOTLIGHTS ═══ */}
      {movers.length > 0 && (
        <MoversSection movers={movers} />
      )}
    </div>
  );
}

// ── Mobile Front Page ──

function MobileFrontPage({ hero, stories, movers, isBreaking, onStoryExpand }) {
  // Remaining stories (not the hero)
  const remaining = stories.filter(s => s.id !== hero?.id);

  return (
    <div>
      {/* Hero */}
      {hero && isBreaking ? (
        <MobileBreakingHero hero={hero} onStoryExpand={onStoryExpand} />
      ) : hero ? (
        <MobileNormalLead hero={hero} onStoryExpand={onStoryExpand} />
      ) : null}

      {/* Hairline rule */}
      {remaining.length > 0 && (
        <div style={{ height: 1, backgroundColor: BROADSHEET_TOKENS.foldLine, margin: '0 16px' }} />
      )}

      {/* Below-fold stories (compact) */}
      <div style={{ padding: '8px 0' }}>
        {remaining.slice(0, 8).map((story) => (
          <EditorialStory
            key={story.id}
            story={story}
            variant="compact"
            isDesktop={false}
            onExpand={onStoryExpand}
          />
        ))}
      </div>

      {/* Movers horizontal scroll */}
      {movers.length > 0 && (
        <div style={{ padding: '0 0 16px' }}>
          <div style={{
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 11,
            letterSpacing: '0.3em',
            color: '#859398',
            textTransform: 'uppercase',
            padding: '16px 16px 12px',
            borderTop: '1px solid rgba(60, 73, 77, 0.3)',
          }}>
            MOVERS & SPOTLIGHTS
          </div>
          <div style={{
            display: 'flex',
            gap: 1,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
            padding: '0 16px',
          }}>
            {movers.slice(0, 6).map(story => (
              <div key={story.id} style={{ minWidth: 140, flexShrink: 0 }}>
                <MoverCard story={story} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Movers Section (Desktop) ──

function MoversSection({ movers }) {
  return (
    <div style={{ backgroundColor: BROADSHEET_TOKENS.bgSidebarStory }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 48px 16px',
        borderTop: '1px solid rgba(60, 73, 77, 0.3)',
      }}>
        <span style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 12,
          letterSpacing: '0.4em',
          color: '#859398',
          textTransform: 'uppercase',
        }}>
          MOVERS & SPOTLIGHTS
        </span>
        <span style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 11,
          color: REPORTER_COLORS.alex.hex,
          cursor: 'pointer',
          letterSpacing: '0.05em',
        }}>
          VIEW FULL TICKER
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 1,
        backgroundColor: BROADSHEET_TOKENS.bgMoverCard,
        padding: '0 48px 48px',
      }}>
        {movers.slice(0, 6).map(story => (
          <MoverCard key={story.id} story={story} />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ──

export default function BroadsheetFrontPage({ stories, onStoryExpand, isDesktop, expandedStoryId }) {
  const { hero, sidebar, belowFold, movers } = useMemo(
    () => selectFrontPageStories(stories),
    [stories]
  );

  const storyCount = stories?.length || 0;
  const isBreaking = isBreakingRecent(hero);

  if (storyCount === 0) return null;

  if (!isDesktop) {
    return (
      <MobileFrontPage
        hero={hero}
        stories={stories}
        movers={movers}
        isBreaking={isBreaking}
        onStoryExpand={onStoryExpand}
      />
    );
  }

  // Desktop: adaptive grid based on story count
  // 1 story: hero only (full width, no sidebar)
  // 2-3: hero + below-fold (no sidebar)
  // 4+: full layout with sidebar
  const showSidebar = storyCount >= 4 ? sidebar : null;

  return (
    <DesktopFrontPage
      hero={hero}
      sidebar={showSidebar}
      belowFold={storyCount >= 2 ? belowFold : []}
      movers={movers}
      onStoryExpand={onStoryExpand}
    />
  );
}
