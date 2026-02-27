// swapServiceV4.js — V4/V5 Swap validation and execution
// V4: Free-agent-based swaps (stocks ↔ stocks, crypto ↔ crypto)
// V5: Swap Market with Cash positions, Crypto Pool (long/short), stock free agents
//
// Rules:
// - PvP: 3 swaps per day, 3 days = 9 total
// - Training: 3 swaps total (V5)
// - Type restriction: crypto slot (support[2]) can only hold crypto, stock slots hold stocks
// - Cash can occupy any slot; filling a cash slot must match the original slot type
// - New asset gains start fresh from swap price (not day's open)
// - Old asset points are locked into closedTrades
// - Crypto positions support direction: 'long' or 'short'
// - Short positions invert P&L: price drop = positive gain

import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getDailySwapsRemaining, getCurrentTradingDay } from '../constants/battleTimingV4';
import { calculateAssetScoreV3, isSwapLocked } from '../utils/baggerBombUtils';
import { CRYPTO_POOL_SYMBOLS, CASH_POSITION } from '../constants/cryptoPool';

// ============================================
// VALIDATION
// ============================================

/**
 * Validate whether a swap is allowed (V5 — supports cash, crypto pool, stock free agents)
 *
 * @param {Object} battle - Full battle object
 * @param {string} playerId - 'creator' or 'opponent'
 * @param {string} outTier - Tier of outgoing asset ('star', 'core', 'support')
 * @param {number} outSlotIndex - Slot index within the tier
 * @param {Object} inAgent - Incoming asset object (from free agents or crypto pool)
 * @param {number} currentDay - Current trading day (1-indexed)
 * @param {Object} currentPrices - Current prices keyed by symbol
 * @param {Object} options - { swapType: 'stock'|'crypto'|'cash'|'fillCash', direction: 'long'|'short' }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSwap(battle, playerId, outTier, outSlotIndex, inAgent, currentDay, currentPrices = {}, options = {}) {
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

  const { swapType } = options;

  // Cash swap — going TO cash (any slot allowed)
  if (swapType === 'cash') {
    if (outAsset.isCash) {
      return { valid: false, error: 'Slot is already cash' };
    }
    // No further type checking needed — any slot can go to cash
  }
  // Crypto pool swap
  else if (swapType === 'crypto') {
    if (!inAgent?.isCrypto) {
      return { valid: false, error: 'Expected a crypto asset' };
    }
    // Crypto can only go into the crypto slot (support[2]) or a cash slot that was formerly crypto
    if (outAsset.isCash) {
      // Filling a cash slot — check the original slot type
      const isCryptoSlot = outTier === 'support' && outSlotIndex === 2;
      if (!isCryptoSlot) {
        return { valid: false, error: 'Crypto can only fill a cash slot that was originally the crypto slot (Support slot 3)' };
      }
    } else {
      // Direct swap — must be crypto slot
      const isCryptoSlot = outTier === 'support' && outSlotIndex === 2;
      if (!isCryptoSlot && !outAsset.isCrypto) {
        return { valid: false, error: 'Crypto can only replace the crypto slot (Support slot 3)' };
      }
    }
  }
  // Stock free agent swap
  else if (swapType === 'stock') {
    if (inAgent?.isCrypto) {
      return { valid: false, error: 'Expected a stock asset' };
    }
    // Stock can only go into stock slots or cash slots that were formerly stock
    if (outAsset.isCash) {
      const isCryptoSlot = outTier === 'support' && outSlotIndex === 2;
      if (isCryptoSlot) {
        return { valid: false, error: 'Stocks cannot fill the crypto slot (Support slot 3)' };
      }
    } else if (outAsset.isCrypto) {
      return { valid: false, error: 'Stocks can only replace stock slots' };
    }

    // Verify incoming symbol is in free agents
    const freeAgents = battle.freeAgents?.current || [];
    const found = freeAgents.find(a => a.symbol === inAgent?.symbol);
    if (!found) {
      return { valid: false, error: 'Asset is not available as a free agent' };
    }
  }

  // Orange Zone swap lock — block swaps when asset is near a threshold
  // Skip for cash slots (no price to check)
  if (!outAsset.isCash && currentPrices && Object.keys(currentPrices).length > 0) {
    const openPrice = outAsset.swapPrice || battle?.state?.startingPrices?.[outAsset.symbol] || 0;
    const curPrice = currentPrices[outAsset.symbol] || openPrice;
    const baseATR = battle?.thresholds?.[outAsset.symbol]?.threshold || 2.5;
    if (openPrice > 0 && baseATR > 0) {
      let rawMultiplier = ((curPrice - openPrice) / openPrice) * 100 / baseATR;
      // Invert for short positions
      if (outAsset.direction === 'short') {
        rawMultiplier = -rawMultiplier;
      }
      const lockStatus = isSwapLocked(rawMultiplier, baseATR);
      if (lockStatus.locked) {
        return { valid: false, error: `${outAsset.symbol} is in the danger zone — too close to a threshold to swap` };
      }
    }
  }

  return { valid: true };
}

// ============================================
// LOCKED POINTS CALCULATION
// ============================================

/**
 * Calculate locked points for an outgoing asset, respecting direction for shorts
 */
