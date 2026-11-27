// api/practice-field/book.test.js
//
// Practice Field build B3 — GET /api/practice-field/book: the gate in the cardsGate.js order (middleware → no-store →
// mode or switch off 404 before auth → 401 → the mode's gate 404 → GET only), the caller's own book through its claim,
// and privacy: the uid is the token's, no parameter reaches another owner's book, and no id that is not the caller's
// (nor the caller's own) leaves in the answer. The middleware, the token check and the Admin SDK are stubbed at their
// module edges (the founder.test.js idiom); the Practice Field modules, the mode gate and the flags are real.

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

import handler, { BOOK_RATE_LIMIT } from './book.js';
import { setPracticeFieldModeForTests, setPracticeFieldScreenForTests } from '../_utils/practiceField/mode.js';
import { PRACTICE_FIELD_SCREEN_ENABLED } from '../../src/config/practiceFieldScreenFlags.js';
import { makeMandateFakeDb, dumpStore } from '../_utils/practiceField/__testsupport__/fixtures.js';
import { buildBookView } from '../_utils/practiceField/bookView.js';
import { sceneDocs, sceneDocsFor, sceneInput, SCENE_UID, SCENE_BOOK_ID, SCENE_AGENT_ID } from '../_utils/practiceField/__testsupport__/bookViewScenes.js';

const B = { uid: 'owner-other', bookId: 'pf_other_book', ideaPrefix: 'zz' };

function call({ method = 'GET', uid = SCENE_UID, query = {}, body = undefined, headers = {} } = {}) {
  const out = { status: null, body: null, headers: {} };
  const res = {
    status(n) { out.status = n; return this; },
    json(b) { out.body = b; return this; },
    setHeader(k, v) { out.headers[k.toLowerCase()] = v; },
    end() { return this; },
  };
  const req = { method, query, body, headers: { ...(uid ? { authorization: `Bearer ${uid}` } : {}), ...headers } };
  return handler(req, res).then(() => out);
}
const strings = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
};
const NO_READS = { collection: () => { throw new Error('a read was made'); }, runTransaction: () => { throw new Error('a transaction was opened'); } };

