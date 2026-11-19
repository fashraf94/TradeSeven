#!/usr/bin/env node
// scripts/experiments/scoring-shape/step4SnapExit.mjs
//
// STEP 4 — the snap-exit test (prompt §6). For every three-session hold that reaches its +1.0 line (first on
// session d, found by the real model on the daily highs), three policies under each shape:
//   SELL — sold AT the line on session d: base points at the line plus what the shape banks; the slot holds cash.
//   BELL — held to the close of session d; sold there if that close is still beyond the line, else held to the end.
//   HOLD — held to the end of the match.
// S1–S4 use the entry-anchored line with each unit (U1, U4, U6, the recommended unit). S5 (one-day unit, levels
// re-anchored daily, anchor = the prior close) uses its own daily +1.0 line.
//
// What SELL banks: the +1.0 tier (sold at the line, equality crosses), plus penalties touched before the sale. On
// session d itself daily bars cannot order the high and the low; the primary rule reads the bar as O→L→H→C when it
// closed at or above its open (the low came first, so a penalty that day counts) and O→H→L→C otherwise. The two
// bounds ('always' / 'never' count that day's penalty) are run as variants. A gap through the line (session d opens
// beyond it) cannot fill at the line; the prompt's SELL assumes it does, and a fill-at-the-open variant is run.
// S4 + BELL: the plain reading lets the close BELL sells at earn its carry (it is a session close beyond the line
// while held; the rule withholds C only from a tier banked by selling DURING the session). The other reading is run.
//
// Points at Support (conviction 1.0) are the primary; Star (2.0) is the check — bonuses are flat, base points scale.
//
// USAGE: node scripts/experiments/scoring-shape/step4SnapExit.mjs [--out <dir>] [--long]

import path from 'node:path';
import { CARRY_VALUES, crossed, fx, levelsOf, loadHolds, mdTable, mean, median, mulberry32, outDirOf, quantile, readJson, RNG_SEED, suffixOf, unitOf, windowOf, writeJson } from './lib.mjs';
import { dailyBanked, dailyPoints, dailyReset, firstDay, isBonus, isPenalty, pathSets, tierPoints, union } from './shapes.mjs';

const argv = process.argv;
const out = outDirOf(argv);
const WINDOW = windowOf(argv);
const SUFFIX = suffixOf(WINDOW);
const { holds } = loadHolds(out, { window: WINDOW });
const REC = readJson(path.join(out, `step2-units${SUFFIX}.json`)).recommendation.recommended;
const UNITS = [...new Set(['U1', 'U4', 'U6', REC])];
const TIERS = ['support', 'star'];

// CHECK-PRICED SENSITIVITY (review B1). The primary sells at the line on a session whose DAILY high reached it. A real
// seller acts only at a 15-minute check, which may never see a line the high barely reached, and which, when it does,
// sells past the line. From the film tape (touchGap.mjs, touch-gap.json):
//   - shortfallUnits.high: how far the day's high sits above the highest check, in one-day units (128 sessions);
//   - checkOvershootUnits.mean: how far past the line the first check at or beyond it sits (23 sessions).
// Each non-gap case gets weight w = the share of tape sessions whose shortfall is at most the case's excess (the day's
// high above the line, in one-day units) — the chance a check sees the line. Two pricings of that sale:
//   'checkLine'   — at the line (weights only);
//   'checkPriced' — at min(line + overshoot, the highest check) averaged over the tape sessions that see it. Within that
//                   band the banked set never changes (the next tier is ≥ 0.5 one-day units above the line), so the
//                   fenced scorer is called once, at the mean sale price.
// A gap through the line is seen by the first check and sold at the open (weight 1) under both.
const TAPE = readJson(path.join(out, 'touch-gap.json'));
const SHORTFALL = TAPE.shortfallUnits.high;
const OVERSHOOT = TAPE.checkOvershootUnits.mean;
/** Check-priced SELL for a non-gap case: { w, line: pts, priced: pts } (pts per conviction tier, from the scorer). */
function checkSale(F, u, unitD, T1, high, pen) {
  const excess = (high - T1) / unitD;
  const seen = SHORTFALL.filter((x) => x <= excess);
  if (!seen.length) return { w: 0, line: null, priced: null };
  const meanPrice = seen.reduce((a, x) => a + Math.min(T1 + OVERSHOOT * unitD, high - x * unitD), 0) / seen.length;
  const set = union(['bagger'], pen);
  return { w: seen.length / SHORTFALL.length, line: tierPoints(F, u, T1, set), priced: tierPoints(F, u, meanPrice, set) };
}

