// src/components/AgentPresence/AgentPresenceMount.jsx
//
// The BOUND mount: calls the read-only useAgentPresence hook (which consumes the
// surface's already-resolved agent + rendered state) and renders <AgentPresence>.
// Surfaces gate this behind isAgentPresenceOn() so the hook NEVER runs flag-off (the
// wrapper is simply not mounted) — flag-off stays byte-identical.
//
//   {isAgentPresenceOn() && (
//     <AgentPresenceMount surface="duel" agent={agentBattle}
//       duel={{ playerScore, opponentScore, statusFeed }} size={44} />
//   )}

import React from 'react';
import AgentPresence from './AgentPresence';
import { useAgentPresence } from './useAgentPresence';

export default function AgentPresenceMount({
  surface,
  agent = null,
  model = null,
  duel = null,
  command = null,
  size = 56,
  enableEnvironment = true,
  radial = false,
  onDim,
  style,
}) {
  const { disposition, accent, standing, events } = useAgentPresence({ agent, surface, model, duel, command });
  return (
    <AgentPresence
      disposition={disposition}
      accent={accent}
      standing={standing}
      events={events}
      size={size}
      enableEnvironment={enableEnvironment}
      radial={radial}
      onDim={onDim}
      style={style}
    />
  );
}
