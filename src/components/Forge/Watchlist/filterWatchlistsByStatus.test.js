// src/components/Forge/Watchlist/filterWatchlistsByStatus.test.js
//
// Sprint 6 Phase 4D — coverage for the pure list helpers.

import { describe, it, expect } from 'vitest';
import {
  filterWatchlistsByStatus,
  countByStatus,
  sortByUpdatedDesc,
} from './filterWatchlistsByStatus';

const wl = (overrides) => ({
  watchlistId: 'wl',
  status: 'draft',
  updatedAt: '2026-05-10T00:00:00.000Z',
  ...overrides,
});

describe('filterWatchlistsByStatus', () => {
  const list = [
    wl({ watchlistId: 'a', status: 'draft' }),
    wl({ watchlistId: 'b', status: 'committed' }),
    wl({ watchlistId: 'c', status: 'draft' }),
  ];

  it("returns the list unchanged for 'all'", () => {
    expect(filterWatchlistsByStatus(list, 'all')).toEqual(list);
  });

  it("keeps only drafts for 'draft'", () => {
    expect(filterWatchlistsByStatus(list, 'draft').map((w) => w.watchlistId)).toEqual(['a', 'c']);
  });

  it("keeps only committed for 'committed'", () => {
    expect(filterWatchlistsByStatus(list, 'committed').map((w) => w.watchlistId)).toEqual(['b']);
  });

  it('tolerates a non-array input', () => {
    expect(filterWatchlistsByStatus(undefined, 'all')).toEqual([]);
  });
});

describe('countByStatus', () => {
  it('tallies all / draft / committed', () => {
    const counts = countByStatus([
      wl({ status: 'draft' }),
      wl({ status: 'draft' }),
      wl({ status: 'committed' }),
    ]);
    expect(counts).toEqual({ all: 3, draft: 2, committed: 1 });
  });

  it('returns zeroes for an empty or non-array input', () => {
    expect(countByStatus([])).toEqual({ all: 0, draft: 0, committed: 0 });
    expect(countByStatus(null)).toEqual({ all: 0, draft: 0, committed: 0 });
  });
});

describe('sortByUpdatedDesc', () => {
  it('orders most-recently-updated first', () => {
    const sorted = sortByUpdatedDesc([
      wl({ watchlistId: 'old', updatedAt: '2026-01-01T00:00:00.000Z' }),
      wl({ watchlistId: 'new', updatedAt: '2026-05-15T00:00:00.000Z' }),
      wl({ watchlistId: 'mid', updatedAt: '2026-03-01T00:00:00.000Z' }),
    ]);
    expect(sorted.map((w) => w.watchlistId)).toEqual(['new', 'mid', 'old']);
  });

  it('does not mutate the input array', () => {
    const input = [
      wl({ watchlistId: 'a', updatedAt: '2026-01-01T00:00:00.000Z' }),
      wl({ watchlistId: 'b', updatedAt: '2026-05-01T00:00:00.000Z' }),
    ];
    const snapshot = input.map((w) => w.watchlistId);
    sortByUpdatedDesc(input);
    expect(input.map((w) => w.watchlistId)).toEqual(snapshot);
  });

  it('sorts entries with a missing updatedAt last', () => {
    const sorted = sortByUpdatedDesc([
      wl({ watchlistId: 'none', updatedAt: undefined }),
      wl({ watchlistId: 'dated', updatedAt: '2026-05-15T00:00:00.000Z' }),
    ]);
    expect(sorted.map((w) => w.watchlistId)).toEqual(['dated', 'none']);
  });

  it('handles Firestore {_seconds} timestamps', () => {
    const sorted = sortByUpdatedDesc([
      wl({ watchlistId: 'old', updatedAt: { _seconds: 1000 } }),
      wl({ watchlistId: 'new', updatedAt: { _seconds: 9_999_999 } }),
    ]);
    expect(sorted.map((w) => w.watchlistId)).toEqual(['new', 'old']);
  });
});
