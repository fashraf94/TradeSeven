// api/_utils/tournamentBanking.js
//
// Daily banking for the League Tournament user layer (P1b) — the ONLY writer
// of tournamentGroups dailyScores (ratified keying + scoring model:
// src/constants/leagueTournament.js dailyScores comment). P6a extends each
// snapshot with the agent-layer cumulative and the COMPOSITE of record
// (ruling A-1) — same single-writer rule, same transaction.
//
// CUMULATIVE SNAPSHOT MODEL (founder ruling #1, PR #484):
// dailyScores.day{N}.closeScores[odUserId].totalPoints is the player's
// cumulative standing at that close — banked closed-leg scores plus live
// legs scored from their leg baselines. The weekly score is the FINAL day's
// snapshot (getWeeklyScore), never a sum over days.
//
// Settlement (each pass, before scoring): legs with a null baselinePrice
// (sources draft_resolution / claim_execution / flip_market_closed) settle at
// today's open; closed legs still missing bankedScore (market-closed flips)
// bank at today's open. A missing quote leaves a leg unsettled for the next
// pass — banking degrades, never aborts a group.
//
// Idempotent per ET trading day: each day entry carries recordedDate (ET
// 'YYYY-MM-DD'); a pass that finds today's date already recorded skips. Day
// indexing is derived (max existing day + 1) — groups carry no
// battleStartDate. Safe to re-invoke any number of times (the manual
// endpoint is re-run on preview).
//
// Waiver priority (founder ruling #3): ascending cumulative standing —
// lowest claims first — in the legacy writer's exact shape
// (api/cron/snake-draft-daily-scores.js:299-311, flat odUserId array).

import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_GAME_MODE,
  GROUP_STATUS,
  GROUP_SIZE,
  getLatestDayEntry,
  computeComposite,
} from '../../src/constants/leagueTournament.js';
import { scoreLeg, scorePick, resolveBaseATR, loadAtrPercentiles } from './tournamentUserScoring.js';
import { fetchBatchQuotes } from './tournamentPrices.js';
import { formatEtDate } from './tournamentTime.js';
import { isCryptoSymbol } from './marketDataCache.js';

const DAY_KEY_RE = /^day\d+$/;

/**
 * P6a — the group's cumulative agent-layer points per owner: one equality
 * query over agentBattles (auto-indexed), summing scoreState.currentScore
 * across ALL the group's tournament battles regardless of status. A fresh
 * group per round means every battle stamped with this groupId belongs to
 * this week; completion never recomputes the score, so reading active and
 * completed docs alike is exact post-close (P6 Stage 0 §3.1). Recomputed
 * every pass — a late completion self-heals on the next snapshot.
 */
export async function fetchGroupAgentScores(db, groupId) {
  const snap = await db.collection('agentBattles')
    .where('groupId', '==', groupId)
    .get();
  const byOwner = {};
  let battles = 0;
  snap.forEach(doc => {
    const battle = doc.data();
    // Joint-stamp safety (founder ruling B3): a groupId without the
    // tournament gameMode is malformed — never counted.
    if (battle.gameMode !== TOURNAMENT_GAME_MODE) return;
    if (typeof battle.ownerId !== 'string' || battle.ownerId.length === 0) return;
    battles++;
    byOwner[battle.ownerId] = (byOwner[battle.ownerId] || 0) + (battle.scoreState?.currentScore || 0);
  });
  return { byOwner, battles };
}

/**
 * Pure banking computation — no I/O, no clock reads; inputs in, update out.
 *
 * P6a (ruling A-1): each closeScores entry additionally carries the
 * agent-layer cumulative (`agentPoints`) and the composite of record
 * (`compositePoints` = agentPoints + k × totalPoints, via the one
 * computeComposite home). `agentScores` is the fetchGroupAgentScores
 * byOwner map; `null` means the battle read FAILED — the prior snapshot's
 * agentPoints carry forward (a cumulative standing must never regress to
 * zero on a read failure; tomorrow's pass self-heals), loudly warned. An
 * empty map is a real zero (no battles yet — pre-deploy groups).
 *
 * Waiver priority stays USER-LAYER (ruling A-2): the claim wire is a
 * user-market mechanism; composite would let a hot agent buy its human
 * waiver position.
 *
 * @param {Object} group - the tournamentGroups doc data
 * @param {Object} quotes - fetchBatchQuotes result, keyed by symbol
 * @param {Object} opts
 * @param {string} opts.nowIso - timestamp for recordedAt / thresholdHistory
 * @param {string} opts.etDate - today's ET date 'YYYY-MM-DD' (idempotency key)
 * @param {Object|null} [opts.atrPercentiles] - loadAtrPercentiles result
 * @param {string} opts.recordedBy - 'cron' | 'manual'
 * @param {Object|null} [opts.agentScores] - fetchGroupAgentScores().byOwner
 * @returns {{skipped: true, reason: string, dayKey?: string} | {skipped: false,
 *   dayKey: string, dayN: number, dayEntry: Object, players: Array,
 *   waiverPriority: string[], warnings: string[]}}
 */
