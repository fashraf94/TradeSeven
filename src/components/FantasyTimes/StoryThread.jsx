// src/components/FantasyTimes/StoryThread.jsx
// Renders a clustered group of stories about the same stock as a timeline thread
// inside a single obsidian card with a vertical spine and glowing dots.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { REPORTER_COLORS, FEED_TOKENS, getReporterGlow } from '../../constants/reporterTheme';
import ReporterAvatar from './ReporterAvatar';
import StoryVisualSafe from './StoryVisualSafe';

const springTransition = { type: 'spring', stiffness: 300, damping: 25 };
const DEFAULT_VISIBLE_NODES = 2;

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

export default function StoryThread({
  cluster,
  onStoryPress,
  activeBattleTickers,
  isMobile,
}) {
  const [expanded, setExpanded] = useState(false);
  const { ticker, lead, thread, reporterCount } = cluster;

  const leadReporter = REPORTER_COLORS[lead.reporter];
  const leadColor = leadReporter?.hex || '#5eead4';
  const leadRgb = leadReporter?.rgb || '94, 234, 212';
  const isMultiReporter = reporterCount > 1;

  // For single-reporter threads, use lead reporter color for spine
  // For multi-reporter, use a neutral teal
  const spineColorHex = isMultiReporter ? '#5eead4' : leadColor;
  const spineColorRgb = isMultiReporter ? '94, 234, 212' : leadRgb;

  const hasVisual = lead.visualType && lead.visualType !== 'none';

  const visibleNodes = expanded ? thread : thread.slice(0, DEFAULT_VISIBLE_NODES);
  const hiddenCount = thread.length - DEFAULT_VISIBLE_NODES;

  return (
    <div style={{
      backgroundColor: FEED_TOKENS.bgCard,
      border: `1px solid ${FEED_TOKENS.bgCardBorder}`,
      borderRadius: FEED_TOKENS.cardRadius,
      boxShadow: FEED_TOKENS.obsidianShadow,
      overflow: 'hidden',
    }}>
      {/* Thread header */}
      <div style={{
        padding: '16px 16px 12px',
        fontSize: 16,
        fontWeight: 700,
        color: '#e2e8f0',
        letterSpacing: 0.3,
      }}>
        {ticker} THREAD
      </div>

      {/* Lead card — compact inline layout */}
      <div
        onClick={() => onStoryPress(lead)}
        style={{
          display: 'flex',
          gap: 12,
          padding: '0 16px 16px',
          cursor: 'pointer',
        }}
      >
        {/* Left: Visual thumbnail or gradient placeholder */}
        <div style={{
          width: 120,
          height: 80,
          borderRadius: FEED_TOKENS.innerRadius,
          overflow: 'hidden',
          flexShrink: 0,
          background: hasVisual ? undefined : `linear-gradient(135deg, rgba(${leadRgb}, 0.15), transparent)`,
        }}>
          {hasVisual && (
            <StoryVisualSafe
              visualType={lead.visualType}
              visualConfig={lead.visualConfig}
              size="micro"
            />
          )}
        </div>

        {/* Right: Headline + reporter */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#e2e8f0',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {lead.headline}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 6,
          }}>
            <ReporterAvatar reporter={lead.reporter} size={18} />
            <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>
              {leadReporter?.name?.split(' ')[0] || lead.reporter}
            </span>
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>
              {timeAgo(lead.publishedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Thread nodes with spine */}
      {thread.length > 0 && (
        <div style={{ position: 'relative' }}>
          {/* Vertical spine line */}
          <div style={{
            position: 'absolute',
            left: 32,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: `rgba(${spineColorRgb}, 0.3)`,
            borderRadius: 1,
          }} />

          <AnimatePresence initial={false}>
            {visibleNodes.map((story, idx) => {
              const storyReporter = REPORTER_COLORS[story.reporter];
              const dotColor = storyReporter?.hex || spineColorHex;
              const dotRgb = storyReporter?.rgb || spineColorRgb;

              return (
                <motion.div
                  key={story.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ ...springTransition, delay: idx * 0.03 }}
                >
                  {/* Divider between nodes */}
                  {idx > 0 && (
                    <div style={{
                      height: 1,
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      margin: '0 16px',
                    }} />
                  )}

                  <div
                    onClick={() => onStoryPress(story)}
                    style={{
                      padding: '12px 16px 12px 48px',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    {/* Glowing dot on spine */}
                    <div style={{
                      position: 'absolute',
                      left: 28,
                      top: 16,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: dotColor,
                      boxShadow: `0 0 6px rgba(${dotRgb}, 0.4)`,
                    }} />

                    {/* Headline */}
                    <div style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#e2e8f0',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {story.headline}
                    </div>

                    {/* Reporter row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 4,
                    }}>
                      <ReporterAvatar reporter={story.reporter} size={18} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>
                        {storyReporter?.name?.split(' ')[0] || story.reporter}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>
                        {timeAgo(story.publishedAt)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Expand/collapse toggle */}
          {hiddenCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 16px 12px 48px',
                background: 'none',
                border: 'none',
                color: spineColorHex,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {expanded ? 'Show less' : `Show ${hiddenCount} more stories about ${ticker}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
