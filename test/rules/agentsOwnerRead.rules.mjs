// test/rules/agentsOwnerRead.rules.mjs
//
// PRE-FLIP HONESTY FIX B (Backing spec V1.3 §11 gate 3) — `agents/{agentId}`
// is OWNER-READ. Proves against the REAL rules engine that:
//
//   · the owner reads their own agent document — the live WHY (activeRules,
//     equippedBundleIds, standingLeans, dials, equippedTraits, the deployed
//     strategy) included — the positive control that keeps this suite from
//     passing vacuously on a broken ruleset;
//   · another signed-in user is DENIED the document (the hole: the authed-read
//     rule handed every signed-in user what the P7 battle-view projection
//     conceals during a live battle);
//   · anonymous is DENIED;
//   · a CPU agent document (`cpu-agent-*`, ownerId `cpu-*`) is DENIED to every
//     client — those are server-side (Admin SDK) reads only;
//   · a document without an ownerId is DENIED (the field access errors → deny,
//     fail closed);
//   · the owner's casual clone (`casual-agent-{uid}`, ownerId = the player)
//     stays readable BY ID — the deploy-target subscription's shape;
//   · LIST queries: the own-scoped query (`where('ownerId', '==', uid)` — the
//     subscribeToUserAgent / ForgeLanding / assembleBoardPrefill shape) is
//     admitted and returns only the owner's documents; a query scoped to
//     another user's ownerId, an unfiltered collection read (the archived
//     leaderboard's shape) and an anonymous list are all DENIED;
//   · the owner WRITE rules are unchanged: the live createAgent shape still
//     passes for its owner, the update allowlist still admits exactly its keys
//     and nothing for another user, and delete stays denied for everyone.
//
// MUTATION CHECK: revert the read rule to `request.auth != null` → the
// "another signed-in user is DENIED" row (and the CPU / list-denial rows) red.
//
// DEPLOY NOTE: rules deploy manually via the Console and are inert until
// deployed. Point COMPOSITION_RULES_TEXT_PATH at fetched deployed rules text to
// prove the LIVE ruleset after that deploy (the backing/wire/composition
// siblings' knob); the default is the repo text, and the sha256 of whichever
// was loaded is printed.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = process.env.COMPOSITION_RULES_TEXT_PATH
  ? resolve(process.env.COMPOSITION_RULES_TEXT_PATH)
  : resolve(__dirname, '../../firestore.rules');
const RULES_TEXT = readFileSync(RULES_PATH, 'utf8');
const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');

const OWNER_UID = 'agents-owner-1';
const OTHER_UID = 'agents-intruder-2';

const OWN_AGENT = 'agents/own-agent-1';
const OTHER_AGENT = 'agents/other-agent-2';
const CPU_AGENT = 'agents/cpu-agent-7';
const CLONE_AGENT = `agents/casual-agent-${OWNER_UID}`;
const NO_OWNER_AGENT = 'agents/legacy-no-owner';

// The live WHY the battle-view projection conceals for non-owners during an
// active battle — present on the seeded docs so the denial rows deny THE
// EXPOSURE, not an empty shell.
const LIVE_WHY = Object.freeze({
  activeRules: [{ id: 'r1', text: 'Cut anything that breaks its Monday low.' }],
  equippedBundleIds: ['bundle-1'],
  standingLeans: [{ adjustmentId: 'CP-01', version: 1 }],
  dials: { tempo: 3 },
  equippedTraits: [{ traitId: 'patience', strength: 'moderate' }],
  deployedStrategy: { preset: 'aggressive' },
});
const agentDoc = (ownerId, extra = {}) => ({
  ownerId, name: 'Aurora', archetype: 'guardian', ...LIVE_WHY, ...extra,
});

// The EXACT live createAgent shape (the masteryDenials CREATE row's) — the one
// client create the unchanged write rules must keep admitting.
const CREATE_SHAPE = Object.freeze({
  ownerId: OWNER_UID,
  name: 'Aurora',
  archetype: 'guardian',
  archetypeDrift: null,
  config: { risk: 50, concentration: 50, momentum: 50 },
  personality: {},
  avatarColors: ['#5eead4', '#a855f7'],
  primaryColor: null,
  memory: [],
  consolidatedInsight: '',
  directives: [],
  activeRules: [],
  equippedBundleIds: [],
  equippedWatchlistId: null,
  equippedWatchlistName: null,
  equippedAt: null,
  starterKitCompleted: false,
  stats: { wins: 0, losses: 0, gamesPlayed: 0, totalScore: 0, avgScore: 0, currentStreak: 0, bestStreak: 0 },
  evolutionCycle: 0,
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
  lastDeployedAt: null,
});

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
  console.log(`[agentsOwnerRead] rules text: ${RULES_PATH} sha256=${RULES_SHA256}`);
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [emuHost, emuPort] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-tradeseven-rules',
    firestore: { rules: RULES_TEXT, host: emuHost, port: Number(emuPort) },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  if (testEnv) await testEnv.clearFirestore();
  await seed(OWN_AGENT, agentDoc(OWNER_UID));
  await seed(OTHER_AGENT, agentDoc(OTHER_UID));
  await seed(CPU_AGENT, agentDoc('cpu-7', { isCpu: true }));
  await seed(CLONE_AGENT, agentDoc(OWNER_UID, { isCasualClone: true, rankedAgentId: 'own-agent-1' }));
});

