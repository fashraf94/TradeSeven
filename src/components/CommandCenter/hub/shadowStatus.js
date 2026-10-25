// src/components/CommandCenter/hub/shadowStatus.js
//
// Command Center hub, slice S7 — the words of the status line (spec V1.2 §10;
// ruling R-S7-7). The line is the hub's one live region and announces phase
// changes only. In priority order:
//
//   1  a hold charging or locked          "Holding to deploy" / "Locked in"
//   2  a hub-started deployment submitting  "Submitting your deployment"
//   3  verifying or finishing              the Deploy card's own word
//   4  an attempt's terminal, until acknowledged: the card's own word
//      ("Deployed" / "Battle confirmed", "Already running", "Deployment
//      refused", "Couldn't confirm the deploy"). An uncertain guard keeps its
//      word for as long as the selector says uncertain
//   5  an owned live game and no attempt shown  "Live game in progress" / "{n} live games in progress"
//   6  the owned live read is not known (loading, never answered, or its last
//      refresh failed with nothing retained to stand on)  "Idle"
//   7  otherwise                           "Idle · nothing running"
//
// Rules 3 and 4 take `display.status`, the string deployDisplay builds for the
// card and the strip, so the line and the card cannot disagree (BUILD_RULES §9).
//
// Rule 5 counts the games the screen calls live. A game deployed after hours is
// in the owned live list but has not opened: the strip and the Games row say
// "Deployed · waiting for the open", so that is the line's phrase for a list of
// such games alone (built from the strip's own copy, never a second string), and
// "in progress" counts only the games that have opened (review C-1).
//
// A retained live list that a later refresh failed to renew is still the list
// the strip and the Deploy card show (spec §3.1), so rule 5 follows it: the
// status line has no way to say "as of", and the card beside it does. An EMPTY
// retained list after a failed refresh is another matter: "nothing running" would
// be asserted from stale data, so the line says "Idle" and claims nothing
// (review C-3). A refresh merely in flight changes nothing: the retained answer
// stands, so the line does not flicker on every poll.
//
// Pure: no React, no clock.

import { HUB_COPY as COPY } from './hubCopy';
import { ATTEMPT_DISPLAY, HOLD_PHASES } from './selectors/attemptVocabulary';

const IN_FLIGHT_WORDS = new Set([ATTEMPT_DISPLAY.VERIFYING, ATTEMPT_DISPLAY.FINISHING]);
const TERMINAL_WORDS = new Set([ATTEMPT_DISPLAY.CONFIRMED, ATTEMPT_DISPLAY.EXISTING, ATTEMPT_DISPLAY.FAILED, ATTEMPT_DISPLAY.UNCERTAIN]);

/**
 * Whether the owned live read can be said to be known. The connected hub's Games section says whether it has answered
 * for this owner (`liveResolved`); a section without that key (the layout fixtures) is known once the deploy
 * selector holds a gate from an owned poll (`gateBlocked` is a boolean) — the live read's own answer, not the completed
 * window's. Either way a failed refresh (`freshness.stale`) takes the knowledge back: with nothing live in the retained
 * list it cannot say nothing is running.
 *
 * @param {object} games   the Games section
 * @param {object} [deploy] the deploy selector's result (hub/selectors/deployState.js)
 */
export function liveReadKnown(games, deploy) {
  const answered = typeof games?.liveResolved === 'boolean' ? games.liveResolved : typeof deploy?.gateBlocked === 'boolean';
  return answered && deploy?.freshness?.stale !== true;
}

/**
 * @param {{
 *   holdPhase: null|'charging'|'locked',
 *   display: { displayState: string, status: string, processing: boolean },
 *   liveCount: number,      owned live games that have opened
 *   waitingCount: number,   owned live games deployed and waiting for the open
 *   liveKnown: boolean
 * }} input
 * @returns {string} the line's words
 */
export function shadowStatusWords({ holdPhase = null, display, liveCount = 0, waitingCount = 0, liveKnown = false }) {
  const S = COPY.shadow;
  if (holdPhase === HOLD_PHASES.LOCKED) return S.statusLocked;
  if (holdPhase === HOLD_PHASES.CHARGING) return S.statusHolding;
  if (display?.processing === true) return S.statusSubmitting;
  const state = display?.displayState;
  if (IN_FLIGHT_WORDS.has(state) || TERMINAL_WORDS.has(state)) return display.status;
  if (liveCount > 0) return liveCount === 1 ? S.statusLiveOne : S.statusLiveMany(liveCount);
  if (waitingCount > 0) return COPY.strip.deployed(COPY.games.waitingForOpen);
  if (!liveKnown) return S.statusIdleUnknown;
  return S.statusIdle;
}
