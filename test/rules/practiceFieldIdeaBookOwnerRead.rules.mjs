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
//     reads them; another user does not); its controlOps — the founder's request records — are read by nobody;
//   · the server-only stores the Practice Field keeps OUTSIDE the book (its claims and founder-cap registry, its
//     coverage document) stay denied to every client;
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

const BOOK = 'mandates/pf_book_1';
const QBOOK = 'mandates/q_book_1';
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
  await seed(`${BOOK}/controlOps/p-1`, { action: 'pause' });
  await seed(QBOOK, quarterlyBook);
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
    it(`${name}: another user, a privileged-claims context and an unauthenticated client are denied the document and the list`, async () => {
      for (const ctx of [asOther, asPrivileged, asAnon]) {
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
  it('the founder\'s request records under the book (controlOps) are read by nobody — no rule matches them', async () => {
    for (const [, ctx] of EVERYONE) await assertFails(getDoc(doc(ctx(), `${BOOK}/controlOps/p-1`)));
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
    expect(block).toMatch(/function isIdeaBookOwner\(bookId\) \{\s*let book = get\(\/databases\/\$\(database\)\/documents\/mandates\/\$\(bookId\)\)\.data;\s*return request\.auth != null\s*&& request\.auth\.uid == book\.userId\s*&& book\.get\('kind', null\) == 'idea_book';\s*\}/);
    for (const m of ['match /ideas/{ideaId} {', 'match /rows/{rowId} {', 'match /evidence/{packetId} {', 'match /epochs/{epochId} {', 'match /windows/{rowId} {']) {
      const at = block.indexOf(m);
      expect(at, m).toBeGreaterThan(-1);
      const body = block.slice(at, at + 260);
      expect(body, m).toMatch(/allow read: if isIdeaBookOwner\(mandateId\);\s*allow write: if false;/);
    }
    expect(block.match(/isIdeaBookOwner\(mandateId\)/g)).toHaveLength(5);
    expect(block).not.toMatch(/match \/controlOps|match \/nominations/); // the founder's records stay unmatched; nominations are T2's
  });
});
