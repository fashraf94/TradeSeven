// BaggerBombBattleView - Complete battle view for BaggerBomb Scoring battles
// Combines all BaggerBomb scoring components into a cohesive battle experience

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// BaggerBomb Components
import BaggerBombScoreboard from './BaggerBombScoreboard';
import BreakoutFeed from './BreakoutFeed';
import AssetPerformanceRow from './AssetPerformanceRow';
import SubstitutionPanel from './SubstitutionPanel';

// Services
import { getCurrentSession, getSessionTimeRemaining, SESSIONS } from '../../services/sessionScoringService';
import { checkPortfolioBreakouts } from '../../services/breakoutDetectionService';
import { getCurrentSubstitutionWindow, getRemainingSubstitutions } from '../../services/substitutionService';
import { getMultipleStockPrices, getMultipleCryptoPrices } from '../../services/eodhdAPI';
import { isCrypto } from '../../services/sessionScoringService';

// Price polling interval (60 seconds)
const PRICE_POLL_INTERVAL = 60000;

/**
 * BaggerBombBattleView
 * Complete battle view for BaggerBomb Scoring battles
 *
 * @param {Object} props
 * @param {Object} props.battle - Battle document from Firestore
 * @param {Object} props.user - Current user object
 * @param {Function} props.onSubstitute - Callback for substitution actions
 * @param {Function} props.onBack - Callback to go back
 */
