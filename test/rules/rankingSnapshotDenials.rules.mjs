// test/rules/rankingSnapshotDenials.rules.mjs
//
// Archetype Rank Interface V2 — Firestore security-rules acceptance for the
// two Phase A paths (spec §5 Phase A / P-11, §8): `rankingSnapshots/{id}` and
// the ops toggle document `ops/rankingSnapshots` deny EVERY client verb for
// unauth, ordinary auth, and a privileged-claims context — WITH POSITIVE
// CONTROLS (the wireDenials F2-4 pattern): the same run asserts the sibling
// public read (indexIntelligence/stockRankings, the doc the producer writes in
// the same batch) SUCCEEDS, so an over-broad or misloaded ruleset cannot pass
// this suite vacuously by failing everything.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Same knob as the wire/composition siblings: point COMPOSITION_RULES_TEXT_PATH
// at fetched deployed rules text to prove the LIVE ruleset; default = repo text.
const RULES_PATH = process.env.COMPOSITION_RULES_TEXT_PATH
  ? resolve(process.env.COMPOSITION_RULES_TEXT_PATH)
  : resolve(__dirname, '../../firestore.rules');
const RULES_TEXT = readFileSync(RULES_PATH, 'utf8');
const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');

const USER_UID = 'rank-user-1';
const PRIVILEGED_UID = 'rank-admin-1';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const SNAPSHOT_DOC = 'rankingSnapshots/2026-09-02_premarket';
const OPS_DOC = 'ops/rankingSnapshots';
const DENIED_PATHS = [SNAPSHOT_DOC, OPS_DOC];

// Positive control: the public rankings doc the producer writes in the same run.
const PUBLIC_RANKINGS_DOC = 'indexIntelligence/stockRankings';

let testEnv;

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

const asUser = () => testEnv.authenticatedContext(USER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

beforeAll(async () => {
  console.log(`[rankingSnapshotDenials] loaded rules text: ${RULES_PATH}`);
  console.log(`[rankingSnapshotDenials] rules text sha256: ${RULES_SHA256}`);
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [emuHost, emuPort] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-tradeseven-rules',
    firestore: { rules: RULES_TEXT, host: emuHost, port: Number(emuPort) },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(SNAPSHOT_DOC, { etDate: '2026-09-02', runLabel: 'premarket', stocks: {} });
  await seed(OPS_DOC, { enabled: true, retainDays: 30 });
  await seed(PUBLIC_RANKINGS_DOC, { stocks: [], axes_formula_version: 1 });
});

describe('POSITIVE CONTROL — the ruleset is loaded and not over-broad', () => {
  it('the public stockRankings read succeeds unauthenticated', async () => {
    await assertSucceeds(getDoc(doc(asAnon(), PUBLIC_RANKINGS_DOC)));
  });
});

describe('rankingSnapshots + ops/rankingSnapshots — every verb denied for every client identity', () => {
  const CONTEXTS = [
    ['unauthenticated', asAnon],
    ['ordinary auth', asUser],
    ['privileged claims', asPrivileged],
  ];

  for (const [label, ctx] of CONTEXTS) {
    for (const path of DENIED_PATHS) {
      it(`${label}: read/create/update/delete all fail on ${path}`, async () => {
        const fs = ctx();
        await assertFails(getDoc(doc(fs, path)));
        await assertFails(setDoc(doc(fs, `${path.split('/')[0]}/new-doc`), { x: 1 }));
        await assertFails(updateDoc(doc(fs, path), { enabled: false }));
        await assertFails(deleteDoc(doc(fs, path)));
      });
    }
  }

  it('a client cannot flip the ops toggle by creating the doc when it is absent', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), OPS_DOC));
    });
    await assertFails(setDoc(doc(asPrivileged(), OPS_DOC), { enabled: true, retainDays: 1 }));
    await assertFails(setDoc(doc(asUser(), OPS_DOC), { enabled: true }));
  });
});
