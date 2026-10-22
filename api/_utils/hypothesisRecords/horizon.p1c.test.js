// api/_utils/hypothesisRecords/horizon.p1c.test.js
//
// Pilot P1c — the BACKWARD calendar walks (horizon.js): the session before a
// session (the review window's start — founder ruling E2), the session an
// instant ended in (a battle-end window's end), and the start of the last N
// trading days (the void unwind's look-back — ruling E3). Every expected
// instant is counted by hand from the NYSE calendar of record
// (src/utils/marketCalendar.js): Columbus Day (12 Oct 2026) is a trading day,
// Thanksgiving (26 Nov 2026) is closed and the Friday after closes at 13:00 ET,
// and US daylight time ends Sunday 1 Nov 2026 (EDT = UTC−4 before, EST =
// UTC−5 after).

import { describe, it, expect } from 'vitest';
import {
  previousSessionOf, sessionAtOrBefore, tradingDaysCutoffMs, etDateOfInstant, HorizonClockError,
} from './horizon.js';

const at = (iso) => Date.parse(iso);
const iso = (ms) => new Date(ms).toISOString();

describe('previousSessionOf — the last trading day strictly before', () => {
  it('Tuesday → Monday, even a holiday-named Monday the exchange keeps open (Columbus Day)', () => {
    const s = previousSessionOf('2026-10-13');
    expect([s.etDate, iso(s.openMs), iso(s.closeMs)]).toEqual(['2026-10-12', '2026-10-12T13:30:00.000Z', '2026-10-12T20:00:00.000Z']);
  });
  it('Monday → the Friday before (the weekend skipped)', () => {
    expect(previousSessionOf('2026-10-19').etDate).toBe('2026-10-16');
  });
  it('the Friday after Thanksgiving → Wednesday (the holiday skipped), in EST', () => {
    const s = previousSessionOf('2026-11-27');
    expect([s.etDate, iso(s.closeMs)]).toEqual(['2026-11-25', '2026-11-25T21:00:00.000Z']);
  });
  it('the Monday after the clocks change → Friday, closing at 16:00 EDT', () => {
    expect(iso(previousSessionOf('2026-11-02').closeMs)).toBe('2026-10-30T20:00:00.000Z');
  });
  it('a walk that leaves the calendar throws calendar_unavailable — never a guessed session', () => {
    expect(() => previousSessionOf('2025-01-01')).toThrow(HorizonClockError);
    try { previousSessionOf('2025-01-01'); } catch (e) { expect(e.code).toBe('calendar_unavailable'); }
  });
});

describe('sessionAtOrBefore — the session an instant fell in or last followed (its open at or before it)', () => {
  it('during a session → that session', () => {
    expect(sessionAtOrBefore(at('2026-10-13T15:00:00Z')).etDate).toBe('2026-10-13');
  });
  it('after the close, the same ET day → that session (a battle that expired at 20:00 ET ended in it)', () => {
    const s = sessionAtOrBefore(at('2026-10-14T00:00:00Z')); // 20:00 ET on the 13th
    expect([s.etDate, iso(s.closeMs)]).toEqual(['2026-10-13', '2026-10-13T20:00:00.000Z']);
  });
  it('before the open → the session before', () => {
    expect(sessionAtOrBefore(at('2026-10-13T12:00:00Z')).etDate).toBe('2026-10-12');
  });
  it('exactly at the open → that session (open ≤ t)', () => {
    expect(sessionAtOrBefore(at('2026-10-13T13:30:00Z')).etDate).toBe('2026-10-13');
  });
  it('a Saturday → Friday; Thanksgiving → Wednesday; the early-close Friday afternoon → that Friday, closing at 13:00 ET', () => {
    expect(sessionAtOrBefore(at('2026-10-17T15:00:00Z')).etDate).toBe('2026-10-16');
    expect(sessionAtOrBefore(at('2026-11-26T16:00:00Z')).etDate).toBe('2026-11-25');
    const fri = sessionAtOrBefore(at('2026-11-27T19:00:00Z'));
    expect([fri.etDate, iso(fri.closeMs)]).toEqual(['2026-11-27', '2026-11-27T18:00:00.000Z']);
  });
  it('a malformed instant is a typed error', () => {
    expect(() => sessionAtOrBefore(NaN)).toThrow(HorizonClockError);
    expect(() => etDateOfInstant('x')).toThrow(HorizonClockError);
  });
});

describe('tradingDaysCutoffMs — 00:00 ET of the Nth most recent trading day (today counts when it is one)', () => {
  it('Thursday, any hour → Tuesday 00:00 ET (EDT)', () => {
    expect(iso(tradingDaysCutoffMs(at('2026-10-15T15:00:00Z'), 3))).toBe('2026-10-13T04:00:00.000Z');
    expect(iso(tradingDaysCutoffMs(at('2026-10-16T03:59:00Z'), 3))).toBe('2026-10-13T04:00:00.000Z'); // 23:59 ET Thursday
  });
  it('a Saturday → Wednesday 00:00 ET (the weekend is no trading day)', () => {
    expect(iso(tradingDaysCutoffMs(at('2026-10-17T12:00:00Z'), 3))).toBe('2026-10-14T04:00:00.000Z');
  });
  it('across the clock change: Tuesday 3 Nov (EST) → Friday 30 Oct 00:00 EDT; Monday 2 Nov → Thursday 29 Oct', () => {
    expect(iso(tradingDaysCutoffMs(at('2026-11-03T15:00:00Z'), 3))).toBe('2026-10-30T04:00:00.000Z');
    expect(iso(tradingDaysCutoffMs(at('2026-11-02T15:00:00Z'), 3))).toBe('2026-10-29T04:00:00.000Z');
  });
  it('across Thanksgiving: the Monday after → Wednesday 25 Nov 00:00 EST', () => {
    expect(iso(tradingDaysCutoffMs(at('2026-11-30T15:00:00Z'), 3))).toBe('2026-11-25T05:00:00.000Z');
  });
  it('N = 1 → today\'s 00:00 ET; a bad N is a typed error', () => {
    expect(iso(tradingDaysCutoffMs(at('2026-10-15T15:00:00Z'), 1))).toBe('2026-10-15T04:00:00.000Z');
    expect(() => tradingDaysCutoffMs(at('2026-10-15T15:00:00Z'), 0)).toThrow(HorizonClockError);
  });
});
