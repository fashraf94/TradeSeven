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
import {
  computeCallsEnabledWindow, renderCallsEnabledWindow, isCallsEnabledModelCall, isRegularSessionDate, ROLLBACK_SESSIONS, ROLLBACK_TRIP_RATE, EVALUATIONS_RETENTION_CAP,
  computeRollbackCheck, renderRollbackCheck, fisherOneSidedGreater, ROLLBACK_CHECK, lastRegularSessions,
} from './rollbackRecipe.js';

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
    expect(src).toContain("import { computeCallsEnabledWindow, renderCallsEnabledWindow, computeRollbackCheck, renderRollbackCheck } from '../api/_utils/callRecords/rollbackRecipe.js';");
  });
});


// ---------------------------------------------------------------------------
// Cockpit Build 2a — THE LIVE ROLLBACK CHECK (spec S-9, ruling R2A-19; bars
// moved by the founder's Oct 4 ruling): the allowlisted battles only; TRIP
// only when total ≥ 60 AND rate > 3 % AND the one-sided Fisher p < 0.05
// against round 3's qualified 1A-C arm (7 of 386). Synthetic counts at, below
// and above each bar, and the founder's six trip points.
describe('Build 2a — computeRollbackCheck (spec S-9)', () => {
  const SESSIONS_5 = ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14'];
  // The synthetic window: the run at the close of Mon Sep 14, its floor before the
  // window (the shipped floor — the end of the shadow era — has its own rows below).
  const AT_SEP_14 = { nowMs: Date.parse('2026-09-14T21:00:00.000Z'), notBefore: '2026-09-01' };
  /** n calls-enabled model calls, k of them invalid, spread over the five sessions, on one owner's battle. */
  const battleOf = (ownerId, n, k, id = `b-${ownerId}-${n}-${k}`, sessions = SESSIONS_5) => ({
    id, ownerId,
    evaluations: Array.from({ length: n }, (_, i) => (i < k ? invalid(sessions[i % sessions.length]) : entry(sessions[i % sessions.length]))),
  });
  const check = (n, k, extra = []) => computeRollbackCheck([battleOf('founder', n, k), ...extra], { allowlist: ['founder'], ...AT_SEP_14 });

  it("the bars and the baseline are the founder's Oct 4 ruling: 60 · 3 % · p < 0.05 against round 3's qualified 1A-C rate, 7 of 386", () => {
    expect(ROLLBACK_CHECK).toMatchObject({ minTotal: 60, tripRate: 0.03, alpha: 0.05, baseline: { invalid: 7, total: 386 } });
    expect(ROLLBACK_CHECK.baseline.label).toBe("round 3's qualified 1A-C arm, 7 of 386");
  });

  // THE TRIP POINTS (founder ruling Oct 4), through the check itself: every one
  // is over 60 calls and over 3 %, so the significance bar decides each pair.
  it.each([
    [3, 60, false], [4, 60, true],
    [4, 75, false], [5, 75, true],
    [5, 100, false], [6, 100, true],
  ])('THE TRIP POINTS — %i invalid of %i calls → trips: %s', (k, n, trips) => {
    expect(check(n, k)).toMatchObject({
      total: n, invalid: k,
      bars: { minSample: true, rate: true, significant: trips },
      tripped: trips, verdict: trips ? 'TRIP' : 'NO TRIP',
    });
  });

  it('THE SAMPLE BAR — at 59 calls nothing trips, even at 4 invalid (6.8 %, p ≈ 0.045: both other bars met); at 60 and 61 it does', () => {
    const below = check(59, 4);
    expect(below).toMatchObject({ total: 59, invalid: 4, bars: { minSample: false, rate: true, significant: true }, tripped: false, verdict: 'NO TRIP' });
    expect(below.p).toBeCloseTo(0.045, 3);
    expect(check(60, 4)).toMatchObject({ total: 60, bars: { minSample: true, rate: true, significant: true }, tripped: true, verdict: 'TRIP' });
    expect(check(61, 4)).toMatchObject({ total: 61, tripped: true, verdict: 'TRIP' });
  });

  it('THE SIGNIFICANCE BAR decides on its own against the real baseline: from the floor to 1,000 calls, the smallest count over 3 % is never significant — pinned, so a reader knows which bar bites', () => {
    const { invalid: refBad, total: refN } = ROLLBACK_CHECK.baseline;
    for (let n = ROLLBACK_CHECK.minTotal; n <= 1000; n += 1) {
      const k = Math.floor(0.03 * n) + 1; // the smallest count over 3 %
      expect(fisherOneSidedGreater(k, n, refBad, refN), `${k}/${n}`).toBeGreaterThanOrEqual(0.05);
    }
    // The smallest count that trips, at a few sample sizes (n + 1 = none does).
    const smallestTrip = (n) => { let k = 0; while (k <= n && !check(n, k).tripped) k += 1; return k; };
    expect([60, 75, 100, 150, 200].map(smallestTrip)).toEqual([4, 5, 6, 8, 10]);
  });

  it('THE RATE BAR is enforced on its own: against a quieter synthetic baseline, exactly 3 % (p = 0.0015) does not trip; 3.5 % does; 2.5 % does not — and on the real baseline no count at or under 3 % is ever significant (60 to 5,000 calls), so there it stands behind the significance bar', () => {
    const quiet = { ...ROLLBACK_CHECK, baseline: { invalid: 0, total: 386, label: 'a synthetic baseline' } };
    const at = (n, k) => computeRollbackCheck([battleOf('founder', n, k)], { allowlist: ['founder'], check: quiet, ...AT_SEP_14 });
    expect(at(200, 6)).toMatchObject({ rate: 0.03, bars: { minSample: true, rate: false, significant: true }, tripped: false, verdict: 'NO TRIP' });
    expect(at(200, 7)).toMatchObject({ bars: { minSample: true, rate: true, significant: true }, tripped: true });
    expect(at(200, 5)).toMatchObject({ bars: { rate: false, significant: true }, tripped: false });
    const { invalid: refBad, total: refN } = ROLLBACK_CHECK.baseline;
    for (let n = ROLLBACK_CHECK.minTotal; n <= 5000; n += 1) {
      const k = Math.floor(0.03 * n); // the largest count at or under 3 %
      if (k > 0) expect(fisherOneSidedGreater(k, n, refBad, refN), `${k}/${n}`).toBeGreaterThanOrEqual(0.05);
    }
  });

  it("ONLY the allowlisted owners' battles count — another owner's invalid results never move it", () => {
    const r = check(150, 0, [battleOf('stranger', 150, 40)]);
    expect(r).toMatchObject({ owners: 1, battles: 1, total: 150, invalid: 0, tripped: false });
  });

  it('NO ALLOWLIST is its own verdict — an unset allowlist measured nothing, never "no data" (review L1-6)', () => {
    const r = computeRollbackCheck([battleOf('founder', 150, 9)], { allowlist: [], ...AT_SEP_14 });
    expect(r).toMatchObject({ owners: 0, battles: 0, total: 0, verdict: 'NO ALLOWLIST', tripped: false });
    expect(computeRollbackCheck([], { allowlist: ['founder'], ...AT_SEP_14 })).toMatchObject({ owners: 1, total: 0, verdict: 'NO DATA' });
    expect(renderRollbackCheck(r).split('\n')[0]).toBe('- Verdict: **NO ALLOWLIST** — COCKPIT_ALLOWLIST_UIDS is not set in this shell or .env.local; nothing was measured.');
  });

  it('THE CALENDAR WINDOW (review L1-1): the last five regular sessions ending at the run, never "the last five with data"', () => {
    expect(lastRegularSessions(AT_SEP_14.nowMs)).toEqual(SESSIONS_5);
    // Over a weekend and the Labor Day holiday: Fri Sep 4 · Tue 8 · Wed 9 · Thu 10 · Fri 11, run on Sat Sep 12.
    expect(lastRegularSessions(Date.parse('2026-09-12T15:00:00.000Z'))).toEqual(['2026-09-04', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']);
    // Older sessions WITH data stay out, however empty the window is: two quiet sessions do not pull Sep 1–2 in.
    const b = battleOf('founder', 30, 0, 'b', ['2026-09-10', '2026-09-11', '2026-09-14']);
    b.evaluations.push(...['2026-09-01', '2026-09-02'].flatMap((d) => [invalid(d), invalid(d)]));
    b.evaluations.push({ timestamp: '2026-09-14T14:30:00.000Z', callMs: 800 }); // an off-mode check: no stamp
    const r = computeRollbackCheck([b], { allowlist: ['founder'], ...AT_SEP_14 });
    expect(r.window.days).toEqual(SESSIONS_5);
    expect(r).toMatchObject({ total: 30, invalid: 0 });
    expect(r.window.perDay.map((d) => d.modelCalls)).toEqual([0, 0, 10, 10, 10]);
  });

  it('THE SHADOW ERA NEVER COUNTS (review L1-1): sessions before the floor are dropped, so shadow-tool entries cannot dilute the live rate', () => {
    expect(ROLLBACK_CHECK.notBefore).toBe('2026-10-02');
    // The reviewer's repro — four shadow sessions (130 calls, 1 invalid each) and two live
    // sessions — re-cut for the 7 of 386 baseline: the live sessions carry 12 of 260 (the
    // repro's 11 of 260 no longer trips on its own, p = 0.058).
    const shadowDays = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'];
    const liveDays = ['2026-10-06', '2026-10-07'];
    const evaluations = [
      ...shadowDays.flatMap((d) => Array.from({ length: 130 }, (_, i) => (i === 0 ? invalid(d) : entry(d)))),
      ...liveDays.flatMap((d) => Array.from({ length: 130 }, (_, i) => (i < 6 ? invalid(d) : entry(d)))),
    ];
    const r = computeRollbackCheck([{ id: 'b', ownerId: 'founder', evaluations }], { allowlist: ['founder'], nowMs: Date.parse('2026-10-07T21:00:00.000Z') });
    expect(r.window.days).toEqual(['2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07']);
    expect(r).toMatchObject({ total: 260, invalid: 12, verdict: 'TRIP' });
    expect(r.p).toBeCloseTo(0.035, 3);
    // Without the floor, even the calendar window admits a shadow session (Oct 1) — and
    // that one session's 130 calls dilute the trip away (13 of 390, p = 0.13): the masking.
    const unfloored = computeRollbackCheck([{ id: 'b', ownerId: 'founder', evaluations }], { allowlist: ['founder'], nowMs: Date.parse('2026-10-07T21:00:00.000Z'), notBefore: null });
    expect(unfloored.window.days).toEqual(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07']);
    expect(unfloored).toMatchObject({ total: 390, invalid: 13, verdict: 'NO TRIP' });
    // … and the recipe's "with data" window — what the live check used to reuse — takes three
    // shadow sessions and pools further (15 of 650, 2.3 %).
    const withData = computeCallsEnabledWindow([{ id: 'b', evaluations }]);
    expect(withData.days).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-06', '2026-10-07']);
    expect({ total: withData.modelCalls, invalid: withData.invalid }).toEqual({ total: 650, invalid: 15 });
    expect(fisherOneSidedGreater(15, 650, ROLLBACK_CHECK.baseline.invalid, ROLLBACK_CHECK.baseline.total)).toBeGreaterThan(0.05);
  });

  it('--since adds a floor INSTANT: entries before the flip\'s deploy on the same day do not count', () => {
    const day = '2026-10-07';
    const evaluations = [
      ...Array.from({ length: 4 }, () => invalid(day)), // 14:30Z — before the deploy
      entry(day, { timestamp: '2026-10-07T18:00:00.000Z', promptBuiltAt: '2026-10-07T18:00:00.000Z' }),
    ];
    const at = { allowlist: ['founder'], nowMs: Date.parse('2026-10-07T21:00:00.000Z') };
    expect(computeRollbackCheck([{ id: 'b', ownerId: 'founder', evaluations }], at)).toMatchObject({ total: 5, invalid: 4 });
    const since = Date.parse('2026-10-07T17:00:00.000Z');
    const r = computeRollbackCheck([{ id: 'b', ownerId: 'founder', evaluations }], { ...at, sinceMs: since });
    expect(r).toMatchObject({ total: 1, invalid: 0 });
    expect(r.window.sinceMs).toBe(since);
    expect(renderRollbackCheck(r)).toContain('since 2026-10-07T17:00:00.000Z');
  });

  it('an entry stamped after the run instant is not counted (the window ends at the run)', () => {
    const r = computeRollbackCheck([{ id: 'b', ownerId: 'founder', evaluations: [entry('2026-09-14', { timestamp: '2026-09-14T22:00:00.000Z' })] }], { allowlist: ['founder'], ...AT_SEP_14 });
    expect(r.total).toBe(0);
  });

  it("the tail equals round 3's own: 1A against A, 13 vs 3 of 386 → p = 0.010 (the round-3 report), and equals the experiment's function on a grid", () => {
    expect(fisherOneSidedGreater(13, 386, 3, 386)).toBeCloseTo(0.010, 3);
    // The experiment script dispatches on import, so its three functions are evaluated from its source text.
    const src = readFileSync(resolve(HERE, '../../../scripts/declarations-wording-experiment.mjs'), 'utf8').replace(/\r\n/g, '\n');
    const start = src.indexOf('const logFact = (() =>');
    const end = src.indexOf('\n}\n', src.indexOf('export function fisherOneSidedGreater')) + 3;
    const body = src.slice(start, end).replace('export function fisherOneSidedGreater', 'function fisherOneSidedGreater');
    // eslint-disable-next-line no-new-func
    const experiment = new Function(`${body}\nreturn fisherOneSidedGreater;`)();
    for (const [a, n, b, m] of [[13, 386, 3, 386], [7, 386, 3, 386], [5, 150, 3, 386], [0, 10, 3, 386], [40, 400, 3, 386], [9, 300, 12, 386]]) {
      expect(fisherOneSidedGreater(a, n, b, m)).toBeCloseTo(experiment(a, n, b, m), 12);
    }
  });

  it('counts must be sane integers', () => {
    expect(() => fisherOneSidedGreater(2, 1, 0, 1)).toThrow();
    expect(() => fisherOneSidedGreater(1.5, 10, 0, 1)).toThrow();
    expect(() => fisherOneSidedGreater(-1, 10, 0, 1)).toThrow();
  });

  it('renderRollbackCheck prints the verdict first, then every count and bar; a trip names the action', () => {
    const md = renderRollbackCheck(check(60, 4));
    // A Vercel environment change reaches new deployments only (review L1-2): the action names the redeploy.
    expect(md.split('\n')[0]).toBe('- Verdict: **TRIP** — remove the uid from COCKPIT_ALLOWLIST_UIDS, redeploy production, and report (spec §10.4).');
    expect(md).toContain('invalid_tool_result 4 of 60');
    expect(md).toContain('total ≥ 60 — met');
    expect(md).toContain('rate > 3 % — met');
    expect(md).toContain("p < 0.05 against round 3's qualified 1A-C arm, 7 of 386 — met (p = 0.0472)");
    expect(renderRollbackCheck(computeRollbackCheck([], { allowlist: ['founder'], ...AT_SEP_14 }))).toContain('**NO DATA**');
    expect(md).toContain('the last 5 regular sessions by the calendar, not before 2026-09-01');
  });

  it('the read script carries --rollback-check, reads the allowlist through the server reader, and is read-only', () => {
    const src = readFileSync(resolve(HERE, '../../../scripts/shadow-read-call-records.mjs'), 'utf8');
    expect(src).toContain("args.includes('--rollback-check')");
    expect(src).toContain('computeRollbackCheck(battles, { allowlist: readCockpitAllowlist(), nowMs: readAtMs, sinceMs })');
    expect(src).toContain("if (rollbackCheck?.verdict === 'NO ALLOWLIST') process.exitCode = 2;");
    // --since is REQUIRED with --rollback-check: no run can silently pool an earlier era (fail closed).
    expect(src).toContain("if (wantRollbackCheck && !sinceArg) throw new Error('--rollback-check needs --since=<ISO instant>");
    expect(src).toContain("import { readCockpitAllowlist } from '../api/_utils/callRecords/allowlist.js';");
    // (`.set(` / `.delete(` appear only on the script's in-memory Maps; no Firestore write exists.)
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/runTransaction|bulkWriter|\.batch\(|\.update\(|\.create\(/);
  });
});
