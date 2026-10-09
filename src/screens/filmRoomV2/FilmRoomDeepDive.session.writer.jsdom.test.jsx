// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomDeepDive.session.writer.jsdom.test.jsx
//
// Astra's A2 review, F2 (Amendment E addendum 2: "close" names the calendar's
// session-close instant, never the end of the last available bar). The Deep
// dive's time axis is the tape day's TRADING SESSION from the calendar the tape
// writers use — never the bars' extent. Each case mounts the REAL close and
// candle passes' output (buildTapeDay):
//   (a) Astra's repro: the Sep-23 day with only INTC's first 30 one-minute bars
//       — the axis still runs 9:30 to the 4:00 PM close, INTC's bars end at
//       10:00 AM with the tail blank, and "close" is not at 10:00 AM;
//   (b) an early close the calendar lists (2026-11-27, the day after
//       Thanksgiving), synthetic bars through the real candle pass — "close"
//       at 1:00 PM ET, no tick beyond it;
//   (c) the full session (the committed Sep-23 fixture): unchanged.
// And a date the calendar does not know as a session names no close at all.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL passes, never mocked;
// only the writer flag is mocked on (spreading the real module).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

vi.mock('../../config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
}));

import FilmRoomDeepDive from './FilmRoomDeepDive';
import { etClock } from './filmRoomModel';
import { mounter, sep23Tape, sep23Series, clone } from './__fixtures__/filmRoomHarness';
import { sep23Day, sep23Bars, buildTapeDay, SEP23_NIGHT, SEP23_MORNING } from '../../../api/_utils/filmTape/__fixtures__/screenFixtures.js';
import { earlyCloseDay } from '../../../api/_utils/filmTape/__fixtures__/tapeFixtures.js';
import { sessionRows } from '../../../api/_utils/filmTape/__fixtures__/tapeBars.js';

vi.setConfig({ testTimeout: 60_000 });

const m = mounter();
beforeEach(() => m.setup());
afterEach(() => m.teardown());

const mount = (tape, series, sym) => m.render(<FilmRoomDeepDive tape={tape} seriesState={{ status: 'ready', series }} sym={sym} onSym={() => {}} />);
/** The chart's drawn points, from an SVG path. */
const points = (d) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((p) => ({ x: Number(p[1]), y: Number(p[2]) }));
/** The last close label's distance from the plot's right edge, in % of its width (its `right: calc(p% + 2px)`). */
const lastCloseRight = () => Number(m.q('[data-axis-record="lastClose"]').style.right.match(/^calc\((-?[\d.]+)% \+ 2px\)$/)[1]);
/** Where an instant sits on a [start, end] domain, in the chart's 0–1000 units. */
const xOn = (iso, start, end) => ((Date.parse(iso) - Date.parse(start)) / (Date.parse(end) - Date.parse(start))) * 1000;

function axisOf() {
  const plot = m.q('[data-region="price-chart"] [data-plot]');
  const axis = m.q('[data-time-axis]');
  const end = axis.lastElementChild;
  return {
    domain: [plot.getAttribute('data-domain-start'), plot.getAttribute('data-domain-end')],
    first: axis.firstElementChild.textContent,
    end: { kind: end.getAttribute('data-axis-end'), text: end.textContent, at: end.getAttribute('data-at'), right: end.style.right },
    ticks: m.qa('[data-time-tick]').map((t) => t.getAttribute('data-at')),
    text: axis.textContent,
  };
}

