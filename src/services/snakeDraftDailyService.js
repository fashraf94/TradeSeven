// /src/services/snakeDraftDailyService.js
// Snake Draft Daily Scoring Service
// Handles daily price capture, score recording, and battle completion

import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getEasternTime, isWeekday } from '../constants/battleTiming';
import { calculateSnakeDraftAssetScore } from './scoring/baggerBombCalculator';
import { getVolatilityThresholds } from './volatilityService';

// Constants
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MINUTE = 30;
const MARKET_CLOSE_HOUR = 16;
const MARKET_CLOSE_MINUTE = 0;

/**
 * Get the current trading day number (1-5) for a battle
 * @param {string|Date} battleStartTime - When the battle started
 * @returns {number} Current trading day (1-5), or 0 if before battle, or 6 if after battle
 */
export function getCurrentTradingDay(battleStartTime) {
  if (!battleStartTime) return 0;

  const startDate = new Date(battleStartTime);
  const now = getEasternTime();

  // Normalize to start of day
  const startDay = new Date(startDate);
  startDay.setHours(0, 0, 0, 0);

  const currentDay = new Date(now);
  currentDay.setHours(0, 0, 0, 0);

  // Count trading days between start and now
  let tradingDays = 0;
  const checkDate = new Date(startDay);

  while (checkDate <= currentDay && tradingDays < 6) {
    const dayOfWeek = checkDate.getDay();
    // Count weekdays only (Mon-Fri)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      tradingDays++;
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }

  return Math.min(tradingDays, 5);
}

/**
 * Get the day key for Firebase storage (day1, day2, etc.)
 * @param {number} dayNumber - Trading day number (1-5)
 * @returns {string} Day key like "day1"
 */
export function getDayKey(dayNumber) {
  return `day${dayNumber}`;
}

/**
 * Check if market is currently open (for stocks)
 * @returns {boolean}
 */
export function isMarketOpen() {
  const et = getEasternTime();
  const hour = et.getHours();
  const minute = et.getMinutes();
  const day = et.getDay();

  // Weekdays only
  if (day === 0 || day === 6) return false;

  // Market hours: 9:30 AM - 4:00 PM ET
  const currentMinutes = hour * 60 + minute;
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE;
  const closeMinutes = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE;

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

/**
 * Check if it's after market close for the day
 * @returns {boolean}
 */
export function isAfterMarketClose() {
  const et = getEasternTime();
  const hour = et.getHours();
  const minute = et.getMinutes();
  const day = et.getDay();

  // Weekdays only
  if (day === 0 || day === 6) return false;

  const currentMinutes = hour * 60 + minute;
  const closeMinutes = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE;

  return currentMinutes >= closeMinutes;
}

/**
 * Check if daily open prices need to be captured for current trading day
 * @param {object} draft - Draft document from Firebase
 * @param {number} currentDay - Current trading day (1-5)
 * @returns {boolean}
 */
export function needsDailyOpenCapture(draft, currentDay) {
  if (!draft || currentDay < 1 || currentDay > 5) return false;

  const dayKey = getDayKey(currentDay);
  const dailyData = draft.dailyData || {};

  // Check if open prices already captured for this day
  return !dailyData[dayKey]?.openPrices;
}

/**
 * Check if daily close scores need to be recorded for a specific day
 * @param {object} draft - Draft document from Firebase
 * @param {number} dayNumber - Trading day number (1-5)
 * @returns {boolean}
 */
export function needsDailyCloseRecording(draft, dayNumber) {
  if (!draft || dayNumber < 1 || dayNumber > 5) return false;

  const dayKey = getDayKey(dayNumber);
  const dailyData = draft.dailyData || {};

  // Check if close scores already recorded for this day
  return !dailyData[dayKey]?.recorded;
}

/**
 * Capture daily open prices for a battle
 * @param {string} draftId - Draft document ID
 * @param {object} currentPrices - Current prices keyed by symbol
 * @returns {Promise<boolean>} Success status
 */
export async function captureDailyOpenPrices(draftId, currentPrices) {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) {
      console.error('[SnakeDraftDaily] Draft not found:', draftId);
      return false;
    }

    const draft = draftSnap.data();
    const currentDay = getCurrentTradingDay(draft.battleStartTime || draft.createdAt);

    if (currentDay < 1 || currentDay > 5) {
      console.log('[SnakeDraftDaily] Not a valid trading day:', currentDay);
      return false;
    }

    if (!needsDailyOpenCapture(draft, currentDay)) {
      console.log('[SnakeDraftDaily] Open prices already captured for day', currentDay);
      return true;
    }

    const dayKey = getDayKey(currentDay);
    const todayDate = getEasternTime().toISOString().split('T')[0];

    // Collect all symbols from all players
    const allSymbols = new Set();
    (draft.players || []).forEach(player => {
      (player.picks || []).forEach(symbol => allSymbols.add(symbol.toUpperCase()));
    });

    // Build open prices object
    const openPrices = {};
    allSymbols.forEach(symbol => {
      const price = currentPrices[symbol] || currentPrices[symbol.toUpperCase()];
      if (price?.price) {
        openPrices[symbol] = price.price;
      } else if (typeof price === 'number') {
        openPrices[symbol] = price;
      }
    });

    // Update Firebase
    const dailyData = draft.dailyData || {};
    dailyData[dayKey] = {
      ...dailyData[dayKey],
      date: todayDate,
      openPrices,
      openCapturedAt: new Date().toISOString(),
    };

    await updateDoc(draftRef, {
      dailyData,
      currentTradingDay: currentDay,
    });

    console.log(`[SnakeDraftDaily] Captured open prices for ${draftId} day ${currentDay}:`, Object.keys(openPrices).length, 'symbols');
    return true;
  } catch (error) {
    console.error('[SnakeDraftDaily] Error capturing open prices:', error);
    return false;
  }
}

