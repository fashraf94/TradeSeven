// api/_utils/practiceField/registryPresence.test.js
//
// Practice Field T1a-2a — Astra T2A-02: THE FOUNDER-CAP REGISTRY IS A COMPLETE LIST OF IDEA BOOKS. At mode 'on' a cron
// fire reads `practiceFieldBooks/_registry` once and, when it is missing or lists no open book, makes no Practice
// Field discovery query (sweep.js readIdeaBookPresence). That is safe only while two things hold, and this file pins
// both from the real source:
//
//   1. NOTHING CREATES OR REOPENS AN IDEA BOOK WITHOUT ADDING IT. The only builder of an idea-book document is
//      `buildIdeaBookDoc`, called only by `createIdeaBook`, which writes the book and the registry entry in ONE
//      transaction. Clients cannot write either collection (firestore.rules). No other writer of `mandates` gives a
//      document `kind: 'idea_book'` (the quarterly builders carry no kind; rollover and escape refuse idea books).
//      A book's status moves only forward: the founder's wind_down sets `draining` (founderControls.js), and the
//      close that completes the wind-down sets `closed` (close.js). Nothing sets a closed book open again.
//   2. NOTHING REMOVES AN ENTRY WHILE ITS BOOK IS ACTIVE OR DRAINING (T1a-2b-1 §6). The registry is written at two
//      sites: `createIdeaBook`, which keeps every entry already listed, and the close that completes a wind-down
//      (`closeNextSession`), which removes ONLY the book it closes, in the SAME transaction that sets that book
//      `closed` — a draining book with no open idea left. A closed book owes no fire anything, so the cron may still
//      skip discovery when the registry lists no book.
//
// A change that breaks either turns a row here red, and with it the reason the cron may skip discovery.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setPracticeFieldModeForTests } from './mode.js';
import { readIdeaBookPresence, PRESENCE_UNKNOWN } from './sweep.js';
import {
  seedBook, makeMandateFakeDb, admitAndEnter, contractOf, windDownBook, closeOn, storeCloseSnapshot, closeNowOf, DAYS, ADMIT_ISO,
} from './__testsupport__/fixtures.js';
import { admitIdea } from './admission.js';
import { closeIdeaBook } from './close.js';
import { buildNewMandateDoc } from '../mandateSchema.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const REGISTRY = 'practiceFieldBooks/_registry';

/** Every product source file (no test, no test support, no fixture) under the three trees the server and scripts use. */
function productSources() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) { if (name !== '__testsupport__' && name !== '__fixtures__' && name !== '__mocks__') walk(path); continue; }
      if (!/\.(m?js|jsx)$/.test(name) || /\.test\./.test(name)) continue;
      out.push(path);
    }
  };
  for (const top of ['api', 'scripts', 'src']) walk(join(ROOT, top));
  return out.map((p) => ({ path: relative(ROOT, p).split(sep).join('/'), text: readFileSync(p, 'utf8') }));
}

let restore;
beforeEach(() => { restore = setPracticeFieldModeForTests('on'); });
afterEach(() => restore());

