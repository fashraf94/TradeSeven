// test/rules/sharedResearchSessions.rules.mjs
//
// Shared Research B1 (spec docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md
// §6.10, K-8) — Firestore security-rules acceptance for the two new collections:
//
//   sharedResearchSessions/{sessionId}  the investigation's host session —
//     server-written only (the Shared Research route, Admin SDK), readable by its
//     owner on the session's own `userId`
//   sharedResearchQuota/{uid}           the daily counts (and `_global`, the
//     app's) — server-only: no client reads or writes them, the owner included
//
// THE CLAIMS:
//   · the owner gets their session AND lists their sessions with a query
//     constrained to their own userId (positive controls — a misloaded or
//     over-broad ruleset cannot pass by failing everything);
//   · another authenticated user, a privileged-claims context and an
//     unauthenticated client cannot get it or list it;
//   · nobody — the owner included — can create, update, merge or delete a session;
//   · nobody can read or write a quota document, the owner's own or `_global`;
//   · the rules text carries exactly these two blocks.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { createHash } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { RULES_TEXT, ruleBlocks } from './callRecordsRulesSuite.mjs';

const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');
const OWNER_UID = 'sr-owner-1';
const OTHER_UID = 'sr-intruder-2';
const PRIVILEGED_UID = 'sr-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };
const SESSION_ID = '6f1c2b0e-8a7d-4c3b-9e21-0a5d4f3e2b1c';
const SESSION = `sharedResearchSessions/${SESSION_ID}`;
const OTHER_SESSION = 'sharedResearchSessions/1d2e3f40-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const QUOTA = `sharedResearchQuota/${OWNER_UID}`;
const GLOBAL = 'sharedResearchQuota/_global';

// The session as the route writes it (api/_utils/sharedResearch/session.js openSessionOf), trimmed.
const session = (userId, over = {}) => ({
  schemaVersion: 1, sessionId: SESSION_ID, userId, requestId: 'req-1', createdAt: '2026-11-12T14:00:00.000Z', updatedAt: '2026-11-12T14:00:00.000Z',
  status: 'open', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, observation: null, direction: null, topic: null, names: ['NVDA'] },
  itemKey: 'fantasyTimesStories/story-1', frame: null, lastError: null, exchanges: [], stepsUsed: 0, stepBudget: 10, lastStep: null,
  researchWorkId: `sr_${SESSION_ID}`, retrieval: { calls: 0, costDollars: 0, elapsedMs: 0 }, method: { id: 'baseline', version: 'v0' },
  attribution: { agentId: 'agent-1', archetypeCodeId: 'contrarian', baggerbombArchetypeCodeId: 'contrarian', identityVersion: 2, at: '2026-11-12T14:00:00.000Z' },
  adoption: null, ...over,
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
  console.log(`[sharedResearchSessions] rules text sha256: ${RULES_SHA256}`);
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
  await seed(SESSION, session(OWNER_UID));
  await seed(OTHER_SESSION, session(OTHER_UID, { sessionId: '1d2e3f40-5a6b-4c7d-8e9f-0a1b2c3d4e5f' }));
  await seed(QUOTA, { etDate: '2026-11-12', investigationsOpened: 1, framingsRun: 2, updatedAt: '2026-11-12T14:00:00.000Z' });
  await seed(GLOBAL, { etDate: '2026-11-12', steps: 7, framings: 3, updatedAt: '2026-11-12T14:00:00.000Z' });
});

describe('the owner reads their session (positive controls)', () => {
  it('gets the session', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), SESSION)));
  });
  it('lists their sessions with a query constrained to their own userId', async () => {
    const own = await assertSucceeds(getDocs(query(collection(asOwner(), 'sharedResearchSessions'), where('userId', '==', OWNER_UID))));
    expect(own.docs.map((d) => d.id)).toEqual([SESSION_ID]);
  });
});

describe('no one else reads it', () => {
  for (const [who, ctx] of NOT_THE_OWNER) {
    it(`${who} cannot get it, list the owner's sessions or list the collection unconstrained`, async () => {
      await assertFails(getDoc(doc(ctx(), SESSION)));
      await assertFails(getDocs(query(collection(ctx(), 'sharedResearchSessions'), where('userId', '==', OWNER_UID))));
      await assertFails(getDocs(collection(ctx(), 'sharedResearchSessions')));
    });
  }
  it("the owner cannot read another player's session, nor list unconstrained", async () => {
    await assertFails(getDoc(doc(asOwner(), OTHER_SESSION)));
    await assertFails(getDocs(collection(asOwner(), 'sharedResearchSessions')));
  });
});

describe('server-written only: no client write to a session for anyone, the owner included', () => {
  for (const [who, ctx, uid] of EVERYONE) {
    it(`${who} cannot create, update, merge or delete`, async () => {
      await assertFails(setDoc(doc(ctx(), 'sharedResearchSessions/new-session'), session(uid ?? OWNER_UID, { sessionId: 'new-session' })));
      await assertFails(updateDoc(doc(ctx(), SESSION), { status: 'completed' }));
      await assertFails(updateDoc(doc(ctx(), SESSION), { attribution: { agentId: 'forged' } }));
      await assertFails(setDoc(doc(ctx(), SESSION), { stepsUsed: 0 }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), SESSION)));
    });
  }
});

describe('the daily counts are server-only: unreadable and unwritable', () => {
  for (const [who, ctx, uid] of EVERYONE) {
    it(`${who} cannot read or write the owner's counts or the app's`, async () => {
      await assertFails(getDoc(doc(ctx(), QUOTA)));
      await assertFails(getDoc(doc(ctx(), GLOBAL)));
      await assertFails(getDocs(collection(ctx(), 'sharedResearchQuota')));
      await assertFails(setDoc(doc(ctx(), QUOTA), { etDate: '2026-11-12', investigationsOpened: 0, framingsRun: 0 }));
      await assertFails(updateDoc(doc(ctx(), GLOBAL), { steps: 0 }));
      await assertFails(deleteDoc(doc(ctx(), QUOTA)));
      if (uid) await assertFails(setDoc(doc(ctx(), `sharedResearchQuota/${uid}`), { etDate: '2026-11-12', investigationsOpened: 0 }));
    });
  }
});

describe('the posture is written down', () => {
  it('ONE sessions block: owner read on the session\'s own userId, no client create, update or delete', () => {
    expect(ruleBlocks(RULES_TEXT, /\/sharedResearchSessions\/\{sessionId\}/)).toEqual([[
      'allow read: if request.auth != null',
      '&& resource.data.userId == request.auth.uid;',
      'allow create, update, delete: if false;',
    ]]);
  });
  it('ONE quota block: no read, no write', () => {
    expect(ruleBlocks(RULES_TEXT, /\/sharedResearchQuota\/\{uid\}/)).toEqual([[
      'allow read, write: if false;',
    ]]);
  });
});
