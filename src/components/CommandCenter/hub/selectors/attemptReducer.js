// src/components/CommandCenter/hub/selectors/attemptReducer.js
//
// Command Center hub, slice S2a — the attempt reducer (spec V1.2 §5.2–§5.4):
// begin, the service result, reconciliation, the ceremony's phase reports,
// dismissal, retry, cooldown, an account change, a runtime flag disable and
// the root's unmount, over one in-memory record. S2b's provider (above every
// screen, spec §2) dispatches these; S2a defines and tests them.
//
// Pure. Every time, id, token and flag arrives in the action; nothing here
// reads a clock, makes an id, stores anything durable or writes anything. The
// server stays the authority: a refusal here only means the client will not
// ask.
//
// State:
//   { authUid, authEpoch, attemptEpoch, attempt, hold, cooldowns,
//     flagDisabled, revoked }
//   attempt   the provider record of spec §5.2 (makeAttempt below) or null
//   hold      { controlId, holdToken, holdEpoch, phase } or null. S2a never
//             claims or commits one (C4 is R2's and S2b's, ruling R-S2A-5). It
//             admits a request from a hold only once that hold is committed
//             (locked), and releases the committed hold with the attempt it
//             started: dismissal, a Retry, an orphaned outcome
//   cooldowns { [ownerUid]: { [targetAgentId]: cooldownUntil } } — keyed by the
//             captured owner and the resolved target, kept across dismissal,
//             never read for another owner
//
// Epochs: `authEpoch` increments on every authentication change, A → B → A
// included; `attemptEpoch` on every accepted attempt and every invalidation.
// A callback is current only when its attempt id and epoch match the record
// AND the record's captured identity still matches (ownership.js isCurrent).
// A rejected or stale action returns the SAME state object, so a caller can
// tell (`next === prev`).
//
// Slice S2b (rulings R-S2b-2, R-S2b-3): the provider's auth epoch IS the
// identity source's (src/services/authIdentity.js), so reader results tagged
// with that epoch compare against the attempt's: `initialAttemptState` and
// `authChanged` take it, and the epoch never goes down. The hold record gains
// its three actions — claimed (charging), committed (locked) and released — and
// a hold that admits a request is stamped with that request's attempt id, so a
// release that arrives after it cannot drop the hold the attempt now owns.

import {
  ATTEMPT_PHASES, CEREMONY_PHASES, ERROR_TONES, HOLD_PHASES, RECONCILIATION, RESOLUTION_KINDS,
  realId, translateServiceResult,
} from './attemptVocabulary';
import { captureIdentity, isCurrent, signedIn, validEpoch, validUid } from './ownership';

/**
 * The server's per-agent deploy cooldown: decide.js answers 429 inside 120 s of
 * the target's recorded lastDeployedAt, and the shipped ceremony counts down the
 * same 120 s (DeployCeremony.jsx DEPLOY_LOCK_MS). A tripwire row pins all three.
 */
export const DEPLOY_COOLDOWN_MS = 120000;

export const ATTEMPT_ACTION_TYPES = Object.freeze({
  BEGIN: 'begin',
  TARGET_RESOLVED: 'targetResolved',
  SERVICE_RESULT: 'serviceResult',
  RECONCILIATION_PENDING: 'reconciliationPending',
  RECONCILIATION_RESULT: 'reconciliationResult',
  CEREMONY_PHASE: 'ceremonyPhase',
  DISMISS: 'dismiss',
  RETRY: 'retry',
  COOLDOWN_EVIDENCE: 'cooldownEvidence',
  AUTH_CHANGED: 'authChanged',
  ORPHAN_CLEANED: 'orphanCleaned',
  FLAG_DISABLED: 'flagDisabled',
  UNMOUNT: 'unmount',
  // S2b (ruling R-S2b-3)
  HOLD_CLAIMED: 'holdClaimed',
  HOLD_COMMITTED: 'holdCommitted',
  HOLD_RELEASED: 'holdReleased',
});
const T = ATTEMPT_ACTION_TYPES;

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const freeze = Object.freeze;

