// api/_utils/compositionConfig.js
//
// Composition PR 2 — the SERVER-SIDE composition flags (closure sheet §IV /
// spec R2-B3: dedicated event flags, no reuse of broad archetype flags).
//
// Lives in api/_utils (the masteryConfig.js precedent) rather than
// src/config/featureFlags.js DELIBERATELY: the endpoint test suites mock
// featureFlags.js with explicit export lists, so a server-consumed flag added
// there breaks every suite's mock — masteryConfig.js exists for exactly this
// reason. The one CLIENT-consumed composition flag (COMPOSITION_DISPLAY_ENABLED)
// stays in featureFlags.js. The flag-ownership table
// (docs/composition/PR2_FLAG_OWNERSHIP.md) is the map of record.
//
// Code constants (the repo's flag pattern — flips are PRs); ALL DARK at merge.
// Activation rides the §8 epoch sequence, never ad-hoc flips (A18/A28 class).

/**
 * Offer/equip + whole-config-save candidate legality (spec §2 rows 1-4).
 * 'off'     — DEFAULT: zero compute, byte-identical endpoints (A23).
 * 'observe' — violations computed and attached to the equip response;
 *             never blocks (instrumentation surface: equip-bundle).
 * 'enforce' — core_conflict/deferred pairings and out-of-domain params reject
 *             server-side (409 composition_blocked, stored config
 *             byte-unchanged — A4/A5/A6/A27).
 */
export const COMPOSITION_ENFORCEMENT_MODE = 'off';

/**
 * The write-epoch fence (design note §3; A41/A46).
 *
 * true — LIVE, flipped by the §8 ACTIVATION_RUNBOOK step 1.1 (2026-08-16):
 * writers validate composition/writeEpoch in their transactions' read phase
 * and 409 'epoch_closed' once the runbook has closed the epoch. The flip
 * itself is behavior-neutral — pre-close the fence FAIL-OPENS (an absent or
 * open epoch doc admits every write), so nothing changes until step 1.9
 * writes {state:'closed'}.
 *
 * false — the shipped-dark posture through PR 4: every helper returned before
 * any read (zero added I/O; the endpoint suites passing unchanged with the
 * fence wired IS the A23 regression evidence).
 */
// Pinned by: composition.acceptance.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const COMPOSITION_EPOCH_FENCE_ENABLED = true;
// ⚠ LOAD-BEARING ONCE ACTIVATED (§2 review F5): after the activation record
// exists, this flag gates the server-side descriptor pins (birth-path version
// selection, the decide.js projection guard, FC-1 battle stamping). Lowering
// it post-activation does NOT deactivate anything — it silently splits
// identity selection (server births fall back to LIVE while the record-driven
// client path keeps the candidate) and turns off stale-projection rejection.
// The runbook's standing rule: once step 7 has run, this flag NEVER lowers;
// deactivation is rollbackActivationRecord, nothing else (A48).

/**
 * identityMigration feed publication gate (M12; A44). false — DEFAULT: the
 * projector returns [] regardless of stored candidate feed entries.
 */
// Pinned by: composition.acceptance.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const COMPOSITION_MIGRATION_FEED_ENABLED = false;

/**
 * PR 3 — the CompiledBuild candidate-identity boundary (spec §7 row 3; ledger
 * A7/A15).
 *
 * true — LIVE, flipped by the §8 ACTIVATION_RUNBOOK step 1.1 (2026-08-16)
 * because the step-5 candidate pipeline needs it deployed. The flip is
 * behavior-neutral: the flag is only the DARK SWITCH, never the selector —
 * the candidate boundary follows THE RECORD (runbook #11,
 * `resolveCandidateModeInTx` in compileOnSettingsChange.js:91), and with no
 * activation record (or at genesis) every production compile still resolves
 * LIVE cells. Step 5 scopes the candidate pipeline EXPLICITLY by
 * {candidateStateId, activeIdentityVersion}; it never derives candidate
 * status from this flag.
 *
 * false — the shipped-dark posture through PR 4: the compiler resolved compat
 * cells from the LEGACY map exactly as before (byte-identical builds), and
 * the candidate registry, deferred vocabulary, advisory/narrowedParams
 * carriage, and quarantine disposition were all inert.
 */
// Pinned by: compileOnSettingsChange.test.js (the 'candidate-mode defaults'
// rows pin this TRUE deliberately — they guard the defaults that must NOT
// follow the flag, and are only reachable while it is lit; flagPinGuard keeps
// this value and that pin moving together — BUILD_RULES §2).
export const COMPOSITION_COMPILED_IDENTITY_ENABLED = true;
