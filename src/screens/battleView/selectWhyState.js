// src/screens/battleView/selectWhyState.js
//
// Why? — the state of a piece at the last confirmed check (Phase A, A2). PURE.
//
// C1: a pure read of what the decision path persisted. `evaluation` is the
// latest `evaluations[]` entry that belongs to the latest check (the `>=`
// join in deriveTurnLine.js — applied again here, so a caller that hands in a
// stale entry still gets the absence state). `rationale` is rendered verbatim.
//
// THE ORDER OF THE BRANCHES IS THE RULE (hazard 2, Phase 0 V2 §Q1): seven
// sites in agent-evaluate.js downgrade a SWAP to HOLD without rewriting the
// rationale, so an entry with `downgraded === true` carries a swap argument
// under a HOLD decision. Rendering that rationale under "Held" would put the
// agent's words beside the wrong verb. `downgraded` is checked FIRST; the
// decision only after. selectWhyState.test.js's mutation row exists to fail
// if that branch is ever removed.

import { isDecidedAt, toMillis } from './deriveTurnLine';
import { toIso } from '../../adapters/baggerbombAdapter';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

export const WHY_KIND = Object.freeze({
  ABSENT: 'absent',
  DOWNGRADED: 'downgraded',
  FAILED: 'failed',
  HELD: 'held',
  SWAPPED: 'swapped',
});

/**
 * The prefix agent-evaluate.js stamps on `validationErrors[0]` when
 * executeSwapServer threw (`validationErrors.push(`Swap execution failed:
 * ${swapErr.message}`)`) — the one downgrade that no guardrail caused (D-66).
 */
export const SWAP_FAILED_PREFIX = 'Swap execution failed';

const swapDidNotGoThrough = (evaluation) => {
  const first = Array.isArray(evaluation.validationErrors) ? evaluation.validationErrors[0] : null;
  return typeof first === 'string' && first.startsWith(SWAP_FAILED_PREFIX);
};

const cleanText = (value) => (typeof value === 'string' && value.trim() ? value : null);

/**
 * @param {object|null} evaluation  the latest evaluations[] entry, or null
 * @param {string} symbol           the tapped piece (book-level: null)
 * @param {string|null} lastScoredAt scoreState.lastScoredAt — the check
 * @returns {{
 *   kind: string, checkedAt: string|null, header: string|null, label: string,
 *   rationale: string|null, footer: string|null, symbolOut: string|null,
 *   symbolIn: string|null, symbol: string|null,
 * }}
 */
