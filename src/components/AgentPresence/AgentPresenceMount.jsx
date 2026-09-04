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
//
// REACTIVITY (Battle View A3, D-91). AgentPresence has had a `reactivityLevel`
// since it shipped — 'reactive' (the default: rAF loop, breath, idle, mood
// glide) or 'static' (ONE painted frame, never joins the loop) — but this mount
// never exposed it, so every bound surface was reactive whether it wanted to be
// or not. The character pane needs the face STILL: it is the one persistent
// thing on the board, and a mark that breathes between checks reads as the
// agent doing something between checks, which the honesty rules forbid.
//
// Passing reactivityLevel="static" ALSO withholds `events`. The two are one
// decision, not two, so they are wired together here rather than left to each
// caller to remember: a static face cannot animate a reaction anyway
// (stage.react would fire into a stage with no loop to play it), and the duel
// binding's events come from statusFeedToEvents(statusFeed) — the RAW FEED,
// whose feed-only actions the tape is forbidden to render at all (D-88). A
// still face driven by events nobody can see is the exact mismatch the unread
// mark was fixed for in flip-prep.

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
  reactivityLevel = 'reactive',
  onDim,
  style,
}) {
  const { disposition, accent, standing, events } = useAgentPresence({ agent, surface, model, duel, command });
  // See the header note: 'static' means still AND deaf, by construction.
  const isStatic = reactivityLevel === 'static';
  return (
    <AgentPresence
      disposition={disposition}
      accent={accent}
      standing={standing}
      events={isStatic ? null : events}
      reactivityLevel={reactivityLevel}
      size={size}
      enableEnvironment={enableEnvironment}
      radial={radial}
      onDim={onDim}
      style={style}
    />
  );
}
