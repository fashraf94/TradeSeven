// @vitest-environment jsdom
//
// src/components/Research/StockChart.controlledSession.test.jsx
//
// Shadow vs CPU quote integrity — E-1 chart expansion (spec
// SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md §7.2 E-1, §7.2.1, B-10; OFF-SC and
// the chart rows of ON-F2a; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// `lightweight-charts` is MOCKED (jsdom cannot paint a canvas): the mock
// records what the chart is asked to draw (setData) and hands the test the
// crosshair handler, so the OHLC readout can be read at rest and on hover.
// Real browser rendering of a no-body bar is NOT exercised here — see the
// build record's browser check.
//
// OFF-SC — with no controlled prop, the readout (rest and hover) and the drawn
// candles match the pre-build captures for 1D, 1W and bomb.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

export const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `stockChart.${name}.json`), JSON.stringify(actual, null, 1));
    return;
  }
  expect(actual).toEqual(expected);
}

const chartLog = vi.hoisted(() => ({ charts: [] }));
vi.mock('lightweight-charts', () => {
  const makeSeries = (kind) => {
    const s = {
      kind,
      data: null,
      setData(d) { s.data = d; },
      createPriceLine() { return { applyOptions() {} }; },
      removePriceLine() {},
      setMarkers() {},
      priceScale() { return { applyOptions() {} }; },
      applyOptions() {},
    };
    return s;
  };
  return {
    createChart: () => {
      const chart = {
        series: [],
        crosshair: null,
        addSeries(kind) { const s = makeSeries(kind); chart.series.push(s); return s; },
        removeSeries() {},
        subscribeCrosshairMove(fn) { chart.crosshair = fn; },
        timeScale() {
          return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; } };
        },
        applyOptions() {},
        remove() {},
      };
      chartLog.charts.push(chart);
      return chart;
    },
    CandlestickSeries: 'Candlestick',
    HistogramSeries: 'Histogram',
    LineSeries: 'Line',
    AreaSeries: 'Area',
  };
});
// The WebSocket transport is dormant (api/ws-config.js); its daily high/low
// cache is empty in production. Stubbed to that state (null) for every OFF
// row; ON rows may plant a value to prove controlled mode ignores it.
const wsBox = vi.hoisted(() => ({ hl: null }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => wsBox.hl }));

import StockChart from './StockChart.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
}

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // Thursday 2026-10-01, 1:00 PM ET.
  vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
  chartLog.charts.length = 0;
  wsBox.hl = null;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const lastChart = () => chartLog.charts[chartLog.charts.length - 1];
const candleSeries = () => lastChart().series.find((s) => s.kind === 'Candlestick');
const volumeSeries = () => lastChart().series.find((s) => s.kind === 'Histogram');

/** The OHLC readout as the player reads it: label + value pairs and the close colour. */
function readout() {
  const spans = [...container.querySelectorAll('div[style*="monospace"] > span')];
  const fields = spans.map((s) => s.textContent);
  const closeSpan = spans.find((s) => s.textContent.startsWith('C'));
  const closeColor = closeSpan ? closeSpan.querySelector('span:last-child')?.style.color ?? null : null;
  return { fields, closeColor };
}
function hover(candle) {
  vi.setSystemTime(new Date(Date.now() + 60));
  const map = new Map();
  map.set(candleSeries(), candle);
  if (volumeSeries()) map.set(volumeSeries(), { value: candle.volume || 0 });
  act(() => { lastChart().crosshair({ time: candle.time, seriesData: map }); });
  return readout();
}
function leave() {
  vi.setSystemTime(new Date(Date.now() + 60));
  act(() => { lastChart().crosshair({ time: undefined, seriesData: new Map() }); });
  return readout();
}

function renderChart(props) {
  act(() => {
    root.render(
      <StockChart
        rawData={null}
        onTimeframeChange={() => {}}
        levels={null}
        smaData={null}
        activeHighlight={null}
        height={300}
        {...props}
      />,
    );
  });
}

/** Rest, hover the last and an earlier candle, then leave — one scenario's whole readout. */
function scenario(props) {
  renderChart(props);
  const drawn = candleSeries().data.map((c) => ({ ...c }));
  const rest = readout();
  const hoverLast = hover(drawn[drawn.length - 1]);
  const hoverEarlier = hover(drawn[Math.max(0, drawn.length - 3)]);
  const afterLeave = leave();
  return { drawn, rest, hoverLast, hoverEarlier, afterLeave };
}

