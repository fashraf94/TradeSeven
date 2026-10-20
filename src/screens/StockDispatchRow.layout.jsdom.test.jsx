// @vitest-environment jsdom
// Regression: measured games must keep the real battle card, without borrowing
// calibrated ATR targets, browser-inferred awards or the legacy score popover.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
import { StockDispatchRow, enrichHeldPosition } from './AgentBattleScreen.jsx';
import TacticalRow from '../components/BaggerBomb/TacticalRow.jsx';
import ChamberFuse from '../components/BaggerBomb/ChamberFuse.jsx';
import { correctedStockBattle, stockWriterDb, STOCK_TEST_NOW } from '../../api/_utils/__fixtures__/stockThresholdHarness.js';
import { scoreCorrectedPosition, correctedScorePatch } from '../../api/_utils/stockThresholdAdmission.js';
import { measuredProximity, validCommittedStockScores } from '../utils/stockThresholdModel.js';
import { selectComparison } from './battleView/shadowCpuQuoteIntegrity.js';

const oldKey = process.env.EODHD_API_KEY;
beforeAll(() => { process.env.EODHD_API_KEY = 'isolated-key'; });
afterAll(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, container;
afterEach(() => { if (root) act(() => root.unmount()); root = null; container?.remove(); });

async function facts(current = 101.5) {
  const { battle } = await correctedStockBattle({ fill: 100, cpuFill: 99, cpuSymbol: 'MSFT' });
  const prices = Object.fromEntries(['AAPL', 'MSFT'].map(s => [s, { current, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 }]));
  const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
  const db = stockWriterDb({ battle });
  await db.db.doc('battle').update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW));
  Object.assign(battle, db.store.get('battle'));
  return { battle, left: enrichHeldPosition(battle.portfolio.star[0], 'star', { stockBattle: battle }), right: enrichHeldPosition(battle.opponent.portfolio.star[0], 'star', { stockBattle: battle, stockSide: 'cpu' }) };
}
const dom = jsx => { const el = document.createElement('div'); el.innerHTML = renderToStaticMarkup(jsx); return el; };
const mount = jsx => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); act(() => root.render(jsx)); };
const click = el => { expect(el).toBeTruthy(); act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))); };

it('restores two aligned cards, one allocation badge, current price, scores and gauges', async () => {
  const { left, right } = await facts();
  const el = dom(<StockDispatchRow leftAsset={left} rightAsset={right} tier="star" showCurrentPrice />);
  const sides = el.querySelectorAll('[data-measured-stock]');
  expect(sides.length).toBe(2);
  expect(sides[0].parentElement).toBe(sides[1].parentElement);
  expect(sides[0].parentElement.style.display).toBe('flex');
  expect(sides[0].parentElement.children.length).toBe(3);
  expect(sides[0].parentElement.style.minHeight).toBe('120px');
  expect(sides[0].style.padding).toBe('12px'); expect(sides[1].style.textAlign).toBe('right');
  expect(el.textContent).toContain('2×');
  expect(el.querySelector('[data-row-price="AAPL"]').textContent).toBe('$101.50');
  expect(el.querySelectorAll('[data-reward-multiplier]').length).toBe(2);
  expect(sides[0].textContent).toContain('+1.50%'); expect(sides[0].textContent).toContain('+30');
  expect(el.textContent).not.toContain('no earned tiers');
  // Optional local visual-review fixture. No credentials or production data.
  if (process.env.MEASURED_CARD_FIXTURE) writeFileSync(process.env.MEASURED_CARD_FIXTURE, JSON.stringify({ left, right }));
});

it('uses committed gauge/proximity values even when calibrated and legacy fields disagree', async () => {
  const { left } = await facts();
  const poison = { ...left, baseATR: 0.001, thresholdPriceChange: 100, history: { maxMultiplier: 500, minMultiplier: -500 }, dailyLevels: { baggerBomb: 5000 } };
  const el = dom(<StockDispatchRow leftAsset={poison} tier="star" />);
  const gauge = el.querySelector('[data-reward-multiplier]');
  expect(gauge.dataset.rewardMultiplier).toBe('0.75'); expect(gauge.dataset.earnedTiers).toBe('');
  expect(el.textContent).toContain(measuredProximity(left.rewardContext).text);
  const segments = [...gauge.firstElementChild.children];
  expect(segments.every(segment => segment.style.opacity === '0.3')).toBe(true);
  expect(el.querySelector('[title*="Bagger ("]')).toBeNull();
});

