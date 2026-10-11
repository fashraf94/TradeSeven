// api/cron/process-pending-reflections.outcome.test.js
//
// Reflection outage fix (package P-OUT-1, founder rulings O2–O4) — the host
// rows for failure handling and the budget. generateReflection is mocked (its
// own battery is api/agent/reflect.generateReflection.test.js); the battle doc
// lives in the Wire suite's in-memory Firestore, so the claim transaction, the
// outcome write and the real Wire sweep all run.
//   • a failure leaves the flag set, raises the attempt count, records why;
//   • the third failure clears the flag and marks the battle reflectionNoLesson;
//   • a success clears the flag exactly as before, now with its outcome;
//   • a battle can never loop: attempts are claimed before the call, so a run
//     that dies inside an attempt still counts, and a spent battle leaves;
//   • one slow reflection does not starve the tenants that follow it.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createFirestoreFake } from '../_utils/__fixtures__/wireFirestoreFake.js';

const flagState = { metricsEnabled: false, writesEnabled: true, continuityEnabled: false };
vi.mock('../_utils/wireFlags.js', () => ({ getWireFlags: () => ({ ...flagState }) }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({ ...(await importOriginal()), CALL_RECORDS_MODE: 'off' }));

let fakeDb;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => fakeDb }));

const reflectMock = vi.fn();
vi.mock('../agent/reflect.js', () => ({ generateReflection: (...args) => reflectMock(...args) }));

// The two handler-anchored tenants: capture what they are handed and when.
const tenantCalls = { callSweep: [], review: [] };
vi.mock('../_utils/callRecords/sweep.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, runCallSweep: async (args) => { tenantCalls.callSweep.push({ ...args, calledAtMs: Date.now() }); return { skipped: 'off' }; } };
});
vi.mock('../_utils/hypothesisRecords/reviewPass.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, runHypothesisReviewPass: async (args) => { tenantCalls.review.push({ ...args, calledAtMs: Date.now() }); return { skipped: 'disabled' }; } };
});

const { default: handler } = await import('./process-pending-reflections.js');
const { publishStoryWithWire } = await import('../_utils/wireWriteThrough.js');
const { REFLECTION_TIMEOUT_MS, MAX_REFLECTION_ATTEMPTS, buildReflectionOutcome } = await import('../_utils/reflectionOutcome.js');
const { sweepDeadline, SWEEP_STARVATION_MS } = await import('../_utils/callRecords/sweep.js');
const { reviewDeadline, REVIEW_STARVATION_MS } = await import('../_utils/hypothesisRecords/reviewPass.js');

const NOW = new Date('2026-10-12T21:00:00Z');
const MARKET_DATE = '2026-10-12';
const cronReq = () => ({ headers: { 'x-vercel-cron': '1' }, method: 'GET' });
function makeRes() {
  const out = { statusCode: null, body: null };
  out.status = (code) => ({ json: (payload) => { out.statusCode = code; out.body = payload; return out; } });
  return out;
}
const battle = async (id) => (await fakeDb.collection('agentBattles').doc(id).get()).data();
const seedPending = (id, extra = {}, completedAt = '2026-10-12T20:00:00Z') =>
  fakeDb.collection('agentBattles').doc(id).set({ status: 'completed', pendingReflection: true, completedAt, ...extra });

const failedResult = (attempt, failureClass = 'timeout') => ({
  outcome: 'failed',
  record: buildReflectionOutcome({ outcome: 'failed', failureClass, errorName: 'ReflectionDeadlineError', elapsedMs: REFLECTION_TIMEOUT_MS, attempt, at: NOW.toISOString() }),
});
const okResult = (attempt) => ({
  outcome: 'ok',
  record: buildReflectionOutcome({ outcome: 'ok', elapsedMs: 18_000, stopReason: 'tool_use', usage: { input_tokens: 3_800, output_tokens: 950 }, model: 'claude-sonnet-4-6', attempt, at: NOW.toISOString() }),
});
// The mock answers per the attempt number the host claimed and passed in.
const answer = (fn) => reflectMock.mockImplementation(async (_db, _id, { attempt }) => fn(attempt));

