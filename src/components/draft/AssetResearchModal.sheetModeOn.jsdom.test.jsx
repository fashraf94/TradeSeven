// @vitest-environment jsdom
//
// Research Modal Build C — THE SHEET IN THE MODAL (spec §1, BC-1–BC-15): the real
// modal, the real sheet and the real StockChart (lightweight-charts recorded),
// on the real corrected-battle harness. The network is faked; the Ask's POST is
// recorded through fetchWithAuth.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.hoisted(() => { process.env.TZ = 'UTC'; });
const net = vi.hoisted(() => ({ calls: [], ask: null, asks: [], rankings: null, history: null }));
const rec = vi.hoisted(() => ({ markers: [], lines: [] }));
const spy = vi.hoisted(() => ({ buildPacks: 0 }));
vi.mock('../Research/Sheet/packs.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, buildPacks: (...a) => { spy.buildPacks += 1; return actual.buildPacks(...a); } };
});
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['history', symbol, timeframe, opts ?? null]);
    if (net.history) return net.history(timeframe);
    if (timeframe !== '1d') return Promise.resolve([]);
    return Promise.resolve([
      { date: '2026-10-14', open: 101, high: 104.1, low: 100.6, close: 103.2, volume: 1 },
      { date: '2026-10-13', open: 99.4, high: 101.2, low: 99, close: 100.9, volume: 1 },
      { date: '2026-10-12', open: 98.8, high: 99.9, low: 98.1, close: 99.3, volume: 1 },
    ]);
  },
  getStockPrice: (symbol) => { net.calls.push(['quote', symbol]); return Promise.resolve({ symbol, price: 0 }); },
}));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: (s) => { net.calls.push(['profile', s]); return Promise.resolve({ Name: 'Apple Inc', sector: 'Technology', industry: 'Consumer Electronics', description: 'Apple makes phones.', ratingText: 'Buy', analystConsensus: { totalAnalysts: 41 } }); } }));
vi.mock('../../services/volatilityService', () => ({ getVolatilityThresholds: () => Promise.resolve({}) }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../../utils/fetchWithAuth', () => ({
  fetchWithAuth: async (u, o) => {
    net.calls.push(['fetchWithAuth', String(u), o?.method ?? null]);
    if (String(u) !== '/api/agent/chat') return { ok: true, status: 200, json: async () => ({ success: true }) };
    net.asks.push(JSON.parse(o.body));
    return net.ask();
  },
}));
vi.mock('lightweight-charts', () => {
  const series = () => ({
    setData() {}, createPriceLine(o) { rec.lines.push(o); return o; }, removePriceLine() {}, setMarkers() { throw new Error('v5 has no setMarkers'); },
    priceScale() { return { applyOptions() {} }; }, applyOptions() {},
  });
  return {
    createChart: () => ({ addSeries: () => series(), removeSeries() {}, subscribeCrosshairMove() {}, timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; } }; }, applyOptions() {}, remove() {} }),
    createSeriesMarkers: (s, m) => { rec.markers.push(m); return { setMarkers(x) { rec.markers.push(x); }, detach() {} }; },
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
vi.mock('../Research/TechnicalTabV2', () => ({ default: () => null }));
vi.mock('./CompeteTab', () => ({ default: () => null }));
vi.mock('./SectorTab', () => ({ default: () => null }));
vi.mock('../Research/SmartMoneyTab', () => ({ default: () => null }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));
// The rankings read (useSheetView readRankings) — counted, and resolved when the row says so.
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal()),
  doc: (_db, ...path) => ({ path: path.join('/') }),
  getDoc: (ref) => { net.calls.push(['getDoc', ref.path]); return net.rankings ? net.rankings() : Promise.resolve({ exists: () => false, data: () => null }); },
}));

import { measuredSheetBattle, SHEET_NOW, RANKINGS } from '../Research/Sheet/__fixtures__/sheetBattles.js';
import { selectBombRecord, agentBombContext } from '../Research/BombMode/selectBombRecord.js';
import { enrichHeldPosition } from '../../screens/AgentBattleScreen.jsx';
import { buildResearchAsset } from '../../utils/researchAssetBuilder.js';
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
  net.calls.length = 0; net.asks.length = 0; rec.markers.length = 0; rec.lines.length = 0; spy.buildPacks = 0; net.rankings = null; net.history = null;
  Element.prototype.scrollIntoView = vi.fn();
  net.ask = async () => ({ ok: true, status: 200, json: async () => ({ agentMessage: 'Item 1 carries it.', exchangeId: 'ex-1', hasDirective: false, directive: null }) });
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };
const $ = (sel) => document.body.querySelector(sel);
const $$ = (sel) => [...document.body.querySelectorAll(sel)];
const click = async (el) => { expect(el).toBeTruthy(); await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); await flush(); };

