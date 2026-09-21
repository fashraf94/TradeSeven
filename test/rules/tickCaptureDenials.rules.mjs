// test/rules/tickCaptureDenials.rules.mjs
//
// Tick capture — Firestore security-rules acceptance for the two capture
// subcollections (spec docs/specs/CAPTURE_BUILD_SPEC_V1_3.md §3: "Default-deny
// Firestore rules stay; Admin-only access. Client read access is decided with
// the Film Room readers").
//
// THE CLAIM UNDER TEST is that NO CLIENT ACCESS EXISTS IN THIS BUILD, and that
// it holds by the ROOT DEFAULT-DENY rather than by a new match block — which is
// exactly the kind of claim that must be executed rather than asserted in prose.
// Rules on a parent document do NOT apply to its subcollections, so the battle
// owner's read of `agentBattles/{battleId}` grants nothing under it; and the
// sibling `intradayViews` match, which DOES mirror the parent's read, is the
// positive control that proves this suite can tell a grant from a denial.
//
//   · READ  is denied to the battle's OWNER, to another authenticated user, to
//     a privileged-claims context and to an unauthenticated client;
//   · WRITE (create / update / merge / delete) is denied to all four — server
//     writes go through the Admin SDK, which bypasses rules entirely;
//   · the parent battle's own read and its execution-control update still work
//     for the owner, so the denial above is not a blanket lockout.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = process.env.COMPOSITION_RULES_TEXT_PATH
  ? resolve(process.env.COMPOSITION_RULES_TEXT_PATH)
  : resolve(__dirname, '../../firestore.rules');
const RULES_TEXT = readFileSync(RULES_PATH, 'utf8');
const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');

const OWNER_UID = 'tickcapture-owner-1';
const OTHER_UID = 'tickcapture-intruder-2';
const PRIVILEGED_UID = 'tickcapture-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const BATTLE_ID = 'battle-tc-1';
const BATTLE = `agentBattles/${BATTLE_ID}`;
const TICK_ID = `${BATTLE_ID}:7`;
const TICK = `${BATTLE}/ticks/${TICK_ID}`;
const BODY = `${BATTLE}/tickBodies/${TICK_ID}`;
const VIEW = `${BATTLE}/intradayViews/eval_3`;

const battle = () => ({ ownerId: OWNER_UID, agentId: 'agent-1', status: 'active', gameMode: 'baggerbomb_agent' });
const tickRecord = () => ({
  schemaVersion: 1, tickId: TICK_ID, battleId: BATTLE_ID, tickSeq: 7,
  capturedAt: '2026-09-09T15:00:00.000Z', stageReached: 'finalized', exitReason: 'completed',
});
const tickBody = () => ({
  schemaVersion: 1, tickId: TICK_ID, battleId: BATTLE_ID, tickSeq: 7,
  capturedAt: '2026-09-09T15:00:00.000Z', expireAt: new Date('2027-01-07T15:00:00.000Z'),
  request: { body: '{"model":"m"}' }, response: { body: '{"model":"m"}' },
});
const view = () => ({ evalId: 'eval_3', battleId: BATTLE_ID, symbols: {}, shadowLines: [] });

let testEnv;

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
}
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const EVERYONE = [['the owner', asOwner], ['another user', asOther], ['a privileged-claims context', asPrivileged], ['an unauthenticated client', asAnon]];

beforeAll(async () => {
  console.log(`[tickCaptureDenials] loaded rules text: ${RULES_PATH}`);
  console.log(`[tickCaptureDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(TICK, tickRecord());
  await seed(BODY, tickBody());
  await seed(VIEW, view());
});

describe('the suite can tell a grant from a denial (positive controls)', () => {
  it('the owner reads the parent battle AND its intradayViews sibling', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), BATTLE)));
    await assertSucceeds(getDoc(doc(asOwner(), VIEW)));
  });
  it('the owner\'s execution-control update on the parent still works', async () => {
    await assertSucceeds(updateDoc(doc(asOwner(), BATTLE), { executionMode: 'autopilot' }));
  });
});

describe('agentBattles/{battleId}/ticks/{tickId} — no client access in this build', () => {
  for (const [who, ctx] of EVERYONE) {
    it(`${who} cannot READ a tick record`, async () => {
      await assertFails(getDoc(doc(ctx(), TICK)));
      await assertFails(getDocs(collection(ctx(), `${BATTLE}/ticks`)));
    });
    it(`${who} cannot CREATE, UPDATE, MERGE or DELETE a tick record`, async () => {
      await assertFails(setDoc(doc(ctx(), `${BATTLE}/ticks/${BATTLE_ID}:999`), tickRecord()));
      await assertFails(updateDoc(doc(ctx(), TICK), { exitReason: 'completed' }));
      await assertFails(setDoc(doc(ctx(), TICK), { tickSeq: 8 }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), TICK)));
    });
  }
});

describe('agentBattles/{battleId}/tickBodies/{tickId} — no client access in this build', () => {
  for (const [who, ctx] of EVERYONE) {
    it(`${who} cannot READ a body document`, async () => {
      await assertFails(getDoc(doc(ctx(), BODY)));
      await assertFails(getDocs(collection(ctx(), `${BATTLE}/tickBodies`)));
    });
    it(`${who} cannot CREATE, UPDATE, MERGE or DELETE a body document`, async () => {
      await assertFails(setDoc(doc(ctx(), `${BATTLE}/tickBodies/${BATTLE_ID}:999`), tickBody()));
      await assertFails(updateDoc(doc(ctx(), BODY), { copyError: null }));
      await assertFails(setDoc(doc(ctx(), BODY), { tickSeq: 8 }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), BODY)));
    });
  }
});

describe('the denial comes from the ROOT default-deny, not from a bespoke match', () => {
  it('the rules text adds no match block for either subcollection', () => {
    // If a later build grants a Film Room reader, this row moves WITH it —
    // and until then it keeps "no client access" a fact rather than a memory.
    expect(RULES_TEXT).not.toMatch(/match \/ticks\/\{/);
    expect(RULES_TEXT).not.toMatch(/match \/tickBodies\/\{/);
    expect(RULES_TEXT).toMatch(/match \/\{document=\*\*\} \{\s*\n\s*allow read, write: if false;/);
  });
});
