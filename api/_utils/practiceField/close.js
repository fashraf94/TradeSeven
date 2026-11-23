// api/_utils/practiceField/close.js
//
// Practice Field T1a-1, T1a-2a — THE IDEA-BOOK CLOSE: valuation every session, the lines, the endpoint and the result
// (T1a-1 build prompt §7, §7a requirements 2 and 3; T1a-2a build prompt §3, §5 to §8; Amendment E; acceptance cases
// B-RECON, B-OWNED, B-MARK, B-STAMP, B-LINE, B-EARLY, B-ENDPOINT, B-CATCHUP, B-DUE-BREACH). Dispatched from the
// engine's close sweep for a book of kind `idea_book`; a quarterly book still goes to closeBook, unchanged.
//
// A VALUATION IS A MARK, NEVER A SALE (B-MARK). This pass makes NO fill and writes NO decision record: every sale is a
// fill at a window, through executeIdeaFill (exits.js). A ledger's cash changes here only by a receipted corporate
// action — a dividend, or a delisting's cash per share (Amendment E11) — and every valuation row says `basis: 'mark'`
// and names its figures as marks. What the close MAY do with cash, each a movement of cash that is already cash:
//   • return an UNFILLED reservation to the treasury when an idea times out before its first fill (Q-4);
//   • return a RESOLVED idea's cash to the treasury when it reaches its endpoint with nothing left to sell (E2, E14).
// The endpoint row is a separate document (`rows/endpoint`, `basis: 'liquidation_value'`): a value, not a sale.
//
// ONE SNAPSHOT PER DATE (B-STAMP). The engine builds one close snapshot per date at `${date}_close`. This pass READS
// THAT STORED DOCUMENT ITSELF, inside its own transaction (Astra T1A-03); it takes no snapshot from its caller,
// refuses a stored document whose own key or date is not the session's, marks every ledger of the book from that one
// document, and stores its key and build time on every row. It builds and fetches nothing.
//
// MISSED CLOSES ARE CAUGHT UP FIRST, FROM STORED SNAPSHOTS ONLY (E12; Astra T1A-08). A close for a date first closes
// every trading session between the book's last closed date and that date, IN ORDER, each exactly as a normal close
// would from its own stored `${session}_close` document — corporate actions, marks, lines, entry timeouts, due
// sessions, endpoints — one transaction per session. A missed session with NO stored document gets an `unobserved`
// row (marks carried, not full quality): no line is recognised, every open line is recorded as unobserved for it, and
// an endpoint that falls on it is written with `economicResult: 'unmeasurable'`. Nothing is fetched or invented and
// NO CLOCK MOVES: an idea is settled on its own due session or not measured. A line recognised while catching up is
// recorded as late, and its sale fills at the next eligible observation after the catch-up. The requested date itself
// still needs its document (`valuation_missed` otherwise — tomorrow's close catches it up). A date BEFORE the last
// closed one is still refused `out_of_order`.
//
// IN ONE TRANSACTION PER SESSION, idempotent per date (`execState.lastCloseKey`):
//   0. an `accepted` idea whose start session has passed without a fill is cancelled `entry_timeout`;
//   1. CORPORATE ACTIONS from the daily layer, through the engine's pure functions, applied ONCE to each ledger — the
//      idea's, its comparison's, its SPY line's — and, for the idea's own holdings, to the book's positions too. A
//      split moves quantities and the line's level by the same ratio; a dividend credits the cash of whichever ledger
//      holds the shares; a ticker change renames the holding, its line, the book's position and the coverage entry —
//      last, and only once the symbol's share basis is settled on every ledger of the idea (Astra T2A-01);
//      a delisting with cash is credited and closes the holding; one without leaves the idea's holding a waiting sale;
//   2. MARKS from the close snapshot for every ledger, each with its quality;
//   3. THE LINES of every running idea (settlement.js readLines);
//   4. THE ENDPOINT AND THE RESULT of an idea on its due session, or with no holdings left: the endpoint row, the
//      result (written once; never again), `settled`, and every remaining holding marked for the settlement sale —
//      or `resulted` at once, its cash back in the treasury and its slot free, when nothing is left to sell;
//   5. ROWS: the book's `dailyRows/{date}` and each filled idea's `ideas/{ideaId}/rows/{date}`;
//   6. RECONCILIATION of the book as read, before step 0 (reject, never repair — Astra T1A-02), and of the book as it
//      will be written, before anything is written;
//   7. (T1a-2b-1 §3) THE RESULT EVIDENCE of every idea whose endpoint this close writes — a copy of every price its
//      result relied on (evidence.js), create-once, beside the endpoint row;
//   8. (T1a-2b-1 §4) THE CLOSE'S WINDOW ROW, create-once: the session's expected windows against the served ones, and
//      one PRACTICE_FIELD_WINDOW_MISSED alert per missed window (windowLedger.js) — after the rows of every earlier
//      session the window ledger's OWN cursor has not yet accounted for (Astra T2B-02: the sessions from the book's
//      creation before the valuation's first, which no valuation closes), each `valued: false`, with no valuation row;
//   9. (T1a-2b-1 §6) WIND-DOWN COMPLETES HERE: a `draining` book with no open idea left after this close is set
//      `closed`, taken off the founder-cap registry and its owner's claim closed — all in this transaction. Nothing
//      else removes a registry entry, and never while a book is active or draining (registryPresence.test.js).
// Every read of 7–9 (each idea's inception row, the session's window rows, the claim and the registry) is made
// before any write, as a Firestore transaction requires.

import { buildCorporateAction } from '../mandateSchema.js';
import { applyCorporateAction, deriveActionId } from '../mandateCorporateActions.js';
import { caActionsBySymbol, snapshotExcluding, SNAPSHOT_COLLECTION } from '../mandateUniverseSnapshot.js';
import { markBook } from '../mandateValuation.js';
import { roundUsd } from '../mandateRounding.js';
import { MANDATE_SCHEMA_VERSION } from '../mandateConfig.js';
import { isIdeaBook, IDEA_BOOK_KIND } from '../mandateBookKind.js';
import {
  IDEA_SCHEMA_VERSION, IDEA_STATUS, CANCEL_REASON, VALUATION_LABEL, VALUATION_LABEL_UNOBSERVED, MARK_QUALITY, FILLED_IDEA_STATUSES,
  RUNNING_IDEA_STATUSES, EXIT_REASON, CATCH_UP_MAX_SESSIONS_PER_CALL, PROCESS_QUALITY, PRACTICE_FIELD_BOOK_REGISTRY_ID,
} from './constants.js';
import { PracticeFieldError } from './errors.js';
import { practiceFieldLive } from './mode.js';
import {
  applyLedgerActions, valueLedger, withCloseMarks, suspectedActionSymbols, markedEquityCents, openAmbiguities, cloneLedger, REDATE_WINDOW_SESSIONS, withinSessions,
  shareBasisHolds, heldActionRecords, withBasisSuspicions, basisSuspicionRecords, delistingWaitingSymbols, unresolvedShareBasis,
  markProvenance, MARK_PROVENANCE_SOURCE,
} from './ledger.js';
import { closeMarkQuality } from './marks.js';
import { planRelease } from './admission.js';
import { coverageRefOf, coverageRef, coverageWithRef, coverageWithoutRef, ideaCoveragePlanFromLedgers } from './coverage.js';
import { assertReconciled } from './reconcile.js';
import { readLines, buildEndpoint, foldCloseIntoTrack, pendingSaleOf, completedLiquidation, ENDPOINT_KIND } from './settlement.js';
import { firstUnclosedSessionBefore } from './sessions.js';
import { toCents, fromCents } from './money.js';
import { buildResultEvidence, evidenceRefOf, EVIDENCE_PACKET, firestoreDocumentBytes, sealAdjustment } from './evidence.js';
import {
  windowsRefOf, expectedIntradayWindows, buildCloseWindowRow, windowOnlySessionsBefore, readWindowOnlySessions, writeWindowOnlySessions,
  WINDOW_ONLY_SESSIONS_PER_TX, WINDOWS_ACCOUNTED_FIELD, writeWindowActionReceipts, WINDOW_ACTION_KIND,
} from './windowLedger.js';
import { windowRowId, CLOSE_WINDOW, sessionClosePassEndMs, nextSessionDate } from './windows.js';
import {
  dailyDocOf, snapshotNamesDaily, unionActionsBySymbol, dailyActionsBySymbol, sessionCoverage, coveredThroughOf,
  coverageGapIdOf, CA_COVERAGE_GAP, backfillIdOf, successfulBackfill, shiftCalendarDate, heldSymbolsOf,
} from './dailyCoverage.js';
import { ensureCoverageBackfills } from './caBackfill.js';
import { applyFounderRulings, markRulingsApplied } from './holdRulings.js';
import {
  planLedgerAdjustments, closedHoldingsOf, resultAdjustmentView, adjustmentDocIdOf, heldAdjustments, openProposals, LATE_BLOCKER,
} from './adjustments.js';
import { dailyCoverageOf, rejectedRowDatesOf, closedDoubtIdOf } from './dailyCoverage.js';
import { MANDATE_CA_FETCH_LOOKBACK_DAYS } from '../mandateConfig.js';
import { stableStringify } from '../canonicalHash.js';

/**
 * Amendment F-9 (T2C-04): THE IDEA DOCUMENT'S SIZE. Every close rewrites a changed idea whole — its three ledgers and
 * every corporate-action receipt they keep — and Firestore refuses a document past 1 MiB, which would fail that close
 * for good. Before writing it, the close measures it (evidence.js firestoreDocumentBytes, Firestore's own storage
 * rules) and, FROM 768 KiB, alerts PRACTICE_FIELD_IDEA_DOC_LARGE with the size. The receipts stay on the idea.
 */
export const IDEA_DOC_ALERT_BYTES = 768 * 1024;
/** The alert for an idea document of `bytes` (null below the line). Pure. */
export function ideaDocSizeAlert(bookId, ideaId, bytes) {
  return bytes >= IDEA_DOC_ALERT_BYTES
    ? `PRACTICE_FIELD_IDEA_DOC_LARGE ${bookId} ${ideaId} ${bytes} bytes — the idea document is past ${IDEA_DOC_ALERT_BYTES} bytes (768 KiB) of Firestore's 1 MiB; a close that cannot write it fails for good`
    : null;
}

/** From this many sessions of doubt about a symbol's corporate-action coverage, the close alerts (Amendment F-1). */
export const CA_COVERAGE_GAP_ALERT_SESSIONS = 5;

const upperSym = (s) => String(s || '').trim().toUpperCase();
/** An idea's three ledgers, by field. */
const LEDGER_FIELDS = Object.freeze(['ledger', 'comparisonLedger', 'spyLedger']);

/** The trading sessions after `from` up to and including `through` (0 when `through` is not after it). */
function sessionsAfterThrough(from, through) {
  let n = 0;
  for (let s = nextSessionDate(from); typeof s === 'string' && s <= through && n < 1000; s = nextSessionDate(s)) n += 1;
  return n;
}

/**
 * Amendment F-1 — THE IDEA'S COVERAGE RECORD after one session's close. Pure.
 *   caCoveredThrough  per symbol held on any ledger: the last session whose corporate-action data covered it. A symbol
 *                     this close covered moves to the session; a symbol it did not keeps its date. A ticker change the
 *                     close applied hands the new symbol the session (it was applied because the symbol was covered and
 *                     its basis settled). A symbol no ledger holds any more is dropped.
 *   caCoverageGaps    per symbol in doubt: `{ since, from, firstSession, lastSession, sessions, reason, backfillNeeded,
 *                     alertedOn }` — `sessions` the sessions of doubt (every session after `since` up to this one).
 *                     From the fifth, PRACTICE_FIELD_CA_COVERAGE_GAP once per session.
 * An UNOBSERVED session presents no data and changes no ledger: no date moves, and an open gap only counts it.
 */
function coverageAfterClose(prior, next, { date, observed, coverage, renames }) {
  const held = heldSymbolsOf(next);
  const coveredThrough = {};
  const gaps = {};
  const alerts = [];
  const renamedTo = new Map(renames.map((r) => [upperSym(r.to), upperSym(r.from)]));
  for (const sym of held) {
    const source = renamedTo.has(sym) && !coverage.has(sym) ? renamedTo.get(sym) : sym;
    const c = coverage.get(source) ?? null;
    if (observed && c?.covered) { coveredThrough[sym] = date; continue; }
    const through = c?.coveredThrough ?? coveredThroughOf(prior, source);
    if (typeof through === 'string') coveredThrough[sym] = through;
    const open = prior?.caCoverageGaps?.[source] ?? null;
    // Unobserved: nothing was presented. An open gap counts the session; none is opened on a session nobody observed.
    if (!observed && open === null) continue;
    if (observed && (c === null || c.covered)) continue;
    const sessions = typeof through === 'string' ? sessionsAfterThrough(through, date) : null;
    const gap = {
      since: through ?? null, from: typeof through === 'string' ? shiftCalendarDate(through, 1) : null,
      firstSession: open?.firstSession ?? date, lastSession: date, sessions,
      reason: observed ? c.reason : (open?.reason ?? null), backfillNeeded: observed ? c.needsBackfill === true : (open?.backfillNeeded === true),
      alertedOn: open?.alertedOn ?? null,
    };
    if ((sessions === null || sessions >= CA_COVERAGE_GAP_ALERT_SESSIONS) && gap.alertedOn !== date) {
      alerts.push(`PRACTICE_FIELD_CA_COVERAGE_GAP ${next.ideaId} ${sym} — no corporate-action data has covered it since ${through ?? 'an unknown session'} (${sessions ?? '?'} sessions; ${gap.reason ?? 'unobserved'}${gap.backfillNeeded ? ', a backfill is needed' : ''}); its share basis is in doubt: nothing that depends on its count runs, its mark is carried, its sale waits — the founder may resolve it (resolve_hold, coverage_gap)`);
      gap.alertedOn = date;
    }
    gaps[sym] = gap;
  }
  return { coveredThrough, gaps, alerts };
}

/**
 * T1a-2b-4 fix round (Astra T2E-08; L-2 ④): THE SOLD HOLDINGS' COVERAGE DOUBTS on the idea's own ledger, after this close.
 * A rejected row the session's parse report names for a sold symbol, dated within its holding (after the entry, through
 * the sale — an undated one: the whole holding, from the day after the entry), is a doubt about what the holding was owed
 * that STICKS (`closedCoverageDoubts: { SYM: { id, dates: [{ date, seenOn, lastSeenOn }], through, evidence? } }`); a later
 * session that lists the symbol cleanly says nothing about that date.
 * A-4 (the founder's ruling, 21 Nov 2026; Astra T2E-C04): IT CLEARS ONLY BY THE FOUNDER'S `coverage_gap` RULING (`rulings`:
 * symbol → the ruling applied at this close, holdRulings.js), which clears every date it saw (it applies at the first
 * observed close after it was made, before that close's report is read). A rejection this close shows again is evidence
 * the ruling never saw: the date stands again (`lastSeenOn` names the last session that showed one, for the founder). No backfill clears it: a clean refetch (`backfills`, the successful
 * document read in the close's transaction) is kept on the doubt as EVIDENCE for the founder (`evidence.cleanRefetch`) and
 * acted on by nothing. (Before, a backfill fetched after the date's FIRST rejection cleared it — F-1 — so an older clean
 * fetch cleared a newer rejection of the same date, and the waiting approval posted at full quality: T2E-C04.) Unchanged:
 * the same ledger. Pure.
 */
