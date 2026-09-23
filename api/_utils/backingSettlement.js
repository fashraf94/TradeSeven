// api/_utils/backingSettlement.js
//
// Backing Beta PR 3 — THE SETTLEMENT (spec V1.3 §1 tie set, §3 payout math,
// §7 predicate / host / retries, §12 PR 3, §15 D-j / D-n / D-o; Amendment B
// §B7.2 for the stake-side attribution; the Sept 16 pre-build check
// `docs/2026-09-16_PR3_SETTLEMENT_HOOK_PREBUILD_CHECK.md` §3 hazards H1–H5,
// each of which is a hard rule of this module and has a test).
//
// ONE PRIMITIVE, THREE HOSTS. `settlePool(db, groupId, { now, source })` is
// the whole of settlement, and it is what the Friday duty hook
// (tournamentAdvancement.js), the pod list's settle-on-read
// (api/tournament/backing-pools.js) and the admin re-run
// (api/tournament/backing-settle.js) each call. None of them carries any
// settlement logic of its own; the hosts differ only in `source`.
//
// THE DECISION IS MADE ON A FRESH IN-TRANSACTION READ (H4). This function takes
// a groupId, NEVER a group object: the Friday loop's group is the pre-transition
// snapshot (its `status` still reads `battle` after `transitionStatus` ran), and
// a predicate evaluated on it fails the status clause for ever. The group doc
// and the pool doc are both re-read inside the transaction, and the four-part
// predicate (§7) is evaluated on THAT read. The cheap reads that precede the
// transaction only decide whether a transaction is worth opening; they decide
// nothing about money.
//
// THE POOL'S STATUS IS THE GUARD (H5, §6 "settlement by groupId"). A pool is
// settled from `closed` only. `closed → resolved` is decided on the
// in-transaction read of the pool document, so two settlers reaching one pool
// at the same instant (a duty tick and a client read at 17:21 ET) serialize on
// it: Firestore commits one and re-runs the other, which then sees `resolved`
// and returns WITHOUT PAYING. `resolving` is the HOLD state — written with a
// `holdReason`, never as a mid-flight marker — and only the admin endpoint's
// explicit `overrideHold` may settle out of it.
//
// THE AGENT-LESS REFUSAL (D-ae, founder ruling of Sept 16). Until the N1
// detection lands in banking (Amendment A §A1 / §11 gate 6), the predicate
// cannot tell a whole week from one that played without an agent layer: an
// empty agent map banks as a real zero, so the week completes with composite
// = 1.5 × user and the predicate is satisfied (pre-build check §2.7). So this
// module refuses on its own: if EVERY human seat has `agentPoints` 0 on the
// clamped final banked day — the same day entry `getWeeklyComposite` reads —
// the pool is held in `resolving` with `holdReason: 'agent_layer_absent'`,
// loudly, for a human. Over-blocking is recoverable; paying on a
// half-composite is not.
//
// THE STAKE CEILING (H3). One transaction per pool, bounded: the live-stake
// count is asserted INSIDE the transaction against `SETTLEMENT_MAX_STAKES`, and
// the projected write count against `SETTLEMENT_MAX_WRITES`; either past its
// bound holds the pool `resolving` with `holdReason: 'stake_ceiling'` rather
// than attempting a commit Firestore would reject. See the constants for the
// arithmetic.
//
// WRITES ONLY TO BACKING COLLECTIONS (H2): `backingPools`, `backingStakes`,
// `backingWallets`. Never `tournamentGroups` (no `settledAt` on a terminal doc
// — `updatedAt` orders the pod-list query), never `tournamentRanks`,
// `tournamentLeaderboards` or orchestrator state. The co-located test walks
// the write log of a full settlement and asserts no `tournament*` path.
//
// IDEMPOTENT AT EVERY GRAIN: the pool's status guards the pool, each stake's
// status guards the stake DOCUMENT (only `live` stakes are decided), and the
// wallet's `appliedEntries` guards each ledger entry (`loss:{stakeId}`,
// `payout:{stakeId}`). A retry — the SDK re-running the body on its one
// Transaction object, or a second host re-calling after a crash between
// hosts — converges on the same final state. The fixtures: the SDK-retry row
// proves re-entrancy of the body on a shared transaction object; the
// crash-mid-settlement row proves convergence from a PARTIAL store that only
// the non-atomic test stand-in can produce (Firestore commits atomically), so
// the prior-stakes ledger re-visit below is belt under production semantics.
//
// THE PAYOUT MATH IS §3'S, AND NOTHING ELSE'S: `payout = floor(stake × pot ÷
// winningStakes)`, integer BP, the rounding remainder BURNED. The pot and the
// per-team totals are read from `backingPools/{id}/private/totals`, where the
// close (Amendment B §B5) left them — never re-summed from the stakes here,
// because a partial retry sees only the stakes still `live` and a re-sum would
// change the divisor mid-flight. Winners are the D-j tie set: every
// `groupMembers` id whose `getWeeklyComposite` STRICTLY equals the maximum,
// `Number.isFinite`-guarded, never a raw `dailyScores` read. An unbacked
// winning set means every live stake loses (§3); there is no outcome-dependent
// refund.
//
// THE STAKE SIDE OF EVERY SETTLED STAKE gets `recordStakeLoss` (Amendment B
// §B7.2) — winners beside their `creditPayout`, losers alone — with `monthKey`
// from the ladder's own `monthKeyForGroup`. Voided stakes are not read here
// (they are not `live`) and get nothing.
//
// TELEMETRY NEVER FAILS SETTLEMENT (§1, D-m). EACH team's `agentId` and
// `hashAtSettlement` (§1: "the pool records each team's agentId and
// equippedConfigHash"; §6 `teams[].agentId` / `teams[].hashAtSettlement`) are
// resolved from the agent-draft stream and the seat's CURRENT tournament
// battle doc (the P7 selector) before the transaction, best-effort; any
// failure yields `null` and the settlement proceeds. Every team, not only the
// winners: the loadout-changed marker (§4) sits on a backer's OWN stakes,
// which may be on a losing team.
//
// THE REFUND (Backing Beta PR 5; spec §7 "Refund paths"; the PR 3 review
// record's finding 21). `refundPool(db, groupId, { now, reason, source })` is
// the fourth write path and the ONE primitive for the §7 paths the close does
// not reach: a group that goes `voided` (from `battle`, an in-week event on a
// closed pool) or `expired` (from the pre-battle states) after its pool
// closed, a group doc deleted after the close, and the admin refund for
// degraded, holiday, frozen or lingering pods. One transaction, fresh reads of
// the pool and the group, allowed from `closed` or `resolving` ONLY: every
// `live` stake is voided with the matching `voidReason` and paired
// `creditRefund` + `recordStakeLoss` EXACTLY as `closePool` pairs them, so a
// refunded stake nets to zero in the career record AND the season bucket; the
// pool lands `refunded` with `refundReason` and `refundedAt`. The status gate
// is what makes a refund racing a settlement safe: both re-read the pool
// inside their own transaction, Firestore commits one, and the other re-runs
// to find `resolved` or `refunded` and writes nothing. `settlePool` ROUTES to
// it — on its fresh group read a voided, expired or missing group is a refund,
// never `not_final` — so the results reader's settle-on-read and the admin
// re-run inherit the refund paths without carrying any refund logic of their
// own. The same stake ceiling and the same allowlist discipline apply.
//
// Imports the zero-import schema module from src/ under the revised June 2026
// import rule (BUILD_RULES §4); the co-located test's real import of THIS
// module is the dependency-surface guard — never mock it.

import { TOURNAMENT_ADVANCEMENT_FROZEN } from '../../src/config/featureFlags.js';
import {
  AGENT_DRAFT_STREAM_DOC_ID,
  GROUP_STATUS,
  STREAMS_SUBCOLLECTION,
  TOURNAMENT_GAME_MODE,
  TOURNAMENT_GROUPS_COLLECTION,
  getLatestBankedDayEntry,
  getWeeklyComposite,
  isCpuUserId,
  isWeekBanked,
  pickCurrentTournamentBattle,
} from '../../src/constants/leagueTournament.js';
import { monthKeyForGroup } from './tournamentLeaderboard.js';
import {
  BACKING_STAKES_COLLECTION,
  POOL_STATUS,
  STAKE_STATUS,
  VOID_REASONS,
  ensureClosed,
  liveTeamsFor,
  monthKeyForPool,
  poolRefFor,
  poolTotalsRefFor,
  readGroup,
} from './backingPools.js';
import { creditPayout, creditRefund, readWallet, recordStakeLoss, walletRef } from './backingWallet.js';

