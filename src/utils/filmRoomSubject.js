// src/utils/filmRoomSubject.js
//
// Film Room C2 (Build C spec §5, §6; Amendment C CC-2, CC-7) — WHAT THE EXCERPT AND THE SCREEN SAY OF A MOMENT'S
// SUBJECT, from ONE pure module both import, so the agent's excerpt and the player's receipt never say different
// things (BUILD_RULES §9):
//   the SECTOR    the symbol directory's one word for a symbol (`TICKER_TO_SECTOR`, api/_utils/rankingConfig.js — the
//                 directory candleInputs.js reads, and screen code already imports): the sector's id, e.g. `XLK`.
//                 A symbol the directory lacks has no sector — none is guessed.
//   a QUOTED TEXT bounded in code points (astral characters counted once): a text over its bound is not carried at all
//                 — never cut, never rewritten — as the tape's writer leaves a meeting's diagnosis over its bound uncopied.
//                 The idea's statement is bounded at IDEA_STATEMENT_MAX here, so the excerpt and the screen hold the same
//                 statement or none.
//
// Node-clean (BUILD_RULES §4): api/_utils/filmRoom/momentExcerpt.js imports it; its own test's import is the
// dependency-surface guard.

import { TICKER_TO_SECTOR } from '../../api/_utils/rankingConfig.js';

/** CC-2: the idea's statement, at most 280 code points. */
export const IDEA_STATEMENT_MAX = 280;

/** A text's length in code points — an astral character counts once. */
export const codePointsOf = (s) => [...String(s)].length;

/** `v` when it is a non-empty string of at most `max` code points; null otherwise (over the bound: not carried, never cut). */
export function boundedText(v, max) {
  return typeof v === 'string' && v.length > 0 && codePointsOf(v) <= max ? v : null;
}

/** The directory's one word for `symbol`'s sector — its sector id — or null when the directory lacks the symbol. */
export function sectorOf(symbol) {
  if (typeof symbol !== 'string' || !symbol || !Object.prototype.hasOwnProperty.call(TICKER_TO_SECTOR, symbol)) return null;
  const id = TICKER_TO_SECTOR[symbol];
  return typeof id === 'string' && /^\S+$/.test(id) ? id : null;
}
