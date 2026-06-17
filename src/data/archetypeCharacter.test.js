// src/data/archetypeCharacter.test.js
//
// Guards the authored content layer for the Traits → Archetype Exploration surface.
// The expectations here are independently transcribed (colors) or DERIVED from live
// data (signature, combo, hardness) — never copied from the module under test — so a
// drift in either the content or the live mechanics it mirrors fails this test.

import { describe, it, expect } from 'vitest';
import {
  ARCHETYPE_CHARACTER,
  FACTOR_AXES,
  ROSTER_ORDER,
  getArchetypeCharacter,
  getArchetypeRoster,
} from './archetypeCharacter';
import { ARCHETYPE_IDENTITY } from './archetypeIdentity';
import { getArchetypeDisplayName } from './archetypeDisplay';
import { ARCHETYPE_DEFAULT_TRAITS, TRAIT_LIBRARY } from './traitLibrary';
import { TRAIT_COMBOS, getActiveComboLabel } from './traitCombos';
import { getTraitEnforcement } from '../utils/traitEnforcement';

const ALL_IDS = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];

// Independently re-typed from api/_utils/agentArchetypeConfig.js avatarColors (the
// FENCED source). If the fence changes these pairs, this test must change in lockstep.
const EXPECTED_COLORS = {
  momentum_chaser: ['#5eead4', '#a855f7'],
  contrarian: ['#a855f7', '#ef4444'],
  diversifier: ['#10b981', '#3b82f6'],
  degen: ['#ef4444', '#f59e0b'],
  analyst: ['#3b82f6', '#5eead4'],
  guardian: ['#3b82f6', '#10b981'],
};

describe('ARCHETYPE_CHARACTER — coverage & shape', () => {
  it('covers exactly the six live archetypes (matches ARCHETYPE_IDENTITY keys)', () => {
    expect(Object.keys(ARCHETYPE_CHARACTER).sort()).toEqual([...ALL_IDS].sort());
    expect(Object.keys(ARCHETYPE_IDENTITY).sort()).toEqual([...ALL_IDS].sort());
    expect([...ROSTER_ORDER].sort()).toEqual([...ALL_IDS].sort());
  });

  it('mirrors the real avatarColors pair for every archetype', () => {
    for (const id of ALL_IDS) {
      expect(ARCHETYPE_CHARACTER[id].colors, id).toEqual(EXPECTED_COLORS[id]);
    }
  });

  it('has all four decision-factor axes filled for every archetype', () => {
    const keys = FACTOR_AXES.map((a) => a.key);
    expect(keys).toEqual(['huntsFor', 'hardRule', 'temperament', 'positionStyle']);
    for (const id of ALL_IDS) {
      for (const key of keys) {
        expect(typeof ARCHETYPE_CHARACTER[id].factors[key], `${id}.${key}`).toBe('string');
        expect(ARCHETYPE_CHARACTER[id].factors[key].length, `${id}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps decision-factor copy directional — no numeric thresholds (honesty guard)', () => {
    for (const id of ALL_IDS) {
      for (const value of Object.values(ARCHETYPE_CHARACTER[id].factors)) {
        expect(/\d/.test(value), `${id} factor has a digit: "${value}"`).toBe(false);
      }
    }
  });

  it('has a temperament position in [0,1] for every archetype', () => {
    for (const id of ALL_IDS) {
      const t = ARCHETYPE_CHARACTER[id].tempPos;
      expect(typeof t, id).toBe('number');
      expect(t, id).toBeGreaterThanOrEqual(0);
      expect(t, id).toBeLessThanOrEqual(1);
    }
  });

  it('uses only REAL combo labels (matches the signature set via getActiveComboLabel)', () => {
    const realLabels = new Set(TRAIT_COMBOS.map((c) => c.label));
    for (const id of ALL_IDS) {
      const combo = ARCHETYPE_CHARACTER[id].combo;
      if (combo == null) continue;
      expect(realLabels.has(combo), `${id} combo "${combo}" is not a real TRAIT_COMBOS label`).toBe(true);
      // and it must be the label the archetype's own signature set actually fires
      expect(getActiveComboLabel(ARCHETYPE_DEFAULT_TRAITS[id])?.label, id).toBe(combo);
    }
  });
});

describe('getArchetypeCharacter — composition with live data', () => {
  it('composes identity, display name and signature for every archetype', () => {
    for (const id of ALL_IDS) {
      const arch = getArchetypeCharacter(id);
      expect(arch.id).toBe(id);
      expect(arch.name).toBe(getArchetypeDisplayName(id));
      expect(arch.disposition).toBe(ARCHETYPE_IDENTITY[id].disposition);
      expect(arch.reveal).toBe(ARCHETYPE_IDENTITY[id].reveal);
      expect(arch.voice).toBe(ARCHETYPE_IDENTITY[id].voice);
      expect(arch.signature).toEqual(ARCHETYPE_DEFAULT_TRAITS[id]);
      expect(arch.colors).toEqual(EXPECTED_COLORS[id]);
    }
  });

  it('falls back to analyst for an unknown / missing code-id', () => {
    const analyst = getArchetypeCharacter('analyst');
    expect(getArchetypeCharacter('not_a_real_archetype')).toEqual(analyst);
    expect(getArchetypeCharacter(undefined)).toEqual(analyst);
  });

  it('getArchetypeRoster returns the six in display order', () => {
    expect(getArchetypeRoster().map((a) => a.id)).toEqual(ROSTER_ORDER);
  });
});

describe('honest hardness — computed live, not authored', () => {
  it('marks EXACTLY Sector Rotator + Diversifier as hard guardrails', () => {
    const hard = TRAIT_LIBRARY.filter((t) => getTraitEnforcement(t.id).isEnforced).map((t) => t.id).sort();
    expect(hard).toEqual(['trait-diversifier', 'trait-sector-rotator']);
  });

  it('reads Iron Discipline as soft (the spec smoke-gate trap)', () => {
    expect(getTraitEnforcement('trait-iron-discipline').isEnforced).toBe(false);
  });
});
