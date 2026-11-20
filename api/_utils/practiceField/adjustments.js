// api/_utils/practiceField/adjustments.js
//
// Practice Field T1a-2b-4 — LATE AND CORRECTED DATA (Astra T2D-03, T2D-04, T2D-05), and its fix round: LATE DATA ASKS (the
// founder's ruling of 20 Nov 2026, L-1 to L-8; Astra's T2E-01 to T2E-08). Money the data now shows was owed differently from
// what a ledger received is corrected by ONE NEW LINKED RECORD — never a rewrite of a receipt, a holding's history or a
// result — and, since the fix round, ONLY WITH THE FOUNDER'S AUTHORITY:
//
//   late_entitlement  a cash dividend first listed AFTER the ledger stopped holding the stock (the idea's line sale), dated
//                     while it held it — PROPOSED, on the ex-date count (T2D-03);
//   late_basis        a paid dividend whose ex-date count a share-basis action applied after it changes (listed late), or a
//                     founder's ratio correction changes — PROPOSED (T2D-04);
//   ruled_correction  the founder's ruling (resolve_hold, `conflict`) chose a vendor CORRECTION of an id already settled: a
//                     dividend's amount (posted at the close: the net owed now, on the dated count, less everything
//                     received for the id), or a split's ratio (the count corrected) (T2D-05). Unchanged: it is a ruling.
//
// L-1, NO LATE ADJUSTMENT POSTS ON ITS OWN. A late_entitlement or late_basis is computed and recorded as a PROPOSAL on the
// ledger (`lateProposals`), and alerted; while it waits, the row and the endpoint read below full quality, naming it. The
// founder's `resolve_hold` of kind `late_adjustment` approves or declines ONE proposal (open ideas only — Q-2 as ruled).
// L-2, APPROVAL POSTS THE NET, computed at posting: what the ledger is owed now (the ruled payloads, the dated count) less
// everything it has received for the id — never a chained delta. It is refused (409 at the endpoint; not posted at the
// close) while the id is unresolved, another candidate pairs with it under the re-date rule, a share-basis id dated within
// the holding is unresolved, or a date in the holding interval is uncovered (`blockers`).
// L-3, CLOSED HOLDINGS ARE SCREENED LIKE HELD ONES: before a proposal is made, every row for a closed holding goes through
// the held path's re-date pairing — the other rows of the same close, and the rows observed just outside the holding within
// the re-date window, whose economic identity is kept (`closedOutsideRows`). A paired id is an ambiguity for a `conflict`
// ruling, never a proposal.
// L-8, A RESULTED IDEA: late data is named and alerted only (`proposeOnly`); nothing posts to the treasury.
//
// RECEIVED VERSUS ENTITLED. The entitlement is the ex-date count (countOnExDate: the DATED chain, L-4) times the amount in
// force (the receipt's, or the founder's correction); what was received is the receipt plus every adjustment posted for the
// id. A proposal is made only when something LATE exists for the dividend — a share-basis action applied after it with a
// date on or before its ex-date, a founder's correction, or a dividend first listed after a sale — so on complete, on-time
// data this module records nothing and posts nothing, by construction.
//
// THE HOLDING HISTORY: nothing new is stored for it. A ledger's history of a symbol is derived from what it already keeps:
// its holding while held; the idea's entry session and its sale receipt once sold; the share-basis receipts. A HISTORY-ONLY
// share-basis receipt (`historyOnly: true`) is a split first listed after the ledger sold the stock, dated while it held it —
// it moves no shares, enters the ex-date count of a dividend dated after it, and (L-6) leaves a standing reason when the
// shares sold differ from the shares owed at the sale.
//
// A DOUBT HOLDS IT: nothing is computed on a count in doubt (`doubtOn`), and every refusal is named on the proposal.
// A DEBIT LARGER THAN THE CASH it would come from is not posted: recorded `held: true`, `reason: 'adjustment_exceeds_cash'`.
//
// Pure. The close (close.js) posts the cash on the book's mirror, writes each adjustment's evidence document
// (`mandates/{bookId}/ideas/{ideaId}/evidence/adjustment_{id}`, create-once, content-hashed) and the result's view.

import { roundUsd, roundShares } from '../mandateRounding.js';
import { canonicalContentHash, stableStringify } from '../canonicalHash.js';
import { toCents, fromCents, addUsd } from './money.js';
import {
  cloneLedger, actionIdOf, SHARE_BASIS_TYPES, withinSessions, REDATE_WINDOW_SESSIONS, actionPayloadOf, recordedPayloadsOf,
  CONFLICTING_ACTION, POSSIBLE_REDATE, REVISED_AFTER_RULING, NOT_ENTITLED, founderSettledIds, shareBasisChainOf, datedCountOn,
} from './ledger.js';

export const ADJUSTMENT_KIND = Object.freeze({ LATE_ENTITLEMENT: 'late_entitlement', LATE_BASIS: 'late_basis', RULED_CORRECTION: 'ruled_correction' });
/** Where an adjustment's cash goes: the ledger's own cash (an open idea). (L-8: a resulted idea posts nowhere — its late data
 *  is named and alerted only; the fix round removed the treasury and paper-after-result destinations.) */
export const ADJUSTMENT_POSTED_TO = Object.freeze({ LEDGER: 'ledger' });
export const ADJUSTMENT_EXCEEDS_CASH = 'adjustment_exceeds_cash';
/** L-6: the standing reasons a row, the endpoint and the result read below full quality for. */
export const STANDING_REASON = Object.freeze({ SALE_COUNT_DIFFERS: 'sale_count_differs_from_owed' });
/** The evidence document id of an adjustment. */
export const adjustmentDocIdOf = (id) => `adjustment_${id}`;

const upper = (s) => String(s || '').trim().toUpperCase();
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const byDatePhaseId = (a, b) => String(a.effectiveDate).localeCompare(String(b.effectiveDate))
  || (SHARE_BASIS_TYPES.has(a.type) ? 0 : 1) - (SHARE_BASIS_TYPES.has(b.type) ? 0 : 1) || String(a.actionId).localeCompare(String(b.actionId));

/**
 * THE DETERMINISTIC ID of an adjustment: (idea, ledger, action, kind, correction) — so a replayed close, recomputing the
 * same correction, names the same document (create-once), and posts nothing twice.
 */
export function adjustmentIdOf({ ideaId, ledger, actionId, kind, correction }) {
  return canonicalContentHash({ ideaId: ideaId ?? null, ledger, actionId, kind, correction }).slice(0, 32);
}

/** The adjustments a ledger has POSTED (not held). */
export const postedAdjustments = (ledger) => (ledger?.adjustments || []).filter((a) => a && a.held !== true);
/** The adjustments of a ledger held for the founder (a debit larger than the cash). */
export const heldAdjustments = (ledger) => (ledger?.adjustments || []).filter((a) => a && a.held === true);
/** Whole cents a ledger's posted adjustments moved, for the reconciliation (only those posted to the ledger's own cash). */
export function adjustmentCentsOnLedger(ledger) {
  return postedAdjustments(ledger).filter((a) => a.postedTo === ADJUSTMENT_POSTED_TO.LEDGER).reduce((n, a) => n + toCents(a.amountUsd || 0), 0);
}

/**
 * THE SHARE-BASIS CHAIN of a ledger's symbol, in DATED order (L-4): ledger.js shareBasisChainOf — the one chain the C-16
 * path, the suspicion's residual and every count here read (review AR4-C-1, AR4-C-5). Pure.
 * @returns {{ events: Array<{ actionId, effectiveDate, ratio, before, after, index, historyOnly }>, base: number|null, end: number|null }}
 */
export function shareBasisChain(ledger, symbol) {
  return shareBasisChainOf(ledger, symbol);
}

/**
 * THE COUNT A LEDGER HELD ON AN EX-DATE (C-16; L-4): the count before any share-basis event times every one dated on or
 * before the ex-date, in dated order, rounded at each step — whatever order they were applied in. With no event, the count
 * now (the holding's) or, a closed holding, its count when it closed. Pure.
 * @param {{ held: object|null, closed: { shares: number }|null }} at  the holding now, or the closed holding
 * @returns {{ count: number, from: string, also: string[] }}
 */
export function countOnExDate(ledger, symbol, exDate, { held = null, closed = null } = {}) {
  const dated = datedCountOn(ledger, symbol, exDate);
  if (dated === null) {
    if (held) return { count: Number(held.shares), from: 'holding', also: [] };
    return { count: Number(closed?.shares), from: 'closed', also: [] };
  }
  return { count: dated.count, from: 'dated_chain', also: dated.from };
}

/**
 * THE CLOSED HOLDINGS of a ledger — what it no longer holds, with the dates it held them: for the idea's own ledger, each
 * symbol it SOLD (its sale receipt: `soldOn`, the count sold), opened at the idea's entry session; and, for every ledger
 * of a resulted idea (`closedOn`), each paper holding, closed at that session. Pure.
 * @returns {Map<string, { openedAt: string|null, through: string, shares: number }>}
 */
export function closedHoldingsOf(ledger, { entrySession = null, closedOn = null } = {}) {
  const out = new Map();
  for (const r of ledger?.saleReceipts || []) {
    const sym = upper(r?.symbol);
    if (!sym || Object.hasOwn(ledger.holdings || {}, sym) || !isDate(r.sessionDate)) continue;
    out.set(sym, { openedAt: entrySession, through: r.sessionDate, shares: Number(r.shares) });
  }
  if (isDate(closedOn)) {
    for (const [sym, h] of Object.entries(ledger?.holdings || {})) out.set(upper(sym), { openedAt: h?.openedAt ?? entrySession, through: closedOn, shares: Number(h?.shares), paper: true });
  }
  return out;
}

