// api/_utils/backingPools.js
//
// Backing Beta PR 2 — THE POOL: lazy open, the live team derivation, and the
// close transaction (spec V1.3 §1 team identity, §3 pool mechanics and the
// close order, §4 window, §6 collection shapes, §7 the lazy close and the
// refund paths; rulings D-d, D-e, D-j, D-n, D-q, D-x, D-y).
//
// PR 2b — THE OPEN POOL IS SEALED (Amendment B §B2/§B5, D-q amended). While a
// pool is OPEN its public document publishes threshold-capped validity progress
// and nothing else about the book: `backerProgress { count, floor, met }` with
// the count capped at `VALIDITY_MIN_BACKERS`, and `teamSpread { met }` as a
// boolean. `potTotal`, `uniqueBackers` and `teamsBacked` are NOT on the public
// document at all while open — they live in `private/totals` beside the
// per-team totals — and the close copies all three back up as part of the §3
// step 4 reveal. `publicProgressFrom` is the one implementation of the cap.
//
// `backingPools/{groupId}`, `dev-{groupId}` in the dev namespace — the PR 1
// wallet-id rule verbatim (`walletIdFor`, backingWallet.js), so a smoke pod can
// never write a production pool. The refusal of a groupId that already begins
// `dev-` is the same refusal for the same reason: `dev-{id}` and a raw id share
// ONE id space, and an ambiguous pool id would let one document stand for two
// pods (see `poolIdFor`).
//
// TWO WRITE PATHS, EACH ONE TRANSACTION.
//   · `materializePool` — the §4 lazy open. Refuses per PR 1's `poolEligible`
//     and hands back its reason; an existing pool is returned UNCHANGED.
//   · `closePool` — the §3 close, in the spec's order and in nothing else's.
//
// `teams[]` IS NOT WRITTEN AT OPEN (§1). A pool's teams are DERIVED LIVE from
// the group's `players[]` on every read while the pool is open — slot-pod seats
// are mutable until fire — and FROZEN at close. `liveTeamsFor` is that
// derivation; there is no second copy of it, because a stored-at-open `teams[]`
// and a live `players[]` are exactly the two sources §9 forbids (a seat that
// left would still read as backable from the frozen copy).
//
// THE CLOSE ORDER IS THE SPEC'S, AND NOTHING MAY REORDER IT (§3):
//   (1) FREEZE `teams[]` to the seats present in `players[]` now;
//   (2) VOID every `live` stake whose `teamOdUserId` is no longer seated
//       (`voidReason: 'seat_left'`), score-neutral through PR 1's
//       `creditRefund`;
//   (3) EVALUATE VALIDITY on what remains — ≥ VALIDITY_MIN_BACKERS unique
//       backers AND ≥ VALIDITY_MIN_TEAMS distinct teams — giving `closed` or
//       `insufficient`; on `insufficient` every remaining stake is voided
//       (`voidReason: 'insufficient'`);
//   (4) REVEAL — the per-team totals are copied into the public doc as
//       `teams[].stakeTotal` / `teams[].backerCount`, `humanTeams` is stamped,
//       and (Amendment B §B5) `potTotal`, `uniqueBackers` and `teamsBacked`
//       come up from `private/totals` while the capped open-state pair
//       (`backerProgress`, `teamSpread`) comes off.
// Step 2 before step 3 is the whole point: validity is judged on the stakes
// that SURVIVE, never on the ones a departed seat left behind. `backingPools.test.js`
// asserts the order itself, not merely its outcome. Step 3 reads the TRUE
// counts — the capped public pair is a threshold signal, not a count, and is
// also a pre-step-2 snapshot (Amendment B §B5).
//
// THE TOTALS ARE RECOMPUTED FROM THE STAKES AT CLOSE, not read out of
// `private/totals`. §6 is explicit that balances derive from the ledger and a
// mismatch resolves in the ledger's favour; the stake documents ARE that ledger
// and `private/totals` is its cache, so close re-derives both the private cache
// and the revealed public numbers from the same pass over the surviving stakes.
// One source, by construction (BUILD_RULES §9) — and the re-derivation repairs
// any drift the cache had accumulated rather than publishing it.
//
// IDEMPOTENT ON STATUS. A second `closePool` is a no-op: the transaction re-reads
// the pool and returns early unless it is still `open`. That is what makes the
// lazy driver (`ensureClosed`), PR 3's settlement and an admin re-run safe to
// run against the same pod in any order.
//
// A MISSING GROUP DOC IS A REFUND, NOT A CRASH (§7). The last human leaving a
// slot pod deletes the doc; the pool then closes `refunded` with every stake
// voided `group_deleted`. `ensureClosed` builds the tombstone that path needs.
//
// THE SEALED HALF LIVES IN A SUBCOLLECTION, NOT IN A HIDDEN FIELD (§3, §6).
// Rules cannot hide fields, so per-team totals, the backers map and — since
// Amendment B §B5 — the pot and the exact counts sit under
// `backingPools/{poolId}/private/totals`, which no client may read. The public
// doc carries only what an open pool may show. The move is NOT a display
// change and could not have been one: the public doc is authed-read, so a
// number left on it is streamable by any signed-in user however the interface
// chooses to render it (§B5).
//
// Imports the zero-import constants module from src/ under the revised June 2026
// import rule (BUILD_RULES §4); the co-located test's real import of THIS module
// is the dependency-surface guard (it explodes in the Node test env if a browser
// dep ever enters the graph) — never mock it.

