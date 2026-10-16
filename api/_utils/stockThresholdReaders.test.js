// BaggerBomb stock thresholds v2, Ruling 16 (api readers): every legacy-only
// reader resolves the pinned model on a measured-model battle — the committed
// reward context, never baseATR or thresholdHistory — and a legacy battle reads
// exactly as before. Real modules throughout; the src model import below is the
// Node dependency-surface guard (BUILD_RULES §4): never mock it.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
import { buildPortfolioBriefs } from '../cron/voice-layer-cache.js';
import { buildBattleState, buildPortfolioBriefsBlock } from './voiceLayerPrompt.js';
import { buildReflectionUserMessage } from './agentReflectionUtils.js';
import { countThresholdHits, countPenalties } from './battlePatternLogger.js';
import { composeEvidenceStamp } from './tickStamps.js';
import { buildBattleBlock, buildReplayInputs } from './filmTape/tapeAssemble.js';
import { mergeTape } from './filmTape/tapeMerge.js';
import { resolveBattleResult } from './filmTape/battleResult.js';
import { writeTapeDay } from './filmTape/writeTapeDay.js';
import { makeTapeDb } from './filmTape/__fixtures__/tapeFirestore.js';
import { seedDay, completedDay } from './filmTape/__fixtures__/tapeFixtures.js';
import { evidenceFacts } from '../../src/data/decisionRecord.js';
import { committedStockContext, displayedStockScores, stockSummary } from '../../src/utils/stockThresholdModel.js';
import { correctedScorePatch, scoreCorrectedPosition } from './stockThresholdAdmission.js';
import { correctedStockBattle, stockWriterDb, STOCK_TEST_NOW } from './__fixtures__/stockThresholdHarness.js';

const oldKey = process.env.EODHD_API_KEY;
beforeAll(() => { process.env.EODHD_API_KEY = 'isolated-key'; });
afterAll(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; });
const ts = iso => Date.parse(iso) / 1000;

// A measured-model battle with a committed frame: fill $100, frozen 2%, the quote
// at `quote` (103.5 → +3.5% = 1.75x, crossing BaggerBomb and DoubleBagger).
async function committedBattle(quote = 103.5) {
  const { battle } = await correctedStockBattle({ fill: 100 });
  const prices = { AAPL: { current: quote, timestamp: ts(STOCK_TEST_NOW) } };
  const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
  const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW)); Object.assign(battle, h.store.get('battle'));
  return battle;
}
const legacyOf = battle => { const b = structuredClone(battle); delete b.scoring.stockThresholdModel; delete b.portfolio.star[0].stockThresholdReceipt; return b; };

