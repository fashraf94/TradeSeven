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
//   - profitTarget     → SOFT note while PROFIT_TARGET_EXECUTOR_ENABLED is false
//                        (byte-identical dark contract); HARD winner-side forced
//                        exit once the flag is live (Exit-Behavior Tier 2 Ask 3,
//                        rulings R1/R3 — sanctioned fence contact per the Aug 19
//                        kickoff). The executor mirrors guardrail_stopLoss across
//                        the four keyed subsystems (R3 meta-principle): forced
//                        SWAP via the same held/self-excluding picker, the same
//                        LOCK deference, sourceNote `guardrail_profitTarget`.
//                        F7 precedence: stops outrank the target on the same tick.
//
// The function is pure — no Firestore I/O, no mutation of inputs. All errors
// are caught per-check so a single bad guardrail never crashes the pipeline.

import { pickSwapReplacementCandidate } from './agentRiskManager.js';
import { flattenBenchServer } from './agentScoring.js';
import { ARCHETYPE_CONFIGS } from './agentArchetypeConfig.js';
import { SECTOR_CAP_MODE, PROFIT_TARGET_EXECUTOR_ENABLED } from '../../src/config/featureFlags.js';
import { getEffectiveArchetype } from './directiveIdentity.js';
import { TOURNAMENT_GAME_MODE, AGENT_PICKS_PER_AGENT } from '../../src/constants/leagueTournament.js';

// ============ Release 2 PR-e — the sector-SLOT rule (Diversifier position cap) ============
//
// The ONE mechanical archetype-integrity piece: every other archetype is
// identity-only (voice/gate), but Diversifier gets a real enforced swap-time
// sector-POSITION cap, so "breadth is the strategy" is mechanically true, not just
// narrated. It caps mid-battle SWAPS only (the initial draft lives in fenced
// decide.js and is out of scope — R2). Named honestly (spec §6): it is a
// SLOT-count rule — sector share = slots-in-sector / the MODE's slot count,
// under the EQUAL-WEIGHT-PER-SLOT invariant (Phase 0 confirmed flat6
// tournament slots are equal-weighted; if weights ever vary, the slot rule's
// honesty breaks — escalate, never patch here).
//
// SCOPE (founder ruling — Option A): TOURNAMENT (flat6) battles only. There the
// agent book is exactly AGENT_PICKS_PER_AGENT = 6 non-crypto slots, so
// 2/6 = 33.3% (allowed) .. 3/6 = 50% (blocked): the derived cap (2/6) encodes
// "max 2 per sector." The denominator is the MODE's slot count, never the momentary held
// count — a partially-filled book must not inflate sector shares (spec §6:
// "partial-fill construction never trapped"). Standard/tiered Diversifier books
// (7 slots incl. a mandatory crypto) are intentionally OUT of scope here.
//
// FIRING (Release 2 PR-e — decoupled from ARCHETYPE_INTEGRITY_MODE, founder
// ruling 2026-07-10): the cap fires ONLY under SECTOR_CAP_MODE='enforce'.
// 'observe' measures without touching a decision — every swap enforce WOULD
// have blocked is recorded as a `would_block_swap` override through the SAME
// math and preconditions (see applyGuardrails' sectorSlotObserveCap). 'off' is
// byte-identical to today.
//
// Correction C2 — inject at the CALL SITE, never inside applyGuardrails: the cron
// skips applyGuardrails entirely when deployedGuardrails is empty, so a synthetic
// guardrail added inside applyGuardrails would never reach a zero-guardrail
// Diversifier (the common case — a fresh agent with no equipped rules). We augment
// the array at the call site instead; the synthetic guardrail makes it non-empty,
// so the existing `length > 0` skip self-resolves. (The observe path has the same
// trap: the cron's gate also opens when resolveSectorSlotObserveCap returns a cap.)
// SINGLE SOURCE OF TRUTH (Sector Cap Activation arc, founder-ruled 2026-07-23):
// the cap is DERIVED from the Diversifier archetype's declared per-sector SLOT
// COUNT — `sectorConcentrationCap` (= 2, "max 2 positions per sector") — read
// from the FENCED agentArchetypeConfig.js. Reading a fenced export is permitted
// (BUILD_RULES §1); this is the behaviorFingerprint.js:152 precedent, which reads
// the SAME field for the Character-tab Concentration axis — so the DISPLAY and
// the ENFORCED cap now derive from ONE value and can no longer drift (§9
// display-agreement). The percentage is the flat6-book re-encoding of that count:
//   capPct = sectorConcentrationCap / bookSize,  bookSize = AGENT_PICKS_PER_AGENT
// (6, the MODE's slot count — the SAME denominator checkSectorCap uses, never
// held.length). Diversifier: 2/6 = 33.3% (admits 2 of 6) .. 3/6 = 50% (blocks 3).
//
// The `+ 1e-6` is a DEFENSIVE belt-and-braces float guard, NOT load-bearing:
// checkSectorCap compares `postWeight <= cap` with the SAME `(n / bookSize) * 100`
// arithmetic on both sides, so at n = sectorConcentrationCap the two are already
// bit-identical (2/6 <= 2/6 passes). The nudge only protects a FUTURE refactor
// that computed the two sides differently (a share of 0.33333334 must not
// spuriously block the 2nd position). It lives on the CONSTANT side ON PURPOSE —
// never inside checkSectorCap, which must not loosen a user-set maxSectorWeight
// (founder ruling 2026-07-23). 1e-6 pp is a millionth of a slot, far below the
// 16.67 pp gap between slot counts, so it can never admit the 3rd position.
// (The admits-2/blocks-3 boundary is regression-locked in agentGuardrails.test.js,
// which fails loudly if the fenced config value ever drifts.)
//
// FENCE POSTURE (founder ruling 2026-07-23): this edit lands while
// agentGuardrails.js is NON-fenced (absent from BUILD_RULES §1) — the Diversifier
// cap was scoped non-fenced by design, so no §7 sign-off gates it. This is
// DELIBERATELY GRANDFATHERED: the separate, pending §1 fence-list reconciliation
// WILL add this file to the fence (it owns deterministic risk enforcement —
// applyGuardrails / checkSectorCap / stop + trailing firing — and is the DR-4
// guardrail-binding compilation target). After that reconciliation merges, edits
// here are §7-gated fence contact.
export const DIVERSIFIER_SECTOR_CAP_PCT =
  (ARCHETYPE_CONFIGS.diversifier.sectorConcentrationCap / AGENT_PICKS_PER_AGENT) * 100 + 1e-6;

