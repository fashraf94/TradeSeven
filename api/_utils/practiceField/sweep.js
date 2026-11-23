// api/_utils/practiceField/sweep.js
//
// Practice Field T1a-1, T1a-2a — what the engine's cron asks of the Practice Field (T1a-1 build prompt §3, §5;
// T1a-2a build prompt §4, §5, §8). All of it is reached ONLY when the mode is not 'off':
//
//   practiceFieldBuildInputs     what the shared snapshot build must cover for idea books: every reserved coverage
//                                symbol and every symbol an idea book holds, handed to the builder as COVERAGE
//                                (never dropped for the cap or the size budget, and never a quarterly candidate
//                                or a quarterly holding — review L2-1, L2-3), the funds' static classifications
//                                (no fundamentals lookup for a fund), and — when no quarterly book is active — NO
//                                default candidate universe and no candidate floor (a small idea-book universe is
//                                not "degraded").
//
//   withDrainingIdeaBooks        the active-book documents a snapshot build is decided from, plus every DRAINING
//                                idea book (Amendment E13; Astra W-12): a draining book still holds shares that
//                                need a price, and the engine's own `status == 'active'` query cannot see it.
//
//   runIdeaBookWindow            ONE book at ONE window, in the one order that is safe:
//                                  1. CATCH UP every session the book missed before this window's date, each from
//                                     its own stored close snapshot (close.js catchUpIdeaBook; Amendment E12).
//                                     Nothing moves past an unclosed session (sessions.js; review RH-1, RH-2): if
//                                     the catch-up is not complete, the window makes NO fill and is not stamped;
//                                  2. SALES — line exits, delisting exits and settlement sales (exits.js);
//                                  3. ENTRIES (entry.js) (Amendment E8, B-ORDER: sales come first).
//                                A draining book gets 1 and 2 and no entry. NO model call.
//
//   runIdeaBookEvalPass          the eval handler's idea-book pass: `runIdeaBookWindow` for every active or
//                                draining idea book, a lease per book, a fresh read under it, its own within-slot
//                                stamp (`execState.lastIdeaTickKey`), and (T1a-2b-1 §4) the window's row in the
//                                book's window ledger (windowLedger.js) — served only when the stamp is written.
//
//   runDrainingIdeaBookCloses    the close of every draining idea book for a date (E13): the engine's close sweep
//                                pages active books only.
//
// ITS OWN QUERIES. Every query here is the idea book's own equality pair (`status == …`, `kind == 'idea_book'` — no
// composite index). The quarterly sweeps' `status == 'active'` queries are not changed.
//
// WITH NO IDEA BOOK, NO QUERY (Astra T2A-02; Amendment E §4). At mode 'on' each fire reads the founder-cap registry
// ONCE (readIdeaBookPresence) and hands that one answer to the snapshot build, the eval pass and the close. A missing
// registry document, or one whose `openBooks` is empty, means there is no idea book: every discovery query here is
// skipped, so nothing of the Practice Field reaches the fire's response, error count, completion, retention or logs.
// The registry is a complete list of OPEN idea books: it is written in the transaction that creates a book
// (ideaBook.js createIdeaBook, the ONLY builder of an idea-book document), and an entry is removed at exactly one
// place — the close that completes a wind-down sets the book `closed` in the same transaction (close.js, T1a-2b-1 §6)
// — never while a book is active or draining. A closed book owes no fire anything. Pinned by registryPresence.test.js.
// If the read itself fails the answer is "unknown" and discovery runs as before (its own failures count as before).
//
// The founder cap (B8) is four books, so each pass reads them in one bounded page; paging and measured capacity
// are T5.

