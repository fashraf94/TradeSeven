import { describe, it, expect } from 'vitest';
import {
  mondayOfIsoWeek,
  draftLockInstant,
  countdownSegments,
  DRAFT_LOCK_UTC_HOUR,
} from './draftLockTime';
import { isoWeekString } from '../../../constants/leagueTournament';

describe('mondayOfIsoWeek', () => {
  it('returns the Monday (00:00 UTC) of a known ISO week', () => {
    // 2026-W01: Jan 4 2026 is a Sunday → week-1 Monday = Dec 29 2025.
    const mon = mondayOfIsoWeek('2026-W01');
    expect(mon.getUTCFullYear()).toBe(2025);
    expect(mon.getUTCMonth()).toBe(11); // December
    expect(mon.getUTCDate()).toBe(29);
    expect(mon.getUTCDay()).toBe(1);    // Monday
    expect(mon.getUTCHours()).toBe(0);
  });

  it('handles the year-boundary week 2027-W01', () => {
    // Jan 4 2027 is a Monday → week-1 Monday = Jan 4 2027.
    const mon = mondayOfIsoWeek('2027-W01');
    expect(mon.getUTCDay()).toBe(1);
    expect(mon.getUTCFullYear()).toBe(2027);
    expect(mon.getUTCMonth()).toBe(0);
    expect(mon.getUTCDate()).toBe(4);
  });

  it('round-trips against isoWeekString for a long run of Mondays', () => {
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.UTC(2026, 0, 5 + i * 7)); // Jan 5 2026 is a Monday
      const key = isoWeekString(d);
      const back = mondayOfIsoWeek(key);
      expect(back.getTime()).toBe(d.getTime());
    }
  });

  it('returns null for a malformed week key', () => {
    expect(mondayOfIsoWeek('nope')).toBeNull();
    expect(mondayOfIsoWeek('2026-W99')).toBeNull();
    expect(mondayOfIsoWeek('2026-13')).toBeNull();
    expect(mondayOfIsoWeek(undefined)).toBeNull();
  });
});

describe('draftLockInstant', () => {
  it('is that Monday at DRAFT_LOCK_UTC_HOUR', () => {
    const d = new Date(draftLockInstant('2027-W01'));
    expect(d.getUTCDate()).toBe(4);
    expect(d.getUTCHours()).toBe(DRAFT_LOCK_UTC_HOUR);
    expect(d.getUTCMinutes()).toBe(0);
  });

  it('null for a malformed key', () => {
    expect(draftLockInstant('bad')).toBeNull();
  });
});

describe('countdownSegments', () => {
  it('segments a positive remainder into d/h/m', () => {
    const ms = ((2 * 24 + 4) * 60 + 12) * 60 * 1000; // 2d 4h 12m
    expect(countdownSegments(ms)).toEqual({ past: false, d: 2, h: 4, m: 12 });
  });

  it('a sub-hour remainder', () => {
    const ms = 8 * 60 * 1000 + 40 * 1000; // 8m 40s
    expect(countdownSegments(ms)).toEqual({ past: false, d: 0, h: 0, m: 8 });
  });

  it('non-positive remainder → past', () => {
    expect(countdownSegments(0)).toEqual({ past: true, d: 0, h: 0, m: 0 });
    expect(countdownSegments(-5000)).toEqual({ past: true, d: 0, h: 0, m: 0 });
  });
});
