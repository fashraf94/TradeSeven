// api/_utils/backingStake.js
//
// Backing activation — THE STAKE PRIMITIVE (spec V1.3 §8 "one transaction per
// stake", §3 sealed pools, §4 the window and the battle-doc belt, §6 shapes;
// Amendment A §A2/§A3 through backingEligibility.js; Amendment B §B2/§B5 the
// counter split; Amendment C §C2 one stake per team, a repeat tops up).
//
// WHAT MOVED HERE, AND WHY. Until the activation PR the whole stake — the two
// lazy jobs and the single transaction — lived inside the route handler
// (api/tournament/backing-stake.js), which was the only caller. The founder
// smoke (§11 gate 4) needs a second caller: scripts/backing-smoke.js places the
// two synthetic backers' stakes THROUGH THIS PRIMITIVE, never by raw writes, so
// the pool the founder walks was built by the same transaction his own stake
// runs through. The body below is the route's, moved verbatim: the reads, the
// check order (window → belt → eligibility → allowance → cap → debit), the
// refusal-by-throw rule after the first buffered write, and the four writes.
// The route now validates the request, calls `placeStake`, and answers.
//
// THE ONE ADDITION TO THE WRITE: `poolId` on a NEW stake document — the pool
// this stake sits in, `groupId` or `dev-{groupId}` (`poolIdFor`). The client
// subscribes to a backed pod's pool by this id (src/hooks/useMyBacking.js),
// which is how a smoke stake on a dev pod reaches Your Backing and the strip
// (the PR 4 review record's SEAL-2, the client half). A top-up carries the
// document's own `poolId` through; a document written before this field
// reads its pool at `groupId`, as before.
//
// TWO SMOKE ARGUMENTS, both OFF by default and passed by the route ONLY for a
// smoke user (api/_utils/backingSmoke.js):
//   · `smoke` — this caller is a smoke session: a stake on anything but an
//     `isDev` pod is REFUSED (`smoke_requires_dev`) before any write, so a
//     smoke session can never create a production pool, stake, wallet entry
//     or event;
//   · `allowDev` — `materializePool`'s dev opt-in, so the founder's first read
//     can open a dev pod's pool when the seeder has not already.
//
// `checkEligibility` is the §8 eligibility check, `checkBackingEligibility` by
// default — the route never passes another (its suite pins that). The smoke
// script passes its own for the SYNTHETIC backers it invents: the two account
// facts a synthetic user cannot hold (a consent record, a completed battle) are
// asserted by the seeder that made it, while the two POD facts — own-pod and
// seat-present — still run through the real `seatedIdsFor`. The founder's own
// stake goes through the untouched route on the preview.
//
// THE WRITES ARE ALLOWLISTED (compositionProtectedStoresAllowlist.json,
// Amendment A §A6) at this module's keys — the route's four keys moved with the
// body. See the route's header for the full account of each write.
//
// Imports the zero-import constants modules from src/ under the revised June
// 2026 import rule (BUILD_RULES §4); the co-located test's real import of THIS
// module is the dependency-surface guard — never mock it.

import { backingWeekFor } from './backingWeek.js';
import {
  BACKING_STAKES_COLLECTION,
  POOL_STATUS,
  STAKE_STATUS,
  ensureClosed,
  liveTeamsFor,
  materializePool,
  poolIdFor,
  poolRefFor,
  poolTotalsRefFor,
  readGroup,
  publicProgressChanged,
  publicProgressFrom,
  stakeablePod,
  totalsFromBackers,
} from './backingPools.js';
import { checkBackingEligibility } from './backingEligibility.js';
import {
  BACKING_WALLET_ENTRIES_SUBCOLLECTION,
  debitStake,
  ensureAllowance,
  readWallet,
  stakeEntryIdFor,
  walletRef,
} from './backingWallet.js';
import { hashFingerprint } from './backingFingerprint.js';
import { MIN_STAKE_BP, PER_TEAM_CAP_BP } from '../../src/constants/backing.js';
import { TOURNAMENT_GAME_MODE, TOURNAMENT_GROUPS_COLLECTION } from '../../src/constants/leagueTournament.js';

