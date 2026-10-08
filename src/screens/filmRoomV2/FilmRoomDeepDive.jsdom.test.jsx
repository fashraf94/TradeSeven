// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomDeepDive.jsdom.test.jsx
//
// Film Room A2 item 8 — DEEP DIVE (V1.2 §7, BA-12, BA-13; Amendment E BA-43).
// Mounted from the A1 passes' own tape and series documents: symbol chips, the
// 10-minute price chart with the session open, the market and sector lines and
// volume, entry/exit marks at the swaps' recorded times, side facts, the
// all-symbols minis, and THE EVIDENCE OVERLAY — a marker at each stamp's
// recorded px, the platform's quote, never a replay point.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import FilmRoomDeepDive from './FilmRoomDeepDive';
import { mounter, sep23Tape, sep23Series, emptyTape, emptySeries, sweepNumbers, sweepWords, sweepSigns } from './__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 20_000 });

const m = mounter();
beforeEach(() => m.setup());
afterEach(() => m.teardown());

function Harness({ tape, series, start = null, desktop = false }) {
  const [sym, setSym] = React.useState(start);
  return <FilmRoomDeepDive tape={tape} seriesState={{ status: 'ready', series }} sym={sym} onSym={setSym} desktop={desktop} />;
}
const docsFor = (tape, series) => ({ tape, ...Object.fromEntries(series.map((s) => [`series:${s.symbol}`, s])) });
const chip = (s) => m.qa('[data-region="symbol-picker"] button').find((b) => b.textContent === s);

describe('the chart and its lines (BA-12, BA-13)', () => {
  it('symbol chips: the day\'s held set first, then the day\'s other names — never the market or sector comparables', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} />);
    const names = m.qa('[data-region="symbol-picker"] button').map((b) => b.textContent);
    expect(names.slice(0, 7)).toEqual(['AMD', 'BTC', 'DE', 'ETN', 'INTC', 'META', 'MSFT']);
    for (const s of ['PLTR', 'PANW', 'CRWD', 'MU']) expect(names).toContain(s);
    for (const s of ['SPY', 'RSP', 'XLK', 'XLI']) expect(names).not.toContain(s);
  });

  it('the price, the session open, the market and sector lines, volume — each toggled by its chip; labelled market', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="MSFT" />);
    const chart = m.q('[data-region="price-chart"]');
    expect(chart.getAttribute('data-symbol')).toBe('MSFT');
    for (const l of ['price', 'session-open', 'market', 'sector']) expect(chart.querySelector(`[data-line="${l}"]`), l).toBeTruthy();
    expect(chart.querySelectorAll('[data-volume-bar]').length).toBe(sep23Series.find((s) => s.symbol === 'MSFT').bars.length);
    expect(m.q('[data-region="chart-legend"]').textContent).toContain('Sector · XLK');
    const legendMarks = m.qa('[data-region="chart-legend"] [data-kind-mark]').map((k) => k.getAttribute('data-kind-mark'));
    expect(new Set(legendMarks)).toEqual(new Set(['market']));
    m.click(m.qa('[data-region="chart-legend"] button').find((b) => b.textContent.startsWith('Market')));
    expect(m.q('[data-line="market"]')).toBeNull();
    m.click(m.qa('[data-region="chart-legend"] button').find((b) => b.textContent.startsWith('Volume')));
    expect(m.q('[data-volume-bar]')).toBeNull();
  });

  it('a swap on the symbol is marked at its recorded time, with who made the exit', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="MSFT" />);
    expect(m.q('[data-swap-mark="0"]')).toBeTruthy();
    expect(m.q('[data-swap-label="0"]').textContent).toBe('Exit · 12:45 PM · Exit by platform rule · stagnation');
    m.click(chip('PLTR'));
    expect(m.q('[data-swap-label="1"]').textContent).toBe('Entry · 2:00 PM · Exit by the agent · its own decision');
  });

  it('side facts: the record\'s own prices (the session open, the last close), market class; the role from the tape — no session high or low (A2L1-4)', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="DE" />);
    const facts = m.q('[data-region="symbol-facts"]');
    expect(facts.textContent).toContain('exited at 2:00 PM · Exit by the agent · its own decision');
    const paths = [...facts.querySelectorAll('[data-num]')].map((e) => e.getAttribute('data-num'));
    const de = sep23Series.find((s) => s.symbol === 'DE');
    expect(paths).toEqual(['sessionOpen.value', `bars[${de.bars.length - 1}].c`]);
    expect(m.container.querySelector('[data-num$=".h"], [data-num$=".l"]')).toBeNull();
    expect(m.container.textContent).not.toMatch(/session high|session low/i);
    for (const e of facts.querySelectorAll('[data-num]')) expect(e.getAttribute('data-num-class')).toBe('market');
    expect(facts.textContent).toContain('XLI');
  });

  it('a symbol with no series says so — nothing drawn for it', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="BTC" />);
    expect(m.q('[data-no-series="BTC"]').textContent).toBe('No series for BTC.');
    expect(m.q('[data-region="price-chart"]')).toBeNull();
  });

  it('desktop: every symbol at a glance, price only, each last close marked market', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} desktop />);
    const minis = m.qa('[data-mini]');
    expect(minis.length).toBe(m.qa('[data-region="symbol-picker"] button').length);
    for (const e of m.qa('[data-region="all-symbols"] [data-num]')) expect(e.getAttribute('data-num-class')).toBe('market');
    m.click(m.q('[data-mini="PANW"]'));
    expect(m.q('[data-region="price-chart"]').getAttribute('data-symbol')).toBe('PANW');
  });
});

