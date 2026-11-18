#!/usr/bin/env node
// scripts/experiments/scoring-shape/step5OneVsThree.mjs
//
// STEP 5 — one day against three (prompt §7). The same seven entries (the seeded matches of Step 3, no setup filter):
//   - one 3-day match: entered at the open of session 1, held to the close of session 3, under S1–S4 (recommended unit
//     and U1) and S5;
//   - three consecutive 1-day matches: the same seven stocks re-entered at each session's open, each with that day's
//     one-day unit (V2: measured from the 15 bars before that session), scored as today (S1 touch) and exit-only (S2).
// Points per day and bonuses per day. Then how much of the 3-day result is decided by the two overnight gaps:
//   (a) the share of a match's 3-day move (conviction-weighted log return) whose variance comes from the overnight
//       moves, and the share of matches whose 3-day move changes sign when the overnight moves are removed;
//   (b) at the position level, the overnight share of the absolute log movement;
//   (c) the share of bonus first touches on sessions 2–3 made AT the open (a gap through the level).
//
// USAGE: node scripts/experiments/scoring-shape/step5OneVsThree.mjs [--out <dir>]

import path from 'node:path';
import { THRESHOLD_POINTS } from '../../../src/constants/baggerBombScoring.js';
import { CONVICTION_MULTIPLIERS } from '../../../src/constants/baggerBombScoring.js';
import { admitted, drawMatches, fx, levelsOf, loadHolds, MATCH_SLOTS, mdTable, mean, median, outDirOf, quantile, readJson, unitOf, writeJson } from './lib.mjs';
import { dailyBanked, dailyPoints, dailyReset, firstDay, heldShapes, isBonus, isPenalty, pathSets, tierPoints } from './shapes.mjs';

const argv = process.argv;
const out = outDirOf(argv);
const { holds } = loadHolds(out, { window: 'v2' });
const REC = readJson(path.join(out, 'step2-units.json')).recommendation.recommended;
const UNITS = [...new Set([REC, 'U1'])];
const C_MID = 10;

const per = {}; // key → per-hold { tot: {tier}, bonusN, bustN }
const put = (k, i, v) => { (per[k] ||= [])[i] = v; };
const fact = (pts, banked, extra = 0) => ({ tot: Object.fromEntries(Object.entries(pts).map(([t, p]) => [t, p.total + extra])), bonusN: banked.filter(isBonus).length, penN: banked.filter(isPenalty).length });
let gapFirst = 0, laterFirst = 0, allFirst = 0;
const absOn = [], absId = [];

holds.forEach((h, i) => {
  const F = h.p[0][0], end = h.p[2][3];
  // three re-entered one-day matches
  const d1 = { S1: [], S2: [] };
  for (let j = 0; j < 3; j++) {
    const uj = admitted(h.u1[j]);
    const day = { ...h, p: [h.p[j]] };
    const ps = pathSets(day, uj);
    const hs = heldShapes(ps);
    for (const s of ['S1', 'S2']) d1[s].push(fact(tierPoints(h.p[j][0], uj, h.p[j][3], hs[s]), hs[s]));
  }
  for (const s of ['S1', 'S2']) put(`1d×3-${s}`, i, { tot: Object.fromEntries(['star', 'core', 'support'].map((t) => [t, d1[s].reduce((n, x) => n + x.tot[t], 0)])), bonusN: d1[s].reduce((n, x) => n + x.bonusN, 0), penN: d1[s].reduce((n, x) => n + x.penN, 0) });
  // one 3-day match
  for (const id of UNITS) {
    const u = unitOf(h, id);
    const ps = pathSets(h, u);
    const hs = heldShapes(ps);
    for (const s of ['S1', 'S2', 'S3']) put(`3d-${s}-${id}`, i, fact(tierPoints(F, u, end, hs[s]), hs[s]));
    put(`3d-S4(C=${C_MID})-${id}`, i, fact(tierPoints(F, u, end, hs.S3), hs.S3, C_MID * hs.carries));
    if (id === REC) {
      const lv = levelsOf(F, u);
      for (const t of ['bagger', 'doubleBagger', 'tenBagger']) {
        const d = firstDay(ps.touch, t);
        if (d < 0) continue;
        allFirst++;
        if (d > 0) { laterFirst++; if (h.p[d][0] >= lv[t]) gapFirst++; }
      }
    }
  }
  const s5 = dailyReset(h, { anchor: 'prior_close' });
  for (const v of ['t', 'c']) {
    const sets = s5.days.map((x) => dailyBanked(x, v));
    put(`3d-S5${v}`, i, fact(dailyPoints(F, s5.u1, end, sets), sets.flat()));
  }
  const on = [Math.log(h.p[1][0] / h.p[0][3]), Math.log(h.p[2][0] / h.p[1][3])];
  const id3 = h.p.map(([o, , , c]) => Math.log(c / o));
  absOn.push(Math.abs(on[0]) + Math.abs(on[1]));
  absId.push(id3.reduce((n, x) => n + Math.abs(x), 0));
  h._on = on[0] + on[1];
  h._id = id3[0] + id3[1] + id3[2];
});

