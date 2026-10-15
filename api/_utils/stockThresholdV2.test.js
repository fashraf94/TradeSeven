// BaggerBomb stock thresholds v2 (docs/approvals/BAGGERBOMB_STOCK_THRESHOLDS_V2_PILOT_20261015.md):
// Rulings 1, 2, 6, 7, 8 and 9 through the real model, admission, collector,
// common swap writer and creation service. Only the network, the clock and the
// admission flag are doubles. The real import of src/utils/stockThresholdModel.js
// below is its Node dependency-surface guard (BUILD_RULES §4): never mock it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const selector = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../src/config/featureFlags.js', async original => ({ ...await original(), get STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED() { return selector.enabled; } }));
import { prepareStockCreation, stockCreationDb, scoreCorrectedPosition, lateStartRefusal, STOCK_LATE_START_CUTOFF_MINUTES, decisionQuote, bindStockReceipt } from './stockThresholdAdmission.js';
import { collectStockObservation } from './stockThresholdMeasurementProvider.js';
import { validStockAdmissionControl, stockAdmissionSelects, STOCK_APPROVAL } from './stockThresholdPolicyRegistry.js';
import { commitBattleDocWithPin } from './compositionGenerationFence.js';
import { executeSwapServer } from './agentSwapExecution.js';
import { canonicalContentHash } from './canonicalHash.js';
import { getSessionForDate } from '../../src/utils/marketCalendar.js';
import { STOCK_MODEL, stockRewardContext, initialRewardHistory, stockModelRoute } from '../../src/utils/stockThresholdModel.js';
import { stockObservation, stockRows, stockWriterDb, correctedStockBattle, STOCK_TEST_NOW, stockTestClock, STOCK_CREATION_NOW, stockCreationClock } from './__fixtures__/stockThresholdHarness.js';

const oldKey = process.env.EODHD_API_KEY;
beforeEach(() => { process.env.EODHD_API_KEY = 'isolated-key'; selector.enabled = true; });
afterEach(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// The harness fill quote is stamped 15 minutes before its 14:02Z commit (Phase 0 §C2).
const FILL_AT = '2026-10-14T13:47:00.000Z';
const ts = iso => Date.parse(iso) / 1000;
const q = (price, asOf, observedAt = STOCK_TEST_NOW) => ({ price, asOf, observedAt });
const inputStore = (battle, inputs) => stockWriterDb({ [`agentBattles/${battle.id}`]: battle, ...inputs, 'indexIntelligence/stockRankings': { stocks: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }] } });
const control = (over = {}) => ({ schemaVersion: 2, enabled: true, epoch: 1, model: { ...STOCK_MODEL }, audience: { mode: 'allowlist', ownerIds: ['owner-pilot'] }, ...over });
const creationDoc = (ownerId = 'owner-pilot') => ({ ownerId, gameMode: 'baggerbomb_agent', duration: 'fullday', portfolio: { star: [{ symbol: 'AAPL', baseATR: 2.5 }], core: [], support: [], startingPrices: {} }, opponent: { portfolio: { star: [{ symbol: 'MSFT', baseATR: 3 }], core: [], support: [] } }, scoring: {}, scoreState: {} });
const creationStore = ctl => stockWriterDb({ 'indexIntelligence/stockRankings': { stocks: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }] }, ...(ctl === undefined ? {} : { 'stockThresholdControl/admission': ctl }) });

