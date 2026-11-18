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
// USAGE: node scripts/experiments/scoring-shape/step3Shapes.mjs [--out <dir>]

import path from 'node:path';
import { THRESHOLD_POINTS } from '../../../src/constants/baggerBombScoring.js';
import { BONUS_KEYS, CARRY_VALUES, drawMatches, fx, loadHolds, MATCH_SLOTS, mdTable, median, outDirOf, PENALTY_KEYS, quantile, readJson, unitOf, writeJson } from './lib.mjs';
import { bankDays, dailyBanked, dailyPoints, dailyReset, heldShapes, isBonus, isPenalty, legacyAgrees, pathSets, tierPoints } from './shapes.mjs';

const argv = process.argv;
const out = outDirOf(argv);
const { holds } = loadHolds(out, { window: 'v2' });
const step2 = readJson(path.join(out, 'step2-units.json'));
const REC = step2.recommendation.recommended;
const UNITS = [...new Set(['U1', 'U4', 'U6', REC])];
const tierSum = (set, pred) => set.filter(pred).reduce((n, t) => n + THRESHOLD_POINTS[t], 0);

/** One position's facts under one shape, in the shape-neutral form the match sampler sums. */
function fact({ pts, banked, days, nDays, carries = 0, carryDays = [], give = 0, uw = 0, events = 0 }) {
  const bonusDays = Array(nDays).fill(false);
  for (const { t, day } of days) if (isBonus(t) && day >= 0) bonusDays[day] = true;
  const carryFlags = Array(nDays).fill(false);
  for (const j of carryDays) carryFlags[j] = true;
  return { tot: { star: pts.star.total, core: pts.core.total, support: pts.support.total }, base: { star: pts.star.base, core: pts.core.base, support: pts.support.base },
    bonusPts: tierSum(banked, isBonus), penPts: tierSum(banked, isPenalty), bonusN: banked.filter(isBonus).length,
    pen: Object.fromEntries(PENALTY_KEYS.map((k) => [k, banked.filter((t) => t === k).length])), bonusDays, carries, carryFlags, give, uw, events };
}

const facts = {}; // key → array per hold
const put = (key, i, f) => { (facts[key] ||= [])[i] = f; };
const sens = {}; // penalties-at-close sensitivity: key → { bust, crash, meltdown } summed over holds
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
    put(`S4-${id}`, i, { ...s3, carries: hs.carries, carryFlags: [0, 1, 2].map((j) => hs.carryDays.includes(j)) });
    for (const [k, set] of [['S2', hs.S2penAtClose], ['S3', hs.S3penAtClose]]) {
      const s = (sens[`${k}-${id}`] ||= { bust: 0, crash: 0, meltdown: 0 });
      for (const p of set) s[p]++;
    }
  }

  for (const anchor of ['prior_close', 'fill']) {
    const s5 = dailyReset(h, { anchor });
    if (anchor === 'prior_close') { legacyChecked++; if (legacyAgrees(s5)) legacyOk++; }
    for (const v of ['t', 'c']) {
      const sets = s5.days.map((d) => dailyBanked(d, v));
      const pts = dailyPoints(F, s5.u1, end, sets);
      const banked = sets.flat();
      const days = sets.flatMap((s, j) => s.map((t) => ({ t, day: j })));
      let uw = 0, give = 0, events = 0;
      sets.forEach((s, j) => s.filter(isBonus).forEach((t) => {
        events++;
        const d = s5.days[j];
        if ((v === 't' ? d.levels[t] : d.C) < F) uw++;
        if (end < d.levels[t]) give += THRESHOLD_POINTS[t];
      }));
      put(`S5${v}-${anchor === 'prior_close' ? 'pc' : 'fill'}`, i, fact({ pts, banked, days, nDays: 3, give, uw, events }));
    }
  }
});

