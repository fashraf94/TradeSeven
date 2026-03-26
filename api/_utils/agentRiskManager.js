// api/_utils/agentRiskManager.js
// Risk management layer for agent mid-battle evaluation.
// Pure logic — no API calls, no Firestore, no side effects.
// Runs BEFORE the trigger gate on every cron tick.

// Bonus thresholds where LOCK applies (approaching from below)
const BONUS_THRESHOLDS = [1.0, 1.5, 2.0];
const LOCK_PROXIMITY = 0.2; // ATR multiples within which to lock

/**
 * Evaluate risk for a single active position.
 * Returns the highest-priority risk action that applies.
 *
 * Priority order:
 * 1. EMERGENCY_SWAP — bust avoidance at -0.85x ATR
 * 2. SWAP_OUT — VWAP failure (2+ consecutive ticks below VWAP)
 * 3. LOCK — within 0.2x ATR of next bonus threshold
 * 4. TRAIL_STOP — above +1.5x ATR but price fell below 5min SMA20
 * 5. HOLD — no risk action needed
 *
 * @param {Object} position - { symbol, tier, baseATR }
 * @param {number} currentPrice - Current market price
 * @param {number} entryPrice - Entry price (swapPrice or startingPrice)
 * @param {number} baseATR - ATR as percent of price
 * @param {Object|null} intradaySnapshot - { vwap, vwapDeviation, sma20_5m } or null
 * @param {Object} cronMemory - { ticksBelowVwap: number }
 * @returns {{ action: string, reason: string|null, detail: string }}
 */
export function evaluateRisk(position, currentPrice, entryPrice, baseATR, intradaySnapshot, cronMemory) {
  if (!currentPrice || !entryPrice || entryPrice <= 0 || !baseATR || baseATR <= 0) {
    return { action: 'HOLD', reason: null, detail: '' };
  }

  const priceChangePct = ((currentPrice - entryPrice) / entryPrice) * 100;
  const atrMultiplier = priceChangePct / baseATR;

  // 1. EMERGENCY_SWAP — bust avoidance at -0.85x ATR
  if (atrMultiplier <= -0.85) {
    return {
      action: 'EMERGENCY_SWAP',
      reason: 'bust_avoidance',
      detail: `${position.symbol} at ${atrMultiplier.toFixed(2)}x ATR (${priceChangePct.toFixed(2)}% from entry). Hit -0.85x bust avoidance buffer. Emergency rotation to protect score.`,
    };
  }

  // 2. SWAP_OUT — VWAP failure (2+ consecutive ticks below VWAP)
  if (intradaySnapshot && cronMemory?.ticksBelowVwap >= 2) {
    return {
      action: 'SWAP_OUT',
      reason: 'vwap_failure',
      detail: `${position.symbol} below VWAP ($${intradaySnapshot.vwap?.toFixed(2) || '?'}) for ${cronMemory.ticksBelowVwap} consecutive ticks (30+ min). Institutional support lost.`,
    };
  }

  // 3. LOCK — within 0.2x ATR of next bonus threshold
  if (atrMultiplier > 0) {
    for (const threshold of BONUS_THRESHOLDS) {
      if (atrMultiplier >= threshold - LOCK_PROXIMITY && atrMultiplier < threshold) {
        const distance = (threshold - atrMultiplier).toFixed(2);
        const bonusName = threshold === 1.0 ? 'BaggerBomb (+15pts)' : threshold === 1.5 ? 'DoubleBagger (+30pts)' : 'TenBagger (+50pts)';
        return {
          action: 'LOCK',
          reason: 'threshold_proximity',
          detail: `${position.symbol} at +${atrMultiplier.toFixed(2)}x ATR — only ${distance}x from ${bonusName}. Position locked.`,
        };
      }
    }
  }

  // 4. TRAIL_STOP — above +1.5x ATR (DoubleBagger territory) and below 5min SMA20
  if (atrMultiplier >= 1.5 && intradaySnapshot?.sma20_5m != null && currentPrice < intradaySnapshot.sma20_5m) {
    return {
      action: 'TRAIL_STOP',
      reason: 'stepped_trail',
      detail: `${position.symbol} at +${atrMultiplier.toFixed(2)}x ATR but fell below 5min SMA20 ($${intradaySnapshot.sma20_5m.toFixed(2)}). Protecting DoubleBagger gains.`,
    };
  }

  // 5. HOLD — no risk action
  return { action: 'HOLD', reason: null, detail: '' };
}

/**
 * Compute SMA20 from the last 20 five-minute candles' close prices.
 * @param {Array<{close: number}>} candles - Chronological (oldest-first) 5m candles
 * @returns {number|null} SMA20 value or null if insufficient data
 */
export function calculate5minSMA20(candles) {
  if (!candles || candles.length < 20) return null;

  // Take the last 20 candles
  const recent = candles.slice(-20);
  const sum = recent.reduce((acc, c) => acc + (c.close || 0), 0);
  return Number((sum / 20).toFixed(4));
}

/**
 * Pick the best bench replacement for an emergency/risk swap.
 * Selects the non-cooldown bench stock with the highest daily % change.
 *
 * @param {Array} benchAssets - Flattened bench array (from flattenBenchServer)
 * @param {Object} prices - { symbol: { current, changePercent, ... } }
 * @param {boolean} outgoingIsCrypto - Whether the outgoing position is crypto
 * @returns {Object|null} The bench asset to swap in, or null if none available
 */
export function pickEmergencyReplacement(benchAssets, prices, outgoingIsCrypto = false) {
  if (!benchAssets || benchAssets.length === 0) return null;

  const now = new Date();
  const candidates = benchAssets.filter(asset => {
    // Skip assets on cooldown
    if (asset.cooldownUntil && new Date(asset.cooldownUntil) > now) return false;
    // Match asset type (stock for stock, crypto for crypto)
    if (outgoingIsCrypto !== (asset.isCrypto === true)) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Sort by daily momentum (highest changePercent first)
  candidates.sort((a, b) => {
    const aChg = prices[a.symbol]?.changePercent || 0;
    const bChg = prices[b.symbol]?.changePercent || 0;
    return bChg - aChg;
  });

  return candidates[0];
}

/**
 * Find a position's tier and slot index in the portfolio.
 * Needed for executing risk-triggered swaps.
 *
 * @param {Object} portfolio - { star: [], core: [], support: [] }
 * @param {string} symbol - Symbol to find
 * @returns {{ tier: string, slotIndex: number }|null}
 */
export function findPortfolioSlot(portfolio, symbol) {
  if (!portfolio || !symbol) return null;

  for (const tier of ['star', 'core', 'support']) {
    const assets = portfolio[tier] || [];
    for (let i = 0; i < assets.length; i++) {
      if (assets[i]?.symbol === symbol) {
        return { tier, slotIndex: i };
      }
    }
  }

  return null;
}
