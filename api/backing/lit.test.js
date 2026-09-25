// api/backing/lit.test.js
//
// GET /api/backing/lit — Backing activation. The client's one question about
// the founder smoke override, answered for the caller's own uid only:
//   · dark and no override → { lit: false }, zero Firestore touches;
//   · an allowlisted uid on a lit preview → { lit: true };
//   · the same uid, the same env, in PRODUCTION → { lit: false } (mutation
//     check 1: the override honoured in production reds this row);
//   · a non-allowlisted uid on the lit preview → { lit: false } (mutation
//     check 2);
//   · a missing switch or allowlist → { lit: false };
//   · the code flag true → { lit: true } for anyone, anywhere;
//   · 401 before the answer for an anonymous caller; 405 on POST.
// The route reads nothing and writes nothing on any path: the database double
// throws on ANY access.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ uid: 'founder-1', flag: false }));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (!state.uid) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: state.uid, firebase: { sign_in_provider: 'password' } };
  },
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return state.flag; },
}));
const touched = { count: 0 };
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => new Proxy({}, { get() { touched.count += 1; throw new Error('the lit route touched Firestore'); } }),
}));

const { default: handler } = await import('./lit.js');

const mkRes = () => ({
  statusCode: null, body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const call = async (method = 'GET') => {
  const res = mkRes();
  await handler({ method, headers: { 'user-agent': 'lit' }, query: {} }, res);
  return res;
};
const FOUNDER = 'founder-1';
const stubLit = () => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('BACKING_SMOKE_ENABLED', 'true');
  vi.stubEnv('BACKING_SMOKE_UIDS', `other-1, ${FOUNDER} ,other-2`);
};

beforeEach(() => { state.uid = FOUNDER; state.flag = false; touched.count = 0; });
afterEach(() => { vi.unstubAllEnvs(); });

describe('GET /api/backing/lit', () => {
  it('dark, no override: { lit: false } and zero Firestore touches', async () => {
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ lit: false });
    expect(touched.count).toBe(0);
  });

  it('an allowlisted uid on a lit PREVIEW: { lit: true } — still zero Firestore touches', async () => {
    stubLit();
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ lit: true });
    expect(touched.count).toBe(0);
  });

  it('the SAME uid and env vars in PRODUCTION: { lit: false } — the override is ignored entirely', async () => {
    stubLit();
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await call()).body).toEqual({ lit: false });
    vi.stubEnv('VERCEL_ENV', 'development');
    expect((await call()).body).toEqual({ lit: false });
    vi.stubEnv('VERCEL_ENV', '');
    expect((await call()).body).toEqual({ lit: false });
  });

  it('a NON-allowlisted uid on the lit preview: { lit: false }', async () => {
    stubLit();
    state.uid = 'someone-else';
    expect((await call()).body).toEqual({ lit: false });
  });

  it('a missing switch, a wrong switch, or a missing allowlist: { lit: false }', async () => {
    stubLit();
    vi.stubEnv('BACKING_SMOKE_ENABLED', 'false');
    expect((await call()).body).toEqual({ lit: false });
    vi.stubEnv('BACKING_SMOKE_ENABLED', 'true');
    vi.stubEnv('BACKING_SMOKE_UIDS', '');
    expect((await call()).body).toEqual({ lit: false });
  });

  it('the code flag true lights anyone, anywhere — the override is an OR, never a gate on the flag', async () => {
    state.flag = true;
    state.uid = 'someone-else';
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await call()).body).toEqual({ lit: true });
    expect(touched.count).toBe(0);
  });

  it('401s an anonymous caller BEFORE the answer, and 405s a POST', async () => {
    stubLit();
    state.uid = null;
    const anon = await call();
    expect(anon.statusCode).toBe(401);
    expect(anon.body.error).toBe('Authentication required');
    state.uid = FOUNDER;
    expect((await call('POST')).statusCode).toBe(405);
    expect(touched.count).toBe(0);
  });

  it('the answer is the ONE key, a boolean — nothing else about the deployment or the allowlist leaves', async () => {
    stubLit();
    const lit = await call();
    expect(Object.keys(lit.body)).toEqual(['lit']);
    expect(typeof lit.body.lit).toBe('boolean');
    state.uid = 'someone-else';
    expect(Object.keys((await call()).body)).toEqual(['lit']);
  });
});
