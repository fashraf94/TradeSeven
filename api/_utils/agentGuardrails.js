// api/_utils/agentGuardrails.js
// Phase 4B: Hybrid Execution Guardrails.
//
// Deterministic post-Haiku enforcement layer. Reads
// `agent.deployedStrategy.guardrails` (snapshotted into battle.agentContext)
// and overrides Haiku's decision when hard quantitative thresholds are
// breached. Soft guardrails (profitTarget) are surfaced as notes only.
//
// Enforcement semantics:
//   - stopLoss         (hard) → force SWAP on any held position at or below -value%
//   - trailingStop     (hard) → force SWAP on any held position at or below
//                               -value% from its implied peak (via thresholdHistory)
//   - maxSectorWeight  (hard) → block SWAP that would push a sector above value%
//   - maxPosition      (hard) → logged as incompatible in BaggerBomb (fixed slots)
//   - profitTarget     (soft) → surfaced as note, no override
//
// The function is pure — no Firestore I/O, no mutation of inputs. All errors
// are caught per-check so a single bad guardrail never crashes the pipeline.

import { pickEmergencyReplacement } from './agentRiskManager.js';
import { flattenBenchServer } from './agentScoring.js';

/**
 * @typedef {Object} GuardrailOverride
 * @property {string} type            - Guardrail type that fired.
 * @property {string} symbol          - Symbol involved (or '' for portfolio-wide).
 * @property {string} metric          - Human-readable metric name.
 * @property {number} threshold       - Configured guardrail threshold.
 * @property {number} actual          - Observed value.
 * @property {string} action          - 'forced_exit' | 'blocked_swap' | 'note' |
 *                                      'skipped_incompatible' | 'blocked_by_lock' |
 *                                      'reinforced_haiku' | 'forced_exit_no_bench' |
 *                                      'pending_next_tick'
 * @property {string} originalDecision
 * @property {string|null} [replacementSymbol]
 * @property {string} [note]
 */

/**
 * Apply deterministic guardrails on top of Haiku's proposed decision.
 *
 * @param {Object}   args
 * @param {Object|null} args.haikuResult
 * @param {Array}    args.guardrails        - From battle.agentContext.deployedGuardrails.
 * @param {Object}   args.battle            - Full battle doc.
 * @param {Object}   args.prices            - { symbol: { current, changePercent } }.
 * @param {Set<string>} [args.lockedPositions]  - Symbols protected by risk LOCK.
 * @param {Object}   [args.stockRegimes]    - { symbol: regime } (for distressed check).
 * @returns {{
 *   decision: 'HOLD' | 'SWAP',
 *   symbolOut: string|null,
 *   symbolIn: string|null,
 *   overrides: GuardrailOverride[],
 *   statusMessage: string|null,
 *   sourceNote: string|null,
 * }}
 */
