// api/_utils/callRecords/observe.js
//
// Cockpit Build 0 — quotes preserved as fetched, and one frozen observation
// per exit (spec docs/design/COCKPIT_SPEC_V1_3.md §3.3–§3.4; contract §6).
//
// THE QUOTE COPY. At each fetch site the cron copies, per symbol, a DETACHED
// `{ current, fallback, fetchedAtMs }` — the fetched price object's `current`
// and `fallback`, plus the instant the fetch resolved — BEFORE any later
// execution-price replacement. The copy holds primitives only, so no later
// write to the tick's price map can reach it.
//
// THE OBSERVATION. `{ observedAtMs, source, symbols: { [sym]: { px,
// fetchedAtMs, replacedInPrompt? } } }`, frozen ONCE at its seam and never
// reconstructed. The examined set, the quote values and the instant are taken
// at the same seam; a symbol is admitted only when its detached quote passes
// `isSettlementQuoteUsable` (it reads `current`) AND was fetched at or before
// the observation instant (`fetchedAtMs ≤ observedAtMs`). `px` is `current`.
// `replacedInPrompt: true` marks a model-path row whose PROMPT carried an
// execution-price replacement; `px` is still the fetched quote.
//
// Pure except for the per-context writes the cron asks for. No I/O.

import { isSettlementQuoteUsable } from '../agentQuoteHealth.js';
// Node-clean, zero-import src module (BUILD_RULES §4): the battle universe the
// research route validates against. Guarded by observe.test.js's import.
import { selectBattleUniverse } from '../../../src/data/battleUniverse.js';
import { callsActive } from './mode.js';

/** Where an observation was taken — one per §3.4 row that flips. */
export const OBSERVATION_SOURCES = Object.freeze([
  'model_prompt',      // model-result and transport-failed-after-prompt
  'budget_skipped',
  'no_trigger',
  'proposal_pending',
  'gameplan_pass',     // gameplan-pending and gameplan-created: the R11 pass
  'passive',
]);

/**
 * Record the detached copy of one fetched quote. Inactive mode → nothing.
 * Called at the three fetch sites, before any replacement can happen.
 */
export function recordFetchedQuote(callsCtx, symbol, price, fetchedAtMs) {
  if (!callsCtx || !callsActive(callsCtx.mode)) return;
  if (typeof symbol !== 'string' || !symbol || !price || typeof price !== 'object') return;
  callsCtx.fetchedQuotes[symbol] = Object.freeze({
    current: price.current,
    fallback: price.fallback,
    fetchedAtMs,
  });
}

/**
 * Build a frozen observation from a detached-quote table. Null when the instant
 * is not a finite number (no instant, no observation).
 *
 * @param {object} p
 * @param {string} p.source          one of OBSERVATION_SOURCES
 * @param {number} p.observedAtMs    the seam's instant
 * @param {string[]} p.examined      the set the seam examined
 * @param {Record<string, {current:number, fallback?:boolean, fetchedAtMs:number}>} p.fetchedQuotes
 * @param {string[]} [p.replaced]    model path only: symbols whose prompt row carried a replacement
 */
export function buildObservation({ source, observedAtMs, examined, fetchedQuotes, replaced = [] }) {
  if (!(typeof observedAtMs === 'number' && Number.isFinite(observedAtMs))) return null;
  const replacedSet = new Set(Array.isArray(replaced) ? replaced : []);
  const symbols = {};
  for (const symbol of new Set(Array.isArray(examined) ? examined : [])) {
    if (typeof symbol !== 'string' || !symbol) continue;
    const quote = fetchedQuotes?.[symbol];
    if (!isSettlementQuoteUsable(quote)) continue;
    // The invariant on every admitted symbol: a quote fetched after the
    // instant never enters the observation stamped with that instant.
    if (!(typeof quote.fetchedAtMs === 'number' && Number.isFinite(quote.fetchedAtMs) && quote.fetchedAtMs <= observedAtMs)) continue;
    symbols[symbol] = Object.freeze({
      px: quote.current,
      fetchedAtMs: quote.fetchedAtMs,
      ...(replacedSet.has(symbol) ? { replacedInPrompt: true } : {}),
    });
  }
  return Object.freeze({ observedAtMs, source, symbols: Object.freeze(symbols) });
}

/**
 * Freeze THE observation for this check. Once: a second seam on the same check
 * never replaces it (an observation is never reconstructed).
 */
export function freezeObservation(callsCtx, spec) {
  if (!callsCtx || !callsActive(callsCtx.mode) || callsCtx.observation) return callsCtx?.observation ?? null;
  const observation = buildObservation({ ...spec, fetchedQuotes: callsCtx.fetchedQuotes });
  callsCtx.observation = observation;
  return observation;
}

