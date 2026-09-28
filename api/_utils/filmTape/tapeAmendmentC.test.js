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
import { runBackfill } from './closePass.js';
import { replayAction } from './tapeReplay.js';
import { replayBuiltFrom, priceBuiltFrom } from './candleInputs.js';
import { sessionBars } from './bars.js';
import { sessionFor } from './tapeTime.js';
import { formatTapeMarkdown } from './tapeExport.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay, noTriggerDay, earlyCloseDay, multiDay, makeTick } from './__fixtures__/tapeFixtures.js';
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
const seriesOf = (t, id, d = D) => [...t.store.entries()].filter(([k]) => k.startsWith(`${tapePath(id, d)}/series/`)).map(([, v]) => v);
const under = (t, prefix) => t.writeLog.filter((w) => w.path === prefix || w.path.startsWith(`${prefix}/`));
const morning = (t, bars = allBars(), at = MORNING) => runCandlePass({ db: t.db, fetchCandles: fetcherOf(bars).fetchCandles, clock: () => at, startMs: at });
const amdTsla = (tape) => tape.actions.find((a) => a.symbolOut === 'AMD');
const koPlan = (tape) => tape.plans.find((p) => p.symbol === 'KO');
/** Rows with the minutes in [fromUtc, toUtc) removed. */
const withoutMinutes = (rows, fromUtc, toUtc) => rows.filter((r) => r.timestamp * 1000 < Date.parse(`${D}T${fromUtc}:00.000Z`) || r.timestamp * 1000 >= Date.parse(`${D}T${toUtc}:00.000Z`));
/** AMD flat at 144 but for a spike to 160 over 11:20–11:30 ET — sampled only by the tickSeq-8 check (11:30:20 ET). */
const amdSpike = () => flatRows(D, PRICES.AMD).map((r) => { const t0 = r.timestamp * 1000; return t0 >= Date.parse(`${D}T15:20:00.000Z`) && t0 < Date.parse(`${D}T15:31:00.000Z`) ? { ...r, open: 160, high: 160.01, low: 159.99, close: 160 } : r; });
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
    const spike = amdSpike();
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

// ── BA-37 — the writer assembles from the battle it re-reads (R2-3) ──────────

describe('BA-37 (R2-3) — writeTapeDay assembles from the battle document it re-reads inside its transaction', () => {
  /** capturedDay whose battle document records the AMD entry corrected to 300; `selected` is the battle as a pass selected it before the correction (150). */
  async function correctedDay({ hooks } = {}) {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    const selected = { id: fx.battleId, ...structuredClone(t.store.get(`agentBattles/${fx.battleId}`)) };
    const correct = () => {
      const battle = t.store.get(`agentBattles/${fx.battleId}`);
      battle.trades.find((tr) => tr.symbolOut === 'AMD').entryPrice = 300;
      t.store.set(`agentBattles/${fx.battleId}`, battle);
    };
    return { fx, t, selected, correct };
  }

  it('R2-3: the selection-time battle has entry 150, the re-read has 300 — the tape carries 300 and re-queues nothing, with no read added', async () => {
    const { fx, t, selected, correct } = await correctedDay();
    correct();
    await write(t, fx);
    await morning(t);
    const before = structuredClone(tapeOf(t, fx.battleId));
    expect(amdTsla(before).replayInputs.ghost.entryPrice).toBe(300);
    expect(before.passes.candles.status).toBe('written');
    const from = t.readLog.length;
    const r = await writeTapeDay(fx.battleId, D, { db: t.db, now: MORNING + 3_600_000, battle: selected });
    const staleReads = t.readLog.slice(from);
    const tape = tapeOf(t, fx.battleId);
    expect(amdTsla(tape).replayInputs.ghost.entryPrice).toBe(300);
    expect(tape.passes.candles).toEqual(before.passes.candles);                // nothing re-queued
    expect(r.status).toBe('unchanged');
    expect(tape).toEqual(before);
    // zero extra reads: exactly the reads of the same write handed the battle as it stands
    const at = t.readLog.length;
    await writeTapeDay(fx.battleId, D, { db: t.db, now: MORNING + 7_200_000, battle: { id: fx.battleId, ...structuredClone(t.store.get(`agentBattles/${fx.battleId}`)) } });
    expect(staleReads).toEqual(t.readLog.slice(at));
  });

  it('R2-3 through the real backfill: a correction lands while one refresh is mid-write and a second refresh tapes it — the first, holding the older battle, never rewinds 300 to 150, and the next morning rebuilds from 300', async () => {
    const hooks = {};
    const { fx, t, correct } = await correctedDay({ hooks });
    await write(t, fx);
    await morning(t);                                                       // the replay is built from 150
    const at = Date.parse('2026-09-28T15:00:00.000Z');                     // Monday 11:00 ET — inside the day's candle window
    let armed = true;
    let second = null;
    hooks.afterTxRead = async (path) => {
      if (!armed || path !== tapePath(fx.battleId)) return;
      armed = false;
      correct();
      second = await runBackfill({ db: t.db, clock: () => at, dates: [D], refresh: true });   // lands first, with 300
    };
    const first = await runBackfill({ db: t.db, clock: () => at, dates: [D], refresh: true });  // selected the battle at 150
    expect(second.refreshed).toEqual([expect.objectContaining({ battleId: fx.battleId, etDate: D })]);
    expect(first.unchanged).toEqual([{ battleId: fx.battleId, etDate: D }]);
    let tape = tapeOf(t, fx.battleId);
    expect(amdTsla(tape).replayInputs.ghost.entryPrice).toBe(300);
    expect(tape.passes.candles).toMatchObject({ status: 'pending', reason: 'inputs_changed', changedInputs: ['actions'] });
    await morning(t, allBars(), Date.parse('2026-09-29T11:00:30.000Z'));
    tape = tapeOf(t, fx.battleId);
    expect(amdTsla(tape).replay).toEqual(builtFromWholeBars(tape).replay);   // rebuilt from 300
    expect(tape.passes.candles.status).toBe('written');
  });

  it('BA-37: a re-read that gained an evaluation expecting a declarations record assembles its check, and never calls the record absent — the lookup was made before the evaluation existed; the section is unresolved until a read looks it up', async () => {
    const fx = await noTriggerDay();
    const t = world(fx);
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).coverage.calls.status).toBe('complete');
    const selected = { id: fx.battleId, ...structuredClone(t.store.get(`agentBattles/${fx.battleId}`)) };
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.evaluations.push({ ...structuredClone(battle.evaluations[0]), evalId: 'b-quiet:e-late', timestamp: '2026-09-24T17:07:00.000Z', promptBuiltAt: '2026-09-24T17:06:52.000Z', declarationsPhase: 'expected' });
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    // the record EXISTS: calling it absent would be a false, sticky caveat
    t.store.set(`agentBattles/${fx.battleId}/declarations/b-quiet:e-late`, { battleId: fx.battleId, evalId: 'b-quiet:e-late', calledShots: [], watching: [], playerAsk: null, fork: null, minted: [] });
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT + 60_000, battle: selected });
    let tape = tapeOf(t, fx.battleId);
    expect(tape.checks.some((c) => c.evalId === 'b-quiet:e-late')).toBe(true);        // assembled from the re-read
    let calls = tape.coverage.calls;
    expect(calls.caveats.some((c) => /absent/.test(c))).toBe(false);
    expect(calls.status).toBe('partial');
    expect(calls.caveats).toEqual(["unresolved_dependency: declaration records (not looked up for an evaluation newer than the read) on a read after this section's dependencies changed"]);
    // a read that looks it up finds it: resolved, complete
    await write(t, fx, NIGHT + 120_000);
    calls = tapeOf(t, fx.battleId).coverage.calls;
    expect(calls.caveats).toEqual([]);
    expect(calls.status).toBe('complete');
  });
});

