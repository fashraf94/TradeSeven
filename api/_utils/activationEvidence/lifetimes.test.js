// api/_utils/activationEvidence/lifetimes.test.js
//
// ID-1 Build 2 — discovery of each owner slot's lifetimes (contract §4.1), on
// fixtures in the writers' own shapes (__fixtures__/activationBattles.js) and,
// for the corrected route, on documents the REAL writer produced: the corrected
// writer itself (stockThresholdAdmission.js executeCorrectedStockSwap, the non-fenced
// function the fenced executeSwapServer dispatches to) through the stockThresholdHarness.
// No fenced function is called (build prompt V3 §0).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file imports lifetimes.js and
// discover.js unmocked; their src/ and store imports load here as in production.

import { describe, it, expect } from 'vitest';
import { lifetimesOf, instantMsOf, fallbackIdOf, hasGap, isoOf } from './lifetimes.js';
import { discoverActivations } from './discover.js';
import { legacyBattle, legacySwap, correctedBattle, correctedSwap, CREATED_AT, ADMITTED_AT, stock, crypto } from './__fixtures__/activationBattles.js';
import { correctedStockBattle, stockObservation, stockWriterDb, STOCK_TEST_NOW } from '../__fixtures__/stockThresholdHarness.js';
import { executeCorrectedStockSwap } from '../stockThresholdAdmission.js';

const stocks = (b) => lifetimesOf(b).records.filter((r) => r.status === 'stock');
const at = (b, tier, slot) => lifetimesOf(b).records.filter((r) => r.tier === tier && r.slot === slot);
const T1 = '2026-11-05T15:02:11.412Z';
const T2 = '2026-11-05T16:40:00.001Z';
const T3 = '2026-11-05T18:05:30.500Z';

describe('legacy route', () => {
  it('a starting position held all day: one creation per stock slot, the fallback id from battle.activatedAt; the crypto slot skipped', () => {
    const b = legacyBattle();
    const { records, gap } = lifetimesOf(b);
    expect(gap).toBe(false);
    expect(records.filter((r) => r.status === 'stock')).toHaveLength(6);
    expect(records.filter((r) => r.status === 'crypto')).toEqual([expect.objectContaining({ tier: 'support', slot: 2, symbol: 'BTC', kind: 'creation' })]);
    expect(at(b, 'star', 0)[0]).toMatchObject({
      status: 'stock', kind: 'creation', symbol: 'NVDA', route: 'legacy', activationId: `star:0:${CREATED_AT}`,
      activatedAt: CREATED_AT, activatedAtMs: Date.parse(CREATED_AT), activatedAtSource: 'battle_activatedAt', row: null,
    });
  });
  it('sold once: the creation keeps its id and instant; the swap-in is named from its row', () => {
    const b = legacyBattle();
    legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, evaluationId: 'risk_stop_NVDA_1' });
    const [creation, swapIn] = at(b, 'star', 0);
    expect(creation).toMatchObject({ kind: 'creation', symbol: 'NVDA', activationId: `star:0:${CREATED_AT}`, activatedAtSource: 'battle_activatedAt' });
    expect(swapIn).toMatchObject({
      kind: 'swap_in', symbol: 'JPM', route: 'legacy', activationId: `star:0:${T1}`, activatedAt: T1, activatedAtSource: 'trade_row',
      row: { swappedOutAt: T1, symbolOut: 'NVDA', symbolIn: 'JPM', evaluationId: 'risk_stop_NVDA_1', verificationId: 'b-legacy:risk_stop_NVDA_1:verify', incomingPositionId: null },
    });
  });
  it('A → B → A: the returning A is a swap-in with its own id, never the starting position', () => {
    const b = legacyBattle();
    legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1 });
    legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'NVDA', at: T2 });
    const rs = at(b, 'star', 0);
    expect(rs.map((r) => [r.kind, r.symbol, r.activationId])).toEqual([
      ['creation', 'NVDA', `star:0:${CREATED_AT}`], ['swap_in', 'JPM', `star:0:${T1}`], ['swap_in', 'NVDA', `star:0:${T2}`],
    ]);
  });
  it('two swaps in one slot, and rows of other slots interleaved, are ordered by swappedOutAt', () => {
    const b = legacyBattle();
    legacySwap(b, { tier: 'core', slot: 1, symbolIn: 'JPM', at: T1 });
    legacySwap(b, { tier: 'star', slot: 1, symbolIn: 'CVX', at: T2 });
    legacySwap(b, { tier: 'core', slot: 1, symbolIn: 'BRK-B', at: T3 });
    expect(at(b, 'core', 1).map((r) => r.symbol)).toEqual(['AAPL', 'JPM', 'BRK-B']);
    // Rows stored out of order are still ordered by their instants.
    const swapped = legacyBattle();
    legacySwap(swapped, { tier: 'core', slot: 1, symbolIn: 'JPM', at: T1 });
    legacySwap(swapped, { tier: 'core', slot: 1, symbolIn: 'BRK-B', at: T3 });
    swapped.trades.reverse();
    expect(at(swapped, 'core', 1).map((r) => r.symbol)).toEqual(['AAPL', 'JPM', 'BRK-B']);
  });
});

