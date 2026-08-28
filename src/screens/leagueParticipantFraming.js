// src/screens/leagueParticipantFraming.js
//
// Ranked (competitive) participant framing — the sibling of
// leagueTrainingBattleFraming.js. Pure, render-free, and importing only the
// zero-import constants module, so the transitive surface stays Node-clean and
// this stays unit-testable without the host's heavy client graph.
//
// WHY THIS MODULE EXISTS: the ranked host had no framing helper at all. Its
// header copy, its accent colour and its four body guards were a hand-rolled
// binary `isForming ? … : …` inlined across LeagueParticipantView, which is
// exactly the pattern that let a pre-open pod read "Battle week — your group
// drafted Monday" forty minutes before the bell. Threading a second condition
// through those four sites would have compounded that; one derivation, consumed
// once, cannot drift (BUILD_RULES §9).
//
// THE PRE-OPEN PHASE: a pod's status flips to BATTLE on a DATE-based predicate,
// so on its anchor date it is BATTLE from midnight while the market is shut. The
// status is correct and is not moved (the 9:25 ET claims pass and the
// orchestrator duty marker both need it set before the open) — only the display
// was wrong. `preOpen` comes from usePreOpenPhase, the one shared derivation.
//
// FLAG-OFF EQUIVALENCE: with `preOpen` false this collapses EXACTLY to the old
// binary — `showBattleBody` is `status !== FORMING` (the old `!isForming`), the
// tone is amber for forming and teal otherwise, and the copy is unchanged. The
// equivalence is asserted row-by-row in the suite.

import { GROUP_STATUS } from '../constants/leagueTournament';

/**
 * @param {string|undefined} status  the group's lifecycle status
 * @param {{preOpen?: boolean}} opts `preOpen` — BATTLE, but before the bell on
 *   the pod's own anchor date (usePreOpenPhase).
 * @returns {{phase:'forming'|'awaiting'|'live', tone:'pending'|'live', sub:string, showBattleBody:boolean}}
 */
export function participantStatusFraming(status, { preOpen = false } = {}) {
  if (status === GROUP_STATUS.FORMING) {
    return {
      phase: 'forming',
      tone: 'pending',
      sub: 'Group forming — commit your draft board before Monday\'s draft.',
      showBattleBody: false,
    };
  }
  // Ordered AFTER forming: a forming pod is never "pre-open on its battle day"
  // (the derivation is BATTLE-only), so this can only be reached by a real
  // pre-open battle day, and forming keeps its own copy either way.
  if (preOpen) {
    return {
      phase: 'awaiting',
      tone: 'pending',
      sub: 'Locked in — your battle week begins at the next market open.',
      showBattleBody: false,
    };
  }
  return {
    phase: 'live',
    tone: 'live',
    sub: 'Battle week — your group drafted Monday.',
    showBattleBody: true,
  };
}