/**
 * Record daily close scores for a battle
 * @param {string} draftId - Draft document ID
 * @param {object} currentPrices - Current prices keyed by symbol
 * @param {object} thresholds - Volatility thresholds keyed by symbol
 * @returns {Promise<boolean>} Success status
 */
export async function recordDailyCloseScores(draftId, currentPrices, thresholds = {}) {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) {
      console.error('[SnakeDraftDaily] Draft not found:', draftId);
      return false;
    }

    const draft = draftSnap.data();
    const currentDay = getCurrentTradingDay(draft.battleStartTime || draft.createdAt);

    if (currentDay < 1 || currentDay > 5) {
      console.log('[SnakeDraftDaily] Not a valid trading day:', currentDay);
      return false;
    }

    const dayKey = getDayKey(currentDay);
    const dailyData = draft.dailyData || {};

    // Check if already recorded
    if (dailyData[dayKey]?.recorded) {
      console.log('[SnakeDraftDaily] Scores already recorded for day', currentDay);
      return true;
    }

    // Get baseline prices for today
    // Day 1: ALWAYS use lockedPrices (draft completion prices)
    // Day 2+: Use daily open prices, fall back to locked prices if not captured
    const openPrices = currentDay === 1
      ? (draft.lockedPrices || {})
      : (dailyData[dayKey]?.openPrices || draft.lockedPrices || {});

    // Calculate scores for each player
    const closeScores = {};

    for (const player of (draft.players || [])) {
      const playerAssets = [];
      let playerTotalPoints = 0;

      for (const symbol of (player.picks || [])) {
        const upperSymbol = symbol.toUpperCase();

        // Get prices
        const openPrice = openPrices[symbol] || openPrices[upperSymbol] || 0;
        const currentPrice = currentPrices[upperSymbol]?.price ||
                            currentPrices[symbol]?.price ||
                            (typeof currentPrices[upperSymbol] === 'number' ? currentPrices[upperSymbol] : 0);

        // Calculate daily gain
        let dailyGain = 0;
        if (openPrice > 0 && currentPrice > 0) {
          dailyGain = ((currentPrice - openPrice) / openPrice) * 100;
        }

        // Get threshold (default to 3%)
        const threshold = thresholds[upperSymbol]?.threshold || thresholds[symbol]?.threshold || 3.0;

        // Calculate BaggerBomb score for this asset
        const assetScore = calculateSnakeDraftAssetScore(dailyGain, threshold);

        playerAssets.push({
          symbol,
          openPrice,
          closePrice: currentPrice,
          gain: parseFloat(dailyGain.toFixed(2)),
          points: assetScore.totalScore,
          baggerBombs: assetScore.baggerBombs,
          busts: assetScore.busts,
          basePoints: assetScore.basePoints,
          baggerBombPoints: assetScore.baggerBombPoints,
          bustPoints: assetScore.bustPoints,
        });

        playerTotalPoints += assetScore.totalScore;
      }

      closeScores[player.odUserId] = {
        totalPoints: parseFloat(playerTotalPoints.toFixed(2)),
        assets: playerAssets,
      };
    }

    // Update Firebase with daily scores
    dailyData[dayKey] = {
      ...dailyData[dayKey],
      closeScores,
      recorded: true,
      recordedAt: new Date().toISOString(),
    };

    await updateDoc(draftRef, {
      dailyData,
      currentTradingDay: currentDay,
    });

    console.log(`[SnakeDraftDaily] Recorded close scores for ${draftId} day ${currentDay}`);

    // Check if battle should auto-complete (after day 5)
    if (currentDay === 5) {
      await checkAndCompleteBattle(draftId);
    }

    return true;
  } catch (error) {
    console.error('[SnakeDraftDaily] Error recording close scores:', error);
    return false;
  }
}