/**
 * The shared gate + merge for BOTH firing modes (enforce injection and observe
 * measurement) — one home so the two can never drift on scope or on the
 * min(user, core) rule. Returns null outside the rule's scope.
 */
function resolveSectorSlotContext(guardrails, battle) {
  const base = Array.isArray(guardrails) ? guardrails : [];
  if (battle?.gameMode !== TOURNAMENT_GAME_MODE) return null;   // Option A: tournament only
  // Resolve via the Phase-C resolver (frozen battle snapshot), not a raw agent read.
  if (getEffectiveArchetype(battle, null) !== 'diversifier') return null;

  // The user can only TIGHTEN: effectiveCap = min(ALL user maxSectorWeight caps, the
  // derived core cap). Take the min over every existing numeric cap so a user's stricter value
  // still wins even if the snapshot somehow carried more than one.
  const existingCaps = base.filter(g => g?.type === 'maxSectorWeight' && typeof g.value === 'number');
  const userCap = existingCaps.length ? Math.min(...existingCaps.map(g => g.value)) : Infinity;
  const effectiveCap = Math.min(userCap, DIVERSIFIER_SECTOR_CAP_PCT);
  return { base, existingCaps, userCap, effectiveCap };
}

/**
 * Augment a battle's deployedGuardrails with the Diversifier sector-slot cap.
 * ENFORCE-only and tournament-only; the user can only make the cap TIGHTER
 * (effectiveCap = min(userCap, the derived core cap)), never looser. Returns the original
 * array unchanged when SECTOR_CAP_MODE is not 'enforce', the battle is not a
 * tournament, or the effective archetype is not Diversifier — so OFF is
 * byte-identical and OBSERVE never alters the array (its measurement rides
 * resolveSectorSlotObserveCap → applyGuardrails instead).
 *
 * @param {Array}  guardrails - battle.agentContext.deployedGuardrails (or []).
 * @param {Object} battle     - full battle doc (reads gameMode + agentContext.archetype).
 * @returns {Array} the (possibly augmented) guardrails array.
 */