describe('corrected route', () => {
  it('a corrected starting position still held: the live positionId and the live swappedInAt', () => {
    const b = correctedBattle();
    expect(at(b, 'star', 0)[0]).toMatchObject({ kind: 'creation', route: 'corrected', activationId: 'pos-star-0', activatedAt: ADMITTED_AT, activatedAtSource: 'position_swappedInAt' });
  });
  it('sold: the closing row\'s outgoingPositionId and its outgoingReceipt.enteredAt; the swap-in is the row\'s incomingPositionId', () => {
    const b = correctedBattle();
    correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'pos-in-1' });
    const [creation, swapIn] = at(b, 'star', 0);
    expect(creation).toMatchObject({ activationId: 'pos-star-0', activatedAt: ADMITTED_AT, activatedAtSource: 'outgoing_receipt' });
    expect(swapIn).toMatchObject({ route: 'corrected', activationId: 'pos-in-1', activatedAt: T1, activatedAtSource: 'trade_row', row: { incomingPositionId: 'pos-in-1', verificationId: null } });
  });
  it('id stability across two runs: held, then sold — the same id and instant on both routes', () => {
    for (const make of [legacyBattle, correctedBattle]) {
      const b = make();
      const held = at(b, 'core', 0)[0];
      if (b.scoring.stockThresholdModel) correctedSwap(b, { tier: 'core', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'pos-in-1' });
      else legacySwap(b, { tier: 'core', slot: 0, symbolIn: 'JPM', at: T1 });
      const sold = at(b, 'core', 0)[0];
      expect([sold.activationId, sold.activatedAt]).toEqual([held.activationId, held.activatedAt]);
      expect(sold.activatedAtSource).not.toBe('trade_row');
    }
  });
  it('A → B → A on the corrected route: three lifetimes, three position ids', () => {
    const b = correctedBattle();
    correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'pos-in-1' });
    correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'NVDA', at: T2, positionId: 'pos-in-2' });
    expect(at(b, 'star', 0).map((r) => [r.symbol, r.activationId, r.activatedAt])).toEqual([['NVDA', 'pos-star-0', ADMITTED_AT], ['JPM', 'pos-in-1', T1], ['NVDA', 'pos-in-2', T2]]);
  });
  it('THE REAL WRITER: A → B → A through the corrected writer names three lifetimes with the writer\'s own ids', async () => {
    // The harness's collector refuses without a provider key (stockThresholdAdmission.test.js sets the same one); nothing is fetched.
    const savedKey = process.env.EODHD_API_KEY;
    process.env.EODHD_API_KEY = 'isolated-key';
    try {
    const { battle, inputs } = await correctedStockBattle({ cpuSymbol: 'TSLA' });
    // The creation-time fields discovery reads, as createAgentBattle writes them (the harness leaves them out).
    battle.portfolio.star[0].isCrypto = false;
    Object.assign(battle, { agentContext: { archetype: 'momentum_chaser', initialPortfolio: { star: [{ symbol: 'AAPL', baseATR: 2.5, isCrypto: false }], core: [], support: [] } }, timing: { tradingDays: ['2026-10-14'] } });
    battle.portfolio.bench.stocks = [{ symbol: 'MSFT', baseATR: 3, isCrypto: false }];
    const h = stockWriterDb({ [`agentBattles/${battle.id}`]: battle, ...inputs, 'indexIntelligence/stockRankings': { stocks: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }, { symbol: 'TSLA' }] } });
    const swap = async (incoming, iso, prices) => {
      const expected = { ...h.store.get(`agentBattles/${battle.id}`), id: battle.id };
      return executeCorrectedStockSwap(h.db, battle.id, expected, 'star', 0, incoming, prices, 1, {}, null, { now: () => new Date(iso), collector: (s) => stockObservation(s, { clock: () => new Date(iso) }) });
    };
    const t1 = '2026-10-14T14:03:00.000Z';
    const t2 = '2026-10-14T14:40:00.000Z';
    await swap({ symbol: 'MSFT', baseATR: 3, isCrypto: false }, t1, { AAPL: { current: 103.27, timestamp: Date.parse(t1) / 1000 } });
    await swap({ symbol: 'AAPL', baseATR: 2.5, isCrypto: false }, t2, { MSFT: { current: 104, timestamp: Date.parse(t2) / 1000 }, AAPL: { current: 103.5, timestamp: Date.parse(t2) / 1000 } });
    const live = h.store.get(`agentBattles/${battle.id}`);
    expect(live.trades).toHaveLength(2);
    const rs = lifetimesOf(live).records;
    expect(rs.map((r) => [r.status, r.kind, r.symbol, r.activatedAtSource])).toEqual([
      ['stock', 'creation', 'AAPL', 'outgoing_receipt'], ['stock', 'swap_in', 'MSFT', 'trade_row'], ['stock', 'swap_in', 'AAPL', 'trade_row'],
    ]);
    expect(rs[0]).toMatchObject({ activationId: 'position-agent', activatedAt: STOCK_TEST_NOW });
    expect(rs[1].activationId).toBe(live.trades[0].incomingPositionId);
    expect(rs[2].activationId).toBe(live.portfolio.star[0].positionId);
    expect(new Set(rs.map((r) => r.activationId)).size).toBe(3);
    } finally {
      if (savedKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = savedKey;
    }
  });
});

