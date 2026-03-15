// src/components/FantasyTimes/StoryCard.jsx
// Story card for the FantasyTimes feed — left border accent, reporter identity, CTA.

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, TrendingUp, Globe, BarChart3, Compass } from 'lucide-react';
import { REPORTER_PROFILES } from '../../prompts/fantasyTimesPrompts';

const ICON_MAP = {
  Zap,
  TrendingUp,
  Globe,
  BarChart3,
  Compass,
};

const SENTIMENT_COLORS = {
  bullish: '#00ff88',
  bearish: '#ff3366',
  neutral: '#8b949e',
  mixed: '#f59e0b',
};

/**
 * Format "time ago" from a publishedAt timestamp.
 */
function timeAgo(publishedAt) {
  if (!publishedAt) return '';
  const ms = publishedAt._seconds
    ? publishedAt._seconds * 1000
    : new Date(publishedAt).getTime();
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Get CTA label based on recommended_action and user state.
 */
function getCTALabel(story, activeBattleTickers = []) {
  const action = story.recommended_action;
  const ticker = story.primaryTicker || (story.tickers && story.tickers[0]);
  const battleSet = new Set((activeBattleTickers || []).map((t) => t.toUpperCase()));

  switch (action) {
    case 'BAGGERBOMB':
      if (ticker && battleSet.has(ticker.toUpperCase())) {
        return `Check Your ${ticker} Battle`;
      }
      return ticker ? `Draft ${ticker} in BaggerBomb` : 'Open BaggerBomb';
    case 'EARNINGSGAME':
      return 'Place Your Parlay';
    case 'WATCHLIST':
      return 'Add to Watchlist';
    case 'RESEARCH':
      return 'Open Research Hub';
    case 'SNAKEDRAFT':
      return 'Join Snake Draft';
    default:
      return 'Read More';
  }
}

export default function StoryCard({ story, onClick, activeBattleTickers = [], isMobile }) {
  const profile = REPORTER_PROFILES[story.reporter] || REPORTER_PROFILES.kai;
  const IconComponent = ICON_MAP[profile.icon] || Zap;
  const sentimentColor = SENTIMENT_COLORS[story.sentiment] || SENTIMENT_COLORS.neutral;

  // Price change from dataSnapshot
  const priceChange = story.dataSnapshot?.percentChange
    || story.dataSnapshot?.avgIndexChange
    || story.dataSnapshot?.spy?.changePercent
    || null;

  const ctaLabel = getCTALabel(story, activeBattleTickers);

  // Check if story ticker is in an active battle
  const storyTickers = (story.tickers || []).map((t) => t.toUpperCase());
  const battleSet = new Set((activeBattleTickers || []).map((t) => t.toUpperCase()));
  const inBattle = storyTickers.some((t) => battleSet.has(t));

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, type: 'spring', bounce: 0.3 }}
      onClick={onClick}
      style={{
        backgroundColor: '#0d1117',
        border: '1px solid #21262d',
        borderLeft: `3px solid ${profile.color}`,
        borderRadius: '8px',
        padding: isMobile ? '12px' : '14px 16px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
      }}
      whileHover={{ backgroundColor: '#161b22' }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Row 1: Reporter identity + time */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '6px',
      }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: `${profile.color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <IconComponent size={13} color={profile.color} />
        </div>
        <span style={{ color: profile.color, fontSize: '12px', fontWeight: 600 }}>
          {profile.name}
        </span>
        <span style={{ color: '#6e7681', fontSize: '11px' }}>·</span>
        <span style={{ color: '#6e7681', fontSize: '11px' }}>{profile.beat}</span>
        <span style={{ color: '#6e7681', fontSize: '11px', marginLeft: 'auto' }}>
          {timeAgo(story.publishedAt)}
        </span>
      </div>

      {/* Row 2: Headline + price change */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        marginBottom: '4px',
      }}>
        <div style={{
          color: '#e6edf3',
          fontSize: '14px',
          fontWeight: 600,
          lineHeight: 1.3,
          flex: 1,
        }}>
          {story.headline}
        </div>
        {priceChange !== null && (
          <span style={{
            color: priceChange >= 0 ? '#00ff88' : '#ff3366',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {priceChange >= 0 ? '+' : ''}{Number(priceChange).toFixed(2)}%
          </span>
        )}
      </div>

      {/* Row 3: Subheadline */}
      <div style={{
        color: '#8b949e',
        fontSize: '13px',
        lineHeight: 1.4,
        marginBottom: '8px',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {story.subheadline}
      </div>

      {/* Row 4: CTA + sentiment + battle badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            // CTA action handled by parent
          }}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: '4px',
            border: `1px solid ${profile.color}44`,
            backgroundColor: `${profile.color}15`,
            color: profile.color,
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
        >
          {ctaLabel}
        </button>
        <span style={{
          fontSize: '10px',
          fontWeight: 600,
          padding: '2px 6px',
          borderRadius: '3px',
          backgroundColor: `${sentimentColor}18`,
          color: sentimentColor,
          textTransform: 'uppercase',
        }}>
          {story.sentiment}
        </span>
        {inBattle && (
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '3px',
            backgroundColor: '#00d9ff18',
            color: '#00d9ff',
            textTransform: 'uppercase',
          }}>
            IN BATTLE
          </span>
        )}
      </div>
    </motion.div>
  );
}
