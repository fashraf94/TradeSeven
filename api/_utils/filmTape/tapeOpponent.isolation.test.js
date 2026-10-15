// api/_utils/filmTape/tapeOpponent.isolation.test.js
//
// Film Room B1 exit criterion 4, for T1 (Astra F4) — a failure reading a
// check's opponent score never stops or corrupts the day. Astra's injection:
// only readDayTicks is wrapped, returning the real tick records except that
// chosen ticks' `scores.opponent` access throws a TypeError (every other
// score field and every other source intact). The day must write; that
// check's opponent is null; the failure's class is in the T1 note
// (`score.opponentNote`); every other field is exactly as the day writes
// with the read working — on a fresh write and a refresh, at the first, a
// middle and the last check.
//
// The dependency-surface guard for the writer is tapeOpponent.test.js, which
// mocks nothing it imports; this file wraps the tick reader on purpose.

import { describe, it, expect, vi } from 'vitest';

const knobs = vi.hoisted(() => ({ throwAt: [] }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));
vi.mock('./tapeSources.js', async (importOriginal) => {
  const real = await importOriginal();
  /** The tick's scores, its opponent behind an accessor that throws. */
  const trapped = (scores) => {
    const s = { ...scores };
    Object.defineProperty(s, 'opponent', { enumerable: true, get() { throw new TypeError('planted opponent read'); } });
    return s;
  };
  return {
    ...real,
    readDayTicks: async (...args) => {
      const r = await real.readDayTicks(...args);
      if (!knobs.throwAt.length || !r.ok) return r;
      return { ...r, ticks: r.ticks.map((t) => (knobs.throwAt.includes(t.tickSeq) ? { ...t, scores: trapped(t.scores) } : t)) };
    },
  };
});

import { writeTapeDay } from './writeTapeDay.js';
import { opponentNoteOf, opponentReader } from './tapeAssemble.js';
import { contentOf, stableStringify } from './tapeMerge.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { stalledDay } from './__fixtures__/tagFixtures.js';

const NOW = Date.parse('2026-09-25T02:15:30.000Z');
const path = (fx) => `agentBattles/${fx.battleId}/tape/${fx.etDate}`;
const FIRST = 1;
const MIDDLE = 13;
const LAST = 26;

async function write(throwAt, { t, fx, now = NOW } = {}) {
  knobs.throwAt = throwAt;
  try {
    const day = fx ?? await stalledDay({ battleId: 'b-t1-iso' });
    const db = t ?? makeTapeDb(seedDay({}, day));
    const r = await writeTapeDay(day.battleId, day.etDate, { db: db.db, now });
    return { r, tape: db.store.get(path(day)), t: db, fx: day };
  } finally {
    knobs.throwAt = [];
  }
}

/**
 * The tape as it would read had the failing checks' opponent been read: the
 * control's opponent put back at those checks (and on the last check), and the
 * T1 note removed — so every OTHER byte is compared with the control.
 */
function restored(tape, control, seqs) {
  const c = structuredClone(contentOf(tape));
  const ctl = contentOf(control);
  for (const row of c.checks) {
    if (!seqs.includes(row.tickSeq) || row.rowSource !== 'tick') continue;
    row.scores.opponent = ctl.checks.find((x) => x.key === row.key).scores.opponent;
  }
  if (seqs.includes(c.score.lastCheck?.tickSeq)) c.score.lastCheck.opponent = ctl.score.lastCheck.opponent;
  delete c.score.opponentNote;
  return stableStringify(c);
}

describe('Astra F4 — a throw reading one check\'s opponent never aborts the day (fresh write)', () => {
  it.each([['the first check', FIRST], ['a middle check', MIDDLE], ['the last check', LAST]])('%s: the day is written; that check\'s opponent is null; the class is in the T1 note; every other byte as with the read working', async (_, seq) => {
    const control = (await write([])).tape;
    expect(control.score.opponentNote).toBeUndefined();
    const { r, tape } = await write([seq]);
    expect(r.status).toBe('written');
    const row = tape.checks.find((c) => c.tickSeq === seq && c.rowSource === 'tick');
    const was = control.checks.find((c) => c.tickSeq === seq && c.rowSource === 'tick');
    expect(row.scores).toEqual({ ...was.scores, opponent: null });
    expect(typeof was.scores.opponent).toBe('number');
    expect(tape.score.opponentNote).toBe("the opponent's score could not be read at 1 check (TypeError)");
    if (seq === LAST) expect(tape.score.lastCheck.opponent).toBeNull();
    else expect(tape.score.lastCheck).toEqual(control.score.lastCheck);
    expect(tape.coverage.tags).toEqual(control.coverage.tags);
    expect(tape.tags).toEqual(control.tags);
    expect(restored(tape, control, [seq])).toBe(stableStringify(contentOf(control)));
  });

  it('three checks at once: one note, counted, the class once', async () => {
    const control = (await write([])).tape;
    const { tape } = await write([FIRST, MIDDLE, LAST]);
    expect(tape.score.opponentNote).toBe("the opponent's score could not be read at 3 checks (TypeError)");
    expect(restored(tape, control, [FIRST, MIDDLE, LAST])).toBe(stableStringify(contentOf(control)));
  });
});

describe('Astra F4 — the same throw on a refresh of a written day', () => {
  it.each([['the first check', FIRST], ['a middle check', MIDDLE], ['the last check', LAST]])('%s: the refresh is written; the check\'s opponent and the T1 note as on a fresh write; every other byte as before; a working refresh clears the note', async (_, seq) => {
    const first = await write([]);
    const control = first.tape;
    const { r, tape } = await write([seq], { t: first.t, fx: first.fx, now: NOW + 60_000 });
    expect(r.status).toBe('written');
    expect(tape.checks.find((c) => c.tickSeq === seq && c.rowSource === 'tick').scores.opponent).toBeNull();
    expect(tape.score.opponentNote).toBe("the opponent's score could not be read at 1 check (TypeError)");
    expect(restored(tape, control, [seq])).toBe(stableStringify(contentOf(control)));
    const repaired = await write([], { t: first.t, fx: first.fx, now: NOW + 120_000 });
    expect(repaired.tape.score.opponentNote).toBeUndefined();
    expect(stableStringify(contentOf(repaired.tape))).toBe(stableStringify(contentOf(control)));
  });
});

describe('the T1 note and the isolated read', () => {
  it('the note counts the checks, names each class once, sorted, three at most', () => {
    expect(opponentNoteOf([])).toBeNull();
    expect(opponentNoteOf(['TypeError', 'RangeError', 'TypeError'])).toBe("the opponent's score could not be read at 3 checks (RangeError, TypeError)");
    expect(opponentNoteOf(['A', 'B', 'C', 'D'])).toBe("the opponent's score could not be read at 4 checks (A, B, C and others)");
  });

  it('a class that is not an error class\'s name (a path, an id-like word, a name that itself throws) is named Error — the note never copies other text (review LA-3)', () => {
    const r = opponentReader();
    const thrower = (err) => ({ get opponent() { throw err; } });
    expect(r.read(thrower(Object.assign(new Error('x'), { name: 'Kq3VhT9xLmN2pR8sW4yZ' })))).toBeNull();
    expect(r.read(thrower(Object.assign(new Error('x'), { name: 'agentBattles/b-1 secret' })))).toBeNull();
    expect(r.read(thrower({ get name() { throw new Error('no'); } }))).toBeNull();
    expect(r.read(thrower(new RangeError('y')))).toBeNull();
    expect(r.read({ opponent: 7 })).toBe(7);
    expect(r.failures).toEqual(['Error', 'Error', 'Error', 'RangeError']);
  });
});
