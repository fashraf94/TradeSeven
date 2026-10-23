// src/components/CommandCenter/hub/selectors/gameOutcome.js
//
// Command Center hub, slice S3 (ruling R-S3-7; spec V1.2 §7, correction C6) —
// a game's outcome from its record's evidence, pure. It reads ONE projection
// of the record (built by hub/gamesDisplay.js outcomeInputOf):
//
//   { status, gameMode, completionContext, resultUnavailable, finalEvidence,
//     scoreState }
//
//   scoreState         one snapshot: the scores a reader may show (v2 Ruling
//                      16, displayedStockScores — a measured-model battle's
//                      unavailable scores are null, a legacy one's as stored)
//   finalEvidence      the record carries the platform's `battle_complete`
//                      feed entry
//   resultUnavailable  the record's completion says its result is unavailable
//
// Evidence, never coercion: an operand is a finite number or it is absent —
// null, a missing field, a numeric string, a non-finite value is no score. A
// game is SCORED only with a valid recorded timestamp in `lastScoredAt` (an
// ISO-8601 instant, as the scorer writes, or a Firestore timestamp) or a
// finite positive `evaluationCount`; any other text is not a timestamp, and
// the initializer's 0 is no score without that evidence. A tape's or review's
// availability is never evidence here.
//
// The table (§7), first match:
//   not completed                                         active
//   result unavailable                                    noResult
//   tournament + banked context + scored + finite current banked
//   tournament otherwise                                  noResult
//   final evidence + scored + both finite                 won / lost / draw
//   final evidence otherwise                              noScore — the
//       never-scored recorded draw lands here ON PURPOSE: the server's
//       resolver calls it a draw, the hub says no result (F4)
//   no final evidence + scored + both finite              ended
//   no final evidence otherwise                           noResult
//
// The verdict is the comparison of the SAME stored pair the display shows
// (BUILD_RULES §9): a positive score can lose, a negative one can win.
// Returns tokens and numbers only; the words are hubCopy's.

import { TOURNAMENT_GAME_MODE } from '../../../../constants/leagueTournament';

export const OUTCOME_KINDS = Object.freeze({
  ACTIVE: 'active',
  BANKED: 'banked',
  WON: 'won',
  LOST: 'lost',
  DRAW: 'draw',
  NO_SCORE: 'noScore',
  ENDED: 'ended',
  NO_RESULT: 'noResult',
});

/** The completion context the server stamps on a banked tournament day (agent-evaluate.js resolveCompletionDisposition). */
export const BANKED_CONTEXT = 'tournament_group_scored';

const finite = (n) => typeof n === 'number' && Number.isFinite(n);

const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/;

/** The days in a month, February 29 in a leap year (every 4th, not every 100th, but every 400th). No Date: pure. */
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const daysIn = (year, month) => (month === 2 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : MONTH_DAYS[month - 1]);
/** A Firestore timestamp's seconds: from 2000-01-01 (the string branch's year floor) to the SDK's own limit, 9999-12-31. */
const SECONDS_FROM_2000 = 946684800;
const SECONDS_TO_9999 = 253402300799;

/**
 * A valid recorded timestamp: an ISO-8601 instant with real fields — a day the calendar has (review T4-3) — or a
 * Firestore timestamp with real seconds and nanoseconds. Arbitrary text is not one.
 */
export function isRecordedTimestamp(value) {
  if (typeof value === 'string') {
    const m = ISO_INSTANT.exec(value);
    if (!m) return false;
    const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
    const offsetOk = m[7] === undefined || (Number(m[7]) <= 23 && Number(m[8]) <= 59);
    return year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month) && hour <= 23 && minute <= 59 && second <= 59 && offsetOk;
  }
  if (value && typeof value === 'object') {
    const { seconds, nanoseconds } = value;
    return finite(seconds) && seconds >= SECONDS_FROM_2000 && seconds <= SECONDS_TO_9999
      && (nanoseconds === undefined || (finite(nanoseconds) && nanoseconds >= 0 && nanoseconds < 1e9));
  }
  return false;
}

/** Scored: a recorded scoring timestamp, or a finite positive evaluation count. */
export function hasScoringEvidence(scoreState) {
  if (!scoreState || typeof scoreState !== 'object') return false;
  return isRecordedTimestamp(scoreState.lastScoredAt) || (finite(scoreState.evaluationCount) && scoreState.evaluationCount > 0);
}

const outcome = (kind, mine = null, theirs = null) => Object.freeze({ kind, mine, theirs });

/**
 * @param {{ status, gameMode, completionContext, resultUnavailable, finalEvidence, scoreState }} record
 * @returns {{ kind: string, mine: number|null, theirs: number|null }}
 */
export function deriveGameOutcome(record) {
  const r = record && typeof record === 'object' ? record : {};
  if (r.status !== 'completed') return outcome(OUTCOME_KINDS.ACTIVE);
  if (r.resultUnavailable === true) return outcome(OUTCOME_KINDS.NO_RESULT);
  const s = r.scoreState && typeof r.scoreState === 'object' ? r.scoreState : {};
  const scored = hasScoringEvidence(s);
  const mine = finite(s.currentScore) ? s.currentScore : null;
  const theirs = finite(s.opponentScore) ? s.opponentScore : null;

  if (r.gameMode === TOURNAMENT_GAME_MODE) {
    return r.completionContext === BANKED_CONTEXT && scored && mine !== null
      ? outcome(OUTCOME_KINDS.BANKED, mine)
      : outcome(OUTCOME_KINDS.NO_RESULT);
  }

  const pair = scored && mine !== null && theirs !== null;
  if (r.finalEvidence === true) {
    if (!pair) return outcome(OUTCOME_KINDS.NO_SCORE);
    if (mine > theirs) return outcome(OUTCOME_KINDS.WON, mine, theirs);
    if (mine < theirs) return outcome(OUTCOME_KINDS.LOST, mine, theirs);
    return outcome(OUTCOME_KINDS.DRAW, mine, theirs);
  }
  return pair ? outcome(OUTCOME_KINDS.ENDED, mine, theirs) : outcome(OUTCOME_KINDS.NO_RESULT);
}
