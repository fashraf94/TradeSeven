// api/_utils/backingWallet.js
//
// Backing Beta PR 1 — THE WALLET AND ITS LEDGER (spec V1.3 §2 economy, §6 data
// model, §7 expiry; rulings D-a, D-f, D-h, D-v).
//
// `backingWallets/{walletId}` with `entries/{entryId}`. LEDGER-FIRST (§6):
// every balance on the wallet doc is a CACHE of the entries beneath it, the two
// move in ONE transaction, and a mismatch resolves in the ledger's favor. That
// is the whole discipline this module exists to hold — the cached field and the
// entry it derives from are written by the same statement, never by two callers
// who might disagree (BUILD_RULES §9, applied to a number instead of a label).
//
// TRANSACTION-TAKING PRIMITIVES, NOT A SERVICE. `ensureAllowance`,
// `debitStake`, `creditPayout` and `creditRefund` take a caller's `tx` and the
// wallet doc the caller already read, so PR 2's single stake transaction (§8 —
// wallet + eligibility + stakes + pool + group in ONE transaction) and PR 3's
// settlement transaction compose them inside their own boundaries rather than
// opening a nested one. They are SYNCHRONOUS and do no reads: every read this
// module needs is `readWallet`, which the caller performs once, up front. That
// is not a stylistic choice — Firestore requires all reads before all writes in
// a transaction, so a primitive that read lazily could not be composed after
// another primitive had written.
//
// THREAD THE WALLET. Each primitive returns the NEXT wallet state; a caller
// composing two of them passes the first's result into the second, so a stake
// debited in the same transaction as its allowance grant sees the granted
// balance:
//     const w0 = await readWallet(tx, ref);
//     const { wallet: w1 } = ensureAllowance(tx, ref, w0, weekKey, now);
//     const { wallet: w2 } = debitStake(tx, ref, w1, { stakeId, amount, weekKey });
// Each call re-sets the whole wallet doc (`tx.set`, the tournamentRank
// whole-doc idiom), so the last write in a transaction carries every earlier
// one — there is no partial-field race between them.
//
// IDEMPOTENCY KEYED BY SOURCE ID (§6, the house pattern): `allowance:{weekKey}`,
// `stake:{stakeId}`, `payout:{stakeId}`, `refund:{stakeId}`, `expiry:{weekKey}`.
// A replay of any of them is a NO-OP, not an error and not a second entry —
// `appliedEntries` on the wallet doc is the once-only guard, exactly as
// `appliedGroups` is on a rank doc (tournamentRank.js). Keeping the guard on the
// PARENT doc rather than on the entry is what lets the primitives stay
// read-free and therefore composable. The map grows by at most ~60 keys a week
// (one allowance, at most ALLOWANCE_BP/MIN_STAKE_BP = 20 stakes, and one payout
// or refund each), which is the same unbounded-but-small shape `appliedGroups`
// already carries in production.
//
// DEV NAMESPACE (§6, ruling A-4 mirrored from rank): `isDev` groups route to
// `dev-{uid}` wallet ids, so a smoke week can never move a real record. The
// rules block reads a `dev-` id back to its owner and to nobody else.
//
// PAYOUTS ARE SCORE, NOT BALANCE (§2). `creditPayout` and `creditRefund` never
// touch `allowanceRemaining`: winning does not buy you more backing this week,
// and the week's allowance still expires. They move the RECORD — `careerNet`
// and `seasons.{monthKey}.net` — which is private to the user in the beta
// (D-v: there is no public ranked backer leaderboard, and this module writes
// nothing that could feed one).
//
// NOTHING IN PR 1 CALLS ANY OF THIS. No endpoint, no UI, no caller, and no
// wallet document is written. `touchWallet` is here for PR 4's read path.
//
// Imports the zero-import constants module from src/ under the revised June
// 2026 import rule (BUILD_RULES §4); the co-located test's real import of THIS
// module is the dependency-surface guard (it explodes in the Node test env if a
// browser dep ever enters the graph) — never mock it.

import { toIso } from './tournamentTime.js';
import { currentBackingWeek } from './backingWeek.js';
import { ALLOWANCE_BP } from '../../src/constants/backing.js';