export function applyGuardrails({
  haikuResult,
  guardrails,
  battle,
  prices,
  lockedPositions,
  stockRegimes,
}) {
  const originalDecision = haikuResult?.decision || 'HOLD';
  const passthrough = {
    decision: originalDecision,
    symbolOut: haikuResult?.symbolOut || null,
    symbolIn: haikuResult?.symbolIn || null,
    overrides: [],
    statusMessage: null,
    sourceNote: null,
  };

  // No-op path: no guardrails configured.
  if (!Array.isArray(guardrails) || guardrails.length === 0) {
    return passthrough;
  }
  if (!battle || !battle.portfolio) {
    return passthrough;
  }

  const overrides = [];
  const held = collectHeldPositions(battle);
  const locked = lockedPositions || new Set();

  // Index guardrails by type for quick lookup.
  const byType = {};
  for (const g of guardrails) {
    if (g && typeof g.type === 'string') byType[g.type] = g;
  }

  // ---- 1) Stop-loss (hard): scan held positions for P&L breach ----
  const stopLoss = byType.stopLoss;
  let stopLossBreach = null;
  if (stopLoss && typeof stopLoss.value === 'number') {
    try {
      stopLossBreach = pickWorstBreach(
        held,
        prices,
        battle,
        pos => {
          const pnl = computePnLPct(pos, prices, battle);
          if (pnl === null) return null;
          return pnl <= -Math.abs(stopLoss.value) ? pnl : null;
        },
        -Math.abs(stopLoss.value),
      );
      // Log secondary breaches for training data.
      for (const pos of held) {
        const pnl = computePnLPct(pos, prices, battle);
        if (pnl === null) continue;
        if (pnl <= -Math.abs(stopLoss.value) && pos.symbol !== stopLossBreach?.symbol) {
          overrides.push({
            type: 'stopLoss',
            symbol: pos.symbol,
            metric: 'pnlPct',
            threshold: -Math.abs(stopLoss.value),
            actual: round2(pnl),
            action: 'pending_next_tick',
            originalDecision,
          });
        }
      }
    } catch (err) {
      // Never crash the pipeline on guardrail eval error.
      console.warn('[Guardrails] stopLoss check failed:', err?.message);
    }
  }

  // ---- 2) Trailing stop (hard): drawdown from implied peak ----
  const trailingStop = byType.trailingStop;
  let trailingBreach = null;
  if (trailingStop && typeof trailingStop.value === 'number' && !stopLossBreach) {
    // Only run trailing stop if stop-loss didn't already pick a breach — keeps
    // single-swap-per-eval invariant and prefers the more urgent signal.
    try {
      trailingBreach = pickWorstBreach(
        held,
        prices,
        battle,
        pos => {
          const drawdown = computeTrailingDrawdownPct(pos, prices, battle);
          if (drawdown === null) return null;
          return drawdown <= -Math.abs(trailingStop.value) ? drawdown : null;
        },
        -Math.abs(trailingStop.value),
      );
    } catch (err) {
      console.warn('[Guardrails] trailingStop check failed:', err?.message);
    }
  }

  const forcedBreach = stopLossBreach || trailingBreach;
  const forcedType = stopLossBreach ? 'stopLoss' : trailingBreach ? 'trailingStop' : null;

  // ---- 3) Max sector weight (hard): pre-execution check on proposed SWAP ----
  const maxSector = byType.maxSectorWeight;
  let sectorBlock = null;
  if (
    maxSector &&
    typeof maxSector.value === 'number' &&
    !forcedBreach &&
    originalDecision === 'SWAP' &&
    haikuResult?.symbolOut &&
    haikuResult?.symbolIn
  ) {
    try {
      sectorBlock = checkSectorCap({
        haikuResult,
        battle,
        maxSectorValue: maxSector.value,
      });
    } catch (err) {
      console.warn('[Guardrails] maxSectorWeight check failed:', err?.message);
    }
  }

  // ---- 4) Max position size (hard): architecturally N/A for BaggerBomb ----
  if (byType.maxPosition && typeof byType.maxPosition.value === 'number') {
    overrides.push({
      type: 'maxPosition',
      symbol: '',
      metric: 'n/a',
      threshold: byType.maxPosition.value,
      actual: 0,
      action: 'skipped_incompatible',
      originalDecision,
      note: 'BaggerBomb portfolio uses fixed tier slots; position-% cap is architecturally n/a.',
    });
  }

  // ---- 5) Profit target (soft): informational only ----
  const profitTarget = byType.profitTarget;
  if (profitTarget && typeof profitTarget.value === 'number') {
    try {
      for (const pos of held) {
        const pnl = computePnLPct(pos, prices, battle);
        if (pnl === null) continue;
        if (pnl >= Math.abs(profitTarget.value)) {
          overrides.push({
            type: 'profitTarget',
            symbol: pos.symbol,
            metric: 'pnlPct',
            threshold: profitTarget.value,
            actual: round2(pnl),
            action: 'note',
            originalDecision,
            note: 'Soft guardrail: profit target reached — Haiku advised, no override.',
          });
        }
      }
    } catch (err) {
      console.warn('[Guardrails] profitTarget note failed:', err?.message);
    }
  }

  // ---- Compose result ----
  if (forcedBreach) {
    // Respect existing LOCK semantics — never force exit a locked position.
    if (locked.has(forcedBreach.symbol)) {
      overrides.push({
        type: forcedType,
        symbol: forcedBreach.symbol,
        metric: forcedBreach.metric,
        threshold: forcedBreach.threshold,
        actual: round2(forcedBreach.actual),
        action: 'blocked_by_lock',
        originalDecision,
        note: 'Position is LOCKED near bonus threshold; guardrail deferred.',
      });
      return { ...passthrough, overrides };
    }

    // If Haiku already proposed exiting this symbol, reinforce — don't double-swap.
    if (originalDecision === 'SWAP' && haikuResult?.symbolOut === forcedBreach.symbol) {
      overrides.push({
        type: forcedType,
        symbol: forcedBreach.symbol,
        metric: forcedBreach.metric,
        threshold: forcedBreach.threshold,
        actual: round2(forcedBreach.actual),
        action: 'reinforced_haiku',
        originalDecision,
        replacementSymbol: haikuResult.symbolIn || null,
        note: 'Guardrail aligned with Haiku — no override applied.',
      });
      return {
        decision: 'SWAP',
        symbolOut: haikuResult.symbolOut,
        symbolIn: haikuResult.symbolIn,
        overrides,
        statusMessage: null,
        sourceNote: null,
      };
    }

    // Pick a replacement from bench.
    const benchAssets = flattenBenchServer(battle.portfolio?.bench);
    const replacement = pickEmergencyReplacement(
      benchAssets,
      prices,
      forcedBreach.isCrypto === true,
    );

    if (!replacement) {
      overrides.push({
        type: forcedType,
        symbol: forcedBreach.symbol,
        metric: forcedBreach.metric,
        threshold: forcedBreach.threshold,
        actual: round2(forcedBreach.actual),
        action: 'forced_exit_no_bench',
        originalDecision,
        note: 'No eligible bench asset; forced exit deferred to next tick.',
      });
      // Keep the original decision (HOLD default or Haiku's SWAP) — we can't
      // execute without a replacement. Logging captures the intent.
      return { ...passthrough, overrides };
    }

    // Guard against distressed replacement (mirrors existing validation at
    // cron line 792). We don't block here — downstream will downgrade cleanly
    // and the override log captures the attempt.
    const replacementRegime = stockRegimes?.[replacement.symbol] || null;

    const thresholdLabel =
      forcedType === 'stopLoss'
        ? `stop-loss at ${Math.abs(forcedBreach.threshold)}%`
        : `trailing stop at ${Math.abs(forcedBreach.threshold)}% from peak`;

    overrides.push({
      type: forcedType,
      symbol: forcedBreach.symbol,
      metric: forcedBreach.metric,
      threshold: forcedBreach.threshold,
      actual: round2(forcedBreach.actual),
      action: 'forced_exit',
      originalDecision,
      replacementSymbol: replacement.symbol,
      note: replacementRegime === 'distressed'
        ? 'Replacement is distressed regime — downstream may downgrade.'
        : undefined,
    });

    return {
      decision: 'SWAP',
      symbolOut: forcedBreach.symbol,
      symbolIn: replacement.symbol,
      overrides,
      statusMessage: `Guardrail override: ${thresholdLabel} breached on ${forcedBreach.symbol} (${round2(forcedBreach.actual)}%). Forcing exit → ${replacement.symbol}.`,
      sourceNote: `guardrail_${forcedType}`,
    };
  }

  if (sectorBlock) {
    overrides.push(sectorBlock);
    return {
      decision: 'HOLD',
      symbolOut: null,
      symbolIn: null,
      overrides,
      statusMessage: sectorBlock.note || null,
      sourceNote: 'guardrail_max_sector_weight',
    };
  }

  // No hard overrides — return original decision with any soft notes attached.
  return { ...passthrough, overrides };
}

