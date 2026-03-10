// useBaggerBombBattleV4 - V4 state management hook for BaggerBomb battles
// Removes: session state, bench data, session-aware scoring, frozen session prices
// Adds: free agent rotation, swap handling, closed trades, multi-day trading, dailyOpenPrices

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, onSnapshot, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { stockAPI, POPULAR_CRYPTO } from '../services/eodhdAPI';
import { getDailyHL } from '../services/websocketService';
import {
  addBaggerBombEvent,
  updateAssetHistoryInBattle,
} from '../firebase/firebaseService';
import { getVolatilityThresholds } from '../services/volatilityService';
import {
  updateAssetHistory,
  detectThresholdCross,
  getBadgesFromHistory,
  calculateAssetScoreV3,
  createThresholdEvent,
  getHistoryUpdateIfChanged,
  flattenPortfolio,
  THRESHOLD_POINTS,
  detectRedZone,
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
import {
  isAfterDailyEndV4,
  needsDayBanking,
  bankDailyScores,
  checkAndBankPreviousDays,
  getBankedScoreTotal,
} from '../services/dailyScoringV4Service';

// ==================== CONSTANTS ====================

const PRICE_POLL_INTERVAL = 60000; // 60 seconds
const ROTATION_CHECK_INTERVAL = 1000; // 1 second countdown

const isCrypto = (symbol) => {
  const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI', 'XRP', 'DOGE', 'SHIB', 'LTC', 'AAVE', 'ATOM', 'ALGO', 'XLM'];
  return cryptoSymbols.includes(symbol) || symbol?.endsWith('-USD') || POPULAR_CRYPTO.some(c => c.symbol === symbol);
};

// ==================== THE HOOK ====================

export function useBaggerBombBattleV4(battleId, userId, options = {}) {
  const { onThresholdCross, realtimePrices } = options;

  // State
  const [battle, setBattle] = useState(null);
  const [currentPrices, setCurrentPrices] = useState({});
  const [dailyExtremes, setDailyExtremes] = useState({}); // { AAPL: { high, low }, ... } from real-time API
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Merge polled prices with real-time WebSocket prices (WS takes priority)
  const effectivePrices = useMemo(() => {
    if (!realtimePrices || Object.keys(realtimePrices).length === 0) return currentPrices;
    return { ...currentPrices, ...realtimePrices };
  }, [currentPrices, realtimePrices]);

  // Local history tracking (for real-time updates before Firebase sync)
  const [localHistory, setLocalHistory] = useState({});
  const [localOppHistory, setLocalOppHistory] = useState({});
  const prevMultipliersRef = useRef({});
  const hasInitializedExtremesRef = useRef(false);
  const prevOppMultipliersRef = useRef({});
  const redZoneActiveRef = useRef(new Set());

  // Local events for EventFeed (both player + opponent).
  // Stored in a ref to avoid re-rendering the entire component tree (including any
  // open Bomb chart) on every event.  A version counter triggers re-render only when
  // the EventFeed actually needs to update, and a microtask flush batches multiple
  // events from the same price tick into a single re-render.
  const localEventsRef = useRef([]);
  const [localEventsVersion, setLocalEventsVersion] = useState(0);
  const pendingFlushRef = useRef(null);

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

  // Activation prices: the exact prices when the battle went active (second player joined).
  // Returns null when startingPrices hasn't loaded from Firebase yet — this signals
  // Day 1 scoring to produce zero scores rather than using wrong baselines.
  const activationPrices = useMemo(() => {
    const sp = battle?.state?.startingPrices;
    if (!sp || typeof sp !== 'object' || Object.keys(sp).length === 0) return null;
    return sp;
  }, [battle?.state?.startingPrices]);

  // Get open prices for current trading day.
  // All days use activation prices (entry price). No daily reset — scoring is cumulative.
  const openPrices = useMemo(() => {
    return activationPrices || {};
  }, [activationPrices]);

  const hasValidBaseline = useMemo(() => {
    return !!activationPrices;
  }, [activationPrices]);

  // Previous close prices for threshold baseline — stored in Firebase at battle activation.
  // Falls back to activationPrices for old battles without previousClosePrices.
  const previousClosePriceMap = useMemo(() => {
    const fbPrevClose = battle?.state?.previousClosePrices;
    if (fbPrevClose && typeof fbPrevClose === 'object' && Object.keys(fbPrevClose).length > 0) {
      return fbPrevClose;
    }
    return activationPrices || {};
  }, [battle?.state?.previousClosePrices, activationPrices]);

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

  const calculateScores = useCallback((portfolio, prices, openPriceMap, history, extremes = {}, battleThresholds = {}, prevClosePrices = {}) => {
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

      // V5: Cash positions earn 0 points — skip scoring entirely
      if (asset.isCash) {
        assetScores.push({
          symbol: 'CASH',
          priceChange: 0,
          multiplier: 0,
          baseATR: 0,
          basePoints: 0,
          bonusPoints: 0,
          totalPoints: 0,
          badges: [],
          history: { maxMultiplier: 0, minMultiplier: 0 },
          isCash: true,
        });
        return;
      }

      // For swapped-in assets, use swapPrice as the open price
      const assetOpenPrice = asset.swapPrice || openPriceMap[asset.symbol] || 0;
      const currentPrice = prices[asset.symbol] || assetOpenPrice;

      // Resolve baseATR: prefer API-computed battle threshold over asset's stored value
      // (asset.baseATR may be a stale sector default from portfolio builder)
      // NOTE: battleThresholds is passed as a parameter (not read from closure) to avoid
      // stale-closure bugs — useCallback's empty dep array would capture battle as null.
      const resolvedBaseATR = battleThresholds[asset.symbol]?.threshold || asset.baseATR || 2.5;

      if (!assetOpenPrice || assetOpenPrice === 0) {
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

      // Base scoring: percent change from entry price (cumulative P&L)
      const priceChange = ((currentPrice - assetOpenPrice) / assetOpenPrice) * 100;
      // Short position inversion now handled inside calculateAssetScoreV3()
      const assetHistory = history[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };

      // Threshold detection: percent change from previous close (shared daily baseline)
      const prevClose = prevClosePrices[asset.symbol] || assetOpenPrice;
      const thresholdPriceChange = prevClose > 0
        ? ((currentPrice - prevClose) / prevClose) * 100
        : null;

      // Compute high/low percent changes for intraday threshold detection
      // Rebase extremes against previousClose (not entry price) for correct threshold triggers
      const assetExtremes = extremes[asset.symbol];
      const extremeChanges = {};
      if (assetExtremes && prevClose > 0) {
        if (assetExtremes.high > 0) {
          extremeChanges.highChange = ((assetExtremes.high - prevClose) / prevClose) * 100;
        }
        if (assetExtremes.low > 0) {
          extremeChanges.lowChange = ((assetExtremes.low - prevClose) / prevClose) * 100;
        }
      }

      const score = calculateAssetScoreV3({ ...asset, baseATR: resolvedBaseATR }, priceChange, assetHistory, extremeChanges, thresholdPriceChange);
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
  // Pass battle.thresholds explicitly so both players use the same authoritative
  // threshold per symbol (fixes BaggerBomb count mismatch)
  const battleThresholds = battle?.thresholds || {};

  // One-time migration: backfill thresholds for old battles that lack them.
  // Without this, both players fall through to asset.baseATR (stale per-player value).
  useEffect(() => {
    if (!battle?.id || battle.status !== 'active') return;
    const thresholds = battle.thresholds || {};
    const allSymbols = [...myPortfolioFlat, ...oppPortfolioFlat]
      .filter(Boolean)
      .map(a => a.symbol);
    const uniqueSymbols = [...new Set(allSymbols)];
    const missing = uniqueSymbols.filter(s => !thresholds[s]);
    if (missing.length === 0) return;

    (async () => {
      try {
        const stockSyms = missing.filter(s => !isCrypto(s));
        const cryptoSyms = missing.filter(s => isCrypto(s));
        const [stockResults, cryptoResults] = await Promise.all([
          stockSyms.length > 0 ? getVolatilityThresholds(stockSyms, 'stock') : {},
          cryptoSyms.length > 0 ? getVolatilityThresholds(cryptoSyms, 'crypto') : {},
        ]);
        const fetched = { ...stockResults, ...cryptoResults };
        if (!fetched || Object.keys(fetched).length === 0) return;

        const merged = { ...thresholds };
        for (const [sym, data] of Object.entries(fetched)) {
          merged[sym] = {
            threshold: Number(data.threshold) || 2.5,
            rallyThreshold: Number(data.rallyThreshold) || 3.75,
            moonshotThreshold: Number(data.moonshotThreshold) || 5.0,
          };
        }

        const battleRef = doc(db, 'battles', battle.id);
        await updateDoc(battleRef, { thresholds: merged });
        console.log(`[V4] Backfilled thresholds for ${missing.length} symbols in battle ${battle.id}`);
      } catch (err) {
        console.warn('⚠️ Threshold backfill failed:', err.message);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.id, battle?.status]);

  const myScores = useMemo(() => {
    if (!hasValidBaseline) {
      console.log(`[Scoring] BASELINE SOURCE: WAITING (no scoring — day ${currentTradingDay} baseline not loaded)`);
      return { totalScore: 0, assetScores: [], baggerBombs: 0, busts: 0 };
    }
    console.log(`[Scoring] BASELINE SOURCE: entryPrices (day ${currentTradingDay})`);
    // V4 is cumulative — threshold baseline = entry price (openPrices), not previousClose
    return calculateScores(myPortfolioFlat, effectivePrices, openPrices, combinedHistory, dailyExtremes, battleThresholds, openPrices);
  }, [hasValidBaseline, currentTradingDay, myPortfolioFlat, effectivePrices, openPrices, combinedHistory, dailyExtremes, calculateScores, battleThresholds]);

  const oppScores = useMemo(() => {
    if (!hasValidBaseline) {
      return { totalScore: 0, assetScores: [], baggerBombs: 0, busts: 0 };
    }
    // V4 is cumulative — threshold baseline = entry price (openPrices), not previousClose
    return calculateScores(oppPortfolioFlat, effectivePrices, openPrices, oppHistory || {}, dailyExtremes, battleThresholds, openPrices);
  }, [hasValidBaseline, oppPortfolioFlat, effectivePrices, openPrices, oppHistory, dailyExtremes, calculateScores, battleThresholds]);

  // V4: Total score = banked previous days + current active score + locked closed trade points
  const closedTradePoints = useMemo(() => {
    return closedTrades.reduce((sum, t) => sum + (t.lockedPoints || 0), 0);
  }, [closedTrades]);

  const oppClosedTradePoints = useMemo(() => {
    const oppClosed = oppData?.closedTrades || [];
    return oppClosed.reduce((sum, t) => sum + (t.lockedPoints || 0), 0);
  }, [oppData?.closedTrades]);

  // Banked previous days' active portfolio scores
  const bankedScore = useMemo(() => {
    return getBankedScoreTotal(battle?.state?.dailyScores, playerId);
  }, [battle?.state?.dailyScores, playerId]);

  const oppBankedScore = useMemo(() => {
    const oppRole = isCreator ? 'opponent' : 'creator';
    return getBankedScoreTotal(battle?.state?.dailyScores, oppRole);
  }, [battle?.state?.dailyScores, isCreator]);

  const myTotalScore = useMemo(() => {
    return Math.round(bankedScore + myScores.totalScore + closedTradePoints);
  }, [bankedScore, myScores.totalScore, closedTradePoints]);

  const oppTotalScore = useMemo(() => {
    return Math.round(oppBankedScore + oppScores.totalScore + oppClosedTradePoints);
  }, [oppBankedScore, oppScores.totalScore, oppClosedTradePoints]);

  // ==================== BUILD PLAYER/OPPONENT OBJECTS ====================

  const buildTacticalAsset = useCallback((asset, scores, history, bThresholds = {}, prices = {}, baselines = {}, actPrices = {}, prevClosePrices = {}) => {
    if (!asset) return null;

    // V5: Cash positions earn 0 points, no scoring
    if (asset.isCash) {
      return {
        symbol: 'CASH',
        name: 'Cash',
        priceChange: 0,
        baseATR: 0,
        history: { maxMultiplier: 0, minMultiplier: 0 },
        points: 0,
        badges: [],
        isCrypto: false,
        isCash: true,
        previousAsset: asset.previousAsset,
        cashedAt: asset.cashedAt,
        tierMultiplier: 1.0,
      };
    }

    const scoreData = scores.assetScores.find((s) => s.symbol === asset.symbol);
    const assetHistory = history[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };
    const resolvedATR = bThresholds[asset.symbol]?.threshold || scoreData?.baseATR || asset.baseATR || 2.5;

    return {
      symbol: asset.symbol,
      name: asset.name,
      priceChange: scoreData?.priceChange || 0,
      baseATR: resolvedATR,
      history: assetHistory,
      points: scoreData?.totalPoints || 0,
      badges: scoreData?.badges || getBadgesFromHistory(assetHistory),
      isCrypto: asset.isCrypto,
      direction: asset.direction || null,
      tierMultiplier: scoreData?.tierMultiplier || 1.0,
      // Price data for ScoreBreakdownPopover — prefer activation price (battle start)
      // over scoring baseline (which may be previousClose on load)
      currentPrice: prices[asset.symbol] || 0,
      startingPrice: actPrices[asset.symbol] || baselines[asset.symbol] || 0,
      baselinePrice: actPrices[asset.symbol] || baselines[asset.symbol] || 0,
      lockedPrice: actPrices[asset.symbol] || baselines[asset.symbol] || 0,
      // Previous close for threshold target display (BaggerBombTab)
      previousClosePrice: prevClosePrices[asset.symbol] || actPrices[asset.symbol] || baselines[asset.symbol] || 0,
      threshold: resolvedATR,
      gain: scoreData?.priceChange || 0,
      totalScore: scoreData?.totalPoints || 0,
      basePoints: scoreData?.basePoints || 0,
      baggerBombPoints: (scoreData?.bonusPoints || 0) > 0 ? scoreData.bonusPoints : 0,
      bustPoints: (scoreData?.bonusPoints || 0) < 0 ? scoreData.bonusPoints : 0,
      baggerBombs: (scoreData?.badges || []).filter(b => ['bagger', 'doubleBagger', 'tenBagger'].includes(b)).length,
      busts: (scoreData?.badges || []).filter(b => ['bust', 'crash', 'meltdown'].includes(b)).length,
    };
  }, []);

  const playerPortfolio = useMemo(() => {
    const portfolio = myData?.portfolio;
    if (!portfolio) return { star: [], core: [], support: [] };
    return {
      star: (portfolio.star || []).map((a) => buildTacticalAsset(a, myScores, combinedHistory, battleThresholds, effectivePrices, openPrices, activationPrices || {}, activationPrices || {})),
      core: (portfolio.core || []).map((a) => buildTacticalAsset(a, myScores, combinedHistory, battleThresholds, effectivePrices, openPrices, activationPrices || {}, activationPrices || {})),
      support: (portfolio.support || []).map((a) => buildTacticalAsset(a, myScores, combinedHistory, battleThresholds, effectivePrices, openPrices, activationPrices || {}, activationPrices || {})),
    };
  }, [myData?.portfolio, myScores, combinedHistory, buildTacticalAsset, battleThresholds, effectivePrices, openPrices, activationPrices]);

  const opponentPortfolio = useMemo(() => {
    const portfolio = oppData?.portfolio;
    if (!portfolio) return { star: [], core: [], support: [] };
    return {
      star: (portfolio.star || []).map((a) => buildTacticalAsset(a, oppScores, oppHistory || {}, battleThresholds, effectivePrices, openPrices, activationPrices || {}, activationPrices || {})),
      core: (portfolio.core || []).map((a) => buildTacticalAsset(a, oppScores, oppHistory || {}, battleThresholds, effectivePrices, openPrices, activationPrices || {}, activationPrices || {})),
      support: (portfolio.support || []).map((a) => buildTacticalAsset(a, oppScores, oppHistory || {}, battleThresholds, effectivePrices, openPrices, activationPrices || {}, activationPrices || {})),
    };
  }, [oppData?.portfolio, oppScores, oppHistory, buildTacticalAsset, battleThresholds, effectivePrices, openPrices, activationPrices]);

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
    // Dedup: skip if an identical redzone event exists within 10 minutes
    if (event.type === 'redzone') {
      const DEDUP_WINDOW = 10 * 60 * 1000;
      const now = Date.now();
      const isDuplicate = localEventsRef.current.some(e =>
        e.type === 'redzone' &&
        e.symbol === event.symbol &&
        e.targetThreshold === event.targetThreshold &&
        e.direction === event.direction &&
        (now - new Date(e.timestamp).getTime()) < DEDUP_WINDOW
      );
      if (isDuplicate) return;
    }

    // Update ref synchronously (available immediately for same-tick dedup checks)
    localEventsRef.current = [event, ...localEventsRef.current].slice(0, 50);

    // Batch: defer the state update to a microtask so all events from the same
    // price tick (player + opponent effects) coalesce into one re-render.
    if (!pendingFlushRef.current) {
      pendingFlushRef.current = true;
      queueMicrotask(() => {
        pendingFlushRef.current = false;
        setLocalEventsVersion(v => v + 1);
      });
    }
  }, []);

  // ==================== THRESHOLD DETECTION ====================

  // Player threshold detection
  useEffect(() => {
    if (!hasValidBaseline) return; // No valid baseline — skip threshold detection
    if (!effectivePrices || Object.keys(effectivePrices).length === 0) return;
    if (!battle || !battleId) return;

    myPortfolioFlat.forEach((asset) => {
      if (!asset) return;
      // V5: Skip cash positions entirely — no thresholds, no events
      if (asset.isCash) return;

      // For swapped-in assets, use swapPrice
      const assetOpenPrice = asset.swapPrice || openPrices[asset.symbol];
      const currentPrice = effectivePrices[asset.symbol];
      if (!assetOpenPrice || !currentPrice) return;

      let priceChange = ((currentPrice - assetOpenPrice) / assetOpenPrice) * 100;
      // V5: Invert for short positions
      if (asset.direction === 'short') {
        priceChange = -priceChange;
      }
      const baseATR = battle?.thresholds?.[asset.symbol]?.threshold || asset.baseATR || 2.5;
      const currentMultiplier = priceChange / baseATR;

      // Also check intraday high/low for threshold crossings
      const assetExtremes = dailyExtremes[asset.symbol];
      let effectiveHighMultiplier = currentMultiplier;
      let effectiveLowMultiplier = currentMultiplier;
      if (assetExtremes && assetOpenPrice > 0) {
        if (assetExtremes.high > 0) {
          let highPctChange = ((assetExtremes.high - assetOpenPrice) / assetOpenPrice) * 100;
          if (asset.direction === 'short') highPctChange = -highPctChange;
          effectiveHighMultiplier = Math.max(currentMultiplier, highPctChange / baseATR);
        }
        if (assetExtremes.low > 0) {
          let lowPctChange = ((assetExtremes.low - assetOpenPrice) / assetOpenPrice) * 100;
          if (asset.direction === 'short') lowPctChange = -lowPctChange;
          effectiveLowMultiplier = Math.min(currentMultiplier, lowPctChange / baseATR);
        }
      }

      // On first tick after mount/refresh, initialize and skip detection to
      // avoid false threshold crossings (prevMultiplier was 0, not the real state).
      if (prevMultipliersRef.current[asset.symbol] === undefined) {
        prevMultipliersRef.current[asset.symbol] = currentMultiplier;
        return; // Skip this asset on first tick — start detecting from next update
      }
      const prevMultiplier = prevMultipliersRef.current[asset.symbol];
      const assetHistory = combinedHistory[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };

      // Check for threshold crossings using both current price and intraday extremes
      const crossedCurrent = detectThresholdCross(prevMultiplier, currentMultiplier) || [];
      const crossedHigh = effectiveHighMultiplier !== currentMultiplier
        ? (detectThresholdCross(prevMultiplier, effectiveHighMultiplier) || [])
        : [];
      const crossedLow = effectiveLowMultiplier !== currentMultiplier
        ? (detectThresholdCross(prevMultiplier, effectiveLowMultiplier) || [])
        : [];

      // Merge all crossings, deduplicate by name
      const allCrossedMap = {};
      [...crossedCurrent, ...crossedHigh, ...crossedLow].forEach(t => { allCrossedMap[t.name] = t; });
      const crossed = Object.values(allCrossedMap);

      if (crossed.length > 0) {
        // Use the most extreme multiplier for history tracking
        const extremeMultiplier = effectiveHighMultiplier >= Math.abs(effectiveLowMultiplier)
          ? effectiveHighMultiplier : effectiveLowMultiplier;

        crossed.forEach((threshold) => {
          const existingBadges = getBadgesFromHistory(assetHistory);
          if (!existingBadges.includes(threshold.name)) {
            const newHistory = updateAssetHistory(asset.symbol, extremeMultiplier, assetHistory);
            setLocalHistory((prev) => ({
              ...prev,
              [asset.symbol]: newHistory,
            }));

            // Use the multiplier that actually triggered this threshold
            const isNegativeThreshold = ['bust', 'crash', 'meltdown'].includes(threshold.name);
            const triggerMultiplier = isNegativeThreshold ? effectiveLowMultiplier : effectiveHighMultiplier;

            const event = createThresholdEvent(
              myData?.username || 'You',
              asset.symbol,
              threshold.name,
              triggerMultiplier,
              threshold.points,
              asset.direction
            );

            pushLocalEvent(event);

            queueTrigger({
              name: threshold.name,
              symbol: asset.symbol,
              points: threshold.points,
              event,
            });

            if (battleId && !battleId.startsWith('training_')) {
              // Dedup: both clients may detect the same crossing independently,
              // or a page refresh resets prevMultipliersRef causing re-detection.
              const alreadyInFirebase = (battle?.events || []).some(e =>
                e.symbol === asset.symbol && e.type === threshold.name
              );
              if (!alreadyInFirebase) {
                addBaggerBombEvent(battleId, event).catch(console.error);
              }
              updateAssetHistoryInBattle(battleId, isCreator, asset.symbol, newHistory).catch(console.error);
            }
          }
        });
      }

      prevMultipliersRef.current[asset.symbol] = currentMultiplier;

      // Red Zone detection — within 25% of next threshold
      const rzBadges = getBadgesFromHistory(combinedHistory[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 });
      const rz = detectRedZone(currentMultiplier, rzBadges);
      const rzKey = rz ? `${asset.symbol}_${rz.direction}_${rz.targetMultiple}` : null;

      if (rz && rzKey && !redZoneActiveRef.current.has(rzKey)) {
        console.log('[RedZone] Generating event:', {
          symbol: asset.symbol, target: rz.targetThreshold,
          rzKey, alreadyInRef: false,
          refSize: redZoneActiveRef.current.size, calledFrom: 'hook_player',
        });
        redZoneActiveRef.current.add(rzKey);
        pushLocalEvent({
          id: `${Date.now()}-${asset.symbol}-redzone-${rz.targetThreshold}`,
          timestamp: new Date().toISOString(),
          type: 'redzone',
          player: myData?.username || 'You',
          symbol: asset.symbol,
          direction: rz.direction,
          targetThreshold: rz.targetThreshold,
          targetMultiple: rz.targetMultiple,
          progress: rz.progress,
          multiplier: currentMultiplier,
          points: 0,
        });
      }
      // Only clear stale red zone keys when transitioning to a DIFFERENT target.
      // When rz is null (left zone), preserve keys to prevent re-trigger on oscillation.
      // IMPORTANT: exclude opponent keys (contain '_opp_') — player cleanup must not
      // delete opponent keys or the opponent effect will regenerate events every tick.
      if (rzKey) {
        redZoneActiveRef.current.forEach(key => {
          if (key.startsWith(`${asset.symbol}_`) && !key.startsWith(`${asset.symbol}_opp_`) && key !== rzKey) {
            redZoneActiveRef.current.delete(key);
          }
        });
      }
    });
  }, [hasValidBaseline, effectivePrices, openPrices, dailyExtremes, myPortfolioFlat, battle, battleId, isCreator, combinedHistory, queueTrigger, myData?.username, pushLocalEvent]);

  // Opponent threshold detection (display-only — no Firestore writes, no celebration)
  useEffect(() => {
    if (!hasValidBaseline) return; // No valid baseline — skip threshold detection
    if (!effectivePrices || Object.keys(effectivePrices).length === 0) return;
    if (!battle || !battleId) return;

    oppPortfolioFlat.forEach((asset) => {
      if (!asset) return;
      // V5: Skip cash positions entirely
      if (asset.isCash) return;

      const assetOpenPrice = asset.swapPrice || openPrices[asset.symbol];
      const currentPrice = effectivePrices[asset.symbol];
      if (!assetOpenPrice || !currentPrice) return;

      let priceChange = ((currentPrice - assetOpenPrice) / assetOpenPrice) * 100;
      // V5: Invert for short positions
      if (asset.direction === 'short') {
        priceChange = -priceChange;
      }
      const baseATR = battle?.thresholds?.[asset.symbol]?.threshold || asset.baseATR || 2.5;
      const currentMultiplier = priceChange / baseATR;

      // Also check intraday high/low for threshold crossings
      const assetExtremes = dailyExtremes[asset.symbol];
      let effectiveHighMultiplier = currentMultiplier;
      let effectiveLowMultiplier = currentMultiplier;
      if (assetExtremes && assetOpenPrice > 0) {
        if (assetExtremes.high > 0) {
          let highPctChange = ((assetExtremes.high - assetOpenPrice) / assetOpenPrice) * 100;
          if (asset.direction === 'short') highPctChange = -highPctChange;
          effectiveHighMultiplier = Math.max(currentMultiplier, highPctChange / baseATR);
        }
        if (assetExtremes.low > 0) {
          let lowPctChange = ((assetExtremes.low - assetOpenPrice) / assetOpenPrice) * 100;
          if (asset.direction === 'short') lowPctChange = -lowPctChange;
          effectiveLowMultiplier = Math.min(currentMultiplier, lowPctChange / baseATR);
        }
      }

      const prevMultiplier = prevOppMultipliersRef.current[asset.symbol] || 0;
      const assetHistory = oppHistory[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };

      // Check for threshold crossings using both current price and intraday extremes
      const crossedCurrent = detectThresholdCross(prevMultiplier, currentMultiplier) || [];
      const crossedHigh = effectiveHighMultiplier !== currentMultiplier
        ? (detectThresholdCross(prevMultiplier, effectiveHighMultiplier) || [])
        : [];
      const crossedLow = effectiveLowMultiplier !== currentMultiplier
        ? (detectThresholdCross(prevMultiplier, effectiveLowMultiplier) || [])
        : [];

      // Merge all crossings, deduplicate by name
      const allCrossedMap = {};
      [...crossedCurrent, ...crossedHigh, ...crossedLow].forEach(t => { allCrossedMap[t.name] = t; });
      const crossed = Object.values(allCrossedMap);

      if (crossed.length > 0) {
        // Use the most extreme multiplier for history tracking
        const extremeMultiplier = effectiveHighMultiplier >= Math.abs(effectiveLowMultiplier)
          ? effectiveHighMultiplier : effectiveLowMultiplier;

        crossed.forEach((threshold) => {
          const existingBadges = getBadgesFromHistory(assetHistory);
          if (!existingBadges.includes(threshold.name)) {
            // Update opponent history locally (mirrors player detection)
            const newHistory = updateAssetHistory(asset.symbol, extremeMultiplier, assetHistory);
            setLocalOppHistory((prev) => ({
              ...prev,
              [asset.symbol]: newHistory,
            }));

            // Use the multiplier that actually triggered this threshold
            const isNegativeThreshold = ['bust', 'crash', 'meltdown'].includes(threshold.name);
            const triggerMultiplier = isNegativeThreshold ? effectiveLowMultiplier : effectiveHighMultiplier;

            const event = createThresholdEvent(
              oppData?.username || 'Opponent',
              asset.symbol,
              threshold.name,
              triggerMultiplier,
              threshold.points,
              asset.direction
            );

            pushLocalEvent(event);

            // Persist to Firebase (same as player events) — skip in training mode
            if (battleId && !battleId.startsWith('training_')) {
              // Dedup: both clients may detect the same opponent crossing
              const alreadyInFirebase = (battle?.events || []).some(e =>
                e.symbol === event.symbol && e.type === event.type && e.player === event.player
              );
              if (!alreadyInFirebase) {
                addBaggerBombEvent(battleId, event).catch(console.error);
              }
              updateAssetHistoryInBattle(battleId, !isCreator, asset.symbol, newHistory).catch(console.error);
            }
          }
        });
      }

      prevOppMultipliersRef.current[asset.symbol] = currentMultiplier;

      // Red Zone detection for opponent
      const oppRzBadges = getBadgesFromHistory(assetHistory);
      const oppRz = detectRedZone(currentMultiplier, oppRzBadges);
      const oppRzKey = oppRz ? `${asset.symbol}_opp_${oppRz.direction}_${oppRz.targetMultiple}` : null;

      if (oppRz && oppRzKey && !redZoneActiveRef.current.has(oppRzKey)) {
        console.log('[RedZone] Generating event:', {
          symbol: asset.symbol, target: oppRz.targetThreshold,
          rzKey: oppRzKey, alreadyInRef: false,
          refSize: redZoneActiveRef.current.size, calledFrom: 'hook_opponent',
        });
        redZoneActiveRef.current.add(oppRzKey);
        pushLocalEvent({
          id: `${Date.now()}-${asset.symbol}-redzone-opp-${oppRz.targetThreshold}`,
          timestamp: new Date().toISOString(),
          type: 'redzone',
          player: oppData?.username || 'Opponent',
          symbol: asset.symbol,
          direction: oppRz.direction,
          targetThreshold: oppRz.targetThreshold,
          targetMultiple: oppRz.targetMultiple,
          progress: oppRz.progress,
          multiplier: currentMultiplier,
          points: 0,
        });
      }
      // Only clear stale red zone keys when transitioning to a DIFFERENT target.
      // When oppRz is null (left zone), preserve keys to prevent re-trigger on oscillation.
      if (oppRzKey) {
        redZoneActiveRef.current.forEach(key => {
          if (key.startsWith(`${asset.symbol}_opp_`) && key !== oppRzKey) {
            redZoneActiveRef.current.delete(key);
          }
        });
      }
    });
  }, [hasValidBaseline, effectivePrices, openPrices, dailyExtremes, oppPortfolioFlat, battle, battleId, isCreator, oppHistory, oppData?.username, pushLocalEvent]);

  // ==================== CONTINUOUS HISTORY TRACKING ====================

  useEffect(() => {
    if (!hasValidBaseline) return; // No valid baseline — skip history tracking
    if (!effectivePrices || Object.keys(effectivePrices).length === 0) return;
    if (!battle || !battleId || battleId.startsWith('training_')) return;

    const processPortfolio = (portfolioFlat, existingHistory, setHistoryFn, isOwnPortfolio) => {
      portfolioFlat.forEach((asset) => {
        if (!asset) return;

        const assetOpenPrice = asset.swapPrice || openPrices[asset.symbol];
        const currentPrice = effectivePrices[asset.symbol];
        if (!assetOpenPrice || !currentPrice) return;

        const priceChange = ((currentPrice - assetOpenPrice) / assetOpenPrice) * 100;
        const baseATR = battle?.thresholds?.[asset.symbol]?.threshold || asset.baseATR || 2.5;
        const currentMultiplier = priceChange / baseATR;

        // Use intraday high/low for peak tracking — if the high crossed a threshold,
        // maxMultiplier should reflect that even if the price later reversed
        const assetExtremes = dailyExtremes[asset.symbol];
        let highMultiplier = currentMultiplier;
        let lowMultiplier = currentMultiplier;
        if (assetExtremes && assetOpenPrice > 0) {
          if (assetExtremes.high > 0) {
            let highPctChange = ((assetExtremes.high - assetOpenPrice) / assetOpenPrice) * 100;
            if (asset.direction === 'short') highPctChange = -highPctChange;
            highMultiplier = Math.max(currentMultiplier, highPctChange / baseATR);
          }
          if (assetExtremes.low > 0) {
            let lowPctChange = ((assetExtremes.low - assetOpenPrice) / assetOpenPrice) * 100;
            if (asset.direction === 'short') lowPctChange = -lowPctChange;
            lowMultiplier = Math.min(currentMultiplier, lowPctChange / baseATR);
          }
        }

        const assetHistory = existingHistory[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };
        // Check both extremes against history — first high (for bombs), then low (for busts)
        let updatedHistory = getHistoryUpdateIfChanged(highMultiplier, assetHistory);
        const historyAfterHigh = updatedHistory || assetHistory;
        const updatedFromLow = getHistoryUpdateIfChanged(lowMultiplier, historyAfterHigh);
        updatedHistory = updatedFromLow || updatedHistory;

        // Diagnostic logging for threshold verification
        const finalHistory = updatedHistory || assetHistory;
        const badge = finalHistory.maxMultiplier >= 1 ? 'baggerBomb' : finalHistory.minMultiplier <= -1 ? 'bust' : 'none';

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
  }, [hasValidBaseline, effectivePrices, openPrices, dailyExtremes, myPortfolioFlat, oppPortfolioFlat, battle, battleId, isCreator, combinedHistory, oppHistory]);

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

      // Collect prices from EODHD — but NOT high/low.
      // EODHD data.high/data.low reflect the full trading day including
      // pre-activation movement, which causes false BaggerBomb/Bust triggers.
      Object.entries(stockData).forEach(([symbol, data]) => {
        if (data?.price) newPrices[symbol] = data.price;
      });
      Object.entries(cryptoData).forEach(([symbol, data]) => {
        if (data?.price) newPrices[symbol] = data.price;
      });

      if (Object.keys(newPrices).length > 0) {
        setCurrentPrices((prev) => ({ ...prev, ...newPrices }));
      }

      // Build extremes from WebSocket daily H/L instead of EODHD.
      // Guard: on the first tick after activation, clear any stale extremes.
      // WebSocket H/L tracks from 9:30 AM ET, so for mid-session battles it
      // may include pre-activation prices. By clearing on first tick and only
      // using WS data from the second tick onward, we ensure extremes only
      // reflect prices observed during the battle.
      if (!hasInitializedExtremesRef.current) {
        setDailyExtremes({});
        hasInitializedExtremesRef.current = true;
      } else {
        const wsExtremes = {};
        allSymbols.forEach((symbol) => {
          const wsHL = getDailyHL(symbol);
          if (wsHL) {
            wsExtremes[symbol] = { high: wsHL.high, low: wsHL.low };
          }
        });
        if (Object.keys(wsExtremes).length > 0) {
          setDailyExtremes(wsExtremes);
        }
      }

    } catch (err) {
      console.error('Error fetching prices:', err);
      if (battle?.state?.startingPrices) {
        setCurrentPrices(battle.state.startingPrices);
      }
    }
  }, [myPortfolioFlat, oppPortfolioFlat, freeAgents, battle]);

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

  const executeSwap = useCallback(async ({ outTier, outSlotIndex, inAgent, swapType = 'stock', direction = null }) => {
    if (!battleId || !battle || isSwapExecuting) return;

    // V5: inAgent should be an object { symbol, name, isCrypto, ... }
    // For backward compat, accept string and wrap it
    const agentObj = typeof inAgent === 'string'
      ? { symbol: inAgent, name: inAgent, isCrypto: false }
      : inAgent;

    setIsSwapExecuting(true);
    try {
      const result = await executeSwapService(
        battleId,
        battle,
        playerId,
        outTier,
        outSlotIndex,
        agentObj,
        currentTradingDay,
        effectivePrices,
        { swapType, direction }
      );

      closeSwapModal();
      return result;
    } catch (err) {
      console.error('Error executing swap:', err);
      throw err;
    } finally {
      setIsSwapExecuting(false);
    }
  }, [battleId, battle, playerId, currentTradingDay, effectivePrices, isSwapExecuting, closeSwapModal]);

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

    // Always poll — crypto trades 24/7. Stock prices will be stale outside
    // market hours but that's harmless (scoring uses entry price baseline).
    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices, myPortfolioFlat.length, oppPortfolioFlat.length]);

  // Bank daily scores at end of day (client-side primary) + day-transition fallback
  const bankingInProgressRef = useRef(false);
  useEffect(() => {
    if (!battle || !battleId || battleId.startsWith('training_')) return;
    if (Object.keys(effectivePrices).length === 0) return;
    if (currentTradingDay <= 0 || currentTradingDay > totalTradingDays) return;
    if (bankingInProgressRef.current) return;

    const runBanking = async () => {
      bankingInProgressRef.current = true;
      try {
        // Primary: bank current day if daily end has passed
        if (isAfterDailyEndV4() && needsDayBanking(battle, currentTradingDay)) {
          await bankDailyScores(battleId, currentTradingDay, effectivePrices);
        }
        // Fallback: bank any previous days that were missed
        if (currentTradingDay > 1) {
          await checkAndBankPreviousDays(battleId, currentTradingDay, effectivePrices);
        }
      } catch (err) {
        console.error('[DailyScoringV4] Banking error:', err);
      } finally {
        bankingInProgressRef.current = false;
      }
    };

    runBanking();
  }, [battle, battleId, currentTradingDay, totalTradingDays, effectivePrices]);

  // Reset local history caches on day transition (Firebase history gets reset by bankDailyScores)
  const prevTradingDayRef = useRef(currentTradingDay);
  useEffect(() => {
    if (currentTradingDay > 0 && currentTradingDay !== prevTradingDayRef.current && prevTradingDayRef.current > 0) {
      setLocalHistory({});
      setLocalOppHistory({});
      prevMultipliersRef.current = {};
      prevOppMultipliersRef.current = {};
      redZoneActiveRef.current = new Set();
      localEventsRef.current = [];
      setLocalEventsVersion(v => v + 1);
    }
    prevTradingDayRef.current = currentTradingDay;
  }, [currentTradingDay]);

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

  // ==================== MERGE LOCAL + FIREBASE EVENTS ====================
  // Local events capture real-time threshold crossings detected in-browser.
  // Firebase battle.events stores the full history (thresholds + swaps from both players).
  // Merge them so the feed shows historical events even after a page reload.

  const mergedEvents = useMemo(() => {
    // Read local events from ref (triggered by localEventsVersion counter)
    const localEvents = localEventsRef.current;

    const firebaseEvents = (battle?.events || []).map(e => {
      // Normalize swap events to match EventFeed format
      if (e.type === 'swap') {
        const username = e.playerId === 'creator'
          ? (battle?.creator?.username || 'Creator')
          : (battle?.opponent?.username || 'Opponent');
        return {
          ...e,
          id: e.id || `swap_${e.timestamp}_${e.removedSymbol}`,
          player: username,
          symbol: e.removedSymbol || e.addedSymbol,
        };
      }
      return e;
    });

    // Deduplicate: skip Firebase events whose id already exists in localEvents
    const localIds = new Set(localEvents.map(e => e.id));
    const uniqueFirebase = firebaseEvents.filter(e => {
      const eid = e.id || `fb_${e.timestamp}_${e.symbol}_${e.type}`;
      return !localIds.has(eid);
    });

    return [...localEvents, ...uniqueFirebase];
  }, [localEventsVersion, battle?.events, battle?.creator?.username, battle?.opponent?.username]);

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

    // Banked daily scores (previous days)
    bankedScore,
    oppBankedScore,

    // Events for EventFeed (local detections + Firebase history including swaps)
    events: mergedEvents,

    // Prices (effectivePrices = polled + real-time WebSocket overlay)
    currentPrices: effectivePrices,
    openPrices,
    previousClosePrices: previousClosePriceMap, // Previous close baseline for threshold detection
    dailyExtremes, // Real-time intraday high/low per symbol
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