// ───────────────────────────────────────────────────────────────────────────
// agents/{agentId} — GET
// ───────────────────────────────────────────────────────────────────────────
describe('agents/{agentId} — OWNER-ONLY READ (GET)', () => {
  it('positive control: the owner reads their own agent — the live WHY included', async () => {
    const snap = await assertSucceeds(getDoc(doc(asOwner(), OWN_AGENT)));
    expect(snap.exists()).toBe(true);
    expect(snap.data().activeRules).toEqual(LIVE_WHY.activeRules);
    expect(snap.data().equippedBundleIds).toEqual(LIVE_WHY.equippedBundleIds);
  });

  it('another signed-in user is DENIED the document (the live WHY the projection conceals)', async () => {
    await assertFails(getDoc(doc(asOther(), OWN_AGENT)));
    await assertFails(getDoc(doc(asOwner(), OTHER_AGENT)));
  });

  it('anonymous is DENIED', async () => {
    await assertFails(getDoc(doc(asAnon(), OWN_AGENT)));
    await assertFails(getDoc(doc(asAnon(), OTHER_AGENT)));
  });

  it('a CPU agent document (ownerId cpu-*) is DENIED to every client — server-side reads only', async () => {
    await assertFails(getDoc(doc(asOwner(), CPU_AGENT)));
    await assertFails(getDoc(doc(asOther(), CPU_AGENT)));
    await assertFails(getDoc(doc(asAnon(), CPU_AGENT)));
  });

  it('a document without an ownerId is DENIED (fail closed)', async () => {
    await seed(NO_OWNER_AGENT, { name: 'Orphan', activeRules: LIVE_WHY.activeRules });
    await assertFails(getDoc(doc(asOwner(), NO_OWNER_AGENT)));
    await assertFails(getDoc(doc(asAnon(), NO_OWNER_AGENT)));
  });

  it('the owner\'s casual clone (casual-agent-{uid}, ownerId = the player) stays readable BY ID — the deploy-target subscription\'s shape; nobody else\'s', async () => {
    const snap = await assertSucceeds(getDoc(doc(asOwner(), CLONE_AGENT)));
    expect(snap.data().isCasualClone).toBe(true);
    await assertFails(getDoc(doc(asOther(), CLONE_AGENT)));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// agents — LIST
// ───────────────────────────────────────────────────────────────────────────
describe('agents — LIST queries', () => {
  it('the own-scoped query (where ownerId == uid — subscribeToUserAgent / ForgeLanding / assembleBoardPrefill) is ADMITTED and returns only the owner\'s documents', async () => {
    const snap = await assertSucceeds(getDocs(query(
      collection(asOwner(), 'agents'),
      where('ownerId', '==', OWNER_UID),
    )));
    expect(snap.docs.map((d) => d.id).sort()).toEqual([`casual-agent-${OWNER_UID}`, 'own-agent-1']);
  });

  it('a query scoped to ANOTHER user\'s ownerId is DENIED', async () => {
    await assertFails(getDocs(query(collection(asOther(), 'agents'), where('ownerId', '==', OWNER_UID))));
    await assertFails(getDocs(query(collection(asOwner(), 'agents'), where('ownerId', '==', 'cpu-7'))));
  });

  it('an unfiltered collection read (the archived leaderboard\'s shape) is DENIED — the owner included', async () => {
    await assertFails(getDocs(collection(asOwner(), 'agents')));
    await assertFails(getDocs(query(collection(asOwner(), 'agents'), orderBy('stats.gamesPlayed', 'desc'), limit(50))));
    await assertFails(getDocs(query(collection(asOwner(), 'agents'), where('stats.gamesPlayed', '>=', 5), orderBy('stats.gamesPlayed', 'desc'), limit(50))));
  });

  it('an anonymous list is DENIED, own-scoped or not', async () => {
    await assertFails(getDocs(collection(asAnon(), 'agents')));
    await assertFails(getDocs(query(collection(asAnon(), 'agents'), where('ownerId', '==', OWNER_UID))));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// agents — the owner WRITE rules, unchanged
// ───────────────────────────────────────────────────────────────────────────
describe('agents — owner WRITES unchanged', () => {
  it('CREATE: the live createAgent shape passes for its owner; a create claiming another ownerId is denied', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), 'agents/new-agent-1'), CREATE_SHAPE));
    await assertFails(setDoc(doc(asOther(), 'agents/new-agent-2'), CREATE_SHAPE));
  });

  it('UPDATE: the owner may touch only the allowlisted keys; another user may touch nothing', async () => {
    await assertSucceeds(updateDoc(doc(asOwner(), OWN_AGENT), { directives: [{ id: 'd1', text: 'stay calm' }], updatedAt: 'now' }));
    await assertSucceeds(updateDoc(doc(asOwner(), OWN_AGENT), { starterKitCompleted: true, lastViewedEvolutionCycle: 1, updatedAt: 'now' }));
    await assertFails(updateDoc(doc(asOwner(), OWN_AGENT), { activeRules: [], updatedAt: 'now' }));
    await assertFails(updateDoc(doc(asOwner(), OWN_AGENT), { stats: { wins: 99 }, updatedAt: 'now' }));
    await assertFails(updateDoc(doc(asOther(), OWN_AGENT), { directives: [], updatedAt: 'now' }));
    await assertFails(updateDoc(doc(asAnon(), OWN_AGENT), { directives: [], updatedAt: 'now' }));
  });

  it('DELETE: denied for everyone, the owner included', async () => {
    await assertFails(deleteDoc(doc(asOwner(), OWN_AGENT)));
    await assertFails(deleteDoc(doc(asOther(), OWN_AGENT)));
    await assertFails(deleteDoc(doc(asAnon(), OWN_AGENT)));
  });
});
