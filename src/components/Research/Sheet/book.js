// src/components/Research/Sheet/book.js
//
// THE AGENT'S BOOK, MEASURED (build prompt of Nov 13, 2026, QF-0, QF-2, QF-4;
// spec docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md §11). PURE and NODE-CLEAN:
// packs.js builds the client's items from it, and the server re-runs the same
// builder (api/_utils/researchAsk.js) to verify them.
//
// QF-2 — "WEAKEST" HAS ONE MEASURED DEFINITION: among the agent's held
// measured stocks, the lowest RUNGS FROM ENTRY at the last check — the
// committed context's `multiplier`, (price − fill) ÷ fill × 100 ÷ scoringPct
// (stockThresholdModel.js stockRewardContext), the game's own unit. The rank is
// decided on the number AS PRINTED (one decimal, sheetCopy.rungsShownOf —
// BUILD_RULES §9), so two names that both show −0.4 are a tie on screen and in
// the rank; a tie goes to the one nearer its next downside rung (the context's
// penaltyProximity.distance, same unit; none left below = nearest), then book
// order (star → core → support, by slot). Crypto and legacy-scored positions are
// "not on the ladder" — named, never ranked. A measured stock with no valid
// committed context (before its first check) is neither: it is left out.
//
// QF-4 — WHAT A SWAP-OUT WOULD LOCK: the scorer ITSELF (calculateAssetScoreV3
// with the committed context — never a copy of the math, BUILD_RULES §4), as of
// the last check's price. QF-0: a swap locks totalPoints at the swap's own exit
// quote (stockThresholdAdmission.js :258-276); the sheet names the check.

import { committedStockContext, stockModelRoute, isStock, instantMs } from '../../../utils/stockThresholdModel.js';
import { calculateAssetScoreV3, calculatePoints } from '../../../utils/baggerBombUtils.js';
import { BAGGER_TIERS } from '../../../constants/baggerBombScoring.js';
import { rungsShownOf } from './sheetCopy.js';

const TIERS = ['star', 'core', 'support'];
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const UP = new Set(BAGGER_TIERS.map((t) => t.key));

/**
 * Every agent position, in book order, with its measured reading.
 * @returns {Array<{ symbol, positionId, tier, slot, asset, onLadder: boolean, scored: boolean,
 *   context?, rungs?, rungsShown?, downRungs?, checkAtMs? }>}
 *   onLadder false: crypto or a legacy-scored stock (never ranked).
 *   onLadder true, scored false: a measured stock with no valid committed context yet (left out of the rank).
 */
export function bookOf(battle) {
  const corrected = stockModelRoute(battle).status === 'corrected';
  const out = [];
  for (const tier of TIERS) {
    const list = Array.isArray(battle?.portfolio?.[tier]) ? battle.portfolio[tier] : [];
    list.forEach((asset, slot) => {
      if (!asset || typeof asset.symbol !== 'string') return;
      const base = { symbol: asset.symbol, positionId: typeof asset.positionId === 'string' ? asset.positionId : null, tier, slot, asset };
      if (!corrected || !isStock(asset)) { out.push({ ...base, onLadder: false, scored: false }); return; }
      const c = committedStockContext(battle, asset, 'agent', tier, slot);
      if (c.status !== 'valid' || !finite(c.multiplier)) { out.push({ ...base, onLadder: true, scored: false }); return; }
      out.push({
        ...base,
        onLadder: true,
        scored: true,
        context: c,
        rungs: c.multiplier,
        rungsShown: rungsShownOf(c.multiplier),
        // No downside rung left unhit: nothing nearer (0).
        downRungs: finite(c.penaltyProximity?.distance) ? c.penaltyProximity.distance : 0,
        // BD-8: the instant the check READ the quote names the check.
        checkAtMs: instantMs(c.quoteEvidence?.observedAt),
      });
    });
  }
  return out;
}

/** The ranked book (QF-2): scored measured stocks only, lowest rungs from entry (as printed) first. */
export function rankedBook(book) {
  return book
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.onLadder && e.scored)
    .sort((a, b) => (a.e.rungsShown - b.e.rungsShown) || (a.e.downRungs - b.e.downRungs) || (a.i - b.i))
    .map(({ e }) => e);
}

/** The weakest held measured stock (QF-2), or null. */
export function weakestOf(book) {
  return rankedBook(book)[0] ?? null;
}

/** The held names not on the measured ladder (named, never ranked). */
export function offLadderOf(book) {
  return book.filter((e) => !e.onLadder).map((e) => e.symbol);
}

/** The check the ranking reads: the latest instant any ranked context names. */
export function bookCheckMs(ranked) {
  const ms = ranked.map((e) => e.checkAtMs).filter(finite);
  return ms.length ? Math.max(...ms) : null;
}

/**
 * QF-4 — what a swap-out at the last check's price would lock, split as the scorer splits it:
 * { total, gain (the rounded base points), banked (upside rungs), hit (downside rungs, ≤ 0), price, atMs }.
 * Null without a valid committed context.
 */
export function lockNowOf(entry) {
  if (!entry?.scored || !entry.context) return null;
  const score = calculateAssetScoreV3({ ...entry.asset, tier: entry.tier }, null, {}, {}, null, entry.context);
  if (score.status !== 'valid' || !finite(score.totalPoints)) return null;
  const crossed = Array.isArray(score.badges) ? score.badges : [];
  return {
    total: score.totalPoints,
    gain: score.basePoints,
    banked: calculatePoints(crossed.filter((k) => UP.has(k))),
    hit: calculatePoints(crossed.filter((k) => !UP.has(k))),
    price: entry.context.currentPrice,
    atMs: entry.checkAtMs,
  };
}
