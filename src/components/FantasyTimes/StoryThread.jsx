// src/components/FantasyTimes/StoryThread.jsx
// Renders a clustered group of stories about the same stock.
// Lead story is a full StoryCard; thread items are compressed rows with a spine line.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { REPORTER_PROFILES } from '../../prompts/fantasyTimesPrompts';
import StoryCard from './StoryCard';

const springTransition = { type: 'spring', stiffness: 300, damping: 25 };

/**
 * Format "time ago" from a publishedAt timestamp (duplicated from StoryCard
 * to keep StoryThread self-contained without exporting from StoryCard).
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

  const leadProfile = REPORTER_PROFILES[lead.reporter] || REPORTER_PROFILES.kai;
  const spineColor = `${leadProfile.color}4D`; // 30% opacity hex

  const visibleThread = expanded ? thread : thread.slice(0, 1);
  const hiddenCount = thread.length - 1;

  const indicatorText =
    reporterCount > 1
      ? `${reporterCount} reporters covering ${ticker}`
      : `${thread.length} more about ${ticker}`;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Lead story — full card */}
      <StoryCard
        story={lead}
        onClick={() => onStoryPress(lead)}
        activeBattleTickers={activeBattleTickers}
        isMobile={isMobile}
      />

      {/* Thread indicator */}
      <div
        style={{
          fontSize: 12,
          color: '#8b949e',
          padding: '6px 16px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <div
          style={{
            width: 12,
            height: 2,
            backgroundColor: spineColor,
            borderRadius: 1,
          }}
        />
        {indicatorText}
      </div>

      {/* Thread items with spine line */}
      <div style={{ position: 'relative', paddingLeft: 0 }}>
        {/* Vertical spine */}
        <div
          style={{
            position: 'absolute',
            left: 20,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: spineColor,
            borderRadius: 1,
          }}
        />

        <AnimatePresence initial={false}>
          {visibleThread.map((story, idx) => {
            const profile = REPORTER_PROFILES[story.reporter] || REPORTER_PROFILES.kai;
            const initial = (profile.name || story.reporter || '?')[0].toUpperCase();

            return (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 40 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ ...springTransition, delay: idx * 0.03 }}
                onClick={() => onStoryPress(story)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 40,
                  padding: '4px 16px 4px 36px',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {/* Reporter avatar */}
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: profile.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#0a0e14',
                    flexShrink: 0,
                  }}
                >
                  {initial}
                </div>

                {/* Headline */}
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: '#e6edf3',
                    marginLeft: 8,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {story.headline}
                </span>

                {/* Timestamp */}
                <span
                  style={{
                    fontSize: 11,
                    color: '#6e7681',
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  {timeAgo(story.publishedAt)}
                </span>
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
              padding: '6px 16px 6px 36px',
              background: 'none',
              border: 'none',
              color: '#5eead4',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {expanded ? 'Show less' : `Show ${hiddenCount} more`}
          </button>
        )}
      </div>
    </div>
  );
}
