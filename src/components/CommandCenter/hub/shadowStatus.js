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
//   6  the owned live read is not known (loading, or never answered)  "Idle"
//   7  otherwise                           "Idle · nothing running"
//
// Rules 3 and 4 take `display.status`, the string deployDisplay builds for the
// card and the strip, so the line and the card cannot disagree (BUILD_RULES §9).
// A retained live list that a later refresh failed to renew is still the list
// the strip and the Deploy card show (spec §3.1), so rule 5 follows it: the
// status line has no way to say "as of", and the card beside it does.
//
// Pure: no React, no clock.

import { HUB_COPY as COPY } from './hubCopy';
import { ATTEMPT_DISPLAY, HOLD_PHASES } from './selectors/attemptVocabulary';

const IN_FLIGHT_WORDS = new Set([ATTEMPT_DISPLAY.VERIFYING, ATTEMPT_DISPLAY.FINISHING]);
const TERMINAL_WORDS = new Set([ATTEMPT_DISPLAY.CONFIRMED, ATTEMPT_DISPLAY.EXISTING, ATTEMPT_DISPLAY.FAILED, ATTEMPT_DISPLAY.UNCERTAIN]);

/**
 * Whether the owned live read has answered. The connected hub's Games section says so (`liveResolved`); a section
 * without that key (the layout fixtures) is known once its rows are ready.
 */
export function liveReadKnown(games) {
  if (typeof games?.liveResolved === 'boolean') return games.liveResolved;
  return games?.status === 'ready';
}

/**
 * @param {{ holdPhase: null|'charging'|'locked', display: { displayState: string, status: string, processing: boolean }, liveCount: number, liveKnown: boolean }} input
 * @returns {string} the line's words
 */
export function shadowStatusWords({ holdPhase = null, display, liveCount = 0, liveKnown = false }) {
  const S = COPY.shadow;
  if (holdPhase === HOLD_PHASES.LOCKED) return S.statusLocked;
  if (holdPhase === HOLD_PHASES.CHARGING) return S.statusHolding;
  if (display?.processing === true) return S.statusSubmitting;
  const state = display?.displayState;
  if (IN_FLIGHT_WORDS.has(state) || TERMINAL_WORDS.has(state)) return display.status;
  if (liveCount > 0) return liveCount === 1 ? S.statusLiveOne : S.statusLiveMany(liveCount);
  if (!liveKnown) return S.statusIdleUnknown;
  return S.statusIdle;
}
