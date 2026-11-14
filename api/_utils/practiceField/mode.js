// api/_utils/practiceField/mode.js
//
// Practice Field T1a-1 — THE SERVER GATE (build prompt rule 5). PRACTICE_FIELD_MODE resolves here, at call time:
//   'off'        nobody. No Practice Field code path runs in any cron; no reads.
//   'allowlist'  creation, admission and the Film Room's seam admit only a uid the cockpit's SERVER-SIDE allowlist
//                holds (api/_utils/callRecords/allowlist.js — the environment, read NOW, never cached, never at
//                module scope). The crons serve every existing idea book.
//   'on'         every non-empty uid.
// An unknown value reads as 'off' (fail closed). Never throws.
//
// IMPORT-LIGHT ON PURPOSE: the Film Room's card routes load this module through the seam
// (api/_utils/filmRoom/practiceFieldSeam.js → bookStore.js → here), so it imports the flag and the allowlist
// reader and nothing else.
//
// TESTS: the shipped value is 'off', and the accounting is exercised end to end by synthetic fixtures. A test sets
// the mode with setPracticeFieldModeForTests, which throws outside the vitest runner (the practiceFieldSeam.js
// idiom) — production can never move the mode except by the flag's own line. The flag module itself is never
// mocked (BUILD_RULES §4: a test's import of this module is the dependency-surface guard).

import { PRACTICE_FIELD_MODE, PRACTICE_FIELD_MODES } from '../../../src/config/practiceFieldFlags.js';
import { readCockpitAllowlist } from '../callRecords/allowlist.js';

const OFF = 'off';
let testOverride = null;

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

/** Does the mode admit this owner (creation, admission, the Film Room's seam)? Never throws. */
export function practiceFieldAdmits(uid) {
  if (typeof uid !== 'string' || uid.length === 0) return false;
  const mode = practiceFieldMode();
  if (mode === 'on') return true;
  if (mode === 'allowlist') return readCockpitAllowlist().includes(uid);
  return false;
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
