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
//   down: [rung] (k desc), next: rung | null, bankedPoints }
// rung: { key, label, emoji, points, k, price, banked }

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
  return { status: reason, rungs: [], up: [], down: [], next: null, bankedPoints: 0, ...extra };
}

function finish(ladder) {
  const up = ladder.rungs.filter((r) => r.k > 0).sort((a, b) => a.k - b.k);
  const down = ladder.rungs.filter((r) => r.k < 0).sort((a, b) => b.k - a.k);
  const next = up.find((r) => !r.banked) || null;
  const bankedPoints = up.filter((r) => r.banked).reduce((n, r) => n + r.points, 0);
  return { ...ladder, up, down, next, bankedPoints };
}

const rungOf = (t, price, banked) => ({ key: t.key, label: t.label, emoji: t.emoji, points: t.points, k: t.k, price, banked: banked === true });

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
    rungs,
  });
}

/**
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
    rungs,
  });
}

/** Not held (BA-1, spec §3.7): one baseline — yesterday's close — × the threshold the Bomb tab uses. */
export function previewLadder({ previousClose, threshold } = {}) {
  if (!positive(previousClose) || !positive(threshold)) return unavailable('preview_unavailable', { kind: 'preview', model: 'preview' });
  const rungs = TIERS.map((t) => rungOf(t, previousClose * (1 + (t.k * threshold) / 100), false));
  return finish({ status: 'ok', kind: 'preview', model: 'preview', baseline: { price: previousClose, source: 'previous_close', atMs: null }, rungs });
}

/** The V4 cron's level names per tier (compute-daily-baggerbomb-levels; BaggerBombTab cronTargetMap). */
export const V4_LEVEL_KEYS = Object.freeze({ bagger: 'baggerBomb', doubleBagger: 'doubleBagger', tenBagger: 'tenBagger', bust: 'bust', crash: 'crash', meltdown: 'meltdown' });

/** A V4 battle's state.dailyLevels.assets[SYM] (spec §3.7): those levels and that baseline. Nothing banked (a preview). */
export function v4Ladder({ levels } = {}) {
  if (!levels || !positive(levels.baseline)) return unavailable('preview_unavailable', { kind: 'preview', model: 'v4' });
  const rungs = TIERS.map((t) => rungOf(t, levels[V4_LEVEL_KEYS[t.key]], false));
  if (rungs.some((r) => !positive(r.price))) return unavailable('preview_unavailable', { kind: 'preview', model: 'v4' });
  return finish({ status: 'ok', kind: 'preview', model: 'v4', baseline: { price: levels.baseline, source: 'daily_levels', atMs: null }, rungs });
}

/** A V4 battle's levels for one symbol, only when they are TODAY's (useBaggerBombBattleV4's rule). */
export function v4LevelsFor(dailyLevels, symbol, nowMs) {
  if (!dailyLevels || typeof dailyLevels !== 'object' || !dailyLevels.assets || typeof symbol !== 'string') return null;
  if (!finite(nowMs) || dailyLevels.date !== etDateOf(nowMs)) return null;
  const levels = dailyLevels.assets[symbol];
  return levels && typeof levels === 'object' ? levels : null;
}

// ── Bricks and the distance to the next rung ───────────────────────────────

/** The brick unit (dollars) and each upside rung's brick count, or null when bricks are omitted. */
export function brickPlan(ladder, tiers = BAGGER_TIERS) {
  if (!ladder || ladder.status !== 'ok' || !bricksSupported(tiers)) return null;
  const first = ladder.up.find((r) => r.k === 1);
  if (!first) return null;
  const unit = (first.price - ladder.baseline.price) / BRICKS_PER_THRESHOLD;
  if (!(unit > 0)) return null;
  const rungBricks = Object.fromEntries(ladder.up.map((r) => [r.key, Math.round(r.k * BRICKS_PER_THRESHOLD)]));
  return { unit, rungBricks, total: Math.max(...Object.values(rungBricks)) };
}

/**
 * The distance from the live price to the next unbanked upside rung, in
 * DISPLAYED values (BUILD_RULES §9): the rung and the live price are rounded to
 * the asset's display decimals first, and the distance, the % (of the
 * displayed live price) and the bricks (rounded UP) all come from those two.
 */
export function toGo(ladder, live, { decimals = null, tiers = BAGGER_TIERS } = {}) {
  if (!ladder || ladder.status !== 'ok' || !ladder.next || !positive(live)) return null;
  const d = finite(decimals) ? decimals : priceDecimals(live);
  const rungShown = Number(priceText(ladder.next.price, d));
  const liveShown = Number(priceText(live, d));
  const distance = Number((rungShown - liveShown).toFixed(d));
  const pct = (distance / liveShown) * 100;
  const plan = brickPlan(ladder, tiers);
  const bricks = plan ? (distance > 0 ? Math.ceil(distance / plan.unit - 1e-9) : 0) : null;
  return { rung: ladder.next, rungShown, liveShown, distance, pct, bricks, decimals: d };
}

/** Where the live price sits, in multiples of the threshold from the baseline (the Fuse's vertical unit). */
export function kOf(ladder, price) {
  if (!ladder || ladder.status !== 'ok' || !positive(price)) return null;
  const first = ladder.up.find((r) => r.k === 1);
  const step = first ? first.price - ladder.baseline.price : null;
  if (!(step > 0)) return null;
  return (price - ladder.baseline.price) / step;
}
