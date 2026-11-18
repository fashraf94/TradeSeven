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
      cases.push({ id: 'D1', entry: h.d, d: 0, gapThrough: false, bellSells: false, pts, carriesHeld: 0, carriesBell: 0 });
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
    cases.push({ id, entry: h.d, d, gapThrough, bellSells, pts, carriesHeld, carriesBell });
  }
  // S5: the daily reset, anchor = the prior close (the prompt's letter), one-day unit.
  const s5 = dailyReset(h, { anchor: 'prior_close' });
  const d = s5.days.findIndex((x) => x.touch.includes('bagger'));
  if (d >= 0) {
    const day = s5.days[d];
    const T = day.levels.bagger;
    const c = (counts.S5 ||= { reach: 0, byDay: [0, 0, 0], sameDayPenalty: 0, gapThrough: 0, lineBelowFill: 0 });
    c.reach++; c.byDay[d]++;
    const gapThrough = h.p[d][0] >= T;
    if (gapThrough) c.gapThrough++;
    if (T < F) c.lineBelowFill++;
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
    cases.push({ id: 'S5', entry: h.d, d, gapThrough, pts });
  }
});

/** The three policies' points for one case, shape, conviction tier and variant. */
function policyPoints(cs, shape, tier, { ordering = 'primary', open = false, carry = 0, bellCarry = true } = {}) {
  if (shape.startsWith('S5')) {
    const sellKey = open && cs.gapThrough ? `sell-open-${shape}` : `sell-${ordering}-${shape}`;
    return { SELL: cs.pts[sellKey][tier].total, BELL: cs.pts[`bell-${shape}`][tier].total, HOLD: cs.pts[`hold-${shape}`][tier].total };
  }
  const base = shape === 'S4' ? 'S3' : shape;
  const sell = (open && cs.gapThrough ? cs.pts['sell-open'] : cs.pts[`sell-${ordering}`])[tier].total;
  const bellCarries = cs.bellSells ? (bellCarry ? cs.carriesBell : cs.carriesBell - 1) : cs.carriesHeld;
  return { SELL: sell, BELL: cs.pts[`bell-${base}`][tier].total + carry * bellCarries, HOLD: cs.pts[`hold-${base}`][tier].total + carry * cs.carriesHeld };
}

function evaluate(list, shape, tier, opts) {
  const rows = list.map((cs) => policyPoints(cs, shape, tier, opts));
  const best = { SELL: 0, BELL: 0, HOLD: 0 };
  for (const r of rows) {
    const top = Math.max(r.SELL, r.BELL, r.HOLD);
    const winners = Object.keys(r).filter((k) => r[k] === top);
    for (const w of winners) best[w] += 1 / winners.length;
  }
  const P = ['SELL', 'BELL', 'HOLD'];
  const means = Object.fromEntries(P.map((k) => [k, mean(rows.map((r) => r[k]))]));
  const winner = P.reduce((a, b) => (means[b] > means[a] ? b : a));
  const runnerUp = Math.max(...P.filter((k) => k !== 'SELL').map((k) => means[k]));
  return { n: rows.length, means, medians: Object.fromEntries(P.map((k) => [k, median(rows.map((r) => r[k]))])),
    bestShare: Object.fromEntries(P.map((k) => [k, rows.length ? best[k] / rows.length : NaN])), winner, sellMargin: means.SELL - runnerUp };
}

const SHAPE_UNITS = [{ s: 'S1', id: 'D1' }, { s: 'S2', id: 'D1' }, ...UNITS.flatMap((id) => ['S1', 'S2', 'S3', ...CARRY_VALUES.map((c) => `S4C${c}`)].map((s) => ({ s, id }))), { s: 'S5t', id: 'S5' }, { s: 'S5c', id: 'S5' }];
const shapeOf = (s) => (s.startsWith('S4') ? 'S4' : s);
const carryOf = (s) => (s.startsWith('S4C') ? Number(s.slice(3)) : 0);
const label = ({ s, id }) => (id === 'S5' ? `${s} (one-day unit)` : id === 'D1' ? `one-session game ${s}-U1 (BELL = HOLD)` : `${s.replace(/^S4C(\d+)$/, 'S4 C=$1')}-${id}`);

/** Session-clustered bootstrap (seeded): resample ENTRY SESSIONS with replacement, 2,000 draws; 90% intervals for the
 *  mean SELL − HOLD and SELL − BELL per position, and the share of draws in which SELL is the best policy on average.
 *  Same-day holds move together, so the session — not the hold — is the independent unit. */
