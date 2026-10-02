// @vitest-environment jsdom
//
// src/components/draft/AssetResearchModal.controlledQuote.test.jsx
//
// Shadow vs CPU quote integrity — the research modal's controlled held-quote
// mode (spec SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md §7.2 items 1–8, A-3,
// V-6, B-9, B-10; ON-F2a/ON-F2b at modal level; OFF-6 default research
// consumers; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// The REAL modal, the REAL research hook, the REAL chart (lightweight-charts
// mocked — jsdom cannot paint), the REAL header and the REAL "Why is it
// moving?" popup. Stubbed: the network (eodhdAPI, fetchWithAuth, the company
// profile), the dormant WebSocket daily high/low, and the drawer's heavy tabs
// (recorders that expose their navigation callbacks).
//
// OFF — the default (uncontrolled) modal makes the same requests, shows the
// same header, readout and tab payloads and sends the same popup body as the
// pre-build SHA (captured there with SHADOW_OFF_CAPTURE_DIR).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

export const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `researchModal.${name}.json`), JSON.stringify(actual, null, 1));
    return;
  }
  expect(actual).toEqual(expected);
}

// ── Boundaries ───────────────────────────────────────────────────────────────
const net = vi.hoisted(() => ({ calls: [], daily: {}, intraday: {}, quote: {}, popupBodies: [], hold: new Set() }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['fetchHistoricalOHLCV', symbol, timeframe, opts ?? null]);
    // ON rows may hold a timeframe's history in flight (never resolves).
    if (net.hold.has(timeframe)) return new Promise(() => {});
    const table = timeframe === '1d' ? net.daily : timeframe === '30m' ? net.intraday : {};
    return Promise.resolve(table[symbol] ?? []);
  },
  getStockPrice: (symbol) => {
    net.calls.push(['getStockPrice', symbol]);
    return Promise.resolve(net.quote[symbol] ?? { symbol, price: 0 });
  },
}));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: () => Promise.resolve(null) }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../../utils/fetchWithAuth', () => ({
  fetchWithAuth: (url, options) => {
    net.popupBodies.push({ url, body: JSON.parse(options.body) });
    return Promise.resolve({ json: async () => ({ success: true, data: { summary: 'x', drivers: [] } }) });
  },
}));
vi.mock('lightweight-charts', () => {
  const series = () => ({ setData() {}, createPriceLine() { return { applyOptions() {} }; }, removePriceLine() {}, setMarkers() {}, priceScale() { return { applyOptions() {} }; }, applyOptions() {} });
  return {
    createChart: () => ({
      addSeries: () => series(),
      removeSeries() {},
      subscribeCrosshairMove() {},
      timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; } }; },
      applyOptions() {},
      remove() {},
    }),
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
// The drawer renders its tab content directly, plus one button per tab so a
// row can switch tabs; the heavy tabs are recorders.
const tabs = vi.hoisted(() => ({ baggerbomb: [], navigate: null }));
vi.mock('../Research/AnalysisDrawer', () => ({
  default: ({ children, setActiveTab }) => (
    <div data-test-drawer="1">
      {['fundamental', 'technical', 'baggerbomb', 'compete'].map((t) => (
        <button key={t} type="button" data-test-tab={t} onClick={() => setActiveTab(t)}>{t}</button>
      ))}
      {children}
    </div>
  ),
}));
vi.mock('./ResearchTabs/BaggerBombTab', () => ({
  default: ({ asset }) => { tabs.baggerbomb.push({ symbol: asset?.symbol, price: asset?.price, lockedPrice: asset?.lockedPrice, threshold: asset?.threshold }); return null; },
}));
vi.mock('./CompeteTab', () => ({
  default: ({ onNavigateToStock }) => { tabs.navigate = onNavigateToStock; return <div data-test-compete="1" />; },
}));
vi.mock('../Research/AnalysisQATab', () => ({ default: () => null }));
vi.mock('../Research/TechnicalTabV2', () => ({ default: () => null }));
vi.mock('../Research/HealthTab', () => ({ default: () => null }));
vi.mock('./ResearchTabs/TechnicalAnalysisTab', () => ({ default: () => null }));
vi.mock('./SectorTab', () => ({ default: () => null }));
vi.mock('../Research/MarketContextTab', () => ({ default: () => null }));
vi.mock('../Research/HoldingsTab', () => ({ default: () => null }));
vi.mock('../Research/SectorETFRanksTab', () => ({ default: () => null }));
vi.mock('../Research/SmartMoneyTab', () => ({ default: () => null }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));