// ── Fixtures, shaped exactly like useResearchData's output (oldest-first) ───
const DAILY = [
  { date: '2026-09-25', open: 98, high: 100, low: 97, close: 99, volume: 1000 },
  { date: '2026-09-28', open: 99, high: 101, low: 98, close: 100, volume: 1100 },
  { date: '2026-09-29', open: 100, high: 102, low: 99, close: 101, volume: 1200 },
  { date: '2026-09-30', open: 101, high: 103, low: 100, close: 100, volume: 1300 },
];
// The legacy synthetic 1D candle for today: open = previous close (100).
const DAILY_WITH_SYNTH = [...DAILY, { date: '2026-10-01', open: 100, high: 106, low: 100, close: 105, volume: 0 }];
const WEEKLY = [
  { date: '2026-09-08', open: 95, high: 99, low: 94, close: 98, volume: 5000 },
  { date: '2026-09-15', open: 98, high: 100, low: 96, close: 97, volume: 5100 },
  { date: '2026-09-22', open: 97, high: 102, low: 96, close: 101, volume: 5200 },
  { date: '2026-09-28', open: 101, high: 104, low: 99, close: 105, volume: 5300 },
];
const BOMB = [
  { date: '2026-09-30T19:00:00.000Z', open: 101, high: 101.5, low: 100.5, close: 101, volume: 300 },
  { date: '2026-09-30T19:30:00.000Z', open: 101, high: 101.2, low: 99.8, close: 100, volume: 400 },
  { date: '2026-10-01T13:30:00.000Z', open: 103, high: 104, low: 102.5, close: 103.5, volume: 500 },
  { date: '2026-10-01T14:00:00.000Z', open: 103.5, high: 105, low: 103, close: 104.5, volume: 450 },
  // The legacy synthetic half-hour bar: open = previous bar's close.
  { date: '2026-10-01T17:00:00.000Z', open: 104.5, high: 106, low: 104.5, close: 105, volume: 0 },
];
const BOMB_NO_TODAY = BOMB.slice(0, 2);
const TODAY_DAILY = { high: 106, low: 102.5, open: 103, close: 0, _source: 'realtime' };
const GAP_DOWN_DAILY = { high: 97, low: 94, open: 96, close: 0, _source: 'realtime' };
const BOMB_DATA = { threshold: 2.5, baselinePrice: 100 };

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (10 entries).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
const OFF = {
 "bomb": {
  "afterLeave": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 106.00",
    "L 102.50",
    "C 105.00",
    "Vol 950",
    "↓",
    "7.14%",
    "to -10",
    "TAP"
   ]
  },
  "drawn": [
   {
    "close": 101,
    "high": 101.5,
    "low": 100.5,
    "open": 101,
    "time": 1790794800,
    "volume": 300
   },
   {
    "close": 100,
    "high": 101.2,
    "low": 99.8,
    "open": 101,
    "time": 1790796600,
    "volume": 400
   },
   {
    "close": 103.5,
    "high": 104,
    "low": 102.5,
    "open": 103,
    "time": 1790861400,
    "volume": 500
   },
   {
    "close": 104.5,
    "high": 105,
    "low": 103,
    "open": 103.5,
    "time": 1790863200,
    "volume": 450
   },
   {
    "close": 105,
    "high": 106,
    "low": 104.5,
    "open": 104.5,
    "time": 1790874000,
    "volume": 0
   }
  ],
  "hoverEarlier": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 104.00",
    "L 102.50",
    "C 103.50",
    "Vol 500",
    "↓",
    "7.14%",
    "to -10",
    "TAP"
   ]
  },
  "hoverLast": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 104.50",
    "H 106.00",
    "L 104.50",
    "C 105.00",
    "↓",
    "7.14%",
    "to -10",
    "TAP"
   ]
  },
  "rest": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 106.00",
    "L 102.50",
    "C 105.00",
    "Vol 950",
    "↓",
    "7.14%",
    "to -10",
    "TAP"
   ]
  }
 },
 "bombNoToday": {
  "afterLeave": {
   "closeColor": "rgb(255, 71, 87)",
   "fields": [
    "O 101.00",
    "H 106.00",
    "L 99.80",
    "C 100.00",
    "Vol 400",
    "↑",
    "2.50%",
    "to +15",
    "TAP"
   ]
  },
  "drawn": [
   {
    "close": 101,
    "high": 101.5,
    "low": 100.5,
    "open": 101,
    "time": 1790794800,
    "volume": 300
   },
   {
    "close": 100,
    "high": 101.2,
    "low": 99.8,
    "open": 101,
    "time": 1790796600,
    "volume": 400
   }
  ],
  "hoverEarlier": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 101.00",
    "H 101.50",
    "L 100.50",
    "C 101.00",
    "Vol 300",
    "↑",
    "2.50%",
    "to +15",
    "TAP"
   ]
  },
  "hoverLast": {
   "closeColor": "rgb(255, 71, 87)",
   "fields": [
    "O 101.00",
    "H 101.20",
    "L 99.80",
    "C 100.00",
    "Vol 400",
    "↑",
    "2.50%",
    "to +15",
    "TAP"
   ]
  },
  "rest": {
   "closeColor": "rgb(255, 71, 87)",
   "fields": [
    "O 101.00",
    "H 106.00",
    "L 99.80",
    "C 100.00",
    "Vol 400",
    "↑",
    "2.50%",
    "to +15",
    "TAP"
   ]
  }
 },
 "bombRealtimeExtremes": {
  "afterLeave": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 107.00",
    "L 101.00",
    "C 105.00",
    "Vol 950",
    "↓",
    "7.14%",
    "to -10",
    "TAP"
   ]
  },
  "drawn": [
   {
    "close": 101,
    "high": 101.5,
    "low": 100.5,
    "open": 101,
    "time": 1790794800,
    "volume": 300
   },
   {
    "close": 100,
    "high": 101.2,
    "low": 99.8,
    "open": 101,
    "time": 1790796600,
    "volume": 400
   },
   {
    "close": 103.5,
    "high": 104,
    "low": 102.5,
    "open": 103,
    "time": 1790861400,
    "volume": 500
   },
   {
    "close": 104.5,
    "high": 105,
    "low": 103,
    "open": 103.5,
    "time": 1790863200,
    "volume": 450
   },
   {
    "close": 105,
    "high": 106,
    "low": 104.5,
    "open": 104.5,
    "time": 1790874000,
    "volume": 0
   }
  ],
  "hoverEarlier": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 104.00",
    "L 102.50",
    "C 103.50",
    "Vol 500",
    "↓",
    "7.14%",
    "to -10",
    "TAP"
   ]
  },
  "hoverLast": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 104.50",
    "H 106.00",
    "L 104.50",
    "C 105.00",
    "↓",
    "7.14%",
    "to -10",
    "TAP"
   ]
  },
  "rest": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 107.00",
    "L 101.00",
    "C 105.00",
    "Vol 950",
    "↓",
    "7.14%",
    "to -10",
    "TAP"
   ]
  }
 },
 "cryptoBombEvening": {
  "afterLeave": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 60000.00",
    "H 61000.00",
    "L 59000.00",
    "C 60950.00",
    "Vol 11",
    "↑",
    "3.36%",
    "to +15",
    "TAP"
   ]
  },
  "drawn": [
   {
    "close": 60200,
    "high": 60500,
    "low": 59800,
    "open": 60000,
    "time": 1790897400,
    "volume": 5
   },
   {
    "close": 60800,
    "high": 60900,
    "low": 60100,
    "open": 60200,
    "time": 1790901000,
    "volume": 6
   },
   {
    "close": 60950,
    "high": 61000,
    "low": 60800,
    "open": 60800,
    "time": 1790904600,
    "volume": 0
   }
  ],
  "hoverEarlier": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 60000.00",
    "H 60500.00",
    "L 59800.00",
    "C 60200.00",
    "Vol 5",
    "↑",
    "3.36%",
    "to +15",
    "TAP"
   ]
  },
  "hoverLast": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 60800.00",
    "H 61000.00",
    "L 60800.00",
    "C 60950.00",
    "↑",
    "3.36%",
    "to +15",
    "TAP"
   ]
  },
  "rest": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 60000.00",
    "H 61000.00",
    "L 59000.00",
    "C 60950.00",
    "Vol 11",
    "↑",
    "3.36%",
    "to +15",
    "TAP"
   ]
  }
 },
 "daily1D": {
  "afterLeave": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 106.00",
    "L 100.00",
    "C 105.00"
   ]
  },
  "drawn": [
   {
    "close": 99,
    "high": 100,
    "low": 97,
    "open": 98,
    "time": 1790294400,
    "volume": 1000
   },
   {
    "close": 100,
    "high": 101,
    "low": 98,
    "open": 99,
    "time": 1790553600,
    "volume": 1100
   },
   {
    "close": 101,
    "high": 102,
    "low": 99,
    "open": 100,
    "time": 1790640000,
    "volume": 1200
   },
   {
    "close": 100,
    "high": 103,
    "low": 100,
    "open": 101,
    "time": 1790726400,
    "volume": 1300
   },
   {
    "close": 105,
    "high": 106,
    "low": 100,
    "open": 100,
    "time": 1790812800,
    "volume": 0
   }
  ],
  "hoverEarlier": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 100.00",
    "H 102.00",
    "L 99.00",
    "C 101.00",
    "Vol 1.2K"
   ]
  },
  "hoverLast": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 100.00",
    "H 106.00",
    "L 100.00",
    "C 105.00"
   ]
  },
  "rest": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 106.00",
    "L 100.00",
    "C 105.00"
   ]
  }
 },
 "daily1DGapDown": {
  "afterLeave": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 96.00",
    "H 106.00",
    "L 94.00",
    "C 105.00"
   ]
  },
  "drawn": [
   {
    "close": 99,
    "high": 100,
    "low": 97,
    "open": 98,
    "time": 1790294400,
    "volume": 1000
   },
   {
    "close": 100,
    "high": 101,
    "low": 98,
    "open": 99,
    "time": 1790553600,
    "volume": 1100
   },
   {
    "close": 101,
    "high": 102,
    "low": 99,
    "open": 100,
    "time": 1790640000,
    "volume": 1200
   },
   {
    "close": 100,
    "high": 103,
    "low": 100,
    "open": 101,
    "time": 1790726400,
    "volume": 1300
   },
   {
    "close": 105,
    "high": 106,
    "low": 100,
    "open": 100,
    "time": 1790812800,
    "volume": 0
   }
  ],
  "hoverEarlier": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 100.00",
    "H 102.00",
    "L 99.00",
    "C 101.00",
    "Vol 1.2K"
   ]
  },
  "hoverLast": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 100.00",
    "H 106.00",
    "L 100.00",
    "C 105.00"
   ]
  },
  "rest": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 96.00",
    "H 106.00",
    "L 94.00",
    "C 105.00"
   ]
  }
 },
 "daily1DNoToday": {
  "afterLeave": {
   "closeColor": "rgb(255, 71, 87)",
   "fields": [
    "O 101.00",
    "H 103.00",
    "L 100.00",
    "C 100.00",
    "Vol 1.3K"
   ]
  },
  "drawn": [
   {
    "close": 99,
    "high": 100,
    "low": 97,
    "open": 98,
    "time": 1790294400,
    "volume": 1000
   },
   {
    "close": 100,
    "high": 101,
    "low": 98,
    "open": 99,
    "time": 1790553600,
    "volume": 1100
   },
   {
    "close": 101,
    "high": 102,
    "low": 99,
    "open": 100,
    "time": 1790640000,
    "volume": 1200
   },
   {
    "close": 100,
    "high": 103,
    "low": 100,
    "open": 101,
    "time": 1790726400,
    "volume": 1300
   }
  ],
  "hoverEarlier": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 99.00",
    "H 101.00",
    "L 98.00",
    "C 100.00",
    "Vol 1.1K"
   ]
  },
  "hoverLast": {
   "closeColor": "rgb(255, 71, 87)",
   "fields": [
    "O 101.00",
    "H 103.00",
    "L 100.00",
    "C 100.00",
    "Vol 1.3K"
   ]
  },
  "rest": {
   "closeColor": "rgb(255, 71, 87)",
   "fields": [
    "O 101.00",
    "H 103.00",
    "L 100.00",
    "C 100.00",
    "Vol 1.3K"
   ]
  }
 },
 "scaffoldFlag1D": {
  "afterLeave": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 106.00",
    "L 101.50",
    "C 104.00"
   ]
  },
  "drawn": [
   {
    "close": 99,
    "high": 100,
    "low": 97,
    "open": 98,
    "time": 1790294400,
    "volume": 1000
   },
   {
    "close": 100,
    "high": 101,
    "low": 98,
    "open": 99,
    "time": 1790553600,
    "volume": 1100
   },
   {
    "close": 101,
    "high": 102,
    "low": 99,
    "open": 100,
    "time": 1790640000,
    "volume": 1200
   },
   {
    "close": 100,
    "high": 103,
    "low": 100,
    "open": 101,
    "time": 1790726400,
    "volume": 1300
   },
   {
    "close": 104,
    "high": 106,
    "low": 101.5,
    "open": 104,
    "time": 1790812800,
    "volume": 0
   }
  ],
  "hoverEarlier": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 100.00",
    "H 102.00",
    "L 99.00",
    "C 101.00",
    "Vol 1.2K"
   ]
  },
  "hoverLast": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 104.00",
    "H 106.00",
    "L 101.50",
    "C 104.00"
   ]
  },
  "rest": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 106.00",
    "L 101.50",
    "C 104.00"
   ]
  }
 },
 "scaffoldFlagBomb": {
  "afterLeave": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 106.00",
    "L 102.50",
    "C 105.00",
    "Vol 950",
    "↓",
    "7.14%",
    "to -10",
    "TAP"
   ]
  },
  "drawn": [
   {
    "close": 101,
    "high": 101.5,
    "low": 100.5,
    "open": 101,
    "time": 1790794800,
    "volume": 300
   },
   {
    "close": 100,
    "high": 101.2,
    "low": 99.8,
    "open": 101,
    "time": 1790796600,
    "volume": 400
   },
   {
    "close": 103.5,
    "high": 104,
    "low": 102.5,
    "open": 103,
    "time": 1790861400,
    "volume": 500
   },
   {
    "close": 104.5,
    "high": 105,
    "low": 103,
    "open": 103.5,
    "time": 1790863200,
    "volume": 450
   },
   {
    "close": 105,
    "high": 106,
    "low": 102.5,
    "open": 105,
    "time": 1790874000,
    "volume": 0
   }
  ],
  "hoverEarlier": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 104.00",
    "L 102.50",
    "C 103.50",
    "Vol 500",
    "↓",
    "7.14%",
    "to -10",
    "TAP"
   ]
  },
  "hoverLast": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 105.00",
    "H 106.00",
    "L 102.50",
    "C 105.00",
    "↓",
    "7.14%",
    "to -10",
    "TAP"
   ]
  },
  "rest": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 106.00",
    "L 102.50",
    "C 105.00",
    "Vol 950",
    "↓",
    "7.14%",
    "to -10",
    "TAP"
   ]
  }
 },
 "weekly1W": {
  "afterLeave": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 106.00",
    "L 99.00",
    "C 105.00",
    "Vol 5.3K"
   ]
  },
  "drawn": [
   {
    "close": 98,
    "high": 99,
    "low": 94,
    "open": 95,
    "time": 1788825600,
    "volume": 5000
   },
   {
    "close": 97,
    "high": 100,
    "low": 96,
    "open": 98,
    "time": 1789430400,
    "volume": 5100
   },
   {
    "close": 101,
    "high": 102,
    "low": 96,
    "open": 97,
    "time": 1790035200,
    "volume": 5200
   },
   {
    "close": 105,
    "high": 104,
    "low": 99,
    "open": 101,
    "time": 1790553600,
    "volume": 5300
   }
  ],
  "hoverEarlier": {
   "closeColor": "rgb(255, 71, 87)",
   "fields": [
    "O 98.00",
    "H 100.00",
    "L 96.00",
    "C 97.00",
    "Vol 5.1K"
   ]
  },
  "hoverLast": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 101.00",
    "H 104.00",
    "L 99.00",
    "C 105.00",
    "Vol 5.3K"
   ]
  },
  "rest": {
   "closeColor": "rgb(0, 255, 136)",
   "fields": [
    "O 103.00",
    "H 106.00",
    "L 99.00",
    "C 105.00",
    "Vol 5.3K"
   ]
  }
 }
};
// END GENERATED OFF REFERENCES

