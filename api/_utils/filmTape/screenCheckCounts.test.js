// api/_utils/filmTape/screenCheckCounts.test.js
//
// Film Room A2 polish — "Checks · n of m" on tapes the WRITER builds (review
// A2P1-1). The screen's checkCounts (src/screens/filmRoomV2/filmRoomModel.js)
// may state "n of m" only when every row with a record sits inside the minted
// range passes.close records; otherwise it says "n recorded". Each case is a
// real writeTapeDay run over the A1 fixtures, not a hand-built tape.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));

import { writeTapeDay } from './writeTapeDay.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay, multiDay } from './__fixtures__/tapeFixtures.js';
import { NON_CHECK_STATES } from '../../../src/constants/filmTape.js';
import { checkCounts } from '../../../src/screens/filmRoomV2/filmRoomModel.js';

const world = (...fxs) => { const store = {}; for (const fx of fxs) seedDay(store, fx); return makeTapeDb(store); };
const written = async (fx, etDate, nowIso) => {
  const t = world(fx);
  await writeTapeDay(fx.battleId, etDate, { db: t.db, now: Date.parse(nowIso) });
  return t.store.get(`agentBattles/${fx.battleId}/tape/${etDate}`);
};
const withRecord = (tape) => tape.checks.filter((r) => !NON_CHECK_STATES.includes(r.state));
/** The minted numbers that have no record, as the tape itself lists them (its gap rows). */
const noRecordInRange = (tape) => tape.checks.filter((r) => r.state === 'no_record').length;

let errSpy;
beforeEach(() => { flags.writer = true; errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { errSpy.mockRestore(); });

describe('"Checks · n of m" on writer tapes', () => {
  it('a day captured whole: n of m, and m − n is exactly the tape\'s own no-record rows', async () => {
    const fx = await capturedDay();
    const tape = await written(fx, '2026-09-24', '2026-09-25T02:15:30.000Z');
    const { n, m } = checkCounts(tape);
    expect(n).toBe(withRecord(tape).length);
    expect(m).not.toBeNull();
    expect(m - n).toBe(noRecordInRange(tape));
  });

  it('review A2P1-1: day 2 of a battle, an evaluation entry whose tick is lost and whose number the close pass cannot attribute, plus an interior gap — "n recorded", never "n of n"', async () => {
    const fx = await multiDay({ full: true });
    const D2 = '2026-09-22';
    const ticks = fx.ticks.filter((tk) => tk.tickSeq !== 41 && tk.tickSeq !== 50);
    const evaluations = fx.battle.evaluations.filter((e) => e.evalId !== `${fx.battleId}:e50`);
    const tape = await written({ ...fx, ticks, battle: { ...fx.battle, evaluations } }, D2, '2026-09-23T02:15:30.000Z');
    expect(tape.passes.close.unattributedGaps).toEqual([41]);
    expect(noRecordInRange(tape)).toBe(1);                       // the tape says one minted check has no record
    expect(tape.checks.some((r) => r.rowSource === 'entry' && !Number.isInteger(r.tickSeq))).toBe(true);
    expect(checkCounts(tape)).toEqual({ n: withRecord(tape).length, m: null });
  });

  it('refuter A2PV1-1: as above with a second interior gap — the old count read "38 of 39" against 37 records in the range; now "n recorded"', async () => {
    const fx = await multiDay({ full: true });
    const D2 = '2026-09-22';
    const ticks = fx.ticks.filter((tk) => ![41, 50, 51].includes(tk.tickSeq));
    const evaluations = fx.battle.evaluations.filter((e) => ![`${fx.battleId}:e50`, `${fx.battleId}:e51`].includes(e.evalId));
    const tape = await written({ ...fx, ticks, battle: { ...fx.battle, evaluations } }, D2, '2026-09-23T02:15:30.000Z');
    const [lo, hi] = tape.passes.close.tickSeqRange;
    const inRange = tape.checks.filter((r) => Number.isInteger(r.tickSeq) && r.tickSeq >= lo && r.tickSeq <= hi && !NON_CHECK_STATES.includes(r.state)).length;
    expect(withRecord(tape).length).toBeGreaterThan(inRange);    // the entry-only row is not one of the range's records
    expect(checkCounts(tape)).toEqual({ n: withRecord(tape).length, m: null });
  });

  it('ticks lost at the start of a one-day battle, an entry kept: "n recorded" (the entry cannot be placed)', async () => {
    const fx = await capturedDay();
    const tape = await written({ ...fx, ticks: fx.ticks.filter((tk) => ![1, 2, 3, 4, 5].includes(tk.tickSeq)) }, '2026-09-24', '2026-09-25T02:15:30.000Z');
    const { n, m } = checkCounts(tape);
    expect(n).toBe(withRecord(tape).length);
    if (tape.checks.some((r) => !NON_CHECK_STATES.includes(r.state) && !Number.isInteger(r.tickSeq))) expect(m).toBeNull();
    else expect(m - n).toBe(noRecordInRange(tape));
  });

  it('capture absent: checks known only from evaluation entries — "n recorded"', async () => {
    const fx = await capturedDay();
    const tape = await written({ ...fx, ticks: [] }, '2026-09-24', '2026-09-25T02:15:30.000Z');
    expect(tape.passes.close.capture).toBe('absent');
    expect(checkCounts(tape)).toEqual({ n: withRecord(tape).length, m: null });
  });
});
