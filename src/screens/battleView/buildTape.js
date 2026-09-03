// src/screens/battleView/buildTape.js
//
// The tape — Phase A2 (A2.2, D-72, D-77). PURE.
//
// The chat becomes a record of the game: the messages it already carried, plus
// a card for every executed swap and a card for every decided check, in one
// chronological stream. Before A2.2 the conversation carried two of the five
// swap actions as a slim notification line and no checks at all, so "why a
// swap happened" left the screen with the Live Activity panel.
//
// ONE ARRAY, ONE SORT (seed §A2.2). This module builds the NON-MESSAGE entries
// from the subscribed doc; the chat merges them into its existing
// `combinedTimeline` and sorts once. There is no second list beside the chat.
//
// THE SPINE IS `trades[]` (D-72, ruling 5), not the feed. `trades[]` is the one
// list of EXECUTED swaps (agentSwapExecution.js), and it carries the three
// things a card needs that the feed entry does not have: `tier`, `lockedPoints`
// and `rationale`. The feed is joined only for the `↳ from directive` echo.
// Two consequences, both deliberate:
//
//   · All five swap actions appear. The shipped chat filtered the feed to
//     `swap | emergency_swap | trade_executed`, so VWAP exits, stepped-trail
//     exits and every guardrail exit were invisible (hazard 26).
//   · A guardrail-forced swap that did NOT execute gets no card (hazard 25).
//     The feed announces `guardrail_forced_swap` before the outcome is known;
//     `trades[]` only ever holds swaps that happened.
//
// THE MOTIVE IS `rationale`, AND ITS AUTHOR IS NAMED (ruling 5). On the risk
// loop, the guardrail path and the R11 pass, that text is the SYSTEM's
// sentence (`Risk manager: …`, `Guardrail override (…): …`, a statusMessage) —
// rendering it unlabelled would put the system's words in the agent's mouth
// (C1). The discriminator is `isEngineAuthoredMotive` in selectWhyState.js —
// THE TEXT, exactly as ruling 5 describes it, and the same rule the Why? panel
// and the check card use, so the tape cannot contradict itself about one tick.
// The text leads, because `source` records who chose the EXIT rather than who
// wrote the SENTENCE and is wrong in both directions on its own (review
// L1-F3 / L1-F4) — but `source` still rules out the writers whose sentence
// matches no prefix, and keeps the unknown-source default on the safe side
// (review FIX-1). See the helper for which sources let the text decide alone.
//
// `message` IS NEVER THE MOTIVE (hazard 24): the feed's `message` is the
// optional `status_feed_update`, null on a legal SWAP, and on a
// guardrail-forced swap it is the model's PRE-override line.
//
// THE MOTIVE'S TEXT IS RENDERED, NOT RAW (D-80). `renderMotive` translates the
// cron's `(guardrail_*)` provenance parenthetical into the guardrail's plain
// words, or drops it — the one place a rationale becomes display text, shared
// with the Why? panel so one sentence cannot be shown two ways.

import { toIso, toMillis } from '../../adapters/baggerbombAdapter';
import { selectWhyState, splitSentences, isEngineAuthoredMotive, renderMotive } from './selectWhyState';
import { directiveFilings } from './deriveReceipts';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

export const TAPE_KIND = Object.freeze({
  TRADE: 'trade',
  CHECK: 'check',
  CHECK_RUN: 'checkRun',
});

