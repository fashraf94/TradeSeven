import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const selector = vi.hoisted(() => ({ enabled: false }));
vi.mock('../../src/config/featureFlags.js', async original => ({ ...await original(), get STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED() { return selector.enabled; } }));
import { prepareStockCreation, stockCreationDb, effectiveStockPercentage, correctedScorePatch, scoreCorrectedPosition, commitCorrectedScore, checkpointCorrectedDaily, validCorrectedCompletion } from './stockThresholdAdmission.js';
import { collectStockObservation, qualifyStockObservation } from './stockThresholdMeasurementProvider.js';
import { commitBattleDocWithPin } from './compositionGenerationFence.js';
import { executeSwapServer } from './agentSwapExecution.js';
import { getSessionForDate } from '../../src/utils/marketCalendar.js';
import { stockObservation, stockRows, stockWriterDb, correctedStockBattle, STOCK_TEST_NOW, stockTestClock } from './__fixtures__/stockThresholdHarness.js';
import { STOCK_MODEL } from '../../src/utils/stockThresholdModel.js';
const oldKey = process.env.EODHD_API_KEY;
beforeEach(() => { process.env.EODHD_API_KEY = 'isolated-key'; selector.enabled = false; });
afterEach(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; vi.restoreAllMocks(); });
const prices = (current = 103.27) => ({ AAPL: { current, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } });
const inputStore = (battle, inputs) => stockWriterDb({ [`agentBattles/${battle.id}`]: battle, ...inputs, 'indexIntelligence/stockRankings': { stocks: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }] } });
async function creationFixture() {
  selector.enabled = true;
  const o1 = await stockObservation(), o2 = await stockObservation('MSFT');
  const doc = { gameMode: 'baggerbomb_agent', duration: 'fullday', portfolio: { star: [{ symbol: 'AAPL', baseATR: 2.5 }], core: [], support: [], startingPrices: {} }, opponent: { portfolio: { star: [{ symbol: 'MSFT', baseATR: 3 }], core: [], support: [] } }, scoring: {}, scoreState: {} };
  const h = stockWriterDb({ 'indexIntelligence/stockRankings': { stocks: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }] }, 'stockThresholdControl/admission': { schemaVersion: 1, enabled: true, epoch: 1, model: STOCK_MODEL } });
  const prepared = await prepareStockCreation(doc, { db: h.db, collector: async symbol => symbol === 'AAPL' ? o1 : o2 }); prepared.battleDoc = doc;
  return { doc, prepared, h, adapter: stockCreationDb(h.db, prepared, stockTestClock) };
}
describe('server stock admission and atomic writers', () => {
  it('switch off has zero collector calls and no registry/input writes', async () => {
    const collector = vi.fn(() => { throw Error('must not run'); });
    // An in-scope document (review K3-8: `{}` failed the scope check before the switch mattered).
    const doc = { gameMode: 'baggerbomb_agent', duration: 'fullday', portfolio: { star: [{ symbol: 'AAPL', baseATR: 2.5 }], core: [], support: [] }, opponent: { portfolio: { star: [{ symbol: 'MSFT', baseATR: 3 }], core: [], support: [] } } };
    const db = { doc: vi.fn(() => { throw Error('must not read control'); }), collection: vi.fn(), runTransaction: vi.fn() };
    expect(await prepareStockCreation(doc, { collector, db })).toBe(null);
    expect(collector).not.toHaveBeenCalled(); expect(db.doc).not.toHaveBeenCalled();
  });
  it.each([{ dark: true }, { dark: false, descriptor: null }])('preserves executed composition fence and commits both sides atomically %j', async pin => {
    const { adapter, doc, h } = await creationFixture();
    const r = await commitBattleDocWithPin(adapter, doc, pin);
    const committed = h.store.get(`agentBattles/${r.id}`);
    expect(committed.scoring.stockThresholdModel.policyHash).toHaveLength(64);
    expect(committed.portfolio.star[0].stockThresholdReceipt.side).toBe('agent');
    expect(committed.opponent.portfolio.star[0].stockThresholdReceipt.side).toBe('cpu');
    expect(h.writes.filter(([k, p]) => k === 'create' && p.startsWith('stockThresholdInputs/'))).toHaveLength(2);
  });
  it('switch flip or missing CPU membership leaves zero game/input writes', async () => {
    const f = await creationFixture(); selector.enabled = false;
    await expect(commitBattleDocWithPin(f.adapter, f.doc, { dark: true })).rejects.toMatchObject({ reason: 'creation_selection_changed' }); expect(f.h.writes).toEqual([]);
    selector.enabled = true; f.h.store.set('indexIntelligence/stockRankings', { stocks: [{ symbol: 'AAPL' }] });
    await expect(commitBattleDocWithPin(f.adapter, f.doc, { dark: true })).rejects.toMatchObject({ reason: 'current_ranked_membership_missing' }); expect(f.h.writes).toEqual([]);
  });
  it.each([false, true])('the selected stock adapter executes the original full-descriptor fence; cutover=%s', async cutover => {
    const f = await creationFixture();
    const descriptor = { activeIdentityVersion: 3, boundaryStateVersion: 1, activeEpochId: 'ep-A', candidateStateId: 'run-A', semanticHash: 'sem-A', activationGeneration: 1, overrideRevision: 0 };
    f.h.store.set('composition/activation', cutover ? { ...descriptor, activeEpochId: 'ep-B', semanticHash: 'sem-B', activationGeneration: 2 } : descriptor);
    const commit = commitBattleDocWithPin(f.adapter, f.doc, { dark: false, descriptor });
    if (cutover) {
      await expect(commit).rejects.toMatchObject({ code: 'battle_cutover_interleaved' });
      expect(f.h.writes).toEqual([]);
    } else {
      const ref = await commit;
      expect(f.h.store.has(`agentBattles/${ref.id}`)).toBe(true);
      expect(f.h.writes.filter(([, p]) => p.startsWith('stockThresholdInputs/'))).toHaveLength(2);
    }
    expect(f.h.reads).toContain('composition/activation');
  });
  it('a warm true worker refuses a shared disable/epoch cutover before creation', async () => {
    const f = await creationFixture(); f.h.store.get('stockThresholdControl/admission').enabled = false;
    await expect(commitBattleDocWithPin(f.adapter, f.doc, { dark: true })).rejects.toMatchObject({ reason: 'creation_selection_changed' }); expect(f.h.writes).toEqual([]);
    f.h.store.get('stockThresholdControl/admission').enabled = true; f.h.store.get('stockThresholdControl/admission').epoch++;
    await expect(commitBattleDocWithPin(f.adapter, f.doc, { dark: true })).rejects.toMatchObject({ reason: 'creation_selection_changed' }); expect(f.h.writes).toEqual([]);
  });
  it.each([false, true])('review K3-6: a creation commit error with the selector %s keeps the original error reachable', async on => {
    selector.enabled = on;
    const { createAgentBattle } = await import('./agentBattleService.js');
    const { makeCompositionStoreDouble } = await import('./__fixtures__/compositionStoreDouble.js');
    const composition = makeCompositionStoreDouble();
    const cutover = () => Object.assign(new Error('composition cutover interleaved'), { code: 'battle_cutover_interleaved' });
    const db = { doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }), collection: name => composition.collection(name) ?? { add: async () => { throw cutover(); }, doc: id => ({ id: id ?? 'battle-test-1', __collection: name }) }, runTransaction: async fn => fn({ get: async ref => ref.get(), create: async () => { throw cutover(); } }) };
    const agent = { id: 'agent-1', ownerId: 'user-1', name: 'Viper', archetype: 'momentum_chaser', lastDecision: { portfolio: { star: [{ symbol: 'AAPL', baseATR: 3 }], core: [], support: [] }, bench: { stocks: [], crypto: null }, watchlist: { active: [], hotBench: [], monitoring: [] } } };
    const err = await createAgentBattle(db, agent, {}, {}, { duration: '1d' }).then(() => null, e => e);
    if (on) expect(err).toMatchObject({ name: 'StockThresholdRefusal', reason: 'corrected_creation_failed', cause: { code: 'battle_cutover_interleaved' } });
    else expect(err).toMatchObject({ name: 'Error', code: 'battle_cutover_interleaved' });
  });
  it('ordinary control-read errors become scoped retriable refusals for cooldown cleanup', async () => {
    const f = await creationFixture(); f.h.db.doc = () => ({ get: async () => { throw Error('Firestore unavailable'); } });
    await expect(prepareStockCreation(f.doc, { db: f.h.db })).rejects.toMatchObject({ name: 'StockThresholdRefusal', reason: 'admission_control_unavailable', retriable: true });
  });
  it('an agent entry into a CPU ticker preserves the CPU market quote/lifetime', async () => {
    const { battle, inputs } = await correctedStockBattle({ cpuSymbol: 'MSFT' }); const h = inputStore(battle, inputs);
    // The tick fetched MSFT before the swap committed (review R1): a quote dated
    // at or after the entry would value the fresh lifetime instead of its fill.
    const at = '2026-10-14T14:03:00Z'; const q = { AAPL: { current: 103.27, timestamp: Date.parse(at) / 1000 }, MSFT: { current: 106, timestamp: Date.parse(at) / 1000 - 1 } };
    const before = scoreCorrectedPosition(battle, { ...battle.opponent.portfolio.star[0], tier: 'star' }, 'cpu', q, at);
    const result = await executeSwapServer(h.db, battle.id, battle, 'star', 0, { symbol: 'MSFT', baseATR: 3 }, 1, q, {}, null, { now: () => new Date(at), collector: s => stockObservation(s) });
    const live = h.store.get(`agentBattles/${battle.id}`); live.id = battle.id;
    expect(q.MSFT.current).toBe(106);
    expect(scoreCorrectedPosition(live, { ...live.opponent.portfolio.star[0], tier: 'star' }, 'cpu', q, at)).toEqual(before);
    expect(scoreCorrectedPosition(live, { ...result.incomingAsset, tier: 'star' }, 'agent', q, at).totalPoints).toBe(0);
  });
  it('does not promote analyst final=true or serialized observations to server authority', async () => {
    const o = await stockObservation();
    expect(() => qualifyStockObservation({ ...o, final: true, authority: 'approved' }, STOCK_TEST_NOW)).toThrow('untrusted_collector');
    expect(o.measurement.status).toBe('unavailable'); expect(o.measurement.reason).toBe('finalization_unproven');
    expect(qualifyStockObservation(o, STOCK_TEST_NOW)).toBe(o);
  });
  it.each(['AVB', 'CTRA', 'EA', 'EQR', 'K', 'MMC', 'PARA', 'WBD', 'HES', 'IPG', 'WBA'])('catalog exception %s refuses before any GET', async symbol => {
    const fetcher = vi.fn(); await expect(collectStockObservation(symbol, 2.5, { fetcher, now: stockTestClock })).rejects.toMatchObject({ reason: 'catalog_unavailable' }); expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses six-place decimal half-even, zero eligibility and no floor/cap', () => {
    expect(effectiveStockPercentage(1.2345665).scoringPctDecimal).toBe('1.234566');
    expect(effectiveStockPercentage(1.2345675).scoringPctDecimal).toBe('1.234568');
    expect(effectiveStockPercentage(0.000001).scoringPct).toBe(0.000001);
    expect(effectiveStockPercentage(30.1234567).scoringPct).toBe(30.123457);
    expect(effectiveStockPercentage(1e21).scoringPctDecimal).toBe('1000000000000000000000.000000');
    expect(() => effectiveStockPercentage(0)).toThrow(); expect(() => effectiveStockPercentage(0.0000005)).toThrow('quantized_zero');
  });
  it.each(['2026-10-14', '2026-11-27', '2026-03-09'])('publication at close+15 equality versus preceding millisecond %s', async date => {
    const at = getSessionForDate(date).closeMs + 900000;
    const fetcher = vi.fn();
    await expect(collectStockObservation('AAPL', 2.5, { now: () => new Date(at - 1), fetcher })).rejects.toMatchObject({ reason: 'publication_window_not_open' }); expect(fetcher).not.toHaveBeenCalled();
    const observation = await stockObservation('AAPL', { rows: stockRows(date), clock: () => new Date(at) }); expect(observation.measurement.sourceSession).toBe(date);
  });
  it('separates volume revisions from ATR input revisions and rejects missing/malformed windows', async () => {
    const o1 = await stockObservation(), rows = stockRows(); rows[0].volume++;
    const o2 = await stockObservation('AAPL', { rows }); expect(o1.measurement.inputHash).toBe(o2.measurement.inputHash); expect(o1.snapshotHash).not.toBe(o2.snapshotHash); expect(o1.snapshot.id).not.toBe(o2.snapshot.id);
    rows.pop(); await expect(stockObservation('AAPL', { rows })).rejects.toMatchObject({ reason: 'missing_sessions' });
    const invalid = stockRows(); invalid[0].open = 110; await expect(stockObservation('AAPL', { rows: invalid })).rejects.toMatchObject({ reason: 'incoherent_ohlc' });
  });
  it('provider errors, identity substitution, forming-only data and mutable snapshots refuse', async () => {
    await expect(collectStockObservation('AAPL', 2.5, { now: stockTestClock, fetcher: async () => { throw Error('offline'); } })).rejects.toMatchObject({ reason: 'provider_failure' });
    await expect(stockObservation('AAPL', { changeResponse: v => Array.isArray(v) ? v : v.Type ? { ...v, Code: 'MSFT' } : v })).rejects.toMatchObject({ reason: 'security_identity_unqualified' });
    const o = await stockObservation(); o.snapshot.rows[0].volume++;
    expect(() => qualifyStockObservation(o, STOCK_TEST_NOW)).toThrow('snapshot_hash_mismatch');
  });
  it('refutes reviewed historical fill/delisted/whole-observation corruption defects', async () => {
    await expect(stockObservation('AAPL', { changeResponse: v => v.timestamp ? { ...v, timestamp: Date.parse('2025-01-02T20:00:00Z') / 1000 } : v })).rejects.toMatchObject({ reason: 'quote_precedes_completed_source_session' });
    await expect(stockObservation('AAPL', { changeResponse: v => v.Type ? { ...v, IsDelisted: true } : v })).rejects.toMatchObject({ reason: 'security_identity_unqualified' });
    const { battle, inputs } = await correctedStockBattle(), h = inputStore(battle, inputs);
    h.store.get(battle.portfolio.star[0].stockThresholdReceipt.inputRef).general.Code = 'WRONG';
    await expect(commitCorrectedScore(h.db, h.db.doc(`agentBattles/${battle.id}`), battle, {})).rejects.toMatchObject({ reason: 'immutable_observation_corrupt' }); expect(h.writes).toEqual([]);
  });
  it('keeps short crypto typed during selected creation; refuses a short incoming stock', async () => {
    const f = await creationFixture(); f.doc.portfolio.support.push({ symbol: 'BTC-USD.CC', isCrypto: true, direction: 'short', baseATR: 5 });
    const spy = vi.fn(symbol => stockObservation(symbol));
    const prepared = await prepareStockCreation(f.doc, { db: f.h.db, collector: spy }); expect(prepared.observations).toHaveLength(2); expect(spy).toHaveBeenCalledTimes(2);
    const { battle, inputs } = await correctedStockBattle(), h = inputStore(battle, inputs);
    await expect(executeSwapServer(h.db, battle.id, battle, 'star', 0, { symbol: 'MSFT', direction: 'short' }, 1, prices(), {}, null, { collector: spy })).rejects.toMatchObject({ reason: 'unsupported_stock_direction' });
  });
  it('corrected stock-to-crypto swap removes incoming crypto from bench', async () => {
    const { battle, inputs } = await correctedStockBattle(); battle.portfolio.bench.crypto = { symbol: 'BTC-USD.CC', isCrypto: true, baseATR: 5 };
    const h = inputStore(battle, inputs); const q = { ...prices(), 'BTC-USD.CC': { current: 50000, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
    await executeSwapServer(h.db, battle.id, battle, 'star', 0, battle.portfolio.bench.crypto, 1, q, {}, null, { now: stockTestClock }); expect(h.store.get(`agentBattles/${battle.id}`).portfolio.bench.crypto).toBe(null);
  });
  it('review K2-3: typed crypto entering a corrected game starts from a reset threshold history', async () => {
    const { battle, inputs } = await correctedStockBattle(); battle.portfolio.bench.crypto = { symbol: 'BTC-USD.CC', isCrypto: true, baseATR: 5 };
    battle.thresholdHistory = { 'BTC-USD.CC': { maxMultiplier: 1.6, minMultiplier: 0, badges: ['bagger'] }, 'ETH-USD.CC': { maxMultiplier: 0.4, minMultiplier: -0.2, badges: [] } };
    const h = inputStore(battle, inputs); const q = { ...prices(), 'BTC-USD.CC': { current: 50000, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
    await executeSwapServer(h.db, battle.id, battle, 'star', 0, battle.portfolio.bench.crypto, 1, q, {}, null, { now: stockTestClock });
    expect(h.store.get(`agentBattles/${battle.id}`).thresholdHistory).toEqual({ 'BTC-USD.CC': { maxMultiplier: 0, minMultiplier: 0, badges: [] }, 'ETH-USD.CC': { maxMultiplier: 0.4, minMultiplier: -0.2, badges: [] } });
  });
  it.each([[1, 75], [undefined, 105]])('whole-asset corrected scorer retains the tier stamp %s and canonical points %s', async (stamp, expected) => {
    const { battle } = await correctedStockBattle({ fill: 100 });
    const asset = { ...battle.portfolio.star[0], tier: 'star', ...(stamp === undefined ? {} : { tierMultiplier: stamp }) };
    const score = scoreCorrectedPosition(battle, asset, 'agent', prices(103), STOCK_TEST_NOW);
    expect(score.tierMultiplier).toBe(stamp ?? 2);
    expect(score.basePoints).toBe(stamp === undefined ? 60 : 30);
    // The real measured fixture has a 2% unit: 3% crosses 1x and 1.5x,
    // earning the existing cumulative 15 + 30 reward independent of tier.
    expect(score.bonusPoints).toBe(45);
    expect(score.totalPoints).toBe(expected);
  });
  it.each([[1, 45], [undefined, 75]])('corrected non-stock swap-out retains the stored stamp %s and banks canonical points %s with admission off', async (stamp, expected) => {
    const { battle, inputs } = await correctedStockBattle();
    battle.portfolio.star[0] = { symbol: 'BTC-USD.CC', isCrypto: true, baseATR: 2.5, swapPrice: 100, positionId: 'crypto-position', slotVersion: 1, ...(stamp === undefined ? {} : { tierMultiplier: stamp }) };
    const incoming = { symbol: 'ETH-USD.CC', isCrypto: true, baseATR: 5 };
    const h = inputStore(battle, inputs);
    const quote = current => ({ current, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 });
    const result = await executeSwapServer(h.db, battle.id, battle, 'star', 0, incoming, 1, { 'BTC-USD.CC': quote(103), 'ETH-USD.CC': quote(200) }, {}, null, { now: stockTestClock });
    expect(selector.enabled).toBe(false);
    expect(result.closedTrade.lockedPoints).toBe(expected);
    expect(result.closedTrade.exitPrice).toBe(103);
    expect(h.store.get(`agentBattles/${battle.id}`).scoring.stockScoreComponents['crypto-position']).toMatchObject({ points: expected, exitPrice: 103, exitQuoteAsOf: STOCK_TEST_NOW });
  });
  it('commits real zero/negative totals; missing score propagates and blocks completion', async () => {
    const { battle, inputs } = await correctedStockBattle(), h = inputStore(battle, inputs);
    const a = scoreCorrectedPosition(battle, { ...battle.portfolio.star[0], tier: 'star' }, 'agent', prices(), STOCK_TEST_NOW);
    const c = scoreCorrectedPosition(battle, { ...battle.opponent.portfolio.star[0], tier: 'star' }, 'cpu', prices(), STOCK_TEST_NOW);
    let patch = correctedScorePatch(battle, [a], [c], STOCK_TEST_NOW); expect(patch['scoreState.currentScore']).toBe(0);
    await commitCorrectedScore(h.db, h.db.doc(`agentBattles/${battle.id}`), battle, patch);
    expect(validCorrectedCompletion(h.store.get(`agentBattles/${battle.id}`))).toBe(true);
    patch = correctedScorePatch(battle, [{ ...a, totalPoints: -35 }], [c], STOCK_TEST_NOW); expect(patch['scoreState.currentScore']).toBe(-35);
    patch = correctedScorePatch(battle, [{ ...a, totalPoints: null }], [c], STOCK_TEST_NOW); expect(patch['scoreState.currentScore']).toBe(null);
  });
  it('swap with admission off creates fresh receipt, banks once, rejects stale tick and duplicate swap', async () => {
    const { battle, inputs } = await correctedStockBattle(), h = inputStore(battle, inputs); const before = structuredClone(battle);
    const result = await executeSwapServer(h.db, battle.id, battle, 'star', 0, { symbol: 'MSFT', baseATR: 3 }, 1, prices(108), { lockedPoints: 999, incomingPositionId: 'forged' }, null, { now: stockTestClock, identityMode: 'off', collector: s => stockObservation(s) });
    expect(selector.enabled).toBe(false); expect(result.incomingAsset.stockThresholdReceipt.scoringPctDecimal).toBe('2.000000');
    expect(result.closedTrade.lockedPoints).not.toBe(999); expect(result.closedTrade.incomingPositionId).not.toBe('forged');
    expect(Object.keys(h.store.get(`agentBattles/${battle.id}`).scoring.stockScoreComponents)).toEqual(['position-agent']);
    await expect(commitCorrectedScore(h.db, h.db.doc(`agentBattles/${battle.id}`), before, {})).rejects.toMatchObject({ reason: 'stale_score_frame' });
    const n = h.writes.length;
    await expect(executeSwapServer(h.db, battle.id, before, 'star', 0, { symbol: 'MSFT', baseATR: 3 }, 1, prices(108), {}, null, { now: stockTestClock, collector: s => stockObservation(s) })).rejects.toMatchObject({ reason: 'stale_swap_position' }); expect(h.writes).toHaveLength(n);
  });
  it('review K1-7: the closed trade carries the outgoing lifetime calibrated risk history the guardrail read', async () => {
    const { battle, inputs } = await correctedStockBattle(); const risk = { positionId: 'position-agent', maxMultiplier: 1.6, minMultiplier: -0.4 };
    battle.scoring.stockRiskHistory.agent['position-agent'] = risk; battle.scoring.stockRiskHistory.cpu['position-cpu'] = { positionId: 'position-cpu', maxMultiplier: 9, minMultiplier: 0 };
    const h = inputStore(battle, inputs);
    const { closedTrade } = await executeSwapServer(h.db, battle.id, battle, 'star', 0, { symbol: 'MSFT', baseATR: 3 }, 1, prices(104), {}, null, { now: stockTestClock, collector: s => stockObservation(s) });
    expect(closedTrade.outgoingRiskHistory).toEqual(risk);
  });
  it('missing incoming evidence or corrupted immutable input leaves outgoing/bank untouched', async () => {
    const { battle, inputs } = await correctedStockBattle(), h = inputStore(battle, inputs); const before = structuredClone(h.store.get(`agentBattles/${battle.id}`));
    await expect(executeSwapServer(h.db, battle.id, battle, 'star', 0, { symbol: 'MSFT' }, 1, prices(), {}, null, { now: stockTestClock, collector: async () => { throw Error('missing incoming'); } })).rejects.toThrow();
    expect(h.store.get(`agentBattles/${battle.id}`)).toEqual(before);
    h.store.delete(battle.portfolio.star[0].stockThresholdReceipt.inputRef);
    await expect(commitCorrectedScore(h.db, h.db.doc(`agentBattles/${battle.id}`), battle, {})).rejects.toMatchObject({ reason: 'immutable_input_missing' }); expect(h.writes).toEqual([]);
  });
  it('concurrent/retried score commits refuse a moved score version; daily checkpoint is idempotent and preserves lifetime', async () => {
    const { battle, inputs } = await correctedStockBattle(); let concurrent = true;
    const h = stockWriterDb({ [`agentBattles/${battle.id}`]: battle, ...inputs }, { beforeCommit: ({ store, versions }) => { if (!concurrent) return; concurrent = false; store.get(`agentBattles/${battle.id}`).scoring.stockScoreVersion++; versions.set(`agentBattles/${battle.id}`, 1); } });
    await expect(commitCorrectedScore(h.db, h.db.doc(`agentBattles/${battle.id}`), battle, {})).rejects.toMatchObject({ reason: 'stale_score_frame' }); expect(h.writes).toEqual([]);
    const clean = inputStore(battle, inputs), scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices(108), STOCK_TEST_NOW));
    await commitCorrectedScore(clean.db, clean.db.doc(`agentBattles/${battle.id}`), battle, correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW));
    const committed = structuredClone(clean.store.get(`agentBattles/${battle.id}`)); committed.id = battle.id;
    expect(await checkpointCorrectedDaily(clean.db, clean.db.doc(`agentBattles/${battle.id}`), committed, 'day1', STOCK_TEST_NOW)).toEqual({ status: 'recorded' });
    expect(await checkpointCorrectedDaily(clean.db, clean.db.doc(`agentBattles/${battle.id}`), committed, 'day1', STOCK_TEST_NOW)).toEqual({ status: 'skipped', reason: 'already_recorded' });
    const after = clean.store.get(`agentBattles/${battle.id}`); expect(after.portfolio).toEqual(committed.portfolio); expect(after.scoring.stockRewardHistory).toEqual(committed.scoring.stockRewardHistory); expect(after.scoreState.currentScore).toBe(committed.scoreState.currentScore);
  });
});
// Review R1 (takeover, 2026-10-14): the entry-commit marker valued an outgoing
// exit at its own fill. A fresh MSFT lifetime (fill $100, 2% unit, entered
// 14:03) is rotated out through the real corrected executeSwapServer route.
describe('R1: an outgoing corrected exit needs dated post-entry evidence', () => {
  const firstAt = '2026-10-14T14:03:00.000Z', secondAt = '2026-10-14T14:04:00.000Z';
  const ts = iso => Date.parse(iso) / 1000;
  async function freshLifetime({ beforeCommit = null } = {}) {
    const { battle, inputs } = await correctedStockBattle({ fill: 100 });
    battle.portfolio.bench.stocks.push({ symbol: 'GOOG', baseATR: 3 });
    const path = `agentBattles/${battle.id}`, hook = { beforeCommit };
    const h = stockWriterDb({ [path]: battle, ...inputs, 'indexIntelligence/stockRankings': { stocks: ['AAPL', 'MSFT', 'GOOG'].map(symbol => ({ symbol })) } }, { beforeCommit: ctx => hook.beforeCommit?.(ctx) });
    // The tick's MSFT quote was fetched before the swap committed the $100 fill.
    const q = { AAPL: { current: 103, timestamp: ts(firstAt) }, MSFT: { current: 110, timestamp: ts('2026-10-14T14:02:59Z') }, GOOG: { current: 100, timestamp: ts(secondAt) } };
    const first = await executeSwapServer(h.db, battle.id, battle, 'star', 0, battle.portfolio.bench.stocks[0], 1, q, {}, null, { now: () => new Date(firstAt), collector: s => stockObservation(s, { price: 100, clock: () => new Date(firstAt) }) });
    return { h, path, q, hook, fresh: first.incomingAsset, live: structuredClone(h.store.get(path)) };
  }
  const rotateOut = f => executeSwapServer(f.h.db, f.live.id, f.live, 'star', 0, f.live.portfolio.bench.stocks.find(a => a.symbol === 'GOOG'), 1, f.q, {}, null, { now: () => new Date(secondAt), collector: s => stockObservation(s, { price: 100, clock: () => new Date(secondAt) }) });
  const held = f => scoreCorrectedPosition(f.live, { ...f.live.portfolio.star[0], tier: 'star' }, 'agent', f.q, secondAt);
  it.each([
    ['pre-entry', '2026-10-14T14:02:59Z', 'entry_commit', 100, 0],
    ['same-instant', firstAt, 'post_entry_quote', 110, 295],
    ['later', secondAt, 'post_entry_quote', 110, 295],
    ['absent', null, 'entry_commit', 100, 0],
  ])('held scoring of the fresh lifetime with a %s tick quote', async (_, asOf, kind, price, points) => {
    const f = await freshLifetime();
    expect(f.q.MSFT.stockEntryCommit).toEqual({ positionId: f.fresh.positionId, receiptHash: f.fresh.stockThresholdReceipt.receiptHash });
    f.q.MSFT = asOf ? { ...f.q.MSFT, timestamp: ts(asOf) } : { stockEntryCommit: f.q.MSFT.stockEntryCommit };
    expect(held(f)).toMatchObject({ totalPoints: points, rewardContext: { currentPrice: price, quoteEvidence: { kind } } });
  });
  it('a pre-entry exit quote refuses with zero writes; the held entry valuation never qualifies the exit', async () => {
    const f = await freshLifetime(); const before = structuredClone(f.h.store.get(f.path)), n = f.h.writes.length;
    expect(held(f)).toMatchObject({ totalPoints: 0, rewardContext: { quoteEvidence: { kind: 'entry_commit' } } });
    await expect(rotateOut(f)).rejects.toMatchObject({ reason: 'missing_post_entry_quote' });
    expect(f.h.writes).toHaveLength(n); expect(f.h.store.get(f.path)).toEqual(before);
  });
  it.each([
    ['gain', 110, 295, 10],
    // −3% crosses −1x ($98) and −1.5x at equality ($97): −60 base − 10 − 20.
    ['loss', 97, -90, -3],
  ])('a dated post-entry %s quote outranks the marker and binds exit, gain, points, bank and context', async (_, price, points, gainPct) => {
    const f = await freshLifetime(); f.q.MSFT = { ...f.q.MSFT, current: price, timestamp: ts(secondAt) };
    const { closedTrade: t } = await rotateOut(f);
    expect(t).toMatchObject({ outgoingPositionId: f.fresh.positionId, entryPrice: 100, exitPrice: price, lockedPoints: points, lockedGainPct: gainPct, rewardContext: { currentPrice: price, quoteEvidence: { kind: 'post_entry_quote', providerAsOf: secondAt } } });
    const live = f.h.store.get(f.path);
    expect(live.scoring.stockScoreComponents[f.fresh.positionId]).toMatchObject({ points, exitPrice: price, exitQuoteAsOf: secondAt });
    expect(live.scoring.stockRewardHistory.agent[f.fresh.positionId]).toEqual(t.rewardContext.history);
    expect(live.trades.at(-1)).toEqual(t);
  });
  it.each([['absent', () => undefined], ['fallback', q => ({ ...q, fallback: true, timestamp: Date.parse('2026-10-14T14:04:00Z') / 1000 })]])('an %s exit quote refuses with zero writes', async (_, quote) => {
    const f = await freshLifetime(); const n = f.h.writes.length; f.q.MSFT = quote(f.q.MSFT);
    await expect(rotateOut(f)).rejects.toMatchObject({ reason: 'missing_exit_quote' }); expect(f.h.writes).toHaveLength(n);
  });
  it('a contended retry banks the fresh lifetime once; a stale replay cannot bank it again', async () => {
    const f = await freshLifetime(); f.q.MSFT = { ...f.q.MSFT, timestamp: ts(secondAt) };
    let raced = false;
    f.hook.beforeCommit = ({ versions }) => { if (raced) return; raced = true; versions.set(f.path, (versions.get(f.path) || 0) + 1); };
    const attempts = f.h.attempts(), n = f.h.writes.length;
    const { closedTrade } = await rotateOut(f);
    expect(f.h.attempts() - attempts).toBe(2); expect(f.h.writes.length - n).toBe(2);
    const live = f.h.store.get(f.path);
    expect(live.scoring.stockScoreComponents[f.fresh.positionId].points).toBe(295);
    expect(live.trades.filter(t => t.outgoingPositionId === f.fresh.positionId)).toEqual([closedTrade]);
    const m = f.h.writes.length;
    await expect(rotateOut(f)).rejects.toMatchObject({ reason: 'stale_swap_position' }); expect(f.h.writes).toHaveLength(m);
  });
});
