// api/cron/process-pending-reflections.test.js
// HOST-INTEGRATION acceptance for the Wire sweep rider (V1.6 A5 / r2 M3).
// The unit suites prove the sweep works when CALLED; these prove the host
// actually calls it — the C1 defect (early return on an empty reflection
// queue) made the sweep dead code on almost every tick while every unit
// test stayed green. Each test here fails under a specific host defect:
//   • empty-queue test        → fails under C1 (early return restored)
//   • sweep-throw test        → fails if the isolating try/catch is removed
//   • budget-floor test       → fails if the 5s floor stops being honored
//   • flag-gate test          → fails if the sweep runs with writes OFF

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFirestoreFake } from '../_utils/__fixtures__/wireFirestoreFake.js';

const flagState = { metricsEnabled: false, writesEnabled: true, continuityEnabled: false };
vi.mock('../_utils/wireFlags.js', () => ({
  getWireFlags: () => ({ ...flagState }),
}));

let fakeDb;
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => fakeDb,
}));

const reflectMock = vi.fn();
vi.mock('../agent/reflect.js', () => ({
  generateReflection: (...args) => reflectMock(...args),
}));

// Passthrough with an override hook: null → the REAL sweep runs (the
// integration under test); a function → that implementation (throw injection).
const sweepControl = { impl: null };
vi.mock('../_utils/wireReplaySweep.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    runWireReplaySweep: (...args) =>
      sweepControl.impl ? sweepControl.impl(...args) : real.runWireReplaySweep(...args),
  };
});

const { default: handler } = await import('./process-pending-reflections.js');
const { publishStoryWithWire } = await import('../_utils/wireWriteThrough.js');

const NOW = new Date('2026-07-24T18:00:00Z');
const MARKET_DATE = '2026-07-24';

const cronReq = () => ({ headers: { 'x-vercel-cron': '1' }, method: 'GET' });

function makeRes() {
  const out = { statusCode: null, body: null };
  out.status = (code) => ({ json: (payload) => { out.statusCode = code; out.body = payload; return out; } });
  return out;
}

/** A story stamped wirePending with its envelope — sweep work, waiting. */
const seedDeferredWireStory = () =>
  publishStoryWithWire(fakeDb, {
    storyDoc: {
      reporter: 'doug', type: 'earnings_recap', headline: 'h', body: 'b',
      tickers: ['NVDA'], primaryTicker: 'NVDA', publishedAt: NOW, status: 'published',
    },
    rawAgentFacts: {
      eventType: 'earnings_recap', tickers: ['NVDA'], direction: 'up',
      magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' },
    },
    stopReason: 'tool_use',
    reporter: 'doug', seam: 'doug_earnings_recap', primaryTicker: 'NVDA',
    triggerRef: 'host-test', marketDate: MARKET_DATE, now: NOW,
    deferTransaction: true,
  });

const seedPendingBattle = (id = 'b1') =>
  fakeDb.collection('agentBattles').doc(id).set({
    status: 'completed', pendingReflection: true,
    completedAt: '2026-07-24T17:00:00Z',
  });

beforeEach(() => {
  fakeDb = createFirestoreFake();
  flagState.writesEnabled = true;
  sweepControl.impl = null;
  reflectMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the sweep rider runs on the steady-state tick (C1 regression)', () => {
  it('EMPTY reflection queue still reaches the sweep — the deferred story is replayed', async () => {
    const { storyRef } = await seedDeferredWireStory();
    const res = makeRes();

    await handler(cronReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('No pending reflections');
    expect(res.body.processed).toBe(0);
    // The load-bearing assertion: the sweep RAN and did real work.
    expect(res.body.wireSweep).not.toBeNull();
    expect(res.body.wireSweep.replayed).toBe(1);
    expect((await storyRef.get()).data().wirePending).toBe(false);
    const day = (await fakeDb.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.entries).toHaveLength(1);
  });

  it('a non-empty queue processes reflections AND sweeps in the same tick', async () => {
    await seedPendingBattle();
    const { storyRef } = await seedDeferredWireStory();
    const res = makeRes();

    await handler(cronReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.succeeded).toBe(1);
    expect(res.body.message).toBeUndefined();
    expect(reflectMock).toHaveBeenCalledWith(fakeDb, 'b1');
    expect((await fakeDb.collection('agentBattles').doc('b1').get()).data().pendingReflection).toBe(false);
    expect(res.body.wireSweep.replayed).toBe(1);
    expect((await storyRef.get()).data().wirePending).toBe(false);
  });
});

describe('isolation — the rider can never break the primary job', () => {
  it('a sweep THROW is contained: reflections land, response is 200, wireSweep null', async () => {
    sweepControl.impl = () => { throw new Error('index not deployed'); };
    await seedPendingBattle();
    const res = makeRes();

    await handler(cronReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.succeeded).toBe(1);
    expect(res.body.wireSweep).toBeNull();
    expect((await fakeDb.collection('agentBattles').doc('b1').get()).data().pendingReflection).toBe(false);
  });

  it('a REJECTED sweep promise is contained the same way', async () => {
    sweepControl.impl = () => Promise.reject(new Error('transient'));
    const res = makeRes();
    await handler(cronReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.wireSweep).toBeNull();
  });
});

describe('budget floor + flag gate', () => {
  it('with <5s of budget left after reflections, the sweep is NOT started (next tick covers it)', async () => {
    vi.useFakeTimers({ now: NOW });
    // The reflection consumes 46s of the 50s budget → 4s remain (< 5s floor).
    reflectMock.mockImplementation(async () => {
      vi.setSystemTime(new Date(Date.now() + 46_000));
    });
    await seedPendingBattle();
    const { storyRef } = await seedDeferredWireStory();
    const res = makeRes();

    await handler(cronReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.succeeded).toBe(1); // the primary job still completed
    expect(res.body.wireSweep).toBeNull(); // floor honored — sweep deferred
    expect((await storyRef.get()).data().wirePending).toBe(true); // untouched
  });

  it('writes flag OFF → the sweep machinery is never invoked (pre-flip: its index may not exist)', async () => {
    flagState.writesEnabled = false;
    fakeDb.collection('fantasyTimesStories').doc('s-off').set({
      status: 'published', wirePending: true, publishedAt: '2026-07-24T17:00:00Z',
    });
    const sweepSpy = vi.fn();
    sweepControl.impl = sweepSpy;
    const res = makeRes();

    await handler(cronReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.wireSweep).toBeNull();
    expect(sweepSpy).not.toHaveBeenCalled();
  });
});

describe('auth', () => {
  it('rejects a non-cron caller without the bearer secret', async () => {
    const res = makeRes();
    await handler({ headers: {}, method: 'GET' }, res);
    expect(res.statusCode).toBe(401);
  });
});
