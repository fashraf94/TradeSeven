// src/components/Research/BombMode/ladder.js
//
// Research Modal Build A — THE LADDER (spec
// docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md §3.1, §3.6, §3.7,
// §4.3). Pure. Four adapters build ONE shape the Fuse, the red zone and the
// sheet all draw from, so the chart and the sheet can never show two ladders
// (BA-1; the Phase 0 §A two-baselines bug):
//
//   measuredLadder  the modal's own bombData.measured — the committed context's
//                   exact targets and crossed tiers (never re-derived)
//   legacyLadder    the server's rung-test baseline, applied ONCE by the
//                   server's own resolveThresholdBaseline, × the canonical tier
//                   multipliers; banked from today's thresholdHistory
//   previewLadder   a name the agent does not hold: yesterday's close × the
//                   threshold the Bomb tab uses; nothing banked
//   v4Ladder        a V4 BaggerBomb battle's state.dailyLevels for the name
//
// Points, labels and multipliers come from the canonical constants module only
// (src/constants/baggerBombScoring.js — BUILD_RULES §4).
//
// Ladder shape: { status: 'ok' | <reason>, kind: 'held' | 'preview',
//   model: 'measured' | 'legacy' | 'preview' | 'v4',
//   baseline: { price, source, atMs }, rungs: [rung], up: [rung] (k asc),
//   down: [rung] (k desc), next: rung | null, bankedPoints,
//   nextDown: rung | null, hitPoints, threshold: number | null }
// rung: { key, label, emoji, points, k, price, banked, hit }
//
// BOTH DIRECTIONS (refinement 2026-11-10, BD-1): `next` is the first unbanked
// upside rung; `nextDown` the first unhit downside rung (bust → crash →
// meltdown). A crossed DOWNSIDE rung is "hit", never "banked": `hit` carries it
// (`banked` stays the internal crossed flag the legacy rows read). Nothing is
// re-derived: a measured ladder's downside prices and hit states are the
// committed context's `targets` and `crossedTiers`, exactly like the upside.

import { BAGGER_TIERS, BUST_TIERS, THRESHOLD_MULTIPLIERS } from '../../../constants/baggerBombScoring.js';
import { resolveThresholdBaseline } from '../../../../api/_utils/baselineValidation.js';
import { etDateOf } from '../../../utils/tieredFirstTradingDay.js';
import { priceDecimals, priceText } from '../priceFormat.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const positive = (v) => finite(v) && v > 0;

/** Every tier, upside first, with its signed multiple of the threshold. */
const TIERS = Object.freeze([
  ...BAGGER_TIERS.map((t) => Object.freeze({ key: t.key, label: t.label, emoji: t.emoji, points: t.points, k: t.multiplier })),
  ...BUST_TIERS.map((t) => Object.freeze({ key: t.key, label: t.label, emoji: t.emoji, points: t.points, k: -t.multiplier })),
]);
export const UP_KEYS = Object.freeze(BAGGER_TIERS.map((t) => t.key));

// ── Bricks (Amendment A R-11′(a); spec §3.6) ────────────────────────────────
/** A brick is the threshold over this many: rungs at 1, 1.5 and 2 thresholds sit on bricks 6, 9 and 12. */
export const BRICKS_PER_THRESHOLD = 6;
/** The upside multipliers the brick rule assumes. Any other set omits the brick ticks. */
export const BRICK_MULTIPLIERS = Object.freeze([1, 1.5, 2]);

/** Do the canonical upside multipliers put every rung on a whole brick? */
export function bricksSupported(tiers = BAGGER_TIERS) {
  return Array.isArray(tiers) && tiers.length === BRICK_MULTIPLIERS.length
    && tiers.every((t, i) => t.multiplier === BRICK_MULTIPLIERS[i]
      && Number.isInteger(Math.round(t.multiplier * BRICKS_PER_THRESHOLD * 1e9) / 1e9));
}

