#!/usr/bin/env node
// scripts/experiments/scoring-shape/step3Shapes.mjs
//
// STEP 3 — the scoring shapes (prompt §5). Every three-session hold is scored, held to the end of the match, under
// S1–S4 on U1, U4, U6 and Step 2's recommended unit, and under S5 (one-day unit; on touch and at the close; anchor
// = the prior close per the prompt, and the legacy fill anchor as a variant). The one-session game on V2 (U1, S1
// touch) is the baseline in every table; the one-session game under exit-only (S2) is shown beside it.
//
// Per 7-position match (seeded draws, lib.drawMatches): bonuses banked and Busts / Crashes / Meltdowns; the bonus share
// of points; the median and 10th–90th percentile of the final score; the share of match-days with at least one bonus
// banked and of matches with none; for S5, how often a bonus is paid to a position below its entry at that moment; and
// the share of bonus points paid on positions whose end move no longer clears the level (give-backs).
//
// Tier points split into bonus / penalty use the canonical table (THRESHOLD_POINTS, src/constants/baggerBombScoring.js);
// every position total is the fenced scorer's own (calculateAssetScoreServer, CALLED).
//
// USAGE: node scripts/experiments/scoring-shape/step3Shapes.mjs [--out <dir>] [--long]

import path from 'node:path';
import { THRESHOLD_POINTS } from '../../../src/constants/baggerBombScoring.js';
import { BONUS_KEYS, CARRY_VALUES, drawMatches, fx, loadHolds, MATCH_SLOTS, mdTable, median, outDirOf, PENALTY_KEYS, quantile, readJson, unitOf, writeJson , suffixOf, windowOf } from './lib.mjs';
import { bankDays, dailyBanked, dailyPoints, dailyReset, heldShapes, isBonus, isPenalty, legacyAgrees, pathSets, tierPoints, union } from './shapes.mjs';

const argv = process.argv;
const out = outDirOf(argv);
const WINDOW = windowOf(argv);
const SUFFIX = suffixOf(WINDOW);
const { holds } = loadHolds(out, { window: WINDOW });
const step2 = readJson(path.join(out, `step2-units${SUFFIX}.json`));
const REC = step2.recommendation.recommended;
const UNITS = [...new Set(['U1', 'U4', 'U6', REC])];
const tierSum = (set, pred) => set.filter(pred).reduce((n, t) => n + THRESHOLD_POINTS[t], 0);

/** One position's facts under one shape, in the shape-neutral form the match sampler sums. */
function fact({ pts, banked, days, nDays, carries = 0, carryDays = [], give = 0, uw = 0, events = 0, preEntry = 0 }) {
  const bonusDays = Array(nDays).fill(false);
  for (const { t, day } of days) if (isBonus(t) && day >= 0) bonusDays[day] = true;
  const carryFlags = Array(nDays).fill(false);
  for (const j of carryDays) carryFlags[j] = true;
  return { tot: { star: pts.star.total, core: pts.core.total, support: pts.support.total }, base: { star: pts.star.base, core: pts.core.base, support: pts.support.base },
    bonusPts: tierSum(banked, isBonus), penPts: tierSum(banked, isPenalty), bonusN: banked.filter(isBonus).length,
    pen: Object.fromEntries(PENALTY_KEYS.map((k) => [k, banked.filter((t) => t === k).length])), bonusDays, carries, carryFlags, give, uw, events, preEntry, giveCarries: 0 };
}

const facts = {}; // key → array per hold
const put = (key, i, f) => { (facts[key] ||= [])[i] = f; };
let legacyOk = 0, legacyChecked = 0;

