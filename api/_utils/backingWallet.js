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
// `stake:{stakeId}`, `payout:{stakeId}`, `refund:{stakeId}`, `expiry:{weekKey}`,
// `loss:{stakeId}` (PR 2 carry-in E2).
// A replay of any of them is a NO-OP, not an error and not a second entry —
// `appliedEntries` on the wallet doc is the once-only guard, exactly as
// `appliedGroups` is on a rank doc (tournamentRank.js). Keeping the guard on the
// PARENT doc rather than on the entry is what lets the primitives stay
// read-free and therefore composable.
//
// GROWTH, stated precisely so nobody has to re-derive it: at most 62 keys a week
// — 1 allowance + 1 expiry + ALLOWANCE_BP/MIN_STAKE_BP = 20 stakes + one payout
// or refund each + one `loss:` month attribution each (E2, below) — i.e. ~5 KB/
// week worst case, ~20 KiB across the four-week
// beta §10 decides on, against Firestore's 1 MiB document limit. Uncapped like
// `appliedGroups`, but an order of magnitude faster-growing than it (that map
// gains ~1 key/week), so this is a bound worth revisiting before any long-lived
// season, not a shape to copy blindly.
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

import { currentBackingWeek } from './backingWeek.js';
import { ALLOWANCE_BP } from '../../src/constants/backing.js';

/** The collection; the doc id is `walletIdFor(uid, { dev })`. */
export const BACKING_WALLETS_COLLECTION = 'backingWallets';

/** The ledger subcollection under each wallet (§6). */
export const BACKING_WALLET_ENTRIES_SUBCOLLECTION = 'entries';

/**
 * The entry types. The five of §6, plus `loss` — the PR 2 carry-in E2 that
 * closes the season-net gap the header states below (founder ruling Sept 15).
 * Exported so callers and tests name them once.
 */