// ── BA-25 amended — outside the window, changed inputs expire the pass (R3-3) ─

describe('BA-25 amended (R3-3) — outside the candle window, a written pass whose inputs changed is expired, never partial', () => {
  const OUTSIDE = Date.parse('2026-10-26T15:00:00.000Z');          // a month on: no candle pass comes back for 2026-09-24
  const NEXT_MORNING = Date.parse('2026-10-27T11:00:30.000Z');
  const TERMINAL = 'terminal: its inputs changed outside its retry window — the output built before the change stays; no candle pass will run for this day again';

  /** capturedDay written without tick 10 and enriched (written), then tick 10 restored to the source. */
  async function grownDay() {
    const fx = await capturedDay();
    const tick10 = fx.ticks.find((tk) => tk.tickSeq === 10);
    const t = makeTapeDb(seedDay({}, { ...fx, ticks: fx.ticks.filter((tk) => tk.tickSeq !== 10) }));
    await write(t, fx);
    await morning(t);
    expect(tapeOf(t, fx.battleId).passes.candles.status).toBe('written');
    t.store.set(`agentBattles/${fx.battleId}/ticks/${tick10.tickId}`, tick10);
    return { fx, t };
  }

  it('R3-3: a refresh outside the window re-merges the recovered check — the written pass is expired with reason inputs_changed_outside_window, its output kept and labelled; the next sweep never touches it, and the read-out says no pass will come', async () => {
    const { fx, t } = await grownDay();
    const before = structuredClone(tapeOf(t, fx.battleId));
    const r = await runBackfill({ db: t.db, clock: () => OUTSIDE, dates: [D], refresh: true });
    expect(r.refreshed).toEqual([expect.objectContaining({ battleId: fx.battleId, etDate: D })]);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.passes.candles).toMatchObject({ status: 'expired', reason: 'inputs_changed_outside_window', changedInputs: ['checks'] });
    expect(tape.actions.map((a) => a.replay)).toEqual(before.actions.map((a) => a.replay));   // the output stays
    expect(tape.plans.map((p) => p.price)).toEqual(before.plans.map((p) => p.price));
    for (const s of ['replay', 'series']) {
      expect(tape.coverage[s].status, s).toBe('partial');
      expect(tape.coverage[s].note, s).toMatch(/built before the candle inputs changed \(checks\) — outside its retry window, not rebuilt/);
    }
    // the next morning: the sweep never selects it, and nothing under it is written
    const writes = under(t, tapePath(fx.battleId)).length;
    const s = await morning(t, allBars(), NEXT_MORNING);
    expect(s.expired).not.toContain(tapePath(fx.battleId));
    expect(under(t, tapePath(fx.battleId))).toHaveLength(writes);
    expect(tapeOf(t, fx.battleId).passes.candles).toEqual(tape.passes.candles);
    // the read-out prints the terminal words beside the pass
    const md = formatTapeMarkdown(tapeOf(t, fx.battleId), seriesOf(t, fx.battleId));
    expect(md).toContain(`\`inputs_changed_outside_window\``);
    expect(md).toContain(TERMINAL);
  });

  it('BA-25 amended: through the nightly close pass as well — an action recorded after the candle pass, merged a month on, expires the written pass with the same reason, and names what changed (the actions, and the symbol it brings)', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.trades.push({ ...battle.trades[1], symbolOut: 'PEP', symbolIn: 'COST', slotIndex: 0, tier: 'support', entryPrice: 170, exitPrice: 171, lockedPoints: 0.6, lockedGainPct: 0.588, swappedOutAt: '2026-09-24T18:00:10.000Z' });
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await write(t, fx, Date.parse('2026-10-26T02:15:30.000Z'));
    const tape = tapeOf(t, fx.battleId);
    expect(tape.passes.candles).toMatchObject({ status: 'expired', reason: 'inputs_changed_outside_window', changedInputs: ['actions', 'symbols'] });
    expect(tape.coverage.replay.note).toMatch(/built before the candle inputs changed \(actions, symbols\) — outside its retry window, not rebuilt/);
  });

  it('GUARD: the ruling is for a WRITTEN pass — a partial pass whose inputs change outside the window keeps its status, the change recorded, and the next sweep closes it out (retry_window_elapsed) — round-3 review L3-5', async () => {
    const fx = await capturedDay();
    const tick10 = fx.ticks.find((tk) => tk.tickSeq === 10);
    const t = makeTapeDb(seedDay({}, { ...fx, ticks: fx.ticks.filter((tk) => tk.tickSeq !== 10) }));
    await write(t, fx);
    await morning(t, allBars({ XLP: new Error('EODHD 500') }));
    const before = structuredClone(tapeOf(t, fx.battleId).passes.candles);
    expect(before.status).toBe('partial');
    t.store.set(`agentBattles/${fx.battleId}/ticks/${tick10.tickId}`, tick10);
    await runBackfill({ db: t.db, clock: () => OUTSIDE, dates: [D], refresh: true });
    const after = tapeOf(t, fx.battleId).passes.candles;
    expect(after).toMatchObject({ status: 'partial', changedInputs: ['checks'] });
    expect(after.reason).not.toBe('inputs_changed_outside_window');
    const s = await morning(t, allBars(), NEXT_MORNING);
    expect(s.expired).toContain(tapePath(fx.battleId));
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'expired', reason: 'retry_window_elapsed' });
  });

  it('GUARD: inside the window a written pass whose inputs changed is re-queued (pending, inputs_changed), never expired', async () => {
    const { fx, t } = await grownDay();
    await runBackfill({ db: t.db, clock: () => Date.parse('2026-09-28T15:00:00.000Z'), dates: [D], refresh: true });
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'pending', reason: 'inputs_changed', changedInputs: ['checks'] });
  });
});

