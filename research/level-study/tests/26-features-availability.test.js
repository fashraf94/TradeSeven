// Session-5 §6.1–6.5 — THE AVAILABILITY CONTRACT. The leak test is §6.1: a monster touch bar
// (and a poisoned event-date daily bar) must change NO pre_touch feature, byte for byte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonical } from '../02-build-levels.js';
import { assembleEventFeatures, assertAvailabilityClosure, FEATURE_MANIFEST, PRE_TOUCH_KEYS, POST_TOUCH_KEYS } from '../lib/features.js';
import { etfDirectionAtTouch } from '../lib/features-intraday.js';
import { buildMarketContext, groupFeaturesAt } from '../lib/features-market.js';
import { mkEventFixture, mkSeries, buildSeries, poisonDailyBar, poisonSessionFrom, session5m, fiveMinMap, synthBars, flat } from './_synthetic-features.js';

function assemble(fx, extra = {}) {
  return assembleEventFeatures({ event: fx.event, series: fx.series, fiveMinByDate: fx.fiveMinByDate, sessionDates: fx.sessionDates, ...extra });
}

test('6.1 THE LEAK TEST — a monster touch bar (huge spike + 1e6× volume) changes no pre_touch feature', () => {
  const fx = mkEventFixture({});
  const clean = assemble(fx);

  // Poison the touch bar AND every later bar of the event session (all post-touch information).
  const poisonedMap = new Map(fx.fiveMinByDate);
  poisonedMap.set(fx.D, poisonSessionFrom(fx.fiveMinByDate.get(fx.D), fx.touchEtMin));
  const poisoned = assembleEventFeatures({ event: fx.event, series: fx.series, fiveMinByDate: poisonedMap, sessionDates: fx.sessionDates });

  assert.equal(canonical(poisoned.features.pre_touch), canonical(clean.features.pre_touch),
    'pre_touch features must be byte-identical whether or not the touch bar (and everything after it) is poisoned');
  assert.equal(poisoned.knownAt, clean.knownAt, 'knownAt reads only pre-touch bars');
  // sanity: the poison is real — the touch bar differs massively between the two inputs
  const rawTouch = fx.fiveMinByDate.get(fx.D).regular.find((b) => b.etMinutes === fx.touchEtMin);
  const poiTouch = poisonedMap.get(fx.D).regular.find((b) => b.etMinutes === fx.touchEtMin);
  assert.ok(poiTouch.volume === rawTouch.volume * 1e6 && poiTouch.adjHigh > rawTouch.adjHigh * 100, 'fixture really poisoned the touch bar');
});

test('6.2 — no pre_touch daily feature reads the event-date daily bar (poisoned D bar → identical)', () => {
  const fx = mkEventFixture({});
  const clean = assemble(fx);
  // Rebuild the daily series with the EVENT-DATE bar poisoned (same date, absurd OHLCV).
  const bars = synthBars(flat(100, 620).map((v, i) => v + Math.sin(i / 7) * 2), { start: '2022-01-03', h: 0.5 });
  bars[bars.length - 1] = poisonDailyBar(bars[bars.length - 1]);
  const poisonedSeries = buildSeries(bars);
  const poisoned = assembleEventFeatures({ event: fx.event, series: poisonedSeries, fiveMinByDate: fx.fiveMinByDate, sessionDates: fx.sessionDates });
  assert.equal(canonical(poisoned.features.pre_touch), canonical(clean.features.pre_touch),
    'daily features are computed strictly from D−1 backward');
});

test('6.2b — the market context at D ignores every member\'s event-date daily bar', () => {
  const closes = flat(100, 300).map((v, i) => v + Math.sin(i / 5) * 3);
  const build = (poison) => {
    const members = ['A', 'B', 'C', 'D', 'E'].map((sym, k) => {
      const bars = synthBars(closes.map((c) => c + k), { start: '2022-01-03', h: 0.5 });
      if (poison) bars[bars.length - 1] = poisonDailyBar(bars[bars.length - 1]);
      return { symbol: sym, sector: k < 3 ? 'XLK' : 'XLP', series: buildSeries(bars) };
    });
    const spy = mkSeries(closes.map((c) => c * 2), {});
    const lastDate = members[0].series.dates[members[0].series.n - 1];
    return [...buildMarketContext({ sessionDates: [lastDate], members, spy, sphb: null, splv: null }).values()][0];
  };
  assert.equal(canonical(build(true)), canonical(build(false)), 'market context at D uses members strictly through D−1');
});

