// api/_utils/practiceField/windowLedger.js
//
// Practice Field T1a-2b-1 — THE WINDOW LEDGER (Amendment C §3; shared contract V2 §12 "an expected-versus-observed
// check ledger per book per session"; Astra W-12, W-14, W-15; build prompt §4). One row per book per window it was
// due, plus one for the close, at `mandates/{bookId}/windows/{sessionDate}_{window}`:
//
//   an INTRADAY row   written by the idea-book pass (sweep.js runIdeaBookEvalPass) after it served the book at a
//                     window: when it was served, and what code did there — sessions caught up, sales filled or
//                     waiting, entries filled, waiting or timed out, ideas resulted. `modelCalled: false` and
//                     `triggers: []` (the model arrives in T1b). `outcome` is `no_model_action` when code did nothing
//                     but look (a waiting sale or entry is looking: nothing filled), else `code_action`;
//   the CLOSE row     written in the close's own transaction (close.js closeNextSession), create-once, with the
//                     session's summary: the windows the book was due (windows.js ideaBookWindowsOf — the ONE
//                     source of the schedule), the windows served, and the windows missing.
//
// SERVED MEANS A WHOLE, CLEAN PASS. A row reads `served: true` only when the window's pass completed with no error
// — the same condition the pass stamps `execState.lastIdeaTickKey` on. An attempt that errored, or could not finish
// its catch-up, is recorded with `served: false`; the slot's next fire tries again and folds its own attempt into the
// SAME row, so the row says what code did at the window across every attempt (a fill made by an attempt that then
// errored on another idea is not lost). Once a row is served, a retry of the window writes nothing.
//
// MISSED WINDOWS. At each close the expected windows are checked against the rows: a window the book was due with no
// served row is missing. The close's row names them, and the close returns one `PRACTICE_FIELD_WINDOW_MISSED` alert
// per missed window — once, because a session is closed once (`execState.lastCloseKey`; the close row is
// create-once). The caller logs the close's alerts, as it logs every other.
//
// THE WINDOW LEDGER'S OWN CURSOR (Astra T2B-02). The valuation closes sessions from the first one it has money to value
// in (sessions.js firstUnclosedSessionBefore: after its last close, else from the first idea's entry) — so a book's
// sessions BEFORE its first close, while nothing had filled or no close had run, were never closed, and their windows
// never accounted for. The window ledger therefore keeps its own cursor, `execState.windowsAccountedThrough`, which
// starts at the book's CREATION (firstUnaccountedWindowSession). At each close and each catch-up, every due session
// from the cursor up to the one the valuation closes is accounted for first, in order: a session the valuation does
// not close gets its close row here (`valued: false` — no money was valued, and no valuation row is written), with
// its expected, served and missing windows and one alert per missed window; the one the valuation closes writes its
// own. The cursor then stands at the last session accounted for. The valuation cursor, fills, corporate actions and
// the catch-up of money are untouched by it (one guard aside: no fill is dated in a session the cursor has already
// written up — sessions.js fillSessionRefusal, a state today's callers never reach).
//
// WHAT A CLOSE ROW'S `served` SAYS. A close row says `served: true` once the session's close row is written: on time,
// or later, with `caughtUpAt` (a caught-up valued close reads the same way). Its `missing` lists intraday windows only.
// `valued` says whether a close VALUED the session (`false`: only the window cursor accounted for it — nothing was held,
// no snapshot read, no valuation row written, and `code.caughtUpSession` is null). A reader asking "did a close value
// this session?" reads `valued`, not `served` (review of the T2B fix round, W-1).

import { getSessionForDate } from '../marketSchedule.js';
import { ideaBookWindowsOf, windowRowId, CLOSE_WINDOW, nextSessionDate, etDateOfMs, sessionClosePassEndMs } from './windows.js';

/** The window ledger's own version (its own family; starts at 1). */
export const WINDOW_LEDGER_VERSION = 1;
/** What a window's row says came of it, while no model is called. */
export const WINDOW_OUTCOME = Object.freeze({ NO_MODEL_ACTION: 'no_model_action', CODE_ACTION: 'code_action' });
/** How many of a window's attempts its row keeps in full (the counts are kept whole). */
export const WINDOW_ATTEMPTS_KEPT = 12;

const toIso = (v) => {
  if (v == null) return null;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return typeof v === 'string' ? v : null;
};

/** The window ledger's collection under a book. */
export function windowsRefOf(bookRef) {
  return bookRef.collection('windows');
}

/** What ONE attempt of the idea-book pass did at a window (sweep.js runIdeaBookWindow's answer). */
export function attemptOf(win, { nowIso }) {
  return {
    at: nowIso,
    complete: win?.complete === true,
    skipped: win?.skipped ?? null,
    errors: Number(win?.errors) || 0,
    caughtUp: (win?.caughtUp || []).map((c) => ({ date: c.date, observed: c.observed === true })),
    salesFilled: Number(win?.sales?.sold) || 0,
    salesWaiting: Number(win?.sales?.waiting) || 0,
    ideasResulted: Number(win?.sales?.resulted) || 0,
    entriesFilled: Number(win?.entries?.entered) || 0,
    entriesWaiting: Number(win?.entries?.waiting) || 0,
    entriesCancelled: Number(win?.entries?.cancelled) || 0,
  };
}

