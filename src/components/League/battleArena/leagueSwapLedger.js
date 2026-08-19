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

// Swap Motive Observability (Tier 1) — the ONE mapping from a persisted swap
// record to its human-readable reason label. Lives here (the §9 display-agreement
// single source) so the Film Room recap and the trade-history list read the same
// label by construction, never two drifting copies.
//
// Two distinct persisted keys, two distinct questions (founder ruling):
//   • exitReason  — WHICH MACHINERY produced the swap (provenance; four subsystems
//                   depend on its exact values — never repurposed).
//   • swapMotive  — the model's DECLARED judgment (Tier 1's new sibling; null when
//                   the model was asked but omitted it; absent on legacy records).
const MOTIVE_LABELS = {
  defensive_cut: 'defensive cut',
  profit_take: 'profit take',
  momentum_rotation: 'rotation',
  upgrade: 'upgrade',
};
const DETERMINISTIC_LABELS = {
  bust_avoidance: 'stop (bust avoidance)',
  vwap_failure: 'VWAP failure',
  stepped_trail: 'trailing stop',
  stagnation: 'stagnation rotation',
  guardrail_stopLoss: 'stop-loss',
  guardrail_trailingStop: 'trailing stop',
  // Exit-Behavior Tier 2 Ask 3 (R3, same-PR keyed-list add): the profit-target
  // executor's stamp — deterministic-first precedence applies unchanged, so an
  // engine-forced target fire can never render as "agent decision" (or worse,
  // a stale declared motive).
  guardrail_profitTarget: 'profit target',
  gameplan_rotation: 'gameplan rotation',
};

/**
 * The human-readable reason for one swap — never blank, never a fabricated motive.
 * Precedence, DETERMINISTIC-FIRST: (1) a deterministic exitReason (a machinery-forced
 * swap) shows its protective taxonomy — this outranks any declared motive, because a
 * stale model swap_type can ride along on a guardrail-overridden decision and must
 * never mislabel a forced stop; (2) else the model's declared motive; (3) else a
 * discretionary model swap is "undeclared" when the field is present-but-null (asked,
 * not answered) or "agent decision" when the field is absent (legacy, predates Tier 1);
 * (4) anything else falls back to "agent decision" rather than blank.
 * @param {Object} t a trades[] record
 * @returns {string}
 */
export function swapReasonLabel(t) {
  const er = t?.exitReason;
  // 1. Machinery-forced swaps read their protective taxonomy FIRST. A declared
  //    motive must NEVER outrank a deterministic exitReason — a guardrail override
  //    (agent-evaluate.js spreads the prior haikuResult) can leave a stale swap_type
  //    on a swap the engine forced as a stop, and "stop-loss" printed as "upgrade"
  //    is exactly the honesty failure the taxonomy exists to prevent.
  if (er && DETERMINISTIC_LABELS[er]) return DETERMINISTIC_LABELS[er];
  // 2. A genuinely discretionary swap: the model's declared motive, if any. An
  //    out-of-enum value degrades to the neutral label, never a fabricated motive.
  const motive = t?.swapMotive;
  if (motive != null) return MOTIVE_LABELS[motive] ?? 'agent decision';
  // 3. Discretionary model swap, no motive: present-but-null → asked and omitted;
  //    undefined/absent → legacy record.
  if (er === 'haiku_decision') return motive === null ? 'undeclared' : 'agent decision';
  // 4. Never blank, never a fabricated motive.
  return 'agent decision';
}

/**
 * One day's swap ledger from that day's agentBattles `trades[]`: the display
 * records (in array order) plus their point total. `total` is Σ swapPts — the
 * exact value the live strip's SWAPS term shows for the same doc.
 *
 * @param {Array} trades the daily doc's trades[] (missing/non-array → empty)
 * @returns {{ items: Array<{out:string|null,in:string|null,pts:number,
 *   entryPrice:number|null,exitPrice:number|null,gainPct:number|null,
 *   at:*,name:string|null,tier:*,isCrypto:boolean,reason:string}>, total:number }}
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
      // Tier 1: additive/inert — the label is carried on every item but rendered
      // only by surfaces gated behind SWAP_MOTIVE_DISPLAY_ENABLED. The live
      // decomposition strip ignores it, so its output is unchanged.
      reason: swapReasonLabel(t),
    }));
  const total = items.reduce((a, s) => a + s.pts, 0);
  return { items, total };
}
