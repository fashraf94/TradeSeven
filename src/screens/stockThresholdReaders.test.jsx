// @vitest-environment jsdom
// BaggerBomb stock thresholds v2, Ruling 16 (src readers): the bagger moment
// fires from the committed crossed tiers (K1-5), and the dashboard, review,
// history and desk readers show "—" for an unavailable measured score — never
// 0 — while legacy battles read exactly as before.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
import { STOCK_TEST_NOW, correctedStockBattle, stockWriterDb } from '../../api/_utils/__fixtures__/stockThresholdHarness.js';
import { correctedScorePatch, scoreCorrectedPosition } from '../../api/_utils/stockThresholdAdmission.js';
import { persistedMaxMultiplier, deriveBaggerCrossings, baggerMomentFacts, BAGGER_LINE } from './battleView/deriveBaggerMoment.js';
import { enrichHeldPosition } from './AgentBattleScreen.jsx';
import ManageStation from '../components/Dashboard/ManageStation.jsx';
import ReviewStation from '../components/Dashboard/ReviewStation.jsx';
import BattleHistoryScreen from './BattleHistoryScreen.jsx';
import { buildBaggerbombAdapter } from '../adapters/baggerbombAdapter.js';

const oldKey = process.env.EODHD_API_KEY;
beforeAll(() => { process.env.EODHD_API_KEY = 'isolated-key'; });
afterAll(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; });

async function committedBattle(quote) {
  const { battle } = await correctedStockBattle({ fill: 100 });
  const prices = { AAPL: { current: quote, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
  const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
  const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW)); Object.assign(battle, h.store.get('battle'));
  return battle;
}
const legacyOf = battle => { const b = structuredClone(battle); delete b.scoring.stockThresholdModel; delete b.portfolio.star[0].stockThresholdReceipt; return b; };

describe('bagger moment (K1-5)', () => {
  it('fires once from the committed crossed tiers, never from thresholdHistory; the bubble names the frozen measured %', async () => {
    const before = await committedBattle(101.5); // +1.5%: under the 2% BaggerBomb
    const after = await committedBattle(102.5); // +2.5%: crossed
    expect(persistedMaxMultiplier(before, 'AAPL')).toBe(0);
    expect(persistedMaxMultiplier(after, 'AAPL')).toBe(BAGGER_LINE);
    const seed = deriveBaggerCrossings(null, before, ['AAPL']);
    expect(seed.crossed).toEqual([]);
    expect(deriveBaggerCrossings(seed.next, after, ['AAPL']).crossed).toEqual(['AAPL']);
    expect(deriveBaggerCrossings(deriveBaggerCrossings(seed.next, after, ['AAPL']).next, after, ['AAPL']).crossed).toEqual([]);
    // A stale legacy history entry on a measured battle never fires the moment.
    before.thresholdHistory = { AAPL: { maxMultiplier: 5 } };
    expect(persistedMaxMultiplier(before, 'AAPL')).toBe(0);
    const row = enrichHeldPosition(after.portfolio.star[0], 'star', { stockBattle: after, stockSide: 'agent', stockSlot: 0 });
    expect(baggerMomentFacts(row, 'star')).toEqual({ mult: 2, pct: 2 });
    expect(baggerMomentFacts({ ...row, rewardContext: { status: 'unavailable', reason: 'x' } }, 'star')).toBe(null);
  });
  // Real writer frames in one store: a quote, or null for a Ruling 3 unavailable
  // frame (missing quote), committed through correctedScorePatch (review B3-1).
  async function frames(...quotes) {
    const { battle } = await correctedStockBattle({ fill: 100 }); const h = stockWriterDb({ battle }); const out = [];
    for (const [i, quote] of quotes.entries()) {
      const at = new Date(Date.parse(STOCK_TEST_NOW) + (i + 1) * 600000).toISOString(); const b = h.store.get('battle');
      const prices = quote == null ? {} : { AAPL: { current: quote, timestamp: Date.parse(at) / 1000 - 60 } };
      const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(b, { ...(side === 'agent' ? b.portfolio : b.opponent.portfolio).star[0], tier: 'star' }, side, prices, at));
      await h.db.doc('battle').update(correctedScorePatch(b, [scores[0]], [scores[1]], at)); out.push(structuredClone(h.store.get('battle')));
    }
    return out;
  }
  const walk = (seen, docs) => docs.reduce((acc, doc) => { const r = deriveBaggerCrossings(acc.seen, doc, ['AAPL']); return { seen: r.next, crossed: [...acc.crossed, ...r.crossed] }; }, { seen, crossed: [] });
  it('an unavailable frame is unknown, never 0: an old crossing is not announced again, a new one fires exactly once, a seed taken while unknown fires nothing (review B3-1)', async () => {
    const [crossed, gap, back] = await frames(102.6, null, 101);
    expect(persistedMaxMultiplier(gap, 'AAPL')).toBe(null);
    expect(persistedMaxMultiplier(back, 'AAPL')).toBe(BAGGER_LINE); // the lifetime keeps its crossing below the line
    const seed = deriveBaggerCrossings(null, crossed, ['AAPL']);
    expect(walk(seed.next, [gap, back]).crossed).toEqual([]);
    const [under, gap2, over] = await frames(101, null, 102.6);
    expect(walk(deriveBaggerCrossings(null, under, ['AAPL']).next, [gap2, over, over]).crossed).toEqual(['AAPL']);
    expect(walk(deriveBaggerCrossings(null, gap, ['AAPL']).next, [back, back]).crossed).toEqual([]);
  });
  it('legacy control: thresholdHistory drives it exactly as before', async () => {
    const legacy = legacyOf(await committedBattle(101.5)); legacy.thresholdHistory = { AAPL: { maxMultiplier: 1.2 } };
    expect(persistedMaxMultiplier(legacy, 'AAPL')).toBe(1.2);
    expect(baggerMomentFacts({ symbol: 'AAPL', baseATR: 2.5 }, 'star')).toEqual({ mult: 2, pct: 2.5 });
  });
});