// Trims, exactly as selectWhyState's does (review FIX-3): `trades[].rationale`
// is rendered by BOTH the tape's card and the panel's `This piece today`, and
// both use `white-space: pre-wrap`, so one field trimmed on one surface and
// not the other is the same string rendered two ways — the disagreement class
// this module's own header claims to prevent.
const cleanText = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * The feed entry that belongs to a trade, for the `↳ from directive` echo.
 *
 * `evaluationId` first. The symbol pair is the fallback, because the risk loop
 * and the R11 pass write `evalId: null` (hazard 35) — and among several
 * entries with the same pair over a battle, the one NEAREST IN TIME to the
 * swap is the one that describes it (the shipped chat's last-wins map would
 * hand a second GILD → MOS rotation the first one's directive echo).
 */
function joinFeedEntry(trade, feedByEvalId, feedByPair) {
  const byId = trade.evaluationId ? feedByEvalId.get(trade.evaluationId) : null;
  if (byId) return byId;
  if (!trade.symbolOut || !trade.symbolIn) return null;
  const candidates = feedByPair.get(`${trade.symbolOut}__${trade.symbolIn}`);
  if (!candidates || candidates.length === 0) return null;
  const at = toMillis(trade.swappedOutAt);
  if (at == null) return candidates[0].entry;
  let best = candidates[0];
  for (const candidate of candidates) {
    if (Math.abs(candidate.ms - at) < Math.abs(best.ms - at)) best = candidate;
  }
  return best.entry;
}

/**
 * A trade card per executed swap.
 *
 * NOTHING from the DO-NOT list rides the entry (hazard 29, D-64): no
 * `pvpContext`, `hypothesis`, `conviction`, `trade_reasoning`, `citedRules`,
 * `regime`, `exitReason`, `source` or `triggeredBy`. What is not carried
 * cannot be rendered by accident later.
 */
export function buildTradeEntries(trades, statusFeed) {
  if (!Array.isArray(trades)) return [];

  const feedByEvalId = new Map();
  const feedByPair = new Map();
  if (Array.isArray(statusFeed)) {
    for (const entry of statusFeed) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.evalId && !feedByEvalId.has(entry.evalId)) feedByEvalId.set(entry.evalId, entry);
      if (entry.symbolOut && entry.symbolIn) {
        const key = `${entry.symbolOut}__${entry.symbolIn}`;
        const ms = toMillis(entry.timestamp) ?? 0;
        if (!feedByPair.has(key)) feedByPair.set(key, []);
        feedByPair.get(key).push({ entry, ms });
      }
    }
  }

  const entries = [];
  for (const trade of trades) {
    if (!trade || typeof trade !== 'object') continue;
    const at = toIso(trade.swappedOutAt);
    const ms = toMillis(at);
    if (ms == null) continue;
    const feed = joinFeedEntry(trade, feedByEvalId, feedByPair);
    const engineAuthored = isEngineAuthoredMotive(trade.rationale, trade.source ?? null);
    entries.push({
      _type: TAPE_KIND.TRADE,
      id: `tape-trade-${ms}-${trade.symbolOut ?? ''}-${trade.symbolIn ?? ''}`,
      timestamp: new Date(ms),
      at,
      symbolOut: cleanText(trade.symbolOut),
      symbolIn: cleanText(trade.symbolIn),
      tier: cleanText(trade.tier),
      lockedPoints: typeof trade.lockedPoints === 'number' && Number.isFinite(trade.lockedPoints)
        ? trade.lockedPoints
        : null,
      // The DISPLAY text (D-80): the engine's provenance parenthetical
      // translated or dropped, the model's own words untouched. Trimmed inside
      // `renderMotive` — the same trim `This piece today` applies to the same
      // field (review FIX-3), now in one place rather than two.
      motive: renderMotive(trade.rationale),
      // The first sentence, so a trade card collapses exactly as a check card
      // does (D-84): an engine RECORD shows one sentence and a `Read more`,
      // never a wall of prose in the middle of a conversation. Split from the
      // rendered text, so the door opens on the sentence the card shows.
      motiveFirstSentence: splitSentences(renderMotive(trade.rationale))[0] ?? null,
      // The author of the motive — the footer, not the text.
      motiveIsAgent: !engineAuthored,
      // The model's own echo of the directive it was acting on, on the feed
      // entry for this swap. The receipt vocabulary's `Acted` (D-51) — it
      // claims the USER'S DIRECTIVE produced this swap.
      //
      // Withheld when the engine wrote the motive (review L1-F5): on a
      // guardrail-forced tick the feed's `swap` entry keeps the model's
      // PRE-override `directiveThreadId` while the pair is the guardrail's
      // (agent-evaluate.js ~2116-2124 preserves it through the rewrite), so
      // the echo would credit the user's directive with a swap the guardrail
      // chose.
      fromDirective: Boolean(feed?.directiveThreadId) && !engineAuthored,
    });
  }
  return entries;
}

/**
 * A check card per decided check, from `evaluations[]`.
 *
 * The label comes from selectWhyState — the SAME five-state selector the Why?
 * panel renders from, so a check card and the panel cannot disagree about a
 * tick (BUILD_RULES §9). It is called with the entry's OWN timestamp as the
 * scoring stamp: the `>=` join exists to tell the LATEST check from a stale
 * one, and every entry here is the latest check of its own moment.
 *
 * `quiet` and `runKey` carry the D-77 test for a collapsible run; the fold
 * itself happens later, on the merged stream, where contiguity is knowable.
 */
