// api/_utils/sharedResearch/session.test.js
//
// Shared Research B1 — the host session, pure (spec §5.1, §5.3, §6.3).
// Exchange ids are minted once, when the object is built; the step admission's
// answers; the daily counts' reset; what the client is never shown.

import { describe, it, expect } from 'vitest';
import {
  exchangeOf, framingSessionOf, stepAdmissionOf, isStaleRunning, playerDayOf, globalDayOf, quotaViewOf, sessionViewOf,
  cleanPlayerText, etDateOf, latestLinesOf, RUNNING_STALE_MS, previousSessionOf,
} from './session.js';
import { etDateOf as mandateEtDateOf } from '../mandateClosePass.js';
import { isUuid } from '../researchRecords/model.js';

const NOW = '2026-11-12T15:00:00.000Z';

describe('exchanges', () => {
  it('each gets its own v4 id when built — once: the object a retried write sends carries the same id', () => {
    const a = exchangeOf({ who: 'player', kind: 'observation', text: 'Reviews delay deals.', at: NOW });
    const b = exchangeOf({ who: 'player', kind: 'observation', text: 'Reviews delay deals.', at: NOW });
    expect(isUuid(a.exchangeId)).toBe(true);
    expect(a.exchangeId).not.toBe(b.exchangeId);
    const resent = structuredClone(a);
    expect(resent.exchangeId).toBe(a.exchangeId);
  });
  it('writes only the keys given — never an undefined field', () => {
    const ex = exchangeOf({ who: 'partner', kind: 'step', text: 'x', at: NOW }, { mintId: () => 'id-1' });
    expect(ex).toEqual({ exchangeId: 'id-1', who: 'partner', kind: 'step', text: 'x', at: NOW });
    expect(() => exchangeOf({ who: 'agent', kind: 'step', text: 'x', at: NOW })).toThrow();
  });
});

describe('the player\'s words', () => {
  it('trimmed, <>{} stripped, 1–500 characters', () => {
    expect(cleanPlayerText('  <b>Reviews</b> {delay} deals  ')).toBe('bReviews/b delay deals');
    expect(cleanPlayerText('')).toBeNull();
    expect(cleanPlayerText('x'.repeat(501))).toBeNull();
    expect(cleanPlayerText(42)).toBeNull();
  });
});

describe('the step admission (spec §6.3)', () => {
  const open = (over = {}) => ({ ...framingSessionOf({ sessionId: 's', userId: 'u', requestId: 'r', observation: 'o', playerExchange: {}, nowIso: NOW }), status: 'open', ...over });
  const nowMs = Date.parse(NOW);
  it('a completed stepId is a replay (no model call)', () => {
    expect(stepAdmissionOf(open({ lastStep: { stepId: 'a', status: 'completed' } }), { stepId: 'a', nowMs })).toEqual({ replay: true });
  });
  it('another step running and fresh → step_in_flight; stale → admitted', () => {
    const running = { stepId: 'a', status: 'running', startedAt: new Date(nowMs - 1000).toISOString() };
    expect(stepAdmissionOf(open({ lastStep: running }), { stepId: 'b', nowMs })).toEqual({ refuse: 'step_in_flight' });
    const stale = { ...running, startedAt: new Date(nowMs - RUNNING_STALE_MS - 1).toISOString() };
    expect(isStaleRunning(stale, nowMs)).toBe(true);
    expect(stepAdmissionOf(open({ lastStep: stale }), { stepId: 'b', nowMs })).toEqual({ ok: true, rerun: false });
  });
  it('the same stepId after a failure is a rerun (Try again)', () => {
    expect(stepAdmissionOf(open({ lastStep: { stepId: 'a', status: 'failed' } }), { stepId: 'a', nowMs })).toEqual({ ok: true, rerun: true });
  });
  it('the budget, and a session not open', () => {
    expect(stepAdmissionOf(open({ stepsUsed: 10 }), { stepId: 'a', nowMs })).toEqual({ refuse: 'budget_spent' });
    expect(stepAdmissionOf(open({ status: 'completed' }), { stepId: 'a', nowMs })).toEqual({ refuse: 'session_not_open' });
  });
});

