// test/rules/backingDenials.rules.mjs
//
// Backing Beta PR 1 — Firestore security-rules acceptance for the four backing
// collections (spec V1.3 §6 / §3 / §8 / §10 / §12 PR 1; rulings D-k, D-v, D-w,
// D-x). Proves against the REAL rules engine that:
//
//   · backingWallets/{walletId} and its entries/ ledger are OWNER-READ, with
//     the DEV NAMESPACE — `dev-{uid}` readable by `uid` and by nobody else;
//   · backingPools/{groupId} is authed-read (the tournamentGroups pattern);
//   · backingPools/{groupId}/private/{doc} is UNREADABLE by any client — the
//     document whose exposure would unseal a sealed pool (§3);
//   · backingStakes/{stakeId} is readable only by the stake's own userId;
//   · backingStakes/{stakeId}/private/{doc} is UNREADABLE by any client, THE
//     BACKER INCLUDED — the PR 2 carry-in E1 fingerprint and admin `excluded`
//     flag, which cannot be fields on the owner-readable parent (§8);
//   · backingEvents/{eventId} is unreadable by any client (§10);
//   · and that NO client — the owner included — can create, update or delete
//     anything in any of them (`write: if false`, the tournamentRanks pattern).
//
// WITH POSITIVE CONTROLS (the wireDenials / eligibilityDenials F2-4 pattern):
// the same run asserts the owner's wallet read, the authed pool read and the
// owner's own-stake query all SUCCEED, so an over-broad or misloaded ruleset
// cannot pass this suite vacuously by failing everything.
//
// INDEX NOTE (the equippedConfigHashQuery.rules.mjs scope note): the owner-stake
// LIST rows below are admitted by the RULES; in production the same query also
// needs the composite backingStakes (userId ASC, weekKey ASC) committed in
// firestore.indexes.json by this PR AND created manually in the Firebase
// Console (the index-drift dual-write note, FIRESTORE_INDEX_DRIFT_CLEANUP.md).
// The emulator does not require the composite, so these rows prove the rule,
// not the index.
//
// DEPLOY NOTE: rules deploy manually via the Console (the runbook step) and are
// inert until deployed. Point COMPOSITION_RULES_TEXT_PATH at fetched deployed
// rules text to prove the LIVE ruleset after that deploy (the wire/composition/
// eligibility siblings' knob); the default is the repo text, and the sha256 of
// whichever was loaded is printed.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, collectionGroup, query, where, documentId, getDocs } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = process.env.COMPOSITION_RULES_TEXT_PATH
  ? resolve(process.env.COMPOSITION_RULES_TEXT_PATH)
  : resolve(__dirname, '../../firestore.rules');
const RULES_TEXT = readFileSync(RULES_PATH, 'utf8');
const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');

const OWNER_UID = 'backing-owner-1';
const OTHER_UID = 'backing-intruder-2';
const PRIVILEGED_UID = 'backing-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };
// A user whose OWN uid begins with `dev-`: the prefix-accident case the wallet
// rule must not admit (it compares the whole id, never a prefix).
const DEVNAME_UID = 'dev-lookalike-4';

const WEEK = '2026-W39';
const GROUP = 'grp-abc';

const WALLET = `backingWallets/${OWNER_UID}`;
const DEV_WALLET = `backingWallets/dev-${OWNER_UID}`;
const OTHER_WALLET = `backingWallets/${OTHER_UID}`;
const WALLET_ENTRY = `${WALLET}/entries/allowance:${WEEK}`;
const DEV_WALLET_ENTRY = `${DEV_WALLET}/entries/allowance:${WEEK}`;
const OTHER_WALLET_ENTRY = `${OTHER_WALLET}/entries/allowance:${WEEK}`;
const POOL = `backingPools/${GROUP}`;
const POOL_PRIVATE = `${POOL}/private/totals`;
const OWNER_STAKE = 'backingStakes/stake-owner-1';
const OWNER_STAKE_META = `${OWNER_STAKE}/private/meta`;   // PR 2 carry-in E1
const OTHER_STAKE = 'backingStakes/stake-other-1';
const ABSENT_STAKE = 'backingStakes/stake-never-written';
const EVENT = 'backingEvents/evt-1';

