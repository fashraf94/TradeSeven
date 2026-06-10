// api/cron/process-draft-claims.test.js
// Unit tests for the DST-safe claim-processing window guard and the
// lastProcessedDay idempotency read. The cron fires at both 13:25 and
// 14:25 UTC (schedule: 25 13,14 * * 1-5); exactly one firing must land
// inside the 9:20-9:35 AM ET window in any season.
//
// 2026 DST transitions: spring-forward Sun Mar 8, fall-back Sun Nov 1.

import { describe, it, expect } from 'vitest';
import { getClaimProcessingWindow, isAlreadyProcessedForDay } from './process-draft-claims.js';

// Trading-day fixtures spanning both DST regimes and both transition weeks.
const FIXTURE_DATES = [
  { label: 'summer (EDT), Wed 2026-06-10', date: '2026-06-10', passingUtcHour: 13 },
  { label: 'winter (EST), Wed 2026-01-14', date: '2026-01-14', passingUtcHour: 14 },
  { label: 'before spring-forward (EST), Fri 2026-03-06', date: '2026-03-06', passingUtcHour: 14 },
  { label: 'after spring-forward (EDT), Mon 2026-03-09', date: '2026-03-09', passingUtcHour: 13 },
  { label: 'before fall-back (EDT), Fri 2026-10-30', date: '2026-10-30', passingUtcHour: 13 },
  { label: 'after fall-back (EST), Mon 2026-11-02', date: '2026-11-02', passingUtcHour: 14 },
];

describe('getClaimProcessingWindow — DST correctness across the collapsed 25 13,14 UTC schedule', () => {
  it('summer (EDT): 13:25 UTC is 9:25 AM ET and passes; 14:25 UTC is 10:25 AM ET and skips', () => {
    const pass = getClaimProcessingWindow(new Date('2026-06-10T13:25:00Z'));
    expect(pass.inWindow).toBe(true);
    expect(pass.isPastOpen).toBe(false);
    expect(pass.etTime).toBe('09:25');

    const skip = getClaimProcessingWindow(new Date('2026-06-10T14:25:00Z'));
    expect(skip.inWindow).toBe(false);
    expect(skip.etTime).toBe('10:25');
  });

  it('winter (EST): 14:25 UTC is 9:25 AM ET and passes; 13:25 UTC is 8:25 AM ET and skips', () => {
    const pass = getClaimProcessingWindow(new Date('2026-01-14T14:25:00Z'));
    expect(pass.inWindow).toBe(true);
    expect(pass.isPastOpen).toBe(false);
    expect(pass.etTime).toBe('09:25');

    const skip = getClaimProcessingWindow(new Date('2026-01-14T13:25:00Z'));
    expect(skip.inWindow).toBe(false);
    expect(skip.etTime).toBe('08:25');
  });

  it('spring-forward week: Fri 2026-03-06 (EST) passes at 14:25 UTC, skips at 13:25 UTC', () => {
    expect(getClaimProcessingWindow(new Date('2026-03-06T14:25:00Z')).inWindow).toBe(true);
    expect(getClaimProcessingWindow(new Date('2026-03-06T13:25:00Z')).inWindow).toBe(false);
  });

  it('spring-forward week: Mon 2026-03-09 (EDT) passes at 13:25 UTC, skips at 14:25 UTC', () => {
    expect(getClaimProcessingWindow(new Date('2026-03-09T13:25:00Z')).inWindow).toBe(true);
    expect(getClaimProcessingWindow(new Date('2026-03-09T14:25:00Z')).inWindow).toBe(false);
  });

  it('fall-back week: Fri 2026-10-30 (EDT) passes at 13:25 UTC, skips at 14:25 UTC', () => {
    expect(getClaimProcessingWindow(new Date('2026-10-30T13:25:00Z')).inWindow).toBe(true);
    expect(getClaimProcessingWindow(new Date('2026-10-30T14:25:00Z')).inWindow).toBe(false);
  });

  it('fall-back week: Mon 2026-11-02 (EST) passes at 14:25 UTC, skips at 13:25 UTC', () => {
    expect(getClaimProcessingWindow(new Date('2026-11-02T14:25:00Z')).inWindow).toBe(true);
    expect(getClaimProcessingWindow(new Date('2026-11-02T13:25:00Z')).inWindow).toBe(false);
  });
});

