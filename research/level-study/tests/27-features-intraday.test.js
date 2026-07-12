// Session-5 §6.8 + intraday correctness — time-of-day-matched RVOL, fingerprint sanity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intradayFeatures, rvolApproach, preTouchBars, rvolBucket, todBucket } from '../lib/features-intraday.js';
import { session5m } from './_synthetic-intraday.js';
import { mkEventFixture } from './_synthetic-features.js';
import { assembleEventFeatures } from '../lib/features.js';

const fullDay = (vol) => {
  const out = [];
  for (let et = 570; et <= 955; et += 5) out.push({ p: 100, v: typeof vol === 'function' ? vol(et) : vol });
  return out;
};

test('6.8 — RVOL baselines are time-of-day-matched: a 10:00 touch compares against 10:00 cumulatives', () => {
  // Baselines: 100/bar in the morning, 10,000/bar in the afternoon (et ≥ 780).
  const baseVol = (et) => (et < 780 ? 100 : 10000);
  const baselines = [];
  for (let k = 0; k < 20; k++) baselines.push(session5m(`2024-06-${String(k + 1).padStart(2, '0')}`, fullDay(baseVol)));
  // Event session: 100/bar. Touch at 10:00 (etMin 600): own cum = 6 bars × 100 = 600.
  const ev = session5m('2024-07-01', fullDay(100));
  const pre = preTouchBars(ev.regular, 600);
  const rvol = rvolApproach(pre, 600, baselines);
  // Time-matched baseline cum through 10:00 = 600 → rvol exactly 1.0. A whole-day baseline
  // (avg incl. the 10,000/bar afternoon) would be ~26× larger and rvol ~0.04.
  assert.ok(Math.abs(rvol - 1.0) < 1e-12, `10:00 touch vs 10:00 baseline → rvol 1.0 (got ${rvol})`);
  // The afternoon monster volume in the BASELINES must not leak into a morning cutoff.
  const rvolNoAfternoon = rvolApproach(pre, 600, baselines.map((s) => session5m(s.etDate, fullDay(100))));
  assert.equal(rvol, rvolNoAfternoon, 'post-cutoff baseline volume is invisible to a morning touch');
  // fewer than 20 baseline sessions → null (never a degraded average)
  assert.equal(rvolApproach(pre, 600, baselines.slice(0, 19)), null);
});

test('6.8b — RVOL is split-adjusted (S3-C1 basis): pre-split baselines compare 1:1 with post-split volume', () => {
  // Baselines are PRE-split sessions: raw volume 100/bar at adjFactor 0.1 (→ 1000 adjusted shares).
  // The event session is POST-split: raw volume 1000/bar at adjFactor 1 (→ 1000 adjusted shares).
  // On the adjusted basis activity is IDENTICAL → rvol must be exactly 1.0 (raw comparison → 10×).
  const mkSess = (etDate, rawVol, f) => {
    const bars = [];
    for (let et = 570; et <= 955; et += 5) {
      const b = { etMinutes: et, adjFactor: f, volume: rawVol, adjOpen: 100, adjHigh: 100.02, adjLow: 99.98, adjClose: 100, epoch: 0 };
      bars.push(b);
    }
    return { etDate, regular: bars };
  };
  const baselines = [];
  for (let k = 0; k < 20; k++) baselines.push(mkSess(`2024-05-${String(k + 1).padStart(2, '0')}`, 100, 0.1));
  const ev = mkSess('2024-06-14', 1000, 1);
  const pre = preTouchBars(ev.regular, 600);
  const rvol = rvolApproach(pre, 600, baselines);
  assert.ok(Math.abs(rvol - 1.0) < 1e-9, `identical adjusted activity across a 10:1 split → rvol 1.0 (got ${rvol})`);
});

test('rvol buckets follow the pre-registered edges (S5-C1: <0.8 / 0.8–1.5 / ≥1.5)', () => {
  assert.equal(rvolBucket(0.79), 'LOW');
  assert.equal(rvolBucket(0.8), 'MID');
  assert.equal(rvolBucket(1.49), 'MID');
  assert.equal(rvolBucket(1.5), 'HIGH');
  assert.equal(rvolBucket(null), null);
});

test('tod_bucket uses the S3-R1 ET cutoffs', () => {
  assert.equal(todBucket(570), 'open');
  assert.equal(todBucket(629), 'open');
  assert.equal(todBucket(630), 'midday');
  assert.equal(todBucket(869), 'midday');
  assert.equal(todBucket(870), 'power');
  assert.equal(todBucket(955), 'power');
});

test('fingerprint sanity — velocity, vwap, gap and OR30 computed from pre-touch bars only', () => {
  // steady climb 100 → 104 over the morning, touch at 12:00; ATR 2.
  const prices = [];
  for (let et = 570, k = 0; et <= 955; et += 5, k++) prices.push({ p: 100 + Math.min(k, 30) * 0.1, v: 1000 });
  const s = session5m('2024-07-01', prices);
  const f = intradayFeatures({ sessionBars: s.regular, touchEtMin: 720, prevSessionCloseAdj: 99, atrDaily: 2, side: 'support', baselineSessions: [] });
  assert.ok(f.approach_velocity > 0, 'climbing into the touch → positive velocity');
  assert.equal(f.vwap_side, 'above', 'price above its session VWAP on a steady climb');
  assert.ok(f.path_efficiency > 0.9, 'a monotone climb is near-perfectly efficient');
  assert.equal(f.gap_context, 'away', 'support with an up-gap (100 vs prev 99, 0.5 ATR) gaps AWAY from the level');
  assert.ok(f.dist_from_opening_range > 0, 'price beyond the OR30 high → positive ATR distance');
  assert.ok(f.hl_progression > 0.5, 'higher-highs/higher-lows dominate');
  assert.equal(f.rvol_approach, null, 'no baselines → null, never a fake 1.0');
  assert.equal(f.prior_probe_count, 0, 'S4 episode model: touchAt is the first zone entry (structural zero, recorded)');
});

test('a touch on the session’s first bar nulls every intraday feature (uniform touch-bar rule)', () => {
  const fx = mkEventFixture({ touchEtMin: 570 });
  const row = assembleEventFeatures({ event: fx.event, series: fx.series, fiveMinByDate: fx.fiveMinByDate, sessionDates: fx.sessionDates });
  const f = row.features.pre_touch;
  for (const k of ['approach_velocity', 'rvol_approach', 'vwap_side', 'vwap_dist', 'consol_tightness', 'gap_context',
    'path_efficiency', 'accel_final_30m', 'pullback_depth_max', 'hl_progression', 'dist_from_opening_range',
    'dist_from_session_extreme', 'vol_slope_into_touch']) {
    assert.equal(f[k], null, `${k} must be null when no pre-touch bar exists`);
  }
  assert.equal(f.tod_bucket, 'open', 'the touch timestamp itself is known at the touch');
  assert.ok(row.knownAt != null, 'knownAt falls back to the prior session’s last bar');
});
