// api/_utils/tournamentClaims.js
//
// Tournament sibling of the legacy claims resolution (P1b). The queue /
// rotation algorithm is the legacy one verbatim (api/cron/
// process-draft-claims.js processClaimsForDraft :286-508 — priority order,
// front-retry on denial, back-rotation on approval, pending×2 safety bound);
// the sibling differences are exactly the tournament shape:
// - categories do not exist; the pool is the flat group.userPool;
// - roster entries are pick STATES — a won name becomes a fresh
//   createPickState (long, null baseline, BASELINE_SOURCE.CLAIM_EXECUTION,
//   settled at the next banking pass); the dropped symbol returns to the pool;
// - waiver fallback orders by dailyScores (cumulative snapshots), NEVER the
//   legacy dailyData (the naming hazard — locked by the co-located test);
// - the day clock is derived from the banking record
//   (deriveCurrentTradingDay) — groups carry no battleStartDate — and feeds
//   the legacy isAlreadyProcessedForDay guard IMPORTED AS-IS.
//
// RESOLUTION IS TRANSACTIONAL (founder adjustment at the P1b go): the group
// and the pending claims are re-read fresh inside the transaction and every
// write commits with them — a concurrent flip or banking write cannot
// interleave with resolution. The awaited transaction is rider #5 "resolved"
// (Addendum A §4 row 5): won/lost per claim plus the waiver-order snapshot
// in the processing-log entry.

import {
  TOURNAMENT_GROUPS_COLLECTION,
  GROUP_STATUS,
  GROUP_SIZE,
  GROUP_FEED_CAP,
  BASELINE_SOURCE,
  LEG_DIRECTION,
  createPickState,
  getLatestDayEntry,
  deriveCurrentTradingDay,
} from '../../src/constants/leagueTournament.js';
// Imported as-is per the approved design — DST behavior inherited. The
// module cycle with the cron (which imports this module's processor) is
// benign: both sides export hoisted function declarations only.
import { isAlreadyProcessedForDay } from '../cron/process-draft-claims.js';
import { formatEtDate } from './tournamentTime.js';
import {
  ledgerRef,
  detectUserDoubleDownEvents,
  buildUserDoubleDownWrites,
  readOwnerAgentMap,
} from './tournamentAgentLedger.js';

/**
 * Waiver priority — sibling of the legacy calculateWaiverPriority
 * (process-draft-claims.js:221-264): stored claimSystem.currentWaiverPriority
 * when present; else ASCENDING by the latest dailyScores cumulative snapshot
 * (lowest standing claims first — founder ruling #3); else reverse draft
 * order. Reads dailyScores — the tournament name — never dailyData.
 */
export function calculateTournamentWaiverPriority(group) {
  const players = group?.players || [];
  if (players.length === 0) return [];

  if (group.claimSystem?.currentWaiverPriority?.length > 0) {
    return [...group.claimSystem.currentWaiverPriority];
  }

  const latest = getLatestDayEntry(group);
  if (!latest) {
    const order = group.groupMembers?.length > 0 ? group.groupMembers : players.map(p => p.odUserId);
    return [...order].reverse();
  }

  const closeScores = latest.entry.closeScores || {};
  return players
    .map(p => ({ odUserId: p.odUserId, points: closeScores[p.odUserId]?.totalPoints || 0 }))
    .sort((a, b) => a.points - b.points)
    .map(p => p.odUserId);
}

/**
 * Eligibility query + in-code mirror checks for the cron branch (legacy
 * mirror: process-draft-claims.js:556-567 — status query, then
 * claimSystem.enabled and exact player count in code).
 */
export async function fetchEligibleTournamentGroups(db) {
  const snapshot = await db.collection(TOURNAMENT_GROUPS_COLLECTION)
    .where('status', '==', GROUP_STATUS.BATTLE)
    .get();
  const groups = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.claimSystem?.enabled && data.players?.length === GROUP_SIZE) {
      groups.push({ id: doc.id, ...data });
    }
  });
  return groups;
}

/**
 * Resolve one group's pending claims. Statuses mirror the legacy return
 * vocabulary: 'already_processed' | 'no_claims' | 'processed' | 'skipped'.
 *
 * @param {Object} db - Firestore admin instance
 * @param {{id: string}} group - group with id (data may be stale; the
 *   transaction re-reads)
 * @param {{ now?: Date }} [opts] - injectable clock
 */