import { MANDATE_SWEEP_PAGE_SIZE } from '../mandateConfig.js';
import { acquireLease, releaseLease } from '../mandateLease.js';
import { IDEA_BOOK_KIND, isIdeaBook } from '../mandateBookKind.js';
import { coverageRefOf, coverageSymbols } from './coverage.js';
import { fundStaticClassifications } from './symbols.js';
import { runIdeaBookEntryPass } from './entry.js';
import { runIdeaBookSalesPass } from './exits.js';
import { closeIdeaBook, catchUpIdeaBook, recentlyResultedIdeas, resultedIdeaSymbols } from './close.js';
import { makeParseReportingFetcher } from './caParseReport.js';
import { etDateOfMs } from './windows.js';
import { nextSessionDate } from './windows.js';
import { recordWindowAttempt } from './windowLedger.js';
import { practiceFieldLive, practiceFieldAgentOn } from './mode.js';
import { PRACTICE_FIELD_BOOK_REGISTRY_ID } from './constants.js';

const LOG_PREFIX = '[PracticeFieldSweep]';

/** The book statuses the idea-book passes serve: an active book, and one that is draining (code duties only). */
const SERVED_STATUSES = Object.freeze(['active', 'draining']);

/**
 * What one fire knows about whether any idea book exists (T2A-02).
 *   { known: true,  ideaBooks: false }  the registry is missing or lists no open book: no discovery query this fire;
 *   { known: true,  ideaBooks: true }   it lists one or more: discovery runs exactly as before;
 *   { known: false, ideaBooks: true }   it could not be read, or does not have the registry's shape: as before.
 * A caller that hands no presence gets the last behaviour — discovery runs.
 */
const PRESENCE_NONE = Object.freeze({ known: true, ideaBooks: false });
const PRESENCE_LISTED = Object.freeze({ known: true, ideaBooks: true });
export const PRESENCE_UNKNOWN = Object.freeze({ known: false, ideaBooks: true });
const noIdeaBook = (presence) => presence?.known === true && presence.ideaBooks === false;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The fire's ONE read of the founder-cap registry, `practiceFieldBooks/_registry` (T2A-02). At 'off' it reads
 * nothing (every consumer returns before asking). Never throws: a failed read is logged and answers "unknown".
 */
export async function readIdeaBookPresence(db) {
  if (!practiceFieldLive()) return PRESENCE_UNKNOWN;
  try {
    const snap = await db.collection('practiceFieldBooks').doc(PRACTICE_FIELD_BOOK_REGISTRY_ID).get();
    if (!snap.exists) return PRESENCE_NONE;
    const openBooks = snap.data()?.openBooks;
    if (!isPlainObject(openBooks)) return PRESENCE_UNKNOWN;
    return Object.keys(openBooks).length === 0 ? PRESENCE_NONE : PRESENCE_LISTED;
  } catch (err) {
    console.error(`${LOG_PREFIX} PRACTICE_FIELD_REGISTRY_READ_FAILED — discovery runs as before: ${err.message}`);
    return PRESENCE_UNKNOWN;
  }
}

/** T1a-2b-4 retention: every symbol an idea of these books that resulted within the look-back of `through` held. */
async function retainedSymbolsOf(db, bookIds, { through }) {
  const out = new Set();
  for (const id of bookIds) {
    // The collection by its literal name (a read; the close reads the same ideas inside its transaction).
    for (const idea of await recentlyResultedIdeas(db.collection('mandates').doc(id), { through })) for (const sym of resultedIdeaSymbols(idea)) out.add(sym);
  }
  return [...out].sort();
}

/** One bounded page of idea books of one status — the idea book's own equality query. */
async function ideaBooksOfStatus(db, status) {
  const page = await db.collection('mandates')
    .where('status', '==', status)
    .where('kind', '==', IDEA_BOOK_KIND)
    .limit(MANDATE_SWEEP_PAGE_SIZE)
    .get();
  return page.docs;
}

/**
 * Build B2 (§2): may this idea book DRAFT at its next close — active, drafting not paused, no wind-down, a slot empty?
 * Pure. (Whether the slot's desk still has its refill attempt this session is the agent's own question; at the close
 * snapshot's build no desk has run yet.)
 */
