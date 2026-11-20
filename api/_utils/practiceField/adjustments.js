// api/_utils/practiceField/adjustments.js
//
// Practice Field T1a-2b-4 — LATE AND CORRECTED DATA (Astra T2D-03, T2D-04, T2D-05). Money the data now shows was owed
// differently from what a ledger received, corrected by ONE NEW LINKED RECORD — never a rewrite of a receipt, a holding's
// history or a result:
//
//   late_entitlement  a cash dividend first listed AFTER the ledger stopped holding the stock (the idea's line sale, or a
//                     resulted idea's last close), dated while it held it: paid once, on the ex-date count (T2D-03);
//   late_basis        a share-basis action applied AFTER a cash dividend it predates (listed late): that dividend is
//                     recomputed on its ex-date count, and the difference posted (T2D-04; C-16's derivation, now for a
//                     payment already made). Both arrival orders end with the same money;
//   ruled_correction  the founder's ruling (resolve_hold, `conflict`) chose a vendor CORRECTION of an id already settled:
//                     a dividend's amount, or a split's ratio — the count corrected, and every dividend paid since
//                     recomputed through the late_basis path (T2D-05).
//
// THE PRINCIPLE (the founder's, one line): a correction the data fully determines is applied by code; a correction where
// the vendor contradicts itself waits for the founder (Amendment F rev 1, S-2, S-3). So a late entitlement is automatic
// only for an id that has never been ambiguous on that ledger — a conflict, a revision or a possible re-date records,
// alerts and waits, as every ambiguous id does — and a corrected payload under a settled id is never applied by code.
//
// RECEIVED VERSUS ENTITLED. Each adjustment posts the difference between what the ledger is entitled to now — the ex-date
// count (countOnExDate) times the amount in force (the receipt's, or the founder's correction) — and what it has received
// for that dividend: its receipt plus every adjustment posted for it. Nothing accumulates: a second identical close
// computes a difference of nought and posts nothing. And it fires only when something LATE exists for that dividend — a
// share-basis action applied after it with a date on or before its ex-date, a founder's correction, or a dividend first
// listed after a sale — so on complete, on-time data this module posts nothing, by construction.
//
// THE HOLDING HISTORY (the build prompt asks what was added): NOTHING NEW IS STORED for it. A ledger's history of a symbol
// is derived from what it already keeps: its holding (`shares`, `openedAt`) while held; the idea's entry session (the one
// basket entry — an idea never buys again) and its sale receipt (`shares`, `sessionDate`) once sold; and the share-basis
// receipts (`sharesBefore`, `sharesAfter`, in the order applied). The one new receipt kind is a HISTORY-ONLY share-basis
// receipt (`historyOnly: true`): a split first listed after the ledger sold the stock, dated while it held it — it moves
// no shares (there are none) but belongs in the ex-date count of a dividend dated after it.
//
// A DOUBT HOLDS IT. Every adjustment depends on a share count, so none posts while the symbol is in doubt on the idea —
// a coverage gap (the session's data, its parse report included), an open ambiguity, a held or refused action, a
// suspicion: the caller says (`doubtOn`). The condition that fired it is durable, so it posts at the first close without
// the doubt.
//
// A DEBIT LARGER THAN THE CASH it would come from is not posted: it is recorded `held: true`, `reason:
// 'adjustment_exceeds_cash'`, and alerted at every close it stands, for the founder.
//
// Pure. The close (close.js) posts the cash on the book's mirror, writes each adjustment's evidence document
// (`mandates/{bookId}/ideas/{ideaId}/evidence/adjustment_{id}`, create-once, content-hashed) and the result's view.

import { roundUsd, roundShares } from '../mandateRounding.js';
import { canonicalContentHash } from '../canonicalHash.js';
import { toCents, fromCents, addUsd } from './money.js';
import {
  cloneLedger, actionIdOf, SHARE_BASIS_TYPES, withinSessions, REDATE_WINDOW_SESSIONS, actionPayloadOf, recordedPayloadsOf,
  CONFLICTING_ACTION, POSSIBLE_REDATE, REVISED_AFTER_RULING, NOT_ENTITLED,
} from './ledger.js';

