// api/_utils/practiceField/money.js
//
// Practice Field T1a-1 — INTEGER arithmetic for the idea book's money. The engine's one rounding regime stands
// (mandateRounding.js: USD at 2 dp banker's, shares at 6 dp); nothing here rounds a money VALUE a second way.
// These helpers move an already-2-dp dollar amount into whole cents (and a 6-dp share count into whole
// micro-shares) so that every limit comparison, every allocation and every reconciliation in the idea book is an
// exact integer comparison with no tolerance. A float comparison at a cap's boundary would otherwise decide by
// representation noise (three full slots sit exactly on the 10% cash floor by design).
//
// THE RAW ROUNDING SITES OF THE PRACTICE FIELD LIVE HERE AND ONLY HERE. Each is registered in the money-path
// rounding scan (api/_utils/mandateMoneyRounding.scan.test.js) with its classification:
//   toCents / toMicroShares — unit conversion of a value the engine already rounded (Math.round recovers the
//                              integer the 2-dp / 6-dp double stands for; it never moves a cent);
//   shareLimitCents / ratioLimitCents / equalSplitCents — DIRECTIONAL floors: a limit or an allocation is
//                              rounded DOWN to a whole cent so a permitted amount can never exceed its limit
//                              (the floorShares precedent, mandateExecution.js).

import { roundUsd, roundShares } from '../mandateRounding.js';

const PPM = 1_000_000;

/** Whole cents of a dollar amount (rounded to 2 dp by the engine's rounder first). */
export function toCents(usd) {
  return Math.round(roundUsd(usd) * 100);
}

/** Dollars of a whole-cent count: the nearest double to the 2-dp value. */
export function fromCents(cents) {
  return roundUsd(cents / 100);
}

/** Whole micro-shares (1e-6) of a share count. */
export function toMicroShares(shares) {
  return Math.round(roundShares(shares) * PPM);
}

/**
 * The largest whole-cent amount not above `share` of `baseCents`, where `share` is a decimal fraction with at most
 * six decimal places (every founder slot is). Exact: the share is taken as an integer number of millionths, the
 * product is an exact integer below 2^53 for any book this engine can hold, and the floor of the correctly rounded
 * quotient is the true floor.
 */
export function shareLimitCents(baseCents, share) {
  const ppm = Math.round(share * PPM);
  return Math.floor((baseCents * ppm) / PPM);
}

/** The largest whole-cent amount not above `numerator / denominator` of `baseCents` (integers; e.g. 2/6, 3/6, 4/6). */
export function ratioLimitCents(baseCents, numerator, denominator) {
  return Math.floor((baseCents * numerator) / denominator);
}

/** An equal split of `totalCents` over `parts`: each part's whole-cent share, rounded down. The remainder stays put. */
export function equalSplitCents(totalCents, parts) {
  return Math.floor(totalCents / parts);
}

/** A weight in whole millionths, or null when it is not a decimal with at most six places in (0, 1]. */
export function weightPpm(weight) {
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > 1) return null;
  const ppm = Math.round(weight * PPM);
  // A weight that rounds to zero millionths is no weight: a name must carry a share of the idea.
  return ppm >= 1 && Math.abs(weight * PPM - ppm) < 1e-6 ? ppm : null;
}

/** The whole-cent share of `totalCents` for a weight given in millionths, rounded down. */
export function weightedCents(totalCents, ppm) {
  return Math.floor((totalCents * ppm) / PPM);
}

export const WEIGHT_PPM_TOTAL = PPM;

/** Add dollar amounts exactly, in cents. */
export function addUsd(...amounts) {
  return fromCents(amounts.reduce((sum, a) => sum + toCents(a), 0));
}

/** The smallest whole-cent amount not below `share` of `baseCents` (a FLOOR the book must keep is rounded UP). */
export function shareCeilCents(baseCents, share) {
  const ppm = Math.round(share * PPM);
  return Math.ceil((baseCents * ppm) / PPM);
}

/** floor(a × b / c) for non-negative integers — the largest whole-cent amount a rational limit allows. */
export function floorMulDiv(a, b, c) {
  return Math.floor((a * b) / c);
}
