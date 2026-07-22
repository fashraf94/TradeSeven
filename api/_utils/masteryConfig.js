// api/_utils/masteryConfig.js
// Archetype Mastery — flags + epoch registry (Spec V2 §5.4/§7; V2.1 memo of
// record: docs/ARCHETYPE_MASTERY_SPEC_V2_1_STOP_RULINGS_JUL21_2026.md).
//
// MASTERY_XP_ENABLED is a code constant (the repo's flag pattern —
// src/config/featureFlags.js precedent: flips are PRs). The epoch registry
// is an append-only Firestore config doc (masteryConfig/epochRegistry,
// server-write-only): each flip appends {state, at}. It is the audit trail,
// the cutoverT identity (epoch 1 start) and the epochId vocabulary — NOT an
// eligibility oracle (spec §5.4).
//
// FLIP PROTOCOL (adversarial ruling B1 — the ceremony's order of record):
//   enable:  (1) APPEND {state:'enabled'} to the registry, (2) then flip the
//            constant true and deploy.  — append-epoch-then-flip-constant.
//   disable: (1) APPEND {state:'disabled'}, (2) then flip the constant false.
// Under this order a correctly-executed ceremony can never present the
// live constant with an absent/empty registry. If the cron nevertheless
// observes MASTERY_XP_ENABLED === true with a registry that is absent,
// empty, or malformed, that is a HALF-FLIP ANOMALY: completing mastery
// subjects would settle them unstamped — permanently invisible to the
// stamps-only §5.3 sweep — so the caller must treat it exactly like a
// registry transport failure (defer mastery-subject completions,
// delay-not-loss). requiresDeferral() below encodes that rule.
//
// DARK-STATE I/O (adversarial ruling B2): when the constant is false the
// cron performs NO registry read at all — the compile-time branch comes
// before any I/O, and settlement writes nothing mastery-related (dark
// byte-identity, read-count photographed by the completion tests). The
// 0·1·0 incident posture consequently writes no ineligible stamps while the
// constant is off; per §3's cross-boundary rule those battles are "unpaid
// absent a correction" either way — corrections remain the sole path, and
// the mid-rollback window (registry 'disabled' appended, constant still
// true) still stamps eligible:false honestly.

export const MASTERY_XP_ENABLED = false; // P4 cutover flips this (§7). Keep false through P1–P3.

// P2 (spec §7): server cap checks — lean caps, dial gate, Forge effective
// limits. Operative rules: ENFORCEMENT reads profiles + floors REGARDLESS
// of XP state (0·1·0 = entitlements frozen at the last profile); missing
// profile ⇒ baseline entitlements. Flip order: XP → backfill → ENFORCEMENT
// (with floor audit) → SURFACE.
//
// ENFORCEMENT FLIP CEREMONY (end-of-branch rulings B4 + hardening ruling B3
// — the C6 Forge floor audit EXTENDED to leans/dials/stats, with the
// CUTOVER MARKER closing the acquisition window; this flip is BLOCKED until
// the census passes):
//   1. flip MASTERY_CUTOVER_GUARD_ENABLED true + deploy. Dark no-op: the
//      guard only makes the two aggressive-dial hosts (set-tempo-dial's
//      SET path; change-archetype's carry-over rider) consult the cutover
//      marker doc, and the marker does not exist yet. (Both constants
//      false = zero mastery I/O, byte-identical — photographed.)
//   2. WRITE the cutover marker (Admin SDK, masteryConfig/cutover — any
//      content; existence is the signal). Instant, no deploy: every host
//      now closes BOTH dark aggressive acquisitions that enforcement would
//      grandfather — set-tempo-dial denies NEW aggressive sets
//      (dial_cutover), and change-archetype re-validates a carried
//      aggressive against the NEW archetype's level exactly as enforcement
//      will (the gate is per-archetype, so a dark carry-over is an
//      acquisition too). Leans/Forge need no closing: the dark lean cap IS
//      baseline, dark Forge equips enforce today's legacy limits
//      server-side, and the lazy legacy floor is live-computed, never
//      grandfathered. Existing aggressive dials re-assert in place via the
//      idempotent branch — re-asserting is not acquiring.
//   3. run scripts/mastery-preflip-census.js (READ-ONLY) — enumerates every
//      stored pin/dial/stat exceeding the owner's profile-derived baseline
//      entitlement + every Forge bundle above the effective (lazy-legacy-
//      floor) band, with a deterministic key per finding. Acquisitions are
//      closed, so the enumeration cannot go stale.
//   4. the FOUNDER reviews the report and writes the approved-keys file
//      (what never passed a gate);
//   5. scripts/mastery-preflip-normalize.js --apply zeroes exactly the
//      approved entries (census proposes, live state disposes: every branch
//      re-derives its inputs in-transaction and skips unless the violation
//      still holds; dial resets + lean trims ride txUpdateAgentSettings;
//      stats corrections are plain updates; Forge overages are never script-
//      mutated — the reforge trim path + equip gate are the remediation);
//   6. re-run the census; only a founder-accepted report clears this
//      constant to flip;
//   7. flip MASTERY_ENFORCEMENT_ENABLED true + deploy. NO ACQUISITION
//      WINDOW exists between the final census and enforcement: during
//      deploy propagation, not-yet-updated hosts still deny via
//      guard+marker, updated hosts gate via the live profile.
//   8. after verification, delete the marker and flip the guard constant
//      back false (hygiene — under ENFORCEMENT the marker is never
//      consulted).
export const MASTERY_ENFORCEMENT_ENABLED = false;

