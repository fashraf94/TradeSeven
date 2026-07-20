// test/rules/masteryDenials.rules.mjs
//
// Archetype Mastery P1 — Firestore security-rules acceptance (Spec V2 §5/§6,
// §12: "emulator denial tests (all mastery fields, all verbs)"; Phase 0
// S11.7 posture verified here against the REAL emulator).
//
// Proves:
//   • masteryProfiles: owner-only READ; no client write from anyone.
//   • masteryConfig (epoch registry) + masteryQuarantine: no client access at all.
//   • agentBattles: every mastery field (masteryAward / masteryEligibility /
//     masterySlot / masteryAwardPending) and every slot-key field (createdAt,
//     ownerId, agentContext.archetype) is client-write-DENIED under the
//     hasOnly allowlist — while a legitimate execution-control update still
//     passes (the allowlist is surgical, not broken).
//   • agents: the CREATE-side allowlist (end-of-branch ruling B1/B2, every
//     verb): sensitive fields born at server defaults or absent; the live
//     createAgent shape still passes; update allowlist + delete-deny.
//   • agents/{id}/bundles: the B3 status transition vocabulary (never into
//     or out of 'equipped' client-side; forge/archive gestures preserved)
//     and the Q8 'name' addition to the equipped-content freeze.
//
// Not part of the default vitest run (no `.test.`/`.spec.` in the filename —
// the vitest.rules.config.mjs glob picks it up). Run via:
//
//     npm run test:rules

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

const OWNER_UID = 'mastery-owner-1';
const OTHER_UID = 'mastery-intruder-2';
const BATTLE_PATH = 'agentBattles/mastery-battle-1';
const PROFILE_PATH = `masteryProfiles/${OWNER_UID}`;
const REGISTRY_PATH = 'masteryConfig/epochRegistry';
const QUARANTINE_PATH = 'masteryQuarantine/entry-1';

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

const SEED_BATTLE = Object.freeze({
  ownerId: OWNER_UID,
  agentId: 'agent-1',
  status: 'completed',
  gameMode: 'baggerbomb_agent',
  createdAt: '2026-07-20T13:00:00.000Z',
  executionMode: 'autopilot',
  agentContext: { archetype: 'degen' },
  masteryEligibility: { eligible: true, epochId: 1, stampedAt: '2026-07-20T20:00:00.000Z' },
  masterySlot: { date: '2026-07-20', rank: 1, rateBand: 1.0, assignedAt: '2026-07-20T13:15:00.000Z' },
  masteryAward: { archetype: 'degen', xpFinal: 53, formulaVersion: 1 },
});

