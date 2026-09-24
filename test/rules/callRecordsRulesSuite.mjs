// test/rules/callRecordsRulesSuite.mjs
//
// Cockpit Build 0 (docs/design/COCKPIT_SPEC_V1_3.md §3.10) — the shared body
// of the three owner-read call-record rules suites:
//   agentBattles/{battleId}/declarations/{evalId}
//   agentBattles/{battleId}/calls/{callId}
//   agentBattles/{battleId}/callObservations/{callId}
// Each mirrors intradayViews: READ by the parent battle's owner (via the
// parent's ownerId), WRITE by no client. Not a test file itself (no
// `.rules.mjs` suffix); each `<name>Denials.rules.mjs` calls it once.
//
// THE CLAIMS, per collection:
//   · the owner reads a document AND lists the collection (positive controls —
//     a misloaded or over-broad ruleset cannot pass by failing everything);
//   · another authenticated user, a privileged-claims context and an
//     unauthenticated client are denied both;
//   · a document under a MISSING parent battle is unreadable (fails closed);
//   · nobody — the owner included — can create, update, merge or delete;
//   · the rules text carries exactly one block for the path, saying exactly
//     the owner-read rule and `allow write: if false;`.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
// The deployed-ruleset knob every sibling honors (wireDenials.rules.mjs).
const RULES_PATH = process.env.COMPOSITION_RULES_TEXT_PATH
  ? resolve(process.env.COMPOSITION_RULES_TEXT_PATH)
  : resolve(__dirname, '../../firestore.rules');
export const RULES_TEXT = readFileSync(RULES_PATH, 'utf8');
const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');

const OWNER_UID = 'calls-owner-1';
const OTHER_UID = 'calls-intruder-2';
const PRIVILEGED_UID = 'calls-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };
const BATTLE_ID = 'battle-cr-1';
const BATTLE = `agentBattles/${BATTLE_ID}`;
const ORPHAN_BATTLE = 'agentBattles/battle-never-written';

const battle = () => ({ ownerId: OWNER_UID, agentId: 'agent-1', status: 'active', gameMode: 'baggerbomb_agent' });

/**
 * The statements of every `match <path> {` block whose path matches `pathRe`,
 * comments stripped, nested blocks included (a nested grant is a new surface).
 */
export function ruleBlocks(text, pathRe) {
  const blocks = [];
  const re = new RegExp(`match ${pathRe.source} \\{`, 'g');
  while (re.exec(text) !== null) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < text.length && depth > 0; i += 1) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') depth -= 1;
    }
    blocks.push(text.slice(re.lastIndex, i - 1).split('\n').map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean));
  }
  return blocks;
}

/** The exact owner-read block a call-record subcollection must carry. */
export const OWNER_READ_BLOCK = Object.freeze([
  'allow read: if request.auth != null',
  '&& get(/databases/$(database)/documents/agentBattles/$(battleId)).data.ownerId == request.auth.uid;',
  'allow write: if false;',
]);

/**
 * @param {object} p
 * @param {string} p.label       the suite's log tag
 * @param {string} p.sub         the subcollection under agentBattles/{battleId}
 * @param {string} p.idVar       the rules path variable name (evalId | callId)
 * @param {string} p.docId       a document id to seed
 * @param {() => object} p.record the document's own shape, as the server writes it
 * @param {object} p.patch       a field change a client might attempt
 * @param {string} p.orderField  the single field a Build 2 client orders by
 */
export function describeOwnerReadCallRecords({ label, sub, idVar, docId, record, patch, orderField }) {
  const DOC = `${BATTLE}/${sub}/${docId}`;
  const ORPHAN_DOC = `${ORPHAN_BATTLE}/${sub}/${docId}`;
  let testEnv;

  const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
  const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
  const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
  const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
  const asAnon = () => testEnv.unauthenticatedContext().firestore();

  beforeAll(async () => {
    console.log(`[${label}] loaded rules text: ${RULES_PATH}`);
    console.log(`[${label}] rules text sha256: ${RULES_SHA256}`);
    const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    const [emuHost, emuPort] = host.split(':');
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-tradeseven-rules',
      firestore: { rules: RULES_TEXT, host: emuHost, port: Number(emuPort) },
    });
  });
  afterAll(async () => { await testEnv?.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(BATTLE, battle());
    await seed(DOC, record());
    await seed(ORPHAN_DOC, record());
  });

  describe(`agentBattles/{battleId}/${sub}/{${idVar}} — read mirrors the parent battle's read rule`, () => {
    it('positive control: the owner reads the parent battle, a document, and the collection in order', async () => {
      await assertSucceeds(getDoc(doc(asOwner(), BATTLE)));
      await assertSucceeds(getDoc(doc(asOwner(), DOC)));
      await assertSucceeds(getDocs(query(collection(asOwner(), `${BATTLE}/${sub}`), orderBy(orderField, 'desc'))));
    });
    it('another authenticated user is denied the document and the collection', async () => {
      await assertFails(getDoc(doc(asOther(), DOC)));
      await assertFails(getDocs(collection(asOther(), `${BATTLE}/${sub}`)));
    });
    it('a privileged-claims context is denied — the rule is ownerId, never a claim', async () => {
      await assertFails(getDoc(doc(asPrivileged(), DOC)));
      await assertFails(getDocs(collection(asPrivileged(), `${BATTLE}/${sub}`)));
    });
    it('an unauthenticated client is denied', async () => {
      await assertFails(getDoc(doc(asAnon(), DOC)));
      await assertFails(getDocs(collection(asAnon(), `${BATTLE}/${sub}`)));
    });
    it('a document whose parent battle is missing is unreadable by anyone (fails closed)', async () => {
      await assertFails(getDoc(doc(asOwner(), ORPHAN_DOC)));
      await assertFails(getDoc(doc(asOther(), ORPHAN_DOC)));
    });
  });

  describe(`agentBattles/{battleId}/${sub}/{${idVar}} — client writes denied`, () => {
    for (const [who, ctx] of [['the owner', asOwner], ['another user', asOther], ['a privileged-claims context', asPrivileged], ['an unauthenticated client', asAnon]]) {
      it(`${who} cannot create, update, merge or delete`, async () => {
        await assertFails(setDoc(doc(ctx(), `${BATTLE}/${sub}/${docId}-new`), record()));
        await assertFails(updateDoc(doc(ctx(), DOC), patch));
        await assertFails(setDoc(doc(ctx(), DOC), patch, { merge: true }));
        await assertFails(deleteDoc(doc(ctx(), DOC)));
      });
    }
    it('the parent battle\'s own execution-control update still works for the owner (the sibling rule is untouched)', async () => {
      await assertSucceeds(updateDoc(doc(asOwner(), BATTLE), { executionMode: 'autopilot' }));
    });
  });

  describe('the posture is written down', () => {
    it(`ONE block for ${sub}, saying exactly the owner-read rule and \`allow write: if false;\``, () => {
      expect(ruleBlocks(RULES_TEXT, new RegExp(`/${sub}/\\{${idVar}\\}`))).toEqual([[...OWNER_READ_BLOCK]]);
    });
  });
}