/**
 * THE HOLDING A DIVIDEND'S TICKER LEFT THE LEDGER BY OTHER THAN A SALE (review AR4-C-2): a cash delisting (its receipt's
 * `shares`), or a ticker change (the count, on the ex-date, of the holding it became). Null when neither. Pure.
 */
function leftByActionOf(ledger, symbol, exDate) {
  const sym = upper(symbol);
  const receipts = ledger?.corporateActionReceipts || [];
  const delisted = receipts.find((r) => r?.applied === true && upper(r.ticker) === sym && r.cashPerShare != null && Number(r.shares) > 0);
  if (delisted) return { shares: Number(delisted.shares), via: delisted.actionId };
  const renamed = receipts.find((r) => r?.applied === true && r.type === 'ticker_change' && upper(r.ticker) === sym && r.renamedTo != null);
  if (!renamed) return null;
  const to = upper(renamed.renamedTo);
  if (to === sym) return null;
  const held = ledger?.holdings?.[to] ?? null;
  const counted = countOnExDate(ledger, to, exDate, { held, closed: held ? null : leftByActionOf(ledger, to, exDate) });
  return Number(counted.count) > 0 ? { shares: counted.count, via: renamed.actionId } : null;
}

/** The dividends a ledger has been PAID, by id: its applied receipt (or late entitlement), the amount in force, the
 *  cents received for it (receipt + posted adjustments), and the position of its first payment among the receipts. */
function paidDividends(ledger) {
  const out = new Map();
  for (const [index, r] of (ledger?.corporateActionReceipts || []).entries()) {
    if (r?.applied !== true || r.type !== 'cash_dividend') continue;
    out.set(r.actionId, { actionId: r.actionId, ticker: upper(r.ticker), effectiveDate: r.effectiveDate, amount: Number(r.amount), cents: toCents(r.incomeUsd || 0), index, receipt: r });
  }
  for (const a of postedAdjustments(ledger)) {
    if (a.type !== 'cash_dividend') continue;
    if (a.kind === ADJUSTMENT_KIND.LATE_ENTITLEMENT && !out.has(a.actionId)) {
      // (Its place among the receipts: before the first receipt written after it — `seq` is the count of receipts when it
      // was posted, which is the index the NEXT receipt takes. A receipt written at a later close is after it: the soak's
      // 1911240021, a split dated on a late dividend's own ex-date, listed after it was paid, never recomputed it.)
      out.set(a.actionId, { actionId: a.actionId, ticker: upper(a.ticker), effectiveDate: a.effectiveDate, amount: Number(a.amountPerShare), cents: 0, index: Number(a.seq) - 0.5, receipt: null });
    }
    const d = out.get(a.actionId);
    if (!d) continue;
    d.cents += toCents(a.amountUsd || 0);
    if (a.kind === ADJUSTMENT_KIND.RULED_CORRECTION && Number(a.amountPerShare) > 0) d.amount = Number(a.amountPerShare);
  }
  return out;
}

/** The payloads a ledger has seen for `symbol` and `type` (null: every share-basis type — L-5), for the re-date screen of a
 *  closed holding's row: applied receipts, not-entitled declines, every recorded payload of its ambiguity records, its
 *  late entitlements, and (L-1) its OPEN late proposals — a payload the ledger proposed is one it has seen — and (second
 *  refuter P-2b) the last DECLINED late entitlement of an id still unsettled: a decline answers the money, not the id. */
function redatePool(ledger, symbol, type) {
  const ok = (t) => (type === null ? SHARE_BASIS_TYPES.has(t) : t === type);
  const pool = [];
  for (const r of ledger?.corporateActionReceipts || []) {
    if (!ok(r?.type) || upper(r.ticker) !== symbol) continue;
    if (r.applied === true || r.reason === NOT_ENTITLED) pool.push({ actionId: r.actionId, effectiveDate: r.effectiveDate, key: actionPayloadOf(r), type: r.type });
    if (r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE || r.reason === REVISED_AFTER_RULING) {
      for (const p of recordedPayloadsOf(r)) pool.push({ actionId: r.actionId, effectiveDate: r.effectiveDate, key: actionPayloadOf(p), type: r.type });
    }
  }
  for (const a of postedAdjustments(ledger)) {
    if (a.kind === ADJUSTMENT_KIND.LATE_ENTITLEMENT && ok(a.type) && upper(a.ticker) === symbol) pool.push({ actionId: a.actionId, effectiveDate: a.effectiveDate, key: actionPayloadOf({ amount: a.amountPerShare }), type: a.type });
  }
  for (const p of openProposals(ledger)) {
    if (ok(p.type) && upper(p.ticker) === symbol && p.kind === ADJUSTMENT_KIND.LATE_ENTITLEMENT) pool.push({ actionId: p.actionId, effectiveDate: p.effectiveDate, key: actionPayloadOf({ amount: p.amountPerShare }), type: p.type, proposal: p });
  }
  const settled = new Set([...(ledger?.appliedActionIds || []), ...(ledger?.declinedActionIds || [])]);
  const lastOf = new Map();
  for (const p of ledger?.lateProposals || []) if (p) lastOf.set(p.actionId, p);
  for (const p of lastOf.values()) {
    if (p.status !== LATE_PROPOSAL_STATUS.DECLINED || p.kind !== ADJUSTMENT_KIND.LATE_ENTITLEMENT || !ok(p.type) || upper(p.ticker) !== symbol || settled.has(p.actionId)) continue;
    pool.push({ actionId: p.actionId, effectiveDate: p.effectiveDate, key: actionPayloadOf({ amount: p.amountPerShare }), type: p.type, proposal: p });
  }
  return pool;
}

/** Is `actionId` an OPEN ambiguity on the ledger (an unsettled conflict or re-date record, or an unanswered revision)? */
function openRecordOf(ledger, actionId) {
  const settled = new Set([...(ledger?.appliedActionIds || []), ...(ledger?.declinedActionIds || [])]);
  return (ledger?.corporateActionReceipts || []).find((r) => r?.actionId === actionId && (
    ((r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE) && !settled.has(actionId))
    || (r.reason === REVISED_AFTER_RULING && r.closedBy == null))) ?? null;
}

const payloadRow = (a, seenOn) => ({ ratio: a.ratio ?? null, amount: a.amount ?? null, source: a.source ?? null, ...(a.feedOrigin === 'backfill' ? { origin: 'backfill' } : {}), ...(seenOn ? { seenOn } : {}) });

/** The status of a late proposal (L-1). Only an OPEN one waits; the rest are kept as its history. */
export const LATE_PROPOSAL_STATUS = Object.freeze({ OPEN: 'open', POSTED: 'posted', DECLINED: 'declined', SETTLED: 'settled' });
/** Why the founder's approval of a proposal is refused now (L-2) — each a prefix of a blocker `<kind>:<what>`. */
export const LATE_BLOCKER = Object.freeze({
  ID_UNRESOLVED: 'id_unresolved', PAIRS: 'pairs_with', SHARE_BASIS: 'share_basis_unresolved', UNCOVERED: 'date_uncovered', EXCEEDS_CASH: 'exceeds_cash',
});
/** A proposal's id: `late_<ledger>_<actionId>`, and `_<n>` for the n-th proposal of that id on that ledger (n > 1). */
export const proposalIdOf = (ledgerKind, actionId, n = 1) => `late_${ledgerKind}_${actionId}${n > 1 ? `_${n}` : ''}`;
/** A ledger's OPEN late proposals. */
export const openProposals = (ledger) => (ledger?.lateProposals || []).filter((p) => p && p.status === LATE_PROPOSAL_STATUS.OPEN);

/**
 * L-2 ② (fix-round refuter R-1, R-3): THE OPEN CANDIDATES THAT PAIR WITH PROPOSAL `p` UNDER THE RE-DATE RULE on its ledger —
 * another id of its symbol and type, dated within the window of it, whose payload is the proposal's, still standing: an open
 * ambiguity record carrying that payload (a conflict, a possible re-date, an unanswered revision), a row waiting on a doubt
 * (a sold holding's or a held one's), a row kept just outside a sold holding, another open late entitlement. A settled id
 * (applied, declined, ruled) stands for nothing. (Two rows of one close that paired only with each other never named the
 * proposal they both also paired with — R-1, held and sold; a row the vendor moved past the sale never met a proposal it
 * no longer listed — R-3.) Pure.
 * @returns {string[]} the candidates' ids, sorted
 */
export function pairingCandidatesOf(ledger, p) {
  const sym = upper(p?.ticker);
  const type = p?.type || 'cash_dividend';
  const key = actionPayloadOf({ amount: p?.amountPerShare });
  const near = (x) => Boolean(x) && x.actionId !== p.actionId && upper(x.ticker) === sym && x.type === type && isDate(x.effectiveDate)
    && withinSessions(x.effectiveDate, p.effectiveDate, REDATE_WINDOW_SESSIONS);
  const settled = new Set([...(ledger?.appliedActionIds || []), ...(ledger?.declinedActionIds || [])]);
  const out = new Set();
  for (const r of ledger?.corporateActionReceipts || []) {
    if (!near(r)) continue;
    const open = ((r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE) && !settled.has(r.actionId)) || (r.reason === REVISED_AFTER_RULING && r.closedBy == null);
    if (open && recordedPayloadsOf(r).some((x) => actionPayloadOf(x) === key)) out.add(r.actionId);
  }
  const waiting = [...(ledger?.closedHeldRows || []), ...(ledger?.closedOutsideRows || []), ...(ledger?.holdings?.[sym]?.heldActions || [])];
  for (const r of waiting) if (near(r) && !settled.has(r.actionId) && actionPayloadOf(r) === key) out.add(r.actionId);
  for (const q of openProposals(ledger)) {
    if (q.kind === ADJUSTMENT_KIND.LATE_ENTITLEMENT && near(q) && !settled.has(q.actionId) && actionPayloadOf({ amount: q.amountPerShare }) === key) out.add(q.actionId);
  }
  return [...out].sort();
}

