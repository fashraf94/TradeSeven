// api/_utils/practiceField/playerList.js
//
// Practice Field build B4 — THE IDEA BOOK'S OWN PLAYER LIST (ruling B4-1), and the ONE PARSER of the founder list
// (ruling B4-5). Zero imports.
//
//   PRACTICE_FIELD_PLAYER_UIDS   the players the idea book admits at PRACTICE_FIELD_MODE 'allowlist' (mode.js
//                                practiceFieldAdmits): creating a book, admitting an idea, the screen. Comma-separated,
//                                set by the founder in Vercel's production environment and in his own .env.local, and
//                                never committed. The cockpit's list (COCKPIT_ALLOWLIST_UIDS) decides nothing in the idea
//                                book after build B4.
//   MANDATE_FOUNDER_UIDS         the founder list (the Mandate's founder endpoint's own variable, reused by the idea book's
//                                founder door since T1a-2b-1 — founderControls.js founderAllowlist delegates here). Read
//                                here too so the Film Room's seam (bookStore.js, import-light) can ask it without
//                                importing the founder controls (B4-5).
//
//   unset / empty / whitespace      → []   (nobody)
//   "uid-1, uid-2,,uid-3 "          → ['uid-1', 'uid-2', 'uid-3']   (split on commas, each trimmed, empties dropped)
//
// THE PATTERN OF api/_utils/callRecords/allowlist.js: READ AT CALL TIME, never at module scope, nothing cached, never
// throws. Vercel applies an environment change to NEW deployments only: adding or removing a player is the variable AND a
// production redeploy.
//
// SERVER ONLY. No module under src/ may import this file (playerList.test.js walks src/ and pins it), so the client cannot
// learn who is admitted.

/** The environment variable that holds the idea book's players. */
export const PRACTICE_FIELD_PLAYER_ENV = 'PRACTICE_FIELD_PLAYER_UIDS';
/** The environment variable that holds the founders (shared with api/mandate/create.js). */
export const PRACTICE_FIELD_FOUNDER_ENV = 'MANDATE_FOUNDER_UIDS';

/**
 * Parse a comma-separated uid list. Pure.
 *
 * @param {unknown} raw  the variable's value (anything that is not a string reads as unset)
 * @returns {string[]} frozen, in written order
 */
export function parseUidList(raw) {
  if (typeof raw !== 'string') return Object.freeze([]);
  return Object.freeze(raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0));
}

/** The idea book's players, read from the environment NOW. Never throws: an unreadable environment reads as nobody. */
export function readPracticeFieldPlayerList() {
  try {
    return parseUidList(typeof process !== 'undefined' ? process.env?.[PRACTICE_FIELD_PLAYER_ENV] : undefined);
  } catch {
    return Object.freeze([]);
  }
}

/** The founders, read from the environment NOW. Never throws: an unreadable environment reads as nobody. */
export function readPracticeFieldFounderList() {
  try {
    return parseUidList(typeof process !== 'undefined' ? process.env?.[PRACTICE_FIELD_FOUNDER_ENV] : undefined);
  } catch {
    return Object.freeze([]);
  }
}