export function injectDiversifierSectorCap(guardrails, battle) {
  const base = Array.isArray(guardrails) ? guardrails : [];
  if (SECTOR_CAP_MODE !== 'enforce') return base; // PR-e decouple: fires on its OWN flag, never ARCHETYPE_INTEGRITY_MODE
  const ctx = resolveSectorSlotContext(guardrails, battle);
  if (!ctx) return base;
  console.log(
    `[Guardrails] Diversifier sector cap: user=${ctx.existingCaps.length ? ctx.userCap : 'none'} core=${DIVERSIFIER_SECTOR_CAP_PCT} -> effective=${ctx.effectiveCap}`,
  );

  // UN-SHADOWABLE: drop EVERY existing maxSectorWeight entry and append the synthetic
  // LAST, so applyGuardrails' keep-last dedup (byType) always lands on our cap — no
  // second maxSectorWeight can shadow it, whatever shape the snapshot had.
  const synthetic = { ...(ctx.existingCaps[0] || {}), type: 'maxSectorWeight', value: ctx.effectiveCap, enforcement: 'hard' };
  return [...base.filter(g => g?.type !== 'maxSectorWeight'), synthetic];
}

/**
 * OBSERVE-mode half (Release 2 PR-e, founder ruling D1: observe logs
 * would-blocks): resolves the effective slot cap this battle WOULD run under
 * enforce — same gates, same min(user, core) merge, via the shared context —
 * or null when SECTOR_CAP_MODE is not 'observe' / outside the rule's scope.
 * The caller passes the number into applyGuardrails' sectorSlotObserveCap so
 * the would-block is evaluated under the enforce path's exact preconditions.
 * NEVER mutates or augments the guardrails array — under observe, user
 * guardrails behave byte-identically to today.
 *
 * @returns {number|null} the effective cap percentage, or null.
 */
