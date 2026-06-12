// AgentPortfolioStrip - Horizontal scrollable row of stock pills with tier badges
// Tiered mode: 7 pills — 2 Star (2x, gold), 2 Core (1.5x, teal), 3 Support (1x, muted).
// P4 flat6 (tournament): 6 pills — assets carry a per-asset tierMultiplier (1x),
// rendered with the honest flat label + neutral chrome (companion c).

import React, { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TIER_CONFIG = {
  star: { prefix: '\u2B50', label: '2x', borderColor: '#ffd700', bgTint: 'rgba(255,215,0,0.08)' },
  core: { prefix: '\u25C6', label: '1.5x', borderColor: '#5eead4', bgTint: 'rgba(94,234,212,0.08)' },
  support: { prefix: '\u25AB', label: '1x', borderColor: 'rgba(255,255,255,0.15)', bgTint: 'rgba(255,255,255,0.03)' },
};

function PillItem({ asset, tier, slotIndex, isFiltered, isDimmed, tokens, onTap, isDesktop }) {
  // P4 flat6: tournament assets carry a flat per-asset tierMultiplier — render
  // the honest flat label and neutral chrome instead of tier visuals. Tiered
  // assets never carry the field, so their rendering is unchanged.
  const isFlat = asset?.tierMultiplier != null;
  const config = isFlat
    ? { ...TIER_CONFIG.support, label: `${asset.tierMultiplier}x` }
    : TIER_CONFIG[tier];
  const longPressTimer = useRef(null);

  const handlePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      // Long-press stub — sparkline popover placeholder for Phase 2
      longPressTimer.current = null;
    }, 500);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      onTap(asset.symbol);
    }
  }, [asset.symbol, onTap]);

  return (
    <motion.div
      layoutId={`portfolio-${tier}-${slotIndex}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
      }}
      style={{
        minWidth: isDesktop ? 96 : 80,
        height: isDesktop ? 68 : 60,
        borderRadius: 12,
        border: `2px solid ${isFiltered ? '#5eead4' : config.borderColor}`,
        background: config.bgTint,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        cursor: 'pointer',
        opacity: isDimmed ? 0.6 : 1,
        boxShadow: isFiltered ? '0 0 8px rgba(94,234,212,0.4)' : 'none',
        transition: 'opacity 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        flexShrink: 0,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
      }}>
        <span style={{ fontSize: 10 }}>{config.prefix}</span>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: tokens.textWhite || '#ffffff',
          letterSpacing: '-0.02em',
        }}>
          {asset.symbol}
        </span>
      </div>
      <span style={{
        fontSize: 9,
        fontWeight: 600,
        color: config.borderColor,
        opacity: 0.8,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {config.label}
      </span>
    </motion.div>
  );
}

export default function AgentPortfolioStrip({ portfolio, tokens, filterTicker, onTickerTap, isDesktop }) {
  if (!portfolio) return null;

  const pills = [
    ...(portfolio.star || []).map((a, i) => ({ asset: a, tier: 'star', slotIndex: i })),
    ...(portfolio.core || []).map((a, i) => ({ asset: a, tier: 'core', slotIndex: i })),
    ...(portfolio.support || []).map((a, i) => ({ asset: a, tier: 'support', slotIndex: i })),
  ];

  const hasFilter = !!filterTicker;

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          gap: isDesktop ? 10 : 8,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: isDesktop ? '6px 24px' : '6px 16px',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        className="hide-scrollbar"
      >
        {pills.map(({ asset, tier, slotIndex }) => (
          <PillItem
            key={`${tier}-${slotIndex}`}
            asset={asset}
            tier={tier}
            slotIndex={slotIndex}
            isFiltered={filterTicker === asset.symbol}
            isDimmed={hasFilter && filterTicker !== asset.symbol}
            tokens={tokens}
            onTap={onTickerTap}
            isDesktop={isDesktop}
          />
        ))}
      </div>

      {/* Clear filter pill */}
      <AnimatePresence>
        {hasFilter && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -4 }}
            onClick={() => onTickerTap(null)}
            style={{
              position: 'absolute',
              right: 16,
              top: -6,
              fontSize: 10,
              fontWeight: 600,
              color: '#5eead4',
              background: 'rgba(94,234,212,0.12)',
              border: '1px solid rgba(94,234,212,0.3)',
              borderRadius: 10,
              padding: '2px 8px',
              cursor: 'pointer',
              zIndex: 2,
            }}
          >
            Clear filter
          </motion.button>
        )}
      </AnimatePresence>

      {/* Hide scrollbar CSS injected inline */}
      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
