// api/_utils/masteryEnforcement.test.js
// Archetype Mastery P2 — enforcement entitlements (Spec V2 §6/§6.1/§7).
// Pure-matrix tests: caps by level, the dial gate, Forge bands, the §6.1
// LAZY legacy floor in both directions, and the §7 operative rule that
// entitlements derive from the PROFILE ALONE (no flag-view input exists —
// 0·1·0's frozen entitlements fall out by construction; the endpoint-level
// truth-table rows live in api/agent/masteryEnforcement.behavior.test.js).

import { describe, it, expect } from 'vitest';
import {
  archetypeLevelFromProfile,
  highestLevelFromProfile,
  leanCapForLevel,
  dialAggressiveAllowed,
  forgeRuleBandForLevel,
  effectiveForgeLimits,
} from './masteryEnforcement.js';
import { LEVEL_XP_THRESHOLDS } from './masteryFormula.js';

// XP that lands exactly at a given level (curve source: masteryFormula).
const xpFor = (level) => LEVEL_XP_THRESHOLDS[level - 1];
const profileAt = (archetype, level) => ({ archetypes: { [archetype]: { xp: xpFor(level) } } });

describe('level derivation — profile xp through the ONE curve source (§9)', () => {
  it('per-archetype level; missing profile/stream/xp ⇒ 1 (baseline entitlements, spec §7)', () => {
    expect(archetypeLevelFromProfile(profileAt('degen', 4), 'degen')).toBe(4);
    expect(archetypeLevelFromProfile(profileAt('degen', 4), 'guardian')).toBe(1); // other stream missing
    expect(archetypeLevelFromProfile(null, 'degen')).toBe(1);
    expect(archetypeLevelFromProfile({ archetypes: { degen: { xp: NaN } } }, 'degen')).toBe(1);
  });

  it('highest archetype level spans streams (§6.1 account keying); missing ⇒ 1', () => {
    const p = { archetypes: { degen: { xp: xpFor(2) }, guardian: { xp: xpFor(7) }, analyst: { xp: 0 } } };
    expect(highestLevelFromProfile(p)).toBe(7);
    expect(highestLevelFromProfile(null)).toBe(1);
    expect(highestLevelFromProfile({ archetypes: {} })).toBe(1);
  });
});

describe('lean caps (§6: L1 2 = baseline · L3 3 · L6 4) — grants only', () => {
  it.each([
    [1, 2], [2, 2], [3, 3], [4, 3], [5, 3], [6, 4], [10, 4],
  ])('level %i → cap %i', (level, cap) => {
    expect(leanCapForLevel(level)).toBe(cap);
  });

  it('fails toward baseline on garbage — never below it (unlocks never revoke)', () => {
    expect(leanCapForLevel(0)).toBe(2);
    expect(leanCapForLevel(NaN)).toBe(2);
    expect(leanCapForLevel(undefined)).toBe(2);
  });
});

describe('dial gate (§6 L2): aggressive requires per-archetype level ≥ 2', () => {
  it.each([[1, false], [2, true], [10, true]])('level %i → %s', (level, allowed) => {
    expect(dialAggressiveAllowed(level)).toBe(allowed);
  });
  it('fails closed on garbage levels', () => {
    expect(dialAggressiveAllowed(NaN)).toBe(false);
    expect(dialAggressiveAllowed(undefined)).toBe(false);
  });
});

describe('Forge bands (§6.1: 10 · L4 15 · L7 20) + the LAZY legacy floor', () => {
  it.each([[1, 10], [3, 10], [4, 15], [6, 15], [7, 20], [10, 20]])('highest level %i → band %i', (level, band) => {
    expect(forgeRuleBandForLevel(level)).toBe(band);
  });

  it('effective limits are the field-wise max — the floor holds in BOTH directions', () => {
    const legacyPartner = { maxBundles: 5, maxRulesPerBundle: 20 };
    const legacyRookie = { maxBundles: 5, maxRulesPerBundle: 10 };
    // Veteran legacy (partner 20) + fresh mastery (L1 band 10): legacy floor wins.
    expect(effectiveForgeLimits({ legacyLimits: legacyPartner, profileData: profileAt('degen', 1) }))
      .toEqual({ maxBundles: 5, maxRulesPerBundle: 20 });
    // Fresh legacy (rookie 10) + high mastery (L7 band 20): mastery wins.
    expect(effectiveForgeLimits({ legacyLimits: legacyRookie, profileData: profileAt('degen', 7) }))
      .toEqual({ maxBundles: 5, maxRulesPerBundle: 20 });
    // Missing profile: legacy passes through untouched (baseline entitlements).
    expect(effectiveForgeLimits({ legacyLimits: legacyRookie, profileData: null }))
      .toEqual({ maxBundles: 5, maxRulesPerBundle: 10 });
    // maxBundles never gains a mastery dimension.
    expect(effectiveForgeLimits({ legacyLimits: legacyRookie, profileData: profileAt('degen', 10) }).maxBundles).toBe(5);
  });
});

describe('§7 operative rule: enforcement is flag-view-INDEPENDENT by construction', () => {
  it('entitlements are a pure function of the profile — the 0·1·0 posture (XP off) and 1·1·0 (XP on) read identically', () => {
    // No helper takes a flag view or reads the registry: the same profile
    // yields the same entitlements whatever the XP flag is doing — which IS
    // "entitlements frozen at the last profile" when the writer is off.
    const frozen = profileAt('degen', 4);
    const entitlements = {
      leanCap: leanCapForLevel(archetypeLevelFromProfile(frozen, 'degen')),
      aggressive: dialAggressiveAllowed(archetypeLevelFromProfile(frozen, 'degen')),
      forge: effectiveForgeLimits({ legacyLimits: { maxBundles: 5, maxRulesPerBundle: 10 }, profileData: frozen }),
    };
    expect(entitlements).toEqual({
      leanCap: 3,
      aggressive: true,
      forge: { maxBundles: 5, maxRulesPerBundle: 15 },
    });
  });
});
