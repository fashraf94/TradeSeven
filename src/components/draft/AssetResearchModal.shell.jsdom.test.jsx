// @vitest-environment jsdom
//
// THE TWO-VIEW SHELL in the real modal (Amendment C; spec
// docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-1–SB-14): the gate per mount,
// the header control, the three views and their state machine, the Analysis
// view's blocks in battle and in browse, the tab strip with today's components,
// What's moving loaded on a tap, the Chart view, the 💣 view and the action row.
// Build C's own content rows live in AssetResearchModal.sheetModeOn.jsdom.test.jsx;
// the mode-off goldens hold 'off' byte for byte.
//
// Network and chart library faked and recorded; Ranks / Smart Money / Sector are
// recorded stand-ins (today's components, mounted with today's props — their own
// files test their content); RESEARCH_MODAL_SHEET_MODE is mocked per row.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => { process.env.TZ = 'UTC'; });
const FLAG = vi.hoisted(() => ({ sheet: 'on', bomb: 'on' }));
const FLAGS = vi.hoisted(() => ({
  get RESEARCH_MODAL_SHEET_MODE() { return FLAG.sheet; },
  RESEARCH_MODAL_SHEET_MODES: Object.freeze(['off', 'allowlist', 'on']),
  get RESEARCH_MODAL_BOMB_MODE() { return FLAG.bomb; },
  RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']),
}));
vi.mock('../../config/researchModalFlags', () => FLAGS);
vi.mock('../../config/researchModalFlags.js', () => FLAGS);

const net = vi.hoisted(() => ({ calls: [], why: [], daily: null }));
const rec = vi.hoisted(() => ({ series: [], lines: [], markers: [], tabs: [], technical: [] }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['history', symbol, timeframe, opts ?? null]);
    if (timeframe === '1d' || timeframe === '1w') return Promise.resolve(net.daily ?? [
      { date: '2026-10-14', open: 101, high: 104.1, low: 100.6, close: 103.2, volume: 1 },
      { date: '2026-10-13', open: 99.4, high: 101.2, low: 99, close: 100.9, volume: 1 },
      { date: '2026-10-12', open: 98.8, high: 99.9, low: 98.1, close: 99.3, volume: 1 },
    ]);
    return Promise.resolve([]);
  },
  getStockPrice: (symbol) => { net.calls.push(['quote', symbol]); return Promise.resolve({ symbol, price: 0 }); },
}));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: (s) => { net.calls.push(['profile', s]); return Promise.resolve({ Name: s === 'CEG' ? 'Constellation Energy' : 'Apple Inc', sector: 'Technology', industry: 'Consumer Electronics', description: 'It makes things.', ratingText: 'Buy', analystConsensus: { totalAnalysts: 24 } }); } }));
vi.mock('../../services/volatilityService', () => ({ getVolatilityThresholds: () => { net.calls.push(['thresholds']); return Promise.resolve({}); } }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
const WHY = { catalyst: 'Apple rose on strong iPhone demand.', catalystType: 'news', signals: [{ type: 'bullish', label: 'Volume', detail: 'twice the average' }], peerContext: 'Peers rose too.', outlook: 'Watch the earnings date.', citations: ['https://www.reuters.com/a'], timestamp: '2026-10-14T17:00:00.000Z' };
vi.mock('../../utils/fetchWithAuth', () => ({
  fetchWithAuth: async (u, o) => {
    net.calls.push(['fetchWithAuth', String(u), o?.method ?? null]);
    if (String(u) === '/api/why-moving') { net.why.push(JSON.parse(o.body)); return { ok: true, status: 200, json: async () => ({ success: true, data: WHY }) }; }
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  },
}));
vi.mock('lightweight-charts', () => {
  const series = (kind, opts) => ({
    setData() {}, createPriceLine(o) { rec.lines.push(o); return o; }, removePriceLine() {}, setMarkers() {},
    priceScale() { return { applyOptions() {} }; }, applyOptions() {}, kind, opts,
  });
  return {
    createChart: () => ({ addSeries: (k, o) => { rec.series.push([k, o ?? null]); return series(k, o); }, removeSeries() {}, subscribeCrosshairMove() {}, timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; } }; }, applyOptions() {}, remove() {} }),
    createSeriesMarkers: (s, m) => { rec.markers.push(m); return { setMarkers(x) { rec.markers.push(x); }, detach() {} }; },
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
// Today's tabs, as recorded stand-ins: which mounted, with which props.
vi.mock('./CompeteTab', () => ({ default: (p) => { rec.tabs.push(['ranks', p]); return <div data-stub="ranks"><button type="button" data-nav-etf onClick={() => p.onNavigateToStock('XLK', 'Technology Select Sector SPDR')}>nav</button></div>; } }));
vi.mock('./SectorTab', () => ({ default: (p) => { rec.tabs.push(['sector', p]); return <div data-stub="sector" />; } }));
vi.mock('../Research/SmartMoneyTab', () => ({ default: (p) => { rec.tabs.push(['smartMoney', p]); return <div data-stub="smartMoney" />; } }));
vi.mock('../Research/TechnicalTabV2', () => ({ default: (p) => { rec.technical.push(p); return <div data-stub="technical" />; } }));
vi.mock('../Research/HoldingsTab', () => ({ default: () => <div data-stub="holdings" /> }));
vi.mock('../Research/SectorETFRanksTab', () => ({ default: () => null }));
vi.mock('../Research/MarketContextTab', () => ({ default: () => null }));
vi.mock('../Research/HealthTab', () => ({ default: () => <div data-stub="health" /> }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal()),
  doc: (_db, ...path) => ({ path: path.join('/') }),
  getDoc: (ref) => { net.calls.push(['getDoc', ref.path]); return Promise.resolve({ exists: () => false, data: () => null }); },
}));

