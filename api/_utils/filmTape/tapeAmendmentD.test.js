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
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

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
import { replayAction, mergeReplay, replayHasFact } from './tapeReplay.js';
import * as candleInputs from './candleInputs.js';
import { replayBuiltFrom, actionValues, checkValues, evidenceValues, laterChecks } from './candleInputs.js';
import { writeTapeDay } from './writeTapeDay.js';
import { runCandlePass, keepUnit } from './candlePass.js';
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
 * split and no locked basis on any replay, the builtFrom the A1 code gave it
 * (a1ReplayBuiltFrom — the genuine version-1 identity, pinned against the A1
 * code's own output below), and an input fingerprint without the sale part.
 */
function asVersionOne(tape) {
  const t = structuredClone(tape);
  for (const a of t.actions) {
    if (!a.replay) continue;
    const { soldAtSale: _s, boughtAtSale: _b, ...reconciliation } = a.replay.reconciliation;
    const { lockedBasis: _l, lockedBasisNote: _n, ...rest } = a.replay;
    a.replay = { ...rest, reconciliation, builtFrom: a1ReplayBuiltFrom(t, a, sessionFor(D)) };
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
      // BA-48 (Amendment E): every operand recorded → derived
      'actions[].replay.reconciliation.soldAtSale.rescoredAtRecordedPx': 'derived',
      'actions[].replay.reconciliation.soldAtSale.inputsDelta': 'derived',
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
      expect(md).toContain(` · rescored at the recorded exit ${s.rescoredAtRecordedPx} (derived) · inputsDelta ${s.inputsDelta} (derived) + priceDelta ${s.priceDelta} (rebuilt) = closedLegDelta ${r.reconciliation.closedLegDelta} (rebuilt)`);
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

/**
 * The ogbLF shape over the completed fixture day: no check was ever admitted (no
 * tick, no evaluation, no tickSeq minted — review AD3-3: every scored tick
 * writes the opponent's score), final 0, the opponent's score never written,
 * and the platform's completion in its feed.
 */
async function neverScoredDay({ battleId = 'b-never-scored', feed = null } = {}) {
  const fx = await completedDay({ battleId });
  fx.ticks = [];
  fx.battle.evaluations = [];
  fx.battle.cronState = { tickSeq: 0 };
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
    expect(mergeTape(drawn, structuredClone(tape), { nowIso: new Date(NIGHT + 60_000).toISOString(), withinWindow: true, resolveResult: resolveBattleResult }).doc.battle.result)
      .toEqual({ value: null, basis: 'unavailable', note: 'opponent score never recorded' });
    // a stored block whose derived result disagrees with its own final scores: the scores decide
    const scored = { ...tape, battle: { ...tape.battle, final: { total: 9, opponent: 50, at: COMPLETED_AT }, result: { value: 'win', basis: 'derived' } } };
    const assembled = { ...structuredClone(tape), battle: { ...scored.battle } };
    expect(mergeTape(scored, assembled, { nowIso: new Date(NIGHT + 60_000).toISOString(), withinWindow: true, resolveResult: resolveBattleResult }).doc.battle.result)
      .toEqual({ value: 'loss', basis: 'derived' });
  });

  it('Q2 GUARD: a stored basis — a result field the platform wrote — still wins, missing score or not', async () => {
    const fx = await neverScoredDay();
    fx.battle.result = 'draw';
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    const tape = tapeOf(t, fx.battleId);
    expect(tape.battle.result).toEqual({ value: 'draw', basis: 'stored' });
    expect(mergeTape(tape, structuredClone(tape), { nowIso: new Date(NIGHT + 60_000).toISOString(), withinWindow: true, resolveResult: resolveBattleResult }).doc.battle.result)
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

  it('Q2: verbatim means byte for byte — spacing kept; the LAST battle_complete entry, should the feed ever hold more than one; no other action\'s message', async () => {
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

// ── The §2 review's confirmed findings (build report §11.6) ──────────────────
//
// Each row below was red at e8e2bdc3, the reviewed code head, unless it is
// marked GUARD (it passes there and pins the rule a surviving mutant broke).
// The finding ids are this review's own (AD1-n … AD4-n).

/** The identity the A1 replay logic (version 1, through Amendment C) gave a replay — its formula, frozen here independently of the code under test. */
function a1ReplayBuiltFrom(tape, action, session) {
  const later = laterChecks(tape.checks, action, session);
  const sectors = tape.comparables && typeof tape.comparables.sectors === 'object' ? tape.comparables.sectors : {};
  const orNull = (v) => (v === undefined ? null : v);
  const ev = (c) => (c.evidence && typeof c.evidence === 'object' && !Array.isArray(c.evidence) ? c.evidence[action.symbolIn] : null);
  return createHash('sha256').update(JSON.stringify(['replay', actionValues(action), later.map(checkValues),
    later.map((c) => evidenceValues(ev(c))), [orNull(sectors[action.symbolOut]), orNull(sectors[action.symbolIn])]])).digest('hex').slice(0, 16);
}
/** All bars but one symbol's (a failed fetch for that symbol). */
const barsWithout = (...gone) => Object.fromEntries(Object.entries(allBars()).filter(([s]) => !gone.includes(s)));
const morningWith = (t, bars, at) => runCandlePass({ db: t.db, fetchCandles: fetcherOf(bars).fetchCandles, clock: () => at, startMs: at });
const legsOf = (r) => ({ ghost: r.ghost, bought: r.bought, holdPath: r.holdPath, swapPath: r.swapPath, gapPoints: r.gapPoints, closedLegDelta: r.reconciliation.closedLegDelta, marketChangeAfter: r.marketChangeAfter, sectorChangeAfter: r.sectorChangeAfter });
const LATER_MORNING = NEXT_MORNING + 86_400_000;
const LATER_INSIDE = INSIDE + 86_400_000;

describe('§2 review — the A1 identity the version check compares with', () => {
  it('the frozen A1 formula reproduces the identities the A1 code wrote for the fixture day (read off the base code, 1ae6d9f4)', async () => {
    const { fx, t } = await enrichedDay();
    const tape = tapeOf(t, fx.battleId);
    const session = sessionFor(D);
    const byKey = Object.fromEntries(tape.actions.map((a) => [a.symbolOut, a1ReplayBuiltFrom(tape, a, session)]));
    expect(byKey).toEqual({ AMD: '2a65a5b0d8496b1c', MSFT: '172078dd9aebfee5' });
    for (const a of tape.actions) expect(candleInputs.replayBuiltFromV1?.(tape, a, session), a.key).toBe(byKey[a.symbolOut]);
  });
});

describe('§2 review — AD1-1: a price at the sale that no leg samples is a sample of the replay (BA-24)', () => {
  it('AD1-1: a stale price for the bought name at the swap instant is named in the replay\'s missing inputs, and retryable', () => {
    const r = replayDrga({}, { MU: bars2(holed2(MU_BAR, '16:05', '16:20')) });
    expect(r.missingInputs).toContain('price:MU@swap');
    expect(r.retryableInputs).toContain('price:MU@swap');
  });

  it('AD1-1: so is the sold name\'s, when no ghost leg is built to sample it', () => {
    const r = replayDrga({ replayInputs: { ghost: null, bought: muInputs() }, replayMissing: ['ghost.atr'] }, { GOOGL: bars2(holed2(353.07, '16:05', '16:20')) });
    expect(r.missingInputs).toContain('price:GOOGL@swap');
    expect(r.retryableInputs).toContain('price:GOOGL@swap');
  });

  it('AD1-1: through the passes — a stale fill price at the swap keeps the replay section from reading complete', async () => {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    // NFLX has no bar 16:24–16:30Z: at the 16:30:05 swap its last completed minute closed 16:24:00, six minutes stale
    const holedNflx = flatRows(D, PRICES.NFLX).filter((r) => r.timestamp * 1000 < Date.parse(`${D}T16:24:00.000Z`) || r.timestamp * 1000 >= Date.parse(`${D}T16:30:00.000Z`));
    await morningWith(t, { ...allBars(), NFLX: holedNflx }, MORNING);
    const tape = tapeOf(t, fx.battleId);
    const nflx = tape.actions.find((a) => a.symbolIn === 'NFLX');
    expect(nflx.replay.reconciliation.boughtAtSale).toMatchObject({ rebuiltPx: null, missingInputs: ['price:NFLX@swap'] });
    expect(nflx.replay.missingInputs).toContain('price:NFLX@swap');
    expect(tape.coverage.replay.status).not.toBe('complete');
  });

  it('AD1-1: a merge keeps the name while neither attempt priced the fill at the swap, and drops it once one did', () => {
    const stale = replayDrga({}, { MU: bars2(holed2(MU_BAR, '16:05', '16:20')) });
    const staleToo = replayDrga({}, { MU: bars2(holed2(MU_BAR, '16:04', '16:20')) });
    const priced = replayDrga();
    const both = mergeReplay(stale, staleToo, { symbolOut: 'GOOGL', symbolIn: 'MU' });
    expect(both.reconciliation.boughtAtSale.rebuiltPx).toBeNull();
    expect(both.missingInputs).toContain('price:MU@swap');
    const one = mergeReplay(stale, priced, { symbolOut: 'GOOGL', symbolIn: 'MU' });
    expect(one.reconciliation.boughtAtSale.rebuiltPx).toBe(MU_BAR);
    expect(one.missingInputs).not.toContain('price:MU@swap');
  });
});

describe('§2 review — AD1-2: the split\'s merge rule and its fact', () => {
  it('AD1-2 GUARD: a saved stale null for the fill\'s price keeps its bar age against a fresh attempt with no bars at all (BA-24, the L1-4 rule)', () => {
    const stored = replayDrga({}, { MU: bars2(holed2(MU_BAR, '16:05', '16:20')) });
    const noMu = drgaBars();
    delete noMu.MU;
    const fresh = replayAction({ action: drga(), checks: [], barsBySymbol: noMu, session: S2 });
    const merged = mergeReplay(stored, fresh, { symbolOut: 'GOOGL', symbolIn: 'MU' });
    expect(merged.reconciliation.boughtAtSale).toEqual({ recordedPx: MU_FILL, rebuiltPx: null, barClosedAt: '2026-09-22T16:05:00.000Z', pxDelta: null, missingInputs: ['price:MU@swap'] });
  });

  it('AD1-2 GUARD: a current replay whose only fact is a price at the sale wins over a stale one (BA-31)', () => {
    const stale = { ...replayDrga(), builtFrom: 'replay-v2:old' };
    const onlyFill = replayAction({ action: drga({ replayInputs: { ghost: null, bought: null }, replayMissing: ['ghost.atr', 'bought.atr'] }), checks: [], barsBySymbol: { MU: bars2(flatRows(D2, MU_BAR)) }, session: S2 });
    expect(onlyFill.reconciliation.boughtAtSale.rebuiltPx).toBe(MU_BAR);
    const kept = keepUnit(stale, { ...onlyFill, builtFrom: 'replay-v2:new' }, { merge: (s, f) => mergeReplay(s, f, { symbolOut: 'GOOGL', symbolIn: 'MU' }), hasFact: replayHasFact });
    expect(kept.builtFrom).toBe('replay-v2:new');
  });
});

describe('§2 review — AD2-1: a logic change is not an input change, so a poorer rebuild never replaces a version-1 replay built from the same inputs', () => {
  it('AD2-1: one sold name\'s failed fetch keeps the version-1 replay whole and the pass queued; a good morning then rebuilds it', async () => {
    const { fx, t } = await enrichedDay();
    const v1 = asVersionOne(tapeOf(t, fx.battleId));
    t.store.set(tapePath(fx.battleId), v1);
    await refresh(t, INSIDE);
    await morningWith(t, barsWithout('AMD'), NEXT_MORNING);
    let tape = tapeOf(t, fx.battleId);
    const amd = tape.actions.find((a) => a.symbolOut === 'AMD');
    const before = v1.actions.find((a) => a.symbolOut === 'AMD').replay;
    expect(legsOf(amd.replay)).toEqual(legsOf(before));                        // nothing the version-1 replay held is lost
    expect(amd.replay.builtFrom).toBe(before.builtFrom);
    expect(amd.replay.note).toBe(VERSION_NOTE);
    expect(tape.passes.candles.status).not.toBe('written');
    expect(tape.coverage.replay.note).toContain('replay built by an earlier replay version');
    await morningWith(t, allBars(), LATER_MORNING);
    tape = tapeOf(t, fx.battleId);
    const rebuilt = tape.actions.find((a) => a.symbolOut === 'AMD');
    expect(rebuilt.replay.builtFrom).toBe(replayBuiltFrom(tape, rebuilt, sessionFor(D)));
    expect(rebuilt.replay.reconciliation.soldAtSale.recordedPx).toBe(rebuilt.exitPrice);
    expect(tape.passes.candles.status).toBe('written');
  });

  it('AD2-1: so does a comparable\'s — SPY\'s failed fetch keeps both replays\' market change', async () => {
    const { fx, t } = await enrichedDay();
    const v1 = asVersionOne(tapeOf(t, fx.battleId));
    t.store.set(tapePath(fx.battleId), v1);
    await refresh(t, INSIDE);
    await morningWith(t, barsWithout('SPY'), NEXT_MORNING);
    for (const a of tapeOf(t, fx.battleId).actions) {
      expect(a.replay.marketChangeAfter, a.key).toEqual(v1.actions.find((x) => x.key === a.key).replay.marketChangeAfter);
    }
  });
});

describe('§2 review — AD2-2: over a version-1 replay the replay section says so', () => {
  it('AD2-2: coverage.replay is at most partial and names the earlier version — inside the window awaiting the next candle pass, outside it not rebuilt; the pass status is unchanged outside', async () => {
    const inside = await enrichedDay();
    inside.t.store.set(tapePath(inside.fx.battleId), asVersionOne(tapeOf(inside.t, inside.fx.battleId)));
    await refresh(inside.t, INSIDE);
    const a = tapeOf(inside.t, inside.fx.battleId).coverage.replay;
    expect(a.status).toBe('partial');
    expect(a.note).toMatch(/replay built by an earlier replay version \(AMD → TSLA, MSFT → NFLX\), the reconciliation split not computed — awaiting the next candle pass/);
    const outside = await enrichedDay();
    outside.t.store.set(tapePath(outside.fx.battleId), asVersionOne(tapeOf(outside.t, outside.fx.battleId)));
    await refresh(outside.t, OUTSIDE);
    const b = tapeOf(outside.t, outside.fx.battleId);
    expect(b.passes.candles.status).toBe('written');
    expect(b.coverage.replay.status).toBe('partial');
    expect(b.coverage.replay.note).toMatch(/replay built by an earlier replay version \(AMD → TSLA, MSFT → NFLX\), the reconciliation split not computed — outside its retry window, not rebuilt/);
    expect((await refresh(outside.t, OUTSIDE + 60_000)).unchanged.map((x) => x.battleId)).toEqual([outside.fx.battleId]);
  });
});

describe('§2 review — AD2-3 and AD2-5: a kept version-1 replay is named for what it is', () => {
  it('AD2-3: a version-1 replay whose inputs also changed is named as built before its inputs changed — never only as an earlier version', async () => {
    const { fx, t } = await enrichedDay();
    t.store.set(tapePath(fx.battleId), asVersionOne(tapeOf(t, fx.battleId)));
    const receiptPath = [...t.store.keys()].find((k) => k.startsWith(`learningReceipts/${fx.battleId}/receipts/`) && t.store.get(k).symbolOut === 'AMD');
    const receipt = t.store.get(receiptPath);
    t.store.set(receiptPath, { ...receipt, guardrailReplay: { ...receipt.guardrailReplay, outgoingBaseATR: 1.0 } });
    await refresh(t, INSIDE);
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'pending', reason: 'inputs_changed' });
    await morningWith(t, {}, NEXT_MORNING);                                       // every fetch fails: nothing is rebuilt
    const note = tapeOf(t, fx.battleId).coverage.replay.note;
    expect(note).toContain('replay built before its inputs changed, kept (not rebuilt this attempt): AMD → TSLA');
    expect(note).toContain('replay built by an earlier replay version (MSFT → NFLX), the reconciliation split not computed — awaiting the next candle pass');
    expect(note).not.toMatch(/earlier replay version \([^)]*AMD/);
  });

  it('AD2-5 GUARD: a candle pass that keeps a version-1 replay with unchanged inputs labels it an earlier version, never a changed input', async () => {
    const { fx, t } = await enrichedDay();
    t.store.set(tapePath(fx.battleId), asVersionOne(tapeOf(t, fx.battleId)));
    await refresh(t, INSIDE);
    await morningWith(t, {}, NEXT_MORNING);
    const note = tapeOf(t, fx.battleId).coverage.replay.note;
    // one wording for both writers (review AD2-2): the merge's and the candle pass's labels are the same words
    expect(note).toContain('replay built by an earlier replay version (AMD → TSLA, MSFT → NFLX), the reconciliation split not computed — awaiting the next candle pass');
    expect(note).not.toContain('replay built before its inputs changed');
  });

  it('AD2-5 GUARD: inside the window an exhausted version-1 day stays exhausted, and a pending pass keeps its reason (BA-32)', async () => {
    const { fx, t } = await enrichedDay();
    const v1 = asVersionOne(tapeOf(t, fx.battleId));
    t.store.set(tapePath(fx.battleId), { ...v1, passes: { ...v1.passes, candles: { ...v1.passes.candles, status: 'exhausted', reason: 'attempts_exhausted', attempts: 3 } } });
    await refresh(t, INSIDE);
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'exhausted', reason: 'attempts_exhausted', attempts: 3 });
    t.store.set(tapePath(fx.battleId), { ...v1, passes: { ...v1.passes, candles: { ...v1.passes.candles, status: 'pending', reason: 'inputs_changed', attempts: 0 } } });
    await refresh(t, INSIDE);
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'pending', reason: 'inputs_changed' });
  });
});

