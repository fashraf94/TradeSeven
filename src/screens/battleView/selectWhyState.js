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
  GUARDRAIL_FAILED: 'guardrailFailed',
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

/**
 * The prefix agentGuardrails.js stamps on `sourceNote` for every guardrail
 * verdict it authors (`guardrail_${forcedType}`, `guardrail_max_sector_weight`).
 * NOT sufficient on its own: the `reinforced_haiku` branch stamps the same
 * prefix while the rationale stays the AGENT's argument (agentGuardrails.js
 * ~468-497) — hence the third conjunct below.
 */
export const GUARDRAIL_SOURCE_PREFIX = 'guardrail_';

/**
 * The action agentGuardrails.js stamps on the override entry when the guardrail
 * itself chose the pair (`{ action: 'forced_exit', symbol, replacementSymbol }`).
 * This is what separates "the guardrail called for this swap" from "the agent
 * argued for a swap and a guardrail agreed" (`reinforced_haiku`).
 */
export const GUARDRAIL_FORCED_EXIT = 'forced_exit';

/**
 * The persisted three-conjunct gate for the fifth state (D-70, Phase 0 §3):
 * `downgraded` (checked by the caller) ∧ a `guardrail_` sourceNote ∧ a
 * `forced_exit` override. Returns the override — the pair lives on it, because
 * the entry's own `symbolOut` / `symbolIn` are null on a downgraded HOLD
 * (agent-evaluate.js ~2634-2635) — or null when the gate does not hold.
 */
