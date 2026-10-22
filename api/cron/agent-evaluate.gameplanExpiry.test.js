// api/cron/agent-evaluate.gameplanExpiry.test.js
//
// A gameplan meeting expires at the earlier of 4:00 PM ET on the ET day it is
// created and 60 minutes after it is created, on any server timezone. Vercel
// runs in UTC, where the old local-time `setHours(16)` landed at 16:00 UTC —
// noon EDT, 11 AM EST. This file runs on a UTC clock (the first import) and
// checks the 60-minute cap, the 4:00 PM cap on a summer (EDT) date, and the
// 4:00 PM cap on a date after DST ends on Sun Nov 1 2026 (EST).
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

describe('gameplanMeetingExpiresAt — the earlier of 4:00 PM ET and 60 minutes, on a UTC clock', () => {
  it('the process clock is UTC', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('UTC');
    expect(new Date('2026-07-15T15:00:00.000Z').getTimezoneOffset()).toBe(0);
  });

  it('created 10:30 AM ET: expires 60 minutes later, 11:30 AM ET', () => {
    const expiresAt = gameplanMeetingExpiresAt(new Date('2026-07-15T14:30:00.000Z')); // 10:30 AM EDT
    expect(expiresAt).toBe('2026-07-15T15:30:00.000Z');
    expect(etClock(expiresAt)).toBe('07/15/2026, 11:30 AM EDT');
  });

  it('created 3:30 PM ET (EDT, UTC−4): expires at 4:00 PM ET, 20:00 UTC', () => {
    const expiresAt = gameplanMeetingExpiresAt(new Date('2026-07-15T19:30:00.000Z')); // 3:30 PM EDT
    expect(expiresAt).toBe('2026-07-15T20:00:00.000Z');
    expect(etClock(expiresAt)).toBe('07/15/2026, 4:00 PM EDT');
  });

  it('after Nov 1 (EST, UTC−5), created 3:30 PM ET: expires at 4:00 PM ET, 21:00 UTC', () => {
    const expiresAt = gameplanMeetingExpiresAt(new Date('2026-11-02T20:30:00.000Z')); // 3:30 PM EST
    expect(expiresAt).toBe('2026-11-02T21:00:00.000Z');
    expect(etClock(expiresAt)).toBe('11/02/2026, 4:00 PM EST');
  });

  it('the day is the ET day, not the UTC day (9:30 PM EDT is already tomorrow in UTC)', () => {
    const expiresAt = gameplanMeetingExpiresAt(new Date('2026-07-16T01:30:00.000Z')); // Jul 15, 9:30 PM EDT
    expect(expiresAt).toBe('2026-07-15T20:00:00.000Z');
  });
});