export function ideaBookMayDraft(book) {
  return isIdeaBook(book) && book.status === 'active' && book.drafting !== 'paused' && !book.windDown
    && ['short', 'medium', 'long'].some((s) => (book.slots?.[s] ?? null) === null);
}

/**
 * The snapshot builders' inputs when at least one idea book is active.
 *
 * Build B2 (§2) — THE CANDIDATE UNIVERSE ON A DRAFTING CLOSE. On the CLOSE fire (`closeTick`), when the agent is on and an
 * active idea book may draft (`ideaBooks`, ideaBookMayDraft), the close snapshot's build carries the shared candidate
 * universe — its QUOTES only: the daily build is unchanged (no top-up of the day's slow layer), and the candidate floor
 * stays 0 (a small universe never reads as degraded). The desks' candidate list is read from that stored snapshot. With the
 * agent off, on any slot tick, or with no book to draft for, the inputs are exactly as before.
 *
 * T1a-2b-4 adds two things to the DAILY build's inputs only (never the slot snapshots'):
 *   • THE PARSE REPORT (Astra T2D-12; caParseReport.js): the daily build fetches the corporate actions of the symbols an
 *     idea book's coverage requires through the parse-reporting wrapper, which returns exactly what the base fetcher
 *     returns and writes the per-symbol report to `practiceFieldCaParseReports/{session}`. It is handed in only when
 *     such a symbol is in the build — so at 'off', and at 'on' with no idea book (no call here at all), the daily build
 *     is exactly the engine's own;
 *   • RETENTION (Astra T2D-03 after a result): an idea that RESULTED within the daily layer's look-back still has rows the
 *     vendor may first list now — a dividend dated while it held a name it has since sold — so the symbols its three
 *     ledgers held stay in the daily build's coverage for that long (recentlyResultedIdeas). Without them the close
 *     could never see such a row: the coverage document drops a resulted idea's symbols at once.
 *
 * @param {{ ideaHeldTickers: string[], quarterlyActive: boolean, ideaBookIds?: string[], now?: Date }} args  what the
 *   active idea books hold, and which books they are
 * @returns {Promise<{ daily: object, tick: object, coverageCount: number }>}
 */
export async function practiceFieldBuildInputs(db, { ideaHeldTickers = [], quarterlyActive, coverageData, ideaBookIds = [], now = new Date(), closeTick = false, ideaBooks = [] }) {
  // `coverageData` is the coverage document the draining-query fallback ALREADY read this fire (coverageFromStandIn):
  // handed on, so that path needs no second read — a second one failing would throw into the fire the fallback is
  // there to protect (third refuter pass, 9a). On every other path it is undefined and the document is read here.
  let data = coverageData;
  if (data === undefined) {
    const snap = await coverageRefOf(db).get();
    data = snap.exists ? snap.data() : null;
  }
  const reserved = coverageSymbols(data);
  const coverageTickers = [...new Set([...ideaHeldTickers, ...reserved])];
  const withoutDefault = quarterlyActive ? {} : { candidateUniverse: [] };
  // T1a-2b-4: the symbols of ideas that resulted within the look-back (retention), daily build only. Fenced: a failed
  // read keeps the build as it was (those symbols then read uncovered at the close — fail-closed).
  let retained = [];
  if (practiceFieldLive() && ideaBookIds.length > 0) {
    try {
      retained = await retainedSymbolsOf(db, ideaBookIds, { through: etDateOfMs(now.getTime()) });
    } catch (err) {
      console.error(`${LOG_PREFIX} PRACTICE_FIELD_RETENTION_READ_FAILED — the daily build goes on without the resulted ideas' symbols: ${err?.message ?? err}`);
    }
  }
  const dailyCoverage = retained.length === 0 ? coverageTickers : [...new Set([...coverageTickers, ...retained])];
  // T2D-12: the parse-reporting wrapper, only when an idea book's coverage requires a symbol of this build.
  const parseReporting = practiceFieldLive() && dailyCoverage.length > 0
    ? { fetchCorporateActions: makeParseReportingFetcher(db, { symbols: dailyCoverage }) } : {};
  // Build B2: the close snapshot of a drafting fire keeps the default candidate universe (see the header).
  const draftingClose = closeTick === true && !quarterlyActive && practiceFieldAgentOn() && ideaBooks.some(ideaBookMayDraft);
  return {
    daily: { ...withoutDefault, coverageTickers: dailyCoverage, staticClassifications: fundStaticClassifications(), ...parseReporting },
    tick: { ...(draftingClose ? {} : withoutDefault), coverageTickers, ...(quarterlyActive ? {} : { minCandidateCapacity: 0 }) },
    coverageCount: reserved.length,
  };
}

