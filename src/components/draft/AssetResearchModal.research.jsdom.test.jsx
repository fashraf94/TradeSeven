// @vitest-environment jsdom
//
// Battle Research Slice 1 — the research modal opened from a result (state 2; spec BRS-10, BRS-17 – BRS-19):
// the REAL modal and the research blocks on the research sheet's measured book, the harness of the
// BS-4 suite (AssetResearchModal.bombAtr) — the network and Firestore recorded, the charts stubbed.

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
import { researchBattle, rankingsDoc, quotesBody, TAKEN_AT } from '../Research/BattleResearch/__fixtures__/researchFixtures.js';
import { buildResult, incumbentOf } from '../Research/BattleResearch/result.js';
import { newInvestigation, addCondition, currentStep, currentResult } from '../Research/BattleResearch/investigation.js';
import { researchContextOf } from '../Research/BattleResearch/researchContext.js';
import { subsetDoc } from '../Research/BattleResearch/useBattleResearch.js';

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

const NOW = '2026-10-14T17:46:00.000Z'; // Wed 1:46 PM ET, a minute after the result
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
beforeAll(async () => { BATTLE = await researchBattle(); });

/** The research context the battle screen hands the modal for one row (researchContext.js), with recorders. */
function contextFor(symbol, { conditions = [], openedAtFirst = false, questionId = 'weakest_alternatives' } = {}) {
  const r = buildResult({ battle: BATTLE, incumbent: questionId === 'weakest_alternatives' ? incumbentOf(BATTLE) : null, rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT, resultId: 'r1' });
  let inv = newInvestigation({ battleId: 'stock-battle', questionId, result: r, at: TAKEN_AT });
  const opened = currentStep(inv).stepId;
  for (const c of conditions) inv = addCondition(inv, c, TAKEN_AT + 1);
  const cb = { back: 0, applied: [], undo: 0, drafts: [] };
  const research = researchContextOf({
    inv, symbol, openedStepId: openedAtFirst ? opened : currentStep(inv).stepId, battle: BATTLE, voice: 'Shadow · Trend Follower', agentName: 'Shadow', nowMs: Date.parse(NOW),
    cb: { onBack: () => { cb.back += 1; }, onApplyUseAcross: (id) => cb.applied.push(id), onUndo: () => { cb.undo += 1; }, onDraft: (d) => cb.drafts.push(d) },
  });
  const sheetContext = {
    battleId: 'stock-battle', agentId: 'agent-1', archetype: 'momentum_chaser', agentName: 'shadow', row: { held: false },
    battle: BATTLE, standing: null, directive: null, onOpenCockpit: () => {},
    research, rankings: subsetDoc(currentResult(inv)), ...(currentResult(inv).incumbent ? { incumbent: currentResult(inv).incumbent.symbol } : {}),
  };
  return { sheetContext, cb, research };
}
const openResearch = async (symbol, ctx, { withResearch = true } = {}) => {
  seed(symbol);
  const bombContext = agentBombContext(BATTLE, symbol, Date.parse(NOW), { battleId: 'stock-battle' });
  // Without research: the same context (the incumbent and the rankings included), less state 2's object alone.
  const sheetContext = withResearch ? ctx.sheetContext : (({ research, ...rest }) => rest)(ctx.sheetContext); // eslint-disable-line no-unused-vars
  await open(nonHeld(symbol, { threshold: 6.48 }), bombContext, { sheetContext });
};
const clickEl = async (el) => { expect(el).toBeTruthy(); await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush(); };

