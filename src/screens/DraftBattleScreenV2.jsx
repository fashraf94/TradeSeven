import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { HOLO_COLORS, GLOW_EFFECTS, RANK_CONFIG, CATEGORY_CONFIG, HOLO_BACKGROUND, HOLO_ANIMATIONS } from '../constants/holoTheme';
import {
  AltitudeMap,
  CommandConsole,
  ScoutTransitionOverlay,
  BattleLoadingSkeleton,
  RefreshIndicator,
  BattleErrorState,
  TopPerformersModal,
  DailyScoresModal,
} from '../components/draft';
import { calculateSnakeDraftAssetScore, calculatePortfolioScore } from '../services/scoring/baggerBombCalculator';
import { getVolatilityThresholds } from '../services/volatilityService';
import {
  getCurrentTradingDay,
  getDayKey,
  needsDailyOpenCapture,
  captureDailyOpenPrices,
  isAfterMarketClose,
  recordDailyCloseScores,
  recalculateDayScores,
  needsDay1Recalculation,
  formatDailyScoresForModal,
  calculateCumulativeScores,
} from '../services/snakeDraftDailyService';

/**
 * Utility to refresh draft data from Firebase
 * @param {string} draftId - Draft document ID
 * @returns {Promise<object|null>} Updated draft object or null if not found
 */
