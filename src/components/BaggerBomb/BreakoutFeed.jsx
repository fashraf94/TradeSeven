// BreakoutFeed - Shows live feed of breakout events
// Displays threshold breaches (Breakout, Rally, Moonshot, Bust, Crash, Meltdown)

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BREAKOUT_TYPES } from '../../services/breakoutDetectionService';

/**
 * BreakoutFeed
 * Shows live feed of breakout events
 *
 * @param {Object} props
 * @param {Array} props.breakouts - Array of breakout events
 * @param {number} props.maxItems - Maximum items to display (default 5)
 * @param {string} props.currentUserId - Current user's ID to determine your vs opponent
 */
export default function BreakoutFeed({
  breakouts = [],
  maxItems = 5,
  currentUserId = null
}) {
  // Sort by timestamp (newest first) and limit
  const sortedBreakouts = [...breakouts]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, maxItems);

  // Empty state
  if (sortedBreakouts.length === 0) {
    return (
      <div className="rounded-lg border border-border/30 bg-card/30 p-4">
        <div className="text-center py-6">
          <div className="text-3xl mb-2">🎯</div>
          <div className="text-sm text-muted-foreground">
            No breakout events yet.
          </div>
          <div className="text-xs text-muted-foreground/70 mt-1">
            Waiting for the action...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/30 bg-card/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border/30 bg-card/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Breakout Feed</span>
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-cyan-500"
          />
        </div>
      </div>

      {/* Feed items */}
      <div className="divide-y divide-border/20">
        <AnimatePresence mode="popLayout">
          {sortedBreakouts.map((breakout, index) => (
            <BreakoutItem
              key={breakout.id || `${breakout.symbol}-${breakout.type}-${breakout.timestamp}`}
              breakout={breakout}
              isYours={breakout.playerId === currentUserId || breakout.isYours}
              index={index}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Individual breakout item
 */
function BreakoutItem({ breakout, isYours, index }) {
  const typeConfig = BREAKOUT_TYPES[breakout.type] || {
    name: breakout.type,
    emoji: '📊',
    color: '#6b7280',
    points: 0
  };

  const timeAgo = getTimeAgo(breakout.timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      layout
      className={cn(
        'px-4 py-3 transition-colors',
        isYours ? 'bg-card/50' : 'bg-transparent'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Emoji */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.1 }}
          className="text-2xl"
        >
          {typeConfig.emoji}
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Symbol */}
            <span className="font-bold text-sm">{breakout.symbol}</span>

            {/* Breakout type badge */}
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${typeConfig.color}20`,
                color: typeConfig.color
              }}
            >
              {typeConfig.name}
            </span>

            {/* Yours/Opponent indicator */}
            {isYours ? (
              <span className="text-xs text-cyan-500">Your pick</span>
            ) : (
              <span className="text-xs text-muted-foreground">Opponent</span>
            )}
          </div>

          {/* Time ago */}
          <div className="text-xs text-muted-foreground mt-0.5">
            {timeAgo}
          </div>
        </div>

        {/* Points */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.15 }}
          className={cn(
            'text-sm font-bold tabular-nums',
            typeConfig.points > 0 && 'text-emerald-500',
            typeConfig.points < 0 && 'text-red-500'
          )}
        >
          {typeConfig.points > 0 ? '+' : ''}{typeConfig.points}
        </motion.div>
      </div>

      {/* Session info if available */}
      {breakout.sessionId && (
        <div className="mt-1 text-xs text-muted-foreground/70 ml-11">
          During {formatSessionName(breakout.sessionId)}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Format time ago string
 */
function getTimeAgo(timestamp) {
  if (!timestamp) return '';

  const now = new Date();
  const then = new Date(timestamp);
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Format session name for display
 */
function formatSessionName(sessionId) {
  const names = {
    MORNING_BELL: 'Morning Bell',
    MIDDAY: 'Midday',
    POWER_HOUR: 'Power Hour',
    NIGHT_GAME: 'Night Game'
  };
  return names[sessionId] || sessionId;
}