import {
  POOL_INELIGIBLE,
  backingWeekFor,
  battleMondayEtDateFor,
  closesAtFor,
  opensAtFor,
  poolEligible,
} from './backingWeek.js';
import { readWallet, walletRef, creditRefund, recordStakeLoss } from './backingWallet.js';
import {
  POOL_EXCLUDED_SLOT_IDS,
  VALIDITY_MIN_BACKERS,
  VALIDITY_MIN_TEAMS,
} from '../../src/constants/backing.js';
import {
  GROUP_STATUS,
  TOURNAMENT_GROUPS_COLLECTION,
  isCpuUserId,
} from '../../src/constants/leagueTournament.js';

/** The pool collection; the doc id is `poolIdFor(group)`. */
export const BACKING_POOLS_COLLECTION = 'backingPools';

/** The sealed subcollection and its one document (§6). */
export const POOL_PRIVATE_SUBCOLLECTION = 'private';
export const POOL_TOTALS_DOC = 'totals';

/** The stake collection this module voids and refunds against (§6). */
export const BACKING_STAKES_COLLECTION = 'backingStakes';

/** The §6 status vocabulary. `resolving` / `resolved` are PR 3's to write. */
export const POOL_STATUS = Object.freeze({
  OPEN: 'open',
  CLOSED: 'closed',
  INSUFFICIENT: 'insufficient',
  RESOLVING: 'resolving',
  RESOLVED: 'resolved',
  REFUNDED: 'refunded',
});

/** The §6 stake statuses this module reads and writes. */
export const STAKE_STATUS = Object.freeze({
  LIVE: 'live',
  VOIDED: 'voided',
  WON: 'won',
  LOST: 'lost',
});

/**
 * The §6 void reasons this module writes. `group_voided`, `group_expired` and
 * `admin` are PR 3's paths and are named here so the vocabulary has ONE home.
 */
export const VOID_REASONS = Object.freeze({
  SEAT_LEFT: 'seat_left',
  INSUFFICIENT: 'insufficient',
  GROUP_VOIDED: 'group_voided',
  GROUP_EXPIRED: 'group_expired',
  GROUP_DELETED: 'group_deleted',
  ADMIN: 'admin',
});

/** The `formationPath` values (§6): a lobby pod or a live-draft slot pod. */
export const FORMATION_PATH = Object.freeze({ LOBBY: 'lobby', SLOT: 'slot' });

/**
 * Refusals this module owns, beside PR 1's `POOL_INELIGIBLE`.
 *
 * `NOT_OPEN_YET` deliberately lives HERE and not in `POOL_INELIGIBLE`: that
 * vocabulary is PR 1's and is frozen (backingWeek.js states so), and the clause
 * it guards is a property of the READ INSTANT, not of the pod. `poolEligible`
 * answers "does this pod get a pool at all", measuring the 24-hour rule from
 * `max(now, opensAt)` so a pod formed before its own window still qualifies;
 * this answers the different question "may that pool be OPEN yet".
 */
export const POOL_REFUSAL = Object.freeze({ NOT_OPEN_YET: 'not_open_yet' });

/**
 * A pool refusal. Typed like `BackingLedgerError` / `EligibilityRequiredError`
 * so the endpoints can `instanceof` it — or read `.code` / `.statusCode` — and
 * answer without string-matching a message.
 */
export class BackingPoolError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'BackingPoolError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ==================== IDENTITY ====================

/**
 * The pool doc id for a pod: `groupId`, or `dev-{groupId}` in the dev namespace
 * — the `walletIdFor` rule verbatim, INCLUDING its refusal, so the two
 * namespaces cannot drift apart.
 *
 * A groupId ALREADY INSIDE the dev namespace is refused for the reason the
 * wallet gives at length: `poolIdFor({id:'x', isDev:true})` and
 * `poolIdFor({id:'dev-x'})` name the SAME document, so one pool doc would stand
 * for two pods and every counter on it would be the sum of two pools' stakes.
 * No reachable id trips it — lobby groups carry Firestore auto-ids and slot
 * groups are `lds_{slot}_{date}` (`slotGroupId`, liveDraftFormation.js) — so
 * this guards the seeder/Console path and keeps the id's meaning unambiguous by
 * construction.
 */
export function poolIdFor(group) {
  const groupId = typeof group === 'string' ? group : group?.id;
  if (typeof groupId !== 'string' || groupId.length === 0) {
    throw new BackingPoolError('invalid_group_id', 'poolIdFor: a non-empty groupId is required');
  }
  if (groupId.startsWith('dev-')) {
    throw new BackingPoolError(
      'invalid_group_id',
      `poolIdFor: a groupId inside the dev namespace has an ambiguous pool id (${groupId}) — refused`,
    );
  }
  return group?.isDev === true ? `dev-${groupId}` : groupId;
}

/**
 * Terminal group statuses: a pod with no result left to back (§5).
 * `voided` is reachable only from `battle`; `expired` only from the three
 * pre-battle states. Both are forward-only and carry no standing.
 */
const TERMINAL_GROUP_STATUSES = new Set([GROUP_STATUS.VOIDED, GROUP_STATUS.EXPIRED]);

/**
 * Is this pod still STAKEABLE? (§4, §5, D-x.)
 *
 * DELIBERATELY NOT a `poolEligible` clause: that predicate answers "does this
 * pod get a pool", once, at open. This answers "may a stake still land", every
 * time — and a pod can turn terminal long after its pool opened, at which point
 * `materializePool` would keep handing back the open pool it already has.
 *
 * `battle` and `complete` are NOT refused here: a pod in battle has simply had
 * its pool closed by the clock, and the pool's own `status` says so.
 *
 * DEV AND TRAINING ARE NOT REFUSED HERE EITHER, and that is the substantive
 * split. §6's D-DEVFIELD is explicit that the dev exclusion belongs to the POD
 * LIST ("the pod list excludes dev groups from production viewers — the field
 * does not"), not to the pool layer: a dev pod routes to a `dev-` pool and a
 * `dev-` wallet precisely so §11 gate 4's founder smoke can run a real stake
 * through it. Refusing dev pods here would make that smoke impossible. A dev or
 * training pod still gets no pool at all through the production path, because
 * `poolEligible` refuses to open one — so this clause's absence costs nothing
 * a production caller can reach.
 */
