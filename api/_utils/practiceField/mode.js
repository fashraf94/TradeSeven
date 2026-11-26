// api/_utils/practiceField/mode.js
//
// Practice Field T1a-1 — THE SERVER GATE (build prompt rule 5). PRACTICE_FIELD_MODE resolves here, at call time:
//   'off'        nobody. No Practice Field code path runs in any cron; no reads.
//   'allowlist'  see the two gates below. The crons serve every existing idea book, listed or not.
//   'on'         every non-empty uid.
// An unknown value reads as 'off' (fail closed). Never throws.
//
// THE TWO GATES (build B4, rulings B4-1 and B4-5), each read from the environment NOW (playerList.js — never cached, never
// at module scope):
//   practiceFieldAdmits(uid)       creating a book, admitting an idea, the screen. At 'allowlist': a uid on the idea book's
//                                  OWN player list, PRACTICE_FIELD_PLAYER_UIDS — that list alone. The cockpit's list
//                                  (COCKPIT_ALLOWLIST_UIDS) decides nothing in the idea book since B4.
//   practiceFieldSeamAdmits(uid)   the Film Room's seam (bookStore.js bookForOwner: the nomination route). No nomination opens
//                                  for players: at 'allowlist' it admits only a uid the first gate admits AND on the founder
//                                  list (MANDATE_FOUNDER_UIDS). At 'on' and 'off' it is the first gate, unchanged.
//
// IMPORT-LIGHT ON PURPOSE: the Film Room's card routes load this module through the seam
// (api/_utils/filmRoom/practiceFieldSeam.js → bookStore.js → here), so it imports the flags (two zero-import modules:
// practiceFieldFlags.js and, since build B3, practiceFieldScreenFlags.js) and the list reader (playerList.js, zero imports
// since build B4), and nothing else.
//
// TESTS: the shipped value is 'allowlist' (since the B0 flip), and the accounting is exercised end to end by synthetic
// fixtures. A test sets
// the mode with setPracticeFieldModeForTests, which throws outside the vitest runner (the practiceFieldSeam.js
// idiom) — production can never move the mode except by the flag's own line. The flag module itself is never
// mocked (BUILD_RULES §4: a test's import of this module is the dependency-surface guard).

import {
  PRACTICE_FIELD_MODE, PRACTICE_FIELD_MODES, PRACTICE_FIELD_AGENT_ENABLED, PRACTICE_FIELD_AGENT_THESES_ENABLED,
} from '../../../src/config/practiceFieldFlags.js';
// Build B4 (B4-1, B4-5): the idea book's own player list and the founder list, read at call time.
import { readPracticeFieldPlayerList, readPracticeFieldFounderList } from './playerList.js';
// Build B3 (ruling B3-8): the screen's switch, in a zero-import module of its own the client reads too.
import { PRACTICE_FIELD_SCREEN_ENABLED } from '../../../src/config/practiceFieldScreenFlags.js';

const OFF = 'off';
let testOverride = null;
// Build B2: the agent's two sub-switches, overridable in tests only (null: the flag's own value).
let agentOverride = null;
let thesesOverride = null;
// Build B3: the screen's switch, overridable in tests only (null: the flag's own value).
let screenOverride = null;

/** The mode as the server reads it NOW: one of the walked states, else 'off'. Never throws. */
export function practiceFieldMode() {
  try {
    const mode = testOverride !== null ? testOverride : PRACTICE_FIELD_MODE;
    return Array.isArray(PRACTICE_FIELD_MODES) && PRACTICE_FIELD_MODES.includes(mode) ? mode : OFF;
  } catch {
    return OFF;
  }
}

/** Do the Practice Field's own cron passes run? True unless the mode is 'off'. */
export function practiceFieldLive() {
  return practiceFieldMode() !== OFF;
}

/**
 * Does the mode admit this owner (creating a book, admitting an idea, the screen)? At 'allowlist', only a uid on the idea
 * book's own player list (build B4, ruling B4-1). Never throws.
 */
