// BaggerBomb stock thresholds v2 (docs/approvals/BAGGERBOMB_STOCK_THRESHOLDS_V2_PILOT_20261015.md):
// Rulings 1, 2, 6, 7, 8 and 9 through the real model, admission, collector,
// common swap writer and creation service. Only the network, the clock and the
// admission flag are doubles. The real import of src/utils/stockThresholdModel.js
// below is its Node dependency-surface guard (BUILD_RULES §4): never mock it.
// First import: the fenced computeFullDayExpiry derives its instant from the process
// zone, and the evening-window rows read it, so this file runs in UTC like CI and
// production (blockers review BK3-1).
import './__fixtures__/pinTimezoneUtc.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const selector = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../src/config/featureFlags.js', async original => ({ ...await original(), get STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED() { return selector.enabled; } }));
import { prepareStockCreation, stockCreationDb, scoreCorrectedPosition, lateStartRefusal, STOCK_LATE_START_CUTOFF_MINUTES, decisionQuote, bindStockReceipt, readCorrectedInputs } from './stockThresholdAdmission.js';
import { collectStockObservation, wellFormedFigi } from './stockThresholdMeasurementProvider.js';
import { validStockAdmissionControl, stockAdmissionSelects, STOCK_APPROVAL, APPROVED_STOCK_POLICY } from './stockThresholdPolicyRegistry.js';
import { commitBattleDocWithPin } from './compositionGenerationFence.js';
import { executeSwapServer } from './agentSwapExecution.js';
import { canonicalContentHash } from './canonicalHash.js';
import { getSessionForDate, etWallClockToMs } from '../../src/utils/marketCalendar.js';
// The real import of the shared creation window is its Node dependency-surface guard (BUILD_RULES §4): never mock it.
import { eveningWindowRefusal, stockAdmissionRetryAt, NIGHT_GAME_CLOSE, STOCK_PUBLICATION_DELAY_MINUTES } from '../../src/utils/stockAdmissionWindow.js';
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
// expiresAt is the fence's stock-only full-day expiry for both creation clocks used
// here (Oct 15 after the close and Oct 16 in session): Oct 16, 16:00 ET (P2 reads it).
const creationDoc = (ownerId = 'owner-pilot', expiresAt = '2026-10-16T20:00:00.000Z') => ({ ownerId, expiresAt, gameMode: 'baggerbomb_agent', duration: 'fullday', portfolio: { star: [{ symbol: 'AAPL', baseATR: 2.5 }], core: [], support: [], startingPrices: {} }, opponent: { portfolio: { star: [{ symbol: 'MSFT', baseATR: 3 }], core: [], support: [] } }, scoring: {}, scoreState: {} });
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
    const cutover = () => (failCommit === 'carriage'
      ? Object.assign(new Error('hypothesis carriage race'), { hypothesisCarriage: true })
      : Object.assign(new Error('composition cutover interleaved'), { code: 'battle_cutover_interleaved' }));
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
    // A hypothesis-carriage race keeps its own error, selected or not (review mutation lens R6c).
    const carriage = await create({ flag: true, ctl: control(), ownerId: 'owner-pilot', options: tiered, failCommit: 'carriage' });
    expect(carriage.e).toMatchObject({ name: 'Error', hypothesisCarriage: true }); expect(carriage.e.name).not.toBe('StockThresholdRefusal');
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
    expect(canonicalContentHash(APPROVED_STOCK_POLICY)).toBe(STOCK_MODEL.policyHash);
    expect(canonicalContentHash(APPROVED_STOCK_POLICY.publicationRule)).toBe('3ad8e14b203acd660faba9b8ec7e78c7dcb9f312741ec04cd062bcf79741a85f');
    expect(APPROVED_STOCK_POLICY).toMatchObject({ modelId: 'stock_measured_atr14_fullday_v2', modelVersion: 2 });
  });
});