export function stakeablePod(group) {
  if (TERMINAL_GROUP_STATUSES.has(group?.status)) return false;
  if (POOL_EXCLUDED_SLOT_IDS.includes(group?.slotId)) return false;
  return true;
}

/**
 * May this pod appear in the PRODUCTION pod list? (§5, §6 D-DEVFIELD, D-x.)
 *
 * `stakeablePod` plus the two exclusions that are the LIST's own: dev pods never
 * surface to a production viewer, and training pods complete with zero ladder
 * effects so they have nothing to back. Built ON the stakeable predicate rather
 * than beside it, so the list can never admit a pod the stake path would refuse
 * (§9 — one source, two scopes).
 */
export function listablePod(group) {
  if (!stakeablePod(group)) return false;
  if (group?.isDev === true) return false;
  if (group?.isTraining === true) return false;
  return true;
}

/**
 * The marker `scripts/backing-smoke.js` stamps on every pod it seeds
 * (`smoke.tool`). A smoke session is listed those pods and no other; the
 * script's own cleanup verdict demands the same marker before it deletes.
 */
export const SMOKE_POD_TOOL = 'scripts/backing-smoke.js';

/**
 * May this pod appear in a SMOKE user's pod list? (The activation PR; spec
 * §11 gate 4.) The mirror of `listablePod`: `stakeablePod` plus the
 * OPPOSITE dev clause — ONLY an `isDev` pod, never a production one — so a
 * smoke session on a preview (api/_utils/backingSmoke.js) sees the dev
 * namespace and nothing else. Training pods are excluded as on the
 * production list. Built ON the stakeable predicate for the same §9 reason:
 * the smoke list can never admit a pod the stake path would refuse.
 */
export function smokeListablePod(group) {
  if (!stakeablePod(group)) return false;
  if (group?.isDev !== true) return false;
  if (group?.isTraining === true) return false;
  // …and ONLY a pod the smoke script seeded (its `smoke.tool` marker): a
  // teammate's dev pod, or a `seed-tournament-group` pod, is not the
  // smoke's — listing it would open a dev pool the smoke's cleanup never
  // sweeps (SCRIPT-08, the activation review record).
  if (group?.smoke?.tool !== SMOKE_POD_TOOL) return false;
  return true;
}

/**
 * A `live` copy of the viewer's stake that the pool AS ANSWERED says cannot
 * still be live (the pre-flip cleanup's review record, WIRING-1). Every
 * transition out of `open` other than to `closed` / `resolving` moves every
 * live stake in the SAME transaction (`insufficient` / `refunded` void them,
 * `resolved` settles them), and a close voids a stake on a seat missing from
 * the frozen `teams[]` — so such a copy predates a transition the reading
 * request did not see: another request's close or settlement landing between
 * its stakes query and its pool read. Zero cost in the steady state: an open
 * pool, or a closed one's stakes on its frozen teams, contradict nothing.
 * Pure. ONE predicate for both readers of the viewer's stakes — the pod list
 * (api/tournament/backing-pools.js) and the results reader
 * (api/backing/results.js, WIRING-1's twin) — so the two cannot drift on
 * when a copy is stale (§9).
 */
export function liveStakeContradicts(pool, stake) {
  if (stake?.status !== STAKE_STATUS.LIVE || pool == null || pool.status === POOL_STATUS.OPEN) return false;
  if (pool.status !== POOL_STATUS.CLOSED && pool.status !== POOL_STATUS.RESOLVING) return true;
  return Array.isArray(pool.teams) && !pool.teams.some((t) => t.odUserId === stake.teamOdUserId);
}

/** The `backingPools/{poolId}` document reference. */
export function poolRefFor(db, group) {
  return db.collection(BACKING_POOLS_COLLECTION).doc(poolIdFor(group));
}

/** The sealed `backingPools/{poolId}/private/totals` document reference (§6). */
export function poolTotalsRefFor(db, group) {
  return poolRefFor(db, group)
    .collection(POOL_PRIVATE_SUBCOLLECTION)
    .doc(POOL_TOTALS_DOC);
}

// ==================== (1) THE LIVE TEAMS (§1) ====================

/**
 * The backable seats RIGHT NOW: every `players[]` entry, `isCpu` flagged.
 *
 * §1 derives a pool's teams from the group's `players[]` at every read while the
 * pool is open, because slot-pod seats are mutable until fire; the frozen
 * `teams[]` exists only from close. This function is that derivation and the
 * ONLY one — the pod list, the stake endpoint's seat-present check and the
 * close's freeze all call it, so "who is seated" has one answer per group doc.
 *
 * THE VIEWER'S OWN SEAT IS THE CALLER'S MARK, not this function's: own-pod is an
 * account-level rule about the REQUEST (§8), and a pure seat derivation that
 * silently knew about a viewer would be a second source for it.
 *
 * SLOT PODS HAVE NO CPUs BEFORE FIRE (§1) — CPUs are added at fire and are not
 * in the pool because they did not exist during the window — so this simply
 * reflects the doc rather than filtering: a slot pod's `players[]` holds only
 * its claimants, and a lobby pod's holds its CPU seats too.
 *
 * `isCpu` is read from the seat AND from the id shape (`isCpuUserId`): the
 * advancement writer stamps the flag, the id prefix is the identity (§1), and
 * either alone would miss a seat the other names.
 *
 * DUPLICATE odUserIds are collapsed to the first occurrence. A group cannot
 * seat one user twice (`claimSlotSeat` is idempotent on membership), so this is
 * belt — but a duplicate would double-count `humanTeams` and `teamsBacked`, and
 * a seat list with two of the same team is not a thing the rest of this module
 * can mean.
 */
