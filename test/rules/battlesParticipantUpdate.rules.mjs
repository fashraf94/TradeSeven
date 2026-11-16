// test/rules/battlesParticipantUpdate.rules.mjs
//
// SECURITY PACK, FIX 3 (founder ruling R-F, 15 Nov 2026; report
// docs/audits/20261115_FIX_SECURITY_PACK_LEAGUE_VIEW.md) — the old human
// `battles/{battleId}` collection. UPDATE is restricted to the record's two
// participants: a signed-in user whose uid is the record's `creator.uid`,
// `creator.odUserId`, `opponent.uid` or `opponent.odUserId` (the four fields
// the client's own battle queries match a user on —
// src/firebase/firebaseService.js subscribeToBattles). Before this, any
// signed-in user could update any record. Proves against the REAL rules
// engine that:
//
//   · the creator (by `creator.uid`) and the opponent (by `opponent.uid`) can
//     update — the positive controls that keep the denial rows from passing on
//     a ruleset that denies everything;
//   · a participant named only by `odUserId` (the field V3/V4 records also
//     carry) can update;
//   · a signed-in STRANGER is DENIED — the hole this fix closes;
//   · an ANONYMOUS caller is DENIED;
//   · a record with no `opponent` map (or no `creator` map) does not error the
//     rule into an allow: the creator still updates, a stranger is denied, and
//     a record naming nobody is closed to every client;
//   · a stranger cannot JOIN a waiting record by writing themselves into the
//     empty opponent seat (the join is an update by a non-participant; no join
//     door is reachable at today's flag values — report, fix 3);
//   · READ and CREATE are unchanged by this task (a stranger still reads, an
//     anonymous caller still cannot), and DELETE stays denied to everyone.
//
// MUTATION CHECK: revert the update rule to `allow update: if request.auth != null;`
// → the stranger and join rows red; drop the `!= null` guard → the anonymous
// row reds.
//
// DEPLOY NOTE: rules deploy manually and are inert until deployed (the
// founder publishes after the merge). Point COMPOSITION_RULES_TEXT_PATH at
// fetched deployed rules text to prove the LIVE ruleset after that deploy;
// the default is the repo text, and the sha256 of whichever was loaded is
// printed.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
const RULES_PATH = process.env.COMPOSITION_RULES_TEXT_PATH
  ? resolve(process.env.COMPOSITION_RULES_TEXT_PATH)
  : resolve(__dirname, '../../firestore.rules');
const RULES_TEXT = readFileSync(RULES_PATH, 'utf8');
const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');

// Synthetic test identities (no real account ids).
const CREATOR = 'battles-creator-1';
const OPPONENT = 'battles-opponent-2';
const STRANGER = 'battles-stranger-3';
const OD_ONLY = 'battles-odonly-4';

const ACTIVE = 'battles/active-1';
const OD_ONLY_BATTLE = 'battles/odonly-1';
const WAITING = 'battles/waiting-1';
const NO_OPPONENT = 'battles/no-opponent-1';
const NOBODY = 'battles/nobody-1';

// The shape the client writers produce (firebaseService.createBaggerBombBattleV4 /
// joinBaggerBombBattleV4): two side maps, each naming its player by uid and odUserId.
const side = (uid, extra = {}) => ({ uid, odUserId: uid, username: 'Player', portfolio: { star: [], core: [], support: [] }, totalScore: 0, ...extra });
const battle = (extra = {}) => ({
  _v: 4, type: 'baggerbomb', challengeCode: 'ABC123', visibility: 'public', archived: false,
  creator: side(CREATOR), opponent: side(OPPONENT),
  state: { status: 'active' }, events: [], updatedAt: '2026-03-10T15:00:00.000Z',
  ...extra,
});

let testEnv;

/** Seed a document bypassing rules (Admin-SDK-equivalent path). */
async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const bump = { 'creator.totalScore': 7, updatedAt: '2026-03-10T15:15:00.000Z' };