/** Did code act at all (a fill, a timeout, a session caught up, an idea resulted)? */
const codeActed = (code) => code.caughtUpSessions.length > 0 || code.sales.filled > 0 || code.entries.filled > 0
  || code.entries.cancelled > 0 || code.ideasResulted > 0;

/**
 * Fold one attempt into a window's row (absent before the first). Pure. A row already served is returned unchanged:
 * the caller writes nothing for it.
 */
export function foldWindowAttempt(prior, attempt, { bookId, tick }) {
  if (prior?.served === true) return prior;
  const before = prior?.code || null;
  const caughtUp = [...(before?.caughtUpSessions || [])];
  for (const c of attempt.caughtUp) if (!caughtUp.some((x) => x.date === c.date)) caughtUp.push(c);
  const code = {
    caughtUpSessions: caughtUp,
    // Fills, timeouts and results are made once, so each attempt's are new and they add up. What waits is the last
    // attempt's: the window's state as it left it.
    sales: { filled: (before?.sales?.filled || 0) + attempt.salesFilled, waiting: attempt.salesWaiting },
    entries: {
      filled: (before?.entries?.filled || 0) + attempt.entriesFilled,
      waiting: attempt.entriesWaiting,
      cancelled: (before?.entries?.cancelled || 0) + attempt.entriesCancelled,
    },
    ideasResulted: (before?.ideasResulted || 0) + attempt.ideasResulted,
  };
  const served = attempt.complete && attempt.errors === 0;
  return {
    schemaVersion: WINDOW_LEDGER_VERSION,
    bookId,
    sessionDate: tick.date,
    window: tick.slot,
    kind: 'intraday',
    tickKey: tick.tickKey,
    served,
    servedAt: served ? attempt.at : null,
    firstAttemptAt: prior?.firstAttemptAt ?? attempt.at,
    attempts: (prior?.attempts || 0) + 1,
    errors: (prior?.errors || 0) + attempt.errors,
    attemptLog: [...(prior?.attemptLog || []), attempt].slice(-WINDOW_ATTEMPTS_KEPT),
    code,
    modelCalled: false,
    triggers: [],
    outcome: codeActed(code) ? WINDOW_OUTCOME.CODE_ACTION : WINDOW_OUTCOME.NO_MODEL_ACTION,
  };
}

/**
 * Record one attempt of the idea-book pass at a window, in one transaction: create the row, or fold the attempt into
 * it — unless it is already served, when nothing is written.
 *
 * @returns {Promise<{ wrote: boolean, served: boolean }>}
 */
export async function recordWindowAttempt(db, { bookRef, tick, win, now }) {
  const rowRef = windowsRefOf(bookRef).doc(windowRowId(tick.date, tick.slot));
  const attempt = attemptOf(win, { nowIso: now.toISOString() });
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(rowRef);
    const prior = snap.exists ? snap.data() : null;
    if (prior?.served === true) return { wrote: false, served: true };
    const row = foldWindowAttempt(prior, attempt, { bookId: bookRef.id, tick });
    tx.set(rowRef, row);
    return { wrote: true, served: row.served };
  });
}

/** The intraday windows a book was due on a session (windows.js — the one schedule). */
export function expectedIntradayWindows(book, sessionDate) {
  return ideaBookWindowsOf(sessionDate, { createdAtIso: toIso(book?.createdAt) }).filter((w) => w.kind === 'intraday');
}

/** The most sessions one transaction accounts for by the window cursor alone (T2B-02); more go on in the next one. */
export const WINDOW_ONLY_SESSIONS_PER_TX = 20;

/** The cursor's own field on the book (T2B-02): the last session whose windows are accounted for. */
export const WINDOWS_ACCOUNTED_FIELD = 'windowsAccountedThrough';

/**
 * The first session the book's window cursor has NOT accounted for (T2B-02), or null when it cannot be told.
 *   • the session after the cursor: the later of `execState.windowsAccountedThrough` and `execState.lastCloseKey`
 *     (every session the valuation closed wrote its own close row; a book whose cursor field is absent — none is,
 *     since every close writes it — therefore starts after its last close, never over a row already written);
 *   • with neither, the book's CREATION session: its creation date when that is a session and the book existed
 *     before that session's close pass ended (windows.js sessionClosePassEndMs — the latest its close can run), else
 *     the next session. A book with no readable creation time accounts nothing by this cursor.
 */
export function firstUnaccountedWindowSession(book) {
  const accounted = typeof book?.execState?.[WINDOWS_ACCOUNTED_FIELD] === 'string' ? book.execState[WINDOWS_ACCOUNTED_FIELD] : null;
  const lastClose = typeof book?.execState?.lastCloseKey === 'string' ? book.execState.lastCloseKey : null;
  const cursor = accounted !== null && (lastClose === null || accounted >= lastClose) ? accounted : lastClose;
  if (cursor !== null) return nextSessionDate(cursor);
  const createdMs = Date.parse(toIso(book?.createdAt) ?? '');
  if (!Number.isFinite(createdMs)) return null;
  const createdOn = etDateOfMs(createdMs);
  const passEnd = getSessionForDate(createdOn)?.isTradingDay ? sessionClosePassEndMs(createdOn) : null;
  return passEnd !== null && createdMs < passEnd ? createdOn : nextSessionDate(createdOn);
}

