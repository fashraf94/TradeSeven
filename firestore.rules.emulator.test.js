// @vitest-environment node
//
// firestore.rules.emulator.test.js
// ─────────────────────────────────────────────────────────────────────────────
// PROPOSED agents-collection field-allowlist — emulator verification.
//
// Verifies the Phase-0 hardening diff (docs/audits/2026-07-15_FIRESTORE_RULES_
// AGENTS_DISCOVERY.md §10.3): a client may update the agents/{id} doc ONLY with
// the four-field allowlist
//     ['directives', 'lastViewedEvolutionCycle', 'starterKitCompleted', 'updatedAt']
// and every guarded field (settingsRev, standingLeans, dials, archetype, config,
// activeRules, memory, stats) plus ownerId is denied — while non-owners and
// anonymous callers are denied entirely.
//
// READ-ONLY: this test does NOT modify the deployed firestore.rules. It reads the
// real firestore.rules, applies the PROPOSED `allow update` clause IN MEMORY, and
// loads that patched string into the emulator. If firestore.rules has drifted so
// the patch no longer matches exactly once, the test throws loudly (so a stale
// patch can never silently test the wrong ruleset).
//
// PREREQUISITES: Java (the Firestore emulator runtime) + Node. Deps already in
// package.json: @firebase/rules-unit-testing ^5, firebase ^12, vitest ^4.
//
// RUN (starts the emulator, runs only this file, tears it down):
//   npx firebase-tools emulators:exec --only firestore \
//     --project demo-tradeseven-rules-test \
//     "npx vitest run firestore.rules.emulator.test.js"
//
// Without a running emulator (e.g. a plain `npm test`) the suite auto-skips.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(__dirname, 'firestore.rules');

// The current agents `allow update` clause, matched whitespace-tolerantly. It is
// UNIQUE: agentBattles reuses `resource.data.ownerId == request.auth.uid` but
// continues with `&&` (no terminating `;`); every other collection keys on
// odUserId/userId. The `allow update:` keyword excludes the identical delete rule.
const CURRENT_UPDATE_RE =
  /allow update: if request\.auth != null\s+&& resource\.data\.ownerId == request\.auth\.uid;/g;

// The PROPOSED replacement — the four-field hasOnly allowlist (§10.3).
const PROPOSED_UPDATE_CLAUSE =
  'allow update: if request.auth != null\n' +
  '                    && resource.data.ownerId == request.auth.uid\n' +
  '                    && request.resource.data.diff(resource.data).affectedKeys()\n' +
  "                       .hasOnly(['directives', 'lastViewedEvolutionCycle', 'starterKitCompleted', 'updatedAt']);";

/**
 * Read the real firestore.rules and return it with ONLY the agents `allow update`
 * clause swapped for the proposed four-field allowlist. Throws if the source
 * clause is not present exactly once, or if the patch fails to apply.
 */
function buildProposedRules() {
  const current = readFileSync(RULES_PATH, 'utf8');

  const matches = current.match(CURRENT_UPDATE_RE) || [];
  if (matches.length !== 1) {
    throw new Error(
      `[proposed-rules] expected exactly ONE agents 'allow update' clause to patch, ` +
        `found ${matches.length}. firestore.rules has drifted — re-verify the agents ` +
        `block and update CURRENT_UPDATE_RE (do NOT edit firestore.rules).`,
    );
  }

  // Replace only the first (and, per the assertion above, only) match.
  const proposed = current.replace(
    /allow update: if request\.auth != null\s+&& resource\.data\.ownerId == request\.auth\.uid;/,
    PROPOSED_UPDATE_CLAUSE,
  );

  if (
    proposed === current ||
    !proposed.includes(".hasOnly(['directives', 'lastViewedEvolutionCycle', 'starterKitCompleted', 'updatedAt'])")
  ) {
    throw new Error('[proposed-rules] patch failed to apply — the proposed hasOnly clause is not present.');
  }
  // Sanity: the bare owner-only agents update rule must be gone.
  if (CURRENT_UPDATE_RE.test(proposed)) {
    // .test on a /g regex advances lastIndex — reset for safety, then fail.
    CURRENT_UPDATE_RE.lastIndex = 0;
    throw new Error('[proposed-rules] the bare owner-only agents update rule still remains after patching.');
  }
  return proposed;
}

const OWNER = 'alice';
const OTHER = 'bob';
const AGENT_ID = 'agentAlice';