const LOG_PREFIX = '[BackingSettlement]';

/**
 * The most `live` stakes one settlement transaction will carry (H3).
 *
 * THE ARITHMETIC, stated so nobody has to re-derive it. Per settled stake the
 * transaction writes the stake document (1) and the stake side's month
 * attribution (`recordStakeLoss`: entry + wallet, 2); a WINNING stake adds its
 * payout (`creditPayout`: entry + wallet, 2). So a losing stake costs 3 writes
 * and a winning one 5, plus one pool write. Firestore caps a transaction at
 * 500 writes. At 120 stakes the all-losing case is 361 writes; the all-winning
 * case would be 601, which is why the write PROJECTION below is asserted
 * beside the count rather than instead of it — the count is the legible
 * bound, the projection is the one Firestore enforces. Beta scale is nowhere
 * near either: ALLOWANCE_BP / MIN_STAKE_BP caps a backer at 20 stakes a week
 * and realistic pools carry ≤ 40 (pre-build check §2.6).
 */
export const SETTLEMENT_MAX_STAKES = 120;

/**
 * The most writes one settlement transaction will project before holding
 * instead (H3) — 20 under Firestore's 500-write transaction limit (platform
 * knowledge, ASSUMED in the pre-build check §2.6 and not verifiable in-tree)
 * as pure margin; the projection already counts the pool write and every
 * wallet re-set. Counted conservatively: every `commitWallet` call is a write
 * even when two stakes by one backer re-set the same wallet document, which
 * matches the SDK's per-operation count (no same-document coalescing).
 */
export const SETTLEMENT_MAX_WRITES = 480;

/** Why a pool is held in `resolving` instead of paid (§6). Admin-only release. */
export const HOLD_REASON = Object.freeze({
  AGENT_LAYER_ABSENT: 'agent_layer_absent',
  STAKE_CEILING: 'stake_ceiling',
});

/** The three hosts, recorded on the pool as `settlementRef` (§6). */
export const SETTLEMENT_SOURCE = Object.freeze({
  FRIDAY_DUTY: 'friday_duty',
  SETTLE_ON_READ: 'settle_on_read',
  ADMIN: 'admin',
  ADMIN_SIM: 'admin_sim',
});

/**
 * Every reason `settlePool` can answer `{ settled: false }` with. `REFUNDED`
 * (PR 5) is the one that also carries `refunded: true`: the pod's pool was
 * routed to `refundPool` and refunded — a result, not a refusal.
 */
export const SETTLEMENT_REASON = Object.freeze({
  FROZEN: 'frozen',
  NO_GROUP: 'no_group',
  NOT_FINAL: 'not_final',
  NO_POOL: 'no_pool',
  POOL_OPEN: 'pool_open',
  ALREADY_SETTLED: 'already_settled',
  TERMINAL: 'terminal',
  HELD: 'held',
  AGENT_LAYER_ABSENT: 'agent_layer_absent',
  STAKE_CEILING: 'stake_ceiling',
  REFUNDED: 'refunded',
});

/**
 * Every reason `refundPool` can answer `{ refunded: false }` with (PR 5).
 * `already_refunded` and `already_settled` are idempotency working — the race
 * loser's answer — not failures.
 */
export const REFUND_REASON = Object.freeze({
  NOT_TERMINAL: 'not_terminal',
  NO_POOL: 'no_pool',
  POOL_OPEN: 'pool_open',
  ALREADY_REFUNDED: 'already_refunded',
  ALREADY_SETTLED: 'already_settled',
  TERMINAL: 'terminal',
  HELD: 'held',
  STAKE_CEILING: 'stake_ceiling',
  // A `won` / `lost` stake inside an undecided pool (out-of-band only): the
  // refund refuses rather than refund AROUND it and seal a recoverable book
  // as `refunded` (MONEY-3, the PR 5 review record). Returned, never thrown:
  // on the versioned harness a body can read the pool before and the stakes
  // after a competing settlement's commit, and a throw would turn that race
  // into a hard error where the pristine flow re-runs and answers
  // `already_settled` (MONEY-R-1).
  CORRUPT_BOOK: 'corrupt_book',
  // A stake whose amount is not a positive integer: refused BEFORE the first
  // write, as the settlement refuses it (MONEY-R-3).
  MALFORMED_STAKE: 'malformed_stake',
});

/**
 * The §7 refund reason a GROUP's own state carries, or null when the group
 * still has a result to settle: a missing doc → `group_deleted`, `voided` →
 * `group_voided`, `expired` → `group_expired`. Pure; the ONE derivation, used
 * by `settlePool`'s routing on its fresh reads and re-derived by `refundPool`
 * on its own in-transaction read — so the reason written on a stake is the
 * truth at commit, never the caller's memory of it.
 */
export function refundReasonForGroup(group) {
  if (group == null) return VOID_REASONS.GROUP_DELETED;
  if (group.status === GROUP_STATUS.VOIDED) return VOID_REASONS.GROUP_VOIDED;
  if (group.status === GROUP_STATUS.EXPIRED) return VOID_REASONS.GROUP_EXPIRED;
  return null;
}

/** The reasons `refundPool` accepts — the §7 paths the close does not reach, plus the admin's. */
const REFUND_VOID_REASONS = new Set([
  VOID_REASONS.GROUP_VOIDED,
  VOID_REASONS.GROUP_EXPIRED,
  VOID_REASONS.GROUP_DELETED,
  VOID_REASONS.ADMIN,
]);

/**
 * The writes ONE refunded stake costs (H3, mirrored for the refund): the stake
 * document (1), `creditRefund` (entry + wallet, 2) and `recordStakeLoss`
 * (entry + wallet, 2). A settled stake costs 3 or 5; a refunded one always 5,
 * so the refund ceiling bites at 95 live stakes under `SETTLEMENT_MAX_WRITES`
 * (1 + 95 × 5 = 476).
 *
 * THE STUCK STATE, stated plainly (MONEY-4, the PR 5 review record): a book
 * of 96–120 live stakes SETTLES (the settlement's losers cost 3) but can never
 * be REFUNDED — the hold is structural and `fromHold` re-asserts the same
 * ceiling. The "≤ 40 stakes per pool" figure is ASSUMED beta scale, enforced
 * by nothing (the stake endpoint caps per backer and per team, never the
 * book), so five backers at the 20-stake cap reach it. No primitive exits it
 * today; the only procedure is the Console one described in
 * api/tournament/backing-settle.js, and a batched refund (priors costed at 0
 * once applied, wallets read before the ceiling) is the follow-up that would
 * close the class. Inherited posture: the settlement holds the same way above
 * 120 stakes (PR 3 review record, "the ceiling is STRUCTURAL").
 */
const REFUND_WRITES_PER_STAKE = 5;

/** A stake amount the ledger will accept: a positive integer of BP. */
const isValidStakeAmount = (amount) => Number.isInteger(amount) && amount > 0;

/**
 * A settlement refusal that must ABORT the transaction — a data-integrity
 * condition (missing totals, a malformed stake amount, a payout that does not
 * add up) where writing anything would be worse than writing nothing. Typed
 * like the sibling errors so hosts can `instanceof` it or read `.code`.
 */
