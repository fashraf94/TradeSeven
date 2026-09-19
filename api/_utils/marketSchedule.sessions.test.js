// api/_utils/marketSchedule.sessions.test.js
// Intraday Data — Build 1, contract §5.1 / G5: getSessionForDate and
// getPreviousSessionDate on the canonical calendar (marketSchedule.js).
import { describe, it, expect } from 'vitest';
import { getSessionForDate, getPreviousSessionDate, MAINTAINED_HOLIDAY_YEARS } from './marketSchedule.js';

describe('getSessionForDate — the calendar of record, as instants', () => {
  it('a normal EDT session: 09:30–16:00 ET = 13:30–20:00 UTC, 390 minutes', () => {
    const s = getSessionForDate('2026-09-17');
    expect(s).toEqual({
      etDate: '2026-09-17', isTradingDay: true, isEarlyClose: false,
      openMs: Date.UTC(2026, 8, 17, 13, 30, 0), closeMs: Date.UTC(2026, 8, 17, 20, 0, 0), sessionLenMin: 390, previousEtDate: '2026-09-16',
    });
  });
  it('a normal EST session: 09:30–16:00 ET = 14:30–21:00 UTC (no hand-rolled offset — Intl resolves DST)', () => {
    const s = getSessionForDate('2026-12-15');
    expect(s.openMs).toBe(Date.UTC(2026, 11, 15, 14, 30, 0));
    expect(s.closeMs).toBe(Date.UTC(2026, 11, 15, 21, 0, 0));
    expect(s.sessionLenMin).toBe(390);
  });
  it('the two 2026 early closes are 13:00 ET (210 minutes): Nov 27 (EST) and Dec 24 (EST)', () => {
    const nov = getSessionForDate('2026-11-27');
    expect(nov).toMatchObject({ isTradingDay: true, isEarlyClose: true, sessionLenMin: 210, previousEtDate: '2026-11-25' });
    expect(nov.closeMs).toBe(Date.UTC(2026, 10, 27, 18, 0, 0));
    const dec = getSessionForDate('2026-12-24');
    expect(dec).toMatchObject({ isEarlyClose: true, sessionLenMin: 210, previousEtDate: '2026-12-23' });
    expect(getSessionForDate('2027-11-26')).toMatchObject({ isEarlyClose: true, sessionLenMin: 210 });
  });
  it('weekends and holidays are non-trading with null bounds; the previous session still resolves', () => {
    expect(getSessionForDate('2026-09-19')).toMatchObject({ isTradingDay: false, openMs: null, closeMs: null, sessionLenMin: null, previousEtDate: '2026-09-18' });
    expect(getSessionForDate('2026-09-07')).toMatchObject({ isTradingDay: false, previousEtDate: '2026-09-04' }); // Labor Day
    expect(getSessionForDate('2026-11-26')).toMatchObject({ isTradingDay: false, previousEtDate: '2026-11-25' }); // Thanksgiving
  });
  it('outside the maintained horizon or malformed → null (calendar_missing — never a guess)', () => {
    expect(MAINTAINED_HOLIDAY_YEARS).toEqual([2026, 2027]);
    expect(getSessionForDate('2028-01-05')).toBeNull();
    expect(getSessionForDate('2025-12-31')).toBeNull();
    expect(getSessionForDate('2026-9-17')).toBeNull();
    expect(getSessionForDate(null)).toBeNull();
    expect(getSessionForDate('2026-02-30')).toBeNull();
  });
  it('the DST transition days themselves resolve to the right instants (Mar 8 2026 and Nov 1 2026 are Sundays; the Mondays after)', () => {
    expect(getSessionForDate('2026-03-09').openMs).toBe(Date.UTC(2026, 2, 9, 13, 30, 0)); // EDT
    expect(getSessionForDate('2026-03-06').openMs).toBe(Date.UTC(2026, 2, 6, 14, 30, 0)); // EST, the Friday before
    expect(getSessionForDate('2026-11-02').openMs).toBe(Date.UTC(2026, 10, 2, 14, 30, 0)); // EST
    expect(getSessionForDate('2026-10-30').openMs).toBe(Date.UTC(2026, 9, 30, 13, 30, 0)); // EDT
  });
});

describe('getPreviousSessionDate', () => {
  it('walks back over weekends and holidays', () => {
    expect(getPreviousSessionDate('2026-09-21')).toBe('2026-09-18'); // Monday → Friday
    expect(getPreviousSessionDate('2026-09-08')).toBe('2026-09-04'); // Tuesday after Labor Day → the Friday before
    expect(getPreviousSessionDate('2026-11-27')).toBe('2026-11-25'); // after Thanksgiving
    expect(getPreviousSessionDate('2026-01-02')).toBeNull();          // 2026-01-01 holiday, then 2025 — outside the horizon
    expect(getPreviousSessionDate('bad')).toBeNull();
  });
});