/** Penalties SELL carries: those touched before session d, plus session d's own if the ordering puts the low first. */
function sellPenalties(touch, d, bar, ordering) {
  const before = d > 0 ? touch[d - 1].filter(isPenalty) : [];
  const today = touch[d].filter((t) => isPenalty(t) && !before.includes(t));
  const [o, , , c] = bar;
  const lowFirst = ordering === 'always' ? true : ordering === 'never' ? false : c >= o;
  return { pen: union(before, lowFirst ? today : []), before, sameDay: today.length > 0 };
}

const cases = []; // one per (hold, shape-unit) that reaches the line
const counts = {};
holds.forEach((h) => {
  const F = h.p[0][0];
  const end = h.p[2][3];
  // The one-session baseline (prompt §5: "the one-session game on V2 as the baseline for every table"): SELL at the
  // +1.0 line against holding to the session's close, with V2's unit. On one session BELL and HOLD are the same sale.
  {
    const u1 = unitOf(h, 'U1');
    const ps1 = pathSets({ ...h, p: [h.p[0]] }, u1);
    if (ps1.touch[0].includes('bagger')) {
      const T1 = levelsOf(F, u1).bagger;
      const c = (counts.D1 ||= { reach: 0, byDay: [0, 0, 0], sameDayPenalty: 0, gapThrough: 0 });
      c.reach++; c.byDay[0]++;
      const pts = {};
      for (const ordering of ['primary', 'always', 'never']) {
        const sp = sellPenalties(ps1.touch, 0, h.p[0], ordering);
        if (ordering === 'primary' && sp.sameDay) c.sameDayPenalty++;
        pts[`sell-${ordering}`] = tierPoints(F, u1, T1, union(['bagger'], sp.pen));
      }
      const held1 = { S1: ps1.touch[0], S2: union(ps1.close[0].filter(isBonus), ps1.touch[0].filter(isPenalty)) };
      for (const s of ['S1', 'S2']) { pts[`hold-${s}`] = tierPoints(F, u1, h.p[0][3], held1[s]); pts[`bell-${s}`] = pts[`hold-${s}`]; }
      // Variant (review A3): penalties bank at the close too. A sale at the line is above every penalty level.
      pts['sell-pc-S2'] = tierPoints(F, u1, T1, ['bagger']);
      pts['hold-S2-pc'] = tierPoints(F, u1, h.p[0][3], union(ps1.close[0].filter(isBonus), ps1.close[0].filter(isPenalty)));
      pts['bell-S2-pc'] = pts['hold-S2-pc'];
      const cs1 = checkSale(F, u1, F * u1.scoringPct / 100, T1, h.p[0][1], sellPenalties(ps1.touch, 0, h.p[0], 'primary').pen);
      pts['sell-checkLine'] = cs1.line; pts['sell-checkPriced'] = cs1.priced;
      cases.push({ id: 'D1', entry: h.d, d: 0, gapThrough: false, bellSells: false, pts, carriesHeld: 0, carriesBell: 0, checkW: cs1.w });
    }
  }
  for (const id of UNITS) {
    const u = unitOf(h, id);
    const ps = pathSets(h, u);
    const d = firstDay(ps.touch, 'bagger');
    if (d < 0) continue;
    const T1 = levelsOf(F, u).bagger;
    const bar = h.p[d];
    const gapThrough = d > 0 && bar[0] >= T1;
    const c = (counts[id] ||= { reach: 0, byDay: [0, 0, 0], sameDayPenalty: 0, gapThrough: 0 });
    c.reach++; c.byDay[d]++;
    const bellSells = ps.close[d].includes('bagger');
    const last = 2;
    const held = {
      S1: ps.touch[last], S2: union(ps.close[last].filter(isBonus), ps.touch[last].filter(isPenalty)),
      S3: union(...ps.close.map((s) => s.filter(isBonus)), ps.touch[last].filter(isPenalty)),
    };
    const bell = {
      S1: ps.touch[d], S2: union(ps.close[d].filter(isBonus), ps.touch[d].filter(isPenalty)),
      S3: union(...ps.close.slice(0, d + 1).map((s) => s.filter(isBonus)), ps.touch[d].filter(isPenalty)),
    };
    const carriesHeld = ps.close.filter((s) => s.includes('bagger')).length;
    const carriesBell = ps.close.slice(0, d + 1).filter((s) => s.includes('bagger')).length;
    const pts = {};
    for (const ordering of ['primary', 'always', 'never']) {
      const sp = sellPenalties(ps.touch, d, bar, ordering);
      if (ordering === 'primary' && sp.sameDay) c.sameDayPenalty++;
      pts[`sell-${ordering}`] = tierPoints(F, u, T1, union(['bagger'], sp.pen));
    }
    if (gapThrough) {
      c.gapThrough++;
      const atOpen = crossed(F, u, { high: bar[0], low: F, price: bar[0] }).filter(isBonus);
      pts['sell-open'] = tierPoints(F, u, bar[0], union(atOpen, sellPenalties(ps.touch, d, bar, 'never').before));
    }
    for (const s of ['S1', 'S2', 'S3']) {
      pts[`hold-${s}`] = tierPoints(F, u, end, held[s]);
      pts[`bell-${s}`] = bellSells ? tierPoints(F, u, bar[3], bell[s]) : pts[`hold-${s}`];
    }
    // Variant (review A3): penalties bank by the shape's own bonus rule — S2 at the exit, S3 at any close (kept).
    const closeSet = (from, to) => union(...ps.close.slice(from, to).map((s) => s.filter(isBonus)), ...ps.close.slice(from, to).map((s) => s.filter(isPenalty)));
    pts['sell-pc-S2'] = tierPoints(F, u, T1, ['bagger']);
    pts['sell-pc-S3'] = tierPoints(F, u, T1, union(['bagger'], ...ps.close.slice(0, d).map((s) => s.filter(isPenalty))));
    pts['hold-S2-pc'] = tierPoints(F, u, end, union(ps.close[last].filter(isBonus), ps.close[last].filter(isPenalty)));
    pts['hold-S3-pc'] = tierPoints(F, u, end, closeSet(0, last + 1));
    pts['bell-S2-pc'] = bellSells ? tierPoints(F, u, bar[3], union(ps.close[d].filter(isBonus), ps.close[d].filter(isPenalty))) : pts['hold-S2-pc'];
    pts['bell-S3-pc'] = bellSells ? tierPoints(F, u, bar[3], closeSet(0, d + 1)) : pts['hold-S3-pc'];
    // Check-priced sensitivity: the one-day unit sets the shortfall scale (the tape's units), whatever the line's unit.
    let checkW = 1;
    if (gapThrough) { pts['sell-checkLine'] = pts['sell-open']; pts['sell-checkPriced'] = pts['sell-open']; }
    else {
      const cs = checkSale(F, u, F * unitOf(h, 'U1').scoringPct / 100, T1, bar[1], sellPenalties(ps.touch, d, bar, 'primary').pen);
      pts['sell-checkLine'] = cs.line; pts['sell-checkPriced'] = cs.priced; checkW = cs.w;
    }
    cases.push({ id, entry: h.d, d, gapThrough, bellSells, pts, carriesHeld, carriesBell, checkW });
  }
  // S5: the daily reset, anchor = the prior close (the prompt's letter), one-day unit.
  const s5 = dailyReset(h, { anchor: 'prior_close' });
  const d = s5.days.findIndex((x) => x.touch.includes('bagger'));
  if (d >= 0) {
    const day = s5.days[d];
    const T = day.levels.bagger;
    const c = (counts.S5 ||= { reach: 0, byDay: [0, 0, 0], sameDayPenalty: 0, gapThrough: 0, lineBelowFill: [0, 0, 0] });
    c.reach++; c.byDay[d]++;
    const gapThrough = h.p[d][0] >= T;
    if (gapThrough) c.gapThrough++;
    // The line sits below the fill on session 1 only when the stock gapped through it at the open (the open is the
    // fill); on sessions 2–3 it means the position was more than a unit under water at the prior close (review C4).
    if (T < F) c.lineBelowFill[d]++;
    const pts = {};
    for (const v of ['t', 'c']) {
      const before = s5.days.slice(0, d).map((x) => dailyBanked(x, v));
      const todayPen = day.touch.filter(isPenalty);
      const [o, , , cl] = h.p[d];
      for (const ordering of ['primary', 'always', 'never']) {
        const lowFirst = ordering === 'always' ? true : ordering === 'never' ? false : cl >= o;
        if (v === 't' && ordering === 'primary' && todayPen.length) c.sameDayPenalty++;
        pts[`sell-${ordering}-S5${v}`] = dailyPoints(F, s5.u1, T, [...before, union(['bagger'], lowFirst ? todayPen : [])]);
      }
      if (gapThrough) pts[`sell-open-S5${v}`] = dailyPoints(F, s5.u1, o, [...before, union(crossed(day.B, s5.u1, { high: o, low: day.B, price: o }).filter(isBonus))]);
      const all = s5.days.map((x) => dailyBanked(x, v));
      pts[`hold-S5${v}`] = dailyPoints(F, s5.u1, end, all);
      pts[`bell-S5${v}`] = day.close.includes('bagger') ? dailyPoints(F, s5.u1, cl, all.slice(0, d + 1)) : pts[`hold-S5${v}`];
    }
    // Variant (review A3), S5 at each close: each day's penalties at that day's close too.
    {
      const pc = s5.days.map((x) => union(x.close.filter(isBonus), x.close.filter(isPenalty)));
      const [o, , , cl] = h.p[d];
      pts['sell-pc-S5c'] = dailyPoints(F, s5.u1, T, [...pc.slice(0, d), ['bagger']]);
      if (gapThrough) pts['sell-open-pc-S5c'] = dailyPoints(F, s5.u1, o, [...pc.slice(0, d), crossed(day.B, s5.u1, { high: o, low: day.B, price: o }).filter(isBonus)]);
      pts['hold-S5c-pc'] = dailyPoints(F, s5.u1, end, pc);
      pts['bell-S5c-pc'] = day.close.includes('bagger') ? dailyPoints(F, s5.u1, cl, pc.slice(0, d + 1)) : pts['hold-S5c-pc'];
    }
    cases.push({ id: 'S5', entry: h.d, d, gapThrough, pts });
  }
});

