// api/practice-field/founder.test.js
//
// Practice Field T1a-2b-1 §6 — THE FOUNDER ENDPOINT's own wiring: CORS / rate limit first, POST only, the verified
// token's uid (never the body's), and the founder gate — the mode AND MANDATE_FOUNDER_UIDS, both. The middleware and
// the token check are stubbed at their module edges (the api/film-room/card.test.js idiom); the Practice Field
// modules, the mode gate and the flag are real. The actions themselves are founderControls.test.js's.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null, middlewareHandles: false, middlewareCalls: [] }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: (_req, _res, opts) => { state.middlewareCalls.push(opts); return state.middlewareHandles; } }));
vi.mock('../_utils/authMiddleware.js', () => ({
  // The real requireAuth verifies a Firebase ID token and answers 401 itself when there is none.
  requireAuth: async (req, res) => {
    const token = req.headers?.authorization;
    if (typeof token !== 'string' || !token.startsWith('Bearer ')) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: token.slice('Bearer '.length) };
  },
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));

import handler from './founder.js';
import { setPracticeFieldModeForTests } from '../_utils/practiceField/mode.js';
import { makeMandateFakeDb, contractOf, ADMIT_ISO, getBook, dumpStore } from '../_utils/practiceField/__testsupport__/fixtures.js';

const UID = 'founder-1';
const agents = {
  [`agents/agent-${UID}`]: { ownerId: UID, archetype: 'momentum_chaser' },
  'agents/agent-victim': { ownerId: 'victim', archetype: 'degen' },
};

function call({ method = 'POST', uid = UID, body = {} } = {}) {
  const out = { status: null, body: null };
  const res = { status(n) { out.status = n; return this; }, json(b) { out.body = b; return this; }, setHeader() {}, end() { return this; } };
  const req = { method, headers: uid ? { authorization: `Bearer ${uid}` } : {}, body };
  return handler(req, res).then(() => out);
}

let restoreMode;
let prevEnv;
beforeEach(() => {
  state.db = makeMandateFakeDb(agents);
  state.middlewareHandles = false;
  state.middlewareCalls = [];
  restoreMode = setPracticeFieldModeForTests('on');
  prevEnv = process.env.MANDATE_FOUNDER_UIDS;
  process.env.MANDATE_FOUNDER_UIDS = UID;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(ADMIT_ISO));
});
afterEach(() => {
  vi.useRealTimers();
  restoreMode();
  if (prevEnv === undefined) delete process.env.MANDATE_FOUNDER_UIDS; else process.env.MANDATE_FOUNDER_UIDS = prevEnv;
});

