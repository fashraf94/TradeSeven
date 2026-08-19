// api/_utils/agentRiskManager.js
// Risk management layer for agent mid-battle evaluation.
// Pure logic — no API calls, no Firestore, no side effects.
// Runs BEFORE the trigger gate on every cron tick.

// Bonus thresholds where LOCK applies (approaching from below)
const BONUS_THRESHOLDS = [1.0, 1.5, 2.0];
const LOCK_PROXIMITY = 0.2; // ATR multiples within which to lock

/**
 * Forge Enforcement Keystone V1.4 §3.1 (Invariant 1) — the single source of
 * truth for which swap REASONS are the EMERGENCY bypass class (Knob B hurdle
 * floor here in Phase 4; Knob C circuit breaker in Phase 5). A swap is
 * emergency-bypass IFF its `reason` is in this set; every swap outside this
 * set AND outside USER_DIRECTIVE_BYPASS_REASONS below is gated (Ask 3 R2
 * amended the total-bypass predicate to the union of the two classes — the
 * Invariant-1 matrix asserts the amended IFF in both directions). Gates
 * consult `reason`, NEVER the action label — because Knob A's forced rotation
 * reuses the `SWAP_OUT` action, action-keying would silently bypass the floor
 * for stagnation.
 *
 * Members:
 *  - bust_avoidance / vwap_failure / stepped_trail — protective risk-manager exits
 *  - guardrail_stopLoss / guardrail_trailingStop — deterministic guardrail exits
 *    (§3.1 A2: never park the agent in a stop-breaching position because the only
 *    replacement failed a quality floor). The sector-cap guardrail returns HOLD and
 *    never reaches execution, so it is intentionally absent.
 *
 * Gated (NOT here): stagnation, haiku_decision, gameplan_proposal, gameplan_meeting.
 * Adding a future emergency type must mean editing ONLY this constant.
 */
export const EMERGENCY_BYPASS_REASONS = new Set([
  'bust_avoidance',
  'vwap_failure',
  'stepped_trail',
  'guardrail_stopLoss',
  'guardrail_trailingStop',
]);

/**
 * Exit-Behavior Rebalance Tier 2, Ask 3 — ruling R2 (Fable review F2): the
 * ADDITIVE keystone extension, the sanctioned parallel to the LOCKED set
 * above ("future reasons added via additive extension only"). Taxonomy kept
 * honest: EMERGENCY = protective (something bad is happening); USER-DIRECTIVE
 * = the user's explicit deterministic order (nothing bad is happening — the
 * engine is honoring a standing instruction). Both bypass the quality knobs,
 * for different stated reasons:
 *  - Knob B (clearsHurdleFloor step 1b): the floor — INCLUDING
 *    requireBenchPositive — must never block the user's own order for a
 *    quality opinion the user didn't ask for (the A2 safety shape, gain-side).
 *  - Knob C (getRecentSwapCount): user-directive fires never count toward the
 *    model-churn window — the breaker exists to stop MODEL churn (F12; the
 *    accepted consequence: a tight target in a volatile name can fire often;
 *    it is user-authored and cooldowns still bound it).
 * Members mirror guardrail_stopLoss across the four keyed subsystems (R3);
 * adding a future user-directive reason must mean editing ONLY this constant.
 * The LOCKED emergency set above is untouched by design — never merge them.
 */
