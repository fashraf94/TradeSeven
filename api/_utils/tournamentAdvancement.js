// api/_utils/tournamentAdvancement.js
//
// P3b — Friday round advancement + champion conclusion (Spec §1.3; the
// founder-ruled Friday duty). Per battle group with the week banked:
//
//   verify day-5 banked → lock TOP TWO by getWeeklyScore (the FINAL
//   snapshot, never a sum — founder ruling, P1a) → write the bracket-doc
//   game lock → transition the group battle→complete → when every game of
//   the round is locked: compose the next round from advancers + CPU
//   padding (Ruling B1) via the P1a factory (forming, fresh full-universe
//   pools, fresh boards expected), or — at the terminal round (the round
//   with exactly ONE game) — write the champion + the spec-§3 one-screen
//   recap (populate what exists; finalComposite lands at P6 and may be
//   backfilled).
//
// BASE-LAYER groups (baseLayerWeek): COMPLETE ONLY — recomposition awaits
// registration (founder-docketed). Groups not yet banked through day 5 are
// a loud "banking pending" no-op for the tick (banking lands ~17:15 ET via
// the nightly snake-draft handler); the orchestrator re-ticks.
//
// IDEMPOTENT AT EVERY GRAIN (the two-grain design's natural guards):
// re-locking a locked game skips; re-completing a complete group skips;
// composition skips when the next round entry exists; next-round group docs
// use DETERMINISTIC ids (the bracketGameId) so a crash between group
// creation and the bracket-doc write recomposes nothing. Write order is
// crash-shaped: bracket lock BEFORE group completion (a completed group
// leaves the battle query, so its lock must already be durable); group docs
// + CPU boards BEFORE the round entry (the entry is the composition guard).
//
// HOLIDAY-WEEK EDGE (flagged at Stage 0′, implemented as ruled): a 4-day
// trading week banks only day4, so the ruled day-5 check never satisfies
// and advancement waits for founder intervention (manual banking or a
// founder-cited rule change). Docketed, not improvised here.
//
// Imports the zero-import schema module from src/ under the revised June
// 2026 import rule (BUILD_RULES §4); the co-located test's real import of
// THIS module is the dependency-surface guard.

import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_BRACKETS_COLLECTION,
  GROUP_STATUS,
  GROUP_SIZE,
  BRACKET_STATUS,
  bracketRoundKey,
  buildBracketGameId,
  parseBracketGameId,
  createBracketGame,
  createBracketRound,
  createBracketDoc,
  createTournamentGroupDoc,
  getWeeklyScore,
  getLatestDayEntry,
  isCpuUserId,
  CPU_USER_ID_PREFIX,
  AGENT_LEDGER_SUBCOLLECTION,
  AGENT_LEDGER_DOC_ID,
  STREAMS_SUBCOLLECTION,
  AGENT_DRAFT_STREAM_DOC_ID,
} from '../../src/constants/leagueTournament.js';
import { transitionStatus, fetchRankedUserPool } from './tournamentGroupService.js';
import { ensureCpuAgents, commitCpuUserBoards, padGamesWithCpus } from './tournamentCpu.js';

const LOG_PREFIX = '[TournamentAdvancement]';

/** The ruled week-complete check: day-5 banked (see the holiday note above). */
export const WEEK_DAYS_REQUIRED = 5;

export function isWeekBanked(group) {
  return (getLatestDayEntry(group)?.dayN || 0) >= WEEK_DAYS_REQUIRED;
}

/**
 * Lock the group's result: every member's weekly score (the FINAL day's
 * cumulative snapshot — getWeeklyScore, never a sum) and the top two.
 * Deterministic tie-break: score desc, then draft order (groupMembers
 * index) — never insertion luck. Pure.
 */
export function lockTopTwo(group) {
  const members = group.groupMembers || [];
  const finalScores = {};
  for (const odUserId of members) {
    finalScores[odUserId] = getWeeklyScore(group, odUserId);
  }
  const ranking = [...members].sort((a, b) =>
    (finalScores[b] - finalScores[a]) || (members.indexOf(a) - members.indexOf(b))
  );
  return { advancers: ranking.slice(0, 2), finalScores, ranking };
}

