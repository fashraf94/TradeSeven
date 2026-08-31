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
// V1.6 A7 deployed-ruleset run: point COMPOSITION_RULES_TEXT_PATH at a file
// holding the FETCHED deployed rules text to prove the LIVE ruleset — the same
// env var the composition sibling honors, so ONE knob steers the whole
// `npm run test:rules` pass against deployed text. Default: the repo text
// (CI / the A5-1 repo-ruleset run). The loaded text's sha256 is printed in
// beforeAll so a deployed run is SELF-PROVING: that printed hash must equal the
// deployed ruleset's sha256 (RULES_DEPLOY_RECORD convention).
// NOTE (drift ledger D-5): `.firebaserc` is intentionally absent — no prod
// project alias is committed — so the fetch step must name the project
// explicitly (`--project <PROD_ID>`).
const RULES_PATH = process.env.COMPOSITION_RULES_TEXT_PATH
  ? resolve(process.env.COMPOSITION_RULES_TEXT_PATH)
  : resolve(__dirname, '../../firestore.rules');
const RULES_TEXT = readFileSync(RULES_PATH, 'utf8');
const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');

const USER_UID = 'wire-user-1';
// "Privileged" here = the strongest client-side identity the app mints (an
// authed user with custom claims). The Admin SDK bypasses rules entirely and
// is out of scope for an emulator client-rules suite.
const PRIVILEGED_UID = 'wire-admin-1';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const WIRE_DOC = 'fantasyTimesWire/2026-07-24';
const ENVELOPE_DOC = 'fantasyTimesWireEnvelopes/story-1';
const METRICS_DOC = 'wireMetrics/2026-07-24';
// Phase 2 N3 (P2-21 extension): the editorial evidence store is server-only
// like its three Phase 1 siblings — immutable runs + canonicalRunId are
// gate evidence and must never be client-writable (or client-readable:
// audit rows carry bounded prose excerpts and operand copies).
const EDITORIAL_DOC = 'wireEditorial/2026-W31';
const WIRE_PATHS = [WIRE_DOC, ENVELOPE_DOC, METRICS_DOC, EDITORIAL_DOC];

// Positive-control paths (F2-4)
const PUBLIC_STORY_DOC = 'fantasyTimesStories/story-pub-1';
const AUTHED_OK_DOC = 'voiceLayerCache/battle-1';
// P-4 (Command Center Sync Pass 1): voiceLayerCache reads are now owner-scoped
// via a get() join onto the battle doc, so the positive control needs the
// battle to exist and to name an owner. USER_UID owns it; PRIVILEGED_UID does
// not, which is what makes the negative control below meaningful.
const AUTHED_OK_BATTLE_DOC = 'agentBattles/battle-1';

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
  // Self-proving marker: for a deployed-ruleset run, this printed hash MUST
  // equal the sha256 of the fetched deployed text (RULES_DEPLOY_RECORD).
  console.log(`[wireDenials] loaded rules text: ${RULES_PATH}`);
  console.log(`[wireDenials] rules text sha256: ${RULES_SHA256}`);
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [emuHost, emuPort] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-tradeseven-rules',
    firestore: {
      rules: RULES_TEXT,
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
  await seed(EDITORIAL_DOC, { isoWeek: '2026-W31', canonicalRunId: null, runs: {} });
  await seed(PUBLIC_STORY_DOC, { headline: 'h', status: 'published' });
  await seed(AUTHED_OK_DOC, { battleId: 'battle-1', scoutAlerts: [] });
  await seed(AUTHED_OK_BATTLE_DOC, { ownerId: USER_UID, status: 'active' });
});

describe('POSITIVE CONTROLS (F2-4) — the ruleset is loaded and not over-broad', () => {
  it('public story read succeeds unauthenticated', async () => {
    await assertSucceeds(getDoc(doc(asAnon(), PUBLIC_STORY_DOC)));
  });
  // Still the F2-4 anti-vacuous control: a ruleset that denied everything
  // would fail here. P-4 narrowed WHICH authed identity succeeds (the battle's
  // owner) without giving up the "something is allowed" proof.
  it('known-allowed privileged op succeeds (OWNER voiceLayerCache read)', async () => {
    await assertSucceeds(getDoc(doc(asUser(), AUTHED_OK_DOC)));
  });
});

// P-4 (Command Center Sync Pass 1, PASS1_PHASE0_STOP_RULINGS_AND_GO.md §1).
// Before this pass, `allow read: if request.auth != null` let ANY authenticated
// user read ANY battle's voiceLayerCache — including an opponent's threshold
// proximity, which the Agent Desk is about to surface. The rule now resolves
// ownership by a get() join onto agentBattles/{battleId}.ownerId, because the
// cache doc carries no owner field of its own and this pass writes no battle
// state. These rows encode that policy so a future widening fails loudly.
describe('voiceLayerCache — owner-scoped read (P-4)', () => {
  it('a non-owner CANNOT read another user\'s cache, even with admin claims', async () => {
    await assertFails(getDoc(doc(asPrivileged(), AUTHED_OK_DOC)));
  });

  it('an unauthenticated client cannot read', async () => {
    await assertFails(getDoc(doc(asAnon(), AUTHED_OK_DOC)));
  });

  it('the owner still cannot WRITE (server-only, Admin SDK)', async () => {
    await assertFails(setDoc(doc(asUser(), AUTHED_OK_DOC), { battleId: 'battle-1' }));
  });

  it('denies when the battle doc is missing (get() join has nothing to resolve)', async () => {
    await seed('voiceLayerCache/orphan-1', { battleId: 'orphan-1', scoutAlerts: [] });
    await assertFails(getDoc(doc(asUser(), 'voiceLayerCache/orphan-1')));
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