/**
 * The reducer's starting state for a provider mounted with `uid` signed in (or null), at the identity
 * source's `authEpoch` (S2b; 0 when not given or not an epoch).
 */
export function initialAttemptState({ uid = null, authEpoch = 0 } = {}) {
  return freeze({
    authUid: validUid(uid) ? uid : null,
    authEpoch: validEpoch(authEpoch) ? authEpoch : 0,
    attemptEpoch: 0,
    attempt: null,
    hold: null,
    cooldowns: freeze({}),
    flagDisabled: false,
    revoked: false,
  });
}

/**
 * `cooldownUntil` from its evidence (spec §5.4): the latest of a server
 * Retry-After instant, if any, and a valid recorded target lastDeployedAt plus
 * 120 s. No evidence → null: no countdown is ever fabricated, and the POST's
 * issue time is not the server's cooldown. Both are ms since the epoch,
 * converted by the caller.
 */
export function cooldownUntilFrom({ lastDeployedAtMs, retryAfterUntil } = {}) {
  const fromRecord = finite(lastDeployedAtMs) ? lastDeployedAtMs + DEPLOY_COOLDOWN_MS : null;
  const fromServer = finite(retryAfterUntil) ? retryAfterUntil : null;
  if (fromRecord == null) return fromServer;
  if (fromServer == null) return fromRecord;
  return Math.max(fromRecord, fromServer);
}

/** The cooldown that applies to an owner and target: the selector's `cooldown` input. */
export function cooldownFor(state, ownerUid, targetAgentId) {
  const until = state?.cooldowns?.[ownerUid]?.[targetAgentId];
  return freeze({ ownerUid: ownerUid ?? null, targetAgentId: targetAgentId ?? null, cooldownUntil: finite(until) ? until : null });
}

const currentAuth = (state) => ({ signedIn: state.authUid != null, uid: state.authUid, authEpoch: state.authEpoch });

/** An action's own auth payload is the reducer's current identity. */
const authMatches = (state, auth) => signedIn(auth) && auth.uid === state.authUid && auth.authEpoch === state.authEpoch;

/** The action names this record, and the record still belongs to the current identity and epochs. */
function current(state, action) {
  const a = state.attempt;
  if (!a || action.attemptId !== a.attemptId || action.attemptEpoch !== a.attemptEpoch) return false;
  return isCurrent({ capturedUid: a.capturedUid, authEpoch: a.authEpoch, attemptEpoch: a.attemptEpoch }, currentAuth(state), state.attemptEpoch);
}

const activeHold = (hold) => Boolean(hold) && (hold.phase === HOLD_PHASES.CHARGING || hold.phase === HOLD_PHASES.LOCKED);
/**
 * The caller's own hold, ready to start its request: its control and token, and
 * COMMITTED (locked) — spec §5.5: commitment, not charging, is the boundary
 * (S2a review A3-6). The slot holds one hold, and while an attempt stands no
 * other can commit, so a locked hold belongs to the request it admits.
 */
const ownCommittedHold = (state, action) => Boolean(state.hold) && state.hold.phase === HOLD_PHASES.LOCKED
  && state.hold.controlId === action.controlId && state.hold.holdToken === action.holdToken;
/** A hold the request does not own: a tap or a second control cannot bypass it (spec §5.5). */
const foreignHold = (state, action) => activeHold(state.hold) && !ownCommittedHold(state, action);

const unacknowledged = (attempt) => Boolean(attempt) && attempt.phase !== ATTEMPT_PHASES.IDLE;

const cooling = (until, now) => finite(until) && !(finite(now) && now >= until);