export function withClosedCoverageDoubts(ledger, closed, { date, parseReport, backfills = new Map(), rulings = new Map() }) {
  const prior = ledger?.closedCoverageDoubts || {};
  const nextDoubts = {};
  for (const [sym, v] of Object.entries(prior)) if (!closed.has(sym)) nextDoubts[sym] = v;
  for (const [sym, c] of closed) {
    const inHolding = (d) => d <= c.through && (c.openedAt === null || d > c.openedAt);
    const rejected = rejectedRowDatesOf(parseReport, date, sym);
    const fresh = rejected.dates.filter(inHolding);
    if (rejected.undated) fresh.push(c.openedAt !== null ? shiftCalendarDate(c.openedAt, 1) : c.through);
    const ruling = rulings.get(sym) ?? null;
    // (The ruling applies at the first observed close after it was made, before this close's report is read: every rejection
    // it covers is one it saw, and one this close shows again is added back below.)
    const seenBy = (x) => (ruling?.covers?.dates || []).some((d) => d?.date === x.date);
    const kept = (prior[sym]?.dates || []).filter((x) => !(ruling && seenBy(x)));
    for (const d of fresh) {
      const i = kept.findIndex((x) => x.date === d);
      if (i < 0) kept.push({ date: d, seenOn: date, lastSeenOn: date });
      else if ((kept[i].lastSeenOn ?? kept[i].seenOn) !== date) kept[i] = { ...kept[i], lastSeenOn: date };
    }
    kept.sort((a, b) => a.date.localeCompare(b.date));
    if (kept.length === 0) continue;
    // (A-4: a clean refetch covering the doubt through the sale is shown to the founder — never acted on.)
    const bf = backfills.get(sym) ?? null;
    const evidence = bf !== null && bf.from <= kept[0].date && bf.to >= c.through
      ? { cleanRefetch: { from: bf.from, to: bf.to, fetchedAt: bf.fetchedAt ?? null, failed: false, rows: Array.isArray(bf.actions) ? bf.actions.length : 0 } }
      : (prior[sym]?.evidence ?? null);
    nextDoubts[sym] = { id: closedDoubtIdOf(sym, kept[0].date), dates: kept, through: c.through, ...(evidence ? { evidence } : {}) };
  }
  if (stableStringify(nextDoubts) === stableStringify(prior)) return ledger;
  const l = cloneLedger(ledger);
  if (Object.keys(nextDoubts).length > 0) l.closedCoverageDoubts = nextDoubts; else delete l.closedCoverageDoubts;
  return l;
}

/** The key of THE close snapshot for a date. */
export const closeSnapshotKeyFor = (date) => `${date}_close`;

const toIso = (v) => {
  if (v == null) return null;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return typeof v === 'string' ? v : null;
};

const quantitiesOf = (ledger) => Object.fromEntries(Object.entries(ledger.holdings).map(([s, h]) => [s, h.shares]));
/**
 * A row's marks. A mark CARRIED at this close (not from its snapshot) names where its price came from — the holding's
 * own `lastMarkProvenance`, which a carry leaves unchanged (Astra T2B-01) — as `carriedFrom`; a fresh mark is this
 * close's snapshot's (the row names its key).
 */
const marksOf = (valuation, ledger) => Object.fromEntries(Object.entries(valuation.marks).map(([s, m]) => [s, {
  mark: m.mark, quality: m.quality, markSource: m.markSource, vendorTimeIso: m.vendorTimeIso,
  ...(m.markSource !== 'snapshot' ? { carriedFrom: ledger?.holdings?.[s]?.lastMarkProvenance ?? null } : {}),
}]));

/** What applyLedgerActions answers when there is nothing to apply: the session has no stored snapshot, so no feed. */
const noActions = (ledger) => ({
  ledger, applied: [], declined: [], unresolved: new Set(), conflicts: [], shareBasisChanges: [], renames: [], renamesDeferred: [], renamesBlocked: [],
  held: [], closedByCash: [], delistedWaiting: [], redates: [], ambiguities: [],
});

/** A valuation of a session nobody observed: every mark is the carried one, and says so (E12). */
function unobservedValuation(ledger, date) {
  const v = valueLedger(ledger, null, { sessionDate: date });
  const marks = Object.fromEntries(Object.entries(v.marks).map(([s, m]) => [s, { ...m, quality: MARK_QUALITY.UNOBSERVED, vendorTimeIso: null }]));
  return { ...v, marks, fullQuality: false };
}

export { firstUnclosedSessionBefore };

/**
 * One FILLED idea at one session's close: actions applied to its three ledgers, each valued, its lines read, its row
 * — and, at its endpoint, its endpoint row and result. Pure. `closeSnapshot` is null for a session with no stored
 * document (an unobserved session).
 */
