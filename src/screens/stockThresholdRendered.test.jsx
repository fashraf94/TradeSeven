// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { STOCK_TEST_NOW, correctedStockBattle } from '../../api/_utils/__fixtures__/stockThresholdHarness.js';
import { correctedScorePatch, scoreCorrectedPosition } from '../../api/_utils/stockThresholdAdmission.js';
import { stockWriterDb } from '../../api/_utils/__fixtures__/stockThresholdHarness.js';
// Infrastructure is replaced; row, canonical scorer, Why and tab are real.
vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
import { StockDispatchRow, enrichHeldPosition } from './AgentBattleScreen.jsx';
import BaggerBombTab, { StockRewardDetails } from '../components/draft/ResearchTabs/BaggerBombTab.jsx';
import { stockRewardContext, measuredProximity, stockSummary } from '../utils/stockThresholdModel.js';
import WhyPanel from './battleView/WhyPanel.jsx';
import { selectWhyState, deriveTierPrices } from './battleView/selectWhyState.js';
import { buildResearchAsset } from '../utils/researchAssetBuilder.js';
const oldKey = process.env.EODHD_API_KEY;
beforeAll(() => { process.env.EODHD_API_KEY = 'isolated-key'; });
afterAll(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; });
async function renderedFacts() {
  const { battle } = await correctedStockBattle();
  const prices = { AAPL: { current: 107, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
  const a = scoreCorrectedPosition(battle, { ...battle.portfolio.star[0], tier: 'star' }, 'agent', prices, STOCK_TEST_NOW), c = scoreCorrectedPosition(battle, { ...battle.opponent.portfolio.star[0], tier: 'star' }, 'cpu', prices, STOCK_TEST_NOW);
  const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [a], [c], STOCK_TEST_NOW)); Object.assign(battle, h.store.get('battle'));
  return { battle, left: enrichHeldPosition(battle.portfolio.star[0], 'star', { stockBattle: battle, stockSide: 'agent', stockSlot: 0 }), right: enrichHeldPosition(battle.opponent.portfolio.star[0], 'star', { stockBattle: battle, stockSide: 'cpu', stockSlot: 0 }) };
}
describe('real rendered pinned stock detail integration', () => {
  it('row/Why/research display all six exact shared targets with selector false', async () => {
    const { left, right } = await renderedFacts();
    const row = renderToStaticMarkup(<StockDispatchRow leftAsset={left} rightAsset={right} renderWhy={() => <WhyPanel symbol="AAPL" state={selectWhyState(null, 'AAPL', STOCK_TEST_NOW)} lines={deriveTierPrices(null, null, null, left.rewardContext)} proximity={left.rewardContext.proximity} />} />);
    const research = buildResearchAsset(left, { thresholds: { AAPL: { threshold: 99 } }, livePrices: { AAPL: 999 }, useDefaultThreshold: true });
    const tab = renderToStaticMarkup(<BaggerBombTab asset={research} />);
    for (const t of left.rewardContext.targets) { expect(row).toContain(`exact $${t.target}`); expect(tab).toContain(`exact $${t.target}`); }
    expect(row).toContain('Why?'); expect(row).toContain('position-agent'); expect(row).toContain('position-cpu'); expect(tab).toContain('2.000000%'); expect(tab).not.toContain('99.00');
    expect(research.rewardContext).toEqual(left.rewardContext);
  });
  it('review K1-3: the Why disclosure carries no half-up cent tier line beside the exact targets', async () => {
    const { left } = await renderedFacts();
    expect(deriveTierPrices(null, null, null, left.rewardContext)).toBe(null);
    const row = renderToStaticMarkup(<StockDispatchRow leftAsset={left} renderWhy={() => <WhyPanel symbol="AAPL" state={selectWhyState(null, 'AAPL', STOCK_TEST_NOW)} lines={deriveTierPrices(null, null, null, left.rewardContext)} proximity={left.rewardContext.proximity} />} />);
    expect(row).not.toContain('Bagger $'); expect(row).toContain(`exact $${left.rewardContext.targets[0].target}`);
    expect(deriveTierPrices(100, 2)).toEqual({ bagger: 102, bust: 98 });
  });
  it('review K1-6: a measured tier whose exact target is at or below $0 reads unreachable, not unearned', async () => {
    const { battle } = await correctedStockBattle({ fill: 10, scoringPct: 60 });
    const c = stockRewardContext(battle, { ...battle.portfolio.star[0], tier: 'star' }, 'agent', 'star', 0, { price: 10, asOf: STOCK_TEST_NOW, observedAt: STOCK_TEST_NOW });
    const html = renderToStaticMarkup(<StockRewardDetails context={c} />);
    expect(c.targets.find(t => t.key === 'meltdown').target).toBeLessThan(0);
    // v2 Ruling 15 layout: each tier row carries its state; an unreachable target shows no price.
    expect(html).toMatch(/data-tier="meltdown" data-tier-status="unreachable"[^]*?—[^]*?unreachable/);
    expect(html).toMatch(/data-tier="bagger" data-tier-status="unearned"/);
    // Mutation lens KM-40: exactly $0 (k = −2 at 50%) is unreachable too.
    const { battle: atZero } = await correctedStockBattle({ fill: 10, scoringPct: 50 });
    const z = stockRewardContext(atZero, { ...atZero.portfolio.star[0], tier: 'star' }, 'agent', 'star', 0, { price: 10, asOf: STOCK_TEST_NOW, observedAt: STOCK_TEST_NOW });
    expect(z.targets.find(t => t.key === 'meltdown').target).toBe(0);
    expect(renderToStaticMarkup(<StockRewardDetails context={z} />)).toMatch(/data-tier="meltdown" data-tier-status="unreachable"/);
  });
  it('v2 Ruling 15: Why gets the measured proximity line from the committed context; the corrected row shows the bagger footer it is given', async () => {
    const { left } = await renderedFacts();
    const expected = measuredProximity(left.rewardContext);
    expect(expected.text).toBe(`${left.rewardContext.nextTarget.emoji} ${stockSummary((left.rewardContext.nextTarget.target - left.rewardContext.currentPrice) / left.rewardContext.currentPrice * 100, 1)}% to ${left.rewardContext.nextTarget.label}`);
    let received = null;
    const row = renderToStaticMarkup(<StockDispatchRow leftAsset={left} baggerFooter="Bagger hit · +15 banked" renderWhy={p => { received = p; return <WhyPanel symbol="AAPL" state={selectWhyState(null, 'AAPL', STOCK_TEST_NOW)} lines={deriveTierPrices(null, null, null, left.rewardContext)} proximity={p} />; }} />);
    expect(received).toEqual(expected); expect(row).toContain(expected.text);
    expect(row).toContain('data-bagger-footer="1"'); expect(row).toContain('Bagger hit · +15 banked');
    // Every positive tier earned → MAX; unavailable → no line.
    const maxed = { ...left.rewardContext, nextTarget: null };
    expect(measuredProximity(maxed).text).toBe(`${left.rewardContext.targets.find(t => t.key === 'tenBagger').emoji} MAX`);
    expect(measuredProximity({ status: 'unavailable', reason: 'x' })).toBe(null);
  });
  it('v2 Ruling 15: the tab reads the normal layout — Entry is the fill, % moves, targets, earned state and points', async () => {
    const { left } = await renderedFacts();
    const c = left.rewardContext; // fill 103.27, frozen 2%, committed quote 107 (+3.61%) crosses 1.0x and 1.5x
    const tab = renderToStaticMarkup(<BaggerBombTab asset={buildResearchAsset(left)} />);
    expect(tab).toContain('BAGGERBOMB STATS'); expect(tab).toContain(`Entry: <span style="color:#e0e0e0;font-weight:600">$${stockSummary(c.fill)}</span>`);
    for (const t of c.targets) {
      const status = c.crossedTiers.includes(t.key) ? 'earned' : 'unearned';
      expect(tab).toMatch(new RegExp(`data-tier="${t.key}" data-tier-status="${status}"[^]*?${t.k > 0 ? '\\+' : '-'}${stockSummary(Math.abs(t.k) * c.scoringPct).replace('.', '\\.')}%[^]*?\\$${stockSummary(t.target).replace('.', '\\.')}`));
    }
    expect(c.crossedTiers).toEqual(['bagger', 'doubleBagger']);
    expect(tab).toMatch(/data-tier="tenBagger" data-tier-status="unearned"/);
  });
  it('corrupt tuple/missing receipt remain unavailable through row and real tab', async () => {
    const { battle } = await renderedFacts(); battle.scoring.stockThresholdModel = null;
    const left = enrichHeldPosition(battle.portfolio.star[0], 'star', { stockBattle: battle });
    expect(renderToStaticMarkup(<StockDispatchRow leftAsset={left} />)).toContain('unsupported_stock_model');
    expect(renderToStaticMarkup(<BaggerBombTab asset={buildResearchAsset(left)} />)).toContain('unavailable');
  });
});