describe('F2 — the time axis is the trading session; "close" is the calendar\'s close, never the last bar\'s end', () => {
  it('(a) Astra\'s repro: INTC\'s series ends at 10:00 AM — the axis still runs 9:30 to the 4:00 PM close, the tail blank', async () => {
    const bars = sep23Bars();
    bars.INTC = bars.INTC.slice(0, 30);   // the pre-market row and the session's first 29 minutes, as the review fed it
    const { tape, series } = await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars });
    const doc = series.find((s) => s.symbol === 'INTC');
    expect(doc.bars.map((b) => b.t)).toEqual(['2026-09-23T13:30:00.000Z', '2026-09-23T13:40:00.000Z', '2026-09-23T13:50:00.000Z']);
    expect(tape.passes.candles.symbolsIncomplete.some((s) => (s?.symbol ?? s) === 'INTC')).toBe(true);
    mount(tape, series, 'INTC');
    const a = axisOf();
    expect(a.domain).toEqual(['2026-09-23T13:30:00.000Z', '2026-09-23T20:00:00.000Z']);
    expect(a.first).toBe('9:30');
    expect(a.end).toEqual({ kind: 'close', text: 'close', at: '2026-09-23T20:00:00.000Z', right: '0px' });
    expect(etClock(a.end.at)).toBe('4:00 PM');
    expect(a.ticks).toEqual(['2026-09-23T15:00:00.000Z', '2026-09-23T16:30:00.000Z', '2026-09-23T18:00:00.000Z']);   // 11:00, 12:30, 2:00
    expect(a.text).toBe('9:3011:0012:302:00close');
    // INTC's bars end at 10:00 AM ET: its line stops there, on the session's scale, and nothing of its own is drawn after
    const tenAm = xOn('2026-09-23T14:00:00.000Z', ...a.domain);
    expect(tenAm).toBeCloseTo(76.92, 2);
    const xs = points(m.q('[data-line="price"]').getAttribute('d')).map((p) => p.x);
    expect(xs).toHaveLength(3);
    expect(Math.max(...xs)).toBeCloseTo(tenAm, 0);
    for (const r of m.qa('[data-volume-bar]')) expect(Number(r.getAttribute('x')) + Number(r.getAttribute('width'))).toBeLessThanOrEqual(tenAm);
    // its last close sits at the end of its own line, not out in the blank tail beside "close"
    expect(lastCloseRight()).toBeCloseTo(100 - tenAm / 10, 2);
    // "close" is not at the 10:00 AM position: the only "close" on the axis is at the calendar's close
    expect(m.qa('[data-time-axis] > *').filter((el) => el.textContent === 'close').map((el) => el.getAttribute('data-at'))).toEqual(['2026-09-23T20:00:00.000Z']);
    // the incomplete series' session facts stay suppressed (unchanged)
    expect(m.q('[data-region="symbol-facts"]').textContent).not.toContain('Change · open to close');
    expect(m.q('[data-region="symbol-facts"]').textContent).toContain('Close · the last 10-minute bar');
  });

  it('(a′) a missing HEAD stays blank too: INTC\'s series starts at 10:00 AM — the axis still opens at 9:30', async () => {
    const bars = sep23Bars();
    bars.INTC = bars.INTC.filter((r) => r.timestamp * 1000 >= Date.parse('2026-09-23T14:00:00.000Z'));   // no rows before 10:00 AM ET
    const { tape, series } = await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars });
    const doc = series.find((s) => s.symbol === 'INTC');
    expect(doc.bars[0].t).toBe('2026-09-23T14:00:00.000Z');
    mount(tape, series, 'INTC');
    const a = axisOf();
    expect(a.domain).toEqual(['2026-09-23T13:30:00.000Z', '2026-09-23T20:00:00.000Z']);
    expect(a.first).toBe('9:30');
    expect(a.end).toEqual({ kind: 'close', text: 'close', at: '2026-09-23T20:00:00.000Z', right: '0px' });
    // the line starts at its first bar's close (10:10), with the 9:30–10:00 head blank
    const xs = points(m.q('[data-line="price"]').getAttribute('d')).map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(xOn('2026-09-23T14:10:00.000Z', ...a.domain), 0);
    for (const r of m.qa('[data-volume-bar]')) expect(Number(r.getAttribute('x'))).toBeGreaterThanOrEqual(xOn('2026-09-23T14:00:00.000Z', ...a.domain));
  });

  it('(b) an early close the calendar lists (2026-11-27): the axis ends at the 1:00 PM ET close — no 16:00, no tick past it', async () => {
    const fx = await earlyCloseDay();
    expect(fx.etDate).toBe('2026-11-27');
    const synth = (sym, i) => Math.round((100 + sym.charCodeAt(0) + sym.length) * (1 + 0.002 * Math.sin(i / 23)) * 100) / 100;
    // synthetic 1-minute rows for whatever the candle pass asks for — a FULL 390 minutes from the 9:30 open, so the cut at 1:00 PM is the pass's own
    const bars = new Proxy({}, { get: (_, sym) => (typeof sym === 'string' ? sessionRows(fx.etDate, (i) => synth(sym, i), { openUtc: '14:30' }) : undefined) });
    const { tape, series } = await buildTapeDay(fx, { night: Date.parse('2026-11-28T02:15:30.000Z'), morning: Date.parse('2026-11-28T11:00:30.000Z'), bars });
    const doc = series.find((s) => s.symbol === 'AAPL');
    expect(doc.bars).toHaveLength(21);   // 9:30 to 1:00 PM in 10-minute bars — the real candle pass's session cut
    expect(doc.bars.at(-1).t).toBe('2026-11-27T17:50:00.000Z');
    mount(tape, series, 'AAPL');
    const a = axisOf();
    expect(a.domain).toEqual(['2026-11-27T14:30:00.000Z', '2026-11-27T18:00:00.000Z']);
    expect(a.end).toEqual({ kind: 'close', text: 'close', at: '2026-11-27T18:00:00.000Z', right: '0px' });
    expect(etClock(a.end.at)).toBe('1:00 PM');
    expect(a.ticks).toEqual(['2026-11-27T16:00:00.000Z']);   // 11:00 — the next would be 12:30, within half a step of the close
    for (const t of a.ticks) expect(Date.parse(t)).toBeLessThan(Date.parse(a.end.at));
    expect(a.text).toBe('9:3011:00close');
    // the whole early session drawn: the line reaches the close
    expect(Math.max(...points(m.q('[data-line="price"]').getAttribute('d')).map((p) => p.x))).toBeCloseTo(1000, 0);
  });

  it('(c) the full session (the committed Sep-23 fixture): unchanged — the session is the bars\' own span, the line reaches "close"', () => {
    for (const sym of ['MSFT', 'INTC', 'PANW']) {
      mount(sep23Tape, sep23Series, sym);
      const doc = sep23Series.find((s) => s.symbol === sym);
      const a = axisOf();
      expect(a.domain, sym).toEqual([doc.sessionOpen.at, new Date(Date.parse(doc.bars.at(-1).t) + 600_000).toISOString()]);
      expect(a.end, sym).toEqual({ kind: 'close', text: 'close', at: '2026-09-23T20:00:00.000Z', right: '0px' });
      expect(a.text, sym).toBe('9:3011:0012:302:00close');
      expect(Math.max(...points(m.q('[data-line="price"]').getAttribute('d')).map((p) => p.x)), sym).toBeCloseTo(1000, 0);
      expect(lastCloseRight(), sym).toBeCloseTo(0, 6);
    }
  });

  it('a date the calendar does not know as a session names no close: the right end is the last bar\'s end, as a time', () => {
    const t = clone(sep23Tape);
    t.etDate = '2026-09-26';   // a Saturday: no session in the calendar
    mount(t, sep23Series, 'MSFT');
    const a = axisOf();
    expect(a.end).toEqual({ kind: 'last-bar', text: '4:00', at: '2026-09-23T20:00:00.000Z', right: '0px' });
    expect(a.text).not.toMatch(/close/);
  });
});