const asset = (battle = BATTLE, symbol = 'AAPL') => {
  const pos = battle.portfolio.star[0];
  const left = symbol === 'AAPL' ? enrichHeldPosition(pos, 'star', { stockBattle: battle, stockSide: 'agent', stockSlot: 0 }) : { symbol, name: symbol };
  return buildResearchAsset(left, { livePrices: { [symbol]: 103.2 }, thresholds: { [symbol]: { threshold: 2.5 } }, startingPrices: { AAPL: 100.75 }, useDefaultThreshold: true });
};
const ctx = (over = {}) => ({ battleId: 'stock-battle', agentId: 'agent', archetype: 'momentum_chaser', agentName: 'Juno', row: { held: false, positionId: 'position-agent' }, battle: BATTLE, calls: [], rankings: RANKINGS, standing: { player: 62, opponent: 68, digits: 0 }, directive: BATTLE.directive, ...over });
const open = async ({ context = ctx(), symbol = 'AAPL', battle } = {}) => {
  await act(async () => { root.render(<AssetResearchModal asset={asset(battle, symbol)} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={103.2} sheetContext={context} />); });
  await flush();
};
const rerender = async (context, symbol = 'AAPL') => {
  await act(async () => { root.render(<AssetResearchModal asset={asset(context.battle, symbol)} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={103.2} sheetContext={context} />); });
  await flush();
};

describe('BC-1 — the mount opens on the sheet: the Analysis tab, 1D, the archetype speaking', () => {
  it('Layer 0 on open, the 1D series requested (never the 30-minute bomb series), no Haiku preset questions', async () => {
    await open();
    expect($('[data-sheet-root]')?.dataset.sheetLayer).toBe('0');
    expect(net.calls.filter((c) => c[0] === 'history').map((c) => c[2])).not.toContain('30m');
    expect(net.calls.filter((c) => c[0] === 'history').map((c) => c[2])).toContain('1d');
    const text = document.body.textContent;
    expect(text).not.toContain('What does this company do?');
    expect(net.calls.some((c) => c[1] === '/api/ai-advisor')).toBe(false);
    expect($('[data-sheet-stance]').dataset.sheetStance).toBe('held_measured');
    expect($('[data-sheet-stance]').textContent).toContain('Holding since Wed 10/14');
    expect($('[data-sheet-stance]').textContent).toContain('entry $100.75 · +2.4%');
    expect($('[data-sheet-stance]').textContent).toContain('+15 banked');
    expect($('[data-sheet-voice]').dataset.sheetVoice).toBe('rationale');
    expect($('[data-sheet-voice-line]').textContent).toBe('“AAPL is still printing higher lows above VWAP, so the trend is intact and the position stays.”');
    expect($('[data-sheet-voice]').textContent).toContain('Trend Follower · Wed 12:45');
    expect($$('[data-sheet-question]').map((b) => b.dataset.sheetQuestion)).toEqual(['catch_up', 'protect_lead', 'better_than_stalled']);
    expect($('[data-sheet-tucked]').textContent).toContain('Wall St: Buy · 41 analysts');
    expect($('[data-sheet-ask]').dataset.sheetAsk).toBe('disabled');
    expect($('[data-sheet-ask]').textContent).toBe('Ask Trend Follower · pick a question first');
  });
  it('the About chip opens the profile the modal already fetched — no second request', async () => {
    await open();
    const profiles = net.calls.filter((c) => c[0] === 'profile').length;
    await click($('[data-sheet-about]'));
    expect($('[data-sheet-about-body]').textContent).toContain('Apple makes phones.');
    expect(net.calls.filter((c) => c[0] === 'profile').length).toBe(profiles);
  });
});

