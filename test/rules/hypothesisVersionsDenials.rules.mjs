// test/rules/hypothesisVersionsDenials.rules.mjs
//
// Pilot P1a (pilot spec V1.4 §2.1; founder decision D1) — Firestore
// security-rules acceptance for watchlists/{watchlistId}/hypothesisVersions/{versionId}
// and its collection-group read. The callRecordsRulesSuite.mjs pattern,
// with the owner resolved through the parent LIST's `userId` (watchlists key
// on userId; battles on ownerId).
//
// THE CLAIMS:
//   · the owner reads a version AND lists the list's versions (positive
//     controls — a misloaded or over-broad ruleset cannot pass by failing
//     everything);
//   · another authenticated user, a privileged-claims context and an
//     unauthenticated client are denied both;
//   · a version under a MISSING parent list is unreadable — even by the uid it
//     names (fails closed; the collection-group block grants `list` only, so
//     it cannot widen a direct get);
//   · nobody — the owner included — can create, update, merge or delete;
//   · the collection-group query admits the owner's query constrained to
//     their own userId and denies anyone else's or an unconstrained one;
//   · the rules text carries exactly these blocks.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { createHash } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, collectionGroup, getDocs, query, where, orderBy,
} from 'firebase/firestore';
import { RULES_TEXT, ruleBlocks } from './callRecordsRulesSuite.mjs';

const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');
const OWNER_UID = 'hyp-owner-1';
const OTHER_UID = 'hyp-intruder-2';
const PRIVILEGED_UID = 'hyp-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const LIST = 'watchlists/wl-hyp-1';
const OTHER_LIST = 'watchlists/wl-hyp-2';
const ORPHAN_LIST = 'watchlists/wl-never-written';
const VERSION = `${LIST}/hypothesisVersions/v1`;
const OTHER_VERSION = `${OTHER_LIST}/hypothesisVersions/v1`;
const ORPHAN_VERSION = `${ORPHAN_LIST}/hypothesisVersions/v1`;

const list = (userId) => ({ userId, status: 'committed', thesis: 't', tickers: [], currentHypothesisVersion: 1, hypothesisVersionCount: 1 });
// The version as buildVersionDoc writes it (model.js).
const version = (watchlistId, userId) => ({
  version: 1, watchlistId, userId, opId: 'save_s1', opFingerprint: 'f'.repeat(64), createdAt: '2026-10-07T14:00:00.000Z',
  statement: 'AI capex keeps compounding', horizonEnum: 'swing', horizonSource: 'parse', activation: [], invalidation: [],
  evidenceRefs: [], publishedAt: null, origin: 'signaldrop', contentHash: 'c'.repeat(64),
  status: 'researched', stateChangedAt: '2026-10-07T14:00:00.000Z', stateSource: 'research', stateReason: 'dialogue_completed',
  missingEvidence: null, successorVersion: null, firstDeployedAt: null, lastDeployedAt: null, lastDeployedBattleId: null, reviewDueAt: null,
});

let testEnv;
const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const EVERYONE = [['the owner', asOwner], ['another user', asOther], ['a privileged-claims context', asPrivileged], ['an unauthenticated client', asAnon]];

