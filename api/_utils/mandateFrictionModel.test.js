// api/_utils/mandateFrictionModel.test.js
// Spec 1 §4.1 (P3) — the market-cap-tier friction model: tier boundaries,
// fail-conservative unknown tier, HOLD zero-friction, snapshot wiring.

import { describe, it, expect } from 'vitest';
import { capTierFor, frictionFor, frictionForDecision, zeroFriction } from './mandateFrictionModel.js';
import { MANDATE_FRICTION_TIERS, MANDATE_FRICTION_MODEL_VERSION } from './mandateConfig.js';

describe('capTierFor — tier boundaries', () => {
  it('assigns tiers at the configured cap boundaries', () => {
    expect(capTierFor(3e12)).toBe('mega');    // $3T
    expect(capTierFor(200e9)).toBe('mega');   // boundary inclusive
    expect(capTierFor(199e9)).toBe('large');
    expect(capTierFor(10e9)).toBe('large');
    expect(capTierFor(9e9)).toBe('mid');
    expect(capTierFor(2e9)).toBe('mid');
    expect(capTierFor(1e9)).toBe('small');
  });
  it('null / absent / non-finite / non-positive caps are UNKNOWN (fail-conservative)', () => {
    expect(capTierFor(null)).toBe('unknown');
    expect(capTierFor(undefined)).toBe('unknown');
    expect(capTierFor(NaN)).toBe('unknown');
    expect(capTierFor(0)).toBe('unknown');
    expect(capTierFor(-5)).toBe('unknown');
  });
  it('the unknown tier prices at the WIDEST configured bps (degraded data never buys cheaper fills)', () => {
    const u = MANDATE_FRICTION_TIERS.unknown;
    const widestTotal = Math.max(...Object.entries(MANDATE_FRICTION_TIERS)
      .filter(([k]) => k !== 'unknown')
      .map(([, t]) => t.slippageBps + t.spreadProxyBps));
    expect(u.slippageBps + u.spreadProxyBps).toBeGreaterThanOrEqual(widestTotal);
  });
});

describe('frictionFor / frictionForDecision — snapshot wiring', () => {
  const SNAP = {
    symbols: {
      AAPL: { complete: true, price: 200, marketCap: 3e12 },
      MIDC: { complete: true, price: 50, marketCap: 5e9 },
      NOCAP: { complete: true, price: 10 },
    },
  };
  it('reads the tier from the snapshot marketCap', () => {
    expect(frictionFor('AAPL', SNAP)).toMatchObject({
      slippageBps: MANDATE_FRICTION_TIERS.mega.slippageBps,
      spreadProxyBps: MANDATE_FRICTION_TIERS.mega.spreadProxyBps,
      capTier: 'mega',
    });
    expect(frictionFor('MIDC', SNAP).capTier).toBe('mid');
  });
  it('missing marketCap or missing symbol → unknown (widest)', () => {
    expect(frictionFor('NOCAP', SNAP).capTier).toBe('unknown');
    expect(frictionFor('GONE', SNAP).capTier).toBe('unknown');
  });
  it('HOLD / ticker-less decisions pay nothing', () => {
    expect(frictionForDecision({ verb: 'HOLD', ticker: null }, SNAP)).toEqual(zeroFriction());
    expect(frictionForDecision({ verb: 'BUY', ticker: null }, SNAP)).toEqual(zeroFriction());
  });
  it('the model version constant reflects the P3 cap-tier model (receipt provenance)', () => {
    expect(MANDATE_FRICTION_MODEL_VERSION).toBe('p3_cap_tier_v1');
  });
});
