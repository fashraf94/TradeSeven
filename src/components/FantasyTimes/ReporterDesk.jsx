// src/components/FantasyTimes/ReporterDesk.jsx
// Individual reporter section with layout per REPORTER_LAYOUTS.
// Kai: 3-col dense grid, Alex: 2-col ticker cards, Neta/Doug: 2-col editorial, Kim: centered essay.

import React, { useMemo } from 'react';
import { REPORTER_COLORS, BROADSHEET_TOKENS, REPORTER_LAYOUTS } from '../../constants/reporterTheme';
import EditorialStory from './EditorialStory';
import KimDropCapColumn from './KimDropCapColumn';

const BIO_TAGLINES = {
  kai: 'Watching the tape so you don\'t have to',
  alex: 'Tracking individual stock catalysts',
  neta: 'Making sense of the numbers',
  doug: 'Your earnings season guide',
  kim: 'Connecting the dots across markets',
};

const EMPTY_HINTS = {
  kai: 'market hours',
  alex: 'active trading',
  neta: 'economic releases',
  doug: 'earnings season',
  kim: 'next Monday',
};

// ── Section Header (shared by all desks) ──

function DeskHeader({ reporter, isDesktop }) {
  const color = REPORTER_COLORS[reporter];
  if (!color) return null;

  return (
    <div style={{
      padding: isDesktop ? '0 48px' : '0 16px',
      marginBottom: 24,
    }}>
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontMono,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        color: color.hex,
      }}>
        {color.beat}
      </div>
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontBody,
        fontSize: 13,
        fontStyle: 'italic',
        color: '#8b949e',
        marginTop: 4,
      }}>
        {BIO_TAGLINES[reporter]}
      </div>
      <div style={{
        height: 1,
        backgroundColor: BROADSHEET_TOKENS.sectionRule,
        marginTop: 16,
      }} />
    </div>
  );
}

// ── Empty State ──

function EmptyDesk({ reporter }) {
  const color = REPORTER_COLORS[reporter];
  return (
    <div style={{
      padding: '80px 20px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontHeadline,
        fontSize: 18,
        fontStyle: 'italic',
        color: '#8b949e',
        marginBottom: 12,
      }}>
        {color?.name || reporter}'s desk is quiet right now
      </div>
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontBody,
        fontSize: 13,
        color: '#6e7681',
      }}>
        Check back during {EMPTY_HINTS[reporter] || 'the next session'}
      </div>
    </div>
  );
}

// ── Kai's Desk: 3-column dense grid ──

