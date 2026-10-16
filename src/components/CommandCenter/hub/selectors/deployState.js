// src/components/CommandCenter/hub/selectors/deployState.js
//
// Command Center hub, slice S2a — deployment eligibility and display
// precedence (spec V1.2 §3.1, correction C1). One pure selector,
// `deriveHubDeployState`, decides what the strip, the Deploy card, the
// first-deployment next action, the keyboard path, the tap path and the
// provider's admission all show and allow. The same table applies to all of
// them (§3.1), so no surface can disagree with another.
//
// The retained owned game's gate is computed FIRST and independently of the
// poll's current status, with the shipped `deriveDeployGate` on the retained
// successful list and the current concurrency flag — never a capacity
// constant, never `agent.activeBattleId`. Concurrency off is the helper's
// legacy any-live gate. Then the §3.1 table applies in its order; the first
// matching row wins:
//
//   1  signed out (resolved; an unresolved identity checks) signed_out
//   2  actual auth change not reset, or resolved results    account_transition
//      positively belonging to another owner or epoch
//   3  this owner's unacknowledged attempt, owned hold, or  the attempt's own words (§5.2)
//      unresolved uncertain attempt (overlay dismissed too)
//   4  an applicable owner + target cooldown remains        cooldown
//   5  agent loading / error / resolved absent              loading_agent / agent_error / no_agent
//   6  the retained owned list blocks (stale included)      blocked
//   7  no successful owned poll, current status error       eligibility_error
//   8  no successful owned poll otherwise (initial load)    checking
//   9  retained list clear, latest poll failed              ready_stale
//  10  retained list clear, a refresh pending               ready (refreshing)
//  11  latest poll ready, list clear                        ready
//
// `canStart` is true only on rows 9–11 and denies every competing control:
// an open sheet, Forge or ceremony (`modalOpen`) denies it without changing
// the words (§3.1 has no modal row). `canCommit(holdToken, inputs)` is the
// synchronous recheck the holding control makes at its threshold: it exempts
// only that hold from row 3 and rechecks everything else.
//
// A reader's `ownerUid: null` means no result has resolved, never an account
// change. Times are milliseconds since the epoch, given as inputs: nothing
// here reads a clock.

import { deriveDeployGate } from '../../../../utils/commandCenterLiveBattles';
import { TRAINING_CLONE_ID_PREFIX } from '../../../../constants/leagueTournament';
import { ATTEMPT_ACTIONS, ATTEMPT_PHASES, HOLD_PHASES, displayForAttempt } from './attemptVocabulary';
import { signedIn, validEpoch } from './ownership';

/** The eligibility display states of spec §3.1 (the attempt's own words are attemptVocabulary's ATTEMPT_DISPLAY). */
export const ELIGIBILITY_STATES = Object.freeze({
  SIGNED_OUT: 'signed_out',
  ACCOUNT_TRANSITION: 'account_transition',
  COOLDOWN: 'cooldown',
  LOADING_AGENT: 'loading_agent',
  AGENT_ERROR: 'agent_error',
  NO_AGENT: 'no_agent',
  BLOCKED: 'blocked',
  ELIGIBILITY_ERROR: 'eligibility_error',
  CHECKING: 'checking',
  READY_STALE: 'ready_stale',
  READY: 'ready',
});

/** Which reader a Retry re-runs. */
export const RETRY_ACTIONS = Object.freeze({ AGENT: 'agent', POLL: 'poll' });

/** Reader statuses (spec §3). */
const LOADING = 'loading';
const READY = 'ready';
const ERROR = 'error';

const isTrainingClone = (battle) => typeof battle?.agentId === 'string' && battle.agentId.startsWith(TRAINING_CLONE_ID_PREFIX);

/**
 * The owner's live battles as the gate must see them: stored `ownerId` equal to
 * the captured uid (never a restamped one), training clones dropped by the
 * existing prefix rule (the active poll's own filter), casual-clone games kept.
 * Voided-group battles are dropped upstream by the poll (excludeVoidedGroupBattles).
 */
export function ownedLiveBattles(liveBattles, uid) {
  if (!Array.isArray(liveBattles)) return [];
  return liveBattles.filter((b) => b && typeof b === 'object' && b.ownerId === uid && !isTrainingClone(b));
}

/** A reader result that has resolved for someone (ownerUid set). */
const resolved = (reader) => Boolean(reader) && reader.ownerUid != null;
/** A resolved reader result that belongs to the current identity and epoch. */
const ownedBy = (reader, auth) => resolved(reader) && reader.ownerUid === auth.uid && reader.ownerEpoch === auth.authEpoch;
/** Resolved metadata that positively belongs to another owner or another epoch (A → B → A included). */
const foreign = (reader, auth) => resolved(reader) && !ownedBy(reader, auth);

const finite = (n) => typeof n === 'number' && Number.isFinite(n);