function unavailable(reason, extra = {}) {
  return { status: reason, rungs: [], up: [], down: [], next: null, bankedPoints: 0, nextDown: null, hitPoints: 0, ...extra };
}

function finish(ladder) {
  const up = ladder.rungs.filter((r) => r.k > 0).sort((a, b) => a.k - b.k);
  const down = ladder.rungs.filter((r) => r.k < 0).sort((a, b) => b.k - a.k);
  const next = up.find((r) => !r.banked) || null;
  const bankedPoints = up.filter((r) => r.banked).reduce((n, r) => n + r.points, 0);
  // BD-1: the downside in the same order the scorer crosses it (bust → crash → meltdown).
  const nextDown = down.find((r) => !r.hit) || null;
  const hitPoints = down.filter((r) => r.hit).reduce((n, r) => n + r.points, 0);
  return { ...ladder, up, down, next, bankedPoints, nextDown, hitPoints };
}

const rungOf = (t, price, banked) => ({ key: t.key, label: t.label, emoji: t.emoji, points: t.points, k: t.k, price, banked: banked === true, hit: t.k < 0 && banked === true });

/**
 * Held, measured model (spec §3.1): the modal's bombData.measured as it is —
 * `{ measured: true, baselinePrice: fill, targets: [{ key, price }], crossedTiers }`.
 */
export function measuredLadder({ measured, entryAtMs = null } = {}) {
  if (!measured || measured.measured !== true || !positive(measured.baselinePrice) || !Array.isArray(measured.targets)) {
    return unavailable('measured_unavailable', { kind: 'held', model: 'measured' });
  }
  const byKey = new Map(measured.targets.map((t) => [t?.key, t?.price]));
  const crossed = new Set(Array.isArray(measured.crossedTiers) ? measured.crossedTiers : []);
  const rungs = TIERS.map((t) => rungOf(t, byKey.get(t.key), crossed.has(t.key)));
  if (rungs.some((r) => !positive(r.price))) return unavailable('measured_unavailable', { kind: 'held', model: 'measured' });
  return finish({
    status: 'ok', kind: 'held', model: 'measured',
    baseline: { price: measured.baselinePrice, source: 'fill', atMs: finite(entryAtMs) ? entryAtMs : null },
    // BP-3: the rule's % — the committed context's frozen scoringPct (the one
    // Details prints), carried by the selector; never back-derived from the targets.
    threshold: positive(measured.scoringPct) ? measured.scoringPct : null,
    rungs,
  });
}

/**
 * UNREACHABLE FROM THE VIEWS since the 2026-11-07 ruling on spec §0.4(a)
 * (rule (i): a held ladder only for a measured position — bombView.buildLadder
 * gives a legacy record the preview). Kept, with its rows, until the 'on'
 * cleanup deletes it, unless a legacy-aware ladder is ruled later.
 *
 * Held, legacy model (spec §3.1). `record` is selectBombRecord's legacy
 * answer; `previousClose` is the modal's own (the prior session's daily close,
 * useResearchData getPreviousClose — Guard 2's own reference bar, so Guard 2
 * accepts it unchanged; the server's real-time previousClose can differ from it
 * by less than 0.5 ATR, which the report records).
 */
