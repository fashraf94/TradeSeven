// Session-5 §6.6/6.7/6.9 — extension sign-normalization, own-history percentiles, leg lifecycle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legOriginAt, extensionAt, baseCountAt, moveOriginAt } from '../lib/features-daily.js';
import { mkSeries, flat } from './_synthetic-features.js';

// Path builders: gentle bar ranges (h=0.25) keep ATR small so 3-ATR advances are unambiguous.
const H = { h: 0.25 };
const vDip = (base, depth) => [base - depth / 4, base - depth / 2, base - (3 * depth) / 4, base - depth, base - (3 * depth) / 4, base - depth / 2, base - depth / 4];
const ramp = (from, to, step) => { const out = []; for (let v = from; step > 0 ? v <= to : v >= to; v += step) out.push(v); return out; };

test('6.9a — INVALIDATION: a daily close below the leg origin kills the leg', () => {
  const closes = [...flat(100, 30), ...vDip(100, 2), ...ramp(100, 106, 0.5)];
  let s = mkSeries(closes, H);
  const leg = legOriginAt(s, s.n - 1, 'up');
  assert.ok(leg, 'the dip-and-advance founds a leg');
  assert.ok(Math.abs(leg.originPrice - 97.75) < 0.01, `origin at the swing low (${leg.originPrice})`);
  // now close below the origin
  s = mkSeries([...closes, 97], H);
  assert.equal(legOriginAt(s, s.n - 1, 'up'), null, 'a close below the origin invalidates the leg');
});

test('6.9b — DEEP-PULLBACK RESET: >50% retrace + new swing + fresh ≥3-ATR advance moves the origin', () => {
  const up1 = [...flat(100, 30), ...vDip(100, 2), ...ramp(100, 106, 0.5)]; // origin1 ≈ 97.75, leg high ≈ 106.25
  // deep pullback: retrace to ~101.5 ((106.25−101.25)/8.5 ≈ 59% > 50%), V-swing, fresh advance
  const deep = [...ramp(105, 102, -0.5), ...vDip(102, 0.5), ...ramp(102.5, 107, 0.5)];
  const s = mkSeries([...up1, ...deep], H);
  const leg = legOriginAt(s, s.n - 1, 'up');
  assert.ok(leg, 'the leg survives via the reset');
  assert.ok(leg.originPrice > 101 && leg.originPrice < 102, `origin RESET to the deep-pullback swing (${leg.originPrice})`);
});

test('6.9c — SHALLOW pullbacks never move the origin (the negative control)', () => {
  const up1 = [...flat(100, 30), ...vDip(100, 2), ...ramp(100, 112, 0.5)]; // gain ≈ 14.5
  const shallow = [...ramp(111.5, 110, -0.5), ...vDip(110, 0.5), ...ramp(110.5, 115, 0.5)]; // retrace ~17%
  const s = mkSeries([...up1, ...shallow], H);
  const leg = legOriginAt(s, s.n - 1, 'up');
  assert.ok(leg, 'leg alive');
  assert.ok(Math.abs(leg.originPrice - 97.75) < 0.01, `origin UNCHANGED after a shallow pullback (${leg.originPrice})`);
});

test('6.9d — SIDEWAYS RESET: ≥30 sessions inside a 2.5-ATR band ends the leg; MOST-RECENT wins on multiple resets', () => {
  const up1 = [...flat(100, 30), ...vDip(100, 2), ...ramp(100, 106, 0.5)];
  const sideways = mkSeries([...up1, ...flat(106, 35)], H);
  assert.equal(legOriginAt(sideways, sideways.n - 1, 'up'), null, '35 flat sessions inside the band end the leg');

  // most-recent-wins: two successive deep-pullback cycles → the LATEST qualifying swing owns the leg
  const deep1 = [...ramp(105, 102, -0.5), ...vDip(102, 0.5), ...ramp(102.5, 108, 0.5)];   // reset #1 ≈ 101.5
  const deep2 = [...ramp(107.5, 103.5, -0.5), ...vDip(103.5, 0.5), ...ramp(104, 110, 0.5)]; // reset #2 ≈ 103
  const s = mkSeries([...up1, ...deep1, ...deep2], H);
  const leg = legOriginAt(s, s.n - 1, 'up');
  assert.ok(leg && leg.originPrice > 102.5, `most recent qualifying origin wins (${leg && leg.originPrice})`);
});

test('6.6 — extension sign-normalization: resistance far BELOW the 50DMA is highly extended (the S3-era asymmetry bug)', () => {
  // ~560 sessions oscillating around the mean, then a steadily deepening 60-session downtrend.
  const hist = flat(100, 560).map((v, i) => v + Math.sin(i / 9) * 1.5);
  const crash = []; let px = 100;
  for (let i = 0; i < 60; i++) { px -= 0.3 + i * 0.02; crash.push(px); }
  const s = mkSeries([...hist, ...crash], H);
  const res = extensionAt(s, s.n - 1, 'resistance');
  const sup = extensionAt(s, s.n - 1, 'support');
  assert.ok(res.extension_in_trend_direction_atr > 0, 'resistance side: (50DMA − close)/ATR is positive far below the DMA');
  assert.ok(res.extension_pctile > 85, `resistance extension percentile is HIGH (${res.extension_pctile})`);
  assert.equal(res.extension_bucket, 'EXT');
  assert.ok(sup.extension_pctile < 15, `support side of the same tape is NOT extended (${sup.extension_pctile})`);
  assert.equal(sup.extension_bucket, 'NOT_EXT');
});

