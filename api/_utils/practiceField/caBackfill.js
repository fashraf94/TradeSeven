// api/_utils/practiceField/caBackfill.js
//
// Practice Field T1a-2b-3 — ACTIONS MISSED DURING AN OUTAGE ARE FETCHED LATER (Amendment F-1). The daily layer's
// corporate-action fetch reaches MANDATE_CA_FETCH_LOOKBACK_DAYS calendar days back. When an idea's data has not covered
// a held symbol for longer than that — the fetch failed for days, the idea book was off, closes went unobserved — the
// session's own layer can no longer list what happened in the gap, and the doubt (dailyCoverage.js) would never clear.
// So, before the idea book closes a date, it asks the daily builder's own fetch (mandateUniverseSnapshot.js
// fetchCorporateActionsEODHD — the §3.0 sole-fetch home, called, never edited, through the same feed parsers) for that
// symbol's actions FROM THE DAY AFTER `caCoveredThrough`, through the date being closed, and stores the answer:
//
//   practiceFieldCaBackfill/{SYM}   { schemaVersion, symbol, from, to, failed, actions, calls, fetchedAt, source, parseReport }
//
// (T1a-2b-4, T2D-12: `parseReport` is the same per-symbol report the daily build writes — caParseReport.js — for what
// this fetch answered. A backfill whose report is not clean is stored as a FAILED one: its rows that parsed are kept.)
//
// ONE DOCUMENT PER SYMBOL, the latest successful range: a catch-up that moves an idea's `caCoveredThrough` forward one
// session at a time keeps reading it (it reaches back to the day after each), and SPY — in every idea, each waiting
// from its own day — is fetched once, from the earliest day any idea needs.
//
// WHERE ONLY THE IDEA BOOK READS IT (rule 5 of the build prompt). Nothing is written to `mandateUniverseDaily` or to a
// snapshot: the quarterly daily documents are byte-identical, and no quarterly reader — the quarterly close, the
// snapshot builder, the eval's gates — reads this collection. The idea book's close reads it, inside its own
// transaction, for the symbol and the idea that need it (close.js), and unions its rows into that idea's rows only.
//
// A SUCCESSFUL fetch (both legs answered: `failed: false`) is stored whole, and a later, longer one replaces it. A FAILED
// one is stored only when no successful one is — with whatever rows its other leg returned, which the founder may pick
// (resolve_hold, coverage_gap) — and the doubt stays. One read and at most two upstream calls per needed symbol per
// close call, counted on the day's upstream counter. Nothing is fetched while the data is complete.
//
// FENCED: it never throws into the close. A failure is logged and alerted (PRACTICE_FIELD_CA_BACKFILL_FAILED); the
// close then finds no backfill and the doubt stays — which holds everything that depends on the count. BOUNDED (review,
// lens A N2): it runs before the close's transactions, under the cron's lease, so one fetch that has not answered in
// BACKFILL_FETCH_TIMEOUT_MS is taken as failed, and once BACKFILL_PASS_BUDGET_MS has gone no further symbol is asked
// this call (each left in doubt, alerted, and asked again at the next close).
//
// Reached from closeIdeaBook and from the window's catch-up (catchUpIdeaBook: review A2 — after an outage the window's
// catch-up is usually the first close, and it closes the gap sessions from the backfill, in order).

import { fetchCorporateActionsEODHD, bumpUpstreamCounter } from '../mandateUniverseSnapshot.js';
import { MANDATE_CA_FETCH_LOOKBACK_DAYS } from '../mandateConfig.js';
import { isIdeaBook } from '../mandateBookKind.js';
import { FILLED_IDEA_STATUSES } from './constants.js';
import { coveredThroughOf, backfillIdOf, successfulBackfill, shiftCalendarDate, heldSymbolsOf, parseEntryVerdict } from './dailyCoverage.js';
import { fetchObservingParse, legReportOf, parseReportEntryOf, PARSE_LEGS } from './caParseReport.js';

