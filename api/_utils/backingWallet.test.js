// api/_utils/backingWallet.test.js
//
// Backing Beta PR 1 — the wallet and its ledger (spec V1.3 §2 economy, §6 data
// model, §7 expiry; rulings D-a, D-f, D-h, D-v).
//
// THE INVARIANT THIS FILE EXISTS FOR (§6, ledger-first): after EVERY operation,
// the wallet's cached numbers equal an INDEPENDENT re-derivation from the
// entries beneath it. `assertLedgerAgrees` below re-folds the ledger by hand —
// it deliberately does NOT call a helper from the module under test, because a
// shared fold would agree with a wrong writer.
//
// Runs against the shared in-memory Firestore stand-in (the tournament/training
// suites' own), so the transaction boundary, the subcollection and the write log
// are real enough to assert against. Nothing about the module is mocked.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// api/_utils/backingWallet.js is the runtime guard for that module's api/ -> src/
// import of src/constants/backing.js. Never mock it.

import { describe, it, expect } from 'vitest';
import { makeInMemoryDb } from './__fixtures__/inMemoryFirestore.js';
import {
  BACKING_WALLETS_COLLECTION,
  BACKING_WALLET_ENTRIES_SUBCOLLECTION,
  ENTRY_TYPES,
  BackingLedgerError,
  walletIdFor,
  walletRef,
  readWallet,
  ensureAllowance,
  debitStake,
  creditPayout,
  creditRefund,
  touchWallet,
} from './backingWallet.js';
import { ALLOWANCE_BP, MIN_STAKE_BP, PER_TEAM_CAP_BP } from '../../src/constants/backing.js';

const UID = 'backer-uid-1';
const WEEK = '2026-W39';
const NEXT_WEEK = '2026-W40';
const MONTH = '2026-09';
const GROUP = 'grp-abc';
const NOW = new Date('2026-09-15T18:00:00.000Z');

/** Every entry doc under a wallet, as `{ id, ...data }`, in write order. */
function entriesOf(store, walletId) {
  const prefix = `${BACKING_WALLETS_COLLECTION}/${walletId}/${BACKING_WALLET_ENTRIES_SUBCOLLECTION}/`;
  return [...store.entries()]
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, data]) => ({ id: path.slice(prefix.length), ...data }));
}

function walletOf(store, walletId) {
  return store.get(`${BACKING_WALLETS_COLLECTION}/${walletId}`);
}

/**
 * THE §6 RECONCILIATION, re-derived from the entries alone:
 *   · allowanceRemaining = Σ deltas of the allowance-affecting types
 *     (allowance | stake | expiry) FOR THE WALLET'S CURRENT WEEK;
 *   · careerNet         = Σ deltas of the record-affecting types
 *     (stake | payout | refund) — §2: Σ payouts + Σ refunds − Σ stakes,
 *     allowance grants and expiries EXCLUDED;
 *   · seasons.{m}.net   = Σ deltas of the record-affecting types carrying that
 *     monthKey (stake entries carry none — see the module docstring).
 *   · every CLOSED week's allowance ledger sums to ZERO (§7).
 */
function assertLedgerAgrees(store, walletId) {
  const wallet = walletOf(store, walletId);
  const entries = entriesOf(store, walletId);

  const ALLOWANCE_TYPES = [ENTRY_TYPES.ALLOWANCE, ENTRY_TYPES.STAKE, ENTRY_TYPES.EXPIRY];
  const RECORD_TYPES = [ENTRY_TYPES.STAKE, ENTRY_TYPES.PAYOUT, ENTRY_TYPES.REFUND];

  const remaining = entries
    .filter((e) => ALLOWANCE_TYPES.includes(e.type) && e.weekKey === wallet.lastAllowanceWeek)
    .reduce((sum, e) => sum + e.delta, 0);
  expect(wallet.allowanceRemaining, 'allowanceRemaining ≠ Σ this week\'s allowance-affecting entries').toBe(remaining);

  const net = entries
    .filter((e) => RECORD_TYPES.includes(e.type))
    .reduce((sum, e) => sum + e.delta, 0);
  expect(wallet.careerNet, 'careerNet ≠ Σ payouts + Σ refunds − Σ stakes (§2)').toBe(net);

  const seasonNet = {};
  for (const e of entries) {
    if (!RECORD_TYPES.includes(e.type) || typeof e.monthKey !== 'string') continue;
    seasonNet[e.monthKey] = (seasonNet[e.monthKey] ?? 0) + e.delta;
  }
  for (const [monthKey, expected] of Object.entries(seasonNet)) {
    expect(wallet.seasons?.[monthKey]?.net, `seasons.${monthKey}.net ≠ Σ its entries`).toBe(expected);
  }
  expect(Object.keys(wallet.seasons ?? {}).sort()).toEqual(Object.keys(seasonNet).sort());

  // §7: each CLOSED week's allowance ledger sums to zero — the grant, the
  // stakes and the expiry cancel exactly.
  const byWeek = {};
  for (const e of entries) {
    if (!ALLOWANCE_TYPES.includes(e.type)) continue;
    byWeek[e.weekKey] = (byWeek[e.weekKey] ?? 0) + e.delta;
  }
  for (const [weekKey, sum] of Object.entries(byWeek)) {
    if (weekKey === wallet.lastAllowanceWeek) continue; // still open
    expect(sum, `closed week ${weekKey} does not sum to zero (§7)`).toBe(0);
  }

  // The once-only guard and the ledger name the same set, exactly once each.
  expect(entries.map((e) => e.id).sort()).toEqual(Object.keys(wallet.appliedEntries).sort());
  return { wallet, entries };
}

