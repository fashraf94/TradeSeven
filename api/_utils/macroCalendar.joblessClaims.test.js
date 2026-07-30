// api/_utils/macroCalendar.joblessClaims.test.js
// R-A1: jobless claims added as a macroCalendar category. Weekly Thursday
// 8:30 AM ET; DOL releases EARLIER (prior business day) when Thursday is a
// market holiday — the opposite of NFP's forward shift.

import { describe, it, expect } from 'vitest';
import { getJoblessClaimsDates, getMacroEventsInWindow } from './macroCalendar.js';

describe('getJoblessClaimsDates (R-A1)', () => {
  const claims2026 = getJoblessClaimsDates(2026);

  it('emits one release per week with the fixed shape', () => {
    expect(claims2026.length).toBeGreaterThanOrEqual(52);
    for (const e of claims2026) {
      expect(e.category).toBe('Jobless Claims');
      expect(e.impact).toBe('medium');
      expect(e.time).toBe('8:30 AM ET');
      expect(e.event).toBe('Initial Jobless Claims');
    }
  });

  it('releases on Thursday except holiday weeks', () => {
    const offThursday = claims2026.filter((e) => e.day !== 'Thursday');
    // Every non-Thursday entry must be a holiday shift (earlier weekday).
    for (const e of offThursday) {
      expect(['Monday', 'Tuesday', 'Wednesday']).toContain(e.day);
    }
    expect(claims2026.filter((e) => e.day === 'Thursday').length).toBeGreaterThanOrEqual(50);
  });

  it('Thanksgiving 2026 (Thu Nov 26, market holiday) shifts EARLIER to Wed Nov 25', () => {
    const dates = claims2026.map((e) => e.date);
    expect(dates).not.toContain('2026-11-26');
    expect(dates).toContain('2026-11-25');
    const shifted = claims2026.find((e) => e.date === '2026-11-25');
    expect(shifted.day).toBe('Wednesday');
  });

  it('joins the unified window query (Tier-1 membership by array set)', () => {
    // Thu 2026-07-30: claims week + PCE (June) + GDP Q2 advance.
    const events = getMacroEventsInWindow({ fromDate: '2026-07-30', toDate: '2026-07-30' });
    const categories = events.map((e) => e.category);
    expect(categories).toContain('Jobless Claims');
    expect(categories).toContain('PCE');
    expect(categories).toContain('GDP');
  });
});
