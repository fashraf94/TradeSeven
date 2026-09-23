// api/tournament/backing-stake.js
//
// POST /api/tournament/backing-stake — Backing Beta PR 2, THE STAKE (spec V1.3
// §8 "one transaction per stake", §3 sealed pools, §4 the window and the
// battle-doc belt, §6 shapes, §12 PR 2; Amendment A §A2/§A3 via
// backingEligibility.js, §A6 for the allowlist).
//
// THE ORDER, and the tests pin every rung of it:
//   1  security middleware + rate limit
//   2  method — POST only
//   3  auth — the uid from the VERIFIED token, never the body
//   4  THE FLAG — 404 while BACKING_BETA_ENABLED is dark, AFTER auth (the
//      SHOW_IT_ENABLED / research.js shape: a 404 in front of the auth check
//      answers an anonymous caller differently while dark and while lit, which
//      is a free oracle on an unreleased feature's rollout state)
//   5  body — { groupId, teamOdUserId, amount, requestId }, each refusal a plain
//      reason, nothing read
//   6  lazy pool materialization (§4 — the stake endpoint is one of the two
//      materializers) and `ensureClosed` (§7 — the close runs on the first read
//      after `closesAt`), both BEFORE the stake transaction so the transaction
//      never has to reason about a pool that should already have closed
//   7  ONE transaction: read group + pool + the replay probe + this backer's
//      stakes + the sealed totals + the wallet, then window → belt → eligibility
//      → allowance → cap → debit → write.
//
// THE CLOCK IS THE LEGIBLE DEADLINE; THE BATTLE DOC IS THE TRUTH (§4). Both are
// checked, in that order, and the belt is not a formality: a lobby pod's drafts
// resolve at Monday's first tick and a slot pod's picks land after fire, so the
// existence of ANY `agentBattles` doc for this group with
// `gameMode === 'baggerbomb_tournament'` means the drafts are visible and the
// window is over whatever the clock says.
//
// ONE TRANSACTION, AND WHY IT MUST BE ONE (§8). Allowance, the per-team cap, the
// seat's presence, the window and the debit are decided against the SAME
// snapshot that the write lands on. Two simultaneous submissions serialize on
// the WALLET document — both read it, both write it, so Firestore lets exactly
// one commit and re-runs the other against the committed balance. A close racing
// a stake serializes on the POOL document the same way. The idempotency keys in
// play are three, each guarding a different failure:
//   · (backer, pool, team) → the stake's DETERMINISTIC doc id (D-ag,
//     Amendment C §C2): a backer holds ONE stake per team per pool, and backing
//     that team again tops up the same document — see below;
//   · `requestId` → the REQUEST's debit key: the ledger entry
//     `stake:{debitKey}` and the stake document's `debits[]` both carry it, so
//     a double-submit is one debit and a replay returns the stake unchanged,
//     writing nothing, while a distinct top-up is a distinct debit;
//   · the pool's STATUS → a closed pool refuses, so a stake cannot land after
//     the close transaction has frozen the seats.
//
// ONE STAKE PER TEAM PER BACKER; A REPEAT TOPS UP (Amendment C §C2, D-ag). The
// stake document's id derives from (uid, groupId, teamOdUserId) — `poolId =
// groupId` (§1) — so a second request on a team the backer already holds
// lands on the SAME document, inside this same single transaction:
//   · its `amount` becomes the new total, and the per-team cap (500) is
//     checked against that total — the backer's live stakes on the team plus
//     this request;
//   · the request is its OWN debit, with its own ledger entry
//     (`stake:{debitKey}`, `ref` = the stake document) and its own entry on the
//     document's `debits[]` — so Σ entries = the cached balance after every
//     operation, and net BP per §2 is unchanged;
//   · `private/totals` and the public capped counters move exactly as for any
//     stake by a backer already counted on that team: the totals grow, the
//     unique-backer count, teams-backed and the team's backer count do not
//     (one fold, `totalsFromBackers`, keyed by backer and team);
//   · settlement and the refund are untouched — they read the document's
//     final `amount`, one payout / refund / month attribution per document.
// So a pool holds at most (eligible backers × teams) stake documents, and the
// settlement ceiling (120) and the refund stuck state (the PR 5 review
// record's MONEY-4) are unreachable by construction; the ceilings stay in code
// as belts. The first request's `placedAt`, `requestId` and `hashAtStake`
// stay the document's; a top-up's fingerprint is kept beside the first in the
// sealed meta (`topUps[]`), never over it.
//
// THE FINGERPRINT IS NOT ON THE STAKE DOC (carry-in E1). `backingStakes/{id}` is
// OWNER-READ, and Firestore rules cannot hide a field — an owner-readable doc
// carrying `ipHash` / `uaHash` / `excluded` would hand every backer their own
// admin-exclusion flag and a hash of their own network identity. Both live at
// `backingStakes/{stakeId}/private/meta`, which no client may read (the
// `backingPools/{id}/private/totals` shape, and its rules block ships in this
// PR). The IP and the UA are HASHED WITH A SERVER-SIDE SALT and never stored
// raw; see `api/_utils/backingFingerprint.js` for what the salt is and what the
// hash is and is not worth.
//
// `hashAtStake` IS TELEMETRY AND NEVER FAILS A STAKE (§4). It records the seat's
// current loadout hash so the results card can show a loadout-CHANGED marker —
// disclosure, not contract. It is resolved BEFORE the transaction, from the
// seat's latest completed battle ("as of last deploy", §4's own stated fallback
// for when the customization kernel proves heavy), and any failure yields `null`.
//
// THE WRITES ARE ALLOWLISTED (compositionProtectedStoresAllowlist.json,
// Amendment A §A6): the deny-by-default protected-store scan cannot trace the
// ref argument of a transaction-handle write, so every `tx.set` here reads as
// `unresolved` whatever the ref's origin. None of these collections is a
// composition-protected store; each key is pinned at its site count with a
// human-review note, so a new write in this transaction fails CI until it is
// reviewed too.
//
// PR 2b — THE COUNTER UPDATE SPLITS (Amendment B §B2/§B5). WRITE 6 sends the
// TRUE totals (pot, exact counts, per-team, the backers map) to
// `private/totals` and only the threshold-capped `backerProgress` /
// `teamSpread` to the public document — and writes the public document NOT AT
// ALL when those capped values are unchanged, which is every stake once both
// floors are met. Nothing else in this transaction moves: the check order, the
// `requestId` idempotency, the wallet threading and the belt are as PR 2 left
// them, because the amendment changes WHAT IS PUBLISHED, not what is decided.
//
// THE CONFIRMATION NAMES THE TEAM BY THE SERVER'S LABEL (Amendment C §C1,
// D-af): the reply carries `teamLabel` — the seat's primary agent's name and
// the player's display name — from the one resolver
// (api/_utils/backingTeamLabels.js), so the "Backed" line the client renders
// from this reply never composes a name from an id. Resolved AFTER the commit,
// like `stake_confirmed`: a name is never a reason to fail a stake.
//
// DARK AT MERGE. `BACKING_BETA_ENABLED` is false and read at CALL time; the
// co-located `.dark.test.js` proves the route answers 404 and touches nothing.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { backingWeekFor } from '../_utils/backingWeek.js';
import {
  BACKING_STAKES_COLLECTION,
  BackingPoolError,
  POOL_STATUS,
  STAKE_STATUS,
  ensureClosed,
  liveTeamsFor,
  materializePool,
  poolRefFor,
  poolTotalsRefFor,
  readGroup,
  publicProgressChanged,
  publicProgressFrom,
  stakeablePod,
  totalsFromBackers,
} from '../_utils/backingPools.js';
import { checkBackingEligibility } from '../_utils/backingEligibility.js';
import {
  BACKING_WALLET_ENTRIES_SUBCOLLECTION,
  BackingLedgerError,
  debitStake,
  ensureAllowance,
  readWallet,
  stakeEntryIdFor,
  walletRef,
} from '../_utils/backingWallet.js';
import { fingerprintOf, hashFingerprint } from '../_utils/backingFingerprint.js';
import { STAKE_CONFIRMED_EVENT, recordBackingEvent, stakeConfirmedEventId } from '../_utils/backingEvents.js';
import { labelSeatOf, resolveTeamLabels } from '../_utils/backingTeamLabels.js';
import { MIN_STAKE_BP, PER_TEAM_CAP_BP, UNNAMED_TEAM_LABEL } from '../../src/constants/backing.js';
import { TOURNAMENT_GAME_MODE, TOURNAMENT_GROUPS_COLLECTION } from '../../src/constants/leagueTournament.js';
import { BACKING_BETA_ENABLED } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 10 };

