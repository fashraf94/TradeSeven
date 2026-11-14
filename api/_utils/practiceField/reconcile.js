// api/_utils/practiceField/reconcile.js
//
// Practice Field T1a-1, T1a-2a — THE RECONCILIATION (shared contract V2 §14 case 1, B-RECON; direction note ruling 4,
// B-OWNED; build prompt §7 step 4; Astra T1A-C01). After EVERY mutation — creation, admission, entry, release, a
// corporate action, a close, a line exit, a settlement sale, the return of settled cash — the caller hands the book
// as it will be written and every idea that still holds reserved cash or shares, and this asserts, to the cent and
// to the millionth of a share:
//
//   1. CASH      the treasury's unreserved cash + Σ each idea's cash  =  the book's portfolio cash;
//   2. HOLDINGS  every idea holding is a book position with the same shares and the same cost basis, and every
//                book position is exactly one idea's holding. Together with 1 this is the contract's sentence:
//                treasury + Σ ideas' (cash + holdings at cost basis) = the portfolio's cash + positions at cost
//                basis;
//   3. OWNED     every book position carries the `ideaId` of an idea in the set, and that idea's ledger holds it;
//                no ticker is held by two ideas (B-SAME's standing form);
//   4. CONSERVED each idea ledger's cash + cost basis = its reserved capital + dividends received + realised
//                profit and loss — nothing enters or leaves a ledger except by a recorded action;
//   5. INDEXED   the set handed in is exactly the book's `openIdeaIds`, and each occupied slot names one of them;
//   6. LIVE      each open idea has a status that still owns cash or shares — `accepted`, `entering`, `holding`,
//                `line_hit_exit_pending`, or `settled` until its liquidation has filled (Astra T1A-C01) — sits in its
//                own slot, holds exactly the capital its contract reserved, and every amount is a real number. A
//                `resulted` or `cancelled` idea owns nothing and is never in the set. EVERY check below that applied to
//                `holding` in T1a-1 applies to each filled status alike. The status agrees with what the holdings
//                carry: a holding waiting to be sold before the endpoint only on `line_hit_exit_pending`; one waiting
//                for its settlement sale only on `settled`; a `settled` idea carries its result;
//   7. MARKED    (Astra T1A-02) every book position carries the SAME recorded mark as its idea's holding
//                (`mark_mismatch`), and `portfolio.totalValue` is the book's marked equity on the one R-19 basis —
//                treasury + Σ open ideas' (cash + holdings at their recorded marks, rounded once per idea), stated
//                once in ledger.js `markedEquityCents` (`equity_mismatch`);
//   8. CONSERVED, ALL THREE LEDGERS (Astra T1A-02) rule 4's identity holds for each idea's comparison ledger and
//                its SPY ledger too — cash + cost basis = reserved capital + dividends + realised profit and loss —
//                each with the idea's own reserved capital, positive holdings and every amount a real number. A
//                filled idea has both; an `accepted` one has neither yet. On all three ledgers the two added terms
//                are RECEIPTED (refuter RF-A3; T1a-2a §1): dividends equal the income on the ledger's applied
//                corporate-action receipts; realised profit and loss equals, to the cent, the sum on the ledger's
//                sale receipts plus the sum on its applied corporate-action receipts (a cash delisting — Amendment
//                E11). The comparison and SPY ledgers never sell (E3): a sale receipt on either is refused, so theirs
//                is 0 but for a cash delisting;
//   9. TIED      (Astra T1A-02) a `same_stock_held` comparison, while its idea has made no fill after the basket
//                entry (`postEntryFillCount === 0`), has exactly the idea's cash, the same names, quantities, cost
//                basis and recorded marks. Every fill after the entry increments the count — in this build each is a
//                sale with its receipt, so the count must equal the number of sale receipts on the idea's ledger — and
//                the tie applies only while it is 0, exactly as before. Every paper holding's mark is a real number
//                (rule 8).
//
// A failure throws PracticeFieldError `recon_failed` naming every broken rule. Thrown inside a transaction callback
// it aborts the transaction, so a book that does not reconcile is never written. Integer comparisons only (money
// in whole cents, shares in millionths): no tolerance. A mark is a per-share price recorded to more places than a
// cent; the book's and the idea's are two copies of one number, compared exactly as recorded.
//
// REJECT, NEVER REPAIR. Every money path calls this TWICE: on the state AS READ, before it decides anything, and on
// the state it is about to write. A path that recomputes a value (the close re-marks positions and the equity; the
// entry rewrites the equity) would otherwise overwrite an inconsistent value with a consistent one and pass.
//
// Pure.