// ── BA-24 confirmed — minutes shown as a fact, never a verdict (R1-3) ─────────

describe('BA-24 confirmed (R1-3) — the read-out prints, per series, "N of M session minutes traded" beside the coverage line', () => {
  /** The Series section's lines, from its heading to its table. */
  const seriesSection = (md) => { const lines = md.split('\n'); const at = lines.indexOf('## Series'); return lines.slice(at, lines.indexOf('', at + 1)); };

  it('R1-3: a series missing three minutes no check reads is whole by its buckets — coverage complete — and the read-out says 387 of 390 session minutes traded, class market; a whole series says 390 of 390', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ AAPL: holed(PRICES.AAPL, '13:40', '13:43') }));      // 09:40–09:42 ET: no check falls after them within five minutes
    const tape = tapeOf(t, fx.battleId);
    const series = seriesOf(t, fx.battleId);
    const aapl = series.find((s) => s.symbol === 'AAPL');
    expect(aapl.bars).toHaveLength(39);
    expect(aapl.bars.reduce((n, b) => n + b.m, 0)).toBe(387);
    expect(tape.coverage.series.status).toBe('complete');                      // minutes are no completeness criterion
    expect(tape.passes.candles.status).toBe('written');
    const section = seriesSection(formatTapeMarkdown(tape, series));
    expect(section[1]).toMatch(/^> coverage: \*\*complete\*\*/);                // still headed by its coverage line
    expect(section).toContain('- AAPL: 387 (market) of 390 (market) session minutes traded');
    expect(section).toContain('- SPY: 390 (market) of 390 (market) session minutes traded');
    expect(section.filter((l) => l.endsWith('session minutes traded'))).toHaveLength(series.length);   // one line per series
  });

  it('R1-3 (round-3 review L3-6): a series whose bars do not all carry a finite `m` prints its minutes as unknown — never a 0 stated as a market fact', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const tape = tapeOf(t, fx.battleId);
    const series = seriesOf(t, fx.battleId).map((x) => structuredClone(x));
    const spy = series.find((x) => x.symbol === 'SPY');
    const aapl = series.find((x) => x.symbol === 'AAPL');
    spy.bars = spy.bars.map((b) => { const { m: _m, ...rest } = b; return rest; });   // no bar carries m
    aapl.bars[3] = { ...aapl.bars[3], m: '10' };                                 // one bar's m is not a number
    const section = seriesSection(formatTapeMarkdown(tape, series));
    expect(section).toContain('- SPY: — of 390 (market) session minutes traded');
    expect(section).toContain('- AAPL: — of 390 (market) session minutes traded');
    expect(section).toContain('- KO: 390 (market) of 390 (market) session minutes traded');
  });

  it('R1-3: the session minutes are the calendar\'s — an early close counts 210, never a constant 390', async () => {
    const fx = await earlyCloseDay();
    const t = world(fx);
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: Date.parse('2026-11-28T02:15:30.000Z') });
    const bars = {};
    for (const [sym, p] of Object.entries(PRICES)) bars[sym] = flatRows(fx.etDate, p, { openUtc: '14:30' });
    const at = Date.parse('2026-11-28T11:00:30.000Z');
    await runCandlePass({ db: t.db, fetchCandles: fetcherOf(bars).fetchCandles, clock: () => at, startMs: at });
    const series = seriesOf(t, fx.battleId, fx.etDate);
    const section = seriesSection(formatTapeMarkdown(tapeOf(t, fx.battleId, fx.etDate), series));
    for (const s of series) expect(section, s.symbol).toContain(`- ${s.symbol}: 210 (market) of 210 (market) session minutes traded`);
  });
});