/** The three policies' points for one case, shape, conviction tier and variant.
 *  S5, session 1, gap through the line (review C2b): the line sits below the fill and no post-entry price at the line
 *  came first — the snap seller's first chance is the fill itself, so the PRIMARY prices that sale at the open.
 *  `s5Day1AtLine` restores the line price as a variant; `open` prices every gap-through at the open. */
function policyPoints(cs, shape, tier, { ordering = 'primary', open = false, carry = 0, bellCarry = true, s5Day1AtLine = false, penAtClose = false, check = null } = {}) {
  // Variant: penalties bank by the shape's bonus rule (S1 and S5 on touch already bank everything on touch).
  if (penAtClose && shape === 'S5c') {
    const atOpen = cs.gapThrough && (open || (cs.d === 0 && !s5Day1AtLine));
    return { SELL: cs.pts[atOpen ? 'sell-open-pc-S5c' : 'sell-pc-S5c'][tier].total, BELL: cs.pts['bell-S5c-pc'][tier].total, HOLD: cs.pts['hold-S5c-pc'][tier].total };
  }
  if (penAtClose && ['S2', 'S3', 'S4'].includes(shape)) {
    const b = shape === 'S4' ? 'S3' : shape;
    const bellCarries = cs.bellSells ? (bellCarry ? cs.carriesBell : cs.carriesBell - 1) : cs.carriesHeld;
    return { SELL: cs.pts[`sell-pc-${b}`][tier].total, BELL: cs.pts[`bell-${b}-pc`][tier].total + carry * bellCarries, HOLD: cs.pts[`hold-${b}-pc`][tier].total + carry * cs.carriesHeld };
  }
  if (shape.startsWith('S5')) {
    const atOpen = cs.gapThrough && (open || (cs.d === 0 && !s5Day1AtLine));
    const sellKey = atOpen ? `sell-open-${shape}` : `sell-${ordering}-${shape}`;
    return { SELL: cs.pts[sellKey][tier].total, BELL: cs.pts[`bell-${shape}`][tier].total, HOLD: cs.pts[`hold-${shape}`][tier].total };
  }
  const base = shape === 'S4' ? 'S3' : shape;
  const sell = (check ? cs.pts[`sell-${check}`] : open && cs.gapThrough ? cs.pts['sell-open'] : cs.pts[`sell-${ordering}`])?.[tier].total ?? 0;
  const bellCarries = cs.bellSells ? (bellCarry ? cs.carriesBell : cs.carriesBell - 1) : cs.carriesHeld;
  return { SELL: sell, BELL: cs.pts[`bell-${base}`][tier].total + carry * bellCarries, HOLD: cs.pts[`hold-${base}`][tier].total + carry * cs.carriesHeld };
}

