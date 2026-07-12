// research/level-study/tests/_synthetic-features.js
//
// Session-5 feature-test fixtures: builds complete assembleEventFeatures() inputs from small
// knobs, plus the poison helpers the availability/leak tests use. Not matched by *.test.js.

import { buildSeries } from '../lib/level-series.js';
import { synthBars, weekdayDates, flat } from './_synthetic.js';
import { session5m, fiveMinMap } from './_synthetic-intraday.js';

export { buildSeries, synthBars, weekdayDates, flat, session5m, fiveMinMap };

/** Daily series from a closes array (adjFactor 1, symmetric range h). */
export function mkSeries(closes, opts = {}) {
  return buildSeries(synthBars(closes, { start: opts.start || '2022-01-03', h: opts.h ?? 0.5 }));
}

/**
 * POISON a bar in-place-copy: same date/shape, absurd OHLCV. If ANY feature reads it, outputs
 * shift massively — the leak tests assert byte-identical features with and without the poison.
 */
export function poisonDailyBar(bar) {
  return { ...bar, open: bar.open * 1000, high: bar.high * 1000, low: bar.low / 1000, close: bar.close * 1000, adjustedClose: bar.adjustedClose * 1000, volume: (bar.volume ?? 0) * 1e6 };
}

export function poison5mBar(b) {
  return { ...b, open: b.open * 1000, high: b.high * 1000, low: b.low / 1000, close: b.close * 1000, adjOpen: b.adjOpen * 1000, adjHigh: b.adjHigh * 1000, adjLow: b.adjLow / 1000, adjClose: b.adjClose * 1000, volume: (b.volume ?? 0) * 1e6 };
}

/** Poison every 5m bar of a session at or after etMin (the touch bar + everything later). */
export function poisonSessionFrom(session, etMin) {
  return { ...session, regular: session.regular.map((b) => (b.etMinutes >= etMin ? poison5mBar(b) : b)) };
}

/**
 * A complete single-symbol event fixture.
 * knobs: nDaily (default 620), dailyCloses override, touchEtMin (default 720 = 12:00),
 * baselineDays (default 21 identical 5m sessions before the event), sessionPrices override,
 * baselineVol per-bar volume, side, atrDaily.
 * The event date = the LAST daily date; 5m sessions are stamped on the last N daily dates.
 */
export function mkEventFixture(knobs = {}) {
  const nDaily = knobs.nDaily ?? 620;
  const closes = knobs.dailyCloses ?? flat(100, nDaily).map((v, i) => v + Math.sin(i / 7) * 2); // gentle wave: non-degenerate percentiles
  const series = mkSeries(closes, { start: knobs.start || '2022-01-03', h: knobs.h ?? 0.5 });
  const D = series.dates[series.n - 1];

  const touchEtMin = knobs.touchEtMin ?? 720;
  const nBaseline = knobs.baselineDays ?? 21;
  const mkPrices = (vol) => {
    const out = [];
    for (let et = 570; et <= 955; et += 5) out.push({ p: 100 + ((et / 5) % 3) * 0.05, v: vol(et) });
    return out;
  };
  const baseVol = knobs.baselineVol ?? (() => 1000);
  const sessions = [];
  for (let k = nBaseline; k >= 1; k--) sessions.push(session5m(series.dates[series.n - 1 - k], mkPrices(baseVol)));
  const eventPrices = knobs.sessionPrices ?? mkPrices(knobs.eventVol ?? (() => 1000));
  sessions.push(session5m(D, eventPrices, { startMin: knobs.startMin ?? 570 }));
  const fiveMinByDate = fiveMinMap(sessions);
  const sessionDates = sessions.map((s) => s.etDate);

  const touchBar = fiveMinByDate.get(D).regular.find((b) => b.etMinutes === touchEtMin);
  if (!touchBar) throw new Error(`fixture: no bar at etMin ${touchEtMin}`);
  const event = {
    eventId: `TST_fam000001_ep00`, symbol: 'TST', eventDate: D,
    side: knobs.side || 'support', familyTier: knobs.familyTier || 'F2',
    disposition: 'touch', sequenceIndex: 0,
    touchAt: new Date(touchBar.epoch * 1000).toISOString(),
    atrDaily: knobs.atrDaily ?? 1.0,
  };
  return { event, series, fiveMinByDate, sessionDates, D, touchEtMin };
}