import { PracticeFieldError } from './errors.js';
import {
  OPEN_IDEA_STATUSES, FILLED_IDEA_STATUSES, IDEA_STATUS, DECISION_ORIGIN_LINE_EXIT, DECISION_ORIGIN_SETTLEMENT,
} from './constants.js';
import { toCents, toMicroShares } from './money.js';
import { markedEquityCents } from './ledger.js';
import { isCostTier } from './fills.js';

/** The sales this build makes (exits.js). */
const SALE_KINDS = Object.freeze([DECISION_ORIGIN_LINE_EXIT, DECISION_ORIGIN_SETTLEMENT]);

/** The two paper ledgers beside an idea's own (rule 8). */
const PAPER_LEDGERS = Object.freeze([['comparison', 'comparisonLedger'], ['spy', 'spyLedger']]);
const LEDGER_AMOUNTS = Object.freeze(['cash', 'reservedCapitalUsd', 'dividendsUsd', 'realizedPnlUsd']);

/**
 * The two amounts conservation adds to a ledger's capital must themselves be accounted for (refuter RF-A3), or a
 * cent planted in a ledger's cash together with the same cent in its dividends — or in its realised profit — would
 * conserve and pass:
 *   dividends    equal the sum of the income on the ledger's own APPLIED corporate-action receipts;
 *   realised P&L equals the sum of the realised amounts on the ledger's SALE receipts plus those on its applied
 *                corporate-action receipts (a cash delisting), to the cent (T1a-2a §1; this replaces T1a-1's "must be
 *                0"). A paper ledger (`paper: true` — the comparison, SPY) never sells: any sale receipt on it is refused.
 * `prefix` names the ledger in the rule ('' for the idea's own, 'comparison_' or 'spy_').
 */
function recordedAmountProblems(ledger, ideaId, prefix, { paper = false } = {}) {
  const problems = [];
  const appliedReceipts = (ledger?.corporateActionReceipts || []).filter((r) => r?.applied === true);
  const receiptedCents = appliedReceipts.reduce((sum, r) => sum + toCents(r.incomeUsd || 0), 0);
  if (toCents(ledger?.dividendsUsd) !== receiptedCents) problems.push({ rule: `${prefix}dividends_not_receipted`, ideaId, dividendsCents: toCents(ledger?.dividendsUsd), receiptedCents });
  const sales = ledger?.saleReceipts || [];
  if (paper && sales.length > 0) problems.push({ rule: `${prefix}ledger_sold`, ideaId, sales: sales.length });
  for (const r of sales) {
    if (typeof r?.realizedPnlUsd !== 'number' || !Number.isFinite(r.realizedPnlUsd)) problems.push({ rule: 'not_a_number', ideaId, field: `${prefix}saleReceipts.realizedPnlUsd` });
    // A receipt agrees with itself (review SX-7): what the sale fetched, less what the holding cost, is what it
    // realised; and it is one of the sales this build makes.
    else if (toCents(r.proceedsUsd) - toCents(r.costBasisUsd) !== toCents(r.realizedPnlUsd)) problems.push({ rule: `${prefix}sale_receipt_inconsistent`, ideaId, decisionId: r.decisionId ?? null });
    if (!SALE_KINDS.includes(r?.kind)) problems.push({ rule: `${prefix}sale_receipt_kind_unknown`, ideaId, kind: r?.kind ?? null });
  }
  const realizedReceiptedCents = sales.reduce((sum, r) => sum + toCents(r?.realizedPnlUsd || 0), 0)
    + appliedReceipts.reduce((sum, r) => sum + toCents(r.realizedPnlUsd || 0), 0);
  if (toCents(ledger?.realizedPnlUsd) !== realizedReceiptedCents) {
    problems.push({ rule: `${prefix}realized_pnl_not_receipted`, ideaId, realizedCents: toCents(ledger?.realizedPnlUsd), receiptedCents: realizedReceiptedCents });
  }
  return problems;
}

