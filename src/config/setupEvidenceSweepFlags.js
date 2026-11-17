// src/config/setupEvidenceSweepFlags.js
//
// The chart's evidence — the daily sweep's flag (spec of record
// docs/specs/CHART_EVIDENCE_SPEC_V1.md SW-6; build report
// docs/audits/20261116_BUILD_CHART_EVIDENCE.md). A flag-source module of its own,
// registered in flagPinGuard.test.js's FLAG_SOURCE_MODULES, and NOT a line in
// featureFlags.js, for the reason setupMenuLabelsFlags.js gives: App.jsx dynamically
// imports featureFlags, so Rollup keeps that module's whole namespace in the entry
// chunk and any new export there changes the entry's bytes. Nothing on the client
// reads this flag; it is read by the server only
// (api/_utils/setupEvidenceSweep/gate.js). No imports.

/**
 * SETUP_EVIDENCE_SWEEP_ENABLED — the daily sweep: api/cron/setup-evidence-sweep.js makes
 * one stored Trend Follower setup record exist for each of the 228 ranked stocks
 * (ALL_TICKERS), for the last completed trading session, through the shared store's
 * getOrAcquireSnapshot. Three runs per session (two after the close, one before the next
 * open); about 230–275 daily-bar provider requests per trading day, a HARD STOP at 400
 * counted on setupEvidenceSweepState/{session}; no model call.
 *
 * ON — TRUE since PR C (the switch; built dark in PR B, 2026-11-16). The cron runs the
 * sweep at each scheduled time: three runs per trading session, about 230–275 provider
 * requests a session, hard stop 400. With it false (a rollback) the cron answers
 * `{ skipped: true }` before the Firestore handle is taken: no read, no write, no
 * provider request. ROLLBACK: revert PR C's one commit, which in ONE commit
 * (BUILD_RULES §2) sets this literal back to false with this paragraph, moves the first
 * row of setupEvidenceSweepFlags.test.js back to false, turns the DARK_BY_DESIGN expect
 * of its registration row back to `.toMatch`, and restores the DARK_BY_DESIGN entry in
 * flagPinGuard.test.js.
 */
// Pinned by: setupEvidenceSweepFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const SETUP_EVIDENCE_SWEEP_ENABLED = true;
