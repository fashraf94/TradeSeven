// api/_utils/masteryConfig.test.js
// Archetype Mastery — flag-view derivation + the B1 deferral rule
// (adversarial rulings B1/B2; V2.1 memo of record). Pure-module tests: the
// registry/constant agreement matrix, malformed-registry handling, and the
// append-epoch-then-flip-constant protocol's half-flip detection.

import { describe, it, expect } from 'vitest';
import { deriveFlagView, requiresDeferral, DARK_FLAG_VIEW } from './masteryConfig.js';

const ENABLED = { state: 'enabled', at: '2026-07-19T00:00:00.000Z' };
const DISABLED = { state: 'disabled', at: '2026-07-20T00:00:00.000Z' };

describe('deriveFlagView — constant AND registry must agree (fail-closed)', () => {
  it('absent registry: everything off, well-formed (pre-epoch-1 is a normal state)', () => {
    expect(deriveFlagView(null, false)).toEqual({ everEnabled: false, enabled: false, epochId: 0, registryWellFormed: true });
    expect(deriveFlagView(undefined, true).enabled).toBe(false);
  });

  it('live registry + live constant → enabled; epochId counts enablements', () => {
    expect(deriveFlagView({ entries: [ENABLED] }, true)).toEqual({ everEnabled: true, enabled: true, epochId: 1, registryWellFormed: true });
    expect(deriveFlagView({ entries: [ENABLED, DISABLED, { state: 'enabled', at: 'T3' }] }, true).epochId).toBe(2);
  });

  it('half-flips never enable: constant without registry, registry without constant', () => {
    expect(deriveFlagView({ entries: [] }, true).enabled).toBe(false);
    expect(deriveFlagView({ entries: [ENABLED] }, false).enabled).toBe(false);
  });

  it('rolled-back registry (last entry disabled): everEnabled true, enabled false — the honest 0·1·0 posture', () => {
    const v = deriveFlagView({ entries: [ENABLED, DISABLED] }, true);
    expect(v).toEqual({ everEnabled: true, enabled: false, epochId: 1, registryWellFormed: true });
  });

  it('malformed registries are flagged and NEVER enable', () => {
    expect(deriveFlagView({ entries: 'garbage' }, true)).toEqual({ everEnabled: false, enabled: false, epochId: 0, registryWellFormed: false });
    const partial = deriveFlagView({ entries: [ENABLED, { state: 'banana' }] }, true);
    expect(partial.registryWellFormed).toBe(false);
    expect(partial.everEnabled).toBe(false);
    expect(partial.enabled).toBe(false);
  });
});

describe('requiresDeferral — the B1 half-flip rule', () => {
  it('dark constant never defers, whatever the registry looks like', () => {
    expect(requiresDeferral(deriveFlagView(null, false), false)).toBe(false);
    expect(requiresDeferral(deriveFlagView({ entries: 'garbage' }, false), false)).toBe(false);
  });

  it('live constant + absent/empty/malformed registry defers (half-flip anomaly)', () => {
    expect(requiresDeferral(deriveFlagView(null, true), true)).toBe(true);
    expect(requiresDeferral(deriveFlagView({ entries: [] }, true), true)).toBe(true);
    expect(requiresDeferral(deriveFlagView({ entries: [{ state: 'banana' }] }, true), true)).toBe(true);
  });

  it('live constant + well-formed registry never defers — including the mid-rollback (last=disabled) posture', () => {
    expect(requiresDeferral(deriveFlagView({ entries: [ENABLED] }, true), true)).toBe(false);
    expect(requiresDeferral(deriveFlagView({ entries: [ENABLED, DISABLED] }, true), true)).toBe(false);
  });
});

describe('DARK_FLAG_VIEW', () => {
  it('is the all-off view', () => {
    expect(DARK_FLAG_VIEW).toEqual({ everEnabled: false, enabled: false, epochId: 0, registryWellFormed: true });
  });
});