/** Run `fn(tx, ref, wallet)` in one transaction, threading the wallet state. */
async function inTx(db, uid, fn, { dev = false } = {}) {
  const ref = walletRef(db, uid, { dev });
  return db.runTransaction(async (tx) => {
    const current = await readWallet(tx, ref);
    return fn(tx, ref, current);
  });
}

/** A wallet already granted for WEEK. */
async function grantedWallet(db, { uid = UID, dev = false, weekKey = WEEK } = {}) {
  return inTx(db, uid, (tx, ref, w) => ensureAllowance(tx, ref, w, weekKey, NOW).wallet, { dev });
}

// ============================================================================
describe('walletIdFor — the dev namespace (§6, ruling A-4 mirrored)', () => {
  it('is the uid in production and `dev-{uid}` in the dev namespace', () => {
    expect(walletIdFor(UID)).toBe(UID);
    expect(walletIdFor(UID, { dev: false })).toBe(UID);
    expect(walletIdFor(UID, { dev: true })).toBe(`dev-${UID}`);
  });

  it('only an explicit `true` namespaces — a truthy non-true value does not', () => {
    // Fail-safe in the direction that cannot corrupt production: an accidental
    // `dev: 1` writes the REAL wallet id, which a reviewer sees, rather than
    // silently diverting real play into the dev namespace.
    expect(walletIdFor(UID, { dev: 1 })).toBe(UID);
    expect(walletIdFor(UID, { dev: 'yes' })).toBe(UID);
  });

  it('refuses an empty or non-string uid rather than writing to a nameless doc', () => {
    for (const bad of ['', null, undefined, 42, {}]) {
      expect(() => walletIdFor(bad)).toThrow(BackingLedgerError);
    }
  });

  it('walletRef points at backingWallets/{walletId}', () => {
    const { db } = makeInMemoryDb();
    expect(walletRef(db, UID).path).toBe(`${BACKING_WALLETS_COLLECTION}/${UID}`);
    expect(walletRef(db, UID, { dev: true }).path).toBe(`${BACKING_WALLETS_COLLECTION}/dev-${UID}`);
  });
});