import { measuredSheetBattle, SHEET_NOW, RANKINGS } from '../Research/Sheet/__fixtures__/sheetBattles.js';
import { selectBombRecord } from '../Research/BombMode/selectBombRecord.js';
import { enrichHeldPosition } from '../../screens/AgentBattleScreen.jsx';
import { buildResearchAsset } from '../../utils/researchAssetBuilder.js';
import ChartHeader from '../Research/ChartHeader';
import AssetResearchModal from './AssetResearchModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
let BATTLE;
const oldKey = process.env.EODHD_API_KEY;
beforeAll(async () => { BATTLE = await measuredSheetBattle({ archetype: 'momentum_chaser' }); process.env.EODHD_API_KEY = 'isolated-key'; });
afterAll(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; });

let container, root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date(SHEET_NOW));
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  net.calls.length = 0; net.why.length = 0; net.daily = null;
  for (const k of Object.keys(rec)) rec[k].length = 0;
  FLAG.sheet = 'on'; FLAG.bomb = 'on';
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };
const $ = (sel) => document.body.querySelector(sel);
const $$ = (sel) => [...document.body.querySelectorAll(sel)];
const click = async (el) => { expect(el).toBeTruthy(); await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); await flush(); };
const view = () => $('[data-shell-view]')?.dataset.shellView ?? null;
const pill = (v) => $(`[data-shell-pill="${v}"]`);
const pills = () => $$('[data-shell-pill]').map((b) => b.dataset.shellPill);
const blocks = () => $$('[data-shell-block]').map((b) => b.dataset.shellBlock);
const history = () => net.calls.filter((c) => c[0] === 'history').map((c) => c[2]);
const remount = () => { act(() => root.unmount()); container.remove(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); };