describe('BRS-17 — state 2: the research blocks are PREPENDED to the Analysis view (R-34)', () => {
  beforeEach(() => { flag.sheet = 'on'; });
  it('the strip, For this question, the finding and the comparison come first, then state 1\'s blocks unchanged', async () => {
    await openResearch('MSFT', contextFor('MSFT'));
    const keys = [...document.body.querySelectorAll('[data-shell-block]')].map((b) => b.getAttribute('data-shell-block'));
    expect(keys.slice(0, 5)).toEqual(['researchStrip', 'researchForQuestion', 'researchFinding', 'researchCompare', 'stance']);
    expect(q('[data-research-question]').textContent).toBe('Compare alternatives to EQIX');
    expect(q('[data-research-voice]').textContent).toBe('Shadow · Trend Follower');
    expect(q('[data-research-place]').textContent).toBe('#3 of 4 placed · Rank 40 of 228 · 1:01 PM ET');
    expect(q('[data-research-support]').textContent).toBe('Higher technical rank than EQIX: 40 against 140 of 228 (ranks as of 1:01 PM ET).');
    expect(q('[data-research-compare="EQIX"] [data-research-lock]').textContent).toMatch(/^Swapping EQIX out at the 12:45 check’s price locks [+−]\d+ pts$/);
    expect(q('[data-research-evidence]').textContent).toContain('None of this says how it would score from here.');
  });
  it('state 1\'s own blocks render the same with and without research (no state-1 change)', async () => {
    const ctx = contextFor('MSFT');
    await openResearch('MSFT', ctx, { withResearch: false });
    const without = ['stance', 'decided'].map((k) => q(`[data-shell-block="${k}"]`).innerHTML);
    act(() => root.unmount()); root = createRoot(container);
    await openResearch('MSFT', ctx);
    expect(['stance', 'decided'].map((k) => q(`[data-shell-block="${k}"]`).innerHTML)).toEqual(without);
    expect(q('[data-shell-block="researchStrip"]')).toBeTruthy();
  });
  it('‹ Back to ranking closes onto the result (the screen\'s door)', async () => {
    const ctx = contextFor('MSFT');
    await openResearch('MSFT', ctx);
    await clickEl(q('[data-research-back]'));
    expect(ctx.cb.back).toBe(1);
  });
  it('BRS-19: the action row\'s door is Draft it for {Agent} → in place of → Cockpit; it drafts, nothing is sent', async () => {
    const ctx = contextFor('MSFT');
    await openResearch('MSFT', ctx);
    expect(q('[data-sheet-cockpit]')).toBeNull();
    expect(q('[data-sheet-draft]').textContent).toBe('Draft it for Shadow →');
    await clickEl(q('[data-sheet-draft]'));
    expect(ctx.cb.drafts).toHaveLength(1);
    expect(ctx.cb.drafts[0].text).toMatch(/^Research: "Compare alternatives to EQIX" \(result 1:45 PM ET\)\nMSFT vs EQIX:/);
    expect(net.calls.filter((c) => c[0] === 'fetchWithAuth' && c[1].includes('/api/agent/chat'))).toEqual([]);
  });
  it('the Ranks tab carries one line: All stocks · technical rank · {time}', async () => {
    await openResearch('MSFT', contextFor('MSFT'));
    await clickEl(q('[data-shell-tab="ranks"]'));
    expect(q('[data-shell-ranks-note]').textContent).toBe('All stocks · technical rank · 1:01 PM ET');
  });
  it('the incumbent item\'s source names the research question, never "its call in the cockpit" (Phase 0 point 6)', async () => {
    await openResearch('MSFT', contextFor('MSFT'));
    expect(q('[data-pack-item="incumbent"]')?.textContent ?? '').not.toContain('its call in the cockpit');
    if (q('[data-pack-item="incumbent"]')) expect(q('[data-pack-item="incumbent"]').textContent).toContain('your research question');
  });
});

describe('BRS-10 / LA-3 — 💣 prints the ROW\'s rung size and time, and makes no second read', () => {
  beforeEach(() => { flag.sheet = 'on'; });
  it('the ATR reading is seeded from the result: no stockTechnicalScores read; the preview says the row\'s number and time', async () => {
    // A different (later) reading on the per-stock doc: if the modal read it, the numbers would disagree.
    scores('MSFT', 2.71, at('2026-10-14T17:30:00.000Z'));
    await openResearch('MSFT', contextFor('MSFT'));
    await clickEl(q('[data-shell-pill="bomb"]'));
    expect(reads()).not.toContain('stockTechnicalScores/MSFT');
    expect(bodyText()).toContain('ATR reading 1.9%');
    expect(bodyText()).toContain('as of 1:01 PM');
    expect(bodyText()).not.toContain('2.7%');
  });
});

