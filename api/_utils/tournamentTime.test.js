// api/_utils/tournamentTime.test.js
//
// ET wall-clock helpers for the tournament user layer. Same injectable-`now`
// DST battery style as api/cron/process-draft-claims.test.js (2026 DST
// transitions: spring-forward Sun Mar 8, fall-back Sun Nov 1).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of the REAL
// tournamentTime module below is the runtime guard for its import of
// api/_utils/marketSchedule.js — it explodes in this Node test environment
// if a browser-only dependency ever enters that transitive graph. Never mock
// this import.

import { describe, it, expect } from 'vitest';
import {
  getEtParts,
  formatEtDate,
  isMarketOpenAt,
  getTournamentClaimWindow,
  parseSimulatedNow,
} from './tournamentTime.js';

describe('getEtParts / formatEtDate', () => {
  it('converts a UTC instant to ET wall-clock parts (EDT, UTC-4)', () => {
    const parts = getEtParts(new Date('2026-06-10T14:05:00Z'));
    expect(parts).toEqual({ weekday: 'Wed', date: '2026-06-10', minutes: 10 * 60 + 5, etTime: '10:05' });
  });

  it('converts in winter (EST, UTC-5)', () => {
    const parts = getEtParts(new Date('2026-01-14T14:05:00Z'));
    expect(parts.etTime).toBe('09:05');
    expect(parts.date).toBe('2026-01-14');
  });

  it('crosses UTC midnight into the prior ET date', () => {
    expect(formatEtDate(new Date('2026-06-11T02:00:00Z'))).toBe('2026-06-10');
  });

  it('renders ET midnight as 00, not 24 (h23 guard)', () => {
    expect(getEtParts(new Date('2026-06-10T04:00:00Z')).etTime).toBe('00:00');
  });
});

describe('isMarketOpenAt — regular session, ET', () => {
  it('weekday mid-session is open; pre-open and at-the-close are not', () => {
    expect(isMarketOpenAt(new Date('2026-06-10T14:00:00Z'))).toBe(true);  // 10:00 ET
    expect(isMarketOpenAt(new Date('2026-06-10T13:29:00Z'))).toBe(false); // 9:29 ET
    expect(isMarketOpenAt(new Date('2026-06-10T13:30:00Z'))).toBe(true);  // 9:30 ET — open is inclusive
    expect(isMarketOpenAt(new Date('2026-06-10T20:00:00Z'))).toBe(false); // 16:00 ET — close is exclusive
    expect(isMarketOpenAt(new Date('2026-06-10T19:59:00Z'))).toBe(true);  // 15:59 ET
  });

  it('weekends and NYSE holidays are closed all day', () => {
    expect(isMarketOpenAt(new Date('2026-06-13T14:00:00Z'))).toBe(false); // Sat
    expect(isMarketOpenAt(new Date('2026-06-19T14:00:00Z'))).toBe(false); // Juneteenth (Fri)
  });

  it('early-close days (1:00 PM ET) close at 13:00, not 16:00', () => {
    // Fri 2026-11-27 (day after Thanksgiving) is EST, UTC-5.
    expect(isMarketOpenAt(new Date('2026-11-27T17:59:00Z'))).toBe(true);  // 12:59 ET
    expect(isMarketOpenAt(new Date('2026-11-27T18:30:00Z'))).toBe(false); // 13:30 ET
  });

  it('DST transitions: 13:30 UTC is the open in EDT but pre-open in EST', () => {
    expect(isMarketOpenAt(new Date('2026-03-09T13:30:00Z'))).toBe(true);  // Mon after spring-forward (EDT)
    expect(isMarketOpenAt(new Date('2026-11-02T13:30:00Z'))).toBe(false); // Mon after fall-back (EST) — 8:30 ET
    expect(isMarketOpenAt(new Date('2026-11-02T14:30:00Z'))).toBe(true);  // 9:30 ET
  });
});

describe('getTournamentClaimWindow — overnight placement window (legacy semantics)', () => {
  it('opens weekday evenings from 4:00 PM ET', () => {
    expect(getTournamentClaimWindow(new Date('2026-06-10T21:00:00Z'))).toEqual({
      isOpen: true, etTime: '17:00', reason: null,
    });
    expect(getTournamentClaimWindow(new Date('2026-06-10T19:59:00Z')).isOpen).toBe(false); // 15:59 ET
    expect(getTournamentClaimWindow(new Date('2026-06-10T20:00:00Z')).isOpen).toBe(true);  // 16:00 ET
  });

  it('stays open through the overnight into 9:24 AM ET inclusive, shut at 9:25', () => {
    expect(getTournamentClaimWindow(new Date('2026-06-11T07:00:00Z')).isOpen).toBe(true);  // 3:00 AM ET Thu
    expect(getTournamentClaimWindow(new Date('2026-06-11T13:24:00Z')).isOpen).toBe(true);  // 9:24 ET
    expect(getTournamentClaimWindow(new Date('2026-06-11T13:25:00Z'))).toEqual({
      isOpen: false, etTime: '09:25', reason: 'market_hours',
    });
  });

  it('market hours are closed', () => {
    expect(getTournamentClaimWindow(new Date('2026-06-10T18:00:00Z'))).toEqual({
      isOpen: false, etTime: '14:00', reason: 'market_hours',
    });
  });

  it('Friday evening never opens (no Saturday processing); Friday morning is normal', () => {
    expect(getTournamentClaimWindow(new Date('2026-06-12T21:00:00Z'))).toEqual({
      isOpen: false, etTime: '17:00', reason: 'friday_evening',
    });
    expect(getTournamentClaimWindow(new Date('2026-06-12T12:00:00Z')).isOpen).toBe(true); // 8:00 AM ET Fri
  });

  it('weekends are closed in both window halves', () => {
    expect(getTournamentClaimWindow(new Date('2026-06-13T21:00:00Z')).reason).toBe('weekend'); // Sat 17:00 ET
    expect(getTournamentClaimWindow(new Date('2026-06-14T12:00:00Z')).reason).toBe('weekend'); // Sun 8:00 ET
  });

  it('DST: 21:00 UTC is in the evening window in EDT (17:00 ET) but not at 20:00 UTC in EST', () => {
    expect(getTournamentClaimWindow(new Date('2026-01-14T21:00:00Z')).isOpen).toBe(true);  // 16:00 EST
    expect(getTournamentClaimWindow(new Date('2026-01-14T20:59:00Z')).isOpen).toBe(false); // 15:59 EST
  });
});

describe('parseSimulatedNow — the shared admin time-control contract (P3b)', () => {
  it('absent → the real clock; a valid ISO string → that instant', () => {
    const real = parseSimulatedNow(null);
    expect(real.now).toBeInstanceOf(Date);
    expect(real.error).toBeUndefined();
    const sim = parseSimulatedNow('2026-06-15T12:00:00.000Z');
    expect(sim.now.toISOString()).toBe('2026-06-15T12:00:00.000Z');
  });

  it('rejects non-strings (a bare JSON number would silently bank against 1970) and junk strings', () => {
    expect(parseSimulatedNow(123).error).toMatch(/ISO-8601/);
    expect(parseSimulatedNow('not-a-date').error).toMatch(/ISO-8601/);
    expect(parseSimulatedNow(123).now).toBeUndefined();
  });
});
