// src/config/practiceFieldFlags.js
//
// The Practice Field's flag (build T1a-1 + T1c, the idea book's accounting; concept
// docs/design/20261112_PRACTICE_FIELD_CONCEPT_V6_1.md, shared contract V2 with Amendments A, B and C;
// build report docs/audits/20261113_BUILD_T1A1_T1C_IDEA_BOOK_ACCOUNTING.md). A flag-source module of its own and
// NOT a line in featureFlags.js, for the reason agentFormFlags.js gives: App.jsx dynamically imports featureFlags,
// so a new export there changes the entry chunk's bytes. No module under src/ imports this file (its test pins
// that), so the client bundle never carries it; the server reads it through api/_utils/practiceField/mode.js,
// at call time. No imports.

/**
 * PRACTICE_FIELD_MODE — the idea book: one agent-run $100,000 paper book per player on the Mandate engine
 * (`mandates/{bookId}` with `kind: 'idea_book'`).
 *
 * A STRING TRI-STATE, after FILM_ROOM_CARDS_MODE and RESEARCH_MODAL_BOMB_MODE:
 *   'off'        nobody. No Practice Field code path runs in any cron; no book can be created; no idea can be
 *                admitted; the Film Room's seam answers "no book" without a read.
 *   'allowlist'  creation, admission and the Film Room's seam admit only a uid the cockpit's SERVER-SIDE
 *                allowlist holds (api/_utils/callRecords/allowlist.js, COCKPIT_ALLOWLIST_UIDS, read at call time).
 *                The crons serve every existing idea book. THE SHIPPED VALUE.
 *   'on'         every verified uid.
 * An unknown value reads as 'off' (fail closed).
 *
 * WHAT STAYS TRUE AT EVERY VALUE: a book with `kind: 'idea_book'` is never touched by a quarterly path (the
 * model eval, rollover, escape, batch, the quarterly close). That isolation does not read this flag.
 *
 * Runway: 'off' ships with T1a-1 (dark; exercised only by synthetic fixtures); 'allowlist' with the B0 flip (founder
 * PR, Practice Field PF-1: the founder's own book first — only the founder door creates a book). Never a build PR:
 * each step moves this literal and the pin row in practiceFieldFlags.test.js in the same commit (BUILD_RULES §2).
 * Rollback: one line back a step, with its pin row. Rolling back to 'off' with books open freezes them (no entry,
 * no daily valuation) until the flag returns; nothing is deleted.
 */
// Pinned by: practiceFieldFlags.test.js (the value and its pin row move together — BUILD_RULES §2).
export const PRACTICE_FIELD_MODE = 'allowlist';

/** The walked states, in runway order. */
export const PRACTICE_FIELD_MODES = Object.freeze(['off', 'allowlist', 'on']);

/**
 * PRACTICE_FIELD_AGENT_ENABLED — build B2 (T1b + T1d, launch scope; founder ruling PF-4): the AGENT's one check per
 * desk per session, at the close. With it true, after an open idea book's close has committed, each desk with work
 * (the Shadow desk: medium and long; the archetype desk: short) makes ONE model call (claude-sonnet-5-5, reserved and
 * settled against the book's $3 month), writes its note on the session's close row, holds or exits each of its open
 * ideas, and drafts into its empty slots; code admits, sizes and sells. The close snapshot of a session where a book
 * will draft also carries the shared candidate universe.
 *
 * ON (the founder's agent-on PR, Nov 24, 2026, after Astra's B2 confirmation READY), and a kill switch: with it false
 * no agent code path reads, writes, fetches or calls — every fire is the engine's and the idea book's as before (the
 * isolation rows prove it byte for byte). It is read only through api/_utils/practiceField/mode.js, at call time, and
 * only while PRACTICE_FIELD_MODE is not 'off'; at 'allowlist' it runs only for a book whose owner the allowlist holds.
 * Runway: false shipped with B2; the agent-on PR flipped it (the build report §7 step 3), moving this literal, its pin
 * row in practiceFieldFlags.test.js and its DARK_BY_DESIGN entry in flagPinGuard.test.js in one commit (BUILD_RULES §2).
 * Rollback: the literal and its pin row back to false; the DARK_BY_DESIGN entry stays out (a kill switch now). Ideas
 * the agent admitted keep running under code.
 */
// Pinned by: practiceFieldFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const PRACTICE_FIELD_AGENT_ENABLED = true;

/**
 * PRACTICE_FIELD_AGENT_THESES_ENABLED — build B2 (ruling PF-5): the owner's saved theses (`thesisCard` on a saved
 * list) as a drafting source for the Shadow desk only, read-only, quoted to the model as untrusted player text. Its
 * own sub-switch under PRACTICE_FIELD_AGENT_ENABLED (with the agent off it does nothing). Dark on merge; flipped by
 * its own founder PR the same way.
 */
// Pinned by: practiceFieldFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const PRACTICE_FIELD_AGENT_THESES_ENABLED = false;
