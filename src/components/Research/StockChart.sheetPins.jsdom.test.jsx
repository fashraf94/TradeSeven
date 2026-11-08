// @vitest-environment jsdom
//
// Research Modal Build C — THE PINS (spec BC-8, BC-9; Phase 0 §H, §L, §N):
// StockChart's optional `markers` and `priceLines` props and the Idea pill.
//   · markers go through the library's createSeriesMarkers (v5 has no
//     series.setMarkers), at the time of their own day's bar, 1D only, and are
//     re-applied when the series is rebuilt;
//   · priceLines draw on 1D and 1W; the 'idea' group follows the Idea pill;
//   · with neither prop, the chart makes no new library call (inert).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const log = vi.hoisted(() => ({ charts: [], plugins: [] }));
vi.mock('lightweight-charts', () => {
  const makeSeries = (kind) => {
    const s = {
      kind, data: null, lines: [], removed: [],
      setData(d) { s.data = d; },
      createPriceLine(o) { const line = { ...o }; s.lines.push(line); return line; },
      removePriceLine(line) { s.removed.push(line); },
      setMarkers() { throw new Error('series.setMarkers does not exist in lightweight-charts v5'); },
      priceScale() { return { applyOptions() {} }; },
      applyOptions() {},
    };
    return s;
  };
  return {
    createChart: () => {
      const chart = {
        series: [],
        addSeries(kind) { const s = makeSeries(kind); chart.series.push(s); return s; },
        removeSeries() {}, subscribeCrosshairMove() {},
        timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; } }; },
        applyOptions() {}, remove() {},
      };
      log.charts.push(chart);
      return chart;
    },
    createSeriesMarkers: (series, markers) => {
      const plugin = { series, calls: [markers], setMarkers(m) { plugin.calls.push(m); }, detach() {} };
      log.plugins.push(plugin);
      return plugin;
    },
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));

import StockChart from './StockChart.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
let container, root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
  log.charts.length = 0; log.plugins.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