// ============================================================================
describe('ensureAllowance — the lazy weekly grant (§2, D-h)', () => {
  it('FIRST TOUCH grants 1,000 BP and writes one allowance entry', async () => {
    const { db, store } = makeInMemoryDb();
    const result = await inTx(db, UID, (tx, ref, w) => ensureAllowance(tx, ref, w, WEEK, NOW));

    expect(result.granted).toBe(true);
    expect(result.expired).toBe(0);
    expect(result.wallet.allowanceRemaining).toBe(ALLOWANCE_BP);
    expect(result.wallet.lastAllowanceWeek).toBe(WEEK);

    const { entries } = assertLedgerAgrees(store, UID);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      id: `allowance:${WEEK}`,
      type: ENTRY_TYPES.ALLOWANCE,
      delta: ALLOWANCE_BP,
      ref: WEEK,
      weekKey: WEEK,
      at: NOW.toISOString(),
    });
  });

  it('SECOND TOUCH in the same week is a NO-OP — no second grant, no second entry, no write', async () => {
    const { db, store, writeLog } = makeInMemoryDb();
    await grantedWallet(db);
    const writesAfterGrant = writeLog.length;

    const result = await inTx(db, UID, (tx, ref, w) => ensureAllowance(tx, ref, w, WEEK, NOW));
    expect(result.granted).toBe(false);
    expect(result.wallet.allowanceRemaining).toBe(ALLOWANCE_BP);
    expect(writeLog.length).toBe(writesAfterGrant); // literally zero writes
    expect(entriesOf(store, UID)).toHaveLength(1);
    assertLedgerAgrees(store, UID);
  });

  it('a no-op touch does not disturb a PARTLY SPENT balance', async () => {
    // The dangerous shape of a wrong idempotency guard: re-granting would
    // silently refill the week.
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: 's1', amount: 250, weekKey: WEEK, now: NOW }));
    const after = await inTx(db, UID, (tx, ref, w) => ensureAllowance(tx, ref, w, WEEK, NOW));
    expect(after.wallet.allowanceRemaining).toBe(ALLOWANCE_BP - 250);
    assertLedgerAgrees(store, UID);
  });

  it('A NEW WEEK writes the EXPIRY first, then the grant — the prior week sums to zero (§7)', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: 's1', amount: 300, weekKey: WEEK, now: NOW }));

    const later = new Date('2026-09-22T18:00:00.000Z');
    const result = await inTx(db, UID, (tx, ref, w) => ensureAllowance(tx, ref, w, NEXT_WEEK, later));

    expect(result.granted).toBe(true);
    expect(result.expired).toBe(ALLOWANCE_BP - 300); // 700 BP lost
    expect(result.wallet.allowanceRemaining).toBe(ALLOWANCE_BP); // flat, never 700 + 1000
    expect(result.wallet.lastAllowanceWeek).toBe(NEXT_WEEK);

    const { entries } = assertLedgerAgrees(store, UID);
    const expiry = entries.find((e) => e.id === `expiry:${WEEK}`);
    expect(expiry).toEqual({
      id: `expiry:${WEEK}`,
      type: ENTRY_TYPES.EXPIRY,
      delta: -700,
      ref: WEEK,
      weekKey: WEEK,
      at: later.toISOString(),
    });
    // §7 spelled out for the closed week: +1000 − 300 − 700 = 0.
    const weekSum = entries.filter((e) => e.weekKey === WEEK).reduce((s, e) => s + e.delta, 0);
    expect(weekSum).toBe(0);
  });

  it('NOTHING CARRIES: a fully unspent week expires in full', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    const result = await inTx(db, UID, (tx, ref, w) => ensureAllowance(tx, ref, w, NEXT_WEEK, NOW));
    expect(result.expired).toBe(ALLOWANCE_BP);
    expect(result.wallet.allowanceRemaining).toBe(ALLOWANCE_BP);
    assertLedgerAgrees(store, UID);
  });

  it('a week that ended at exactly zero writes NO expiry entry — a zero delta is noise', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: 's1', amount: ALLOWANCE_BP, weekKey: WEEK, now: NOW }));
    const result = await inTx(db, UID, (tx, ref, w) => ensureAllowance(tx, ref, w, NEXT_WEEK, NOW));
    expect(result.expired).toBe(0);
    expect(entriesOf(store, UID).some((e) => e.type === ENTRY_TYPES.EXPIRY)).toBe(false);
    // The week still sums to zero — it did so without needing an entry.
    assertLedgerAgrees(store, UID);
  });

  it('the expiry names the week that LOST the BP, not the week being granted', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    await inTx(db, UID, (tx, ref, w) => ensureAllowance(tx, ref, w, NEXT_WEEK, NOW));
    const expiry = entriesOf(store, UID).find((e) => e.type === ENTRY_TYPES.EXPIRY);
    expect(expiry.weekKey).toBe(WEEK);
    expect(expiry.ref).toBe(WEEK);
    expect(expiry.id).toBe(`expiry:${WEEK}`);
  });

  it('skipping a week still expires the one before it, exactly once', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    await inTx(db, UID, (tx, ref, w) => ensureAllowance(tx, ref, w, '2026-W44', NOW));
    const expiries = entriesOf(store, UID).filter((e) => e.type === ENTRY_TYPES.EXPIRY);
    expect(expiries).toHaveLength(1);
    expect(expiries[0].weekKey).toBe(WEEK);
    assertLedgerAgrees(store, UID);
  });

  it('refuses a missing week key rather than granting to an unnamed week', async () => {
    const { db } = makeInMemoryDb();
    await expect(inTx(db, UID, (tx, ref, w) => ensureAllowance(tx, ref, w, '', NOW))).rejects.toThrow(BackingLedgerError);
    await expect(inTx(db, UID, (tx, ref, w) => ensureAllowance(tx, ref, w, null, NOW))).rejects.toThrow(/weekKey/);
  });
});

