// src/hooks/useLeagueState.js
//
// The SINGLE data-access seam for the redesigned League surface. Every redesign
// surface (lobby, funnel, pod card, pod sheet, spectate) binds only here — never
// to Firestore directly — so wiring real data later is one layer, not scattered
// reads.
//
// FIXTURES-FIRST (founder decision): returns the typed fixture world
// (leagueState(fill)) matching the spec §4 contract. This is the ONE place a
// future task swaps fixtures for the real adapter mapping the existing read-model
// (subscribeBracket/subscribeGroup + useSpectatedTournamentBattles) onto the
// Pod/Seat/BookItem shapes. When that lands, `isFixtures` flips to false and the
// signal-capture seam is allowed to persist (corpus-safe gating, see Phase 4).
//
// Follows the repo hook convention (useMyTournamentBattle): a plain hook
// returning a small object, no throws.

import { useMemo } from 'react';
import { leagueState } from '../components/League/leagueFixtures';

const VALID_FILL = ['forming', 'filling', 'open'];

export default function useLeagueState(fill = 'open') {
  const safeFill = VALID_FILL.includes(fill) ? fill : 'open';
  const state = useMemo(() => leagueState(safeFill), [safeFill]);
  // isFixtures === true means: do NOT persist signal-capture events (fixture-
  // driven spectate/follow/pod-tap must never seed the post-launch corpus).
  return { state, loading: false, isFixtures: true };
}
