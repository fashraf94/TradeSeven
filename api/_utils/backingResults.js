// api/_utils/backingResults.js
//
// Backing Beta PR 5 — THE RESULTS PROJECTION, pure (spec V1.3 §5 "Results
// card", §3 the reveal and the exact-fact labels, §4 the loadout-changed
// marker, §7 the refund paths, §9 honesty; design brief §E "who won, what you
// backed, what you got, and — now visible for the first time — how many
// people backed each team, what share of the pot each team held, and the
// multiple each paid; a changed loadout is marked").
//
// EVERY NUMBER ON THE CARD IS THE POOL DOCUMENT'S OR THE STAKE DOCUMENT'S,
// never re-derived (BUILD_RULES §9):
//   · the payout per stake is `stake.payout`, written by settlement — NEVER
//     `stake × paysX` (a 2-dp ratio × a stake disagrees with the floor-rounded
//     payout by design; backingSettlement.js says so at the pool write);
//   · pays × per team is `teams[].paysX` — §3's own table, written at
//     settlement, `null` for an unbacked team and `null` before settlement;
//   · each team's share is `teams[].stakeTotal ÷ potTotal`, the two figures the
//     close revealed together, labeled exactly as §3 labels it ("X% of BP in
//     this pool backed them" — never a crowd probability);
//   · backers per team is `teams[].backerCount`, the close's own count.
// The loadout marker compares the backer's OWN `hashAtStake` with the team's
// `hashAtSettlement`; either missing (or a CPU seat, whose hash is shared) →
// `null`, "not known", never "unchanged".
//
// A REFUNDED OR INSUFFICIENT POOL IS STATED PLAINLY WITH ITS REASON (§7): the
// outcome word and `refundReason` (`group_voided` | `group_expired` |
// `group_deleted` | `admin`) or the validity floor; the viewer's voided stakes
// carry their `voidReason`. A closed or held pool that has not settled is
// "settling" — a fact, never a guess at the result.
//
// EVERY TEAM IS NAMED BY THE SERVER (Amendment C §C1, D-af): each team row
// carries `label` (its primary agent's name — after settlement, the agent
// settlement recorded) and `secondary` (the player's display name), each of
// the viewer's stakes its team's `teamLabel`, and the winner line its
// `winnerLabels`, in the winning set's order. The names come from the caller's
// `nameTeam` — the results reader binds it to ONE batched call of the one
// resolver (api/_utils/backingTeamLabels.js) per response — so this module
// stays pure and reads nothing. The pod's `seatNames` map is no longer sent:
// a lobby pod carries none, which is how the winner line used to print a raw
// account id (the PR 5 review record's HON-17).
//
// Imports the pool module under the revised June 2026 import rule (BUILD_RULES
// §4); the co-located test's real import is the dependency-surface guard.

import { POOL_STATUS, STAKE_STATUS, monthKeyForPool } from './backingPools.js';
import { UNNAMED_TEAM_LABEL } from '../../src/constants/backing.js';

/** A projection handed no naming function names every team neutrally — never by its id. */
const NEUTRAL_NAME = () => ({ label: UNNAMED_TEAM_LABEL, secondary: null });

/** The card's outcome words — derived from the pool's status, one mapping. */
export const RESULT_OUTCOME = Object.freeze({
  SETTLED: 'settled',
  REFUNDED: 'refunded',
  INSUFFICIENT: 'insufficient',
  SETTLING: 'settling',
  OPEN: 'open',
});

/** Pool statuses with nothing left to decide — the ones a "completed week" is made of. */
export const TERMINAL_RESULT_STATUSES = new Set([POOL_STATUS.RESOLVED, POOL_STATUS.REFUNDED, POOL_STATUS.INSUFFICIENT]);

/** The outcome word for a pool document, or null for a status this module does not know. */
export function outcomeOf(pool) {
  switch (pool?.status) {
    case POOL_STATUS.RESOLVED: return RESULT_OUTCOME.SETTLED;
    case POOL_STATUS.REFUNDED: return RESULT_OUTCOME.REFUNDED;
    case POOL_STATUS.INSUFFICIENT: return RESULT_OUTCOME.INSUFFICIENT;
    case POOL_STATUS.CLOSED:
    case POOL_STATUS.RESOLVING: return RESULT_OUTCOME.SETTLING;
    case POOL_STATUS.OPEN: return RESULT_OUTCOME.OPEN;
    default: return null;
  }
}