/** An attempt still on screen: anything but idle (acknowledged) and absent. */
const liveAttempt = (attempt) => Boolean(attempt) && typeof attempt === 'object' && attempt.phase !== ATTEMPT_PHASES.IDLE;
/** An attempt from another identity or epoch that the reducer has not reset yet, or one it has orphaned. */
const staleAttempt = (attempt, auth) => liveAttempt(attempt)
  && (attempt.phase === ATTEMPT_PHASES.ORPHANED || attempt.capturedUid !== auth.uid || attempt.authEpoch !== auth.authEpoch);

const ownedHold = (hold) => Boolean(hold) && typeof hold === 'object'
  && (hold.phase === HOLD_PHASES.CHARGING || hold.phase === HOLD_PHASES.LOCKED);

const state = (displayState, canStart, rest = {}) => Object.freeze({
  displayState,
  canStart,
  gateBlocked: null,
  freshness: Object.freeze({ asOf: null, stale: false, refreshing: false }),
  retryAction: null,
  reason: null,
  action: null,
  recovered: false,
  battleId: null,
  cooldownUntil: null,
  holdControlId: null,
  ...rest,
});

/** The retained owned list's gate, computed whatever the poll's current status (§3.1). */
function retainedGate(poll, auth, concurrencyEnabled) {
  if (!ownedBy(poll, auth) || !Array.isArray(poll.liveBattles)) return null;
  const owned = ownedLiveBattles(poll.liveBattles, auth.uid);
  const gate = deriveDeployGate({ liveBattles: owned, agent: null, concurrencyEnabled: concurrencyEnabled === true });
  return { owned, blocked: gate.deployBlockedByLive, reason: gate.deployBlockReason };
}

function freshnessOf(poll, gate) {
  if (!gate) return Object.freeze({ asOf: null, stale: false, refreshing: false });
  const asOf = finite(poll.lastSuccessfulAt) ? poll.lastSuccessfulAt : null;
  const stale = poll.status === ERROR;
  return Object.freeze({ asOf, stale, refreshing: !stale && (poll.status === LOADING || poll.refreshing === true) });
}

/**
 * The deploy state every surface shows and admits by (spec §3.1).
 *
 * @param {object} inputs                the contract table in hub/hubModel.js
 * @returns {{
 *   displayState: string,               a §3.1 state or a §5.2 attempt display word
 *   canStart: boolean,                  may a control start a deployment now
 *   gateBlocked: boolean|null,          the retained owned list's gate; null with no successful owned poll
 *   freshness: { asOf: number|null, stale: boolean, refreshing: boolean },
 *   retryAction: 'agent'|'poll'|null,   the reader a Retry re-runs
 *   reason: string|null,                the gate's reason when blocked; the server's words when failed
 *   action: string|null,                the attempt's one action (enterBattle, openGame, checkDeployment, retry, openForgeReview)
 *   recovered: boolean,                 a recovered confirmation ("Battle confirmed"), not an explicit one ("Deployed")
 *   battleId: string|null,              the real server id an attempt names
 *   cooldownUntil: number|null,         the next permitted deploy, when cooling down
 *   holdControlId: string|null,         the control holding, when one is
 * }}
 */
