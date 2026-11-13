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

const net = vi.hoisted(() => ({ calls: [], why: [], daily: null, whyGate: null, fail: false, thirty: null, whyFail: false }));
const rec = vi.hoisted(() => ({ series: [], lines: [], markers: [], tabs: [], technical: [] }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['history', symbol, timeframe, opts ?? null]);
    if (net.fail) return Promise.reject(new Error('down'));
    if (timeframe === '30m' && net.thirty) return Promise.resolve(net.thirty);
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
    if (String(u) === '/api/why-moving') {
      net.why.push(JSON.parse(o.body));
      if (net.whyFail) return { ok: true, status: 200, json: async () => ({ success: false, error: 'down' }) };
      if (net.whyGate) {
        const gate = net.whyGate;
        await new Promise((resolve, reject) => {
          gate.then(resolve);
          o?.signal?.addEventListener?.('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
        });
      }
      return { ok: true, status: 200, json: async () => ({ success: true, data: WHY }) };
    }
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
vi.mock('./CompeteTab', () => ({ default: (p) => { rec.tabs.push(['ranks', p]); return <div data-stub="ranks"><button type="button" data-nav-etf onClick={() => p.onNavigateToStock('XLK', 'Technology Select Sector SPDR')}>nav</button><button type="button" data-nav-msft onClick={() => p.onNavigateToStock('MSFT', 'Microsoft')}>nav</button></div>; } }));
vi.mock('./SectorTab', () => ({ default: (p) => { rec.tabs.push(['sector', p]); return <div data-stub="sector" />; } }));
vi.mock('../Research/SmartMoneyTab', () => ({ default: (p) => { rec.tabs.push(['smartMoney', p]); return <div data-stub="smartMoney" />; } }));
vi.mock('../Research/TechnicalTabV2', () => ({ default: (p) => { rec.technical.push(p); return <div data-stub="technical" />; } }));
vi.mock('../Research/HoldingsTab', () => ({ default: (p) => <div data-stub="holdings"><button type="button" data-nav-stock onClick={() => p.onNavigateToStock('AAPL', 'Apple Inc')}>nav</button></div> }));
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
  net.calls.length = 0; net.why.length = 0; net.daily = null; net.whyGate = null; net.fail = false; net.thirty = null; net.whyFail = false;
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
// The view boxes actually displayed (review C1: the wrapper's data-shell-view alone is not the screen).
const shown = () => $$('[data-shell-scroll]').filter((b) => b.style.display !== 'none').map((b) => b.dataset.shellScroll);
const tfButton = (t) => $$('[data-shell-scroll="chart"] button').find((b) => b.textContent.trim() === t);
// StockChart's active pill style (pillStyle(active)): the one timeframe the chart is on.
const activeTf = () => ['1D', '1W'].find((t) => tfButton(t)?.style.background === 'rgba(0, 217, 255, 0.2)') ?? null;
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
  it("R-35: a crypto battle mount with a sheetContext at 'on' renders AND requests exactly as at 'off' with none — today's layout, byte for byte (the mount's own props: 💣 tab, bomb series, bombContext)", async () => {
    const crypto = { symbol: 'BTC-USD', name: 'Bitcoin', price: 67000, isCrypto: true };
    const run = async (mode, sheetContext) => {
      FLAG.sheet = mode;
      net.calls.length = 0;
      await act(async () => { root.render(<AssetResearchModal asset={crypto} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" bombContext={{ kind: 'bench' }} {...(sheetContext ? { sheetContext } : {})} />); });
      await flush();
      const out = { html: document.body.innerHTML.replace(/_r_\w+_/g, '_r_'), requests: net.calls.map((c) => c.slice(0, 3).join(':')) };
      remount();
      return out;
    };
    const off = await run('off', null);
    const on = await run('on', ctx({ row: { held: false } }));
    if (on.html !== off.html) { let i = 0; while (on.html[i] === off.html[i]) i++; process.stderr.write(`DIFF@${i} OFF ${JSON.stringify(off.html.slice(Math.max(0, i - 150), i + 150))}\nON  ${JSON.stringify(on.html.slice(Math.max(0, i - 150), i + 150))}\n`); }
    expect(on.html).toBe(off.html);
    expect(on.requests).toEqual(off.requests);
    expect(on.requests).toContain('history:BTC-USD:30m'); // today's crypto 💣 tab, on its bomb series
    expect(on.html).not.toContain('data-shell-view');
  });
  it.each([['an index', 'SPY', 'SPDR S&P 500'], ['a sector ETF', 'XLK', 'Technology Select Sector SPDR']])("R-35: %s keeps today's layout at 'on'", async (_, symbol, name) => {
    FLAG.sheet = 'on';
    await browse({ symbol, name, price: 500 });
    expect($('[data-shell-view]')).toBeNull();
    expect($('[data-drawer-root]')).toBeTruthy();
  });
  it("the shell appearing on an open modal shows the view of the series on screen (review B2): a late allowlist verdict over today's 💣 tab → the 💣 view, never Analysis over the bomb series", async () => {
    FLAG.sheet = 'allowlist';
    await battle({ sheetContext: null }); // the verdict has not landed: today's modal, on its bomb series
    expect($('[data-shell-view]')).toBeNull();
    expect(history()).toContain('30m');
    await battle(); // the verdict lands: the screen hands sheetContext
    expect(view()).toBe('bomb');
    expect($('[data-bomb-sheet]')).toBeTruthy();
    // and its pills behave from there: Analysis restores the chart's 1D.
    const before = history().length;
    await click(pill('analysis'));
    expect(view()).toBe('analysis');
    await click(pill('chart'));
    expect(history().slice(before)).not.toContain('30m');
  });
  it("…and a stock reached from a sector ETF on a 💣 mount opens on the 💣 view; one reached on 1D opens on Analysis", async () => {
    await act(async () => { root.render(<AssetResearchModal asset={{ symbol: 'XLK', name: 'Technology Select Sector SPDR', price: 230 }} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="holdings" defaultTimeframe="bomb" bombContext={{ kind: 'bench' }} />); });
    await flush();
    expect($('[data-shell-view]')).toBeNull();
    await click($('[data-nav-stock]'));
    expect(view()).toBe('bomb');
    remount();
    await act(async () => { root.render(<AssetResearchModal asset={{ symbol: 'XLK', name: 'Technology Select Sector SPDR', price: 230 }} onClose={() => {}} showActionButton={false} version={2} defaultTab="holdings" />); });
    await flush();
    await click($('[data-nav-stock]'));
    expect(view()).toBe('analysis');
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
  it('a shut market\'s frozen zone never warms the pill (review A3): at 5:30 PM ET, 0.36 % under +30, the 💣 view shows the frozen chip and the pill stays cool', async () => {
    vi.setSystemTime(new Date('2026-10-14T21:30:00.000Z'));
    await battle({ wsPrice: 103.4 });
    expect(view()).toBe('analysis'); // FQ-9 counts only a live zone
    expect(pill('bomb').dataset.shellPillWarm).toBe('0');
    await click(pill('bomb'));
    expect($('[data-bomb-redzone-chip]').dataset.bombRedzoneChip).toBe('closed');
    await click(pill('analysis'));
    expect(pill('bomb').dataset.shellPillWarm).toBe('0');
  });
  it('the header\'s change is the day\'s only: with the daily series failed it shows none — never the battle asset\'s change since entry (review A5)', async () => {
    net.fail = true;
    await battle();
    expect($('[data-shell-header]')).toBeTruthy();
    expect($('[data-shell-change]')).toBeNull();
    expect($('[data-shell-moving] h3').textContent).toBe('Why is AAPL moving?');
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
    // The 1W pill is the active one (StockChart's own active style).
    expect(activeTf()).toBe('1W');
    // 💣 → Analysis restores it too (the chart, met again, is still on 1W).
    await click(pill('bomb'));
    await click(pill('analysis'));
    await click(pill('chart'));
    expect(activeTf()).toBe('1W');
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
    expect($('[data-shell-moving] h3').textContent).toMatch(/^Why is .+ [+−]\d+\.\d\d%\?$/);
    await click($('[data-shell-moving-ask]'));
    expect(net.why).toHaveLength(1);
    // The popup's own body (the held asset carries no name here, so JSON drops it, as the popup's would).
    expect(Object.keys(net.why[0]).sort()).toEqual(['change', 'close', 'high', 'low', 'open', 'price', 'symbol']);
    // `change` and `price` are the ones the header shows (§9): the title's number and the header's agree
    // to the digit, never the battle asset's own percentChange (its change since entry) or its stale price.
    const header = Number($('[data-shell-change]').textContent.replace(/[^\d.]/g, ''));
    expect(Number(net.why[0].change.toFixed(2))).toBe(header);
    expect($('[data-shell-moving] h3').textContent).toBe(`Why is AAPL +${header.toFixed(2)}%?`);
    expect(heldAsset().percentChange?.toFixed?.(2)).not.toBe(header.toFixed(2));
    expect([net.why[0].symbol, net.why[0].price]).toEqual(['AAPL', 103.2]);
    expect($('[data-shell-header]').textContent).toContain('$103.20');
    expect(document.body.textContent).toContain('Apple rose on strong iPhone demand.');
    expect(document.body.textContent).toContain('reuters.com');
    expect($('[data-shell-moving-foot]').textContent).toBe('From the wire and the day’s bar · not Juno’s view');
  });
  it('one tap is ONE request: live ticks while it is in flight never abort and re-send it (reviews A4, B1 — each re-send a provider call)', async () => {
    let answer;
    net.whyGate = new Promise((r) => { answer = r; });
    await battle({ wsPrice: 103.2 });
    await click($('[data-shell-moving-ask]'));
    for (const p of [103.3, 103.25, 103.1]) await battle({ wsPrice: p });
    expect(net.why).toHaveLength(1);
    expect($('[data-shell-moving]').dataset.shellMoving).toBe('loading');
    // The title follows the header's live number; the request keeps what the tap sent.
    const header = Number($('[data-shell-change]').textContent.replace(/[^\d.]/g, ''));
    expect($('[data-shell-moving] h3').textContent).toContain(header.toFixed(2));
    await act(async () => { answer(); });
    await flush();
    expect($('[data-shell-moving]').dataset.shellMoving).toBe('success');
    expect(net.why).toHaveLength(1);
    net.whyGate = null;
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
    // Every question the row shows (QF-1: decided at open).
    const asked = $$('[data-sheet-questions] [data-sheet-question]').map((b) => b.dataset.sheetQuestion);
    expect(asked).toHaveLength(3);
    for (const q of asked) {
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

describe('review C — the promises the first rows did not pin', () => {
  const bar = (iso, o, hi, lo, c) => ({ date: iso, datetime: iso, timestamp: Math.floor(Date.parse(iso) / 1000), open: o, high: hi, low: lo, close: c, volume: 100 });
  const THIRTY = [bar('2026-10-14T16:30:00.000Z', 103, 103.5, 102.9, 103.3), bar('2026-10-14T16:00:00.000Z', 102.5, 103.1, 102.4, 103), bar('2026-10-14T15:30:00.000Z', 102, 102.6, 101.9, 102.5), bar('2026-10-14T13:30:00.000Z', 101, 101.4, 100.6, 101.2)];
  it('C1: one view on screen at a time — the Analysis box is hidden under Chart and 💣, and under an FQ-9 open', async () => {
    await battle();
    expect(shown()).toEqual(['analysis']);
    await click(pill('chart'));
    expect(shown()).toEqual(['chart']);
    await click(pill('bomb'));
    expect(shown()).toEqual(['bomb']);
    await click(pill('analysis'));
    expect(shown()).toEqual(['analysis']);
    remount();
    await battle({ wsPrice: 103.4 });
    expect(view()).toBe('bomb');
    expect(shown()).toEqual(['bomb']);
  });
  it('C2: stock → stock inside the shell: the header\'s back arrow, the Analysis view back at its top, What\'s moving asks only on its own tap — never for the stock left or returned to', async () => {
    await browse();
    const writes = [];
    Object.defineProperty($('[data-shell-scroll="analysis"]'), 'scrollTop', { configurable: true, get: () => 0, set: (v) => { writes.push(v); } });
    expect($('[data-shell-back]')).toBeNull();
    await click($('[data-shell-tab="ranks"]'));
    await click($('[data-nav-msft]'));
    expect(view()).toBe('analysis');
    expect($('[data-shell-header]').textContent).toContain('MSFT');
    expect(writes).toContain(0);
    expect($('[data-shell-back]').getAttribute('aria-label')).toBe('Back');
    await click($('[data-shell-tab="moving"]'));
    expect(net.why).toEqual([]);
    await click($('[data-shell-moving-ask]'));
    expect(net.why.map((b) => b.symbol)).toEqual(['MSFT']);
    await click($('[data-shell-back]'));
    expect($('[data-shell-header]').textContent).toContain('CEG');
    expect($('[data-shell-moving]').dataset.shellMoving).toBe('unasked');
    expect(net.why.map((b) => b.symbol)).toEqual(['MSFT']);
  });
  it('C3: the header\'s ✕ closes the modal; its change pill points down on a falling day', async () => {
    const onClose = vi.fn();
    net.daily = [
      { date: '2026-10-14', open: 101, high: 101.5, low: 99, close: 99.5, volume: 1 },
      { date: '2026-10-13', open: 100, high: 101.2, low: 99, close: 100.9, volume: 1 },
    ];
    await act(async () => { root.render(<AssetResearchModal asset={{ symbol: 'CEG', name: 'Constellation Energy', price: 99.5 }} onClose={onClose} version={2} />); });
    await flush();
    expect($('[data-shell-change]').textContent).toMatch(/^▼ 1\.39%$/);
    expect($('[data-shell-moving] h3').textContent).toBe('Why is Constellation Energy −1.39%?');
    expect($('[data-shell-close]').getAttribute('aria-label')).toBe('Close');
    await click($('[data-shell-close]'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('C4: a draft mount under the shell keeps ON THE CLOCK and Acquire; the Close fallback when the displayed name is off-board', async () => {
    const onAcquire = vi.fn();
    const draft = (extra) => act(async () => { root.render(<AssetResearchModal asset={{ symbol: 'CEG', name: 'Constellation Energy', price: 344.15 }} onClose={() => {}} version={2} isMyTurn canPick timeRemaining={42} onAcquire={onAcquire} {...extra} />); });
    await draft({});
    await flush();
    expect(view()).toBe('analysis');
    expect(document.body.textContent).toContain("YOU'RE ON THE CLOCK!");
    await click($$('button').find((b) => b.textContent === 'Acquire CEG'));
    expect(onAcquire).toHaveBeenCalledTimes(1);
    remount();
    await draft({ isAcquirable: () => false });
    await flush();
    expect(view()).toBe('analysis');
    expect($$('button').some((b) => b.textContent === 'Acquire CEG')).toBe(false);
    const close = $$('button').find((b) => b.textContent === 'Close');
    expect(close).toBeTruthy();
    expect(close.closest('[data-shell-scroll]')).toBeNull();
  });
  // BS-1 (the founder's ruling on reading 7, 2026-11-12; review C5 first pinned the reading as built).
  const bombOnly = async (over = {}) => {
    await act(async () => { root.render(<AssetResearchModal asset={{ symbol: 'CEG', name: 'Constellation Energy', price: 344.15 }} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" bombContext={{ kind: 'bench' }} {...over} />); });
    await flush();
  };
  it('BS-1: the free-agent bar (defaultTab 💣, defaultTimeframe bomb, a bench context) opens on the 💣 view, three pills, on the 30-minute series — as it does off the shell', async () => {
    await bombOnly();
    expect(pills()).toEqual(['analysis', 'chart', 'bomb']);
    expect(view()).toBe('bomb');
    expect(shown()).toEqual(['bomb']);
    expect(history()).toContain('30m');
    // Analysis from there is the browse content.
    await click(pill('analysis'));
    expect(shown()).toEqual(['analysis']);
    expect(blocks()).toEqual(['browseAsk', 'wallSt', 'tabs']);
  });
  it.each([
    ['a row tap (defaultTab null)', null],
    ['a red-zone tap (defaultTab 💣)', 'baggerbomb'],
  ])('BS-1: the BaggerBomb battle view — %s with defaultTimeframe bomb and a V4 context — opens on 💣', async (_, defaultTab) => {
    await bombOnly({ defaultTab, bombContext: { kind: 'v4', dailyLevels: { date: '2026-10-14', assets: {} } } });
    expect(view()).toBe('bomb');
    expect(history()).toContain('30m');
  });
  it('BS-1: a Bomb-mode mount whose defaultTab and defaultTimeframe ask for neither opens on Analysis over the browse blocks, with no 30-minute series', async () => {
    await bombOnly({ defaultTab: 'fundamental', defaultTimeframe: '1D' });
    expect(pills()).toEqual(['analysis', 'chart', 'bomb']);
    expect(view()).toBe('analysis');
    expect(blocks()).toEqual(['browseAsk', 'wallSt', 'tabs']);
    expect(history()).not.toContain('30m');
  });
  it('BS-1 leaves the battle mounts alone: with a sheetContext, defaultTab 💣 and defaultTimeframe bomb still open on Analysis outside a zone, and on 💣 inside one (FQ-9 unchanged)', async () => {
    await battle();
    expect(view()).toBe('analysis');
    expect(history()).not.toContain('30m');
    remount();
    await battle({ wsPrice: 103.4 });
    expect(view()).toBe('bomb');
  });
  it('C6: after an FQ-9 open on 💣 (in the red zone, on its minute series), Analysis puts the hook back on 1D — the minute poll stops — and the chart met next is on 1D', async () => {
    net.thirty = THIRTY;
    await battle({ wsPrice: 103.4 });
    expect(view()).toBe('bomb');
    const minute = () => history().filter((t) => t === '1m').length;
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(minute()).toBeGreaterThan(0); // the red zone's poll, while 💣 is on screen
    await click(pill('analysis'));
    const before = minute();
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
    expect(minute()).toBe(before);
    await click(pill('chart'));
    expect(activeTf()).toBe('1D');
  });
  it('C6b: a price pin on 1W keeps the chart on 1W (its line is drawn there)', async () => {
    await battle();
    await click(pill('chart'));
    await click(tfButton('1W'));
    expect(activeTf()).toBe('1W');
    await click(pill('analysis'));
    await click($('[data-sheet-question="protect_lead"]'));
    await click($('[data-pack-item="drawdown"] [data-pack-see]'));
    expect(view()).toBe('chart');
    expect(activeTf()).toBe('1W');
  });
  it('C7: the Chart and 💣 plots take the view\'s MEASURED height (a 600 px view → a 484 px plot), and a short tab fills the view (600 − 45)', async () => {
    const real = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.hasAttribute('data-shell-view') ? 600 : 0; } });
    try {
      await battle();
      expect($('[data-shell-tab-body]').style.minHeight).toBe('555px');
      await click(pill('chart'));
      const plot = [...document.body.querySelectorAll('[data-shell-scroll="chart"] div')].find((d) => d.style.position === 'relative' && /px$/.test(d.style.height))?.style.height;
      expect(plot).toBe('484px');
      await click(pill('bomb'));
      expect($('[data-bomb-plot]').style.height).toBe('484px');
    } finally {
      if (real) Object.defineProperty(HTMLElement.prototype, 'clientHeight', real); else delete HTMLElement.prototype.clientHeight;
    }
  });
  it('C9: What\'s moving after a failed answer: its Retry asks again; a battle naming no agent says whose view it is not by the archetype', async () => {
    net.whyFail = true;
    await battle({ sheetContext: ctx({ agentName: null }) });
    expect($('[data-shell-moving-foot]').textContent).toBe('From the wire and the day’s bar · not Trend Follower’s view');
    await click($('[data-shell-moving-ask]'));
    expect(net.why).toHaveLength(1);
    expect($('[data-shell-moving]').dataset.shellMoving).toBe('error');
    net.whyFail = false;
    await click($$('[data-shell-moving] button').find((b) => b.textContent === 'Retry'));
    expect(net.why).toHaveLength(2);
    expect($('[data-shell-moving]').dataset.shellMoving).toBe('success');
  });
  it('Retry is a new tap: it sends the change and price on screen at the Retry, not the first tap\'s (refuter NEW-2)', async () => {
    net.whyFail = true;
    await battle({ wsPrice: 103.2 });
    await click($('[data-shell-moving-ask]'));
    expect($('[data-shell-moving]').dataset.shellMoving).toBe('error');
    const first = net.why[0];
    await battle({ wsPrice: 103.9 });
    net.whyFail = false;
    await click($$('[data-shell-moving] button').find((b) => b.textContent === 'Retry'));
    expect(net.why).toHaveLength(2);
    expect(net.why[1].price).toBe(103.9);
    expect(net.why[1].change).not.toBe(first.change);
    const header = Number($('[data-shell-change]').textContent.replace(/[^\d.]/g, ''));
    expect(Number(net.why[1].change.toFixed(2))).toBe(header);
    expect($('[data-shell-moving]').dataset.shellMoving).toBe('success');
  });
  it('C10: Bomb mode rolled back under the shell: two pills, and the Chart view keeps the legacy in-chart 💣 pill (SB-8)', async () => {
    FLAG.bomb = 'off';
    await act(async () => { root.render(<AssetResearchModal asset={heldAsset()} onClose={() => {}} showActionButton={false} isGameContext version={2} wsPrice={103.2} sheetContext={ctx()} />); });
    await flush();
    expect(pills()).toEqual(['analysis', 'chart']);
    await click(pill('chart'));
    expect($$('[data-shell-scroll="chart"] button').some((b) => b.textContent === '💣')).toBe(true);
  });
  it('C12: a browse mount on a phone under the shell is sized from the visible viewport too (100dvh, border inside)', async () => {
    const realWidth = window.innerWidth;
    const realCSS = globalThis.CSS;
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true, writable: true });
    globalThis.CSS = { supports: (p, v) => p === 'height' && v === '100dvh' };
    try {
      await browse();
      const box = $$('div').find((d) => d.style.width === '100vw');
      expect([box?.style.height, box?.style.boxSizing]).toEqual(['100dvh', 'border-box']);
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: realWidth, configurable: true, writable: true });
      if (realCSS === undefined) delete globalThis.CSS; else globalThis.CSS = realCSS;
    }
  });
});

describe('refuter (lens D) — the layout fixes, pinned on every run (the browser rows measure them)', () => {
  it('D1 / D4: the strip spans the view with 10 px sides and 6 px gaps; each tab carries 6 px side padding (its whole box takes the tap); the labels size by clamp(12px, 3.6vw, 13.5px)', async () => {
    await battle();
    const strip = $('[data-shell-strip]');
    expect([strip.style.gap, strip.style.padding, strip.style.margin]).toEqual(['6px', '0px 10px', '0px -16px']);
    for (const t of $$('[data-shell-tab]')) expect([t.style.padding, t.style.minHeight]).toEqual(['0px 6px', '44px']);
    // jsdom drops clamp() from a serialized style: the source holds the rule (the 320 px browser row measures it).
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const src = readFileSync(path.resolve(process.cwd(), 'src/components/Research/Sheet/ShellTabs.jsx'), 'utf8');
    expect(src).toContain("<span style={{ fontSize: 'clamp(12px, 3.6vw, 13.5px)' }}>{LABEL[t]}</span>");
  });
  it('D3: a tab picked while the strip is stuck scrolls the view back to the strip (the new tab from its top)', async () => {
    await battle();
    const box = $('[data-shell-scroll="analysis"]');
    const writes = [];
    let top = 900;
    Object.defineProperty(box, 'scrollTop', { configurable: true, get: () => top, set: (v) => { writes.push(v); top = v; } });
    const realRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
      if (this.hasAttribute('data-shell-tabs')) return { top: -340, bottom: 400, left: 0, right: 375, width: 375, height: 740 };
      if (this.getAttribute('data-shell-scroll') === 'analysis') return { top: 110, bottom: 740, left: 0, right: 375, width: 375, height: 630 };
      return realRect.call(this);
    });
    await click($('[data-shell-tab="ranks"]'));
    expect(writes).toEqual([900 - 450]);
    // Not stuck (the strip below the box's top): no scroll.
    HTMLElement.prototype.getBoundingClientRect.mockImplementation(function rect() {
      if (this.hasAttribute('data-shell-tabs')) return { top: 560, bottom: 1400, left: 0, right: 375, width: 375, height: 840 };
      if (this.getAttribute('data-shell-scroll') === 'analysis') return { top: 110, bottom: 740, left: 0, right: 375, width: 375, height: 630 };
      return realRect.call(this);
    });
    await click($('[data-shell-tab="sector"]'));
    expect(writes).toEqual([450]);
  });
  it('D6 / D7: the stock row gives only the name room to shrink (6 px gaps); a long About name ellipsizes inside its button, the chevron kept', async () => {
    await act(async () => { root.render(<AssetResearchModal asset={{ symbol: 'TSM', name: 'Taiwan Semiconductor Manufacturing Company Limited', price: 180 }} onClose={() => {}} version={2} />); });
    await flush();
    expect($('[data-shell-stock-row]').style.gap).toBe('6px');
    const name = $('[data-shell-about-name]');
    expect([name.style.whiteSpace, name.style.overflow, name.style.textOverflow, name.style.minWidth]).toEqual(['nowrap', 'hidden', 'ellipsis', '0px']);
    expect([$('[data-sheet-about]').style.minWidth, $('[data-sheet-about]').style.maxWidth]).toEqual(['0px', '100%']);
    expect($('[data-shell-about-group]').style.maxWidth).toBe('100%');
  });
  it('BS-3: the price and the change narrow with the screen — clamp(12px, 3.6vw, 14px) and clamp(10px, 2.95vw, 11.5px) — while the name keeps its ellipsis (shellHeader.browser.test.js measures 320 and 375 px)', async () => {
    await act(async () => { root.render(<AssetResearchModal asset={{ symbol: 'BRK.A', name: 'Berkshire Hathaway Inc', price: 712345.67 }} onClose={() => {}} version={2} />); });
    await flush();
    expect($('[data-shell-price]').textContent).toBe('$712345.67');
    // jsdom drops clamp() from a serialized style: the source holds the rule on the two spans.
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const src = readFileSync(path.resolve(process.cwd(), 'src/components/Research/Sheet/ShellHeader.jsx'), 'utf8');
    expect(src).toContain("export const SHELL_PRICE_FONT = 'clamp(12px, 3.6vw, 14px)';");
    expect(src).toContain("export const SHELL_CHANGE_FONT = 'clamp(10px, 2.95vw, 11.5px)';");
    expect(src).toMatch(/<span data-shell-price style=\{\{ fontFamily: MONO, fontSize: SHELL_PRICE_FONT,/);
    expect(src).toMatch(/<span data-shell-change style=\{\{ fontFamily: MONO, fontSize: SHELL_CHANGE_FONT,/);
    const name = $('[data-shell-stock-row]').children[1];
    expect([name.style.flex, name.style.minWidth, name.style.overflow, name.style.textOverflow]).toEqual(['1 1 0%', '0px', 'hidden', 'ellipsis']);
    // Review D1: the symbol gives way only after the name (a tiny shrink weight), so ✕ stays on screen in any font.
    const sym = $('[data-shell-symbol]');
    expect([sym.textContent, sym.style.minWidth, sym.style.flexShrink, sym.style.overflow, sym.style.textOverflow]).toEqual(['BRK.A', '0px', '0.001', 'hidden', 'ellipsis']);
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
