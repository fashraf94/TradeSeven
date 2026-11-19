#!/usr/bin/env node
// scripts/experiments/scoring-shape/step2Units.mjs
//
// STEP 2 — the unit (prompt §4). For every hold and every candidate unit U1–U6, from the fill (the entry open):
//   - TOUCH: is each tier's level reached by the daily highs/lows over the hold?
//   - ANY CLOSE: does any session's close clear it?   - END: does the final close clear it?
//   - PER SESSION: does session 1's, 2's, 3's close clear the ±1.0 levels?
// Beside them, V2's ONE-session rates from the same entries with the one-day unit (U1): touch on the session's
// high/low, and the session's close.
//
// Every crossing is decided by the real model (stockRewardContext, src/utils/stockThresholdModel.js); the script only
// chooses which prices form the touch record. The recommended unit follows RECOMMENDATION_RULE (lib.mjs), fixed
// before this script was first run. The exact scale that would match V2's +1.0 rarity is read off the real model's
// own maxMultiplier for U1 (a descriptive solve; the candidate list is the prompt's).
//
// FILL (sensitivity, added after the first run): --fill prior_close anchors every hold at the close of t−1 instead of the
// open of t — what V2 does for a battle created out of hours (policy offHoursCreation, Ruling 7: the opening jump is
// post-fill movement). The unit is unchanged (15 bars ending at t−1). Outputs get a -pcfill suffix.
//
// USAGE: node scripts/experiments/scoring-shape/step2Units.mjs [--out <dir>] [--long] [--fill open|prior_close]

import path from 'node:path';
import { BONUS_KEYS, crossed, fx, loadHolds, mdTable, outDirOf, PENALTY_KEYS, quantile, median, RECOMMENDATION_RULE, rewardContext, TIER_KEYS,
  TIER_LABEL, UNIT_IDS, UNIT_SCALES, unitOf, windowOf, writeJson, argOf, die } from './lib.mjs';

const argv = process.argv;
const out = outDirOf(argv);
const window = windowOf(argv);
const FILL = argOf(argv, '--fill', 'open');
if (!['open', 'prior_close'].includes(FILL)) die('--fill is open or prior_close');
const { holds } = loadHolds(out, { window });
const n = holds.length;

const zero = () => Object.fromEntries(TIER_KEYS.map((k) => [k, 0]));
const count = (acc, tiers) => { for (const t of tiers) acc[t]++; };

// V2 one-session baseline (U1, session t only).
const base = { touch: zero(), close: zero() };
// Three-session candidates.
const cand = Object.fromEntries(UNIT_IDS.map((id) => [id, { touch: zero(), anyClose: zero(), endClose: zero(), perDayClose: [zero(), zero(), zero()], unitPct: [] }]));
const maxMultU1 = [];
for (const h of holds) {
  const F = FILL === 'prior_close' ? h.pc : h.p[0][0];
  const u1 = unitOf(h, 'U1');
  const [o0, h0, l0, c0] = h.p[0];
  count(base.touch, crossed(F, u1, { high: h0, low: l0, price: c0 }));
  count(base.close, crossed(F, u1, { high: c0, low: c0, price: c0 }));
  const maxH = Math.max(...h.p.map((d) => d[1])), minL = Math.min(...h.p.map((d) => d[2]));
  const closes = h.p.map((d) => d[3]);
  const end = closes[2];
  maxMultU1.push(rewardContext(F, u1, { high: maxH, low: minL, price: end }).history.maxMultiplier);
  for (const id of UNIT_IDS) {
    const u = unitOf(h, id);
    const c = cand[id];
    c.unitPct.push(u.scoringPct);
    count(c.touch, crossed(F, u, { high: maxH, low: minL, price: end }));
    count(c.anyClose, crossed(F, u, { high: Math.max(...closes), low: Math.min(...closes), price: end }));
    count(c.endClose, crossed(F, u, { high: end, low: end, price: end }));
    closes.forEach((cl, j) => count(c.perDayClose[j], crossed(F, u, { high: cl, low: cl, price: cl })));
  }
}

const rate = (x) => x / n;
const baseTouch = Object.fromEntries(TIER_KEYS.map((k) => [k, rate(base.touch[k])]));
const scored = UNIT_IDS.map((id) => {
  const t = Object.fromEntries(TIER_KEYS.map((k) => [k, rate(cand[id].touch[k])]));
  return { id, plus1Gap: Math.abs(t.bagger - baseTouch.bagger), meanGap: TIER_KEYS.reduce((s, k) => s + Math.abs(t[k] - baseTouch[k]), 0) / TIER_KEYS.length };
});
const recommended = [...scored].sort((a, b) => a.plus1Gap - b.plus1Gap || a.meanGap - b.meanGap)[0].id;
// Descriptive: the multiple of the one-day unit whose three-session +1.0 touch rate equals V2's one-session rate.
const matchScale = quantile(maxMultU1, 1 - baseTouch.bagger);

