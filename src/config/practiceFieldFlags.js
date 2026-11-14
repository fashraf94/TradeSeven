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
 *                admitted; the Film Room's seam answers "no book" without a read. THE SHIPPED VALUE.
 *   'allowlist'  creation, admission and the Film Room's seam admit only a uid the cockpit's SERVER-SIDE
 *                allowlist holds (api/_utils/callRecords/allowlist.js, COCKPIT_ALLOWLIST_UIDS, read at call time).
 *                The crons serve every existing idea book.
 *   'on'         every verified uid.
 * An unknown value reads as 'off' (fail closed).
 *
 * WHAT STAYS TRUE AT EVERY VALUE: a book with `kind: 'idea_book'` is never touched by a quarterly path (the
 * model eval, rollover, escape, batch, the quarterly close). That isolation does not read this flag.
 *
 * Runway: 'off' ships with T1a-1 (dark; exercised only by synthetic fixtures). Never a build PR after this one:
 * each step moves this literal and the pin row in practiceFieldFlags.test.js in the same commit (BUILD_RULES §2).
 * Rollback: one line back a step, with its pin row. Rolling back to 'off' with books open freezes them (no entry,
 * no daily valuation) until the flag returns; nothing is deleted.
 */
// Pinned by: practiceFieldFlags.test.js (the value and its pin row move together — BUILD_RULES §2).
export const PRACTICE_FIELD_MODE = 'off';

/** The walked states, in runway order. */
export const PRACTICE_FIELD_MODES = Object.freeze(['off', 'allowlist', 'on']);