/**
 * THE MODEL SEAM (§3.4 model-result / transport-failed rows): the held rows and
 * the flattened augmented bench the prompt was built from, observed at
 * `Date.parse(promptBuiltAt)` (finite-checked), with the rows the prompt showed
 * at an execution price marked. The battle universe the fork options are held
 * to is frozen at the same seam.
 */
export function freezeModelObservation(callsCtx, { heldSymbols, benchSymbols, promptBuiltAt, replacedSymbols, battle }) {
  if (!callsCtx || !callsActive(callsCtx.mode)) return null;
  callsCtx.universe = Object.freeze([...selectBattleUniverse(battle)]);
  const observedAtMs = typeof promptBuiltAt === 'string' ? Date.parse(promptBuiltAt) : NaN;
  return freezeObservation(callsCtx, {
    source: 'model_prompt',
    observedAtMs,
    examined: [...(heldSymbols || []), ...(benchSymbols || [])],
    replaced: replacedSymbols || [],
  });
}

/** Is there an observation this exit can flip against? */
export function observationUsable(observation) {
  return !!observation && typeof observation.observedAtMs === 'number' && Number.isFinite(observation.observedAtMs);
}

/**
 * Which §3.4 row an ENTRY-WRITING check took, from the cron's own facts at the
 * final update (HEAD's classification — the failure classes it already
 * records). Early exits set their row where they return.
 *   refreshFailure                      → 'refresh_failed'         (excluded)
 *   haikuFailure 'budget_skipped'       → 'budget_skipped'
 *   prompt never built                  → 'prompt_build_failed'    (excluded)
 *   a model failure after the prompt    → 'transport_failed_after_prompt'
 *   (timeout / HTTP / truncated_response / invalid_tool_result)
 *   otherwise (an ACCEPTED tool result) → 'model_result'
 */
export function classifyEntryExit({ refreshFailure, haikuFailure, promptBuilt }) {
  if (refreshFailure) return 'refresh_failed';
  if (haikuFailure?.failureClass === 'budget_skipped') return 'budget_skipped';
  if (!promptBuilt) return 'prompt_build_failed';
  if (haikuFailure) return 'transport_failed_after_prompt';
  return 'model_result';
}

/**
 * The guardrail kinds whose deterministic scan READS held prices — the fenced
 * applyGuardrails (api/_utils/agentGuardrails.js; called, never edited): the
 * stop-loss, trailing-stop and profit-target scans each compute every held
 * position's P&L from `prices[symbol].current`. The sector cap only checks a
 * PROPOSED swap (the R11 suppression pass proposes none: `haikuResult: null`),
 * and maxPosition reads no price at all.
 */
export const PRICE_SCANNING_GUARDRAIL_TYPES = Object.freeze(['stopLoss', 'trailingStop', 'profitTarget']);

/**
 * Branch review BR-2: did the R11 deterministic pass EXAMINE the held names'
 * prices? Mirrors the fenced helper's own preconditions — guardrails indexed by
 * type with the LAST entry of a type winning, and a scan runs only when its
 * entry carries a numeric value. A pass with no price-scanning kind
 * (sector-only, maxPosition-only, …) examined no price, so its observation is
 * the EMPTY set: expiry runs, no hit can. Pinned against the real helper's
 * price reads (observe.test.js), so a change to which kinds read prices fails
 * a row instead of silently widening the membership.
 *
 * @param {Array<object>} guardrails the pass's deployed (possibly injected) guardrails
 * @returns {boolean}
 */
export function passExaminesHeldPrices(guardrails) {
  const byType = {};
  for (const g of Array.isArray(guardrails) ? guardrails : []) {
    if (g && typeof g.type === 'string') byType[g.type] = g;
  }
  return PRICE_SCANNING_GUARDRAIL_TYPES.some((type) => typeof byType[type]?.value === 'number');
}

/** The §3.4 rows whose exit flips (the excluded rows never do). */
export const FLIP_EXITS = Object.freeze([
  'model_result', 'transport_failed_after_prompt', 'budget_skipped', 'no_trigger',
  'proposal_pending', 'gameplan_pending', 'gameplan_created', 'passive',
]);

/**
 * THE EXECUTOR RESULT (§3.4): the awaited `executeSwapServer` return on the
 * model path — its closed trade's identity and resolved slot — carried in the
 * calls context independently of capture. Never reconstructed from the
 * proposal or from a capture projection: a field the executor did not return
 * is null, and a null never matches.
 */
export function carryExecutorResult(callsCtx, swapResult) {
  if (!callsCtx || !callsActive(callsCtx.mode)) return null;
  const trade = swapResult?.closedTrade;
  const str = (v) => (typeof v === 'string' && v ? v : null);
  callsCtx.executorResult = Object.freeze({
    symbolOut: str(trade?.symbolOut),
    symbolIn: str(trade?.symbolIn),
    tier: str(trade?.tier),
    slotIndex: Number.isInteger(trade?.slotIndex) ? trade.slotIndex : null,
  });
  return callsCtx.executorResult;
}
