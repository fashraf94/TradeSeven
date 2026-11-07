// @vitest-environment jsdom
//
// Research Modal Build A — THE MODAL WITH BOMB MODE ON (spec §4.2–§4.4, §6
// "Mounts", "Red zone", "Honesty"). REAL: AssetResearchModal, useResearchData,
// StockChart, AnalysisDrawer, the BombMode views, the selector and the ladder,
// on the corrected-battle harness. Mocked: the network (recorded — the
// call-count rows), lightweight-charts (recorded — no candle in Bomb mode),
// the unrelated tabs. RESEARCH_MODAL_BOMB_MODE is a mutable mock.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.hoisted(() => { process.env.TZ = 'UTC'; });
const flag = vi.hoisted(() => ({ mode: 'on' }));
vi.mock('../../config/researchModalFlags.js', () => ({ get RESEARCH_MODAL_BOMB_MODE() { return flag.mode; }, RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']) }));
const net = vi.hoisted(() => ({ daily: {}, intraday: {}, minute: {}, calls: [], thresholds: {} }));
const rec = vi.hoisted(() => ({ calls: [] }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['history', symbol, timeframe, opts ?? null]);
    const src = timeframe === '1d' ? net.daily : timeframe === '30m' ? net.intraday : timeframe === '1m' ? net.minute : {};
    return Promise.resolve(src[symbol] ?? []);
  },
  getStockPrice: (symbol) => { net.calls.push(['quote', symbol]); return Promise.resolve({ symbol, price: 0 }); },
}));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: (s) => { net.calls.push(['profile', s]); return Promise.resolve(null); } }));
vi.mock('../../services/volatilityService', () => ({ getVolatilityThresholds: (syms, kind) => { net.calls.push(['thresholds', syms, kind]); return Promise.resolve(net.thresholds); } }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: () => Promise.resolve({ json: async () => ({ success: true, data: {} }) }) }));
vi.mock('../../services/marketSchedule', async (orig) => ({ ...(await orig()) }));
vi.mock('lightweight-charts', () => {
  const series = (kind) => ({ setData(d) { rec.calls.push(['setData', kind, d.length, d.length ? d[d.length - 1] : null]); }, createPriceLine(o) { rec.calls.push(['priceLine', o.title]); return { applyOptions() {} }; }, removePriceLine() {}, setMarkers() {}, priceScale() { return { applyOptions() {} }; }, applyOptions() {} });
  return {
    createChart: () => { rec.calls.push(['createChart']); return { addSeries: (k) => series(k), removeSeries() {}, subscribeCrosshairMove() {}, timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; } }; }, applyOptions() {}, remove() {} }; },
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
vi.mock('../Research/AnalysisQATab', () => ({ default: () => null }));
vi.mock('../Research/TechnicalTabV2', () => ({ default: () => null }));
vi.mock('../Research/HealthTab', () => ({ default: () => null }));
vi.mock('./ResearchTabs/TechnicalAnalysisTab', () => ({ default: () => null }));
vi.mock('./SectorTab', () => ({ default: () => null }));
vi.mock('./CompeteTab', () => ({ default: () => null }));
vi.mock('../Research/MarketContextTab', () => ({ default: () => null }));
vi.mock('../Research/HoldingsTab', () => ({ default: () => null }));
vi.mock('../Research/SectorETFRanksTab', () => ({ default: () => null }));
vi.mock('../Research/SmartMoneyTab', () => ({ default: () => null }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));

