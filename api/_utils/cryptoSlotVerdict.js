// api/_utils/cryptoSlotVerdict.js
//
// Crypto Slot v2 — the verdict behind the CRYPTO SLOT THIS CHECK line (Fable
// build prompt D-5 + rulings R-b / R-c, 14 Oct 2026; build report
// docs/audits/20261014_BUILD_CRYPTO_SLOT_CHECK_LINE.md §1, §3).
//
// THE PRINCIPLE: never ask the model to compute a gate. Before the prompt is
// built, run the one swap the crypto slot can make — the held crypto out, the
// bench crypto in — through the model-swap gates' OWN functions, on the same
// objects the gates will read after the model answers, and hand the verdict
// to the renderer (evalCryptoSlotBlock.js). Nothing here re-implements a gate:
//
//   LOCK      the gate's own predicate: lockedPositions.has(symbolOut)
//             (agent-evaluate.js, "Block Haiku from swapping out LOCKED positions").
//   cooldown  the fenced validator, validateTradeDecision (agentSwapExecution.js),
//             called with VERDICT_DECISION. For the held crypto and the bench
//             crypto every other predicate it applies passes by construction
//             (in the portfolio; in the bench; not self; not already held; both
//             crypto; conviction 70; a hypothesis of 10+ characters), so a
//             refusal is the cooldown. That is CONFIRMED, never assumed: the
//             validator is run again with the bench crypto's cooldown cleared,
//             and only a pass there names the cooldown. A refusal that
//             survives the clearing is structural (a malformed book) → no line.
//             The error text is never read (ruling R-c).
//   not up /  clearsHurdleFloor (agentRiskManager.js) with the gate's own
//   margin    arguments: reason 'haiku_decision', the dial-clamped
//             archetypeConfig, and resolveHurdleAtr(held, freshHurdleAtrMap,
//             assetScores' baseATR ?? 2.5) as the ATR. blockReason
//             'bench_not_positive' → not up; 'below_floor' / 'margin_invalid'
//             → margin. Any other (future) block reason → no line.
//   swap cap  getRecentSwapCount (agentRiskManager.js) with the gate's own
//             arguments, and the gate's own inline comparison — the one
//             expression with no function to call, pinned by a source-scan
//             row in cryptoSlotVerdict.test.js so a change to the gate fails a
//             test (ruling R-c: never extract it — that would edit the gate).
//
// ORDER (ruling R-b): the gates' order at HEAD — LOCK → the validator →
// the hurdle (bench-positive, then the margin) → the cap. The first that
// fails is the reason, as production would record it.
//
// NOT COVERED (each the model's own, or out of the line's scope):
//   - conviction ≥ 70 and the hypothesis floor — the model's own fields;
//   - the distressed veto — stockRegimes is empty for crypto (no
//     stockTechnicalScores doc; 144/144 stored checks read "unknown");
//   - a player's stop-loss / trailing-stop / profit-target guardrail, which
//     can still move the crypto after the model answers, and the
//     maxSectorWeight guardrail — the protective-stop class, a documented
//     exception (ruling R-a). The line speaks of what the agent can do.
//
// WHY "CAN" HOLDS AT GATE TIME: between this call and the gates nothing makes
// them stricter — the cap count only falls (no trade lands in between; old
// ones age out), a cooldown only expires, lockedPositions is not written after
// the post-swap prune, and prices is the same object.
//
// DARK: computeCryptoSlotVerdict returns null while CRYPTO_SLOT_PROMPT_ENABLED
// is off, and the cron attaches nothing — momentumData stays byte-identical.
//
// IMPORTS: the fenced validator and risk manager are CALLED, never edited
// (BUILD_RULES §1). The flag and the game-mode table are Node-clean src
// imports (BUILD_RULES §4; cryptoSlotVerdict.test.js's unmocked import is the
// dependency-surface guard).

import { CRYPTO_SLOT_PROMPT_ENABLED } from '../../src/config/featureFlags.js';
import { resolveModeConfig } from '../../src/constants/agentGameModes.js';
import { validateTradeDecision } from './agentSwapExecution.js';
import {
  clearsHurdleFloor,
  getRecentSwapCount,
  EMERGENCY_BYPASS_REASONS,
  USER_DIRECTIVE_BYPASS_REASONS,
} from './agentRiskManager.js';
import { resolveHurdleAtr } from './hurdleAtr.js';
import { flattenPortfolioServer } from './agentScoring.js';

/** The reason the model's own swap carries through the gates (agent-evaluate.js haikuSwapReason). */
export const VERDICT_SWAP_REASON = 'haiku_decision';

/** The fixed decision the validator is asked about (ruling R-c). Pinned by test. */
export function verdictDecision(held, bench) {
  return {
    decision: 'SWAP',
    symbolOut: held,
    symbolIn: bench,
    conviction: 70,
    hypothesis: 'Crypto slot verdict: the held crypto for the bench crypto.',
  };
}