export function legacyLadder({ record, previousClose, nowMs } = {}) {
  if (!record || record.model !== 'legacy') return unavailable('legacy_unavailable', { kind: 'held', model: 'legacy' });
  const { swapPrice, startingPrice, isActivationDay } = record.baselineInputs || {};
  const threshold = record.threshold;
  // THE ENTRY GATE first (agent-evaluate.js :1266-1274; agent-daily-scores.js
  // :112-114): with `swapPrice || startingPrices[sym]` ≤ 0 the scorer returns
  // before any rung test, so no rung can bank — "entry unavailable" (spec
  // §3.1, Phase 0 §5 #7: a swapped-in name after the night clears swapPrice).
  if (!positive(swapPrice) && !positive(startingPrice)) {
    return unavailable('entry_unavailable', { kind: 'held', model: 'legacy', baseline: { price: null, source: 'no_entry_price', atMs: null } });
  }
  const etToday = finite(nowMs) ? etDateOf(nowMs) : null;
  const utcToday = finite(nowMs) ? new Date(nowMs).toISOString().slice(0, 10) : null;
  // THE PRECEDENCE, applied once, by the server's own shared resolver.
  const { baseline, guard2 } = resolveThresholdBaseline({
    swapPrice: swapPrice ?? undefined,
    isActivationDay: isActivationDay === true,
    startingPrice: startingPrice ?? undefined,
    previousClose: positive(previousClose) ? previousClose : undefined,
    daily: null,
    isCrypto: record.isCrypto === true,
    baseATR: threshold,
    etToday,
    utcToday,
  });
  const source = guard2 ? 'previous_close' : positive(swapPrice) ? 'swap_price' : 'starting_price';
  if (!positive(baseline) || !positive(threshold)) {
    return unavailable('entry_unavailable', { kind: 'held', model: 'legacy', baseline: { price: null, source, atMs: null } });
  }
  const hist = record.history || {};
  const rungs = TIERS.map((t) => {
    // agentScoring.js getBadgesFromHistoryServer: a tier is held at
    // maxMultiplier >= its multiple (upside) / minMultiplier <= it (downside).
    const m = THRESHOLD_MULTIPLIERS[t.key];
    const banked = t.k > 0 ? finite(hist.maxMultiplier) && hist.maxMultiplier >= m : finite(hist.minMultiplier) && hist.minMultiplier <= m;
    return rungOf(t, baseline * (1 + (m * threshold) / 100), banked);
  });
  return finish({
    status: 'ok', kind: 'held', model: 'legacy',
    baseline: { price: baseline, source, atMs: source === 'previous_close' ? null : (finite(record.entryAtMs) ? record.entryAtMs : null) },
    threshold,
    rungs,
  });
}

/** Not held (BA-1, spec §3.7): one baseline — yesterday's close — × the threshold the Bomb tab uses. */
export function previewLadder({ previousClose, threshold } = {}) {
  if (!positive(previousClose) || !positive(threshold)) return unavailable('preview_unavailable', { kind: 'preview', model: 'preview' });
  const rungs = TIERS.map((t) => rungOf(t, previousClose * (1 + (t.k * threshold) / 100), false));
  return finish({ status: 'ok', kind: 'preview', model: 'preview', baseline: { price: previousClose, source: 'previous_close', atMs: null }, threshold, rungs });
}

/** The V4 cron's level names per tier (compute-daily-baggerbomb-levels; BaggerBombTab cronTargetMap). */
export const V4_LEVEL_KEYS = Object.freeze({ bagger: 'baggerBomb', doubleBagger: 'doubleBagger', tenBagger: 'tenBagger', bust: 'bust', crash: 'crash', meltdown: 'meltdown' });

/** A V4 battle's state.dailyLevels.assets[SYM] (spec §3.7): those levels and that baseline. Nothing banked (a preview). */
export function v4Ladder({ levels } = {}) {
  if (!levels || !positive(levels.baseline)) return unavailable('preview_unavailable', { kind: 'preview', model: 'v4' });
  const rungs = TIERS.map((t) => rungOf(t, levels[V4_LEVEL_KEYS[t.key]], false));
  if (rungs.some((r) => !positive(r.price))) return unavailable('preview_unavailable', { kind: 'preview', model: 'v4' });
  return finish({ status: 'ok', kind: 'preview', model: 'v4', baseline: { price: levels.baseline, source: 'daily_levels', atMs: null }, threshold: null, rungs });
}

/** A V4 battle's levels for one symbol, only when they are TODAY's (useBaggerBombBattleV4's rule). */
export function v4LevelsFor(dailyLevels, symbol, nowMs) {
  if (!dailyLevels || typeof dailyLevels !== 'object' || !dailyLevels.assets || typeof symbol !== 'string') return null;
  if (!finite(nowMs) || dailyLevels.date !== etDateOf(nowMs)) return null;
  const levels = dailyLevels.assets[symbol];
  return levels && typeof levels === 'object' ? levels : null;
}

