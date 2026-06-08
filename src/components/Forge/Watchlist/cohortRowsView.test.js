// src/components/Forge/Watchlist/cohortRowsView.test.js
//
// Unit coverage for the pure cohort-list ordering (mirrors
// filterWatchlistsByStatus.test.js). No React.

import { describe, it, expect } from 'vitest';
import { orderCohortRows, DEFAULT_SORT_KEY } from './cohortRowsView';

const ROWS = [
  { symbol: 'A', return1M: 5, debtToEquity: 2 },
  { symbol: 'B', return1M: 10, debtToEquity: null },
  { symbol: 'C', return1M: null, debtToEquity: 1 },
];

describe('orderCohortRows', () => {
  it('defaults to return1M desc with nulls last', () => {
    const { rows, activeColumn, sortKey, sortDir } = orderCohortRows(ROWS, {});
    expect(rows.map((r) => r.symbol)).toEqual(['B', 'A', 'C']); // 10, 5, null-last
    expect(activeColumn).toBe(DEFAULT_SORT_KEY);
    expect(sortKey).toBe('return1M');
    expect(sortDir).toBe('desc');
  });

  it('uses focusDimension when no user override (nulls still last)', () => {
    const { rows, activeColumn } = orderCohortRows(ROWS, { focusDimension: 'debtToEquity' });
    expect(rows.map((r) => r.symbol)).toEqual(['A', 'C', 'B']); // 2, 1, null-last
    expect(activeColumn).toBe('debtToEquity');
  });

  it('lets a user header tap override the focusDimension', () => {
    const { rows, activeColumn, sortDir } = orderCohortRows(ROWS, {
      focusDimension: 'debtToEquity',
      userSortKey: 'return1M',
      userSortDir: 'asc',
    });
    expect(activeColumn).toBe('return1M');
    expect(sortDir).toBe('asc');
    expect(rows.map((r) => r.symbol)).toEqual(['A', 'B', 'C']); // 5, 10 asc, null last
  });

  it('does not mutate the input array', () => {
    const input = [...ROWS];
    const snapshot = input.map((r) => r.symbol);
    orderCohortRows(input, { focusDimension: 'debtToEquity' });
    expect(input.map((r) => r.symbol)).toEqual(snapshot);
  });

  it('tolerates a non-array input', () => {
    expect(orderCohortRows(null, {}).rows).toEqual([]);
    expect(orderCohortRows(undefined).rows).toEqual([]);
  });
});
