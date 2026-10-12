// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomStudy.replay.writer.jsdom.test.jsx
//
// Amendment E addendum 3, R11 — THE REPLAY SENTENCE ONLY BESIDE A DRAWN
// REPLAY, writer to screen. Each day is the REAL close pass (writeTapeDay) and,
// where the case has one, the REAL candle pass (runCandlePass) over the Sep-23
// fixture's source records:
//   (a) the close pass only (the night before the candle pass): every card
//       says "No replay for this swap." with the day's replay coverage note,
//       alone — no sentence;
//   (b) outside the candle window (no candle pass will run): the same, with
//       that note — its "10-trading-day" digits the tape's own (R1, bound);
//   (c) a crypto leg (BA-3): its card says so ONCE, in the screen's words from
//       the row's stored replayReason — no sentence, no second wording;
//   (d) the candle-written replays: each drawn, each with its stored label
//       verbatim, bound to its path (R9);
//   (e) a replay written but with nothing to draw (both legs' bars missing):
//       no sentence beside it.
// A written replay without a stored label shows the screen's R9 sentence
// (FilmRoomStudy.jsdom.test.jsx; the writer always stores one).
// Astra F1 (the last block): DRAWN means visible geometry. Sparse bars leave
// isolated samples — each drawn as a ring at its own place, never joined
// across the gap — and the sentence, each path's label and the legend follow
// what was emitted, path by path; a path that emits nothing has no label.
// R15 (Amendment E addendum 6, the R15 block): a path is drawn only with a
// mark at an instant AFTER the sale. The point at the sale itself (the swap
// path's banked opening, the sold name's value at the sale) never draws a
// card, or a path, on its own; on a drawn path it stays. The legend calls the
// rings "dots", never "points" (the screen's word for score).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL passes, never mocked;
// only the writer flag is mocked on (spreading the real module).

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React from 'react';

vi.mock('../../config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
}));

import { createHash } from 'node:crypto';
import FilmRoomStudy from './FilmRoomStudy';
import { C } from './FilmRoomKit';
import { REPLAY_SENTENCE } from './filmRoomCopy';
import { sep23Day, sep23Bars, buildTapeDay, SEP23_NIGHT, SEP23_MORNING } from '../../../api/_utils/filmTape/__fixtures__/screenFixtures.js';
import { seedDay, OWNER } from '../../../api/_utils/filmTape/__fixtures__/tapeFixtures.js';
import { makeTapeDb } from '../../../api/_utils/filmTape/__fixtures__/tapeFirestore.js';
import { writeTapeDay } from '../../../api/_utils/filmTape/writeTapeDay.js';
import { runCandlePass } from '../../../api/_utils/filmTape/candlePass.js';
import { fetcherOf } from '../../../api/_utils/filmTape/__fixtures__/tapeBars.js';
import { mounter, sweepNumbers, sweepWords, sweepSigns, quoteDefects, storedNoteDefects } from './__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 90_000, hookTimeout: 120_000 });

const m = mounter();
beforeEach(() => m.setup());
afterEach(() => m.teardown());

/** The close pass alone, at `night` — buildTapeDay's first step, with no candle pass after it. */
async function closePassOnly(fx, night) {
  const store = seedDay({}, fx);
  for (const v of fx.intradayViews || []) store[`agentBattles/${fx.battleId}/intradayViews/${v.id}`] = { evaluatedAt: v.evaluatedAt, ownerId: OWNER };
  const t = makeTapeDb(store);
  await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: night });
  return t.store.get(`agentBattles/${fx.battleId}/tape/${fx.etDate}`);
}

/** The Sep-23 day with swap 3 (ETN → PANW) made a crypto leg (BTC → PANW), as writeTapeDay.test.js makes one. */
async function cryptoDay() {
  const fx = await sep23Day();
  const k = fx.battle.trades.findIndex((t) => t.symbolOut === 'ETN');
  fx.battle.trades[k] = { ...fx.battle.trades[k], symbolOut: 'BTC', name: 'BTC', isCrypto: true };
  fx.ticks = fx.ticks.map((t) => (t.tickSeq === 20 ? { ...t, actions: [{ ...t.actions[0], symbolOut: 'BTC' }] } : t));
  fx.receipts[k] = { ...fx.receipts[k], symbolOut: 'BTC' };
  return fx;
}

/** The Sep-23 day with swap 3 (ETN → PANW) traded in support slot 1 too — the slot swap 1 (MSFT → CRWD) traded first. */
async function slotTwiceDay() {
  const fx = await sep23Day();
  const k = fx.battle.trades.findIndex((t) => t.symbolOut === 'ETN');
  fx.battle.trades[k] = { ...fx.battle.trades[k], tier: 'support', slotIndex: 1 };
  fx.receipts[k] = { ...fx.receipts[k], resolvedTier: 'support', resolvedSlotIndex: 1 };
  return fx;
}

/**
 * A day that GREW after its candle pass: the close and candle passes run on the Sep-23 sources without swap 3, then
 * swap 3's sources arrive and the close pass runs again at `secondNight` (its re-merge of a written day).
 */
async function grownDay(secondNight) {
  const full = await sep23Day();
  const less = await sep23Day();
  less.battle.trades = less.battle.trades.filter((t) => t.symbolOut !== 'ETN');
  less.receipts = less.receipts.filter((r) => r.symbolOut !== 'ETN');
  less.ticks = less.ticks.map((t) => (t.tickSeq === 20 ? { ...t, actions: [] } : t));
  const store = seedDay({}, less);
  for (const v of less.intradayViews || []) store[`agentBattles/${less.battleId}/intradayViews/${v.id}`] = { evaluatedAt: v.evaluatedAt, ownerId: OWNER };
  const t = makeTapeDb(store);
  await writeTapeDay(less.battleId, less.etDate, { db: t.db, now: SEP23_NIGHT });
  await runCandlePass({ db: t.db, fetchCandles: fetcherOf(sep23Bars()).fetchCandles, clock: () => SEP23_MORNING, startMs: SEP23_MORNING });
  for (const [key, v] of Object.entries(seedDay({}, full))) t.store.set(key, JSON.parse(JSON.stringify(v)));
  await writeTapeDay(full.battleId, full.etDate, { db: t.db, now: secondNight });
  return t.store.get(`agentBattles/${full.battleId}/tape/${full.etDate}`);
}

