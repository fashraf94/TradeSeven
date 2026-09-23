// test/rules/teamPitchesDenials.rules.mjs
//
// Backing Beta PR 4 — Firestore security-rules acceptance for the server-
// written scouting pitch (design brief rev2 §2, rev3 §3; spec V1.3 §9). Proves
// against the REAL rules engine that `teamPitches/{uid}` is AUTHED-READ (any
// signed-in spectator can read any pitch — it is a public line on the team
// card) and that NO client — the owner included — can create, update or delete
// it (the tournamentRanks `write: if false` pattern). The only writer is the
// Admin SDK behind POST /api/team/pitch.
//
// WITH POSITIVE CONTROLS (the eligibilityDenials / wireDenials pattern): the
// same run asserts that the owner's AND a stranger's reads SUCCEED, and that
// the owner's update of their own users/{uid} doc SUCCEEDS (the very rule that
// makes users/{uid} non-authoritative for this line), so an over-broad or
// misloaded ruleset cannot pass this suite vacuously by failing everything.
//
// MUTATION CHECK, recorded (BUILD_RULES §2): with the whole block DELETED the
// read rows fail (Firestore denies by default) — the block is what grants the
// authed read, so the rows are a genuine guard on it; with the write line
// relaxed to `if request.auth.uid == userId` the four owner-write rows fail.
//
// DEPLOY NOTE: rules deploy manually via the Console (the runbook step) and
// are inert until deployed. Point COMPOSITION_RULES_TEXT_PATH at fetched
// deployed rules text to prove the LIVE ruleset after that deploy; the default
// is the repo text, and the sha256 of whichever was loaded is printed.
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

const OWNER_UID = 'pitch-owner-1';
const OTHER_UID = 'pitch-reader-2';
const FRESH_UID = 'pitch-never-3';
const PRIVILEGED_UID = 'pitch-admin-4';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const OWNER_DOC = `teamPitches/${OWNER_UID}`;
const FRESH_DOC = `teamPitches/${FRESH_UID}`;
const OWNER_USER_DOC = `users/${OWNER_UID}`;

// The exact shape the route writes (api/team/pitch.js buildPitchDoc).
const pitch = (text = 'Momentum, but patient. I wait for Tuesday.') => ({
  text,
  updatedAt: '2026-09-22T14:00:00.000Z',
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
  console.log(`[teamPitchesDenials] loaded rules text: ${RULES_PATH}`);
  console.log(`[teamPitchesDenials] rules sha256: ${RULES_SHA256}`);
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-tradeseven-rules',
    firestore: { rules: RULES_TEXT },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(OWNER_DOC, pitch());
  await seed(OWNER_USER_DOC, { username: 'Atlas', displayName: 'Atlas' });
});

describe('teamPitches/{uid} — AUTHED-READ (a public line on the team card)', () => {
  it('POSITIVE CONTROL: the owner reads their own pitch', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), OWNER_DOC)));
  });

  it('POSITIVE CONTROL: another signed-in user reads it too — the card shows it to any spectator', async () => {
    await assertSucceeds(getDoc(doc(asOther(), OWNER_DOC)));
  });

  it('an anonymous (unauthenticated) client cannot read it', async () => {
    await assertFails(getDoc(doc(asAnon(), OWNER_DOC)));
  });

  it('a signed-in read of a pitch that does not exist is allowed (and simply empty)', async () => {
    await assertSucceeds(getDoc(doc(asFresh(), FRESH_DOC)));
  });
});

describe('teamPitches/{uid} — NO CLIENT WRITE, the owner included', () => {
  it('the owner cannot CREATE their own pitch client-side', async () => {
    await assertFails(setDoc(doc(asFresh(), FRESH_DOC), pitch('Written from the client.')));
  });

  it('the owner cannot UPDATE their own pitch client-side', async () => {
    await assertFails(updateDoc(doc(asOwner(), OWNER_DOC), { text: 'Edited from the client.' }));
  });

  it('the owner cannot OVERWRITE their own pitch client-side (set on an existing doc)', async () => {
    await assertFails(setDoc(doc(asOwner(), OWNER_DOC), pitch('Overwritten from the client.')));
  });

  it('the owner cannot DELETE their own pitch client-side', async () => {
    await assertFails(deleteDoc(doc(asOwner(), OWNER_DOC)));
  });

  it('another user cannot write it either', async () => {
    await assertFails(setDoc(doc(asOther(), OWNER_DOC), pitch('Vandalized.')));
    await assertFails(updateDoc(doc(asOther(), OWNER_DOC), { text: 'Vandalized.' }));
    await assertFails(deleteDoc(doc(asOther(), OWNER_DOC)));
  });

  it('a privileged-claims token gets no write path either — the ruleset carries no admin bypass', async () => {
    await assertFails(setDoc(doc(asPrivileged(), FRESH_DOC), pitch()));
    await assertFails(updateDoc(doc(asPrivileged(), OWNER_DOC), { text: 'admin' }));
    await assertFails(deleteDoc(doc(asPrivileged(), OWNER_DOC)));
  });

  it('an anonymous client cannot write it', async () => {
    await assertFails(setDoc(doc(asAnon(), FRESH_DOC), pitch()));
  });
});

describe('the reason it is not on users/{uid}', () => {
  it('POSITIVE CONTROL: the owner CAN update their own users/{uid} doc — which is exactly why a pitch there would not be authoritative', async () => {
    await assertSucceeds(updateDoc(doc(asOwner(), OWNER_USER_DOC), { displayName: 'Atlas Prime' }));
  });
});
