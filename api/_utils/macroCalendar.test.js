// api/_utils/macroCalendar.test.js
//
// Tests stub data by mutating the exported arrays in place — the ESM `const`
// binding prevents reassignment, but the underlying array contents are mutable.
// afterEach restores every hardcoded array from its module-load snapshot so
// tests stay independent. Stub-only tests that rely on empty arrays drain
// explicitly via beforeEach inside their describe block.

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  FOMC_DECISIONS_2026,
  CPI_RELEASES_2026,
  PPI_RELEASES_2026,
  PCE_RELEASES_2026,
  RETAIL_SALES_RELEASES_2026,
  GDP_RELEASES_2026,
  PRODUCTIVITY_RELEASES_2026,
  getMacroEventsInWindow,
  getNFPDates,
  getJOLTSDates,
  getISMManufacturingDates,
  getISMServicesDates,
  getConsumerConfidenceDates,
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
const SNAPSHOTS = ALL_HARDCODED_ARRAYS.map((arr) => arr.slice());

function makeEvent({ date, category = 'FOMC', impact = 'high', time = '2:00 PM ET', day = 'Wednesday', event = 'stub' }) {
  return { date, day, time, category, impact, event };
}

afterEach(() => {
  ALL_HARDCODED_ARRAYS.forEach((arr, i) => {
    arr.length = 0;
    arr.push(...SNAPSHOTS[i]);
  });
});

describe('getMacroEventsInWindow — empty-source baseline', () => {
  it('returns [] when every source is empty', () => {
    // Drain everything (including the FOMC snapshot) for this one test.
    for (const arr of ALL_HARDCODED_ARRAYS) arr.length = 0;
    // Tight window so no computed helpers contribute either.
    expect(getMacroEventsInWindow({ fromDate: '2026-05-13', toDate: '2026-05-13' })).toEqual([]);
  });
});

describe('getMacroEventsInWindow — window filtering (inclusive bounds)', () => {
  // These tests exercise the filter logic with stub data only. Drain every
  // hardcoded array first so the published 2026 calendar doesn't leak into
  // the window. afterEach (at file scope) re-populates from snapshots.
  beforeEach(() => {
    for (const arr of ALL_HARDCODED_ARRAYS) arr.length = 0;
  });

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
    // Drain FOMC so the stub events are the only FOMC entries in scope
    FOMC_DECISIONS_2026.length = 0;
    // Push out-of-order across two different source arrays
    FOMC_DECISIONS_2026.push(makeEvent({ date: '2026-05-20', category: 'FOMC', event: 'stub-FOMC-late' }));
    CPI_RELEASES_2026.push(makeEvent({ date: '2026-05-12', category: 'CPI', impact: 'high', time: '8:30 AM ET', day: 'Tuesday', event: 'stub-CPI-early' }));
    FOMC_DECISIONS_2026.push(makeEvent({ date: '2026-05-05', category: 'FOMC', event: 'stub-FOMC-earliest' }));

    const events = getMacroEventsInWindow({ fromDate: '2026-05-01', toDate: '2026-05-31' })
      .filter((e) => e.event.startsWith('stub-'));
    expect(events.map((e) => e.date)).toEqual(['2026-05-05', '2026-05-12', '2026-05-20']);
  });
});