/** cpu-{n} → n, or null for a non-CPU id. */
function cpuNFromUserId(odUserId) {
  if (!isCpuUserId(odUserId)) return null;
  const n = Number(odUserId.slice(CPU_USER_ID_PREFIX.length));
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * Adjacent-game pairing (standard bracket shape): sorted by gameIndex,
 * games 1+2 feed next-round game 1, games 3+4 feed game 2, … Advancers keep
 * game order within the new group. Pure.
 */
export function pairAdvancers(games) {
  const sorted = [...games].sort((a, b) => a.gameIndex - b.gameIndex);
  const nextGames = [];
  for (let i = 0; i < sorted.length; i += 2) {
    const ids = [...(sorted[i]?.advancers || []), ...(sorted[i + 1]?.advancers || [])];
    nextGames.push(ids);
  }
  return nextGames;
}

/** A bracket-doc game entry reconstructed from a group doc (materialization
 * fallback for docs predating the bracket record). */
function gameEntryFromGroup(group) {
  const parsed = parseBracketGameId(group.bracketGameId);
  return createBracketGame({
    bracketGameId: group.bracketGameId,
    gameIndex: parsed?.gameIndex ?? 1,
    groupId: group.id,
    seats: (group.players || []).map(p => ({ odUserId: p.odUserId, isCpu: p.isCpu === true })),
  });
}

/**
 * The spec-§3 one-screen champion recap — populate what exists, never block
 * the champion write: any read failure degrades a field to null, loudly.
 * `finalComposite` stays null until P6 backfills (composite fields are P6's).
 */
export async function buildChampionRecap(db, bracket, championId) {
  const bracketPath = [];
  const roundKeys = Object.keys(bracket.rounds || {})
    .sort((a, b) => (bracket.rounds[a].roundNumber - bracket.rounds[b].roundNumber));

  for (const key of roundKeys) {
    const round = bracket.rounds[key];
    const game = Object.values(round.games || {}).find(g =>
      (g.seats || []).some(s => s.odUserId === championId));
    if (!game || !game.finalScores) continue;
    const seatOrder = (game.seats || []).map(s => s.odUserId);
    const ranking = [...seatOrder].sort((a, b) =>
      (game.finalScores[b] - game.finalScores[a]) || (seatOrder.indexOf(a) - seatOrder.indexOf(b)));
    bracketPath.push({
      roundNumber: round.roundNumber,
      groupId: game.groupId,
      weeklyScore: game.finalScores[championId] ?? 0,
      placement: ranking.indexOf(championId) + 1,
    });
  }

  const bestWeek = bracketPath.reduce(
    (best, entry) => (best == null || entry.weeklyScore > best.weeklyScore
      ? { roundNumber: entry.roundNumber, weeklyScore: entry.weeklyScore }
      : best),
    null
  );

  // Signature double-down: latest round first — a swap-formed alignment from
  // the ledger event list wins; else the drafted alignment reconstructed
  // from the agent-draft stream against the champion's user picks.
  let signatureDoubleDown = null;
  for (const entry of [...bracketPath].reverse()) {
    try {
      const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(entry.groupId);
      const ledgerSnap = await groupRef.collection(AGENT_LEDGER_SUBCOLLECTION).doc(AGENT_LEDGER_DOC_ID).get();
      const formed = (ledgerSnap.exists ? ledgerSnap.data().doubleDowns || [] : [])
        .filter(e => e.kind === 'formed' && e.odUserId === championId);
      if (formed.length > 0) {
        const last = formed[formed.length - 1];
        signatureDoubleDown = { symbol: last.symbol, roundNumber: entry.roundNumber, kind: 'swap', at: last.at ?? null };
        break;
      }
      const [groupSnap, streamSnap] = await Promise.all([
        groupRef.get(),
        groupRef.collection(STREAMS_SUBCOLLECTION).doc(AGENT_DRAFT_STREAM_DOC_ID).get(),
      ]);
      if (groupSnap.exists && streamSnap.exists) {
        const player = (groupSnap.data().players || []).find(p => p.odUserId === championId);
        const userPicks = new Set((player?.picks || []).map(p => p.symbol));
        const drafted = (streamSnap.data().events || [])
          .find(e => e.odUserId === championId && userPicks.has(e.symbol));
        if (drafted) {
          signatureDoubleDown = { symbol: drafted.symbol, roundNumber: entry.roundNumber, kind: 'draft', at: null };
          break;
        }
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} recap double-down read failed for group ${entry.groupId} — degrading:`, err.message);
    }
  }

  return { bracketPath, bestWeek, signatureDoubleDown, finalComposite: null };
}

/**
 * The Friday duty. Returns a per-step summary; ZERO battle groups is a
 * clean no-op (production state until brackets exist — test-locked, the
 * house pattern): no writes, the caller logs one quiet skip line.
 */
export async function runFridayAdvancement(db, { now = new Date() } = {}) {
  const nowIso = now.toISOString();

  const snapshot = await db.collection(TOURNAMENT_GROUPS_COLLECTION)
    .where('status', '==', GROUP_STATUS.BATTLE)
    .get();
  const groups = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    // House eligibility mirror (claims cron :564 / banking :224).
    if (data.players?.length === GROUP_SIZE) groups.push({ id: doc.id, ...data });
  });

  const summary = {
    groups: groups.length,
    baseCompleted: 0,
    bankingPending: 0,
    gamesLocked: 0,
    roundsLocked: [],
    composedGroups: [],
    champion: null,
    errors: 0,
  };
  if (groups.length === 0) return summary;

  // ---- Base-layer groups: COMPLETE ONLY (ruled; recomposition docketed) ----
  const baseGroups = groups.filter(g => g.bracketGameId == null);
  for (const group of baseGroups) {
    try {
      if (!isWeekBanked(group)) {
        console.log(`${LOG_PREFIX} base-layer group ${group.id}: banking pending (day ${getLatestDayEntry(group)?.dayN || 0}/${WEEK_DAYS_REQUIRED}) — no-op this tick`);
        summary.bankingPending++;
        continue;
      }
      await transitionStatus(db, group.id, GROUP_STATUS.COMPLETE, nowIso);
      console.log(`${LOG_PREFIX} base-layer group ${group.id}: week banked — completed (no recomposition at V1, ruled)`);
      summary.baseCompleted++;
    } catch (err) {
      console.error(`${LOG_PREFIX} base-layer group ${group.id} FAILED:`, err.message);
      summary.errors++;
    }
  }

  // ---- Bracket groups, cohorted by bracketId + round ----
  const cohorts = new Map(); // `${bracketId}|${roundNumber}` -> {bracketId, roundNumber, groups[]}
  for (const group of groups) {
    const parsed = parseBracketGameId(group.bracketGameId);
    if (!parsed) {
      if (group.bracketGameId != null) {
        console.error(`${LOG_PREFIX} group ${group.id}: malformed bracketGameId '${group.bracketGameId}' — skipped (founder attention)`);
        summary.errors++;
      }
      continue;
    }
    const key = `${parsed.bracketId}|${parsed.roundNumber}`;
    if (!cohorts.has(key)) cohorts.set(key, { bracketId: parsed.bracketId, roundNumber: parsed.roundNumber, groups: [] });
    cohorts.get(key).groups.push(group);
  }

  for (const { bracketId, roundNumber, groups: cohortGroups } of cohorts.values()) {
    try {
      await advanceCohort(db, { bracketId, roundNumber, cohortGroups, nowIso, summary });
    } catch (err) {
      console.error(`${LOG_PREFIX} bracket ${bracketId} r${roundNumber} FAILED:`, err.message);
      summary.errors++;
    }
  }

  return summary;
}

async function advanceCohort(db, { bracketId, roundNumber, cohortGroups, nowIso, summary }) {
  const bracketRef = db.collection(TOURNAMENT_BRACKETS_COLLECTION).doc(bracketId);
  const roundKey = bracketRoundKey(roundNumber);

  // Materialization fallback: a bracket doc should exist from seeding/
  // composition; reconstruct round 1 from the observed groups if not
  // (production crash recovery — loud, because something skipped a step).
  let bracketSnap = await bracketRef.get();
  if (!bracketSnap.exists) {
    if (roundNumber !== 1) {
      console.error(`${LOG_PREFIX} bracket ${bracketId}: doc missing at round ${roundNumber} — cannot materialize past round 1; cohort skipped (founder attention)`);
      summary.errors++;
      return;
    }
    const games = {};
    for (const group of cohortGroups) games[group.bracketGameId] = gameEntryFromGroup(group);
    console.warn(`${LOG_PREFIX} bracket ${bracketId}: doc missing — materializing round 1 from ${cohortGroups.length} group(s)`);
    await bracketRef.set(createBracketDoc({ bracketId, round1Games: games, now: nowIso }));
    bracketSnap = await bracketRef.get();
  }

  // Merge any game entries the doc lacks (same recovery posture).
  let bracket = bracketSnap.data();
  for (const group of cohortGroups) {
    if (!bracket.rounds?.[roundKey]) {
      console.error(`${LOG_PREFIX} bracket ${bracketId}: round entry ${roundKey} missing — merging from observed groups`);
      await bracketRef.update({
        [`rounds.${roundKey}`]: createBracketRound({
          roundNumber,
          games: Object.fromEntries(cohortGroups.map(g => [g.bracketGameId, gameEntryFromGroup(g)])),
          composedAt: nowIso,
        }),
        updatedAt: nowIso,
      });
      bracket = (await bracketRef.get()).data();
      break;
    }
    if (!bracket.rounds[roundKey].games?.[group.bracketGameId]) {
      console.warn(`${LOG_PREFIX} bracket ${bracketId}: game entry ${group.bracketGameId} missing — merging from group ${group.id}`);
      await bracketRef.update({
        [`rounds.${roundKey}.games.${group.bracketGameId}`]: gameEntryFromGroup(group),
        updatedAt: nowIso,
      });
      bracket = (await bracketRef.get()).data();
    }
  }

  // ---- Per-game lock: bracket write FIRST, then group completion ----
  for (const group of cohortGroups) {
    if (!isWeekBanked(group)) {
      console.log(`${LOG_PREFIX} bracket ${bracketId} game ${group.bracketGameId}: banking pending (day ${getLatestDayEntry(group)?.dayN || 0}/${WEEK_DAYS_REQUIRED}) — no-op this tick`);
      summary.bankingPending++;
      continue;
    }
    const entry = bracket.rounds[roundKey].games[group.bracketGameId];
    if (entry.advancers == null) {
      const { advancers, finalScores } = lockTopTwo(group);
      await bracketRef.update({
        [`rounds.${roundKey}.games.${group.bracketGameId}.advancers`]: advancers,
        [`rounds.${roundKey}.games.${group.bracketGameId}.finalScores`]: finalScores,
        [`rounds.${roundKey}.games.${group.bracketGameId}.completedAt`]: nowIso,
        updatedAt: nowIso,
      });
      console.log(`${LOG_PREFIX} bracket ${bracketId} game ${group.bracketGameId}: locked top two ${advancers.join(', ')} (scores ${JSON.stringify(finalScores)})`);
      summary.gamesLocked++;
    }
    if (group.status === GROUP_STATUS.BATTLE) {
      await transitionStatus(db, group.id, GROUP_STATUS.COMPLETE, nowIso);
    }
  }

  // ---- Round lock → terminal champion or next-round composition ----
  bracket = (await bracketRef.get()).data();
  const round = bracket.rounds[roundKey];
  const games = Object.values(round.games || {});
  if (games.length === 0 || !games.every(g => g.advancers != null)) return;

  if (round.lockedAt == null) {
    await bracketRef.update({ [`rounds.${roundKey}.lockedAt`]: nowIso, updatedAt: nowIso });
    summary.roundsLocked.push(`${bracketId}:${roundKey}`);
  }

  if (games.length === 1) {
    // Terminal round — the final four decides the champion (top-1).
    if (bracket.champion == null) {
      const game = games[0];
      const seatOrder = (game.seats || []).map(s => s.odUserId);
      const ranking = [...seatOrder].sort((a, b) =>
        (game.finalScores[b] - game.finalScores[a]) || (seatOrder.indexOf(a) - seatOrder.indexOf(b)));
      const championId = ranking[0];
      const champion = {
        odUserId: championId,
        isCpu: (game.seats || []).find(s => s.odUserId === championId)?.isCpu === true,
        groupId: game.groupId,
        weeklyScore: game.finalScores[championId] ?? 0,
      };
      const recap = await buildChampionRecap(db, bracket, championId);
      await bracketRef.update({
        champion,
        recap,
        status: BRACKET_STATUS.COMPLETE,
        updatedAt: nowIso,
      });
      console.log(`${LOG_PREFIX} bracket ${bracketId}: CHAMPION ${championId} (${champion.weeklyScore} pts) — recap written`);
      summary.champion = { bracketId, ...champion };
    }
    return;
  }

  // Composition natural guard: the next round entry is the marker.
  const nextRoundNumber = roundNumber + 1;
  const nextKey = bracketRoundKey(nextRoundNumber);
  if (bracket.rounds[nextKey]) return;

  // Advancing CPUs keep their identities; fresh padding numbers start past
  // every CPU already seated in the new round (per-round uniqueness rule).
  const realIdsByGame = pairAdvancers(games);
  const advancingCpuNs = realIdsByGame.flat().map(cpuNFromUserId).filter(n => n != null);
  const startN = advancingCpuNs.length > 0 ? Math.max(...advancingCpuNs) + 1 : 1;
  const { seatsByGame: paddedSeats, cpuNByUserId, cpuNs } = padGamesWithCpus(realIdsByGame, { startN });
  // padGamesWithCpus marks only its own padding as CPU; an ADVANCING CPU
  // arrives as a "real" advancer id — restore its flag from the locked
  // round's seat entries (the flag is the contract; prefix is the fallback).
  const isCpuById = new Map();
  for (const game of games) {
    for (const seat of game.seats || []) isCpuById.set(seat.odUserId, seat.isCpu === true);
  }
  const seatsByGame = paddedSeats.map(seats => seats.map(seat => ({
    ...seat,
    isCpu: seat.isCpu || isCpuById.get(seat.odUserId) === true || isCpuUserId(seat.odUserId),
  })));

  // Fresh full-universe pools (Spec §0.11) — one rankings read per cohort.
  const userPool = await fetchRankedUserPool(db);
  if (userPool.length < GROUP_SIZE * 3) {
    console.error(`${LOG_PREFIX} bracket ${bracketId}: stockRankings yielded ${userPool.length} names — composition deferred to next tick`);
    summary.errors++;
    return;
  }

  if (cpuNs.length > 0) await ensureCpuAgents(db, cpuNs, nowIso);

  const nextGames = {};
  for (let i = 0; i < seatsByGame.length; i++) {
    const seats = seatsByGame[i];
    const gameIndex = i + 1;
    const bracketGameId = buildBracketGameId(bracketId, nextRoundNumber, gameIndex);
    // Deterministic group id == bracketGameId → get-or-create makes a crash
    // between group creation and the round-entry write recompose nothing.
    const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(bracketGameId);
    const existing = await groupRef.get();
    if (!existing.exists) {
      await groupRef.set(createTournamentGroupDoc({
        players: seats.map(s => ({ odUserId: s.odUserId, picks: [], isCpu: s.isCpu })),
        userPool,
        roundNumber: nextRoundNumber,
        bracketGameId,
        status: GROUP_STATUS.FORMING,
        now: nowIso,
      }));
    }
    const groupDoc = existing.exists ? existing.data() : (await groupRef.get()).data();
    const groupCpuNs = Object.fromEntries(
      seats.filter(s => s.isCpu)
        .map(s => [s.odUserId, cpuNByUserId[s.odUserId] ?? cpuNFromUserId(s.odUserId)])
        .filter(([, n]) => n != null)
    );
    if (Object.keys(groupCpuNs).length > 0) {
      await commitCpuUserBoards(db, { id: bracketGameId, ...groupDoc }, groupCpuNs, nowIso);
    }
    nextGames[bracketGameId] = createBracketGame({ bracketGameId, gameIndex, groupId: bracketGameId, seats });
    summary.composedGroups.push(bracketGameId);
    console.log(`${LOG_PREFIX} bracket ${bracketId}: composed ${bracketGameId} — seats ${seats.map(s => s.odUserId).join(', ')}`);
  }

  await bracketRef.update({
    [`rounds.${nextKey}`]: createBracketRound({ roundNumber: nextRoundNumber, games: nextGames, composedAt: nowIso }),
    currentRound: nextRoundNumber,
    updatedAt: nowIso,
  });
  console.log(`${LOG_PREFIX} bracket ${bracketId}: round ${nextRoundNumber} composed (${seatsByGame.length} game(s), ${cpuNs.length} CPU pad seat(s))`);
}
