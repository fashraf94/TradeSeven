// src/components/CommandCenter/hub/deployDisplay.js
//
// Command Center hub, slice S1 — what the mobile strip and the Deploy card
// show for a deploy display state (spec V1.2 §3.1, §5.2, §10; the design's
// GameStrip and DeploySection, ff-mobile.jsx / ff-side.jsx).
//
// Input is the shape S2a's selector will return, `deriveHubDeployState` →
// `{ displayState, canStart, … }` (§3.1), plus the first live game row when
// there is one. This table only translates; it decides no eligibility. Its keys
// are §3.1 / §5.2 DISPLAY words (`checking`, `ready`, `confirmed` …), never the
// provider's stored phases (`created`, `refused`, `orphaned` … — §5.2: "UI
// confirmed, finishing and failed are display words; they are never stored
// phases").
//
// S1 renders `checking` only. The other rows are the design's states (ready,
// live with Open game, blocked, error, submitting, confirmed), reached from
// the layout fixtures until S2a/S2b supply real state. An unknown display
// state fails closed to `checking`: nothing can start from a state this table
// does not know.

import { HUB_COPY as COPY } from './hubCopy';

/** The display states this table renders, in the §3.1 vocabulary. */
export const DEPLOY_DISPLAY_STATES = Object.freeze(['checking', 'ready', 'blocked', 'eligibility_error', 'submitting', 'confirmed']);

const S = COPY.deploy.states;

const known = (state) => (DEPLOY_DISPLAY_STATES.includes(state) ? state : 'checking');

/**
 * @param {{ displayState: string, canStart?: boolean, reason?: string }} deploy
 * @param {null|{ clock: string, preOpen?: boolean }} liveGame the first live game row, if any
 * @returns {{
 *   displayState: string,
 *   status: string,             the state's words (the strip's first line without a live game)
 *   dot: string,                the status dot's token
 *   canStart: boolean,          true only for `ready` with canStart
 *   processing: boolean,        a hub-started deployment is submitting (Shadow's status)
 *   stripLine1: string,
 *   stripLine2: (loadoutLine: string) => string,
 *   strip: { openGame: boolean, hold: null|{ label: string, secondary: boolean }, retry: boolean },
 *   cardHoldLabel: string,
 *   cardLine: null|{ icon: string|null, text: string, retry: boolean },
 * }}
 */
export function deployDisplay(deploy, liveGame = null) {
  const displayState = known(deploy?.displayState);
  const reason = typeof deploy?.reason === 'string' && deploy.reason ? deploy.reason : '';
  const canStart = displayState === 'ready' && deploy?.canStart === true;
  const status = displayState === 'blocked' ? S.blocked(reason) : S[displayState];
  const inFlight = displayState === 'submitting' || displayState === 'confirmed';

  let dot = 'ink-3';
  if (displayState === 'confirmed') dot = 'pos';
  else if (displayState === 'submitting') dot = 'blue-action';
  else if (liveGame) dot = 'teal';
  else if (displayState === 'ready') dot = 'pos';
  else if (displayState === 'checking') dot = 'ink-2';

  // The strip (ff-mobile.jsx GameStrip): a live game takes the first line and
  // the Open game action; the deploy state moves to the second line.
  const liveLine = liveGame ? (liveGame.preOpen ? COPY.strip.deployed(liveGame.clock) : COPY.strip.live(liveGame.clock)) : null;
  const stripLine1 = inFlight || !liveGame ? status : liveLine;
  const gateLine = displayState === 'blocked'
    ? COPY.deploy.blockedBehindGame(reason)
    : displayState === 'checking' || displayState === 'eligibility_error' ? status : null;
  const stripLine2 = (loadoutLine) => (!inFlight && liveGame && gateLine ? gateLine : loadoutLine);

  let hold = null;
  if (liveGame && !inFlight) {
    hold = canStart ? { label: COPY.deploy.holdWithGame, secondary: true } : null;
  } else if (displayState === 'checking') hold = { label: COPY.deploy.holdShort, secondary: false };
  else if (displayState === 'ready' || displayState === 'blocked') hold = { label: COPY.deploy.hold, secondary: false };
  else if (displayState === 'submitting') hold = { label: COPY.deploy.holdSubmitting, secondary: false };
  else if (displayState === 'confirmed') hold = { label: COPY.deploy.holdDeployed, secondary: false };

  const cardHoldLabel = displayState === 'submitting' ? COPY.deploy.holdSubmitting
    : displayState === 'confirmed' ? COPY.deploy.holdDeployed : COPY.deploy.hold;

  let cardLine = null;
  if (displayState === 'checking') cardLine = { icon: null, text: status, retry: false };
  else if (displayState === 'blocked') cardLine = { icon: 'lock', text: status, retry: false };
  else if (displayState === 'eligibility_error') cardLine = { icon: 'info', text: status, retry: true };
  else if (displayState === 'submitting') cardLine = { icon: null, text: COPY.deploy.cardSubmitting, retry: false };
  else if (displayState === 'confirmed') cardLine = { icon: 'check', text: COPY.deploy.cardConfirmed, retry: false };

  return {
    displayState,
    status,
    dot,
    canStart,
    processing: displayState === 'submitting',
    stripLine1,
    stripLine2,
    strip: {
      openGame: Boolean(liveGame) && !inFlight,
      hold,
      retry: !liveGame && displayState === 'eligibility_error',
    },
    cardHoldLabel,
    cardLine,
  };
}
