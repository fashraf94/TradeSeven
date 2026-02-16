// swapServiceV4.js — V4 Swap validation and execution
// Replaces the V3 substitution system with free-agent-based swaps
//
// Rules:
// - PvP: 3 swaps per day, 3 days = 9 total
// - Training: 1 swap total
// - Stocks can only replace stock slots, crypto can only replace crypto slot (support[2])
// - New stock gains start fresh from swap price (not day's open)
// - Old stock points are locked into closedTrades

import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getDailySwapsRemaining, getCurrentTradingDay } from '../constants/battleTimingV4';
import { calculateAssetScoreV3, isSwapLocked } from '../utils/baggerBombUtils';
import { CONVICTION_MULTIPLIERS } from '../constants/baggerBombScoring';

// ============================================
// VALIDATION
// ============================================

/**
 * Validate whether a swap is allowed
 *
 * @param {Object} battle - Full battle object
 * @param {string} playerId - 'creator' or 'opponent'
 * @param {string} outTier - Tier of outgoing asset ('star', 'core', 'support')
 * @param {number} outSlotIndex - Slot index within the tier
 * @param {string} inSymbol - Symbol of incoming free agent
 * @param {number} currentDay - Current trading day (1-indexed)
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSwap(battle, playerId, outTier, outSlotIndex, inSymbol, currentDay, currentPrices = {}) {
  const player = battle[playerId];
  if (!player) {
    return { valid: false, error: 'Player not found' };
  }

  // Check swaps remaining
  const remaining = getDailySwapsRemaining(player.swaps, currentDay);
  if (remaining <= 0) {
    return { valid: false, error: 'No swaps remaining today' };
  }

  // Verify outgoing slot exists and has an asset
  const outAsset = player.portfolio?.[outTier]?.[outSlotIndex];
  if (!outAsset) {
    return { valid: false, error: 'No asset in the selected slot' };
  }

  // Verify incoming symbol is in free agents
  const freeAgents = battle.freeAgents?.current || [];
  const inAgent = freeAgents.find(a => a.symbol === inSymbol);
  if (!inAgent) {
    return { valid: false, error: 'Asset is not available as a free agent' };
  }

  // Type restriction: stocks can only replace stock slots, crypto only crypto slot
  const outIsCrypto = Boolean(outAsset.isCrypto);
  const inIsCrypto = Boolean(inAgent.isCrypto);

  if (outIsCrypto !== inIsCrypto) {
    if (inIsCrypto) {
      return { valid: false, error: 'Crypto can only replace the crypto slot (Support slot 3)' };
    } else {
      return { valid: false, error: 'Stocks can only replace stock slots' };
    }
  }

  // Orange Zone swap lock — block swaps when stock is near a threshold
  if (currentPrices && Object.keys(currentPrices).length > 0) {
    const openPrice = outAsset.swapPrice || battle?.state?.startingPrices?.[outAsset.symbol] || 0;
    const curPrice = currentPrices[outAsset.symbol] || openPrice;
    const baseATR = battle?.thresholds?.[outAsset.symbol]?.threshold || 2.5;
    if (openPrice > 0 && baseATR > 0) {
      const multiplier = ((curPrice - openPrice) / openPrice) * 100 / baseATR;
      const lockStatus = isSwapLocked(multiplier, baseATR);
      if (lockStatus.locked) {
        return { valid: false, error: `${outAsset.symbol} is in the danger zone — too close to a threshold to swap` };
      }
    }
  }

  return { valid: true };
}

// ============================================
// EXECUTION
// ============================================

/**
 * Execute a swap: remove an active asset and replace with a free agent
 * Uses Firestore transaction for atomicity
 *
 * @param {string} battleId - Battle document ID
 * @param {Object} battle - Full battle object (for reading current state)
 * @param {string} playerId - 'creator' or 'opponent'
 * @param {string} outTier - Tier of outgoing asset
 * @param {number} outSlotIndex - Slot index within the tier
 * @param {string} inSymbol - Symbol of incoming free agent
 * @param {number} currentDay - Current trading day (1-indexed)
 * @param {Object} currentPrices - Current prices keyed by symbol
 * @returns {Promise<Object>} Updated battle data
 */