// The exact §6 shapes the server writes (api/_utils/backingWallet.js for the
// first two; PR 2/PR 3/PR 5 for the rest — shaped from §6 here).
const wallet = (uid) => ({
  lastAllowanceWeek: WEEK,
  allowanceRemaining: 1000,
  careerNet: 0,
  seasons: {},
  appliedEntries: { [`allowance:${WEEK}`]: '2026-09-15T18:00:00.000Z' },
  createdAt: '2026-09-15T18:00:00.000Z',
  updatedAt: '2026-09-15T18:00:00.000Z',
  uid,
});
const entry = () => ({ type: 'allowance', delta: 1000, ref: WEEK, weekKey: WEEK, at: '2026-09-15T18:00:00.000Z' });
// An OPEN pool, in the shape the writer produces since Amendment B §B5: the
// threshold-capped pair and no pot, no exact count. Four backers are in this
// pool; the document says 3 of 3, because 3 is the floor.
const pool = () => ({
  status: 'open', formationPath: 'lobby', battleMondayEtDate: '2026-09-21',
  baseLayerWeek: WEEK, opensAt: '2026-09-15T18:00:00.000Z',
  closesAt: '2026-09-21T03:59:59.000Z', closeReason: 'clock',
  backerProgress: { count: 3, floor: 3, met: true }, teamSpread: { met: true }, isDev: false,
});
// …and the sealed doc the pot and the exact counts moved INTO (§B5), which is
// what the rows below prove no client can read.
const privateTotals = () => ({
  byTeam: { 'od-1': 600, 'od-2': 300 }, backers: { [OWNER_UID]: 600 },
  potTotal: 1200, uniqueBackers: 4, teamsBacked: 3,
});
const stake = (userId) => ({
  userId, groupId: GROUP, teamOdUserId: 'od-1', amount: 250,
  placedAt: '2026-09-15T18:00:00.000Z', weekKey: WEEK, status: 'live',
});
const event = () => ({ userId: OWNER_UID, groupId: GROUP, event: 'window_viewed', at: '2026-09-15T18:00:00.000Z', props: {} });
// PR 2 carry-in E1: the stake's fingerprint and admin exclusion flag, kept OFF
// the owner-readable parent because rules cannot hide a field.
const stakeMeta = () => ({ ipHash: 'a'.repeat(64), uaHash: 'b'.repeat(64), excluded: false, at: '2026-09-15T18:00:00.000Z' });

let testEnv;

/** Seed a document bypassing rules (the Admin-SDK-equivalent path). */
async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asDevName = () => testEnv.authenticatedContext(DEVNAME_UID).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

const ALL_CONTEXTS = [
  ['the owner', asOwner],
  ['another authenticated user', asOther],
  ['a privileged-claims context', asPrivileged],
  ['an unauthenticated client', asAnon],
];

beforeAll(async () => {
  console.log(`[backingDenials] loaded rules text: ${RULES_PATH}`);
  console.log(`[backingDenials] rules text sha256: ${RULES_SHA256}`);
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [emuHost, emuPort] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-tradeseven-rules',
    firestore: { rules: RULES_TEXT, host: emuHost, port: Number(emuPort) },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(WALLET, wallet(OWNER_UID));
  await seed(DEV_WALLET, wallet(OWNER_UID));
  await seed(OTHER_WALLET, wallet(OTHER_UID));
  await seed(WALLET_ENTRY, entry());
  await seed(DEV_WALLET_ENTRY, entry());
  await seed(OTHER_WALLET_ENTRY, entry());
  await seed(POOL, pool());
  await seed(POOL_PRIVATE, privateTotals());
  await seed(OWNER_STAKE, stake(OWNER_UID));
  await seed(OWNER_STAKE_META, stakeMeta());
  await seed(OTHER_STAKE, stake(OTHER_UID));
  await seed(EVENT, event());
});

// ============================================================================
describe('POSITIVE CONTROLS — the ruleset is loaded and not over-broad', () => {
  it('the owner reads their own wallet and its ledger entry', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), WALLET)));
    await assertSucceeds(getDoc(doc(asOwner(), WALLET_ENTRY)));
  });

  it('any signed-in user reads a pool — the authed-read surface (§3 pool strip)', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), POOL)));
    await assertSucceeds(getDoc(doc(asOther(), POOL)));
  });

  it('the owner queries their OWN stakes — the (userId, weekKey) query shape', async () => {
    await assertSucceeds(getDocs(query(
      collection(asOwner(), 'backingStakes'),
      where('userId', '==', OWNER_UID),
      where('weekKey', '==', WEEK),
    )));
  });
});