beforeEach(() => {
  fakeDb = createFirestoreFake();
  flagState.writesEnabled = true;
  tenantCalls.callSweep.length = 0;
  tenantCalls.review.length = 0;
  reflectMock.mockReset();
});
afterEach(() => { vi.useRealTimers(); });

describe('a failure is retried with a cap, never saved, never looped (O3)', () => {
  it('a failure leaves the flag SET, raises the attempt count, and records why', async () => {
    await seedPending('b1');
    answer((attempt) => failedResult(attempt));
    const res = makeRes();
    await handler(cronReq(), res);

    expect(reflectMock).toHaveBeenCalledWith(fakeDb, 'b1', { attempt: 1 });
    const b = await battle('b1');
    expect(b.pendingReflection).toBe(true);           // the next tick retries
    expect(b.reflectionAttempts).toBe(1);
    expect(b.reflectionOutcome).toMatchObject({ outcome: 'failed', failureClass: 'timeout', attempt: 1 });
    expect(b).not.toHaveProperty('reflectedAt');
    expect(b).not.toHaveProperty('reflectionNoLesson');
    expect(res.body).toMatchObject({ processed: 1, succeeded: 0, failed: 1 });
  });

  it('the THIRD failure clears the flag and marks the battle finished without a lesson; a fourth tick never calls', async () => {
    await seedPending('b1');
    answer((attempt) => failedResult(attempt, attempt === 3 ? 'http_529' : 'timeout'));
    for (let tick = 1; tick <= 3; tick++) await handler(cronReq(), makeRes());

    expect(reflectMock.mock.calls.map((c) => c[2].attempt)).toEqual([1, 2, 3]);
    const b = await battle('b1');
    expect(b.pendingReflection).toBe(false);          // it left the queue
    expect(b.reflectionNoLesson).toBe(true);
    expect(b.reflectionAttempts).toBe(MAX_REFLECTION_ATTEMPTS);
    expect(b.reflectionOutcome).toMatchObject({ outcome: 'failed', failureClass: 'http_529', attempt: 3 });
    expect(b).not.toHaveProperty('reflectedAt');

    await handler(cronReq(), makeRes());
    expect(reflectMock).toHaveBeenCalledTimes(3);
  });

  it('a success clears the flag as before and records ok; after an earlier failure it is attempt 2', async () => {
    await seedPending('b1');
    answer((attempt) => (attempt === 1 ? failedResult(1) : okResult(attempt)));
    await handler(cronReq(), makeRes());
    const res = makeRes();
    await handler(cronReq(), res);

    const b = await battle('b1');
    expect(b.pendingReflection).toBe(false);
    expect(b.reflectedAt).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    expect(b.reflectionAttempts).toBe(2);
    expect(b.reflectionOutcome).toMatchObject({ outcome: 'ok', failureClass: null, attempt: 2, stopReason: 'tool_use' });
    expect(b).not.toHaveProperty('reflectionNoLesson');
    expect(res.body).toMatchObject({ processed: 1, succeeded: 1, failed: 0 });
  });

  it('a skip (nothing to reflect) clears the flag with no outcome record, as before', async () => {
    await seedPending('b1');
    reflectMock.mockResolvedValue({ outcome: 'skipped', reason: 'agent_missing' });
    await handler(cronReq(), makeRes());
    const b = await battle('b1');
    expect(b.pendingReflection).toBe(false);
    expect(b.reflectedAt).toEqual(expect.any(String));
    expect(b).not.toHaveProperty('reflectionOutcome');
  });

  it('a malformed result is a failed attempt (class unknown), never a cleared flag', async () => {
    await seedPending('b1');
    reflectMock.mockResolvedValue(undefined);
    await handler(cronReq(), makeRes());
    const b = await battle('b1');
    expect(b.pendingReflection).toBe(true);
    expect(b.reflectionOutcome).toMatchObject({ outcome: 'failed', failureClass: 'unknown', attempt: 1 });
  });

  it('an unexpected THROW still spends the attempt (claimed before the call) and is recorded failed/unknown; the third finishes the battle', async () => {
    await seedPending('b1');
    reflectMock.mockRejectedValue(new Error('5 NOT_FOUND: agent read failed'));
    await handler(cronReq(), makeRes());
    let b = await battle('b1');
    expect(b).toMatchObject({ pendingReflection: true, reflectionAttempts: 1 });
    expect(b.reflectionOutcome).toMatchObject({ outcome: 'failed', failureClass: 'unknown', errorName: 'Error', model: null, attempt: 1 });

    await handler(cronReq(), makeRes());
    await handler(cronReq(), makeRes());
    expect(reflectMock).toHaveBeenCalledTimes(3);
    b = await battle('b1');
    expect(b).toMatchObject({ pendingReflection: false, reflectionNoLesson: true, reflectionAttempts: 3 });
    expect(b.reflectionOutcome).toMatchObject({ outcome: 'failed', failureClass: 'unknown', attempt: 3 });

    await handler(cronReq(), makeRes());
    expect(reflectMock).toHaveBeenCalledTimes(3); // gone from the queue
  });

  it('a throw from the OUTCOME write after an ok never records a failure; the next attempt finds the lesson and clears', async () => {
    await seedPending('b1');
    answer((attempt) => (attempt === 1 ? okResult(1) : { outcome: 'ok', reason: 'already_recorded', record: buildReflectionOutcome({ outcome: 'ok', model: null, attempt, at: NOW.toISOString() }) }));
    const realCollection = fakeDb.collection.bind(fakeDb);
    let outcomeWrites = 0;
    fakeDb.collection = (name) => {
      const c = realCollection(name);
      if (name !== 'agentBattles') return c;
      return { ...c, where: c.where.bind(c), doc: (id) => { const ref = c.doc(id); return Object.assign(Object.create(Object.getPrototypeOf(ref)), ref, { update: async (patch) => { if ('reflectionOutcome' in patch && outcomeWrites++ === 0) throw new Error('DEADLINE_EXCEEDED'); return ref.update(patch); } }); } };
    };
    await handler(cronReq(), makeRes());
    let b = await battle('b1');
    expect(b).toMatchObject({ pendingReflection: true, reflectionAttempts: 1 });
    expect(b).not.toHaveProperty('reflectionOutcome'); // NOT a failed/unknown record over a landed success

    await handler(cronReq(), makeRes());
    b = await battle('b1');
    expect(b).toMatchObject({ pendingReflection: false, reflectionAttempts: 2, reflectionOutcome: { outcome: 'ok', attempt: 2 } });
    expect(b.reflectedAt).toEqual(expect.any(String));
    expect(b).not.toHaveProperty('reflectionNoLesson');
  });

  it('a run that died inside its third attempt gets a recovery pass with NO model call; no lesson → finished without one, with a record', async () => {
    await seedPending('b1', { reflectionAttempts: 3 });
    // The real generateReflection answers a modelCall:false pass like this when no lesson landed.
    reflectMock.mockImplementation(async (_db, _id, { attempt, modelCall }) => ({
      outcome: 'failed', record: buildReflectionOutcome({ outcome: 'failed', failureClass: 'unknown', model: null, attempt, at: NOW.toISOString() }), modelCall,
    }));
    const res = makeRes();
    await handler(cronReq(), res);
    expect(reflectMock).toHaveBeenCalledTimes(1);
    expect(reflectMock).toHaveBeenCalledWith(fakeDb, 'b1', { attempt: 3, modelCall: false });
    const b = await battle('b1');
    expect(b).toMatchObject({ pendingReflection: false, reflectionNoLesson: true, reflectionAttempts: 3, reflectionOutcome: { failureClass: 'unknown', attempt: 3 } });
    expect(res.body).toMatchObject({ processed: 1, failed: 1 });
  });

  it('the recovery pass finds a lesson that DID land (attempt 3 ok, battle write lost): cleared as a success, never marked no-lesson (review RV-4)', async () => {
    await seedPending('b1', { reflectionAttempts: 3, reflectionOutcome: failedResult(2).record });
    reflectMock.mockResolvedValue({ outcome: 'ok', reason: 'already_recorded', record: buildReflectionOutcome({ outcome: 'ok', model: null, attempt: 3, at: NOW.toISOString() }) });
    await handler(cronReq(), makeRes());
    expect(reflectMock).toHaveBeenCalledWith(fakeDb, 'b1', { attempt: 3, modelCall: false });
    const b = await battle('b1');
    expect(b).toMatchObject({ pendingReflection: false, reflectionAttempts: 3, reflectionOutcome: { outcome: 'ok', attempt: 3 } });
    expect(b.reflectedAt).toEqual(expect.any(String));
    expect(b).not.toHaveProperty('reflectionNoLesson');
  });
});

