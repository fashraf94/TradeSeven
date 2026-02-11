// BaggerBombBattleViewConnectedV4 - V4 data-connected wrapper
// Connects BaggerBombBattleView to real Firebase data via useBaggerBombBattleV4 hook
// Features: Free agent rotation, swap modal, closed trades, multi-day battles

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../constants/holoTheme';
import BaggerBombBattleView from './BaggerBombBattleView';
import TriggerCelebration from '../components/BaggerBomb/TriggerCelebration';
import useBaggerBombBattleV4 from '../hooks/useBaggerBombBattleV4';

/**
 * BaggerBombBattleViewConnectedV4 - Connected wrapper for V4 battles
 */
export default function BaggerBombBattleViewConnectedV4({
  battleId,
  userId,
  onBack,
}) {
  const {
    battle,
    loading,
    error,
    player,
    opponent,
    currentTradingDay,
    totalTradingDays,
    freeAgents,
    nextRotationAt,
    rotationCountdown,
    swapsRemaining,
    swapModalState,
    isSwapExecuting,
    handleSwapRequest,
    closeSwapModal,
    executeSwap,
    closedTrades,
    events,
    currentPrices,
    openPrices,
    thresholds,
    activeTrigger,
    chainCount,
    cumulativePoints,
    clearTrigger,
  } = useBaggerBombBattleV4(battleId, userId);

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
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>{'⚠️'}</div>
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
        events={events}
        onBack={onBack}
        nightMode={false}
        thresholds={thresholds}
        currentPrices={currentPrices}
        // V4 props
        battleVersion={4}
        freeAgents={freeAgents}
        nextRotationAt={nextRotationAt}
        startingPrices={openPrices}
        swapsRemaining={swapsRemaining}
        onSwapRequest={handleSwapRequest}
        currentDay={currentTradingDay}
        totalDays={totalTradingDays}
        rotationCountdown={rotationCountdown}
        closedTrades={closedTrades}
        swapModalState={swapModalState}
        onCloseSwapModal={closeSwapModal}
        onConfirmSwap={executeSwap}
        isSwapExecuting={isSwapExecuting}
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

BaggerBombBattleViewConnectedV4.propTypes = {
  /** Firebase battle document ID */
  battleId: PropTypes.string.isRequired,
  /** Current user's odUserId */
  userId: PropTypes.string.isRequired,
  /** Callback when back button is pressed */
  onBack: PropTypes.func,
};

BaggerBombBattleViewConnectedV4.defaultProps = {
  onBack: () => {},
};
