// api/_utils/practiceField/exits.js
//
// Practice Field T1a-2a — THE SALES CODE MAKES, AT THE WINDOWS (Amendment E1, E3, E4, E8, E9, E14; shared contract V2
// §14 cases B-ORDER, B-LINE; build prompt §2, §4, §5). The first code in the idea book that sells anything. The
// idea-book pass calls `runIdeaBookSalesPass` at every window BEFORE the entry pass (E8: sales come first). It makes
// no model call.
//
// TWO SALES, ONE PATH. A holding is sold only because a CLOSE said so (close.js, settlement.js), under one of the
// two origins the build prompt names:
//   `line_exit`      a sale BEFORE the endpoint. Either the holding's own line was recognised: that holding, whole,
//                    and no other (E1) — or a delisting with no cash amount left the holding waiting (E11). The
//                    second recognised no line: the record keeps the origin and says what queued it
//                    (`queuedBy.reason: 'delisting'`), the result counts it apart from the line exits and the
//                    process column names it by its cause. The proceeds stay in the idea's cash; the idea goes back
//                    to `holding` while other holdings remain;
//   `settlement`     the idea reached its endpoint and is `settled`: everything it still holds. When the last one
//                    has filled, in the SAME transaction the idea's cash returns to the treasury, its slot and its
//                    coverage are released and it becomes `resulted`, with the liquidation's proceeds and its
//                    slippage against the endpoint (which is not part of the result — E4).
// Both go through `executeIdeaFill` (fills.js) and nothing else: an eligible mark from THIS window's stored slot
// snapshot, observed after the close that queued the sale, no older than the engine's 20 minutes, priced at the
// tier the holding ENTERED with (E5). The comparison and SPY ledgers are never touched here (E3).
//
// THE STORED SNAPSHOT, READ HERE (review FR-A7). The fill reads `mandateUniverseSnapshots/{tickKey}` itself, inside
// its transaction; it takes no snapshot from its caller. A missing document means no fill this window.
//
// NOTHING MOVES PAST AN UNCLOSED SESSION (sessions.js; review RH-1, RH-2). A sale is refused while a session before
// its window is unclosed, or when its own session's close is already written: a later catch-up would otherwise close
// a past session from a ledger the sale had already changed.
//
// THE FIRST ELIGIBLE WINDOW (E15; review RH-5). A sale is not attempted before the first window that opens after the
// close that queued it. A sale that fills in a LATER window with no refusal on record — no pass ran — is recorded as
// late, and the idea's process quality reads `blocked`: `followed_plan` means every code action filled at its first
// eligible window.
//
// A SALE NEVER FILLS ACROSS A CORPORATE ACTION (review SX-1; second refuter pass 2a, 2b). Actions are applied at the
// close, so a window on the day one takes effect shows an adjusted price beside an unadjusted holding. The sale is
// HELD — recorded like a wait, under its own name — while an action for the holding is due and unapplied, while the
// ledger holds an unsettled share-basis conflict on it, while the engine's gap screen suspects a split, or while the
// session's daily layer (`mandateUniverseDaily/{date}`, read here, never written) says the day's action fetch failed
// for the symbol. A conflicting cash dividend holds nothing, and a holding a delisting left waiting is not put
// through the gap screen (ledger.js saleHeldBackBy).
//
// A SALE WITH NO ELIGIBLE PRICE WAITS (E9). Nothing fills — never at a carried mark, never at cost. The holding
// records the refusal (the count and the sessions whole; the most recent refusals in full), the idea's process
// quality reads `blocked`, the slot stays occupied, and from the fifth session of waiting the pass logs
// PRACTICE_FIELD_SALE_WAITING once per session. A founder tool to resolve it is T5.
//
// ONE TRANSACTION PER IDEA, idempotent: a holding already sold is no longer there to sell; a window already recorded
// on a waiting holding is not recorded twice. The book is reconciled as read, before anything is decided, and as it
// will be written, before anything is written (reject, never repair).