// ============================================================================
describe('debitStake — spending the allowance (§2, §8)', () => {
  it('DEBITS WITHIN the allowance: balance and record both move, one entry', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    const result = await inTx(db, UID, (tx, ref, w) =>
      debitStake(tx, ref, w, { stakeId: 'stake-1', amount: 250, weekKey: WEEK, now: NOW }));

    expect(result.applied).toBe(true);
    expect(result.replay).toBe(false);
    expect(result.wallet.allowanceRemaining).toBe(750);
    // §2: Net BP = Σ payouts + Σ refunds − Σ stakes. A stake debits the record
    // from the moment it is placed, or a LOST stake would cost nothing.
    expect(result.wallet.careerNet).toBe(-250);

    const { entries } = assertLedgerAgrees(store, UID);
    expect(entries.find((e) => e.id === 'stake:stake-1')).toEqual({
      id: 'stake:stake-1',
      type: ENTRY_TYPES.STAKE,
      delta: -250,
      ref: 'stake-1',
      weekKey: WEEK,
      at: NOW.toISOString(),
    });
  });

  it('DEBITS BEYOND the allowance are refused, typed, with nothing written', async () => {
    const { db, store, writeLog } = makeInMemoryDb();
    await grantedWallet(db);
    await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: 's1', amount: 800, weekKey: WEEK, now: NOW }));
    const writesBefore = writeLog.length;

    await expect(inTx(db, UID, (tx, ref, w) =>
      debitStake(tx, ref, w, { stakeId: 's2', amount: 300, weekKey: WEEK, now: NOW })))
      .rejects.toMatchObject({ name: 'BackingLedgerError', code: 'insufficient_allowance', statusCode: 400 });

    expect(writeLog.length).toBe(writesBefore);
    expect(walletOf(store, UID).allowanceRemaining).toBe(200);
    assertLedgerAgrees(store, UID);
  });

  it('spending the balance to EXACTLY zero is allowed — the floor is < 0, not ≤ 0', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    const result = await inTx(db, UID, (tx, ref, w) =>
      debitStake(tx, ref, w, { stakeId: 's1', amount: ALLOWANCE_BP, weekKey: WEEK, now: NOW }));
    expect(result.wallet.allowanceRemaining).toBe(0);
    assertLedgerAgrees(store, UID);
    // One BP past it is refused.
    await expect(inTx(db, UID, (tx, ref, w) =>
      debitStake(tx, ref, w, { stakeId: 's2', amount: 1, weekKey: WEEK, now: NOW })))
      .rejects.toMatchObject({ code: 'insufficient_allowance' });
  });

  it('a REPLAYED stake id is a NO-OP — the requestId guarantee reaching the ledger (§8)', async () => {
    const { db, store, writeLog } = makeInMemoryDb();
    await grantedWallet(db);
    await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: 'dup', amount: 400, weekKey: WEEK, now: NOW }));
    const writesBefore = writeLog.length;

    const replay = await inTx(db, UID, (tx, ref, w) =>
      debitStake(tx, ref, w, { stakeId: 'dup', amount: 400, weekKey: WEEK, now: NOW }));

    expect(replay.applied).toBe(false);
    expect(replay.replay).toBe(true);
    expect(writeLog.length).toBe(writesBefore);
    expect(walletOf(store, UID).allowanceRemaining).toBe(600);
    expect(entriesOf(store, UID).filter((e) => e.id === 'stake:dup')).toHaveLength(1);
    assertLedgerAgrees(store, UID);
  });

  it('a replay is a no-op even when the REPLAYED AMOUNT DIFFERS — the id is the key (§6)', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: 'dup', amount: 400, weekKey: WEEK, now: NOW }));
    const replay = await inTx(db, UID, (tx, ref, w) =>
      debitStake(tx, ref, w, { stakeId: 'dup', amount: 999, weekKey: WEEK, now: NOW }));
    expect(replay.replay).toBe(true);
    expect(walletOf(store, UID).allowanceRemaining).toBe(600);
    assertLedgerAgrees(store, UID);
  });

  it('refuses a stake keyed to a week the wallet is not granted for (§2: one allowance per pool)', async () => {
    const { db } = makeInMemoryDb();
    await grantedWallet(db);
    await expect(inTx(db, UID, (tx, ref, w) =>
      debitStake(tx, ref, w, { stakeId: 's1', amount: 100, weekKey: NEXT_WEEK, now: NOW })))
      .rejects.toMatchObject({ code: 'week_mismatch' });
  });

  it('refuses a debit against a wallet that has never been granted', async () => {
    const { db } = makeInMemoryDb();
    await expect(inTx(db, UID, (tx, ref, w) =>
      debitStake(tx, ref, w, { stakeId: 's1', amount: 100, weekKey: WEEK, now: NOW })))
      .rejects.toMatchObject({ code: 'week_mismatch' });
  });

  it('refuses a non-positive or non-integer amount — BP is integer-only (§3)', async () => {
    const { db } = makeInMemoryDb();
    await grantedWallet(db);
    for (const bad of [0, -50, 12.5, NaN, Infinity, '100', null, undefined]) {
      await expect(inTx(db, UID, (tx, ref, w) =>
        debitStake(tx, ref, w, { stakeId: `s-${String(bad)}`, amount: bad, weekKey: WEEK, now: NOW })))
        .rejects.toMatchObject({ code: 'invalid_amount' });
    }
  });

  it('does NOT enforce the per-team cap or the minimum stake — those are the endpoint\'s (§8)', async () => {
    // Stated as an executable limit, not left to be discovered: the wallet sees
    // one stake at a time and cannot know the backer's other stakes on a team.
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    const below = await inTx(db, UID, (tx, ref, w) =>
      debitStake(tx, ref, w, { stakeId: 'tiny', amount: MIN_STAKE_BP - 1, weekKey: WEEK, now: NOW }));
    expect(below.applied).toBe(true);
    const above = await inTx(db, UID, (tx, ref, w) =>
      debitStake(tx, ref, w, { stakeId: 'big', amount: PER_TEAM_CAP_BP + 1, weekKey: WEEK, now: NOW }));
    expect(above.applied).toBe(true);
    assertLedgerAgrees(store, UID);
  });

  it('COMPOSES with the grant inside ONE transaction — the threaded-wallet contract', async () => {
    // The shape PR 2's single stake transaction needs (§8): one read, then a
    // grant and a debit that sees it. A debit reading the pre-grant wallet
    // would fail week_mismatch, so this row cannot pass by accident.
    const { db, store, readLog } = makeInMemoryDb();
    const ref = walletRef(db, UID);
    const out = await db.runTransaction(async (tx) => {
      const w0 = await readWallet(tx, ref);
      const { wallet: w1 } = ensureAllowance(tx, ref, w0, WEEK, NOW);
      const { wallet: w2 } = debitStake(tx, ref, w1, { stakeId: 'first', amount: 500, weekKey: WEEK, now: NOW });
      return w2;
    });
    expect(out.allowanceRemaining).toBe(500);
    expect(out.careerNet).toBe(-500);
    // ONE transactional read of the wallet, however many primitives ran — the
    // property that lets the primitives compose after a write at all.
    expect(readLog.filter(([ch, p]) => ch === 'tx.get' && p === ref.path)).toHaveLength(1);
    assertLedgerAgrees(store, UID);
  });

  it('serial stakes across the week draw down one allowance', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    for (const [id, amount] of [['a', 500], ['b', 250], ['c', 250]]) {
      await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: id, amount, weekKey: WEEK, now: NOW }));
    }
    expect(walletOf(store, UID).allowanceRemaining).toBe(0);
    expect(walletOf(store, UID).careerNet).toBe(-1000);
    assertLedgerAgrees(store, UID);
  });
});

