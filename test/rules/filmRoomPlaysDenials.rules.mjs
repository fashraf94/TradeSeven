// test/rules/filmRoomPlaysDenials.rules.mjs
//
// Film Room B2 item 4 (Build B spec §4; shared contract §5) — Firestore
// security-rules acceptance for agents/{agentId}/plays/{entryId}, the plays
// ledger. The rule reads the document's OWN ownerId (the tape precedent,
// filmTapeDenials.rules.mjs):
//   allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
//   allow write: if false;
//
// THE CLAIMS:
//   · the owner reads an entry AND lists the agent's entries when the list is
//     constrained to their own ownerId (positive controls — a misloaded or
//     over-broad ruleset cannot pass by failing everything);
//   · another authenticated user, a privileged-claims context and an
//     unauthenticated client are denied the entry and the list;
//   · an unconstrained list is denied even to the owner (rules are not filters),
//     and so is a list constrained to another user's ownerId;
//   · an entry whose ownerId is another user is denied even to the agent's
//     owner (the rule reads the document itself); an entry that does not exist
//     is unreadable (resource is null);
//   · nobody — the owner included — can create, update, merge or delete an
//     entry: every stage change is the card endpoint's (Admin SDK). Shelving is
//     computed at read, so no client ever needs a write;
//   · the rules text carries exactly this block, inside agents/{agentId}.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { createHash } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { RULES_TEXT, ruleBlocks } from './callRecordsRulesSuite.mjs';

const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');
const OWNER_UID = 'plays-owner-1';
const OTHER_UID = 'plays-intruder-2';
const PRIVILEGED_UID = 'plays-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const AGENT = 'agents/agent-plays-1';
const OTHER_AGENT = 'agents/agent-plays-2';
const ENTRY = `${AGENT}/plays/card_s1`;
const OTHER_ENTRY = `${OTHER_AGENT}/plays/card_t1`;
const PLANTED = `${AGENT}/plays/card_planted`;
const MISSING = `${AGENT}/plays/card_never_written`;
const ORPHAN_AGENT = 'agents/agent-never-written';
const ORPHAN_ENTRY = `${ORPHAN_AGENT}/plays/card_o1`;

const agent = (ownerId) => ({ ownerId, name: 'Aurora', archetype: 'momentum_chaser' });
// The entry as api/_utils/filmRoom/cardStore.js buildCardDoc writes it.
const entry = (agentId, ownerId, id = 'card_s1') => ({
  schemaVersion: 1, entryId: id, ownerId, agentId, createdAt: '2026-10-21T21:00:00.000Z', archetypeCodeId: 'momentum_chaser',
  situationId: 'stalled', situationVersion: 2, source: { battleId: 'b-1', etDate: '2026-10-20', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 },
  questionId: 'stalled.want', questionVersion: 1, note: 'Let it go sooner.', route: 'watch', slotsVersion: 1,
  stage: 'card', stageAt: '2026-10-21T21:00:00.000Z', stageHistory: [{ stage: 'card', at: '2026-10-21T21:00:00.000Z', by: 'player', opId: id }],
  version: 1, opId: id, opFingerprint: 'f'.repeat(64),
});

let testEnv;
const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const EVERYONE = [['the owner', asOwner], ['another user', asOther], ['a privileged-claims context', asPrivileged], ['an unauthenticated client', asAnon]];

