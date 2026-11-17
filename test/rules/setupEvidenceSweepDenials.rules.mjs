// test/rules/setupEvidenceSweepDenials.rules.mjs
//
// The chart's evidence, PR B (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md SW-5) — Firestore security-rules
// acceptance for setupEvidenceSweepState/{session}, the daily sweep's counts and its provider-request
// counter. The Admin SDK writes it.
//
// THE CLAIM UNDER TEST is that it is SERVER-ONLY: no client verb for an authenticated player, a
// privileged-claims context or an unauthenticated client. POSITIVE CONTROL in the same run — a player
// reads the public rankings document — so a misloaded or over-broad ruleset cannot pass by failing
// everything.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules

import { createHash } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { RULES_TEXT } from './callRecordsRulesSuite.mjs';

const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');
const PLAYER_UID = 'ses-player-1';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };
const STATE = 'setupEvidenceSweepState/2026-11-16';
const CONTROL = 'indexIntelligence/stockRankings';

const stateDoc = () => ({
  schemaVersion: 1, session: '2026-11-16', providerRequests: 231, runs: 2,
  firstRunAt: '2026-11-16T22:30:00.000Z', lastRunAt: '2026-11-16T23:30:00.000Z', completedAt: '2026-11-16T23:31:40.000Z', runMs: 151_000,
  latest: { startedAt: '2026-11-16T23:30:00.000Z', names: 228, final: { measured: 226, refused: 2 }, acquired: 3, retryable: {}, pending: 0, excluded: 0, deferred: {}, failures: {}, programmingErrors: 0 },
  updatedAt: '2026-11-16T23:31:40.000Z',
});

let testEnv;
const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
const asPlayer = () => testEnv.authenticatedContext(PLAYER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext('ses-admin-3', PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const EVERYONE = [
  ['an authenticated player', asPlayer],
  ['a privileged-claims context', asPrivileged],
  ['an unauthenticated client', asAnon],
];

beforeAll(async () => {
  console.log(`[setupEvidenceSweepDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(CONTROL, { stocks: [] });
  await seed(STATE, stateDoc());
});

describe('the suite can tell a grant from a denial (positive control)', () => {
  it('a player reads the public rankings document', async () => {
    await assertSucceeds(getDoc(doc(asPlayer(), CONTROL)));
  });
});

describe('setupEvidenceSweepState/{session} — server-only', () => {
  for (const [who, ctx] of EVERYONE) {
    it(`${who} cannot get it, list the collection or query it`, async () => {
      await assertFails(getDoc(doc(ctx(), STATE)));
      await assertFails(getDocs(collection(ctx(), 'setupEvidenceSweepState')));
      await assertFails(getDocs(query(collection(ctx(), 'setupEvidenceSweepState'), where('session', '==', '2026-11-16'))));
    });
    it(`${who} cannot create, update, merge into or delete it`, async () => {
      await assertFails(setDoc(doc(ctx(), 'setupEvidenceSweepState/2026-11-17'), stateDoc()));
      await assertFails(updateDoc(doc(ctx(), STATE), { providerRequests: 0 }));
      await assertFails(setDoc(doc(ctx(), STATE), { providerRequests: 0 }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), STATE)));
    });
  }
});
