// api/_utils/mandatePromptAssembly.js
//
// Spec 1 — Mandate Substrate — PROMPT ASSEMBLY (§3.2). New, fence-free. Pure (no
// Firestore, no fetch).
//
// IDENTITY COMES FROM THE PINNED VINTAGE DOC (§3.2 / F8): the `vintage` argument
// is the already-read `archetypeVintages/{codeId}_{hash}` doc the book pins —
// NEVER a live registry read. This module therefore does NOT import
// archetypeRegistry / mandateVintage / mandateGenerationConfig; that exclusion is
// the substantive §3.2 guard, asserted by mandatePromptAssembly.honesty.test.js
// (the closed prompt-input allowlist). A mid-quarter registry/model/gate change
// cannot reach an active book because this reads only the frozen pin.
//
// CLOSED PROMPT-INPUT ALLOWLIST (§3.2): the prompt is assembled ONLY from
//   pinned_vintage · gate_config · book_state · tick_snapshot · static_scaffold.
// Market data is the shared snapshot only (§3.0) — there is no per-book fetch and
// no candidate list source other than the tick's snapshot. The candidate COUNT
// surfaced is a config constant (MANDATE_PROMPT_CANDIDATE_COUNT), not a live knob.
//
// TOKEN BUDGET (§6.3): the assembled input is measured and enforced pre-send.
// Over budget → the candidate slate is trimmed first; if the base scaffold alone
// still exceeds the budget the assembly FAILS LOUD rather than silently sending an
// over-budget prompt.

import { markBook } from './mandateValuation.js';
import { classifyHeldFreshness } from './mandateUniverseSnapshot.js';
import { buildContextBlock } from './mandateContextBlock.js';
import { buildMandateDecisionTool } from './mandateDecisionTool.js';
import {
  MANDATE_EVAL_INPUT_TOKEN_BUDGET,
  MANDATE_PROMPT_CANDIDATE_COUNT,
  MANDATE_MARK_MAX_AGE_MS,
} from './mandateConfig.js';

/** The closed set of sources the prompt may be assembled from (§3.2). */
export const MANDATE_PROMPT_INPUT_SOURCES = Object.freeze([
  'pinned_vintage', 'gate_config', 'book_state', 'tick_snapshot', 'static_scaffold',
]);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rough token estimate (~4 chars/token) — the pre-send budget check (§6.3). */
export function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

function fmtUsd(n) {
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : 'n/a';
}
function pct(frac) {
  return Number.isFinite(frac) ? `${(frac * 100).toFixed(1)}%` : 'n/a';
}

/** Identity system scaffold, assembled from the PINNED vintage (§3.2). */
function buildSystemPrompt(vintage) {
  const ac = vintage?.archetypeContent || {};
  const gc = vintage?.gateConfig || {};
  const identity = ac.identity || {};
  const factors = ac.character?.factors || {};
  const name = ac.displayName || vintage?.codeId || 'Portfolio Manager';

  const lines = [];
  lines.push(`You are ${name}, an AI portfolio manager running a virtual book of US equities.`);
  if (identity.reveal) lines.push(identity.reveal);
  if (identity.voice) lines.push(`Your voice: ${identity.voice}`);
  if (factors.huntsFor) lines.push(`What you hunt for: ${factors.huntsFor}`);
  if (factors.hardRule) lines.push(`Your hard rule: ${factors.hardRule}`);

  lines.push('');
  lines.push('## How you operate');
  lines.push('- Exactly ONE action per evaluation, sized in US dollars (share quantity derives at execution).');
  lines.push('- BUY opens a new position; ADD increases one you hold; SELL exits fully; TRIM reduces; HOLD does nothing.');
  lines.push('- You may BUY or ADD only tickers listed in the candidate universe below (nothing else is tradable).');
  lines.push('- SELL/TRIM apply only to positions you currently hold.');
  lines.push('');
  lines.push('## Constraints (enforced after you decide — respect them to avoid wasted actions)');
  lines.push(`- Keep at least ${pct(gc.cashFloorPct)} of the book in cash.`);
  lines.push(`- No single position above ${pct(gc.maxSinglePositionWeightPct)} of the book.`);
  lines.push(`- Hold no more than ${gc.maxPositions ?? 'n/a'} positions; build toward at least ${gc.minPositions ?? 'n/a'}.`);
  lines.push(`- Sector concentration cap: ${gc.sectorConcentrationCap != null ? pct(gc.sectorConcentrationCap) : 'none'}.`);
  lines.push('');
  lines.push('## Honesty note');
  lines.push('Prices are marks from a shared market snapshot. Modeled frictions are IDEALIZED (a spread proxy and slippage, no market impact) — they are not realistic execution cost.');

  return lines.join('\n');
}

/** The candidate slate from the tick snapshot only (§3.0/§3.2): non-held, complete. */
function buildCandidateSlate(snapshot, heldSet, limit) {
  const out = [];
  for (const [sym, e] of Object.entries(snapshot?.symbols || {})) {
    if (heldSet.has(sym)) continue;
    if (!e.complete) continue;
    out.push({ ticker: sym, price: e.price, sector: e.sector || 'unknown' });
    if (out.length >= limit) break;
  }
  return out;
}

