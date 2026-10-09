// src/data/executionOutcome.js
//
// THE UNCONFIRMED-OUTCOME MARKER, AS DATA — enforce readiness (8 Oct 2026),
// table G of docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md (V1.4). Report:
// docs/audits/20261008_BUILD_ENFORCE_READINESS.md.
//
// The cron writes `executionOutcome: 'unknown'` when the executor THREW and the
// server's own fresh read of the battle then failed (integrity follow-up 2,
// Part D; api/_utils/landedTrade.js): whether the swap landed is not known, and
// the record claims neither. This module answers one question about a record —
// does it carry that marker? — and never renders anything.
//
// WHY NOT decisionRecord.js. That module is the decision record's VOCABULARY
// (the words a player reads), and deskHonesty.test.js sweeps its code for the
// resolver-diagnostic words a player must never read — `unknown` among them.
// The marker's wire value is that word, but it is a token compared against,
// not a word anyone sees: the table G LABELS live in decisionRecord.js beside
// the other states, and the value they are chosen by lives here. decisionRecord.js
// is zero-import on purpose (hazard 26), so it cannot import this module; the
// selector (selectWhyState.js) and the feed surfaces import both.
//
// ZERO IMPORTS, like decisionRecord.js: Node-clean, never part of a mocked graph.

/**
 * The marker's value — the server's `EXECUTION_OUTCOME_UNKNOWN`
 * (api/_utils/landedTrade.js), pinned equal to it by a row in
 * decisionRecord.test.js. Declared here, not imported: api/ code is not this
 * module's to import.
 */
export const EXECUTION_OUTCOME_UNKNOWN = 'unknown';

/** Whether a record (an evaluation entry, a feed beat, a history row) carries the table G marker. */
export function executionOutcomeUnconfirmed(record) {
  return record?.executionOutcome === EXECUTION_OUTCOME_UNKNOWN;
}

/**
 * The action the risk loop and the R11 pass stamp on a beat for an exit that
 * threw (agent-evaluate.js). Since Part D, such a beat whose outcome could not
 * be confirmed carries `message: null` — no line either way — and every other
 * one carries its failure line; a source row in decisionRecord.test.js pins
 * both writers.
 */
export const RISK_SWAP_FAILED_ACTION = 'risk_swap_failed';

const hasLine = (beat) => typeof beat?.message === 'string' && beat.message.trim() !== '';

/**
 * A feed beat whose outcome could not be confirmed: it carries the marker —
 * or, on a copy of the feed that dropped the marker, it has the shape only the
 * marker's two message-less writers produce: a `risk_swap_failed` beat with no
 * line. (The public projection, api/_utils/tournamentBattleView.js
 * PUBLIC_STATUSFEED, dropped it until enforce readiness added the key; the
 * shape rule stays for any copy that still does.)
 *
 * NO LINE SURFACE RENDERS SUCH A BEAT (review ER4-3). The risk loop's and the
 * R11 pass's carry no line at all (they were an empty card, or their raw
 * action); the model route's two — its status line and the guardrail's own —
 * carry words written BEFORE the swap ran ("Rotating KO → AMD…", "Forcing exit
 * → AMD."), which the record cannot vouch for. The check's own words stay
 * where the record is labelled: the Why? panel and the tape's check card,
 * under table G's label.
 */
export function feedBeatUnconfirmed(beat) {
  if (!beat || typeof beat !== 'object') return false;
  return executionOutcomeUnconfirmed(beat) || (beat.action === RISK_SWAP_FAILED_ACTION && !hasLine(beat));
}
