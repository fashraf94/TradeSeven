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

/** The walked states of RESEARCH_MODAL_SHEET_MODE, in runway order. */
export const RESEARCH_MODAL_SHEET_MODES = Object.freeze(['off', 'allowlist', 'on']);

/**
 * RESEARCH_MODAL_SHEET_MODE — Build C: the sheet in battle (spec of record
 * docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md §4.1). In a live agent
 * battle the Analysis tab becomes the equipped archetype's lens on the stock:
 * the stance line, its latest sentence, the three questions, the
 * archetype-ordered evidence packs, the record pinned to the chart and the
 * Ask (one message from the per-battle chat 10).
 *
 * A STRING TRI-STATE ('off' | 'allowlist' | 'on'), resolved at CALL time by
 * resolveSheetMode() (src/components/Research/Sheet/sheetGate.js), which maps
 * any value outside RESEARCH_MODAL_SHEET_MODES to 'off'. Never read at module
 * scope.
 *
 *   'off'        the modal is today's modal byte for byte: the Analysis tab
 *                keeps the profile and the preset questions, the chart takes
 *                no pins, chat.js writes every exchange as before. The battle
 *                screen builds no sheet context and the pack builder is never
 *                called.
 *   'allowlist'  PER AGENT BATTLE: on only when the existing
 *                GET /api/agent/cockpit-status answers `allowlisted` for the
 *                caller's own battle, through the Film Room gate's cached
 *                verdict (the same cache Bomb mode reads). A mount with no
 *                agent battle resolves 'allowlist' to off.
 *   'on'         the agent Battle View's three mounts (and the cockpit bench
 *                door through them) open the sheet; every other mount is
 *                unchanged.
 *
 * RUNWAY: 'off' ships with Build C (dark). 'allowlist' (the founder and FT_QA)
 * is its own one-line founder PR after merge; 'on' is another, after one clean
 * live session on the allowlist. Never a build PR; each step moves the first
 * row of researchModalSheetFlag.test.js in the same commit (BUILD_RULES §2).
 * ROLLBACK: a kill switch: roll back one step at a time ('on' → 'allowlist'
 * → 'off') by moving the literal and its pin together; every mode-off arm
 * stays in the code until the cleanup PR, after 'on' has run in production.
 *
 * WHAT THE AGENT SEES: an Ask is one ordinary chat turn through
 * api/agent/chat.js — the same budget, integrity gate and directive filing —
 * with the pack in the prompt as a delimited block. Nothing else the agent
 * sees or trades changes at any value.
 */
// Pinned by: researchModalSheetFlag.test.js (the pin and this value move together — BUILD_RULES §2).
export const RESEARCH_MODAL_SHEET_MODE = 'off';
