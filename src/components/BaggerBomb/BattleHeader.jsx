// BattleHeader - Sleeper-style battle header with scores and tug-of-war
// Shows avatars, points, session progress, and bomb/bust counts

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../constants/holoTheme';
import SessionHUD from './SessionHUD';
import FreeAgentBar from './FreeAgentBar';

/**
 * Default avatar component when no image provided
 */
function DefaultAvatar({ name, isPlayer }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return (
    <div
      style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: isPlayer ? HOLO_COLORS.cyan + '30' : HOLO_COLORS.purple + '30',
        border: `2px solid ${isPlayer ? HOLO_COLORS.cyan : HOLO_COLORS.purple}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        fontWeight: 700,
        color: isPlayer ? HOLO_COLORS.cyan : HOLO_COLORS.purple,
      }}
    >
      {initial}
    </div>
  );
}

DefaultAvatar.propTypes = {
  name: PropTypes.string,
  isPlayer: PropTypes.bool,
};

/**
 * PlayerSide - One side of the header (player or opponent)
 */
function PlayerSide({
  player,
  isRight = false,
  isLeading = false,
  battleVersion = 3,
}) {
  const {
    username = 'Player',
    avatar,
    totalPoints = 0,
    sessionPoints = 0,
    baggerBombs = 0,
    busts = 0,
  } = player;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isRight ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: '12px',
        flex: 1,
      }}
    >
      {/* Avatar */}
      {avatar ? (
        <img
          src={avatar}
          alt={username}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: `2px solid ${isLeading ? HOLO_COLORS.green : HOLO_COLORS.borderSubtle}`,
            boxShadow: isLeading ? GLOW_EFFECTS.green : 'none',
          }}
        />
      ) : (
        <DefaultAvatar name={username} isPlayer={!isRight} />
      )}

      {/* Score Info */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isRight ? 'flex-end' : 'flex-start',
        }}
      >
        {/* Total Points */}
        <div
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(totalPoints)}
        </div>

        {/* Session Points (V3 only — V4 has no sessions) */}
        {battleVersion < 4 && (
          <div
            style={{
              fontSize: '13px',
              color: sessionPoints >= 0 ? HOLO_COLORS.green : HOLO_COLORS.red,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {sessionPoints >= 0 ? '+' : ''}{Math.round(sessionPoints)} session
          </div>
        )}

        {/* Username */}
        <div
          style={{
            fontSize: '11px',
            color: HOLO_COLORS.textMuted,
            marginTop: '2px',
          }}
        >
          {username}
        </div>
      </div>
    </div>
  );
}

PlayerSide.propTypes = {
  player: PropTypes.shape({
    id: PropTypes.string,
    username: PropTypes.string,
    avatar: PropTypes.string,
    totalPoints: PropTypes.number,
    sessionPoints: PropTypes.number,
    baggerBombs: PropTypes.number,
    busts: PropTypes.number,
  }).isRequired,
  isRight: PropTypes.bool,
  isLeading: PropTypes.bool,
};

/**
 * TugOfWarBeam - Animated score balance indicator
 */
function TugOfWarBeam({ playerPoints, opponentPoints }) {
  const total = playerPoints + opponentPoints;
  const playerPercent = total > 0 ? (playerPoints / total) * 100 : 50;

  return (
    <div
      style={{
        position: 'relative',
        height: '8px',
        backgroundColor: HOLO_COLORS.bgCard,
        borderRadius: '4px',
        overflow: 'hidden',
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
      }}
    >
      {/* Player side (cyan) */}
      <motion.div
        animate={{ width: `${playerPercent}%` }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          background: `linear-gradient(90deg, ${HOLO_COLORS.cyan}80, ${HOLO_COLORS.cyan})`,
          borderRadius: '4px 0 0 4px',
        }}
      />

      {/* Opponent side (purple) */}
      <motion.div
        animate={{ width: `${100 - playerPercent}%` }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          background: `linear-gradient(90deg, ${HOLO_COLORS.purple}, ${HOLO_COLORS.purple}80)`,
          borderRadius: '0 4px 4px 0',
        }}
      />

      {/* Center marker (needle) */}
      <motion.div
        animate={{ left: `${playerPercent}%` }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        style={{
          position: 'absolute',
          top: '50%',
          width: '12px',
          height: '12px',
          marginLeft: '-6px',
          marginTop: '-6px',
          backgroundColor: HOLO_COLORS.textPrimary,
          borderRadius: '50%',
          boxShadow: '0 0 8px rgba(255,255,255,0.5)',
          zIndex: 10,
        }}
      />
    </div>
  );
}

TugOfWarBeam.propTypes = {
  playerPoints: PropTypes.number.isRequired,
  opponentPoints: PropTypes.number.isRequired,
};

/**
 * BombBustCounts - Display bomb and bust counts
 */
function BombBustCounts({ player, opponent }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px',
        color: HOLO_COLORS.textMuted,
        padding: '0 4px',
      }}
    >
      <div style={{ display: 'flex', gap: '8px' }}>
        <span>
          💣 <span style={{ color: HOLO_COLORS.green }}>{player.baggerBombs || 0}</span>
        </span>
        <span>
          📉 <span style={{ color: HOLO_COLORS.red }}>{player.busts || 0}</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <span>
          💣 <span style={{ color: HOLO_COLORS.green }}>{opponent.baggerBombs || 0}</span>
        </span>
        <span>
          📉 <span style={{ color: HOLO_COLORS.red }}>{opponent.busts || 0}</span>
        </span>
      </div>
    </div>
  );
}

BombBustCounts.propTypes = {
  player: PropTypes.shape({
    baggerBombs: PropTypes.number,
    busts: PropTypes.number,
  }).isRequired,
  opponent: PropTypes.shape({
    baggerBombs: PropTypes.number,
    busts: PropTypes.number,
  }).isRequired,
};

/**
 * BattleHeader - Main header component
 */
export default function BattleHeader({
  player,
  opponent,
  currentSession,
  sessionTimeRemaining,
  sessionScores,
  completedSessions,
  // V4 props
  battleVersion = 3,
  freeAgents,
  nextRotationAt,
  currentPrices,
  freeAgentDailyOpens,
  swapsRemaining,
  currentDay,
  totalDays,
  rotationCountdown,
  // Swap mode props
  swapMode,
  onEnterSwapMode,
  onSelectFreeAgent,
  onCancelSwapMode,
}) {
  // Determine who is leading
  const playerLeading = player.totalPoints > opponent.totalPoints;
  const opponentLeading = opponent.totalPoints > player.totalPoints;

  // Calculate session scores for SessionHUD
  const hudSessionScores = useMemo(() => {
    if (!sessionScores) return {};
    const result = {};
    Object.entries(sessionScores).forEach(([key, scores]) => {
      result[key] = {
        player: scores.creator ?? scores.player ?? 0,
        opponent: scores.opponent ?? 0,
      };
    });
    return result;
  }, [sessionScores]);

  return (
    <div
      style={{
        backgroundColor: HOLO_COLORS.bgElevated,
        borderRadius: '16px',
        padding: '16px',
        margin: '0 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Title */}
      <div
        style={{
          textAlign: 'center',
          fontSize: '11px',
          fontWeight: 600,
          color: HOLO_COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        BaggerBomb Battle
      </div>

      {/* Score Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <PlayerSide
          player={player}
          isRight={false}
          isLeading={playerLeading}
          battleVersion={battleVersion}
        />

        {/* VS Badge */}
        <div
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: HOLO_COLORS.textMuted,
          }}
        >
          ⚔️
        </div>

        <PlayerSide
          player={opponent}
          isRight={true}
          isLeading={opponentLeading}
          battleVersion={battleVersion}
        />
      </div>

      {/* Tug-of-War Beam */}
      <TugOfWarBeam
        playerPoints={player.totalPoints || 0}
        opponentPoints={opponent.totalPoints || 0}
      />

      {/* Bomb/Bust Counts */}
      <BombBustCounts player={player} opponent={opponent} />

      {/* V4: Swap Button (between bomb/bust and free agent bar) */}
      {battleVersion >= 4 && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {swapMode?.active ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onCancelSwapMode}
              style={{
                padding: '8px 20px',
                borderRadius: '20px',
                border: 'none',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.15))',
                color: HOLO_COLORS.red,
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: `0 0 15px rgba(239, 68, 68, 0.2), 0 2px 8px rgba(0, 0, 0, 0.3)`,
                letterSpacing: '0.5px',
              }}
            >
              Cancel Swap
            </motion.button>
          ) : swapsRemaining > 0 ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onEnterSwapMode}
              style={{
                padding: '8px 20px',
                borderRadius: '20px',
                border: 'none',
                background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.2), rgba(139, 92, 246, 0.2))',
                color: HOLO_COLORS.cyan,
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: `0 0 15px rgba(0, 217, 255, 0.2), 0 2px 8px rgba(0, 0, 0, 0.3)`,
                letterSpacing: '0.5px',
              }}
            >
              <span style={{ fontSize: '14px' }}>🔄</span>
              Swap ({swapsRemaining} left)
            </motion.button>
          ) : (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: HOLO_COLORS.textMuted,
              }}
            >
              No swaps today
            </span>
          )}
        </div>
      )}

      {/* V4: Free Agent Bar / V3: Session HUD */}
      {battleVersion >= 4 ? (
        <FreeAgentBar
          freeAgents={freeAgents || []}
          nextRotationAt={nextRotationAt}
          currentPrices={currentPrices || {}}
          freeAgentDailyOpens={freeAgentDailyOpens || {}}
          swapsRemaining={swapsRemaining || 0}
          currentDay={currentDay || 1}
          totalDays={totalDays || 3}
          rotationCountdown={rotationCountdown || 0}
          swapMode={swapMode}
          onEnterSwapMode={onEnterSwapMode}
          onSelectFreeAgent={onSelectFreeAgent}
          onCancelSwapMode={onCancelSwapMode}
          hideSwapButton
        />
      ) : (
        <SessionHUD
          currentSession={currentSession}
          timeRemaining={sessionTimeRemaining}
          sessionScores={hudSessionScores}
          completedSessions={completedSessions || []}
        />
      )}
    </div>
  );
}

BattleHeader.propTypes = {
  /** Player data */
  player: PropTypes.shape({
    id: PropTypes.string,
    username: PropTypes.string,
    avatar: PropTypes.string,
    totalPoints: PropTypes.number,
    sessionPoints: PropTypes.number,
    baggerBombs: PropTypes.number,
    busts: PropTypes.number,
  }).isRequired,
  /** Opponent data */
  opponent: PropTypes.shape({
    id: PropTypes.string,
    username: PropTypes.string,
    avatar: PropTypes.string,
    totalPoints: PropTypes.number,
    sessionPoints: PropTypes.number,
    baggerBombs: PropTypes.number,
    busts: PropTypes.number,
  }).isRequired,
  /** Current active session (V3) */
  currentSession: PropTypes.oneOf(['MORNING_BELL', 'MIDDAY', 'POWER_HOUR', 'NIGHT_GAME', '']),
  /** Seconds remaining in current session (V3) */
  sessionTimeRemaining: PropTypes.number,
  /** Session scores object (V3) */
  sessionScores: PropTypes.object,
  /** Array of completed session keys (V3) */
  completedSessions: PropTypes.arrayOf(PropTypes.string),
  /** Battle version (3 or 4) */
  battleVersion: PropTypes.number,
  /** V4: Free agents array */
  freeAgents: PropTypes.array,
  /** V4: ISO timestamp of next rotation */
  nextRotationAt: PropTypes.string,
  /** V4: Current prices */
  currentPrices: PropTypes.object,
  /** V4: Daily open prices for free agent cards */
  freeAgentDailyOpens: PropTypes.object,
  /** V4: Swaps remaining today */
  swapsRemaining: PropTypes.number,
  /** V4: Current trading day */
  currentDay: PropTypes.number,
  /** V4: Total trading days */
  totalDays: PropTypes.number,
  /** V4: Seconds until next rotation */
  rotationCountdown: PropTypes.number,
};

BattleHeader.defaultProps = {
  currentSession: '',
  sessionTimeRemaining: 0,
  sessionScores: {},
  completedSessions: [],
  battleVersion: 3,
  freeAgents: [],
  nextRotationAt: null,
  currentPrices: {},
  freeAgentDailyOpens: {},
  swapsRemaining: 0,
  currentDay: 1,
  totalDays: 3,
  rotationCountdown: 0,
};