function closeFilledIdea(idea, {
  date, closeSnapshot, actionsBySymbol: sessionActions, heldByOthers = new Set(), sinceDate, snapshotMeta, nowIso, catchUp,
  daily = null, dailyRefOk = false, coverageInputs = new Map(), parseReport = null, closedBackfills = new Map(),
}) {
  // `heldByOthers`: the symbols another idea of the book holds, or would hold had its waiting rename applied (R-36).
  const observed = closeSnapshot !== null;
  // Amendment F-5: THE FOUNDER'S PENDING RULINGS (resolve_hold), applied first, once, at an observed close
  // (holdRulings.js): a retired suspicion and its reference mark, a declined record, the action a ruling supplies.
  const ruled = observed ? applyFounderRulings(idea, { date }) : null;
  if (ruled) idea = ruled.idea;
  const running = RUNNING_IDEA_STATUSES.includes(idea.status);
  const dueSession = idea.contract.schedule.dueSession;
  const alerts = [];

  // 0. Amendment F-1 — DOES THIS SESSION'S DATA COVER EACH HELD SYMBOL? From the day after the last session its data
  //    covered, without a hole, through this one: the session's own daily entry (F-6) — the snapshot naming that layer
  //    (F-2) — joined by a backfill when the gap is longer than the entry's window (dailyCoverage.js sessionCoverage).
  //    A symbol it does not cover is a doubt about its share basis: nothing count-dependent runs for it on any ledger
  //    of the idea (an item in the hold set below), its mark is carried and named so, and the screen leaves it alone.
  //    A backfill's rows join the session's rows for that symbol only, for this idea only.
  const coverage = new Map();
  const uncovered = new Set();
  let feedActions = sessionActions;
  if (ruled) alerts.push(...ruled.alerts);
  // The ids a ruling supplied, ledger by ledger (Astra T2D-09): not re-date-screened on that ledger only.
  const ruledIdsOf = (f) => ruled?.ruledIdsByLedger?.[f] ?? null;
  if (observed) {
    for (const [sym, input] of coverageInputs) {
      // F-5: a coverage-gap ruling counts the symbol's data as covered through the gap's last session.
      let coveredThrough = ruled?.coveredThroughOverrides.get(sym) ?? input.coveredThrough;
      // T1a-2b-4 (review AR4-B-3): A REJECTED ROW IS DATED. The session's parse report names each row the parser rejected;
      // the action it may be is dated where it was dated — on or before the last covered session, when it was listed late.
      // The doubt therefore reaches back to the day before it: data must cover the symbol again from that date (a backfill
      // past the window, which records its own report) before the doubt clears. A row with no readable date reaches back to
      // the idea's entry. A founder's coverage-gap ruling that covers the row's date settles it.
      if (!ruled?.coveredThroughOverrides.has(sym) && typeof coveredThrough === 'string') {
        const rejected = rejectedRowDatesOf(parseReport, date, sym);
        const ruledThrough = (idea.founderRulings || []).filter((x) => x?.kind === 'coverage_gap' && x.symbol === sym && x.appliedOn != null && typeof x.coversThrough === 'string').map((x) => x.coversThrough).sort().at(-1) ?? null;
        // (Fix-round refuter RFX-1: only a row dated while the idea held the stock — after its entry session — is one it can
        // be owed; one dated on or before the entry never reaches back, as `coveredThroughOf` already says.)
        const entry = idea.entry?.sessionDate ?? null;
        const dates = rejected.dates.filter((d) => (ruledThrough === null || d > ruledThrough) && (entry === null || d > entry));
        const floor = rejected.undated && ruledThrough === null ? (idea.entry?.sessionDate ?? null) : (dates.length > 0 ? shiftCalendarDate(dates[0], -1) : null);
        if (typeof floor === 'string' && floor < coveredThrough) coveredThrough = floor;
      }
      const r = sessionCoverage({ symbol: sym, session: date, coveredThrough, daily, dailyRefOk, backfill: input.backfill, parseReport });
      coverage.set(sym, { ...r, coveredThrough });
      if (!r.covered) uncovered.add(sym);
      // The rows of a SUCCESSFUL backfill the close read join this idea's rows for the symbol — when it covers the gap,
      // and (Astra T2D-02) at every catch-up close it serves, beside valid archived entries. Each is applied only through
      // the session being valued (the engine's onOrBefore), and once (the ledger's settled ids).
      // Amendment F rev 1 (S-1 ④, S-5; Astra T2D-C02, C05): every row joins, TAGGED as the backfill's, and each LEDGER
      // decides: a row of an id ambiguous on that ledger is recorded there (a payload the daily layer did not list is an
      // archive/backfill disagreement) and settles nothing; a genuine row of an id that ledger holds no open record of is
      // applied there as any row is. (The idea-wide filter here — AR1-RF-05 — dropped a genuine row from the comparison
      // because the idea disputed its id, and let a re-listed backfill payload settle the idea's own conflict.)
      const rows = input.backfillRows ?? (r.viaBackfill ? input.backfill?.actions : null);
      const tagged = Array.isArray(rows) ? rows.filter((a) => a && typeof a === 'object').map((a) => ({ ...a, feedOrigin: 'backfill' })) : [];
      if (tagged.length > 0) feedActions = unionActionsBySymbol(feedActions, { [sym]: tagged });
    }
    // (A-4, the founder's ruling of 21 Nov 2026: a sold holding's clean backfill — read because its coverage doubt stands — is
    // EVIDENCE for the founder, kept on the doubt (withClosedCoverageDoubts), and acted on by nothing: its rows no longer join
    // the idea's rows. R-4 joined them so the doubt could clear on them; only the founder's ruling clears it now.)
  }

  // One name, one idea (B-SAME): a ticker change INTO a symbol another idea of the book holds would put one ticker in
  // two ideas. It is applied to no ledger of this idea — the symbol is held at its carried mark, not full quality,
  // with an alert — instead of aborting the whole book's close on the book's mirror (review, lens 1).
  const renameBlocked = new Set();
  // The rows screened out here, id → the target the feed now names: a waiting rename's record of the same id takes
  // that target and does not stand in for the row (fix-round refuters, F2 and S1) — it would otherwise rename, later,
  // to a target the feed has corrected away from.
  const renameIdsScreened = new Map();
  // A ticker change the feed lists twice with different targets is a CONFLICT (ledger.js): the screen must not break it
  // up, or the row it leaves would apply (fix-round refuter, S2). Such an id is left whole for the ledger to refuse.
  const renameTargetsById = new Map();
  for (const list of Object.values(feedActions || {})) {
    for (const a of list || []) {
      if (a?.type !== 'ticker_change') continue;
      const id = deriveActionId(a);
      if (!renameTargetsById.has(id)) renameTargetsById.set(id, new Set());
      renameTargetsById.get(id).add(a.renamedTo ?? null);
    }
  }
  const actionsBySymbol = {};
  for (const [sym, list] of Object.entries(feedActions || {})) {
    actionsBySymbol[sym] = list.filter((a) => {
      if (a?.type !== 'ticker_change' || !heldByOthers.has(String(a.renamedTo || '').trim().toUpperCase())) return true;
      const id = deriveActionId(a);
      if (renameTargetsById.get(id).size > 1) return true;
      renameBlocked.add(sym);
      renameIdsScreened.set(id, String(a.renamedTo || '').trim().toUpperCase());
      return false;
    });
  }

  // 1. Corporate actions, once per ledger. While a symbol's share basis is unresolved on ANY ledger of the idea after
  //    this close's share-basis actions (the idea's hold set), nothing that depends on its share count is applied on
  //    ANY ledger of the idea — no cash delisting, no dividend, no later share-basis action (each is recorded on the
  //    holding and applied once the basis settles; fix round 2, T2A-C01) — and its ticker change waits (Astra T2A-01).
  //    FIRST, THE GAP SCREEN (fix round 3, Astra T2A-D01): asked of each ledger on the state its cash would be paid on
  //    (this close's share-basis rows applied, no cash), BEFORE any cash moves. A symbol it suspects of an unfed split
  //    is recorded on the holding (`basisSuspicion`), which makes its share basis unresolved — so the hold set below
  //    holds every count-dependent action of it, on every ledger of the idea, until a listed row explains the move or the
  //    founder resolves it.
  //    A holding the idea is waiting to sell on a delisting is screened on no ledger (R-32).
  // F-5, Astra T2D-09: EACH LEDGER'S ROWS. A ruling's action, and the feed rows of its id it replaces, belong to the
  // ledgers whose record it covers: each ledger is handed the session's rows less what a ruling replaces ON IT, plus
  // what a ruling adds ON IT. A ledger that never carried the record keeps the feed's own rows of that id.
  // Astra T2D-D02 (final fix): a pending founder SPLIT (a `suspicion` ruling) stands for the feed's rows of its id only when
  // every one of them AGREES with it — an agreeing duplicate is still applied once, as the founder's. Rows that disagree with
  // it, or with one another, are NOT replaced: they reach the ledger beside the founder's row, which is one more account of
  // the id (AR2-RF-1), so the ledger records the CONFLICT — on a covered close or not — and refuses the founder's split
  // (ledger.js, S-1 ①); only `resolve_hold(conflict)` settles the id. Replaced, they were only observed, and only into a
  // record that already existed: none did, so the founder's ratio applied over two vendor ratios the founder never saw.
  const disputedIdsOf = (f) => {
    const out = new Set();
    const replaced = ruled?.replacedIdsByLedger?.[f];
    if (!replaced || replaced.size === 0) return out;
    const same = (x, a) => (x?.ratio ?? null) === (a?.ratio ?? null) && (x?.amount ?? null) === (a?.amount ?? null) && (x?.cashPerShare ?? null) === (a?.cashPerShare ?? null);
    for (const list of Object.values(ruled.extraActionsByLedger[f] || {})) {
      for (const a of list || []) {
        if (a?.founderRuling?.kind !== 'suspicion' || !replaced.has(a.actionId)) continue;
        const vendor = Object.values(actionsBySymbol).flatMap((l) => l || []).filter((x) => x && deriveActionId(x) === a.actionId);
        if (vendor.some((x) => !same(x, a))) out.add(a.actionId);
      }
    }
    return out;
  };
  const disputedIds = Object.fromEntries(LEDGER_FIELDS.map((f) => [f, disputedIdsOf(f)]));
  const replacedIdsOf = (f) => {
    const all = ruled?.replacedIdsByLedger?.[f];
    if (!all || disputedIds[f].size === 0) return all ?? null;
    return new Set([...all].filter((id) => !disputedIds[f].has(id)));
  };
  const actionsOf = Object.fromEntries(LEDGER_FIELDS.map((f) => {
    if (!ruled) return [f, actionsBySymbol];
    const replaced = replacedIdsOf(f);
    const kept = replaced.size === 0 ? actionsBySymbol
      : Object.fromEntries(Object.entries(actionsBySymbol).map(([sym, list]) => [sym, (list || []).filter((a) => !replaced.has(deriveActionId(a)))]));
    return [f, unionActionsBySymbol(kept, ruled.extraActionsByLedger[f])];
  }));
  const delistingWaiting = delistingWaitingSymbols(idea.ledger);
  // F-1: a symbol the session's data does not cover holds every count-dependent action of it dated after the last
  // session its data covered, on every ledger of the idea — and its rename (deferRenames, below). Amendment F rev 1
  // (S-4; Astra T2D-C04): the SAME holds are handed to both dry runs — the gap screen's and the hold set's — so a split
  // coverage keeps from applying is not simulated there either (simulated, it retired the record the real holding still
  // stood under, and the next halving seen while it stood was never recorded).
  const coverageHolds = new Map([...uncovered].map((sym) => {
    const c = coverage.get(sym);
    return [sym, [{ actionId: coverageGapIdOf(sym, c.coveredThrough), type: CA_COVERAGE_GAP, effectiveDate: c.coveredThrough, since: c.coveredThrough, ledger: 'idea' }]];
  }));
  // …and every ledger's OPEN SHARE-BASIS AMBIGUITY, known before the screen (AR2-B-2): the real applier holds what is dated
  // after one on EVERY ledger of the idea (the hold set), so the dry runs must too — or a split another ledger's doubt
  // keeps from applying is simulated, and retires the record the real holding still stands under.
  const dryHolds = new Map(coverageHolds);
  for (const [f, name] of [['ledger', 'idea'], ['comparisonLedger', 'comparison'], ['spyLedger', 'spy']]) {
    for (const r of openAmbiguities(idea[f])) {
      if (!['split', 'reverse_split', 'stock_distribution'].includes(r.type)) continue;
      // (An id a pending conflict ruling settles at this close is the ruling's: not a doubt that holds its own action.)
      if (LEDGER_FIELDS.some((g) => ruledIdsOf(g)?.has(r.actionId))) continue;
      const sym = String(r.ticker || '').trim().toUpperCase();
      dryHolds.set(sym, [...(dryHolds.get(sym) || []), { actionId: r.actionId, type: r.type, effectiveDate: r.effectiveDate ?? null, ledger: name, ambiguous: true }]);
    }
  }
  const screen = (ledger, f) => (observed ? withBasisSuspicions(ledger, closeSnapshot, actionsOf[f], { sinceDate, date, delistingWaiting, skip: uncovered, ruledIds: ruledIdsOf(f), pricesUsable: dailyRefOk, holds: dryHolds }).ledger : ledger);
  const ledgers = LEDGER_FIELDS.map((f) => screen(idea[f], f));
  const holds = observed ? shareBasisHolds(ledgers, LEDGER_FIELDS.map((f) => actionsOf[f]), { date, ruledIds: LEDGER_FIELDS.map(ruledIdsOf), holds: dryHolds }) : null;
  // (T1a-2b-4 — the late soak's 1795727403, I-5: an id a pending ruling settles at this close is the ruling's on a holding
  // since closed too, where the plan below applies it. For a held symbol the dry run already applied it; for a closed one
  // it stood in the hold set and held the comparison's later dividend at the ruling's own close — and a re-run paid it.)
  if (holds) {
    for (const [sym, items] of [...holds]) {
      const kept = items.filter((i) => !LEDGER_FIELDS.some((g) => ruledIdsOf(g)?.has(i.actionId)));
      if (kept.length === 0) holds.delete(sym); else if (kept.length !== items.length) holds.set(sym, kept);
    }
  }
  for (const [sym, items] of coverageHolds) holds.set(sym, [...(holds.get(sym) || []), ...items]);
  // (AR2-IR-2: a rename waits idea-wide while its symbol has an open ambiguity on any ledger — a cash one too.)
  const deferRenames = holds ? new Set([...holds.keys(), ...ledgers.flatMap((l) => openAmbiguities(l).filter((r) => r.type !== 'ticker_change' && !LEDGER_FIELDS.some((g) => ruledIdsOf(g)?.has(r.actionId))).map((r) => String(r.ticker || '').trim().toUpperCase()))]) : null;
  // (AR2-C-1: the feed's rows a pending ruling replaces on a ledger reach its applier apart, to be OBSERVED only.)
  const replacedRowsOf = (f) => {
    const replaced = replacedIdsOf(f);
    if (!replaced || replaced.size === 0) return null;
    return Object.fromEntries(Object.entries(actionsBySymbol).map(([sym, list]) => [sym, (list || []).filter((a) => replaced.has(deriveActionId(a)))]));
  };
  // (A-2: rows listed ahead are observed only at a close whose OWN DAILY LAYER covers the symbol — the session's refusal for
  // it, as the sold holding's doubt reads it below — for a symbol any ledger of the idea holds, and one the idea has SOLD.
  // The session's coverage is not enough: a stored backfill reaching through the session — one global document per symbol,
  // written for any book — makes a refused session count as covered, though it vouches for nothing dated after the session;
  // the rows an announcement reads ahead come from the refused daily alone. The refuter's RF-1: the same inputs paid $199.94
  // or waited for the founder depending on another book's backfill.)
  const observedSymbols = new Set([
    ...LEDGER_FIELDS.flatMap((f) => Object.keys(idea[f]?.holdings || {})),
    ...closedHoldingsOf(idea.ledger, { entrySession: idea.entry?.sessionDate ?? null }).keys(),
  ].map((s) => String(s || '').trim().toUpperCase()));
  const dailyRefused = new Set([...observedSymbols].filter((sym) => !dailyRefOk || dailyCoverageOf(daily, sym, parseReport).refusal !== null));
  const opts = (f) => ({ date, holds, deferRenames, renameTargetsTaken: heldByOthers, renameIdsScreened, ruledIds: ruledIdsOf(f), replacedRows: replacedRowsOf(f), uncoveredSymbols: dailyRefused });
  const own = observed ? applyLedgerActions(ledgers[0], actionsOf.ledger, opts('ledger')) : noActions(ledgers[0]);
  const cmp = observed ? applyLedgerActions(ledgers[1], actionsOf.comparisonLedger, opts('comparisonLedger')) : noActions(ledgers[1]);
  const spy = observed ? applyLedgerActions(ledgers[2], actionsOf.spyLedger, opts('spyLedger')) : noActions(ledgers[2]);

  // T1a-2b-4: LATE AND CORRECTED DATA (adjustments.js) — each ledger's adjustments, after its actions and before its
  // marks: a dividend first listed after the idea sold the stock (late_entitlement, T2D-03), a dividend a late split
  // predates recomputed (late_basis, T2D-04), and the founder's corrections of settled ids (ruled_correction, T2D-05).
  // Each posts into the ledger's own cash (the idea is open); none while the symbol is in doubt on the idea.
  const adjusted = { ledger: null, comparisonLedger: null, spyLedger: null };
  const standingReasons = [...(ruled?.standingReasons || [])];
  if (observed) {
    const closedDoubt = (sym) => !dailyRefOk || dailyCoverageOf(daily, sym, parseReport).refusal !== null;
    for (const [f, out, name] of [['ledger', own, 'idea'], ['comparisonLedger', cmp, 'comparison'], ['spyLedger', spy, 'spy']]) {
      const closed = f === 'ledger' ? closedHoldingsOf(out.ledger, { entrySession: idea.entry?.sessionDate ?? null }) : new Map();
      // T1a-2b-4 fix round (Astra T2E-08; L-2 ④): A REJECTED ROW DATED WITHIN A SOLD HOLDING is not forgotten once the line is
      // sold. The session's parse report naming a rejected row of the symbol dated after the entry and through the sale is a
      // doubt about its history that STICKS on the ledger (`closedCoverageDoubts`), until a backfill with a clean parse report
      // covers that date (`closedBackfills`, read in the close's transaction) — a late proposal of the symbol is refused
      // while it stands, and the founder may decline it. (Held, the symbol's B-3 floor does this: AR4-B-3, RFX-1.)
      // (A-4: the founder's `coverage_gap` ruling of a sold holding's doubt, applied at this close, is the only thing that clears it.)
      if (closed.size > 0) out.ledger = withClosedCoverageDoubts(out.ledger, closed, { date, parseReport, backfills: closedBackfills, rulings: f === 'ledger' ? (ruled?.closedDoubtRulings ?? new Map()) : new Map() });
      // (Review AR4-A-4 / AR4-C-10: a hold item an id a pending ruling settles at this close is the ruling's, not a doubt —
      // for a held symbol the dry run applies the ruled action and the item is gone; for a closed one nothing applies it, so
      // the founder's own action was deferred by its own record and the ruling closed moot.)
      const ruledHere = (id) => LEDGER_FIELDS.some((g) => ruledIdsOf(g)?.has(id));
      // (Fix round: A DOUBT IN THE COUNT ON AN EX-DATE, dated as the held path dates it — ledger.js causesOf: a coverage gap
      // holds whatever its date (T2D-07); a suspicion holds what is dated after its `since`; any other unresolved share-basis
      // item holds what is dated on or after it. An item dated after the ex-date cannot change its count — the shape soak's
      // 2120900020 and 2120900137: a split ambiguity, or a suspicion, dated after a dividend deferred its ruled correction.)
      const itemHolds = (i, d) => i.type === CA_COVERAGE_GAP || typeof i.effectiveDate !== 'string' || typeof d !== 'string'
        || (i.type === 'suspected_split' ? (typeof i.since !== 'string' || d > i.since) : i.effectiveDate <= d);
      const ownItems = observed ? unresolvedShareBasis(out.ledger, actionsOf[f], { date }) : new Map();
      const doubtOn = (sym, d) => uncovered.has(sym) || (closed.has(sym) && closedDoubt(sym))
        || [...(holds?.get(sym) || []), ...(ownItems.get(sym) || [])].some((i) => !ruledHere(i.actionId) && itemHolds(i, d));
      // (Fix-round refuter R-5: a sold holding's STICKY coverage doubt holds what the founder's RULING would post — a rejected
      // row dated on or before the ex-date, or within the re-date window of it, may be a split the count misses or the
      // dividend itself moved. A proposal is still made and named, its approval refused while the doubt stands (L-2 ④).)
      const rulingDoubtOn = (sym, d) => closed.has(sym) && (out.ledger.closedCoverageDoubts?.[sym]?.dates || [])
        .some((x) => typeof d !== 'string' || x.date <= d || withinSessions(x.date, d, REDATE_WINDOW_SESSIONS));
      // L-2: the close's own refusals of an approval — an uncovered date, a share-basis id DATED WITHIN THE HOLDING unresolved
      // on any ledger (the idea's hold set; a suspicion whose move began within it) — named on each proposal.
      const within = (i, end, openedAt) => (typeof i.effectiveDate !== 'string' || ((openedAt === null || i.effectiveDate > openedAt) && i.effectiveDate <= end))
        || (i.type === 'suspected_split' && (typeof i.since !== 'string' || i.since < end));
      const blockersOf = (sym, d, { end = date, openedAt = null } = {}) => [
        ...(uncovered.has(sym) || (closed.has(sym) && closedDoubt(sym)) ? [`${LATE_BLOCKER.UNCOVERED}:${date}`] : []),
        ...[...(holds?.get(sym) || []), ...(ownItems.get(sym) || [])].filter((i) => !ruledHere(i.actionId) && (i.type === CA_COVERAGE_GAP || within(i, end, openedAt)))
          .map((i) => (i.type === CA_COVERAGE_GAP ? `${LATE_BLOCKER.UNCOVERED}:${i.since ?? i.effectiveDate}` : `${LATE_BLOCKER.SHARE_BASIS}:${i.actionId}`)),
        ...((out.ledger.closedCoverageDoubts?.[sym]?.dates || []).map((x) => `${LATE_BLOCKER.UNCOVERED}:${x.date}`)),
      ];
      const plan = planLedgerAdjustments(out.ledger, {
        ideaId: idea.ideaId, ledgerKind: name, date, rows: actionsOf[f], ruledIds: ruledIdsOf(f), closed, doubtOn, rulingDoubtOn, blockersOf,
        corrections: ruled?.amountCorrectionsByLedger?.[f] ?? [], approvals: ruled?.lateApprovalsByLedger?.[f] ?? [],
      });
      out.ledger = plan.ledger;
      adjusted[f] = plan;
      alerts.push(...plan.alerts);
      standingReasons.push(...plan.standingReasons);
      for (const h of heldAdjustments(plan.ledger)) if (!plan.held.some((x) => x.id === h.id)) alerts.push(`PRACTICE_FIELD_ADJUSTMENT_HELD ${idea.ideaId} ${name} ${h.actionId} — a ${h.kind} debit of $${-h.amountUsd} still waits (${h.reason}), for the founder`);
    }
  }

  for (const [name, out] of [['idea', own], ['comparison', cmp], ['spy', spy]]) {
    const blocked = new Set([...renameBlocked, ...out.renamesBlocked.map((b) => b.from)]);
    for (const sym of blocked) {
      if (!Object.hasOwn(out.ledger.holdings || {}, sym)) continue;
      out.unresolved.add(sym);
      alerts.push(`PRACTICE_FIELD_RENAME_BLOCKED ${idea.ideaId} ${name} ${sym} — a ticker change into a symbol another idea of the book holds is not applied; the holding is valued at its carried mark`);
    }
    // Every open gap-screen suspicion, at every close it stands — also once the price has recovered (fix round 3).
    for (const s of basisSuspicionRecords(out.ledger)) {
      alerts.push(`PRACTICE_FIELD_BASIS_SUSPECTED ${idea.ideaId} ${name} ${s.symbol} ${s.actionId} — a move with a split's shape (×${s.ratio}) that no feed row explains, first seen ${s.suspectedOn}; the share basis is unresolved: nothing that depends on the count is applied, the mark is carried, the sale waits — until a listed share-basis row explains it or the founder resolves it`);
    }
    // Every action a holding is owed that waits on its share basis, at every close it waits (fix round 2).
    for (const r of heldActionRecords(out.ledger)) {
      const on = (r.heldBecause || []).map((c) => `${c.actionId}@${c.ledger}`).join(', ');
      alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_HELD ${idea.ideaId} ${name} ${r.symbol} ${r.actionId} — the holding's share basis is unresolved (${on}); not applied, nothing credited or released (held since ${r.heldOn})`);
    }
    // Amendment F rev 1: what this close learned about ambiguity on this ledger — a conflict, a revision, a payload an open
    // record had not seen, a ruled id revised since — each waits for the founder (resolve_hold, conflict).
    for (const a of out.ambiguities || []) {
      alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_AMBIGUOUS ${idea.ideaId} ${name} ${a.ticker} ${a.actionId} — ${a.how}${a.redateOf ? ` of ${a.redateOf}` : ''} (${a.payloads} payload${a.payloads === 1 ? '' : 's'} recorded): ambiguous, so only the founder's ruling settles it — nothing is applied, declined or replayed for it meanwhile (resolve_hold, conflict)`);
    }
    // F-7: a row this close did not apply because it may be one already applied or held, under a moved date.
    for (const r of out.redates || []) {
      alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_REDATE ${idea.ideaId} ${name} ${r.actionId} — the same ${r.type} as ${r.redateOf}, under a moved date (within ${REDATE_WINDOW_SESSIONS} sessions): not applied, and ${['split', 'reverse_split', 'stock_distribution'].includes(r.type) ? 'the share basis is in doubt until it is settled' : 'nothing else is held'} — the founder may apply it (resolve_hold, conflict)`);
    }
    for (const d of out.renamesDeferred) {
      alerts.push(`PRACTICE_FIELD_RENAME_DEFERRED ${idea.ideaId} ${name} ${d.from}→${d.to} ${d.actionId} — the holding's share basis is unresolved; the ticker change waits (since ${d.deferredOn}), the holding keeps its symbol and its sale stays held`);
    }
  }

  // A split moves the line's level by the same ratio as the quantity (a price is per share).
  let lines = idea.lines;
  for (const change of own.shareBasisChanges) {
    lines = lines.map((l) => (l.symbol === change.ticker
      ? { ...l, level: l.level / change.ratio, adjustments: [...(l.adjustments || []), { actionId: change.actionId, ratio: change.ratio, appliedOn: date }] }
      : l));
  }
  // T1a-2b-4 (T2D-05): the founder's correction of a split's ratio moves the line's level by the same factor as the count.
  for (const c of (ruled?.shareCorrections || []).filter((x) => x.field === 'ledger' && x.held !== false)) {
    lines = lines.map((l) => (l.symbol === c.symbol
      ? { ...l, level: l.level / c.factor, adjustments: [...(l.adjustments || []), { actionId: c.actionId, ratio: c.factor, appliedOn: date, correction: true }] }
      : l));
  }
  // A ticker change renames the line and its unobserved record with the holding (E11). No cash moves.
  let unobservedLineSessions = idea.unobservedLineSessions || {};
  for (const rename of own.renames) {
    lines = lines.map((l) => (l.symbol === rename.from
      ? { ...l, symbol: rename.to, renamedFrom: [...(l.renamedFrom || []), { symbol: rename.from, actionId: rename.actionId, appliedOn: date }] }
      : l));
    if (Object.hasOwn(unobservedLineSessions, rename.from)) {
      const { [rename.from]: moved, ...rest } = unobservedLineSessions;
      unobservedLineSessions = { ...rest, [rename.to]: [...(rest[rename.to] || []), ...moved] };
    }
  }
  // A delisting with no cash amount is never applied as a sale (E11): the idea's own holding becomes a waiting sale
  // (E9), sold only when a window shows an eligible price. A holding already waiting keeps its record.
  let ownLedger = own.ledger;
  if (running) {
    for (const d of own.delistedWaiting) {
      const h = ownLedger.holdings[d.ticker];
      if (!h || pendingSaleOf(h)) continue;
      ownLedger = cloneLedger(ownLedger);
      ownLedger.holdings[d.ticker] = {
        ...h, exitPending: { reason: EXIT_REASON.DELISTING, session: date, at: nowIso, actionId: d.actionId, recognisedLate: catchUp === true, waiting: null },
      };
      alerts.push(`PRACTICE_FIELD_DELISTING_WAITING ${idea.ideaId} ${d.ticker} ${d.actionId} — a delisting with no cash amount is not applied; the holding waits for an eligible price`);
    }
  }

  // 2. Marks. A symbol with an unresolved or suspected action is valued at its carried mark. One the session's
  //    corporate-action data does not cover is carried and NAMED so (`ca_coverage_missing`, F-1): never a fresh price
  //    written over a count the data cannot vouch for (refuter R8).
  const carriedQuality = new Map([...uncovered].map((sym) => [sym, MARK_QUALITY.CA_COVERAGE_MISSING]));
  const value = (ledger, unresolved, f) => {
    if (!observed) return { valuation: unobservedValuation(ledger, date), frozen: new Set() };
    const frozen = new Set([...unresolved, ...uncovered, ...suspectedActionSymbols(ledger, closeSnapshot, actionsOf[f], { sinceDate, date })]);
    return { valuation: valueLedger(ledger, closeSnapshot, { sessionDate: date, frozen, carriedQuality }), frozen };
  };
  const ownV = value(ownLedger, own.unresolved, 'ledger');
  const cmpV = value(cmp.ledger, cmp.unresolved, 'comparisonLedger');
  const spyV = value(spy.ledger, spy.unresolved, 'spyLedger');
  // Conflicts recorded on a ledger and not settled since (neither applied nor declined), this close's included.
  // Amendment F rev 1: every open ambiguity — a conflict, a possible re-date, a ruled id revised since — on any ledger.
  const openConflicts = [['idea', ownLedger], ['comparison', cmp.ledger], ['spy', spy.ledger]].flatMap(([name, ledger]) => openAmbiguities(ledger).map((r) => ({ name, actionId: r.actionId, reason: r.reason })));
  // T1a-2b-4 (review AR4-A-2): a row listed for a holding since closed that WAITS on a doubt (`closedHeldRows`) is money the
  // idea may be owed and has not been paid — the row is not full quality while it waits, and it is alerted at every close.
  for (const [name, ledger] of [['idea', ownLedger], ['comparison', cmp.ledger], ['spy', spy.ledger]]) {
    for (const r of ledger?.closedHeldRows || []) {
      openConflicts.push({ name, actionId: r.actionId, reason: 'closed_held' });
      alerts.push(`PRACTICE_FIELD_LATE_ROW_WAITING ${idea.ideaId} ${name} ${r.ticker} ${r.actionId} — a ${r.type} dated ${r.effectiveDate}, listed after the holding closed (${r.closedOn}), waits on a doubt since ${r.heldOn}; not paid, the row is not full quality`);
    }
    // T1a-2b-4 fix round (L-1): A LATE PROPOSAL waiting for the founder is money the ledger may be owed and has not been paid:
    // the row is not full quality while it waits, it is named, and it is alerted at every close.
    for (const p of openProposals(ledger)) {
      openConflicts.push({ name, actionId: p.id, reason: 'late_proposal' });
      alerts.push(`PRACTICE_FIELD_LATE_PROPOSAL_WAITING ${idea.ideaId} ${name} ${p.actionId} ${p.id} — a ${p.kind} of $${p.netUsd}, proposed ${p.proposedOn}${(p.blockers || []).length > 0 ? `; approval refused while ${p.blockers.join(', ')} stands` : ''}: not posted until the founder approves it (resolve_hold, late_adjustment)`);
    }
    // (T2E-08: a sold holding's sticky coverage doubt — named, and it refuses the approval of a proposal of the symbol.)
    for (const [sym, x] of Object.entries(ledger?.closedCoverageDoubts || {})) {
      alerts.push(`PRACTICE_FIELD_CLOSED_COVERAGE_DOUBT ${idea.ideaId} ${name} ${sym} ${x.id ?? ''} — a rejected row dated ${x.dates.map((d) => d.date).join(', ')}, within the holding sold ${x.through}: what it was owed is in doubt until the founder rules it (resolve_hold, coverage_gap)${x.evidence?.cleanRefetch ? `; a clean refetch through ${x.evidence.cleanRefetch.to} is evidence for the ruling, acted on by nothing` : ''}; a late proposal of it is not approved meanwhile`);
    }
  }

  // An unobserved session changes no ledger: there is nothing to write a mark from.
  let next = {
    ...idea,
    ledger: observed ? withCloseMarks(ownLedger, ownV.valuation, { date, snapshotKey: snapshotMeta.key }) : ownLedger,
    comparisonLedger: observed ? withCloseMarks(cmp.ledger, cmpV.valuation, { date, snapshotKey: snapshotMeta.key }) : cmp.ledger,
    spyLedger: observed ? withCloseMarks(spy.ledger, spyV.valuation, { date, snapshotKey: snapshotMeta.key }) : spy.ledger,
    lines,
    lastValuedOn: observed ? date : (idea.lastValuedOn ?? null),
    lastClosedOn: date,
    revision: (idea.revision || 0) + 1,
  };
  if (Object.keys(unobservedLineSessions).length > 0 || idea.unobservedLineSessions) next.unobservedLineSessions = unobservedLineSessions;
  // T1a-2b-4 fix round (L-6; Astra T2E-05, Q-5 as ruled): A STANDING REASON — a correction of a split the idea sold after, or a
  // split first listed after the sale, left the shares it SOLD different from the shares it was OWED. The sale stands; from
  // that close on every row, the endpoint and the result read below full quality, the reason beside the result. Durable on
  // the idea (`standingQualityReasons`), one per kind, symbol and action.
  {
    const known = [...(idea.standingQualityReasons || [])];
    for (const r of standingReasons) if (!known.some((k) => k.kind === r.kind && k.symbol === r.symbol && k.actionId === r.actionId)) known.push(r);
    if (known.length > 0) next.standingQualityReasons = known;
    for (const r of known) alerts.push(`PRACTICE_FIELD_STANDING_QUALITY_REASON ${idea.ideaId} ${r.symbol} ${r.actionId} — ${r.kind} (${r.via}, since ${r.since}): the sale stands; every row, the endpoint and the result read below full quality`);
  }
  // F-5: a ruling whose action is now settled on every ledger that holds its symbol is applied.
  if (ruled) {
    // F-5: a founder split this close found moot on a ledger (its record gone there, or standing for another move now).
    const skips = new Set();
    const refusals = new Map();
    for (const [f, out] of [['ledger', own], ['comparisonLedger', cmp], ['spyLedger', spy]]) {
      for (const s of out.founderSkips || []) skips.add(`${s.requestKey}@${f}`);
      // Astra T2D-10: a ruling's action the applier refused for good on this ledger.
      for (const s of out.founderRefusals || []) refusals.set(`${s.requestKey}@${f}`, s.reason);
    }
    const m = markRulingsApplied(next, { date, skips, refusals });
    next = m.idea;
    alerts.push(...m.alerts);
  }
  // T1a-2b-4 (review AR4-C-2, C-8): a founder's correction not yet posted on every ledger it names (a doubt deferred it)
  // is money the ruling moves and has not moved: the row is not full quality while it waits, and it is alerted.
  for (const r of next.founderRulings || []) {
    if (!r || r.appliedOn != null || r.kind !== 'conflict' || r.corrects !== true) continue;
    openConflicts.push({ name: 'ruling', actionId: r.recordId, reason: 'correction_pending' });
    alerts.push(`PRACTICE_FIELD_CORRECTION_WAITING ${idea.ideaId} ${r.recordId} — the founder's correction (${r.requestKey}) is not yet posted on every ledger it names; the row is not full quality until it is`);
  }
  // T1a-2b-4: an idea that already carries a result (settled, waiting for its settlement sale) keeps it; its readers show
  // the adjustments posted after its endpoint beside it, with `wouldChangeLabel` (adjustments.js resultAdjustmentView).
  if (next.result) {
    const view = resultAdjustmentView(next);
    if (view !== null) next.resultAdjustments = view;
  }
  // F-1: the coverage record, after this close (coverageAfterClose).
  {
    const after = coverageAfterClose(idea, next, { date, observed, coverage, renames: [...own.renames, ...cmp.renames, ...spy.renames] });
    next.caCoveredThrough = after.coveredThrough;
    if (Object.keys(after.gaps).length > 0 || idea.caCoverageGaps) next.caCoverageGaps = after.gaps;
    alerts.push(...after.alerts);
  }

  // 3. The lines, on every session up to and including the due one, while the idea runs (E6, E7).
  let lineRead = null;
  if (running && date <= dueSession) {
    lineRead = readLines({
      idea: next, valuation: observed ? ownV.valuation : null, date, isDueSession: date === dueSession,
      late: catchUp === true, recognisedAtIso: nowIso, snapshotKey: snapshotMeta.key,
    });
    next = { ...next, lines: lineRead.lines, ledger: { ...next.ledger, holdings: lineRead.holdings }, unobservedLineSessions: lineRead.unobservedLineSessions };
    // E12, E15: a line recognised while catching up was recognised LATE — a code action that did not happen at its
    // first eligible moment. It is recorded as late on the line, and the idea's process quality reads blocked.
    if (catchUp && lineRead.breaches.length > 0) {
      const late = lineRead.breaches.map((b) => ({ kind: 'line_recognised_late', symbol: b.symbol, session: b.session }));
      next = { ...next, blockedBy: [...(next.blockedBy || []), ...late], processQuality: PROCESS_QUALITY.BLOCKED };
    }
  }
  // The status follows what the holdings carry (E14).
  if (running) {
    const holdings = Object.values(next.ledger.holdings);
    const waitingToExit = holdings.some((h) => h.exitPending != null);
    const status = waitingToExit ? IDEA_STATUS.LINE_HIT_EXIT_PENDING
      : (holdings.length > 0 ? IDEA_STATUS.HOLDING : next.status);
    if (status !== next.status) next = { ...next, status, statusHistory: [...(next.statusHistory || []), { status, at: nowIso }] };
  }

  // 4. The row. The gap is computed from the ROUNDED, displayed values (BUILD_RULES §9); raw values sit beside.
  const valueCents = toCents(ownV.valuation.markedValue);
  const comparisonCents = toCents(cmpV.valuation.markedValue);
  const spyCents = toCents(spyV.valuation.markedValue);
  const reservedCents = toCents(idea.contract.capitalUsd);
  const row = {
    schemaVersion: IDEA_SCHEMA_VERSION,
    rowKind: 'valuation',
    basis: 'mark',
    // A session with no stored close snapshot is not a post-close snapshot value: it says `unobserved` (review RH-8).
    label: observed ? VALUATION_LABEL : VALUATION_LABEL_UNOBSERVED,
    date,
    ideaId: idea.ideaId,
    bookId: idea.bookId,
    closeSnapshotKey: snapshotMeta.key,
    closeSnapshotBuiltAt: snapshotMeta.builtAt,
    reservedCapitalUsd: idea.contract.capitalUsd,
    markedValue: ownV.valuation.markedValue,
    cash: ownV.valuation.cash,
    markedHoldingsValue: ownV.valuation.markedHoldingsValue,
    quantities: quantitiesOf(ownLedger),
    marks: marksOf(ownV.valuation, ownLedger),
    cumulativeCostsUsd: ownLedger.costsPaidUsd,
    dividendsToDateUsd: ownLedger.dividendsUsd,
    comparisonType: idea.contract.comparison.type,
    comparisonMarkedValue: cmpV.valuation.markedValue,
    comparisonCash: cmpV.valuation.cash,
    comparisonQuantities: quantitiesOf(cmp.ledger),
    comparisonMarks: marksOf(cmpV.valuation, cmp.ledger),
    comparisonCumulativeCostsUsd: cmp.ledger.costsPaidUsd,
    spyMarkedValue: spyV.valuation.markedValue,
    spyCash: spyV.valuation.cash,
    spyQuantities: quantitiesOf(spy.ledger),
    spyMarks: marksOf(spyV.valuation, spy.ledger),
    markedGapUsd: fromCents(valueCents - comparisonCents),
    markedGapPct: ((valueCents - comparisonCents) * 100) / reservedCents,
    markedGapToSpyUsd: fromCents(valueCents - spyCents),
    markedGapToSpyPct: ((valueCents - spyCents) * 100) / reservedCents,
    raw: {
      markedValue: ownV.valuation.rawValue,
      comparisonMarkedValue: cmpV.valuation.rawValue,
      spyMarkedValue: spyV.valuation.rawValue,
      markedGapUsd: ownV.valuation.rawValue - cmpV.valuation.rawValue,
    },
    corporateActionsApplied: {
      idea: own.applied.map((a) => a.actionId), comparison: cmp.applied.map((a) => a.actionId), spy: spy.applied.map((a) => a.actionId),
    },
    // Not full quality while any ledger of the idea holds an UNSETTLED conflicting action (review FR-A1): after the
    // feed stops presenting a conflict, its symbol is marked fresh again, but the action — a dividend's income, say —
    // was never applied, so the row must not read as clean until a consistent row settles it.
    fullQuality: observed && ownV.valuation.fullQuality && cmpV.valuation.fullQuality && spyV.valuation.fullQuality && openConflicts.length === 0
      && (next.standingQualityReasons || []).length === 0,
    // Always true since Amendment D's Q-1 (a leg with no resolvable cost tier does not enter); kept on the row because
    // T1a-1's rows carry it.
    entryCostTiersKnown: (idea.entry?.unknownCostTierLegs || []).length === 0,
    // E12: was this session's close snapshot stored? An unobserved row carries marks, never observations.
    observed,
  };
  // (L-6: the standing reasons, by name, on every row they hold below full quality.)
  if ((next.standingQualityReasons || []).length > 0) row.standingQualityReasons = next.standingQualityReasons.map((r) => ({ kind: r.kind, symbol: r.symbol, actionId: r.actionId, since: r.since }));
  // What each line read at this close (E6): 'below', 'at_or_above' or 'unobserved', by symbol.
  if (lineRead) row.lineObservations = lineRead.observations;
  if (catchUp) row.caughtUpAt = nowIso;

  for (const [name, set] of [['idea', ownV.frozen], ['comparison', cmpV.frozen], ['spy', spyV.frozen]]) {
    for (const sym of set) alerts.push(`PRACTICE_FIELD_MARK_HELD_BACK ${idea.ideaId} ${name} ${sym} — unresolved or suspected corporate action; valued at its carried mark`);
  }
  const seenToday = new Set();
  for (const [name, out] of [['idea', own], ['comparison', cmp], ['spy', spy]]) {
    for (const c of out.conflicts) {
      seenToday.add(`${name} ${c.actionId}`);
      alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_CONFLICT ${idea.ideaId} ${name} ${c.actionId} — the feed lists it ${c.rows.length} times with different payloads; applied to no ledger`);
    }
  }
  for (const c of openConflicts) {
    if (!seenToday.has(`${c.name} ${c.actionId}`)) alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_UNSETTLED ${idea.ideaId} ${c.name} ${c.actionId} — an ambiguous action (${c.reason}) waits for the founder's ruling (resolve_hold, conflict); nothing is applied for it and the row is not full quality`);
  }

  // The running record the result is built from: every close while the idea runs, the endpoint's own included.
  if (running) next = { ...next, track: foldCloseIntoTrack(idea.track, row, { observed }) };

  // 5. The endpoint and the result: on the due session (E4), or as soon as nothing is held (E2). Written ONCE — an
  //    idea that carries a result never gets another (build prompt §6).
  let endpointRow = null;
  const nothingHeld = Object.keys(next.ledger.holdings).length === 0;
  if (running && next.result == null && (date >= dueSession || nothingHeld)) {
    const kind = date > dueSession ? ENDPOINT_KIND.LATE : (date === dueSession ? ENDPOINT_KIND.DUE_SESSION : ENDPOINT_KIND.EARLY_RESOLUTION);
    const settled = settleIdeaAtEndpoint(next, {
      valuations: { idea: ownV.valuation, comparison: cmpV.valuation, spy: spyV.valuation },
      date, kind, observed, caughtUp: catchUp === true, snapshotMeta, nowIso,
    });
    endpointRow = settled.endpointRow;
    next = settled.nextIdea;
  }
  // E14: a settled idea with nothing left to sell is `resulted` at this same close — one that reached its endpoint
  // holding nothing, or (E11) one whose last waiting holding a delisting's cash has just closed. The caller returns
  // its cash to the treasury and frees its slot and its coverage.
  if (next.status === IDEA_STATUS.SETTLED && Object.keys(next.ledger.holdings).length === 0) {
    const done = completedLiquidation(next, next.ledger, { session: date, nowIso });
    next = {
      ...next,
      ...done.fields,
      status: IDEA_STATUS.RESULTED,
      statusHistory: [...(next.statusHistory || []), { status: IDEA_STATUS.RESULTED, at: nowIso }],
      ledger: { ...next.ledger, cash: 0 },
    };
    return { nextIdea: next, row, endpointRow, returnedCents: done.returnedCents, resolved: true, ownApplied: own.applied, ownFrozen: ownV.frozen, alerts, coverageChanged: false, adjusted, shareCorrections: ruled?.shareCorrections ?? [] };
  }
  const coverageChanged = own.renames.length + cmp.renames.length + spy.renames.length > 0;
  return { nextIdea: next, row, endpointRow, returnedCents: 0, resolved: false, ownApplied: own.applied, ownFrozen: ownV.frozen, alerts, coverageChanged, adjusted, shareCorrections: ruled?.shareCorrections ?? [] };
}

