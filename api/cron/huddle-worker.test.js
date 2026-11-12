// api/cron/huddle-worker.test.js
//
// Huddle S1.1 — the queue worker cron FAILS CLOSED (Amendment E §E7; build prompt hard rule 2; review HC-2: no test ran this
// handler, so deleting its cohort gate failed nothing while the worker below it read Firestore every two minutes). With the
// flag off, and with the flag on but HUDDLE_PLAYER_UIDS unset, blank or only commas, the handler answers at once and
// touches nothing: the Admin SDK and the invocation are stand-ins that fail the row if reached. The flag is held by a getter
// mock, so each row sets the state it pins, whatever the shipped value.

import { afterEach, describe, it, expect, vi } from 'vitest';

const flag = vi.hoisted(() => ({ on: false }));
vi.mock('../../src/config/huddleFlags.js', () => ({ get DRB_HUDDLE_ENABLED() { return flag.on; } }));

const touched = vi.hoisted(() => []);
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => { touched.push('firestore'); return { tag: 'db' }; },
}));
vi.mock('../_utils/huddle/worker.js', () => ({
  runWorkerInvocation: async () => { touched.push('invocation'); return { etDate: '2026-11-11', outcome: 'drained', results: [] }; },
}));

const { default: handler } = await import('./huddle-worker.js');

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const cronReq = () => ({ headers: { 'x-vercel-cron': '1' } });

const COHORT_BEFORE = process.env.HUDDLE_PLAYER_UIDS;
const setCohort = (v) => { if (v === undefined) delete process.env.HUDDLE_PLAYER_UIDS; else process.env.HUDDLE_PLAYER_UIDS = v; };
afterEach(() => {
  touched.length = 0;
  flag.on = false;
  setCohort(COHORT_BEFORE);
});

describe('api/cron/huddle-worker: fail closed (E7)', () => {
  it('flag off: 200 { skipped, reason: flag_off } — no read, no invocation (the 7f883c9c answer)', async () => {
    flag.on = false;
    setCohort('u1');
    const res = fakeRes();
    await handler(cronReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ skipped: true, reason: 'flag_off' });
    expect(touched).toEqual([]);
  });

  it.each([['unset', undefined], ['empty', ''], ['blank', '   '], ['only commas', ' , ,']])('flag on, cohort %s: 200 { skipped, reason: no_cohort } — no read, no invocation', async (_label, value) => {
    flag.on = true;
    setCohort(value);
    const res = fakeRes();
    await handler(cronReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ skipped: true, reason: 'no_cohort' });
    expect(touched).toEqual([]);
  });

  it('flag on, a cohort: the invocation runs (control — the stand-ins are reachable)', async () => {
    flag.on = true;
    setCohort('u1');
    const res = fakeRes();
    await handler(cronReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, outcome: 'drained' });
    expect(touched).toEqual(['firestore', 'invocation']);
  });

  it('no cron header and no secret: 401 before the flag is read', async () => {
    flag.on = true;
    setCohort('u1');
    const res = fakeRes();
    await handler({ headers: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(touched).toEqual([]);
  });
});
