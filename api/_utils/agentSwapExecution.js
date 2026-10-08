// api/_utils/agentSwapExecution.js
// Server-side swap validation and execution for agent battles.
// Uses Firebase Admin SDK (not client SDK).
// Writes to agentBattles collection (not battles).

import {
  calculateAssetScoreServer,
  flattenPortfolioServer,
  flattenBenchServer,
} from './agentScoring.js';
import { resolveThresholdBaseline } from './baselineValidation.js';
import { getStockAnalysisData } from './marketDataCache.js';
import { getETDate, formatDateString } from './marketSchedule.js';
// P4 mode config (founder ruling D1) — Node-clean src import under the revised
// June 2026 import rule (BUILD_RULES §4); the co-located test's import of this
// module is the dependency-surface guard.
import { resolveModeConfig } from '../../src/constants/agentGameModes.js';
// P6 swap identity check (pilot spec §7) — the same Node-clean src import rule;
// the same co-located guard.
import { SWAP_IDENTITY_MODE, SWAP_IDENTITY_MODES } from '../../src/config/featureFlags.js';

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

    // 2b. [VWAP Floor B5] Identity/duplicate mirror of the executeSwapServer
    // transaction invariants — pre-flags bad Haiku decisions before execution.
    if (decision.symbolIn === decision.symbolOut) {
      errors.push(`symbolIn "${decision.symbolIn}" cannot replace itself`);
    } else if (findAssetInPortfolio(battle.portfolio, decision.symbolIn)) {
      errors.push(`symbolIn "${decision.symbolIn}" already occupies an active portfolio slot`);
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

// ==================== P6 — THE SWAP IDENTITY CHECK (G01) ====================

/** The typed refusals the executor raises at SWAP_IDENTITY_MODE 'enforce' (spec §7; founder decisions D2, D3). */
export const SWAP_REFUSAL_REASONS = Object.freeze(['outgoing_identity_mismatch', 'battle_not_active']);

/**
 * A swap the executor refused at 'enforce' — nothing was written. The message
 * stays readable for the callers' existing `err.message` catches; `reason` and
 * `verification` carry the typed outcome.
 */
export class SwapRefusalError extends Error {
  constructor(reason, verification, message) {
    super(message);
    this.name = 'SwapRefusalError';
    this.reason = reason;
    this.verification = verification;
  }
}

/** The flag's value, or 'off' when it cannot be read (a hermetic test mock that omits it). Never throws. */
function flagSwapIdentityMode() {
  try {
    return SWAP_IDENTITY_MODE;
  } catch {
    return 'off';
  }
}

/** The mode `value` names, or 'off' for anything that is not one of the walked states. Never throws. */
export function resolveSwapIdentityMode(value) {
  try {
    return SWAP_IDENTITY_MODES.includes(value) ? value : 'off';
  } catch {
    return 'off';
  }
}

/**
 * The verification evidence (Phase 0 §7.1), built from the transaction's own
 * read. `expected` is the caller's belief about the outgoing position, `found`
 * the slot's occupant at this attempt. The id derives from inputs only, so a
 * transaction retry re-derives the same one.
 */
function buildVerification({ battleId, evaluationMetadata, mode, expectedOut, outAsset, liveData, resolvedTier, resolvedSlotIndex, checkedAt }) {
  const found = { symbol: outAsset?.symbol ?? null, swappedInAt: outAsset?.swappedInAt ?? null };
  let expected = null;
  let basis = null;
  let verdict = 'not_checked';
  if (expectedOut) {
    expected = { symbol: expectedOut.symbol ?? null, swappedInAt: expectedOut.swappedInAt ?? null };
    // A stored belief without the entry instant (a legacy proposal, a client-
    // written record) can only be checked by symbol, and says so.
    basis = expectedOut.swappedInAt !== undefined ? 'symbol_and_entry' : 'symbol_only';
    const sameSymbol = expected.symbol !== null && expected.symbol === found.symbol;
    const sameEntry = basis === 'symbol_only' || expected.swappedInAt === found.swappedInAt;
    verdict = sameSymbol && sameEntry ? 'match' : 'mismatch';
  }
  // A caller without an evaluation identity (a client-written proposal) gets
  // no id rather than one every such call on the battle would share.
  const evaluationId = evaluationMetadata?.evaluationId;
  return {
    verificationId: typeof evaluationId === 'string' && evaluationId ? `${battleId}:${evaluationId}:verify` : null,
    mode,
    expected,
    found,
    verdict,
    basis,
    battleStatus: liveData.status ?? null,
    slot: { tier: resolvedTier ?? null, slotIndex: resolvedSlotIndex ?? null }, // never undefined (Firestore)
    tradeSeq: liveData.scoreState?.tradeCount || 0,
    checkedAt,
  };
}

/** The refusal `verification` calls for at 'enforce', or null. An ended battle outranks a moved slot. */
function refusalOf(verification) {
  if (verification.battleStatus !== 'active') {
    return {
      reason: 'battle_not_active',
      message: `Swap refused (battle_not_active): the battle's status is ${verification.battleStatus ?? 'missing'}`,
    };
  }
  if (verification.verdict === 'mismatch') {
    const { expected, found, slot } = verification;
    return {
      reason: 'outgoing_identity_mismatch',
      message: `Swap refused (outgoing_identity_mismatch): expected ${expected.symbol} in ${slot.tier}[${slot.slotIndex}], found ${found.symbol ?? 'an empty slot'}`,
    };
  }
  return null;
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
 * @param {Object} [opts] - P6 (pilot spec §7). Omitted while the flag is 'off', every default reproduces the
 *   pre-P6 behaviour exactly; with the flag on, an omitted belief is recorded 'not_checked'.
 * @param {() => Date} [opts.now] - the clock; read once before the transaction and once per transaction attempt.
 * @param {Function} [opts.fetchDailyReference] - the Guard 3 daily-reference fetch (getStockAnalysisData's signature).
 * @param {{symbol: string, swappedInAt?: string|null}|null} [opts.expectedOut] - the caller's belief about the
 *   outgoing position. `swappedInAt` present (null for a creation-time position) → checked by symbol AND entry
 *   instant; absent → by symbol only. Null → 'not_checked'.
 * @param {string} [opts.identityMode] - 'off' | 'shadow' | 'enforce' (anything else → 'off'). 'off' computes
 *   nothing; 'shadow' records `verification` on the trade row; 'enforce' also refuses a moved slot or an
 *   inactive battle with a SwapRefusalError and writes nothing.
 * @returns {Object} { closedTrade, incomingAsset }
 */
export async function executeSwapServer(db, battleId, battle, resolvedTier, resolvedSlotIndex, benchAsset, currentDay, currentPrices, evaluationMetadata = {}, snapshot = null, opts = {}) {
  const {
    now: clock = () => new Date(),
    fetchDailyReference = getStockAnalysisData,
    expectedOut = null,
    identityMode = flagSwapIdentityMode(), // SWAP_IDENTITY_MODE
  } = opts;
  const mode = resolveSwapIdentityMode(identityMode);
  const battleRef = db.collection('agentBattles').doc(battleId);

  // ---- Guard 3 (parity with the live-eval badge baseline) ----
  // Compute the activation-day gate (same calendar rule as the crons) and, ONLY
  // when the outgoing asset's badge baseline will fall through to previousClose
  // (held-from-start position on day 2+, or a day-1 asset whose startingPrice is
  // missing), pre-fetch its daily series as the Guard 2 reference. swapPrice and
  // validated day-1 startingPrice need no reference, so those paths fetch nothing.
  // Fetched here — before the transaction — so no network I/O runs inside it.
  // P6 §8: one clock reading for every pre-transaction date.
  const startedAt = clock();
  const todayET = formatDateString(getETDate(startedAt));
  const activationDateET = battle?.activatedAt
    ? formatDateString(getETDate(new Date(battle.activatedAt)))
    : todayET;
  const isActivationDay = todayET === activationDateET;
  const utcToday = startedAt.toISOString().slice(0, 10);

  const preOut = battle?.portfolio?.[resolvedTier]?.[resolvedSlotIndex];
  const preStartingPrice = battle?.portfolio?.startingPrices?.[preOut?.symbol];
  const guard3NeedsRef = !!preOut?.symbol
    && !(preOut.swapPrice > 0)
    && !(isActivationDay && preStartingPrice > 0);
  let guard3Symbol = null;
  let guard3Daily = null;
  if (guard3NeedsRef) {
    guard3Symbol = preOut.symbol;
    try {
      const refData = await fetchDailyReference(preOut.symbol, { forceRefresh: true, fields: ['daily', 'price'] });
      if (Array.isArray(refData?.daily)) guard3Daily = refData.daily;
    } catch (err) {
      // No reference → Guard 2 accepts previousClose unchanged (err toward not intervening).
      console.warn(`[guard3] daily reference fetch failed for ${preOut.symbol}: ${err.message}`);
    }
  }

  return await db.runTransaction(async (transaction) => {
    const battleSnap = await transaction.get(battleRef);
    if (!battleSnap.exists) {
      throw new Error('Agent battle not found');
    }

    const liveData = battleSnap.data();
    const outAsset = liveData.portfolio[resolvedTier]?.[resolvedSlotIndex];
    // P6 §8: one clock reading per attempt — the stamps, the beacon's age and
    // the bench cooldown all derive from it; a retry reads it afresh.
    const attemptAt = clock();

    // ---- P6: the swap identity check (G01, pilot spec §7) ----
    // From THIS attempt's read: the occupant against the caller's belief, and
    // the battle's status. Computed before every other refusal, so a stale
    // belief is named as such even where the older checks below would also
    // throw (a slot that now holds the incoming symbol reads as a self-swap).
    // 'off' computes nothing.
    let verification = null;
    if (mode !== 'off') {
      verification = buildVerification({
        battleId, evaluationMetadata, mode, expectedOut, outAsset, liveData,
        resolvedTier, resolvedSlotIndex, checkedAt: attemptAt.toISOString(),
      });
      const refusal = mode === 'enforce' ? refusalOf(verification) : null;
      if (refusal) throw new SwapRefusalError(refusal.reason, verification, refusal.message);
    }

    if (!outAsset) {
      throw new Error('Asset no longer available in slot');
    }

    const now = attemptAt.toISOString();
    const outSymbol = outAsset.symbol;
    const inSymbol = benchAsset.symbol;

    // [VWAP Floor B5] Identity/duplicate invariants, enforced at the
    // transaction so all call sites inherit them (June 11: LRCX→LRCX
    // self-swap, PANW occupying three slots).
    if (inSymbol === outSymbol) {
      throw new Error(`Invalid swap: ${inSymbol} cannot replace itself`);
    }
    const duplicateSlot = findAssetInPortfolio(liveData.portfolio, inSymbol);
    if (duplicateSlot) {
      throw new Error(`Invalid swap: ${inSymbol} already occupies an active ${duplicateSlot.tier} slot`);
    }

    // Prefer live beacon prices over REST-fetched (15-min delayed) prices
    const beacon = liveData.livePriceBeacon;
    const beaconFresh = beacon?.updatedAt &&
      (attemptAt.getTime() - new Date(beacon.updatedAt).getTime()) < 120000; // < 2 min

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

    // C-2 fix: resolved BEFORE the outgoing-score rebuild (it previously lived
    // just above the incoming-asset stamp) — both stamp sites read one resolve.
    const swapModeConfig = resolveModeConfig(liveData.gameMode);

    if (entryPrice > 0) {
      const threshold = liveData.scoring?.thresholds?.[outSymbol];
      const baseATR = threshold?.threshold || outAsset.baseATR || 2.5;
      const assetObj = {
        symbol: outSymbol,
        baseATR,
        tier: resolvedTier,
        direction: outAsset.direction || null,
        // C-2 fix (flat6 stamp pass-through, founder ruling option a): this
        // rebuild dropped the D2 flat stamp, so flat6 swap LOCKS applied
        // slot-label multipliers. Same mode-resolved authority as the
        // incoming-swap stamp below; tiered resolves null and gains no field.
        ...(swapModeConfig.flatMultiplier != null ? { tierMultiplier: swapModeConfig.flatMultiplier } : {}),
      };

      // Guard 3: badge baseline parity with agent-evaluate. Same precedence
      // (swapPrice -> day-1 startingPrice -> Guard-2-validated previousClose),
      // then pass thresholdPriceChange so swap-lock badges match the live eval
      // for the same asset/day/baseline. The pre-fetched daily reference is used
      // only when the slot symbol is unchanged.
      const isCryptoAsset = outAsset.isCrypto === true || /\.CC$/i.test(outSymbol || '');
      const prevClose = currentPrices[outSymbol]?.previousClose;
      const { baseline: thresholdBaseline, guard2 } = resolveThresholdBaseline({
        swapPrice: outAsset.swapPrice,
        isActivationDay,
        startingPrice: liveData.portfolio?.startingPrices?.[outSymbol],
        previousClose: prevClose,
        daily: guard3Symbol === outSymbol ? guard3Daily : null,
        isCrypto: isCryptoAsset,
        baseATR,
        etToday: todayET,
        utcToday,
      });
      if (guard2?.fired) {
        console.warn(`[guard3]${guard2.corporateActionSuspected ? '[corp-action?]' : ''} ${outSymbol} previousClose=${prevClose} (${guard2.reason}); ${guard2.value === prevClose ? 'accepted+flagged' : `substituted ${guard2.value}`}`);
      }

      // Non-negated, like the live eval — the scorer negates internally for
      // shorts (assetObj.direction), avoiding the prior double-negation.
      const rawPctChange = ((exitPrice - entryPrice) / entryPrice) * 100;
      const thresholdPriceChange = (thresholdBaseline && thresholdBaseline > 0)
        ? ((exitPrice - thresholdBaseline) / thresholdBaseline) * 100
        : null;

      const assetHistory = liveData.thresholdHistory?.[outSymbol] || { maxMultiplier: 0, minMultiplier: 0 };
      const scoreResult = calculateAssetScoreServer(assetObj, rawPctChange, assetHistory, {}, thresholdPriceChange);

      lockedPoints = scoreResult.totalPoints;
      lockedGainPct = scoreResult.priceChange;
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
      // P6: the identity verification, on the row it verified (absent at 'off').
      ...(verification ? { verification } : {}),
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
    // P4 flat6 (founder ruling D2): swap-ins on tournament battles carry the
    // mode's flat multiplier, like every creation-time asset. Tiered battles
    // resolve a null flatMultiplier and gain no field — byte-identical.
    // (swapModeConfig resolved once, above the outgoing-score rebuild — C-2.)
    if (swapModeConfig.flatMultiplier != null) {
      incomingAsset.tierMultiplier = swapModeConfig.flatMultiplier;
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
      cooldownUntil: new Date(attemptAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };

    let updatedBenchStocks;
    let updatedBenchCrypto;

    if (outAsset.isCrypto) {
      // Crypto swap: outgoing crypto goes to bench.crypto, remove incoming from bench
      updatedBenchStocks = (liveData.portfolio.bench?.stocks || []).filter(s => s.symbol !== inSymbol);
      updatedBenchCrypto = outgoingForBench;
    } else {
      // Stock swap: outgoing stock returns to bench.stocks, remove incoming.
      // [VWAP Floor B4] Replace-or-append: if the outgoing symbol already has
      // a bench entry (revolving-door round trip), replace it in place —
      // refreshing cooldownUntil — instead of appending a duplicate (June 11:
      // bench grew 3→11 with a duplicate LRCX). WATCH ITEM: the bench can
      // still grow via synthetic-sourced swap-ins; accepted at launch, the
      // cascade guard bounds the rate.
      const benchWithoutIn = (liveData.portfolio.bench?.stocks || [])
        .filter(s => s.symbol !== inSymbol);
      const existingIdx = benchWithoutIn.findIndex(s => s.symbol === outSymbol);
      if (existingIdx >= 0) {
        benchWithoutIn[existingIdx] = outgoingForBench;
        updatedBenchStocks = benchWithoutIn;
      } else {
        updatedBenchStocks = benchWithoutIn.concat([outgoingForBench]);
      }
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
