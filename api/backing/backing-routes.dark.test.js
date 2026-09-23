// api/backing/backing-routes.dark.test.js
//
// Backing Beta PR 5 — THE DARKNESS SUITE for the four PR 5 routes:
// POST /api/backing/event, GET /api/backing/results, GET /api/backing/my-stats
// and GET /api/backing/trainer-stats (spec V1.3 §12: every backing route 404s
// while BACKING_BETA_ENABLED is false, AFTER auth — the SHOW_IT_ENABLED /
// research.js shape, and the backing-stake.dark.test.js precedent this file
// copies).
//
// THE FLAG IS MOCKED TO AN EXPLICIT `false` HERE, not read from the module, so
// this file does NOT move with the flip: it asserts what the routes do while
// dark, which stays true for ever after the flip as a property of the flag
// being off. The LIT behaviour lives in each route's own suite.
//
// WHAT "DARK" HAS TO MEAN, each row the falsifiable half of it:
//   · 404 with the SAME body a genuinely missing route gives, for every caller
//     and every input — inputs that would be 400s and inputs that would be
//     perfectly valid — so the 404 leaks nothing about the request's shape;
//   · 404 AFTER auth, so an unauthenticated caller gets 401 whether the feature
//     exists or not and cannot use the route as a rollout oracle;
//   · ZERO Firestore touches — no read, no write, no transaction.

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

const { default: eventHandler } = await import('./event.js');
const { default: resultsHandler } = await import('./results.js');
const { default: myStatsHandler } = await import('./my-stats.js');
const { default: trainerStatsHandler } = await import('./trainer-stats.js');

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
  ['POST /api/backing/event', eventHandler, 'POST', { body: { event: 'window_viewed' } }],
  ['GET /api/backing/results', resultsHandler, 'GET', { query: { groupId: 'grp-1' } }],
  ['GET /api/backing/my-stats', myStatsHandler, 'GET', { query: {} }],
  ['GET /api/backing/trainer-stats', trainerStatsHandler, 'GET', { query: {} }],
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
      const res = await call(handler, { method, query: { groupId: '///', before: 'nope', limit: -1 }, body: { event: 'stake_confirmed', props: { dwellMs: -1 } } });
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
      expect(touched).toEqual({ reads: 0, writes: 0, transactions: 0 });
    });

    it('still authenticates first — an anonymous caller gets 401, not the dark 404', async () => {
      state.uid = null;
      const res = await call(handler, { method, ...valid });
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Authentication required');
      expect(touched).toEqual({ reads: 0, writes: 0, transactions: 0 });
    });

    it('still refuses the wrong method (405) — the route exists as a method-checked surface either way', async () => {
      const res = await call(handler, { method: method === 'GET' ? 'POST' : 'GET', ...valid });
      expect(res.statusCode).toBe(405);
      expect(touched).toEqual({ reads: 0, writes: 0, transactions: 0 });
    });
  });
}

describe('the darkness is the FLAG, not an accident of the mocks', () => {
  it('the repo ships BACKING_BETA_ENABLED false — the pin suite owns the flip', async () => {
    const real = await vi.importActual('../../src/config/featureFlags.js');
    expect(real.BACKING_BETA_ENABLED).toBe(false);
  });
});
