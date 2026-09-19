// test/rules/intradayViewsDenials.rules.mjs
//
// Intraday Data — Build 1, contract §8.1 (G13): Firestore security-rules
// acceptance for agentBattles/{battleId}/intradayViews/{evalId}. Rules on a
// parent document do NOT apply to its subcollections, so the diagnostic view
// gets its own match, mirroring the parent's read rule explicitly:
//
//   · READ: the battle's OWNER (parent ownerId === request.auth.uid) succeeds
//     (positive control); another authenticated user, a privileged-claims
//     context and an unauthenticated client are all denied;
//   · WRITE: no client — the owner included — can create, update or delete a
//     view (server writes go through the Admin SDK, which bypasses rules);
//   · a view under a battle whose parent document is MISSING is unreadable
//     (the get() resolves null and the comparison fails closed).
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
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = process.env.COMPOSITION_RULES_TEXT_PATH
  ? resolve(process.env.COMPOSITION_RULES_TEXT_PATH)
  : resolve(__dirname, '../../firestore.rules');
const RULES_TEXT = readFileSync(RULES_PATH, 'utf8');
const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');

const OWNER_UID = 'intraday-owner-1';
const OTHER_UID = 'intraday-intruder-2';
const PRIVILEGED_UID = 'intraday-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const BATTLE = 'agentBattles/battle-iv-1';
const VIEW = `${BATTLE}/intradayViews/eval_3`;
const ORPHAN_VIEW = 'agentBattles/battle-never-written/intradayViews/eval_1';

const battle = () => ({ ownerId: OWNER_UID, agentId: 'agent-1', status: 'active', gameMode: 'baggerbomb_agent' });
const view = () => ({
  evalId: 'eval_3', battleId: 'battle-iv-1', sweepId: 'sw45', generation: 46, calcVersion: 1, policyVersion: 1,
  evaluatedAt: 1789664000000, presetId: 'balanced', presetBand: 0.5, providedToDecision: false, symbols: {}, shadowLines: [],
});

let testEnv;

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
}
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

beforeAll(async () => {
  console.log(`[intradayViewsDenials] loaded rules text: ${RULES_PATH}`);
  console.log(`[intradayViewsDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(VIEW, view());
  await seed(ORPHAN_VIEW, view());
});

describe('agentBattles/{battleId}/intradayViews/{evalId} — read mirrors the parent battle\'s read rule', () => {
  it('positive control: the owner reads the parent battle AND the view', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), BATTLE)));
    await assertSucceeds(getDoc(doc(asOwner(), VIEW)));
  });
  it('another authenticated user is denied the view (as the parent denies them)', async () => {
    await assertFails(getDoc(doc(asOther(), BATTLE)));
    await assertFails(getDoc(doc(asOther(), VIEW)));
  });
  it('a privileged-claims context is denied — the rule is ownerId, never a claim', async () => {
    await assertFails(getDoc(doc(asPrivileged(), VIEW)));
  });
  it('an unauthenticated client is denied', async () => {
    await assertFails(getDoc(doc(asAnon(), VIEW)));
  });
  it('a view whose parent battle document is missing is unreadable by anyone (fails closed)', async () => {
    await assertFails(getDoc(doc(asOwner(), ORPHAN_VIEW)));
    await assertFails(getDoc(doc(asOther(), ORPHAN_VIEW)));
  });
});

describe('agentBattles/{battleId}/intradayViews/{evalId} — client writes denied', () => {
  for (const [who, ctx] of [['the owner', asOwner], ['another user', asOther], ['a privileged-claims context', asPrivileged], ['an unauthenticated client', asAnon]]) {
    it(`${who} cannot create, update or delete a view`, async () => {
      await assertFails(setDoc(doc(ctx(), `${BATTLE}/intradayViews/eval_9`), view()));
      await assertFails(updateDoc(doc(ctx(), VIEW), { providedToDecision: true }));
      await assertFails(setDoc(doc(ctx(), VIEW), { ...view(), shadowLines: ['x'] }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), VIEW)));
    });
  }
  it('the parent battle\'s own execution-control update still works for the owner (the sibling rule is untouched)', async () => {
    await assertSucceeds(updateDoc(doc(asOwner(), BATTLE), { executionMode: 'autopilot' }));
  });
});
