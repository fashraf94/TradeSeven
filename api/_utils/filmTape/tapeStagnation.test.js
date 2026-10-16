// api/_utils/filmTape/tapeStagnation.test.js
//
// Film Room B1.1 item 1 — `checks[].stagnation`, the live rule's own count on
// the permanent record (Amendment C, RC-2). The tick's `risk.stagnation` —
// per held symbol the count evaluateRisk received, its age verdict and the
// daily change exactly as passed — is copied to the check, type-checked, a
// declared new field of class R. The screen renders nothing new (the screen
// suite FilmRoomB1Tape.writer.jsdom.test.jsx pins that).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real writeTapeDay import;
// only the flag module is mocked, by spreading the real one.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { writeTapeDay } from './writeTapeDay.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { stalledDay } from './__fixtures__/tagFixtures.js';
import { numbersWithClasses, formatNumberPath } from '../../../src/constants/filmTape.js';

const NOW = Date.parse('2026-09-25T02:15:30.000Z');
const path = (fx) => `agentBattles/${fx.battleId}/tape/${fx.etDate}`;
async function writeFor(fx, { now = NOW, t = makeTapeDb(seedDay({}, fx)) } = {}) {
  const r = await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now });
  return { t, r, tape: t.store.get(path(fx)) };
}
const tickBySeq = (fx) => Object.fromEntries(fx.ticks.map((tk) => [tk.tickSeq, tk]));

describe('the tick\'s record, copied to its check', () => {
  it('every tick-backed check carries its tick\'s `risk.stagnation`, value for value, over the symbols its risk record holds', async () => {
    const fx = await stalledDay({ battleId: 'b-stag-copy', recordStagnation: true, noTriggerSeqs: [3] });
    const { tape } = await writeFor(fx);
    const ticks = tickBySeq(fx);
    const rows = tape.checks.filter((c) => c.rowSource === 'tick');
    expect(rows.length).toBe(26);
    for (const c of rows) {
      expect(c.stagnation, `seq ${c.tickSeq}`).toEqual(ticks[c.tickSeq].risk.stagnation);
      expect(Object.keys(c.stagnation).sort(), `seq ${c.tickSeq}`).toEqual(Object.keys(c.risk).sort());
    }
    // a no-trigger check carries it too: the risk loop runs before the trigger gate
    expect(rows.find((c) => c.tickSeq === 3).state).toBe('no_trigger');
    expect(rows.find((c) => c.tickSeq === 3).stagnation.ACN).toEqual({ ticks: 2, withinAge: true, dailyPct: -0.004 });
  });

  it('a tick that recorded none (every tick before B1.1) and a check rebuilt from its entry carry no `stagnation` key at all', async () => {
    const fx = await stalledDay({ battleId: 'b-stag-none', recordStagnation: true, unrecordedSeqs: [4] });
    fx.ticks = fx.ticks.filter((tk) => tk.tickSeq !== 7);          // capture missed check 7; its entry survives
    const { tape } = await writeFor(fx);
    expect(Object.hasOwn(tape.checks.find((c) => c.tickSeq === 4), 'stagnation')).toBe(false);
    const rebuilt = tape.checks.find((c) => c.rowSource === 'entry');
    expect(rebuilt).toBeTruthy();
    expect(Object.hasOwn(rebuilt, 'stagnation')).toBe(false);
    // and a B1 day — no tick records any — has none anywhere
    const b1 = await writeFor(await stalledDay({ battleId: 'b-stag-b1' }));
    expect(b1.tape.checks.some((c) => Object.hasOwn(c, 'stagnation'))).toBe(false);
  });

  it('type-checked as the capture writer checks it: each malformed value null, a key that is not ticker-shaped not copied', async () => {
    const fx = await stalledDay({ battleId: 'b-stag-types', recordStagnation: true });
    const t5 = fx.ticks.find((tk) => tk.tickSeq === 5);
    t5.risk.stagnation = {
      ACN: { ticks: 2.5, withinAge: 'yes', dailyPct: Number.POSITIVE_INFINITY },
      MSFT: 'not a record',
      'not a ticker': { ticks: 1, withinAge: true, dailyPct: 0 },
      NVDA: { ticks: 0, withinAge: false, dailyPct: 0.008, extra: 'dropped' },
    };
    const { tape } = await writeFor(fx);
    expect(tape.checks.find((c) => c.tickSeq === 5).stagnation).toEqual({
      ACN: { ticks: null, withinAge: null, dailyPct: null },
      MSFT: { ticks: null, withinAge: null, dailyPct: null },
      NVDA: { ticks: 0, withinAge: false, dailyPct: 0.008 },
    });
    // a record with no admissible key at all is no record
    t5.risk.stagnation = { 'not a ticker': { ticks: 1, withinAge: true, dailyPct: 0 } };
    const again = await writeFor(fx);
    expect(Object.hasOwn(again.tape.checks.find((c) => c.tickSeq === 5), 'stagnation')).toBe(false);
  });
});

describe('a declared field of class R', () => {
  it('the declaration names both numbers `recorded`, and every number the field carries resolves to that class', async () => {
    const { tape } = await writeFor(await stalledDay({ battleId: 'b-stag-class', recordStagnation: true }));
    expect(tape.numberClasses['checks[].stagnation.*.ticks']).toBe('recorded');
    expect(tape.numberClasses['checks[].stagnation.*.dailyPct']).toBe('recorded');
    const nums = numbersWithClasses(tape, tape.numberClasses).filter((n) => formatNumberPath(n.path).includes('.stagnation.'));
    expect(nums.length).toBeGreaterThan(26);
    for (const n of nums) expect(n.cls, formatNumberPath(n.path)).toBe('recorded');
  });

  it('merge-monotone: a second close pass over the same day writes nothing', async () => {
    const fx = await stalledDay({ battleId: 'b-stag-twice', recordStagnation: true });
    const t = makeTapeDb(seedDay({}, fx));
    expect((await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW })).status).toBe('written');
    expect((await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW + 60_000 })).status).toBe('unchanged');
  });
});
