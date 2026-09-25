// api/tournament/backing-stake.dark.test.js
//
// Backing Beta PR 2 — THE DARKNESS SUITE for POST /api/tournament/backing-stake
// (spec V1.3 §12: every backing route 404s while BACKING_BETA_ENABLED is false,
// AFTER auth — the SHOW_IT_ENABLED / research.js shape).
//
// THE FLAG IS MOCKED TO AN EXPLICIT `false` HERE, not read from the module, so
// this file does NOT move with the flip (the PR 1 flag docstring's rule): it
// asserts what the route does while dark, which stays true for ever after the
// flip as a property of the flag being off. The LIT behaviour lives in
// backing-stake.test.js, which mocks it to true.
//
// WHAT "DARK" HAS TO MEAN, and each row is the falsifiable half of it:
//   · the route answers 404 with the SAME body a genuinely missing route gives,
//     for every caller and every body — including bodies that would be 400s and
//     bodies that would be perfectly valid stakes, so the 404 leaks nothing
//     about the request's shape;
//   · it answers 404 AFTER auth, so an unauthenticated caller gets 401 whether
//     the feature exists or not and cannot use the route as a rollout oracle;
//   · and it touches Firestore ZERO times — no read, no write, no transaction.
//     A dark route that reads is a dark route that can fail, bill, or leak.
//
// Also covers the pod list in the same file, because the two routes share the
// flag and the guarantee is identical; a separate file would be a second copy
// of one assertion (BUILD_RULES §9 applied to a test).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ uid: 'backer-1' }));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (!state.uid) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: state.uid, firebase: { sign_in_provider: 'password' } };
  },
}));
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

const { default: stakeHandler } = await import('./backing-stake.js');
const { default: poolsHandler } = await import('./backing-pools.js');

const mkRes = () => ({
  statusCode: null, body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

const call = async (handler, { method, body, query } = {}) => {
  const res = mkRes();
  await handler({ method, headers: { 'user-agent': 'dark' }, body, query }, res);
  return res;
};

beforeEach(() => {
  state.uid = 'backer-1';
  touched.reads = 0; touched.writes = 0; touched.transactions = 0;
});

const ROUTES = [
  ['POST /api/tournament/backing-stake', stakeHandler, 'POST',
    { groupId: 'grp-1', teamOdUserId: 'od-a', amount: 100, requestId: 'req-1' }],
  ['GET /api/tournament/backing-pools', poolsHandler, 'GET', undefined],
];

for (const [label, handler, method, validBody] of ROUTES) {
  describe(`${label} — dark`, () => {
    it('404s an authenticated caller with the bare "Not found" body', async () => {
      const res = await call(handler, { method, body: validBody });
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });

    it('404s identically for a VALID body and for one that would be a 400 while lit', async () => {
      const valid = await call(handler, { method, body: validBody });
      const rubbish = await call(handler, { method, body: { groupId: '///', amount: -1 } });
      const empty = await call(handler, { method, body: undefined });
      for (const res of [valid, rubbish, empty]) {
        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ error: 'Not found' });
      }
    });

    it('401s an unauthenticated caller — the flag is checked AFTER auth', async () => {
      state.uid = null;
      const res = await call(handler, { method, body: validBody });
      expect(res.statusCode).toBe(401);
      // The point of the ordering: this is the SAME answer a lit route gives an
      // unauthenticated caller, so the pair is not an oracle on the rollout.
      expect(res.body.error).toBe('Authentication required');
    });

    it('still 405s the wrong method — the method check precedes both', async () => {
      const wrong = method === 'POST' ? 'GET' : 'POST';
      const res = await call(handler, { method: wrong, body: validBody });
      expect(res.statusCode).toBe(405);
    });

    it('touches Firestore ZERO times, on every path above', async () => {
      await call(handler, { method, body: validBody });
      await call(handler, { method, body: { nonsense: true } });
      state.uid = null;
      await call(handler, { method, body: validBody });
      expect(touched).toEqual({ reads: 0, writes: 0, transactions: 0 });
    });
  });
}

describe('the darkness is the FLAG, not an accident of the mocks', () => {
  it('the repo ships BACKING_BETA_ENABLED false — the pin suite owns the flip', async () => {
    // Read the real module, not the mock: this file's mock must never be what
    // makes the route dark in production.
    const real = await vi.importActual('../../src/config/featureFlags.js');
    expect(real.BACKING_BETA_ENABLED).toBe(false);
  });
});

// ============================================================================
// THE ACTIVATION PR — the founder smoke override CANNOT light these routes for
// a non-allowlisted uid, on a production deployment, or without both env vars:
// the same 404, the same zero Firestore touches. (The lit case — an allowlisted
// uid on a preview — is each route's own lit suite's row; this file's database
// double throws on any touch, so only darkness can be asserted here.)
describe('the founder smoke override cannot light a dark route (the activation PR)', () => {
  const lit = (uid) => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('BACKING_SMOKE_ENABLED', 'true');
    vi.stubEnv('BACKING_SMOKE_UIDS', `other-1, ${uid}`);
  };
  afterEach(() => { vi.unstubAllEnvs(); });
  const ARMS = [
    ['a PRODUCTION deployment, both env vars set, the uid allowlisted', (uid) => { lit(uid); vi.stubEnv('VERCEL_ENV', 'production'); }],
    ['a NON-allowlisted uid on a lit preview', (uid) => { lit(uid); vi.stubEnv('BACKING_SMOKE_UIDS', 'someone-else'); }],
    ['a missing switch (BACKING_SMOKE_ENABLED unset)', (uid) => { lit(uid); vi.stubEnv('BACKING_SMOKE_ENABLED', ''); }],
    ['a missing allowlist (BACKING_SMOKE_UIDS unset)', (uid) => { lit(uid); vi.stubEnv('BACKING_SMOKE_UIDS', ''); }],
    ['an unset deployment (VERCEL_ENV absent — local, a bare node process)', (uid) => { lit(uid); vi.stubEnv('VERCEL_ENV', ''); }],
  ];
  for (const [label, arm] of ARMS) {
    it(`${label}: every route still 404s with the missing-route body and touches Firestore zero times`, async () => {
      const routes = ROUTES; const UID = state.uid;
      for (const route of routes) {
        vi.unstubAllEnvs();
        arm(UID);
        const res = await call(route[1], { method: route[2], body: route[3] });
        expect(res.statusCode, route[0]).toBe(404);
        expect(res.body, route[0]).toEqual({ error: 'Not found' });
      }
      expect(touched).toEqual({ reads: 0, writes: 0, transactions: 0 });
    });
  }
});
