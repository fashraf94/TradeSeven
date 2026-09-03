// src/services/forgeWatchlistService.js
//
// Sprint 6 Phase 4B — frontend client for the forge watchlist endpoints.
// Wraps fetchWithAuth so the editor and its hooks never touch fetch
// directly. Modeled on src/services/aiStrategyService.js.
//
// Every call throws on a non-2xx response. The thrown Error carries `status`
// (HTTP code) and `code` (the API's `error` string) so callers can branch
// without re-parsing the response.

import { fetchWithAuth } from '../utils/fetchWithAuth';

const BASE = '/api/forge/watchlists';

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
  return err;
}

/**
 * Load a single watchlist. Returns the watchlist document.
 */
export async function getWatchlist(id) {
  const response = await fetchWithAuth(`${BASE}/${id}`, { method: 'GET' });
  if (!response.ok) throw await toError(response);
  const data = await response.json();
  return data.watchlist;
}

/**
 * Patch editable fields on a draft watchlist. `fields` is a partial subset of
 * { name, notes, thesis, activationConditions, invalidationConditions,
 * tickers }. An optional AbortSignal cancels an in-flight save when a newer
 * edit supersedes it.
 */
export async function patchWatchlist(id, fields, { signal } = {}) {
  const response = await fetchWithAuth(`${BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
    signal,
  });
  if (!response.ok) throw await toError(response);
  return response.json();
}

/**
 * Commit a draft watchlist (status -> 'committed').
 */
export async function commitWatchlist(id) {
  const response = await fetchWithAuth(`${BASE}/${id}/commit`, { method: 'POST' });
  if (!response.ok) throw await toError(response);
  return response.json();
}

/**
 * Uncommit a committed watchlist back to draft so it can be edited again.
 */
export async function uncommitWatchlist(id) {
  const response = await fetchWithAuth(`${BASE}/${id}/uncommit`, { method: 'POST' });
  if (!response.ok) throw await toError(response);
  return response.json();
}

/**
 * List the current user's non-deleted watchlists. Returns an array — an
 * absent `watchlists` field yields []. The caller sorts/filters client-side.
 */
export async function listWatchlists() {
  const response = await fetchWithAuth(BASE, { method: 'GET' });
  if (!response.ok) throw await toError(response);
  const data = await response.json();
  return Array.isArray(data.watchlists) ? data.watchlists : [];
}

/**
 * Soft-delete a watchlist. Idempotent server-side — deleting an
 * already-deleted watchlist resolves with { idempotent: true }.
 */
export async function deleteWatchlist(id) {
  const response = await fetchWithAuth(`${BASE}/${id}/delete`, { method: 'POST' });
  if (!response.ok) throw await toError(response);
  return response.json();
}

/**
 * Create an empty manual draft watchlist (Phase 5A). Takes no arguments and
 * posts an empty body — the signal-derived creation path (sessionId/agentId/
 * dropId) stays wired inline in WatchlistChat. Returns the API response
 * ({ watchlistId, status, tickerCount, createdAt, idempotent }); the caller
 * navigates to the editor with the returned watchlistId.
 */
export async function createWatchlist() {
  const response = await fetchWithAuth(BASE, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!response.ok) throw await toError(response);
  return response.json();
}

/**
 * Save a user-authored analysis summary into a watchlist's `notes` field
 * (Phase 2). Unlike patchWatchlist, this works on a COMMITTED watchlist —
 * it hits the notes-only sub-route, which writes only notes regardless of
 * status. Returns { watchlistId, updatedAt }.
 */
export async function saveWatchlistNotes(id, notes) {
  const response = await fetchWithAuth(`${BASE}/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  if (!response.ok) throw await toError(response);
  return response.json();
}

/**
 * Open / continue a cohort-analysis conversation for a watchlist (Phase 2).
 * Pass `userMessage: ''` (or omit) on the first call to get the Tier-1 digest
 * + an opening narration without a model call. Subsequent calls carry the held
 * sessionId and the user's question. Returns the endpoint payload
 * ({ sessionId, message, suggestedActions, digest, tier2Included, ... }).
 */
export async function postWatchlistAnalysis({ watchlistId, userMessage = '', sessionId = null }, { signal } = {}) {
  const response = await fetchWithAuth('/api/forge/watchlist-analysis', {
    method: 'POST',
    body: JSON.stringify({ watchlistId, userMessage, sessionId }),
    signal,
  });
  // Graceful-degradation carve-out, matching the house pattern in
  // WorkshopChat.jsx:556-573 ("known-shape error from the server ... display as
  // a regular agent bubble"). The handler answers a TIMEOUT with 504 + a full,
  // well-formed body carrying `error: true`, the graceful analyst line and the
  // prior digest (watchlist-analysis.js:476-489) — the body is byte-identical
  // to the 200 it used to send; only the status changed once gemmaClient began
  // classifying aborts correctly. Throwing on it made the view take its catch,
  // which DELETES the user's optimistic turn (WatchlistAnalysisView.jsx:154)
  // and shows "I hit a snag" on what is genuinely a timeout — reintroducing,
  // one layer up, the exact mislabel the abort fix removed.
  if (!response.ok) {
    const body = await response.clone().json().catch(() => null);
    if (body?.error === true) return body;
    throw await toError(response);
  }
  return response.json();
}

export default {
  getWatchlist,
  patchWatchlist,
  commitWatchlist,
  uncommitWatchlist,
  listWatchlists,
  deleteWatchlist,
  createWatchlist,
  saveWatchlistNotes,
  postWatchlistAnalysis,
};
