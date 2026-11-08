// api/cron/process-pending-reflections.setupMenuLabels.test.js
//
// Measured Trend Evidence Slice 2 — HOST-INTEGRATION acceptance for the SEVENTH tenant, setup-label
// acquisition (spec V2 §6.2, §8; row A4.1). The tenant's own rows prove it works when called; these
// prove the host calls it in its place and that the flag-off cron is the pre-change cron:
//   • flag OFF → the response is the exact string the pre-change handler answered for the same fixtures
//     (the strings process-pending-reflections.activationEvidence.test.js pins, captured before the
//     sixth tenant existed, with the observer off), and Slice 2 does no I/O and logs nothing;
//   • flag ON → it runs strictly AFTER the observer's await, with the handler's start, and its counts
//     are reported under `setupMenuLabels`; a skip adds no key; a THROW is contained;
//   • TIME_BUDGET_MS and the observer's constants are untouched.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeCallsFirestore } from '../_utils/__fixtures__/callsFirestore.js';

const state = vi.hoisted(() => ({ labelsOn: false, activationOn: false, slice2Impl: null, slice2Calls: [], order: [] }));
vi.mock('../../src/config/setupMenuLabelsFlags.js', () => ({ get SETUP_MENU_LABELS_ENABLED() { return state.labelsOn; } }));
vi.mock('../../src/config/activationEvidenceFlags.js', () => ({ get ACTIVATION_EVIDENCE_ENABLED() { return state.activationOn; } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, CALL_RECORDS_MODE: 'off', HYPOTHESIS_RECORDS_ENABLED: false };
});
vi.mock('../_utils/wireFlags.js', () => ({ getWireFlags: () => ({ metricsEnabled: false, writesEnabled: false, continuityEnabled: false, editorialEnabled: false }) }));
let db;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => db }));
const OK_RESULT = { outcome: 'ok', record: { outcome: 'ok', failureClass: null, errorName: null, elapsedMs: 12_000, stopReason: 'tool_use', usage: { input_tokens: 3_800, output_tokens: 900 }, model: 'claude-sonnet-4-6', attempt: 1, at: '2026-11-04T01:30:00.000Z' } };
vi.mock('../agent/reflect.js', () => ({ generateReflection: async () => OK_RESULT }));
vi.mock('../_utils/activationEvidence/tenant.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, runActivationObserver: async (args) => { state.order.push('observer:start'); const r = await real.runActivationObserver(args); await Promise.resolve(); state.order.push('observer:end'); return r; } };
});
vi.mock('../_utils/setupMenuLabels/tenant.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, runSetupMenuAcquisition: async (args) => { state.order.push('slice2'); state.slice2Calls.push(args); return state.slice2Impl ? state.slice2Impl(args) : real.runSetupMenuAcquisition(args); } };
});

const { default: handler } = await import('./process-pending-reflections.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const CRON_SRC = readFileSync(resolve(HERE, 'process-pending-reflections.js'), 'utf8');
const OBSERVER_CONSTANTS = readFileSync(resolve(HERE, '../_utils/activationEvidence/constants.js'), 'utf8');
const NOW = Date.parse('2026-11-05T01:30:00Z');

// The pre-change answers for these fixtures (process-pending-reflections.activationEvidence.test.js GOLDEN,
// captured before the sixth tenant; the observer is off here, so they are also the pre-Slice-2 answers).
const GOLDEN = {
  pending: '{"processed":1,"succeeded":1,"failed":0,"skipped":0,"wireSweep":null,"duration":0}',
  empty: '{"processed":0,"succeeded":0,"failed":0,"skipped":0,"message":"No pending reflections","wireSweep":null,"duration":0}',
};

const cronReq = () => ({ headers: { 'x-vercel-cron': '1' }, method: 'GET' });
function makeRes() {
  const o = { statusCode: null, body: null };
  o.status = (code) => ({ json: (payload) => { o.statusCode = code; o.body = payload; return o; } });
  return o;
}
const seedPending = () => makeCallsFirestore({ docs: {
  'agentBattles/b-done': { status: 'completed', pendingReflection: true, completedAt: '2026-11-05T01:00:00.000Z', ownerId: 'owner-1' },
} });
const slice2Io = (d) => {
  const hit = (p) => /setupMenuLabelState|setupEvidence/.test(p ?? '');
  return d.__access.reads.filter(hit).length + d.__access.queries.filter((q) => hit(q.collectionPath)).length + d.__access.writes.filter((w) => hit(w.path)).length;
};
let savedEnv;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  Object.assign(state, { labelsOn: false, activationOn: false, slice2Impl: null, slice2Calls: [], order: [] });
  savedEnv = process.env.COCKPIT_ALLOWLIST_UIDS;
  process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-1';
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = savedEnv;
  vi.useRealTimers();
});

