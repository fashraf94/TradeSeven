// BaggerBombBattleViewConnectedV4 - V4 data-connected wrapper
// Connects BaggerBombBattleView to real Firebase data via useBaggerBombBattleV4 hook
// Features: Free agent rotation, swap modal, closed trades, multi-day battles

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../constants/holoTheme';
import BaggerBombBattleView from './BaggerBombBattleView';
import TriggerCelebration from '../components/BaggerBomb/TriggerCelebration';
import useBaggerBombBattleV4 from '../hooks/useBaggerBombBattleV4';
import { useWebSocketPrices } from '../hooks/useWebSocketPrices';

/**
 * BaggerBombBattleViewConnectedV4 - Connected wrapper for V4 battles
 */
export default function BaggerBombBattleViewConnectedV4({
  battleId,
  userId,
  onBack,
}) {
  // WebSocket real-time prices (called unconditionally before battle hook)
  const [wsSymbols, setWsSymbols] = useState([]);
  const { prices: wsPrices, status: wsStatus } = useWebSocketPrices(wsSymbols);

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
  } = useBaggerBombBattleV4(battleId, userId, { realtimePrices: wsPrices });

  // Extract symbols from battle data for WebSocket subscription
  useEffect(() => {
    if (!player && !opponent) return;
    const allAssets = [
      ...(player?.assets || []),
      ...(opponent?.assets || []),
    ];
    const symbols = [...new Set(allAssets.map(a => a?.symbol).filter(Boolean))];
    setWsSymbols(prev => {
      if (prev.length === symbols.length && prev.every((s, i) => s === symbols[i])) return prev;
      return symbols;
    });
  }, [player, opponent]);

  // Multi-step swap mode state (matches training view pattern)
  const [swapMode, setSwapMode] = useState({
    active: false,
    selectedFreeAgent: null,
    step: 'idle',
    targetAsset: null,
  });

  const enterSwapMode = useCallback(() => {
    if (swapsRemaining <= 0) return;
    setSwapMode({ active: true, selectedFreeAgent: null, step: 'selectAgent', targetAsset: null });
  }, [swapsRemaining]);

  const selectFreeAgent = useCallback((agent) => {
    setSwapMode(prev => ({ ...prev, selectedFreeAgent: agent, step: 'selectTarget' }));
  }, []);

  const selectSwapTarget = useCallback((asset, tier, slotIndex) => {
    if (swapMode.selectedFreeAgent?.isCrypto && !asset.isCrypto) return;
    if (!swapMode.selectedFreeAgent?.isCrypto && asset.isCrypto) return;
    setSwapMode(prev => ({
      ...prev,
      targetAsset: { symbol: asset.symbol, name: asset.name, tier, slotIndex, isCrypto: asset.isCrypto },
      step: 'confirming',
    }));
  }, [swapMode.selectedFreeAgent]);

  const cancelSwapMode = useCallback(() => {
    setSwapMode({ active: false, selectedFreeAgent: null, step: 'idle', targetAsset: null });
  }, []);

  const confirmSwap = useCallback(async () => {
    if (!swapMode.targetAsset || !swapMode.selectedFreeAgent) return;
    try {
      await executeSwap({
        outTier: swapMode.targetAsset.tier,
        outSlotIndex: swapMode.targetAsset.slotIndex,
        inSymbol: swapMode.selectedFreeAgent.symbol,
      });
      cancelSwapMode();
    } catch (err) {
      console.error('[V4 PvP] Swap confirm error:', err);
    }
  }, [swapMode, executeSwap, cancelSwapMode]);

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
        openPrices={openPrices}
        wsStatus={wsStatus}
        battleVersion={4}
        freeAgentConfig={{
          freeAgents,
          nextRotationAt,
          freeAgentDailyOpens: {},
          swapsRemaining,
          currentDay: currentTradingDay,
          totalDays: totalTradingDays,
          rotationCountdown,
          swapMode,
          onEnterSwapMode: enterSwapMode,
          onSelectFreeAgent: selectFreeAgent,
          onCancelSwapMode: cancelSwapMode,
        }}
        closedTrades={closedTrades}
        onSelectSwapTarget={selectSwapTarget}
        onConfirmSwap={confirmSwap}
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