const LOG_PREFIX = '[PracticeFieldBackfill]';
/** One fetch that has not answered in this long is taken as failed (its doubt stays). */
export const BACKFILL_FETCH_TIMEOUT_MS = 20_000;
/** No further symbol is asked in a pass once this long has gone. */
export const BACKFILL_PASS_BUDGET_MS = 60_000;
/** The answer of `promise`, or a failed fetch once `ms` have gone (the request itself is left to end on its own). */
function withinTimeout(promise, ms) {
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve({ actions: [], calls: 0, failed: true, error: `no answer in ${ms} ms` }), ms); });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}
/** The collection the backfill is stored in — named here for readers; the WRITE below names it by its literal. */
export const BACKFILL_COLLECTION_NAME = 'practiceFieldCaBackfill';

/**
 * What a book's open ideas need backfilled to close `through`: each held symbol whose last covered session is so far
 * back that `through`'s own daily window cannot reach the day after it. Pure.
 * @returns {Array<{ symbol: string, from: string }>}  one per symbol, from the EARLIEST day any idea needs (SPY is in
 *   every idea, each waiting from its own day: one fetch from the first covers them all)
 */
export function backfillNeeds(ideas, through) {
  const windowFrom = shiftCalendarDate(through, -MANDATE_CA_FETCH_LOOKBACK_DAYS);
  const needs = new Map();
  for (const idea of ideas || []) {
    if (!FILLED_IDEA_STATUSES.includes(idea?.status)) continue;
    for (const symbol of heldSymbolsOf(idea)) {
      const covered = coveredThroughOf(idea, symbol);
      if (typeof covered !== 'string' || covered >= through) continue;
      const from = shiftCalendarDate(covered, 1);
      if (from >= windowFrom) continue; // the session's own daily window reaches it
      const prior = needs.get(symbol);
      if (!prior || from < prior.from) needs.set(symbol, { symbol, from });
    }
    // (T1a-2b-4 fix round, refuter R-4: A SOLD HOLDING'S STICKY COVERAGE DOUBT — `closedCoverageDoubts`, T2E-08 — clears only
    // by a backfill with a clean report covering its earliest date through the sale; a session listing the symbol cleanly says
    // nothing about that date, so the daily window never stands in. Needed from that date while the doubt stands.)
    for (const [symbol, doubt] of Object.entries(idea.ledger?.closedCoverageDoubts || {})) {
      const from = (doubt?.dates || []).map((x) => x?.date).filter((d) => typeof d === 'string').sort()[0];
      if (typeof from !== 'string' || from > through) continue;
      const prior = needs.get(symbol);
      if (!prior || from < prior.from) needs.set(symbol, { symbol, from });
    }
  }
  return [...needs.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/**
 * Fetch and store what one idea book's open ideas need backfilled to close `through` (see the header). Reads the book
 * and its open ideas outside any transaction — the close re-reads them inside its own — and never throws.
 *
 * @returns {Promise<{ needed: number, fetched: number, failed: number, upstreamCalls: number, alerts: string[] }>}
 */
export async function ensureCoverageBackfills(db, bookRef, {
  through, now = new Date(), fetchCorporateActions = fetchCorporateActionsEODHD, fetchTimeoutMs = BACKFILL_FETCH_TIMEOUT_MS, passBudgetMs = BACKFILL_PASS_BUDGET_MS,
  fetchImpl = null,
} = {}) {
  const out = { needed: 0, fetched: 0, failed: 0, upstreamCalls: 0, alerts: [] };
  const started = Date.now();
  try {
    const bookSnap = await bookRef.get();
    if (!bookSnap.exists || !isIdeaBook(bookSnap.data())) return out;
    const ideas = [];
    for (const id of bookSnap.data().openIdeaIds || []) {
      const snap = await bookRef.collection('ideas').doc(id).get();
      if (snap.exists) ideas.push(snap.data());
    }
    const needs = backfillNeeds(ideas, through);
    out.needed = needs.length;
    for (const { symbol, from } of needs) {
      // The collection by its literal name, for the protected-store scan.
      const ref = db.collection('practiceFieldCaBackfill').doc(backfillIdOf(symbol));
      const prior = await ref.get();
      const stored = successfulBackfill(prior.exists ? prior.data() : null, symbol, null);
      if (stored !== null && stored.from <= from && stored.to >= through) continue;
      // A refetch never NARROWS what is stored: it starts from the earlier of the two first days (another book's idea —
      // SPY is in every one — may still need the earlier one).
      const fetchFrom = stored !== null && stored.from < from ? stored.from : from;
      let res;
      // T1a-2b-4 (T2D-12): the backfill records the same parse report as the daily build, for what it fetches — each leg's
      // answer observed once through the base fetcher's own seam (caParseReport.js). A fetch that never answered has an
      // unanswered report: not clean.
      let parseReport = parseReportEntryOf(Object.fromEntries(PARSE_LEGS.map((leg) => [leg, legReportOf(symbol, leg, null)])), { at: now.toISOString() });
      if (Date.now() - started >= passBudgetMs) {
        res = { actions: [], calls: 0, failed: true, error: `the pass's ${passBudgetMs} ms budget was spent; asked again at the next close` };
      } else {
        try {
          const observed = await withinTimeout(Promise.resolve().then(() => fetchObservingParse(symbol, { from: fetchFrom, to: through }, { base: fetchCorporateActions, fetchImpl, now: () => now })), fetchTimeoutMs);
          // (A timeout answers a plain failed fetch, with no report.)
          if (observed && typeof observed === 'object' && Object.hasOwn(observed, 'entry')) { res = observed.res; parseReport = observed.entry; } else res = observed;
        } catch (err) {
          res = { actions: [], calls: 0, failed: true, error: err?.message ?? String(err) };
        }
      }
      const parse = parseEntryVerdict(parseReport);
      out.upstreamCalls += Number(res?.calls) || 0;
      const actions = Array.isArray(res?.actions) ? res.actions : [];
      const doc = {
        // (An answer whose rows are not a list is not a success, whatever it says: lens A N4. T1a-2b-4, T2D-12: nor is one
        // whose parse report shows a rejected row or a malformed envelope — its rows that parsed are kept, for the founder.)
        schemaVersion: 1, symbol, from: fetchFrom, to: through, failed: res?.failed !== false || !Array.isArray(res?.actions) || !parse.clean, actions,
        calls: Number(res?.calls) || 0, fetchedAt: now.toISOString(), source: 'idea_book_backfill', parseReport,
      };
      if (doc.failed) {
        out.failed += 1;
        const why = res?.error ?? (res?.failed === false && Array.isArray(res?.actions) && !parse.clean ? `its parse report is not clean: ${parse.reason}` : null);
        const line = `PRACTICE_FIELD_CA_BACKFILL_FAILED ${bookRef.id} ${symbol} ${fetchFrom}..${through} — the backfill of its corporate actions failed${why ? ` (${why})` : ''}; its coverage gap stays in doubt`;
        out.alerts.push(line);
        console.error(`${LOG_PREFIX} ${line}`);
        // A failed answer never replaces a successful one; with none, it is kept — rows and all — for the founder. (Review
        // AR4-B-5: "successful" here is the stored answer's own `failed: false`, its report or not — a success stored before
        // this build carries none, covers nothing now, and is still never overwritten by a failure.)
        const priorSucceeded = prior.exists && prior.data()?.failed === false;
        if (stored === null && !priorSucceeded) await ref.set(doc);
        continue;
      }
      await ref.set(doc);
      out.fetched += 1;
    }
    // The fetches happened: they are counted on the day's upstream counter, as the daily builder counts its own.
    if (out.upstreamCalls > 0) await bumpUpstreamCounter(db, through, out.upstreamCalls);
  } catch (err) {
    const line = `PRACTICE_FIELD_CA_BACKFILL_FAILED ${bookRef?.id ?? '?'} — the backfill pass failed (${err?.message ?? err}); every gap stays in doubt`;
    out.alerts.push(line);
    console.error(`${LOG_PREFIX} ${line}`);
  }
  return out;
}