export function resolveSectorSlotObserveCap(guardrails, battle) {
  if (SECTOR_CAP_MODE !== 'observe') return null;
  return resolveSectorSlotContext(guardrails, battle)?.effectiveCap ?? null;
}

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
 *                                      'pending_next_tick' | 'would_block_swap'
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
 * @param {number|null} [args.sectorSlotObserveCap] - Release 2 PR-e observe mode:
 *   the effective slot cap from resolveSectorSlotObserveCap, or null (the inert
 *   default — absent/null is byte-identical to pre-PR-e behavior). When set, a
 *   proposed SWAP the enforce cap would have blocked is recorded as a
 *   `would_block_swap` override WITHOUT touching the decision.
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
  sectorSlotObserveCap = null,
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

  // No-op path: no guardrails configured — UNLESS observe measurement is on
  // (a zero-guardrail Diversifier is the C2 common case; the observe volume
  // read must include it, so an empty array proceeds when the shadow cap is
  // set and every per-type check below no-ops on the empty index).
  if ((!Array.isArray(guardrails) || guardrails.length === 0) && typeof sectorSlotObserveCap !== 'number') {
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
  for (const g of Array.isArray(guardrails) ? guardrails : []) {
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

  // ---- 2c) Profit target — HARD once the executor flag is live (Ask 3, R1) ----
  // Winner-side mirror of the stop scan: fires when gain-from-entry crosses the
  // user's target, resolved per position through the targetFor override hook
  // (F11, Tier-3-ready). F7 precedence: only consulted when NO stop breached —
  // the protective trigger owns the tick's single exit. Flag false → this block
  // is dead and the soft note below renders, byte-identical to Phase 4B.
  const profitTarget = byType.profitTarget;
  let targetBreach = null;
  if (
    PROFIT_TARGET_EXECUTOR_ENABLED &&
    profitTarget &&
    typeof profitTarget.value === 'number' &&
    !stopLossBreach &&
    !trailingBreach
  ) {
    try {
      targetBreach = pickBestTargetBreach(held, prices, battle, profitTarget.value);
      // Log secondary over-target positions — one exit per eval, the rest wait
      // a tick (mirrors the stop scan's pending_next_tick secondary logging).
      for (const pos of held) {
        const pnl = computePnLPct(pos, prices, battle);
        if (pnl === null) continue;
        const posTarget = Math.abs(targetFor(pos, profitTarget.value));
        if (posTarget > 0 && pnl >= posTarget && pos.symbol !== targetBreach?.symbol) {
          overrides.push({
            type: 'profitTarget',
            symbol: pos.symbol,
            metric: 'pnlPct',
            threshold: posTarget,
            actual: round2(pnl),
            action: 'pending_next_tick',
            originalDecision,
          });
        }
      }
    } catch (err) {
      console.warn('[Guardrails] profitTarget executor check failed:', err?.message);
    }
  }

  const forcedBreach = stopLossBreach || trailingBreach || targetBreach;
  const forcedType =
    stopLossBreach ? 'stopLoss' : trailingBreach ? 'trailingStop' : targetBreach ? 'profitTarget' : null;

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

  // ---- 3b) Release 2 PR-e: the sector-SLOT rule, OBSERVE mode ----
  // The would-block shadow runs under the enforce path's EXACT preconditions
  // (same !forcedBreach precedence, same proposed-SWAP shape, the same
  // checkSectorCap math), so the logged volume is precisely what 'enforce'
  // would have blocked — never a drifted parallel rule. The decision is NEVER
  // touched here; the record rides `overrides` into the eval-record telemetry.
  if (
    typeof sectorSlotObserveCap === 'number' &&
    !forcedBreach &&
    originalDecision === 'SWAP' &&
    haikuResult?.symbolOut &&
    haikuResult?.symbolIn
  ) {
    try {
      const wouldBlock = checkSectorCap({
        haikuResult,
        battle,
        maxSectorValue: sectorSlotObserveCap,
      });
      if (wouldBlock) {
        const observed = {
          ...wouldBlock,
          action: 'would_block_swap',
          note: `[SectorSlot observe] ${wouldBlock.note}`,
        };
        overrides.push(observed);
        console.log('[SectorSlot] would_block', JSON.stringify({ battleId: battle?.id ?? null, ...observed }));
      }
    } catch (err) {
      console.warn('[Guardrails] sector-slot observe check failed:', err?.message);
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

  // ---- 5) Profit target (soft): informational only — the DARK half of the
  // Ask 3 flag split. Renders only while the executor is off; once
  // PROFIT_TARGET_EXECUTOR_ENABLED is live, block 2c owns the semantic and
  // the note would be a second, contradictory voice on the same signal.
  if (!PROFIT_TARGET_EXECUTOR_ENABLED && profitTarget && typeof profitTarget.value === 'number') {
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
        // Forge Enforcement Keystone V1.4 §3.1 (A2): a stopLoss/trailingStop breach
        // on the exiting symbol is a PROTECTIVE exit even when Haiku independently
        // proposed it. Surface the guardrail sourceNote (not null) so the Knob B
        // hurdle hook bypasses the floor — otherwise a reinforced protective exit
        // could be gated and leave the agent parked in a breaching position.
        // Ask 3 (R2): a profitTarget breach reinforces identically — its sourceNote
        // routes the USER-DIRECTIVE bypass (clearsHurdleFloor step 1b), the same
        // never-parked contract for the user's standing order.
        sourceNote: `guardrail_${forcedType}`,
      };
    }

    // Pick a replacement from bench. [VWAP Floor B2] Routed through the
    // held/self-excluding picker (no quality predicate — forced exits are
    // protective) so a guardrail exit can never pick an already-held symbol.
    const benchAssets = flattenBenchServer(battle.portfolio?.bench);
    const replacement = pickSwapReplacementCandidate({
      benchAssets,
      prices,
      outgoingIsCrypto: forcedBreach.isCrypto === true,
      heldSymbols: new Set(held.map(p => p.symbol)),
    });

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
        : forcedType === 'trailingStop'
          ? `trailing stop at ${Math.abs(forcedBreach.threshold)}% from peak`
          : `profit target at ${Math.abs(forcedBreach.threshold)}%`;

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

// ==================== ASK 3 EXECUTION-CLASS SURFACE ====================

/**
 * The per-position target resolver (F11 — the Tier-3-ready override hook).
 * Today every target is the global Exit-Discipline percentage; the coming
 * per-position conversational lever writes `profitTargetOverridePct` onto the
 * position and this hook honors it with zero executor rework. Fail-closed:
 * anything but a positive number falls back to the global value.
 *
 * @param {Object|null} position - a held position (may carry profitTargetOverridePct)
 * @param {number} globalTargetValue - the equipped profitTarget guardrail value
 * @returns {number}
 */
export function targetFor(position, globalTargetValue) {
  const override = position?.profitTargetOverridePct;
  return typeof override === 'number' && override > 0 ? override : globalTargetValue;
}

// The closed set of guardrail types the engine knows AT ALL — flag-independent
// on purpose (/code-review CR4: a flag-dependent list frozen at import time
// could disagree with guardrailExecutionClass's call-time read under the
// live-getter mock pattern). Which of these are executors vs displayed
// advisories is answered ONLY by guardrailExecutionClass below, at call time.
export const KNOWN_GUARDRAIL_TYPES = Object.freeze([
  'stopLoss', 'trailingStop', 'maxSectorWeight', 'maxPosition', 'profitTarget',
]);

/**
 * F11's pairing source of truth: which execution class a guardrail type has
 * TODAY. 'executor' = a real deterministic enforcement path in applyGuardrails;
 * 'advisory_displayed' = explicitly no executor, displayed as advisory; null =
 * unknown type (fail-closed — never silently an executor). Reads the flag at
 * call time so the pairing test and the compiler gate can never disagree.
 *
 * @param {string} type - guardrail type literal
 * @returns {'executor'|'advisory_displayed'|null}
 */
export function guardrailExecutionClass(type) {
  switch (type) {
    case 'stopLoss':
    case 'trailingStop':
    case 'maxSectorWeight':
      return 'executor';
    case 'profitTarget':
      return PROFIT_TARGET_EXECUTOR_ENABLED ? 'executor' : 'advisory_displayed';
    case 'maxPosition':
      return 'advisory_displayed';
    default:
      return null;
  }
}

// ==================== INTERNAL HELPERS ====================

/**
 * Winner-side mirror of pickWorstBreach for the profit-target executor (F7:
 * most-breaching first — the LARGEST excess of gain over its per-position
 * target fires; the rest wait a tick). Returns the same breach shape
 * pickWorstBreach produces ({symbol,tier,slotIndex,isCrypto,metric,threshold,
 * actual}) with threshold POSITIVE (winner-side), so the shared compose block
 * downstream needs no target-specific branch.
 */
function pickBestTargetBreach(positions, prices, battle, globalTargetValue) {
  let best = null;
  let bestExcess = -Infinity;
  for (const pos of positions) {
    let pnl;
    try {
      pnl = computePnLPct(pos, prices, battle);
    } catch {
      pnl = null;
    }
    if (pnl === null || pnl === undefined) continue;
    const threshold = Math.abs(targetFor(pos, globalTargetValue));
    if (!(threshold > 0)) continue;
    if (pnl < threshold) continue;
    const excess = pnl - threshold;
    if (best === null || excess > bestExcess) {
      bestExcess = excess;
      best = {
        symbol: pos.symbol,
        tier: pos.tier,
        slotIndex: pos.slotIndex,
        isCrypto: pos.isCrypto === true,
        metric: 'pnlPct',
        threshold,
        actual: pnl,
      };
    }
  }
  return best;
}

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
 * Check whether Haiku's proposed SWAP would push any sector above the cap,
 * evaluated against the PROJECTED post-trade book (symbolOut removed,
 * symbolIn added). Sector weight is computed by slot-count share (BaggerBomb
 * is slot-based, not dollar-weighted) under the EQUAL-WEIGHT-PER-SLOT
 * invariant — see the sector-SLOT rule block above.
 *
 * Release 2 PR-e — the denominator: in TOURNAMENT mode it is the MODE's slot
 * count (AGENT_PICKS_PER_AGENT = 6, the flat6 book config), NOT the momentary
 * held count. On a full book the two are identical — and a full book is every
 * KNOWN reachable state (decide.js validates prescribed deploys to exactly 6;
 * a forced exit with no bench DEFERS rather than emptying a slot). The
 * slot-count denominator exists so an UNKNOWN partial state (corrupt doc, a
 * future path) can never inflate shares and trap construction — 2 in a sector
 * must read 2/6 whether the book holds 3 or 6 (spec §6: "partial-fill
 * construction never trapped"). This applies to any tournament maxSectorWeight
 * check, flag-independent (spec §6 authorizes the fix unconditionally).
 * Non-tournament books keep the held-count denominator: user caps there are
 * live Phase-4B behavior this authorization does not change.
 */
function checkSectorCap({ haikuResult, battle, maxSectorValue }) {
  const { symbolOut, symbolIn } = haikuResult;
  const held = collectHeldPositions(battle);
  const totalSlots = battle?.gameMode === TOURNAMENT_GAME_MODE ? AGENT_PICKS_PER_AGENT : held.length;
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
