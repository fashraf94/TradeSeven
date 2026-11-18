// @vitest-environment jsdom
//
// The Chart view's read — STOCKCHART'S NEW PROPS (spec docs/specs/CHART_READ_SPEC_V1.md; MK-4 – MK-7, UC-1 – UC-3):
//   · absent (every caller but the read's): no primitive, no chip, no note — no new library call;
//   · candleBasis 'raw': the candles as traded; the note at the right of the OHLC row;
//   · ruleMarks: one series primitive, re-attached when the series is rebuilt, updated in place otherwise;
//   · on the Battle chart only the 20-day stub, no daily mark; never on the bomb view;
//   · the Rule chip beside SMA · S/R, pressed state and tap.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const log = vi.hoisted(() => ({ charts: [], attached: [], detached: [] }));
vi.mock('lightweight-charts', () => {
  const makeSeries = (kind, chart) => {
    const s = {
      kind, data: null, setData(d) { s.data = d; }, createPriceLine(o) { return o; }, removePriceLine() {}, setMarkers() {},
      priceScale() { return { applyOptions() {} }; }, applyOptions() {}, priceToCoordinate: (p) => 1000 - p,
      attachPrimitive(p) { log.attached.push({ series: s, primitive: p }); p.attached({ chart, series: s, requestUpdate() { p.updates = (p.updates || 0) + 1; } }); },
      detachPrimitive(p) { log.detached.push(p); p.detached(); },
    };
    return s;
  };
  return {
    createChart: () => {
      const chart = {
        series: [], addSeries(kind) { const s = makeSeries(kind, chart); chart.series.push(s); return s; }, removeSeries() {}, subscribeCrosshairMove() {},
        timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; }, timeToCoordinate: (t) => t / 1000, logicalToCoordinate: (l) => l * 8 }; },
        applyOptions() {}, remove() {},
      };
      log.charts.push(chart);
      return chart;
    },
    createSeriesMarkers: () => ({ setMarkers() {}, detach() {} }),
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));

import StockChart from './StockChart.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
let container;
let root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T18:44:00.000Z'));
  log.charts.length = 0; log.attached.length = 0; log.detached.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

// Oldest first, as useResearchData hands them; a 2:1 split before the 16th (adjusted = half the raw).
const DAILY = [
  { date: '2026-11-12', open: 282.1, high: 285.3, low: 281.6, close: 284.2, adjusted_close: 142.1, volume: 1000 },
  { date: '2026-11-13', open: 141.3, high: 142.4, low: 140.9, close: 141.9, adjusted_close: 141.9, volume: 1100 },
  { date: '2026-11-16', open: 141.4, high: 142.1, low: 140.7, close: 141.6, adjusted_close: 141.6, volume: 1200 },
  { date: '2026-11-17', open: 141.6, high: 143.1, low: 141.35, close: 142.8, adjusted_close: 142.8, volume: 1300 },
];
const MARKS = [
  { n: 1, id: 'sma_fast', kind: 'tick', value: 141.1, day: '2026-11-17', ruleSet: 'tf-setup-v1', session: '2026-11-17' },
  { n: 4, id: 'touch_low', kind: 'bracket', value: 140.7, day: '2026-11-16', days: ['2026-11-17', '2026-11-16', '2026-11-13'], ruleSet: 'tf-setup-v1', session: '2026-11-17' },
];
const RULE = { marks: MARKS, shown: [1, 4], lit: [], dailyDates: ['2026-11-17', '2026-11-16', '2026-11-13', '2026-11-12'] };
const render = (props) => act(() => {
  root.render(<StockChart rawData={null} onTimeframeChange={() => {}} levels={null} smaData={null} activeHighlight={null} height={200} ohlcvData={DAILY} timeframe="1D" {...props} />);
});
const candle = () => log.charts.at(-1).series.find((s) => s.kind === 'Candlestick');
const dayOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);

describe('absent: the chart as today', () => {
  it('no primitive, no Rule pill, no note; the candles adjusted', () => {
    render({});
    expect(log.attached).toEqual([]);
    expect(container.querySelector('[data-rule-pill]')).toBeNull();
    expect(container.querySelector('[data-basis-note]')).toBeNull();
    expect(candle().data[0].close).toBe(142.1);
    expect(candle().data[0].open).toBeCloseTo(141.05, 10);
  });
});

describe("candleBasis 'raw' and the note (UC-1 – UC-3)", () => {
  it('the candles as traded, and "prices unadjusted" once', () => {
    render({ candleBasis: 'raw', basisNote: 'prices unadjusted' });
    expect(candle().data.map((c) => [c.open, c.close])).toEqual(DAILY.map((d) => [d.open, d.close]));
    expect([...container.querySelectorAll('[data-basis-note]')].map((n) => n.textContent)).toEqual(['prices unadjusted']);
  });
});

