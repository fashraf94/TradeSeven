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
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL passes, never mocked;
// only the writer flag is mocked on (spreading the real module).

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React from 'react';

vi.mock('../../config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
}));

import FilmRoomStudy from './FilmRoomStudy';
import { REPLAY_SENTENCE } from './filmRoomCopy';
import { sep23Day, sep23Bars, buildTapeDay, SEP23_NIGHT, SEP23_MORNING } from '../../../api/_utils/filmTape/__fixtures__/screenFixtures.js';
import { seedDay, OWNER } from '../../../api/_utils/filmTape/__fixtures__/tapeFixtures.js';
import { makeTapeDb } from '../../../api/_utils/filmTape/__fixtures__/tapeFirestore.js';
import { writeTapeDay } from '../../../api/_utils/filmTape/writeTapeDay.js';
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

const OUTSIDE_NIGHT = Date.parse('2026-10-20T02:15:30.000Z');   // four weeks on: the Sep-23 day is outside the candle window
const days = {};
beforeAll(async () => {
  days.closeOnly = await closePassOnly(await sep23Day(), SEP23_NIGHT);
  days.outside = await closePassOnly(await sep23Day(), OUTSIDE_NIGHT);
  days.crypto = (await buildTapeDay(await cryptoDay(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sep23Bars() })).tape;
  days.full = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sep23Bars() })).tape;
  const bars = sep23Bars();
  delete bars.MSFT;
  delete bars.CRWD;   // swap 1's two legs: the candle pass writes their replay with nothing to draw
  days.undrawn = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars })).tape;
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
      }
      expect(swept(tape), desktop ? 'desktop' : 'phone').toEqual(CLEAN);
    }
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
    expect(card(k).querySelector('[data-replay-none]')).toBeNull();   // a replay IS written: never "No replay"
    expect(card(k).querySelector('[data-line]')).toBeNull();
    for (const i of tape.actions.map((_, j) => j).filter((j) => j !== k)) expect(card(i).querySelector('[data-replay-sentence]'), `card ${i}`).toBeTruthy();
    expect(swept(tape)).toEqual(CLEAN);
  });
});