/**
 * Calculate cumulative scores across all recorded days
 * @param {object} dailyData - The dailyData object from the draft
 * @returns {object} Cumulative scores keyed by player odUserId
 */
export function calculateCumulativeScores(dailyData) {
  const cumulativeScores = {};

  for (let day = 1; day <= 5; day++) {
    const dayKey = getDayKey(day);
    const dayData = dailyData?.[dayKey];

    if (dayData?.closeScores) {
      for (const [playerId, scoreData] of Object.entries(dayData.closeScores)) {
        if (!cumulativeScores[playerId]) {
          cumulativeScores[playerId] = {
            totalPoints: 0,
            dailyBreakdown: [],
          };
        }
        cumulativeScores[playerId].totalPoints += scoreData.totalPoints || 0;
        cumulativeScores[playerId].dailyBreakdown.push(scoreData.totalPoints || 0);
      }
    }
  }

  return cumulativeScores;
}

/**
 * Check if battle should be completed and mark it as such
 * @param {string} draftId - Draft document ID
 * @returns {Promise<boolean>} Whether battle was completed
 */
export async function checkAndCompleteBattle(draftId) {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) {
      return false;
    }

    const draft = draftSnap.data();

    // Check if already completed
    if (draft.status === 'completed') {
      return false;
    }

    const currentDay = getCurrentTradingDay(draft.battleStartTime || draft.createdAt);

    // Only complete after day 5 is recorded
    if (currentDay < 5 || !draft.dailyData?.day5?.recorded) {
      return false;
    }

    // Calculate final totals
    const finalTotals = calculateCumulativeScores(draft.dailyData);

    // Create final standings array
    const finalStandings = Object.entries(finalTotals)
      .map(([odUserId, data]) => {
        const player = draft.players.find(p => p.odUserId === odUserId);
        return {
          odUserId,
          displayName: player?.displayName || 'Unknown',
          totalPoints: data.totalPoints,
          dailyBreakdown: data.dailyBreakdown,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((player, index) => ({
        ...player,
        finalRank: index + 1,
      }));

    // Determine winner
    const winner = finalStandings[0] || null;

    // Update Firebase
    await updateDoc(draftRef, {
      status: 'completed',
      finalTotals,
      finalStandings,
      winner: winner ? {
        odUserId: winner.odUserId,
        displayName: winner.displayName,
        totalPoints: winner.totalPoints,
      } : null,
      completedAt: new Date().toISOString(),
    });

    console.log(`[SnakeDraftDaily] Battle ${draftId} completed. Winner: ${winner?.displayName} with ${winner?.totalPoints} pts`);
    return true;
  } catch (error) {
    console.error('[SnakeDraftDaily] Error completing battle:', error);
    return false;
  }
}

/**
 * Get all active Snake Draft battles that need daily score processing
 * @returns {Promise<Array>} Array of draft documents
 */
export async function getActiveBattles() {
  try {
    const draftsRef = collection(db, 'drafts');
    const q = query(draftsRef, where('status', '==', 'battle'));
    const snapshot = await getDocs(q);

    const battles = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Only include Snake Draft battles (4 players, type is stocks or crypto)
      if (data.players?.length === 4) {
        battles.push({ id: doc.id, ...data });
      }
    });

    console.log(`[SnakeDraftDaily] Found ${battles.length} active battles`);
    return battles;
  } catch (error) {
    console.error('[SnakeDraftDaily] Error fetching active battles:', error);
    return [];
  }
}

/**
 * Process all active battles for daily scoring
 * Called by cron job at market close
 * @param {function} fetchPrices - Function to fetch current prices
 * @returns {Promise<object>} Summary of processed battles
 */
