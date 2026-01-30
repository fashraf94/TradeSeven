// BattleEndScreen - Victory/Defeat celebration screen for BaggerBomb battles
// Features: Confetti for wins, somber effects for losses, stats summary, rematch button

import React, { useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Frown, Star, Zap, Target, RotateCcw, Home } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';

// Confetti particle component
function ConfettiParticle({ index, isVictory }) {
  const colors = isVictory
    ? [HOLO_COLORS.green, HOLO_COLORS.amber, HOLO_COLORS.cyan, HOLO_COLORS.purple]
    : [HOLO_COLORS.red, '#991b1b', '#6b7280', '#374151'];

  const color = colors[index % colors.length];
  const startX = Math.random() * 100;
  const endX = startX + (Math.random() - 0.5) * 40;
  const size = 6 + Math.random() * 8;
  const rotation = Math.random() * 360;
  const duration = 2 + Math.random() * 2;
  const delay = Math.random() * 0.5;

  return (
    <motion.div
      initial={{
        x: `${startX}vw`,
        y: -20,
        rotate: rotation,
        opacity: 1,
      }}
      animate={{
        x: `${endX}vw`,
        y: '110vh',
        rotate: rotation + 720,
        opacity: [1, 1, 0],
      }}
      transition={{
        duration,
        delay,
        ease: 'linear',
      }}
      style={{
        position: 'fixed',
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        zIndex: 1001,
        pointerEvents: 'none',
      }}
    />
  );
}

ConfettiParticle.propTypes = {
  index: PropTypes.number.isRequired,
  isVictory: PropTypes.bool.isRequired,
};