describe('consistency — any disagreement makes the slot unresolved (inconsistent)', () => {
  const corrupt = {
    'lifetime 0 is not the first row\'s symbolOut': (b) => { legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1 }); b.trades[0].symbolOut = 'AMD'; },
    'a row\'s symbolIn is not the next row\'s symbolOut': (b) => { legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1 }); legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'CVX', at: T2 }); b.trades[1].symbolOut = 'BRK-B'; },
    'the last lifetime is not the live symbol': (b) => { legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1 }); b.portfolio.star[0].symbol = 'CVX'; },
    'the last row\'s swappedOutAt is not the live swappedInAt': (b) => { legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1 }); b.portfolio.star[0].swappedInAt = T2; },
    'the live position is missing': (b) => { b.portfolio.star[0] = null; },
    'two rows of one slot at the same instant': (b) => { legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1 }); legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'CVX', at: T1 }); },
  };
  for (const [label, mutate] of Object.entries(corrupt)) {
    it(`legacy: ${label}`, () => {
      const b = legacyBattle();
      mutate(b);
      const rs = at(b, 'star', 0);
      expect(rs.length).toBeGreaterThan(0);
      expect(rs.every((r) => r.status === 'unresolved' && r.reason === 'inconsistent')).toBe(true);
      expect(at(b, 'star', 1)[0].status).toBe('stock'); // only that slot
    });
  }
  const correctedCorrupt = {
    'a row\'s incomingPositionId is not the next row\'s outgoingPositionId': (b) => { correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'p1' }); correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'CVX', at: T2, positionId: 'p2' }); b.trades[1].outgoingPositionId = 'px'; },
    'the last row\'s incomingPositionId is not the live positionId': (b) => { correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'p1' }); b.portfolio.star[0].positionId = 'px'; },
    'a corrected stock swap-in whose incoming receipt names another instant': (b) => { correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'p1' }); b.trades[0].incomingReceipt.enteredAt = T2; },
    'a corrected stock swap-in with no incoming receipt': (b) => { correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'p1' }); b.trades[0].incomingReceipt = null; },
    'a legacy row after a corrected one (mixed routes)': (b) => { correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'p1' }); legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'CVX', at: T2 }); },
  };
  for (const [label, mutate] of Object.entries(correctedCorrupt)) {
    it(`corrected: ${label}`, () => {
      const b = correctedBattle();
      mutate(b);
      expect(at(b, 'star', 0).every((r) => r.status === 'unresolved' && r.reason === 'inconsistent')).toBe(true);
    });
  }
  it('the route: the battle\'s stamp and every lifetime\'s own position-id field agree, or the slot is inconsistent — an id never flips to the fallback (review L1-1)', () => {
    const sold = () => { const b = correctedBattle(); correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'p1' }); return b; };
    const cases = {
      'a corrected starting position sold, its closing row missing outgoingPositionId': (() => { const b = sold(); delete b.trades[0].outgoingPositionId; return b; })(),
      'a corrected starting position held, its live positionId missing': (() => { const b = correctedBattle(); delete b.portfolio.star[0].positionId; return b; })(),
      'a corrected swap-in whose row lost both position ids': (() => { const b = sold(); delete b.trades[0].incomingPositionId; delete b.trades[0].outgoingPositionId; delete b.portfolio.star[0].positionId; return b; })(),
      'a legacy battle with a position id on a live position': (() => { const b = legacyBattle(); b.portfolio.star[0].positionId = 'stray'; return b; })(),
      'a corrected id that is no usable document id': (() => { const b = correctedBattle(); b.portfolio.star[0].positionId = 'a/b'; return b; })(),
    };
    for (const [label, b] of Object.entries(cases)) {
      expect([label, at(b, 'star', 0).every((r) => r.status === 'unresolved' && r.reason === 'inconsistent')]).toEqual([label, true]);
    }
    // Crypto on the corrected route carries its ids too, so it stays consistent (and skipped).
    expect(at(correctedBattle(), 'support', 2)).toEqual([expect.objectContaining({ status: 'crypto' })]);
  });
  // V1.9 §4 (Astra's review 4): before the fix, a non-string id read as absent (idOf) where an id was taken and passed
  // the id pattern through String(): a numeric id on a corrected battle turned the lifetime into a FALLBACK id.
  describe('V1.9: a position id must be a string — a number or a boolean makes the slot inconsistent, never a fallback id', () => {
    const shapes = {
      'a starting position still held (its live positionId)': (b, v) => { b.portfolio.star[0].positionId = v; },
      'a starting position already sold (its closing row\'s outgoingPositionId)': (b, v) => { correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'p1' }); b.trades[0].outgoingPositionId = v; },
      'a swap-in row (its incomingPositionId, the live position carrying the same value)': (b, v) => { correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'p1' }); b.trades[0].incomingPositionId = v; b.portfolio.star[0].positionId = v; },
      'a live position after a swap (its positionId only)': (b, v) => { correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'p1' }); b.portfolio.star[0].positionId = v; },
      'a later row\'s outgoingPositionId (two swaps in the slot)': (b, v) => { correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'p1' }); correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'CVX', at: T2, positionId: 'p2' }); b.trades[0].incomingPositionId = v; b.trades[1].outgoingPositionId = v; },
    };
    for (const [label, put] of Object.entries(shapes)) {
      for (const v of [123, true, false, 0]) {
        it(`${label} = ${JSON.stringify(v)} → inconsistent, no activation in the slot`, () => {
          const b = correctedBattle();
          put(b, v);
          const rs = at(b, 'star', 0);
          expect(rs.length).toBeGreaterThan(0);
          expect(rs.every((r) => r.status === 'unresolved' && r.reason === 'inconsistent')).toBe(true);
          const d = discoverActivations(b);
          expect(d.activations.filter((a) => a.tier === 'star' && a.slot === 0)).toEqual([]);
          expect(d.activations.some((a) => a.activationId === String(v) || a.activationId.startsWith('star:0:'))).toBe(false);
          expect(at(b, 'star', 1)[0].status).toBe('stock'); // only that slot
        });
      }
    }
    it('the same shapes with string ids stay named (the check reads the type, nothing else)', () => {
      const b = correctedBattle();
      correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'p1' });
      expect(at(b, 'star', 0).map((r) => [r.status, r.activationId])).toEqual([['stock', 'pos-star-0'], ['stock', 'p1']]);
    });
  });
  it('a row naming a slot the roster does not have is unresolved, and the slots are untouched', () => {
    const b = legacyBattle();
    b.trades.push({ ...legacySwap(legacyBattle(), { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1 }), slotIndex: 7 });
    b.scoreState.tradeCount = 1;
    const rs = lifetimesOf(b).records;
    expect(rs.filter((r) => r.status === 'unresolved')).toEqual([{ tier: 'star', slot: 7, kind: 'swap_in', index: null, status: 'unresolved', reason: 'inconsistent' }]);
    expect(rs.filter((r) => r.status === 'stock')).toHaveLength(6);
  });
  it('two lifetimes that would share an id are both unresolved, never one guessed over the other', () => {
    const b = legacyBattle();
    legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1 });
    b.activatedAt = T1; // the legacy creation's fallback id would equal the swap-in's
    b.agentContext.initialPortfolio.star[0] = stock('NVDA');
    const rs = at(b, 'star', 0);
    expect(rs.map((r) => r.status)).toEqual(['unresolved', 'unresolved']);
  });
});