// ============================================================================
describe('creditPayout / creditRefund — the record, never the balance (§2, D-v)', () => {
  /** A wallet with one 400 BP stake placed this week. */
  async function staked(db, { stakeId = 'stake-1', amount = 400 } = {}) {
    await grantedWallet(db);
    await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId, amount, weekKey: WEEK, now: NOW }));
  }

  it('a PAYOUT moves careerNet and the season bucket and LEAVES THE ALLOWANCE ALONE (§2)', async () => {
    const { db, store } = makeInMemoryDb();
    await staked(db);
    const result = await inTx(db, UID, (tx, ref, w) =>
      creditPayout(tx, ref, w, { stakeId: 'stake-1', groupId: GROUP, amount: 900, monthKey: MONTH, now: NOW }));

    expect(result.applied).toBe(true);
    expect(result.wallet.allowanceRemaining).toBe(600); // untouched by the 900 BP win
    expect(result.wallet.careerNet).toBe(500); // 900 − 400
    expect(result.wallet.seasons[MONTH].net).toBe(900);

    const { entries } = assertLedgerAgrees(store, UID);
    expect(entries.find((e) => e.id === 'payout:stake-1')).toEqual({
      id: 'payout:stake-1',
      type: ENTRY_TYPES.PAYOUT,
      delta: 900,
      ref: 'stake-1',
      groupId: GROUP,
      monthKey: MONTH,
      at: NOW.toISOString(),
    });
  });

  it('a payout does not refill a spent week — the allowance still expires on schedule (§2)', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: 's', amount: ALLOWANCE_BP, weekKey: WEEK, now: NOW }));
    await inTx(db, UID, (tx, ref, w) =>
      creditPayout(tx, ref, w, { stakeId: 's', groupId: GROUP, amount: 5000, monthKey: MONTH, now: NOW }));
    expect(walletOf(store, UID).allowanceRemaining).toBe(0);
    // And the next week is still a flat 1,000, not 1,000 + winnings.
    const next = await inTx(db, UID, (tx, ref, w) => ensureAllowance(tx, ref, w, NEXT_WEEK, NOW));
    expect(next.wallet.allowanceRemaining).toBe(ALLOWANCE_BP);
    assertLedgerAgrees(store, UID);
  });

  it('a REFUND is NET-NEUTRAL against its stake (§2: the stake and its refund cancel)', async () => {
    const { db, store } = makeInMemoryDb();
    await staked(db, { stakeId: 'voided-1', amount: 400 });
    const result = await inTx(db, UID, (tx, ref, w) =>
      creditRefund(tx, ref, w, { stakeId: 'voided-1', groupId: GROUP, amount: 400, monthKey: MONTH, now: NOW }));

    expect(result.wallet.careerNet).toBe(0); // exactly cancelled
    expect(result.wallet.allowanceRemaining).toBe(600); // the BP does NOT come back as spendable
    expect(result.wallet.seasons[MONTH].net).toBe(400);
    const { entries } = assertLedgerAgrees(store, UID);
    expect(entries.find((e) => e.id === 'refund:voided-1').type).toBe(ENTRY_TYPES.REFUND);
  });

  it('a LOST stake — no payout, no refund — costs the backer its full stake (§3)', async () => {
    // The row that would pass vacuously if debitStake did not move careerNet.
    const { db, store } = makeInMemoryDb();
    await staked(db, { stakeId: 'loser', amount: 400 });
    expect(walletOf(store, UID).careerNet).toBe(-400);
    assertLedgerAgrees(store, UID);
  });

  it('REPLAYED payout and refund ids are no-ops — the per-stake half of settlement idempotency (§6)', async () => {
    const { db, store, writeLog } = makeInMemoryDb();
    await staked(db, { stakeId: 'p1', amount: 400 });
    await inTx(db, UID, (tx, ref, w) =>
      creditPayout(tx, ref, w, { stakeId: 'p1', groupId: GROUP, amount: 900, monthKey: MONTH, now: NOW }));
    const writesBefore = writeLog.length;

    const replay = await inTx(db, UID, (tx, ref, w) =>
      creditPayout(tx, ref, w, { stakeId: 'p1', groupId: GROUP, amount: 900, monthKey: MONTH, now: NOW }));
    expect(replay.replay).toBe(true);
    expect(writeLog.length).toBe(writesBefore);
    expect(walletOf(store, UID).careerNet).toBe(500);
    assertLedgerAgrees(store, UID);

    // And the same for a refund.
    await inTx(db, UID, (tx, ref, w) =>
      creditRefund(tx, ref, w, { stakeId: 'p1', groupId: GROUP, amount: 400, monthKey: MONTH, now: NOW }));
    const afterRefund = walletOf(store, UID).careerNet;
    const again = await inTx(db, UID, (tx, ref, w) =>
      creditRefund(tx, ref, w, { stakeId: 'p1', groupId: GROUP, amount: 400, monthKey: MONTH, now: NOW }));
    expect(again.replay).toBe(true);
    expect(walletOf(store, UID).careerNet).toBe(afterRefund);
    assertLedgerAgrees(store, UID);
  });

  it('a payout and a refund on the SAME stake are distinct entries — different ids, both applied', async () => {
    // They are different ledger facts; the id prefix is what keeps them apart.
    const { db, store } = makeInMemoryDb();
    await staked(db, { stakeId: 'x', amount: 100 });
    await inTx(db, UID, (tx, ref, w) => creditPayout(tx, ref, w, { stakeId: 'x', groupId: GROUP, amount: 10, monthKey: MONTH, now: NOW }));
    await inTx(db, UID, (tx, ref, w) => creditRefund(tx, ref, w, { stakeId: 'x', groupId: GROUP, amount: 20, monthKey: MONTH, now: NOW }));
    const ids = entriesOf(store, UID).map((e) => e.id).sort();
    expect(ids).toEqual(['allowance:2026-W39', 'payout:x', 'refund:x', 'stake:x']);
    assertLedgerAgrees(store, UID);
  });

  it('MONTH ATTRIBUTION keys on the monthKey THE CALLER PASSES (PR 3 supplies the ladder\'s key — §2)', async () => {
    // Two pools settling into different months from one week's stakes: the
    // wallet follows the caller, never a month derived from `now`.
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    for (const [id, amount] of [['sep', 300], ['oct', 300]]) {
      await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: id, amount, weekKey: WEEK, now: NOW }));
    }
    await inTx(db, UID, (tx, ref, w) => creditPayout(tx, ref, w, { stakeId: 'sep', groupId: 'g1', amount: 700, monthKey: '2026-09', now: NOW }));
    await inTx(db, UID, (tx, ref, w) => creditPayout(tx, ref, w, { stakeId: 'oct', groupId: 'g2', amount: 100, monthKey: '2026-10', now: NOW }));

    const wallet = walletOf(store, UID);
    expect(wallet.seasons['2026-09'].net).toBe(700);
    expect(wallet.seasons['2026-10'].net).toBe(100);
    // `now` is September for both writes — a month derived from the clock would
    // have put all 800 in 2026-09.
    expect(NOW.toISOString().startsWith('2026-09')).toBe(true);
    expect(wallet.careerNet).toBe(200); // 700 + 100 − 600
    assertLedgerAgrees(store, UID);
  });

  it('season buckets accumulate across settlements within a month', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    for (const [id, amount] of [['a', 200], ['b', 200]]) {
      await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: id, amount, weekKey: WEEK, now: NOW }));
    }
    await inTx(db, UID, (tx, ref, w) => creditPayout(tx, ref, w, { stakeId: 'a', groupId: 'g1', amount: 500, monthKey: MONTH, now: NOW }));
    await inTx(db, UID, (tx, ref, w) => creditRefund(tx, ref, w, { stakeId: 'b', groupId: 'g2', amount: 200, monthKey: MONTH, now: NOW }));
    expect(walletOf(store, UID).seasons[MONTH].net).toBe(700);
    assertLedgerAgrees(store, UID);
  });

  it('refuses a missing stakeId, groupId, monthKey or amount', async () => {
    const { db } = makeInMemoryDb();
    await grantedWallet(db);
    const base = { stakeId: 's', groupId: GROUP, amount: 100, monthKey: MONTH, now: NOW };
    for (const [field, bad, code] of [
      ['stakeId', '', 'invalid_id'],
      ['groupId', null, 'invalid_id'],
      ['monthKey', undefined, 'invalid_id'],
      ['amount', 0, 'invalid_amount'],
      ['amount', -1, 'invalid_amount'],
    ]) {
      await expect(inTx(db, UID, (tx, ref, w) => creditPayout(tx, ref, w, { ...base, [field]: bad })), `${field}=${bad}`)
        .rejects.toMatchObject({ code });
    }
  });
});