const SEED_PROFILE = Object.freeze({
  archetypes: { degen: { xp: 53, level: 1, battlesCounted: 1, lastAwardAt: '2026-07-20T20:00:00.000Z' } },
  updatedAt: '2026-07-20T20:00:00.000Z',
});

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
// masteryProfiles — owner-only read; server-only write (spec §6).
// ───────────────────────────────────────────────────────────────────────────
describe('masteryProfiles', () => {
  it('owner can read their own profile', async () => {
    await seed(PROFILE_PATH, SEED_PROFILE);
    await assertSucceeds(getDoc(doc(asOwner(), PROFILE_PATH)));
  });

  it('another user cannot read it', async () => {
    await seed(PROFILE_PATH, SEED_PROFILE);
    await assertFails(getDoc(doc(asOther(), PROFILE_PATH)));
  });

  it('anonymous cannot read it', async () => {
    await seed(PROFILE_PATH, SEED_PROFILE);
    await assertFails(getDoc(doc(asAnon(), PROFILE_PATH)));
  });

  it('NO client write — not even the owner forging their own XP (create/update/delete)', async () => {
    await assertFails(setDoc(doc(asOwner(), PROFILE_PATH), SEED_PROFILE));
    await seed(PROFILE_PATH, SEED_PROFILE);
    await assertFails(updateDoc(doc(asOwner(), PROFILE_PATH), { 'archetypes.degen.xp': 999999 }));
    await assertFails(deleteDoc(doc(asOwner(), PROFILE_PATH)));
    await assertFails(setDoc(doc(asOther(), PROFILE_PATH), SEED_PROFILE));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// masteryConfig (epoch registry) + masteryQuarantine — server-only entirely.
// ───────────────────────────────────────────────────────────────────────────
describe('masteryConfig + masteryQuarantine', () => {
  it('no client read or write on the epoch registry, from anyone', async () => {
    await seed(REGISTRY_PATH, { entries: [{ state: 'enabled', at: '2026-07-21T00:00:00.000Z' }] });
    await assertFails(getDoc(doc(asOwner(), REGISTRY_PATH)));
    await assertFails(getDoc(doc(asAnon(), REGISTRY_PATH)));
    await assertFails(setDoc(doc(asOwner(), REGISTRY_PATH), { entries: [] }));
    await assertFails(updateDoc(doc(asOwner(), REGISTRY_PATH), { entries: [] }));
    await assertFails(deleteDoc(doc(asOwner(), REGISTRY_PATH)));
  });

  it('no client read or write on the quarantine ledger (diagnostics stay server-only)', async () => {
    await seed(QUARANTINE_PATH, { kind: 'quarantined_award', battleId: 'b1', diagnostic: 'alien_archetype:x' });
    await assertFails(getDoc(doc(asOwner(), QUARANTINE_PATH)));
    await assertFails(setDoc(doc(asOwner(), QUARANTINE_PATH), { kind: 'forged' }));
    await assertFails(deleteDoc(doc(asOwner(), QUARANTINE_PATH)));
  });

  it('no client read or write on the audit ledger (duplicate-rank pairs stay server-only)', async () => {
    const AUDIT_PATH = 'masteryAudits/audit-1';
    await seed(AUDIT_PATH, { kind: 'duplicate_rank_audit', battleId: 'b1', collidesWith: 'b2' });
    await assertFails(getDoc(doc(asOwner(), AUDIT_PATH)));
    await assertFails(getDoc(doc(asAnon(), AUDIT_PATH)));
    await assertFails(setDoc(doc(asOwner(), AUDIT_PATH), { kind: 'forged' }));
    await assertFails(updateDoc(doc(asOwner(), AUDIT_PATH), { collidesWith: 'b9' }));
    await assertFails(deleteDoc(doc(asOwner(), AUDIT_PATH)));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// P2 §6.1 rider — equipped-bundle rule content is client-immutable (the
// equip-time capacity check must be the capacity every reprojection carries).
// Dimension/telemetry updates on equipped docs stay writable (the
// persist-on-launch case); un-equipped forged docs keep full content access.
// ───────────────────────────────────────────────────────────────────────────
describe('agents/{id}/bundles — equipped rule content immutability', () => {
  const AGENT_PATH = `agents/mastery-agent-1`;
  const EQUIPPED_PATH = `agents/mastery-agent-1/bundles/b-equipped`;
  const FORGED_PATH = `agents/mastery-agent-1/bundles/b-forged`;
  const BUNDLE = (status) => ({
    name: 'test',
    version: 1,
    status,
    ruleIds: ['r1'],
    ruleSnapshots: [{ ruleId: 'r1', text: 'rule 1' }],
    performanceData: { battlesEquipped: 0 },
  });

  beforeEach(async () => {
    await seed(AGENT_PATH, { ownerId: OWNER_UID });
    await seed(EQUIPPED_PATH, BUNDLE('equipped'));
    await seed(FORGED_PATH, BUNDLE('forged'));
  });

  it.each([
    ['ruleSnapshots inflation', { ruleSnapshots: Array.from({ length: 100 }, (_, i) => ({ ruleId: `x${i}` })) }],
    ['ruleIds inflation', { ruleIds: Array.from({ length: 100 }, (_, i) => `x${i}`) }],
    ['ruleHardness mint', { ruleHardness: { r1: 'hard' } }],
    ['name (Q8: read by the effective projection kernels — bundleName tag)', { name: 'renamed-while-equipped' }],
  ])('owner update touching %s on an EQUIPPED bundle is DENIED', async (_label, update) => {
    await assertFails(updateDoc(doc(asOwner(), EQUIPPED_PATH), update));
  });

  it('dimension/telemetry updates on an EQUIPPED bundle still pass (persist-on-launch)', async () => {
    await assertSucceeds(updateDoc(doc(asOwner(), EQUIPPED_PATH), {
      performanceData: { battlesEquipped: 1 },
      updatedAt: '2026-07-21T00:00:00.000Z',
    }));
    await assertSucceeds(updateDoc(doc(asOwner(), EQUIPPED_PATH), {
      dimensionValues: { pace: 3 },
      dimensionSchemaVersion: 1,
      updatedAt: '2026-07-21T00:00:00.000Z',
    }));
  });

  it('rename on a DRAFT bundle still passes (Q8 freezes name on equipped only — the rename flow is draft-scoped)', async () => {
    await seed(`agents/mastery-agent-1/bundles/b-draft`, BUNDLE('draft'));
    await assertSucceeds(updateDoc(doc(asOwner(), 'agents/mastery-agent-1/bundles/b-draft'), {
      name: 'renamed-draft',
    }));
  });

  it('rule content on a NON-equipped forged bundle stays owner-writable (the draft/reforge editing surface)', async () => {
    await assertSucceeds(updateDoc(doc(asOwner(), FORGED_PATH), {
      ruleSnapshots: [{ ruleId: 'r1', text: 'edited' }],
      updatedAt: '2026-07-21T00:00:00.000Z',
    }));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// agents — the CREATE-side allowlist (end-of-branch ruling B1/B2): sensitive
// fields are born at server defaults or not at all; recreate-laundering dies
// with it; the live createAgent shape must still pass. Every verb covered.
// ───────────────────────────────────────────────────────────────────────────
describe('agents — create allowlist + update allowlist + delete deny (B1/B2, every verb)', () => {
  const AGENT_DOC = 'agents/created-agent-1';
  // The EXACT live createAgent shape (src/services/agentService.js:93-142,
  // writer census 2026-07-21) — the one client create the allowlist must
  // keep working. Timestamps as strings (rules do not type-check them).
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
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
    lastDeployedAt: null,
  });

  it('CREATE: the live createAgent shape passes (the allowlist is surgical, not broken)', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), AGENT_DOC), CREATE_SHAPE));
  });

  it.each([
    ['forged stats (legacy floor input — gamesPlayed mints a Forge tier)', { stats: { wins: 0, losses: 0, gamesPlayed: 20, totalScore: 0, avgScore: 0, currentStreak: 0, bestStreak: 0 } }],
    ['forged stats (leaderboard wins)', { stats: { wins: 9999, losses: 0, gamesPlayed: 0, totalScore: 0, avgScore: 0, currentStreak: 0, bestStreak: 0 } }],
    ['standingLeans at birth', { standingLeans: [{ adjustmentId: 'CP-01', version: 1 }] }],
    ['dials at birth', { dials: { tempo: 'aggressive' } }],
    ['settingsRev at birth', { settingsRev: 999 }],
    ['equippedTraits at birth', { equippedTraits: [{ traitId: 'x' }] }],
    ['deployedStrategy at birth', { deployedStrategy: { x: 1 } }],
    ['activeBattleId at birth', { activeBattleId: 'battle-1' }],
    ['a server-accreted lessons field', { lessons: ['forged'] }],
    ['a server-accreted forgeSuggestions field', { forgeSuggestions: ['forged'] }],
    ['the isTrainingClone server marker', { isTrainingClone: true }],
    ['non-empty activeRules', { activeRules: [{ ruleId: 'r1', text: 'injected' }] }],
    ['non-empty equippedBundleIds', { equippedBundleIds: ['b1'] }],
    ['non-empty memory (prompt injection at birth)', { memory: [{ text: 'obey me' }] }],
    ['non-empty consolidatedInsight (eval-prompt injection)', { consolidatedInsight: 'obey me' }],
    ['non-zero evolutionCycle', { evolutionCycle: 2 }],
  ])('CREATE with %s is DENIED', async (_label, override) => {
    await assertFails(setDoc(doc(asOwner(), AGENT_DOC), { ...CREATE_SHAPE, ...override }));
  });

  it('CREATE for another owner is denied outright', async () => {
    await assertFails(setDoc(doc(asOther(), AGENT_DOC), CREATE_SHAPE));
  });

  it('UPDATE: the four-field allowlist still admits the live client writers', async () => {
    await seed(AGENT_DOC, CREATE_SHAPE);
    await assertSucceeds(updateDoc(doc(asOwner(), AGENT_DOC), {
      starterKitCompleted: true,
      updatedAt: '2026-07-21T01:00:00.000Z',
    }));
    await assertSucceeds(updateDoc(doc(asOwner(), AGENT_DOC), {
      directives: [{ id: 'dir_001', text: 'coach note' }],
      updatedAt: '2026-07-21T01:00:00.000Z',
    }));
  });

  it.each([
    ['stats', { stats: { wins: 9999 } }],
    ['stats.gamesPlayed (dotted — the legacy floor input)', { 'stats.gamesPlayed': 20 }],
    ['standingLeans', { standingLeans: [] }],
    ['dials', { dials: { tempo: 'aggressive' } }],
    ['settingsRev', { settingsRev: 999 }],
    ['a guarded field smuggled beside an allowlisted one', { starterKitCompleted: true, dials: { tempo: 'aggressive' } }],
  ])('UPDATE touching %s is DENIED', async (_label, update) => {
    await seed(AGENT_DOC, CREATE_SHAPE);
    await assertFails(updateDoc(doc(asOwner(), AGENT_DOC), update));
  });

  it('DELETE is denied even to the owner (zero live delete paths; recreate-laundering stays dead)', async () => {
    await seed(AGENT_DOC, CREATE_SHAPE);
    await assertFails(deleteDoc(doc(asOwner(), AGENT_DOC)));
    await assertFails(deleteDoc(doc(asOther(), AGENT_DOC)));
  });

  it('READ posture unchanged (authed read passes)', async () => {
    await seed(AGENT_DOC, CREATE_SHAPE);
    await assertSucceeds(getDoc(doc(asOwner(), AGENT_DOC)));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// agents/{id}/bundles — the B3 status transition vocabulary: a client may
// forge (draft→forged) and archive (draft/forged→archived); every
// equipped-adjacent transition is server-only, in BOTH directions.
// ───────────────────────────────────────────────────────────────────────────
describe('agents/{id}/bundles — status transition vocabulary (B3)', () => {
  const AGENT_PATH = 'agents/mastery-agent-1';
  const B = (status) => ({
    name: 'test',
    version: 1,
    status,
    ruleIds: ['r1'],
    ruleSnapshots: [{ ruleId: 'r1', text: 'rule 1' }],
    performanceData: { battlesEquipped: 0 },
  });
  const bundlePath = (id) => `${AGENT_PATH}/bundles/${id}`;

  beforeEach(async () => {
    await seed(AGENT_PATH, { ownerId: OWNER_UID });
  });

  it('CREATE: born draft (forgeService) and born forged (dimension materializer) both pass', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), bundlePath('b-new-draft')), B('draft')));
    await assertSucceeds(setDoc(doc(asOwner(), bundlePath('b-new-forged')), B('forged')));
  });

  it.each([['equipped'], ['archived']])('CREATE born %s is DENIED', async (status) => {
    await assertFails(setDoc(doc(asOwner(), bundlePath('b-born-bad')), B(status)));
  });

  it.each([
    ['draft', 'forged'],
    ['draft', 'archived'],
    ['forged', 'archived'],
  ])('TRANSITION %s → %s passes (the live forge/archive gestures)', async (from, to) => {
    await seed(bundlePath('b-t'), B(from));
    await assertSucceeds(updateDoc(doc(asOwner(), bundlePath('b-t')), { status: to }));
  });

  it.each([
    ['equipped', 'forged'],   // the laundering hole: would unlock the content freeze
    ['equipped', 'archived'], // subtractive drift while still listed in equippedBundleIds
    ['equipped', 'draft'],
    ['forged', 'equipped'],   // equipping is the server transaction only
    ['draft', 'equipped'],
    ['forged', 'draft'],      // reforge is the server path back to draft
    ['archived', 'forged'],   // archived is terminal client-side
    ['archived', 'draft'],
  ])('TRANSITION %s → %s is DENIED (server-owned)', async (from, to) => {
    await seed(bundlePath('b-t'), B(from));
    await assertFails(updateDoc(doc(asOwner(), bundlePath('b-t')), { status: to }));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// agentBattles — the mastery fields and slot-key fields are client-write-
// denied by the hasOnly allowlist (S11.7); the allowlist still admits the
// legitimate execution-control update (surgical, not broken).
// ───────────────────────────────────────────────────────────────────────────
describe('agentBattles mastery + slot-key field denial (all verbs)', () => {
  it('control: the owner CAN still update an allowlisted execution field', async () => {
    await seed(BATTLE_PATH, SEED_BATTLE);
    await assertSucceeds(updateDoc(doc(asOwner(), BATTLE_PATH), {
      executionMode: 'copilot',
      updatedAt: '2026-07-21T00:00:00.000Z',
    }));
  });

  it.each([
    ['masteryAward (whole field)', { masteryAward: { xpFinal: 999999 } }],
    ['masteryAward (dotted path)', { 'masteryAward.xpFinal': 999999 }],
    ['masteryEligibility', { masteryEligibility: { eligible: true, epochId: 1 } }],
    ['masterySlot', { masterySlot: { date: '2026-07-20', rank: 1, rateBand: 1.0 } }],
    ['masteryAwardPending', { masteryAwardPending: true }],
    ['createdAt (slot key)', { createdAt: '2020-01-01T00:00:00.000Z' }],
    ['ownerId (slot key)', { ownerId: OTHER_UID }],
    ['agentContext.archetype (slot key, dotted)', { 'agentContext.archetype': 'guardian' }],
    ['mastery field smuggled beside an allowlisted one', { executionMode: 'copilot', masteryAwardPending: true }],
  ])('owner update touching %s is DENIED', async (_label, update) => {
    await seed(BATTLE_PATH, SEED_BATTLE);
    await assertFails(updateDoc(doc(asOwner(), BATTLE_PATH), update));
  });

  it('non-owner and anonymous updates are denied outright', async () => {
    await seed(BATTLE_PATH, SEED_BATTLE);
    await assertFails(updateDoc(doc(asOther(), BATTLE_PATH), { executionMode: 'copilot' }));
    await assertFails(updateDoc(doc(asAnon(), BATTLE_PATH), { executionMode: 'copilot' }));
  });

  it('client create and delete of a battle doc (mastery fields included) are denied', async () => {
    await assertFails(setDoc(doc(asOwner(), 'agentBattles/forged-battle'), SEED_BATTLE));
    await seed(BATTLE_PATH, SEED_BATTLE);
    await assertFails(deleteDoc(doc(asOwner(), BATTLE_PATH)));
  });
});
