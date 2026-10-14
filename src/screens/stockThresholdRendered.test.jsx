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
import { stockRewardContext } from '../utils/stockThresholdModel.js';
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
    expect(html).toMatch(/Meltdown[^<]*unreachable \(target at or below \$0\)/);
    expect(html).toMatch(/BaggerBomb[^<]*unearned/);
  });
  it('corrupt tuple/missing receipt remain unavailable through row and real tab', async () => {
    const { battle } = await renderedFacts(); battle.scoring.stockThresholdModel = null;
    const left = enrichHeldPosition(battle.portfolio.star[0], 'star', { stockBattle: battle });
    expect(renderToStaticMarkup(<StockDispatchRow leftAsset={left} />)).toContain('unsupported_stock_model');
    expect(renderToStaticMarkup(<BaggerBombTab asset={buildResearchAsset(left)} />)).toContain('unavailable');
  });
});