// ── The §2 review of round 3 (build report §10.10) ──────────────────────────

describe('BA-36 (round-3 review L1-1) — a replay that is itself a merge keeps naming the samples its kept points were scored without', () => {
  /**
   * The spike day of the null-guard row: morning 1 (TSLA stale at tickSeq 7 and 9), morning 2 (AMD stale at 8,
   * the more complete unit). Their merge keeps morning 2's AMD points after 8 — scored without the spike's
   * sample — and names it: price:AMD@8. Every AMD point of that merge is non-null.
   */
  async function mergedSpikeDay() {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ AMD: amdSpike(), TSLA: withoutMinutes(holed(PRICES.TSLA, '15:09', '15:15'), '15:39', '15:45') }));
    await morning(t, allBars({ AMD: withoutMinutes(amdSpike(), '15:24', '15:30') }), MORNING + DAY);
    const merged = amdTsla(tapeOf(t, fx.battleId)).replay;
    expect(merged.missingInputs).toEqual(['price:AMD@8']);
    expect(merged.holdPath.every((p) => typeof p.points === 'number')).toBe(true);   // a list that LOOKS whole
    return { fx, t, merged };
  }

  it('L1-1: a third morning with morning 2\'s response again merges into the merge — price:AMD@8 stays named, the replay never reads complete, and the pass is never written', async () => {
    const { fx, t, merged } = await mergedSpikeDay();
    await morning(t, allBars({ AMD: withoutMinutes(amdSpike(), '15:24', '15:30') }), MORNING + 4 * DAY);
    const tape = tapeOf(t, fx.battleId);
    const replay = amdTsla(tape).replay;
    expect(replay.missingInputs).toContain('price:AMD@8');
    expect(replay.ghost.atClose).toBe(merged.ghost.atClose);                  // the same path, still named
    expect(tape.coverage.replay.status).toBe('partial');
    expect(tape.passes.candles.status).not.toBe('written');
  });

  it('L1-1: a third morning with morning 1\'s response again — AMD whole, the spike sampled — never reads complete on the merge\'s path: price:AMD@8 stays named, never written', async () => {
    const { fx, t } = await mergedSpikeDay();
    await morning(t, allBars({ AMD: amdSpike(), TSLA: withoutMinutes(holed(PRICES.TSLA, '15:09', '15:15'), '15:39', '15:45') }), MORNING + 4 * DAY);
    const tape = tapeOf(t, fx.battleId);
    expect(amdTsla(tape).replay.missingInputs).toContain('price:AMD@8');
    expect(tape.coverage.replay.status).toBe('partial');
    expect(tape.passes.candles.status).not.toBe('written');
  });

  it('L1-1: a third morning that fetches nothing keeps the merge whole — and its names with it: never complete, never written', async () => {
    const { fx, t, merged } = await mergedSpikeDay();
    await morning(t, Object.fromEntries(Object.keys(PRICES).map((s) => [s, new Error('EODHD 500')])), MORNING + 4 * DAY);
    const tape = tapeOf(t, fx.battleId);
    const replay = amdTsla(tape).replay;
    expect(replay.missingInputs).toContain('price:AMD@8');
    expect(factsOf(replay)).toEqual(factsOf(merged));
    expect(tape.coverage.replay.status).toBe('partial');
    expect(tape.passes.candles.status).not.toBe('written');
  });
});