function calculateLockedPoints(outAsset, outTier, entryPrice, exitPrice, thresholds, playerHistory) {
  if (outAsset.isCash) {
    return { lockedPoints: 0, lockedGainPct: 0 };
  }

  if (entryPrice <= 0) {
    return { lockedPoints: 0, lockedGainPct: 0 };
  }

  let rawPctChange = ((exitPrice - entryPrice) / entryPrice) * 100;

  // Invert for short positions: price drop = positive gain
  if (outAsset.direction === 'short') {
    rawPctChange = -rawPctChange;
  }

  const threshold = thresholds?.[outAsset.symbol] || {};
  const assetObj = {
    symbol: outAsset.symbol,
    baseATR: threshold.threshold || outAsset.baseATR || 2.5,
    tier: outTier,
  };
  const assetHistory = playerHistory?.[outAsset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };
  const scoreResult = calculateAssetScoreV3(assetObj, rawPctChange, assetHistory);

  return {
    lockedPoints: scoreResult.totalPoints,
    lockedGainPct: rawPctChange,
  };
}

// ============================================
// EXECUTION — PvP (Firestore transaction)
// ============================================

/**
 * Execute a swap (V5): Supports stock↔stock, crypto pool, cash, fill-cash
 * Uses Firestore transaction for atomicity
 *
 * @param {string} battleId - Battle document ID
 * @param {Object} battle - Full battle object (for reading current state)
 * @param {string} playerId - 'creator' or 'opponent'
 * @param {string} outTier - Tier of outgoing asset
 * @param {number} outSlotIndex - Slot index within the tier
 * @param {Object} pickedAgent - Incoming asset { symbol, name, isCrypto, baseATR }
 * @param {number} currentDay - Current trading day (1-indexed)
 * @param {Object} currentPrices - Current prices keyed by symbol
 * @param {Object} options - { swapType: 'stock'|'crypto'|'cash', direction: 'long'|'short'|null }
 * @returns {Promise<Object>} Updated battle data
 */
