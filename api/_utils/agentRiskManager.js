// api/_utils/agentRiskManager.js
// Risk management layer for agent mid-battle evaluation.
// Pure logic — no API calls, no Firestore, no side effects.
// Runs BEFORE the trigger gate on every cron tick.

// Bonus thresholds where LOCK applies (approaching from below)
const BONUS_THRESHOLDS = [1.0, 1.5, 2.0];
const LOCK_PROXIMITY = 0.2; // ATR multiples within which to lock

/**
 * Evaluate risk for a single active position (archetype-aware entry point).
 *
 * Forge Enforcement Keystone V1.4 §4.1 — the archetype→physics wire.
 * Base levers (bustBuffer / vwapFailureTicks / trailStopATR) stay preset-driven
 * via `presetOverrides` and are applied by the priority chain in
 * `evaluateRiskAction`. Archetype-LOCKED HFT knobs arrive via
 * `archetypeConfig.hftConfig` (§3.3) and are consumed by later phases:
 *   - Knob A forced rotation (Phase 3, §4.2) — inserted into the priority
 *     chain after vwap_failure
 *   - Knob B hurdle floor (Phase 4, §4.3)
 * In Phase 1 the wire is established and `hftConfig` is echoed on the result so
 * the cron can pass the resolved knobs downstream and tests can assert the wire
 * is live (Gate 1). `archetypeConfig` defaults to null → `hftConfig: null`
 * (backward-compatible with the single existing caller).
 *
 * @param {Object} position - { symbol, tier, baseATR, dailyPct }
 * @param {number} currentPrice - Current market price
 * @param {number} entryPrice - Entry price (swapPrice or startingPrice)
 * @param {number} baseATR - ATR as percent of price
 * @param {Object|null} intradaySnapshot - { vwap, vwapDeviation, sma20_5m } or null
 * @param {Object} cronMemory - { ticksBelowVwap, stagnationTicks, withinAge }
 * @param {Object} [presetOverrides] - preset-driven base levers
 * @param {Object|null} [archetypeConfig] - archetype config (from getArchetypeConfig)
 * @returns {{ action: string, reason: string|null, detail: string, hftConfig: Object|null }}
 */
export function evaluateRisk(position, currentPrice, entryPrice, baseATR, intradaySnapshot, cronMemory, presetOverrides = {}, archetypeConfig = null) {
  const base = evaluateRiskAction(position, currentPrice, entryPrice, baseATR, intradaySnapshot, cronMemory, presetOverrides, archetypeConfig);
  return { ...base, hftConfig: archetypeConfig?.hftConfig || null };
}

/**
 * Preset-driven risk priority chain (internal — wrapped by evaluateRisk).
 * Returns the highest-priority risk action that applies.
 *
 * Priority order:
 * 1. EMERGENCY_SWAP — bust avoidance at -0.85x ATR
 * 2. SWAP_OUT — VWAP failure (2+ consecutive ticks below VWAP)
 * 3. LOCK — within 0.2x ATR of next bonus threshold
 * 4. TRAIL_STOP — above +1.5x ATR but price fell below 5min SMA20
 * 5. SWAP_OUT — archetype forced rotation (Knob A: stagnation; lowest-priority swap)
 * 6. HOLD — no risk action needed
 *
 * @param {Object} position - { symbol, tier, baseATR, dailyPct }
 * @param {number} currentPrice - Current market price
 * @param {number} entryPrice - Entry price (swapPrice or startingPrice)
 * @param {number} baseATR - ATR as percent of price
 * @param {Object|null} intradaySnapshot - { vwap, vwapDeviation, sma20_5m } or null
 * @param {Object} cronMemory - { ticksBelowVwap, stagnationTicks, withinAge }
 * @param {Object} [presetOverrides] - Optional preset risk overrides { bustBuffer, vwapFailureTicks, trailStopATR }
 * @returns {{ action: string, reason: string|null, detail: string }}
 */