/**
 * The documents a snapshot build is decided from: the engine's active-book documents, plus every draining idea book
 * (E13). At 'off' — and whenever no idea book is draining — it answers the SAME array it was handed and, at 'off',
 * reads nothing: a fire with no Practice Field in play is exactly the engine's own. FENCED from the engine's sweep
 * (review L2-4): if the Practice Field's own query fails it never throws into the fire. It falls back to the
 * coverage document (one read, made only then — see the catch below); if that reserves nothing, or cannot be read
 * either, the fire goes on with the engine's documents and both failures are logged.
 *
 * With no idea book listed in the registry (T2A-02) it reads nothing and hands back the same array.
 *
 * @param {Array<object>} activeDocs  the documents of the engine's `status == 'active'` query
 * @param {object} [presence]         this fire's readIdeaBookPresence answer
 * @returns {Promise<Array<object>>}
 */
export async function withDrainingIdeaBooks(db, activeDocs, presence = PRESENCE_UNKNOWN) {
  if (!practiceFieldLive()) return activeDocs;
  if (noIdeaBook(presence)) return activeDocs;
  try {
    const draining = await ideaBooksOfStatus(db, 'draining');
    return draining.length === 0 ? activeDocs : [...activeDocs, ...draining];
  } catch (err) {
    // The query failed, so whether a draining book exists is unknown — and a snapshot is built ONCE per key: a
    // draining book left out of it would be valued at carried marks at this close for good, and on its due session
    // that is an `unmeasurable` result nobody can amend (review lens 3, IS-2). The coverage document does not depend
    // on this query and still lists every open idea's symbols, so: if it reserves anything, the build is told an idea
    // book is in play (one stand-in document holding nothing) and covers those symbols exactly as it would have.
    console.error(`${LOG_PREFIX} PRACTICE_FIELD_DRAINING_QUERY_FAILED — the snapshot build falls back to the coverage document: ${err.message}`);
    try {
      const snap = await coverageRefOf(db).get();
      const coverageData = snap.exists ? snap.data() : null;
      if (coverageSymbols(coverageData).length === 0) return activeDocs;
      return [...activeDocs, coverageStandIn(coverageData)];
    } catch (coverageErr) {
      console.error(`${LOG_PREFIX} PRACTICE_FIELD_DRAINING_QUERY_FAILED — the coverage document could not be read either; the build goes on with the engine's documents: ${coverageErr.message}`);
      return activeDocs;
    }
  }
}

/**
 * What stands in for "some idea book the query could not list" in a snapshot build's inputs: a document that holds
 * nothing, carrying the coverage document the fallback read.
 */
const coverageStandIn = (coverageData) => Object.freeze({
  id: 'practice-field-coverage-stand-in',
  practiceFieldCoverageData: coverageData,
  data: () => ({ kind: IDEA_BOOK_KIND, status: 'draining', portfolio: { positions: {} } }),
});