/** A case's weight: 1, or under the check-priced sensitivity the chance a 15-minute check sees its line. */
const weightOf = (cs, opts) => (opts?.check ? cs.checkW ?? 1 : 1);
function evaluate(list, shape, tier, opts) {
  if (opts?.check) list = list.filter((cs) => weightOf(cs, opts) > 0);
  const W = list.map((cs) => weightOf(cs, opts));
  const rows = list.map((cs) => policyPoints(cs, shape, tier, opts));
  const best = { SELL: 0, BELL: 0, HOLD: 0 }, strict = { SELL: 0, BELL: 0, HOLD: 0 };
  let bellEqHold = 0, sellGtHold = 0;
  rows.forEach((r, i) => {
    const w = W[i];
    const top = Math.max(r.SELL, r.BELL, r.HOLD);
    const winners = Object.keys(r).filter((k) => r[k] === top);
    for (const x of winners) best[x] += w / winners.length;
    if (winners.length === 1) strict[winners[0]] += w;
    if (r.BELL === r.HOLD) bellEqHold += w;
    if (r.SELL > r.HOLD) sellGtHold += w;
  });
  const P = ['SELL', 'BELL', 'HOLD'];
  const n = rows.length;
  const Wsum = W.reduce((a, b) => a + b, 0);
  const means = Object.fromEntries(P.map((k) => [k, n ? rows.reduce((a, r, i) => a + W[i] * r[k], 0) / Wsum : NaN]));
  // No winner for an empty subset (review C6: an empty by-day cell used to read 'SELL').
  const winner = n ? P.reduce((a, b) => (means[b] > means[a] ? b : a)) : null;
  const runnerUp = Math.max(...P.filter((k) => k !== 'SELL').map((k) => means[k]));
  const share = (x) => (n ? x / Wsum : NaN);
  return { n, seenShare: n ? Wsum / n : NaN, means, medians: Object.fromEntries(P.map((k) => [k, median(rows.map((r) => r[k]))])),
    bestShare: Object.fromEntries(P.map((k) => [k, share(best[k])])), strictBestShare: Object.fromEntries(P.map((k) => [k, share(strict[k])])),
    bellEqHoldShare: share(bellEqHold), sellBeatsHoldShare: share(sellGtHold), winner, sellMargin: n ? means.SELL - runnerUp : NaN };
}

