// api/_utils/masteryEnforcement.js
// Archetype Mastery P2 — enforcement entitlements (Spec V2 §6/§6.1/§7; V2.1
// memo of record; P2 greenlight rulings).
//
// The §6 unlock table's CAPACITY dimensions, resolved from masteryProfiles:
//   • Lean slots (PER-ARCHETYPE level): L1–2 → 2 (= today's baseline
//     STANDING_LEANS_CAP) · L3–5 → 3 · L6+ → 4. Pure grants above baseline —
//     no reduction case exists, so nothing ever revokes (Charter P1).
//   • Tempo dial (PER-ARCHETYPE level): 'aggressive' unlocks at L2.
//     Equipped state grandfathers (validation gates SETTING, never keeping;
//     the tick-time clamp never consults levels); leaving aggressive at L1
//     is one-way until L2 — documented spec §6 behavior.
//   • Forge rule bands (ACCOUNT-scoped — keyed to the HIGHEST archetype
//     level, §6.1/D4): band 1 (10) · L4 band 2 (15) · L7 band 3 (20).
//     These are exactly FORGE_LIMITS' maxRulesPerBundle vocabulary
//     (rookie 10 / starter 15 / partner 20). maxBundles has no mastery
//     dimension (5 at every legacy tier).
//
// LAZY LEGACY FLOOR (§6.1): effective Forge limits =
// max(masteryBand(highest level), liveLegacyEntitlement(gamesPlayed)) —
// computed at enforcement time, no snapshot, no snapshot race. The legacy
// entitlement stays live until the agentProgression.js retirement ceremony
// (max-across-records floor write + coverage audit — NOT this phase).
//
// Levels derive from profile XP via levelForXp — ONE curve source (§9;
// never a stored `level` field read in preference to xp). Missing profile /
// missing archetype stream ⇒ level 1 ⇒ baseline entitlements (spec §7).
// Enforcement reads profiles REGARDLESS of the XP flag state (0·1·0 =
// frozen entitlements): nothing here consults a flag view.

import { levelForXp } from './masteryFormula.js';
import { MASTERY_PROFILES_COLLECTION } from './masteryConfig.js';

/** masteryProfiles/{userId} ref — the enforcement read surface. */
export function masteryProfileRef(db, userId) {
  return db.collection(MASTERY_PROFILES_COLLECTION).doc(userId);
}

/** Per-archetype level from a profile doc (missing anything ⇒ 1). */
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

/**
 * THE dial re-validation rule (end-of-branch ruling Q7) — one source for
 * every pass that re-checks an EQUIPPED dial against a level that may have
 * moved under it:
 *   • the archetype-switch rider (change-archetype.js: the NEW archetype's
 *     level, V2.1 STOP-B), and
 *   • the §8 corrections clamp pass (the future correction applier passes
 *     the CORRECTED level here in the same pass that injects the reduced
 *     `leanCap` into revalidateStandingLeans — dials and leans re-validate
 *     together, never leans alone).
 * 'aggressive' below L2 resets to 'standard' (the §6 vocabulary's safe
 * default); every other position — and aggressive at ≥L2 — carries
 * untouched. Pure; the caller owns the write (and, per the ratified P3
 * notice rider, the user-facing notice when `invalidated` is true).
 * Grandfathering is NOT violated by construction: this runs only inside
 * passes that are themselves re-validation events (switch / correction) —
 * the tick-time clamp still never consults levels.
 */
export function revalidateTempoDial({ tempo, level }) {
  if (tempo === 'aggressive' && !dialAggressiveAllowed(level)) {
    return { tempo: 'standard', invalidated: true };
  }
  return { tempo: tempo ?? null, invalidated: false };
}

/** Forge rule band by HIGHEST archetype level (§6.1: 10 · L4 15 · L7 20). */
export function forgeRuleBandForLevel(highestLevel) {
  if (!Number.isInteger(highestLevel) || highestLevel < 1) return 10; // fail toward band 1
  if (highestLevel >= 7) return 20;
  if (highestLevel >= 4) return 15;
  return 10;
}

/**
 * Effective Forge limits under enforcement — the LAZY legacy floor:
 * field-wise max of the live legacy entitlement (FORGE_LIMITS[gamesPlayed
 * tier], passed in by the caller that already resolved it) and the mastery
 * band from the highest archetype level. maxBundles carries the legacy
 * value untouched (no mastery dimension).
 */
export function effectiveForgeLimits({ legacyLimits, profileData }) {
  const band = forgeRuleBandForLevel(highestLevelFromProfile(profileData));
  return {
    maxBundles: legacyLimits.maxBundles,
    maxRulesPerBundle: Math.max(legacyLimits.maxRulesPerBundle, band),
  };
}
