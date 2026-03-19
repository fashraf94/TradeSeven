// src/components/FantasyTimes/FeedSection.jsx
// Collapsible editorial section for the "All Stories" sectioned layout.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Zap, BarChart2, DollarSign, Grid3X3, ChevronDown } from 'lucide-react';
import { REPORTER_COLORS } from '../../constants/reporterTheme';
import StoryCard from './StoryCard';
import StoryThread from './StoryThread';

const SECTION_META = {
  market_overview:   { Icon: TrendingUp, reporter: 'kai' },
  movers_spotlights: { Icon: Zap,        reporter: 'alex' },
  economics_desk:    { Icon: BarChart2,   reporter: 'neta' },
  earnings_season:   { Icon: DollarSign,  reporter: 'doug' },
  sector_watch:      { Icon: Grid3X3,     reporter: 'kim' },
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
  const meta = SECTION_META[section.id] || {};
  const reporter = REPORTER_COLORS[meta.reporter];
  const reporterColor = reporter?.hex || '#5eead4';
  const SectionIcon = meta.Icon;
  const useGrid = isDesktop && section.id === 'movers_spotlights';

  return (
    <div style={{ marginTop: 20, marginBottom: 8 }}>
      {/* Section header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          padding: 0,
        }}
      >
        {isDesktop ? (
          /* Desktop: centered text breaking a horizontal rule */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 16 }}>
              <div style={{ flex: 1, height: 1, backgroundColor: '#1C1A27' }} />
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  fontSize: 14,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: '#94a3b8',
                  whiteSpace: 'nowrap',
                }}>
                  {section.name}
                </span>
                <motion.div
                  animate={{ rotate: expanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={14} color="#64748b" />
                </motion.div>
              </div>
              <div style={{ flex: 1, height: 1, backgroundColor: '#1C1A27' }} />
            </div>
            <span style={{
              fontSize: 12,
              fontWeight: 400,
              color: '#64748b',
              marginTop: 4,
            }}>
              by{' '}
              <span style={{ fontWeight: 500, color: reporterColor }}>
                {reporter?.name?.split(' ')[0] || meta.reporter}
              </span>
            </span>
          </div>
        ) : (
          /* Mobile: icon + title + reporter attribution + count badge */
          <div style={{ padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {SectionIcon && (
                <SectionIcon size={20} color={reporterColor} style={{ flexShrink: 0 }} />
              )}
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: '#e2e8f0',
                flex: 1,
              }}>
                {section.name}
              </span>
              <motion.div
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ flexShrink: 0 }}
              >
                <ChevronDown size={14} color="#64748b" />
              </motion.div>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 10,
                backgroundColor: 'rgba(94,234,212,0.15)',
                color: '#5eead4',
                flexShrink: 0,
              }}>
                {totalItems}
              </span>
            </div>
            <div style={{ marginTop: 2, paddingLeft: 28 }}>
              <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>
                by the AI-reporter{' '}
                <span style={{ fontWeight: 500, color: reporterColor }}>
                  {reporter?.name?.split(' ')[0] || meta.reporter}
                </span>
              </span>
            </div>
          </div>
        )}
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
              padding: '12px 0 0',
              ...(useGrid
                ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }
                : section.id === 'movers_spotlights'
                  ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }
                  : {}),
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
                    <div style={{ marginBottom: useGrid ? 0 : 12 }}>
                      <StoryThread
                        cluster={item}
                        onStoryPress={onStoryPress}
                        activeBattleTickers={activeBattleTickers}
                        isMobile={isMobile}
                      />
                    </div>
                  ) : (
                    <div style={{ marginBottom: useGrid ? 0 : 12 }}>
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
                    marginTop: 4,
                    background: 'none',
                    border: 'none',
                    color: reporterColor,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'center',
                    ...(useGrid || section.id === 'movers_spotlights' ? { gridColumn: '1 / -1' } : {}),
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