describe('Founder rulings 2026-11-08 on screen — an exit flag (FQ-5) and a name looked at, not held (FQ-2)', () => {
  it('"What it flagged · exit · Wed 12:45", the flag in its own words, and the stance "Looked at Wed 12:45 · not held now"', async () => {
    const b = JSON.parse(JSON.stringify(BATTLE));
    b.evaluations[1].candidates.push({ symbol: 'XOM', direction: 'potential_exit', signalSummary: 'Exit: lost VWAP twice.' });
    await open({ context: ctx({ battle: b, row: { held: false } }), symbol: 'XOM', battle: b });
    expect($('[data-sheet-voice]').dataset.sheetVoice).toBe('exit');
    const eyebrow = $('[data-sheet-voice]').firstElementChild.textContent;
    expect(eyebrow).toContain('What it flagged · exit · Wed 12:45');
    expect(eyebrow).not.toContain('Trend Follower ·');
    expect($('[data-sheet-voice-line]').textContent).toBe('“Exit: lost VWAP twice.”');
    expect($('[data-sheet-stance]').dataset.sheetStance).toBe('looked');
    expect($('[data-sheet-stance]').textContent).toContain('Looked at Wed 12:45 · not held now');
  });
});

describe('FQ-9 (2026-11-08) — with Bomb mode on, a measured held stock in the red zone at OPEN opens on 💣', () => {
  const bombCtx = () => agentBombContext(BATTLE, 'AAPL', SHEET_NOW, { battleId: 'stock-battle', positionId: 'position-agent' });
  const show = async ({ wsPrice, theAsset = asset(), controlledQuote } = {}) => {
    await act(async () => {
      root.render(<AssetResearchModal asset={theAsset} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb"
        {...(wsPrice !== undefined ? { wsPrice } : {})} {...(controlledQuote ? { controlledQuote } : {})} sheetContext={ctx()} bombContext={bombCtx()} />);
    });
    await flush();
  };
  const series = () => net.calls.filter((c) => c[0] === 'history').map((c) => c[2]);
  it('inside the band ($103.40: 0.36 % to +30) → the 💣 view and the Bomb tab, not the sheet', async () => {
    await show({ wsPrice: 103.4 });
    expect($('[data-sheet-root]')).toBeNull();
    expect($('[data-bomb-sheet]')).toBeTruthy();
    expect(series()).toContain('30m');
  });
  it('outside the band ($103.20: 0.55 %) → the sheet, on 1D', async () => {
    await show({ wsPrice: 103.2 });
    expect($('[data-sheet-root]')).toBeTruthy();
    expect(series()).not.toContain('30m');
  });
  it('the held mount decides from ITS controlled quote, never the asset\'s own price (the two disagree here, both ways)', async () => {
    await show({ theAsset: { ...asset(), price: 103.2, currentPrice: 103.2 }, controlledQuote: { posKey: 'player:star:0', symbol: 'AAPL', price: 103.4, extremes: null } });
    expect($('[data-sheet-root]')).toBeNull();
    expect($('[data-bomb-sheet]')).toBeTruthy();
    act(() => root.unmount());
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    await show({ theAsset: { ...asset(), price: 103.4, currentPrice: 103.4 }, controlledQuote: { posKey: 'player:star:0', symbol: 'AAPL', price: 103.2, extremes: null } });
    expect($('[data-sheet-root]')).toBeTruthy();
  });
  it('no price yet → the sheet', async () => {
    await show({ theAsset: { ...asset(), price: 0, currentPrice: 0 } });
    expect($('[data-sheet-root]')).toBeTruthy();
  });
  it('decided ONCE at open: a price that moves into the band after open never switches the sheet away …', async () => {
    await show({ wsPrice: 103.2 });
    expect($('[data-sheet-root]')).toBeTruthy();
    await show({ wsPrice: 103.4 });
    expect($('[data-sheet-root]')).toBeTruthy();
    expect(series()).not.toContain('30m');
  });
  it('… and one that leaves the band never switches the 💣 view to the sheet', async () => {
    await show({ wsPrice: 103.4 });
    expect($('[data-sheet-root]')).toBeNull();
    await show({ wsPrice: 103.2 });
    expect($('[data-sheet-root]')).toBeNull();
    expect($('[data-bomb-sheet]')).toBeTruthy();
  });
});

describe('FQ-6 (2026-11-08) — on a phone, sheet mode sizes the modal from the visible viewport', () => {
  const realWidth = window.innerWidth;
  const realCSS = globalThis.CSS;
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: realWidth, configurable: true, writable: true });
    if (realCSS === undefined) delete globalThis.CSS; else globalThis.CSS = realCSS;
  });
  const modalBox = () => [...document.body.querySelectorAll('div')].find((d) => d.style.width === '100vw');
  it('100dvh where the browser has it; 100vh where it does not; mode off keeps 100vh', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true, writable: true });
    globalThis.CSS = { supports: (p, v) => p === 'height' && v === '100dvh' };
    await open();
    expect(modalBox()?.style.height).toBe('100dvh');
    act(() => root.unmount());
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root.render(<AssetResearchModal asset={asset()} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="fundamental" wsPrice={103.2} />); });
    await flush();
    expect(modalBox()?.style.height).toBe('100vh');
    act(() => root.unmount());
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    globalThis.CSS = { supports: () => false };
    await open();
    expect(modalBox()?.style.height).toBe('100vh');
  });
});