export class BackingSettlementError extends Error {
  constructor(code, message, statusCode = 500) {
    super(message);
    this.name = 'BackingSettlementError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ==================== (1) THE PURE BLOCKS ====================

/**
 * The §7 settlement predicate — the ONE definition, four parts, in the spec's
 * order. Pure. Answers the failing arm so a host can log it.
 *
 *   complete            — the terminal status (never `battle`, never banking)
 *   isTraining !== true — training pods complete with zero ladder effects
 *   baseLayerWeek != null — a base-layer week, not a bracket game
 *   isWeekBanked        — the day-5 snapshot is present (the clamped reader)
 */
export function settlementPredicate(group) {
  if (group?.status !== GROUP_STATUS.COMPLETE) return { final: false, reason: 'not_complete' };
  if (group.isTraining === true) return { final: false, reason: 'training' };
  if (group.baseLayerWeek == null) return { final: false, reason: 'not_base_layer' };
  if (!isWeekBanked(group)) return { final: false, reason: 'not_banked' };
  return { final: true, reason: null };
}

/**
 * The human seats of a pod: every `groupMembers` id that is not a CPU, judged
 * by the seat flag OR the id shape — the `liveTeamsFor` rule (either alone
 * would miss a seat the other names).
 */
export function humanSeatsOf(group) {
  const members = Array.isArray(group?.groupMembers) ? group.groupMembers : [];
  const flagged = new Set(
    (Array.isArray(group?.players) ? group.players : [])
      .filter((p) => p?.isCpu === true && typeof p?.odUserId === 'string')
      .map((p) => p.odUserId),
  );
  return members.filter((id) => typeof id === 'string' && !flagged.has(id) && !isCpuUserId(id));
}

/**
 * D-ae: did this week play WITHOUT an agent layer? True iff every human seat
 * has `agentPoints` 0 on the CLAMPED final banked day — the day entry
 * `getLatestBankedDayEntry` returns, i.e. exactly the source `getWeeklyComposite`
 * reads, so this and the payout math look at one snapshot (BUILD_RULES §9).
 *
 * An ABSENT `agentPoints` is read as 0. The ruling names `=== 0` and every
 * production snapshot carries the field (banking writes it since P6), so the
 * only shape this widens on is a pre-P6 legacy entry, which exists in dev data
 * alone — and holding a dev pool for a human is the recoverable direction.
 *
 * A pod with NO human seat is not judged here: the defect class this guards
 * (Amendment A §A1) is a human pod whose agent draft never fired; with nobody
 * human there is nothing for that class to have missed.
 */
export function agentLayerAbsent(group) {
  const entry = getLatestBankedDayEntry(group)?.entry;
  if (!entry) return false;
  const humans = humanSeatsOf(group);
  if (humans.length === 0) return false;
  return humans.every((id) => (entry?.closeScores?.[id]?.agentPoints ?? 0) === 0);
}

/**
 * The D-j tie set: every `groupMembers` id whose `getWeeklyComposite` STRICTLY
 * equals the maximum — the stored `round2` values, no epsilon, no re-rounding,
 * exactly the tournament's own comparator. `Number.isFinite`-guarded: a seat
 * whose composite is not a finite number cannot win and cannot set the
 * maximum. Never a raw `dailyScores` read. Pure.
 *
 * @returns {{ winners: string[], max: number|null, composites: Object }}
 */
export function winningSet(group) {
  const members = Array.isArray(group?.groupMembers) ? group.groupMembers : [];
  const composites = {};
  let max = null;
  for (const id of members) {
    if (typeof id !== 'string') continue;
    const value = getWeeklyComposite(group, id);
    composites[id] = Number.isFinite(value) ? value : null;
    if (composites[id] !== null && (max === null || composites[id] > max)) max = composites[id];
  }
  const winners = max === null
    ? []
    : members.filter((id) => typeof id === 'string' && composites[id] === max);
  return { winners, max, composites };
}

/**
 * §3, verbatim: `payout = floor(stake × pot ÷ winningStakes)`, integer BP.
 * The rounding remainder is the caller's to burn. Pure.
 */
export function payoutFor(amount, pot, winningStakes) {
  if (!(winningStakes > 0)) return 0;
  return Math.floor((amount * pot) / winningStakes);
}

/**
 * The settlement PLAN for one pool: who won, what each live stake gets, and
 * what the transaction will write. Pure — so the arithmetic is unit-testable
 * apart from the transaction, and the transaction body has one thing to do
 * with it.
 *
 * `pot` and `winningStakes` come from the SEALED TOTALS the close wrote, not
 * from the stakes handed in: on a partial retry only the still-`live` stakes
 * are present, and a divisor re-summed from them would pay the survivors a
 * different share than the stakes already settled got. The totals are the
 * record of the whole book at close and read the same on every attempt.
 *
 * THE INVARIANTS, asserted rather than trusted: every payout is a finite
 * non-negative integer; Σ payouts ≤ pot; and the burn over THIS pass's winning
 * stakes is less than their count (floor loses under one BP per stake). On a
 * clean full pass that is exactly "pot − Σ payouts < winner count". A violation
 * means the sealed totals disagree with the stakes — corruption, not a rounding
 * edge — and the transaction must abort rather than pay from a book it cannot
 * trust.
 */
export function planSettlement({ group, totals, stakes, priorPayouts = 0 }) {
  const { winners, max, composites } = winningSet(group);
  const byTeam = totals?.byTeam && typeof totals.byTeam === 'object' ? totals.byTeam : {};
  const pot = Number.isFinite(totals?.potTotal) ? Math.floor(totals.potTotal) : 0;
  const winnerSet = new Set(winners);
  let winningStakes = 0;
  for (const id of winners) {
    const teamTotal = byTeam[id]?.stakeTotal;
    if (Number.isFinite(teamTotal) && teamTotal > 0) winningStakes += Math.floor(teamTotal);
  }

  const outcomes = [];
  let payoutsTotal = 0;
  let winningAmountThisPass = 0;
  let projectedWrites = 1; // the pool document
  for (const stake of stakes) {
    const amount = stake?.amount;
    if (!Number.isFinite(amount) || amount <= 0 || Math.floor(amount) !== amount) {
      throw new BackingSettlementError('malformed_stake', `settlement: stake ${stake?.id} carries a malformed amount (${JSON.stringify(amount)})`);
    }
    const won = winningStakes > 0 && winnerSet.has(stake.teamOdUserId);
    const payout = won ? payoutFor(amount, pot, winningStakes) : 0;
    if (!Number.isFinite(payout) || payout < 0 || Math.floor(payout) !== payout) {
      throw new BackingSettlementError('payout_invariant', `settlement: payout for stake ${stake.id} is not a non-negative integer (${payout})`);
    }
    if (won && payout <= 0) {
      throw new BackingSettlementError('payout_invariant', `settlement: winning stake ${stake.id} would pay ${payout} — the sealed totals disagree with the stakes`);
    }
    outcomes.push({ stake, won, payout });
    payoutsTotal += payout;
    if (won) winningAmountThisPass += amount;
    projectedWrites += won ? 5 : 3;
  }

  // Σ payouts ≤ pot, OVER THE WHOLE BOOK: this pass's payouts plus what an
  // earlier, interrupted pass already paid (the already-`won` stakes' stored
  // payouts), so a retry cannot overpay the pot in two halves.
  if (payoutsTotal + priorPayouts > pot) {
    throw new BackingSettlementError('payout_invariant', `settlement: Σ payouts ${payoutsTotal + priorPayouts} exceeds the pot ${pot}`);
  }
  // The burn over this pass's winning stakes: their exact pro-rata share minus
  // what floor paid. Under one BP per winning stake, by construction.
  const winningCount = outcomes.filter((o) => o.won).length;
  const exactShare = winningStakes > 0 ? (winningAmountThisPass * pot) / winningStakes : 0;
  const burned = exactShare - outcomes.reduce((sum, o) => sum + (o.won ? o.payout : 0), 0);
  if (!(burned >= 0) || !(burned < Math.max(winningCount, 1))) {
    throw new BackingSettlementError('payout_invariant', `settlement: rounding remainder ${burned} is not under the winner count ${winningCount}`);
  }

  const paysX = winningStakes > 0 ? Math.round((pot / winningStakes) * 100) / 100 : null;
  return {
    winners, max, composites, pot, winningStakes, paysX, outcomes,
    payoutsTotal, winningCount, burned: pot - payoutsTotal, projectedWrites,
  };
}

// ==================== (2) TELEMETRY (§1, D-m) ====================

/**
 * Each seat's `agentId` and loadout hash for the settled pool — the agent-draft
 * stream is the source of record for the agent (`events[].agentId` per
 * `odUserId`, §1 / D-y), and the pod's tournament battle doc carries the
 * `resolvedAgentManifest.equippedConfigHash` the results card's loadout
 * marker compares against `hashAtStake`. CPU seats get no hash: all CPUs share
 * one, so §1 suppresses the marker for them.
 *
 * NEVER THROWS, NEVER DECIDES. Two best-effort reads, each in its own catch;
 * every unresolvable value is `null`. Runs OUTSIDE the transaction so a failed
 * or slow telemetry read can neither abort nor retry the money path.
 *
 * @param {{odUserId: string, isCpu: boolean}[]} seats
 * @returns {Promise<Map<string, {agentId: string|null, hashAtSettlement: string|null}>>}
 */
export async function resolveSettlementTelemetry(db, groupId, seats) {
  const out = new Map();
  for (const seat of seats) {
    if (typeof seat?.odUserId === 'string') out.set(seat.odUserId, { agentId: null, hashAtSettlement: null });
  }
  const isCpu = (id) => seats.find((s) => s?.odUserId === id)?.isCpu === true || isCpuUserId(id);
  try {
    const streamSnap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId)
      .collection(STREAMS_SUBCOLLECTION).doc(AGENT_DRAFT_STREAM_DOC_ID).get();
    if (streamSnap.exists) {
      for (const event of streamSnap.data()?.events ?? []) {
        const rec = out.get(event?.odUserId);
        if (rec && rec.agentId === null && typeof event?.agentId === 'string' && event.agentId.length > 0) {
          rec.agentId = event.agentId;
        }
      }
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} agent-draft stream unreadable for ${groupId} (telemetry only):`, err?.message);
  }
  try {
    // A seat's battles are deployed FRESH daily (up to five per group), so the
    // hash "at settlement" is the seat's CURRENT battle's — chosen by the P7
    // selector (`pickCurrentTournamentBattle`: active, else latest createdAt),
    // the ONE home for that rule — never whichever doc the query returned
    // first. A field mask keeps the read to what is needed.
    const battles = await db.collection('agentBattles')
      .where('groupId', '==', groupId)
      .select('gameMode', 'ownerId', 'agentId', 'status', 'createdAt', 'resolvedAgentManifest.equippedConfigHash')
      .get();
    const byOwner = new Map();
    battles.forEach((doc) => {
      const data = doc.data();
      if (data?.gameMode !== TOURNAMENT_GAME_MODE || !out.has(data.ownerId)) return;
      const list = byOwner.get(data.ownerId) ?? [];
      list.push(data);
      byOwner.set(data.ownerId, list);
    });
    for (const [ownerId, list] of byOwner) {
      const current = pickCurrentTournamentBattle(list);
      const rec = out.get(ownerId);
      if (!current || !rec) continue;
      if (rec.agentId === null && typeof current.agentId === 'string' && current.agentId.length > 0) rec.agentId = current.agentId;
      if (isCpu(ownerId)) continue;
      const hash = current.resolvedAgentManifest?.equippedConfigHash;
      if (typeof hash === 'string' && hash.length > 0) rec.hashAtSettlement = hash;
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} battle docs unreadable for ${groupId} (telemetry only):`, err?.message);
  }
  return out;
}

