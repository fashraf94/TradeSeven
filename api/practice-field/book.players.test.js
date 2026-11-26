// api/practice-field/book.players.test.js
//
// Practice Field build B4 — THE SCREEN WITH TWELVE OWNERS (privacy; rule 7: a new file, book.test.js untouched). The
// middleware, the token check and the Admin SDK are stubbed at their module edges (book.test.js's idiom); the Practice
// Field modules, the mode gate, the player list and the flags are real. At PRACTICE_FIELD_MODE 'allowlist':
//   • the endpoint returns each caller their own book and no other, whatever a query, body or header names;
//   • no answer holds another owner's id or text (nor, by B3's rule, the caller's own ids);
//   • a player removed from the player list gets the quiet 404, with nothing read; a uid on the cockpit's list alone too.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    const token = req.headers?.authorization;
    if (typeof token !== 'string' || !token.startsWith('Bearer ')) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: token.slice('Bearer '.length) };
  },
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));

import handler from './book.js';
import { setPracticeFieldModeForTests, setPracticeFieldScreenForTests } from '../_utils/practiceField/mode.js';
import { PRACTICE_FIELD_PLAYER_ENV } from '../_utils/practiceField/playerList.js';
import { COCKPIT_ALLOWLIST_ENV } from '../_utils/callRecords/allowlist.js';
import { createIdeaBook } from '../_utils/practiceField/ideaBook.js';
import { admitIdea } from '../_utils/practiceField/admission.js';
import { makeMandateFakeDb, contractOf, ADMIT_ISO, dumpStore } from '../_utils/practiceField/__testsupport__/fixtures.js';

const OWNERS = Array.from({ length: 12 }, (_, i) => `player-${String(i + 1).padStart(2, '0')}`);
const NAMES = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'XOM', 'CVX', 'KO', 'PEP', 'WMT', 'HD'];
const WORDS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima'];
/** Each owner's own words (never their uid: no id may appear in any answer). */
const markerOf = (uid) => `Thesis marker ${WORDS[OWNERS.indexOf(uid)]}: this owner's own words.`;

function call({ uid, query = {}, body = undefined, headers = {} }) {
  const out = { status: null, body: null };
  const res = {
    status(n) { out.status = n; return this; },
    json(b) { out.body = b; return this; },
    setHeader() {},
    end() { return this; },
  };
  const req = { method: 'GET', query, body, headers: { ...(uid ? { authorization: `Bearer ${uid}` } : {}), ...headers } };
  return handler(req, res).then(() => out);
}
const strings = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
};
const NO_READS = { collection: () => { throw new Error('a read was made'); }, runTransaction: () => { throw new Error('a transaction was opened'); } };

/** Twelve owners, each with an open book and one admitted idea of their own (their thesis, their name). */
async function twelveBooks() {
  const db = makeMandateFakeDb();
  const ids = {};
  for (const [i, uid] of OWNERS.entries()) {
    const book = await createIdeaBook(db, { uid, attributionAgentId: `agent-${uid}`, archetypeCodeId: 'momentum_chaser', opId: `create-${uid}`, nowIso: ADMIT_ISO });
    expect(book.ok, uid).toBe(true);
    const idea = await admitIdea(db, { bookId: book.bookId, contract: contractOf({ names: [NAMES[i]], thesis: { text: markerOf(uid), author: 'founder_fixture' } }), opId: `idea-${uid}`, nowIso: ADMIT_ISO });
    expect(idea.ok, uid).toBe(true);
    ids[uid] = { bookId: book.bookId, ideaId: idea.ideaId, agentId: `agent-${uid}` };
  }
  return { db, ids };
}

let restoreMode;
let restoreScreen;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('allowlist');
  restoreScreen = setPracticeFieldScreenForTests(true);
  vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, OWNERS.join(','));
  vi.stubEnv(COCKPIT_ALLOWLIST_ENV, '');
});
afterEach(() => { restoreMode(); restoreScreen(); vi.unstubAllEnvs(); });

describe('the screen with twelve owners (B4 privacy)', () => {
  it('each caller gets their own book and no other — by any query, body or header naming another owner, book or idea', { timeout: 60_000 }, async () => {
    const { db, ids } = await twelveBooks();
    state.db = db;
    const before = dumpStore(db);
    for (const [i, uid] of OWNERS.entries()) {
      const other = OWNERS[(i + 5) % OWNERS.length];
      const plain = await call({ uid });
      expect(plain.status, uid).toBe(200);
      const hostile = await call({
        uid,
        query: { uid: other, owner: other, ownerUid: other, userId: other, bookId: ids[other].bookId, ideaId: ids[other].ideaId },
        body: { uid: other, ownerUid: other, bookId: ids[other].bookId },
        headers: { 'x-uid': other, 'x-owner-uid': other, 'x-book-id': ids[other].bookId },
      });
      expect(hostile, uid).toEqual(plain);
      const text = strings(plain.body).join('\n');
      expect(text, uid).toContain(markerOf(uid));
      expect(text, uid).toContain(NAMES[i]);
      for (const o of OWNERS) {
        // No other owner's uid, book, idea, agent or words — and, by B3's rule, none of the caller's own ids either.
        for (const id of [o, ids[o].bookId, ids[o].ideaId, ids[o].agentId]) expect(text.includes(id), `${uid}'s answer holds ${id}`).toBe(false);
        if (o !== uid) expect(text.includes(markerOf(o)), `${uid}'s answer holds ${o}'s thesis`).toBe(false);
      }
    }
    expect(dumpStore(db)).toBe(before); // reads only
  });

  it('a player REMOVED from the list gets the quiet 404, with nothing read — their book still exists; the others still read theirs', { timeout: 60_000 }, async () => {
    const { db } = await twelveBooks();
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, OWNERS.filter((u) => u !== OWNERS[3]).join(','));
    state.db = NO_READS;
    expect(await call({ uid: OWNERS[3] })).toEqual({ status: 404, body: { error: 'disabled' } });
    state.db = db;
    expect((await call({ uid: OWNERS[4] })).status).toBe(200);
  });

  it('a uid on the cockpit\'s list alone gets the same quiet 404, with nothing read; a listed uid with no book gets `book: null`', async () => {
    vi.stubEnv(COCKPIT_ALLOWLIST_ENV, 'cockpit-only');
    state.db = NO_READS;
    expect(await call({ uid: 'cockpit-only' })).toEqual({ status: 404, body: { error: 'disabled' } });
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, [...OWNERS, 'no-book-yet'].join(','));
    state.db = makeMandateFakeDb();
    expect(await call({ uid: 'no-book-yet' })).toEqual({ status: 200, body: { book: null } });
  });
});
