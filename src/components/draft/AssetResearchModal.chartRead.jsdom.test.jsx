// @vitest-environment jsdom
//
// THE CHART VIEW'S READ in the real modal (spec docs/specs/CHART_READ_SPEC_V1.md V1.1; the 18 Nov build §5 – §8 and the
// 19 Nov build CP-1 – CP-3): the real modal, the real StockChart and the real read (useChartRead → the client read), on
// the shell's browse mount. The network and the chart library are faked and recorded; GET /api/research/setup-read
// answers bodies made by the store's own evaluator (ChartRead/__fixtures__/chartReadRecords.js). CHART_READ_MODE, the
// shell's mode and the opening view (RESEARCH_MODAL_OPENING_VIEW, 'chart' as shipped) are mocked per row.
//
//   flag off            no request; no band, no checks, no pin, no chip, no primitive; today's adjusted candles; opens
//                       on Analysis (OV-5)
//   flag on             one request; the read's line and today so far (CP-3); the checks on the page under a pinned
//                       chart (CP-1, PG-1 – PG-10) with its two heights (PG-2); raw 1D candles with the live price last;
//                       the note; the Rule chip; the marks through the primitive; 1W; FX-4; the opening view (CP-2);
//                       a failed read; not admitted; crypto, an index and a fund (no slot, no request)


import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.hoisted(() => { process.env.TZ = 'UTC'; });
const FLAG = vi.hoisted(() => ({ sheet: 'on', bomb: 'on', read: 'on', open: 'chart' }));
const FLAGS = vi.hoisted(() => ({
  get RESEARCH_MODAL_SHEET_MODE() { return FLAG.sheet; },
  RESEARCH_MODAL_SHEET_MODES: Object.freeze(['off', 'allowlist', 'on']),
  get RESEARCH_MODAL_BOMB_MODE() { return FLAG.bomb; },
  RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']),
  get CHART_READ_MODE() { return FLAG.read; },
  CHART_READ_MODES: Object.freeze(['off', 'allowlist', 'on']),
  get RESEARCH_MODAL_OPENING_VIEW() { return FLAG.open; },
  RESEARCH_MODAL_OPENING_VIEWS: Object.freeze(['analysis', 'chart']),
}));
vi.mock('../../config/researchModalFlags', () => FLAGS);
vi.mock('../../config/researchModalFlags.js', () => FLAGS);

const net = vi.hoisted(() => ({ calls: [], daily: null, weekly: null, read: null, score: null }));
const rec = vi.hoisted(() => ({ series: [], prims: [], detached: [], technical: [] }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['history', symbol, timeframe, opts ?? null]);
    if (timeframe === '1d') return Promise.resolve(net.daily ?? []);
    if (timeframe === '1w') return net.weeklyGate ? net.weeklyGate.then(() => net.weekly ?? []) : Promise.resolve(net.weekly ?? []);
    return Promise.resolve([]);
  },
  getStockPrice: (symbol) => { net.calls.push(['quote', symbol]); return Promise.resolve({ symbol, price: 0 }); },
}));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: (s) => { net.calls.push(['profile', s]); return Promise.resolve({ Name: 'Constellation Energy', sector: 'Utilities', industry: 'Utilities', description: 'It makes power.', ratingText: 'Buy', analystConsensus: { totalAnalysts: 24 } }); } }));
vi.mock('../../services/volatilityService', () => ({ getVolatilityThresholds: () => Promise.resolve({}) }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../../utils/fetchWithAuth', () => ({
  fetchWithAuth: async (u) => {
    net.calls.push(['fetchWithAuth', String(u)]);
    if (String(u).startsWith('/api/research/setup-read')) return net.read();
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  },
}));
vi.mock('../../utils/fetchWithAuth.js', () => ({
  fetchWithAuth: async (u) => {
    net.calls.push(['fetchWithAuth', String(u)]);
    if (String(u).startsWith('/api/research/setup-read')) return net.read();
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  },
}));
vi.mock('lightweight-charts', () => {
  const series = (kind, opts) => {
    const s = {
      kind, opts, data: null, setData(d) { s.data = d; }, createPriceLine(o) { return o; }, removePriceLine() {}, setMarkers() {},
      priceScale() { return { applyOptions() {} }; }, applyOptions() {}, priceToCoordinate: (p) => 1000 - p,
      attachPrimitive(p) { rec.prims.push({ series: s, primitive: p }); p.attached({ chart: s.chart, series: s, requestUpdate() {} }); },
      detachPrimitive(p) { rec.detached.push(p); p.detached(); },
    };
    return s;
  };
  return {
    createChart: () => {
      const chart = {
        addSeries: (k, o) => { const s = series(k, o); s.chart = chart; rec.series.push(s); return s; }, removeSeries() {}, subscribeCrosshairMove() {},
        timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; }, timeToCoordinate: (t) => t / 1000, logicalToCoordinate: (l) => l * 8 }; },
        applyOptions() {}, remove() {},
      };
      return chart;
    },
    createSeriesMarkers: () => ({ setMarkers() {}, detach() {} }),
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
vi.mock('./CompeteTab', () => ({ default: () => <div data-stub="ranks" /> }));
vi.mock('./SectorTab', () => ({ default: () => <div data-stub="sector" /> }));
vi.mock('../Research/SmartMoneyTab', () => ({ default: () => <div data-stub="smartMoney" /> }));
vi.mock('../Research/TechnicalTabV2', () => ({ default: (p) => { rec.technical.push(p); return <div data-stub="technical" />; } }));
vi.mock('../Research/HoldingsTab', () => ({ default: () => <div data-stub="holdings" /> }));
vi.mock('../Research/SectorETFRanksTab', () => ({ default: () => null }));
vi.mock('../Research/MarketContextTab', () => ({ default: () => null }));
vi.mock('../Research/HealthTab', () => ({ default: () => <div data-stub="health" /> }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal()),
  doc: (_db, ...path) => ({ path: path.join('/') }),
  getDoc: (ref) => {
    net.calls.push(['getDoc', ref.path]);
    const data = ref.path === 'stockTechnicalScores/CEG' ? net.score : null;
    return Promise.resolve({ exists: () => data != null, data: () => data });
  },
}));