import { STOCK_TEST_NOW, correctedStockBattle, stockWriterDb } from '../../../api/_utils/__fixtures__/stockThresholdHarness.js';
import { correctedScorePatch, scoreCorrectedPosition } from '../../../api/_utils/stockThresholdAdmission.js';
import { enrichHeldPosition } from '../../screens/AgentBattleScreen.jsx';
import { buildResearchAsset } from '../../utils/researchAssetBuilder.js';
import { selectBombRecord } from '../Research/BombMode/selectBombRecord.js';
import { legacyBattle } from '../Research/BombMode/__fixtures__/bombBattles.js';
import { BANKED_MOMENT_MS } from '../Research/BombMode/useBombView.js';
import AssetResearchModal from './AssetResearchModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
const oldKey = process.env.EODHD_API_KEY;
beforeAll(() => { process.env.EODHD_API_KEY = 'isolated-key'; });
afterAll(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; });
let container, root;
beforeEach(() => {
  flag.mode = 'on';
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  net.calls.length = 0; rec.calls.length = 0; net.thresholds = {};
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };
const render = async (el) => { await act(async () => { root.render(el); }); await flush(); };
const q = (sel) => document.body.querySelector(sel);
const text = () => document.body.textContent;
const buttons = () => [...document.body.querySelectorAll('button')].map((b) => b.textContent.trim());
const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); await flush(); };
const tab = (label) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === label);

const bar = (iso, o, hi, lo, c) => ({ date: iso, datetime: iso, timestamp: Math.floor(Date.parse(iso) / 1000), open: o, high: hi, low: lo, close: c, volume: 100 });
function seed(nowIso, { prevClose = 99, symbol = 'AAPL' } = {}) {
  vi.useFakeTimers(); vi.setSystemTime(new Date(nowIso));
  net.daily[symbol] = [{ date: nowIso.slice(0, 10), open: 100, high: 103.5, low: 99.5, close: 101, volume: 1 }, { date: '2026-10-13', open: 99, high: 99.5, low: 98.5, close: prevClose, volume: 1 }];
  net.intraday[symbol] = [bar('2026-10-14T16:30:00.000Z', 100.9, 101, 100.85, 100.95), bar('2026-10-14T16:00:00.000Z', 100.8, 100.95, 100.7, 100.9), bar('2026-10-14T13:30:00.000Z', 100, 101, 99.8, 100.8), bar('2026-10-13T19:30:00.000Z', 99, 99.2, 98.9, 99)];
  net.minute[symbol] = [bar('2026-10-14T16:58:00.000Z', 101.1, 101.2, 101.0, 101.15), bar('2026-10-14T16:57:00.000Z', 101.0, 101.1, 100.95, 101.1), bar('2026-10-14T16:56:00.000Z', 100.98, 101.02, 100.9, 101.0)];
}

