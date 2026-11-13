// @vitest-environment jsdom
//
// BS-4 (founder ruling Q3, 2026-11-12; Battle Research inventory §4 F3, §12 H3) —
// THE 💣 PREVIEW'S RUNG SIZE FOR A STOCK THE AGENT DOES NOT HOLD, in a battle scored
// by the measured ATR model: the rankings' ATR reading (stockTechnicalScores/{SYM},
// one read), never the screen's threshold (atrPercentile × 8, or the 2.5 default).
// REAL: AssetResearchModal, useResearchData, the BombMode views, the selector and
// the ladder, on the corrected-battle harness. Mocked: the network and Firestore
// (recorded), lightweight-charts, the unrelated tabs. Both research-modal flags are
// held by mock (Bomb mode 'on'; the sheet 'off' unless a row says otherwise).

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.hoisted(() => { process.env.TZ = 'UTC'; });
const flag = vi.hoisted(() => ({ bomb: 'on', sheet: 'off' }));
const FLAGS = vi.hoisted(() => ({
  get RESEARCH_MODAL_BOMB_MODE() { return flag.bomb; },
  RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']),
  get RESEARCH_MODAL_SHEET_MODE() { return flag.sheet; },
  RESEARCH_MODAL_SHEET_MODES: Object.freeze(['off', 'allowlist', 'on']),
}));
vi.mock('../../config/researchModalFlags', () => FLAGS);
vi.mock('../../config/researchModalFlags.js', () => FLAGS);
const net = vi.hoisted(() => ({ daily: {}, intraday: {}, calls: [], docs: {}, failRead: false, hold: {} }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['history', symbol, timeframe, opts ?? null]);
    const src = timeframe === '1d' ? net.daily : timeframe === '30m' ? net.intraday : {};
    return Promise.resolve(src[symbol] ?? []);
  },
  getStockPrice: (symbol) => { net.calls.push(['quote', symbol]); return Promise.resolve({ symbol, price: 0 }); },
}));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: (s) => { net.calls.push(['profile', s]); return Promise.resolve(null); } }));
vi.mock('../../services/volatilityService', () => ({ getVolatilityThresholds: (syms, kind) => { net.calls.push(['thresholds', syms, kind]); return Promise.resolve({ [syms[0]]: { threshold: 9.9 } }); } }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: (u) => { net.calls.push(['fetchWithAuth', String(u)]); return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true, data: {} }) }); } }));
vi.mock('lightweight-charts', () => {
  const series = () => ({ setData() {}, createPriceLine() { return { applyOptions() {} }; }, removePriceLine() {}, setMarkers() {}, priceScale() { return { applyOptions() {} }; }, applyOptions() {} });
  return {
    createChart: () => ({ addSeries: () => series(), removeSeries() {}, subscribeCrosshairMove() {}, timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; } }; }, applyOptions() {}, remove() {} }),
    createSeriesMarkers: () => ({ setMarkers() {}, detach() {} }),
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
vi.mock('../Research/AnalysisQATab', () => ({ default: () => null }));
vi.mock('../Research/TechnicalTabV2', () => ({ default: () => null }));
vi.mock('../Research/HealthTab', () => ({ default: () => null }));
vi.mock('./ResearchTabs/TechnicalAnalysisTab', () => ({ default: () => null }));
vi.mock('./SectorTab', () => ({ default: () => null }));
// The Ranks tab as a stand-in that navigates inside the modal (review C2: held → a non-held peer).
vi.mock('./CompeteTab', () => ({ default: (p) => <button type="button" data-nav-acn onClick={() => p.onNavigateToStock('ACN', 'Accenture')}>nav</button> }));
vi.mock('../Research/MarketContextTab', () => ({ default: () => null }));
vi.mock('../Research/HoldingsTab', () => ({ default: () => null }));
vi.mock('../Research/SectorETFRanksTab', () => ({ default: () => null }));
vi.mock('../Research/SmartMoneyTab', () => ({ default: () => null }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig()),
  doc: (_db, ...path) => ({ path: path.join('/') }),
  getDoc: (ref) => {
    net.calls.push(['getDoc', ref.path]);
    if (net.failRead) return Promise.reject(new Error('unavailable'));
    const answer = () => { const d = net.docs[ref.path]; return { exists: () => d != null, data: () => d ?? null }; };
    // A held read (review C5, C26): answered when the row releases it.
    if (net.hold[ref.path]) return net.hold[ref.path].then(answer);
    return Promise.resolve(answer());
  },
}));

