import { describe, it, expect, vi } from 'vitest';

// Neutralize module-load side effects so we can import the named
// `computeThemeRenderOrder` export from ThemesRail.jsx without booting
// Firebase. Mirrors SectorRail.test.js's mock pattern.
vi.mock('../../firebase/config', () => ({
  auth: {},
  db: {},
  default: {},
}));

import { computeThemeRenderOrder } from './ThemesRail';

const t = (id, displayOrder, isLiveThisWeek) => ({
  id,
  title: id,
  displayOrder,
  isLiveThisWeek,
});

describe('computeThemeRenderOrder', () => {
  it('returns empty array for empty input', () => {
    expect(computeThemeRenderOrder([])).toEqual([]);
  });

  it('returns themes in displayOrder with no medals when none are live', () => {
    const input = [
      t('a', 1, false),
      t('b', 2, false),
      t('c', 3, false),
    ];
    const result = computeThemeRenderOrder(input);
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(result.map((r) => r.medalRank)).toEqual([null, null, null]);
  });

  it('places live themes first sorted by displayOrder, then non-live by displayOrder', () => {
    // displayOrders [1,3,5] live; [2,4] non-live.
    // Expected order: 1(gold), 3(silver), 5(bronze), then 2, 4.
    const input = [
      t('one', 1, true),
      t('two', 2, false),
      t('three', 3, true),
      t('four', 4, false),
      t('five', 5, true),
    ];
    const result = computeThemeRenderOrder(input);
    expect(result.map((r) => r.id)).toEqual(['one', 'three', 'five', 'two', 'four']);
    expect(result.map((r) => r.medalRank)).toEqual([1, 2, 3, null, null]);
  });

  it('caps medals at 3 even when more than 3 themes are live (defensive)', () => {
    // 5 live, sorted by displayOrder ascending: [1,2,3,4,5].
    // Medals: 1, 2, 3, null, null. All still appear before any non-live.
    const input = [
      t('a', 1, true),
      t('b', 2, true),
      t('c', 3, true),
      t('d', 4, true),
      t('e', 5, true),
    ];
    const result = computeThemeRenderOrder(input);
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(result.map((r) => r.medalRank)).toEqual([1, 2, 3, null, null]);
  });

  it('handles all-live with no non-live: first 3 medaled, rest medalRank null', () => {
    const input = [
      t('a', 1, true),
      t('b', 2, true),
      t('c', 3, true),
      t('d', 4, true),
    ];
    const result = computeThemeRenderOrder(input);
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(result.map((r) => r.medalRank)).toEqual([1, 2, 3, null]);
  });
});
