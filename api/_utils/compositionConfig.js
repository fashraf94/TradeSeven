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
 * The write-epoch fence (design note §3; A41/A46). false — DEFAULT: every
 * helper returns before any read (zero added I/O; the endpoint suites passing
 * unchanged with the fence wired IS the A23 regression evidence). true:
 * writers validate composition/writeEpoch in their transactions' read phase
 * and 409 'epoch_closed' when the §8 runbook has closed the epoch.
 */
export const COMPOSITION_EPOCH_FENCE_ENABLED = false;

/**
 * identityMigration feed publication gate (M12; A44). false — DEFAULT: the
 * projector returns [] regardless of stored candidate feed entries.
 */
export const COMPOSITION_MIGRATION_FEED_ENABLED = false;
