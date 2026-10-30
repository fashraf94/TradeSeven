// test/rules/setupEvidenceDenials.rules.mjs
//
// ID-1 Build 1 (shape note V1.4 §3) — Firestore security-rules acceptance for
// setupEvidence/{id}, the immutable dated snapshots, and setupEvidenceClaims/{id},
// their lease, observation and attempt count. The Admin SDK writes both.
//
// THE CLAIM UNDER TEST is that both collections are SERVER-ONLY (the
// hypothesisReviewQueue precedent): no client verb for an authenticated user, a
// privileged-claims context or an unauthenticated client. READ (a get and a
// collection query) and WRITE (create / update / merge / delete) are each denied to
// all three. POSITIVE CONTROL in the same run — a user reads their own watchlist —
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
const USER_UID = 'sev-user-1';
const PRIVILEGED_UID = 'sev-admin-2';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };
const ID = '2026-10-29__NVDA__tf-setup-v1.26f3f411b566.tf-setup-v1~sem-1';
const SNAPSHOT = `setupEvidence/${ID}`;
const CLAIM = `setupEvidenceClaims/${ID}`;
const LIST = 'watchlists/wl-sev-1';

const snapshotDoc = () => ({ key: { session: '2026-10-29', symbol: 'NVDA' }, status: 'ok', capturedAt: '2026-10-29T21:00:00.000Z' });
const claimDoc = () => ({ lease: null, observation: null, attempts: 1, lastAttemptAt: '2026-10-29T21:00:00.000Z' });

let testEnv;
const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
const asUser = () => testEnv.authenticatedContext(USER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const EVERYONE = [
  ['an authenticated user', asUser],
  ['a privileged-claims context', asPrivileged],
  ['an unauthenticated client', asAnon],
];

beforeAll(async () => {
  console.log(`[setupEvidenceDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(LIST, { userId: USER_UID, status: 'committed' });
  await seed(SNAPSHOT, snapshotDoc());
  await seed(CLAIM, claimDoc());
});

describe('the suite can tell a grant from a denial (positive control)', () => {
  it('a user reads their own list', async () => {
    await assertSucceeds(getDoc(doc(asUser(), LIST)));
  });
});

for (const [path, coll, make] of [[SNAPSHOT, 'setupEvidence', snapshotDoc], [CLAIM, 'setupEvidenceClaims', claimDoc]]) {
  describe(`${coll}/{id} — server-only: no client verb for anyone`, () => {
    for (const [who, ctx] of EVERYONE) {
      it(`${who} cannot get it or query the collection`, async () => {
        await assertFails(getDoc(doc(ctx(), path)));
        await assertFails(getDocs(collection(ctx(), coll)));
      });
      it(`${who} cannot create, update, merge or delete`, async () => {
        await assertFails(setDoc(doc(ctx(), `${coll}/new-id`), make()));
        await assertFails(updateDoc(doc(ctx(), path), { status: 'refused' }));
        await assertFails(setDoc(doc(ctx(), path), { status: 'refused' }, { merge: true }));
        await assertFails(deleteDoc(doc(ctx(), path)));
      });
    }
  });
}

describe('the posture is written down', () => {
  it('ONE top-level block each, `allow read, write: if false;`', () => {
    expect(ruleBlocks(RULES_TEXT, /\/setupEvidence\/\{[^}/]+\}/)).toEqual([['allow read, write: if false;']]);
    expect(ruleBlocks(RULES_TEXT, /\/setupEvidenceClaims\/\{[^}/]+\}/)).toEqual([['allow read, write: if false;']]);
  });
});