import { buildDecision } from '../mandateSchema.js';
import { MANDATE_FRICTION_MODEL_VERSION } from '../mandateConfig.js';
import { isIdeaBook } from '../mandateBookKind.js';
import {
  IDEA_STATUS, RUNNING_IDEA_STATUSES, DECISION_ORIGIN_LINE_EXIT, DECISION_ORIGIN_SETTLEMENT, SALE_CAUSE_DELISTING, PROCESS_QUALITY, EXIT_REASON,
  PRACTICE_FIELD_CONTRACT_VERSION, SALE_WAITING_ALERT_SESSIONS, SALE_WAITING_REFUSALS_KEPT,
} from './constants.js';
import { PracticeFieldError, isPracticeFieldError } from './errors.js';
import { practiceFieldLive } from './mode.js';
import { executeIdeaFill, isCostTier } from './fills.js';
import { cloneLedger, markedEquityCents, saleHeldBackBy } from './ledger.js';
import { pendingSaleOf, completedLiquidation } from './settlement.js';
import { coverageRefOf, coverageRef, coverageWithoutRef } from './coverage.js';
import { assertReconciled } from './reconcile.js';
import { fillSessionRefusal } from './sessions.js';
import { firstWindowAfter, nextWindowAfter, compareWindows, ideaSaleSlots } from './windows.js';
import { MARK_REFUSAL, quotePastMaxAge } from './marks.js';
import { toCents, fromCents } from './money.js';

const LOG_PREFIX = '[PracticeFieldSales]';

/** Is `tick` one of the windows code sells at, keyed as that window is? */
export function isSaleWindow(tick) {
  return ideaSaleSlots().includes(tick?.slot) && tick.tickKey === `${tick.date}_${tick.slot}`;
}

/** The refusal of a sale whose day has no corporate-action data for its symbol (the daily layer's `caFetchFailed`). */
export const CORPORATE_ACTION_DATA_MISSING = 'corporate_action_data_missing';
/** The refusals that hold a sale back for a corporate action, not for a price. */
const CORPORATE_ACTION_HOLDS = new Set(['corporate_action_pending', 'corporate_action_unsettled', 'suspected_corporate_action', CORPORATE_ACTION_DATA_MISSING]);
/** `{ date, slot }` of a window's key (`YYYY-MM-DD_slot`). */
const windowOfTickKey = (tickKey) => ({ date: String(tickKey).slice(0, 10), slot: String(tickKey).slice(11) });

/** The deterministic decision id of one sale: an idea sells a holding once, whole. */
export function saleDecisionId(ideaId, origin, symbol) {
  return `${ideaId}__${origin}__${symbol}`;
}

/** The holding's waiting record after one more refused window. A window already recorded is not recorded twice. */
function waitingAfter(prior, { tick, refusal, nowIso }) {
  const w = prior || { attempts: 0, sessions: [], firstTickKey: tick.tickKey, lastTickKey: null, refusals: [], alertedOn: null };
  if (w.lastTickKey === tick.tickKey) return { waiting: w, recorded: false };
  return {
    recorded: true,
    waiting: {
      ...w,
      attempts: w.attempts + 1,
      sessions: w.sessions.includes(tick.date) ? w.sessions : [...w.sessions, tick.date],
      lastTickKey: tick.tickKey,
      lastRefusal: refusal,
      refusals: [...w.refusals, { tickKey: tick.tickKey, refusal, at: nowIso }].slice(-SALE_WAITING_REFUSALS_KEPT),
    },
  };
}

/**
 * The pure core: every pending sale of one idea against one window's stored snapshot. Nothing is written.
 *
 * @param {object} args
 * @param {object} args.book      the book as read
 * @param {object} args.idea      the idea as read (`line_hit_exit_pending` or `settled`, with pending holdings)
 * @param {Array<object>} args.others  the book's other open ideas, as read
 * @param {object|null} args.snapshot  THE stored slot snapshot of `tick`, or null when none is stored
 * @param {object|null} args.coverageData
 * @param {{ date: string, slot: string, tickKey: string }} args.tick
 * @param {string} args.nowIso
 * @returns {{ changed: boolean, nextIdea: object, nextBook: object, nextCoverage: object|null, openIdeas: Array<object>,
 *             decisions: Array<[string, object]>, sold: Array<object>, waited: Array<object>, resulted: boolean, alerts: string[] }}
 */