async function committedRow(quote = 101) {
  const { battle } = await correctedStockBattle({ fill: 100.75 });
  const prices = { AAPL: { current: quote, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
  const scores = ['agent', 'cpu'].map((side) => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
  const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW)); Object.assign(battle, h.store.get('battle'));
  battle.expiresAt = '2026-10-20T20:00:00.000Z';
  return { battle, left: enrichHeldPosition(battle.portfolio.star[0], 'star', { stockBattle: battle, stockSide: 'agent', stockSlot: 0 }) };
}
const research = (left) => buildResearchAsset(left, { livePrices: { AAPL: 101.2 }, thresholds: { AAPL: { threshold: 2.5 } }, startingPrices: { AAPL: 100.75 }, useDefaultThreshold: true });

describe('BA-5 — with the mode on, a mount without bombContext loses the 💣 pill and the Bomb tab', () => {
  it('a browse mount (search / Discover / FantasyTimes)', async () => {
    seed('2026-10-14T17:00:00.000Z');
    await render(<AssetResearchModal asset={{ symbol: 'AAPL', name: 'Apple', price: 101.2, threshold: 2.5 }} onClose={() => {}} showActionButton={false} version={2} />);
    expect(buttons()).not.toContain('💣');
    expect(buttons().some((b) => /Bomb/.test(b))).toBe(false);
  });
  it('an acquire mount (draft / free agency) — it showed a Bomb tab by derivation before', async () => {
    seed('2026-10-14T17:00:00.000Z');
    await render(<AssetResearchModal asset={{ symbol: 'AAPL', name: 'Apple', price: 101.2, threshold: 2.5 }} onClose={() => {}} onAcquire={() => {}} canPick version={2} />);
    expect(buttons()).not.toContain('💣');
    expect(buttons().some((b) => /Bomb/.test(b))).toBe(false);
  });
  it('a game-context mount that opens ON the Bomb tab and the 💣 view (the legacy Film Room) falls back to Analysis and 1D', async () => {
    seed('2026-10-14T17:00:00.000Z');
    await render(<AssetResearchModal asset={{ symbol: 'AAPL', name: 'Apple', price: 101.2, threshold: 2.5 }} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" />);
    expect(buttons()).not.toContain('💣');
    expect(buttons().some((b) => /Bomb/.test(b))).toBe(false);
    expect(q('[data-bomb-view]')).toBeNull();
    expect(net.calls.some((c) => c[0] === 'thresholds')).toBe(false);
  });
  it("'allowlist' is not 'on': a browse mount keeps today's modal", async () => {
    flag.mode = 'allowlist'; seed('2026-10-14T17:00:00.000Z');
    await render(<AssetResearchModal asset={{ symbol: 'AAPL', name: 'Apple', price: 101.2, threshold: 2.5 }} onClose={() => {}} onAcquire={() => {}} canPick version={2} />);
    expect(buttons().some((b) => /Bomb/.test(b))).toBe(true);
  });
});

describe('a preview (a name the player does not hold) — BA-1', () => {
  it('the 💣 view is the Fuse, labelled Preview, no candle; the chart and the sheet share yesterday\'s close', async () => {
    seed('2026-10-14T17:00:00.000Z');
    const asset = buildResearchAsset({ symbol: 'AAPL', name: 'Apple' }, { livePrices: { AAPL: 101.2 }, thresholds: { AAPL: { threshold: 2 } }, startingPrices: {}, useDefaultThreshold: true });
    await render(<AssetResearchModal asset={asset} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={101.2} bombContext={{ kind: 'bench' }} />);
    expect(buttons()).toContain('💣');
    const fuse = q('[data-bomb-view="fuse"]');
    expect(fuse).not.toBeNull();
    expect(q('[data-bomb-preview-chip]')).not.toBeNull();
    expect(rec.calls.some((c) => c[0] === 'createChart')).toBe(false);
    expect(q('[data-fuse-baseline]').textContent).toBe("YESTERDAY'S CLOSE $99.00");
    expect(q('[data-bomb-sheet-baseline]').textContent).toBe("Yesterday's close $99.00");
    expect(q('[data-bomb-what]').textContent).toContain("Preview · rungs if it entered at yesterday's close ($99.00)");
    expect(text()).not.toMatch(/entry price/i);
    expect(q('[data-bomb-sheet="preview"]')).not.toBeNull();
    // a preview has no clock, no red zone and no scored chip
    expect(q('[data-rz-clock]')).toBeNull();
    expect(q('[data-bomb-redzone-chip]')).toBeNull();
    expect(q('[data-bomb-sheet-scored]')).toBeNull();
    // the same rung price on the Fuse and the sheet (99 × 1.02)
    expect(q('[data-fuse-rung-label="bagger"]').textContent).toContain('$100.98');
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$100.98');
  });
  it('a preview right at a rung never enters the red zone', async () => {
    seed('2026-10-14T17:00:00.000Z');
    const asset = buildResearchAsset({ symbol: 'AAPL', name: 'Apple' }, { livePrices: { AAPL: 100.95 }, thresholds: { AAPL: { threshold: 2 } }, startingPrices: {}, useDefaultThreshold: true });
    await render(<AssetResearchModal asset={asset} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={100.95} bombContext={{ kind: 'bench' }} />);
    expect(q('[data-bomb-view="fuse"]')).not.toBeNull();
    expect(net.calls.some((c) => c[2] === '1m')).toBe(false);
  });
  it('no asset threshold: the sheet asks the thresholds route exactly as BaggerBombTab does', async () => {
    seed('2026-10-14T17:00:00.000Z'); net.thresholds = { AAPL: { threshold: 2 } };
    await render(<AssetResearchModal asset={{ symbol: 'AAPL', name: 'Apple', price: 101.2 }} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" bombContext={{ kind: 'bench' }} />);
    expect(net.calls.filter((c) => c[0] === 'thresholds')).toEqual([['thresholds', ['AAPL'], 'stock']]);
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$100.98');
  });
});

describe('a held measured position', () => {
  it('the Fuse from the committed context; Entry $fill · time; the sheet\'s held template with the next check', async () => {
    const { battle, left } = await committedRow();
    seed('2026-10-14T17:06:00.000Z');
    const record = selectBombRecord(battle, 'AAPL', Date.now());
    await render(<AssetResearchModal asset={research(left)} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" controlledQuote={{ posKey: 'player:star:0', symbol: 'AAPL', price: 101.2, extremes: null }} bombContext={{ kind: 'agent', battleId: battle.id, held: true, record }} />);
    expect(q('[data-bomb-view="fuse"]')).not.toBeNull();
    expect(q('[data-fuse-baseline]').textContent).toBe('ENTRY $100.75 · WED 10:02 AM');
    expect(q('[data-fuse-rung-label="bagger"]').textContent).toBe('+15$102.77');
    expect(q('[data-bomb-what]').textContent).toBe('What has to happenNeeds $102.77 at a check · next check 1:15 · 09:00');
    expect(rec.calls.some((c) => c[0] === 'createChart')).toBe(false);
  });
  it('the record\'s ladder is the modal\'s bombData.measured — the same committed context, one source', async () => {
    const { battle, left } = await committedRow();
    const record = selectBombRecord(battle, 'AAPL', Date.parse('2026-10-14T17:06:00.000Z'));
    const ctx = research(left).rewardContext;
    expect(record.measured).toEqual({ measured: true, baselinePrice: ctx.fill, targets: ctx.targets.map((t) => ({ key: t.key, price: t.target })), crossedTiers: ctx.crossedTiers });
  });
  it('a check that lands while the modal is open reaches the ladder on the shipped (non-controlled) mount, whose asset stays the one it opened with', async () => {
    const before = await committedRow(101);
    const after = await committedRow(103); // the bagger target is $102.765
    seed('2026-10-14T17:16:00.000Z');
    const asset = research(before.left); // frozen at open, as the legacy mount's is
    const show = async (battle, live) => render(<AssetResearchModal asset={asset} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={live} bombContext={{ kind: 'agent', battleId: battle.id, held: true, record: selectBombRecord(battle, 'AAPL', Date.now()) }} />);
    await show(before.battle, 101.2);
    expect(q('[data-sheet-rung="bagger"]').getAttribute('data-rung-banked')).toBe('0');
    await show(after.battle, 103.05);
    expect(q('[data-sheet-rung="bagger"]').getAttribute('data-rung-banked')).toBe('1');
    expect(q('[data-rz-banked-moment]')).not.toBeNull(); // the modal SAW it bank
  });
});

describe('honest after the close and across days', () => {
  it('a scored check from an earlier session names its day; after the close the wording is last, not live', async () => {
    const { battle, left } = await committedRow(); // scored Wed Oct 14 at 10:02
    seed('2026-10-15T21:00:00.000Z'); // Thu 5:00 PM ET, closed
    const record = selectBombRecord(battle, 'AAPL', Date.now());
    await render(<AssetResearchModal asset={research(left)} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={101.2} bombContext={{ kind: 'agent', battleId: battle.id, held: true, record }} />);
    expect(q('[data-bomb-sheet-scored]').textContent).toBe('last $101.20 · scored $101.00 at Wed 10:02');
    expect(q('[data-fuse-live-label]').textContent).toContain('· LAST');
  });
});

describe('the red zone — automatic, on the 1-minute series the view already fetches', () => {
  // A legacy held EOG: previous close $155.60, threshold 3.6 % → +30 at $164.00.
  const legacyEog = (over = {}) => legacyBattle({ expiresAt: '2026-10-20T20:00:00.000Z', ...over });
  const eogAsset = { symbol: 'EOG', name: 'EOG', price: 163.6, threshold: 3.6 };
  function seedEog(nowIso) {
    vi.useFakeTimers(); vi.setSystemTime(new Date(nowIso));
    net.daily.EOG = [{ date: '2026-10-14', open: 156, high: 164, low: 155, close: 163.6, volume: 1 }, { date: '2026-10-13', open: 154, high: 156, low: 153, close: 155.6, volume: 1 }];
    net.intraday.EOG = [bar('2026-10-14T16:30:00.000Z', 163, 163.7, 162.9, 163.5), bar('2026-10-14T16:00:00.000Z', 162.5, 163.1, 162.4, 163)];
    net.minute.EOG = [bar('2026-10-14T16:56:00.000Z', 163.4, 163.5, 163.3, 163.45), bar('2026-10-14T16:55:00.000Z', 163.3, 163.4, 163.2, 163.4)];
  }
  const open = async (live, battle = legacyEog()) => {
    const record = selectBombRecord(battle, 'EOG', Date.now());
    await render(<AssetResearchModal asset={{ ...eogAsset, price: live }} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={live} bombContext={{ kind: 'agent', battleId: battle.id, held: true, record }} />);
    return record;
  };
  it('enters within 0.5 % of the next rung: the goal-line view, the RED ZONE chip, the 1-minute request and its 15-second poll', async () => {
    seedEog('2026-10-14T17:00:00.000Z');
    await open(163.6); // $0.40 / 0.24 % below +30 at $164.00
    expect(q('[data-bomb-view="redzone"]')).not.toBeNull();
    expect(q('[data-bomb-redzone-chip="approaching"]')).not.toBeNull();
    expect(q('[data-rz-distance]').textContent).toBe('$0.40to +30 · 0.24%');
    expect(q('[data-rz-scored]').textContent).toBe('live $163.60 · scored $160.19 at 1:00');
    expect(q('[data-rz-clock="countdown"]').textContent).toBe('NEXT CHECK1:15') // exactly 15:00 out: no mm:ss (under fifteen minutes only);
    // CALL COUNT: the 30-minute series the view opened on, then the 1-minute series — the same two requests the distance pill made
    const history = net.calls.filter((c) => c[0] === 'history').map((c) => [c[2], c[3]]);
    expect(history).toEqual([['30m', { days: 20 }], ['1d', { days: 5 }], ['1m', { days: 1 }]]);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); }); await flush();
    expect(net.calls.filter((c) => c[2] === '1m')).toHaveLength(2); // the existing 15-second poll
    expect(rec.calls.some((c) => c[0] === 'createChart')).toBe(false); // never a candle
  });
  it('the trace: the minute bars as one line to their last bar (labelled), the observed quotes after it as dots', async () => {
    seedEog('2026-10-14T17:00:00.000Z');
    await open(163.6);
    expect(q('[data-rz-trace-line]').getAttribute('d').match(/[ML]/g)).toHaveLength(2);
    expect(q('[data-rz-trace-end]').textContent).toBe('1-MIN BARS TO 12:56');
    expect(document.body.querySelectorAll('[data-rz-observation]').length).toBeGreaterThan(0);
  });
  it('leaves past 0.75 % and goes back to the Fuse on the 30-minute series', async () => {
    seedEog('2026-10-14T17:00:00.000Z');
    const battle = legacyEog();
    await open(163.6, battle);
    expect(q('[data-bomb-view="redzone"]')).not.toBeNull();
    await open(162.5, battle); // 0.92 %
    expect(q('[data-bomb-view="fuse"]')).not.toBeNull();
    expect(q('[data-bomb-redzone-chip]')).toBeNull();
  });
  it('the banked moment plays once when the modal SEES a rung bank, and the time it names is that check\'s', async () => {
    seedEog('2026-10-14T17:16:00.000Z');
    const before = legacyEog();
    await open(163.95, before);
    expect(q('[data-bomb-view="redzone"]')).not.toBeNull();
    const after = legacyEog({ thresholdHistory: { EOG: { maxMultiplier: 1.55, minMultiplier: -0.31 } }, scoreState: { lastScoredAt: '2026-10-14T17:15:40.000Z' }, cronState: { lastTickPrice: { EOG: 164.05 }, lastTickTimestamp: { EOG: Date.parse('2026-10-14T17:15:31.000Z') } } });
    await open(164.05, after);
    expect(q('[data-rz-banked-moment]').textContent).toBe('+30BANKED · 1:15 CHECK · $164.05');
    await act(async () => { await vi.advanceTimersByTimeAsync(BANKED_MOMENT_MS); }); await flush();
    expect(q('[data-rz-banked-moment]')).toBeNull();
    await open(164.06, after);
    expect(q('[data-rz-banked-moment]')).toBeNull(); // once
    await open(158, after); // far from +50 → the Fuse, which now carries the seen time (BA-4)
    expect(q('[data-fuse-banked-at="doubleBagger"]').textContent).toBe('BANKED · 1:15');
    expect(q('[data-fuse-banked-at="bagger"]')).toBeNull(); // banked before the modal opened: no time
  });
  it('the market closed: the frozen view, "Market closed · last tick", and the next check\'s day and time', async () => {
    seedEog('2026-10-14T20:30:00.000Z'); // 4:30 PM ET
    net.minute.EOG = [bar('2026-10-14T19:59:00.000Z', 163.4, 163.5, 163.3, 163.7), bar('2026-10-14T19:58:00.000Z', 163.3, 163.4, 163.2, 163.6)];
    await open(163.7);
    expect(q('[data-redzone-state="closed"]')).not.toBeNull();
    expect(text()).toContain('Market closed · last tick 3:59 PM'); // the last minute bar — a quote taken after the close is not a tick
    expect(document.body.querySelectorAll('[data-rz-observation]')).toHaveLength(0);
    expect(q('[data-rz-clock="later"]').textContent).toBe('NEXT CHECKThu 9:30 AM');
    // no poll after hours (the hook's own rule)
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); }); await flush();
    expect(net.calls.filter((c) => c[2] === '1m')).toHaveLength(1);
  });
  it('crypto never enters', async () => {
    seedEog('2026-10-14T17:00:00.000Z');
    const battle = legacyEog(); battle.portfolio.star[0].isCrypto = true;
    const record = selectBombRecord(battle, 'EOG', Date.now());
    await render(<AssetResearchModal asset={{ ...eogAsset, isCrypto: true }} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={163.6} bombContext={{ kind: 'agent', battleId: battle.id, held: true, record }} />);
    expect(q('[data-bomb-view="redzone"]')).toBeNull();
  });
  it('entry unavailable: a held legacy name whose precedence yields nothing draws no rung', async () => {
    seedEog('2026-10-14T17:00:00.000Z'); net.daily.EOG = [];
    await open(163.6);
    expect(q('[data-bomb-state="entry_unavailable"]')).not.toBeNull();
  });
});

