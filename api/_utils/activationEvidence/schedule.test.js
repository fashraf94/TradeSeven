// api/_utils/activationEvidence/schedule.test.js
//
// ID-1 Build 2 — finalisation-due and the horizon (contract §4.3), in both
// seasons. Due-ness is a predicate checked on every run, so these rows probe
// instants around each boundary, never one exact minute.

import { describe, it, expect } from 'vitest';
import { finalizationCutoffOf, isFinalizationDue, isBeyondHorizon, scheduleOf, lastTradingDayOf, expiresAtMsOf, isTerminal } from './schedule.js';
import { tieredFullDayTarget } from '../../../src/utils/stockAdmissionWindow.js';
import { getSessionForDate } from '../marketSchedule.js';

const ms = (iso) => Date.parse(iso);
const battleOn = (days, expiresAt, status = 'active') => ({ status, expiresAt, timing: { tradingDays: days } });
const due = (b, iso) => isFinalizationDue(scheduleOf(b), ms(iso));
const storedDue = (b, iso) => { const s = scheduleOf(b); return isFinalizationDue({ terminal: false, expiresAtMs: s.expiresAtMs, cutoffAtMs: s.cutoffAtMs }, ms(iso)); };

// The real expiries createAgentBattle stores (stockAdmissionWindow.js tieredFullDayTarget), crypto rosters.
const SUMMER = tieredFullDayTarget(ms('2026-07-15T14:00:00Z'), true); // EDT
const WINTER = tieredFullDayTarget(ms('2026-11-05T15:00:00Z'), true); // EST