import { STATE_ROWS, bodyFor, previousFor } from '../Research/ChartRead/__fixtures__/chartReadRecords.js';
import { readLineOf } from '../Research/ChartRead/chartRead.js';
import { prepareChartData } from '../Research/chartUtils.js';
import { formatPrice } from '../Research/ChartRead/format.js';
import AssetResearchModal from './AssetResearchModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };

const NOW = '2026-11-18T18:44:00.000Z'; // Wed 1:44 PM ET: the read is Tuesday's
const SESSION = '2026-11-17';
const PRICE = 200.91; // the browse mount's live price
const B = {};
beforeAll(async () => {
  for (const s of ['VALID_PULLBACK', 'VALID_BREAKOUT', 'REGIME_B', 'NO_SETUP', 'EXTENDED', 'UNKNOWN_V', 'SPLIT', 'NO_ADJUSTMENT']) B[s] = await bodyFor(s, { session: SESSION, symbol: 'CEG' });
  B.ABSENT = { answer: 'absent', symbol: 'CEG', servedAt: Date.parse(NOW), sessionsTried: [SESSION, '2026-11-16'], read: null, previous: null };
  B.CHANGED = { ...B.VALID_PULLBACK, previous: await previousFor('REGIME_A', { session: '2026-11-16', symbol: 'CEG' }) };
});
/** The chart's daily rows (newest first): today's partial row, then the record's own raw rows, the older half split-adjusted. */
const dailyFor = (state) => {
  const rows = STATE_ROWS[state](SESSION).map((r, i) => ({ ...r, adjusted_close: i >= 10 ? Number((r.close * 0.5).toFixed(4)) : r.close }));
  return [{ date: '2026-11-18', open: rows[0].close, high: rows[0].close + 1.13, low: rows[0].close - 1.07, close: rows[0].close + 0.37, adjusted_close: rows[0].close + 0.37, volume: 400_000 }, ...rows];
};
const answer = (status, body) => () => ({ ok: status >= 200 && status < 300, status, json: async () => structuredClone(body) });

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date(NOW));
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  net.calls.length = 0; net.daily = dailyFor('VALID_PULLBACK'); net.weekly = null; net.weeklyGate = null; net.read = answer(200, B.VALID_PULLBACK); net.score = { factors: { sectorRSPercentile: 73 }, updatedAt: '2026-11-18T18:30:00.000Z' };
  for (const k of Object.keys(rec)) rec[k].length = 0;
  FLAG.sheet = 'on'; FLAG.bomb = 'on'; FLAG.read = 'on'; FLAG.open = 'chart';
  Element.prototype.scrollIntoView = vi.fn();
  try { localStorage.clear(); } catch { /* none */ }
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

const flush = async () => { for (let i = 0; i < 10; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };
const $ = (sel) => document.body.querySelector(sel);
const $$ = (sel) => [...document.body.querySelectorAll(sel)];
const click = async (el) => { expect(el).toBeTruthy(); await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); await flush(); };
const key = async (el, k) => { await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }); await flush(); };
const readCalls = () => net.calls.filter((c) => c[0] === 'fetchWithAuth' && c[1].startsWith('/api/research/setup-read'));
const candle = () => rec.series.filter((s) => s.kind === 'Candlestick').at(-1);
const prim = () => rec.prims.at(-1)?.primitive ?? null;
const scene = () => prim()?.scene ?? null;
const chartBtn = (t) => $$('[data-shell-scroll="chart"] button').find((b) => b.textContent.trim() === t);
const browse = async ({ symbol = 'CEG', name = 'Constellation Energy', price = PRICE } = {}) => {
  await act(async () => { root.render(<AssetResearchModal asset={{ symbol, name, price, percentChange: 0.6 }} onClose={() => {}} version={2} actionConfig={{ label: 'Add to Watchlist', onClick: () => {}, variant: 'primary' }} />); });
  await flush();
};
const toChart = async () => { await click($('[data-shell-pill="chart"]')); await flush(); };
const bandText = () => $('[data-chart-read-lead]')?.textContent ?? null;
// The read's line as the modal builds it: today (Wed 1:44 PM ET, the session open) and the header's printed price.
const CTX = { todayEt: '2026-11-18', todayIsSession: true, sessionOpened: true, headerPrice: PRICE.toFixed(2) };
// What the chart draws: the scene of the primitive attached to the CURRENT candle series (nothing to show detaches it; a
// rebuilt chart leaves the old one behind on the removed series).
const live = () => { const e = rec.prims.at(-1); return e && e.series === candle() && !rec.detached.includes(e.primitive) ? e.primitive : null; };
const drawn = () => live()?.scene.items.map((i) => i.n) ?? [];
const litNow = () => live()?.scene.items.filter((i) => i.lit).map((i) => i.n).sort() ?? [];
const plotH = () => $('[data-basis-note]').parentElement.style.height;
const candles = () => rec.series.filter((s) => s.kind === 'Candlestick').length;
/** Scroll the Chart view to `top`, the checks' top edge at `checksTop` and the pinned chart's lower edge at `pinBottom` (jsdom has no layout). */
const scrollView = async (top, { checksTop = 400, pinBottom = 284 } = {}) => {
  const view = $('[data-shell-scroll="chart"]');
  Object.defineProperty(view, 'scrollTop', { configurable: true, writable: true, value: top });
  const checks = $('[data-chart-read-checks]');
  const pin = $('[data-chart-pin]');
  if (checks) checks.getBoundingClientRect = () => ({ top: checksTop, bottom: checksTop + 600, left: 0, right: 390, width: 390, height: 600, x: 0, y: checksTop });
  if (pin) pin.getBoundingClientRect = () => ({ top: 0, bottom: pinBottom, left: 0, right: 390, width: 390, height: pinBottom, x: 0, y: 0 });
  await act(async () => { view.dispatchEvent(new Event('scroll')); });
  await flush();
};
const intoChecks = () => scrollView(260, { checksTop: 270, pinBottom: 284 });
// The header's price as the header prints it: the one leaf outside the views reading $d.dd.
const headerPrice = () => $$('span, div').filter((s) => s.children.length === 0 && /^\$\d+\.\d{2}$/.test(s.textContent.trim()) && !s.closest('[data-shell-scroll]')).map((s) => s.textContent.trim())[0] ?? null;