describe('instants', () => {
  it('normalises to new Date(ms).toISOString(), refuses a non-date, and a date that does not round-trip', () => {
    expect(instantMsOf('2026-11-05T10:02:11.412-05:00')).toBe(Date.parse(T1));
    expect(isoOf(instantMsOf('2026-11-05T10:02:11.412-05:00'))).toBe(T1);
    expect(fallbackIdOf('core', 1, Date.parse(T1))).toBe(`core:1:${T1}`);
    for (const bad of [null, undefined, '', 'yesterday', '2026-02-30T00:00:00Z', '2026-11-05', 1730000000000, '2026-11-05T25:00:00Z']) expect(instantMsOf(bad)).toBe(null);
    expect(instantMsOf({ toMillis: () => Date.parse(T1) })).toBe(Date.parse(T1));
  });
  it('mutation lens LT15: a legacy starting position is dated by battle.activatedAt, even if the live position carries a swappedInAt', () => {
    const b = legacyBattle();
    b.portfolio.star[0].swappedInAt = '2026-11-05T16:00:00.000Z';
    expect(at(b, 'star', 0)[0]).toMatchObject({ status: 'stock', activatedAt: CREATED_AT, activatedAtSource: 'battle_activatedAt', activationId: `star:0:${CREATED_AT}` });
  });
  it('mutation lens LT16: the legacy fallback id is built from the NORMALISED activatedAt (an offset string, a Timestamp)', () => {
    expect(at(legacyBattle({ activatedAt: '2026-11-05T09:30:02.118-05:00' }), 'star', 0)[0].activationId).toBe(`star:0:${CREATED_AT}`);
    expect(at(legacyBattle({ activatedAt: { toMillis: () => Date.parse(CREATED_AT) } }), 'star', 0)[0].activationId).toBe(`star:0:${CREATED_AT}`);
  });
  it('a malformed battle.activatedAt leaves only the legacy creations unresolved (instant_malformed)', () => {
    const b = legacyBattle({ activatedAt: 'not a date' });
    legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1 });
    const rs = at(b, 'star', 0);
    expect(rs.map((r) => r.status === 'unresolved' ? r.reason : r.status)).toEqual(['instant_malformed', 'stock']);
  });
  it('a row whose swappedOutAt cannot be read leaves the slot\'s order unknown: instant_malformed for the slot', () => {
    const b = legacyBattle();
    legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: 'soon' });
    expect(at(b, 'star', 0).map((r) => r.reason)).toEqual(['instant_malformed', 'instant_malformed']);
  });
  it('a corrected position sold with no outgoing receipt: its instant cannot be read (instant_malformed)', () => {
    const b = correctedBattle();
    correctedSwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1, positionId: 'p1' });
    b.trades[0].outgoingReceipt = null;
    expect(at(b, 'star', 0).map((r) => r.reason ?? r.status)).toEqual(['instant_malformed', 'stock']);
  });
});

