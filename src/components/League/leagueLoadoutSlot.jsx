// src/components/League/leagueLoadoutSlot.jsx
//
// Build A2 — what the League lobby's sites import for board 3's loadout lines, kept apart from the lines themselves, as
// leagueAgentFormSlot.jsx keeps the forms: LeagueLoadoutLine.jsx (which reaches the hub's copy, names, dates and the
// set's still) loads lazily, and only while PER_GAME_LOADOUT_ENABLED and AGENT_FORM_ARMORY_ENABLED are both on. The
// declarations below are literal ternaries Rollup folds to `null` with either flag off, so the import() and everything
// behind it leave the bundle and the League's chunks keep main's bytes. While the line's chunk loads, nothing shows.

import React, { Suspense, lazy } from 'react';
import { AGENT_FORM_ARMORY_ENABLED } from '../../config/agentFormFlags';
import { PER_GAME_LOADOUT_ENABLED } from '../../config/perGameLoadoutFlags';

const LazyLeagueLine = PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED
  ? lazy(() => import('./LeagueLoadoutLine').then((m) => ({ default: m.LeagueLoadoutLine })))
  : null;
const LazyTrainingLine = PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED
  ? lazy(() => import('./LeagueLoadoutLine').then((m) => ({ default: m.TrainingLoadoutLine })))
  : null;

/** The League tab's loadout line (LeagueLoadoutLine.jsx), loaded lazily. */
export function LeagueLoadoutSlot(props) {
  return (
    <Suspense fallback={null}>
      <LazyLeagueLine {...props} />
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