/**
 * STEP 5 OF THE CLOSE — THE ENDPOINT AND ITS SETTLEMENT (E4, E7), as one pure step shared by the close (above) and, since
 * build B2, by the manager's early exit (managerExit.js; ruling B2-1): the endpoint row and the result (settlement.js
 * buildEndpoint), every holding still held waiting for the ONE settlement sale — a line exit still pending becomes it,
 * keeping the record of how long it has waited — the idea `settled`, its endpoint and its process quality. The sale itself
 * is the settlement sale every settled idea gets (exits.js), at the first window after `nowIso`. `reason` (B2-1:
 * `manager_exit`) is written on each holding's settlement record ONLY when given, so the close's own records are
 * unchanged byte for byte. Pure.
 *
 * @returns {{ nextIdea: object, endpointRow: object }}
 */
export function settleIdeaAtEndpoint(next, { valuations, date, kind, observed, caughtUp, snapshotMeta, nowIso, reason = undefined }) {
  const built = buildEndpoint({ idea: next, valuations, date, kind, observed, caughtUp, snapshotMeta, nowIso });
  const holdings = Object.fromEntries(Object.entries(next.ledger.holdings).map(([sym, h]) => {
    const { exitPending, ...rest } = h;
    return [sym, {
      ...rest,
      settlementPending: {
        session: date, at: nowIso,
        ...(reason !== undefined ? { reason } : {}),
        replacedExit: exitPending ? { reason: exitPending.reason, session: exitPending.session } : null,
        waiting: exitPending?.waiting ?? null,
      },
    }];
  }));
  const statusHistory = [...(next.statusHistory || []), { status: IDEA_STATUS.SETTLED, at: nowIso }];
  return {
    endpointRow: built.endpointRow,
    nextIdea: {
      ...next,
      status: IDEA_STATUS.SETTLED,
      statusHistory,
      ledger: { ...next.ledger, holdings },
      result: built.result,
      endpoint: {
        session: date, kind, valueUsd: built.endpointRow.idea.valueUsd, cashUsd: built.endpointRow.idea.cashUsd,
        holdingsNetUsd: built.endpointRow.idea.holdingsNetUsd, snapshotKey: snapshotMeta.key,
      },
      settledAt: nowIso,
      processQuality: built.result.processQuality,
      blockedBy: built.result.processDetail.blockedBy,
    },
  };
}

