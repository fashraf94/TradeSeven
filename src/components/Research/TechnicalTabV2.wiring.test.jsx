// @vitest-environment jsdom
//
// Research modal wiring follow-up (build report
// docs/audits/20261015_BUILD_RESEARCH_MODAL_WIRING.md):
//   W-3  one price format for the modal (priceFormat.js): $1 and up → 2
//        decimals, $0.01 to $1 → 4 decimals, below $0.01 → 4 significant
//        figures — in the Technical tab's "Current", level and range rows.
//   W-4  the hook dates each MACD reading by the bar it was read at — the bars
//        whose closes the indicators use — so a cross is named by its bar.
// The REAL tab and the REAL hook; stubbed: the network (eodhdAPI), the dormant
// WebSocket daily high/low and the sector summary.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const net = vi.hoisted(() => ({ daily: [] }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe) => Promise.resolve(timeframe === '1d' ? net.daily : []),
  getStockPrice: () => Promise.resolve(null),
}));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../../services/sectorDataService', () => ({ getQuickSectorSummary: () => Promise.resolve(null) }));

import TechnicalTabV2 from './TechnicalTabV2';
import useResearchData from './useResearchData';
import { priceText, priceDecimals } from './priceFormat';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const QUIET = { rsi: 50, macd: null, macdHistogram: [], sma50: null };
async function render(props) {
  await act(async () => {
    root.render(<TechnicalTabV2 asset={{ symbol: 'AAPL', price: 100 }} indicators={QUIET} levels={null} dailyData={null} onLevelHighlight={() => {}} {...props} />);
  });
}
const current = () => [...container.querySelectorAll('span')].find((s) => s.textContent === 'Current').nextElementSibling.textContent;
const levelPrices = () => [...container.querySelectorAll('div')].filter((d) => d.style.cursor === 'pointer').map((r) => r.querySelector('span').textContent);
const level = (price) => ({ price, strength: 'MODERATE', distanceFromCurrent: '0' });
/** `n` daily bars ending on `lastDate`, newest-first; `fill(i)` overrides bar i (0 = newest). */
function dailyBars(n, lastDate, fill = () => ({})) {
  const out = [];
  const d = new Date(`${lastDate}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    const close = 1 + 0.01 * Math.sin(i / 3);
    out.push({ date: d.toISOString().slice(0, 10), open: close, high: close * 1.01, low: close * 0.99, close, volume: 1000, ...fill(i) });
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

describe('W-3 — the price format (priceFormat.js)', () => {
  it('$1 and up: 2 decimals; $0.01 to $1: 4 decimals; below $0.01: 4 significant figures', () => {
    expect(priceText(475.6)).toBe('475.60');
    expect(priceText(1)).toBe('1.00');
    expect(priceText(0.2049)).toBe('0.2049');
    expect(priceText(0.01)).toBe('0.0100');
    expect(priceText(0.00001234)).toBe('0.00001234');
    expect(priceText(0.0000001234)).toBe('0.0000001234'); // past toPrecision's switch to "1.234e-7"
    expect(priceText(0.009996)).toBe('0.009996');
  });

  it('the band is read from the rounded price: one that rounds up into the next band prints in it', () => {
    expect(priceText(0.99996)).toBe('1.00'); // not "1.0000"
    expect(priceText(1.00004)).toBe('1.00');
    expect(priceText(0.999949)).toBe('0.9999');
    expect(priceText(0.0099996)).toBe('0.0100'); // not "0.01000"
    expect(priceText(0.00009999)).toBe('0.00009999');
  });

  it('at most 10 decimals (the chart library mislabels 11 and throws past 16); an asset\'s decimals can be passed in', () => {
    expect(priceDecimals(2.822e-8)).toBe(10);
    expect(priceText(2.822e-8)).toBe('0.0000000282');
    expect(priceText(1e-98)).toBe('0.0000000000'); // toFixed past 100 digits would throw
    expect(priceDecimals(1.234e-7)).toBe(10);
    expect(priceText(1.05, 4)).toBe('1.0500');
    expect(priceText(0.98, 2)).toBe('0.98');
  });

  it('no price to size: absent stays absent, zero reads "0.00"', () => {
    expect(priceText(undefined)).toBeUndefined();
    expect(priceText(null)).toBeUndefined();
    expect(priceText(0)).toBe('0.00');
    expect(priceDecimals(Number.NaN)).toBe(2);
  });
});

describe('W-3 — the Technical tab prints each price in its asset\'s format', () => {
  it('a stock: "Current" $475.60 and its levels at two decimals', async () => {
    await render({ asset: { symbol: 'AAPL', price: 475.6 }, levels: { support: [level(470.62)], resistance: [level(480)], currentPrice: 475.6 } });
    expect(current()).toBe('$475.60');
    expect(levelPrices()).toEqual(['$480.00', '$470.62']);
  });

  it('DOGE-class: "Current" $0.2049; two levels that both read "$0.20" at two decimals print distinct values', async () => {
    await render({ asset: { symbol: 'DOGE', price: 0.2049 }, levels: { support: [level(0.2041), level(0.2001)], resistance: [level(0.2051)], currentPrice: 0.2045 } });
    expect(current()).toBe('$0.2049');
    expect(levelPrices()).toEqual(['$0.2051', '$0.2041', '$0.2001']);
  });

  it('sub-cent: "Current" $0.00001234 and its levels at four significant figures', async () => {
    await render({ asset: { symbol: 'SHIB', price: 0.00001234 }, levels: { support: [level(0.0000118)], resistance: [level(0.0000129)], currentPrice: 0.0000123 } });
    expect(current()).toBe('$0.00001234');
    expect(levelPrices()).toEqual(['$0.00001290', '$0.00001180']);
  });

  it('one precision per asset: at $0.999, levels just over $1 keep four decimals (two would print "$1.00" twice)', async () => {
    await render({ asset: { symbol: 'ADA', price: 0.999 }, levels: { support: [level(0.9951)], resistance: [level(1.0004), level(1.0049)], currentPrice: 0.999 } });
    expect(current()).toBe('$0.9990');
    expect(levelPrices()).toEqual(['$1.0049', '$1.0004', '$0.9951']);
  });

  it('one precision per asset: at $1.02, a $0.98 level prints two decimals, as the chart\'s axis labels it', async () => {
    await render({ asset: { symbol: 'ADA', price: 1.02 }, levels: { support: [level(0.98)], resistance: [level(1.05)], currentPrice: 1.02 } });
    expect(current()).toBe('$1.02');
    expect(levelPrices()).toEqual(['$1.05', '$0.98']);
  });

  it('no shown price: each level prints by its own size', async () => {
    await render({ asset: { symbol: 'DOGE', price: 0 }, levels: { support: [level(0.2001)], resistance: [level(0.2051)], currentPrice: 0.2045 } });
    expect(levelPrices()).toEqual(['$0.2051', '$0.2001']);
  });

  it('range endpoints in the asset\'s precision: ADA at $0.98 with a $0.95–$1.10 range reads "$0.9500" and "$1.1000"', async () => {
    const dailyData = dailyBars(30, '2026-10-14', (i) => ({
      open: 1, high: 1.01, low: 0.99, close: 1, ...(i === 3 ? { low: 0.95 } : {}), ...(i === 7 ? { high: 1.1 } : {}),
    }));
    await render({ asset: { symbol: 'ADA', price: 0.98 }, dailyData, sessionDate: '2026-10-15' });
    const range = [...container.querySelectorAll('span')].map((s) => s.textContent).filter((t) => t.startsWith('$'));
    expect(range).toEqual(['$0.9500', '$1.1000']);
  });

  it('DOGE-class range endpoints: "$0.1523" and "$0.4871"', async () => {
    const dailyData = dailyBars(30, '2026-10-14', (i) => ({
      open: 0.3, high: 0.31, low: 0.29, close: 0.3, ...(i === 3 ? { low: 0.1523 } : {}), ...(i === 7 ? { high: 0.4871 } : {}),
    }));
    await render({ asset: { symbol: 'DOGE', price: 0.3 }, dailyData, sessionDate: '2026-10-15' });
    const range = [...container.querySelectorAll('span')].map((s) => s.textContent).filter((t) => t.startsWith('$'));
    expect(range).toEqual(['$0.1523', '$0.4871']);
  });
});

describe('W-4 — each MACD reading is dated by the bar behind it', () => {
  it('the hook\'s dates follow the bars whose closes it used: a bar with no usable close is skipped by both', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T17:00:00.000Z'));
    net.daily = dailyBars(80, '2026-10-14', (i) => (i === 1 ? { close: null } : {}));
    const out = {};
    function Probe() { out.latest = useResearchData('DOGE', { isCrypto: true, currentPrice: 1 }); return null; }
    await act(async () => { root.render(<Probe />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const { macdHistogram, macdHistogramDates } = out.latest.indicators;
    expect(macdHistogram).toHaveLength(6);
    // Oct 13 (bar 1) has no close: the second reading is Oct 12's.
    expect(macdHistogramDates).toEqual(['2026-10-14', '2026-10-12', '2026-10-11', '2026-10-10', '2026-10-09', '2026-10-08']);
  });

  it('the tab names a cross by that date; without a date it says "cross" and no count', async () => {
    const macd = { macd: 1, signal: 0.7, histogram: 0.3 };
    const macdHistogram = [0.3, 0.2, 0.1, -0.1, -0.2, -0.3];
    const rowText = () => [...container.querySelectorAll('span')].find((s) => s.textContent === 'MACD Signal').parentElement.textContent;
    await render({ indicators: { ...QUIET, macd, macdHistogram, macdHistogramDates: ['2026-10-14', '2026-10-12', '2026-10-09', '2026-10-08', '2026-10-07', '2026-10-06'] } });
    expect(rowText()).toBe('MACD Signal Bullish cross · Oct 9');
    await render({ indicators: { ...QUIET, macd, macdHistogram } });
    expect(rowText()).toBe('MACD Signal Bullish cross');
    await render({ indicators: { ...QUIET, macd, macdHistogram, macdHistogramDates: ['2026-10-14', '2026-10-12', 'Oct 9', '2026-10-08', '2026-10-07', '2026-10-06'] } });
    expect(rowText()).toBe('MACD Signal Bullish cross'); // not a YYYY-MM-DD date: no date shown
  });
});
