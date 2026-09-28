// api/_utils/filmTape/tapeAmendmentC.test.js
//
// THE ROUND-3 ROWS — spec V1.2 Amendment C
// (docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_AMENDMENT_C_20260928.md), ruling
// on the round-2 executor review (build report §9.11): BA-36 (R1-1), BA-37
// (R2-3), BA-25 amended (R3-3) and BA-24 confirmed (R1-3). Each probe of §9.11
// is rebuilt here as a row that failed at 436199e4 before its fix; a row marked
// GUARD pins the other side of its ruling and passes at both.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL imports of the writer,
// the close pass, the candle pass, the replay and the read-out. Never mock
// them. The flag module is mocked by spreading the real one.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));

import { writeTapeDay } from './writeTapeDay.js';
import { runCandlePass } from './candlePass.js';
import { replayAction } from './tapeReplay.js';
import { replayBuiltFrom, priceBuiltFrom } from './candleInputs.js';
import { sessionBars } from './bars.js';
import { sessionFor } from './tapeTime.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay } from './__fixtures__/tapeFixtures.js';
import { flatRows, fetcherOf } from './__fixtures__/tapeBars.js';

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const MORNING = Date.parse('2026-09-25T11:00:30.000Z'); // run 2026-09-25: window from 2026-09-11
const DAY = 86_400_000;
const tapePath = (id, d = D) => `agentBattles/${id}/tape/${d}`;
const PRICES = { AAPL: 231, MSFT: 423, NVDA: 121, AMD: 144, KO: 70.5, PEP: 171, TSLA: 242, NFLX: 704, SNOW: 180, COST: 900, XLK: 250, XLP: 80, XLC: 95, XLY: 210, SPY: 560, RSP: 180 };
const allBars = (over = {}) => {
  const out = {};
  for (const [s, p] of Object.entries(PRICES)) out[s] = flatRows(D, p);
  return { ...out, ...over };
};
/** A session of 1-minute rows at `price` with the minutes in [fromUtc, toUtc) removed (a halt, a vendor hole). */
const holed = (price, fromUtc, toUtc) => flatRows(D, price).filter((r) => r.timestamp * 1000 < Date.parse(`${D}T${fromUtc}:00.000Z`) || r.timestamp * 1000 >= Date.parse(`${D}T${toUtc}:00.000Z`));

const world = (fx) => makeTapeDb(seedDay({}, fx));
const write = (t, fx, now = NIGHT) => writeTapeDay(fx.battleId, D, { db: t.db, now });
const tapeOf = (t, id, d = D) => t.store.get(tapePath(id, d));
const morning = (t, bars = allBars(), at = MORNING) => runCandlePass({ db: t.db, fetchCandles: fetcherOf(bars).fetchCandles, clock: () => at, startMs: at });
const amdTsla = (tape) => tape.actions.find((a) => a.symbolOut === 'AMD');
const koPlan = (tape) => tape.plans.find((p) => p.symbol === 'KO');
/** A unit's facts without its provenance: what a unit built from whole bars would hold. */
const factsOf = (unit) => ({ ...unit, preservedFrom: undefined });

/** The replay a candle pass builds from WHOLE bars (`rows`) — the reference a merge of two partial attempts is held to. */
function builtFromWholeBars(tape, rows = allBars()) {
  const session = sessionFor(D);
  const barsBySymbol = {};
  for (const [sym, r] of Object.entries(rows)) barsBySymbol[sym] = sessionBars(r, D, session);
  const a = amdTsla(tape);
  const replay = { ...replayAction({ action: a, checks: tape.checks, barsBySymbol, session, sectors: tape.comparables.sectors }), builtFrom: replayBuiltFrom(tape, a, session) };
  return { replay };
}