// ==================== (3) THE TRANSACTION ====================

/**
 * EVERY stake of the pod — one equality filter on `groupId` (the automatic
 * single-field index), partitioned by status in memory. Settlement reads the
 * whole book rather than only the `live` stakes because the pool's record
 * (`stakesSettled`, `payoutsTotal`, `burnedBp`) must describe the WHOLE
 * settlement even when a retry finishes what an interrupted pass began: the
 * already-`won` stakes carry their stored payouts, and this pass adds to
 * them. Only `live` stakes are written.
 */
function stakesQuery(db, groupId) {
  return db.collection(BACKING_STAKES_COLLECTION).where('groupId', '==', groupId);
}

/** The `backingStakes/{stakeId}` document reference. */
function stakeRefFor(db, stakeId) {
  return db.collection(BACKING_STAKES_COLLECTION).doc(stakeId);
}

const TERMINAL_POOL_STATUSES = new Set([POOL_STATUS.INSUFFICIENT, POOL_STATUS.REFUNDED]);
const SOURCES = new Set(Object.values(SETTLEMENT_SOURCE));

function requireArgs(groupId, source, now) {
  if (typeof groupId !== 'string' || groupId.length === 0) {
    throw new BackingSettlementError('invalid_group_id', 'settlePool: a non-empty groupId is required', 400);
  }
  if (!SOURCES.has(source)) {
    throw new BackingSettlementError('invalid_source', `settlePool: source must be one of ${[...SOURCES].join(', ')}`, 400);
  }
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) {
    throw new BackingSettlementError('invalid_now', `settlePool: no instant derivable from ${String(now)}`, 400);
  }
  return date;
}

/**
 * Settle one pod's pool. ONE transaction, callable from all three hosts.
 *
 * @param {Object} db
 * @param {string} groupId — the id, NEVER a group object (H4; see the header).
 * @param {Object} opts
 * @param {Date|string} [opts.now] the instant of record (`settledAt`).
 * @param {string} opts.source one of `SETTLEMENT_SOURCE` → `settlementRef`.
 * @param {boolean} [opts.overrideHold=false] ADMIN ONLY: settle a pool held
 *   in `resolving`, clearing its hold. The agent-less refusal is bypassed (that
 *   is what the override is for); the stake ceiling is structural and is
 *   re-asserted regardless.
 * @param {string|null} [opts.actor] who released the hold (logged + recorded).
 * @param {string|null} [opts.reason] why (logged + recorded).
 * @returns {Promise<{settled: boolean, reason?: string, holdReason?: string,
 *   pool?: Object, winners?: string[], winningStakes?: number, paysX?: number|null,
 *   stakesSettled?: number, payoutsTotal?: number, burned?: number}>}
 *   `stakesSettled` on the RETURN is this pass's count (the stakes decided by
 *   this call); `pool.stakesSettled`, `payoutsTotal` and `burned` are
 *   cumulative over the whole book. The two differ only after a partial
 *   store, which Firestore's atomic commit never produces.
 */