const DAILY = [
  { date: '2026-09-25', open: 98, high: 100, low: 97, close: 99, volume: 1000 },
  { date: '2026-09-28', open: 99, high: 101, low: 98, close: 100, volume: 1100 },
  { date: '2026-09-29', open: 100, high: 102, low: 99, close: 101, volume: 1200 },
  { date: '2026-09-30', open: 101, high: 103, low: 100, close: 100, volume: 1300 },
];
const WEEKLY = [
  { date: '2026-09-15', open: 98, high: 100, low: 96, close: 97, volume: 5100 },
  { date: '2026-09-22', open: 97, high: 102, low: 96, close: 101, volume: 5200 },
];
const render = (props) => act(() => {
  root.render(<StockChart rawData={null} onTimeframeChange={() => {}} levels={null} smaData={null} activeHighlight={null} height={200} ohlcvData={DAILY} timeframe="1D" {...props} />);
});
const candle = () => log.charts.at(-1).series.find((s) => s.kind === 'Candlestick');
const dayOf = (time) => { const d = new Date(time * 1000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MARKERS = [
  { id: 'entry', day: '2026-09-28', color: 'grey', text: 'Entry · Mon 10:02' },
  { id: 'check', day: '2026-09-30', color: 'teal' },
  { id: 'gone', day: '2026-09-12' }, // no bar that day on the chart: drawn nowhere
];
const LINES = [
  { id: 'entry', price: 100.75, group: 'record', color: 'grey', title: 'entry $100.75', emphasis: true },
  { id: 'idea:0', price: 98.5, group: 'idea', color: 'green', title: '' },
  { id: 'idea:1', price: 96.2, group: 'idea', color: 'red', title: '' },
];

describe('markers — createSeriesMarkers, 1D only, on their day\'s bar', () => {
  it('draws through createSeriesMarkers on the candle series, each at its own bar\'s time; a day with no bar draws nothing', () => {
    render({ markers: MARKERS });
    expect(log.plugins).toHaveLength(1);
    const plugin = log.plugins[0];
    expect(plugin.series).toBe(candle());
    const drawn = plugin.calls.at(-1);
    expect(drawn.map((m) => m.id)).toEqual(['entry', 'check']);
    const barTimes = candle().data.map((b) => b.time);
    for (const m of drawn) expect(barTimes).toContain(m.time);
    expect(drawn.map((m) => dayOf(m.time))).toEqual(['2026-09-28', '2026-09-30']);
  });
  it('one open label: the marker the caller gave text is a CAPTION over the chart, never canvas text the pane clips (review D6); its dot is the larger one', () => {
    render({ markers: MARKERS });
    const drawn = log.plugins[0].calls.at(-1);
    expect(drawn.filter((m) => m.text)).toEqual([]);
    expect(drawn.filter((m) => m.size).map((m) => m.id)).toEqual(['entry']);
    const caps = [...container.querySelectorAll('[data-pin-caption]')];
    expect(caps.map((c) => [c.dataset.pinCaption, c.textContent.trim()])).toEqual([['entry', '● Entry · Mon 10:02']]);
  });
  it('no caption when the open marker has no bar on the chart, on 1W, or with no open marker', () => {
    render({ markers: [{ id: 'gone', day: '2026-09-12', text: 'Called · Sat 9/12' }] });
    expect(container.querySelector('[data-pin-caption]')).toBeNull();
    render({ markers: MARKERS, ohlcvData: WEEKLY, timeframe: '1W' });
    expect(container.querySelector('[data-pin-caption]')).toBeNull();
    render({ markers: [MARKERS[1]] });
    expect(container.querySelector('[data-pin-caption]')).toBeNull();
  });
  it('re-applied after a rebuild: new data rebuilds the series and the markers go onto the NEW series', () => {
    render({ markers: MARKERS });
    const first = candle();
    render({ markers: MARKERS, ohlcvData: [...DAILY, { date: '2026-10-01', open: 100, high: 104, low: 99, close: 103, volume: 1 }] });
    expect(candle()).not.toBe(first);
    expect(log.plugins.at(-1).series).toBe(candle());
    expect(log.plugins.at(-1).calls.at(-1).map((m) => m.id)).toEqual(['entry', 'check']);
  });
  it('a markers change on the same series re-applies through the same plugin', () => {
    render({ markers: MARKERS });
    render({ markers: [MARKERS[1]] });
    expect(log.plugins).toHaveLength(1);
    expect(log.plugins[0].calls.at(-1).map((m) => m.id)).toEqual(['check']);
  });
  it('1W draws the price pins only: no markers', () => {
    render({ markers: MARKERS, priceLines: LINES, ohlcvData: WEEKLY, timeframe: '1W' });
    expect(log.plugins).toHaveLength(0);
    expect(candle().lines.map((l) => l.price)).toEqual([100.75, 98.5, 96.2]);
  });
});

describe('priceLines and the Idea pill', () => {
  it('draws every line with its title; the record line solid, the idea lines dashed; emphasis is the wider line', () => {
    render({ priceLines: LINES });
    expect(candle().lines.map((l) => [l.price, l.title, l.lineStyle, l.lineWidth])).toEqual([[100.75, 'entry $100.75', 0, 2], [98.5, '', 2, 1], [96.2, '', 2, 1]]);
  });
  it('the Idea pill shows only when idea lines exist, is on by default, and hides and redraws them', () => {
    render({ priceLines: LINES });
    const pill = container.querySelector('[data-idea-pill]');
    expect(pill?.dataset.ideaPill).toBe('on');
    act(() => { pill.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.querySelector('[data-idea-pill]').dataset.ideaPill).toBe('off');
    const s = candle();
    expect(s.removed.map((l) => l.price)).toEqual([100.75, 98.5, 96.2]);
    expect(s.lines.slice(3).map((l) => l.price)).toEqual([100.75]);
    act(() => { container.querySelector('[data-idea-pill]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(s.lines.slice(4).map((l) => l.price)).toEqual([100.75, 98.5, 96.2]);
  });
  it('no idea lines (nothing carried): no Idea pill', () => {
    render({ priceLines: [LINES[0]] });
    expect(container.querySelector('[data-idea-pill]')).toBeNull();
  });
});

describe('inert without the props', () => {
  it('no markers and no priceLines: no createSeriesMarkers, no price line, no Idea pill', () => {
    render({});
    expect(log.plugins).toHaveLength(0);
    expect(candle().lines).toEqual([]);
    expect(candle().removed).toEqual([]);
    expect(container.querySelector('[data-idea-pill]')).toBeNull();
  });
  it('the bomb view draws none of it', () => {
    render({ markers: MARKERS, priceLines: LINES, timeframe: 'bomb', bombData: { threshold: 2.5, baselinePrice: 100 }, ohlcvData: [
      { date: '2026-09-30T19:00:00.000Z', open: 101, high: 101.5, low: 100.5, close: 101, volume: 300 },
      { date: '2026-10-01T14:00:00.000Z', open: 103.5, high: 105, low: 103, close: 104.5, volume: 450 },
    ] });
    expect(log.plugins).toHaveLength(0);
    expect(candle()?.lines.map((l) => l.title).filter((t) => t === 'entry $100.75') ?? []).toEqual([]);
  });
});

describe('re-applied after EVERY series rebuild, not only a data change (review C1/D4)', () => {
  for (const [what, change] of [['the height (rotation, resize)', { height: 210 }], ['the symbol', { symbol: 'MSFT' }]]) {
    it(`a rebuild caused by ${what}: the markers and the lines go onto the NEW series`, () => {
      render({ symbol: 'AAPL', markers: MARKERS, priceLines: LINES });
      const first = candle();
      render({ symbol: 'AAPL', markers: MARKERS, priceLines: LINES, ...change });
      expect(candle()).not.toBe(first);
      expect(log.plugins.at(-1).series).toBe(candle());
      expect(log.plugins.at(-1).calls.at(-1).map((m) => m.id)).toEqual(['entry', 'check']);
      expect(candle().lines.map((l) => l.price)).toEqual([100.75, 98.5, 96.2]);
    });
  }
});

describe('markers reach the library in time order (v5 binary-searches them — review C7, CK1)', () => {
  it('an unsorted list (a tapped item\'s own pin appended last) is drawn sorted', () => {
    render({ markers: [MARKERS[1], { id: 'pin', day: '2026-09-25', text: 'This item · Fri 10:00' }, MARKERS[0]] });
    const drawn = log.plugins[0].calls.at(-1);
    expect(drawn.map((m) => m.id)).toEqual(['pin', 'entry', 'check']);
    expect(drawn.map((m) => m.time)).toEqual([...drawn.map((m) => m.time)].sort((a, b) => a - b));
  });
});

describe('only the open line shows a price-axis tag (review D8)', () => {
  it('axisLabelVisible on the emphasized line alone', () => {
    render({ priceLines: LINES });
    expect(candle().lines.map((l) => [l.price, l.axisLabelVisible])).toEqual([[100.75, true], [98.5, false], [96.2, false]]);
  });
});