export function planPendingSales({ book, idea, others, snapshot, daily = null, coverageData = null, tick, nowIso }) {
  const ideaId = idea.ideaId;
  let ledger = cloneLedger(idea.ledger);
  const positions = { ...(book.portfolio.positions || {}) };
  let bookCashCents = toCents(book.portfolio.cash);
  let frictionCents = toCents(book.portfolio.frictionPaidCum || 0);
  const decisions = [];
  const sold = [];
  const waited = [];
  const alerts = [];
  let changed = false;
  let blockedBy = [...(idea.blockedBy || [])];
  let waitedSessions = [...(idea.waitedSessions || [])];

  for (const symbol of Object.keys(ledger.holdings).sort()) {
    const holding = ledger.holdings[symbol];
    const pending = pendingSaleOf(holding);
    if (!pending) continue;
    const settlement = holding.settlementPending != null;
    // The two origins the build prompt names. A holding a delisting left waiting is sold as a `line_exit` too — the
    // only sale before the endpoint — and its CAUSE is kept beside it for the process column and the result's counts.
    const origin = settlement ? DECISION_ORIGIN_SETTLEMENT : DECISION_ORIGIN_LINE_EXIT;
    const cause = settlement ? 'settlement_sale' : (pending.reason === EXIT_REASON.DELISTING ? SALE_CAUSE_DELISTING : DECISION_ORIGIN_LINE_EXIT);
    // The first eligible window is the first that opens after the close that queued the sale. Before it, nothing is
    // attempted and nothing is recorded: no quote in an earlier window can have been observed after the decision.
    // A window whose quotes all predate the decision (a close that ran late, just before a slot) was refused
    // `before_decision` and left a marker: the first eligible window is then the one after it (review SX-10).
    const earliest = pending.notBefore ? nextWindowAfter(pending.notBefore) : firstWindowAfter(pending.at);
    const firstWindow = earliest;
    if (firstWindow === null || compareWindows(tick, firstWindow) < 0) continue;

    let fill = null;
    let refusal = null;
    // A sale never fills across a corporate action (review SX-1). Actions are applied at the CLOSE; a window on the
    // day one takes effect shows the already-adjusted price beside a holding that is not yet adjusted. So a holding
    // with an action due and unsettled, an unsettled conflict, or a price gap with a split's signature WAITS (E9):
    // the close applies the action, and the sale fills at the next eligible observation.
    const heldBack = snapshot ? saleHeldBackBy(ledger, symbol, snapshot, { sinceDate: book.execState?.lastCloseKey ?? null, date: tick.date }) : null;
    if (!snapshot) refusal = 'no_stored_snapshot';
    // The day's corporate-action fetch FAILED for this symbol (the daily layer says so; the slot snapshot does not
    // carry it): "no action listed" then means nothing, and a split below the gap screen's threshold would be sold
    // across. The sale waits that session under its own name (second refuter pass, 2a).
    // A daily document that has NO ENTRY for the symbol knows as little (it was built without the idea book's
    // coverage): held the same way (third refuter pass). With no daily document at all nothing can be said, and
    // the slot snapshot's own lists are all there is; the cron never builds a slot snapshot without one.
    else if (daily && (daily.symbols?.[symbol] == null || daily.symbols[symbol].caFetchFailed === true)) refusal = CORPORATE_ACTION_DATA_MISSING;
    else if (heldBack !== null) refusal = heldBack;
    else {
      try {
        // EVERY sale goes through executeIdeaFill (build prompt rule 7), at the tier the holding entered with (E5).
        fill = executeIdeaFill({
          ledger, verb: 'SELL', symbol, snapshot, notBeforeIso: pending.at, sessionDate: tick.date,
          friction: isCostTier(holding.costTier) ? holding.costTier : null,
        });
      } catch (err) {
        if (isPracticeFieldError(err, 'no_eligible_mark')) refusal = err.detail.refusal;
        else if (isPracticeFieldError(err, 'fill_refused')) refusal = `fill_refused:${err.detail.reason}`;
        else if (isPracticeFieldError(err, 'cost_tier_unknown')) refusal = 'cost_tier_unknown';
        else throw err;
      }
    }

    // A window whose quotes all predate the decision was never eligible: it is marked, so the next window is the
    // first eligible one, and nothing is counted against the idea. But a quote that predates the decision AND is past
    // the maximum age is no such thing — the name has simply not printed (a sale queued by a window-time catch-up
    // meets one at the next window, hours later): that is a window with no usable price, recorded as the wait it
    // is, under the refusal the age check would have given (second refuter pass, 3a).
    if (refusal === MARK_REFUSAL.BEFORE_DECISION && quotePastMaxAge(snapshot, symbol)) refusal = MARK_REFUSAL.STALE_QUOTE;
    if (refusal === MARK_REFUSAL.BEFORE_DECISION) {
      if (pending.notBefore?.tickKey !== tick.tickKey) {
        const key = settlement ? 'settlementPending' : 'exitPending';
        ledger.holdings[symbol] = { ...holding, [key]: { ...pending, notBefore: { date: tick.date, slot: tick.slot, tickKey: tick.tickKey } } };
        changed = true;
      }
      continue;
    }
    if (refusal !== null) {
      // E9: the sale waits. Nothing fills.
      const { waiting, recorded } = waitingAfter(pending.waiting, { tick, refusal, nowIso });
      waited.push({ symbol, origin, refusal, sessions: waiting.sessions.length });
      if (!recorded) continue;
      let next = waiting;
      if (waiting.sessions.length >= SALE_WAITING_ALERT_SESSIONS && waiting.alertedOn !== tick.date) {
        alerts.push(`PRACTICE_FIELD_SALE_WAITING ${ideaId} ${symbol} ${origin} — no eligible price for ${waiting.sessions.length} sessions (last refusal: ${refusal}); the holding is not sold and the slot stays occupied`);
        next = { ...waiting, alertedOn: tick.date };
      }
      const key = settlement ? 'settlementPending' : 'exitPending';
      ledger.holdings[symbol] = { ...holding, [key]: { ...pending, waiting: next } };
      if (!waitedSessions.includes(tick.date)) waitedSessions = [...waitedSessions, tick.date];
      // A sale held back for a corporate action did not wait for a price: it says so (second refuter pass).
      const blockKind = CORPORATE_ACTION_HOLDS.has(refusal) ? `${cause}_held_for_corporate_action` : `${cause}_waited`;
      if (!blockedBy.some((b) => b.kind === blockKind && b.symbol === symbol)) blockedBy = [...blockedBy, { kind: blockKind, symbol, session: tick.date }];
      changed = true;
      continue;
    }

    // The sale filled: the idea's ledger and the book's position are two records of one fill.
    const r = fill.receipt;
    const position = positions[symbol];
    if (!position || position.ideaId !== ideaId) throw new PracticeFieldError('sale_position_mismatch', { symbol, ideaId, positionIdeaId: position?.ideaId ?? null });
    const decisionId = saleDecisionId(ideaId, origin, symbol);
    ledger = cloneLedger(fill.ledger);
    ledger.saleReceipts.push({
      decisionId, kind: origin, symbol, shares: r.shares, executedPrice: r.executedPrice, proceedsUsd: r.executedSizeUsd,
      costBasisUsd: fromCents(toCents(holding.costBasisTotal)), realizedPnlUsd: r.realizedPnl, frictionPaidUsd: fromCents(toCents(r.friction.frictionPaid)),
      costTier: r.costTier, mark: r.mark, markVendorTimeIso: r.markVendorTimeIso, tickKey: tick.tickKey, sessionDate: tick.date, at: nowIso,
      firstEligibleWindow: firstWindow.tickKey,
      queuedBy: { session: pending.session ?? null, at: pending.at, reason: pending.reason ?? null, waitedSessions: pending.waiting?.sessions?.length ?? 0 },
    });
    delete positions[symbol];
    bookCashCents += toCents(r.executedSizeUsd);
    frictionCents += toCents(r.friction.frictionPaid);
    decisions.push([decisionId, {
      ...buildDecision({
        decisionId, verb: 'SELL', ticker: symbol,
        requestedSizeUsd: r.requestedSizeUsd, executedSizeUsd: r.executedSizeUsd, executedShares: r.shares,
        executedPrice: r.executedPrice, realizedPnl: r.realizedPnl, fillMarkQuality: 'fresh', clamped: false,
        friction: r.friction, frictionModelVersion: MANDATE_FRICTION_MODEL_VERSION,
        baseRevision: book.revision ?? null, submitTickKey: tick.tickKey, harvestTickKey: tick.tickKey,
        status: 'executed',
      }),
      // Outside the engine's builder on purpose, as the entry's are: a quarterly decision record keeps its shape.
      kind: 'idea_book',
      origin,
      ideaId,
      epochId: idea.contract.epochId,
      contractVersion: PRACTICE_FIELD_CONTRACT_VERSION,
      markVendorTimeIso: r.markVendorTimeIso,
    }]);
    sold.push({ symbol, origin, decisionId, proceedsUsd: r.executedSizeUsd, realizedPnlUsd: r.realizedPnl });
    // E15 (review RH-5): filled later than its first eligible window with no refusal on record — no pass ran then.
    // "On record" means refused at or after THIS sale's first eligible window: a waiting record inherited from the
    // line exit a settlement sale replaced is from before it (second refuter pass, 3b).
    const refusedSinceFirst = pending.waiting?.lastTickKey != null && compareWindows(windowOfTickKey(pending.waiting.lastTickKey), firstWindow) >= 0;
    if (compareWindows(tick, firstWindow) > 0 && !refusedSinceFirst) {
      const lateKind = `${cause}_late`;
      blockedBy = [...blockedBy, { kind: lateKind, symbol, session: tick.date, firstWindow: firstWindow.tickKey, filledAt: tick.tickKey }];
    }
    changed = true;
  }

  // What the fills make of the idea.
  const remaining = Object.values(ledger.holdings);
  let status = idea.status;
  const statusHistory = [...(idea.statusHistory || [])];
  let extra = {};
  let resulted = false;
  if (idea.status === IDEA_STATUS.LINE_HIT_EXIT_PENDING && sold.length > 0 && !remaining.some((h) => h.exitPending != null)) {
    if (remaining.length > 0) {
      // E14: back to holding while other holdings remain.
      status = IDEA_STATUS.HOLDING;
      statusHistory.push({ status, at: nowIso });
    } else {
      // E2: the last holding has exited. This session's close writes the endpoint and the result and frees the slot.
      extra = { earlyResolution: { session: tick.date, at: nowIso, lastSale: sold[sold.length - 1].decisionId } };
    }
  }
  let treasuryCents = toCents(book.treasury.unreservedCash);
  let slots = book.slots;
  let openIdeaIds = book.openIdeaIds || [];
  let nextCoverage = null;
  if (idea.status === IDEA_STATUS.SETTLED && remaining.length === 0) {
    // E14: the liquidation has filled. The cash returns to the treasury and the slot frees, in this transaction.
    resulted = true;
    status = IDEA_STATUS.RESULTED;
    statusHistory.push({ status, at: nowIso });
    // With THIS window's blocks: a settlement sale filled late is recorded in the transaction that fills it.
    const done = completedLiquidation({ ...idea, blockedBy }, ledger, { session: tick.date, nowIso });
    extra = done.fields;
    ledger.cash = 0;
    treasuryCents += done.returnedCents;
    slots = { ...book.slots, [idea.contract.slot]: book.slots?.[idea.contract.slot] === ideaId ? null : book.slots?.[idea.contract.slot] ?? null };
    openIdeaIds = openIdeaIds.filter((id) => id !== ideaId);
    nextCoverage = coverageWithoutRef(coverageData, coverageRef(idea.bookId, ideaId), nowIso);
  }

  const nextIdea = {
    ...idea,
    ...extra,
    status,
    statusHistory,
    ledger,
    postEntryFillCount: (idea.postEntryFillCount || 0) + sold.length,
    processQuality: blockedBy.length > 0 ? PROCESS_QUALITY.BLOCKED : (idea.processQuality ?? PROCESS_QUALITY.FOLLOWED_PLAN),
    blockedBy,
    waitedSessions,
    revision: (idea.revision || 0) + (sold.length > 0 ? 1 : 0),
  };
  const openIdeas = resulted ? others : [...others, nextIdea];
  const nextBook = {
    ...book,
    treasury: { ...book.treasury, unreservedCash: fromCents(treasuryCents) },
    slots,
    openIdeaIds,
    portfolio: { ...book.portfolio, positions, cash: fromCents(bookCashCents), frictionPaidCum: fromCents(frictionCents) },
    revision: (book.revision || 0) + (sold.length > 0 ? 1 : 0),
  };
  // The book's marked equity on the one R-19 basis (ledger.js), as the entry and the close write it.
  nextBook.portfolio.totalValue = fromCents(markedEquityCents(nextBook.treasury.unreservedCash, openIdeas).equityCents);
  return { changed, nextIdea, nextBook, nextCoverage, openIdeas, decisions, sold, waited, resulted, alerts };
}