export async function processClaimsForTournamentGroup(db, group, { now = new Date() } = {}) {
  const groupId = group.id;
  const etDate = formatEtDate(now);
  const nowIso = now.toISOString();
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  const claimsRef = groupRef.collection('claims');
  const pendingQuery = claimsRef.where('status', '==', 'pending');

  // D-1 (user-side double-down): the odUserId→agentId map from the immutable
  // agent-draft stream — the shared pre-transaction read (degrades to {} on
  // failure; claims resolution never blocks on it).
  const ownerAgentMap = await readOwnerAgentMap(db, groupId);

  return db.runTransaction(async (tx) => {
    const groupSnap = await tx.get(groupRef);
    if (!groupSnap.exists) return { status: 'skipped', reason: 'group_not_found', processed: 0 };
    const fresh = groupSnap.data();
    if (fresh.status !== GROUP_STATUS.BATTLE) {
      return { status: 'skipped', reason: 'not_battle', processed: 0 };
    }
    // The cron's eligibility mirror checks this pre-query, but the manual
    // trigger and the in-tx re-read must honor the pause switch too.
    if (!fresh.claimSystem?.enabled) {
      return { status: 'skipped', reason: 'claims_disabled', processed: 0 };
    }

    const currentDay = deriveCurrentTradingDay(fresh, etDate);
    if (isAlreadyProcessedForDay(fresh.claimSystem, currentDay)) {
      return { status: 'already_processed', day: currentDay, processed: 0 };
    }

    const pendingSnap = await tx.get(pendingQuery);
    if (pendingSnap.empty) return { status: 'no_claims', processed: 0 };

    // D-1: read the ledger (held set) for double-down detection — BEFORE any
    // write (Firestore reads-before-writes). The doubleDowns sibling + the
    // group-feed double_down entries land atomically with the resolution.
    const lRef = ledgerRef(db, groupId);
    const ledgerSnap = await tx.get(lRef);
    const ledger = ledgerSnap.exists ? ledgerSnap.data() : null;

    // Group by user, rank-ascending per user (legacy :312-325).
    const claimsByUser = {};
    pendingSnap.forEach(doc => {
      const claim = { id: doc.id, ...doc.data() };
      (claimsByUser[claim.odUserId] ||= []).push(claim);
    });
    let pendingCount = 0;
    for (const userId of Object.keys(claimsByUser)) {
      claimsByUser[userId].sort((a, b) => a.rank - b.rank);
      pendingCount += claimsByUser[userId].length;
    }

    // Queue from waiver priority; claim-holders not in the priority list
    // append at the end (legacy :327-345).
    const waiverPriority = calculateTournamentWaiverPriority(fresh);
    const queue = [];
    const usersWithClaims = new Set(Object.keys(claimsByUser));
    for (const userId of waiverPriority) {
      if (usersWithClaims.has(userId)) {
        queue.push(userId);
        usersWithClaims.delete(userId);
      }
    }
    for (const userId of usersWithClaims) queue.push(userId);

    const players = JSON.parse(JSON.stringify(fresh.players || []));
    const userPool = [...(fresh.userPool || [])];
    const results = [];
    const userClaimIndex = {};
    for (const userId of Object.keys(claimsByUser)) userClaimIndex[userId] = 0;

    const maxIterations = pendingCount * 2; // legacy safety bound (:360)
    let iterations = 0;

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const userId = queue.shift();
      const userClaims = claimsByUser[userId];
      const claimIdx = userClaimIndex[userId];
      if (claimIdx >= userClaims.length) continue;

      const claim = userClaims[claimIdx];
      const player = players.find(p => p.odUserId === userId);

      if (!player) {
        results.push({
          odUserId: userId, claimId: claim.id, dropSymbol: claim.dropSymbol,
          addSymbol: claim.addSymbol, status: 'denied', reason: 'player_not_found',
        });
        userClaimIndex[userId] = userClaims.length;
        continue;
      }

      const dropIdx = (player.picks || []).findIndex(p => p.symbol === claim.dropSymbol);
      if (dropIdx === -1) {
        results.push({
          odUserId: userId, claimId: claim.id, dropSymbol: claim.dropSymbol,
          addSymbol: claim.addSymbol, status: 'denied', reason: 'drop_not_on_roster',
        });
        userClaimIndex[userId] = claimIdx + 1;
        queue.unshift(userId); // front-retry with the next-ranked claim
        continue;
      }

      if (!userPool.includes(claim.addSymbol)) {
        results.push({
          odUserId: userId, claimId: claim.id, dropSymbol: claim.dropSymbol,
          addSymbol: claim.addSymbol, status: 'denied', reason: 'claimed_by_higher_priority',
        });
        userClaimIndex[userId] = claimIdx + 1;
        queue.unshift(userId); // front-retry with the next-ranked claim
        continue;
      }

      // APPROVE — the dropped pick's realized value is PRESERVED (cumulative
      // model, founder ruling #1: banked closed-leg scores are part of the
      // standing). Its live leg closes bank-pending here — the next banking
      // pass banks it at the session open, the natural price of a pre-open
      // exit — and the whole pick moves to player.droppedPicks, which the
      // banking pass keeps scoring. Discarding it would erase banked points
      // (or launder banked losses) from already-standing totals.
      const droppedPick = player.picks[dropIdx];
      const droppedLive = droppedPick.legs?.[droppedPick.legs.length - 1];
      if (droppedLive && droppedLive.closedAt === undefined) {
        droppedLive.closedAt = nowIso;
      }
      player.droppedPicks = [...(player.droppedPicks || []), droppedPick];

      // The won name becomes a fresh pick state: long, null baseline,
      // claim_execution; settled at the next banking pass.
      player.picks[dropIdx] = createPickState({
        symbol: claim.addSymbol,
        baselinePrice: null,
        baselineSource: BASELINE_SOURCE.CLAIM_EXECUTION,
        openedAt: nowIso,
      });
      userPool.splice(userPool.indexOf(claim.addSymbol), 1);
      userPool.push(claim.dropSymbol);

      results.push({
        odUserId: userId, claimId: claim.id, dropSymbol: claim.dropSymbol,
        addSymbol: claim.addSymbol, status: 'approved', reason: null,
        // D-1: the dropped live leg's direction, for the 'broken' event's
        // userDirection (captured before `players` is further mutated).
        dropDirection: droppedLive?.direction || null,
      });
      userClaimIndex[userId] = claimIdx + 1;
      if (claimIdx + 1 < userClaims.length) queue.push(userId); // back-rotation
    }

    // D-1: the user-side double-downs the approvals formed/broke against each
    // user's OWN agent holdings — collected across all approvals, recorded
    // once (the ledger doubleDowns sibling + group-feed entries). The detector
    // owns the cross-market guard (own-agent-only); pre-draft / no-alignment
    // writes NOTHING to the ledger (contention stays near zero).
    const ddEvents = [];
    if (ledger) {
      for (const r of results) {
        if (r.status !== 'approved') continue;
        const ownAgentId = ownerAgentMap[r.odUserId];
        if (!ownAgentId) continue;
        ddEvents.push(...detectUserDoubleDownEvents({
          ownAgentId,
          held: ledger.held,
          odUserId: r.odUserId,
          candidates: [
            { symbol: r.addSymbol, kind: 'formed', userDirection: LEG_DIRECTION.LONG },
            { symbol: r.dropSymbol, kind: 'broken', userDirection: r.dropDirection },
          ],
          now: nowIso,
        }));
      }
    }
    // The shared recorder builds the capped ledger list + the feed entries.
    const { doubleDowns, feedEvents: ddFeedEvents } = ddEvents.length > 0
      ? buildUserDoubleDownWrites(ledger, ddEvents, nowIso)
      : { doubleDowns: null, feedEvents: [] };
    if (ddEvents.length > 0) {
      tx.set(lRef, { ...ledger, doubleDowns, updatedAt: nowIso });
    }

    // RIDER #5 "resolved" — every write in the same awaited transaction:
    // claim outcomes, roster/pool mutation, idempotency mark, and the
    // processing-log entry carrying the waiver-order snapshot.
    for (const result of results) {
      tx.update(claimsRef.doc(result.claimId), {
        status: result.status,
        denialReason: result.reason || null,
        processedAt: nowIso,
      });
    }
    const logEntry = {
      day: currentDay,
      processedAt: nowIso,
      waiverPriority,
      results: results.map(r => ({
        odUserId: r.odUserId, dropSymbol: r.dropSymbol, addSymbol: r.addSymbol,
        status: r.status, reason: r.reason,
      })),
    };
    tx.update(groupRef, {
      players,
      userPool,
      'claimSystem.lastProcessedDay': currentDay,
      'claimSystem.processingLog': [...(fresh.claimSystem?.processingLog || []), logEntry],
      ...(ddFeedEvents.length > 0
        ? { feed: [...(fresh.feed || []), ...ddFeedEvents].slice(-GROUP_FEED_CAP) }
        : {}),
      updatedAt: nowIso,
    });

    const approved = results.filter(r => r.status === 'approved').length;
    return {
      status: 'processed',
      day: currentDay,
      total: results.length,
      approved,
      denied: results.length - approved,
    };
  });
}