beforeAll(async () => {
  console.log(`[filmRoomPlaysDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(AGENT, agent(OWNER_UID));
  await seed(ENTRY, entry('agent-plays-1', OWNER_UID));
  await seed(OTHER_AGENT, agent(OTHER_UID));
  await seed(OTHER_ENTRY, entry('agent-plays-2', OTHER_UID, 'card_t1'));
  // an entry under the owner's agent that names ANOTHER user as its owner (never written by the server; the rule reads the document)
  await seed(PLANTED, entry('agent-plays-1', OTHER_UID, 'card_planted'));
  // an entry whose parent agent does not exist — it still names its owner
  await seed(ORPHAN_ENTRY, entry('agent-never-written', OWNER_UID, 'card_o1'));
});

describe('agents/{agentId}/plays/{entryId} — read by the document\'s own ownerId', () => {
  it('positive control: the owner reads an entry, and lists the agent\'s entries constrained to their own ownerId (newest first included)', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), ENTRY)));
    const own = await assertSucceeds(getDocs(query(collection(asOwner(), `${AGENT}/plays`), where('ownerId', '==', OWNER_UID))));
    expect(own.docs.map((d) => d.ref.path)).toEqual([ENTRY]);   // the planted entry is another user's: not returned, and the list still admitted
    await assertSucceeds(getDocs(query(collection(asOwner(), `${AGENT}/plays`), where('ownerId', '==', OWNER_UID), orderBy('createdAt', 'desc'))));
  });
  it('another authenticated user is denied the entry and the list', async () => {
    await assertFails(getDoc(doc(asOther(), ENTRY)));
    await assertFails(getDocs(query(collection(asOther(), `${AGENT}/plays`), where('ownerId', '==', OWNER_UID))));
  });
  it('a privileged-claims context is denied — the rule is ownerId, never a claim', async () => {
    await assertFails(getDoc(doc(asPrivileged(), ENTRY)));
    await assertFails(getDocs(query(collection(asPrivileged(), `${AGENT}/plays`), where('ownerId', '==', OWNER_UID))));
  });
  it('an unauthenticated client is denied', async () => {
    await assertFails(getDoc(doc(asAnon(), ENTRY)));
    await assertFails(getDocs(query(collection(asAnon(), `${AGENT}/plays`), where('ownerId', '==', OWNER_UID))));
  });
  it('an UNCONSTRAINED list is denied even to the owner (rules are not filters), and so is a list of another user\'s entries', async () => {
    await assertFails(getDocs(collection(asOwner(), `${AGENT}/plays`)));
    await assertFails(getDocs(query(collection(asOwner(), `${AGENT}/plays`), where('ownerId', '==', OTHER_UID))));
    await assertFails(getDocs(query(collection(asOwner(), `${OTHER_AGENT}/plays`), where('ownerId', '==', OTHER_UID))));
  });
  it('the rule reads the document itself: an entry naming another user is denied to the agent\'s owner; a missing entry is unreadable', async () => {
    await assertFails(getDoc(doc(asOwner(), PLANTED)));
    await assertFails(getDoc(doc(asOwner(), MISSING)));
  });
  it('the posture, pinned: an entry under a missing parent agent is readable by the owner it names and by nobody else (the document is the rule)', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), ORPHAN_ENTRY)));
    await assertFails(getDoc(doc(asOther(), ORPHAN_ENTRY)));
    await assertFails(getDoc(doc(asAnon(), ORPHAN_ENTRY)));
  });
});

describe('plays — client writes denied (every stage change is the card endpoint\'s; shelving is computed, never written)', () => {
  for (const [who, ctx] of EVERYONE) {
    it(`${who} cannot create, update, merge or delete an entry`, async () => {
      await assertFails(setDoc(doc(ctx(), `${AGENT}/plays/card_s2`), entry('agent-plays-1', OWNER_UID, 'card_s2')));
      await assertFails(updateDoc(doc(ctx(), ENTRY), { stage: 'retired' }));
      await assertFails(updateDoc(doc(ctx(), ENTRY), { note: 'rewritten' }));
      await assertFails(updateDoc(doc(ctx(), ENTRY), { shelved: false }));
      await assertFails(setDoc(doc(ctx(), ENTRY), { stage: 'installed' }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), ENTRY)));
    });
  }
  it('the parent agent\'s own write rules are untouched by the nested block: the owner may still update only the allowlisted keys', async () => {
    await assertSucceeds(updateDoc(doc(asOwner(), AGENT), { updatedAt: '2026-10-21T21:30:00.000Z' }));
    await assertFails(updateDoc(doc(asOwner(), AGENT), { archetype: 'guardian' }));
  });
});

describe('the posture is written down', () => {
  it('ONE nested block inside agents/{agentId}: owner read by the document\'s own ownerId, `allow write: if false;`', () => {
    expect(ruleBlocks(RULES_TEXT, /\/plays\/\{entryId\}/)).toEqual([[
      'allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;',
      'allow write: if false;',
    ]]);
    const [agentsBlock] = ruleBlocks(RULES_TEXT, /\/agents\/\{agentId\}/);
    expect(agentsBlock.join('\n')).toContain('match /plays/{entryId} {');
  });
});
