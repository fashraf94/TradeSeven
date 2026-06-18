// src/services/tournamentLobbyActions.js
//
// P10b — the client LOBBY mutation callers (Quick Play / Create / Join /
// Matchmake / Start now). The sibling of tournamentActions.js, same binding
// discipline (founder, P7-B):
//   • client-honest / server-authoritative — the server is the SOLE authority;
//   • never claim a join/form succeeded before the server confirms (every call
//     rejects on !res.ok — a caller reaches the success path only after a 2xx);
//   • surface the server's error shape, never swallow it (mapLobbyError maps
//     known codes to friendly copy and FALLS BACK to the server's own message —
//     it never hides a rule the server enforced, never invents one).
//
// MUTATIONS LIVE HERE, never in the reads-only tournamentGroupService.js (whose
// header forbids write calls). The lobby READ — subscribeMyLobby — is a read,
// so it lives there beside subscribeMyGroup. POSTs the Bearer ID token via
// fetchWithAuth.

import { fetchWithAuth } from '../utils/fetchWithAuth';

/**
 * POST a lobby action. Resolves to the parsed success body on 2xx; THROWS a
 * structured Error ({ status, code, message }) on any non-2xx — so no caller
 * ever sees a "joined/formed" the server didn't grant.
 */
async function postLobbyAction(path, body = {}) {
  const res = await fetchWithAuth(`/api/tournament/${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty/non-JSON body */ }
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data?.error || `http_${res.status}`;
    err.data = data; // preserve the server body (e.g. already_active's { groupId, status })
    throw err;
  }
  return data;
}

/**
 * Quick Play — the solo cold-start: the server opens a private lobby and forms
 * a CPU-padded group in one act. Resolves to { lobbyId, groupId, humanCount,
 * cpuNs }. The group then surfaces via subscribeMyGroup (the board flow opens).
 */
export function quickPlay({ displayName } = {}) {
  return postLobbyAction('lobby-quickplay', displayName ? { displayName } : {});
}

/**
 * Quick Play (Training) — League Next-Arc Slice 5b-i: the on-demand solo
 * training cold-start. The server forms a CPU-padded TRAINING pod on the
 * caller's RANKED-agent clone and opens the interactive draft. Resolves to
 * { groupId, ... }; the pod then surfaces via subscribeMyTrainingPod (re-entry)
 * and the caller is routed into the draft room. Rejects `no_agent` (no ranked
 * agent to clone) and `already_active` (the one-active-pod rule) — both mapped
 * to friendly copy below.
 */
export function quickPlayTraining({ displayName } = {}) {
  return postLobbyAction('lobby-quickplay-training', displayName ? { displayName } : {});
}

/**
 * Create a group — opens a waiting lobby (PRIVATE by default → a shareable join
 * code). Resolves to { lobbyId, lobby: { id, ..., joinCode? } }.
 */
export function createLobby({ displayName, mode } = {}) {
  const payload = {};
  if (displayName) payload.displayName = displayName;
  if (mode) payload.mode = mode;
  return postLobbyAction('lobby-create', payload);
}

/**
 * Join a specific lobby — by share-link `lobbyId` or typed `joinCode`. Resolves
 * to the join result + `formed` (non-null when this join sealed the 4th seat
 * and the group formed synchronously).
 */
export function joinLobby({ lobbyId, joinCode, displayName } = {}) {
  const payload = {};
  if (lobbyId) payload.lobbyId = lobbyId;
  if (joinCode) payload.joinCode = joinCode;
  if (displayName) payload.displayName = displayName;
  return postLobbyAction('lobby-join', payload);
}

/**
 * Matchmake — FIFO into the oldest open public lobby (or a fresh one). Resolves
 * to the join result + `created` + `formed` (non-null when it sealed the 4th).
 */
export function matchmakeJoin({ displayName } = {}) {
  return postLobbyAction('lobby-matchmake', displayName ? { displayName } : {});
}

/**
 * Start now — the creator pads the open seats with CPUs and forms the group.
 * Resolves to { groupId, humanCount, cpuNs, alreadyFormed }.
 */
export function formLobby({ lobbyId } = {}) {
  return postLobbyAction('lobby-form', { lobbyId });
}

// Known server error codes → friendly copy. ABSENT codes fall back to the
// server's own message (never hide a rule the server enforced).
const ERROR_COPY = Object.freeze({
  lobby_disabled: 'The League lobby isn’t open yet — check back soon.',
  lobby_full: 'That game just filled up — try another, or start your own.',
  lobby_not_open: 'That game has already started — find or start another.',
  lobby_not_found: 'That game could not be found — it may have already started.',
  lobby_cancelled: 'That game was cancelled.',
  code_not_found: 'No open game matched that code — double-check it with your host.',
  missing_target: 'Enter a game code or link to join.',
  invalid_lobby_id: 'That game link looks off — ask your host for a fresh one.',
  not_lobby_owner: 'Only the player who created this game can start it.',
  universe_unavailable: 'The market data isn’t ready yet — try again in a few minutes.',
  cpu_board_commit_failed: 'Couldn’t seat the CPU opponents — please try again.',
  // League Next-Arc Slice 5b-i — training quick-play guards.
  no_agent: 'Build your agent first — training drafts use a copy of your ranked agent.',
  already_active: 'You already have a training session in progress — resume it to keep going.',
});

/** Map a thrown lobby-action error to user copy; falls back to the server message. */
export function mapLobbyError(err) {
  if (!err) return 'Something went wrong — try again.';
  return ERROR_COPY[err.code] || err.message || 'Something went wrong — try again.';
}
