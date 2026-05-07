// api/_utils/agentSwapExecution.js
// Server-side swap validation and execution for agent battles.
// Uses Firebase Admin SDK (not client SDK).
// Writes to agentBattles collection (not battles).

import {
  calculateAssetScoreServer,
  flattenPortfolioServer,
  flattenBenchServer,
} from './agentScoring.js';

// ==================== VALIDATION ====================

/**
 * Validate a Haiku trade decision against the live battle state.
 *
 * @param {Object} decision - Haiku's tool output { decision, symbolOut, symbolIn, conviction, hypothesis, ... }
 * @param {Object} battle - Full agentBattle document
 * @returns {{ valid: boolean, errors: string[], resolvedTier: string|null, resolvedSlotIndex: number|null }}
 */
export function validateTradeDecision(decision, battle) {
  const errors = [];
  let resolvedTier = null;
  let resolvedSlotIndex = null;

  if (decision.decision === 'SWAP') {
    // 1. Resolve symbolOut in portfolio
    const found = findAssetInPortfolio(battle.portfolio, decision.symbolOut);
    if (!found) {
      errors.push(`symbolOut "${decision.symbolOut}" not found in active portfolio`);
    } else {
      resolvedTier = found.tier;
      resolvedSlotIndex = found.slotIndex;
    }

    // 2. Check symbolIn exists in bench or watchlist hotBench
    const benchAsset = findAssetInBench(battle.portfolio?.bench, decision.symbolIn);
    const hotBenchMatch = !benchAsset && (battle.watchlist?.hotBench || []).includes(decision.symbolIn);
    if (!benchAsset && !hotBenchMatch) {
      errors.push(`symbolIn "${decision.symbolIn}" not found in bench or watchlist`);
    }

    // 3. Check 24h cooldown on bench asset (hotBench stocks have no cooldown)
    if (benchAsset?.cooldownUntil) {
      const cooldownEnd = new Date(benchAsset.cooldownUntil);
      if (cooldownEnd > new Date()) {
        errors.push(`symbolIn "${decision.symbolIn}" is on 24h cooldown until ${benchAsset.cooldownUntil}`);
      }
    }

    // 4. Asset type match (stock↔stock, crypto↔crypto)
    if (found && (benchAsset || hotBenchMatch)) {
      const activeAsset = getAssetAt(battle.portfolio, found.tier, found.slotIndex);
      // hotBench stocks are always non-crypto
      const incomingIsCrypto = benchAsset ? benchAsset.isCrypto : false;
      if (activeAsset && activeAsset.isCrypto !== incomingIsCrypto) {
        errors.push('Cannot swap stock for crypto or vice versa');
      }
    }

    // 5. Conviction floor
    if (decision.conviction < 70) {
      errors.push(`Conviction ${decision.conviction} below 70 threshold`);
    }

    // NO swap budget check (Amendment 2: unlimited agent swaps)
  }

  // 6. Validate hypothesis
  if (!decision.hypothesis || decision.hypothesis.trim().length < 10) {
    errors.push('Hypothesis is missing or too short');
  }

  return { valid: errors.length === 0, errors, resolvedTier, resolvedSlotIndex };
}

// ==================== EXECUTION ====================

/**
 * Execute a swap on an agent battle using Firestore admin SDK transaction.
 * Mirrors src/services/swapServiceV4.js:210-361 but adapted for admin SDK
 * and agentBattles collection.
 *
 * Key differences from V4 swap service:
 * - No swap budget (unlimited swaps)
 * - Revolving door bench (outgoing asset returns to bench with 24h cooldown)
 * - Admin SDK transaction syntax
 * - Self-contained in agentBattles (no freeAgents/cryptoPool updates)
 *
 * @param {Object} db - Firestore admin instance
 * @param {string} battleId - agentBattle document ID
 * @param {Object} battle - Current battle document data
 * @param {string} resolvedTier - 'star' | 'core' | 'support'
 * @param {number} resolvedSlotIndex - Slot index within tier
 * @param {Object} benchAsset - The bench asset to swap in
 * @param {number} currentDay - Current trading day (1-indexed)
 * @param {Object} currentPrices - { symbol: { current, previousClose, ... } }
 * @param {Object} evaluationMetadata - { id, action, trigger, rationale, hypothesis, evaluationId, tradingDay }
 * @param {Object|null} snapshot - Phase 4: per-symbol technical snapshot { symbolOut, symbolIn }, persisted on trades[i].snapshot for Sprint 2 replay. Null when not provided.
 * @returns {Object} { closedTrade, incomingAsset }
 */