/**
 * PLAN ONE LEDGER'S LATE DATA at one close (see the header). Pure.
 *
 * @param {object} ledger
 * @param {object} ctx
 *   ideaId, ledgerKind ('idea' | 'comparison' | 'spy'), date (the session), rows (`{ SYM: [rows] }` this ledger was
 *   handed, the founder's actions among them), ruledIds (Set: ids a pending conflict ruling supplies on this ledger),
 *   closed (closedHoldingsOf), doubtOn(sym, exDate) → boolean (a doubt in the count: nothing is computed on it),
 *   rulingDoubtOn(sym, exDate) → boolean (a sold holding's sticky coverage doubt: what a ruling would post waits — R-5),
 *   blockersOf(sym, exDate, { end }) → string[] (the caller's refusals: uncovered dates, the idea's hold set),
 *   availableCents (what a debit may come from), corrections (the founder's amount corrections applied at this close:
 *   [{ actionId, amount, from, ruling }]), approvals (the founder's pending late_adjustment rulings on this ledger:
 *   [{ proposalId, decision, ruling }]), proposeOnly (a resulted idea: nothing posts — L-8)
 * @returns {{ ledger: object, posted: Array<object>, held: Array<object>, recorded: Array<object>, historyOnly: Array<object>,
 *             proposed: Array<object>, closedProposals: Array<object>, standingReasons: Array<object>, alerts: string[] }}
 */
