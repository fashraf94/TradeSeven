// src/components/FantasyTimes/BroadsheetFrontPage.jsx
// Editorial front page layout — hero zone + fold + below-fold sections + movers.
// Phase 4: mobile polish, KimMobilePreview, time-of-day editorial rhythm.

import React, { useMemo } from 'react';
import { REPORTER_COLORS, BROADSHEET_TOKENS } from '../../constants/reporterTheme';
import { getMarketState } from '../../utils/marketSchedule';
import EditorialStory from './EditorialStory';
import StoryVisualSafe from './StoryVisualSafe';
import { toDate } from '../../utils/timeAgo';
import { ChevronUp } from 'lucide-react';

// ── Edition Detection ──

function getEdition() {
  const ms = getMarketState();
  if (ms.state === 'OPEN' || ms.state === 'PRE_MARKET') return 'live';
  // For CLOSED_AFTERHOURS, distinguish morning vs evening by ET hour
  if (ms.state === 'CLOSED_AFTERHOURS') {
    const etStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const etHour = new Date(etStr).getHours();
    if (etHour >= 4 && etHour < 10) return 'morning';
  }
  return 'evening'; // CLOSED_AFTERHOURS (evening), CLOSED_WEEKEND, CLOSED_HOLIDAY
}

// ── Story Selection Logic ──

function selectFrontPageStories(stories, edition) {
  if (!stories || stories.length === 0) return { hero: null, sidebar: null, belowFold: [], movers: [] };

  const sorted = [...stories].sort((a, b) => toDate(b.publishedAt).getTime() - toDate(a.publishedAt).getTime());

  const findBest = (predicate) => sorted.find(predicate) || null;

  let hero, sidebar;
  const used = new Set();

  if (edition === 'morning') {
    hero = findBest(s => s.type === 'econ_preview')
        || findBest(s => s.type === 'earnings_preview')
        || findBest(s => s.urgency === 'timely')
        || sorted[0];
    used.add(hero?.id);
    sidebar = findBest(s => s.type === 'sector_column' && !used.has(s.id));
  } else if (edition === 'evening') {
    hero = findBest(s => s.type === 'sector_column')
        || findBest(s => s.type === 'earnings_recap')
        || findBest(s => s.urgency !== 'breaking')
        || sorted[0];
    used.add(hero?.id);
    // Kim is likely hero, so sidebar gets Neta
    sidebar = findBest(s => s.reporter === 'neta' && !used.has(s.id))
           || findBest(s => s.type === 'sector_column' && !used.has(s.id));
  } else {
    // Live edition — default
    hero = findBest(s => s.urgency === 'breaking')
        || findBest(s => s.urgency === 'timely')
        || sorted[0];
    used.add(hero?.id);
    sidebar = findBest(s => s.type === 'sector_column' && !used.has(s.id))
           || findBest(s => s.urgency === 'evergreen' && !used.has(s.id));
  }

  if (sidebar) used.add(sidebar.id);

  // Below-fold
  const belowFoldLeft = findBest(s => s.type === 'market_mover' && !used.has(s.id));
  if (belowFoldLeft) used.add(belowFoldLeft.id);
  const belowFoldRight = findBest(s =>
    (s.type === 'econ_recap' || s.type === 'econ_preview') && !used.has(s.id)
  );
  const belowFold = [belowFoldLeft, belowFoldRight].filter(Boolean);

  // Movers: all market_mover stories, sorted by |percentChange| desc
  const movers = sorted
    .filter(s => s.type === 'market_mover')
    .sort((a, b) => Math.abs(b.dataSnapshot?.percentChange || 0) - Math.abs(a.dataSnapshot?.percentChange || 0));

  return { hero, sidebar, belowFold, movers };
}

function isBreakingRecent(story) {
  if (!story || story.urgency !== 'breaking') return false;
  const publishedMs = toDate(story.publishedAt).getTime();
  return (Date.now() - publishedMs) < 2 * 60 * 60 * 1000;
}

