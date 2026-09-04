// src/screens/battleView/useBaggerMoment.js
//
// A3.6 — the bagger moment's session state (D-97).
//
// The derivation is pure and lives in deriveBaggerMoment.js; this holds the two
// things a pure function cannot: what the reader has already seen, and how long
// each half of the moment lasts.
//
// TWO LIFETIMES, NOT ONE. They are different kinds of thing and the seed treats
// them as such:
//   • THE BURST is motion. It marks the event and stops — BAGGER_BURST_MS, then
//     still, forever (D-97: "motion marks events, never states").
//   • THE BUBBLE is the character telling you. It waits until you have read it,
//     which is exactly what the unread bubble beside it does: it clears when the
//     pane opens, by the same act that clears the count.
// The FOOTER is neither — it is a fact about persisted scoring, so it is derived
// per row from the doc and is not held here at all. A line that says `banked`
// must not depend on whether this browser tab happened to be open when the tick
// landed.
//
// SEEDED, NEVER FIRED ON MOUNT (the useLandingKey idiom, landing.js:64-95). The
// first pass records where every piece already stands and announces nothing.
// This is also why a reload cannot re-announce yesterday's bagger.
//
// HAZARD 44: the hook is unconditional. `enabled` gates the WORK, never the
// call — and disabling RESETS the seed, so re-enabling seeds again rather than
// comparing against a map from another lifetime.

import { useEffect, useRef, useState } from 'react';
import { deriveBaggerCrossings } from './deriveBaggerMoment';

/**
 * The burst's whole life, in ms. The seed's ceiling is 700; this is that
 * ceiling, and the burst is a one-shot inside it, not a loop.
 */
export const BAGGER_BURST_MS = 700;

/**
 * @param {boolean} enabled  the pane flag. Disabled, nothing is watched and the
 *   seed is dropped.
 * @param {object|null} battle  the subscribed doc.
 * @param {Array} book  the pieces the player HOLDS, in row order. Memoise it at
 *   the call site: a fresh array every render re-runs the compare, which is
 *   harmless (no crossing, no state change) but pointless.
 * @param {{paneOpen?: boolean}} opts
 * @returns {{burst: Set<string>, bubbleSymbol: string|null, seq: number}}
 *   `burst` holds the symbols mid-burst; `bubbleSymbol` is the one the
 *   character is speaking about; `seq` rises once per announcement, so a
 *   consumer can key a one-shot on it.
 */
export function useBaggerMoment(enabled, battle, book, { paneOpen = false } = {}) {
  const seenRef = useRef(null);
  const seqRef = useRef(0);
  const [burst, setBurst] = useState(null);        // {symbols: string[], seq}
  const [bubble, setBubble] = useState(null);      // {symbol, seq}

  useEffect(() => {
    if (!enabled) {
      // Dropping the seed matters: a flag that goes off and on again must not
      // compare today's doc against a map remembered from before.
      seenRef.current = null;
      return;
    }
    // NOT UNTIL THERE IS A DOC TO SEED FROM (review lens 1, P1).
    //
    // This hook is called ABOVE the screen's `loading` early return — it has to
    // be, hooks are unconditional — so its first run happens on the paint where
    // `useAgentBattle` still has `{battle: null, loading: true}`. Seeding there
    // read 0 for every piece (a missing doc has no history), and the very next
    // render — the one where the doc lands — then compared 0 against a peak
    // that had been sitting in Firestore for hours and announced it as a fresh
    // crossing. Every already-banked piece burst, and the character spoke a
    // line about a crossing that happened before the player opened the app:
    // exactly the "never on mount" this file exists to guarantee, broken on the
    // ordinary path, on every load.
    //
    // THE BOOK IS A SECOND DOOR TO THE SAME DEFECT, and it is shut here too.
    // `playerPortfolioSource` falls back to the PROP's portfolio while the doc
    // loads, so the book is normally full on that first paint — but the reverse
    // ordering (doc first, portfolio a render later) would seed an EMPTY map,
    // and an unseen symbol enters at 0 by design, for the swapped-in case. So
    // every piece arriving after such a seed would announce.
    //
    // The precise condition is not "is there a book" but "is there anything to
    // remember": seed only once the derive has produced at least one entry.
    // Waiting costs nothing — with no doc and no pieces there is, by
    // definition, nothing to announce — and `seenRef` stays null, so the first
    // pass that HAS both is the seed.
    if (!battle) return;
    const { crossed, next } = deriveBaggerCrossings(seenRef.current, battle, book);
    if (seenRef.current === null && Object.keys(next).length === 0) return;
    seenRef.current = next;
    if (crossed.length === 0) return;
    seqRef.current += 1;
    const seq = seqRef.current;
    // A SECOND CROSSING JOINS THE FIRST, it does not replace it (review lens 1).
    // The previous shape set the new symbols alone, so a crossing landing
    // inside an open window silently cut the first symbol's burst short — the
    // opposite of what the timer's guard below was written to protect. The
    // union restarts one window for both, which is the behaviour the comment
    // there always claimed.
    setBurst((prev) => ({
      symbols: prev ? [...new Set([...prev.symbols, ...crossed])] : crossed,
      seq,
    }));
    // NOT WHILE THE PANE IS OPEN. The mark is not on the board then, so the
    // bubble would be invisible — and setting it anyway would leave a stale one
    // waiting to appear on the next collapse. Two pieces crossing on one tick
    // both burst; the character names the FIRST in book order, because the
    // ruled string names one symbol and inventing a plural of it is not a
    // ruling this session has.
    if (!paneOpen) setBubble({ symbol: crossed[0], seq });
  // `paneOpen` is deliberately NOT a dependency: it is read at announcement
  // time, and re-running this effect when the pane opens would compare an
  // unchanged doc for no reason.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, battle, book]);

  // The burst ends. The `seq` check is belt-and-braces: the effect's cleanup
  // already clears the timer whenever `burst` changes, so the captured `seq`
  // and the current one cannot differ by the time this runs. It is kept because
  // it costs nothing and states the intent — but it is NOT what stops a second
  // crossing being cut short. The union above is.
  useEffect(() => {
    if (!burst) return undefined;
    const id = setTimeout(() => {
      setBurst((b) => (b && b.seq === burst.seq ? null : b));
    }, BAGGER_BURST_MS);
    return () => clearTimeout(id);
  }, [burst]);

  // Opening the pane is reading it — the same act that clears the unread count.
  useEffect(() => {
    if (paneOpen) setBubble(null);
  }, [paneOpen]);

  return {
    burst: burst ? new Set(burst.symbols) : EMPTY_SET,
    bubbleSymbol: bubble ? bubble.symbol : null,
    seq: bubble ? bubble.seq : 0,
  };
}

/** One frozen empty set, so "no burst" is a stable reference across renders. */
const EMPTY_SET = new Set();

export default useBaggerMoment;
