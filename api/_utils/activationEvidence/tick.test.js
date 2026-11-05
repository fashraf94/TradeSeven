// api/_utils/activationEvidence/tick.test.js
//
// ID-1 Build 2 — the activating tick (contract §4, ruling Q-ID1-8; §4.2 grace).

import { describe, it, expect } from 'vitest';
import { joinTick, tickWindowsOf, UNAVAILABLE_TICK } from './tick.js';
import { TICK_GRACE_MS } from './constants.js';
import { legacyBattle, legacySwap, tickOf } from './__fixtures__/activationBattles.js';
import { discoverActivations } from './discover.js';

const AT = '2026-11-05T15:02:11.412Z';
const swapInWith = (evaluationId = 'risk_stop_NVDA_1') => {
  const b = legacyBattle();
  legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: AT, evaluationId });
  return discoverActivations(b).activations.find((a) => a.kind === 'swap_in');
};
const row = { symbolOut: 'NVDA', symbolIn: 'JPM', swappedOutAt: AT };
const complete = (...ticks) => ({ complete: true, ticks });
const soon = Date.parse(AT) + 60_000;
const late = Date.parse(AT) + TICK_GRACE_MS;

describe('the join', () => {
  it('exactly one committed swap action on (swappedOutAt, symbolOut, symbolIn) → tick_action; the ids are the tick\'s, the evaluationId the row\'s', () => {
    const a = swapInWith();
    const j = joinTick(a, complete(tickOf(11, '2026-11-05T15:01:00.000Z'), tickOf(12, '2026-11-05T15:02:40.000Z', [row])), { nowMs: soon });
    expect(j).toEqual({ outcome: 'tick_action', ambiguous: false, activatingTick: { tickSeq: 12, evalId: 'eval_012', evaluationId: 'risk_stop_NVDA_1', source: 'tick_action' } });
  });
  it('a proposal execution with a matching tick reads tick_action; tickSeq and evalId are the TICK\'s — the row\'s eval_NNN (the proposing check) never names the tick, and is carried only as the row\'s evaluationId', () => {
    const a = swapInWith('eval_007'); // the approved proposal's row names an earlier check
    const t = tickOf(12, '2026-11-05T15:02:40.000Z', [row]);
    t.actions[0].source = 'haiku';
    const j = joinTick(a, complete(t), { nowMs: soon });
    expect(j.activatingTick).toEqual({ tickSeq: 12, evalId: 'eval_012', evaluationId: 'eval_007', source: 'tick_action' });
  });
  it('none within the grace defers; after it, unavailable with all three ids null; at finalisation the grace no longer applies', () => {
    const a = swapInWith();
    expect(joinTick(a, complete(), { nowMs: soon })).toEqual({ outcome: 'defer', reason: 'tick_grace' });
    expect(joinTick(a, complete(), { nowMs: late - 1 })).toEqual({ outcome: 'defer', reason: 'tick_grace' });
    expect(joinTick(a, complete(), { nowMs: late })).toEqual({ outcome: 'unavailable', ambiguous: false, activatingTick: { ...UNAVAILABLE_TICK } });
    expect(joinTick(a, complete(), { nowMs: soon, finalizing: true }).outcome).toBe('unavailable');
  });
  it('a matched tick with no sequence → unavailable, flagged malformed; a tick that never identified an evaluation keeps tick_action with evalId null', () => {
    const a = swapInWith();
    for (const patch of [{ tickSeq: null }, { tickSeq: 'x' }]) {
      const t = { ...tickOf(12, '2026-11-05T15:02:40.000Z', [row]), ...patch };
      expect(joinTick(a, complete(t), { nowMs: soon })).toEqual({ outcome: 'unavailable', ambiguous: false, malformed: true, activatingTick: { ...UNAVAILABLE_TICK } });
    }
    // A risk-manager action in a tick that exited before `identify` (agent-evaluate.js:2273, :2714): the tick is known, its evaluation is not.
    for (const evalId of [null, '']) {
      const t = { ...tickOf(4, '2026-11-05T15:02:40.000Z', [row]), evalId };
      expect(joinTick(a, complete(t), { nowMs: soon }).activatingTick).toEqual({ tickSeq: 4, evalId: null, evaluationId: 'risk_stop_NVDA_1', source: 'tick_action' });
    }
  });
  it('two matches → unavailable, counted ambiguous', () => {
    const a = swapInWith();
    const j = joinTick(a, complete(tickOf(12, '2026-11-05T15:02:40.000Z', [row]), tickOf(13, '2026-11-05T15:12:40.000Z', [row])), { nowMs: late });
    expect(j).toEqual({ outcome: 'unavailable', ambiguous: true, activatingTick: { ...UNAVAILABLE_TICK } });
  });
  it('a failed or truncated read is never "none": it defers, at finalisation too — and one match from a partial read defers as well', () => {
    const a = swapInWith();
    expect(joinTick(a, { complete: false, ticks: [] }, { nowMs: late, finalizing: true })).toEqual({ outcome: 'defer', reason: 'tick_read_incomplete' });
    expect(joinTick(a, { complete: false, ticks: [tickOf(12, AT, [row])] }, { nowMs: late, finalizing: true })).toEqual({ outcome: 'defer', reason: 'tick_read_incomplete' });
    expect(joinTick(a, { complete: false, ticks: [tickOf(12, AT, [row]), tickOf(13, AT, [row])] }, { nowMs: late }).ambiguous).toBe(true);
  });
  it('an uncommitted action, another kind, another instant string or another symbol does not match', () => {
    const a = swapInWith();
    const variants = [{ committed: false }, { kind: 'hold' }, { swappedOutAt: '2026-11-05T10:02:11.412-05:00' }, { symbolIn: 'CVX' }, { symbolOut: 'AMD' }];
    for (const v of variants) {
      const t = tickOf(12, AT, [row]);
      Object.assign(t.actions[0], v);
      expect(joinTick(a, complete(t), { nowMs: late }).outcome).toBe('unavailable');
    }
  });
});

describe('the bounded read: capturedAt windows', () => {
  it('±grace around each swap-in, overlapping windows merged, ordered', () => {
    const w = tickWindowsOf([
      { row: { swappedOutAt: '2026-11-05T18:00:00.000Z' } },
      { row: { swappedOutAt: '2026-11-05T15:00:00.000Z' } },
      { row: { swappedOutAt: '2026-11-05T15:40:00.000Z' } },
    ]);
    expect(w).toEqual([
      { startIso: '2026-11-05T14:30:00.000Z', endIso: '2026-11-05T16:10:00.000Z' },
      { startIso: '2026-11-05T17:30:00.000Z', endIso: '2026-11-05T18:30:00.000Z' },
    ]);
    expect(tickWindowsOf([])).toEqual([]);
  });
});
