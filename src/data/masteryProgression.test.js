// src/data/masteryProgression.test.js
//
// Archetype Mastery P3 — the ONE progression data source (spec §6 ⚑D1/⚑D5,
// §10). The server modules re-export from here (§9 one-source collapse), so
// these tests pin the numbers display AND enforcement resolve.

import { describe, it, expect } from 'vitest';
import {
  LEVEL_XP_THRESHOLDS,
  MAX_LEVEL,
  levelForXp,
  levelProgress,
  MASTERY_BANDS,
  bandForLevel,
  leanCapForLevel,
  dialAggressiveAllowed,
  forgeRuleBandForLevel,
  UNLOCK_TABLE,
  nextUnlockTeaser,
} from './masteryProgression.js';
// §9 one-source proof: the server modules must resolve the SAME functions
// (re-export identity, not copies). Real imports — the BUILD_RULES §4
// dependency-surface guard for the api → src re-export chain.
import { levelForXp as formulaLevelForXp, LEVEL_XP_THRESHOLDS as formulaThresholds } from '../../api/_utils/masteryFormula.js';
import { leanCapForLevel as enfLeanCap, dialAggressiveAllowed as enfDial, forgeRuleBandForLevel as enfBand } from '../../api/_utils/masteryEnforcement.js';

describe('§9 one-source identity — server re-exports ARE this module', () => {
  it('formula and enforcement resolve the identical function objects', () => {
    expect(formulaLevelForXp).toBe(levelForXp);
    expect(formulaThresholds).toBe(LEVEL_XP_THRESHOLDS);
    expect(enfLeanCap).toBe(leanCapForLevel);
    expect(enfDial).toBe(dialAggressiveAllowed);
    expect(enfBand).toBe(forgeRuleBandForLevel);
  });
});

describe('levelProgress — the surface progress bar (spec §10)', () => {
  it('mid-level: correct floor/next split', () => {
    // 250 XP → level 2 (floor 200), next 500: 50 in, 250 to go, 16.7%.
    const p = levelProgress(250);
    expect(p.level).toBe(2);
    expect(p.xpIntoLevel).toBe(50);
    expect(p.xpForNext).toBe(250);
    expect(p.pct).toBeCloseTo((50 / 300) * 100, 5);
  });

  it('exact threshold: 0 into the new level', () => {
    const p = levelProgress(200);
    expect(p).toMatchObject({ level: 2, xpIntoLevel: 0, xpForNext: 300 });
    expect(p.pct).toBe(0);
  });

  it('MAX_LEVEL: bar full, no next threshold', () => {
    const p = levelProgress(LEVEL_XP_THRESHOLDS[MAX_LEVEL - 1] + 123);
    expect(p).toEqual({ level: 10, xpIntoLevel: 123, xpForNext: null, pct: 100 });
  });

  it('garbage XP fails toward the empty state (level 1, zero progress)', () => {
    for (const bad of [undefined, null, NaN, -5, 'many']) {
      const p = levelProgress(bad);
      expect(p.level).toBe(1);
      expect(p.xpIntoLevel).toBe(0);
    }
  });
});

describe('bands (⚑D5: Novice 1–3 / Adept 4–7 / Master 8–10)', () => {
  it.each([
    [1, 'novice'], [3, 'novice'], [4, 'adept'], [7, 'adept'], [8, 'master'], [10, 'master'],
  ])('level %i → %s', (level, band) => {
    expect(bandForLevel(level).id).toBe(band);
  });

  it('bands tile the full 1..MAX_LEVEL range with no gaps and fail toward novice', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) expect(bandForLevel(l)).toBeDefined();
    expect(bandForLevel(0).id).toBe('novice');
    expect(bandForLevel(99).id).toBe('master'); // clamped, not undefined
    expect(MASTERY_BANDS).toHaveLength(3);
  });
});

describe('next-unlock teaser (spec §10: shipped/cosmetic ONLY — reserved never teased)', () => {
  it('L1 teases L2 (dial + crest), never a reserved item', () => {
    const t = nextUnlockTeaser(1);
    expect(t.level).toBe(2);
    expect(t.unlocks.map((u) => u.kind)).toEqual(['shipped', 'cosmetic']);
  });

  it('L4 teases L5 COSMETIC only — the reserved Trial slot is filtered', () => {
    const t = nextUnlockTeaser(4);
    expect(t.level).toBe(5);
    expect(t.unlocks).toEqual([{ kind: 'cosmetic', label: 'Adept crest' }]);
    expect(t.unlocks.some((u) => /trial/i.test(u.label))).toBe(false);
  });

  it('every teasable level filters reserved items; no teaser output ever contains kind reserved', () => {
    for (let l = 1; l < MAX_LEVEL; l++) {
      const t = nextUnlockTeaser(l);
      if (t) expect(t.unlocks.every((u) => u.kind !== 'reserved')).toBe(true);
    }
  });

  it('at MAX_LEVEL there is no teaser', () => {
    expect(nextUnlockTeaser(MAX_LEVEL)).toBeNull();
  });

  it('the unlock table names every §6 shipped entitlement at its level', () => {
    expect(UNLOCK_TABLE[2].some((u) => u.kind === 'shipped')).toBe(true);  // aggressive dial
    expect(UNLOCK_TABLE[3].some((u) => u.kind === 'shipped')).toBe(true);  // 3rd lean
    expect(UNLOCK_TABLE[4].some((u) => u.kind === 'shipped')).toBe(true);  // band 2
    expect(UNLOCK_TABLE[6].some((u) => u.kind === 'shipped')).toBe(true);  // 4th lean
    expect(UNLOCK_TABLE[7].some((u) => u.kind === 'shipped')).toBe(true);  // band 3
    // The shipped table rows agree with the enforcement functions.
    expect(leanCapForLevel(3)).toBe(3);
    expect(leanCapForLevel(6)).toBe(4);
    expect(dialAggressiveAllowed(2)).toBe(true);
    expect(forgeRuleBandForLevel(4)).toBe(15);
    expect(forgeRuleBandForLevel(7)).toBe(20);
  });
});