export async function executeSwap(
  battleId,
  battle,
  playerId,
  outTier,
  outSlotIndex,
  pickedAgent,
  currentDay,
  currentPrices,
  options = {}
) {
  const { swapType = 'stock', direction = null } = options;
  const inSymbol = pickedAgent?.symbol;

  // Validate first
  const validation = validateSwap(battle, playerId, outTier, outSlotIndex, pickedAgent, currentDay, currentPrices, options);
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

    if (!outAsset) {
      throw new Error('Asset no longer available in slot');
    }

    // Re-check swaps remaining against live data
    const liveRemaining = getDailySwapsRemaining(player.swaps, currentDay);
    if (liveRemaining <= 0) {
      throw new Error('No swaps remaining (race condition)');
    }

    const now = new Date().toISOString();

    // ---- Calculate locked points for outgoing asset ----
    let lockedPoints = 0;
    let lockedGainPct = 0;
    let closedTrade = null;

    if (!outAsset.isCash) {
      const outSymbol = outAsset.symbol;
      const entryPrice = outAsset.swapPrice ||
        liveData.state?.dailyOpenPrices?.[`day${currentDay}`]?.[outSymbol] ||
        liveData.state?.startingPrices?.[outSymbol] ||
        0;
      const exitPrice = currentPrices[outSymbol] || entryPrice;

      const locked = calculateLockedPoints(outAsset, outTier, entryPrice, exitPrice, liveData.thresholds, player.history);
      lockedPoints = locked.lockedPoints;
      lockedGainPct = locked.lockedGainPct;

      closedTrade = {
        symbol: outSymbol,
        name: outAsset.name || outSymbol,
        tier: outTier,
        slotIndex: outSlotIndex,
        entryPrice,
        exitPrice,
        lockedPoints: Math.round(lockedPoints * 100) / 100,
        lockedGainPct: Math.round(lockedGainPct * 1000) / 1000,
        swappedOutAt: now,
        swapDay: currentDay,
        isCrypto: outAsset.isCrypto || false,
        direction: outAsset.direction || null,
        closedToCash: swapType === 'cash',
      };
    }

    // ---- Build incoming asset object ----
    let incomingAsset;
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
      incomingAsset = {
        symbol: pickedAgent.symbol,
        name: pickedAgent.name,
        isCrypto: pickedAgent.isCrypto || false,
        baseATR: liveData.thresholds?.[inSymbol]?.threshold || pickedAgent.baseATR || (pickedAgent.isCrypto ? 5.0 : 2.5),
        swapPrice: currentPrices[inSymbol] || 0,
        swappedInAt: now,
        swappedInDay: currentDay,
      };
      // Add direction for crypto
      if (pickedAgent.isCrypto && direction) {
        incomingAsset.direction = direction;
      }
    }

    // ---- Build swap history record ----
    const swapRecord = {
      timestamp: now,
      day: currentDay,
      removedSymbol: outAsset.isCash ? 'CASH' : outAsset.symbol,
      removedTier: outTier,
      removedSlotIndex: outSlotIndex,
      addedSymbol: swapType === 'cash' ? 'CASH' : inSymbol,
      addedFromFreeAgent: swapType === 'stock',
      addedFromCryptoPool: swapType === 'crypto',
      swapType,
      direction: direction || null,
      swapPrice: swapType === 'cash' ? 0 : (currentPrices[inSymbol] || 0),
    };

    // ---- Build update paths ----
    const closedTrades = closedTrade
      ? [...(player.closedTrades || []), closedTrade]
      : [...(player.closedTrades || [])];
    const swapHistory = [...(player.swaps?.history || []), swapRecord];
    const newRemaining = { ...(player.swaps?.remaining || {}) };
    newRemaining[`day${currentDay}`] = Math.max(0, (newRemaining[`day${currentDay}`] || 0) - 1);

    // Update portfolio slot
    const newTier = [...(player.portfolio[outTier] || [])];
    newTier[outSlotIndex] = incomingAsset;

    // Update history for new asset (skip for cash)
    const newHistory = { ...(player.history || {}) };
    if (swapType !== 'cash' && inSymbol) {
      newHistory[inSymbol] = {
        maxMultiplier: 0,
        minMultiplier: 0,
        badges: [],
        dailyThresholds: {},
      };
    }

    // Build Firebase update object
    const updates = {
      [`${playerId}.portfolio.${outTier}`]: newTier,
      [`${playerId}.closedTrades`]: closedTrades,
      [`${playerId}.swaps.remaining`]: newRemaining,
      [`${playerId}.swaps.history`]: swapHistory,
      [`${playerId}.history`]: newHistory,
      updatedAt: now,
    };

    // ---- Free agent bar updates ----
    if (swapType === 'stock') {
      const currentFreeAgents = liveData.freeAgents?.current || [];
      let updatedFreeAgents;

      if (outAsset.isCash || outAsset.isCrypto) {
        // Filling a cash slot from stock FA or replacing crypto with stock (shouldn't happen with type restriction)
        // → picked stock is simply removed from bar (no replacement)
        updatedFreeAgents = currentFreeAgents.filter(fa => fa.symbol !== inSymbol);
      } else {
        // Stock → Stock swap: dropped stock replaces picked stock's position in bar
        updatedFreeAgents = currentFreeAgents.map(fa => {
          if (fa.symbol === inSymbol) {
            return {
              symbol: outAsset.symbol,
              name: outAsset.name || outAsset.symbol,
              isCrypto: false,
              appearedAt: now,
            };
          }
          return fa;
        });
      }
      updates['freeAgents.current'] = updatedFreeAgents;
    }

    // ---- Crypto pool state updates ----
    if (liveData.cryptoPool) {
      const cryptoPoolUpdates = { ...liveData.cryptoPool };

      // If dropping a crypto, mark it as out of roster
      if (!outAsset.isCash && outAsset.isCrypto && CRYPTO_POOL_SYMBOLS.has(outAsset.symbol)) {
        cryptoPoolUpdates[outAsset.symbol] = { inRoster: false };
      }
      // If picking a crypto, mark it as in roster
      if (swapType === 'crypto' && CRYPTO_POOL_SYMBOLS.has(inSymbol)) {
        cryptoPoolUpdates[inSymbol] = { inRoster: true };
      }

      updates.cryptoPool = cryptoPoolUpdates;
    }

    // Add swap event to events array
    const swapEvent = {
      type: 'swap',
      playerId,
      removedSymbol: outAsset.isCash ? `CASH (was: ${outAsset.previousAsset})` : outAsset.symbol,
      addedSymbol: swapType === 'cash' ? 'CASH' : inSymbol,
      lockedPoints: closedTrade ? closedTrade.lockedPoints : 0,
      tier: outTier,
      timestamp: now,
      day: currentDay,
      swapType,
      direction: direction || (outAsset.direction) || null,
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
    return isTraining ? 'No swaps left' : 'No swaps today';
  }
  return `${remaining} swap${remaining !== 1 ? 's' : ''} left`;
}