describe('the cutoff: 01:30 UTC on the UTC day after the LAST trading day', () => {
  it('the stored expiries are 00:00 UTC in summer and 01:00 UTC in winter (20:00 ET)', () => {
    expect(SUMMER).toMatchObject({ status: 'ok', expiresAt: '2026-07-16T00:00:00.000Z', targetDateStr: '2026-07-15' });
    expect(WINTER).toMatchObject({ status: 'ok', expiresAt: '2026-11-06T01:00:00.000Z', targetDateStr: '2026-11-05' });
  });
  it('summer: no null before the cutoff; nulls allowed at 01:30 and 01:45', () => {
    const b = battleOn(['2026-07-15'], SUMMER.expiresAt);
    expect(finalizationCutoffOf(b)).toBe(ms('2026-07-16T01:30:00Z'));
    expect(['2026-07-15T23:45:00Z', '2026-07-16T00:00:00Z', '2026-07-16T00:45:00Z', '2026-07-16T01:00:00Z', '2026-07-16T01:15:00Z', '2026-07-16T01:29:59.999Z'].map((t) => due(b, t))).toEqual([false, false, false, false, false, false]);
    expect(['2026-07-16T01:30:00Z', '2026-07-16T01:45:00Z', '2026-07-16T13:00:00Z'].map((t) => due(b, t))).toEqual([true, true, true]);
  });
  it('winter: a 00:45 run is before expiry and writes none; 01:00 and 01:15 are past expiry but before the cutoff; 01:30 and 01:45 may finalise', () => {
    const b = battleOn(['2026-11-05'], WINTER.expiresAt);
    expect(finalizationCutoffOf(b)).toBe(ms('2026-11-06T01:30:00Z'));
    expect(['2026-11-06T00:45:00Z', '2026-11-06T01:00:00Z', '2026-11-06T01:15:00Z'].map((t) => due(b, t))).toEqual([false, false, false]);
    expect(['2026-11-06T01:30:00Z', '2026-11-06T01:45:00Z', '2026-11-06T13:00:00Z'].map((t) => due(b, t))).toEqual([true, true, true]);
  });
  it('a multi-day battle\'s cutoff comes from its LAST trading day, never its first', () => {
    const b = battleOn(['2026-11-03', '2026-11-04', '2026-11-05'], WINTER.expiresAt);
    expect(lastTradingDayOf(b)).toBe('2026-11-05');
    expect(finalizationCutoffOf(b)).toBe(ms('2026-11-06T01:30:00Z'));
    expect(due(b, '2026-11-04T01:45:00Z')).toBe(false);
  });
  it('an early-close day: the expiry is the 13:00 ET close; the cutoff is still 01:30 UTC the next UTC day', () => {
    const t = tieredFullDayTarget(ms('2026-11-27T15:00:00Z'), true);
    expect(getSessionForDate('2026-11-27').isEarlyClose).toBe(true);
    expect(t.expiresAt).toBe('2026-11-27T18:00:00.000Z');
    const b = battleOn(['2026-11-27'], t.expiresAt);
    expect(finalizationCutoffOf(b)).toBe(ms('2026-11-28T01:30:00Z'));
    expect([due(b, '2026-11-27T19:00:00Z'), due(b, '2026-11-28T01:30:00Z')]).toEqual([false, true]);
  });
  it('a terminal battle before its expiry is due from the cutoff, not before it', () => {
    const b = battleOn(['2026-11-05'], '2026-11-09T01:00:00.000Z', 'completed');
    expect(isTerminal(b)).toBe(true);
    expect([due(b, '2026-11-06T01:15:00Z'), due(b, '2026-11-06T01:30:00Z')]).toEqual([false, true]);
    expect(due({ ...b, status: 'active' }, '2026-11-06T01:30:00Z')).toBe(false);
  });
  it('due-ness from the stored cutoffAt and expiresAt equals due-ness from the document, terminal-before-expiry and pre-cutoff instants included', () => {
    const cases = [
      battleOn(['2026-07-15'], SUMMER.expiresAt), battleOn(['2026-11-05'], WINTER.expiresAt),
      battleOn(['2026-11-05'], WINTER.expiresAt, 'completed'), battleOn(['2026-11-05'], '2026-11-05T21:00:00.000Z', 'cancelled'),
      battleOn(['2026-11-03', '2026-11-04', '2026-11-05'], WINTER.expiresAt),
    ];
    const instants = ['2026-07-16T00:30:00Z', '2026-07-16T01:30:00Z', '2026-11-05T20:00:00Z', '2026-11-06T00:45:00Z', '2026-11-06T01:15:00Z', '2026-11-06T01:30:00Z', '2026-11-06T01:45:00Z', '2026-11-08T13:00:00Z'];
    for (const b of cases) for (const t of instants) expect([b.status, t, storedDue(b, t)]).toEqual([b.status, t, due(b, t)]);
  });
  it('the stated exception: a terminal battle whose expiry is later than its cutoff, or has none, is due from its document but not from the stored values — the stored check only queues it as ordinary (review L2-4)', () => {
    for (const b of [battleOn(['2026-11-05'], '2026-11-09T01:00:00.000Z', 'completed'), battleOn(['2026-11-05'], undefined, 'completed')]) {
      expect([due(b, '2026-11-06T01:30:00Z'), storedDue(b, '2026-11-06T01:30:00Z')]).toEqual([true, false]);
    }
  });
  it('a battle with no readable trading days never gets a null pointer: never due, never beyond the horizon', () => {
    for (const timing of [undefined, {}, { tradingDays: [] }, { tradingDays: ['tomorrow'] }, { tradingDays: ['2026-02-30'] }]) {
      const b = { status: 'completed', expiresAt: WINTER.expiresAt, timing };
      expect(finalizationCutoffOf(b)).toBe(null);
      expect(due(b, '2027-06-01T00:00:00Z')).toBe(false);
      expect(isBeyondHorizon(scheduleOf(b), ms('2027-06-01T00:00:00Z'))).toBe(false);
    }
  });
});

describe('the horizon — 3 calendar days after the cutoff', () => {
  it('a candidate until then; beyond it at and after cutoff + 3 days', () => {
    const s = scheduleOf(battleOn(['2026-11-05'], WINTER.expiresAt));
    expect(isBeyondHorizon(s, ms('2026-11-09T01:29:59.999Z'))).toBe(false);
    expect(isBeyondHorizon(s, ms('2026-11-09T01:30:00Z'))).toBe(true);
  });
  it('reads the expiry from an ISO string or a Timestamp, and refuses anything else', () => {
    expect(expiresAtMsOf({ expiresAt: WINTER.expiresAt })).toBe(ms(WINTER.expiresAt));
    expect(expiresAtMsOf({ expiresAt: { toMillis: () => 5 } })).toBe(5);
    expect(expiresAtMsOf({ expiresAt: 'later' })).toBe(null);
    expect(expiresAtMsOf({})).toBe(null);
  });
});
