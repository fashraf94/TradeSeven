// scripts/cockpit-release-read.test.js
//
// The stage read for the cockpit's release switch (scripts/cockpit-release-read.mjs;
// build prompt BUILD_PROMPT_COCKPIT_RELEASE_SWITCH): the tallies on fixtures, the
// trips, the ET session buckets, the cohort count by owner ordinal, the cost
// arithmetic — and that it is read-only and never prints an id. The script
// imports Firestore, the env loader and the release module lazily inside main(),
// so these tests import nothing that reads a credential.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyTick, cohortFlagOf, evaluatorRead, checksRead, answersRead, cohortRead, sweepLagRead, costRead, renderStage, ordinalsOf, sessionDays, etDay, toMs,
  percentile, WALL_TRIP_MS, ON_ERA_START_MS, ON_EXTRA_USD_PER_CHECK, HAIKU_PRICE_PER_MTOK,
} from './cockpit-release-read.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const D1 = '2026-11-12';
const D2 = '2026-11-13';
const DAYS = [D1, D2];
const at = (iso) => iso;
/** A dispatched model-call tick: version 2 = calls active, 1 = off. */
const tick = (iso, { v = 2, outcome = 'ok', failureClass = null, dispatched = true, inputTokens = 1000, outputTokens = 100 } = {}) => ({
  schemaVersion: v, capturedAt: at(iso), model: { dispatched, outcome, failureClass }, callEnvelope: { inputTokens, outputTokens },
});