/**
 * THE READS A RESULT PACKET NEEDS (T1a-2b-1 §3; Astra T2B-03), shared by the close (step 7) and the manager's exit: the
 * idea's inception row, and its own row of every close from its entry session up to (not including) `before`, in order —
 * a missing one recorded as missing (the packet then refuses). Reads only, in the caller's transaction.
 *
 * @returns {Promise<{ inception: object|null, rows: Array<object> }>}
 */
export async function readIdeaEvidenceRows(tx, bookRef, ideaId, { entered, before }) {
  const rowsRef = bookRef.collection('ideas').doc(ideaId).collection('rows');
  const snap = await tx.get(rowsRef.doc('inception'));
  const inception = snap.exists ? snap.data() : null;
  const rows = [];
  for (let s = entered; typeof s === 'string' && s < before; s = nextSessionDate(s)) {
    const r = await tx.get(rowsRef.doc(s));
    rows.push(r.exists ? r.data() : { date: s, missing: true });
  }
  return { inception, rows };
}

/**
 * T1a-2b-4: THE IDEAS OF A BOOK THAT RESULTED within the daily layer's look-back of `through` — the only ones a row first
 * listed at that close can still be owed to (a row is listed for MANDATE_CA_FETCH_LOOKBACK_DAYS calendar days after its
 * date, and a resulted idea held nothing after its liquidation completed). One single-field range query on the book's
 * own `ideas` (`liquidation.completedSession`, which completedLiquidation writes on every resulted idea): served by the
 * automatic single-field index, so no index is added. Read OUTSIDE any transaction; the close re-reads each one in its
 * own. Shared with the daily build's inputs (sweep.js), which keep these ideas' symbols covered.
 * @returns {Promise<Array<object>>}
 */
export async function recentlyResultedIdeas(bookRef, { through }) {
  if (typeof through !== 'string') return [];
  const cutoff = shiftCalendarDate(through, -(MANDATE_CA_FETCH_LOOKBACK_DAYS + 1));
  const page = await bookRef.collection('ideas').where('liquidation.completedSession', '>=', cutoff).get();
  return page.docs.map((d) => d.data()).filter((i) => i?.status === IDEA_STATUS.RESULTED && typeof i.ideaId === 'string');
}

/** T1a-2b-4: every symbol a resulted idea's ledgers held — what it sold, and what its paper ledgers held at its end. */
export function resultedIdeaSymbols(idea) {
  const out = new Set();
  for (const r of idea?.ledger?.saleReceipts || []) if (typeof r?.symbol === 'string') out.add(upperSym(r.symbol));
  for (const f of LEDGER_FIELDS) for (const sym of Object.keys(idea?.[f]?.holdings || {})) out.add(upperSym(sym));
  return [...out].sort();
}

/**
 * T1a-2b-4: ONE RESULTED IDEA at an observed close. Since the fix round (the founder's L-8): LATE DATA ON A RESULTED IDEA
 * IS NAMED AND ALERTED ONLY. Every holding of every ledger is CLOSED — the idea's own at its sales, its comparison's and
 * SPY line's at its last close (`lastClosedOn`) — and each ledger's late rows go through the same screens as an open idea's
 * (adjustments.js, `proposeOnly`): a row first listed now that the idea may have been owed is a PROPOSAL, named; an
 * ambiguous one is recorded. NOTHING POSTS: not to the treasury, not on paper, not a correction a doubt left pending at its
 * last close (the founder's rulings work on open ideas only — Q-2 as ruled). What waits is carried on the idea
 * (`lateDataUnsettled`) and alerted at every close of its look-back, and at the last one as left unsettled. Pure.
 * @returns {null | { nextIdea: object|null, alerts: string[] }}
 */
function closeResultedIdea(idea, { date, actionsBySymbol, daily, dailyRefOk, parseReport }) {
  if (idea?.status !== IDEA_STATUS.RESULTED) return null;
  const alerts = [];
  let changed = false;
  const next = { ...idea };
  const uncoveredHere = (sym) => !dailyRefOk || dailyCoverageOf(daily, sym, parseReport).refusal !== null;
  // (Review AR4-A-6: the doubt is the COUNT's, per action — an open share-basis ambiguity of the symbol on any ledger
  // dated on or before it, or a paper holding's open suspicion or held action — not every ambiguity of the symbol.)
  const SHARE = new Set(['split', 'reverse_split', 'stock_distribution']);
  const countDoubt = (sym, d) => LEDGER_FIELDS.some((f) => {
    const l = idea[f];
    if (!l) return false;
    const h = l.holdings?.[sym];
    if (h && (h.basisSuspicion || (h.heldActions || []).length > 0)) return true;
    return openAmbiguities(l).some((r) => SHARE.has(r.type) && upperSym(r.ticker) === sym && !(typeof r.effectiveDate === 'string' && typeof d === 'string' && r.effectiveDate > d));
  });
  for (const [f, name] of [['ledger', 'idea'], ['comparisonLedger', 'comparison'], ['spyLedger', 'spy']]) {
    const ledger = idea[f];
    if (!ledger) continue;
    const closed = closedHoldingsOf(ledger, { entrySession: idea.entry?.sessionDate ?? null, closedOn: f === 'ledger' ? null : (idea.lastClosedOn ?? null) });
    if (closed.size === 0) continue;
    const plan = planLedgerAdjustments(ledger, {
      ideaId: idea.ideaId, ledgerKind: name, date, rows: actionsBySymbol, ruledIds: null, closed, proposeOnly: true,
      doubtOn: (sym, d) => uncoveredHere(sym) || countDoubt(sym, d),
      blockersOf: (sym, d) => [...(uncoveredHere(sym) ? [`${LATE_BLOCKER.UNCOVERED}:${date}`] : []), ...(countDoubt(sym, d) ? [`${LATE_BLOCKER.SHARE_BASIS}:${sym}`] : [])],
    });
    alerts.push(...plan.alerts);
    if (plan.ledger !== ledger) { next[f] = plan.ledger; changed = true; }
  }
  // WHAT STILL WAITS on the resulted idea (review AR4-A-2, A-6, C-8; L-8): a row waiting on a doubt, an open ambiguity, a
  // late proposal, a correction or a decision not yet applied. Named on the idea (`lateDataUnsettled`) with the last session
  // the close still reads the idea (its look-back), alerted at every close it stands — and, at that last session, alerted
  // as left unsettled: the money stays where the result put it, and the founder sees what was never settled.
  const waiting = [];
  for (const [f, name] of [['ledger', 'idea'], ['comparisonLedger', 'comparison'], ['spyLedger', 'spy']]) {
    const l = next[f];
    if (!l) continue;
    for (const r of l.closedHeldRows || []) waiting.push({ ledger: name, actionId: r.actionId, kind: 'closed_held' });
    for (const r of openAmbiguities(l)) waiting.push({ ledger: name, actionId: r.actionId, kind: r.reason });
    for (const p of openProposals(l)) waiting.push({ ledger: name, actionId: p.actionId, kind: 'late_proposal', proposal: p.id, netUsd: p.netUsd });
  }
  for (const r of next.founderRulings || []) {
    if (!r || r.appliedOn != null) continue;
    if (r.corrects === true) waiting.push({ ledger: null, actionId: r.recordId, kind: 'correction_pending', requestKey: r.requestKey });
    if (r.kind === 'late_adjustment') waiting.push({ ledger: null, actionId: r.actionId ?? r.recordId, kind: 'late_decision_pending', proposal: r.recordId, requestKey: r.requestKey });
  }
  const readUntil = lastLookbackSessionOf(idea.liquidation?.completedSession ?? null);
  const unsettled = waiting.length > 0 ? { actions: waiting, readUntil } : null;
  // (Key order free — fix-round refuter RFX-3: Firestore does not keep a map's key order.)
  if (stableStringify(unsettled) !== stableStringify(idea.lateDataUnsettled ?? null)) {
    if (unsettled) next.lateDataUnsettled = unsettled; else delete next.lateDataUnsettled;
    changed = true;
  }
  if (unsettled) {
    const last = readUntil !== null && date >= readUntil;
    alerts.push(`PRACTICE_FIELD_LATE_DATA_${last ? 'LEFT_UNSETTLED' : 'UNSETTLED'} ${idea.ideaId} — ${waiting.length} late action${waiting.length === 1 ? '' : 's'} on the resulted idea wait (${waiting.map((w) => `${w.actionId}${w.ledger ? `@${w.ledger}` : ''}:${w.kind}`).join(', ')}); nothing posts on a resulted idea (L-8); ${last ? 'this is the last close that reads it: they are left unsettled, for the founder' : `read until ${readUntil}`}`);
  }
  // (Nothing changed: no write — but what still waits is alerted at every close it stands.)
  if (!changed) return alerts.length > 0 ? { nextIdea: null, alerts } : null;
  next.revision = (idea.revision || 0) + 1;
  return { nextIdea: next, alerts };
}