let errSpy;
beforeEach(() => { flags.writer = true; errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { errSpy.mockRestore(); });

// ── BA-36 — per-point merge for plan prices and replay points (R1-1) ─────────

describe('BA-36 (R1-1) — a retry merges plan prices and replay points point by point; a saved value is never replaced by null', () => {
  it('R1-1: a plan price saved as { atPlan 70.5, atClose null } meets { atPlan null, atClose 70.5 } — the merge keeps both points, carries preservedFrom, and the pass is written', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    // morning 1: KO's close sample is stale (its last bar closed 15:54 ET); the plan-time sample is fresh
    await morning(t, allBars({ KO: holed(PRICES.KO, '19:54', '20:00') }));
    const m1 = structuredClone(tapeOf(t, fx.battleId));
    expect(koPlan(m1).price).toMatchObject({ atPlan: { value: PRICES.KO }, atClose: { value: null, basis: 'stale_bar' }, missingInputs: ['price:KO@close'] });
    expect(m1.passes.candles.status).toBe('partial');
    // morning 2: KO's plan-time sample is stale (16:09–16:15 missing before the 16:15:15 plan); the close is fresh
    await morning(t, allBars({ KO: holed(PRICES.KO, '16:09', '16:15') }), MORNING + DAY);
    const tape = tapeOf(t, fx.battleId);
    const price = koPlan(tape).price;
    expect(price.atPlan).toEqual(koPlan(m1).price.atPlan);                   // the saved point: never replaced by null
    expect(price.atClose).toMatchObject({ value: PRICES.KO, basis: 'last_completed_minute' });   // the new point fills the saved null
    expect(price.missingInputs).toEqual([]);
    expect(price.builtFrom).toBe(priceBuiltFrom(koPlan(tape)));
    expect(price.preservedFrom).toBe(m1.passes.candles.writtenAt);           // it keeps a fact morning 1 saved
    expect(tape.coverage.series.status).toBe('complete');
    expect(tape.passes.candles.status).toBe('written');
  });

  it('R1-1: a replay point goes the same way — the sold name\'s close from morning 1, the bought name\'s from morning 2; the merged replay is the one whole bars build, marked preservedFrom', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ TSLA: holed(PRICES.TSLA, '19:54', '20:00') }));        // the bought name's close is stale
    const m1 = structuredClone(tapeOf(t, fx.battleId));
    expect(amdTsla(m1).replay).toMatchObject({ gapPoints: null, missingInputs: ['price:TSLA@close'] });
    expect(amdTsla(m1).replay.ghost.atClose).toEqual(expect.any(Number));
    await morning(t, allBars({ AMD: holed(PRICES.AMD, '19:54', '20:00') }), MORNING + DAY);   // now the sold name's close is stale
    const tape = tapeOf(t, fx.battleId);
    const replay = amdTsla(tape).replay;
    expect(replay.ghost.atClose).toBe(amdTsla(m1).replay.ghost.atClose);      // never replaced by null
    expect(factsOf(replay)).toEqual(builtFromWholeBars(tape).replay);          // each leg from the attempt that had it whole
    expect(replay.gapPoints).toEqual(expect.any(Number));
    expect(replay.preservedFrom).toBe(m1.passes.candles.writtenAt);
    expect(tape.coverage.replay.status).toBe('complete');
    expect(tape.passes.candles.status).toBe('written');
  });

  it('BA-36: a saved point is never replaced by null EVEN when the new attempt is the more complete unit — and a point built after a sample its attempt lacked keeps that sample named, so the merge never reads complete on a path no attempt built', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    // The sold name spikes to 160 over 11:20–11:30 ET — the tickSeq-8 check (11:30:20 ET) samples it, and the
    // scorer's history ratchets a bagger that every later point keeps. Without that sample, no later point has it.
    const spike = flatRows(D, PRICES.AMD).map((r) => { const t0 = r.timestamp * 1000; return t0 >= Date.parse(`${D}T15:20:00.000Z`) && t0 < Date.parse(`${D}T15:31:00.000Z`) ? { ...r, open: 160, high: 160.01, low: 159.99, close: 160 } : r; });
    const withoutMinutes = (rows, fromUtc, toUtc) => rows.filter((r) => r.timestamp * 1000 < Date.parse(`${D}T${fromUtc}:00.000Z`) || r.timestamp * 1000 >= Date.parse(`${D}T${toUtc}:00.000Z`));
    // morning 1: the bought name (TSLA) stale at the 11:15:20 and 11:45:20 ET checks (tickSeq 7 and 9) — two missing samples
    await morning(t, allBars({ AMD: spike, TSLA: withoutMinutes(holed(PRICES.TSLA, '15:09', '15:15'), '15:39', '15:45') }));
    const m1 = structuredClone(tapeOf(t, fx.battleId));
    expect(amdTsla(m1).replay.missingInputs).toEqual(['price:TSLA@7', 'price:TSLA@9']);
    const m1At8 = amdTsla(m1).replay.holdPath.find((p) => p.tickSeq === 8).points;
    expect(m1At8).toEqual(expect.any(Number));
    // morning 2: the sold name stale at tickSeq 8 (its 11:24–11:30 ET minutes missing) — one missing sample: the more complete unit
    await morning(t, allBars({ AMD: withoutMinutes(spike, '15:24', '15:30') }), MORNING + DAY);
    let tape = tapeOf(t, fx.battleId);
    let replay = amdTsla(tape).replay;
    expect(replay.holdPath.find((p) => p.tickSeq === 8).points).toBe(m1At8);  // the saved point stands
    expect(replay.ghost.series.find((p) => p.tickSeq === 8).points).toBe(m1At8);
    for (const seq of [7, 9]) expect(replay.bought.series.find((p) => p.tickSeq === seq).points, `bought @${seq}`).toEqual(expect.any(Number));   // filled from morning 2
    // the sold name's later points come from morning 2, built without the spike's sample: that sample stays named
    expect(replay.ghost.atClose).not.toBe(amdTsla(m1).replay.ghost.atClose);
    expect(replay.missingInputs).toEqual(['price:AMD@8']);
    expect(replay.retryableInputs).toEqual(['price:AMD@8']);
    expect(replay.preservedFrom).toBe(m1.passes.candles.writtenAt);
    expect(tape.coverage.replay.status).toBe('partial');
    expect(tape.passes.candles.status).toBe('partial');
    // morning 3, whole bars: a true superset — it replaces the merged replay cleanly, preservedFrom gone
    await morning(t, allBars({ AMD: spike }), MORNING + 4 * DAY);
    tape = tapeOf(t, fx.battleId);
    replay = amdTsla(tape).replay;
    expect(replay).toEqual(builtFromWholeBars(tape, allBars({ AMD: spike })).replay);
    expect(replay.preservedFrom).toBeUndefined();
    expect(tape.passes.candles.status).toBe('written');
  });

  it('BA-36: holes in different symbols on two mornings — the bought name at one check on morning 1, SPY\'s close on morning 2 — merge into the replay whole bars build; a tied point the other morning scored to the same value on a whole path names nothing', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ TSLA: holed(PRICES.TSLA, '15:09', '15:15') }));          // TSLA stale at tickSeq 7
    const m1 = structuredClone(tapeOf(t, fx.battleId));
    expect(amdTsla(m1).replay.missingInputs).toEqual(['price:TSLA@7']);
    await morning(t, allBars({ SPY: holed(PRICES.SPY, '19:54', '20:00') }), MORNING + DAY);   // SPY's close stale
    const tape = tapeOf(t, fx.battleId);
    const replay = amdTsla(tape).replay;
    expect(replay.marketChangeAfter.SPY).toBe(amdTsla(m1).replay.marketChangeAfter.SPY);   // the saved change: never replaced by null
    expect(replay.marketChangeAfter.SPY).toEqual(expect.any(Number));
    expect(factsOf(replay)).toEqual(builtFromWholeBars(tape).replay);
    expect(replay.preservedFrom).toBe(m1.passes.candles.writtenAt);
    expect(tape.coverage.replay).toMatchObject({ status: 'complete', preservedFrom: m1.passes.candles.writtenAt });
    expect(tape.passes.candles.status).toBe('written');
  });

  it('BA-36: where both attempts hold a value, a tie keeps the stored unit\'s — KO priced 70.5 on morning 1 and 71 on morning 2, each with a stale close: the plan keeps 70.5', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    const staleClose = (price) => flatRows(D, price).filter((r) => r.timestamp * 1000 < Date.parse(`${D}T19:54:00.000Z`));
    await morning(t, allBars({ KO: staleClose(70.5) }));
    const m1 = structuredClone(tapeOf(t, fx.battleId));
    await morning(t, allBars({ KO: staleClose(71) }), MORNING + DAY);
    const price = koPlan(tapeOf(t, fx.battleId)).price;
    expect(price.atPlan).toEqual(koPlan(m1).price.atPlan);
    expect(price.atPlan.value).toBe(70.5);
    expect(price.atClose).toMatchObject({ value: null, basis: 'stale_bar' });
    expect(price.missingInputs).toEqual(['price:KO@close']);
    expect(price.preservedFrom).toBe(m1.passes.candles.writtenAt);
  });

  it('BA-36 / BA-31: built from other inputs, the unit current with the tape\'s inputs wins WHOLE — a replay rebuilt after the entry\'s correction (150 → 300) replaces the stale one even with its bought leg missing', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const before = structuredClone(amdTsla(tapeOf(t, fx.battleId)).replay);
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.trades.find((tr) => tr.symbolOut === 'AMD').entryPrice = 300;
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await write(t, fx, MORNING + 3_600_000);
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'pending', changedInputs: ['actions'] });
    await morning(t, allBars({ TSLA: new Error('EODHD 500') }), MORNING + DAY);         // the rebuild cannot reach the bought name
    const tape = tapeOf(t, fx.battleId);
    const replay = amdTsla(tape).replay;
    expect(replay.builtFrom).toBe(replayBuiltFrom(tape, amdTsla(tape), sessionFor(D)));   // current, never the stale unit
    expect(replay.ghost.atSwap).not.toBe(before.ghost.atSwap);                // scored from 300
    expect(replay.bought).toBeNull();
    expect(replay.missingInputs).toContain('bars:TSLA');
    expect(replay.preservedFrom).toBeUndefined();                            // nothing of the stale unit is kept
    expect(tape.coverage.replay.note).not.toMatch(/built before its inputs changed, kept/);
  });

  it('BA-36 / BA-31: the same for a plan price — re-keyed to another symbol, the price for the new symbol replaces the stale one whole even with its close stale', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    // the entry's candidates re-read in the other order: plan :0 is now KO, plan :1 NFLX
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    const e11 = battle.evaluations.find((e) => e.evalId === 'b-captured:e11');
    e11.candidates = [e11.candidates[1], e11.candidates[0]];
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await write(t, fx, MORNING + 3_600_000);
    await morning(t, allBars({ KO: holed(PRICES.KO, '19:54', '20:00') }), MORNING + DAY);
    const plan0 = tapeOf(t, fx.battleId).plans.find((p) => p.key === 'b-captured:e11:0');
    expect(plan0.symbol).toBe('KO');
    expect(plan0.price.builtFrom).toBe(priceBuiltFrom(plan0));
    expect(plan0.price).toMatchObject({ atPlan: { value: PRICES.KO }, atClose: { value: null, basis: 'stale_bar' }, missingInputs: ['price:KO@close'] });
    expect(plan0.price.preservedFrom).toBeUndefined();
  });

  it('GUARD (BA-31): a stale unit is kept only when no current unit holds a fact — every refetch failing keeps the replay built from 150, labelled', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const before = structuredClone(amdTsla(tapeOf(t, fx.battleId)).replay);
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.trades.find((tr) => tr.symbolOut === 'AMD').entryPrice = 300;
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await write(t, fx, MORNING + 3_600_000);
    await morning(t, Object.fromEntries(Object.keys(PRICES).map((s) => [s, new Error('EODHD 500')])), MORNING + DAY);
    const tape = tapeOf(t, fx.battleId);
    expect(factsOf(amdTsla(tape).replay)).toEqual(before);
    expect(tape.coverage.replay.note).toMatch(/replay built before its inputs changed, kept \(not rebuilt this attempt\): AMD → TSLA/);
    expect(tape.passes.candles.status).not.toBe('written');
  });
});