holds.forEach((h, i) => {
  const F = h.p[0][0];
  const end = h.p[2][3];
  // Baseline: the one-session game on V2 (U1), touch (today) and exit-only.
  const u1 = unitOf(h, 'U1');
  const one = { ...h, p: [h.p[0]] };
  const ps1 = pathSets(one, u1);
  const hs1 = heldShapes(ps1);
  put('D1-S1', i, fact({ pts: tierPoints(F, u1, h.p[0][3], hs1.S1), banked: hs1.S1, days: bankDays(ps1, 'S1', hs1.S1), nDays: 1, give: tierSum(hs1.S1.filter((t) => isBonus(t) && !ps1.close[0].includes(t)), () => true) }));
  put('D1-S2', i, fact({ pts: tierPoints(F, u1, h.p[0][3], hs1.S2), banked: hs1.S2, days: bankDays(ps1, 'S2', hs1.S2), nDays: 1 }));
  // SENSITIVITY (review A3, C6): penalties bank by the shape's own bonus rule — at the close — instead of on touch.
  // Baseline row: today's one-day game under exit only, with its penalties at the close too.
  const d1p = union(ps1.close[0].filter(isBonus), hs1.S2penAtClose);
  put('D1-S2p', i, fact({ pts: tierPoints(F, u1, h.p[0][3], d1p), banked: d1p, days: bankDays(ps1, 'S2', d1p), nDays: 1 }));

  for (const id of UNITS) {
    const u = unitOf(h, id);
    const ps = pathSets(h, u);
    const hs = heldShapes(ps);
    for (const shape of ['S1', 'S2', 'S3']) {
      const banked = hs[shape];
      const give = tierSum(banked.filter((t) => isBonus(t) && !ps.close[2].includes(t)), () => true);
      put(`${shape}-${id}`, i, fact({ pts: tierPoints(F, u, end, banked), banked, days: bankDays(ps, shape, banked), nDays: 3, give }));
    }
    const s3 = facts[`S3-${id}`][i];
    // A carry is a give-back too when the end close no longer clears +1.0 (review A6).
    put(`S4-${id}`, i, { ...s3, carries: hs.carries, carryFlags: [0, 1, 2].map((j) => hs.carryDays.includes(j)), giveCarries: ps.close[2].includes('bagger') ? 0 : hs.carries });
    // Sensitivity: S2 with penalties at the end close, S3 with penalties at any close.
    const s2p = union(hs.S2.filter(isBonus), hs.S2penAtClose), s3p = union(hs.S3.filter(isBonus), hs.S3penAtClose);
    put(`S2p-${id}`, i, fact({ pts: tierPoints(F, u, end, s2p), banked: s2p, days: bankDays(ps, 'S2', s2p), nDays: 3 }));
    put(`S3p-${id}`, i, fact({ pts: tierPoints(F, u, end, s3p), banked: s3p, days: bankDays(ps, 'S3', s3p), nDays: 3 }));
  }

  for (const anchor of ['prior_close', 'fill']) {
    const s5 = dailyReset(h, { anchor });
    if (anchor === 'prior_close') { legacyChecked++; if (legacyAgrees(s5)) legacyOk++; }
    for (const v of ['t', 'c']) {
      const sets = s5.days.map((d) => dailyBanked(d, v));
      const pts = dailyPoints(F, s5.u1, end, sets);
      const banked = sets.flat();
      const days = sets.flatMap((s, j) => s.map((t) => ({ t, day: j })));
      let uw = 0, give = 0, events = 0, preEntry = 0;
      sets.forEach((s, j) => s.filter(isBonus).forEach((t) => {
        events++;
        const d = s5.days[j];
        // The price at that moment (review A2): on touch, the level — or the open, when the session opened beyond it
        // (on session 1 under the prior-close anchor the open IS the fill); at the close, the close.
        const atMoment = v === 't' ? Math.max(h.p[j][0], d.levels[t]) : d.C;
        if (atMoment < F) uw++;
        // A session-1 level at or below the fill was crossed (at least partly) by the overnight move before entry.
        if (j === 0 && d.levels[t] <= F) preEntry++;
        if (end < d.levels[t]) give += THRESHOLD_POINTS[t];
      }));
      put(`S5${v}-${anchor === 'prior_close' ? 'pc' : 'fill'}`, i, fact({ pts, banked, days, nDays: 3, give, uw, events, preEntry }));
      // Sensitivity for S5 at each close: each day's penalties at that day's close, from the day's anchor.
      if (v === 'c' && anchor === 'prior_close') {
        const pSets = s5.days.map((d) => union(d.close.filter(isBonus), d.close.filter(isPenalty)));
        put('S5cp-pc', i, fact({ pts: dailyPoints(F, s5.u1, end, pSets), banked: pSets.flat(), days: pSets.flatMap((s, j) => s.map((x) => ({ t: x, day: j }))), nDays: 3 }));
      }
    }
  }
});

