// src/screens/battleView/deriveBubble.js
//
// THE CHARACTER'S ONE LINE — Phase A3 (A3.1, D-98). PURE.
//
// The avatar speaks when the tape gains an entry, and what it says is the
// NEWEST entry of that tape, in two slots: a kind eyebrow and one line.
//
// THE BUBBLE NEVER COMPOSES TEXT (the seed's DO-NOT). Every string this module
// returns comes WHOLE out of a helper the stream already renders — nothing is
// concatenated here, and no new sentence exists. That is not tidiness: the
// bubble is a MIRROR of the tape (brief §4.2), and a mirror that rephrases is
// not one. Concretely:
//
//   a check      eyebrow COPY.checkCardLabel(at, label)   — the check CARD's own
//                line    entry.firstSentence              — the sentence the card shows
//   a trade      eyebrow COPY.tradeCardLine(…)            — the trade CARD's own
//                line    entry.firstSentence
//   a quiet run  eyebrow —                                 (the run has no kind word)
//                line    COPY.checksNoChange(count)       — the run LINE's own words
//   a directive  eyebrow COPY.directiveEyebrow
//                line    peekLineFor(item)                — `Filed {t} · {text}` (D-51)
//   speech       eyebrow COPY.tapeKindEyebrow(…)          — Opener / Bench note / …
//                line    item.text                        — the character's own words
//
// THE COLOUR IS THE STREAM'S COLOUR (D-98, hazard 43). `eyebrowColor` is read
// from TapeCards' own LABEL_COLOR map for a check, its own teal for a trade, and
// `text-muted` for speech — imported, not copied, so the bubble and the card can
// never come to disagree about what colour a kind is. The chat's speech
// eyebrows are already `text-muted` (AgentChat.jsx:302), which is what the
// speech branch returns, so the agreement holds on both sides of the stream
// without a second change.
//
// TRUNCATION IS THE COMPONENT'S. The line comes back whole and CSS clips it, for
// the reason derivePeekLine gives: a cut here would put an ellipsis nobody ruled
// into the middle of the agent's own words, at a character count rather than at
// the width the reader actually has.
//
// NO TIMER CAN REACH THIS FUNCTION. It takes the tape and returns a value; the
// only thing that can change its answer is a new entry in that tape.

import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { TAPE_KIND } from './buildTape';
import { TAPE_MESSAGE } from './scopeTape';
import {
  LABEL_COLOR,
  TRADE_EYEBROW_COLOR,
  DIRECTIVE_EYEBROW_COLOR,
  SPEECH_EYEBROW_COLOR,
} from './TapeCards';
import { peekLineFor } from './derivePeekLine';

/**
 * One tape item as the bubble's two slots.
 *
 * @returns {{eyebrow: string|null, line: string, eyebrowColor: string, isRecord: boolean}|null}
 *   null for an item with nothing to say — the caller walks past it.
 */
export function bubbleFor(item) {
  if (!item || typeof item !== 'object') return null;

  if (item._type === TAPE_KIND.CHECK) {
    const line = item.firstSentence || peekLineFor(item);
    if (!line) return null;
    return {
      eyebrow: COPY.checkCardLabel(item.at, item.label),
      line,
      eyebrowColor: LABEL_COLOR[item.kind] || SPEECH_EYEBROW_COLOR,
      isRecord: true,
    };
  }

  if (item._type === TAPE_KIND.TRADE) {
    const line = item.firstSentence || peekLineFor(item);
    if (!line) return null;
    return {
      eyebrow: COPY.tradeCardLine(item.at, item.symbolOut, item.symbolIn, item.tier),
      line,
      eyebrowColor: TRADE_EYEBROW_COLOR,
      isRecord: true,
    };
  }

  if (item._type === TAPE_KIND.CHECK_RUN) {
    // A run has no kind word of its own — the stream renders it as ONE line and
    // nothing else (TapeCards.CheckRunLine), so the bubble does too. Giving it
    // an invented eyebrow would be the composition this module refuses.
    const line = COPY.checksNoChange(item.count);
    return { eyebrow: null, line, eyebrowColor: SPEECH_EYEBROW_COLOR, isRecord: true };
  }

  if (item._type === TAPE_MESSAGE) {
    // THE PLAYER'S OWN MESSAGES ARE NOT THE CHARACTER'S SPEECH. They are tape
    // entries and they count toward unread, but a bubble beside the AGENT
    // showing the PLAYER's words reads as the agent saying them — the exact
    // provenance error the kind eyebrows exist to prevent (brief §4.5). The
    // walk in deriveBubble steps past them to the newest thing the character
    // actually said.
    if (item.role === 'user') return null;

    if (item.hasDirective && item.directive?.text) {
      const line = peekLineFor(item);
      if (!line) return null;
      return {
        eyebrow: COPY.directiveEyebrow,
        line,
        eyebrowColor: DIRECTIVE_EYEBROW_COLOR,
        isRecord: true,
      };
    }
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (!text) return null;
    return {
      // The underscore fields are deriveChatMessages' own (`_hasUserHalf`,
      // `_anticipationDirection`) — the same two the chat's eyebrow reads, so
      // one exchange cannot be labelled two ways.
      eyebrow: COPY.tapeKindEyebrow(item.messageType, item._hasUserHalf, item._anticipationDirection ?? null),
      line: text,
      eyebrowColor: SPEECH_EYEBROW_COLOR,
      isRecord: false,
    };
  }

  return null;
}

/**
 * The bubble for a merged, UNFOLDED stream — the newest entry that has
 * something to say.
 *
 * Walks BACKWARDS past anything silent (an exchange whose answer never landed,
 * a check whose words moved to the trade card in the same tick), exactly as
 * derivePeekLine does, rather than showing an empty bubble while the tape
 * plainly has entries.
 *
 * The returned `id` is the ENTRY's id, which is what keys the one-shot fade: the
 * bubble animates once when a genuinely new entry arrives and then sits still,
 * through any number of re-renders (D-97 — motion marks events, never states).
 *
 * @param {Array|null} items  the merged, unfolded recorded tape
 * @returns {{id: string, eyebrow: string|null, line: string, eyebrowColor: string, isRecord: boolean}|null}
 */
export function deriveBubble(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    const bubble = bubbleFor(item);
    if (bubble) return { id: item.id ?? String(i), ...bubble };
  }
  return null;
}

export default deriveBubble;
