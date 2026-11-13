// src/config/sharedResearchFlags.js
//
// Shared Research "Work an idea" — the flag (spec of record
// docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md §6.1, §6.2, §11).
// A flag-source module of its own, and NOT a line in featureFlags.js on purpose:
// App.jsx dynamically imports featureFlags (`await import('./config/featureFlags')`),
// so Rollup keeps that module's whole namespace in the entry chunk and any new
// export there changes the entry's bytes (the agentFormFlags.js /
// researchModalFlags.js precedent). It holds no `*_ENABLED` boolean, so the flag
// pin guard has nothing in it to scan; SHARED_RESEARCH_MODE is noted by name in
// the guard's DARK_BY_DESIGN block instead (the RESEARCH_MODAL_SHEET_MODE
// precedent).
//
// IMPORTS NOTHING: the server (api/_utils/sharedResearch/gate.js) imports this
// module under the BUILD_RULES §4 import rule, so it must stay Node-clean.

/** The walked states of SHARED_RESEARCH_MODE, in runway order. */
export const SHARED_RESEARCH_MODES = Object.freeze(['off', 'allowlist', 'on']);

/**
 * SHARED_RESEARCH_MODE — the Shared Research route (`/api/forge/shared-research`)
 * and, from B2, the sheet the hub opens.
 *
 * A STRING TRI-STATE ('off' | 'allowlist' | 'on'), resolved at CALL time by
 * sharedResearchMode() (api/_utils/sharedResearch/gate.js), which maps any value
 * outside SHARED_RESEARCH_MODES to 'off'. Never read at module scope.
 *
 *   'off'        every action and read answers 404 { error: 'disabled' } before
 *                auth and before any read; nothing is written, no model is called.
 *   'allowlist'  on only for an owner the cockpit's server-side allowlist admits
 *                (isCockpitOwnerAllowlisted, COCKPIT_ALLOWLIST_UIDS, read at call
 *                time) AND idea-record admission (hypothesisRecordsOnFor), since
 *                adoption writes idea records (spec D-4). Anyone else: the same 404.
 *   'on'         every verified uid idea-record admission admits.
 *
 * RUNWAY: 'off' ships with B1 (dark). 'allowlist' (the founder and FT_QA) is its
 * own one-line founder PR after B1 and B2 merge and the rules are deployed; 'on'
 * is another, after one clean allowlist week and the framework's idea-record
 * admission change (spec §11.3). Never a build PR; each step moves the first row
 * of sharedResearchFlags.test.js in the same commit (BUILD_RULES §2).
 * ROLLBACK: a kill switch: roll back one step at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; every mode-off arm stays in the code until the cleanup PR, after 'on' has run in production.
 *
 * NOTHING THE AGENT SEES OR TRADES changes at any value: the route never writes
 * to an agent, a battle or a loadout; adoption writes a list and its first idea
 * version, and "Use it in my next game" is the existing ready and equip routes.
 */
// Pinned by: sharedResearchFlags.test.js (the pin and this value move together — BUILD_RULES §2).
export const SHARED_RESEARCH_MODE = 'off';