const SHAPE_UNITS = [{ s: 'S1', id: 'D1' }, { s: 'S2', id: 'D1' }, ...UNITS.flatMap((id) => ['S1', 'S2', 'S3', ...CARRY_VALUES.map((c) => `S4C${c}`)].map((s) => ({ s, id }))), { s: 'S5t', id: 'S5' }, { s: 'S5c', id: 'S5' }];
const shapeOf = (s) => (s.startsWith('S4') ? 'S4' : s);
const carryOf = (s) => (s.startsWith('S4C') ? Number(s.slice(3)) : 0);
const label = ({ s, id }) => (id === 'S5' ? `${s} (one-day unit)` : id === 'D1' ? `one-session game ${s}-U1 (BELL = HOLD)` : `${s.replace(/^S4C(\d+)$/, 'S4 C=$1')}-${id}`);

/** Session-clustered block bootstrap (seeded, 2,000 draws): 90% intervals for the mean SELL − HOLD, SELL − BELL and
 *  SELL − next best per position, and the share of draws in which SELL is the best policy on average.
 *  Holds entered on the same day move together, so whole entry SESSIONS are resampled, not holds. Sessions are not
 *  independent either: consecutive entries share two of their three sessions (review A8, B3), so the resample is built
 *  from circular blocks of BOOT_BLOCK consecutive entry sessions. */