it('lights only committed tiers, including a retained hit after retreat and an exact-boundary mismatch', async () => {
  const { left } = await facts(103);
  const context = { ...left.rewardContext, multiplier: 0.5, crossedTiers: ['bagger'] };
  const el = dom(<ChamberFuse priceChange={100} baseATR={0.1} history={{ maxMultiplier: 99, minMultiplier: -99 }} rewardContext={context} />);
  expect([...el.firstElementChild.firstElementChild.children].map(x => x.style.opacity)).toEqual(['0.3', '0.3', '0.3', '1', '0.3', '0.3']);
  const boundary = dom(<ChamberFuse priceChange={2} baseATR={2} rewardContext={{ ...context, multiplier: 1, crossedTiers: [] }} />);
  expect([...boundary.firstElementChild.firstElementChild.children].every(x => x.style.opacity === '0.3')).toBe(true);
});

it('withholds unavailable facts and recovers in the same mounted row without fabricating zeros', async () => {
  const { left } = await facts();
  const missing = { ...left, rewardContext: { status: 'unavailable', reason: 'awaiting_bound_committed_context' }, points: null, priceChange: null, history: null, currentPrice: null };
  mount(<StockDispatchRow leftAsset={missing} tier="star" showCurrentPrice />);
  expect(container.textContent).toContain('Measured reward unavailable');
  expect(container.querySelector('[data-row-price]')).toBeNull();
  expect(container.querySelector('[data-reward-multiplier]')).toBeNull();
  expect(container.textContent).not.toContain('0.00%');
  act(() => root.render(<StockDispatchRow leftAsset={left} tier="star" showCurrentPrice />));
  expect(container.querySelector('[data-reward-multiplier]').dataset.rewardMultiplier).toBe('0.75');
});

it('keeps side identity for symbols and points, and opens Why only on request', async () => {
  const { left, right } = await facts();
  const research = vi.fn(), breakdown = vi.fn(), why = vi.fn(), panel = vi.fn(p => <div data-panel="1">{p.text}</div>);
  const props = { leftAsset: left, rightAsset: right, tier: 'star', onSymbolClick: research, onPointsClick: breakdown, onWhy: why, whyLabel: 'Why?', renderWhy: panel, reportClickSide: true };
  mount(<StockDispatchRow {...props} />);
  expect(panel).not.toHaveBeenCalled();
  const sides = container.querySelectorAll('[data-measured-stock]');
  click(sides[1].querySelector('div[style*="inline-block"]'));
  expect(research).toHaveBeenLastCalledWith(right, { side: 'cpu' });
  click([...sides[1].querySelectorAll('div')].find(x => x.style.padding === '4px 8px'));
  expect(research).toHaveBeenLastCalledWith(right, { side: 'cpu' }); expect(breakdown).not.toHaveBeenCalled();
  click(sides[0]); expect(why).toHaveBeenLastCalledWith(left, measuredProximity(left.rewardContext));
  act(() => root.render(<StockDispatchRow {...props} whyOpen />));
  expect(container.querySelector('[data-panel]').textContent).toBe(measuredProximity(left.rewardContext).text);
  expect(container.textContent).toContain('position-agent');
  expect(container.querySelectorAll('[aria-label="Measured stock reward targets"]').length).toBe(1);
});

it('keeps legacy crypto markup unchanged and mixed cash rows use one allocation badge', async () => {
  const crypto = { symbol: 'BTC', isCrypto: true, priceChange: 1, points: 10, baseATR: 5, history: { maxMultiplier: 0, minMultiplier: 0 }, badges: [] };
  const props = { leftAsset: crypto, rightAsset: { ...crypto, symbol: 'ETH' }, tier: 'support', isCryptoSlot: true };
  expect(renderToStaticMarkup(<StockDispatchRow {...props} />)).toBe(renderToStaticMarkup(<TacticalRow {...props} />));
  const { left } = await facts();
  const el = dom(<StockDispatchRow leftAsset={left} rightAsset={{ symbol: 'CASH', isCash: true }} tier="star" />);
  expect(el.textContent.match(/2×/g)).toHaveLength(1); expect(el.textContent).toContain('CASH');
});

it('a qualified committed frame shows a comparison, while missing evidence or time remains unavailable', async () => {
  const { battle } = await facts();
  const comparison = b => selectComparison({ status: 'active', complete: false, browserPair: null, scoreState: validCommittedStockScores(b) ? b.scoreState : {}, contextKey: b.id, nowMs: Date.parse(STOCK_TEST_NOW) + 60000 });
  expect(comparison(battle)).toMatchObject({ available: true, pair: [battle.scoreState.currentScore, battle.scoreState.opponentScore] });
  expect(comparison({ ...battle, scoreState: { ...battle.scoreState, lastScoredAt: null } }).available).toBe(false);
  expect(comparison({ ...battle, scoreState: { ...battle.scoreState, stockScoreEvidence: { status: 'unavailable' } } }).available).toBe(false);
});