describe('getMacroEventsInWindow — multi-source aggregation', () => {
  it('reads from every hardcoded array (not just FOMC)', () => {
    // Drain FOMC so this test isolates the multi-source check
    FOMC_DECISIONS_2026.length = 0;
    FOMC_DECISIONS_2026.push(makeEvent({ date: '2026-06-17', category: 'FOMC' }));
    CPI_RELEASES_2026.push(makeEvent({ date: '2026-06-10', category: 'CPI', time: '8:30 AM ET' }));
    PPI_RELEASES_2026.push(makeEvent({ date: '2026-06-11', category: 'PPI', time: '8:30 AM ET' }));
    PCE_RELEASES_2026.push(makeEvent({ date: '2026-06-26', category: 'PCE', time: '8:30 AM ET' }));
    RETAIL_SALES_RELEASES_2026.push(makeEvent({ date: '2026-06-16', category: 'Retail Sales', time: '8:30 AM ET' }));
    GDP_RELEASES_2026.push(makeEvent({ date: '2026-06-25', category: 'GDP', time: '8:30 AM ET' }));
    PRODUCTIVITY_RELEASES_2026.push(makeEvent({ date: '2026-06-04', category: 'Productivity', time: '8:30 AM ET' }));

    // Window where no computed helpers contribute (avoiding NFP June 5, JOLTS
    // June 2, ISM Mfg June 1, ISM Svc June 3, Consumer Confidence June 30 —
    // and only the seven hardcoded stubs above).
    const events = getMacroEventsInWindow({ fromDate: '2026-06-04', toDate: '2026-06-26' })
      .filter((e) => e.event === 'stub');

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

// =============================================================================
// Phase 2 — computed helpers
// =============================================================================

describe('getNFPDates(2026)', () => {
  const nfp = getNFPDates(2026);

  it('returns 12 entries (one per month)', () => {
    expect(nfp).toHaveLength(12);
  });

  it('all entries are 8:30 AM ET / NFP / high', () => {
    for (const e of nfp) {
      expect(e.time).toBe('8:30 AM ET');
      expect(e.category).toBe('NFP');
      expect(e.impact).toBe('high');
    }
  });

  it('first entry is Friday Jan 2 2026 (first Friday of the year, not a holiday)', () => {
    expect(nfp[0].date).toBe('2026-01-02');
    expect(nfp[0].day).toBe('Friday');
    // Data month is December (prior month)
    expect(nfp[0].event).toBe('Nonfarm Payrolls (December)');
  });

  it('April first Friday (Apr 3, Good Friday) shifts forward to Mon Apr 6', () => {
    // index 3 = April
    expect(nfp[3].date).toBe('2026-04-06');
    expect(nfp[3].day).toBe('Monday');
    expect(nfp[3].event).toBe('Nonfarm Payrolls (March)');
  });

  it('July first Friday (Jul 3, Independence Day observed) shifts forward to Mon Jul 6', () => {
    // index 6 = July
    expect(nfp[6].date).toBe('2026-07-06');
    expect(nfp[6].day).toBe('Monday');
  });

  it('non-shifted entries fall on the actual first Friday', () => {
    // May 2026: first Friday is May 1 (no holiday)
    expect(nfp[4].date).toBe('2026-05-01');
    expect(nfp[4].day).toBe('Friday');
    // August 2026: first Friday is Aug 7
    expect(nfp[7].date).toBe('2026-08-07');
    expect(nfp[7].day).toBe('Friday');
  });
});

describe('getJOLTSDates(2026)', () => {
  const jolts = getJOLTSDates(2026);

  it('returns 12 entries', () => {
    expect(jolts).toHaveLength(12);
  });

  it('first entry is Tue Jan 6 with data month November (2 months prior, wrapped)', () => {
    expect(jolts[0].date).toBe('2026-01-06');
    expect(jolts[0].day).toBe('Tuesday');
    expect(jolts[0].time).toBe('10:00 AM ET');
    expect(jolts[0].category).toBe('JOLTS');
    expect(jolts[0].impact).toBe('medium');
    expect(jolts[0].event).toBe('JOLTS (November)');
  });

  it('May release references March data', () => {
    // index 4 = May
    expect(jolts[4].event).toBe('JOLTS (March)');
    expect(jolts[4].date).toBe('2026-05-05');  // first Tue of May 2026
  });
});

describe('getISMManufacturingDates(2026)', () => {
  const ism = getISMManufacturingDates(2026);

  it('returns 12 entries', () => {
    expect(ism).toHaveLength(12);
  });

  it('January falls on Fri Jan 2 (skips Jan 1 New Year holiday)', () => {
    expect(ism[0].date).toBe('2026-01-02');
    expect(ism[0].day).toBe('Friday');
    expect(ism[0].event).toBe('ISM Manufacturing PMI (December)');
  });

  it('May falls on Fri May 1 (first business day, no skip needed)', () => {
    expect(ism[4].date).toBe('2026-05-01');
    expect(ism[4].day).toBe('Friday');
  });
});

describe('getISMServicesDates(2026)', () => {
  const ism = getISMServicesDates(2026);

  it('returns 12 entries', () => {
    expect(ism).toHaveLength(12);
  });

  it('January falls on Tue Jan 6 (Jan 1 holiday → Jan 2 BD1 → Jan 5 BD2 → Jan 6 BD3)', () => {
    expect(ism[0].date).toBe('2026-01-06');
    expect(ism[0].day).toBe('Tuesday');
    expect(ism[0].event).toBe('ISM Services PMI (December)');
  });

  it('May falls on Tue May 5 (May 1 Fri BD1 → May 4 Mon BD2 → May 5 Tue BD3)', () => {
    expect(ism[4].date).toBe('2026-05-05');
    expect(ism[4].day).toBe('Tuesday');
  });
});

describe('getConsumerConfidenceDates(2026)', () => {
  const cc = getConsumerConfidenceDates(2026);

  it('returns 12 entries', () => {
    expect(cc).toHaveLength(12);
  });

  it('May entry is Tue May 26 (last Tuesday of May 2026)', () => {
    // index 4 = May
    expect(cc[4].date).toBe('2026-05-26');
    expect(cc[4].day).toBe('Tuesday');
    expect(cc[4].time).toBe('10:00 AM ET');
    expect(cc[4].category).toBe('Consumer Confidence');
    expect(cc[4].impact).toBe('medium');
    expect(cc[4].event).toBe('Consumer Confidence (May)');
  });

  it('March entry is Tue Mar 31 (last day of March is itself the last Tuesday)', () => {
    // March 31 2026 = Tuesday — boundary case where last weekday is the month's last date
    expect(cc[2].date).toBe('2026-03-31');
    expect(cc[2].day).toBe('Tuesday');
  });
});

// =============================================================================
// Phase 2 — FOMC_DECISIONS_2026
// =============================================================================

describe('FOMC_DECISIONS_2026', () => {
  it('contains 5 entries (remaining 2026 decisions as of mid-May 2026)', () => {
    expect(FOMC_DECISIONS_2026).toHaveLength(5);
  });

  it('all entries are Wednesdays at 2:00 PM ET, category=FOMC, impact=high', () => {
    for (const e of FOMC_DECISIONS_2026) {
      expect(e.day).toBe('Wednesday');
      expect(e.time).toBe('2:00 PM ET');
      expect(e.category).toBe('FOMC');
      expect(e.impact).toBe('high');
    }
  });

  it('dates match the Fed-published 2026 schedule', () => {
    expect(FOMC_DECISIONS_2026.map((e) => e.date)).toEqual([
      '2026-06-17',
      '2026-07-29',
      '2026-09-16',
      '2026-10-28',
      '2026-12-09',
    ]);
  });

  it('quarterly SEP meetings (June, Sep, Dec) note the SEP release', () => {
    const sepDates = FOMC_DECISIONS_2026
      .filter((e) => e.event.includes('Summary of Economic Projections'))
      .map((e) => e.date);
    expect(sepDates).toEqual(['2026-06-17', '2026-09-16', '2026-12-09']);
  });
});

// =============================================================================
// Phase 3 — populated 2026 release arrays (CPI / PPI / PCE / Retail Sales /
// GDP / Productivity)
// =============================================================================

// 2026-05-13's Wikipedia/Zeller-fingerprint reference for the day-of-week
// check: Jan 1 2026 is a Thursday. The MacroEvent `day` field is rendered
// downstream by the DRB prompt builder; an off-by-one would surface in the
// formatted brief as e.g. "May 12 (Wed) 8:30 AM ET — CPI (April)" when the
// actual weekday is Tuesday.
function expectedWeekday(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`)
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

const POPULATED_2026_ARRAYS = [
  ['CPI', CPI_RELEASES_2026, 12],
  ['PPI', PPI_RELEASES_2026, 13],            // +1 carryover: Nov-2025 release on Jan 14, 2026
  ['PCE', PCE_RELEASES_2026, 13],            // +1 carryover: combined Oct/Nov-2025 release on Jan 22, 2026
  ['Retail Sales', RETAIL_SALES_RELEASES_2026, 10],  // 5 confirmed + 5 forecast; Nov/Dec omitted
  ['GDP', GDP_RELEASES_2026, 13],            // +1 carryover: Q3-2025 updated estimate on Jan 22, 2026
  ['Productivity', PRODUCTIVITY_RELEASES_2026, 10],  // 5 quarters × 2 stages (Q3-2025 through Q3-2026)
];

describe('populated 2026 release arrays — counts', () => {
  for (const [name, arr, count] of POPULATED_2026_ARRAYS) {
    it(`${name} has ${count} entries`, () => {
      expect(arr).toHaveLength(count);
    });
  }
});

describe('populated 2026 release arrays — shape', () => {
  const requiredFields = ['date', 'day', 'time', 'category', 'impact', 'event'];
  const allEntries = POPULATED_2026_ARRAYS.flatMap(([, arr]) => arr);

  it('aggregate count across all 6 populated arrays is 71', () => {
    expect(allEntries).toHaveLength(71);
  });

  it('every entry has all 6 required MacroEvent fields populated', () => {
    for (const entry of allEntries) {
      for (const field of requiredFields) {
        expect(
          entry[field],
          `entry ${JSON.stringify(entry)} missing field "${field}"`,
        ).toBeTruthy();
      }
    }
  });

  it('every entry`s `day` is consistent with its `date`', () => {
    for (const entry of allEntries) {
      expect(
        entry.day,
        `day/date mismatch on ${entry.date}: array says ${entry.day}, calendar says ${expectedWeekday(entry.date)}`,
      ).toBe(expectedWeekday(entry.date));
    }
  });
});

describe('populated 2026 release arrays — spot checks', () => {
  it('CPI April release (2026-05-12) is present — the verified date that triggered PR 3', () => {
    const found = CPI_RELEASES_2026.find((e) => e.date === '2026-05-12');
    expect(found).toBeDefined();
    expect(found.event).toBe('CPI (April)');
    expect(found.day).toBe('Tuesday');
    expect(found.time).toBe('8:30 AM ET');
    expect(found.impact).toBe('high');
  });

  it('PPI April release falls on 2026-05-13 (today)', () => {
    const found = PPI_RELEASES_2026.find((e) => e.date === '2026-05-13');
    expect(found).toBeDefined();
    expect(found.event).toBe('PPI (April)');
  });

  it('PCE includes the combined Oct/Nov-2025 release as a single Jan 22 entry', () => {
    const jan22 = PCE_RELEASES_2026.filter((e) => e.date === '2026-01-22');
    expect(jan22).toHaveLength(1);
    expect(jan22[0].event).toBe('PCE (October & November combined)');
  });

  it('GDP includes the Q3-2025 updated estimate on Jan 22', () => {
    const found = GDP_RELEASES_2026.find((e) => e.event.includes('Q3 2025 updated estimate'));
    expect(found).toBeDefined();
    expect(found.date).toBe('2026-01-22');
  });
});

describe('populated 2026 release arrays — getMacroEventsInWindow over a real week', () => {
  it('window 2026-05-13 → 2026-05-22 returns exactly PPI on 5/13 and Retail Sales on 5/14', () => {
    const events = getMacroEventsInWindow({ fromDate: '2026-05-13', toDate: '2026-05-22' });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      date: '2026-05-13',
      day: 'Wednesday',
      time: '8:30 AM ET',
      category: 'PPI',
      impact: 'medium',
      event: 'PPI (April)',
    });
    expect(events[1]).toMatchObject({
      date: '2026-05-14',
      day: 'Thursday',
      time: '8:30 AM ET',
      category: 'Retail Sales',
      impact: 'high',
      event: 'Retail Sales (March)',
    });
  });
});