describe('the daily counts (spec §5.3)', () => {
  it('reset when the ET date changes', () => {
    const stored = { etDate: '2026-11-11', investigationsOpened: 3, framingsRun: 9 };
    expect(playerDayOf(stored, '2026-11-12')).toEqual({ etDate: '2026-11-12', investigationsOpened: 0, framingsRun: 0, stepCalls: 0 });
    expect(playerDayOf({ ...stored, stepCalls: 7 }, '2026-11-11')).toEqual({ etDate: '2026-11-11', investigationsOpened: 3, framingsRun: 9, stepCalls: 7 });
    expect(globalDayOf({ etDate: '2026-11-11', steps: 150, framings: 2, stepCalls: 300 }, '2026-11-12')).toEqual({ etDate: '2026-11-12', steps: 0, framings: 0, stepCalls: 0 });
    expect(quotaViewOf({ investigationsOpened: 2, framingsRun: 1, stepCalls: 4 })).toEqual({ investigationsToday: 2, perDay: 3, framingsToday: 1, framingsPerDay: 10, stepsToday: 4, stepsPerDay: 30 });
  });
  it('the ET date is the mandate close pass\'s rule (spec §5.3), from the import-free helper', () => {
    for (const iso of ['2026-11-12T04:59:59.000Z', '2026-11-12T05:00:00.000Z', '2026-03-08T07:30:00.000Z', '2026-11-01T05:30:00.000Z', NOW]) {
      expect(etDateOf(iso)).toBe(mandateEtDateOf(iso));
    }
    expect(etDateOf('not a date')).toBeNull();
  });
});

describe('what the client is shown', () => {
  it('never an exchange id, the request key, the item key, the owner, the stamp or the retrieval tally', () => {
    const s = {
      ...framingSessionOf({ sessionId: 's1', userId: 'u1', requestId: 'req-1', observation: 'o', playerExchange: exchangeOf({ who: 'player', kind: 'observation', text: 'o', at: NOW }), nowIso: NOW }),
      itemKey: 'fantasyTimesStories/x', attribution: { agentId: 'a1' }, retrieval: { calls: 2, costDollars: 0.01, elapsedMs: 900 },
    };
    const v = sessionViewOf(s);
    const json = JSON.stringify(v);
    expect(json).not.toContain(s.exchanges[0].exchangeId);
    for (const k of ['requestId', 'itemKey', 'userId', 'attribution', 'retrieval']) expect(v).not.toHaveProperty(k);
  });
  it('the latest lines are the last partner exchange\'s', () => {
    expect(latestLinesOf({ exchanges: [{ who: 'partner', lines: { support: 'a' } }, { who: 'player' }, { who: 'partner', lines: { support: 'b' } }] })).toEqual({ support: 'b' });
    expect(latestLinesOf({ exchanges: [] })).toEqual({ support: null, complication: null, missing: null });
  });
});

describe('spec §16 FQ-1 — the earlier investigation, when two creations share a millisecond', () => {
  it('an ended session created in the same millisecond as current counts as earlier; current, a later one and an open one never do; the newest created wins', () => {
    const T0 = '2026-11-12T14:00:00.000Z';
    const ended = (sessionId, createdAt, status = 'completed') => ({ sessionId, createdAt, updatedAt: createdAt, status });
    const current = { sessionId: 'cur', createdAt: NOW };
    // the same millisecond, a different id: previous (the CI flake on PR #1054)
    expect(previousSessionOf([ended('tie', NOW)], current)?.sessionId).toBe('tie');
    // current itself is never previous, even when ended
    expect(previousSessionOf([ended('cur', NOW)], current)).toBeNull();
    expect(previousSessionOf([ended('cur', NOW, 'abandoned')], current)).toBeNull();
    // created after current, or still open: not previous
    expect(previousSessionOf([ended('later', '2026-11-12T15:00:00.001Z')], current)).toBeNull();
    expect(previousSessionOf([{ ...ended('open', NOW), status: 'open' }], current)).toBeNull();
    // two ended sessions: the newest created wins, whichever order they come in
    expect(previousSessionOf([ended('old', T0), ended('tie', NOW)], current)?.sessionId).toBe('tie');
    expect(previousSessionOf([ended('tie', NOW), ended('old', T0)], current)?.sessionId).toBe('tie');
    expect(previousSessionOf([ended('old', T0), ended('mid', '2026-11-12T14:30:00.000Z', 'abandoned'), ended('cur', NOW)], current)?.sessionId).toBe('mid');
  });
});