// ============================================================================
describe('backingWallets/{walletId} — OWNER-READ, including the dev namespace (§6, D-v)', () => {
  it('the owner reads their own wallet AND their dev-namespaced wallet', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), WALLET)));
    await assertSucceeds(getDoc(doc(asOwner(), DEV_WALLET)));
  });

  it("nobody else reads either — not another user, not privileged claims, not anonymous", async () => {
    for (const [label, ctx] of [['other', asOther], ['privileged', asPrivileged], ['anon', asAnon]]) {
      await assertFails(getDoc(doc(ctx(), WALLET)), label);
      await assertFails(getDoc(doc(ctx(), DEV_WALLET)), label);
    }
  });

  it('the owner cannot read ANOTHER user\'s wallet or dev wallet', async () => {
    await assertFails(getDoc(doc(asOwner(), OTHER_WALLET)));
    await assertFails(getDoc(doc(asOwner(), `backingWallets/dev-${OTHER_UID}`)));
  });

  it('a user literally named `dev-…` cannot read another user\'s wallet by prefix accident', async () => {
    // The rule compares the WHOLE id against 'dev-' + uid, never a prefix. A
    // prefix-shaped rule would let `dev-lookalike-4` reach `dev-lookalike-4-x`
    // or, worse, admit `dev-` ids generally.
    await seed(`backingWallets/${DEVNAME_UID}`, wallet(DEVNAME_UID));
    await assertFails(getDoc(doc(asDevName(), WALLET)));
    await assertFails(getDoc(doc(asDevName(), DEV_WALLET)));
    // And the reverse direction: the real owner cannot read the lookalike's.
    await assertFails(getDoc(doc(asOwner(), `backingWallets/${DEVNAME_UID}`)));
    // Nor can the `dev-`-named user read the doc AT their own uid: that id lives
    // in the dev namespace (it is `lookalike-4`'s dev wallet), and clause 1
    // excludes `dev-` ids precisely so one document never serves two people.
    // The writer refuses to mint such a wallet at all (walletIdFor).
    await assertFails(getDoc(doc(asDevName(), `backingWallets/${DEVNAME_UID}`)));
  });

  it('an unfiltered wallet LIST is denied for everyone, the owner included', async () => {
    // `allow read` grants get AND list; a get-only suite cannot fail under an
    // over-broad list rule (BUILD_RULES §2).
    for (const [label, ctx] of ALL_CONTEXTS) {
      await assertFails(getDocs(collection(ctx(), 'backingWallets')), label);
    }
  });

  it("a documentId() query for another user's wallet is denied", async () => {
    await assertFails(getDocs(query(collection(asOther(), 'backingWallets'), where(documentId(), '==', OWNER_UID))));
    await assertFails(getDocs(query(collection(asPrivileged(), 'backingWallets'), where(documentId(), '==', OWNER_UID))));
  });

  it('no client writes a wallet — the owner included', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      const fs = ctx();
      await assertFails(setDoc(doc(fs, `backingWallets/${OWNER_UID}-new`), wallet(OWNER_UID)), label);
      await assertFails(updateDoc(doc(fs, WALLET), { allowanceRemaining: 999999 }), label);
      await assertFails(setDoc(doc(fs, WALLET), wallet(OWNER_UID)), label);
      await assertFails(setDoc(doc(fs, WALLET), { careerNet: 10_000 }, { merge: true }), label);
      await assertFails(deleteDoc(doc(fs, WALLET)), label);
      await assertFails(updateDoc(doc(fs, DEV_WALLET), { allowanceRemaining: 999999 }), label);
    }
  });
});

