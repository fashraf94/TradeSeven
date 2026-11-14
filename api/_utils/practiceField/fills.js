// api/_utils/practiceField/fills.js
//
// Practice Field T1a-1 — THE ONE FILL WRAPPER (build prompt §7a requirement 1; acceptance cases B-FILL, B-NOFILL).
// Every fill an idea book ever makes — a basket entry leg today; a trim, a line exit or a settlement sale in
// T1a-2 and T1e — goes through `executeIdeaFill`, on any of an idea's ledgers (ledger.js):
//
//   1. `eligibleMark` (marks.js) is asked FIRST. No eligible mark → PracticeFieldError `no_eligible_mark` with the
//      typed refusal, and nothing fills.
//   2. the engine's own execution math (`computeExecution`, mandateExecution.js) computes the fill;
//   3. the receipt's `markSource` must be 'snapshot'. The engine's exit lane fills a SELL or TRIM at a carried
//      mark, then at average cost, when the snapshot has no price — on purpose, for the quarterly product. That
//      must never reach an idea book: anything but 'snapshot' is PracticeFieldError `fill_mark_not_snapshot`;
//   4. the price the engine used must be the eligible mark's own.
//
// A thrown PracticeFieldError inside a transaction callback aborts the transaction: no ledger, no position, no
// decision record changes. The wrapper accepts SELL and TRIM as well as BUY and ADD so the rule is proven before
// any exit is built.
//
// Pure: no store, no clock. `compute` is injectable for one test only (to show step 3 firing on its own).

import { computeExecution } from '../mandateExecution.js';
import { MANDATE_FRICTION_MODEL_VERSION } from '../mandateConfig.js';
import { roundUsd } from '../mandateRounding.js';
import { PracticeFieldError } from './errors.js';
import { eligibleMark } from './marks.js';
import { frictionForSymbol, normSymbol } from './symbols.js';
import { cloneLedger } from './ledger.js';
import { addUsd } from './money.js';

const FILL_VERBS = Object.freeze(['BUY', 'ADD', 'SELL', 'TRIM']);

/**
 * Fill one leg on one ledger.
 *
 * @param {object} args
 * @param {object} args.ledger        the ledger to fill (ledger.js shape); not mutated
 * @param {string} args.verb          BUY | ADD | SELL | TRIM
 * @param {string} args.symbol
 * @param {number} args.sizeUsd       dollars to buy or to trim (ignored by SELL, which exits the holding)
 * @param {object} args.snapshot      the shared slot snapshot the fill prices at
 * @param {string} args.notBeforeIso  the decision's instant; the mark must be observed after it
 * @param {string} args.sessionDate   the fill's session (ET date)
 * @param {string|null} [args.sector] the sector stamped on a NEW holding (the bridge's, for a stock)
 * @returns {{ ledger: object, receipt: object }}
 * @throws {PracticeFieldError} no_eligible_mark | fill_refused | fill_mark_not_snapshot | fill_mark_mismatch | fill_verb_unsupported
 */
export function executeIdeaFill({
  ledger, verb, symbol, sizeUsd = 0, snapshot, notBeforeIso, sessionDate, sector = null, compute = computeExecution,
}) {
  const sym = normSymbol(symbol);
  if (!FILL_VERBS.includes(verb) || sym === null) throw new PracticeFieldError('fill_verb_unsupported', { verb, symbol });

  // 1. The eligible mark, first, for every verb.
  const mark = eligibleMark(snapshot, sym, { notBeforeIso, sessionDate });
  if (!mark.ok) throw new PracticeFieldError('no_eligible_mark', { symbol: sym, verb, refusal: mark.refusal });

  // 2. The engine's execution math, on this ledger's own cash and holdings.
  const friction = frictionForSymbol(sym, snapshot);
  const size = roundUsd(sizeUsd);
  const exec = compute({
    decision: { verb, ticker: sym, sizeUsd: size },
    execSizeUsd: size,
    positions: ledger.holdings,
    cash: ledger.cash,
    snapshot,
    friction,
    sectorOf: sector,
    sessionDate,
  });
  if (!exec.ok) throw new PracticeFieldError('fill_refused', { symbol: sym, verb, status: exec.status, reason: exec.reason });

  // 3. Never a carried mark, never average cost.
  if (exec.receipt.markSource !== 'snapshot') {
    throw new PracticeFieldError('fill_mark_not_snapshot', { symbol: sym, verb, markSource: exec.receipt.markSource ?? null });
  }
  // 4. The engine priced at the eligible mark itself (mark ± friction).
  const adj = (friction.slippageBps + friction.spreadProxyBps) / 10000;
  const expectedPrice = mark.price * (verb === 'BUY' || verb === 'ADD' ? 1 + adj : 1 - adj);
  if (exec.receipt.executedPrice !== expectedPrice) {
    throw new PracticeFieldError('fill_mark_mismatch', { symbol: sym, verb, executedPrice: exec.receipt.executedPrice, expectedPrice });
  }

  const next = cloneLedger(ledger);
  next.holdings = exec.mutation.positions;
  next.cash = exec.mutation.cash;
  next.costsPaidUsd = addUsd(next.costsPaidUsd, exec.receipt.friction.frictionPaid);
  next.realizedPnlUsd = addUsd(next.realizedPnlUsd, exec.receipt.realizedPnl || 0);

  return {
    ledger: next,
    receipt: {
      verb,
      symbol: sym,
      shares: exec.receipt.shares,
      executedPrice: exec.receipt.executedPrice,
      executedSizeUsd: exec.receipt.executedSizeUsd,
      requestedSizeUsd: size,
      realizedPnl: exec.receipt.realizedPnl || 0,
      clamped: !!exec.receipt.clamped,
      mark: mark.price,
      markVendorTimeIso: mark.vendorTimeIso,
      markQuoteTs: mark.quoteTs,
      markSource: 'snapshot',
      friction: { ...exec.receipt.friction, capTier: friction.capTier ?? null },
      frictionModelVersion: MANDATE_FRICTION_MODEL_VERSION,
    },
  };
}
