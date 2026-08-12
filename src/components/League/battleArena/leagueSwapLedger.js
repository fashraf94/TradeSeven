// src/components/League/battleArena/leagueSwapLedger.js
//
// League Score History — the ONE source of the agent swap ledger (pure +
// node-clean, zero non-local imports, so its co-located test's real import IS
// the dependency-surface guard).
//
// WHY THIS EXISTS (BUILD_RULES §9 — display-agreement): the live decomposition
// strip's SWAPS term and the Film Room recap's swap ledger must AGREE BY
// CONSTRUCTION, never as two copies of the same arithmetic that can drift. So
// the filter (`isSwapTrade`) and the per-swap point extraction (`swapPts`) live
// here once; buildArenaModel builds the live strip's `agentDeparted` from
// `buildSwapLedger`, and buildScoreHistory builds the recap from the SAME
// function. The strip's SWAPS (today's doc) and the recap's current-day subtotal
// are then the same number by construction — one source, one arithmetic.
//
// A "swap" is the agent subbing one name out for another. Its realized points
// are the LOCKED exit points (`lockedPoints`) — already earned, static, never
// re-priced. Fields mirror the PUBLIC_TRADE projection allowlist
// (api/_utils/tournamentBattleView.js): symbolOut/In, entry/exit price, locked
// points + gain %, timestamp, name, tier, isCrypto.

/**
 * The realized points of one swap trade — LOCKED exit points, non-finite → 0.
 * The single extraction the strip's SWAPS total and the recap both use (§9).
 * @param {Object} t a trades[] record
 * @returns {number}
 */
export function swapPts(t) {
  return Number.isFinite(t?.lockedPoints) ? t.lockedPoints : 0;
}

/**
 * A trades[] record counts as a swap when it names a leg (out or in). Same
 * predicate the live strip uses, so the recap and strip filter identically.
 * @param {Object} t
 * @returns {boolean}
 */
export function isSwapTrade(t) {
  return !!(t && (t.symbolOut || t.symbolIn));
}

/**
 * One day's swap ledger from that day's agentBattles `trades[]`: the display
 * records (in array order) plus their point total. `total` is Σ swapPts — the
 * exact value the live strip's SWAPS term shows for the same doc.
 *
 * @param {Array} trades the daily doc's trades[] (missing/non-array → empty)
 * @returns {{ items: Array<{out:string|null,in:string|null,pts:number,
 *   entryPrice:number|null,exitPrice:number|null,gainPct:number|null,
 *   at:*,name:string|null,tier:*,isCrypto:boolean}>, total:number }}
 */
export function buildSwapLedger(trades) {
  const items = (Array.isArray(trades) ? trades : [])
    .filter(isSwapTrade)
    .map((t) => ({
      out: t.symbolOut ?? null,
      in: t.symbolIn ?? null,
      pts: swapPts(t),
      entryPrice: Number.isFinite(t.entryPrice) ? t.entryPrice : null,
      exitPrice: Number.isFinite(t.exitPrice) ? t.exitPrice : null,
      gainPct: Number.isFinite(t.lockedGainPct) ? t.lockedGainPct : null,
      at: t.swappedOutAt ?? null,
      name: t.name ?? null,
      tier: t.tier ?? null,
      isCrypto: t.isCrypto === true,
    }));
  const total = items.reduce((a, s) => a + s.pts, 0);
  return { items, total };
}