describe('flag off: the Chart view is today\'s, and no request is made', () => {
  it.each([['off'], ['yes'], [undefined]])('CHART_READ_MODE %s', async (mode) => {
    FLAG.read = mode;
    await browse();
    expect($('[data-shell-view]').dataset.shellView).toBe('analysis'); // OV-5: opens as today, whatever the opening view says
    await toChart();
    expect($('[data-shell-scroll="chart"]')).toBeTruthy();
    expect(readCalls()).toEqual([]);
    expect($('[data-chart-read]')).toBeNull();
    expect($('[data-chart-read-checks]')).toBeNull();
    expect($('[data-chart-pin]')).toBeNull(); // no wrapper: today's markup
    expect($('[data-chart-read-page]')).toBeNull();
    expect($('[data-rule-pill]')).toBeNull();
    expect($('[data-basis-note]')).toBeNull();
    expect(rec.prims).toEqual([]);
    // today's candles: the adjusted transform of the hook's rows, the older half halved
    expect(candle().data[0].close).toBeCloseTo(net.daily.at(-1).close * 0.5, 6);
    expect(candle().data.slice(0, -1)).toEqual(prepareChartData(net.daily).slice(0, -1)); // every closed bar as today
    expect(rec.technical.at(-1).levelsNote).toBeUndefined();
    expect(net.calls.some((c) => c[0] === 'getDoc')).toBe(false);
  });
});

describe('flag on: the read under the plot (§5)', () => {
  it('one request on the Chart view, none before it; the line, its date, its second line, today so far — and it opens nothing (PG-5)', async () => {
    FLAG.open = 'analysis';
    await browse();
    expect(readCalls()).toEqual([]); // the Analysis view opens first: nothing asked yet
    await toChart();
    expect(readCalls()).toEqual([['fetchWithAuth', '/api/research/setup-read?symbol=CEG']]);
    const line = readLineOf(B.VALID_PULLBACK, CTX);
    expect(bandText()).toBe(`${line.lead}${line.rest}`);
    expect(bandText()).toBe(`Pullback and Resume · present — touched its 20-day (${formatPrice(B.VALID_PULLBACK.read.facts.SMA_fast)}) and closed back above it.`);
    expect($('[data-chart-read-asof]').textContent).toBe('as of Tue Nov 17 close');
    expect($('[data-chart-read-second]').textContent).toBe('Volume isn’t part of this pattern; participation is unconfirmed.');
    // CP-3: today so far, which replaces RD-8's footnote (TD-4)
    expect($('[data-chart-read-today]').textContent).toBe(line.today);
    expect(line.today.startsWith(`Today so far: $${PRICE.toFixed(2)} — `)).toBe(true);
    expect($$('[data-chart-read-note]')).toEqual([]);
    // PG-5: the read is no longer a button; nothing says open or close
    expect($('[data-chart-read]').tagName).toBe('DIV');
    expect($('[data-chart-read]').hasAttribute('aria-haspopup')).toBe(false);
    expect(document.body.textContent).not.toMatch(/Open the checks|Close the checks/);
    expect($('[data-chart-read-change]')).toBeNull();
  });
  it('the order of the page: the chart, the read, the checks, the Technical content (§4 of the build)', async () => {
    await browse();
    await toChart();
    const view = $('[data-shell-scroll="chart"]');
    const order = [...view.querySelectorAll('[data-chart-pin], [data-chart-read], [data-chart-read-checks], [data-shell-technical]')].map((e) => (e.hasAttribute('data-chart-pin') ? 'chart' : e.hasAttribute('data-chart-read') ? 'read' : e.hasAttribute('data-chart-read-checks') ? 'checks' : 'technical'));
    expect(order).toEqual(['chart', 'read', 'checks', 'technical']);
    expect(rec.technical.at(-1).levelsNote).toBe('Support and resistance · its own calculation · not the rule’s 20-session high and low');
  });
  it('switching Analysis ↔ Chart asks nothing again', async () => {
    await browse();
    await toChart();
    await click($('[data-shell-pill="analysis"]'));
    await toChart();
    expect(readCalls()).toHaveLength(1);
    expect(bandText()).toContain('Pullback and Resume');
  });
  it.each(['VALID_BREAKOUT', 'REGIME_B', 'NO_SETUP', 'EXTENDED', 'UNKNOWN_V', 'SPLIT', 'ABSENT', 'NO_ADJUSTMENT', 'CHANGED'])('%s: its line, its second line, today so far, its notes; the checks only where it has them', async (k) => {
    net.read = answer(200, B[k]);
    await browse();
    await toChart();
    const line = readLineOf(B[k], CTX);
    expect(bandText()).toBe(`${line.lead ?? ''}${line.rest}`);
    expect($('[data-chart-read-second]')?.textContent ?? null).toBe(line.second);
    expect($('[data-chart-read-today]')?.textContent ?? null).toBe(line.today);
    expect($$('[data-chart-read-note]').map((n) => n.textContent)).toEqual(line.notes);
    expect($('[data-chart-read-change]')?.textContent ?? null).toBe(line.change);
    expect($('[data-chart-read]').tagName).toBe('DIV');
    expect($('[data-chart-read]').dataset.chartRead).toBe(line.state);
    expect(!!$('[data-chart-read-checks]')).toBe(line.hasChecks);
    // PG-7: a quiet state is one line — no checks, and the chart never pinned
    expect($('[data-chart-pin]').dataset.chartPin).toBe(line.hasChecks ? 'full' : 'none');
    if (k === 'CHANGED') expect(line.change).toBe('New since Mon: touched the 20-day and closed back above it.');
  });
});