describe('security identity follow-up (P1, build report §6a Option A): ISIN, else a well-formed FIGI', () => {
  // Live General blocks, Oct 15 2026 (GET only): US issuers carry ISIN null and an
  // OpenFigi; a foreign issuer (ACN) carries both. BRK-A and BRK-B share a CIK.
  const LIVE = {
    ACN: { ISIN: 'IE00B4BNMY34', OpenFigi: 'BBG000D9D830', CIK: '0001467373' },
    UNP: { ISIN: null, OpenFigi: 'BBG000BW3299', CIK: '0000100885' },
    'BRK-A': { ISIN: null, OpenFigi: 'BBG000DWDMY4', CIK: '0001067983' },
    'BRK-B': { ISIN: null, OpenFigi: 'BBG000DWH8Q0', CIK: '0001067983' },
  };
  const general = fields => v => (v.Type ? { ...v, ...fields } : v);
  const observe = (symbol, fields = LIVE[symbol]) => stockObservation(symbol, { changeResponse: general(fields) });
  it('a non-empty ISIN keeps the old form, even beside a FIGI', async () => {
    expect((await observe('ACN')).securityId).toBe('EODHD:ACN.US:IE00B4BNMY34');
  });
  it('ISIN null (or empty) with a well-formed FIGI gives the FIGI form', async () => {
    expect((await observe('UNP')).securityId).toBe('EODHD:UNP.US:FIGI:BBG000BW3299');
    expect((await observe('UNP', { ...LIVE.UNP, ISIN: '' })).securityId).toBe('EODHD:UNP.US:FIGI:BBG000BW3299');
    expect(wellFormedFigi('BBG001S5N8V8')).toBe(true); // a share-class FIGI has the same shape
  });
  it.each([
    ['a bad check digit', 'BBG000BW3298'], ['lower case', 'bbg000bw3299'], ['11 characters', 'BBG000BW329'], ['13 characters', 'BBG000BW32990'],
    // Each malformed value below keeps a check digit the loop accepts, so only the named
    // check can refuse it (blockers review BK3-2); an 11-character value can never pass the loop.
    ['a vowel (valid check digit)', 'BAG000BW3291'], ['third character not G (valid check digit)', 'BBH000BW3298'], ['a reserved prefix (valid check digit)', 'BSG000B9XRY7'],
    ['surrounding space', ' BBG000BW3244'], ['mixed case', 'bbg000BW3299'], ['a number', 123456789012], ['empty', ''], ['null', null], ['absent', undefined],
  ])('ISIN null with a malformed FIGI (%s) is refused before the quote GET', async (_, OpenFigi) => {
    const fetched = [];
    await expect(stockObservation('UNP', { changeResponse: (v, url) => { fetched.push(url.pathname); return general({ ISIN: null, OpenFigi, CIK: LIVE.UNP.CIK, LEI: '549300HO5WFZUT5N2T22' })(v); } }))
      .rejects.toMatchObject({ name: 'StockThresholdRefusal', reason: 'security_identity_unqualified', retriable: true });
    expect(fetched.some(p => p.includes('/real-time/'))).toBe(false);
  });
  it('neither ISIN nor FIGI is refused, whatever CIK and LEI say; every other identity check is unchanged', async () => {
    await expect(observe('UNP', { ISIN: null, OpenFigi: null, CIK: LIVE.UNP.CIK, LEI: '549300HO5WFZUT5N2T22' })).rejects.toMatchObject({ reason: 'security_identity_unqualified' });
    for (const bad of [{ Code: 'MSFT' }, { IsDelisted: true }, { Exchange: 'OTC' }, { Type: 'ETF' }, { CountryISO: 'CA' }]) {
      await expect(observe('UNP', { ...LIVE.UNP, ...bad }), JSON.stringify(bad)).rejects.toMatchObject({ reason: 'security_identity_unqualified' });
      await expect(observe('ACN', { ...LIVE.ACN, ...bad }), JSON.stringify(bad)).rejects.toMatchObject({ reason: 'security_identity_unqualified' });
    }
  });
  it('BRK-A and BRK-B get different ids: one composite FIGI per security, unlike their shared CIK', async () => {
    const a = await observe('BRK-A'), b = await observe('BRK-B');
    expect(a.securityId).toBe('EODHD:BRK-A.US:FIGI:BBG000DWDMY4'); expect(b.securityId).toBe('EODHD:BRK-B.US:FIGI:BBG000DWH8Q0');
    expect(a.securityId.split(':').at(-1)).not.toBe(b.securityId.split(':').at(-1));
    expect(LIVE['BRK-A'].CIK).toBe(LIVE['BRK-B'].CIK);
  });
  it('a FIGI receipt scores and its input replays; a changed id is refused in the input or the receipt; the v2 policy hash does not move', async () => {
    const figi = v => (v.Type ? { ...v, ISIN: null, OpenFigi: 'BBG000B9XRY4' } : v);
    const { battle, inputs } = await correctedStockBattle({ changeResponse: figi });
    const a = battle.portfolio.star[0], r = a.stockThresholdReceipt;
    expect(r.securityId).toBe('EODHD:AAPL.US:FIGI:BBG000B9XRY4'); expect(inputs[r.inputRef].securityId).toBe(r.securityId);
    expect(stockRewardContext(battle, a, 'agent', 'star', 0, q(104, '2026-10-14T13:50:00.000Z')).status).toBe('valid');
    const replay = (b, store) => { const h = inputStore(b, store); return h.db.runTransaction(tx => readCorrectedInputs(tx, h.db, b)); };
    await expect(replay(battle, inputs)).resolves.toBe(undefined);
    const changedInput = structuredClone(inputs); changedInput[r.inputRef].securityId = 'EODHD:AAPL.US:FIGI:BBG000BPH459';
    await expect(replay(battle, changedInput)).rejects.toMatchObject({ reason: 'immutable_observation_corrupt' });
    const changedReceipt = structuredClone(battle); changedReceipt.portfolio.star[0].stockThresholdReceipt.securityId = 'EODHD:AAPL.US:US0378331005';
    await expect(replay(changedReceipt, inputs)).rejects.toMatchObject({ reason: 'receipt_hash_mismatch' });
    expect(STOCK_MODEL.policyHash).toBe('22a815985037ddba74526973237817f233e38fd97cb1b1cff5f33e7af345050b');
  });
});

