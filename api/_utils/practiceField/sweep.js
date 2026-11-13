// api/_utils/practiceField/sweep.js
//
// Practice Field T1a-1 — what the engine's cron asks of the Practice Field (build prompt §3, §5). Two things, both
// reached ONLY when the mode is not 'off' and an idea book is in play:
//
//   practiceFieldBuildInputs   what the shared snapshot build must cover for idea books: every reserved coverage
//                              symbol beside the held tickers (the builder treats both as held — never dropped
//                              for the cap or the size budget), the funds' static classifications (no fundamentals
//                              lookup for a fund), and — when no quarterly book is active — NO default candidate
//                              universe and no candidate floor (a small idea-book universe is not "degraded").
//
//   runIdeaBookEvalPass        the eval handler's idea-book pass: basket entry by code at the entry slots
//                              (windows.js). Its own equality query (`status == 'active'`, `kind == 'idea_book'` —
//                              no composite index), a lease per book, a fresh read under it, and its own
//                              within-slot stamp (`execState.lastIdeaTickKey`). NO model call.
//
// The founder cap (B8) is four books, so the pass reads them in one bounded page; paging and measured capacity are
// T5.

import { MANDATE_SWEEP_PAGE_SIZE } from '../mandateConfig.js';
import { acquireLease, releaseLease } from '../mandateLease.js';
import { IDEA_BOOK_KIND, isIdeaBook } from '../mandateBookKind.js';
import { coverageRefOf, coverageSymbols } from './coverage.js';
import { fundStaticClassifications } from './symbols.js';
import { runIdeaBookEntryPass } from './entry.js';
import { practiceFieldLive } from './mode.js';

const LOG_PREFIX = '[PracticeFieldSweep]';

/**
 * The snapshot builders' inputs when at least one idea book is active.
 *
 * @param {{ heldTickers: string[], quarterlyActive: boolean }} args
 * @returns {Promise<{ heldTickers: string[], daily: object, tick: object, coverageCount: number }>}
 */
export async function practiceFieldBuildInputs(db, { heldTickers, quarterlyActive }) {
  const snap = await coverageRefOf(db).get();
  const reserved = coverageSymbols(snap.exists ? snap.data() : null);
  const withoutDefault = quarterlyActive ? {} : { candidateUniverse: [] };
  return {
    heldTickers: [...new Set([...(heldTickers || []), ...reserved])],
    daily: { ...withoutDefault, staticClassifications: fundStaticClassifications() },
    tick: quarterlyActive ? {} : { ...withoutDefault, minCandidateCapacity: 0 },
    coverageCount: reserved.length,
  };
}

/**
 * The idea-book pass of one eval fire.
 *
 * @returns {Promise<{ books: number, served: number, entered: number, waiting: number, cancelled: number,
 *                     errors: number, leaseSkips: number }>}
 */
export async function runIdeaBookEvalPass(db, { tick, snapshot, now = new Date(), ownerToken }) {
  const out = { books: 0, served: 0, entered: 0, waiting: 0, cancelled: 0, errors: 0, leaseSkips: 0 };
  if (!practiceFieldLive()) return out; // 'off': not even the query
  const page = await db.collection('mandates')
    .where('status', '==', 'active')
    .where('kind', '==', IDEA_BOOK_KIND)
    .limit(MANDATE_SWEEP_PAGE_SIZE)
    .get();
  out.books = page.docs.length;
  if (out.books >= MANDATE_SWEEP_PAGE_SIZE) {
    console.error(`${LOG_PREFIX} PRACTICE_FIELD_PASS_PAGE_FULL — ${out.books} idea books at ${tick.tickKey}; the pass serves one page (capacity is T5)`);
  }
  for (const docSnap of page.docs) {
    const bookRef = docSnap.ref;
    if (docSnap.data().execState?.lastIdeaTickKey === tick.tickKey) continue; // served this slot (the snapshot is built once per slot)
    const lease = await acquireLease(db, bookRef, ownerToken, { now });
    if (!lease.acquired) { out.leaseSkips += 1; continue; }
    try {
      const fresh = await bookRef.get();
      if (!fresh.exists || !isIdeaBook(fresh.data())) continue;
      if (fresh.data().execState?.lastIdeaTickKey === tick.tickKey) continue;
      const res = await runIdeaBookEntryPass(db, { bookRef, tick, snapshot, now });
      if (res.served) out.served += 1;
      out.entered += res.entered;
      out.waiting += res.waiting;
      out.cancelled += res.cancelled;
      out.errors += res.errors;
      // Bookkeeping, not money: no revision bump (the engine's own stamps are written the same way).
      await bookRef.set({ execState: { lastIdeaTickKey: tick.tickKey } }, { merge: true });
    } catch (err) {
      out.errors += 1;
      console.error(`${LOG_PREFIX} idea book ${bookRef.id} pass failed at ${tick.tickKey}: ${err.message}`);
    } finally {
      await releaseLease(db, bookRef, ownerToken).catch(() => {});
    }
  }
  return out;
}