describe('§2 review — AD2-N1: the version re-queue happens once', () => {
  it('AD2-N1: a version-1 day a run could not rebuild is not re-queued again — a later refresh resets no attempts and writes nothing', async () => {
    const { fx, t } = await enrichedDay();
    t.store.set(tapePath(fx.battleId), asVersionOne(tapeOf(t, fx.battleId)));
    await refresh(t, INSIDE);
    await morningWith(t, {}, NEXT_MORNING);                                       // nothing rebuilt
    const after = tapeOf(t, fx.battleId).passes.candles;
    expect(after.attempts).toBe(1);
    const r = await refresh(t, LATER_INSIDE);
    expect(r.unchanged.map((x) => x.battleId)).toEqual([fx.battleId]);
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: after.status, attempts: 1 });
  });
});

describe('§2 review — AD3-1 and AD3-2: the result rule in the merge', () => {
  it('AD3-1: a stored result stands on a canonical re-read after the battle document loses it — a missing score is no contradiction', async () => {
    const fx = await neverScoredDay();
    fx.battle.result = 'draw';
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    expect(tapeOf(t, fx.battleId).battle.result).toEqual({ value: 'draw', basis: 'stored' });
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    delete battle.result;
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT + 60_000 });
    expect(tapeOf(t, fx.battleId).battle.result).toEqual({ value: 'draw', basis: 'stored' });
  });

  it('AD3-2: the merge takes the comparison from its caller and imports no evaluator, so the candle cron\'s module graph stays the tape\'s own', async () => {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'tapeMerge.js'), 'utf8');
    expect(src).not.toMatch(/from '\.\/battleResult\.js'|agent-evaluate/);
    const { fx, t } = await (async () => { const f = await completedDay(); return { fx: f, t: makeTapeDb(seedDay({}, f)) }; })();
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    const tape = tapeOf(t, fx.battleId);
    expect(() => mergeTape(tape, structuredClone(tape), { nowIso: new Date(NIGHT + 60_000).toISOString(), withinWindow: true })).toThrow(/resolveResult/);
  });
});

