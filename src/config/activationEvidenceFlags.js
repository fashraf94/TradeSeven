// src/config/activationEvidenceFlags.js
//
// ID-1 Build 2's flag (contract docs/design/20261104_ID1_ACTIVATION_EVIDENCE_SHAPE_NOTE_V1_7.md
// §2 "Gate"; build report docs/audits/20261104_BUILD_ACTIVATION_OBSERVER.md). A
// flag-source module of its own, registered in flagPinGuard.test.js's
// FLAG_SOURCE_MODULES, and NOT a line in featureFlags.js, for the reason
// agentFormFlags.js gives: App.jsx dynamically imports featureFlags, so Rollup
// keeps that module's whole namespace in the entry chunk and any new export there
// changes the entry's bytes. Nothing on the client reads this flag; it is read by
// the server only (api/_utils/activationEvidence/gate.js). No imports.

/**
 * ACTIVATION_EVIDENCE_ENABLED — the ID-1 activation observer, the sixth tenant
 * of api/cron/process-pending-reflections.js (api/_utils/activationEvidence/).
 *
 * When TRUE, and the cockpit allowlist (COCKPIT_ALLOWLIST_UIDS) names at least
 * one owner, the observer writes one immutable activation pointer per actual
 * holding lifetime of those owners' Trend Follower battles, under
 * agentBattles/{battleId}/activations/{activationId}, and keeps its cursors in
 * activationObserverState/main.
 *
 * DARK — default FALSE. With it false (or an empty allowlist) the observer
 * returns before any read and the cron's response carries no new key
 * (byte-identical). It flips only in the founder's own PR, never a build PR,
 * after the Firestore rules for the two new collections are published and the
 * (ownerId, createdAt) index is deployed. The flip moves the pin in
 * activationEvidenceFlags.test.js to true and drops the DARK_BY_DESIGN entry in
 * flagPinGuard.test.js in the same commit (BUILD_RULES §2).
 */
// Pinned by: activationEvidenceFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const ACTIVATION_EVIDENCE_ENABLED = false;
