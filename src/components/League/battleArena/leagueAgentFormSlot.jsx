// src/components/League/battleArena/leagueAgentFormSlot.jsx
//
// Agent form build S2 — what the League's sites import for the agent forms, kept apart from the form itself, as
// battleView/battleAgentFormSlot.jsx is: LeagueAgentForm.jsx (the form, its moods, and through them the hub's outcome
// derivation) loads lazily, and only while AGENT_FORM_LEAGUE_ENABLED is on. The declaration below is the literal ternary
// Rollup folds to `null` with the flag off, so the import() and everything behind it leave the bundle.
//
//   LeagueAgentFormScope   the live arena's scope (LeagueBattleArenaLive.jsx): the player's own battle document.
//   LeagueStandingContext  the fuse hero's board for its tips: its ranked seats, from deriveCut, the crown's own source.
//   LeagueAgentFormSlot    one seat's form: the lazy form, the still while its chunk loads, and the still for good if
//                          the chunk fails (a boundary of its own, so a failed load never takes the arena down).
//   FUSE_FORM_PX           the fuse hero's tips: a new kind of slot, four stacked seats, so sized for the armor to read.

import React, { Component, Suspense, createContext, lazy } from 'react';
import { AGENT_FORM_LEAGUE_ENABLED } from '../../../config/agentFormFlags';
import AgentFormStill from '../../AgentForm/AgentFormStill';

/** What the live arena holds for the forms' moods: { battle }. */
export const LeagueAgentFormContext = /* @__PURE__ */ createContext(null);
/** The fuse hero's board (leagueAgentMood.js standingOf): { ranked, cut, shown, complete }. */
export const LeagueStandingContext = /* @__PURE__ */ createContext(null);

const LazyLeagueAgentForm = AGENT_FORM_LEAGUE_ENABLED ? lazy(() => import('./LeagueAgentForm')) : null;

/** The live arena's scope: the player's own battle, the one place League holds a live evaluation lock. */
export function LeagueAgentFormScope({ battle = null, children }) {
  return <LeagueAgentFormContext.Provider value={{ battle }}>{children}</LeagueAgentFormContext.Provider>;
}

/**
 * The fuse hero's tips (CSS px): the player a size up, as the heads have always been. Four seats stack here, so S1's
 * header sizes do not fit; these are the largest that keep the value beside the head inside the reserved gutter
 * (fuseGeometry.js TIPROOM) and every seat live (ruling R12's 40 px floor). Measured at 320, 360, 390 and 1280 px.
 */
export const FUSE_FORM_PX = { compact: { you: 50, rival: 44 }, desktop: { you: 64, rival: 56 } };
/** A tip's form, `you` or a rival's. */
export function fuseFormPx(you, compact) {
  const px = FUSE_FORM_PX[compact ? 'compact' : 'desktop'];
  return you ? px.you : px.rival;
}

/**
 * How far apart bunched tips sit: a rival's form and 2 px. A short phone hero has less room than four forms want, so
 * there the gap gives way first, keeping the last seat inside the box (its figure fills under 90 % of its own, so forms
 * a few px closer than their boxes still clear each other).
 */
export function fuseFormGap(compact, h) {
  const { rival } = FUSE_FORM_PX[compact ? 'compact' : 'desktop'];
  if (!compact) return rival + 2;
  return Math.min(rival + 2, Math.floor((h - 48 - rival / 2) / 3));
}

/** A form whose chunk failed to load shows its still; the arena goes on. */
class SlotBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** One seat's form, `size` px square: the form once its chunk is in, its still until then, or for good if it fails. */
export function LeagueAgentFormSlot({ size, you = false, ...props }) {
  const still = (
    <div aria-hidden="true" style={{ position: 'relative', width: size, height: size }}>
      <AgentFormStill size={size} opponent={!you} />
    </div>
  );
  return (
    <SlotBoundary fallback={still}>
      <Suspense fallback={still}>
        <LazyLeagueAgentForm size={size} you={you} {...props} />
      </Suspense>
    </SlotBoundary>
  );
}
