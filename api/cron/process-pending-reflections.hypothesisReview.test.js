// api/cron/process-pending-reflections.hypothesisReview.test.js
//
// Pilot P1a — HOST-INTEGRATION acceptance for the fifth tenant, the
// hypothesis review pass (founder decision D2; acceptance rows 1 and 9). The
// unit suite (api/_utils/hypothesisRecords/reviewPass.test.js) proves the pass
// works when CALLED; these prove the host calls it in its place and that the
// flag-off cron is the pre-build cron:
//   • flag OFF → the response keys are the pre-build set and the hypothesis
//     collections see zero I/O (byte-identical output — rows fail if the key
//     leaks or the pass reads before its gate)
//   • flag ON  → the pass runs in the same tick, after the reflections, and
//     its summary is reported
//   • a pass THROW is contained: the reflections land and the cron answers 200
//   • the pass runs AFTER the call sweep (the tenant order, pinned in source)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeCallsFirestore, stored } from '../_utils/__fixtures__/callsFirestore.js';

const state = vi.hoisted(() => ({ flagOn: false, passImpl: null }));

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  // CALL_RECORDS_MODE pinned 'off' (the sibling host suite's posture), so the call sweep is inert here.
  return { ...real, CALL_RECORDS_MODE: 'off', get HYPOTHESIS_RECORDS_ENABLED() { return state.flagOn; } };
});
vi.mock('../_utils/wireFlags.js', () => ({ getWireFlags: () => ({ metricsEnabled: false, writesEnabled: false, continuityEnabled: false, editorialEnabled: false }) }));
let db;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => db }));
const reflectMock = vi.fn(async () => {});
vi.mock('../agent/reflect.js', () => ({ generateReflection: (...args) => reflectMock(...args) }));
vi.mock('../_utils/hypothesisRecords/reviewPass.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, runHypothesisReviewPass: (...args) => (state.passImpl ? state.passImpl(...args) : real.runHypothesisReviewPass(...args)) };
});

const { default: handler } = await import('./process-pending-reflections.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const CRON_SRC = readFileSync(resolve(HERE, 'process-pending-reflections.js'), 'utf8');
const NOW = Date.parse('2026-10-21T21:00:00Z');
const ENV = 'COCKPIT_ALLOWLIST_UIDS';
let savedEnv;

const cronReq = () => ({ headers: { 'x-vercel-cron': '1' }, method: 'GET' });
function makeRes() {
  const out = { statusCode: null, body: null };
  out.status = (code) => ({ json: (payload) => { out.statusCode = code; out.body = payload; return out; } });
  return out;
}
const seed = () => makeCallsFirestore({
  docs: {
    'agentBattles/b-done': { status: 'completed', pendingReflection: true, completedAt: '2026-10-21T20:00:00.000Z', ownerId: 'owner-1' },
    'hypothesisReviewQueue/wl-1:1': { userId: 'owner-1', watchlistId: 'wl-1', version: 1, battleId: 'b-1', dueAtMs: NOW - 60_000, armedAt: NOW - 1 },
    'watchlists/wl-1/hypothesisVersions/v1': { version: 1, watchlistId: 'wl-1', userId: 'owner-1', status: 'activated', statement: 'idea' },
  },
});
const hypothesisIo = (d) => {
  const hit = (p) => /hypothesis/.test(p);
  return d.__access.reads.filter(hit).length + d.__access.queries.filter((q) => hit(q.collectionPath)).length + d.__access.writes.filter((w) => w.path && hit(w.path)).length;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  state.flagOn = false;
  state.passImpl = null;
  reflectMock.mockClear();
  savedEnv = process.env[ENV];
  process.env[ENV] = 'owner-1';
  db = seed();
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV]; else process.env[ENV] = savedEnv;
  vi.useRealTimers();
});

describe('the fifth tenant — the hypothesis review pass', () => {
  it('flag OFF → the response carries exactly the pre-build keys and the hypothesis collections see ZERO I/O', async () => {
    const res = makeRes();
    await handler(cronReq(), res);
    expect(res.statusCode).toBe(200);
    // The pre-build response for a tick with one reflection, the Wire writes off, the calls mode off.
    expect(Object.keys(res.body)).toEqual(['processed', 'succeeded', 'failed', 'skipped', 'wireSweep', 'duration']);
    expect(res.body).toMatchObject({ processed: 1, succeeded: 1, failed: 0, skipped: 0, wireSweep: null });
    expect(res.body).not.toHaveProperty('hypothesisReview');
    expect(hypothesisIo(db)).toBe(0);
    expect(stored(db, 'watchlists/wl-1/hypothesisVersions/v1').status).toBe('activated');
  });
  it('flag OFF on an empty reflection queue → the pre-build empty-queue response, still no hypothesis I/O', async () => {
    db = makeCallsFirestore({ docs: {} });
    const res = makeRes();
    await handler(cronReq(), res);
    expect(Object.keys(res.body)).toEqual(['processed', 'succeeded', 'failed', 'skipped', 'message', 'wireSweep', 'duration']);
    expect(hypothesisIo(db)).toBe(0);
  });
  it('flag ON → the pass runs in the same tick, after the reflections; its summary is reported and the due version flips', async () => {
    state.flagOn = true;
    const res = makeRes();
    await handler(cronReq(), res);
    expect(res.statusCode).toBe(200);
    expect(reflectMock).toHaveBeenCalledTimes(1);
    expect(res.body.hypothesisReview).toMatchObject({ horizonElapsed: 1, failed: 0 });
    expect(stored(db, 'watchlists/wl-1/hypothesisVersions/v1')).toMatchObject({ status: 'review_due', stateReason: 'horizon_elapsed', stateSource: 'review_pass' });
    expect(stored(db, 'hypothesisReviewQueue/wl-1:1')).toBeNull();
  });
  it('a pass THROW is contained: the reflections land, the cron answers 200, the error is reported', async () => {
    state.flagOn = true;
    state.passImpl = async () => { throw new Error('injected review failure'); };
    const res = makeRes();
    await handler(cronReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ succeeded: 1, hypothesisReview: { action: 'error', error: 'injected review failure' } });
    expect(stored(db, 'agentBattles/b-done').pendingReflection).toBe(false);
  });
  it('the pass is the LAST tenant: it runs after the call sweep, inside the handler\'s try', () => {
    const sweep = CRON_SRC.indexOf('await runCallSweep(');
    const review = CRON_SRC.indexOf('await runHypothesisReviewPass(');
    expect(sweep).toBeGreaterThan(0);
    expect(review).toBeGreaterThan(sweep);
    expect(CRON_SRC.indexOf('const duration = Date.now() - startTime;')).toBeGreaterThan(review);
    expect(CRON_SRC).toMatch(/\.\.\.\(hypothesisReview && !hypothesisReview\.skipped \? \{ hypothesisReview \} : \{\}\)/);
  });
});
