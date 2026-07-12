// Session-5 §6.10/6.11 — null-never-zero on short histories, byte-identical determinism,
// earnings timing semantics, and the regime meter (spin-up nulls + a clean MOMO_ON).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonical } from '../02-build-levels.js';
import { assembleEventFeatures } from '../lib/features.js';
import { earningsAt, reportSessionIdxs } from '../lib/features-daily.js';
import { buildMarketContext } from '../lib/features-market.js';
import { mkEventFixture, mkSeries, buildSeries, synthBars, flat } from './_synthetic-features.js';

test('6.10 — null-never-zero: short histories yield null (not 0) across every starving feature', () => {
  // 60 daily bars, 3 baseline 5m sessions, touch 15 minutes into the session.
  const fx = mkEventFixture({ nDaily: 60, baselineDays: 3, touchEtMin: 585 });
  const row = assembleEventFeatures({ event: fx.event, series: fx.series, fiveMinByDate: fx.fiveMinByDate, sessionDates: fx.sessionDates });
  const f = row.features.pre_touch;
  const mustBeNull = [
    'rvol_approach',            // < 20 baseline sessions
    'approach_velocity',        // < 90 pre-touch minutes
    'consol_tightness',         // < 60 pre-touch minutes
    'accel_final_30m',          // < 13 pre-touch closes
    'dist_from_opening_range',  // touch inside the opening range
    'extension_pctile',         // < 252 trailing extension values
    'daily_atr_pctile',         // < 252 trailing values
    'range_compression_pctile', // < 252 trailing values
    'dist_52w_high_pct',        // < 252 daily bars
    'weekly_trend_state',       // < 50 weekly bars
    'monthly_trend_state',      // < 50 monthly bars
    'ret_60d_vs_spy',           // no benchmark provided
    'beta_60d',                 // no benchmark provided
    'sessions_since_last_earnings',      // no earnings data
    'sessions_to_expected_earnings',     // no earnings data
    'peer_level_event_rate_prior_5d',    // zero eligible peers (< 5)
    'momo_regime',              // no market context provided
    'vol_regime_pctile',
  ];
  for (const k of mustBeNull) {
    assert.notEqual(f[k], 0, `${k} must never be a fake 0`);
    assert.equal(f[k], null, `${k} must be null on a starving input (got ${f[k]})`);
  }
  assert.equal(f.eligible_peer_count, 0, 'eligible_peer_count is a true measured count — 0 is honest here');
});

test('6.10b — sessions_to_expected_earnings needs ≥2 prior reports (1 report → null, never a guess)', () => {
  const series = mkSeries(flat(100, 300), {});
  const one = earningsAt(series, 250, [100]);
  assert.equal(one.sessions_since_last_earnings, 150);
  assert.equal(one.sessions_to_expected_earnings, null, 'one report cannot produce an expected date');
  const three = earningsAt(series, 250, [100, 163, 226]); // gaps 63, 63 → expected 226+63 = 289
  assert.equal(three.sessions_to_expected_earnings, 289 - 250);
  assert.equal(three.sessions_to_next_earnings_actual, null, 'no future report in the calendar → null');
  const withNext = earningsAt(series, 250, [100, 163, 226, 285]);
  assert.equal(withNext.sessions_to_next_earnings_actual, 285 - 250, 'post_touch actual reads the current calendar');
  assert.equal(withNext.expected_vs_actual_earnings_error, (289 - 250) - (285 - 250));
  // a report ON the event date is not assumed known pre-touch (S5-C: conservative BMO/AMC treatment)
  const onD = earningsAt(series, 250, [250]);
  assert.equal(onD.sessions_since_last_earnings, null, 'a same-day report is post_touch information');
  assert.equal(onD.sessions_to_next_earnings_actual, 0);
});