/** Rule 8 for one paper ledger: real amounts, the idea's capital, positive holdings, conservation. */
function paperLedgerProblems(idea, name, paper) {
  const problems = [];
  const ideaId = idea?.ideaId;
  for (const field of LEDGER_AMOUNTS) {
    if (typeof paper[field] !== 'number' || !Number.isFinite(paper[field])) problems.push({ rule: 'not_a_number', ideaId, ledger: name, field });
  }
  if (toCents(paper.reservedCapitalUsd) !== toCents(idea?.contract?.capitalUsd)) problems.push({ rule: `${name}_capital_mismatch`, ideaId });
  const cashCents = toCents(paper.cash);
  if (cashCents < 0) problems.push({ rule: `${name}_cash_negative`, ideaId, cashCents });
  let basisCents = 0;
  for (const [ticker, h] of Object.entries(paper.holdings || {})) {
    if (!Number.isFinite(h?.shares) || !Number.isFinite(h?.costBasisTotal)) problems.push({ rule: 'not_a_number', ideaId, ledger: name, ticker });
    if (!Number.isFinite(h?.lastMark)) problems.push({ rule: 'not_a_number', ideaId, ledger: name, ticker, field: 'lastMark' });
    if (!(toMicroShares(h?.shares) > 0)) problems.push({ rule: `${name}_holding_not_positive`, ideaId, ticker });
    // E5: every holding carries the cost tier it entered with — the endpoint prices with it (review SX-6).
    if (!isCostTier(h?.costTier)) problems.push({ rule: `${name}_cost_tier_missing`, ideaId, ticker });
    basisCents += toCents(h?.costBasisTotal);
  }
  const expected = toCents(paper.reservedCapitalUsd) + toCents(paper.dividendsUsd) + toCents(paper.realizedPnlUsd);
  if (cashCents + basisCents !== expected) problems.push({ rule: `${name}_ledger_not_conserved`, ideaId, cashCents, basisCents, expected });
  problems.push(...recordedAmountProblems(paper, ideaId, `${name}_`, { paper: true }));
  return problems;
}

/** Rule 9: where a same-stock comparison and its idea differ — cash, the names held, each quantity, each basis. */
function tieBreaks(ledger, comparison) {
  const out = [];
  if (toCents(ledger?.cash) !== toCents(comparison?.cash)) out.push('cash');
  const own = ledger?.holdings || {};
  const cmp = comparison?.holdings || {};
  const names = [...new Set([...Object.keys(own), ...Object.keys(cmp)])].sort();
  for (const t of names) {
    if (!Object.hasOwn(own, t) || !Object.hasOwn(cmp, t)) { out.push(`held:${t}`); continue; }
    if (toMicroShares(own[t].shares) !== toMicroShares(cmp[t].shares)) out.push(`shares:${t}`);
    if (toCents(own[t].costBasisTotal) !== toCents(cmp[t].costBasisTotal)) out.push(`basis:${t}`);
    // The recorded mark too (review FR-A3): one snapshot, one action set, one frozen set — the same number, exactly.
    if (!Number.isFinite(own[t].lastMark) || own[t].lastMark !== cmp[t].lastMark) out.push(`mark:${t}`);
    // And the cost tier each entered with (review SX-6): it prices the sale and the endpoint, so a tier that differs
    // would break the tie at the endpoint though every quantity agrees.
    const a = own[t].costTier; const b = cmp[t].costTier;
    if (a?.capTier !== b?.capTier || a?.slippageBps !== b?.slippageBps || a?.spreadProxyBps !== b?.spreadProxyBps) out.push(`tier:${t}`);
  }
  return out;
}