export const ADJUSTMENT_KIND = Object.freeze({ LATE_ENTITLEMENT: 'late_entitlement', LATE_BASIS: 'late_basis', RULED_CORRECTION: 'ruled_correction' });
/** Where an adjustment's cash went: the ledger's own cash (an open idea), the book's treasury (a resulted idea's own
 *  ledger), or nowhere (a resulted idea's paper ledger: recorded beside its result). */
export const ADJUSTMENT_POSTED_TO = Object.freeze({ LEDGER: 'ledger', TREASURY: 'treasury', PAPER_AFTER_RESULT: 'paper_after_result' });
export const ADJUSTMENT_EXCEEDS_CASH = 'adjustment_exceeds_cash';
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
 * THE SHARE-BASIS CHAIN of a ledger's symbol, in the order applied: each event's ratio — the founder's correction of it,
 * if one is in force (a share-basis ruled_correction) — and the count before and after it, REPLAYED from the first
 * receipt's `sharesBefore`, rounding at each step as the applier rounds (so, with no correction, the replay reproduces
 * the recorded counts exactly). Pure.
 * @returns {{ events: Array<{ actionId, effectiveDate, ratio, before, after, index, historyOnly }>, end: number|null }}
 */
export function shareBasisChain(ledger, symbol) {
  const sym = upper(symbol);
  const corrected = new Map();
  for (const a of postedAdjustments(ledger)) if (a.kind === ADJUSTMENT_KIND.RULED_CORRECTION && SHARE_BASIS_TYPES.has(a.type) && upper(a.ticker) === sym && Number(a.ratio) > 0) corrected.set(a.actionId, Number(a.ratio));
  const events = [];
  let count = null;
  for (const [index, r] of (ledger?.corporateActionReceipts || []).entries()) {
    if (r?.applied !== true || !SHARE_BASIS_TYPES.has(r.type) || upper(r.ticker) !== sym) continue;
    if (count === null) count = Number(r.sharesBefore);
    const ratio = corrected.get(r.actionId) ?? Number(r.ratio);
    const before = count;
    const after = roundShares(before * ratio);
    count = after;
    events.push({ actionId: r.actionId, effectiveDate: r.effectiveDate, ratio, before, after, index, historyOnly: r.historyOnly === true });
  }
  return { events, end: count };
}

/**
 * THE COUNT A LEDGER HELD ON AN EX-DATE (C-16's derivation): the count before the first event, in the order applied,
 * dated after the ex-date; then each event applied after that one but dated on or before the ex-date (listed late), in
 * the order applied. With no event dated after it, the count now — the holding's, or (a closed holding) the chain's end
 * or its count when it closed. Pure.
 * @param {{ held: object|null, closed: { shares: number }|null }} at  the holding now, or the closed holding
 * @returns {{ count: number, from: string, also: string[] }}
 */
export function countOnExDate(ledger, symbol, exDate, { held = null, closed = null } = {}) {
  const { events, end } = shareBasisChain(ledger, symbol);
  const k = events.findIndex((e) => e.effectiveDate > exDate);
  if (k < 0) {
    if (held) return { count: Number(held.shares), from: 'holding', also: [] };
    return { count: events.length > 0 ? end : Number(closed?.shares), from: events.length > 0 ? 'chain' : 'closed', also: [] };
  }
  let count = events[k].before;
  const also = [];
  for (const e of events.slice(k + 1)) {
    if (e.effectiveDate > exDate) continue;
    count = roundShares(count * e.ratio);
    also.push(e.actionId);
  }
  return { count, from: events[k].actionId, also };
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
      out.set(a.actionId, { actionId: a.actionId, ticker: upper(a.ticker), effectiveDate: a.effectiveDate, amount: Number(a.amountPerShare), cents: 0, index: Number(a.seq), receipt: null });
    }
    const d = out.get(a.actionId);
    if (!d) continue;
    d.cents += toCents(a.amountUsd || 0);
    if (a.kind === ADJUSTMENT_KIND.RULED_CORRECTION && Number(a.amountPerShare) > 0) d.amount = Number(a.amountPerShare);
  }
  return out;
}

/** The payloads a ledger has seen for `symbol` and `type`, for the re-date screen of a closed holding's row: applied
 *  receipts, not-entitled declines, every recorded payload of its ambiguity records, its late entitlements. */
