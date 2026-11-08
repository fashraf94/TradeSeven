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
const net = vi.hoisted(() => ({ calls: [], ask: null, asks: [] }));
const rec = vi.hoisted(() => ({ markers: [], lines: [] }));
const spy = vi.hoisted(() => ({ buildPacks: 0 }));
vi.mock('../Research/Sheet/packs.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, buildPacks: (...a) => { spy.buildPacks += 1; return actual.buildPacks(...a); } };
});
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['history', symbol, timeframe, opts ?? null]);
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

import { measuredSheetBattle, SHEET_NOW, RANKINGS } from '../Research/Sheet/__fixtures__/sheetBattles.js';
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
  net.calls.length = 0; net.asks.length = 0; rec.markers.length = 0; rec.lines.length = 0; spy.buildPacks = 0;
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
    expect(last.filter((m) => m.text).map((m) => m.text)).toEqual(['What it decided · Wed 12:45']);
    await click($('[data-sheet-question="protect_lead"]'));
    rec.lines.length = 0;
    await click($$('[data-pack-item]')[1]); // drawdown: a price pin at the high since entry ($104.10)
    expect(rec.lines.filter((l) => l.title).map((l) => [l.price, l.title, l.lineWidth])).toEqual([[104.1, 'from the chart, as of Wed 10/14', 2]]);
    expect(rec.markers.at(-1).filter((m) => m.text)).toEqual([]);
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
    expect($('[data-sheet-ask]').textContent).toContain('6 left');
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
  ])('a failed turn (%s) says it was not charged only when the route answered before its write', async (status, body, charged, line) => {
    net.ask = async () => ({ ok: false, status, json: async () => body });
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