describe('evening window (P2, build report §6b option (a)): a pilot battle that would expire before any session can score it is refused', () => {
  const ET = (date, hh, mm, ss = 0) => etWallClockToMs(date, hh, mm) + ss * 1000;
  const iso = ms => new Date(ms).toISOString();
  const crypto = { symbol: 'BTC-USD.CC', isCrypto: true, baseATR: 5 };
  // createAgentBattle under the faked clock: the fenced computeFullDayExpiry sets
  // expiresAt, so these rows read the battle's own expiry, never a clock literal.
  // The provider is offline, so a creation that passes every window check reaches
  // its first GET and is refused provider_failure; one refused by a window check
  // never calls fetch.
  async function createAt(ms, { roster = 'crypto', ownerId = 'owner-pilot', ctl = control() } = {}) {
    selector.enabled = true;
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(ms));
    const fetchSpy = vi.fn(async () => { throw Error('offline'); }); vi.stubGlobal('fetch', fetchSpy);
    const { createAgentBattle } = await import('./agentBattleService.js');
    const { makeCompositionStoreDouble } = await import('./__fixtures__/compositionStoreDouble.js');
    const composition = makeCompositionStoreDouble(); const added = [];
    const db = {
      doc: path => ({ path, id: path.split('/').at(-1), get: async () => (ctl === null ? { exists: false, data: () => undefined } : { exists: true, data: () => structuredClone(ctl) }) }),
      collection: name => composition.collection(name) ?? { add: async doc => { added.push(doc); return { id: 'battle-1' }; }, doc: id => ({ id: id ?? 'battle-1', path: `${name}/${id ?? 'battle-1'}` }) },
      runTransaction: async fn => fn({ get: async ref => ref.get(), create: async (r, doc) => { added.push(doc); }, update: () => {} }),
    };
    const portfolio = { star: [{ symbol: 'AAPL', baseATR: 2.5 }], core: [], support: roster === 'crypto' ? [{ ...crypto }] : [] };
    const agent = { id: 'agent-1', ownerId, name: 'Cipher', archetype: 'diversifier', lastDecision: { portfolio, bench: { stocks: [], crypto: null }, watchlist: { active: [], hotBench: [], monitoring: [] } } };
    const result = await createAgentBattle(db, agent, {}, {}, { duration: 'fullday', opponent: { portfolio: { star: [{ symbol: 'MSFT', baseATR: 2.5 }], core: [], support: [] } } }).then(r => ({ r }), e => ({ e }));
    vi.useRealTimers();
    return { ...result, added, fetchSpy };
  }
  it('runs in the production process zone (UTC): the fenced computeFullDayExpiry derives its instant from it', () => {
    // Under another zone the fence's expiry shifts by the zone offset (pre-existing,
    // out of scope); the first import pins UTC, and this row fails first, by name,
    // if a pool ever ignores that pin (worker threads do).
    expect(new Date(Date.UTC(2026, 9, 21)).getTimezoneOffset()).toBe(0);
  });
  const refusedBy = async (ms, opts) => { const c = await createAt(ms, opts); return { reason: c.e?.reason ?? null, fetched: c.fetchSpy.mock.calls.length, c }; };
  // The fence's expiry for a roster created at ms (legacy: ctl null = no control document).
  const fenceExpiry = async (ms, roster = 'crypto') => (await createAt(ms, { roster, ctl: null })).r.expiresAt;

  it.each([
    ['16:00 (the close)', 16, 0, 0], ['16:05 (inside the publication window)', 16, 5, 0], ['16:15', 16, 15, 0], ['18:00', 18, 0, 0], ['19:59', 19, 59, 0], ['19:59:59', 19, 59, 59],
  ])('regular weekday, crypto roster, %s ET: evening_window before any GET', async (_, hh, mm, ss) => {
    const r = await refusedBy(ET('2026-10-21', hh, mm, ss));
    expect(r.c.e).toMatchObject({ name: 'StockThresholdRefusal', reason: 'evening_window', retriable: true });
    expect(r.fetched).toBe(0); expect(r.c.added).toEqual([]);
  });
  it('the late start and the evening window leave no gap at the close', async () => {
    expect((await refusedBy(ET('2026-10-21', 15, 59, 59))).reason).toBe('late_start_cutoff');
    expect((await refusedBy(ET('2026-10-21', 16, 0, 0))).reason).toBe('evening_window');
  });
  it.each([
    ['20:00 (the Night Game close)', '2026-10-21', 20, 0], ['20:15', '2026-10-21', 20, 15], ['23:30', '2026-10-21', 23, 30], ['pre-open 08:00', '2026-10-22', 8, 0], ['in session 10:00', '2026-10-22', 10, 0],
  ])('crypto roster at %s ET is allowed: the window passes and the collector makes its first GET', async (_, date, hh, mm) => {
    const r = await refusedBy(ET(date, hh, mm));
    expect(r.reason).toBe('provider_failure'); expect(r.fetched).toBeGreaterThan(0);
  });
  it('Friday evening is refused; Saturday is allowed', async () => {
    expect(await fenceExpiry(ET('2026-10-23', 18, 0))).toBe(iso(ET('2026-10-23', 20, 0)));
    expect((await refusedBy(ET('2026-10-23', 18, 0))).reason).toBe('evening_window');
    expect(await fenceExpiry(ET('2026-10-24', 12, 0))).toBe(iso(ET('2026-10-26', 20, 0)));
    const sat = await refusedBy(ET('2026-10-24', 12, 0));
    expect(sat.reason).toBe('provider_failure'); expect(sat.fetched).toBeGreaterThan(0);
  });
  it('early-close day (Nov 27): refused from 12:15 ET until its expiry moves to the next session; there is no Night Game', async () => {
    // A crypto roster on an early-close day expires at the 13:00 close, so its
    // "evening expiry" is the close itself; from 13:00 it expires Monday 20:00.
    expect(await fenceExpiry(ET('2026-11-27', 12, 30))).toBe(iso(ET('2026-11-27', 13, 0)));
    expect(await fenceExpiry(ET('2026-11-27', 13, 0))).toBe(iso(ET('2026-11-30', 20, 0)));
    expect((await refusedBy(ET('2026-11-27', 12, 14, 59))).reason).toBe('provider_failure');
    for (const [hh, mm, ss] of [[12, 15, 0], [12, 45, 0], [12, 59, 59]]) expect((await refusedBy(ET('2026-11-27', hh, mm, ss))).reason, `${hh}:${mm}:${ss}`).toBe('late_start_cutoff');
    for (const [hh, mm, ss] of [[13, 0, 0], [13, 14, 59]]) { const r = await refusedBy(ET('2026-11-27', hh, mm, ss)); expect(r.reason, `${hh}:${mm}:${ss}`).toBe('publication_window_not_open'); expect(r.fetched).toBe(0); }
    const open = await refusedBy(ET('2026-11-27', 13, 15, 0));
    expect(open.reason).toBe('provider_failure'); expect(open.fetched).toBeGreaterThan(0);
  });
  it('a stock-only roster after the close is allowed: it plays the next session', async () => {
    expect(await fenceExpiry(ET('2026-10-21', 18, 0), 'stocks')).toBe(iso(ET('2026-10-22', 16, 0)));
    const r = await refusedBy(ET('2026-10-21', 18, 0), { roster: 'stocks' });
    expect(r.reason).toBe('provider_failure'); expect(r.fetched).toBeGreaterThan(0);
  });
  it('a non-allowlisted owner in the window keeps the legacy battle, with zero collector calls', async () => {
    const r = await refusedBy(ET('2026-10-21', 18, 0), { ownerId: 'owner-other' });
    expect(r.c.e).toBeUndefined(); expect(r.fetched).toBe(0);
    expect(r.c.added).toHaveLength(1); expect(Object.hasOwn(r.c.added[0].scoring, 'stockThresholdModel')).toBe(false);
    expect(r.c.added[0].expiresAt).toBe(iso(ET('2026-10-21', 20, 0)));
  });
  it('outside a session a selected creation needs a readable expiry; during a session the expiry is not read', async () => {
    const collector = vi.fn(); const h = creationStore(control());
    await expect(prepareStockCreation(creationDoc('owner-pilot', 'not-an-instant'), { db: h.db, collector, now: () => new Date(ET('2026-10-21', 20, 30)) })).rejects.toMatchObject({ reason: 'invalid_battle_expiry', retriable: true });
    await expect(prepareStockCreation(creationDoc('owner-pilot', null), { db: h.db, collector, now: () => new Date(ET('2026-10-24', 12, 0)) })).rejects.toMatchObject({ reason: 'invalid_battle_expiry' });
    expect(collector).not.toHaveBeenCalled();
    expect(eveningWindowRefusal(iso(ET('2026-10-21', 10, 0)), 'not-an-instant')).toBe(null);
    expect(eveningWindowRefusal(iso(ET('2026-10-21', 8, 0)), undefined)).toBe(null);
    expect(eveningWindowRefusal('not-an-instant', iso(ET('2026-10-21', 20, 0)))).toBe('invalid_creation_instant');
    expect(eveningWindowRefusal('2028-01-04T23:00:00.000Z', '2028-01-05T01:00:00.000Z')).toBe('calendar_missing');
    // Exactly at the next open is still before any evaluating tick: refused only when strictly before.
    expect(eveningWindowRefusal(iso(ET('2026-10-21', 18, 0)), iso(ET('2026-10-22', 9, 30) - 1))).toBe('evening_window');
    expect(eveningWindowRefusal(iso(ET('2026-10-21', 18, 0)), iso(ET('2026-10-22', 9, 30)))).toBe(null);
  });
  it('sweep: every refused instant names a retry time that is the first instant the same rule accepts (EDT week and the EST Thanksgiving week)', async () => {
    // Every 15 minutes, a crypto roster (tiered rosters always carry one). The rule
    // is the server's own: the late start, the evening window on the fence's
    // expiry, and the collector's publication window (real code, offline GET).
    const collectorWindow = async ms => collectStockObservation('AAPL', 2.5, { now: () => new Date(ms), fetcher: async () => { throw Error('offline'); } }).then(() => null, e => (e.reason === 'provider_failure' ? null : e.reason));
    const refusal = async ms => lateStartRefusal(iso(ms)) || eveningWindowRefusal(iso(ms), await fenceExpiry(ms)) || collectorWindow(ms);
    const days = [['2026-10-19', 7], ['2026-11-23', 8]];
    let refused = 0, named = 0;
    for (const [start, n] of days) {
      const from = ET(start, 0, 0);
      for (let ms = from; ms < from + n * 86_400_000; ms += 15 * 60000) {
        const reason = await refusal(ms);
        if (!reason) continue;
        refused++;
        if (reason !== 'late_start_cutoff' && reason !== 'evening_window') continue;
        named++;
        const retry = stockAdmissionRetryAt(iso(ms));
        expect(retry, iso(ms)).toBeGreaterThan(ms);
        expect(await refusal(retry), `${iso(ms)} → ${iso(retry)}`).toBe(null);
        expect(await refusal(retry - 1000), `${iso(ms)} → ${iso(retry)} − 1 s`).not.toBe(null);
      }
    }
    // Nine regular weekdays × 19 instants (late start 15:15–15:45, evening 16:00–19:45) = 171, plus the
    // early close's late start (12:15–12:45) = 174 named; its 13:00 publication window is the one more refusal.
    expect({ refused, named }).toEqual({ refused: 175, named: 174 });
  }, 240_000);
  it('the retry time is the Night Game close on a regular day and the end of the publication window on an early-close day', () => {
    expect(NIGHT_GAME_CLOSE).toEqual({ hour: 20, minute: 0 });
    // The shared delay is the hashed publication rule's own minimum (blockers review BK2-7).
    expect(STOCK_PUBLICATION_DELAY_MINUTES).toBe(APPROVED_STOCK_POLICY.publicationRule.minimumMinutesAfterScheduledClose); expect(STOCK_PUBLICATION_DELAY_MINUTES).toBe(15);
    expect(stockAdmissionRetryAt(iso(ET('2026-10-21', 15, 30)))).toBe(ET('2026-10-21', 20, 0));
    expect(stockAdmissionRetryAt(iso(ET('2026-10-21', 18, 0)))).toBe(ET('2026-10-21', 20, 0));
    expect(stockAdmissionRetryAt(iso(ET('2026-11-27', 12, 30)))).toBe(ET('2026-11-27', 13, 15));
    expect(stockAdmissionRetryAt(iso(ET('2026-10-24', 12, 0)))).toBe(null);
    expect(stockAdmissionRetryAt('not-an-instant')).toBe(null);
  });
});
