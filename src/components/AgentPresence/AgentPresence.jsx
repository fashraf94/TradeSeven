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
      // Seed the backlog the FIRST time we actually have events — the existing beats
      // are history (a mid-battle mount), not fresh reactions. Staying unseeded until
      // then means an empty-first-render (mount-before-data) can't later fire the whole
      // backlog as a reaction storm. Cost: if the presence mounts before ANY event, the
      // first batch is treated as backlog (at most one missed reaction — a safe under-react).
      if (list.length === 0) return;
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
      onDim={onDim}
      style={style}
    />
  );
}
