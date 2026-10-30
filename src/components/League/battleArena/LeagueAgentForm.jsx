// src/components/League/battleArena/LeagueAgentForm.jsx
//
// Agent form build S2 — one seat's agent form in a League game, behind AGENT_FORM_LEAGUE_ENABLED
// (src/config/agentFormFlags.js). The one renderer the League's sites share (FuseHero.jsx, ClimbArena.jsx). Loaded lazily,
// only with the flag on, through leagueAgentFormSlot.jsx (which says why).
//
//   the player     their battle's archetype, in the fixed teal of allegiance (R11);
//   a League CPU   its archetype in copper (R13): it is the CPU's real one, resolved from its id by the same function
//                  that wrote its agent document, and it ranks the board the CPU's six are drafted from;
//   a human rival  their archetype in copper (R14), from the spectator projection while the fuse polls it. Unknown or
//                  missing, a bare copper core.
// All through `seat.archId`, the code id (never `seat.arch`, the owner-only display label). Moods come only from what the
// screen already has (leagueAgentMood.js, R15). Growth is stage 1 (R7), plates batched (R2), the tight framing the battle
// forms use, and under 40 px a still (R12, in the wrapper). The form is decorative: the name and the score sit beside it.

import React, { use, useContext } from 'react';
import AgentForm from '../../AgentForm/AgentForm';
import { getAgentGrowth } from '../../AgentForm/agentGrowth';
import { deriveLeagueMood, standingOf } from '../../../screens/battleView/leagueAgentMood';
import useCoarseNow from '../../../screens/battleView/useCoarseNow';
import { LeagueAgentFormContext, LeagueStandingContext } from './leagueAgentFormSlot';

// The hub's outcome derivation, loaded beside this chunk rather than imported, for the reason BattleAgentForm.jsx gives:
// a static import reorders the hub's chunk with the flag off. If it fails to load, a finished game shows idle.
const outcomesLoaded = import('../../CommandCenter/hub/selectors/gameOutcome').catch(() => null);

export default function LeagueAgentForm({ seat, you = false, size, standing, facing, reducedMotion = false }) {
  const screen = useContext(LeagueAgentFormContext);
  const board = useContext(LeagueStandingContext);
  const outcomes = use(outcomesLoaded);
  const nowMs = useCoarseNow(true).getTime();
  const mood = deriveLeagueMood({ you, standing: standing ?? standingOf(board, seat?.id), battle: screen?.battle ?? null, nowMs, outcomes });
  const { coreStage, armorStage } = getAgentGrowth(null);
  return (
    <AgentForm
      archetype={seat?.archId ?? undefined}
      mood={mood}
      coreStage={coreStage}
      armorStage={armorStage}
      allegiance={you ? 'player' : 'opponent'}
      size={size}
      reducedMotion={reducedMotion}
      bloom="css"
      batched
      framing="tight"
      facing={facing}
      label={null}
    />
  );
}
