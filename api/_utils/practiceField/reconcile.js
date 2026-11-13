// api/_utils/practiceField/reconcile.js
//
// Practice Field T1a-1 — THE RECONCILIATION (shared contract V2 §14 case 1, B-RECON; direction note ruling 4,
// B-OWNED; build prompt §7 step 4). After EVERY mutation — creation, admission, entry, release, a corporate
// action, a close — the caller hands the book as it will be written and every idea that still holds reserved
// cash or shares, and this asserts, to the cent and to the millionth of a share:
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
//   5. INDEXED   the set handed in is exactly the book's `openIdeaIds`, and each occupied slot names one of them.
//
// A failure throws PracticeFieldError `recon_failed` naming every broken rule. Thrown inside a transaction callback
// it aborts the transaction, so a book that does not reconcile is never written. Integer comparisons only (money
// in whole cents, shares in millionths): no tolerance.
//
// Pure.

import { PracticeFieldError } from './errors.js';
import { toCents, toMicroShares } from './money.js';

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
  if (!(typeof book?.treasury?.unreservedCash === 'number') || treasuryCents < 0) problems.push({ rule: 'treasury_negative_or_missing', treasuryCents });
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
    if (cashCents < 0) problems.push({ rule: 'idea_cash_negative', ideaId: idea.ideaId, cashCents });
    ideaCashCents += cashCents;
    let basisCents = 0;
    for (const [ticker, h] of Object.entries(ledger.holdings || {})) {
      const microShares = toMicroShares(h.shares);
      const hBasis = toCents(h.costBasisTotal);
      basisCents += hBasis;
      if (microShares <= 0) problems.push({ rule: 'idea_holding_not_positive', ideaId: idea.ideaId, ticker });
      if (holder.has(ticker)) problems.push({ rule: 'ticker_in_two_ideas', ticker, ideas: [holder.get(ticker).ideaId, idea.ideaId] });
      else holder.set(ticker, { ideaId: idea.ideaId, microShares, basisCents: hBasis });
    }
    // 4. conservation
    const expected = toCents(ledger.reservedCapitalUsd) + toCents(ledger.dividendsUsd) + toCents(ledger.realizedPnlUsd);
    if (cashCents + basisCents !== expected) {
      problems.push({ rule: 'ledger_not_conserved', ideaId: idea.ideaId, cashCents, basisCents, expected });
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
  }
  for (const [ticker, h] of holder) {
    if (!Object.hasOwn(positions, ticker)) problems.push({ rule: 'idea_holding_not_in_book', ticker, ideaId: h.ideaId });
  }

  if (problems.length > 0) throw new PracticeFieldError('recon_failed', { bookId: book?.bookId ?? null, problems });
  return { treasuryCents, ideaCashCents, portfolioCashCents, positions: Object.keys(positions).length };
}
