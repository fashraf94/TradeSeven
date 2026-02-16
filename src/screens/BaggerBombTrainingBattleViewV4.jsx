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
import { stockAPI, POPULAR_CRYPTO, fetchHistoricalOHLCV } from '../services/eodhdAPI';
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
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [thresholds, setThresholds] = useState({});

  // Determine if user is creator
  const isCreator = battle?.creator?.uid === user?.uid ||
                    battle?.creator?.uid === user?.odUserId ||
                    battle?.creator?.odUserId === user?.odUserId ||
                    battle?.creator?.username === user?.username;

  const playerId = isCreator ? 'creator' : 'opponent';
  const myData = isCreator ? battle?.creator : battle?.opponent;
  const oppData = isCreator ? battle?.opponent : battle?.creator;
  const [startingPrices, setStartingPrices] = useState(battle?.state?.startingPrices || {});

  // Free agent daily open prices (for card % display — shows today's change)
  const [freeAgentDailyOpens, setFreeAgentDailyOpens] = useState({});

  // --- Free agent state: initialize from battle (Firebase), NOT generated ---
  const battleFreeAgents = battle?.freeAgents?.current || [];
  const [freeAgents, setFreeAgents] = useState(battleFreeAgents);
  const [rotationCountdown, setRotationCountdown] = useState(0);
  const nextRotationRef = useRef(null);
  const rotationCountRef = useRef(battle?.freeAgents?.rotationCount || 0);

  // --- Swap state: initialize from battle data for persistence ---
  const battleSwapHistory = myData?.swaps?.history || [];
  const battleSwapsRemaining = myData?.swaps?.remaining?.day1 ?? 1;
  const [swapUsed, setSwapUsed] = useState(battleSwapHistory.length > 0 || battleSwapsRemaining === 0);
  const [closedTrades, setClosedTrades] = useState(myData?.closedTrades || []);
  const [localPortfolio, setLocalPortfolio] = useState(null);

  // Swap mode state (multi-step flow)
  const [swapMode, setSwapMode] = useState({
    active: false,
    selectedFreeAgent: null,
    step: 'idle',
    targetAsset: null,
  });
  const [isSwapExecuting, setIsSwapExecuting] = useState(false);

  // Reset swap/trade state when switching between training battles
  useEffect(() => {
    const history = myData?.swaps?.history || [];
    const remaining = myData?.swaps?.remaining?.day1 ?? 1;
    setSwapUsed(history.length > 0 || remaining === 0);
    setClosedTrades(myData?.closedTrades || []);
    setLocalPortfolio(null);
  }, [battle?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Training events for Live Feed
  const [trainingEvents, setTrainingEvents] = useState([]);
  const prevPlayerMultRef = useRef({});
  const prevOppMultRef = useRef({});
  const playerHistoryRef = useRef({});
  const oppHistoryRef = useRef({});
  const redZoneActiveRef = useRef(new Set());

  // Use local portfolio if swap has occurred in this session, otherwise use battle portfolio
  const myPortfolioRaw = localPortfolio || myData?.portfolio;

  // Collect all symbols for price fetching (roster + free agents)
  const allSymbols = useMemo(() => {
    const myPortfolio = flattenPortfolio(myPortfolioRaw);
    const oppPortfolio = flattenPortfolio(oppData?.portfolio);
    const freeAgentSymbols = freeAgents.map(a => a.symbol);

    const symbols = [
      ...myPortfolio.map(a => a?.symbol),
      ...oppPortfolio.map(a => a?.symbol),
      ...freeAgentSymbols,
    ].filter(Boolean);

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

      Object.entries(stockData).forEach(([symbol, data]) => {
        if (data?.price) prices[symbol] = data.price;
      });
      Object.entries(cryptoData).forEach(([symbol, data]) => {
        if (data?.price) prices[symbol] = data.price;
      });

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

  // Load thresholds
  useEffect(() => {
    const loadThresholds = async () => {
      if (allSymbols.length === 0) return;
      const stockSymbols = allSymbols.filter(s => !isCryptoSymbol(s));
      const cryptoSymbols = allSymbols.filter(s => isCryptoSymbol(s));

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
  }, [allSymbols]);

  // Price polling
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Fetch daily open prices for free agents (OHLCV) — used for card % display
  const freeAgentSymbolsKey = useMemo(() => freeAgents.map(a => a.symbol).sort().join(','), [freeAgents]);
  useEffect(() => {
    if (freeAgents.length === 0) return;
    let cancelled = false;

    const fetchDailyOpens = async () => {
      const opens = {};
      await Promise.all(freeAgents.map(async (agent) => {
        try {
          const candles = await fetchHistoricalOHLCV(agent.symbol, '1d', isCryptoSymbol(agent.symbol) ? { type: 'crypto' } : undefined);
          if (candles && candles.length > 0) {
            const todayCandle = candles[candles.length - 1];
            if (todayCandle?.open) opens[agent.symbol] = todayCandle.open;
          }
        } catch (err) {
          // Silent — fallback to current price display
        }
      }));
      if (!cancelled) setFreeAgentDailyOpens(opens);
    };

    fetchDailyOpens();
    return () => { cancelled = true; };
  }, [freeAgentSymbolsKey]); // Re-fetch when free agent pool rotates

  // Enrich asset with live data and scoring
  const enrichAsset = useCallback((asset, tier) => {
    if (!asset) return null;
    const openPrice = asset.swapPrice || startingPrices[asset.symbol] || asset.price || 0;
    const currentPrice = currentPrices[asset.symbol] || openPrice;
    const threshold = thresholds[asset.symbol] || {};
    const baseATR = threshold.threshold || DEFAULT_THRESHOLD;
    const priceChange = openPrice > 0 ? ((currentPrice - openPrice) / openPrice) * 100 : 0;
    const multiplier = baseATR > 0 ? priceChange / baseATR : 0;

    const history = {
      maxMultiplier: multiplier > 0 ? multiplier : 0,
      minMultiplier: multiplier < 0 ? multiplier : 0,
    };

    const score = calculateAssetScoreV3(
      { ...asset, baseATR, tier },
      priceChange,
      history
    );

    return {
      ...asset,
      priceChange,
      baseATR,
      points: score.totalPoints,
      badges: score.badges,
      history,
      tierMultiplier: score.tierMultiplier,
    };
  }, [currentPrices, startingPrices, thresholds]);

  // Threshold detection for training events (both player + opponent)
  useEffect(() => {
    if (!currentPrices || Object.keys(currentPrices).length === 0) return;
    if (!startingPrices || Object.keys(startingPrices).length === 0) return;

    const detectForPortfolio = (portfolioRaw, prevMultRef, historyRef, username) => {
      const flat = flattenPortfolio(portfolioRaw);
      flat.forEach((asset) => {
        if (!asset) return;
        const openPrice = asset.swapPrice || startingPrices[asset.symbol] || asset.price || 0;
        const currentPrice = currentPrices[asset.symbol] || openPrice;
        if (!openPrice || !currentPrice) return;

        const priceChange = openPrice > 0 ? ((currentPrice - openPrice) / openPrice) * 100 : 0;
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
                threshold.points
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
          setTrainingEvents(prev => [{
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
          }, ...prev].slice(0, 50));
        }
        // Clear stale red zone keys for this symbol
        redZoneActiveRef.current.forEach(key => {
          if (key.startsWith(`${asset.symbol}_`) && key !== rzKey) {
            redZoneActiveRef.current.delete(key);
          }
        });

        prevMultRef.current[asset.symbol] = currentMultiplier;
      });
    };

    detectForPortfolio(myPortfolioRaw, prevPlayerMultRef, playerHistoryRef, myData?.username || 'You');
    detectForPortfolio(oppData?.portfolio, prevOppMultRef, oppHistoryRef, oppData?.username || 'CPU Opponent');
  }, [currentPrices, startingPrices, thresholds, myPortfolioRaw, oppData?.portfolio, myData?.username, oppData?.username]);

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

  // Swap mode handlers
  const enterSwapMode = useCallback(() => {
    if (swapUsed) return;
    setSwapMode({ active: true, selectedFreeAgent: null, step: 'selectAgent', targetAsset: null });
  }, [swapUsed]);

  const selectFreeAgent = useCallback((agent) => {
    setSwapMode(prev => ({ ...prev, selectedFreeAgent: agent, step: 'selectTarget' }));
  }, []);

  const selectSwapTarget = useCallback((asset, tier, slotIndex) => {
    if (swapMode.selectedFreeAgent?.isCrypto && !asset.isCrypto) return;
    if (!swapMode.selectedFreeAgent?.isCrypto && asset.isCrypto) return;

    // Orange zone swap lock — safety net (UI also blocks in BaggerBombBattleView)
    const oPrice = asset.swapPrice || startingPrices[asset.symbol] || asset.price || 0;
    const cPrice = currentPrices[asset.symbol] || oPrice;
    const bATR = thresholds[asset.symbol]?.threshold || DEFAULT_THRESHOLD;
    const mult = oPrice > 0 ? ((cPrice - oPrice) / oPrice) * 100 / bATR : 0;
    if (isSwapLocked(mult, bATR).locked) return;

    setSwapMode(prev => ({
      ...prev,
      targetAsset: { symbol: asset.symbol, name: asset.name, tier, slotIndex, isCrypto: asset.isCrypto },
      step: 'confirming',
    }));
  }, [swapMode.selectedFreeAgent, startingPrices, currentPrices, thresholds]);

  const cancelSwapMode = useCallback(() => {
    setSwapMode({ active: false, selectedFreeAgent: null, step: 'idle', targetAsset: null });
  }, []);

  // Execute swap with Firebase persistence + local optimistic update
  const executeSwap = useCallback(({ outTier, outSlotIndex, inSymbol, selectedAgent, displayedPoints }) => {
    if (swapUsed) return;

    setIsSwapExecuting(true);

    try {
      const portfolio = localPortfolio || { ...myData?.portfolio };
      // Deep copy the specific tier
      const portfolioClone = {
        star: [...(portfolio.star || [])],
        core: [...(portfolio.core || [])],
        support: [...(portfolio.support || [])],
      };
      const outAsset = portfolioClone[outTier]?.[outSlotIndex];
      const inAgent = selectedAgent || freeAgents.find(a => a.symbol === inSymbol);
      if (!outAsset || !inAgent) throw new Error('Asset not found');

      // Type check
      const outIsCrypto = Boolean(outAsset.isCrypto);
      const inIsCrypto = Boolean(inAgent.isCrypto);
      if (outIsCrypto !== inIsCrypto) throw new Error('Type mismatch');

      // Calculate locked points — use DISPLAYED points from enriched portfolio (includes conviction multiplier)
      const openPrice = outAsset.swapPrice || startingPrices[outAsset.symbol] || outAsset.price || 0;
      const exitPrice = currentPrices[outAsset.symbol] || openPrice;
      const lockedGainPct = openPrice > 0 ? ((exitPrice - openPrice) / openPrice) * 100 : 0;

      // Use the displayed points (from enriched portfolio with conviction multiplier),
      // NOT a raw recalculation. This is what the user sees on screen.
      const lockedPoints = displayedPoints != null
        ? Math.round(displayedPoints * 10) / 10
        : Math.round(lockedGainPct * 10) / 10; // fallback

      const swapPrice = currentPrices[inSymbol] || 0;
      const now = new Date().toISOString();

      const closedTrade = {
        symbol: outAsset.symbol,
        name: outAsset.name || outAsset.symbol,
        tier: outTier,
        slotIndex: outSlotIndex,
        entryPrice: openPrice,
        exitPrice,
        lockedPoints,
        lockedGainPct: Math.round(lockedGainPct * 1000) / 1000,
        swappedOutAt: now,
      };

      // Build incoming asset
      const incomingAsset = {
        symbol: inAgent.symbol,
        name: inAgent.name,
        isCrypto: inAgent.isCrypto,
        swapPrice,
        swappedInAt: now,
      };

      // Update portfolio slot
      portfolioClone[outTier] = [...portfolioClone[outTier]];
      portfolioClone[outTier][outSlotIndex] = incomingAsset;

      // Replace free agent with swapped-out stock
      const agentIndex = freeAgents.findIndex(a => a.symbol === inAgent.symbol);
      let updatedAgents = freeAgents;
      if (agentIndex >= 0) {
        updatedAgents = [...freeAgents];
        updatedAgents[agentIndex] = {
          symbol: outAsset.symbol,
          name: outAsset.name || outAsset.symbol,
          isCrypto: outAsset.isCrypto,
          appearedAt: now,
        };
        setFreeAgents(updatedAgents);
      }

      const newClosedTrades = [...closedTrades, closedTrade];

      // --- Optimistic local state update (immediate UI) ---
      setLocalPortfolio(portfolioClone);
      setClosedTrades(newClosedTrades);
      setSwapUsed(true);

      // --- Persist to Firebase (trainingBattles collection) ---
      if (battle?.id) {
        const swapRecord = {
          timestamp: now,
          day: 1,
          removedSymbol: outAsset.symbol,
          removedTier: outTier,
          removedSlotIndex: outSlotIndex,
          addedSymbol: inSymbol,
          swapPrice,
          lockedPoints,
        };

        const swapHistory = [...(myData?.swaps?.history || []), swapRecord];
        const newRemaining = { day1: 0 };

        // Add starting price for new stock so scoring works on re-entry
        const updatedStartingPrices = { ...startingPrices };
        updatedStartingPrices[inSymbol] = swapPrice;

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
      console.error('[TrainingV4] Swap error:', error);
    } finally {
      setIsSwapExecuting(false);
    }
  }, [swapUsed, localPortfolio, myData, freeAgents, startingPrices, currentPrices, closedTrades, battle, playerId]);

  // Confirm swap from swap mode flow — captures DISPLAYED points from enriched portfolio
  const confirmSwap = useCallback(() => {
    if (!swapMode.targetAsset || !swapMode.selectedFreeAgent) return;

    // Get the displayed points from the enriched portfolio (includes conviction multiplier)
    const enrichedPortfolio = buildEnrichedPortfolio(myPortfolioRaw);
    const enrichedAsset = enrichedPortfolio[swapMode.targetAsset.tier]?.[swapMode.targetAsset.slotIndex];
    const displayedPoints = enrichedAsset?.points ?? null;

    executeSwap({
      outTier: swapMode.targetAsset.tier,
      outSlotIndex: swapMode.targetAsset.slotIndex,
      inSymbol: swapMode.selectedFreeAgent.symbol,
      selectedAgent: swapMode.selectedFreeAgent,
      displayedPoints,
    });
    cancelSwapMode();
  }, [swapMode, executeSwap, cancelSwapMode, buildEnrichedPortfolio, myPortfolioRaw]);

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
      events={trainingEvents}
      onBack={onBack}
      nightMode={false}
      isTraining={true}
      thresholds={thresholds}
      currentPrices={currentPrices}
      battleVersion={4}
      freeAgentConfig={{
        freeAgents,
        nextRotationAt: null,
        freeAgentDailyOpens,
        swapsRemaining: swapUsed ? 0 : 1,
        currentDay: 1,
        totalDays: 1,
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