function KaiDesk({ stories, isDesktop, onStoryExpand, expandedStoryId, onResearch }) {
  if (stories.length === 0) return <EmptyDesk reporter="kai" />;

  const lead = stories[0];
  const secondary = stories.slice(1, 3);
  const older = stories.slice(3);
  const columnCount = isDesktop ? Math.min(stories.length, 3) : 1;

  if (!isDesktop) {
    return (
      <div style={{ padding: '0 16px' }}>
        {stories.slice(0, 2).map(s => (
          <EditorialStory key={s.id} story={s} variant="compact" onExpand={onStoryExpand}
            isExpanded={expandedStoryId === s.id} onCollapse={() => onStoryExpand(null)} onResearch={onResearch} />
        ))}
        {stories.slice(2).map(s => (
          <EditorialStory key={s.id} story={s} variant="dense" onExpand={onStoryExpand} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Top row: 3-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gap: 0,
        alignItems: 'start',
      }}>
        {/* Lead story */}
        <div style={{
          borderRight: columnCount > 1 ? `1px solid ${BROADSHEET_TOKENS.columnRule}` : 'none',
          padding: 48,
        }}>
          <EditorialStory story={lead} variant="secondary" isDesktop onExpand={onStoryExpand} showVisual
            isExpanded={expandedStoryId === lead.id} onCollapse={() => onStoryExpand(null)} onResearch={onResearch} />
        </div>

        {/* Secondary stories */}
        {secondary.map((s, idx) => (
          <div key={s.id} style={{
            borderRight: idx === 0 && columnCount > 2 ? `1px solid ${BROADSHEET_TOKENS.columnRule}` : 'none',
            padding: 48,
          }}>
            <EditorialStory story={s} variant="secondary" isDesktop onExpand={onStoryExpand}
              isExpanded={expandedStoryId === s.id} onCollapse={() => onStoryExpand(null)} onResearch={onResearch} />
          </div>
        ))}
      </div>

      {/* Older stories */}
      {older.length > 0 && (
        <div style={{ padding: '0 48px 48px' }}>
          <div style={{
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 10,
            color: '#859398',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            EARLIER
          </div>
          {older.map(s => (
            <EditorialStory key={s.id} story={s} variant="dense" isDesktop onExpand={onStoryExpand} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Alex's Desk: 2-column ticker card grid ──

function AlexTickerCard({ story, onStorySelect }) {
  const change = story.dataSnapshot?.percentChange || 0;
  const isPositive = change >= 0;
  const ticker = story.primaryTicker || (story.tickers && story.tickers[0]) || '';
  const price = story.dataSnapshot?.price;

  // If no price data, fall back to compact editorial
  if (!price && !change) {
    return <EditorialStory story={story} variant="compact" onExpand={() => onStorySelect(story)} />;
  }

  return (
    <div
      onClick={() => onStorySelect(story)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStorySelect(story); } }}
      tabIndex={0}
      role="button"
      style={{
        backgroundColor: '#343439',
        padding: 24,
        borderRadius: 0,
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3e3e44'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#343439'}
    >
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
        lineHeight: 1.2,
      }}>
        {story.headline?.length > 50 ? story.headline.slice(0, 50) + '...' : story.headline}
      </div>
      {price && (
        <div style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 24,
          fontWeight: 700,
          color: '#e3e2e7',
          marginBottom: 4,
        }}>
          ${typeof price === 'number' ? price.toFixed(2) : price}
        </div>
      )}
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

function AlexDesk({ stories, isDesktop, onStorySelect }) {
  if (stories.length === 0) return <EmptyDesk reporter="alex" />;

  if (!isDesktop) {
    return (
      <div style={{ padding: '0 16px' }}>
        {stories.map(s => {
          const change = s.dataSnapshot?.percentChange || 0;
          const ticker = s.primaryTicker || (s.tickers && s.tickers[0]) || '';
          return (
            <div
              key={s.id}
              onClick={() => onStorySelect(s)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStorySelect(s); } }}
              tabIndex={0}
              role="button"
              style={{
                borderLeft: `2px solid ${REPORTER_COLORS.alex.hex}`,
                padding: '12px 16px',
                cursor: 'pointer',
                marginBottom: 8,
              }}
            >
              <div style={{
                fontFamily: BROADSHEET_TOKENS.fontMono,
                fontSize: 10,
                color: '#859398',
                textTransform: 'uppercase',
              }}>
                {ticker}
              </div>
              <div style={{
                fontFamily: BROADSHEET_TOKENS.fontHeadline,
                fontSize: 18,
                fontWeight: 700,
                color: '#e3e2e7',
                margin: '4px 0',
              }}>
                {s.headline}
              </div>
              {change !== 0 && (
                <span style={{
                  fontFamily: BROADSHEET_TOKENS.fontMono,
                  fontSize: 12,
                  fontWeight: 600,
                  color: change >= 0 ? '#00d9ff' : '#ffb4ab',
                }}>
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ padding: '0 48px 48px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 1,
        backgroundColor: BROADSHEET_TOKENS.bgMoverCard,
      }}>
        {stories.map(s => (
          <AlexTickerCard key={s.id} story={s} onStorySelect={onStorySelect} />
        ))}
      </div>
    </div>
  );
}

// ── Neta's Desk: 2-column editorial ──

function EditorialDesk({ stories, reporter, isDesktop, onStoryExpand, emptyMessage, expandedStoryId, onResearch }) {
  if (stories.length === 0) {
    if (emptyMessage) {
      return (
        <div style={{
          padding: '80px 20px',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: BROADSHEET_TOKENS.fontHeadline,
            fontSize: 16,
            fontStyle: 'italic',
            color: '#8b949e',
            maxWidth: 400,
            margin: '0 auto',
            lineHeight: 1.5,
          }}>
            {emptyMessage}
          </div>
        </div>
      );
    }
    return <EmptyDesk reporter={reporter} />;
  }

  if (!isDesktop) {
    return (
      <div style={{ padding: '0 16px' }}>
        {stories.map(s => (
          <EditorialStory key={s.id} story={s} variant="compact" onExpand={onStoryExpand}
            isExpanded={expandedStoryId === s.id} onCollapse={() => onStoryExpand(null)} onResearch={onResearch} />
        ))}
      </div>
    );
  }

  // 2-column grid with column rule
  const left = stories.filter((_, i) => i % 2 === 0);
  const right = stories.filter((_, i) => i % 2 === 1);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: right.length > 0 ? '1fr 1fr' : '1fr',
      gap: 0,
      alignItems: 'start',
    }}>
      <div style={{
        borderRight: right.length > 0 ? `1px solid ${BROADSHEET_TOKENS.columnRule}` : 'none',
      }}>
        {left.map(s => (
          <EditorialStory key={s.id} story={s} variant="secondary" isDesktop onExpand={onStoryExpand}
            isExpanded={expandedStoryId === s.id} onCollapse={() => onStoryExpand(null)} onResearch={onResearch} />
        ))}
      </div>
      {right.length > 0 && (
        <div>
          {right.map(s => (
            <EditorialStory key={s.id} story={s} variant="secondary" isDesktop onExpand={onStoryExpand}
              isExpanded={expandedStoryId === s.id} onCollapse={() => onStoryExpand(null)} onResearch={onResearch} />
          ))}
        </div>
      )}
    </div>
  );
}

function NetaDesk({ stories, isDesktop, onStoryExpand, expandedStoryId, onResearch }) {
  // Sort: previews first, then recaps
  const sorted = [...stories].sort((a, b) => {
    const aPreview = a.type === 'econ_preview' ? 0 : 1;
    const bPreview = b.type === 'econ_preview' ? 0 : 1;
    return aPreview - bPreview;
  });

  return (
    <EditorialDesk
      stories={sorted}
      reporter="neta"
      isDesktop={isDesktop}
      onStoryExpand={onStoryExpand}
      expandedStoryId={expandedStoryId}
      onResearch={onResearch}
    />
  );
}

function DougDesk({ stories, isDesktop, onStoryExpand, expandedStoryId, onResearch }) {
  // Sort: previews first, then recaps
  const sorted = [...stories].sort((a, b) => {
    const aPreview = a.type === 'earnings_preview' ? 0 : 1;
    const bPreview = b.type === 'earnings_preview' ? 0 : 1;
    return aPreview - bPreview;
  });

  return (
    <EditorialDesk
      stories={sorted}
      reporter="doug"
      isDesktop={isDesktop}
      onStoryExpand={onStoryExpand}
      expandedStoryId={expandedStoryId}
      onResearch={onResearch}
      emptyMessage="Earnings season is quiet. Doug will be back when companies start reporting."
    />
  );
}

// ── Kim's Desk: single centered essay column ──

function KimDesk({ stories, isDesktop, onStoryExpand, onStorySelect, expandedStoryId, onResearch }) {
  if (stories.length === 0) return <EmptyDesk reporter="kim" />;

  const layout = REPORTER_LAYOUTS.kim;
  const latest = stories[0];
  const older = stories.slice(1);

  return (
    <div style={{
      maxWidth: isDesktop ? layout.maxWidth : '100%',
      margin: '0 auto',
      padding: isDesktop ? '0 0 48px' : '0 24px 32px',
    }}>
      {/* Latest: full essay with drop cap */}
      <KimDropCapColumn story={latest} isDesktop={isDesktop} onStorySelect={onStorySelect} />

      {/* Older Kim stories */}
      {older.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 10,
            color: '#859398',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            EARLIER COLUMNS
          </div>
          {older.map(s => (
            <EditorialStory key={s.id} story={s} variant="compact" onExpand={onStoryExpand}
              isExpanded={expandedStoryId === s.id} onCollapse={() => onStoryExpand(null)} onResearch={onResearch} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export default function ReporterDesk({
  reporter,
  stories,
  isDesktop,
  expandedStoryId,
  onStoryExpand,
  onStorySelect,
  onResearch,
}) {
  if (!reporter || !REPORTER_COLORS[reporter]) return null;

  // Sort stories by publishedAt descending (memoized)
  const sorted = useMemo(() =>
    [...(stories || [])].sort((a, b) => {
      const aMs = a.publishedAt?._seconds ? a.publishedAt._seconds * 1000 : new Date(a.publishedAt || 0).getTime();
      const bMs = b.publishedAt?._seconds ? b.publishedAt._seconds * 1000 : new Date(b.publishedAt || 0).getTime();
      return bMs - aMs;
    }),
    [stories]
  );

  return (
    <div style={{ paddingTop: isDesktop ? 32 : 16 }}>
      <DeskHeader reporter={reporter} isDesktop={isDesktop} />

      {reporter === 'kai' && (
        <KaiDesk stories={sorted} isDesktop={isDesktop} onStoryExpand={onStoryExpand}
          expandedStoryId={expandedStoryId} onResearch={onResearch} />
      )}
      {reporter === 'alex' && (
        <AlexDesk stories={sorted} isDesktop={isDesktop} onStorySelect={onStorySelect || onStoryExpand} />
      )}
      {reporter === 'neta' && (
        <NetaDesk stories={sorted} isDesktop={isDesktop} onStoryExpand={onStoryExpand}
          expandedStoryId={expandedStoryId} onResearch={onResearch} />
      )}
      {reporter === 'doug' && (
        <DougDesk stories={sorted} isDesktop={isDesktop} onStoryExpand={onStoryExpand}
          expandedStoryId={expandedStoryId} onResearch={onResearch} />
      )}
      {reporter === 'kim' && (
        <KimDesk stories={sorted} isDesktop={isDesktop} onStoryExpand={onStoryExpand}
          expandedStoryId={expandedStoryId} onResearch={onResearch}
          onStorySelect={onStorySelect || onStoryExpand} />
      )}
    </div>
  );
}
