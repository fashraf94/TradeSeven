// test/rules/wireDenials.rules.mjs
//
// FantasyTimes Wire Phase 1 — Firestore security-rules acceptance
// (Wire Spec V1.5 §9, F2-4).
//
// Proves against the REAL emulator that the three Wire collections
// (fantasyTimesWire, fantasyTimesWireEnvelopes, wireMetrics) deny EVERY
// client verb for unauth, ordinary auth, and a privileged-role context —
// WITH POSITIVE CONTROLS (F2-4): the same run asserts that a known-public
// read (fantasyTimesStories) and a known-allowed authed read
// (voiceLayerCache) SUCCEED, so a misloaded/over-broad ruleset cannot pass
// this suite vacuously by failing everything.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { readFileSync } from 'node:fs';
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
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

const USER_UID = 'wire-user-1';
// "Privileged" here = the strongest client-side identity the app mints (an
// authed user with custom claims). The Admin SDK bypasses rules entirely and
// is out of scope for an emulator client-rules suite.
const PRIVILEGED_UID = 'wire-admin-1';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const WIRE_DOC = 'fantasyTimesWire/2026-07-24';
const ENVELOPE_DOC = 'fantasyTimesWireEnvelopes/story-1';
const METRICS_DOC = 'wireMetrics/2026-07-24';
const WIRE_PATHS = [WIRE_DOC, ENVELOPE_DOC, METRICS_DOC];

// Positive-control paths (F2-4)
const PUBLIC_STORY_DOC = 'fantasyTimesStories/story-pub-1';
const AUTHED_OK_DOC = 'voiceLayerCache/battle-1';

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
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(WIRE_DOC, { date: '2026-07-24', entries: [], receipts: {} });
  await seed(ENVELOPE_DOC, { storyId: 'story-1', outcome: 'passed' });
  await seed(METRICS_DOC, { date: '2026-07-24', seams: {} });
  await seed(PUBLIC_STORY_DOC, { headline: 'h', status: 'published' });
  await seed(AUTHED_OK_DOC, { battleId: 'battle-1', scoutAlerts: [] });
});

describe('POSITIVE CONTROLS (F2-4) — the ruleset is loaded and not over-broad', () => {
  it('public story read succeeds unauthenticated', async () => {
    await assertSucceeds(getDoc(doc(asAnon(), PUBLIC_STORY_DOC)));
  });
  it('known-allowed privileged op succeeds (authed voiceLayerCache read)', async () => {
    await assertSucceeds(getDoc(doc(asUser(), AUTHED_OK_DOC)));
  });
});

describe('Wire collections — every verb denied for every client identity', () => {
  const CONTEXTS = [
    ['unauthenticated', asAnon],
    ['ordinary auth', asUser],
    ['privileged claims', asPrivileged],
  ];

  for (const [label, ctx] of CONTEXTS) {
    for (const path of WIRE_PATHS) {
      it(`${label}: read/create/update/delete all fail on ${path.split('/')[0]}`, async () => {
        const fs = ctx();
        await assertFails(getDoc(doc(fs, path)));
        await assertFails(setDoc(doc(fs, `${path.split('/')[0]}/new-doc`), { x: 1 }));
        await assertFails(updateDoc(doc(fs, path), { x: 2 }));
        await assertFails(deleteDoc(doc(fs, path)));
      });
    }
  }
});

describe('agentFacts stays server-side even via the public story surface', () => {
  it('a client cannot write agentFacts (or anything) onto a story doc', async () => {
    await assertFails(updateDoc(doc(asUser(), PUBLIC_STORY_DOC), { agentFacts: { eventType: 'x' } }));
    await assertFails(setDoc(doc(asAnon(), 'fantasyTimesStories/injected'), { agentFacts: {} }));
  });
});