// ============================================================================
describe('the dev-namespace COLLISION direction — `dev-{uid}` means ONE thing (§6)', () => {
  // The direction the prefix-accident row above does NOT cover, and the reason
  // clause 1 of ownsBackingWallet excludes `dev-` ids. `backingWallets/dev-X` is
  // reachable two ways — as X's DEV wallet (clause 2) and as the PRODUCTION
  // wallet of a user whose uid is literally `dev-X` (clause 1) — and if both
  // clauses admitted it, one document would serve two people.
  const COLLIDING = `dev-${OTHER_UID}`; // a uid that is ALSO OTHER_UID's dev id
  const asColliding = () => testEnv.authenticatedContext(COLLIDING).firestore();

  it('a `dev-`-prefixed uid CANNOT read the doc at its own uid — that id belongs to the dev namespace', async () => {
    await seed(`backingWallets/${COLLIDING}`, wallet(COLLIDING));
    await assertFails(getDoc(doc(asColliding(), `backingWallets/${COLLIDING}`)));
    await assertFails(getDocs(collection(asColliding(), `backingWallets/${COLLIDING}/entries`)));
  });

  it('the plain uid still reaches its OWN dev wallet at the same path (clause 2 is intact)', async () => {
    // The positive control that stops the exclusion from being over-broad: the
    // dev namespace must still work for the user it belongs to.
    await seed(`backingWallets/${COLLIDING}`, wallet(OTHER_UID));
    await assertSucceeds(getDoc(doc(asOther(), `backingWallets/${COLLIDING}`)));
  });

  it('an ordinary uid still reads its own production wallet (clause 1 is intact)', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), WALLET)));
  });

  it('the WRITER refuses such a uid outright, so no colliding production wallet can exist', async () => {
    // The rules half above cannot consult the writer, so the two halves are
    // pinned separately and must agree: api/_utils/backingWallet.js throws
    // `invalid_uid` for a uid already inside the dev namespace.
    const { walletIdFor } = await import('../../api/_utils/backingWallet.js');
    expect(() => walletIdFor(COLLIDING)).toThrow(/dev namespace/);
    expect(walletIdFor(OTHER_UID, { dev: true })).toBe(COLLIDING);
  });
});

// ============================================================================
describe('COLLECTION-GROUP queries cannot bypass the path-scoped rules', () => {
  // `collectionGroup` is the one verb that ignores the document path, so it is
  // the verb most likely to defeat a rule written per-path. Firestore admits it
  // only via a recursive-wildcard rule (`match /{p=**}/entries/{id}`), and this
  // ruleset authors none — these rows pin that absence, which is exactly what a
  // future "convenience" wildcard would break.
  it('nobody reaches another user\'s ledger through collectionGroup("entries")', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      await assertFails(getDocs(collectionGroup(ctx(), 'entries')), label);
      await assertFails(getDocs(query(collectionGroup(ctx(), 'entries'), where('weekKey', '==', WEEK))), label);
    }
  });

  it('nobody reaches a sealed pool\'s private totals through collectionGroup("private")', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      await assertFails(getDocs(collectionGroup(ctx(), 'private')), label);
    }
  });
});

// ============================================================================
describe('backingWallets/{walletId}/entries/{entryId} — the ledger, same owner (§6)', () => {
  it('the owner reads their own entries, in both namespaces', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), WALLET_ENTRY)));
    await assertSucceeds(getDoc(doc(asOwner(), DEV_WALLET_ENTRY)));
    await assertSucceeds(getDocs(collection(asOwner(), `${WALLET}/entries`)));
  });

  it('nobody else reads them, and nobody lists another user\'s ledger', async () => {
    for (const [label, ctx] of [['other', asOther], ['privileged', asPrivileged], ['anon', asAnon]]) {
      await assertFails(getDoc(doc(ctx(), WALLET_ENTRY)), label);
      await assertFails(getDoc(doc(ctx(), DEV_WALLET_ENTRY)), label);
      await assertFails(getDocs(collection(ctx(), `${WALLET}/entries`)), label);
    }
    await assertFails(getDoc(doc(asOwner(), OTHER_WALLET_ENTRY)));
    await assertFails(getDocs(collection(asOwner(), `${OTHER_WALLET}/entries`)));
  });

  it('no client writes a ledger entry — the ledger is the record, not a client surface', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      const fs = ctx();
      await assertFails(setDoc(doc(fs, `${WALLET}/entries/allowance:2026-W40`), entry()), label);
      await assertFails(updateDoc(doc(fs, WALLET_ENTRY), { delta: 1_000_000 }), label);
      await assertFails(deleteDoc(doc(fs, WALLET_ENTRY)), label);
    }
  });
});

// ============================================================================
describe('backingPools/{groupId} — authed-read, server-written (§3, §6)', () => {
  it('every signed-in client reads a pool; an anonymous one does not', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), POOL)));
    await assertSucceeds(getDoc(doc(asOther(), POOL)));
    await assertSucceeds(getDoc(doc(asPrivileged(), POOL)));
    await assertFails(getDoc(doc(asAnon(), POOL)));
  });

  it('no client writes a pool — a client-set potTotal would be a fabricated fact (§9)', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      const fs = ctx();
      await assertFails(setDoc(doc(fs, 'backingPools/new-group'), pool()), label);
      await assertFails(updateDoc(doc(fs, POOL), { potTotal: 999_999 }), label);
      await assertFails(setDoc(doc(fs, POOL), pool()), label);
      await assertFails(deleteDoc(doc(fs, POOL)), label);
      // Amendment B §B2: the capped signals are a SERVER fact too. A client
      // that could raise its own `backerProgress` would manufacture a qualified
      // pool, and one that could lower it would hide a real one.
      await assertFails(updateDoc(doc(fs, POOL), { backerProgress: { count: 3, floor: 3, met: true } }), label);
      await assertFails(updateDoc(doc(fs, POOL), { teamSpread: { met: true } }), label);
    }
  });
});

