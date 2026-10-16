// src/components/CommandCenter/hub/hubDate.test.js
//
// Command Center hub, slice S1 — the header eyebrow's date (ET, BUILD_RULES
// §6) and the name it shows (prompt §4.2: the display name or username; no
// "Tester" literal).

import { describe, expect, it } from 'vitest';
import { formatHubDate, formatHubTime, headerName } from './hubDate';

describe('formatHubDate — weekday, month and day in US Eastern time', () => {
  it('reads the design\'s shape', () => {
    expect(formatHubDate(new Date('2026-10-07T15:00:00Z'))).toBe('Wednesday, October 7');
    expect(formatHubDate(new Date('2026-10-15T16:00:00Z'))).toBe('Thursday, October 15');
  });

  it('uses ET, not UTC: 02:00 UTC on Oct 16 is still Thursday the 15th in New York (EDT)', () => {
    expect(formatHubDate(new Date('2026-10-16T02:00:00Z'))).toBe('Thursday, October 15');
  });

  it('follows the DST change: 03:30 UTC on Nov 1 2026 is Saturday Oct 31 in New York (EDT), 04:30 UTC on Nov 2 is Sunday Nov 1 (EST)', () => {
    expect(formatHubDate(new Date('2026-11-01T03:30:00Z'))).toBe('Saturday, October 31');
    expect(formatHubDate(new Date('2026-11-02T04:30:00Z'))).toBe('Sunday, November 1');
  });

  it('an invalid date reads as nothing', () => {
    expect(formatHubDate(new Date('nope'))).toBe('');
    expect(formatHubDate(undefined)).toBe('');
    expect(formatHubDate('2026-10-15')).toBe('');
  });
});

describe('headerName — the display name, else the username, else none', () => {
  it.each([
    [{ displayName: 'Flash', username: 'flash' }, 'Flash'],
    [{ displayName: '  ', username: 'flash' }, 'flash'],
    [{ username: ' flash ' }, 'flash'],
    [{}, ''],
    [null, ''],
    [{ displayName: 42 }, ''],
  ])('%j → %j', (user, expected) => {
    expect(headerName(user)).toBe(expected);
  });
});

describe('formatHubTime — a clock time in US Eastern time (slice S2a: as-of and cooldown times)', () => {
  it('reads the hour and minute in ET, across the DST change', () => {
    expect(formatHubTime(Date.UTC(2026, 9, 14, 14, 40, 20))).toBe('10:40 AM');
    expect(formatHubTime(Date.UTC(2026, 10, 2, 15, 5))).toBe('10:05 AM');
  });

  it('roundUp reads the next whole minute, and a whole minute as itself', () => {
    expect(formatHubTime(Date.UTC(2026, 9, 14, 14, 40, 20), { roundUp: true })).toBe('10:41 AM');
    expect(formatHubTime(Date.UTC(2026, 9, 14, 14, 41), { roundUp: true })).toBe('10:41 AM');
  });

  it('anything but a finite number reads as nothing', () => {
    for (const v of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, '1791384000000', new Date()]) expect(formatHubTime(v)).toBe('');
  });
});
