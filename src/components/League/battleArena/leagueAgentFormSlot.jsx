// src/components/League/battleArena/leagueAgentFormSlot.jsx
//
// Agent form build S2 — what the League's sites import for the agent forms, kept apart from the form itself, as
// battleView/battleAgentFormSlot.jsx is: LeagueAgentForm.jsx (the form, its moods, and through them the hub's outcome
// derivation) loads lazily, and only while AGENT_FORM_LEAGUE_ENABLED is on. The declaration below is the literal ternary
// Rollup folds to `null` with the flag off, so the import() and everything behind it leave the bundle.
//
//   LeagueAgentFormScope   a screen's scope: the live arena's (LeagueBattleArenaLive.jsx), or the lobby preview's.
//   LeagueStandingContext  the fuse hero's board for its tips: its ranked seats, from deriveCut, the crown's own source.
//   LeagueAgentFormSlot    one seat's form: the lazy form, the still while its chunk loads, and the still for good if
//                          the chunk fails (a boundary of its own, so a failed load never takes the arena down).
// The tips' sizes and where they sit are fuseFormLayout.js.

import React, { Component, Suspense, createContext, lazy } from 'react';
import { AGENT_FORM_LEAGUE_ENABLED } from '../../../config/agentFormFlags';
import AgentFormStill from '../../AgentForm/AgentFormStill';

/** What a screen holds for its forms (LeagueAgentFormScope). */
export const LeagueAgentFormContext = /* @__PURE__ */ createContext(null);
/** The fuse hero's board (leagueAgentMood.js standingOf): { ranked, cut, shown, complete }. */
export const LeagueStandingContext = /* @__PURE__ */ createContext(null);

const LazyLeagueAgentForm = AGENT_FORM_LEAGUE_ENABLED ? lazy(() => import('./LeagueAgentForm')) : null;

/**
 * What a screen hands its forms.
 * @param {object} [props.battle]        the player's own battle, the one place League holds a live evaluation lock
 * @param {string} [props.groupId]       the group, for the after-bell read of human rivals' armor (finishedRivalRead.js)
 * @param {number} [props.youRank]       the player's rank as the screen prints it ("You advanced"), for the final verdict
 * @param {string} [props.youArchetype]  the player's archetype, where the seat has none (the lobby preview reads no battle)
 */
export function LeagueAgentFormScope({ battle = null, groupId = null, youRank = null, youArchetype = null, children }) {
  return <LeagueAgentFormContext.Provider value={{ battle, groupId, youRank, youArchetype }}>{children}</LeagueAgentFormContext.Provider>;
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