/** The sealed per-stake document E1 moves the fingerprint into (§6, §8). */
export const STAKE_PRIVATE_SUBCOLLECTION = 'private';
export const STAKE_META_DOC = 'meta';

/** The longest `requestId` the route accepts — an opaque client string. */
export const MAX_REQUEST_ID_LEN = 200;

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
 * request, first to last. A document written before D-ag carries none and is
 * read as the one debit its own id keyed (`stake:{stakeId}`), so its replay
 * and cross-body rules stay exact.
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

/**
 * The confirmation's name for the team (D-af) — the one resolver's label for
 * the seat, off the pod this request already read. NEVER THROWS: the stake is
 * already on the record when this runs, and a name is never a reason to fail
 * it (the resolver degrades on its own; this catch is the belt).
 */
export async function confirmationLabelFor(db, group, teamOdUserId, isCpu = false) {
  try {
    const seat = labelSeatOf({ group }, teamOdUserId, isCpu);
    const labels = await resolveTeamLabels(db, [seat]);
    return labels.teamLabelFor(seat);
  } catch (err) {
    console.warn('[backing-stake] team label unresolvable (the neutral name answers):', err?.message);
    return { label: UNNAMED_TEAM_LABEL, secondary: null };
  }
}

/** A 400 body: one plain reason, the attest.js shape. */
function bad(res, error, message) {
  return res.status(400).json({ error, message });
}