// ==================== INTERNAL HELPERS ====================

function collectHeldPositions(battle) {
  const out = [];
  const p = battle?.portfolio || {};
  for (const tier of ['star', 'core', 'support']) {
    const arr = p[tier] || [];
    for (let i = 0; i < arr.length; i++) {
      const asset = arr[i];
      if (asset && asset.symbol) {
        out.push({ ...asset, tier, slotIndex: i });
      }
    }
  }
  return out;
}

function getEntryPrice(position, battle) {
  if (typeof position.swapPrice === 'number' && position.swapPrice > 0) {
    return position.swapPrice;
  }
  const starting = battle?.portfolio?.startingPrices || {};
  const sp = starting[position.symbol];
  return typeof sp === 'number' && sp > 0 ? sp : null;
}

function getCurrentPrice(position, prices) {
  const cur = prices?.[position.symbol]?.current;
  return typeof cur === 'number' && cur > 0 ? cur : null;
}

function computePnLPct(position, prices, battle) {
  const entry = getEntryPrice(position, battle);
  const current = getCurrentPrice(position, prices);
  if (!entry || !current) return null;
  return ((current - entry) / entry) * 100;
}

/**
 * Trailing stop uses thresholdHistory.maxMultiplier (peak ATR multiplier
 * observed during the battle) to derive an implied peak price. Activates only
 * once a position has actually been in profit (peakMultiplier > 0).
 */
