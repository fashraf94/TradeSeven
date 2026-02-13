// useBaggerBombBattleV3 - Enhanced hook for tier-based BaggerBomb battles
// Adds history tracking, threshold crossing detection, and event logging

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { stockAPI, POPULAR_CRYPTO } from '../services/eodhdAPI';
import {
  addBaggerBombEvent,
  updateAssetHistoryInBattle,
} from '../firebase/firebaseService';
import {
  updateAssetHistory,
  detectThresholdCross,
  getBadgesFromHistory,
  calculatePoints,
  getCurrentSession,
  getCurrentSessionId,
  getSessionTimeRemaining,
  formatTimeRemaining,
  getSessionStatuses,
  flattenPortfolio,
  createThresholdEvent,
  calculateAssetScoreV3,
  getHistoryUpdateIfChanged,
  SESSION_CONFIG,
  SESSION_ORDER,
  THRESHOLD_POINTS,
} from '../utils/baggerBombUtils';

// ==================== CONSTANTS ====================

const PRICE_POLL_INTERVAL = 60000; // 60 seconds

const isCrypto = (symbol) => {
  const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI', 'XRP', 'DOGE', 'SHIB', 'LTC', 'AAVE', 'ATOM', 'ALGO', 'XLM'];
  return cryptoSymbols.includes(symbol) || symbol?.endsWith('-USD') || POPULAR_CRYPTO.some(c => c.symbol === symbol);
};

// ==================== THE HOOK ====================

