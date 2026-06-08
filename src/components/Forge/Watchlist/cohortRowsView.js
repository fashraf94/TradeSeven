// src/components/Forge/Watchlist/cohortRowsView.js
//
// Per-Name Layer (A) — pure ordering logic for the cohort name list, extracted
// from the JSX so it is unit-testable (repo convention: filterWatchlistsByStatus.js,
// tickerSearchMatch.js, screenerAdapter.js). No React, no formatting — the view
// formats the cells; this module only decides row order + which column is active.
//
// The active column comes from a deterministic precedence — a user header tap
// (userSortKey) overrides the server's focusDimension hint, which overrides the
// default. NO model is in this loop; focusDimension was derived server-side from
// the question's keywords.

export const DEFAULT_SORT_KEY = 'return1M';
export const DEFAULT_SORT_DIR = 'desc';

// Compare two rows by `key`. Missing values (null/undefined) ALWAYS sort last,
// independent of direction, so a sparse column never floats nulls to the top.
function compareByKey(a, b, key, dir) {
  const va = a == null ? undefined : a[key];
  const vb = b == null ? undefined : b[key];
  const aMissing = va == null;
  const bMissing = vb == null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  let cmp;
  if (typeof va === 'string' || typeof vb === 'string') {
    cmp = String(va).localeCompare(String(vb));
  } else {
    cmp = va - vb;
  }
  return dir === 'asc' ? cmp : -cmp;
}

/**
 * Order the cohort rows for display.
 *
 * @param {Object[]} rows                       - per-name rows from the endpoint (not mutated).
 * @param {Object} [opts]
 * @param {string|null} [opts.focusDimension]   - server-derived column hint (or null).
 * @param {string|null} [opts.userSortKey]      - column the user tapped (overrides focusDimension).
 * @param {'asc'|'desc'|null} [opts.userSortDir]
 * @returns {{ rows: Object[], activeColumn: string, sortKey: string, sortDir: 'asc'|'desc' }}
 */
export function orderCohortRows(rows, { focusDimension = null, userSortKey = null, userSortDir = null } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const sortKey = userSortKey || focusDimension || DEFAULT_SORT_KEY;
  const sortDir = userSortDir || DEFAULT_SORT_DIR;
  const sorted = [...list].sort((a, b) => compareByKey(a, b, sortKey, sortDir));
  return { rows: sorted, activeColumn: sortKey, sortKey, sortDir };
}
