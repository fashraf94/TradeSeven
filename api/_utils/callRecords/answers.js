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
// Cockpit Build 2b (contract Amendment D, D-4; spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md
// S-4) — TWO ROWS behind the flag argument `{ v2 }` (the endpoint passes
// isCockpit2bOn(), and so does the client, so both read one table):
//
//   exit · act · counterpart null · not upside    replace + pickSymbol (required) → directive (call_replace)
//   exit · hold · counterpart null · not upside   go_now + pickSymbol (optional)  → directive (call_go with a name)
//
// `pickSymbol` on any other pairing is illegal (`answerTakesPick`). Without
// `{ v2: true }` the table is Build 2a's exactly: `replace` is no answer and
// `pickSymbol` rides only a pick.
//
// The endpoint's own guards (deadline, parent status, belief, eligibility,
// the live slot, budget) are NOT here: they read the transaction's fresh state.
//
// Node-clean AND browser-clean (its one import is copy.js, which is both).

import { isUpsideCall } from './copy.js';

export { isUpsideCall };

/** The six 1a answers (Amendment B §1) and the two deferred to 1b (§2). */
export const ANSWERS_1A = Object.freeze(['go', 'hold', 'go_now', 'pick', 'agree', 'disagree']);
export const DEFERRED_ANSWERS = Object.freeze(['ask', 'keep']);
/** Build 2b's one new answer (D-4), legal only with `{ v2: true }`. */
export const ANSWER_REPLACE = 'replace';
/** The answers the endpoint's wire admits: 1a's six, plus `replace` while the 2b flag is on. */
export function wireAnswers({ v2 = false } = {}) {
  return v2 ? [...ANSWERS_1A, ANSWER_REPLACE] : [...ANSWERS_1A];
}

const nonEmpty = (v) => typeof v === 'string' && v.length > 0;

/** An exit call (shot or confirmation) with no usable replacement named — the two D-4 rows' shared shape. */
function exitWithoutCounterpart(call) {
  return call?.kind !== 'pick' && call?.direction === 'exit' && !nonEmpty(call?.counterpart) && !isUpsideCall(call);
}

/**
 * Which row an answer is for this call (Amendment B §1): 'directive', 'ack',
 * or null when the pairing is illegal — including EVERY answer on an upside
 * call (Amendment C-2: an entry on a name already held at mint accepts no answer).
 * `{ v2: true }` adds D-4's `replace` row.
 */
export function classifyAnswer(call, answer, { v2 = false } = {}) {
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
    if (v2 && answer === ANSWER_REPLACE && exitWithoutCounterpart(call)) return 'directive';
    return null;
  }
  if (call.defaultAction === 'hold') {
    if (answer === 'hold') return 'ack';
    if (answer === 'go_now') return 'directive';
    return null;
  }
  return null;
}

/**
 * Does this pairing take a chosen name (`pickSymbol`), and must it?
 *   'required'  a pick (Build 1a); `replace` (D-4, v2)
 *   'optional'  `go_now` on a hold-default exit with no counterpart (D-4, v2)
 *   null        no other pairing takes one — a `pickSymbol` there is illegal
 */
export function answerTakesPick(call, answer, { v2 = false } = {}) {
  if (!call || typeof call !== 'object') return null;
  if (call.kind === 'pick') return answer === 'pick' ? 'required' : null;
  if (!v2) return null;
  if (answer === ANSWER_REPLACE && call.defaultAction === 'act' && exitWithoutCounterpart(call)) return 'required';
  if (answer === 'go_now' && call.defaultAction === 'hold' && exitWithoutCounterpart(call)) return 'optional';
  return null;
}

/**
 * D-4's one second answer: `replace` is legal when the call has no
 * playerResponse, OR when its playerResponse is the `go` acknowledgment (the
 * player confirmed the exit, then names who comes in). Every other answered
 * pairing stays 409 already_answered.
 */
export function isGoAcknowledgment(playerResponse) {
  return !!playerResponse && typeof playerResponse === 'object' && playerResponse.kind === 'ack' && playerResponse.answer === 'go';
}

/** The answers a shot or confirmation tile can carry, before legality filters them. */
const TILE_CANDIDATES = Object.freeze(['go', 'hold', 'go_now']);

/**
 * The buttons a cockpit tile offers for a call (spec §7.3), from THIS table:
 * at most two, the agreeing answer (an ack, free) first and the overriding one
 * (a directive, one command) second. A pick offers none (picks are not
 * shown); an upside call offers none (C-2); a call with no legal answer offers
 * none. Whether the call is still open is the caller's question. `replace`
 * is never a button: it is the "Who comes in?" step's chips (2b §5.3).
 *
 * @returns {Array<{ answer: string, row: 'ack'|'directive' }>}
 */
export function tileAnswersFor(call, { v2 = false } = {}) {
  if (!call || typeof call !== 'object' || call.kind === 'pick') return [];
  const rows = TILE_CANDIDATES.map((answer) => ({ answer, row: classifyAnswer(call, answer, { v2 }) })).filter((r) => r.row !== null);
  return [...rows.filter((r) => r.row === 'ack'), ...rows.filter((r) => r.row === 'directive')];
}

/**
 * Where the "Who comes in?" step stands for a call (2b spec S-4, §5.3), or
 * null when it has none:
 *   'on_card'             an exit + act call with no counterpart, open, with
 *                         no response or the `go` acknowledgment (V5-6: a pick
 *                         after "Confirm exit" files `replace`)
 *   'after_exit_instead'  an exit + hold call with no counterpart and no
 *                         response (V5-4: the step opens before "Exit instead"
 *                         files `go_now`)
 * Always null without `{ v2: true }`.
 */
export function replacementStepFor(call, { v2 = false } = {}) {
  if (!v2 || !call || typeof call !== 'object' || call.state !== 'open') return null;
  if (!exitWithoutCounterpart(call)) return null;
  const pr = call.playerResponse;
  if (call.defaultAction === 'act') return !pr || isGoAcknowledgment(pr) ? 'on_card' : null;
  if (call.defaultAction === 'hold') return !pr ? 'after_exit_instead' : null;
  return null;
}