const BOOT_DRAWS = 2000;
const BOOT_BLOCK = 3;
function bootstrap(list, shape, tier, opts) {
  const bySession = new Map();
  for (const cs of list) {
    const w = weightOf(cs, opts);
    if (!w) continue;
    const r = policyPoints(cs, shape, tier, opts);
    const s = bySession.get(cs.entry) || { n: 0, S: 0, B: 0, H: 0 };
    s.n += w; s.S += w * r.SELL; s.B += w * r.BELL; s.H += w * r.HOLD;
    bySession.set(cs.entry, s);
  }
  const sess = [...bySession.keys()].sort().map((k) => bySession.get(k));
  const rng = mulberry32(RNG_SEED + 1);
  const dh = [], db = [], dn = [];
  let sellBest = 0;
  for (let i = 0; i < BOOT_DRAWS; i++) {
    let n = 0, S = 0, B = 0, H = 0;
    for (let taken = 0; taken < sess.length;) {
      const start = Math.floor(rng() * sess.length);
      for (let k = 0; k < BOOT_BLOCK && taken < sess.length; k++, taken++) { const s = sess[(start + k) % sess.length]; n += s.n; S += s.S; B += s.B; H += s.H; }
    }
    dh.push((S - H) / n); db.push((S - B) / n); dn.push((S - Math.max(B, H)) / n);
    if (S > B && S > H) sellBest++;
  }
  return { sessions: sess.length, sellMinusHold: [quantile(dh, 0.05), quantile(dh, 0.95)], sellMinusBell: [quantile(db, 0.05), quantile(db, 0.95)],
    sellMinusNext: [quantile(dn, 0.05), quantile(dn, 0.95)], sellBestShare: sellBest / BOOT_DRAWS };
}

