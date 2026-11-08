// src/config/researchModalFlags.js
//
// The research modal redesign's flags (spec of record
// docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md §4.1; Phase 0 report
// docs/audits/20261102_PHASE0_RESEARCH_MODAL.md §J). A flag-source module of
// its own, and NOT a line in featureFlags.js on purpose: App.jsx dynamically
// imports featureFlags (`await import('./config/featureFlags')`, the Desk's
// sync read), so Rollup keeps that module's whole namespace object in the
// entry chunk and any new export there changes the entry's bytes (the
// agentFormFlags.js precedent). It holds no `*_ENABLED` boolean, so the flag
// pin guard has nothing in it to scan; RESEARCH_MODAL_BOMB_MODE is noted by
// name in the guard's DARK_BY_DESIGN block instead (the FILM_ROOM_CARDS_MODE
// precedent).

/** The walked states of RESEARCH_MODAL_BOMB_MODE, in runway order. */
export const RESEARCH_MODAL_BOMB_MODES = Object.freeze(['off', 'allowlist', 'on']);

/**
 * RESEARCH_MODAL_BOMB_MODE — Build A: Bomb mode (the Fuse, the red zone and
 * one sheet) in the research modal, for a stock opened inside a battle.
 *
 * A STRING TRI-STATE ('off' | 'allowlist' | 'on'), resolved at CALL time by
 * resolveBombMode() (src/components/Research/BombMode/bombModeGate.js), which
 * maps any value outside RESEARCH_MODAL_BOMB_MODES to 'off'. Never read at
 * module scope.
 *
 *   'off'        the modal is today's modal byte for byte: the candlestick
 *                bomb chart, the spectate view and BaggerBombTab. The battle
 *                screen never calls the record selector.
 *   'allowlist'  PER AGENT BATTLE: on only when the existing
 *                GET /api/agent/cockpit-status answers `allowlisted` for the
 *                caller's own battle, through the Film Room gate's cached
 *                verdict (one request per owner per page life, shared). A
 *                mount with no agent battle resolves 'allowlist' to off.
 *   'on'         every in-battle mount (the agent Battle View's three mounts
 *                and the cockpit bench door through them, the BaggerBomb free
 *                agent bar, the BaggerBomb battle view) passes a bombContext
 *                and gets Bomb mode; every other mount loses the 💣 pill and
 *                the Bomb tab (BA-5).
 *
 * RUNWAY: 'off' shipped with Build A (PR #1031, dark). CURRENT: 'allowlist'
 * (the founder's flip PR, 2026-11-08): the owners the cockpit's server-side
 * allowlist admits (the founder and FT_QA). 'on' is its own founder PR, merged
 * only after one clean live market session on the allowlist. Each step is a
 * one-line founder PR, never a build PR, and moves the first row of
 * researchModalFlags.test.js in the same commit (BUILD_RULES §2).
 * ROLLBACK: a kill switch: roll back one step at a time ('on' → 'allowlist'
 * → 'off') by moving the literal and its pin together; every mode-off arm
 * stays in the code until the cleanup PR, after 'on' has run in production.
 * The cleanup PR (after 'on' has run in production) deletes the unreachable
 * legacy ladder code, the dead setMarkers call, the mode-off arms and the
 * spec's §8 smoke list; until then the mode-off goldens guard 'off'.
 *
 * NOTHING THE AGENT SEES OR TRADES changes at any value: Bomb mode reads
 * records the client already holds and requests nothing new.
 */
// Pinned by: researchModalFlags.test.js (the pin and this value move together — BUILD_RULES §2).
export const RESEARCH_MODAL_BOMB_MODE = 'allowlist';
