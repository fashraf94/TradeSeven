// src/screens/battleView/BattleAgentForm.jsx
//
// Agent form build S1 (Scope B) — an agent form in a BaggerBomb 1v1 battle, behind AGENT_FORM_BATTLE_ENABLED
// (src/config/agentFormFlags.js), inside the character-pane gates. It takes the robot head's place at the three sites
// that draw it (the arena header, the character pane's header, the floating mark), and the header's CPU side gains
// the opponent's. Loaded lazily, only with the flag on, through battleAgentFormSlot.jsx (which says why).
//
//   side 'player'    the battle's archetype (agentContext.archetype — the field the battle carries) in its armor, in
//                    the fixed teal of allegiance (R11);
//   side 'opponent'  the 1v1 CPU, which has no style: a bare core in copper, mirrored, facing the player (R9).
// Moods come from real signals only (agentMood.js deriveAgentMood; rulings R8, R9). Ruling R8 supersedes, for this
// form only, the face's "it never moves between events" (CharacterAvatar.jsx) and the dropped win/loss state
// (presenceBinding.js): it idles gently, and celebrates a won battle. Growth is stage 1 (R7). Batched plates (R2).
// A form drawn under 40 px is a still (R12, in the wrapper). Reduced motion is the screen's one source. The labels do
// not change in this build (R10): the agent's name and "CPU" stay beside the forms, so the form itself is decorative.

import React, { use, useContext } from 'react';
import AgentForm from '../../components/AgentForm/AgentForm';
import { getAgentGrowth } from '../../components/AgentForm/agentGrowth';
import { deriveAgentMood } from './agentMood';
import { BattleAgentFormContext } from './battleAgentFormSlot';

// The hub's outcome derivation (ruling R8: celebrating comes from it), loaded beside this chunk rather than imported.
// Rollup orders modules before it tree-shakes, and it reaches this file even with the flag off (the slot's folded
// import() is still in the module graph): a static import here put hub/selectors/gameOutcome.js into the battle view's
// part of that order first and moved it within the hub's chunk, so the flag-off hub chunk was no longer main's. One
// import() deeper, the hub claims the module's place first. use() waits for it under the slot's Suspense. If it fails to
// load, the form goes on without it: deriveAgentMood then shows a completed battle as idle, never a claimed win.
const outcomesLoaded = import('../../components/CommandCenter/hub/selectors/gameOutcome').catch(() => null);

export default function BattleAgentForm({ agentBattle, side = 'player', size, scores = null, reducedMotion = false }) {
  const held = useContext(BattleAgentFormContext);
  const outcomes = use(outcomesLoaded);
  const opponent = side === 'opponent';
  const mood = deriveAgentMood({ battle: agentBattle, cockpitFeed: held?.cockpitFeed ?? null, side, scores, nowMs: held?.nowMs, outcomes });
  const { coreStage, armorStage } = getAgentGrowth(null);
  return (
    <AgentForm
      archetype={opponent ? undefined : agentBattle?.agentContext?.archetype}
      mood={mood}
      coreStage={coreStage}
      armorStage={armorStage}
      allegiance={opponent ? 'opponent' : 'player'}
      size={size}
      reducedMotion={reducedMotion}
      bloom="css"
      batched
      label={null}
    />
  );
}