export const ENTRY_TYPES = Object.freeze({
  ALLOWANCE: 'allowance',
  STAKE: 'stake',
  PAYOUT: 'payout',
  REFUND: 'refund',
  EXPIRY: 'expiry',
  LOSS: 'loss',
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
  // A uid ALREADY INSIDE the dev namespace is refused, because `dev-{uid}` and a
  // raw uid share one id space: `walletIdFor('x', { dev: true })` and
  // `walletIdFor('dev-x')` name the SAME document, so a uid literally spelled
  // `dev-x` would have its production wallet collide with x's dev wallet — two
  // people's ledgers in one doc, and an owner-read rule that cannot tell them
  // apart. Refusing here is what makes the id's meaning unambiguous by
  // construction, which the firestore.rules `ownsBackingWallet` clause relies on.
  //
  // Zero false-positive cost: this product mints uids only through Firebase Auth
  // (email/password, Google, anonymous — src/firebase/authService.js), which are
  // 28-char alphanumerics containing no hyphen, so no reachable uid trips this.
  // It is the operator-minted custom-token path (scripts/ws1-observe-walk.js
  // --uid) that can produce one, and there a loud refusal is the right answer.
  //
  // This deliberately DIVERGES from `rankDocId` / `leaderboardDocId`, which carry
  // the same id shape without the refusal — and can, because `tournamentRanks`
  // and `tournamentLeaderboards` are authed-read-ALL, so they have no owner
  // scoping to subvert. `backingWallets` is the first collection to combine a
  // `dev-` id scheme with an OWNER-scoped read. The mapping for every uid either
  // function accepts is still identical, so the namespaces do not drift; the
  // siblings are reported for separate tasking (BUILD_RULES §3).
  if (uid.startsWith('dev-')) {
    throw new BackingLedgerError(
      'invalid_uid',
      `walletIdFor: a uid inside the dev namespace has an ambiguous wallet id (${uid}) — refused`,
    );
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
  // A re-read RESETS this transaction's remembered state for this wallet.
  // Firestore reuses one Transaction object across retry attempts, so without
  // this a retried settlement would build on the discarded attempt's state.
  forgetWallet(tx, ref?.path);
  const snap = await tx.get(ref);
  return snap.exists ? snap.data() : null;
}

// ==================== INTERNALS ====================

/**
 * The wallet doc as the primitives see it.
 *
 * CARRIES EVERY FIELD THIS MODULE DOES NOT OWN. `commitWallet` writes the whole
 * document (`tx.set`, no merge — the tournamentRank idiom), so anything absent
 * from this object is DESTROYED on the next write. §6's wallet row includes
 * `trainerStats` {season, career} — the private trainer beta-stats PR 5 writes to
 * this same document (D-w) — and `seasons.{m}` carries `poolsBacked`/`poolsWon`/
 * `weeksPlayed` beside `net`. Spreading the original first means a second writer's
 * fields ride through untouched instead of being erased by the first allowance
 * grant of a new week. The rank doc gets away with the same idiom only because it
 * has exactly one writer; this one does not.
 *
 * NUMERICS ARE COERCED TO INTEGERS, not merely checked for finiteness: BP is
 * integer-only (§3), and a fractional cache from a corrupt doc would otherwise
 * mint fractional BP through every later arithmetic step. `allowanceRemaining`
 * rounds DOWN and floors at 0 — flooring can only ever under-credit, and the 0
 * floor stops a negative cache from reading as spendable headroom past
 * `debitStake`'s `< 0` guard. `careerNet` rounds to nearest: it is a record, not
 * a spend limit, so the nearest integer is the most faithful repair. Neither is
 * a substitute for the ledger, which stays the source of truth (§6).
 */
function normalize(walletDoc) {
  const base = walletDoc && typeof walletDoc === 'object' && !Array.isArray(walletDoc) ? walletDoc : {};
  const remaining = Number.isFinite(base.allowanceRemaining) ? Math.floor(base.allowanceRemaining) : 0;
  const seasons = base.seasons && typeof base.seasons === 'object' && !Array.isArray(base.seasons) ? base.seasons : {};
  const applied = base.appliedEntries && typeof base.appliedEntries === 'object' && !Array.isArray(base.appliedEntries)
    ? base.appliedEntries
    : {};
  return {
    ...base,
    lastAllowanceWeek: typeof base.lastAllowanceWeek === 'string' ? base.lastAllowanceWeek : null,
    allowanceRemaining: remaining > 0 ? remaining : 0,
    careerNet: Number.isFinite(base.careerNet) ? Math.round(base.careerNet) : 0,
    seasons,
    appliedEntries: applied,
    createdAt: typeof base.createdAt === 'string' ? base.createdAt : null,
  };
}

// ==================== THE IN-TRANSACTION WALLET STATE ====================

/**
 * `tx` → (wallet doc path → the state this module last wrote in that transaction).
 *
 * WHY THIS EXISTS. Every primitive commits the WHOLE wallet doc, so two
 * primitives composed in one transaction must each build on the previous one's
 * result. The header tells callers to thread the returned wallet, but a contract
 * enforced only by prose fails silently and expensively: a caller that passes the
 * stale doc twice re-mints spent allowance, inflates `careerNet`, and drops the
 * first entry's `appliedEntries` key while its entry document still commits —
 * which un-guards that entry id for replay. PR 3's settlement (§3/§7 void or pay
 * EVERY stake of a pool at once, §2 allows two stakes per pod) is exactly the
 * shape that would trip it. So the module resolves the latest state itself and
 * the contract becomes mechanical (BUILD_RULES §9: bind by construction).
 *
 * KEYED ON (tx, ref.path), NOT ON tx. PR 3 settles many backers' wallets inside
 * one transaction; keying on `tx` alone would make every wallet after the first
 * read another wallet's state.
 *
 * `readWallet` CLEARS its own entry, and that reset is load-bearing. Firestore
 * reuses ONE Transaction object across retry attempts, so a retried settlement
 * would otherwise see the DISCARDED attempt's `appliedEntries`, take the replay
 * path, and write nothing — silently losing a payout while the ledger re-fold
 * still reported zero violations. A retry re-reads, so a re-read resets.
 */
const TX_WALLET_STATE = new WeakMap();

// These three take the wallet's PATH STRING (never the DocumentReference), name
// their payload `nextState` rather than `doc`, and call the transaction `scope`
// rather than `tx`. They touch a Map, not
// Firestore — but the B3-EXT write scanner treats ANY parameter matching
// /^(ref|doc)$|Ref$|Doc$/ as ref evidence and any argument matching
// /^(tx|txn|transaction|batch|writeBatch)$/ as a transaction handle, so a
// helper taking `(tx, ref, doc)` and calling `.set(` is classified as an
// unresolved Firestore write site (compositionProtectedStoresScan.js:79,198,
// 325-332) even when the `.set` is a Map's. Naming them for what they
// actually are keeps that census honest — an allowlist entry here would assert
// a Firestore write that does not exist — and is the narrower dependency
// besides: none of the three needs anything off the ref but its path.

/** The state this module last wrote for `path` in `scope`, else the caller's doc. */
function latestFor(scope, path, walletDoc) {
  const seen = TX_WALLET_STATE.get(scope)?.get(path);
  return seen !== undefined ? seen : walletDoc;
}

function rememberWallet(scope, path, nextState) {
  let byPath = TX_WALLET_STATE.get(scope);
  if (byPath === undefined) {
    byPath = new Map();
    TX_WALLET_STATE.set(scope, byPath);
  }
  byPath.set(path, nextState);
}

function forgetWallet(scope, path) {
  TX_WALLET_STATE.get(scope)?.delete(path);
}

/** A positive integer BP amount, or a typed refusal. BP is integer-only (§3). */
function requireAmount(amount, what) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new BackingLedgerError('invalid_amount', `${what}: amount must be a positive integer BP value, got ${amount}`);
  }
  return amount;
}

