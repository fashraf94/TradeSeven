// src/screens/battleView/leagueAgentMood.js
//
// Agent form build S2 — the League forms' mood, from signals the League screen already has (founder ruling R15), beside
// agentMood.js and sharing it. Pure: the caller hands in the standing its own screen derives, and nothing here ranks a
// seat, reads a score or sets a threshold (BUILD_RULES §9: the mood and the crown are one derivation).
//
// The player's form, first match:
//   celebrating  the game is over and the existing outcome derivation says WON (deriveGameOutcome). That derivation
//                reads one battle document, and a League battle is a banked day, so it answers `banked` or `noResult`,
//                never `won`: a League result belongs to the group. So this does not fire in League today, by the
//                ruling's letter (the S2 report's founder question 1 has the one-line alternative, and a row pins it).
//   researching  a live evaluation lock on the player's own battle, as in the battle view (agentMood.js signalMood).
//                `waiting` shares that step and stays unused: League has no cockpit, so no open call reaches it.
//   confident /  the standing the screen shows: first place or an advancing spot is confident, out of it or last is
//   worried      worried, anything else idle.
//   idle         otherwise, and for a finished game that was not won (a finished game never shows the live standing).
// An opponent's form: its own standing only, and it keeps its final standing when the game ends (S1's ruling 4).

import { outcomeInputOf, signalMood } from './agentMood';

/** How many seats a ranked pod advances: the top two, the cut the arena draws ("TOP 2 ADVANCE", fuseGeometry.js deriveCut). */
export const LEAGUE_ADVANCING_SPOTS = 2;

/**
 * A seat's standing, from the screen's own order.
 * @param {{ ranked: string[], cut: boolean, shown: boolean, complete: boolean }|null} board  the screen's: its ranked seat
 *   ids, whether it plays to a cut, whether it shows a standing at all, and whether the game is over
 * @param {string} seatId
 */
export function standingOf(board, seatId) {
  if (!board || !Array.isArray(board.ranked)) return null;
  return { rank: board.ranked.indexOf(seatId) + 1, seats: board.ranked.length, cut: board.cut === true, shown: board.shown === true, complete: board.complete === true };
}

/** The mood of a standing the screen shows. A board with no standing, or a seat not on it, is idle. */
export function standingMood(standing) {
  if (!standing || standing.shown !== true || !(standing.seats >= 2) || !(standing.rank >= 1)) return 'idle';
  const { rank, seats, cut } = standing;
  if (rank === 1 || (cut && rank <= LEAGUE_ADVANCING_SPOTS)) return 'confident';
  if (rank === seats || (cut && rank > LEAGUE_ADVANCING_SPOTS)) return 'worried';
  return 'idle';
}

/**
 * @param {object}  args
 * @param {boolean} [args.you]      this seat is the player's
 * @param {object}  [args.standing] standingOf's answer
 * @param {object}  [args.battle]   the player's own live battle document, when the screen holds one
 * @param {number}  [args.nowMs]    the form's clock, for the evaluation lock's age
 * @param {{ deriveGameOutcome: Function, OUTCOME_KINDS: object }} [args.outcomes] hub/selectors/gameOutcome.js
 * @returns {'celebrating'|'researching'|'confident'|'worried'|'idle'}
 */
export function deriveLeagueMood({ you = false, standing = null, battle = null, nowMs, outcomes = null } = {}) {
  if (!you) return standingMood(standing);
  if (standing && standing.complete === true) {
    const won = Boolean(battle) && Boolean(outcomes) && outcomes.deriveGameOutcome(outcomeInputOf(battle)).kind === outcomes.OUTCOME_KINDS.WON;
    return won ? 'celebrating' : 'idle';
  }
  return signalMood(battle, null, nowMs) ?? standingMood(standing);
}
