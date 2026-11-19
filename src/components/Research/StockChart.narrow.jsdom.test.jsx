// @vitest-environment jsdom
//
// FX-10 — two faults at 320 px, fixed for everyone (build prompt of 19 Nov 2026, §3; the 18 Nov report §11):
//   · a battle mount's control bar (1D · 1W · Battle · SMA · S/R · Idea) wraps and never runs past the screen, with or
//     without the read (before: it wrapped only with the read's Rule chip);
//   · the OHLC row's Vol never runs under the price scale: the row stops short of the scale's measured width and wraps.
// The chart library is faked: its right price scale reports the width the real one measures after layout (58 px for
// three-digit prices at its 12 px font). The real-browser rows at 320 px are in the build report.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const AXIS = vi.hoisted(() => ({ width: 58 }));
vi.mock('lightweight-charts', () => {
  const makeSeries = (kind) => {
    const s = { kind, data: null, setData(d) { s.data = d; }, createPriceLine(o) { return o; }, removePriceLine() {}, setMarkers() {}, priceScale() { return { applyOptions() {} }; }, applyOptions() {}, priceToCoordinate: (p) => 1000 - p };
    return s;
  };
  return {
    createChart: () => {
      const chart = {
        series: [], addSeries(kind) { const s = makeSeries(kind); chart.series.push(s); return s; }, removeSeries() {}, subscribeCrosshairMove() {},
        timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; }, timeToCoordinate: (t) => t / 1000, logicalToCoordinate: (l) => l * 8 }; },
        priceScale: () => ({ applyOptions() {}, width: () => AXIS.width }),
        applyOptions() {}, remove() {},
      };
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
  vi.useFakeTimers({ toFake: ['Date', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  vi.setSystemTime(new Date('2026-11-18T18:44:00.000Z'));
  AXIS.width = 58;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

const DAILY = [
  { date: '2026-11-13', open: 341.3, high: 342.4, low: 340.9, close: 341.9, volume: 6_300_000 },
  { date: '2026-11-16', open: 341.4, high: 342.1, low: 330.7, close: 331.6, volume: 6_200_000 },
  { date: '2026-11-17', open: 342.98, high: 344.19, low: 328.64, close: 335.28, volume: 6_300_000 },
];
const render = async (props) => {
  await act(async () => {
    root.render(<StockChart rawData={null} onTimeframeChange={() => {}} levels={null} smaData={null} activeHighlight={null} height={200} ohlcvData={DAILY} timeframe="1D" {...props} />);
  });
  await act(async () => { vi.advanceTimersToNextFrame(); }); // the library lays out, then the scale is measured
};
const ohlcRow = () => [...container.querySelectorAll('div')].find((d) => d.style.top === '8px' && d.style.left === '8px' && /\bO\b/.test(d.textContent));
const controlBar = () => container.firstChild.firstChild;

describe('FX-10: the OHLC row never runs under the price scale', () => {
  it('it stops 8 px short of the scale\'s measured width, and wraps (Vol drops to a second line rather than under the scale)', async () => {
    await render({});
    expect(ohlcRow().textContent).toContain('Vol');
    expect(ohlcRow().style.right).toBe('66px');
    expect(ohlcRow().style.flexWrap).toBe('wrap');
  });
  it('a wider scale (four-digit prices) moves the bound with it', async () => {
    AXIS.width = 71;
    await render({});
    expect(ohlcRow().style.right).toBe('79px');
  });
  it('a scale the library cannot measure yet (0 px) leaves the row as it was', async () => {
    AXIS.width = 0;
    await render({});
    expect(ohlcRow().style.right).toBe('');
    expect(ohlcRow().style.flexWrap).toBe('');
  });
});

describe('FX-10: a battle mount\'s control bar wraps, with or without the read', () => {
  it('Battle pill, no Rule chip: the bar wraps and the overlay pills keep to the right', async () => {
    await render({ battlePill: { label: 'Battle' } });
    expect(controlBar().style.flexWrap).toBe('wrap');
    const overlays = [...controlBar().children].find((c) => /SMA/.test(c.textContent));
    expect(overlays.style.marginLeft).toBe('auto');
  });
  it('with the Rule chip too, as before', async () => {
    await render({ battlePill: { label: 'Battle' }, ruleChip: { on: true, label: 'Rule', onToggle: () => {} } });
    expect(controlBar().style.flexWrap).toBe('wrap');
  });
  it('a browse mount (1D · 1W · SMA · S/R) keeps today\'s bar', async () => {
    await render({});
    expect(controlBar().style.flexWrap).toBe('');
  });
});
