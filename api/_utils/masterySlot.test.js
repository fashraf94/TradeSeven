// api/_utils/masterySlot.test.js
// Archetype Mastery P1 — slot-system acceptance (Spec V2 §3, §12).
// Pure-module tests: NY day boundary (incl. DST edges), (createdAt, battleId)
// total order, rank derivation with cohort-order invariance, rate bands,
// widened query bounds coverage, duplicate-rank detection.

import { describe, it, expect } from 'vitest';
import {
  deriveSlotDate,
  compareCreationKey,
  rateBandForRank,
  deriveSlotRank,
  buildSlotStamp,
  widenedQueryBounds,
  findDuplicateRank,
} from './masterySlot.js';

describe('deriveSlotDate — America/New_York day boundary (Intl, never hand-rolled)', () => {
  it('maps a UTC midday instant to the same NY calendar date', () => {
    expect(deriveSlotDate('2026-07-20T15:00:00.000Z')).toBe('2026-07-20');
  });

  it('maps a late-UTC-evening instant to the PREVIOUS NY date (EDT, UTC-4)', () => {
    // 02:30Z Jul 21 = 22:30 EDT Jul 20.
    expect(deriveSlotDate('2026-07-21T02:30:00.000Z')).toBe('2026-07-20');
  });

  it('maps an EST-era instant correctly (UTC-5)', () => {
    // 04:59Z Jan 21 = 23:59 EST Jan 20.
    expect(deriveSlotDate('2026-01-21T04:59:00.000Z')).toBe('2026-01-20');
    // 05:00Z Jan 21 = 00:00 EST Jan 21 — the boundary flips exactly here.
    expect(deriveSlotDate('2026-01-21T05:00:00.000Z')).toBe('2026-01-21');
  });

  it('handles the DST-end morning (Nov 1 2026): pre-fallback UTC instants are still EDT', () => {
    // DST ends 2026-11-01 at 2:00 EDT (= 06:00Z). 05:30Z is 01:30 EDT Nov 1.
    expect(deriveSlotDate('2026-11-01T05:30:00.000Z')).toBe('2026-11-01');
    // 04:30Z Oct 31 EDT evening check: 2026-11-01T03:59Z = 23:59 EDT Oct 31.
    expect(deriveSlotDate('2026-11-01T03:59:00.000Z')).toBe('2026-10-31');
  });

  it('fails closed on unusable input', () => {
    expect(deriveSlotDate(undefined)).toBeNull();
    expect(deriveSlotDate('')).toBeNull();
    expect(deriveSlotDate('not-a-date')).toBeNull();
  });
});

describe('compareCreationKey — (createdAt, battleId) total order', () => {
  it('orders by createdAt first', () => {
    const a = { createdAt: '2026-07-20T10:00:00.000Z', battleId: 'zzz' };
    const b = { createdAt: '2026-07-20T11:00:00.000Z', battleId: 'aaa' };
    expect(compareCreationKey(a, b)).toBeLessThan(0);
    expect(compareCreationKey(b, a)).toBeGreaterThan(0);
  });

  it('breaks same-millisecond ties by battleId (the S11.5 live edge, deterministically)', () => {
    const a = { createdAt: '2026-07-20T10:00:00.000Z', battleId: 'abc' };
    const b = { createdAt: '2026-07-20T10:00:00.000Z', battleId: 'abd' };
    expect(compareCreationKey(a, b)).toBeLessThan(0);
    expect(compareCreationKey(a, a)).toBe(0);
  });
});

describe('rateBandForRank — 1–3 → 1.0 · 4–6 → 0.5 · 7+ → 0 (spec §3)', () => {
  it.each([
    [1, 1.0], [2, 1.0], [3, 1.0],
    [4, 0.5], [5, 0.5], [6, 0.5],
    [7, 0], [8, 0], [100, 0],
  ])('rank %i → %d', (rank, band) => {
    expect(rateBandForRank(rank)).toBe(band);
  });

  it('fails closed on non-positive/non-integer/absent ranks', () => {
    expect(rateBandForRank(0)).toBe(0);
    expect(rateBandForRank(-1)).toBe(0);
    expect(rateBandForRank(2.5)).toBe(0);
    expect(rateBandForRank(NaN)).toBe(0);
    expect(rateBandForRank(undefined)).toBe(0);
  });
});

