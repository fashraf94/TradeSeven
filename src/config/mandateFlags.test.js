// src/config/mandateFlags.test.js
//
// Spec 1 — The Mandate — merge-dark pins (§7 / BUILD_RULES §2). Every mandate
// flag ships at its safest default. These pins are the loud tripwire: a flip PR
// MUST update the matching assertion here AND drop the flag's DARK_BY_DESIGN
// entry in flagPinGuard.test.js, in the same commit (the flag-pin guard enforces
// the coupling). Referenced by each flag's "Pinned by:" docstring in
// featureFlags.js.

import { describe, it, expect } from 'vitest';
import {
  MANAGED_MANDATE_ENABLED,
  MANDATE_EVAL_ENABLED,
  MANDATE_CLOSE_ENABLED,
  MANDATE_ROLLOVER_ENABLED,
  MANDATE_DORMANCY_DOWNSHIFT_ENABLED,
  MANDATE_FOUNDER_CREATE_ENABLED,
  MANDATE_TRANSPORT_MODE,
} from './featureFlags.js';

describe('Spec 1 mandate flags — merge-dark pins track live values (§7 / BUILD_RULES §2)', () => {
  it('the master gate is lit (activation step 3, Flip PR #1)', () => {
    expect(MANAGED_MANDATE_ENABLED).toBe(true);
  });

  it('the eval / close loop gates are lit (Flip PR #1)', () => {
    expect(MANDATE_EVAL_ENABLED).toBe(true);
    expect(MANDATE_CLOSE_ENABLED).toBe(true);
  });

  it('the rollover gate stays dark until its own flip (Flip PR #2)', () => {
    expect(MANDATE_ROLLOVER_ENABLED).toBe(false);
  });

  it('dormancy downshift is dark', () => {
    expect(MANDATE_DORMANCY_DOWNSHIFT_ENABLED).toBe(false);
  });

  it('the founder create endpoint gate is lit (activation step 3, Flip PR #1)', () => {
    expect(MANDATE_FOUNDER_CREATE_ENABLED).toBe(true);
  });

  it('transport defaults to the safest direct mode (string enum, not a boolean gate)', () => {
    expect(MANDATE_TRANSPORT_MODE).toBe('direct');
  });
});
