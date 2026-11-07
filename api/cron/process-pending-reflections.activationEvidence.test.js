// api/cron/process-pending-reflections.activationEvidence.test.js
//
// ID-1 Build 2 — HOST-INTEGRATION acceptance for the sixth tenant, the
// activation observer. The emulator suite (test/rules/activationObserver.rules.mjs)
// proves the observer works when CALLED; these prove the host calls it in its
// place and that the flag-off cron is the pre-build cron, BYTE FOR BYTE:
//   • flag OFF → the response is the exact string the pre-change handler
//     answered for the same fixtures (captured at base f3da14a3 under the same
//     controlled clock; fake timers fix `duration`), with the hypothesis review
//     pass both off and on;
//   • flag ON → the observer runs after the review pass, with the handler's
//     start, and its counts are reported under `activationEvidence`;
//   • a skipped observer adds no key; an observer THROW is contained;
//   • TIME_BUDGET_MS, the tenant order and the cron line are pinned in source.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeCallsFirestore } from '../_utils/__fixtures__/callsFirestore.js';

const state = vi.hoisted(() => ({ reviewOn: false, activationFlagOn: false, observerImpl: null, observerCalls: [], order: [] }));
// ACTIVATION_EVIDENCE_ENABLED ships TRUE (the 2026-11-06 flip), so these rows set it explicitly
// — off in the byte-identity block, on in the sixth-tenant block — instead of riding on its default.
vi.mock('../../src/config/activationEvidenceFlags.js', () => ({ get ACTIVATION_EVIDENCE_ENABLED() { return state.activationFlagOn; } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, CALL_RECORDS_MODE: 'off', get HYPOTHESIS_RECORDS_ENABLED() { return state.reviewOn; } };
});
vi.mock('../_utils/wireFlags.js', () => ({ getWireFlags: () => ({ metricsEnabled: false, writesEnabled: false, continuityEnabled: false, editorialEnabled: false }) }));
let db;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => db }));
const OK_RESULT = { outcome: 'ok', record: { outcome: 'ok', failureClass: null, errorName: null, elapsedMs: 12_000, stopReason: 'tool_use', usage: { input_tokens: 3_800, output_tokens: 900 }, model: 'claude-sonnet-4-6', attempt: 1, at: '2026-11-04T01:30:00.000Z' } };
vi.mock('../agent/reflect.js', () => ({ generateReflection: async () => OK_RESULT }));
vi.mock('../_utils/hypothesisRecords/reviewPass.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, runHypothesisReviewPass: async (...args) => { state.order.push('review'); return real.runHypothesisReviewPass(...args); } };
});
vi.mock('../_utils/activationEvidence/tenant.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, runActivationObserver: async (args) => { state.order.push('observer'); state.observerCalls.push(args); return state.observerImpl ? state.observerImpl(args) : real.runActivationObserver(args); } };
});

const { default: handler } = await import('./process-pending-reflections.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const CRON_SRC = readFileSync(resolve(HERE, 'process-pending-reflections.js'), 'utf8');
const VERCEL = JSON.parse(readFileSync(resolve(HERE, '../../vercel.json'), 'utf8'));
const NOW = Date.parse('2026-11-05T01:30:00Z');

// The pre-change handler's answers, captured at base f3da14a3 (origin/main) by this file's fixtures under
// vi.useFakeTimers({ toFake: ['Date'] }) at NOW, before the sixth tenant existed. Byte identity, not key sets.
const GOLDEN = {
  pending: '{"processed":1,"succeeded":1,"failed":0,"skipped":0,"wireSweep":null,"duration":0}',
  empty: '{"processed":0,"succeeded":0,"failed":0,"skipped":0,"message":"No pending reflections","wireSweep":null,"duration":0}',
  pendingReviewOn: '{"processed":1,"succeeded":1,"failed":0,"skipped":0,"wireSweep":null,"hypothesisReview":{"skipped":null,"starved":false,"availableMs":8000,"rows":1,"horizonElapsed":1,"battleEnded":0,"staleDeleted":0,"notDue":0,"battleLive":0,"battleMissing":0,"malformed":0,"skippedOff":0,"unconfirmed":0,"failed":0,"cut":false,"cursorBefore":null,"cursorAfter":null,"dueCursorBefore":null,"dueCursorAfter":null,"ms":0},"duration":0}',
};

const cronReq = () => ({ headers: { 'x-vercel-cron': '1' }, method: 'GET' });
function makeRes() {
  const o = { statusCode: null, body: null };
  o.status = (code) => ({ json: (payload) => { o.statusCode = code; o.body = payload; return o; } });
  return o;
}
const seedPending = () => makeCallsFirestore({ docs: {
  'agentBattles/b-done': { status: 'completed', pendingReflection: true, completedAt: '2026-11-05T01:00:00.000Z', ownerId: 'owner-1' },
  'hypothesisReviewQueue/wl-1:1': { userId: 'owner-1', watchlistId: 'wl-1', version: 1, battleId: 'b-1', dueAtMs: NOW - 60_000, armedAt: NOW - 1 },
  'watchlists/wl-1/hypothesisVersions/v1': { version: 1, watchlistId: 'wl-1', userId: 'owner-1', status: 'activated', statement: 'idea' },
} });
const observerIo = (d) => {
  const hit = (p) => /activation/.test(p);
  return d.__access.reads.filter(hit).length + d.__access.queries.filter((q) => hit(q.collectionPath)).length + d.__access.writes.filter((w) => w.path && hit(w.path)).length;
};
let savedEnv;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  Object.assign(state, { reviewOn: false, activationFlagOn: false, observerImpl: null, observerCalls: [], order: [] });
  savedEnv = process.env.COCKPIT_ALLOWLIST_UIDS;
  process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-1';
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = savedEnv;
  vi.useRealTimers();
});

