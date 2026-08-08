// test/rules/compositionEpochDenials.rules.mjs
//
// Composition PR 2 — the CLIENT-SDK write-epoch fence, proven against the
// REAL rules engine (design note §3, client-writer class; the A41 analogue
// for writers no server chokepoint can reach). epochWriteOpen() gates agent
// births and rules/bundles authoring:
//
//   • composition/writeEpoch ABSENT  → every gated write behaves EXACTLY as
//     today (fail-open; the dark posture — also proven by the untouched 114
//     pre-existing rules tests, which run with no epoch doc).
//   • {state:'open'}                 → writes admitted ONLY with the epoch
//     TOKEN (Sol re-review #1): the doc must carry writeEpochId equal to
//     the current epochId — a mutation FORMED under E0 and submitted after
//     E1 opens is DENIED at commit, and a tokenless write denies too.
//   • {state:'probe'}                → the #4 probe-only gate: ONLY a uid in
//     probeIdentities, with the current token, writes (the 8B / Rollback-B
//     verification windows).
//   • {state:'closed'}               → rule/bundle authoring + agent births
//     DENIED at commit, while NON-identity writes (agent directives) still
//     pass — the fence is surgical, not a global freeze.
//   • the epoch doc itself is never client-writable.
//
// Run via: npm run test:rules

import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// B9 (PR 4): the runbook's deploy-record-smoke gate runs this suite against
// the DEPLOYED rules text, not the repo text — export the fetched text to a
// file and point COMPOSITION_RULES_TEXT_PATH at it (the gate records that
// file's sha256 as smoke.rulesTextSha256). Default: the repo text (CI).
const RULES_PATH = process.env.COMPOSITION_RULES_TEXT_PATH
  ? resolve(process.env.COMPOSITION_RULES_TEXT_PATH)
  : resolve(__dirname, '../../firestore.rules');

const OWNER_UID = 'composition-owner-1';
const AGENT_PATH = `agents/comp-agent-1`;
const EPOCH_PATH = 'composition/writeEpoch';

let testEnv;

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

// The exact live createAgent shape the existing agents-create rule admits
// (mirrors masteryDenials' createAgent fixture discipline).
const CREATE_AGENT_DOC = {
  ownerId: OWNER_UID,
  name: 'Comp Agent',
  archetype: 'degen',
  personality: {},
  config: { risk: 50 },
  activeRules: [],
  equippedBundleIds: [],
  memory: [],
  consolidatedInsight: '',
  stats: { wins: 0, losses: 0, gamesPlayed: 0, totalScore: 0, avgScore: 0, currentStreak: 0, bestStreak: 0 },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const RULE_DOC = { text: 'Test rule', paramValues: { pct: 50 }, status: 'active', provenance: 'user_equipped' };
const BUNDLE_DOC = { name: 'B', status: 'draft', ruleIds: [], ruleSnapshots: [], createdAt: 'x', updatedAt: 'x' };

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-tradeseven-rules',
    firestore: { rules: readFileSync(RULES_PATH, 'utf8') },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });
beforeEach(async () => { await testEnv.clearFirestore(); });

const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();

describe('epoch ABSENT — fail-open: everything behaves as today (dark posture)', () => {
  it('agent create, rule create, bundle create all succeed with no epoch doc', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), AGENT_PATH), CREATE_AGENT_DOC));
    await assertSucceeds(setDoc(doc(asOwner(), `${AGENT_PATH}/rules/r1`), RULE_DOC));
    await assertSucceeds(setDoc(doc(asOwner(), `${AGENT_PATH}/bundles/b1`), BUNDLE_DOC));
  });
});

describe('epoch OPEN — writes admitted WITH the current token (#1)', () => {
  it('rule + bundle authoring + agent birth succeed carrying writeEpochId == the current epochId', async () => {
    await seed(EPOCH_PATH, { state: 'open', epochId: 'e-1' });
    await assertSucceeds(setDoc(doc(asOwner(), AGENT_PATH), { ...CREATE_AGENT_DOC, writeEpochId: 'e-1' }));
    await assertSucceeds(setDoc(doc(asOwner(), `${AGENT_PATH}/rules/r1`), { ...RULE_DOC, writeEpochId: 'e-1' }));
    await assertSucceeds(setDoc(doc(asOwner(), `${AGENT_PATH}/bundles/b1`), { ...BUNDLE_DOC, writeEpochId: 'e-1' }));
  });

  it('#1 THE STRADDLE: a mutation formed under E0 submitted after E1 opens is DENIED — and a tokenless write denies too', async () => {
    await seed(EPOCH_PATH, { state: 'open', epochId: 'e-1' });
    // Formed under the OLD epoch (token e-0), submitted under e-1:
    await assertFails(setDoc(doc(asOwner(), AGENT_PATH), { ...CREATE_AGENT_DOC, writeEpochId: 'e-0' }));
    await assertFails(setDoc(doc(asOwner(), `${AGENT_PATH}/rules/r1`), { ...RULE_DOC, writeEpochId: 'e-0' }));
    await assertFails(setDoc(doc(asOwner(), `${AGENT_PATH}/bundles/b1`), { ...BUNDLE_DOC, writeEpochId: 'e-0' }));
    // No token at all (a pre-token client straddling the deploy): DENIED.
    await assertFails(setDoc(doc(asOwner(), `${AGENT_PATH}/rules/r2`), RULE_DOC));
  });
});

