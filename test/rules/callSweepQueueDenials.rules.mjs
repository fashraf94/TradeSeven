// test/rules/callSweepQueueDenials.rules.mjs
//
// Cockpit Build 0 (docs/design/COCKPIT_SPEC_V1_3.md §3.10; contract
// docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md §9) — Firestore security-rules
// acceptance for callSweepQueue/{battleId}, the sweep queue the publication
// transaction arms through the Admin SDK.
//
// THE CLAIM UNDER TEST is that the collection is SERVER-ONLY (the agentEvalRuns
// precedent): no client verb for the OWNER of the battle a queue document is
// keyed by, another authenticated user, a privileged-claims context, or an
// unauthenticated client. READ (a get and a collection query) and WRITE
// (create / update / merge / delete) are each denied to all four. POSITIVE
// CONTROLS in the same run — the owner reads their own battle and still
// performs its execution-control update — so a misloaded or over-broad ruleset
// cannot pass this suite by failing everything.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { createHash } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { RULES_TEXT, ruleBlocks } from './callRecordsRulesSuite.mjs';

const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');
const OWNER_UID = 'queue-owner-1';
const OTHER_UID = 'queue-intruder-2';
const PRIVILEGED_UID = 'queue-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const BATTLE_ID = 'battle-sq-1';
const BATTLE = `agentBattles/${BATTLE_ID}`;
const QUEUE = `callSweepQueue/${BATTLE_ID}`;

const battle = () => ({ ownerId: OWNER_UID, agentId: 'agent-1', status: 'active', gameMode: 'baggerbomb_agent' });
// The document's own shape, as publish.js arms it — keyed by the owner's battle.
const queueDoc = () => ({ battleId: BATTLE_ID, nextExpiresAt: 1789675200000, updatedAt: 1789664000000 });

let testEnv;
const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const EVERYONE = [
  ['the owner of the keyed battle', asOwner],
  ['another user', asOther],
  ['a privileged-claims context', asPrivileged],
  ['an unauthenticated client', asAnon],
];

beforeAll(async () => {
  console.log(`[callSweepQueueDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(BATTLE, battle());
  await seed(QUEUE, queueDoc());
});

describe('the suite can tell a grant from a denial (positive controls)', () => {
  it('the owner reads their own battle', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), BATTLE)));
  });
  it('the owner\'s execution-control update on that battle still works', async () => {
    await assertSucceeds(updateDoc(doc(asOwner(), BATTLE), { executionMode: 'autopilot' }));
  });
});

describe('callSweepQueue/{battleId} — server-only: no client verb for anyone', () => {
  for (const [who, ctx] of EVERYONE) {
    it(`${who} cannot READ a queue document, by get or by query`, async () => {
      await assertFails(getDoc(doc(ctx(), QUEUE)));
      await assertFails(getDocs(collection(ctx(), 'callSweepQueue')));
    });
    it(`${who} cannot CREATE, UPDATE, MERGE or DELETE a queue document`, async () => {
      await assertFails(setDoc(doc(ctx(), 'callSweepQueue/battle-sq-2'), queueDoc()));
      await assertFails(updateDoc(doc(ctx(), QUEUE), { nextExpiresAt: 1 }));
      await assertFails(setDoc(doc(ctx(), QUEUE), { nextExpiresAt: 1 }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), QUEUE)));
    });
  }
});

describe('the posture is written down, not only inherited', () => {
  it('ONE block for the collection, saying exactly `allow read, write: if false;`', () => {
    expect(ruleBlocks(RULES_TEXT, /\/callSweepQueue\/\{[^}/]+\}/)).toEqual([['allow read, write: if false;']]);
  });
});