/** A new provider record (spec §5.2), in phase submitting. */
function makeAttempt(state, action, targetAgentId) {
  const attemptEpoch = state.attemptEpoch + 1;
  const captured = captureIdentity(action.auth, targetAgentId, attemptEpoch);
  return freeze({
    attemptId: action.attemptId,
    capturedUid: captured.capturedUid,
    authEpoch: captured.authEpoch,
    attemptEpoch,
    targetAgentId: captured.targetAgentId,
    startedAt: finite(action.startedAt) ? action.startedAt : null,
    phase: ATTEMPT_PHASES.SUBMITTING,
    result: null,
    ceremonyPhase: null,
    errorTone: null,
    acknowledgedAt: null,
    cooldownUntil: cooldownFor(state, captured.capturedUid, captured.targetAgentId).cooldownUntil,
    reconciliationStatus: RECONCILIATION.NOT_CHECKED,
    resolution: null,
  });
}

const validNewId = (state, id) => typeof id === 'string' && id.length > 0 && id !== state.attempt?.attemptId;
const validTarget = (id) => typeof id === 'string' && id.length > 0;

const withAttempt = (state, patch) => freeze({ ...state, attempt: freeze({ ...state.attempt, ...patch }) });

/** A committed hold belongs to the attempt it started; that attempt's end releases it (spec §5.4). */
const releaseHold = (hold) => (hold && hold.phase === HOLD_PHASES.LOCKED ? null : hold);

function begin(state, action) {
  if (!authMatches(state, action.auth) || !validNewId(state, action.attemptId) || !validTarget(action.targetAgentId)) return state;
  const own = ownCommittedHold(state, action);
  // A runtime disable refuses new attempts; a request already at commitment
  // (its hold locked) still goes and keeps its record (spec §4; S2a review A3-7).
  if (state.flagDisabled && !own) return state;
  // An unacknowledged attempt — submitting, a terminal, an uncertain one whose
  // overlay was dismissed, an orphan not yet cleaned — keeps the guard.
  if (unacknowledged(state.attempt) || foreignHold(state, action)) return state;
  const attempt = makeAttempt(state, action, action.targetAgentId);
  // S2b: the committed hold now belongs to this request (holdReleased below cannot drop it).
  const hold = own ? freeze({ ...state.hold, attemptId: attempt.attemptId }) : state.hold;
  return freeze({ ...state, attemptEpoch: attempt.attemptEpoch, attempt, hold });
}

function targetResolved(state, action) {
  if (!current(state, action) || state.attempt.phase !== ATTEMPT_PHASES.SUBMITTING || !validTarget(action.targetAgentId)) return state;
  if (state.attempt.targetAgentId === action.targetAgentId) return state;
  return withAttempt(state, {
    targetAgentId: action.targetAgentId,
    cooldownUntil: cooldownFor(state, state.attempt.capturedUid, action.targetAgentId).cooldownUntil,
  });
}

function serviceResult(state, action) {
  // Ignored unless current, and only once: a second result for the same request is a late loser.
  if (!current(state, action) || state.attempt.phase !== ATTEMPT_PHASES.SUBMITTING) return state;
  const t = translateServiceResult(action.result);
  // The record keeps its captured owner: nothing here stamps the current uid onto a response.
  const next = withAttempt(state, {
    phase: t.phase,
    result: t.detail,
    ceremonyPhase: t.ceremony.phase,
    errorTone: t.ceremony.errorTone,
  });
  // A typed `orphaned` outcome is an invalidation like any other: the epoch moves,
  // so no later callback of this request is current, and its hold goes with it
  // (spec §5.2; S2a review A2-3, A3-5).
  if (t.phase !== ATTEMPT_PHASES.ORPHANED) return next;
  return freeze({ ...next, attemptEpoch: state.attemptEpoch + 1, hold: releaseHold(state.hold) });
}

function reconciliationPending(state, action) {
  if (!current(state, action) || state.attempt.phase !== ATTEMPT_PHASES.UNCERTAIN) return state;
  if (state.attempt.reconciliationStatus === RECONCILIATION.PENDING) return state;
  return withAttempt(state, { reconciliationStatus: RECONCILIATION.PENDING });
}

