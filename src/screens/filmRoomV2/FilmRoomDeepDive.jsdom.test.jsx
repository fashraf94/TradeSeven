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
import FilmRoomDeepDive, { displayNameOf } from './FilmRoomDeepDive';
import { mounter, sep23Tape, sep23Series, emptyTape, emptySeries, clone, sweepNumbers, sweepWords, sweepSigns, parseNumeral } from './__fixtures__/filmRoomHarness';
import { fmtVolume } from './filmRoomModel';
import { COMPANY_NAMES } from '../../config/stockData';

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

  it('a swap on the symbol is marked at its recorded time, with who made it — the sold name its exit, the bought name its entry (B2.1 A4, FR-04, RJ-4; Amendment K RK-5: the sold name\'s maker in RJ-4\'s words)', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="MSFT" />);
    expect(m.q('[data-swap-mark="0"]')).toBeTruthy();
    expect(m.q('[data-swap-label="0"]').textContent).toBe('Exit · 12:45 PM · by platform rule · stagnation');
    m.click(chip('PLTR'));
    expect(m.q('[data-swap-label="1"]').textContent).toBe('Entry · 2:00 PM · in for DE · by the agent');
    m.click(chip('DE'));
    expect(m.q('[data-swap-label="1"]').textContent).toBe('Exit · 2:00 PM · by the agent');
    m.click(chip('CRWD'));
    expect(m.q('[data-swap-label="0"]').textContent).toBe('Entry · 12:45 PM · in for MSFT · by platform rule · stagnation');
  });

  it('Amendment K RK-5 — the sold name\'s maker: the agent, a platform rule with its reason, the gameplan meeting, a maker not recorded; "Exit by" never on the chart (the mutant: "Exit by" back on the sold name)', () => {
    const planted = (mechanism, exitReason) => { const t = clone(sep23Tape); t.actions[0] = { ...t.actions[0], mechanism, exitReason }; return t; };
    for (const [mechanism, exitReason, maker] of [
      ['agent_decision', null, 'by the agent'],
      ['platform_risk_manager', 'stagnation', 'by platform rule · stagnation'],
      ['archetype_rotation', null, 'by platform rule · rule not recorded'],
      ['gameplan_meeting', null, 'by the gameplan meeting'],
      [undefined, null, 'maker not recorded'],
    ]) {
      m.render(<Harness key={String(mechanism)} tape={planted(mechanism, exitReason)} series={sep23Series} start="MSFT" />);
      expect(m.q('[data-swap-label="0"]').textContent, String(mechanism)).toBe(`Exit · 12:45 PM · ${maker}`);
      expect(m.q('[data-region="price-chart"]').textContent, String(mechanism)).not.toMatch(/Exit by|Exit maker/);
    }
  });

  it('FR-04 / RK-5: no swap annotation on the chart reads "Exit by …" — every swap\'s bought name and sold name', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="MSFT" />);
    sep23Tape.actions.forEach((a, i) => {
      m.click(chip(a.symbolIn));
      const entry = m.q(`[data-swap-label="${i}"]`).textContent;
      expect(entry, a.symbolIn).toMatch(new RegExp(`^Entry · .+ · in for ${a.symbolOut} · by `));
      expect(entry, a.symbolIn).not.toMatch(/Exit/);
      m.click(chip(a.symbolOut));
      const exit = m.q(`[data-swap-label="${i}"]`).textContent;
      expect(exit, a.symbolOut).toMatch(/^Exit · .+ · by /);
      expect(exit, a.symbolOut).not.toMatch(/Exit by/);
    });
  });

  it('side facts: the record\'s own prices (the session open, the last close), market class; the role from the tape — no session high or low (A2L1-4)', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="DE" />);
    const facts = m.q('[data-region="symbol-facts"]');
    expect(facts.textContent).toContain('exited at 2:00 PM · Exit by the agent · its own decision');
    const paths = [...facts.querySelectorAll('[data-num]')].map((e) => e.getAttribute('data-num'));
    const de = sep23Series.find((s) => s.symbol === 'DE');
    expect(paths).toEqual(['sessionOpen.value', `bars[${de.bars.length - 1}].c`]);
    // review A2L4-4: each fact's label is bound to ITS path
    const rowOf = (label) => [...facts.children].find((r) => r.firstElementChild?.textContent === label);
    expect(rowOf('Session open').querySelector('[data-num]').getAttribute('data-num')).toBe('sessionOpen.value');
    expect(rowOf('Close · the last 10-minute bar').querySelector('[data-num]').getAttribute('data-num')).toBe(`bars[${de.bars.length - 1}].c`);
    expect(m.container.querySelector('[data-num$=".h"], [data-num$=".l"]')).toBeNull();
    expect(m.container.textContent).not.toMatch(/session high|session low/i);
    for (const e of facts.querySelectorAll('[data-num]')) expect(e.getAttribute('data-num-class')).toBe('market');
    expect(facts.textContent).toContain('XLI');
  });

  it('a symbol with no series says so — nothing drawn for it (B2.1 A2: its own state, the reason the tape records)', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="BTC" />);
    expect(m.q('[data-no-series="BTC"]').textContent).toBe('No chart for BTC: crypto is not charted.');
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