/** The sealed per-stake document E1 moves the fingerprint into (§6, §8). */
export const STAKE_PRIVATE_SUBCOLLECTION = 'private';
export const STAKE_META_DOC = 'meta';

/** The longest `requestId` a stake accepts — an opaque client string. */
export const MAX_REQUEST_ID_LEN = 200;

/** The refusal a SMOKE session gets for a stake on anything but an `isDev` pod. */
export const SMOKE_REQUIRES_DEV = 'smoke_requires_dev';

/**
 * The stake's DETERMINISTIC document id, from (uid, groupId, teamOdUserId) —
 * THE ONE stake a backer holds on a team in a pool (D-ag, Amendment C §C2;
 * `poolId = groupId`, §1).
 *
 * Making (backer, pool, team) the DOC ID rather than a query is what makes
 * "one per team" structural: a second request on the same team contends on
 * the same document inside the stake transaction and tops it up — there is
 * no second document for a later pass to reconcile. The uid is mixed in so
 * one backer's team can never name another backer's stake.
 *
 * Hashed rather than concatenated: the ids are opaque strings, and a hash is
 * path-safe and fixed-length by construction. It is NOT a secret — the id is
 * returned to its own owner — so SHA-256 here is a namespacing function, not a
 * security control.
 */
export function stakeIdFor(uid, groupId, teamOdUserId) {
  // LENGTH-PREFIXED, not separator-joined: `a|b` + `c` and `a` + `b|c` would
  // hash to one string under a bare separator, so two different triples could
  // name one document. An injective encoding costs nothing.
  const key = `${uid.length}:${uid}|${groupId.length}:${groupId}|${teamOdUserId.length}:${teamOdUserId}`;
  return `stk_${hashFingerprint(`stake-team\n${key}`, { salted: false }).slice(0, 40)}`;
}

/**
 * The REQUEST's debit key, from (uid, requestId) — §8's idempotency key for
 * ONE submission (a stake or a top-up), and the key of its ledger entry,
 * `stake:{debitKey}` (D-ag). Two racing submissions of the same request
 * derive the same key, so the second finds it on the document (a replay) or
 * on the ledger (a reuse); two DIFFERENT requests are two debits against one
 * document. The uid is mixed in so one caller's requestId never collides with
 * another's; hashed because the client's string is OPAQUE — it may carry `/`,
 * unicode, or 200 characters, and the key names a document.
 */
export function stakeDebitKeyFor(uid, requestId) {
  // LENGTH-PREFIXED, not newline-joined: `a\nb` + `c` and `a` + `b\nc` must
  // not name one request. No Firebase uid contains a newline, but the repo
  // documents an operator custom-token path that mints arbitrary uids.
  const key = `${uid.length}:${uid}|${requestId.length}:${requestId}`;
  return `dbt_${hashFingerprint(`stake-debit\n${key}`, { salted: false }).slice(0, 40)}`;
}

/**
 * The debits that funded a stake document — one `{ entryId, amount, at }` per
 * request, first to last. A document WITHOUT `debits[]` at the deterministic
 * id — reachable only by an out-of-band write — is read as the one debit its
 * own id keyed (`stake:{stakeId}`). It does NOT reach a stake written before
 * D-ag: those live at the old (uid, requestId) id, which nothing reads any
 * more, so a pre-cleanup request replayed after this deploy would be a new
 * request (the review record's MONEY-2). None exists in production — the flag
 * has been false on main throughout.
 */
export function debitsOf(stake, stakeId) {
  if (Array.isArray(stake?.debits)) return stake.debits;
  if (stake == null) return [];
  return [{ entryId: stakeEntryIdFor(stakeId), amount: stake.amount, at: stake.placedAt ?? null }];
}