describe('class — from each lifetime\'s own evidence', () => {
  it('a crypto-out, stock-in row: the outgoing crypto is skipped, the incoming stock is named (its class from the live position)', () => {
    const b = legacyBattle();
    legacySwap(b, { tier: 'support', slot: 2, symbolIn: 'JPM', at: T1 });
    expect(b.trades[0].isCrypto).toBe(true);
    expect(at(b, 'support', 2).map((r) => [r.status, r.symbol])).toEqual([['crypto', 'BTC'], ['stock', 'JPM']]);
  });
  it('a stock-out, crypto-in row: the outgoing stock is named, the incoming crypto skipped', () => {
    const b = legacyBattle();
    legacySwap(b, { tier: 'support', slot: 0, symbolIn: 'ETH', at: T1, cryptoIn: true });
    expect(at(b, 'support', 0).map((r) => [r.status, r.symbol])).toEqual([['stock', 'KO'], ['crypto', 'ETH']]);
  });
  it('a lifetime whose class its evidence does not establish is class_unknown: a missing or non-boolean isCrypto, a .CC symbol called a stock', () => {
    for (const patch of [{ isCrypto: undefined }, { isCrypto: 'false' }, { symbol: 'BTC-USD.CC' }]) {
      const b = legacyBattle();
      Object.assign(b.portfolio.core[0], patch);
      if (patch.symbol) b.agentContext.initialPortfolio.core[0].symbol = patch.symbol;
      expect(at(b, 'core', 0)).toEqual([expect.objectContaining({ status: 'unresolved', reason: 'class_unknown' })]);
    }
  });
  it('a sold lifetime\'s class is its closing row\'s, not the roster\'s', () => {
    const b = legacyBattle();
    legacySwap(b, { tier: 'core', slot: 0, symbolIn: 'JPM', at: T1 });
    b.agentContext.initialPortfolio.core[0].isCrypto = true; // the roster is not the evidence
    expect(at(b, 'core', 0)[0].status).toBe('stock');
    b.trades[0].isCrypto = undefined;
    expect(at(b, 'core', 0)[0]).toMatchObject({ status: 'unresolved', reason: 'class_unknown' });
  });
});

