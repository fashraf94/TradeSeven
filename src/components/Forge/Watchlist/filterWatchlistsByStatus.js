// src/components/Forge/Watchlist/filterWatchlistsByStatus.js
//
// Sprint 6 Phase 4D — pure client-side helpers for the "My Watchlists" list.
// The list endpoint returns watchlists unordered (beyond the soft-delete
// exclusion); sorting and status filtering happen here so the status pills
// recompute instantly without a refetch.

import { toDate } from '../../../utils/timeAgo';

/**
 * Filter a watchlist array by status. 'all' returns the list unchanged.
 * @param {Array} watchlists
 * @param {'all'|'draft'|'committed'} status
 */
export function filterWatchlistsByStatus(watchlists, status) {
  const list = Array.isArray(watchlists) ? watchlists : [];
  if (status === 'all') return list;
  return list.filter((w) => w?.status === status);
}

/**
 * Tally watchlists by status for the filter-pill counts.
 * @returns {{ all: number, draft: number, committed: number }}
 */
export function countByStatus(watchlists) {
  const list = Array.isArray(watchlists) ? watchlists : [];
  return {
    all: list.length,
    draft: list.filter((w) => w?.status === 'draft').length,
    committed: list.filter((w) => w?.status === 'committed').length,
  };
}

/**
 * Return a NEW array sorted by updatedAt DESC (most recent first); does not
 * mutate the input. Entries with a missing/unparseable updatedAt sort last.
 */
export function sortByUpdatedDesc(watchlists) {
  const list = Array.isArray(watchlists) ? watchlists : [];
  return [...list].sort(
    (a, b) => toDate(b?.updatedAt).getTime() - toDate(a?.updatedAt).getTime(),
  );
}
