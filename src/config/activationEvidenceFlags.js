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
 * ON — default TRUE since 2026-11-06 (the founder's own flip PR, after the
 * Firestore rules for the two new collections were published and the
 * (ownerId, createdAt) index and the two observer-state exemptions were
 * Enabled; flip checklist: docs/audits/20261106_BUILD_ACTIVATION_OBSERVER_REVIEW_FIXES.md
 * §11). Built DARK (default FALSE, 2026-11-04): with it false (or an empty
 * allowlist) the observer returns before any read and the cron's response
 * carries no new key (byte-identical). It is now live for the owners the cockpit
 * allowlist (COCKPIT_ALLOWLIST_UIDS) names, from the reflections cron's next run;
 * an empty allowlist is still off. The flip moved the pin in
 * activationEvidenceFlags.test.js to true and dropped the DARK_BY_DESIGN entry in
 * flagPinGuard.test.js in the same commit (BUILD_RULES §2). Rollback: one line
 * back to false, with the pin row and the registration row, in its own PR.
 */
// Pinned by: activationEvidenceFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const ACTIVATION_EVIDENCE_ENABLED = true;