export default async function handler(req, res) {
  // 1. Security middleware + rate limit.
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) return;

  // 2. Method.
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  // 3. Auth — the uid and the sign-in provider come from the token.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. THE FLAG, read at call time, after auth. Dark ⇒ the route does not exist.
  if (!BACKING_BETA_ENABLED) return res.status(404).json({ error: 'Not found' });

  // 5. Body.
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const { groupId, teamOdUserId, amount, requestId } = body;
  if (!isValidForgeId(groupId)) {
    return bad(res, 'invalid_group_id', 'A valid groupId is required.');
  }
  if (!isValidForgeId(teamOdUserId)) {
    return bad(res, 'invalid_team', 'A valid teamOdUserId is required.');
  }
  if (!Number.isInteger(amount)) {
    return bad(res, 'invalid_amount', 'amount must be a whole number of BP.');
  }
  if (amount < MIN_STAKE_BP) {
    return bad(res, 'below_min_stake', `The minimum stake is ${MIN_STAKE_BP} BP.`);
  }
  if (amount > PER_TEAM_CAP_BP) {
    return bad(res, 'above_team_cap', `The per-team cap is ${PER_TEAM_CAP_BP} BP.`);
  }
  if (typeof requestId !== 'string' || requestId.length === 0 || requestId.length > MAX_REQUEST_ID_LEN) {
    return bad(res, 'invalid_request_id', 'A non-empty requestId of at most 200 characters is required.');
  }

  const db = getFirebaseAdmin();
  const now = new Date();
  // THE ONE DOCUMENT for this (backer, pool, team), and THIS REQUEST's debit
  // (D-ag): a top-up is a second debit against the same document.
  const stakeId = stakeIdFor(user.uid, groupId, teamOdUserId);
  const debitKey = stakeDebitKeyFor(user.uid, requestId);
  const entryId = stakeEntryIdFor(debitKey);

  try {
    // 6. The pod, then the two lazy jobs §4/§7 put on this endpoint.
    const group = await readGroup(db, groupId);
    if (group == null) {
      // A deleted pod still refunds whatever its pool held (§7); the stake
      // itself has nowhere to go.
      await ensureClosed(db, groupId, now);
      return res.status(409).json({ error: 'no_pod', message: 'That pod is no longer available.' });
    }
    const materialized = await materializePool(db, group, now);
    if (materialized.pool == null) {
      return res.status(409).json({
        error: 'no_pool',
        message: 'That pod is not open for backing.',
        reason: materialized.reason,
      });
    }
    await ensureClosed(db, group, now);

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
        if (prior.userId !== user.uid || prior.groupId !== groupId || prior.teamOdUserId !== teamOdUserId) {
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
      if (Number.isFinite(opensMs) && now.getTime() < opensMs) {
        return { refusal: { status: 409, error: 'pool_not_open', opensAt: pool.opensAt } };
      }
      // The far end.
      if (now.getTime() >= new Date(pool.closesAt).getTime()) {
        return { refusal: { status: 409, error: 'pool_closed', poolStatus: pool.status } };
      }

      // ---- CHECK 2: the battle-doc belt (§4). Read inside the transaction so a
      // draft that lands mid-request cannot be straddled.
      if (await tournamentBattleExists(db, (q) => tx.get(q), groupId)) {
        return { refusal: { status: 409, error: 'battle_started' } };
      }

      // ---- CHECK 3: eligibility (§8) — against the group THIS transaction read.
      const eligibility = await checkBackingEligibility(db, {
        uid: user.uid,
        decodedToken: user,
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
          .where('userId', '==', user.uid)
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

      const wRef = walletRef(db, user.uid, { dev: pool.isDev === true });
      const wallet0 = await readWallet(tx, wRef);

      // The sealed meta, read BEFORE any write so an admin's `excluded` flag
      // survives (see the write below). Normally absent; present only when the
      // parent stake was deleted out of band, since Firestore does not
      // cascade-delete a subcollection.
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
      const { wallet: wallet1 } = ensureAllowance(tx, wRef, wallet0, weekKey, now);

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
      if (onThisTeam + amount > PER_TEAM_CAP_BP) {
        throw new StakeRefusal(409, 'per_team_cap', { staked: onThisTeam, cap: PER_TEAM_CAP_BP });
      }

      // ---- CHECK 4c: the debit. Refuses `insufficient_allowance` (typed).
      // ONE DEBIT PER REQUEST (D-ag): the entry is `stake:{debitKey}`, its
      // `ref` the one stake document the debit funds.
      const debit = debitStake(tx, wRef, wallet1, { stakeId, entryKey: debitKey, amount, weekKey, now });
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
      const nowIso = now.toISOString();
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
          userId: user.uid,
          groupId,
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
      // before any write — so a stake this route creates can never clear an
      // exclusion an admin had already set. A TOP-UP keeps the first
      // placement's fingerprint where the Sybil watch reads it and appends its
      // own beside it (`topUps[]`, each naming the debit it made), so a second
      // address or device on the same stake is recorded, never written over —
      // and the watch reads every placement (api/_utils/backingSybilWatch.js).
      const fingerprint = fingerprintOf(req);
      tx.set(stakeMetaRefFor(db, stakeId), topUp && priorMeta != null
        ? { ...priorMeta, excluded: priorMeta.excluded === true, topUps: [...(Array.isArray(priorMeta.topUps) ? priorMeta.topUps : []), { ...fingerprint, entryId, at: nowIso }] }
        : { ...fingerprint, excluded: priorMeta?.excluded === true, at: nowIso });

      // ---- WRITE 6: THE SPLIT (Amendment B §B2/§B5). The true totals — the
      // pot and the exact counts — go to the SEALED doc; the public document
      // gets the threshold-capped pair and nothing else, and often gets
      // nothing at all.
      //
      // Both halves still derive from ONE updated `backers` map through ONE
      // fold (§9), so the sealed numbers and the public signals cannot
      // disagree: the cap is applied to the fold's output, not computed from a
      // second count.
      const mine = backers[user.uid] ?? (backers[user.uid] = { total: 0, byTeam: {} });
      mine.byTeam[teamOdUserId] = (mine.byTeam[teamOdUserId] ?? 0) + amount;
      mine.total += amount;
      const totals = totalsFromBackers(backers);
      tx.set(totalsRef, { ...totals.private, updatedAt: now.toISOString() });

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
        nextPool = { ...pool, ...progress, updatedAt: now.toISOString() };
        tx.set(poolRef, nextPool);
      }

      return { replay: false, topUp, added: amount, stake: { id: stakeId, ...stake }, pool: nextPool, wallet: wallet2 };
    });

    if (outcome.refusal) {
      const { status, error, ...rest } = outcome.refusal;
      return res.status(status).json({ error, ...rest });
    }

    // Backing Beta PR 5 — `stake_confirmed` (spec §10; Amendment B §B7.3) is
    // written SERVER-SIDE, here, AFTER the transaction has committed and only
    // for a NEW debit (a replay confirmed nothing new). It is telemetry: the
    // write is awaited (BUILD_RULES §5) but a failure is logged and NEVER
    // fails the stake — the stake is already on the record. The §10
    // segmentation keys (human seats per pod, formation path) ride along,
    // read off the pod this request already holds.
    //
    // ONE CONFIRMATION PER REQUEST, and it says which it was (D-ag): the id is
    // the request's debit key — a stake and each of its top-ups share one
    // document but are separate confirmations, and a retried request can only
    // rewrite identical bytes — and `topUp` records whether this request
    // opened the stake or added to it. `amount` is what THIS request added.
    if (outcome.replay !== true) {
      try {
        await recordBackingEvent(db, {
          eventId: stakeConfirmedEventId(debitKey),
          userId: user.uid,
          groupId,
          event: STAKE_CONFIRMED_EVENT,
          props: {
            stakeId,
            teamOdUserId,
            amount,
            topUp: outcome.topUp === true,
            weekKey: outcome.stake.weekKey,
            formationPath: outcome.pool?.formationPath ?? null,
            humanTeams: liveTeamsFor(group).filter((t) => !t.isCpu).length,
            isDev: outcome.pool?.isDev === true,
          },
          now,
        });
      } catch (err) {
        console.warn('[backing-stake] stake_confirmed not recorded (telemetry only):', err?.message);
      }
    }

    // The confirmation's name for the team (D-af), after the commit.
    const teamLabel = await confirmationLabelFor(db, group, teamOdUserId, seat?.isCpu === true);

    // THE SEALED PROJECTION (§3, Amendment B §B2): the reply carries the capped
    // validity signals, the close and the viewer's own stake — never the pot,
    // never an exact count, never a per-team total and never a pays ×.
    //
    // A BACKER WHO HAS JUST STAKED IS THE BEST-PLACED OBSERVER (§B1): they can
    // subtract their own contribution from anything they are told, so handing
    // the pot back in the confirmation response would re-open the leak the
    // document move just closed, on the one request most able to exploit it.
    // The reply projects the same capped fields the public document carries,
    // read off that document, so the two cannot disagree (§9).
    return res.status(200).json({
      replay: outcome.replay === true,
      // D-ag: whether this request topped up a stake the backer already held,
      // and what it added — the stake's `amount` is the TOTAL on the team.
      topUp: outcome.topUp === true,
      added: outcome.added,
      stake: outcome.stake,
      teamLabel,
      pool: outcome.pool
        ? {
          status: outcome.pool.status,
          backerProgress: outcome.pool.backerProgress,
          teamSpread: outcome.pool.teamSpread,
          closesAt: outcome.pool.closesAt,
          closeReason: outcome.pool.closeReason,
        }
        : null,
      allowanceRemaining: outcome.wallet ? outcome.wallet.allowanceRemaining : null,
    });
  } catch (err) {
    // A refusal thrown from inside the transaction, so the transaction rolled
    // back. Answered exactly as a returned refusal would be.
    if (err instanceof StakeRefusal) {
      return res.status(err.statusCode).json({ error: err.code, ...err.payload });
    }
    // The ledger's and the pool's own typed refusals carry their own status. The
    // MESSAGE is logged, never returned: it names internal state (which week the
    // wallet is granted for, which id was ambiguous), and every other refusal on
    // this route answers with a plain reason word.
    // The ledger's refusals are STATE CONFLICTS (the allowance is spent, the
    // wallet is on another week), so 409 whatever the class's own default is;
    // the pool's are about the REQUEST (an ambiguous groupId), so its own 400
    // stands. Either way the MESSAGE is logged, never returned: it names
    // internal state, and every other refusal here answers with a reason word.
    if (err instanceof BackingLedgerError) {
      console.warn(`[backing-stake] ledger refusal (${err.code}):`, err.message);
      return res.status(409).json({ error: err.code });
    }
    if (err instanceof BackingPoolError) {
      console.warn(`[backing-stake] pool refusal (${err.code}):`, err.message);
      return res.status(err.statusCode ?? 400).json({ error: err.code });
    }
    console.error('[backing-stake] transaction failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not place that stake.' });
  }
}