export function planLedgerAdjustments(ledger, ctx) {
  const { ideaId = null, ledgerKind, date, rows = {}, ruledIds = null, closed = new Map(), doubtOn = () => false, rulingDoubtOn = () => false, blockersOf = () => [], proposeOnly = false } = ctx;
  let available = Number.isFinite(ctx.availableCents) ? ctx.availableCents : toCents(ledger?.cash || 0);
  const out = { ledger, posted: [], held: [], recorded: [], historyOnly: [], proposed: [], closedProposals: [], standingReasons: [], alerts: [] };
  if (!ledger) return out;
  let next = null;
  const edit = () => {
    if (next === null) {
      next = cloneLedger(ledger);
      next.adjustments = [...(ledger.adjustments || [])];
      if (ledger.lateProposals) next.lateProposals = ledger.lateProposals.map((p) => ({ ...p }));
      if (ledger.closedOutsideRows) next.closedOutsideRows = [...ledger.closedOutsideRows];
    }
    return next;
  };
  const cur = () => next ?? ledger;
  const settledNow = () => new Set([...(cur().appliedActionIds || []), ...(cur().declinedActionIds || [])]);

  /**
   * POST one adjustment of `cents` — only with the founder's authority (an approval, a ruling) or as a ruled_correction
   * (L-1). Never on a resulted idea (L-8). A debit larger than the cash it would come from is held, never posted.
   */
  const post = (entry) => {
    if (proposeOnly) return null;
    const l = edit();
    const cents = entry.amountCents;
    const id = adjustmentIdOf({ ideaId, ledger: ledgerKind, actionId: entry.actionId, kind: entry.kind, correction: entry.correction });
    const base = { id, ...entry, ledger: ledgerKind, postedOn: date, postedTo: ADJUSTMENT_POSTED_TO.LEDGER, amountUsd: fromCents(cents), seq: (l.corporateActionReceipts || []).length };
    if (cents < 0 && available + cents < 0) {
      // A debit larger than the cash it would come from: recorded, held, alerted — never posted. One held record per
      // correction (a later close replaces it while it stands).
      const held = { ...base, held: true, reason: ADJUSTMENT_EXCEEDS_CASH, availableUsd: fromCents(available) };
      l.adjustments = [...l.adjustments.filter((a) => !(a.held === true && a.id === id)), held];
      out.held.push(held);
      out.alerts.push(`PRACTICE_FIELD_ADJUSTMENT_HELD ${ideaId} ${ledgerKind} ${entry.actionId} — a ${entry.kind} debit of $${fromCents(-cents)} is larger than the $${fromCents(available)} it would come from (${ADJUSTMENT_EXCEEDS_CASH}); not posted, held for the founder`);
      return null;
    }
    l.adjustments = [...l.adjustments.filter((a) => !(a.held === true && a.id === id)), base];
    l.cash = addUsd(l.cash, base.amountUsd);
    l.dividendsUsd = addUsd(l.dividendsUsd, base.amountUsd);
    available += cents;
    out.posted.push(base);
    return base;
  };

  // ── THE PROPOSALS (L-1) ─────────────────────────────────────────────────────────────────────────────────────────────
  const proposalFields = (p) => ({ kind: p.kind, ticker: p.ticker, effectiveDate: p.effectiveDate, amountPerShare: p.amountPerShare, entitledShares: p.entitledShares, derivation: p.derivation ?? null, owedUsd: p.owedUsd, receivedUsd: p.receivedUsd, netUsd: p.netUsd, trigger: p.trigger ?? [] });
  const openProposalOf = (id) => openProposals(cur()).find((p) => p.actionId === id) ?? null;
  /** Close an open proposal (status, why, and by whom). */
  const closeProposal = (id, status, because, extra = {}) => {
    const p = openProposalOf(id);
    if (!p) return null;
    const l = edit();
    const closedP = { ...p, status, closedOn: date, closedBecause: because, ...extra };
    l.lateProposals = l.lateProposals.map((x) => (x.id === p.id ? closedP : x));
    out.closedProposals.push(closedP);
    return closedP;
  };
  /**
   * PROPOSE (or re-state) the late money of one dividend id on this ledger: what it is owed now on the dated count, less
   * what it has received for the id. Nothing owed beyond what was received: an open proposal is settled. Never posts.
   */
  const propose = (entry) => {
    const net = entry.owedCents - entry.receivedCents;
    const fields = {
      kind: entry.kind, ticker: entry.ticker, effectiveDate: entry.effectiveDate, amountPerShare: entry.amountPerShare, entitledShares: entry.entitledShares,
      derivation: entry.derivation ?? null, owedUsd: fromCents(entry.owedCents), receivedUsd: fromCents(entry.receivedCents), netUsd: fromCents(net), trigger: entry.trigger ?? [],
    };
    const open = openProposalOf(entry.actionId);
    if (net === 0) { if (open) closeProposal(entry.actionId, LATE_PROPOSAL_STATUS.SETTLED, 'nothing_owed', { netUsd: 0 }); return null; }
    // (Fix-round refuter R-2: A DECLINE STICKS. The founder declined this id's last proposal on these very facts — what the
    // ledger is owed for it and what it has received: it is not asked again, and nothing waits. A new late fact — another
    // count, another amount — is a new question.)
    const last = (cur().lateProposals || []).filter((x) => x.actionId === entry.actionId).at(-1) ?? null;
    if (!open && last?.status === LATE_PROPOSAL_STATUS.DECLINED && last.owedUsd === fields.owedUsd && last.receivedUsd === fields.receivedUsd) return null;
    if (open) {
      if (stableStringify(proposalFields(open)) === stableStringify(fields)) return open;
      const l = edit();
      const updated = { ...open, ...fields, updatedOn: date };
      l.lateProposals = l.lateProposals.map((x) => (x.id === open.id ? updated : x));
      out.proposed.push(updated);
      return updated;
    }
    const l = edit();
    const n = (l.lateProposals || []).filter((x) => x.actionId === entry.actionId).length + 1;
    const p = { id: proposalIdOf(ledgerKind, entry.actionId, n), ledger: ledgerKind, actionId: entry.actionId, type: 'cash_dividend', status: LATE_PROPOSAL_STATUS.OPEN, proposedOn: date, ...fields, blockers: [] };
    l.lateProposals = [...(l.lateProposals || []), p];
    out.proposed.push(p);
    out.alerts.push(`PRACTICE_FIELD_LATE_PROPOSED ${ideaId} ${ledgerKind} ${entry.actionId} ${p.id} — ${entry.kind} of $${p.netUsd} (owed $${p.owedUsd} on ${entry.entitledShares} shares, received $${p.receivedUsd}): late data moves no money on its own — it waits for the founder (resolve_hold, late_adjustment)`);
    return p;
  };

  // AN OPEN SHARE-BASIS AMBIGUITY OF THE SYMBOL ON THIS LEDGER — a record this very call made included — holds every
  // count-dependent row of it dated on or after it, as the hold set does for a held symbol (review AR4-A-1). A row waiting
  // on a doubt (`closedHeldRows`) of a share-basis type holds them too. An id a ruling settles at this close is the
  // ruling's, never a doubt. (The held path's order — date, then phase, then id: a share-basis row waits only on one that
  // PRECEDES it — fix-round refuter RFX-2.)
  const shareDoubtOn = (sym, d, selfId = null, selfShare = false) => {
    const l = cur();
    const precedes = (r) => isDate(r.effectiveDate) && (r.effectiveDate < d || (r.effectiveDate === d && (!selfShare || String(r.actionId) < String(selfId))));
    const waiting = (l.closedHeldRows || []).some((r) => SHARE_BASIS_TYPES.has(r.type) && upper(r.ticker) === sym && r.actionId !== selfId && precedes(r));
    if (waiting) return true;
    return (l.corporateActionReceipts || []).some((r) => SHARE_BASIS_TYPES.has(r?.type) && upper(r.ticker) === sym && r.actionId !== selfId
      && !ruledIds?.has(r.actionId) && precedes(r) && openRecordOf(l, r.actionId) !== null);
  };

  // ── 1. CLOSED HOLDINGS (T2D-03; T2D-04 after a sale or a result): rows first listed after the ledger stopped holding the
  //       stock, dated while it held it — screened as the held path screens (L-3), and PROPOSED, never posted (L-1).
  for (const [sym, c] of closed) {
    const inInterval = (a) => isDate(a.effectiveDate) && a.effectiveDate <= c.through && (c.openedAt === null || a.effectiveDate > c.openedAt);
    const listed = (rows[sym] || []).filter((a) => a && upper(a.ticker) === sym && (a.type === 'cash_dividend' || SHARE_BASIS_TYPES.has(a.type))
      && isDate(a.effectiveDate) && a.effectiveDate <= date && inInterval(a));
    const byId = new Map();
    for (const a of listed) {
      const id = typeof a.actionId === 'string' && a.founderRuling ? a.actionId : actionIdOf(a);
      byId.set(id, [...(byId.get(id) || []), { ...a, actionId: id }]);
    }
    // A row that waited on a doubt at an earlier close (`closedHeldRows`): replayed when the feed no longer lists it, and
    // the payload a later different row revises (the late soak's 1795729395 and 1795728065).
    const heldOf = (id) => (cur().closedHeldRows || []).find((r) => r.actionId === id && upper(r.ticker) === sym) ?? null;
    for (const r of cur().closedHeldRows || []) {
      if (upper(r.ticker) !== sym || byId.has(r.actionId) || !(r.effectiveDate <= c.through)) continue;
      byId.set(r.actionId, [{ type: r.type, ticker: sym, effectiveDate: r.effectiveDate, ...(r.ratio != null ? { ratio: r.ratio } : {}), ...(r.amount != null ? { amount: r.amount } : {}), source: r.source ?? null, actionId: r.actionId, fromHeld: true }]);
    }
    // (Fix-round refuter R-1, R-3: AN OPEN LATE ENTITLEMENT IS SCREENED AT EVERY CLOSE, listed now or not — its payload is
    // one the ledger has seen. The rows of this close, and those kept just outside the holding, meet it as they meet a
    // listed row: a pair makes its id an ambiguity for the founder's conflict ruling, and its approval waits.)
    for (const p of openProposals(cur())) {
      if (p.kind !== ADJUSTMENT_KIND.LATE_ENTITLEMENT || upper(p.ticker) !== sym || byId.has(p.actionId) || settledNow().has(p.actionId) || !inInterval(p)) continue;
      byId.set(p.actionId, [{ type: 'cash_dividend', ticker: sym, effectiveDate: p.effectiveDate, amount: p.amountPerShare, source: null, actionId: p.actionId, fromHeld: true, fromProposal: true }]);
    }
    const dropHeld = (id) => { if (heldOf(id)) { const l = edit(); l.closedHeldRows = l.closedHeldRows.filter((r) => r.actionId !== id); if (l.closedHeldRows.length === 0) delete l.closedHeldRows; } };
    // L-3: THE ROWS JUST OUTSIDE THE HOLDING — listed now dated after it closed, or on or before it was bought, within the
    // re-date window of its ends: the same payload under such a date may be this very action moved past the sale (T2E-02:
    // $1 dated after the sale one day, dated before it the next). Their economic identity is KEPT on the ledger
    // (`closedOutsideRows`) for the window, so a row listed at a LATER close still meets them.
    const nearEnds = (a) => withinSessions(a.effectiveDate, c.through, REDATE_WINDOW_SESSIONS) || (c.openedAt !== null && withinSessions(a.effectiveDate, c.openedAt, REDATE_WINDOW_SESSIONS));
    // (Second refuter P-4: a row dated AFTER this close is observed too — the daily layer lists two days ahead — and a
    // vendor that moves a proposal's dividend to the next session is a move past the sale like any other.)
    const outsideNow = (rows[sym] || []).filter((a) => a && !a.founderRuling && upper(a.ticker) === sym && (a.type === 'cash_dividend' || SHARE_BASIS_TYPES.has(a.type))
      && isDate(a.effectiveDate) && !inInterval(a) && nearEnds(a)).map((a) => ({ actionId: actionIdOf(a), type: a.type, ticker: sym, effectiveDate: a.effectiveDate, ratio: a.ratio ?? null, amount: a.amount ?? null }));
    for (const o of outsideNow) {
      const known = (cur().closedOutsideRows || []).some((x) => x.actionId === o.actionId && actionPayloadOf(x) === actionPayloadOf(o));
      if (!known) { const l = edit(); l.closedOutsideRows = [...(l.closedOutsideRows || []), { ...o, seenOn: date }]; }
    }
    const outsidePool = (type) => (cur().closedOutsideRows || []).filter((x) => upper(x.ticker) === sym && x.type === type).map((x) => ({ actionId: x.actionId, effectiveDate: x.effectiveDate, key: actionPayloadOf(x), type: x.type }));
    // REVISIONS FIRST (review AR4-C-3; the open path's T2D-D01 pre-pass).
    const sorted = [...byId].sort(([, a], [, b]) => byDatePhaseId(a[0], b[0]));
    // (The payload the ledger already holds for an UNSETTLED id: a row waiting on a doubt, or an open late ENTITLEMENT
    // proposal — L-1 — or (second refuter P-2a) the one the founder DECLINED last: a decline settles nothing, and the
    // payload it answered is one the ledger has seen. A late_basis proposal is of a paid, settled id: its revisions are the
    // settled path's.)
    const priorProposalOf = (id) => {
      if (settledNow().has(id)) return null;
      const open = openProposalOf(id);
      if (open) return open.kind === ADJUSTMENT_KIND.LATE_ENTITLEMENT ? open : null;
      const last = (cur().lateProposals || []).filter((x) => x.actionId === id).at(-1) ?? null;
      return last && last.status === LATE_PROPOSAL_STATUS.DECLINED && last.kind === ADJUSTMENT_KIND.LATE_ENTITLEMENT ? last : null;
    };
    const priorKeyOf = (id) => {
      const held = heldOf(id);
      if (held) return actionPayloadOf(held);
      const p = priorProposalOf(id);
      return p ? actionPayloadOf({ amount: p.amountPerShare }) : null;
    };
    const revisionFirst = ([id, group0]) => {
      const listedHere = group0.filter((a) => !a.fromHeld);
      if (listedHere.length === 0) return false;
      if (settledNow().has(id)) return true;
      const prior = priorKeyOf(id);
      return prior !== null && listedHere.some((a) => !a.founderRuling && actionPayloadOf(a) !== prior);
    };
    const ordered = [...sorted.filter(revisionFirst), ...sorted.filter((x) => !revisionFirst(x))];
    // L-3 (Astra T2E-01): BEFORE A PROPOSAL IS MADE, THE ROWS OF THIS CLOSE ARE PAIRED with one another under the held path's
    // re-date rule — the same type and payload within the window — and (L-5) two share-basis ids of one date pair whatever
    // their ratios. A paired id is an ambiguity for the founder's `conflict` ruling, never a proposal: both are recorded.
    // (One at a time, the earlier-dated id met an empty pool and was paid; only the later one waited — whichever order the
    // vendor's array had.)
    {
      const candidates = [];
      for (const [id, group0] of ordered) {
        const group = group0.filter((a) => !a.founderRuling);
        if (group.length === 0 || group0.some((a) => a.founderRuling && ruledIds?.has(id))) continue;
        if (settledNow().has(id) || openRecordOf(cur(), id) !== null) continue;
        const keys = [...new Set(group.map(actionPayloadOf))];
        if (keys.length !== 1) continue;
        const prior = priorKeyOf(id);
        if (prior !== null && prior !== keys[0]) continue;
        candidates.push({ id, row: group[0], key: keys[0] });
      }
      const paired = new Set();
      for (const a of candidates) {
        for (const b of candidates) {
          if (a === b || paired.has(a.id)) continue;
          const sameDateShare = SHARE_BASIS_TYPES.has(a.row.type) && SHARE_BASIS_TYPES.has(b.row.type) && a.row.effectiveDate === b.row.effectiveDate;
          const redate = a.row.type === b.row.type && a.key === b.key && withinSessions(a.row.effectiveDate, b.row.effectiveDate, REDATE_WINDOW_SESSIONS);
          if (!sameDateShare && !redate) continue;
          paired.add(a.id);
          const how = redate ? 'possible_redate' : 'same_date_share_basis';
          dropHeld(a.id);
          const l = edit();
          const rec = { actionId: a.id, type: a.row.type, ticker: sym, effectiveDate: a.row.effectiveDate, ratio: a.row.ratio ?? null, amount: a.row.amount ?? null, cashPerShare: null, source: a.row.source ?? null, applied: false, reason: POSSIBLE_REDATE, redateOf: b.id, seenOn: date, rows: [payloadRow(a.row, null)], kinds: [how], closedHolding: true };
          l.corporateActionReceipts = [...l.corporateActionReceipts, rec];
          out.recorded.push(rec);
          out.alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_REDATE ${ideaId} ${ledgerKind} ${a.id} — ${how === 'possible_redate' ? `the same ${a.row.type} as ${b.id}, under a moved date` : `a second share-basis id of ${sym} on ${a.row.effectiveDate} beside ${b.id}`}, both first listed after the holding closed: not proposed — the founder rules it (resolve_hold, conflict)`);
        }
      }
    }
    const handle = (id, group0) => {
      // (S-1 ②, for a closed holding: the feed now lists the id with a payload other than the one it waited with — a revision.)
      const held = heldOf(id);
      const proposal = openProposalOf(id);
      const listedHere = group0.filter((a) => !a.fromHeld);
      const group = listedHere.length > 0 ? listedHere : group0;
      const first = group[0];
      const ruled = group.find((a) => a.founderRuling?.kind === 'conflict' && ruledIds?.has(id)) ?? null;
      const keys = [...new Set(group.filter((a) => !a.founderRuling).map(actionPayloadOf))];
      // (A waiting row, or an open PROPOSAL of the id — L-1: its payload is one the ledger has seen — revised by a row listed
      // now with another payload: the id is ambiguous; a proposal under it waits on the founder's conflict ruling.)
      const priorKey = priorKeyOf(id);
      if (!ruled && priorKey !== null && listedHere.length > 0 && keys.some((k) => k !== priorKey)) {
        const l = edit();
        const prior = held ? null : priorProposalOf(id);
        const priorRow = held ? payloadRow(held, held.heldOn ?? null) : payloadRow({ amount: prior.amountPerShare }, prior.proposedOn ?? null);
        const rowsAll = [...new Map([priorRow, ...group.filter((a) => !a.founderRuling).map((a) => payloadRow(a, date))].map((x) => [actionPayloadOf(x), x])).values()];
        const rec = { actionId: id, type: first.type, ticker: sym, effectiveDate: first.effectiveDate, applied: false, reason: CONFLICTING_ACTION, entitled: true, rows: rowsAll, seenOn: date, kinds: ['revision'], revisedFrom: held ? { heldOn: held.heldOn ?? null } : { proposal: prior.id, ...(prior.status === LATE_PROPOSAL_STATUS.DECLINED ? { declined: true } : {}) }, closedHolding: true };
        l.corporateActionReceipts = [...l.corporateActionReceipts, rec];
        out.recorded.push(rec);
        dropHeld(id);
        out.alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_AMBIGUOUS ${ideaId} ${ledgerKind} ${sym} ${id} — revision on a holding since closed (it ${held ? 'waited' : 'was proposed'} with another payload): nothing is paid until the founder rules`);
        return;
      }
      if (settledNow().has(id)) {
        dropHeld(id);
        // A different payload under an id already settled on this ledger: the vendor's correction (T2D-05) — recorded,
        // never applied by code (a ruling then corrects it through the recompute below).
        const settledKey = (() => {
          const r = (cur().corporateActionReceipts || []).find((x) => x?.actionId === id && x.applied === true);
          if (r) return actionPayloadOf(r);
          const adj = postedAdjustments(cur()).find((x) => x.actionId === id && x.kind === ADJUSTMENT_KIND.LATE_ENTITLEMENT);
          return adj ? actionPayloadOf({ amount: adj.amountPerShare }) : null;
        })();
        const seen = new Set([settledKey]);
        for (const x of cur().corporateActionReceipts || []) if (x?.actionId === id && x.reason === REVISED_AFTER_RULING) for (const p of x.rows || []) seen.add(actionPayloadOf(p));
        // (FQ-5 on the closed path — review AR4-C-9: every payload a founder's ruling of the id covered, `seen` included.)
        for (const k of founderSettledIds(cur()).get(id)?.keys || []) seen.add(k);
        // (…and, fix round, every payload the founder's CONFLICT ruling saw when it settled the id on this closed holding — a
        // late entitlement posted under that ruling (L-3: a revision of a proposed id is an ambiguity for the founder), as a
        // ruled_correction's.)
        for (const a of postedAdjustments(cur())) if (a.actionId === id && (a.kind === ADJUSTMENT_KIND.RULED_CORRECTION || a.ruling?.kind === 'conflict')) { for (const p of a.ruling?.seen || []) seen.add(actionPayloadOf(p)); seen.add(actionPayloadOf(a.payload || {})); }
        const fresh = group.filter((a) => !a.founderRuling && settledKey !== null && !seen.has(actionPayloadOf(a)));
        if (fresh.length > 0) {
          const l = edit();
          const open = (l.corporateActionReceipts || []).find((x) => x?.actionId === id && x.reason === REVISED_AFTER_RULING && x.closedBy == null);
          const rowsNew = [...new Map(fresh.map((a) => [actionPayloadOf(a), payloadRow(a, date)])).values()];
          if (open) l.corporateActionReceipts = l.corporateActionReceipts.map((x) => (x === open ? { ...open, rows: [...open.rows, ...rowsNew], lastRevisedOn: date } : x));
          else {
            const rec = { actionId: id, type: first.type, ticker: sym, effectiveDate: first.effectiveDate, applied: false, reason: REVISED_AFTER_RULING, rows: rowsNew, seenOn: date, ruling: null, ruled: null, closedBy: null, settledBy: 'feed', closedHolding: true };
            l.corporateActionReceipts = [...l.corporateActionReceipts, rec];
            out.recorded.push(rec);
          }
          out.alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_AMBIGUOUS ${ideaId} ${ledgerKind} ${sym} ${id} — a correction of an action already settled on a holding since closed: only the founder's ruling applies it (resolve_hold, conflict)`);
        }
        return;
      }
      if (!ruled) {
        // An OPEN record (rev 1): the id is ambiguous — it takes any payload it has not seen, and waits for the founder.
        const open = openRecordOf(cur(), id);
        if (open) {
          dropHeld(id);
          const have = new Set(recordedPayloadsOf(open).map(actionPayloadOf));
          const add = [...new Map(group.filter((a) => !a.founderRuling && !have.has(actionPayloadOf(a))).map((a) => [actionPayloadOf(a), payloadRow(a, date)])).values()];
          if (add.length > 0 && open.reason !== REVISED_AFTER_RULING) {
            const l = edit();
            l.corporateActionReceipts = l.corporateActionReceipts.map((x) => (x === open ? { ...open, rows: [...recordedPayloadsOf(open), ...add], lastRevisedOn: date } : x));
          }
          return;
        }
        // A CONFLICT (S-1 ①): listed two ways.
        if (keys.length > 1) {
          const l = edit();
          const rowsAll = [...new Map(group.filter((a) => !a.founderRuling).map((a) => [actionPayloadOf(a), payloadRow(a, null)])).values()];
          const rec = { actionId: id, type: first.type, ticker: sym, effectiveDate: first.effectiveDate, applied: false, reason: CONFLICTING_ACTION, entitled: true, rows: rowsAll, seenOn: date, kinds: ['conflict'], closedHolding: true };
          l.corporateActionReceipts = [...l.corporateActionReceipts, rec];
          out.recorded.push(rec);
          dropHeld(id);
          out.alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_AMBIGUOUS ${ideaId} ${ledgerKind} ${sym} ${id} — conflict on a holding since closed (${rowsAll.length} payloads): nothing is paid until the founder rules`);
          return;
        }
        // A POSSIBLE RE-DATE (S-1 ③): the same payload under another id within the window — against every payload the ledger
        // has seen (applied, declined, recorded, PROPOSED), the rows listed now and KEPT just outside the holding (L-3),
        // and the rows waiting on a doubt; and (L-5) any other share-basis id of the symbol on the same date.
        const key = keys[0];
        const outside = [...(rows[sym] || []).filter((a) => a && !a.founderRuling && upper(a.ticker) === sym && a.type === first.type && isDate(a.effectiveDate)
          && !inInterval(a)).map((a) => ({ actionId: actionIdOf(a), effectiveDate: a.effectiveDate, key: actionPayloadOf(a) })), ...outsidePool(first.type)];
        const pool = [...redatePool(cur(), sym, first.type), ...outside, ...(cur().closedHeldRows || []).filter((r) => r.type === first.type && upper(r.ticker) === sym).map((r) => ({ actionId: r.actionId, effectiveDate: r.effectiveDate, key: actionPayloadOf(r), held: r }))];
        let match = pool.find((p) => p.actionId !== id && p.key === key && withinSessions(p.effectiveDate, first.effectiveDate, REDATE_WINDOW_SESSIONS)) ?? null;
        let how = 'possible_redate';
        if (!match && SHARE_BASIS_TYPES.has(first.type)) {
          const sameDate = [...redatePool(cur(), sym, null), ...(cur().closedHeldRows || []).filter((r) => SHARE_BASIS_TYPES.has(r.type) && upper(r.ticker) === sym).map((r) => ({ actionId: r.actionId, effectiveDate: r.effectiveDate, held: r }))];
          match = sameDate.find((p) => p.actionId !== id && p.effectiveDate === first.effectiveDate) ?? null;
          how = 'same_date_share_basis';
        }
        if (match) {
          dropHeld(id);
          // (S-1 ③: a held row it may repeat is ambiguous too — recorded, and no longer replayed; L-1: so is an open proposal.)
          if (match.held) {
            const l0 = edit();
            l0.corporateActionReceipts = [...l0.corporateActionReceipts, { actionId: match.actionId, type: match.held.type, ticker: sym, effectiveDate: match.held.effectiveDate, ratio: match.held.ratio ?? null, amount: match.held.amount ?? null, cashPerShare: null, source: match.held.source ?? null, applied: false, reason: POSSIBLE_REDATE, redateOf: id, seenOn: date, rows: [payloadRow(match.held, match.held.heldOn ?? null)], kinds: [how], closedHolding: true }];
            dropHeld(match.actionId);
          } else if (match.proposal && openRecordOf(cur(), match.actionId) === null) {
            const l0 = edit();
            l0.corporateActionReceipts = [...l0.corporateActionReceipts, { actionId: match.actionId, type: 'cash_dividend', ticker: sym, effectiveDate: match.effectiveDate, ratio: null, amount: match.proposal.amountPerShare, cashPerShare: null, source: null, applied: false, reason: POSSIBLE_REDATE, redateOf: id, seenOn: date, rows: [payloadRow({ amount: match.proposal.amountPerShare }, match.proposal.proposedOn ?? null)], kinds: [how], closedHolding: true }];
          }
          const l = edit();
          const rec = { actionId: id, type: first.type, ticker: sym, effectiveDate: first.effectiveDate, ratio: first.ratio ?? null, amount: first.amount ?? null, cashPerShare: null, source: first.source ?? null, applied: false, reason: POSSIBLE_REDATE, redateOf: match.actionId, seenOn: date, rows: [payloadRow(first, null)], kinds: [how], closedHolding: true };
          l.corporateActionReceipts = [...l.corporateActionReceipts, rec];
          out.recorded.push(rec);
          out.alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_REDATE ${ideaId} ${ledgerKind} ${id} — ${how === 'possible_redate' ? `the same ${first.type} as ${match.actionId}, under a moved date` : `a second share-basis id of ${sym} on ${first.effectiveDate} beside ${match.actionId}`}, on a holding since closed: not proposed — the founder may apply it (resolve_hold, conflict)`);
          return;
        }
      }
      const action = ruled ?? first;
      // (Fix-round refuter R-5: what the founder's ruling would post waits while a sold holding's coverage doubt holds its
      // count — the ruling is not kept here; it is re-made once the doubt clears.)
      if (ruled && rulingDoubtOn(sym, action.effectiveDate)) return;
      if (doubtOn(sym, action.effectiveDate) || shareDoubtOn(sym, action.effectiveDate, id, SHARE_BASIS_TYPES.has(action.type))) {
        // Durable: the row waits on the closed holding (replayed at the first close without the doubt, revised if the feed
        // later lists it otherwise). A founder's action is re-supplied by its ruling: not kept here. (An open proposal of
        // it stands, its approval refused while the doubt does — L-2.)
        if (!action.founderRuling && !held && !proposal) {
          const l = edit();
          l.closedHeldRows = [...(l.closedHeldRows || []), { actionId: id, type: action.type, ticker: sym, effectiveDate: action.effectiveDate, ratio: action.ratio ?? null, amount: action.amount ?? null, source: action.source ?? null, heldOn: date, closedOn: c.through }];
        }
        return;
      }
      dropHeld(id);
      if (SHARE_BASIS_TYPES.has(action.type)) {
        // A HISTORY-ONLY share-basis receipt: the stock is gone, but the ex-date count of a dividend dated after it changes.
        const ratio = Number(action.ratio);
        if (!(ratio > 0) || !Number.isFinite(ratio)) return;
        const l = edit();
        const { end } = shareBasisChain(l, sym);
        const before = end ?? Number(c.shares);
        const receipt = {
          actionId: id, type: action.type, ticker: sym, effectiveDate: action.effectiveDate, ratio, amount: null, incomeUsd: 0,
          applied: true, appliedOn: date, source: action.source ?? null, historyOnly: true, closedOn: c.through,
          sharesBefore: before, sharesAfter: roundShares(before * ratio),
          note: `history only: ${action.type} ×${ratio} dated while the ledger held ${sym} (closed ${c.through}); no shares move — it enters the ex-date count of a dividend dated after it`,
          ...(action.founderRuling ? { founderRuling: action.founderRuling } : {}),
        };
        l.corporateActionReceipts = [...l.corporateActionReceipts, receipt];
        l.appliedActionIds = [...l.appliedActionIds, id];
        out.historyOnly.push(receipt);
        // L-6 (Astra T2E-05, Q-5): a split FIRST LISTED AFTER THE SALE, dated while the idea held the stock, leaves the shares
        // it SOLD different from the shares it was OWED at the sale — the sale stands, and a standing reason says so.
        if (ledgerKind === 'idea' && c.paper !== true) {
          const owed = countOnExDate(l, sym, c.through, { closed: c }).count;
          if (Number(owed) !== Number(c.shares)) {
            out.standingReasons.push({ kind: STANDING_REASON.SALE_COUNT_DIFFERS, symbol: sym, actionId: id, since: date, soldOn: c.through, sharesSold: Number(c.shares), sharesOwed: Number(owed), via: 'split_listed_after_sale' });
          }
        }
        return;
      }
      const amount = Number(action.amount);
      if (!(amount > 0) || !Number.isFinite(amount)) return;
      const counted = countOnExDate(cur(), sym, action.effectiveDate, { closed: c });
      if (!(counted.count > 0)) return;
      const owedCents = toCents(roundUsd(counted.count * amount));
      const receivedCents = postedAdjustments(cur()).filter((a) => a.actionId === id).reduce((n, a) => n + toCents(a.amountUsd || 0), 0);
      if (ruled) {
        // THE FOUNDER'S CONFLICT RULING settles a closed holding's ambiguous row: its authority posts the net, once (L-2).
        const posted = post({
          kind: ADJUSTMENT_KIND.LATE_ENTITLEMENT, actionId: id, ticker: sym, type: 'cash_dividend', effectiveDate: action.effectiveDate,
          corrects: null, correction: `ruled:${action.founderRuling?.requestKey ?? ''}:${amount}`,
          entitledShares: counted.count, derivation: { from: counted.from, also: counted.also, closedOn: c.through, openedAt: c.openedAt },
          amountPerShare: amount, amountCents: owedCents - receivedCents, payload: { amount }, ruling: action.founderRuling ?? null, trigger: ['listed_after_close', 'ruled'],
        });
        if (posted) {
          edit().appliedActionIds = [...cur().appliedActionIds, id];
          closeProposal(id, LATE_PROPOSAL_STATUS.SETTLED, 'ruled', { closedBy: action.founderRuling ?? null });
        }
        return;
      }
      // A LATE ENTITLEMENT (T2D-03), PROPOSED (L-1): owed on the ex-date count, less what was received for it.
      propose({
        kind: ADJUSTMENT_KIND.LATE_ENTITLEMENT, actionId: id, ticker: sym, effectiveDate: action.effectiveDate, amountPerShare: amount,
        entitledShares: counted.count, derivation: { from: counted.from, also: counted.also, closedOn: c.through, openedAt: c.openedAt },
        owedCents, receivedCents, trigger: ['listed_after_close'],
      });
    };
    for (const [id, group0] of ordered) handle(id, group0);
  }

  // ── 2. THE RECOMPUTE (T2D-04, T2D-05): each paid dividend something late has touched — PROPOSED (L-1) — and the founder's
  //       amount corrections, which a ruling authorizes: the net, owed now on the dated count less what was received (L-2).
  const corrections = new Map((ctx.corrections || []).map((x) => [x.actionId, x]));
  const countFor = (sym, exDate) => {
    const held = cur().holdings?.[sym] ?? null;
    return countOnExDate(cur(), sym, exDate, { held: held && !closed.has(sym) ? held : null, closed: closed.get(sym) ?? (held ? { shares: held.shares } : leftByActionOf(cur(), sym, exDate)) });
  };
  const paid = paidDividends(cur());
  for (const d of [...paid.values()].sort(byDatePhaseId)) {
    const sym = d.ticker;
    const { events } = shareBasisChain(cur(), sym);
    const late = events.filter((e) => e.index > d.index && e.effectiveDate <= d.effectiveDate).map((e) => e.actionId);
    const countCorrected = postedAdjustments(cur()).some((a) => a.kind === ADJUSTMENT_KIND.RULED_CORRECTION && SHARE_BASIS_TYPES.has(a.type) && upper(a.ticker) === sym && Number(a.seq) > d.index);
    const amountCorrection = corrections.get(d.actionId) ?? null;
    if (late.length === 0 && !countCorrected && !amountCorrection && !openProposalOf(d.actionId)) continue;
    if (doubtOn(sym, d.effectiveDate) || shareDoubtOn(sym, d.effectiveDate)) continue; // durable: re-examined at the next close
    const counted = countFor(sym, d.effectiveDate);
    if (!(counted.count > 0)) continue;
    if (amountCorrection) {
      if (proposeOnly || rulingDoubtOn(sym, d.effectiveDate)) continue; // (R-5: a ruled correction waits on the doubt too)
      // (b) the founder's correction this close — ruled_correction: the NET owed now (the ruled amount on the dated count)
      // less everything received for the id. It settles any open proposal of the id (T2E-03: $249.93 in all, posted once).
      const amount = Number(amountCorrection.amount);
      const target = toCents(roundUsd(counted.count * amount));
      const p = post({
        kind: ADJUSTMENT_KIND.RULED_CORRECTION, actionId: d.actionId, ticker: sym, type: 'cash_dividend', effectiveDate: d.effectiveDate,
        corrects: d.receipt ? { receipt: d.actionId, appliedOn: d.receipt.appliedOn ?? null } : { adjustment: d.actionId },
        correction: `amount:${amountCorrection.ruling?.requestKey ?? ''}:${amount}`,
        entitledShares: counted.count, derivation: { from: counted.from, also: counted.also },
        amountPerShare: amount, correctsAmount: d.amount, amountCents: target - d.cents, receivedBeforeUsd: fromCents(d.cents), entitledUsd: fromCents(target),
        payload: { amount }, ruling: amountCorrection.ruling ?? null, trigger: ['ruled_amount_correction', ...late],
      });
      if (p) closeProposal(d.actionId, LATE_PROPOSAL_STATUS.SETTLED, 'ruled_correction', { closedBy: amountCorrection.ruling ?? null });
      continue;
    }
    // (a) the count: the amount in force on the dated ex-date count, less what was received — late_basis, proposed.
    // (Review AR4-A-5: the derivation names every late event and count correction behind it.)
    const countFrom = [...late, ...postedAdjustments(cur()).filter((a) => a.kind === ADJUSTMENT_KIND.RULED_CORRECTION && SHARE_BASIS_TYPES.has(a.type) && upper(a.ticker) === sym && Number(a.seq) > d.index).map((a) => a.id)].sort();
    propose({
      kind: ADJUSTMENT_KIND.LATE_BASIS, actionId: d.actionId, ticker: sym, effectiveDate: d.effectiveDate, amountPerShare: d.amount,
      entitledShares: counted.count, derivation: { from: counted.from, also: counted.also, events: countFrom },
      owedCents: toCents(roundUsd(counted.count * d.amount)), receivedCents: d.cents, trigger: countCorrected && late.length === 0 ? ['ruled_count_correction'] : late,
    });
  }

  // ── 3. EVERY OPEN PROPOSAL: re-stated on what it is owed NOW, its refusals named (L-2), and the founder's decisions applied.
  const paidNow = paidDividends(cur());
  for (const p of openProposals(cur())) {
    const sym = upper(p.ticker);
    // (A dividend the founder declined, or ruled `none`, since: nothing is owed.)
    if ((cur().declinedActionIds || []).includes(p.actionId)) { closeProposal(p.actionId, LATE_PROPOSAL_STATUS.SETTLED, 'declined_by_ruling'); continue; }
    if (!(doubtOn(sym, p.effectiveDate) || shareDoubtOn(sym, p.effectiveDate))) {
      const counted = countFor(sym, p.effectiveDate);
      const d = paidNow.get(p.actionId) ?? null;
      const amount = d ? d.amount : Number(p.amountPerShare);
      const receivedCents = d ? d.cents : postedAdjustments(cur()).filter((a) => a.actionId === p.actionId).reduce((n, a) => n + toCents(a.amountUsd || 0), 0);
      if (counted.count > 0 && amount > 0) {
        propose({ kind: d ? ADJUSTMENT_KIND.LATE_BASIS : p.kind, actionId: p.actionId, ticker: sym, effectiveDate: p.effectiveDate, amountPerShare: amount,
          entitledShares: counted.count, derivation: { ...(p.derivation || {}), from: counted.from, also: counted.also }, owedCents: toCents(roundUsd(counted.count * amount)), receivedCents, trigger: p.trigger });
      }
    }
  }
  // (Second refuter P-1: A ROW KEPT OUTSIDE A SOLD HOLDING that pairs with an open `late_basis` — a paid dividend's id,
  // which can never be re-opened as an ambiguity — is RECORDED as a possible re-date of it, so the founder's conflict
  // ruling can answer the pairing: `none` settles it and the approval may post; until then the approval is refused (L-2 ②).
  // Kept only, it refused the approval for good, and the founder had nothing to rule.)
  for (const p of openProposals(cur())) {
    const sym = upper(p.ticker);
    if (p.kind !== ADJUSTMENT_KIND.LATE_BASIS || !closed.has(sym)) continue;
    const key = actionPayloadOf({ amount: p.amountPerShare });
    for (const x of cur().closedOutsideRows || []) {
      if (upper(x.ticker) !== sym || x.type !== 'cash_dividend' || x.actionId === p.actionId || actionPayloadOf(x) !== key) continue;
      if (!withinSessions(x.effectiveDate, p.effectiveDate, REDATE_WINDOW_SESSIONS) || settledNow().has(x.actionId) || openRecordOf(cur(), x.actionId) !== null) continue;
      const l = edit();
      const rec = { actionId: x.actionId, type: x.type, ticker: sym, effectiveDate: x.effectiveDate, ratio: x.ratio ?? null, amount: x.amount ?? null, cashPerShare: null, source: null, applied: false, reason: POSSIBLE_REDATE, redateOf: p.actionId, seenOn: date, rows: [payloadRow(x, x.seenOn ?? null)], kinds: ['possible_redate'], closedHolding: true, outsideHolding: true };
      l.corporateActionReceipts = [...l.corporateActionReceipts, rec];
      out.recorded.push(rec);
      out.alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_REDATE ${ideaId} ${ledgerKind} ${x.actionId} — the same cash_dividend as the paid ${p.actionId}, dated just outside the sold holding: ${p.id} waits — the founder rules it (resolve_hold, conflict)`);
    }
  }
  // (…and — found by I-7's L-2 ③ check on shape seed 2119990011 — a SHARE-BASIS row kept outside the sold holding that pairs
  // with a share-basis action applied within it: the count every proposal of the symbol stands on is in question (the
  // action may have happened after the sale). Recorded while a proposal of the symbol waits, so the founder can rule it.)
  for (const [sym, c] of closed) {
    if (!openProposals(cur()).some((p) => upper(p.ticker) === sym)) continue;
    const inside = (cur().corporateActionReceipts || []).filter((r) => r?.applied === true && SHARE_BASIS_TYPES.has(r.type) && upper(r.ticker) === sym
      && isDate(r.effectiveDate) && r.effectiveDate <= c.through && (c.openedAt === null || r.effectiveDate > c.openedAt));
    for (const x of cur().closedOutsideRows || []) {
      if (upper(x.ticker) !== sym || !SHARE_BASIS_TYPES.has(x.type) || settledNow().has(x.actionId) || openRecordOf(cur(), x.actionId) !== null) continue;
      // (A pairing the founder already answered is not asked again: the action within the holding applied by the founder's
      // ruling made after the outside row was first seen — the soak's 2120005408: ruled 1.5 for the split of 11-18 after the
      // vendor's 1.5 of 11-20 showed, the dividend owed on that count waited for good.)
      const answered = (y) => Boolean(y.founderRuling) && isDate(y.appliedOn) && isDate(x.seenOn) && y.appliedOn > x.seenOn;
      const r = inside.find((y) => y.actionId !== x.actionId && y.type === x.type && actionPayloadOf(y) === actionPayloadOf(x) && withinSessions(y.effectiveDate, x.effectiveDate, REDATE_WINDOW_SESSIONS) && !answered(y)) ?? null;
      if (!r) continue;
      const l = edit();
      const rec = { actionId: x.actionId, type: x.type, ticker: sym, effectiveDate: x.effectiveDate, ratio: x.ratio ?? null, amount: x.amount ?? null, cashPerShare: null, source: null, applied: false, reason: POSSIBLE_REDATE, redateOf: r.actionId, seenOn: date, rows: [payloadRow(x, x.seenOn ?? null)], kinds: ['possible_redate'], closedHolding: true, outsideHolding: true };
      l.corporateActionReceipts = [...l.corporateActionReceipts, rec];
      out.recorded.push(rec);
      out.alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_REDATE ${ideaId} ${ledgerKind} ${x.actionId} — the same ${x.type} as ${r.actionId}, applied within the sold holding, dated just outside it: the proposals of ${sym} wait — the founder rules it (resolve_hold, conflict)`);
    }
  }
  const blockersNow = (p) => {
    const sym = upper(p.ticker);
    const c = closed.get(sym) ?? null;
    const out2 = [];
    // L-2 ①: the id is unresolved on this ledger (an open conflict, re-date or revision of it, or a row of it waiting).
    if (openRecordOf(cur(), p.actionId) !== null || (cur().closedHeldRows || []).some((r) => r.actionId === p.actionId)) out2.push(`${LATE_BLOCKER.ID_UNRESOLVED}:${p.actionId}`);
    // L-2 ②: another candidate of the symbol pairs with it under the re-date rule — an open possible re-date of it, and
    // (fix-round refuter R-1, R-3) any open candidate of the same type and payload within the window, wherever it waits.
    for (const r of cur().corporateActionReceipts || []) if (r?.reason === POSSIBLE_REDATE && r.redateOf === p.actionId && upper(r.ticker) === sym && openRecordOf(cur(), r.actionId) !== null) out2.push(`${LATE_BLOCKER.PAIRS}:${r.actionId}`);
    for (const id of pairingCandidatesOf(cur(), p)) out2.push(`${LATE_BLOCKER.PAIRS}:${id}`);
    // L-2 ③: a share-basis id dated within the holding is unresolved (this ledger's own, and the caller's hold set).
    const end = c ? c.through : date;
    if (shareDoubtOn(sym, end) || (c !== null && (cur().closedHeldRows || []).some((r) => SHARE_BASIS_TYPES.has(r.type) && upper(r.ticker) === sym))) out2.push(`${LATE_BLOCKER.SHARE_BASIS}:${sym}`);
    // (…an open share-basis re-date whose OTHER id is dated within the sold holding — wherever the moved row is dated.)
    if (c !== null) {
      for (const r of cur().corporateActionReceipts || []) {
        if (r?.reason !== POSSIBLE_REDATE || !SHARE_BASIS_TYPES.has(r.type) || upper(r.ticker) !== sym || openRecordOf(cur(), r.actionId) === null) continue;
        const partner = (cur().corporateActionReceipts || []).find((y) => y?.actionId === r.redateOf && isDate(y.effectiveDate)) ?? null;
        if (partner && partner.effectiveDate <= c.through && (c.openedAt === null || partner.effectiveDate > c.openedAt)) out2.push(`${LATE_BLOCKER.SHARE_BASIS}:${r.actionId}`);
      }
    }
    // L-2 ④: a date in the holding interval is uncovered — and whatever else the caller refuses on (its hold set).
    out2.push(...blockersOf(sym, p.effectiveDate, { end, openedAt: c?.openedAt ?? null }));
    return [...new Set(out2)].sort();
  };
  for (const p of openProposals(cur())) {
    const blockers = blockersNow(p);
    if (stableStringify(blockers) !== stableStringify(p.blockers || [])) {
      const l = edit();
      l.lateProposals = l.lateProposals.map((x) => (x.id === p.id ? { ...x, blockers } : x));
    }
  }
  // THE FOUNDER'S DECISIONS (resolve_hold, late_adjustment): a decline closes the proposal; an approval posts its net —
  // owed now less received, never a chained delta — only while nothing refuses it (L-2). Refused, the approval waits.
  for (const a of ctx.approvals || []) {
    const p = (cur().lateProposals || []).find((x) => x.id === a.proposalId) ?? null;
    if (!p || p.status !== LATE_PROPOSAL_STATUS.OPEN) continue;
    if (a.decision === 'decline') {
      closeProposal(p.actionId, LATE_PROPOSAL_STATUS.DECLINED, 'founder_declined', { closedBy: a.ruling ?? null });
      out.alerts.push(`PRACTICE_FIELD_LATE_DECLINED ${ideaId} ${ledgerKind} ${p.actionId} ${p.id} — the founder declined it; nothing posts`);
      continue;
    }
    if (proposeOnly) continue;
    if ((p.blockers || []).length > 0) {
      out.alerts.push(`PRACTICE_FIELD_LATE_APPROVAL_WAITING ${ideaId} ${ledgerKind} ${p.actionId} ${p.id} — approved, but not posted while ${p.blockers.join(', ')} stands`);
      continue;
    }
    const net = toCents(p.netUsd);
    if (net === 0) { closeProposal(p.actionId, LATE_PROPOSAL_STATUS.SETTLED, 'nothing_owed', { closedBy: a.ruling ?? null }); continue; }
    const d = paidNow.get(p.actionId) ?? null;
    const posted = post({
      kind: p.kind, actionId: p.actionId, ticker: upper(p.ticker), type: 'cash_dividend', effectiveDate: p.effectiveDate,
      corrects: d?.receipt ? { receipt: p.actionId, appliedOn: d.receipt.appliedOn ?? null } : (d ? { adjustment: p.actionId } : null),
      correction: `approved:${p.id}:${a.ruling?.requestKey ?? ''}`,
      entitledShares: p.entitledShares, derivation: p.derivation ?? null, amountPerShare: p.amountPerShare, amountCents: net,
      receivedBeforeUsd: p.receivedUsd, entitledUsd: p.owedUsd, payload: { amount: p.amountPerShare }, ruling: a.ruling ?? null, proposal: p.id, trigger: p.trigger ?? [],
    });
    if (!posted) {
      const l = edit();
      l.lateProposals = l.lateProposals.map((x) => (x.id === p.id ? { ...x, blockers: [...new Set([...(x.blockers || []), `${LATE_BLOCKER.EXCEEDS_CASH}:${p.actionId}`])].sort() } : x));
      continue;
    }
    closeProposal(p.actionId, LATE_PROPOSAL_STATUS.POSTED, 'founder_approved', { closedBy: a.ruling ?? null, adjustmentId: posted.id, postedUsd: posted.amountUsd });
    if (p.kind === ADJUSTMENT_KIND.LATE_ENTITLEMENT && !settledNow().has(p.actionId)) edit().appliedActionIds = [...cur().appliedActionIds, p.actionId];
  }
  out.ledger = next ?? ledger;
  return out;
}

