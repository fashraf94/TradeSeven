// api/_utils/practiceField/__testsupport__/promptLeaves.js
//
// Practice Field build B6 — THE LEAF COMPARISON WITH MAIN of B2's thirteen-session run (agentEndToEnd.test.js,
// foundersLiveBook.test.js). B6 changes the words the model reads, so the run's dump moves; it may move ONLY where the
// prompt's own versions and texts are recorded. restoreMainPromptLeaves puts main's values back at the leaves B6 moved
// (__fixtures__/agentRunMainPromptLeaves.js): when the result is main's pinned dump byte for byte, no other leaf moved.
// Test support only; never imported by a production path.

import { MAIN_PROMPT_LEAVES } from '../__fixtures__/agentRunMainPromptLeaves.js';

/** The documents B6's wording may move: the close rows of the book's window ledger. */
export const CLOSE_ROW_DOC = /^mandates\/pf_[0-9a-f]{24}\/windows\/\d{4}-\d{2}-\d{2}_close$/;
/** The fields it may move there: a desk's prompt manifest's versions and input measures, and each attempt's input hash. */
export const PROMPT_LEAF = /^agent\/desks\/(shadow|archetype)\/(manifest\/(version|identity\/version|inputHash|inputSha256|inputBytes)|attempts\/\d+\/inputHash)$/;

/**
 * A dump (fixtures.js dumpStore) with main's values put back at the leaves B6 moved, written as dumpStore writes it; and
 * each of those leaves with main's value and this dump's. Throws when a leaf is missing (the run changed shape).
 * @returns {{ restored: string, moved: Array<{ doc: string, field: string, main: unknown, now: unknown }> }}
 */
export function restoreMainPromptLeaves(dump) {
  const store = JSON.parse(dump);
  const moved = [];
  for (const [doc, field, main] of MAIN_PROMPT_LEAVES) {
    const keys = field.split('/');
    let at = store[doc];
    for (const k of keys.slice(0, -1)) at = at?.[k];
    const last = keys[keys.length - 1];
    if (at === null || typeof at !== 'object' || !Object.hasOwn(at, last)) throw new Error(`restoreMainPromptLeaves: no leaf ${doc} ${field}`);
    moved.push({ doc, field, main, now: at[last] });
    at[last] = main;
  }
  return { restored: JSON.stringify(store, null, 1), moved };
}
