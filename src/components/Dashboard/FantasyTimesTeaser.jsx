// /src/components/Dashboard/FantasyTimesTeaser.jsx
// Horizontal scroll of mini story cards for The Loop mobile feed
// Uses useFantasyTimes hook directly

import React from 'react';
import { Newspaper, ChevronRight } from 'lucide-react';
import { useFantasyTimes } from '../../hooks/useFantasyTimes';
import { isMarketOpen } from '../../utils/marketSchedule';
import { REPORTER_PROFILES } from '../../prompts/fantasyTimesPrompts';

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
  if (!reporter) return '#8b949e';
  const key = reporter.toLowerCase();
  return REPORTER_PROFILES[key]?.color || '#8b949e';
}

export default function FantasyTimesTeaser({ setScreen, colors }) {
  const { rankedStories, loading } = useFantasyTimes();
  const marketOpen = isMarketOpen();

  if (loading) {
    return (
      <div style={{ padding: '0 4px' }}>
        <div style={{
          height: '120px',
          borderRadius: '12px',
          background: 'rgba(22, 27, 34, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8b949e',
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
          <Newspaper size={16} color="#f59e0b" />
          <span style={{
            fontSize: '13px',
            fontWeight: '700',
            color: '#e6edf3',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
          }}>
            Fantasy Times
          </span>
          <span style={{
            padding: '2px 8px',
            borderRadius: '8px',
            fontSize: '10px',
            fontWeight: '600',
            background: marketOpen ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: marketOpen ? '#22c55e' : '#ef4444',
          }}>
            {marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
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
            color: '#f59e0b',
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
        {stories.map((story, i) => (
          <div
            key={story.id || i}
            onClick={() => setScreen('fantasytimes')}
            style={{
              minWidth: '200px',
              maxWidth: '200px',
              padding: '12px',
              background: 'rgba(22, 27, 34, 0.8)',
              borderRadius: '12px',
              border: '1px solid rgba(48, 54, 61, 0.6)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {/* Reporter color bar */}
            <div style={{
              width: '32px',
              height: '3px',
              borderRadius: '2px',
              background: getReporterColor(story.reporter),
            }} />

            {/* Headline */}
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#e6edf3',
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
                color: getReporterColor(story.reporter),
              }}>
                {story.reporter || 'Staff'}
              </span>
              <span style={{
                fontSize: '10px',
                color: '#6e7681',
              }}>
                {timeAgo(story.publishedAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