describe('flag on: the candles and the marks (§4, §7)', () => {
  it('1D: raw candles, the live price last, "prices unadjusted" once; the marks 1, 4, 5, 6 through the primitive', async () => {
    await browse();
    await toChart();
    const data = candle().data;
    const raw = prepareChartData(net.daily, { basis: 'raw' });
    expect(data.slice(0, -1)).toEqual(raw.slice(0, -1));
    expect(data.at(-1).close).toBe(PRICE); // UC-4: the hook's live patch, drawn as it is
    expect($$('[data-basis-note]').map((n) => n.textContent)).toEqual(['prices unadjusted']);
    expect(scene().items.map((i) => i.n)).toEqual([1, 4, 5, 6]);
    const m1 = scene().items.find((i) => i.n === 1);
    expect(m1.value).toBe(B.VALID_PULLBACK.read.facts.SMA_fast);
    expect(new Date(m1.time * 1000).toISOString().slice(0, 10)).toBe(SESSION);
    expect($('[data-rule-pill]').dataset.rulePill).toBe('on');
  });
  it('the Rule chip hides and shows the marks (CR-5, MK-7)', async () => {
    await browse();
    await toChart();
    await click($('[data-rule-pill]'));
    expect($('[data-rule-pill]').dataset.rulePill).toBe('off');
    expect(rec.detached.length).toBeGreaterThan(0);
    await click($('[data-rule-pill]'));
    expect(scene().items.map((i) => i.n)).toEqual([1, 4, 5, 6]);
  });
  it('1W: the marks on their weeks; no basis note (the weekly bars are raw already)', async () => {
    net.weekly = [{ date: '2026-11-16', open: 199, high: 202, low: 197, close: 200.37, volume: 1 }, { date: '2026-11-09', open: 197, high: 200, low: 195, close: 198.1, volume: 1 }, { date: '2026-11-02', open: 195, high: 198, low: 193, close: 196.3, volume: 1 }, { date: '2026-10-26', open: 193, high: 196, low: 191, close: 194.4, volume: 1 }, { date: '2026-10-19', open: 191, high: 194, low: 189, close: 192.2, volume: 1 }];
    await browse();
    await toChart();
    await click(chartBtn('1W'));
    expect($('[data-basis-note]')).toBeNull();
    const days = scene().items.map((i) => [i.n, new Date(i.time * 1000).toISOString().slice(0, 10)]);
    expect(days).toEqual([[1, '2026-11-16'], [4, '2026-11-16'], [5, '2026-11-16'], [6, '2026-10-19']]);
    expect($('[data-rule-pill]')).toBeTruthy();
  });
  it('FX-4: on 1W with SMA on, marks 1 – 3 are not drawn and the checks\' head says why; SMA off or 1D brings them back', async () => {
    net.read = answer(200, B.REGIME_B); // marks 1, 2, 3 by default
    net.daily = dailyFor('REGIME_B');
    net.weekly = [{ date: '2026-11-16', open: 199, high: 202, low: 197, close: 200.37, volume: 1 }, { date: '2026-11-09', open: 197, high: 200, low: 195, close: 198.1, volume: 1 }, { date: '2026-11-02', open: 195, high: 198, low: 193, close: 196.3, volume: 1 }, { date: '2026-10-26', open: 193, high: 196, low: 191, close: 194.4, volume: 1 }, { date: '2026-10-19', open: 191, high: 194, low: 189, close: 192.2, volume: 1 }];
    await browse();
    await toChart();
    await click(chartBtn('1W'));
    expect(drawn()).toEqual([1, 2, 3]);
    expect($('[data-chart-read-weekly-note]')).toBeNull();
    await click(chartBtn('SMA'));
    expect(drawn()).toEqual([]);
    expect($('[data-chart-read-checks] [data-chart-read-weekly-note]').textContent).toBe('On 1W the drawn averages are weekly; marks 1 to 3 are on 1D.');
    // a row still lists its mark numbers; tapping it lights nothing 1 – 3 on this chart
    expect($('[data-check-row="fastAboveSlow"] [data-mark-number="2"]')).toBeTruthy();
    await click($('[data-check-row="fastAboveSlow"]'));
    expect(drawn().some((n) => n <= 3)).toBe(false);
    await click(chartBtn('SMA'));
    expect($('[data-chart-read-weekly-note]')).toBeNull();
    expect(drawn()).toEqual(expect.arrayContaining([1, 2, 3]));
    await click(chartBtn('SMA'));
    expect(drawn().some((n) => n <= 3)).toBe(false);
    await click(chartBtn('1D'));
    expect($('[data-chart-read-weekly-note]')).toBeNull();
    expect(drawn()).toEqual(expect.arrayContaining([1, 2, 3]));
  });
  it('review L2-1: while 1W loads (the daily series still in hand) nothing of the read is drawn — no marks on daily bars, no raw basis', async () => {
    let release;
    net.weekly = null;
    const weekly = [{ date: '2026-11-16', open: 199, high: 202, low: 197, close: 200.37, volume: 1 }, { date: '2026-11-09', open: 197, high: 200, low: 195, close: 198.1, volume: 1 }, { date: '2026-11-02', open: 195, high: 198, low: 193, close: 196.3, volume: 1 }, { date: '2026-10-26', open: 193, high: 196, low: 191, close: 194.4, volume: 1 }];
    net.weeklyGate = new Promise((r) => { release = r; });
    await browse();
    await toChart();
    expect(scene().items.length).toBeGreaterThan(0);
    await click(chartBtn('1W'));
    // the hook is on 1W but still holds the daily bars: the read draws nothing on them
    const onCandle = rec.prims.filter((p) => p.series === candle() && !rec.detached.includes(p.primitive));
    expect(onCandle.flatMap((p) => p.primitive.scene.items)).toEqual([]);
    expect($('[data-basis-note]')).toBeNull();
    net.weekly = weekly;
    await act(async () => { release(); });
    await flush();
    expect(rec.prims.filter((p) => p.series === candle()).flatMap((p) => p.primitive.scene.items).length).toBeGreaterThan(0);
  });
  it('review L2-6: with SMA on, mark 1 sits on the drawn 20-day at the record\'s day (the line drawn from the raw closes)', async () => {
    await browse();
    await toChart();
    await click(chartBtn('SMA'));
    const sma20 = rec.series.filter((s) => s.kind === 'Line').find((s) => s.opts?.color === '#00d9ff');
    const t = scene().items.find((i) => i.n === 1).time;
    const point = sma20.data.find((p) => p.time === t);
    expect(Math.abs(point.value - B.VALID_PULLBACK.read.facts.SMA_fast)).toBeLessThanOrEqual(0.005 + 1e-9);
  });
  it('PG-4 (review L2-3): a tapped check never follows the modal to another stock; its patterns collapse again; the height follows where the view is', async () => {
    net.read = answer(200, B.REGIME_B);
    await browse();
    await toChart();
    await click($('[data-check-group="patterns"]'));
    await click($('[data-check-row="slowRising"]'));
    expect(litNow()).toEqual([2, 3]);
    await intoChecks();
    expect($('[data-chart-pin]').dataset.chartPin).toBe('compact');
    await act(async () => { root.render(<AssetResearchModal asset={{ symbol: 'VST', name: 'Vistra', price: PRICE, percentChange: 0.2 }} onClose={() => {}} version={2} actionConfig={{ label: 'Add to Watchlist', onClick: () => {}, variant: 'primary' }} />); });
    await flush();
    await act(async () => { root.render(<AssetResearchModal asset={{ symbol: 'CEG', name: 'Constellation Energy', price: PRICE, percentChange: 0.6 }} onClose={() => {}} version={2} actionConfig={{ label: 'Add to Watchlist', onClick: () => {}, variant: 'primary' }} />); });
    await flush();
    if (!$('[data-shell-scroll="chart"]')) await toChart();
    expect(litNow()).toEqual([]);
    expect($('[data-check-row][aria-pressed="true"]')).toBeNull();
    expect($('[data-check-group="patterns"]')?.hasAttribute('data-collapsed')).toBe(true);
    // The view kept its place (scrolled into the checks): the new stock's checks land compact (review L2B-6); at the top, full.
    expect($('[data-chart-pin]').dataset.chartPin).toBe('compact');
    await scrollView(0);
    expect($('[data-chart-pin]').dataset.chartPin).toBe('full');
  });
  it('review L2-3 (mutant Y7): leaving the Chart view clears the tapped check; back on it no mark is lit and the chart is full height', async () => {
    await browse();
    await toChart();
    await click($('[data-check-row="touch"]'));
    expect(litNow()).toEqual([1, 4]);
    await intoChecks();
    await click($('[data-shell-pill="analysis"]'));
    await toChart();
    expect(litNow()).toEqual([]);
    expect(prim().priceAxisViews()).toEqual([]);
    expect($('[data-chart-pin]').dataset.chartPin).toBe('full');
  });
  it('a read that shows no checks: no chip, no marks; the 1D candles still unadjusted under it', async () => {
    net.read = answer(200, B.SPLIT);
    await browse();
    await toChart();
    expect($('[data-rule-pill]')).toBeNull();
    expect(rec.prims).toEqual([]);
    expect($('[data-basis-note]').textContent).toBe('prices unadjusted');
  });
});

