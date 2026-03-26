// /src/components/Dashboard/FantasyTimesTeaser.jsx
// Horizontal scroll of mini story cards for The Loop mobile feed
// Uses useFantasyTimes hook directly

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useFantasyTimes } from '../../hooks/useFantasyTimes';
import { isMarketOpen } from '../../utils/marketSchedule';
import { REPORTER_COLORS } from '../../constants/reporterTheme';
import { useTheme } from '../../contexts/ThemeContext';
import TapGlint from '../shared/TapGlint';

const BEAT_ICONS = { kai: '⚡', alex: '📊', neta: '🌐', doug: '📈', kim: '🧭' };

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

export default function FantasyTimesTeaser({ setScreen, onStoryPress }) {
  const { tokens } = useTheme();

  function getReporterColor(reporter) {
    if (!reporter) return tokens.textFaint;
    const key = reporter.toLowerCase();
    return REPORTER_COLORS[key]?.hex || tokens.textFaint;
  }
  function getReporterRgb(reporter) {
    if (!reporter) return '100,116,139';
    const key = reporter.toLowerCase();
    return REPORTER_COLORS[key]?.rgb || '100,116,139';
  }
  const { rankedStories, loading } = useFantasyTimes();
  const marketOpen = isMarketOpen();
  const [tapCounts, setTapCounts] = useState({});

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
      {/* Section header — "See all" always navigates to feed, NOT to a specific story */}
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
          scrollSnapType: 'x mandatory',
        }}
      >
        {stories.map((story, i) => {
          const reporterColor = getReporterColor(story.reporter);
          const reporterRgb = getReporterRgb(story.reporter);
          const reporterKey = (story.reporter || '').toLowerCase();
          const cardKey = story.id || i;
          const hasTicker = !!story.primaryTicker;
          const pctChange = story.dataSnapshot?.percentChange;
          const pctPositive = pctChange != null && pctChange >= 0;
          const pctColor = pctPositive ? '#10b981' : '#ef4444';
          return (
            <motion.div
              key={cardKey}
              onClick={() => {
                setTapCounts(prev => ({ ...prev, [cardKey]: (prev[cardKey] || 0) + 1 }));
                if (onStoryPress) {
                  onStoryPress(story);
                } else {
                  setScreen('fantasytimes');
                }
              }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              style={{
                position: 'relative',
                overflow: 'hidden',
                minWidth: '240px',
                maxWidth: '240px',
                background: tokens.bgCard,
                borderRadius: '12px',
                border: `1px solid ${tokens.borderDefault}`,
                borderLeft: `3px solid ${reporterColor}`,
                boxShadow: tokens.obsidianShadow,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                scrollSnapAlign: 'start',
              }}
            >
              <TapGlint triggerKey={tapCounts[cardKey] || 0} />

              {/* Ticker hero visual */}
              <div style={{
                height: 80,
                borderRadius: '12px 12px 0 0',
                background: hasTicker
                  ? `linear-gradient(135deg, rgba(${reporterRgb}, 0.15) 0%, rgba(0,0,0,0.4) 100%)`
                  : `linear-gradient(135deg, rgba(${reporterRgb}, 0.1) 0%, rgba(${reporterRgb}, 0.05) 50%, rgba(0,0,0,0.3) 100%)`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}>
                {hasTicker ? (
                  <>
                    <span style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: '#ffffff',
                      letterSpacing: '0.02em',
                    }}>
                      {story.primaryTicker}
                    </span>
                    {pctChange != null && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: pctColor,
                        background: pctPositive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        padding: '1px 8px',
                        borderRadius: 8,
                      }}>
                        {pctPositive ? '+' : ''}{pctChange.toFixed(1)}%
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 28 }}>
                      {BEAT_ICONS[reporterKey] || '📰'}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: reporterColor,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                    }}>
                      {REPORTER_COLORS[reporterKey]?.beat || 'News'}
                    </span>
                  </>
                )}
              </div>

              {/* Headline */}
              <div style={{
                padding: '10px 12px 0',
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
                padding: '8px 12px 10px',
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
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