function redatePool(ledger, symbol, type) {
  const pool = [];
  for (const r of ledger?.corporateActionReceipts || []) {
    if (r?.type !== type || upper(r.ticker) !== symbol) continue;
    if (r.applied === true || r.reason === NOT_ENTITLED) pool.push({ actionId: r.actionId, effectiveDate: r.effectiveDate, key: actionPayloadOf(r) });
    if (r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE || r.reason === REVISED_AFTER_RULING) {
      for (const p of recordedPayloadsOf(r)) pool.push({ actionId: r.actionId, effectiveDate: r.effectiveDate, key: actionPayloadOf(p) });
    }
  }
  for (const a of postedAdjustments(ledger)) {
    if (a.kind === ADJUSTMENT_KIND.LATE_ENTITLEMENT && a.type === type && upper(a.ticker) === symbol) pool.push({ actionId: a.actionId, effectiveDate: a.effectiveDate, key: actionPayloadOf({ amount: a.amountPerShare }) });
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

/**
 * PLAN ONE LEDGER'S ADJUSTMENTS at one close (see the header). Pure.
 *
 * @param {object} ledger
 * @param {object} ctx
 *   ideaId, ledgerKind ('idea' | 'comparison' | 'spy'), date (the session), rows (`{ SYM: [rows] }` this ledger was
 *   handed, the founder's actions among them), ruledIds (Set: ids a pending conflict ruling supplies on this ledger),
 *   closed (closedHoldingsOf), doubtOn(sym, exDate) → boolean, postedTo (ADJUSTMENT_POSTED_TO), availableCents (what a
 *   debit may come from), corrections (the founder's amount corrections applied at this close: [{ actionId, amount, from,
 *   ruling }]), seqBase (a stable sequence for this close)
 * @returns {{ ledger: object, posted: Array<object>, held: Array<object>, recorded: Array<object>, historyOnly: Array<object>, alerts: string[] }}
 */
export function planLedgerAdjustments(ledger, ctx) {
  const { ideaId = null, ledgerKind, date, rows = {}, ruledIds = null, closed = new Map(), doubtOn = () => false } = ctx;
  const postedTo = ctx.postedTo ?? ADJUSTMENT_POSTED_TO.LEDGER;
  let available = Number.isFinite(ctx.availableCents) ? ctx.availableCents : toCents(ledger?.cash || 0);
  const out = { ledger, posted: [], held: [], recorded: [], historyOnly: [], alerts: [] };
  if (!ledger) return out;
  let next = null;
  const edit = () => { if (next === null) { next = cloneLedger(ledger); next.adjustments = [...(ledger.adjustments || [])]; } return next; };
  const cur = () => next ?? ledger;
  const settledNow = () => new Set([...(cur().appliedActionIds || []), ...(cur().declinedActionIds || [])]);

  /** Post (or hold) one adjustment of `cents`. */
  const post = (entry) => {
    const l = edit();
    const cents = entry.amountCents;
    const id = adjustmentIdOf({ ideaId, ledger: ledgerKind, actionId: entry.actionId, kind: entry.kind, correction: entry.correction });
    const base = { id, ...entry, ledger: ledgerKind, postedOn: date, postedTo, amountUsd: fromCents(cents), seq: (l.corporateActionReceipts || []).length };
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
    if (postedTo === ADJUSTMENT_POSTED_TO.LEDGER) {
      l.cash = addUsd(l.cash, base.amountUsd);
      l.dividendsUsd = addUsd(l.dividendsUsd, base.amountUsd);
    }
    available += cents;
    out.posted.push(base);
    return base;
  };

  // ── 1. CLOSED HOLDINGS (T2D-03; T2D-04 after a sale or a result): rows first listed after the ledger stopped holding the
  //       stock, dated while it held it.
  for (const [sym, c] of closed) {
    const listed = (rows[sym] || []).filter((a) => a && upper(a.ticker) === sym && (a.type === 'cash_dividend' || SHARE_BASIS_TYPES.has(a.type))
      && isDate(a.effectiveDate) && a.effectiveDate <= date && a.effectiveDate <= c.through && (c.openedAt === null || a.effectiveDate > c.openedAt));
    const byId = new Map();
    for (const a of listed) {
      const id = typeof a.actionId === 'string' && a.founderRuling ? a.actionId : actionIdOf(a);
      byId.set(id, [...(byId.get(id) || []), { ...a, actionId: id }]);
    }
    for (const [id, group] of [...byId].sort(([, a], [, b]) => byDatePhaseId(a[0], b[0]))) {
      const first = group[0];
      const ruled = group.find((a) => a.founderRuling?.kind === 'conflict' && ruledIds?.has(id)) ?? null;
      const keys = [...new Set(group.filter((a) => !a.founderRuling).map(actionPayloadOf))];
      if (settledNow().has(id)) {
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
        for (const a of postedAdjustments(cur())) if (a.actionId === id && a.kind === ADJUSTMENT_KIND.RULED_CORRECTION) { for (const p of a.ruling?.seen || []) seen.add(actionPayloadOf(p)); seen.add(actionPayloadOf(a.payload || {})); }
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
        continue;
      }
      if (!ruled) {
        // An OPEN record (rev 1): the id is ambiguous — it takes any payload it has not seen, and waits for the founder.
        const open = openRecordOf(cur(), id);
        if (open) {
          const have = new Set(recordedPayloadsOf(open).map(actionPayloadOf));
          const add = [...new Map(group.filter((a) => !a.founderRuling && !have.has(actionPayloadOf(a))).map((a) => [actionPayloadOf(a), payloadRow(a, date)])).values()];
          if (add.length > 0 && open.reason !== REVISED_AFTER_RULING) {
            const l = edit();
            l.corporateActionReceipts = l.corporateActionReceipts.map((x) => (x === open ? { ...open, rows: [...recordedPayloadsOf(open), ...add], lastRevisedOn: date } : x));
          }
          continue;
        }
        // A CONFLICT (S-1 ①): listed two ways.
        if (keys.length > 1) {
          const l = edit();
          const rowsAll = [...new Map(group.filter((a) => !a.founderRuling).map((a) => [actionPayloadOf(a), payloadRow(a, null)])).values()];
          const rec = { actionId: id, type: first.type, ticker: sym, effectiveDate: first.effectiveDate, applied: false, reason: CONFLICTING_ACTION, entitled: true, rows: rowsAll, seenOn: date, kinds: ['conflict'], closedHolding: true };
          l.corporateActionReceipts = [...l.corporateActionReceipts, rec];
          out.recorded.push(rec);
          out.alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_AMBIGUOUS ${ideaId} ${ledgerKind} ${sym} ${id} — conflict on a holding since closed (${rowsAll.length} payloads): nothing is paid until the founder rules`);
          continue;
        }
        // A POSSIBLE RE-DATE (S-1 ③): the same payload under another id within the window.
        const key = keys[0];
        const match = redatePool(cur(), sym, first.type).find((p) => p.actionId !== id && p.key === key && withinSessions(p.effectiveDate, first.effectiveDate, REDATE_WINDOW_SESSIONS));
        if (match) {
          const l = edit();
          const rec = { actionId: id, type: first.type, ticker: sym, effectiveDate: first.effectiveDate, ratio: first.ratio ?? null, amount: first.amount ?? null, cashPerShare: null, source: first.source ?? null, applied: false, reason: POSSIBLE_REDATE, redateOf: match.actionId, seenOn: date, rows: [payloadRow(first, null)], kinds: ['possible_redate'], closedHolding: true };
          l.corporateActionReceipts = [...l.corporateActionReceipts, rec];
          out.recorded.push(rec);
          out.alerts.push(`PRACTICE_FIELD_CORPORATE_ACTION_REDATE ${ideaId} ${ledgerKind} ${id} — the same ${first.type} as ${match.actionId}, under a moved date, on a holding since closed: not paid — the founder may apply it (resolve_hold, conflict)`);
          continue;
        }
      }
      const action = ruled ?? first;
      if (doubtOn(sym, action.effectiveDate)) continue; // durable: re-examined at the next close
      if (SHARE_BASIS_TYPES.has(action.type)) {
        // A HISTORY-ONLY share-basis receipt: the stock is gone, but the ex-date count of a dividend dated after it changes.
        const ratio = Number(action.ratio);
        if (!(ratio > 0) || !Number.isFinite(ratio)) continue;
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
        continue;
      }
      // A LATE ENTITLEMENT (T2D-03): once, on the ex-date count.
      const amount = Number(action.amount);
      if (!(amount > 0) || !Number.isFinite(amount)) continue;
      const counted = countOnExDate(cur(), sym, action.effectiveDate, { closed: c });
      if (!(counted.count > 0)) continue;
      const cents = toCents(roundUsd(counted.count * amount));
      const posted = post({
        kind: ADJUSTMENT_KIND.LATE_ENTITLEMENT, actionId: id, ticker: sym, type: 'cash_dividend', effectiveDate: action.effectiveDate,
        corrects: null, correction: `entitlement:${amount}`,
        entitledShares: counted.count, derivation: { from: counted.from, also: counted.also, closedOn: c.through, openedAt: c.openedAt },
        amountPerShare: amount, amountCents: cents, payload: { amount }, ruling: action.founderRuling ?? null, trigger: ['listed_after_close'],
      });
      if (posted) edit().appliedActionIds = [...cur().appliedActionIds, id];
    }
  }

  // ── 2. THE RECOMPUTE (T2D-04, T2D-05): each paid dividend something late has touched.
  const corrections = new Map((ctx.corrections || []).map((x) => [x.actionId, x]));
  const paid = paidDividends(cur());
  for (const d of [...paid.values()].sort(byDatePhaseId)) {
    const sym = d.ticker;
    const { events } = shareBasisChain(cur(), sym);
    const late = events.filter((e) => e.index > d.index && e.effectiveDate <= d.effectiveDate).map((e) => e.actionId);
    const countCorrected = postedAdjustments(cur()).some((a) => a.kind === ADJUSTMENT_KIND.RULED_CORRECTION && SHARE_BASIS_TYPES.has(a.type) && upper(a.ticker) === sym && Number(a.seq) > d.index);
    const amountCorrection = corrections.get(d.actionId) ?? null;
    if (late.length === 0 && !countCorrected && !amountCorrection) continue;
    if (doubtOn(sym, d.effectiveDate)) continue; // durable: re-examined at the next close
    const held = cur().holdings?.[sym] ?? null;
    const counted = countOnExDate(cur(), sym, d.effectiveDate, { held: held && !closed.has(sym) ? held : null, closed: closed.get(sym) ?? (held ? { shares: held.shares } : null) });
    if (!(counted.count > 0)) continue;
    // (a) the count: the amount in force, on the ex-date count — late_basis.
    const basisCents = toCents(roundUsd(counted.count * d.amount));
    let received = d.cents;
    if (basisCents !== received) {
      const p = post({
        kind: ADJUSTMENT_KIND.LATE_BASIS, actionId: d.actionId, ticker: sym, type: 'cash_dividend', effectiveDate: d.effectiveDate,
        corrects: d.receipt ? { receipt: d.actionId, appliedOn: d.receipt.appliedOn ?? null } : { adjustment: d.actionId },
        correction: `basis:${counted.count}:${d.amount}`,
        entitledShares: counted.count, derivation: { from: counted.from, also: counted.also },
        amountPerShare: d.amount, amountCents: basisCents - received, receivedBeforeUsd: fromCents(received), entitledUsd: fromCents(basisCents),
        ruling: null, trigger: countCorrected && late.length === 0 ? ['ruled_count_correction'] : late,
      });
      if (p) received = basisCents;
    }
    // (b) the amount: the founder's correction this close — ruled_correction.
    if (amountCorrection) {
      const amount = Number(amountCorrection.amount);
      const target = toCents(roundUsd(counted.count * amount));
      post({
        kind: ADJUSTMENT_KIND.RULED_CORRECTION, actionId: d.actionId, ticker: sym, type: 'cash_dividend', effectiveDate: d.effectiveDate,
        corrects: d.receipt ? { receipt: d.actionId, appliedOn: d.receipt.appliedOn ?? null } : { adjustment: d.actionId },
        correction: `amount:${amountCorrection.ruling?.requestKey ?? ''}:${amount}`,
        entitledShares: counted.count, derivation: { from: counted.from, also: counted.also },
        amountPerShare: amount, correctsAmount: d.amount, amountCents: target - received, receivedBeforeUsd: fromCents(received), entitledUsd: fromCents(target),
        payload: { amount }, ruling: amountCorrection.ruling ?? null, trigger: ['ruled_amount_correction'],
      });
    }
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