export function deriveHubDeployState(inputs) {
  const {
    auth, agent, poll, completed, attempt, hold, cooldown, now, concurrencyEnabled, modalOpen,
  } = inputs || {};

  // 1 — signed out: a RESOLVED signed-out identity. An identity that has not
  // resolved (or is malformed) is not evidence of signing out (spec §3: loading
  // is never resolved absence), so it checks, admitting nothing.
  if (auth && auth.signedIn === false) return state(ELIGIBILITY_STATES.SIGNED_OUT, false);
  if (!signedIn(auth)) return state(ELIGIBILITY_STATES.CHECKING, false);

  // The retained gate, first and independently of the poll's status.
  const gate = retainedGate(poll, auth, concurrencyEnabled);
  const gated = { gateBlocked: gate ? gate.blocked : null, freshness: freshnessOf(poll, gate) };

  // 2 — an actual auth change not reset yet, or resolved metadata of another owner or epoch.
  if (staleAttempt(attempt, auth) || foreign(agent, auth) || foreign(poll, auth) || foreign(completed, auth)) {
    return state(ELIGIBILITY_STATES.ACCOUNT_TRANSITION, false, { gateBlocked: null });
  }

  // 3 — this owner's attempt (submitting, a terminal not yet acknowledged, or an
  // unresolved uncertain one whose overlay was dismissed): its own words, and a
  // newly seen live game never erases them.
  const shown = liveAttempt(attempt) ? displayForAttempt(attempt) : null;
  // A record in a phase the vocabulary does not know (a display word stored by
  // mistake, say) shows nothing it could be wrong about and admits nothing.
  if (liveAttempt(attempt) && !shown) return state(ELIGIBILITY_STATES.CHECKING, false, gated);
  if (shown) {
    return state(shown.displayState, false, {
      ...gated,
      reason: shown.line ?? null,
      action: shown.action,
      recovered: shown.recovered === true,
      battleId: shown.battleId ?? null,
    });
  }
  // ...or this owner's hold: it can only have been claimed from a ready state, so
  // the words stay ready; the holding control shows its own charging / Locked in
  // (ruling R-S2A-5); no competing control may start.
  if (ownedHold(hold)) {
    return state(ELIGIBILITY_STATES.READY, false, { ...gated, holdControlId: typeof hold.controlId === 'string' ? hold.controlId : null });
  }

  // 4 — an applicable owner + target cooldown. Without a clock the bound cannot be
  // shown to have passed, so it holds (fail closed).
  const until = cooldown && (cooldown.ownerUid == null || cooldown.ownerUid === auth.uid) ? cooldown.cooldownUntil : null;
  if (finite(until) && !(finite(now) && now >= until)) {
    return state(ELIGIBILITY_STATES.COOLDOWN, false, { ...gated, cooldownUntil: until });
  }

  // 5 — the agent: loading, error with Retry, or resolved absent. A ready result
  // that names no owner has not resolved for anyone; an unknown status is loading.
  if (!agent || agent.status === LOADING || (agent.status === READY && !ownedBy(agent, auth))
    || (agent.status !== READY && agent.status !== ERROR)) {
    return state(ELIGIBILITY_STATES.LOADING_AGENT, false, gated);
  }
  if (agent.status === ERROR) return state(ELIGIBILITY_STATES.AGENT_ERROR, false, { ...gated, retryAction: RETRY_ACTIONS.AGENT });
  if (!agent.agent) return state(ELIGIBILITY_STATES.NO_AGENT, false, gated);

  // 6 — the retained owned list blocks, stale or not (a stale active BaggerBomb blocks).
  if (gate && gate.blocked) {
    return state(ELIGIBILITY_STATES.BLOCKED, false, {
      ...gated,
      reason: gate.reason,
      retryAction: gated.freshness.stale ? RETRY_ACTIONS.POLL : null,
    });
  }

  // 7, 8 — no successful owned poll: the first failure is an error with Retry; anything else checks.
  if (!gate) {
    if (poll && poll.status === ERROR) return state(ELIGIBILITY_STATES.ELIGIBILITY_ERROR, false, { ...gated, retryAction: RETRY_ACTIONS.POLL });
    return state(ELIGIBILITY_STATES.CHECKING, false, gated);
  }

  // 9–11 — the retained list does not block. The server stays the authority.
  const open = modalOpen !== true;
  if (poll.status === ERROR) return state(ELIGIBILITY_STATES.READY_STALE, open, { ...gated, retryAction: RETRY_ACTIONS.POLL });
  if (poll.status === LOADING || poll.status === READY) return state(ELIGIBILITY_STATES.READY, open, gated);
  // A status this table does not know cannot start anything.
  return state(ELIGIBILITY_STATES.CHECKING, false, gated);
}

/**
 * The holding control's synchronous recheck at its threshold (spec §3.1, §5.5).
 * Only the hold whose token this is, still charging, is exempt from row 3;
 * every other row is checked again: auth and epoch, any attempt (an unresolved
 * reconciliation included), cooldown, the agent, poll ownership, the retained
 * gate and an open modal. A token is opaque here: S2a claims none.
 */
export function canCommit(holdToken, inputs) {
  const hold = inputs?.hold;
  if (holdToken == null || !hold || typeof hold !== 'object') return false;
  if (hold.holdToken !== holdToken || hold.phase !== HOLD_PHASES.CHARGING) return false;
  if (hold.holdEpoch != null && !validEpoch(hold.holdEpoch)) return false;
  return deriveHubDeployState({ ...inputs, hold: null }).canStart === true;
}

/**
 * The first-deployment next action (spec §3.1): a READY, EMPTY completed read
 * for this owner, no live game, a finite recorded gamesPlayed of exactly 0, and
 * canStart. Missing or default score evidence is never promoted into a
 * first-game fact, and a completed read that failed never suggests it.
 */
export function firstDeploymentCandidate(inputs) {
  const { auth, completed, poll, agent } = inputs || {};
  if (!signedIn(auth)) return false;
  if (!completed || completed.status !== READY || !ownedBy(completed, auth)) return false;
  if (!Array.isArray(completed.rows) || completed.rows.length !== 0) return false;
  if (!ownedBy(poll, auth) || !Array.isArray(poll.liveBattles) || ownedLiveBattles(poll.liveBattles, auth.uid).length !== 0) return false;
  const gamesPlayed = agent?.agent?.stats?.gamesPlayed;
  if (!finite(gamesPlayed) || gamesPlayed !== 0) return false;
  return deriveHubDeployState(inputs).canStart === true;
}

/** The actions an attempt display can carry (re-exported for the display table). */
export { ATTEMPT_ACTIONS };