/**
 * A readable instant, or a typed refusal. `toIso` throws a bare RangeError on an
 * Invalid Date and silently maps `0`/`null` to the epoch — and `at` is the only
 * audit timestamp the ledger carries, so a 1970 stamp is a silent wrong answer
 * where a throw is owed. PR 2's endpoint reads `.code` / `instanceof`, so the
 * refusal must be typed like every other one here.
 */
function requireInstant(now, where) {
  const ms = now instanceof Date ? now.getTime() : (typeof now === 'string' ? new Date(now).getTime() : NaN);
  if (!Number.isFinite(ms)) {
    throw new BackingLedgerError('invalid_now', `${where}: a readable Date or ISO instant is required, got ${JSON.stringify(now)}`);
  }
  return new Date(ms).toISOString();
}

/** A non-empty string id, or a typed refusal. */
function requireId(value, where, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BackingLedgerError('invalid_id', `${where}: a non-empty ${field} is required, got ${JSON.stringify(value)}`);
  }
  // A `/` would split the entry id into extra path segments and make
  // `.doc(entryId)` an odd-segment path — the Admin SDK throws an UNTYPED error
  // there, inside the caller's transaction, losing the whole stake. Every id
  // here is server-minted today, so this is belt: it keeps the refusal typed.
  // (`.` and `..` are safe precisely because every entry id carries a `type:`
  // prefix, so the id is never bare.)
  if (value.includes('/')) {
    throw new BackingLedgerError('invalid_id', `${where}: ${field} must not contain "/", got ${JSON.stringify(value)}`);
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
  rememberWallet(tx, ref?.path, doc);
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
  const nowIso = requireInstant(now, 'ensureAllowance');
  const resolved = latestFor(tx, ref?.path, walletDoc);
  const current = normalize(resolved);
  const entryId = `${ENTRY_TYPES.ALLOWANCE}:${weekKey}`;

  // ALREADY GRANTED — either the entry is on the ledger, or the wallet is
  // already keyed to this week. The SECOND arm matters: a wallet whose
  // `lastAllowanceWeek` is this week but whose `allowance:` entry is missing is
  // a doc that was reset out of band, and granting again would REFILL it
  // mid-week with no entry recording the BP that vanished. Fail closed.
  if (current.appliedEntries[entryId] !== undefined) {
    return { wallet: resolved ?? current, granted: false, expired: 0 };
  }
  if (current.lastAllowanceWeek === weekKey) {
    throw new BackingLedgerError(
      'allowance_state_anomaly',
      `ensureAllowance: wallet is already keyed to ${weekKey} but carries no ${entryId} entry — refusing to re-grant (the ledger is the record, §6)`,
    );
  }
  // NEVER GO BACKWARDS. Week keys are `YYYY-Www`, zero-padded, so lexical order
  // is chronological. A stale key would expire the LIVE week, re-key the wallet
  // to a dead one, and lock every stake for the live week out of
  // `debitStake` forever — and the §6 cache/ledger re-fold is BLIND to it,
  // because the cache still matches the (wrong) current week's entries.
  if (current.lastAllowanceWeek !== null && weekKey < current.lastAllowanceWeek) {
    throw new BackingLedgerError(
      'week_out_of_order',
      `ensureAllowance: wallet is on ${current.lastAllowanceWeek}; refusing to grant the earlier week ${weekKey}`,
    );
  }

  const appliedEntries = { ...current.appliedEntries };

  // (1) The prior week's remainder expires — recorded, never silently dropped.
  let expired = 0;
  if (current.lastAllowanceWeek !== null && current.allowanceRemaining > 0) {
    const expiryId = `${ENTRY_TYPES.EXPIRY}:${current.lastAllowanceWeek}`;
    if (appliedEntries[expiryId] === undefined) {
      // `expired` is assigned INSIDE the guard, so the returned figure only ever
      // names BP that an entry actually records (§10 may report it).
      expired = current.allowanceRemaining;
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
 * key at settlement, where `creditPayout` / `creditRefund` carry it.
 *
 * THE CONSEQUENCE, STATED EXACTLY, because it constrains PR 3. `seasons.{m}.net`
 * is the sum of the CREDITS attributed to month m — it is NOT §2's Net BP for
 * that month. The two differ by Σ ALL stakes: a stake never receives a month
 * attribution HERE, settled or not. A backer who staked 1,000 and won 650 has
 * `careerNet -350` and, from this primitive alone, `seasons.{m}.net 650`.
 *
 * THE GAP IS CLOSED BY `recordStakeLoss` (PR 2 carry-in E2, founder ruling
 * Sept 15) — the month-attributing primitive for the stake side this docstring
 * asked PR 3 for, now built and tested at the bottom of this module. PR 1's own
 * primitives could not close it (`creditPayout(amount: 0)` is refused, there is
 * no negative credit, and `debitStake` takes no `monthKey`), so E2 adds the
 * primitive rather than widening the credits. PR 2 SHIPS THE PRIMITIVE AND ITS
 * TESTS ONLY; PR 3 calls it at settlement, where the pod's `monthKey` finally
 * exists. Until PR 3 lands, §5's "Net BP (season)" is still the credits-only
 * number and PR 5 must not render it as §2's Net BP.
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
  const nowIso = requireInstant(now ?? new Date(), 'debitStake');
  const resolved = latestFor(tx, ref?.path, walletDoc);
  const current = normalize(resolved);
  const entryId = `${ENTRY_TYPES.STAKE}:${stakeId}`;

  if (current.appliedEntries[entryId] !== undefined) {
    return { wallet: resolved ?? current, applied: false, replay: true };
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
  const nowIso = requireInstant(now ?? new Date(), where);
  const resolved = latestFor(tx, ref?.path, walletDoc);
  const current = normalize(resolved);
  const entryId = `${type}:${stakeId}`;

  if (current.appliedEntries[entryId] !== undefined) {
    return { wallet: resolved ?? current, applied: false, replay: true };
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

// ============ (3b) THE MONTH ATTRIBUTION FOR THE STAKE SIDE (E2) ============

/**
 * Attribute a settled stake's own cost to the month its pod banked in — the PR 2
 * carry-in E2 (founder ruling Sept 15), and the primitive `debitStake`'s
 * docstring above asked for by name.
 *
 * WHY IT EXISTS. §2 defines Net BP as `Σ payouts + Σ refunds − Σ stakes`,
 * attributed to the ET month of the pod's FIRST BANKED DAY. `debitStake` runs
 * when the stake is PLACED — before the pod has battled — so no month key exists
 * yet and it writes none. The result is that `seasons.{m}.net` counts CREDITS
 * ONLY: a backer who staked 1,000 and won 650 reads `+650` for the month when
 * the truth is `−350`. This writes the missing half.
 *
 * Writes `loss:{stakeId}` (delta `−amount`, carrying `groupId` and `monthKey`
 * like its credit siblings) and moves `seasons.{monthKey}.net` by `−amount`.
 *
 * IT DOES NOT TOUCH `careerNet`, AND THAT IS A DELIBERATE DIVERGENCE FROM THE
 * LETTER OF THE RULING, which named both fields. `careerNet` is ALREADY exactly
 * §2's Net BP — `debitStake` subtracted the stake from it at placement — so a
 * second `−amount` here would double-debit it and turn the ruling's own worked
 * example (`−350`) into `−1,350`. The ruling's arithmetic is what settles it:
 * `−350` is the number it asks for, and the season bucket is the only field that
 * does not already produce it. The divergence is asserted, not merely argued:
 * `backingWallet.test.js` pins the ruling's example end to end.
 *
 * NEVER `allowanceRemaining` (§2), like both credits: this is a RECORD entry, and
 * the week's allowance expires on its own schedule whatever a pod later pays.
 *
 * THE CALLER'S RULE, and PR 3 owns following it: call this ONCE for the stake
 * side of every stake that reaches a month attribution — the LOST path (which
 * has no credit at all), and the WON path beside its `creditPayout`. Calling it
 * only for losers leaves each winner's own stake unattributed and the ruling's
 * example reads `+150` instead of `−350`; the test named "the founder's worked
 * example" pins that too, so the rule cannot be half-applied silently.
 *
 * A VOIDED STAKE IS THE ONE PATH THIS DOES NOT COVER, per the ruling's explicit
 * carve-out ("for voided stakes writes nothing — the stake's own debit is already
 * reversed by the refund"). True of `careerNet`, which nets to zero; the season
 * bucket, though, keeps the refund's `+amount` with no stake-side `−amount`
 * against it, so a voided pool still reads `+stake` for its month. PR 2 leaves
 * that residue EXACTLY as the ruling specifies rather than quietly widening the
 * carve-out — closing it is one call at PR 3's void sites, and the test named
 * "the voided residue" measures it so the decision is made on a number.
 *
 * IDEMPOTENT on `loss:{stakeId}`, like every sibling: a replayed settlement is a
 * no-op, which is what makes PR 3's `resolving → resolved` re-read and the admin
 * re-run safe.
 */
export function recordStakeLoss(tx, ref, walletDoc, { stakeId, groupId, amount, monthKey, now } = {}) {
  const where = `recordStakeLoss`;
  requireId(stakeId, where, 'stakeId');
  requireId(groupId, where, 'groupId');
  requireId(monthKey, where, 'monthKey');
  requireAmount(amount, where);
  const nowIso = requireInstant(now ?? new Date(), where);
  const resolved = latestFor(tx, ref?.path, walletDoc);
  const current = normalize(resolved);
  const entryId = `${ENTRY_TYPES.LOSS}:${stakeId}`;

  if (current.appliedEntries[entryId] !== undefined) {
    return { wallet: resolved ?? current, applied: false, replay: true };
  }

  writeEntry(tx, ref, entryId, {
    type: ENTRY_TYPES.LOSS,
    delta: -amount,
    ref: stakeId,
    groupId,
    monthKey,
    at: nowIso,
  });

  const season = current.seasons[monthKey] ?? {};
  const seasonNet = Number.isFinite(season.net) ? season.net : 0;
  const wallet = commitWallet(tx, ref, {
    ...current,
    // NEVER careerNet (already carried by the stake's own debit) and NEVER
    // allowanceRemaining (§2) — see the docstring.
    seasons: { ...current.seasons, [monthKey]: { ...season, net: seasonNet - amount } },
    appliedEntries: { ...current.appliedEntries, [entryId]: nowIso },
  }, nowIso);
  return { wallet, applied: true, replay: false };
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