export function liveTeamsFor(group) {
  const players = Array.isArray(group?.players) ? group.players : [];
  const seen = new Set();
  const teams = [];
  for (const player of players) {
    const odUserId = typeof player?.odUserId === 'string' ? player.odUserId : null;
    if (odUserId === null || odUserId.length === 0 || seen.has(odUserId)) continue;
    seen.add(odUserId);
    teams.push({ odUserId, isCpu: player?.isCpu === true || isCpuUserId(odUserId) });
  }
  return teams;
}

/** The seated odUserIds as a Set — the seat-present check's one shape. */
export function seatedIdsFor(group) {
  return new Set(liveTeamsFor(group).map((t) => t.odUserId));
}

/**
 * The ET month a pool's record attributes to, as a fallback for the paths that
 * settle a pod which never banked a day.
 *
 * §2 attributes net BP to the ET month of the pod's FIRST BANKED DAY — the
 * ladder's own `monthKeyForGroup` (tournamentLeaderboard.js), which reads
 * `dailyScores.day1.recordedDate`. A pool voided AT CLOSE has no banked day at
 * all: the pod has not battled, and for the `refunded` path it no longer exists.
 * So there is no ladder key to agree with, and inventing one from the server
 * clock would drift with the moment the close happened to run.
 *
 * The battle Monday's ET month is the faithful substitute: it is the month day 1
 * WOULD have banked in (day 1 is the battle Monday, or the Tuesday after a
 * holiday Monday — §4), it is frozen on the pool at open, and it therefore reads
 * the same on a re-run a month later. PR 3, settling a pod that DID bank, uses
 * `monthKeyForGroup` itself; the two agree except across a month boundary a
 * holiday Monday could straddle — which an in-week VOIDED pod that banked its
 * day 1 can reach since PR 5's refund (it takes the group's key first and
 * falls back to this one, so the boundary attributes to the banked day;
 * pinned by backingRefund.test.js's month-boundary row).
 */
export function monthKeyForPool(pool) {
  const monday = pool?.battleMondayEtDate;
  if (typeof monday !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(monday)) {
    throw new BackingPoolError(
      'invalid_pool',
      `monthKeyForPool: the pool carries no battleMondayEtDate (${JSON.stringify(monday)})`,
    );
  }
  return monday.slice(0, 7);
}

// ==================== (2) THE LAZY OPEN (§4) ====================

/**
 * The §6 open-state document. Exported so the tests assert the shape against one
 * source rather than a re-typed literal.
 *
 * `teams[]` IS ABSENT ON PURPOSE (§1) — see the module header. `baseLayerWeek`
 * is COPIED from the group at open (§6); settlement reads the group's current
 * value, because the label is re-stampable and the pool's copy records what it
 * was when the window opened. Nothing in the close or the stake path keys off
 * it: the window is derived from `battleMondayEtDate`, which has no inverse
 * problem (A-C6, backingWeek.js).
 */
