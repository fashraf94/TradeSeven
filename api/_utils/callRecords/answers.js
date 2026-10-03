// api/_utils/callRecords/answers.js
//
// Cockpit Build 2a — THE ANSWER-LEGALITY TABLE (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md S-4; contract V1.4 §7 as amended by
// Amendment B §1 and Amendment C-2). ONE canonical home: the answer endpoint
// (api/agent/call-response.js) decides legality with it, and the cockpit's
// tiles draw their buttons from it — so a tile can never offer an answer the
// endpoint refuses, and no copy of the table exists anywhere.
//
//   pick                      pick → directive · agree / disagree → ack
//   defaultAction 'act'       go → ack · hold → directive
//   defaultAction 'hold'      hold → ack · go_now → directive
//   heldAtMint (upside call)  nothing — every answer is illegal (C-2)
//   anything else             nothing
//
// The endpoint's own guards (deadline, parent status, belief, eligibility,
// pending, budget) are NOT here: they read the transaction's fresh state.
//
// Node-clean AND browser-clean (its one import is copy.js, which is both).

import { isUpsideCall } from './copy.js';

export { isUpsideCall };

/** The six 1a answers (Amendment B §1) and the two deferred to 1b (§2). */
export const ANSWERS_1A = Object.freeze(['go', 'hold', 'go_now', 'pick', 'agree', 'disagree']);
export const DEFERRED_ANSWERS = Object.freeze(['ask', 'keep']);

/**
 * Which row an answer is for this call (Amendment B §1): 'directive', 'ack',
 * or null when the pairing is illegal — including EVERY answer on an upside
 * call (Amendment C-2: an entry on a name already held accepts no answer).
 */
export function classifyAnswer(call, answer) {
  if (!call || typeof call !== 'object') return null;
  if (isUpsideCall(call)) return null;
  if (call.kind === 'pick') {
    if (answer === 'pick') return 'directive';
    if (answer === 'agree' || answer === 'disagree') return 'ack';
    return null;
  }
  if (call.defaultAction === 'act') {
    if (answer === 'go') return 'ack';
    if (answer === 'hold') return 'directive';
    return null;
  }
  if (call.defaultAction === 'hold') {
    if (answer === 'hold') return 'ack';
    if (answer === 'go_now') return 'directive';
    return null;
  }
  return null;
}

/** The answers a shot or confirmation tile can carry, before legality filters them. */
const TILE_CANDIDATES = Object.freeze(['go', 'hold', 'go_now']);

/**
 * The buttons a cockpit tile offers for a call (spec §7.3), from THIS table:
 * at most two, the agreeing answer (an ack, free) first and the overriding one
 * (a directive, one message) second. A pick offers none in 2a (picks are not
 * shown); an upside call offers none (C-2); a call with no legal answer offers
 * none. Whether the call is still open is the caller's question.
 *
 * @returns {Array<{ answer: string, row: 'ack'|'directive' }>}
 */
export function tileAnswersFor(call) {
  if (!call || typeof call !== 'object' || call.kind === 'pick') return [];
  const rows = TILE_CANDIDATES.map((answer) => ({ answer, row: classifyAnswer(call, answer) })).filter((r) => r.row !== null);
  return [...rows.filter((r) => r.row === 'ack'), ...rows.filter((r) => r.row === 'directive')];
}
