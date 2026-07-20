// api/_utils/masteryConfig.js
// Archetype Mastery — flags + epoch registry (Spec V2 §5.4/§7; V2.1 memo of
// record: docs/ARCHETYPE_MASTERY_SPEC_V2_1_STOP_RULINGS_JUL21_2026.md).
//
// MASTERY_XP_ENABLED is a code constant (the repo's flag pattern —
// src/config/featureFlags.js precedent: flips are PRs, per the §7 flip order
// XP → backfill → ENFORCEMENT → SURFACE; the P4-cutover ceremony flips it).
// The epoch registry is an append-only Firestore config doc
// (masteryConfig/epochRegistry, server-write-only): each flip appends
// {state, at}. It is the audit trail, the cutoverT identity (epoch 1 start)
// and the epochId vocabulary — NOT an eligibility oracle (spec §5.4).
//
// The worker's flag view (spec §5.1) is derived from BOTH, fail-closed by
// construction (deriveFlagView): writes happen only when the code constant
// AND the registry's live state agree; a half-flipped state (constant
// flipped without the ceremony's registry append, or vice versa) degrades to
// not-enabled / stamped-ineligible — never to silent 1.0-mode awarding.
//
// Before first enablement (registry absent/empty): everEnabled=false and
// settlement writes NOTHING mastery-related — dark byte-identity (§5.1).

export const MASTERY_XP_ENABLED = false; // P4 cutover flips this (§7). Keep false through P1–P3.

// ---- Storage homes (net-new collections; firestore.rules default-deny +
// explicit blocks; all writes Admin SDK only) ----
export const MASTERY_CONFIG_COLLECTION = 'masteryConfig';
export const MASTERY_EPOCH_REGISTRY_DOC = 'epochRegistry';
export const MASTERY_PROFILES_COLLECTION = 'masteryProfiles';
export const MASTERY_QUARANTINE_COLLECTION = 'masteryQuarantine';
// Audits (e.g. duplicate-rank pairs, spec §3) are SEPARATE from quarantine:
// masteryQuarantine counts gate the §9 backfill go/no-go and must mean
// "failed to award" only; audits accompany successful awards and route to
// the §8 corrections intake.
export const MASTERY_AUDITS_COLLECTION = 'masteryAudits';

/**
 * Registry doc + code constant → the worker's flag view, pure.
 *
 * @param {{entries?: Array<{state: string, at: string}>}|null} registryData
 * @param {boolean} [flagEnabled] - injectable for tests; defaults to the code constant
 * @returns {{everEnabled: boolean, enabled: boolean, epochId: number}}
 *   everEnabled - at least one 'enabled' entry exists (epoch 1 has begun)
 *   enabled     - writes accrue XP right now (constant AND registry agree)
 *   epochId     - the count of 'enabled' entries; epoch N = Nth enablement
 */
export function deriveFlagView(registryData, flagEnabled = MASTERY_XP_ENABLED) {
  const entries = Array.isArray(registryData?.entries) ? registryData.entries : [];
  let enabledCount = 0;
  for (const e of entries) {
    if (e?.state === 'enabled') enabledCount += 1;
  }
  const last = entries.length > 0 ? entries[entries.length - 1] : null;
  const registryActive = last?.state === 'enabled';
  return Object.freeze({
    everEnabled: enabledCount > 0,
    enabled: flagEnabled === true && registryActive === true,
    epochId: enabledCount,
  });
}

/** The all-dark view: pre-epoch-1 / registry unreadable. Settlement writes nothing mastery-related under it. */
export const DARK_FLAG_VIEW = deriveFlagView(null, false);

/**
 * Read the epoch registry once per cron run and derive the worker's flag
 * view. Throws on transport error — the CALLER decides the fail posture
 * (agent-evaluate skips expiry completions for that run: an unstamped
 * settlement-path completion would be invisible to the stamps-only repair
 * sweep, so delay-not-loss means "don't settle blind", per the §5.3 net).
 */
export async function readMasteryFlagView(db) {
  const snap = await db
    .collection(MASTERY_CONFIG_COLLECTION)
    .doc(MASTERY_EPOCH_REGISTRY_DOC)
    .get();
  return deriveFlagView(snap.exists ? snap.data() : null);
}