describe('BRS-18a — Use across this result', () => {
  beforeEach(() => { flag.sheet = 'on'; });
  it('the confirm shows the three counts against the whole frozen group; Apply adds the step (the screen\'s door); the line offers Undo', async () => {
    const ctx = contextFor('MSFT');
    await openResearch('MSFT', ctx);
    await clickEl(q('[data-research-use-across="up_today"]'));
    expect(q('[data-research-use-across-confirm]').textContent).toContain('Keep names up today · 3 would remain · 1 fail · 0 not assessed');
    await clickEl(q('[data-research-apply]'));
    expect(ctx.cb.applied).toEqual(['up_today']);
    expect(q('[data-research-applied]').textContent).toContain('3 remain');
    await clickEl(q('[data-research-applied-undo]'));
    expect(ctx.cb.undo).toBe(1);
  });
  it('the replacement case: with down today active, up today is offered in its place, and says so', async () => {
    const ctx = contextFor('MSFT', { conditions: [{ id: 'down_today' }] });
    await openResearch('MSFT', ctx);
    await clickEl(q('[data-research-use-across="up_today"]'));
    expect(q('[data-research-use-across-confirm]').textContent).toContain('Keep names up today (in place of down today) · 3 would remain');
  });
  it('the open stock leaving the result: the modal stays open, says why, and Undo works', async () => {
    const ctx = contextFor('MSFT', { conditions: [{ id: 'down_today' }], openedAtFirst: true });
    await openResearch('MSFT', ctx);
    expect(q('[data-research-left]').textContent).toMatch(/^MSFT is up 1\.2% today \(as of 1:43 PM\), so “down today” leaves it out of this result\./);
    await clickEl(q('[data-research-left-undo]'));
    expect(ctx.cb.undo).toBe(1);
  });
});

describe('BRS-18 — a group question: Compare with a holding (a picker, weakest first)', () => {
  beforeEach(() => { flag.sheet = 'on'; });
  it('the picker lists the held measured stocks and defaults to the weakest; the candidate is judged against the PICKED holding', async () => {
    const ctx = contextFor('SOL-USD.CC', { questionId: 'rank_bench' });
    expect(ctx.research.compareDefault).toBe('EQIX');
    expect(ctx.research.compareFor('EQIX').rows.find((r) => r.key === 'stands').cand).toBe('Can’t come in · a crypto can’t replace a stock');
  });
});

// ── The review round on PR B (lenses 1 and 4): each row failed before the round's fix ──
describe('review BL1-1 — Use across keeps its applied line when the screen rebuilds the context for the step it added', () => {
  beforeEach(() => { flag.sheet = 'on'; });
  it('Apply → the screen re-renders with the new step → "3 remain · Undo" is still there', async () => {
    await openResearch('MSFT', contextFor('MSFT'));
    await clickEl(q('[data-research-use-across="up_today"]'));
    await clickEl(q('[data-research-apply]'));
    expect(q('[data-research-applied]')).not.toBeNull();
    // The screen's own re-render: the context now describes the step Apply added, opened from the first one.
    const next = contextFor('MSFT', { conditions: [{ id: 'up_today' }], openedAtFirst: true });
    const bombContext = agentBombContext(BATTLE, 'MSFT', Date.parse(NOW), { battleId: 'stock-battle' });
    await open(nonHeld('MSFT', { threshold: 6.48 }), bombContext, { sheetContext: next.sheetContext });
    expect(q('[data-research-chip="up_today"]')).not.toBeNull();
    expect(q('[data-research-applied]')).not.toBeNull();
  });
});

