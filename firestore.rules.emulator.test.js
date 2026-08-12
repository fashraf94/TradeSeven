// @vitest-environment node
//
// firestore.rules.emulator.test.js
// ─────────────────────────────────────────────────────────────────────────────
// PROPOSED rules hardening — emulator verification. TWO independent proposals:
//
// 1. AGENTS field-allowlist (docs/audits/2026-07-15_FIRESTORE_RULES_AGENTS_
//    DISCOVERY.md §10.3): a client may update the agents/{id} doc ONLY with
//    the four-field allowlist
//     ['directives', 'lastViewedEvolutionCycle', 'starterKitCompleted', 'updatedAt']
//    and every guarded field (settingsRev, standingLeans, dials, archetype,
//    config, activeRules, memory, stats) plus ownerId is denied — while
//    non-owners and anonymous callers are denied entirely.
//
// 2. BUNDLES field-allowlist + equipped-value deny (WS1 enforce Phase 2, the
//    Phase-0 writer census): a client may create/update agents/{id}/bundles
//    docs ONLY with the census's 20 legitimate client fields — ruleHardness
//    is EXCLUDED (server-mintable only: set-rule-hardness / reforge-bundle
//    endpoints) — and a client write may never SET status to 'equipped'
//    (value-level deny; equipping is the equip-bundle endpoint's transaction).
//    Writes not touching status on an already-equipped doc still pass (the
//    dimensions persist-on-launch case), so the value-gate is surgical.
//
// READ-ONLY: this test does NOT modify the deployed firestore.rules. It reads the
// real firestore.rules, applies each PROPOSED clause IN MEMORY, and loads the
// patched string into the emulator. If firestore.rules has drifted so a patch
// no longer matches exactly once, the test throws loudly (so a stale patch can
// never silently test the wrong ruleset). Each suite loads ITS OWN patch, so
// the two proposals verify independently.
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
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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
 *
 * PROPOSAL LANDED (commit 3b5bfc19 "Enhance update rule with field
 * restrictions"): the four-field hasOnly clause now lives in firestore.rules
 * itself. When detected, there is nothing to patch — the matrix verifies the
 * LIVE ruleset (which is exactly what the suite should assert post-publish).
 * True drift (neither the old bare clause nor the landed allowlist) still
 * throws loudly below.
 */
function buildProposedRules() {
  const current = readFileSync(RULES_PATH, 'utf8');

  if (current.includes(".hasOnly(['directives', 'lastViewedEvolutionCycle', 'starterKitCompleted', 'updatedAt'])")) {
    return current; // the proposal is live in the file — verify as-is
  }

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

// ═════════════════════════════════════════════════════════════════════════════
// BUNDLES — proposed field allowlist + equipped-value deny (WS1 enforce Phase 2)
// ═════════════════════════════════════════════════════════════════════════════

// The Phase-0 census's 20 legitimate client-writable bundle fields — the
// 21-field union MINUS ruleHardness (server-mintable only).
const BUNDLE_CLIENT_FIELDS = [
  'name', 'version', 'previousVersionId', 'status', 'ruleIds', 'ruleSnapshots',
  'conflictCheckResult', 'createdAt', 'forgedAt', 'equippedAt', 'archivedAt',
  'updatedAt', 'performanceData', 'entrySource', 'hiddenFromBundleList',
  'dimensionHash', 'dimensionValues', 'dimensionSchemaVersion',
  'compileConfidence', 'compileTransparency',
];

const FIELD_LIST_LITERAL = `[${BUNDLE_CLIENT_FIELDS.map((f) => `'${f}'`).join(', ')}]`;

// The current bundles block (read + the shared owner-only create,update
// clause), matched whitespace-tolerantly and ANCHORED on the /bundles/ match
// header — the rules subcollection shares the clause's first lines but its
// create,update continues with field validation instead of terminating.
const CURRENT_BUNDLES_BLOCK_RE =
  /(match \/bundles\/\{bundleId\} \{\s+allow read: if request\.auth != null\s+&& get\(\/databases\/\$\(database\)\/documents\/agents\/\$\(agentId\)\)\.data\.ownerId == request\.auth\.uid;\s+)allow create, update: if request\.auth != null\s+&& get\(\/databases\/\$\(database\)\/documents\/agents\/\$\(agentId\)\)\.data\.ownerId == request\.auth\.uid;/g;

// The PROPOSED replacement: split create/update, hasOnly the census fields,
// and deny the 'equipped' VALUE only when the write itself sets status (the
// surgical value-gate — untouched-status updates on an equipped doc pass).
const PROPOSED_BUNDLES_CLAUSE =
  'allow create: if request.auth != null\n' +
  '                    && get(/databases/$(database)/documents/agents/$(agentId)).data.ownerId == request.auth.uid\n' +
  `                    && request.resource.data.keys().hasOnly(${FIELD_LIST_LITERAL})\n` +
  "                    && (!('status' in request.resource.data) || request.resource.data.status != 'equipped');\n" +
  '        allow update: if request.auth != null\n' +
  '                    && get(/databases/$(database)/documents/agents/$(agentId)).data.ownerId == request.auth.uid\n' +
  `                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(${FIELD_LIST_LITERAL})\n` +
  "                    && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['status'])\n" +
  "                        || request.resource.data.status != 'equipped');";

/**
 * Read the real firestore.rules and return it with ONLY the bundles
 * create,update clause swapped for the proposed allowlist + value deny.
 * Throws if the bundles block is not present exactly once.
 */
function buildProposedBundlesRules() {
  const current = readFileSync(RULES_PATH, 'utf8');

  // PROPOSAL LANDED detection (symmetric with buildProposedRules): once the
  // bundles allowlist + equipped-value deny is published into firestore.rules
  // (runbook §2 syncs the repo file to the Console), there is nothing to
  // patch — verify the LIVE ruleset as-is. Its unique marker is the
  // status-value deny, which the pre-proposal owner-only clause never had.
  if (current.includes("request.resource.data.status != 'equipped'")) {
    return current;
  }

  const matches = current.match(CURRENT_BUNDLES_BLOCK_RE) || [];
  if (matches.length !== 1) {
    throw new Error(
      `[proposed-bundles-rules] expected exactly ONE bundles block to patch, ` +
        `found ${matches.length}. firestore.rules has drifted — re-verify the bundles ` +
        `block and update CURRENT_BUNDLES_BLOCK_RE (do NOT edit firestore.rules).`,
    );
  }
  CURRENT_BUNDLES_BLOCK_RE.lastIndex = 0;

  const proposed = current.replace(CURRENT_BUNDLES_BLOCK_RE, `$1${PROPOSED_BUNDLES_CLAUSE}`);
  CURRENT_BUNDLES_BLOCK_RE.lastIndex = 0;

  if (proposed === current || !proposed.includes("request.resource.data.status != 'equipped'")) {
    throw new Error('[proposed-bundles-rules] patch failed to apply — the proposed clause is not present.');
  }
  return proposed;
}

const BUNDLE_ID = 'bundleDraft1';
const EQUIPPED_BUNDLE_ID = 'bundleEquipped1';

// A realistic seeded draft bundle carrying every allowlisted field, so each
// update is a real field mutation. ruleHardness is seeded too (server-owned
// data at rest) so the DENY cases mutate an EXISTING field, not create one.
const SEED_BUNDLE = Object.freeze({
  name: 'Test Bundle',
  version: 1,
  previousVersionId: null,
  status: 'draft',
  ruleIds: ['r1', 'r2'],
  ruleHardness: { r1: 'soft' },
  ruleSnapshots: [],
  conflictCheckResult: null,
  createdAt: 'seed',
  forgedAt: null,
  equippedAt: null,
  archivedAt: null,
  updatedAt: 'seed',
  performanceData: { battlesEquipped: 0, totalCitations: 0, successfulCitations: 0 },
  entrySource: 'forge',
  hiddenFromBundleList: false,
  dimensionHash: 'h0',
  dimensionValues: { risk: 1 },
  dimensionSchemaVersion: 1,
  compileConfidence: 0.5,
  compileTransparency: { warnings: [] },
});

suite('bundles rule — PROPOSED field allowlist + equipped-value deny', () => {
  let testEnv;

  beforeAll(async () => {
    const [host, portStr] = EMULATOR_HOST.split(':');
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-tradeseven-rules-test',
      firestore: {
        rules: buildProposedBundlesRules(), // ← the BUNDLES proposal only
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
      await setDoc(doc(ctx.firestore(), 'agents', AGENT_ID, 'bundles', BUNDLE_ID), SEED_BUNDLE);
      await setDoc(doc(ctx.firestore(), 'agents', AGENT_ID, 'bundles', EQUIPPED_BUNDLE_ID), {
        ...SEED_BUNDLE, status: 'equipped', equippedAt: 'seed',
      });
    });
  });

  const ownerDb = () => testEnv.authenticatedContext(OWNER).firestore();
  const otherDb = () => testEnv.authenticatedContext(OTHER).firestore();
  const anonDb = () => testEnv.unauthenticatedContext().firestore();
  const bundleRef = (db, id = BUNDLE_ID) => doc(db, 'agents', AGENT_ID, 'bundles', id);

  // ── ALLOW: owner updating each of the 20 allowlisted fields ────────────────
  const ALLOWED_UPDATES = {
    name: 'Renamed Bundle',
    version: 2,
    previousVersionId: 'someOldId',
    status: 'draft', // the value-gate's ALLOW side — proven surgical below
    ruleIds: ['r1', 'r2', 'r3'],
    ruleSnapshots: [{ id: 'r1', text: 't', category: 'technical', visibility: 'private' }],
    conflictCheckResult: { conflicts: [] },
    createdAt: serverTimestamp(),
    forgedAt: '2026-07-16T00:00:00.000Z',
    equippedAt: null,
    archivedAt: '2026-07-16T00:00:00.000Z',
    updatedAt: serverTimestamp(),
    performanceData: { battlesEquipped: 1, totalCitations: 2, successfulCitations: 1 },
    entrySource: 'dimensions',
    hiddenFromBundleList: true,
    dimensionHash: 'h1',
    dimensionValues: { risk: 2 },
    dimensionSchemaVersion: 1,
    compileConfidence: 0.9,
    compileTransparency: { warnings: ['w'], mappingNotes: [], appliedClamps: [] },
  };
  for (const [field, value] of Object.entries(ALLOWED_UPDATES)) {
    it(`ALLOW  owner update → { ${field} }`, async () => {
      await assertSucceeds(updateDoc(bundleRef(ownerDb()), { [field]: value }));
    });
  }

  // ── ALLOW: the real creator shapes ──────────────────────────────────────────
  it('ALLOW  owner create → the createBundle shape (post-Phase-2: NO ruleHardness field)', async () => {
    await assertSucceeds(
      setDoc(bundleRef(ownerDb(), 'newDraft1'), {
        name: 'New Bundle', version: 1, previousVersionId: null, status: 'draft',
        ruleIds: [], ruleSnapshots: [], conflictCheckResult: null,
        createdAt: serverTimestamp(), forgedAt: null, equippedAt: null, archivedAt: null,
        performanceData: { battlesEquipped: 0, totalCitations: 0, successfulCitations: 0 },
      }),
    );
  });

  it("ALLOW  owner create → the dimensions-compile shape (status 'forged', entrySource/hiddenFromBundleList/dimensionHash)", async () => {
    await assertSucceeds(
      setDoc(bundleRef(ownerDb(), 'dimBundle1'), {
        name: 'Strategy Dimensions', version: 1, previousVersionId: null, status: 'forged',
        ruleIds: ['dim-a'], ruleSnapshots: [{ id: 'dim-a', text: 't', category: 'technical', visibility: 'private' }],
        conflictCheckResult: null, entrySource: 'dimensions', hiddenFromBundleList: true,
        dimensionHash: 'abc', createdAt: serverTimestamp(), forgedAt: serverTimestamp(),
        equippedAt: null, archivedAt: null, updatedAt: serverTimestamp(),
        performanceData: { battlesEquipped: 0, totalCitations: 0, successfulCitations: 0 },
      }),
    );
  });

  // ── DENY: ruleHardness in every write shape (the WS1 enforce blocker) ───────
  it('DENY   owner update → { ruleHardness } (whole map)', async () => {
    await assertFails(updateDoc(bundleRef(ownerDb()), { ruleHardness: { r1: 'hard' } }));
  });

  it("DENY   owner update → { 'ruleHardness.r1' } (dotted path — affectedKeys reports the top-level key)", async () => {
    await assertFails(updateDoc(bundleRef(ownerDb()), { 'ruleHardness.r1': 'hard' }));
  });

  it('DENY   owner update → { name, ruleHardness } (mixed: hasOnly rejects the whole write)', async () => {
    await assertFails(updateDoc(bundleRef(ownerDb()), { name: 'X', ruleHardness: { r1: 'hard' } }));
  });

  it('DENY   owner create → a bundle doc INCLUDING ruleHardness', async () => {
    await assertFails(
      setDoc(bundleRef(ownerDb(), 'newDraft2'), {
        name: 'New Bundle', version: 1, previousVersionId: null, status: 'draft',
        ruleIds: [], ruleHardness: {}, ruleSnapshots: [], conflictCheckResult: null,
        createdAt: serverTimestamp(), forgedAt: null, equippedAt: null, archivedAt: null,
        performanceData: { battlesEquipped: 0, totalCitations: 0, successfulCitations: 0 },
      }),
    );
  });

  // ── the status VALUE-gate (surgical: field allowed, one value denied) ───────
  it("ALLOW  owner update → { status: 'forged' } and { status: 'archived' } (legitimate client transitions)", async () => {
    await assertSucceeds(updateDoc(bundleRef(ownerDb()), { status: 'forged' }));
    await assertSucceeds(updateDoc(bundleRef(ownerDb()), { status: 'archived' }));
  });

  it("DENY   owner update → { status: 'equipped' } (self-equip bypasses the equip transaction)", async () => {
    await assertFails(updateDoc(bundleRef(ownerDb()), { status: 'equipped' }));
  });

  it("DENY   owner create → { status: 'equipped' } (born-equipped)", async () => {
    await assertFails(
      setDoc(bundleRef(ownerDb(), 'newDraft3'), {
        name: 'New Bundle', version: 1, previousVersionId: null, status: 'equipped',
        ruleIds: [], ruleSnapshots: [], conflictCheckResult: null,
        createdAt: serverTimestamp(), forgedAt: null, equippedAt: null, archivedAt: null,
        performanceData: { battlesEquipped: 0, totalCitations: 0, successfulCitations: 0 },
      }),
    );
  });

  it('ALLOW  owner update NOT touching status on an EQUIPPED doc (the dimensions persist-on-launch case — the value-gate is surgical)', async () => {
    await assertSucceeds(
      updateDoc(bundleRef(ownerDb(), EQUIPPED_BUNDLE_ID), {
        dimensionValues: { risk: 3 },
        dimensionSchemaVersion: 1,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  // ── DENY: non-owner / anonymous ─────────────────────────────────────────────
  it('DENY   non-owner update → { name } (allowed field, wrong owner)', async () => {
    await assertFails(updateDoc(bundleRef(otherDb()), { name: 'X' }));
  });

  it('DENY   anonymous update → { name }', async () => {
    await assertFails(updateDoc(bundleRef(anonDb()), { name: 'X' }));
  });

  // ── delete stays denied (unchanged clause, asserted for completeness) ───────
  it('DENY   owner delete (no hard deletes — archive instead)', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(bundleRef(ownerDb())));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SPEC 1 — THE MANDATE (§2.4): owner-READ on books + subcollections + userMeta;
// ALL client writes DENIED (Admin SDK only); archetypeVintages is Admin-only.
// Verifies the LIVE ruleset (readFileSync of firestore.rules, no patch).
// Auto-skips without FIRESTORE_EMULATOR_HOST; runs in `npm run test:rules`.
// ═══════════════════════════════════════════════════════════════════════════
suite('mandate rules — owner-read; ALL client writes denied (§2.4)', () => {
  let testEnv;
  const MANDATE_ID = 'MID_alice';

  beforeAll(async () => {
    const [host, portStr] = EMULATOR_HOST.split(':');
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-tradeseven-rules-test',
      firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host, port: Number(portStr) },
    });
  }, 30000);

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'mandates', MANDATE_ID), { userId: OWNER, status: 'active', schemaVersion: 1 });
      await setDoc(doc(db, 'mandates', MANDATE_ID, 'dailyRows', '2026-08-12'), { date: '2026-08-12', schemaVersion: 1 });
      await setDoc(doc(db, 'mandates', MANDATE_ID, 'decisions', 'd1'), { schemaVersion: 1 });
      await setDoc(doc(db, 'mandates', MANDATE_ID, 'quarterSummaries', '1'), { quarterIndex: 1, schemaVersion: 1 });
      await setDoc(doc(db, 'userMeta', OWNER), { activeMandateId: MANDATE_ID, mandateEscapeHatchUsed: false });
      await setDoc(doc(db, 'archetypeVintages', 'contrarian_hash'), { codeId: 'contrarian' });
    });
  });

  const ownerDb = () => testEnv.authenticatedContext(OWNER).firestore();
  const otherDb = () => testEnv.authenticatedContext(OTHER).firestore();
  const anonDb = () => testEnv.unauthenticatedContext().firestore();
  const mRef = (db) => doc(db, 'mandates', MANDATE_ID);
  const subRef = (db, sub, id) => doc(db, 'mandates', MANDATE_ID, sub, id);
  const metaRef = (db) => doc(db, 'userMeta', OWNER);

  // ── READ: owner allowed ─────────────────────────────────────────────────────
  it('ALLOW  owner reads own book + subcollections + userMeta', async () => {
    await assertSucceeds(getDoc(mRef(ownerDb())));
    await assertSucceeds(getDoc(subRef(ownerDb(), 'dailyRows', '2026-08-12')));
    await assertSucceeds(getDoc(subRef(ownerDb(), 'decisions', 'd1')));
    await assertSucceeds(getDoc(subRef(ownerDb(), 'quarterSummaries', '1')));
    await assertSucceeds(getDoc(metaRef(ownerDb())));
  });

  // ── READ: non-owner / anonymous denied ──────────────────────────────────────
  it('DENY   non-owner reads the book / subcollection / userMeta', async () => {
    await assertFails(getDoc(mRef(otherDb())));
    await assertFails(getDoc(subRef(otherDb(), 'dailyRows', '2026-08-12')));
    await assertFails(getDoc(metaRef(otherDb())));
  });
  it('DENY   anonymous reads the book / userMeta', async () => {
    await assertFails(getDoc(mRef(anonDb())));
    await assertFails(getDoc(metaRef(anonDb())));
  });

  // ── WRITE: ALL denied (Admin SDK only) ──────────────────────────────────────
  it('DENY   owner writes own book (create + update both denied)', async () => {
    await assertFails(setDoc(mRef(ownerDb()), { userId: OWNER, hacked: true }));
    await assertFails(updateDoc(mRef(ownerDb()), { status: 'closed' }));
  });
  it('DENY   owner writes subcollections + userMeta', async () => {
    await assertFails(setDoc(subRef(ownerDb(), 'decisions', 'd2'), { forged: true }));
    await assertFails(updateDoc(metaRef(ownerDb()), { activeMandateId: 'other' }));
  });
  it('DENY   non-owner + anonymous write anything', async () => {
    await assertFails(updateDoc(mRef(otherDb()), { status: 'closed' }));
    await assertFails(setDoc(metaRef(anonDb()), { activeMandateId: 'x' }));
  });

  // ── archetypeVintages: Admin only (no client read or write) ─────────────────
  it('DENY   everyone reads/writes archetypeVintages (Admin SDK only)', async () => {
    await assertFails(getDoc(doc(ownerDb(), 'archetypeVintages', 'contrarian_hash')));
    await assertFails(getDoc(doc(anonDb(), 'archetypeVintages', 'contrarian_hash')));
    await assertFails(setDoc(doc(ownerDb(), 'archetypeVintages', 'x'), { y: 1 }));
  });
});