/** The Sep-23 bars with the named symbols' 1-minute bars cut to the minutes STARTING at the given instants. */
const LAST_MINUTE = '2026-09-23T19:59:00Z';   // the session's last minute: its bar is the close's sample
const FIRST_MINUTE = '2026-09-23T13:30:00Z';  // the session's first minute: stale at every sample of swap 1
const SALE_MINUTE = '2026-09-23T16:44:00Z';   // the minute that closed at swap 1's sale (12:45:08 PM ET): fresh there, stale after
function sparseBars(keep) {
  const bars = sep23Bars();
  for (const [sym, starts] of Object.entries(keep)) bars[sym] = bars[sym].filter((row) => starts.some((s) => row.timestamp * 1000 === Date.parse(s)));
  return bars;
}

const OUTSIDE_NIGHT = Date.parse('2026-10-20T02:15:30.000Z');   // four weeks on: the Sep-23 day is outside the candle window
const days = {};
beforeAll(async () => {
  days.twiceClose = await closePassOnly(await slotTwiceDay(), SEP23_NIGHT);
  days.cryptoClose = await closePassOnly(await cryptoDay(), SEP23_NIGHT);
  const oneLegBars = sep23Bars();
  delete oneLegBars.MSFT;   // swap 1's SOLD name only: its hold leg has no bars, its swap leg (CRWD) does
  days.oneLeg = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: oneLegBars })).tape;
  const otherLegBars = sep23Bars();
  delete otherLegBars.CRWD;   // swap 1's BOUGHT name only: its swap leg has no bars, its hold leg (MSFT) does
  days.otherLeg = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: otherLegBars })).tape;
  days.twiceFull = (await buildTapeDay(await slotTwiceDay(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sep23Bars() })).tape;
  days.grownIn = await grownDay(Date.parse('2026-09-25T02:15:30.000Z'));
  days.grownOut = await grownDay(OUTSIDE_NIGHT);
  days.closeOnly = await closePassOnly(await sep23Day(), SEP23_NIGHT);
  days.outside = await closePassOnly(await sep23Day(), OUTSIDE_NIGHT);
  days.crypto = (await buildTapeDay(await cryptoDay(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sep23Bars() })).tape;
  days.full = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sep23Bars() })).tape;
  const bars = sep23Bars();
  delete bars.MSFT;
  delete bars.CRWD;   // swap 1's two legs: the candle pass writes their replay with nothing to draw
  days.undrawn = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars })).tape;
  // Astra F1's repro: swap 1's two legs keep only the minute that starts at 3:59 PM ET — isolated samples, no segment
  days.points = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: [LAST_MINUTE], CRWD: [LAST_MINUTE] }) })).tape;
  // the sold leg without bars, the bought leg sparse: the hold path emits nothing, the swap path only points
  const pointsOneLeg = sparseBars({ CRWD: [LAST_MINUTE] });
  delete pointsOneLeg.MSFT;
  days.pointsOneLeg = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: pointsOneLeg })).tape;
  // the sold leg's only bar the session's first minute: every sample after the swap is stale — a hold path of nulls
  days.holdStale = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: ['2026-09-23T13:30:00Z'] }) })).tape;
  // both legs' only bar the session's first minute: no sample after the sale is fresh — the swap path's opening sample
  // (the banked points at the sale, tapeReplay.js composeLegs) is the replay's one placeable value (review A2G1-1)
  days.saleOnly = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: ['2026-09-23T13:30:00Z'], CRWD: ['2026-09-23T13:30:00Z'] }) })).tape;
  // a slot traded twice, the bought leg's bars deleted: a hypothetical replay drawn on the hold path alone (review A2GV-2)
  const holdOnly = sep23Bars();
  delete holdOnly.CRWD;
  days.twiceHoldOnly = (await buildTapeDay(await slotTwiceDay(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: holdOnly })).tape;
  // a slot traded twice, its swap 1 cut to the 3:59 PM minute: a hypothetical replay drawn as points only (review A2G1-4)
  days.twicePoints = (await buildTapeDay(await slotTwiceDay(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: [LAST_MINUTE], CRWD: [LAST_MINUTE] }) })).tape;
  // the bought leg's bars before the two checks after the swap, and the close's: a segment and an isolated point on one path
  days.mixed = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ CRWD: ['2026-09-23T16:59:00Z', '2026-09-23T17:14:00Z', LAST_MINUTE] }) })).tape;
  // R15: both legs fresh AT the sale (the minute that closed at 12:45 PM ET, before the 12:45:08 swap) and stale after
  // it — the hold path's value at the sale and the swap path's banked opening, and nothing after
  days.saleFresh = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: [SALE_MINUTE], CRWD: [SALE_MINUTE] }) })).tape;
  // R15: one reading after the sale, on either path — the bought leg's close (the swap path: its opening and its close)…
  days.afterOnSwap = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: [FIRST_MINUTE], CRWD: [LAST_MINUTE] }) })).tape;
  // …or the sold leg's close (the hold path), the swap path left with its opening alone
  days.afterOnHold = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: [LAST_MINUTE], CRWD: [FIRST_MINUTE] }) })).tape;
  // R15: the sold leg full, the bought leg stale after the sale — a full hold line beside a swap path of its opening alone
  days.swapStale = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ CRWD: [FIRST_MINUTE] }) })).tape;
});

const mount = (tape, desktop = false) => m.render(<FilmRoomStudy tape={tape} desktop={desktop} selected={null} onSelect={() => {}} onDeep={() => {}} jump={() => {}} />);
const card = (i) => m.q(`[data-swap-card="${i}"]`);
const cards = () => m.qa('[data-swap-card]');
function swept(tape) {
  const docs = { tape };
  return { numbers: sweepNumbers(m.container, docs), words: sweepWords(m.container, docs), signs: sweepSigns(m.container), quotes: quoteDefects(m.container, docs), notes: storedNoteDefects(m.container, docs) };
}
const CLEAN = { numbers: [], words: [], signs: [], quotes: [], notes: [] };