export function guardrailForcedExit(evaluation) {
  const note = evaluation?.guardrailSourceNote;
  if (typeof note !== 'string' || !note.startsWith(GUARDRAIL_SOURCE_PREFIX)) return null;
  const overrides = evaluation?.guardrailOverrides;
  if (!Array.isArray(overrides)) return null;
  return overrides.find((o) => o && o.action === GUARDRAIL_FORCED_EXIT) || null;
}

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
    // Why the tick ran (D-78). Types only — the trigger gate's `detail` string
    // is not persisted (agent-evaluate.js:2651). Null on an absence with no
    // entry at all; carried on every entry that exists, the outage included,
    // because "this check was woken by X and recorded nothing" is a true and
    // useful pair of facts.
    triggers: null,
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
  base.triggers = Array.isArray(evaluation.triggers) && evaluation.triggers.length
    ? evaluation.triggers.filter((t) => typeof t === 'string' && t)
    : null;

  if (evaluation.haikuError) {
    const timedOut = evaluation.haikuError?.failureClass === 'timeout';
    return {
      ...base,
      kind: WHY_KIND.ABSENT,
      label: timedOut ? COPY.noDecisionOutage : COPY.noDecisionIncomplete,
    };
  }

  const rationale = cleanText(evaluation.rationale);

  // Downgraded FIRST — see the header. Two reasons carry the same flag
  // (D-66): a thrown executeSwapServer stamps `validationErrors[0]` with the
  // SWAP_FAILED_PREFIX — no guardrail held anything, the swap did not go
  // through; every other downgrade is a guardrail holding the position.
  if (evaluation.downgraded === true) {
    // The FIFTH state FIRST (D-70). Its gate is stricter than the fourth's —
    // three persisted conjuncts, not a string prefix — and the two overlap: a
    // guardrail-forced swap whose execution THREW carries the
    // SWAP_FAILED_PREFIX as well, and under the fourth state's words would
    // credit the agent with an argument the cron overwrote. `reinforced_haiku`
    // (the agent argued, a guardrail agreed) fails the third conjunct and
    // keeps the fourth state, which is correct: those ARE the agent's words.
    const forced = guardrailForcedExit(evaluation);
    if (forced) {
      return {
        ...base,
        kind: WHY_KIND.GUARDRAIL_FAILED,
        label: COPY.guardrailForcedFailedLabel,
        rationale,
        footer: COPY.guardrailForcedFailedFooter,
        symbolOut: cleanText(forced.symbol),
        symbolIn: cleanText(forced.replacementSymbol),
      };
    }
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
 * THE ONE SYMBOL RULE (BUILD_RULES §9). A fresh global matcher for whole-word
 * occurrences of `symbol`, used by BOTH the emphasis pass below and the
 * sentence extractor: "this sentence names SLB" and "emphasise SLB here" must
 * never be able to disagree about what naming a piece means.
 *
 * No lookbehind: Safari before 16.4 throws at RegExp construction on `(?<!…)`,
 * inside Vite's default browser target (review finding F2). The leading
 * boundary is a CAPTURED prefix character, re-emitted unemphasised by the
 * caller. Consequences, kept deliberately (they are the shipped underline's,
 * §9): case-sensitive, so `slb` does not match; `$SLB` DOES match, because `$`
 * is a non-alphanumeric prefix; a symbol that is also an English word matches
 * the word.
 *
 * A new instance per call: `lastIndex` is stateful on a global regex, and a
 * shared one would skip matches between callers.
 *
 * @returns {RegExp|null} null when there is no symbol to match
 */
export function symbolPattern(symbol) {
  if (typeof symbol !== 'string' || !symbol.trim()) return null;
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9])(${escaped})(?![A-Za-z0-9])`, 'g');
}

/** Whether `text` names `symbol` under the one rule above. */
export function namesSymbol(text, symbol) {
  if (typeof text !== 'string' || !text) return false;
  const re = symbolPattern(symbol);
  return re ? re.test(text) : false;
}

/**
 * Split a paragraph into sentences, VERBATIM (A2.1).
 *
 * A boundary is a run of `. ! ?` followed by whitespace or the end of the
 * text. Requiring the trailing whitespace is what keeps `8.4%`, `-1.0x` and
 * `U.S.` intact — a bare `[.!?]` split would cut a rationale mid-number, and
 * these paragraphs are full of numbers. Each piece is trimmed at its edges and
 * otherwise untouched: no re-punctuation, no capitalisation, no ellipsis.
 *
 * @returns {string[]} the sentences in order; [] for empty or non-text input
 */
export function splitSentences(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const out = [];
  const re = /[.!?]+(?=\s|$)/g;
  let start = 0;
  let match = re.exec(text);
  while (match !== null) {
    const end = match.index + match[0].length;
    const piece = text.slice(start, end).trim();
    if (piece) out.push(piece);
    start = end;
    match = re.exec(text);
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/**
 * The sentences of a check's rationale that NAME this piece — verbatim, in
 * order (A2.1, D-75). This is what a row shows instead of the whole paragraph:
 * the same block of text was rendered under every row before A2, so seven
 * pieces claimed one paragraph about the book.
 *
 * Empty means one of two very different things, and the caller must tell them
 * apart: no rationale at all (the label already says so) versus a rationale
 * that never names this piece (`Not named at the {t} check`).
 *
 * @returns {string[]}
 */
export function extractSentences(text, symbol) {
  if (!symbol) return [];
  return splitSentences(text).filter((sentence) => namesSymbol(sentence, symbol));
}

/**
 * The two SCORING tiers as prices (A2.1, ruling 1): the levels cron's own
 * formula — `baseline × (1 ± threshold/100)` — applied to the row's own
 * baseline, which makes them the exact inverse of the percent the row renders
 * beside them. Both inputs are persisted: `thresholdBaseline` is the entry the
 * row's `%` is computed from, `baseATR` is
 * `scoring.thresholds[symbol].threshold` (a percent of price).
 *
 * Null — never an estimate — when either input is missing or non-positive.
 *
 * A SHORT returns null: `thresholdPriceChange` is direction-adjusted upstream,
 * so a short's bagger is a price DECREASE, and no persisted short exists to
 * check that inversion against (the agent layer is long-only in V1,
 * BUILD_RULES §7). Omitting is the honest answer until one does.
 */
export function deriveTierPrices(thresholdBaseline, baseATR, direction = null) {
  if (direction === 'short') return null;
  const positiveNumber = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (!positiveNumber(thresholdBaseline) || !positiveNumber(baseATR)) return null;
  return {
    bagger: thresholdBaseline * (1 + baseATR / 100),
    bust: thresholdBaseline * (1 - baseATR / 100),
  };
}

/**
 * Split a rationale into segments, marking every whole-word occurrence of the
 * tapped symbol so the panel can emphasise it. Pure; never alters the text.
 * @returns {Array<{ text: string, emphasized: boolean }>}
 */
export function emphasizeSymbol(text, symbol) {
  if (typeof text !== 'string' || !text) return [];
  const re = symbolPattern(symbol);
  if (!re) return [{ text, emphasized: false }];
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
