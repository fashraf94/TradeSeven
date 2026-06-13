// src/utils/claimWindowMirror.test.js
//
// P7 (B) — the DISPLAY-ONLY claim-window mirror is parity-locked against the
// SERVER authority. getClaimWindowDisplay (client, src) must agree with
// getTournamentClaimWindow (server, api) on { isOpen, etTime, reason } across a
// time grid that crosses the cases where the LOGIC (not just the minutes)
// could drift: a DST spring-forward and fall-back, every Friday evening, every
// weekend, and the 16:00 / 09:24 boundary minutes. The mirror never gates a
// submit — this test guarantees the countdown it drives never lies relative to
// the server's 403 authority.
//
// DEPENDENCY-SURFACE NOTE: importing the real server tournamentTime.js in this
// Node test is the parity source — never mock it.

import { describe, it, expect } from 'vitest';
import { getClaimWindowDisplay } from './tournamentSurfaces';
import { getTournamentClaimWindow } from '../../api/_utils/tournamentTime.js';

function pick({ isOpen, etTime, reason }) { return { isOpen, etTime, reason }; }

function sweep(startIso, days) {
  const start = Date.parse(startIso);
  const stepMs = 17 * 60 * 1000;          // 17 min — hits every boundary minute over the span
  const steps = Math.ceil((days * 24 * 60) / 17);
  const mismatches = [];
  for (let i = 0; i < steps; i++) {
    const d = new Date(start + i * stepMs);
    const client = pick(getClaimWindowDisplay(d));
    const server = pick(getTournamentClaimWindow(d));
    if (JSON.stringify(client) !== JSON.stringify(server)) {
      mismatches.push({ at: d.toISOString(), client, server });
    }
  }
  return mismatches;
}

describe('claim-window mirror ↔ server parity', () => {
  it('agrees across a normal week (weekends + Friday evening + boundaries)', () => {
    expect(sweep('2026-06-08T00:00:00Z', 9)).toEqual([]);
  });

  it('agrees across the DST spring-forward (2026-03-08)', () => {
    expect(sweep('2026-03-06T00:00:00Z', 6)).toEqual([]);
  });

  it('agrees across the DST fall-back (2026-11-01)', () => {
    expect(sweep('2026-10-30T00:00:00Z', 5)).toEqual([]);
  });

  it('named cases: weekend, Friday evening, market hours, overnight-open', () => {
    // Sat 14:00 ET → weekend
    expect(pick(getClaimWindowDisplay(new Date('2026-06-13T18:00:00Z')))).toEqual(
      pick(getTournamentClaimWindow(new Date('2026-06-13T18:00:00Z'))));
    expect(getClaimWindowDisplay(new Date('2026-06-13T18:00:00Z')).reason).toBe('weekend');
    // Fri 20:00 ET → friday_evening (closed)
    expect(getClaimWindowDisplay(new Date('2026-06-12T24:00:00Z')).reason).toBe('friday_evening');
    // Wed 14:00 ET → market_hours (closed), countdown to the 16:00 open
    const mh = getClaimWindowDisplay(new Date('2026-06-10T18:00:00Z'));
    expect(mh.isOpen).toBe(false);
    expect(mh.reason).toBe('market_hours');
    expect(mh.countdownTo).toBe('open');
    // Wed 22:00 ET → open overnight, countdown to the 09:24 close (tomorrow)
    const open = getClaimWindowDisplay(new Date('2026-06-11T02:00:00Z'));
    expect(open.isOpen).toBe(true);
    expect(open.countdownTo).toBe('close');
    expect(open.countdownMinutes).toBeGreaterThan(0);
  });
});