describe('deriveSlotRank — derived, never allocated (spec §3)', () => {
  const day = (h, id) => ({ createdAt: `2026-07-20T${String(h).padStart(2, '0')}:00:00.000Z`, battleId: id });

  it('ranks by creation order within the NY day, excluding self, ignoring other days', () => {
    const target = day(15, 'b3');
    const cohort = [
      day(13, 'b1'),
      day(14, 'b2'),
      target, // self — excluded
      day(16, 'b4'), // later — not counted
      { createdAt: '2026-07-19T15:00:00.000Z', battleId: 'prev-day' }, // other NY day
      { createdAt: '2026-07-21T15:00:00.000Z', battleId: 'next-day' },
    ];
    expect(deriveSlotRank(target, cohort)).toEqual({ slotDate: '2026-07-20', rank: 3 });
  });

  it('counts a late-UTC sibling that belongs to the SAME NY day (the S11.6 cohort-bounds case)', () => {
    // Sibling created 22:30 EDT Jul 20 (= 02:30Z Jul 21) precedes a target on Jul 20? No —
    // it is LATER in the day; flip roles: target is the late-evening battle.
    const target = { createdAt: '2026-07-21T02:30:00.000Z', battleId: 'late' }; // 22:30 EDT Jul 20
    const cohort = [day(15, 'noon')]; // 11:00 EDT Jul 20
    expect(deriveSlotRank(target, cohort)).toEqual({ slotDate: '2026-07-20', rank: 2 });
  });

  it('same-millisecond pair: battleId decides, and both ranks are distinct + stable', () => {
    const a = { createdAt: '2026-07-20T10:00:00.000Z', battleId: 'aaa' };
    const b = { createdAt: '2026-07-20T10:00:00.000Z', battleId: 'bbb' };
    expect(deriveSlotRank(a, [b]).rank).toBe(1);
    expect(deriveSlotRank(b, [a]).rank).toBe(2);
  });

  it('is invariant under cohort array permutation (evaluation-order independence at the unit level)', () => {
    const target = day(18, 'target');
    const cohort = [day(9, 'a'), day(10, 'b'), day(11, 'c'), day(19, 'later')];
    const perms = [
      cohort,
      [...cohort].reverse(),
      [cohort[2], cohort[0], cohort[3], cohort[1]],
    ];
    const ranks = perms.map((p) => deriveSlotRank(target, p).rank);
    expect(ranks).toEqual([4, 4, 4]);
  });

  it('fails closed on unusable target creation data', () => {
    expect(deriveSlotRank({ createdAt: 'garbage', battleId: 'x' }, [])).toBeNull();
    expect(deriveSlotRank({ createdAt: '2026-07-20T10:00:00.000Z', battleId: '' }, [])).toBeNull();
  });
});

describe('widenedQueryBounds — covers the whole NY day at both DST extremes', () => {
  it('produces [D 00:00Z, D+2 00:00Z)', () => {
    expect(widenedQueryBounds('2026-07-20')).toEqual({
      startIso: '2026-07-20T00:00:00.000Z',
      endIso: '2026-07-22T00:00:00.000Z',
    });
  });

  it('contains the EDT day start and the EST day end instants', () => {
    const july = widenedQueryBounds('2026-07-20'); // EDT: day = [04:00Z, +1 04:00Z)
    expect('2026-07-20T04:00:00.000Z' >= july.startIso).toBe(true);
    expect('2026-07-21T03:59:59.999Z' < july.endIso).toBe(true);
    const jan = widenedQueryBounds('2026-01-20'); // EST: day = [05:00Z, +1 05:00Z)
    expect('2026-01-20T05:00:00.000Z' >= jan.startIso).toBe(true);
    expect('2026-01-21T04:59:59.999Z' < jan.endIso).toBe(true);
  });

  it('fails closed on garbage', () => {
    expect(widenedQueryBounds('garbage')).toBeNull();
  });
});

describe('buildSlotStamp + findDuplicateRank', () => {
  it('stamp carries {date, rank, rateBand, assignedAt}', () => {
    expect(buildSlotStamp({ slotDate: '2026-07-20', rank: 5, assignedAt: 'T' })).toEqual({
      date: '2026-07-20',
      rank: 5,
      rateBand: 0.5,
      assignedAt: 'T',
    });
  });

  it('detects a stamped sibling already holding the same (date, rank); ignores self and other days', () => {
    const cohort = [
      { battleId: 'self', masterySlot: { date: '2026-07-20', rank: 2 } },
      { battleId: 'other-day', masterySlot: { date: '2026-07-19', rank: 2 } },
      { battleId: 'dupe', masterySlot: { date: '2026-07-20', rank: 2 } },
      { battleId: 'unstamped' },
    ];
    const hit = findDuplicateRank({ slotDate: '2026-07-20', rank: 2, cohortDocs: cohort, selfBattleId: 'self' });
    expect(hit.battleId).toBe('dupe');
    expect(findDuplicateRank({ slotDate: '2026-07-20', rank: 3, cohortDocs: cohort, selfBattleId: 'self' })).toBeNull();
  });
});