describe('the registry is a complete list of idea books (T2A-02) — pinned from the source', () => {
  const sources = productSources();

  it('1. the only builder of an idea-book document is buildIdeaBookDoc, and its only caller is createIdeaBook', () => {
    const users = sources.filter((f) => /\bbuildIdeaBookDoc\b/.test(f.text)).map((f) => f.path);
    expect(users).toEqual(['api/_utils/practiceField/ideaBook.js']);
    const text = sources.find((f) => f.path === 'api/_utils/practiceField/ideaBook.js').text;
    expect(text.match(/\bbuildIdeaBookDoc\(/g)).toHaveLength(2); // its definition and the one call
    const create = text.slice(text.indexOf('export async function createIdeaBook('));
    expect(create).toMatch(/const bookDoc = buildIdeaBookDoc\(/);
    // …and the book and the registry entry are written in the same transaction.
    const tx = create.slice(create.indexOf('return db.runTransaction('));
    expect(tx).toMatch(/tx\.set\(bookRef, bookDoc\)/);
    expect(tx).toMatch(/tx\.set\(registryRef, \{ openBooks, cap, updatedAt: nowIso \}\)/);
    // The quarterly builder gives a book no idea-book kind.
    const quarterly = buildNewMandateDoc({
      mandateId: 'q', userId: 'u', archetype: 'analyst', managerAgentId: 'a', vintageRef: 'archetypeVintages/q', cadenceTier: 'fast',
      createdAt: new Date('2026-09-01T14:00:00Z'), quarterStartAt: new Date('2026-09-01T14:00:00Z'),
      nextRolloverAt: new Date('2026-12-01T21:00:00Z'), escapeHatchEligibleUntil: new Date('2026-09-15T14:00:00Z'),
    });
    expect(quarterly.kind).not.toBe('idea_book');
  });

  it('2. the registry is written at TWO sites: createIdeaBook keeps every entry; the close removes only the book it sets closed, in that transaction', () => {
    const named = sources.filter((f) => /PRACTICE_FIELD_BOOK_REGISTRY_ID|['"`]_registry['"`]/.test(f.text)).map((f) => f.path).sort();
    expect(named).toEqual(['api/_utils/practiceField/close.js', 'api/_utils/practiceField/constants.js', 'api/_utils/practiceField/ideaBook.js', 'api/_utils/practiceField/sweep.js']);
    const sweep = sources.find((f) => f.path === 'api/_utils/practiceField/sweep.js').text;
    expect(sweep).not.toMatch(/registry[^\n]*\.(set|update|create|delete)\(/i); // sweep.js only reads it
    const allow = JSON.parse(readFileSync(join(ROOT, 'api/_utils/compositionProtectedStoresAllowlist.json'), 'utf8'));
    const counts = allow.allowedWriteSites;
    const keys = Object.keys(counts).filter((k) => k.endsWith('::practiceFieldBooks')).sort();
    expect(keys).toEqual([
      'api/_utils/practiceField/close.js::closeNextSession::set::practiceFieldBooks',
      'api/_utils/practiceField/founderControls.js::applyControl::update::practiceFieldBooks',
      'api/_utils/practiceField/ideaBook.js::createIdeaBook::set::practiceFieldBooks',
    ]);
    expect(counts[keys[0]]).toBe(2); // the close: the registry and the owner's claim, only on completing a wind-down
    expect(counts[keys[1]]).toBe(1); // wind_down: the owner's CLAIM's status — founderControls.js never names the registry (above)
    expect(counts[keys[2]]).toBe(2); // creation: the owner's claim and the registry, nothing else
    const create = sources.find((f) => f.path === 'api/_utils/practiceField/ideaBook.js').text;
    expect(create).toMatch(/const openBooks = \{ \.\.\.\(registry\.openBooks \|\| \{\}\) \};/);
    expect(create).toMatch(/openBooks\[bookId\] = uid;/);
    expect(create).not.toMatch(/delete openBooks/);
    // The close: ONE removal, of this book's own entry, inside the block that sets this book `closed` — and that block
    // runs only for a DRAINING book with no open idea left.
    const close = sources.find((f) => f.path === 'api/_utils/practiceField/close.js').text;
    expect(close.match(/delete openBooks/g)).toHaveLength(1);
    expect(close).toMatch(/const completesWindDown = book\.status === 'draining' && \(working\.openIdeaIds \|\| \[\]\)\.length === 0;/);
    const block = close.slice(close.indexOf('if (completesWindDown) {\n      // 9. The book closes'.replace(/\n/g, close.includes('\r\n') ? '\r\n' : '\n')));
    expect(block.length).toBeLessThan(close.length);
    const body = block.slice(0, block.indexOf('tx.update(bookRef, bookPatch);'));
    expect(body).toMatch(/bookPatch\.status = 'closed';/);
    expect(body).toMatch(/delete openBooks\[bookRef\.id\];/);
    expect(body).toMatch(/tx\.set\(registryRef, \{ \.\.\.registry, openBooks, updatedAt: nowIso \}\);/);
  });

  it('2, in behaviour: a second book keeps the first one listed; a book WOUND DOWN for real stays listed while it is draining — and while it holds an idea, its close leaves it draining and listed', async () => {
    const db = makeMandateFakeDb();
    const a = await seedBook({ db, uid: 'owner-1', opId: 'c1' });
    const b = await seedBook({ db, uid: 'owner-2', opId: 'c2' });
    expect(Object.keys(db._get(REGISTRY).openBooks).sort()).toEqual([a.bookId, b.bookId].sort());
    const { ideaId } = await admitAndEnter(db, a.bookId, { contract: contractOf(), quotes: { AAPL: 230.17, SPY: 600.1 } });
    await windDownBook(db, { uid: 'owner-1' });
    expect(db._get(`mandates/${a.bookId}`).status).toBe('draining');
    expect(Object.keys(db._get(REGISTRY).openBooks).sort()).toEqual([a.bookId, b.bookId].sort());
    // A close with the idea still holding: the book stays draining and LISTED.
    const out = await closeOn(db, a.bookId, DAYS.d1, { AAPL: 231.4, SPY: 601.2 });
    expect(out.closed).toBe(true);
    expect(out.bookClosed).toBeUndefined();
    expect(db._get(`mandates/${a.bookId}/ideas/${ideaId}`).status).toBe('holding');
    expect(db._get(`mandates/${a.bookId}`).status).toBe('draining');
    expect(Object.keys(db._get(REGISTRY).openBooks).sort()).toEqual([a.bookId, b.bookId].sort());
    expect(await readIdeaBookPresence(db)).toEqual({ known: true, ideaBooks: true });
  });

  it('2, the removal (T1a-2b-1 §6): the close that finds a draining book with no open idea sets it closed, takes it off the registry and closes its claim — one transaction; an ACTIVE book with nothing open is never removed', async () => {
    const db = makeMandateFakeDb();
    const a = await seedBook({ db, uid: 'owner-1', opId: 'c1' });
    const b = await seedBook({ db, uid: 'owner-2', opId: 'c2' });
    // A: an idea admitted but never filled (its start session has no stored slot snapshot); then wound down.
    const admitted = await admitIdea(db, { bookId: a.bookId, contract: contractOf(), opId: 'idea-a', nowIso: ADMIT_ISO });
    expect(admitted.ok).toBe(true);
    await windDownBook(db, { uid: 'owner-1' });
    // B: active, nothing open at all — its close must never remove it.
    const bClose = await closeOn(db, b.bookId, DAYS.d1, { AAPL: 230.17, SPY: 600.1 });
    expect(bClose.closed).toBe(true);
    expect(db._get(`mandates/${b.bookId}`).status).toBe('active');
    expect(Object.keys(db._get(REGISTRY).openBooks).sort()).toEqual([a.bookId, b.bookId].sort());
    // A's close on the idea's start session: the idea times out, nothing is left open, and the wind-down completes.
    const aClose = await closeOn(db, a.bookId, DAYS.d1, { AAPL: 230.17, SPY: 600.1 });
    expect(aClose).toMatchObject({ closed: true, bookClosed: true, cancelled: [admitted.ideaId] });
    const book = db._get(`mandates/${a.bookId}`);
    expect(book).toMatchObject({ status: 'closed', closedOn: DAYS.d1, openIdeaIds: [], windDown: { completedSession: DAYS.d1 } });
    expect(book.treasury.unreservedCash).toBe(100000); // the reservation came back; no cash was reset or lost
    expect(Object.keys(db._get(REGISTRY).openBooks)).toEqual([b.bookId]);
    expect(db._get(REGISTRY).cap).toBe(4);
    expect(db._get('practiceFieldBooks/owner-1')).toMatchObject({ bookId: null, status: 'closed', closedBookId: a.bookId });
    expect(db._get('practiceFieldBooks/owner-2')).toMatchObject({ bookId: b.bookId, status: 'active' });
    // The owner may open another book now; the closed one stays readable and never reopens.
    const again = await seedBook({ db, uid: 'owner-1', opId: 'c3' });
    expect(again.bookId).not.toBe(a.bookId);
    expect(Object.keys(db._get(REGISTRY).openBooks).sort()).toEqual([again.bookId, b.bookId].sort());
    expect(db._get(`mandates/${a.bookId}`).status).toBe('closed');
  });

  it('the removal is atomic with the close: a close whose commit fails writes neither the status, the registry nor the claim; a rival registry write is kept', async () => {
    const db = makeMandateFakeDb();
    const a = await seedBook({ db, uid: 'owner-1', opId: 'c1' });
    await admitIdea(db, { bookId: a.bookId, contract: contractOf(), opId: 'idea-a', nowIso: ADMIT_ISO });
    await windDownBook(db, { uid: 'owner-1' });
    await storeCloseSnapshot(db, DAYS.d1, { AAPL: 230.17, SPY: 600.1 });
    const state = () => JSON.stringify([db._get(`mandates/${a.bookId}`), db._get(REGISTRY), db._get('practiceFieldBooks/owner-1')]);
    const before = state();
    // A commit that fails (the close's window row already exists, so its create-once aborts the whole close): the
    // book stays draining, still listed, its claim open.
    db._store.set(`mandates/${a.bookId}/windows/${DAYS.d1}_close`, { data: { planted: true }, version: 1 });
    await expect(closeIdeaBook(db, a.bookRef, { date: DAYS.d1, now: closeNowOf(DAYS.d1) })).rejects.toThrow(/ALREADY_EXISTS/);
    expect(state()).toBe(before);
    db._store.delete(`mandates/${a.bookId}/windows/${DAYS.d1}_close`);
    // A rival write to the registry between the close's read and its commit: the close retries over it, and the
    // removal is computed from the retry's read — the rival entry survives.
    let rivalDone = false;
    db.setBarrier(async () => {
      if (rivalDone) return;
      rivalDone = true;
      const r = db._get(REGISTRY);
      await db.collection('practiceFieldBooks').doc('_registry').set({ ...r, openBooks: { ...r.openBooks, pf_rival: 'owner-9' } });
    });
    const out = await closeIdeaBook(db, a.bookRef, { date: DAYS.d1, now: closeNowOf(DAYS.d1) });
    expect(out).toMatchObject({ closed: true, bookClosed: true });
    expect(Object.keys(db._get(REGISTRY).openBooks)).toEqual(['pf_rival']);
    expect(before).not.toBe(JSON.stringify([db._get(`mandates/${a.bookId}`), db._get(REGISTRY), db._get('practiceFieldBooks/owner-1')]));
  });

  it('clients can write neither collection: mandates is server-only, and practiceFieldBooks falls to the default deny', () => {
    const rules = readFileSync(join(ROOT, 'firestore.rules'), 'utf8');
    const mandates = rules.slice(rules.indexOf('match /mandates/{mandateId} {'));
    expect(mandates.slice(0, mandates.indexOf('\n      // Subcollections'))).toMatch(/allow write: if false;/);
    expect(rules).not.toMatch(/practiceFieldBooks/);
    expect(rules).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
  });
});

describe('readIdeaBookPresence — the fire\'s one read (T2A-02)', () => {
  it('missing → no idea book; empty → no idea book; listing → idea books; not the registry\'s shape → unknown', async () => {
    expect(await readIdeaBookPresence(makeMandateFakeDb())).toEqual({ known: true, ideaBooks: false });
    expect(await readIdeaBookPresence(makeMandateFakeDb({ [REGISTRY]: { openBooks: {}, cap: 4 } }))).toEqual({ known: true, ideaBooks: false });
    expect(await readIdeaBookPresence(makeMandateFakeDb({ [REGISTRY]: { openBooks: { b1: 'u1' }, cap: 4 } }))).toEqual({ known: true, ideaBooks: true });
    for (const openBooks of [undefined, null, ['b1'], 'b1']) {
      expect(await readIdeaBookPresence(makeMandateFakeDb({ [REGISTRY]: { openBooks, cap: 4 } })), String(openBooks)).toEqual(PRESENCE_UNKNOWN);
    }
  });

  it('a failed read answers "unknown" (discovery runs as before), is logged, and never throws', async () => {
    const errors = [];
    const original = console.error;
    console.error = (...x) => errors.push(x.join(' '));
    try {
      const failing = { collection: () => ({ doc: () => ({ get: async () => { throw new Error('UNAVAILABLE: injected'); } }) }) };
      expect(await readIdeaBookPresence(failing)).toEqual(PRESENCE_UNKNOWN);
    } finally { console.error = original; }
    expect(errors).toEqual([expect.stringMatching(/PRACTICE_FIELD_REGISTRY_READ_FAILED — discovery runs as before: UNAVAILABLE: injected/)]);
  });

  it('at \'off\' it reads nothing', async () => {
    const r = setPracticeFieldModeForTests('off');
    try {
      const untouchable = { collection: () => { throw new Error('a read was made'); } };
      expect(await readIdeaBookPresence(untouchable)).toEqual(PRESENCE_UNKNOWN);
    } finally { r(); }
  });
});
