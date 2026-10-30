// src/components/League/battleArena/finishedRivalRead.js
//
// Agent form build S2, founder ruling 4 of Oct 30, 2026 — human rivals keep their armor after the bell. While a game runs,
// useSpectatedTournamentBattles polls their public agent context; once it ends that poll stops, so a finished game opened
// fresh has no archetype for them. This reads it once for the whole group, through the same endpoint, and never again: a
// finished game's archetypes do not change. Loaded only from LeagueAgentForm.jsx's lazy chunk.
//
// Unknown stays a bare copper core. A failed read answers an empty map and stays answered until the page reloads, so a
// form that reads this while it renders can never turn a failure into a retry loop.

import { fetchWithAuth } from '../../../utils/fetchWithAuth';

const reads = new Map();

async function read(groupId) {
  try {
    const res = await fetchWithAuth(`/api/tournament/battle-view?groupId=${encodeURIComponent(groupId)}`);
    const { battles } = await res.json();
    return Object.fromEntries(Object.entries(battles || {}).map(([id, battle]) => [id, battle?.agentContext?.archetype ?? null]));
  } catch {
    return {};
  }
}

/** The group's archetypes by seat, one read per group however many forms ask. The same promise each time, for use(). */
export function finishedRivalArchetypes(groupId) {
  if (!reads.has(groupId)) reads.set(groupId, read(groupId));
  return reads.get(groupId);
}