/** The coverage document a stand-in among `docs` carries, or undefined when there is none (the usual case). */
export function coverageFromStandIn(docs) {
  const standIn = (docs || []).find((d) => d && Object.hasOwn(d, 'practiceFieldCoverageData'));
  return standIn ? standIn.practiceFieldCoverageData : undefined;
}

const NO_SALES = Object.freeze({ served: false, sold: 0, waiting: 0, resulted: 0, errors: 0, alerts: [] });
const NO_ENTRIES = Object.freeze({ served: false, entered: 0, waiting: 0, cancelled: 0, errors: 0 });

/**
 * One book at one window: catch up, then sales, then entries (see the header). The caller holds the book's lease.
 *
 * @returns {Promise<{ served: boolean, complete: boolean, skipped?: string, caughtUp: Array<{ date: string, observed: boolean }>,
 *                     sales: object, entries: object, errors: number }>}
 *   `complete` is false when the window made no fill because an earlier session could not be closed yet.
 */
export async function runIdeaBookWindow(db, { bookRef, tick, now = new Date() }) {
  const out = { served: false, complete: true, caughtUp: [], sales: { ...NO_SALES, alerts: [] }, entries: { ...NO_ENTRIES }, errors: 0 };
  if (!practiceFieldLive()) return out;
  const bookSnap = await bookRef.get();
  if (!bookSnap.exists || !isIdeaBook(bookSnap.data())) return out;
  const book = bookSnap.data();
  if (!SERVED_STATUSES.includes(book.status)) return out;
  out.served = true;
  const last = typeof book.execState?.lastCloseKey === 'string' ? book.execState.lastCloseKey : null;
  // This session's close is already written: nothing may be dated in it any more.
  if (last !== null && tick.date <= last) return { ...out, complete: false, skipped: 'session_already_closed' };
  // 1. Catch up. With a last close that is the session just before this window's there is nothing to catch up, and
  //    no transaction is spent finding that out.
  const next = last === null ? null : nextSessionDate(last);
  if (last === null || next === null || next < tick.date) {
    let caught;
    try {
      caught = await catchUpIdeaBook(db, bookRef, { before: tick.date, now, tick, lastCloseKey: last });
    } catch (err) {
      console.error(`${LOG_PREFIX} idea book ${bookRef.id} catch-up failed before ${tick.tickKey}: ${err.message}`);
      return { ...out, complete: false, skipped: 'catch_up_failed', errors: 1 };
    }
    out.caughtUp = caught.caughtUp;
    for (const alert of caught.alerts || []) console.error(`${LOG_PREFIX} ${bookRef.id} ${alert}`);
    // A caught-up close completed the book's wind-down (T1a-2b-1 §6): the book is closed and owes this window nothing.
    if (caught.bookClosed) return { ...out, served: false, complete: true, skipped: 'book_closed' };
    if (!caught.complete) return { ...out, complete: false, skipped: caught.skipped ?? 'catch_up_incomplete' };
  }
  // 2, 3. E8 (B-ORDER): within a window, sales come first — then entries. Each pass isolates its ideas; a pass that
  // throws as a whole (its own read of the book) is counted as an error HERE, so what the other pass did stays on this
  // window's answer — and on its window-ledger row (review B4): a sale filled before the entry pass threw is not lost.
  try {
    out.sales = await runIdeaBookSalesPass(db, { bookRef, tick, now });
  } catch (err) {
    console.error(`${LOG_PREFIX} idea book ${bookRef.id} sales pass failed at ${tick.tickKey}: ${err.message}`);
    out.sales = { ...NO_SALES, alerts: [], errors: 1 };
  }
  try {
    out.entries = await runIdeaBookEntryPass(db, { bookRef, tick, now });
  } catch (err) {
    console.error(`${LOG_PREFIX} idea book ${bookRef.id} entry pass failed at ${tick.tickKey}: ${err.message}`);
    out.entries = { ...NO_ENTRIES, errors: 1 };
  }
  out.errors = out.sales.errors + out.entries.errors;
  return out;
}