describe('the gap — it overrides the root check', () => {
  it('detected exactly when tradeCount exceeds the retained rows (or a full array with no count)', () => {
    const b = legacyBattle();
    expect(hasGap(b)).toBe(false);
    b.scoreState.tradeCount = 1;
    expect(hasGap(b)).toBe(true);
    expect(hasGap({ trades: new Array(50).fill({}), scoreState: {} })).toBe(true);
    expect(hasGap({ trades: new Array(49).fill({}), scoreState: {} })).toBe(false);
  });
  it('unwritten starting lifetimes are gap (stock slots; the roster crypto slot is skipped); retained swap-ins are still named', () => {
    const b = legacyBattle();
    legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: T1 });
    legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'CVX', at: T2 });
    b.trades.shift(); // the first row was evicted
    b.scoreState.tradeCount = 7;
    const rs = lifetimesOf(b).records;
    expect(rs.filter((r) => r.status === 'unresolved' && r.reason === 'gap')).toHaveLength(6);
    expect(rs.filter((r) => r.status === 'crypto')).toEqual([expect.objectContaining({ tier: 'support', slot: 2, kind: 'creation' })]);
    // star[0]: the lifetime the earliest retained row closed (JPM) is not named; CVX, its incoming one, is.
    expect(at(b, 'star', 0).map((r) => [r.status, r.kind, r.symbol ?? null])).toEqual([['unresolved', 'creation', null], ['stock', 'swap_in', 'CVX']]);
    expect(at(b, 'star', 0)[1]).toMatchObject({ activationId: `star:0:${T2}`, index: null });
  });
  it('a retained swap-in whose slot prefix was evicted is written even when the row does not connect to the roster (no root check)', () => {
    const b = legacyBattle();
    legacySwap(b, { tier: 'core', slot: 1, symbolIn: 'JPM', at: T1 });
    b.trades[0].symbolOut = 'ZZZ'; // the evicted prefix moved AAPL out long ago; this row starts from ZZZ
    b.scoreState.tradeCount = 51;
    expect(at(b, 'core', 1).filter((r) => r.status === 'stock')).toEqual([expect.objectContaining({ kind: 'swap_in', symbol: 'JPM' })]);
    // Without the gap the same row breaks the root check.
    b.scoreState.tradeCount = 1;
    expect(at(b, 'core', 1).every((r) => r.reason === 'inconsistent')).toBe(true);
  });
  it('under a gap, the checks among retained rows and against the live position still hold', () => {
    const b = legacyBattle();
    legacySwap(b, { tier: 'core', slot: 1, symbolIn: 'JPM', at: T1 });
    b.scoreState.tradeCount = 9;
    b.portfolio.core[1].symbol = 'CVX';
    expect(at(b, 'core', 1).filter((r) => r.kind === 'swap_in')).toEqual([expect.objectContaining({ status: 'unresolved', reason: 'inconsistent' })]);
  });
});