describe('BC-13 — the questions in the standing the header shows', () => {
  it('leading → protect the lead first', async () => {
    await open({ context: ctx({ standing: { player: 70, opponent: 64, digits: 0 } }) });
    expect($$('[data-sheet-question]').map((b) => b.dataset.sheetQuestion)).toEqual(['protect_lead', 'catch_up', 'better_than_stalled']);
  });
  it('unavailable (the gated header shows no pair) → the design\'s order', async () => {
    await open({ context: ctx({ standing: null }) });
    expect($$('[data-sheet-question]').map((b) => b.dataset.sheetQuestion)).toEqual(['catch_up', 'protect_lead', 'better_than_stalled']);
  });
});

describe('Layer 1 — a question opens its pack, free', () => {
  it('tapping a question shows the archetype-ordered pack, labelled, and sends nothing', async () => {
    await open();
    await click($('[data-sheet-question="protect_lead"]'));
    expect($('[data-sheet-root]').dataset.sheetLayer).toBe('1');
    expect($$('[data-pack-item]').map((b) => b.dataset.packItem)).toEqual(['banked', 'drawdown', 'risk_lever', 'idea', 'told_it']);
    expect($('[data-sheet-weighs]').textContent).toBe('What Trend Follower weighs');
    expect(net.calls.some((c) => c[1] === '/api/agent/chat')).toBe(false);
    expect($('[data-sheet-ask]').textContent).toBe('Ask Trend Follower: does this protect the lead?· 1 message · 7 left');
  });
});

describe('BC-8 — the record on the chart, one label open', () => {
  it('markers through createSeriesMarkers; the latest pin open; a tapped item moves the open label; a price item lights its line', async () => {
    await open();
    const last = rec.markers.at(-1);
    expect(last.length).toBeGreaterThan(0);
    // Dots on the canvas; the one open label is the caption over the chart (review D6).
    expect(last.filter((m) => m.text)).toEqual([]);
    expect($('[data-pin-caption]').textContent.trim()).toBe('● What it decided · Wed 12:45');
    await click($('[data-sheet-question="protect_lead"]'));
    rec.lines.length = 0;
    await click($$('[data-pack-item]')[1]); // drawdown: a price pin at the high ($104.10)
    // Its own line, named for what the price IS — never the item's source label (review D5b).
    expect(rec.lines.filter((l) => l.title).map((l) => [l.price, l.title, l.lineWidth, l.axisLabelVisible])).toEqual([[104.1, 'the high · $104.10', 2, true]]);
    expect($('[data-pin-caption]')).toBeNull();
  });
  it('a tapped item with a time pin opens the record marker AT that instant — the entry, never the check later that day (review D5a)', async () => {
    await open();
    await click($('[data-sheet-question="catch_up"]'));
    const i = $$('[data-pack-item]').findIndex((b) => b.dataset.packItem === 'move_since_entry');
    expect(i).toBeGreaterThanOrEqual(0);
    await click($$('[data-pack-item]')[i]);
    expect($('[data-pin-caption]').dataset.pinCaption).toBe('entry');
    expect($('[data-pin-caption]').textContent.trim()).toMatch(/^● Entry · Wed /);
  });
  it('a tapped rung item draws its own line "next rung · $…", never "live price vs …" (review D5b, A9)', async () => {
    await open();
    await click($('[data-sheet-question="catch_up"]'));
    rec.lines.length = 0;
    await click($('[data-pack-item="rung_distance"]'));
    const titled = rec.lines.filter((l) => l.title);
    expect(titled).toHaveLength(1);
    expect(titled[0].title).toMatch(/^next rung · \$\d/);
    expect($('[data-pack-item="rung_distance"]').textContent).toContain('live price vs the next rung');
  });
  it('"● on the chart" only where the pin is drawn: a time pin is not on 1W (review D12)', async () => {
    await open();
    await click($('[data-sheet-question="catch_up"]'));
    expect($('[data-pack-item="move_since_entry"]').textContent).toContain('● on the chart');
    const w = $$('button').find((b) => b.textContent.trim() === '1W');
    await click(w);
    expect($('[data-pack-item="move_since_entry"]').textContent).not.toContain('● on the chart');
    expect($('[data-pack-item="rung_distance"]').textContent).toContain('● on the chart');
  });
});