/**
 * The idea-book pass of one eval fire: for every active or draining idea book, catch-up, then sales, then entries.
 *
 * @returns {Promise<{ books: number, served: number, caughtUp: number, sold: number, saleWaiting: number, resulted: number,
 *                     entered: number, waiting: number, cancelled: number, errors: number, leaseSkips: number }>}
 */
export async function runIdeaBookEvalPass(db, { tick, now = new Date(), ownerToken, presence = PRESENCE_UNKNOWN }) {
  const out = { books: 0, served: 0, caughtUp: 0, sold: 0, saleWaiting: 0, resulted: 0, entered: 0, waiting: 0, cancelled: 0, errors: 0, leaseSkips: 0 };
  if (!practiceFieldLive()) return out; // 'off': not even the query
  if (noIdeaBook(presence)) return out; // T2A-02: no idea book listed — no query
  const docs = [];
  const queryFailures = [];
  for (const status of SERVED_STATUSES) {
    // One status's query failing does not cost the other status's books this fire (review lens 3, IS-8): it is
    // counted and the pass goes on. With NO status listed the pass has served nobody: it throws, as it always did,
    // and the caller's fence reports a failed pass.
    let page;
    try {
      page = await ideaBooksOfStatus(db, status);
    } catch (err) {
      out.errors += 1;
      queryFailures.push(err);
      console.error(`${LOG_PREFIX} PRACTICE_FIELD_PASS_QUERY_FAILED — ${status} idea books at ${tick.tickKey}: ${err.message}`);
      if (queryFailures.length === SERVED_STATUSES.length) throw err;
      continue;
    }
    if (page.length >= MANDATE_SWEEP_PAGE_SIZE) {
      console.error(`${LOG_PREFIX} PRACTICE_FIELD_PASS_PAGE_FULL — ${page.length} ${status} idea books at ${tick.tickKey}; the pass serves one page (capacity is T5)`);
    }
    docs.push(...page);
  }
  out.books = docs.length;
  for (const docSnap of docs) {
    const bookRef = docSnap.ref;
    if (docSnap.data().execState?.lastIdeaTickKey === tick.tickKey) continue; // served this slot (the snapshot is built once per slot)
    const lease = await acquireLease(db, bookRef, ownerToken, { now });
    if (!lease.acquired) { out.leaseSkips += 1; continue; }
    try {
      const fresh = await bookRef.get();
      if (!fresh.exists || !isIdeaBook(fresh.data())) continue;
      if (fresh.data().execState?.lastIdeaTickKey === tick.tickKey) continue;
      const win = await runIdeaBookWindow(db, { bookRef, tick, now });
      if (win.served) out.served += 1;
      out.caughtUp += win.caughtUp.length;
      out.sold += win.sales.sold;
      out.saleWaiting += win.sales.waiting;
      out.resulted += win.sales.resulted;
      out.entered += win.entries.entered;
      out.waiting += win.entries.waiting;
      out.cancelled += win.entries.cancelled;
      out.errors += win.errors;
      // A window that could not finish catching up made no fill: the slot's next fire must serve it. Counted, so the
      // fire does not claim every book served.
      if (!win.complete && win.skipped !== 'session_already_closed' && win.errors === 0) out.errors += 1;
      // T1a-2b-1 §4 — THE WINDOW LEDGER: this attempt, folded into the window's row (windowLedger.js). `served` only
      // for a complete pass with no error — the stamp's own condition, below; a served row is never written again.
      // Not for a session whose close is already written (nothing was attempted), nor for a book the catch-up just
      // closed (it owes no window any more). A failure here is this book's failure: counted, and no stamp.
      if (win.served && win.skipped !== 'session_already_closed') await recordWindowAttempt(db, { bookRef, tick, win, now });
      // The within-slot stamp — ONLY for a complete pass with no error (review L3-1): the pass bills nothing, so a
      // transient failure is retried by the slot's next fire instead of costing the idea its last entry slot.
      // Bookkeeping, not money: no revision bump (the engine's own stamps are written the same way). Only a book the
      // window SERVED is stamped: one the window found not open — closed by this window's catch-up, or by another
      // fire's (review N1) — gets no write.
      if (win.served && win.complete && win.errors === 0) await bookRef.set({ execState: { lastIdeaTickKey: tick.tickKey } }, { merge: true });
    } catch (err) {
      out.errors += 1;
      console.error(`${LOG_PREFIX} idea book ${bookRef.id} pass failed at ${tick.tickKey}: ${err.message}`);
    } finally {
      await releaseLease(db, bookRef, ownerToken).catch(() => {});
    }
  }
  return out;
}