describe('api/practice-field/founder — authorization', () => {
  it('runs the security middleware first, with a rate limit; a request it answers goes no further', async () => {
    state.middlewareHandles = true;
    const before = dumpStore(state.db);
    expect(await call({ body: { action: 'create_book', requestKey: 'k' } })).toEqual({ status: null, body: null });
    expect(state.middlewareCalls).toEqual([{ rateLimit: { limit: 10, windowMs: 60000 } }]);
    expect(dumpStore(state.db)).toBe(before);
  });

  it('POST only', async () => {
    expect(await call({ method: 'GET' })).toEqual({ status: 405, body: { error: 'Method not allowed' } });
  });

  it('NO TOKEN: 401, nothing read or written', async () => {
    const before = dumpStore(state.db);
    expect(await call({ uid: null, body: { action: 'create_book', requestKey: 'k' } })).toEqual({ status: 401, body: { error: 'Authentication required' } });
    expect(dumpStore(state.db)).toBe(before);
  });

  it('A NON-FOUNDER: 403, whatever the action; the caller is not told which condition failed', async () => {
    const before = dumpStore(state.db);
    for (const action of ['create_book', 'admit_fixture', 'pause', 'resume', 'wind_down']) {
      expect(await call({ uid: 'someone', body: { action, requestKey: 'k' } }), action).toEqual({ status: 403, body: { error: 'forbidden' } });
    }
    expect(dumpStore(state.db)).toBe(before);
  });

  it('A FOUNDER AT \'off\': 403, and nothing is read — the same answer as a non-founder', async () => {
    setPracticeFieldModeForTests('off');
    state.db = { collection: () => { throw new Error('a read was made'); }, runTransaction: () => { throw new Error('a transaction was opened'); } };
    expect(await call({ body: { action: 'create_book', requestKey: 'k' } })).toEqual({ status: 403, body: { error: 'forbidden' } });
  });

  it('the allowlist is read at CALL time: unset, the founder is nobody; set again, the same request passes', async () => {
    delete process.env.MANDATE_FOUNDER_UIDS;
    expect(await call({ body: { action: 'create_book', requestKey: 'k' } })).toEqual({ status: 403, body: { error: 'forbidden' } });
    process.env.MANDATE_FOUNDER_UIDS = `x, ${UID}`;
    expect((await call({ body: { action: 'create_book', requestKey: 'k' } })).status).toBe(201);
  });

  it('A BODY-SUPPLIED UID IS IGNORED: the book is the token\'s owner\'s, with the token owner\'s ranked agent — never the body\'s', async () => {
    const out = await call({ body: { action: 'create_book', requestKey: 'k', uid: 'victim', userId: 'victim', ownerId: 'victim' } });
    expect(out).toMatchObject({ status: 201, body: { ok: true, attributionAgentId: `agent-${UID}` } });
    expect(getBook(state.db, out.body.bookId)).toMatchObject({ userId: UID, attributionAgentId: `agent-${UID}` });
    expect(state.db._get('practiceFieldBooks/victim')).toBeUndefined();
    expect(state.db._get(`practiceFieldBooks/${UID}`)).toMatchObject({ bookId: out.body.bookId });
    // A body naming the victim's agent is refused: it is not the caller's.
    process.env.MANDATE_FOUNDER_UIDS = `${UID},victim`;
    expect(await call({ uid: 'victim', body: { action: 'create_book', requestKey: 'k2', agentId: `agent-${UID}` } })).toEqual({ status: 404, body: { error: 'ranked_agent_not_found' } });
  });

  it('dispatches each action, idempotently on the request key', async () => {
    const created = await call({ body: { action: 'create_book', requestKey: 'c-1' } });
    expect(created.status).toBe(201);
    expect((await call({ body: { action: 'create_book', requestKey: 'c-1' } })).body).toMatchObject({ idempotentReplay: true, bookId: created.body.bookId });
    const { origin: _o, ...contract } = contractOf();
    const admitted = await call({ body: { action: 'admit_fixture', requestKey: 'a-1', contract } });
    expect(admitted).toMatchObject({ status: 201, body: { action: 'admit_fixture', status: 'accepted' } });
    expect((await call({ body: { action: 'admit_fixture', requestKey: 'a-1', contract } })).body).toMatchObject({ idempotentReplay: true, ideaId: admitted.body.ideaId });
    for (const [action, outcome] of [['pause', 'paused'], ['resume', 'resumed'], ['wind_down', 'draining']]) {
      expect((await call({ body: { action, requestKey: `${action}-1` } })).body, action).toMatchObject({ ok: true, action, outcome });
      expect((await call({ body: { action, requestKey: `${action}-1` } })).body, action).toMatchObject({ outcome, idempotentReplay: true });
    }
    expect(await call({ body: { action: 'nuke', requestKey: 'n-1' } })).toMatchObject({ status: 400, body: { error: 'unknown_action' } });
  });

  it('an internal failure answers 500 without its detail', async () => {
    state.db = { collection: () => { throw new Error('UNAVAILABLE: secret detail'); } };
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await call({ body: { action: 'create_book', requestKey: 'k' } })).toEqual({ status: 500, body: { error: 'internal_error' } });
    } finally { errors.mockRestore(); }
  });
});
