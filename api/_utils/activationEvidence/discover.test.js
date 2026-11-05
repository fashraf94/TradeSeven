// api/_utils/activationEvidence/discover.test.js
//
// ID-1 Build 2 — instants, sessions and the key (contract §4.2, §8 "The call").
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): discover.js's store imports
// (setupEvidence/key.js, sessionAt.js) load here unmocked.

import { describe, it, expect } from 'vitest';
import { activationKeyOf, discoverActivations } from './discover.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';
import { snapshotIdOf } from '../setupEvidence/key.js';
import { legacyBattle, legacySwap } from './__fixtures__/activationBattles.js';

const RS = describeRuleSet();
const activationAt = (iso, symbol = 'NVDA') => ({ activatedAtMs: Date.parse(iso), symbol });

describe('the key an activation is served by', () => {
  it('an intraday swap-in dates to the previous session; the key is the store\'s own id', () => {
    const k = activationKeyOf(activationAt('2026-11-05T15:02:11.412Z'), RS);
    expect(k).toEqual({ ok: true, session: '2026-11-04', relation: 'before_close', snapshotId: snapshotIdOf({ session: '2026-11-04', symbol: 'NVDA', ruleSet: RS }) });
  });
  it('a BR-2 late-day creation (15:30 ET, before the close) dates to the PREVIOUS session (ruling Q-ID1-3)', () => {
    expect(activationKeyOf(activationAt('2026-11-05T20:30:00.000Z'), RS)).toMatchObject({ ok: true, session: '2026-11-04', relation: 'before_close' });
  });
  it('an after-close creation dates to that day\'s session', () => {
    expect(activationKeyOf(activationAt('2026-11-05T21:05:00.000Z'), RS)).toMatchObject({ ok: true, session: '2026-11-05', relation: 'after_close' });
  });
  it('a multi-day battle\'s day-3 swap-in dates to day 2', () => {
    const b = legacyBattle({ timing: { tradingDays: ['2026-11-03', '2026-11-04', '2026-11-05'] } });
    legacySwap(b, { tier: 'core', slot: 0, symbolIn: 'JPM', at: '2026-11-05T15:00:00.000Z' });
    const a = discoverActivations(b).activations.find((x) => x.kind === 'swap_in');
    expect(activationKeyOf(a, RS)).toMatchObject({ ok: true, session: '2026-11-04' });
  });
  it('a weekend instant dates to Friday', () => {
    expect(activationKeyOf(activationAt('2026-11-07T15:00:00.000Z'), RS)).toMatchObject({ session: '2026-11-06', relation: 'non_session' });
  });
  it('an instant the calendar cannot name (an unmaintained year) is calendar_missing — no key, so no pointer', () => {
    expect(activationKeyOf(activationAt('2028-01-04T15:00:00.000Z'), RS)).toEqual({ ok: false, reason: 'calendar_missing' });
    expect(activationKeyOf({ activatedAtMs: Number.NaN, symbol: 'NVDA' }, RS)).toEqual({ ok: false, reason: 'calendar_missing' });
  });
  it('the hyphen symbol passes; a dotted or suffixed one is symbol_form before any call, never repaired', () => {
    expect(activationKeyOf(activationAt('2026-11-05T15:00:00.000Z', 'BRK-B'), RS).ok).toBe(true);
    for (const s of ['BRK.B', 'NVDA.US', 'nvda', 'TOOLONGSYMBOL1']) expect(activationKeyOf(activationAt('2026-11-05T15:00:00.000Z', s), RS)).toEqual({ ok: false, reason: 'symbol_form' });
  });
  it('a malformed rule set is a programming error: it throws, it is never blamed on the activation', () => {
    expect(() => activationKeyOf(activationAt('2026-11-05T15:00:00.000Z'), { ...RS, extra: 1 })).toThrow(TypeError);
  });
});