// ── Mover Card ──

function MoverCard({ story, onClick }) {
  const change = story.dataSnapshot?.percentChange || 0;
  const isPositive = change >= 0;
  const ticker = story.primaryTicker || (story.tickers && story.tickers[0]) || '';

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      tabIndex={0}
      role="button"
      style={{
        backgroundColor: '#343439',
        padding: 24,
        borderRadius: 0,
        cursor: 'pointer',
      }}
    >
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontMono,
        fontSize: 10, color: '#859398',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
      }}>
        {ticker}
      </div>
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontHeadline,
        fontSize: 20, fontWeight: 700, color: '#e3e2e7', marginBottom: 8,
      }}>
        {story.headline?.split(':')[0] || ticker}
      </div>
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontMono,
        fontSize: 12, fontWeight: 600,
        color: isPositive ? '#00d9ff' : '#ffb4ab',
      }}>
        {isPositive ? '+' : ''}{change.toFixed(2)}%
      </div>
    </div>
  );
}

// ── Kim Mobile Preview ──

function KimMobilePreview({ story, onStorySelect }) {
  if (!story) return null;
  const kimColor = REPORTER_COLORS.kim;
  const bodyPreview = (story.body || '').replace(/\*\*(.*?)\*\*/g, '$1').substring(0, 200);

  return (
    <div style={{
      position: 'relative',
      background: BROADSHEET_TOKENS.bgPage,
      padding: 24,
      borderLeft: `4px solid ${kimColor.hex}`,
      borderTop: '1px solid rgba(60, 73, 77, 0.2)',
      borderBottom: '1px solid rgba(60, 73, 77, 0.2)',
      overflow: 'hidden',
    }}>
      {/* Purple ambient glow */}
      <div style={{
        position: 'absolute', bottom: -80, left: -80,
        width: 256, height: 256,
        background: 'rgba(139, 92, 246, 0.1)',
        filter: 'blur(80px)', borderRadius: '50%',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <span style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 10, letterSpacing: '0.3em',
          color: kimColor.hex,
          textTransform: 'uppercase', fontWeight: 700,
          display: 'block', marginBottom: 16,
        }}>
          KIM'S WEEKLY
        </span>
        <h3 style={{
          fontFamily: BROADSHEET_TOKENS.fontHeadline,
          fontSize: 22, fontWeight: 700,
          lineHeight: 1.2, color: '#e3e2e7',
          margin: '0 0 16px', textWrap: 'balance',
        }}>
          {story.headline}
        </h3>
        {bodyPreview && (
          <p style={{
            fontFamily: BROADSHEET_TOKENS.fontBody,
            fontSize: 14, lineHeight: 1.8, color: '#b3b9c5',
            margin: '0 0 24px',
          }}>
            {bodyPreview}...
          </p>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onStorySelect?.(story); }}
          style={{
            background: 'transparent', border: 'none',
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 10, color: kimColor.hex,
            textTransform: 'uppercase', letterSpacing: '0.2em',
            fontWeight: 700, cursor: 'pointer',
            borderBottom: `1px solid ${kimColor.hex}`,
            paddingBottom: 2, padding: '2px 0',
          }}
        >
          READ FULL COLUMN
        </button>
      </div>
    </div>
  );
}

// ── Mobile Breaking Hero ──

const swipeKeyframes = `
  @keyframes swipeHint { 0%, 100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(8px); } }
  @media (prefers-reduced-motion: reduce) { .swipe-hint { animation: none !important; } }
`;

