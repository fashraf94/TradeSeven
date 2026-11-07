// test/rules/activationEvidenceDenials.rules.mjs
//
// ID-1 Build 2 (shape note V1.7 §4, §4.4; ruling Q-ID1-7) — Firestore
// security-rules acceptance for agentBattles/{battleId}/activations/{activationId},
// the activation pointers, and activationObserverState/{name}, the observer's
// state. The Admin SDK writes both.
//
// THE CLAIM UNDER TEST is that both are SERVER-ONLY: no client verb for an
// authenticated user, the battle's own owner, a privileged-claims context or an
// unauthenticated client. READ (a get and a collection query) and WRITE (create /
// update / merge / delete) are each denied to all. POSITIVE CONTROL in the same
// run — the owner reads their own battle — so a misloaded or over-broad ruleset
// cannot pass by failing everything, and the parent's owner read is shown NOT to
// reach the subcollection.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules

import { createHash } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, collectionGroup, query, where } from 'firebase/firestore';
import { RULES_TEXT } from './callRecordsRulesSuite.mjs';

const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');
const OWNER_UID = 'aed-owner-1';
const OTHER_UID = 'aed-user-2';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };
const BATTLE = 'agentBattles/aed-battle-1';
const POINTER = `${BATTLE}/activations/pos_7Hq2LmN4`;
const STATE = 'activationObserverState/main';

const pointerDoc = () => ({ schemaVersion: 1, activationId: 'pos_7Hq2LmN4', kind: 'swap_in', battleId: 'aed-battle-1', symbol: 'NVDA', entry: null, missing: { reason: 'snapshot_unavailable', detail: 'missing_bar' } });
const stateDoc = () => ({ schemaVersion: 1, cursors: { dueBattles: null, ordinaryBattles: null, dueKeys: null, ordinaryKeys: null }, battles: {}, outstandingKeys: [], updatedAt: null });

let testEnv;
const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext('aed-admin-3', PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const EVERYONE = [
  ['the battle\'s own owner', asOwner],
  ['another authenticated user', asOther],
  ['a privileged-claims context', asPrivileged],
  ['an unauthenticated client', asAnon],
];

beforeAll(async () => {
  console.log(`[activationEvidenceDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(BATTLE, { ownerId: OWNER_UID, status: 'active' });
  await seed(POINTER, pointerDoc());
  await seed(STATE, stateDoc());
});

describe('the suite can tell a grant from a denial (positive control)', () => {
  it('the owner reads their own battle — the parent rule grants it', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), BATTLE)));
  });
});

describe('agentBattles/{battleId}/activations/{activationId} — server-only; the parent\'s owner read does not reach it', () => {
  for (const [who, ctx] of EVERYONE) {
    it(`${who} cannot get a pointer, list the battle's pointers, or query them across battles`, async () => {
      await assertFails(getDoc(doc(ctx(), POINTER)));
      await assertFails(getDocs(collection(ctx(), `${BATTLE}/activations`)));
      await assertFails(getDocs(query(collectionGroup(ctx(), 'activations'), where('battleId', '==', 'aed-battle-1'))));
    });
    it(`${who} cannot create, update, merge or delete a pointer`, async () => {
      await assertFails(setDoc(doc(ctx(), `${BATTLE}/activations/new-id`), pointerDoc()));
      await assertFails(updateDoc(doc(ctx(), POINTER), { entry: { forged: true } }));
      await assertFails(setDoc(doc(ctx(), POINTER), { missing: null }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), POINTER)));
    });
  }
});

describe('activationObserverState/{name} — server-only', () => {
  for (const [who, ctx] of EVERYONE) {
    it(`${who} cannot get it or query the collection`, async () => {
      await assertFails(getDoc(doc(ctx(), STATE)));
      await assertFails(getDocs(collection(ctx(), 'activationObserverState')));
    });
    it(`${who} cannot create, update, merge or delete it`, async () => {
      await assertFails(setDoc(doc(ctx(), 'activationObserverState/other'), stateDoc()));
      await assertFails(updateDoc(doc(ctx(), STATE), { cursors: {} }));
      await assertFails(setDoc(doc(ctx(), STATE), { battles: {} }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), STATE)));
    });
  }
});