/** The collection; the doc id is `walletIdFor(uid, { dev })`. */
export const BACKING_WALLETS_COLLECTION = 'backingWallets';

/** The ledger subcollection under each wallet (§6). */
export const BACKING_WALLET_ENTRIES_SUBCOLLECTION = 'entries';

/** The five entry types (§6). Exported so callers and tests name them once. */
export const ENTRY_TYPES = Object.freeze({
  ALLOWANCE: 'allowance',
  STAKE: 'stake',
  PAYOUT: 'payout',
  REFUND: 'refund',
  EXPIRY: 'expiry',
});

/**
 * A ledger refusal. Typed (the EligibilityRequiredError shape) so PR 2's stake
 * endpoint can `instanceof` it — or read `.code` / `.statusCode` — and answer
 * without string-matching a message.
 *
 * Deliberately NOT how a REPLAY is reported: a replayed entry id is idempotency
 * working, so it returns `{ applied: false, replay: true }` and the caller
 * carries on. A refusal is a state the caller must not proceed from.
 */
export class BackingLedgerError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'BackingLedgerError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ==================== IDENTITY ====================

/**
 * The wallet doc id for a uid: `uid`, or `dev-{uid}` in the dev namespace —
 * the rank-doc rule verbatim (`rankDocId`, leagueTournament.js), so the two
 * namespaces can never drift apart.
 */
export function walletIdFor(uid, { dev = false } = {}) {
  if (typeof uid !== 'string' || uid.length === 0) {
    throw new BackingLedgerError('invalid_uid', 'walletIdFor: a non-empty uid is required');
  }
  return dev === true ? `dev-${uid}` : uid;
}

/** The `backingWallets/{walletId}` document reference. */
export function walletRef(db, uid, { dev = false } = {}) {
  return db.collection(BACKING_WALLETS_COLLECTION).doc(walletIdFor(uid, { dev }));
}

// ==================== READ ====================

/**
 * The wallet document's data inside the caller's transaction, or null when the
 * user has never been touched. THE ONE READ this module performs — every
 * primitive below is read-free so it can be composed after a write (see the
 * header).
 */
export async function readWallet(tx, ref) {
  const snap = await tx.get(ref);
  return snap.exists ? snap.data() : null;
}

// ==================== INTERNALS ====================

/** The wallet doc as the primitives see it: absent fields read as their zero. */
function normalize(walletDoc) {
  return {
    lastAllowanceWeek: typeof walletDoc?.lastAllowanceWeek === 'string' ? walletDoc.lastAllowanceWeek : null,
    allowanceRemaining: Number.isFinite(walletDoc?.allowanceRemaining) ? walletDoc.allowanceRemaining : 0,
    careerNet: Number.isFinite(walletDoc?.careerNet) ? walletDoc.careerNet : 0,
    seasons: walletDoc?.seasons && typeof walletDoc.seasons === 'object' ? walletDoc.seasons : {},
    appliedEntries: walletDoc?.appliedEntries && typeof walletDoc.appliedEntries === 'object' ? walletDoc.appliedEntries : {},
    createdAt: typeof walletDoc?.createdAt === 'string' ? walletDoc.createdAt : null,
  };
}

/** A positive integer BP amount, or a typed refusal. BP is integer-only (§3). */
function requireAmount(amount, what) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new BackingLedgerError('invalid_amount', `${what}: amount must be a positive integer BP value, got ${amount}`);
  }
  return amount;
}