describe('BC-7 — the Ask', () => {
  it('one POST: the question as the message, the pack as researchAsk; the reply renders; the chip lights only when the battle holds the id', async () => {
    await open();
    await click($('[data-sheet-question="protect_lead"]'));
    await click($('[data-sheet-ask]'));
    expect(net.asks).toHaveLength(1);
    const body = net.asks[0];
    expect(body.message).toBe('Does this protect the lead? — AAPL');
    expect(body.agentId).toBe('agent');
    expect(body.battleId).toBe('stock-battle');
    expect(body.researchAsk.symbol).toBe('AAPL');
    expect(body.researchAsk.questionId).toBe('protect_lead');
    expect(body.researchAsk.items.map((i) => i.kind)).toEqual(['banked', 'drawdown', 'risk_lever', 'idea', 'told_it']);
    expect(body.researchAsk.items.length).toBeLessThanOrEqual(5);
    expect($('[data-sheet-reply]').dataset.sheetReply).toBe('answered');
    expect($('[data-sheet-reply-text]').textContent).toBe('Item 1 carries it.');
    expect($('[data-sheet-filed]').dataset.sheetFiled).toBe('0');
    await rerender(ctx({ battle: { ...BATTLE, chatExchanges: [{ exchangeId: 'other' }] } }));
    expect($('[data-sheet-filed]').dataset.sheetFiled).toBe('0');
    await rerender(ctx({ battle: { ...BATTLE, chatBudgetUsed: 4, chatExchanges: [{ exchangeId: 'ex-1' }] } }));
    expect($('[data-sheet-filed]').dataset.sheetFiled).toBe('1');
    expect($('[data-sheet-filed]').textContent).toBe('✓ filed to chat');
    // The answered question is not offered again for another message (review D1)…
    expect($('[data-sheet-ask]').dataset.sheetAsk).toBe('asked');
    expect($('[data-sheet-ask]').disabled).toBe(true);
    expect($('[data-sheet-ask]').textContent).toBe('Asked Trend Follower · the answer is below');
    await click($('[data-sheet-ask]'));
    expect(net.asks).toHaveLength(1);
    // …and another question can be asked, from the new count.
    await click($('[data-sheet-or-ask] [data-sheet-question="catch_up"]'));
    expect($('[data-sheet-ask]').dataset.sheetAsk).toBe('ready');
    expect($('[data-sheet-ask]').textContent).toContain('6 left');
  });
  it('the reply card is brought into the drawer\'s view on sending and on the answer (review D1)', async () => {
    await open();
    await click($('[data-sheet-question="protect_lead"]'));
    await click($('[data-sheet-ask]'));
    const calls = Element.prototype.scrollIntoView.mock.instances;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls.at(-1).hasAttribute('data-sheet-reply-slot')).toBe(true);
    expect(Element.prototype.scrollIntoView.mock.calls.at(-1)[0]).toEqual({ block: 'nearest' });
  });
  it('the answer shows ONLY under the question it answered (review B5)', async () => {
    await open();
    await click($('[data-sheet-question="protect_lead"]'));
    await click($('[data-sheet-ask]'));
    expect($('[data-sheet-reply]').dataset.sheetReply).toBe('answered');
    await click($('[data-sheet-or-ask] [data-sheet-question="catch_up"]'));
    expect($('[data-sheet-pack]').dataset.sheetPack).toBe('catch_up');
    expect($('[data-sheet-reply]')).toBeNull();
    expect($('[data-sheet-pack]').textContent).toContain('free · no message spent');
    await click($('[data-sheet-or-ask] [data-sheet-question="protect_lead"]'));
    expect($('[data-sheet-reply]').dataset.sheetReply).toBe('answered');
  });
  it('a double tap sends ONE POST (one Ask in flight per stock)', async () => {
    let resolve;
    net.ask = () => new Promise((r) => { resolve = r; });
    await open();
    await click($('[data-sheet-question="protect_lead"]'));
    const btn = $('[data-sheet-ask]');
    await act(async () => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flush();
    expect(net.asks).toHaveLength(1);
    await act(async () => { resolve({ ok: true, status: 200, json: async () => ({ agentMessage: 'Late.', exchangeId: 'ex-9' }) }); });
    await flush();
  });
  it('a late answer for one stock never re-opens another stock\'s Ask while that one is in flight (review B6)', async () => {
    const pending = [];
    net.ask = () => new Promise((r) => { pending.push(r); });
    await open();
    await click($('[data-sheet-question="protect_lead"]'));
    await click($('[data-sheet-ask]'));
    expect(net.asks.map((b) => b.researchAsk.symbol)).toEqual(['AAPL']);
    await rerender(ctx({ row: { held: false } }), 'NVDA');
    await click($('[data-sheet-question="catch_up"]'));
    await click($('[data-sheet-ask]'));
    expect(net.asks.map((b) => b.researchAsk.symbol)).toEqual(['AAPL', 'NVDA']);
    expect($('[data-sheet-ask]').disabled).toBe(true);
    await act(async () => { pending[0]({ ok: true, status: 200, json: async () => ({ agentMessage: 'For AAPL.', exchangeId: 'ex-a' }) }); });
    await flush();
    expect($('[data-sheet-ask]').disabled).toBe(true);
    await click($('[data-sheet-ask]'));
    expect(net.asks).toHaveLength(2);
    expect($('[data-sheet-reply]').dataset.sheetReply).toBe('sending');
    await act(async () => { pending[1]({ ok: true, status: 200, json: async () => ({ agentMessage: 'For NVDA.', exchangeId: 'ex-n' }) }); });
    await flush();
    expect($('[data-sheet-reply-text]').textContent).toBe('For NVDA.');
  });
  it('a filed directive is said, with its text', async () => {
    net.ask = async () => ({ ok: true, status: 200, json: async () => ({ agentMessage: 'Holding it.', exchangeId: 'ex-2', hasDirective: true, directive: { text: 'Hold AAPL through the close' } }) });
    await open();
    await click($('[data-sheet-question="protect_lead"]'));
    await click($('[data-sheet-ask]'));
    expect($('[data-sheet-directive]').textContent).toBe('It filed an instruction: “Hold AAPL through the close”');
  });
  it('no messages left: the Ask is disabled, says so, and sends nothing', async () => {
    await open({ context: ctx({ battle: { ...BATTLE, chatBudgetUsed: 10 } }) });
    await click($('[data-sheet-question="protect_lead"]'));
    expect($('[data-sheet-ask]').dataset.sheetAsk).toBe('out');
    expect($('[data-sheet-ask]').disabled).toBe(true);
    expect($('[data-sheet-ask]').textContent).toBe('No messages left this game');
    await click($('[data-sheet-ask]'));
    expect(net.asks).toHaveLength(0);
  });
  it.each([
    [502, { error: 'gemma_invalid_shape' }, 'none', 'Trend Follower didn’t answer. No message was used.'],
    [504, { error: 'timeout' }, 'none', 'Trend Follower didn’t answer. No message was used.'],
    [403, { error: 'chat_budget_exceeded' }, 'none', 'No messages left this game. No message was used.'],
    [400, { error: 'research_ask_battle_only' }, 'none', 'This game isn’t taking questions now. No message was used.'],
    [500, { error: 'Agent unavailable.' }, 'unknown', 'Something went wrong. Check chat before asking again — a message may have been used.'],
    [403, { error: 'research_ask_off' }, 'none', 'This game isn’t taking questions now. No message was used.'],
    // A platform gateway answer (no JSON from the route — a kill after the write): never "not charged" (review B7).
    [504, undefined, 'unknown', 'Something went wrong. Check chat before asking again — a message may have been used.'],
    [502, undefined, 'unknown', 'Something went wrong. Check chat before asking again — a message may have been used.'],
  ])('a failed turn (%s) says it was not charged only when the route answered before its write', async (status, body, charged, line) => {
    net.ask = async () => ({ ok: false, status, json: async () => { if (body === undefined) throw new SyntaxError('Unexpected token < in JSON'); return body; } });
    await open();
    await click($('[data-sheet-question="protect_lead"]'));
    await click($('[data-sheet-ask]'));
    expect($('[data-sheet-reply]').dataset.sheetReply).toBe('failed');
    expect($('[data-sheet-reply]').dataset.sheetCharged).toBe(charged);
    expect($('[data-sheet-reply]').textContent).toBe(line);
  });
  it('no answer at all (the request never came back): unknown, never "not charged"', async () => {
    net.ask = async () => { throw new Error('network down'); };
    await open();
    await click($('[data-sheet-question="protect_lead"]'));
    await click($('[data-sheet-ask]'));
    expect($('[data-sheet-reply]').dataset.sheetCharged).toBe('unknown');
  });
});