const BOOT_DRAWS = 2000;
function bootstrap(list, shape, tier, opts) {
  const bySession = new Map();
  for (const cs of list) {
    const r = policyPoints(cs, shape, tier, opts);
    const s = bySession.get(cs.entry) || { n: 0, S: 0, B: 0, H: 0 };
    s.n++; s.S += r.SELL; s.B += r.BELL; s.H += r.HOLD;
    bySession.set(cs.entry, s);
  }
  const sess = [...bySession.keys()].sort().map((k) => bySession.get(k));
  const rng = mulberry32(RNG_SEED + 1);
  const dh = [], db = [];
  let sellBest = 0;
  for (let i = 0; i < BOOT_DRAWS; i++) {
    let n = 0, S = 0, B = 0, H = 0;
    for (let j = 0; j < sess.length; j++) { const s = sess[Math.floor(rng() * sess.length)]; n += s.n; S += s.S; B += s.B; H += s.H; }
    dh.push((S - H) / n); db.push((S - B) / n);
    if (S > B && S > H) sellBest++;
  }
  return { sessions: sess.length, sellMinusHold: [quantile(dh, 0.05), quantile(dh, 0.95)], sellMinusBell: [quantile(db, 0.05), quantile(db, 0.95)], sellBestShare: sellBest / BOOT_DRAWS };
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
    };
    const boot = bootstrap(list, su.s.startsWith('S5') ? su.s : base.shape, tier, opts);
    results.push({ label: label(su), tier, ...main, byDay, variants, boot });
  }
}
writeJson(path.join(out, `step4-snap-exit${SUFFIX}.json`), { recommendedUnit: REC, counts, results });

console.log(`# Step 4 — the snap-exit test (recommended unit ${REC})\n`);
console.log(mdTable(['Unit / line', 'Holds reaching +1.0', 'First on session 1 / 2 / 3', 'Same-session penalty (primary order)', 'Gap through the line'],
  Object.entries(counts).map(([k, c]) => [k === 'S5' ? 'S5 daily line (one-day unit)' : k === 'D1' ? 'One-session game (U1)' : k, String(c.reach), c.byDay.join(' / '), String(c.sameDayPenalty), `${c.gapThrough}${c.lineBelowFill != null ? ` (line below the fill: ${c.lineBelowFill})` : ''}`])));
for (const tier of TIERS) {
  console.log(`\n## ${tier === 'support' ? 'Support (conviction 1.0) — primary' : 'Star (conviction 2.0) — check'}\n`);
  console.log(mdTable(['Shape-unit', 'n', 'Mean SELL / BELL / HOLD', 'Median SELL / BELL / HOLD', 'Best: SELL / BELL / HOLD', 'Best on average', 'SELL − next best', 'Flips under variants'],
    results.filter((r) => r.tier === tier).map((r) => [r.label, String(r.n), `${fx(r.means.SELL, 1)} / ${fx(r.means.BELL, 1)} / ${fx(r.means.HOLD, 1)}`, `${fx(r.medians.SELL, 0)} / ${fx(r.medians.BELL, 0)} / ${fx(r.medians.HOLD, 0)}`,
      `${(100 * r.bestShare.SELL).toFixed(0)}% / ${(100 * r.bestShare.BELL).toFixed(0)}% / ${(100 * r.bestShare.HOLD).toFixed(0)}%`, r.winner, fx(r.sellMargin, 1),
      Object.entries(r.variants).filter(([, w]) => w !== r.winner).map(([k, w]) => `${k}→${w}`).join(', ') || 'none'])));
}
for (const tier of TIERS) {
  console.log(`\n## Session-clustered bootstrap, ${tier} (${BOOT_DRAWS} draws; 90% intervals)\n`);
  console.log(mdTable(['Shape-unit', 'Sessions', 'SELL − HOLD: mean [5%, 95%]', 'SELL − BELL: mean [5%, 95%]', 'SELL best on average in'],
    results.filter((r) => r.tier === tier).map((r) => [r.label, String(r.boot.sessions), `${fx(r.means.SELL - r.means.HOLD, 1)} [${fx(r.boot.sellMinusHold[0], 1)}, ${fx(r.boot.sellMinusHold[1], 1)}]`,
      `${fx(r.means.SELL - r.means.BELL, 1)} [${fx(r.boot.sellMinusBell[0], 1)}, ${fx(r.boot.sellMinusBell[1], 1)}]`, `${(100 * r.boot.sellBestShare).toFixed(0)}% of draws`])));
}
console.log('\n## By session of first touch (Support)\n');
console.log(mdTable(['Shape-unit', 'Session 1: n, mean S/B/H, winner', 'Session 2', 'Session 3'],
  results.filter((r) => r.tier === 'support').map((r) => [r.label, ...r.byDay.map((b) => (b.n ? `${b.n}: ${fx(b.means.SELL, 1)}/${fx(b.means.BELL, 1)}/${fx(b.means.HOLD, 1)} → ${b.winner}` : '—'))])));