describe('CP-1: the checks on the page (PG-1 – PG-10)', () => {
  it('in the order of §6, with their counts; the hint above them; no layer anywhere in the Chart view (PG-1, PG-5)', async () => {
    await browse();
    await toChart();
    expect($$('[data-check-group]').map((g) => g.dataset.checkGroup)).toEqual(['uptrend', 'pullback_resume', 'stretch', 'breakout', 'context']);
    expect($$('[data-check-count]').map((c) => c.textContent)).toEqual(['3 of 3', '2 of 2', 'not present']);
    expect($$('[data-chart-read-hint]').map((h) => h.textContent)).toEqual(['tap a check to light its mark']);
    // one hint on the whole page, by its words (mutant CHK-a)
    expect(document.body.textContent.split('tap a check to light its mark').length - 1).toBe(1);
    expect($$('[data-other-reading]').length).toBe(2);
    expect($('[data-chart-read-foot]')).toBeTruthy();
    const view = $('[data-shell-scroll="chart"]');
    expect(view.querySelector('[role="dialog"], [aria-modal]')).toBeNull();
    expect(view.querySelector('[data-chart-read-checks]').tagName).toBe('SECTION');
    expect(view.querySelector('[data-chart-read-checks]').getAttribute('aria-label')).toBe('The checks');
  });
  it('no focus trap and no Escape of its own: a key on the last row reaches the page as on any button (PG-1)', async () => {
    const heard = vi.fn();
    window.addEventListener('keydown', heard);
    try {
      await browse();
      await toChart();
      const rows = $$('[data-chart-read-checks] button');
      const last = rows.at(-1);
      last.focus();
      const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      await act(async () => { last.dispatchEvent(tab); });
      expect(tab.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(last); // nothing moved focus for it (jsdom does not tab natively)
      const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      await act(async () => { last.dispatchEvent(esc); });
      expect(heard).toHaveBeenCalledTimes(2); // both keys reached the window: nothing stopped them
      expect($('[data-chart-read-checks]')).toBeTruthy();
    } finally {
      window.removeEventListener('keydown', heard);
    }
  });
  it('PG-1: nothing gives way — the action row and the Technical content stay while the checks show', async () => {
    await browse();
    await toChart();
    expect($('[data-chart-read-checks]')).toBeTruthy();
    expect([...document.body.querySelectorAll('button')].some((b) => /Add to Watchlist/i.test(b.textContent))).toBe(true);
    expect($('[data-shell-technical]')).toBeTruthy();
  });
  it('PG-9: the sector rank is read once, when the checks render — not on a tap', async () => {
    await browse();
    await toChart();
    expect(net.calls.filter((c) => c[0] === 'getDoc').map((c) => c[1])).toEqual(['stockTechnicalScores/CEG']);
    expect($('[data-sector-rank]').textContent).toBe('73 of 100 within its sector · 20 sessions · 0 is weakest · read Wed 1:30 PM ET; may include today’s unfinished session');
    await click($('[data-check-row="touch"]'));
    await click($('[data-check-row="touch"]'));
    expect(net.calls.filter((c) => c[0] === 'getDoc')).toHaveLength(1);
  });
  it('PG-4: a tap lights the row\'s marks and scrolls nothing; a second tap clears them', async () => {
    await browse();
    await toChart();
    const view = $('[data-shell-scroll="chart"]');
    Object.defineProperty(view, 'scrollTop', { configurable: true, writable: true, value: 137 });
    await click($('[data-check-row="touch"]'));
    expect($('[data-check-row="touch"]').getAttribute('aria-pressed')).toBe('true');
    expect(litNow()).toEqual([1, 4]);
    expect(view.scrollTop).toBe(137);
    await click($('[data-check-row="touch"]'));
    expect($('[data-check-row="touch"]').getAttribute('aria-pressed')).toBe('false');
    expect(litNow()).toEqual([]);
  });
  it('PG-3: a tapped check\'s marks always show, lit — outside the default set, and with the Rule chip off', async () => {
    await browse();
    await toChart();
    expect(drawn()).toEqual([1, 4, 5, 6]);
    await click($('[data-check-row="slowRising"]')); // marks 2 and 3: not in valid · Pullback's default set
    expect(drawn()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(litNow()).toEqual([2, 3]);
    await click($('[data-rule-pill]'));
    expect($('[data-rule-pill]').dataset.rulePill).toBe('off');
    expect(drawn()).toEqual([2, 3]);
    await click($('[data-check-row="slowRising"]'));
    expect(drawn()).toEqual([]);
  });
  it('PG-6 (SH-3): when the uptrend fails the patterns collapse to one line; a tap expands them', async () => {
    net.read = answer(200, B.REGIME_B);
    await browse();
    await toChart();
    expect($$('[data-check-group]').map((g) => g.dataset.checkGroup)).toEqual(['uptrend', 'patterns', 'context']);
    expect($('[data-check-group="patterns"]').textContent).toContain('Entry patterns are read only in an uptrend.');
    await click($('[data-check-group="patterns"]'));
    expect($$('[data-check-group]').map((g) => g.dataset.checkGroup)).toEqual(['uptrend', 'pullback_resume', 'stretch', 'breakout', 'context']);
  });
  it('display agreement: mark 1\'s value, the lead\'s 20-day, the checks\' rows and the lit label print one string', async () => {
    await browse();
    await toChart();
    const sma = formatPrice(scene().items.find((i) => i.n === 1).value);
    expect(bandText()).toContain(`(${sma})`);
    for (const row of ['closeAboveFast', 'touch', 'pullbackClose']) expect($(`[data-check-row="${row}"]`).textContent).toContain(`${sma} 20-day`);
    expect(prim().priceAxisViews()).toEqual([]); // nothing lit yet
    await click($('[data-check-row="closeAboveFast"]'));
    expect(prim().priceAxisViews().map((v) => `$${v.text()}`)).toEqual([sma]);
  });
  it('L3-6: a row with no mark is not a button and carries no pressed state', async () => {
    await browse();
    await toChart();
    const row = $('[data-check-row="volumeFloor"]');
    expect(row.tagName).toBe('DIV');
    expect(row.hasAttribute('aria-pressed')).toBe(false);
  });
  it('PG-8: on the Battle chart the checks stay on the page; no mark but the one stub', async () => {
    // the shell's browse mount has no Battle pill: the Battle chart's read is the line model's own (chartRead.test.js)
    // and its marks chartProps' (the stub only); here, the checks render with any chart above them
    await browse();
    await toChart();
    expect($('[data-chart-read-checks]')).toBeTruthy();
  });
});

describe('the review of 19 Nov (lens 2 and lens 1): each row failed before its fix', () => {
  /** The view's height as the shell measures it (jsdom has no layout: 0 — "unmeasured" — unless set here). */
  const viewHeight = (h) => {
    const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.hasAttribute('data-shell-view') ? h : 0; } });
    return () => { if (desc) Object.defineProperty(HTMLElement.prototype, 'clientHeight', desc); else delete HTMLElement.prototype.clientHeight; };
  };
  it('L2B-3: on a short view (a phone on its side) the chart is not pinned and never compacts — the checks scroll into view with the page', async () => {
    const restore = viewHeight(300);
    try {
      await browse();
      await toChart();
      expect($('[data-chart-read-checks]')).toBeTruthy();
      expect($('[data-chart-pin]').dataset.chartPin).toBe('none');
      expect($('[data-chart-pin]').style.position).toBe('');
      await intoChecks();
      expect($('[data-chart-pin]').dataset.chartPin).toBe('none');
      expect($$('[data-chart-read-checks] button').map((b) => b.style.scrollMarginTop).filter((m) => m && m !== '0px')).toEqual([]);
    } finally {
      restore();
    }
  });
  it('L2B-3: a tall view pins as before (650 px: the compact chart and a page under it fit)', async () => {
    const restore = viewHeight(650);
    try {
      await browse();
      await toChart();
      expect($('[data-chart-pin]').dataset.chartPin).toBe('full');
      expect($('[data-chart-pin]').style.position).toBe('sticky');
    } finally {
      restore();
    }
  });
  it('L2B-2: while compact, the chart\'s own placeholder (here its error box) takes the compact height, never the full one', async () => {
    net.daily = []; // the daily request answers no bars: the chart's error box, while the read still lands with its checks
    await browse();
    await toChart();
    expect($('[data-shell-chart-state="error"]').style.height).toBe('284px'); // 240 + 44 at full height
    await intoChecks();
    expect($('[data-chart-pin]').dataset.chartPin).toBe('compact');
    expect($('[data-shell-chart-state="error"]').style.height).toBe('224px'); // 180 + 44
  });
  it('L2B-6: a read that lands after the player has scrolled into where its checks will be compacts at once — no full-height chart over the page', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    net.read = () => gate.then(() => answer(200, B.VALID_PULLBACK)());
    const proto = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function rect() {
      if (this.hasAttribute?.('data-chart-read-checks')) return { top: 120, bottom: 720, left: 0, right: 390, width: 390, height: 600, x: 0, y: 120 };
      if (this.hasAttribute?.('data-chart-pin')) return { top: 0, bottom: 284, left: 0, right: 390, width: 390, height: 284, x: 0, y: 0 };
      return proto.call(this);
    };
    try {
      await browse();
      await toChart();
      expect($('[data-chart-read-checks]')).toBeNull(); // still loading
      const view = $('[data-shell-scroll="chart"]');
      Object.defineProperty(view, 'scrollTop', { configurable: true, writable: true, value: 400 });
      await act(async () => { view.dispatchEvent(new Event('scroll')); });
      await act(async () => { release(); });
      await flush();
      expect($('[data-chart-read-checks]')).toBeTruthy();
      expect($('[data-chart-pin]').dataset.chartPin).toBe('compact');
    } finally {
      Element.prototype.getBoundingClientRect = proto;
    }
  });
  it('L1-6 (side note): while 1W loads (the daily bars still drawn) with SMA on, the weekly note does not show; it shows once the weeks land', async () => {
    let release;
    net.read = answer(200, B.REGIME_B);
    net.daily = dailyFor('REGIME_B');
    net.weekly = null;
    const weekly = [{ date: '2026-11-16', open: 199, high: 202, low: 197, close: 200.37, volume: 1 }, { date: '2026-11-09', open: 197, high: 200, low: 195, close: 198.1, volume: 1 }, { date: '2026-11-02', open: 195, high: 198, low: 193, close: 196.3, volume: 1 }, { date: '2026-10-26', open: 193, high: 196, low: 191, close: 194.4, volume: 1 }];
    net.weeklyGate = new Promise((r) => { release = r; });
    await browse();
    await toChart();
    await click(chartBtn('SMA'));
    await click(chartBtn('1W'));
    expect($('[data-chart-read-weekly-note]')).toBeNull(); // the daily bars and daily averages are still what is drawn
    net.weekly = weekly;
    await act(async () => { release(); });
    await flush();
    expect($('[data-chart-read-weekly-note]').textContent).toBe('On 1W the drawn averages are weekly; marks 1 to 3 are on 1D.');
  });
});