export async function settlePool(db, groupId, {
  now = new Date(), source, overrideHold = false, actor = null, reason = null,
} = {}) {
  // THE FREEZE, read at call time (A-C13: the endpoints have no freeze cover
  // of their own, and the duty's early-return sits ahead of the hook — this
  // is the one belt every host shares). Frozen means the composites may be
  // poisoned; paying on them is an irreversible consumer like a rank ratchet.
  if (TOURNAMENT_ADVANCEMENT_FROZEN) {
    console.error(`${LOG_PREFIX} FROZEN (TOURNAMENT_ADVANCEMENT_FROZEN): settlement of ${groupId} withheld (source ${source})`);
    return { settled: false, reason: SETTLEMENT_REASON.FROZEN };
  }
  const nowDate = requireArgs(groupId, source, now);
  const nowIso = nowDate.toISOString();

  // ---------- CHEAP READS: is a transaction worth opening? ----------
  // These decide only whether to proceed to the transaction, never the money:
  // every one of them is re-read and re-judged inside it (H4, H5).
  const cheapGroup = await readGroup(db, groupId);
  // The hand-off to the refund primitive (below): the group's own reason,
  // this host as the source, the admin's override as the hold release, and
  // the operator's free-text `reason` as the LOGGED note.
  const refundRoute = (refundReason) => routeToRefund(db, groupId, {
    now: nowDate, source, reason: refundReason, fromHold: overrideHold === true, actor, note: reason,
  });
  if (cheapGroup == null) {
    // THE DELETED POD (§7). An OPEN pool closes `refunded` through the close's
    // own tombstone path (`closePool`, every stake `group_deleted`); a pool
    // that had ALREADY closed when the doc vanished is the refund primitive's
    // (PR 5 — the PR 3 review record's finding 21), reached here so every
    // host inherits it. A pod with no pool at all has nothing to refund.
    const closed = await ensureClosed(db, groupId, nowDate);
    if (closed.closed === true) {
      return { settled: false, refunded: true, reason: SETTLEMENT_REASON.REFUNDED, refundReason: VOID_REASONS.GROUP_DELETED, pool: closed.pool };
    }
    if (closed.reason === 'no_pool') return { settled: false, reason: SETTLEMENT_REASON.NO_GROUP };
    return refundRoute(VOID_REASONS.GROUP_DELETED);
  }
  // A VOIDED or EXPIRED group has no result left to settle: its closed pool is
  // REFUNDED, never `not_final` (§7; finding 21). The clock's close runs first
  // if it is due, in the close's own transaction — a pool still inside its
  // window stays open and refunds once the clock has closed it.
  const terminalReason = refundReasonForGroup(cheapGroup);
  if (terminalReason !== null) {
    const closed = await ensureClosed(db, cheapGroup, nowDate);
    if (closed.reason === 'no_pool') return { settled: false, reason: SETTLEMENT_REASON.NO_POOL };
    if (closed.reason === 'still_open') return { settled: false, reason: SETTLEMENT_REASON.POOL_OPEN };
    return refundRoute(terminalReason);
  }
  const cheapPredicate = settlementPredicate(cheapGroup);
  if (!cheapPredicate.final) {
    return { settled: false, reason: SETTLEMENT_REASON.NOT_FINAL, predicate: cheapPredicate.reason };
  }
  // AN OPEN POOL PAST ITS CLOSE IS CLOSED FIRST (§7: "or by settlement,
  // whichever comes first"), in the close's OWN transaction, and this function
  // then re-enters against the closed document.
  const closed = await ensureClosed(db, cheapGroup, nowDate);
  if (closed.reason === 'no_pool') return { settled: false, reason: SETTLEMENT_REASON.NO_POOL };
  const cheapPool = closed.pool;
  if (cheapPool?.status === POOL_STATUS.OPEN) return { settled: false, reason: SETTLEMENT_REASON.POOL_OPEN };
  if (cheapPool?.status === POOL_STATUS.RESOLVED) return { settled: false, reason: SETTLEMENT_REASON.ALREADY_SETTLED, pool: cheapPool };
  if (TERMINAL_POOL_STATUSES.has(cheapPool?.status)) return { settled: false, reason: SETTLEMENT_REASON.TERMINAL, status: cheapPool.status, pool: cheapPool };
  if (cheapPool?.status === POOL_STATUS.RESOLVING && overrideHold !== true) {
    return { settled: false, reason: SETTLEMENT_REASON.HELD, holdReason: cheapPool.holdReason ?? null, pool: cheapPool };
  }

  // ---------- TELEMETRY (outside the transaction, never deciding) ----------
  const seats = Array.isArray(cheapPool?.teams) && cheapPool.teams.length > 0
    ? cheapPool.teams.map((t) => ({ odUserId: t.odUserId, isCpu: t.isCpu === true }))
    : liveTeamsFor(cheapGroup);
  const telemetry = await resolveSettlementTelemetry(db, groupId, seats);

  // ---------- THE TRANSACTION ----------
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  const outcome = await db.runTransaction(async (tx) => {
    // ----- READS (all of them, before any write) -----
    // (1) THE FRESH GROUP (H4) and the predicate on THAT read. A group that
    // turned voided/expired — or vanished — between the cheap read and this
    // one is a REFUND, decided on this read: the body returns a routing
    // sentinel having written nothing (a transaction that returns without a
    // write commits nothing), and the refund runs in its own transaction with
    // its own fresh reads after this one has closed.
    const groupSnap = await tx.get(groupRef);
    const routedReason = refundReasonForGroup(groupSnap.exists ? groupSnap.data() : null);
    if (routedReason !== null) return { __routeToRefund: routedReason };
    const group = { id: groupSnap.id, ...groupSnap.data() };
    const predicate = settlementPredicate(group);
    if (!predicate.final) {
      return { settled: false, reason: SETTLEMENT_REASON.NOT_FINAL, predicate: predicate.reason };
    }

    // (2) THE POOL, and the status gate (H5). The pool id routes off the FRESH
    // group's `isDev`, so a dev pod can never settle a production pool.
    const poolRef = poolRefFor(db, group);
    const poolSnap = await tx.get(poolRef);
    if (!poolSnap.exists) return { settled: false, reason: SETTLEMENT_REASON.NO_POOL };
    const pool = poolSnap.data();
    let releasing = false;
    switch (pool.status) {
      case POOL_STATUS.CLOSED:
        break;
      case POOL_STATUS.RESOLVING:
        if (overrideHold !== true) {
          return { settled: false, reason: SETTLEMENT_REASON.HELD, holdReason: pool.holdReason ?? null, pool };
        }
        releasing = true;
        break;
      case POOL_STATUS.RESOLVED:
        return { settled: false, reason: SETTLEMENT_REASON.ALREADY_SETTLED, pool };
      case POOL_STATUS.OPEN:
        return { settled: false, reason: SETTLEMENT_REASON.POOL_OPEN };
      default:
        return { settled: false, reason: SETTLEMENT_REASON.TERMINAL, status: pool.status, pool };
    }

    // (3) THE SEALED TOTALS — the pot and the per-team book at close (§B5).
    const totalsSnap = await tx.get(poolTotalsRefFor(db, group));
    if (!totalsSnap.exists) {
      throw new BackingSettlementError('totals_missing', `settlement: pool ${poolRef.path} is ${pool.status} but carries no private/totals — refusing to pay from an unknown book`);
    }
    const totals = totalsSnap.data();

    // (4) THE STAKES. Only `live` ones are DECIDED and have their document
    // written; `won` / `lost` are an earlier pass's decisions and fold into
    // the pool's cumulative record below. Their LEDGER work is re-visited too,
    // idempotently (`appliedEntries` makes an applied entry a no-op), so a
    // retry converges even from a state in which a stake document moved
    // before its wallet entries landed — unreachable under Firestore's atomic
    // commit, reachable in the fixture, and cheap to be right about. `voided`
    // stakes get nothing (§B7.2) and are not counted.
    const stakesSnap = await tx.get(stakesQuery(db, groupId));
    const stakes = [];
    const prior = [];
    let priorPayouts = 0;
    stakesSnap.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      if (data.status === STAKE_STATUS.LIVE) stakes.push(data);
      else if (data.status === STAKE_STATUS.WON || data.status === STAKE_STATUS.LOST) {
        const won = data.status === STAKE_STATUS.WON;
        const payout = Number.isFinite(data.payout) && data.payout > 0 ? Math.floor(data.payout) : 0;
        // A `won` stake always pays at least its own amount (pot ⊇ winning
        // stakes); one recorded as won with no payout is a corrupt book, and
        // re-visiting it silently would leave it unpaid for ever. Abort.
        if (won && payout <= 0) {
          throw new BackingSettlementError('payout_invariant', `settlement: stake ${data.id} is recorded won with payout ${JSON.stringify(data.payout)}`);
        }
        prior.push({ stake: data, won, payout });
        priorPayouts += payout;
      }
    });
    const priorSettled = prior.length;

    // ----- THE HOLDS (each writes the pool and returns; nothing else moves) -----
    let holdReason = null;
    // (5) THE STAKE CEILING (H3), asserted inside the transaction. Structural:
    // not bypassed by `overrideHold`, because the bound is Firestore's.
    if (stakes.length > SETTLEMENT_MAX_STAKES) holdReason = HOLD_REASON.STAKE_CEILING;
    // (6) THE AGENT-LESS REFUSAL (D-ae). Bypassed ONLY by an explicit override.
    if (holdReason === null && !releasing && agentLayerAbsent(group)) holdReason = HOLD_REASON.AGENT_LAYER_ABSENT;

    let plan = null;
    if (holdReason === null) {
      plan = planSettlement({ group, totals, stakes, priorPayouts });
      // Prior stakes' ledger re-visits count conservatively (they write
      // nothing when already applied, which under atomic commits is always).
      const projected = plan.projectedWrites + prior.reduce((n, p) => n + (p.won ? 4 : 2), 0);
      if (projected > SETTLEMENT_MAX_WRITES) holdReason = HOLD_REASON.STAKE_CEILING;
      else if (plan.winners.length === 0) {
        // No seat has a finite composite: not "unbacked winners" (§3 covers a
        // winner nobody backed) but NO winner at all — a corrupt week. Abort
        // loudly; nothing is written.
        throw new BackingSettlementError('no_winner', `settlement: ${groupId} has no seat with a finite composite (${JSON.stringify(plan.composites)})`);
      }
    }

    if (holdReason !== null) {
      const held = {
        ...pool,
        status: POOL_STATUS.RESOLVING,
        holdReason,
        heldAt: nowIso,
        holdSource: source,
        liveStakesAtHold: stakes.length,
        // WHO and WHEN are recorded; the operator's free-text WHY is logged
        // only — the pool document is authed-read by every signed-in user.
        ...(releasing ? { holdReleaseRefused: { by: actor ?? 'admin', at: nowIso } } : {}),
        updatedAt: nowIso,
      };
      tx.set(poolRef, held);
      console.error(`${LOG_PREFIX} HOLD: pool ${poolRef.path} held in resolving — holdReason=${holdReason} (live stakes ${stakes.length}, source ${source}${releasing ? ', override refused' : ''}). Release: POST /api/tournament/backing-settle { groupId, overrideHold: true }.`);
      return { settled: false, reason: holdReason, holdReason, pool: held };
    }

    // (7) THE WALLETS — the LAST reads, keyed by wallet path so two stakes by
    // one backer read the doc once and thread the returned state (the PR 1
    // contract, resolved by the module itself).
    const dev = pool.isDev === true;
    const ledgerWork = [
      ...plan.outcomes.map((o) => ({ ...o, decide: true })),
      ...prior.map((p) => ({ ...p, decide: false })),
    ];
    const walletDocs = new Map();
    for (const { stake } of ledgerWork) {
      const ref = walletRef(db, stake.userId, { dev });
      if (walletDocs.has(ref.path)) continue;
      const walletDoc = await readWallet(tx, ref);
      // A stake cannot exist without the wallet that was debited for it
      // (`debitStake` wrote both in one transaction), so a missing wallet at
      // settlement is an out-of-band deletion — a book this function cannot
      // trust. The primitives would mint a fresh wallet holding the payout
      // alone (the stake side gone); abort instead, writing nothing.
      if (walletDoc == null) {
        throw new BackingSettlementError('wallet_missing', `settlement: wallet ${ref.path} is missing for stake ${stake.id} — refusing to mint a record from nothing`);
      }
      walletDocs.set(ref.path, walletDoc);
    }

    // ----- WRITES -----
    // The ladder's own month (§2, BUILD_RULES §9): the ET month of the pod's
    // first banked day. A pool that reached settlement has banked, so the
    // fallback to the pool's battle-Monday month is belt.
    const monthKey = monthKeyForGroup(group) ?? monthKeyForPool(pool);
    let stakesSettled = 0;
    for (const { stake, won, payout, decide } of ledgerWork) {
      const { id: stakeId, ...stakeFields } = stake;
      // The stake DOCUMENT is written once, when it is decided (`live` →
      // `won` | `lost`); its status guards that write on every later pass.
      if (decide) {
        tx.set(stakeRefFor(db, stakeId), {
          ...stakeFields,
          status: won ? STAKE_STATUS.WON : STAKE_STATUS.LOST,
          payout,
          settledAt: nowIso,
        });
        stakesSettled += 1;
      }
      const wRef = walletRef(db, stake.userId, { dev });
      // THE STAKE SIDE, for EVERY settled stake (Amendment B §B7.2) — winners
      // and losers alike. Threaded onward from whatever state the wallet is in;
      // an already-applied entry is a no-op (the ledger's own guard).
      const attributed = recordStakeLoss(tx, wRef, walletDocs.get(wRef.path), {
        stakeId, groupId, amount: stake.amount, monthKey, now: nowDate,
      });
      let wallet = attributed.wallet;
      if (won && payout > 0) {
        const paid = creditPayout(tx, wRef, wallet, {
          stakeId, groupId, amount: payout, monthKey, now: nowDate,
        });
        wallet = paid.wallet;
      }
      walletDocs.set(wRef.path, wallet);
    }

    // (8) THE POOL: `resolved`, the winners, the ratio, and EACH team's agent +
    // loadout hash from the pre-read telemetry (`null` when unresolved).
    //
    // TWO pays × figures, and they mean different things (BUILD_RULES §9 — a
    // label is bound to the number it describes):
    //   · `pool.paysX` is the REALIZED ratio, pot ÷ winningStakes over the whole
    //     winning set (null when no winner was backed);
    //   · `teams[].paysX` is §3's own table — "pays × IF THIS TEAM WINS", pot ÷
    //     that team's stakes (null for an unbacked team) — the per-team figure
    //     the results card shows beside every seat, winner or not.
    // Neither is ever multiplied by a stake to produce a number a backer is
    // owed: the payout is `stake.payout`, floor-rounded per stake (§3), and a
    // 2-dp ratio × stake disagrees with it by design.
    const winnerSet = new Set(plan.winners);
    const teams = (Array.isArray(pool.teams) ? pool.teams : []).map((team) => {
      const tele = telemetry.get(team.odUserId) ?? { agentId: null, hashAtSettlement: null };
      const stakeTotal = Number.isFinite(team.stakeTotal) ? team.stakeTotal : 0;
      return {
        ...team,
        won: winnerSet.has(team.odUserId),
        paysX: stakeTotal > 0 ? Math.round((plan.pot / stakeTotal) * 100) / 100 : null,
        agentId: tele.agentId,
        hashAtSettlement: tele.hashAtSettlement,
      };
    });
    // THE RECORD IS CUMULATIVE: this pass plus whatever an interrupted earlier
    // pass already settled, so a retry writes the same pool document a single
    // clean pass would have (the fixture compares them byte for byte).
    const payoutsTotal = plan.payoutsTotal + priorPayouts;
    const resolved = {
      ...pool,
      status: POOL_STATUS.RESOLVED,
      monthKey,
      teams,
      winnerOdUserIds: plan.winners,
      winningStakes: plan.winningStakes,
      paysX: plan.paysX,
      stakesSettled: stakesSettled + priorSettled,
      payoutsTotal,
      burnedBp: plan.pot - payoutsTotal,
      settledAt: nowIso,
      settlementRef: source,
      updatedAt: nowIso,
    };
    if (releasing) {
      // WHO, WHEN and WHAT WAS HELD are recorded on the pool; the operator's
      // free-text WHY is in the log line below only — the pool document is
      // authed-read by every signed-in user, and a note is not a result.
      resolved.holdRelease = {
        by: actor ?? 'admin', at: nowIso, priorHoldReason: pool.holdReason ?? null,
      };
      delete resolved.holdReason;
      delete resolved.heldAt;
      delete resolved.holdSource;
      delete resolved.holdReleaseRefused;
      console.error(`${LOG_PREFIX} HOLD RELEASED: pool ${poolRef.path} settled out of resolving by ${actor ?? 'admin'} (prior hold ${pool.holdReason ?? 'none'}; reason: ${reason ?? 'none given'})`);
    }
    tx.set(poolRef, resolved);

    console.log(`${LOG_PREFIX} settled ${poolRef.path}: winners ${JSON.stringify(plan.winners)} @ ${plan.max}, winningStakes ${plan.winningStakes}, paysX ${plan.paysX}, ${stakesSettled} stakes this pass (${priorSettled} prior), payouts ${payoutsTotal} of pot ${plan.pot} (burned ${plan.pot - payoutsTotal}), source ${source}`);
    return {
      settled: true,
      pool: resolved,
      winners: plan.winners,
      winningStakes: plan.winningStakes,
      paysX: plan.paysX,
      stakesSettled,
      payoutsTotal,
      burned: plan.pot - payoutsTotal,
    };
  });
  if (outcome?.__routeToRefund) return refundRoute(outcome.__routeToRefund);
  return outcome;
}