// B3 cutover-marker mechanism (hardening ruling): the guard constant makes
// set-tempo-dial's DARK path marker-aware (aggressive only). Default false —
// flipped only for the ceremony above, so the ordinary dark state performs
// zero mastery I/O. The marker doc's EXISTENCE is the whole signal
// (fail-closed: any readable content closes acquisitions).
export const MASTERY_CUTOVER_GUARD_ENABLED = false;
export const MASTERY_CUTOVER_MARKER_DOC = 'cutover';

// ---- Storage homes (net-new collections; firestore.rules default-deny +
// explicit blocks; all writes Admin SDK only) ----
export const MASTERY_CONFIG_COLLECTION = 'masteryConfig';
export const MASTERY_EPOCH_REGISTRY_DOC = 'epochRegistry';
export const MASTERY_SWEEP_CURSOR_DOC = 'sweepCursor';
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
 * @returns {{everEnabled: boolean, enabled: boolean, epochId: number, registryWellFormed: boolean}}
 *   everEnabled        - at least one 'enabled' entry exists (epoch 1 has begun)
 *   enabled            - writes accrue XP right now (constant AND registry agree)
 *   epochId            - the count of 'enabled' entries; epoch N = Nth enablement
 *   registryWellFormed - the doc parses as an append-only entry log; a
 *                        malformed registry NEVER enables and (with the
 *                        constant live) triggers deferral via requiresDeferral
 */
export function deriveFlagView(registryData, flagEnabled = MASTERY_XP_ENABLED) {
  const rawEntries = registryData?.entries;
  const isArray = Array.isArray(rawEntries);
  let wellFormed = registryData === null || registryData === undefined || isArray;
  let enabledCount = 0;
  let last = null;
  if (isArray) {
    for (const e of rawEntries) {
      if (!e || (e.state !== 'enabled' && e.state !== 'disabled')) {
        wellFormed = false;
        continue;
      }
      if (e.state === 'enabled') enabledCount += 1;
      last = e;
    }
  }
  const registryActive = wellFormed && last?.state === 'enabled';
  return Object.freeze({
    everEnabled: wellFormed && enabledCount > 0,
    enabled: flagEnabled === true && registryActive === true,
    epochId: enabledCount,
    registryWellFormed: wellFormed,
  });
}

/**
 * The B1 deferral rule, pure: with the constant LIVE, an absent/empty/
 * malformed registry (no trustworthy epoch 1) is a half-flip anomaly —
 * settling mastery subjects would strand them unstamped forever, so the
 * caller defers them (delay-not-loss). A well-formed registry whose LAST
 * entry is 'disabled' is NOT an anomaly (the honest mid-rollback posture:
 * stamps land eligible:false).
 */
export function requiresDeferral(flagView, flagEnabled = MASTERY_XP_ENABLED) {
  if (flagEnabled !== true) return false; // dark: nothing to defer, ever
  return flagView.registryWellFormed !== true || flagView.everEnabled !== true;
}

/** The all-dark view: constant off / pre-epoch-1. Settlement writes nothing mastery-related under it. */
export const DARK_FLAG_VIEW = deriveFlagView(null, false);

/**
 * Read the epoch registry once per cron run and derive the worker's flag
 * view. ONLY call this when MASTERY_XP_ENABLED is true (ruling B2: the
 * compile-time branch precedes all mastery I/O — the dark state performs
 * zero registry reads). Throws on transport error — the caller treats that
 * exactly like requiresDeferral (defer mastery subjects, delay-not-loss).
 */
export async function readMasteryFlagView(db) {
  const snap = await db
    .collection(MASTERY_CONFIG_COLLECTION)
    .doc(MASTERY_EPOCH_REGISTRY_DOC)
    .get();
  return deriveFlagView(snap.exists ? snap.data() : null);
}
