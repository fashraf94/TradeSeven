// test/rules/eligibilityDenials.rules.mjs
//
// Backing Beta PR 0 — Firestore security-rules acceptance for the
// server-written eligibility attestation (spec V1.3 §6 / §8 / §12 PR 0,
// ruling D-z). Proves against the REAL rules engine that `eligibility/{uid}`
// is OWNER-read only and that NO client — the owner included — can create,
// update or delete it (the tournamentRanks `write: if false` pattern; the
// userMeta owner-read shape). The only writer is the Admin SDK behind
// POST /api/eligibility/attest.
//
// WITH POSITIVE CONTROLS (the wireDenials F2-4 pattern): the same run asserts
// that the owner's read SUCCEEDS and that the owner's update of their own
// users/{uid} doc SUCCEEDS (the firestore.rules users block — the very rule
// that makes users/{uid} non-authoritative for this state), so an over-broad
// or misloaded ruleset cannot pass this suite vacuously by failing everything.
//
// DEPLOY NOTE: rules deploy manually via the Console (the runbook step) and
// are inert until deployed. Point COMPOSITION_RULES_TEXT_PATH at fetched
// deployed rules text to prove the LIVE ruleset after that deploy (the
// wire/composition/rankingSnapshot siblings' knob); the default is the repo
// text, and the sha256 of whichever was loaded is printed.
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
const RULES_PATH = process.env.COMPOSITION_RULES_TEXT_PATH
  ? resolve(process.env.COMPOSITION_RULES_TEXT_PATH)
  : resolve(__dirname, '../../firestore.rules');
const RULES_TEXT = readFileSync(RULES_PATH, 'utf8');
const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');

const OWNER_UID = 'eligible-owner-1';
const OTHER_UID = 'intruder-user-2';
const FRESH_UID = 'never-attested-3';
const PRIVILEGED_UID = 'eligible-admin-4';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const OWNER_DOC = `eligibility/${OWNER_UID}`;
const FRESH_DOC = `eligibility/${FRESH_UID}`;
const OWNER_USER_DOC = `users/${OWNER_UID}`;

// The exact §6 shape the route writes (api/eligibility/attest.js).
const attestation = () => ({
  adultAttestedAt: '2026-09-14T13:30:00.000Z',
  termsVersion: 'beta-2026-09-draft',
  acceptedAt: '2026-09-14T13:30:00.000Z',
  source: 'backing_beta',
});

let testEnv;

/** Seed a document bypassing rules (the Admin-SDK-equivalent path). */
async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asFresh = () => testEnv.authenticatedContext(FRESH_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

beforeAll(async () => {
  console.log(`[eligibilityDenials] loaded rules text: ${RULES_PATH}`);
  console.log(`[eligibilityDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(OWNER_DOC, attestation());
  await seed(OWNER_USER_DOC, { profile: { username: 'owner', bio: '' } });
});

describe('POSITIVE CONTROLS — the ruleset is loaded and not over-broad', () => {
  it('the owner reads their own attestation', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), OWNER_DOC)));
  });

  it('the owner still updates their own users/{uid} doc — the owner-writable doc the attestation deliberately does not live on', async () => {
    await assertSucceeds(updateDoc(doc(asOwner(), OWNER_USER_DOC), { 'profile.bio': 'hi' }));
  });
});

describe('eligibility/{uid} — READ is owner-only', () => {
  it('another authenticated user cannot read it', async () => {
    await assertFails(getDoc(doc(asOther(), OWNER_DOC)));
  });

  it("a privileged-claims context cannot read another user's doc (the rules carry no admin path)", async () => {
    await assertFails(getDoc(doc(asPrivileged(), OWNER_DOC)));
  });

  it('an unauthenticated client cannot read it', async () => {
    await assertFails(getDoc(doc(asAnon(), OWNER_DOC)));
  });

  it("a non-owner's read of an ABSENT doc is denied too — no existence oracle", async () => {
    await assertFails(getDoc(doc(asOther(), FRESH_DOC)));
    await assertFails(getDoc(doc(asAnon(), FRESH_DOC)));
  });
});

describe('eligibility/{uid} — no client CREATE, UPDATE or DELETE, the owner included', () => {
  it('a user cannot CREATE their own attestation — client self-attestation is exactly what the rule forbids', async () => {
    await assertFails(setDoc(doc(asFresh(), FRESH_DOC), attestation()));
  });

  it('the owner cannot UPDATE their own doc — no backdating, no terms-version rewrite, no merge', async () => {
    await assertFails(updateDoc(doc(asOwner(), OWNER_DOC), { adultAttestedAt: '2000-01-01T00:00:00.000Z' }));
    await assertFails(setDoc(doc(asOwner(), OWNER_DOC), { ...attestation(), termsVersion: 'forged' }));
    await assertFails(setDoc(doc(asOwner(), OWNER_DOC), { source: 'client' }, { merge: true }));
  });

  it('the owner cannot DELETE their own doc', async () => {
    await assertFails(deleteDoc(doc(asOwner(), OWNER_DOC)));
  });

  const CONTEXTS = [
    ['another authenticated user', asOther],
    ['a privileged-claims context', asPrivileged],
    ['an unauthenticated client', asAnon],
  ];

  for (const [label, ctx] of CONTEXTS) {
    it(`${label}: create/update/delete all fail`, async () => {
      const fs = ctx();
      await assertFails(setDoc(doc(fs, FRESH_DOC), attestation()));
      await assertFails(updateDoc(doc(fs, OWNER_DOC), { source: 'forged' }));
      await assertFails(setDoc(doc(fs, OWNER_DOC), attestation()));
      await assertFails(deleteDoc(doc(fs, OWNER_DOC)));
    });
  }
});
