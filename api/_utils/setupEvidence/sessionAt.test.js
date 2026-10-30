// api/_utils/setupEvidence/sessionAt.test.js
//
// ID-1 Build 1 — the activation-to-session wrapper: the Phase 0 §D matrix in full
// (docs/audits/20261030_PHASE0_ID1_SHARED_EVIDENCE.md), plus its composition with
// the adapter: a session the wrapper names is never `current_session_incomplete`.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL, unmocked imports of
// sessionAt.js, marketSchedule.js and marketDataCache.js are the runtime guard for
// the wrapper's import graph, src/utils/marketCalendar.js included. Never mock them.

import '../__fixtures__/pinTimezoneUtc.js';
import { describe, it, expect } from 'vitest';
import { lastCompletedSessionAt } from './sessionAt.js';
import { getSessionForDate } from '../marketSchedule.js';
import { etWallClockToMs } from '../../../src/utils/marketCalendar.js';
import { expectedCompletedSession } from '../setupEvaluator/dailyBarsAdapter.js';

const et = (date, hour, minute = 0, second = 0) => etWallClockToMs(date, hour, minute) + second * 1000;

describe('lastCompletedSessionAt — the Phase 0 §D matrix', () => {
  const OK_ROWS = [
    ['Monday 08:00 ET → the Friday before', et('2026-10-26', 8), { session: '2026-10-23', etDate: '2026-10-26', relation: 'before_close' }],
    ['Tuesday 10:00 ET, in session → the previous session', et('2026-10-27', 10), { session: '2026-10-26', etDate: '2026-10-27', relation: 'before_close' }],
    ['15:59:59 ET → the previous session', et('2026-10-27', 15, 59, 59), { session: '2026-10-26', etDate: '2026-10-27', relation: 'before_close' }],
    ['16:00:00 ET exactly → that day', et('2026-10-27', 16), { session: '2026-10-27', etDate: '2026-10-27', relation: 'after_close' }],
    ['Saturday → the Friday', et('2026-10-24', 12), { session: '2026-10-23', etDate: '2026-10-24', relation: 'non_session' }],
    ['Sunday → the Friday', et('2026-10-25', 12), { session: '2026-10-23', etDate: '2026-10-25', relation: 'non_session' }],
    ['Thanksgiving 2026-11-26 → the Wednesday', et('2026-11-26', 12), { session: '2026-11-25', etDate: '2026-11-26', relation: 'non_session' }],
    ['the early close 2026-11-27 at 12:59 ET → past Thanksgiving to 11-25', et('2026-11-27', 12, 59), { session: '2026-11-25', etDate: '2026-11-27', relation: 'before_close' }],
    ['the early close 2026-11-27 at 13:00 ET → that day', et('2026-11-27', 13), { session: '2026-11-27', etDate: '2026-11-27', relation: 'after_close' }],
    ['2026-11-01 01:30 ET on the EDT side (05:30Z) → the Friday', Date.UTC(2026, 10, 1, 5, 30), { session: '2026-10-30', etDate: '2026-11-01', relation: 'non_session' }],
    ['2026-11-01 01:30 ET on the EST side (06:30Z) → the Friday', Date.UTC(2026, 10, 1, 6, 30), { session: '2026-10-30', etDate: '2026-11-01', relation: 'non_session' }],
    ['a BR-2 late-day creation, 2026-10-29 15:30 ET → the session before', et('2026-10-29', 15, 30), { session: '2026-10-28', etDate: '2026-10-29', relation: 'before_close' }],
    ['2026-01-02 at the close → that day: the first maintained session reaches no earlier year', et('2026-01-02', 16), { session: '2026-01-02', etDate: '2026-01-02', relation: 'after_close' }],
    ['the last maintained session after its close', et('2027-12-31', 16), { session: '2027-12-31', etDate: '2027-12-31', relation: 'after_close' }],
    ['23:30 ET on a winter evening is still that ET date, past its close (04:30Z the next day)', Date.UTC(2026, 11, 2, 4, 30), { session: '2026-12-01', etDate: '2026-12-01', relation: 'after_close' }],
    ['00:30 ET on a winter morning is the new ET date, before its close (05:30Z)', Date.UTC(2026, 11, 2, 5, 30), { session: '2026-12-01', etDate: '2026-12-02', relation: 'before_close' }],
    ['23:30 ET on a summer evening is still that ET date (03:30Z the next day)', Date.UTC(2026, 6, 15, 3, 30), { session: '2026-07-14', etDate: '2026-07-14', relation: 'after_close' }],
    ['00:30 ET on a summer morning is the new ET date (04:30Z)', Date.UTC(2026, 6, 15, 4, 30), { session: '2026-07-14', etDate: '2026-07-15', relation: 'before_close' }],
    ['2027-12-31 at 23:59 ET is still the last maintained year, though it is 2028 in UTC', Date.UTC(2028, 0, 1, 4, 59), { session: '2027-12-31', etDate: '2027-12-31', relation: 'after_close' }],
  ];
  it.each(OK_ROWS)('%s', (_label, instant, expected) => {
    expect(lastCompletedSessionAt(instant)).toEqual({ ok: true, ...expected });
  });

  it('the two 01:30 ET instants of 2026-11-01 really are an hour apart on one wall clock', () => {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
    expect(fmt.format(Date.UTC(2026, 10, 1, 5, 30))).toBe('01:30');
    expect(fmt.format(Date.UTC(2026, 10, 1, 6, 30))).toBe('01:30');
  });

  it('2026-01-02 at 10:00 ET → calendar_missing: the previous session is 2025-12-31, an unmaintained year', () => {
    expect(lastCompletedSessionAt(et('2026-01-02', 10))).toEqual({
      ok: false, reason: 'calendar_missing', detail: { etDate: '2026-01-02', why: 'previous_session_outside_maintained_years', maintainedYears: [2026, 2027] },
    });
  });
  it('2028-01-03 → calendar_missing: the year is unmaintained', () => {
    expect(lastCompletedSessionAt(Date.UTC(2028, 0, 3, 17))).toEqual({
      ok: false, reason: 'calendar_missing', detail: { etDate: '2028-01-03', maintainedYears: [2026, 2027] },
    });
  });
  it.each([[Number.NaN], [Number.POSITIVE_INFINITY], [8.64e15 + 1], [-1], [Date.UTC(-2025, 9, 28, 20)], ['2026-10-27'], [null], [undefined]])('a malformed instant (%s) is calendar_missing, never a throw', (instant) => {
    expect(lastCompletedSessionAt(instant)).toEqual({ ok: false, reason: 'calendar_missing', detail: { etDate: null, why: 'malformed_instant', maintainedYears: [2026, 2027] } });
  });
});

describe('the wrapper composes with the adapter (Phase 0 §D)', () => {
  it('every session it names over a year of instants is a trading day whose close has passed, and the adapter calls it complete', () => {
    const start = Date.UTC(2026, 0, 5);
    for (let t = start; t < start + 366 * 86_400_000; t += 663 * 60_000) { // 11 h 3 min, so the sample drifts through every time of day
      const r = lastCompletedSessionAt(t);
      expect(r.ok).toBe(true);
      const day = getSessionForDate(r.session);
      expect(day.isTradingDay).toBe(true);
      expect(day.closeMs).toBeLessThanOrEqual(t);
      expect(expectedCompletedSession({ asOf: r.session, now: new Date(t) })).toMatchObject({ ok: true, expected: r.session, completedSession: 'complete' });
    }
  }, 20_000);
});
