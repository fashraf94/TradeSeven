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

/**
 * THE ONE MOTIVE-AUTHOR RULE (D-72 ruling 5, BUILD_RULES §9).
 *
 * Whether a rationale was written by the ENGINE rather than the model. Three
 * shapes, all of them the cron's or the guardrail module's own sentence:
 *
 *   `Guardrail override (…): …`  agent-evaluate.js OVERWRITES haikuResult's
 *                                rationale when a guardrail forces the pair.
 *   `Guardrail override: …`      agentGuardrails.js's own statusMessage, which
 *                                the R11 suppression pass persists verbatim.
 *   `Risk manager: …`            the risk loop's trade rationale.
 *   `Deterministic guardrail …`  R11's fallback when statusMessage is null.
 *
 * THE TEXT IS THE DISCRIMINATOR, NOT THE TRADE'S `source` (A2 review L1-F3 /
 * L1-F4). `source` records who chose the EXIT, which is a different question
 * from who wrote the SENTENCE, and it is wrong in both directions:
 *   · a guardrail-forced swap that EXECUTES leaves `downgraded` false, so the
 *     panel and the check card — which have no `source` at all — rendered the
 *     cron's sentence as the agent's words;
 *   · on the `reinforced_haiku` path (agentGuardrails.js ~468-497) the
 *     guardrail agrees with a swap the model argued for and leaves its
 *     rationale untouched, but the cron still stamps `source: 'guardrail'` —
 *     which labelled the model's own first-person prose as the system's.
 * One rule, one text, consumed by the panel, the check card and the trade
 * card alike, so the tape cannot contradict itself about one tick.
 *
 * The prefixes are pinned against their writers by source tripwires in
 * selectWhyState.test.js and buildTape.test.js: a reworded server string reds
 * a row rather than silently re-attributing a sentence.
 */
export const ENGINE_MOTIVE_PREFIXES = Object.freeze([
  'Guardrail override',
  'Risk manager:',
  'Deterministic guardrail enforcement',
]);

/**
 * The two `trades[].source` values under which the TEXT is the only reliable
 * answer, so the prefixes above decide alone:
 *
 *   `haiku`     the model wrote the rationale — UNLESS the cron overwrote it
 *               on a forced exit, which the prefixes catch.
 *   `guardrail` ambiguous by construction: a forced exit's rationale is the
 *               cron's sentence (a prefix), while a `reinforced_haiku` swap
 *               keeps the model's own argument under the same source.
 *
 * Every OTHER source composes its own sentence and is engine-authored whatever
 * the text looks like — `risk_manager`, `archetype`, and `gameplan_meeting`,
 * whose rotation rationale is a template with no fixed prefix at all
 * (`${sym} down ${pct}%, ${sym2} (${sector}) has tech score ${n}.`,
 * agent-evaluate.js ~4056). Listing the two EXCEPTIONS rather than the engine
 * sources is what keeps the default safe: a source added to the cron after
 * today is engine-authored here until someone deliberately says otherwise,
 * and under-crediting the agent is the smaller error under C1.
 */
export const TEXT_DECIDES_SOURCES = Object.freeze(['haiku', 'guardrail']);

/**
 * @param {string|null} text    the rationale
 * @param {string|null} [source] `trades[].source` where the caller has one.
 *   ABSENT on an `evaluations[]` entry — the panel and the check card read a
 *   record that carries no provenance field at all, so there the text is the
 *   only signal and is used alone.
 */
export function isEngineAuthoredMotive(text, source = null) {
  if (typeof text === 'string') {
    const trimmed = text.trimStart();
    if (ENGINE_MOTIVE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) return true;
  }
  if (source == null) return false;
  return !TEXT_DECIDES_SOURCES.includes(source);
}

const cleanText = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * The cron's provenance parenthetical, at the head of a forced exit's
 * rationale: `Guardrail override (guardrail_stopLoss): …`
 * (agent-evaluate.js:2121, composing agentGuardrails.js's own
 * `guardrail_${forcedType}` sourceNote).
 *
 * ANCHORED to the `Guardrail override` prefix, deliberately, rather than
 * matching any bracketed token anywhere in an engine sentence: that one
 * composition site is the only place a code is spliced into prose, and a
 * looser rule would eat the numbers the guardrail module's own statusMessage
 * carries — `… breached on GILD (-9.24%).` — or the `(R11)` the suppression
 * pass writes. The token shape is identifier-only for the same reason.
 */
const GUARDRAIL_CODE_PARENTHETICAL = /^(\s*Guardrail override)\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*\)/;

/**
 * The cron's composed prefix wrapping a body that already opens with the same
 * words (review RB-F2). Anchored, and it requires the SECOND `Guardrail
 * override` to start the body — so it only ever removes a duplicate, never a
 * sentence the guardrail wrote about something else.
 */
const GUARDRAIL_DOUBLED_PREFIX = /^(\s*Guardrail override\s*(?:\([^)]*\))?\s*:\s*)(Guardrail override\s*:)/;