/** T1a-2b-4: the last session whose close still reads an idea that resulted on `completedSession` (recentlyResultedIdeas:
 *  a close of `through` reads it while `completedSession` ≥ `through` − the look-back − 1 day). Null without a date. */
export function lastLookbackSessionOf(completedSession) {
  if (typeof completedSession !== 'string') return null;
  let s = completedSession;
  for (let n = 0; n < 40; n += 1) {
    const after = nextSessionDate(s);
    if (shiftCalendarDate(after, -(MANDATE_CA_FETCH_LOOKBACK_DAYS + 1)) > completedSession) return s;
    s = after;
  }
  return s;
}

/**
 * Close ONE session of one idea book, in one transaction: the first session before `date` the book has not closed
 * (a catch-up — E12), or `date` itself when there is none.
 *
 * @returns {Promise<{ closed: boolean, skipped?: string, session?: string, catchUp?: boolean, observed?: boolean,
 *                     row?: object, ideaRows?: object, endpoints?: object, cancelled?: string[], resulted?: string[], alerts: string[] }>}
 */
async function closeNextSession(db, bookRef, { date, now, catchUpOnly = false, windowTick = null }) {
  const nowIso = now.toISOString();
  const coverageDocRef = coverageRefOf(db);

  return db.runTransaction(async (tx) => {
    const alerts = [];
    const bookSnap = await tx.get(bookRef);
    if (!bookSnap.exists) return { closed: false, skipped: 'book_missing', alerts };
    const book = bookSnap.data();
    if (!isIdeaBook(book)) return { closed: false, skipped: 'not_idea_book', alerts };
    // A catch-up before a window (`catchUpOnly`) closes only sessions BEFORE `date`; with `date` itself already closed
    // there is nothing before it left to close.
    if (catchUpOnly && typeof book.execState?.lastCloseKey === 'string' && date <= book.execState.lastCloseKey) return { closed: false, skipped: 'nothing_to_catch_up', alerts };
    if (book.execState?.lastCloseKey === date) return { closed: false, skipped: 'already_closed', alerts };
    // Never backwards (review L1-9): a close for a date before the last one would rewind the marks and the key.
    if (typeof book.execState?.lastCloseKey === 'string' && date < book.execState.lastCloseKey) return { closed: false, skipped: 'out_of_order', alerts };
    // E13: a draining book gets every code duty.
    if (book.status !== 'active' && book.status !== 'draining') return { closed: false, skipped: 'not_open', alerts };

    const ideas = [];
    for (const id of book.openIdeaIds || []) {
      const snap = await tx.get(bookRef.collection('ideas').doc(id));
      if (!snap.exists) throw new PracticeFieldError('open_idea_missing', { ideaId: id });
      ideas.push(snap.data());
    }
    // E12: the session this transaction closes — the first one the book has missed, or the requested date.
    const missed = firstUnclosedSessionBefore(book, ideas, date);
    // T1a-2b-4: the ideas that RESULTED within the daily layer's look-back of the session (recentlyResultedIdeas — a query,
    // then each one read in this transaction), for their late adjustments below. An open idea is never one of them.
    const resultedIdeas = [];
    {
      const through = missed ?? date;
      // (Review AR4-B-4: fenced — the query failing must not stop the book closing. The resulted ideas are then not
      // examined at this close, alerted; the next close asks again inside the same look-back.)
      let found = [];
      try {
        found = await recentlyResultedIdeas(bookRef, { through });
      } catch (err) {
        alerts.push(`PRACTICE_FIELD_RESULTED_IDEAS_UNREAD ${bookRef.id} ${through} — the resulted ideas within the look-back could not be listed (${err?.message ?? err}); their late adjustments are examined at the next close`);
      }
      for (const f of found) {
        if ((book.openIdeaIds || []).includes(f.ideaId)) continue;
        const snap = await tx.get(bookRef.collection('ideas').doc(f.ideaId));
        if (snap.exists && snap.data()?.status === IDEA_STATUS.RESULTED) resultedIdeas.push(snap.data());
      }
    }
    // T2B-02 — THE WINDOW LEDGER'S OWN CURSOR (windowLedger.js). Every session the book was due since its creation is
    // accounted for, in order, before the cursor passes it: a session BEFORE the one this transaction values — before
    // any idea filled, or any close ran — gets its close row here (`valued: false`), with its missing windows and their
    // alerts, and no valuation row; the session the valuation closes writes its own below. Read now, before any write.
    // When there is nothing to value (a catch-up of a book with no session to close), or more such sessions than one
    // transaction takes, this transaction accounts for them alone and the caller goes on.
    const valuationSession = catchUpOnly && missed === null ? null : (missed ?? date);
    const windowOnly = windowOnlySessionsBefore(book, valuationSession ?? date, WINDOW_ONLY_SESSIONS_PER_TX + 1);
    const windowsAccounted = await readWindowOnlySessions(tx, bookRef, book, windowOnly.slice(0, WINDOW_ONLY_SESSIONS_PER_TX), { nowIso });
    const accountedSummary = windowsAccounted.map((a) => ({ session: a.session, missing: a.missing }));
    if (valuationSession === null || windowOnly.length > WINDOW_ONLY_SESSIONS_PER_TX) {
      if (windowsAccounted.length === 0) return { closed: false, skipped: 'nothing_to_catch_up', alerts };
      // Their alerts go with the rows that record them — only when those rows are written.
      for (const a of windowsAccounted) alerts.push(...a.alerts);
      writeWindowOnlySessions(tx, bookRef, windowsAccounted);
      tx.update(bookRef, { [`execState.${WINDOWS_ACCOUNTED_FIELD}`]: windowsAccounted[windowsAccounted.length - 1].session });
      const more = windowOnly.length > WINDOW_ONLY_SESSIONS_PER_TX;
      return { closed: false, skipped: more ? 'windows_accounted' : 'nothing_to_catch_up', windowsAccounted: accountedSummary, alerts };
    }
    const session = valuationSession;
    const catchUp = session !== date;
    // Nothing moves past an unclosed session (sessions.js): an idea that filled AFTER the session being closed cannot
    // exist — every fill refuses to run while an earlier session is unclosed. If one does, the book's present is not
    // this session's past, and no row of it is written (reject, never repair — review RH-1).
    const fromTheFuture = ideas.filter((i) => typeof i?.entry?.sessionDate === 'string' && i.entry.sessionDate > session);
    if (fromTheFuture.length > 0) throw new PracticeFieldError('idea_filled_after_unclosed_session', { session, ideas: fromTheFuture.map((i) => ({ ideaId: i.ideaId, entered: i.entry.sessionDate })) });
    const soldLater = ideas.flatMap((i) => (i?.ledger?.saleReceipts || []).filter((s) => s.sessionDate > session).map((s) => ({ ideaId: i.ideaId, symbol: s.symbol, sold: s.sessionDate })));
    if (soldLater.length > 0) throw new PracticeFieldError('sale_filled_after_unclosed_session', { session, sales: soldLater });

    // B-STAMP (Astra T1A-03): THE stored close snapshot of the session, read here. A REQUESTED date with no document
    // writes no row — and nothing is built or fetched to make one. A MISSED session with no document is unobserved.
    const key = closeSnapshotKeyFor(session);
    const snapshotSnap = await tx.get(db.collection(SNAPSHOT_COLLECTION).doc(key));
    if (!snapshotSnap.exists && !catchUp) return { closed: false, skipped: 'valuation_missed', alerts };
    const closeSnapshot = snapshotSnap.exists ? snapshotSnap.data() : null;
    if (closeSnapshot && (closeSnapshot.tickKey !== key || closeSnapshot.sessionDate !== session)) {
      throw new PracticeFieldError('close_snapshot_key_mismatch', { expected: key, got: closeSnapshot?.tickKey ?? null, sessionDate: closeSnapshot?.sessionDate ?? null });
    }
    const observed = closeSnapshot !== null;
    const snapshotMeta = observed ? { key, builtAt: toIso(closeSnapshot.builtAt) } : { key: null, builtAt: null };
    // Amendment F-1, F-2 (T1a-2b-3): THE SESSION'S DAILY LAYER, read here, in this transaction — the one record of
    // whether the day's corporate-action fetch covered each symbol (F-6), and of the day's action rows. The rows the
    // close applies are the UNION of that layer's and the snapshot's own copy: nothing is dropped. A snapshot that does
    // not name this layer (`dailyRef`) is not used for any row or any symbol's coverage: every held name is in doubt
    // and carried. The collection by its literal name, for the protected-store scan.
    let daily = null;
    let dailyRefOk = false;
    let parseReport = null;
    if (observed) {
      const dailySnap = await tx.get(db.collection('mandateUniverseDaily').doc(session));
      daily = dailyDocOf(dailySnap.exists ? dailySnap.data() : null, session);
      dailyRefOk = snapshotNamesDaily(closeSnapshot, session);
      // T1a-2b-4 (T2D-12): THE SESSION'S PARSE REPORT (caParseReport.js), read in the same transaction — part of each held
      // symbol's coverage (dailyCoverage.js dailyCoverageOf): a missing report, a rejected row or a malformed envelope is
      // a session of doubt. The collection by its literal name, for the protected-store scan.
      const reportSnap = await tx.get(db.collection('practiceFieldCaParseReports').doc(session));
      parseReport = reportSnap.exists ? reportSnap.data() : null;
    }
    const actionsBySymbol = !observed ? {}
      : (dailyRefOk ? unionActionsBySymbol(caActionsBySymbol(closeSnapshot), dailyActionsBySymbol(daily)) : unionActionsBySymbol(dailyActionsBySymbol(daily)));
    // F-1: each filled idea's coverage inputs — per held symbol, the last session its data covered and, when the
    // session's own layer cannot reach back to the day after it, the BACKFILL stored for that day (read here; only the
    // idea book reads it — caBackfill.js). Every read before any write.
    const coverageInputsOf = new Map();
    const closedBackfillsOf = new Map();
    if (observed) {
      for (const idea of ideas) {
        if (!FILLED_IDEA_STATUSES.includes(idea.status)) continue;
        const inputs = new Map();
        for (const sym of heldSymbolsOf(idea)) {
          const coveredThrough = coveredThroughOf(idea, sym);
          let backfill = null;
          let backfillRows = null;
          // Astra T2D-02: a CATCH-UP close reads the symbol's stored backfill too, whatever its archived daily entry says.
          // An archived entry was valid when it was built, but the backfill this catch-up fetched may list an action
          // the vendor added since (a split, a dividend): without it a 20-session catch-up closed every session on
          // the old rows and valued the book as if neither existed, at full quality.
          if (typeof coveredThrough === 'string'
            && (catchUp || sessionCoverage({ symbol: sym, session, coveredThrough, daily, dailyRefOk, parseReport }).readBackfill)) {
            const snap = await tx.get(db.collection('practiceFieldCaBackfill').doc(backfillIdOf(sym)));
            const data = snap.exists ? snap.data() : null;
            backfill = successfulBackfill(data, sym, shiftCalendarDate(coveredThrough, 1));
            backfillRows = successfulBackfill(data, sym, null)?.actions ?? null;
          }
          inputs.set(sym, { coveredThrough, backfill, backfillRows });
        }
        coverageInputsOf.set(idea.ideaId, inputs);
        // T1a-2b-4 fix round (T2E-08): a sold holding's sticky coverage doubt clears only by a backfill with a clean parse
        // report — read here, in this transaction, for the symbols that have one (successfulBackfill: clean, or nothing).
        const closedBf = new Map();
        for (const sym of Object.keys(idea.ledger?.closedCoverageDoubts || {}).sort()) {
          const snap = await tx.get(db.collection('practiceFieldCaBackfill').doc(backfillIdOf(sym)));
          const ok = successfulBackfill(snap.exists ? snap.data() : null, sym, null);
          if (ok) closedBf.set(sym, ok);
        }
        if (closedBf.size > 0) closedBackfillsOf.set(idea.ideaId, closedBf);
      }
    }

    // Reject, never repair (Astra T1A-02): the close re-marks every position and recomputes the equity, so a book
    // that is inconsistent AS READ would otherwise be overwritten into one that passes. It is refused here instead.
    assertReconciled(book, ideas);
    const coverageSnap = ideas.length > 0 ? await tx.get(coverageDocRef) : null;
    let coverageData = coverageSnap?.exists ? coverageSnap.data() : null;
    let coverageWrite = false;

    // 0. Entry timeouts: the start session is over and nothing filled. The reservation returns; nothing was bought.
    let working = book;
    const nextIdeas = new Map(ideas.map((i) => [i.ideaId, i]));
    const cancelled = [];
    for (const idea of ideas.filter((i) => i.status === IDEA_STATUS.ACCEPTED && i.contract.schedule.startSession <= session)) {
      const rel = planRelease({ book: working, idea, coverageData, reason: CANCEL_REASON.ENTRY_TIMEOUT, nowIso });
      working = rel.nextBook;
      coverageData = rel.nextCoverage;
      coverageWrite = true;
      nextIdeas.set(idea.ideaId, rel.nextIdea);
      cancelled.push(idea.ideaId);
    }

    // 1–5. Each filled idea: actions, marks, lines, row — and its endpoint when it is due or holds nothing.
    const sinceDate = book.execState?.lastCloseKey ?? null;
    let positions = { ...(working.portfolio.positions || {}) };
    let bookCash = working.portfolio.cash;
    const ideaRows = {};
    const endpoints = {};
    const resulted = [];
    const bookActionDocs = [];
    const frozenBookSymbols = new Set();
    let allFullQuality = observed;
    // T1a-2b-4: every adjustment this close posts or holds, [ideaId, ledger field, record], for its evidence document.
    const adjustmentDocs = [];
    for (const idea of ideas) {
      if (!FILLED_IDEA_STATUSES.includes(idea.status)) continue;
      const heldByOthers = new Set(Object.entries(positions).filter(([, p]) => p?.ideaId !== idea.ideaId).map(([sym]) => sym));
      // …and the target of another idea's rename that waits for its share basis (Astra T2A-01): had it applied, the
      // target would be that idea's position (fix-round refuter, F1). Read from this close's state of each idea.
      for (const other of ideas) {
        if (other.ideaId === idea.ideaId) continue;
        for (const h of Object.values(nextIdeas.get(other.ideaId)?.ledger?.holdings || {})) {
          if (typeof h?.deferredRename?.to === 'string') heldByOthers.add(h.deferredRename.to);
        }
      }
      const out = closeFilledIdea(idea, {
        date: session, closeSnapshot, actionsBySymbol, heldByOthers, sinceDate, snapshotMeta, nowIso, catchUp,
        daily, dailyRefOk, coverageInputs: coverageInputsOf.get(idea.ideaId) ?? new Map(), parseReport,
        closedBackfills: closedBackfillsOf.get(idea.ideaId) ?? new Map(),
      });
      nextIdeas.set(idea.ideaId, out.nextIdea);
      ideaRows[idea.ideaId] = out.row;
      alerts.push(...out.alerts);
      if (!out.row.fullQuality) allFullQuality = false;
      for (const sym of out.ownFrozen) frozenBookSymbols.add(sym);
      // T1a-2b-4 (T2D-05): FIRST, the founder's correction of a split's ratio, as the idea's holding took it — before this
      // close's actions, as the idea took it before its own (holdRulings.js applies it ahead of them): the same count,
      // average cost and carried mark (reconcile.js rules 2 and 7). A dividend or a split of this close then meets the
      // corrected count on the book as on the idea (the late soak's 1795727711 and 1795727357: mirrored after them, the book
      // paid a dividend on the old count, and a split listed in the same close met the wrong base).
      for (const c of (out.shareCorrections || []).filter((x) => x.field === 'ledger' && x.held !== false)) {
        const pos = positions[c.symbol];
        if (!pos) continue;
        const lastMark = Number(pos.lastMark);
        positions = { ...positions, [c.symbol]: { ...pos, shares: c.sharesAfter, avgCost: (Number(pos.costBasisTotal) || 0) / c.sharesAfter, lastMark: Number.isFinite(lastMark) ? lastMark / c.factor : pos.lastMark } };
      }
      // Mirror the idea's OWN applied actions onto the book's positions and cash — an independent application of
      // the same action, which the reconciliation below then compares with the idea's ledger. The list is the
      // ledger's deduplicated one (Astra T1A-01): one application per action id, never one per feed row. A delisting
      // is in it only with its cash amount (ledger.js): the engine's forced close at a mark is never reached.
      for (const action of out.ownApplied) {
        // F-7 (C-16): a LATE dividend was paid on the count the holding had on its ex-date (`entitledShares`): the mirror
        // pays the same, on the same count, and leaves its position as it was.
        const late = action.type === 'cash_dividend' && Number.isFinite(action.entitledShares);
        const sym = String(action.ticker || '').trim().toUpperCase();
        const applied = applyCorporateAction({
          positions: late && positions[sym] ? { ...positions, [sym]: { ...positions[sym], shares: action.entitledShares } } : positions, cash: bookCash,
        }, action);
        if (!applied.ok) throw new PracticeFieldError('book_action_not_applied', { ideaId: idea.ideaId, actionId: action.actionId, reason: applied.reason });
        if (!late) positions = applied.positions;
        // (T1a-2b-4 fix round, L-4: a share-basis action the idea applied out of date order was recounted along the dated
        // chain — its receipt's `recount` — and the book's position takes the same count, average cost from its basis.)
        const recount = action.receipt?.recount;
        if (recount && positions[sym] && Number(recount.sharesAfter) > 0) {
          positions = { ...positions, [sym]: { ...positions[sym], shares: Number(recount.sharesAfter), avgCost: (Number(positions[sym].costBasisTotal) || 0) / Number(recount.sharesAfter) } };
        }
        bookCash = applied.cash;
        bookActionDocs.push([bookRef.collection('corporateActions').doc(action.actionId), {
          ...buildCorporateAction({
            actionId: action.actionId, type: action.type, ticker: action.ticker, ratio: action.ratio ?? null,
            amount: action.amount ?? null, appliedAt: now, source: action.source ?? null,
          }),
          effectiveDate: action.effectiveDate,
          ideaId: idea.ideaId,
          note: applied.note,
        }]);
      }
      // T1a-2b-4: the idea's own ADJUSTMENTS are cash of the book's too (an open idea's cash is part of the book's), and
      // the founder's correction of a split's ratio moves the book's position as it moved the idea's holding — the same
      // count, average cost and carried mark (reconcile.js rules 2 and 7). Each adjustment of each ledger is recorded
      // beside the idea (its evidence document, created below).
      for (const a of out.adjusted?.ledger?.posted || []) bookCash = fromCents(toCents(bookCash) + toCents(a.amountUsd));
      for (const [f, plan] of Object.entries(out.adjusted || {})) {
        for (const a of plan?.posted || []) adjustmentDocs.push([idea.ideaId, f, a]);
      }
      for (const c of out.shareCorrections || []) adjustmentDocs.push([idea.ideaId, c.field, c.record]);
      if (out.endpointRow) endpoints[idea.ideaId] = out.endpointRow;
      const ideaRefKey = coverageRef(idea.bookId, idea.ideaId);
      if (out.resolved) {
        // E2, E14: the idea is out of the open set — its cash is the treasury's again, its slot and coverage are free.
        working = {
          ...working,
          treasury: { ...working.treasury, unreservedCash: fromCents(toCents(working.treasury.unreservedCash) + out.returnedCents) },
          slots: { ...working.slots, [idea.contract.slot]: working.slots?.[idea.contract.slot] === idea.ideaId ? null : working.slots?.[idea.contract.slot] ?? null },
          openIdeaIds: (working.openIdeaIds || []).filter((id) => id !== idea.ideaId),
        };
        coverageData = coverageWithoutRef(coverageData, ideaRefKey, nowIso);
        coverageWrite = true;
        resulted.push(idea.ideaId);
      } else if (out.coverageChanged) {
        // E11: a renamed symbol is what the idea needs a price for from now on.
        coverageData = coverageWithRef(coverageData, ideaRefKey, ideaCoveragePlanFromLedgers(out.nextIdea), nowIso);
        coverageWrite = true;
      }
    }

    // T1a-2b-4 (Astra T2D-03, T2D-04 after a result): THE IDEAS THAT RESULTED within the daily layer's look-back. Their
    // result is never rewritten. Since the fix round (L-8) their late data is NAMED AND ALERTED ONLY: a row first listed now
    // that they may have been owed is proposed and named on the idea (`lateDataUnsettled`); nothing posts to the treasury.
    const resultedNext = new Map();
    if (observed) {
      for (const idea of resultedIdeas) {
        const done = closeResultedIdea(idea, { date: session, actionsBySymbol, daily, dailyRefOk, parseReport });
        if (done === null) continue;
        alerts.push(...done.alerts);
        if (done.nextIdea === null) continue;
        resultedNext.set(idea.ideaId, done.nextIdea);
      }
    }

    // The book's own marks, from the SAME snapshot, written back onto its positions. An unobserved session marks
    // nothing: the positions stay exactly as they were.
    const markingSnapshot = observed && frozenBookSymbols.size > 0 ? snapshotExcluding(closeSnapshot, frozenBookSymbols) : closeSnapshot;
    const bookMark = markBook(positions, bookCash, markingSnapshot);
    const nextPositions = {};
    for (const [sym, pos] of Object.entries(positions)) {
      const m = bookMark.marked[sym];
      if (!m || !observed) { nextPositions[sym] = pos; continue; }
      const fresh = m.markSource === 'snapshot';
      const q = fresh ? closeMarkQuality(closeSnapshot.symbols?.[sym] ?? null, session) : { quality: MARK_QUALITY.CARRIED_FORWARD, vendorTimeIso: null };
      if (q.quality !== MARK_QUALITY.VENDOR_TIME) allFullQuality = false;
      nextPositions[sym] = {
        ...pos,
        lastMark: m.mark,
        lastMarkAsOf: fresh ? (q.vendorTimeIso ?? pos.lastMarkAsOf ?? null) : (pos.lastMarkAsOf ?? null),
        lastMarkSource: fresh ? 'snapshot' : m.markSource,
        // The same provenance the idea's holding records (ledger.js withCloseMarks; Astra T2B-01): this close's, or —
        // carried — the one it had.
        ...(fresh ? {
          lastMarkProvenance: markProvenance({
            source: MARK_PROVENANCE_SOURCE.CLOSE, symbol: sym, session, snapshotKey: snapshotMeta.key, quality: q.quality, vendorTimeIso: q.vendorTimeIso,
          }),
        } : {}),
      };
    }

    const openIdeas = (working.openIdeaIds || []).map((id) => nextIdeas.get(id));
    // BUILD_RULES §9 (review L1-6) on the ONE basis (ledger.js markedEquityCents, Astra T1A-02): the book's positions
    // value is the SUM of its ideas' holdings at the marks this close just wrote on them — each idea's row's
    // `markedHoldingsValue` — so the book's row and its ideas' rows can never disagree by a cent. The raw mark of the
    // book's own positions — an independent valuation of the same shares from the same snapshot — sits beside it and
    // must agree to within one rounding per idea.
    const equity = markedEquityCents(working.treasury.unreservedCash, openIdeas);
    const treasuryCash = fromCents(equity.treasuryCents);
    const reservedCash = fromCents(equity.cashCents);
    const markedPositionsValue = fromCents(equity.holdingsCents);
    if (Math.abs(equity.holdingsCents - toCents(roundUsd(bookMark.positionsValue))) > Object.keys(ideaRows).length) {
      throw new PracticeFieldError('book_marks_disagree_with_ideas', { ideas: equity.holdingsCents, book: toCents(roundUsd(bookMark.positionsValue)) });
    }
    const markedEquity = fromCents(equity.equityCents);
    const costsToDateUsd = roundUsd(working.portfolio.frictionPaidCum || 0);

    // 9. WIND-DOWN COMPLETES AT A CLOSE (T1a-2b-1 §6; contract §3.2, §11): a draining book with no open idea left after
    //    this close — every idea resulted or timed out — is closed by it. Decided here, on the book as this close
    //    leaves it. A caught-up session is closed exactly as its own close would have been (E12; review C2): its
    //    on-time close runs within the engine's close window, so a wind-down requested before that window ENDS
    //    (18:00 Eastern on a regular session) is one its close could have completed — a request at 16:05, before
    //    the 16:25 close, is completed by it (fix-round refuter NF-1). One requested only after the window ended
    //    came when that session's close had run with the book active; a later session's close completes it, so no
    //    session the book was active through goes without its rows.
    const windDownAtMs = Date.parse(book.windDown?.requestedAt ?? '');
    const closePassEndMs = sessionClosePassEndMs(session);
    const windDownInForce = book.status === 'draining'
      && (!Number.isFinite(windDownAtMs) || closePassEndMs === null || windDownAtMs < closePassEndMs);
    const completesWindDown = windDownInForce && (working.openIdeaIds || []).length === 0;
    const nextBook = {
      ...working,
      portfolio: { ...working.portfolio, positions: nextPositions, cash: roundUsd(bookCash), totalValue: markedEquity },
      revision: (working.revision || 0) + 1,
      ...(completesWindDown ? { status: 'closed' } : {}),
    };
    // 6. Reconcile BEFORE anything is written.
    assertReconciled(nextBook, openIdeas);

    // ── The reads of 7–9, every one before the first write ──────────────────────────────────────────────────────
    // 7. Each idea reaching its endpoint here: its inception row, where every ledger's entry fills are — and (Astra
    //    T2B-03) its own row of EVERY close from its entry session to this one, the closes its largest decline and
    //    exposure were folded from (every close writes the row of every filled idea, so each is there). This close's
    //    row is the one about to be written.
    const inceptions = {};
    const closeRowsOf = {};
    for (const ideaId of Object.keys(endpoints)) {
      const read = await readIdeaEvidenceRows(tx, bookRef, ideaId, { entered: nextIdeas.get(ideaId)?.entry?.sessionDate ?? null, before: session });
      inceptions[ideaId] = read.inception;
      closeRowsOf[ideaId] = [...read.rows, ideaRows[ideaId]];
    }
    // 8. The session's intraday window rows (windows.js names the windows the book was due).
    const windowRows = {};
    for (const w of expectedIntradayWindows(book, session)) {
      const snap = await tx.get(windowsRefOf(bookRef).doc(windowRowId(session, w.window)));
      windowRows[w.window] = snap.exists ? snap.data() : null;
    }
    // 9. The owner's claim and the founder-cap registry — read only by the close that completes a wind-down. The
    //    collection by its literal name, for the protected-store scan.
    let claimRef = null;
    let claim = null;
    let registryRef = null;
    let registry = null;
    if (completesWindDown) {
      claimRef = db.collection('practiceFieldBooks').doc(book.userId);
      registryRef = db.collection('practiceFieldBooks').doc(PRACTICE_FIELD_BOOK_REGISTRY_ID);
      const claimSnap = await tx.get(claimRef);
      const registrySnap = await tx.get(registryRef);
      claim = claimSnap.exists ? claimSnap.data() : null;
      registry = registrySnap.exists ? registrySnap.data() : null;
    }

    // 7. The result packets: every price each result relied on, copied (evidence.js) — with their numbered receipt parts.
    const resultPackets = Object.keys(endpoints).map((ideaId) => [ideaId, buildResultEvidence({
      bookId: bookRef.id, idea: nextIdeas.get(ideaId), endpointRow: endpoints[ideaId], inception: inceptions[ideaId],
      closeRows: closeRowsOf[ideaId], nowIso,
    })]);
    // 8. The close's own window row and the session's summary: expected against served, one alert per missed window —
    //    after those of the sessions before it that only the window cursor accounts for (T2B-02), in session order.
    const closeWindow = buildCloseWindowRow({
      bookId: bookRef.id, book, session, windowRows, observed, catchUp, snapshotMeta, nowIso, bookClosed: completesWindDown,
      code: { ideasValued: Object.keys(ideaRows).length, endpoints: Object.keys(endpoints), resulted, cancelled },
    });
    for (const a of windowsAccounted) alerts.push(...a.alerts);
    alerts.push(...closeWindow.alerts);

    const row = {
      schemaVersion: MANDATE_SCHEMA_VERSION,
      kind: IDEA_BOOK_KIND,
      rowKind: 'valuation',
      basis: 'mark',
      label: observed ? VALUATION_LABEL : VALUATION_LABEL_UNOBSERVED,
      date: session,
      closeSnapshotKey: snapshotMeta.key,
      closeSnapshotBuiltAt: snapshotMeta.builtAt,
      markedEquity,
      treasuryCash,
      reservedCash,
      markedPositionsValue,
      costsToDateUsd,
      positionCount: Object.keys(nextPositions).length,
      openIdeaIds: [...(working.openIdeaIds || [])],
      raw: { markedEquity: bookMark.totalValue, markedPositionsValue: bookMark.positionsValue },
      fullQuality: allFullQuality,
      observed,
    };
    if (catchUp) row.caughtUpAt = nowIso;

    // F-9: each idea document about to be written, measured first.
    for (const [ideaId, next] of nextIdeas) {
      if (next === ideas.find((i) => i.ideaId === ideaId)) continue;
      const alert = ideaDocSizeAlert(bookRef.id, ideaId, firestoreDocumentBytes(`mandates/${bookRef.id}/ideas/${ideaId}`, next));
      if (alert !== null) alerts.push(alert);
    }

    // T1a-2b-4: each adjustment's evidence document, read first (every read before the first write): create-once — one
    // already there under its deterministic id is the same correction, and a second write of it would abort the close.
    const adjustmentWrites = [];
    for (const [ideaId, field, a] of adjustmentDocs) {
      const ref = evidenceRefOf(bookRef.collection('ideas').doc(ideaId), adjustmentDocIdOf(a.id));
      const snap = await tx.get(ref);
      if (snap.exists) continue;
      adjustmentWrites.push([ref, sealAdjustment({ schemaVersion: 1, packet: 'adjustment', bookId: bookRef.id, ideaId, field, session, writtenAt: nowIso, ...a })]);
    }

    // Commit.
    for (const [ref, doc] of bookActionDocs) tx.set(ref, doc);
    for (const [ideaId, next] of resultedNext) tx.set(bookRef.collection('ideas').doc(ideaId), next);
    for (const [ref, doc] of adjustmentWrites) tx.create(ref, doc);
    for (const [ideaId, next] of nextIdeas) {
      const prior = ideas.find((i) => i.ideaId === ideaId);
      if (next !== prior) tx.set(bookRef.collection('ideas').doc(ideaId), next);
    }
    for (const [ideaId, ideaRow] of Object.entries(ideaRows)) {
      tx.set(bookRef.collection('ideas').doc(ideaId).collection('rows').doc(session), ideaRow);
    }
    // CREATE-ONCE (build prompt §6; contract §10): an idea has one endpoint. A second one aborts the whole close.
    for (const [ideaId, endpointRow] of Object.entries(endpoints)) {
      tx.create(bookRef.collection('ideas').doc(ideaId).collection('rows').doc('endpoint'), endpointRow);
    }
    // …and one result packet, created beside it (T1a-2b-1 §3), with its corporate-action receipts in numbered parts
    // (T1a-2b-2 §4.4): a second write of any of them aborts the whole close too.
    for (const [ideaId, { packet, parts }] of resultPackets) {
      const ideaRef = bookRef.collection('ideas').doc(ideaId);
      tx.create(evidenceRefOf(ideaRef, EVIDENCE_PACKET.RESULT), packet);
      for (const part of parts) tx.create(evidenceRefOf(ideaRef, part.id), part.doc);
    }
    tx.set(bookRef.collection('dailyRows').doc(session), row);
    // The sessions before this one that only the window cursor accounts for (T2B-02), then this close's own window row
    // (T1a-2b-1 §4): each create-once, as each session is accounted for once.
    writeWindowOnlySessions(tx, bookRef, windowsAccounted);
    tx.create(windowsRefOf(bookRef).doc(windowRowId(session, CLOSE_WINDOW)), closeWindow.row);
    // T1a-2b-2 §4.1 (Astra T2B-05): a session caught up AT A WINDOW leaves that window's own receipt, in this transaction.
    // The transaction that closes the book (its wind-down complete) writes none: the closed book owes that window
    // nothing, and that session's own close row records the catch-up. Sessions the SAME catch-up closed before it have
    // already written theirs, so the window's row then holds those receipts and no attempt — a true record of what code
    // did at the window, which nothing reads again (a closed book is never served or closed again; review C2).
    if (catchUpOnly && windowTick && !completesWindDown) {
      writeWindowActionReceipts(tx, bookRef, windowTick, [{ kind: WINDOW_ACTION_KIND.CAUGHT_UP, id: session, detail: { session, observed }, at: nowIso }]);
    }
    if (coverageWrite) tx.set(coverageDocRef, coverageData);
    const bookPatch = {
      portfolio: nextBook.portfolio,
      treasury: nextBook.treasury,
      slots: nextBook.slots,
      openIdeaIds: nextBook.openIdeaIds,
      revision: nextBook.revision,
      'health.lastCloseAttemptAt': now,
      'health.consecutiveCloseFailures': 0,
      'execState.lastCloseKey': session,
      // The window cursor stands at the session just accounted for (T2B-02): the valuation's, after any before it.
      [`execState.${WINDOWS_ACCOUNTED_FIELD}`]: session,
    };
    // An unobserved session marked nothing: the last-mark time stays where the last real mark left it.
    if (observed) bookPatch['health.lastCloseMarkAt'] = now;
    if (completesWindDown) {
      // 9. The book closes: no clock moves and no cash is reset (contract §11) — the treasury keeps every dollar.
      bookPatch.status = 'closed';
      bookPatch.closedAt = nowIso;
      bookPatch.closedOn = session;
      bookPatch.windDown = { ...(book.windDown || {}), completedAt: nowIso, completedSession: session };
      // …it leaves the founder-cap registry (the ONE removal of an entry — registryPresence.test.js)…
      const openBooks = { ...((registry && typeof registry.openBooks === 'object' && registry.openBooks) || {}) };
      if (Object.hasOwn(openBooks, bookRef.id)) {
        delete openBooks[bookRef.id];
        tx.set(registryRef, { ...registry, openBooks, updatedAt: nowIso });
      }
      // …and the owner's claim is closed, so the owner may open another book. Only a claim that names THIS book.
      if (claim && claim.bookId === bookRef.id) {
        tx.set(claimRef, { ...claim, bookId: null, status: 'closed', closedBookId: bookRef.id, closedAt: nowIso, updatedAt: nowIso });
      }
    }
    tx.update(bookRef, bookPatch);
    return {
      closed: true, session, catchUp, observed, row, ideaRows, endpoints, cancelled, resulted, alerts,
      missedWindows: closeWindow.missing, windowsAccounted: accountedSummary, ...(completesWindDown ? { bookClosed: true } : {}),
    };
  });
}

