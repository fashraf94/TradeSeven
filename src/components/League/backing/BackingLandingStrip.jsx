// src/components/League/backing/BackingLandingStrip.jsx
//
// Backing Beta PR 4 — the strip's DATA-BOUND mount for the League landing
// (mobile: LeagueHome's lobby, under the entry center; desktop: the lobby's
// centre column, under the draft-slot picker and the Auto-draft card or under
// the seated hero — the desktop layouts build). Reads BACKING_BETA_ENABLED AT
// CALL TIME and renders NOTHING
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
//
// THE STRIP RE-READS (PRE-1 / N4, the desktop review record) — on exactly two
// moments, and never on a loop:
//   · a stake the server CONFIRMED (backingStakeSignal — the Backing screen
//     announces the stake route's success reply), so a strip left mounted
//     behind the Backing host moves from "not staked" to "staked";
//   · the earliest `closesAt` among the listed OPEN pools passing (one timer,
//     to that close plus a few seconds, cleared on unmount), so the strip
//     moves from open to closed — the read itself runs the server's lazy
//     close — without a reload. The instant is recomputed when EACH read
//     completes, success or failure, so a failed re-read never disarms the
//     closes after it (WIRE-R-1); and a pool a re-read still finds open —
//     a client clock ahead of the server's, a failed read — gets ONE
//     follow-up a minute after its close (WIRE-C1; the pre-flip fixes 2
//     review record). At most two reads per close; never a poll.
// The viewer's in-play pools need neither: they are live subscriptions.

import React, { useEffect, useMemo } from 'react';
import { BACKING_BETA_ENABLED } from '../../../config/featureFlags';
import useBackingPods from '../../../hooks/useBackingPods';
import useMyBacking from '../../../hooks/useMyBacking';
import BackingStrip, { DeskStripSlot } from './BackingStrip';
import { backingWeekKeys, backingWindow, deriveStripState, nextCloseRereadAt } from './backingStripState';
import { onStakePlaced } from './backingStakeSignal';

/** setTimeout's ceiling (2^31 − 1 ms, ~24.8 days): no backing close is further out than that. */
const MAX_TIMER_MS = 2147483647;

function LiveStrip({ uid, accent, onOpen, wide }) {
  const pods = useBackingPods(true);
  const { refresh } = pods;
  // PRE-1: a confirmed stake re-reads the pod list (its `myStakes` are the
  // strip's STAKED state for a listed pod).
  useEffect(() => onStakePlaced(() => refresh()), [refresh]);
  // N4: ONE timer, to the next re-read instant among the listed open pools —
  // recomputed as each read COMPLETES (success or failure: `loading` falls),
  // none while a read is in flight; cleared on unmount. An instant already
  // passed arms nothing (no loop).
  const rereadAt = useMemo(() => (pods.loading ? null : nextCloseRereadAt(pods.pods, Date.now())), [pods.pods, pods.loading]);
  useEffect(() => {
    if (rereadAt == null) return undefined;
    const delay = Math.max(0, rereadAt - Date.now());
    if (delay > MAX_TIMER_MS) return undefined;
    const timer = setTimeout(refresh, delay);
    return () => clearTimeout(timer);
  }, [rereadAt, refresh]);
  // The current battle week (in play or settling) and the window's week (a
  // committed stake on a pool closed at its fire) are both the viewer's
  // backing (DOM-1). Read each render, not memoised: the key rolls at Monday
  // 00:00 ET and the next render picks it up (DOM-NOTE-5).
  const inPlay = useMyBacking(uid, backingWeekKeys(new Date(), pods.data?.baseLayerWeek ?? null), Boolean(uid));
  const state = useMemo(() => deriveStripState({
    pods: pods.pods,
    inPlay,
    now: new Date(),
    backingWeekCloses: pods.data?.backingWeekCloses ?? null,
  }), [pods.pods, pods.data, inPlay]);
  // The window is the pod list's fact, not the strip state's (PLACE-1).
  const windowOpen = useMemo(() => backingWindow(pods.pods) != null, [pods.pods]);

  // Nothing to say yet (first load) or nothing reachable (the list failed):
  // no strip rather than a strip that guesses.
  if (pods.loading && !pods.data) return null;
  if (pods.error && !pods.data) return null;
  // The strip carries its own spacing on the mobile landing (the centre
  // column's flex gap spaces it on desktop), so a null render leaves no gap behind.
  if (wide) return <DeskStripSlot state={state} windowOpen={windowOpen} accent={accent} onOpen={onOpen} />;
  return (
    <div data-backing="strip-slot" style={{ marginBottom: 18 }}>
      <BackingStrip state={state} accent={accent} onOpen={onOpen} />
    </div>
  );
}

export default function BackingLandingStrip({ uid, accent, onOpen, wide = false }) {
  if (!BACKING_BETA_ENABLED) return null;
  return <LiveStrip uid={uid} accent={accent} onOpen={onOpen} wide={wide} />;
}
