// api/_utils/mandateValuation.js
//
// Spec 1 — Mandate Substrate — the ONE consistent valuation (§3.5 / I6). The gate
// and the execution transaction must value the book identically — "re-mark all
// positions at the harvest tick's snapshot (one consistent valuation for gates
// and totals, I6)." Centralizing that here is the guard against the gate and the
// executor computing different totals (a class of bug the spec explicitly names).
//
// Pure (no Firestore, no fetch). Average-cost accounting (§4.1): `avgCost =
// costBasisTotal / shares`. Marks come from the tick snapshot; a held symbol the
// snapshot can't mark carries its last good mark forward (carry-over, §3.6) so a
// single frozen ticker never corrupts the book total — it is valued honestly at
// its last mark with markSource labeled.

import { markFor } from './mandateUniverseSnapshot.js';

const norm = (s) => String(s || '').trim().toUpperCase();

/** avgCost from average-cost basis (§4.1). Null when shares are zero. */
export function avgCostOf(pos) {
  const shares = Number(pos?.shares) || 0;
  if (shares <= 0) return null;
  const basis = Number(pos?.costBasisTotal) || 0;
  return basis / shares;
}

/**
 * Value a book at a snapshot. Every held position is marked at the snapshot's
 * harvest-tick price; a symbol the snapshot can't mark falls back to the
 * position's last good mark (carry-over) so the total is never NaN and never
 * silently drops a held position to zero.
 *
 * @returns {{
 *   marked: Object<string, {shares, costBasisTotal, avgCost, sector, mark,
 *                           markSource:'snapshot'|'carry_over'|'basis', marketValue}>,
 *   positionsValue: number, totalValue: number,
 *   sectorExposureUsd: Object<string, number>,
 * }}
 */
export function markBook(positions = {}, cash = 0, snapshot = null) {
  const marked = {};
  const sectorExposureUsd = {};
  let positionsValue = 0;

  for (const [rawTicker, pos] of Object.entries(positions || {})) {
    const ticker = norm(rawTicker); // canonical key — the gate matches on the uppercased ticker (C6)
    const shares = Number(pos?.shares) || 0;
    if (shares <= 0) continue;

    const snapMark = markFor(snapshot, ticker);
    let mark = snapMark;
    let markSource = 'snapshot';
    if (mark == null) {
      if (Number.isFinite(pos?.lastMark)) { mark = pos.lastMark; markSource = 'carry_over'; }
      else { mark = avgCostOf(pos) ?? 0; markSource = 'basis'; }
    }

    const marketValue = shares * mark;
    positionsValue += marketValue;
    const sector = pos?.sector || '__unknown__';
    sectorExposureUsd[sector] = (sectorExposureUsd[sector] || 0) + marketValue;

    marked[ticker] = {
      shares,
      costBasisTotal: Number(pos?.costBasisTotal) || 0,
      avgCost: avgCostOf(pos),
      sector: pos?.sector || null,
      mark,
      markSource,
      marketValue,
    };
  }

  const totalValue = positionsValue + (Number(cash) || 0);
  return { marked, positionsValue, totalValue, sectorExposureUsd };
}

/** The marked market value of one held position (0 if not held / no shares). */
export function positionMarketValue(marked, ticker) {
  const m = marked?.[String(ticker || '').trim().toUpperCase()];
  return m ? m.marketValue : 0;
}
