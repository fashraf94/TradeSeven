// api/_utils/filmTape/tapeAmendmentD.test.js
//
// THE SMOKE-FIX ROWS — spec V1.2 Amendment D
// (docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_AMENDMENT_D_20261002.md),
// answering the first smoke's discovery
// (docs/audits/20261002_FILM_TAPE_FIRST_SMOKE_DISCOVERY.md, Q1 and Q2):
// BA-38 (the reconciliation names its two causes; the replay logic version)
// and BA-39 (no result from a missing score; the platform's own words). Each
// row failed at the commit before its ruling's fix; a row marked GUARD pins
// the other side of its ruling and passes at both.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL imports of the replay,
// the writer, the close pass, the candle pass and the read-out. Never mock
// them. The fenced scorer is WRAPPED in a spy that calls the real one, so a
// row can swap its implementation and watch every rebuilt number follow it —
// a local copy of its arithmetic could not. The flag module is mocked by
// spreading the real one.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));
vi.mock('../agentScoring.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, calculateAssetScoreServer: vi.fn(real.calculateAssetScoreServer) };
});

import { calculateAssetScoreServer } from '../agentScoring.js';
import { replayAction } from './tapeReplay.js';
import { replayBuiltFrom } from './candleInputs.js';
import { writeTapeDay } from './writeTapeDay.js';
import { runCandlePass } from './candlePass.js';
import { runBackfill } from './closePass.js';
import { sessionBars } from './bars.js';
import { sessionFor } from './tapeTime.js';
import { formatTapeMarkdown } from './tapeExport.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay, completedDay } from './__fixtures__/tapeFixtures.js';
import { buildBattleBlock } from './tapeAssemble.js';
import { mergeTape } from './tapeMerge.js';
import { resolveBattleResult } from './battleResult.js';
import { flatRows, fetcherOf } from './__fixtures__/tapeBars.js';
import { numbersWithClasses, formatNumberPath, PROVENANCE_CLASSES } from '../../../src/constants/filmTape.js';

// The integration rows run the close pass and the candle pass end to end; the
// same CI headroom as the round-3 file (tapeAmendmentC.test.js).
vi.setConfig({ testTimeout: 30_000 });

const round2 = (v) => Math.round(v * 100) / 100;
const cents = (v) => Math.round(v * 100);

/** The fixed basis note (BA-38), verbatim from the amendment. */
const BASIS_NOTE = "Banked points and the bought entry use the platform's quote, delayed about 15–20 minutes; rebuilt values use completed 1-minute bars.";
/** The note an earlier replay version carries (BA-38), verbatim from the amendment. */
const VERSION_NOTE = 'built by an earlier replay version; the reconciliation split was not computed';