describe('§2 review — AD4-3, AD4-8 and AD4-2: a split\'s missing parts, merged, named and printed', () => {
  it('AD4-3 GUARD: two attempts that both lacked the sold name\'s price at the swap merge to a null that still names its input', () => {
    const stale = replayDrga({}, { GOOGL: bars2(holed2(353.07, '16:05', '16:20')) });
    const staleToo = replayDrga({}, { GOOGL: bars2(holed2(353.07, '16:04', '16:20')) });
    const merged = mergeReplay(stale, staleToo, { symbolOut: 'GOOGL', symbolIn: 'MU' });
    expect(merged.reconciliation.soldAtSale).toMatchObject({ rebuiltPx: null, priceDelta: null, missingInputs: ['price:GOOGL@swap'] });
    const fills = mergeReplay(replayDrga({}, { MU: bars2(holed2(MU_BAR, '16:05', '16:20')) }), replayDrga({}, { MU: bars2(holed2(MU_BAR, '16:04', '16:20')) }), { symbolOut: 'GOOGL', symbolIn: 'MU' });
    expect(fills.reconciliation.boughtAtSale).toMatchObject({ rebuiltPx: null, missingInputs: ['price:MU@swap'] });
  });

  it('AD4-8: a missing exit price is named in the replay\'s missing inputs, as lockedPoints is — never retryable; the replay section is not complete', async () => {
    const r = replayDrga({ exitPrice: null });
    expect(r.missingInputs).toContain('exitPrice');
    expect(r.retryableInputs).not.toContain('exitPrice');
    const fx = await capturedDay();
    fx.battle.trades = fx.battle.trades.map((tr) => (tr.symbolOut === 'AMD' ? { ...tr, exitPrice: undefined } : tr));
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    await morning(t);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.actions.find((a) => a.symbolOut === 'AMD').replay.missingInputs).toEqual(['exitPrice']);
    expect(tape.coverage.replay.status).toBe('partial');
    expect(tape.passes.candles.status).toBe('written');                         // a recorded input no fetch can supply
  });

  it('AD4-2: the read-out of a split with null parts — every null printed —, never 0; each missing input named; a stale bar\'s age; no verdict', async () => {
    const fx = await capturedDay();
    fx.battle.trades = fx.battle.trades.map((tr) => (tr.symbolOut === 'AMD' ? { ...tr, exitPrice: undefined } : tr));
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    // MSFT and NFLX have no bar 16:15–16:35Z: at the 16:30:05 swap both prices are stale
    const hole = (p) => flatRows(D, p).filter((r) => r.timestamp * 1000 < Date.parse(`${D}T16:15:00.000Z`) || r.timestamp * 1000 >= Date.parse(`${D}T16:35:00.000Z`));
    await morningWith(t, { ...allBars(), MSFT: hole(PRICES.MSFT), NFLX: hole(PRICES.NFLX) }, MORNING);
    const lines = formatTapeMarkdown(tapeOf(t, fx.battleId), []).split('\n');
    for (const line of [
      '    - the sale, split by cause: recorded exit — vs rebuilt 144 (market) (bar closed 10:30 AM ET), delta — · rescored at the recorded exit — · inputsDelta — + priceDelta — = closedLegDelta -57.5 (rebuilt) · missing inputs: `exitPrice`',
      '    - the fill: recorded 240 (recorded) vs rebuilt 242 (market) (bar closed 10:30 AM ET), delta 2 (rebuilt)',
      '    - the sale, split by cause: recorded exit 423.1 (recorded) vs rebuilt — (last bar closed 12:15 PM ET), delta — · rescored at the recorded exit 15 (derived) · inputsDelta 6.75 (derived) + priceDelta — = closedLegDelta — · missing inputs: `price:MSFT@swap`',
      '    - the fill: recorded 700 (recorded) vs rebuilt — (last bar closed 12:15 PM ET), delta — · missing inputs: `price:NFLX@swap`',
      '    - missing inputs: `exitPrice`',
      '    - missing inputs: `price:MSFT@swap`, `price:NFLX@swap`',
    ]) expect(lines, line).toContain(line);
  });
});

