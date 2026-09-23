// test/rules/agentEvalRunsDenials.rules.mjs
//
// Eval-cron instrumentation (docs/audits/20260923_BUILD_EVAL_DEFERRED_BEAT.md) —
// Firestore security-rules acceptance for agentEvalRuns/{runId}, the per-run
// measurement document api/cron/agent-evaluate.js writes through the Admin SDK.
//
// THE CLAIM UNDER TEST is that the collection is SERVER-ONLY: no client verb for
//
//   · the OWNER of a battle the run lists in `deferredBattleIds` — owning a
//     battle grants nothing over the run that deferred it;
//   · another authenticated user;
//   · a privileged-claims context (the strongest identity the app mints; the
//     Admin SDK bypasses rules and is out of scope for an emulator suite);
//   · an unauthenticated client.
//
// READ (a get and a collection query) and WRITE (create / update / merge /
// delete) are each denied to all four. POSITIVE CONTROLS in the same run — the
// owner reads their own battle and still performs its execution-control update
// — so a misloaded or over-broad ruleset cannot pass this suite by failing
// everything.
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
// The deployed-ruleset knob every sibling honors (wireDenials.rules.mjs).
const RULES_PATH = process.env.COMPOSITION_RULES_TEXT_PATH
  ? resolve(process.env.COMPOSITION_RULES_TEXT_PATH)
  : resolve(__dirname, '../../firestore.rules');
const RULES_TEXT = readFileSync(RULES_PATH, 'utf8');
const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');

const OWNER_UID = 'evalruns-owner-1';
const OTHER_UID = 'evalruns-intruder-2';
const PRIVILEGED_UID = 'evalruns-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const BATTLE_ID = 'battle-er-1';
const BATTLE = `agentBattles/${BATTLE_ID}`;
const RUN_ID = '2026-09-23T15:00:00.123Z';
const RUN = `agentEvalRuns/${RUN_ID}`;

const battle = () => ({ ownerId: OWNER_UID, agentId: 'agent-1', status: 'active', gameMode: 'baggerbomb_agent' });
// The document's own shape, as the cron composes it — and it names the
// owner's battle, which is exactly the case the owner row below is about.
const runRecord = () => ({
  startedAt: RUN_ID, endedAt: '2026-09-23T15:04:55.000Z', wallMs: 294877, budgetMs: 290000,
  battlesTotal: 3, evaluated: 2, lockSkipped: 0, deferred: 1,
  deferredBattleIds: [BATTLE_ID], deferredTruncated: 0,
  triggered: 2, modelCalls: 2, budgetSkipped: 0,
});

let testEnv;

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
}
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const EVERYONE = [
  ['the owner of a listed battle', asOwner],
  ['another user', asOther],
  ['a privileged-claims context', asPrivileged],
  ['an unauthenticated client', asAnon],
];

beforeAll(async () => {
  console.log(`[agentEvalRunsDenials] loaded rules text: ${RULES_PATH}`);
  console.log(`[agentEvalRunsDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(RUN, runRecord());
});

describe('the suite can tell a grant from a denial (positive controls)', () => {
  it('the owner reads their own battle', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), BATTLE)));
  });
  it('the owner\'s execution-control update on that battle still works', async () => {
    await assertSucceeds(updateDoc(doc(asOwner(), BATTLE), { executionMode: 'autopilot' }));
  });
});

describe('agentEvalRuns/{runId} — server-only: no client verb for anyone', () => {
  for (const [who, ctx] of EVERYONE) {
    it(`${who} cannot READ a run document, by get or by query`, async () => {
      await assertFails(getDoc(doc(ctx(), RUN)));
      await assertFails(getDocs(collection(ctx(), 'agentEvalRuns')));
    });
    it(`${who} cannot CREATE, UPDATE, MERGE or DELETE a run document`, async () => {
      await assertFails(setDoc(doc(ctx(), 'agentEvalRuns/2026-09-23T15:15:00.000Z'), runRecord()));
      await assertFails(updateDoc(doc(ctx(), RUN), { deferred: 0 }));
      await assertFails(setDoc(doc(ctx(), RUN), { deferred: 0 }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), RUN)));
    });
  }
});

describe('the posture is written down, not only inherited', () => {
  it('the rules text carries an explicit `if false` block for the collection, and the root default-deny', () => {
    expect(RULES_TEXT).toMatch(/match \/agentEvalRuns\/\{runId\} \{\s*allow read, write: if false;/);
    expect(RULES_TEXT).toMatch(/match \/\{document=\*\*\} \{\s*\n\s*allow read, write: if false;/);
  });
});