describe('the ET session and the arm — read from the record, never from the owner', () => {
  it('etDay puts an instant in its ET session: 23:59 ET is still the day, 00:00 ET is the next', () => {
    expect(etDay(Date.parse('2026-11-13T04:59:59Z'))).toBe('2026-11-12');
    expect(etDay(Date.parse('2026-11-13T05:00:00Z'))).toBe('2026-11-13');
    expect(etDay(Date.parse('2026-07-01T03:59:59Z'))).toBe('2026-06-30'); // EDT
    expect(etDay(null)).toBeNull();
  });
  it('sessionDays skips weekends and includes both ends', () => {
    expect(sessionDays('2026-11-12', '2026-11-17')).toEqual(['2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17']);
    expect(sessionDays('2026-11-14', '2026-11-15')).toEqual([]);
  });
  it('classifyTick: schemaVersion 1 is off; 2 is on from the global flip, shadow before it; a call that was not dispatched, or no version, is nothing', () => {
    expect(classifyTick(tick('2026-11-12T15:00:00Z', { v: 1 }))).toBe('off');
    expect(classifyTick(tick('2026-11-12T15:00:00Z', { v: 2 }))).toBe('on');
    expect(classifyTick(tick('2026-10-01T15:00:00Z', { v: 2 }))).toBe('shadow');
    expect(classifyTick({ ...tick('2026-10-05T22:35:33Z', { v: 2 }) })).toBe('shadow');
    expect(classifyTick(tick(new Date(ON_ERA_START_MS).toISOString(), { v: 2 }))).toBe('on');
    expect(classifyTick(tick('2026-11-12T15:00:00Z', { dispatched: false }))).toBeNull();
    expect(classifyTick({ capturedAt: '2026-11-12T15:00:00Z', model: { dispatched: true } })).toBeNull();
    expect(classifyTick(null)).toBeNull();
  });
  it('toMs reads ISO strings, millis and Firestore Timestamp shapes', () => {
    expect(toMs('2026-11-12T15:00:00Z')).toBe(Date.parse('2026-11-12T15:00:00Z'));
    expect(toMs(5)).toBe(5);
    expect(toMs({ toMillis: () => 9 })).toBe(9);
    expect(toMs({ _seconds: 2, _nanoseconds: 5_000_000 })).toBe(2005);
    expect(toMs('nope')).toBeNull();
  });
  it('percentile interpolates and ignores non-finite', () => {
    expect(percentile([1, 2, 3, 4, NaN, null], 0.5)).toBe(2.5);
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe('the evaluator trips (agentEvalRuns)', () => {
  const run = (iso, over = {}) => ({ startedAt: iso, wallMs: 50_000, battlesTotal: 2, evaluated: 2, deferred: 0, modelCalls: 1, budgetSkipped: 0, ...over });
  it('a clean session is not tripped; the largest run is reported', () => {
    const [d1] = evaluatorRead([run('2026-11-12T14:00:00Z'), run('2026-11-12T14:15:00Z', { wallMs: 90_000, battlesTotal: 5, modelCalls: 3 })], DAYS);
    expect(d1).toMatchObject({ runs: 2, budgetSkippedRuns: 0, deferredRuns: 0, overWallRuns: 0, maxWallMs: 90_000, maxBattles: 5, maxModelCalls: 3, tripped: false });
  });
  it('budgetSkipped > 0, deferred > 0 and wallMs > 200 s each trip; exactly 200 s does not', () => {
    for (const [over, key] of [[{ budgetSkipped: 1 }, 'budgetSkippedRuns'], [{ deferred: 1 }, 'deferredRuns'], [{ wallMs: WALL_TRIP_MS + 1 }, 'overWallRuns']]) {
      const [d1] = evaluatorRead([run('2026-11-12T14:00:00Z', over)], DAYS);
      expect(d1[key], key).toBe(1);
      expect(d1.tripped, key).toBe(true);
    }
    expect(evaluatorRead([run('2026-11-12T14:00:00Z', { wallMs: WALL_TRIP_MS })], DAYS)[0].tripped).toBe(false);
  });
  it('runs bucket by their own ET session; a run outside the range is ignored', () => {
    const out = evaluatorRead([run('2026-11-13T04:30:00Z', { budgetSkipped: 2 }), run('2026-11-13T05:30:00Z'), run('2026-12-01T15:00:00Z', { budgetSkipped: 9 })], DAYS);
    expect(out[0].budgetSkippedRuns).toBe(1); // 04:30Z is 23:30 ET on the 12th
    expect(out[1]).toMatchObject({ runs: 1, budgetSkippedRuns: 0 });
  });
  it('an empty session reads zeros and null wall', () => {
    expect(evaluatorRead([], DAYS)[0]).toMatchObject({ runs: 0, maxWallMs: null, tripped: false });
  });
});

describe('`on` against the `off` baseline of the same session', () => {
  it('counts timeouts, 400s and invalid_tool_result per arm; a plain failure class is "other"; non-dispatched ticks are not checks', () => {
    const ticks = [
      tick('2026-11-12T15:00:00Z'), tick('2026-11-12T15:15:00Z', { outcome: 'failed', failureClass: 'timeout' }), tick('2026-11-12T15:30:00Z', { outcome: 'failed', failureClass: '400' }),
      tick('2026-11-12T15:45:00Z', { outcome: 'failed', failureClass: 'invalid_tool_result' }), tick('2026-11-12T16:00:00Z', { outcome: 'failed', failureClass: 'refresh_failed' }),
      tick('2026-11-12T16:15:00Z', { dispatched: false }), tick('2026-11-12T15:00:00Z', { v: 1 }),
    ];
    const [d1] = checksRead(ticks, DAYS);
    expect(d1.on).toEqual({ n: 5, timeout: 1, e400: 1, invalid: 1, other: 1 });
    expect(d1.off).toEqual({ n: 1, timeout: 0, e400: 0, invalid: 0, other: 0 });
  });
  it('flags a rate ABOVE the off baseline; equal or below is ok; the shadow era counts as neither arm', () => {
    const on = [tick('2026-11-12T15:00:00Z'), tick('2026-11-12T15:15:00Z', { outcome: 'failed', failureClass: 'timeout' })]; // 50 %
    const offBetter = Array.from({ length: 4 }, (_, i) => tick(`2026-11-12T1${i}:00:00Z`, { v: 1 })); // 0 %
    const [d1] = checksRead([...on, ...offBetter, tick('2026-10-02T15:00:00Z', { v: 2, outcome: 'failed', failureClass: 'timeout' })], DAYS);
    expect(d1.flags.timeout).toBe('ABOVE');
    expect(d1.tripped).toBe(true);
    const offWorse = [tick('2026-11-12T15:00:00Z', { v: 1, outcome: 'failed', failureClass: 'timeout' })]; // 100 %
    expect(checksRead([...on, ...offWorse], DAYS)[0].flags.timeout).toBe('ok');
    expect(checksRead([...on, tick('2026-11-12T15:00:00Z', { v: 1 }), tick('2026-11-12T15:01:00Z', { v: 1, outcome: 'failed', failureClass: 'timeout' })], DAYS)[0].flags.timeout).toBe('ok'); // 50 % vs 50 %: equal
  });
  it('with no off check that session there is no baseline: a failure is flagged for a human to read, never passed silently', () => {
    const [d1, d2] = checksRead([tick('2026-11-12T15:00:00Z', { outcome: 'failed', failureClass: 'timeout' }), tick('2026-11-13T15:00:00Z')], DAYS);
    expect(d1.flags.timeout).toBe('no baseline');
    expect(d1.tripped).toBe(false);
    expect(d2.flags).toEqual({ timeout: 'ok', e400: 'ok', invalid: 'ok', other: 'ok' });
    const empty = checksRead([], DAYS)[0];
    expect(empty.flags).toEqual({ timeout: 'none', e400: 'none', invalid: 'none', other: 'none' });
    expect(empty.cohortFlags).toEqual({ timeout: 'none', e400: 'none', invalid: 'none', other: 'none' });
  });
  it('the "other" failure class (truncated_response, build_timeout, 5xx …) is flagged like the named three — a failure class is never hidden (RS-L5-3)', () => {
    const on = [tick('2026-11-12T15:00:00Z'), tick('2026-11-12T15:15:00Z', { outcome: 'failed', failureClass: 'truncated_response' })];
    const off = Array.from({ length: 3 }, (_, i) => tick(`2026-11-12T1${i}:00:00Z`, { v: 1 }));
    const [d1] = checksRead([...on, ...off], DAYS);
    expect(d1.flags.other).toBe('ABOVE');
    expect(d1.tripped).toBe(true);
    expect(renderStage({ ...cleanRead(), checks: [d1, checksRead([], DAYS)[1]] })).toMatch(/above the `off` baseline \(other\)/);
  });
  it('the COHORT\'s own checks are a separate arm: a cohort regression is not diluted by the pilot\'s volume, and a clean cohort beside a failing pilot is not a cohort trip (RS-L5-1)', () => {
    const pilot = Array.from({ length: 20 }, (_, i) => ({ ...tick(`2026-11-12T15:${String(i).padStart(2, '0')}:00Z`), cohort: false })); // 20 clean pilot checks
    const bad = [{ ...tick('2026-11-12T16:00:00Z', { outcome: 'failed', failureClass: 'timeout' }), cohort: true }, { ...tick('2026-11-12T16:01:00Z'), cohort: true }]; // 50 % in the cohort
    const off = [tick('2026-11-12T14:00:00Z', { v: 1 }), tick('2026-11-12T14:01:00Z', { v: 1 }), tick('2026-11-12T14:02:00Z', { v: 1 }), tick('2026-11-12T14:03:00Z', { v: 1, outcome: 'failed', failureClass: 'timeout' })]; // 25 %
    const [d1] = checksRead([...pilot, ...bad, ...off], DAYS);
    expect(d1.on.n).toBe(22);
    expect(d1.flags.timeout).toBe('ok'); // 1/22 is under the 25 % baseline: the pooled `on` arm hides it
    expect(d1.cohort).toEqual({ n: 2, timeout: 1, e400: 0, invalid: 0, other: 0 });
    expect(d1.cohortFlags.timeout).toBe('ABOVE'); // the cohort's own rate (50 %) is above
    expect(d1.tripped).toBe(true);
    expect(renderStage({ ...cleanRead(), checks: [d1, checksRead([], DAYS)[1]] })).toMatch(/the COHORT's `on` checks above the `off` baseline \(timeout\)/);
    // a tick whose cohort membership is not determinable (null/absent) is in the pooled arm only
    expect(checksRead([{ ...tick('2026-11-12T15:00:00Z'), cohort: null }, tick('2026-11-12T15:01:00Z')], DAYS)[0].cohort.n).toBe(0);
  });
});

describe('the answer chain (calls and callEvents of `on` battles)', () => {
  const calls = [
    { callId: 'c1', playerResponse: { kind: 'directive', answer: 'go_now' } },
    { callId: 'c2', playerResponse: { kind: 'ack', answer: 'go' } },
    { callId: 'c3', playerResponse: null },
  ];
  const ev = (kind, iso, callId) => ({ kind, at: Date.parse(iso), callIds: [callId] });
  it('a directive answer is a command; an ack is an acknowledgment; heard, acted and no_matching_trade are tallied; days are ET', () => {
    const out = answersRead({ calls, events: [
      ev('answered', '2026-11-12T15:00:00Z', 'c1'), ev('answered', '2026-11-12T15:01:00Z', 'c2'), ev('answered', '2026-11-12T15:02:00Z', 'c3'),
      ev('heard', '2026-11-12T15:15:00Z', 'c1'), ev('acted', '2026-11-12T15:16:00Z', 'c1'), ev('no_matching_trade', '2026-11-13T15:15:00Z', 'c1'),
      ev('declared', '2026-11-12T15:15:00Z', 'c1'), ev('expired', '2026-11-12T15:15:00Z', 'c1'),
      ev('heard', '2026-11-13T04:30:00Z', 'c1'), // 23:30 ET on the 12th
    ] }, DAYS);
    expect(out[0]).toEqual({ day: D1, commands: 1, acknowledgments: 2, heard: 2, acted: 1, noMatchingTrade: 0 });
    expect(out[1]).toEqual({ day: D2, commands: 0, acknowledgments: 0, heard: 0, acted: 0, noMatchingTrade: 1 });
  });
});

describe('the release-cohort battle count — by owner ordinal, never by id', () => {
  const b = (ownerId, over = {}) => ({ gameMode: 'baggerbomb_agent', isCpu: false, ownerId, ordinal: ordinalsOf(['zz-alice', 'zz-bob', 'zz-carol']).get(ownerId), ...over });
  const day = { [D1]: [b('zz-alice'), b('zz-bob'), b('zz-bob'), b('zz-carol', { gameMode: 'baggerbomb_tournament' }), b('zz-carol', { isCpu: true }), b('', {})], [D2]: [] };
  it('ordinals are assigned in sorted order and the ids are not in the map values', () => {
    const m = ordinalsOf(['zz-bob', 'zz-alice', 'zz-bob', '', null, 7]);
    expect([...m.entries()]).toEqual([['zz-alice', 'owner1'], ['zz-bob', 'owner2']]);
  });
  it('with the allowlist: cohort = `on` agent-mode non-CPU battles of owners outside it; League and CPU seats are never counted', () => {
    const r = cohortRead(day, { allowlist: new Set(['zz-alice']) });
    expect(r.basis).toBe('outside the allowlist');
    expect(r.perDay[0]).toMatchObject({ day: D1, onAgentBattles: 3, cohortBattles: 2 });
    expect(r.perDay[0].owners).toEqual([{ ordinal: 'owner2', battles: 2 }]);
    expect(r.perDay[1]).toMatchObject({ onAgentBattles: 0, cohortBattles: 0, owners: [] });
  });
  it('without the allowlist the control document\'s own bucket test is the basis; with neither the count is not determinable (null), never a guess', () => {
    const r = cohortRead(day, { inCohort: (x) => x.ownerId === 'zz-bob' });
    expect(r.basis).toBe('bucket under the share');
    expect(r.perDay[0].cohortBattles).toBe(2);
    const none = cohortRead(day, {});
    expect(none.basis).toBe('not determinable');
    expect(none.perDay[0].cohortBattles).toBeNull();
    expect(none.perDay[0].onAgentBattles).toBe(3);
  });
  it('no owner id appears anywhere in the result', () => {
    const r = JSON.stringify(cohortRead(day, { allowlist: new Set(['zz-alice']) }));
    for (const id of ['zz-alice', 'zz-bob', 'zz-carol']) expect(r).not.toContain(id);
  });
});

describe('the per-battle cohort flag that tags each tick', () => {
  const b = (over = {}) => ({ gameMode: 'baggerbomb_agent', isCpu: false, ownerId: 'zz-bob', ...over });
  it('with the allowlist: agent mode, a real owner, outside it — League, a CPU seat, an empty owner and an allowlisted owner are not the cohort', () => {
    const allowlist = new Set(['zz-alice']);
    expect(cohortFlagOf(b(), { allowlist })).toBe(true);
    expect(cohortFlagOf(b({ ownerId: 'zz-alice' }), { allowlist })).toBe(false);
    expect(cohortFlagOf(b({ gameMode: 'baggerbomb_tournament' }), { allowlist })).toBe(false);
    expect(cohortFlagOf(b({ isCpu: true }), { allowlist })).toBe(false);
    expect(cohortFlagOf(b({ ownerId: '' }), { allowlist })).toBe(false);
    expect(cohortFlagOf(b({ ownerId: null }), { allowlist })).toBe(false);
  });
  it('without the allowlist: the control document\'s bucket test decides; with neither, null — never a guess', () => {
    expect(cohortFlagOf(b(), { inCohort: () => true })).toBe(true);
    expect(cohortFlagOf(b(), { inCohort: () => false })).toBe(false);
    expect(cohortFlagOf(b(), {})).toBeNull();
    expect(cohortFlagOf(b())).toBeNull();
  });
  it('main() tags every tick through it (not an inline copy)', () => {
    const src = readFileSync(resolve(HERE, 'cockpit-release-read.mjs'), 'utf8');
    expect(src).toContain('const cohort = cohortFlagOf(b, { allowlist, inCohort });');
  });
});

describe('sweep lag', () => {
  const NOW = Date.parse('2026-11-13T20:00:00Z');
  const call = (stateSource, changed, due) => ({ stateSource, stateChangedAt: Date.parse(changed), horizon: { expiresAt: Date.parse(due) } });
  it('lag is the sweep\'s stamp minus the deadline (never negative); only sweep-settled calls count; median, p90 and max per ET session', () => {
    const out = sweepLagRead({ nowMs: NOW, queue: [], calls: [
      call('sweep', '2026-11-12T21:00:00Z', '2026-11-12T20:00:00Z'), // 60 min
      call('sweep', '2026-11-12T20:30:00Z', '2026-11-12T20:00:00Z'), // 30 min
      call('sweep', '2026-11-12T19:00:00Z', '2026-11-12T20:00:00Z'), // negative → 0
      call('flip', '2026-11-12T21:00:00Z', '2026-11-12T20:00:00Z'), call('mint', '2026-11-12T21:00:00Z', '2026-11-12T20:00:00Z'),
      { stateSource: 'sweep', stateChangedAt: Date.parse('2026-11-12T21:00:00Z') }, // no deadline: skipped
    ] }, DAYS);
    expect(out.perDay[0]).toMatchObject({ day: D1, swept: 3, medianMs: 30 * 60000, maxMs: 60 * 60000 });
    expect(out.perDay[0].p90Ms).toBeCloseTo(54 * 60000, -2);
    expect(out.perDay[1]).toEqual({ day: D2, swept: 0, endedWithBattle: 0, medianMs: null, p90Ms: null, maxMs: null });
  });
  it('lag buckets by the session of the call\'s DEADLINE, not the stamp\'s day: a Friday-close call the sweep settled on Saturday is Friday\'s lag (RS-L5-5)', () => {
    const days = ['2026-11-13', '2026-11-16'];
    const out = sweepLagRead({ nowMs: Date.parse('2026-11-16T20:00:00Z'), queue: [], calls: [call('sweep', '2026-11-14T15:00:00Z', '2026-11-13T21:00:00Z')] }, days); // Fri 4 PM ET deadline, stamped Sat
    expect(out.perDay[0]).toMatchObject({ day: '2026-11-13', swept: 1, maxMs: 18 * 3600000 });
    expect(out.perDay[1].swept).toBe(0);
  });
  it('an ended_with_battle settle is counted apart and carries no lag: its deadline is after the battle\'s end, so a lag would clamp to 0 (RS-L5-4)', () => {
    const ended = { ...call('sweep', '2026-11-12T21:00:00Z', '2026-11-12T22:00:00Z'), state: 'ended_with_battle' };
    const out = sweepLagRead({ nowMs: NOW, queue: [], calls: [ended, { ...call('sweep', '2026-11-12T21:00:00Z', '2026-11-12T20:00:00Z'), state: 'expired' }] }, DAYS);
    expect(out.perDay[0]).toMatchObject({ swept: 1, endedWithBattle: 1, maxMs: 60 * 60000 });
  });
  it('the deadline is the sweep\'s own (a next_check call settles at the session close, so its lag is not counted from the slot): an injected deadlineOf replaces horizon.expiresAt', () => {
    const c = { stateSource: 'sweep', stateChangedAt: Date.parse('2026-11-12T21:00:00Z'), horizon: { expiresAt: Date.parse('2026-11-12T15:15:00Z'), basis: 'next_check' } };
    const byHorizon = sweepLagRead({ nowMs: NOW, queue: [], calls: [c] }, DAYS);
    expect(byHorizon.perDay[0].maxMs).toBe(345 * 60000);
    const bySweep = sweepLagRead({ nowMs: NOW, queue: [], calls: [c], deadlineOf: () => Date.parse('2026-11-12T20:00:00Z') }, DAYS);
    expect(bySweep.perDay[0].maxMs).toBe(60 * 60000);
    expect(sweepLagRead({ nowMs: NOW, queue: [], calls: [c], deadlineOf: () => null }, DAYS).perDay[0].swept).toBe(0);
  });
  it('overdue queue rows: nextExpiresAt in the past; null and future rows are not overdue', () => {
    const out = sweepLagRead({ nowMs: NOW, calls: [], queue: [{ nextExpiresAt: NOW - 1 }, { nextExpiresAt: NOW + 1 }, { nextExpiresAt: null }, { nextExpiresAt: 0 }, {}] }, DAYS);
    expect(out.overdueQueueRows).toBe(1);
  });
});

describe('the cost line', () => {
  it('model cost is input × $1 + output × $5 per million, over `on` checks only; the extra is checks × the report\'s estimate', () => {
    const ticks = [
      tick('2026-11-12T15:00:00Z', { inputTokens: 1_000_000, outputTokens: 1_000_000 }),
      tick('2026-11-12T15:15:00Z', { v: 1, inputTokens: 9e9, outputTokens: 9e9 }), // off: not counted
      tick('2026-10-02T15:15:00Z', { v: 2, inputTokens: 9e9, outputTokens: 9e9 }), // shadow: not counted
      tick('2026-11-12T15:30:00Z', { dispatched: false, inputTokens: 9e9 }),
    ];
    const [d1, d2] = costRead(ticks, DAYS);
    expect(HAIKU_PRICE_PER_MTOK).toEqual({ input: 1, output: 5 });
    expect(d1).toMatchObject({ onChecks: 1, inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(d1.modelUsd).toBeCloseTo(6, 9);
    expect(d1.extraUsd).toBeCloseTo(ON_EXTRA_USD_PER_CHECK, 9);
    expect(d2).toMatchObject({ onChecks: 0, modelUsd: 0, extraUsd: 0 });
  });
});

function cleanRead() {
  return {
    readAtMs: Date.parse('2026-11-13T20:00:00Z'), days: DAYS, control: 'active, 500 bp',
    evaluator: evaluatorRead([], DAYS), checks: checksRead([tick('2026-11-12T15:00:00Z'), tick('2026-11-12T15:00:00Z', { v: 1 })], DAYS), answers: answersRead({ calls: [], events: [] }, DAYS),
    cohort: cohortRead({ [D1]: [], [D2]: [] }, { allowlist: new Set(['x']) }), sweep: sweepLagRead({ calls: [], queue: [], nowMs: 1 }, DAYS), cost: costRead([tick('2026-11-12T15:00:00Z')], DAYS),
  };
}

describe('the rendering', () => {
  const clean = cleanRead;
  it('a clean read says "Trips: none" and carries every section and the control line', () => {
    const md = renderStage(clean());
    expect(md).toContain('**Trips:** none.');
    for (const h of ['### Evaluator runs', '### Model-call checks', '### Answers', '### Release-cohort battles', '### Sweep lag', '### Cost line']) expect(md).toContain(h);
    expect(md).toContain('control document: active, 500 bp');
    expect(md).toContain('Queue rows overdue at the read: **0**');
  });
  it('a tripped read names the session and the reason', () => {
    const read = clean();
    read.evaluator = evaluatorRead([{ startedAt: '2026-11-12T14:00:00Z', wallMs: WALL_TRIP_MS + 5, battlesTotal: 1, modelCalls: 1, deferred: 1, budgetSkipped: 0 }], DAYS);
    read.checks = checksRead([tick('2026-11-12T15:00:00Z', { outcome: 'failed', failureClass: 'timeout' }), tick('2026-11-12T15:15:00Z', { v: 1 })], DAYS);
    const md = renderStage(read);
    expect(md).toMatch(/\*\*Trips:\*\* 2026-11-12: evaluator \(0 budget-skipped run\(s\), 1 deferred, 1 over 200 s\); 2026-11-12: `on` checks above the `off` baseline \(timeout\)/);
  });
  it('the sweep, cost and cohort rows render dashes for nothing rather than NaN', () => {
    const md = renderStage(clean());
    expect(md).not.toMatch(/NaN|undefined|null/);
  });
});

describe('the script is read-only, needs no uid and prints no id', () => {
  const src = readFileSync(resolve(HERE, 'cockpit-release-read.mjs'), 'utf8').replace(/\r\n/g, '\n');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // A write is `.set/.add/.update/.delete/.create(` on anything but the two local Maps (`map`, `owners`), or a transaction/batch/bulk
  // writer. Receiver-checked, not name-blinded: a Firestore `ref.set(` or `db.collection(…).doc(…).set(` must be caught (RS-L5-2).
  const MAP_RECEIVERS = new Set(['map', 'owners']);
  const foreignWrites = (c) => [
    ...[...c.matchAll(/([\w$]+|\))\s*\.\s*(set|add|update|delete|create)\s*\(/g)].filter(([, r, m]) => !(m === 'set' && MAP_RECEIVERS.has(r))).map(([s]) => s),
    ...(c.match(/runTransaction|bulkWriter|\.batch\s*\(|writeBatch|recursiveDelete|\.create\s*\(/g) || []),
  ];
  it('no Firestore write call exists; the only file written is --out', () => {
    expect(foreignWrites(code)).toEqual([]);
    expect(code.match(/writeFileSync\(/g)).toHaveLength(1);
    expect(code).toMatch(/\.get\(\)/);
  });
  it('planted: the write scan is not blind — a Firestore set/update/delete/add/create, a chained set, a transaction or a batch each fail it', () => {
    for (const planted of ["ref.set({ a: 1 });", "db.collection('x').doc('y').set({ a: 1 });", "ref.update({ a: 1 });", "ref.delete();", "col.add({});", "await db.runTransaction(async () => {});", "db.batch();", "const w = db.bulkWriter();"]) {
      expect(foreignWrites(`${code}\n${planted}`).length, planted).toBeGreaterThan(0);
    }
    expect(foreignWrites(`${code}\nowners.set(1, 2); map.set('a', 'b');`)).toEqual([]); // the two local Maps stay allowed
  });
  it('the allowlist is OPTIONAL (no "must hold" throw), and the rendering never touches ownerId / agentId / battle ids', () => {
    expect(src).not.toMatch(/must hold/);
    const render = src.slice(src.indexOf('export function renderStage'), src.indexOf('// ---------------------------------------------------------------- the run'));
    expect(render).not.toMatch(/ownerId|agentId|battleId|\.id\b|doc\.id/);
    expect(code).not.toMatch(/console\.(log|error|warn)\([^)]*(ownerId|\.id\b|uid)/);
  });
  it('main() hands the sweep lag the sweep\'s own callDeadlineMs', () => {
    expect(src).toContain("const { callDeadlineMs } = await import('../api/_utils/callRecords/sweep.js');");
    expect(src).toContain('deadlineOf: callDeadlineMs');
  });
  it('the arm is read from the tick\'s own schemaVersion, never from the owner', () => {
    const fn = src.slice(src.indexOf('export function classifyTick'), src.indexOf('/**\n * Is this battle in the release cohort?'));
    expect(fn).toMatch(/schemaVersion/);
    expect(fn).not.toMatch(/ownerId|allowlist/);
  });
});
