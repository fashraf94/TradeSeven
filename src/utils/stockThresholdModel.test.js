// Real Node-clean imports: no mocked SDK/browser dependencies or scorer copies.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED } from '../config/featureFlags.js';
import { stockModelRoute, stockRewardContext, stockSummary, initialRewardHistory, committedStockContext, validCommittedStockScores } from './stockThresholdModel.js';
import { calculateAssetScoreV3 } from './baggerBombUtils.js';
import { calculateAssetScoreServer } from '../../api/_utils/agentScoring.js';
import { correctedStockBattle, STOCK_TEST_NOW } from '../../api/_utils/__fixtures__/stockThresholdHarness.js';
import { stockWriterDb } from '../../api/_utils/__fixtures__/stockThresholdHarness.js';
import { correctedScorePatch, scoreCorrectedPosition } from '../../api/_utils/stockThresholdAdmission.js';
import { evaluateRisk } from '../../api/_utils/agentRiskManager.js';
import { evaluateTriggers } from '../../api/_utils/agentTriggerGate.js';
import { applyGuardrails } from '../../api/_utils/agentGuardrails.js';
import { resolveHurdleAtr } from '../../api/_utils/hurdleAtr.js';
import { buildPortfolioCSV } from '../../api/_utils/agentEvalPromptAssembly.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const key = process.env.EODHD_API_KEY;
beforeAll(() => { process.env.EODHD_API_KEY = 'isolated-test-key'; });
afterAll(() => { if (key === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = key; });
function adjacent(n, up) { const a = new Float64Array([n]), b = new BigUint64Array(a.buffer); b[0] += up ? 1n : -1n; return a[0]; }
const quote = price => ({ price, asOf: STOCK_TEST_NOW, observedAt: STOCK_TEST_NOW });
describe('pinned stock context', () => {
  it('locks the exact canonical-LF calendar source under the adopted policy', () => {
    const source = readFileSync(new URL('./marketCalendar.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(source).digest('hex')).toBe('f03b061c7241fdc8b004c7fd616811457b488f29feb8bf618fa476c7b3ff14de');
  });
  it('pins admission true (v2 Ruling 6: the control document is the on-switch) without coupling existing dispatch', async () => {
    expect(STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED).toBe(true);
    expect(stockModelRoute((await correctedStockBattle()).battle).status).toBe('corrected');
    expect(stockModelRoute({ scoring: {} }).status).toBe('legacy');
  });
  it.each([null, {}, { modelId: 'future' }])('present corrupt stamp %j refuses', stamp => expect(stockModelRoute({ scoring: { stockThresholdModel: stamp } }).status).toBe('unavailable'));
  it.each([null, 'unregistered_rule'])('publication rule ID %j cannot replace the registered tuple', async id => {
    const { battle } = await correctedStockBattle(); battle.scoring.stockThresholdModel.publicationRuleId = id;
    expect(stockModelRoute(battle)).toMatchObject({ status: 'unavailable', reason: 'unsupported_stock_model' });
  });
  it('impossible timestamps and altered committed quote operands are unavailable', async () => {
    const { battle } = await correctedStockBattle(); battle.scoring.stockThresholdModel.admittedAt = '2026-02-30T14:03:00Z'; expect(stockModelRoute(battle).status).toBe('unavailable');
    const { battle: valid } = await correctedStockBattle(); const h = stockWriterDb({ battle: valid });
    const prices = { AAPL: { current: 107, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
    const s = ['agent', 'cpu'].map(side => scoreCorrectedPosition(valid, { ...(side === 'agent' ? valid.portfolio : valid.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
    await h.db.doc('battle').update(correctedScorePatch(valid, [s[0]], [s[1]], STOCK_TEST_NOW));
    const altered = h.store.get('battle'); altered.scoring.stockRewardContexts.agent['position-agent'].currentPrice = 105;
    expect(validCommittedStockScores(altered)).toBe(false); expect(committedStockContext(altered, altered.portfolio.star[0], 'agent', 'star', 0).status).toBe('unavailable');
  });
  it('awards all six direct targets and binary64 adjacent quotes identically server/client', async () => {
    const { battle } = await correctedStockBattle({ scoringPct: 1.361372 });
    const a = battle.portfolio.star[0];
    const targets = stockRewardContext(battle, a, 'agent', 'star', 0, quote(a.swapPrice)).targets;
    for (const t of targets) for (const [q, earned] of [[t.target, true], [adjacent(t.target, t.k > 0), true], [adjacent(t.target, t.k < 0), false]]) {
      const c = stockRewardContext(battle, a, 'agent', 'star', 0, quote(q));
      expect(c.crossedTiers.includes(t.key), `${t.key} ${q}`).toBe(earned);
      const client = calculateAssetScoreV3({ ...a, tier: 'star' }, null, {}, {}, null, c);
      expect(calculateAssetScoreServer({ ...a, tier: 'star' }, null, {}, {}, null, c)).toEqual(client);
      expect(client.badges.includes(t.key)).toBe(earned);
      if (t.k > 0 && earned) expect(c.nextTarget?.key).not.toBe(t.key);
    }
  });
  it('keeps same-cent summaries outside authority, and rounds display half-even', async () => {
    expect(stockSummary(100.005)).toBe('100.00'); expect(stockSummary(100.015)).toBe('100.02');
    const { battle } = await correctedStockBattle({ fill: 0.5, scoringPct: 0.000001 }); const a = battle.portfolio.star[0];
    const target = 0.5 * (1 + 0.000001 / 100);
    expect(stockSummary(target)).toBe(stockSummary(adjacent(target, false)));
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, quote(adjacent(target, false))).crossedTiers).not.toContain('bagger');
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, quote(target)).crossedTiers).toContain('bagger');
  });
  it('retains earned tiers on retracement with separate CPU fills, refuses former lifetime history', async () => {
    const { battle } = await correctedStockBattle({ cpuFill: 120 }); const a = battle.portfolio.star[0], cpu = battle.opponent.portfolio.star[0];
    const c = stockRewardContext(battle, a, 'agent', 'star', 0, quote(a.swapPrice * 1.04));
    battle.scoring.stockRewardHistory.agent[a.positionId] = c.history;
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, quote(a.swapPrice)).crossedTiers).toContain('bagger');
    expect(stockRewardContext(battle, cpu, 'cpu', 'star', 0, quote(cpu.swapPrice)).crossedTiers).toEqual([]);
    a.stockThresholdReceipt.positionId = 're-entry';
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, quote(a.swapPrice)).status).toBe('unavailable');
    expect(initialRewardHistory(cpu.stockThresholdReceipt).crossedTiers).toEqual([]);
  });
  it('ignores whole-session extremes and refuses missing/pre-fill observations', async () => {
    const { battle } = await correctedStockBattle(); const a = battle.portfolio.star[0];
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, { ...quote(a.swapPrice), high: 1000, low: 1 }).crossedTiers).toEqual([]);
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, { price: 100 }).status).toBe('unavailable');
    // v2 Ruling 1: the lower bound is the fill quote's provider time (13:47), not the
    // 14:02 commit — 14:01 is a valid later quote; 13:46 is before the fill.
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, { ...quote(100), asOf: '2026-10-14T14:01:00Z' }).status).toBe('valid');
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, { ...quote(100), asOf: '2026-10-14T13:46:00Z' }).status).toBe('unavailable');
  });
  it('corrupt receipt content makes both committed display and comparison unavailable', async () => {
    const { battle } = await correctedStockBattle(); const a = battle.portfolio.star[0];
    const p = { AAPL: { current: a.swapPrice, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
    const s = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, p, STOCK_TEST_NOW));
    const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [s[0]], [s[1]], STOCK_TEST_NOW)); Object.assign(battle, h.store.get('battle'));
    expect(validCommittedStockScores(battle)).toBe(true);
    battle.portfolio.star[0].stockThresholdReceipt.scoringPct = 4; battle.portfolio.star[0].stockThresholdReceipt.scoringPctDecimal = '4.000000';
    expect(committedStockContext(battle, battle.portfolio.star[0], 'agent', 'star', 0).reason).toBe('committed_receipt_content_mismatch'); expect(validCommittedStockScores(battle)).toBe(false);
  });
  it('negative proximity wakes use retained direct tiers; calibrated emergency still has priority', async () => {
    const { battle } = await correctedStockBattle(); const a = { ...battle.portfolio.star[0], tier: 'star' };
    battle.evaluations = [{}]; battle.expiresAt = '2099-01-01T00:00:00Z';
    for (const k of [-0.9, -1.4, -1.9]) {
      const q = a.swapPrice * (1 + k * 2 / 100); const c = stockRewardContext(battle, a, 'agent', 'star', 0, quote(q));
      const s = calculateAssetScoreV3(a, null, {}, {}, null, c);
      expect(c.penaltyProximity.approaching).toBe(true);
      expect(evaluateTriggers(battle, [s], {}, [], {}, []).triggers.some(t => t.type === 'threshold_proximity')).toBe(true);
      const corrected = evaluateRisk(a, q, a.swapPrice, a.baseATR, null, {}, {}, null, c);
      const legacy = evaluateRisk(a, q, a.swapPrice, a.baseATR, null, {});
      if (legacy.action === 'EMERGENCY_SWAP') expect(corrected.action).toBe('EMERGENCY_SWAP');
    }
  });
  it('quantifies reward-dependent LOCK changes on a fixed quote grid while preserving non-LOCK risk outcomes', async () => {
    const { battle } = await correctedStockBattle(); const a = battle.portfolio.star[0]; let changed = 0, compared = 0;
    for (let n = -40; n <= 60; n++) {
      const move = n / 10;
      const q = a.swapPrice * (1 + move / 100), c = stockRewardContext(battle, a, 'agent', 'star', 0, quote(q));
      const legacy = evaluateRisk(a, q, a.swapPrice, a.baseATR, null, {}), corrected = evaluateRisk(a, q, a.swapPrice, a.baseATR, null, {}, {}, null, c);
      compared++; if (legacy.action !== corrected.action) { changed++; expect([legacy.action, corrected.action]).toContain('LOCK'); }
    }
    expect(compared).toBe(101); expect(changed).toBeGreaterThan(0);
    console.log(JSON.stringify({ rewardDecisionGrid: { compared, changed, calibratedATR: a.baseATR, rewardPct: a.stockThresholdReceipt.scoringPct } }));
  });
  it('paired emergency, VWAP, stepped trail and stagnation calls retain calibrated operands and outcomes', async () => {
    const { battle } = await correctedStockBattle({ fill: 100 }); const a = { ...battle.portfolio.star[0], tier: 'star', dailyPct: 0 };
    const archetype = { hftConfig: { forcedRotation: { enabled: true, ticksThreshold: 3, winnerThreshold: 0.002, pctThreshold: 0.001 } } };
    const cases = [
      [90, null, {}, null, 'bust_avoidance'],
      [101.8, { vwap: 103, vwapDeviation: -1 }, { ticksBelowVwap: 2 }, null, 'vwap_failure'],
      [104.2, { sma20_5m: 105 }, {}, null, 'stepped_trail'],
      [100, null, { withinAge: true, stagnationTicks: 3 }, archetype, 'stagnation'],
    ];
    for (const [q, intraday, memory, config, reason] of cases) {
      const c = stockRewardContext(battle, a, 'agent', 'star', 0, quote(q));
      const legacy = evaluateRisk(a, q, 100, 2.5, intraday, memory, {}, config);
      const corrected = evaluateRisk(a, q, 100, a.baseATR, intraday, memory, {}, config, c);
      expect(legacy.reason).toBe(reason); expect(corrected).toEqual(legacy);
    }
  });
  it('hard stops and trailing drawdown use matching calibrated history; fresh/frozen hurdles retain units', async () => {
    const { battle } = await correctedStockBattle({ fill: 100 }); const a = battle.portfolio.star[0];
    battle.scoring.stockRiskHistory.agent[a.positionId].maxMultiplier = 4;
    battle.scoring.stockRewardHistory.agent[a.positionId].maxMultiplier = 99;
    const legacy = structuredClone(battle); delete legacy.scoring.stockThresholdModel; delete legacy.portfolio.star[0].stockThresholdReceipt; legacy.thresholdHistory.AAPL = { maxMultiplier: 4 };
    for (const [type, current, value] of [['stopLoss', 90, 8], ['trailingStop', 99, 9]]) {
      const args = { haikuResult: { decision: 'HOLD' }, guardrails: [{ type, value, unit: '%', enforcement: 'hard' }], prices: { AAPL: { current }, MSFT: { current: 100 } } };
      const expected = applyGuardrails({ ...args, battle: legacy });
      expect(expected.sourceNote).toBe(`guardrail_${type}`);
      expect(applyGuardrails({ ...args, battle })).toEqual(expected);
    }
    expect(resolveHurdleAtr(a.symbol, new Map([[a.symbol, 0.5]]), a.baseATR)).toEqual({ atr: 4, source: 'fresh' });
    expect(resolveHurdleAtr(a.symbol, new Map(), a.baseATR)).toEqual({ atr: 2.5, source: 'frozen' });
  });
  it('paired held prompt facts expose measured reward and calibrated risk without changing legacy row output', async () => {
    const { battle } = await correctedStockBattle({ fill: 100 }); const a = { ...battle.portfolio.star[0], tier: 'star' }, q = 101.8;
    const prices = { AAPL: { current: q } }, c = stockRewardContext(battle, a, 'agent', 'star', 0, quote(q));
    const measured = calculateAssetScoreServer(a, null, {}, {}, null, c), legacy = calculateAssetScoreServer(a, 1.8);
    const correctedPrompt = buildPortfolioCSV([measured], prices, battle), legacyPrompt = buildPortfolioCSV([legacy], prices, battle);
    expect(correctedPrompt).toContain('frozen 2.000000%'); expect(correctedPrompt).toContain('calibrated risk ATR 2.5%');
    expect(correctedPrompt).toContain('lock true'); expect(correctedPrompt).toContain(`exact $${c.nextTarget.target}`);
    expect(legacyPrompt).not.toContain('measured reward'); expect(legacyPrompt).toContain('2.5%');
    // Review K1-4: corrected rows keep the header's identity columns (the
    // star tier carries 2x conviction), available or not.
    const [header, row] = correctedPrompt.split('\n');
    expect(header.split(',').slice(0, 4)).toEqual(['Tier', 'Symbol', 'Sector', 'Entry']);
    expect(row.startsWith('star,AAPL,Unknown,Day1,measured reward,fill $100,')).toBe(true);
    const missing = calculateAssetScoreServer(a, null, {}, {}, null, stockRewardContext(battle, a, 'agent', 'star', 0, { price: null }));
    expect(buildPortfolioCSV([missing], prices, battle).split('\n')[1]).toBe('star,AAPL,Unknown,Day1,measured reward unavailable:missing_post_entry_quote');
    // Mutation lens KM-35/36: the held row's own sector and entry day, not only the fallbacks.
    Object.assign(battle.portfolio.star[0], { sector: 'Technology', swappedInDay: 2 });
    const held = { ...battle.portfolio.star[0], tier: 'star' };
    const own = calculateAssetScoreServer(held, null, {}, {}, null, stockRewardContext(battle, held, 'agent', 'star', 0, quote(q)));
    expect(buildPortfolioCSV([own], prices, battle).split('\n')[1].startsWith('star,AAPL,Technology,Day2,measured reward,fill $100,')).toBe(true);
    // Mutation lens KM-37: a flat6 document names no tier column, stamped or not.
    const flat6 = { ...battle, gameMode: 'baggerbomb_tournament' };
    const outOfScope = calculateAssetScoreServer(held, null, {}, {}, null, stockRewardContext(flat6, held, 'agent', 'star', 0, quote(q)));
    const [flatHeader, flatRow] = buildPortfolioCSV([outOfScope], prices, flat6).split('\n');
    expect(flatHeader.startsWith('Symbol,Sector,Entry')).toBe(true);
    expect(flatRow).toBe('AAPL,Technology,Day2,measured reward unavailable:unsupported_stock_scope');
    // Deterministic decision consumer: this asserts the changed fact's meaning,
    // not a prediction of a live stochastic model's trade or call cadence.
    expect(evaluateRisk(a, q, 100, a.baseATR, null, {}, {}, null, c).action).toBe('LOCK');
    expect(evaluateRisk(a, q, 100, a.baseATR, null, {}).action).toBe('HOLD');
  });
});
