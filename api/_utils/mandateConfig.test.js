// api/_utils/mandateConfig.test.js
import { describe, it, expect } from 'vitest';
import {
  MANDATE_SCHEMA_VERSION,
  MANDATE_STARTING_CAPITAL,
  MANDATE_QUARTER_MONTHS,
  MANDATE_ESCAPE_HATCH_WINDOW_DAYS,
  MANDATE_SHARES_DP,
  MANDATE_USD_DP,
  MANDATE_CASH_FLOOR_PCT,
  MANDATE_MIN_POSITIONS,
  MANDATE_MAX_POSITIONS,
  MANDATE_MAX_SINGLE_POSITION_WEIGHT_PCT,
  MANDATE_DECISION_VERBS,
  MANDATE_CADENCE_TIERS,
} from './mandateConfig.js';

describe('mandateConfig — Phase 1 constants (Spec §2 / §3.4 / D-43)', () => {
  it('starting capital is the RATIFIED $10,000,000 (O-3 / D-43), NOT the stale $100K in §9', () => {
    expect(MANDATE_STARTING_CAPITAL).toBe(10_000_000);
  });

  it('schema versioning starts at 1 (§2 / F33)', () => {
    expect(MANDATE_SCHEMA_VERSION).toBe(1);
  });

  it('quarter term is 3 months and the escape window is 14 days (D-2 / D-3)', () => {
    expect(MANDATE_QUARTER_MONTHS).toBe(3);
    expect(MANDATE_ESCAPE_HATCH_WINDOW_DAYS).toBe(14);
  });

  it('money precision: shares 6dp, USD 2dp (§4.1 / F14)', () => {
    expect(MANDATE_SHARES_DP).toBe(6);
    expect(MANDATE_USD_DP).toBe(2);
  });

  it('gate config values (§3.4): 2% cash floor, 5–15 positions, single-weight cap', () => {
    expect(MANDATE_CASH_FLOOR_PCT).toBe(0.02);
    expect(MANDATE_MIN_POSITIONS).toBe(5);
    expect(MANDATE_MAX_POSITIONS).toBe(15);
    expect(MANDATE_MAX_SINGLE_POSITION_WEIGHT_PCT).toBeGreaterThan(0);
    expect(MANDATE_MAX_SINGLE_POSITION_WEIGHT_PCT).toBeLessThanOrEqual(1);
  });

  it('the decision verb set is exactly BUY|SELL|TRIM|ADD|HOLD (§3.4)', () => {
    expect([...MANDATE_DECISION_VERBS]).toEqual(['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD']);
  });

  it('cadence tiers are slow|standard|fast (D-19)', () => {
    expect([...MANDATE_CADENCE_TIERS]).toEqual(['slow', 'standard', 'fast']);
  });

  it('the verb set and cadence tiers are frozen (immutable contracts)', () => {
    expect(Object.isFrozen(MANDATE_DECISION_VERBS)).toBe(true);
    expect(Object.isFrozen(MANDATE_CADENCE_TIERS)).toBe(true);
  });
});