export async function executeSwapServer(db, battleId, battle, resolvedTier, resolvedSlotIndex, benchAsset, currentDay, currentPrices, evaluationMetadata = {}, snapshot = null) {
  const battleRef = db.collection('agentBattles').doc(battleId);

  return await db.runTransaction(async (transaction) => {
    const battleSnap = await transaction.get(battleRef);
    if (!battleSnap.exists) {
      throw new Error('Agent battle not found');
    }

    const liveData = battleSnap.data();
    const outAsset = liveData.portfolio[resolvedTier]?.[resolvedSlotIndex];

    if (!outAsset) {
      throw new Error('Asset no longer available in slot');
    }

    const now = new Date().toISOString();
    const outSymbol = outAsset.symbol;
    const inSymbol = benchAsset.symbol;

    // Prefer live beacon prices over REST-fetched (15-min delayed) prices
    const beacon = liveData.livePriceBeacon;
    const beaconFresh = beacon?.updatedAt &&
      (Date.now() - new Date(beacon.updatedAt).getTime()) < 120000; // < 2 min

    const getPrice = (symbol) => {
      if (beaconFresh && beacon.prices?.[symbol] > 0) return beacon.prices[symbol];
      return currentPrices[symbol]?.current;
    };

    // ---- Calculate locked points for outgoing asset ----
    const entryPrice = outAsset.swapPrice
      || liveData.portfolio?.startingPrices?.[outSymbol]
      || 0;
    const exitPrice = getPrice(outSymbol) || entryPrice;

    let lockedPoints = 0;
    let lockedGainPct = 0;

    if (entryPrice > 0) {
      let rawPctChange = ((exitPrice - entryPrice) / entryPrice) * 100;
      if (outAsset.direction === 'short') {
        rawPctChange = -rawPctChange;
      }

      const threshold = liveData.scoring?.thresholds?.[outSymbol];
      const assetObj = {
        symbol: outSymbol,
        baseATR: threshold?.threshold || outAsset.baseATR || 2.5,
        tier: resolvedTier,
        direction: outAsset.direction || null,
      };
      const assetHistory = liveData.thresholdHistory?.[outSymbol] || { maxMultiplier: 0, minMultiplier: 0 };
      const scoreResult = calculateAssetScoreServer(assetObj, rawPctChange, assetHistory);

      lockedPoints = scoreResult.totalPoints;
      lockedGainPct = rawPctChange;
    }

    // ---- Build closed trade record ----
    const closedTrade = {
      symbolOut: outSymbol,
      symbolIn: inSymbol,
      name: outAsset.name || outSymbol,
      tier: resolvedTier,
      slotIndex: resolvedSlotIndex,
      entryPrice,
      exitPrice,
      lockedPoints: Math.round(lockedPoints * 100) / 100,
      lockedGainPct: Math.round(lockedGainPct * 1000) / 1000,
      swappedOutAt: now,
      swapDay: currentDay,
      isCrypto: outAsset.isCrypto || false,
      direction: outAsset.direction || null,
      // Evaluation metadata (enrichment fields from the cron)
      ...evaluationMetadata,
      // Phase 4: per-symbol technical snapshot at decision time (null if caller did not provide one)
      snapshot,
    };

    // ---- Build incoming asset ----
    const swapPrice = getPrice(inSymbol) || 0;
    if (swapPrice <= 0) {
      throw new Error(`Cannot complete swap: no valid price for ${inSymbol}`);
    }

    const incomingAsset = {
      symbol: inSymbol,
      name: benchAsset.name || inSymbol,
      isCrypto: benchAsset.isCrypto || false,
      baseATR: liveData.scoring?.thresholds?.[inSymbol]?.threshold || benchAsset.baseATR || (benchAsset.isCrypto ? 5.0 : 2.5),
      swapPrice,
      swappedInAt: now,
      swappedInDay: currentDay,
    };
    if (benchAsset.isCrypto && benchAsset.direction) {
      incomingAsset.direction = benchAsset.direction;
    }

    // ---- Update portfolio slot ----
    const newTier = [...(liveData.portfolio[resolvedTier] || [])];
    newTier[resolvedSlotIndex] = incomingAsset;

    // ---- Update threshold history for new asset ----
    const newThresholdHistory = { ...(liveData.thresholdHistory || {}) };
    newThresholdHistory[inSymbol] = {
      maxMultiplier: 0,
      minMultiplier: 0,
      badges: [],
    };

    // ---- Revolving door bench (Amendment 6) ----
    const outgoingForBench = {
      symbol: outAsset.symbol,
      name: outAsset.name || outAsset.symbol,
      baseATR: outAsset.baseATR,
      isCrypto: outAsset.isCrypto || false,
      direction: outAsset.direction || null,
      cooldownUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    let updatedBenchStocks;
    let updatedBenchCrypto;

    if (outAsset.isCrypto) {
      // Crypto swap: outgoing crypto goes to bench.crypto, remove incoming from bench
      updatedBenchStocks = (liveData.portfolio.bench?.stocks || []).filter(s => s.symbol !== inSymbol);
      updatedBenchCrypto = outgoingForBench;
    } else {
      // Stock swap: outgoing stock added to bench.stocks, remove incoming
      updatedBenchStocks = (liveData.portfolio.bench?.stocks || [])
        .filter(s => s.symbol !== inSymbol)
        .concat([outgoingForBench]);
      // If bench crypto was the incoming asset, clear it
      updatedBenchCrypto = liveData.portfolio.bench?.crypto?.symbol === inSymbol
        ? null
        : (liveData.portfolio.bench?.crypto || null);
    }

    // ---- Append to trades array (cap at 50) ----
    const trades = [...(liveData.trades || []), closedTrade].slice(-50);

    // ---- Build update object ----
    const updates = {
      [`portfolio.${resolvedTier}`]: newTier,
      [`portfolio.bench.stocks`]: updatedBenchStocks,
      [`portfolio.bench.crypto`]: updatedBenchCrypto,
      thresholdHistory: newThresholdHistory,
      trades,
      [`scoreState.tradeCount`]: (liveData.scoreState?.tradeCount || 0) + 1,
      updatedAt: now,
    };

    transaction.update(battleRef, updates);

    return { closedTrade, incomingAsset };
  });
}

// ==================== PORTFOLIO HELPERS ====================

/**
 * Find an asset in the tiered portfolio by symbol.
 * @returns {{ tier, slotIndex } | null}
 */
function findAssetInPortfolio(portfolio, symbol) {
  if (!portfolio || !symbol) return null;

  const tiers = ['star', 'core', 'support'];
  for (const tier of tiers) {
    const assets = portfolio[tier] || [];
    for (let i = 0; i < assets.length; i++) {
      if (assets[i]?.symbol === symbol) {
        return { tier, slotIndex: i };
      }
    }
  }
  return null;
}

/**
 * Find an asset in the bench by symbol.
 */
function findAssetInBench(bench, symbol) {
  if (!bench || !symbol) return null;

  const stockMatch = (bench.stocks || []).find(s => s?.symbol === symbol);
  if (stockMatch) return stockMatch;

  if (bench.crypto?.symbol === symbol) return bench.crypto;

  return null;
}

/**
 * Get asset at a specific portfolio position.
 */
function getAssetAt(portfolio, tier, slotIndex) {
  return portfolio?.[tier]?.[slotIndex] || null;
}
