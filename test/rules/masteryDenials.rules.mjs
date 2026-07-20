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