// ── The rung's displayed price (BP-1, 2026-11-11) ───────────────────────────

/** Float slack for "already on a whole display unit": 1e-9 of the scaled price. */
export const RUNG_SHOWN_SLACK = 1e-9;

/**
 * BP-1 — A RUNG'S DISPLAYED PRICE, rounded in its AWARD direction at the
 * asset's display decimals, so every line that names it is true at that exact
 * number: an upside rung rounds UP (a price that reaches the shown number has
 * reached the exact target), a downside rung rounds DOWN (a price at or below
 * the shown number is at or below the exact target). A target already on a
 * whole display unit stays put, within float slack (1e-9 relative), so
 * 259.5300000001 and 280.91 (28091.000000000004 cents) print as themselves.
 * Every surface that prints a rung (the Fuse, the pills, the bar, the levels
 * table, the sheet line, the red-zone and Danger Zone goal tags) takes the
 * price from here (BUILD_RULES §9), and toGo / toGoDown measure from it. The
 * exact targets stay the record's: Details prints them, awards use them.
 *
 * Review A1 (2026-11-11): the printed price must pass the SCORER'S OWN float
 * comparison against the target it is drawn from (stockThresholdModel.js
 * crossedTiers: `high >= target` up, `low <= target` down). The slack keeps a
 * whole unit only when that unit passes; otherwise the price steps one unit
 * toward the award. So a target computed as 101.11000000000001 prints $101.12
 * on the upside (a check at $101.11 would not bank it), while 280.91 (a float
 * equal to the cent) still prints $280.91, and a Bust of 259.5300000001
 * still prints $259.53.
 * Returns a number at `decimals` places, or null.
 */
export function rungShown(rung, decimals) {
  if (!rung || !positive(rung.price) || !finite(rung.k) || rung.k === 0) return null;
  const d = finite(decimals) ? decimals : priceDecimals(rung.price);
  const scale = 10 ** d;
  const scaled = rung.price * scale;
  const whole = Math.round(scaled);
  const onUnit = Math.abs(scaled - whole) <= RUNG_SHOWN_SLACK * Math.abs(scaled);
  const at = (u) => Number((u / scale).toFixed(d));
  let units = onUnit ? whole : rung.k > 0 ? Math.ceil(scaled) : Math.floor(scaled);
  if (rung.k > 0) { while (at(units) < rung.price) units += 1; } else { while (at(units) > rung.price) units -= 1; }
  return at(units);
}

// ── Bricks and the distance to the next rung ───────────────────────────────

/**
 * The brick as a unit of distance (dollars): one sixth of the baseline → +1
 * threshold step. It exists whenever the ladder has its first rung, whether or
 * not the tier multipliers put every rung on a whole brick (that decides only
 * whether brick COUNTS and TICKS are drawn — brickPlan). The lead rule (BD-2)
 * measures both sides in this unit.
 */
export function brickUnit(ladder) {
  if (!ladder || ladder.status !== 'ok' || !ladder.baseline) return null;
  const first = ladder.up.find((r) => r.k === 1);
  if (!first) return null;
  const unit = (first.price - ladder.baseline.price) / BRICKS_PER_THRESHOLD;
  return unit > 0 ? unit : null;
}

/**
 * The brick as the to-go counts measure it: one sixth of the DISPLAYED first-rung
 * step (shown +1 rung − shown baseline), in the decimals the distance is shown in
 * (review A1: an exact unit against a displayed distance printed "7 bricks" at the
 * baseline for about half of all positions, to a rung drawn on brick 6). Falls
 * back to the exact unit when the displayed step is not positive (a sub-cent ladder).
 */