export default function BaggerBombBattleView({
  battle,
  user,
  onSubstitute,
  onBack
}) {
  // Determine if user is creator or opponent
  const isCreator = battle?.creator?.uid === user?.uid ||
                    battle?.creator?.uid === user?.odUserId ||
                    battle?.creator?.username === user?.username;
  const playerKey = isCreator ? 'creator' : 'opponent';
  const opponentKey = isCreator ? 'opponent' : 'creator';

  // State
  const [activeTab, setActiveTab] = useState('yours'); // 'yours' or 'opponent'
  const [currentPrices, setCurrentPrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [detectedBreakouts, setDetectedBreakouts] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Get player data
  const yourData = isCreator ? battle.creator : battle.opponent;
  const opponentData = isCreator ? battle.opponent : battle.creator;

  // Get current session info
  const currentSession = useMemo(() => getCurrentSession(), []);
  const sessionInfo = currentSession ? SESSIONS[currentSession.id] : null;

  // Get substitution window info
  const subWindow = useMemo(() => getCurrentSubstitutionWindow(), []);
  const remainingSubs = useMemo(() =>
    getRemainingSubstitutions(battle, playerKey),
    [battle, playerKey]
  );

  // Collect all symbols for price fetching
  const allSymbols = useMemo(() => {
    const symbols = new Set();

    // Creator's assets
    battle.creator?.portfolio?.forEach(a => symbols.add(a.symbol));
    battle.creator?.bench?.forEach(a => symbols.add(a.symbol));

    // Opponent's assets
    battle.opponent?.portfolio?.forEach(a => symbols.add(a.symbol));
    battle.opponent?.bench?.forEach(a => symbols.add(a.symbol));

    return Array.from(symbols);
  }, [battle]);

  // Separate stock and crypto symbols
  const stockSymbols = useMemo(() =>
    allSymbols.filter(s => !isCrypto(s)),
    [allSymbols]
  );
  const cryptoSymbols = useMemo(() =>
    allSymbols.filter(s => isCrypto(s)),
    [allSymbols]
  );

  // Fetch current prices
  const fetchPrices = useCallback(async () => {
    try {
      const [stockPrices, cryptoPrices] = await Promise.all([
        stockSymbols.length > 0 ? getMultipleStockPrices(stockSymbols) : {},
        cryptoSymbols.length > 0 ? getMultipleCryptoPrices(cryptoSymbols) : {}
      ]);

      const prices = {};

      // Combine stock prices
      Object.entries(stockPrices).forEach(([symbol, data]) => {
        prices[symbol] = data.price || data;
      });

      // Combine crypto prices
      Object.entries(cryptoPrices).forEach(([symbol, data]) => {
        prices[symbol] = data.price || data;
      });

      setCurrentPrices(prices);
      setLoadingPrices(false);

      return prices;
    } catch (error) {
      console.error('[BaggerBombBattleView] Error fetching prices:', error);
      setLoadingPrices(false);
      return {};
    }
  }, [stockSymbols, cryptoSymbols]);

  // Check for breakouts
  const checkBreakouts = useCallback((prices) => {
    if (!battle.state?.currentSession || !prices) return;

    const sessionId = battle.state.currentSession;
    const sessionOpenPrices = battle.sessionPrices?.[sessionId]?.open || {};
    const thresholds = battle.thresholds || {};

    // Check your portfolio
    const yourPortfolio = yourData?.portfolio || [];
    const yourBreakouts = checkPortfolioBreakouts(
      yourPortfolio,
      sessionOpenPrices,
      prices,
      thresholds,
      battle.breakouts?.[playerKey] || [],
      sessionId
    );

    // Check opponent's portfolio
    const oppPortfolio = opponentData?.portfolio || [];
    const oppBreakouts = checkPortfolioBreakouts(
      oppPortfolio,
      sessionOpenPrices,
      prices,
      thresholds,
      battle.breakouts?.[opponentKey] || [],
      sessionId
    );

    // Combine and mark ownership
    const allBreakouts = [
      ...yourBreakouts.map(b => ({ ...b, isYours: true, playerId: playerKey })),
      ...oppBreakouts.map(b => ({ ...b, isYours: false, playerId: opponentKey }))
    ];

    if (allBreakouts.length > 0) {
      setDetectedBreakouts(prev => {
        // Avoid duplicates
        const existingIds = new Set(prev.map(b => `${b.symbol}-${b.type}-${b.sessionId}`));
        const newBreakouts = allBreakouts.filter(b =>
          !existingIds.has(`${b.symbol}-${b.type}-${b.sessionId}`)
        );
        return [...newBreakouts, ...prev].slice(0, 20);
      });
    }
  }, [battle, yourData, opponentData, playerKey, opponentKey]);

  // Price polling effect
  useEffect(() => {
    if (battle?.state?.status !== 'active') return;

    const poll = async () => {
      const session = getCurrentSession();
      if (!session) return; // Outside market hours

      const prices = await fetchPrices();
      checkBreakouts(prices);
    };

    // Initial fetch
    poll();

    // Set up interval
    const interval = setInterval(poll, PRICE_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [battle?.state?.status, fetchPrices, checkBreakouts]);

  // Update time remaining
  useEffect(() => {
    const updateTime = () => {
      const remaining = getSessionTimeRemaining();
      setTimeRemaining(remaining);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get session open prices for current session
  const sessionOpenPrices = useMemo(() => {
    const sessionId = battle.state?.currentSession;
    if (!sessionId) return {};
    return battle.sessionPrices?.[sessionId]?.open || {};
  }, [battle]);

  // Combine battle breakouts with detected ones
  const allBreakouts = useMemo(() => {
    const battleBreakouts = [
      ...(battle.breakouts?.[playerKey] || []).map(b => ({ ...b, isYours: true })),
      ...(battle.breakouts?.[opponentKey] || []).map(b => ({ ...b, isYours: false }))
    ];

    // Merge with locally detected, avoiding duplicates
    const ids = new Set(battleBreakouts.map(b => b.id));
    const combined = [
      ...battleBreakouts,
      ...detectedBreakouts.filter(b => !ids.has(b.id))
    ];

    return combined.sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  }, [battle.breakouts, playerKey, opponentKey, detectedBreakouts]);

  // Handle substitution
  const handleSubstitute = async (subData) => {
    if (onSubstitute) {
      await onSubstitute({
        ...subData,
        battleId: battle.id,
        playerId: playerKey
      });
    }
  };

  // Current portfolio to display
  const displayPortfolio = activeTab === 'yours'
    ? yourData?.portfolio
    : opponentData?.portfolio;

  const isActive = battle?.state?.status === 'active';
  const isCompleted = battle?.state?.status === 'completed';

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm">Back</span>
        </button>

        <div className="text-center">
          <div className="text-sm font-medium">TD Battle</div>
          <div className="text-xs text-muted-foreground">
            vs {opponentData?.username || 'Waiting...'}
          </div>
        </div>

        <div className="w-16" /> {/* Spacer for centering */}
      </div>

      {/* Main content - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Session indicator */}
          {isActive && currentSession && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30"
            >
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-cyan-500"
                />
                <span className="text-sm font-medium text-cyan-500">
                  {sessionInfo?.name || currentSession.id}
                </span>
              </div>
              {timeRemaining && (
                <span className="text-sm text-muted-foreground">
                  {timeRemaining.hours > 0 && `${timeRemaining.hours}h `}
                  {timeRemaining.minutes}m remaining
                </span>
              )}
            </motion.div>
          )}

          {/* Scoreboard */}
          <BaggerBombScoreboard
            battle={battle}
            currentUser={user}
          />

          {/* Substitution panel (only during sub windows) */}
          {isActive && subWindow && remainingSubs.total > 0 && (
            <SubstitutionPanel
              battle={battle}
              playerId={playerKey}
              currentPrices={currentPrices}
              onSubstitute={handleSubstitute}
            />
          )}

          {/* Portfolio tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('yours')}
              className={cn(
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'yours'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              Your Portfolio
            </button>
            <button
              onClick={() => setActiveTab('opponent')}
              className={cn(
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'opponent'
                  ? 'bg-muted text-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted/80'
              )}
            >
              Opponent
            </button>
          </div>

          {/* Asset performance list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {activeTab === 'yours' ? 'Your' : "Opponent's"} Assets
              </span>
              {loadingPrices && (
                <span className="text-xs text-muted-foreground">
                  Updating prices...
                </span>
              )}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: activeTab === 'yours' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: activeTab === 'yours' ? 20 : -20 }}
                className="space-y-2"
              >
                {displayPortfolio?.map((asset) => (
                  <AssetPerformanceRow
                    key={asset.symbol}
                    asset={asset}
                    currentPrice={currentPrices[asset.symbol] || asset.price}
                    sessionOpenPrice={sessionOpenPrices[asset.symbol] || asset.price}
                    threshold={battle.thresholds?.[asset.symbol]}
                    breakouts={allBreakouts.filter(b =>
                      b.symbol === asset.symbol &&
                      b.isYours === (activeTab === 'yours')
                    )}
                  />
                ))}

                {(!displayPortfolio || displayPortfolio.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No portfolio data available
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Breakout feed */}
          <div>
            <div className="text-sm font-medium mb-2">Recent Breakouts</div>
            <BreakoutFeed
              breakouts={allBreakouts}
              maxItems={5}
              currentUserId={user?.uid || user?.odUserId}
            />
          </div>

          {/* Battle info */}
          {isCompleted && (
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <div className="text-lg font-bold mb-1">Battle Complete</div>
              <div className="text-sm text-muted-foreground">
                Final results are shown above
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer with battle code */}
      <div className="px-4 py-2 border-t border-border text-center">
        <span className="text-xs text-muted-foreground">
          Battle Code: <span className="font-mono font-medium">{battle.challengeCode}</span>
        </span>
      </div>
    </div>
  );
}