describe('OFF-SC — StockChart and OHLCDisplay default output (no controlled prop)', () => {
  it('OFF daily1D: synthetic today candle, todayDailyCandle merge at rest', () => {
    offReference('daily1D', scenario({ ohlcvData: DAILY_WITH_SYNTH, timeframe: '1D', symbol: 'AAPL', todayDailyCandle: TODAY_DAILY }), OFF.daily1D);
  });
  it('OFF daily1DNoToday: last candle is yesterday, no todayDailyCandle', () => {
    offReference('daily1DNoToday', scenario({ ohlcvData: DAILY, timeframe: '1D', symbol: 'AAPL', todayDailyCandle: null }), OFF.daily1DNoToday);
  });
  it('OFF daily1DGapDown: supplied extremes below the previous close', () => {
    offReference('daily1DGapDown', scenario({ ohlcvData: DAILY_WITH_SYNTH, timeframe: '1D', symbol: 'AAPL', todayDailyCandle: GAP_DOWN_DAILY }), OFF.daily1DGapDown);
  });
  it('OFF weekly1W: today\'s open applied to the week (legacy)', () => {
    offReference('weekly1W', scenario({ ohlcvData: WEEKLY, timeframe: '1W', symbol: 'AAPL', todayDailyCandle: TODAY_DAILY }), OFF.weekly1W);
  });
  it('OFF bomb: today aggregate from intraday bars + todayDailyCandle', () => {
    offReference('bomb', scenario({ ohlcvData: BOMB, timeframe: 'bomb', symbol: 'AAPL', bombData: BOMB_DATA, todayDailyCandle: TODAY_DAILY }), OFF.bomb);
  });
  it('OFF bombNoToday: no today bars — the last bar stands in (legacy)', () => {
    offReference('bombNoToday', scenario({ ohlcvData: BOMB_NO_TODAY, timeframe: 'bomb', symbol: 'AAPL', bombData: BOMB_DATA, todayDailyCandle: TODAY_DAILY }), OFF.bombNoToday);
  });
  it('OFF bombRealtimeExtremes: the realtimeExtremes prop widens the aggregate (legacy)', () => {
    offReference('bombRealtimeExtremes', scenario({
      ohlcvData: BOMB, timeframe: 'bomb', symbol: 'AAPL', bombData: BOMB_DATA, todayDailyCandle: null, realtimeExtremes: { high: 107, low: 101 },
    }), OFF.bombRealtimeExtremes);
  });
  it('OFF scaffoldFlag1D: a `_scaffold` field on the raw last element changes nothing without the controlled prop', () => {
    offReference('scaffoldFlag1D', scenario({
      ohlcvData: [...DAILY, { date: '2026-10-01', open: 104, high: 106, low: 101.5, close: 104, volume: 0, _scaffold: true }],
      timeframe: '1D', symbol: 'AAPL', todayDailyCandle: TODAY_DAILY,
    }), OFF.scaffoldFlag1D);
  });
  it('OFF scaffoldFlagBomb: same for the bomb view', () => {
    offReference('scaffoldFlagBomb', scenario({
      ohlcvData: [...BOMB.slice(0, 4), { date: '2026-10-01T17:00:00.000Z', datetime: '2026-10-01T17:00:00.000Z', timestamp: 1790874000, open: 105, high: 106, low: 102.5, close: 105, volume: 0, _scaffold: true }],
      timeframe: 'bomb', symbol: 'AAPL', bombData: BOMB_DATA, todayDailyCandle: TODAY_DAILY,
    }), OFF.scaffoldFlagBomb);
  });
  it('OFF cryptoBombEvening: 9:30 PM ET — the ET date still names "today" for crypto (legacy)', () => {
    vi.setSystemTime(new Date('2026-10-02T01:30:00.000Z'));
    const bars = [
      { date: '2026-10-01T23:30:00.000Z', open: 60000, high: 60500, low: 59800, close: 60200, volume: 5 },
      { date: '2026-10-02T00:30:00.000Z', open: 60200, high: 60900, low: 60100, close: 60800, volume: 6 },
      { date: '2026-10-02T01:30:00.000Z', open: 60800, high: 61000, low: 60800, close: 60950, volume: 0 },
    ];
    offReference('cryptoBombEvening', scenario({
      ohlcvData: bars, timeframe: 'bomb', symbol: 'BTC', bombData: { threshold: 5, baselinePrice: 60000 },
      todayDailyCandle: { high: 61000, low: 59000, open: 59500, close: 0, _source: 'realtime' },
    }), OFF.cryptoBombEvening);
  });
});

