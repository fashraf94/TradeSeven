import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const GROUP_LABELS = {
  my: 'MY LISTS',
  sector: 'SECTORS',
  crypto: 'CRYPTO',
  performance: 'PERFORMANCE',
};

const GROUP_ORDER = ['my', 'sector', 'crypto', 'performance'];

export default function WatchlistSelector({
  categories,
  activeListId,
  onSelectList,
  customCount = 0,
}) {
  const scrollRef = useRef(null);
  const activeRef = useRef(null);
  const hasMountedRef = useRef(false);

  // Only scroll to active pill on initial mount so the default selection is visible.
  // On subsequent taps, the user's manual scroll position is preserved naturally.
  useEffect(() => {
    if (hasMountedRef.current) return;
    if (activeRef.current && scrollRef.current) {
      hasMountedRef.current = true;
      const container = scrollRef.current;
      const pill = activeRef.current;
      const pillLeft = pill.offsetLeft;
      const pillWidth = pill.offsetWidth;
      const containerWidth = container.offsetWidth;

      if (pillLeft + pillWidth > containerWidth) {
        container.scrollTo({
          left: pillLeft - containerWidth / 2 + pillWidth / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [activeListId]);

  // Group categories
  const grouped = {};
  categories.forEach(cat => {
    if (!grouped[cat.category]) grouped[cat.category] = [];
    grouped[cat.category].push(cat);
  });

  function getCountBadge(cat) {
    if (cat.id === 'custom' && customCount > 0) return ` (${customCount})`;
    return '';
  }

  return (
    <div
      ref={scrollRef}
      style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        paddingBottom: '8px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <style>{`
        .watchlist-selector-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      {GROUP_ORDER.map(groupKey => {
        const items = grouped[groupKey];
        if (!items || items.length === 0) return null;

        return (
          <React.Fragment key={groupKey}>
            {/* Group label */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              paddingRight: '2px',
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: '9px',
                fontWeight: 600,
                color: '#6e7681',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                writingMode: 'horizontal-tb',
              }}>
                {GROUP_LABELS[groupKey]}
              </span>
            </div>

            {/* Pills */}
            {items.map(cat => {
              const isActive = cat.id === activeListId;
              return (
                <motion.button
                  key={cat.id}
                  ref={isActive ? activeRef : null}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSelectList(cat.id)}
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    border: isActive
                      ? '1px solid #9333ea'
                      : '1px solid #21262d',
                    background: isActive
                      ? 'rgba(147, 51, 234, 0.2)'
                      : '#161b22',
                    color: isActive ? '#c084fc' : '#8b949e',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>{cat.icon}</span>
                  <span>{cat.label}{getCountBadge(cat)}</span>
                </motion.button>
              );
            })}

            {/* Separator between groups */}
            {groupKey !== 'performance' && (
              <div style={{
                width: '1px',
                alignSelf: 'stretch',
                background: '#21262d',
                flexShrink: 0,
                margin: '4px 2px',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
