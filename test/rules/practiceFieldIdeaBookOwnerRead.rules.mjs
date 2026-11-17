// test/rules/practiceFieldIdeaBookOwnerRead.rules.mjs
//
// Practice Field T1a-2b-1 §1 (shared contract V2 §9) — Firestore security-rules acceptance for the idea book's own
// stores under mandates/{bookId}: ideas/{ideaId}, its rows/{rowId} and evidence/{packetId}, epochs/{epochId} and the
// window ledger windows/{rowId}. The rule reads the PARENT book with get(), as the existing sub-collection rules do:
//   owner read iff  request.auth.uid == book.userId  AND  book.kind == 'idea_book';  every client write denied.
//
// THE CLAIMS:
//   · the owner reads each store's document, and lists each store (positive controls — a misloaded or over-broad
//     ruleset cannot pass by failing everything);
//   · another signed-in user, a privileged-claims context and an unauthenticated client are denied each document and
//     each list;
//   · nobody — the owner included — can create, update, merge or delete in any of them;
//   · a QUARTERLY book's owner gains nothing new: a document planted under their book in any of these stores is
//     denied to them; their book doc, dailyRows, decisions, corporateActions and quarterSummaries read exactly as
//     before;
//   · the book's own doc and its dailyRows / decisions / corporateActions keep their rules (the idea book's owner
//     reads them; another user does not); its spendOps — the per-call spend records — are read by nobody;
//   · ANOTHER idea-book owner, with a book and a claim of their own, reads nothing of the owner's (review A1); a
//     CLOSED idea book stays readable to its owner (contract V2 §11; review A3);
//   · the server-only stores the Practice Field keeps OUTSIDE the book (its claims, their founderOps request records,
//     the founder-cap registry, the coverage document) stay denied to every client;
//   · the rules text carries exactly these blocks, inside mandates/{mandateId}.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { createHash } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { RULES_TEXT } from './callRecordsRulesSuite.mjs';

const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');
const OWNER = 'pf-owner-1';
const OTHER = 'pf-intruder-2';
const PRIVILEGED = 'pf-admin-3';
const QUARTERLY_OWNER = 'q-owner-4';
const OWNER2 = 'pf-owner-5'; // another player with an idea book and a claim of their own (review A1)

const BOOK = 'mandates/pf_book_1';
const QBOOK = 'mandates/q_book_1';
const BOOK2 = 'mandates/pf_book_2';
const CLOSED = 'mandates/pf_book_closed';
const IDEA = `${BOOK}/ideas/idea_1`;
// Each store: a document path and the collection that holds it.
const STORES = Object.freeze([
  ['ideas', IDEA, `${BOOK}/ideas`],
  ['ideas/rows', `${IDEA}/rows/2026-11-16`, `${IDEA}/rows`],
  ['ideas/rows (endpoint)', `${IDEA}/rows/endpoint`, `${IDEA}/rows`],
  ['ideas/evidence (admission)', `${IDEA}/evidence/admission`, `${IDEA}/evidence`],
  ['ideas/evidence (result)', `${IDEA}/evidence/result`, `${IDEA}/evidence`],
  ['epochs', `${BOOK}/epochs/epoch-0001`, `${BOOK}/epochs`],
  ['windows', `${BOOK}/windows/2026-11-16_open30`, `${BOOK}/windows`],
  ['windows (close)', `${BOOK}/windows/2026-11-16_close`, `${BOOK}/windows`],
]);
// The same stores, planted under a QUARTERLY book (the server never writes them there).
const Q_IDEA = `${QBOOK}/ideas/idea_q`;
const PLANTED = Object.freeze([
  `${Q_IDEA}`, `${Q_IDEA}/rows/2026-11-16`, `${Q_IDEA}/evidence/result`, `${QBOOK}/epochs/epoch-0001`, `${QBOOK}/windows/2026-11-16_close`,
]);

const ideaBook = { kind: 'idea_book', userId: OWNER, status: 'active', bookId: 'pf_book_1', attributionAgentId: 'agent-1' };
const quarterlyBook = { userId: QUARTERLY_OWNER, status: 'active', archetype: 'analyst' }; // the quarterly builder writes no `kind`

let testEnv;
const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
const asOwner = () => testEnv.authenticatedContext(OWNER).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED, { admin: true, role: 'service' }).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const asQuarterlyOwner = () => testEnv.authenticatedContext(QUARTERLY_OWNER).firestore();
const asOwner2 = () => testEnv.authenticatedContext(OWNER2).firestore();
const EVERYONE = [['the owner', asOwner], ['another user', asOther], ['a privileged-claims context', asPrivileged], ['an unauthenticated client', asAnon]];

