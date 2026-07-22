// src/data/masteryProgression.js
//
// Archetype Mastery — THE progression data source (spec §6, ⚑D1/⚑D5; P3
// surface phase). One module, by construction (§9 display-agreement — the
// P4 #7 scoring-constants-collapse precedent): the curve, the bands, the
// entitlement table, and the unlock-table metadata live HERE; the server
// modules (api/_utils/masteryFormula.js, api/_utils/masteryEnforcement.js)
// re-export from this module, and the client surfaces import it directly —
// so a displayed level/cap/band and an enforced one can never disagree.
//
// Node-clean AND browser-clean: pure data + pure functions, zero imports.
// (api → src import per BUILD_RULES §4; the formula/enforcement test
// files' REAL imports are the dependency-surface guard.)

// ---- Curve (⚑D1): 10 levels, cumulative thresholds ----
export const LEVEL_XP_THRESHOLDS = Object.freeze([
  0, 200, 500, 900, 1400, 2000, 2700, 3500, 4400, 5400,
]);
export const MAX_LEVEL = LEVEL_XP_THRESHOLDS.length; // 10

/** Cumulative XP → level (1..10). Non-finite/negative XP → level 1. */
export function levelForXp(xp) {
  if (!Number.isFinite(xp) || xp < 0) return 1;
  let level = 1;
  for (let i = 0; i < LEVEL_XP_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_XP_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

/**
 * Progress toward the next level for the surface's progress bar:
 * {level, xpIntoLevel, xpForNext, pct} — xpForNext null at MAX_LEVEL
 * (bar renders full; no next threshold exists).
 */
export function levelProgress(xp) {
  const safeXp = Number.isFinite(xp) && xp >= 0 ? xp : 0;
  const level = levelForXp(safeXp);
  const floor = LEVEL_XP_THRESHOLDS[level - 1];
  if (level >= MAX_LEVEL) {
    return { level, xpIntoLevel: safeXp - floor, xpForNext: null, pct: 100 };
  }
  const next = LEVEL_XP_THRESHOLDS[level];
  const span = next - floor;
  return {
    level,
    xpIntoLevel: safeXp - floor,
    xpForNext: next - safeXp,
    pct: Math.max(0, Math.min(100, ((safeXp - floor) / span) * 100)),
  };
}

// ---- Bands (⚑D5): Novice 1–3 / Adept 4–7 / Master 8–10 ----
export const MASTERY_BANDS = Object.freeze([
  Object.freeze({ id: 'novice', label: 'Novice', minLevel: 1, maxLevel: 3 }),
  Object.freeze({ id: 'adept', label: 'Adept', minLevel: 4, maxLevel: 7 }),
  Object.freeze({ id: 'master', label: 'Master', minLevel: 8, maxLevel: 10 }),
]);

export function bandForLevel(level) {
  const lvl = Number.isInteger(level) && level >= 1 ? Math.min(level, MAX_LEVEL) : 1;
  return MASTERY_BANDS.find((b) => lvl >= b.minLevel && lvl <= b.maxLevel);
}

// ---- Profile accessors (§6/§9) — shared by enforcement AND display ----

/** Per-archetype level from a masteryProfiles doc (missing anything ⇒ 1). */
export function archetypeLevelFromProfile(profileData, archetype) {
  const xp = profileData?.archetypes?.[archetype]?.xp;
  return levelForXp(Number.isFinite(xp) ? xp : 0);
}

/** Highest archetype level on the account (§6.1 Forge keying; missing ⇒ 1). */
export function highestLevelFromProfile(profileData) {
  const archetypes = profileData?.archetypes;
  let highest = 1;
  if (archetypes && typeof archetypes === 'object') {
    for (const stream of Object.values(archetypes)) {
      const lvl = levelForXp(Number.isFinite(stream?.xp) ? stream.xp : 0);
      if (lvl > highest) highest = lvl;
    }
  }
  return highest;
}

// ---- Entitlement table (§6) — the enforcement functions' data ----

/** Lean-slot capacity by per-archetype level (§6: L1 2 · L3 +1 · L6 +1). */
export function leanCapForLevel(level) {
  if (!Number.isInteger(level) || level < 1) return 2; // fail toward baseline
  if (level >= 6) return 4;
  if (level >= 3) return 3;
  return 2;
}

/** Dial-position gate (§6 L2): 'aggressive' requires per-archetype level ≥ 2. */
export function dialAggressiveAllowed(level) {
  return Number.isInteger(level) && level >= 2;
}

/** Forge rule band by HIGHEST archetype level (§6.1: 10 · L4 15 · L7 20). */
export function forgeRuleBandForLevel(highestLevel) {
  if (!Number.isInteger(highestLevel) || highestLevel < 1) return 10; // fail toward band 1
  if (highestLevel >= 7) return 20;
  if (highestLevel >= 4) return 15;
  return 10;
}

// ---- Unlock table (§6) — surface metadata for the next-unlock teaser ----
//
// kind vocabulary (spec §6 + §10): 'shipped' = a real, enforced
// entitlement; 'cosmetic' = crests (real, display-only); 'reserved' =
// roadmap milestone, NEVER an entitlement — the teaser must not name it
// (only shipped/cosmetic unlocks are teased), and any listing renders the
// honest "Coming soon" copy, never a promise.
export const UNLOCK_TABLE = Object.freeze({
  2: Object.freeze([
    Object.freeze({ kind: 'shipped', label: 'Aggressive tempo dial' }),
    Object.freeze({ kind: 'cosmetic', label: 'Level 2 crest' }),
  ]),
  3: Object.freeze([
    Object.freeze({ kind: 'shipped', label: 'Third lean slot' }),
  ]),
  4: Object.freeze([
    Object.freeze({ kind: 'shipped', label: 'Forge band 2 — 15 rules per bundle' }),
    Object.freeze({ kind: 'cosmetic', label: 'Level 4 crest' }),
  ]),
  5: Object.freeze([
    Object.freeze({ kind: 'cosmetic', label: 'Adept crest' }),
    Object.freeze({ kind: 'reserved', label: 'Trial slot 1' }),
  ]),
  6: Object.freeze([
    Object.freeze({ kind: 'shipped', label: 'Fourth lean slot' }),
  ]),
  7: Object.freeze([
    Object.freeze({ kind: 'shipped', label: 'Forge band 3 — 20 rules per bundle' }),
    Object.freeze({ kind: 'cosmetic', label: 'Level 7 crest' }),
  ]),
  8: Object.freeze([
    Object.freeze({ kind: 'cosmetic', label: 'Level 8 crest' }),
    Object.freeze({ kind: 'reserved', label: 'Trial slot 2' }),
  ]),
  9: Object.freeze([
    Object.freeze({ kind: 'cosmetic', label: 'Level 9 crest' }),
    Object.freeze({ kind: 'reserved', label: 'Lesson-compile capacity' }),
  ]),
  10: Object.freeze([
    Object.freeze({ kind: 'cosmetic', label: 'Mastery crest' }),
    Object.freeze({ kind: 'reserved', label: 'Strategy composition' }),
  ]),
});

/**
 * The next-unlock teaser (spec §10): the nearest level ABOVE `level` with a
 * shipped or cosmetic unlock, or null past them all. Reserved items are
 * roadmap milestones, never entitlements — the teaser NEVER names them.
 */
export function nextUnlockTeaser(level) {
  const from = Number.isInteger(level) && level >= 1 ? level : 1;
  for (let l = from + 1; l <= MAX_LEVEL; l++) {
    const teasable = (UNLOCK_TABLE[l] || []).filter((u) => u.kind !== 'reserved');
    if (teasable.length > 0) return { level: l, unlocks: teasable };
  }
  return null;
}