export function computeBankingUpdate(group, quotes, { nowIso, etDate, atrPercentiles = null, recordedBy, agentScores = null }) {
  const dailyScores = group?.dailyScores || {};
  for (const key of Object.keys(dailyScores)) {
    if (DAY_KEY_RE.test(key) && dailyScores[key]?.recordedDate === etDate) {
      return { skipped: true, reason: 'already_recorded', dayKey: key };
    }
  }

  const latest = getLatestDayEntry(group);
  const dayN = (latest?.dayN || 0) + 1;
  const dayKey = `day${dayN}`;
  const warnings = [];

  // P6a carry-forward arm: agentScores === null means the battle read failed
  // this pass — the prior snapshot's agentPoints stand in (see the doc
  // comment above). Visible, never silent.
  const priorCloseScores = latest?.entry?.closeScores || null;
  if (agentScores === null) {
    warnings.push('agent scores unavailable — prior snapshot agentPoints carried forward');
  }

  // Deep-copy players: settlement mutates legs (baselines, banked scores,
  // threshold history) and the whole array is rewritten (Firestore cannot
  // dot-path into arrays).
  const copyPicks = (picks) => (picks || []).map(pick => ({
    ...pick,
    legs: (pick.legs || []).map(leg => ({ ...leg })),
  }));
  const players = (group.players || []).map(p => ({
    ...p,
    picks: copyPicks(p.picks),
    ...(p.droppedPicks ? { droppedPicks: copyPicks(p.droppedPicks) } : {}),
  }));

  const closeScores = {};
  for (const player of players) {
    let playerTotal = 0;
    const pickEntries = [];

    // Dropped picks (claim execution) keep counting: their banked legs are
    // part of the cumulative standing (ruling #1) and their bank-pending
    // final leg settles here like any other. They carry no live leg.
    const scorablePicks = [
      ...player.picks.map(pick => ({ pick, dropped: false })),
      ...(player.droppedPicks || []).map(pick => ({ pick, dropped: true })),
    ];

    for (const { pick, dropped } of scorablePicks) {
      const quote = quotes?.[pick.symbol];
      const open = Number.isFinite(quote?.open) && quote.open > 0 ? quote.open : null;
      const baseATR = resolveBaseATR(pick.symbol, atrPercentiles)
        ?? (isCryptoSymbol(pick.symbol) ? 5.0 : 2.5); // port-contract fallback arms

      // --- Settlement pass ---
      for (const leg of pick.legs) {
        if (leg.baselinePrice == null) {
          if (open != null) {
            leg.baselinePrice = open;
          } else {
            warnings.push(`${pick.symbol}: no open price — baseline unsettled`);
          }
        }
        if (leg.closedAt !== undefined && leg.bankedScore === undefined) {
          // Market-closed flip: the close-out price is the next session's
          // open. An overnight open-and-closed leg banks 0 by construction
          // (baseline just settled to the same open — zero exposure).
          if (leg.baselinePrice != null && open != null) {
            const result = scoreLeg({ symbol: pick.symbol, baseATR, leg, price: open });
            if (result) leg.bankedScore = result.totalPoints;
          } else {
            warnings.push(`${pick.symbol}: no open price — closed leg still bank-pending`);
          }
        }
      }

      // --- Cumulative scoring pass ---
      const scored = scorePick({ pick, baseATR, quote });
      const liveLeg = pick.legs.length > 0 ? pick.legs[pick.legs.length - 1] : null;
      const hasOpenLeg = liveLeg && liveLeg.closedAt === undefined;
      if (scored.liveLegResult && hasOpenLeg) {
        // The thresholdHistory bridge (see scoreLeg): append today's
        // {maxMultiplier, minMultiplier} so badges survive reversals.
        liveLeg.thresholdHistory = [
          ...(liveLeg.thresholdHistory || []),
          { ...scored.liveLegResult.history, recordedAt: nowIso },
        ];
      } else if (hasOpenLeg && Number.isFinite(liveLeg.baselinePrice)) {
        // A settled live leg that could not score (no usable quote)
        // contributes 0 to TODAY'S snapshot — a visible regression vector,
        // never silent.
        warnings.push(`${pick.symbol}: no live quote — settled live leg scored 0 this pass`);
      }

      playerTotal += scored.totalPoints;
      pickEntries.push({
        symbol: pick.symbol,
        direction: liveLeg?.direction ?? null,
        totalPoints: scored.totalPoints,
        bankedPoints: scored.bankedPoints,
        livePoints: scored.livePoints,
        ...(dropped ? { dropped: true } : {}),
      });
    }

    const totalPoints = parseFloat(playerTotal.toFixed(2));
    const agentPoints = parseFloat((agentScores !== null
      ? (agentScores[player.odUserId] || 0)
      : (priorCloseScores?.[player.odUserId]?.agentPoints ?? 0)
    ).toFixed(2));
    closeScores[player.odUserId] = {
      totalPoints,
      picks: pickEntries,
      // Ruling A-1: the composite of record, snapshot-cumulative like
      // totalPoints — the weekly composite IS the final day's value
      // (getWeeklyComposite), never a sum over days.
      agentPoints,
      compositePoints: parseFloat(computeComposite(agentPoints, totalPoints).toFixed(2)),
    };
  }

  // Ruling #3: ascending cumulative standing, lowest claims first — the
  // legacy writer's shape verbatim.
  const waiverPriority = Object.entries(closeScores)
    .sort((a, b) => a[1].totalPoints - b[1].totalPoints)
    .map(([odUserId]) => odUserId);

  return {
    skipped: false,
    dayKey,
    dayN,
    dayEntry: { closeScores, recordedAt: nowIso, recordedBy, recordedDate: etDate },
    players,
    waiverPriority,
    warnings,
  };
}