describe('BC-11, BC-12 — the cockpit door', () => {
  it('with an incumbent the sheet opens on "Is this better than what\'s stalled?" with it side by side', async () => {
    await open({ context: ctx({ incumbent: 'ETH', row: { held: false, positionId: null } }), symbol: 'NVDA' });
    expect($('[data-sheet-root]').dataset.sheetLayer).toBe('1');
    expect($('[data-sheet-pack]').dataset.sheetPack).toBe('better_than_stalled');
    expect($$('[data-pack-item]').map((b) => b.dataset.packItem)).toContain('incumbent');
    expect($('[data-pack-item="rank_scores"]').textContent).toContain('NVDA 89 · ETH 52');
  });
  it('→ Cockpit shows only when the screen hands the door, and opens it', async () => {
    await open();
    expect($('[data-sheet-cockpit]')).toBeNull();
    const onOpenCockpit = vi.fn();
    await rerender(ctx({ onOpenCockpit }));
    await click($('[data-sheet-cockpit]'));
    expect(onOpenCockpit).toHaveBeenCalledTimes(1);
  });
});

describe('the drawer never opens low and jumps: the chart\'s skeleton and error box are the whole sheet chart — its 44 px control row and its plot (review D7)', () => {
  const chartBoxHeight = () => [...document.body.querySelectorAll('div')].find((d) => d.style.position === 'relative' && /px$/.test(d.style.height) && d.parentElement?.style.background)?.style.height;
  it('while the series loads, and when it fails, the box is the height the chart will take', async () => {
    await open();
    const loaded = chartBoxHeight();
    expect(loaded).toMatch(/^\d+px$/);
    act(() => root.unmount());
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    net.history = () => new Promise(() => {});
    await open();
    const skeleton = [...document.body.querySelectorAll('div')].find((d) => /shimmer/.test(d.style.animation))?.parentElement;
    const whole = `${parseInt(loaded, 10) + 44}px`;
    expect(skeleton?.style.height).toBe(whole);
    act(() => root.unmount());
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    net.history = () => Promise.reject(new Error('down'));
    await open();
    const failed = [...document.body.querySelectorAll('span')].find((s) => s.textContent === 'Chart data unavailable')?.parentElement;
    expect(failed?.style.height).toBe(whole);
  });
});