// =============================================================================
// Phase 2 — getMacroEventsInWindow integration
// =============================================================================

describe('getMacroEventsInWindow — integration with computed helpers + FOMC', () => {
  it('window covering June 15-19 includes the June 17 FOMC decision', () => {
    const events = getMacroEventsInWindow({ fromDate: '2026-06-15', toDate: '2026-06-19' });
    const fomc = events.filter((e) => e.category === 'FOMC');
    expect(fomc).toHaveLength(1);
    expect(fomc[0].date).toBe('2026-06-17');
  });

  it('year-spanning window 2026-12-28 → 2027-01-05 returns Dec 2026 entries and computed Jan 2027 entries', () => {
    // Documented PR 2 behavior: hardcoded arrays are 2026-only; computed
    // helpers are called per-year for both 2026 and 2027. So the 2027 portion
    // gets NFP / JOLTS / ISM / Consumer Confidence but no CPI/PPI/etc.
    const events = getMacroEventsInWindow({ fromDate: '2026-12-28', toDate: '2027-01-05' });

    // Should include at least one 2027 computed event (ISM Mfg first BD of Jan 2027 = Jan 4 Mon)
    const jan2027 = events.filter((e) => e.date.startsWith('2027'));
    expect(jan2027.length).toBeGreaterThan(0);
    // And the Consumer Confidence Dec 2026 last Tuesday is Dec 29
    const cc = events.filter((e) => e.category === 'Consumer Confidence' && e.date === '2026-12-29');
    expect(cc).toHaveLength(1);
  });
});