/**
 * Did a close that answered `closed: false` leave an open idea book UNCLOSED for the date it was asked for? True
 * when the catch-up ran out of its per-call bound, or the date's own snapshot is not stored. (The other answers mean
 * there was nothing to do: already closed, out of order, not an open idea book, the mode off.) A close sweep that
 * served such a book has not finished (review lens 3, IS-3).
 */
export function ideaCloseLeftUnclosed(result) {
  return result?.closed === false && (result.skipped === 'catch_up_incomplete' || result.skipped === 'valuation_missed');
}

/**
 * Close every DRAINING idea book for `date` (E13). The engine's close sweep pages `status == 'active'` books and so
 * never reaches one; this is the idea book's own query. Per-book isolation, a lease per book.
 *
 * `unclosed` counts the books this fire served and LEFT unclosed for `date` (ideaCloseLeftUnclosed): the sweep must
 * not claim completion over one.
 *
 * @returns {Promise<{ books: number, closed: number, skipped: number, unclosed: number, errors: number, leaseSkips: number, alerts: string[] }>}
 */
export async function runDrainingIdeaBookCloses(db, { date, now = new Date(), ownerToken, presence = PRESENCE_UNKNOWN }) {
  const out = { books: 0, closed: 0, skipped: 0, unclosed: 0, errors: 0, leaseSkips: 0, alerts: [] };
  if (!practiceFieldLive()) return out; // 'off': not even the query
  if (noIdeaBook(presence)) return out; // T2A-02: no idea book listed — no query
  const docs = await ideaBooksOfStatus(db, 'draining');
  out.books = docs.length;
  for (const docSnap of docs) {
    const bookRef = docSnap.ref;
    if (docSnap.data().execState?.lastCloseKey === date) { out.skipped += 1; continue; }
    // The lease is taken INSIDE the book's own try: one book's failure — its lease's included — is counted, never thrown.
    let lease = null;
    try {
      lease = await acquireLease(db, bookRef, ownerToken, { now });
      if (!lease.acquired) { out.leaseSkips += 1; continue; }
      const res = await closeIdeaBook(db, bookRef, { date, now });
      for (const alert of res.alerts || []) {
        out.alerts.push(alert);
        console.error(`${LOG_PREFIX} ${bookRef.id} ${alert}`);
      }
      // A catch-up session that completed the book's wind-down closed it (T1a-2b-1 §6): the close call answers
      // `book_closed`, and the book is CLOSED by this fire — counted so, not as skipped (T1a-2b-2 §4.3, Q7).
      if (res.closed || res.bookClosed === true) out.closed += 1;
      else {
        out.skipped += 1;
        if (ideaCloseLeftUnclosed(res)) out.unclosed += 1;
      }
    } catch (err) {
      out.errors += 1;
      console.error(`${LOG_PREFIX} draining idea book ${bookRef.id} close failed for ${date}: ${err.message}`);
    } finally {
      if (lease?.acquired) await releaseLease(db, bookRef, ownerToken).catch(() => {});
    }
  }
  return out;
}