export async function processAllBattles(fetchPrices) {
  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
    completed: 0,
  };

  try {
    const battles = await getActiveBattles();

    for (const battle of battles) {
      try {
        // Collect all symbols
        const allSymbols = new Set();
        (battle.players || []).forEach(player => {
          (player.picks || []).forEach(symbol => allSymbols.add(symbol.toUpperCase()));
        });

        // Fetch prices
        const symbolList = Array.from(allSymbols);
        const prices = await fetchPrices(symbolList, battle.type);

        // Fetch thresholds
        let thresholds = {};
        try {
          thresholds = await getVolatilityThresholds(symbolList, battle.type || 'stock');
        } catch (e) {
          console.warn('[SnakeDraftDaily] Could not fetch thresholds, using defaults');
        }

        // Record daily scores
        const success = await recordDailyCloseScores(battle.id, prices, thresholds);

        if (success) {
          results.processed++;

          // Check if battle was completed
          const updatedDraft = await getDoc(doc(db, 'drafts', battle.id));
          if (updatedDraft.data()?.status === 'completed') {
            results.completed++;
          }
        } else {
          results.skipped++;
        }
      } catch (battleError) {
        console.error(`[SnakeDraftDaily] Error processing battle ${battle.id}:`, battleError);
        results.errors++;
      }
    }

    console.log('[SnakeDraftDaily] Processing complete:', results);
    return results;
  } catch (error) {
    console.error('[SnakeDraftDaily] Error in batch processing:', error);
    results.errors++;
    return results;
  }
}

/**
 * Get daily scores formatted for the DailyScoresModal
 * @param {object} draft - Draft document from Firebase
 * @returns {object} Formatted dailyScores object for the modal
 */
export function formatDailyScoresForModal(draft) {
  if (!draft?.dailyData) return null;

  const formattedScores = {};

  for (let day = 1; day <= 5; day++) {
    const dayKey = getDayKey(day);
    const dayData = draft.dailyData[dayKey];

    if (dayData?.closeScores) {
      formattedScores[dayKey] = {};
      for (const [playerId, scoreData] of Object.entries(dayData.closeScores)) {
        formattedScores[dayKey][playerId] = scoreData.totalPoints;
      }
    }
  }

  return Object.keys(formattedScores).length > 0 ? formattedScores : null;
}

/**
 * Get live daily score for a player (for current day before close)
 * @param {object} player - Player object with picks
 * @param {object} dailyData - Daily data from draft
 * @param {object} currentPrices - Current prices
 * @param {object} thresholds - Volatility thresholds
 * @param {number} currentDay - Current trading day
 * @returns {object} Live score data
 */
export function calculateLiveDailyScore(player, dailyData, currentPrices, thresholds, currentDay, lockedPrices = {}) {
  const dayKey = getDayKey(currentDay);
  // Day 1: Use lockedPrices, Day 2+: Use daily open prices
  const baselinePrices = currentDay === 1
    ? lockedPrices
    : (dailyData?.[dayKey]?.openPrices || lockedPrices || {});

  let totalPoints = 0;
  const assets = [];

  for (const symbol of (player.picks || [])) {
    const upperSymbol = symbol.toUpperCase();

    const openPrice = baselinePrices[symbol] || baselinePrices[upperSymbol] || 0;
    const currentPrice = currentPrices[upperSymbol]?.price ||
                        currentPrices[symbol]?.price ||
                        (typeof currentPrices[upperSymbol] === 'number' ? currentPrices[upperSymbol] : 0);

    let dailyGain = 0;
    if (openPrice > 0 && currentPrice > 0) {
      dailyGain = ((currentPrice - openPrice) / openPrice) * 100;
    }

    const threshold = thresholds[upperSymbol]?.threshold || thresholds[symbol]?.threshold || 3.0;
    const assetScore = calculateSnakeDraftAssetScore(dailyGain, threshold);

    assets.push({
      symbol,
      gain: dailyGain,
      points: assetScore.totalScore,
      ...assetScore,
    });

    totalPoints += assetScore.totalScore;
  }

  return {
    totalPoints: parseFloat(totalPoints.toFixed(2)),
    assets,
    isLive: true,
  };
}

export default {
  getCurrentTradingDay,
  getDayKey,
  isMarketOpen,
  isAfterMarketClose,
  needsDailyOpenCapture,
  needsDailyCloseRecording,
  captureDailyOpenPrices,
  recordDailyCloseScores,
  calculateCumulativeScores,
  checkAndCompleteBattle,
  getActiveBattles,
  processAllBattles,
  formatDailyScoresForModal,
  calculateLiveDailyScore,
};
