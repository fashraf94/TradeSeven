// api/_utils/hypothesisRecords/horizon.test.js
//
// Pilot P1a — computeReviewDueAt (companion TREND_FOLLOWER_SETUP_DEFINITION_V1
// §6; acceptance row 8): each enum, weekend and outside-hours deploys, an
// early close, a holiday, the calendar's edge. Every expected instant below is
// HAND-COUNTED from the NYSE calendar (written out beside it), not re-derived
// with the module's own walk.
//
// Dependency-surface guard (BUILD_RULES §4): the import of horizon.js reaches
// api/_utils/marketSchedule.js → src/utils/marketCalendar.js; this import is
// the runtime guard that the chain stays Node-clean. Never mocked.

import { describe, it, expect } from 'vitest';
import { computeReviewDueAt, anchorSessionOf, HORIZON_WINDOW_SESSIONS, HorizonClockError } from './horizon.js';

const utc = (iso) => Date.parse(iso);
// 2026 Oct is EDT (UTC−4) until Sun Nov 1; then EST (UTC−5).
const WED_OCT7_1000ET = utc('2026-10-07T14:00:00Z');

describe('the window table is the blessed companion §6 (H1–H4)', () => {
  it('intraday 2 · swing 10 · positional 30 · longterm 60, frozen', () => {
    expect(HORIZON_WINDOW_SESSIONS).toEqual({ intraday: 2, swing: 10, positional: 30, longterm: 60 });
    expect(Object.isFrozen(HORIZON_WINDOW_SESSIONS)).toBe(true);
  });
});

describe('each enum, deployed inside a regular session (anchor = that session)', () => {
  it('unspecified → null (no clock; review_due comes at battle end)', () => {
    expect(computeReviewDueAt('unspecified', WED_OCT7_1000ET)).toBeNull();
  });
  it('intraday (2): anchor Wed Oct 7 → Thu 8 (1), Fri 9 (2) → Fri Oct 9 16:00 ET', () => {
    expect(computeReviewDueAt('intraday', WED_OCT7_1000ET)).toBe(utc('2026-10-09T20:00:00Z'));
  });
  it('swing (10): Oct 8, 9, 12, 13, 14, 15, 16, 19, 20, 21 → Wed Oct 21 16:00 ET', () => {
    expect(computeReviewDueAt('swing', WED_OCT7_1000ET)).toBe(utc('2026-10-21T20:00:00Z'));
  });
  it('positional (30): … Nov 16 (28), 17 (29), 18 (30) → Wed Nov 18 16:00 EST (the DST change is crossed)', () => {
    expect(computeReviewDueAt('positional', WED_OCT7_1000ET)).toBe(utc('2026-11-18T21:00:00Z'));
  });
  it('longterm (60): crosses Thanksgiving, both early closes, Christmas and New Year → Mon Jan 4 2027 16:00 EST', () => {
    // … Nov 25 (35), [Nov 26 holiday], Nov 27 (36, early close), … Dec 24 (55, early close), [Dec 25 holiday],
    // Dec 28 (56), 29 (57), 30 (58), 31 (59), [Jan 1 holiday], Jan 4 (60).
    expect(computeReviewDueAt('longterm', WED_OCT7_1000ET)).toBe(utc('2027-01-04T21:00:00Z'));
  });
});