describe('dashboard, review, history and desk show "—" for an unavailable measured score, never 0', () => {
  const nullScores = battle => ({ ...battle, scoreState: { ...battle.scoreState, currentScore: null, opponentScore: null, stockScoreEvidence: { status: 'unavailable', reason: 'roster_changed_awaiting_score' } } });
  it('ManageStation and ReviewStation render "—" for an unavailable score and for a result-unavailable completion; legacy shows its number', async () => {
    const battle = await committedBattle(101.5);
    const manage = renderToStaticMarkup(<ManageStation battle={{ ...nullScores(battle), expiresAt: '2099-01-01T00:00:00Z', agentContext: { agentName: 'Cipher' } }} agent={{ name: 'Cipher' }} accent="#fff" onOpen={() => {}} />);
    expect(manage).toContain('—'); expect(manage).not.toContain('+0.00');
    // A finite stored score beside unavailable evidence still reads "—" (review B3-10a).
    const stale = renderToStaticMarkup(<ManageStation battle={{ ...battle, scoreState: { ...battle.scoreState, currentScore: 30, opponentScore: 12, stockScoreEvidence: { status: 'unavailable', reason: 'roster_changed_awaiting_score' } }, expiresAt: '2099-01-01T00:00:00Z', agentContext: { agentName: 'Cipher' } }} agent={{ name: 'Cipher' }} accent="#fff" onOpen={() => {}} />);
    expect(stale).toContain('—'); expect(stale).not.toContain('+30.00');
    const done = { ...battle, status: 'completed', completionContext: 'corrected_score_unavailable', completedAt: '2026-10-14T20:05:00.000Z', agentContext: { agentName: 'Cipher' } };
    const review = renderToStaticMarkup(<ReviewStation battles={[done]} agent={{ name: 'Cipher' }} accent="#fff" onReview={() => {}} />);
    expect(review).toContain('—'); expect(review).not.toContain(`${battle.scoreState.currentScore}`);
    const legacy = { ...legacyOf(battle), scoreState: { currentScore: 5, opponentScore: 2 }, expiresAt: '2099-01-01T00:00:00Z', agentContext: { agentName: 'Cipher' } };
    expect(renderToStaticMarkup(<ManageStation battle={legacy} agent={{ name: 'Cipher' }} accent="#fff" onOpen={() => {}} />)).toContain('+5.00');
  });
  it('BattleHistory hides the score and outcome of a result-unavailable completion; legacy keeps them', async () => {
    const battle = await committedBattle(101.5);
    const done = { ...battle, id: 'b-done', status: 'completed', completionContext: 'corrected_score_unavailable', completedAt: '2026-10-14T20:05:00.000Z' };
    const legacy = { ...legacyOf(battle), id: 'b-legacy', status: 'completed', completedAt: '2026-10-13T20:05:00.000Z', scoreState: { currentScore: 12, opponentScore: 4 } };
    const html = renderToStaticMarkup(<BattleHistoryScreen containerStyle={{}} colors={{}} previousBattles={[]} completedDraftBattles={[]} completedTrainingBattles={[]} completedAgentBattles={[done, legacy]} historyTab="agent" setHistoryTab={() => {}} user={{}} onBack={() => {}} BattleHistoryCard={() => null} />);
    expect(html).toContain('12 – 4 pts');
    expect(html).not.toContain(`${battle.scoreState.currentScore} – ${battle.scoreState.opponentScore} pts`);
  });
  it('the desk adapter keeps an unavailable score null and a legacy score as stored', async () => {
    const battle = await committedBattle(101.5);
    expect(buildBaggerbombAdapter(nullScores(battle), null, { name: 'Cipher' }, Date.parse(STOCK_TEST_NOW), 'open').score.current).toBe(null);
    expect(buildBaggerbombAdapter({ ...battle, status: 'completed', completionContext: 'corrected_score_unavailable' }, null, { name: 'Cipher' }, Date.parse(STOCK_TEST_NOW), 'closed').score.current).toBe(null);
    expect(buildBaggerbombAdapter(battle, null, { name: 'Cipher' }, Date.parse(STOCK_TEST_NOW), 'open').score.current).toBe(battle.scoreState.currentScore);
    const legacy = { ...legacyOf(battle), scoreState: { currentScore: 0, opponentScore: 0 } };
    expect(buildBaggerbombAdapter(legacy, null, { name: 'Cipher' }, Date.parse(STOCK_TEST_NOW), 'open').score.current).toBe(0);
  });
});
