// src/screens/battleView/scopeTape.js
//
// THE PIECE SCOPE — Phase A2 (A2.3, D-73). PURE.
//
// `In the chat · {n}` on a piece's Why? panel, and the filtered tape that
// number opens. ONE function answers both — `countMentions` is
// `scopeTape(...).length`, not a second count — so the two cannot drift as
// rules (BUILD_RULES §9).
//
// THEY CAN DIFFER BY ONE INPUT, AND ONLY ONE (review L1-F6 / L5-F4): the
// screen counts the RECORDED stream (`mergeRecordedTape` below), while the
// chat filters that stream plus its own optimistic in-flight bubbles. For the
// few hundred milliseconds between a send and the server's write, the door
// says n and opens onto n+1. That is the honest direction — `In the chat`
// counts what the battle recorded, and a request still in flight has recorded
// nothing — but it is a difference, and this header does not claim otherwise.
//
// THREE RULES, ONE PER KIND, each the rule that already governs its own
// surface (rulings §3, A2.3):
//
//   messages    the DETECTOR (findKnownTickers.js) — roster membership, the
//               same scan that decides what the chat underlines. A message
//               "names NVDA" exactly when the player can see NVDA underlined
//               in it.
//   trade cards the PAIR. A swap out of or into the piece is about the piece;
//               its motive is prose the model wrote about a rotation, and
//               matching on it would count the name it rotated INTO as well.
//   check cards the EXCERPT, under `namesSymbol` (selectWhyState.js) — the
//               same rule the Why? panel uses to pull the sentences that name
//               a piece out of a rationale. The excerpt, not the whole
//               paragraph, because the excerpt is what the card shows (D-84):
//               a check whose ninth sentence mentions NVDA does not read as a
//               check about NVDA, and counting it would send the player to a
//               card that appears to say nothing about their piece.
//
// The two symbol rules are deliberately not merged — see findKnownTickers.js
// for why, and for the review that measured them.
//
// A COLLAPSED RUN NEVER SCOPES. `{n} checks · no change` stands for a
// contiguous slice of the whole tape; a filtered tape has different
// adjacency, so a run built for one is meaningless in the other. Scoping
// therefore runs over the UNFOLDED entries and shows the individual cards —
// which is also the honest answer, because a folded run displays no text at
// all and so names no piece.
//
// DISPLAY ONLY. Nothing here is sent, nothing is persisted, and the composer
// prefill is untouched (the existing `About NVDA — `).

import { findKnownTickers } from '../../utils/findKnownTickers';
import { namesSymbol } from './selectWhyState';
import { TAPE_KIND } from './buildTape';

/**
 * The `_type` the chat's merge stamps on a message item (AgentChat's
 * `combinedTimeline`). Named here because the predicate below dispatches on
 * it and a mismatch would silently make every message unscopeable; a tripwire
 * in scopeTape.test.js reads AgentChat's source to keep the two in step.
 */
export const TAPE_MESSAGE = 'message';

/** A message item (or a raw exchange half): the detector's question. */
export function messageNamesSymbol(item, symbol, knownTickers) {
  if (!symbol) return false;
  if (findKnownTickers(item?.text, knownTickers).includes(symbol)) return true;
  // A directive card rides its agent message; the directive's own text is
  // part of what that message says about a piece.
  return findKnownTickers(item?.directive?.text, knownTickers).includes(symbol);
}

/** A trade card: the pair, either side. */
export function tradeNamesSymbol(entry, symbol) {
  if (!symbol) return false;
  return entry?.symbolOut === symbol || entry?.symbolIn === symbol;
}

/** A check card: the excerpt the card actually shows. */
export function checkNamesSymbol(entry, symbol) {
  if (!symbol) return false;
  return namesSymbol(entry?.firstSentence, symbol);
}

/**
 * Whether one item of the merged, UNFOLDED stream is about `symbol`.
 *
 * An item of a kind the scope has no rule for — a collapsed run, anything a
 * later phase adds — answers false rather than guessing, so a new kind cannot
 * silently start counting.
 */
export function tapeItemNamesSymbol(item, symbol, knownTickers) {
  if (!item || !symbol) return false;
  if (item._type === TAPE_KIND.TRADE) return tradeNamesSymbol(item, symbol);
  if (item._type === TAPE_KIND.CHECK) return checkNamesSymbol(item, symbol);
  if (item._type === TAPE_MESSAGE) return messageNamesSymbol(item, symbol, knownTickers);
  // A collapsed run shows no text, so it names no piece; and a kind this
  // phase has never seen answers false rather than being guessed at as a
  // message — a new kind must be given a rule, not inherit one.
  return false;
}

/**
 * The tape, filtered to one piece.
 *
 * @param {Array} items          the merged, unfolded stream
 * @param {string|null} symbol   the tapped piece; null → the whole tape
 * @param {Set<string>|null} knownTickers  the battle's roster
 */
export function scopeTape(items, symbol, knownTickers) {
  if (!Array.isArray(items)) return [];
  if (!symbol) return items;
  return items.filter((item) => tapeItemNamesSymbol(item, symbol, knownTickers));
}

/**
 * `n` — and it is the LENGTH OF THE SCOPED LIST, never a second count. Zero is
 * a real answer: the door still renders `In the chat · 0` and opens the
 * unscoped tape at the piece's composer prefill (seed §A2.3).
 */
export function countMentions(items, symbol, knownTickers) {
  return scopeTape(items, symbol, knownTickers).length;
}

/**
 * The merged, UNFOLDED stream over the persisted record — the input the count
 * takes on the screen, where the chat's optimistic in-flight bubbles do not
 * exist. One concat, one sort, exactly as the chat's own merge does it
 * (AgentChat's `combinedTimeline`), so the two orders cannot differ.
 *
 * A message the player has just sent and the server has not yet written is in
 * the chat's stream and not in this one. That is deliberate and it is the
 * honest reading of the number: `In the chat · {n}` counts what the battle
 * RECORDED, and a request still in flight has recorded nothing.
 */
export function mergeRecordedTape(messages, tapeEntries) {
  const items = [
    ...(Array.isArray(messages) ? messages : []).map((m) => ({
      ...m,
      _type: TAPE_MESSAGE,
      timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp || 0),
    })),
    ...(Array.isArray(tapeEntries) ? tapeEntries : []),
  ];
  return items.sort((a, b) => {
    const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
    const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
    return timeA - timeB;
  });
}

export default scopeTape;