/**
 * Sell what one idea has pending, at one window, in one transaction.
 *
 * @returns {Promise<{ outcome: 'sold'|'waiting'|'nothing_pending'|'not_this_session'|'not_a_sale_window'|'not_found'|'book_not_open'|'practice_field_off',
 *                     sold?: Array<object>, waited?: Array<object>, resulted?: boolean, alerts?: string[] }>}
 */
export async function sellPendingHoldings(db, { bookRef, ideaId, tick, nowIso }) {
  // 'off': no Practice Field code path runs, whoever calls. Before any read.
  if (!practiceFieldLive()) return { outcome: 'practice_field_off' };
  if (typeof tick?.tickKey !== 'string' || typeof tick?.date !== 'string') throw new Error('sellPendingHoldings: tick required');
  // Code sells at its windows only (review SX-8): never from a close snapshot, never under a key that is not the slot's.
  if (!isSaleWindow(tick)) return { outcome: 'not_a_sale_window' };
  const ideaRef = bookRef.collection('ideas').doc(ideaId);
  // THE stored slot snapshot of this window (FR-A7). The collection by its literal name, for the protected-store scan.
  const snapshotRef = db.collection('mandateUniverseSnapshots').doc(tick.tickKey);
  // The session's daily layer, READ ONLY: it alone records that the day's corporate-action fetch failed for a symbol.
  const dailyRef = db.collection('mandateUniverseDaily').doc(tick.date);
  const coverageDocRef = coverageRefOf(db);

  return db.runTransaction(async (tx) => {
    const bookSnap = await tx.get(bookRef);
    if (!bookSnap.exists || !isIdeaBook(bookSnap.data())) return { outcome: 'not_found' };
    const book = bookSnap.data();
    // E13: a draining book gets every code duty.
    if (book.status !== 'active' && book.status !== 'draining') return { outcome: 'book_not_open' };
    const ideaSnap = await tx.get(ideaRef);
    if (!ideaSnap.exists) return { outcome: 'not_found' };
    const idea = ideaSnap.data();
    const sellable = RUNNING_IDEA_STATUSES.includes(idea.status) || idea.status === IDEA_STATUS.SETTLED;
    if (!sellable || !Object.values(idea.ledger?.holdings || {}).some((h) => pendingSaleOf(h))) return { outcome: 'nothing_pending' };

    const others = [];
    for (const id of book.openIdeaIds || []) {
      if (id === ideaId) continue;
      const snap = await tx.get(bookRef.collection('ideas').doc(id));
      if (!snap.exists) throw new PracticeFieldError('open_idea_missing', { ideaId: id });
      others.push(snap.data());
    }
    // Nothing moves past an unclosed session (sessions.js): refused before anything is decided or recorded.
    const sessionRefusal = fillSessionRefusal(book, [...others, idea], tick.date);
    if (sessionRefusal !== null) return { outcome: 'not_this_session', reason: sessionRefusal };
    const snapshotSnap = await tx.get(snapshotRef);
    const snapshot = snapshotSnap.exists ? snapshotSnap.data() : null;
    if (snapshot && (snapshot.tickKey !== tick.tickKey || snapshot.sessionDate !== tick.date)) {
      throw new PracticeFieldError('sale_snapshot_mismatch', { expected: tick.tickKey, got: snapshot.tickKey ?? null, sessionDate: snapshot.sessionDate ?? null });
    }
    const coverageSnap = await tx.get(coverageDocRef);
    const coverageData = coverageSnap.exists ? coverageSnap.data() : null;
    const dailySnap = await tx.get(dailyRef);
    const daily = dailySnap.exists ? dailySnap.data() : null;
    // Reject, never repair: the book as READ must reconcile before a sale is decided. A sale rewrites the book's
    // cash, positions and equity, so a check of the next state alone would overwrite an inconsistent one and pass.
    assertReconciled(book, [...others, idea]);

    const plan = planPendingSales({ book, idea, others, snapshot, daily, coverageData, tick, nowIso });
    if (!plan.changed) return { outcome: 'waiting', sold: [], waited: plan.waited, resulted: false, alerts: [] };
    assertReconciled(plan.nextBook, plan.openIdeas);

    tx.set(ideaRef, plan.nextIdea);
    // CREATE-ONCE (contract §10): an idea sells a holding once, so its receipt can never already exist. If one does,
    // the whole transaction aborts and nothing is sold.
    for (const [decisionId, doc] of plan.decisions) tx.create(bookRef.collection('decisions').doc(decisionId), doc);
    if (plan.sold.length > 0) {
      tx.update(bookRef, {
        portfolio: plan.nextBook.portfolio, treasury: plan.nextBook.treasury, slots: plan.nextBook.slots,
        openIdeaIds: plan.nextBook.openIdeaIds, revision: plan.nextBook.revision,
      });
    }
    if (plan.resulted) tx.set(coverageDocRef, plan.nextCoverage);
    return { outcome: plan.sold.length > 0 ? 'sold' : 'waiting', sold: plan.sold, waited: plan.waited, resulted: plan.resulted, alerts: plan.alerts };
  });
}