export function shownBrickUnit(ladder, decimals) {
  const exact = brickUnit(ladder);
  if (exact === null) return null;
  const first = ladder.up.find((r) => r.k === 1);
  const d = finite(decimals) ? decimals : priceDecimals(first.price);
  // BP-1: the displayed +1 rung is rungShown's (rounded up), like the distance it divides.
  const step = rungShown(first, d) - Number(priceText(ladder.baseline.price, d));
  return step > 0 ? step / BRICKS_PER_THRESHOLD : exact;
}

/**
 * The brick unit (dollars) and each rung's brick count on ONE side, or null when
 * bricks are omitted on that side. `brickPlan(ladder)` is the upside (BAGGER_TIERS,
 * unchanged); `brickPlan(ladder, BUST_TIERS)` the downside (BD-1: the same unit
 * serves both sides; if the bust multipliers ever stop sitting on whole bricks,
 * only the downside's ticks and counts are omitted).
 */
export function brickPlan(ladder, tiers = BAGGER_TIERS) {
  if (!ladder || ladder.status !== 'ok' || !bricksSupported(tiers)) return null;
  const unit = brickUnit(ladder);
  if (unit === null) return null;
  const side = tiers === BUST_TIERS ? ladder.down : ladder.up;
  const rungBricks = Object.fromEntries(side.map((r) => [r.key, Math.round(Math.abs(r.k) * BRICKS_PER_THRESHOLD)]));
  const counts = Object.values(rungBricks);
  if (!counts.length) return null;
  return { unit, rungBricks, total: Math.max(...counts) };
}

/**
 * The distance from the live price to the next unbanked upside rung, in
 * DISPLAYED values (BUILD_RULES §9): the rung (rungShown, rounded UP — BP-1)
 * and the live price (nearest) at the asset's display decimals first, and the
 * distance, the % (of the displayed live price) and the bricks (rounded UP) all
 * come from those two.
 */
export function toGo(ladder, live, { decimals = null, tiers = BAGGER_TIERS } = {}) {
  if (!ladder || ladder.status !== 'ok' || !ladder.next || !positive(live)) return null;
  const d = finite(decimals) ? decimals : priceDecimals(live);
  const shown = rungShown(ladder.next, d);
  const liveShown = Number(priceText(live, d));
  const distance = Number((shown - liveShown).toFixed(d));
  const pct = (distance / liveShown) * 100;
  // The % as the red zone prints it (two decimals) — the band is decided on
  // THIS number, so a displayed 0.50% enters (BUILD_RULES §9, rounds before zoning).
  const pctShown = Number(pct.toFixed(2));
  const plan = brickPlan(ladder, tiers);
  // Review A1 (2026-11-11): the brick is measured in DISPLAYED values too, like the
  // distance it divides (§9) — at the baseline the count then reads the rung's own 6.
  const unit = shownBrickUnit(ladder, d);
  const bricks = plan && unit !== null ? (distance > 0 ? Math.ceil(distance / unit - 1e-9) : 0) : null;
  // BD-2: the unrounded distance in bricks, for the lead rule (never shown).
  const bricksExact = unit !== null ? distance / unit : null;
  return { rung: ladder.next, rungShown: shown, liveShown, distance, pct, pctShown, bricks, bricksExact, decimals: d, side: 'up' };
}

/**
 * BD-1 — the mirror of toGo for the next unhit DOWNSIDE rung, in DISPLAYED
 * values (BUILD_RULES §9; the rung by rungShown, rounded DOWN — BP-1):
 * `distance = liveShown − rungShown`, positive while
 * the live price is above the rung; `distance ≤ 0` means at or below the rung,
 * and a check has not read it yet. `pct` is of the displayed live price and
 * `pctShown` its two-decimal print (the band decides on it, as upside); bricks
 * round UP. Null when nothing below is left unhit.
 */
