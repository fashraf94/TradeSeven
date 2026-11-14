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
//      document `kind: 'idea_book'` (the quarterly builders carry no kind; rollover and escape refuse idea books), and
//      nothing in this build sets an idea book's status at all.
//   2. NOTHING REMOVES AN ENTRY. The registry is written at exactly one site — `createIdeaBook`, the protected-store
//      allowlist's one `practiceFieldBooks` key — and that write keeps every entry already listed.
//
// A change that breaks either (T1a-2b's drain and close will write the status; whoever closes a book must decide what
// the registry says) turns a row here red, and with it the reason the cron may skip discovery.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setPracticeFieldModeForTests } from './mode.js';
import { readIdeaBookPresence, PRESENCE_UNKNOWN } from './sweep.js';
import { seedBook, makeMandateFakeDb } from './__testsupport__/fixtures.js';
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

  it('2. the registry is written at ONE site, createIdeaBook, and that write keeps every entry already listed', () => {
    const named = sources.filter((f) => /PRACTICE_FIELD_BOOK_REGISTRY_ID|['"`]_registry['"`]/.test(f.text)).map((f) => f.path).sort();
    expect(named).toEqual(['api/_utils/practiceField/constants.js', 'api/_utils/practiceField/ideaBook.js', 'api/_utils/practiceField/sweep.js']);
    const sweep = sources.find((f) => f.path === 'api/_utils/practiceField/sweep.js').text;
    expect(sweep).not.toMatch(/registry[^\n]*\.(set|update|create|delete)\(/i); // sweep.js only reads it
    const allow = JSON.parse(readFileSync(join(ROOT, 'api/_utils/compositionProtectedStoresAllowlist.json'), 'utf8'));
    const counts = allow.allowedWriteSites;
    const keys = Object.keys(counts).filter((k) => k.endsWith('::practiceFieldBooks'));
    expect(keys).toEqual(['api/_utils/practiceField/ideaBook.js::createIdeaBook::set::practiceFieldBooks']);
    expect(counts[keys[0]]).toBe(2); // the owner's claim and the registry, nothing else
    const create = sources.find((f) => f.path === 'api/_utils/practiceField/ideaBook.js').text;
    expect(create).toMatch(/const openBooks = \{ \.\.\.\(registry\.openBooks \|\| \{\}\) \};/);
    expect(create).toMatch(/openBooks\[bookId\] = uid;/);
    expect(create).not.toMatch(/delete openBooks/);
  });

  it('2, in behaviour: a second book keeps the first one listed; a book set draining (a fixture: nothing sets it yet) stays listed', async () => {
    const db = makeMandateFakeDb();
    const a = await seedBook({ db, uid: 'owner-1', opId: 'c1' });
    const b = await seedBook({ db, uid: 'owner-2', opId: 'c2' });
    expect(Object.keys(db._get(REGISTRY).openBooks).sort()).toEqual([a.bookId, b.bookId].sort());
    await a.bookRef.update({ status: 'draining' });
    expect(Object.keys(db._get(REGISTRY).openBooks).sort()).toEqual([a.bookId, b.bookId].sort());
    expect(await readIdeaBookPresence(db)).toEqual({ known: true, ideaBooks: true });
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