beforeAll(async () => {
  console.log(`[battlesParticipantUpdate] rules text: ${RULES_PATH} sha256=${RULES_SHA256}`);
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
  await seed(ACTIVE, battle());
  // A V3/V4 participant whose `uid` field holds something else (the writers'
  // `user.uid || user.odUserId || user.username` fallback) but whose odUserId is the account.
  await seed(OD_ONLY_BATTLE, battle({ opponent: side('legacy-handle', { odUserId: OD_ONLY }) }));
  await seed(WAITING, battle({ opponent: { uid: '', odUserId: '', username: '' }, state: { status: 'waiting' } }));
  const { opponent: _o, ...noOpp } = battle();
  await seed(NO_OPPONENT, noOpp);
  const { creator: _c, opponent: _p, ...nobody } = battle();
  await seed(NOBODY, nobody);
});

describe('battles/{battleId} UPDATE — the two participants only (R-F fix 3)', () => {
  it('the creator (creator.uid) can update — positive control', async () => {
    await assertSucceeds(updateDoc(doc(as(CREATOR), ACTIVE), bump));
  });

  it('the opponent (opponent.uid) can update — positive control', async () => {
    await assertSucceeds(updateDoc(doc(as(OPPONENT), ACTIVE), { 'opponent.totalScore': 3 }));
  });

  it('a participant named only by odUserId can update', async () => {
    await assertSucceeds(updateDoc(doc(as(OD_ONLY), OD_ONLY_BATTLE), { 'opponent.totalScore': 3 }));
  });

  it('a signed-in STRANGER is DENIED (the hole: any signed-in user could update any record)', async () => {
    await assertFails(updateDoc(doc(as(STRANGER), ACTIVE), bump));
    await assertFails(updateDoc(doc(as(STRANGER), ACTIVE), { 'state.status': 'completed' }));
    await assertFails(updateDoc(doc(as(STRANGER), OD_ONLY_BATTLE), bump));
  });

  it('an ANONYMOUS caller is DENIED', async () => {
    await assertFails(updateDoc(doc(asAnon(), ACTIVE), bump));
  });

  it('a stranger cannot JOIN a waiting record by writing themselves into the empty opponent seat', async () => {
    await assertFails(updateDoc(doc(as(STRANGER), WAITING), {
      'opponent.uid': STRANGER, 'opponent.odUserId': STRANGER, 'state.status': 'active',
    }));
    // the waiting record's creator still can
    await assertSucceeds(updateDoc(doc(as(CREATOR), WAITING), bump));
  });

  it('a record with no opponent map: the creator updates, a stranger is denied (a missing side denies, never errors into an allow)', async () => {
    await assertSucceeds(updateDoc(doc(as(CREATOR), NO_OPPONENT), bump));
    await assertFails(updateDoc(doc(as(STRANGER), NO_OPPONENT), bump));
  });

  it('a record naming nobody is closed to every client', async () => {
    for (const uid of [CREATOR, OPPONENT, STRANGER]) await assertFails(updateDoc(doc(as(uid), NOBODY), bump));
  });
});

describe('battles/{battleId} — READ, CREATE and DELETE are unchanged by this task', () => {
  it('a signed-in stranger still reads; an anonymous caller still cannot', async () => {
    await assertSucceeds(getDoc(doc(as(STRANGER), ACTIVE)));
    await assertFails(getDoc(doc(asAnon(), ACTIVE)));
  });

  it('a signed-in user can still create; an anonymous caller cannot', async () => {
    await assertSucceeds(setDoc(doc(as(STRANGER), 'battles/new-1'), battle({ creator: side(STRANGER) })));
    await assertFails(setDoc(doc(asAnon(), 'battles/new-2'), battle()));
  });

  it('delete stays denied — to a participant too', async () => {
    await assertFails(deleteDoc(doc(as(CREATOR), ACTIVE)));
    await assertFails(deleteDoc(doc(as(STRANGER), ACTIVE)));
  });
});
