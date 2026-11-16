// api/_utils/practiceField/sessions.js
//
// Practice Field T1a-2a — THE ORDER OF SESSIONS (Amendment E12; review RH-1, RH-2). One rule, held in one place:
//
//   NOTHING MOVES PAST AN UNCLOSED SESSION. A book's sessions are closed in calendar order, and no fill — an entry
//   or a sale — may be dated in a session while an earlier one is still unclosed, or in a session whose close has
//   already been written.
//
// Why it must be a rule and not a habit: a missed close is an ordinary event (the mode was off, the close snapshot
// was not built, a run failed). If a window then filled before the missed session was closed, the later catch-up
// would close that PAST session from the book's PRESENT state: a row showing shares the idea had already sold, a
// line read on a session before the idea had entered, an endpoint dated the day before the sale that emptied it.
// So the window pass catches every missed session up FIRST (sweep.js), and each fill's own transaction refuses to
// run otherwise (entry.js, exits.js) — the second is the guard, the first is what makes it rarely needed.
//
// Pure: no store, no clock.

import { nextSessionDate } from './windows.js';
import { WINDOWS_ACCOUNTED_FIELD } from './windowLedger.js';

const lastClosedOf = (book) => (typeof book?.execState?.lastCloseKey === 'string' ? book.execState.lastCloseKey : null);

/**
 * The first trading session this book has not closed that lies BEFORE `date`, or null. With a last closed date it is
 * the session after it; a book that has never closed starts at the first session any of its open ideas filled in
 * (before that it held nothing to value).
 */
export function firstUnclosedSessionBefore(book, ideas, date) {
  const last = lastClosedOf(book);
  let from;
  if (last !== null) from = nextSessionDate(last);
  else from = (ideas || []).map((i) => i?.entry?.sessionDate).filter((d) => typeof d === 'string').sort()[0] ?? null;
  return from !== null && from < date ? from : null;
}

/** The reasons a fill dated in a session may not happen now. */
export const FILL_SESSION_REFUSAL = Object.freeze({
  ALREADY_CLOSED: 'session_already_closed',
  EARLIER_UNCLOSED: 'earlier_session_unclosed',
});

/**
 * Why a fill dated `tickDate` may not happen on this book now, or null when it may.
 *
 * @param {object} book           the book as the fill's transaction read it
 * @param {Array<object>} ideas   every open idea of the book, as read
 * @param {string} tickDate       the session the fill would be dated in (ET date)
 */
export function fillSessionRefusal(book, ideas, tickDate) {
  const last = lastClosedOf(book);
  if (last !== null && tickDate <= last) return FILL_SESSION_REFUSAL.ALREADY_CLOSED;
  // A session the window ledger's own cursor has already written up (Astra T2B-02: its close row exists, `valued:
  // false`) is closed too: a fill dated in it would leave that session's valuation a second close row to create, and
  // the close would abort on it for good (review of the T2B fix round, W-3). Today's callers never reach this — the
  // cursor only covers sessions before the one a fire runs in — so it changes no outcome; it is the guard behind that.
  const accounted = typeof book?.execState?.[WINDOWS_ACCOUNTED_FIELD] === 'string' ? book.execState[WINDOWS_ACCOUNTED_FIELD] : null;
  if (accounted !== null && tickDate <= accounted) return FILL_SESSION_REFUSAL.ALREADY_CLOSED;
  if (firstUnclosedSessionBefore(book, ideas, tickDate) !== null) return FILL_SESSION_REFUSAL.EARLIER_UNCLOSED;
  return null;
}
