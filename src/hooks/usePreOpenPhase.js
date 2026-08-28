// src/hooks/usePreOpenPhase.js
//
// PRE-OPEN PHASE — the ONE hook every pre-open routing site consumes.
//
// A pod's status flips to BATTLE on a DATE-based predicate, so from the anchor
// date's midnight until the 9:30 ET bell a pod is legitimately BATTLE while the
// market is shut. The status is correct and deliberately not moved (the 9:25 ET
// claims pass and the orchestrator duty marker both require it set before the
// open); only the DISPLAY was wrong. This hook is how a routing site asks "is
// this pod on its battle day but before the bell?".
//
// WHY A HOOK AND NOT A BARE PREDICATE (spec V2.1 R-5): the derivation is a
// function of wall-clock time, and nothing writes to the group doc at 9:30 — the
// AWAITING_OPEN -> BATTLE status write already happened hours earlier. So a bare
// predicate would be read once at render and never re-evaluated: a viewer sitting
// on the page at 9:30 would stay on the awaiting surface indefinitely, and the
// countdown would sit at "Opening..." forever. Binding the derivation to its own
// ticker HERE makes that failure unrepresentable — a site cannot consume the
// derivation without also getting the clock that flips it.
//
// The pure predicate stays in api/_utils/tournamentTime.js for tests and any
// non-React caller; this file is the thin React binding over it.

import { useEffect, useState } from 'react';
import { isPreOpenOnBattleDay } from '../../api/_utils/tournamentTime.js';
import { isPreOpenPhaseRoutingOn } from '../config/featureFlags';

// Cadence: the 9:30 transition must not be visibly late (spec: <=30s), and the
// hook runs on every mounted routing site, so it must stay cheap. 30s matches the
// existing claim-window timer in AwaitingOpenPodView.
export const PREOPEN_TICK_MS = 30_000;

/**
 * @param {{status?: string, startAnchor?: {anchorEtDate?: string}}|null} group
 * @returns {boolean} true while the group is BATTLE and pre-open on its anchor date.
 */
export default function usePreOpenPhase(group) {
  const [now, setNow] = useState(() => new Date());

  // Flag-off is a hard short-circuit evaluated FIRST: the derivation is never
  // consulted and the effect below never arms, so an off-flag site is
  // byte-equivalent to today — same routing AND the same render cadence (an
  // always-running timer would itself be a behavior change).
  const preOpen = isPreOpenPhaseRoutingOn() && isPreOpenOnBattleDay(group, now);

  // Tick ONLY while pre-open. Once the bell passes, `preOpen` goes false, this
  // effect tears the interval down, and it never re-arms for that pod: a BATTLE
  // pod's anchor is today-or-past, so the derivation is monotonic (true -> false).
  // A pod still AWAITING_OPEN arms nothing until its own status write arrives as a
  // snapshot and re-renders this hook with a BATTLE group.
  useEffect(() => {
    if (!preOpen) return undefined;
    const id = setInterval(() => setNow(new Date()), PREOPEN_TICK_MS);
    return () => clearInterval(id);
  }, [preOpen]);

  return preOpen;
}