describe('BA-20 / BA-37 (round-3 review L2-1) — a swap whose trade record may have been evicted never reads complete', () => {
  /** capturedDay with its tickSeq-13 record captured too, so capture is `present`. */
  async function presentCaptureDay() {
    const fx = await capturedDay();
    const held = ['AAPL', 'NFLX', 'NVDA', 'TSLA', 'KO', 'PEP'];
    const t13 = await makeTick({
      battleId: fx.battleId, tickSeq: 13, capturedAtMs: Date.parse('2026-09-24T16:45:20.000Z'), exitReason: 'no_trigger',
      stages: ['quotes_checked', 'scores_marked', 'risk_evaluated', 'proposal_handled', 'gameplan_handled', 'trigger_evaluated'],
      scores: { active: 18, banked: 5, total: 23, opponent: 10, bankedBadgePoints: 0 },
      verdicts: Object.fromEntries(held.map((s) => [s, { action: 'HOLD', reason: null }])), guardrail: { evaluated: false, deployedCount: 0 }, symbols: held,
    });
    return { ...fx, ticks: [...fx.ticks, t13].sort((a, b) => a.tickSeq - b.tickSeq) };
  }
  /** `n` later swaps, a day on — trades[] keeps the last 50, so these push the day's out. */
  const laterTrades = (base, n) => Array.from({ length: n }, (_, i) => ({
    ...base, symbolOut: `LX${i}`, symbolIn: `LY${i}`, slotIndex: 0, tier: 'support', swappedOutAt: new Date(Date.parse('2026-09-25T14:00:00.000Z') + i * 60_000).toISOString(),
  }));
  const CAP_NOTE = /trades\[\] is at its 50-entry cap and its oldest surviving entry is not before this day — 1 swap\(s\) have no trade record here \(evicted\)/;

  it('L2-1: capture present, trades[] at its 50-entry cap with its oldest entry on the day, and the AMD trade evicted — the action stands, unmatched, and actions coverage is partial with the cap named, never complete', async () => {
    const fx = await presentCaptureDay();
    const [amd, msft] = fx.battle.trades;
    const t = world({ ...fx, battle: { ...structuredClone(fx.battle), trades: [msft, ...laterTrades(amd, 49)] } });
    await write(t, fx);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.passes.close.capture).toBe('present');
    expect(amdTsla(tape)).toMatchObject({ tradeMatched: false, exitPrice: null, lockedGainPct: null });
    expect(tape.coverage.actions.status).toBe('partial');
    expect(tape.coverage.actions.note).toMatch(CAP_NOTE);
  });

  it('L2-1 through BA-37: the trade leaves trades[] between the selection and the transaction — the tape, assembled from the re-read, says the join is unknown instead of complete', async () => {
    const fx = await presentCaptureDay();
    const [amd, msft] = fx.battle.trades;
    const selected = { ...structuredClone(fx.battle), id: fx.battleId, trades: [amd, msft, ...laterTrades(amd, 48)] };   // AMD still there
    const t = world({ ...fx, battle: { ...structuredClone(fx.battle), trades: [msft, ...laterTrades(amd, 49)] } });   // the document: evicted
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT, battle: selected });
    const tape = tapeOf(t, fx.battleId);
    expect(amdTsla(tape).tradeMatched).toBe(false);
    expect(tape.coverage.actions.status).toBe('partial');
    expect(tape.coverage.actions.note).toMatch(CAP_NOTE);
  });

  it('L2-1 (refuter): a swap newer than trades[]\'s oldest surviving entry was never evicted — its missing trade record is no limit of the read: the row stands unmatched, and actions coverage names no cap', async () => {
    const fx = await presentCaptureDay();
    const [amd] = fx.battle.trades;                                            // the MSFT trade is absent, never evicted: AMD, older, survives
    const t = world({ ...fx, battle: { ...structuredClone(fx.battle), trades: [amd, ...laterTrades(amd, 49)] } });
    await write(t, fx);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.actions.find((a) => a.symbolOut === 'MSFT').tradeMatched).toBe(false);
    expect(amdTsla(tape).tradeMatched).toBe(true);
    expect(tape.coverage.actions.status).toBe('complete');
    expect(tape.coverage.actions.note).toBeNull();
  });

  it('GUARD: trades[] at its cap with its oldest entry on the day, but every swap of the day matched its trade — nothing of the day was evicted, and actions coverage stays complete', async () => {
    const fx = await presentCaptureDay();
    const [amd, msft] = fx.battle.trades;
    const t = world({ ...fx, battle: { ...structuredClone(fx.battle), trades: [amd, msft, ...laterTrades(amd, 48)] } });
    await write(t, fx);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.actions.every((a) => a.tradeMatched)).toBe(true);
    expect(tape.coverage.actions.status).toBe('complete');
  });
});