describe('deploys outside regular hours anchor on the NEXT regular session', () => {
  it('before the open (Wed Oct 7 08:00 ET) → the anchor is that same day\'s session', () => {
    const t = utc('2026-10-07T12:00:00Z');
    expect(anchorSessionOf(t).etDate).toBe('2026-10-07');
    expect(computeReviewDueAt('intraday', t)).toBe(utc('2026-10-09T20:00:00Z'));
  });
  it('after the close (Wed Oct 7 17:00 ET) → anchor Thu Oct 8 → Fri 9 (1), Mon 12 (2)', () => {
    const t = utc('2026-10-07T21:00:00Z');
    expect(anchorSessionOf(t).etDate).toBe('2026-10-08');
    expect(computeReviewDueAt('intraday', t)).toBe(utc('2026-10-12T20:00:00Z'));
  });
  it('exactly AT the close (16:00:00 ET) is outside the session [open, close) → the next session', () => {
    expect(anchorSessionOf(utc('2026-10-07T20:00:00Z')).etDate).toBe('2026-10-08');
    expect(anchorSessionOf(utc('2026-10-07T19:59:59.999Z')).etDate).toBe('2026-10-07');
  });
  it('a weekend (Sat Oct 10) → anchor Mon Oct 12 → Tue 13 (1), Wed 14 (2)', () => {
    const t = utc('2026-10-10T15:00:00Z');
    expect(anchorSessionOf(t).etDate).toBe('2026-10-12');
    expect(computeReviewDueAt('intraday', t)).toBe(utc('2026-10-14T20:00:00Z'));
  });
  it('the ET date governs, not the UTC date: Fri Oct 9 21:30 ET is Sat in UTC, still after Friday\'s close → anchor Mon Oct 12', () => {
    expect(anchorSessionOf(utc('2026-10-10T01:30:00Z')).etDate).toBe('2026-10-12');
  });
});

describe('the calendar of record: early closes and holidays', () => {
  it('an EARLY CLOSE is the due instant when it is the Nth session: Tue Nov 24 → Wed 25 (1), [Thu 26 Thanksgiving], Fri 27 (2) → 13:00 EST', () => {
    expect(computeReviewDueAt('intraday', utc('2026-11-24T15:00:00Z'))).toBe(utc('2026-11-27T18:00:00Z'));
  });
  it('a deploy on a HOLIDAY (Thanksgiving) anchors on the next session (Fri Nov 27) → Mon 30 (1), Tue Dec 1 (2)', () => {
    const t = utc('2026-11-26T16:00:00Z');
    expect(anchorSessionOf(t).etDate).toBe('2026-11-27');
    expect(computeReviewDueAt('intraday', t)).toBe(utc('2026-12-01T21:00:00Z'));
  });
  it('a deploy after an early close (Fri Nov 27 14:00 EST) is outside hours → anchor Mon Nov 30 → Tue (1), Wed Dec 2 (2)', () => {
    const t = utc('2026-11-27T19:00:00Z');
    expect(anchorSessionOf(t).etDate).toBe('2026-11-30');
    expect(computeReviewDueAt('intraday', t)).toBe(utc('2026-12-02T21:00:00Z'));
  });
  it('the same instant for every symbol: the function takes no symbol (one calendar, crypto included — companion §6)', () => {
    expect(computeReviewDueAt.length).toBe(2);
  });
});

describe('typed failures — a clock is never guessed', () => {
  it('a walk past the maintained calendar (2027) throws calendar_unavailable, never null', () => {
    expect(() => computeReviewDueAt('longterm', utc('2027-12-01T15:00:00Z'))).toThrow(expect.objectContaining({ code: 'calendar_unavailable' }));
    expect(() => computeReviewDueAt('intraday', utc('2028-03-01T15:00:00Z'))).toThrow(HorizonClockError);
  });
  it('the last maintained days still resolve when the window fits: Tue Dec 28 2027 → Wed 29 (1), Thu 30 (2)', () => {
    expect(computeReviewDueAt('intraday', utc('2027-12-28T15:00:00Z'))).toBe(utc('2027-12-30T21:00:00Z'));
  });
  it('an unknown enum throws invalid_horizon; a non-finite instant throws invalid_instant', () => {
    expect(() => computeReviewDueAt('weekly', WED_OCT7_1000ET)).toThrow(expect.objectContaining({ code: 'invalid_horizon' }));
    for (const bad of [NaN, Infinity, '2026-10-07T14:00:00Z', null, undefined]) {
      expect(() => computeReviewDueAt('swing', bad)).toThrow(expect.objectContaining({ code: 'invalid_instant' }));
    }
  });
  it('unspecified returns null even before the instant is checked (no clock at all)', () => {
    expect(computeReviewDueAt('unspecified', NaN)).toBeNull();
  });
});
