// src/constants/hypothesisRecords.js
//
// Pilot P1a — THE HYPOTHESIS VOCABULARY, one source for the server and the
// Forge (pilot spec docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md
// §2.2, §2.5; companion docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md §6).
// The server's version model (api/_utils/hypothesisRecords/model.js) and
// review clock (horizon.js) import from here, and so does the Forge "Idea"
// panel, so the actions the panel offers are the transitions the routes
// accept — one table, never two copies (BUILD_RULES §9 display agreement).
//
// PURE and dependency-free: no imports at all, so it is Node-clean for the
// api/ importers under the BUILD_RULES §4 import rule (their test imports are
// the dependency-surface guard).

export const HYPOTHESIS_STATUSES = Object.freeze([
  'draft', 'researched', 'ready', 'waiting_for_evidence', 'activated',
  'invalidated', 'review_due', 'retired', 'rejected', 'cancelled',
]);
/** No transition leaves these (spec §2.5: retired, and the pre-deploy terminals). */
export const TERMINAL_STATUSES = Object.freeze(['retired', 'rejected', 'cancelled']);
/** Statuses a version can hold before its first deploy (spec §2.5 "any pre-deploy"). */
export const PRE_DEPLOY_STATUSES = Object.freeze(['draft', 'researched', 'ready', 'waiting_for_evidence']);

/**
 * Pilot P1b — founder ruling B4 (8 Oct 2026; P1a carry-forward 2, review
 * L2-3): a `review_due` version may be reaffirmed when EVERY newer version
 * holds one of these statuses — the pre-deploy statuses plus the two
 * pre-deploy terminals. Not PRE_DEPLOY_STATUSES: `rejected` and `cancelled`
 * are here, and nothing a deploy ever touched (activated, invalidated,
 * review_due, retired) is.
 */
export const REAFFIRM_SUCCESSOR_STATUSES = Object.freeze(['draft', 'researched', 'waiting_for_evidence', 'ready', 'rejected', 'cancelled']);

/**
 * Pilot P1b — founder ruling B2: the statuses a deploy may CARRY (the newest
 * version holding one of these, from the list's server-written versions).
 */
export const CARRIABLE_STATUSES = Object.freeze(['ready', 'activated']);

export const HORIZON_ENUMS = Object.freeze(['intraday', 'swing', 'positional', 'longterm', 'unspecified']);
export const HORIZON_SOURCES = Object.freeze(['parse', 'theme_default', 'default', 'player']);

/** Window N, in trading sessions after the anchor session (companion §6, blessed slots H1–H4). */
export const HORIZON_WINDOW_SESSIONS = Object.freeze({ intraday: 2, swing: 10, positional: 30, longterm: 60 });

/**
 * The typed reasons P1a writes (spec §2.5 table; reject/cancel carry the typed
 * player reason). The table's `superseded` (reaffirmation) is never written as
 * a stateReason: the due version's state is KEPT (status, reason, clock) and
 * the supersession is carried by its `successorVersion` pointer.
 */
export const STATE_REASONS = Object.freeze({
  dialogueCompleted: 'dialogue_completed',
  playerAuthored: 'player_authored',
  reaffirmed: 'reaffirmed',
  playerReady: 'player_ready',
  awaitingEvidence: 'awaiting_evidence',
  evidenceSupplied: 'evidence_supplied',
  playerRejected: 'player_rejected',
  playerCancelled: 'player_cancelled',
  playerRetired: 'player_retired',
  // Pilot P2 / founder ruling D4 (spec Amendment B): the PLAYER's draft →
  // researched, kept distinct from research done with the agent (the spec's
  // automatic `research_complete`, which no P2 writer produces: no host
  // completes research on a draft's content).
  playerMarkedResearched: 'player_marked_researched',
  horizonElapsed: 'horizon_elapsed',
  battleEnded: 'battle_ended',
  // Pilot P1b: ready → activated at the version's first deploy (spec §2.5,
  // stateSource 'deploy'), written by the battle-creation transaction.
  deployed: 'deployed',
});

const NON_TERMINAL = HYPOTHESIS_STATUSES.filter((s) => !TERMINAL_STATUSES.includes(s));
const fromEach = (statuses, reason) => Object.freeze(Object.fromEntries(statuses.map((s) => [s, reason])));