const P = (x) => `${(100 * x).toFixed(1)}%`;
const unitName = (id) => (id === 'U6' ? 'U6 measured 3-session ATR' : `${id} × ${id === 'U4' ? '√3' : UNIT_SCALES[id]}`);
const touchRows = [['V2 one session (U1)', '—', ...TIER_KEYS.map((k) => P(baseTouch[k]))],
  ...UNIT_IDS.map((id) => [unitName(id), fx(median(cand[id].unitPct), 2) + '%', ...TIER_KEYS.map((k) => P(rate(cand[id].touch[k])))])];
const closeRows = [['V2 one session (U1): the close', '—', ...TIER_KEYS.map((k) => P(rate(base.close[k])))],
  ...UNIT_IDS.flatMap((id) => [[`${unitName(id)}: any close`, '', ...TIER_KEYS.map((k) => P(rate(cand[id].anyClose[k])))],
    [`${unitName(id)}: end close`, '', ...TIER_KEYS.map((k) => P(rate(cand[id].endClose[k])))]])];
const perDayRows = UNIT_IDS.map((id) => [unitName(id), ...[0, 1, 2].map((j) => P(rate(cand[id].perDayClose[j].bagger))), ...[0, 1, 2].map((j) => P(rate(cand[id].perDayClose[j].bust)))]);

const result = { window, fill: FILL, holds: n, entrySessions: new Set(holds.map((h) => h.d)).size, firstEntry: holds[0].d, lastEntry: holds.at(-1).d,
  baseline: { touch: baseTouch, close: Object.fromEntries(TIER_KEYS.map((k) => [k, rate(base.close[k])])) },
  candidates: Object.fromEntries(UNIT_IDS.map((id) => [id, { medianUnitPct: median(cand[id].unitPct),
    touch: Object.fromEntries(TIER_KEYS.map((k) => [k, rate(cand[id].touch[k])])),
    anyClose: Object.fromEntries(TIER_KEYS.map((k) => [k, rate(cand[id].anyClose[k])])),
    endClose: Object.fromEntries(TIER_KEYS.map((k) => [k, rate(cand[id].endClose[k])])),
    perDayClose: cand[id].perDayClose.map((d) => Object.fromEntries(TIER_KEYS.map((k) => [k, rate(d[k])]))) }])),
  recommendation: { rule: RECOMMENDATION_RULE, scored, recommended }, matchScaleOfU1: matchScale,
  bonusKeys: BONUS_KEYS, penaltyKeys: PENALTY_KEYS };
writeJson(path.join(out, `step2-units${window === 'long' ? '-long' : ''}${FILL === 'prior_close' ? '-pcfill' : ''}.json`), result);

console.log(`# Step 2 — the unit (fill at the ${FILL === 'prior_close' ? 'PRIOR CLOSE' : 'open'}; ${window === 'long' ? 'LONG window' : "V2's window"}: ${n} holds, ${result.entrySessions} entry sessions, ${result.firstEntry} → ${result.lastEntry})\n`);
console.log(`## Touch on daily highs and lows, from the fill (${FILL === 'prior_close' ? 'the prior close' : 'the entry open'})\n`);
console.log(mdTable(['Hold and unit', 'Median unit', ...TIER_KEYS.map((k) => TIER_LABEL[k])], touchRows));
console.log('\n## Cleared at a close\n');
console.log(mdTable(['Hold and unit', '', ...TIER_KEYS.map((k) => TIER_LABEL[k])], closeRows));
console.log('\n## Each session\'s close (three-session holds)\n');
console.log(mdTable(['Unit', '+1.0 at close 1', 'close 2', 'close 3', '−1.0 at close 1', 'close 2', 'close 3'], perDayRows));
console.log(`\nRecommended (${RECOMMENDATION_RULE}): ${recommended}. Gaps to V2's one-session +1.0 touch rate: ${scored.map((s) => `${s.id} ${(100 * s.plus1Gap).toFixed(1)} pp`).join(', ')}.`);
console.log(`Exact scale of the one-day unit matching V2's +1.0 rarity on three-session holds: ×${matchScale.toFixed(3)} (before 6-dp quantization).`);
