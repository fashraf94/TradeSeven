// BaggerBombBattleViewConnected - Data-connected wrapper for BaggerBombBattleView
// Connects the UI components to real Firebase data via useBaggerBombBattleV3 hook
// Features: Chain trigger celebrations, night mode theme

import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../constants/holoTheme';
import BaggerBombBattleView from './BaggerBombBattleView';
import TriggerCelebration from '../components/BaggerBomb/TriggerCelebration';
import useBaggerBombBattleV3 from '../hooks/useBaggerBombBattleV3';
import { SESSION_CONFIG } from '../utils/baggerBombUtils';

/**
 * Determine if night mode should be active based on session
 * Night mode activates during NIGHT_GAME session (4:00 PM - 8:00 PM ET)
 */
const useNightMode = (currentSessionId) => {
  return useMemo(() => {
    return currentSessionId === 'NIGHT_GAME';
  }, [currentSessionId]);
};

/**
 * BaggerBombBattleViewConnected - Connected wrapper
 */
export default function BaggerBombBattleViewConnected({
  battleId,
  userId,
  onBack,
}) {
  // Use the V3 hook (threshold triggers are now managed by the hook)
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
    currentPrices,
    openPrices,
    thresholds,
    // New: Hook-managed trigger state for chain animations
    activeTrigger,
    chainCount,
    cumulativePoints,
    clearTrigger,
  } = useBaggerBombBattleV3(battleId, userId);

  // Auto night mode based on session
  const isNightMode = useNightMode(currentSessionId);

  // Build trigger object for TriggerCelebration
  const triggerForCelebration = useMemo(() => {
    if (!activeTrigger) return null;
    return {
      name: activeTrigger.name,
      symbol: activeTrigger.symbol,
      points: activeTrigger.points,
    };
  }, [activeTrigger]);

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
        nightMode={isNightMode}
        thresholds={thresholds}
        currentPrices={currentPrices}
        openPrices={openPrices}
      />

      {/* Threshold Trigger Celebration Overlay with Chain Support */}
      <AnimatePresence>
        {triggerForCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          >
            <TriggerCelebration
              trigger={triggerForCelebration}
              chainCount={chainCount}
              cumulativePoints={cumulativePoints}
              onComplete={clearTrigger}
              autoHide
              duration={800}
            />
          </motion.div>
        )}
      </AnimatePresence>
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
