// dailyScoringV4Service.js — Daily score banking for V4 BaggerBomb multi-day battles
//
// At the end of each trading day (8 PM ET), this service banks the active portfolio
// score for both players and resets threshold history so badges can re-trigger.
//
// Two-layer reliability:
//   1. Client-side: Hook detects end-of-day and calls bankDailyScores()
//   2. Server-side: Cron at 8:15 PM ET as backup (api/cron/baggerbomb-v4-daily-scores.js)
//   3. Day-transition fallback: If previous day wasn't banked, bank it when new day starts
//
// All writes are idempotent via a `recorded` flag inside a Firestore transaction.

import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getEasternTime } from '../constants/battleTiming';
import { V4_PVP_TIMING, getCurrentTradingDay } from '../constants/battleTimingV4';
import { calculateAssetScoreV3, flattenPortfolio } from '../utils/baggerBombUtils';

// ============================================
// HELPERS
// ============================================

/**
 * Check if we're past the V4 daily end (8 PM ET)
 * @returns {boolean}
 */
export function isAfterDailyEndV4() {
  const et = getEasternTime();
  const currentMinutes = et.getHours() * 60 + et.getMinutes();
  const endMinutes = V4_PVP_TIMING.DAILY_END_HOUR * 60 + V4_PVP_TIMING.DAILY_END_MINUTE;
  return currentMinutes >= endMinutes;
}

/**
 * Check if a specific day needs banking
 * @param {Object} battle - Battle document
 * @param {number} dayNumber - Trading day (1-indexed)
 * @returns {boolean}
 */
export function needsDayBanking(battle, dayNumber) {
  if (!battle || battle.isTraining) return false;
  if ((battle._v || 0) < 4) return false;
  const totalDays = battle.timing?.tradingDays || 3;
  if (dayNumber < 1 || dayNumber > totalDays) return false;
  return !battle.state?.dailyScores?.[`day${dayNumber}`]?.recorded;
}

/**
 * Sum banked activeScore from all recorded days for a player
 * @param {Object} dailyScores - battle.state.dailyScores
 * @param {string} playerId - 'creator' or 'opponent'
 * @returns {number}
 */
export function getBankedScoreTotal(dailyScores, playerId) {
  if (!dailyScores) return 0;
  let total = 0;
  for (const dayKey of Object.keys(dailyScores)) {
    const day = dailyScores[dayKey];
    if (day?.recorded && day[playerId]?.activeScore != null) {
      const score = day[playerId].activeScore;
      if (!isFinite(score)) {
        console.warn(`[Scoring] NaN/Infinity activeScore in ${dayKey}.${playerId} — skipping`);
        continue;
      }
      total += score;
    }
  }
  return total;
}

// ============================================
// SCORE CALCULATION
// ============================================

/**
 * Calculate active portfolio score for a player using provided prices
 * @param {Object} portfolio - Player's portfolio { star: [], core: [], support: [] }
 * @param {Object} closingPrices - Current/closing prices keyed by symbol
 * @param {Object} openPrices - Day's open prices keyed by symbol
 * @param {Object} history - Player's history keyed by symbol
 * @param {Object} thresholds - Battle thresholds keyed by symbol
 * @param {Object} previousClosePrices - Previous close prices for threshold baseline (optional)
 * @returns {{ activeScore: number, assetScores: Array }}
 */
function calculatePlayerActiveScore(portfolio, closingPrices, openPrices, history, thresholds, previousClosePrices = {}) {
  const flat = flattenPortfolio(portfolio);
  let totalActive = 0;
  const assetScores = [];

  flat.forEach(asset => {
    if (!asset) return;

    const entryPrice = asset.swapPrice || openPrices[asset.symbol] || 0;
    const closePrice = closingPrices[asset.symbol] || entryPrice;

    if (entryPrice > 0) {
      const priceChange = ((closePrice - entryPrice) / entryPrice) * 100;
      const assetHistory = history[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };
      const baseATR = thresholds[asset.symbol]?.threshold || asset.baseATR || 2.5;

      // Threshold detection from previous close (shared daily baseline)
      const prevClose = previousClosePrices[asset.symbol] || entryPrice;
      const thresholdPriceChange = prevClose > 0
        ? ((closePrice - prevClose) / prevClose) * 100
        : null;

      const score = calculateAssetScoreV3(
        { ...asset, baseATR },
        priceChange,
        assetHistory,
        {}, // no extremes in daily scoring
        thresholdPriceChange
      );

      totalActive += score.totalPoints;
      assetScores.push({
        symbol: asset.symbol,
        tier: asset.tier,
        points: score.totalPoints,
        priceChange: Math.round(priceChange * 100) / 100,
        badges: score.badges,
      });
    }
  });

  return {
    activeScore: Math.round(totalActive * 100) / 100,
    assetScores,
  };
}