/**
 * One closeNextSession of a multi-session call. If it THROWS, the alerts of the sessions this call already committed
 * (each one's window-missed, unobserved and corporate-action lines) would be lost with the call's return value — and
 * those sessions are never closed again. So they are logged here, once, before the error goes on (review B3).
 */
async function closeNextSessionKeepingAlerts(db, bookRef, args, committedAlerts) {
  try {
    return await closeNextSession(db, bookRef, args);
  } catch (err) {
    for (const alert of committedAlerts) console.error(`[PracticeFieldClose] ${bookRef.id} ${alert}`);
    throw err;
  }
}

/**
 * CATCH UP every session this book missed BEFORE `before`, in order, each from its own stored close snapshot (E12) —
 * and close nothing else. The idea-book pass calls it at every window, before any sale or entry (sessions.js: nothing
 * moves past an unclosed session). `complete` is true only when no session before `before` is left unclosed.
 *
 * @returns {Promise<{ complete: boolean, skipped?: string, caughtUp: Array<{ date: string, observed: boolean }>,
 *                     cancelled: string[], resulted: string[], alerts: string[] }>}
 */
export async function catchUpIdeaBook(db, bookRef, { before, now = new Date(), tick = null, fetchCorporateActions = undefined, caFetchImpl = undefined, lastCloseKey = undefined } = {}) {
  if (!db || !bookRef) throw new Error('catchUpIdeaBook: db and bookRef required');
  if (typeof before !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(before)) throw new Error('catchUpIdeaBook: before required');
  const out = { complete: false, caughtUp: [], windowsAccounted: [], cancelled: [], resulted: [], alerts: [] };
  // 'off': no Practice Field code path runs, whoever calls. Before any read.
  if (!practiceFieldLive()) return { ...out, skipped: 'practice_field_off' };
  // Amendment F-1 (review A2): the window's catch-up is usually the FIRST close after an outage — windows run before the
  // day's close — so it backfills first, as closeIdeaBook does, through `before` (the sessions it closes are earlier).
  // A caller that has read the book (the window: `lastCloseKey`) spends no read on it when no session was missed.
  // (A book that has never closed — `lastCloseKey` null — closes from its first entry session: it may have missed some.
  // Fix-round refuter NF-2.)
  const nothingMissed = typeof lastCloseKey === 'string' && !(nextSessionDate(lastCloseKey) < before);
  if (!nothingMissed) {
    const backfill = await ensureCoverageBackfills(db, bookRef, { through: before, now, ...(fetchCorporateActions ? { fetchCorporateActions } : {}), ...(caFetchImpl ? { fetchImpl: caFetchImpl } : {}) });
    out.alerts.push(...backfill.alerts);
  }
  for (;;) {
    // `tick`: the window this catch-up runs at, which keeps a receipt of each session it closes (T2B-05).
    const res = await closeNextSessionKeepingAlerts(db, bookRef, { date: before, now, catchUpOnly: true, windowTick: tick }, out.alerts);
    out.alerts.push(...(res.alerts || []));
    out.windowsAccounted.push(...(res.windowsAccounted || []));
    out.cancelled.push(...(res.cancelled || []));
    out.resulted.push(...(res.resulted || []));
    // T2B-02: a transaction that only accounted for sessions by the window cursor, with more left — go on.
    if (!res.closed && res.skipped === 'windows_accounted') continue;
    if (!res.closed) return { ...out, complete: res.skipped === 'nothing_to_catch_up', skipped: res.skipped };
    out.caughtUp.push({ date: res.session, observed: res.observed });
    if (!res.observed) out.alerts.push(`PRACTICE_FIELD_SESSION_UNOBSERVED ${bookRef.id} ${res.session} — no stored close snapshot; the session is recorded as unobserved`);
    // A caught-up close completed the book's wind-down (T1a-2b-1 §6): nothing is left to catch up — the book is closed.
    // Complete, so the window that ran the catch-up is not counted as one that failed.
    if (res.bookClosed) return { ...out, complete: true, bookClosed: true };
    if (out.caughtUp.length >= CATCH_UP_MAX_SESSIONS_PER_CALL) return { ...out, skipped: 'catch_up_incomplete' };
  }
}