test('reportSessionIdxs maps report dates to the first session ≥ date (weekend reports roll forward)', () => {
  const series = mkSeries(flat(100, 30), { start: '2024-06-03' }); // weekdays from a Monday
  const friday = series.dates[4], saturdayReport = '2024-06-08', monday = series.dates[5];
  assert.equal(series.dates[reportSessionIdxs(series, [friday])[0]], friday);
  assert.equal(series.dates[reportSessionIdxs(series, [saturdayReport])[0]], monday);
  // a report predating the series must NOT alias to a phantom session-0 report (review fix):
  // it would fabricate sessions_since_last_earnings and pollute the median inter-report gap.
  assert.deepEqual(reportSessionIdxs(series, ['2020-01-15']), [], 'pre-series report dropped');
  const idxs = reportSessionIdxs(series, ['2020-01-15', friday]);
  assert.deepEqual(idxs, [4], 'only the in-coverage report survives');
  const early = earningsAt(series, 10, reportSessionIdxs(series, ['2020-01-15']));
  assert.equal(early.sessions_since_last_earnings, null, 'no in-coverage report → null, not i−0');
});

test('6.11 — determinism: two identical assembly runs produce byte-identical feature sets', () => {
  const run = () => {
    const fx = mkEventFixture({});
    return assembleEventFeatures({ event: fx.event, series: fx.series, fiveMinByDate: fx.fiveMinByDate, sessionDates: fx.sessionDates });
  };
  assert.equal(canonical(run()), canonical(run()), 'independent rebuilds are byte-identical');
});

test('regime meter — spin-up sessions are null; a clean leader/laggard universe reads MOMO_ON after spin-up', () => {
  // 8 members: 3 sectors × (leader +0.3%/day, laggard −0.3%/day) + 2 flat names.
  const n = 300;
  const drift = (bps) => { const out = [100]; for (let i = 1; i < n; i++) out.push(out[i - 1] * (1 + bps)); return out; };
  const members = [];
  const sectors = ['XLK', 'XLP', 'XLV'];
  for (let s = 0; s < 3; s++) {
    members.push({ symbol: `L${s}`, sector: sectors[s], series: mkSeries(drift(0.003), {}) });
    members.push({ symbol: `G${s}`, sector: sectors[s], series: mkSeries(drift(-0.003), {}) });
  }
  members.push({ symbol: 'F1', sector: 'XLY', series: mkSeries(flat(100, n), {}) });
  members.push({ symbol: 'F2', sector: 'XLF', series: mkSeries(flat(100, n), {}) });
  const spy = mkSeries(flat(400, n), {});
  const dates = members[0].series.dates;
  const ctx = buildMarketContext({ sessionDates: dates, members, spy, sphb: null, splv: null });
  const early = ctx.get(dates[60]);   // before the 81-session spin-up
  const late = ctx.get(dates[n - 1]);
  assert.equal(early.momo_regime, null, 'the regime is null during the 81-session spin-up');
  assert.ok(late.sector_neutral_momo_spread_20d > 2, `persistent leaders vs laggards → spread ${late.sector_neutral_momo_spread_20d}%`);
  assert.equal(late.momo_regime, 'MOMO_ON');
  assert.ok(late.breadth_pct_above_20dma > 0 && late.breadth_pct_above_20dma < 100, 'breadth is a real mixed reading');
});

test('market features degrade to null (not 0) when SPY / SPHB / SPLV are absent', () => {
  const members = [{ symbol: 'A', sector: 'XLK', series: mkSeries(flat(100, 120), {}) }];
  const dates = members[0].series.dates;
  const ctx = buildMarketContext({ sessionDates: [dates[110]], members, spy: null, sphb: null, splv: null });
  const c = [...ctx.values()][0];
  assert.equal(c.beta_appetite_20d, null);
  assert.equal(c.vol_regime_pctile, null);
  assert.equal(c.sector_neutral_momo_spread_20d, null, 'no SPY → no rel-SPY ranking → null spread');
});