function MobileBreakingHero({ hero, onStoryExpand }) {
  const reporterColor = REPORTER_COLORS[hero.reporter];
  const hasVisual = hero.visualType && hero.visualType !== 'none';

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
      <style>{swipeKeyframes}</style>

      {/* Art Director visual as background */}
      {hasVisual && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: 320,
          filter: 'grayscale(1) brightness(0.75) contrast(1.25)',
          opacity: 0.6, zIndex: 0, overflow: 'hidden',
        }}>
          <StoryVisualSafe
            visualType={hero.visualType}
            visualConfig={hero.visualConfig}
            size="expanded"
          />
        </div>
      )}

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '25%', right: -80,
        width: 256, height: 256, borderRadius: '50%',
        background: `rgba(${reporterColor?.rgb || '0,217,255'}, 0.1)`,
        filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, transparent 0%, rgba(18,19,23,0.4) 50%, #121317 100%)',
        pointerEvents: 'none', zIndex: 1,
      }} />

      <div style={{ position: 'relative', zIndex: 2 }}>
        <span style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 12, fontWeight: 700,
          color: reporterColor?.hex || '#00d9ff',
          letterSpacing: '0.2em', textTransform: 'uppercase',
          marginBottom: 12, display: 'block',
        }}>
          BREAKING
        </span>

        <h2 style={{
          fontFamily: BROADSHEET_TOKENS.fontHeadline,
          fontSize: 32, fontWeight: 700,
          letterSpacing: '-0.02em', lineHeight: 1.1,
          color: '#fff9ef', margin: '0 0 16px', textWrap: 'balance',
        }}>
          {hero.headline}
        </h2>

        {hero.subheadline && (
          <p style={{
            fontFamily: BROADSHEET_TOKENS.fontBody,
            fontSize: 14, lineHeight: 1.5, color: '#bbc9ce',
            margin: '0 0 16px',
            display: '-webkit-box', WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {hero.subheadline.replace(/\*\*/g, '')}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Square monogram per Stitch breaking mockup */}
          <div style={{
            width: 32, height: 32, borderRadius: 4,
            background: '#292a2e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: BROADSHEET_TOKENS.fontHeadline,
              fontSize: 16, fontWeight: 700,
              color: reporterColor?.hex || '#00d9ff',
            }}>
              {(hero.reporter || '').charAt(0).toUpperCase()}
            </span>
          </div>
          <span style={{
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 10, color: '#fff9ef',
            textTransform: 'uppercase', letterSpacing: '0.15em',
          }}>
            {reporterColor?.name} • {reporterColor?.beat}
          </span>
        </div>
      </div>

      {/* Swipe-up indicator */}
      <div className="swipe-hint" style={{
        position: 'absolute', bottom: 12, left: '50%',
        animation: 'swipeHint 2s ease-in-out infinite',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', opacity: 0.4, zIndex: 2,
      }}>
        <ChevronUp size={18} color="#859398" />
        <span style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 9, color: '#859398',
          letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>
          MORE
        </span>
      </div>
    </div>
  );
}

// ── Mobile Normal Lead ──

function MobileNormalLead({ hero, onStoryExpand, expandedStoryId, onResearch }) {
  return (
    <EditorialStory
      story={hero}
      variant="hero"
      isDesktop={false}
      onExpand={onStoryExpand}
      isExpanded={expandedStoryId === hero?.id}
      onCollapse={() => onStoryExpand(null)}
      onResearch={onResearch}
      showVisual={true}
    />
  );
}

// ── Section Header (mobile) ──

function MobileSectionHeader({ label, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '16px 16px 12px',
    }}>
      <span style={{
        width: 16, height: 1,
        backgroundColor: color,
        display: 'inline-block',
      }} />
      <span style={{
        fontFamily: BROADSHEET_TOKENS.fontMono,
        fontSize: 10, letterSpacing: '0.3em',
        color, textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  );
}

// ── Desktop Front Page ──

function DesktopFrontPage({ hero, sidebar, belowFold, movers, onStoryExpand, expandedStoryId, onResearch, onStorySelect, edition }) {
  // Evening edition with no sidebar uses relaxed 2-column above-fold
  const aboveFoldColumns = (edition === 'evening' && !sidebar) ? '1fr 1fr' : (sidebar ? '3fr 1fr' : '1fr');

  return (
    <div>
      {/* ═══ ABOVE THE FOLD ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: aboveFoldColumns,
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
              isExpanded={expandedStoryId === hero.id}
              onCollapse={() => onStoryExpand(null)}
              onResearch={onResearch}
              showVisual={true}
            />
          )}
        </div>

        {/* Sidebar (right — typically Kim) */}
        {sidebar && (
          <div
            onClick={() => onStorySelect?.(sidebar)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStorySelect?.(sidebar); } }}
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
              fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: REPORTER_COLORS[sidebar.reporter]?.hex || '#ffdbd8',
              marginBottom: 12,
            }}>
              {REPORTER_COLORS[sidebar.reporter]?.beat || 'OPINION'}
            </span>

            <h3 style={{
              fontFamily: BROADSHEET_TOKENS.fontHeadline,
              fontSize: 24, fontWeight: 700, lineHeight: 1.25,
              color: '#e3e2e7', margin: '0 0 12px', textWrap: 'balance',
            }}>
              {sidebar.headline}
            </h3>

            {sidebar.subheadline && (
              <p style={{
                fontFamily: BROADSHEET_TOKENS.fontBody,
                fontSize: 14, lineHeight: 1.6, color: '#bbc9ce',
                margin: '0 0 16px', flex: 1,
                display: '-webkit-box', WebkitLineClamp: 5,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {sidebar.subheadline.replace(/\*\*/g, '')}
              </p>
            )}

            <div style={{
              fontFamily: BROADSHEET_TOKENS.fontMono,
              fontSize: 10, color: '#859398', textTransform: 'uppercase',
            }}>
              BY {REPORTER_COLORS[sidebar.reporter]?.name || sidebar.reporter}
            </div>
          </div>
        )}
      </div>

      {/* ═══ THE FOLD ═══ */}
      {belowFold.length > 0 && (
        <div style={{ height: 1, backgroundColor: BROADSHEET_TOKENS.foldLine }} />
      )}

      {/* ═══ BELOW THE FOLD ═══ */}
      {belowFold.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: belowFold.length > 1 ? '1fr 1fr' : '1fr',
          alignItems: 'start',
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
                isExpanded={expandedStoryId === story.id}
                onCollapse={() => onStoryExpand(null)}
                onResearch={onResearch}
              />
            </div>
          ))}
        </div>
      )}

      {/* ═══ MOVERS & SPOTLIGHTS ═══ */}
      {movers.length > 0 && (
        <MoversSection movers={movers} onStorySelect={onStorySelect} />
      )}
    </div>
  );
}

