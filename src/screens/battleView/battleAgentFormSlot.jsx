// src/screens/battleView/battleAgentFormSlot.jsx
//
// Agent form build S1 (Scope B) — what the battle view's sites import for the agent forms, kept apart from the form
// itself. BattleAgentForm.jsx (the form, its moods, and through them the hub's outcome derivation) loads lazily, and
// only while AGENT_FORM_BATTLE_ENABLED is on: the declaration below is the literal ternary Rollup folds to `null` with
// the flag off, so the import() and everything behind it leave the bundle and the battle chunks stay byte-identical to
// main's (a static import of the form would reorder modules the hub chunk shares, even unused). This module imports
// only React and the form's own SVG still.
//
//   BattleAgentFormScope  AgentBattleScreen.jsx's scope around the three sites: the cockpit feed (null unless the
//                         cockpit runs) and the coarse clock, read as the cockpit reads it.
//   BattleAgentFormSlot   one form at a site: the lazy form, the still while its chunk loads — and the still for good
//                         if the chunk fails (a boundary of its own, so a failed load never takes the battle screen down).
//   duelScores            the pair the robot head is fed at these sites, as the mood's scores (BUILD_RULES §9).

import React, { Component, Suspense, createContext, lazy } from 'react';
import { AGENT_FORM_BATTLE_ENABLED } from '../../config/agentFormFlags';
import AgentFormStill from '../../components/AgentForm/AgentFormStill';

/** What the battle screen holds for the forms' moods: { cockpitFeed, nowMs }. */
export const BattleAgentFormContext = /* @__PURE__ */ createContext(null);

const LazyBattleAgentForm = AGENT_FORM_BATTLE_ENABLED ? lazy(() => import('./BattleAgentForm')) : null;

/** The screen's scope: its cockpit feed and its clock (AgentBattleScreen.jsx: `now instanceof Date ? now.getTime() : Date.now()`). */
export function BattleAgentFormScope({ cockpitFeed = null, now, children }) {
  const value = { cockpitFeed, nowMs: now instanceof Date ? now.getTime() : Date.now() };
  return <BattleAgentFormContext.Provider value={value}>{children}</BattleAgentFormContext.Provider>;
}

/**
 * The pair the robot head is fed at these sites — the selected comparison's pair (gated; none when it is
 * unavailable) or the screen's displayed scores — so a mood and the digits beside it never disagree. A parity row
 * holds this to each site's own `duel`.
 */
export function duelScores({ comparison, playerScore, opponentScore, agentBattle }) {
  if (comparison !== undefined) return comparison && comparison.available ? { player: comparison.pair[0], opponent: comparison.pair[1] } : null;
  return {
    player: playerScore ?? (agentBattle?.scoreState?.currentScore || 0),
    opponent: opponentScore ?? (agentBattle?.scoreState?.opponentScore || 0),
  };
}

/** A form whose chunk failed to load (a flaky connection, a stale deploy) shows its still; the screen goes on. */
class SlotBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** One form at a site, `size` px square: the form once its chunk is in, its still until then — or for good, if it fails. */
export function BattleAgentFormSlot({ size, side = 'player', ...props }) {
  const still = (
    <div aria-hidden="true" style={{ position: 'relative', width: size, height: size }}>
      <AgentFormStill size={size} opponent={side === 'opponent'} />
    </div>
  );
  return (
    <SlotBoundary fallback={still}>
      <Suspense fallback={still}>
        <LazyBattleAgentForm size={size} side={side} {...props} />
      </Suspense>
    </SlotBoundary>
  );
}
