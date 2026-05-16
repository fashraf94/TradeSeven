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

export default {
  getWatchlist,
  patchWatchlist,
  commitWatchlist,
  uncommitWatchlist,
  listWatchlists,
  deleteWatchlist,
  createWatchlist,
};