describe('voice cache, chat prompt and the other cache readers', () => {
  const priceMap = { AAPL: { close: 103.5, previousClose: 101, change_p: 2.475 } };
  it('a measured-model stock brief carries the multiple against the frozen %, crossed-tier badges and the context LOCK', async () => {
    const battle = await committedBattle(); const c = committedStockContext(battle, battle.portfolio.star[0], 'agent', 'star', 0);
    const [brief] = buildPortfolioBriefs(battle.portfolio, priceMap, {}, {}, battle.thresholdHistory, battle.portfolio.startingPrices, {}, { stockBattle: battle });
    expect(brief.existingBadges).toEqual(['bagger', 'doubleBagger']);
    expect(brief.thresholdProximity).toMatchObject({ unit: 'frozen_measured_pct', currentMultiplier: c.multiplier, frozenMeasuredPct: 2, swapLock: { locked: c.proximity.locked } });
    expect(brief.thresholdProximity.currentMultiplier).toBeCloseTo(1.75, 12);
    expect(Object.hasOwn(brief.thresholdProximity, 'baseATR')).toBe(false);
    const block = buildPortfolioBriefsBlock({ portfolioBriefs: [brief] });
    expect(block).toContain('Threshold: 1.8x of its frozen measured 2.00%'); expect(block).toContain('Badges earned: bagger, doubleBagger'); expect(block).not.toContain('baseATR');
  });
  it('the LOCK band rides the context: within 0.2x of the next bonus reads Swap-lock', async () => {
    const battle = await committedBattle(103.7); // next unearned: TenBagger at 104, 0.15x away
    const [brief] = buildPortfolioBriefs(battle.portfolio, { AAPL: { close: 103.7, previousClose: 101, change_p: 2.67 } }, {}, {}, {}, {}, {}, { stockBattle: battle });
    expect(brief.thresholdProximity.swapLock).toMatchObject({ locked: true, direction: 'positive', message: 'approaching TenBagger' });
    expect(brief.thresholdProximity.swapLock.distancePercent).toBeCloseTo(0.3, 12);
    expect(buildPortfolioBriefsBlock({ portfolioBriefs: [brief] })).toContain('Swap-lock: locked, 0.3pp to TenBagger');
  });
  it('an unavailable context reads unavailable, with no badges and no proximity', async () => {
    const battle = await committedBattle(); battle.scoring.stockRewardContexts.agent['position-agent'].currentPrice = 1; // corrupt the committed frame
    const [brief] = buildPortfolioBriefs(battle.portfolio, priceMap, {}, {}, {}, {}, {}, { stockBattle: battle });
    expect(brief.existingBadges).toEqual([]); expect(brief.thresholdProximity).toBeUndefined(); expect(brief.measuredRewardUnavailable).toBeTruthy();
    expect(buildPortfolioBriefsBlock({ portfolioBriefs: [brief] })).toContain('Measured reward: unavailable this check');
  });
  it('legacy control: the same stock without a stamp gets the shipped baseATR brief, byte for byte with or without stockBattle', async () => {
    const legacy = legacyOf(await committedBattle()); legacy.thresholdHistory = { AAPL: { maxMultiplier: 1.2, minMultiplier: 0 } };
    const a = buildPortfolioBriefs(legacy.portfolio, priceMap, {}, {}, legacy.thresholdHistory, {}, {}, {});
    const b = buildPortfolioBriefs(legacy.portfolio, priceMap, {}, {}, legacy.thresholdHistory, {}, {}, { stockBattle: legacy });
    expect(b).toEqual(a);
    expect(a[0].thresholdProximity).toMatchObject({ baseATR: 2.5, currentMultiplier: 2.475 / 2.5 }); expect(a[0].existingBadges).toEqual(['bagger']);
    expect(buildPortfolioBriefsBlock({ portfolioBriefs: a })).toContain('Threshold: 1.0x (baseATR 2.5%)');
  });
  it('the chat battle state reads an unavailable score as unavailable, never "0 — 0 (TIED)"; valid and legacy scores read as before', async () => {
    const battle = await committedBattle();
    expect(buildBattleState(battle)).toContain(`- Score: You ${battle.scoreState.currentScore} — Opponent ${battle.scoreState.opponentScore}`);
    const pending = { ...battle, scoreState: { ...battle.scoreState, currentScore: null, opponentScore: null, stockScoreEvidence: { status: 'unavailable', reason: 'roster_changed_awaiting_score' } } };
    const text = buildBattleState(pending);
    expect(text).toContain('- Score: unavailable'); expect(text).not.toContain('You 0'); expect(text).not.toContain('TIED');
    expect(text).toContain('- Game state: unknown (score unavailable)');
    const done = { ...battle, status: 'completed', completionContext: 'corrected_score_unavailable' };
    expect(buildBattleState(done)).toContain('- Score: unavailable');
    // A result-unavailable completion keeps its last stored (finite) score; the
    // urgency must not be read from it either (review B3-8).
    const stale = buildBattleState({ ...done, scoreState: { ...battle.scoreState, currentScore: -185, opponentScore: 40 } });
    expect(stale).toContain('- Game state: unknown (score unavailable)'); expect(stale).toContain('- Urgency: unknown (score unavailable)');
    expect(buildBattleState(legacy0())).toMatch(/- Urgency: (?!unknown)/);
    function legacy0() { return { ...legacyOf(battle), scoreState: { currentScore: 0, opponentScore: 0 } }; }
    const legacy = legacy0();
    expect(buildBattleState(legacy)).toContain('- Score: You 0 — Opponent 0 (TIED by 0 pts)');
    expect(displayedStockScores(legacy)).toBe(legacy.scoreState);
  });
  it('a receipt is bound to its battle id: an id-less battle doc reads unavailable, so the chat handler attaches the id', async () => {
    const battle = await committedBattle(); const { id, ...withoutId } = battle;
    expect(id).toBe('stock-battle');
    expect(buildBattleState(withoutId)).toContain('- Score: unavailable');
    expect(buildBattleState({ id, ...withoutId })).toContain(`- Score: You ${battle.scoreState.currentScore}`);
    const chat = readFileSync(new URL('../agent/chat.js', import.meta.url), 'utf8');
    expect(chat).toContain('const battle = battleDoc.data();');
    expect(chat).toMatch(/buildVoiceLayerPrompt\(\{\s*agent,[^}]*?battle: \{ id: battleId, \.\.\.battle \},/);
  });
});

describe('reflection THRESHOLDS block', () => {
  it('a measured-model battle prints the committed context; legacy prints the shipped line', async () => {
    const battle = await committedBattle(); battle.status = 'completed'; battle.scoring.thresholds = { AAPL: { threshold: 2.5 }, 'BTC-USD.CC': { threshold: 5 } };
    battle.thresholdHistory = { 'BTC-USD.CC': { maxMultiplier: 0.4, minMultiplier: -0.1 } };
    const c = committedStockContext(battle, battle.portfolio.star[0], 'agent', 'star', 0);
    const msg = buildReflectionUserMessage(battle, { name: 'Cipher', archetype: 'diversifier' });
    expect(msg).toContain(`  AAPL: frozen measured 2.000000% from fill $100, mult=${c.multiplier.toFixed(2)}, maxMult=${c.history.maxMultiplier.toFixed(2)}, minMult=${c.history.minMultiplier.toFixed(2)}, crossed [bagger|doubleBagger]`);
    expect(msg).toContain('  BTC-USD.CC: baseATR=5, maxMult=0.40, minMult=-0.10');
    expect(msg).not.toContain('AAPL: baseATR=2.5');
    // Agent battles key crypto by its bare symbol (review B3-3); a stock key that
    // is no longer held prints nothing in the measured block.
    battle.scoring.thresholds = { AAPL: { threshold: 2.5 }, BTC: { threshold: 5 }, MSFT: { threshold: 3 } };
    battle.thresholdHistory = { BTC: { maxMultiplier: 0.4, minMultiplier: -0.1 } };
    const bare = buildReflectionUserMessage(battle, { name: 'Cipher', archetype: 'diversifier' });
    expect(bare).toContain('  BTC: baseATR=5, maxMult=0.40, minMult=-0.10');
    expect(bare).not.toContain('MSFT: baseATR=3');
    const legacy = legacyOf(battle);
    expect(buildReflectionUserMessage(legacy, { name: 'Cipher', archetype: 'diversifier' })).toContain('  AAPL: baseATR=2.5, maxMult=0.00, minMult=0.00');
  });
});

describe('pattern logger hits and penalties', () => {
  it('count crossed tiers of every measured lifetime (held and banked) plus legacy crypto history; legacy unchanged', async () => {
    const battle = await committedBattle();
    battle.scoring.stockRewardHistory.agent.banked = { positionId: 'banked', crossedTiers: ['bust', 'crash'] };
    battle.thresholdHistory = { 'BTC-USD.CC': { maxMultiplier: 1.6, minMultiplier: 0 } };
    expect(countThresholdHits(battle)).toEqual({ bagger: 2, double: 2, triple: 0 });
    expect(countPenalties(battle)).toEqual({ bust: 1, crash: 1, meltdown: 0 });
    const legacy = legacyOf(battle);
    expect(countThresholdHits(legacy)).toEqual({ bagger: 1, double: 1, triple: 0 }); expect(countPenalties(legacy)).toEqual({ bust: 0, crash: 0, meltdown: 0 });
  });
});

describe('evidence label', () => {
  it('a measured-model multiple names its unit; a legacy one reads "ATR multiple" exactly as before', async () => {
    const battle = await committedBattle(); const c = committedStockContext(battle, battle.portfolio.star[0], 'agent', 'star', 0);
    const [measured] = Object.values(composeEvidenceStamp({ assetScores: [{ symbol: 'AAPL', priceChange: 3.5, multiplier: c.multiplier, rewardContext: c }], prices: { AAPL: { current: 103.5 } } }));
    expect(measured.atrXUnit).toBe('frozen_measured_pct');
    expect(evidenceFacts(measured).map(f => f.text)).toContain(`Measured reward multiple ${measured.atrX.toFixed(2)}× (frozen measured %)`);
    const [legacy] = Object.values(composeEvidenceStamp({ assetScores: [{ symbol: 'AAPL', priceChange: 3.5, multiplier: 1.4 }], prices: { AAPL: { current: 103.5 } } }));
    expect(Object.hasOwn(legacy, 'atrXUnit')).toBe(false);
    expect(evidenceFacts(legacy).map(f => f.text)).toContain('ATR multiple 1.40×');
  });
});

describe('film tape: merge and replay never rescore a measured position with legacy math', () => {
  it('the battle block marks a stamped battle and derives through the corrected gate', async () => {
    const battle = await committedBattle(); battle.status = 'completed'; battle.completedAt = '2026-10-14T20:05:00.000Z';
    const block = buildBattleBlock({ battle, resolveResult: resolveBattleResult });
    expect(block.stockModel).toEqual({ route: 'corrected', modelId: 'stock_measured_atr14_fullday_v2' });
    expect(block.result).toEqual({ value: 'draw', basis: 'derived' }); // both sides hold AAPL at the same fill and quote
    const unavailable = buildBattleBlock({ battle: { ...battle, completionContext: 'corrected_score_unavailable' }, resolveResult: resolveBattleResult });
    // A result-unavailable completion keeps its last stored scores, but the tape's
    // final scores are the displayed ones: none, and no "derived" basis (review B2-5).
    expect(Number.isFinite(battle.scoreState.currentScore)).toBe(true);
    expect(unavailable.final).toMatchObject({ total: null, opponent: null });
    expect(unavailable.result).toMatchObject({ value: null, basis: 'unavailable' });
    expect(block.final).toMatchObject({ total: battle.scoreState.currentScore, opponent: battle.scoreState.opponentScore });
    expect(Object.hasOwn(buildBattleBlock({ battle: legacyOf(battle), resolveResult: resolveBattleResult }), 'stockModel')).toBe(false);
  });
  it('a merge keeps a stamped block\'s assembled result and never calls the legacy resolver; legacy merges re-derive as before', async () => {
    const fx = await completedDay(); const t = makeTapeDb(seedDay({}, fx));
    const D = '2026-09-24', NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    const tape = t.store.get(`agentBattles/${fx.battleId}/tape/${D}`);
    const resolve = vi.fn(() => 'win');
    const stamped = { ...tape, battle: { ...tape.battle, stockModel: { route: 'corrected', modelId: 'stock_measured_atr14_fullday_v2' }, result: { value: null, basis: 'derived' } } };
    const merged = mergeTape(stamped, structuredClone(stamped), { nowIso: new Date(NIGHT + 60_000).toISOString(), withinWindow: true, resolveResult: resolve }).doc;
    expect(merged.battle.result).toEqual({ value: null, basis: 'derived' }); expect(merged.battle.stockModel).toEqual(stamped.battle.stockModel);
    expect(resolve).not.toHaveBeenCalled();
    const again = mergeTape(merged, structuredClone(stamped), { nowIso: new Date(NIGHT + 120_000).toISOString(), withinWindow: true, resolveResult: resolve }).doc;
    expect(again.battle.result.value).toBe(null); expect(resolve).not.toHaveBeenCalled();
    const legacyMerged = mergeTape(tape, structuredClone(tape), { nowIso: new Date(NIGHT + 60_000).toISOString(), withinWindow: true, resolveResult: resolve }).doc;
    expect(legacyMerged.battle.result).toEqual({ value: 'win', basis: 'derived' }); expect(resolve).toHaveBeenCalled();
    expect(Object.hasOwn(legacyMerged.battle, 'stockModel')).toBe(false);
  });
  it('the tape keeps a measured stamp\'s atrX unit and adds nothing to a legacy stamp (review B3-6)', async () => {
    const fx = await completedDay(); let planted = null;
    for (const e of fx.battle.evaluations || []) for (const [sym, v] of Object.entries(e.evidence || {})) if (!planted || planted === sym) { planted = sym; v.atrXUnit = 'frozen_measured_pct'; }
    const t = makeTapeDb(seedDay({}, fx)); const D = '2026-09-24';
    await writeTapeDay(fx.battleId, D, { db: t.db, now: Date.parse('2026-09-25T02:15:30.000Z') });
    const rows = (t.store.get(`agentBattles/${fx.battleId}/tape/${D}`).checks || []).flatMap(c => Object.entries(c.evidence || {}));
    expect(planted).not.toBe(null);
    expect(rows.filter(([s]) => s === planted).length).toBeGreaterThan(0);
    for (const [s, v] of rows) expect(Object.hasOwn(v, 'atrXUnit'), s).toBe(s === planted);
    for (const [s, v] of rows) if (s === planted) expect(v.atrXUnit).toBe('frozen_measured_pct');
  });
  it('replay drops both measured legs (with the reason) and keeps legacy and crypto legs', () => {
    const row = { entryPrice: 100, entryPriceSource: 'trades.entryPrice', at: '2026-10-14T15:00:00.000Z', inBasis: { price: 50 }, inBasisSource: 'receipt.entryMark' };
    const legacyReceipt = { resolvedTier: 'star', entryATR: 3, entryAtrSource: 'scored', guardrailReplay: { outgoingBaseATR: 2.5, thresholdHistory: { maxMultiplier: 0.5, minMultiplier: -0.2 }, outgoingSwappedInAt: '2026-10-14T13:30:00.000Z' } };
    const legacy = buildReplayInputs({ row, receipt: legacyReceipt, trade: { tier: 'star', swapPrice: 100 }, battle: { activatedAt: '2026-10-14T13:30:00.000Z' } });
    const measured = buildReplayInputs({ row, receipt: { ...legacyReceipt, stockRewardContract: { stockThresholdModel: { modelId: 'stock_measured_atr14_fullday_v2' }, outgoingReceipt: { positionId: 'p-out' }, incomingReceipt: { positionId: 'p-in' } } }, trade: { tier: 'star' }, battle: { activatedAt: '2026-10-14T13:30:00.000Z' } });
    expect(measured.replayInputs).toEqual({ ghost: null, bought: null });
    expect(measured.replayMissing).toEqual(expect.arrayContaining(['ghost.measuredStockModel', 'bought.measuredStockModel']));
    const cryptoIn = buildReplayInputs({ row, receipt: { ...legacyReceipt, stockRewardContract: { stockThresholdModel: {}, outgoingReceipt: { positionId: 'p-out' }, incomingReceipt: null } }, trade: { tier: 'star' }, battle: { activatedAt: '2026-10-14T13:30:00.000Z' } });
    expect(cryptoIn.replayInputs.ghost).toBe(null); expect(cryptoIn.replayInputs.bought).toEqual(legacy.replayInputs.bought);
    expect(legacy.replayMissing.some(m => m.includes('measuredStockModel'))).toBe(false);
  });
});

describe('the committed-score display rule', () => {
  it('legacy returns the stored scoreState itself; measured shows only validly committed scores, never for a result-unavailable completion', async () => {
    const battle = await committedBattle();
    expect(displayedStockScores(battle)).toBe(battle.scoreState);
    expect(displayedStockScores({ ...battle, completionContext: 'corrected_score_unavailable' })).toMatchObject({ currentScore: null, opponentScore: null });
    const stale = structuredClone(battle); stale.scoreState.currentScore = 999;
    expect(displayedStockScores(stale)).toMatchObject({ currentScore: null, opponentScore: null });
    expect(stockSummary(displayedStockScores(battle).currentScore)).toBe(stockSummary(battle.scoreState.currentScore));
  });
});