/**
 * A motive as it is RENDERED (D-80, ruling 1) — the one place a rationale
 * becomes display text, so the trade card, the check card, `This piece today`
 * and the book panel cannot show one sentence two ways (BUILD_RULES §9).
 *
 * The model's own words pass through untouched (C1). An ENGINE-authored
 * sentence has its provenance parenthetical translated into the guardrail's
 * plain words, or dropped when the token has none — see
 * `BATTLE_VIEW_COPY.guardrailTypeWords` for why, and for where the three words
 * come from. Everything after the colon is the engine's sentence, verbatim.
 *
 * ONLY AN ENGINE MOTIVE IS REWRITTEN, and that is true BY CONSTRUCTION rather
 * than by a second conjunct: the pattern's anchor, `Guardrail override`, IS
 * `ENGINE_MOTIVE_PREFIXES[0]`, so any text the pattern can match is already
 * engine-authored under the rule above. An `isEngineAuthoredMotive` gate in
 * front of it could never fire — a conjunct that cannot fail is not a guard,
 * and this module does not ship one. `selectWhyState.test.js` pins the two
 * strings together so a rename of the prefix reds rather than silently
 * unhooking the translation.
 *
 * @param {string|null} text  the persisted rationale
 */
export function renderMotive(text) {
  const cleaned = cleanText(text);
  if (cleaned == null) return null;
  // THE CRON'S PREFIX IS REDUNDANT WHENEVER THE GUARDRAIL WROTE THE BODY
  // (review RB-F2). agent-evaluate.js:2121 composes
  // `Guardrail override (${sourceNote}): ${overrideNote}` — and on a forced
  // exit `overrideNote` IS agentGuardrails.js's own statusMessage, which
  // already begins `Guardrail override: ` and already carries the guardrail's
  // name in plain words (`stop-loss at 8%`, `trailing stop at 8% from peak`,
  // `profit target at 8%`, agentGuardrails.js:530-537). Translating the token
  // in place therefore produced a stutter on 100% of forced exits —
  // `Guardrail override (stop-loss): Guardrail override: stop-loss at 8%
  // breached on GILD …` — and D-84's first-sentence collapse then spent the
  // card on the preamble and hid `Forcing exit → MOS.` behind `Read more`.
  //
  // So when the body restates the prefix, the cron's wrapper goes and the
  // guardrail's own sentence stands alone. Still verbatim engine text, still
  // no code on the screen, and it is what ruling 1's `…` was eliding.
  const deduped = cleaned.replace(GUARDRAIL_DOUBLED_PREFIX, '$2');
  return deduped.replace(GUARDRAIL_CODE_PARENTHETICAL, (match, prefix, token) => {
    const words = COPY.guardrailTypeWords[token];
    return words ? `${prefix} (${words})` : prefix;
  });
}

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

  // The DISPLAY text (D-80) — and the authorship below is read from the RAW
  // field, not from this one. The translation preserves the `Guardrail
  // override` prefix in both of its branches, so the two agree today; deriving
  // "whose words" from a string this module has already rewritten is the
  // drift BUILD_RULES §9 exists to forbid, so it does not.
  const rationale = renderMotive(evaluation.rationale);

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

  // A guardrail-forced swap that EXECUTED is not downgraded, so it reaches the
  // ordinary SWAP and HOLD branches below carrying the cron's own sentence
  // (review L1-F3). Naming its author is the whole of the fix: the words are
  // still rendered verbatim, they are simply no longer implied to be the
  // agent's. `null` where the model wrote them — an author line on every
  // sentence would be noise.
  const footer = isEngineAuthoredMotive(evaluation.rationale) ? COPY.motiveSystem : null;

  if (evaluation.decision === 'SWAP') {
    const symbolOut = cleanText(evaluation.symbolOut);
    const symbolIn = cleanText(evaluation.symbolIn);
    return {
      ...base,
      kind: WHY_KIND.SWAPPED,
      label: COPY.swappedLabel(symbolOut, symbolIn),
      rationale,
      footer,
      symbolOut,
      symbolIn,
    };
  }

  // HOLD — and PROPOSAL, which held the position at the check pending an
  // approval the chat carries; the shipped launch mode is autopilot, so a
  // PROPOSAL entry is not reachable today (noted in the Phase A handover).
  return { ...base, kind: WHY_KIND.HELD, label: COPY.heldLabel, rationale, footer };
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
 * text. Requiring the trailing whitespace is what keeps `8.4%` and `-1.0x`
 * intact — a bare `[.!?]` split would cut a rationale mid-number, and these
 * paragraphs are full of numbers. Each piece is trimmed at its edges and
 * otherwise untouched: no re-punctuation, no capitalisation, no ellipsis.
 *
 * `U.S.` was named here as a third example and never was one: its final stop
 * IS followed by a space, so it splits, and it always did. Corrected rather
 * than left standing — a comment that claims a guarantee the code does not
 * give is worse than no comment (flip-prep item 3, found by the row that
 * tried to assert it). An abbreviation mid-sentence is a real limitation of
 * this rule and is recorded rather than papered over.
 *
 * EMPHASIS MARKERS ARE TRANSPARENT TO THE SPLIT (flip-prep item 3). The
 * boundaries are found on the text a READER sees and then mapped back onto the
 * raw string, so each piece keeps its own `**…**` intact. Splitting the raw
 * text directly made the markup decide the structure: `**It has stalled.**
 * MOS is breaking out.` has no boundary at all to the regex below, because the
 * full stop is followed by an asterisk rather than a space — so the whole
 * paragraph came back as one sentence, a record collapsed to all of itself
 * with no `Read more`, and a row's extract quietly widened to the lot. And
 * splitting the STRIPPED text instead would have thrown the emphasis away.
 * Markup may not move a word, an order, a mark — or a boundary.
 *
 * @returns {string[]} the sentences in order; [] for empty or non-text input
 */