// ============================================================================
describe('the dev namespace — separation (§6)', () => {
  it('a dev wallet and a real wallet for the same uid are separate documents and separate ledgers', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: 'real', amount: 700, weekKey: WEEK, now: NOW }));

    await grantedWallet(db, { dev: true });
    await inTx(db, UID, (tx, ref, w) =>
      debitStake(tx, ref, w, { stakeId: 'smoke', amount: 100, weekKey: WEEK, now: NOW }), { dev: true });

    expect(walletOf(store, UID).allowanceRemaining).toBe(300);
    expect(walletOf(store, `dev-${UID}`).allowanceRemaining).toBe(900);
    expect(walletOf(store, UID).careerNet).toBe(-700);
    expect(walletOf(store, `dev-${UID}`).careerNet).toBe(-100);

    // Neither ledger can see the other's entries — a smoke Friday can never
    // move a real record (the rank-doc dev rule, mirrored).
    expect(entriesOf(store, UID).map((e) => e.id).sort()).toEqual(['allowance:2026-W39', 'stake:real']);
    expect(entriesOf(store, `dev-${UID}`).map((e) => e.id).sort()).toEqual(['allowance:2026-W39', 'stake:smoke']);
    assertLedgerAgrees(store, UID);
    assertLedgerAgrees(store, `dev-${UID}`);
  });
});