describe("epoch PROBE — the #4 probe-only gate (8B / Rollback-B), client half", () => {
  it('a LISTED probe identity with the current token writes; the same uid UNLISTED is denied; a listed uid with a stale token is denied', async () => {
    await seed(EPOCH_PATH, { state: 'probe', epochId: 'e-1', probeIdentities: [OWNER_UID] });
    await assertSucceeds(setDoc(doc(asOwner(), AGENT_PATH), { ...CREATE_AGENT_DOC, writeEpochId: 'e-1' }));
    await assertSucceeds(setDoc(doc(asOwner(), `${AGENT_PATH}/rules/r1`), { ...RULE_DOC, writeEpochId: 'e-1' }));
    // Listed but formed under the wrong epoch:
    await assertFails(setDoc(doc(asOwner(), `${AGENT_PATH}/rules/r2`), { ...RULE_DOC, writeEpochId: 'e-0' }));
    // The negative control: the gate names someone else — this uid is OUT.
    await seed(EPOCH_PATH, { state: 'probe', epochId: 'e-1', probeIdentities: ['some-other-operator'] });
    await assertFails(setDoc(doc(asOwner(), `${AGENT_PATH}/rules/r3`), { ...RULE_DOC, writeEpochId: 'e-1' }));
    await assertFails(setDoc(doc(asOwner(), `${AGENT_PATH}/bundles/b2`), { ...BUNDLE_DOC, writeEpochId: 'e-1' }));
  });
});

describe('epoch CLOSED — identity authoring DENIED at commit; non-identity writes survive', () => {
  it('agent birth denied', async () => {
    await seed(EPOCH_PATH, { state: 'closed', epochId: 'e-2' });
    await assertFails(setDoc(doc(asOwner(), AGENT_PATH), CREATE_AGENT_DOC));
  });
  it('rule authoring (create + update) denied', async () => {
    await seed(AGENT_PATH, CREATE_AGENT_DOC);
    await seed(`${AGENT_PATH}/rules/r1`, RULE_DOC);
    await seed(EPOCH_PATH, { state: 'closed', epochId: 'e-2' });
    await assertFails(setDoc(doc(asOwner(), `${AGENT_PATH}/rules/r2`), RULE_DOC));
    await assertFails(updateDoc(doc(asOwner(), `${AGENT_PATH}/rules/r1`), { paramValues: { pct: 60 } }));
  });
  it('bundle authoring (create + update) denied', async () => {
    await seed(AGENT_PATH, CREATE_AGENT_DOC);
    await seed(`${AGENT_PATH}/bundles/b1`, BUNDLE_DOC);
    await seed(EPOCH_PATH, { state: 'closed', epochId: 'e-2' });
    await assertFails(setDoc(doc(asOwner(), `${AGENT_PATH}/bundles/b2`), BUNDLE_DOC));
    await assertFails(updateDoc(doc(asOwner(), `${AGENT_PATH}/bundles/b1`), { name: 'renamed' }));
  });
  it('a NON-identity agent update (directives — the update allowlist) still passes: the fence is surgical', async () => {
    await seed(AGENT_PATH, CREATE_AGENT_DOC);
    await seed(EPOCH_PATH, { state: 'closed', epochId: 'e-2' });
    await assertSucceeds(updateDoc(doc(asOwner(), AGENT_PATH), { directives: ['stay calm'], updatedAt: 'now' }));
  });
});

describe('the epoch control doc is server-only', () => {
  it('no client write to composition/writeEpoch, open or closed', async () => {
    await assertFails(setDoc(doc(asOwner(), EPOCH_PATH), { state: 'open' }));
    await seed(EPOCH_PATH, { state: 'open', epochId: 'e-1' });
    await assertFails(updateDoc(doc(asOwner(), EPOCH_PATH), { state: 'closed' }));
  });
});
