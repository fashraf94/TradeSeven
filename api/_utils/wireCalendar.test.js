// api/_utils/wireCalendar.test.js
// deriveMarketDate determinism + the session walker (§9: walker 2026→2027
// traversal, 2028 coverage guard, deriveMarketDate ET/DST behavior).

import { describe, it, expect } from 'vitest';
import {
  deriveMarketDate,
  priorTradingSessions,
  wireLookbackDates,
  isTradingSession,
  CHAIN_WINDOW_SESSIONS,
} from './wireCalendar.js';

describe('deriveMarketDate', () => {
  it('requires an explicit instant — no wall-clock default', () => {
    expect(() => deriveMarketDate()).toThrow(/explicit instant/);
    expect(() => deriveMarketDate('garbage')).toThrow(/invalid instant/);
  });

  it('is deterministic for a fixed instant (retry-immutable)', () => {
    const instant = new Date('2026-07-24T18:00:00Z');
    expect(deriveMarketDate(instant)).toBe('2026-07-24');
    expect(deriveMarketDate(instant.getTime())).toBe('2026-07-24');
    expect(deriveMarketDate(instant.toISOString())).toBe('2026-07-24');
  });

  it('uses the ET calendar day, not UTC (00:30 UTC → previous ET date)', () => {
    // 2026-07-24T00:30Z is 2026-07-23 20:30 EDT
    expect(deriveMarketDate(new Date('2026-07-24T00:30:00Z'))).toBe('2026-07-23');
    // EST side: 2026-12-10T02:00Z is 2026-12-09 21:00 EST
    expect(deriveMarketDate(new Date('2026-12-10T02:00:00Z'))).toBe('2026-12-09');
    // and 13:00 UTC is the same ET day in both regimes
    expect(deriveMarketDate(new Date('2026-12-10T13:00:00Z'))).toBe('2026-12-10');
  });
});

describe('priorTradingSessions — weekends and holidays', () => {
  it('walks over a plain weekend', () => {
    // Mon 2026-07-27 → prior 5 sessions are Mon-Fri of the prior week
    expect(priorTradingSessions('2026-07-27', 5)).toEqual([
      '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24',
    ]);
  });

  it('skips a NYSE holiday (Labor Day 2026-09-07)', () => {
    expect(priorTradingSessions('2026-09-08', 3)).toEqual([
      '2026-09-02', '2026-09-03', '2026-09-04',
    ]);
  });

  it('traverses the 2026→2027 year boundary with 2027 holidays honored', () => {
    // Jan 4 2027 (Mon): walk back over New Year's Day (Fri 2027-01-01, holiday)
    expect(priorTradingSessions('2027-01-04', 3)).toEqual([
      '2026-12-29', '2026-12-30', '2026-12-31',
    ]);
    // MLK 2027-01-18 (Mon) is a holiday: from Tue Jan 19 the prior session is Fri Jan 15
    expect(priorTradingSessions('2027-01-19', 1)).toEqual(['2027-01-15']);
  });

  it('anchor need not be a session (Sunday preview anchor works)', () => {
    // Sunday 2026-07-26 → prior sessions end Friday 2026-07-24
    const sessions = priorTradingSessions('2026-07-26', 2);
    expect(sessions).toEqual(['2026-07-23', '2026-07-24']);
  });
});

describe('coverage guard (2028+ / pre-2026)', () => {
  it('refuses to walk beyond the maintained horizon', () => {
    expect(() => priorTradingSessions('2028-01-05', 5)).toThrow(/maintained NYSE holiday horizon/);
    expect(() => isTradingSession('2028-07-04')).toThrow(/maintained NYSE holiday horizon/);
  });

  it('refuses a backward walk that crosses below the floor (early Jan 2026)', () => {
    expect(() => priorTradingSessions('2026-01-02', 5)).toThrow(/maintained NYSE holiday horizon/);
  });
});

describe('wireLookbackDates', () => {
  it('returns 5 strictly-prior sessions + the anchor itself, oldest first', () => {
    const window = wireLookbackDates('2026-07-24');
    expect(window).toHaveLength(CHAIN_WINDOW_SESSIONS + 1);
    expect(window[window.length - 1]).toBe('2026-07-24');
    expect(window[0] < window[window.length - 1]).toBe(true);
    expect(window).toEqual([
      '2026-07-17', '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24',
    ]);
  });
});