describe('BA-37 (round-3 review L2-3) — the gap horizon is the minted count of the battle copy the tick read was made for', () => {
  const D1 = '2026-09-21';
  const DAY1_NIGHT = Date.parse('2026-09-22T02:15:30.000Z');
  const DAY2_OPEN = Date.parse('2026-09-22T13:30:10.000Z');     // 09:30:10 ET day 2: its first check minted, not yet captured
  /** multiDay at day 1's close (tickSeq 40), day 1 taped on its own night unless `taped` is false; `mintInTx()` mints check 41 just before the transaction re-reads the battle. */
  async function dayOneTaped({ drop = [], taped = true } = {}) {
    const fx = await multiDay({ full: true });
    const hooks = {};
    const atClose = { ...structuredClone(fx.battle), evaluations: fx.all.slice(0, 40), cronState: { tickSeq: 40 } };
    const t = makeTapeDb(seedDay({}, { ...fx, battle: atClose, ticks: fx.ticks.filter((tk) => tk.tickSeq <= 40 && !drop.includes(tk.tickSeq)) }), { hooks });
    if (taped) await writeTapeDay(fx.battleId, D1, { db: t.db, now: DAY1_NIGHT });
    const bp = `agentBattles/${fx.battleId}`;
    const mintInTx = () => {
      let armed = true;
      hooks.afterTxRead = async (path) => {
        if (!armed || path !== tapePath(fx.battleId, D1)) return;   // the tick read is done; the battle re-read comes next
        armed = false;
        t.store.set(bp, { ...structuredClone(t.store.get(bp)), cronState: { tickSeq: 41 } });
      };
    };
    const capture41 = () => { const t41 = fx.ticks.find((tk) => tk.tickSeq === 41); t.store.set(`${bp}/ticks/${t41.tickId}`, t41); };
    return { fx, t, mintInTx, capture41 };
  }

  it('L2-3: a check minted between the tick read and the transaction is no gap of the read — day 1\'s refresh at day 2\'s open tapes no unattributed gap, and once the check is captured no caveat outlives it', async () => {
    const { fx, t, mintInTx, capture41 } = await dayOneTaped();
    const before = structuredClone(tapeOf(t, fx.battleId, D1));
    expect(before.coverage.checks.status).toBe('complete');
    mintInTx();
    await writeTapeDay(fx.battleId, D1, { db: t.db, now: DAY2_OPEN });
    let tape = tapeOf(t, fx.battleId, D1);
    expect(t.store.get(`agentBattles/${fx.battleId}`).cronState.tickSeq).toBe(41);   // the re-read saw the mint
    expect(tape.passes.close.unattributedGaps).toEqual([]);
    expect(tape.passes.close.capture).toBe('present');
    expect(tape.coverage.checks).toEqual(before.coverage.checks);
    capture41();
    await writeTapeDay(fx.battleId, D1, { db: t.db, now: Date.parse('2026-09-22T15:00:00.000Z') });
    tape = tapeOf(t, fx.battleId, D1);
    expect(tape.coverage.checks.caveats).toEqual([]);
    expect(Object.values(tape.coverage).filter((c) => (c.caveats || []).some((x) => /tickSeq 41/.test(x)))).toEqual([]);
  });

  it('L2-3: the horizon still counts what the selection copy minted — a first write whose tick read lacks check 40 names 40 as the day\'s gap, and never 41, minted after the read', async () => {
    const { fx, t, mintInTx } = await dayOneTaped({ drop: [40], taped: false });
    mintInTx();
    await writeTapeDay(fx.battleId, D1, { db: t.db, now: DAY1_NIGHT });
    const tape = tapeOf(t, fx.battleId, D1);
    expect(t.store.get(`agentBattles/${fx.battleId}`).cronState.tickSeq).toBe(41);
    expect(tape.passes.close.gaps).toEqual([40]);
    expect(tape.passes.close.unattributedGaps).toEqual([]);
    expect(tape.checks.filter((c) => c.rowSource === 'gap').map((c) => c.tickSeq)).toEqual([40]);
    expect(tape.coverage.checks.caveats).toEqual([
      '1 minted check(s) of this day have no record (tickSeq 40)',
      '1 evaluation entr(y/ies) have no tick record; their sequence numbers are among the gaps',   // e40 survives on the battle
    ]);
  });
});