function reconciliationResult(state, action) {
  const a = state.attempt;
  if (!current(state, action) || a.phase !== ATTEMPT_PHASES.UNCERTAIN || a.reconciliationStatus !== RECONCILIATION.PENDING) return state;
  if (action.status === RECONCILIATION.CLEAR) return withAttempt(state, { reconciliationStatus: RECONCILIATION.CLEAR });
  if (action.status === RECONCILIATION.ERROR) return withAttempt(state, { reconciliationStatus: RECONCILIATION.ERROR });
  if (action.status !== RECONCILIATION.FOUND) return state;
  const id = realId(action.battle?.id);
  // A found battle must be the captured owner's real document; a missing or
  // foreign one is unavailable, never a creation (spec §5.2), so the attempt stays uncertain.
  if (!id || action.battle.ownerId !== a.capturedUid) return withAttempt(state, { reconciliationStatus: RECONCILIATION.ERROR });
  if (action.admitted === true) {
    // Admitted by the preserved ceremony recovery gates: provider `created`,
    // resolution recovered; the original service evidence stays as it was.
    return withAttempt(state, {
      phase: ATTEMPT_PHASES.CREATED,
      reconciliationStatus: RECONCILIATION.FOUND,
      resolution: freeze({ kind: RESOLUTION_KINDS.RECOVERED, battleId: id, evidence: a.result }),
    });
  }
  return withAttempt(state, {
    phase: ATTEMPT_PHASES.EXISTING,
    reconciliationStatus: RECONCILIATION.FOUND,
    resolution: freeze({ kind: RESOLUTION_KINDS.FOUND_EXISTING, battleId: id, evidence: a.result }),
  });
}

const CEREMONY_SET = new Set(Object.values(CEREMONY_PHASES));
const TONE_SET = new Set(Object.values(ERROR_TONES));

function ceremonyPhase(state, action) {
  // Carries the attempt's identity: a stale notification cannot change a later attempt.
  if (!current(state, action) || !unacknowledged(state.attempt) || state.attempt.phase === ATTEMPT_PHASES.ORPHANED) return state;
  if (!CEREMONY_SET.has(action.phase)) return state;
  const errorTone = TONE_SET.has(action.errorTone) ? action.errorTone : null;
  if (state.attempt.ceremonyPhase === action.phase && state.attempt.errorTone === errorTone) return state;
  return withAttempt(state, { ceremonyPhase: action.phase, errorTone });
}

function dismiss(state, action) {
  if (!current(state, action)) return state;
  const a = state.attempt;
  const hold = releaseHold(state.hold);
  const acknowledge = () => freeze({
    ...state,
    hold,
    attempt: freeze({ ...a, phase: ATTEMPT_PHASES.IDLE, ceremonyPhase: CEREMONY_PHASES.CLOSED, acknowledgedAt: finite(action.at) ? action.at : null }),
  });
  switch (a.phase) {
    case ATTEMPT_PHASES.CREATED:
    case ATTEMPT_PHASES.EXISTING:
    case ATTEMPT_PHASES.REFUSED:
      // Acknowledged and idle; the owner + target cooldown stays in `cooldowns`.
      return acknowledge();
    case ATTEMPT_PHASES.UNCERTAIN:
      // Only an owned clear result lets acknowledgment through; otherwise the
      // overlay closes and the guard stays until reconciliation resolves.
      if (a.reconciliationStatus === RECONCILIATION.CLEAR) return acknowledge();
      if (a.ceremonyPhase === CEREMONY_PHASES.CLOSED && hold === state.hold) return state;
      return freeze({ ...state, hold, attempt: freeze({ ...a, ceremonyPhase: CEREMONY_PHASES.CLOSED }) });
    default:
      return state;
  }
}

