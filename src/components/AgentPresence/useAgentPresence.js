// src/components/AgentPresence/useAgentPresence.js
//
// Agent Presence — the ONE shared read-only hook that feeds every presence mount.
// It SUBSCRIBES TO NOTHING: it consumes the agent identity + the rendered battle state
// the mounted surface ALREADY holds, and returns the four presence inputs
// ({ disposition, accent, standing, events }). Because it adds no agent-doc read, it
// cannot change what any surface resolves (Gate 2 — the odUserId-vs-uid key is never
// touched here; each surface passes its own already-resolved `agent`). And because
// standing derives from the surface's rendered value via the pure binding, it never
// re-runs the scorer (Gate 1).
//
// Per-surface inputs:
//   • surface: 'league' — pass { model } (the useArenaModel output the dock renders):
//       standing ← standingFromRank(model.youRank, seatCount); events ← model.beats.
//   • surface: 'duel'   — pass { duel: { playerScore, opponentScore, statusFeed } }
//       (the AgentBattleScreen's displayPlayerScore/displayOpponentScore + statusFeed).
//   • surface: 'command'— pass { command: { reading } } (useDailyRegimeBrief().loading):
//       identity only — standing is a HONEST neutral (no live battle score at the
//       identity orb), with a one-shot 'reading' reaction on each brief fetch.

import { useMemo, useRef } from 'react';
import {
  archetypeToDisposition,
  resolveAccent,
  standingFromRank,
  standingFromDuel,
  beatsToEvents,
  statusFeedToEvents,
} from './presenceBinding';

const seatCountOf = (model) => (Array.isArray(model?.seats) ? model.seats.length : 0);
const youSeatArch = (model) => (Array.isArray(model?.seats) ? model.seats.find((s) => s?.you)?.arch : undefined);

export function useAgentPresence({ agent, surface, model, duel, command } = {}) {
  // Identity + standing are cheap primitive derivations — computed inline (no memo) so
  // they never over-run or trip exhaustive-deps. Disposition falls back to the your-seat
  // archetype label the arena carries when the surface has no agent doc (the league dock).
  const disposition = archetypeToDisposition(agent?.archetype ?? (surface === 'league' ? youSeatArch(model) : undefined));
  const accent = resolveAccent(agent);
  let standing = 0; // command / identity — honest neutral (no live battle standing here)
  if (surface === 'league') standing = standingFromRank(model?.youRank, seatCountOf(model));
  else if (surface === 'duel') standing = standingFromDuel(duel?.playerScore, duel?.opponentScore);

  // 'reading' rising-edge (command surface): one reaction per brief fetch. Deriving an
  // edge via refs during render is deterministic and StrictMode-idempotent (the second
  // render sees prev already updated, so it does not double-count). `readingActive` is a
  // real dependency of the events memo below (it gates the emitted event).
  const readSeqRef = useRef(0);
  const prevReadingRef = useRef(false);
  const readingActive = surface === 'command' && !!command?.reading;
  if (surface === 'command') {
    if (readingActive && !prevReadingRef.current) readSeqRef.current += 1;
    prevReadingRef.current = readingActive;
  }

  // Events are memoized (stable identity when inputs are unchanged) so AgentPresence's
  // reaction effect only runs when the beat/feed stream actually changes.
  const beats = model?.beats;
  const statusFeed = duel?.statusFeed;
  const events = useMemo(() => {
    if (surface === 'league') return beatsToEvents(beats);
    if (surface === 'duel') return statusFeedToEvents(statusFeed);
    if (surface === 'command') {
      return readingActive ? [{ id: `reading:${readSeqRef.current}`, ev: 'reading', tier: 1 }] : null;
    }
    return null;
  }, [surface, beats, statusFeed, readingActive]);

  return { disposition, accent, standing, events };
}

export default useAgentPresence;
