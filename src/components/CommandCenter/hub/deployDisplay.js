// src/components/CommandCenter/hub/deployDisplay.js
//
// Command Center hub — what the mobile strip and the Deploy card show for a
// deploy display state (spec V1.2 §3.1, §5.2, §10; the design's GameStrip and
// DeploySection, ff-mobile.jsx / ff-side.jsx). Slice S1 laid the table down;
// slice S2a extends it to the whole vocabulary.
//
// Input is the selector's result, `deriveHubDeployState` → `{ displayState,
// canStart, reason, freshness, retryAction, action, recovered, battleId,
// cooldownUntil }` (selectors/deployState.js), plus the first live game row
// when there is one. This table only translates; it decides no eligibility.
// Its keys are DISPLAY words — the §3.1 eligibility states and the §5.2
// attempt words (`verifying`, `finishing`, `confirmed`, `failed` …) — never a
// stored phase it could misread: `created`, `refused`, `orphaned` and `idle`
// are phases only. `existing` and `uncertain` are both a stored phase and a
// display word in §5.2, and here they are only ever the display word the
// selector chose.
//
// Slice S3 (founder ruling R-S3-1): the strip's two lines clamp (DeployStrip),
// so a word the strip cannot hold whole lives on the card: the review-due
// refusal reads "Deployment refused" on the strip, its server line on the card.
//
// The compositions follow the design's rules: no live hold while an attempt is
// submitting, verifying, finishing or terminal (the control reports the phase,
// disabled); Retry on a read error; Open game on an existing battle; an
// attempt's one action in place of the hold. A Retry of a READ (the agent, the
// poll) and an attempt's Retry (a new request) are different actions and never
// share a kind. An unknown display state fails closed to `checking`: nothing
// can start from a state this table does not know.

import { HUB_COPY as COPY } from './hubCopy';
import { formatHubTime } from './hubDate';
import { ATTEMPT_ACTIONS } from './selectors/attemptVocabulary';

/** The display states this table renders: spec §3.1's, then §5.2's attempt words. */
export const DEPLOY_DISPLAY_STATES = Object.freeze([
  'signed_out', 'account_transition', 'cooldown', 'loading_agent', 'agent_error', 'no_agent',
  'blocked', 'eligibility_error', 'checking', 'ready_stale', 'ready',
  'submitting', 'verifying', 'finishing', 'confirmed', 'existing', 'failed', 'uncertain',
]);

/**
 * The actions a display can offer: an attempt's (spec §5.2), a read's Retry (§3), and the Dismiss of a refusal no
 * ceremony shows (§5.4; founder ruling Q-S2b-4), which sits beside the refusal's own action, never in its place.
 */
export const DISPLAY_ACTIONS = Object.freeze({ ...ATTEMPT_ACTIONS, RETRY_READ: 'retryRead', DISMISS: 'dismiss' });

const S = COPY.deploy.states;
const D = COPY.deploy;

const ACTION_LABEL = Object.freeze({
  [DISPLAY_ACTIONS.RETRY_READ]: D.retry,
  [DISPLAY_ACTIONS.RETRY]: D.retry,
  [DISPLAY_ACTIONS.ENTER_BATTLE]: D.enterBattle,
  [DISPLAY_ACTIONS.OPEN_GAME]: D.openGame,
  [DISPLAY_ACTIONS.CHECK_DEPLOYMENT]: D.checkDeployment,
  [DISPLAY_ACTIONS.OPEN_FORGE_REVIEW]: D.openForge,
  [DISPLAY_ACTIONS.DISMISS]: D.dismiss,
});
const actionOf = (kind) => (Object.hasOwn(ACTION_LABEL, kind) ? Object.freeze({ kind, label: ACTION_LABEL[kind] }) : null);