/**
 * The sales pass for one book at one window. Per-idea isolation: one idea's failure never blocks another. A book that
 * is `draining` is served exactly as an active one (E13).
 *
 * @returns {Promise<{ served: boolean, sold: number, waiting: number, resulted: number, errors: number, alerts: string[] }>}
 */
export async function runIdeaBookSalesPass(db, { bookRef, tick, now = new Date() }) {
  const out = { served: false, sold: 0, waiting: 0, resulted: 0, errors: 0, alerts: [] };
  if (!practiceFieldLive()) return out;
  if (!isSaleWindow(tick)) return out;
  const bookSnap = await bookRef.get();
  if (!bookSnap.exists) return out;
  const book = bookSnap.data();
  if (!isIdeaBook(book) || (book.status !== 'active' && book.status !== 'draining')) return out;
  out.served = true;
  const nowIso = now.toISOString();
  for (const ideaId of book.openIdeaIds || []) {
    try {
      // A cheap look first: an idea with nothing waiting to be sold costs one read and no transaction. The
      // transaction re-reads and decides; this only spares it.
      const peek = await bookRef.collection('ideas').doc(ideaId).get();
      if (!peek.exists || !Object.values(peek.data().ledger?.holdings || {}).some((h) => pendingSaleOf(h))) continue;
      const res = await sellPendingHoldings(db, { bookRef, ideaId, tick, nowIso });
      out.sold += (res.sold || []).length;
      out.waiting += (res.waited || []).length;
      if (res.resulted) out.resulted += 1;
      for (const alert of res.alerts || []) {
        out.alerts.push(alert);
        console.error(`${LOG_PREFIX} ${bookRef.id} ${alert}`);
      }
    } catch (err) {
      out.errors += 1;
      const code = isPracticeFieldError(err) ? err.code : 'error';
      console.error(`${LOG_PREFIX} ${bookRef.id} idea ${ideaId} sale failed at ${tick.tickKey} (${code}): ${err.message}`);
    }
  }
  return out;
}