/**
 * The ladder month a pool's record attributes to: the key settlement (or the
 * refund) stamped when it ran — the SAME key the wallet's season bucket
 * carries — else the pool's battle-Monday month (`monthKeyForPool`, the
 * close's own rule for a pod that never banked). Null only for a malformed
 * pool; never a guess from the clock.
 */
export function monthKeyOfPool(pool) {
  if (typeof pool?.monthKey === 'string' && pool.monthKey.length > 0) return pool.monthKey;
  try { return monthKeyForPool(pool); } catch { return null; }
}

/** `stakeTotal` as a whole-number percentage of `pot` — §3's "62% of BP in this pool". Null when there is no pot. */
export function sharePctOf(stakeTotal, pot) {
  if (!Number.isFinite(pot) || pot <= 0) return null;
  const total = Number.isFinite(stakeTotal) && stakeTotal > 0 ? stakeTotal : 0;
  return Math.round((total / pot) * 100);
}

/**
 * The §4 loadout-changed marker for ONE of the viewer's stakes: true when the
 * hash recorded at the stake differs from the hash recorded at settlement,
 * false when they match, null when either is unknown or the seat is a CPU
 * (all CPUs share one hash — §1 suppresses the marker for them).
 *
 * A TOPPED-UP STAKE (D-ag — more than one debit) carries only its FIRST
 * placement's hash, so a match proves nothing about the BP added later: the
 * loadout may have moved and moved back in between (the review record's
 * MONEY-8). It is never answered "unchanged" — a difference is still a
 * change ("during the week" stays true), a match is not known.
 */
export function loadoutChangedFor(stake, team) {
  if (!team || team.isCpu === true) return null;
  const atStake = stake?.hashAtStake;
  const atSettlement = team?.hashAtSettlement;
  if (typeof atStake !== 'string' || atStake.length === 0) return null;
  if (typeof atSettlement !== 'string' || atSettlement.length === 0) return null;
  if (atStake !== atSettlement) return true;
  return Array.isArray(stake?.debits) && stake.debits.length > 1 ? null : false;
}

/** The record delta of ONE stake once decided: won → payout − amount, lost → −amount, voided → 0 (neutral), live → null (undecided). */
export function stakeNetOf(stake) {
  switch (stake?.status) {
    case STAKE_STATUS.WON: return (Number.isFinite(stake.payout) ? stake.payout : 0) - (Number.isFinite(stake.amount) ? stake.amount : 0);
    case STAKE_STATUS.LOST: return -(Number.isFinite(stake.amount) ? stake.amount : 0);
    case STAKE_STATUS.VOIDED: return 0;
    default: return null;
  }
}

/**
 * ONE pod's result, as the card renders it. Pure over the pool document, the
 * group document (the pod's own status — a deleted pod has none), the
 * viewer's own stakes on the pod, and `nameTeam(odUserId)` → `{ label,
 * secondary }`, the caller's binding of the one label resolver.
 */