describe('Bomb mode with the sheet on: the 💣 view keeps its full height (review D2)', () => {
  const boxHeight = () => Number(([...document.body.querySelectorAll('div')].find((d) => d.style.position === 'relative' && /px$/.test(d.style.height) && d.parentElement?.style.background)
    ?? [...document.body.querySelectorAll('div')].find((d) => /shimmer/.test(d.style.animation))?.parentElement)?.style.height.replace('px', ''));
  const bar = (iso, o, hi, lo, c) => ({ date: iso, datetime: iso, timestamp: Math.floor(Date.parse(iso) / 1000), open: o, high: hi, low: lo, close: c, volume: 100 });
  const DAILY = [
    { date: '2026-10-14', open: 101, high: 104.1, low: 100.6, close: 103.2, volume: 1 },
    { date: '2026-10-13', open: 99.4, high: 101.2, low: 99, close: 100.9, volume: 1 },
  ];
  const THIRTY = [bar('2026-10-14T16:30:00.000Z', 103, 103.5, 102.9, 103.2), bar('2026-10-14T16:00:00.000Z', 102.5, 103.1, 102.4, 103), bar('2026-10-14T13:30:00.000Z', 101, 101.4, 100.6, 101.2)];
  it('1D at the sheet\'s height; 💣 at the modal\'s full chart height (the Fuse is never cut under the drawer)', async () => {
    net.history = (tf) => Promise.resolve(tf === '1d' ? DAILY : tf === '30m' ? THIRTY : []);
    await act(async () => { root.render(<AssetResearchModal asset={asset()} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={103.2} sheetContext={ctx()} bombContext={{ kind: 'agent', battleId: 'stock-battle', held: true, record: selectBombRecord(BATTLE, 'AAPL', SHEET_NOW) }} />); });
    await flush();
    const day = boxHeight();
    const bomb = $$('button').find((b) => b.textContent === '\uD83D\uDCA3');
    expect(bomb).toBeTruthy();
    await click(bomb);
    const fuse = boxHeight();
    // (jsdom lays out no container, so the modal's full chart height computes to 0 here; the sheet's floor is 180.)
    expect(fuse).not.toBe(day);
    act(() => root.unmount());
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root.render(<AssetResearchModal asset={asset()} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={103.2} bombContext={{ kind: 'agent', battleId: 'stock-battle', held: true, record: selectBombRecord(BATTLE, 'AAPL', SHEET_NOW) }} />); });
    await flush();
    expect(fuse).toBe(boxHeight()); // the same height the 💣 view has with the sheet off
  });
});

