// src/config/setupMenuLabelsFlags.js
//
// Measured Trend Evidence Slice 2's flag (spec docs/design/20261107_P3_SLICE2_BUILD_SPEC_DRAFT_V2.md
// §7.1, as amended by docs/design/20261107_P3_SLICE2_DISABLED_BUILD_KICKOFF_V2_CORRECTIONS.md; build
// report docs/audits/20261107_BUILD_SETUP_MENU_LABELS.md). A flag-source module of its own,
// registered in flagPinGuard.test.js's FLAG_SOURCE_MODULES, and NOT a line in featureFlags.js, for
// the reason activationEvidenceFlags.js gives: App.jsx dynamically imports featureFlags, so Rollup
// keeps that module's whole namespace in the entry chunk and any new export there changes the
// entry's bytes. Nothing on the client reads this flag; it is read by the server only
// (api/_utils/setupMenuLabels/gate.js). No imports.

/**
 * SETUP_MENU_LABELS_ENABLED — Slice 2: dated Trend Follower setup labels on the candidate menu of
 * each tick's permanent record (agentBattles/{id}/ticks/{tickId} `setupMenu`), read from the shared
 * setup-evidence store, and the store's supply for those names by the seventh tenant of
 * api/cron/process-pending-reflections.js (setupMenuLabelState/main holds its reservations).
 *
 * When TRUE, and the cockpit allowlist (COCKPIT_ALLOWLIST_UIDS) names the battle's owner, an
 * in-scope Trend Follower battle's ticks carry the `setupMenu` block and the tenant acquires
 * snapshots for those battles' hot-bench names. The agent never sees a label.
 *
 * DARK — default FALSE (built 2026-11-07). With it false the tick's freeze sets nothing (no
 * `setupMenu` key, no read), the tenant returns `{ skipped: true }` before any read, and the cron
 * response carries no new key: byte-identical. Flips only in the founder's own PR, never a build
 * PR, after (a) ID-1's first census week is recorded complete, (b) D-6 (the provider budget
 * authority) is resolved, and (c) the setupMenuLabelState rules and its index exemption are
 * published. The flip moves the pin in setupMenuLabelsFlags.test.js to true and drops the
 * DARK_BY_DESIGN entry in flagPinGuard.test.js in the same commit (BUILD_RULES §2).
 */
// Pinned by: setupMenuLabelsFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const SETUP_MENU_LABELS_ENABLED = false;
