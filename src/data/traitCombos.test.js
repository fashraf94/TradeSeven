// src/data/traitCombos.test.js
//
// Phase 1A regression safety net (characterization) for combo resolution
// (acceptance #7). Combos key on traitId, so the V2.2 re-family (which keeps
// traitIds stable but re-groups/re-copies cards) must NOT change which pairs
// resolve to which label. Plain vitest, no rendering.

import { describe, it, expect } from 'vitest';
import { TRAIT_COMBOS, getActiveComboLabel } from './traitCombos';
import { TRAIT_BY_ID } from './traitLibrary';

describe('getActiveComboLabel — resolves by traitId', () => {
  it('resolves a known pair regardless of order', () => {
    const ids = ['trait-trend-rider', 'trait-breakout-chaser'];
    expect(getActiveComboLabel(ids)?.label).toBe('Momentum Purist');
    expect(getActiveComboLabel([...ids].reverse())?.label).toBe('Momentum Purist');
  });

  it('resolves a cross-family pair (Diversifier + Penalty Dodger → Risk Fortress)', () => {
    expect(getActiveComboLabel(['trait-diversifier', 'trait-penalty-dodger'])?.label)
      .toBe('Risk Fortress');
  });

  it('ignores unrelated extra traits in the set', () => {
    const ids = ['trait-dual-conviction', 'trait-patient-holder', 'trait-active-trader'];
    expect(getActiveComboLabel(ids)?.label).toBe('Conviction Fortress');
  });

  it('returns null when no pair matches', () => {
    expect(getActiveComboLabel(['trait-trend-rider'])).toBeNull();
    expect(getActiveComboLabel([])).toBeNull();
    expect(getActiveComboLabel(['trait-trend-rider', 'trait-diversifier'])).toBeNull();
  });

  it('first match wins (priority-ordered list)', () => {
    // bargain-hunter pairs with let-winners-run (index 0, "Contrarian Diamond
    // Miner") AND with iron-discipline (later, "Careful Contrarian"). A set with
    // all three must resolve to the earlier-listed combo.
    const ids = ['trait-bargain-hunter', 'trait-let-winners-run', 'trait-iron-discipline'];
    expect(getActiveComboLabel(ids)?.label).toBe('Contrarian Diamond Miner');
  });
});

describe('TRAIT_COMBOS integrity (re-family must not orphan a combo)', () => {
  it('every combo references two valid, distinct traitIds', () => {
    for (const c of TRAIT_COMBOS) {
      expect(TRAIT_BY_ID[c.traitA], c.label).toBeTruthy();
      expect(TRAIT_BY_ID[c.traitB], c.label).toBeTruthy();
      expect(c.traitA).not.toBe(c.traitB);
      expect(typeof c.label).toBe('string');
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it('has the expected 12 combos', () => {
    expect(TRAIT_COMBOS).toHaveLength(12);
  });
});