// ==================== (4) THE REFUND (§7, PR 5 — finding 21) ====================

/**
 * `settlePool`'s hand-off to the refund primitive, shaped as a settlement
 * answer: `{ settled: false, refunded, reason, … }`, where `reason` is
 * `SETTLEMENT_REASON.REFUNDED` when the refund applied and the refund's own
 * refusal word (`REFUND_REASON`) when it did not. The hosts read one shape.
 */
async function routeToRefund(db, groupId, { now, source, reason, fromHold, actor, note }) {
  const out = await refundPool(db, groupId, { now, source, reason, fromHold, actor, note });
  const answer = { settled: false, refunded: out.refunded === true, reason: out.refunded === true ? SETTLEMENT_REASON.REFUNDED : out.reason };
  for (const key of ['refundReason', 'pool', 'holdReason', 'status', 'stakesVoided', 'groupStatus']) {
    if (out[key] !== undefined) answer[key] = out[key];
  }
  return answer;
}

/**
 * The pool document of a pod whose doc may be GONE: the group's own `isDev`
 * routes the id when the doc exists; otherwise both namespaces are probed,
 * production first (`ensureClosed`'s tombstone rule). Returns the reference,
 * the cheap snapshot's data (or null) and the tombstone-shaped group the
 * wallet namespace is read from.
 */