const heldAsset = () => buildResearchAsset(enrichHeldPosition(BATTLE.portfolio.star[0], 'star', { stockBattle: BATTLE, stockSide: 'agent', stockSlot: 0 }), { livePrices: { AAPL: 103.2 }, thresholds: { AAPL: { threshold: 2.5 } }, startingPrices: { AAPL: 100.75 }, useDefaultThreshold: true });
const ctx = (over = {}) => ({ battleId: 'stock-battle', agentId: 'agent', archetype: 'momentum_chaser', agentName: 'Juno', row: { held: false, positionId: 'position-agent' }, battle: BATTLE, calls: [], rankings: RANKINGS, standing: { player: 62, opponent: 68, digits: 0 }, directive: BATTLE.directive, ...over });
const bombCtx = () => ({ kind: 'agent', battleId: 'stock-battle', held: true, record: selectBombRecord(BATTLE, 'AAPL', SHEET_NOW) });
const battle = async (over = {}) => {
  await act(async () => { root.render(<AssetResearchModal asset={heldAsset()} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={103.2} sheetContext={ctx()} bombContext={bombCtx()} {...over} />); });
  await flush();
};
const WATCH = vi.fn();
const browse = async ({ symbol = 'CEG', name = 'Constellation Energy', price = 344.15, ...over } = {}) => {
  await act(async () => { root.render(<AssetResearchModal asset={{ symbol, name, price, percentChange: 0.6 }} onClose={() => {}} version={2} actionConfig={{ label: 'Add to Watchlist', onClick: WATCH, variant: 'primary' }} {...over} />); });
  await flush();
};

describe('SB-2 — every v2 mount resolves the shell through sheetModeOn, on its displayed asset', () => {
  it("browse: 'off' and 'allowlist' are today's modal (the drawer, the Why? door); 'on' is the shell with two pills", async () => {
    for (const mode of ['off', 'allowlist']) {
      FLAG.sheet = mode;
      await browse();
      expect($('[data-shell-view]')).toBeNull();
      expect($('[data-drawer-root]')).toBeTruthy();
      expect($$('button').some((b) => b.textContent === 'Why?')).toBe(true);
      remount();
    }
    FLAG.sheet = 'on';
    await browse();
    expect(view()).toBe('analysis');
    expect($('[data-drawer-root]')).toBeNull();
    expect(pills()).toEqual(['analysis', 'chart']);
  });
  it("an agent battle mount whose gate resolved on (it hands sheetContext) is the shell at 'allowlist' too; at 'off' it is today's", async () => {
    FLAG.sheet = 'allowlist';
    await battle();
    expect(view()).toBe('analysis');
    expect($('[data-sheet-root]')).toBeTruthy();
    remount();
    FLAG.sheet = 'off';
    await battle();
    expect($('[data-shell-view]')).toBeNull();
    expect($('[data-drawer-root]')).toBeTruthy();
  });
  it("R-35: a crypto with a sheetContext at 'on' renders exactly as a crypto at 'off' with none — today's layout, byte for byte", async () => {
    const crypto = { symbol: 'BTC-USD', name: 'Bitcoin', price: 67000, isCrypto: true };
    const html = async (mode, sheetContext) => {
      FLAG.sheet = mode;
      await act(async () => { root.render(<AssetResearchModal asset={crypto} onClose={() => {}} showActionButton={false} isGameContext version={2} {...(sheetContext ? { sheetContext } : {})} />); });
      await flush();
      const out = document.body.innerHTML.replace(/_r_\w+_/g, '_r_');
      remount();
      return out;
    };
    const off = await html('off', null);
    const on = await html('on', ctx({ row: { held: false } }));
    if (on !== off) { let i = 0; while (on[i] === off[i]) i++; process.stderr.write(`DIFF@${i} OFF ${JSON.stringify(off.slice(Math.max(0, i - 150), i + 150))}\nON  ${JSON.stringify(on.slice(Math.max(0, i - 150), i + 150))}\n`); }
    expect(on).toBe(off);
    expect(on).not.toContain('data-shell-view');
  });
  it.each([['an index', 'SPY', 'SPDR S&P 500'], ['a sector ETF', 'XLK', 'Technology Select Sector SPDR']])("R-35: %s keeps today's layout at 'on'", async (_, symbol, name) => {
    FLAG.sheet = 'on';
    await browse({ symbol, name, price: 500 });
    expect($('[data-shell-view]')).toBeNull();
    expect($('[data-drawer-root]')).toBeTruthy();
  });
  it("internal navigation: a stock → a sector ETF is today's layout → back to the stock is the shell again", async () => {
    await browse();
    await click($('[data-shell-tab="ranks"]'));
    await click($('[data-nav-etf]'));
    expect($('[data-shell-view]')).toBeNull();
    expect($('[data-drawer-root]')).toBeTruthy();
    const back = $$('button').find((b) => b.textContent === '←');
    await click(back);
    expect(view()).toBe('analysis');
    expect($('[data-drawer-root]')).toBeNull();
  });
});

