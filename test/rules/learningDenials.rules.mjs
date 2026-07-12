// test/rules/learningDenials.rules.mjs
//
// Agent Learning System — L1 Foundation, Phase 1.
// Firestore security-rules test suite for the four learning collections.
//
// Architecture V1.3 (FROZEN), T13: learning evidence is a competitive-integrity
// surface. "A denial without a test proving it is not a denial." This suite
// proves, against the real Firestore emulator, that NO client can write ANY of
// the four collections, and that the only client-readable collection is the
// dossier — and only for its owning user.
//
// This is NOT part of the default vitest run (its filename has no `.test.`/
// `.spec.`, which the default glob requires — the vitest.eval.config.mjs
// precedent). It needs a running Firestore emulator. Run it via:
//
//     npm run test:rules
//
// which wraps this file in `firebase emulators:exec --only firestore` so the
// emulator is up and FIRESTORE_EMULATOR_HOST is set for the duration.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

const OWNER_UID = 'owner-user-1';
const OTHER_UID = 'intruder-user-2';

// Collection document paths under test.
const DOSSIER_PATH = 'learningDossiers/agent-1';
const EVIDENCE_ATOM_PATH = 'learningEvidence/agent-1/atoms/atom-1';
const RECEIPT_PATH = 'learningReceipts/battle-1/receipts/receipt-1';
const CALIBRATION_PATH = 'learningCalibration/manifest-v5';

let testEnv;

/** Seed a document bypassing rules (Admin-SDK-equivalent path). */
async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

beforeAll(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [emuHost, emuPort] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-tradeseven-rules',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: emuHost,
      port: Number(emuPort),
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  if (testEnv) await testEnv.clearFirestore();
});

// ───────────────────────────────────────────────────────────────────────────
// learningDossiers — the ONLY client-readable collection, owner-only read,
// no client write from anyone.
// ───────────────────────────────────────────────────────────────────────────
describe('learningDossiers/{agentId}', () => {
  const dossier = () => ({ userId: OWNER_UID, agentId: 'agent-1', lessons: [] });

  it('READ allowed for the owning user', async () => {
    await seed(DOSSIER_PATH, dossier());
    await assertSucceeds(getDoc(doc(asOwner(), DOSSIER_PATH)));
  });

  it('READ denied for an authenticated non-owner', async () => {
    await seed(DOSSIER_PATH, dossier());
    await assertFails(getDoc(doc(asOther(), DOSSIER_PATH)));
  });

  it('READ denied for an unauthenticated client', async () => {
    await seed(DOSSIER_PATH, dossier());
    await assertFails(getDoc(doc(asAnon(), DOSSIER_PATH)));
  });

  it('WRITE denied for the owning user (no client write, ever)', async () => {
    await assertFails(setDoc(doc(asOwner(), DOSSIER_PATH), dossier()));
  });

  it('WRITE denied for an authenticated non-owner', async () => {
    await assertFails(setDoc(doc(asOther(), DOSSIER_PATH), dossier()));
  });

  it('WRITE denied for an unauthenticated client', async () => {
    await assertFails(setDoc(doc(asAnon(), DOSSIER_PATH), dossier()));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// learningEvidence/{agentId}/atoms/{atomId} — no client read, no client write.
// ───────────────────────────────────────────────────────────────────────────
describe('learningEvidence/{agentId}/atoms/{atomId}', () => {
  const atom = () => ({ agentId: 'agent-1', kind: 'raw' });

  it('READ denied for the (would-be owner) authenticated user', async () => {
    await seed(EVIDENCE_ATOM_PATH, atom());
    await assertFails(getDoc(doc(asOwner(), EVIDENCE_ATOM_PATH)));
  });

  it('READ denied for an authenticated non-owner', async () => {
    await seed(EVIDENCE_ATOM_PATH, atom());
    await assertFails(getDoc(doc(asOther(), EVIDENCE_ATOM_PATH)));
  });

  it('READ denied for an unauthenticated client', async () => {
    await seed(EVIDENCE_ATOM_PATH, atom());
    await assertFails(getDoc(doc(asAnon(), EVIDENCE_ATOM_PATH)));
  });

  it('WRITE denied for an authenticated user', async () => {
    await assertFails(setDoc(doc(asOwner(), EVIDENCE_ATOM_PATH), atom()));
  });

  it('WRITE denied for an unauthenticated client', async () => {
    await assertFails(setDoc(doc(asAnon(), EVIDENCE_ATOM_PATH), atom()));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// learningReceipts/{battleId}/receipts/{receiptId} — no client read/write.
// ───────────────────────────────────────────────────────────────────────────
describe('learningReceipts/{battleId}/receipts/{receiptId}', () => {
  const receipt = () => ({ battleId: 'battle-1', agentId: 'agent-1', receiptSeq: 1 });

  it('READ denied for an authenticated user', async () => {
    await seed(RECEIPT_PATH, receipt());
    await assertFails(getDoc(doc(asOwner(), RECEIPT_PATH)));
  });

  it('READ denied for an unauthenticated client', async () => {
    await seed(RECEIPT_PATH, receipt());
    await assertFails(getDoc(doc(asAnon(), RECEIPT_PATH)));
  });

  it('WRITE denied for an authenticated user', async () => {
    await assertFails(setDoc(doc(asOwner(), RECEIPT_PATH), receipt()));
  });

  it('WRITE denied for an unauthenticated client', async () => {
    await assertFails(setDoc(doc(asAnon(), RECEIPT_PATH), receipt()));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// learningCalibration/{manifestVersion} — no client read/write.
// ───────────────────────────────────────────────────────────────────────────
describe('learningCalibration/{manifestVersion}', () => {
  const manifest = () => ({ manifestVersion: 'v5', frozen: true });

  it('READ denied for an authenticated user', async () => {
    await seed(CALIBRATION_PATH, manifest());
    await assertFails(getDoc(doc(asOwner(), CALIBRATION_PATH)));
  });

  it('READ denied for an unauthenticated client', async () => {
    await seed(CALIBRATION_PATH, manifest());
    await assertFails(getDoc(doc(asAnon(), CALIBRATION_PATH)));
  });

  it('WRITE denied for an authenticated user', async () => {
    await assertFails(setDoc(doc(asOwner(), CALIBRATION_PATH), manifest()));
  });

  it('WRITE denied for an unauthenticated client', async () => {
    await assertFails(setDoc(doc(asAnon(), CALIBRATION_PATH), manifest()));
  });
});