describe('R11 — the replay sentence only beside a drawn replay (writer to screen)', () => {
  it('(a) the close pass only: every card shows its replay coverage line alone — "No replay for this swap. · awaiting the candle pass", no sentence', () => {
    const tape = days.closeOnly;
    expect(tape.passes.candles?.status ?? null).not.toBe('written');
    expect(tape.actions.map((a) => a.replay)).toEqual([null, null, null]);
    expect(tape.coverage.replay.note).toBe('awaiting the candle pass');
    for (const desktop of [false, true]) {
      mount(tape, desktop);
      expect(cards()).toHaveLength(3);
      for (const c of cards()) {
        expect(c.querySelector('[data-replay-none="not-written"]').textContent).toBe('No replay for this swap. · awaiting the candle pass');
        expect(c.querySelector('[data-replay-none] [data-stored-note]').getAttribute('data-stored-note')).toBe('coverage.replay.note');
        expect(c.querySelector('[data-replay-sentence]')).toBeNull();
        expect(c.textContent).not.toContain(REPLAY_SENTENCE);
        expect(c.textContent).not.toMatch(/hypothetical through the day's close/);
        // the split groups say so too — never another replay's words (review A2F3-2)
        expect([...c.querySelectorAll('[data-split-missing]')].map((s) => s.textContent)).toEqual(['No replay for this swap.', 'No replay for this swap.']);
      }
      expect(swept(tape), desktop ? 'desktop' : 'phone').toEqual(CLEAN);
    }
  });

  it('(c′) review A2F3-3: a crypto leg on the close pass\'s night — its card gives the row\'s own reason, never "awaiting the candle pass" (a crypto leg is never replayed)', () => {
    const tape = days.cryptoClose;
    const k = tape.actions.findIndex((a) => a.symbolOut === 'BTC');
    expect(tape.actions[k]).toMatchObject({ replayReason: 'crypto_not_supported', replay: null });
    expect(tape.passes.candles.writtenAt ?? null).toBeNull();
    expect(tape.coverage.replay.note).toBe('awaiting the candle pass');
    mount(tape);
    expect(card(k).querySelector('[data-replay-none="crypto"]').textContent).toBe('No replay for this swap. · crypto legs are not replayed');
    expect(card(k).textContent).not.toContain('awaiting the candle pass');
    for (const i of tape.actions.map((_, j) => j).filter((j) => j !== k)) expect(card(i).querySelector('[data-replay-none="not-written"]').textContent, `card ${i}`).toBe('No replay for this swap. · awaiting the candle pass');
    expect(swept(tape)).toEqual(CLEAN);
  });

  it('(b) outside the candle window: the same, with that note — its digits the tape\'s own words, bound to their path', () => {
    const tape = days.outside;
    expect(tape.coverage.replay.note).toBe('no candle pass is scheduled for this day (outside the 10-trading-day window)');
    mount(tape);
    for (const c of cards()) {
      expect(c.querySelector('[data-replay-none="not-written"]').textContent).toBe(`No replay for this swap. · ${tape.coverage.replay.note}`);
      expect(c.querySelector('[data-replay-sentence]')).toBeNull();
    }
    expect(swept(tape)).toEqual(CLEAN);
  });

  it('(c) a crypto leg: its card says so ONCE, from the row\'s stored reason — no sentence, no second wording; the other cards keep their drawn replays', () => {
    const tape = days.crypto;
    const k = tape.actions.findIndex((a) => a.symbolOut === 'BTC');
    expect(tape.actions[k]).toMatchObject({ replayReason: 'crypto_not_supported', replay: null });
    expect(tape.coverage.replay.note).toMatch(/1 crypto leg\(s\) not replayed/);   // the day's note names it too — at the section's head
    mount(tape);
    const c = card(k);
    expect(c.querySelector('[data-replay-none="crypto"]').textContent).toBe('No replay for this swap. · crypto legs are not replayed');
    expect(c.textContent.match(/crypto/gi)).toHaveLength(1);
    expect([...c.querySelectorAll('[data-split-missing]')].map((s) => s.textContent)).toEqual(['No replay for this swap.', 'No replay for this swap.']);   // A2FV3-2
    expect(c.querySelector('[data-replay-sentence]')).toBeNull();
    expect(c.querySelector('[data-stored-note="coverage.replay.note"]')).toBeNull();
    // the day's replay coverage line, once, at the section's head
    expect(m.qa('[data-coverage-of="replay"]')).toHaveLength(1);
    expect(m.q('[data-coverage-of="replay"]').textContent).toContain('1 crypto leg(s) not replayed');
    for (const i of tape.actions.map((_, j) => j).filter((j) => j !== k)) {
      expect(card(i).querySelector('[data-replay-sentence] [data-stored-note]').textContent, `card ${i}`).toBe(tape.actions[i].replay.label);
    }
    expect(swept(tape)).toEqual(CLEAN);
  });

  it('(d) the candle-written replays: each drawn, each with its stored label verbatim beside it, bound to its own path', () => {
    const tape = days.full;
    mount(tape);
    tape.actions.forEach((a, i) => {
      expect(card(i).querySelector('[data-line="hold"]').getAttribute('d'), `card ${i}`).toMatch(/^M/);
      const note = card(i).querySelector('[data-replay-sentence] [data-stored-note]');
      expect([note.getAttribute('data-stored-note'), note.textContent]).toEqual([`actions[${i}].replay.label`, a.replay.label]);
      expect(card(i).querySelector('[data-replay-none]')).toBeNull();
    });
    expect(swept(tape)).toEqual(CLEAN);
  });

  it('(e) a replay written with nothing to draw (both legs\' bars missing): no sentence beside it; the drawn cards keep theirs', () => {
    const tape = days.undrawn;
    const k = tape.actions.findIndex((a) => a.symbolOut === 'MSFT');
    const r = tape.actions[k].replay;
    expect(r).not.toBeNull();   // written by the candle pass…
    expect(r.missingInputs).toEqual(expect.arrayContaining(['bars:MSFT', 'bars:CRWD']));
    const points = [r.holdPath, r.swapPath].flatMap((p) => (Array.isArray(p) ? p : [])).filter((p) => Number.isFinite(p?.points));
    expect(points).toEqual([]);   // …with no point to draw
    mount(tape);
    expect(card(k).querySelector('[data-replay-sentence]')).toBeNull();
    // a replay IS written: never "No replay for this swap." — its line says none was drawn, with its OWN stored reasons, bound (review A2F1-3)
    const line = card(k).querySelector('[data-replay-none="not-drawn"]');
    expect(line.textContent).toBe(`No replay drawn for this swap · missing: ${r.missingInputs.join(', ')}`);
    expect([...line.querySelectorAll('[data-stored-note]')].map((s) => s.getAttribute('data-stored-note'))).toEqual(r.missingInputs.map((_, j) => `actions[${k}].replay.missingInputs[${j}]`));
    expect(card(k).textContent).not.toContain('No replay for this swap.');
    // nothing describes lines that are not there: no fork, no path labels, no gap rows, no hypothetical tag
    for (const sel of ['[data-line]', '[data-path-label]', '[data-result-row="gap"]', '[data-result-row="closed-leg"]', '[data-hypothetical]']) expect(card(k).querySelector(sel), sel).toBeNull();
    for (const i of tape.actions.map((_, j) => j).filter((j) => j !== k)) expect(card(i).querySelector('[data-replay-sentence]'), `card ${i}`).toBeTruthy();
    expect(swept(tape)).toEqual(CLEAN);
  });

  it('(e′) review A2F3-4 / A2FV3-4: a replay with values on ONE leg — either one — shows its values, never "No replay drawn"', () => {
    const valued = (p) => (Array.isArray(p) ? p : []).some((x) => Number.isFinite(x?.points));
    for (const [tape, legs, leg] of [[days.oneLeg, [false, true], 'swap'], [days.otherLeg, [true, false], 'hold']]) {
      const k = tape.actions.findIndex((a) => a.symbolOut === 'MSFT');
      const r = tape.actions[k].replay;
      expect([valued(r.holdPath), valued(r.swapPath)], leg).toEqual(legs);
      mount(tape);
      expect(card(k).querySelector('[data-replay-none]'), leg).toBeNull();
      const path = leg === 'swap' ? r.swapPath : r.holdPath;
      expect(card(k).querySelector(`[data-path-label="${leg}"] [data-num="actions[${k}].replay.${leg}Path[${path.length - 1}].points"]`), leg).toBeTruthy();
      expect(swept(tape), leg).toEqual(CLEAN);
    }
  });

  it('(f) review A2F1-1: a slot traded twice — the "hypothetical" tag only beside a DRAWN replay: absent on the close pass\'s cards, present once the replay is drawn', () => {
    for (const [tape, drawnAlready] of [[days.twiceClose, false], [days.twiceFull, true]]) {
      expect(tape.actions[0].subsequentTradesInSlot).toBe(1);
      mount(tape);
      expect(Boolean(card(0).querySelector('[data-hypothetical]')), drawnAlready ? 'drawn' : 'close pass only').toBe(drawnAlready);
      if (!drawnAlready) expect(card(0).querySelector('[data-replay-none="not-written"]').textContent).toBe('No replay for this swap. · awaiting the candle pass');
      expect(swept(tape)).toEqual(CLEAN);
    }
  });

  it('(g) review A2F1-2: a swap that reached the tape after the candle pass (the close pass re-merging a grown day) — its card never carries the day\'s note, which opens with the one-step sentence; it points to the coverage line above', () => {
    for (const [tape, status] of [[days.grownIn, 'pending'], [days.grownOut, 'expired']]) {
      expect(tape.passes.candles.status, status).toBe(status);
      expect(tape.passes.candles.writtenAt, status).toBeTruthy();   // a candle pass HAS written this day's replay coverage
      expect(tape.coverage.replay.note, status).toMatch(/^one-step hypothetical/);
      const k = tape.actions.findIndex((a) => a.symbolOut === 'ETN');
      expect(tape.actions[k].replay, status).toBeNull();
      mount(tape);
      expect(card(k).querySelector('[data-replay-none="not-written"]').textContent, status).toBe('No replay for this swap. · the replay coverage line above says why');
      expect(card(k).textContent, status).not.toMatch(/hypothetical through the day's close/);
      expect(card(k).querySelector('[data-replay-sentence]'), status).toBeNull();
      expect([...card(k).querySelectorAll('[data-split-missing]')].map((s) => s.textContent), status).toEqual(['No replay for this swap.', 'No replay for this swap.']);   // A2FV3-2
      expect(m.q('[data-coverage-of="replay"] [data-stored-note="coverage.replay.note"]').textContent, status).toBe(tape.coverage.replay.note);
      expect(swept(tape), status).toEqual(CLEAN);
    }
  });
});

// ── Astra F1: drawn means visible geometry ──────────────────────────────────

/**
 * The oracle, from the STORED paths alone (never the screen's helpers): a sample is placeable when it has a value at a
 * recorded instant; a run of placeable samples with two or more is a segment, a run of one an isolated sample. Its
 * place on the fork: the fork's documented scale (the swap to the close across 0–100 %, the values padded by 15 %).
 */
const placeable = (p) => Number.isFinite(p?.points) && Number.isFinite(Date.parse(p?.at));
function runsOf(list) {
  const out = []; let run = null;
  for (const p of Array.isArray(list) ? list : []) { if (!placeable(p)) { run = null; continue; } if (!run) { run = []; out.push(run); } run.push(p); }
  return out;
}
const isolatedOf = (list) => runsOf(list).filter((r) => r.length === 1).map((r) => r[0]);
const segmentsOf = (list) => runsOf(list).filter((r) => r.length > 1);
function placeOf(replay) {
  const all = [...(replay.holdPath || []), ...(replay.swapPath || [])];
  const ts = all.map((p) => Date.parse(p.at)).filter(Number.isFinite);
  const vs = all.map((p) => p.points).filter(Number.isFinite);
  const [t0, t1] = [Math.min(...ts), Math.max(...ts)];
  const span = Math.max(2, Math.max(...vs) - Math.min(...vs));
  const [lo, hi] = [Math.min(...vs) - span * 0.15, Math.max(...vs) + span * 0.15];
  return { xPct: (at) => ((Date.parse(at) - t0) / Math.max(1, t1 - t0)) * 100, y: (v) => 8 + ((hi - v) / (hi - lo)) * (112 - 16) };
}
/** A glyph's centre as the page places it: `left: calc(X% - r px)`, `top: y - r`. */
const glyphAt = (g) => ({ xPct: Number(g.style.left.match(/^calc\(([\d.]+)% - 3\.5px\)$/)[1]), y: parseFloat(g.style.top) + 3.5 });
const LEGENDS = ['dashed · rebuilt from 1-minute bars', 'dots · rebuilt from 1-minute bars', 'dashed lines and dots · rebuilt from 1-minute bars'];
/** The card's legend line: the words beside the fork's own rebuilt marker (the one outside every marked number). */
const legendOf = (c) => { const k = [...c.querySelectorAll('[data-kind-mark="rebuilt"]')].filter((x) => !x.closest('[data-num]')); return k.length === 1 ? k[0].previousElementSibling.textContent : `${k.length} legends`; };
/** Every replay word a card can carry — none may stand where nothing is drawn. */
const REPLAY_WORDS = ['Hold path', 'Swap path', 'dashed', 'dots · rebuilt', 'hypothetical through the day', REPLAY_SENTENCE];

describe('Astra F1 — a replay is drawn only when it emits visible geometry: a dashed segment, or a ring at an isolated sample', () => {
  it('Astra\'s repro (swap 1\'s legs cut to the 3:59 PM minute, the real passes): a ring at every isolated sample, where it lies; nothing joined; the sentence, both labels and a dots legend — still drawn under R15 (each path\'s close is after the sale)', () => {
    const tape = days.points;
    const k = tape.actions.findIndex((a) => a.symbolOut === 'MSFT');
    const r = tape.actions[k].replay;
    // the stored replay: isolated samples only — the hold path's close, the swap path's sale and close
    expect([isolatedOf(r.holdPath).length, isolatedOf(r.swapPath).length, segmentsOf(r.holdPath).length, segmentsOf(r.swapPath).length]).toEqual([1, 2, 0, 0]);
    const place = placeOf(r);
    for (const desktop of [false, true]) {
      const w = desktop ? 'desktop' : 'phone';
      mount(tape, desktop);
      const c = card(k);
      // no segment is emitted, and none is fabricated across the gaps
      expect(c.querySelector('[data-line]'), w).toBeNull();
      for (const [leg, list] of [['hold', r.holdPath], ['swap', r.swapPath]]) {
        const glyphs = [...c.querySelectorAll(`[data-fork-point="${leg}"]`)];
        const want = isolatedOf(list);
        expect(glyphs, `${w} ${leg}`).toHaveLength(want.length);
        glyphs.forEach((g, j) => {
          const at = glyphAt(g);
          expect(Math.abs(at.xPct - place.xPct(want[j].at)), `${w} ${leg} ${j} x`).toBeLessThan(0.02);
          expect(Math.abs(at.y - place.y(want[j].points)), `${w} ${leg} ${j} y`).toBeLessThan(0.06);
          // a visible mark: a 7 px ring with a solid stroke of real width (its fill is the card's own surface, so the stroke
          // is all that shows — review A2GV-1), inside the fork's own region
          expect([g.style.width, g.style.height, g.style.borderStyle || g.style.border.split(' ')[1]], `${w} ${leg} ${j}`).toEqual(['7px', '7px', 'solid']);
          expect(parseFloat(g.style.borderWidth || g.style.border), `${w} ${leg} ${j} stroke`).toBeGreaterThanOrEqual(1);
          expect(g.closest(`[data-region="fork-${k}"]`)).toBeTruthy();
          expect(g.getAttribute('aria-hidden')).toBe('true');
        });
      }
      // one condition for everything: both paths drew, so both labels — each with a ring swatch, never a dashed one
      for (const leg of ['hold', 'swap']) {
        const label = c.querySelector(`[data-path-label="${leg}"]`);
        expect(label, `${w} ${leg}`).toBeTruthy();
        expect(label.querySelector('[data-swatch="point"]'), `${w} ${leg}`).toBeTruthy();
        expect(label.querySelector('svg line'), `${w} ${leg}`).toBeNull();
      }
      expect(legendOf(c), w).toBe('dots · rebuilt from 1-minute bars');
      expect(c.textContent, w).not.toMatch(/dashed/);
      expect(c.querySelector('[data-replay-sentence] [data-stored-note]').textContent, w).toBe(r.label);
      expect(c.querySelector('[data-replay-none]'), w).toBeNull();
      if (desktop) expect([...c.querySelectorAll('[data-fork-end]')].map((e) => e.getAttribute('data-fork-end'))).toEqual(['hold', 'swap']);
      expect(swept(tape), w).toEqual(CLEAN);
    }
  });

  it('a path that emits nothing has no label, no end value and no swatch — path by path (a sold leg without bars or with only stale ones, a bought leg without bars; and a swap path of nulls)', () => {
    // The writer's swap path, when it exists, always opens at the sale with the points the sale banked — so a swap
    // path that is a LIST and draws nothing is planted: every point of the full day's swap 1 nulled.
    const swapNulls = JSON.parse(JSON.stringify(days.full));
    for (const p of swapNulls.actions[0].replay.swapPath) p.points = null;
    for (const [name, tape, silent] of [['pointsOneLeg', days.pointsOneLeg, 'hold'], ['oneLeg', days.oneLeg, 'hold'], ['holdStale', days.holdStale, 'hold'], ['otherLeg', days.otherLeg, 'swap'], ['swapNulls', swapNulls, 'swap']]) {
      const k = tape.actions.findIndex((a) => a.symbolOut === 'MSFT');
      const r = tape.actions[k].replay;
      const live = silent === 'hold' ? 'swap' : 'hold';
      if (['holdStale', 'swapNulls'].includes(name)) expect(r[`${silent}Path`].length, name).toBeGreaterThan(1);   // a list of samples…
      expect(runsOf(r[`${silent}Path`]), name).toEqual([]);   // …none placeable: the silent path has no placeable sample
      expect(runsOf(r[`${live}Path`]).length, name).toBeGreaterThan(0);
      for (const desktop of [false, true]) {
        const w = `${name} ${desktop ? 'desktop' : 'phone'}`;
        mount(tape, desktop);
        const c = card(k);
        expect(c.querySelector(`[data-path-label="${silent}"]`), w).toBeNull();
        expect(c.querySelector(`[data-line="${silent}"], [data-fork-point="${silent}"], [data-fork-end="${silent}"]`), w).toBeNull();
        expect(c.textContent, w).not.toContain(silent === 'hold' ? 'Hold path' : 'Swap path');
        expect(c.querySelector(`[data-path-label="${live}"]`) || c.querySelector(`[data-fork-end="${live}"]`), w).toBeTruthy();
        expect(c.querySelector('[data-replay-sentence]'), w).toBeTruthy();
        expect(swept(tape), w).toEqual(CLEAN);
      }
    }
    // the legend reads what the drawn path drew, whichever path it is (review A2G1-4): the sparse leg's dots; a full
    // leg's dashed line — the swap path's alone, or the hold path's alone
    for (const [tape, want] of [[days.pointsOneLeg, 'dots · rebuilt from 1-minute bars'], [days.oneLeg, 'dashed · rebuilt from 1-minute bars'], [days.otherLeg, 'dashed · rebuilt from 1-minute bars']]) {
      mount(tape);
      expect(legendOf(card(0))).toBe(want);
    }
  });

  it('review A2G1-4: each path in its own colour — its ring, its ring swatch and its dashed swatch (hold ink, swap teal)', () => {
    const colour = { hold: C.ink2, swap: C.teal };
    for (const tape of [days.points, days.mixed, days.full]) {
      mount(tape);
      const c = card(0);
      for (const leg of ['hold', 'swap']) {
        for (const g of c.querySelectorAll(`[data-fork-point="${leg}"]`)) expect(g.style.border, `${leg} ring`).toContain(colour[leg]);
        const label = c.querySelector(`[data-path-label="${leg}"]`);
        const ringSwatch = label.querySelector('[data-swatch="point"]');
        if (ringSwatch) expect(ringSwatch.style.border, `${leg} ring swatch`).toContain(colour[leg]);
        const dashSwatch = label.querySelector('svg line');
        if (dashSwatch) expect(dashSwatch.style.stroke, `${leg} dashed swatch`).toBe(colour[leg]);
        const line = c.querySelector(`[data-line="${leg}"]`);
        if (line) expect(line.style.stroke, `${leg} line`).toBe(colour[leg]);
      }
    }
  });

  it('review A2G1-4: a slot traded twice whose replay is drawn as dots only — the hypothetical tag and its count stand beside it', () => {
    const tape = days.twicePoints;
    const r = tape.actions[0].replay;
    expect(tape.actions[0].subsequentTradesInSlot).toBe(1);
    expect([segmentsOf(r.holdPath).length + segmentsOf(r.swapPath).length, isolatedOf(r.holdPath).length + isolatedOf(r.swapPath).length]).toEqual([0, 3]);
    mount(tape);
    expect(card(0).querySelectorAll('[data-fork-point]')).toHaveLength(3);
    expect(card(0).querySelector('[data-hypothetical] [data-num]').getAttribute('data-num')).toBe('actions[0].subsequentTradesInSlot');
    expect(swept(tape)).toEqual(CLEAN);
    // review A2GV-2: the same slot with only its hold path drawn (the bought leg's bars deleted) keeps the tag too
    const hold = days.twiceHoldOnly;
    expect([runsOf(hold.actions[0].replay.holdPath).length > 0, hold.actions[0].replay.swapPath]).toEqual([true, null]);
    mount(hold);
    expect(card(0).querySelector('[data-path-label="swap"]')).toBeNull();
    expect(card(0).querySelector('[data-hypothetical] [data-num]').getAttribute('data-num')).toBe('actions[0].subsequentTradesInSlot');
    expect(swept(hold)).toEqual(CLEAN);
  });

  it('R15, the refuter\'s case (review A2G1-1, turned around): both stocks with only stale bars after the sale — the sale point alone draws nothing: "No replay drawn", its stored reasons, and no fork, ring, label, legend, sentence or end tag', () => {
    // saleOnly: both legs' only bar the session's first minute (the refuter's repro, build report §10.5) — the swap
    // path's banked opening is the one value; saleFresh: both legs fresh AT the sale — the hold path's value at the
    // sale too. Either way nothing is placed after the sale.
    for (const [name, tape, holdAtSale] of [['saleOnly', days.saleOnly, false], ['saleFresh', days.saleFresh, true]]) {
      const k = tape.actions.findIndex((a) => a.symbolOut === 'MSFT');
      const a = tape.actions[k];
      const r = a.replay;
      expect([r.holdPath.length, r.swapPath.length], name).toEqual([14, 14]);   // two paths of samples, written…
      expect(runsOf(r.swapPath), name).toEqual([[r.swapPath[0]]]);   // …the swap path's opening sample only…
      expect([r.swapPath[0].at, r.swapPath[0].points], name).toEqual([a.at, a.lockedPoints]);   // …the banked points at the sale
      expect(runsOf(r.holdPath), name).toEqual(holdAtSale ? [[r.holdPath[0]]] : []);   // the hold path: its value at the sale, or none
      if (holdAtSale) expect([r.holdPath[0].at, Number.isFinite(r.holdPath[0].points)], name).toEqual([a.at, true]);
      for (const desktop of [false, true]) {
        const w = `${name} ${desktop ? 'desktop' : 'phone'}`;
        mount(tape, desktop);
        const c = card(k);
        const line = c.querySelector('[data-replay-none="not-drawn"]');
        expect(line.textContent, w).toBe(`No replay drawn for this swap · missing: ${r.missingInputs.join(', ')}`);
        expect([...line.querySelectorAll('[data-stored-note]')].map((s) => s.getAttribute('data-stored-note')), w).toEqual(r.missingInputs.map((_, j) => `actions[${k}].replay.missingInputs[${j}]`));
        expect(c.querySelector('[data-fork-row], [data-line], [data-fork-point], [data-swatch], [data-path-label], [data-fork-end], [data-replay-sentence], [data-hypothetical], [data-result-row="gap"], [data-result-row="closed-leg"]'), w).toBeNull();
        expect(legendOf(c), w).toBe('0 legends');
        for (const words of [...REPLAY_WORDS, ...LEGENDS]) expect(c.textContent, `${w} ${words}`).not.toContain(words);
        expect(card(1).querySelector('[data-replay-sentence]'), w).toBeTruthy();   // the other cards keep theirs
        expect(swept(tape), w).toEqual(CLEAN);
      }
    }
  });

  it('R15: one reading after the sale — the card is drawn, with the dots legend; the sale point stays part of its path', () => {
    const tape = days.afterOnSwap;
    const k = tape.actions.findIndex((a) => a.symbolOut === 'MSFT');
    const a = tape.actions[k];
    const r = a.replay;
    expect(runsOf(r.holdPath)).toEqual([]);
    expect(runsOf(r.swapPath)).toEqual([[r.swapPath[0]], [r.swapPath[r.swapPath.length - 1]]]);   // the opening, and the close…
    expect(Date.parse(r.swapPath[r.swapPath.length - 1].at)).toBeGreaterThan(Date.parse(a.at));   // …after the sale
    for (const desktop of [false, true]) {
      const w = desktop ? 'desktop' : 'phone';
      mount(tape, desktop);
      const c = card(k);
      expect(c.querySelector('[data-replay-none]'), w).toBeNull();
      expect(c.querySelector('[data-line]'), w).toBeNull();
      // both swap rings: the sale's at the fork's left edge, still part of its drawn path, and the close's at the right
      expect([...c.querySelectorAll('[data-fork-point]')].map((g) => [g.getAttribute('data-fork-point'), glyphAt(g).xPct]), w).toEqual([['swap', 0], ['swap', 100]]);
      expect([Boolean(c.querySelector('[data-path-label="hold"]')), Boolean(c.querySelector('[data-path-label="swap"] [data-swatch="point"]'))], w).toEqual([false, true]);
      expect(legendOf(c), w).toBe('dots · rebuilt from 1-minute bars');
      expect(c.querySelector('[data-replay-sentence] [data-stored-note]').textContent, w).toBe(r.label);
      if (desktop) expect([...c.querySelectorAll('[data-fork-end]')].map((e) => e.getAttribute('data-fork-end')), w).toEqual(['swap']);
      expect(swept(tape), w).toEqual(CLEAN);
    }
  });

  it('R15: a path whose only mark is at the sale draws nothing beside a drawn path — no ring, label, swatch or end tag for it, as for its bars-deleted twin', () => {
    // afterOnHold: the hold path's close is its one reading after the sale; the swap path keeps only its banked
    // opening. swapStale: a full hold line beside the same opening-only swap path. otherLeg (the bought leg's bars
    // deleted, no swap path written): the twin both must read like.
    for (const [name, tape, legend] of [['afterOnHold', days.afterOnHold, 'dots · rebuilt from 1-minute bars'], ['swapStale', days.swapStale, 'dashed · rebuilt from 1-minute bars'], ['otherLeg', days.otherLeg, 'dashed · rebuilt from 1-minute bars']]) {
      const k = tape.actions.findIndex((a) => a.symbolOut === 'MSFT');
      const a = tape.actions[k];
      const r = a.replay;
      if (name === 'otherLeg') expect(r.swapPath, name).toBeNull();
      else expect(runsOf(r.swapPath), name).toEqual([[r.swapPath[0]]]);   // the banked opening alone
      expect(runsOf(r.holdPath).flat().some((p) => Date.parse(p.at) > Date.parse(a.at)), name).toBe(true);   // the hold path reaches past the sale
      for (const desktop of [false, true]) {
        const w = `${name} ${desktop ? 'desktop' : 'phone'}`;
        mount(tape, desktop);
        const c = card(k);
        expect(c.querySelector('[data-replay-none]'), w).toBeNull();
        expect(c.querySelector('[data-path-label="swap"], [data-line="swap"], [data-fork-point="swap"], [data-fork-end="swap"]'), w).toBeNull();
        expect(c.textContent, w).not.toContain('Swap path');
        expect(c.querySelector('[data-path-label="hold"]'), w).toBeTruthy();
        expect(c.querySelector('[data-line="hold"], [data-fork-point="hold"]'), w).toBeTruthy();
        expect(legendOf(c), w).toBe(legend);   // never "and dots" for a ring that is not there
        expect(c.querySelector('[data-replay-sentence] [data-stored-note]').textContent, w).toBe(r.label);
        if (desktop) expect([...c.querySelectorAll('[data-fork-end]')].map((e) => e.getAttribute('data-fork-end')), w).toEqual(['hold']);
        expect(swept(tape), w).toEqual(CLEAN);
      }
    }
  });

  it('R15, planted: a swap whose sale instant is not recorded — no mark can be shown after it, so the no-drawn treatment', () => {
    const tape = JSON.parse(JSON.stringify(days.full));
    tape.actions[0].at = null;   // planted: the writer stamps every swap
    for (const desktop of [false, true]) {
      mount(tape, desktop);
      const c = card(0);
      expect(c.querySelector('[data-replay-none="not-drawn"]').textContent).toBe('No replay drawn for this swap');
      expect(c.querySelector('[data-fork-row], [data-path-label], [data-replay-sentence], [data-result-row="gap"]')).toBeNull();
      expect(card(1).querySelector('[data-replay-sentence]')).toBeTruthy();
    }
  });

  it('R15 legend wording: dots, never "points" (the screen\'s word for score) — on every drawn card of every day here, at both widths', () => {
    const seen = new Set();
    for (const [name, tape] of Object.entries(days)) {
      for (const desktop of [false, true]) {
        mount(tape, desktop);
        for (const c of cards()) {
          const legend = legendOf(c);
          if (legend === '0 legends') continue;
          expect(LEGENDS, `${name} ${legend}`).toContain(legend);
          expect(legend, name).not.toMatch(/\bpoints?\b/i);
          seen.add(legend);
        }
      }
    }
    expect([...seen].sort()).toEqual([...LEGENDS].sort());   // each of the three legends is read somewhere above
  });

  it('review A2G1-5: a run whose samples coincide (two at one instant, one value) is a ring, never a zero-length dashed segment', () => {
    const tape = JSON.parse(JSON.stringify(days.full));
    const hold = tape.actions[0].replay.holdPath;
    hold.forEach((p, j) => { if (j !== 3 && j !== 4) p.points = null; });
    hold[4].at = hold[3].at;
    hold[4].points = hold[3].points;   // planted: the writer stamps each sample at its own check
    expect(runsOf(hold).map((run) => run.length)).toEqual([2]);
    mount(tape);
    const c = card(0);
    expect(c.querySelector('[data-line="hold"]')).toBeNull();
    expect(c.querySelectorAll('[data-fork-point="hold"]')).toHaveLength(1);
    expect(c.querySelector('[data-path-label="hold"] svg line')).toBeNull();
    expect(legendOf(c)).toBe('dashed lines and dots · rebuilt from 1-minute bars');   // the swap path's full line, and the hold ring
  });

  it('a path with a segment and an isolated sample: the dashed segment, the ring, both swatches, and a legend naming both', () => {
    const tape = days.mixed;
    const r = tape.actions[0].replay;
    expect([segmentsOf(r.swapPath).length, isolatedOf(r.swapPath).length]).toEqual([1, 1]);   // the case is truly mixed
    expect([segmentsOf(r.holdPath).length, isolatedOf(r.holdPath).length]).toEqual([1, 0]);
    for (const desktop of [false, true]) {
      mount(tape, desktop);
      const c = card(0);
      const d = c.querySelector('[data-line="swap"]').getAttribute('d');
      expect(d.split('M')).toHaveLength(2);   // one subpath: the segment, never joined to the isolated close
      expect(d.split('L')).toHaveLength(segmentsOf(r.swapPath)[0].length);
      expect(c.querySelectorAll('[data-fork-point="swap"]')).toHaveLength(1);
      expect(c.querySelectorAll('[data-fork-point="hold"]')).toHaveLength(0);
      const swap = c.querySelector('[data-path-label="swap"]');
      expect([Boolean(swap.querySelector('svg line')), Boolean(swap.querySelector('[data-swatch="point"]'))]).toEqual([true, true]);
      const hold = c.querySelector('[data-path-label="hold"]');
      expect([Boolean(hold.querySelector('svg line')), Boolean(hold.querySelector('[data-swatch="point"]'))]).toEqual([true, false]);
      expect(legendOf(c)).toBe('dashed lines and dots · rebuilt from 1-minute bars');
      expect(swept(tape)).toEqual(CLEAN);
    }
  });

  it('control: the full-candle day is unchanged — every fork path one dashed subpath, byte-identical to the renderer before the fix; no ring; the dashed legend', () => {
    for (const desktop of [false, true]) {
      mount(days.full, desktop);
      const ds = cards().map((c) => `${c.querySelector('[data-line="hold"]').getAttribute('d')}|${c.querySelector('[data-line="swap"]').getAttribute('d')}`).join('\n');
      for (const d of ds.split(/[\n|]/)) expect(d).toMatch(/^M[\d.]+ [\d.]+( L[\d.]+ [\d.]+)+$/);
      // the SHA-256 of the three cards' paths as f931f339's renderer drew them (captured from that commit, both widths)
      expect(createHash('sha256').update(ds).digest('hex')).toBe('e96b5f384aa0690b1dc44fe2fa47d581f5528facf002ec106ea189bf65099d94');
      expect(m.q('[data-fork-point], [data-swatch]')).toBeNull();
      for (const c of cards()) expect(legendOf(c)).toBe('dashed · rebuilt from 1-minute bars');
    }
  });

  it('R15 control: the full-candle day — the whole Study\'s HTML byte-identical to the renderer before R15, at phone and desktop width', () => {
    // React's useId values count every id the test process has handed out, so they are renumbered by first appearance
    // (one token, one number, wherever it stands); every other byte is hashed as rendered
    const stableIds = (h) => { const seen = new Map(); return h.replace(/_r_[0-9a-z]+_/g, (id) => { if (!seen.has(id)) seen.set(id, `_r_${seen.size}_`); return seen.get(id); }); };
    const html = [false, true].map((desktop) => { mount(days.full, desktop); return stableIds(m.container.innerHTML); });
    expect(html.every((h) => h.includes('data-swap-card') && !h.includes('data-replay-none'))).toBe(true);   // every card drawn
    // the SHA-256 of the whole Study's HTML at each width as 6d5898af's renderer drew it (captured from that commit, on
    // Linux, the same under TZ=UTC and America/Chicago, the row alone and the whole file)
    expect(html.map((h) => createHash('sha256').update(h).digest('hex'))).toEqual([
      '65668a674ae6d0de10e0f59ca7d643d101e0e7bf9b058f6bea2157d26bdd4921',
      '0761d9ca913f878cc96f7e10ab4b02b9227f46d858cf3bb758b1b2c60c3b6d78',
    ]);
  });

  it('control: a replay with no value keeps the no-drawn treatment — no ring, no legend, no label', () => {
    const tape = days.undrawn;
    const k = tape.actions.findIndex((a) => a.symbolOut === 'MSFT');
    for (const desktop of [false, true]) {
      mount(tape, desktop);
      const c = card(k);
      expect(c.querySelector('[data-replay-none="not-drawn"]').textContent.startsWith('No replay drawn for this swap')).toBe(true);
      expect(c.querySelector('[data-fork-point], [data-swatch], [data-line], [data-path-label], [data-fork-end]')).toBeNull();
      for (const words of [...REPLAY_WORDS, ...LEGENDS]) expect(c.textContent).not.toContain(words);
    }
  });

  it('a replay with values whose scale exists but which emits nothing (each value\'s own instant unrecorded, its neighbours\' recorded): the no-drawn treatment — never the sentence, a label, the legend or the hypothetical tag', () => {
    const tape = JSON.parse(JSON.stringify(days.full));
    const a = tape.actions[0];
    a.subsequentTradesInSlot = 1;   // a hypothetical replay — its tag, too, only beside a drawn one
    for (const list of [a.replay.holdPath, a.replay.swapPath]) list.forEach((p, j) => { if (j === 1) p.at = null; else p.points = null; });
    expect([...a.replay.holdPath, ...a.replay.swapPath].filter((p) => Number.isFinite(p.points))).toHaveLength(2);   // values remain…
    expect(runsOf(a.replay.holdPath).concat(runsOf(a.replay.swapPath))).toEqual([]);   // …none placeable
    for (const desktop of [false, true]) {
      mount(tape, desktop);
      const c = card(0);
      expect(c.querySelector('[data-replay-none="not-drawn"]').textContent).toBe('No replay drawn for this swap');
      expect(c.querySelector('[data-replay-sentence], [data-hypothetical], [data-fork-row], [data-path-label], [data-result-row="gap"]')).toBeNull();
      for (const words of [...REPLAY_WORDS, ...LEGENDS]) expect(c.textContent).not.toContain(words);
      expect(card(1).querySelector('[data-replay-sentence]')).toBeTruthy();   // the other cards keep theirs
      expect(swept(tape)).toEqual(CLEAN);
    }
  });
});
