// api/_utils/wireCalendar.startOfEtDay.test.js
// R-B2 helpers added by the Recap Restoration arc: the DST-correct ET
// day-start (replacing the hardcoded -05:00 idiom, an hour early all
// summer) and the exported assertMaintainedYear horizon guard the recap
// writers assert before walking getPreviousTradingDay.

import { describe, it, expect } from 'vitest';
import { startOfEtDay, assertMaintainedYear, deriveMarketDate } from './wireCalendar.js';
import { getPreviousTradingDay } from './marketSchedule.js';

describe('startOfEtDay — DST-correct ET midnight', () => {
  it('EDT (summer): midnight ET = 04:00Z', () => {
    const start = startOfEtDay(new Date('2026-07-30T15:00:00Z'));
    expect(start.toISOString()).toBe('2026-07-30T04:00:00.000Z');
  });
  it('EST (winter): midnight ET = 05:00Z', () => {
    const start = startOfEtDay(new Date('2026-01-15T15:00:00Z'));
    expect(start.toISOString()).toBe('2026-01-15T05:00:00.000Z');
  });
  it('late-UTC instants resolve to the ET day, not the UTC day', () => {
    // 00:30Z Jul 31 = 20:30 ET Jul 30 → the ET day is Jul 30.
    const start = startOfEtDay(new Date('2026-07-31T00:30:00Z'));
    expect(start.toISOString()).toBe('2026-07-30T04:00:00.000Z');
    expect(deriveMarketDate(start)).toBe('2026-07-30');
  });
});

describe('assertMaintainedYear on the recap walker path (R-B2)', () => {
  it('passes maintained years', () => {
    expect(() => assertMaintainedYear('2026-07-30')).not.toThrow();
    expect(() => assertMaintainedYear('2027-12-31')).not.toThrow();
  });
  it('throws beyond the horizon — the 2028 silent-mislabel gap is closed', () => {
    expect(() => assertMaintainedYear('2028-01-05')).toThrow(/maintained NYSE holiday horizon/);
    expect(() => assertMaintainedYear('2025-12-31')).toThrow(/maintained NYSE holiday horizon/);
  });
  it('guarded walk: C2 fixtures still hold inside the horizon', () => {
    // Monday → Friday.
    assertMaintainedYear('2026-07-27');
    expect(getPreviousTradingDay('2026-07-27')).toBe('2026-07-24');
    // Day after Juneteenth (Fri 2026-06-19) → pre-holiday Thursday.
    assertMaintainedYear('2026-06-22');
    expect(getPreviousTradingDay('2026-06-22')).toBe('2026-06-18');
  });
});