let restoreMode;
let restoreScreen;
let errSpy;
beforeEach(() => {
  // Two owners in one store: the caller (the full book) and another (the History book, every id renamed).
  state.db = makeMandateFakeDb({ ...sceneDocs('full'), ...sceneDocsFor('history', B) });
  state.middlewareHandles = false;
  state.middlewareCalls = [];
  restoreMode = setPracticeFieldModeForTests('on');
  restoreScreen = setPracticeFieldScreenForTests(true);
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { restoreScreen(); restoreMode(); errSpy.mockRestore(); });

describe('GET /api/practice-field/book — the gate', () => {
  it('with nothing overridden the route follows the shipped switch (off on merge: 404 before auth, nothing read)', async () => {
    restoreScreen();
    restoreScreen = setPracticeFieldScreenForTests(null);
    // Behaviour-branched on the flag, so a flip moves only its own pin (practiceFieldScreenFlags.test.js).
    if (!PRACTICE_FIELD_SCREEN_ENABLED) state.db = NO_READS;
    expect((await call()).status).toBe(PRACTICE_FIELD_SCREEN_ENABLED ? 200 : 404);
    expect((await call({ uid: null })).status).toBe(PRACTICE_FIELD_SCREEN_ENABLED ? 401 : 404);
  });

  it('runs the security middleware first, with its rate limit; a request it answers goes no further', async () => {
    state.middlewareHandles = true;
    state.db = NO_READS;
    expect(await call()).toMatchObject({ status: null, body: null });
    expect(state.middlewareCalls).toEqual([{ rateLimit: BOOK_RATE_LIMIT }]);
  });

  it('every answer from the gate on is private, no-store', async () => {
    for (const out of [await call(), await call({ uid: null }), await call({ method: 'POST' })]) {
      expect(out.headers['cache-control']).toBe('private, no-store');
    }
    setPracticeFieldScreenForTests(false);
    expect((await call()).headers['cache-control']).toBe('private, no-store');
  });

  it('the switch off: 404, before auth (no token is 404, not 401) and before any read', async () => {
    setPracticeFieldScreenForTests(false);
    state.db = NO_READS;
    expect(await call()).toMatchObject({ status: 404, body: { error: 'disabled' } });
    expect(await call({ uid: null })).toMatchObject({ status: 404, body: { error: 'disabled' } });
  });

  it('the mode \'off\': 404 the same way, whatever the switch says', async () => {
    setPracticeFieldModeForTests('off');
    state.db = NO_READS;
    expect(await call()).toMatchObject({ status: 404, body: { error: 'disabled' } });
    expect(await call({ uid: null })).toMatchObject({ status: 404, body: { error: 'disabled' } });
  });

  it('no token, with the screen on: 401, nothing read', async () => {
    state.db = NO_READS;
    expect(await call({ uid: null })).toEqual({ status: 401, body: { error: 'Authentication required' }, headers: { 'cache-control': 'private, no-store' } });
  });

  it('a uid the mode does not admit (\'allowlist\', not on the list): the same 404, nothing read', async () => {
    setPracticeFieldModeForTests('allowlist');
    const prev = process.env.COCKPIT_ALLOWLIST_UIDS;
    process.env.COCKPIT_ALLOWLIST_UIDS = 'someone-else';
    try {
      state.db = NO_READS;
      expect(await call()).toMatchObject({ status: 404, body: { error: 'disabled' } });
    } finally {
      if (prev === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = prev;
    }
  });

  it('GET only: 405', async () => {
    expect(await call({ method: 'POST' })).toMatchObject({ status: 405 });
  });

  it('reads only: the store is byte-identical after a read', async () => {
    const before = dumpStore(state.db);
    expect((await call()).status).toBe(200);
    expect(dumpStore(state.db)).toBe(before);
  });
});

describe('GET /api/practice-field/book — the caller\'s own book, and nothing else', () => {
  it('the caller\'s view: exactly the view of their stored book', async () => {
    const out = await call();
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ book: JSON.parse(JSON.stringify(buildBookView({ ...sceneInput('full'), agentOn: false }))) });
  });

  it('a uid with no book: { book: null }', async () => {
    expect(await call({ uid: 'nobody-yet' })).toMatchObject({ status: 200, body: { book: null } });
  });

  it('a claim naming ANOTHER owner\'s book answers null (the book must be the uid\'s own), and so does a closed one', async () => {
    await state.db.collection('practiceFieldBooks').doc('intruder').set({ bookId: B.bookId, status: 'active' });
    expect(await call({ uid: 'intruder' })).toMatchObject({ status: 200, body: { book: null } });
    await state.db.collection('mandates').doc(SCENE_BOOK_ID).set({ status: 'closed' }, { merge: true });
    expect(await call()).toMatchObject({ status: 200, body: { book: null } });
  });

  it('user A can never receive user B\'s book: no query, body or header value reaches it', async () => {
    const own = (await call()).body;
    const tries = [
      { query: { uid: B.uid, userId: B.uid, bookId: B.bookId } },
      { body: { uid: B.uid, bookId: B.bookId } },
      { headers: { 'x-uid': B.uid, 'x-user-id': B.uid, 'x-book-id': B.bookId } },
      { query: { uid: B.uid }, body: { uid: B.uid }, headers: { 'x-uid': B.uid } },
    ];
    for (const t of tries) expect((await call(t)).body, JSON.stringify(t)).toEqual(own);
    // …and B, asking with A's ids, gets B's own book, never A's.
    const theirs = (await call({ uid: B.uid, query: { uid: SCENE_UID, bookId: SCENE_BOOK_ID } })).body;
    expect(theirs.book).not.toBeNull();
    expect(theirs).not.toEqual(own);
    expect(theirs.book.history.items.length).toBeGreaterThan(0);
  });

  it('the answer holds no id at all: not the other owner\'s, and not the caller\'s own', async () => {
    const out = await call();
    const ids = [
      SCENE_UID, SCENE_BOOK_ID, SCENE_AGENT_ID, 'i_energy', 'i_banks', 'i_insurers',
      B.uid, B.bookId, `${B.ideaPrefix}agent`, `${B.ideaPrefix}i_banks`, `${B.ideaPrefix}f_nvda`,
    ];
    for (const s of strings(out.body)) for (const id of ids) expect(s.includes(id), s).toBe(false);
  });

  it('a read that fails: 500, with no detail', async () => {
    state.db = { collection: () => { throw new Error('boom: mandates/pf_secret'); } };
    expect(await call()).toMatchObject({ status: 500, body: { error: 'internal_error' } });
  });
});

describe('GET /api/practice-field/book — B5-4: one consistent book, or "try again"', () => {
  /** The store, where the book's revision moves (as a close moves it) each time the reader asks for the daily rows. */
  function changingUnderEachPass(db, times) {
    let left = times;
    const bump = () => {
      if (left <= 0) return;
      left -= 1;
      const e = db._store.get(`mandates/${SCENE_BOOK_ID}`);
      db._store.set(`mandates/${SCENE_BOOK_ID}`, { data: { ...e.data, revision: (e.data.revision ?? 0) + 1 }, version: e.version + 1 });
    };
    const wrapQuery = (q, daily) => ({
      where: (...a) => wrapQuery(q.where(...a), daily), orderBy: (...a) => wrapQuery(q.orderBy(...a), daily), limit: (n) => wrapQuery(q.limit(n), daily),
      get: async () => { const s = await q.get(); if (daily) bump(); return s; },
    });
    const wrapDoc = (d) => ({ id: d.id, get: () => d.get(), collection: (n) => wrapCol(d.collection(n), n === 'dailyRows') });
    const wrapCol = (c, daily = false) => ({ ...wrapQuery(c, daily), doc: (id) => wrapDoc(c.doc(id)) });
    return { collection: (n) => wrapCol(db.collection(n)) };
  }

  it('the book changing under both passes: 503 { error: \'try_again\' }, private, no-store — never a mixed book, never "no book"', async () => {
    const store = state.db;
    state.db = changingUnderEachPass(store, 2);
    const out = await call();
    expect(out).toEqual({ status: 503, body: { error: 'try_again' }, headers: { 'cache-control': 'private, no-store' } });
  });

  it('the book changing under the first pass only: 200, the second pass\'s whole book', async () => {
    const store = state.db;
    state.db = changingUnderEachPass(store, 1);
    const out = await call();
    expect(out.status).toBe(200);
    state.db = store;
    expect(out.body).toEqual((await call()).body);
  });
});