function retry(state, action) {
  const prior = state.attempt;
  if (state.flagDisabled || !prior || !authMatches(state, action.auth)) return state;
  if (!current(state, { attemptId: action.priorAttemptId, attemptEpoch: action.priorAttemptEpoch })) return state;
  const fromRefused = prior.phase === ATTEMPT_PHASES.REFUSED;
  const fromClear = prior.phase === ATTEMPT_PHASES.UNCERTAIN && prior.reconciliationStatus === RECONCILIATION.CLEAR;
  if (!fromRefused && !fromClear) return state;
  // Waits for the owner + target cooldown; without a clock it cannot show the bound passed.
  if (cooling(cooldownFor(state, prior.capturedUid, prior.targetAgentId).cooldownUntil, action.now)) return state;
  // A Retry is a tap: it needs no token. The terminal's own committed (locked)
  // hold does not stand in its way and is released with the terminal it
  // replaces; another control's charging hold does (S2a review A3-1).
  if (!validNewId(state, action.attemptId) || (state.hold && state.hold.phase === HOLD_PHASES.CHARGING)) return state;
  // Atomically replaces the prior terminal; one new request, one epoch.
  const attempt = makeAttempt(state, action, prior.targetAgentId);
  return freeze({ ...state, attemptEpoch: attempt.attemptEpoch, attempt, hold: releaseHold(state.hold) });
}

function cooldownEvidence(state, action) {
  if (!validUid(action.ownerUid) || action.ownerUid !== state.authUid || action.authEpoch !== state.authEpoch) return state;
  if (!validTarget(action.targetAgentId)) return state;
  const until = cooldownUntilFrom(action);
  if (until == null) return state;
  const known = cooldownFor(state, action.ownerUid, action.targetAgentId).cooldownUntil;
  // A known bound is never lowered (spec §5.4: dismissal never clears one).
  const next = known == null ? until : Math.max(known, until);
  if (next === known) return state;
  const owner = freeze({ ...(state.cooldowns[action.ownerUid] || {}), [action.targetAgentId]: next });
  const cooldowns = freeze({ ...state.cooldowns, [action.ownerUid]: owner });
  const a = state.attempt;
  // Only the current owner's live record at this auth epoch carries the bound; an orphan is left alone (S2a review A2-6).
  const attempt = a && a.phase !== ATTEMPT_PHASES.ORPHANED && a.capturedUid === action.ownerUid
    && a.authEpoch === action.authEpoch && a.targetAgentId === action.targetAgentId
    ? freeze({ ...a, cooldownUntil: next }) : a;
  return freeze({ ...state, cooldowns, attempt });
}

/** An invalidation: the record, if unresolved, is orphaned for its effects' cleanup; an acknowledged one goes. */
const orphan = (attempt) => (unacknowledged(attempt)
  ? freeze({ ...attempt, phase: ATTEMPT_PHASES.ORPHANED, ceremonyPhase: CEREMONY_PHASES.CLOSED })
  : null);

function authChanged(state, action) {
  // Every identity change, A → B → A included, is a new auth epoch and an invalidation.
  // S2b: the identity source's epoch, when given; one at or below the current is a stale report.
  const given = Object.hasOwn(action, 'authEpoch') ? action.authEpoch : null;
  if (given !== null && !(validEpoch(given) && given > state.authEpoch)) return state;
  return freeze({
    ...state,
    authUid: validUid(action.uid) ? action.uid : null,
    authEpoch: given ?? state.authEpoch + 1,
    attemptEpoch: state.attemptEpoch + 1,
    attempt: orphan(state.attempt),
    hold: null,
  });
}

function orphanCleaned(state, action) {
  const a = state.attempt;
  // Tagged with the orphan's id AND epoch: a late cleanup of an earlier orphan
  // that reused the id cannot remove a later one (S2a review A2-4, A3-10).
  if (!a || a.phase !== ATTEMPT_PHASES.ORPHANED || a.attemptId !== action.attemptId || a.attemptEpoch !== action.attemptEpoch) return state;
  return freeze({ ...state, attempt: null });
}