// ── ON — controlled held research (E-1, §7.2.1, B-10; chart rows of ON-F2a) ──
// Fixtures are shaped exactly like the controlled hook's output: the live bar
// is either the no-body scaffold (open = close = qualified current, flagged
// `_scaffold` on the raw element) or — stock 1D with a supplied observed
// open — a real body. todayDailyCandle is the hook's controlled form: only
// present fields, never `close`.
const NEUTRAL = 'rgb(230, 237, 243)';
const GREEN = 'rgb(0, 255, 136)';
const CONTROLLED = { crypto: false };
const SCAFFOLD_1D = { date: '2026-10-01', open: 104, high: 106, low: 101.5, close: 104, volume: 0, _scaffold: true };
const BODY_1D = { date: '2026-10-01', open: 102, high: 106, low: 101.5, close: 104, volume: 0 };
const TDC_FULL = { high: 106, low: 101.5, open: 102, _source: 'controlled' };
const TDC_NO_OPEN = { high: 106, low: 101.5, _source: 'controlled' };
const field = (r, label) => r.fields.find((f) => f.startsWith(`${label} `));

describe('ON — 1D readouts', () => {
  it('open supplied: the live bar keeps a real body and the open shows, at rest and on hover', () => {
    const r = scenario({ ohlcvData: [...DAILY, BODY_1D], timeframe: '1D', symbol: 'AAPL', todayDailyCandle: TDC_FULL, controlledSession: CONTROLLED });
    expect(r.drawn.at(-1)).toMatchObject({ open: 102, high: 106, low: 101.5, close: 104 });
    expect(r.rest.fields.slice(0, 4)).toEqual(['O 102.00', 'H 106.00', 'L 101.50', 'C 104.00']);
    expect(r.rest.closeColor).toBe(GREEN);
    expect(r.hoverLast.fields.slice(0, 4)).toEqual(['O 102.00', 'H 106.00', 'L 101.50', 'C 104.00']);
  });

  it('[B-10] open absent: the scaffold is drawn with no body; its open reads "—" with a neutral close at rest and on hover', () => {
    const r = scenario({ ohlcvData: [...DAILY, SCAFFOLD_1D], timeframe: '1D', symbol: 'AAPL', todayDailyCandle: TDC_NO_OPEN, controlledSession: CONTROLLED });
    const bar = r.drawn.at(-1);
    expect(bar.open).toBe(bar.close);
    expect(bar).toMatchObject({ open: 104, high: 106, low: 101.5, close: 104 });
    expect(r.rest.fields.slice(0, 4)).toEqual(['O —', 'H 106.00', 'L 101.50', 'C 104.00']);
    expect(r.rest.closeColor).toBe(NEUTRAL);
    expect(r.hoverLast.fields.slice(0, 4)).toEqual(['O —', 'H 106.00', 'L 101.50', 'C 104.00']);
    expect(r.hoverLast.closeColor).toBe(NEUTRAL);
    // A real earlier candle still reads its own values.
    expect(r.hoverEarlier.fields.slice(0, 4)).toEqual(['O 100.00', 'H 102.00', 'L 99.00', 'C 101.00']);
    expect(r.afterLeave).toEqual(r.rest);
  });

  it('[V-6 / E-1] gap-down: a supplied high below the previous close is today\'s high; no previous-close open anywhere', () => {
    const r = scenario({
      ohlcvData: [...DAILY, { date: '2026-10-01', open: 95, high: 97, low: 94, close: 95, volume: 0, _scaffold: true }],
      timeframe: '1D', symbol: 'AAPL', todayDailyCandle: { high: 97, low: 94, _source: 'controlled' }, controlledSession: CONTROLLED,
    });
    expect(r.rest.fields.slice(0, 4)).toEqual(['O —', 'H 97.00', 'L 94.00', 'C 95.00']);
    expect(OFF.daily1DGapDown.rest.fields[0]).toBe('O 96.00'); // legacy shows a filled open
  });

  it('[V-6 / E-1] gap-up: a supplied low above the previous close is today\'s low', () => {
    const r = scenario({
      ohlcvData: [...DAILY, { date: '2026-10-01', open: 107, high: 108, low: 104.5, close: 107, volume: 0, _scaffold: true }],
      timeframe: '1D', symbol: 'AAPL', todayDailyCandle: { high: 108, low: 104.5, _source: 'controlled' }, controlledSession: CONTROLLED,
    });
    expect(r.rest.fields.slice(0, 4)).toEqual(['O —', 'H 108.00', 'L 104.50', 'C 107.00']);
  });

  it('[E-1 item 2] no bar for today (stock, Saturday): the prior session never stands in — every today field reads "—"', () => {
    vi.setSystemTime(new Date('2026-10-03T15:00:00.000Z'));
    const friday = [...DAILY, { date: '2026-10-02', open: 100, high: 104, low: 99.5, close: 103, volume: 1400 }];
    const r = scenario({ ohlcvData: friday, timeframe: '1D', symbol: 'AAPL', todayDailyCandle: null, controlledSession: CONTROLLED });
    expect(r.rest.fields.slice(0, 4)).toEqual(['O —', 'H —', 'L —', 'C —']);
    expect(r.rest.closeColor).toBe(NEUTRAL);
    expect(r.hoverLast.fields.slice(0, 4)).toEqual(['O 100.00', 'H 104.00', 'L 99.50', 'C 103.00']);
  });

  it('a real daily candle of today keeps its observed open when the hook carries none', () => {
    const today = { date: '2026-10-01', open: 101, high: 105, low: 100.5, close: 104, volume: 9 };
    const r = scenario({ ohlcvData: [...DAILY, today], timeframe: '1D', symbol: 'AAPL', todayDailyCandle: { high: 106, low: 100, _source: 'controlled' }, controlledSession: CONTROLLED });
    expect(r.rest.fields.slice(0, 4)).toEqual(['O 101.00', 'H 106.00', 'L 100.00', 'C 104.00']);
  });

  it('crypto 1D (V-11): the open slot is "—" even over a real UTC-today candle; Priority 2 high/low apply', () => {
    vi.setSystemTime(new Date('2026-10-02T01:30:00.000Z'));
    const days = [
      { date: '2026-09-30', open: 59500, high: 60100, low: 59000, close: 60000, volume: 7 },
      { date: '2026-10-01', open: 60000, high: 61500, low: 59000, close: 60900, volume: 8 },
      { date: '2026-10-02', open: 60900, high: 61200, low: 60800, close: 61000, volume: 9 },
    ];
    const r = scenario({ ohlcvData: days, timeframe: '1D', symbol: 'BTC', todayDailyCandle: { high: 61200, low: 60800, _source: 'daily' }, controlledSession: { crypto: true } });
    expect(r.rest.fields.slice(0, 4)).toEqual(['O —', 'H 61200.00', 'L 60800.00', 'C 61000.00']);
    expect(r.rest.closeColor).toBe(NEUTRAL);
  });
});

