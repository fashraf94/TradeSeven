// /src/services/snakeDraftDailyService.js
// Snake Draft Daily Scoring Service
// Handles daily price capture, score recording, and battle completion

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getEasternTime } from '../constants/battleTiming';
import { calculateSnakeDraftAssetScore } from './scoring/baggerBombCalculator';

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
 * @param {boolean} forceRecalculate - Force recalculation even if already recorded
 * @returns {Promise<boolean>} Success status
 */
export async function recordDailyCloseScores(draftId, currentPrices, thresholds = {}, forceRecalculate = false) {
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

    // Check if already recorded (skip if forceRecalculate is true)
    if (dailyData[dayKey]?.recorded && !forceRecalculate) {
      console.log('[SnakeDraftDaily] Scores already recorded for day', currentDay);
      return true;
    }

    if (forceRecalculate) {
      console.log(`[SnakeDraftDaily] Force recalculating scores for day ${currentDay}`);
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
 * Recalculate and re-record scores for a specific day
 * Used to fix Day 1 scores that were recorded with wrong baseline
 * @param {string} draftId - Draft document ID
 * @param {number} targetDay - Which day to recalculate (1-5)
 * @param {object} currentPrices - Current prices keyed by symbol
 * @param {object} thresholds - Volatility thresholds keyed by symbol
 * @returns {Promise<boolean>} Success status
 */
export async function recalculateDayScores(draftId, targetDay, currentPrices, thresholds = {}) {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) {
      console.error('[SnakeDraftDaily] Draft not found:', draftId);
      return false;
    }

    const draft = draftSnap.data();

    if (targetDay < 1 || targetDay > 5) {
      console.log('[SnakeDraftDaily] Invalid target day:', targetDay);
      return false;
    }

    const dayKey = getDayKey(targetDay);
    const dailyData = draft.dailyData || {};

    console.log(`[SnakeDraftDaily] Recalculating day ${targetDay} scores for battle ${draftId}`);

    // Get baseline prices for the target day
    // Day 1: ALWAYS use lockedPrices (draft completion prices)
    // Day 2+: Use daily open prices, fall back to locked prices if not captured
    const openPrices = targetDay === 1
      ? (draft.lockedPrices || {})
      : (dailyData[dayKey]?.openPrices || draft.lockedPrices || {});

    if (Object.keys(openPrices).length === 0) {
      console.error('[SnakeDraftDaily] No baseline prices available');
      return false;
    }

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

    // Update Firebase with recalculated scores
    dailyData[dayKey] = {
      ...dailyData[dayKey],
      closeScores,
      recorded: true,
      recordedAt: new Date().toISOString(),
      recalculated: true,  // Mark as recalculated
    };

    await updateDoc(draftRef, {
      dailyData,
    });

    console.log(`[SnakeDraftDaily] Recalculated day ${targetDay} scores:`,
      Object.entries(closeScores).map(([id, data]) => `${id}: ${data.totalPoints}`).join(', '));

    return true;
  } catch (error) {
    console.error('[SnakeDraftDaily] Error recalculating day scores:', error);
    return false;
  }
}

/**
 * Check if Day 1 scores need recalculation (all zeros)
 * @param {object} dailyData - The dailyData object from the draft
 * @returns {boolean} Whether Day 1 needs recalculation
 */
export function needsDay1Recalculation(dailyData) {
  const day1Data = dailyData?.day1;

  if (!day1Data?.recorded || !day1Data?.closeScores) {
    return false; // Not recorded yet, doesn't need recalculation
  }

  // Check if all players have 0 points
  const allScores = Object.values(day1Data.closeScores);
  const allZeros = allScores.every(score => score.totalPoints === 0);

  return allZeros && allScores.length > 0;
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

export default {
  getCurrentTradingDay,
  getDayKey,
  isAfterMarketClose,
  needsDailyOpenCapture,
  captureDailyOpenPrices,
  recordDailyCloseScores,
  recalculateDayScores,
  needsDay1Recalculation,
  calculateCumulativeScores,
  checkAndCompleteBattle,
  formatDailyScoresForModal,
};