describe('an ended battle takes no Ask (review C7 — CU2)', () => {
  it('status completed: the Ask is disabled and sends nothing', async () => {
    await open({ context: ctx({ battle: { ...BATTLE, status: 'completed' } }) });
    await click($('[data-sheet-question="protect_lead"]'));
    expect($('[data-sheet-ask]').disabled).toBe(true);
    await click($('[data-sheet-ask]'));
    expect(net.asks).toHaveLength(0);
  });
});

describe('Layer 0 keeps the fold with a long sentence and a long name (review D3)', () => {
  it('the quoted sentence shows two lines until tapped; the eyebrow and the name tag ellipsize, never widen the drawer', async () => {
    await open();
    const line = $('[data-sheet-voice-line]');
    expect(line.style.webkitLineClamp || line.style.WebkitLineClamp).toBe('2');
    expect(line.getAttribute('aria-expanded')).toBe('false');
    await click(line);
    expect($('[data-sheet-voice-line]').getAttribute('aria-expanded')).toBe('true');
    expect($('[data-sheet-voice-line]').style.webkitLineClamp || '').toBe('');
    const tag = $('[data-sheet-agent-tag]');
    expect([tag.style.whiteSpace, tag.style.textOverflow, tag.style.minWidth]).toEqual(['nowrap', 'ellipsis', '0px']);
    expect(tag.parentElement.style.minWidth).toBe('0px');
  });
});

describe('§3: no new price request — the sheet reads what the modal already loads', () => {
  const tally = () => {
    const by = (k) => net.calls.filter((c) => c[0] === k).length;
    return { quote: by('quote'), history1d: net.calls.filter((c) => c[0] === 'history' && c[2] === '1d').length, historyOther: net.calls.filter((c) => c[0] === 'history' && c[2] !== '1d').length, profile: by('profile'), fetchWithAuth: by('fetchWithAuth'), getDoc: by('getDoc') };
  };
  it('sheet on vs off on the same 1D view: the same quote, series and profile requests; nothing more until the player opens a question or asks', async () => {
    await act(async () => { root.render(<AssetResearchModal asset={asset()} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="fundamental" defaultTimeframe="1D" wsPrice={103.2} />); });
    await flush();
    const off = tally();
    act(() => root.unmount());
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    net.calls.length = 0;
    await open({ context: ctx({ rankings: undefined }) });
    const on = tally();
    expect(on).toEqual(off);
    expect(on.fetchWithAuth).toBe(0);
    expect(on.getDoc).toBe(0);
    // Opening the stalled question: ONE document read (the rankings), no price request.
    await click($('[data-sheet-question="better_than_stalled"]'));
    expect(tally()).toEqual({ ...on, getDoc: 1 });
    // The Ask: ONE POST, no price request.
    await click($('[data-sheet-ask]'));
    expect(tally()).toEqual({ ...on, getDoc: 1, fetchWithAuth: 1 });
  });
});

describe('the rankings: one read for the modal\'s life (review N2)', () => {
  it('leaving the stalled question before the read lands keeps it; coming back reads nothing more', async () => {
    let land;
    net.rankings = () => new Promise((r) => { land = r; });
    await open({ context: ctx({ rankings: undefined }) });
    await click($('[data-sheet-question="better_than_stalled"]'));
    expect(net.calls.filter((c) => c[0] === 'getDoc')).toEqual([['getDoc', 'indexIntelligence/stockRankings']]);
    await click($('[data-sheet-back]'));
    await act(async () => { land({ exists: () => true, data: () => RANKINGS }); });
    await flush();
    await click($('[data-sheet-question="better_than_stalled"]'));
    expect(net.calls.filter((c) => c[0] === 'getDoc')).toHaveLength(1);
    expect($('[data-pack-item="rank_scores"]')).toBeTruthy();
  });
});

describe('mode off: the builder is never called', () => {
  it('no sheetContext → no pack built, the Analysis tab is today\'s', async () => {
    await act(async () => { root.render(<AssetResearchModal asset={asset()} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="fundamental" wsPrice={103.2} />); });
    await flush();
    expect(spy.buildPacks).toBe(0);
    expect($('[data-sheet-root]')).toBeNull();
    expect(document.body.textContent).toContain('What does this company do?');
    expect(rec.markers).toEqual([]);
  });
});