describe('BA-43 — the evidence overlay', () => {
  const sym = 'META';
  const stamped = sep23Tape.checks.map((c, i) => ({ c, i })).filter(({ c }) => c.evidence?.[sym]);

  it('one marker per check that stamped the symbol, sitting at the stamp\'s recorded px at evidenceAt', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start={sym} />);
    const marks = m.qa('[data-evidence-marker]');
    expect(marks.map((e) => Number(e.getAttribute('data-evidence-marker')))).toEqual(stamped.map(({ i }) => i));
    marks.forEach((e, k) => {
      expect(Number(e.getAttribute('data-marker-px'))).toBe(stamped[k].c.evidence[sym].px);
      expect(e.getAttribute('data-marker-at')).toBe(stamped[k].c.evidenceAt);
    });
  });

  it('a marker may sit off the bar line: the stamp\'s px is the quote, not the bar — and the delay is stated, not smoothed', () => {
    const series = sep23Series.find((s) => s.symbol === sym);
    const atCheck = new Map(series.atChecks.map((a) => [a.at, a.price]));
    const differs = stamped.filter(({ c }) => atCheck.has(c.at) && atCheck.get(c.at) !== c.evidence[sym].px);
    expect(differs.length).toBeGreaterThan(0);
    m.render(<Harness tape={sep23Tape} series={sep23Series} start={sym} />);
    expect(m.q('[data-region="evidence-overlay"]').textContent).toContain("A marker may sit off the bar line: the platform's quote runs about 15–20 minutes behind the bars. The difference is that delay, not smoothed.");
  });

  it('opening a marker lists the stamp, labelled "Recorded at the check · what the agent was given · the platform\'s quote"', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start={sym} />);
    const { i } = stamped[2];
    m.click(m.q(`[data-evidence-marker="${i}"]`));
    const panel = m.q(`[data-evidence-panel="${i}"]`);
    expect(panel.textContent).toContain("Recorded at the check · what the agent was given · the platform's quote");
    for (const f of ['px', 'chg', 'atrX', 'vwapDev', 'bbPct']) {
      const e = panel.querySelector(`[data-num="checks[${i}].evidence.${sym}.${f}"]`);
      expect(e, f).toBeTruthy();
      expect(e.getAttribute('data-num-class')).toBe('recorded');
    }
    for (const label of ['nr7', 'regime', 'risk']) expect(panel.textContent).toContain(label);
  });

  it('a replay point is never presented as the price behind a check: no replay value is drawn or listed on the Deep dive', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="MSFT" />);
    m.click(m.qa('[data-evidence-marker]')[0]);
    expect(m.q('[data-num*="replay"]')).toBeNull();
    expect(m.q('[data-line="hold"], [data-line="swap"]')).toBeNull();
    expect(m.container.textContent).not.toMatch(/hold path|swap path/i);
  });

  it('the protections note once on the Deep dive', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start={sym} />);
    m.click(m.qa('[data-evidence-marker]')[0]);
    expect(m.container.textContent.split('This does not show which protections were armed or checked.').length - 1).toBe(1);
  });
});

describe('coverage, the empty day, the sweeps', () => {
  it.each(['complete', 'partial', 'unavailable'])('the chart section opens with the series coverage line, %s', (status) => {
    const t = { ...sep23Tape, coverage: { ...sep23Tape.coverage, series: { ...sep23Tape.coverage.series, status, note: `${status} series note` } } };
    m.render(<Harness tape={t} series={sep23Series} desktop />);
    for (const id of ['deep-chart', 'deep-all']) {
      expect(m.q(`#${id} [data-coverage]`).getAttribute('data-coverage'), id).toBe(status);
      expect(m.q(`#${id} [data-coverage]`).textContent).toContain(`${status} series note`);
    }
  });

  it('the empty day: no held names, no chart for a stock, honest words', () => {
    m.render(<Harness tape={emptyTape} series={emptySeries} />);
    expect(m.q('[data-depth="deep"]')).toBeTruthy();
    expect(m.q('[data-evidence-marker]')).toBeNull();
    expect(sweepNumbers(m.container, docsFor(emptyTape, emptySeries))).toEqual([]);
  });

  it.each([['MSFT', false], ['META', true], ['PANW', false]])('%s (desktop %s), a marker opened: every number marked by its own document\'s class; no stray digit; no sign colour; no forbidden word', (s, desktop) => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start={s} desktop={desktop} />);
    const first = m.qa('[data-evidence-marker]')[0];
    if (first) m.click(first);
    expect(sweepNumbers(m.container, docsFor(sep23Tape, sep23Series))).toEqual([]);
    expect(sweepSigns(m.container)).toEqual([]);
    expect(sweepWords(m.container)).toEqual([]);
  });
});