/**
 * The sessions the window cursor has not accounted for that lie strictly BEFORE `before`, in order — at most `limit`
 * of them (the caller asks for one more than it will take, to know whether more remain). Pure.
 */
export function windowOnlySessionsBefore(book, before, limit) {
  const out = [];
  for (let s = firstUnaccountedWindowSession(book); s !== null && s < before && out.length < limit; s = nextSessionDate(s)) out.push(s);
  return out;
}

/**
 * The close's row and its missed windows. Pure: `windowRows` is every expected intraday window's row as the close's
 * transaction read it (`null` when absent). `valued: false` is a session the window cursor accounts for that the
 * valuation does not close (T2B-02): no money was valued and nothing was read for it but its window rows, so it names
 * no snapshot and no observation, and it is written after its session — as a caught-up one.
 *
 * @returns {{ row: object, missing: string[], alerts: string[] }}
 */
export function buildCloseWindowRow({ bookId, book, session, windowRows, observed, catchUp, snapshotMeta, code, bookClosed, nowIso, valued = true }) {
  const expected = ideaBookWindowsOf(session, { createdAtIso: toIso(book?.createdAt) }).map((w) => w.window);
  const intraday = expected.filter((w) => w !== CLOSE_WINDOW);
  const servedIntraday = intraday.filter((w) => windowRows?.[w]?.served === true);
  const missing = intraday.filter((w) => windowRows?.[w]?.served !== true);
  const closeCode = valued ? {
    caughtUpSession: catchUp === true,
    ideasValued: code.ideasValued,
    endpoints: [...code.endpoints],
    ideasResulted: [...code.resulted],
    entriesTimedOut: [...code.cancelled],
    bookClosed: bookClosed === true,
  } : { caughtUpSession: null, ideasValued: 0, endpoints: [], ideasResulted: [], entriesTimedOut: [], bookClosed: false };
  const acted = closeCode.endpoints.length > 0 || closeCode.ideasResulted.length > 0 || closeCode.entriesTimedOut.length > 0 || closeCode.bookClosed;
  const row = {
    schemaVersion: WINDOW_LEDGER_VERSION,
    bookId,
    sessionDate: session,
    window: CLOSE_WINDOW,
    kind: 'close',
    tickKey: windowRowId(session, CLOSE_WINDOW),
    served: true,
    servedAt: nowIso,
    // T2B-02: was this session valued by a close (true), or only accounted for by the window cursor (false)?
    valued: valued === true,
    observed: valued ? observed === true : null,
    closeSnapshotKey: valued ? (snapshotMeta?.key ?? null) : null,
    code: closeCode,
    modelCalled: false,
    triggers: [],
    outcome: acted ? WINDOW_OUTCOME.CODE_ACTION : WINDOW_OUTCOME.NO_MODEL_ACTION,
    // The session's summary: expected against observed (Amendment C §3; contract §12).
    session: {
      expected,
      served: [...servedIntraday, CLOSE_WINDOW],
      missing,
      notServedButAttempted: missing.filter((w) => windowRows?.[w] != null),
    },
  };
  if (catchUp || !valued) row.caughtUpAt = nowIso;
  if (!valued) row.accountedBy = 'window_cursor';
  const alerts = missing.map((w) => `PRACTICE_FIELD_WINDOW_MISSED ${bookId} ${windowRowId(session, w)} — the book was due at this window and no pass served it`);
  return { row, missing, alerts };
}

/**
 * Account, in the caller's transaction, for sessions the valuation does not close (T2B-02): read each one's intraday
 * window rows, and build its close row (`valued: false`) and its alerts. READS ONLY — the caller writes, after every
 * read of its transaction, with writeWindowOnlySessions.
 *
 * @returns {Promise<Array<{ session: string, row: object, missing: string[], alerts: string[] }>>}
 */
export async function readWindowOnlySessions(tx, bookRef, book, sessions, { nowIso }) {
  const out = [];
  for (const session of sessions) {
    const windowRows = {};
    for (const w of expectedIntradayWindows(book, session)) {
      const snap = await tx.get(windowsRefOf(bookRef).doc(windowRowId(session, w.window)));
      windowRows[w.window] = snap.exists ? snap.data() : null;
    }
    const built = buildCloseWindowRow({ bookId: bookRef.id, book, session, windowRows, nowIso, valued: false });
    out.push({ session, ...built });
  }
  return out;
}

/** Write what readWindowOnlySessions built: each session's close row, CREATE-ONCE (a session is accounted for once). */
export function writeWindowOnlySessions(tx, bookRef, accounted) {
  for (const a of accounted) tx.create(windowsRefOf(bookRef).doc(windowRowId(a.session, CLOSE_WINDOW)), a.row);
}