export async function executeSwap(
  battleId,
  battle,
  playerId,
  outTier,
  outSlotIndex,
  inSymbol,
  currentDay,
  currentPrices
) {
  // Validate first
  const validation = validateSwap(battle, playerId, outTier, outSlotIndex, inSymbol, currentDay);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const battleRef = doc(db, 'battles', battleId);

  return await runTransaction(db, async (transaction) => {
    const battleSnap = await transaction.get(battleRef);
    if (!battleSnap.exists()) {
      throw new Error('Battle not found');
    }

    const liveData = battleSnap.data();
    const player = liveData[playerId];
    const outAsset = player.portfolio[outTier][outSlotIndex];
    const freeAgent = liveData.freeAgents.current.find(a => a.symbol === inSymbol);

    if (!outAsset || !freeAgent) {
      throw new Error('Asset or free agent no longer available');
    }

    // Re-check swaps remaining against live data
    const liveRemaining = getDailySwapsRemaining(player.swaps, currentDay);
    if (liveRemaining <= 0) {
      throw new Error('No swaps remaining (race condition)');
    }

    // ---- Calculate locked points for outgoing asset ----
    const outSymbol = outAsset.symbol;
    const entryPrice = outAsset.swapPrice || // If this was previously swapped in
      liveData.state?.dailyOpenPrices?.[`day${currentDay}`]?.[outSymbol] ||
      liveData.state?.startingPrices?.[outSymbol] ||
      0;
    const exitPrice = currentPrices[outSymbol] || entryPrice;

    let lockedGainPct = 0;
    let lockedPoints = 0;
    if (entryPrice > 0) {
      lockedGainPct = ((exitPrice - entryPrice) / entryPrice) * 100;
      const threshold = liveData.thresholds?.[outSymbol] || {};
      lockedPoints = calculateAssetScoreV3(
        lockedGainPct,
        threshold.threshold || 2.5,
        outTier,
        CONVICTION_MULTIPLIERS
      );
    }

    // ---- Build closed trade record ----
    const closedTrade = {
      symbol: outSymbol,
      name: outAsset.name || outSymbol,
      tier: outTier,
      slotIndex: outSlotIndex,
      entryPrice,
      exitPrice,
      lockedPoints: Math.round(lockedPoints * 100) / 100,
      lockedGainPct: Math.round(lockedGainPct * 1000) / 1000,
      swappedOutAt: new Date().toISOString(),
      swapDay: currentDay,
    };

    // ---- Build swap history record ----
    const swapRecord = {
      timestamp: new Date().toISOString(),
      day: currentDay,
      removedSymbol: outSymbol,
      removedTier: outTier,
      removedSlotIndex: outSlotIndex,
      addedSymbol: inSymbol,
      addedFromFreeAgent: true,
      swapPrice: currentPrices[inSymbol] || 0,
    };

    // ---- Build incoming asset object ----
    const incomingAsset = {
      symbol: freeAgent.symbol,
      name: freeAgent.name,
      isCrypto: freeAgent.isCrypto,
      baseATR: liveData.thresholds?.[inSymbol]?.threshold || (freeAgent.isCrypto ? 5.0 : 2.5),
      swapPrice: currentPrices[inSymbol] || 0, // Gains start from this price
      swappedInAt: new Date().toISOString(),
      swappedInDay: currentDay,
    };

    // ---- Build update paths ----
    const closedTrades = [...(player.closedTrades || []), closedTrade];
    const swapHistory = [...(player.swaps?.history || []), swapRecord];
    const newRemaining = { ...(player.swaps?.remaining || {}) };
    newRemaining[`day${currentDay}`] = Math.max(0, (newRemaining[`day${currentDay}`] || 0) - 1);

    // Update portfolio slot
    const newTier = [...(player.portfolio[outTier] || [])];
    newTier[outSlotIndex] = incomingAsset;

    // Update history for new asset
    const newHistory = { ...(player.history || {}) };
    newHistory[inSymbol] = {
      maxMultiplier: 0,
      minMultiplier: 0,
      badges: [],
      dailyThresholds: {},
    };

    // Build Firebase update object
    const updates = {
      [`${playerId}.portfolio.${outTier}`]: newTier,
      [`${playerId}.closedTrades`]: closedTrades,
      [`${playerId}.swaps.remaining`]: newRemaining,
      [`${playerId}.swaps.history`]: swapHistory,
      [`${playerId}.history`]: newHistory,
      updatedAt: new Date().toISOString(),
    };

    // Add swap event to events array
    const swapEvent = {
      type: 'swap',
      playerId,
      removedSymbol: outSymbol,
      addedSymbol: inSymbol,
      lockedPoints: closedTrade.lockedPoints,
      tier: outTier,
      timestamp: new Date().toISOString(),
      day: currentDay,
    };

    const events = [...(liveData.events || []), swapEvent];
    updates.events = events;

    transaction.update(battleRef, updates);

    return {
      closedTrade,
      swapRecord,
      incomingAsset,
      swapsRemaining: newRemaining[`day${currentDay}`],
    };
  });
}

// ============================================
// STATUS
// ============================================

/**
 * Get swap status for a player
 * @param {Object} battle - Full battle object
 * @param {string} playerId - 'creator' or 'opponent'
 * @param {number} currentDay - Current trading day (1-indexed)
 * @returns {{ remaining: number, used: number, canSwap: boolean, isTraining: boolean }}
 */
export function getSwapStatus(battle, playerId, currentDay) {
  const player = battle?.[playerId];
  if (!player) {
    return { remaining: 0, used: 0, canSwap: false, isTraining: false };
  }

  const isTraining = Boolean(battle.isTraining);
  const remaining = getDailySwapsRemaining(player.swaps, currentDay);
  const totalUsed = (player.swaps?.history || []).length;

  return {
    remaining,
    used: totalUsed,
    canSwap: remaining > 0 && battle.state?.status === 'active',
    isTraining,
  };
}

/**
 * Get human-readable swap status label
 * @param {number} remaining - Swaps remaining
 * @param {boolean} isTraining - Whether this is a training battle
 * @returns {string}
 */
export function getSwapStatusLabel(remaining, isTraining = false) {
  if (remaining <= 0) {
    return isTraining ? 'Swap used' : 'No swaps today';
  }
  if (isTraining) {
    return '1 swap available';
  }
  return `${remaining} swap${remaining !== 1 ? 's' : ''} left today`;
}
