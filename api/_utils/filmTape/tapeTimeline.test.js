// api/_utils/filmTape/tapeTimeline.test.js
//
// Film Room B1 item 6 — W2, a malformed timeline. The writer treats a
// `timing.tradingDays` entry that is not a real date as absent and never
// throws (['not-a-date', D] threw at tapeAssemble.js's directive window). The
// screen's `tradingTimeline` moved to src/utils/tapeSchedule.js and serves
// both: the writer reads the very function the screen does (the screen's
// output unchanged — the v2 suites and their pinned hashes are the proof).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real writer; only the flag
// module is mocked, by spreading the real one.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { writeTapeDay } from './writeTapeDay.js';
import { directiveWindow } from './tapeAssemble.js';
import { etDayBounds } from './tapeTime.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { stalledDay } from './__fixtures__/tagFixtures.js';
import { tradingTimeline as shared } from '../../../src/utils/tapeSchedule.js';
import { tradingTimeline as screens } from '../../../src/screens/filmRoomV2/filmRoomModel.js';

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const timing = (tradingDays) => ({ timing: { tradingDays, currentTradingDay: 1, timezone: 'America/New_York' } });
async function writeWith(tradingDays, battleId = 'b-timeline') {
  const fx = await stalledDay({ battleId, over: timing(tradingDays) });
  const t = makeTapeDb(seedDay({}, fx));
  const r = await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT });
  return { r, t, tape: t.store.get(`agentBattles/${fx.battleId}/tape/${D}`) };
}

describe('one timeline for the screen and the writer', () => {
  it('the screen\'s model re-exports the shared function itself — never a copy', () => {
    expect(screens).toBe(shared);
  });
});

describe('the writer never throws on a timeline entry that is not a real date', () => {
  it('[\'not-a-date\', D] — the reported repro: written; D is the battle\'s first and last day', async () => {
    const { r, tape, t } = await writeWith(['not-a-date', D]);
    expect(r.status).toBe('written');
    expect(tape.dayNumber).toBe(1);
    expect(tape.isFinalDay).toBe(true);
    expect(tape.score.dayChange.basis).toBe('battle_start');
    // no read of a tape under an id that is not a date (the prior day is the timeline's, validated)
    expect(t.readLog.filter((p) => String(p).includes('/tape/not-a-date'))).toEqual([]);
  });

  it('every kind of malformed entry: a non-date, an impossible date, a weekend, a duplicate, a number, null — counted out, the real days in order', async () => {
    const days = ['2026-02-30', 42, null, '2026-09-20', '2026-09-23', 'tomorrow', '2026-09-23', D, '2026-09-25'];
    expect(shared({ timing: { tradingDays: days } })).toEqual(['2026-09-23', D, '2026-09-25']);
    const { r, tape, t } = await writeWith(days, 'b-garbage');
    expect(r.status).toBe('written');
    expect(tape.dayNumber).toBe(2);
    expect(tape.isFinalDay).toBe(false);
    expect(t.readLog).toContain('agentBattles/b-garbage/tape/2026-09-23');      // the prior day: the timeline's own
  });

  it('the directive window reaches back to the previous VALID trading day', () => {
    const bounds = etDayBounds(D);
    const battle = { timing: { tradingDays: ['not-a-date', '2026-09-23', D] } };
    expect(directiveWindow({ battle, etDate: D, bounds })).toEqual({ startMs: etDayBounds('2026-09-23').endMs, endMs: bounds.endMs });
    // D first among the real days: the activation reach-back of a first day
    const first = { activatedAt: '2026-09-23T23:00:00.000Z', timing: { tradingDays: ['not-a-date', D] } };
    expect(directiveWindow({ battle: first, etDate: D, bounds }).startMs).toBe(Date.parse('2026-09-23T23:00:00.000Z'));
  });

  it('a real date the ET clock cannot bound (before standard time, 1883) as the previous day: the window is the day\'s own — written, no throw', async () => {
    const bounds = etDayBounds(D);
    expect(etDayBounds('1800-01-02')).toBeNull();
    expect(shared({ timing: { tradingDays: ['1800-01-02', D] } })).toEqual(['1800-01-02', D]);   // a real date: kept
    expect(directiveWindow({ battle: { timing: { tradingDays: ['1800-01-02', D] } }, etDate: D, bounds })).toEqual({ startMs: bounds.startMs, endMs: bounds.endMs });
    expect((await writeWith(['1800-01-02', D], 'b-1800')).r.status).toBe('written');
  });

  it('no timeline at all, or one that is not a list: written, the day numbered null — as before', async () => {
    for (const [tradingDays, id] of [[undefined, 'b-none'], ['2026-09-24', 'b-string']]) {
      const { r, tape } = await writeWith(tradingDays, id);
      expect(r.status, id).toBe('written');
      expect(tape.dayNumber, id).toBeNull();
    }
  });

  it('a well-formed timeline reads exactly as it did before W2 (the validated list IS the stored list)', () => {
    const days = ['2026-09-22', '2026-09-23', D, '2026-09-25', '2026-09-28'];
    expect(shared({ timing: { tradingDays: days } })).toEqual(days);
  });
});
