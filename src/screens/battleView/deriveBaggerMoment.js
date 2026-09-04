// src/screens/battleView/deriveBaggerMoment.js
//
// A3.6 — THE BAGGER MOMENT, from persisted scoring state only (D-97). PURE.
//
// The question Phase 0 item 4 answered: can "crossed into bagger between two
// snapshots" be derived from persisted state alone, and once? Yes — and this is
// that derivation, with nothing else in it.
//
// THE SOURCE IS `thresholdHistory`, NEVER THE ROW'S BADGE (ruling 7, hazard 37).
// `agentBattle.thresholdHistory[symbol].maxMultiplier` is written every evaluate
// tick (`api/cron/agent-evaluate.js:893-900`) from the fenced scorer's
// `effectiveMax` (`api/_utils/agentScoring.js:276-283`), so it is monotonic
// within a day and it takes the tick's intraday HIGH — a crossing that reversed
// before the tick is still recorded.
//
// The row's `BAGGER` badge reads a DIFFERENT number: `enrichAsset` merges the
// persisted history with the LIVE multiplier (`AgentBattleScreen.jsx:853-857`),
// so the badge can light from a websocket price up to a full cron tick before
// the persisted crossing exists — and un-light if the price falls back. Ruling 7
// keeps that badge exactly as it ships and makes the burst, the footer and the
// bubble the persisted-only additions. Two clocks, deliberately: the fuse's
// 400 ms flash marks the price crossing, this marks the record. Keying the burst
// on the live merge instead would fire it twice on a flicker (hazard 37).
//
// ONCE, AND NEVER ON MOUNT. Monotonicity gives "once" for free: a value that
// only rises can cross the line once a day. "Never on mount" comes from SEEDING
// — the first snapshot records where every piece already stands and fires
// nothing, the `useLandingKey` idiom (`landing.js:64-95`). A reload therefore
// cannot re-fire: it re-seeds from a doc that already reads >= 1.0.
//
// THE BOOK IS THE ITERATION, NOT THE HISTORY MAP. The cron never deletes a
// history entry, so a symbol swapped OUT keeps its own (`agent-daily-scores.js`
// calls those "stale"). Walking the map would announce a bagger for a piece the
// player no longer holds. A symbol swapped IN arrives with a zero-reset entry
// (`agent-evaluate.js:895-899`) and seeds at 0, so its own later crossing fires
// normally.
//
// NO SECOND COPY OF THE LINE. `THRESHOLD_MULTIPLIERS.bagger` is the canonical
// constant (BUILD_RULES §4: never create a local copy of scoring math). The
// local `THRESHOLDS` copies in computeProximity.js and TacticalRow.jsx are a
// recorded debt; this module does not become the third.

import { THRESHOLD_MULTIPLIERS, CONVICTION_MULTIPLIERS } from '../../constants/baggerBombScoring';

/** The line a piece crosses to be a bagger. The canonical constant, not a copy. */
export const BAGGER_LINE = THRESHOLD_MULTIPLIERS.bagger;

/**
 * The persisted peak multiplier for one symbol, as a number.
 *
 * A missing entry is 0, not null: a piece with no history has not crossed, and
 * a null here would make every comparison below silently false — including the
 * seed, which would then let the FIRST tick that writes a history fire a
 * crossing that already existed.
 */
export function persistedMaxMultiplier(battle, symbol) {
  const raw = battle?.thresholdHistory?.[symbol]?.maxMultiplier;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/**
 * Compare a remembered per-symbol map against the doc's current one.
 *
 * @param {Object|null} seen  symbol -> last seen persisted max. NULL means
 *   UNSEEDED — the first snapshot. It records and fires nothing, which is the
 *   whole of "never on mount".
 * @param {Object|null} battle  the subscribed agentBattles doc.
 * @param {Array<{symbol?: string, isCash?: boolean}>|string[]} book  the pieces
 *   the player HOLDS right now, in row order. Cash and blank slots are skipped.
 * @returns {{crossed: string[], next: Object}} `crossed` in book order; `next`
 *   is the map to remember, and covers exactly the current book.
 */
export function deriveBaggerCrossings(seen, battle, book) {
  const next = {};
  const crossed = [];
  const list = Array.isArray(book) ? book : [];
  for (const entry of list) {
    const symbol = typeof entry === 'string' ? entry : entry?.symbol;
    if (!symbol || (entry && typeof entry === 'object' && entry.isCash)) continue;
    // A duplicate symbol across tiers cannot happen on a real book, but two
    // entries would otherwise announce the same crossing twice.
    if (Object.prototype.hasOwnProperty.call(next, symbol)) continue;
    const now = persistedMaxMultiplier(battle, symbol);
    next[symbol] = now;
    if (seen === null || seen === undefined) continue;          // the seed
    const before = typeof seen[symbol] === 'number' ? seen[symbol] : 0;
    // A piece the seed never saw (swapped in since) enters at 0 — so a symbol
    // that arrives ALREADY above the line announces itself, which is right: it
    // crossed while this reader was watching, on the tick that brought it in.
    if (before < BAGGER_LINE && now >= BAGGER_LINE) crossed.push(symbol);
  }
  return { crossed, next };
}

/**
 * The two numbers the moment's words need, from the piece the ROW rendered.
 *
 * BUILD_RULES §9: both come off the enriched asset the board is showing, never
 * re-derived here. `baseATR` is the row's own (`enrichAsset` resolves it from
 * `scoring.thresholds[symbol].threshold` with the same default the row uses),
 * and the multiplier is the conviction tier's, which is the number the player
 * is playing for (ruling 8).
 *
 * The tier is passed in rather than read off the asset: `enrichAsset` takes it
 * as an ARGUMENT and does not add it to what it returns, so `asset.tier` is
 * whatever the persisted entry happened to carry — present on some docs, absent
 * on others. The board knows which tier's row it is rendering; that is the one
 * that cannot be wrong.
 *
 * @param {object} asset  the ENRICHED asset the row rendered.
 * @param {string} tier   'star' | 'core' | 'support', from the row.
 * @returns {{mult: number, pct: number}|null} null when either is unusable —
 *   the caller then renders no footer and no bubble rather than a guess.
 */
export function baggerMomentFacts(asset, tier = undefined) {
  if (!asset || typeof asset !== 'object') return null;
  const mult = CONVICTION_MULTIPLIERS[tier ?? asset.tier];
  const pct = asset.baseATR;
  if (typeof mult !== 'number' || !Number.isFinite(mult)) return null;
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct <= 0) return null;
  return { mult, pct };
}

export default deriveBaggerCrossings;
