// api/_utils/macroCalendar.test.js
//
// Phase 1 baseline: hardcoded arrays are empty and computed helpers return [].
// Tests stub data by mutating the exported arrays in place — the ESM `const`
// binding prevents reassignment, but the underlying array contents are mutable.
// afterEach drains every array we touched so tests stay independent.

import { describe, it, expect, afterEach } from 'vitest';
import {
  FOMC_DECISIONS_2026,
  CPI_RELEASES_2026,
  PPI_RELEASES_2026,
  PCE_RELEASES_2026,
  RETAIL_SALES_RELEASES_2026,
  GDP_RELEASES_2026,
  PRODUCTIVITY_RELEASES_2026,
  getMacroEventsInWindow,
} from './macroCalendar.js';

const ALL_HARDCODED_ARRAYS = [
  FOMC_DECISIONS_2026,
  CPI_RELEASES_2026,
  PPI_RELEASES_2026,
  PCE_RELEASES_2026,
  RETAIL_SALES_RELEASES_2026,
  GDP_RELEASES_2026,
  PRODUCTIVITY_RELEASES_2026,
];

function makeEvent({ date, category = 'FOMC', impact = 'high', time = '2:00 PM ET', day = 'Wednesday', event = 'stub' }) {
  return { date, day, time, category, impact, event };
}

afterEach(() => {
  for (const arr of ALL_HARDCODED_ARRAYS) arr.length = 0;
});

describe('getMacroEventsInWindow — Phase 1 baseline', () => {
  it('returns [] when all categories are empty', () => {
    expect(getMacroEventsInWindow({ fromDate: '2026-01-01', toDate: '2026-12-31' })).toEqual([]);
  });
});

describe('getMacroEventsInWindow — window filtering (inclusive bounds)', () => {
  it('excludes events strictly before fromDate', () => {
    FOMC_DECISIONS_2026.push(makeEvent({ date: '2026-05-10', event: 'Pre-window' }));
    expect(getMacroEventsInWindow({ fromDate: '2026-05-11', toDate: '2026-05-22' })).toEqual([]);
  });

  it('excludes events strictly after toDate', () => {
    FOMC_DECISIONS_2026.push(makeEvent({ date: '2026-05-23', event: 'Post-window' }));
    expect(getMacroEventsInWindow({ fromDate: '2026-05-11', toDate: '2026-05-22' })).toEqual([]);
  });

  it('includes the fromDate boundary', () => {
    FOMC_DECISIONS_2026.push(makeEvent({ date: '2026-05-11', event: 'Lower boundary' }));
    const events = getMacroEventsInWindow({ fromDate: '2026-05-11', toDate: '2026-05-22' });
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('Lower boundary');
  });

  it('includes the toDate boundary', () => {
    FOMC_DECISIONS_2026.push(makeEvent({ date: '2026-05-22', event: 'Upper boundary' }));
    const events = getMacroEventsInWindow({ fromDate: '2026-05-11', toDate: '2026-05-22' });
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('Upper boundary');
  });
});

describe('getMacroEventsInWindow — sorting', () => {
  it('returns events sorted ascending by date regardless of source order', () => {
    // Push out-of-order across two different source arrays
    FOMC_DECISIONS_2026.push(makeEvent({ date: '2026-05-20', category: 'FOMC', event: 'FOMC late' }));
    CPI_RELEASES_2026.push(makeEvent({ date: '2026-05-12', category: 'CPI', impact: 'high', time: '8:30 AM ET', day: 'Tuesday', event: 'CPI early' }));
    FOMC_DECISIONS_2026.push(makeEvent({ date: '2026-05-05', category: 'FOMC', event: 'FOMC earliest' }));

    const events = getMacroEventsInWindow({ fromDate: '2026-05-01', toDate: '2026-05-31' });
    expect(events.map((e) => e.date)).toEqual(['2026-05-05', '2026-05-12', '2026-05-20']);
  });
});

describe('getMacroEventsInWindow — multi-source aggregation', () => {
  it('reads from every hardcoded array (not just FOMC)', () => {
    // One event in each of the 7 hardcoded arrays, all inside the window
    FOMC_DECISIONS_2026.push(makeEvent({ date: '2026-06-17', category: 'FOMC' }));
    CPI_RELEASES_2026.push(makeEvent({ date: '2026-06-10', category: 'CPI', time: '8:30 AM ET' }));
    PPI_RELEASES_2026.push(makeEvent({ date: '2026-06-11', category: 'PPI', time: '8:30 AM ET' }));
    PCE_RELEASES_2026.push(makeEvent({ date: '2026-06-26', category: 'PCE', time: '8:30 AM ET' }));
    RETAIL_SALES_RELEASES_2026.push(makeEvent({ date: '2026-06-16', category: 'Retail Sales', time: '8:30 AM ET' }));
    GDP_RELEASES_2026.push(makeEvent({ date: '2026-06-25', category: 'GDP', time: '8:30 AM ET' }));
    PRODUCTIVITY_RELEASES_2026.push(makeEvent({ date: '2026-06-04', category: 'Productivity', time: '8:30 AM ET' }));

    const events = getMacroEventsInWindow({ fromDate: '2026-06-01', toDate: '2026-06-30' });

    // Sorted by date, expect every category represented
    expect(events.map((e) => e.category)).toEqual([
      'Productivity',  // 06-04
      'CPI',           // 06-10
      'PPI',           // 06-11
      'Retail Sales',  // 06-16
      'FOMC',          // 06-17
      'GDP',           // 06-25
      'PCE',           // 06-26
    ]);
  });
});
