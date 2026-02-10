import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';
import useDrawerSnap from './useDrawerSnap';

const TAB_CONFIGS = [
  { key: 'fundamental', label: 'Analysis', activeColor: '#00d9ff' },
  { key: 'earnings', label: 'Earnings', activeColor: '#8b5cf6' },
  { key: 'technical', label: 'Technical', activeColor: '#00d9ff' },
  { key: 'baggerbomb', label: '\uD83D\uDCA3 Bomb', activeColor: '#00ff88' },
  { key: 'news', label: 'News', activeColor: '#00d9ff' },
];

/**
 * AnalysisDrawer — Bottom pull-up drawer for the AI Analysis tabs.
 * Three states: collapsed (80px), mid (50%), full (90%).
 *
 * @param {Object} props
 * @param {number} containerHeight - Parent container height
 * @param {string} activeTab - Current active tab key
 * @param {function} setActiveTab - Tab setter
 * @param {function} onSnapStateChange - Callback when snap state changes
 * @param {Object} summaryData - { sentiment, dailyChange, volumeRatio } for collapsed view
 * @param {React.ReactNode} children - Tab content to render
 */
const AnalysisDrawer = ({
  containerHeight,
  activeTab,
  setActiveTab,
  onSnapStateChange,
  summaryData,
  children,
}) => {
  const {
    y,
    snapState,
    snapTo,
    onDragStart,
    onDragEnd,
    cycleState,
    dragConstraints,
  } = useDrawerSnap(containerHeight);

  const contentRef = useRef(null);
  const [contentScrollable, setContentScrollable] = useState(false);

  // Notify parent of snap state changes
  useEffect(() => {
    onSnapStateChange?.(snapState);
  }, [snapState, onSnapStateChange]);

  // Enable content scrolling only when drawer is at 'full'
  useEffect(() => {
    setContentScrollable(snapState === 'full');
  }, [snapState]);

  const sentiment = summaryData?.sentiment;
  const dailyChange = summaryData?.dailyChange ?? 0;
  const volumeRatio = summaryData?.volumeRatio ?? 1.0;

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: containerHeight * 0.9, // Max possible height
        y,
        background: HOLO_COLORS.bgCard,
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px',
        borderTop: '1px solid rgba(0, 217, 255, 0.15)',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        willChange: 'transform',
        touchAction: 'none',
      }}
    >
      {/* Drag handle area — always triggers drawer drag */}
      <motion.div
        drag="y"
        dragConstraints={dragConstraints}
        dragElastic={0.1}
        dragMomentum={false}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{
          cursor: 'grab',
          touchAction: 'none',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        {/* Grab handle pill */}
        <div
          onClick={cycleState}
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '10px 0 6px',
          }}
        >
          <div style={{
            width: '36px',
            height: '4px',
            borderRadius: '2px',
            background: 'rgba(255, 255, 255, 0.3)',
          }} />
        </div>

        {/* Quick summary strip — visible in collapsed state */}
        <div
          onClick={() => { if (snapState === 'collapsed') snapTo('mid'); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px 8px',
          }}
        >
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.5px',
            color: HOLO_COLORS.textSecondary,
            textTransform: 'uppercase',
          }}>
            AI Analysis
          </span>

          {/* Summary badges */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {/* Sentiment badge */}
            {sentiment && (
              <span style={{
                padding: '2px 6px',
                borderRadius: '8px',
                fontSize: '10px',
                fontWeight: '600',
                background: sentiment === 'bullish'
                  ? 'rgba(0, 255, 136, 0.15)' : sentiment === 'bearish'
                  ? 'rgba(255, 71, 87, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                color: sentiment === 'bullish'
                  ? '#00ff88' : sentiment === 'bearish'
                  ? '#ff4757' : HOLO_COLORS.textSecondary,
              }}>
                {sentiment === 'bullish' ? '\u2191 Bullish' : sentiment === 'bearish' ? '\u2193 Bearish' : '\u2192 Neutral'}
              </span>
            )}

            {/* Daily change badge */}
            <span style={{
              padding: '2px 6px',
              borderRadius: '8px',
              fontSize: '10px',
              fontWeight: '600',
              background: dailyChange >= 0 ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 71, 87, 0.15)',
              color: dailyChange >= 0 ? '#00ff88' : '#ff4757',
            }}>
              {dailyChange >= 0 ? '+' : ''}{dailyChange?.toFixed(2)}%
            </span>

            {/* Volume ratio badge */}
            <span style={{
              padding: '2px 6px',
              borderRadius: '8px',
              fontSize: '10px',
              fontWeight: '600',
              background: volumeRatio > 1.3 ? 'rgba(0, 217, 255, 0.15)' : 'rgba(255, 255, 255, 0.1)',
              color: volumeRatio > 1.3 ? '#00d9ff' : HOLO_COLORS.textSecondary,
            }}>
              {volumeRatio?.toFixed(1)}x vol
            </span>
          </div>
        </div>
      </motion.div>

      {/* Tab bar */}
      <div
        className="drawer-tabs-scroll"
        style={{
          display: 'flex',
          gap: '6px',
          padding: '0 12px 8px',
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          flexShrink: 0,
        }}
      >
        <style>{`.drawer-tabs-scroll::-webkit-scrollbar { display: none; }`}</style>
        {TAB_CONFIGS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: activeTab === tab.key
                ? `1px solid ${tab.activeColor}`
                : '1px solid rgba(255, 255, 255, 0.1)',
              background: activeTab === tab.key
                ? `${tab.activeColor}20`
                : 'rgba(255, 255, 255, 0.05)',
              color: activeTab === tab.key
                ? tab.activeColor
                : 'rgba(255, 255, 255, 0.6)',
              fontWeight: '600',
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content area */}
      <div
        ref={contentRef}
        style={{
          flex: 1,
          overflowY: contentScrollable ? 'auto' : 'hidden',
          overscrollBehavior: 'contain',
          padding: '0 12px 12px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>
    </motion.div>
  );
};

export default AnalysisDrawer;
