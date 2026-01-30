// BaggerBombBattleViewConnected - Data-connected wrapper for BaggerBombBattleView
// Connects the UI components to real Firebase data via useBaggerBombBattleV3 hook

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../constants/holoTheme';
import BaggerBombBattleView from './BaggerBombBattleView';
import useBaggerBombBattleV3 from '../hooks/useBaggerBombBattleV3';

// Badge trigger animation overlay
function ThresholdTriggerOverlay({ trigger, onComplete }) {
  if (!trigger) return null;

  const isPositive = ['bagger', 'doubleBagger', 'tenBagger'].includes(trigger.name);

  const icons = {
    bagger: '💣',
    doubleBagger: '💣💣',
    tenBagger: '🚀',
    bust: '📉',
    crash: '💥',
    meltdown: '🔥',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onAnimationComplete={onComplete}
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 1000,
          pointerEvents: 'none',
        }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={{ fontSize: '80px' }}
        >
          {icons[trigger.name] || '💣'}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            marginTop: '16px',
            fontSize: '24px',
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
          }}
        >
          {trigger.symbol}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            marginTop: '8px',
            fontSize: '32px',
            fontWeight: 700,
            color: isPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
          }}
        >
          {trigger.points > 0 ? '+' : ''}{trigger.points}
        </motion.div>

        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '200px' }}
          transition={{ delay: 0.5, duration: 1.5 }}
          style={{
            marginTop: '24px',
            height: '4px',
            backgroundColor: isPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
            borderRadius: '2px',
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

ThresholdTriggerOverlay.propTypes = {
  trigger: PropTypes.shape({
    name: PropTypes.string,
    symbol: PropTypes.string,
    points: PropTypes.number,
  }),
  onComplete: PropTypes.func,
};

/**
 * BaggerBombBattleViewConnected - Connected wrapper
 */
export default function BaggerBombBattleViewConnected({
  battleId,
  userId,
  onBack,
}) {
  // Threshold trigger state for celebration overlay
  const [activeTrigger, setActiveTrigger] = useState(null);

  // Handle threshold crossing
  const handleThresholdCross = useCallback((name, symbol, points, event) => {
    console.log('🎉 Threshold crossed!', { name, symbol, points });

    // Show celebration overlay
    setActiveTrigger({ name, symbol, points });

    // Auto-dismiss after animation
    setTimeout(() => {
      setActiveTrigger(null);
    }, 2500);
  }, []);

  // Use the V3 hook with threshold callback
  const {
    battle,
    loading,
    error,
    player,
    opponent,
    currentSession,
    currentSessionId,
    sessionTimeRemaining,
    sessionScores,
    completedSessions,
    events,
    refreshPrices,
  } = useBaggerBombBattleV3(battleId, userId, {
    onThresholdCross: handleThresholdCross,
  });

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: HOLO_COLORS.bgDeep,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          style={{
            width: '40px',
            height: '40px',
            border: `3px solid ${HOLO_COLORS.cyan}30`,
            borderTopColor: HOLO_COLORS.cyan,
            borderRadius: '50%',
          }}
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: HOLO_COLORS.bgDeep,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <div
          style={{
            fontSize: '16px',
            color: HOLO_COLORS.textPrimary,
            marginBottom: '8px',
          }}
        >
          Error loading battle
        </div>
        <div
          style={{
            fontSize: '14px',
            color: HOLO_COLORS.textMuted,
            marginBottom: '24px',
          }}
        >
          {error}
        </div>
        <button
          onClick={onBack}
          style={{
            padding: '12px 24px',
            backgroundColor: HOLO_COLORS.cyan,
            color: HOLO_COLORS.bgDeep,
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <>
      <BaggerBombBattleView
        battle={battle}
        player={player}
        opponent={opponent}
        currentSession={currentSessionId}
        sessionTimeRemaining={sessionTimeRemaining}
        sessionScores={sessionScores}
        completedSessions={completedSessions}
        events={events}
        onBack={onBack}
        onThresholdCross={handleThresholdCross}
      />

      {/* Threshold Trigger Celebration Overlay */}
      <ThresholdTriggerOverlay
        trigger={activeTrigger}
        onComplete={() => setActiveTrigger(null)}
      />
    </>
  );
}

BaggerBombBattleViewConnected.propTypes = {
  /** Firebase battle document ID */
  battleId: PropTypes.string.isRequired,
  /** Current user's odUserId */
  userId: PropTypes.string.isRequired,
  /** Callback when back button is pressed */
  onBack: PropTypes.func,
};

BaggerBombBattleViewConnected.defaultProps = {
  onBack: () => {},
};