describe('ON — 1W readouts (E-1 item 3)', () => {
  it('new week: the scaffold week bar reads "—" for its open — today\'s open (102) is never the week\'s', () => {
    const r = scenario({
      ohlcvData: [...WEEKLY.slice(0, 3), { date: '2026-09-28', open: 104, high: 106, low: 101.5, close: 104, volume: 0, _scaffold: true }],
      timeframe: '1W', symbol: 'AAPL', todayDailyCandle: TDC_FULL, controlledSession: CONTROLLED,
    });
    expect(r.rest.fields.slice(0, 4)).toEqual(['O —', 'H 106.00', 'L 101.50', 'C 104.00']);
    expect(r.hoverLast.fields[0]).toBe('O —');
    expect(OFF.weekly1W.rest.fields[0]).toBe('O 103.00'); // legacy: today's open shown as the week's
  });

  it('current week present: the week\'s own observed open shows, never today\'s', () => {
    const r = scenario({
      ohlcvData: [...WEEKLY.slice(0, 3), { date: '2026-09-28', open: 101, high: 106, low: 99, close: 104, volume: 5300 }],
      timeframe: '1W', symbol: 'AAPL', todayDailyCandle: TDC_FULL, controlledSession: CONTROLLED,
    });
    expect(r.rest.fields.slice(0, 4)).toEqual(['O 101.00', 'H 106.00', 'L 99.00', 'C 104.00']);
    expect(r.rest.closeColor).toBe(GREEN);
  });
});