describe('addendum R4(a)/(b)/(d) — the restored facts, axes and name', () => {
  const docOf = (s) => sep23Series.find((d) => d.symbol === s);
  const factRow = (label) => [...m.q('[data-region="symbol-facts"]').children].find((r) => r.firstElementChild?.textContent === label);

  it('"Change · open to close" and "Volume · session": from THIS symbol\'s own bars, marked market by the screen\'s declaration', () => {
    for (const s of ['MSFT', 'DE']) {
      m.render(<Harness key={s} tape={sep23Tape} series={sep23Series} start={s} />);
      const doc = docOf(s);
      const change = doc.bars[doc.bars.length - 1].c / doc.sessionOpen.value - 1;
      const volume = doc.bars.reduce((sum, b) => sum + b.v, 0);
      const ch = factRow('Change · open to close').querySelector('[data-num-aggregate]');
      expect(ch.getAttribute('data-num-aggregate'), s).toBe('change(sessionOpen.value to bars[last].c)');
      expect(Number(ch.getAttribute('data-agg-value')), s).toBe(change);
      expect(Math.abs(parseNumeral(ch.querySelector('[data-num-text]').textContent) - change * 100), s).toBeLessThanOrEqual(0.0051);
      const vol = factRow('Volume · session').querySelector('[data-num-aggregate]');
      expect(vol.getAttribute('data-num-aggregate'), s).toBe('sum(bars[].v)');
      expect(Number(vol.getAttribute('data-agg-value')), s).toBe(volume);
      expect(vol.querySelector('[data-num-text]').textContent, s).toBe(fmtVolume(volume));
      for (const el of [ch, vol]) {
        expect(el.getAttribute('data-num-class')).toBe('market');
        expect(el.querySelector('[data-kind-mark]').getAttribute('data-kind-mark')).toBe('market');
      }
    }
    // the market line's bars would give other values: a fact read from the wrong document cannot pass
    const spy = docOf('SPY');
    expect(spy.bars[spy.bars.length - 1].c / spy.sessionOpen.value).not.toBe(docOf('MSFT').bars[docOf('MSFT').bars.length - 1].c / docOf('MSFT').sessionOpen.value);
  });

  it('a symbol the candle pass lists as incomplete shows neither computed fact; a bar with no volume drops the volume only', () => {
    const t = clone(sep23Tape);
    t.passes.candles.symbolsIncomplete = ['MSFT'];
    m.render(<Harness tape={t} series={sep23Series} start="MSFT" />);
    expect(factRow('Change · open to close')).toBeUndefined();
    expect(factRow('Volume · session')).toBeUndefined();
    const series = clone(sep23Series);
    series.find((d) => d.symbol === 'MSFT').bars[3].v = null;
    m.render(<Harness key="gap" tape={sep23Tape} series={series} start="MSFT" />);
    expect(factRow('Change · open to close')).toBeTruthy();
    expect(factRow('Volume · session')).toBeUndefined();
  });

  it('R4(b): gridlines at round % steps — each price tick at its own price on the chart\'s scale, its % beside it, no per-tick marker', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="MSFT" />);
    const doc = docOf('MSFT');
    const chart = m.q('[data-region="price-chart"]');
    const prices = [...chart.querySelectorAll('[data-axis-scaffolding="price"]')];
    const pcts = [...chart.querySelectorAll('[data-axis-scaffolding="percent"]')];
    expect(prices.length).toBeGreaterThanOrEqual(2);
    expect(chart.querySelectorAll('[data-gridline]').length).toBe(prices.length);   // the 0 step is the session open's own line
    expect(pcts.length).toBe(prices.length + 1);
    // the chart's own price scale, from the record's two marked labels (the A2L4-2 method)
    const yOf = (path) => parseFloat(chart.querySelector(`[data-num="${path}"]`).parentElement.style.top) + (path === 'sessionOpen.value' ? 6 : 16);   // the open sits on the axis (A2P3-7)
    const last = doc.bars.length - 1;
    const [p0, y0, p1, y1] = [doc.sessionOpen.value, yOf('sessionOpen.value'), doc.bars[last].c, yOf(`bars[${last}].c`)];
    const yAt = (price) => y0 + ((price - p0) * (y1 - y0)) / (p1 - p0);
    const steps = [];
    for (const el of prices) {
      const p = parseNumeral(el.textContent);
      const y = parseFloat(el.style.top) + 5;
      expect(Math.abs(y - yAt(p)), el.textContent).toBeLessThanOrEqual(Math.abs(yAt(p + 0.005) - yAt(p)) + 0.01);
      const twin = pcts.find((q) => q.style.top === el.style.top);
      const pct = parseNumeral(twin.textContent);
      expect(Math.abs(pct - (p / doc.sessionOpen.value - 1) * 100), twin.textContent).toBeLessThanOrEqual(0.0051 + (0.005 / doc.sessionOpen.value) * 100);
      steps.push(pct);
      expect(el.querySelector('[data-kind-mark]')).toBeNull();
      expect(twin.querySelector('[data-kind-mark]')).toBeNull();
    }
    const zero = pcts.find((q) => parseNumeral(q.textContent) === 0);
    expect(Math.abs(parseFloat(zero.style.top) + 5 - y0)).toBeLessThan(0.01);   // 0% is the session open
    // scaffolding states no claim: hidden from screen readers (review A2P3-6); the record's own open sits ON the price axis (A2P3-7)
    for (const el of [...prices, ...pcts]) expect(el.getAttribute('aria-hidden')).toBe('true');
    const openLabel = chart.querySelector('[data-num="sessionOpen.value"]').parentElement;
    expect([openLabel.style.right, openLabel.style.left]).toEqual(['calc(100% + 4px)', '']);
    expect(openLabel.getAttribute('aria-hidden')).toBeNull();
    const sorted = [...steps, 0].sort((a, b) => a - b);
    const gaps = sorted.slice(1).map((v, i) => Math.round((v - sorted[i]) * 1000) / 1000);
    expect(new Set(gaps).size).toBe(1);   // one round step
    expect([0.1, 0.25, 0.5, 1, 2, 5, 10, 20]).toContain(gaps[0]);
  });

  it('R4(b): each axis names its class ONCE, in its caption — the price axis by the series document\'s own declaration, the % axis by the screen\'s', () => {
    const series = clone(sep23Series);
    series.find((d) => d.symbol === 'MSFT').numberClasses['bars[].c'] = 'rebuilt';   // the caption follows the document, not a constant
    m.render(<Harness tape={sep23Tape} series={series} start="MSFT" />);
    const caps = m.qa('[data-axis-caption]');
    expect(caps.map((c) => c.getAttribute('data-axis-caption'))).toEqual(['price', 'percent']);
    expect(caps[0].textContent).toMatch(/^Price axis/);
    expect(caps[1].textContent).toMatch(/^% from the session open/);
    expect([...caps[0].querySelectorAll('[data-kind-mark]')].map((k) => k.getAttribute('data-kind-mark'))).toEqual(['rebuilt']);
    expect([...caps[1].querySelectorAll('[data-kind-mark]')].map((k) => k.getAttribute('data-kind-mark'))).toEqual(['market']);
    expect(sweepNumbers(m.container, docsFor(sep23Tape, series))).toEqual([]);
  });

  it('R4(b): intermediate time ticks every 90 minutes from the session open, before the close — each AT its instant (review A2P1-4, A2P2-8)', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="MSFT" />);
    const doc = docOf('MSFT');
    const axis = m.q('[data-time-axis]');
    const ticks = [...axis.querySelectorAll('[data-time-tick]')];
    expect(ticks.map((t) => t.textContent)).toEqual(['11:00', '12:30', '2:00']);
    expect(axis.firstElementChild.textContent).toBe('9:30');
    expect(axis.lastElementChild.textContent).toBe('close');
    const startMs = Date.parse(doc.sessionOpen.at);
    const endMs = Date.parse(doc.bars[doc.bars.length - 1].t) + 600_000;
    ticks.forEach((t, k) => {
      const at = startMs + (k + 1) * 90 * 60_000;   // 11:00, 12:30, 2:00 ET on the chart's own time scale
      expect(Math.abs(parseFloat(t.parentElement.style.left) - ((at - startMs) / (endMs - startMs)) * 100), t.textContent).toBeLessThan(0.002);
    });
  });

  it('R4(b) (review A2P2-8): each gridline is drawn at its own price tick label', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="MSFT" />);
    const grid = m.qa('[data-gridline]').map((g) => Number(g.getAttribute('y1'))).sort((a, b) => a - b);
    const labels = m.qa('[data-axis-scaffolding="price"]').map((e) => parseFloat(e.style.top) + 5).sort((a, b) => a - b);
    expect(grid.length).toBeGreaterThan(0);
    expect(grid.length).toBe(labels.length);
    grid.forEach((y, k) => expect(Math.abs(y - labels[k])).toBeLessThan(0.01));
  });

  it('desktop minis (review A2P2-1): every mini with bars carries ITS OWN last close, by path, marked market', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} desktop />);
    const minis = m.qa('[data-mini]').filter((b) => (docOf(b.getAttribute('data-mini'))?.bars || []).length);
    expect(minis.length).toBeGreaterThan(5);
    for (const b of minis) {
      const doc = docOf(b.getAttribute('data-mini'));
      const n = b.querySelector('[data-num]');
      expect(n.getAttribute('data-num'), doc.symbol).toBe(`bars[${doc.bars.length - 1}].c`);
      expect(n.getAttribute('data-num-doc')).toBe(`series:${doc.symbol}`);
      expect(n.getAttribute('data-num-class')).toBe('market');
    }
    expect(m.q('[data-region="all-symbols"] [data-num-aggregate]')).toBeNull();
  });

  it('R4(d): the company name from the app\'s symbol directory beside the symbol and on the chart; a symbol it does not name shows alone', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="MSFT" />);
    expect(COMPANY_NAMES.MSFT).toBe('Microsoft');
    expect(m.q('[data-region="symbol-facts"] [data-display-name="MSFT"]').textContent).toBe('Microsoft');
    expect(m.q('#deep-chart [data-display-name="MSFT"]').textContent).toBe('Microsoft');
    m.click(chip('ETN'));
    expect(COMPANY_NAMES.ETN).toBeUndefined();
    expect(m.q('[data-display-name]')).toBeNull();
    expect(m.q('[data-region="symbol-facts"]').textContent.startsWith('ETN')).toBe(true);
  });

  it('B2.1 A5 (FR-05, RJ-5): a symbol the directory lacks says "Company name not on file" beside it and on the chart — no name is guessed', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start="ETN" />);
    expect(COMPANY_NAMES.ETN).toBeUndefined();
    expect(m.q('[data-region="symbol-facts"] [data-display-name-missing="ETN"]').textContent).toBe('Company name not on file');
    expect(m.q('#deep-chart [data-display-name-missing="ETN"]').textContent).toBe('Company name not on file');
    expect(m.q('[data-display-name]')).toBeNull();
    expect(sweepWords(m.container, docsFor(sep23Tape, sep23Series))).toEqual([]);
    // a name on file — even one equal to its symbol ("AMD") — never reads "not on file"
    m.click(chip('AMD'));
    expect(COMPANY_NAMES.AMD).toBe('AMD');
    expect(m.q('[data-display-name-missing]')).toBeNull();
    m.click(chip('MSFT'));
    expect(m.q('[data-display-name-missing]')).toBeNull();
    expect(m.q('#deep-chart [data-display-name="MSFT"]').textContent).toBe('Microsoft');
  });

  it('review A2P1-2: a directory name holding a forbidden word ("Best Buy") is shown as the symbol alone — it IS on file, so never "not on file" (A5)', () => {
    expect(COMPANY_NAMES.BBY).toBe('Best Buy');
    expect(displayNameOf('BBY')).toBeNull();
    expect(displayNameOf('MSFT')).toBe('Microsoft');
    const t = clone(sep23Tape);
    t.actions[0].symbolOut = 'BBY';
    const series = [...sep23Series, { ...clone(sep23Series.find((s) => s.symbol === 'MSFT')), symbol: 'BBY' }];
    m.render(<Harness tape={t} series={series} start="BBY" />);
    expect(m.q('[data-region="price-chart"]').getAttribute('data-symbol')).toBe('BBY');
    expect(m.q('[data-display-name]')).toBeNull();
    expect(m.q('[data-display-name-missing]')).toBeNull();
    expect(sweepWords(m.container, docsFor(t, series))).toEqual([]);
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

  it('review A2L4-2: each marker is DRAWN at the stamp\'s px on the chart\'s own price scale, at evidenceAt on its time scale — never at the bar price', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start={sym} />);
    const series = sep23Series.find((s) => s.symbol === sym);
    const chart = m.q('[data-region="price-chart"]');
    // two points of the chart's price scale, from its own axis labels: the session open and the last close
    const yOf = (path) => parseFloat(chart.querySelector(`[data-num="${path}"]`).parentElement.style.top) + (path === 'sessionOpen.value' ? 6 : 16);   // the open sits on the axis (A2P3-7)
    const last = series.bars.length - 1;
    const [p0, y0] = [series.sessionOpen.value, yOf('sessionOpen.value')];
    const [p1, y1] = [series.bars[last].c, yOf(`bars[${last}].c`)];
    const yAt = (price) => y0 + ((price - p0) * (y1 - y0)) / (p1 - p0);
    const startMs = Date.parse(series.sessionOpen.at);
    const endMs = Date.parse(series.bars[last].t) + 600_000;
    const atChecks = new Map(series.atChecks.map((a) => [a.at, a.price]));
    let offLine = 0;
    for (const { c, i } of stamped) {
      const el = m.q(`[data-evidence-marker="${i}"]`);
      const y = parseFloat(el.style.top) + 12;
      expect(Math.abs(y - yAt(c.evidence[sym].px)), `y of ${i}`).toBeLessThan(0.01);
      const pct = Number(el.style.left.match(/calc\(([-\d.]+)%/)[1]);
      expect(Math.abs(pct - ((Date.parse(c.evidenceAt) - startMs) / (endMs - startMs)) * 100), `x of ${i}`).toBeLessThan(0.002);
      const bar = atChecks.get(c.at);
      if (typeof bar === 'number' && Math.abs(yAt(bar) - y) > 0.5) offLine += 1;
    }
    expect(offLine).toBeGreaterThan(0);   // the quote delay shows — markers off the bar line, not smoothed onto it
  });

  it('review A2L4-2: the opened stamp lists only that check\'s recorded stamp — no series price and no replay value stands for the price behind it', () => {
    m.render(<Harness tape={sep23Tape} series={sep23Series} start={sym} />);
    for (const { i } of stamped.slice(0, 4)) {
      m.click(m.q(`[data-evidence-marker="${i}"]`));
      const panel = m.q(`[data-evidence-panel="${i}"]`);
      const nums = [...panel.querySelectorAll('[data-num]')];
      expect(nums.length).toBe(5);
      for (const n of nums) {
        expect(n.getAttribute('data-num-doc')).toBe('tape');
        expect(n.getAttribute('data-num').startsWith(`checks[${i}].evidence.${sym}.`), n.getAttribute('data-num')).toBe(true);
      }
    }
  });

  it('a marker may sit off the bar line: the stamp\'s px is the quote, not the bar — and the delay is stated, not smoothed', () => {
    const series = sep23Series.find((s) => s.symbol === sym);
    const atCheck = new Map(series.atChecks.map((a) => [a.at, a.price]));
    const differs = stamped.filter(({ c }) => atCheck.has(c.at) && atCheck.get(c.at) !== c.evidence[sym].px);
    expect(differs.length).toBeGreaterThan(0);
    m.render(<Harness tape={sep23Tape} series={sep23Series} start={sym} />);
    // B2.1 A6 (Amendment J RJ-6), verbatim — claiming no cause for any particular gap; the old wording ("The difference
    // is that delay") is gone
    const ev = m.q('[data-region="evidence-overlay"]').textContent;
    expect(ev).toContain('A marker may sit off the bar line: the price the agent was shown came from a quote that runs about 15–20 minutes behind the bars, and the bars are not smoothed.');
    expect(ev).not.toContain('The difference is that delay');
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
    // B2.1 A2 (FR-02, RJ-2): the grid offers BTC, which has no series — so the section's "complete" is withheld there,
    // and BTC says its own state; a section that is not complete keeps its line beside it
    for (const id of status === 'complete' ? ['deep-chart'] : ['deep-chart', 'deep-all']) {
      expect(m.q(`#${id} [data-coverage]`).getAttribute('data-coverage'), id).toBe(status);
      expect(m.q(`#${id} [data-coverage]`).textContent).toContain(`${status} series note`);
    }
    if (status === 'complete') {
      expect(m.q('#deep-all [data-coverage]')).toBeNull();
      expect(m.q('[data-mini="BTC"] [data-no-chart="BTC"]').textContent).toBe('No chart for BTC: crypto is not charted.');
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
    expect(sweepWords(m.container, docsFor(sep23Tape, sep23Series))).toEqual([]);
  });
});