describe('BA-37 (round-3 review L2-6) — a transaction whose re-read finds no battle document assembles nothing', () => {
  /** capturedDay taped (close and candles) with the AMD entry corrected to 300; `selected` is the copy from before the correction (150). */
  async function correctedAndTaped({ hooks } = {}) {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    const bp = `agentBattles/${fx.battleId}`;
    const selected = { id: fx.battleId, ...structuredClone(t.store.get(bp)) };
    const b = structuredClone(t.store.get(bp));
    b.trades.find((tr) => tr.symbolOut === 'AMD').entryPrice = 300;
    t.store.set(bp, b);
    await write(t, fx);
    await morning(t);
    return { fx, t, bp, selected };
  }

  it('L2-6: the battle document is gone at the re-read — the write handed the stale selection copy (entry 150) fails battle_not_found, and the stored tape keeps 300, unchanged', async () => {
    const { fx, t, bp, selected } = await correctedAndTaped();
    const before = structuredClone(tapeOf(t, fx.battleId));
    expect(amdTsla(before).replayInputs.ghost.entryPrice).toBe(300);
    t.store.delete(bp);
    await expect(writeTapeDay(fx.battleId, D, { db: t.db, now: MORNING + 3_600_000, battle: selected })).rejects.toThrow('battle_not_found');
    expect(tapeOf(t, fx.battleId)).toEqual(before);
  });

  it('L2-6 through the real backfill: the battle document is deleted between the selection and the transaction — the day fails battle_not_found, recorded beside the written tape, which keeps 300 and its status', async () => {
    const hooks = {};
    const { fx, t, bp } = await correctedAndTaped({ hooks });
    const before = structuredClone(tapeOf(t, fx.battleId));
    const at = Date.parse('2026-09-28T15:00:00.000Z');
    let armed = true;
    hooks.afterTxRead = async (path) => { if (armed && path === tapePath(fx.battleId)) { armed = false; t.store.delete(bp); } };
    const s = await runBackfill({ db: t.db, clock: () => at, dates: [D], refresh: true });
    expect(s.failed).toEqual([{ battleId: fx.battleId, etDate: D, reason: 'battle_not_found' }]);
    const tape = tapeOf(t, fx.battleId);
    expect(amdTsla(tape).replayInputs.ghost.entryPrice).toBe(300);
    expect(tape.passes.close.status).toBe('written');
    expect(tape.passes.close.lastError).toEqual({ at: new Date(at).toISOString(), reason: 'battle_not_found' });
    expect({ ...tape, passes: { ...tape.passes, close: { ...tape.passes.close, lastError: before.passes.close.lastError } } }).toEqual(before);
  });
});

describe('BA-36 / BA-24 (round-3 review L1-4) — a saved null that carries its stale bar\'s age is never replaced by a bare null', () => {
  it('L1-4: KO\'s close stale on morning 1 (its last bar closed 15:54 ET), KO unreachable on morning 2 — the close stays null with 15:54 ET beside it, and the plan keeps its plan-time price', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ KO: holed(PRICES.KO, '19:54', '20:00') }));
    const m1 = structuredClone(tapeOf(t, fx.battleId));
    const staleClose = koPlan(m1).price.atClose;
    expect(staleClose).toEqual({ value: null, at: '2026-09-24T19:54:00.000Z', basis: 'stale_bar' });
    await morning(t, allBars({ KO: new Error('EODHD 500') }), MORNING + DAY);
    const price = koPlan(tapeOf(t, fx.battleId)).price;
    expect(price.atClose).toEqual(staleClose);
    expect(price.atPlan).toEqual(koPlan(m1).price.atPlan);
    expect(price.missingInputs).toEqual(['price:KO@close']);
    expect(price.preservedFrom).toBe(m1.passes.candles.writtenAt);
  });

  it('L1-4: the same for a replay point — the sold name stale at the swap on morning 1 (its 10:20–10:30 ET minutes missing), no AMD bar before the swap at all on morning 2: the swap point stays null with 10:20 ET beside it', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ AMD: holed(PRICES.AMD, '14:20', '14:30') }));
    const m1 = structuredClone(tapeOf(t, fx.battleId));
    const swap1 = amdTsla(m1).replay.holdPath[0];
    expect(swap1).toMatchObject({ points: null, barClosedAt: '2026-09-24T14:20:00.000Z' });
    await morning(t, allBars({ AMD: withoutMinutes(flatRows(D, PRICES.AMD), '13:30', '14:31') }), MORNING + DAY);
    const replay = amdTsla(tapeOf(t, fx.battleId)).replay;
    expect(replay.holdPath[0]).toEqual(swap1);
    expect(replay.holdPath.slice(1)).toEqual(amdTsla(m1).replay.holdPath.slice(1));
    expect(replay.missingInputs).toEqual(['price:AMD@swap']);
    expect(replay.preservedFrom).toBe(m1.passes.candles.writtenAt);
  });

  it('L1-4: where both attempts\' nulls carry an age, the more complete unit\'s stands and a tie keeps the stored — KO\'s close stale at 15:54 ET on morning 1 and 15:52 ET on morning 2: 15:54 stays', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ KO: holed(PRICES.KO, '19:54', '20:00') }));
    const m1 = structuredClone(tapeOf(t, fx.battleId));
    await morning(t, allBars({ KO: holed(PRICES.KO, '19:52', '20:00') }), MORNING + DAY);
    const price = koPlan(tapeOf(t, fx.battleId)).price;
    expect(price.atClose).toEqual(koPlan(m1).price.atClose);
    expect(price.atClose.at).toBe('2026-09-24T19:54:00.000Z');
  });
});