async function locatePool(db, groupId, cheapGroup) {
  if (cheapGroup != null) {
    const ref = poolRefFor(db, cheapGroup);
    const snap = await ref.get();
    return { ref, pool: snap.exists ? snap.data() : null };
  }
  for (const isDev of [false, true]) {
    const ref = poolRefFor(db, { id: groupId, isDev, missing: true });
    const snap = await ref.get();
    if (snap.exists) return { ref, pool: snap.data() };
  }
  return { ref: null, pool: null };
}

/**
 * Refund one pod's pool (§7's refund paths that the close does not reach;
 * the PR 3 review record's finding 21). ONE transaction, fresh reads of the
 * group and the pool, and the pool's status is the guard.
 *
 * WHAT IT DOES. Every `live` stake is voided with the matching `voidReason`
 * and paired `creditRefund` + `recordStakeLoss` EXACTLY as `closePool` pairs
 * them — the stake's own debit already moved `careerNet`, the refund credits
 * it back, and the stake-side month attribution cancels the refund's credit
 * in the season bucket, so a refunded stake nets to ZERO in both fields (§2:
 * "voided stakes are score-neutral"). The BP does not return as spendable
 * (`creditRefund` never touches `allowanceRemaining`). The pool lands
 * `refunded` with `refundReason`, `refundedAt`, `refundRef` and the ladder's
 * `monthKey`; stakes already `voided` by this reason have their ledger
 * re-visited idempotently (`appliedEntries` makes an applied entry a no-op),
 * so a retry from any interruption point converges on one final state.
 *
 * ALLOWED FROM `closed` OR `resolving` ONLY. An open pool is the clock's (or
 * the close's tombstone path's) to close first — `pool_open`, nothing
 * written; a `refunded` pool answers `already_refunded` and a `resolved` one
 * `already_settled`, each with nothing written, which is how a refund racing
 * a settlement resolves: exactly one commits, decided on the IN-TRANSACTION
 * status. A `resolving` HOLD is refunded only with `fromHold: true` — the
 * admin's explicit act (`action: 'refund'` on the admin endpoint, or an
 * admin re-run with `overrideHold`); the automatic hosts never pass it.
 *
 * THE REASON IS RE-DERIVED ON THE FRESH GROUP READ. The caller names the path
 * it saw (`group_voided`, `group_expired`, `group_deleted`) or `admin`; for
 * the three group paths this function derives the reason again from ITS read
 * of the group and writes THAT — a group that is not terminal on the fresh
 * read is `not_terminal`, nothing written. `admin` refunds whatever the
 * group's state (degraded, holiday, frozen or lingering weeks — §7); the
 * operator's free-text `note` is LOGGED and never written to the authed-read
 * pool document (the PR 3 review record's finding 3).
 *
 * SAME CEILING, SAME ALLOWLIST AS SETTLEMENT (H3). The live-stake count and
 * the projected write count are asserted INSIDE the transaction; past either
 * bound a `closed` pool is held `resolving` with `holdReason: 'stake_ceiling'`
 * rather than attempting a commit Firestore would reject. Writes only to
 * `backingPools`, `backingStakes` and `backingWallets` (H2). A missing wallet
 * aborts `wallet_missing` rather than minting a record from nothing (the
 * settlement's own posture, the PR 3 review record's finding 17).
 *
 * @param {Object} db
 * @param {string} groupId — the id, never a group object (H4).
 * @param {Object} opts
 * @param {Date|string} [opts.now] the instant of record (`refundedAt`, `voidedAt`, the entries' `at`).
 * @param {string} opts.reason one of `group_voided` | `group_expired` | `group_deleted` | `admin`.
 * @param {string} opts.source one of `SETTLEMENT_SOURCE` → `refundRef`.
 * @param {boolean} [opts.fromHold=false] admin only: refund a pool held in `resolving`.
 * @param {string|null} [opts.actor] who (recorded on a hold release as `holdRelease.by`).
 * @param {string|null} [opts.note] the operator's why — logged only, never stored.
 * @returns {Promise<{refunded: boolean, reason?: string, refundReason?: string,
 *   pool?: Object, stakesVoided?: number, priorVoided?: number, holdReason?: string,
 *   status?: string, groupStatus?: string|null}>}
 */