/** The same battle with only the bench crypto's cooldown cleared — the cooldown confirmation. */
function withoutBenchCryptoCooldown(battle) {
  const bench = battle.portfolio.bench;
  return {
    ...battle,
    portfolio: { ...battle.portfolio, bench: { ...bench, crypto: { ...bench.crypto, cooldownUntil: null } } },
  };
}

/**
 * The verdict for the held crypto ↔ bench crypto swap, ignoring the flag
 * (offline tooling and tests; tick-side code calls computeCryptoSlotVerdict).
 *
 * @param {Object} p
 * @param {Object} p.battle            - the battle as the gates will read it (post-rebuild)
 * @param {Object} p.prices            - the tick's price map (changePercent in percent)
 * @param {Set<string>} p.lockedPositions
 * @param {Object} p.archetypeConfig   - the dial-clamped config the gates use
 * @param {Map} p.freshHurdleAtrMap
 * @param {Array} p.assetScores
 * @param {number} p.nowMs             - the cap window's anchor (the gate uses Date.now())
 * @returns {null | { held: string, bench: string, canSwap: boolean, reason: string|null, benchDailyPct: number }}
 *   null when there is no line to show: a flat6 battle, not exactly one held
 *   crypto, no bench crypto, or a refusal the line has no words for.
 */
export function computeCryptoSlotVerdictForced({ battle, prices, lockedPositions, archetypeConfig, freshHurdleAtrMap, assetScores, nowMs }) {
  if (!battle?.portfolio || resolveModeConfig(battle.gameMode).promptVariant === 'flat6') return null;
  const heldCrypto = flattenPortfolioServer(battle.portfolio).filter((a) => a?.isCrypto === true && typeof a.symbol === 'string' && a.symbol);
  if (heldCrypto.length !== 1) return null;
  const benchCrypto = battle.portfolio.bench?.crypto;
  if (!benchCrypto || typeof benchCrypto.symbol !== 'string' || !benchCrypto.symbol) return null;
  const held = heldCrypto[0].symbol;
  const bench = benchCrypto.symbol;
  // The BENCH table's own read of the daily move (agentEvalPromptAssembly.js
  // buildBenchCSV) and the gate's (÷100): the same value, `|| 0` included.
  const benchDailyPct = prices?.[bench]?.changePercent || 0;
  const verdict = (canSwap, reason) => ({ held, bench, canSwap, reason, benchDailyPct });

  // 1. LOCK.
  if (lockedPositions?.has?.(held)) return verdict(false, 'lock');

  // 2. The validator — its cooldown predicate, confirmed by clearing it.
  const decision = verdictDecision(held, bench);
  if (!validateTradeDecision(decision, battle).valid) {
    if (!validateTradeDecision(decision, withoutBenchCryptoCooldown(battle)).valid) return null;
    return verdict(false, 'cooldown');
  }

  // 3. The hurdle floor, with the gate's arguments.
  const activeBaseATR = assetScores?.find?.((s) => s.symbol === held)?.baseATR ?? 2.5;
  const hurdle = clearsHurdleFloor({
    active: { symbol: held, dailyPct: (prices?.[held]?.changePercent || 0) / 100 },
    benchCandidate: { symbol: bench, dailyPct: (prices?.[bench]?.changePercent || 0) / 100 },
    reason: VERDICT_SWAP_REASON,
    archetypeConfig,
    userATR: resolveHurdleAtr(held, freshHurdleAtrMap, activeBaseATR).atr,
  });
  if (!hurdle.clears) {
    if (hurdle.blockReason === 'bench_not_positive') return verdict(false, 'not_up');
    if (hurdle.blockReason === 'below_floor' || hurdle.blockReason === 'margin_invalid') return verdict(false, 'margin');
    return null;
  }

  // 4. The swap cap — the gate's expression, its arguments, its comparison.
  const swCfg = archetypeConfig?.hftConfig?.swapWindow;
  const capBlocked = swCfg?.enabled
    && !EMERGENCY_BYPASS_REASONS.has(VERDICT_SWAP_REASON)
    && !USER_DIRECTIVE_BYPASS_REASONS.has(VERDICT_SWAP_REASON)
    && getRecentSwapCount(battle.trades || [], swCfg.windowMinutes, nowMs, { countEmergencies: swCfg.countEmergencies }) >= swCfg.capPerWindow;
  if (capBlocked) return verdict(false, 'swap_cap');

  return verdict(true, null);
}

/**
 * The tick-side entry point: null while CRYPTO_SLOT_PROMPT_ENABLED is off
 * (read at call time), and null on any fault — a verdict that cannot be
 * computed shows no line rather than a guessed one, and never costs the tick.
 */
export function computeCryptoSlotVerdict(args) {
  if (!CRYPTO_SLOT_PROMPT_ENABLED) return null;
  try {
    return computeCryptoSlotVerdictForced(args);
  } catch (err) {
    console.warn('[CryptoSlotVerdict] verdict failed — no line this check:', err?.message || err);
    return null;
  }
}