import { STOCK_TEST_NOW, correctedStockBattle, stockWriterDb } from '../../../api/_utils/__fixtures__/stockThresholdHarness.js';
import { correctedScorePatch, scoreCorrectedPosition } from '../../../api/_utils/stockThresholdAdmission.js';
import { enrichHeldPosition } from '../../screens/AgentBattleScreen.jsx';
import { benchSheetOf } from '../../screens/battleView/cockpit2bModel.js';
import { buildResearchAsset } from '../../utils/researchAssetBuilder.js';
import { agentBombContext } from '../Research/BombMode/selectBombRecord.js';
import { legacyBattle } from '../Research/BombMode/__fixtures__/bombBattles.js';
import AssetResearchModal from './AssetResearchModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
const oldKey = process.env.EODHD_API_KEY;
beforeAll(() => { process.env.EODHD_API_KEY = 'isolated-key'; });
afterAll(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; });
let container, root;
beforeEach(() => {
  flag.bomb = 'on'; flag.sheet = 'off';
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  net.calls.length = 0; net.docs = {}; net.daily = {}; net.intraday = {}; net.failRead = false; net.hold = {};
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };
const render = async (el) => { await act(async () => { root.render(el); }); await flush(); };
const q = (sel) => document.body.querySelector(sel);
// The ATR line binds its separators with no-break spaces (review D2): rows read text with them as spaces.
const plain = (t) => t.replace(/\u00a0/g, ' ');
const what = () => plain(q('[data-bomb-what]').textContent);
const bodyText = () => plain(document.body.textContent);
const reads = () => net.calls.filter((c) => c[0] === 'getDoc').map((c) => c[1]);
const thresholdAsks = () => net.calls.filter((c) => c[0] === 'thresholds');

const NOW = '2026-10-14T17:00:00.000Z'; // Wed 1:00 PM ET
const PREV_CLOSE = 300;
const bar = (iso, c) => ({ date: iso, datetime: iso, timestamp: Math.floor(Date.parse(iso) / 1000), open: c, high: c * 1.001, low: c * 0.999, close: c, volume: 100 });
function seed(symbol, prevClose = PREV_CLOSE) {
  vi.useFakeTimers(); vi.setSystemTime(new Date(NOW));
  net.daily[symbol] = [{ date: '2026-10-14', open: prevClose, high: prevClose * 1.01, low: prevClose * 0.99, close: prevClose * 1.002, volume: 1 }, { date: '2026-10-13', open: prevClose, high: prevClose, low: prevClose, close: prevClose, volume: 1 }];
  net.intraday[symbol] = [bar('2026-10-14T16:30:00.000Z', prevClose), bar('2026-10-14T16:00:00.000Z', prevClose), bar('2026-10-14T13:30:00.000Z', prevClose), bar('2026-10-13T19:30:00.000Z', prevClose)];
}
const at = (iso) => ({ toMillis: () => Date.parse(iso) });
const scores = (symbol, atrPercent, updatedAt = at('2026-10-14T16:05:00.000Z')) => { net.docs[`stockTechnicalScores/${symbol}`] = { symbol, atrPercent, updatedAt }; };

/** A battle scored by the measured ATR model (the corrected-battle harness), the agent holding AAPL. */
async function measuredBattle() {
  const { battle } = await correctedStockBattle({ fill: 100.75 });
  const prices = { AAPL: { current: 101, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
  const s = ['agent', 'cpu'].map((side) => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
  const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [s[0]], [s[1]], STOCK_TEST_NOW)); Object.assign(battle, h.store.get('battle'));
  battle.expiresAt = '2026-10-20T20:00:00.000Z';
  return battle;
}
/** The battle screen's non-held asset: the threshold the screen hands today (scoring.thresholds, else baseATR, else 2.5). */
const nonHeld = (symbol, { threshold = null, price = 301, isCrypto } = {}) => buildResearchAsset(
  { symbol, name: symbol, ...(isCrypto ? { isCrypto: true } : {}) },
  { livePrices: { [symbol]: price }, thresholds: threshold ? { [symbol]: { threshold } } : {}, startingPrices: {}, useDefaultThreshold: true },
);
const open = (asset, bombContext, extra = {}) => render(<AssetResearchModal asset={asset} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={asset.price} bombContext={bombContext} {...extra} />);

let BATTLE;
beforeAll(async () => { BATTLE = await measuredBattle(); });

describe('BS-4 — a non-held stock in a measured battle previews its rungs at the rankings\' ATR reading', () => {
  it('ACN-like: the screen hands 6.48 (atrPercentile × 8), the reading is 4.05 — the rungs are 4.05 % apart, labelled as an estimate with the run\'s time; one read, no thresholds request', async () => {
    seed('ACN'); scores('ACN', 4.05);
    const ctx = agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' });
    expect([ctx.held, ctx.stockModel]).toEqual([false, 'corrected']);
    await open(nonHeld('ACN', { threshold: 6.48 }), ctx);
    // 300 × (1 + 4.05 %) = 312.15 — never 300 × 1.0648 = 319.44.
    expect(q('[data-fuse-rung-label="bagger"]').textContent).toContain('$312.15');
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$312.15');
    expect(bodyText()).not.toContain('$319.44');
    expect(what()).toContain("Preview · rungs if it entered at yesterday's close ($300.00) · estimated rung size · ATR reading 4.0% · as of 12:05 PM");
    expect(reads()).toEqual(['stockTechnicalScores/ACN']);
    expect(thresholdAsks()).toEqual([]);
  });

  it("the bench sheet's ATR column and the preview print the same number for the same reading (BUILD_RULES §9)", async () => {
    seed('ACN'); scores('ACN', 4.05);
    await open(nonHeld('ACN', { threshold: 6.48 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }));
    const bench = benchSheetOf({ status: 'ready', data: { asOf: null, rows: [{ symbol: 'ACN', status: 'available', rank: 12, atrPct: 4.05 }] } }).rows[0].atr;
    // (4.05).toFixed(1) is "4.0": 4.05 is stored as 4.0499…, and both surfaces print it through the same rule.
    expect(bench).toBe('ATR 4.0%');
    const preview = what().match(/ATR reading (\d+\.\d)%/)[1];
    expect(`ATR ${preview}%`).toBe(bench);
  });

  it('an unranked name (no reading) shows "No ladder yet" — never the 2.5 default the screen hands', async () => {
    seed('ZZZZ');
    const asset = nonHeld('ZZZZ');
    expect(asset.threshold).toBe(2.5); // what the screen hands today for a name with no thresholds entry
    await open(asset, agentBombContext(BATTLE, 'ZZZZ', Date.parse(NOW), { battleId: 'stock-battle' }));
    expect(q('[data-bomb-view="state"]').dataset.bombState).toBe('atr_unavailable');
    expect(q('[data-bomb-view="state"]').textContent).toContain('No ladder yet');
    expect(q('[data-bomb-view="state"]').textContent).toContain('This stock has no usable ATR reading from a recent rankings run, so no rung size is shown.');
    expect(q('[data-fuse-rung-label]')).toBeNull();
    expect(bodyText()).not.toContain('$307.50'); // 300 × 1.025
    expect(reads()).toEqual(['stockTechnicalScores/ZZZZ']);
    expect(thresholdAsks()).toEqual([]);
  });

  it('a document with no atrPercent is no reading too; a read that fails says the reading has not loaded', async () => {
    seed('ACN'); net.docs['stockTechnicalScores/ACN'] = { symbol: 'ACN', atrPercent: null };
    await open(nonHeld('ACN', { threshold: 6.48 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }));
    expect(q('[data-bomb-view="state"]').dataset.bombState).toBe('atr_unavailable');
    act(() => root.unmount()); container.remove(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    net.failRead = true;
    await open(nonHeld('ACN', { threshold: 6.48 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }));
    expect(q('[data-bomb-view="state"]').dataset.bombState).toBe('atr_failed');
    expect(q('[data-bomb-view="state"]').textContent).toContain("The ATR reading couldn't be read. It's asked again when you change view or tab.");
    expect(bodyText()).not.toContain('$319.44');
  });

  it.each([
    ['15 days old (a name the runs stopped scoring keeps its last document)', at('2026-09-29T20:05:00.000Z')],
    ['with no time on it', undefined],
  ])('review A1 / B2: a reading %s is no reading — "No ladder yet", never the stale number', async (_, updatedAt) => {
    seed('ACN'); net.docs['stockTechnicalScores/ACN'] = { symbol: 'ACN', atrPercent: 4.05, ...(updatedAt ? { updatedAt } : {}) };
    await open(nonHeld('ACN', { threshold: 6.48 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }));
    expect(q('[data-bomb-view="state"]').dataset.bombState).toBe('atr_unavailable');
    expect(q('[data-bomb-view="state"]').textContent).toContain('This stock has no usable ATR reading from a recent rankings run, so no rung size is shown.');
    expect(bodyText()).not.toMatch(/\$312\.15|\$319\.44|ATR reading \d/);
  });

  it('review A2: a reading no ladder can be drawn from (55 % on a $40 close puts Meltdown below $0) is "No ladder yet", never "$undefined"', async () => {
    seed('ACN', 40); scores('ACN', 55);
    await open(nonHeld('ACN', { threshold: 6.48, price: 41 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }));
    expect(q('[data-bomb-view="state"]').dataset.bombState).toBe('atr_unavailable');
    expect(bodyText()).not.toMatch(/undefined|NaN/);
  });

  it('review A5 / B1: a failed read is asked again when 💣 reopens (under the shell), and then draws', async () => {
    flag.sheet = 'on'; seed('ACN'); scores('ACN', 4.05); net.failRead = true;
    const sheetContext = { battleId: 'stock-battle', agentId: 'agent', archetype: 'momentum_chaser', agentName: 'Juno', row: { held: false }, battle: BATTLE, calls: [], standing: null, directive: null };
    await open(nonHeld('ACN', { threshold: 6.48 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }), { sheetContext });
    const pill = async (v) => { await act(async () => { q(`[data-shell-pill="${v}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush(); };
    await pill('bomb');
    expect(q('[data-bomb-view="state"]').dataset.bombState).toBe('atr_failed');
    net.failRead = false;
    await pill('analysis');
    await pill('bomb');
    expect(q('[data-fuse-rung-label="bagger"]').textContent).toContain('$312.15');
    expect(reads().filter((p) => p.startsWith('stockTechnicalScores/'))).toEqual(['stockTechnicalScores/ACN', 'stockTechnicalScores/ACN']);
  });

  it('refuter NEW-2: off the shell (the battle mounts sit on the Bomb tab and the bomb series) a failed read is asked again when the tab changes — once per change, never in a loop', async () => {
    seed('ACN'); scores('ACN', 4.05); net.failRead = true;
    await open(nonHeld('ACN', { threshold: 6.48 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }));
    expect(q('[data-bomb-view="state"]').dataset.bombState).toBe('atr_failed');
    for (let i = 0; i < 3; i += 1) await flush();
    expect(reads()).toEqual(['stockTechnicalScores/ACN']);
    net.failRead = false;
    const tab = (label) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
    await act(async () => { tab('Technical').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    await act(async () => { tab('💣 Bomb').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$312.15');
    expect(reads()).toEqual(['stockTechnicalScores/ACN', 'stockTechnicalScores/ACN']);
  });

  it('review B3: a stock left and returned to is not read again (one read per stock for the modal\'s life)', async () => {
    seed('ACN'); seed('MSFT'); scores('ACN', 4.05); scores('MSFT', 2.2);
    const show = (sym) => render(<AssetResearchModal key="one" asset={nonHeld(sym, { threshold: 6.48 })} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={301} bombContext={agentBombContext(BATTLE, sym, Date.parse(NOW), { battleId: 'stock-battle' })} />);
    await show('ACN'); await show('MSFT'); await show('ACN');
    expect(reads()).toEqual(['stockTechnicalScores/ACN', 'stockTechnicalScores/MSFT']);
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$312.15');
  });

  it("a reading from an earlier session names its day: 'as of Tue 4:05 PM'", async () => {
    seed('ACN'); scores('ACN', 4.05, at('2026-10-13T20:05:00.000Z'));
    await open(nonHeld('ACN', { threshold: 6.48 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }));
    expect(what()).toContain('ATR reading 4.0% · as of Tue 4:05 PM');
  });

  it('one read per stock: live ticks re-render the modal, and nothing is read again', async () => {
    seed('ACN'); scores('ACN', 4.05);
    const ctx = agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' });
    const asset = nonHeld('ACN', { threshold: 6.48 });
    await open(asset, ctx);
    for (const px of [301.4, 302.1, 299.8]) await render(<AssetResearchModal asset={asset} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={px} bombContext={ctx} />);
    expect(reads()).toEqual(['stockTechnicalScores/ACN']);
  });

  it('a stock with no threshold on it (an in-modal navigation lands one) asks for the reading, never the thresholds route', async () => {
    seed('ACN'); scores('ACN', 4.05);
    await open({ symbol: 'ACN', name: 'Accenture', price: 301 }, agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }));
    expect(q('[data-fuse-rung-label="bagger"]').textContent).toContain('$312.15');
    expect(thresholdAsks()).toEqual([]);
    expect(reads()).toEqual(['stockTechnicalScores/ACN']);
  });

  it('under the shell (sheet on): the 💣 view draws the same reading, read only once that view is open', async () => {
    flag.sheet = 'on'; seed('ACN'); scores('ACN', 4.05);
    const sheetContext = { battleId: 'stock-battle', agentId: 'agent', archetype: 'momentum_chaser', agentName: 'Juno', row: { held: false }, battle: BATTLE, calls: [], standing: null, directive: null };
    await open(nonHeld('ACN', { threshold: 6.48 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }), { sheetContext });
    expect(q('[data-shell-view]').dataset.shellView).toBe('analysis');
    expect(reads().filter((p) => p.startsWith('stockTechnicalScores/'))).toEqual([]);
    await act(async () => { q('[data-shell-pill="bomb"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    expect(q('[data-fuse-rung-label="bagger"]').textContent).toContain('$312.15');
    expect(reads().filter((p) => p.startsWith('stockTechnicalScores/'))).toEqual(['stockTechnicalScores/ACN']);
  });
});

describe('BS-4 — unchanged: every other ladder', () => {
  it('a held measured stock keeps its frozen receipt ladder, and its reading is never read', async () => {
    seed('AAPL', 99); scores('AAPL', 9.99);
    const left = enrichHeldPosition(BATTLE.portfolio.star[0], 'star', { stockBattle: BATTLE, stockSide: 'agent', stockSlot: 0 });
    const asset = buildResearchAsset(left, { livePrices: { AAPL: 101.2 }, thresholds: { AAPL: { threshold: 2.5 } }, startingPrices: { AAPL: 100.75 }, useDefaultThreshold: true });
    const ctx = agentBombContext(BATTLE, 'AAPL', Date.parse(NOW), { battleId: 'stock-battle', positionId: 'position-agent' });
    expect(ctx.record.model).toBe('measured');
    await open(asset, ctx);
    const bagger = ctx.record.measured.targets.find((t) => t.key === 'bagger').price;
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain(`$${(Math.ceil(bagger * 100 - 1e-6) / 100).toFixed(2)}`);
    expect(what()).not.toMatch(/ATR reading|Preview/);
    expect(reads().filter((p) => p.startsWith('stockTechnicalScores/'))).toEqual([]);
  });

  it.each([
    ["the CPU's own held measured stock", (b) => b, 'cpu'],
    ["the agent's own measured stock after the battle ends", (b) => ({ ...b, status: 'completed' }), 'agent'],
  ])('refuter NEW-1: %s keeps what it showed before ("No ladder yet"), never an "if it entered" preview, and reads nothing', async (_, battleOf, side) => {
    seed('AAPL', 99); scores('AAPL', 4.05);
    const battle = battleOf(BATTLE);
    const pos = (side === 'cpu' ? battle.opponent.portfolio : battle.portfolio).star[0];
    const left = enrichHeldPosition(pos, 'star', { stockBattle: battle, stockSide: side, stockSlot: 0 });
    expect(left.stockRewardRoute).toBeTruthy();
    const asset = buildResearchAsset(left, { livePrices: { AAPL: 101.2 }, thresholds: {}, startingPrices: {}, useDefaultThreshold: true });
    const ctx = agentBombContext(battle, 'AAPL', Date.parse(NOW), { battleId: 'stock-battle', posKey: `${side === 'cpu' ? 'cpu' : 'player'}:star:0` });
    expect([ctx.record, ctx.stockModel]).toEqual([null, 'corrected']);
    await open(asset, ctx);
    expect(q('[data-bomb-view="state"]').dataset.bombState).toBe('preview_unavailable');
    expect(bodyText()).not.toMatch(/ATR reading \d|if it entered/);
    expect(reads().filter((p) => p.startsWith('stockTechnicalScores/'))).toEqual([]);
  });

  it("a legacy-scored battle's non-held stock keeps the screen's threshold (that scorer's number), and reads nothing", async () => {
    seed('NVDA'); scores('NVDA', 4.05);
    const battle = legacyBattle();
    const ctx = agentBombContext(battle, 'NVDA', Date.parse(NOW), { battleId: 'b' });
    expect([ctx.held, ctx.stockModel]).toEqual([false, 'legacy']);
    await open(nonHeld('NVDA', { threshold: 6.48 }), ctx);
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$319.44');
    expect(what()).not.toContain('ATR reading');
    expect(reads().filter((p) => p.startsWith('stockTechnicalScores/'))).toEqual([]);
  });

  it('a non-held crypto in a measured battle keeps the screen\'s threshold (its own scorer), and reads nothing', async () => {
    seed('ETH-USD'); scores('ETH-USD', 4.05);
    await open(nonHeld('ETH-USD', { threshold: 6.48, isCrypto: true }), agentBombContext(BATTLE, 'ETH-USD', Date.parse(NOW), { battleId: 'stock-battle' }));
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$319.44');
    expect(reads().filter((p) => p.startsWith('stockTechnicalScores/'))).toEqual([]);
  });

  it.each([
    ['a bench context (the free-agent bar)', { kind: 'bench' }],
    ['a V4 context (the BaggerBomb battle view)', { kind: 'v4', dailyLevels: { date: '2026-10-14', assets: {} } }],
  ])('%s reads nothing and keeps its own threshold', async (_, bombContext) => {
    seed('ACN'); scores('ACN', 4.05);
    await open(nonHeld('ACN', { threshold: 6.48 }), bombContext);
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$319.44');
    expect(reads().filter((p) => p.startsWith('stockTechnicalScores/'))).toEqual([]);
  });

  it('with no bombContext — how the battle screen hands Bomb mode off (review V1: the modal never reads the flag for this) — nothing is read', async () => {
    seed('ACN'); scores('ACN', 4.05);
    await open(nonHeld('ACN', { threshold: 6.48 }), undefined);
    expect(reads().filter((p) => p.startsWith('stockTechnicalScores/'))).toEqual([]);
  });

  it("review C3: a battle whose stock model cannot be read ('unavailable') is not a measured battle — its non-held stock keeps the screen's threshold and reads nothing", async () => {
    seed('ACN'); scores('ACN', 4.05);
    const battle = { ...BATTLE, scoring: { ...BATTLE.scoring, stockThresholdModel: { ...BATTLE.scoring.stockThresholdModel, modelId: 'not_a_model' } } };
    const ctx = agentBombContext(battle, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' });
    expect(ctx.stockModel).toBe('unavailable');
    await open(nonHeld('ACN', { threshold: 6.48 }), ctx);
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$319.44');
    expect(reads().filter((p) => p.startsWith('stockTechnicalScores/'))).toEqual([]);
  });
});

describe('BS-4 — the read\'s wiring in the modal (review C)', () => {
  it('C1: off the shell the read waits for the Bomb tab — a mount opening on Analysis and 1D reads nothing until 💣 Bomb is tapped, then once', async () => {
    seed('ACN'); scores('ACN', 4.05);
    await open(nonHeld('ACN', { threshold: 6.48 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }), { defaultTab: 'fundamental', defaultTimeframe: '1D' });
    expect(reads()).toEqual([]);
    const bomb = [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === '💣 Bomb');
    await act(async () => { bomb.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    expect(reads()).toEqual(['stockTechnicalScores/ACN']);
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$312.15');
  });

  it('C2: from the agent\'s held measured stock, a navigation inside the modal to a non-held peer takes the ATR arm — its reading, one read, never the thresholds request', async () => {
    seed('AAPL', 99); seed('ACN'); scores('ACN', 4.05);
    const left = enrichHeldPosition(BATTLE.portfolio.star[0], 'star', { stockBattle: BATTLE, stockSide: 'agent', stockSlot: 0 });
    const asset = buildResearchAsset(left, { livePrices: { AAPL: 101.2 }, thresholds: { AAPL: { threshold: 2.5 } }, startingPrices: { AAPL: 100.75 }, useDefaultThreshold: true });
    await open(asset, agentBombContext(BATTLE, 'AAPL', Date.parse(NOW), { battleId: 'stock-battle', positionId: 'position-agent' }));
    const tab = (label) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
    await act(async () => { tab('Ranks').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    await act(async () => { q('[data-nav-acn]').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    await act(async () => { tab('💣 Bomb').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$312.15');
    expect(reads().filter((p) => p.startsWith('stockTechnicalScores/'))).toEqual(['stockTechnicalScores/ACN']);
    expect(thresholdAsks()).toEqual([]);
  });

  it('C5: while the read is in flight the preview says the reading is loading — never that the name has none — then draws', async () => {
    seed('ACN'); scores('ACN', 4.05);
    let release; net.hold['stockTechnicalScores/ACN'] = new Promise((r) => { release = r; });
    await open(nonHeld('ACN', { threshold: 6.48 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }));
    expect(q('[data-bomb-view="state"]').dataset.bombState).toBe('atr_loading');
    expect(q('[data-bomb-view="state"]').textContent).toContain("The ATR reading or yesterday's close hasn't loaded.");
    await act(async () => { release(); }); await flush();
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$312.15');
  });

  it('refuter NEW-R2-1: a view change while a read is in flight never cancels and re-sends it — one read', async () => {
    seed('ACN'); scores('ACN', 4.05);
    let release; net.hold['stockTechnicalScores/ACN'] = new Promise((r) => { release = r; });
    await open(nonHeld('ACN', { threshold: 6.48 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }));
    const tab = (label) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
    await act(async () => { tab('Technical').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    await act(async () => { tab('💣 Bomb').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    await act(async () => { release(); }); await flush();
    expect(reads()).toEqual(['stockTechnicalScores/ACN']);
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$312.15');
  });

  it('a read that fails after the view changed under it says it failed (never stuck on loading), and the next change asks again', async () => {
    seed('ACN'); scores('ACN', 4.05);
    let reject; net.hold['stockTechnicalScores/ACN'] = new Promise((_, rj) => { reject = rj; });
    await open(nonHeld('ACN', { threshold: 6.48 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }));
    const tab = (label) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
    await act(async () => { tab('Technical').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    await act(async () => { tab('💣 Bomb').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    await act(async () => { reject(new Error('unavailable')); }); await flush();
    expect(q('[data-bomb-view="state"]').dataset.bombState).toBe('atr_failed');
    delete net.hold['stockTechnicalScores/ACN'];
    await act(async () => { tab('Technical').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    await act(async () => { tab('💣 Bomb').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$312.15');
    expect(reads()).toEqual(['stockTechnicalScores/ACN', 'stockTechnicalScores/ACN']);
  });

  it('refuter NEW-R2-2: while the retry after a failure is in flight the preview says loading, not failed', async () => {
    seed('ACN'); scores('ACN', 4.05); net.failRead = true;
    await open(nonHeld('ACN', { threshold: 6.48 }), agentBombContext(BATTLE, 'ACN', Date.parse(NOW), { battleId: 'stock-battle' }));
    expect(q('[data-bomb-view="state"]').dataset.bombState).toBe('atr_failed');
    net.failRead = false;
    let release; net.hold['stockTechnicalScores/ACN'] = new Promise((r) => { release = r; });
    const tab = (label) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
    await act(async () => { tab('Technical').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    await act(async () => { tab('💣 Bomb').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush();
    expect(q('[data-bomb-view="state"]').dataset.bombState).toBe('atr_loading');
    await act(async () => { release(); }); await flush();
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$312.15');
    expect(reads()).toEqual(['stockTechnicalScores/ACN', 'stockTechnicalScores/ACN']);
  });

  it('C6: an unranked name is read once for the modal\'s life, not on every 💣 reopen', async () => {
    flag.sheet = 'on'; seed('ZZZZ');
    const sheetContext = { battleId: 'stock-battle', agentId: 'agent', archetype: 'momentum_chaser', agentName: 'Juno', row: { held: false }, battle: BATTLE, calls: [], standing: null, directive: null };
    await open(nonHeld('ZZZZ'), agentBombContext(BATTLE, 'ZZZZ', Date.parse(NOW), { battleId: 'stock-battle' }), { sheetContext });
    const pill = async (v) => { await act(async () => { q(`[data-shell-pill="${v}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush(); };
    await pill('bomb'); await pill('analysis'); await pill('bomb');
    expect(q('[data-bomb-view="state"]').dataset.bombState).toBe('atr_unavailable');
    expect(reads().filter((p) => p.startsWith('stockTechnicalScores/'))).toEqual(['stockTechnicalScores/ZZZZ']);
  });

  it('C26: a stock changed while its read is in flight — the new stock is read and drawn, and the late answer is never shown under it', async () => {
    seed('ACN'); seed('MSFT'); scores('ACN', 4.05); scores('MSFT', 2.2);
    let release; net.hold['stockTechnicalScores/ACN'] = new Promise((r) => { release = r; });
    const show = (sym) => render(<AssetResearchModal key="one" asset={nonHeld(sym, { threshold: 6.48 })} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={301} bombContext={agentBombContext(BATTLE, sym, Date.parse(NOW), { battleId: 'stock-battle' })} />);
    await show('ACN');
    await show('MSFT');
    await act(async () => { release(); }); await flush();
    expect(reads()).toEqual(['stockTechnicalScores/ACN', 'stockTechnicalScores/MSFT']);
    // 300 × (1 + 2.2 %) = 306.60 — MSFT's own reading.
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$306.60');
    expect(what()).toContain('ATR reading 2.2%');
  });
});
