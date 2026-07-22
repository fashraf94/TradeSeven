// src/components/AgentPresence/AgentPresence.jsx
//
// Agent Presence — the mount-ready component. Surface-AGNOSTIC: it renders the face
// (via EnvStage) and drives it from three already-derived inputs:
//   • disposition — from the agent's archetype (pure map; see presenceBinding)
//   • accent      — the agent's DNA colour (agent.primaryColor / avatarColors[0])
//   • standing    — [-1..1], derived by the caller from the EXACT value the mounted
//                   surface's orb/scoreboard renders (Gate 1: no parallel recompute)
//   • events      — [{ id, ev, tier?, tone? }] transient reactions; only ids not seen
//                   before fire, so a mount never replays the backlog.
//   • reactivityLevel — 'reactive' (default; joins the shared rAF loop — breath, idle,
//                   mood glide) or 'static' (paints ONE frame, never joins the loop:
//                   no rAF, no idle, no breath). Static is the CPU-slot path and the
//                   seam to light a slot up later by flipping the level (finding 13).
//
// It writes NOTHING, gates NOTHING, and is removable without touching any scoring or
// decision path. Reduced-motion uses the house framer useReducedMotion() (the sibling
// AgentOrb respects reduced-motion via neither the CSS guard nor a hook — the presence
// must not inherit that gap).

import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { EnvStage } from './faceEnv';

const SEEN_CAP = 400; // bound the de-dup memory; well above any live beat backlog

export default function AgentPresence({
  disposition = 'neutral',
  accent = '#5EEAD4',
  standing = 0,
  events = null,
  size = 56,
  enableEnvironment = true,
  radial = false,
  reactivityLevel = 'reactive',
  onDim,
  style,
}) {
  const reduced = useReducedMotion();
  const stageRef = React.useRef(null);
  const seenRef = React.useRef(null);

  // Drive transient reactions from NEW events only. On the first pass we seed the
  // backlog as "seen" without reacting (the existing beats are history, not fresh
  // events) — otherwise a mount mid-battle would fire a reaction storm.
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const list = Array.isArray(events) ? events : [];
    if (seenRef.current === null) {
      // First effect run: seed WHATEVER is already present as backlog (no reactions).
      // A mid-battle mount thus starts with its history seeded (the beats/statusFeed the
      // surface already holds — mounts are gated on that data), while a fresh mount starts
      // with an empty seed and fires each event as it genuinely first appears. `events` is
      // always an array (beatsToEvents/statusFeedToEvents never return null), and these
      // streams accumulate incrementally, so there is no empty→large-backlog step to storm.
      seenRef.current = new Set(list.map((e) => e && e.id).filter((id) => id != null));
      return;
    }
    for (const e of list) {
      if (!e || e.id == null || seenRef.current.has(e.id)) continue;
      seenRef.current.add(e.id);
      stage.react(e.ev, { tier: e.tier, tone: e.tone });
    }
    if (seenRef.current.size > SEEN_CAP) {
      seenRef.current = new Set(list.map((e) => e && e.id).filter((id) => id != null));
    }
  }, [events]);

  return (
    <EnvStage
      ref={stageRef}
      disposition={disposition}
      accent={accent}
      standing={standing}
      size={size}
      enabled={enableEnvironment}
      radial={radial}
      reduced={reduced}
      reactivityLevel={reactivityLevel}
      onDim={onDim}
      style={style}
    />
  );
}