export function splitSentences(text) {
  if (typeof text !== 'string' || !text.trim()) return [];

  // Where each VISIBLE character lives in the raw string. Markers occupy raw
  // positions and no visible one, so they simply never get an entry.
  const visible = [];
  const rawIndex = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '*' && text[i + 1] === '*') { i += 1; continue; }
    visible.push(text[i]);
    rawIndex.push(i);
  }
  const seen = visible.join('');
  if (!seen.trim()) return [];
  // One past the end, so a boundary at the very end maps to the whole tail —
  // including any unmatched trailing marker, which the renderer strips.
  rawIndex.push(text.length);

  // Spans run BOUNDARY to BOUNDARY in the raw string, not first-visible-char to
  // first-visible-char: a `**` that opens a sentence sits before that
  // sentence's first visible character, and starting the slice at the
  // character would orphan the marker — the pair would break and both halves
  // would lose the emphasis the model wrote.
  const out = [];
  const re = /[.!?]+(?=\s|$)/g;
  let rawStart = 0;
  const push = (visibleEnd) => {
    const rawEnd = rawIndex[visibleEnd];
    const piece = text.slice(rawStart, rawEnd).trim();
    if (piece) out.push(piece);
    rawStart = rawEnd;
  };
  let match = re.exec(seen);
  let lastVisibleEnd = 0;
  while (match !== null) {
    lastVisibleEnd = match.index + match[0].length;
    push(lastVisibleEnd);
    match = re.exec(seen);
  }
  if (lastVisibleEnd < seen.length) push(seen.length);
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
 * MARKDOWN EMPHASIS IN VERBATIM ENGINE TEXT (flip-prep item 3). PURE.
 *
 * `rationale` sometimes arrives with `**…**` around the model's inline
 * hypothesis — its own emphasis, written into the sentence it is emphasising.
 * Rendered raw, a player reads the asterisks; stripped silently, the model's
 * stress on a clause is lost. So the pairs RENDER and the strays GO.
 *
 * C1 IS THE WHOLE CONSTRAINT. This changes no word, no order and no
 * punctuation — only which characters are markup. The visible text of any
 * input is exactly the source minus its `**` markers, which is a property a
 * test can state as an equality rather than a sample.
 *
 * Pairing is left-to-right, which is what the model means by it: the first
 * `**` opens and the second closes. An ODD number leaves the last marker
 * unmatched and it is dropped — never rendered, and never allowed to
 * emphasise the rest of the paragraph, which is what a naive regex over an
 * unterminated pair does.
 *
 * @returns {Array<{ text: string, strong: boolean }>} in source order
 */
export function parseEmphasis(text) {
  if (typeof text !== 'string' || !text) return [];
  if (!text.includes('**')) return [{ text, strong: false }];
  const parts = text.split('**');
  const out = [];
  for (let i = 0; i < parts.length; i += 1) {
    // Odd parts sit between two markers — unless they are the LAST part, in
    // which case the marker that opened them was never closed.
    const strong = i % 2 === 1 && i < parts.length - 1;
    if (parts[i]) out.push({ text: parts[i], strong });
  }
  return out;
}

/**
 * The same text with its emphasis markers removed and nothing else changed —
 * what a reader SEES.
 *
 * NOTHING IN `src/` CALLS THIS TODAY (review L1-F12), and the docstring used
 * to claim it was "the one place any surface should ask what this says" — a
 * discipline nothing enforced. Kept, and honestly described, because the
 * matchers that DO ask that question (`namesSymbol` below, `scopeTape`'s
 * `checkNamesSymbol`) read the raw string and are right only because `*`
 * satisfies their word boundary: `namesSymbol('**SLB** is done', 'SLB')`
 * matches by the character class, not by design. The moment a marker lands
 * where that boundary does not forgive, this is the function to reach for.
 */
export function stripEmphasisMarkers(text) {
  if (typeof text !== 'string') return '';
  return parseEmphasis(text).map((seg) => seg.text).join('');
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
      rationale: renderMotive(t.rationale),
      // WHOSE WORDS (review L5-F2). `This piece today` renders the SAME field
      // the tape's trade card does; one rule, so the two cannot describe one
      // swap differently. Null where the model wrote them.
      footer: isEngineAuthoredMotive(t.rationale, t.source ?? null) ? COPY.motiveSystem : null,
    }))
    .sort((a, b) => (toMillis(a.at) ?? 0) - (toMillis(b.at) ?? 0));
}

export default selectWhyState;
