// src/components/FantasyTimes/FantasyTimesFeed.jsx
// Main FantasyTimes feed container — header, reporter filters, tabs, story list.

import React, { useState, useCallback, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, TrendingUp, Globe, BarChart3, Compass, ArrowLeft } from 'lucide-react';
import { REPORTER_PROFILES } from '../../prompts/fantasyTimesPrompts';
import { useFantasyTimes } from '../../hooks/useFantasyTimes';
import { groupStoriesBySections } from '../../services/fantasyTimesClient';
import { findStock } from '../../data/assets';
import StoryCard from './StoryCard';
import FeedSection from './FeedSection';

const AssetResearchModal = lazy(() => import('../draft/AssetResearchModal'));

const ICON_MAP = { Zap, TrendingUp, Globe, BarChart3, Compass };

const REPORTERS = [
  { key: 'all', label: 'All', color: '#00d9ff', icon: null },
  { key: 'kai', label: 'Kai', ...REPORTER_PROFILES.kai },
  { key: 'alex', label: 'Alex', ...REPORTER_PROFILES.alex },
  { key: 'neta', label: 'Neta', ...REPORTER_PROFILES.neta },
  { key: 'doug', label: 'Doug', ...REPORTER_PROFILES.doug },
  { key: 'kim', label: 'Kim', ...REPORTER_PROFILES.kim },
];

const PAGE_SIZE = 10;