describe('discover', () => {
  it('packages the activations, the crypto count, the unresolved and the schedule', () => {
    const b = legacyBattle();
    legacySwap(b, { tier: 'support', slot: 2, symbolIn: 'JPM', at: T1 });
    b.portfolio.core[0].isCrypto = undefined;
    const d = discoverActivations(b);
    expect(d.activations).toHaveLength(6); // five stock creations + JPM
    expect(d.cryptoSkipped).toBe(1);
    expect(d.unresolved).toEqual([{ kind: 'creation', tier: 'core', slot: 0, reason: 'class_unknown' }]);
    expect(d.schedule).toEqual({ terminal: false, expiresAtMs: Date.parse('2026-11-06T01:00:00.000Z'), cutoffAtMs: Date.parse('2026-11-06T01:30:00.000Z') });
    expect(Object.keys(d.activations[0]).sort()).toEqual(['activatedAt', 'activatedAtMs', 'activatedAtSource', 'activationId', 'kind', 'route', 'row', 'slot', 'symbol', 'tier']);
  });
  it('a crypto starting position on the corrected route has a positionId but is never an activation', () => {
    const b = correctedBattle();
    expect(b.portfolio.support[2].positionId).toBe('pos-support-2');
    expect(discoverActivations(b).activations.map((a) => a.activationId)).not.toContain('pos-support-2');
  });
  it('the opponent\'s holdings and the bench are never activations', () => {
    const b = correctedBattle();
    b.portfolio.bench.stocks.push(stock('ORCL'));
    b.opponent.portfolio.star.push(crypto('SOL'));
    const syms = discoverActivations(b).activations.map((a) => a.symbol);
    for (const s of ['TSLA', 'ORCL', 'JPM', 'BRK-B', 'CVX', 'SOL']) expect(syms).not.toContain(s);
  });
});