function renderCandidateSlate(slate) {
  if (slate.length === 0) return 'Candidate universe: (none available this tick).';
  const lines = ['## Candidate universe (BUY/ADD only from these)'];
  for (const c of slate) lines.push(`- ${c.ticker}: ${fmtUsd(c.price)} · ${c.sector}`);
  return lines.join('\n');
}

/**
 * Assemble the full model input for one book eval. Returns the content the model
 * seam sends plus the token accounting and the declared input sources.
 *
 * @param {object} args
 * @param {object} args.vintage           the PINNED vintage doc (identity source)
 * @param {object} args.book              the mandate doc (portfolio, quarterStartAt, ...)
 * @param {object} args.snapshot          the tick snapshot (§3.0)
 * @param {Date}   [args.now]
 * @param {number} [args.candidateCount]  config constant (defaults to MANDATE_PROMPT_CANDIDATE_COUNT)
 * @param {number} [args.tokenBudget]
 * @returns {{ system, messages, tools, tokenEstimate, candidateCount, inputSources, contextData }}
 */
export function assembleMandatePrompt({
  vintage, book, snapshot, now = new Date(),
  candidateCount = MANDATE_PROMPT_CANDIDATE_COUNT,
  tokenBudget = MANDATE_EVAL_INPUT_TOKEN_BUDGET,
}) {
  if (!vintage) throw new Error('assembleMandatePrompt: pinned vintage required (identity source, §3.2)');
  if (!book) throw new Error('assembleMandatePrompt: book required');

  const positions = book.portfolio?.positions || {};
  const cash = book.portfolio?.cash || 0;
  const { marked, totalValue } = markBook(positions, cash, snapshot);
  const heldSet = new Set(Object.keys(marked));

  const { actionable } = classifyHeldFreshness(snapshot, Object.keys(positions), { now, maxAgeMs: MANDATE_MARK_MAX_AGE_MS });

  const gc = vintage.gateConfig || {};
  const quarterStartAt = book.quarterStartAt ? new Date(book.quarterStartAt.toDate ? book.quarterStartAt.toDate() : book.quarterStartAt) : null;
  const daysIntoQuarter = quarterStartAt ? Math.floor((now.getTime() - quarterStartAt.getTime()) / DAY_MS) + 1 : 0;
  const bootstrapping = heldSet.size < (gc.minPositions ?? 0);

  const context = buildContextBlock({
    marked, cash, totalValue,
    initialValue: book.portfolio?.initialValue ?? totalValue,
    quarterDrawdown: book.portfolio?.quarterDrawdownFromPeak ?? 0,
    daysIntoQuarter, actionableHeld: actionable,
    regime: null, regimeAsOf: null, // §6.1 regime provenance is P3
    bootstrapping, minPositions: gc.minPositions ?? null,
  });

  const system = buildSystemPrompt(vintage);
  const tool = buildMandateDecisionTool(gc.decisionVerbs);
  const instruction = 'Decide now: call submit_mandate_decision with exactly one action for this evaluation.';

  // Pre-send budget (§6.3): measure, then ENFORCE by trimming the candidate slate
  // to fit; ALERT on any exceed (never silently over-spend). The budget is a cost
  // target, not the model's hard window — so the degenerate case (scaffold alone
  // over budget) ALERTS and proceeds rather than blocking the eval (§6.3 "alert,
  // not block"). The trim is what keeps normal ticks within the envelope.
  let slate = buildCandidateSlate(snapshot, heldSet, candidateCount);
  const compose = (s) => `${context.text}\n\n${renderCandidateSlate(s)}\n\n${instruction}`;
  const requested = slate.length;
  let userText = compose(slate);
  let tokenEstimate = estimateTokens(system) + estimateTokens(userText);

  while (tokenEstimate > tokenBudget && slate.length > 0) {
    slate = slate.slice(0, slate.length - 1); // drop the lowest-priority candidate
    userText = compose(slate);
    tokenEstimate = estimateTokens(system) + estimateTokens(userText);
  }
  if (slate.length < requested) {
    console.error(
      `[MandatePrompt] MANDATE_PROMPT_BUDGET_TRIM — candidate slate trimmed `
      + `${requested}→${slate.length} to fit ${tokenBudget} input tokens `
      + `(system ${estimateTokens(system)} + user ${estimateTokens(userText)})`,
    );
  }
  if (tokenEstimate > tokenBudget) {
    // Degenerate: the scaffold + book context alone exceed the budget. Alert
    // loudly and PROCEED (the model window far exceeds this cost target); cost
    // telemetry (§6.2) records the overage.
    console.error(
      `[MandatePrompt] MANDATE_PROMPT_BUDGET_EXCEEDED — scaffold ${tokenEstimate} tokens over `
      + `budget ${tokenBudget} with zero candidates; sending anyway (alert, not block, §6.3)`,
    );
  }

  return {
    system,
    messages: [{ role: 'user', content: userText }],
    tools: [tool],
    tokenEstimate,
    candidateCount: slate.length,
    inputSources: [...MANDATE_PROMPT_INPUT_SOURCES],
    contextData: context.data,
  };
}
