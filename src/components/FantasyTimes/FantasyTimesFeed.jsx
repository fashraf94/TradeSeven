// src/components/FantasyTimes/FantasyTimesFeed.jsx
// V3 Broadsheet orchestrator — masthead, reporter nav, front page / reporter desk content.

import React, { useState, useCallback, lazy, Suspense } from 'react';
import { REPORTER_COLORS, BROADSHEET_TOKENS } from '../../constants/reporterTheme';
import { useFantasyTimes } from '../../hooks/useFantasyTimes';
import { findStock } from '../../data/assets';
import { INDEX_REGISTRY } from '../../constants/indexRegistry';
import BroadsheetMasthead from './BroadsheetMasthead';
import ReporterNavStrip from './ReporterNavStrip';
import BroadsheetFrontPage from './BroadsheetFrontPage';

const AssetResearchModal = lazy(() => import('../draft/AssetResearchModal'));

/**
 * Check if current time is during US market hours (9:30 AM - 4 PM ET, weekdays).
 */
function isMarketOpen() {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const hour = et.getHours();
  const min = et.getMinutes();
  const minutesSinceMidnight = hour * 60 + min;
  return minutesSinceMidnight >= 570 && minutesSinceMidnight < 960;
}

export default function FantasyTimesFeed({
  currentUser,
  isMobile,
  isDesktop,
  userWatchlist = [],
  activeBattleTickers = [],
  onNavigate,
  onStorySelect,
}) {
  const [activeSection, setActiveSection] = useState('frontPage');
  const [expandedStoryId, setExpandedStoryId] = useState(null);
  const [researchSymbol, setResearchSymbol] = useState(null);

  const userContext = {
    watchlist: userWatchlist,
    activeBattleTickers,
    sectorPreferences: [],
  };

  const { stories, loading, error, refresh } = useFantasyTimes(userContext);

  const handleStoryExpand = useCallback((storyId) => {
    // Phase 1: delegate to existing StoryDetail via onStorySelect
    if (onStorySelect) {
      const story = stories.find(s => s.id === storyId);
      if (story) onStorySelect(story);
    }
  }, [onStorySelect, stories]);

  const marketOpen = isMarketOpen();

  // Reporter desk accent color for masthead border
  const mastheadAccent = activeSection !== 'frontPage' && REPORTER_COLORS[activeSection]
    ? REPORTER_COLORS[activeSection].hex
    : undefined;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: BROADSHEET_TOKENS.bgPage,
      color: '#e3e2e7',
    }}>
      <BroadsheetMasthead
        isDesktop={isDesktop}
        isLive={marketOpen}
        accentColor={mastheadAccent}
      />

      <ReporterNavStrip
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        isDesktop={isDesktop}
      />

      {/* Content area */}
      <main style={{
        paddingBottom: isMobile ? 80 : 0,
      }}>
        {/* Loading state */}
        {loading && stories.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  backgroundColor: '#161b22',
                  borderRadius: 8,
                  height: 100,
                  marginBottom: 8,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{
            padding: 20,
            textAlign: 'center',
            color: '#ff3366',
            fontSize: 13,
          }}>
            Failed to load stories.{' '}
            <button
              onClick={refresh}
              style={{
                color: '#00d9ff',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && stories.length === 0 && (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: '#6e7681',
          }}>
            <div style={{
              fontFamily: BROADSHEET_TOKENS.fontHeadline,
              fontSize: 28,
              color: '#859398',
              marginBottom: 12,
            }}>
              No stories yet
            </div>
            <div style={{ fontSize: 13 }}>Check back soon.</div>
          </div>
        )}

        {/* Front Page */}
        {!loading && !error && stories.length > 0 && activeSection === 'frontPage' && (
          <BroadsheetFrontPage
            stories={stories}
            onStoryExpand={handleStoryExpand}
            isDesktop={isDesktop}
            expandedStoryId={expandedStoryId}
          />
        )}

        {/* Reporter Desk Placeholder (Phase 2) */}
        {!loading && !error && stories.length > 0 && activeSection !== 'frontPage' && (
          <ReporterDeskPlaceholder
            reporter={activeSection}
            isDesktop={isDesktop}
          />
        )}
      </main>

      {researchSymbol && (
        <Suspense fallback={null}>
          <AssetResearchModal
            asset={{
              symbol: researchSymbol,
              name: INDEX_REGISTRY[researchSymbol]?.name || findStock(researchSymbol)?.name || researchSymbol,
            }}
            sector={findStock(researchSymbol)?.sector || ''}
            onClose={() => setResearchSymbol(null)}
            showActionButton={false}
            version={2}
          />
        </Suspense>
      )}
    </div>
  );
}

// ── Reporter Desk Placeholder (Phase 2) ──

function ReporterDeskPlaceholder({ reporter, isDesktop }) {
  const color = REPORTER_COLORS[reporter];
  if (!color) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 400,
      padding: 48,
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontHeadline,
        fontSize: isDesktop ? 36 : 24,
        fontWeight: 700,
        color: color.hex,
        marginBottom: 8,
      }}>
        {color.name}
      </div>
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontMono,
        fontSize: 12,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: color.hex,
        opacity: 0.7,
        marginBottom: 24,
      }}>
        {color.beat}
      </div>
      <div style={{
        fontFamily: BROADSHEET_TOKENS.fontBody,
        fontSize: 14,
        color: '#859398',
      }}>
        Section coming soon
      </div>
    </div>
  );
}
