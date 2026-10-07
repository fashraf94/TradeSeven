// test/rules/researchWorkDenials.rules.mjs
//
// Pilot P2 (pilot spec V1.4 §3) — Firestore security-rules acceptance for
// researchWork/{researchWorkId}, the research record: server-written only
// (the research hosts through the Admin SDK), readable by its owner on the
// record's own `userId`.
//
// THE CLAIMS:
//   · the owner gets their record AND lists their records with a query
//     constrained to their own userId (positive controls — a misloaded or
//     over-broad ruleset cannot pass by failing everything), including the
//     Command Center's shape (userId ==, createdAt desc);
//   · another authenticated user, a privileged-claims context and an
//     unauthenticated client cannot get it, list it under their own uid, or
//     list the collection unconstrained;
//   · nobody — the owner included — can create, update, merge or delete;
//   · the rules text carries exactly this block.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { createHash } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { RULES_TEXT, ruleBlocks } from './callRecordsRulesSuite.mjs';

const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');
const OWNER_UID = 'rw-owner-1';
const OTHER_UID = 'rw-intruder-2';
const PRIVILEGED_UID = 'rw-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const RECORD_ID = 'rs_session-rw-1';
const RECORD = `researchWork/${RECORD_ID}`;
const OTHER_RECORD = 'researchWork/ws_session-rw-2';

// The record as the hosts write it (api/_utils/researchRecords/model.js buildRecord), trimmed.
const record = (userId, over = {}) => ({
  schemaVersion: 1, researchWorkId: RECORD_ID, userId, origin: 'screener', host: { collection: 'researchSessions', id: 'session-rw-1' },
  createdAt: '2026-10-07T14:00:00.000Z', watchlistId: null, hypothesisVersion: null,
  stages: { universeSize: 6, matchedPreLimit: 4, shortlisted: 3, selectedForInvestigation: null, investigationsCompleted: null, eligible: 0 },
  symbols: [], symbolsTruncated: false, budget: { currency: 'persisted_messages', allotted: 30, used: 1 },
  telemetry: { attempts: 1, completions: 1, failures: 0, cancellations: 0, elapsedMs: 900, firstTurnAt: null, lastTurnAt: null, tokens: 'unknown' },
  state: 'open', terminalReason: null, endedAt: null, updatedAt: '2026-10-07T14:00:00.000Z', ...over,
});

let testEnv;
const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const NOT_THE_OWNER = [
  ['another user', asOther, OTHER_UID],
  ['a privileged-claims context', asPrivileged, PRIVILEGED_UID],
  ['an unauthenticated client', asAnon, null],
];
const EVERYONE = [['the owner', asOwner, OWNER_UID], ...NOT_THE_OWNER];

beforeAll(async () => {
  console.log(`[researchWorkDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(RECORD, record(OWNER_UID));
  await seed(OTHER_RECORD, record(OTHER_UID, { researchWorkId: 'ws_session-rw-2', origin: 'signaldrop' }));
});

describe('the owner reads their research (positive controls)', () => {
  it('gets the record', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), RECORD)));
  });
  it('lists their records with a query constrained to their own userId — the Command Center\'s shape included', async () => {
    const own = await assertSucceeds(getDocs(query(collection(asOwner(), 'researchWork'), where('userId', '==', OWNER_UID))));
    expect(own.docs.map((d) => d.id)).toEqual([RECORD_ID]);
    await assertSucceeds(getDocs(query(collection(asOwner(), 'researchWork'), where('userId', '==', OWNER_UID), orderBy('createdAt', 'desc'))));
  });
});

describe('no one else reads it', () => {
  for (const [who, ctx, uid] of NOT_THE_OWNER) {
    it(`${who} cannot get it`, async () => {
      await assertFails(getDoc(doc(ctx(), RECORD)));
    });
    it(`${who} cannot list the owner's records or the collection unconstrained`, async () => {
      await assertFails(getDocs(query(collection(ctx(), 'researchWork'), where('userId', '==', OWNER_UID))));
      await assertFails(getDocs(collection(ctx(), 'researchWork')));
      if (uid === null) await assertFails(getDocs(query(collection(ctx(), 'researchWork'), where('userId', '==', 'anyone'))));
    });
  }
  it('the owner cannot read another player\'s record, nor list unconstrained', async () => {
    await assertFails(getDoc(doc(asOwner(), OTHER_RECORD)));
    await assertFails(getDocs(collection(asOwner(), 'researchWork')));
  });
});

describe('server-written only: no client write for anyone, the owner included', () => {
  for (const [who, ctx, uid] of EVERYONE) {
    it(`${who} cannot create, update, merge or delete`, async () => {
      await assertFails(setDoc(doc(ctx(), 'researchWork/rs_new'), record(uid ?? OWNER_UID, { researchWorkId: 'rs_new' })));
      await assertFails(updateDoc(doc(ctx(), RECORD), { state: 'completed' }));
      await assertFails(setDoc(doc(ctx(), RECORD), { state: 'completed' }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), RECORD)));
    });
  }
});

describe('the posture is written down', () => {
  it('ONE top-level block: owner read on the record\'s own userId, `allow write: if false;`', () => {
    expect(ruleBlocks(RULES_TEXT, /\/researchWork\/\{researchWorkId\}/)).toEqual([[
      'allow read: if request.auth != null',
      '&& resource.data.userId == request.auth.uid;',
      'allow write: if false;',
    ]]);
  });
});