/**
 * Bank one group transactionally: fresh in-tx read (idempotency re-check
 * under contention), single update — players, the day{N} entry (dot-path:
 * prior days are never clobbered), and the waiver order.
 */
export async function bankGroup(db, groupId, quotes, { now = new Date(), atrPercentiles = null, recordedBy = 'manual', agentScores = null } = {}) {
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  const nowIso = now.toISOString();
  const etDate = formatEtDate(now);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(groupRef);
    if (!snap.exists) return { skipped: true, reason: 'group_not_found' };
    const group = snap.data();
    if (group.status !== GROUP_STATUS.BATTLE) return { skipped: true, reason: 'not_battle' };

    const update = computeBankingUpdate(group, quotes, { nowIso, etDate, atrPercentiles, recordedBy, agentScores });
    if (update.skipped) return update;

    tx.update(groupRef, {
      players: update.players,
      [`dailyScores.${update.dayKey}`]: update.dayEntry,
      'claimSystem.currentWaiverPriority': update.waiverPriority,
      updatedAt: nowIso,
    });
    return {
      skipped: false,
      dayKey: update.dayKey,
      closeScores: update.dayEntry.closeScores,
      waiverPriority: update.waiverPriority,
      warnings: update.warnings,
    };
  });
}

/**
 * Cron-side orchestrator: bank every active tournament group. ZERO groups is
 * a clean no-op — the production state until P3+ (this branch rides the
 * nightly snake-draft handler; inertness is test-locked there). One quote
 * batch + one rankings read serve all groups.
 */
export async function bankAllTournamentGroups(db, { now = new Date() } = {}) {
  const snapshot = await db.collection(TOURNAMENT_GROUPS_COLLECTION)
    .where('status', '==', GROUP_STATUS.BATTLE)
    .get();

  const groups = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    // In-code mirror of the legacy eligibility checks (claims cron :564).
    if (data.players?.length === GROUP_SIZE) {
      groups.push({ id: doc.id, ...data });
    }
  });

  const summary = { groups: groups.length, processed: 0, skipped: 0, errors: 0 };
  if (groups.length === 0) return summary;

  const symbols = new Set();
  for (const group of groups) {
    for (const player of group.players || []) {
      for (const pick of player.picks || []) {
        if (pick?.symbol) symbols.add(pick.symbol);
      }
    }
  }

  const [quotes, atrPercentiles] = await Promise.all([
    fetchBatchQuotes([...symbols]),
    loadAtrPercentiles(db),
  ]);

  // A dead price feed must not bank all-zero snapshots — under the
  // cumulative model that would regress every standing (and the waiver
  // order with it). Skip the run; tomorrow's pass settles everything.
  if (symbols.size > 0 && Object.keys(quotes).length === 0) {
    console.error('[TournamentBanking] no quotes available — banking run aborted');
    summary.errors = groups.length;
    return summary;
  }

  for (const group of groups) {
    try {
      // P6a: the agent-layer read is pre-transaction (the quotes pattern);
      // a failure degrades to the carry-forward arm, never aborts banking.
      let agentScores = null;
      try {
        agentScores = (await fetchGroupAgentScores(db, group.id)).byOwner;
      } catch (err) {
        console.error(`[TournamentBanking] group ${group.id} agent-score read failed — carrying forward:`, err.message);
      }
      const result = await bankGroup(db, group.id, quotes, { now, atrPercentiles, recordedBy: 'cron', agentScores });
      if (result.skipped) summary.skipped++;
      else summary.processed++;
    } catch (err) {
      console.error(`[TournamentBanking] group ${group.id} failed:`, err.message);
      summary.errors++;
    }
  }
  return summary;
}
