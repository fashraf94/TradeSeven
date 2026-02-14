// useBaggerBombBattleV4 - V4 state management hook for BaggerBomb battles
// Removes: session state, bench data, session-aware scoring, frozen session prices
// Adds: free agent rotation, swap handling, closed trades, multi-day trading, dailyOpenPrices

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
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
  calculateAssetScoreV3,
  createThresholdEvent,
  getHistoryUpdateIfChanged,
  flattenPortfolio,
  THRESHOLD_POINTS,
} from '../utils/baggerBombUtils';
import { CONVICTION_MULTIPLIERS } from '../constants/baggerBombScoring';
import {
  getCurrentTradingDay,
  getDailySwapsRemaining,
  getFreeAgentConfig,
} from '../constants/battleTimingV4';
import {
  shouldRotate,
  getRotationCountdown,
  rotateFreeAgents,
} from '../services/freeAgentRotationService';
import {
  executeSwap as executeSwapService,
  getSwapStatus,
} from '../services/swapServiceV4';

// ==================== CONSTANTS ====================

const PRICE_POLL_INTERVAL = 60000; // 60 seconds
const ROTATION_CHECK_INTERVAL = 1000; // 1 second countdown

const isCrypto = (symbol) => {
  const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI', 'XRP', 'DOGE', 'SHIB', 'LTC', 'AAVE', 'ATOM', 'ALGO', 'XLM'];
  return cryptoSymbols.includes(symbol) || symbol?.endsWith('-USD') || POPULAR_CRYPTO.some(c => c.symbol === symbol);
};

// ==================== THE HOOK ====================