describe('Ruling 1: the fill quote provider time is the reward lower bound', () => {
  it('the harness fill quote predates its commit, and enteredAt stays the upper bound on fill evidence', async () => {
    const { battle } = await correctedStockBattle({ fill: 100 }); const r = battle.portfolio.star[0].stockThresholdReceipt;
    expect(r.fillQuote.quoteAsOf).toBe(FILL_AT); expect(r.enteredAt).toBe(STOCK_TEST_NOW);
    // :48 unchanged — a fill observed after the commit instant is invalid evidence.
    r.fillQuote.observedAt = '2026-10-14T14:02:01.000Z';
    expect(stockRewardContext(battle, battle.portfolio.star[0], 'agent', 'star', 0, q(101, '2026-10-14T13:50:00.000Z')).reason).toBe('invalid_fill_evidence');
  });
  it('same provider time as the fill: valid only at exactly the fill price', async () => {
    const { battle } = await correctedStockBattle({ fill: 100 }); const a = battle.portfolio.star[0];
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, q(100, FILL_AT))).toMatchObject({ status: 'valid', currentPrice: 100, multiplier: 0, crossedTiers: [], quoteEvidence: { kind: 'fill_quote', providerAsOf: FILL_AT } });
    for (const price of [100.01, 99.99, 102]) expect(stockRewardContext(battle, a, 'agent', 'star', 0, q(price, FILL_AT))).toEqual({ status: 'unavailable', reason: 'fill_time_price_conflict' });
  });
  it('a quote strictly later than the fill quote is valid, even before the wall-clock commit', async () => {
    const { battle } = await correctedStockBattle({ fill: 100 }); const a = battle.portfolio.star[0];
    const later = stockRewardContext(battle, a, 'agent', 'star', 0, q(102, '2026-10-14T13:48:00.000Z'));
    expect(later).toMatchObject({ status: 'valid', currentPrice: 102, quoteEvidence: { kind: 'post_fill_quote' } });
    expect(later.crossedTiers).toEqual(['bagger']); // 102 is exactly the 1.0x target (2% unit), equality counts
    expect(later.history.observedAt).toBe('2026-10-14T13:48:00.000Z');
  });
  it('a quote before the fill quote is unavailable', async () => {
    const { battle } = await correctedStockBattle({ fill: 100 }); const a = battle.portfolio.star[0];
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, q(100, '2026-10-14T13:46:59.000Z'))).toEqual({ status: 'unavailable', reason: 'missing_post_entry_quote' });
  });
  it('a quote stamped after its own observation instant is unavailable, so history never runs ahead of real time (review B1-6)', async () => {
    const { battle } = await correctedStockBattle({ fill: 100 }); const a = battle.portfolio.star[0];
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, q(101, '2026-10-14T14:10:00.000Z', '2026-10-14T14:05:00.000Z'))).toEqual({ status: 'unavailable', reason: 'missing_post_entry_quote' });
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, q(101, '2026-10-14T14:05:00.000Z', '2026-10-14T14:05:00.000Z')).status).toBe('valid');
  });
  it('the :61 trap: a fresh history seeded at the fill quote time is accepted; one older than the fill quote is invalid', async () => {
    const { battle } = await correctedStockBattle({ fill: 100 }); const a = battle.portfolio.star[0];
    expect(initialRewardHistory(a.stockThresholdReceipt).observedAt).toBe(FILL_AT);
    // A fresh lifetime (history at the fill quote time, before enteredAt) scores a later quote.
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, q(101, '2026-10-14T13:50:00.000Z')).status).toBe('valid');
    battle.scoring.stockRewardHistory.agent[a.positionId].observedAt = '2026-10-14T13:46:00.000Z';
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, q(101, '2026-10-14T13:50:00.000Z')).reason).toBe('invalid_reward_history');
    // A history already advanced past a quote never moves backward onto it.
    battle.scoring.stockRewardHistory.agent[a.positionId].observedAt = '2026-10-14T13:55:00.000Z';
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, q(101, '2026-10-14T13:50:00.000Z')).reason).toBe('missing_post_entry_quote');
  });
  it('Branch A: a dated tick quote that predates the fill values the position at its own receipt fill; nothing else stands in', async () => {
    const { battle } = await correctedStockBattle({ fill: 100 }); const a = { ...battle.portfolio.star[0], tier: 'star' };
    const pre = { AAPL: { current: 250, timestamp: ts('2026-10-14T13:40:00Z') } };
    expect(scoreCorrectedPosition(battle, a, 'agent', pre, STOCK_TEST_NOW)).toMatchObject({ totalPoints: 0, rewardContext: { status: 'valid', currentPrice: 100, quoteEvidence: { kind: 'fill_quote', providerAsOf: FILL_AT } } });
    expect(scoreCorrectedPosition(battle, a, 'agent', pre, STOCK_TEST_NOW, { fillStandIn: false }).rewardContext).toEqual({ status: 'unavailable', reason: 'missing_post_entry_quote' });
    for (const p of [undefined, { current: 250, fallback: true, timestamp: ts('2026-10-14T13:40:00Z') }, { current: 250 }, { current: 250, timestamp: ts(FILL_AT) }, { current: 250, previousCloseStandIn: true, timestamp: ts('2026-10-14T13:40:00Z') }])
      expect(scoreCorrectedPosition(battle, a, 'agent', { AAPL: p }, STOCK_TEST_NOW).rewardContext.status, JSON.stringify(p)).toBe('unavailable');
  });
  it('Branch A is per receipt: one tick quote is post-fill for one lifetime and pre-fill for another of the same ticker', async () => {
    const early = await stockObservation('AAPL', { price: 100, clock: stockTestClock });
    const later = await stockObservation('AAPL', { price: 120, clock: () => new Date('2026-10-14T14:20:00.000Z') });
    const battle = { id: 'per-receipt', gameMode: 'baggerbomb_agent', duration: 'fullday', status: 'active', portfolio: { star: [{ symbol: 'AAPL', baseATR: 2.5 }], core: [], support: [] }, opponent: { portfolio: { star: [{ symbol: 'AAPL', baseATR: 2.5 }], core: [], support: [] } },
      scoring: { stockThresholdModel: { ...STOCK_MODEL, admittedAt: STOCK_TEST_NOW }, stockRosterVersion: 1, stockScoreVersion: 0, stockRewardHistory: { agent: {}, cpu: {} } } };
    for (const [side, o, at] of [['agent', early, STOCK_TEST_NOW], ['cpu', later, '2026-10-14T14:20:00.000Z']]) {
      const asset = (side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0];
      const r = bindStockReceipt(o, { battleId: battle.id, side, tier: 'star', slot: 0, positionId: `p-${side}`, slotVersion: 1, enteredAt: at });
      Object.assign(asset, { positionId: r.positionId, slotVersion: 1, stockThresholdReceipt: r });
      battle.scoring.stockRewardHistory[side][r.positionId] = initialRewardHistory(r);
    }
    // 14:00Z is after the agent fill quote (13:47) and before the CPU fill quote (14:05).
    const tick = { AAPL: { current: 101, timestamp: ts('2026-10-14T14:00:00Z') } };
    expect(scoreCorrectedPosition(battle, { ...battle.portfolio.star[0], tier: 'star' }, 'agent', tick, '2026-10-14T14:21:00Z').rewardContext).toMatchObject({ currentPrice: 101, quoteEvidence: { kind: 'post_fill_quote' } });
    expect(scoreCorrectedPosition(battle, { ...battle.opponent.portfolio.star[0], tier: 'star' }, 'cpu', tick, '2026-10-14T14:21:00Z').rewardContext).toMatchObject({ currentPrice: 120, quoteEvidence: { kind: 'fill_quote', providerAsOf: '2026-10-14T14:05:00.000Z' } });
  });
  it('an exit at the fill quote provider time is refused with zero writes; a strictly later quote banks', async () => {
    const { battle, inputs } = await correctedStockBattle({ fill: 100 }); const h = inputStore(battle, inputs); const before = structuredClone(h.store.get(`agentBattles/${battle.id}`));
    const exitWith = (price, asOf) => executeSwapServer(h.db, battle.id, battle, 'star', 0, { symbol: 'MSFT', baseATR: 3 }, 1, { AAPL: { current: price, timestamp: ts(asOf) } }, {}, null, { now: stockTestClock, collector: s => stockObservation(s) });
    await expect(exitWith(100, FILL_AT)).rejects.toMatchObject({ reason: 'exit_quote_not_after_fill' });
    await expect(exitWith(101, FILL_AT)).rejects.toMatchObject({ reason: 'fill_time_price_conflict' });
    await expect(exitWith(101, '2026-10-14T13:40:00Z')).rejects.toMatchObject({ reason: 'missing_post_entry_quote' });
    expect(h.writes).toEqual([]); expect(h.store.get(`agentBattles/${battle.id}`)).toEqual(before);
    const { closedTrade } = await exitWith(102, '2026-10-14T13:48:00Z');
    expect(closedTrade).toMatchObject({ exitPrice: 102, entryPrice: 100, rewardContext: { quoteEvidence: { kind: 'post_fill_quote', providerAsOf: '2026-10-14T13:48:00.000Z' } } });
  });
});

