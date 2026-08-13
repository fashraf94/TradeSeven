// api/_utils/mandateRounding.js
//
// Spec 1 — Mandate Substrate — ONE rounding regime for the whole mandate
// ledger (§4.1: USD 2dp banker's, shares 6dp). Extracted in Phase 3 after the
// money reviewer found TWO defects in the scattered rounders:
//
//   1. mandateExecution's bankersRound used a half-detection tolerance of
//      1e-9 × |scaled| — ~4.5e6× wider than a double ULP. Above $5,000,000
//      the tolerance exceeds 0.5, so EVERY value took the half-to-even branch
//      and rounded to floor parity: odd cents became unrepresentable
//      (bankersRound(10000000.01, 2) → 10000000.02), destroying/creating a
//      cent on essentially every trade at the $10M capital base — inside the
//      §3.5 conservation tolerance, committing silently. (Pre-existed on
//      main; P3's live friction + D-43 capital made it bite.)
//   2. mandateClosePass and mandateCorporateActions each carried a private
//      Math.round (half-up) `roundUsd` — a second rounding regime across the
//      same ledger (dividend 5 × $0.125 → $0.63 half-up vs $0.62 banker's).
//
// The tolerance here is ULP-RELATIVE: a true decimal half (x.xx5) scaled by
// 10^dp lands within a few ULP of z.5; 32 ULPs of headroom catches that
// representation noise at every magnitude while staying ~10 orders of
// magnitude below 0.5 even at 10^15. Never widen this to an absolute or
// 1e-9-relative band — that is exactly defect 1.

import { MANDATE_USD_DP, MANDATE_SHARES_DP } from './mandateConfig.js';

/** Banker's rounding (half-to-even) at `dp` decimal places. Non-finite → 0. */
export function bankersRound(value, dp) {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** dp;
  const scaled = value * f;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  // ULP-relative half detection (see header; money reviewer P3 finding 3).
  const halfTol = 32 * Number.EPSILON * Math.max(1, Math.abs(scaled));
  let rounded;
  if (Math.abs(diff - 0.5) <= halfTol) rounded = (floor % 2 === 0) ? floor : floor + 1;
  else rounded = Math.round(scaled);
  return rounded / f;
}

/** USD at 2dp banker's — the ONLY USD rounder for mandate money. Null-safe. */
export const roundUsd = (n) => bankersRound(Number(n) || 0, MANDATE_USD_DP);

/** Shares at 6dp banker's (CA ratio transforms; buys use execution's floorShares). */
export const roundShares = (n) => bankersRound(Number(n) || 0, MANDATE_SHARES_DP);