/**
 * Rule 6's last sentence: the status agrees with what the idea's holdings carry (Astra T1A-C01 — the new statuses
 * are checked, not merely admitted).
 */
function statusProblems(idea) {
  const problems = [];
  const ideaId = idea?.ideaId;
  const holdings = Object.values(idea?.ledger?.holdings || {});
  const exitWaiting = holdings.filter((h) => h?.exitPending != null).length;
  const settlementWaiting = holdings.filter((h) => h?.settlementPending != null).length;
  if (exitWaiting > 0 && idea?.status !== IDEA_STATUS.LINE_HIT_EXIT_PENDING) problems.push({ rule: 'exit_pending_status_mismatch', ideaId, status: idea?.status ?? null });
  if (settlementWaiting > 0 && idea?.status !== IDEA_STATUS.SETTLED) problems.push({ rule: 'settlement_pending_status_mismatch', ideaId, status: idea?.status ?? null });
  if (idea?.status === IDEA_STATUS.SETTLED) {
    if (idea.result === null || typeof idea.result !== 'object') problems.push({ rule: 'settled_without_result', ideaId });
    // …and the endpoint figure its liquidation slippage is measured against (review SX-7).
    if (idea.endpoint === null || typeof idea.endpoint !== 'object' || !Number.isFinite(idea.endpoint.holdingsNetUsd)) problems.push({ rule: 'settled_without_endpoint', ideaId });
    // Everything a settled idea still holds is waiting for its one settlement sale; with nothing left it is `resulted`.
    if (holdings.length === 0 || settlementWaiting !== holdings.length) problems.push({ rule: 'settled_holding_not_pending', ideaId, holdings: holdings.length, pending: settlementWaiting });
  }
  // E14: `line_hit_exit_pending` goes back to `holding` once nothing it holds is waiting to exit; with nothing held at
  // all it is waiting for its session's close to write its endpoint (E2).
  if (idea?.status === IDEA_STATUS.LINE_HIT_EXIT_PENDING && holdings.length > 0 && exitWaiting === 0) problems.push({ rule: 'exit_pending_status_mismatch', ideaId, status: idea.status });
  if (idea?.status === IDEA_STATUS.HOLDING && holdings.length === 0) problems.push({ rule: 'holding_idea_holds_nothing', ideaId });
  if (idea?.status === IDEA_STATUS.ACCEPTED && holdings.length > 0) problems.push({ rule: 'accepted_idea_holds_shares', ideaId });
  return problems;
}

/**
 * @param {object} book   the book document as it will be written
 * @param {Array<object>} ideas  the idea documents of `book.openIdeaIds`, as they will be written
 * @returns {{ treasuryCents: number, ideaCashCents: number, portfolioCashCents: number, positions: number }}
 * @throws {PracticeFieldError} recon_failed
 */
