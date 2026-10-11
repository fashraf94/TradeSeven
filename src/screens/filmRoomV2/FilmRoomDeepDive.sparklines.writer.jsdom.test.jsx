// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomDeepDive.sparklines.writer.jsdom.test.jsx
//
// Review A2A2-4 (the follow-up pass before 'on') — THE DESKTOP SPARKLINES ON
// TIME. Each "All symbols" sparkline places its closes by time on the same
// session domain as the Deep dive's chart (seriesDomain: the tape day's session
// from the shared calendar), never spaced by index — so a series that ends at
// 10:00 AM fills the first tenth of its sparkline, not all of it, and a gap
// breaks it as it breaks the chart. Writer-built days (the REAL close and
// candle passes):
//   (a) Astra's repro, INTC's first 30 one-minute rows: three bars;
//   (b) INTC with three interior buckets missing;
//   (c) the full session (the committed fixture).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL passes, never mocked;
// only the writer flag is mocked on (spreading the real module).

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React from 'react';

vi.mock('../../config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
}));

import FilmRoomDeepDive from './FilmRoomDeepDive';
import { sep23Day, sep23Bars, buildTapeDay, SEP23_NIGHT, SEP23_MORNING } from '../../../api/_utils/filmTape/__fixtures__/screenFixtures.js';
import { mounter, sep23Tape, sep23Series, clone } from './__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const m = mounter();
beforeEach(() => m.setup());
afterEach(() => m.teardown());

const Z = (hhmm) => Date.parse(`2026-09-23T${hhmm}:00.000Z`);
const OPEN = Z('13:30'); const CLOSE = Z('20:00');
const on100 = (ms) => ((ms - OPEN) / (CLOSE - OPEN)) * 100;
const runsOf = (d) => d.split('M').filter(Boolean).map((s) => [...`M${s}`.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((p) => ({ x: Number(p[1]), y: Number(p[2]) })));
const mini = (sym) => m.q(`[data-mini-line="${sym}"]`);
const mount = (tape, series, sym) => m.render(<FilmRoomDeepDive tape={tape} seriesState={{ status: 'ready', series }} sym={sym} onSym={() => {}} desktop />);

const days = {};
beforeAll(async () => {
  const partial = sep23Bars();
  partial.INTC = partial.INTC.slice(0, 30);
  days.partial = await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: partial });
  const gapped = sep23Bars();
  gapped.INTC = gapped.INTC.filter((r) => r.timestamp * 1000 < Z('15:00') || r.timestamp * 1000 >= Z('15:30'));
  days.gapped = await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: gapped });
});

describe('A2A2-4 — the desktop sparklines place points by time, on the Deep dive\'s session domain', () => {
  it('(a) Astra\'s repro: INTC\'s three bars sit at 9:40, 9:50 and 10:00 on the 9:30–4:00 session — the first tenth of the sparkline, not spread across it', () => {
    mount(days.partial.tape, days.partial.series, 'MSFT');
    const pts = runsOf(mini('INTC').getAttribute('d')).flat();
    expect(pts.map((p) => p.x)).toEqual([on100(Z('13:40')), on100(Z('13:50')), on100(Z('14:00'))].map((v) => Number(v.toFixed(1))));
    expect(Math.max(...pts.map((p) => p.x))).toBeLessThan(8);   // by index it would reach 100
    const svg = mini('INTC').closest('svg');
    expect([svg.getAttribute('data-mini-domain-start'), svg.getAttribute('data-mini-domain-end')]).toEqual(['2026-09-23T13:30:00.000Z', '2026-09-23T20:00:00.000Z']);
  });

  it('every sparkline\'s domain is the Deep dive chart\'s: the same session from the shared calendar, and each point where the chart puts it', () => {
    mount(days.partial.tape, days.partial.series, 'INTC');
    const plot = m.q('[data-region="price-chart"] [data-plot]');
    for (const svg of m.qa('[data-region="all-symbols"] svg[data-mini-domain-start]')) {
      expect([svg.getAttribute('data-mini-domain-start'), svg.getAttribute('data-mini-domain-end')]).toEqual([plot.getAttribute('data-domain-start'), plot.getAttribute('data-domain-end')]);
    }
    const chart = runsOf(m.q('[data-line="price"]').getAttribute('d')).flat().map((p) => p.x);
    const spark = runsOf(mini('INTC').getAttribute('d')).flat().map((p) => p.x * 10);
    expect(spark).toHaveLength(chart.length);
    spark.forEach((x, i) => expect(Math.abs(x - chart[i]), `point ${i}`).toBeLessThan(0.6));   // the sparkline's 0.1 rounding, on the chart's 0–1000 scale
  });

  it('(b) a gap breaks the sparkline as it breaks the chart', () => {
    mount(days.gapped.tape, days.gapped.series, 'MSFT');
    const runs = runsOf(mini('INTC').getAttribute('d'));
    expect(runs).toHaveLength(2);
    expect(runs[0].at(-1).x).toBeCloseTo(on100(Z('15:00')), 0);
    expect(runs[1][0].x).toBeCloseTo(on100(Z('15:40')), 0);
  });

  it('(c) the full session: the first close at 9:40, the last at the 4:00 close — one run', () => {
    mount(sep23Tape, sep23Series, 'MSFT');
    for (const sym of ['INTC', 'MSFT', 'PLTR']) {
      const runs = runsOf(mini(sym).getAttribute('d'));
      expect(runs, sym).toHaveLength(1);
      expect(runs[0][0].x, sym).toBeCloseTo(on100(Z('13:40')), 1);
      expect(runs[0].at(-1).x, sym).toBeCloseTo(100, 1);
    }
  });

  it('a date the calendar does not know as a session: the sparkline takes the chart\'s fallback domain too (the bars\' own extent)', () => {
    const t = clone(sep23Tape);
    t.etDate = '2026-09-26';   // a Saturday
    mount(t, sep23Series, 'MSFT');
    const plot = m.q('[data-region="price-chart"] [data-plot]');
    const svg = mini('MSFT').closest('svg');
    expect([svg.getAttribute('data-mini-domain-start'), svg.getAttribute('data-mini-domain-end')]).toEqual([plot.getAttribute('data-domain-start'), plot.getAttribute('data-domain-end')]);
  });
});