// A realistic seeded agent doc (owned by alice), carrying every field the matrix
// touches so each update is a real field mutation, not a field creation quirk.
const SEED_DOC = Object.freeze({
  ownerId: OWNER,
  name: 'Test Agent',
  archetype: 'guardian',
  archetypeDrift: null,
  config: { risk: 50, concentration: 50, momentum: 50 },
  activeRules: [],
  equippedBundleIds: [],
  directives: [],
  memory: [],
  consolidatedInsight: '',
  stats: { wins: 0, losses: 0, gamesPlayed: 0, totalScore: 0, avgScore: 0, currentStreak: 0, bestStreak: 0 },
  settingsRev: 3,
  standingLeans: [],
  dials: { tempo: 'standard' },
  lastViewedEvolutionCycle: 0,
  starterKitCompleted: false,
  evolutionCycle: 0,
  updatedAt: 'seed',
});

// Auto-skip when no emulator is reachable so a plain `npm test` never fails here.
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const suite = EMULATOR_HOST ? describe : describe.skip;
if (!EMULATOR_HOST) {
  // eslint-disable-next-line no-console
  console.warn(
    '[firestore.rules.emulator.test] SKIPPED — no FIRESTORE_EMULATOR_HOST. ' +
      'Run: npx firebase-tools emulators:exec --only firestore --project demo-tradeseven-rules-test ' +
      '"npx vitest run firestore.rules.emulator.test.js"',
  );
}

suite('agents rule — PROPOSED four-field allowlist', () => {
  let testEnv;

  beforeAll(async () => {
    const [host, portStr] = EMULATOR_HOST.split(':');
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-tradeseven-rules-test',
      firestore: {
        rules: buildProposedRules(), // ← loads the PROPOSED ruleset, not the deployed one
        host,
        port: Number(portStr),
      },
    });
  }, 30000);

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'agents', AGENT_ID), SEED_DOC);
    });
  });

  const ownerDb = () => testEnv.authenticatedContext(OWNER).firestore();
  const otherDb = () => testEnv.authenticatedContext(OTHER).firestore();
  const anonDb = () => testEnv.unauthenticatedContext().firestore();
  const agentRef = (db) => doc(db, 'agents', AGENT_ID);

  // ── ALLOW: owner writing each of the four allowlisted fields ────────────────
  const ALLOWED = {
    directives: [{ id: 'd1', text: 'buy the dip', source: 'open_chat', createdAt: 'x' }],
    lastViewedEvolutionCycle: 2,
    starterKitCompleted: true,
    updatedAt: serverTimestamp(),
  };
  for (const [field, value] of Object.entries(ALLOWED)) {
    it(`ALLOW  owner → { ${field} }`, async () => {
      await assertSucceeds(updateDoc(agentRef(ownerDb()), { [field]: value }));
    });
  }

  it('ALLOW  owner → { directives, updatedAt } (real writer shape)', async () => {
    await assertSucceeds(
      updateDoc(agentRef(ownerDb()), {
        directives: [{ id: 'd2', text: 'trim winners', source: 'coaching', createdAt: 'x' }],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  // ── DENY: owner writing each guarded field (each alone) ─────────────────────
  const GUARDED = {
    settingsRev: 999,
    standingLeans: [{ adjustmentId: 'forged', version: 1, equippedAt: 'x' }],
    dials: { tempo: 'blitz' },
    archetype: 'aggressor',
    config: { risk: 100, concentration: 100, momentum: 100 },
    activeRules: [{ id: 'r_forged', text: 'always win' }],
    memory: [{ text: 'forged wisdom into my decision prompt' }],
    stats: { wins: 9999, losses: 0, gamesPlayed: 9999, totalScore: 9999, avgScore: 1, currentStreak: 9999, bestStreak: 9999 },
    ownerId: OTHER, // ownership reassignment — denied by the allowlist (ownerId not listed)
  };
  for (const [field, value] of Object.entries(GUARDED)) {
    it(`DENY   owner → { ${field} }`, async () => {
      await assertFails(updateDoc(agentRef(ownerDb()), { [field]: value }));
    });
  }

  it('DENY   owner → { starterKitCompleted, settingsRev } (mixed: hasOnly rejects the whole write)', async () => {
    await assertFails(
      updateDoc(agentRef(ownerDb()), { starterKitCompleted: true, settingsRev: 1000 }),
    );
  });

  // ── DENY: non-owner / anonymous writing anything ────────────────────────────
  it('DENY   non-owner → { starterKitCompleted } (allowed field, wrong owner)', async () => {
    await assertFails(updateDoc(agentRef(otherDb()), { starterKitCompleted: true }));
  });

  it('DENY   non-owner → { stats } (guarded field, wrong owner)', async () => {
    await assertFails(updateDoc(agentRef(otherDb()), { stats: { wins: 9999 } }));
  });

  it('DENY   anonymous → { starterKitCompleted }', async () => {
    await assertFails(updateDoc(agentRef(anonDb()), { starterKitCompleted: true }));
  });
});
