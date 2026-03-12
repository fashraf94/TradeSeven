// BaggerBombTrainingBattleViewV4 - V4 Training-specific wrapper
// Adapts training battle data to the format expected by BaggerBombBattleView
// V4: No bench, no sessions, 1 swap total, free agents from Firebase, 1-day duration
//
// PERSISTENCE: Swaps, closed trades, and free agent rotations write to Firebase
// (trainingBattles collection). On re-entry, state is read from battle prop.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import BaggerBombBattleView from './BaggerBombBattleView';
import { HOLO_COLORS } from '../constants/holoTheme';
import { motion } from 'framer-motion';
import { stockAPI, POPULAR_CRYPTO } from '../services/eodhdAPI';
import { useWebSocketPrices } from '../hooks/useWebSocketPrices';
import { getVolatilityThresholds } from '../services/volatilityService';
import {
  flattenPortfolio,
  calculateAssetScoreV3,
  detectThresholdCross,
  createThresholdEvent,
  getBadgesFromHistory,
  detectRedZone,
  isSwapLocked,
} from '../utils/baggerBombUtils';
import { generateFreeAgentPool } from '../services/freeAgentRotationService';
import { getFreeAgentConfig } from '../constants/battleTimingV4';
import { DEFAULT_THRESHOLD } from '../utils/researchAssetBuilder';
import { BAGGERBOMB_CRYPTO_POOL, CRYPTO_POOL_SYMBOLS, CASH_POSITION } from '../constants/cryptoPool';

const PRICE_POLL_INTERVAL = 60000; // 60 seconds

const isCryptoSymbol = (symbol) => {
  return POPULAR_CRYPTO.some(c => c.symbol === symbol) || symbol?.endsWith('-USD');
};

/**
 * Write swap data to Firebase trainingBattles collection
 */
async function persistSwapToFirebase(battleId, playerId, updates) {
  try {
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase/config');
    const battleRef = doc(db, 'trainingBattles', battleId);
    await updateDoc(battleRef, updates);
  } catch (error) {
    console.error('[TrainingV4] Failed to persist swap to Firebase:', error);
  }
}

/**
 * Write free agent rotation to Firebase
 */
