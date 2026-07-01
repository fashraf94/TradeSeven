// src/data/archetypeAdjustments.test.js
//
// Archetype-Integrity Phase A tests. This file's import of
// ./archetypeAdjustments.js IS the BUILD_RULES §4 dependency-surface guard:
// it runs in the Node (vitest) env and would explode if a browser-only dep ever
// entered the module's graph. NEVER mock the module.

import { describe, it, expect } from 'vitest';
import ARCHETYPE_ADJUSTMENTS_DEFAULT, {
  ARCHETYPE_ADJUSTMENTS,
  ARCHETYPE_KEYS,
  PASS_THROUGH_SLOTS,
  PASS_THROUGH_SECTORS,
  getArchetypeZones,
  getAllowlist,
  isValidAdjustmentId,
  getCanonicalText,
} from './archetypeAdjustments.js';

const SIX_KEYS = ['momentum_chaser', 'contrarian', 'degen', 'guardian', 'diversifier', 'analyst'];
const ID_PREFIX = {
  momentum_chaser: 'TF',
  contrarian: 'CN',
  degen: 'SP',
  guardian: 'CP',
  diversifier: 'DV',
  analyst: 'FI',
};
const EXPECTED_COUNTS = { momentum_chaser: 8, contrarian: 8, degen: 7, guardian: 8, diversifier: 7, analyst: 8 };
const ZONE_KEYS = ['immutableCore', 'protectedBias', 'tunableExecution', 'outOfScopeUserLever'];

// Cheap LINT only (not the proof): per-archetype phrases that would smell of a
// core reversal if they appeared in a `canonical`. The actual INVARIANT is the
// typed `policy.coreAlignment` assertion below.
const REVERSAL_LINT = {
  momentum_chaser: ['fade', 'beaten-down', 'contrarian', 'go defensive', 'short the'],
  contrarian: ['chase strength', 'breakout', 'momentum leader', 'remove the stop'],
  degen: ['stable', 'low-volatility', 'boring', 'blue-chip', 'play it safe'],
  guardian: ['high-beta', 'junk', 'trade fast', 'chase a mover'],
  diversifier: ['all-in', 'concentrate into one', 'single theme', 'pile into'],
  analyst: ['junk', 'ignore fundamentals', 'hot chart', 'drop the quality'],
};