export async function refundPool(db, groupId, {
  now = new Date(), reason, source, fromHold = false, actor = null, note = null,
} = {}) {
  const nowDate = requireArgs(groupId, source, now);
  if (!REFUND_VOID_REASONS.has(reason)) {
    throw new BackingSettlementError('invalid_refund_reason', `refundPool: reason must be one of ${[...REFUND_VOID_REASONS].join(', ')}`, 400);
  }
  if (typeof fromHold !== 'boolean') {
    throw new BackingSettlementError('invalid_from_hold', 'refundPool: fromHold must be a boolean', 400);
  }
  const nowIso = nowDate.toISOString();

  // ---------- CHEAP READS: is a transaction worth opening? ----------
  // They decide only that; the group, the pool and every stake are re-read
  // and re-judged inside the transaction below.
  const cheapGroup = await readGroup(db, groupId);
  const located = await locatePool(db, groupId, cheapGroup);
  if (located.pool == null) return { refunded: false, reason: REFUND_REASON.NO_POOL };
  const cheapStatus = located.pool.status;
  if (cheapStatus === POOL_STATUS.OPEN) return { refunded: false, reason: REFUND_REASON.POOL_OPEN };
  if (cheapStatus === POOL_STATUS.REFUNDED) return { refunded: false, reason: REFUND_REASON.ALREADY_REFUNDED, pool: located.pool };
  if (cheapStatus === POOL_STATUS.RESOLVED) return { refunded: false, reason: REFUND_REASON.ALREADY_SETTLED, pool: located.pool };
  if (cheapStatus === POOL_STATUS.RESOLVING && fromHold !== true) {
    return { refunded: false, reason: REFUND_REASON.HELD, holdReason: located.pool.holdReason ?? null, pool: located.pool };
  }
  if (cheapStatus !== POOL_STATUS.CLOSED && cheapStatus !== POOL_STATUS.RESOLVING) {
    return { refunded: false, reason: REFUND_REASON.TERMINAL, status: cheapStatus, pool: located.pool };
  }
  if (reason !== VOID_REASONS.ADMIN && refundReasonForGroup(cheapGroup) === null) {
    return { refunded: false, reason: REFUND_REASON.NOT_TERMINAL, groupStatus: cheapGroup?.status ?? null };
  }

  // ---------- THE TRANSACTION ----------
  const poolRef = located.ref;
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  return db.runTransaction(async (tx) => {
    // ----- READS (all of them, before any write) -----
    // (1) THE FRESH GROUP, and the reason on THAT read.
    const groupSnap = await tx.get(groupRef);
    const group = groupSnap.exists ? { id: groupSnap.id, ...groupSnap.data() } : null;
    const derived = refundReasonForGroup(group);
    if (reason !== VOID_REASONS.ADMIN && derived === null) {
      return { refunded: false, reason: REFUND_REASON.NOT_TERMINAL, groupStatus: group?.status ?? null };
    }
    const voidReason = reason === VOID_REASONS.ADMIN ? VOID_REASONS.ADMIN : derived;

    // (2) THE POOL, and the status gate — the one that makes a refund racing
    // a settlement (or a second refund) safe.
    const poolSnap = await tx.get(poolRef);
    if (!poolSnap.exists) return { refunded: false, reason: REFUND_REASON.NO_POOL };
    const pool = poolSnap.data();
    let releasing = false;
    switch (pool.status) {
      case POOL_STATUS.CLOSED:
        break;
      case POOL_STATUS.RESOLVING:
        if (fromHold !== true) return { refunded: false, reason: REFUND_REASON.HELD, holdReason: pool.holdReason ?? null, pool };
        releasing = true;
        break;
      case POOL_STATUS.REFUNDED:
        return { refunded: false, reason: REFUND_REASON.ALREADY_REFUNDED, pool };
      case POOL_STATUS.RESOLVED:
        return { refunded: false, reason: REFUND_REASON.ALREADY_SETTLED, pool };
      case POOL_STATUS.OPEN:
        return { refunded: false, reason: REFUND_REASON.POOL_OPEN };
      default:
        return { refunded: false, reason: REFUND_REASON.TERMINAL, status: pool.status, pool };
    }

    // (3) THE STAKES — the whole book in one read, partitioned in memory: the
    // `live` ones are voided; the ones ALREADY voided by this reason have
    // their ledger re-visited (a no-op when applied) so a retry converges
    // from a partial store the non-atomic test stand-in can produce and
    // Firestore's atomic commit never does. `seat_left` / `insufficient`
    // voids were paired by the close already. A `won` / `lost` stake SHOULD
    // be impossible here (the status gate admits no settled pool; the
    // settlement writes its stakes and the pool atomically) — but an
    // out-of-band write can leave one, and refunding AROUND it would seal a
    // recoverable book as `refunded` for ever, with the card then showing a
    // payout the ledger never credited (MONEY-3 / MONEY-R-2, the PR 5 review
    // record): the refund REFUSES, writes nothing, and the operator repairs
    // the book in the Console and re-runs.
    const stakesSnap = await tx.get(stakesQuery(db, groupId));
    const live = [];
    const prior = [];
    const decided = [];
    const malformed = [];
    stakesSnap.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      if (data.status === STAKE_STATUS.LIVE) live.push(data);
      else if (data.status === STAKE_STATUS.VOIDED && data.voidReason === voidReason) prior.push(data);
      else if (data.status === STAKE_STATUS.WON || data.status === STAKE_STATUS.LOST) decided.push(data);
    });
    for (const s of [...live, ...prior]) if (!isValidStakeAmount(s.amount)) malformed.push(s);
    if (decided.length > 0) {
      console.error(`[backingSettlement] refund REFUSED for ${groupId}: ${decided.length} decided stake(s) inside a ${pool.status} pool (${decided.map((s) => s.id).join(', ')}) — repair the book, then re-run`);
      return { refunded: false, reason: REFUND_REASON.CORRUPT_BOOK, stakeIds: decided.map((s) => s.id), status: pool.status, pool };
    }
    if (malformed.length > 0) {
      console.error(`[backingSettlement] refund REFUSED for ${groupId}: malformed stake amount on ${malformed.map((s) => s.id).join(', ')}`);
      return { refunded: false, reason: REFUND_REASON.MALFORMED_STAKE, stakeIds: malformed.map((s) => s.id), status: pool.status, pool };
    }

    // (4) THE CEILING (H3), inside the transaction, structural.
    const projected = 1 + live.length * REFUND_WRITES_PER_STAKE + prior.length * (REFUND_WRITES_PER_STAKE - 1);
    if (live.length > SETTLEMENT_MAX_STAKES || projected > SETTLEMENT_MAX_WRITES) {
      if (pool.status === POOL_STATUS.CLOSED) {
        const held = {
          ...pool, status: POOL_STATUS.RESOLVING, holdReason: HOLD_REASON.STAKE_CEILING,
          heldAt: nowIso, holdSource: source, liveStakesAtHold: live.length, updatedAt: nowIso,
        };
        tx.set(poolRef, held);
        console.error(`${LOG_PREFIX} HOLD: refund of ${poolRef.path} held in resolving — holdReason=${HOLD_REASON.STAKE_CEILING} (live stakes ${live.length}, source ${source}).`);
        return { refunded: false, reason: REFUND_REASON.STAKE_CEILING, holdReason: HOLD_REASON.STAKE_CEILING, pool: held };
      }
      return { refunded: false, reason: REFUND_REASON.STAKE_CEILING, holdReason: pool.holdReason ?? HOLD_REASON.STAKE_CEILING, pool };
    }

    // (5) THE WALLETS — the LAST reads, keyed by path (the PR 1 threading contract).
    const dev = pool.isDev === true;
    const work = [...live.map((stake) => ({ stake, decide: true })), ...prior.map((stake) => ({ stake, decide: false }))];
    const walletDocs = new Map();
    for (const { stake } of work) {
      const ref = walletRef(db, stake.userId, { dev });
      if (walletDocs.has(ref.path)) continue;
      const walletDoc = await readWallet(tx, ref);
      if (walletDoc == null) {
        throw new BackingSettlementError('wallet_missing', `refund: wallet ${ref.path} is missing for stake ${stake.id} — refusing to mint a record from nothing`);
      }
      walletDocs.set(ref.path, walletDoc);
    }

    // ----- WRITES -----
    // The ladder's own month when the pod banked a day (a voided in-week pod
    // may have); the pool's battle-Monday month otherwise (`closePool`'s rule
    // for a pod that never battled). Both halves of each pair carry the SAME
    // key, which is what makes the pair cancel in the season bucket.
    const monthKey = (group ? monthKeyForGroup(group) : null) ?? monthKeyForPool(pool);
    let stakesVoided = 0;
    for (const { stake, decide } of work) {
      const { id: stakeId, ...stakeFields } = stake;
      if (decide) {
        tx.set(stakeRefFor(db, stakeId), { ...stakeFields, status: STAKE_STATUS.VOIDED, voidReason, voidedAt: nowIso });
        stakesVoided += 1;
      }
      const wRef = walletRef(db, stake.userId, { dev });
      // THE PAIR, exactly as `closePool` pairs it: the refund credit, then the
      // stake side's month attribution threaded from the credit's returned
      // wallet — score-neutral in `careerNet` AND `seasons.{monthKey}.net`.
      const refunded = creditRefund(tx, wRef, walletDocs.get(wRef.path), {
        stakeId, groupId, amount: stake.amount, monthKey, now: nowDate,
      });
      const attributed = recordStakeLoss(tx, wRef, refunded.wallet, {
        stakeId, groupId, amount: stake.amount, monthKey, now: nowDate,
      });
      walletDocs.set(wRef.path, attributed.wallet);
    }

    // (6) THE POOL: `refunded`, the reason, the instant, the host, the month.
    const refundedPool = {
      ...pool,
      status: POOL_STATUS.REFUNDED,
      refundReason: voidReason,
      refundedAt: nowIso,
      refundRef: source,
      monthKey,
      stakesVoided: stakesVoided + prior.length,
      updatedAt: nowIso,
    };
    if (releasing) {
      // WHO, WHEN and WHAT WAS HELD are recorded; the operator's free-text WHY
      // is in the log line only (the pool document is authed-read).
      refundedPool.holdRelease = { by: actor ?? 'admin', at: nowIso, priorHoldReason: pool.holdReason ?? null };
      delete refundedPool.holdReason;
      delete refundedPool.heldAt;
      delete refundedPool.holdSource;
      delete refundedPool.holdReleaseRefused;
    }
    tx.set(poolRef, refundedPool);

    const line = `${LOG_PREFIX} REFUNDED ${poolRef.path}: ${stakesVoided} stakes voided ${voidReason} this pass (${prior.length} prior), source ${source}${releasing ? `, released from hold ${pool.holdReason ?? 'none'} by ${actor ?? 'admin'}` : ''}${voidReason === VOID_REASONS.ADMIN ? ` — admin reason: ${note ?? 'none given'}` : ''}`;
    if (voidReason === VOID_REASONS.ADMIN || releasing) console.error(line); else console.log(line);
    return { refunded: true, pool: refundedPool, refundReason: voidReason, stakesVoided, priorVoided: prior.length };
  });
}