export function toGoDown(ladder, live, { decimals = null, tiers = BUST_TIERS } = {}) {
  if (!ladder || ladder.status !== 'ok' || !ladder.nextDown || !positive(live)) return null;
  const d = finite(decimals) ? decimals : priceDecimals(live);
  const shown = rungShown(ladder.nextDown, d);
  const liveShown = Number(priceText(live, d));
  const distance = Number((liveShown - shown).toFixed(d));
  const pct = (distance / liveShown) * 100;
  const pctShown = Number(pct.toFixed(2));
  const plan = brickPlan(ladder, tiers);
  const unit = shownBrickUnit(ladder, d);
  const bricks = plan && unit !== null ? (distance > 0 ? Math.ceil(distance / unit - 1e-9) : 0) : null;
  const bricksExact = unit !== null ? distance / unit : null;
  return { rung: ladder.nextDown, rungShown: shown, liveShown, distance, pct, pctShown, bricks, bricksExact, decimals: d, side: 'down' };
}

/**
 * A rung's move from the baseline, in %. The Fuse, the bar and the levels table
 * all print it at two decimals through BOMB_COPY.rungPctText, so one rung reads
 * one string everywhere (BD-6).
 *
 * BP-3 (2026-11-11): THE RULE'S %. A ladder built from a threshold — a measured
 * position (the committed context's scoringPct, the % Details prints) or a
 * preview (the Bomb tab's threshold) — prints k × that threshold: AMZN's +15 is
 * +3.95 %, Details' "3.954943 %" at two decimals, not the +3.96 % worked back
 * from two rounded prices. A V4 ladder (levels given as prices) has no
 * threshold and keeps the move from the displayed baseline to the displayed
 * level (rungShown). To-go %s are unchanged: they come from displayed values.
 */
export function rungPct(ladder, rung, decimals) {
  if (!ladder || ladder.status !== 'ok' || !rung || !positive(rung.price)) return null;
  if (positive(ladder.threshold) && finite(rung.k)) return rung.k * ladder.threshold;
  const d = finite(decimals) ? decimals : priceDecimals(rung.price);
  const base = Number(priceText(ladder.baseline.price, d));
  const shown = rungShown(rung, d);
  return base > 0 && shown !== null ? ((shown - base) / base) * 100 : null;
}

/** BD-2: how much nearer (in bricks) the other side must be before the lead moves. */
export const LEAD_BAND_BRICKS = 1;

/**
 * BD-2 — THE LEAD SIDE, with a one-brick band so a flat stock does not flicker.
 * Pure. `up` / `down` are the unrounded brick distances to each side's next
 * rung (toGo / toGoDown `bricksExact`; null when that side has no next rung).
 *
 *   first look (prev null)   the nearer side leads; a tie goes up
 *   after that               the lead moves only when the other side is at least
 *                            one brick nearer: other ≤ lead − 1
 *   a side with no next rung never leads; both null → no lead (null)
 *   zone 'red'               the upside leads; zone 'danger' the downside leads
 *
 * @param {'up'|'down'|null} prev
 * @param {{ up: number|null, down: number|null, zone?: 'red'|'danger'|null }} input
 * @returns {'up'|'down'|null}
 */
export function stepLead(prev, { up = null, down = null, zone = null } = {}) {
  const u = finite(up) ? up : null;
  const dn = finite(down) ? down : null;
  if (u === null && dn === null) return null;
  if (u === null) return 'down';
  if (dn === null) return 'up';
  if (zone === 'red') return 'up';
  if (zone === 'danger') return 'down';
  if (prev === 'up') return dn <= u - LEAD_BAND_BRICKS ? 'down' : 'up';
  if (prev === 'down') return u <= dn - LEAD_BAND_BRICKS ? 'up' : 'down';
  return dn < u ? 'down' : 'up';
}

/** Where the live price sits, in multiples of the threshold from the baseline (the Fuse's vertical unit). */
export function kOf(ladder, price) {
  if (!ladder || ladder.status !== 'ok' || !positive(price)) return null;
  const first = ladder.up.find((r) => r.k === 1);
  const step = first ? first.price - ladder.baseline.price : null;
  if (!(step > 0)) return null;
  return (price - ladder.baseline.price) / step;
}