// ---- matches ----
const matches = drawMatches(holds);
function summarize(key, { carry = 0, nDays }) {
  const f = facts[key];
  const totals = [], baseTotals = [];
  let bonusN = 0, bust = 0, crash = 0, meltdown = 0, absBase = 0, bonusPts = 0, penPts = 0, dayHits = 0, dayHitsWithCarry = 0, none = 0, noneWithCarry = 0;
  for (const m of matches) {
    let total = 0, baseTotal = 0, anyDay = Array(nDays).fill(false), anyDayC = Array(nDays).fill(false);
    m.holds.forEach((hi, slot) => {
      const x = f[hi];
      const tier = MATCH_SLOTS[slot];
      total += x.tot[tier] + carry * x.carries;
      absBase += Math.abs(x.base[tier]);
      baseTotal += x.base[tier];
      bonusPts += x.bonusPts + carry * x.carries;
      penPts += Math.abs(x.penPts);
      bonusN += x.bonusN;
      bust += x.pen.bust; crash += x.pen.crash; meltdown += x.pen.meltdown;
      x.bonusDays.forEach((b, j) => { if (b) { anyDay[j] = true; anyDayC[j] = true; } });
      if (carry) x.carryFlags.forEach((b, j) => { if (b) anyDayC[j] = true; });
    });
    totals.push(total); baseTotals.push(baseTotal);
    dayHits += anyDay.filter(Boolean).length;
    dayHitsWithCarry += anyDayC.filter(Boolean).length;
    if (!anyDay.some(Boolean)) none++;
    if (!anyDayC.some(Boolean)) noneWithCarry++;
  }
  const M = matches.length;
  const all = absBase + bonusPts + penPts;
  const perHold = holds.map((_, i) => f[i]);
  const bonusAll = perHold.reduce((n, x) => n + x.bonusPts, 0);
  const giveAll = perHold.reduce((n, x) => n + x.give, 0) + carry * perHold.reduce((n, x) => n + (x.giveCarries || 0), 0);
  const bonusAllWithCarry = bonusAll + carry * perHold.reduce((n, x) => n + x.carries, 0);
  const events = perHold.reduce((n, x) => n + x.events, 0), uw = perHold.reduce((n, x) => n + x.uw, 0), preEntry = perHold.reduce((n, x) => n + (x.preEntry || 0), 0);
  return { key, carry, matches: M, bonusesPerMatch: bonusN / M, bustsPerMatch: bust / M, crashesPerMatch: crash / M, meltdownsPerMatch: meltdown / M,
    bonusShare: bonusPts / all, thresholdShare: (bonusPts + penPts) / all, scoreMedian: median(totals), scoreP10: quantile(totals, 0.1), scoreP90: quantile(totals, 0.9), scoreMean: totals.reduce((a, b) => a + b, 0) / M,
    bonusDayShare: dayHits / (M * nDays), bonusDayShareWithCarry: carry ? dayHitsWithCarry / (M * nDays) : null, matchesWithNoBonus: none / M, matchesWithNoBonusOrCarry: carry ? noneWithCarry / M : null,
    baseP10: quantile(baseTotals, 0.1), baseP90: quantile(baseTotals, 0.9),
    giveBackShare: bonusAllWithCarry ? giveAll / bonusAllWithCarry : 0, underWaterShare: events ? uw / events : null, s5BonusEvents: events, s5UnderWater: uw, s5PreEntry: preEntry };
}