export function practiceFieldAdmits(uid) {
  if (typeof uid !== 'string' || uid.length === 0) return false;
  const mode = practiceFieldMode();
  if (mode === 'on') return true;
  if (mode === 'allowlist') return readPracticeFieldPlayerList().includes(uid);
  return false;
}

/**
 * Build B4 (ruling B4-5) — THE FILM ROOM SEAM'S NARROWER GATE: does the seam answer for this owner? No nomination opens for
 * players: at 'allowlist', only a uid practiceFieldAdmits admits AND on the founder list (MANDATE_FOUNDER_UIDS). At 'on'
 * and 'off', exactly practiceFieldAdmits. Read at call time; never throws.
 */
export function practiceFieldSeamAdmits(uid) {
  if (!practiceFieldAdmits(uid)) return false;
  if (practiceFieldMode() === 'allowlist') return readPracticeFieldFounderList().includes(uid);
  return true;
}

/**
 * Build B2 (ruling PF-4): does the AGENT run — the desks' one check per session at the close, and the close
 * snapshot's candidate universe on a drafting fire? Only while the mode is not 'off' AND its own sub-switch is on.
 * Read at call time; never throws.
 */
export function practiceFieldAgentOn() {
  try {
    if (!practiceFieldLive()) return false;
    return (agentOverride !== null ? agentOverride : PRACTICE_FIELD_AGENT_ENABLED) === true;
  } catch {
    return false;
  }
}

/** Build B2 (ruling PF-5): are the owner's saved theses a drafting source? Only with the agent on. Never throws. */
export function practiceFieldAgentThesesOn() {
  try {
    if (!practiceFieldAgentOn()) return false;
    return (thesesOverride !== null ? thesesOverride : PRACTICE_FIELD_AGENT_THESES_ENABLED) === true;
  } catch {
    return false;
  }
}

/**
 * Build B3 (ruling B3-8): is the idea book SCREEN on — its endpoint answers, and the client asks? Only while the mode is
 * not 'off' AND its own switch is on. The caller must still pass practiceFieldAdmits. Read at call time; never throws.
 */
export function practiceFieldScreenOn() {
  try {
    if (!practiceFieldLive()) return false;
    return (screenOverride !== null ? screenOverride : PRACTICE_FIELD_SCREEN_ENABLED) === true;
  } catch {
    return false;
  }
}

/** Is this process a test run (the vitest runner sets VITEST; production never does)? */
const isTestRun = () => typeof process !== 'undefined' && Boolean(process.env?.VITEST) && process.env?.NODE_ENV !== 'production';

/**
 * TESTS ONLY — set the mode (any value; an unknown one reads 'off'), or `null` to return to the flag. Returns the
 * restore. Throws outside the vitest runner.
 */
export function setPracticeFieldModeForTests(mode) {
  if (!isTestRun()) throw new Error('setPracticeFieldModeForTests is for tests only');
  const previous = testOverride;
  testOverride = mode;
  return () => { testOverride = previous; };
}

/**
 * TESTS ONLY — set the agent's sub-switches (`{ agent, theses }`, each a boolean, or `null` to return to the flag;
 * an omitted key is left as it is). Returns the restore. Throws outside the vitest runner.
 */
export function setPracticeFieldAgentForTests({ agent, theses } = {}) {
  if (!isTestRun()) throw new Error('setPracticeFieldAgentForTests is for tests only');
  const previous = { agent: agentOverride, theses: thesesOverride };
  if (agent !== undefined) agentOverride = agent;
  if (theses !== undefined) thesesOverride = theses;
  return () => { agentOverride = previous.agent; thesesOverride = previous.theses; };
}

/** TESTS ONLY — set the screen's switch (a boolean, or `null` to return to the flag). Returns the restore. */
export function setPracticeFieldScreenForTests(on) {
  if (!isTestRun()) throw new Error('setPracticeFieldScreenForTests is for tests only');
  const previous = screenOverride;
  screenOverride = on;
  return () => { screenOverride = previous; };
}
