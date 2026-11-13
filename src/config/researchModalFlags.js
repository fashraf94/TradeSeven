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
 * RUNWAY: 'off' shipped with Build A (PR #1031, dark). 'allowlist' (the
 * founder's flip PR #1035, 2026-11-08): the owners the cockpit's server-side
 * allowlist admits (the founder and FT_QA). CURRENT: 'on' (the founder's flip
 * PR, 2026-11-11), merged only after the both-directions refinement and the
 * founder's phone check of it on the allowlist, with measured scoring on for
 * every owner (stockThresholdControl/admission read enabled, audience all —
 * docs/audits/20261111_BUILD_BOMB_BOTH_DIRECTIONS.md, BO-1). Each step is a
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
export const RESEARCH_MODAL_BOMB_MODE = 'on';

/** The walked states of RESEARCH_MODAL_SHEET_MODE, in runway order. */
export const RESEARCH_MODAL_SHEET_MODES = Object.freeze(['off', 'allowlist', 'on']);

/**
 * RESEARCH_MODAL_SHEET_MODE — the two-view shell, which delivers Build C (spec
 * of record docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-1; design of record
 * Amendment C, R-28 — Build C's spec docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md
 * §4.1 for its record logic). Opening a stock shows one of three full-screen
 * views switched by header pills — Analysis (opens first), Chart and 💣 (in
 * battle) — with four tabs of today's content under the Analysis view. In a
 * live agent battle the Analysis view is the equipped archetype's lens on the
 * stock: the holding line, its latest sentence, the three questions, the
 * archetype-ordered evidence packs, the record pinned to the chart and the
 * Ask (one message from the per-battle chat 10). A crypto, an index or a
 * sector ETF keeps today's modal at every value (R-35). There is no third flag.
 *
 * A STRING TRI-STATE ('off' | 'allowlist' | 'on'), resolved at CALL time by
 * resolveSheetMode() (src/components/Research/Sheet/sheetMode.js — the client
 * gate sheetGate.js and the server's Ask gate api/_utils/researchAsk.js both
 * read it), which maps any value outside RESEARCH_MODAL_SHEET_MODES to 'off'.
 * Every v2 mount resolves through sheetModeOn() there. Never read at module scope.
 *
 *   'off'        the modal is today's modal byte for byte, on every mount: the
 *                chart above the drawer of tabs, the Analysis tab keeps the
 *                profile and the preset questions, the chart takes no pins,
 *                chat.js writes every exchange as before and refuses a sheet
 *                Ask (403 research_ask_off, before any read or charge). The
 *                battle screen builds no sheet context and the pack builder is
 *                never called.
 *   'allowlist'  PER AGENT BATTLE: the shell for an allowlisted owner's agent
 *                Battle View mounts only — on when the existing
 *                GET /api/agent/cockpit-status answers `allowlisted` for the
 *                caller's own battle, through the Film Room gate's cached
 *                verdict (the same cache Bomb mode reads; this verdict is
 *                unchanged). Every mount with no agent battle — browse, draft,
 *                search — keeps today's modal. chat.js admits a sheet Ask only
 *                from an owner the same allowlist names
 *                (isCockpitOwnerAllowlisted, read at call time).
 *   'on'         the shell on every v2 mount, browse included: the agent
 *                Battle View's three mounts (and the cockpit bench door
 *                through them) with the archetype's Analysis view, every other
 *                mount with the stock's facts.
 *
 * RUNWAY: 'off' shipped with the shell build (PR #1045, dark; Build C shipped
 * 'off' and never left it). CURRENT: 'allowlist' (the founder's flip PR,
 * 2026-11-13), the shell for the cockpit allowlist's owners in their agent
 * battles. 'on' is another one-line founder PR, after one clean live session
 * on the allowlist. Never a build PR; each step moves the first row of
 * researchModalSheetFlag.test.js in the same commit (BUILD_RULES §2).
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
// SMOKE ONLY, NEVER MERGE — the shell spec §8: the mode forced 'on' on the smoke branch.
export const RESEARCH_MODAL_SHEET_MODE = 'on';