/**
 * THE FOUNDER'S SHARE-BASIS CORRECTION (T2D-05) on one ledger: the ratio the ruling chose in place of the one the feed
 * settled, the holding's count replayed through the chain with it, its average cost, its carried mark (×old/new, as the
 * engine divided it by the old ratio) and any screen reference with it. One ruled_correction record (no cash: the
 * dividends paid since are recomputed by planLedgerAdjustments). Returns null when the ledger never settled the id.
 * @returns {{ ledger: object, record: object, sharesBefore: number, sharesAfter: number, factor: number } | null}
 */
export function correctShareBasisOn(ledger, { ideaId = null, ledgerKind, actionId, ratio, from, ruling, date }) {
  const receipt = (ledger?.corporateActionReceipts || []).find((r) => r?.actionId === actionId && r.applied === true && SHARE_BASIS_TYPES.has(r.type));
  if (!receipt) return null;
  const sym = upper(receipt.ticker);
  const next = cloneLedger(ledger);
  next.adjustments = [...(ledger.adjustments || [])];
  const oldRatio = Number(from?.ratio ?? receipt.ratio);
  const factor = Number(ratio) / oldRatio;
  const before = shareBasisChain(next, sym).end;
  const id = adjustmentIdOf({ ideaId, ledger: ledgerKind, actionId, kind: ADJUSTMENT_KIND.RULED_CORRECTION, correction: `ratio:${ruling?.requestKey ?? ''}:${ratio}` });
  const record = {
    id, kind: ADJUSTMENT_KIND.RULED_CORRECTION, actionId, ticker: sym, type: receipt.type, effectiveDate: receipt.effectiveDate, ledger: ledgerKind,
    corrects: { receipt: actionId, appliedOn: receipt.appliedOn ?? null }, correction: `ratio:${ratio}`,
    ratio: Number(ratio), correctsRatio: oldRatio, payload: { ratio: Number(ratio) }, ruling: ruling ?? null,
    amountUsd: 0, postedOn: date, postedTo: ADJUSTMENT_POSTED_TO.LEDGER, seq: (next.corporateActionReceipts || []).length, trigger: ['ruled_ratio_correction'],
  };
  next.adjustments.push(record);
  const after = shareBasisChain(next, sym).end;
  record.sharesBefore = before;
  record.sharesAfter = after;
  const h = next.holdings?.[sym];
  if (h && Number.isFinite(after) && after > 0) {
    const lastMark = Number(h.lastMark);
    next.holdings[sym] = {
      ...h, shares: after, avgCost: (Number(h.costBasisTotal) || 0) / after,
      lastMark: Number.isFinite(lastMark) ? lastMark / factor : h.lastMark,
      ...(h.screenReference && Number(h.screenReference.price) > 0 ? { screenReference: { ...h.screenReference, price: Number(h.screenReference.price) / factor } } : {}),
    };
  }
  return { ledger: next, record, sharesBefore: before, sharesAfter: after, factor, symbol: sym };
}