describe('ruleMarks (MK-4 – MK-6)', () => {
  it('1D: one primitive on the candle series, each mark on its own day\'s bar', () => {
    render({ candleBasis: 'raw', ruleMarks: RULE });
    expect(log.attached).toHaveLength(1);
    expect(log.attached[0].series).toBe(candle());
    const items = log.attached[0].primitive.scene.items;
    expect(items.map((i) => [i.n, dayOf(i.time)])).toEqual([[1, '2026-11-17'], [4, '2026-11-16']]);
    expect(items[1].times.map(dayOf)).toEqual(['2026-11-17', '2026-11-16', '2026-11-13']);
  });
  it('lit and unlit: updated in place (requestUpdate), never re-attached', () => {
    render({ candleBasis: 'raw', ruleMarks: RULE });
    const p = log.attached[0].primitive;
    render({ candleBasis: 'raw', ruleMarks: { ...RULE, lit: [4] } });
    expect(log.attached).toHaveLength(1);
    expect(p.scene.items.find((i) => i.n === 4).lit).toBe(true);
    expect(p.updates).toBeGreaterThanOrEqual(2);
  });
  it('a rebuilt series (the timeframe changes) gets the primitive again', () => {
    render({ candleBasis: 'raw', ruleMarks: RULE });
    render({ candleBasis: null, ruleMarks: RULE, timeframe: '1W', ohlcvData: [{ date: '2026-11-09', open: 140, high: 143, low: 139, close: 141.9, volume: 1 }, { date: '2026-11-16', open: 141, high: 143.1, low: 140.7, close: 142.8, volume: 1 }] });
    expect(log.attached).toHaveLength(2);
    expect(log.attached[1].series).toBe(candle());
    expect(log.attached[1].primitive.scene.items.map((i) => [i.n, dayOf(i.time)])).toEqual([[1, '2026-11-16'], [4, '2026-11-16']]);
  });
  it('the props removed: the primitive detached from the series it is on', () => {
    render({ candleBasis: 'raw', ruleMarks: RULE });
    const p = log.attached[0].primitive;
    render({ candleBasis: 'raw', ruleMarks: null });
    expect(log.detached).toEqual([p]);
  });
  it('the Battle chart: no daily mark; the one stub', () => {
    const bars = [{ datetime: '2026-11-18 14:30:00', open: 142, high: 142.4, low: 141.9, close: 142.3, volume: 10 }, { datetime: '2026-11-18 15:00:00', open: 142.3, high: 142.6, low: 142.1, close: 142.5, volume: 10 }];
    render({ timeframe: 'battle', battlePill: { label: 'Battle' }, ohlcvData: bars, ruleMarks: RULE, dailyStub: { value: 141.1, label: '20-day · daily · Tue close' } });
    const p = log.attached.at(-1).primitive;
    expect(p.scene.items).toEqual([]);
    expect(p.scene.stub).toEqual({ value: 141.1, label: '20-day · daily · Tue close' });
  });
  it('the bomb view: nothing', () => {
    render({ timeframe: 'bomb', bombData: { threshold: 2.5, baselinePrice: 141 }, ruleMarks: RULE, dailyStub: { value: 141.1, label: 'x' } });
    expect(log.attached).toEqual([]);
  });
});

describe('the control bar with the Rule chip wraps on a phone; without it, as today', () => {
  it('flexWrap only with the chip', () => {
    render({});
    const bar = () => container.querySelector('[data-rule-pill]')?.closest('div')?.parentElement ?? container.querySelector('button').closest('div').parentElement;
    expect(bar().style.flexWrap).toBe('');
    render({ ruleChip: { on: true, onToggle: () => {}, label: 'Rule' } });
    expect(bar().style.flexWrap).toBe('wrap');
    expect(container.querySelector('[data-rule-pill]').parentElement.style.marginLeft).toBe('auto');
  });
});

describe('review L3-3 / L3-7: the Rule chip is a real 44 × 44 target, its label the size of SMA · S/R, disabled on request', () => {
  it('no negative margin; at least 44 px each way; the label inherits the buttons\' size; the row centres its pills', () => {
    render({ ruleChip: { on: true, onToggle: () => {}, label: 'Rule' } });
    const b = container.querySelector('[data-rule-pill]');
    expect([b.style.minHeight, b.style.minWidth, b.style.margin]).toEqual(['44px', '44px', '']);
    expect(b.querySelector('span').style.fontSize).toBe('inherit');
    expect(b.parentElement.style.alignItems).toBe('center');
    render({ ruleChip: { on: true, onToggle: () => {}, label: 'Rule', disabled: true } });
    expect(container.querySelector('[data-rule-pill]').disabled).toBe(true);
  });
});

describe('the Rule chip (CR-5, MK-7)', () => {
  it('beside SMA · S/R; its pressed state; a tap calls the caller', () => {
    const onToggle = vi.fn();
    render({ ruleChip: { on: true, onToggle, label: 'Rule' } });
    const pill = container.querySelector('[data-rule-pill]');
    expect([pill.textContent, pill.dataset.rulePill, pill.getAttribute('aria-pressed')]).toEqual(['Rule', 'on', 'true']);
    const labels = [...pill.parentElement.querySelectorAll('button')].map((b) => b.textContent.trim());
    expect(labels).toEqual(['SMA', 'S/R', 'Rule']);
    act(() => { pill.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onToggle).toHaveBeenCalledTimes(1);
    render({ ruleChip: { on: false, onToggle, label: 'Rule' } });
    expect(container.querySelector('[data-rule-pill]').getAttribute('aria-pressed')).toBe('false');
  });
});