describe('BA-36 (round-3 review L1-5) — preservedFrom marks a kept earlier fact, never a kept name alone', () => {
  it('L1-5: SPY stale at the swap on morning 1 and at the close on morning 2 — the AMD merge holds exactly morning 2\'s numbers and both names: no preservedFrom; the MSFT replay, which keeps morning 1\'s SPY change, carries it', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ SPY: holed(PRICES.SPY, '14:20', '14:30') }));
    const m1 = structuredClone(tapeOf(t, fx.battleId));
    expect(amdTsla(m1).replay.missingInputs).toEqual(['price:SPY@swap']);
    const t2 = world(fx);                                                       // morning 2's response alone, for its numbers
    await write(t2, fx);
    await morning(t2, allBars({ SPY: holed(PRICES.SPY, '19:54', '20:00') }), MORNING + DAY);
    const alone = amdTsla(tapeOf(t2, fx.battleId)).replay;
    expect(alone.missingInputs).toEqual(['price:SPY@close']);
    await morning(t, allBars({ SPY: holed(PRICES.SPY, '19:54', '20:00') }), MORNING + DAY);
    const tape = tapeOf(t, fx.battleId);
    const replay = amdTsla(tape).replay;
    expect(replay.missingInputs).toEqual(['price:SPY@close', 'price:SPY@swap']);   // neither attempt priced SPY's change: both samples named
    expect({ ...replay, missingInputs: null, retryableInputs: null }).toEqual({ ...alone, missingInputs: null, retryableInputs: null });
    expect(replay.preservedFrom).toBeUndefined();
    // the other replay's swap (12:30 ET) was fresh on morning 1: its SPY change is a saved fact, kept
    const msft = (x) => x.actions.find((a) => a.symbolOut === 'MSFT').replay;
    expect(msft(tape).marketChangeAfter.SPY).toBe(msft(m1).marketChangeAfter.SPY);
    expect(msft(tape).marketChangeAfter.SPY).toEqual(expect.any(Number));
    expect(msft(tape).preservedFrom).toBe(m1.passes.candles.writtenAt);
    expect(tape.coverage.replay.preservedFrom).toBe(m1.passes.candles.writtenAt);
    expect(tape.coverage.replay.status).toBe('partial');
  });
});

describe('BA-36 — a replay\'s keyed changes, its reconciliation and its ties, point by point (rows for the round\'s mutation survivors)', () => {
  it('BA-36: a saved market change and a saved reconciliation are never replaced by null EVEN when the new attempt is the more complete unit — AMD stale at three checks on morning 1; SPY\'s close and TSLA at the evidence check stale on morning 2', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ AMD: withoutMinutes(withoutMinutes(holed(PRICES.AMD, '15:09', '15:15'), '15:24', '15:30'), '15:39', '15:45') }));
    const m1Tape = structuredClone(tapeOf(t, fx.battleId));
    const m1 = amdTsla(m1Tape).replay;
    expect(m1.missingInputs).toEqual(['price:AMD@7', 'price:AMD@8', 'price:AMD@9']);
    expect(m1.marketChangeAfter.SPY).toEqual(expect.any(Number));
    expect(m1.reconciliation.boughtVsEvidence).toMatchObject({ tickSeq: 6, rebuiltPx: PRICES.TSLA });
    const m2Bars = allBars({ SPY: holed(PRICES.SPY, '19:54', '20:00'), TSLA: holed(PRICES.TSLA, '14:39', '14:45') });
    const t2 = world(fx);                                                       // morning 2's response alone: the more complete unit
    await write(t2, fx);
    await morning(t2, m2Bars, MORNING + DAY);
    const alone = amdTsla(tapeOf(t2, fx.battleId)).replay;
    expect(alone.missingInputs).toEqual(['price:TSLA@6', 'price:SPY@close']);
    expect(alone.marketChangeAfter.SPY).toBeNull();
    expect(alone.reconciliation.boughtVsEvidence).toBeNull();
    await morning(t, m2Bars, MORNING + DAY);
    const tape = tapeOf(t, fx.battleId);
    const replay = amdTsla(tape).replay;
    expect(replay.marketChangeAfter.SPY).toBe(m1.marketChangeAfter.SPY);
    expect(replay.reconciliation.boughtVsEvidence).toEqual(m1.reconciliation.boughtVsEvidence);
    expect(factsOf(replay)).toEqual(builtFromWholeBars(tape).replay);
    expect(replay.preservedFrom).toBe(m1Tape.passes.candles.writtenAt);          // it keeps facts morning 1 saved
    expect(tape.coverage.replay.status).toBe('complete');
    expect(tape.passes.candles.status).toBe('written');
  });

  it('BA-36: where both replays hold a value, a tie keeps the stored unit\'s — TSLA priced 242 on morning 1 and 243 on morning 2, SPY\'s close stale on both: the replay keeps morning 1\'s points', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ SPY: holed(PRICES.SPY, '19:54', '20:00') }));
    const m1 = structuredClone(tapeOf(t, fx.battleId));
    const r1 = amdTsla(m1).replay;
    await morning(t, allBars({ SPY: holed(PRICES.SPY, '19:54', '20:00'), TSLA: flatRows(D, PRICES.TSLA + 1) }), MORNING + DAY);
    const replay = amdTsla(tapeOf(t, fx.battleId)).replay;
    expect(replay.missingInputs).toEqual(['price:SPY@close']);
    expect({ bought: replay.bought, swapPath: replay.swapPath, gapPoints: replay.gapPoints, reconciliation: replay.reconciliation })
      .toEqual({ bought: r1.bought, swapPath: r1.swapPath, gapPoints: r1.gapPoints, reconciliation: r1.reconciliation });
    expect(replay.gapPoints).toBe(70.5);                                      // 76.5 from morning 2's 243
    expect(replay.preservedFrom).toBe(m1.passes.candles.writtenAt);
  });
});
