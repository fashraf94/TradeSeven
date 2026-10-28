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
//   5  an owned live game and no attempt shown  "Live game in progress" / "{n} live games in progress";
//      every opened game past its end time      the strip's "Live · ending"
//   6  the owned live read is not known (loading, never answered, or its last
//      refresh failed with nothing retained to stand on)  "Idle"
//   7  otherwise                           "Idle · nothing running"
//
// Rules 3 and 4 take `display.status`, the string deployDisplay builds for the
// card and the strip, so the line and the card cannot disagree (BUILD_RULES §9).
//
// Rule 5 counts the games the screen calls live. A game deployed after hours is
// in the owned live list but has not opened: for a list of such games alone the
// line says the strip's own phrase, the hub's one waiting line ("Deployed ·
// Starts Wed 9:30 AM ET", or "Deployed · waiting for the open" when no start is
// known; hub/gamesDisplay.js waitingLineOf, ruling Q-S8F-5), and
// "in progress" counts only the games that have opened (review C-1). When every
// opened game is past its end time the strip and the rows say "Live · ending",
// and so does the line, from the same copy, never "in progress" (the S8 review's
// K-1; ruling R-S8F-7). The counts are the Games header's own
// (hub/hubModel.js liveCountsOf).
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

// The vocabulary's own tokens (hub/selectors/attemptVocabulary.js ATTEMPT_DISPLAY and HOLD_PHASES), spelled here and not
// imported: the deploy provider at App's root imports that module, so every binding the hub chunk takes from it is another
// export in the ENTRY chunk (measured: two imports, +18 bytes there). The hub's own earlier code (ShadowStage's old
// statusWords) spelled the hold phases the same way. shadowStatus.test.js pins each token equal to the vocabulary's.
export const HOLD = Object.freeze({ CHARGING: 'charging', LOCKED: 'locked' });
export const ATTEMPT_WORDS = Object.freeze({
  VERIFYING: 'verifying', FINISHING: 'finishing', CONFIRMED: 'confirmed', EXISTING: 'existing', FAILED: 'failed', UNCERTAIN: 'uncertain',
});

const IN_FLIGHT_WORDS = new Set([ATTEMPT_WORDS.VERIFYING, ATTEMPT_WORDS.FINISHING]);
const TERMINAL_WORDS = new Set([ATTEMPT_WORDS.CONFIRMED, ATTEMPT_WORDS.EXISTING, ATTEMPT_WORDS.FAILED, ATTEMPT_WORDS.UNCERTAIN]);

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
 *   waitingLine?: string,   the hub's one waiting phrase (hub/gamesDisplay.js waitingLineOf; ruling Q-S8F-5)
 *   allEnding: boolean,     every opened game is past its end time
 *   liveKnown: boolean
 * }} input
 * @returns {string} the line's words
 */
export function shadowStatusWords({ holdPhase = null, display, liveCount = 0, waitingCount = 0, waitingLine = COPY.strip.deployed(COPY.games.waitingForOpen), allEnding = false, liveKnown = false }) {
  const S = COPY.shadow;
  if (holdPhase === HOLD.LOCKED) return S.statusLocked;
  if (holdPhase === HOLD.CHARGING) return S.statusHolding;
  if (display?.processing === true) return S.statusSubmitting;
  const state = display?.displayState;
  if (IN_FLIGHT_WORDS.has(state) || TERMINAL_WORDS.has(state)) return display.status;
  if (liveCount > 0 && allEnding === true) return COPY.strip.live(COPY.games.ending);
  if (liveCount > 0) return liveCount === 1 ? S.statusLiveOne : S.statusLiveMany(liveCount);
  if (waitingCount > 0) return waitingLine;
  if (!liveKnown) return S.statusIdleUnknown;
  return S.statusIdle;
}