test('6.7 — percentiles are against the stock’s OWN sign-normalized series, never pooled', () => {
  const finalPush = (base) => { const out = []; for (let i = 0; i < 10; i++) out.push(base + (i + 1) * 0.2); return out; };
  const wild = flat(100, 560).map((v, i) => v + Math.sin(i / 40) * 8);   // ext history spans many ATR
  const tight = flat(100, 560).map((v, i) => v + Math.sin(i / 40) * 0.4); // ext history hugs zero
  const A = mkSeries([...wild, ...finalPush(wild[wild.length - 1])], H);
  const B = mkSeries([...tight, ...finalPush(tight[tight.length - 1])], H);
  const pA = extensionAt(A, A.n - 1, 'support').extension_pctile;
  const pB = extensionAt(B, B.n - 1, 'support').extension_pctile;
  assert.ok(pB > 90, `an identical +2 push is EXTREME against a tight own-history (${pB})`);
  assert.ok(pB > pA + 15, `own-history percentiles separate what a pooled distribution would conflate (A=${pA}, B=${pB})`);
});

test('base_count — ≥10-session 2.5-ATR bands after a ≥3-ATR advance are counted from the leg origin', () => {
  const up = [...flat(100, 30), ...vDip(100, 2), ...ramp(100, 106, 0.5)];
  const base1 = flat(106, 12), leg2 = ramp(106.5, 110, 0.5), base2 = flat(110, 15), leg3 = ramp(110.5, 113, 0.5);
  const s = mkSeries([...up, ...base1, ...leg2, ...base2, ...leg3], H);
  const leg = legOriginAt(s, s.n - 1, 'up');
  assert.ok(leg, 'leg alive through stacked bases');
  const bc = baseCountAt(s, s.n - 1, leg, 'up');
  assert.ok(bc >= 2, `two ≥10-session consolidations counted (${bc})`);
  const noBases = mkSeries(up, H);
  const leg0 = legOriginAt(noBases, noBases.n - 1, 'up');
  assert.equal(baseCountAt(noBases, noBases.n - 1, leg0, 'up'), 0, 'a clean single leg has zero bases');
});

test('move_origin — gap at the leg origin classifies EARNINGS_GAP / NON_EARNINGS_GAP / NO_GAP / null', async () => {
  const up = [...flat(100, 30), ...vDip(100, 2), ...ramp(100, 106, 0.5)];
  const smooth = mkSeries(up, H);
  const legS = legOriginAt(smooth, smooth.n - 1, 'up');
  assert.equal(moveOriginAt(smooth, smooth.n - 1, legS, []), 'NO_GAP');

  // synthBars glues open to the prior close (no gaps by construction) — inject a true OPEN gap on
  // the jump bar (index 37, right after the swing origin, within the first 5 sessions of the leg)
  const gapped = [...flat(100, 30), ...vDip(100, 2), 103, ...ramp(103.5, 108, 0.5)];
  const { synthBars } = await import('./_synthetic.js');
  const bars = synthBars(gapped, { start: '2022-01-03', h: 0.25 });
  bars[37] = { ...bars[37], open: bars[37].close }; // open 103 vs prior close 99.5 → a 3.5-point gap
  const { buildSeries } = await import('../lib/level-series.js');
  const g = buildSeries(bars);
  const legG = legOriginAt(g, g.n - 1, 'up');
  assert.ok(legG, 'gapped leg exists');
  assert.equal(moveOriginAt(g, g.n - 1, legG, []), 'NON_EARNINGS_GAP');
  assert.equal(moveOriginAt(g, g.n - 1, legG, [38]), 'EARNINGS_GAP', 'report within ±1 session of the GAP bar (37)');
  assert.equal(moveOriginAt(g, g.n - 1, legG, [33]), 'NON_EARNINGS_GAP', 'a report far from the gap does not reclassify it');
  assert.equal(moveOriginAt(g, g.n - 1, null, []), null, 'null leg origin → null move_origin (config)');

  // AVAILABILITY (review fix): an event-DAY report adjacent to a fresh gap is post-touch
  // information — dailyFeaturesAt must filter it out of the pre_touch move_origin classification.
  const { dailyFeaturesAt } = await import('../lib/features-daily.js');
  const i = 38; // event the session after the gap bar (L = 37); report lands ON the event date
  const withEventDayReport = dailyFeaturesAt(g, i, 'support', { reports: [38] });
  assert.equal(withEventDayReport.move_origin, 'NON_EARNINGS_GAP',
    'a report dated the event day must not flip a fresh gap to EARNINGS_GAP pre-touch');
  const withKnownReport = dailyFeaturesAt(g, i, 'support', { reports: [37] });
  assert.equal(withKnownReport.move_origin, 'EARNINGS_GAP', 'a report already known at D−1 classifies normally');
});
