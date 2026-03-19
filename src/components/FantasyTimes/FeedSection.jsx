// src/components/FantasyTimes/FeedSection.jsx
// Collapsible editorial section for the "All Stories" sectioned layout.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StoryCard from './StoryCard';
import StoryThread from './StoryThread';

const SECTION_COLORS = {
  market_overview: '#00D9FF',
  movers_spotlights: '#FF6B6B',
  economics_desk: '#F59E0B',
  earnings_season: '#FFD700',
  sector_watch: '#A78BFA',
};

const DEFAULT_VISIBLE = 3;

const springTransition = { type: 'spring', stiffness: 300, damping: 25 };

export default function FeedSection({
  section,
  onStoryPress,
  activeBattleTickers,
  isMobile,
  isDesktop,
  initialExpanded = true,
}) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [showAll, setShowAll] = useState(false);

  const items = section.clustered || [];
  const totalItems = items.length;
  const visibleItems = showAll ? items : items.slice(0, DEFAULT_VISIBLE);
  const hasMore = totalItems > DEFAULT_VISIBLE;
  const accentColor = SECTION_COLORS[section.id] || '#5eead4';
  const useGrid = isDesktop && section.id === 'movers_spotlights';

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Section header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          borderLeft: `2px solid ${accentColor}`,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{section.icon}</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            color: '#e6edf3',
            flex: 1,
          }}
        >
          {section.name}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 10,
            backgroundColor: 'rgba(94,234,212,0.15)',
            color: '#5eead4',
          }}
        >
          {totalItems}
        </span>
      </button>

      {/* Collapsible story list */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springTransition}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '4px 0',
              ...(useGrid ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } : {}),
            }}>
              {visibleItems.map((item, idx) => (
                <motion.div
                  key={item.type === 'cluster' ? `cluster-${item.ticker}` : `single-${item.story.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springTransition, delay: idx * 0.05 }}
                  style={useGrid && item.type === 'cluster' ? { gridColumn: '1 / -1' } : undefined}
                >
                  {item.type === 'cluster' ? (
                    <div style={{ marginBottom: idx === 0 ? 16 : 8 }}>
                      <StoryThread
                        cluster={item}
                        onStoryPress={onStoryPress}
                        activeBattleTickers={activeBattleTickers}
                        isMobile={isMobile}
                      />
                    </div>
                  ) : (
                    <div style={{ marginBottom: idx === 0 ? 16 : 8 }}>
                      <StoryCard
                        story={item.story}
                        onClick={() => onStoryPress(item.story)}
                        activeBattleTickers={activeBattleTickers}
                        isMobile={isMobile}
                        isHero={idx === 0 && section.id !== 'movers_spotlights'}
                        isMover={section.id === 'movers_spotlights'}
                      />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* "See all" / "Show less" toggle */}
              {hasMore && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAll((prev) => !prev);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 16px',
                    background: 'none',
                    border: 'none',
                    color: '#5eead4',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {showAll ? 'Show less' : `See all ${totalItems} stories`}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
