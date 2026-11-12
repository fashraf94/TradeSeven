// src/config/huddleFlags.js
//
// Huddle S1's flag (spec docs/specs/20261030_HUDDLE_S1_BUILD_SPEC_V1_1.md §13, as
// replaced by Amendment A §A10; build report docs/audits/20261107_BUILD_HUDDLE_S1.md).
// A flag-source module of its own, registered in flagPinGuard.test.js's
// FLAG_SOURCE_MODULES, and NOT a line in featureFlags.js, for the reason
// agentFormFlags.js gives: App.jsx dynamically imports featureFlags, so Rollup
// keeps that module's whole namespace in the entry chunk and any new export there
// changes the entry's bytes. The hub reads this flag as a literal (its chunk only);
// the server reads it through api/_utils/huddle/gate.js. No imports.

/**
 * DRB_HUDDLE_ENABLED — the Huddle: the per-player spoken morning brief and its
 * confirmable game plan (concept docs/design/20261029_DRB_HUDDLE_CONCEPT_V1_2.md;
 * spec V1.1 with Amendments A, B and C V1.2).
 *
 * When TRUE: the brief cron enqueues one job per active player after the brief
 * stage (api/cron/compute-daily-regime-brief.js), the worker
 * (api/cron/huddle-worker.js) drains the queue and reconciles plan receipts,
 * every /api/huddle/* route answers, the check-start sweep
 * (api/_utils/huddle/sweep.js, one call in agent-evaluate.js) files a confirmed
 * plan into a battle that lacks it, the settle tenant reconciles, and the hub
 * shows the chip, the Huddle sheet, the Partnership plan panel, the "Huddle
 * ready" next action, the plan activity rows and the Deploy card's reconfirm
 * line.
 *
 * ON IN CODE, FOR A NAMED COHORT ONLY (Amendment E §E7, the S1.1 PR of Nov 10,
 * 2026). The cohort is `HUDDLE_PLAYER_UIDS` (api/_utils/huddle/gate.js), the
 * Huddle's own and FAIL CLOSED: unset or empty is no one. Outside the cohort —
 * every player while it is unset — production behaves exactly as with this flag
 * false but for the morning `huddleRuns` marker: the worker exits at once, every
 * /api/huddle/* route answers the flag-off 404, the sweep and the settle reconcile
 * return before any read, and the hub renders its flag-off self (it shows the
 * Huddle only to a player its two readers show inside the cohort, huddleView.js
 * huddleMemberOf). Two reads remain for EVERY signed-in player: the hub's status
 * GET (/api/huddle/status) on mount, owner or epoch change and each page-visible
 * transition — for an outsider a 404 before any Firestore read (auth only, with a
 * non-empty cohort) — while the plan-history query runs only after that GET has
 * answered 200 (review HU-11, HC-5). The public flip (every player) still waits for
 * S2–S4 (concept R-10); how "everyone" is expressed is ruled then. Rollback: this
 * line back to false, with its pin and the DARK_BY_DESIGN entry
 * (flagPinGuard.test.js), in one commit — after the close: a confirmed plan filed
 * that day stays in its game until the battle completes (review HC-1). A cohort
 * change takes effect on the next deployment (gate.js).
 */
// Pinned by: huddleFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const DRB_HUDDLE_ENABLED = true;
