// api/tournament/backing-settle.dark.test.js
//
// Backing Beta PR 3 — THE DARKNESS SUITE for POST /api/tournament/backing-settle
// (spec V1.3 §12: every backing route 404s while BACKING_BETA_ENABLED is false,
// AFTER auth — the SHOW_IT_ENABLED / research.js shape; the PR 2 dark suite's
// sibling for the admin re-run).
//
// THE FLAG IS MOCKED TO AN EXPLICIT `false` HERE, not read from the module, so
// this file does NOT move with the flip: it asserts what the route does while
// dark, which stays true for ever after the flip as a property of the flag
// being off. The LIT behaviour lives in backing-settle.test.js.
//
// WHAT "DARK" HAS TO MEAN for an ADMIN route, each row the falsifiable half:
//   · the route answers 404 with the SAME body a genuinely missing route gives,
//     for every body — a valid re-run, an override, an invalid body — so the
//     404 leaks nothing about the request's shape;
//   · it answers 404 AFTER auth: a caller without the secret gets 401 whether
//     the feature exists or not, so the route is no rollout oracle;
//   · and it touches Firestore ZERO times — no read, no write, no transaction.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// EXPLICIT false — this file does not move with the flip.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  BACKING_BETA_ENABLED: false,
}));

const touched = { reads: 0, writes: 0, transactions: 0 };
const boom = (what) => { touched[what] += 1; throw new Error(`the dark route touched Firestore (${what})`); };
const db = {
  collection: () => { boom('reads'); },
  runTransaction: () => { boom('transactions'); },
  batch: () => { boom('writes'); },
};
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => db }));

const { default: handler } = await import('./backing-settle.js');

const SECRET = 'test-admin-secret';
const mkRes = () => ({
  statusCode: null, body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const call = async ({ method = 'POST', body, secret = SECRET } = {}) => {
  const res = mkRes();
  const headers = secret ? { 'x-admin-secret': secret } : {};
  await handler({ method, headers, body }, res);
  return res;
};

beforeEach(() => {
  vi.stubEnv('ADMIN_SECRET', SECRET);
  touched.reads = 0; touched.writes = 0; touched.transactions = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

const BODIES = [
  ['a valid re-run', { groupId: 'grp-1' }],
  ['an override', { groupId: 'grp-1', overrideHold: true, reason: 'because' }],
  ['a simulated run', { groupId: 'grp-1', simulatedNow: '2026-10-02T22:30:00.000Z' }],
  ['an invalid body', { groupId: 42 }],
  ['an empty body', {}],
  ['a string body', JSON.stringify({ groupId: 'grp-1' })],
];

describe('POST /api/tournament/backing-settle — dark', () => {
  it('405s anything but POST, before auth and before the flag', async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const res = await call({ method });
      expect(res.statusCode).toBe(405);
    }
  });

  it('401s a caller without the secret — auth first, so the 404 is no oracle', async () => {
    for (const [, body] of BODIES) {
      expect((await call({ body, secret: null })).statusCode).toBe(401);
      expect((await call({ body, secret: 'wrong' })).statusCode).toBe(401);
    }
  });

  for (const [label, body] of BODIES) {
    it(`answers 404 { error: 'Not found' } to ${label} — the missing-route body, nothing more`, async () => {
      const res = await call({ body });
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });
  }

  it('touches Firestore ZERO times across every body — no read, no write, no transaction', async () => {
    for (const [, body] of BODIES) await call({ body });
    expect(touched).toEqual({ reads: 0, writes: 0, transactions: 0 });
  });

  it('500s when no secret is configured at all — the admin gate\'s own refusal, still before the flag', async () => {
    vi.unstubAllEnvs();
    delete process.env.ADMIN_SECRET;
    delete process.env.CRON_SECRET;
    const res = await call({ body: { groupId: 'grp-1' } });
    expect(res.statusCode).toBe(500);
    expect(touched).toEqual({ reads: 0, writes: 0, transactions: 0 });
  });
});