export function buildCheckEntries(evaluations, receipts, chatExchanges) {
  if (!Array.isArray(evaluations)) return [];

  // WHICH DIRECTIVE WAS CURRENT AT AN INSTANT — the receipts' own walk of the
  // exchanges (D-77: "receipts unchanged"), never a second copy of the rule.
  const filings = directiveFilings(chatExchanges).map((f) => ({ ...f, ms: toMillis(f.at) }));
  const dispositionAt = (ms) => {
    let current = null;
    for (const filing of filings) {
      if (filing.ms == null || filing.ms > ms) break;
      current = filing.threadId;
    }
    if (!current) return '';
    return `${current}:${receipts?.[current]?.state ?? ''}`;
  };

  const entries = [];
  for (const evaluation of evaluations) {
    if (!evaluation || typeof evaluation !== 'object') continue;
    const at = toIso(evaluation.timestamp);
    const ms = toMillis(at);
    if (ms == null) continue;
    const state = selectWhyState(evaluation, null, at);
    const rationale = state.rationale;

    // D-77 — the four facts ON THE ENTRY that make a check "no change". The
    // fifth and sixth (positions, receipts) are the run key and contiguity.
    // The live `total` is deliberately NOT among them: it moves with price on
    // nearly every tick, and the board already shows it.
    const quiet = evaluation.decision === 'HOLD'
      && evaluation.downgraded !== true
      && !evaluation.haikuError;

    entries.push({
      _type: TAPE_KIND.CHECK,
      id: `tape-check-${evaluation.evalId || ms}`,
      timestamp: new Date(ms),
      at,
      kind: state.kind,
      label: state.label,
      // WHOSE WORDS (review L5-F2). The check card renders the same rationale
      // the trade card does; without this it was the one surface of the three
      // that showed an engine-authored sentence unlabelled.
      footer: state.footer,
      triggers: state.triggers,
      rationale,
      firstSentence: splitSentences(rationale)[0] ?? null,
      quiet,
      // THE RUN KEY IS ALSO WHAT THE CARD WOULD SAY (review L1-F6, refuter A:
      // CONFIRMED, and the NORMAL case rather than an edge one). D-77's
      // conjuncts are about the DATA; a collapsed line also has to be honest
      // about the DISPLAY it replaces. Every entry carries at least one
      // trigger — the cron only writes one when `shouldEvaluate` is true — and
      // exactly one type has a ruled string, so adjacent quiet checks
      // routinely differ in what their cards render while agreeing on every
      // data conjunct. Folding those two together deleted a line the player
      // was shown. Two checks may only become one line when they would have
      // rendered the same line.
      runKey: `${evaluation.scores?.banked ?? ''}|${dispositionAt(ms)}|${COPY.wokenBy(state.triggers) ?? ''}`,
    });
  }
  return entries;
}

/**
 * The non-message half of the tape: trade cards and check cards, unsorted (the
 * chat sorts the merged stream once).
 */
export function buildTape({ trades, statusFeed, evaluations, receipts, chatExchanges }) {
  return [
    ...buildTradeEntries(trades, statusFeed),
    ...buildCheckEntries(evaluations, receipts, chatExchanges),
  ];
}

/**
 * Fold runs of quiet checks into `{n} checks · no change` (D-48 / D-77).
 *
 * Runs over the SORTED, MERGED stream, and only over entries that are ADJACENT
 * in it. That is what makes "the position set unchanged" true by construction:
 * every executed swap is a trade card in this same stream, so a swap between
 * two checks breaks their adjacency. It is also the only ordering that can
 * work — a collapsed card occupies one slot, so it may only ever stand for a
 * contiguous slice of the tape.
 *
 * A run of one is left as the card it is; two or more become one line.
 */
export const MIN_RUN = 2;

export function collapseQuietChecks(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const out = [];
  let run = [];

  const flush = () => {
    if (run.length === 0) return;
    if (run.length >= MIN_RUN) {
      out.push({
        _type: TAPE_KIND.CHECK_RUN,
        id: `tape-run-${run[0].id}`,
        timestamp: run[0].timestamp,
        at: run[0].at,
        count: run.length,
      });
    } else {
      out.push(...run);
    }
    run = [];
  };

  for (const item of items) {
    const joins = item?._type === TAPE_KIND.CHECK
      && item.quiet
      && (run.length === 0 || run[run.length - 1].runKey === item.runKey);
    if (joins) {
      run.push(item);
      continue;
    }
    flush();
    // A quiet check whose run key DIFFERS from the run it just broke starts
    // the next run rather than standing alone.
    if (item?._type === TAPE_KIND.CHECK && item.quiet) run.push(item);
    else out.push(item);
  }
  flush();
  return out;
}

export default buildTape;