/** The attempt's display words (spec §5.2). */
const ATTEMPT_STATES = new Set(['submitting', 'verifying', 'finishing', 'confirmed', 'existing', 'failed', 'uncertain']);
/** The attempt is in flight or just confirmed: the control reports its phase. */
const IN_FLIGHT = new Set(['submitting', 'verifying', 'finishing', 'confirmed']);
/** A read failed with nothing retained: Retry takes the hold's place. */
const READ_ERRORS = new Set(['agent_error', 'eligibility_error']);
/** Eligibility not yet known or not this owner's to act on: a disabled hold, the words on the line. */
const WAITING = new Set(['checking', 'loading_agent', 'signed_out', 'account_transition', 'no_agent', 'cooldown']);

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const etTime = (ms, opts) => {
  const clock = formatHubTime(ms, opts);
  return clock ? COPY.time.et(clock) : '';
};

function known(deploy) {
  const state = deploy?.displayState;
  if (!DEPLOY_DISPLAY_STATES.includes(state)) return 'checking';
  // A cooldown with no bound to show is not a state this table can render.
  if (state === 'cooldown' && !finite(deploy.cooldownUntil)) return 'checking';
  return state;
}

function statusOf(displayState, deploy, reason, asOf) {
  switch (displayState) {
    case 'blocked': return S.blocked(reason);
    case 'cooldown': return S.cooldown(etTime(deploy.cooldownUntil, { roundUp: true }));
    case 'ready_stale': return S.ready_stale(asOf);
    case 'confirmed': return deploy?.recovered === true ? D.confirmedRecovered : S.confirmed;
    default: return S[displayState];
  }
}

function dotOf(displayState, liveGame) {
  if (displayState === 'confirmed') return 'pos';
  if (displayState === 'submitting' || displayState === 'verifying' || displayState === 'finishing') return 'blue-action';
  if (displayState === 'failed' || displayState === 'uncertain') return 'copper';
  if (displayState === 'existing' || liveGame) return 'teal';
  if (displayState === 'ready' || displayState === 'ready_stale') return 'pos';
  if (displayState === 'checking' || displayState === 'loading_agent' || displayState === 'account_transition') return 'ink-2';
  return 'ink-3';
}

function holdLabelOf(displayState, recovered) {
  switch (displayState) {
    case 'submitting': return D.holdSubmitting;
    case 'verifying': return D.holdVerifying;
    case 'finishing': return D.holdFinishing;
    case 'confirmed': return recovered ? D.confirmedRecovered : D.holdDeployed;
    // A terminal with its own action: the card's control reports the phase too,
    // so neither its words nor its name offer a hold (prompt §4.5; S2a review A1-4).
    case 'existing': case 'failed': case 'uncertain': return S[displayState];
    default: return D.hold;
  }
}

/**
 * @param {object} deploy the selector's result (selectors/deployState.js)
 * @param {null|{ clock: string, preOpen?: boolean }} liveGame the first live game row, if any
 * @param {null|string} [waitingLine] the hub's one waiting phrase (hub/gamesDisplay.js waitingLineOf; ruling Q-S8F-5),
 *   said in place of a waiting game's own; without it, that game's own "Deployed · {clock}"
 * @returns {{
 *   displayState: string,
 *   status: string,             the state's words (the strip's first line without a live game)
 *   dot: string,                the status dot's token
 *   canStart: boolean,          true only for ready / ready_stale with canStart
 *   processing: boolean,        a hub-started deployment is submitting (Shadow's status)
 *   stripLine1: string,
 *   stripLine2: (loadoutLine: string) => string,
 *   strip: { openGame: boolean, hold: null|{ label: string, secondary: boolean }, action: null|{ kind: string, label: string }, dismiss?: { kind: 'dismiss', label: string } },
 *   cardHoldLabel: string,
 *   cardLine: null|{ icon: string|null, text: string, action: null|{ kind: string, label: string }, dismiss?: { kind: 'dismiss', label: string } },
 *   cardNote: null|{ text: string, action: null|{ kind: string, label: string } },
 * }}
 */