beforeAll(async () => {
  console.log(`[practiceFieldIdeaBookOwnerRead] rules text sha256: ${RULES_SHA256}`);
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [emuHost, emuPort] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-tradeseven-rules',
    firestore: { rules: RULES_TEXT, host: emuHost, port: Number(emuPort) },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(BOOK, ideaBook);
  for (const [, path] of STORES) await seed(path, { bookId: 'pf_book_1', seeded: true });
  await seed(`${BOOK}/dailyRows/2026-11-16`, { date: '2026-11-16' });
  await seed(`${BOOK}/decisions/d1`, { verb: 'BUY' });
  await seed(`${BOOK}/corporateActions/a1`, { type: 'split' });
  await seed(`${BOOK}/spendOps/call-1`, { opId: 'call-1', state: 'reserved' });
  await seed(`practiceFieldBooks/${OWNER}/founderOps/p-1`, { action: 'pause' });
  // A second player's idea book and claim; and a CLOSED idea book of the owner's (contract V2 §11: still readable).
  await seed(BOOK2, { ...ideaBook, userId: OWNER2, bookId: 'pf_book_2' });
  await seed(`practiceFieldBooks/${OWNER2}`, { bookId: 'pf_book_2', status: 'active' });
  await seed(CLOSED, { ...ideaBook, bookId: 'pf_book_closed', status: 'closed' });
  for (const [, path] of STORES) await seed(path.replace(BOOK, CLOSED), { bookId: 'pf_book_closed', seeded: true });
  await seed(QBOOK, quarterlyBook);
  // The quarterly player carries full state too: their active-book pointer (refuter A, A1).
  await seed(`userMeta/${QUARTERLY_OWNER}`, { activeMandateId: 'q_book_1' });
  await seed(`userMeta/${OWNER2}`, { activeMandateId: null });
  for (const path of PLANTED) await seed(path, { planted: true });
  await seed(`${QBOOK}/dailyRows/2026-11-16`, { date: '2026-11-16' });
  await seed(`${QBOOK}/decisions/d1`, { verb: 'BUY' });
  await seed(`${QBOOK}/corporateActions/a1`, { type: 'split' });
  await seed(`${QBOOK}/quarterSummaries/0`, { quarterIndex: 0 });
  await seed(`practiceFieldBooks/${OWNER}`, { bookId: 'pf_book_1', status: 'active' });
  await seed('practiceFieldBooks/_registry', { openBooks: { pf_book_1: OWNER }, cap: 4 });
  await seed('practiceFieldCoverage/current', { symbols: {} });
});

describe('the idea book\'s own stores — owner read', () => {
  for (const [name, path, col] of STORES) {
    it(`${name}: the owner reads the document and lists the collection (positive control)`, async () => {
      await assertSucceeds(getDoc(doc(asOwner(), path)));
      const listed = await assertSucceeds(getDocs(collection(asOwner(), col)));
      expect(listed.docs.map((d) => d.ref.path)).toContain(path);
    });
    it(`${name}: another user, ANOTHER IDEA-BOOK OWNER, a QUARTERLY player, a privileged-claims context and an unauthenticated client are denied the document and the list`, async () => {
      for (const ctx of [asOther, asOwner2, asQuarterlyOwner, asPrivileged, asAnon]) {
        await assertFails(getDoc(doc(ctx(), path)));
        await assertFails(getDocs(collection(ctx(), col)));
      }
    });
  }
  it('a document of a store that is not there yet is readable to the owner as absent, and to nobody else', async () => {
    const missing = await assertSucceeds(getDoc(doc(asOwner(), `${IDEA}/evidence/never`)));
    expect(missing.exists()).toBe(false);
    await assertFails(getDoc(doc(asOther(), `${IDEA}/evidence/never`)));
  });
});

describe('nobody writes them — the owner included (Admin SDK only)', () => {
  for (const [who, ctx] of EVERYONE) {
    it(`${who} cannot create, update, merge or delete in any of the stores`, async () => {
      for (const [name, path, col] of STORES) {
        await assertFails(setDoc(doc(ctx(), `${col}/planted_by_client`), { x: 1 }));
        await assertFails(updateDoc(doc(ctx(), path), { seeded: false }));
        await assertFails(setDoc(doc(ctx(), path), { seeded: false }, { merge: true }));
        await assertFails(deleteDoc(doc(ctx(), path)));
        expect(name).toBeTruthy();
      }
    });
  }
});

describe('a quarterly book\'s owner gains nothing new', () => {
  it('a document planted under a QUARTERLY book in any of these stores is denied to its owner (the parent is not an idea book) — and listing them too', async () => {
    for (const path of PLANTED) await assertFails(getDoc(doc(asQuarterlyOwner(), path)));
    await assertFails(getDocs(collection(asQuarterlyOwner(), `${QBOOK}/ideas`)));
    await assertFails(getDocs(collection(asQuarterlyOwner(), `${QBOOK}/windows`)));
    await assertFails(getDocs(collection(asQuarterlyOwner(), `${QBOOK}/epochs`)));
    await assertFails(getDocs(collection(asQuarterlyOwner(), `${Q_IDEA}/rows`))); // review A2: the nested stores, listed
    await assertFails(getDocs(collection(asQuarterlyOwner(), `${Q_IDEA}/evidence`)));
  });
  it('…while the book and its existing stores read exactly as before', async () => {
    await assertSucceeds(getDoc(doc(asQuarterlyOwner(), QBOOK)));
    for (const sub of ['dailyRows/2026-11-16', 'decisions/d1', 'corporateActions/a1', 'quarterSummaries/0']) {
      await assertSucceeds(getDoc(doc(asQuarterlyOwner(), `${QBOOK}/${sub}`)));
      await assertFails(getDoc(doc(asOther(), `${QBOOK}/${sub}`)));
    }
    // …and the idea book's stores are not a quarterly owner's either.
    await assertFails(getDoc(doc(asQuarterlyOwner(), IDEA)));
  });
});

