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
import useClashCast from '../hooks/useClashCast';
import { useWebSocketPrices } from '../hooks/useWebSocketPrices';
import { stockAPI } from '../services/eodhdAPI';

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
  // player.portfolio is tiered: { star: [...], core: [...], support: [...] }
  useEffect(() => {
    if (!player?.portfolio && !opponent?.portfolio) return;

    const flattenPortfolio = (p) => [
      ...(p?.star || []),
      ...(p?.core || []),
      ...(p?.support || []),
    ];

    const allAssets = [
      ...flattenPortfolio(player?.portfolio),
      ...flattenPortfolio(opponent?.portfolio),
    ];
    const symbols = [...new Set(allAssets.map(a => a?.symbol).filter(Boolean))].sort();

    setWsSymbols(prev => {
      if (prev.length === symbols.length && prev.every((s, i) => s === symbols[i])) return prev;
      return symbols;
    });
  }, [player?.portfolio, opponent?.portfolio]);

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

  // ClashCast AI commentary
  const clashCast = useClashCast(battleId, battle);

  // Compute enriched battle stats for ClashCast context
  const battleStats = useMemo(() => {
    const events = battle?.events || [];
    const pName = player?.username || 'Player 1';
    const oName = opponent?.username || 'Player 2';

    const isBagger = (e) => ['bagger', 'doublebagger', 'tenbagger', 'breakout', 'rally', 'moonshot']
      .some(t => (e.type || '').toLowerCase().includes(t) || (e.thresholdName || '').toLowerCase().includes(t));
    const isBust = (e) => ['bust', 'crash', 'meltdown']
      .some(t => (e.type || '').toLowerCase().includes(t) || (e.thresholdName || '').toLowerCase().includes(t));

    const allScoringEvents = events.filter(e => e.points != null && e.type !== 'swap' && e.type !== 'redzone');
    const biggestEvent = allScoringEvents.reduce((best, e) =>
      (Math.abs(e.points || 0) > Math.abs(best?.points || 0) ? e : best), null);

    return {
      creatorBaggerBombs: events.filter(e => e.playerName === pName && isBagger(e)).length,
      opponentBaggerBombs: events.filter(e => e.playerName === oName && isBagger(e)).length,
      creatorBusts: events.filter(e => e.playerName === pName && isBust(e)).length,
      opponentBusts: events.filter(e => e.playerName === oName && isBust(e)).length,
      totalEventCount: allScoringEvents.length,
      biggestEvent: biggestEvent ? {
        type: biggestEvent.thresholdName || biggestEvent.type,
        asset: biggestEvent.symbol,
        playerName: biggestEvent.playerName,
        points: biggestEvent.points,
      } : null,
    };
  }, [battle?.events, player?.username, opponent?.username]);

  // Feed ClashCast with battle state updates
  useEffect(() => {
    if (!battle || (battle.state?.status !== 'active' && battle.status !== 'active')) return;
    clashCast.processUpdate({
      creatorScore: player?.totalPoints || 0,
      opponentScore: opponent?.totalPoints || 0,
      creatorName: player?.username || 'Player 1',
      opponentName: opponent?.username || 'Player 2',
      currentSession: null, // V4 doesn't use sessions
      sessionTimeRemaining: null,
      sessionsCompleted: [],
      events: battle?.events || [],
      ...battleStats,
    });
  }, [player?.totalPoints, opponent?.totalPoints, battle?.events?.length]);

  // Build trigger object for TriggerCelebration
  const triggerForCelebration = useMemo(() => {
    if (!activeTrigger) return null;
    return {
      name: activeTrigger.name,
      symbol: activeTrigger.symbol,
      points: activeTrigger.points,
    };
  }, [activeTrigger]);

  // Fetch daily open prices for free agents (for price change display)
  const [freeAgentDailyOpens, setFreeAgentDailyOpens] = useState({});
  const freeAgentSymbolsKey = useMemo(
    () => (freeAgents || []).map(a => a.symbol).sort().join(','),
    [freeAgents]
  );

  useEffect(() => {
    if (!freeAgentSymbolsKey) return;
    let cancelled = false;
    const symbols = freeAgentSymbolsKey.split(',').filter(Boolean);

    const fetchDailyOpens = async () => {
      try {
        const priceData = await stockAPI.getMultipleStockPrices(symbols);
        if (cancelled) return;
        const opens = {};
        symbols.forEach(sym => {
          const data = priceData[sym] || priceData[sym.toUpperCase()];
          if (data?.previousClose) opens[sym] = data.previousClose;
        });
        setFreeAgentDailyOpens(opens);
      } catch (err) {
        // Silent — fallback to 0% change
      }
    };

    fetchDailyOpens();
    return () => { cancelled = true; };
  }, [freeAgentSymbolsKey]);

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
        getEventCommentary={clashCast.getEventCommentary}
        clashCastActive={clashCast.isActive}
        syntheticEvents={clashCast.syntheticEvents}
        freeAgentConfig={{
          freeAgents,
          nextRotationAt,
          freeAgentDailyOpens,
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