let errSpy;
beforeEach(() => { flags.writer = true; errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { errSpy.mockRestore(); calculateAssetScoreServer.mockClear(); });

// ── BA-38 — the DRgA case, rebuilt from the discovery report §1.3 ────────────
//
// DRgA4vrEIZ0kN574vexk, 2026-09-22, tickSeq 7: GOOGL sold at 12:16:04 ET
// (16:16:04.052Z) for MU. The executor banked −17 at the evaluator's delayed
// quote 355.66 (§1.1); the tape rebuilt −24 at the close of the 1-minute bar
// that completed at 16:16:00Z, about 353.07 (§1.2). Every other input is the
// recorded one: entry 361.75, ATR 3.2, support, no direction, the receipt's
// pre-tick history, baseline the swap price, tiered (no tier stamp).

const D2 = '2026-09-22';
const S2 = sessionFor(D2);
const SWAP_AT = '2026-09-22T16:16:04.052Z';
const MU_FILL = 163.4;
const MU_BAR = 162.8;
const googlInputs = (over = {}) => ({
  entryPrice: 361.75, atr: 3.2, tier: 'support', direction: null,
  thresholdHistory: { maxMultiplier: 0.022892, minMultiplier: -0.484623 },
  thresholdBaseline: { value: 361.75, basis: 'swap_price' }, sources: {}, ...over,
});
const muInputs = () => ({
  entryPrice: MU_FILL, atr: 4.1, tier: 'support', direction: null,
  thresholdHistory: { maxMultiplier: 0, minMultiplier: 0 }, thresholdBaseline: { value: MU_FILL, basis: 'swap_price' }, sources: {},
});
const drga = (over = {}) => ({
  key: `swap:${SWAP_AT}|GOOGL|MU`, tickSeq: 7, at: SWAP_AT, symbolOut: 'GOOGL', symbolIn: 'MU',
  lockedPoints: -17, exitPrice: 355.66, entryPrice: 361.75, inBasis: { price: MU_FILL, at: SWAP_AT },
  replayInputs: { ghost: googlInputs(), bought: muInputs() },
  replayMissing: [], replayReason: null, subsequentTradesInSlot: 0, ...over,
});
const bars2 = (rows) => sessionBars(rows, D2, S2);
/** Rows with the minutes in [fromUtc, toUtc) removed (a halt, a vendor hole). */
const holed2 = (price, fromUtc, toUtc) => flatRows(D2, price).filter((r) => r.timestamp * 1000 < Date.parse(`${D2}T${fromUtc}:00.000Z`) || r.timestamp * 1000 >= Date.parse(`${D2}T${toUtc}:00.000Z`));
const drgaBars = (over = {}) => ({ GOOGL: bars2(flatRows(D2, 353.07)), MU: bars2(flatRows(D2, MU_BAR)), SPY: bars2(flatRows(D2, 560)), RSP: bars2(flatRows(D2, 180)), ...over });
const replayDrga = (actionOver = {}, barsOver = {}) => replayAction({ action: drga(actionOver), checks: [], barsBySymbol: drgaBars(barsOver), session: S2 });

describe('BA-38 (Q1) — the reconciliation names its two causes: the DRgA case from the discovery report §1.3', () => {
  it('Q1: recorded 355.66, bar 353.07, lockedPoints −17 → closedLegDelta −7 = inputsDelta 0 + priceDelta −7', () => {
    const r = replayDrga();
    expect(r.ghost.atSwap).toBe(-24);
    expect(r.reconciliation.closedLegDelta).toBe(-7);
    expect(r.reconciliation.soldAtSale).toEqual({
      recordedPx: 355.66,
      rebuiltPx: 353.07,
      barClosedAt: '2026-09-22T16:16:00.000Z',
      pxDelta: -2.59,
      rescoredAtRecordedPx: -17,
      inputsDelta: 0,
      priceDelta: -7,
      missingInputs: [],
    });
  });

  it('Q1: the split sums to closedLegDelta exactly, in cents, across inputs and prices', () => {
    const cases = [
      replayDrga(),
      replayDrga({ replayInputs: { ghost: googlInputs({ atr: 1.0 }), bought: muInputs() } }),
      replayDrga({ replayInputs: { ghost: googlInputs({ tier: 'core' }), bought: muInputs() } }),
      replayDrga({ lockedPoints: -12.5 }),
      replayDrga({}, { GOOGL: bars2(flatRows(D2, 340.11)) }),
    ];
    for (const r of cases) {
      const s = r.reconciliation.soldAtSale;
      expect(cents(s.inputsDelta) + cents(s.priceDelta)).toBe(cents(r.reconciliation.closedLegDelta));
      expect(s.inputsDelta).toBe(round2(s.rescoredAtRecordedPx - r.lockedPoints));
      expect(s.priceDelta).toBe(round2(r.ghost.atSwap - s.rescoredAtRecordedPx));
    }
  });

  it('Q1: a mutated scorer input — ATR 1.0 where the executor used 3.2 — gives a non-zero inputsDelta, and the split still sums', () => {
    const r = replayDrga({ replayInputs: { ghost: googlInputs({ atr: 1.0 }), bought: muInputs() } });
    const s = r.reconciliation.soldAtSale;
    expect(s.rescoredAtRecordedPx).toBe(-47);                 // the discovery report's ATR 1.0 row (§1.3)
    expect(s.inputsDelta).toBe(-30);                          // −47 − (−17): a genuine input difference
    expect(s.inputsDelta).not.toBe(0);
    expect(cents(s.inputsDelta) + cents(s.priceDelta)).toBe(cents(r.reconciliation.closedLegDelta));
  });

  it('Q1: rescoredAtRecordedPx is the IMPORTED scorer\'s — called with the ghost leg\'s inputs at the recorded price; swapping its implementation moves it', () => {
    replayDrga();
    const atRecorded = calculateAssetScoreServer.mock.calls.filter(([asset, priceChange]) => asset.symbol === 'GOOGL'
      && Math.abs(priceChange - ((355.66 - 361.75) / 361.75) * 100) < 1e-9);
    expect(atRecorded).toHaveLength(1);
    const [asset, priceChange, history, extremes, thresholdPriceChange] = atRecorded[0];
    expect(asset).toEqual({ symbol: 'GOOGL', baseATR: 3.2, tier: 'support', direction: null, tierMultiplier: null });
    expect(thresholdPriceChange).toBe(priceChange);                              // the baseline is the swap price, as the executor's
    expect(history).toEqual({ maxMultiplier: 0.022892, minMultiplier: -0.484623 });
    expect(extremes).toEqual({});
  });

  it('Q1: the imported scorer, swapped — every rebuilt number follows it, so no local copy of its arithmetic can stand in', async () => {
    const real = (await vi.importActual('../agentScoring.js')).calculateAssetScoreServer;
    calculateAssetScoreServer.mockImplementation((...args) => { const r = real(...args); return { ...r, totalPoints: r.totalPoints + 5 }; });
    try {
      const s = replayDrga().reconciliation.soldAtSale;
      expect(s.rescoredAtRecordedPx).toBe(-12);              // −17 + 5
      expect(s.inputsDelta).toBe(5);
      expect(s.priceDelta).toBe(-7);                         // (−24 + 5) − (−12)
    } finally {
      calculateAssetScoreServer.mockImplementation(real);
    }
  });

  it('Q1: a missing rebuilt price gives priceDelta null with the input named — never 0', () => {
    // GOOGL has no bar 16:05–16:20Z: the last bar before the swap completed 16:05:00Z, 11 minutes stale (BA-24)
    const stale = replayDrga({}, { GOOGL: bars2(holed2(353.07, '16:05', '16:20')) }).reconciliation.soldAtSale;
    expect(stale).toEqual({
      recordedPx: 355.66, rebuiltPx: null, barClosedAt: '2026-09-22T16:05:00.000Z', pxDelta: null,
      rescoredAtRecordedPx: -17, inputsDelta: 0, priceDelta: null, missingInputs: ['price:GOOGL@swap'],
    });
    // no GOOGL bars at all
    const barsGone = drgaBars();
    delete barsGone.GOOGL;
    const none = replayAction({ action: drga(), checks: [], barsBySymbol: barsGone, session: S2 }).reconciliation.soldAtSale;
    expect(none).toEqual({
      recordedPx: 355.66, rebuiltPx: null, barClosedAt: null, pxDelta: null,
      rescoredAtRecordedPx: -17, inputsDelta: 0, priceDelta: null, missingInputs: ['bars:GOOGL'],
    });
  });

  it('Q1: a missing recorded part is null with its input named — the exit price, a ghost input, lockedPoints — never 0', () => {
    const noExit = replayDrga({ exitPrice: null }).reconciliation.soldAtSale;
    expect(noExit).toEqual({
      recordedPx: null, rebuiltPx: 353.07, barClosedAt: '2026-09-22T16:16:00.000Z', pxDelta: null,
      rescoredAtRecordedPx: null, inputsDelta: null, priceDelta: null, missingInputs: ['exitPrice'],
    });
    const noAtr = replayDrga({ replayInputs: { ghost: null, bought: muInputs() }, replayMissing: ['ghost.atr'] });
    expect(noAtr.reconciliation.soldAtSale).toEqual({
      recordedPx: 355.66, rebuiltPx: 353.07, barClosedAt: '2026-09-22T16:16:00.000Z', pxDelta: -2.59,
      rescoredAtRecordedPx: null, inputsDelta: null, priceDelta: null, missingInputs: ['ghost.atr'],
    });
    const noLocked = replayDrga({ lockedPoints: null }).reconciliation.soldAtSale;
    expect(noLocked).toMatchObject({ rescoredAtRecordedPx: -17, inputsDelta: null, priceDelta: -7, missingInputs: ['lockedPoints'] });
  });

  it('Q1: boughtAtSale is recorded — the fill (inBasis.price) against the bought name\'s rebuilt price at the swap instant', () => {
    const r = replayDrga();
    expect(r.reconciliation.boughtAtSale).toEqual({
      recordedPx: MU_FILL, rebuiltPx: MU_BAR, barClosedAt: '2026-09-22T16:16:00.000Z', pxDelta: round2(MU_BAR - MU_FILL), missingInputs: [],
    });
    const noFill = replayDrga({ inBasis: null, replayInputs: { ghost: googlInputs(), bought: null }, replayMissing: ['bought.entryPrice'] }).reconciliation.boughtAtSale;
    expect(noFill).toEqual({ recordedPx: null, rebuiltPx: MU_BAR, barClosedAt: '2026-09-22T16:16:00.000Z', pxDelta: null, missingInputs: ['inBasis.price'] });
    const staleFill = replayDrga({}, { MU: bars2(holed2(MU_BAR, '16:05', '16:20')) }).reconciliation.boughtAtSale;
    expect(staleFill).toEqual({ recordedPx: MU_FILL, rebuiltPx: null, barClosedAt: '2026-09-22T16:05:00.000Z', pxDelta: null, missingInputs: ['price:MU@swap'] });
  });

  it('Q1: the replay records its locked basis with the fixed note', () => {
    const r = replayDrga();
    expect(r.lockedBasis).toBe('eodhd_realtime_delayed');
    expect(r.lockedBasisNote).toBe(BASIS_NOTE);
  });
});

// ── BA-38 through the passes: a real tape day ────────────────────────────────

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const MORNING = Date.parse('2026-09-25T11:00:30.000Z');
const INSIDE = Date.parse('2026-09-28T15:00:00.000Z');   // Monday 11:00 ET — inside 2026-09-24's candle window
const NEXT_MORNING = Date.parse('2026-09-29T11:00:30.000Z');
const OUTSIDE = Date.parse('2026-10-20T15:00:00.000Z');  // ten sessions past: outside the window
const PRICES = { AAPL: 231, MSFT: 423, NVDA: 121, AMD: 144, KO: 70.5, PEP: 171, TSLA: 242, NFLX: 704, XLK: 250, XLP: 80, XLC: 95, XLY: 210, SPY: 560, RSP: 180 };
const allBars = () => Object.fromEntries(Object.entries(PRICES).map(([s, p]) => [s, flatRows(D, p)]));
const tapePath = (id) => `agentBattles/${id}/tape/${D}`;
const tapeOf = (t, id) => t.store.get(tapePath(id));
const morning = (t, at = MORNING) => runCandlePass({ db: t.db, fetchCandles: fetcherOf(allBars()).fetchCandles, clock: () => at, startMs: at });
const refresh = (t, at) => runBackfill({ db: t.db, clock: () => at, startMs: at, dates: [D], refresh: true });

/** A tape day written at night and enriched the next morning, by the passes as they are now. */
async function enrichedDay() {
  const fx = await capturedDay();
  const t = makeTapeDb(seedDay({}, fx));
  await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
  await morning(t);
  return { fx, t };
}

/**
 * The tape as the A1 replay logic (version 1, Amendments A–C) left it: no sale
 * split and no locked basis on any replay, an unprefixed builtFrom, and an
 * input fingerprint without the sale part.
 */
function asVersionOne(tape) {
  const t = structuredClone(tape);
  for (const a of t.actions) {
    if (!a.replay) continue;
    const { soldAtSale: _s, boughtAtSale: _b, ...reconciliation } = a.replay.reconciliation;
    const { lockedBasis: _l, lockedBasisNote: _n, ...rest } = a.replay;
    a.replay = { ...rest, reconciliation, builtFrom: String(rest.builtFrom).replace(/^replay-v\d+:/, '') };
  }
  if (t.passes?.candles?.inputFingerprint) delete t.passes.candles.inputFingerprint.salePrices;
  return t;
}

describe('BA-38 (Q1) — the tape carries the split, its classes and its read-out', () => {
  it('Q1: every replayed action of a real tape day carries soldAtSale, boughtAtSale and the locked basis; the split sums; every new number has exactly one class', async () => {
    const { fx, t } = await enrichedDay();
    const tape = tapeOf(t, fx.battleId);
    const replayed = tape.actions.filter((a) => a.replay);
    expect(replayed.length).toBe(2);
    for (const a of replayed) {
      const r = a.replay;
      const s = r.reconciliation.soldAtSale;
      expect(s.recordedPx, a.key).toBe(a.exitPrice);
      expect(s.rebuiltPx, a.key).toBe(PRICES[a.symbolOut]);
      expect(cents(s.inputsDelta) + cents(s.priceDelta), a.key).toBe(cents(r.reconciliation.closedLegDelta));
      expect(r.reconciliation.boughtAtSale.recordedPx, a.key).toBe(a.inBasis.price);
      expect(r.reconciliation.boughtAtSale.rebuiltPx, a.key).toBe(PRICES[a.symbolIn]);
      expect(r.lockedBasis).toBe('eodhd_realtime_delayed');
    }
    const classes = Object.fromEntries(numbersWithClasses(tape, tape.numberClasses)
      .filter((n) => n.path.includes('soldAtSale') || n.path.includes('boughtAtSale'))
      .map((n) => [formatNumberPath(n.path).replace(/\[\d+\]/g, '[]'), n.cls]));
    expect(classes).toEqual({
      'actions[].replay.reconciliation.soldAtSale.recordedPx': 'recorded',
      'actions[].replay.reconciliation.soldAtSale.rebuiltPx': 'market',
      'actions[].replay.reconciliation.soldAtSale.pxDelta': 'rebuilt',
      'actions[].replay.reconciliation.soldAtSale.rescoredAtRecordedPx': 'rebuilt',
      'actions[].replay.reconciliation.soldAtSale.inputsDelta': 'rebuilt',
      'actions[].replay.reconciliation.soldAtSale.priceDelta': 'rebuilt',
      'actions[].replay.reconciliation.boughtAtSale.recordedPx': 'recorded',
      'actions[].replay.reconciliation.boughtAtSale.rebuiltPx': 'market',
      'actions[].replay.reconciliation.boughtAtSale.pxDelta': 'rebuilt',
    });
    for (const n of numbersWithClasses(tape, tape.numberClasses)) expect(PROVENANCE_CLASSES, formatNumberPath(n.path)).toContain(n.cls);
  });

  it('Q1: the read-out prints the split and the basis note, every number labelled', async () => {
    const { fx, t } = await enrichedDay();
    const tape = tapeOf(t, fx.battleId);
    const md = formatTapeMarkdown(tape, []);
    expect(md).not.toContain('UNCLASSIFIED');
    for (const a of tape.actions.filter((x) => x.replay)) {
      const r = a.replay;
      const s = r.reconciliation.soldAtSale;
      const b = r.reconciliation.boughtAtSale;
      expect(md).toContain(`    - the sale, split by cause: recorded exit ${s.recordedPx} (recorded) vs rebuilt ${s.rebuiltPx} (market) (bar closed `);
      expect(md).toContain(` · rescored at the recorded exit ${s.rescoredAtRecordedPx} (rebuilt) · inputsDelta ${s.inputsDelta} (rebuilt) + priceDelta ${s.priceDelta} (rebuilt) = closedLegDelta ${r.reconciliation.closedLegDelta} (rebuilt)`);
      expect(md).toContain(`    - the fill: recorded ${b.recordedPx} (recorded) vs rebuilt ${b.rebuiltPx} (market) (bar closed `);
      expect(md).toContain(`    - gap at the close (banked + bought − sold): ${r.gapPoints} (rebuilt) — “${BASIS_NOTE}”`);
    }
    expect(md).toContain(`    - banked points and the bought entry: basis \`eodhd_realtime_delayed\` — “${BASIS_NOTE}”`);
  });

  it('Q1 GUARD: a tape whose stored declaration predates the split — the candle pass declares every number it writes', async () => {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    const tape = tapeOf(t, fx.battleId);
    const older = Object.fromEntries(Object.entries(tape.numberClasses).filter(([k]) => !k.includes('AtSale')));
    t.store.set(tapePath(fx.battleId), { ...tape, numberClasses: older });
    await morning(t);
    const after = tapeOf(t, fx.battleId);
    const bad = numbersWithClasses(after, after.numberClasses).filter((n) => !PROVENANCE_CLASSES.includes(n.cls)).map((n) => formatNumberPath(n.path));
    expect(bad).toEqual([]);
  });
});

describe('BA-38 (Q1) — the replay logic version: a logic change is not an input change', () => {
  it('Q1: every replay\'s builtFrom carries the replay-logic version', async () => {
    const { fx, t } = await enrichedDay();
    const tape = tapeOf(t, fx.battleId);
    const session = sessionFor(D);
    for (const a of tape.actions.filter((x) => x.replay)) {
      expect(a.replay.builtFrom, a.key).toMatch(/^replay-v2:[0-9a-f]{16}$/);
      expect(a.replay.builtFrom, a.key).toBe(replayBuiltFrom(tape, a, session));
    }
  });

  it('Q1: a replay built by the old logic, re-merged inside the candle window, is re-queued with reason replay_logic_updated — and rebuilt on the next candle run', async () => {
    const { fx, t } = await enrichedDay();
    t.store.set(tapePath(fx.battleId), asVersionOne(tapeOf(t, fx.battleId)));
    const r = await refresh(t, INSIDE);
    expect(r.refreshed.map((x) => x.battleId)).toEqual([fx.battleId]);
    const queued = tapeOf(t, fx.battleId);
    expect(queued.passes.candles).toMatchObject({ status: 'pending', reason: 'replay_logic_updated', attempts: 0 });
    expect(queued.passes.candles.changedInputs).toBeUndefined();          // not an input change
    await morning(t, NEXT_MORNING);
    const rebuilt = tapeOf(t, fx.battleId);
    const session = sessionFor(D);
    expect(rebuilt.passes.candles.status).toBe('written');
    for (const a of rebuilt.actions.filter((x) => x.replay)) {
      expect(a.replay.builtFrom, a.key).toBe(replayBuiltFrom(rebuilt, a, session));
      expect(a.replay.reconciliation.soldAtSale, a.key).toEqual(expect.objectContaining({ recordedPx: a.exitPrice }));
      expect(a.replay.note, a.key).toBeUndefined();
      expect(a.replay.preservedFrom ?? null, a.key).toBeNull();            // replaced whole, nothing kept from version 1
    }
  });

  it('Q1: outside the window the pass status is unchanged, and the replay\'s note says the split was not computed', async () => {
    const { fx, t } = await enrichedDay();
    const old = asVersionOne(tapeOf(t, fx.battleId));
    t.store.set(tapePath(fx.battleId), old);
    const r = await refresh(t, OUTSIDE);
    expect(r.refreshed.map((x) => x.battleId)).toEqual([fx.battleId]);
    const after = tapeOf(t, fx.battleId);
    expect(after.passes.candles.status).toBe('written');
    expect(after.passes.candles.reason).toBe(old.passes.candles.reason);
    expect(after.passes.candles.changedInputs).toBeUndefined();
    for (const a of after.actions.filter((x) => x.replay)) {
      expect(a.replay.note, a.key).toBe(VERSION_NOTE);
      expect(a.replay.reconciliation.soldAtSale, a.key).toBeUndefined();
    }
    // a second refresh changes nothing: the note replaces, never stacks
    const again = await refresh(t, OUTSIDE + 60_000);
    expect(again.unchanged.map((x) => x.battleId)).toEqual([fx.battleId]);
    expect(formatTapeMarkdown(tapeOf(t, fx.battleId), [])).toContain(`    - note: “${VERSION_NOTE}”`);
  });

  it('Q1: a corrected exit price IS an input change (BA-31): the replay now reads it, so its identity and the fingerprint carry it', async () => {
    const { fx, t } = await enrichedDay();
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.trades = battle.trades.map((tr) => (tr.symbolOut === 'AMD' ? { ...tr, exitPrice: 144.9 } : tr));
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await writeTapeDay(fx.battleId, D, { db: t.db, now: INSIDE });
    const queued = tapeOf(t, fx.battleId);
    expect(queued.passes.candles).toMatchObject({ status: 'pending', reason: 'inputs_changed', changedInputs: ['salePrices'] });
    await morning(t, NEXT_MORNING);
    const amd = tapeOf(t, fx.battleId).actions.find((a) => a.symbolOut === 'AMD');
    expect(amd.replay.reconciliation.soldAtSale.recordedPx).toBe(144.9);
    expect(amd.replay.builtFrom).toBe(replayBuiltFrom(tapeOf(t, fx.battleId), amd, sessionFor(D)));
  });
});

// ── BA-39 (Q2) — no result from a missing score; the platform's own words ────
//
// ogbLFLndtIumeO0zZVT9 (discovery report §2): deployed after the close, never
// scored, completed the next morning as 0 vs an opponent score that was never
// written. The platform's completion read the missing operand as 0, wrote
// "… Result: Draw." to its statusFeed and a draw to the agent's record, and
// no `result` field — so the tape derived a draw from a missing score.

const COMPLETED_AT = '2026-09-24T20:05:00.000Z';
const DRAW_TEXT = 'Battle complete. Agent: +0.0 pts vs CPU: +0.0 pts. Result: Draw.';
const completionEntry = (over = {}) => ({ timestamp: COMPLETED_AT, message: DRAW_TEXT, action: 'battle_complete', source: 'system', score: 0, ...over });

/** The ogbLF shape over the completed fixture day: final 0, the opponent's score never written, the platform's completion in its feed. */
async function neverScoredDay({ battleId = 'b-never-scored', feed = null } = {}) {
  const fx = await completedDay({ battleId });
  const { opponentScore: _never, ...scoreState } = fx.battle.scoreState;
  fx.battle.scoreState = { ...scoreState, currentScore: 0 };
  fx.battle.statusFeed = feed ?? [
    { timestamp: '2026-09-24T12:00:00.000Z', message: 'Agent opened the conversation.', action: 'first_message' },
    completionEntry(),
  ];
  return fx;
}

describe('BA-39 (Q2) — a battle result is derived only from two recorded final scores', () => {
  it('Q2: final 0 vs an absent opponent gives result null, basis unavailable, with a note naming the missing score — the comparison is never run', () => {
    const resolveResult = vi.fn(() => 'draw');
    const battle = { status: 'completed', completedAt: COMPLETED_AT, gameMode: 'baggerbomb_agent', scoreState: { currentScore: 0 } };
    const block = buildBattleBlock({ battle, resolveResult });
    expect(block.final).toEqual({ total: 0, opponent: null, at: COMPLETED_AT });
    expect(block.result).toEqual({ value: null, basis: 'unavailable', note: 'opponent score never recorded' });
    expect(resolveResult).not.toHaveBeenCalled();
    expect(buildBattleBlock({ battle: { ...battle, scoreState: { opponentScore: 3 } }, resolveResult }).result)
      .toEqual({ value: null, basis: 'unavailable', note: 'agent score never recorded' });
    expect(buildBattleBlock({ battle: { ...battle, scoreState: {} }, resolveResult }).result)
      .toEqual({ value: null, basis: 'unavailable', note: 'agent score and opponent score never recorded' });
    expect(resolveResult).not.toHaveBeenCalled();
  });

  it('Q2 GUARD: two recorded scores — 0 vs 0 included — still give the comparison completion uses', () => {
    const battle = { status: 'completed', completedAt: COMPLETED_AT, gameMode: 'baggerbomb_agent', scoreState: { currentScore: 0, opponentScore: 0 } };
    expect(buildBattleBlock({ battle, resolveResult: resolveBattleResult }).result).toEqual({ value: 'draw', basis: 'derived' });
    expect(buildBattleBlock({ battle: { ...battle, scoreState: { currentScore: 46, opponentScore: 36 } }, resolveResult: resolveBattleResult }).result)
      .toEqual({ value: 'win', basis: 'derived' });
  });

  it('Q2: through the writer — the never-scored battle\'s tape records no result, and says which score is missing', async () => {
    const fx = await neverScoredDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    const tape = tapeOf(t, fx.battleId);
    expect(tape.battle.final).toEqual({ total: 0, opponent: null, at: COMPLETED_AT });
    expect(tape.battle.result).toEqual({ value: null, basis: 'unavailable', note: 'opponent score never recorded' });
  });

  it('Q2: a stored tape that already carries the derived "draw", re-merged, becomes unavailable', async () => {
    const fx = await neverScoredDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    // the tape as the first close pass wrote it on 2026-09-28: a draw derived from the missing operand
    const stored = tapeOf(t, fx.battleId);
    t.store.set(tapePath(fx.battleId), { ...stored, battle: { status: 'completed', completedAt: COMPLETED_AT, final: { total: 0, opponent: null, at: COMPLETED_AT }, result: { value: 'draw', basis: 'derived' } } });
    const r = await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT + 60_000 });
    expect(r.status).toBe('written');
    expect(tapeOf(t, fx.battleId).battle.result).toEqual({ value: null, basis: 'unavailable', note: 'opponent score never recorded' });
  });

  it('Q2: the result is recomputed from the merged final scores on every merge — never kept by rank, even when the stored block wins the tie', async () => {
    const fx = await neverScoredDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    const tape = tapeOf(t, fx.battleId);
    // no canonical re-read: on equal lifecycle rank the stored completion block stands (BA-27 amended) — its result does not
    const drawn = { ...tape, battle: { ...tape.battle, result: { value: 'draw', basis: 'derived' } } };
    expect(mergeTape(drawn, structuredClone(tape), { nowIso: new Date(NIGHT + 60_000).toISOString(), withinWindow: true }).doc.battle.result)
      .toEqual({ value: null, basis: 'unavailable', note: 'opponent score never recorded' });
    // a stored block whose derived result disagrees with its own final scores: the scores decide
    const scored = { ...tape, battle: { ...tape.battle, final: { total: 9, opponent: 50, at: COMPLETED_AT }, result: { value: 'win', basis: 'derived' } } };
    const assembled = { ...structuredClone(tape), battle: { ...scored.battle } };
    expect(mergeTape(scored, assembled, { nowIso: new Date(NIGHT + 60_000).toISOString(), withinWindow: true }).doc.battle.result)
      .toEqual({ value: 'loss', basis: 'derived' });
  });

  it('Q2 GUARD: a stored basis — a result field the platform wrote — still wins, missing score or not', async () => {
    const fx = await neverScoredDay();
    fx.battle.result = 'draw';
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    const tape = tapeOf(t, fx.battleId);
    expect(tape.battle.result).toEqual({ value: 'draw', basis: 'stored' });
    expect(mergeTape(tape, structuredClone(tape), { nowIso: new Date(NIGHT + 60_000).toISOString(), withinWindow: true }).doc.battle.result)
      .toEqual({ value: 'draw', basis: 'stored' });
  });

  it('Q2: a final day written before the fix is re-merged once by the backfill, then reads already done', async () => {
    const fx = await neverScoredDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    const stored = tapeOf(t, fx.battleId);
    t.store.set(tapePath(fx.battleId), { ...stored, battle: { status: 'completed', completedAt: COMPLETED_AT, final: { total: 0, opponent: null, at: COMPLETED_AT }, result: { value: 'draw', basis: 'derived' } } });
    const first = await runBackfill({ db: t.db, clock: () => INSIDE, startMs: INSIDE, dates: [D] });
    expect(first.written.map((x) => x.battleId)).toEqual([fx.battleId]);
    expect(tapeOf(t, fx.battleId).battle.result.basis).toBe('unavailable');
    const second = await runBackfill({ db: t.db, clock: () => INSIDE + 60_000, startMs: INSIDE + 60_000, dates: [D] });
    expect(second.alreadyDone.map((x) => x.battleId)).toEqual([fx.battleId]);
  });
});

