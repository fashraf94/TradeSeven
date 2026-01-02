// AssetPerformanceRow - Shows individual asset with breakout threshold progress
// Displays current performance and how close to breakout thresholds

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * AssetPerformanceRow
 * Shows individual asset with breakout threshold progress
 *
 * @param {Object} props
 * @param {Object} props.asset - Asset object { symbol, name, amount, position }
 * @param {number} props.currentPrice - Current price
 * @param {number} props.sessionOpenPrice - Price at session open
 * @param {Object} props.threshold - Threshold object { threshold, rallyThreshold, moonshotThreshold }
 * @param {Array} props.breakouts - Array of breakout events for this asset
 */
export default function AssetPerformanceRow({
  asset,
  currentPrice,
  sessionOpenPrice,
  threshold,
  breakouts = []
}) {
  // Calculate percentage change
  const priceChange = sessionOpenPrice > 0
    ? ((currentPrice - sessionOpenPrice) / sessionOpenPrice) * 100
    : 0;

  // For shorts, flip the sign (negative price = positive return)
  const effectiveChange = asset.position === 'short' ? -priceChange : priceChange;

  // Get threshold values
  const baseThreshold = threshold?.threshold || 2.5;
  const rallyThreshold = threshold?.rallyThreshold || baseThreshold * 1.5;
  const moonshotThreshold = threshold?.moonshotThreshold || baseThreshold * 2.0;

  // Calculate progress toward breakout (as percentage of first threshold)
  const absChange = Math.abs(effectiveChange);
  const progressToBreakout = Math.min((absChange / baseThreshold) * 100, 100);

  // Determine breakout status
  const hasBreakout = absChange >= baseThreshold;
  const hasRally = absChange >= rallyThreshold;
  const hasMoonshot = absChange >= moonshotThreshold;

  // Check if this asset has any recorded breakouts
  const hasRecordedBreakout = breakouts.some(b =>
    b.symbol?.toUpperCase() === asset.symbol?.toUpperCase()
  );

  // Determine current breakout level
  let breakoutLevel = null;
  if (hasMoonshot) breakoutLevel = 'MOONSHOT';
  else if (hasRally) breakoutLevel = 'RALLY';
  else if (hasBreakout) breakoutLevel = 'BREAKOUT';

  // Get display info
  const isPositive = effectiveChange > 0;
  const isBust = effectiveChange < 0 && hasBreakout;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-all',
        'bg-card/30 border-border/30',
        hasBreakout && isPositive && 'border-emerald-500/30 bg-emerald-500/5',
        hasBreakout && !isPositive && 'border-red-500/30 bg-red-500/5'
      )}
    >
      {/* Symbol and Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{asset.symbol}</span>
          {asset.position === 'short' && (
            <span className="text-xs px-1 py-0.5 rounded bg-amber-500/20 text-amber-500">
              SHORT
            </span>
          )}
          {hasRecordedBreakout && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="text-sm"
            >
              🎯
            </motion.span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {asset.name || asset.symbol}
        </div>
      </div>

      {/* Current % Change */}
      <div className="text-right">
        <div
          className={cn(
            'font-bold text-sm tabular-nums',
            isPositive && 'text-emerald-500',
            !isPositive && effectiveChange !== 0 && 'text-red-500',
            effectiveChange === 0 && 'text-muted-foreground'
          )}
        >
          {effectiveChange >= 0 ? '+' : ''}{effectiveChange.toFixed(2)}%
        </div>
        <div className="text-xs text-muted-foreground">
          ${currentPrice?.toFixed(2) || '—'}
        </div>
      </div>

      {/* Progress Bar and Threshold Info */}
      <div className="w-28 md:w-36">
        {/* Progress bar */}
        <div className="h-2 rounded-full bg-border/50 overflow-hidden mb-1">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressToBreakout}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn(
              'h-full rounded-full transition-colors',
              !hasBreakout && 'bg-muted-foreground/50',
              hasBreakout && isPositive && !hasRally && 'bg-emerald-500',
              hasRally && isPositive && !hasMoonshot && 'bg-amber-500',
              hasMoonshot && isPositive && 'bg-violet-500',
              hasBreakout && !isPositive && !hasRally && 'bg-red-500',
              hasRally && !isPositive && !hasMoonshot && 'bg-red-600',
              hasMoonshot && !isPositive && 'bg-red-700'
            )}
          />
        </div>

        {/* Threshold label */}
        <div className="text-xs text-muted-foreground">
          {breakoutLevel ? (
            <span
              className={cn(
                'font-medium',
                breakoutLevel === 'BREAKOUT' && isPositive && 'text-emerald-500',
                breakoutLevel === 'RALLY' && isPositive && 'text-amber-500',
                breakoutLevel === 'MOONSHOT' && isPositive && 'text-violet-500',
                breakoutLevel === 'BREAKOUT' && !isPositive && 'text-red-500',
                breakoutLevel === 'RALLY' && !isPositive && 'text-red-600',
                breakoutLevel === 'MELTDOWN' && !isPositive && 'text-red-700'
              )}
            >
              {isPositive
                ? getPositiveBreakoutLabel(breakoutLevel)
                : getNegativeBreakoutLabel(breakoutLevel)
              }
            </span>
          ) : (
            <span>
              {(baseThreshold - absChange).toFixed(1)}% to 🎯
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Get positive breakout label
 */
function getPositiveBreakoutLabel(level) {
  switch (level) {
    case 'MOONSHOT':
      return '🌙 Moonshot!';
    case 'RALLY':
      return '🚀 Rally!';
    case 'BREAKOUT':
      return '🎯 Breakout!';
    default:
      return level;
  }
}

/**
 * Get negative breakout label
 */
function getNegativeBreakoutLabel(level) {
  switch (level) {
    case 'MOONSHOT':
      return '🔥 Meltdown';
    case 'RALLY':
      return '💥 Crash';
    case 'BREAKOUT':
      return '📉 Bust';
    default:
      return level;
  }
}