// ============================================================================
describe('backingPools/{groupId}/private/{doc} — NO client read (§3 sealed pools)', () => {
  it('nobody reads it — not the authed pool reader, not privileged claims, not anonymous', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      await assertFails(getDoc(doc(ctx(), POOL_PRIVATE)), label);
      await assertFails(getDocs(collection(ctx(), `${POOL}/private`)), label);
    }
  });

  it('reading the parent pool does NOT reach into private — the sealed half stays sealed', async () => {
    // The row that fails if a `backingPools/{id}/{document=**}` wildcard is ever
    // added for convenience: the parent read must succeed while this one does not.
    await assertSucceeds(getDoc(doc(asOwner(), POOL)));
    await assertFails(getDoc(doc(asOwner(), POOL_PRIVATE)));
  });

  it('no client writes it', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      const fs = ctx();
      await assertFails(setDoc(doc(fs, `${POOL}/private/forged`), privateTotals()), label);
      await assertFails(updateDoc(doc(fs, POOL_PRIVATE), { byTeam: {} }), label);
      await assertFails(deleteDoc(doc(fs, POOL_PRIVATE)), label);
    }
  });
});

// ============================================================================
describe('backingStakes/{stakeId} — owner-read on the DOCUMENT\'s userId (§3, §6)', () => {
  it('the backer reads their own stake', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), OWNER_STAKE)));
  });

  it("nobody reads another backer's stake — the pool is sealed on per-backer detail", async () => {
    await assertFails(getDoc(doc(asOwner(), OTHER_STAKE)));
    await assertFails(getDoc(doc(asOther(), OWNER_STAKE)));
    await assertFails(getDoc(doc(asPrivileged(), OWNER_STAKE)));
    await assertFails(getDoc(doc(asAnon(), OWNER_STAKE)));
  });

  it('an ABSENT stake is denied too — no existence oracle', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      await assertFails(getDoc(doc(ctx(), ABSENT_STAKE)), label);
    }
  });

  it('an unfiltered stake LIST is denied for everyone, the owner included', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      await assertFails(getDocs(collection(ctx(), 'backingStakes')), label);
    }
  });

  it("a query filtered to ANOTHER user's stakes is denied", async () => {
    await assertFails(getDocs(query(collection(asOwner(), 'backingStakes'), where('userId', '==', OTHER_UID))));
    await assertFails(getDocs(query(collection(asPrivileged(), 'backingStakes'), where('userId', '==', OWNER_UID))));
  });

  it('a groupId-only query is denied — a pool\'s stake list is not a client surface (§3)', async () => {
    // The (groupId, status) index serves the SERVER's close/settlement reads via
    // the Admin SDK; the rules must not admit the same query from a client, or
    // the sealed pool leaks per-team detail before close.
    await assertFails(getDocs(query(collection(asOwner(), 'backingStakes'), where('groupId', '==', GROUP))));
    await assertFails(getDocs(query(
      collection(asOwner(), 'backingStakes'),
      where('groupId', '==', GROUP),
      where('status', '==', 'live'),
    )));
  });

  it('a query that proves userId == uid is admitted, with or without the week filter', async () => {
    await assertSucceeds(getDocs(query(collection(asOwner(), 'backingStakes'), where('userId', '==', OWNER_UID))));
    // WITH the week filter — the shape the committed (userId ASC, weekKey ASC)
    // composite serves, so the row exercises the query the index exists for.
    // (The emulator does not require the composite; these rows prove the RULE.)
    await assertSucceeds(getDocs(query(
      collection(asOwner(), 'backingStakes'),
      where('userId', '==', OWNER_UID),
      where('weekKey', '==', WEEK),
    )));
  });

  it('no client writes a stake — self-staking is exactly what the rule forbids (§8)', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      const fs = ctx();
      await assertFails(setDoc(doc(fs, 'backingStakes/forged-1'), stake(OWNER_UID)), label);
      await assertFails(updateDoc(doc(fs, OWNER_STAKE), { amount: 999_999 }), label);
      await assertFails(updateDoc(doc(fs, OWNER_STAKE), { status: 'won', payout: 5000 }), label);
      await assertFails(setDoc(doc(fs, OWNER_STAKE), stake(OWNER_UID)), label);
      await assertFails(deleteDoc(doc(fs, OWNER_STAKE)), label);
    }
  });
});