describe('archetypeAdjustments — module shape', () => {
  it('default export equals the named ARCHETYPE_ADJUSTMENTS', () => {
    expect(ARCHETYPE_ADJUSTMENTS_DEFAULT).toBe(ARCHETYPE_ADJUSTMENTS);
  });

  it('has exactly the six canonical code-ids', () => {
    expect(Object.keys(ARCHETYPE_ADJUSTMENTS).sort()).toEqual([...SIX_KEYS].sort());
    expect([...ARCHETYPE_KEYS].sort()).toEqual([...SIX_KEYS].sort());
  });

  it('every archetype has all four prose zones (non-empty)', () => {
    for (const key of SIX_KEYS) {
      const { zones } = ARCHETYPE_ADJUSTMENTS[key];
      expect(Object.keys(zones).sort()).toEqual([...ZONE_KEYS].sort());
      for (const z of ZONE_KEYS) {
        expect(typeof zones[z]).toBe('string');
        expect(zones[z].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('PASS_THROUGH_SLOTS are the three tier slots; PASS_THROUGH_SECTORS is reserved/empty in V1', () => {
    expect(PASS_THROUGH_SLOTS).toEqual(['Star', 'Core', 'Support']);
    // ADOPT #1: generic scoped-emphasis is cut from V1, so the sector enum is unused/empty.
    expect(PASS_THROUGH_SECTORS).toEqual([]);
  });
});

describe('archetypeAdjustments — allowlist inventory', () => {
  it('totals exactly 46 adjustment ids', () => {
    const total = SIX_KEYS.reduce((n, k) => n + ARCHETYPE_ADJUSTMENTS[k].adjustments.length, 0);
    expect(total).toBe(46);
  });

  it('each archetype has its expected id count and correctly-prefixed, unique ids', () => {
    const allIds = new Set();
    for (const key of SIX_KEYS) {
      const list = ARCHETYPE_ADJUSTMENTS[key].adjustments;
      expect(list.length).toBe(EXPECTED_COUNTS[key]);
      for (const a of list) {
        expect(a.id.startsWith(`${ID_PREFIX[key]}-`)).toBe(true);
        expect(typeof a.canonical).toBe('string');
        expect(a.canonical.trim().length).toBeGreaterThan(0);
        expect(allIds.has(a.id)).toBe(false); // globally unique
        allIds.add(a.id);
      }
    }
    expect(allIds.size).toBe(46);
  });
});

describe('archetypeAdjustments — typed policy INVARIANT (#8: proof, not verbs)', () => {
  it('every adjustment carries a fully-typed policy from the allowed vocab', () => {
    for (const key of SIX_KEYS) {
      for (const a of ARCHETYPE_ADJUSTMENTS[key].adjustments) {
        const p = a.policy;
        expect(p, `${a.id} missing policy`).toBeTruthy();
        expect(['lower', 'higher', 'neutral']).toContain(p.riskDirection);
        expect(['tighter', 'wider', 'neutral']).toContain(p.concentrationDirection);
        expect(['longer', 'shorter', 'neutral']).toContain(p.timeHorizonDirection);
        expect(typeof p.forbiddenOpposite).toBe('string');
        expect(p.forbiddenOpposite.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('INVARIANT: no adjustment reverses its core — coreAlignment is reinforces|neutral, NEVER reverses', () => {
    for (const key of SIX_KEYS) {
      for (const a of ARCHETYPE_ADJUSTMENTS[key].adjustments) {
        expect(['reinforces', 'neutral'], `${a.id} coreAlignment`).toContain(a.policy.coreAlignment);
        expect(a.policy.coreAlignment).not.toBe('reverses');
      }
    }
  });
});

describe('archetypeAdjustments — denylist LINT (cheap, not the guarantee)', () => {
  it('no canonical text contains its archetype reversal phrases', () => {
    for (const key of SIX_KEYS) {
      for (const a of ARCHETYPE_ADJUSTMENTS[key].adjustments) {
        const lc = a.canonical.toLowerCase();
        for (const banned of REVERSAL_LINT[key]) {
          expect(lc.includes(banned), `${a.id} canonical contains banned "${banned}"`).toBe(false);
        }
      }
    }
  });
});

describe('archetypeAdjustments — helpers + the #4 no-fallback-on-write rule', () => {
  it('getArchetypeZones falls back to analyst for an unknown code-id (DISPLAY only)', () => {
    expect(getArchetypeZones('momentum_chaser')).toBe(ARCHETYPE_ADJUSTMENTS.momentum_chaser.zones);
    expect(getArchetypeZones('does_not_exist')).toBe(ARCHETYPE_ADJUSTMENTS.analyst.zones);
    expect(getArchetypeZones(undefined)).toBe(ARCHETYPE_ADJUSTMENTS.analyst.zones);
  });

  it('getAllowlist NEVER falls back — unknown/missing code-id yields []', () => {
    expect(getAllowlist('diversifier').length).toBe(7);
    expect(getAllowlist('does_not_exist')).toEqual([]);
    expect(getAllowlist(undefined)).toEqual([]);
    // critical: an unknown archetype must NOT inherit analyst's allowlist (#4)
    expect(getAllowlist('does_not_exist')).not.toEqual(ARCHETYPE_ADJUSTMENTS.analyst.adjustments);
  });

  it('isValidAdjustmentId is archetype-scoped and rejects cross-archetype ids', () => {
    expect(isValidAdjustmentId('diversifier', 'DV-01')).toBe(true);
    expect(isValidAdjustmentId('guardian', 'DV-01')).toBe(false); // cross-archetype
    expect(isValidAdjustmentId('does_not_exist', 'FI-01')).toBe(false); // unknown code-id, no fallback
    expect(isValidAdjustmentId('momentum_chaser', 'TF-99')).toBe(false); // nonexistent id
  });

  it('getCanonicalText round-trips for every (archetype, id) and returns null otherwise', () => {
    for (const key of SIX_KEYS) {
      for (const a of ARCHETYPE_ADJUSTMENTS[key].adjustments) {
        expect(getCanonicalText(key, a.id)).toBe(a.canonical);
      }
    }
    expect(getCanonicalText('guardian', 'DV-01')).toBeNull(); // cross-archetype
    expect(getCanonicalText('does_not_exist', 'FI-01')).toBeNull(); // unknown, no fallback
    expect(getCanonicalText('analyst', 'FI-404')).toBeNull(); // nonexistent id
  });
});