function evaluateRiskAction(position, currentPrice, entryPrice, baseATR, intradaySnapshot, cronMemory, presetOverrides = {}, archetypeConfig = null) {
  if (!currentPrice || !entryPrice || entryPrice <= 0 || !baseATR || baseATR <= 0) {
    return { action: 'HOLD', reason: null, detail: '' };
  }

  const bustBuffer = presetOverrides.bustBuffer ?? -0.85;
  const vwapTicks = presetOverrides.vwapFailureTicks ?? 2;
  const trailATR = presetOverrides.trailStopATR ?? 1.5;

  const priceChangePct = ((currentPrice - entryPrice) / entryPrice) * 100;
  const atrMultiplier = priceChangePct / baseATR;

  // 1. EMERGENCY_SWAP — bust avoidance at preset-configured ATR buffer
  if (atrMultiplier <= bustBuffer) {
    return {
      action: 'EMERGENCY_SWAP',
      reason: 'bust_avoidance',
      detail: `${position.symbol} at ${atrMultiplier.toFixed(2)}x ATR (${priceChangePct.toFixed(2)}% from entry). Hit ${bustBuffer}x bust avoidance buffer. Emergency rotation to protect score.`,
    };
  }

  // 2. SWAP_OUT — VWAP failure (preset-configured consecutive ticks below VWAP)
  if (intradaySnapshot && cronMemory?.ticksBelowVwap >= vwapTicks) {
    return {
      action: 'SWAP_OUT',
      reason: 'vwap_failure',
      detail: `${position.symbol} below VWAP ($${intradaySnapshot.vwap?.toFixed(2) || '?'}) for ${cronMemory.ticksBelowVwap} consecutive ticks. Institutional support lost.`,
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

  // 4. TRAIL_STOP — above preset-configured ATR level and below 5min SMA20
  if (atrMultiplier >= trailATR && intradaySnapshot?.sma20_5m != null && currentPrice < intradaySnapshot.sma20_5m) {
    return {
      action: 'TRAIL_STOP',
      reason: 'stepped_trail',
      detail: `${position.symbol} at +${atrMultiplier.toFixed(2)}x ATR but fell below 5min SMA20 ($${intradaySnapshot.sma20_5m.toFixed(2)}). Protecting gains above ${trailATR}x ATR.`,
    };
  }

  // 5. SWAP_OUT — archetype forced rotation (Knob A, §4.2). Lowest-priority swap:
  // bust/vwap/LOCK/TRAIL all return first, so stagnation never overrides a
  // protective action. DETECTION ONLY — the cron execution loop selects the
  // replacement and VETOES by selecting nothing (Phase-0 D3 split). The tick-age
  // conjunct (cronMemory.withinAge) gates the FIRE on the CURRENT tick (§3.4):
  // a counter already >= threshold must NOT fire on a stale gap-recovery tick.
  // dailyPct is a FRACTION (changePercent/100) compared against winnerThreshold
  // (fraction) — winner suppression (§3.4).
  const fr = archetypeConfig?.hftConfig?.forcedRotation;
  if (fr?.enabled
      && cronMemory?.withinAge
      && (cronMemory?.stagnationTicks || 0) >= fr.ticksThreshold
      && Number.isFinite(position?.dailyPct)
      && position.dailyPct < fr.winnerThreshold) {
    return {
      action: 'SWAP_OUT',
      reason: 'stagnation',
      source: 'archetype',
      detail: `${position.symbol} stagnant ${cronMemory.stagnationTicks}+ ticks (<${(fr.pctThreshold * 100).toFixed(2)}% move/tick) at ${(position.dailyPct * 100).toFixed(2)}% on day. Archetype forced rotation.`,
    };
  }

  // 6. HOLD — no risk action
  return { action: 'HOLD', reason: null, detail: '' };
}

/**
 * Forge Enforcement Keystone V1.4 §3.4 (D2) — per-symbol stagnation counter
 * update for Knob A forced rotation. Pure: takes the prior per-symbol state plus
 * the current tick, returns the new state. Mirrors how the cron updates
 * `vwapTicks` in-loop (state mutation lives in the cron, not in evaluateRisk).
 *
 * Lifecycle (per tick, per symbol):
 *  - bad/<=0 currentPrice (or bad stored price) → no-op (don't refresh tracking with bad data)
 *  - first tick (no prior price/timestamp) → initialize tracking, count unchanged
 *  - tick age > maxTickAgeMinutes → PAUSE (count unchanged) — irregular cron gap
 *  - else: |Δprice|/price < pctThreshold → increment; otherwise reset to 0
 *  - ALWAYS refresh lastTickPrice/lastTickTimestamp (only the COUNTER is age-gated)
 *
 * `withinAge` is TRUE only when a valid, timely comparison actually happened this
 * tick (age <= max, valid price, not the first tick). It is TRANSIENT — the cron
 * threads it into evaluateRisk via cronMemory for the current tick's FIRE
 * decision (§3.4: fire requires counter >= threshold AND current tick age in
 * bound) and does NOT persist it. Without it a counter already >= threshold would
 * fire on the first stale gap-recovery tick.
 *
 * pctThreshold/pctMove are FRACTIONS (e.g. 0.001 = 0.1%); pctMove is price-derived
 * so no unit conversion is involved here (unlike winner suppression's dailyPct).
 *
 * @param {Object} p
 * @param {number} p.currentPrice
 * @param {number|null} p.lastTickPrice - prior tick price (null on first tick)
 * @param {number|null} p.lastTickTimestamp - prior tick epoch-ms (null on first tick)
 * @param {number} p.now - current epoch-ms
 * @param {number} p.pctThreshold - D2 fraction threshold
 * @param {number} p.maxTickAgeMinutes - tick-age guard
 * @param {number} [p.stagnationTicks] - prior counter (default 0)
 * @returns {{ stagnationTicks: number, lastTickPrice: number|null, lastTickTimestamp: number|null, withinAge: boolean }}
 */
export function updateStagnationCounter({ currentPrice, lastTickPrice, lastTickTimestamp, now, pctThreshold, maxTickAgeMinutes, stagnationTicks = 0 }) {
  const prevCount = stagnationTicks || 0;

  // Bad current price — don't pollute tracking with invalid data; pause all.
  if (!currentPrice || currentPrice <= 0) {
    return { stagnationTicks: prevCount, lastTickPrice, lastTickTimestamp, withinAge: false };
  }

  // First tick (or bad stored price) — initialize tracking, no comparison possible.
  if (lastTickPrice == null || lastTickTimestamp == null || lastTickPrice <= 0) {
    return { stagnationTicks: prevCount, lastTickPrice: currentPrice, lastTickTimestamp: now, withinAge: false };
  }

  const ageMinutes = (now - lastTickTimestamp) / 60000;
  let nextCount = prevCount;
  let withinAge = false;

  if (ageMinutes <= maxTickAgeMinutes) {
    withinAge = true;
    const pctMove = Math.abs(currentPrice - lastTickPrice) / lastTickPrice;
    nextCount = pctMove < pctThreshold ? prevCount + 1 : 0;
  }
  // else: gap too large → PAUSE (count unchanged, withinAge stays false)

  // Always refresh tracking (only the counter is age-gated).
  return { stagnationTicks: nextCount, lastTickPrice: currentPrice, lastTickTimestamp: now, withinAge };
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
 * Forge Enforcement Keystone V1.4 §4.2 — quality-aware replacement picker for
 * Knob A forced rotation. Unlike pickEmergencyReplacement (a single
 * top-by-momentum, quality-blind pick), this iterates candidates and returns the
 * best one that passes an INJECTED quality predicate, else null (the rotation
 * VETO). The predicate is the Phase-4 seam: Phase 3 injects a pass-through;
 * Phase 4 injects clearsHurdleFloor({reason:'stagnation'}) + bench-positive.
 *
 * @param {Object} p
 * @param {Array} p.benchAssets - flattened bench (from flattenBenchServer)
 * @param {Object} p.prices - { symbol: { current, changePercent, ... } }
 * @param {boolean} [p.outgoingIsCrypto]
 * @param {Set<string>|Array<string>} [p.heldSymbols] - active symbols to exclude
 * @param {(asset: Object) => boolean} [p.clearsQuality] - quality predicate (default: pass-through)
 * @returns {Object|null} best qualifying candidate, or null (veto)
 */
export function pickSwapReplacementCandidate({ benchAssets, prices, outgoingIsCrypto = false, heldSymbols, clearsQuality = () => true }) {
  if (!benchAssets || benchAssets.length === 0) return null;

  const held = heldSymbols instanceof Set ? heldSymbols : new Set(heldSymbols || []);
  const now = new Date();

  const candidates = benchAssets.filter(asset => {
    if (!asset || held.has(asset.symbol)) return false;
    // Skip assets on cooldown
    if (asset.cooldownUntil && new Date(asset.cooldownUntil) > now) return false;
    // Match asset type (stock for stock, crypto for crypto)
    if (outgoingIsCrypto !== (asset.isCrypto === true)) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Best daily momentum first, then return the first that clears the quality bar.
  candidates.sort((a, b) => {
    const aChg = prices[a.symbol]?.changePercent || 0;
    const bChg = prices[b.symbol]?.changePercent || 0;
    return bChg - aChg;
  });

  for (const candidate of candidates) {
    if (clearsQuality(candidate)) return candidate;
  }
  return null;
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
