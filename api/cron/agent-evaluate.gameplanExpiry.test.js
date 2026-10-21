// api/cron/agent-evaluate.gameplanExpiry.test.js
//
// A gameplan meeting expires at 4:00 PM ET on the ET day it is created, on
// any server timezone. Vercel runs in UTC, where the old local-time
// `setHours(16)` landed at 16:00 UTC — noon EDT, 11 AM EST. This file runs on a
// UTC clock (the first import) and checks the expiry on a summer (EDT) date and
// on a date after DST ends on Sun Nov 1 2026 (EST).
//
// BUILD_RULES §4 dependency-surface guard: the import below loads the REAL
// cron module unmocked, so it exercises the cron's whole import surface —
// including src/utils/marketCalendar.js. Never add vi.mock for it here; a
// renamed or broken export must fail THIS file's import.

// FIRST, before any module can build a local-time Date.
import '../_utils/__fixtures__/pinTimezoneUtc.js';
import { describe, it, expect } from 'vitest';
import { gameplanMeetingExpiresAt } from './agent-evaluate.js';

const etClock = (iso) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
}).format(new Date(iso));

describe('gameplanMeetingExpiresAt — 4:00 PM ET on a UTC clock', () => {
  it('the process clock is UTC', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('UTC');
    expect(new Date('2026-07-15T15:00:00.000Z').getTimezoneOffset()).toBe(0);
  });

  it('summer (EDT, UTC−4): 4:00 PM ET is 20:00 UTC', () => {
    const expiresAt = gameplanMeetingExpiresAt(new Date('2026-07-15T15:00:00.000Z')); // 11:00 AM EDT
    expect(expiresAt).toBe('2026-07-15T20:00:00.000Z');
    expect(etClock(expiresAt)).toBe('07/15/2026, 4:00 PM EDT');
  });

  it('after Nov 1 (EST, UTC−5): 4:00 PM ET is 21:00 UTC', () => {
    const expiresAt = gameplanMeetingExpiresAt(new Date('2026-11-02T15:00:00.000Z')); // 10:00 AM EST
    expect(expiresAt).toBe('2026-11-02T21:00:00.000Z');
    expect(etClock(expiresAt)).toBe('11/02/2026, 4:00 PM EST');
  });

  it('the day is the ET day, not the UTC day (9:30 PM EDT is already tomorrow in UTC)', () => {
    const expiresAt = gameplanMeetingExpiresAt(new Date('2026-07-16T01:30:00.000Z')); // Jul 15, 9:30 PM EDT
    expect(expiresAt).toBe('2026-07-15T20:00:00.000Z');
  });
});
