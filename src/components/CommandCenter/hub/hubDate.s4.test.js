// src/components/CommandCenter/hub/hubDate.s4.test.js
//
// Command Center hub, slice S4 — the two formatters Activity and the brief add to hub/hubDate.js: Activity's absolute ET time, and
// the brief's market date, which is formatted from the string's own parts and never moved by a time zone.

import { afterEach, describe, expect, it } from 'vitest';
import { formatHubDayTime, formatHubMarketDate } from './hubDate';

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('formatHubDayTime — Activity\'s absolute time, read in ET', () => {
  it('writes the month, the day and the clock in Eastern time', () => {
    // 20:00 UTC on Oct 3 is 4:00 PM EDT.
    expect(formatHubDayTime(Date.UTC(2026, 9, 3, 20, 0))).toMatch(/^Oct 3, 4:00\s?PM$/);
    // ...and across the evening boundary the ET day, not the UTC one: 02:30 UTC on Oct 4 is 10:30 PM on Oct 3.
    expect(formatHubDayTime(Date.UTC(2026, 9, 4, 2, 30))).toMatch(/^Oct 3, 10:30\s?PM$/);
  });

  it('is the same wherever the machine is', () => {
    const ms = Date.UTC(2026, 9, 3, 20, 0);
    const answers = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo'].map((zone) => {
      process.env.TZ = zone;
      return formatHubDayTime(ms);
    });
    expect(new Set(answers).size).toBe(1);
  });

  it('is empty for anything but a finite number', () => {
    for (const bad of [null, undefined, NaN, Infinity, '2026-10-03', {}, []]) expect(formatHubDayTime(bad), String(bad)).toBe('');
  });
});

describe('formatHubMarketDate — the brief\'s forDate, a market-day label', () => {
  it('writes the weekday, the month and the day of the date it was given', () => {
    expect(formatHubMarketDate('2026-10-07')).toBe('Wed Oct 7');
    expect(formatHubMarketDate('2026-10-23')).toBe('Fri Oct 23');
    expect(formatHubMarketDate('2026-01-01')).toBe('Thu Jan 1');
  });

  it('never moves a bare date through a time zone: the day is the string\'s whatever the machine\'s zone', () => {
    for (const zone of ['UTC', 'America/Los_Angeles', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati']) {
      process.env.TZ = zone;
      expect(formatHubMarketDate('2026-10-07'), zone).toBe('Wed Oct 7');
    }
  });

  it('is empty for anything that is not a real calendar date written YYYY-MM-DD', () => {
    for (const bad of ['', null, undefined, 20261007, '2026-10-7', '2026-13-01', '2026-02-30', '2026-00-10', 'Oct 7', '2026-10-07T00:00:00Z', ' 2026-10-07']) {
      expect(formatHubMarketDate(bad), String(bad)).toBe('');
    }
  });

  it('knows leap day', () => {
    expect(formatHubMarketDate('2028-02-29')).toBe('Tue Feb 29');
    expect(formatHubMarketDate('2027-02-29')).toBe('');
  });
});