export const USER_DIRECTIVE_BYPASS_REASONS = new Set([
  'guardrail_profitTarget',
]);

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
 * @param {Object} [presetOverrides] - Optional preset risk overrides { bustBuffer, vwapFailureTicks, vwapDeadBandPct, trailStopATR }
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
  // [VWAP Floor A3] The fire itself requires THIS tick's deviation below the
  // preset dead-band, not just an aged counter — releasing pressure mid-streak
  // cancels the exit. Missing/non-numeric deviation fails closed (no fire).
  if (intradaySnapshot && cronMemory?.ticksBelowVwap >= vwapTicks
      && intradaySnapshot.vwapDeviation < -(presetOverrides.vwapDeadBandPct ?? 0.5)) {
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
 * Forge Enforcement Keystone V1.4 §4.3 — canonical bench-vs-active margin.
 * V1.4 owns this extraction outright (V1.2 never shipped it) so there is exactly
 * ONE margin formula. Pure arithmetic; UNIT-AGNOSTIC — callers MUST pass all three
 * inputs in consistent units. `clearsHurdleFloor` is the sole caller and converts
 * the active baseATR (a PERCENT) to a fraction before calling, so here every input
 * is a fraction and `marginAtrUnits` lands on the archetype floor scale (0.2–0.6).
 *
 * @param {Object} p
 * @param {number} p.activeDailyPct - outgoing position daily move (fraction)
 * @param {number} p.benchDailyPct  - incoming candidate daily move (fraction)
 * @param {string} [p.activeSymbol]
 * @param {string} [p.benchSymbol]
 * @param {number} p.atrValue       - active volatility unit (fraction, same basis)
 * @param {string} [p.source]
 * @returns {{ activeDailyPct, benchDailyPct, rawPctMargin, marginAtrUnits, atrValue, eligibleForComparison, reasonIfInvalid }}
 */
export function computeBenchVsActiveMargin({ activeDailyPct, benchDailyPct, activeSymbol, benchSymbol, atrValue, source }) {
  const eligibleForComparison = (atrValue > 0 && Number.isFinite(activeDailyPct) && Number.isFinite(benchDailyPct));
  const rawPctMargin = benchDailyPct - activeDailyPct;
  return {
    activeDailyPct,
    benchDailyPct,
    activeSymbol,
    benchSymbol,
    source,
    rawPctMargin,
    marginAtrUnits: eligibleForComparison ? rawPctMargin / atrValue : NaN,
    atrValue,
    eligibleForComparison,
    reasonIfInvalid: eligibleForComparison ? null : (atrValue > 0 ? 'non_finite_dailyPct' : 'invalid_atr'),
  };
}

/**
 * Forge Enforcement Keystone V1.4 §4.3 (Knob B) — deterministic quality gate.
 * Pure function (preserves validateTradeDecision purity); the caller decides what
 * to do with the verdict. A non-emergency swap must clear an archetype-specific
 * ATR-margin floor (and, by default, the bench candidate must be up on the day).
 *
 * Order is load-bearing (§3.1 / §4.3):
 *  1. EMERGENCY BYPASS FIRST — reason ∈ EMERGENCY_BYPASS_REASONS → clears, never
 *     gated. This is the A2 safety contract; it must precede every other check.
 *  1b. USER-DIRECTIVE BYPASS (Ask 3, R2) — reason ∈ USER_DIRECTIVE_BYPASS_REASONS
 *     → clears, never gated; precedes requireBenchPositive by construction.
 *  2. Disabled floor → clears (archetype opted out).
 *  3. Shape-B per-reason lookup: byReason[reason] || default.
 *  4. Bench-positive rule (non-emergency only — emergencies already returned).
 *  5. ATR margin vs the per-reason floor.
 *
 * LANDMINE-1 (units): `userATR` arrives as a PERCENT (baseATR, e.g. 2.5 = 2.5%),
 * while dailyPct values are FRACTIONS (changePercent/100). The ONE conversion that
 * makes marginAtrUnits comparable to the 0.2–0.6 floors is `atrValue = userATR/100`
 * — isolated to the single commented line below and locked by a unit-assertion test.
 *
 * @param {Object} p
 * @param {{ dailyPct:number, symbol?:string }} p.active        - outgoing position
 * @param {{ dailyPct:number, symbol?:string }} p.benchCandidate - incoming candidate
 * @param {string} p.reason            - swap reason (drives bypass + Shape-B lookup)
 * @param {Object} p.archetypeConfig   - from getArchetypeConfig (reads hftConfig.hurdleFloor)
 * @param {number} p.userATR           - active baseATR as PERCENT
 * @returns {{ clears:boolean, bypassed?:boolean, disabled?:boolean, blockReason?:string|null, margin?:Object, required?:number, benchDailyPct?:number, reason?:string }}
 */
export function clearsHurdleFloor({ active, benchCandidate, reason, archetypeConfig, userATR }) {
  // 1. Emergency bypass FIRST (A2 safety contract).
  if (EMERGENCY_BYPASS_REASONS.has(reason)) {
    return { clears: true, bypassed: true, reason };
  }

  // 1b. User-directive bypass (Ask 3, R2): the user's explicit deterministic
  // order clears unconditionally — before the disabled-floor check and before
  // requireBenchPositive, which must never veto the user's own instruction.
  // Distinct marker (userDirective: true) so telemetry and the Invariant-1
  // matrix can tell the two bypass classes apart.
  if (USER_DIRECTIVE_BYPASS_REASONS.has(reason)) {
    return { clears: true, bypassed: true, userDirective: true, reason };
  }

  // 2. Disabled archetype floor.
  const floorCfg = archetypeConfig?.hftConfig?.hurdleFloor;
  if (!floorCfg?.enabled) {
    return { clears: true, disabled: true };
  }

  // 3. Per-reason floor (Shape-B) with default fallback for unenumerated reasons.
  const reasonCfg = floorCfg.byReason?.[reason] || floorCfg.default;
  const requiredMargin = reasonCfg.atrMultiplier;

  // 4. Non-emergency bench-positive rule (emergencies already returned at step 1).
  if (floorCfg.requireBenchPositive && benchCandidate.dailyPct <= 0) {
    return { clears: false, blockReason: 'bench_not_positive', benchDailyPct: benchCandidate.dailyPct };
  }

  // 5. ATR margin. LANDMINE-1: convert active baseATR (PERCENT) → fraction so the
  // margin lands on the same 0.2–0.6 scale as the floors.
  const atrValue = userATR / 100;
  const margin = computeBenchVsActiveMargin({
    activeDailyPct: active.dailyPct,
    benchDailyPct: benchCandidate.dailyPct,
    activeSymbol: active.symbol,
    benchSymbol: benchCandidate.symbol,
    atrValue,
    source: reason,
  });
  if (!margin.eligibleForComparison) {
    return { clears: false, blockReason: 'margin_invalid', detail: margin.reasonIfInvalid, margin };
  }
  const clears = margin.marginAtrUnits >= requiredMargin;
  return { clears, blockReason: clears ? null : 'below_floor', margin, required: requiredMargin };
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

/**
 * Forge Enforcement Keystone V1.4 §4.4 (Knob C) — rolling-window swap counter for
 * the circuit breaker. Pure: counts swaps in `trades[]` whose `swappedOutAt` falls
 * within the last `windowMinutes`, EXCLUDING emergency-reason swaps unless
 * `countEmergencies` is true. The cron compares the result against
 * `swapWindow.capPerWindow` to throttle discretionary/forced churn.
 *
 * Trap 1 (D4): the swap reason lands TOP-LEVEL as `t.exitReason` (via the
 * ...evaluationMetadata spread in executeSwapServer), NOT `t.evaluationMetadata
 * .reason`. Filtering the wrong field would leave every reason undefined →
 * EMERGENCY_BYPASS_REASONS.has(undefined) always false → emergencies counted.
 *
 * Edge handling:
 *  - `swappedOutAt` is an ISO string → Date.parse + isNaN-guard (legacy/missing → skip).
 *  - dedupe by `t.id` so a record can never be double-counted.
 *  - legacy trade missing `exitReason` → undefined → NOT an emergency → COUNTED
 *    (the conservative side: a swap of unknown origin tightens, never loosens, the cap).
 *  - non-array trades / windowMinutes<=0 / unparseable `now` → 0 (defensive no-op).
 *
 * @param {Array} trades - battle.trades[] (live, post-write within the tick)
 * @param {number} windowMinutes - rolling window size
 * @param {number|string} now - epoch ms or ISO string anchoring the window end
 * @param {Object} [opts]
 * @param {boolean} [opts.countEmergencies=false] - include emergency-reason swaps
 * @returns {number} count of in-window swaps subject to the cap
 */
export function getRecentSwapCount(trades, windowMinutes, now, { countEmergencies = false } = {}) {
  if (!Array.isArray(trades) || !(windowMinutes > 0)) return 0;
  const nowMs = typeof now === 'number' ? now : Date.parse(now);
  if (Number.isNaN(nowMs)) return 0;

  const cutoff = nowMs - windowMinutes * 60000;
  const seen = new Set();
  let count = 0;

  for (const t of trades) {
    if (!t) continue;
    const ts = Date.parse(t.swappedOutAt);            // ISO string → ms
    if (Number.isNaN(ts)) continue;                   // legacy/missing timestamp → not windowable
    if (ts < cutoff || ts > nowMs) continue;          // outside the window (future-guard too)
    if (t.id != null) {                               // dedupe by trade id
      if (seen.has(t.id)) continue;
      seen.add(t.id);
    }
    // exitReason is top-level (Trap 1). Missing → undefined → not an emergency → counted.
    if (!countEmergencies && EMERGENCY_BYPASS_REASONS.has(t.exitReason)) continue;
    // User-directive fires are NEVER windowable churn (Ask 3, R2/F12) — the
    // breaker exists to stop MODEL churn, and a user's standing order is not
    // model churn. Unconditional (not tied to countEmergencies: that knob is
    // about emergencies, and overloading it would hide user-directive volume
    // behind an unrelated config).
    if (USER_DIRECTIVE_BYPASS_REASONS.has(t.exitReason)) continue;
    count++;
  }

  return count;
}

/**
 * Forge Enforcement Keystone V1.4 §4.6 — swap RECEIPT source discriminator.
 * Pure: builds the 3 origin-metadata fields that ride onto battle.trades[] via the
 * ...evaluationMetadata spread in executeSwapServer (the same mechanism exitReason
 * uses). Additive only — NO behavioral effect; this is provenance for training-data
 * pipelines and the Voice Layer.
 *
 * `source` (WHICH system decided) is orthogonal to `exitReason` (WHY): e.g. a
 * guardrail-forced exit is source:'guardrail' / exitReason:'guardrail_stopLoss';
 * a discretionary swap is source:'haiku' / exitReason:'haiku_decision'. The vocab
 * mirrors the statusFeed `source` values (haiku / archetype / risk_manager /
 * guardrail / gameplan_meeting) — no third 'haiku_decision' source variant.
 *
 * `archetype` is recorded ONLY for archetype-authored swaps (Knob A forced
 * rotation, source:'archetype'); null otherwise. Coerced to null (never undefined)
 * because Firestore rejects undefined. `hftKnobsSource` is constant 'archetype' at
 * launch — the HFT knobs are archetype-locked; Path-1 'user_rule' authority is
 * post-launch.
 *
 * @param {Object} p
 * @param {string} p.source - origin system (statusFeed source vocabulary)
 * @param {string} [p.archetype] - ctx.archetype (recorded only when source==='archetype')
 * @returns {{ source: string, archetype: string|null, hftKnobsSource: 'archetype' }}
 */
export function buildSwapReceiptSource({ source, archetype }) {
  return {
    source,
    archetype: source === 'archetype' ? (archetype || null) : null,
    hftKnobsSource: 'archetype',
  };
}