describe('PG-2: the chart pinned, two heights', () => {
  it('pinned at the top at the shell\'s height; compact once scrolled into the checks; full again at the top', async () => {
    await browse();
    await toChart();
    const pin = $('[data-chart-pin]');
    expect(pin.style.position).toBe('sticky');
    expect(pin.style.top).toBe('0px');
    expect(pin.dataset.chartPin).toBe('full');
    expect(plotH()).toBe('240px'); // jsdom's view is 0 px tall: the shell's 240 px floor
    await scrollView(40, { checksTop: 420, pinBottom: 284 }); // the read scrolls under the chart: not into the checks yet
    expect(pin.dataset.chartPin).toBe('full');
    await intoChecks();
    expect(pin.dataset.chartPin).toBe('compact');
    expect(plotH()).toBe('180px'); // a third of the view, never under 180 px
    await scrollView(120, { checksTop: 300, pinBottom: 224 });
    expect(pin.dataset.chartPin).toBe('compact'); // still in the page: stays compact
    await scrollView(0);
    expect(pin.dataset.chartPin).toBe('full');
    expect(plotH()).toBe('240px');
  });
  it('no scroll anchoring while the checks show (the browser would undo the change of height by moving to the top — measured in Edge); none added otherwise', async () => {
    await browse();
    await toChart();
    expect($('[data-shell-scroll="chart"]').style.overflowAnchor).toBe('none');
    act(() => root.unmount()); container.remove(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    net.read = answer(200, B.SPLIT);
    await browse();
    await toChart();
    expect($('[data-shell-scroll="chart"]').style.overflowAnchor).toBe('');
  });
  it('one change of height, not a resize per scroll frame: one rebuild into compact, none while it stays, one back', async () => {
    await browse();
    await toChart();
    const before = candles();
    await intoChecks();
    expect(candles()).toBe(before + 1);
    for (const top of [300, 420, 610, 333]) await scrollView(top, { checksTop: 100, pinBottom: 224 });
    expect(candles()).toBe(before + 1);
    await scrollView(0);
    expect(candles()).toBe(before + 2);
  });
  it('PG-3: compact draws every mark that exists; the Rule chip reads pressed and cannot turn them off; full again, the default set', async () => {
    await browse();
    await toChart();
    await click($('[data-rule-pill]'));
    expect($('[data-rule-pill]').getAttribute('aria-pressed')).toBe('false');
    await intoChecks();
    expect(drawn()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect($('[data-rule-pill]').getAttribute('aria-pressed')).toBe('true');
    expect($('[data-rule-pill]').disabled).toBe(true);
    await scrollView(0);
    expect($('[data-rule-pill]').getAttribute('aria-pressed')).toBe('false');
    expect($('[data-rule-pill]').disabled).toBe(false);
    expect(drawn()).toEqual([]);
  });
  it('PG-7: never compact in a quiet state — no pin, scrolling changes nothing', async () => {
    for (const k of ['UNKNOWN_V', 'SPLIT', 'ABSENT']) {
      net.read = answer(200, B[k]);
      await browse();
      await toChart();
      expect($('[data-chart-pin]').dataset.chartPin, k).toBe('none');
      expect($('[data-chart-pin]').style.position, k).toBe('');
      await scrollView(500, { checksTop: 0, pinBottom: 284 });
      expect($('[data-chart-pin]').dataset.chartPin, k).toBe('none');
      expect(plotH(), k).toBe('240px');
      act(() => root.unmount()); container.remove(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    }
  });
  it('focus order: a row Tab reaches is kept clear of the pinned chart (its scroll margin is the pinned height)', async () => {
    await browse();
    await toChart();
    const margins = () => [...new Set($$('[data-chart-read-checks] button').map((b) => b.style.scrollMarginTop))];
    expect(margins()).toEqual(['292px']); // 44 + 240 + 8
    await intoChecks();
    expect(margins()).toEqual(['232px']); // 44 + 180 + 8
  });
});

describe('CP-2: a stock opens on the Chart view (OV-1 – OV-5)', () => {
  it('OV-1 / OV-3: on the shell, with the read not off, a stock opens on Chart at 1D, its read asked at once', async () => {
    await browse();
    expect($('[data-shell-view]').dataset.shellView).toBe('chart');
    expect(net.calls.filter((c) => c[0] === 'history').map((c) => c[2])).toEqual(['1d']);
    expect(readCalls()).toHaveLength(1);
    expect($('[data-chart-read-checks]')).toBeTruthy();
  });
  it('OV-4: the one constant at \'analysis\' opens on Analysis', async () => {
    FLAG.open = 'analysis';
    await browse();
    expect($('[data-shell-view]').dataset.shellView).toBe('analysis');
    expect(readCalls()).toEqual([]);
  });
  it('OV-5: CHART_READ_MODE off opens on Analysis, whatever the constant says', async () => {
    FLAG.read = 'off';
    await browse();
    expect($('[data-shell-view]').dataset.shellView).toBe('analysis');
  });
  it('OV-2: a door that asks for 💣 by name still opens on 💣 (its 30-minute series, not 1D)', async () => {
    await act(async () => { root.render(<AssetResearchModal asset={{ symbol: 'CEG', name: 'Constellation Energy', price: PRICE, percentChange: 0.6 }} onClose={() => {}} version={2} bombContext={{ kind: 'bench' }} opensOnBomb />); });
    await flush();
    expect(net.calls.filter((c) => c[0] === 'history').map((c) => c[2])).toEqual(['30m', '1d']);
    expect($('[data-shell-view]').dataset.shellView).not.toBe('chart');
    expect(readCalls()).toEqual([]);
  });
  it('OV-2: crypto, an index and a sector fund are not in the shell and do not change', async () => {
    for (const [symbol, name] of [['BTC', 'Bitcoin'], ['SPY', 'S&P 500'], ['XLK', 'Technology Select Sector SPDR']]) {
      await browse({ symbol, name, price: 100 });
      expect($('[data-shell-view]'), symbol).toBeNull();
      expect(readCalls(), symbol).toEqual([]);
    }
  });
});

describe('CP-3: today so far, in the modal', () => {
  it('display agreement (TD-2): its price is the header\'s own string, and it follows the header (the live price moving)', async () => {
    const at = (wsPrice) => act(async () => { root.render(<AssetResearchModal asset={{ symbol: 'CEG', name: 'Constellation Energy', price: PRICE, percentChange: 0.6 }} wsPrice={wsPrice} onClose={() => {}} version={2} actionConfig={{ label: 'Add to Watchlist', onClick: () => {}, variant: 'primary' }} />); });
    await at(200.91);
    await flush();
    expect(headerPrice()).toBe('$200.91');
    expect($('[data-chart-read-today]').textContent.startsWith(`Today so far: ${headerPrice()} — `)).toBe(true);
    await at(207.13);
    await flush();
    expect(headerPrice()).toBe('$207.13');
    expect($('[data-chart-read-today]').textContent.startsWith('Today so far: $207.13 — ')).toBe(true);
    // the header's own rounding, never the raw live price: 207.135 prints as the header prints it
    await at(207.135);
    await flush();
    expect($('[data-chart-read-today]').textContent.startsWith(`Today so far: ${headerPrice()} — `)).toBe(true);
  });
  it('every mark it names carries the read\'s own printed price: at the 20-day exactly when the header prints the 20-day', async () => {
    const sma = formatPrice(B.VALID_PULLBACK.read.facts.SMA_fast);
    await browse({ price: Number(sma.slice(1)) });
    await toChart();
    expect(headerPrice()).toBe(sma);
    expect($('[data-chart-read-today]').textContent).toContain(' — at Tue’s 20-day (1),');
    expect($('[data-check-row="closeAboveFast"]').textContent).toContain(`${sma} 20-day`);
  });
  it('TD-1: before the open — no line, and RD-8\'s footnote is back', async () => {
    vi.setSystemTime(new Date('2026-11-18T14:00:00.000Z')); // Wed 9:00 AM ET
    await browse();
    await toChart();
    expect($('[data-chart-read-today]')).toBeNull();
    expect($$('[data-chart-read-note]').map((n) => n.textContent)).toEqual(['Tuesday’s close. Today’s session is read after it ends.']);
  });
  it('TD-1: on a Saturday — no line', async () => {
    vi.setSystemTime(new Date('2026-11-21T17:00:00.000Z'));
    await browse();
    await toChart();
    expect($('[data-chart-read-today]')).toBeNull();
  });
  it('TD-1: the header has no price — no line', async () => {
    await browse({ price: 0 });
    await toChart();
    expect($('[data-chart-read-today]')).toBeNull();
  });
});

describe('the review (lens 3) rows that still apply', () => {
  it.each([[401, 'Unauthorized'], [429, 'Too many requests'], [0, null]])("L3-2: 'allowlist' — a %s before admission is known shows nothing (no failed line to a player who may not be admitted)", async (status, error) => {
    FLAG.read = 'allowlist';
    net.read = status === 0 ? () => { throw new TypeError('Failed to fetch'); } : answer(status, { error });
    await browse();
    await toChart();
    expect(readCalls()).toHaveLength(1);
    expect($('[data-chart-read]')).toBeNull();
    expect($('[data-chart-pin]').dataset.chartPin).toBe('none');
  });
  it.each([[500], [503]])("L3-2: 'allowlist' — a %s comes after admission: the quiet failed line", async (status) => {
    FLAG.read = 'allowlist';
    net.read = answer(status, { error: 'x' });
    await browse();
    await toChart();
    expect($('[data-chart-read="failed"]')).toBeTruthy();
  });
  it("L3-2: 'on' — every player is admitted, so a 401 is a failed read", async () => {
    net.read = answer(401, { error: 'Unauthorized' });
    await browse();
    await toChart();
    expect($('[data-chart-read="failed"]')).toBeTruthy();
  });
});

describe('failures and where there is no slot (RD-11, RD-12)', () => {
  it('a failed read: only the quiet line and Try again; the candles stay today\'s; Try again asks once more', async () => {
    net.read = answer(500, { error: 'Could not read the record.' });
    await browse();
    await toChart();
    expect($('[data-chart-read="failed"]').textContent).toBe('Couldn’t load the setup check' + 'Try again');
    expect($('[data-chart-read-lead]')).toBeNull();
    expect($('[data-basis-note]')).toBeNull();
    expect(rec.prims).toEqual([]);
    net.read = answer(200, B.VALID_PULLBACK);
    await click($('[data-chart-read-retry]'));
    expect(readCalls()).toHaveLength(2);
    expect(bandText()).toContain('Pullback and Resume');
  });
  it.each([[429, 'rate_limited'], [503, 'calendar_missing']])('a %s is a failed read too', async (status, error) => {
    net.read = answer(status, { error });
    await browse();
    await toChart();
    expect($('[data-chart-read="failed"]')).toBeTruthy();
  });
  it.each([[404, 'chart_read_unavailable'], [400, 'invalid_symbol']])('a %s (not admitted / not a ranked stock): no slot at all, today\'s candles', async (status, error) => {
    net.read = answer(status, { error });
    await browse();
    await toChart();
    expect(readCalls()).toHaveLength(1);
    expect($('[data-chart-read]')).toBeNull();
    expect($('[data-basis-note]')).toBeNull();
    expect(rec.technical.at(-1).levelsNote).toBeUndefined();
  });
  it.each([['BTC', 'Bitcoin'], ['SPY', 'S&P 500'], ['XLK', 'Technology Select Sector SPDR']])('%s: no slot, no request (crypto, an index, a fund)', async (symbol, name) => {
    await browse({ symbol, name, price: 100 });
    if ($('[data-shell-pill="chart"]')) await toChart();
    expect(readCalls()).toEqual([]);
    expect($('[data-chart-read]')).toBeNull();
  });
});