/** The `backingStakes/{stakeId}` reference. */
export function stakeRefFor(db, stakeId) {
  return db.collection(BACKING_STAKES_COLLECTION).doc(stakeId);
}

/** The sealed `backingStakes/{stakeId}/private/meta` reference (E1). */
export function stakeMetaRefFor(db, stakeId) {
  return stakeRefFor(db, stakeId)
    .collection(STAKE_PRIVATE_SUBCOLLECTION)
    .doc(STAKE_META_DOC);
}

/**
 * The seat's current loadout hash, or null (§4 — disclosure, never contract).
 *
 * Reads the seat owner's LATEST COMPLETED BATTLE through the existing
 * `(ownerId, status, completedAt)` composite and takes the hash the battle doc
 * already persists — §4's own named fallback ("the latest battle's persisted
 * hash… labeled 'as of last deploy'"), which avoids running the customization
 * kernel inside a request that must not get slower. ZERO new indexes.
 *
 * CPU seats return null without a read: all CPUs share one hash, so §1 suppresses
 * the loadout marker for them entirely, and `cpu-{n}` owns no battle anyway.
 *
 * NEVER THROWS. A stake is not failed over a telemetry field: any error is logged
 * and answered `null`, which the results card reads as "no hash recorded".
 */
export async function resolveHashAtStake(db, teamOdUserId, { isCpu = false } = {}) {
  if (isCpu === true) return null;
  try {
    const snap = await db.collection('agentBattles')
      .where('ownerId', '==', teamOdUserId)
      .where('status', '==', 'completed')
      .orderBy('completedAt', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const hash = snap.docs[0].data()?.resolvedAgentManifest?.equippedConfigHash;
    return typeof hash === 'string' && hash.length > 0 ? hash : null;
  } catch (err) {
    console.warn('[backing-stake] hashAtStake unresolvable (telemetry only):', err?.message);
    return null;
  }
}

/**
 * Does a tournament battle doc already exist for this pod? (§4's belt.)
 *
 * ONE equality filter on `groupId` — the automatic single-field index, the
 * `api/tournament/battle-view.js` precedent — then `gameMode` in memory, because
 * a group has at most four battles and a second filter would need a composite
 * this PR is not allowed to add. The `gameMode` check is not optional: tiered
 * battles carry no groupId today, and the belt must mean "THIS pod's tournament
 * drafts exist", not "some doc mentions this id".
 */
export async function tournamentBattleExists(db, reader, groupId) {
  const snap = await reader(db.collection('agentBattles').where('groupId', '==', groupId));
  let found = false;
  snap.forEach((doc) => { if (doc.data()?.gameMode === TOURNAMENT_GAME_MODE) found = true; });
  return found;
}

/**
 * A refusal raised from INSIDE the transaction, after the first buffered write.
 *
 * Exists because the Admin SDK commits a transaction body that returns and rolls
 * back only one that throws: every refusal downstream of a write must therefore
 * leave by throwing, or a refused stake commits half of itself. Carries the
 * response payload so the answer is identical to a returned refusal's.
 */
export class StakeRefusal extends Error {
  constructor(statusCode, code, payload = {}) {
    super(code);
    this.name = 'StakeRefusal';
    this.statusCode = statusCode;
    this.code = code;
    this.payload = payload;
  }
}

/** A malformed argument is a typed 400 — the route validated the body already; the script relies on this belt. */
function requireStakeArgs({ uid, groupId, teamOdUserId, amount, requestId }) {
  const id = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200 && !v.includes('/');
  if (!id(uid)) throw new StakeRefusal(400, 'invalid_uid');
  if (!id(groupId)) throw new StakeRefusal(400, 'invalid_group_id');
  if (!id(teamOdUserId)) throw new StakeRefusal(400, 'invalid_team');
  if (!Number.isInteger(amount)) throw new StakeRefusal(400, 'invalid_amount');
  if (amount < MIN_STAKE_BP) throw new StakeRefusal(400, 'below_min_stake');
  if (amount > PER_TEAM_CAP_BP) throw new StakeRefusal(400, 'above_team_cap');
  if (typeof requestId !== 'string' || requestId.length === 0 || requestId.length > MAX_REQUEST_ID_LEN) {
    throw new StakeRefusal(400, 'invalid_request_id');
  }
}

/**
 * Place ONE stake (or top one up): the two lazy jobs, then the §8 transaction.
 *
 * @param {Object} db the Admin SDK handle.
 * @param {Object} args
 * @param {string} args.uid            the backer — a VERIFIED uid (the token's, or the seeder's synthetic one).
 * @param {Object} args.decodedToken   the verified token (its sign-in provider is read; D-ab).
 * @param {string} args.groupId
 * @param {string} args.teamOdUserId
 * @param {number} args.amount         whole BP, within [MIN_STAKE_BP, PER_TEAM_CAP_BP].
 * @param {string} args.requestId      this submission's idempotency key.
 * @param {{ipHash?: string, uaHash?: string}} [args.fingerprint] the sealed meta's fingerprint (E1).
 * @param {Date} [args.now]
 * @param {boolean} [args.smoke]       this caller is a smoke session — dev pods only.
 * @param {boolean} [args.allowDev]    `materializePool`'s dev opt-in.
 * @param {Function} [args.checkEligibility] the §8 checker; `checkBackingEligibility` by default.
 * @returns {Promise<{refusal: {status: number, error: string}} | {
 *   replay: boolean, topUp: boolean, added: number, stake: Object, pool: Object|null, wallet: Object|null,
 *   stakeId: string, debitKey: string, group: Object, seat: Object|undefined }>}
 *   A refusal decided BEFORE the first buffered write returns; one decided
 *   after it throws `StakeRefusal` (the transaction rolls back). The ledger's
 *   and the pool's own typed errors propagate as they are.
 */
export async function placeStake(db, {
  uid, decodedToken = null, groupId, teamOdUserId, amount, requestId,
  fingerprint = {}, now = new Date(), smoke = false, allowDev = false,
  checkEligibility = checkBackingEligibility,
} = {}) {
  requireStakeArgs({ uid, groupId, teamOdUserId, amount, requestId });
  const at = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(at.getTime())) throw new StakeRefusal(400, 'invalid_now');

  // THE ONE DOCUMENT for this (backer, pool, team), and THIS REQUEST's debit
  // (D-ag): a top-up is a second debit against the same document.
  const stakeId = stakeIdFor(uid, groupId, teamOdUserId);
  const debitKey = stakeDebitKeyFor(uid, requestId);
  const entryId = stakeEntryIdFor(debitKey);

  // 6. The pod, then the two lazy jobs §4/§7 put on the stake path.
  const group = await readGroup(db, groupId);
  if (group == null) {
    // A deleted pod still refunds whatever its pool held (§7); the stake
    // itself has nowhere to go.
    await ensureClosed(db, groupId, at);
    return { refusal: { status: 409, error: 'no_pod', message: 'That pod is no longer available.' } };
  }
  // A SMOKE SESSION BACKS DEV PODS ONLY — decided on the pod's own `isDev`,
  // before any write, so a smoke stake can never reach a production pool,
  // wallet or event. The pod list already shows a smoke user nothing else;
  // this is the belt behind it.
  if (smoke === true && group.isDev !== true) {
    return { refusal: { status: 409, error: SMOKE_REQUIRES_DEV, message: 'A smoke session backs dev pods only.' } };
  }
  const materialized = await materializePool(db, group, at, { allowDev: allowDev === true });
  if (materialized.pool == null) {
    return { refusal: { status: 409, error: 'no_pool', message: 'That pod is not open for backing.', reason: materialized.reason } };
  }
  await ensureClosed(db, group, at);

  // `hashAtStake` — resolved here, OUTSIDE the transaction, on purpose: it is
  // telemetry (§4, disclosure not contract), it costs a query, and a
  // transaction that retried would pay for it again. A seat that is not
  // seated at all resolves to null and the transaction refuses the stake on
  // its own seat-present check, so this never decides anything.
  const seat = liveTeamsFor(group).find((t) => t.odUserId === teamOdUserId);
  const hashAtStake = await resolveHashAtStake(db, teamOdUserId, { isCpu: seat?.isCpu === true });

  // 7. ONE transaction.
  const outcome = await db.runTransaction(async (tx) => {
    // ---- READ: the replay probe, FIRST — the team's ONE stake document
    // (D-ag). A duplicate submission is answered from the document it
    // already funded, whatever the window now says — that is what "returns
    // the existing stake unchanged and writes nothing" means.
    const existing = await tx.get(stakeRefFor(db, stakeId));
    const prior = existing.exists ? existing.data() : null;
    if (prior != null) {
      // THE DOCUMENT MUST BE THIS CALLER'S STAKE ON THIS TEAM. The id mixes
      // the uid, the pod and the team before hashing, so nothing reachable
      // lands another backer's document here; refusing — rather than
      // answering or topping up whatever sits at the id — means a collision
      // or an out-of-band write can never hand a rival the victim's team and
      // amount while the pool is sealed (§3), nor spend into their stake.
      if (prior.userId !== uid || prior.groupId !== groupId || prior.teamOdUserId !== teamOdUserId) {
        return { refusal: { status: 409, error: 'request_id_conflict' } };
      }
      // A REPLAY IS A REPLAY OF *THIS* REQUEST: its debit is on the
      // document's `debits[]`. The BODY must match — a `requestId` reused
      // for a different amount would otherwise get 200 and a stake it did
      // not ask for; §8 makes a duplicate submission a no-op, not a silent
      // substitution. (Reused for a different pod or team, the request is
      // found on the LEDGER instead — the pre-check below.)
      const debits = debitsOf(prior, stakeId);
      const index = debits.findIndex((d) => d?.entryId === entryId);
      if (index >= 0) {
        if (debits[index].amount !== amount) {
          return { refusal: { status: 409, error: 'request_id_conflict' } };
        }
        return { replay: true, topUp: index > 0, added: debits[index].amount, stake: { id: stakeId, ...prior } };
      }
    }

    // ---- READ: the pod and the pool, transactionally. The pool doc is also
    // the serialization point against a racing close.
    const groupSnap = await tx.get(db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId));
    if (!groupSnap.exists) return { refusal: { status: 409, error: 'no_pod' } };
    const txGroup = { id: groupId, ...groupSnap.data() };
    // THE PREDICATE THE POD LIST IS BUILT ON (§9 — one source, two scopes).
    // Without it the two endpoints disagree: `materializePool` returns an
    // existing pool unchanged whatever the pod's status has become, so a pod
    // that went `voided` or `expired` mid-week would vanish from the list and
    // keep taking stakes. Deliberately the STAKEABLE predicate and not the
    // listable one: the dev exclusion is the list's (D-DEVFIELD), and
    // refusing dev pods here would make §11 gate 4's founder smoke — a real
    // stake on a dev pod, in the `dev-` namespace — impossible.
    if (!stakeablePod(txGroup)) return { refusal: { status: 409, error: 'no_pool' } };
    // The smoke belt again, on the FRESH read: a pod that is not dev on this
    // read is not a smoke session's to back.
    if (smoke === true && txGroup.isDev !== true) return { refusal: { status: 409, error: SMOKE_REQUIRES_DEV } };

    const poolRef = poolRefFor(db, txGroup);
    const poolSnap = await tx.get(poolRef);
    if (!poolSnap.exists) return { refusal: { status: 409, error: 'no_pool' } };
    const pool = poolSnap.data();

    // ---- CHECK 1: the window, on the SERVER clock (§4, §8). BOTH ENDS.
    if (pool.status !== POOL_STATUS.OPEN) {
      return { refusal: { status: 409, error: 'pool_closed', poolStatus: pool.status } };
    }
    // The near end. `materializePool` already refuses to OPEN a pool before
    // its `opensAt`, so a pool that exists has normally passed this; the
    // clause is here because the stake is the one path that moves BP, and a
    // pool written by an earlier deploy, a clock skew, or a seeder must not
    // be stakeable before its backing week starts (§4, §2 — every stake on a
    // pool is drawn from ONE allowance, and a stake in that gap would re-key
    // the wallet to next week and expire this week's).
    const opensMs = new Date(pool.opensAt).getTime();
    if (Number.isFinite(opensMs) && at.getTime() < opensMs) {
      return { refusal: { status: 409, error: 'pool_not_open', opensAt: pool.opensAt } };
    }
    // The far end.
    if (at.getTime() >= new Date(pool.closesAt).getTime()) {
      return { refusal: { status: 409, error: 'pool_closed', poolStatus: pool.status } };
    }

    // ---- CHECK 2: the battle-doc belt (§4). Read inside the transaction so a
    // draft that lands mid-request cannot be straddled.
    if (await tournamentBattleExists(db, (q) => tx.get(q), groupId)) {
      return { refusal: { status: 409, error: 'battle_started' } };
    }

    // ---- CHECK 3: eligibility (§8) — against the group THIS transaction read.
    const eligibility = await checkEligibility(db, {
      uid,
      decodedToken,
      group: txGroup,
      teamOdUserId,
    });
    if (!eligibility.allowed) {
      return { refusal: { status: 403, error: eligibility.reason } };
    }

    // ---- READ: this backer's stakes this week (the committed
    // (userId, weekKey) composite), the sealed totals, and the wallet.
    const week = backingWeekFor(pool.battleMondayEtDate);
    if (week == null) return { refusal: { status: 409, error: 'no_pool' } };
    const weekKey = week.weekKey;

    const mineSnap = await tx.get(
      db.collection(BACKING_STAKES_COLLECTION)
        .where('userId', '==', uid)
        .where('weekKey', '==', weekKey),
    );
    let onThisTeam = 0;
    mineSnap.forEach((doc) => {
      const s = doc.data();
      if (s.groupId === groupId && s.teamOdUserId === teamOdUserId && s.status === STAKE_STATUS.LIVE) {
        onThisTeam += Number.isFinite(s.amount) ? s.amount : 0;
      }
    });

    const totalsRef = poolTotalsRefFor(db, txGroup);
    const totalsSnap = await tx.get(totalsRef);
    const backers = totalsSnap.exists && totalsSnap.data()?.backers
      ? structuredClone(totalsSnap.data().backers)
      : {};

    const wRef = walletRef(db, uid, { dev: pool.isDev === true });
    const wallet0 = await readWallet(tx, wRef);

    // The sealed meta, read BEFORE any write so an admin's `excluded` flag
    // survives (see the write below). Present on every TOP-UP (the stake's
    // own meta, which a top-up extends); on a first stake normally absent —
    // present only when a parent stake was deleted out of band, since
    // Firestore does not cascade-delete a subcollection.
    const metaSnap = await tx.get(stakeMetaRefFor(db, stakeId));
    const priorMeta = metaSnap.exists ? metaSnap.data() : null;

    // ---- THE REQUEST IS ALREADY ON THE LEDGER, and this team's document
    // does not carry it (the probe above would have answered it). So this
    // `requestId` funded ANOTHER stake — a different pod or team — or a
    // document removed out of band. Either way it is spent: refuse, BEFORE
    // the first write. Which of the two is read off the entry's own `ref`
    // (the document it funded), one extra read on this path only.
    if (wallet0?.appliedEntries?.[entryId] !== undefined) {
      const spent = await tx.get(wRef.collection(BACKING_WALLET_ENTRIES_SUBCOLLECTION).doc(entryId));
      const fundedThisStake = spent.exists && spent.data()?.ref === stakeId;
      return { refusal: { status: 409, error: fundedThisStake ? 'stake_already_spent' : 'request_id_conflict' } };
    }

    // ---- A STAKE THAT IS NO LONGER LIVE IS NOT TOPPED UP. Every path that
    // settles or voids a stake runs on a pool the window has already closed,
    // so this is an out-of-band state (an admin's hand on the document); a
    // top-up would revive it — refused, before the first write.
    if (prior != null && prior.status !== STAKE_STATUS.LIVE) {
      return { refusal: { status: 409, error: 'stake_not_live' } };
    }

    // ---- CHECK 4a: the allowance for THIS POOL'S backing week, granted
    // lazily if this is the first touch (§2, D-h). Threaded onward per the
    // PR 1 module contract — the stale doc is never re-read.
    const { wallet: wallet1 } = ensureAllowance(tx, wRef, wallet0, weekKey, at);

    // ---- CHECK 4b: the per-team cap, against this backer's EXISTING live
    // stakes on this team (§8). Read from the stake documents, not from the
    // sealed cache: the stakes are the ledger and the cache is derived.
    //
    // IT THROWS RATHER THAN RETURNING, and that is the whole point. The
    // Admin SDK COMMITS a transaction whose body returns normally and ROLLS
    // BACK only one that throws (`Transaction.runTransaction`), so a refusal
    // RETURNED here — after `ensureAllowance` has already buffered the
    // week's grant and, when the prior week held a remainder, its expiry —
    // would commit a partial transaction: a refused stake that silently
    // re-keyed the wallet. Throwing restores the invariant every other
    // refusal on this route already has: nothing downstream of the first
    // buffered write may refuse by returning. `debitStake`'s own refusals
    // (`week_mismatch`, `insufficient_allowance`) throw for the same reason.
    //
    // The §12 check order is unchanged — allowance, then cap, then debit —
    // because the fix is HOW the refusal leaves, not WHERE the check sits.
    //
    // THE CAP IS ON THE TOTAL (D-ag): `onThisTeam` is every live stake this
    // backer holds on the team — the one document a top-up adds to — so the
    // check is the NEW total against the cap, never the request alone.
    //
    // A BELT (the review record's MONEY-5): the base is never below the
    // document this request tops up. The (userId, weekKey) query carries it
    // whenever its `weekKey` is the pool's — always, unless written out of
    // band — and a drifted document must not let a top-up past the cap.
    const capBase = Math.max(onThisTeam, Number.isFinite(prior?.amount) ? prior.amount : 0);
    if (capBase + amount > PER_TEAM_CAP_BP) {
      throw new StakeRefusal(409, 'per_team_cap', { staked: capBase, cap: PER_TEAM_CAP_BP });
    }

    // ---- CHECK 4c: the debit. Refuses `insufficient_allowance` (typed).
    // ONE DEBIT PER REQUEST (D-ag): the entry is `stake:{debitKey}`, its
    // `ref` the one stake document the debit funds.
    const debit = debitStake(tx, wRef, wallet1, { stakeId, entryKey: debitKey, amount, weekKey, now: at });
    // A REPLAYED LEDGER ENTRY IS NEVER A STAKE. The wallet's
    // `appliedEntries` guard makes `stake:{debitKey}` a no-op the second
    // time, so a request whose debit is already on the ledger would
    // otherwise land on the document FOR FREE — no debit, the pot and the
    // stake's total incremented anyway, and (for a document deleted out of
    // band — Firestore does not cascade-delete, so its `private/meta`
    // survives) the admin's `excluded` flag overwritten. The ledger
    // pre-check above answers every such request before the first write;
    // this throw is the belt behind it.
    if (debit.replay === true) {
      throw new StakeRefusal(409, 'stake_already_spent');
    }
    const wallet2 = debit.wallet;

    // ---- WRITE 5: the stake (§6 shape) — the ONE document for this team,
    // created or TOPPED UP (D-ag) — plus its sealed meta (E1).
    const nowIso = at.toISOString();
    const thisDebit = { entryId, amount, at: nowIso };
    const topUp = prior != null;
    const stake = topUp
      ? {
        // The document as it stands — its first placement, request, hash and
        // any field another writer owns ride through — with the new TOTAL
        // and this request's debit appended. Σ debits = amount, always.
        ...prior,
        amount: prior.amount + amount,
        debits: [...debitsOf(prior, stakeId), thisDebit],
      }
      : {
        userId: uid,
        groupId,
        // The pool this stake sits in — `groupId`, or `dev-{groupId}` for a
        // dev pod — so the client subscribes to the right document (the
        // activation PR; SEAL-2's client half).
        poolId: poolIdFor(txGroup),
        teamOdUserId,
        amount,
        hashAtStake,
        placedAt: nowIso,
        weekKey,
        requestId,
        status: STAKE_STATUS.LIVE,
        debits: [thisDebit],
      };
    tx.set(stakeRefFor(db, stakeId), stake);
    // The sealed meta (E1). `excluded` is an ADMIN fact and is written here
    // only on a doc that does not yet carry one — `metaSnap` is read above,
    // before any write — so a stake this path creates can never clear an
    // exclusion an admin had already set. A TOP-UP keeps the first
    // placement's fingerprint where the Sybil watch reads it and appends its
    // own beside it (`topUps[]`, each naming the debit it made), so a second
    // address or device on the same stake is recorded, never written over —
    // and the watch reads every placement (api/_utils/backingSybilWatch.js).
    const fp = fingerprint && typeof fingerprint === 'object' ? fingerprint : {};
    tx.set(stakeMetaRefFor(db, stakeId), topUp && priorMeta != null
      ? { ...priorMeta, excluded: priorMeta.excluded === true, topUps: [...(Array.isArray(priorMeta.topUps) ? priorMeta.topUps : []), { ...fp, entryId, at: nowIso }] }
      : { ...fp, excluded: priorMeta?.excluded === true, at: nowIso });

    // ---- WRITE 6: THE SPLIT (Amendment B §B2/§B5). The true totals — the
    // pot and the exact counts — go to the SEALED doc; the public document
    // gets the threshold-capped pair and nothing else, and often gets
    // nothing at all.
    //
    // Both halves still derive from ONE updated `backers` map through ONE
    // fold (§9), so the sealed numbers and the public signals cannot
    // disagree: the cap is applied to the fold's output, not computed from a
    // second count.
    const mine = backers[uid] ?? (backers[uid] = { total: 0, byTeam: {} });
    mine.byTeam[teamOdUserId] = (mine.byTeam[teamOdUserId] ?? 0) + amount;
    mine.total += amount;
    const totals = totalsFromBackers(backers);
    tx.set(totalsRef, { ...totals.private, updatedAt: nowIso });

    // AND NO PUBLIC WRITE WHEN THE CAPPED VALUES DO NOT MOVE. Above the
    // floors `publicProgressFrom` is constant, so this is always the case
    // once both thresholds are met — an above-threshold stake leaves the
    // public document BYTE-IDENTICAL, which is the whole point of §B2's
    // freeze. Skipping the write, rather than writing the same values, is
    // what makes it byte-identical: `backingPools/{poolId}` is authed-read
    // and therefore an `onSnapshot` stream, so a bare `updatedAt` bump would
    // itself publish "someone just staked" to every spectator watching.
    const progress = publicProgressFrom(totals);
    let nextPool = pool;
    if (publicProgressChanged(pool, progress)) {
      nextPool = { ...pool, ...progress, updatedAt: nowIso };
      tx.set(poolRef, nextPool);
    }

    return { replay: false, topUp, added: amount, stake: { id: stakeId, ...stake }, pool: nextPool, wallet: wallet2 };
  });

  if (outcome.refusal) return outcome;
  return { ...outcome, stakeId, debitKey, group, seat };
}