describe('flag OFF — the pre-change response, byte for byte (row G.3)', () => {
  for (const [name, seed] of [['pending', seedPending], ['empty', () => makeCallsFirestore({ docs: {} })]]) {
    it(`${name}: the exact pre-change string; Slice 2 was called, did no I/O and logged nothing`, async () => {
      db = seed();
      const logged = [];
      const log = vi.spyOn(console, 'log').mockImplementation((...a) => { logged.push(a.map(String).join(' ')); });
      const res = makeRes();
      await handler(cronReq(), res);
      log.mockRestore();
      expect(res.statusCode).toBe(200);
      expect(JSON.stringify(res.body)).toBe(GOLDEN[name]);
      expect(state.slice2Calls).toHaveLength(1);
      expect(slice2Io(db)).toBe(0);
      expect(logged.filter((l) => l.includes('[setupMenuLabels]'))).toEqual([]);
    });
  }
});

describe('flag ON — the seventh tenant (row A4.1)', () => {
  beforeEach(() => { state.labelsOn = true; state.activationOn = true; });
  it('runs strictly AFTER the observer\'s await, with the handler\'s start, and its counts are reported last', async () => {
    db = seedPending();
    state.slice2Impl = async () => ({ storeCalls: 2, providerRequests: 1, reservations: 2 });
    const res = makeRes();
    await handler(cronReq(), res);
    expect(state.order).toEqual(['observer:start', 'observer:end', 'slice2']);
    expect(state.slice2Calls[0]).toEqual({ db, handlerStartMs: NOW });
    expect(Object.keys(res.body).slice(-2)).toEqual(['setupMenuLabels', 'duration']);
    expect(res.body.setupMenuLabels).toEqual({ storeCalls: 2, providerRequests: 1, reservations: 2 });
  });
  it('a deferral is reported; a skip adds no key', async () => {
    db = seedPending();
    state.slice2Impl = async () => ({ deferred: 'no_budget' });
    const res = makeRes();
    await handler(cronReq(), res);
    expect(res.body.setupMenuLabels).toEqual({ deferred: 'no_budget' });
    state.slice2Impl = async () => ({ skipped: true });
    const res2 = makeRes();
    await handler(cronReq(), res2);
    expect(res2.body).not.toHaveProperty('setupMenuLabels');
  });
  it('a THROW is contained: the reflections land, the cron answers 200, the error is reported', async () => {
    db = seedPending();
    state.slice2Impl = async () => { throw new Error('injected slice 2 failure'); };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();
    await handler(cronReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ succeeded: 1, setupMenuLabels: { action: 'error', error: 'injected slice 2 failure' } });
  });
});

describe('the host, pinned in source', () => {
  it('TIME_BUDGET_MS stays 50 s, maxDuration 120 s; Slice 2 is the last tenant; the observer\'s slice and ceiling are its own and unchanged', () => {
    expect(CRON_SRC).toMatch(/^const TIME_BUDGET_MS = 50_000;/m);
    expect(CRON_SRC).toMatch(/export const config = \{ maxDuration: 120 \};/);
    const observer = CRON_SRC.indexOf('await runActivationObserver({ db, handlerStartMs: startTime })');
    const slice2 = CRON_SRC.indexOf('await runSetupMenuAcquisition({ db, handlerStartMs: startTime })');
    expect(slice2).toBeGreaterThan(observer);
    expect(CRON_SRC.indexOf('const duration = Date.now() - startTime;')).toBeGreaterThan(slice2);
    expect(CRON_SRC.replace(/\/\/.*$/gm, '').match(/TIME_BUDGET_MS/g).length).toBe(4);
    expect(OBSERVER_CONSTANTS).toMatch(/export const OBSERVER_SLICE_MS = 20_000;/);
    expect(OBSERVER_CONSTANTS).toMatch(/export const OBSERVER_ADMISSION_CEILING_MS = 80_000;/);
  });
});