// ============================================================================
describe('touchWallet — the one non-transaction wrapper', () => {
  it('grants for the backing week in progress at `now`, in its own transaction', async () => {
    const { db, store } = makeInMemoryDb();
    const wallet = await touchWallet(db, UID, { now: NOW });
    expect(wallet.allowanceRemaining).toBe(ALLOWANCE_BP);
    expect(wallet.lastAllowanceWeek).toBe(WEEK); // Tue 2026-09-15 → 2026-W39
    assertLedgerAgrees(store, UID);
  });

  it('a second touch in the same week is a no-op', async () => {
    const { db, store, writeLog } = makeInMemoryDb();
    await touchWallet(db, UID, { now: NOW });
    const writesBefore = writeLog.length;
    const again = await touchWallet(db, UID, { now: new Date('2026-09-17T12:00:00.000Z') });
    expect(again.allowanceRemaining).toBe(ALLOWANCE_BP);
    expect(writeLog.length).toBe(writesBefore);
    expect(entriesOf(store, UID)).toHaveLength(1);
  });

  it('a touch in the NEXT week expires and re-grants', async () => {
    const { db, store } = makeInMemoryDb();
    await touchWallet(db, UID, { now: NOW });
    const wallet = await touchWallet(db, UID, { now: new Date('2026-09-22T18:00:00.000Z') });
    expect(wallet.lastAllowanceWeek).toBe(NEXT_WEEK);
    expect(entriesOf(store, UID).filter((e) => e.type === ENTRY_TYPES.EXPIRY)).toHaveLength(1);
    assertLedgerAgrees(store, UID);
  });

  it('honors the dev namespace', async () => {
    const { db, store } = makeInMemoryDb();
    await touchWallet(db, UID, { dev: true, now: NOW });
    expect(walletOf(store, `dev-${UID}`)).toBeDefined();
    expect(walletOf(store, UID)).toBeUndefined();
  });

  it('refuses an unreadable `now` rather than granting to a guessed week', async () => {
    const { db } = makeInMemoryDb();
    await expect(touchWallet(db, UID, { now: new Date('nope') }))
      .rejects.toMatchObject({ code: 'invalid_now' });
  });
});