const rows = [summarize('D1-S1', { nDays: 1 }), summarize('D1-S2', { nDays: 1 })];
for (const id of UNITS) {
  for (const s of ['S1', 'S2', 'S3']) rows.push(summarize(`${s}-${id}`, { nDays: 3 }));
  for (const c of CARRY_VALUES) rows.push({ ...summarize(`S4-${id}`, { nDays: 3, carry: c }), key: `S4(C=${c})-${id}` });
}
for (const k of ['S5t-pc', 'S5c-pc', 'S5t-fill', 'S5c-fill']) rows.push(summarize(k, { nDays: 3 }));
const sensRows = [summarize('D1-S2p', { nDays: 1 }), ...UNITS.flatMap((id) => [summarize(`S2p-${id}`, { nDays: 3 }), summarize(`S3p-${id}`, { nDays: 3 })]), summarize('S5cp-pc', { nDays: 3 })];
const s5Detail = rows.filter((r) => r.key.startsWith('S5')).map((r) => ({ key: r.key, bonusEvents: r.s5BonusEvents, underWater: r.s5UnderWater, preEntry: r.s5PreEntry }));

writeJson(path.join(out, `step3-shapes${SUFFIX}.json`), { recommendedUnit: REC, units: UNITS, holds: holds.length, matches: matches.length, rows, penaltiesAtCloseSensitivity: sensRows, s5Detail, legacyCrossCheck: { agree: legacyOk, of: legacyChecked } });

const P = (x) => (x == null ? '—' : `${(100 * x).toFixed(1)}%`);
console.log(`# Step 3 — scoring shapes (${holds.length} holds, ${matches.length} seeded 7-position matches; recommended unit ${REC})\n`);
console.log(mdTable(['Shape-unit', 'Bonuses / match', 'Busts', 'Crashes', 'Meltdowns', 'Bonus share', 'Bonus+penalty share', 'Score median [P10, P90]', 'Base points [P10, P90]', 'Days with a bonus', 'Matches with none', 'Give-backs', 'S5 under water'],
  rows.map((r) => [r.key, fx(r.bonusesPerMatch), fx(r.bustsPerMatch), fx(r.crashesPerMatch), fx(r.meltdownsPerMatch), P(r.bonusShare), P(r.thresholdShare),
    `${fx(r.scoreMedian, 0)} [${fx(r.scoreP10, 0)}, ${fx(r.scoreP90, 0)}]`, `[${fx(r.baseP10, 0)}, ${fx(r.baseP90, 0)}]`, r.bonusDayShareWithCarry != null ? `${P(r.bonusDayShare)} (${P(r.bonusDayShareWithCarry)} incl. carry)` : P(r.bonusDayShare),
    r.matchesWithNoBonusOrCarry != null ? `${P(r.matchesWithNoBonus)} (${P(r.matchesWithNoBonusOrCarry)})` : P(r.matchesWithNoBonus), P(r.giveBackShare), P(r.underWaterShare)])));
console.log('\nPenalties banked by the shape\'s own bonus rule (sensitivity), per match:\n');
console.log(mdTable(['Shape-unit (penalties at the close)', 'Bonuses / match', 'Busts', 'Crashes', 'Meltdowns', 'Bonus+penalty share', 'Score median [P10, P90]', 'Score mean'],
  sensRows.map((r) => [r.key, fx(r.bonusesPerMatch), fx(r.bustsPerMatch), fx(r.crashesPerMatch), fx(r.meltdownsPerMatch), P(r.thresholdShare), `${fx(r.scoreMedian, 0)} [${fx(r.scoreP10, 0)}, ${fx(r.scoreP90, 0)}]`, fx(r.scoreMean, 1)])));
console.log('\nS5 bonuses: under water at that moment, and session-1 levels at or below the fill (crossed by the overnight move before entry):\n');
console.log(mdTable(['S5 variant', 'Bonus events', 'Under water', 'Session-1 level at or below the fill'], s5Detail.map((r) => [r.key, String(r.bonusEvents), `${r.underWater} (${P(r.underWater / r.bonusEvents)})`, `${r.preEntry} (${P(r.preEntry / r.bonusEvents)})`])));
console.log(`\nS5 cross-check, the fenced scorer's legacy branch given each day's high/low as extremes vs the measured model, day-by-day tiers: ${legacyOk} of ${legacyChecked} holds agree (arithmetic agreement; not the nightly path's check-sampled history).`);