describe('Ruling 2: late-start cutoff at 45 minutes before the calendar close', () => {
  const at = (date, minutesBeforeClose, extraMs = 0) => new Date(getSessionForDate(date).closeMs - minutesBeforeClose * 60000 + extraMs).toISOString();
  it.each([['normal', '2026-10-14', '15:15'], ['early close', '2026-11-27', '12:15']])('%s day: refused from 45 minutes before close (%s ET), open one millisecond earlier', (_, date, et) => {
    expect(STOCK_LATE_START_CUTOFF_MINUTES).toBe(45);
    expect(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(Date.parse(at(date, 45)))).toBe(et);
    expect(lateStartRefusal(at(date, 46))).toBe(null);
    expect(lateStartRefusal(at(date, 45, -1))).toBe(null);
    expect(lateStartRefusal(at(date, 45))).toBe('late_start_cutoff');
    expect(lateStartRefusal(at(date, 44))).toBe('late_start_cutoff');
    expect(lateStartRefusal(at(date, 0, -1))).toBe('late_start_cutoff');
    expect(lateStartRefusal(at(date, 0))).toBe(null); // the close itself: the publication window governs from here
  });
  it('weekends and holidays have no cutoff; a malformed instant refuses', () => {
    expect(lateStartRefusal('2026-10-17T19:30:00.000Z')).toBe(null);
    expect(lateStartRefusal('2026-11-26T19:30:00.000Z')).toBe(null);
    expect(lateStartRefusal('not-an-instant')).toBe('invalid_creation_instant');
  });
  it('a selected creation is refused before any measurement GET; a non-listed owner stays legacy at the same instant', async () => {
    const collector = vi.fn(); const h = creationStore(control());
    const now = () => new Date(at('2026-10-14', 30));
    await expect(prepareStockCreation(creationDoc(), { db: h.db, collector, now })).rejects.toMatchObject({ name: 'StockThresholdRefusal', reason: 'late_start_cutoff', retriable: true });
    expect(await prepareStockCreation(creationDoc('owner-other'), { db: h.db, collector, now })).toBe(null);
    expect(collector).not.toHaveBeenCalled();
  });
  it('the 16:00–16:15 ET publication window still refuses before any GET', async () => {
    const fetcher = vi.fn();
    const closeMs = getSessionForDate('2026-10-14').closeMs;
    expect(lateStartRefusal(new Date(closeMs + 5 * 60000).toISOString())).toBe(null);
    await expect(collectStockObservation('AAPL', 2.5, { fetcher, now: () => new Date(closeMs + 5 * 60000) })).rejects.toMatchObject({ reason: 'publication_window_not_open' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('Ruling 7: off-hours creation and the source session closing quote (Phase 0 §C3)', () => {
  // §C3: the closing bar was served at 16:15:20 ET stamped exactly 16:00:00, then
  // stamps crept to 16:01–16:23 at the unchanged close. Before it, 15:59:00.
  const quoteAt = (iso, price = 288.705) => v => (v.timestamp !== undefined ? { ...v, close: price, timestamp: ts(iso) } : v);
  it.each([
    ['after close, the 16:00:00 closing bar', '2026-10-15T21:00:00.000Z', '2026-10-15', '2026-10-15T20:00:00Z'],
    ['after close, a later frozen stamp (16:03)', '2026-10-15T21:00:00.000Z', '2026-10-15', '2026-10-15T20:03:00Z'],
    ['pre-open next day', '2026-10-16T12:00:00.000Z', '2026-10-15', '2026-10-15T20:04:00Z'],
    ['weekend', '2026-10-17T14:00:00.000Z', '2026-10-16', '2026-10-16T20:03:00Z'],
  ])('%s is accepted', async (_, now, session, stamp) => {
    const o = await stockObservation('UNP', { price: 288.705, rows: stockRows(session), clock: () => new Date(now), changeResponse: quoteAt(stamp) });
    expect(o.measurement.sourceSession).toBe(session);
    expect(o.fillQuote).toMatchObject({ price: 288.705, quoteAsOf: new Date(stamp).toISOString(), validation: 'accepted_original_quote' });
  });
  it('the 15:59:00 minute bar, served before the closing bar arrives, is refused (retriable), with no tolerance', async () => {
    const now = '2026-10-15T20:15:10.000Z'; // 16:15:10 ET, after the publication window opens
    await expect(stockObservation('UNP', { price: 288.705, rows: stockRows('2026-10-15'), clock: () => new Date(now), changeResponse: quoteAt('2026-10-15T19:59:00Z') }))
      .rejects.toMatchObject({ reason: 'quote_precedes_completed_source_session', retriable: true });
    await expect(stockObservation('UNP', { price: 288.705, rows: stockRows('2026-10-15'), clock: () => new Date(now), changeResponse: quoteAt('2026-10-15T19:59:59Z') }))
      .rejects.toMatchObject({ reason: 'quote_precedes_completed_source_session' });
    // The same stamp policy, the closing bar at exactly the close, is accepted at this instant.
    expect((await stockObservation('UNP', { price: 288.705, rows: stockRows('2026-10-15'), clock: () => new Date(now), changeResponse: quoteAt('2026-10-15T20:00:00Z') })).fillQuote.quoteAsOf).toBe('2026-10-15T20:00:00.000Z');
  });
  it('an evening creation commits both sides with the closing-bar fills, and the opening jump is post-fill movement', async () => {
    const now = '2026-10-15T21:00:00.000Z'; const clock = () => new Date(now);
    const obs = { AAPL: await stockObservation('AAPL', { price: 342, rows: stockRows('2026-10-15'), clock, changeResponse: quoteAt('2026-10-15T20:00:00Z', 342) }), MSFT: await stockObservation('MSFT', { price: 539.44, rows: stockRows('2026-10-15'), clock, changeResponse: quoteAt('2026-10-15T20:01:00Z', 539.44) }) };
    const h = creationStore(control()); const doc = creationDoc();
    const prepared = await prepareStockCreation(doc, { db: h.db, collector: s => obs[s], now: clock }); prepared.battleDoc = doc;
    const ref = await commitBattleDocWithPin(stockCreationDb(h.db, prepared, clock), doc, { dark: true });
    const battle = { id: ref.id, ...h.store.get(`agentBattles/${ref.id}`) };
    const a = battle.portfolio.star[0];
    expect(a.stockThresholdReceipt).toMatchObject({ fill: 342, sourceSession: '2026-10-15', enteredAt: now, fillQuote: { quoteAsOf: '2026-10-15T20:00:00.000Z' } });
    const open = stockRewardContext(battle, a, 'agent', 'star', 0, q(352.6, '2026-10-16T13:30:00.000Z', '2026-10-16T13:45:00.000Z'));
    expect(open).toMatchObject({ status: 'valid', crossedTiers: ['bagger', 'doubleBagger'] });
  });
});

describe('Ruling 6: the control document is the only on-switch (allowlist on ownerId)', () => {
  it('the shipped selector is true, and only an enabled schema-2 allowlist naming the owner selects', () => {
    expect(validStockAdmissionControl(control())).toBe(true);
    expect(stockAdmissionSelects(control(), 'owner-pilot')).toBe(true);
    expect(stockAdmissionSelects(control(), 'owner-other')).toBe(false);
    for (const [label, c] of [
      ['missing', null], ['disabled', control({ enabled: false })], ['old schema', control({ schemaVersion: 1 })], ['old schema without audience', { schemaVersion: 1, enabled: true, epoch: 1, model: { ...STOCK_MODEL } }],
      ['no audience', control({ audience: undefined })], ['mode all', control({ audience: { mode: 'all' } })], ['mode all with ids', control({ audience: { mode: 'all', ownerIds: ['owner-pilot'] } })],
      ['empty allowlist', control({ audience: { mode: 'allowlist', ownerIds: [] } })], ['non-string id', control({ audience: { mode: 'allowlist', ownerIds: [42] } })], ['empty id', control({ audience: { mode: 'allowlist', ownerIds: [''] } })],
      ['bad epoch', control({ epoch: 0 })], ['v1 model', control({ model: { ...STOCK_MODEL, modelId: 'stock_measured_atr14_fullday_v1' } })], ['unparseable', 'garbage'],
    ]) {
      expect(stockAdmissionSelects(c, 'owner-pilot'), label).toBe(false);
      // The document itself is closed, not merely silent for this owner: the
      // pilot control script reads it through this check (review B1-3).
      expect(validStockAdmissionControl(c), label).toBe(false);
    }
    expect(stockAdmissionSelects(control(), undefined)).toBe(false);
    // One malformed id closes the whole document, even for a listed owner (review B1-3).
    for (const ownerIds of [['owner-pilot', 42], ['owner-pilot', '']]) expect(stockAdmissionSelects(control({ audience: { mode: 'allowlist', ownerIds } }), 'owner-pilot'), JSON.stringify(ownerIds)).toBe(false);
    expect(STOCK_APPROVAL).toMatchObject({ modelId: 'stock_measured_atr14_fullday_v2', approvedPolicyRef: 'owner_baggerbomb_stock_thresholds_v2_20261015@v1' });
  });
  it.each([
    ['no control document', undefined], ['a disabled control', control({ enabled: false })], ['an old-schema control', { schemaVersion: 1, enabled: true, epoch: 1, model: { ...STOCK_MODEL } }],
    ['an "all" audience', control({ audience: { mode: 'all' } })], ['an allowlist without this owner', control({ audience: { mode: 'allowlist', ownerIds: ['someone-else'] } })],
  ])('flag true with %s is legacy (null) and makes zero collector calls', async (_, ctl) => {
    const collector = vi.fn(); const h = creationStore(ctl);
    expect(await prepareStockCreation(creationDoc(), { db: h.db, collector, now: stockCreationClock })).toBe(null);
    expect(collector).not.toHaveBeenCalled(); expect(h.writes).toEqual([]);
  });
  it('an unreadable control document is legacy too (never a refusal for an owner it cannot place)', async () => {
    const collector = vi.fn(); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await prepareStockCreation(creationDoc(), { db: { doc: () => ({ get: async () => { throw Error('Firestore unavailable'); } }) }, collector, now: stockCreationClock })).toBe(null);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/stockThresholdControl\/admission unreadable; this creation is legacy: Firestore unavailable/);
    expect(warn.mock.calls[0][0]).not.toMatch(/owner-pilot/);
    expect(await prepareStockCreation(creationDoc(), { db: {}, collector, now: stockCreationClock })).toBe(null);
    expect(collector).not.toHaveBeenCalled();
  });
  it('an allowlisted owner gets a corrected battle; a mid-flight control change refuses with zero writes', async () => {
    const obs = { AAPL: await stockObservation('AAPL', { rows: stockRows('2026-10-15'), clock: stockCreationClock }), MSFT: await stockObservation('MSFT', { rows: stockRows('2026-10-15'), clock: stockCreationClock }) };
    const run = async mutate => {
      const h = creationStore(control()); const doc = creationDoc();
      const prepared = await prepareStockCreation(doc, { db: h.db, collector: s => obs[s], now: stockCreationClock }); prepared.battleDoc = doc;
      mutate?.(h.store.get('stockThresholdControl/admission'));
      return { h, commit: commitBattleDocWithPin(stockCreationDb(h.db, prepared, stockCreationClock), doc, { dark: true }) };
    };
    const ok = await run(); const ref = await ok.commit;
    expect(stockModelRoute({ id: ref.id, ...ok.h.store.get(`agentBattles/${ref.id}`) }).status).toBe('corrected');
    for (const mutate of [c => { c.audience.ownerIds = ['someone-else']; }, c => { c.enabled = false; }, c => { c.epoch = 2; }]) {
      const r = await run(mutate);
      await expect(r.commit).rejects.toMatchObject({ reason: 'creation_selection_changed' }); expect(r.h.writes).toEqual([]);
    }
  });
  it('a selected creation committed before the v2 approval instant is refused with zero writes; at the instant it commits (review B1-2)', async () => {
    const approved = Date.parse(STOCK_APPROVAL.approvedAt);
    const commitAt = async ms => {
      const clock = () => new Date(ms);
      const obs = { AAPL: await stockObservation('AAPL', { rows: stockRows('2026-10-15'), clock }), MSFT: await stockObservation('MSFT', { rows: stockRows('2026-10-15'), clock }) };
      const h = creationStore(control()); const doc = creationDoc();
      const prepared = await prepareStockCreation(doc, { db: h.db, collector: s => obs[s], now: clock }); prepared.battleDoc = doc;
      return { h, commit: commitBattleDocWithPin(stockCreationDb(h.db, prepared, clock), doc, { dark: true }) };
    };
    const early = await commitAt(approved - 1);
    await expect(early.commit).rejects.toMatchObject({ name: 'StockThresholdRefusal', reason: 'approval_not_effective' }); expect(early.h.writes).toEqual([]);
    const onTime = await commitAt(approved);
    const ref = await onTime.commit;
    expect(onTime.h.store.get(`agentBattles/${ref.id}`).scoring.stockThresholdModel.admittedAt).toBe(STOCK_APPROVAL.approvedAt.replace('Z', '.000Z'));
  });
});

describe('Ruling 6 through createAgentBattle (approved fence contact)', () => {
  const agent = (ownerId = 'owner-other') => ({ id: 'agent-1', ownerId, name: 'Cipher', archetype: 'diversifier', lastDecision: { portfolio: { star: [{ symbol: 'AAPL', baseATR: 2.5 }], core: [], support: [] }, bench: { stocks: [], crypto: null }, watchlist: { active: [], hotBench: [], monitoring: [] } } });
  const opponent = { portfolio: { star: [{ symbol: 'MSFT', baseATR: 2.5 }], core: [], support: [] } };
  // The provider double answers the collector's three GETs (eod, fundamentals,
  // real-time) for a 10:02 ET Oct 16 creation: source session Oct 15, a fill
  // stamped 15 minutes behind the clock.
  const eodhd = vi.fn(async url => {
    const symbol = url.pathname.split('/').at(-1).replace('.US', '');
    const value = url.pathname.includes('/eod/') ? stockRows('2026-10-15') : url.pathname.includes('/fundamentals/')
      ? { Code: symbol, CountryISO: 'US', Type: 'Common Stock', Exchange: 'NASDAQ', IsDelisted: false, ISIN: `US-${symbol}` }
      : { code: `${symbol}.US`, close: 103.27, high: 200, low: 1, previousClose: 100, timestamp: ts(STOCK_CREATION_NOW) - 900 };
    return { ok: true, json: async () => structuredClone(value) };
  });
  async function create({ flag, ctl, ownerId, options, failCommit = false }) {
    selector.enabled = flag;
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(STOCK_CREATION_NOW));
    eodhd.mockClear(); vi.stubGlobal('fetch', eodhd);
    const { createAgentBattle } = await import('./agentBattleService.js');
    const { makeCompositionStoreDouble } = await import('./__fixtures__/compositionStoreDouble.js');
    const composition = makeCompositionStoreDouble(); const added = [], reads = [], inputs = [];
    const cutover = () => Object.assign(new Error('composition cutover interleaved'), { code: 'battle_cutover_interleaved' });
    const rankings = { get: async () => { reads.push('indexIntelligence/stockRankings'); return { exists: true, data: () => ({ stocks: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }] }) }; } };
    const db = {
      doc: path => ({ path, id: path.split('/').at(-1), get: async () => { reads.push(path); return ctl === undefined ? { exists: false, data: () => undefined } : { exists: true, data: () => structuredClone(ctl) }; } }),
      collection: name => composition.collection(name) ?? (name === 'indexIntelligence' ? { doc: () => rankings }
        : { add: async doc => { if (failCommit) throw cutover(); added.push(doc); return { id: 'battle-1' }; }, doc: id => ({ id: id ?? 'battle-1', path: `${name}/${id ?? 'battle-1'}`, __collection: name }) }),
      runTransaction: async fn => fn({ get: async ref => ref.get(), create: async (r, doc) => { if (failCommit) throw cutover(); (r.path?.startsWith('stockThresholdInputs/') ? inputs : added).push(doc); }, update: () => {} }),
    };
    const result = await createAgentBattle(db, agent(ownerId), {}, {}, options).then(r => ({ r }), e => ({ e }));
    return { ...result, added, reads, inputs, fetchSpy: eodhd };
  }
  const tiered = { duration: 'fullday', opponent };
  it('flag true with no control document creates byte-identically to flag false, with zero collector calls', async () => {
    const off = await create({ flag: false, options: tiered });
    const on = await create({ flag: true, options: tiered });
    expect(on.added).toHaveLength(1); expect(on.added).toEqual(off.added);
    expect(Object.hasOwn(on.added[0].scoring, 'stockThresholdModel')).toBe(false);
    expect(off.reads).toEqual([]); expect(on.reads).toEqual(['stockThresholdControl/admission']);
    expect(on.fetchSpy).not.toHaveBeenCalled();
  });
  it('a non-listed owner under a live pilot control keeps today\'s legacy doc and today\'s raw error shape', async () => {
    const off = await create({ flag: false, options: tiered });
    const on = await create({ flag: true, ctl: control(), ownerId: 'owner-other', options: tiered });
    expect(on.added).toEqual(off.added); expect(on.fetchSpy).not.toHaveBeenCalled();
    const errOff = await create({ flag: false, options: tiered, failCommit: true });
    const errOn = await create({ flag: true, ctl: control(), ownerId: 'owner-other', options: tiered, failCommit: true });
    expect(errOn.e).toMatchObject({ name: 'Error', code: 'battle_cutover_interleaved' }); expect(errOn.e).toEqual(errOff.e);
  });
  it('an allowlisted owner\'s creation is corrected end to end through the real collector', async () => {
    const on = await create({ flag: true, ctl: control(), ownerId: 'owner-pilot', options: tiered });
    expect(on.e).toBeUndefined(); expect(on.added).toHaveLength(1);
    expect(on.added[0].scoring.stockThresholdModel).toMatchObject({ modelId: 'stock_measured_atr14_fullday_v2', admittedAt: STOCK_CREATION_NOW });
    expect(on.added[0].portfolio.star[0].stockThresholdReceipt).toMatchObject({ side: 'agent', fill: 103.27, sourceSession: '2026-10-15' });
    expect(on.added[0].opponent.portfolio.star[0].stockThresholdReceipt).toMatchObject({ side: 'cpu' });
    expect(on.inputs).toHaveLength(2); expect(on.fetchSpy).toHaveBeenCalledTimes(6);
  });
  it('a selected owner\'s commit error is the scoped retriable refusal that keeps its cause', async () => {
    const on = await create({ flag: true, ctl: control(), ownerId: 'owner-pilot', options: tiered, failCommit: true });
    expect(on.e).toMatchObject({ name: 'StockThresholdRefusal', reason: 'corrected_creation_failed', retriable: true, cause: { code: 'battle_cutover_interleaved' } });
    expect(on.added).toEqual([]);
  });
  it('a selected owner\'s provider failure is a retriable refusal, never a raw 500', async () => {
    eodhd.mockImplementationOnce(async () => { throw Error('offline'); });
    selector.enabled = true; vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(STOCK_CREATION_NOW));
    const collector = (s, atr) => collectStockObservation(s, atr, { fetcher: eodhd });
    await expect(prepareStockCreation(creationDoc(), { db: creationStore(control()).db, collector, now: stockCreationClock })).rejects.toMatchObject({ name: 'StockThresholdRefusal', reason: 'provider_failure', retriable: true });
  });
  it('tournament creation is byte-identical and never reads the control document', async () => {
    const options = { duration: '1d', opponent: null, gameMode: 'baggerbomb_tournament', groupId: 'group-1', isCpu: true, tournament: { userPicksStance: [], doubleDownSymbols: [], userPicksAtDeploy: [] } };
    const off = await create({ flag: false, options });
    const on = await create({ flag: true, ctl: control({ audience: { mode: 'allowlist', ownerIds: ['owner-other'] } }), options });
    expect(on.added).toHaveLength(1); expect(on.added).toEqual(off.added); expect(on.reads).toEqual([]);
  });
});