const matches = drawMatches(holds);
const KEYS = ['1d×3-S1', '1d×3-S2', ...UNITS.flatMap((id) => ['S1', 'S2', 'S3', `S4(C=${C_MID})`].map((s) => `3d-${s}-${id}`)), '3d-S5t', '3d-S5c'];
const rows = KEYS.map((k) => {
  const totals = [], bonus = [], pen = [];
  for (const m of matches) {
    let t = 0, b = 0, p = 0;
    m.holds.forEach((hi, slot) => { const x = per[k][hi]; t += x.tot[MATCH_SLOTS[slot]]; b += x.bonusN; p += x.penN; });
    totals.push(t); bonus.push(b); pen.push(p);
  }
  return { key: k, pointsPerDay: mean(totals) / 3, bonusesPerDay: mean(bonus) / 3, penaltiesPerDay: mean(pen) / 3, median: median(totals), p10: quantile(totals, 0.1), p90: quantile(totals, 0.9) };
});
// (a) match-level decomposition, conviction-weighted log returns
const mTot = [], mOn = [], mId = [];
for (const m of matches) {
  let on = 0, id = 0;
  m.holds.forEach((hi, slot) => { const w = CONVICTION_MULTIPLIERS[MATCH_SLOTS[slot]]; on += w * holds[hi]._on; id += w * holds[hi]._id; });
  mOn.push(on); mId.push(id); mTot.push(on + id);
}
const variance = (xs) => { const mu = mean(xs); return mean(xs.map((x) => (x - mu) ** 2)); };
const cov = (xs, ys) => { const mx = mean(xs), my = mean(ys); return mean(xs.map((x, i) => (x - mx) * (ys[i] - my))); };
const gaps = {
  varShareOvernight: variance(mOn) / variance(mTot), varShareIntraday: variance(mId) / variance(mTot), covShare: 2 * cov(mOn, mId) / variance(mTot),
  signFlipWithoutOvernight: mTot.filter((t, i) => Math.sign(t) !== Math.sign(mId[i])).length / mTot.length,
  positionAbsShareOvernight: absOn.reduce((a, b) => a + b, 0) / (absOn.reduce((a, b) => a + b, 0) + absId.reduce((a, b) => a + b, 0)),
  bonusFirstTouches: { unit: REC, all: allFirst, onSessions2or3: laterFirst, atTheOpen: gapFirst },
};
writeJson(path.join(out, 'step5-one-vs-three.json'), { recommendedUnit: REC, holds: holds.length, matches: matches.length, rows, gaps });

console.log(`# Step 5 — one day against three (${holds.length} holds, ${matches.length} matches)\n`);
console.log(mdTable(['Game', 'Points per day', 'Bonuses per day', 'Penalties per day', 'Three-day total: median [P10, P90]'],
  rows.map((r) => [r.key, fx(r.pointsPerDay, 1), fx(r.bonusesPerDay, 2), fx(r.penaltiesPerDay, 2), `${fx(r.median, 0)} [${fx(r.p10, 0)}, ${fx(r.p90, 0)}]`])));
console.log(`\nOvernight: ${(100 * gaps.varShareOvernight).toFixed(1)}% of the variance of a match's 3-day move (intraday ${(100 * gaps.varShareIntraday).toFixed(1)}%, covariance ${(100 * gaps.covShare).toFixed(1)}%). Removing the two overnight moves changes the sign of ${(100 * gaps.signFlipWithoutOvernight).toFixed(1)}% of matches' 3-day moves. Position level: ${(100 * gaps.positionAbsShareOvernight).toFixed(1)}% of absolute log movement is overnight.`);
console.log(`Bonus first touches (${REC}, S1): ${allFirst}; on sessions 2–3: ${laterFirst}; at the open (gap through): ${gapFirst} (${(100 * gapFirst / laterFirst).toFixed(1)}% of later first touches).`);
void THRESHOLD_POINTS;