describe('flag OFF — the response is the pre-change response, byte for byte', () => {
  for (const [name, seed, reviewOn] of [['pending', seedPending, false], ['empty', () => makeCallsFirestore({ docs: {} }), false], ['pendingReviewOn', seedPending, true]]) {
    it(`${name}: the exact pre-change string, the observer did no I/O, and no health line was logged`, async () => {
      state.reviewOn = reviewOn;
      db = seed();
      const logged = [];
      const log = vi.spyOn(console, 'log').mockImplementation((...a) => { logged.push(a.map(String).join(' ')); });
      const res = makeRes();
      await handler(cronReq(), res);
      log.mockRestore();
      expect(res.statusCode).toBe(200);
      expect(JSON.stringify(res.body)).toBe(GOLDEN[name]);
      expect(state.observerCalls).toHaveLength(1); // it was called, and returned before any read
      expect(observerIo(db)).toBe(0);
      expect(logged.length).toBeGreaterThan(0); // the host's own lines were captured …
      expect(logged.filter((l) => l.includes('[activationEvidence]'))).toEqual([]); // … and the observer's line is absent with the flag off
    });
  }
});

describe('flag ON — the sixth tenant', () => {
  beforeEach(() => { state.activationFlagOn = true; });
  it('runs AFTER the review pass, with the handler\'s start, and its counts are reported', async () => {
    db = seedPending();
    state.observerImpl = async () => ({ candidates: 2, pointers: { withEvidence: 3 } });
    const res = makeRes();
    await handler(cronReq(), res);
    expect(state.order).toEqual(['review', 'observer']);
    expect(state.observerCalls[0]).toEqual({ db, handlerStartMs: NOW });
    expect(Object.keys(res.body)).toEqual(['processed', 'succeeded', 'failed', 'skipped', 'wireSweep', 'activationEvidence', 'duration']);
    expect(res.body.activationEvidence).toEqual({ candidates: 2, pointers: { withEvidence: 3 } });
  });
  it('a deferral is reported; a skip adds no key', async () => {
    db = seedPending();
    state.observerImpl = async () => ({ deferred: 'no_budget' });
    const res = makeRes();
    await handler(cronReq(), res);
    expect(res.body.activationEvidence).toEqual({ deferred: 'no_budget' });
    state.observerImpl = async () => ({ skipped: true });
    const res2 = makeRes();
    await handler(cronReq(), res2);
    expect(res2.body).not.toHaveProperty('activationEvidence');
  });
  it('a THROW is contained: the reflections land, the cron answers 200, the error is reported', async () => {
    db = seedPending();
    state.observerImpl = async () => { throw new Error('injected observer failure'); };
    const res = makeRes();
    await handler(cronReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ succeeded: 1, activationEvidence: { action: 'error', error: 'injected observer failure' } });
  });
});

describe('the host, pinned in source', () => {
  it('TIME_BUDGET_MS stays 50 s and maxDuration 120 s; the observer is the LAST tenant, inside the handler\'s try', () => {
    expect(CRON_SRC).toMatch(/^const TIME_BUDGET_MS = 50_000;/m);
    expect(CRON_SRC).toMatch(/export const config = \{ maxDuration: 120 \};/);
    const review = CRON_SRC.indexOf('await runHypothesisReviewPass(');
    const observer = CRON_SRC.indexOf('await runActivationObserver({ db, handlerStartMs: startTime })');
    expect(review).toBeGreaterThan(0);
    expect(observer).toBeGreaterThan(review);
    expect(CRON_SRC.indexOf('const duration = Date.now() - startTime;')).toBeGreaterThan(observer);
    expect(CRON_SRC).toMatch(/\.\.\.\(activationEvidence && !activationEvidence\.skipped \? \{ activationEvidence \} : \{\}\),\s*duration,/);
    // In code (comments stripped): declared once, read by the Wire sweep and the editorial only — 4 uses at base f3da14a3, 4 now.
    expect(CRON_SRC.replace(/\/\/.*$/gm, '').match(/TIME_BUDGET_MS/g).length).toBe(4);
  });
  it('the reflections cron gains exactly the hour 1, and nothing else in vercel.json names the observer', () => {
    const entries = VERCEL.crons.filter((c) => c.path === '/api/cron/process-pending-reflections');
    expect(entries).toEqual([{ path: '/api/cron/process-pending-reflections', schedule: '*/15 13,14,15,16,17,18,19,20,21,22,23,0,1 * * *' }]);
    expect(JSON.stringify(VERCEL)).not.toMatch(/activation/i);
  });
});
