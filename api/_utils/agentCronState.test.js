// api/_utils/agentCronState.test.js
// Forge Enforcement Keystone V1.4 §4.5 — finalizeCronState (Phase 2 / Gate 2).
// Verifies the shared cron-state subset is stamped uniformly, the lock is always
// released, and site-specific fields are never clobbered (pure-refactor guard).

import { describe, it, expect } from 'vitest';
import { finalizeCronState } from './agentCronState.js';

const NOW = '2026-05-30T12:00:00.000Z';
const VWAP = { AAPL: 2, MSFT: 0 };
const MOM = { AAPL: { vwap: 191.2 } };

describe('finalizeCronState — stamps the shared cron-state subset', () => {
  it('sets all four shared fields', () => {
    const u = finalizeCronState({}, { vwapTicks: VWAP, intradayMomentum: MOM, now: NOW });
    expect(u['cronState.lastEvaluatedAt']).toBe(NOW);
    expect(u['cronState.evaluatingAt']).toBeNull();
    expect(u['cronState.vwapTicks']).toBe(VWAP);
    expect(u['cronState.intradayMomentum']).toBe(MOM);
  });

  it('always releases the lock (evaluatingAt === null), overwriting any prior value', () => {
    const u = finalizeCronState({ 'cronState.evaluatingAt': 'some-iso-lock' }, { vwapTicks: VWAP, intradayMomentum: MOM });
    expect(u['cronState.evaluatingAt']).toBeNull();
  });

  it('defaults lastEvaluatedAt to a valid ISO timestamp when `now` omitted (sites 1-4)', () => {
    const u = finalizeCronState({}, { vwapTicks: VWAP, intradayMomentum: MOM });
    expect(typeof u['cronState.lastEvaluatedAt']).toBe('string');
    expect(Number.isNaN(Date.parse(u['cronState.lastEvaluatedAt']))).toBe(false);
    expect(new Date(u['cronState.lastEvaluatedAt']).toISOString()).toBe(u['cronState.lastEvaluatedAt']);
  });

  it('returns the SAME object (mutates in place, composes with battleRef.update)', () => {
    const update = {};
    expect(finalizeCronState(update, { vwapTicks: VWAP, intradayMomentum: MOM, now: NOW })).toBe(update);
  });
});

describe('finalizeCronState — does not clobber site-specific fields', () => {
  it('preserves site-3 gameplan fields + site-4 triggerGatePassCount + site-5 finalUpdate fields', () => {
    const update = {
      gameplanMeeting: { id: 'gm1' },
      'cronState.lastGameplanDate': '5/30/2026',
      'cronState.triggerGatePassCount': 7,
      'cronState.lastTriggeredAt': NOW,
      'cronState.totalHaikuCalls': 12,
      'scoreState.evaluationCount': 3,
      statusFeed: [{ message: 'x' }],
    };
    const u = finalizeCronState(update, { vwapTicks: VWAP, intradayMomentum: MOM, now: NOW });
    // site-specific fields untouched
    expect(u.gameplanMeeting).toEqual({ id: 'gm1' });
    expect(u['cronState.lastGameplanDate']).toBe('5/30/2026');
    expect(u['cronState.triggerGatePassCount']).toBe(7);
    expect(u['cronState.lastTriggeredAt']).toBe(NOW);
    expect(u['cronState.totalHaikuCalls']).toBe(12);
    expect(u['scoreState.evaluationCount']).toBe(3);
    expect(u.statusFeed).toEqual([{ message: 'x' }]);
    // and the shared subset is added
    expect(u['cronState.vwapTicks']).toBe(VWAP);
    expect(u['cronState.evaluatingAt']).toBeNull();
  });

  it('site-5 invariant: lastEvaluatedAt === lastTriggeredAt when the same `now` is used', () => {
    const update = { 'cronState.lastTriggeredAt': NOW };
    const u = finalizeCronState(update, { vwapTicks: VWAP, intradayMomentum: MOM, now: NOW });
    expect(u['cronState.lastEvaluatedAt']).toBe(u['cronState.lastTriggeredAt']);
  });
});

describe('finalizeCronState — idempotent / lock-release side benefit', () => {
  it('two calls with the same `now` produce equal objects', () => {
    const a = finalizeCronState({}, { vwapTicks: VWAP, intradayMomentum: MOM, now: NOW });
    const b = finalizeCronState({}, { vwapTicks: VWAP, intradayMomentum: MOM, now: NOW });
    expect(a).toEqual(b);
  });

  it('re-stamping the same object is stable', () => {
    const update = { 'cronState.triggerGatePassCount': 1 };
    finalizeCronState(update, { vwapTicks: VWAP, intradayMomentum: MOM, now: NOW });
    const snapshot = { ...update };
    finalizeCronState(update, { vwapTicks: VWAP, intradayMomentum: MOM, now: NOW });
    expect(update).toEqual(snapshot);
  });

  it('even with no state arg it releases the lock and sets a timestamp', () => {
    const u = finalizeCronState({});
    expect(u['cronState.evaluatingAt']).toBeNull();
    expect(typeof u['cronState.lastEvaluatedAt']).toBe('string');
    expect(u['cronState.vwapTicks']).toBeUndefined();
  });
});