// ── Mobile Front Page ──

function MobileFrontPage({ hero, stories, movers, isBreaking, onStoryExpand, expandedStoryId, onResearch, onStorySelect }) {
  const remaining = stories.filter(s => s.id !== hero?.id);
  // Find Kim's story for special treatment
  const kimStory = remaining.find(s => s.reporter === 'kim');
  const otherStories = remaining.filter(s => s.reporter !== 'kim');

  return (
    <div>
      {/* Hero */}
      {hero && isBreaking ? (
        <MobileBreakingHero hero={hero} onStoryExpand={onStoryExpand} />
      ) : hero ? (
        <MobileNormalLead hero={hero} onStoryExpand={onStoryExpand} expandedStoryId={expandedStoryId} onResearch={onResearch} />
      ) : null}

      {/* Hairline rule */}
      {remaining.length > 0 && (
        <div style={{ height: 1, backgroundColor: BROADSHEET_TOKENS.foldLine, margin: '0 16px' }} />
      )}

      {/* Below-fold stories (compact) */}
      <div style={{ padding: '8px 0' }}>
        {otherStories.slice(0, 6).map((story) => (
          <EditorialStory
            key={story.id}
            story={story}
            variant="compact"
            isDesktop={false}
            onExpand={onStoryExpand}
            isExpanded={expandedStoryId === story.id}
            onCollapse={() => onStoryExpand(null)}
            onResearch={onResearch}
          />
        ))}
      </div>

      {/* Kim's Weekly preview */}
      {kimStory && (
        <>
          <MobileSectionHeader label="SECTOR WATCH" color={REPORTER_COLORS.kim.hex} />
          <KimMobilePreview story={kimStory} onStorySelect={onStorySelect} />
        </>
      )}

      {/* Movers horizontal scroll */}
      {movers.length > 0 && (
        <div style={{ padding: '0 0 16px' }}>
          <MobileSectionHeader label="MOVERS" color={REPORTER_COLORS.alex.hex} />
          <div style={{
            display: 'flex', overflowX: 'auto', gap: 0,
            borderTop: '1px solid rgba(60, 73, 77, 0.2)',
            borderBottom: '1px solid rgba(60, 73, 77, 0.2)',
            msOverflowStyle: 'none', scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}>
            {movers.slice(0, 6).map(story => (
              <div
                key={story.id}
                onClick={() => onStorySelect?.(story)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStorySelect?.(story); } }}
                tabIndex={0}
                role="button"
                style={{
                  minWidth: 140, padding: 16,
                  background: '#121317',
                  borderRight: '1px solid rgba(60, 73, 77, 0.2)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                <span style={{
                  fontFamily: BROADSHEET_TOKENS.fontMono,
                  fontSize: 10, color: '#bbc9ce',
                  textTransform: 'uppercase', marginBottom: 4,
                }}>
                  {story.primaryTicker || 'STOCK'}
                </span>
                <span style={{
                  fontFamily: BROADSHEET_TOKENS.fontHeadline,
                  fontSize: 20, fontWeight: 700, color: '#e3e2e7',
                }}>
                  {story.dataSnapshot?.price
                    ? `$${Number(story.dataSnapshot.price).toLocaleString()}`
                    : story.primaryTicker || '—'}
                </span>
                <span style={{
                  fontFamily: BROADSHEET_TOKENS.fontMono,
                  fontSize: 10, marginTop: 4,
                  color: (story.dataSnapshot?.percentChange || 0) >= 0 ? '#00d9ff' : '#ffb4ab',
                }}>
                  {(story.dataSnapshot?.percentChange || 0) >= 0 ? '+' : ''}
                  {(story.dataSnapshot?.percentChange || 0).toFixed(2)}%{' '}
                  {(story.dataSnapshot?.percentChange || 0) >= 0 ? '▲' : '▼'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Movers Section (Desktop) ──

function MoversSection({ movers, onStorySelect }) {
  return (
    <div style={{ backgroundColor: BROADSHEET_TOKENS.bgSidebarStory }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 48px 16px',
        borderTop: '1px solid rgba(60, 73, 77, 0.3)',
      }}>
        <span style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 12, letterSpacing: '0.4em',
          color: '#859398', textTransform: 'uppercase',
        }}>
          MOVERS & SPOTLIGHTS
        </span>
        <span style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 11, color: REPORTER_COLORS.alex.hex,
          cursor: 'pointer', letterSpacing: '0.05em',
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
          <MoverCard key={story.id} story={story} onClick={() => onStorySelect?.(story)} />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ──

export default function BroadsheetFrontPage({ stories, onStoryExpand, isDesktop, expandedStoryId, onResearch, onStorySelect }) {
  const edition = useMemo(() => getEdition(), []);

  const { hero, sidebar, belowFold, movers } = useMemo(
    () => selectFrontPageStories(stories, edition),
    [stories, edition]
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
        expandedStoryId={expandedStoryId}
        onResearch={onResearch}
        onStorySelect={onStorySelect}
      />
    );
  }

  // Desktop: adaptive grid based on story count and edition
  const showSidebar = storyCount >= 4 ? sidebar : null;

  return (
    <DesktopFrontPage
      hero={hero}
      sidebar={showSidebar}
      belowFold={storyCount >= 2 ? belowFold : []}
      movers={movers}
      onStoryExpand={onStoryExpand}
      expandedStoryId={expandedStoryId}
      onResearch={onResearch}
      onStorySelect={onStorySelect}
      edition={edition}
    />
  );
}
