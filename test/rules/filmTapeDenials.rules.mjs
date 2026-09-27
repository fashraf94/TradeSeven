// test/rules/filmTapeDenials.rules.mjs
//
// Film Room Build A — the tape (spec docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md
// §5): Firestore security-rules acceptance for
//   agentBattles/{battleId}/tape/{etDate}
//   agentBattles/{battleId}/tape/{etDate}/series/{symbol}
//
// The spec's rule, on BOTH document kinds, reads the document's OWN ownerId:
//   allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
//   allow write: if false;
//
//   · READ: the owner (the document's ownerId === request.auth.uid) succeeds —
//     the positive control; another authenticated user, a privileged-claims
//     context and an unauthenticated client are denied;
//   · WRITE: no client — the owner included — can create, update or delete
//     either kind (the passes write through the Admin SDK, which bypasses rules);
//   · a tape whose document does not exist is unreadable (resource is null) —
//     the hub helper's Stage 3 read treats that as "no tape".
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

const OWNER_UID = 'tape-owner-1';
const OTHER_UID = 'tape-intruder-2';
const PRIVILEGED_UID = 'tape-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const BATTLE = 'agentBattles/battle-tape-1';
const TAPE = `${BATTLE}/tape/2026-09-24`;
const SERIES = `${TAPE}/series/AAPL`;
const MISSING_TAPE = `${BATTLE}/tape/2026-09-25`;

const battle = () => ({ ownerId: OWNER_UID, agentId: 'agent-1', status: 'active', gameMode: 'baggerbomb_agent' });
const tape = () => ({ tapeVersion: 2, battleId: 'battle-tape-1', ownerId: OWNER_UID, etDate: '2026-09-24', passes: { close: { status: 'written' } } });
const series = () => ({ symbol: 'AAPL', ownerId: OWNER_UID, role: 'held', interval: '10m', provenance: 'market', bars: [], atChecks: [] });

let testEnv;

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
}
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

beforeAll(async () => {
  console.log(`[filmTapeDenials] loaded rules text: ${RULES_PATH}`);
  console.log(`[filmTapeDenials] rules text sha256: ${RULES_SHA256}`);
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
  await seed(TAPE, tape());
  await seed(SERIES, series());
});

for (const [kind, PATH] of [['tape/{etDate}', TAPE], ['tape/{etDate}/series/{symbol}', SERIES]]) {
  describe(`agentBattles/{battleId}/${kind} — read by the document's own ownerId`, () => {
    it('positive control: the owner reads it', async () => {
      await assertSucceeds(getDoc(doc(asOwner(), PATH)));
    });
    it('another authenticated user is denied', async () => {
      await assertFails(getDoc(doc(asOther(), PATH)));
    });
    it('a privileged-claims context is denied — the rule is ownerId, never a claim', async () => {
      await assertFails(getDoc(doc(asPrivileged(), PATH)));
    });
    it('an unauthenticated client is denied', async () => {
      await assertFails(getDoc(doc(asAnon(), PATH)));
    });
  });

  describe(`agentBattles/{battleId}/${kind} — client writes denied`, () => {
    for (const [who, ctx] of [['the owner', asOwner], ['another user', asOther], ['a privileged-claims context', asPrivileged], ['an unauthenticated client', asAnon]]) {
      it(`${who} cannot create, update, merge or delete it`, async () => {
        const fresh = PATH === TAPE ? `${BATTLE}/tape/2026-09-30` : `${TAPE}/series/MSFT`;
        const data = PATH === TAPE ? tape() : series();
        await assertFails(setDoc(doc(ctx(), fresh), data));
        await assertFails(updateDoc(doc(ctx(), PATH), { ownerId: OWNER_UID }));
        await assertFails(setDoc(doc(ctx(), PATH), { note: 'x' }, { merge: true }));
        await assertFails(deleteDoc(doc(ctx(), PATH)));
      });
    }
  });
}

describe('the rule reads the document itself', () => {
  it('a tape whose ownerId is another user is denied even to the battle owner', async () => {
    await seed(`${BATTLE}/tape/2026-09-26`, { ...tape(), ownerId: OTHER_UID });
    await assertFails(getDoc(doc(asOwner(), `${BATTLE}/tape/2026-09-26`)));
  });
  it('a missing tape document is unreadable (resource is null) — the helper reads this as "no tape"', async () => {
    await assertFails(getDoc(doc(asOwner(), MISSING_TAPE)));
  });
  it('a list is allowed only when constrained to the caller\'s ownerId (rules are not filters)', async () => {
    await assertSucceeds(getDocs(query(collection(asOwner(), `${BATTLE}/tape`), where('ownerId', '==', OWNER_UID))));
    await assertFails(getDocs(collection(asOwner(), `${BATTLE}/tape`)));
    await assertFails(getDocs(query(collection(asOther(), `${BATTLE}/tape`), where('ownerId', '==', OWNER_UID))));
  });
  it('the parent battle\'s own execution-control update still works for the owner (sibling rule untouched)', async () => {
    await assertSucceeds(updateDoc(doc(asOwner(), BATTLE), { executionMode: 'autopilot' }));
  });
  it('the rules text carries the block exactly as the spec wrote it, on both kinds', () => {
    const block = RULES_TEXT.slice(RULES_TEXT.indexOf('match /tape/{etDate}'));
    const rule = 'allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;';
    expect(block.split(rule).length - 1).toBeGreaterThanOrEqual(2);
    expect(block).toContain('match /series/{symbol}');
    expect((block.match(/allow write: if false;/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