// Stats row component
function StatRow({ icon: Icon, label, value, highlight = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}50`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Icon size={18} color={highlight ? HOLO_COLORS.amber : HOLO_COLORS.textMuted} />
        <span style={{ color: HOLO_COLORS.textMuted, fontSize: '14px' }}>{label}</span>
      </div>
      <span
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: highlight ? HOLO_COLORS.amber : HOLO_COLORS.textPrimary,
        }}
      >
        {value}
      </span>
    </motion.div>
  );
}

StatRow.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  highlight: PropTypes.bool,
};

// Score comparison component
function ScoreComparison({ playerScore, opponentScore, playerName, opponentName, isVictory }) {
  const scoreDiff = playerScore - opponentScore;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '24px',
        backgroundColor: HOLO_COLORS.bgElevated,
        borderRadius: '16px',
        marginBottom: '24px',
      }}
    >
      {/* Player Score */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: HOLO_COLORS.textMuted, marginBottom: '4px' }}>
          {playerName}
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          style={{
            fontSize: '48px',
            fontWeight: 700,
            color: isVictory ? HOLO_COLORS.green : HOLO_COLORS.textPrimary,
          }}
        >
          {playerScore}
        </motion.div>
      </div>

      {/* VS / Difference */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: '14px',
            color: HOLO_COLORS.textMuted,
            marginBottom: '4px',
          }}
        >
          {scoreDiff === 0 ? 'TIE' : isVictory ? 'WON BY' : 'LOST BY'}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          style={{
            fontSize: '24px',
            fontWeight: 600,
            color: isVictory ? HOLO_COLORS.green : scoreDiff === 0 ? HOLO_COLORS.textMuted : HOLO_COLORS.red,
          }}
        >
          {scoreDiff === 0 ? '—' : Math.abs(scoreDiff)}
        </motion.div>
      </div>

      {/* Opponent Score */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: HOLO_COLORS.textMuted, marginBottom: '4px' }}>
          {opponentName}
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          style={{
            fontSize: '48px',
            fontWeight: 700,
            color: !isVictory && scoreDiff !== 0 ? HOLO_COLORS.green : HOLO_COLORS.textPrimary,
          }}
        >
          {opponentScore}
        </motion.div>
      </div>
    </motion.div>
  );
}

ScoreComparison.propTypes = {
  playerScore: PropTypes.number.isRequired,
  opponentScore: PropTypes.number.isRequired,
  playerName: PropTypes.string.isRequired,
  opponentName: PropTypes.string.isRequired,
  isVictory: PropTypes.bool.isRequired,
};

/**
 * BattleEndScreen - Victory/Defeat celebration
 */
export default function BattleEndScreen({
  isVictory,
  isTie = false,
  playerScore,
  opponentScore,
  playerName = 'You',
  opponentName = 'Opponent',
  stats = {},
  onRematch,
  onExit,
  autoShow = true,
}) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [isVisible, setIsVisible] = useState(autoShow);

  // Generate confetti particles
  const confettiParticles = useMemo(() => {
    return Array.from({ length: isVictory ? 50 : 20 }, (_, i) => i);
  }, [isVictory]);

  // Start confetti on mount
  useEffect(() => {
    if (isVisible) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const mainColor = isTie ? HOLO_COLORS.amber : isVictory ? HOLO_COLORS.green : HOLO_COLORS.red;
  const MainIcon = isTie ? Star : isVictory ? Trophy : Frown;
  const titleText = isTie ? 'DRAW!' : isVictory ? 'VICTORY!' : 'DEFEAT';
  const subtitleText = isTie
    ? 'A closely fought battle'
    : isVictory
    ? 'You dominated the market!'
    : 'The market had other plans...';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px',
        }}
      >
        {/* Confetti Layer */}
        {showConfetti && confettiParticles.map((i) => (
          <ConfettiParticle key={i} index={i} isVictory={isVictory || isTie} />
        ))}

        {/* Radial Glow Background */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.5 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${mainColor}30 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Main Content Card */}
        <motion.div
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          style={{
            width: '100%',
            maxWidth: '380px',
            backgroundColor: HOLO_COLORS.bgCard,
            borderRadius: '20px',
            padding: '32px 24px',
            border: `2px solid ${mainColor}`,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Trophy/Icon with Pulse */}
          <motion.div
            animate={isVictory ? {
              scale: [1, 1.1, 1],
              rotate: [0, -5, 5, 0],
            } : {}}
            transition={{
              duration: 2,
              repeat: isVictory ? Infinity : 0,
              repeatType: 'reverse',
            }}
            style={{
              textAlign: 'center',
              marginBottom: '16px',
            }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.2 }}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: `${mainColor}20`,
                border: `3px solid ${mainColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                boxShadow: `0 0 30px ${mainColor}40`,
              }}
            >
              <MainIcon size={40} color={mainColor} />
            </motion.div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              textAlign: 'center',
              fontSize: '32px',
              fontWeight: 700,
              color: mainColor,
              margin: '0 0 8px 0',
              textShadow: `0 0 20px ${mainColor}60`,
            }}
          >
            {titleText}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{
              textAlign: 'center',
              fontSize: '14px',
              color: HOLO_COLORS.textMuted,
              margin: '0 0 24px 0',
            }}
          >
            {subtitleText}
          </motion.p>

          {/* Score Comparison */}
          <ScoreComparison
            playerScore={playerScore}
            opponentScore={opponentScore}
            playerName={playerName}
            opponentName={opponentName}
            isVictory={isVictory}
          />

          {/* Stats Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            style={{ marginBottom: '24px' }}
          >
            {stats.baggerBombs !== undefined && (
              <StatRow
                icon={Zap}
                label="BaggerBombs Hit"
                value={stats.baggerBombs}
                highlight={stats.baggerBombs > 0}
              />
            )}
            {stats.sessionsWon !== undefined && (
              <StatRow
                icon={Target}
                label="Sessions Won"
                value={`${stats.sessionsWon} / 4`}
              />
            )}
            {stats.biggestPlay !== undefined && (
              <StatRow
                icon={Star}
                label="Biggest Play"
                value={stats.biggestPlay}
                highlight
              />
            )}
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            style={{
              display: 'flex',
              gap: '12px',
            }}
          >
            {onRematch && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onRematch}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '14px',
                  backgroundColor: mainColor,
                  color: HOLO_COLORS.bgDeep,
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={18} />
                Rematch
              </motion.button>
            )}
            {onExit && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onExit}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '14px',
                  backgroundColor: HOLO_COLORS.bgElevated,
                  color: HOLO_COLORS.textPrimary,
                  border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Home size={18} />
                Exit
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

BattleEndScreen.propTypes = {
  /** Whether the player won */
  isVictory: PropTypes.bool.isRequired,
  /** Whether the battle was a tie */
  isTie: PropTypes.bool,
  /** Player's final score */
  playerScore: PropTypes.number.isRequired,
  /** Opponent's final score */
  opponentScore: PropTypes.number.isRequired,
  /** Player's display name */
  playerName: PropTypes.string,
  /** Opponent's display name */
  opponentName: PropTypes.string,
  /** Additional stats to display */
  stats: PropTypes.shape({
    baggerBombs: PropTypes.number,
    sessionsWon: PropTypes.number,
    biggestPlay: PropTypes.string,
  }),
  /** Callback for rematch button */
  onRematch: PropTypes.func,
  /** Callback for exit button */
  onExit: PropTypes.func,
  /** Auto-show on mount */
  autoShow: PropTypes.bool,
};

BattleEndScreen.defaultProps = {
  isTie: false,
  playerName: 'You',
  opponentName: 'Opponent',
  stats: {},
  onRematch: null,
  onExit: null,
  autoShow: true,
};