// ---- matches ----
const matches = drawMatches(holds);
function summarize(key, { carry = 0, nDays }) {
  const f = facts[key];
  const totals = [];
  let bonusN = 0, bust = 0, crash = 0, meltdown = 0, absBase = 0, bonusPts = 0, penPts = 0, dayHits = 0, dayHitsWithCarry = 0, none = 0, noneWithCarry = 0;
  for (const m of matches) {
    let total = 0, anyDay = Array(nDays).fill(false), anyDayC = Array(nDays).fill(false);
    m.holds.forEach((hi, slot) => {
      const x = f[hi];
      const tier = MATCH_SLOTS[slot];
      total += x.tot[tier] + carry * x.carries;
      absBase += Math.abs(x.base[tier]);
      bonusPts += x.bonusPts + carry * x.carries;
      penPts += Math.abs(x.penPts);
      bonusN += x.bonusN;
      bust += x.pen.bust; crash += x.pen.crash; meltdown += x.pen.meltdown;
      x.bonusDays.forEach((b, j) => { if (b) { anyDay[j] = true; anyDayC[j] = true; } });
      if (carry) x.carryFlags.forEach((b, j) => { if (b) anyDayC[j] = true; });
    });
    totals.push(total);
    dayHits += anyDay.filter(Boolean).length;
    dayHitsWithCarry += anyDayC.filter(Boolean).length;
    if (!anyDay.some(Boolean)) none++;
    if (!anyDayC.some(Boolean)) noneWithCarry++;
  }
  const M = matches.length;
  const all = absBase + bonusPts + penPts;
  const perHold = holds.map((_, i) => f[i]);
  const bonusAll = perHold.reduce((n, x) => n + x.bonusPts, 0);
  const giveAll = perHold.reduce((n, x) => n + x.give, 0);
  const events = perHold.reduce((n, x) => n + x.events, 0), uw = perHold.reduce((n, x) => n + x.uw, 0);
  return { key, carry, matches: M, bonusesPerMatch: bonusN / M, bustsPerMatch: bust / M, crashesPerMatch: crash / M, meltdownsPerMatch: meltdown / M,
    bonusShare: bonusPts / all, thresholdShare: (bonusPts + penPts) / all, scoreMedian: median(totals), scoreP10: quantile(totals, 0.1), scoreP90: quantile(totals, 0.9), scoreMean: totals.reduce((a, b) => a + b, 0) / M,
    bonusDayShare: dayHits / (M * nDays), bonusDayShareWithCarry: carry ? dayHitsWithCarry / (M * nDays) : null, matchesWithNoBonus: none / M, matchesWithNoBonusOrCarry: carry ? noneWithCarry / M : null,
    giveBackShare: bonusAll ? giveAll / bonusAll : 0, underWaterShare: events ? uw / events : null, s5BonusEvents: events };
}

const rows = [summarize('D1-S1', { nDays: 1 }), summarize('D1-S2', { nDays: 1 })];
for (const id of UNITS) {
  for (const s of ['S1', 'S2', 'S3']) rows.push(summarize(`${s}-${id}`, { nDays: 3 }));
  for (const c of CARRY_VALUES) rows.push({ ...summarize(`S4-${id}`, { nDays: 3, carry: c }), key: `S4(C=${c})-${id}` });
}
for (const k of ['S5t-pc', 'S5c-pc', 'S5t-fill', 'S5c-fill']) rows.push(summarize(k, { nDays: 3 }));
const sensRows = Object.entries(sens).map(([k, s]) => ({ key: `${k} penalties at close`, bustsPerMatch: 7 * s.bust / holds.length, crashesPerMatch: 7 * s.crash / holds.length, meltdownsPerMatch: 7 * s.meltdown / holds.length }));

writeJson(path.join(out, 'step3-shapes.json'), { recommendedUnit: REC, units: UNITS, holds: holds.length, matches: matches.length, rows, penaltiesAtCloseSensitivity: sensRows, legacyCrossCheck: { agree: legacyOk, of: legacyChecked } });

const P = (x) => (x == null ? '—' : `${(100 * x).toFixed(1)}%`);
console.log(`# Step 3 — scoring shapes (${holds.length} holds, ${matches.length} seeded 7-position matches; recommended unit ${REC})\n`);
console.log(mdTable(['Shape-unit', 'Bonuses / match', 'Busts', 'Crashes', 'Meltdowns', 'Bonus share', 'Bonus+penalty share', 'Score median [P10, P90]', 'Days with a bonus', 'Matches with none', 'Give-backs', 'S5 under water'],
  rows.map((r) => [r.key, fx(r.bonusesPerMatch), fx(r.bustsPerMatch), fx(r.crashesPerMatch), fx(r.meltdownsPerMatch), P(r.bonusShare), P(r.thresholdShare),
    `${fx(r.scoreMedian, 0)} [${fx(r.scoreP10, 0)}, ${fx(r.scoreP90, 0)}]`, r.bonusDayShareWithCarry != null ? `${P(r.bonusDayShare)} (${P(r.bonusDayShareWithCarry)} incl. carry)` : P(r.bonusDayShare),
    r.matchesWithNoBonusOrCarry != null ? `${P(r.matchesWithNoBonus)} (${P(r.matchesWithNoBonusOrCarry)})` : P(r.matchesWithNoBonus), P(r.giveBackShare), P(r.underWaterShare)])));
console.log('\nPenalties banked by the shape\'s own bonus rule (sensitivity), per match:\n');
console.log(mdTable(['Shape-unit', 'Busts', 'Crashes', 'Meltdowns'], sensRows.map((r) => [r.key, fx(r.bustsPerMatch), fx(r.crashesPerMatch), fx(r.meltdownsPerMatch)])));
console.log(`\nS5 cross-check, legacy scorer (agent-daily-scores path) vs the measured model, day-by-day badges: ${legacyOk} of ${legacyChecked} holds agree.`);