/**
 * The PLAYER transitions (spec §2.5; the P1a build prompt's list; P2 adds
 * `mark_researched`, founder ruling D4 / spec Amendment B): action → target
 * status and the typed reason per legal prior status. Anything not listed is
 * an illegal transition. `reaffirm` is not here: it creates a version and
 * never changes the due version's status.
 */
export const PLAYER_TRANSITIONS = Object.freeze({
  ready: Object.freeze({ to: 'ready', from: Object.freeze({ researched: STATE_REASONS.playerReady, waiting_for_evidence: STATE_REASONS.evidenceSupplied }) }),
  wait: Object.freeze({ to: 'waiting_for_evidence', from: fromEach(['researched'], STATE_REASONS.awaitingEvidence) }),
  reject: Object.freeze({ to: 'rejected', from: fromEach(['draft', 'researched', 'waiting_for_evidence'], STATE_REASONS.playerRejected) }),
  cancel: Object.freeze({ to: 'cancelled', from: fromEach(PRE_DEPLOY_STATUSES, STATE_REASONS.playerCancelled) }),
  retire: Object.freeze({ to: 'retired', from: fromEach(NON_TERMINAL, STATE_REASONS.playerRetired) }),
  mark_researched: Object.freeze({ to: 'researched', from: fromEach(['draft'], STATE_REASONS.playerMarkedResearched) }),
});
export const PLAYER_ACTIONS = Object.freeze([...Object.keys(PLAYER_TRANSITIONS), 'reaffirm']);
/** Actions that may close a SUPERSEDED version; the rest act on the current version only. */
export const CLOSING_ACTIONS = Object.freeze(['reject', 'cancel', 'retire']);

/**
 * The legal player transition from `status` by `action`, or null.
 * @returns {{ to: string, reason: string } | null}
 */
export function legalTransition(status, action) {
  const t = Object.prototype.hasOwnProperty.call(PLAYER_TRANSITIONS, action) ? PLAYER_TRANSITIONS[action] : null;
  if (!t || typeof status !== 'string' || !Object.prototype.hasOwnProperty.call(t.from, status)) return null;
  return { to: t.to, reason: t.from[status] };
}

/**
 * Pilot P1b — founder ruling B4: may a version in `status` be reaffirmed,
 * given the statuses of EVERY version newer than it (none, for the current
 * version)? The one predicate the reaffirm route and the Forge both use.
 *
 * @param {string} status
 * @param {string[]} newerStatuses  one entry per newer version, in any order
 */
export function reaffirmableGiven(status, newerStatuses) {
  return status === 'review_due' && Array.isArray(newerStatuses)
    && newerStatuses.every((s) => REAFFIRM_SUCCESSOR_STATUSES.includes(s));
}

/**
 * The actions legal from a status — exactly what the Forge offers. `reaffirm`
 * follows founder ruling B4 and is offered only when the caller names the
 * statuses of every newer version (`newerStatuses`; `[]` for the current
 * version): a superseded version without them is offered its closing moves
 * only, never a reaffirmation it cannot prove legal.
 */
export function legalActionsFor(status, { isCurrent = true, newerStatuses = isCurrent ? [] : null } = {}) {
  const out = Object.keys(PLAYER_TRANSITIONS).filter((a) => legalTransition(status, a) && (isCurrent || CLOSING_ACTIONS.includes(a)));
  if (reaffirmableGiven(status, newerStatuses)) out.push('reaffirm');
  return out;
}

/**
 * Pilot P1b — the deploy refusal (founder ruling B2): the typed error the
 * deploy endpoint answers when the equipped idea's newest deployed version is
 * due for review and no version is ready to carry. Its words are table C's
 * due-deploy line, verbatim (MODE_TRUTH_LANGUAGE_TABLES_V1.md §C — the Forge's
 * ideaCopy.js re-exports this one string, and its spec-vs-constants byte test
 * pins it).
 */
export const DEPLOY_REFUSAL_CODE = 'hypothesis_review_due';
export const DUE_DEPLOY_LINE = 'This idea is due for review — reaffirm it first (one tap, same content if you want), and the fresh version deploys.';

/**
 * Pilot P1b — the words a deploy shows when the carried version changed state
 * between the deploy's read and the battle's creation transaction (the race:
 * no battle, no version change, no review row; the deploy fails cleanly and
 * can be retried). Not a table-C line — a failure message, scanned for table E
 * by ideaCopy.test.js.
 */
export const CARRIAGE_RACE_MESSAGE = 'Your idea changed while this battle was being set up, so no battle was created. Check the idea in the Forge, then deploy again.';
