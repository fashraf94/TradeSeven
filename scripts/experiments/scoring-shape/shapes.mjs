// scripts/experiments/scoring-shape/shapes.mjs
//
// THE SHAPES (prompt §5), evaluated per hold. Shared by Steps 3–5.
//
// A shape decides only WHICH prices may bank a tier. For a hold with fill F (the entry open) and unit u, the real
// model (stockRewardContext, via lib.crossed) is asked, for each session j of the hold:
//   touch[j] — the tiers crossed by the highs/lows of sessions 0..j        (S1, and every shape's penalties)
//   close[j] — the tiers crossed by session j's close alone
// and every shape's banked set is a union of those answers. Points come from the fenced scorer (lib.points).
//
//   S1 touch          bonus tiers: touch[2];                    penalties: touch[2]
//   S2 exit only      bonus tiers: close[2] (held to the end);  penalties: touch[2]
//   S3 at the bell    bonus tiers: close[0] ∪ close[1] ∪ close[2]; penalties: touch[2]
//   S4 S3 + carry     S3, plus C for every session close beyond +1.0 (each j with 'bagger' ∈ close[j])
//   S5 daily reset    the one-day unit, levels re-anchored each session: B0 = the prior close (the prompt's letter;
//                     the legacy anchor B0 = the fill is the variant), B1 = close 0, B2 = close 1. Each day's tiers
//                     bank again: on touch (S5t, the dormant legacy behaviour) or at the close (S5c). Penalties are
//                     measured from the day's anchor and bank on touch.
//
// READING (stated in the report, put to the founder): the prompt's table redefines when a BONUS banks; penalties keep
// today's rule (on touch) in every shape. The sensitivity "penalties follow the bonus rule" is reported beside it.

import { BONUS_KEYS, CONVICTION_TIERS, crossed, levelsOf, legacyDay, PENALTY_KEYS, points, unitOf } from './lib.mjs';

const isBonus = (t) => BONUS_KEYS.includes(t);
const isPenalty = (t) => PENALTY_KEYS.includes(t);
const union = (...sets) => [...new Set(sets.flat())];

/** The per-session answers of the real model for one hold, anchored at the fill. */
export function pathSets(h, u) {
  const F = h.p[0][0];
  const touch = [], close = [];
  let maxH = -Infinity, minL = Infinity;
  for (let j = 0; j < h.p.length; j++) {
    const [, H, L, C] = h.p[j];
    maxH = Math.max(maxH, H);
    minL = Math.min(minL, L);
    touch.push(crossed(F, u, { high: maxH, low: minL, price: C }));
    close.push(crossed(F, u, { high: C, low: C, price: C }));
  }
  return { F, touch, close };
}

/** The first session (0-based) on which `tier` is in sets[j], else -1. */
export const firstDay = (sets, tier) => sets.findIndex((s) => s.includes(tier));

/** Banked sets of the held-to-end shapes S1–S4, plus the penalties-at-close sensitivity. */
export function heldShapes(ps) {
  const last = ps.touch.length - 1;
  const pen = ps.touch[last].filter(isPenalty);
  const bellBonus = union(...ps.close).filter(isBonus);
  return {
    S1: ps.touch[last],
    S2: union(ps.close[last].filter(isBonus), pen),
    S3: union(bellBonus, pen),
    carries: ps.close.filter((s) => s.includes('bagger')).length,
    carryDays: ps.close.map((s, j) => (s.includes('bagger') ? j : -1)).filter((j) => j >= 0),
    // Sensitivity: penalties bank by the shape's own bonus rule.
    S2penAtClose: ps.close[last].filter(isPenalty),
    S3penAtClose: union(...ps.close).filter(isPenalty),
  };
}

/** The session each banked tier banks on, per shape (for scoring moments). */
export function bankDays(ps, shape, banked) {
  const last = ps.touch.length - 1;
  return banked.map((t) => {
    if (isPenalty(t) || shape === 'S1') return { t, day: firstDay(ps.touch, t) };
    if (shape === 'S2') return { t, day: last };
    return { t, day: firstDay(ps.close, t) }; // S3, S4
  });
}

/** Points at each conviction tier for a banked set sold/held at `price` (the scorer's own rounding). */
export function tierPoints(F, u, price, banked) {
  return Object.fromEntries(CONVICTION_TIERS.map((c) => [c, points(F, u, c, price, banked)]));
}

/** S5, the daily reset, with the one-day unit frozen at entry. Returns per-day sets and the levels of banked bonuses. */
export function dailyReset(h, { anchor = 'prior_close' } = {}) {
  const u1 = unitOf(h, 'U1');
  const F = h.p[0][0];
  const anchors = [anchor === 'prior_close' ? h.pc : F, h.p[0][3], h.p[1][3]].slice(0, h.p.length);
  const days = h.p.map(([, H, L, C], j) => {
    const B = anchors[j];
    const touch = crossed(B, u1, { high: H, low: L, price: C });
    const close = crossed(B, u1, { high: C, low: C, price: C });
    return { B, H, L, C, touch, close, levels: levelsOf(B, u1) };
  });
  return { u1, F, days };
}

/** S5's banked sets per day for a variant: 't' = on touch (legacy), 'c' = bonuses at the close, penalties on touch. */
export function dailyBanked(day, variant) {
  return variant === 't' ? day.touch : union(day.close.filter(isBonus), day.touch.filter(isPenalty));
}

/** Points of a S5 path at each conviction tier: base from the fill to `price`, plus each day's banked tiers. */
export function dailyPoints(F, u1, price, dayBankedSets) {
  // A tier's points are flat (not scaled by conviction), so each day's set is priced once.
  const bonus = dayBankedSets.reduce((n, s) => n + (s.length ? points(F, u1, 'support', F, s).bonus : 0), 0);
  return Object.fromEntries(CONVICTION_TIERS.map((c) => {
    const base = points(F, u1, c, price, []);
    return [c, { total: base.total + bonus, base: base.base, bonus }];
  }));
}

/** Cross-check: the legacy scorer's own nightly badges for S5t, day by day (agent-daily-scores.js path). */
export function legacyAgrees(s5) {
  return s5.days.every((d) => {
    const r = legacyDay({ fill: s5.F, baseline: d.B, unitPct: s5.u1.scoringPct, conviction: 'support', close: d.C, high: d.H, low: d.L });
    const a = [...r.badges].sort().join(','), b = [...d.touch].sort().join(',');
    return a === b;
  });
}

export { isBonus, isPenalty, union };