describe('Ruling 8: pilot crypto', () => {
  it('an incoming crypto fill from the adjusted-close fallback is refused with zero writes; a live crypto fill swaps', async () => {
    const { battle, inputs } = await correctedStockBattle(); battle.portfolio.bench.crypto = { symbol: 'BTC-USD.CC', isCrypto: true, baseATR: 5 };
    const h = inputStore(battle, inputs); const before = structuredClone(h.store.get(`agentBattles/${battle.id}`));
    const prices = btc => ({ AAPL: { current: 104, timestamp: ts('2026-10-14T13:58:00Z') }, 'BTC-USD.CC': btc });
    await expect(executeSwapServer(h.db, battle.id, battle, 'star', 0, battle.portfolio.bench.crypto, 1, prices({ current: 50000, fallback: true }), {}, null, { now: stockTestClock })).rejects.toMatchObject({ reason: 'fallback_incoming_fill' });
    expect(h.writes).toEqual([]); expect(h.store.get(`agentBattles/${battle.id}`)).toEqual(before);
    const { incomingAsset } = await executeSwapServer(h.db, battle.id, battle, 'star', 0, battle.portfolio.bench.crypto, 1, prices({ current: 50000, timestamp: ts('2026-10-14T13:58:00Z') }), {}, null, { now: stockTestClock });
    expect(incomingAsset).toMatchObject({ symbol: 'BTC-USD.CC', swapPrice: 50000 });
  });
  it('an incoming stock fills from its collector receipt, so a fallback tick quote for it never refuses the swap (review B1-6)', async () => {
    const { battle, inputs } = await correctedStockBattle({ fill: 100 }); const h = inputStore(battle, inputs);
    const prices = { AAPL: { current: 102, timestamp: ts('2026-10-14T13:48:00Z') }, MSFT: { current: 50, fallback: true } };
    const { incomingAsset } = await executeSwapServer(h.db, battle.id, battle, 'star', 0, { symbol: 'MSFT', baseATR: 3 }, 1, prices, {}, null, { now: stockTestClock, collector: s => stockObservation(s) });
    expect(incomingAsset.symbol).toBe('MSFT');
    expect(incomingAsset.swapPrice).toBe(incomingAsset.stockThresholdReceipt.fill); expect(incomingAsset.swapPrice).not.toBe(50);
  });
  it('the outgoing crypto entry must be a positive price', async () => {
    const { battle, inputs } = await correctedStockBattle();
    battle.portfolio.star[0] = { symbol: 'BTC-USD.CC', isCrypto: true, baseATR: 5, positionId: 'crypto-position', slotVersion: 1 };
    const h = inputStore(battle, inputs);
    const quote = { 'BTC-USD.CC': { current: 51000, timestamp: ts(STOCK_TEST_NOW) }, 'ETH-USD.CC': { current: 2000, timestamp: ts(STOCK_TEST_NOW) } };
    await expect(executeSwapServer(h.db, battle.id, battle, 'star', 0, { symbol: 'ETH-USD.CC', isCrypto: true, baseATR: 5 }, 1, quote, {}, null, { now: stockTestClock })).rejects.toMatchObject({ reason: 'missing_outgoing_entry' });
    expect(h.writes).toEqual([]);
  });
});