describe('getClaimProcessingWindow — ET window boundaries (summer date, EDT = UTC-4)', () => {
  it('9:19 AM ET — before window, skips', () => {
    const w = getClaimProcessingWindow(new Date('2026-06-10T13:19:00Z'));
    expect(w.inWindow).toBe(false);
  });

  it('9:20 AM ET — window opens, no past-open warning', () => {
    const w = getClaimProcessingWindow(new Date('2026-06-10T13:20:00Z'));
    expect(w.inWindow).toBe(true);
    expect(w.isPastOpen).toBe(false);
  });

  it('9:29 AM ET — in window, no past-open warning', () => {
    const w = getClaimProcessingWindow(new Date('2026-06-10T13:29:00Z'));
    expect(w.inWindow).toBe(true);
    expect(w.isPastOpen).toBe(false);
  });

  it('9:30 AM ET — in window, flags past-open', () => {
    const w = getClaimProcessingWindow(new Date('2026-06-10T13:30:00Z'));
    expect(w.inWindow).toBe(true);
    expect(w.isPastOpen).toBe(true);
  });

  it('9:34 AM ET — in window, flags past-open', () => {
    const w = getClaimProcessingWindow(new Date('2026-06-10T13:34:00Z'));
    expect(w.inWindow).toBe(true);
    expect(w.isPastOpen).toBe(true);
  });

  it('9:35 AM ET — window closed (exclusive upper bound), skips', () => {
    const w = getClaimProcessingWindow(new Date('2026-06-10T13:35:00Z'));
    expect(w.inWindow).toBe(false);
  });
});

describe('getClaimProcessingWindow — exactly one in-window firing per day', () => {
  for (const { label, date, passingUtcHour } of FIXTURE_DATES) {
    it(`${label}: of the 13:25/14:25 UTC pair, only the ${passingUtcHour}:25 firing is in-window`, () => {
      const at1325 = getClaimProcessingWindow(new Date(`${date}T13:25:00Z`));
      const at1425 = getClaimProcessingWindow(new Date(`${date}T14:25:00Z`));

      // Exactly one of the two firings passes (XOR)...
      expect(at1325.inWindow !== at1425.inWindow).toBe(true);
      // ...and it is the season-correct one, landing exactly at 9:25 AM ET.
      const passing = passingUtcHour === 13 ? at1325 : at1425;
      expect(passing.inWindow).toBe(true);
      expect(passing.etTime).toBe('09:25');
    });
  }
});

describe('isAlreadyProcessedForDay — idempotency read of claimSystem.lastProcessedDay', () => {
  it('skips when the current trading day was already processed', () => {
    expect(isAlreadyProcessedForDay({ lastProcessedDay: 3 }, 3)).toBe(true);
  });

  it('does not skip when the last processed day is earlier', () => {
    expect(isAlreadyProcessedForDay({ lastProcessedDay: 2 }, 3)).toBe(false);
  });

  it('never skips on day 0 (battle not started), even on equality', () => {
    expect(isAlreadyProcessedForDay({ lastProcessedDay: 0 }, 0)).toBe(false);
  });

  it('does not skip when claimSystem is missing', () => {
    expect(isAlreadyProcessedForDay(undefined, 3)).toBe(false);
  });

  it('does not skip when lastProcessedDay was never written (initial doc shape)', () => {
    expect(isAlreadyProcessedForDay({ enabled: true, currentWaiverPriority: [], processingLog: [] }, 3)).toBe(false);
  });
});

describe('guard + idempotency — exactly one execution per trading day', () => {
  for (const { label, date } of FIXTURE_DATES) {
    it(`${label}: one firing is window-blocked, one executes, a same-day re-run is idempotency-blocked`, () => {
      const tradingDay = 3;
      const claimSystem = { lastProcessedDay: tradingDay - 1 }; // yesterday processed

      let executions = 0;
      for (const utcHour of [13, 14]) {
        const win = getClaimProcessingWindow(new Date(`${date}T${utcHour}:25:00Z`));
        if (!win.inWindow) continue; // off-DST firing exits at the guard
        if (isAlreadyProcessedForDay(claimSystem, tradingDay)) continue;
        executions += 1;
        claimSystem.lastProcessedDay = tradingDay; // the batch write
      }
      expect(executions).toBe(1);

      // Transition-day weirdness: even if a second firing somehow passed the
      // guard, the idempotency read blocks reprocessing.
      const rerun = getClaimProcessingWindow(new Date(`${date}T13:25:00Z`)).inWindow
        && !isAlreadyProcessedForDay(claimSystem, tradingDay);
      expect(rerun).toBe(false);
    });
  }
});