describe('what stays as it was', () => {
  it('the idea book\'s own doc, dailyRows, decisions and corporateActions: its owner reads them, another user does not', async () => {
    for (const path of [BOOK, `${BOOK}/dailyRows/2026-11-16`, `${BOOK}/decisions/d1`, `${BOOK}/corporateActions/a1`]) {
      await assertSucceeds(getDoc(doc(asOwner(), path)));
      await assertFails(getDoc(doc(asOther(), path)));
    }
  });
  it('the per-call spend records under the book (spendOps) and the founder\'s request records under the owner\'s claim (founderOps) are read by nobody — no rule matches them', async () => {
    for (const [, ctx] of EVERYONE) {
      await assertFails(getDoc(doc(ctx(), `${BOOK}/spendOps/call-1`)));
      await assertFails(getDocs(collection(ctx(), `${BOOK}/spendOps`)));
      await assertFails(getDoc(doc(ctx(), `practiceFieldBooks/${OWNER}/founderOps/p-1`)));
    }
  });
  it('a CLOSED idea book stays readable to its owner, store by store (contract V2 §11), and to nobody else (review A3)', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), CLOSED)));
    for (const [name, path, col] of STORES) {
      await assertSucceeds(getDoc(doc(asOwner(), path.replace(BOOK, CLOSED))));
      await assertSucceeds(getDocs(collection(asOwner(), col.replace(BOOK, CLOSED))));
      await assertFails(getDoc(doc(asOwner2(), path.replace(BOOK, CLOSED))));
      expect(name).toBeTruthy();
    }
  });
  it('the second player reads their OWN idea book\'s stores and not the first\'s (a positive control for the A1 rows)', async () => {
    await seed(`${BOOK2}/ideas/idea_2`, { seeded: true });
    await assertSucceeds(getDoc(doc(asOwner2(), `${BOOK2}/ideas/idea_2`)));
    await assertFails(getDoc(doc(asOwner(), `${BOOK2}/ideas/idea_2`)));
  });
  it('the Practice Field\'s server-only stores outside the book — the owner\'s claim, the founder-cap registry, the coverage document — stay denied to every client', async () => {
    for (const path of [`practiceFieldBooks/${OWNER}`, 'practiceFieldBooks/_registry', 'practiceFieldCoverage/current']) {
      for (const [, ctx] of EVERYONE) {
        await assertFails(getDoc(doc(ctx(), path)));
        await assertFails(setDoc(doc(ctx(), path), { x: 1 }));
      }
    }
  });
});

describe('the rules text', () => {
  it('carries the owner function and the five blocks inside mandates/{mandateId}, each read by isIdeaBookOwner and written by nobody', () => {
    const start = RULES_TEXT.indexOf('match /mandates/{mandateId} {');
    expect(start).toBeGreaterThan(-1);
    const block = RULES_TEXT.slice(start, RULES_TEXT.indexOf('match /userMeta/{userId} {', start));
    // Signed in FIRST (review A8: an unauthenticated request costs no read of the parent), then the parent's owner and kind.
    expect(block).toMatch(/function isIdeaBookOwner\(bookId\) \{\s*return request\.auth != null\s*&& ownsIdeaBook\(get\(\/databases\/\$\(database\)\/documents\/mandates\/\$\(bookId\)\)\.data\);\s*\}/);
    expect(block).toMatch(/function ownsIdeaBook\(book\) \{\s*return request\.auth\.uid == book\.userId\s*&& book\.get\('kind', null\) == 'idea_book';\s*\}/);
    for (const m of ['match /ideas/{ideaId} {', 'match /rows/{rowId} {', 'match /evidence/{packetId} {', 'match /epochs/{epochId} {', 'match /windows/{rowId} {']) {
      const at = block.indexOf(m);
      expect(at, m).toBeGreaterThan(-1);
      const body = block.slice(at, at + 260);
      expect(body, m).toMatch(/allow read: if isIdeaBookOwner\(mandateId\);\s*allow write: if false;/);
    }
    expect(block.match(/isIdeaBookOwner\(mandateId\)/g)).toHaveLength(5);
    expect(block).not.toMatch(/match \/spendOps|match \/nominations/); // the spend records stay unmatched; nominations are T2's
  });
});