describe('Ruling 9: strict close for corrected stock valuation', () => {
  it('a previousClose stand-in is unavailable for a corrected stock and for its exit; the non-strict quote (crypto, legacy) keeps the price', async () => {
    const { battle, inputs } = await correctedStockBattle({ fill: 100 }); const a = { ...battle.portfolio.star[0], tier: 'star' };
    const standIn = { current: 101, previousCloseStandIn: true, timestamp: ts('2026-10-14T13:58:00Z') };
    expect(scoreCorrectedPosition(battle, a, 'agent', { AAPL: standIn }, STOCK_TEST_NOW).rewardContext).toEqual({ status: 'unavailable', reason: 'missing_post_entry_quote' });
    expect(scoreCorrectedPosition(battle, a, 'agent', { AAPL: { ...standIn, previousCloseStandIn: undefined } }, STOCK_TEST_NOW).rewardContext.status).toBe('valid');
    expect(decisionQuote(standIn, STOCK_TEST_NOW).price).toBe(101);
    expect(decisionQuote(standIn, STOCK_TEST_NOW, { strictClose: true }).price).toBe(null);
    const h = inputStore(battle, inputs);
    await expect(executeSwapServer(h.db, battle.id, battle, 'star', 0, { symbol: 'MSFT', baseATR: 3 }, 1, { AAPL: standIn }, {}, null, { now: stockTestClock, collector: s => stockObservation(s) })).rejects.toMatchObject({ reason: 'missing_exit_quote' });
    expect(h.writes).toEqual([]);
  });
});

