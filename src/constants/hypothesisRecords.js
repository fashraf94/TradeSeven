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
  horizonElapsed: 'horizon_elapsed',
  battleEnded: 'battle_ended',
});

const NON_TERMINAL = HYPOTHESIS_STATUSES.filter((s) => !TERMINAL_STATUSES.includes(s));
const fromEach = (statuses, reason) => Object.freeze(Object.fromEntries(statuses.map((s) => [s, reason])));

/**
 * The PLAYER transitions (spec §2.5; the P1a build prompt's list): action →
 * target status and the typed reason per legal prior status. Anything not
 * listed is an illegal transition. `reaffirm` is not here: it creates a
 * version and never changes the due version's status.
 */
export const PLAYER_TRANSITIONS = Object.freeze({
  ready: Object.freeze({ to: 'ready', from: Object.freeze({ researched: STATE_REASONS.playerReady, waiting_for_evidence: STATE_REASONS.evidenceSupplied }) }),
  wait: Object.freeze({ to: 'waiting_for_evidence', from: fromEach(['researched'], STATE_REASONS.awaitingEvidence) }),
  reject: Object.freeze({ to: 'rejected', from: fromEach(['draft', 'researched', 'waiting_for_evidence'], STATE_REASONS.playerRejected) }),
  cancel: Object.freeze({ to: 'cancelled', from: fromEach(PRE_DEPLOY_STATUSES, STATE_REASONS.playerCancelled) }),
  retire: Object.freeze({ to: 'retired', from: fromEach(NON_TERMINAL, STATE_REASONS.playerRetired) }),
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

/** The actions legal from a status — exactly what the Forge offers. */
export function legalActionsFor(status, { isCurrent = true, hasSuccessor = false } = {}) {
  const out = Object.keys(PLAYER_TRANSITIONS).filter((a) => legalTransition(status, a) && (isCurrent || CLOSING_ACTIONS.includes(a)));
  if (status === 'review_due' && isCurrent && !hasSuccessor) out.push('reaffirm');
  return out;
}