describe('BA-39 (Q2) — battle.completionMessage: the platform\'s own words at completion, verbatim', () => {
  it('Q2: the battle_complete statusFeed message is copied verbatim with its time', async () => {
    const fx = await neverScoredDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    expect(tapeOf(t, fx.battleId).battle.completionMessage).toEqual({ text: DRAW_TEXT, at: COMPLETED_AT });
  });

  it('Q2: verbatim means byte for byte — spacing kept; the LAST battle_complete entry (a repair writes another); no other action\'s message', async () => {
    const odd = '  Battle complete.  Agent: +0.0 pts vs CPU: +0.0 pts.\nResult: Draw. ';
    const fx = await neverScoredDay({
      feed: [
        completionEntry({ timestamp: '2026-09-24T20:00:30.000Z', message: 'Battle complete. Agent: +1.0 pts vs CPU: +0.0 pts. Result: Win.' }),
        completionEntry({ message: odd }),
        { timestamp: '2026-09-24T20:06:00.000Z', message: 'Something after.', action: 'hold', source: 'system' },
      ],
    });
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    expect(tapeOf(t, fx.battleId).battle.completionMessage).toEqual({ text: odd, at: COMPLETED_AT });
  });

  it('Q2: no battle_complete entry, or a battle still active — no completion message', async () => {
    const fx = await neverScoredDay({ feed: [{ timestamp: '2026-09-24T12:00:00.000Z', message: 'Agent opened the conversation.', action: 'first_message' }] });
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    expect(tapeOf(t, fx.battleId).battle.completionMessage).toBeNull();
    const active = buildBattleBlock({ battle: { status: 'active', statusFeed: [completionEntry()] }, resolveResult: resolveBattleResult });
    expect(active.completionMessage).toBeNull();
  });

  it('Q2: the read-out prints "Platform recorded at completion: “…”" with its time, beside the tape\'s "unavailable" and the missing score', async () => {
    const fx = await neverScoredDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    const md = formatTapeMarkdown(tapeOf(t, fx.battleId), []);
    expect(md).toContain('result: — (basis `unavailable`) · “opponent score never recorded”');
    expect(md).toContain(`- Platform recorded at completion: “${DRAW_TEXT}” — at 4:05 PM ET · \`${COMPLETED_AT}\``);
    expect(md).not.toContain('UNCLASSIFIED');
  });
});