/**
 * THE RESULT'S VIEW (the build prompt, §1): an idea that already carries a result keeps it — never rewritten — and its
 * readers show beside it the adjustments posted AFTER its endpoint for actions dated ON OR BEFORE it (what the endpoint
 * would have counted), with `wouldChangeLabel` computed from the figures: the result's gap plus the idea's adjustments
 * less its comparison's, against its band. An unmeasurable result stays unmeasurable (`wouldChangeLabel: false`). Pure.
 * @returns {object|null}  null when there is no such adjustment
 */
export function resultAdjustmentView(idea) {
  const result = idea?.result;
  const endpoint = result?.endpointSession;
  if (!result || !isDate(endpoint)) return null;
  const counted = (l) => postedAdjustments(l).filter((a) => isDate(a.postedOn) && a.postedOn > endpoint && isDate(a.effectiveDate) && a.effectiveDate <= endpoint);
  const own = counted(idea.ledger);
  const cmp = counted(idea.comparisonLedger);
  const spy = counted(idea.spyLedger);
  if (own.length + cmp.length + spy.length === 0) return null;
  const sum = (xs) => xs.reduce((n, a) => n + toCents(a.amountUsd || 0), 0);
  const ideaCents = sum(own);
  const comparisonCents = sum(cmp);
  const spyCents = sum(spy);
  const gapCents = toCents(result.economic?.gapUsd ?? 0) + ideaCents - comparisonCents;
  const bandCents = toCents(result.economic?.bandUsd ?? 0);
  const label = result.economicResult;
  let labelIfIncluded = label;
  if (label !== 'unmeasurable') labelIfIncluded = gapCents > bandCents ? 'ahead' : (gapCents < -bandCents ? 'behind' : 'within_band');
  return {
    adjustments: [...own, ...cmp, ...spy].map((a) => ({ id: a.id, ledger: a.ledger, kind: a.kind, actionId: a.actionId, effectiveDate: a.effectiveDate, amountUsd: a.amountUsd, postedOn: a.postedOn, postedTo: a.postedTo })),
    ideaUsd: fromCents(ideaCents), comparisonUsd: fromCents(comparisonCents), spyUsd: fromCents(spyCents),
    gapUsdIfIncluded: fromCents(gapCents), economicResult: label, economicResultIfIncluded: labelIfIncluded,
    wouldChangeLabel: labelIfIncluded !== label,
  };
}