function computeTrailingDrawdownPct(position, prices, battle) {
  const entry = getEntryPrice(position, battle);
  const current = getCurrentPrice(position, prices);
  if (!entry || !current) return null;

  const hist = battle?.thresholdHistory?.[position.symbol];
  const peakMultiplier = typeof hist?.maxMultiplier === 'number' ? hist.maxMultiplier : 0;
  const baseATR = typeof position.baseATR === 'number' ? position.baseATR : 0;
  if (peakMultiplier <= 0 || baseATR <= 0) return null;

  const impliedPeakPrice = entry * (1 + (peakMultiplier * baseATR) / 100);
  if (impliedPeakPrice <= entry) return null;

  return ((current - impliedPeakPrice) / impliedPeakPrice) * 100;
}

function pickWorstBreach(positions, prices, battle, evaluatorFn, configuredThreshold) {
  let worst = null;
  for (const pos of positions) {
    let val;
    try {
      val = evaluatorFn(pos);
    } catch {
      val = null;
    }
    if (val === null || val === undefined) continue;
    if (worst === null || val < worst.actual) {
      worst = {
        symbol: pos.symbol,
        tier: pos.tier,
        slotIndex: pos.slotIndex,
        isCrypto: pos.isCrypto === true,
        metric: 'pnlPct',
        threshold: configuredThreshold,
        actual: val,
      };
    }
  }
  return worst;
}

/**
 * Check whether Haiku's proposed SWAP would push any sector above the cap.
 * Sector weight is computed by slot-count share (BaggerBomb is slot-based, not
 * dollar-weighted) — the simulated post-swap sector map is compared against
 * the cap.
 */
function checkSectorCap({ haikuResult, battle, maxSectorValue }) {
  const { symbolOut, symbolIn } = haikuResult;
  const held = collectHeldPositions(battle);
  const totalSlots = held.length;
  if (totalSlots === 0) return null;

  // Resolve incoming sector from bench.
  const benchAssets = flattenBenchServer(battle.portfolio?.bench);
  const incoming = benchAssets.find(a => a.symbol === symbolIn);
  const incomingSector = incoming?.sector || 'Unknown';

  const sectorCounts = {};
  for (const pos of held) {
    if (pos.symbol === symbolOut) continue; // Removed by swap.
    const sec = pos.sector || 'Unknown';
    sectorCounts[sec] = (sectorCounts[sec] || 0) + 1;
  }
  sectorCounts[incomingSector] = (sectorCounts[incomingSector] || 0) + 1;

  const postWeight = (sectorCounts[incomingSector] / totalSlots) * 100;
  if (postWeight <= maxSectorValue) return null;

  return {
    type: 'maxSectorWeight',
    symbol: symbolIn,
    metric: `sectorWeight:${incomingSector}`,
    threshold: maxSectorValue,
    actual: round2(postWeight),
    action: 'blocked_swap',
    originalDecision: 'SWAP',
    note: `Guardrail: SWAP ${symbolOut}→${symbolIn} would push ${incomingSector} to ${round2(postWeight)}% (cap ${maxSectorValue}%).`,
  };
}

function round2(n) {
  if (typeof n !== 'number' || !isFinite(n)) return n;
  return Math.round(n * 100) / 100;
}