// ============================================================================
describe('the entry shape — §6', () => {
  it('every entry carries the four core fields, plus its documented per-type context', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: 's', amount: 100, weekKey: WEEK, now: NOW }));
    await inTx(db, UID, (tx, ref, w) => creditPayout(tx, ref, w, { stakeId: 's', groupId: GROUP, amount: 300, monthKey: MONTH, now: NOW }));
    await inTx(db, UID, (tx, ref, w) => creditRefund(tx, ref, w, { stakeId: 's', groupId: GROUP, amount: 100, monthKey: MONTH, now: NOW }));
    await inTx(db, UID, (tx, ref, w) => ensureAllowance(tx, ref, w, NEXT_WEEK, NOW));

    const byType = Object.fromEntries(entriesOf(store, UID).map((e) => [e.type, e]));
    expect(Object.keys(byType).sort()).toEqual(['allowance', 'expiry', 'payout', 'refund', 'stake']);

    for (const [type, entry] of Object.entries(byType)) {
      for (const core of ['type', 'delta', 'ref', 'at']) {
        expect(entry[core], `${type}.${core}`).toBeDefined();
      }
      expect(typeof entry.delta, `${type}.delta`).toBe('number');
      expect(Number.isInteger(entry.delta), `${type}.delta is integer BP`).toBe(true);
      expect(entry.at, `${type}.at`).toBe(NOW.toISOString());
    }

    // The per-type context, locked so it cannot quietly drift.
    const fields = (e) => Object.keys(e).filter((k) => k !== 'id').sort();
    expect(fields(byType.allowance)).toEqual(['at', 'delta', 'ref', 'type', 'weekKey']);
    expect(fields(byType.expiry)).toEqual(['at', 'delta', 'ref', 'type', 'weekKey']);
    expect(fields(byType.stake)).toEqual(['at', 'delta', 'ref', 'type', 'weekKey']);
    expect(fields(byType.payout)).toEqual(['at', 'delta', 'groupId', 'monthKey', 'ref', 'type']);
    expect(fields(byType.refund)).toEqual(['at', 'delta', 'groupId', 'monthKey', 'ref', 'type']);

    // Signs: only the two credits are positive.
    expect(byType.allowance.delta).toBeGreaterThan(0);
    expect(byType.payout.delta).toBeGreaterThan(0);
    expect(byType.refund.delta).toBeGreaterThan(0);
    expect(byType.stake.delta).toBeLessThan(0);
    expect(byType.expiry.delta).toBeLessThan(0);
  });

  it('entries live under backingWallets/{walletId}/entries/{entryId}', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    const paths = [...store.keys()].filter((p) => p.includes('/entries/'));
    expect(paths).toEqual([`${BACKING_WALLETS_COLLECTION}/${UID}/${BACKING_WALLET_ENTRIES_SUBCOLLECTION}/allowance:${WEEK}`]);
  });

  it('the wallet doc carries the §6 fields and no surprises', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: 's', amount: 100, weekKey: WEEK, now: NOW }));
    await inTx(db, UID, (tx, ref, w) => creditPayout(tx, ref, w, { stakeId: 's', groupId: GROUP, amount: 300, monthKey: MONTH, now: NOW }));
    expect(Object.keys(walletOf(store, UID)).sort()).toEqual([
      'allowanceRemaining', 'appliedEntries', 'careerNet', 'createdAt',
      'lastAllowanceWeek', 'seasons', 'updatedAt',
    ]);
  });

  it('createdAt is stamped once and never moves; updatedAt follows the last write', async () => {
    const { db, store } = makeInMemoryDb();
    await grantedWallet(db);
    const later = new Date('2026-09-16T18:00:00.000Z');
    await inTx(db, UID, (tx, ref, w) => debitStake(tx, ref, w, { stakeId: 's', amount: 100, weekKey: WEEK, now: later }));
    expect(walletOf(store, UID).createdAt).toBe(NOW.toISOString());
    expect(walletOf(store, UID).updatedAt).toBe(later.toISOString());
  });
});
