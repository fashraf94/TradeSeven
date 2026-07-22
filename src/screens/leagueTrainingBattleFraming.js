// src/screens/leagueTrainingBattleFraming.js
//
// League Training Slice 5a — pure, render-free framing helpers for the training
// battle-view host (LeagueTrainingBattleView). Kept in their own module so they
// stay unit-testable WITHOUT pulling the view's heavy client graph (Flat6's
// framer-motion + WebSocket prices, ClaimFlipWindow's Firestore subscriptions)
// into the Node test env. Imports only the zero-import constants module, so the
// transitive surface stays Node-clean.

import { GROUP_STATUS, getWeeklyComposite, getWeeklyScore, round2 } from '../constants/leagueTournament';

// Practice-framed header copy per pod status. The training pod runs the SAME
// mechanics as a ranked pod (agent + 1.5× user composite), but it is a no-stakes
// rehearsal — the framing makes that honest at the view level (we do NOT edit the
// shared Flat6BattleView, whose internal "score of record" wording is reframed by
// the practice banner).
export function trainingStatusFraming(status) {
  switch (status) {
    case GROUP_STATUS.AWAITING_OPEN:
      return {
        label: 'Practice pod · awaiting open',
        sub: 'Locked in — your five-day practice battle begins at the next market open.',
      };
    case GROUP_STATUS.BATTLE:
      return {
        label: 'Practice pod · live',
        sub: 'Practice battle underway — five days against CPU opponents.',
      };
    case GROUP_STATUS.COMPLETE:
      return {
        label: 'Practice pod · complete',
        sub: 'Practice run banked — nothing fed to the leaderboard or the bracket.',
      };
    case GROUP_STATUS.EXPIRED: // Training-Pod P0 R2: retired pre-BATTLE, honest terminal copy
      return {
        label: 'Practice pod · expired',
        sub: 'This practice pod was retired before its battle started — start a new one any time.',
      };
    default:
      return {
        label: 'Practice pod',
        sub: 'A no-stakes rehearsal of the League format against CPU opponents.',
      };
  }
}

// The composite context Flat6BattleView consumes — identical derivation to the
// ranked LeagueParticipantView (getWeeklyComposite/getWeeklyScore, the 1.5×
// weighting lives in computeComposite). Null when we can't identify the player.
export function deriveCompositeContext(pod, uid) {
  if (!pod || !uid) return null;
  return {
    composite: round2(getWeeklyComposite(pod, uid)),
    userPoints: round2(getWeeklyScore(pod, uid)),
  };
}