// ============================================
// BANKING
// ============================================

/**
 * Bank daily scores for a specific day. Uses a Firestore transaction for atomicity.
 * Idempotent: if the day is already recorded, this is a no-op.
 *
 * @param {string} battleId - Battle document ID
 * @param {number} dayNumber - Trading day to bank (1-indexed)
 * @param {Object} closingPrices - Current/closing prices keyed by symbol
 * @param {string} [source='client'] - Who triggered the banking ('client', 'cron', 'day_transition')
 * @returns {Promise<{ success: boolean, reason?: string, scores?: Object }>}
 */
export async function bankDailyScores(battleId, dayNumber, closingPrices, source = 'client') {
  const battleRef = doc(db, 'battles', battleId);

  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(battleRef);
    if (!snap.exists()) return { success: false, reason: 'not_found' };

    const data = snap.data();
    const dayKey = `day${dayNumber}`;

    // Idempotency: already banked
    if (data.state?.dailyScores?.[dayKey]?.recorded) {
      return { success: true, reason: 'already_recorded' };
    }

    // Guard: skip training
    if (data.isTraining) return { success: false, reason: 'training' };

    // Get open prices for this day
    const openPrices = data.state?.dailyOpenPrices?.[dayKey] || data.state?.startingPrices || {};
    const thresholds = data.thresholds || {};

    const updates = {};
    const dayScoreData = {};

    for (const role of ['creator', 'opponent']) {
      const player = data[role];
      if (!player?.portfolio) continue;

      const history = player.history || {};

      // Calculate active portfolio score
      // V4 scoring is cumulative — threshold baseline = entry price (openPrices), not previous close
      const { activeScore, assetScores } = calculatePlayerActiveScore(
        player.portfolio, closingPrices, openPrices, history, thresholds, openPrices
      );

      // Capture closing prices for portfolio symbols
      const flat = flattenPortfolio(player.portfolio);
      const capturedClosing = {};
      flat.forEach(a => {
        if (a && closingPrices[a.symbol] != null) {
          capturedClosing[a.symbol] = closingPrices[a.symbol];
        }
      });

      dayScoreData[role] = {
        activeScore,
        closingPrices: capturedClosing,
        assetScores,
      };

      // Reset history for all portfolio assets, archiving old values
      const resetHistory = {};
      // Include all symbols from current history (covers swapped-out assets still in history)
      const allSymbols = new Set([
        ...flat.map(a => a?.symbol).filter(Boolean),
        ...Object.keys(history),
      ]);

      for (const symbol of allSymbols) {
        const oldHistory = history[symbol] || {};
        resetHistory[symbol] = {
          maxMultiplier: 0,
          minMultiplier: 0,
          badges: [],
          dailyThresholds: {
            ...(oldHistory.dailyThresholds || {}),
            [dayKey]: {
              maxMultiplier: oldHistory.maxMultiplier || 0,
              minMultiplier: oldHistory.minMultiplier || 0,
            },
          },
        };
      }
      updates[`${role}.history`] = resetHistory;

      // Clear swapPrice on assets swapped in before the next day
      // so Day N+1 scoring uses dailyOpenPrices instead (prevents double-counting)
      const nextDay = dayNumber + 1;
      const updatedPortfolio = JSON.parse(JSON.stringify(player.portfolio));
      for (const tier of ['star', 'core', 'support']) {
        for (let i = 0; i < (updatedPortfolio[tier] || []).length; i++) {
          const asset = updatedPortfolio[tier][i];
          if (asset && asset.swapPrice && (asset.swappedInDay || 0) < nextDay) {
            asset.previousSwapPrice = asset.swapPrice;
            asset.previousSwapDay = asset.swappedInDay;
            delete asset.swapPrice;
            delete asset.swappedInDay;
          }
        }
      }
      updates[`${role}.portfolio`] = updatedPortfolio;
    }

    // Write daily scores
    updates[`state.dailyScores.${dayKey}`] = {
      ...dayScoreData,
      recorded: true,
      recordedAt: new Date().toISOString(),
      recordedBy: source,
    };
    updates.updatedAt = new Date().toISOString();

    transaction.update(battleRef, updates);

    return { success: true, dayBanked: dayNumber, scores: dayScoreData };
  });
}