export function selectWhyState(evaluation, symbol, lastScoredAt) {
  const checkedAt = toIso(lastScoredAt) ?? toIso(evaluation?.timestamp) ?? null;
  const header = COPY.atCheck(checkedAt);
  const base = {
    checkedAt,
    header,
    symbol: symbol ?? null,
    symbolOut: null,
    symbolIn: null,
    rationale: null,
    footer: null,
  };

  const present = evaluation
    && typeof evaluation === 'object'
    && toMillis(evaluation.timestamp) != null
    && isDecidedAt(evaluation.timestamp, lastScoredAt);
  if (!present) {
    return { ...base, kind: WHY_KIND.ABSENT, label: COPY.noDecision };
  }

  // An engine outage is not a decision (review finding F12, D-65). The cron
  // stamps `haikuError` when the model call failed or was budget-skipped and
  // the tick defaulted to HOLD with a placeholder rationale ("Haiku call
  // failed — defaulting to HOLD", agent-evaluate.js:2637-2667) — the system's
  // words, not the agent's. C1: the honest state is that no decision was
  // recorded, and the more specific label says why (the fact is on the entry).
  //
  // The persisted fact is `haikuError.failureClass` (agentEvalTransport.js
  // classifyHaikuFailure: `timeout` for a timed-out or aborted call; else an
  // HTTP status, an error name, `budget_skipped`, `truncated_response`,
  // `unknown`). Only a TIMEOUT earns the timeout words (review L1-F1 —
  // honesty rule 8: the verb needs evidence for exactly that verb); every
  // other outage keeps the plain absence label until a class-neutral line is
  // ruled (copy request in the A4 handover).
  if (evaluation.haikuError) {
    const timedOut = evaluation.haikuError?.failureClass === 'timeout';
    return { ...base, kind: WHY_KIND.ABSENT, label: timedOut ? COPY.noDecisionOutage : COPY.noDecision };
  }

  const rationale = cleanText(evaluation.rationale);

  // Downgraded FIRST — see the header. Two reasons carry the same flag
  // (D-66): a thrown executeSwapServer stamps `validationErrors[0]` with the
  // SWAP_FAILED_PREFIX — no guardrail held anything, the swap did not go
  // through; every other downgrade is a guardrail holding the position.
  if (evaluation.downgraded === true) {
    if (swapDidNotGoThrough(evaluation)) {
      return {
        ...base,
        kind: WHY_KIND.FAILED,
        label: COPY.failedLabel,
        rationale,
        footer: COPY.failedFooter,
      };
    }
    return {
      ...base,
      kind: WHY_KIND.DOWNGRADED,
      label: COPY.downgradedLabel,
      rationale,
      footer: COPY.downgradedFooter,
    };
  }

  if (evaluation.decision === 'SWAP') {
    const symbolOut = cleanText(evaluation.symbolOut);
    const symbolIn = cleanText(evaluation.symbolIn);
    return {
      ...base,
      kind: WHY_KIND.SWAPPED,
      label: COPY.swappedLabel(symbolOut, symbolIn),
      rationale,
      symbolOut,
      symbolIn,
    };
  }

  // HOLD — and PROPOSAL, which held the position at the check pending an
  // approval the chat carries; the shipped launch mode is autopilot, so a
  // PROPOSAL entry is not reachable today (noted in the Phase A handover).
  return { ...base, kind: WHY_KIND.HELD, label: COPY.heldLabel, rationale };
}

/**
 * Split a rationale into segments, marking every whole-word occurrence of the
 * tapped symbol so the panel can emphasise it. Pure; never alters the text.
 * @returns {Array<{ text: string, emphasized: boolean }>}
 */
export function emphasizeSymbol(text, symbol) {
  if (typeof text !== 'string' || !text) return [];
  if (typeof symbol !== 'string' || !symbol.trim()) return [{ text, emphasized: false }];
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // No lookbehind: Safari before 16.4 throws at RegExp construction on
  // `(?<!…)`, inside Vite's default browser target (review finding F2). The
  // leading boundary is a captured prefix character re-emitted unemphasised.
  const re = new RegExp(`(^|[^A-Za-z0-9])(${escaped})(?![A-Za-z0-9])`, 'g');
  const out = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index + m[1].length;
    if (start > last) out.push({ text: text.slice(last, start), emphasized: false });
    out.push({ text: m[2], emphasized: true });
    last = start + m[2].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), emphasized: false });
  return out;
}

/**
 * The trades on this piece today, oldest first — each with the swap
 * receipt's own time, symbols and the agent's rationale (its own words,
 * verbatim). Symbol-in or symbol-out both count: the piece was either sold
 * out of the book or bought into it.
 *
 * The receipt's `exitReason` is deliberately NOT surfaced (review finding
 * F10): it is a machinery-provenance code (`haiku_decision`, `guardrail_*`,
 * …) — the same attribution class hazard 12 keeps off the screen for
 * `source` / `triggeredBy`, and one value names the model tier. A copy-mapped
 * rendering, if wanted, is a design-chat request (recorded in the handover).
 */
export function selectTradesForSymbol(trades, symbol) {
  if (!Array.isArray(trades) || !symbol) return [];
  return trades
    .filter((t) => t && (t.symbolOut === symbol || t.symbolIn === symbol))
    .map((t) => ({
      at: toIso(t.swappedOutAt),
      symbolOut: t.symbolOut ?? null,
      symbolIn: t.symbolIn ?? null,
      rationale: cleanText(t.rationale),
    }))
    .sort((a, b) => (toMillis(a.at) ?? 0) - (toMillis(b.at) ?? 0));
}

export default selectWhyState;