export function assertReconciled(book, ideas) {
  const problems = [];
  const portfolio = book?.portfolio || {};
  const positions = portfolio.positions || {};
  const treasuryCents = toCents(book?.treasury?.unreservedCash);
  const portfolioCashCents = toCents(portfolio.cash);
  if (!Number.isFinite(book?.treasury?.unreservedCash) || treasuryCents < 0) problems.push({ rule: 'treasury_negative_or_missing', treasuryCents });
  if (!Number.isFinite(portfolio.cash)) problems.push({ rule: 'not_a_number', field: 'portfolio.cash' });
  if (portfolioCashCents < 0) problems.push({ rule: 'portfolio_cash_negative', portfolioCashCents });

  // 5. the open set
  const openIds = [...(book?.openIdeaIds || [])].sort();
  const givenIds = (ideas || []).map((i) => i?.ideaId).sort();
  if (openIds.length !== givenIds.length || openIds.some((id, i) => id !== givenIds[i])) {
    problems.push({ rule: 'open_idea_set_mismatch', openIdeaIds: openIds, given: givenIds });
  }
  const byId = new Map((ideas || []).map((i) => [i.ideaId, i]));
  for (const [slot, ideaId] of Object.entries(book?.slots || {})) {
    if (ideaId !== null && !byId.has(ideaId)) problems.push({ rule: 'slot_names_unknown_idea', slot, ideaId });
  }

  let ideaCashCents = 0;
  const holder = new Map(); // ticker → { ideaId, microShares, basisCents }
  for (const idea of ideas || []) {
    const ledger = idea?.ledger || {};
    const cashCents = toCents(ledger.cash);
    // 6. An open idea is a live one, in its own slot, holding exactly what its contract reserved.
    if (!OPEN_IDEA_STATUSES.includes(idea?.status)) problems.push({ rule: 'open_idea_not_live', ideaId: idea?.ideaId, status: idea?.status ?? null });
    problems.push(...statusProblems(idea));
    const filled = FILLED_IDEA_STATUSES.includes(idea?.status);
    if (book?.slots?.[idea?.contract?.slot] !== idea?.ideaId) problems.push({ rule: 'idea_not_in_its_slot', ideaId: idea?.ideaId, slot: idea?.contract?.slot ?? null });
    if (toCents(ledger.reservedCapitalUsd) !== toCents(idea?.contract?.capitalUsd)) problems.push({ rule: 'reserved_capital_mismatch', ideaId: idea?.ideaId });
    for (const field of ['cash', 'reservedCapitalUsd', 'dividendsUsd', 'realizedPnlUsd']) {
      if (!Number.isFinite(ledger[field])) problems.push({ rule: 'not_a_number', ideaId: idea?.ideaId, field });
    }
    if (cashCents < 0) problems.push({ rule: 'idea_cash_negative', ideaId: idea.ideaId, cashCents });
    ideaCashCents += cashCents;
    let basisCents = 0;
    for (const [ticker, h] of Object.entries(ledger.holdings || {})) {
      const microShares = toMicroShares(h.shares);
      const hBasis = toCents(h.costBasisTotal);
      basisCents += hBasis;
      if (!Number.isFinite(h.shares) || !Number.isFinite(h.costBasisTotal)) problems.push({ rule: 'not_a_number', ideaId: idea.ideaId, ticker });
      if (microShares <= 0) problems.push({ rule: 'idea_holding_not_positive', ideaId: idea.ideaId, ticker });
      // E5: the tier the holding entered with, on the idea's own ledger too (review SX-6).
      if (!isCostTier(h.costTier)) problems.push({ rule: 'cost_tier_missing', ideaId: idea.ideaId, ticker });
      if (holder.has(ticker)) problems.push({ rule: 'ticker_in_two_ideas', ticker, ideas: [holder.get(ticker).ideaId, idea.ideaId] });
      else holder.set(ticker, { ideaId: idea.ideaId, microShares, basisCents: hBasis, lastMark: h.lastMark });
    }
    // 4. conservation
    const expected = toCents(ledger.reservedCapitalUsd) + toCents(ledger.dividendsUsd) + toCents(ledger.realizedPnlUsd);
    if (cashCents + basisCents !== expected) {
      problems.push({ rule: 'ledger_not_conserved', ideaId: idea.ideaId, cashCents, basisCents, expected });
    }
    problems.push(...recordedAmountProblems(ledger, idea.ideaId, ''));
    // 8. the comparison and SPY ledgers conserve too. A filled idea has both; an accepted one has neither yet.
    for (const [name, field] of PAPER_LEDGERS) {
      const paper = idea?.[field] ?? null;
      if (paper === null || typeof paper !== 'object') {
        if (filled) problems.push({ rule: `${name}_ledger_missing`, ideaId: idea.ideaId });
        continue;
      }
      problems.push(...paperLedgerProblems(idea, name, paper));
    }
    // 9. a same-stock comparison is tied to its idea until the idea's first fill after entry. The count is the number
    //    of fills after the basket entry: each is a sale with its receipt, so the two must agree.
    if (filled) {
      const fills = idea.postEntryFillCount;
      if (!Number.isInteger(fills) || fills < 0 || fills !== (ledger.saleReceipts || []).length) {
        problems.push({ rule: 'post_entry_fill_count_invalid', ideaId: idea.ideaId, value: fills ?? null, saleReceipts: (ledger.saleReceipts || []).length });
      } else if (fills === 0 && idea.contract?.comparison?.type === 'same_stock_held' && idea.comparisonLedger) {
        const breaks = tieBreaks(ledger, idea.comparisonLedger);
        if (breaks.length > 0) problems.push({ rule: 'comparison_not_tied', ideaId: idea.ideaId, breaks });
      }
    }
  }

  // 1. cash
  if (treasuryCents + ideaCashCents !== portfolioCashCents) {
    problems.push({ rule: 'cash_mismatch', treasuryCents, ideaCashCents, portfolioCashCents });
  }

  // 2 + 3. positions ↔ idea holdings
  for (const [ticker, pos] of Object.entries(positions)) {
    if (typeof pos?.ideaId !== 'string' || pos.ideaId.length === 0) { problems.push({ rule: 'position_without_idea', ticker }); continue; }
    if (!byId.has(pos.ideaId)) { problems.push({ rule: 'position_idea_missing', ticker, ideaId: pos.ideaId }); continue; }
    const h = holder.get(ticker);
    if (!h || h.ideaId !== pos.ideaId) { problems.push({ rule: 'position_not_in_idea_ledger', ticker, ideaId: pos.ideaId }); continue; }
    if (toMicroShares(pos.shares) !== h.microShares) problems.push({ rule: 'shares_mismatch', ticker, book: toMicroShares(pos.shares), idea: h.microShares });
    if (toCents(pos.costBasisTotal) !== h.basisCents) problems.push({ rule: 'basis_mismatch', ticker, book: toCents(pos.costBasisTotal), idea: h.basisCents });
    // 7. the book's recorded mark is its idea's — one number, two copies, compared exactly.
    if (!Number.isFinite(pos.lastMark) || pos.lastMark !== h.lastMark) problems.push({ rule: 'mark_mismatch', ticker, book: pos.lastMark ?? null, idea: h.lastMark ?? null });
  }
  for (const [ticker, h] of holder) {
    if (!Object.hasOwn(positions, ticker)) problems.push({ rule: 'idea_holding_not_in_book', ticker, ideaId: h.ideaId });
  }

  // 7. the equity the book carries is its marked equity on the one basis (ledger.js markedEquityCents).
  const recordedEquity = portfolio.totalValue;
  if (typeof recordedEquity !== 'number' || !Number.isFinite(recordedEquity)) problems.push({ rule: 'not_a_number', field: 'portfolio.totalValue' });
  const equity = markedEquityCents(book?.treasury?.unreservedCash, ideas);
  if (toCents(recordedEquity) !== equity.equityCents) problems.push({ rule: 'equity_mismatch', recordedCents: toCents(recordedEquity), expectedCents: equity.equityCents });

  if (problems.length > 0) throw new PracticeFieldError('recon_failed', { bookId: book?.bookId ?? null, problems });
  return { treasuryCents, ideaCashCents, portfolioCashCents, positions: Object.keys(positions).length };
}
