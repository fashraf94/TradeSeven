// test/rules/filmRoomDebriefs.rules.mjs
//
// Film Room D2 — the agent's words (spec docs/specs/FILM_ROOM_BUILD_D2_WORDS_SPEC_V1_20261121.md §6, ruling DW-6; the
// founder's FD-5): Firestore security-rules acceptance for
//   agentBattles/{battleId}/debriefs/{etDate}
// The spec's rule reads the document's OWN ownerId, as the tape's does:
//   allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
//   allow write: if false;
//
//   · READ: the owner (the record's ownerId === request.auth.uid) succeeds — the positive control; another
//     authenticated user, a privileged-claims context and an unauthenticated client are denied; a record that names
//     another owner is denied even to the battle's owner;
//   · a record that does not exist is unreadable (resource is null) — the front reads that as "no record";
//   · WRITE: no client — the owner included — can create, update, merge or delete one (the nightly job writes with
//     the Admin SDK, which bypasses rules);
//   · LIST: an unconstrained list, or another user's, is denied — the front reads one document by its path, never a
//     query.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = process.env.COMPOSITION_RULES_TEXT_PATH
  ? resolve(process.env.COMPOSITION_RULES_TEXT_PATH)
  : resolve(__dirname, '../../firestore.rules');
const RULES_TEXT = readFileSync(RULES_PATH, 'utf8');
const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');

const OWNER_UID = 'debrief-owner-1';
const OTHER_UID = 'debrief-intruder-2';
const PRIVILEGED_UID = 'debrief-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const BATTLE = 'agentBattles/battle-debrief-1';
const RECORD = `${BATTLE}/debriefs/2026-09-23`;
const MISSING = `${BATTLE}/debriefs/2026-09-24`;

const battle = () => ({ ownerId: OWNER_UID, agentId: 'agent-1', status: 'completed', gameMode: 'baggerbomb_agent' });
const record = (over = {}) => ({
  version: 1, battleId: 'battle-debrief-1', etDate: '2026-09-23', ownerId: OWNER_UID, attributionAgentId: 'agent-1', archetype: 'momentum',
  status: 'written', reason: null, writtenAt: '2026-09-24T03:45:12.000Z', digestVersion: 1, digestHash: 'a'.repeat(64), tapeWrittenAt: '2026-09-24T02:15:30.000Z',
  model: 'claude-sonnet-5-5', usage: { input: 1500, output: 60 }, costUsd: 0.0036, attempts: 1,
  lines: [{ key: 'swap:2026-09-23T16:45:08.000Z|MSFT|CRWD', label: 's1', text: "That wasn't my call." }], dropped: [],
  ...over,
});

let testEnv;
async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
}
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

beforeAll(async () => {
  console.log(`[filmRoomDebriefs] loaded rules text: ${RULES_PATH}`);
  console.log(`[filmRoomDebriefs] rules text sha256: ${RULES_SHA256}`);
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
  await seed(RECORD, record());
});

describe('agentBattles/{battleId}/debriefs/{etDate} — read by the record\'s own ownerId', () => {
  it('positive control: the owner reads it, the words and all', async () => {
    const snap = await assertSucceeds(getDoc(doc(asOwner(), RECORD)));
    expect(snap.data().lines[0].text).toBe("That wasn't my call.");
  });
  it('another authenticated user is denied', async () => {
    await assertFails(getDoc(doc(asOther(), RECORD)));
  });
  it('a privileged-claims context is denied — the rule is ownerId, never a claim', async () => {
    await assertFails(getDoc(doc(asPrivileged(), RECORD)));
  });
  it('an unauthenticated client is denied', async () => {
    await assertFails(getDoc(doc(asAnon(), RECORD)));
  });
  it('a record naming another owner is denied even to the battle\'s owner (the rule reads the record itself)', async () => {
    await seed(`${BATTLE}/debriefs/2026-09-25`, record({ ownerId: OTHER_UID }));
    await assertFails(getDoc(doc(asOwner(), `${BATTLE}/debriefs/2026-09-25`)));
  });
  it('a record with no ownerId is denied to everyone', async () => {
    const { ownerId, ...rest } = record();
    void ownerId;
    await seed(`${BATTLE}/debriefs/2026-09-26`, rest);
    await assertFails(getDoc(doc(asOwner(), `${BATTLE}/debriefs/2026-09-26`)));
  });
  it('a MISSING record is unreadable (resource is null) — the front reads this as "no record"', async () => {
    await assertFails(getDoc(doc(asOwner(), MISSING)));
  });
  it('no list for anyone else: an unconstrained list is denied, and so is another user\'s list constrained to the owner (the front reads one document, never a list)', async () => {
    await assertFails(getDocs(collection(asOwner(), `${BATTLE}/debriefs`)));
    await assertFails(getDocs(query(collection(asOther(), `${BATTLE}/debriefs`), where('ownerId', '==', OWNER_UID))));
  });
});

describe('agentBattles/{battleId}/debriefs/{etDate} — every client write denied', () => {
  for (const [who, ctx] of [['the owner', asOwner], ['another user', asOther], ['a privileged-claims context', asPrivileged], ['an unauthenticated client', asAnon]]) {
    it(`${who} cannot create, update, merge or delete a record`, async () => {
      await assertFails(setDoc(doc(ctx(), MISSING), record({ etDate: '2026-09-24' })));
      await assertFails(updateDoc(doc(ctx(), RECORD), { lines: [] }));
      await assertFails(setDoc(doc(ctx(), RECORD), { status: 'nothing' }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), RECORD)));
    });
  }
});

describe('the rules text', () => {
  it('carries the block exactly as the spec wrote it, inside agentBattles/{battleId} — and nothing else inside it', () => {
    const start = RULES_TEXT.indexOf('match /debriefs/{etDate}');
    expect(start).toBeGreaterThan(RULES_TEXT.indexOf('match /agentBattles/{battleId}'));
    let depth = 0;
    let end = -1;
    for (let i = RULES_TEXT.indexOf('{', start + 'match /debriefs/{etDate}'.length); i < RULES_TEXT.length; i += 1) {
      if (RULES_TEXT[i] === '{') depth += 1;
      if (RULES_TEXT[i] === '}') { depth -= 1; if (depth === 0) { end = i + 1; break; } }
    }
    const lines = RULES_TEXT.slice(start, end).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
    expect(lines).toEqual([
      'match /debriefs/{etDate} {',
      'allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;',
      'allow write: if false;',
      '}',
    ]);
    expect(RULES_TEXT.split('match /debriefs/').length - 1).toBe(1);
  });
});
