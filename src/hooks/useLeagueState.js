// src/hooks/useLeagueState.js
//
// The SINGLE data-access seam for the redesigned League surface. Every redesign
// surface (lobby, funnel, pod card, pod sheet, spectate) binds only here — never
// to Firestore directly — so wiring real data later is one layer, not scattered
// reads.
//
// GATED SEAM (League Next-Arc Phase 1): the real adapter maps the System-1
// read-model (subscribeMyGroup / subscribeBracket / subscribeBaseLayerGroups +
// useSpectatedTournamentBattles, with dailyScores composites) onto the
// Pod/Seat/BookItem shapes — behind the LEAGUE_NEXT_ARC_ENABLED sub-flag.
//
//   • flag OFF (default) AND no dev param → returns the typed fixture world
//     (leagueState(fill)); the live lobby stays BYTE-IDENTICAL to today.
//   • flag ON, or the dev preview param ?leagueRealData=1 (the ?leagueRedesign=1
//     idiom) → the real adapter (useRealLeagueState) is the SOLE source of truth.
//     No fixture data ever renders under the real adapter: absent sections show
//     their honest empty states (empty funnel, empty field, pre-season hero),
//     even while reads settle and even at cold start. `isFixtures` stays true
//     until real data is present (signal-capture stays gated off), then flips
//     false — but it no longer means "the demo is showing".
//
// Follows the repo hook convention (useMyTournamentBattle): a plain hook
// returning a small object, no throws. Do NOT flip the flag here (PR #510 lesson).

import { useMemo } from 'react';
import { leagueState } from '../components/League/leagueFixtures';
import { LEAGUE_NEXT_ARC_ENABLED } from '../config/featureFlags';
import useRealLeagueState from './useRealLeagueState';

const VALID_FILL = ['forming', 'filling', 'open'];

// Module-constant gate (stable for the session, so the hook call order never
// changes): the sub-flag OR the dev preview param.
const SP = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
const REAL_ENABLED = LEAGUE_NEXT_ARC_ENABLED || SP.get('leagueRealData') === '1';

export default function useLeagueState(fill = 'open') {
  const safeFill = VALID_FILL.includes(fill) ? fill : 'open';
  const fixtures = useMemo(() => leagueState(safeFill), [safeFill]);
  // Always called (hook-order stable); no-ops entirely when REAL_ENABLED is false.
  const real = useRealLeagueState(REAL_ENABLED);

  // isFixtures === true means: do NOT persist signal-capture events (fixture-
  // driven spectate/follow/pod-tap must never seed the post-launch corpus).
  if (!REAL_ENABLED) {
    return { state: fixtures, loading: false, isFixtures: true };
  }
  // Real adapter on → the real, honest state (never the demo), even while reads
  // settle: absent sections render their designed honest-empty states, so there
  // is no reason to mask the settle with fixtures. `!real.state` only when the
  // adapter is disabled (can't happen here) — kept as a defensive guard.
  if (!real.state) {
    return { state: fixtures, loading: real.loading, isFixtures: true };
  }
  // Real state; signals un-gate only once real data is actually present.
  return { state: real.state, loading: real.loading, isFixtures: !real.hasRealData };
}