const results = [];
for (const su of SHAPE_UNITS) {
  const list = cases.filter((c) => c.id === su.id);
  for (const tier of TIERS) {
    const base = { shape: shapeOf(su.s), carry: carryOf(su.s) };
    const opts = { carry: base.carry };
    const main = evaluate(list, su.s.startsWith('S5') ? su.s : base.shape, tier, opts);
    const byDay = [0, 1, 2].map((d) => evaluate(list.filter((c) => c.d === d), su.s.startsWith('S5') ? su.s : base.shape, tier, opts));
    const variants = {
      orderingAlways: evaluate(list, su.s.startsWith('S5') ? su.s : base.shape, tier, { ...opts, ordering: 'always' }).winner,
      orderingNever: evaluate(list, su.s.startsWith('S5') ? su.s : base.shape, tier, { ...opts, ordering: 'never' }).winner,
      gapFillAtOpen: evaluate(list, su.s.startsWith('S5') ? su.s : base.shape, tier, { ...opts, open: true }).winner,
      ...(base.shape === 'S4' ? { s4BellNoCarry: evaluate(list, 'S4', tier, { ...opts, bellCarry: false }).winner } : {}),
      ...(su.s.startsWith('S5') ? { s5Day1AtLine: evaluate(list, su.s, tier, { ...opts, s5Day1AtLine: true }).winner } : {}),
      ...(['S2', 'S3', 'S4', 'S5c'].includes(su.s.startsWith('S5') ? su.s : base.shape) ? { penaltiesAtClose: evaluate(list, su.s.startsWith('S5') ? su.s : base.shape, tier, { ...opts, penAtClose: true }).winner } : {}),
    };
    const boot = bootstrap(list, su.s.startsWith('S5') ? su.s : base.shape, tier, opts);
    // The penalty reading's own margin and bootstrap, where it applies (review A3).
    const pcShape = su.s.startsWith('S5') ? su.s : base.shape;
    const penaltiesAtClose = ['S2', 'S3', 'S4', 'S5c'].includes(pcShape)
      ? (() => { const e = evaluate(list, pcShape, tier, { ...opts, penAtClose: true }); const b = bootstrap(list, pcShape, tier, { ...opts, penAtClose: true }); return { means: e.means, winner: e.winner, sellMargin: e.sellMargin, sellMinusHold: e.means.SELL - e.means.HOLD, boot: b }; })()
      : null;
    // The check-priced sensitivity (review B1), for every shape the sale-at-the-line test applies to (not S5).
    const checked = su.s.startsWith('S5') ? null : Object.fromEntries(['checkLine', 'checkPriced'].map((k) => {
      const e = evaluate(list, base.shape, tier, { ...opts, check: k });
      const b = bootstrap(list, base.shape, tier, { ...opts, check: k });
      return [k, { seenShare: e.seenShare, means: e.means, winner: e.winner, sellMargin: e.sellMargin, sellMinusHold: e.means.SELL - e.means.HOLD, boot: b }];
    }));
    results.push({ label: label(su), tier, ...main, byDay, variants, boot, penaltiesAtClose, checked });
  }
}
writeJson(path.join(out, `step4-snap-exit${SUFFIX}.json`), { recommendedUnit: REC, counts, tape: { shortfallSessions: SHORTFALL.length, overshootMean: OVERSHOOT, overshootSessions: TAPE.checkOvershootUnits.n }, results });

console.log(`# Step 4 — the snap-exit test (recommended unit ${REC})\n`);
console.log(mdTable(['Unit / line', 'Holds reaching +1.0', 'First on session 1 / 2 / 3', 'Same-session penalty (primary order)', 'Gap through the line'],
  Object.entries(counts).map(([k, c]) => [k === 'S5' ? 'S5 daily line (one-day unit)' : k === 'D1' ? 'One-session game (U1)' : k, String(c.reach), c.byDay.join(' / '), String(c.sameDayPenalty), `${c.gapThrough}${c.lineBelowFill != null ? ` (line below the fill, by session of first touch: ${c.lineBelowFill.join(' / ')})` : ''}`])));
