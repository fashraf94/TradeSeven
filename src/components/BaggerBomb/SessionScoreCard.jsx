// SessionScoreCard - Displays a single session's scores for both players
// Used in the BaggerBombScoreboard to show session-by-session breakdown

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Session display config with emojis
const SESSION_CONFIG = {
  MORNING_BELL: {
    name: 'Morning Bell',
    emoji: '🔔',
    shortName: 'Morning'
  },
  MIDDAY: {
    name: 'Midday',
    emoji: '☀️',
    shortName: 'Midday'
  },
  POWER_HOUR: {
    name: 'Power Hour',
    emoji: '⚡',
    shortName: 'Power'
  },
  NIGHT_GAME: {
    name: 'Night Game',
    emoji: '🌙',
    shortName: 'Night'
  }
};

/**
 * SessionScoreCard
 * Displays a single session's scores for both players
 *
 * @param {Object} props
 * @param {string} props.session - Session ID (MORNING_BELL, MIDDAY, etc.)
 * @param {number} props.yourScore - Current user's score
 * @param {number} props.opponentScore - Opponent's score
 * @param {boolean} props.isActive - Whether this session is currently active
 * @param {boolean} props.isCompleted - Whether this session has ended
 * @param {string} props.winner - 'you', 'opponent', or null
 */
export default function SessionScoreCard({
  session,
  yourScore = 0,
  opponentScore = 0,
  isActive = false,
  isCompleted = false,
  winner = null
}) {
  const config = SESSION_CONFIG[session] || {
    name: session,
    emoji: '📊',
    shortName: session
  };

  const scoreDiff = yourScore - opponentScore;
  const isWinning = scoreDiff > 0;
  const isTie = scoreDiff === 0 && isCompleted;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'relative rounded-lg border p-3 transition-all',
        'bg-card/50 backdrop-blur-sm',
        isActive && 'border-cyan-500/50 shadow-lg shadow-cyan-500/10',
        isCompleted && !isActive && 'border-border/50 opacity-80',
        !isActive && !isCompleted && 'border-border/30'
      )}
    >
      {/* Active glow effect */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          animate={{
            boxShadow: [
              '0 0 10px rgba(0, 217, 255, 0.2)',
              '0 0 20px rgba(0, 217, 255, 0.3)',
              '0 0 10px rgba(0, 217, 255, 0.2)'
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{config.emoji}</span>
          <span className="text-sm font-medium text-foreground/90">
            {config.shortName}
          </span>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-1.5">
          {isActive && (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center gap-1 text-xs font-bold text-red-500"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              LIVE
            </motion.span>
          )}

          {isCompleted && winner === 'you' && (
            <span className="text-xs font-medium text-emerald-500">
              ✓ Won
            </span>
          )}

          {isCompleted && winner === 'opponent' && (
            <span className="text-xs font-medium text-red-400">
              Lost
            </span>
          )}

          {isTie && (
            <span className="text-xs font-medium text-muted-foreground">
              Tie
            </span>
          )}
        </div>
      </div>

      {/* Scores */}
      <div className="flex items-center justify-between">
        {/* Your score */}
        <div className="flex-1">
          <div className="text-xs text-muted-foreground mb-0.5">You</div>
          <div
            className={cn(
              'text-xl font-bold tabular-nums',
              yourScore > 0 && 'text-emerald-500',
              yourScore < 0 && 'text-red-500',
              yourScore === 0 && 'text-foreground/70'
            )}
          >
            {yourScore > 0 ? '+' : ''}{yourScore.toFixed(0)}
          </div>
        </div>

        {/* VS divider */}
        <div className="px-2 text-muted-foreground/50 text-xs">vs</div>

        {/* Opponent score */}
        <div className="flex-1 text-right">
          <div className="text-xs text-muted-foreground mb-0.5">Opp</div>
          <div
            className={cn(
              'text-xl font-bold tabular-nums',
              opponentScore > 0 && 'text-emerald-500',
              opponentScore < 0 && 'text-red-500',
              opponentScore === 0 && 'text-foreground/70'
            )}
          >
            {opponentScore > 0 ? '+' : ''}{opponentScore.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Lead indicator for active session */}
      {isActive && scoreDiff !== 0 && (
        <div
          className={cn(
            'mt-2 pt-2 border-t border-border/30 text-xs text-center',
            isWinning ? 'text-emerald-500/80' : 'text-red-400/80'
          )}
        >
          {isWinning
            ? `Leading by ${Math.abs(scoreDiff).toFixed(0)} pts`
            : `Trailing by ${Math.abs(scoreDiff).toFixed(0)} pts`
          }
        </div>
      )}
    </motion.div>
  );
}