async function persistRotationToFirebase(battleId, newAgents, nextRotationAt, rotationCount) {
  try {
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase/config');
    const battleRef = doc(db, 'trainingBattles', battleId);
    await updateDoc(battleRef, {
      'freeAgents.current': newAgents,
      'freeAgents.nextRotationAt': nextRotationAt,
      'freeAgents.rotationCount': rotationCount,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[TrainingV4] Failed to persist rotation:', error);
  }
}

/**
 * BaggerBombTrainingBattleViewV4 - Training wrapper for V4
 */
export default function BaggerBombTrainingBattleViewV4({
  battle,
  user,
  onBack,
}) {
  // State
  const [currentPrices, setCurrentPrices] = useState({});
  const [previousClosePrices, setPreviousClosePrices] = useState({}); // EODHD-polled previous close prices
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [thresholds, setThresholds] = useState(battle?.thresholds || {});

  // Determine if user is creator
  const isCreator = battle?.creator?.uid === user?.uid ||
                    battle?.creator?.uid === user?.odUserId ||
                    battle?.creator?.odUserId === user?.odUserId ||
                    battle?.creator?.username === user?.username;

  const playerId = isCreator ? 'creator' : 'opponent';
  const myData = isCreator ? battle?.creator : battle?.opponent;
  const oppData = isCreator ? battle?.opponent : battle?.creator;
  const [startingPrices, setStartingPrices] = useState(battle?.state?.startingPrices || {});

  // Previous close prices for threshold baseline — layered per-symbol merge:
  // Layer 1 (base): startingPrices (entry fallback for day 1 / old battles)
  // Layer 2: Firebase battle.state.previousClosePrices (may be stale after day 1)
  // Layer 3 (wins): EODHD-polled previousClosePrices (freshest daily data)
  const previousClosePriceMap = useMemo(() => {
    const map = { ...(startingPrices || {}) };
    const fbPrevClose = battle?.state?.previousClosePrices;
    if (fbPrevClose && typeof fbPrevClose === 'object') {
      Object.entries(fbPrevClose).forEach(([sym, price]) => {
        if (price > 0) map[sym] = price;
      });
    }
    if (previousClosePrices && typeof previousClosePrices === 'object') {
      Object.entries(previousClosePrices).forEach(([sym, price]) => {
        if (price > 0) map[sym] = price;
      });
    }
    console.log('[BB-Fix] Training previousClosePriceMap:', {
      sampleSymbol: Object.keys(map)[0],
      entry: startingPrices?.[Object.keys(map)[0]],
      firebase: battle?.state?.previousClosePrices?.[Object.keys(map)[0]],
      eodhd: previousClosePrices?.[Object.keys(map)[0]],
      result: map[Object.keys(map)[0]],
    });
    return map;
  }, [battle?.state?.previousClosePrices, previousClosePrices, startingPrices]);

  // Free agent daily open prices (for card % display — shows today's change)
  const [freeAgentDailyOpens, setFreeAgentDailyOpens] = useState({});

  // --- Free agent state: initialize from battle (Firebase), NOT generated ---
  const battleFreeAgents = battle?.freeAgents?.current || [];
  const [freeAgents, setFreeAgents] = useState(battleFreeAgents);
  const [rotationCountdown, setRotationCountdown] = useState(0);
  const nextRotationRef = useRef(null);
  const rotationCountRef = useRef(battle?.freeAgents?.rotationCount || 0);

  // --- Swap state: initialize from battle data for persistence ---
  // V5: 3 swaps for training (up from 1)
  const TRAINING_SWAPS = 3;
  const battleSwapHistory = myData?.swaps?.history || [];
  const battleSwapsRemaining = myData?.swaps?.remaining?.day1 ?? TRAINING_SWAPS;
  const [swapsRemaining, setSwapsRemaining] = useState(battleSwapsRemaining);
  const [closedTrades, setClosedTrades] = useState(myData?.closedTrades || []);
  const [localPortfolio, setLocalPortfolio] = useState(null);

  // V5: Swap Market modal state (replaces old multi-step swap mode)
  const [showSwapMarket, setShowSwapMarket] = useState(false);
  const [swapMode, setSwapMode] = useState({
    active: false,
    selectedFreeAgent: null,
    step: 'idle',
    targetAsset: null,
    swapType: null,    // 'stock' | 'crypto' | 'cash'
    direction: null,   // 'long' | 'short' | null
  });
  const [isSwapExecuting, setIsSwapExecuting] = useState(false);

  // Reset swap/trade state when switching between training battles
  useEffect(() => {
    const remaining = myData?.swaps?.remaining?.day1 ?? TRAINING_SWAPS;
    setSwapsRemaining(remaining);
    setClosedTrades(myData?.closedTrades || []);
    setLocalPortfolio(null);
  }, [battle?.id, myData?.swaps?.remaining?.day1, myData?.closedTrades]);

  // Re-sync free agents when battle data loads asynchronously (handles Firebase load after mount)
  useEffect(() => {
    const battleAgents = battle?.freeAgents?.current || [];
    if (battleAgents.length > 0 && freeAgents.length === 0) {
      setFreeAgents(battleAgents);
      rotationCountRef.current = battle?.freeAgents?.rotationCount || 0;

      const nextRotationAt = battle?.freeAgents?.nextRotationAt;
      if (nextRotationAt) {
        nextRotationRef.current = new Date(nextRotationAt).getTime();
        setRotationCountdown(Math.max(0, Math.floor((nextRotationRef.current - Date.now()) / 1000)));
      }
    }
  }, [battle?.freeAgents?.current, battle?.freeAgents?.rotationCount, battle?.freeAgents?.nextRotationAt, freeAgents.length]);

  // Training events for Live Feed
  const [trainingEvents, setTrainingEvents] = useState([]);
  const prevPlayerMultRef = useRef({});
  const prevOppMultRef = useRef({});
  const playerHistoryRef = useRef({});
  const oppHistoryRef = useRef({});
  const redZoneActiveRef = useRef(new Set());

  // Use local portfolio if swap has occurred in this session, otherwise use battle portfolio
  const myPortfolioRaw = localPortfolio || myData?.portfolio;

  // Collect all symbols for price fetching (roster + free agents + crypto pool)
  const allSymbols = useMemo(() => {
    const myPortfolio = flattenPortfolio(myPortfolioRaw);
    const oppPortfolio = flattenPortfolio(oppData?.portfolio);
    const freeAgentSymbols = freeAgents.map(a => a.symbol);
    const cryptoPoolSymbols = BAGGERBOMB_CRYPTO_POOL.map(c => c.symbol);

    const symbols = [
      ...myPortfolio.map(a => a?.symbol),
      ...oppPortfolio.map(a => a?.symbol),
      ...freeAgentSymbols,
      ...cryptoPoolSymbols,
    ].filter(s => s && s !== 'CASH'); // V5: Don't fetch price for CASH

    return [...new Set(symbols)];
  }, [myPortfolioRaw, oppData, freeAgents]);

  // WebSocket real-time prices — merge into currentPrices
  const { prices: wsPrices, status: wsStatus } = useWebSocketPrices(allSymbols);

  useEffect(() => {
    if (Object.keys(wsPrices).length > 0) {
      setCurrentPrices(prev => ({ ...prev, ...wsPrices }));
    }
  }, [wsPrices]);

  // --- Initialize free agents from battle data on mount ---
  useEffect(() => {
    const battleAgents = battle?.freeAgents?.current || [];
    const nextRotationAt = battle?.freeAgents?.nextRotationAt;

    if (battleAgents.length > 0) {
      // Read persisted free agents from Firebase
      setFreeAgents(battleAgents);
      rotationCountRef.current = battle?.freeAgents?.rotationCount || 0;

      if (nextRotationAt) {
        nextRotationRef.current = new Date(nextRotationAt).getTime();
        setRotationCountdown(Math.max(0, Math.floor((nextRotationRef.current - Date.now()) / 1000)));
      } else {
        // No rotation set, calculate from now
        const config = getFreeAgentConfig();
        nextRotationRef.current = Date.now() + config.rotationMs;
        setRotationCountdown(Math.floor(config.rotationMs / 1000));
      }
    } else {
      // Fallback: battle was created before free agents were populated (legacy)
      const config = getFreeAgentConfig();
      const pool = generateFreeAgentPool(0, config.mode);
      setFreeAgents(pool);
      nextRotationRef.current = Date.now() + config.rotationMs;
      setRotationCountdown(Math.floor(config.rotationMs / 1000));

      // Persist to Firebase so they stick on re-entry
      if (battle?.id) {
        const nextAt = new Date(Date.now() + config.rotationMs).toISOString();
        persistRotationToFirebase(battle.id, pool, nextAt, 0);
      }
    }
  }, []); // Run once on mount

  // Rotation countdown + auto-rotate (with Firebase persistence)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!nextRotationRef.current) return;
      const remaining = Math.max(0, Math.floor((nextRotationRef.current - Date.now()) / 1000));
      setRotationCountdown(remaining);

      if (remaining === 0) {
        rotationCountRef.current += 1;
        const config = getFreeAgentConfig();
        const pool = generateFreeAgentPool(rotationCountRef.current, config.mode);
        setFreeAgents(pool);
        nextRotationRef.current = Date.now() + config.rotationMs;

        // Persist new rotation to Firebase
        if (battle?.id) {
          const nextAt = new Date(Date.now() + config.rotationMs).toISOString();
          persistRotationToFirebase(battle.id, pool, nextAt, rotationCountRef.current);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [battle?.id]);

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    if (allSymbols.length === 0) {
      setLoadingPrices(false);
      return;
    }

    try {
      const prices = {};

      // Batch fetch: 2 HTTP requests total instead of N individual calls
      const stockSymbols = allSymbols.filter(s => !isCryptoSymbol(s));
      const cryptoSymbols = allSymbols.filter(s => isCryptoSymbol(s));

      const [stockData, cryptoData] = await Promise.all([
        stockSymbols.length > 0 ? stockAPI.getMultipleStockPrices(stockSymbols) : {},
        cryptoSymbols.length > 0 ? stockAPI.getMultipleCryptoPrices(cryptoSymbols) : {},
      ]);

      const newPreviousCloses = {};

      // Collect prices and previousClose from EODHD — but NOT high/low.
      // EODHD data.high/data.low reflect the full trading day including
      // pre-activation movement, which causes false BaggerBomb/Bust triggers.
      Object.entries(stockData).forEach(([symbol, data]) => {
        if (data?.price) prices[symbol] = data.price;
        if (data?.previousClose) newPreviousCloses[symbol] = data.previousClose;
      });
      Object.entries(cryptoData).forEach(([symbol, data]) => {
        if (data?.price) prices[symbol] = data.price;
        if (data?.previousClose) newPreviousCloses[symbol] = data.previousClose;
      });

      if (Object.keys(newPreviousCloses).length > 0) {
        setPreviousClosePrices(prev => ({ ...prev, ...newPreviousCloses }));
        console.log('[BB-Fix] Training EODHD previousClose fetched:', {
          count: Object.keys(newPreviousCloses).length,
          sample: Object.entries(newPreviousCloses).slice(0, 3).map(([s, p]) => `${s}=${p}`).join(', '),
        });
      }

      // Extract daily open prices from batch API (used for FreeAgentBar % display)
      const apiDailyOpens = {};
      Object.entries(stockData).forEach(([symbol, data]) => {
        if (data?.open && data.open > 0) apiDailyOpens[symbol] = data.open;
      });
      Object.entries(cryptoData).forEach(([symbol, data]) => {
        if (data?.open && data.open > 0) apiDailyOpens[symbol] = data.open;
      });
      if (Object.keys(apiDailyOpens).length > 0) {
        setFreeAgentDailyOpens(prev => ({ ...prev, ...apiDailyOpens }));
      }

      // Fill in startingPrices fallback for any symbols not returned by batch
      for (const symbol of allSymbols) {
        if (!prices[symbol] && startingPrices[symbol]) {
          prices[symbol] = startingPrices[symbol];
        }
      }

      setCurrentPrices(prev => ({ ...prev, ...prices }));

      // Backfill free agent starting prices that were 0 placeholders
      setStartingPrices(prev => {
        const updated = { ...prev };
        let changed = false;
        freeAgents.forEach(agent => {
          if ((!updated[agent.symbol] || updated[agent.symbol] === 0) && prices[agent.symbol]) {
            updated[agent.symbol] = prices[agent.symbol];
            changed = true;
          }
        });
        if (changed && battle?.id) {
          // Persist backfilled starting prices to Firebase
          persistSwapToFirebase(battle.id, playerId, { 'state.startingPrices': updated });
        }
        return changed ? updated : prev;
      });

      setLoadingPrices(false);
    } catch (error) {
      console.error('[TrainingBattleV4] Error fetching prices:', error);
      setCurrentPrices(startingPrices);
      setLoadingPrices(false);
    }
  }, [allSymbols, startingPrices, freeAgents, battle?.id, playerId]);

  // Load thresholds — use stored battle thresholds; only fetch from API for missing symbols (e.g. free agents)
  useEffect(() => {
    const loadThresholds = async () => {
      if (allSymbols.length === 0) return;
      // Only fetch for symbols not already in stored battle thresholds
      const storedThresholds = battle?.thresholds || {};
      const missingSymbols = allSymbols.filter(s => !storedThresholds[s]);
      if (missingSymbols.length === 0) return;

      const stockSymbols = missingSymbols.filter(s => !isCryptoSymbol(s));
      const cryptoSymbols = missingSymbols.filter(s => isCryptoSymbol(s));

      try {
        const [stockT, cryptoT] = await Promise.all([
          stockSymbols.length > 0 ? getVolatilityThresholds(stockSymbols, 'stock') : {},
          cryptoSymbols.length > 0 ? getVolatilityThresholds(cryptoSymbols, 'crypto') : {},
        ]);
        setThresholds(prev => ({ ...prev, ...stockT, ...cryptoT }));
      } catch (error) {
        console.error('[TrainingBattleV4] Error loading thresholds:', error);
      }
    };
    loadThresholds();
  }, [allSymbols, battle?.thresholds]);

  // Price polling
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Daily opens for free agents are now extracted from the batch stock/crypto API
  // response in fetchPrices() above — no separate OHLCV fetch needed.

  // Enrich asset with live data and scoring
  const enrichAsset = useCallback((asset, tier) => {
    if (!asset) return null;

    // V5: Cash positions earn 0 points, no scoring
    if (asset.isCash) {
      return {
        ...asset,
        priceChange: 0,
        baseATR: 0,
        points: 0,
        badges: [],
        history: { maxMultiplier: 0, minMultiplier: 0 },
        tierMultiplier: 1,
      };
    }

    const openPrice = asset.swapPrice || startingPrices[asset.symbol] || asset.price || 0;
    const currentPrice = currentPrices[asset.symbol] || openPrice;
    const threshold = thresholds[asset.symbol] || {};
    const baseATR = threshold.threshold || DEFAULT_THRESHOLD;
    let priceChange = openPrice > 0 ? ((currentPrice - openPrice) / openPrice) * 100 : 0;

    // V5: Invert for short positions
    if (asset.direction === 'short') {
      priceChange = -priceChange;
    }

    // Compute daily-relative threshold price change for ChamberFuse/ProximityLabel
    const prevClose = previousClosePriceMap[asset.symbol] || openPrice;
    let thresholdPriceChange = prevClose > 0
      ? ((currentPrice - prevClose) / prevClose) * 100
      : priceChange; // fallback to entry-relative if no prevClose
    // Short position inversion for threshold
    if (asset.direction === 'short') {
      thresholdPriceChange = -thresholdPriceChange;
    }

    const multiplier = baseATR > 0 ? thresholdPriceChange / baseATR : 0;

    const history = {
      maxMultiplier: multiplier > 0 ? multiplier : 0,
      minMultiplier: multiplier < 0 ? multiplier : 0,
    };

    const score = calculateAssetScoreV3(
      { ...asset, baseATR, tier },
      priceChange,
      history,
      {}, // extremeChanges
      thresholdPriceChange
    );

    return {
      ...asset,
      priceChange,
      thresholdPriceChange,
      baseATR,
      points: score.totalPoints,
      badges: score.badges,
      history,
      tierMultiplier: score.tierMultiplier,
      previousClosePrice: prevClose,
    };
  }, [currentPrices, startingPrices, thresholds, previousClosePriceMap]);

  // Threshold detection for training events (both player + opponent)
  useEffect(() => {
    if (!currentPrices || Object.keys(currentPrices).length === 0) return;
    if (!startingPrices || Object.keys(startingPrices).length === 0) return;

    const detectForPortfolio = (portfolioRaw, prevMultRef, historyRef, username) => {
      const flat = flattenPortfolio(portfolioRaw);
      flat.forEach((asset) => {
        if (!asset) return;
        // V5: Skip cash positions entirely — no thresholds, no events
        if (asset.isCash) return;

        // Daily baseline for threshold detection (previousClose resets each day)
        const dailyBaseline = previousClosePriceMap[asset.symbol] || asset.swapPrice || startingPrices[asset.symbol] || asset.price || 0;
        const currentPrice = currentPrices[asset.symbol] || dailyBaseline;
        if (!dailyBaseline || !currentPrice) return;

        let priceChange = dailyBaseline > 0 ? ((currentPrice - dailyBaseline) / dailyBaseline) * 100 : 0;
        // V5: Invert for short positions
        if (asset.direction === 'short') {
          priceChange = -priceChange;
        }

        const baseATR = thresholds[asset.symbol]?.threshold || DEFAULT_THRESHOLD;
        const currentMultiplier = baseATR > 0 ? priceChange / baseATR : 0;
        const prevMultiplier = prevMultRef.current[asset.symbol] || 0;

        // Use accumulated history (checked BEFORE current update) for deduplication
        const assetHistory = historyRef.current[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };

        const crossed = detectThresholdCross(prevMultiplier, currentMultiplier);
        if (crossed) {
          crossed.forEach((threshold) => {
            const existingBadges = getBadgesFromHistory(assetHistory);
            if (!existingBadges.includes(threshold.name)) {
              const event = createThresholdEvent(
                username,
                asset.symbol,
                threshold.name,
                currentMultiplier,
                threshold.points,
                asset.direction
              );
              setTrainingEvents(prev => [event, ...prev].slice(0, 50));
            }
          });
        }

        // Update accumulated history AFTER the check
        historyRef.current[asset.symbol] = {
          maxMultiplier: Math.max(assetHistory.maxMultiplier, currentMultiplier),
          minMultiplier: Math.min(assetHistory.minMultiplier, currentMultiplier),
        };

        // Red Zone detection — within 25% of next threshold
        const updatedBadges = getBadgesFromHistory(historyRef.current[asset.symbol]);
        const rz = detectRedZone(currentMultiplier, updatedBadges);
        const rzKey = rz ? `${asset.symbol}_${rz.direction}_${rz.targetMultiple}` : null;

        if (rz && rzKey && !redZoneActiveRef.current.has(rzKey)) {
          redZoneActiveRef.current.add(rzKey);
          const newEvent = {
            id: `${Date.now()}-${asset.symbol}-redzone-${rz.targetThreshold}`,
            timestamp: new Date().toISOString(),
            type: 'redzone',
            player: username,
            symbol: asset.symbol,
            direction: rz.direction,
            targetThreshold: rz.targetThreshold,
            targetMultiple: rz.targetMultiple,
            progress: rz.progress,
            multiplier: currentMultiplier,
            points: 0,
          };
          setTrainingEvents(prev => {
            // Dedup: skip if an identical redzone event exists within 10 minutes
            const DEDUP_WINDOW = 10 * 60 * 1000;
            const now = Date.now();
            const isDuplicate = prev.some(e =>
              e.type === 'redzone' &&
              e.symbol === newEvent.symbol &&
              e.targetThreshold === newEvent.targetThreshold &&
              e.direction === newEvent.direction &&
              (now - new Date(e.timestamp).getTime()) < DEDUP_WINDOW
            );
            if (isDuplicate) return prev; // Don't add duplicate
            return [newEvent, ...prev].slice(0, 50);
          });
        }
        // Only clear stale red zone keys when transitioning to a DIFFERENT target.
        // When rz is null (left zone), preserve keys to prevent re-trigger on oscillation.
        if (rzKey) {
          redZoneActiveRef.current.forEach(key => {
            if (key.startsWith(`${asset.symbol}_`) && key !== rzKey) {
              redZoneActiveRef.current.delete(key);
            }
          });
        }

        prevMultRef.current[asset.symbol] = currentMultiplier;
      });
    };

    detectForPortfolio(myPortfolioRaw, prevPlayerMultRef, playerHistoryRef, myData?.username || 'You');
    detectForPortfolio(oppData?.portfolio, prevOppMultRef, oppHistoryRef, oppData?.username || 'CPU Opponent');
  }, [currentPrices, startingPrices, previousClosePriceMap, thresholds, myPortfolioRaw, oppData?.portfolio, myData?.username, oppData?.username]);

  // Build enriched portfolio (pass tier for conviction multiplier)
  const buildEnrichedPortfolio = useCallback((rawPortfolio) => {
    if (!rawPortfolio) return { star: [], core: [], support: [] };
    if (rawPortfolio.star || rawPortfolio.core || rawPortfolio.support) {
      return {
        star: (rawPortfolio.star || []).map(a => enrichAsset(a, 'star')).filter(Boolean),
        core: (rawPortfolio.core || []).map(a => enrichAsset(a, 'core')).filter(Boolean),
        support: (rawPortfolio.support || []).map(a => enrichAsset(a, 'support')).filter(Boolean),
      };
    }
    return { star: [], core: [], support: [] };
  }, [enrichAsset]);

  // Calculate total points
  const calculateTotalPoints = useCallback((portfolio) => {
    const allAssets = [
      ...(portfolio.star || []),
      ...(portfolio.core || []),
      ...(portfolio.support || []),
    ];
    return allAssets.reduce((sum, asset) => sum + (asset?.points || 0), 0);
  }, []);

  // Count badges
  const countBadges = useCallback((portfolio) => {
    const allAssets = [
      ...(portfolio.star || []),
      ...(portfolio.core || []),
      ...(portfolio.support || []),
    ];
    let baggerBombs = 0;
    let busts = 0;
    allAssets.forEach(asset => {
      if (asset?.badges?.some(b => ['bagger', 'doubleBagger', 'tenBagger'].includes(b))) baggerBombs++;
      if (asset?.badges?.some(b => ['bust', 'crash', 'meltdown'].includes(b))) busts++;
    });
    return { baggerBombs, busts };
  }, []);

  // V5 Swap Market handlers
  const handleSwapMarketOpen = useCallback(() => {
    if (swapsRemaining <= 0) return;
    setShowSwapMarket(true);
  }, [swapsRemaining]);

  // Called when user picks a stock from free agent bar in swap market
  const handleSwapStock = useCallback((stockAgent) => {
    setShowSwapMarket(false);
    setSwapMode({
      active: true,
      selectedFreeAgent: stockAgent,
      step: 'selectTarget',
      targetAsset: null,
      swapType: 'stock',
      direction: null,
    });
  }, []);

  // Called when user picks a crypto from crypto pool with direction
  const handleSwapCryptoLong = useCallback((crypto) => {
    setShowSwapMarket(false);
    setSwapMode({
      active: true,
      selectedFreeAgent: crypto,
      step: 'selectTarget',
      targetAsset: null,
      swapType: 'crypto',
      direction: 'long',
    });
  }, []);

  const handleSwapCryptoShort = useCallback((crypto) => {
    setShowSwapMarket(false);
    setSwapMode({
      active: true,
      selectedFreeAgent: crypto,
      step: 'selectTarget',
      targetAsset: null,
      swapType: 'crypto',
      direction: 'short',
    });
  }, []);

  // Called when user taps "Go to Cash"
  const handleGoToCash = useCallback(() => {
    setShowSwapMarket(false);
    setSwapMode({
      active: true,
      selectedFreeAgent: CASH_POSITION,
      step: 'selectTarget',
      targetAsset: null,
      swapType: 'cash',
      direction: null,
    });
  }, []);

  // V5: Select which roster slot to swap (target picker)
  const selectSwapTarget = useCallback((asset, tier, slotIndex) => {
    if (!swapMode.active || swapMode.step !== 'selectTarget') return;

    const { swapType, selectedFreeAgent } = swapMode;

    // Type restriction for stocks: can only target stock slots (not crypto slot)
    if (swapType === 'stock') {
      if (!asset.isCash && asset.isCrypto) return; // Can't put stock into active crypto slot
      if (asset.isCash && tier === 'support' && slotIndex === 2) return; // Can't fill crypto-slot cash with stock
    }
    // Type restriction for crypto: can only target crypto slot (support[2])
    if (swapType === 'crypto') {
      if (!asset.isCash && !asset.isCrypto) {
        // Can only go into support[2] (crypto slot)
        if (!(tier === 'support' && slotIndex === 2)) return;
      }
      if (asset.isCash && !(tier === 'support' && slotIndex === 2)) return;
    }
    // Cash: any slot allowed (but not if already cash)
    if (swapType === 'cash' && asset.isCash) return;

    // Orange zone swap lock (skip for cash slots)
    if (!asset.isCash) {
      const oPrice = asset.swapPrice || startingPrices[asset.symbol] || asset.price || 0;
      const cPrice = currentPrices[asset.symbol] || oPrice;
      const bATR = thresholds[asset.symbol]?.threshold || DEFAULT_THRESHOLD;
      let mult = oPrice > 0 ? ((cPrice - oPrice) / oPrice) * 100 / bATR : 0;
      if (asset.direction === 'short') mult = -mult;
      if (isSwapLocked(mult, bATR).locked) return;
    }

    setSwapMode(prev => ({
      ...prev,
      targetAsset: {
        symbol: asset.symbol,
        name: asset.name,
        tier,
        slotIndex,
        isCrypto: asset.isCrypto,
        isCash: asset.isCash,
        direction: asset.direction,
      },
      step: 'confirming',
    }));
  }, [swapMode, startingPrices, currentPrices, thresholds]);

  const cancelSwapMode = useCallback(() => {
    setSwapMode({ active: false, selectedFreeAgent: null, step: 'idle', targetAsset: null, swapType: null, direction: null });
  }, []);

  // V5: Execute swap with Firebase persistence + local optimistic update
  // Handles all swap types: stock, crypto (with direction), cash, fill-cash
  const executeSwapV5 = useCallback(({ outTier, outSlotIndex, selectedAgent, swapType, direction, displayedPoints }) => {
    if (swapsRemaining <= 0) return;

    setIsSwapExecuting(true);

    try {
      const portfolio = localPortfolio || { ...myData?.portfolio };
      const portfolioClone = {
        star: [...(portfolio.star || [])],
        core: [...(portfolio.core || [])],
        support: [...(portfolio.support || [])],
      };
      const outAsset = portfolioClone[outTier]?.[outSlotIndex];
      if (!outAsset) throw new Error('No asset in selected slot');

      const now = new Date().toISOString();
      let closedTrade = null;
      let incomingAsset;
      let updatedAgents = freeAgents;
      const inSymbol = selectedAgent?.symbol;

      // Calculate locked points for outgoing asset (skip if cash slot)
      if (!outAsset.isCash) {
        const openPrice = outAsset.swapPrice || startingPrices[outAsset.symbol] || outAsset.price || 0;
        const exitPrice = currentPrices[outAsset.symbol] || openPrice;
        let lockedGainPct = openPrice > 0 ? ((exitPrice - openPrice) / openPrice) * 100 : 0;

        // Invert for short positions
        if (outAsset.direction === 'short') {
          lockedGainPct = -lockedGainPct;
        }

        const lockedPoints = displayedPoints != null
          ? Math.round(displayedPoints * 10) / 10
          : Math.round(lockedGainPct * 10) / 10;

        closedTrade = {
          symbol: outAsset.symbol,
          name: outAsset.name || outAsset.symbol,
          tier: outTier,
          slotIndex: outSlotIndex,
          entryPrice: openPrice,
          exitPrice,
          lockedPoints,
          lockedGainPct: Math.round(lockedGainPct * 1000) / 1000,
          swappedOutAt: now,
          isCrypto: outAsset.isCrypto || false,
          direction: outAsset.direction || null,
          closedToCash: swapType === 'cash',
        };
      }

      // Build incoming asset
      if (swapType === 'cash') {
        incomingAsset = {
          symbol: 'CASH',
          name: 'Cash',
          baseATR: 0,
          isCrypto: false,
          isCash: true,
          cashedAt: now,
          previousAsset: outAsset.symbol,
        };
      } else {
        const swapPrice = currentPrices[inSymbol] || 0;
        incomingAsset = {
          symbol: selectedAgent.symbol,
          name: selectedAgent.name,
          isCrypto: selectedAgent.isCrypto || false,
          baseATR: selectedAgent.baseATR || (selectedAgent.isCrypto ? 5.0 : 2.5),
          swapPrice,
          swappedInAt: now,
        };
        if (selectedAgent.isCrypto && direction) {
          incomingAsset.direction = direction;
        }
      }

      // Update portfolio slot
      portfolioClone[outTier] = [...portfolioClone[outTier]];
      portfolioClone[outTier][outSlotIndex] = incomingAsset;

      // Free agent bar updates (only for stock swaps from free agent bar)
      if (swapType === 'stock') {
        const agentIndex = freeAgents.findIndex(a => a.symbol === inSymbol);
        if (agentIndex >= 0) {
          updatedAgents = [...freeAgents];
          if (outAsset.isCash || outAsset.isCrypto) {
            // Filling cash slot or crossing types: picked stock removed, no replacement
            updatedAgents.splice(agentIndex, 1);
          } else {
            // Stock → Stock: dropped stock replaces picked stock's position
            updatedAgents[agentIndex] = {
              symbol: outAsset.symbol,
              name: outAsset.name || outAsset.symbol,
              isCrypto: false,
              appearedAt: now,
            };
          }
          setFreeAgents(updatedAgents);
        }
      }

      const newClosedTrades = closedTrade
        ? [...closedTrades, closedTrade]
        : [...closedTrades];

      // Optimistic local state update
      setLocalPortfolio(portfolioClone);
      setClosedTrades(newClosedTrades);
      setSwapsRemaining(prev => Math.max(0, prev - 1));

      // Persist to Firebase
      if (battle?.id) {
        const swapRecord = {
          timestamp: now,
          day: 1,
          removedSymbol: outAsset.isCash ? 'CASH' : outAsset.symbol,
          removedTier: outTier,
          removedSlotIndex: outSlotIndex,
          addedSymbol: swapType === 'cash' ? 'CASH' : inSymbol,
          swapType,
          direction: direction || null,
          swapPrice: swapType === 'cash' ? 0 : (currentPrices[inSymbol] || 0),
          lockedPoints: closedTrade?.lockedPoints || 0,
        };

        const swapHistory = [...(myData?.swaps?.history || []), swapRecord];
        const newRemainingVal = Math.max(0, swapsRemaining - 1);
        const newRemaining = { day1: newRemainingVal };

        const updatedStartingPrices = { ...startingPrices };
        if (swapType !== 'cash' && inSymbol) {
          updatedStartingPrices[inSymbol] = currentPrices[inSymbol] || 0;
        }

        const updates = {
          [`${playerId}.portfolio`]: portfolioClone,
          [`${playerId}.closedTrades`]: newClosedTrades,
          [`${playerId}.swaps.remaining`]: newRemaining,
          [`${playerId}.swaps.history`]: swapHistory,
          'freeAgents.current': updatedAgents,
          'state.startingPrices': updatedStartingPrices,
          updatedAt: now,
        };

        persistSwapToFirebase(battle.id, playerId, updates);
      }
    } catch (error) {
      console.error('[TrainingV5] Swap error:', error);
    } finally {
      setIsSwapExecuting(false);
    }
  }, [swapsRemaining, localPortfolio, myData, freeAgents, startingPrices, currentPrices, closedTrades, battle, playerId]);

  // V5: Confirm swap from swap mode flow
  const confirmSwap = useCallback(() => {
    if (!swapMode.targetAsset || !swapMode.selectedFreeAgent) return;

    const enrichedPortfolio = buildEnrichedPortfolio(myPortfolioRaw);
    const enrichedAsset = enrichedPortfolio[swapMode.targetAsset.tier]?.[swapMode.targetAsset.slotIndex];
    const displayedPoints = enrichedAsset?.points ?? null;

    executeSwapV5({
      outTier: swapMode.targetAsset.tier,
      outSlotIndex: swapMode.targetAsset.slotIndex,
      selectedAgent: swapMode.selectedFreeAgent,
      swapType: swapMode.swapType,
      direction: swapMode.direction,
      displayedPoints,
    });
    cancelSwapMode();
  }, [swapMode, executeSwapV5, cancelSwapMode, buildEnrichedPortfolio, myPortfolioRaw]);

  // Build player data
  const player = useMemo(() => {
    const portfolio = buildEnrichedPortfolio(myPortfolioRaw);
    const totalPoints = calculateTotalPoints(portfolio);
    const { baggerBombs, busts } = countBadges(portfolio);
    const closedPts = closedTrades.reduce((sum, t) => sum + (t.lockedPoints || 0), 0);

    return {
      id: myData?.odUserId || myData?.uid || 'player',
      username: myData?.username || myData?.odUsername || 'You',
      avatar: myData?.avatar,
      totalPoints: Math.round(totalPoints + closedPts),
      baggerBombs,
      busts,
      portfolio,
    };
  }, [myPortfolioRaw, buildEnrichedPortfolio, calculateTotalPoints, countBadges, myData, closedTrades]);

  // Build opponent data (CPU)
  const opponent = useMemo(() => {
    const portfolio = buildEnrichedPortfolio(oppData?.portfolio);
    const totalPoints = calculateTotalPoints(portfolio);
    const { baggerBombs, busts } = countBadges(portfolio);

    return {
      id: oppData?.odUserId || 'cpu',
      username: oppData?.username || 'CPU Opponent',
      avatar: null,
      totalPoints: Math.round(totalPoints),
      baggerBombs,
      busts,
      portfolio,
    };
  }, [oppData, buildEnrichedPortfolio, calculateTotalPoints, countBadges]);

  // Merge local training events with Firebase battle.events (for swap history)
  const mergedTrainingEvents = useMemo(() => {
    const firebaseEvents = (battle?.events || []).map(e => {
      if (e.type === 'swap') {
        const username = e.playerId === 'creator'
          ? (battle?.creator?.username || 'You')
          : (battle?.opponent?.username || 'CPU Opponent');
        return {
          ...e,
          id: e.id || `swap_${e.timestamp}_${e.removedSymbol}`,
          player: username,
          symbol: e.removedSymbol || e.addedSymbol,
        };
      }
      return e;
    });
    const localIds = new Set(trainingEvents.map(e => e.id));
    const uniqueFirebase = firebaseEvents.filter(e => {
      const eid = e.id || `fb_${e.timestamp}_${e.symbol}_${e.type}`;
      return !localIds.has(eid);
    });
    return [...trainingEvents, ...uniqueFirebase];
  }, [trainingEvents, battle?.events, battle?.creator?.username, battle?.opponent?.username]);

  // Loading
  if (loadingPrices && Object.keys(currentPrices).length === 0) {
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

  return (
    <BaggerBombBattleView
      battle={battle}
      player={player}
      opponent={opponent}
      events={mergedTrainingEvents}
      onBack={onBack}
      nightMode={false}
      isTraining={true}
      thresholds={thresholds}
      currentPrices={currentPrices}
      battleVersion={5}
      freeAgentConfig={{
        freeAgents,
        nextRotationAt: null,
        freeAgentDailyOpens,
        swapsRemaining,
        currentDay: 1,
        totalDays: 1,
        rotationCountdown,
        swapMode,
        onEnterSwapMode: handleSwapMarketOpen,
        onCancelSwapMode: cancelSwapMode,
      }}
      // V5: Swap Market props
      showSwapMarket={showSwapMarket}
      onCloseSwapMarket={() => setShowSwapMarket(false)}
      onSwapStock={handleSwapStock}
      onSwapCryptoLong={handleSwapCryptoLong}
      onSwapCryptoShort={handleSwapCryptoShort}
      onGoToCash={handleGoToCash}
      rosterAssets={flattenPortfolio(myPortfolioRaw)}
      closedTrades={closedTrades}
      onSelectSwapTarget={selectSwapTarget}
      onConfirmSwap={confirmSwap}
      isSwapExecuting={isSwapExecuting}
    />
  );
}

BaggerBombTrainingBattleViewV4.propTypes = {
  battle: PropTypes.shape({
    id: PropTypes.string,
    creator: PropTypes.object,
    opponent: PropTypes.object,
    state: PropTypes.shape({
      startingPrices: PropTypes.object,
    }),
    freeAgents: PropTypes.shape({
      current: PropTypes.array,
      nextRotationAt: PropTypes.string,
      rotationCount: PropTypes.number,
    }),
  }).isRequired,
  user: PropTypes.shape({
    uid: PropTypes.string,
    odUserId: PropTypes.string,
    username: PropTypes.string,
  }),
  onBack: PropTypes.func,
};

BaggerBombTrainingBattleViewV4.defaultProps = {
  user: null,
  onBack: () => {},
};