export function useBaggerBombBattleV3(battleId, userId, options = {}) {
  const { onThresholdCross } = options;

  // State
  const [battle, setBattle] = useState(null);
  const [currentPrices, setCurrentPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Local history tracking (for real-time updates before Firebase sync)
  const [localHistory, setLocalHistory] = useState({});
  const [localOppHistory, setLocalOppHistory] = useState({});
  const prevMultipliersRef = useRef({});

  // Chain trigger system for staggered celebrations
  const [triggerQueue, setTriggerQueue] = useState([]);
  const [activeTrigger, setActiveTrigger] = useState(null);
  const [chainCount, setChainCount] = useState(0);
  const [cumulativePoints, setCumulativePoints] = useState(0);
  const chainTimeoutRef = useRef(null);
  const CHAIN_WINDOW_MS = 500; // Triggers within 500ms are part of the same chain
  const TRIGGER_DISPLAY_MS = 800; // How long each trigger displays

  // Session state
  const [currentSessionKey, setCurrentSessionKey] = useState(getCurrentSession());
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(getSessionTimeRemaining());

  // Derived state
  const isCreator = useMemo(() => {
    if (!battle || !userId) return true;
    const creatorId = battle?.creator?.odUserId || battle?.creator?.uid;
    return creatorId === userId;
  }, [battle, userId]);

  const myData = isCreator ? battle?.creator : battle?.opponent;
  const oppData = isCreator ? battle?.opponent : battle?.creator;

  // Get portfolios in flat format for price fetching
  const myPortfolioFlat = useMemo(() => flattenPortfolio(myData?.portfolio), [myData?.portfolio]);
  const oppPortfolioFlat = useMemo(() => flattenPortfolio(oppData?.portfolio), [oppData?.portfolio]);

  // Get open prices for current session
  const currentSessionId = getCurrentSessionId();
  const openPrices = useMemo(() => {
    // Get all potential price sources
    const currentSessionPrices = currentSessionId
      ? battle?.sessionPrices?.[currentSessionId]?.open
      : null;
    const startingPrices = battle?.state?.startingPrices;
    const morningBellPrices = battle?.sessionPrices?.MORNING_BELL?.open;

    // Check if objects actually have data (not just exist but are empty)
    const hasCurrentSessionPrices = currentSessionPrices && Object.keys(currentSessionPrices).length > 0;
    const hasStartingPrices = startingPrices && Object.keys(startingPrices).length > 0;
    const hasMorningBellPrices = morningBellPrices && Object.keys(morningBellPrices).length > 0;

    const prices = hasCurrentSessionPrices ? currentSessionPrices
      : hasStartingPrices ? startingPrices
      : hasMorningBellPrices ? morningBellPrices
      : {};

    return prices;
  }, [battle, currentSessionId]);

  // Combine battle history with local updates
  const combinedHistory = useMemo(() => {
    const battleHistory = isCreator ? battle?.creator?.history : battle?.opponent?.history;
    return { ...battleHistory, ...localHistory };
  }, [battle, isCreator, localHistory]);

  // Calculate scores with history
  const calculateScores = useCallback((portfolio, prices, openPrices, history) => {
    if (!portfolio || portfolio.length === 0) {
      return { totalScore: 0, sessionScore: 0, assetScores: [], baggerBombs: 0, busts: 0 };
    }

    let totalBonusPoints = 0;
    let totalBasePoints = 0;
    let baggerBombs = 0;
    let busts = 0;
    const assetScores = [];

    portfolio.forEach((asset) => {
      if (!asset) return;

      const openPrice = openPrices[asset.symbol] || asset.price || 0;
      const currentPrice = prices[asset.symbol] || openPrice;

      // Resolve baseATR: prefer API-computed battle threshold over asset's stored value
      // (asset.baseATR may be a stale sector default from portfolio builder)
      const resolvedBaseATR = battle?.thresholds?.[asset.symbol]?.threshold || asset.baseATR || 2.5;

      if (!openPrice || openPrice === 0) {
        assetScores.push({
          symbol: asset.symbol,
          priceChange: 0,
          multiplier: 0,
          baseATR: resolvedBaseATR,
          basePoints: 0,
          bonusPoints: 0,
          totalPoints: 0,
          badges: [],
          history: { maxMultiplier: 0, minMultiplier: 0 },
        });
        return;
      }

      const priceChange = ((currentPrice - openPrice) / openPrice) * 100;
      const assetHistory = history[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };

      const score = calculateAssetScoreV3({ ...asset, baseATR: resolvedBaseATR }, priceChange, assetHistory);
      assetScores.push(score);

      totalBasePoints += score.basePoints;
      totalBonusPoints += score.bonusPoints;

      // Count badges
      score.badges.forEach((badge) => {
        if (['bagger', 'doubleBagger', 'tenBagger'].includes(badge)) baggerBombs++;
        if (['bust', 'crash', 'meltdown'].includes(badge)) busts++;
      });
    });

    return {
      totalScore: Math.round(totalBasePoints + totalBonusPoints),
      sessionScore: Math.round(totalBasePoints + totalBonusPoints),
      assetScores,
      baggerBombs,
      busts,
    };
  }, []);

  // My scores
  const myScores = useMemo(() => {
    return calculateScores(myPortfolioFlat, currentPrices, openPrices, combinedHistory);
  }, [myPortfolioFlat, currentPrices, openPrices, combinedHistory, calculateScores]);

  // Opponent scores — combine Firebase history with local opponent history
  // (mirrors combinedHistory pattern for own data, ensuring opponent badges
  // persist even before Firebase snapshot round-trips back)
  const oppHistory = useMemo(() => {
    const battleOppHistory = isCreator ? battle?.opponent?.history : battle?.creator?.history;
    return { ...battleOppHistory, ...localOppHistory };
  }, [battle, isCreator, localOppHistory]);

  const oppScores = useMemo(() => {
    return calculateScores(oppPortfolioFlat, currentPrices, openPrices, oppHistory || {});
  }, [oppPortfolioFlat, currentPrices, openPrices, oppHistory, calculateScores]);

  // Add completed session scores
  const myTotalScore = useMemo(() => {
    let total = myScores.sessionScore;
    const completedSessions = battle?.state?.completedSessions || [];
    const sessionScores = battle?.sessionScores || {};

    completedSessions.forEach((sessionId) => {
      const score = sessionScores[sessionId]?.[isCreator ? 'creator' : 'opponent'] || 0;
      total += score;
    });

    return Math.round(total);
  }, [myScores, battle, isCreator]);

  const oppTotalScore = useMemo(() => {
    let total = oppScores.sessionScore;
    const completedSessions = battle?.state?.completedSessions || [];
    const sessionScores = battle?.sessionScores || {};

    completedSessions.forEach((sessionId) => {
      const score = sessionScores[sessionId]?.[isCreator ? 'opponent' : 'creator'] || 0;
      total += score;
    });

    return Math.round(total);
  }, [oppScores, battle, isCreator]);

  // Build player/opponent objects for BattleHeader
  const player = useMemo(() => ({
    id: myData?.uid,
    username: myData?.username || 'You',
    avatar: myData?.avatar,
    totalPoints: myTotalScore,
    sessionPoints: myScores.sessionScore,
    baggerBombs: myScores.baggerBombs,
    busts: myScores.busts,
    portfolio: myData?.portfolio,
    bench: myData?.bench,
  }), [myData, myTotalScore, myScores]);

  const opponent = useMemo(() => ({
    id: oppData?.uid,
    username: oppData?.username || 'Opponent',
    avatar: oppData?.avatar,
    totalPoints: oppTotalScore,
    sessionPoints: oppScores.sessionScore,
    baggerBombs: oppScores.baggerBombs,
    busts: oppScores.busts,
    portfolio: oppData?.portfolio,
    bench: oppData?.bench,
  }), [oppData, oppTotalScore, oppScores]);

  // Session statuses for SessionHUD
  const sessionStatuses = useMemo(() => {
    return getSessionStatuses(currentSessionKey, battle?.state?.completedSessions || []);
  }, [currentSessionKey, battle?.state?.completedSessions]);

  // Process trigger queue with staggered timing
  useEffect(() => {
    if (triggerQueue.length === 0 || activeTrigger) return;

    // Pop first trigger from queue
    const [nextTrigger, ...remaining] = triggerQueue;
    setTriggerQueue(remaining);
    setActiveTrigger(nextTrigger);
    setChainCount((prev) => prev + 1);
    setCumulativePoints((prev) => prev + nextTrigger.points);

    // Fire callback for each trigger in chain
    if (onThresholdCross) {
      onThresholdCross(
        nextTrigger.name,
        nextTrigger.symbol,
        nextTrigger.points,
        nextTrigger.event
      );
    }

    // Auto-clear after display duration (stagger for chain effect)
    const displayTime = TRIGGER_DISPLAY_MS + (remaining.length > 0 ? 150 : 0);
    setTimeout(() => {
      setActiveTrigger(null);
    }, displayTime);
  }, [triggerQueue, activeTrigger, onThresholdCross]);

  // Reset chain count when queue is empty and no active trigger
  useEffect(() => {
    if (triggerQueue.length === 0 && !activeTrigger && chainCount > 0) {
      // Wait a bit after last trigger, then reset chain
      const resetTimeout = setTimeout(() => {
        setChainCount(0);
        setCumulativePoints(0);
      }, 1000);
      return () => clearTimeout(resetTimeout);
    }
  }, [triggerQueue.length, activeTrigger, chainCount]);

  // Queue a new trigger (batches triggers within CHAIN_WINDOW_MS)
  const queueTrigger = useCallback((trigger) => {
    // Clear any pending chain timeout
    if (chainTimeoutRef.current) {
      clearTimeout(chainTimeoutRef.current);
    }

    setTriggerQueue((prev) => [...prev, trigger]);

    // Set new chain timeout - if no new triggers arrive within CHAIN_WINDOW_MS,
    // the chain is complete and will process
    chainTimeoutRef.current = setTimeout(() => {
      chainTimeoutRef.current = null;
    }, CHAIN_WINDOW_MS);
  }, []);

  // Detect threshold crossings when prices update
  useEffect(() => {
    if (!currentPrices || Object.keys(currentPrices).length === 0) return;
    if (!battle || !battleId) return;

    myPortfolioFlat.forEach((asset) => {
      if (!asset) return;

      const openPrice = openPrices[asset.symbol];
      const currentPrice = currentPrices[asset.symbol];
      if (!openPrice || !currentPrice) return;

      const priceChange = ((currentPrice - openPrice) / openPrice) * 100;
      const baseATR = battle?.thresholds?.[asset.symbol]?.threshold || asset.baseATR || 2.5;
      const currentMultiplier = priceChange / baseATR;

      const prevMultiplier = prevMultipliersRef.current[asset.symbol] || 0;
      const assetHistory = combinedHistory[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };

      // Check for threshold crossings
      const crossed = detectThresholdCross(prevMultiplier, currentMultiplier);
      if (crossed) {
        crossed.forEach((threshold) => {
          // Only trigger if not already earned
          const existingBadges = getBadgesFromHistory(assetHistory);
          if (!existingBadges.includes(threshold.name)) {
            console.log(`🎯 Threshold crossed: ${asset.symbol} → ${threshold.name}`);

            // Update local history
            const newHistory = updateAssetHistory(asset.symbol, currentMultiplier, assetHistory);
            setLocalHistory((prev) => ({
              ...prev,
              [asset.symbol]: newHistory,
            }));

            // Create event
            const event = createThresholdEvent(
              'player',
              asset.symbol,
              threshold.name,
              currentMultiplier,
              threshold.points
            );

            // Queue trigger for staggered chain animation
            queueTrigger({
              name: threshold.name,
              symbol: asset.symbol,
              points: threshold.points,
              event,
            });

            // Persist to Firebase (async, don't await)
            if (battleId && !battleId.startsWith('training_')) {
              addBaggerBombEvent(battleId, event).catch(console.error);
              updateAssetHistoryInBattle(battleId, isCreator, asset.symbol, newHistory).catch(console.error);
            }
          }
        });
      }

      // Update prev multiplier ref
      prevMultipliersRef.current[asset.symbol] = currentMultiplier;
    });
  }, [currentPrices, openPrices, myPortfolioFlat, battle, battleId, isCreator, combinedHistory, queueTrigger]);

  // Continuous history tracking — ensures maxMultiplier/minMultiplier are always
  // recorded for BOTH player and opponent portfolios on every price poll.
  // This is the core persistence fix: even if the threshold-crossing event was missed
  // (e.g., client offline), peaks are recorded whenever any client is running.
  // Writes to Firebase only when values actually change (getHistoryUpdateIfChanged
  // returns null when no update is needed), minimizing write costs.
  useEffect(() => {
    if (!currentPrices || Object.keys(currentPrices).length === 0) return;
    if (!battle || !battleId || battleId.startsWith('training_')) return;

    const processPortfolio = (portfolioFlat, existingHistory, setHistoryFn, isOwnPortfolio) => {
      portfolioFlat.forEach((asset) => {
        if (!asset) return;

        const openPrice = openPrices[asset.symbol];
        const currentPrice = currentPrices[asset.symbol];
        if (!openPrice || !currentPrice) return;

        const priceChange = ((currentPrice - openPrice) / openPrice) * 100;
        const baseATR = battle?.thresholds?.[asset.symbol]?.threshold || asset.baseATR || 2.5;
        const currentMultiplier = priceChange / baseATR;

        const assetHistory = existingHistory[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };
        const updatedHistory = getHistoryUpdateIfChanged(currentMultiplier, assetHistory);

        if (updatedHistory) {
          // Update local state immediately (provides instant UI feedback)
          setHistoryFn((prev) => ({
            ...prev,
            [asset.symbol]: updatedHistory,
          }));

          // Persist to Firebase — use isCreator for own portfolio, !isCreator for opponent
          const isCreatorForField = isOwnPortfolio ? isCreator : !isCreator;
          updateAssetHistoryInBattle(battleId, isCreatorForField, asset.symbol, updatedHistory)
            .catch(console.error);
        }
      });
    };

    // Track own portfolio history
    processPortfolio(myPortfolioFlat, combinedHistory, setLocalHistory, true);

    // Track opponent portfolio history (redundant recording — if opponent's client
    // is offline, this client still records their peaks)
    processPortfolio(oppPortfolioFlat, oppHistory, setLocalOppHistory, false);
  }, [currentPrices, openPrices, myPortfolioFlat, oppPortfolioFlat, battle, battleId, isCreator, combinedHistory, oppHistory]);

  // Fetch prices — uses frozen close prices from Firebase when a session has ended,
  // ensuring both players see identical scores for completed sessions
  const fetchPrices = useCallback(async () => {
    const allAssets = [...myPortfolioFlat, ...oppPortfolioFlat].filter(Boolean);
    if (allAssets.length === 0) return;

    // Check if we can use frozen close prices from Firebase instead of live EODHD data
    const sessionId = getCurrentSessionId();
    let frozenPrices = null;

    if (sessionId && sessionId !== '') {
      // We're in a named session — check if it already has close prices (session ended)
      const closePrices = battle?.sessionPrices?.[sessionId]?.close;
      if (closePrices && Object.keys(closePrices).length > 0) {
        frozenPrices = closePrices;
        console.log(`[BaggerBomb] Using frozen close prices from session: ${sessionId}`);
      }
    } else {
      // Outside all sessions (before 9:30 AM or after 8 PM ET) —
      // find the most recent completed session with close prices
      const sessionSearchOrder = ['NIGHT_GAME', 'POWER_HOUR', 'MIDDAY', 'MORNING_BELL'];
      for (const sid of sessionSearchOrder) {
        const closePrices = battle?.sessionPrices?.[sid]?.close;
        if (closePrices && Object.keys(closePrices).length > 0) {
          frozenPrices = closePrices;
          console.log(`[BaggerBomb] Using frozen close prices from last completed session: ${sid}`);
          break;
        }
      }
    }

    if (frozenPrices) {
      // Use frozen prices — both players read the same Firebase data, so scores match
      setCurrentPrices((prev) => ({ ...prev, ...frozenPrices }));
      return;
    }

    // No frozen prices available — active session, live fetch from EODHD
    try {
      const allSymbols = [...new Set(allAssets.map((a) => a.symbol))];
      const stockSymbols = allSymbols.filter((s) => !isCrypto(s));
      const cryptoSymbols = allSymbols.filter((s) => isCrypto(s));

      const newPrices = {};

      // Fetch stock prices
      for (const symbol of stockSymbols) {
        try {
          const data = await stockAPI.getStockPrice(symbol);
          if (data?.price) {
            newPrices[symbol] = data.price;
          }
        } catch (err) {
          console.warn(`Failed to fetch price for ${symbol}:`, err);
        }
      }

      // Fetch crypto prices
      for (const symbol of cryptoSymbols) {
        try {
          const data = await stockAPI.getCryptoPrice(symbol);
          if (data?.price) {
            newPrices[symbol] = data.price;
          }
        } catch (err) {
          console.warn(`Failed to fetch crypto price for ${symbol}:`, err);
        }
      }

      if (Object.keys(newPrices).length > 0) {
        setCurrentPrices((prev) => ({ ...prev, ...newPrices }));
      }
    } catch (err) {
      console.error('Error fetching prices:', err);
      // Use starting prices as fallback
      if (battle?.state?.startingPrices) {
        setCurrentPrices(battle.state.startingPrices);
      }
    }
  }, [myPortfolioFlat, oppPortfolioFlat, battle]);

  // Subscribe to battle document
  useEffect(() => {
    if (!battleId) {
      setLoading(false);
      return;
    }

    // Training battles don't need Firebase subscription
    if (battleId.startsWith('training_')) {
      setLoading(false);
      return;
    }

    try {
      const battleRef = doc(db, 'battles', battleId);
      const unsubscribe = onSnapshot(
        battleRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setBattle({ id: snapshot.id, ...snapshot.data() });
            setLoading(false);
          } else {
            setError('Battle not found');
            setLoading(false);
          }
        },
        (err) => {
          console.error('Battle subscription error:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up battle subscription:', err);
      setLoading(false);
    }
  }, [battleId]);

  // Fetch prices on mount and interval
  // Only poll during active session hours; outside sessions, fetch once to load frozen prices
  useEffect(() => {
    if (myPortfolioFlat.length === 0 && oppPortfolioFlat.length === 0) return;

    // Always fetch once (loads frozen prices if outside sessions, or live prices if inside)
    fetchPrices();

    // Only set up polling interval during session hours (weekdays 9:30 AM - 8:00 PM ET)
    // Uses toLocaleString for DST accuracy instead of hardcoded UTC-5
    const nowETString = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const nowET = new Date(nowETString);
    const day = nowET.getDay();
    const timeDecimal = nowET.getHours() + nowET.getMinutes() / 60;
    const isInsideSessionHours = day >= 1 && day <= 5 && timeDecimal >= 9.5 && timeDecimal < 20;

    if (!isInsideSessionHours) {
      console.log('[BaggerBomb] Outside session hours — polling disabled, using frozen prices');
      return;
    }

    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices, myPortfolioFlat.length, oppPortfolioFlat.length]);

  // Update session timer
  useEffect(() => {
    const updateSession = () => {
      setCurrentSessionKey(getCurrentSession());
      setSessionTimeRemaining(getSessionTimeRemaining());
    };

    updateSession();
    const interval = setInterval(updateSession, 1000);
    return () => clearInterval(interval);
  }, []);

  // Build asset data for TacticalRow
  const buildTacticalAsset = useCallback((asset, scores, history) => {
    if (!asset) return null;

    const scoreData = scores.assetScores.find((s) => s.symbol === asset.symbol);
    const assetHistory = history[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };

    return {
      symbol: asset.symbol,
      name: asset.name,
      priceChange: scoreData?.priceChange || 0,
      baseATR: asset.baseATR || scoreData?.baseATR || 2.5,
      history: assetHistory,
      points: scoreData?.totalPoints || 0,
      badges: scoreData?.badges || getBadgesFromHistory(assetHistory),
      isCrypto: asset.isCrypto,
      tierMultiplier: scoreData?.tierMultiplier || 1.0,
    };
  }, []);

  // Build portfolio data for TacticalRow
  const playerPortfolio = useMemo(() => {
    const portfolio = myData?.portfolio;
    if (!portfolio) return { star: [], core: [], support: [] };

    return {
      star: (portfolio.star || []).map((a) => buildTacticalAsset(a, myScores, combinedHistory)),
      core: (portfolio.core || []).map((a) => buildTacticalAsset(a, myScores, combinedHistory)),
      support: (portfolio.support || []).map((a) => buildTacticalAsset(a, myScores, combinedHistory)),
    };
  }, [myData?.portfolio, myScores, combinedHistory, buildTacticalAsset]);

  const opponentPortfolio = useMemo(() => {
    const portfolio = oppData?.portfolio;
    if (!portfolio) return { star: [], core: [], support: [] };

    return {
      star: (portfolio.star || []).map((a) => buildTacticalAsset(a, oppScores, oppHistory || {})),
      core: (portfolio.core || []).map((a) => buildTacticalAsset(a, oppScores, oppHistory || {})),
      support: (portfolio.support || []).map((a) => buildTacticalAsset(a, oppScores, oppHistory || {})),
    };
  }, [oppData?.portfolio, oppScores, oppHistory, buildTacticalAsset]);

  // Build bench data
  const playerBench = useMemo(() => {
    const bench = myData?.bench;
    if (!bench) return { stocks: [], crypto: null };

    return {
      stocks: (bench.stocks || []).map((a) => buildTacticalAsset(a, myScores, combinedHistory)),
      crypto: bench.crypto ? buildTacticalAsset(bench.crypto, myScores, combinedHistory) : null,
    };
  }, [myData?.bench, myScores, combinedHistory, buildTacticalAsset]);

  const opponentBench = useMemo(() => {
    const bench = oppData?.bench;
    if (!bench) return { stocks: [], crypto: null };

    return {
      stocks: (bench.stocks || []).map((a) => buildTacticalAsset(a, oppScores, oppHistory || {})),
      crypto: bench.crypto ? buildTacticalAsset(bench.crypto, oppScores, oppHistory || {}) : null,
    };
  }, [oppData?.bench, oppScores, oppHistory, buildTacticalAsset]);

  return {
    // Battle data
    battle,
    loading,
    error,

    // User context
    isCreator,

    // Player/Opponent for BattleHeader
    player: {
      ...player,
      portfolio: playerPortfolio,
      bench: playerBench,
    },
    opponent: {
      ...opponent,
      portfolio: opponentPortfolio,
      bench: opponentBench,
    },

    // Session
    currentSession: currentSessionKey,
    currentSessionId: getCurrentSessionId(),
    sessionTimeRemaining,
    sessionStatuses,
    completedSessions: battle?.state?.completedSessions || [],

    // Session scores for SessionHUD
    sessionScores: battle?.sessionScores || {},

    // Events for EventFeed
    events: battle?.events || [],

    // Prices
    currentPrices,
    openPrices,
    thresholds: battle?.thresholds || {},

    // Actions
    refreshPrices: fetchPrices,

    // Trigger celebration state (for TriggerCelebration component)
    activeTrigger,
    chainCount,
    cumulativePoints,
    clearTrigger: () => setActiveTrigger(null),

    // Formatting helpers
    formatTimeRemaining: () => formatTimeRemaining(sessionTimeRemaining),
  };
}

export default useBaggerBombBattleV3;
