// api/_utils/callRecords/rollbackRecipe.test.js
//
// Cockpit Build 1a — THE ROLLBACK RECIPE on a seeded corpus (spec
// docs/COCKPIT_BUILD1A_SPEC_V1_2.md §12, §15.11): the window is the last five
// regular ET sessions with calls-enabled model calls; membership is
// `declarationsPhase` present AND a finite `callMs`; the numerator is
// `invalid_tool_result`; the trip is > 3 %; zero data never trips; the
// retained-window coverage is reported.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeCallsEnabledWindow, renderCallsEnabledWindow, isCallsEnabledModelCall, isRegularSessionDate, ROLLBACK_SESSIONS, ROLLBACK_TRIP_RATE, EVALUATIONS_RETENTION_CAP } from './rollbackRecipe.js';

const HERE = dirname(fileURLToPath(import.meta.url));
/** An entry on an ET date (14:30Z = 10:30 ET in September). */
const entry = (day, over = {}) => ({ evalId: `e-${day}-${Math.random().toString(36).slice(2, 6)}`, timestamp: `${day}T14:30:00.000Z`, promptBuiltAt: `${day}T14:30:00.000Z`, decision: 'HOLD', declarationsPhase: 'none', callMs: 1200, ...over });
const invalid = (day) => entry(day, { haikuError: { failureClass: 'invalid_tool_result', message: 'x' } });

describe('membership and the session calendar', () => {
  it('counts only entries with declarationsPhase present AND a finite callMs', () => {
    expect(isCallsEnabledModelCall(entry('2026-09-09'))).toBe(true);
    expect(isCallsEnabledModelCall(entry('2026-09-09', { declarationsPhase: 'expected' }))).toBe(true);
    expect(isCallsEnabledModelCall(entry('2026-09-09', { callMs: null }))).toBe(false);            // the stamp lands on budget-skipped entries too: no dispatch
    expect(isCallsEnabledModelCall({ timestamp: 't', callMs: 900 })).toBe(false);                   // an off-mode check: no stamp
    expect(isCallsEnabledModelCall(entry('2026-09-09', { declarationsPhase: undefined }))).toBe(false);
    expect(isCallsEnabledModelCall(null)).toBe(false);
  });

  it('a regular session date is a trading day in the maintained calendar; weekends, holidays and unmaintained years are not', () => {
    expect(isRegularSessionDate('2026-09-09')).toBe(true);
    expect(isRegularSessionDate('2026-09-12')).toBe(false); // Saturday
    expect(isRegularSessionDate('2026-09-07')).toBe(false); // Labor Day
    expect(isRegularSessionDate('2030-01-07')).toBe(false); // outside MAINTAINED_HOLIDAY_YEARS → null → not counted
  });
});

describe('computeCallsEnabledWindow — the seeded corpus (spec §12)', () => {
  it('takes the LAST five sessions that have data, counts the numerator over them, and trips above 3 %', () => {
    const battles = [
      { id: 'b1', evaluations: [
        ...['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'].flatMap((d) => [entry(d), entry(d), invalid(d)]), // 33 % each — OUTSIDE the window
        ...['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14'].flatMap((d) => Array.from({ length: 8 }, () => entry(d))),
        invalid('2026-09-14'),
      ] },
      { id: 'b2', evaluations: [entry('2026-09-14'), entry('2026-09-14'), entry('2026-09-12'), { timestamp: '2026-09-14T14:30:00.000Z', callMs: 800 }] }, // a Saturday entry and an off-mode entry: excluded
    ];
    const r = computeCallsEnabledWindow(battles);
    expect(r.sessions).toBe(ROLLBACK_SESSIONS);
    expect(r.days).toEqual(['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14']);
    expect(r.modelCalls).toBe(43); // 5 × 8 + 1 invalid + 2 from b2
    expect(r.invalid).toBe(1);
    expect(r.rate).toBeCloseTo(1 / 43, 6); // 2.3 % — under the 3 % trip
    expect(r.tripped).toBe(false);
    expect(r.zeroData).toBe(false);
    expect(r.perDay.find((d) => d.day === '2026-09-14')).toEqual({ day: '2026-09-14', modelCalls: 11, invalid: 1 });
    expect(r.coverage).toEqual({ battles: 2, battlesInWindow: 2, truncatedBattles: [] });
    // Three invalid of 45 → 6.7 %: TRIPPED.
    const worse = [{ id: 'b1', evaluations: [...battles[0].evaluations, invalid('2026-09-14'), invalid('2026-09-14')] }, battles[1]];
    const r2 = computeCallsEnabledWindow(worse);
    expect(r2.invalid).toBe(3);
    expect(r2.rate).toBeGreaterThan(ROLLBACK_TRIP_RATE);
    expect(r2.tripped).toBe(true);
    // Exactly 3 % does not trip (strictly greater).
    const exact = [{ id: 'x', evaluations: [...Array.from({ length: 97 }, () => entry('2026-09-09')), invalid('2026-09-09'), invalid('2026-09-09'), invalid('2026-09-09')] }];
    expect(computeCallsEnabledWindow(exact).rate).toBeCloseTo(0.03, 9);
    expect(computeCallsEnabledWindow(exact).tripped).toBe(false);
  });

  it('zero data → no trip, rate null; sessions without qualifying entries do not count toward the five', () => {
    const r = computeCallsEnabledWindow([{ id: 'b', evaluations: [{ timestamp: '2026-09-09T14:30:00.000Z', callMs: 900 }] }]);
    expect(r).toMatchObject({ days: [], modelCalls: 0, invalid: 0, rate: null, tripped: false, zeroData: true });
    const sparse = computeCallsEnabledWindow([{ id: 'b', evaluations: [entry('2026-08-03'), entry('2026-09-09')] }]);
    expect(sparse.days).toEqual(['2026-08-03', '2026-09-09']); // two sessions with data: both count (fewer than five exist)
    expect(computeCallsEnabledWindow(new Map([['m1', { evaluations: [entry('2026-09-09')] }]])).coverage.battles).toBe(1);
  });

  it('coverage reports battles at the 150-entry retention cap (a truncated history may undercount)', () => {
    const full = { id: 'full', evaluations: Array.from({ length: EVALUATIONS_RETENTION_CAP }, () => entry('2026-09-09')) };
    const r = computeCallsEnabledWindow([full, { id: 'short', evaluations: [entry('2026-09-09')] }]);
    expect(r.coverage).toEqual({ battles: 2, battlesInWindow: 2, truncatedBattles: ['full'] });
    expect(EVALUATIONS_RETENTION_CAP).toBe(150);
    const md = renderCallsEnabledWindow(r);
    expect(md).toContain('150-entry retention cap (full)');
    expect(md).toContain('**PASS**');
    expect(renderCallsEnabledWindow(computeCallsEnabledWindow([]))).toContain('NO DATA (no trip)');
  });

  it('the read script carries the --calls-enabled-window flag and renders this recipe', () => {
    const src = readFileSync(resolve(HERE, '../../../scripts/shadow-read-call-records.mjs'), 'utf8');
    expect(src).toContain("args.includes('--calls-enabled-window')");
    expect(src).toContain('computeCallsEnabledWindow(');
    expect(src).toContain('renderCallsEnabledWindow(');
    expect(src).toContain("import { computeCallsEnabledWindow, renderCallsEnabledWindow } from '../api/_utils/callRecords/rollbackRecipe.js';");
  });
});