export function buildOpenPool(group, now, { eligibility }) {
  const nowIso = new Date(now).toISOString();
  const battleMondayEtDate = battleMondayEtDateFor(group);
  const week = backingWeekFor(battleMondayEtDate);
  return {
    groupId: group.id,
    status: POOL_STATUS.OPEN,
    formationPath: group.isLiveDraft === true ? FORMATION_PATH.SLOT : FORMATION_PATH.LOBBY,
    slotId: typeof group.slotId === 'string' ? group.slotId : null,
    battleMondayEtDate,
    backingWeekStart: week.startIso,
    opensAt: eligibility.opensAt,
    closesAt: eligibility.closesAt,
    closeReason: eligibility.closeReason,
    baseLayerWeek: typeof group.baseLayerWeek === 'string' ? group.baseLayerWeek : null,
    isDev: group.isDev === true,
    // THE CAPPED PAIR, AND NOTHING ELSE ABOUT THE BOOK (Amendment B §B2/§B5).
    // `potTotal`, `uniqueBackers` and `teamsBacked` are NOT on this document —
    // they open at zero in `private/totals`, which no client may read. A pool
    // opens below both floors, so both signals open unmet.
    ...publicProgressFrom({ uniqueBackers: 0, teamsBacked: 0 }),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * THE CAP (Amendment B §B2) — the ONE place true totals become public signals.
 *
 * `backingPools/{poolId}` is authed-read, so it is an `onSnapshot` STREAM to
 * every signed-in user, not a poll. At beta pod sizes one pot delta is usually
 * one person's stake, and a pot delta landing together with a backer increment
 * or a team-spread change lets an observer — best of all one who has already
 * staked and can subtract their own contribution — reconstruct the book (§B1;
 * the PR 2 review record's finding 13, which this is the fix for). So the
 * public document carries progress toward the floors and NOTHING above them:
 *
 *   · `backerProgress.count` is `min(uniqueBackers, VALIDITY_MIN_BACKERS)` —
 *     it reaches the floor and STOPS. There is no fourth value to publish, so
 *     a fourth backer is not a number the client can be told (§B2's "Never 4,
 *     5, 6").
 *   · `teamSpread` is a BOOLEAN ONLY. A raw `teamsBacked` in a 2-human-team
 *     pod names which team took a stake by arithmetic — the exact leak §B1
 *     describes — so the count does not leave `private/totals` at all.
 *
 * ONCE BOTH ARE MET THIS FUNCTION IS CONSTANT for every further stake, which is
 * what lets the stake transaction skip its public write entirely
 * (`publicProgressChanged` below, backing-stake.js WRITE 6). That is the whole
 * point of the amendment: above the floor, the public document does not move.
 *
 * The two residual signals §B3 accepts — the spread flipping unmet → met, and
 * at most two sub-floor backer ticks — are exactly what remains, and they carry
 * no amount. §B4: below the floor a spectator is told what the pool needs,
 * because thin-pool risk outranks further sealing; at and above it, nothing.
 *
 * @param {{uniqueBackers?: number, teamsBacked?: number}} totals the TRUE
 *   counts, as `totalsFromBackers` / `totalsFromStakes` derive them.
 */
export function publicProgressFrom(totals) {
  const uniqueBackers = Number.isFinite(totals?.uniqueBackers) ? totals.uniqueBackers : 0;
  const teamsBacked = Number.isFinite(totals?.teamsBacked) ? totals.teamsBacked : 0;
  return {
    backerProgress: {
      count: Math.min(uniqueBackers, VALIDITY_MIN_BACKERS),
      floor: VALIDITY_MIN_BACKERS,
      met: uniqueBackers >= VALIDITY_MIN_BACKERS,
    },
    teamSpread: { met: teamsBacked >= VALIDITY_MIN_TEAMS },
  };
}

/**
 * Would writing `progress` change what this pool document PUBLISHES?
 *
 * The freeze in §B2 is a property of the DOCUMENT, not of the render: a client
 * streams `backingPools/{poolId}` directly, so an `updatedAt` bump on an
 * otherwise identical document is itself a published fact — "someone just
 * staked" — and the stream carries it. A stake whose capped values are
 * unchanged therefore writes the public document NOT AT ALL, and the snapshot
 * a spectator holds is byte-identical across it.
 *
 * ABOVE THE FLOOR THIS IS ALWAYS FALSE, which is §B2's requirement. It is also
 * false for a sub-floor stake that moves nothing public (a second stake by a
 * backer already counted, on a team already spread) — deliberately stronger
 * than the letter of §B2, because §B3 lists the residual signals EXHAUSTIVELY
 * and a bare `updatedAt` tick is not among the two it accepts.
 */
export function publicProgressChanged(pool, progress) {
  const was = pool?.backerProgress;
  const now = progress?.backerProgress;
  return was?.count !== now?.count
    || was?.floor !== now?.floor
    || was?.met !== now?.met
    || pool?.teamSpread?.met !== progress?.teamSpread?.met;
}

/**
 * Open this pod's pool if it does not exist and §4 allows it (the lazy
 * materialization — formation code is untouched).
 *
 * THE TRANSACTION IS THE GUARD, not a convenience: the pod list and the stake
 * endpoint both materialize, so two first readers race by construction. The
 * deterministic id plus a transactional read-then-create means the loser
 * re-runs against the winner's document and returns it unchanged — ONE pool,
 * one `opensAt` of record (the `api/eligibility/attest.js` shape).
 *
 * @returns {Promise<{pool: Object|null, created: boolean, reason: string|null}>}
 *   `reason` is one of `POOL_INELIGIBLE` when no pool was opened and none
 *   existed; it is null whenever a pool comes back.
 */
export async function materializePool(db, group, now = new Date(), { allowDev = false } = {}) {
  const ref = poolRefFor(db, group);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    // AN EXISTING POOL IS RETURNED UNCHANGED, whatever `poolEligible` now says.
    // The predicate is about OPENING one: a pod that has since left `forming`,
    // or whose window has since shrunk under 24h, keeps the pool it already has
    // — closing it is `closePool`'s job, on the clock, not this function's.
    if (snap.exists) return { pool: snap.data(), created: false, reason: null };

    // THE DEV NAMESPACE OPT-IN (§6, §11 gate 4). `poolEligible` refuses every
    // dev pod, which is right for the production pod list (D-DEVFIELD) and
    // wrong for the founder's own smoke — gate 4 runs a DEV pod through
    // attest → open → close → settle, and without an opt-in no dev pool can
    // ever exist, so `poolIdFor`'s `dev-` branch would ship as dead code.
    // Off by default and passed by NO production caller: both endpoints call
    // this without it, so a production viewer can never materialize a dev pool.
    const eligibility = allowDev === true && group?.isDev === true
      ? poolEligible({ ...group, isDev: false }, now)
      : poolEligible(group, now);
    if (!eligibility.eligible) return { pool: null, created: false, reason: eligibility.reason };

    // THE WINDOW HAS TO HAVE STARTED (§4: a pool opens at the LATER of pod
    // formation and the backing week's start). `poolEligible` deliberately does
    // NOT enforce this — it measures the 24-hour rule from `max(now, opensAt)`
    // so a pod formed early still qualifies for a pool — so the enforcement
    // lives here, at the moment the pool would be written `status: 'open'`.
    //
    // THE DEFECT THIS CLOSES, because it is not hypothetical: a Wed/Sat/Sun
    // slot pod is created at its FIRST CLAIM, up to a week before its fire, and
    // its `battleStartWeek` is stamped from the fire — so a pod claimed on the
    // Saturday of week W carries the backing week W+1 and an `opensAt` up to
    // ~3 days in the future. Opening it then would let a stake carry
    // `weekKey = W+1` while the backer is living in W: `ensureAllowance` would
    // expire the whole of W's unspent allowance, re-key the wallet to W+1, and
    // every still-open pool of week W would answer `week_mismatch` for the rest
    // of the week. §2's "every stake on a pool is drawn from the same
    // allowance" is exactly this clause.
    const opensMs = new Date(eligibility.opensAt).getTime();
    if (Number.isFinite(opensMs) && new Date(now).getTime() < opensMs) {
      return { pool: null, created: false, reason: POOL_REFUSAL.NOT_OPEN_YET, opensAt: eligibility.opensAt };
    }

    const pool = buildOpenPool({ ...group, id: group.id }, now, { eligibility });
    tx.set(ref, pool);
    return { pool, created: true, reason: null };
  });
}

// ==================== (3) THE CLOSE (§3) ====================

/** The `(groupId, status)` query the close reads — the committed composite. */
function liveStakesQuery(db, groupId) {
  return db.collection(BACKING_STAKES_COLLECTION)
    .where('groupId', '==', groupId)
    .where('status', '==', STAKE_STATUS.LIVE);
}

/**
 * The §3 close, as ONE transaction in the spec's order. See the module header
 * for the four steps and why step 2 precedes step 3.
 *
 * @param {Object} db
 * @param {Object} group the group doc as `{ id, ...data }`, or the TOMBSTONE
 *   `{ id, isDev, missing: true }` that `ensureClosed` builds when the doc is
 *   gone (§7 — the last human left a slot pod). A tombstone has no seats, so
 *   every stake fails step 2 and the pool lands `refunded` with every stake
 *   voided `group_deleted`.
 * @returns {Promise<{closed: boolean, status?: string, reason?: string,
 *   pool?: Object, voided?: number, refunded?: number}>}
 */
export async function closePool(db, group, now = new Date()) {
  const ref = poolRefFor(db, group);
  const groupId = group.id;
  const missing = group?.missing === true;
  const nowIso = new Date(now).toISOString();

  return db.runTransaction(async (tx) => {
    // ---------- READS (all of them, before any write) ----------
    const poolSnap = await tx.get(ref);
    if (!poolSnap.exists) return { closed: false, reason: 'no_pool' };
    const pool = poolSnap.data();
    // IDEMPOTENT ON STATUS — a second call is a no-op (§7).
    if (pool.status !== POOL_STATUS.OPEN) {
      return { closed: false, reason: 'not_open', status: pool.status, pool };
    }

    const stakesSnap = await tx.get(liveStakesQuery(db, groupId));
    const stakes = [];
    stakesSnap.forEach((doc) => stakes.push({ id: doc.id, ...doc.data() }));

    // ---------- (1) FREEZE the seats (§3 step 1) ----------
    const frozenTeams = missing ? [] : liveTeamsFor(group);
    const seated = new Set(frozenTeams.map((t) => t.odUserId));

    // ---------- (2) WHICH STAKES A DEPARTED SEAT VOIDS (§3 step 2) ----------
    const seatLeft = [];
    const surviving = [];
    for (const stake of stakes) {
      if (seated.has(stake.teamOdUserId)) surviving.push(stake);
      else seatLeft.push(stake);
    }

    // ---------- (3) VALIDITY ON WHAT REMAINS (§3 step 3) ----------
    // THE TRUE COUNTS, NEVER THE CAPPED PUBLIC ONES (Amendment B §B5). The
    // public document carries `backerProgress` / `teamSpread`, which are
    // THRESHOLD SIGNALS and not counts: `backerProgress.count` stops at the
    // floor, and `teamSpread` has no count at all. Judging a close on them
    // would be wrong twice over — they are also the LAST OPEN-STATE snapshot,
    // folded before step 2 voided a departed seat's stakes, so a pool whose
    // spread only ever existed through a seat that has now left would read
    // `met` and close `closed` on one surviving team.
    //
    // These are derived from the SURVIVING STAKES, which is the truth
    // `private/totals` caches: §6 makes the stake documents the ledger and the
    // sealed doc its cache, and step 4 below re-derives the cache from this
    // same pass. So validity reads the ledger — strictly the same numbers the
    // sealed doc is about to hold, and immune to any drift it had accumulated.
    const backers = new Set(surviving.map((s) => s.userId));
    const teamsBacked = new Set(surviving.map((s) => s.teamOdUserId));
    const valid = backers.size >= VALIDITY_MIN_BACKERS && teamsBacked.size >= VALIDITY_MIN_TEAMS;

    // The three terminal statuses this function can write, in the order §3 and
    // §7 assign them: a missing group refunds whatever it held; otherwise the
    // validity floor decides between `closed` and `insufficient`.
    const status = missing
      ? POOL_STATUS.REFUNDED
      : (valid ? POOL_STATUS.CLOSED : POOL_STATUS.INSUFFICIENT);

    // On `insufficient` every REMAINING stake is voided too (§3). On `refunded`
    // there are no survivors — the tombstone seats nobody — so the seat-left
    // list already holds them all, and the reason is the deleted doc, not a
    // seat that left.
    const voids = [];
    for (const stake of seatLeft) {
      voids.push({ stake, reason: missing ? VOID_REASONS.GROUP_DELETED : VOID_REASONS.SEAT_LEFT });
    }
    if (status === POOL_STATUS.INSUFFICIENT) {
      for (const stake of surviving) voids.push({ stake, reason: VOID_REASONS.INSUFFICIENT });
    }

    // The refund wallets — the LAST reads, still before the first write.
    // Keyed by wallet path so two stakes by one backer read the doc once and the
    // second `creditRefund` builds on the first's returned state (the PR 1
    // threading contract, resolved by the module itself).
    const walletDocs = new Map();
    for (const entry of voids) {
      entry.walletRef = walletRef(db, entry.stake.userId, { dev: pool.isDev === true });
      if (walletDocs.has(entry.walletRef.path)) continue;
      walletDocs.set(entry.walletRef.path, await readWallet(tx, entry.walletRef));
    }

    // ---------- WRITES ----------
    // (2)/(3) the voids, each score-neutral through PR 1's `creditRefund`: the
    // stake debited `careerNet` when it was placed, the refund credits it back,
    // so a voided stake costs the backer nothing on the record (§2). The BP does
    // NOT return as spendable — `creditRefund` never touches `allowanceRemaining`
    // — because by the time a pool closes its week has closed too.
    const monthKey = monthKeyForPool(pool);
    let refunded = 0;
    for (const { stake, reason, walletRef: wRef } of voids) {
      // Whole-doc `tx.set` at the stake's own id — the tournamentRank /
      // `backingWallet.commitWallet` idiom. `id` is the DOCUMENT's id and is
      // stripped rather than written back as a field.
      const { id: stakeId, ...stakeFields } = stake;
      tx.set(db.collection(BACKING_STAKES_COLLECTION).doc(stakeId), {
        ...stakeFields,
        status: STAKE_STATUS.VOIDED,
        voidReason: reason,
        voidedAt: nowIso,
      });
      const result = creditRefund(tx, wRef, walletDocs.get(wRef.path), {
        stakeId,
        groupId,
        amount: stake.amount,
        monthKey,
        now,
      });
      // AND THE STAKE SIDE'S OWN MONTH ATTRIBUTION, threaded onward from the
      // refund's returned wallet (the PR 1 contract).
      //
      // WITHOUT THIS THE REFUND IS NOT SCORE-NEUTRAL, which §2 requires of every
      // voided stake. `debitStake` moves only `careerNet`, so the stake and its
      // refund cancel there — but `creditRefund` also credits
      // `seasons.{monthKey}.net`, and nothing debits it, so each voided stake
      // would leave `+amount` in that month for ever. A backer whose pool went
      // `insufficient` would read a positive month for a week in which nothing
      // happened. `recordStakeLoss` (the PR 2 carry-in E2 primitive) writes the
      // missing half and touches `careerNet` not at all, so the pairing is
      // exactly neutral in BOTH fields.
      //
      // The E2 ruling's "for voided stakes writes nothing" carve-out is the one
      // place this build departs from it, and deliberately: that carve-out is
      // sound only for the careerNet-touching primitive the ruling described,
      // where a second entry would double-debit. This primitive does not touch
      // careerNet (see its docstring), so the carve-out's own reason — "the
      // stake's own debit is already reversed by the refund" — is already true
      // of careerNet and silent about the month bucket. Reversing the decision
      // is deleting this one call.
      const attributed = recordStakeLoss(tx, wRef, result.wallet, {
        stakeId,
        groupId,
        amount: stake.amount,
        monthKey,
        now,
      });
      walletDocs.set(wRef.path, attributed.wallet);
      if (result.applied) refunded += 1;
    }

    // (4) REVEAL — the totals re-derived from the stakes STEP 3 JUDGED, written
    // to the private cache and copied up to the public doc in the same statement
    // pair, so the two can never disagree (§9).
    //
    // OVER `surviving`, NOT over what is still `live` afterwards. For a `closed`
    // pool the two sets are identical. They differ only on `insufficient`, where
    // step 3 voids everything — and folding the post-void set there would
    // publish `backers 0 of 3 · teams 0 of 2` to a backer whose stake had just
    // been voided for thin participation, which is the opposite of the fact (§9:
    // pool copy states exact facts). The revealed numbers are therefore the ones
    // validity was evaluated on; the stakes themselves carry `voidReason`, and
    // the pool's status says `insufficient`, so nothing here reads as a live pot.
    const totals = totalsFromStakes(surviving);
    tx.set(poolTotalsRefFor(db, group), { ...totals.private, updatedAt: nowIso });

    const teams = frozenTeams.map((team) => ({
      odUserId: team.odUserId,
      isCpu: team.isCpu,
      stakeTotal: totals.byTeam[team.odUserId]?.stakeTotal ?? 0,
      backerCount: totals.byTeam[team.odUserId]?.backerCount ?? 0,
    }));

    //
    // THE REVEAL IS WHERE THE POT COMES BACK (Amendment B §B5). While the pool
    // was open, `potTotal`, `uniqueBackers` and `teamsBacked` lived ONLY in
    // `private/totals`; the close copies all three up to the public document,
    // from the very object the statement above wrote into that sealed doc, so
    // the revealed numbers and the sealed cache are one source by construction
    // (§9) rather than two reads that agree today.
    const closedPool = {
      ...pool,
      status,
      teams,
      humanTeams: frozenTeams.filter((t) => !t.isCpu).length,
      potTotal: totals.private.potTotal,
      uniqueBackers: totals.private.uniqueBackers,
      teamsBacked: totals.private.teamsBacked,
      closedAt: nowIso,
      updatedAt: nowIso,
    };
    // AND THE CAPPED PAIR DOES NOT SURVIVE IT. `backerProgress` / `teamSpread`
    // exist to seal an OPEN pool; once the exact counts are published they are
    // a second, coarser source for the same fact — `count: 3` sitting beside
    // `uniqueBackers: 5` is precisely the drift §9 forbids. Deleted from the
    // whole-doc `tx.set` payload, so the reveal leaves exactly one answer to
    // "how many backers" on the document.
    delete closedPool.backerProgress;
    delete closedPool.teamSpread;
    tx.set(ref, closedPool);

    return { closed: true, status, pool: closedPool, voided: voids.length, refunded };
  });
}

/**
 * Per-team and per-backer totals, derived from a list of LIVE stakes.
 *
 * The one place the numbers are folded, used by the close (over the stakes
 * themselves) and by the stake endpoint (over the private cache it is
 * updating), so the public counters and the sealed cache are the same
 * arithmetic — never two implementations that agree today (§9).
 */
export function totalsFromStakes(stakes) {
  const backers = {};
  for (const stake of stakes) {
    const uid = stake.userId;
    const team = stake.teamOdUserId;
    const amount = Number.isFinite(stake.amount) ? Math.floor(stake.amount) : 0;
    if (typeof uid !== 'string' || typeof team !== 'string' || amount <= 0) continue;
    const entry = backers[uid] ?? (backers[uid] = { total: 0, byTeam: {} });
    entry.byTeam[team] = (entry.byTeam[team] ?? 0) + amount;
    entry.total += amount;
  }
  return totalsFromBackers(backers);
}

/**
 * The same fold, starting from the `backers` map the sealed cache stores.
 * `backers` is the cache's ONE stored structure; `byTeam`, `potTotal`,
 * `uniqueBackers` and `teamsBacked` are all derived from it on every write, so
 * a per-team total can never drift from the per-backer amounts that make it up.
 */
export function totalsFromBackers(backers) {
  const byTeam = {};
  let potTotal = 0;
  for (const entry of Object.values(backers ?? {})) {
    for (const [team, amount] of Object.entries(entry?.byTeam ?? {})) {
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const bucket = byTeam[team] ?? (byTeam[team] = { stakeTotal: 0, backerCount: 0 });
      bucket.stakeTotal += amount;
      bucket.backerCount += 1;
      potTotal += amount;
    }
  }
  const uniqueBackers = Object.keys(backers ?? {}).length;
  const teamsBacked = Object.keys(byTeam).length;
  return {
    byTeam,
    potTotal,
    uniqueBackers,
    teamsBacked,
    // THE SEALED CACHE NOW CARRIES THE POT AND THE EXACT COUNTS (Amendment B
    // §B5). They used to live on the public document; they live here, beside
    // the per-team totals that were already sealed, because `private/*` is the
    // one place no client may read. `backers` remains the cache's ONE stored
    // structure and everything else on this object is derived from it in this
    // function, so the sealed numbers cannot drift from the amounts that make
    // them up — and the close and (PR 3) settlement read the pot from here.
    private: { backers: backers ?? {}, byTeam, potTotal, uniqueBackers, teamsBacked },
  };
}

// ==================== (4) THE LAZY DRIVER (§7) ====================

/**
 * Close the pod's pool if the clock has passed it (§7: the close runs lazily on
 * the first read after `closesAt`, or at settlement, whichever comes first).
 *
 * Called by BOTH endpoints in this PR and by PR 3's settlement. It reads the
 * pool OUTSIDE a transaction to decide whether there is anything to do — the
 * common case is "not yet", and paying for a transaction to learn that would put
 * every pod in the list on the same contended document. `closePool` re-reads and
 * re-checks the status inside its own transaction, so the cheap read can only
 * ever cause an unnecessary attempt, never a wrong one.
 *
 * @param {Object|string} groupOrId the group doc, or a groupId to read.
 */
export async function ensureClosed(db, groupOrId, now = new Date()) {
  const group = typeof groupOrId === 'string' ? await readGroup(db, groupOrId) : groupOrId;
  const groupId = typeof groupOrId === 'string' ? groupOrId : groupOrId?.id;

  // THE DELETED POD (§7). The doc is gone, so `isDev` is gone with it and the
  // pool id cannot be derived from the group — both namespaces are probed, in
  // production-first order. Two cheap gets, only on this path.
  if (group == null) {
    for (const isDev of [false, true]) {
      const tombstone = { id: groupId, isDev, missing: true };
      const snap = await poolRefFor(db, tombstone).get();
      if (!snap.exists) continue;
      if (snap.data().status !== POOL_STATUS.OPEN) {
        return { closed: false, reason: 'not_open', status: snap.data().status, pool: snap.data() };
      }
      return closePool(db, tombstone, now);
    }
    return { closed: false, reason: 'no_pool' };
  }

  const snap = await poolRefFor(db, group).get();
  if (!snap.exists) return { closed: false, reason: 'no_pool' };
  const pool = snap.data();
  if (pool.status !== POOL_STATUS.OPEN) {
    return { closed: false, reason: 'not_open', status: pool.status, pool };
  }
  const nowMs = new Date(now).getTime();
  const closesMs = new Date(pool.closesAt).getTime();
  // A pool whose `closesAt` is unreadable is closed rather than left open
  // forever: the conservative direction, and the battle-doc belt backstops the
  // stake path either way.
  if (Number.isFinite(closesMs) && nowMs < closesMs) {
    return { closed: false, reason: 'still_open', pool };
  }
  return closePool(db, group, now);
}

/** The group doc as `{ id, ...data }`, or null when it is gone (§7). */
export async function readGroup(db, groupId) {
  if (typeof groupId !== 'string' || groupId.length === 0) return null;
  const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

// Re-exported so a caller that already has this module does not need a second
// import for the reason vocabulary it surfaces (the window helpers stay in
// backingWeek.js — this is a name re-export, not a second copy).
export { POOL_INELIGIBLE, poolEligible, closesAtFor, opensAtFor, battleMondayEtDateFor };
