// api/cron/setup-evidence-sweep.test.js
//
// The chart's evidence, PR B — the sweep's cron (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md SW-1, SW-6):
// auth (the vercel-cron header or the bearer secret; an unset secret never matches), the flag off
// answering exactly { skipped: true } before the Firestore handle is taken or the run is called, the
// flag on handing the run its handler start, and a thrown run (a surfaced programming error) a 500.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ on: false, adminCalls: 0, runs: [], runResult: { session: '2026-11-16' }, runThrows: null }));
vi.mock('../../src/config/setupEvidenceSweepFlags.js', () => ({ get SETUP_EVIDENCE_SWEEP_ENABLED() { return state.on; } }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => { state.adminCalls += 1; return { db: true }; } }));
vi.mock('../_utils/setupEvidenceSweep/sweep.js', () => ({
  runSetupEvidenceSweep: async (p) => { state.runs.push(p); if (state.runThrows) throw state.runThrows; return state.runResult; },
}));

const { default: handler, config } = await import('./setup-evidence-sweep.js');

function res() {
  const r = { statusCode: null, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
const call = async (headers = { 'x-vercel-cron': '1' }) => { const r = res(); await handler({ method: 'GET', headers }, r); return r; };

beforeEach(() => {
  Object.assign(state, { on: false, adminCalls: 0, runs: [], runResult: { session: '2026-11-16' }, runThrows: null });
  vi.stubEnv('CRON_SECRET', 'cron-secret-for-tests');
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('auth', () => {
  it('no header and no secret → 401, nothing else', async () => {
    state.on = true;
    const r = await call({});
    expect([r.statusCode, r.body]).toEqual([401, { error: 'Unauthorized' }]);
    expect([state.adminCalls, state.runs.length]).toEqual([0, 0]);
  });
  it('the vercel-cron header, or the bearer secret, is admitted', async () => {
    expect((await call({ 'x-vercel-cron': '1' })).statusCode).toBe(200);
    expect((await call({ authorization: 'Bearer cron-secret-for-tests' })).statusCode).toBe(200);
    expect((await call({ authorization: 'Bearer wrong' })).statusCode).toBe(401);
  });
  it('an unset or empty CRON_SECRET never matches "Bearer undefined" or "Bearer "', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await call({ authorization: 'Bearer ' })).statusCode).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await call({ authorization: 'Bearer undefined' })).statusCode).toBe(401);
  });
});

describe('the flag off: exactly { skipped: true }, before anything', () => {
  it('no Firestore handle, no run', async () => {
    const r = await call();
    expect(r.statusCode).toBe(200);
    expect(JSON.stringify(r.body)).toBe('{"skipped":true}');
    expect([state.adminCalls, state.runs.length]).toEqual([0, 0]);
  });
});

describe('the flag on', () => {
  it('the run gets the db, the handler\'s start and a clock; its counts are the body', async () => {
    state.on = true;
    const before = Date.now();
    const r = await call();
    expect([r.statusCode, r.body]).toEqual([200, { session: '2026-11-16' }]);
    expect(state.runs).toHaveLength(1);
    const p = state.runs[0];
    expect(p.db).toEqual({ db: true });
    expect(p.handlerStartMs).toBeGreaterThanOrEqual(before);
    expect(p.now()).toBeInstanceOf(Date);
    expect(p.fetchPayload).toBeUndefined(); // production: the store's own provider
  });
  it('a thrown run (a surfaced programming error) → 500, its name only', async () => {
    state.on = true;
    state.runThrows = Object.assign(new Error('setupEvidence: session_incomplete AAPL 200.37'), { name: 'SetupEvidenceProgrammingError', reason: 'session_incomplete' });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await call();
    expect([r.statusCode, r.body]).toEqual([500, { error: 'sweep_failed', name: 'SetupEvidenceProgrammingError' }]);
    const logged = errors.mock.calls.flat().join(' ');
    expect(logged).toContain('session_incomplete');
    expect(logged).not.toMatch(/AAPL|200\.37/);
  });
  it('maxDuration 300', () => {
    expect(config).toEqual({ maxDuration: 300 });
  });
});