// ── Review lens B / C rows (the review record in the build report) ──────────
const drawerTabs = () => [...document.body.querySelectorAll('button')].filter((b) => b.style.padding === '6px 10px' && b.style.borderRadius === '6px');
const activeDrawerTab = () => drawerTabs().filter((b) => b.style.background !== 'rgba(255, 255, 255, 0.05)').map((b) => b.textContent.trim());

describe('lens C: the requests and the tabs a mount makes', () => {
  it('C2: an asset that carries its threshold — the sheet asks the thresholds route nothing', async () => {
    seed('2026-10-14T17:00:00.000Z');
    await render(<AssetResearchModal asset={{ symbol: 'AAPL', name: 'Apple', price: 101.2, threshold: 2 }} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" bombContext={{ kind: 'bench' }} />);
    expect(q('[data-sheet-rung="bagger"]').textContent).toContain('$100.98');
    expect(net.calls.some((c) => c[0] === 'thresholds')).toBe(false);
  });
  it('C10: a preview with no asset threshold still shows the 💣 pill and the Bomb tab', async () => {
    seed('2026-10-14T17:00:00.000Z'); net.thresholds = { AAPL: { threshold: 2 } };
    await render(<AssetResearchModal asset={{ symbol: 'AAPL', name: 'Apple', price: 101.2 }} onClose={() => {}} showActionButton={false} version={2} bombContext={{ kind: 'bench' }} />);
    expect(buttons()).toContain('💣');
    expect(drawerTabs().map((b) => b.textContent.trim())).toContain('💣 Bomb');
  });
  it('C7: the BA-5 fallback of a mount that opens on the Bomb tab and the 💣 view — Analysis is the open tab; the 1D daily request, never the 30-minute one', async () => {
    seed('2026-10-14T17:00:00.000Z');
    await render(<AssetResearchModal asset={{ symbol: 'AAPL', name: 'Apple', price: 101.2, threshold: 2.5 }} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" />);
    expect(activeDrawerTab()).toEqual(['Analysis']);
    const history = net.calls.filter((c) => c[0] === 'history').map((c) => [c[2], c[3]]);
    expect(history.some(([tf]) => tf === '30m' || tf === '1m')).toBe(false);
    expect(history).toContainEqual(['1d', { days: 400 }]);
  });
});

describe('lens C: the check clock in the sheet and the banked time', () => {
  const eogAsset = { symbol: 'EOG', name: 'EOG', threshold: 3.6 };
  function seedEog(nowIso) {
    vi.useFakeTimers(); vi.setSystemTime(new Date(nowIso));
    net.daily.EOG = [{ date: '2026-10-14', open: 156, high: 164, low: 155, close: 163.6, volume: 1 }, { date: '2026-10-13', open: 154, high: 156, low: 153, close: 155.6, volume: 1 }];
    net.intraday.EOG = [bar('2026-10-14T16:30:00.000Z', 163, 163.7, 162.9, 163.5), bar('2026-10-14T16:00:00.000Z', 162.5, 163.1, 162.4, 163)];
    net.minute.EOG = [bar('2026-10-14T16:56:00.000Z', 163.4, 163.5, 163.3, 163.45), bar('2026-10-14T16:55:00.000Z', 163.3, 163.4, 163.2, 163.4)];
  }
  const open = async (live, battle) => {
    const record = selectBombRecord(battle, 'EOG', Date.now());
    await render(<AssetResearchModal asset={{ ...eogAsset, price: live }} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={live} bombContext={{ kind: 'agent', battleId: battle.id, held: true, record }} />);
  };
  it('C3: at the slot, before the battle is scored past it, the sheet says checking…', async () => {
    seedEog('2026-10-14T17:16:00.000Z'); // the 1:15 slot; the fixture was last scored at 1:00:40
    await open(158, legacyBattle({ expiresAt: '2026-10-20T20:00:00.000Z', thresholdHistory: {} }));
    expect(q('[data-bomb-view="fuse"]')).not.toBeNull();
    expect(q('[data-bomb-what]').textContent).toBe('What has to happenNeeds $161.20 at a check · checking…');
  });
  it('C4: a late queue (the 1:15 slot scored at 1:19:20) — the banked moment names the 1:15 check, never 1:19', async () => {
    seedEog('2026-10-14T17:20:00.000Z');
    await open(163.95, legacyBattle({ expiresAt: '2026-10-20T20:00:00.000Z' }));
    expect(q('[data-bomb-view="redzone"]')).not.toBeNull();
    const after = legacyBattle({ expiresAt: '2026-10-20T20:00:00.000Z', thresholdHistory: { EOG: { maxMultiplier: 1.55, minMultiplier: -0.31 } }, scoreState: { lastScoredAt: '2026-10-14T17:19:20.000Z' }, cronState: { lastTickPrice: { EOG: 164.05 }, lastTickTimestamp: { EOG: Date.parse('2026-10-14T17:19:10.000Z') } } });
    await open(164.05, after);
    expect(q('[data-rz-banked-moment]').textContent).toBe('+30BANKED · 1:15 CHECK · $164.05');
  });
});

describe('lens B: the poll follows the session under an open red zone (B1, B4)', () => {
  const eogAsset = { symbol: 'EOG', name: 'EOG', threshold: 3.6 };
  const minuteCalls = () => net.calls.filter((c) => c[0] === 'history' && c[2] === '1m').length;
  const tick = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); await flush(); };
  const openAt = async (nowIso, minute) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(nowIso));
    net.daily.EOG = [{ date: '2026-10-14', open: 156, high: 164, low: 155, close: 163.6, volume: 1 }, { date: '2026-10-13', open: 154, high: 156, low: 153, close: 155.6, volume: 1 }];
    net.intraday.EOG = [bar('2026-10-13T19:30:00.000Z', 155, 155.7, 154.9, 155.6), bar('2026-10-13T19:00:00.000Z', 155.2, 155.4, 154.8, 155)];
    net.minute.EOG = minute;
    const battle = legacyBattle({ expiresAt: '2026-10-20T20:00:00.000Z' });
    const record = selectBombRecord(battle, 'EOG', Date.now());
    await render(<AssetResearchModal asset={{ ...eogAsset, price: 163.6 }} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={163.6} bombContext={{ kind: 'agent', battleId: battle.id, held: true, record }} />);
  };
  it('B1: opened at 9:29 in a closed red zone — at 9:30 the zone opens and the 15-second poll starts', async () => {
    await openAt('2026-10-14T13:29:00.000Z', [bar('2026-10-14T13:31:00.000Z', 163.5, 163.6, 163.4, 163.6), bar('2026-10-14T13:30:00.000Z', 163.4, 163.5, 163.3, 163.5)]);
    expect(q('[data-redzone-state="closed"]')).not.toBeNull();
    await tick(30_000);
    expect(minuteCalls()).toBe(1); // closed: no poll
    await tick(31_000); // 9:30:01
    expect(q('[data-bomb-redzone-chip="approaching"]')).not.toBeNull();
    const at930 = minuteCalls();
    await tick(15_000);
    expect(minuteCalls()).toBe(at930 + 1);
    await tick(15_000);
    expect(minuteCalls()).toBe(at930 + 2);
  });
  it('B4: a red zone open across 4:00 PM — the zone closes and the poll stops', async () => {
    await openAt('2026-10-14T19:59:00.000Z', [bar('2026-10-14T19:58:00.000Z', 163.5, 163.6, 163.4, 163.6), bar('2026-10-14T19:57:00.000Z', 163.4, 163.5, 163.3, 163.5)]);
    expect(q('[data-bomb-redzone-chip="approaching"]')).not.toBeNull();
    const before = minuteCalls();
    await tick(15_000);
    expect(minuteCalls()).toBe(before + 1); // polling while open
    await tick(46_000); // 4:00:01 PM
    expect(q('[data-redzone-state="closed"]')).not.toBeNull();
    const atClose = minuteCalls();
    await tick(60_000);
    expect(minuteCalls()).toBe(atClose);
  });
});