export function useBaggerBombBattleV4(battleId, userId, options = {}) {
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
  const prevOppMultipliersRef = useRef({});

  // Local events for EventFeed (both player + opponent)
  const [localEvents, setLocalEvents] = useState([]);

  // Chain trigger system for staggered celebrations
  const [triggerQueue, setTriggerQueue] = useState([]);
  const [activeTrigger, setActiveTrigger] = useState(null);
  const [chainCount, setChainCount] = useState(0);
  const [cumulativePoints, setCumulativePoints] = useState(0);
  const chainTimeoutRef = useRef(null);
  const CHAIN_WINDOW_MS = 500;
  const TRIGGER_DISPLAY_MS = 800;

  // Free agent rotation countdown
  const [rotationCountdown, setRotationCountdown] = useState(0);

  // Swap modal state
  const [swapModalState, setSwapModalState] = useState({
    isOpen: false,
    incomingSymbol: '',
    incomingName: '',
    incomingIsCrypto: false,
  });
  const [isSwapExecuting, setIsSwapExecuting] = useState(false);

  // Rotation lock to prevent double-rotation
  const rotationInProgressRef = useRef(false);

  // ==================== DERIVED STATE ====================

  const isCreator = useMemo(() => {
    if (!battle || !userId) return true;
    const creatorId = battle?.creator?.odUserId || battle?.creator?.uid;
    return creatorId === userId;
  }, [battle, userId]);

  const playerId = isCreator ? 'creator' : 'opponent';
  const myData = isCreator ? battle?.creator : battle?.opponent;
  const oppData = isCreator ? battle?.opponent : battle?.creator;

  // Current trading day
  const currentTradingDay = useMemo(() => {
    const dates = battle?.timing?.tradingDayDates;
    if (!dates || dates.length === 0) return 1;
    return getCurrentTradingDay(dates);
  }, [battle?.timing?.tradingDayDates]);

  const totalTradingDays = battle?.timing?.tradingDays || 3;

  // Get portfolios in flat format for price fetching (NO bench)
  const myPortfolioFlat = useMemo(() => flattenPortfolio(myData?.portfolio), [myData?.portfolio]);
  const oppPortfolioFlat = useMemo(() => flattenPortfolio(oppData?.portfolio), [oppData?.portfolio]);

  // Get open prices for current trading day
  const openPrices = useMemo(() => {
    // For V4: use dailyOpenPrices for current day
    const dayKey = `day${currentTradingDay}`;
    const dailyOpen = battle?.state?.dailyOpenPrices?.[dayKey];
    const startingPrices = battle?.state?.startingPrices;

    // Use daily open prices if available, otherwise fall back to starting prices
    const hasDailyOpen = dailyOpen && Object.keys(dailyOpen).length > 0;
    const hasStarting = startingPrices && Object.keys(startingPrices).length > 0;

    return hasDailyOpen ? dailyOpen : hasStarting ? startingPrices : currentPrices || {};
  }, [battle, currentTradingDay, currentPrices]);

  // Free agents data
  const freeAgents = useMemo(() => {
    return battle?.freeAgents?.current || [];
  }, [battle?.freeAgents?.current]);

  const nextRotationAt = battle?.freeAgents?.nextRotationAt;

  // Swaps remaining
  const swapsRemaining = useMemo(() => {
    if (!myData?.swaps?.remaining) return 3; // Default to max while data loads
    return getDailySwapsRemaining(myData.swaps, currentTradingDay);
  }, [myData?.swaps, currentTradingDay]);

  // Closed trades
  const closedTrades = useMemo(() => {
    return myData?.closedTrades || [];
  }, [myData?.closedTrades]);

  // Combine battle history with local updates
  const combinedHistory = useMemo(() => {
    const battleHistory = isCreator ? battle?.creator?.history : battle?.opponent?.history;
    return { ...battleHistory, ...localHistory };
  }, [battle, isCreator, localHistory]);

  const oppHistory = useMemo(() => {
    const battleOppHistory = isCreator ? battle?.opponent?.history : battle?.creator?.history;
    return { ...battleOppHistory, ...localOppHistory };
  }, [battle, isCreator, localOppHistory]);

  // ==================== SCORING ====================

  const calculateScores = useCallback((portfolio, prices, openPriceMap, history) => {
    if (!portfolio || portfolio.length === 0) {
      return { totalScore: 0, assetScores: [], baggerBombs: 0, busts: 0 };
    }

    let totalBasePoints = 0;
    let totalBonusPoints = 0;
    let baggerBombs = 0;
    let busts = 0;
    const assetScores = [];

    portfolio.forEach((asset) => {
      if (!asset) return;

      // For swapped-in assets, use swapPrice as the open price
      const assetOpenPrice = asset.swapPrice || openPriceMap[asset.symbol] || asset.price || 0;
      const currentPrice = prices[asset.symbol] || assetOpenPrice;

      if (!assetOpenPrice || assetOpenPrice === 0) {
        assetScores.push({
          symbol: asset.symbol,
          priceChange: 0,
          multiplier: 0,
          baseATR: asset.baseATR || 2.5,
          basePoints: 0,
          bonusPoints: 0,
          totalPoints: 0,
          badges: [],
          history: { maxMultiplier: 0, minMultiplier: 0 },
        });
        return;
      }

      const priceChange = ((currentPrice - assetOpenPrice) / assetOpenPrice) * 100;
      const assetHistory = history[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };

      const score = calculateAssetScoreV3(asset, priceChange, assetHistory);
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
      assetScores,
      baggerBombs,
      busts,
    };
  }, []);

  // My scores (continuous, no session accumulation)
  const myScores = useMemo(() => {
    return calculateScores(myPortfolioFlat, currentPrices, openPrices, combinedHistory);
  }, [myPortfolioFlat, currentPrices, openPrices, combinedHistory, calculateScores]);

  const oppScores = useMemo(() => {
    return calculateScores(oppPortfolioFlat, currentPrices, openPrices, oppHistory || {});
  }, [oppPortfolioFlat, currentPrices, openPrices, oppHistory, calculateScores]);

  // V4: Total score = current active score + locked closed trade points
  const closedTradePoints = useMemo(() => {
    return closedTrades.reduce((sum, t) => sum + (t.lockedPoints || 0), 0);
  }, [closedTrades]);

  const oppClosedTradePoints = useMemo(() => {
    const oppClosed = oppData?.closedTrades || [];
    return oppClosed.reduce((sum, t) => sum + (t.lockedPoints || 0), 0);
  }, [oppData?.closedTrades]);

  const myTotalScore = useMemo(() => {
    return Math.round(myScores.totalScore + closedTradePoints);
  }, [myScores.totalScore, closedTradePoints]);

  const oppTotalScore = useMemo(() => {
    return Math.round(oppScores.totalScore + oppClosedTradePoints);
  }, [oppScores.totalScore, oppClosedTradePoints]);

  // ==================== BUILD PLAYER/OPPONENT OBJECTS ====================

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

  const player = useMemo(() => ({
    id: myData?.uid,
    username: myData?.username || 'You',
    avatar: myData?.avatar,
    totalPoints: myTotalScore,
    baggerBombs: myScores.baggerBombs,
    busts: myScores.busts,
    portfolio: playerPortfolio,
  }), [myData, myTotalScore, myScores, playerPortfolio]);

  const opponent = useMemo(() => ({
    id: oppData?.uid,
    username: oppData?.username || 'Opponent',
    avatar: oppData?.avatar,
    totalPoints: oppTotalScore,
    baggerBombs: oppScores.baggerBombs,
    busts: oppScores.busts,
    portfolio: opponentPortfolio,
  }), [oppData, oppTotalScore, oppScores, opponentPortfolio]);

  // ==================== TRIGGER CHAIN SYSTEM ====================

  useEffect(() => {
    if (triggerQueue.length === 0 || activeTrigger) return;

    const [nextTrigger, ...remaining] = triggerQueue;
    setTriggerQueue(remaining);
    setActiveTrigger(nextTrigger);
    setChainCount((prev) => prev + 1);
    setCumulativePoints((prev) => prev + nextTrigger.points);

    if (onThresholdCross) {
      onThresholdCross(
        nextTrigger.name,
        nextTrigger.symbol,
        nextTrigger.points,
        nextTrigger.event
      );
    }

    const displayTime = TRIGGER_DISPLAY_MS + (remaining.length > 0 ? 150 : 0);
    setTimeout(() => {
      setActiveTrigger(null);
    }, displayTime);
  }, [triggerQueue, activeTrigger, onThresholdCross]);

  useEffect(() => {
    if (triggerQueue.length === 0 && !activeTrigger && chainCount > 0) {
      const resetTimeout = setTimeout(() => {
        setChainCount(0);
        setCumulativePoints(0);
      }, 1000);
      return () => clearTimeout(resetTimeout);
    }
  }, [triggerQueue.length, activeTrigger, chainCount]);

  const queueTrigger = useCallback((trigger) => {
    if (chainTimeoutRef.current) {
      clearTimeout(chainTimeoutRef.current);
    }
    setTriggerQueue((prev) => [...prev, trigger]);
    chainTimeoutRef.current = setTimeout(() => {
      chainTimeoutRef.current = null;
    }, CHAIN_WINDOW_MS);
  }, []);

  const pushLocalEvent = useCallback((event) => {
    setLocalEvents(prev => {
      const updated = [event, ...prev];
      return updated.slice(0, 50); // Cap at 50 events
    });
  }, []);

  // ==================== THRESHOLD DETECTION ====================

  // Player threshold detection
  useEffect(() => {
    if (!currentPrices || Object.keys(currentPrices).length === 0) return;
    if (!battle || !battleId) return;

    myPortfolioFlat.forEach((asset) => {
      if (!asset) return;

      // For swapped-in assets, use swapPrice
      const assetOpenPrice = asset.swapPrice || openPrices[asset.symbol];
      const currentPrice = currentPrices[asset.symbol];
      if (!assetOpenPrice || !currentPrice) return;

      const priceChange = ((currentPrice - assetOpenPrice) / assetOpenPrice) * 100;
      const baseATR = asset.baseATR || battle?.thresholds?.[asset.symbol]?.threshold || 2.5;
      const currentMultiplier = priceChange / baseATR;

      const prevMultiplier = prevMultipliersRef.current[asset.symbol] || 0;
      const assetHistory = combinedHistory[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };

      const crossed = detectThresholdCross(prevMultiplier, currentMultiplier);
      if (crossed) {
        crossed.forEach((threshold) => {
          const existingBadges = getBadgesFromHistory(assetHistory);
          if (!existingBadges.includes(threshold.name)) {
            const newHistory = updateAssetHistory(asset.symbol, currentMultiplier, assetHistory);
            setLocalHistory((prev) => ({
              ...prev,
              [asset.symbol]: newHistory,
            }));

            const event = createThresholdEvent(
              myData?.username || 'You',
              asset.symbol,
              threshold.name,
              currentMultiplier,
              threshold.points
            );

            pushLocalEvent(event);

            queueTrigger({
              name: threshold.name,
              symbol: asset.symbol,
              points: threshold.points,
              event,
            });

            if (battleId && !battleId.startsWith('training_')) {
              addBaggerBombEvent(battleId, event).catch(console.error);
              updateAssetHistoryInBattle(battleId, isCreator, asset.symbol, newHistory).catch(console.error);
            }
          }
        });
      }

      prevMultipliersRef.current[asset.symbol] = currentMultiplier;
    });
  }, [currentPrices, openPrices, myPortfolioFlat, battle, battleId, isCreator, combinedHistory, queueTrigger, myData?.username, pushLocalEvent]);

  // Opponent threshold detection (display-only — no Firestore writes, no celebration)
  useEffect(() => {
    if (!currentPrices || Object.keys(currentPrices).length === 0) return;
    if (!battle || !battleId) return;

    oppPortfolioFlat.forEach((asset) => {
      if (!asset) return;

      const assetOpenPrice = asset.swapPrice || openPrices[asset.symbol];
      const currentPrice = currentPrices[asset.symbol];
      if (!assetOpenPrice || !currentPrice) return;

      const priceChange = ((currentPrice - assetOpenPrice) / assetOpenPrice) * 100;
      const baseATR = asset.baseATR || battle?.thresholds?.[asset.symbol]?.threshold || 2.5;
      const currentMultiplier = priceChange / baseATR;

      const prevMultiplier = prevOppMultipliersRef.current[asset.symbol] || 0;
      const assetHistory = oppHistory[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };

      const crossed = detectThresholdCross(prevMultiplier, currentMultiplier);
      if (crossed) {
        crossed.forEach((threshold) => {
          const existingBadges = getBadgesFromHistory(assetHistory);
          if (!existingBadges.includes(threshold.name)) {
            const event = createThresholdEvent(
              oppData?.username || 'Opponent',
              asset.symbol,
              threshold.name,
              currentMultiplier,
              threshold.points
            );

            pushLocalEvent(event);
          }
        });
      }

      prevOppMultipliersRef.current[asset.symbol] = currentMultiplier;
    });
  }, [currentPrices, openPrices, oppPortfolioFlat, battle, battleId, oppHistory, oppData?.username, pushLocalEvent]);

  // ==================== CONTINUOUS HISTORY TRACKING ====================

  useEffect(() => {
    if (!currentPrices || Object.keys(currentPrices).length === 0) return;
    if (!battle || !battleId || battleId.startsWith('training_')) return;

    const processPortfolio = (portfolioFlat, existingHistory, setHistoryFn, isOwnPortfolio) => {
      portfolioFlat.forEach((asset) => {
        if (!asset) return;

        const assetOpenPrice = asset.swapPrice || openPrices[asset.symbol];
        const currentPrice = currentPrices[asset.symbol];
        if (!assetOpenPrice || !currentPrice) return;

        const priceChange = ((currentPrice - assetOpenPrice) / assetOpenPrice) * 100;
        const baseATR = asset.baseATR || battle?.thresholds?.[asset.symbol]?.threshold || 2.5;
        const currentMultiplier = priceChange / baseATR;

        const assetHistory = existingHistory[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };
        const updatedHistory = getHistoryUpdateIfChanged(currentMultiplier, assetHistory);

        if (updatedHistory) {
          setHistoryFn((prev) => ({
            ...prev,
            [asset.symbol]: updatedHistory,
          }));

          const isCreatorForField = isOwnPortfolio ? isCreator : !isCreator;
          updateAssetHistoryInBattle(battleId, isCreatorForField, asset.symbol, updatedHistory)
            .catch(console.error);
        }
      });
    };

    processPortfolio(myPortfolioFlat, combinedHistory, setLocalHistory, true);
    processPortfolio(oppPortfolioFlat, oppHistory, setLocalOppHistory, false);
  }, [currentPrices, openPrices, myPortfolioFlat, oppPortfolioFlat, battle, battleId, isCreator, combinedHistory, oppHistory]);

  // ==================== PRICE FETCHING ====================

  const fetchPrices = useCallback(async () => {
    const allAssets = [...myPortfolioFlat, ...oppPortfolioFlat].filter(Boolean);
    // Also fetch prices for free agents
    const freeAgentSymbols = freeAgents.map((a) => a.symbol);

    if (allAssets.length === 0 && freeAgentSymbols.length === 0) return;

    try {
      const portfolioSymbols = [...new Set(allAssets.map((a) => a.symbol))];
      const allSymbols = [...new Set([...portfolioSymbols, ...freeAgentSymbols])];
      const stockSymbols = allSymbols.filter((s) => !isCrypto(s));
      const cryptoSymbols = allSymbols.filter((s) => isCrypto(s));

      const newPrices = {};

      // Batch fetch: 2 HTTP requests total instead of N individual calls
      const [stockData, cryptoData] = await Promise.all([
        stockSymbols.length > 0 ? stockAPI.getMultipleStockPrices(stockSymbols) : {},
        cryptoSymbols.length > 0 ? stockAPI.getMultipleCryptoPrices(cryptoSymbols) : {},
      ]);

      Object.entries(stockData).forEach(([symbol, data]) => {
        if (data?.price) newPrices[symbol] = data.price;
      });
      Object.entries(cryptoData).forEach(([symbol, data]) => {
        if (data?.price) newPrices[symbol] = data.price;
      });

      if (Object.keys(newPrices).length > 0) {
        setCurrentPrices((prev) => ({ ...prev, ...newPrices }));
      }
    } catch (err) {
      console.error('Error fetching prices:', err);
      if (battle?.state?.startingPrices) {
        setCurrentPrices(battle.state.startingPrices);
      }
    }
  }, [myPortfolioFlat, oppPortfolioFlat, freeAgents, battle]);

  // ==================== DAILY OPEN PRICE CAPTURE ====================

  const captureDailyOpenPrices = useCallback(async () => {
    if (!battleId || !battle || battleId.startsWith('training_')) return;

    const dayKey = `day${currentTradingDay}`;
    const existingPrices = battle?.state?.dailyOpenPrices?.[dayKey];

    // Only capture if not already set
    if (existingPrices && Object.keys(existingPrices).length > 0) return;
    if (currentTradingDay <= 0 || currentTradingDay > totalTradingDays) return;

    // For Day 1, starting prices serve as open prices
    if (currentTradingDay === 1) {
      const startingPrices = battle?.state?.startingPrices;
      if (startingPrices && Object.keys(startingPrices).length > 0) return;
    }

    // Need current prices to capture
    if (Object.keys(currentPrices).length === 0) return;

    try {
      const battleRef = doc(db, 'battles', battleId);

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(battleRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const existing = data.state?.dailyOpenPrices?.[dayKey];

        // Double-check inside transaction
        if (existing && Object.keys(existing).length > 0) return;

        const allAssets = [
          ...(flattenPortfolio(data.creator?.portfolio) || []),
          ...(flattenPortfolio(data.opponent?.portfolio) || []),
        ].filter(Boolean);

        const openPriceCapture = {};
        const symbols = [...new Set(allAssets.map((a) => a.symbol))];
        symbols.forEach((symbol) => {
          if (currentPrices[symbol]) {
            openPriceCapture[symbol] = currentPrices[symbol];
          }
        });

        if (Object.keys(openPriceCapture).length > 0) {
          transaction.update(battleRef, {
            [`state.dailyOpenPrices.${dayKey}`]: openPriceCapture,
          });
        }
      });
    } catch (err) {
      console.error(`Error capturing daily open prices for ${dayKey}:`, err);
    }
  }, [battleId, battle, currentTradingDay, totalTradingDays, currentPrices]);

  // ==================== FREE AGENT ROTATION ====================

  const triggerRotation = useCallback(async () => {
    if (!battleId || !battle || battleId.startsWith('training_') || rotationInProgressRef.current) return;

    const nextAt = battle?.freeAgents?.nextRotationAt;
    if (!shouldRotate(nextAt)) return;

    rotationInProgressRef.current = true;
    try {
      await rotateFreeAgents(battleId);
    } catch (err) {
      console.error('Error during free agent rotation:', err);
    } finally {
      rotationInProgressRef.current = false;
    }
  }, [battleId, battle]);

  // ==================== SWAP EXECUTION ====================

  const handleSwapRequest = useCallback((agent) => {
    if (swapsRemaining <= 0) return;
    setSwapModalState({
      isOpen: true,
      incomingSymbol: agent.symbol,
      incomingName: agent.name || '',
      incomingIsCrypto: Boolean(agent.isCrypto),
    });
  }, [swapsRemaining]);

  const closeSwapModal = useCallback(() => {
    setSwapModalState({
      isOpen: false,
      incomingSymbol: '',
      incomingName: '',
      incomingIsCrypto: false,
    });
  }, []);

  const executeSwap = useCallback(async ({ outTier, outSlotIndex, inSymbol }) => {
    if (!battleId || !battle || isSwapExecuting) return;

    setIsSwapExecuting(true);
    try {
      const result = await executeSwapService(
        battleId,
        battle,
        playerId,
        outTier,
        outSlotIndex,
        inSymbol,
        currentTradingDay,
        currentPrices
      );

      closeSwapModal();
      return result;
    } catch (err) {
      console.error('Error executing swap:', err);
      throw err;
    } finally {
      setIsSwapExecuting(false);
    }
  }, [battleId, battle, playerId, currentTradingDay, currentPrices, isSwapExecuting, closeSwapModal]);

  // ==================== EFFECTS ====================

  // Subscribe to battle document
  useEffect(() => {
    if (!battleId) {
      setLoading(false);
      return;
    }

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
  useEffect(() => {
    if (myPortfolioFlat.length === 0 && oppPortfolioFlat.length === 0) return;

    fetchPrices();

    // V4: Poll during all hours (crypto trades 24/7), but with different logic
    // during market hours vs after hours
    const nowETString = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const nowET = new Date(nowETString);
    const timeDecimal = nowET.getHours() + nowET.getMinutes() / 60;

    // Active between 9:30 AM and 8 PM ET on any day (crypto always active)
    const isInsideActiveHours = timeDecimal >= 9.5 && timeDecimal < 20;

    if (!isInsideActiveHours) {
      return;
    }

    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices, myPortfolioFlat.length, oppPortfolioFlat.length]);

  // Capture daily open prices when prices arrive for a new day
  useEffect(() => {
    if (Object.keys(currentPrices).length > 0 && currentTradingDay > 0) {
      captureDailyOpenPrices();
    }
  }, [currentPrices, currentTradingDay, captureDailyOpenPrices]);

  // Free agent rotation countdown + auto-trigger
  useEffect(() => {
    if (!battle?.freeAgents?.nextRotationAt) return;

    const updateCountdown = () => {
      const countdown = getRotationCountdown(battle.freeAgents.nextRotationAt);
      setRotationCountdown(countdown);

      // Trigger rotation when countdown reaches 0
      if (countdown === 0) {
        triggerRotation();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, ROTATION_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [battle?.freeAgents?.nextRotationAt, triggerRotation]);

  // ==================== RETURN ====================

  return {
    // Battle data
    battle,
    loading,
    error,

    // User context
    isCreator,
    playerId,

    // Player/Opponent for BattleHeader
    player,
    opponent,

    // V4 Multi-day
    currentTradingDay,
    totalTradingDays,
    tradingDayDates: battle?.timing?.tradingDayDates || [],

    // Free agents
    freeAgents,
    nextRotationAt,
    rotationCountdown,

    // Swaps
    swapsRemaining,
    swapModalState,
    isSwapExecuting,
    handleSwapRequest,
    closeSwapModal,
    executeSwap,

    // Closed trades
    closedTrades,
    closedTradePoints,

    // Events for EventFeed (local threshold detections for both player + opponent)
    events: localEvents,

    // Prices
    currentPrices,
    openPrices,
    thresholds: battle?.thresholds || {},

    // Scores
    myScores,
    oppScores,
    myTotalScore,
    oppTotalScore,

    // Actions
    refreshPrices: fetchPrices,

    // Trigger celebration state
    activeTrigger,
    chainCount,
    cumulativePoints,
    clearTrigger: () => setActiveTrigger(null),
  };
}

export default useBaggerBombBattleV4;