// ============================================================================
describe("backingStakes/{stakeId}/private/{doc} — NO client read (PR 2 carry-in E1)", () => {
  it('nobody reads it — THE BACKER WHO PLACED THE STAKE INCLUDED', async () => {
    // The row this block exists for. The parent stake is owner-read, and rules
    // cannot hide a field, so the fingerprint and the admin `excluded` flag live
    // here instead. An owner who could read this would learn whether an admin
    // had dropped their stake from the Sybil watch — the one signal a detective
    // control must not emit (§8).
    await assertFails(getDoc(doc(asOwner(), OWNER_STAKE_META)));
    for (const [label, ctx] of ALL_CONTEXTS) {
      await assertFails(getDoc(doc(ctx(), OWNER_STAKE_META)), label);
      await assertFails(getDocs(collection(ctx(), `${OWNER_STAKE}/private`)), label);
    }
  });

  it('reading the parent stake does NOT reach into private — the positive control', async () => {
    // The parent read must SUCCEED while this one does not, so the block above
    // cannot pass by denying everything.
    //
    // WHAT THIS ROW CATCHES, MEASURED rather than claimed (BUILD_RULES §2's
    // mutation rule; all three runs are recorded in the PR 2 review record):
    //   · RELAXING this block's read to `if request.auth != null` REDS this row
    //     and two of its siblings. That is the defect class that matters, and
    //     the shape a future "let the backer see their own meta" convenience
    //     would take.
    //   · DELETING the block entirely does NOT red anything, because Firestore
    //     denies by default. The block is an explicit statement on the page —
    //     the `backingPools/{id}/private` sibling's own stated convention — not
    //     the mechanism that denies. Said here so the row is never mistaken for
    //     a guard against its own removal.
    //   · a `backingStakes/{id}/{document=**}` wildcard carrying the PARENT's
    //     owner condition does not red it either, and correctly so: the meta doc
    //     carries no `userId`, so `resource.data.userId == request.auth.uid` is
    //     false for it and the read stays denied.
    await assertSucceeds(getDoc(doc(asOwner(), OWNER_STAKE)));
    await assertFails(getDoc(doc(asOwner(), OWNER_STAKE_META)));
  });

  it('an ABSENT meta doc is denied too — no existence oracle on the fingerprint', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      await assertFails(getDoc(doc(ctx(), 'backingStakes/stake-never-written/private/meta')), label);
    }
  });

  it('a COLLECTION-GROUP query on `private` cannot reach it', async () => {
    // `backingPools/{id}/private` and `backingStakes/{id}/private` share a
    // subcollection NAME; a collection-group read must be denied for both.
    for (const [label, ctx] of ALL_CONTEXTS) {
      await assertFails(getDocs(collectionGroup(ctx(), 'private')), label);
    }
  });

  it('no client writes it — the `excluded` flag is an ADMIN fact, never the backer’s', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      const fs = ctx();
      await assertFails(setDoc(doc(fs, `${OWNER_STAKE}/private/forged`), stakeMeta()), label);
      await assertFails(updateDoc(doc(fs, OWNER_STAKE_META), { excluded: true }), label);
      await assertFails(setDoc(doc(fs, OWNER_STAKE_META), stakeMeta()), label);
      await assertFails(deleteDoc(doc(fs, OWNER_STAKE_META)), label);
    }
  });
});

// ============================================================================
describe('backingEvents/{eventId} — NO client read, server-written (§10, D-p)', () => {
  it('nobody reads an event, or lists the collection', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      await assertFails(getDoc(doc(ctx(), EVENT)), label);
      await assertFails(getDocs(collection(ctx(), 'backingEvents')), label);
      await assertFails(getDocs(query(collection(ctx(), 'backingEvents'), where('userId', '==', OWNER_UID))), label);
    }
  });

  it('no client writes an event — the sink is POST /api/backing/event, awaited server-side (§10)', async () => {
    for (const [label, ctx] of ALL_CONTEXTS) {
      const fs = ctx();
      await assertFails(setDoc(doc(fs, 'backingEvents/forged-1'), event()), label);
      await assertFails(updateDoc(doc(fs, EVENT), { event: 'stake_confirmed' }), label);
      await assertFails(deleteDoc(doc(fs, EVENT)), label);
    }
  });
});
