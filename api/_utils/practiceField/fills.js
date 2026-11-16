// api/_utils/practiceField/fills.js
//
// Practice Field T1a-1, T1a-2a — THE ONE FILL WRAPPER (build prompt §7a requirement 1; acceptance cases B-FILL,
// B-NOFILL; T1a-2a rule 7: every sale goes through here). Every fill an idea book ever makes — a basket entry leg, a
// line exit, a settlement sale; a trim in T1e — goes through `executeIdeaFill`, on any of an idea's ledgers
// (ledger.js). No other module under api/_utils/practiceField/ calls the engine's fill computation.
//
//   1. `eligibleMark` (marks.js) is asked FIRST. No eligible mark → PracticeFieldError `no_eligible_mark` with the
//      typed refusal, and nothing fills.
//   2. the engine's own execution math (`computeExecution`, mandateExecution.js) computes the fill;
//   3. the receipt's `markSource` must be 'snapshot'. The engine's exit lane fills a SELL or TRIM at a carried
//      mark, then at average cost, when the snapshot has no price — on purpose, for the quarterly product. That
//      must never reach an idea book: anything but 'snapshot' is PracticeFieldError `fill_mark_not_snapshot`;
//   4. the price the engine used must be the eligible mark's own.
//
// THE COST TIER (Amendment D Q-1; Amendment E5). A BUY resolves its tier from the snapshot (a stock's market-cap tier,
// a fund's explicit tier) and a stock whose tier cannot be resolved — no market cap on the snapshot — is refused
// `cost_tier_unknown`: missing data, never the widest tier. The tier a holding entered with is STORED ON THE HOLDING
// (`costTier`), and a sale is handed that stored tier (`friction`): a later snapshot's market cap never reprices it.
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

/** The engine's name for a tier it could not resolve (mandateFrictionModel.js capTierFor). */
export const UNKNOWN_COST_TIER = 'unknown';

/** A cost tier as a holding stores it: its name and its two basis-point figures, nothing else. */
export function costTierOf(friction) {
  return { capTier: friction?.capTier ?? null, slippageBps: friction?.slippageBps, spreadProxyBps: friction?.spreadProxyBps };
}

/** Is this a resolved cost tier — a name that is not the engine's `unknown`, and two real non-negative figures? */
export function isCostTier(tier) {
  const bps = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  return !!tier && typeof tier.capTier === 'string' && tier.capTier.length > 0 && tier.capTier !== UNKNOWN_COST_TIER
    && bps(tier.slippageBps) && bps(tier.spreadProxyBps);
}

/** The fraction of a mark one fill gives up to modelled slippage and spread, for a tier. */
const costFractionOf = (tier) => (tier.slippageBps + tier.spreadProxyBps) / 10000;

/**
 * What selling `shares` at `mark` under `tier` would fetch — THE SALE'S OWN ARITHMETIC (the engine prices a sale at
 * mark × (1 − cost) and rounds shares × that price once; step 4 below holds every real fill to the same price). The
 * endpoint (settlement.js; Amendment E4) values every ledger with it, so a holding sold at exactly the endpoint's
 * mark fetches exactly its endpoint value. A valuation: nothing is sold here.
 *
 * @returns {{ grossUsd: number, netUsd: number, rawNet: number }}  at the mark; after the modelled cost; unrounded
 */
export function modelledSaleProceeds(shares, mark, tier) {
  const rawNet = shares * (mark * (1 - costFractionOf(tier)));
  return { grossUsd: roundUsd(shares * mark), netUsd: roundUsd(rawNet), rawNet };
}

/** The cost tier a fill of `symbol` would resolve from `snapshot`, and whether it is one (Q-1: entry asks first). */
export function resolvedCostTier(symbol, snapshot) {
  const tier = costTierOf(frictionForSymbol(normSymbol(symbol), snapshot));
  return { tier, known: isCostTier(tier) };
}

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
 * @param {object|null} [args.friction] the holding's STORED cost tier `{ capTier, slippageBps, spreadProxyBps }` — a sale's
 * @returns {{ ledger: object, receipt: object }}
 * @throws {PracticeFieldError} no_eligible_mark | cost_tier_unknown | fill_refused | fill_mark_not_snapshot | fill_mark_mismatch | fill_verb_unsupported
 */
export function executeIdeaFill({
  ledger, verb, symbol, sizeUsd = 0, snapshot, notBeforeIso, sessionDate, sector = null, friction: storedTier = null, compute = computeExecution,
}) {
  const sym = normSymbol(symbol);
  if (!FILL_VERBS.includes(verb) || sym === null) throw new PracticeFieldError('fill_verb_unsupported', { verb, symbol });

  // 1. The eligible mark, first, for every verb.
  const mark = eligibleMark(snapshot, sym, { notBeforeIso, sessionDate });
  if (!mark.ok) throw new PracticeFieldError('no_eligible_mark', { symbol: sym, verb, refusal: mark.refusal });

  // The cost tier: the holding's stored one when handed in (E5), else the snapshot's. Never an unresolved one (Q-1).
  const friction = storedTier ? costTierOf(storedTier) : frictionForSymbol(sym, snapshot);
  if (!isCostTier(friction)) throw new PracticeFieldError('cost_tier_unknown', { symbol: sym, verb, capTier: friction?.capTier ?? null });

  // 2. The engine's execution math, on this ledger's own cash and holdings.
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
  // The engine builds a bought position fresh: the holding keeps the tier it ENTERED with (E5) — and anything else
  // this build records on a holding — across a top-up; a new holding takes this fill's tier.
  if (next.holdings[sym]) {
    const prior = ledger.holdings?.[sym] || null;
    next.holdings[sym] = { ...next.holdings[sym], costTier: prior?.costTier ?? costTierOf(friction) };
  }
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
      costTier: costTierOf(friction),
      frictionModelVersion: MANDATE_FRICTION_MODEL_VERSION,
    },
  };
}