describe('SB-3 — the header control (H1): filled pills of equal width; no Why? door', () => {
  it('three pills in battle, two in browse; equal width; the active one filled (aria-selected)', async () => {
    await battle();
    expect(pills()).toEqual(['analysis', 'chart', 'bomb']);
    expect($$('[data-shell-pill]').map((b) => b.style.flex)).toEqual(['1 1 0%', '1 1 0%', '1 1 0%']);
    expect($$('[data-shell-pill]').map((b) => b.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(pill('analysis').style.background).not.toBe('transparent');
    expect(pill('chart').style.background).toBe('transparent');
    expect(pill('bomb').getAttribute('aria-label')).toBe('Bomb mode');
    remount();
    await browse();
    expect(pills()).toEqual(['analysis', 'chart']);
  });
  it('the Why? door is gone under the shell (What\'s moving is the first tab)', async () => {
    await battle();
    expect($$('button').some((b) => b.textContent === 'Why?')).toBe(false);
    expect($('[data-shell-tab]').dataset.shellTab).toBe('moving');
  });
  it('the 💣 pill warms only while the view model is in a zone (the red zone here), and never while it is the active pill', async () => {
    await battle({ wsPrice: 103.2 });
    expect(view()).toBe('analysis');
    expect(pill('bomb').dataset.shellPillWarm).toBe('0');
    await battle({ wsPrice: 103.4 }); // 0.36 % to +30: inside the band, after open (FQ-9 decided Analysis at open)
    expect(view()).toBe('analysis');
    expect(pill('bomb').dataset.shellPillWarm).toBe('1');
    expect(pill('bomb').style.background).toContain('color-mix');
    await click(pill('bomb'));
    expect(pill('bomb').dataset.shellPillWarm).toBe('0');
    await click(pill('analysis'));
    expect(pill('bomb').dataset.shellPillWarm).toBe('1');
    await battle({ wsPrice: 102.5 }); // 1.2 % to +30: past the 0.75 % exit band
    expect(pill('bomb').dataset.shellPillWarm).toBe('0');
  });
  it("off the shell, ChartHeader renders today's header: the same markup with no shell prop and with shell={null}, its Why? door included", () => {
    const props = { asset: { symbol: 'AAPL', name: 'Apple Inc', price: 103.2, percentChange: 1.2 }, onClose() {}, onWhyMoving() {} };
    const today = renderToStaticMarkup(<ChartHeader {...props} />);
    expect(renderToStaticMarkup(<ChartHeader {...props} shell={null} />)).toBe(today);
    expect(today).toContain('Why?');
    expect(today).not.toContain('data-shell');
  });
});

describe('SB-4 — three views, one at a time; the state machine', () => {
  it('opens on Analysis — no chart created, no drawer — in battle and in browse', async () => {
    await battle();
    expect(view()).toBe('analysis');
    expect(rec.series).toEqual([]);
    remount();
    await browse();
    expect(view()).toBe('analysis');
    expect(rec.series).toEqual([]);
  });
  it("FQ-9: a measured held stock inside the band at open opens on 💣 (its own rows: the sheet-on file)", async () => {
    await battle({ wsPrice: 103.4 });
    expect(view()).toBe('bomb');
    expect(history()).toContain('30m');
  });
  it("💣 sets the timeframe 'bomb'; leaving it restores the Chart view's LAST timeframe — 1W here, never a default 1D", async () => {
    await battle();
    await click(pill('chart'));
    const w = () => $$('[data-shell-scroll="chart"] button').find((b) => b.textContent.trim() === '1W');
    await click(w());
    expect(history()).toContain('1w');
    expect(history()).not.toContain('30m');
    await click(pill('bomb'));
    expect(view()).toBe('bomb');
    expect(history()).toContain('30m');
    await click(pill('chart'));
    expect(view()).toBe('chart');
    // The 1W pill is the active one: its style is StockChart's active style.
    expect(w().style.background).toBe($$('[data-shell-scroll="chart"] button').find((b) => b.textContent.trim() === '1W').style.background);
    expect(w().style.background).not.toBe($$('[data-shell-scroll="chart"] button').find((b) => b.textContent.trim() === '1D').style.background);
    // 💣 → Analysis restores it too (the chart, met again, is still on 1W).
    await click(pill('bomb'));
    await click(pill('analysis'));
    await click(pill('chart'));
    expect(w().style.background).not.toBe($$('[data-shell-scroll="chart"] button').find((b) => b.textContent.trim() === '1D').style.background);
  });
  it('no refetch on a view switch: Analysis ↔ Chart asks the hook for nothing it holds, and the Analysis tab keeps what it loaded', async () => {
    await battle();
    await click($('[data-shell-moving-ask]'));
    expect(net.why).toHaveLength(1);
    await click(pill('chart'));
    const before = history().length;
    await click(pill('analysis'));
    await click(pill('chart'));
    await click(pill('analysis'));
    expect(history().length).toBe(before);
    // What's moving survived the switches: still loaded, no second provider call.
    expect($('[data-shell-moving]').dataset.shellMoving).toBe('success');
    expect(net.why).toHaveLength(1);
  });
});

describe('SB-5, SB-6 — the Analysis view: an ordered list of blocks (R-34)', () => {
  it('in battle: the holding line, What it decided, the questions, the Wall St · About line, the tabs — in that order', async () => {
    await battle();
    expect(blocks()).toEqual(['stance', 'decided', 'questions', 'wallSt', 'tabs']);
    expect($('[data-shell-analysis]').dataset.shellAnalysis).toBe('battle');
    expect($('[data-shell-wallst]').textContent).toBe('Wall St Buy · 24 analysts');
  });
  it('in browse: the folded preset questions, the Wall St · About line, the tabs; the five questions only once the row is opened (SQ-3)', async () => {
    await browse();
    expect(blocks()).toEqual(['browseAsk', 'wallSt', 'tabs']);
    expect($('[data-shell-analysis]').dataset.shellAnalysis).toBe('browse');
    expect($('[data-sheet-root]')).toBeNull();
    expect(document.body.textContent).toContain('Ask about this stock');
    expect(document.body.textContent).not.toContain('What does this company do?');
    await click($('[data-shell-browse-ask] button'));
    expect($('[data-shell-browse-ask]').dataset.shellBrowseAsk).toBe('open');
    expect(document.body.textContent).toContain('What does this company do?');
    expect(net.calls.some((c) => c[1] === '/api/ai-advisor')).toBe(false);
  });
  it('a battle mount whose sheet has no model yet: the browse blocks WITHOUT the preset questions (BC-1: nothing answers for the agent)', async () => {
    await battle({ sheetContext: ctx({ battle: null }) });
    expect(blocks()).toEqual(['wallSt', 'tabs']);
    expect(document.body.textContent).not.toContain('Ask about this stock');
  });
  it('About {name} opens the profile inline', async () => {
    await browse();
    await click($('[data-sheet-about]'));
    expect($('[data-sheet-about-body]').textContent).toContain('It makes things.');
  });
});

describe("SB-7 — the tab strip: today's components, today's props; sticky, no scroll listener", () => {
  it("What's moving · Ranks · Smart Money · Sector; only the shown tab is mounted, each with today's props (+ Ranks' one label prop)", async () => {
    await battle();
    expect($$('[data-shell-tab]').map((b) => b.dataset.shellTab)).toEqual(['moving', 'ranks', 'smartMoney', 'sector']);
    expect(rec.tabs).toEqual([]);
    await click($('[data-shell-tab="ranks"]'));
    const [kind, p] = rec.tabs.at(-1);
    expect(kind).toBe('ranks');
    expect(Object.keys(p).sort()).toEqual(['isMobile', 'onNavigateToStock', 'rankLabel', 'symbol']);
    expect([p.symbol, p.rankLabel, typeof p.onNavigateToStock]).toEqual(['AAPL', true, 'function']);
    await click($('[data-shell-tab="smartMoney"]'));
    expect(rec.tabs.at(-1)[0]).toBe('smartMoney');
    expect(Object.keys(rec.tabs.at(-1)[1]).sort()).toEqual(['isMobile', 'symbol']);
    expect($('[data-stub="ranks"]')).toBeNull();
    await click($('[data-shell-tab="sector"]'));
    expect(rec.tabs.at(-1)[0]).toBe('sector');
    expect(Object.keys(rec.tabs.at(-1)[1]).sort()).toEqual(['isMobile', 'onNavigateToStock', 'symbol']);
  });
  it('the strip sticks under the header inside the view\'s own scroll box (position: sticky, top 0) — no scroll listener', async () => {
    const added = [];
    const real = EventTarget.prototype.addEventListener;
    vi.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(function spyAdd(type, ...rest) { added.push(type); return real.call(this, type, ...rest); });
    await battle();
    await click($('[data-shell-tab="smartMoney"]'));
    const strip = $('[data-shell-strip]');
    expect([strip.style.position, strip.style.top]).toEqual(['sticky', '0px']);
    expect(strip.closest('[data-shell-scroll]').dataset.shellScroll).toBe('analysis');
    expect(strip.closest('[data-shell-scroll]').style.overflowY).toBe('auto');
    expect(added).not.toContain('scroll');
  });
});

describe("What's moving — the Why? popup's content inline, loaded on a tap, never on open", () => {
  it('opening the modal sends no explanation request (no provider call); a tap sends ONE, with the popup\'s own body; the foot names whose view it is not', async () => {
    await battle();
    expect(net.why).toEqual([]);
    expect(net.calls.filter((c) => c[0] === 'fetchWithAuth')).toEqual([]);
    expect($('[data-shell-moving]').dataset.shellMoving).toBe('unasked');
    expect($('[data-shell-moving] h3').textContent).toMatch(/^Why is .+ [+-]\d+\.\d%\?$/);
    await click($('[data-shell-moving-ask]'));
    expect(net.why).toHaveLength(1);
    // The popup's own body (the held asset carries no name here, so JSON drops it, as the popup's would).
    expect(Object.keys(net.why[0]).sort()).toEqual(['change', 'close', 'high', 'low', 'open', 'price', 'symbol']);
    // `price` is the asset's own (currentAsset.price), exactly the popup's expression — not the live tick.
    expect([net.why[0].symbol, net.why[0].price]).toEqual(['AAPL', heldAsset().price]);
    expect(document.body.textContent).toContain('Apple rose on strong iPhone demand.');
    expect(document.body.textContent).toContain('reuters.com');
    expect($('[data-shell-moving-foot]').textContent).toBe('From the wire and the day’s bar · not Juno’s view');
  });
  it('in browse no partner speaks: the foot names no one', async () => {
    await browse();
    expect($('[data-shell-moving-foot]').textContent).toBe('From the wire and the day’s bar');
    expect(net.why).toEqual([]);
  });
});

describe('SB-8 — the Chart view: the full-canvas chart with its trend lines and pins, the Technical content below', () => {
  // 60 trading days rising in waves: swing highs and lows the trend-line detector joins.
  const WAVES = Array.from({ length: 60 }, (_, i) => {
    const c = 100 + i * 0.3 + 4 * Math.sin(i / 3);
    const d = new Date(Date.UTC(2026, 7, 3) + i * 86400000).toISOString().slice(0, 10);
    return { date: d, open: c - 0.4, high: c + 1, low: c - 1, close: c, volume: 1000 };
  }).reverse();
  it('the candles, the automatic trend lines, the record\'s pins; today\'s Technical tab below with onLevelHighlight wired', async () => {
    net.daily = WAVES;
    await battle();
    await click(pill('chart'));
    expect(view()).toBe('chart');
    expect(rec.series.map((s) => s[0])).toContain('Candlestick');
    const trend = rec.series.filter(([k, o]) => k === 'Line' && /rgba\((100, 180, 255|180, 120, 255), 0\.6\)/.test(o?.color ?? ''));
    expect(trend.length).toBeGreaterThan(0);
    expect(rec.markers.length).toBeGreaterThan(0);
    const t = rec.technical.at(-1);
    expect(Object.keys(t).sort()).toEqual(['asset', 'dailyData', 'indicators', 'levels', 'onLevelHighlight', 'sessionDate']);
    expect(typeof t.onLevelHighlight).toBe('function');
    // The Technical content sits below the chart in the SAME scroll box.
    expect($('[data-stub="technical"]').closest('[data-shell-scroll]').dataset.shellScroll).toBe('chart');
    // A level tapped there still lights on the chart above.
    rec.lines.length = 0;
    await act(async () => { t.onLevelHighlight({ price: 101.5, type: 'support' }); });
    await flush();
    expect(rec.lines.some((l) => l.price === 101.5)).toBe(true);
  });
  it('no stop price anywhere in the Chart view — every text it shows (header, chart, Technical, action row), and every line the chart draws — with each pinned item opened', async () => {
    await battle();
    const STOP = /\b(stop|stop-loss|stoploss)\b/i;
    // Text node by text node: textContent glues neighbours ("Idea" + "Stop $157.90" → "IdeaStop …"),
    // which hides a leading word boundary. The hidden Analysis view is not part of the Chart view.
    const shown = () => ['[data-shell-header]', '[data-shell-scroll="chart"]', '[data-sheet-actions]'].flatMap((sel) => {
      const el = $(sel);
      const out = [];
      if (!el) return out;
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const t = w.currentNode.nodeValue.trim(); if (t) out.push(t); }
      return out;
    });
    const stops = () => shown().filter((t) => STOP.test(t));
    let checked = 0;
    for (const q of ['catch_up', 'protect_lead', 'better_than_stalled']) {
      if (view() !== 'analysis') await click(pill('analysis'));
      await click($(`[data-sheet-question="${q}"]`));
      for (let i = 0; i < $$('[data-pack-see]').length; i++) {
        if (view() !== 'analysis') await click(pill('analysis'));
        await click($$('[data-pack-see]')[i]);
        expect(view()).toBe('chart');
        expect(shown().length).toBeGreaterThan(5);
        expect(stops()).toEqual([]);
        checked += 1;
      }
      await click(pill('analysis'));
      await click($('[data-sheet-back]'));
    }
    expect(checked).toBeGreaterThanOrEqual(5);
    await click(pill('chart'));
    expect(stops()).toEqual([]);
    expect(rec.lines.map((l) => l.title ?? '').filter((s) => STOP.test(s))).toEqual([]);
  });
  it('no technical-read strip and no Work this idea door (R-30)', async () => {
    await battle();
    await click(pill('chart'));
    expect(document.body.textContent).not.toMatch(/Technical read|Work this idea/);
  });
});

describe('SB-9 — the 💣 view: the plot, then the bar, What has to happen and the levels table', () => {
  it('BombPlot at the Chart view\'s height, then BombSheet with its levels table', async () => {
    await battle();
    await click(pill('bomb'));
    expect(view()).toBe('bomb');
    const scroll = $('[data-shell-scroll="bomb"]');
    expect(scroll.querySelector('[data-bomb-plot]')).toBeTruthy();
    expect(scroll.querySelector('[data-bomb-sheet]')).toBeTruthy();
    expect(scroll.querySelector('[data-bomb-levels]')).toBeTruthy();
    // The plot comes before the sheet.
    expect(scroll.querySelector('[data-bomb-plot]').compareDocumentPosition(scroll.querySelector('[data-bomb-sheet]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // No candlestick chart in the 💣 view (no 💣 pill inside a chart either).
    expect(rec.series).toEqual([]);
  });
});

describe('SB-10 — the action row: in browse, the mount\'s own action, unchanged', () => {
  it('the watchlist action renders under the Analysis and Chart views and calls the mount\'s handler', async () => {
    WATCH.mockClear();
    await browse();
    const btn = () => $$('button').find((b) => b.textContent === 'Add to Watchlist');
    expect(btn()).toBeTruthy();
    expect(btn().closest('[data-shell-scroll]')).toBeNull();
    await click(btn());
    expect(WATCH).toHaveBeenCalledTimes(1);
    await click(pill('chart'));
    expect(btn()).toBeTruthy();
  });
});