test('6.3 — ETF direction uses the last FULLY COMPLETED ETF bar strictly before touchAt', () => {
  const etf = session5m('2024-06-10', [500, 501, 499]); // bars at etMin 570, 575, 580
  // touch mid-ETF-bar at etMin 578: bar 575 (ends 580) contains the touch → unusable; last usable = 570.
  assert.equal(etfDirectionAtTouch(etf.regular, 578, 500.5), 'DOWN', 'mid-bar touch → only the 570 bar (close 500 < 500.5) is complete');
  // touch exactly at 580: bar 575's window [575,580) sits strictly before the touch → usable.
  assert.equal(etfDirectionAtTouch(etf.regular, 580, 500.5), 'UP', 'bar ending exactly at touchAt is complete (close 501 > 500.5)');
  // nothing completed yet → null; missing prior close → null
  assert.equal(etfDirectionAtTouch(etf.regular, 570, 500.5), null);
  assert.equal(etfDirectionAtTouch(etf.regular, 580, null), null);
});

test('6.4 — peer prior_5d windows contain no future sessions; next_5d is post_touch only', () => {
  const closes = flat(100, 120);
  const series = mkSeries(closes, {});
  const i = series.n - 6; // event date with 5 future sessions available
  const prior = series.dates.slice(i - 5, i);
  const futureDate = series.dates[i + 2];
  const mkPeer = (sym, evDates) => ({ symbol: sym, series: mkSeries(closes, {}), events: evDates.map((d, k) => ({ eventId: `${sym}_${k}`, eventDate: d, disposition: 'touch' })) });
  const peers = [
    mkPeer('P1', [prior[0]]), mkPeer('P2', [futureDate]), mkPeer('P3', [futureDate]),
    mkPeer('P4', []), mkPeer('P5', [prior[4], futureDate]),
  ];
  const g = groupFeaturesAt({ series, i, peers, spy: null, sector: null });
  assert.equal(g.eligible_peer_count, 5);
  assert.equal(g.peer_level_event_rate_prior_5d, 2 / 5, 'only P1 and P5 have PRIOR-window events; future events never count');
  assert.equal(g.peer_level_event_rate_next_5d, 3 / 5, 'the next_5d rate sees the future — which is exactly why it is post_touch');
  assert.equal(FEATURE_MANIFEST.peer_level_event_rate_next_5d.class, 'post_touch');
  assert.ok(!PRE_TOUCH_KEYS.includes('peer_level_event_rate_next_5d'), 'next_5d is absent from the pre_touch set');
});

test('6.5 — availability closure is machine-checked: every feature classed; post never leaks into pre', () => {
  const fx = mkEventFixture({});
  const row = assemble(fx);
  assert.ok(assertAvailabilityClosure(row.features), 'assembled output passes closure');
  assert.deepEqual([...POST_TOUCH_KEYS].sort(), ['expected_vs_actual_earnings_error', 'peer_level_event_rate_next_5d', 'sessions_to_next_earnings_actual'],
    'exactly the three descriptive-only features are post_touch');
  // tampering: promoting a post_touch feature into pre_touch must throw
  const tampered = { pre_touch: { ...row.features.pre_touch, peer_level_event_rate_next_5d: 0.5 }, post_touch: row.features.post_touch };
  assert.throws(() => assertAvailabilityClosure(tampered), /post_touch but emitted as pre_touch/);
  // an unregistered feature must throw
  const rogue = { pre_touch: { ...row.features.pre_touch, sneaky_future_feature: 1 }, post_touch: row.features.post_touch };
  assert.throws(() => assertAvailabilityClosure(rogue), /unregistered/);
});
