import { describe, it, expect, vi } from 'vitest';

// Neutralize module-load side effects so we can import the named
// `computeFeaturedSet` export from FeaturedThemesShowcase.jsx without
// booting Firebase. Mirrors SectorRail.test.js's mock pattern.
vi.mock('../../firebase/config', () => ({
  auth: {},
  db: {},
  default: {},
}));

import { computeFeaturedSet } from './FeaturedThemesShowcase';

const t = (id, displayOrder, isLiveThisWeek) => ({
  id,
  title: id,
  displayOrder,
  isLiveThisWeek,
});

describe('computeFeaturedSet', () => {
  it('returns empty array for empty input', () => {
    expect(computeFeaturedSet([])).toEqual([]);
  });

  it('cold-start: returns first 3 by displayOrder when no themes are live', () => {
    // All non-live → fall back to first 3 from input (Firestore returns
    // displayOrder asc, so input order == displayOrder asc).
    const input = [
      t('a', 1, false),
      t('b', 2, false),
      t('c', 3, false),
      t('d', 4, false),
      t('e', 5, false),
    ];
    const result = computeFeaturedSet(input);
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns the 3 live themes in their input order when exactly 3 are flagged', () => {
    const input = [
      t('a', 1, false),
      t('b', 2, true),
      t('c', 3, false),
      t('d', 4, true),
      t('e', 5, true),
    ];
    const result = computeFeaturedSet(input);
    expect(result.map((r) => r.id)).toEqual(['b', 'd', 'e']);
  });

  it('caps at 3 when more than 3 themes are live (defensive)', () => {
    const input = [
      t('a', 1, true),
      t('b', 2, true),
      t('c', 3, true),
      t('d', 4, true),
      t('e', 5, true),
    ];
    const result = computeFeaturedSet(input);
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(result).toHaveLength(3);
  });

  it('returns only the live themes when fewer than 3 are flagged (does NOT pad with non-live)', () => {
    // 2 live + 6 non-live → exactly 2 returned. Cold-start fallback only
    // kicks in when zero are live, not when "fewer than 3" are.
    const input = [
      t('a', 1, false),
      t('b', 2, true),
      t('c', 3, false),
      t('d', 4, false),
      t('e', 5, true),
      t('f', 6, false),
      t('g', 7, false),
      t('h', 8, false),
    ];
    const result = computeFeaturedSet(input);
    expect(result.map((r) => r.id)).toEqual(['b', 'e']);
    expect(result).toHaveLength(2);
  });
});
