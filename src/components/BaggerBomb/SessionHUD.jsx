// SessionHUD - Four session indicators showing battle progress
// States: completed (✓ + score), active (pulsing + timer), locked (dimmed)

import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

// Session configuration
const SESSIONS = [
  { key: 'MORNING_BELL', icon: '🌅', label: 'Morning', time: '9:30-11:30' },
  { key: 'MIDDAY', icon: '☀️', label: 'Midday', time: '11:30-2:00' },
  { key: 'POWER_HOUR', icon: '⚡', label: 'Power', time: '2:00-4:00' },
  { key: 'NIGHT_GAME', icon: '🌙', label: 'Night', time: '4:00-8:00' },
];

/**
 * Format seconds to MM:SS
 */
const formatTime = (seconds) => {
  if (!seconds || seconds <= 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Single session indicator
 */
function SessionIndicator({
  session,
  status,
  score,
  timeRemaining,
  isWinner,
}) {
  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const isLocked = status === 'locked' || status === 'upcoming';

  return (
    <motion.div
      animate={isActive ? { scale: [1, 1.02, 1] } : {}}
      transition={isActive ? { duration: 2, repeat: Infinity } : {}}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 6px',
        borderRadius: '8px',
        minWidth: '60px',
        backgroundColor: isActive
          ? `${HOLO_COLORS.cyan}15`
          : 'transparent',
        border: isActive
          ? `1px solid ${HOLO_COLORS.cyan}50`
          : '1px solid transparent',
        opacity: isLocked ? 0.4 : 1,
        transition: 'all 0.3s ease',
      }}
    >
      {/* Session Icon */}
      <span style={{ fontSize: '20px', marginBottom: '4px' }}>
        {session.icon}
      </span>

      {/* Status Display */}
      {isCompleted && (
        <>
          <span
            style={{
              fontSize: '10px',
              color: HOLO_COLORS.green,
              fontWeight: 600,
            }}
          >
            ✓
          </span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: isWinner ? HOLO_COLORS.green : HOLO_COLORS.textMuted,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {score !== undefined ? (score >= 0 ? '+' : '') + score : '--'}
          </span>
        </>
      )}

      {isActive && (
        <motion.span
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: HOLO_COLORS.cyan,
            fontFamily: 'monospace',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatTime(timeRemaining)}
        </motion.span>
      )}

      {isLocked && (
        <span
          style={{
            fontSize: '11px',
            color: HOLO_COLORS.textMuted,
          }}
        >
          --
        </span>
      )}

      {/* Session Label (compact) */}
      <span
        style={{
          fontSize: '9px',
          color: HOLO_COLORS.textMuted,
          marginTop: '2px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {session.label}
      </span>
    </motion.div>
  );
}

SessionIndicator.propTypes = {
  session: PropTypes.shape({
    key: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    time: PropTypes.string.isRequired,
  }).isRequired,
  status: PropTypes.oneOf(['completed', 'active', 'locked', 'upcoming']).isRequired,
  score: PropTypes.number,
  timeRemaining: PropTypes.number,
  isWinner: PropTypes.bool,
};

/**
 * SessionHUD - Four session indicators
 */
export default function SessionHUD({
  currentSession,
  timeRemaining,
  sessionScores = {},
  completedSessions = [],
  playerScores = {},
}) {
  // Determine status for each session
  const getSessionStatus = (sessionKey) => {
    if (completedSessions.includes(sessionKey)) return 'completed';
    if (sessionKey === currentSession) return 'active';
    return 'locked';
  };

  // Get player's score for a session
  const getSessionScore = (sessionKey) => {
    return sessionScores[sessionKey]?.player ?? playerScores[sessionKey];
  };

  // Check if player won the session
  const isSessionWinner = (sessionKey) => {
    const scores = sessionScores[sessionKey];
    if (!scores) return false;
    return scores.player > scores.opponent;
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '4px',
        padding: '8px 4px',
        backgroundColor: HOLO_COLORS.bgCard,
        borderRadius: '8px',
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
      }}
    >
      {SESSIONS.map((session) => (
        <SessionIndicator
          key={session.key}
          session={session}
          status={getSessionStatus(session.key)}
          score={getSessionScore(session.key)}
          timeRemaining={session.key === currentSession ? timeRemaining : undefined}
          isWinner={isSessionWinner(session.key)}
        />
      ))}
    </div>
  );
}

SessionHUD.propTypes = {
  /** Current active session key */
  currentSession: PropTypes.oneOf(['MORNING_BELL', 'MIDDAY', 'POWER_HOUR', 'NIGHT_GAME', '']),
  /** Seconds remaining in current session */
  timeRemaining: PropTypes.number,
  /** Session scores: { MORNING_BELL: { player: 12, opponent: 8 }, ... } */
  sessionScores: PropTypes.objectOf(
    PropTypes.shape({
      player: PropTypes.number,
      opponent: PropTypes.number,
    })
  ),
  /** Array of completed session keys */
  completedSessions: PropTypes.arrayOf(PropTypes.string),
  /** Alternative: just player scores by session */
  playerScores: PropTypes.objectOf(PropTypes.number),
};

SessionHUD.defaultProps = {
  currentSession: '',
  timeRemaining: 0,
  sessionScores: {},
  completedSessions: [],
  playerScores: {},
};

// Export sessions config for use elsewhere
export { SESSIONS };