describe('the budget — one slow reflection does not starve the tenants (O2)', () => {
  const seedDeferredWireStory = () => publishStoryWithWire(fakeDb, {
    storyDoc: { reporter: 'doug', type: 'earnings_recap', headline: 'h', body: 'b', tickers: ['NVDA'], primaryTicker: 'NVDA', publishedAt: NOW, status: 'published' },
    rawAgentFacts: { eventType: 'earnings_recap', tickers: ['NVDA'], direction: 'up', magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' } },
    stopReason: 'tool_use', reporter: 'doug', seam: 'doug_earnings_recap', primaryTicker: 'NVDA',
    triggerRef: 'outcome-test', marketDate: MARKET_DATE, now: NOW, deferTransaction: true,
  });

  it('a reflection that runs its FULL deadline is the only one that tick; the Wire sweep still runs, the call sweep and review pass keep room', async () => {
    vi.useFakeTimers({ now: NOW });
    await seedPending('b1', {}, '2026-10-12T19:00:00Z');
    await seedPending('b2', {}, '2026-10-12T19:30:00Z');
    await seedPending('b3', {}, '2026-10-12T20:00:00Z');
    const { storyRef } = await seedDeferredWireStory();
    answer((attempt) => { vi.setSystemTime(new Date(Date.now() + REFLECTION_TIMEOUT_MS)); return failedResult(attempt); });
    const res = makeRes();
    await handler(cronReq(), res);

    expect(reflectMock).toHaveBeenCalledTimes(1);     // b2, b3 wait for the next tick
    expect(reflectMock.mock.calls[0][1]).toBe('b1');  // oldest first
    expect(res.body).toMatchObject({ processed: 1, failed: 1, skipped: 2 });
    expect((await battle('b2')).pendingReflection).toBe(true);
    expect(await battle('b2')).not.toHaveProperty('reflectionAttempts'); // never claimed

    // The Wire sweep ran and did its work (it needs > 5 s of TIME_BUDGET_MS).
    expect(res.body.wireSweep).not.toBeNull();
    expect(res.body.wireSweep.replayed).toBe(1);
    expect((await storyRef.get()).data().wirePending).toBe(false);

    // The handler-anchored tenants were handed real room, not a starved slice.
    expect(tenantCalls.callSweep).toHaveLength(1);
    const cs = tenantCalls.callSweep[0];
    expect(cs.handlerStartMs).toBe(NOW.getTime());
    expect(sweepDeadline({ nowMs: cs.calledAtMs, handlerStartMs: cs.handlerStartMs }) - cs.calledAtMs).toBeGreaterThanOrEqual(SWEEP_STARVATION_MS);
    expect(tenantCalls.review).toHaveLength(1);
    const rp = tenantCalls.review[0];
    expect(reviewDeadline({ nowMs: rp.calledAtMs, handlerStartMs: rp.handlerStartMs }) - rp.calledAtMs).toBeGreaterThanOrEqual(REVIEW_STARVATION_MS);
  });

  it('a slow queue read (a cold start) still starts the FIRST reflection — the queue always moves', async () => {
    vi.useFakeTimers({ now: NOW });
    await seedPending('b1');
    answer((attempt) => okResult(attempt));
    // The pending-reflections query takes 5 s: past the point where a full
    // deadline would still end inside the phase.
    const slowQuery = (q) => new Proxy(q, {
      get(target, key) {
        const v = target[key];
        if (key === 'get') return async (...a) => { vi.setSystemTime(new Date(Date.now() + 5_000)); return v.apply(target, a); };
        if (key === 'where' || key === 'orderBy' || key === 'limit') return (...a) => slowQuery(v.apply(target, a));
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    const realCollection = fakeDb.collection.bind(fakeDb);
    fakeDb.collection = (name) => {
      const c = realCollection(name);
      return name === 'agentBattles' ? { ...c, doc: c.doc.bind(c), where: (...a) => slowQuery(c.where(...a)) } : c;
    };
    const res = makeRes();
    await handler(cronReq(), res);
    expect(reflectMock).toHaveBeenCalledTimes(1);
    expect(res.body).toMatchObject({ processed: 1, succeeded: 1 });
  });

  // Review RV-2: rows that pin the phase and the write reserve themselves.
  // A first reflection that ends at t seconds lets a second start only if
  // t + 35 s (deadline) + 3 s (reserve) <= 40 s (phase), i.e. t <= 2 s.
  const runTick = async (firstMs) => {
    vi.useFakeTimers({ now: NOW });
    await seedPending('b1', {}, '2026-10-12T19:00:00Z');
    await seedPending('b2', {}, '2026-10-12T19:30:00Z');
    let n = 0;
    answer((attempt) => { n += 1; vi.setSystemTime(new Date(Date.now() + (n === 1 ? firstMs : REFLECTION_TIMEOUT_MS))); return okResult(attempt); });
    const res = makeRes();
    await handler(cronReq(), res);
    return res;
  };

  it('a realistic 10 s first reflection: no second start, and every tenant keeps room', async () => {
    const res = await runTick(10_000);
    expect(reflectMock).toHaveBeenCalledTimes(1);
    expect(res.body).toMatchObject({ processed: 1, succeeded: 1, skipped: 1 });
    const cs = tenantCalls.callSweep[0];
    expect(sweepDeadline({ nowMs: cs.calledAtMs, handlerStartMs: cs.handlerStartMs }) - cs.calledAtMs).toBeGreaterThanOrEqual(SWEEP_STARVATION_MS);
    const rp = tenantCalls.review[0];
    expect(reviewDeadline({ nowMs: rp.calledAtMs, handlerStartMs: rp.handlerStartMs }) - rp.calledAtMs).toBeGreaterThanOrEqual(REVIEW_STARVATION_MS);
  });

  it('a first reflection ending at 3 s: no second start (the 3 s write reserve is part of the rule)', async () => {
    await runTick(3_000);
    expect(reflectMock).toHaveBeenCalledTimes(1);
  });

  it('a first reflection ending at 1.5 s: the second DOES start — the rule is the whole deadline fitting, not "one per tick"', async () => {
    const res = await runTick(1_500);
    expect(reflectMock).toHaveBeenCalledTimes(2);
    expect(res.body).toMatchObject({ processed: 2, succeeded: 2, skipped: 0 });
  });

  it('the ceiling covers the worst path: a full-deadline reflection, then its own 30 s consolidation call, then the writes', async () => {
    const { config } = await import('./process-pending-reflections.js');
    const CONSOLIDATION_RACE_MS = 30_000; // agentConsolidationApply.js SONNET_TIMEOUT_MS
    expect(config.maxDuration).toBe(120);
    expect(config.maxDuration * 1000).toBeGreaterThanOrEqual(5_000 + REFLECTION_TIMEOUT_MS + CONSOLIDATION_RACE_MS + 10_000);
    expect(readFileSync(new URL('../_utils/agentConsolidationApply.js', import.meta.url), 'utf8')).toMatch(/const SONNET_TIMEOUT_MS = 30_000;/);
  });

  it('fast reflections still share a tick: a second one starts while its whole deadline fits the phase', async () => {
    vi.useFakeTimers({ now: NOW });
    await seedPending('b1', {}, '2026-10-12T19:00:00Z');
    await seedPending('b2', {}, '2026-10-12T19:30:00Z');
    answer((attempt) => okResult(attempt)); // instant
    const res = makeRes();
    await handler(cronReq(), res);
    expect(reflectMock).toHaveBeenCalledTimes(2);
    expect(res.body).toMatchObject({ processed: 2, succeeded: 2, skipped: 0 });
  });
});
