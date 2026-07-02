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
  BASELINE_POLICY,
  BASELINE_SOURCE,
  CAPTURE_STATE,
  getLatestDayEntry,
  computeComposite,
  round2,
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
  // Field mask per the ledger's precedent (tournamentAgentLedger.js
  // reconcile): battle docs are heavyweight (statusFeed, chats, rankings)
  // and the per-group set grows daily — this read needs three fields.
  const snap = await db.collection('agentBattles')
    .where('groupId', '==', groupId)
    .select('gameMode', 'ownerId', 'scoreState.currentScore')
    .get();
  const byOwner = {};
  snap.forEach(doc => {
    const battle = doc.data();
    // Joint-stamp safety (founder ruling B3): a groupId without the
    // tournament gameMode is malformed — never counted. A foreign ownerId
    // is harmless by construction (computeBankingUpdate only consumes the
    // group's own player ids).
    if (battle.gameMode !== TOURNAMENT_GAME_MODE) return;
    if (typeof battle.ownerId !== 'string' || battle.ownerId.length === 0) return;
    const score = battle.scoreState?.currentScore;
    if (score !== undefined && !Number.isFinite(score)) {
      // A poisoned score must degrade, never abort the group's banking
      // (the module contract below) — skip the value, loudly.
      console.error(`[TournamentBanking] battle ${doc.id}: non-numeric scoreState.currentScore (${typeof score}) — skipped`);
      return;
    }
    byOwner[battle.ownerId] = (byOwner[battle.ownerId] || 0) + (score || 0);
  });
  return byOwner;
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

  // Spec §1.1 canonical-open policy — read the STAMP, not the live flag, so a
  // mid-round flag flip can't split a cohort. A canonical round settles a
  // null baseline ONLY from its frozen `canonicalOpens` snapshot (the score of
  // record captured post-open), never from a fresh re-fetch; a leg with no
  // snapshot after the session voids terminally (NO_ELIGIBLE_OPEN). An absent
  // stamp is legacy (LEGACY_OPEN_DEFER) — settle from the day's fresh open,
  // byte-identical to prior behavior.
  const canonicalPolicy = group?.baselinePolicy === BASELINE_POLICY.CANONICAL_OPEN;

  // P6a carry-forward arms (code review, June 12, 2026 — two grains):
  // - agentScores === null (the battle read THREW): every player carries the
  //   prior snapshot's agentPoints (day 1: nothing to carry — banked 0, said
  //   plainly, not mislabeled as a carry).
  // - per-owner hole (the read SUCCEEDED but an owner with a prior non-zero
  //   standing has no battles in it — vanished/mis-stamped docs): that owner
  //   carries individually; a cumulative standing never regresses to zero on
  //   a read artifact.
  // Either arm stamps agentScoresCarried on the day entry — the durable,
  // writer-readable degrade signal (warnings alone die with the invocation);
  // advancement reads it via lockTopTwo's `degraded` flag.
  const priorCloseScores = latest?.entry?.closeScores || null;
  let agentScoresCarried = false;
  if (agentScores === null) {
    agentScoresCarried = true;
    warnings.push(priorCloseScores
      ? 'agent scores unavailable — prior snapshot agentPoints carried forward'
      : 'agent scores unavailable — no prior snapshot, agentPoints banked 0');
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

      // Canonical round: the leg settles/closes against the round's FROZEN
      // snapshot open, not the day's fresh open — banking reads it, never
      // writes it (the sweep owns `canonicalOpens`). `snapOpen` is null when
      // no eligible open was ever captured for this symbol. Legacy round:
      // `settleOpen` is the day's fresh open (unchanged).
      const snapEntry = canonicalPolicy ? (group.canonicalOpens?.[pick.symbol] ?? null) : null;
      const snapOpen = snapEntry && Number.isFinite(snapEntry.open) && snapEntry.open > 0
        ? snapEntry.open : null;
      const settleOpen = canonicalPolicy ? snapOpen : open;

      // --- Settlement pass ---
      for (const leg of pick.legs) {
        if (leg.baselinePrice == null) {
          if (canonicalPolicy) {
            // Case 2: the frozen snapshot exists → settle from it and stamp
            // the same capture provenance the Phase-2 sweep writes, so a
            // banking-settled leg is indistinguishable from a sweep-settled
            // one. Case 3: no snapshot after the session → terminal void
            // (NO_ELIGIBLE_OPEN). A voided leg keeps its null baseline, scores
            // 0, and contributes nothing — no re-weight, never a re-fetch.
            if (snapOpen != null) {
              leg.baselinePrice = snapOpen;
              leg.baselineSource = BASELINE_SOURCE.CANONICAL_OPEN_CAPTURE;
              leg.baselineCapturedAt = snapEntry.capturedAt ?? leg.baselineCapturedAt ?? null;
              leg.baselinePriceTimestamp = snapEntry.priceTimestamp ?? null;
              leg.captureJobId = snapEntry.captureJobId ?? null;
              leg.baselineSession = snapEntry.session ?? null;
              leg.instrumentId = snapEntry.instrumentId ?? null;
              leg.captureState = CAPTURE_STATE.CAPTURED;
            } else if (leg.captureState !== CAPTURE_STATE.NO_ELIGIBLE_OPEN) {
              leg.captureState = CAPTURE_STATE.NO_ELIGIBLE_OPEN;
              warnings.push(`${pick.symbol}: no canonical-open snapshot — leg voided (NO_ELIGIBLE_OPEN)`);
            }
          } else if (open != null) {
            leg.baselinePrice = open;
          } else {
            warnings.push(`${pick.symbol}: no open price — baseline unsettled`);
          }
        }
        if (leg.closedAt !== undefined && leg.bankedScore === undefined) {
          // Market-closed flip: the close-out price is the next session's
          // open. An overnight open-and-closed leg banks 0 by construction
          // (baseline just settled to the same open — zero exposure). For a
          // canonical round that open is the frozen snapshot (`settleOpen`),
          // so the leg banks against the captured open, never a drifted
          // re-fetch, and the 0-by-construction property still holds.
          if (leg.baselinePrice != null && settleOpen != null) {
            const result = scoreLeg({ symbol: pick.symbol, baseATR, leg, price: settleOpen });
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

    const totalPoints = round2(playerTotal);
    const priorAgent = priorCloseScores?.[player.odUserId]?.agentPoints;
    const carry = Number.isFinite(priorAgent) ? priorAgent : 0; // NaN/absent never perpetuates
    let agentPoints;
    if (agentScores === null) {
      agentPoints = carry;
    } else if (agentScores[player.odUserId] === undefined && carry !== 0) {
      // Per-owner hole: battles existed yesterday (non-zero standing), none
      // today — carry, loudly (see the arms comment above).
      agentScoresCarried = true;
      warnings.push(`${player.odUserId}: agent battles missing from read — prior agentPoints carried forward`);
      agentPoints = carry;
    } else {
      agentPoints = agentScores[player.odUserId] || 0;
    }
    agentPoints = round2(agentPoints);
    closeScores[player.odUserId] = {
      totalPoints,
      picks: pickEntries,
      // Ruling A-1: the composite of record, snapshot-cumulative like
      // totalPoints — the weekly composite IS the final day's value
      // (getWeeklyComposite), never a sum over days.
      agentPoints,
      compositePoints: round2(computeComposite(agentPoints, totalPoints)),
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
    dayEntry: {
      closeScores,
      recordedAt: nowIso,
      recordedBy,
      recordedDate: etDate,
      // The durable degrade marker (omitted-when-false idiom): this
      // snapshot's agent layer is carried/zero, not read fresh.
      ...(agentScoresCarried ? { agentScoresCarried: true } : {}),
    },
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

  const summary = { groups: groups.length, processed: 0, skipped: 0, errors: 0, agentScoreFailures: 0 };
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
        agentScores = await fetchGroupAgentScores(db, group.id);
      } catch (err) {
        console.error(`[TournamentBanking] group ${group.id} agent-score read failed — carrying forward:`, err.message);
        summary.agentScoreFailures++;
      }
      const result = await bankGroup(db, group.id, quotes, { now, atrPercentiles, recordedBy: 'cron', agentScores });
      if (result.skipped) summary.skipped++;
      else summary.processed++;
      // Warnings die with the invocation unless said here (code review:
      // the dayEntry carries the durable agentScoresCarried flag; the log
      // line is for the operator reading tonight's run).
      if (result.warnings?.length > 0) {
        console.warn(`[TournamentBanking] group ${group.id} warnings:`, result.warnings.join(' | '));
      }
    } catch (err) {
      console.error(`[TournamentBanking] group ${group.id} failed:`, err.message);
      summary.errors++;
    }
  }
  return summary;
}