for (const tier of TIERS) {
  console.log(`\n## ${tier === 'support' ? 'Support (conviction 1.0) — primary' : 'Star (conviction 2.0) — check'}\n`);
  console.log(mdTable(['Shape-unit', 'n', 'Mean SELL / BELL / HOLD', 'Median SELL / BELL / HOLD', 'Single best: SELL / BELL / HOLD · BELL = HOLD', 'SELL beats HOLD', 'Best on average', 'SELL − next best', 'Flips under variants'],
    results.filter((r) => r.tier === tier).map((r) => [r.label, String(r.n), `${fx(r.means.SELL, 1)} / ${fx(r.means.BELL, 1)} / ${fx(r.means.HOLD, 1)}`, `${fx(r.medians.SELL, 0)} / ${fx(r.medians.BELL, 0)} / ${fx(r.medians.HOLD, 0)}`,
      `${(100 * r.strictBestShare.SELL).toFixed(0)}% / ${(100 * r.strictBestShare.BELL).toFixed(0)}% / ${(100 * r.strictBestShare.HOLD).toFixed(0)}% · ${(100 * r.bellEqHoldShare).toFixed(0)}%`, `${(100 * r.sellBeatsHoldShare).toFixed(0)}%`, r.winner, fx(r.sellMargin, 1),
      Object.entries(r.variants).filter(([, w]) => w !== r.winner).map(([k, w]) => `${k}→${w}`).join(', ') || 'none'])));
}
for (const tier of TIERS) {
  console.log(`\n## Session-clustered block bootstrap, ${tier} (${BOOT_DRAWS} draws, circular blocks of ${BOOT_BLOCK} entry sessions; 90% intervals)\n`);
  console.log(mdTable(['Shape-unit', 'Sessions', 'SELL − next best: mean [5%, 95%]', 'SELL − HOLD: mean [5%, 95%]', 'SELL − BELL: mean [5%, 95%]', 'SELL best on average in'],
    results.filter((r) => r.tier === tier).map((r) => [r.label, String(r.boot.sessions), `${fx(r.sellMargin, 1)} [${fx(r.boot.sellMinusNext[0], 1)}, ${fx(r.boot.sellMinusNext[1], 1)}]`, `${fx(r.means.SELL - r.means.HOLD, 1)} [${fx(r.boot.sellMinusHold[0], 1)}, ${fx(r.boot.sellMinusHold[1], 1)}]`,
      `${fx(r.means.SELL - r.means.BELL, 1)} [${fx(r.boot.sellMinusBell[0], 1)}, ${fx(r.boot.sellMinusBell[1], 1)}]`, `${(100 * r.boot.sellBestShare).toFixed(1)}% of draws`])));
}
for (const tier of TIERS) {
  console.log(`\n## Check-priced sensitivity, ${tier} (review B1; tape: ${SHORTFALL.length} shortfall sessions, overshoot ${OVERSHOOT.toFixed(3)} one-day units)\n`);
  const cell = (c) => (c ? `${fx(c.sellMargin, 1)} [${fx(c.boot.sellMinusNext[0], 1)}, ${fx(c.boot.sellMinusNext[1], 1)}] · ${(100 * c.boot.sellBestShare).toFixed(1)}% · ${c.winner}` : '—');
  console.log(mdTable(['Shape-unit', 'Seen by a check', 'At the line: SELL − next best [90%] · SELL best · winner', 'Past the line: SELL − next best [90%] · SELL best · winner'],
    results.filter((r) => r.tier === tier && r.checked).map((r) => [r.label, `${(100 * r.checked.checkLine.seenShare).toFixed(0)}%`, cell(r.checked.checkLine), cell(r.checked.checkPriced)])));
}
for (const tier of TIERS) {
  console.log(`\n## Penalties at the close (review A3), ${tier}\n`);
  console.log(mdTable(['Shape-unit', 'SELL − next best [90%] · SELL best · winner', 'SELL − HOLD'],
    results.filter((r) => r.tier === tier && r.penaltiesAtClose).map((r) => { const c = r.penaltiesAtClose; return [r.label, `${fx(c.sellMargin, 1)} [${fx(c.boot.sellMinusNext[0], 1)}, ${fx(c.boot.sellMinusNext[1], 1)}] · ${(100 * c.boot.sellBestShare).toFixed(1)}% · ${c.winner}`, fx(c.sellMinusHold, 1)]; })));
}
console.log('\n## By session of first touch (Support): n · mean S/B/H · median S/B/H · single best S/B/H% · best on average\n');
console.log(mdTable(['Shape-unit', 'Session 1', 'Session 2', 'Session 3'],
  results.filter((r) => r.tier === 'support').map((r) => [r.label, ...r.byDay.map((b) => (b.n ? `${b.n} · ${fx(b.means.SELL, 1)}/${fx(b.means.BELL, 1)}/${fx(b.means.HOLD, 1)} · ${fx(b.medians.SELL, 0)}/${fx(b.medians.BELL, 0)}/${fx(b.medians.HOLD, 0)} · ${(100 * b.strictBestShare.SELL).toFixed(0)}/${(100 * b.strictBestShare.BELL).toFixed(0)}/${(100 * b.strictBestShare.HOLD).toFixed(0)}% · ${b.winner}` : '—'))])));
