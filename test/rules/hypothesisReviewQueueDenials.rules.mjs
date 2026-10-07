// test/rules/hypothesisReviewQueueDenials.rules.mjs
//
// Pilot P1a (founder decision D2) — Firestore security-rules acceptance for
// hypothesisReviewQueue/{rowId}, the review pass's queue P1b arms through the
// Admin SDK, and hypothesisReviewState/{docId}, the pass's cursor.
//
// THE CLAIM UNDER TEST is that both collections are SERVER-ONLY (the
// callSweepQueue precedent): no client verb for the OWNER of the idea a row
// names, another authenticated user, a privileged-claims context, or an
// unauthenticated client. READ (a get and a collection query) and WRITE
// (create / update / merge / delete) are each denied to all four. POSITIVE
// CONTROLS in the same run — the owner reads their own list and its version —
// so a misloaded or over-broad ruleset cannot pass by failing everything.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules

import { createHash } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { RULES_TEXT, ruleBlocks } from './callRecordsRulesSuite.mjs';

const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');
const OWNER_UID = 'hrq-owner-1';
const OTHER_UID = 'hrq-intruder-2';
const PRIVILEGED_UID = 'hrq-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const LIST = 'watchlists/wl-hrq-1';
const VERSION = `${LIST}/hypothesisVersions/v1`;
const ROW = 'hypothesisReviewQueue/wl-hrq-1:1';
const CURSOR = 'hypothesisReviewState/cursor';

// The row as armReviewRow writes it (reviewPass.js) — it names the owner.
const row = () => ({ userId: OWNER_UID, watchlistId: 'wl-hrq-1', version: 1, battleId: 'battle-hrq-1', dueAtMs: 1789675200000, armedAt: 1789664000000 });

let testEnv;
const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const EVERYONE = [
  ['the owner of the idea the row names', asOwner],
  ['another user', asOther],
  ['a privileged-claims context', asPrivileged],
  ['an unauthenticated client', asAnon],
];

beforeAll(async () => {
  console.log(`[hypothesisReviewQueueDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(LIST, { userId: OWNER_UID, status: 'committed', currentHypothesisVersion: 1, hypothesisVersionCount: 1 });
  await seed(VERSION, { version: 1, watchlistId: 'wl-hrq-1', userId: OWNER_UID, status: 'activated' });
  await seed(ROW, row());
  await seed(CURSOR, { lastDocId: 'wl-hrq-1:1', updatedAt: 1789664000000 });
});

describe('the suite can tell a grant from a denial (positive controls)', () => {
  it('the owner reads their own list and its version', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), LIST)));
    await assertSucceeds(getDoc(doc(asOwner(), VERSION)));
  });
});

for (const [path, coll, label] of [[ROW, 'hypothesisReviewQueue', 'hypothesisReviewQueue/{rowId}'], [CURSOR, 'hypothesisReviewState', 'hypothesisReviewState/{docId}']]) {
  describe(`${label} — server-only: no client verb for anyone`, () => {
    for (const [who, ctx] of EVERYONE) {
      it(`${who} cannot get it or query the collection`, async () => {
        await assertFails(getDoc(doc(ctx(), path)));
        await assertFails(getDocs(collection(ctx(), coll)));
      });
      it(`${who} cannot create, update, merge or delete`, async () => {
        await assertFails(setDoc(doc(ctx(), `${coll}/new-row`), row()));
        await assertFails(updateDoc(doc(ctx(), path), { dueAtMs: 1 }));
        await assertFails(setDoc(doc(ctx(), path), { dueAtMs: 1 }, { merge: true }));
        await assertFails(deleteDoc(doc(ctx(), path)));
      });
    }
  });
}

describe('the posture is written down', () => {
  it('ONE top-level block each, `allow read, write: if false;`', () => {
    expect(ruleBlocks(RULES_TEXT, /\/hypothesisReviewQueue\/\{[^}/]+\}/)).toEqual([['allow read, write: if false;']]);
    expect(ruleBlocks(RULES_TEXT, /\/hypothesisReviewState\/\{[^}/]+\}/)).toEqual([['allow read, write: if false;']]);
  });
});
