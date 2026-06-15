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
//     idiom) → the real adapter (useRealLeagueState). Fixtures remain the cold-
//     start fill: while reads settle, or when no real data exists, the fixture
//     world shows and `isFixtures` stays true (signal-capture stays gated off).
//     `isFixtures` flips to false only once real data is present.
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
  const real = useRealLeagueState(REAL_ENABLED, fixtures);

  // isFixtures === true means: do NOT persist signal-capture events (fixture-
  // driven spectate/follow/pod-tap must never seed the post-launch corpus).
  if (!REAL_ENABLED) {
    return { state: fixtures, loading: false, isFixtures: true };
  }
  // While reads settle, show fixtures (no flash) and keep signals gated off.
  if (real.loading || !real.state) {
    return { state: fixtures, loading: real.loading, isFixtures: true };
  }
  // Real data present → real state + signals un-gated; cold start (no real data)
  // → the adapter handed back the fixture fallback, so keep isFixtures true.
  return { state: real.state, loading: false, isFixtures: !real.hasRealData };
}