export function deployDisplay(deploy, liveGame = null, waitingLine = null) {
  const displayState = known(deploy);
  const reason = typeof deploy?.reason === 'string' && deploy.reason ? deploy.reason : '';
  const canStart = (displayState === 'ready' || displayState === 'ready_stale') && deploy?.canStart === true;
  const asOf = etTime(deploy?.freshness?.asOf);
  const stale = deploy?.freshness?.stale === true;
  const refreshing = deploy?.freshness?.refreshing === true;
  const recovered = displayState === 'confirmed' && deploy?.recovered === true;
  const status = statusOf(displayState, deploy, reason, asOf);
  const attemptShown = ATTEMPT_STATES.has(displayState);
  const inFlight = IN_FLIGHT.has(displayState);
  const attemptAction = attemptShown ? actionOf(deploy?.action) : null;
  const readRetry = actionOf(DISPLAY_ACTIONS.RETRY_READ);
  // Why an attempt's Retry is withheld: the row a replacing request would meet
  // now — a cooldown's next time, a block's reason, a read still checking (spec
  // §5.4; S2a review A1-2). Nothing is said when it would only read "ready".
  const block = attemptShown && deploy?.retryBlock && typeof deploy.retryBlock === 'object' ? deploy.retryBlock : null;
  const blockStatus = block && block.displayState !== 'ready' && block.displayState !== 'ready_stale'
    && DEPLOY_DISPLAY_STATES.includes(block.displayState)
    ? statusOf(block.displayState === 'cooldown' && !finite(block.cooldownUntil) ? 'checking' : block.displayState, block,
      typeof block.reason === 'string' ? block.reason : '', '')
    : null;
  const blockText = typeof blockStatus === 'string' && blockStatus ? blockStatus : null;
  // The review-due refusal (slice S3, founder ruling R-S3-1): the strip says
  // "Deployment refused" with Open in the Forge as its action; the server's
  // line stays whole on the card (cardLine below), never on the strip.
  const reviewDue = displayState === 'failed' && deploy?.action === DISPLAY_ACTIONS.OPEN_FORGE_REVIEW;
  // A refusal no ceremony shows: Dismiss acknowledges it, beside its Retry or Forge action (founder ruling
  // Q-S2b-4). Only the refusal's display word carries it; the uncertain guard never does.
  const dismiss = displayState === 'failed' && deploy?.dismiss === true ? actionOf(DISPLAY_ACTIONS.DISMISS) : null;
  const withDismiss = dismiss ? { dismiss } : {};

  // The strip (ff-mobile.jsx GameStrip): a live game takes the first line and
  // the Open game action; the deploy state moves to the second line. An
  // attempt keeps the first line over a live game. A waiting game says the hub's one waiting phrase, as the Games
  // header and the status line do (ruling Q-S8F-5).
  const liveLine = liveGame ? (liveGame.preOpen ? (waitingLine || COPY.strip.deployed(liveGame.clock)) : COPY.strip.live(liveGame.clock)) : null;
  const stripLine1 = reviewDue ? D.reviewDueStrip : attemptShown || !liveGame ? status : liveLine;
  // A stale block says when it was true on every surface (spec §3.1 row 6): the
  // card's note, and on the strip the second line — beside a live game in place
  // of the reason (the live line and Open game already say why), else in place
  // of the loadout.
  const staleBlock = displayState === 'blocked' && stale;
  // The same holds for a stale or refreshing list (rows 9 and 10): the strip is
  // the phone's only deploy surface, so its second line says so too (S2a review
  // A1-1). A stale clear list: beside a live game when it was true, alone the
  // refresh failure (line one already carries the time). A pending refresh: the
  // retained time — beside a live game for a clear list, and alone for a block
  // (beside a live game a block's line two keeps its reason). The read's Retry
  // stays on the card: the strip's one row has no room for a third control.
  const freshnessLine = displayState === 'ready_stale' ? (liveGame ? D.staleAsOf(asOf) : D.refreshFailed)
    : refreshing && (displayState === 'ready' || (displayState === 'blocked' && !liveGame)) ? D.refreshing(asOf) : null;
  const gateLine = displayState === 'blocked'
    ? (staleBlock ? D.blockedStaleBehindGame(asOf) : D.blockedBehindGame(reason))
    : WAITING.has(displayState) || READ_ERRORS.has(displayState) ? status : null;
  const stripLine2 = (loadoutLine) => {
    // A refusal's own words, unchanged, take the second line (spec §5.2) — but
    // for the review-due refusal, whose line lives on the card (R-S3-1).
    if (displayState === 'failed' && reason && !reviewDue) return reason;
    if (existingRead?.status === 'error') return D.existingUnavailable;
    if (attemptShown && blockText) return blockText;
    if (!attemptShown && liveGame && gateLine) return gateLine;
    if (staleBlock) return D.staleAsOf(asOf);
    if (freshnessLine) return freshnessLine;
    return loadoutLine;
  };

  let hold = null;
  if (attemptShown) {
    if (inFlight && !attemptAction) hold = { label: holdLabelOf(displayState, recovered), secondary: false };
  } else if (liveGame) {
    hold = canStart ? { label: D.holdShort, secondary: true } : null;
  } else if (WAITING.has(displayState)) hold = { label: D.holdShort, secondary: false };
  else if (displayState === 'ready' || displayState === 'ready_stale' || displayState === 'blocked') hold = { label: D.hold, secondary: false };

  const stripAction = attemptAction || (!liveGame && READ_ERRORS.has(displayState) ? readRetry : null);

  let cardLine = null;
  switch (displayState) {
    case 'checking': case 'loading_agent': case 'signed_out': case 'account_transition':
    case 'verifying': case 'finishing':
      cardLine = { icon: null, text: status, action: null }; break;
    case 'cooldown': case 'blocked':
      cardLine = { icon: 'lock', text: status, action: null }; break;
    case 'no_agent': case 'ready_stale':
      cardLine = { icon: 'info', text: status, action: null }; break;
    case 'agent_error': case 'eligibility_error':
      cardLine = { icon: 'info', text: status, action: readRetry }; break;
    case 'submitting':
      cardLine = { icon: null, text: D.cardSubmitting, action: null }; break;
    case 'confirmed':
      cardLine = { icon: 'check', text: recovered ? D.confirmedRecovered : D.cardConfirmed, action: attemptAction }; break;
    case 'failed':
      cardLine = { icon: 'info', text: reason || status, action: attemptAction, ...withDismiss }; break;
    case 'existing': case 'uncertain':
      cardLine = { icon: 'info', text: status, action: attemptAction }; break;
    default: break;
  }

  // Slice S2b (ruling R-S2b-5; R1 Fable FR-2): the existing battle's owned read,
  // when the hub has one for this attempt — reading it, or a read that failed,
  // with the time its Retry (Open game) opens. Never silence after a definitive
  // server answer.
  // The same read serves a creation whose handoff threw (its Enter reads the real battle; review W4-5).
  const existingRead = (displayState === 'existing' || displayState === 'confirmed') && deploy?.existingRead && typeof deploy.existingRead === 'object' ? deploy.existingRead : null;
  const existingNote = existingRead?.status === 'loading' ? D.existingReading
    : existingRead?.status === 'error' ? D.existingRetryAt(etTime(existingRead.retryAt, { roundUp: true })) : null;

  // Freshness (spec §3.1): a stale retained list says when it was true and
  // offers the read's Retry; a pending refresh says so, with the retained time.
  let cardNote = null;
  if (existingNote) cardNote = { text: existingNote, action: null };
  else if (blockText) cardNote = { text: blockText, action: null };
  else if (displayState === 'ready_stale') cardNote = { text: D.refreshFailed, action: readRetry };
  else if (displayState === 'blocked' && stale) cardNote = { text: D.staleAsOf(asOf), action: readRetry };
  else if ((displayState === 'ready' || displayState === 'blocked') && refreshing) cardNote = { text: D.refreshing(asOf), action: null };

  return {
    displayState,
    status,
    dot: dotOf(displayState, liveGame),
    canStart,
    processing: displayState === 'submitting',
    stripLine1,
    stripLine2,
    strip: {
      openGame: Boolean(liveGame) && !attemptShown,
      hold,
      action: stripAction,
      ...withDismiss,
    },
    cardHoldLabel: holdLabelOf(displayState, recovered),
    cardLine,
    cardNote,
  };
}
