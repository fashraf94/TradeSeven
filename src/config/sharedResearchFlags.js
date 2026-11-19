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
 * RUNWAY: 'off' shipped with B1 (dark). 'allowlist' (the founder and FT_QA) is
 * LIVE as of this PR (claude/shared-research-allowlist), its own one-line founder
 * PR after B1 (#1048), B2 (#1059) and the hub door (#1064) merged and the rules
 * and indexes were deployed to production (2026-11-15, from origin/main
 * 0b720acc); 'on' is another, after one clean allowlist week and the framework's
 * idea-record admission change (spec §11.3). Never a build PR; each step moves
 * the first row of sharedResearchFlags.test.js in the same commit (BUILD_RULES §2).
 * ROLLBACK: a kill switch: roll back one step at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; every mode-off arm stays in the code until the cleanup PR, after 'on' has run in production.
 *
 * NOTHING THE AGENT SEES OR TRADES changes at any value: the route never writes
 * to an agent, a battle or a loadout; adoption writes a list and its first idea
 * version, and "Use it in my next game" is the existing ready and equip routes.
 */
// Pinned by: sharedResearchFlags.test.js (the pin and this value move together — BUILD_RULES §2).
export const SHARED_RESEARCH_MODE = 'allowlist';

/** The walked states of SHARED_RESEARCH_BUILDER_MODE. */
export const SHARED_RESEARCH_BUILDER_MODES = Object.freeze(['off', 'on']);

/**
 * SHARED_RESEARCH_BUILDER_MODE — the thesis builder (Amendment B,
 * docs/specs/20261116_SHARED_RESEARCH_SPEC_V1_2_AMENDMENT_B_THESIS_BUILDER.md §B2).
 * It decides only whether a NEW investigation opens as a thesis builder; who may
 * use Shared Research at all is still SHARED_RESEARCH_MODE above.
 *
 * A STRING ('off' | 'on'), resolved at CALL time by sharedResearchBuilderMode()
 * (api/_utils/sharedResearch/gate.js), which maps any other value — or a read
 * that throws — to 'off'. Never read at module scope.
 *
 *   'off'  every investigation opens as today's ledger: no stamp, the same
 *          intents, answers and work view (§B10 S-B2).
 *   'on'   an investigation opened now is stamped `shape: 'builder'` and takes
 *          only the builder's intents and actions (§B4). The stamp never changes.
 *
 * RUNWAY: 'off' ships with B3 (the server, dark) and stays 'off' through B4 (the
 * client, dark); then one founder PR flips it to 'on' with its pin, after B4
 * merges (§B9). Never a build PR.
 * 'on' from 2026-11-18 (this PR), after B3 #1083, B4 #1086 and B5 #1089. Rollback: back to 'off' with its pin.
 * ROLLBACK: move the literal back to 'off' with its pin: new investigations open as ledgers; open builder sessions keep working.
 */
// Pinned by: sharedResearchFlags.test.js (the pin and this value move together — BUILD_RULES §2).
export const SHARED_RESEARCH_BUILDER_MODE = 'on';