beforeAll(async () => {
  console.log(`[hypothesisVersionsDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(LIST, list(OWNER_UID));
  await seed(VERSION, version('wl-hyp-1', OWNER_UID));
  await seed(OTHER_LIST, list(OTHER_UID));
  await seed(OTHER_VERSION, version('wl-hyp-2', OTHER_UID));
  // A version whose parent list does not exist — it still names the owner.
  await seed(ORPHAN_VERSION, version('wl-never-written', OWNER_UID));
});

describe('watchlists/{watchlistId}/hypothesisVersions/{versionId} — read mirrors the parent list\'s owner', () => {
  it('positive control: the owner reads the parent list, a version, and the list\'s versions newest first', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), LIST)));
    await assertSucceeds(getDoc(doc(asOwner(), VERSION)));
    await assertSucceeds(getDocs(query(collection(asOwner(), `${LIST}/hypothesisVersions`), orderBy('version', 'desc'))));
  });
  it('another authenticated user is denied the version and the list\'s versions', async () => {
    await assertFails(getDoc(doc(asOther(), VERSION)));
    await assertFails(getDocs(collection(asOther(), `${LIST}/hypothesisVersions`)));
  });
  it('a privileged-claims context is denied — the rule is the parent\'s userId, never a claim', async () => {
    await assertFails(getDoc(doc(asPrivileged(), VERSION)));
    await assertFails(getDocs(collection(asPrivileged(), `${LIST}/hypothesisVersions`)));
  });
  it('an unauthenticated client is denied', async () => {
    await assertFails(getDoc(doc(asAnon(), VERSION)));
    await assertFails(getDocs(collection(asAnon(), `${LIST}/hypothesisVersions`)));
  });
  it('a version whose parent list is missing is unreadable — even by the uid it names (fails closed)', async () => {
    await assertFails(getDoc(doc(asOwner(), ORPHAN_VERSION)));
    await assertFails(getDoc(doc(asOther(), ORPHAN_VERSION)));
    await assertFails(getDocs(collection(asOwner(), `${ORPHAN_LIST}/hypothesisVersions`)));
  });
});

describe('hypothesisVersions — client writes denied', () => {
  for (const [who, ctx] of EVERYONE) {
    it(`${who} cannot create, update, merge or delete`, async () => {
      await assertFails(setDoc(doc(ctx(), `${LIST}/hypothesisVersions/v2`), { ...version('wl-hyp-1', OWNER_UID), version: 2 }));
      await assertFails(updateDoc(doc(ctx(), VERSION), { status: 'ready' }));
      await assertFails(updateDoc(doc(ctx(), VERSION), { statement: 'rewritten' }));
      await assertFails(setDoc(doc(ctx(), VERSION), { status: 'activated' }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), VERSION)));
    });
  }
  it('the parent list itself stays server-written (the sibling rule is untouched)', async () => {
    await assertFails(updateDoc(doc(asOwner(), LIST), { currentHypothesisVersion: 9 }));
  });
});

describe('the collection-group read (the cross-list view)', () => {
  it('positive control: the owner\'s query constrained to their own userId succeeds — status filter and stateChangedAt order included', async () => {
    await assertSucceeds(getDocs(query(collectionGroup(asOwner(), 'hypothesisVersions'), where('userId', '==', OWNER_UID))));
    await assertSucceeds(getDocs(query(
      collectionGroup(asOwner(), 'hypothesisVersions'),
      where('userId', '==', OWNER_UID), where('status', 'in', ['researched', 'ready']), orderBy('stateChangedAt', 'desc'),
    )));
  });
  it('a query for ANOTHER user\'s versions is denied', async () => {
    await assertFails(getDocs(query(collectionGroup(asOwner(), 'hypothesisVersions'), where('userId', '==', OTHER_UID))));
  });
  it('an unconstrained collection-group query is denied (the rule is not a filter)', async () => {
    await assertFails(getDocs(collectionGroup(asOwner(), 'hypothesisVersions')));
  });
  it('a privileged-claims context and an unauthenticated client are denied', async () => {
    await assertFails(getDocs(query(collectionGroup(asPrivileged(), 'hypothesisVersions'), where('userId', '==', OWNER_UID))));
    await assertFails(getDocs(query(collectionGroup(asAnon(), 'hypothesisVersions'), where('userId', '==', OWNER_UID))));
  });
});

describe('the posture is written down', () => {
  it('ONE nested block: owner read through the parent list, `allow write: if false;`', () => {
    expect(ruleBlocks(RULES_TEXT, /\/hypothesisVersions\/\{versionId\}/)).toEqual([[
      'allow read: if request.auth != null',
      '&& get(/databases/$(database)/documents/watchlists/$(watchlistId)).data.userId == request.auth.uid;',
      'allow write: if false;',
    ]]);
  });
  it('ONE collection-group block: `list` on the version\'s own userId, and nothing else', () => {
    expect(ruleBlocks(RULES_TEXT, /\/\{path=\*\*\}\/hypothesisVersions\/\{versionId\}/)).toEqual([[
      'allow list: if request.auth != null',
      '&& resource.data.userId == request.auth.uid;',
    ]]);
  });
});