// ── BA-48 (Amendment E — AD4-10 resolved) ────────────────────────────────────

describe('BA-48 — the rescore and the inputs part are derived; every reader labels by the tape\'s own declaration', () => {
  const RESCORE = 'actions[].replay.reconciliation.soldAtSale.rescoredAtRecordedPx';
  const INPUTS = 'actions[].replay.reconciliation.soldAtSale.inputsDelta';

  it('BA-48: a tape the passes write now declares both derived, and the price part, the gap and the bar price keep their classes', async () => {
    const { fx, t } = await enrichedDay();
    const tape = tapeOf(t, fx.battleId);
    expect(tape.numberClasses[RESCORE]).toBe('derived');
    expect(tape.numberClasses[INPUTS]).toBe('derived');
    expect(tape.numberClasses['actions[].replay.reconciliation.soldAtSale.priceDelta']).toBe('rebuilt');
    expect(tape.numberClasses['actions[].replay.reconciliation.soldAtSale.pxDelta']).toBe('rebuilt');
    expect(tape.numberClasses['actions[].replay.reconciliation.soldAtSale.rebuiltPx']).toBe('market');
    expect(tape.numberClasses['actions[].replay.gapPoints']).toBe('rebuilt');
    const leaves = numbersWithClasses(tape, tape.numberClasses).filter((n) => n.path.includes('soldAtSale'));
    expect(leaves.length).toBeGreaterThan(0);
    for (const n of leaves.filter((x) => ['rescoredAtRecordedPx', 'inputsDelta'].includes(x.path.at(-1)))) expect(n.cls, formatNumberPath(n.path)).toBe('derived');
  });

  it('BA-48 GUARD: a tape stored with the earlier declaration keeps it — the read-out labels those two numbers rebuilt, by the document, not by the code', async () => {
    const { fx, t } = await enrichedDay();
    const now = tapeOf(t, fx.battleId);
    const before = { ...now, numberClasses: { ...now.numberClasses, [RESCORE]: 'rebuilt', [INPUTS]: 'rebuilt' } };
    const s = now.actions.find((a) => a.replay).replay.reconciliation.soldAtSale;
    const mdNow = formatTapeMarkdown(now, []);
    const mdBefore = formatTapeMarkdown(before, []);
    expect(mdNow).toContain(`rescored at the recorded exit ${s.rescoredAtRecordedPx} (derived) · inputsDelta ${s.inputsDelta} (derived)`);
    expect(mdBefore).toContain(`rescored at the recorded exit ${s.rescoredAtRecordedPx} (rebuilt) · inputsDelta ${s.inputsDelta} (rebuilt)`);
    expect(mdBefore).not.toContain('UNCLASSIFIED');
  });
});
