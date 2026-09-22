// src/components/League/backing/BackingLandingStrip.jsx
//
// Backing Beta PR 4 — the strip's DATA-BOUND mount for the League landing
// (mobile: LeagueHome's lobby, under the entry center; desktop: the lobby's
// left rail). Reads BACKING_BETA_ENABLED AT CALL TIME and renders NOTHING
// while dark — no hook runs, no fetch opens, no subscription starts, no
// element mounts — so the flag-off landing is byte-identical to today
// (backingDark.test.jsx pins it).
//
// The outer component holds no hooks on purpose: a hook above the flag read
// would run while dark, and a flag read between hooks would break the hook
// order. The inner component owns the data and is mounted only when lit.
//
// THE NO-BRACKET FALLBACK (founder ruling, Sept 18): the strip is one element
// of fixed intent under the ranked-entry center; it reserves no space for a
// funnel, draws no frame for one, and moves nothing else on the landing. When
// a bracket exists, the landing's existing composition is unchanged by this
// mount (backingLanding.test.jsx pins the order of markers both ways).

import React, { useMemo } from 'react';
import { BACKING_BETA_ENABLED } from '../../../config/featureFlags';
import { currentBaseLayerWeek } from '../../../constants/leagueTournament';
import useBackingPods from '../../../hooks/useBackingPods';
import useMyBacking from '../../../hooks/useMyBacking';
import BackingStrip from './BackingStrip';
import { deriveStripState } from './backingStripState';

function LiveStrip({ uid, accent, onOpen, wide }) {
  const pods = useBackingPods(true);
  const weekKey = useMemo(() => currentBaseLayerWeek(new Date()), []);
  const inPlay = useMyBacking(uid, weekKey, Boolean(uid));
  const state = useMemo(() => deriveStripState({
    pods: pods.pods,
    inPlay,
    now: new Date(),
    backingWeekCloses: pods.data?.backingWeekCloses ?? null,
  }), [pods.pods, pods.data, inPlay]);

  // Nothing to say yet (first load) or nothing reachable (the list failed):
  // no strip rather than a strip that guesses.
  if (pods.loading && !pods.data) return null;
  if (pods.error && !pods.data) return null;
  // The strip carries its own spacing on the mobile landing (the rail's flex
  // gap spaces it on desktop), so a null render leaves no gap behind.
  return (
    <div data-backing="strip-slot" style={wide ? undefined : { marginBottom: 18 }}>
      <BackingStrip state={state} accent={accent} onOpen={onOpen} wide={wide} />
    </div>
  );
}

export default function BackingLandingStrip({ uid, accent, onOpen, wide = false }) {
  if (!BACKING_BETA_ENABLED) return null;
  return <LiveStrip uid={uid} accent={accent} onOpen={onOpen} wide={wide} />;
}
