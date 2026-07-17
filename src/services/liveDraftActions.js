// src/services/liveDraftActions.js
//
// Competitive Live Draft (Phase 4) — the client callers for the slot surface:
// the schedule read (picker feed) + claim/release (seat mutations). Same
// discipline as tournamentActions.js: client-honest / server-authoritative —
// throw a structured Error on any non-2xx so no caller sees a success the server
// didn't grant. Behind LEAGUE_LIVE_DRAFT (the endpoints 404 dark; the picker is
// gated on the same flag).

import { fetchWithAuth } from '../utils/fetchWithAuth';

async function callTournament(path, { method = 'POST', body = null } = {}) {
  const opts = { method };
  if (body != null) opts.body = JSON.stringify(body);
  const res = await fetchWithAuth(`/api/tournament/${path}`, opts);
  let data = {};
  try { data = await res.json(); } catch { /* empty/non-JSON */ }
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data?.error || `http_${res.status}`;
    throw err;
  }
  return data;
}

/** The week's slots with per-slot human counts + seated names (the picker feed). */
export function fetchSlotSchedule() {
  return callTournament('slot-schedule', { method: 'GET' });
}

/** Claim a seat in a slot's next occurrence. Returns { groupId, humanCount, … }. */
export function claimSlot({ slotId, displayName } = {}) {
  const body = { slotId };
  if (displayName) body.displayName = displayName;
  return callTournament('slot-claim', { body });
}

/** Release a seat pre-fire (the last human out deletes the group). */
export function releaseSlot({ groupId } = {}) {
  return callTournament('slot-release', { body: { groupId } });
}

// Known slot error codes → friendly copy; falls back to the server message.
const SLOT_ERROR_COPY = Object.freeze({
  unknown_slot: 'That draft slot isn’t on the schedule.',
  slot_full: 'That slot is full — all four seats are taken.',
  draft_already_started: 'That draft has already started — seats are locked.',
  live_draft_disabled: 'Live draft isn’t available right now.',
});

export function mapSlotActionError(err) {
  if (!err) return 'Something went wrong — try again.';
  return SLOT_ERROR_COPY[err.code] || err.message || 'Something went wrong — try again.';
}
