// api/_utils/fetchMacroEvents.test.js
//
// Verifies the deterministic-source DRB fetcher. System time is pinned for
// each scenario so partition output is exact. Pinning at 17:00Z (12–1 PM ET)
// keeps the conversion safely inside the intended calendar day across DST.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchMacroEvents } from './fetchMacroEvents.js';

function pinTo(yyyyMMdd) {
  vi.setSystemTime(new Date(`${yyyyMMdd}T17:00:00Z`));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchMacroEvents — contract shape', () => {
  it('returns thisWeek, nextWeek, highlight: null, cachedAt: number, citations: []', async () => {
    pinTo('2026-05-13');
    const result = await fetchMacroEvents();

    expect(Object.keys(result).sort()).toEqual(
      ['cachedAt', 'citations', 'highlight', 'nextWeek', 'thisWeek'].sort(),
    );
    expect(Array.isArray(result.thisWeek)).toBe(true);
    expect(Array.isArray(result.nextWeek)).toBe(true);
    expect(result.highlight).toBeNull();
    expect(typeof result.cachedAt).toBe('number');
    expect(result.citations).toEqual([]);
  });
});

describe('fetchMacroEvents — Wednesday pin (full Mon–Sun week remaining)', () => {
  it('thisWeek partitions Wed–Sun; nextWeek partitions following Mon–Sun', async () => {
    pinTo('2026-05-13'); // Wednesday
    const { thisWeek, nextWeek } = await fetchMacroEvents();

    // thisWeek window 2026-05-13 (Wed) → 2026-05-17 (Sun)
    //   PPI April → Wed 5/13
    //   Retail Sales March → Thu 5/14
    //   Initial Jobless Claims → Thu 5/14 (weekly, since R-A1)
    expect(thisWeek).toHaveLength(3);
    expect(thisWeek[0]).toMatchObject({
      date: '2026-05-13',
      day: 'Wednesday',
      category: 'PPI',
      event: 'PPI (April)',
    });
    expect(thisWeek[1]).toMatchObject({
      date: '2026-05-14',
      day: 'Thursday',
      category: 'Retail Sales',
      event: 'Retail Sales (March)',
    });
    expect(thisWeek[2]).toMatchObject({
      date: '2026-05-14',
      day: 'Thursday',
      category: 'Jobless Claims',
      event: 'Initial Jobless Claims',
    });

    // nextWeek window 2026-05-18 (Mon) → 2026-05-24 (Sun): only the weekly
    // claims Thursday (5/21) — agency releases are quiet that week.
    expect(nextWeek).toHaveLength(1);
    expect(nextWeek[0]).toMatchObject({ date: '2026-05-21', category: 'Jobless Claims' });
  });

  it('every thisWeek event has date >= today (ET)', async () => {
    pinTo('2026-05-13');
    const { thisWeek } = await fetchMacroEvents();
    expect(thisWeek.length).toBeGreaterThan(0);
    for (const e of thisWeek) {
      expect(e.date >= '2026-05-13').toBe(true);
    }
  });

  it('thisWeek and nextWeek are disjoint by date', async () => {
    // Pick a Wednesday with events in both halves of the 2-week window so
    // the disjointness assertion has something to actually compare.
    pinTo('2026-04-08'); // Wed: thisWeek 4/8–4/12 (CPI 4/10), nextWeek 4/13–4/19 (PPI 4/14)
    const { thisWeek, nextWeek } = await fetchMacroEvents();
    expect(thisWeek.length).toBeGreaterThan(0);
    expect(nextWeek.length).toBeGreaterThan(0);
    const thisDates = new Set(thisWeek.map((e) => e.date));
    for (const e of nextWeek) {
      expect(thisDates.has(e.date)).toBe(false);
    }
  });
});

describe('fetchMacroEvents — Friday pin (only Fri–Sun left in this week)', () => {
  it('thisWeek shrinks to the 3-day Fri–Sun tail; nextWeek is the full Mon–Sun', async () => {
    pinTo('2026-04-10'); // Friday — CPI March release day
    const { thisWeek, nextWeek } = await fetchMacroEvents();

    // thisWeek window 2026-04-10 (Fri) → 2026-04-12 (Sun)
    //   CPI March → Fri 4/10 (only event in the 3-day tail; computed helpers
    //   for April all landed earlier in the month)
    expect(thisWeek).toHaveLength(1);
    expect(thisWeek[0]).toMatchObject({
      date: '2026-04-10',
      day: 'Friday',
      category: 'CPI',
      event: 'CPI (March)',
    });

    // nextWeek window 2026-04-13 (Mon) → 2026-04-19 (Sun)
    //   PPI March → Tue 4/14
    //   Initial Jobless Claims → Thu 4/16 (weekly, since R-A1)
    expect(nextWeek).toHaveLength(2);
    expect(nextWeek[0]).toMatchObject({
      date: '2026-04-14',
      day: 'Tuesday',
      category: 'PPI',
      event: 'PPI (March)',
    });
    expect(nextWeek[1]).toMatchObject({
      date: '2026-04-16',
      day: 'Thursday',
      category: 'Jobless Claims',
      event: 'Initial Jobless Claims',
    });
  });
});

describe('fetchMacroEvents — Saturday in a quiet week', () => {
  it('weekend tail is empty; even the quietest week now carries its weekly claims row (R-A1)', async () => {
    // 2026-08-15 (Sat). thisWeek window: 8/15 (Sat) → 8/16 (Sun) — weekend,
    // no agency releases. nextWeek window: 8/17 (Mon) → 8/23 (Sun) — falls
    // between the early-August release wave and the late-month PCE/GDP/
    // Consumer Confidence cluster on 8/25–8/26, so before the Recap
    // Restoration arc it was fully empty. Since R-A1 added weekly Initial
    // Jobless Claims, a zero-event week is structurally impossible — the
    // exact property the R9 liveness row's ≤1-week bound relies on.
    pinTo('2026-08-15');
    const result = await fetchMacroEvents();

    expect(result.thisWeek).toEqual([]);
    expect(result.nextWeek).toHaveLength(1);
    expect(result.nextWeek[0]).toMatchObject({
      date: '2026-08-20',
      day: 'Thursday',
      category: 'Jobless Claims',
      event: 'Initial Jobless Claims',
    });
    expect(result.highlight).toBeNull();
    expect(result.citations).toEqual([]);
    expect(typeof result.cachedAt).toBe('number');
  });
});