/** A non-empty string id, or a typed refusal. */
function requireId(value, where, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BackingLedgerError('invalid_id', `${where}: a non-empty ${field} is required, got ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Write ONE ledger entry (§6 `{ type, delta, ref, at }`, plus the per-type
 * context that makes the entry self-describing: `weekKey` on the three
 * allowance-affecting types, `groupId` + `monthKey` on the two record-affecting
 * ones). One writer for all five types, so the shape cannot drift between them.
 *
 * Whole-doc `tx.set` at a deterministic id — the tournamentRank idiom — which
 * is what makes a replay a harmless rewrite of identical bytes even if the
 * `appliedEntries` guard were ever bypassed.
 */
function writeEntry(tx, ref, entryId, fields) {
  tx.set(ref.collection(BACKING_WALLET_ENTRIES_SUBCOLLECTION).doc(entryId), fields);
}

/**
 * Commit the wallet doc and return the state the caller should thread onward.
 * The cached fields and the entries they derive from leave this module in ONE
 * transaction, always (§6 ledger-first).
 */
function commitWallet(tx, ref, next, nowIso) {
  const doc = { ...next, updatedAt: nowIso, createdAt: next.createdAt ?? nowIso };
  tx.set(ref, doc);
  return doc;
}

// ==================== (1) THE LAZY WEEKLY ALLOWANCE (§2, §7 — D-h) ====================

/**
 * Grant this backing week's allowance if it has not been granted (§2: lazily,
 * on the first wallet touch in the week — no enumeration, no fan-out write).
 *
 * When `lastAllowanceWeek !== weekKey`:
 *   1. an `expiry:{lastAllowanceWeek}` entry for whatever the PRIOR week left
 *      unspent, so that week's ledger sums to zero (§7 — expiry is implicit,
 *      recorded on the next grant). Skipped when the prior remainder is 0:
 *      a zero-delta entry is noise, and the sum is already zero.
 *   2. an `allowance:{weekKey}` entry of ALLOWANCE_BP, and
 *      `allowanceRemaining = ALLOWANCE_BP`, `lastAllowanceWeek = weekKey`.
 *
 * NOTHING CARRIES (§2). The new remainder is ALLOWANCE_BP flat, never the prior
 * balance plus a grant — the expiry entry is what makes that visible in the
 * ledger rather than merely true in the cache.
 *
 * IDEMPOTENT on the entry id: an existing `allowance:{weekKey}` is a no-op, so
 * two racing first touches in one week yield ONE grant. The guard is the entry
 * id and not `lastAllowanceWeek` alone, because the id is the source-keyed
 * house pattern (§6) and survives a wallet doc that was reset out of band.
 *
 * @returns {{wallet: Object, granted: boolean, expired: number}} `expired` is
 *   the BP the prior week lost (0 when there was none).
 */
export function ensureAllowance(tx, ref, walletDoc, weekKey, now = new Date()) {
  requireId(weekKey, 'ensureAllowance', 'weekKey');
  const nowIso = toIso(now);
  const current = normalize(walletDoc);
  const entryId = `${ENTRY_TYPES.ALLOWANCE}:${weekKey}`;

  if (current.appliedEntries[entryId] !== undefined) {
    return { wallet: walletDoc ?? current, granted: false, expired: 0 };
  }

  const appliedEntries = { ...current.appliedEntries };

  // (1) The prior week's remainder expires — recorded, never silently dropped.
  let expired = 0;
  if (current.lastAllowanceWeek !== null && current.lastAllowanceWeek !== weekKey && current.allowanceRemaining > 0) {
    expired = current.allowanceRemaining;
    const expiryId = `${ENTRY_TYPES.EXPIRY}:${current.lastAllowanceWeek}`;
    if (appliedEntries[expiryId] === undefined) {
      writeEntry(tx, ref, expiryId, {
        type: ENTRY_TYPES.EXPIRY,
        delta: -expired,
        ref: current.lastAllowanceWeek,
        weekKey: current.lastAllowanceWeek,
        at: nowIso,
      });
      appliedEntries[expiryId] = nowIso;
    }
  }

  // (2) The grant.
  writeEntry(tx, ref, entryId, {
    type: ENTRY_TYPES.ALLOWANCE,
    delta: ALLOWANCE_BP,
    ref: weekKey,
    weekKey,
    at: nowIso,
  });
  appliedEntries[entryId] = nowIso;

  const wallet = commitWallet(tx, ref, {
    ...current,
    lastAllowanceWeek: weekKey,
    allowanceRemaining: ALLOWANCE_BP,
    appliedEntries,
  }, nowIso);
  return { wallet, granted: true, expired };
}

// ==================== (2) THE STAKE DEBIT (§2, §8) ====================

/**
 * Spend `amount` BP of this week's allowance on a stake (§8 — one transaction
 * per stake; this is its wallet half).
 *
 * Writes `stake:{stakeId}` (delta −amount) and moves BOTH cached fields it
 * feeds:
 *   · `allowanceRemaining −= amount` — the spendable side;
 *   · `careerNet −= amount` — the RECORD. §2 defines Net BP as
 *     `Σ payouts + Σ refunds − Σ stakes`, so a stake is a debit against the
 *     record from the moment it is placed. Without this, a LOST stake (no
 *     payout, no refund — §3: "an unbacked winner means every stake is lost")
 *     would cost the backer nothing on their own record, and `creditRefund`
 *     could not be net-neutral against its stake.
 *
 * DOES NOT write a season bucket. §2 attributes net BP to the ET month of the
 * pod's FIRST BANKED DAY — the ladder's own `monthKeyForGroup` — which does not
 * exist when the stake is placed (the pod has not battled). PR 3 supplies that
 * key at settlement, where `creditPayout` / `creditRefund` carry it. The
 * consequence, stated rather than hidden: `careerNet` and
 * `Σ seasons.*.net` differ by the stakes not yet settled, and a stake that ends
 * LOST is never attributed to a month at all. How PR 3 closes that — most
 * likely by settling losers through this same ledger with the pool's monthKey —
 * is a PR 3 decision, and PR 1 deliberately does not invent the primitive.
 *
 * REFUSES (typed, never silent):
 *   · a debit that would take `allowanceRemaining` below zero —
 *     `insufficient_allowance`. The floor is the ledger's, and it is the last
 *     one: the per-team cap and the minimum stake are the STAKE ENDPOINT's
 *     checks (§8 reads the backer's existing stakes on that team to apply the
 *     cap), not the wallet's;
 *   · a week that is not the wallet's granted week — `week_mismatch`. §2 makes
 *     every stake on a pool draw from ONE allowance; a debit keyed to another
 *     week would spend the wrong one.
 * REPLAYS a known `stake:{stakeId}` as a no-op: `{ applied: false, replay: true }`
 * with the wallet unchanged. This is the `requestId` guarantee (§8, "duplicate
 * submissions are no-ops") reaching the ledger.
 */
export function debitStake(tx, ref, walletDoc, { stakeId, amount, weekKey, now } = {}) {
  requireId(stakeId, 'debitStake', 'stakeId');
  requireId(weekKey, 'debitStake', 'weekKey');
  requireAmount(amount, 'debitStake');
  const nowIso = toIso(now ?? new Date());
  const current = normalize(walletDoc);
  const entryId = `${ENTRY_TYPES.STAKE}:${stakeId}`;

  if (current.appliedEntries[entryId] !== undefined) {
    return { wallet: walletDoc ?? current, applied: false, replay: true };
  }
  if (current.lastAllowanceWeek !== weekKey) {
    throw new BackingLedgerError(
      'week_mismatch',
      `debitStake: wallet is granted for ${current.lastAllowanceWeek ?? 'no week'}, stake is for ${weekKey}`,
    );
  }
  if (current.allowanceRemaining - amount < 0) {
    throw new BackingLedgerError(
      'insufficient_allowance',
      `debitStake: ${amount} BP exceeds the ${current.allowanceRemaining} BP remaining this week`,
    );
  }

  writeEntry(tx, ref, entryId, {
    type: ENTRY_TYPES.STAKE,
    delta: -amount,
    ref: stakeId,
    weekKey,
    at: nowIso,
  });

  const wallet = commitWallet(tx, ref, {
    ...current,
    allowanceRemaining: current.allowanceRemaining - amount,
    careerNet: current.careerNet - amount,
    appliedEntries: { ...current.appliedEntries, [entryId]: nowIso },
  }, nowIso);
  return { wallet, applied: true, replay: false };
}

// ==================== (3) THE RECORD CREDITS (§2 — D-v) ====================

/** `creditPayout` / `creditRefund` share one body; only the type differs. */
function credit(type, tx, ref, walletDoc, { stakeId, groupId, amount, monthKey, now } = {}) {
  const where = `credit ${type}`;
  requireId(stakeId, where, 'stakeId');
  requireId(groupId, where, 'groupId');
  requireId(monthKey, where, 'monthKey');
  requireAmount(amount, where);
  const nowIso = toIso(now ?? new Date());
  const current = normalize(walletDoc);
  const entryId = `${type}:${stakeId}`;

  if (current.appliedEntries[entryId] !== undefined) {
    return { wallet: walletDoc ?? current, applied: false, replay: true };
  }

  writeEntry(tx, ref, entryId, {
    type,
    delta: amount,
    ref: stakeId,
    groupId,
    monthKey,
    at: nowIso,
  });

  const season = current.seasons[monthKey] ?? {};
  const seasonNet = Number.isFinite(season.net) ? season.net : 0;
  const wallet = commitWallet(tx, ref, {
    ...current,
    // NEVER allowanceRemaining: payouts are score, not spendable balance (§2),
    // and the week's allowance still expires on schedule.
    careerNet: current.careerNet + amount,
    seasons: { ...current.seasons, [monthKey]: { ...season, net: seasonNet + amount } },
    appliedEntries: { ...current.appliedEntries, [entryId]: nowIso },
  }, nowIso);
  return { wallet, applied: true, replay: false };
}

/**
 * Credit a settled payout (§3: `payout = floor(stake × pot ÷ winningStakes)`,
 * computed by PR 3 — this module records, it does not divide).
 *
 * Writes `payout:{stakeId}` and moves `careerNet` and `seasons.{monthKey}.net`.
 * NEVER `allowanceRemaining` (§2). `monthKey` is the caller's — PR 3 supplies
 * the LADDER's own key (`monthKeyForGroup`, the ET month of the pod's first
 * banked day, §2), so backing attributes to the same month the tournament does
 * rather than to a second, drifting notion of "season" (BUILD_RULES §9).
 *
 * A replayed `payout:{stakeId}` is a no-op — settlement is idempotent by
 * `groupId` (§6) and this is the per-stake half of that guarantee, which is what
 * makes the `resolving → resolved` re-read and the admin re-run safe.
 */
export function creditPayout(tx, ref, walletDoc, args) {
  return credit(ENTRY_TYPES.PAYOUT, tx, ref, walletDoc, args);
}

/**
 * Credit a refund for a voided stake (§7 refund paths: `insufficient` at close,
 * a seat that left, a group `voided` / `expired` / deleted, a lingering pod).
 *
 * Identical shape to `creditPayout`, and NET-NEUTRAL against its own stake by
 * construction: the stake wrote `−amount` to `careerNet`, this writes `+amount`
 * back, so a voided stake costs the backer nothing on the record (§2: "Voided
 * stakes are score-neutral: the stake and its refund cancel"). The BP does NOT
 * return as spendable — `allowanceRemaining` is untouched — because by the time
 * a refund is written the week has closed (§2).
 *
 * The caller passes the refund amount, which for every §7 path is the stake's
 * own amount; this module does not read the stake, so a caller that passed a
 * different number would break neutrality — PR 3's fixtures own that.
 */
export function creditRefund(tx, ref, walletDoc, args) {
  return credit(ENTRY_TYPES.REFUND, tx, ref, walletDoc, args);
}

// ==================== (4) THE ONE CONVENIENCE WRAPPER ====================

/**
 * Touch a user's wallet for the backing week in progress at `now`: run
 * `ensureAllowance` in its OWN transaction and return the wallet doc.
 *
 * The only non-transaction-taking export, and deliberately the only one: PR 4's
 * read path (the allowance shown beside the stake control, §5) wants a wallet
 * without composing a ledger operation, and every other caller already has a
 * transaction of its own. NOTHING CALLS IT IN PR 1.
 *
 * @returns {Promise<Object>} the wallet doc as it stands after the touch.
 */
export async function touchWallet(db, uid, { dev = false, now = new Date() } = {}) {
  const week = currentBackingWeek(now);
  if (week == null) {
    throw new BackingLedgerError('invalid_now', `touchWallet: no backing week derivable from ${String(now)}`);
  }
  const ref = walletRef(db, uid, { dev });
  return db.runTransaction(async (tx) => {
    const current = await readWallet(tx, ref);
    const { wallet } = ensureAllowance(tx, ref, current, week.weekKey, now);
    return wallet;
  });
}
