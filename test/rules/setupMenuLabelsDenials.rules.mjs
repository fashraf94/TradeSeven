// test/rules/setupMenuLabelsDenials.rules.mjs
//
// Measured Trend Evidence Slice 2 (spec V2 §5.4, §6.5; row A2.1) — Firestore security-rules acceptance
// for setupMenuLabelState/{name}, the acquisition tenant's state, and for a tick record that carries
// the `setupMenu` block (agentBattles/{battleId}/ticks/{tickId}). The Admin SDK writes both.
//
// THE CLAIM UNDER TEST is that both are SERVER-ONLY: no client verb for the battle's own owner, another
// authenticated user, a privileged-claims context or an unauthenticated client. POSITIVE CONTROL in the
// same run — the owner reads their own battle — so a misloaded or over-broad ruleset cannot pass by
// failing everything, and the parent's owner read is shown NOT to reach the tick record.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules

import { createHash } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, collectionGroup, query, where } from 'firebase/firestore';
import { RULES_TEXT } from './callRecordsRulesSuite.mjs';

const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');
const OWNER_UID = 'sml-owner-1';
const OTHER_UID = 'sml-user-2';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };
const BATTLE = 'agentBattles/sml-battle-1';
const TICK = `${BATTLE}/ticks/sml-battle-1:7`;
const STATE = 'setupMenuLabelState/main';

const tickDoc = () => ({
  schemaVersion: 1, tickId: 'sml-battle-1:7', battleId: 'sml-battle-1', tickSeq: 7, ownerId: OWNER_UID, exitReason: 'no_trigger',
  setupMenu: {
    blockStatus: 'ok', errorCode: null, session: '2026-09-08', setupVersion: 'tf-setup-v1', thresholdsHash: '26f3f411b566', semanticsId: 'tf-setup-v1/sem-1',
    selector: 'carried', rebuilt: false, frozenAt: '2026-09-09T15:00:00.000Z', readsStartedAt: '2026-09-09T15:00:00.010Z', observedAt: '2026-09-09T15:00:01.000Z',
    stateRead: true, presentedCount: 1, uniqueCount: 1, omittedCount: 0, unrecordableCount: 0, truncatedCount: 0, readsIssued: 1, readsShared: 0,
    counts: { labelled: 1, refused: 0, absent: 0, excluded: 0, symbolForm: 0, stale: 0, failed: 0, unsettled: 0 },
    candidates: [{ symbol: 'CRM', source: 'hotbench', inBenchAtFreeze: true, heldAtFreeze: false, status: 'labelled', verdict: 'valid', reason: null, pattern: 'breakout', regime: 'uptrend' }],
  },
});
const stateDoc = () => ({ schemaVersion: 1, cursors: { owners: null }, governedSessions: { previous: '2026-09-04', current: '2026-09-08' }, attempts: {}, updatedAt: null });

let testEnv;
const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext('sml-admin-3', PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const EVERYONE = [
  ['the battle\'s own owner', asOwner],
  ['another authenticated user', asOther],
  ['a privileged-claims context', asPrivileged],
  ['an unauthenticated client', asAnon],
];

beforeAll(async () => {
  console.log(`[setupMenuLabelsDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(TICK, tickDoc());
  await seed(STATE, stateDoc());
});

describe('the suite can tell a grant from a denial (positive control)', () => {
  it('the owner reads their own battle — the parent rule grants it', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), BATTLE)));
  });
});

describe('a tick record carrying the setupMenu block — server-only; the parent\'s owner read does not reach it', () => {
  for (const [who, ctx] of EVERYONE) {
    it(`${who} cannot get it, list the battle's ticks, or query ticks across battles`, async () => {
      await assertFails(getDoc(doc(ctx(), TICK)));
      await assertFails(getDocs(collection(ctx(), `${BATTLE}/ticks`)));
      await assertFails(getDocs(query(collectionGroup(ctx(), 'ticks'), where('ownerId', '==', OWNER_UID))));
    });
    it(`${who} cannot write, merge into or delete it`, async () => {
      await assertFails(setDoc(doc(ctx(), `${BATTLE}/ticks/sml-battle-1:8`), tickDoc()));
      await assertFails(updateDoc(doc(ctx(), TICK), { 'setupMenu.blockStatus': 'error' }));
      await assertFails(setDoc(doc(ctx(), TICK), { setupMenu: null }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), TICK)));
    });
  }
});

describe('setupMenuLabelState/{name} — server-only', () => {
  for (const [who, ctx] of EVERYONE) {
    it(`${who} cannot get it or query the collection`, async () => {
      await assertFails(getDoc(doc(ctx(), STATE)));
      await assertFails(getDocs(collection(ctx(), 'setupMenuLabelState')));
    });
    it(`${who} cannot create, update, merge or delete it`, async () => {
      await assertFails(setDoc(doc(ctx(), 'setupMenuLabelState/other'), stateDoc()));
      await assertFails(updateDoc(doc(ctx(), STATE), { attempts: {} }));
      await assertFails(setDoc(doc(ctx(), STATE), { governedSessions: null }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), STATE)));
    });
  }
});