function flagDisabled(state) {
  // Cancels an uncommitted hold and refuses new attempts; a committed hold and a
  // request already issued keep their record through resolution (spec §4).
  const hold = state.hold && state.hold.phase === HOLD_PHASES.CHARGING ? null : state.hold;
  if (state.flagDisabled && hold === state.hold) return state;
  return freeze({ ...state, flagDisabled: true, hold });
}

function unmount(state) {
  return freeze({ ...state, revoked: true, attemptEpoch: state.attemptEpoch + 1, attempt: orphan(state.attempt), hold: null });
}

const validName = (v) => typeof v === 'string' && v.length > 0;

/**
 * S2b (ruling R-S2b-3): a control's claim, admitted by the provider from canStart before the
 * slot granted it (spec §5.5). The record is the selector's `hold` input: one at a time, none
 * while an attempt stands, none with the flag disabled, none for another identity.
 */
function holdClaimed(state, action) {
  if (state.flagDisabled || !authMatches(state, action.auth)) return state;
  if (!validName(action.controlId) || !validName(action.holdToken) || !validEpoch(action.holdEpoch)) return state;
  if (activeHold(state.hold) || unacknowledged(state.attempt)) return state;
  return freeze({
    ...state,
    hold: freeze({ controlId: action.controlId, holdToken: action.holdToken, holdEpoch: action.holdEpoch, phase: HOLD_PHASES.CHARGING }),
  });
}

/** The threshold's commitment of the charging hold whose token this is (after canCommit and the slot agreed). */
function holdCommitted(state, action) {
  const h = state.hold;
  if (state.flagDisabled || !authMatches(state, action.auth)) return state;
  if (!h || h.phase !== HOLD_PHASES.CHARGING || h.holdToken !== action.holdToken) return state;
  return freeze({ ...state, hold: freeze({ ...h, phase: HOLD_PHASES.LOCKED }) });
}

/**
 * A hold given back: a cancelled charge, or a committed one whose beat deployed nothing. A hold
 * that admitted a request belongs to that attempt until the attempt ends (begin stamps it).
 */
function holdReleased(state, action) {
  const h = state.hold;
  if (!h || h.holdToken !== action.holdToken || validName(h.attemptId)) return state;
  return freeze({ ...state, hold: null });
}

const HANDLERS = {
  [T.BEGIN]: begin,
  [T.TARGET_RESOLVED]: targetResolved,
  [T.SERVICE_RESULT]: serviceResult,
  [T.RECONCILIATION_PENDING]: reconciliationPending,
  [T.RECONCILIATION_RESULT]: reconciliationResult,
  [T.CEREMONY_PHASE]: ceremonyPhase,
  [T.DISMISS]: dismiss,
  [T.RETRY]: retry,
  [T.COOLDOWN_EVIDENCE]: cooldownEvidence,
  [T.AUTH_CHANGED]: authChanged,
  [T.ORPHAN_CLEANED]: orphanCleaned,
  [T.FLAG_DISABLED]: flagDisabled,
  [T.UNMOUNT]: unmount,
  [T.HOLD_CLAIMED]: holdClaimed,
  [T.HOLD_COMMITTED]: holdCommitted,
  [T.HOLD_RELEASED]: holdReleased,
};

/**
 * @param {object} state  initialAttemptState() or a previous result
 * @param {{ type: string }} action  one of ATTEMPT_ACTION_TYPES, payload as in hub/hubModel.js
 * @returns {object} the next state, or the same object when the action is refused or stale
 */
export function attemptReducer(state, action) {
  if (!state || !action || typeof action !== 'object') return state;
  // After the root unmounts no promise may revive anything (spec §5.4).
  if (state.revoked) return state;
  const handler = Object.hasOwn(HANDLERS, action.type) ? HANDLERS[action.type] : null;
  return handler ? handler(state, action) : state;
}