async function refreshDraftFromFirebase(draftId) {
  const { doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('../firebase/config');
  const draftRef = doc(db, 'drafts', draftId);
  const draftSnap = await getDoc(draftRef);
  return draftSnap.exists() ? { id: draftSnap.id, ...draftSnap.data() } : null;
}

/**
 * DraftBattleScreenV2 - Altitude Map Redesign
 * Phase 5: Polish & Production
 * Phase 5.5: Layout Refinements (pod distribution, compact console, Top Performers modal)
 *
 * This is a redesigned version of DraftBattleScreen with a new "Altitude Map" visual concept.
 * Core business logic is preserved exactly from the original.
 *
 * Props interface matches original DraftBattleScreen exactly.
 */
const DraftBattleScreenV2 = ({
  containerStyle,
  user,
  currentDraft,
  setCurrentDraft,
  setScreen,
  logger = console,
}) => {
  // ============================================
  // STATE - Preserved from original
  // ============================================
  const [standings, setStandings] = useState([]);
  const [expandedCards, setExpandedCards] = useState({});
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [assetComparison, setAssetComparison] = useState(null);
  const [repairStatus, setRepairStatus] = useState(null);

  // NEW STATE for Altitude Map (Phase 2+)
  const [isScoutMode, setIsScoutMode] = useState(false);
  const [scoutedPlayer, setScoutedPlayer] = useState(null);
  const [scoutTransition, setScoutTransition] = useState(false);
  const [scoutTransitionEntering, setScoutTransitionEntering] = useState(true);

  // Phase 5: Polish state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Phase 5.5: Top Performers modal
  const [showTopPerformers, setShowTopPerformers] = useState(false);

  // Phase 5.7: Daily Scores modal
  const [showDailyScores, setShowDailyScores] = useState(false);

  // BaggerBomb scoring state
  const [thresholds, setThresholds] = useState({});

  // Daily scoring state
  const [currentDay, setCurrentDay] = useState(0);
  const [dailyData, setDailyData] = useState(null);
  const [dailyOpenPricesCaptured, setDailyOpenPricesCaptured] = useState(false);

  // Refs for cleanup
  const refreshIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // ============================================
  // DERIVED VALUES - Preserved from original
  // ============================================
  const currentUserId = user?.odUserId || user?.username;
  const battleType = currentDraft?.type || 'stocks';

  // Check if prices need repair (all $100)
  const needsPriceRepair = currentDraft?.lockedPrices &&
    Object.values(currentDraft.lockedPrices).length > 0 &&
    Object.values(currentDraft.lockedPrices).every(p => p === 100);

  // ============================================
  // FORCE REPAIR - Copied exactly from original (lines 27-115)
  // ============================================
  const forceRepairPrices = async () => {
    if (!currentDraft) {
      logger.log('[ForceRepair] No current draft to repair');
      return;
    }

    setRepairStatus('repairing');
    logger.log('[ForceRepair] Starting forced price repair for:', currentDraft.code || currentDraft.id);
    logger.log('[ForceRepair] Current locked prices:', currentDraft.lockedPrices);

    try {
      const stockAPIModule = await import('../services/eodhdAPI');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../firebase/config');

      // Collect all symbols from all players
      const allSymbols = new Set();
      currentDraft.players?.forEach(player => {
        player.picks?.forEach(symbol => allSymbols.add(symbol));
      });
      const symbolList = Array.from(allSymbols);
      logger.log('[ForceRepair] Assets to fix:', symbolList);

      // Fetch real prices using batch API
      let newLockedPrices = {};

      if (battleType === 'crypto') {
        logger.log('[ForceRepair] Fetching crypto prices...');
        const priceData = await stockAPIModule.getAllCryptoPrices(symbolList);
        logger.log('[ForceRepair] Price data received:', priceData);

        for (const symbol of symbolList) {
          const coinGeckoId = stockAPIModule.symbolToCoinGeckoId(symbol);
          const data = priceData[coinGeckoId];

          if (data?.price && data.price > 0) {
            newLockedPrices[symbol] = data.price;
            logger.log(`[ForceRepair] ${symbol} (${coinGeckoId}): $${data.price}`);
          } else {
            // Use fallback
            const fallback = stockAPIModule.FALLBACK_CRYPTO_PRICES[coinGeckoId] || 1;
            newLockedPrices[symbol] = fallback;
            logger.log(`[ForceRepair] ${symbol} (${coinGeckoId}): $${fallback} (fallback)`);
          }
        }
      } else {
        logger.log('[ForceRepair] Fetching stock prices...');
        const priceData = await stockAPIModule.getAllStockPrices(symbolList);

        for (const symbol of symbolList) {
          const data = priceData[symbol.toUpperCase()];
          newLockedPrices[symbol] = data?.price || stockAPIModule.FALLBACK_STOCK_PRICES[symbol] || 100;
        }
      }

      logger.log('[ForceRepair] New locked prices:', newLockedPrices);

      // Direct Firebase update
      if (currentDraft.id) {
        logger.log('[ForceRepair] Updating Firebase document:', currentDraft.id);
        const draftRef = doc(db, 'drafts', currentDraft.id);
        await updateDoc(draftRef, {
          lockedPrices: newLockedPrices,
          lockedPricesRepairedAt: serverTimestamp(),
          pricesRepaired: true
        });
        logger.log('[ForceRepair] Firebase updated successfully!');
      }

      // Update local state
      const repairedDraft = {
        ...currentDraft,
        lockedPrices: newLockedPrices,
        pricesRepaired: true
      };
      setCurrentDraft(repairedDraft);

      setRepairStatus('success');
      logger.log('[ForceRepair] Repair complete! Prices are now correct.');

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => setRepairStatus(null), 3000);

    } catch (error) {
      logger.error('[ForceRepair] Failed:', error);
      setRepairStatus('error');
      setTimeout(() => setRepairStatus(null), 5000);
    }
  };

  // ============================================
  // AUTO REPAIR EFFECT - Copied exactly from original (lines 117-191)
  // ============================================
  useEffect(() => {
    const repairLockedPrices = async () => {
      if (!currentDraft?.lockedPrices || !currentDraft?.players) return;

      // Check if locked prices look wrong (all exactly $100)
      const prices = Object.values(currentDraft.lockedPrices);
      const allSamePrice = prices.length > 0 && prices.every(p => p === 100);

      if (!allSamePrice) {
        console.log('[DraftBattleV2] Locked prices look valid, skipping repair');
        return;
      }

      console.log('[DraftBattleV2] Detected bad locked prices (all $100), attempting repair...');

      try {
        const stockAPIModule = await import('../services/eodhdAPI');
        const draftServiceModule = await import('../services/draftService');

        // Collect all symbols
        const allSymbols = new Set();
        currentDraft.players.forEach(player => {
          (player.picks || []).forEach(symbol => allSymbols.add(symbol));
        });
        const symbolList = Array.from(allSymbols);

        // Fetch real prices
        let newLockedPrices = {};

        if (battleType === 'crypto') {
          const priceData = await stockAPIModule.getAllCryptoPrices(symbolList);

          for (const symbol of symbolList) {
            const coinGeckoId = stockAPIModule.symbolToCoinGeckoId(symbol);
            const data = priceData[coinGeckoId];
            newLockedPrices[symbol] = data?.price ||
              stockAPIModule.FALLBACK_CRYPTO_PRICES[coinGeckoId] || 1;
          }
        } else {
          const priceData = await stockAPIModule.getAllStockPrices(symbolList);

          for (const symbol of symbolList) {
            const data = priceData[symbol.toUpperCase()];
            newLockedPrices[symbol] = data?.price ||
              stockAPIModule.FALLBACK_STOCK_PRICES[symbol] || 100;
          }
        }

        console.log('[DraftBattleV2] Repaired locked prices:', newLockedPrices);

        // Update the local draft state
        const repairedDraft = {
          ...currentDraft,
          lockedPrices: newLockedPrices,
          lockedPricesRepaired: true
        };
        setCurrentDraft(repairedDraft);

        // Try to persist the fix to Firebase (best effort)
        try {
          if (draftServiceModule.storeDraftLockedPrices && currentDraft.id) {
            await draftServiceModule.storeDraftLockedPrices(currentDraft.id);
            console.log('[DraftBattleV2] Repaired prices saved to Firebase');
          }
        } catch (saveError) {
          console.warn('[DraftBattleV2] Could not save repaired prices to Firebase:', saveError);
        }
      } catch (error) {
        console.error('[DraftBattleV2] Failed to repair locked prices:', error);
      }
    };

    repairLockedPrices();
  }, [currentDraft?.id]);

  // ============================================
  // CALCULATE STANDINGS - BaggerBomb Scoring for Snake Draft
  // ============================================
  const calculateStandings = useCallback(async () => {
    if (!currentDraft?.players) {
      setLoading(false);
      return;
    }

    // Don't show full loading on refresh, just the indicator
    if (standings.length > 0) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const stockAPIModule = await import('../services/eodhdAPI');

      // STEP 1: Collect ALL unique symbols from ALL players (ONE batch call)
      const allSymbols = new Set();
      currentDraft.players.forEach(player => {
        (player.picks || []).forEach(symbol => {
          allSymbols.add(symbol.toUpperCase());
        });
      });

      const symbolList = Array.from(allSymbols);
      console.log(`[DraftBattleV2] Fetching ${symbolList.length} unique assets in 1 batch call`);

      // STEP 2: Fetch volatility thresholds for BaggerBomb scoring
      let symbolThresholds = thresholds;
      const missingThresholds = symbolList.filter(s => !symbolThresholds[s]);

      if (missingThresholds.length > 0) {
        console.log(`[DraftBattleV2] Fetching thresholds for ${missingThresholds.length} symbols`);
        try {
          const newThresholds = await getVolatilityThresholds(missingThresholds, 'stock');
          symbolThresholds = { ...symbolThresholds, ...newThresholds };
          setThresholds(symbolThresholds);
        } catch (thresholdError) {
          console.warn('[DraftBattleV2] Failed to fetch thresholds, using defaults:', thresholdError);
          // Use default threshold of 3% for stocks
          missingThresholds.forEach(symbol => {
            symbolThresholds[symbol] = { symbol, threshold: 3.0, isDefault: true };
          });
          setThresholds(symbolThresholds);
        }
      }

      // STEP 3: Clear cache to ensure we get FRESH prices
      if (stockAPIModule.clearCache) {
        stockAPIModule.clearCache();
        console.log('[DraftBattleV2] Cache cleared to fetch fresh prices');
      }

      // Batch fetch ALL prices at once
      let allPrices = {};
      if (battleType === 'crypto') {
        allPrices = await stockAPIModule.getAllCryptoPrices(symbolList);
      } else {
        allPrices = await stockAPIModule.getAllStockPrices(symbolList);
      }

      // STEP 3.5: Daily scoring - capture open prices and check current day
      const tradingDay = getCurrentTradingDay(currentDraft.battleStartTime || currentDraft.createdAt);
      setCurrentDay(tradingDay);

      // Get daily data from draft
      const draftDailyData = currentDraft.dailyData || {};
      setDailyData(draftDailyData);

      // Get today's day key
      const todayDayKey = getDayKey(tradingDay);

      // Capture daily open prices if needed (first time viewing battle today)
      // IMPORTANT: For Day 1, use lockedPrices from draft completion as baseline
      // For Day 2+, capture new open prices at market open
      const hasLockedPrices = currentDraft.lockedPrices && Object.keys(currentDraft.lockedPrices).length > 0;

      if (tradingDay >= 2 && tradingDay <= 5 && !dailyOpenPricesCaptured) {
        // Day 2+: Capture new open prices if needed
        if (needsDailyOpenCapture(currentDraft, tradingDay)) {
          console.log(`[DraftBattleV2] Capturing daily open prices for day ${tradingDay}`);
          const openCaptured = await captureDailyOpenPrices(currentDraft.id, allPrices);
          if (openCaptured) {
            setDailyOpenPricesCaptured(true);
            // Refresh draft data to get updated dailyData
            try {
              const updatedDraft = await refreshDraftFromFirebase(currentDraft.id);
              if (updatedDraft) {
                setCurrentDraft(updatedDraft);
                setDailyData(updatedDraft.dailyData || {});
              }
            } catch (refreshError) {
              console.warn('[DraftBattleV2] Could not refresh draft data:', refreshError);
            }
          }
        } else {
          setDailyOpenPricesCaptured(true);
        }
      } else if (tradingDay === 1) {
        // Day 1: Use lockedPrices as baseline (don't capture new open prices)
        console.log(`[DraftBattleV2] Day 1 - using lockedPrices as baseline`);
        setDailyOpenPricesCaptured(true);
      }

      // Check if we need to record daily close scores (after market close)
      if (tradingDay >= 1 && tradingDay <= 5 && isAfterMarketClose()) {
        const dayData = draftDailyData[todayDayKey];
        if (dayData?.openPrices && !dayData?.recorded) {
          console.log(`[DraftBattleV2] Recording daily close scores for day ${tradingDay}`);
          await recordDailyCloseScores(currentDraft.id, allPrices, symbolThresholds);
        }
      }

      // Check if Day 1 needs recalculation (all zeros due to wrong baseline)
      // This fixes battles that were recorded before the lockedPrices fix
      if (needsDay1Recalculation(draftDailyData)) {
        console.log(`[DraftBattleV2] Day 1 has all zero scores - recalculating with lockedPrices baseline`);
        const recalculated = await recalculateDayScores(currentDraft.id, 1, allPrices, symbolThresholds);
        if (recalculated) {
          // Refresh draft data to get updated dailyData
          try {
            const updatedDraft = await refreshDraftFromFirebase(currentDraft.id);
            if (updatedDraft) {
              setCurrentDraft(updatedDraft);
              setDailyData(updatedDraft.dailyData || {});
              // Update the local variable for this calculation cycle
              Object.assign(draftDailyData, updatedDraft.dailyData || {});
            }
          } catch (refreshError) {
            console.warn('[DraftBattleV2] Could not refresh draft data after Day 1 recalculation:', refreshError);
          }
        }
      }

      // Determine which baseline to use for TODAY's scoring
      // Day 1: ALWAYS use lockedPrices (draft completion prices)
      // Day 2+: Use daily open prices if available, otherwise fall back to locked prices
      const todayOpenPrices = draftDailyData[todayDayKey]?.openPrices || {};
      const hasOpenPrices = tradingDay >= 2 && Object.keys(todayOpenPrices).length > 0;

      // Calculate cumulative scores from previous days
      const previousDayCumulativeScores = calculateCumulativeScores(draftDailyData);

      // STEP 4: Calculate each player's BaggerBomb score
      const playerPerformances = currentDraft.players.map((player) => {
        let totalPoints = 0;
        let totalBaggerBombs = 0;
        let totalBusts = 0;
        let totalPercentGain = 0;
        const portfolioWithScores = [];

        // Add previous days' points to total
        const previousPoints = previousDayCumulativeScores[player.odUserId]?.totalPoints || 0;

        for (let pickIndex = 0; pickIndex < (player.picks || []).length; pickIndex++) {
          const symbol = player.picks[pickIndex];
          const category = player.pickCategories?.[pickIndex] || 'steady';

          // Normalize symbol for lookup
          let lookupKey;
          if (battleType === 'crypto') {
            lookupKey = stockAPIModule.symbolToCoinGeckoId
              ? stockAPIModule.symbolToCoinGeckoId(symbol)
              : symbol.toLowerCase();
          } else {
            lookupKey = symbol.toUpperCase();
          }

          // Get current price from batch result
          const priceData = allPrices[lookupKey];
          const currentPrice = priceData?.price || 0;

          // Get baseline price: daily open price (preferred) or locked price (fallback)
          // This is the KEY change for daily scoring - each day starts fresh
          const dailyOpenPrice = hasOpenPrices
            ? (todayOpenPrices[symbol] || todayOpenPrices[lookupKey] || 0)
            : 0;
          const lockedPrice = Number(currentDraft.lockedPrices?.[symbol] ||
                           currentDraft.lockedPrices?.[lookupKey] ||
                           currentPrice) || 0;

          // Use daily open price if available, otherwise locked price
          const baselinePrice = dailyOpenPrice > 0 ? dailyOpenPrice : lockedPrice;

          // Calculate percentage gain vs TODAY's baseline
          let percentGain = 0;
          if (baselinePrice > 0 && currentPrice > 0) {
            percentGain = ((currentPrice - baselinePrice) / baselinePrice) * 100;

            // Sanity check - gains over 500% or under -90% are likely data errors
            if (percentGain > 500 || percentGain < -90) {
              console.warn(`[DraftBattleV2] Suspicious gain for ${symbol}: ${percentGain.toFixed(2)}%`);
              percentGain = 0;
            }
          }

          // Get threshold for this symbol (default 3% for stocks)
          const threshold = symbolThresholds[symbol.toUpperCase()]?.threshold || 3.0;

          // Calculate BaggerBomb score for this asset
          // For now using close price as both high and low (intraday data could be added later)
          const assetScore = calculateSnakeDraftAssetScore(
            percentGain,
            threshold,
            percentGain > 0 ? percentGain : null,  // intradayHigh
            percentGain < 0 ? percentGain : null   // intradayLow
          );

          portfolioWithScores.push({
            symbol,
            gain: parseFloat(percentGain.toFixed(2)),
            lockedPrice,
            currentPrice,
            category,
            // Daily scoring - baseline price for ChamberFuse
            baselinePrice,
            dailyOpenPrice: dailyOpenPrice > 0 ? dailyOpenPrice : null,
            // BaggerBomb scoring data
            threshold,
            baggerBombs: assetScore.baggerBombs,
            busts: assetScore.busts,
            basePoints: assetScore.basePoints,
            baggerBombPoints: assetScore.baggerBombPoints,
            bustPoints: assetScore.bustPoints,
            totalScore: assetScore.totalScore,
          });

          // Accumulate totals (today's points only)
          totalPoints += assetScore.totalScore;
          totalBaggerBombs += assetScore.baggerBombs;
          totalBusts += assetScore.busts;
          totalPercentGain += percentGain / 9; // Equal weight average
        }

        // Find best and worst by total score (not just %)
        const sortedByScore = [...portfolioWithScores].sort((a, b) => b.totalScore - a.totalScore);
        const sortedByGain = [...portfolioWithScores].sort((a, b) => b.gain - a.gain);

        // Calculate cumulative total: previous days + today's live score
        const cumulativeTotal = previousPoints + totalPoints;

        return {
          odUserId: player.odUserId,
          displayName: player.displayName,
          isMe: player.odUserId === currentUserId,
          isCPU: player.isCPU || false,
          // BaggerBomb scoring - CUMULATIVE points is primary (previous days + today)
          totalPoints: parseFloat(cumulativeTotal.toFixed(2)),
          todayPoints: parseFloat(totalPoints.toFixed(2)),  // Today's score only
          previousPoints,  // Previous days' cumulative
          totalBaggerBombs,
          totalBusts,
          // Keep percentage as secondary info (today only)
          totalGain: parseFloat(totalPercentGain.toFixed(2)),
          portfolio: portfolioWithScores,
          // Best/worst by score
          bestAsset: sortedByScore[0] || { symbol: '-', gain: 0, totalScore: 0 },
          worstAsset: sortedByScore[sortedByScore.length - 1] || { symbol: '-', gain: 0, totalScore: 0 },
          // Best/worst by % gain (for reference)
          bestGainer: sortedByGain[0] || { symbol: '-', gain: 0 },
          worstGainer: sortedByGain[sortedByGain.length - 1] || { symbol: '-', gain: 0 },
          previousRank: player.previousRank || 0
        };
      });

      // Sort by total POINTS (descending) - this is the key change!
      const sorted = playerPerformances.sort((a, b) => b.totalPoints - a.totalPoints);

      // Assign ranks
      sorted.forEach((player, index) => {
        player.currentRank = index + 1;
      });

      setStandings(sorted);

      // Save calculated points back to Firebase for ClashCard to display
      if (currentDraft?.id) {
        try {
          const { doc, updateDoc } = await import('firebase/firestore');
          const { db } = await import('../firebase/config');

          // Update players array with calculated totalPoints
          const updatedPlayers = currentDraft.players.map(player => {
            const standing = sorted.find(s => s.odUserId === player.odUserId);
            return {
              ...player,
              totalPoints: standing?.totalPoints ?? 0,
            };
          });

          const draftRef = doc(db, 'drafts', currentDraft.id);
          await updateDoc(draftRef, { players: updatedPlayers });
        } catch (saveError) {
          logger.warn('[DraftBattleV2] Failed to save standings to Firebase:', saveError);
        }
      }

      // Calculate asset comparison
      const myPlayer = sorted.find(p => p.isMe);
      if (myPlayer) {
        const myBest = myPlayer.bestAsset;
        const opponentBests = sorted
          .filter(p => !p.isMe)
          .map(p => p.bestAsset)
          .sort((a, b) => b.totalScore - a.totalScore);

        setAssetComparison({
          myBest,
          opponentBest: opponentBests[0],
          iWin: myBest?.totalScore > (opponentBests[0]?.totalScore || 0)
        });
      }

      setLastUpdated(new Date());
      setError(null);

    } catch (err) {
      logger.error('[DraftBattleV2] Error calculating standings:', err);
      setError(err.message || 'Failed to load standings');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [currentDraft, currentUserId, battleType, standings.length, logger, thresholds]);

  // Effect to run calculateStandings on mount and set up interval
  useEffect(() => {
    calculateStandings();

    // Refresh every 60 seconds
    refreshIntervalRef.current = setInterval(calculateStandings, 60000);
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [calculateStandings]);

  // ============================================
  // TIMER UPDATE - Copied exactly from original (lines 338-368)
  // ============================================
  useEffect(() => {
    const updateTimer = () => {
      if (!currentDraft?.battleEndTime) return;

      const end = new Date(currentDraft.battleEndTime);
      const now = new Date();
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining('Battle ended');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 60000);
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [currentDraft?.battleEndTime]);

  // ============================================
  // HELPER FUNCTIONS - Preserved from original
  // ============================================
  const toggleExpand = (odUserId) => {
    setExpandedCards(prev => ({
      ...prev,
      [odUserId]: !prev[odUserId]
    }));
  };

  const getMovementIndicator = (player) => {
    if (!player.previousRank || player.previousRank === player.currentRank) {
      return { icon: '-', color: HOLO_COLORS.textSecondary };
    }
    if (player.currentRank < player.previousRank) {
      return { icon: '+', color: HOLO_COLORS.green };
    }
    return { icon: '-', color: HOLO_COLORS.red };
  };

  // ============================================
  // SCOUT VIEW HANDLERS (Phase 4 Enhanced)
  // ============================================
  const handleScoutPlayer = (player) => {
    if (player.isMe || player.odUserId === currentUserId) return; // Can't scout yourself

    // Haptic feedback on mobile
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 50]); // Short pattern
    }

    setScoutTransitionEntering(true);
    setScoutTransition(true);

    setTimeout(() => {
      setScoutedPlayer(player);
      setIsScoutMode(true);
      setScoutTransition(false);
    }, 500);

    logger.log('[DraftBattleV2] Scouting player:', player.displayName);
  };

  const handleExitScout = () => {
    // Haptic feedback on mobile
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }

    setScoutTransitionEntering(false);
    setScoutTransition(true);

    setTimeout(() => {
      setScoutedPlayer(null);
      setIsScoutMode(false);
      setScoutTransition(false);
    }, 400);

    logger.log('[DraftBattleV2] Exiting scout mode');
  };

  // ============================================
  // NAVIGATION HANDLERS
  // ============================================
  const handleBack = () => setScreen('dashboard');
  const handleFreeAgency = () => setScreen('freeAgency');
  const handleTopPerformers = () => setShowTopPerformers(true);

  // Retry handler for error state
  const handleRetry = () => {
    setError(null);
    setLoading(true);
    calculateStandings();
  };

  // ============================================
  // SAFETY CHECK - No draft
  // ============================================
  if (!currentDraft) {
    return (
      <div style={{
        ...containerStyle,
        minHeight: '100vh',
        background: HOLO_BACKGROUND,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px'
      }}>
        <p style={{ color: HOLO_COLORS.textPrimary, marginBottom: '16px' }}>
          No active draft battle
        </p>
        <button
          onClick={handleBack}
          style={{
            padding: '12px 24px',
            background: `linear-gradient(135deg, ${HOLO_COLORS.cyan}33 0%, ${HOLO_COLORS.green}33 100%)`,
            border: `1px solid ${HOLO_COLORS.cyan}`,
            color: HOLO_COLORS.textPrimary,
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Back to Dashboard
        </button>
        <style>{HOLO_ANIMATIONS}</style>
      </div>
    );
  }

  // Find my player for the Command Console (memoized)
  const userStanding = useMemo(() => {
    return standings.find(p => p.isMe) || null;
  }, [standings]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div style={{
      ...containerStyle,
      minHeight: '100vh',
      background: HOLO_BACKGROUND,
      color: HOLO_COLORS.textPrimary,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* HEADER */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(10, 14, 20, 0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
        padding: '12px 16px',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={handleBack}
            style={{
              background: 'none',
              border: 'none',
              color: HOLO_COLORS.textSecondary,
              fontSize: '24px',
              cursor: 'pointer',
              padding: '8px',
            }}
          >
            &#8592;
          </button>
          <span style={{
            fontSize: '16px',
            fontWeight: 600,
            color: HOLO_COLORS.cyan,
            textShadow: '0 0 10px rgba(0, 255, 255, 0.5)',
          }}>
            DRAFT BATTLE
          </span>
          {/* Daily Scores Button */}
          <button
            onClick={() => setShowDailyScores(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{
              fontSize: '14px',
              textShadow: '0 0 8px rgba(0, 255, 255, 0.8), 0 0 16px rgba(0, 255, 255, 0.4)',
            }}>📊</span>
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              color: HOLO_COLORS.textSecondary,
              display: 'none',
            }}>
              Daily
            </span>
          </button>
        </div>
      </header>

      {/* STATUS BAR */}
      <div style={{
        background: `linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 255, 136, 0.1) 100%)`,
        borderBottom: `1px solid ${HOLO_COLORS.borderGlow}`,
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            color: HOLO_COLORS.textPrimary,
            fontWeight: 600,
            background: HOLO_COLORS.bgCard,
            padding: '4px 8px',
            borderRadius: '4px',
          }}>
            {currentDraft?.code || 'DRAFT'}
          </span>
          <span style={{ color: HOLO_COLORS.textMuted }}>-</span>
          <span style={{ color: HOLO_COLORS.textSecondary }}>
            {battleType === 'crypto' ? 'Crypto' : 'Stocks'}
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: HOLO_COLORS.cyan,
          fontFamily: 'monospace',
          fontWeight: 600,
        }}>
          <span>Ends in {timeRemaining || '...'}</span>
        </div>

        {lastUpdated && (
          <div style={{
            width: '100%',
            fontSize: '10px',
            color: HOLO_COLORS.textMuted,
            textAlign: 'center',
          }}>
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Refresh Indicator */}
      <RefreshIndicator visible={isRefreshing} lastUpdated={lastUpdated} />

      {/* PRICE REPAIR WARNING */}
      {needsPriceRepair && (
        <div style={{
          background: 'rgba(127, 29, 29, 0.9)',
          borderBottom: `2px solid ${HOLO_COLORS.red}`,
          padding: '12px 16px',
          textAlign: 'center'
        }}>
          <div style={{
            color: '#fca5a5',
            fontSize: '13px',
            marginBottom: '8px'
          }}>
            Locked prices are incorrect (all $100). Click below to repair.
          </div>
          <button
            onClick={forceRepairPrices}
            disabled={repairStatus === 'repairing'}
            style={{
              padding: '8px 20px',
              background: repairStatus === 'repairing' ? '#6b7280' :
                         repairStatus === 'success' ? HOLO_COLORS.green :
                         repairStatus === 'error' ? HOLO_COLORS.red : '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: repairStatus === 'repairing' ? 'wait' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {repairStatus === 'repairing' ? 'Repairing...' :
             repairStatus === 'success' ? 'Prices Fixed!' :
             repairStatus === 'error' ? 'Failed - Try Again' :
             'Repair Prices Now'}
          </button>
        </div>
      )}

      {/* SUCCESS MESSAGE */}
      {repairStatus === 'success' && !needsPriceRepair && (
        <div style={{
          background: 'rgba(6, 78, 59, 0.9)',
          padding: '12px 16px',
          textAlign: 'center',
          color: '#6ee7b7',
          fontSize: '14px'
        }}>
          Prices repaired successfully! Gains should now be accurate.
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main style={{
        flex: 1,
        padding: '16px',
        paddingBottom: '200px', // Space for Command Console (reduced in Phase 5.5)
        overflowY: 'auto',
        minHeight: 'calc(100vh - 180px)',
      }}>
        {loading ? (
          <BattleLoadingSkeleton />
        ) : error ? (
          <BattleErrorState
            message={error}
            onRetry={handleRetry}
            onBack={handleBack}
          />
        ) : standings.length > 0 ? (
          <div>
            {/* ALTITUDE MAP - Phase 2 Implementation */}
            <AltitudeMap
              standings={standings}
              currentUserId={currentUserId}
              onScoutPlayer={handleScoutPlayer}
              scoutedPlayerId={scoutedPlayer?.odUserId}
              containerHeight={Math.max(450, standings.length * 140)}
            />

            {/* Refresh indicator */}
            <div style={{
              textAlign: 'center',
              color: HOLO_COLORS.textMuted,
              fontSize: '11px',
              marginTop: '24px',
              padding: '8px',
              borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  background: HOLO_COLORS.green,
                  borderRadius: '50%',
                  animation: 'holoPulse 2s ease-in-out infinite',
                }} />
                Prices update every minute
              </span>
            </div>
          </div>
        ) : (
          <BattleErrorState
            message="No battle data available"
            onBack={handleBack}
          />
        )}
      </main>

      {/* COMMAND CONSOLE - Only show when we have data */}
      {!loading && !error && standings.length > 0 && (
        <CommandConsole
          userStanding={userStanding}
          scoutedPlayer={scoutedPlayer}
          isScoutMode={isScoutMode}
          onExitScout={handleExitScout}
          onFreeAgency={handleFreeAgency}
          onTopPerformers={handleTopPerformers}
        />
      )}

      {/* TOP PERFORMERS MODAL - Phase 5.5 */}
      <TopPerformersModal
        isOpen={showTopPerformers}
        onClose={() => setShowTopPerformers(false)}
        standings={standings}
        currentUserId={currentUserId}
      />

      {/* DAILY SCORES MODAL - Phase 5.7 */}
      <DailyScoresModal
        isOpen={showDailyScores}
        onClose={() => setShowDailyScores(false)}
        standings={standings}
        currentUserId={currentUserId}
        battleStartTime={currentDraft?.battleStartTime || currentDraft?.createdAt || currentDraft?.startTime}
        battleEndTime={currentDraft?.battleEndTime}
        dailyScores={formatDailyScoresForModal(currentDraft)}
        dailyData={currentDraft?.dailyData}
        currentDay={currentDay}
      />

      {/* Scout Transition Overlay - Phase 4 Enhanced */}
      <ScoutTransitionOverlay
        active={scoutTransition}
        entering={scoutTransitionEntering}
      />

      {/* Global Animations */}
      <style>{HOLO_ANIMATIONS}</style>
    </div>
  );
};

export default DraftBattleScreenV2;
