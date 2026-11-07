// src/components/League/leagueLoadoutSlot.jsx
//
// Build A2 — what the League lobby's sites import for board 3's loadout lines, kept apart from the lines themselves, as
// leagueAgentFormSlot.jsx keeps the forms: LeagueLoadoutLine.jsx (which reaches the hub's copy, names, dates and the
// set's still) loads lazily, and only while PER_GAME_LOADOUT_ENABLED and AGENT_FORM_ARMORY_ENABLED are both on. The
// declarations below are literal ternaries Rollup folds to `null` with either flag off, so the import() and everything
// behind it leave the bundle and the League's chunks keep main's bytes. While the line's chunk loads, nothing shows.
//
// The fix pass (review A2R-1): whether the lobby's group read has ANSWERED reaches the line as `groupKnown`, through
// LeagueGroupKnownContext — the lobbies' own readiness (`seatKnown`, less a failed read), provided around the existing
// lobby element in a folded ternary, because a new prop on LobbyTabbed or DeskLobby would change the flag-off bytes. A
// lobby that provides nothing reads `false`: the line shows Checking, never an open week it was not told about.

import React, { Suspense, createContext, lazy, use } from 'react';
import { AGENT_FORM_ARMORY_ENABLED } from '../../config/agentFormFlags';
import { PER_GAME_LOADOUT_ENABLED } from '../../config/perGameLoadoutFlags';

const LazyLeagueLine = PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED
  ? lazy(() => import('./LeagueLoadoutLine').then((m) => ({ default: m.LeagueLoadoutLine })))
  : null;
const LazyTrainingLine = PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED
  ? lazy(() => import('./LeagueLoadoutLine').then((m) => ({ default: m.TrainingLoadoutLine })))
  : null;

/** Has the lobby's group read answered for this player (a group, or none)? `false` until it has, and after a failure. */
export const LeagueGroupKnownContext = PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED
  ? /* @__PURE__ */ createContext(false)
  : null;

/** The League tab's loadout line (LeagueLoadoutLine.jsx), loaded lazily, told whether the group read has answered. */
export function LeagueLoadoutSlot(props) {
  const groupKnown = use(LeagueGroupKnownContext) === true;
  return (
    <Suspense fallback={null}>
      <LazyLeagueLine {...props} groupKnown={groupKnown} />
    </Suspense>
  );
}

/** The Training tab's line (LeagueLoadoutLine.jsx TrainingLoadoutLine), loaded lazily. */
export function TrainingLoadoutSlot(props) {
  return (
    <Suspense fallback={null}>
      <LazyTrainingLine {...props} />
    </Suspense>
  );
}