/**
 * Fallback: check and bank any previous days that weren't recorded.
 * Called at day transition when entering a new trading day.
 *
 * @param {string} battleId - Battle document ID
 * @param {number} currentDay - Current trading day (1-indexed)
 * @param {Object} currentPrices - Current prices (proxy for missing close prices)
 * @returns {Promise<void>}
 */
export async function checkAndBankPreviousDays(battleId, currentDay, currentPrices) {
  // Read the battle doc to check which days need banking
  // We do individual bankDailyScores calls, each with their own transaction
  const { doc: docFn, getDoc } = await import('firebase/firestore');
  const battleRef = docFn(db, 'battles', battleId);
  const snap = await getDoc(battleRef);
  if (!snap.exists()) return;

  const data = snap.data();
  if (data.isTraining) return;

  for (let day = 1; day < currentDay; day++) {
    const dayKey = `day${day}`;
    if (!data.state?.dailyScores?.[dayKey]?.recorded) {
      try {
        await bankDailyScores(battleId, day, currentPrices, 'day_transition');
      } catch (err) {
        console.error(`[DailyScoringV4] Failed to bank day ${day} for battle ${battleId}:`, err);
      }
    }
  }
}

// ============================================
// V4 FINAL SCORE CALCULATION (for battle completion)
// ============================================

/**
 * Calculate final V4 scores for both players at battle completion.
 * Total = banked previous days + current day active score + closed trade points.
 * Mirrors the scoring in useBaggerBombBattleV4 hook but as a standalone function.
 *
 * @param {Object} battle - Full V4 battle document
 * @param {Object} endingPrices - Current/ending prices keyed by symbol
 * @returns {{ creatorScore: number, opponentScore: number }}
 */
export function calculateV4FinalScores(battle, endingPrices) {
  // 1. Get open prices for the current/final trading day
  const tradingDayDates = battle.timing?.tradingDayDates;
  const currentDay = tradingDayDates?.length > 0 ? getCurrentTradingDay(tradingDayDates) : 1;
  const dayKey = `day${currentDay}`;
  const openPrices = battle.state?.dailyOpenPrices?.[dayKey]
    || battle.state?.startingPrices || {};

  // 2. Calculate active day score for each player (reuses existing calculatePlayerActiveScore)
  const creatorHistory = battle.creator?.history || {};
  const opponentHistory = battle.opponent?.history || {};
  const thresholds = battle.thresholds || {};
  // V4 scoring is cumulative — threshold baseline = entry price (openPrices), not previous close
  const creatorActive = calculatePlayerActiveScore(
    battle.creator?.portfolio, endingPrices, openPrices, creatorHistory, thresholds, openPrices
  );
  const opponentActive = calculatePlayerActiveScore(
    battle.opponent?.portfolio, endingPrices, openPrices, opponentHistory, thresholds, openPrices
  );

  // 3. Banked previous days
  const creatorBanked = getBankedScoreTotal(battle.state?.dailyScores, 'creator');
  const opponentBanked = getBankedScoreTotal(battle.state?.dailyScores, 'opponent');

  // 4. Closed trade points
  const creatorClosed = (battle.creator?.closedTrades || [])
    .reduce((sum, t) => sum + (t.lockedPoints || 0), 0);
  const opponentClosed = (battle.opponent?.closedTrades || [])
    .reduce((sum, t) => sum + (t.lockedPoints || 0), 0);

  return {
    creatorScore: Math.round(creatorBanked + creatorActive.activeScore + creatorClosed),
    opponentScore: Math.round(opponentBanked + opponentActive.activeScore + opponentClosed),
  };
}