describe('ON — bomb readouts (the default screen-launched view, V-10)', () => {
  const todayBars = BOMB.slice(0, 4);
  const scaffoldBomb = { date: '2026-10-01T17:00:00.000Z', datetime: '2026-10-01T17:00:00.000Z', timestamp: 1790874000, open: 105, high: 106, low: 102.5, close: 105, volume: 0, _scaffold: true };

  it('[B-10] today\'s aggregate opens at the first REAL bar of the session, never the scaffold; hovering the scaffold reads "—"', () => {
    const r = scenario({ ohlcvData: [...todayBars, scaffoldBomb], timeframe: 'bomb', symbol: 'AAPL', bombData: BOMB_DATA, todayDailyCandle: { high: 106, low: 102.5, open: 103, _source: 'controlled' }, controlledSession: CONTROLLED });
    expect(r.rest.fields.slice(0, 4)).toEqual(['O 103.00', 'H 106.00', 'L 102.50', 'C 105.00']);
    expect(r.hoverLast.fields.slice(0, 4)).toEqual(['O —', 'H 106.00', 'L 102.50', 'C 105.00']);
    expect(r.hoverLast.closeColor).toBe(NEUTRAL);
    expect(r.afterLeave.fields.slice(0, 4)).toEqual(r.rest.fields.slice(0, 4));
  });

  it('[B-7 / E-1 item 2] early gap-up, only the scaffold today: the aggregate takes the supplied open — never the scaffold\'s or yesterday\'s bar', () => {
    vi.setSystemTime(new Date('2026-10-01T13:45:00.000Z'));
    const scaffold = { date: '2026-10-01T13:30:00.000Z', datetime: '2026-10-01T13:30:00.000Z', timestamp: 1790861400, open: 104.8, high: 105, low: 103.9, close: 104.8, volume: 0, _scaffold: true };
    const withOpen = scenario({ ohlcvData: [...BOMB_NO_TODAY, scaffold], timeframe: 'bomb', symbol: 'AAPL', bombData: BOMB_DATA, todayDailyCandle: { high: 105, low: 103.9, open: 104, _source: 'controlled' }, controlledSession: CONTROLLED });
    expect(withOpen.rest.fields.slice(0, 4)).toEqual(['O 104.00', 'H 105.00', 'L 103.90', 'C 104.80']);
    act(() => root.unmount());
    root = createRoot(container);
    const noOpen = scenario({ ohlcvData: [...BOMB_NO_TODAY, scaffold], timeframe: 'bomb', symbol: 'AAPL', bombData: BOMB_DATA, todayDailyCandle: { high: 105, low: 103.9, _source: 'controlled' }, controlledSession: CONTROLLED });
    expect(noOpen.rest.fields.slice(0, 4)).toEqual(['O —', 'H 105.00', 'L 103.90', 'C 104.80']);
  });

  it('[E-1 item 2] no today bars at all (pre-market): the last prior-session bar never stands in as today\'s aggregate', () => {
    vi.setSystemTime(new Date('2026-10-01T12:00:00.000Z'));
    const r = scenario({ ohlcvData: BOMB_NO_TODAY, timeframe: 'bomb', symbol: 'AAPL', bombData: BOMB_DATA, todayDailyCandle: null, controlledSession: CONTROLLED });
    expect(r.rest.fields.slice(0, 4)).toEqual(['O —', 'H —', 'L —', 'C —']);
    expect(OFF.bombNoToday.rest.fields[0]).toBe('O 101.00'); // legacy: yesterday's bar stood in
  });

  it('[E-1 item 5] the dormant WebSocket daily high/low and the realtimeExtremes prop are ignored', () => {
    wsBox.hl = { high: 999, low: 1 };
    const r = scenario({ ohlcvData: [...todayBars, scaffoldBomb], timeframe: 'bomb', symbol: 'AAPL', bombData: BOMB_DATA, todayDailyCandle: { high: 106, low: 102.5, _source: 'controlled' }, realtimeExtremes: { high: 998, low: 2 }, controlledSession: CONTROLLED });
    expect(r.rest.fields.slice(0, 4)).toEqual(['O 103.00', 'H 106.00', 'L 102.50', 'C 105.00']);
  });

  it('[E-1 item 6] crypto in the ET evening: "today" is the UTC date; no open slot (V-11)', () => {
    vi.setSystemTime(new Date('2026-10-02T01:40:00.000Z'));
    const bars = [
      { date: '2026-10-01T23:30:00.000Z', open: 60000, high: 60500, low: 59500, close: 60200, volume: 5 },
      { date: '2026-10-02T00:30:00.000Z', open: 60200, high: 60900, low: 60100, close: 60800, volume: 6 },
      { date: '2026-10-02T01:30:00.000Z', datetime: '2026-10-02T01:30:00.000Z', timestamp: 1790832600, open: 60950, high: 61000, low: 60100, close: 60950, volume: 0, _scaffold: true },
    ];
    const r = scenario({ ohlcvData: bars, timeframe: 'bomb', symbol: 'BTC', bombData: { threshold: 5, baselinePrice: 60000 }, todayDailyCandle: { high: 61000, low: 60100, _source: 'controlled' }, controlledSession: { crypto: true } });
    // The 23:30Z bar is the previous UTC day: its 59,500 low is not today's.
    expect(r.rest.fields.slice(0, 4)).toEqual(['O —', 'H 61000.00', 'L 60100.00', 'C 60950.00']);
    expect(r.rest.closeColor).toBe(NEUTRAL);
    expect(field(OFF.cryptoBombEvening.rest, 'L')).toBe('L 59000.00'); // legacy merged the previous UTC day
  });
});
