// api/tournament/team-card.dark.test.js
//
// Backing Beta PR 4 — THE DARKNESS SUITE for the two PR 4 routes:
// GET /api/tournament/team-card and POST /api/team/pitch (spec V1.3 §12: every
// backing route 404s while BACKING_BETA_ENABLED is false, AFTER auth — the
// SHOW_IT_ENABLED / research.js shape, and the backing-stake.dark.test.js
// precedent this file copies).
//
// THE FLAG IS MOCKED TO AN EXPLICIT `false` HERE, not read from the module, so
// this file does NOT move with the flip: it asserts what the routes do while
// dark, which stays true for ever after the flip as a property of the flag
// being off. The LIT behaviour lives in team-card.test.js and
// api/team/pitch.test.js, which mock it to true.
//
// WHAT "DARK" HAS TO MEAN, each row the falsifiable half of it:
//   · 404 with the SAME body a genuinely missing route gives, for every caller
//     and every input — inputs that would be 400s and inputs that would be
//     perfectly valid — so the 404 leaks nothing about the request's shape;
//   · 404 AFTER auth, so an unauthenticated caller gets 401 whether the feature
//     exists or not and cannot use the route as a rollout oracle;
//   · ZERO Firestore touches — no read, no write, no transaction.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ uid: 'viewer-1' }));

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

const { default: cardHandler } = await import('./team-card.js');
const { default: pitchHandler } = await import('../team/pitch.js');

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
  state.uid = 'viewer-1';
  touched.reads = 0; touched.writes = 0; touched.transactions = 0;
});

const ROUTES = [
  ['GET /api/tournament/team-card', cardHandler, 'GET', { query: { groupId: 'grp-1', odUserId: 'od-a' } }],
  ['POST /api/team/pitch', pitchHandler, 'POST', { body: { text: 'Momentum, but patient.' } }],
];

for (const [label, handler, method, valid] of ROUTES) {
  describe(`${label} — dark`, () => {
    it('answers 404 with the missing-route body for a VALID request, and touches Firestore zero times', async () => {
      const res = await call(handler, { method, ...valid });
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
      expect(touched).toEqual({ reads: 0, writes: 0, transactions: 0 });
    });

    it('answers the same 404 for a request that would be a 400 when lit — the 404 leaks nothing', async () => {
      const res = await call(handler, { method, query: {}, body: {} });
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
      expect(touched).toEqual({ reads: 0, writes: 0, transactions: 0 });
    });

    it('still authenticates first — an anonymous caller gets 401, not the dark 404', async () => {
      state.uid = null;
      const res = await call(handler, { method, ...valid });
      expect(res.statusCode).toBe(401);
      expect(touched).toEqual({ reads: 0, writes: 0, transactions: 0 });
    });

    it('still refuses the wrong method (405) — the route exists as a method-checked surface either way', async () => {
      const res = await call(handler, { method: method === 'GET' ? 'POST' : 'GET', ...valid });
      expect(res.statusCode).toBe(405);
      expect(touched).toEqual({ reads: 0, writes: 0, transactions: 0 });
    });
  });
}

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
        const res = await call(route[1], { method: route[2], ...route[3] });
        expect(res.statusCode, route[0]).toBe(404);
        expect(res.body, route[0]).toEqual({ error: 'Not found' });
      }
      expect(touched).toEqual({ reads: 0, writes: 0, transactions: 0 });
    });
  }
});
