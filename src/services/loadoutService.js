// src/services/loadoutService.js
//
// Build A2 — the per-game loadout writers' thin clients (rulings D1, FD-1, FD-3). The same three authenticated
// endpoints agentService.js calls (change-archetype, equip-watchlist, unequip-watchlist), each with the `loadout` they
// set: 'baggerbomb' (the slot; no lock — the next deploy carries it) or 'league' (the ranked record; refused with
// 409 `league_locked` while the League week holds it, the lock and its end in `error.payload.lock`). A module of its
// own, not new arguments on agentService's functions, so nothing the flag-off build ships changes: only the hub's
// flagged loadout surfaces import it. Each throws agentService's one error shape (message, status, code, payload).

import { fetchWithAuth } from '../utils/fetchWithAuth';
import { toEquipError } from './agentService';

async function post(path, body) {
  const response = await fetchWithAuth(path, { method: 'POST', body: JSON.stringify(body) });
  if (!response.ok) throw await toEquipError(response);
  return response.json();
}

/** Set a loadout's archetype. Resolves with { agentId, archetype, idempotent, loadout? }. */
export const changeLoadoutArchetype = (agentId, archetype, loadout) => post('/api/agent/change-archetype', { agentId, archetype, loadout });

/** Set a loadout's book. Resolves with { agentId, equippedWatchlistId, equippedWatchlistName, idempotent, loadout? }. */
export const equipLoadoutBook = (agentId, watchlistId, loadout) => post('/api/agent/equip-watchlist', { agentId, watchlistId, loadout });

/** Clear a loadout's book ("No book · open market"). Resolves with { agentId, equippedWatchlistId: null, idempotent, loadout? }. */
export const unequipLoadoutBook = (agentId, loadout) => post('/api/agent/unequip-watchlist', { agentId, loadout });

/** A refusal because the League week holds the loadout (FD-3). */
export const isLeagueLock = (error) => error?.status === 409 && error?.code === 'league_locked';