import AssetResearchModal from './AssetResearchModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
}

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z')); // Thu 1:00 PM ET
  net.calls.length = 0;
  net.popupBodies.length = 0;
  net.daily = {};
  net.intraday = {};
  net.quote = {};
  net.hold.clear();
  tabs.baggerbomb.length = 0;
  tabs.navigate = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const flush = async () => {
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
};
async function mount(props) {
  await act(async () => { root.render(<AssetResearchModal onClose={() => {}} {...props} />); });
  await flush();
}
async function rerender(props) {
  await act(async () => { root.render(<AssetResearchModal onClose={() => {}} {...props} />); });
  await flush();
}
/** The header's price and daily-change pill, as text. */
function header() {
  const hdr = [...document.body.querySelectorAll('div')].find((d) => d.style.height === '52px');
  if (!hdr) return null;
  return [...hdr.querySelectorAll('span')].map((s) => s.textContent).filter((t) => t.startsWith('$') || t.includes('%'));
}
function readout() {
  const box = [...document.body.querySelectorAll('div')].find((d) => d.style.position === 'absolute' && d.style.top === '8px' && d.style.left === '8px' && d.style.fontFamily === 'monospace');
  return box ? [...box.children].map((s) => s.textContent) : null;
}
async function openWhyMoving() {
  const btn = [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'Why?');
  await act(async () => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await flush();
  return net.popupBodies[net.popupBodies.length - 1]?.body ?? null;
}

function dailyHistory(lastDate, lastClose, n = 25) {
  const out = [];
  const d = new Date(`${lastDate}T00:00:00Z`);
  let close = lastClose;
  for (let i = 0; i < n; i++) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      out.push({ date: d.toISOString().slice(0, 10), open: close - 0.5, high: close + 1, low: close - 1.5, close, volume: 1000 + i });
      close -= 0.25;
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}
function sessionBars(date, startPrice, { upto = '19:30' } = {}) {
  const bars = [];
  let p = startPrice;
  for (let h = 13; h <= 19; h++) {
    for (const m of [0, 30]) {
      if (h === 13 && m === 0) continue;
      const hm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (hm > upto) continue;
      const iso = `${date}T${hm}:00.000Z`;
      bars.push({ date: iso, datetime: iso, timestamp: Math.floor(Date.parse(iso) / 1000), open: p, high: p + 0.4, low: p - 0.3, close: p + 0.1, volume: 100 });
      p += 0.1;
    }
  }
  return bars.reverse();
}

// What the screen's legacy builder hands the modal for a held row today: the
// entry-relative return rides as percentChange (researchAssetBuilder.js:58-67).
const LEGACY_HELD_ASSET = { symbol: 'AAPL', name: 'AAPL', price: 104, percentChange: 3.96, threshold: 2.5, lockedPrice: 100.04, currentPrice: 104 };
const LEGACY_PROPS = {
  showActionButton: false, isGameContext: true, version: 2, defaultTab: 'baggerbomb', defaultTimeframe: 'bomb',
};

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (4 entries).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
const OFF = {
 "heldLegacy": {
  "body": {
   "change": 3.96,
   "close": 0,
   "high": 106,
   "low": 101.5,
   "name": "AAPL",
   "open": 102,
   "price": 104,
   "symbol": "AAPL"
  },
  "callsAfterMinute": 4,
  "first": {
   "calls": [
    [
     "fetchHistoricalOHLCV",
     "AAPL",
     "30m",
     {
      "days": 20
     }
    ],
    [
     "fetchHistoricalOHLCV",
     "AAPL",
     "1d",
     {
      "days": 5
     }
    ],
    [
     "getStockPrice",
     "AAPL"
    ]
   ],
   "header": [
    "$104.00",
    "▲ 4.00%"
   ],
   "readout": [
    "O 102.00",
    "H 106.00",
    "L 101.50",
    "C 104.00",
    "Vol 600"
   ],
   "tab": {
    "lockedPrice": 100.04,
    "price": 104,
    "symbol": "AAPL",
    "threshold": 2.5
   }
  }
 },
 "internalNavigation": {
  "hasBack": true,
  "navigated": {
   "calls": [
    [
     "fetchHistoricalOHLCV",
     "AAPL",
     "1d",
     null
    ],
    [
     "getStockPrice",
     "AAPL"
    ],
    [
     "fetchHistoricalOHLCV",
     "MSFT",
     "1d",
     null
    ],
    [
     "getStockPrice",
     "MSFT"
    ],
    [
     "getStockPrice",
     "MSFT"
    ]
   ],
   "header": [
    "$405.00",
    "▲ 1.25%"
   ]
  }
 },
 "priceless": {
  "calls": [
   [
    "getStockPrice",
    "TSLA"
   ],
   [
    "fetchHistoricalOHLCV",
    "TSLA",
    "1d",
    null
   ],
   [
    "getStockPrice",
    "TSLA"
   ]
  ],
  "header": [
   "$252.00",
   "▲ 0.80%"
  ]
 },
 "samePriceUpdate": {
  "calls": [
   [
    "fetchHistoricalOHLCV",
    "AAPL",
    "1d",
    null
   ],
   [
    "getStockPrice",
    "AAPL"
   ]
  ],
  "header": [
   "$104.00",
   "▲ 4.60%"
  ],
  "readout": [
   "O 102.00",
   "H 106.00",
   "L 101.50",
   "C 104.60"
  ]
 }
};
// END GENERATED OFF REFERENCES

describe('OFF — the default (uncontrolled) research modal', () => {
  it('OFF heldLegacy: requests, header, readout, tab payload and popup body', async () => {
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    net.intraday.AAPL = [...sessionBars('2026-10-01', 102, { upto: '16:00' }), ...sessionBars('2026-09-30', 99)];
    net.quote.AAPL = { symbol: 'AAPL', price: 104, high: 106, low: 101.5, open: 102, previousClose: 100 };
    await mount({ ...LEGACY_PROPS, asset: LEGACY_HELD_ASSET, wsPrice: 104 });
    const first = { header: header(), readout: readout(), calls: [...net.calls], tab: tabs.baggerbomb[tabs.baggerbomb.length - 1] };
    const body = await openWhyMoving();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    offReference('heldLegacy', { first, body, callsAfterMinute: net.calls.length }, OFF.heldLegacy);
  });

  it('OFF samePriceUpdate: a parent price change for the same symbol does not reach the legacy modal (symbol-keyed state)', async () => {
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    net.quote.AAPL = { symbol: 'AAPL', price: 104, high: 106, low: 101.5, open: 102 };
    await mount({ ...LEGACY_PROPS, defaultTimeframe: '1D', asset: LEGACY_HELD_ASSET, wsPrice: 104 });
    await rerender({ ...LEGACY_PROPS, defaultTimeframe: '1D', asset: { ...LEGACY_HELD_ASSET, price: 104.6, currentPrice: 104.6 }, wsPrice: 104.6 });
    offReference('samePriceUpdate', { header: header(), readout: readout(), calls: [...net.calls] }, OFF.samePriceUpdate);
  });

  it('OFF priceless: an asset opened without a price is filled by getStockPrice', async () => {
    net.daily.TSLA = dailyHistory('2026-09-30', 250);
    net.quote.TSLA = { symbol: 'TSLA', price: 252, high: 255, low: 248, open: 250, percentChange: 0.8 };
    await mount({ ...LEGACY_PROPS, defaultTimeframe: '1D', asset: { symbol: 'TSLA' } });
    offReference('priceless', { header: header(), calls: [...net.calls] }, OFF.priceless);
  });

  it('OFF internalNavigation: a tab navigates to another symbol, which is price-filled; back returns', async () => {
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    net.daily.MSFT = dailyHistory('2026-09-30', 400);
    net.quote.AAPL = { symbol: 'AAPL', price: 104, high: 106, low: 101.5, open: 102 };
    net.quote.MSFT = { symbol: 'MSFT', price: 405, high: 407, low: 399, open: 401, percentChange: 1.1 };
    await mount({ ...LEGACY_PROPS, defaultTimeframe: '1D', asset: LEGACY_HELD_ASSET, wsPrice: 104 });
    await act(async () => { document.body.querySelector('[data-test-tab="compete"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { tabs.navigate('MSFT', 'Microsoft'); });
    await flush();
    const navigated = { header: header(), calls: [...net.calls] };
    const back = [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes('Back') || b.textContent === '←');
    offReference('internalNavigation', { navigated, hasBack: Boolean(back) }, OFF.internalNavigation);
  });
});

// ── ON — controlled held research (§7.2 items 2–5, A-3, V-6, B-9) ───────────
// What the gated screen passes for a HELD position whose quote qualified: the
// asset bound to the qualified current and the recorded entry (no builder
// fallback chain, no entry-relative percentChange), and the contract.
const HELD_ASSET = { symbol: 'AAPL', name: 'AAPL', price: 104, currentPrice: 104, lockedPrice: 100.04, threshold: 2.5 };
const EXTREMES = { sessionDate: '2026-10-01', high: 106, low: 101.5, open: 102 };
const CONTRACT = { posKey: 'player:star:0', symbol: 'AAPL', price: 104, extremes: EXTREMES };
const quoteCalls = () => net.calls.filter((c) => c[0] === 'getStockPrice');
const withoutQuotes = (calls) => calls.filter((c) => c[0] !== 'getStockPrice');
function seedAapl() {
  net.daily.AAPL = dailyHistory('2026-09-30', 100);
  net.intraday.AAPL = [...sessionBars('2026-10-01', 102, { upto: '16:00' }), ...sessionBars('2026-09-30', 99)];
  // A quote that would be WRONG if it were ever fetched.
  net.quote.AAPL = { symbol: 'AAPL', price: 777, high: 999, low: 1, open: 555, previousClose: 100 };
}

describe('ON — healthy held open', () => {
  it('bomb view (the screen default): qualified current, research daily change, supplied extremes, entry kept separate — and no price request, ever', async () => {
    seedAapl();
    await mount({ ...LEGACY_PROPS, asset: HELD_ASSET, wsPrice: 104, controlledQuote: CONTRACT });
    expect(header()).toEqual(['$104.00', '▲ 4.00%']);
    expect(readout()).toEqual(['O 102.00', 'H 106.00', 'L 101.50', 'C 104.00', 'Vol 600']);
    expect(tabs.baggerbomb.at(-1)).toEqual({ symbol: 'AAPL', price: 104, lockedPrice: 100.04, threshold: 2.5 });
    const body = await openWhyMoving();
    // [B-9] change = the header's daily change, never the entry return (3.96);
    // [V-6 b] no zero open/close, and no close at all.
    expect(body).toEqual({ symbol: 'AAPL', name: 'AAPL', change: 4, price: 104, open: 102, high: 106, low: 101.5 });
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60 * 1000); });
    expect(quoteCalls()).toEqual([]);
    expect(net.calls).toEqual(withoutQuotes(OFF.heldLegacy.first.calls));
    expect(OFF.heldLegacy.body.change).toBe(3.96); // the pre-build entry-relative return
  });

  it('a mismatched wsPrice is ignored; omitting it changes nothing', async () => {
    seedAapl();
    await mount({ ...LEGACY_PROPS, asset: HELD_ASSET, wsPrice: 999, controlledQuote: CONTRACT });
    const mismatched = { header: header(), readout: readout() };
    act(() => root.unmount());
    root = createRoot(container);
    await mount({ ...LEGACY_PROPS, asset: HELD_ASSET, controlledQuote: CONTRACT });
    expect(mismatched).toEqual({ header: header(), readout: readout() });
    expect(mismatched.header[0]).toBe('$104.00');
    expect(quoteCalls()).toEqual([]);
  });

  it('[A-3] 1D header: the supplied open, high and low; without a supplied open the open reads "—"', async () => {
    seedAapl();
    await mount({ ...LEGACY_PROPS, defaultTimeframe: '1D', asset: HELD_ASSET, controlledQuote: CONTRACT });
    expect(readout()).toEqual(['O 102.00', 'H 106.00', 'L 101.50', 'C 104.00']);
    act(() => root.unmount());
    root = createRoot(container);
    await mount({
      ...LEGACY_PROPS, defaultTimeframe: '1D', asset: HELD_ASSET,
      controlledQuote: { ...CONTRACT, extremes: { sessionDate: '2026-10-01', high: 106, low: 101.5 } },
    });
    expect(readout()).toEqual(['O —', 'H 106.00', 'L 101.50', 'C 104.00']);
    const body = await openWhyMoving();
    expect(body).toEqual({ symbol: 'AAPL', name: 'AAPL', change: 4, price: 104, high: 106, low: 101.5 });
  });

  it('[V-6] gap-down (supplied high below the previous close) and gap-up (low above it)', async () => {
    seedAapl();
    const down = { ...HELD_ASSET, price: 95, currentPrice: 95 };
    await mount({
      ...LEGACY_PROPS, defaultTimeframe: '1D', asset: down,
      controlledQuote: { ...CONTRACT, price: 95, extremes: { sessionDate: '2026-10-01', high: 97, low: 94 } },
    });
    expect(header()).toEqual(['$95.00', '▼ 5.00%']);
    expect(readout()).toEqual(['O —', 'H 97.00', 'L 94.00', 'C 95.00']);
    expect(await openWhyMoving()).toEqual({ symbol: 'AAPL', name: 'AAPL', change: -5, price: 95, high: 97, low: 94 });
    act(() => root.unmount());
    root = createRoot(container);
    const up = { ...HELD_ASSET, price: 107, currentPrice: 107 };
    await mount({
      ...LEGACY_PROPS, defaultTimeframe: '1D', asset: up,
      controlledQuote: { ...CONTRACT, price: 107, extremes: { sessionDate: '2026-10-01', high: 108, low: 104.5, open: 105 } },
    });
    expect(readout()).toEqual(['O 105.00', 'H 108.00', 'L 104.50', 'C 107.00']);
  });

  it('[B-9] while the daily change is not yet known, the popup omits `change`', async () => {
    seedAapl();
    net.hold.add('1d');
    await mount({ ...LEGACY_PROPS, asset: HELD_ASSET, controlledQuote: CONTRACT });
    const body = await openWhyMoving();
    expect('change' in body).toBe(false);
    expect(body).toEqual({ symbol: 'AAPL', name: 'AAPL', price: 104, open: 102, high: 106, low: 101.5 });
  });

  it('[ON-F2b] a same-position quote change updates at once — no remount, no refetch', async () => {
    seedAapl();
    await mount({ ...LEGACY_PROPS, defaultTimeframe: '1D', asset: HELD_ASSET, controlledQuote: CONTRACT });
    const before = net.calls.length;
    const chartsBefore = document.body.querySelectorAll('[data-test-drawer]').length;
    await rerender({
      ...LEGACY_PROPS, defaultTimeframe: '1D', asset: { ...HELD_ASSET, price: 104.6, currentPrice: 104.6 },
      controlledQuote: { ...CONTRACT, price: 104.6, extremes: { ...EXTREMES, high: 106.2 } },
    });
    expect(header()[0]).toBe('$104.60');
    expect(readout()).toEqual(['O 102.00', 'H 106.20', 'L 101.50', 'C 104.60']);
    expect(net.calls.length).toBe(before);
    expect(document.body.querySelectorAll('[data-test-drawer]').length).toBe(chartsBefore);
    expect(OFF.samePriceUpdate.header[0]).toBe('$104.00'); // legacy kept its symbol-keyed price
  });

  it('crypto (V-11): no observed open anywhere — readout "—", popup body without open', async () => {
    vi.setSystemTime(new Date('2026-10-02T01:30:00.000Z'));
    net.daily.BTC = [
      { date: '2026-10-02', open: 60900, high: 61200, low: 60800, close: 61000, volume: 9 },
      { date: '2026-10-01', open: 60000, high: 61500, low: 59000, close: 60900, volume: 8 },
      ...dailyHistory('2026-09-30', 60000),
    ];
    const btc = { symbol: 'BTC', name: 'Bitcoin', price: 61000, currentPrice: 61000, lockedPrice: 58000, threshold: 3, isCrypto: true };
    await mount({ ...LEGACY_PROPS, defaultTimeframe: '1D', asset: btc, controlledQuote: { posKey: 'cpu:star:1', symbol: 'BTC', price: 61000, extremes: null } });
    expect(readout().slice(0, 4)).toEqual(['O —', 'H 61200.00', 'L 60800.00', 'C 61000.00']);
    const body = await openWhyMoving();
    // [B-8] the UTC-today candle's high/low; previous close = the previous UTC day's.
    expect(body).toEqual({ symbol: 'BTC', name: 'Bitcoin', change: ((61000 - 60900) / 60900) * 100, price: 61000, high: 61200, low: 60800 });
    expect(quoteCalls()).toEqual([]);
  });
});

describe('ON — no departure from controlled held research (§7.2 item 4)', () => {
  it('internal navigation and back history are disabled; no request for another name', async () => {
    seedAapl();
    net.daily.MSFT = dailyHistory('2026-09-30', 400);
    net.quote.MSFT = { symbol: 'MSFT', price: 405 };
    await mount({ ...LEGACY_PROPS, defaultTimeframe: '1D', asset: HELD_ASSET, controlledQuote: CONTRACT });
    await act(async () => { document.body.querySelector('[data-test-tab="compete"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { tabs.navigate('MSFT', 'Microsoft'); });
    await flush();
    expect(header()[0]).toBe('$104.00');
    expect(net.calls.some((c) => c[1] === 'MSFT')).toBe(false);
    expect([...document.body.querySelectorAll('button')].some((b) => b.textContent === '←')).toBe(false);
  });
});

describe('ON — malformed controlled contracts fail closed (§7.2 item 5)', () => {
  const BAD = {
    symbolMismatch: { ...CONTRACT, symbol: 'MSFT' },
    zeroPrice: { ...CONTRACT, price: 0 },
    nanPrice: { ...CONTRACT, price: Number.NaN },
    stringPrice: { ...CONTRACT, price: '104' },
    noPosKey: { ...CONTRACT, posKey: '' },
    badExtremes: { ...CONTRACT, extremes: { high: 106 } },
    notAnObject: 'AAPL',
  };
  for (const [name, contract] of Object.entries(BAD)) {
    it(`${name}: nothing renders and nothing is requested`, async () => {
      seedAapl();
      await mount({ ...LEGACY_PROPS, asset: HELD_ASSET, wsPrice: 104, controlledQuote: contract });
      await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
      expect(header()).toBeNull();
      expect(document.body.querySelector('[data-test-drawer]')).toBeNull();
      expect(net.calls).toEqual([]);
    });
  }
});

describe('ON — scoped navigation admission for non-held research (§7.2 item 2)', () => {
  const NONHELD = { symbol: 'NFLX', name: 'Netflix', price: 600, percentChange: 1.2 };
  function seedNonHeld() {
    net.daily.NFLX = dailyHistory('2026-09-30', 595);
    net.daily.MSFT = dailyHistory('2026-09-30', 400);
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    net.quote.NFLX = { symbol: 'NFLX', price: 600, high: 605, low: 590, open: 596 };
    net.quote.MSFT = { symbol: 'MSFT', price: 405, high: 407, low: 399, open: 401, percentChange: 1.1 };
    net.quote.AAPL = { symbol: 'AAPL', price: 777 };
  }
  async function navigateTo(sym, name) {
    await act(async () => { document.body.querySelector('[data-test-tab="compete"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { tabs.navigate(sym, name); });
    await flush();
  }

  it('unheld → unheld stays legacy (admission says yes): the navigated name is price-filled as before', async () => {
    seedNonHeld();
    const asked = [];
    await mount({ ...LEGACY_PROPS, defaultTimeframe: '1D', asset: NONHELD, onNavigateAdmission: (s) => { asked.push(s); return true; } });
    await navigateTo('MSFT', 'Microsoft');
    expect(asked).toEqual(['MSFT']);
    expect(header()[0]).toBe('$405.00');
    expect(quoteCalls().map((c) => c[1])).toContain('MSFT');
  });

  it('unheld → HELD goes through the screen first (admission says no): no render and no request for the held name', async () => {
    seedNonHeld();
    const asked = [];
    await mount({ ...LEGACY_PROPS, defaultTimeframe: '1D', asset: NONHELD, onNavigateAdmission: (s) => { asked.push(s); return s !== 'AAPL'; } });
    const before = net.calls.length;
    await navigateTo('AAPL', 'Apple');
    expect(asked).toEqual(['AAPL']);
    expect(header()[0]).toBe('$600.00');
    expect(net.calls.slice(before).some((c) => c[1] === 'AAPL')).toBe(false);
  });

  it('back history asks too', async () => {
    seedNonHeld();
    const asked = [];
    let allowBack = true;
    await mount({ ...LEGACY_PROPS, defaultTimeframe: '1D', asset: NONHELD, onNavigateAdmission: (s) => { asked.push(s); return s === 'NFLX' ? allowBack : true; } });
    await navigateTo('MSFT', 'Microsoft');
    allowBack = false;
    const back = [...document.body.querySelectorAll('button')].find((b) => b.textContent === '←');
    await act(async () => { back.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flush();
    expect(asked).toEqual(['MSFT', 'NFLX']);
    expect(header()[0]).toBe('$405.00');
  });
});
