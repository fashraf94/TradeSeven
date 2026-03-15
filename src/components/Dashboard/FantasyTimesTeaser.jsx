// /src/components/Dashboard/FantasyTimesTeaser.jsx
// Horizontal scroll of mini story cards for The Loop mobile feed
// Uses useFantasyTimes hook directly

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useFantasyTimes } from '../../hooks/useFantasyTimes';
import { isMarketOpen } from '../../utils/marketSchedule';
import { REPORTER_PROFILES } from '../../prompts/fantasyTimesPrompts';
import { useTheme } from '../../contexts/ThemeContext';

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getReporterColor(reporter) {
  if (!reporter) return '#64748b';
  const key = reporter.toLowerCase();
  return REPORTER_PROFILES[key]?.color || '#64748b';
}

export default function FantasyTimesTeaser({ setScreen }) {
  const { tokens } = useTheme();
  const { rankedStories, loading } = useFantasyTimes();
  const marketOpen = isMarketOpen();

  if (loading) {
    return (
      <div style={{ padding: '0 4px' }}>
        <div style={{
          height: '120px',
          borderRadius: '12px',
          background: tokens.bgCard,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: tokens.textMuted,
          fontSize: '13px',
        }}>
          Loading stories...
        </div>
      </div>
    );
  }

  const stories = (rankedStories || []).slice(0, 5);
  if (stories.length === 0) return null;

  return (
    <div>
      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        padding: '0 4px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            color: tokens.textFaint,
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
          }}>
            Fantasy Times
          </span>
          <span style={{
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '600',
            background: tokens.bgIcon,
            color: tokens.textMuted,
          }}>
            {marketOpen ? 'OPEN' : 'CLOSED'}
          </span>
        </div>
        <button
          onClick={() => setScreen('fantasytimes')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            background: 'none',
            border: 'none',
            color: tokens.teal,
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          See all
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Horizontal scroll */}
      <style>{`.ft-teaser-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div
        className="ft-teaser-scroll"
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: '10px',
          padding: '0 4px 4px 4px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {stories.map((story, i) => {
          const reporterColor = getReporterColor(story.reporter);
          return (
            <div
              key={story.id || i}
              onClick={() => setScreen('fantasytimes')}
              style={{
                minWidth: '240px',
                maxWidth: '240px',
                padding: '12px',
                background: tokens.bgCard,
                borderRadius: '12px',
                border: `1px solid ${tokens.borderDefault}`,
                borderLeft: `3px solid ${reporterColor}`,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* Headline */}
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                color: tokens.textPrimary,
                lineHeight: '1.35',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {story.headline}
              </div>

              {/* Meta row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 'auto',
              }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  color: tokens.textFaint,
                }}>
                  {story.reporter || 'Staff'}
                </span>
                <span style={{
                  fontSize: '10px',
                  color: tokens.textFaint,
                }}>
                  {timeAgo(story.publishedAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
