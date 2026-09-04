// src/screens/battleView/derivePeekLine.js
//
// THE NEWEST THING THAT HAPPENED, in one line — Phase A2 (A2.4, D-74). PURE.
//
// The peek strip carries the turn line and then this: the newest entry of the
// tape, as one line the reader can take in without opening anything. On a
// phone it is what the sheet shows at peek; on the desktop it is what the
// board column shows where the chat used to be.
//
// ONE SHAPE FOR EVERY KIND — `{time} · {what}` — composed from the strings
// those kinds already use, never from a new one:
//
//   Filed 3:50 PM · Widen the spread   a directive (COPY.filed + its text)
//   3:45 PM · Held                     a check (its slot + the Why? label)
//   1:31 PM · GILD → MOS               a trade (COPY.tradeLine)
//   3 checks · no change               a folded run — NO time: its `at` is the
//                                      run's FIRST member and the card it
//                                      stands for shows no time either
//   3:52 PM · I'd hold the energy slot a message, the speaker's own words
//
// A CHECK IS NAMED BY ITS SLOT here as everywhere (D-83); a trade keeps its
// exact minute, because a swap executes at an instant.
//
// TRUNCATION IS THE STRIP'S, NOT THIS MODULE'S. The line is returned whole and
// the component clips it with `text-overflow: ellipsis` — a string cut here
// would put an ellipsis the copy rules never ruled into the middle of the
// agent's own words, and would cut at a character count rather than at the
// width the reader actually has.

import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { TAPE_KIND, collapseQuietChecks } from './buildTape';
import { slotLabel } from './deriveTurnLine';
import { etTime } from '../../components/Dashboard/desk/deskCopy';
import { TAPE_MESSAGE } from './scopeTape';

/** `{time} · {what}`, or nothing when either half is missing. */
const line = (time, what) => {
  const w = typeof what === 'string' ? what.trim() : '';
  if (!w) return null;
  return time ? `${time} · ${w}` : w;
};

/** The instant an item carries, whichever shape it is in. */
function atOf(item) {
  if (item?.at) return item.at;
  // An Invalid Date is still `instanceof Date` and throws on `toISOString`
  // (review L2-F12). Unreachable through `deriveChatMessages`, which
  // normalises every stamp to a finite number — but `mergeRecordedTape` can
  // manufacture one from any other caller, and a strip is not worth a crash.
  if (item?.timestamp instanceof Date) {
    return Number.isFinite(item.timestamp.getTime()) ? item.timestamp.toISOString() : null;
  }
  if (item?.timestamp != null) return item.timestamp;
  return null;
}

/**
 * One tape item as the peek line's sentence.
 *
 * @returns {string|null} null for an item with nothing to say
 */
export function peekLineFor(item) {
  if (!item || typeof item !== 'object') return null;
  const at = atOf(item);

  if (item._type === TAPE_KIND.TRADE) {
    return COPY.tradeLine(at, item.symbolOut, item.symbolIn);
  }
  if (item._type === TAPE_KIND.CHECK) {
    return line(slotLabel(at), item.label);
  }
  if (item._type === TAPE_KIND.CHECK_RUN) {
    // NO TIME (review L1-F4 / L5-F3). A run's `at` is its FIRST member's — the
    // sort position `collapseQuietChecks` needs — so stamping the line with it
    // named the OLDEST check in the run while the turn line directly above
    // named the newest. The card the run stands for renders no time either
    // (TapeCards.CheckRunLine), so the strip now says exactly what the stream
    // says, which is the whole point of folding first (BUILD_RULES §9).
    return COPY.checksNoChange(item.count);
  }
  if (item._type === TAPE_MESSAGE) {
    // A directive is the one message whose LINE is its directive, not its
    // prose: `Filed 3:50 PM · Widen the spread` is the receipt vocabulary
    // (D-51) and the thing the player actually did.
    if (item.hasDirective && item.directive?.text) {
      return line(COPY.filed(at), item.directive.text);
    }
    return line(etTime(at), item.text);
  }
  return null;
}

/**
 * The peek line for a merged, UNFOLDED stream.
 *
 * Folds first, so the line the strip shows is the line the stream shows: a run
 * of quiet checks reads `3 checks · no change` in both places rather than the
 * strip naming the last of them (BUILD_RULES §9).
 *
 * Walks BACKWARDS past anything with nothing to say — an exchange whose
 * agentResponse never landed, a card with no words — rather than showing a
 * blank strip while the tape plainly has entries.
 *
 * @param {Array|null} items  the merged, unfolded stream
 * @param {string|null} pinnedId  the check the reader has open (D-89), which
 *   the stream does not fold — so the strip must not fold it either
 * @returns {string|null} null when the tape is empty
 */
export function derivePeekLine(items, pinnedId = null) {
  if (!Array.isArray(items) || items.length === 0) return null;
  // THE SAME PIN THE STREAM FOLDS WITH (review L5-F4 / L1-F10). D-89 lets one
  // check stand out of its run, and this function's whole promise — the line
  // the strip shows is the line the stream shows — is void if the two fold
  // differently. The pinned check is by construction the newest one, so the
  // disagreement was the ordinary case for any quiet tick, not an edge one:
  // the strip said `3 checks · no change` while the stream showed a run of two
  // and a card. And `openCheck` is never cleared, so it lasted the mount.
  const folded = collapseQuietChecks(items, pinnedId);
  for (let i = folded.length - 1; i >= 0; i -= 1) {
    const text = peekLineFor(folded[i]);
    if (text) return text;
  }
  return null;
}

export default derivePeekLine;
