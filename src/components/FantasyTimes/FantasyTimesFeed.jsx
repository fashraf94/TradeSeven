// src/components/FantasyTimes/FantasyTimesFeed.jsx
// Main FantasyTimes feed container — header, reporter filters, tabs, story list.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, TrendingUp, Globe, BarChart3, Compass, ArrowLeft } from 'lucide-react';
import { REPORTER_PROFILES } from '../../prompts/fantasyTimesPrompts';
import { useFantasyTimes } from '../../hooks/useFantasyTimes';
import StoryCard from './StoryCard';
import StoryDetail from './StoryDetail';

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
}) {
  const [reporterFilter, setReporterFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'foryou'
  const [selectedStory, setSelectedStory] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  const userContext = {
    watchlist: userWatchlist,
    activeBattleTickers,
    sectorPreferences: [],
  };

  const { stories, rankedStories, loading, error, refresh, unreadCount } = useFantasyTimes(userContext);

  // Choose story list based on tab
  const baseStories = activeTab === 'foryou' ? rankedStories : stories;

  // Apply reporter filter
  const filteredStories = reporterFilter === 'all'
    ? baseStories
    : baseStories.filter((s) => s.reporter === reporterFilter);

  const visibleStories = filteredStories.slice(0, visibleCount);
  const hasMore = visibleCount < filteredStories.length;

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [reporterFilter, activeTab]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
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
  }, [hasMore, filteredStories.length]);

  const handleStoryClick = useCallback((story) => {
    setSelectedStory(story);
  }, []);

  const marketOpen = isMarketOpen();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0e14',
      color: '#e6edf3',
      maxWidth: isDesktop ? '680px' : '100%',
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
              }}
            >
              {IconComp && <IconComp size={12} />}
              {r.label}
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
      <div style={{ padding: '8px 12px' }}>
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
            padding: '40px 16px',
            textAlign: 'center',
            color: '#6e7681',
            fontSize: '13px',
          }}>
            {reporterFilter === 'all'
              ? 'No stories yet. Check back soon.'
              : `No stories from ${REPORTERS.find((r) => r.key === reporterFilter)?.label || 'this reporter'} right now.`}
          </div>
        )}

        <AnimatePresence>
          {visibleStories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              onClick={() => handleStoryClick(story)}
              activeBattleTickers={activeBattleTickers}
              isMobile={isMobile}
            />
          ))}
        </AnimatePresence>

        {/* Infinite scroll sentinel */}
        {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
      </div>

      {/* Story detail modal/sheet */}
      <StoryDetail
        story={selectedStory}
        isOpen={!!selectedStory}
        onClose={() => setSelectedStory(null)}
        isMobile={isMobile}
      />
    </div>
  );
}
