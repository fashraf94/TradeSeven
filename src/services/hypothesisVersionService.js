// src/services/hypothesisVersionService.js
//
// Pilot P1a — the Forge client for the player's versioned idea records
// (api/forge/watchlists/[id]/hypothesis-versions.js and
// hypothesis-transition.js). A sibling of forgeWatchlistService.js, kept
// separate so that module's existing consumers and mocks are untouched.
//
// Every call throws on a non-2xx response. The thrown Error carries `status`
// (HTTP code), `code` (the API's `error` string) and `body` (the parsed
// response) so the panel can branch — `code === 'disabled'` means the gate
// resolved off for this player, and the panel renders nothing.

import { fetchWithAuth } from '../utils/fetchWithAuth';

const base = (watchlistId) => `/api/forge/watchlists/${encodeURIComponent(watchlistId)}`;

async function toError(response) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    // non-JSON error body — fall back to the status line
  }
  const err = new Error(data.message || `Request failed (${response.status})`);
  err.status = response.status;
  err.code = data.error || 'request_failed';
  err.body = data;
  return err;
}

async function send(url, init) {
  const response = await fetchWithAuth(url, init);
  if (!response.ok) throw await toError(response);
  return response.json();
}

/** A request id for one create / reaffirm attempt (reused on retry, so a double submit is idempotent). */
export function newOpId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The list's versions, newest first: { watchlistId, currentVersion, versions[] }. */
export function listHypothesisVersions(watchlistId) {
  return send(`${base(watchlistId)}/hypothesis-versions`, { method: 'GET' });
}

/**
 * Write a new version in draft (a list's first idea, or "save as a new
 * version"). `horizonEnum` is sent only when the player picked one.
 */
export function createHypothesisVersion(watchlistId, { opId, expectedVersion, statement, horizonEnum }) {
  const body = { opId, expectedVersion, statement, ...(horizonEnum !== undefined ? { horizonEnum } : {}) };
  return send(`${base(watchlistId)}/hypothesis-versions`, { method: 'POST', body: JSON.stringify(body) });
}

/** One move on a version: ready | wait | reject | cancel | retire. */
export function transitionHypothesis(watchlistId, { version, action, expectedStatus, missingEvidence }) {
  const body = { version, action, expectedStatus, ...(missingEvidence !== undefined ? { missingEvidence } : {}) };
  return send(`${base(watchlistId)}/hypothesis-transition`, { method: 'POST', body: JSON.stringify(body) });
}

/** Reaffirm a review-due version: a fresh version in ready, same or edited content. */
export function reaffirmHypothesis(watchlistId, { version, opId, expectedVersion, statement, horizonEnum }) {
  const body = {
    version, action: 'reaffirm', opId, expectedVersion,
    ...(statement !== undefined ? { statement } : {}),
    ...(horizonEnum !== undefined ? { horizonEnum } : {}),
  };
  return send(`${base(watchlistId)}/hypothesis-transition`, { method: 'POST', body: JSON.stringify(body) });
}
