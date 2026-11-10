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
 * DARK — default FALSE, and it STAYS false on main. With it false the brief's
 * cron entry and handler behave exactly as HEAD but for the `huddleRuns` marker
 * around the brief stage; the worker exits at once; every /api/huddle/* route
 * returns 404; the sweep helper and the settle reconcile return before any read;
 * nothing new renders on the hub and the new next-action rule is inert. It is
 * flipped only on the never-merge smoke branch (claude/huddle-s1-smoke) for the
 * founder's preview, and for real only in its own flip PR after S1–S4 (concept
 * R-10), which also carries the brief's DST pin, its trading-day skip and the
 * brief card's removal (Amendment A §A10).
 */
// Pinned by: huddleFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const DRB_HUDDLE_ENABLED = false;
