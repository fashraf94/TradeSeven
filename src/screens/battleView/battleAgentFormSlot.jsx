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
//                         cockpit runs).
//   BattleAgentFormSlot   one form at a site: the lazy form, the still while its chunk loads — and the still for good
//                         if the chunk fails (a boundary of its own, so a failed load never takes the battle screen down).
//   duelScores            the pair the robot head is fed at these sites, as the mood's scores (BUILD_RULES §9).
//   BATTLE_FORM_PX        each site's form box, and how far it overhangs the room the layout gives it (the S1 size
//                         follow-up); arenaFormBox, the arena header's box as a style.

import React, { Component, Suspense, createContext, lazy } from 'react';
import { AGENT_FORM_BATTLE_ENABLED } from '../../config/agentFormFlags';
import AgentFormStill from '../../components/AgentForm/AgentFormStill';

/** What the battle screen holds for the forms' moods: { cockpitFeed }. */
export const BattleAgentFormContext = /* @__PURE__ */ createContext(null);

const LazyBattleAgentForm = AGENT_FORM_BATTLE_ENABLED ? lazy(() => import('./BattleAgentForm')) : null;

/** The screen's scope: its cockpit feed. The forms keep their own clock (BattleAgentForm.jsx, ruling R21). */
export function BattleAgentFormScope({ cockpitFeed = null, children }) {
  return <BattleAgentFormContext.Provider value={{ cockpitFeed }}>{children}</BattleAgentFormContext.Provider>;
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

/**
 * The forms' boxes at the three sites (CSS px), each with its overhang: how far the box reaches past the room the
 * layout gives it (its footprint, the box less the overhang). Every box keeps 2 px clear of the screen's edge, the name
 * and the score, and the bar (the S1 size follow-up; measured in headless Edge, the S1 report §11).
 *   arena    the header's two forms; `outer` is the screen's side (the player's left, the CPU's right), `inner` the
 *            name's. Phone: 60 px in today's 40 px wide footprint, so a long score keeps its room; the row grows 5 px.
 *            Desktop: 88 px in today's 72 px wide footprint; the row grows 14 of the 16 allowed. The founder's ruling
 *            (October 29, 2026): 88, not 90, because under 90 px the engine still brightens a small form's plate
 *            edges (×1.4) and rims (×1.5); at 90 the plates drew about 5 % dimmer (the S1 report §11.2).
 *   pane     the pane header's form, over today's 36 px box (PANE_FACE_PX), so the header's fixed cost and the F2
 *            thresholds that read it stand.
 *   mark     the floating mark's form; the tap target grows with it past 48.
 */
export const BATTLE_FORM_PX = {
  arena: { phone: { box: 60, outer: 14, inner: 6, top: 8, bottom: 4 }, desktop: { box: 88, outer: 8, inner: 8, top: 12, bottom: 6 } },
  pane: { box: 50 },
  mark: { phone: 50, desktop: 55 },
};

/** The arena header's form box for one side, as a style: its size, and its overhang as negative margins. */
export function arenaFormBox(isDesktop, side = 'player') {
  const { box, outer, inner, top, bottom } = BATTLE_FORM_PX.arena[isDesktop ? 'desktop' : 'phone'];
  const [left, right] = side === 'opponent' ? [inner, outer] : [outer, inner];
  return { width: box, height: box, margin: `${-top}px ${-right}px ${-bottom}px ${-left}px`, flexShrink: 0 };
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