export function projectResultPool({ groupId, poolId = null, pool, group = null, myStakes = [], nameTeam = NEUTRAL_NAME }) {
  const outcome = outcomeOf(pool);
  const settled = outcome === RESULT_OUTCOME.SETTLED;
  const revealed = pool != null && pool.status !== POOL_STATUS.OPEN;
  const pot = Number.isFinite(pool?.potTotal) ? pool.potTotal : null;
  const winners = Array.isArray(pool?.winnerOdUserIds) ? pool.winnerOdUserIds : [];
  const frozen = Array.isArray(pool?.teams) ? pool.teams : [];
  const byTeam = new Map(frozen.map((t) => [t.odUserId, t]));

  const teams = frozen.map((t) => ({
    odUserId: t.odUserId,
    isCpu: t.isCpu === true,
    ...nameTeam(t.odUserId),
    backerCount: revealed && Number.isFinite(t.backerCount) ? t.backerCount : null,
    stakeTotal: revealed && Number.isFinite(t.stakeTotal) ? t.stakeTotal : null,
    sharePct: revealed ? sharePctOf(t.stakeTotal, pot) : null,
    // §3's own table, written at settlement; null before it and for an unbacked team.
    paysX: settled && Number.isFinite(t.paysX) ? t.paysX : null,
    won: settled ? winners.includes(t.odUserId) : null,
  }));

  const stakes = (Array.isArray(myStakes) ? myStakes : []).map((s) => ({
    stakeId: s.id ?? s.stakeId ?? null,
    teamOdUserId: s.teamOdUserId,
    teamLabel: nameTeam(s.teamOdUserId).label,
    amount: Number.isFinite(s.amount) ? s.amount : 0,
    status: s.status,
    // THE PAYOUT IS THE STAKE DOCUMENT'S — never stake × paysX (§3, §9).
    payout: s.status === STAKE_STATUS.WON ? (Number.isFinite(s.payout) ? s.payout : 0) : s.status === STAKE_STATUS.LOST ? 0 : null,
    voidReason: s.status === STAKE_STATUS.VOIDED ? (s.voidReason ?? null) : null,
    net: stakeNetOf(s),
    loadoutChanged: loadoutChangedFor(s, byTeam.get(s.teamOdUserId)),
  }));
  const decided = stakes.filter((s) => s.status === STAKE_STATUS.WON || s.status === STAKE_STATUS.LOST);

  return {
    groupId,
    poolId,
    weekKey: (Array.isArray(myStakes) && myStakes.find((s) => typeof s?.weekKey === 'string')?.weekKey) ?? pool?.baseLayerWeek ?? null,
    status: pool?.status ?? null,
    // The pod's OWN status (null for a deleted pod), so a card for a closed
    // pool can say whether the pod is still playing or done and waiting
    // (HON-3, the PR 5 review record) — never "complete" for a pod in battle.
    podStatus: typeof group?.status === 'string' ? group.status : null,
    outcome,
    formationPath: pool?.formationPath ?? null,
    slotId: pool?.slotId ?? null,
    humanTeams: Number.isFinite(pool?.humanTeams) ? pool.humanTeams : null,
    potTotal: revealed ? pot : null,
    uniqueBackers: revealed && Number.isFinite(pool?.uniqueBackers) ? pool.uniqueBackers : null,
    winners: settled ? winners : [],
    // The WINNER LINE's names, in the winning set's order — the server's, so
    // the card never maps an id to a name (D-af).
    winnerLabels: settled ? winners.map((id) => nameTeam(id).label) : [],
    winningStakes: settled && Number.isFinite(pool?.winningStakes) ? pool.winningStakes : null,
    paysX: settled && Number.isFinite(pool?.paysX) ? pool.paysX : null,
    closedAt: pool?.closedAt ?? null,
    settledAt: settled ? (pool?.settledAt ?? null) : null,
    refundedAt: outcome === RESULT_OUTCOME.REFUNDED ? (pool?.refundedAt ?? null) : null,
    refundReason: outcome === RESULT_OUTCOME.REFUNDED ? (pool?.refundReason ?? null) : null,
    holdReason: pool?.status === POOL_STATUS.RESOLVING ? (pool?.holdReason ?? null) : null,
    monthKey: pool ? monthKeyOfPool(pool) : null,
    teams,
    myStakes: stakes,
    // The viewer's decided record on this pod: Σ payouts − Σ decided stakes; null until something is decided.
    myNet: decided.length > 0 ? decided.reduce((sum, s) => sum + s.net, 0) : null,
    myWon: settled ? stakes.some((s) => s.status === STAKE_STATUS.WON) : null,
  };
}

/**
 * The viewer's stakes grouped into weeks, NEWEST first, each with its distinct
 * pods. `weekKey` is `YYYY-Www` (zero-padded), so lexical order is
 * chronological. Pure.
 *
 * @returns {{weekKey: string, groupIds: string[]}[]}
 */
export function weeksOf(stakes) {
  const byWeek = new Map();
  for (const s of Array.isArray(stakes) ? stakes : []) {
    if (typeof s?.weekKey !== 'string' || typeof s?.groupId !== 'string') continue;
    const set = byWeek.get(s.weekKey) ?? new Set();
    set.add(s.groupId);
    byWeek.set(s.weekKey, set);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([weekKey, ids]) => ({ weekKey, groupIds: [...ids].sort() }));
}
