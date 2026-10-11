// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomDeepDive.gaps.writer.jsdom.test.jsx
//
// Review A2A2-3 (the follow-up pass before 'on') — NO LINE ACROSS A GAP, writer
// to screen. The Sep-23 day goes through the REAL close and candle passes with
// interior runs of 1-minute rows missing: INTC 11:00–11:30 AM ET (three
// 10-minute buckets), SPY 1:00–1:20 PM (two) and INTC's sector ETF 2:30–2:40 PM
// (one). The candle pass leaves those buckets out of the series (it never fills
// them), and the Deep dive's price line, its market line and its sector line
// each break there — no straight line across the gap, nothing interpolated —
// and no volume bar stands in a missing bucket. The full session is unchanged:
// one unbroken run per line.
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
import { mounter, sep23Tape, sep23Series, sweepNumbers, sweepWords, sweepSigns, storedNoteDefects } from './__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const m = mounter();
beforeEach(() => m.setup());
afterEach(() => m.teardown());

const Z = (hhmm) => Date.parse(`2026-09-23T${hhmm}:00.000Z`);
const OPEN = Z('13:30'); const CLOSE = Z('20:00');
const xOf = (ms) => ((ms - OPEN) / (CLOSE - OPEN)) * 1000;
const STEP_X = xOf(OPEN + 600_000);   // one 10-minute bucket on the session's scale (≈ 25.6)
/** A path's runs: each "M …" subpath as its points. */
const runsOf = (d) => d.split('M').filter(Boolean).map((s) => [...`M${s}`.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((p) => ({ x: Number(p[1]), y: Number(p[2]) })));
const without = (rows, from, to) => rows.filter((r) => r.timestamp * 1000 < Z(from) || r.timestamp * 1000 >= Z(to));

let built;
let sector;
beforeAll(async () => {
  const fx = await sep23Day();
  // INTC's sector ETF, as the close pass records it (comparables.sectors)
  sector = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sep23Bars() })).tape.comparables.sectors.INTC;
  const bars = sep23Bars();
  bars.INTC = without(bars.INTC, '15:00', '15:30');
  bars.SPY = without(bars.SPY, '17:00', '17:20');
  bars[sector] = without(bars[sector], '18:30', '18:40');
  built = await buildTapeDay(fx, { night: SEP23_NIGHT, morning: SEP23_MORNING, bars });
});

const mount = (tape, series, sym) => m.render(<FilmRoomDeepDive tape={tape} seriesState={{ status: 'ready', series }} sym={sym} onSym={() => {}} />);
const path = (line) => m.q(`[data-line="${line}"]`).getAttribute('d');

describe('A2A2-3 — the Deep dive\'s lines break where a 10-minute bucket is missing (writer-built series)', () => {
  it('the candle pass leaves the missing buckets OUT of the series — it never fills them', () => {
    const intc = built.series.find((s) => s.symbol === 'INTC');
    const ts = intc.bars.map((b) => b.t);
    for (const gone of ['15:00', '15:10', '15:20']) expect(ts).not.toContain(`2026-09-23T${gone}:00.000Z`);
    expect(ts).toContain('2026-09-23T14:50:00.000Z');
    expect(ts).toContain('2026-09-23T15:30:00.000Z');
    expect(intc.bars).toHaveLength(36);
    expect(sector).toBeTruthy();
  });

  it('the price line: two runs, the first ending at 11:00 AM (the 10:50 bar\'s close), the second starting at 11:40 (the 11:30 bar\'s) — no segment spans the gap', () => {
    mount(built.tape, built.series, 'INTC');
    const runs = runsOf(path('price'));
    expect(runs).toHaveLength(2);
    expect(runs[0].at(-1).x).toBeCloseTo(xOf(Z('15:00')), 0);
    expect(runs[1][0].x).toBeCloseTo(xOf(Z('15:40')), 0);
    for (const run of runs) for (let i = 1; i < run.length; i += 1) expect(run[i].x - run[i - 1].x).toBeLessThanOrEqual(STEP_X + 0.15);
    expect(runs.flat()).toHaveLength(36);   // every bar's close, and no point invented in the gap
    for (const p of runs.flat()) expect(p.x <= xOf(Z('15:00')) + 0.1 || p.x >= xOf(Z('15:40')) - 0.1).toBe(true);
  });

  it('no volume bar stands in a missing bucket', () => {
    mount(built.tape, built.series, 'INTC');
    const vols = m.qa('[data-volume-bar]').map((r) => Number(r.getAttribute('x')) - 2);
    expect(vols).toHaveLength(36);
    for (const gone of ['15:00', '15:10', '15:20']) expect(vols.some((x) => Math.abs(x - xOf(Z(gone))) < 0.5), gone).toBe(false);
    expect(vols.some((x) => Math.abs(x - xOf(Z('15:30'))) < 0.5)).toBe(true);
  });

  it('the comparables break at THEIR own gaps: the market line at SPY\'s, the sector line at the sector ETF\'s', () => {
    mount(built.tape, built.series, 'INTC');
    const market = runsOf(path('market'));
    expect(market).toHaveLength(2);
    expect(market[0].at(-1).x).toBeCloseTo(xOf(Z('17:00')), 0);
    expect(market[1][0].x).toBeCloseTo(xOf(Z('17:30')), 0);
    const sec = runsOf(path('sector'));
    expect(sec).toHaveLength(2);
    expect(sec[0].at(-1).x).toBeCloseTo(xOf(Z('18:30')), 0);
    expect(sec[1][0].x).toBeCloseTo(xOf(Z('18:50')), 0);
    for (const run of [...market, ...sec]) for (let i = 1; i < run.length; i += 1) expect(run[i].x - run[i - 1].x).toBeLessThanOrEqual(STEP_X + 0.15);
  });

  it('the gapped chart passes the sweeps', () => {
    mount(built.tape, built.series, 'INTC');
    const docs = { tape: built.tape, ...Object.fromEntries(built.series.map((s) => [`series:${s.symbol}`, s])) };
    expect(sweepNumbers(m.container, docs)).toEqual([]);
    expect(sweepWords(m.container, docs)).toEqual([]);
    expect(sweepSigns(m.container)).toEqual([]);
    expect(storedNoteDefects(m.container, docs)).toEqual([]);
  });

  it('the full session (the committed Sep-23 fixture) is unchanged: one unbroken run per line', () => {
    for (const sym of ['INTC', 'MSFT', 'PANW']) {
      mount(sep23Tape, sep23Series, sym);
      for (const line of ['price', 'market', 'sector']) expect(runsOf(path(line)), `${sym} ${line}`).toHaveLength(1);
      expect(runsOf(path('price'))[0], sym).toHaveLength(39);
    }
  });
});