describe('v2 identity: v1 is retired', () => {
  it('a v1 stamp resolves unavailable; the registry recomputes the v2 hashes', async () => {
    const { battle } = await correctedStockBattle();
    battle.scoring.stockThresholdModel = { modelId: 'stock_measured_atr14_fullday_v1', publicationRuleId: 'eodhd_us_completed_session_observation_v1', policyHash: 'baa2b39688b673c93190540f500307ae7ad4aba7a07228ca23ba1f2afe1bf9f8', publicationRuleHash: '3ad8e14b203acd660faba9b8ec7e78c7dcb9f312741ec04cd062bcf79741a85f', approvedPolicyRef: 'owner_baggerbomb_stock_thresholds_v1_20261013@v1', admittedAt: STOCK_TEST_NOW };
    expect(stockModelRoute(battle)).toEqual({ status: 'unavailable', reason: 'unsupported_stock_model' });
    const { APPROVED_STOCK_POLICY } = await import('./stockThresholdPolicyRegistry.js');
    expect(canonicalContentHash(APPROVED_STOCK_POLICY)).toBe(STOCK_MODEL.policyHash);
    expect(canonicalContentHash(APPROVED_STOCK_POLICY.publicationRule)).toBe('3ad8e14b203acd660faba9b8ec7e78c7dcb9f312741ec04cd062bcf79741a85f');
    expect(APPROVED_STOCK_POLICY).toMatchObject({ modelId: 'stock_measured_atr14_fullday_v2', modelVersion: 2 });
  });
});