/**
 * Close one idea book for `date`, valued from THE stored close snapshot of that date (`mandateUniverseSnapshots/
 * {date}_close`), which this function reads itself. It takes no snapshot argument (Astra T1A-03). Sessions the book
 * missed before `date` are closed first, in order, each from its own stored snapshot (E12).
 *
 * @returns {Promise<{ closed: boolean, skipped?: string, row?: object, ideaRows?: object, endpoints?: object,
 *                     cancelled?: string[], resulted?: string[], caughtUp: Array<{ date: string, observed: boolean }>, alerts: string[] }>}
 */
export async function closeIdeaBook(db, bookRef, { date, now = new Date(), fetchCorporateActions = undefined, caFetchImpl = undefined } = {}) {
  if (!db || !bookRef) throw new Error('closeIdeaBook: db and bookRef required');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('closeIdeaBook: date required');
  // 'off': no Practice Field code path runs, whoever calls. Before any read.
  if (!practiceFieldLive()) return { closed: false, skipped: 'practice_field_off', alerts: [] };

  const caughtUp = [];
  const windowsAccounted = [];
  const alerts = [];
  // Amendment F-1: BEFORE any session is closed, the backfill each long coverage gap needs, fetched through `date`
  // (caBackfill.js; outside the transactions, fenced — a failure only leaves the doubt). The first close after an
  // outage — the flag's time 'off' included — finds the gap and closes it from the backfill, in order.
  // (T1a-2b-4: `caFetchImpl`, the HTTP fetch under the backfill's parse report — the global fetch in production; a row
  // hands a vendor fake, so the report observes what that fake answers.)
  const backfill = await ensureCoverageBackfills(db, bookRef, { through: date, now, ...(fetchCorporateActions ? { fetchCorporateActions } : {}), ...(caFetchImpl ? { fetchImpl: caFetchImpl } : {}) });
  alerts.push(...backfill.alerts);
  const cancelled = [];
  const resulted = [];
  for (;;) {
    const res = await closeNextSessionKeepingAlerts(db, bookRef, { date, now }, alerts);
    alerts.push(...(res.alerts || []));
    windowsAccounted.push(...(res.windowsAccounted || []));
    cancelled.push(...(res.cancelled || []));
    resulted.push(...(res.resulted || []));
    if (res.closed && res.session === date) return { ...res, cancelled, resulted, caughtUp, windowsAccounted, alerts };
    // T2B-02: a transaction that only accounted for sessions by the window cursor, with more left before the one to
    // value — go on (it is not a valuation, so it does not count against the catch-up's bound).
    if (!res.closed && res.skipped === 'windows_accounted') continue;
    if (!res.closed) {
      // A refusal says only what it refused — plus whatever sessions this call caught up or accounted for before it.
      return caughtUp.length > 0 || windowsAccounted.length > 0 ? { ...res, cancelled, resulted, caughtUp, windowsAccounted, alerts } : { ...res, alerts };
    }
    caughtUp.push({ date: res.session, observed: res.observed });
    if (!res.observed) alerts.push(`PRACTICE_FIELD_SESSION_UNOBSERVED ${bookRef.id} ${res.session} — no stored close snapshot; the session is recorded as unobserved`);
    // A caught-up session's close completed the wind-down (T1a-2b-1 §6): the book is closed, and `date` is not a
    // session it is owed. Not "left unclosed" (sweep.js ideaCloseLeftUnclosed).
    if (res.bookClosed) return { closed: false, skipped: 'book_closed', bookClosed: true, cancelled, resulted, caughtUp, windowsAccounted, alerts };
    // A bound on one call's work, never on the catch-up: the next fire continues from where this one stopped.
    if (caughtUp.length >= CATCH_UP_MAX_SESSIONS_PER_CALL) return { closed: false, skipped: 'catch_up_incomplete', cancelled, resulted, caughtUp, windowsAccounted, alerts };
  }
}