describe('review BL4-1 — the research strip can stick: its block box does not hold it', () => {
  beforeEach(() => { flag.sheet = 'on'; });
  it('the strip\'s own block box is display: contents (its sticky containing block is the whole analysis column); state 1\'s boxes are untouched', async () => {
    await openResearch('MSFT', contextFor('MSFT'));
    expect(q('[data-shell-block="researchStrip"]').style.display).toBe('contents');
    for (const k of ['researchForQuestion', 'researchFinding', 'researchCompare', 'stance']) expect(q(`[data-shell-block="${k}"]`).getAttribute('style')).toBeNull();
  });
});

describe('review BL4-10 / BL4-5 — the research links and the Draft door at phone width', () => {
  beforeEach(() => { flag.sheet = 'on'; });
  it('every research link is at least 44 px wide as well as tall', async () => {
    await openResearch('MSFT', contextFor('MSFT', { conditions: [{ id: 'down_today' }], openedAtFirst: true }));
    await clickEl(q('[data-research-use-across="up_today"]') ?? q('[data-research-left-undo]'));
    const links = [...document.body.querySelectorAll('[data-shell-block^="research"] button')];
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((b) => (parseInt(b.style.minWidth, 10) || 0) < 44).map((b) => b.outerHTML.slice(0, 70))).toEqual([]);
  });
  it('the Draft door may wrap and never takes more than half the action row (a 20-letter agent name at 320 px)', async () => {
    await openResearch('MSFT', contextFor('MSFT'));
    const door = q('[data-sheet-draft]');
    expect(door.style.whiteSpace).not.toBe('nowrap');
    expect(door.style.maxWidth).toBe('50%');
  });
});

describe('review BL2-2 — the two Draft doors are the same door: both draft against the holding picked in Compare', () => {
  beforeEach(() => { flag.sheet = 'on'; });
  it('a group question, KO picked: the action row drafts "MSFT vs KO", as the comparison\'s own door does', async () => {
    const ctx = contextFor('MSFT', { questionId: 'rank_bench' });
    await openResearch('MSFT', ctx);
    await clickEl(q('[data-research-pick="KO"]'));
    await clickEl(q('[data-research-draft]'));
    await clickEl(q('[data-sheet-draft]'));
    expect(ctx.cb.drafts).toHaveLength(2);
    expect(ctx.cb.drafts[0].text).toContain('\nMSFT vs KO:');
    expect(ctx.cb.drafts[1].text).toContain('\nMSFT vs KO:');
  });
});

describe('review BL2-11 — every tap in the research blocks is marked no message cost', () => {
  beforeEach(() => { flag.sheet = 'on'; });
  it('the strip says so, under the question', async () => {
    await openResearch('MSFT', contextFor('MSFT'));
    expect(q('[data-research-strip] [data-research-no-cost]').textContent).toBe('no message cost');
  });
});

describe('review BL2-10 — a row of the opening\'s list hands the modal the opening\'s own ATR reading (BRS-10)', () => {
  beforeEach(() => { flag.sheet = 'on'; });
  it('state 1 with the seed: 💣 prints the row\'s number and time, no stockTechnicalScores read', async () => {
    scores('MSFT', 2.71, at('2026-10-14T17:30:00.000Z'));
    const { research, rankings, incumbent, ...plain } = contextFor('MSFT').sheetContext; // eslint-disable-line no-unused-vars
    seed('MSFT');
    const bombContext = agentBombContext(BATTLE, 'MSFT', Date.parse(NOW), { battleId: 'stock-battle' });
    await open(nonHeld('MSFT', { threshold: 6.48 }), bombContext, { sheetContext: { ...plain, atrSeed: { pct: 1.94, asOfMs: Date.parse('2026-10-14T17:01:00.000Z') } } });
    expect(q('[data-shell-block="researchStrip"]')).toBeNull();
    await clickEl(q('[data-shell-pill="bomb"]'));
    expect(reads()).not.toContain('stockTechnicalScores/MSFT');
    expect(bodyText()).toContain('ATR reading 1.9%');
  });
});