const SENTIMENT_FILTERS = [
  { key: 'all', label: 'All', color: '#8b949e' },
  { key: 'bullish', label: 'Bullish', color: '#10b981' },
  { key: 'bearish', label: 'Bearish', color: '#ef4444' },
  { key: 'neutral', label: 'Neutral', color: '#6e7681' },
];

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
  return minutesSinceMidnight >= 570 && minutesSinceMidnight < 960; // 9:30=570, 16:00=960
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
  const [reporterFilter, setReporterFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'foryou'
  const [researchSymbol, setResearchSymbol] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  const userContext = {
    watchlist: userWatchlist,
    activeBattleTickers,
    sectorPreferences: [],
  };

  const { stories, rankedStories, loading, error, refresh, unreadCount } = useFantasyTimes(userContext);

  // Apply reporter filter to raw stories (shared by both tabs)
  const reporterFiltered = reporterFilter === 'all'
    ? stories
    : stories.filter((s) => s.reporter === reporterFilter);

  // Apply sentiment filter (for All Stories tab)
  const applySentimentFilter = (list) => {
    if (sentimentFilter === 'all') return list;
    return list.filter((s) => {
      if (sentimentFilter === 'neutral') return s.sentiment === 'neutral' || s.sentiment === 'mixed';
      return s.sentiment === sentimentFilter;
    });
  };

  // Sentiment counts (after reporter filter, for badge display)
  const sentimentCounts = useMemo(() => {
    const counts = { all: reporterFiltered.length, bullish: 0, bearish: 0, neutral: 0 };
    for (const s of reporterFiltered) {
      if (s.sentiment === 'bullish') counts.bullish++;
      else if (s.sentiment === 'bearish') counts.bearish++;
      else counts.neutral++; // neutral + mixed
    }
    return counts;
  }, [reporterFiltered]);

  // Reporter counts (after sentiment filter, before reporter filter — for badge display)
  const reporterCounts = useMemo(() => {
    const base = sentimentFilter === 'all'
      ? stories
      : stories.filter((s) => {
          if (sentimentFilter === 'neutral') return s.sentiment === 'neutral' || s.sentiment === 'mixed';
          return s.sentiment === sentimentFilter;
        });
    const counts = { all: base.length };
    for (const r of REPORTERS) {
      if (r.key !== 'all') counts[r.key] = 0;
    }
    for (const s of base) {
      if (counts[s.reporter] !== undefined) counts[s.reporter]++;
    }
    return counts;
  }, [stories, sentimentFilter]);

  // All Stories tab: reporter + sentiment filtered, then sectioned
  const allStoriesFiltered = applySentimentFilter(reporterFiltered);
  const sections = useMemo(() => groupStoriesBySections(allStoriesFiltered), [allStoriesFiltered]);

  // For You tab: reporter filtered ranked stories, flat list with infinite scroll
  const forYouBase = reporterFilter === 'all'
    ? rankedStories
    : rankedStories.filter((s) => s.reporter === reporterFilter);
  const forYouVisible = forYouBase.slice(0, visibleCount);
  const forYouHasMore = visibleCount < forYouBase.length;

  // For empty state check
  const filteredStories = activeTab === 'foryou' ? forYouBase : allStoriesFiltered;

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [reporterFilter, sentimentFilter, activeTab]);

  // Infinite scroll via IntersectionObserver (For You tab only)
  useEffect(() => {
    if (activeTab !== 'foryou' || !sentinelRef.current || !forYouHasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [activeTab, forYouHasMore, forYouBase.length]);

  const handleStoryClick = useCallback((story) => {
    if (onStorySelect) onStorySelect(story);
  }, [onStorySelect]);

  const handleOpenResearch = useCallback((symbol) => {
    setResearchSymbol(symbol);
  }, []);

  const marketOpen = isMarketOpen();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0e14',
      color: '#e6edf3',
      maxWidth: isDesktop ? '960px' : '100%',
      margin: isDesktop ? '0 auto' : 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        {onNavigate && (
          <button
            onClick={() => onNavigate('dashboard')}
            style={{
              background: 'none',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
            }}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 style={{
          color: '#00d9ff',
          fontSize: '18px',
          fontWeight: 700,
          margin: 0,
          flex: 1,
        }}>
          FantasyTimes
        </h1>
        {marketOpen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#00ff88',
              }}
            />
            <span style={{ color: '#00ff88', fontSize: '11px', fontWeight: 600 }}>LIVE</span>
          </div>
        )}
      </div>

      {/* Reporter filter pills */}
      <div style={{
        padding: '10px 16px',
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
      }}>
        {REPORTERS.map((r) => {
          const isActive = reporterFilter === r.key;
          const IconComp = r.icon ? ICON_MAP[r.icon] : null;
          const count = reporterCounts[r.key] || 0;
          const dimmed = count === 0 && r.key !== 'all';
          return (
            <button
              key={r.key}
              onClick={() => setReporterFilter(r.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '16px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                backgroundColor: isActive ? r.color : '#161b22',
                color: isActive ? '#0a0e14' : '#8b949e',
                opacity: dimmed ? 0.4 : 1,
              }}
            >
              {IconComp && <IconComp size={12} />}
              {r.label}
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '0 4px',
                borderRadius: '6px',
                backgroundColor: isActive ? 'rgba(10,14,20,0.2)' : `${r.color}25`,
                color: isActive ? '#0a0e14' : r.color,
                minWidth: '16px',
                textAlign: 'center',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sentiment filter pills */}
      <div style={{
        padding: '4px 16px 8px',
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
      }}>
        {SENTIMENT_FILTERS.map((sf) => {
          const isActive = sentimentFilter === sf.key;
          const count = sentimentCounts[sf.key] || 0;
          return (
            <button
              key={sf.key}
              onClick={() => setSentimentFilter(sf.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '12px',
                border: isActive ? `1px solid ${sf.color}` : '1px solid #21262d',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                backgroundColor: isActive ? `${sf.color}18` : 'transparent',
                color: isActive ? sf.color : '#6e7681',
              }}
            >
              {isActive && sf.key !== 'all' && (
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: sf.color,
                  flexShrink: 0,
                }} />
              )}
              {sf.label}
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '0 4px',
                borderRadius: '6px',
                backgroundColor: isActive ? `${sf.color}25` : 'rgba(255,255,255,0.04)',
                color: isActive ? sf.color : '#484f58',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab bar: All Stories | For You */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #21262d',
        padding: '0 16px',
      }}>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'all' ? '2px solid #00d9ff' : '2px solid transparent',
            color: activeTab === 'all' ? '#e6edf3' : '#6e7681',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          All Stories
        </button>
        <button
          onClick={() => setActiveTab('foryou')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'foryou' ? '2px solid #00d9ff' : '2px solid transparent',
            color: activeTab === 'foryou' ? '#e6edf3' : '#6e7681',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          For You
          {unreadCount > 0 && (
            <span style={{
              marginLeft: '6px',
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: '8px',
              backgroundColor: '#00d9ff',
              color: '#0a0e14',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Story list */}
      <div style={{ padding: isDesktop ? '24px' : '8px 12px' }}>
        {loading && stories.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  backgroundColor: '#161b22',
                  borderRadius: '8px',
                  height: '100px',
                  marginBottom: '8px',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
          </div>
        )}

        {error && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#ff3366',
            fontSize: '13px',
          }}>
            Failed to load stories. <button onClick={refresh} style={{ color: '#00d9ff', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
          </div>
        )}

        {!loading && !error && filteredStories.length === 0 && (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: '#6e7681',
          }}>
            {stories.length === 0 ? (
              <>
                <div style={{ fontSize: 28, marginBottom: 12 }}>📰</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#8b949e', marginBottom: 6 }}>No stories yet</div>
                <div style={{ fontSize: 13 }}>Check back soon.</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#8b949e', marginBottom: 6 }}>No stories match your filters</div>
                <div style={{ fontSize: 13 }}>
                  {(() => {
                    const parts = [];
                    if (reporterFilter !== 'all') parts.push(REPORTERS.find((r) => r.key === reporterFilter)?.label || reporterFilter);
                    if (sentimentFilter !== 'all') parts.push(sentimentFilter);
                    return parts.length > 0
                      ? `No ${parts.join(' + ')} stories right now. Try adjusting your filters.`
                      : 'Try adjusting your reporter or sentiment filters.';
                  })()}
                </div>
              </>
            )}
          </div>
        )}

        {/* All Stories: sectioned layout */}
        {activeTab === 'all' && sections.map((section, idx) => (
          <FeedSection
            key={section.id}
            section={section}
            onStoryPress={handleStoryClick}
            activeBattleTickers={activeBattleTickers}
            isMobile={isMobile}
            isDesktop={isDesktop}
            initialExpanded={idx < 2}
          />
        ))}

        {/* For You: flat ranked list with infinite scroll */}
        {activeTab === 'foryou' && (
          <>
            <AnimatePresence>
              {forYouVisible.map((story) => (
                <div key={story.id} style={{ marginBottom: 12 }}>
                  <StoryCard
                    story={story}
                    onClick={() => handleStoryClick(story)}
                    activeBattleTickers={activeBattleTickers}
                    isMobile={isMobile}
                  />
                </div>
              ))}
            </AnimatePresence>
            {forYouHasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
          </>
        )}
      </div>

      {researchSymbol && (
        <Suspense fallback={null}>
          <AssetResearchModal
            asset={{
              symbol: researchSymbol,
              name: findStock(researchSymbol)?.name || researchSymbol,
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
