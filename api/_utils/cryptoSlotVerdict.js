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
//             called with verdictDecision(). On a well-formed book every other
//             predicate it applies passes for the held crypto and the bench
//             crypto (in the portfolio; in the bench; not self; not already
//             held; both crypto; conviction 70; a hypothesis of 10+
//             characters), so a refusal there is the cooldown. That is
//             CONFIRMED, never assumed: the validator is run again with the
//             bench crypto's cooldown cleared, and only a pass there names the
//             cooldown. A refusal that survives the clearing means a malformed
//             book (e.g. a bench crypto without isCrypto) → no line. The error
//             text is never read (ruling R-c).
//   not up /  clearsHurdleFloor (agentRiskManager.js) with the gate's own
//   margin    arguments: reason 'haiku_decision', the dial-clamped
//             archetypeConfig, and resolveHurdleAtr(held, freshHurdleAtrMap,
//             assetScores' baseATR ?? 2.5) as the ATR. blockReason
//             'bench_not_positive' → not up; 'below_floor' → margin;
//             'margin_invalid' (an ATR that is not positive — the margin cannot
//             be compared, and the gate refuses; the scorer turns a missing or
//             0 baseATR into 2.5, so only a malformed negative one gets here)
//             → margin too: the bench crypto is up and does not clear the
//             floor. Any other (future) block reason → no line.
//   swap cap  getRecentSwapCount (agentRiskManager.js) with the gate's own
//             arguments, and the gate's own inline comparison — the one
//             expression with no function to call, pinned by a source-scan
//             row in cryptoSlotVerdict.test.js so a change to the gate fails a
//             test (ruling R-c: never extract it — that would edit the gate).
//             It counts what the gate counts: every swap in the window but the
//             emergency and user-directive ones — the platform's stagnation
//             rotations and approved meeting legs included, not only the
//             agent's own.
//
// ORDER (ruling R-b): the gates' order at HEAD — LOCK → the validator →
// the hurdle (bench-positive, then the margin) → the cap. The first that
// fails is the reason, as production would record it.
//
// NOT COVERED (each the model's own, or out of the line's scope):
//   - conviction ≥ 70 and the hypothesis floor — the model's own fields;
//   - the distressed veto — an OPERATIONAL fact, not a structural one: no
//     stockTechnicalScores doc exists for any crypto symbol today (none is in
//     the stock universe; 144/144 stored checks read "unknown"), so no crypto
//     regime can be 'distressed'. A doc under a crypto symbol would arm it;
//   - the player's guardrails — the protective-stop class, a documented
//     exception (ruling R-a): a stop-loss / trailing-stop / profit-target
//     breach on the held crypto can still swap it after the model answers,
//     past the hurdle and the cap — whether the model held, or proposed the
//     same swap (applyGuardrails then reinforces it under the guardrail's
//     reason); a breach on ANOTHER position takes the check's one swap; a
//     maxSectorWeight guardrail can refuse a crypto → crypto swap whose
//     incoming crypto reads "Unknown" (F1). The line speaks of what the agent
//     can do, never of what the engine will do;
//   - refusals after the gates: the executor's swap-identity check (at
//     'enforce'; 'shadow' today) and a battle that is no longer active.
//
// TIMING: the verdict is taken before the prompt build; the gates run after
// the model call (seconds later). Between the two nothing writes battle,
// prices, lockedPositions, assetScores or freshHurdleAtrMap, so "can" holds at
// gate time: the cap count can only fall (no trade lands in between; old ones
// age out — getRecentSwapCount's future-guard would only matter for a trade
// stamped ahead of this clock by another instance) and a cooldown can only
// expire. The other direction is not monotone and is safe: on a window-edge
// or cooldown-expiry tick a "cannot" can become passable by gate time — the
// agent holds, and the swap is forgone for that check.
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
 * @param {number} p.nowMs             - the cap window's anchor (the gate uses Date.now(); computeCryptoSlotVerdict passes its own)
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
 * (read at call time — and nothing else runs, not even the clock read, so a
 * dark tick does exactly what it did before), and null on any fault — a
 * verdict that cannot be computed shows no line rather than a guessed one, and
 * never costs the tick. The cap window is anchored at Date.now() taken here,
 * after the flag, unless the caller passes `nowMs` (tests).
 */
export function computeCryptoSlotVerdict(args) {
  try {
    if (!CRYPTO_SLOT_PROMPT_ENABLED) return null;
    return computeCryptoSlotVerdictForced({ ...args, nowMs: args?.nowMs ?? Date.now() });
  } catch (err) {
    console.warn('[CryptoSlotVerdict] verdict failed — no line this check:', err?.message || err);
    return null;
  }
}
