// api/_utils/tournamentAdvancement.js
//
// P3b — Friday round advancement + champion conclusion (Spec §1.3; the
// founder-ruled Friday duty). Per battle group with the week banked:
//
//   verify day-5 banked → lock TOP TWO by getWeeklyComposite (ruling A-1,
//   June 12, 2026: the COMPOSITE is the score of record; still the FINAL
//   snapshot, never a sum — the P1a identity carries; finalUserScores keep
//   the user-layer detail) → write the bracket-doc game lock → P6a
//   finalization side-effects (rank apply + leaderboard final upsert,
//   idempotent) → transition the group battle→complete → when every game
//   of the round is locked: compose the next round from advancers + CPU
//   padding (Ruling B1) via the P1a factory (forming, fresh full-universe
//   pools, fresh boards expected), or — at the terminal round (the round
//   with exactly ONE game) — write the champion + the spec-§3 one-screen
//   recap (finalComposite closed at P6a: the championship week's composite).
//
// BASE-LAYER groups (baseLayerWeek): COMPLETE ONLY — recomposition awaits
// registration (founder-docketed). Groups not yet banked through day 5 are
// a loud "banking pending" no-op for the tick (banking lands ~17:15 ET via
// the nightly snake-draft handler); the orchestrator re-ticks.
//
// IDEMPOTENT AT EVERY GRAIN, RESUMABLE FROM THE BRACKET DOC ALONE: locking,
// completion, composition, and the champion each carry a natural guard
// (advancers set, status, rounds.r{N+1} exists, champion set), and the
// round-finalization stage (lock → champion/composition) is driven off the
// BRACKET DOC, not the battle-group query — so a crash after the groups
// complete but before composition/champion lands is healed by the
// active-bracket sweep on the next tick (code-review finding, June 12,
// 2026: a groups-only retry path orphaned exactly that window). Next-round
// group docs use DETERMINISTIC ids (the bracketGameId) so recomposition
// recreates nothing. Write order stays crash-shaped: bracket lock BEFORE
// group completion; group docs + CPU boards BEFORE the round entry.
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
  BRACKET_STATUS,
  TOURNAMENT_TUNING,
  bracketRoundKey,
  buildBracketGameId,
  parseBracketGameId,
  createBracketGame,
  createBracketRound,
  createBracketDoc,
  createTournamentGroupDoc,
  getWeeklyScore,
  getWeeklyComposite,
  getLatestDayEntry,
  isCpuUserId,
  cpuNFromUserId,
  WEEK_DAYS_REQUIRED,
  isWeekBanked,
  isFinalSnapshotDegraded,
  rankByScores,
  AGENT_LEDGER_SUBCOLLECTION,
  AGENT_LEDGER_DOC_ID,
  STREAMS_SUBCOLLECTION,
  AGENT_DRAFT_STREAM_DOC_ID,
} from '../../src/constants/leagueTournament.js';
import {
  transitionStatus,
  fetchRankedUserPool,
  fetchEligibleGroupsByStatus,
} from './tournamentGroupService.js';
import { ensureCpuAgents, commitCpuUserBoards, padGamesWithCpus } from './tournamentCpu.js';
import { applyGroupWeekToRanks, applyLockedGameToRanks } from './tournamentRank.js';
import { upsertLeaderboardForGroups } from './tournamentLeaderboard.js';

const LOG_PREFIX = '[TournamentAdvancement]';

// P6a: the week-complete check is hoisted to the schema module (the
// leaderboard writer shares it); these re-exports keep this module's
// P3b export contract intact.
export { WEEK_DAYS_REQUIRED, isWeekBanked };

/**
 * Lock the group's result (ruling A-1, June 12, 2026): every member's weekly
 * COMPOSITE (the FINAL day's cumulative snapshot — getWeeklyComposite, never
 * a sum) is the score of record; the user-layer snapshots ride alongside as
 * finalUserScores. Deterministic tie-break: composite desc, then draft order
 * (groupMembers index) — never insertion luck. Pure.
 */
export function lockTopTwo(group) {
  const members = group.groupMembers || [];
  const finalScores = {};
  const finalUserScores = {};
  for (const odUserId of members) {
    finalScores[odUserId] = getWeeklyComposite(group, odUserId);
    finalUserScores[odUserId] = getWeeklyScore(group, odUserId);
  }
  const ranking = rankByScores(finalScores, members);
  return { advancers: ranking.slice(0, 2), finalScores, finalUserScores, ranking };
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

/** Materialization safety: observed games must be exactly games 1..N — a
 * gap means a sibling group escaped the battle query (already complete /
 * still forming) and a doc built from this subset would silently drop its
 * advancers from the tournament. */
function gameIndexesContiguous(games) {
  const idx = games.map(g => g.gameIndex).sort((a, b) => a - b);
  return idx.length > 0 && idx.every((v, i) => v === i + 1);
}

/**
 * The spec-§3 one-screen champion recap — populate what exists, never block
 * the champion write: any read failure degrades a field to null, loudly.
 * P6a closes the recap contract: `finalComposite` = the championship week's
 * composite (the terminal game's locked finalScores under ruling A-1).
 * Entries locked BEFORE P6 (dev data only) carry user-only finalScores —
 * the field then reports that stored value, degrade recorded here.
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
    const ranking = rankByScores(game.finalScores, seatOrder);
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

  // The P3b recap contract, closed: the championship week's composite is
  // the final (highest-round) bracketPath entry's weeklyScore (composite
  // under ruling A-1; bracketPath is built round-ascending above).
  const finalComposite = bracketPath.length > 0
    ? bracketPath[bracketPath.length - 1].weeklyScore
    : null;

  return { bracketPath, bestWeek, signatureDoubleDown, finalComposite };
}

/**
 * The Friday duty. Returns a per-step summary; ZERO battle groups AND zero
 * active brackets is a clean no-op (production state until brackets exist —
 * test-locked, the house pattern): no writes, the caller logs one quiet
 * skip line.
 */
export async function runFridayAdvancement(db, { now = new Date(), includeDevGroups = false } = {}) {
  const nowIso = now.toISOString();
  // P4 companion (a): production advancement never touches dev groups (and
  // therefore never processes dev brackets — they only enter via their
  // groups); the dev duty surface opts in.
  const groups = await fetchEligibleGroupsByStatus(db, GROUP_STATUS.BATTLE, { includeDev: includeDevGroups });

  const summary = {
    groups: groups.length,
    activeBrackets: 0,
    baseCompleted: 0,
    bankingPending: 0,
    gamesLocked: 0,
    roundsLocked: [],
    composedGroups: [],
    champion: null,
    // P6a finalization side-effects (rank + leaderboard final upsert).
    rankApplied: 0,
    rankSkipped: 0,
    leaderboardDocs: 0,
    degradedLocks: 0,
    errors: 0,
  };

  // One rankings read per run, fetched lazily (composition may never need it).
  let poolMemo = null;
  const getPool = async () => (poolMemo ??= await fetchRankedUserPool(db));

  // ---- Base-layer groups: COMPLETE ONLY (ruled; recomposition docketed) ----
  const baseGroups = groups.filter(g => g.bracketGameId == null);
  for (const group of baseGroups) {
    try {
      if (!isWeekBanked(group)) {
        console.log(`${LOG_PREFIX} base-layer group ${group.id}: banking pending (day ${getLatestDayEntry(group)?.dayN || 0}/${WEEK_DAYS_REQUIRED}) — no-op this tick`);
        summary.bankingPending++;
        continue;
      }
      // §7.2 (founder ruling, June 12, 2026): refuse to finalize a week whose
      // final snapshot is degraded (agentScoresCarried) — the composite may be
      // missing agent-layer points and completion is irreversible. Defer
      // loudly; the next banking pass self-heals the snapshot and the
      // idempotent finalization lands clean.
      if (isFinalSnapshotDegraded(group)) {
        console.error(`${LOG_PREFIX} base-layer group ${group.id}: DEGRADED FINAL SNAPSHOT (agentScoresCarried) — finalization REFUSED this tick; banking self-heals next pass (§7.2)`);
        summary.degradedLocks++;
        continue;
      }
      // P6a: rank + leaderboard finalization BEFORE the completion
      // transition, and completion is GATED on a clean pass (code review,
      // June 12, 2026): base-layer groups have no bracket entry, so a
      // caught side-effect failure followed by completion would orphan the
      // week forever — instead the group stays in the battle query and the
      // withheld duty marker re-ticks it until the idempotent halves land.
      const clean = await runWeekSideEffects(db, { group, entry: null, dev: group.isDev === true, nowIso, summary });
      if (!clean) {
        console.error(`${LOG_PREFIX} base-layer group ${group.id}: side-effects incomplete — completion deferred to next tick`);
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
      await advanceCohort(db, { bracketId, roundNumber, cohortGroups, nowIso, summary, getPool });
    } catch (err) {
      console.error(`${LOG_PREFIX} bracket ${bracketId} r${roundNumber} FAILED:`, err.message);
      summary.errors++;
    }
  }

  // ---- Active-bracket sweep: resume any finalization the battle-group
  // query can no longer see (groups completed, then a crash/shortfall left
  // composition or the champion unwritten). Read AFTER the cohort pass so
  // this tick's own writes are visible and just-finished rounds no-op. ----
  const bracketsSnap = await db.collection(TOURNAMENT_BRACKETS_COLLECTION)
    .where('status', '==', BRACKET_STATUS.ACTIVE)
    .get();
  const activeBrackets = [];
  bracketsSnap.forEach(doc => activeBrackets.push({ id: doc.id, bracket: doc.data() }));
  summary.activeBrackets = activeBrackets.length;

  for (const { id, bracket } of activeBrackets) {
    // P4 companion (a), extended at the P6a review: production duty runs
    // never work dev brackets — the sweep was the one loophole (a wedged
    // smoke bracket could withhold the production Friday marker forever).
    // The dev duty surface (run-duty, includeDevGroups: true) owns them.
    if (bracket.isDev === true && !includeDevGroups) continue;
    try {
      const bracketRef = db.collection(TOURNAMENT_BRACKETS_COLLECTION).doc(id);
      // P6a: resume finalization side-effects for any locked game whose
      // sideEffectsAt stamp is missing (a crash between a lock and its
      // side-effects). Stamped entries cost ZERO reads — the stamp is on
      // the bracket doc already in hand (code review: the unstamped resume
      // previously re-read 4 rank docs + profiles per locked game per tick).
      for (const [roundKey, round] of Object.entries(bracket.rounds || {})) {
        for (const entry of Object.values(round.games || {})) {
          if (entry.advancers == null || entry.sideEffectsAt != null) continue;
          await resumeEntrySideEffects(db, { bracketRef, roundKey, bracket, entry, nowIso, summary });
        }
      }
      const roundNumbers = Object.values(bracket.rounds || {})
        .map(r => r.roundNumber)
        .sort((a, b) => a - b);
      for (const roundNumber of roundNumbers) {
        await finalizeRound(db, { bracketRef, bracket, roundNumber, nowIso, summary, getPool });
        if (bracket.status === BRACKET_STATUS.COMPLETE) break;
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} bracket ${id} sweep FAILED:`, err.message);
      summary.errors++;
    }
  }

  return summary;
}

/**
 * P6a finalization side-effects for a group whose week is banked — the ONE
 * core both paths run (code review, June 12, 2026: the previous split pair
 * had divergent retry semantics that could orphan a leaderboard row):
 * - rank application (founder-signed B-1/B-2; idempotent per appliedGroups),
 *   entry-based when a locked bracket entry is in hand, group-based
 *   (lockTopTwo) for base-layer groups;
 * - the leaderboard's final upsert (idempotent SET of weeks.{groupId}),
 *   UNCONDITIONAL whenever the group doc exists, routed by the SAME dev
 *   decision as the rank half (the upsert's dev override).
 * Returns true only when BOTH halves landed clean — callers gate the
 * irreversible transitions (group completion, the sideEffectsAt stamp, the
 * champion write) on it; failures count on summary.errors, which withholds
 * the duty marker so the next tick retries the idempotent halves.
 *
 * DEGRADE HONESTY (§7.2, founder-ruled June 12, 2026): FRESH locks now REFUSE
 * a degraded final snapshot at the lock gate (advanceCohort / the base-layer
 * loop), counting summary.degradedLocks there. This path therefore only sees
 * agentScoresCarried on a legacy entry locked BEFORE the ruling and resumed
 * via the sweep — where the lock is already permanent and cannot be undone —
 * so it logs loudly for founder attention but does NOT re-count the refusal.
 */
async function runWeekSideEffects(db, { group, entry, dev, nowIso, summary }) {
  let clean = true;

  if (group && isFinalSnapshotDegraded(group)) {
    console.error(`${LOG_PREFIX} group ${group.id}: side-effects on a degraded snapshot (agentScoresCarried) — a pre-§7.2 lock resumed; composite may miss agent-layer points (founder attention)`);
  }

  try {
    let rank;
    if (entry && entry.advancers != null) {
      rank = await applyLockedGameToRanks(db, { entry, dev, now: nowIso });
    } else {
      const { finalScores, ranking } = lockTopTwo(group);
      rank = await applyGroupWeekToRanks(db, {
        groupId: group.id,
        seats: (group.players || []).map(p => ({ odUserId: p.odUserId, isCpu: p.isCpu === true })),
        compositeByPlayer: finalScores,
        ranking,
        dev,
        now: nowIso,
      });
    }
    summary.rankApplied += rank.applied;
    summary.rankSkipped += rank.skipped;
    summary.errors += rank.errors;
    if (rank.errors > 0) clean = false;
  } catch (err) {
    console.error(`${LOG_PREFIX} group ${group?.id ?? entry?.groupId}: rank side-effect FAILED:`, err.message);
    summary.errors++;
    clean = false;
  }

  try {
    if (group) {
      const lb = await upsertLeaderboardForGroups(db, [group], { now: new Date(nowIso), dev });
      summary.leaderboardDocs += lb.docsWritten;
      summary.errors += lb.errors;
      if (lb.errors > 0) clean = false;
    } else {
      // No group doc (deleted out-of-band): the leaderboard half cannot
      // run — never stamp, keep retrying loudly.
      console.error(`${LOG_PREFIX} game ${entry?.bracketGameId}: group doc ${entry?.groupId} missing — leaderboard upsert impossible (founder attention)`);
      summary.errors++;
      clean = false;
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} group ${group?.id}: leaderboard side-effect FAILED:`, err.message);
    summary.errors++;
    clean = false;
  }

  return clean;
}

/** The completion record for a bracket game's side-effects: written on the
 * game entry ONLY after both halves landed clean; absence is what the
 * resume paths key on. Mirrored in-memory so same-tick consumers see it. */
async function stampEntrySideEffects(bracketRef, roundKey, entry, nowIso) {
  await bracketRef.update({
    [`rounds.${roundKey}.games.${entry.bracketGameId}.sideEffectsAt`]: nowIso,
    updatedAt: nowIso,
  });
  entry.sideEffectsAt = nowIso;
}

/**
 * Resume one UNSTAMPED locked entry from the bracket alone (the sweep + the
 * pre-champion gate): fetch the group doc (it persists after completion),
 * resolve the dev namespace from BOTH flags (bracket OR group — the
 * materialization fallback can rebuild a bracket doc, so neither side is
 * trusted alone), run the core, stamp on clean. Returns true when the entry
 * is stamped (now or already).
 */
async function resumeEntrySideEffects(db, { bracketRef, roundKey, bracket, entry, nowIso, summary }) {
  if (entry.sideEffectsAt != null) return true;
  let group = null;
  try {
    const groupSnap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(entry.groupId).get();
    group = groupSnap.exists ? { id: groupSnap.id, ...groupSnap.data() } : null;
  } catch (err) {
    console.error(`${LOG_PREFIX} game ${entry.bracketGameId}: group read failed during resume:`, err.message);
    summary.errors++;
    return false;
  }
  const dev = bracket.isDev === true || group?.isDev === true;
  const clean = await runWeekSideEffects(db, { group, entry, dev, nowIso, summary });
  if (!clean) return false;
  try {
    await stampEntrySideEffects(bracketRef, roundKey, entry, nowIso);
  } catch (err) {
    console.error(`${LOG_PREFIX} game ${entry.bracketGameId}: side-effects stamp write failed (retries next tick):`, err.message);
    summary.errors++;
    return false;
  }
  return true;
}

/**
 * One bracket+round cohort of battle groups: ensure the bracket record
 * exists (materialization recovery — loud, guarded by game-index
 * contiguity), lock each banked game, complete its group, then hand the
 * round to finalizeRound. The in-memory `bracket` object is kept in step
 * with every write — no re-reads.
 */
async function advanceCohort(db, { bracketId, roundNumber, cohortGroups, nowIso, summary, getPool }) {
  const bracketRef = db.collection(TOURNAMENT_BRACKETS_COLLECTION).doc(bracketId);
  const roundKey = bracketRoundKey(roundNumber);

  // Materialization fallback: a bracket doc should exist from seeding/
  // composition; reconstruct round 1 from the observed groups if not
  // (production crash recovery — loud, because something skipped a step).
  const bracketSnap = await bracketRef.get();
  let bracket;
  if (!bracketSnap.exists) {
    if (roundNumber !== 1) {
      console.error(`${LOG_PREFIX} bracket ${bracketId}: doc missing at round ${roundNumber} — cannot materialize past round 1; cohort skipped (founder attention)`);
      summary.errors++;
      return;
    }
    const games = {};
    for (const group of cohortGroups) games[group.bracketGameId] = gameEntryFromGroup(group);
    if (!gameIndexesContiguous(Object.values(games))) {
      console.error(`${LOG_PREFIX} bracket ${bracketId}: doc missing and observed games are not 1..N (${Object.values(games).map(g => g.gameIndex).join(',')}) — a sibling group is outside the battle query; materialization REFUSED (founder attention)`);
      summary.errors++;
      return;
    }
    console.warn(`${LOG_PREFIX} bracket ${bracketId}: doc missing — materializing round 1 from ${cohortGroups.length} group(s)`);
    bracket = createBracketDoc({ bracketId, round1Games: games, now: nowIso });
    // Ruling A-4 integrity (code review): a materialized bracket must carry
    // the dev flag its groups carry, or the sweep's namespace derivation
    // could route smoke side-effects at production docs.
    if (cohortGroups.every(g => g.isDev === true)) bracket = { ...bracket, isDev: true };
    await bracketRef.set(bracket);
  } else {
    bracket = bracketSnap.data();
  }

  // Round-entry merge (same recovery posture; restores currentRound too —
  // the happy path sets it at composition, recovery must not leave it stale).
  if (!bracket.rounds?.[roundKey]) {
    const games = Object.fromEntries(cohortGroups.map(g => [g.bracketGameId, gameEntryFromGroup(g)]));
    if (!gameIndexesContiguous(Object.values(games))) {
      console.error(`${LOG_PREFIX} bracket ${bracketId}: round entry ${roundKey} missing and observed games are not 1..N — merge REFUSED (founder attention)`);
      summary.errors++;
      return;
    }
    console.error(`${LOG_PREFIX} bracket ${bracketId}: round entry ${roundKey} missing — merging from observed groups`);
    const roundEntry = createBracketRound({ roundNumber, games, composedAt: nowIso });
    const currentRound = Math.max(bracket.currentRound || 1, roundNumber);
    await bracketRef.update({ [`rounds.${roundKey}`]: roundEntry, currentRound, updatedAt: nowIso });
    bracket.rounds = { ...(bracket.rounds || {}), [roundKey]: roundEntry };
    bracket.currentRound = currentRound;
  }
  for (const group of cohortGroups) {
    if (!bracket.rounds[roundKey].games?.[group.bracketGameId]) {
      console.warn(`${LOG_PREFIX} bracket ${bracketId}: game entry ${group.bracketGameId} missing — merging from group ${group.id}`);
      const entry = gameEntryFromGroup(group);
      await bracketRef.update({ [`rounds.${roundKey}.games.${group.bracketGameId}`]: entry, updatedAt: nowIso });
      bracket.rounds[roundKey].games[group.bracketGameId] = entry;
    }
  }

  // ---- Per-game lock: bracket write FIRST, then group completion. One
  // game's failure never aborts its siblings (per-game catch). ----
  for (const group of cohortGroups) {
    try {
      if (!isWeekBanked(group)) {
        console.log(`${LOG_PREFIX} bracket ${bracketId} game ${group.bracketGameId}: banking pending (day ${getLatestDayEntry(group)?.dayN || 0}/${WEEK_DAYS_REQUIRED}) — no-op this tick`);
        summary.bankingPending++;
        continue;
      }
      const entry = bracket.rounds[roundKey].games[group.bracketGameId];
      if (entry.advancers == null) {
        // §7.2 (founder ruling, June 12, 2026): the bracket lock is permanent,
        // so refuse to lock a degraded final snapshot (agentScoresCarried) —
        // the composite of record may be missing agent-layer points. Defer
        // loudly and leave the game unlocked (the group stays in the battle
        // query); the next banking pass self-heals and the lock lands clean.
        if (isFinalSnapshotDegraded(group)) {
          console.error(`${LOG_PREFIX} bracket ${bracketId} game ${group.bracketGameId}: DEGRADED FINAL SNAPSHOT (agentScoresCarried) — lock REFUSED this tick; banking self-heals next pass (§7.2)`);
          summary.degradedLocks++;
          continue;
        }
        const { advancers, finalScores, finalUserScores } = lockTopTwo(group);
        await bracketRef.update({
          [`rounds.${roundKey}.games.${group.bracketGameId}.advancers`]: advancers,
          [`rounds.${roundKey}.games.${group.bracketGameId}.finalScores`]: finalScores,
          [`rounds.${roundKey}.games.${group.bracketGameId}.finalUserScores`]: finalUserScores,
          [`rounds.${roundKey}.games.${group.bracketGameId}.completedAt`]: nowIso,
          updatedAt: nowIso,
        });
        entry.advancers = advancers;
        entry.finalScores = finalScores;
        entry.finalUserScores = finalUserScores;
        entry.completedAt = nowIso;
        console.log(`${LOG_PREFIX} bracket ${bracketId} game ${group.bracketGameId}: locked top two ${advancers.join(', ')} (composite ${JSON.stringify(finalScores)}, user ${JSON.stringify(finalUserScores)})`);
        summary.gamesLocked++;
      }
      // P6a finalization side-effects — rank apply + the leaderboard's final
      // upsert, BEFORE the completion transition, with completion GATED on a
      // clean pass and the sideEffectsAt stamp as the durable record (code
      // review, June 12, 2026): a caught failure no longer completes the
      // group — it stays in the battle query and the withheld duty marker
      // re-ticks it; the stamp makes resumed/repeat ticks free.
      if (entry.sideEffectsAt == null) {
        const dev = bracket.isDev === true || group.isDev === true;
        const clean = await runWeekSideEffects(db, { group, entry, dev, nowIso, summary });
        if (!clean) {
          console.error(`${LOG_PREFIX} bracket ${bracketId} game ${group.bracketGameId}: side-effects incomplete — completion deferred to next tick`);
          continue;
        }
        await stampEntrySideEffects(bracketRef, roundKey, entry, nowIso);
      }
      try {
        await transitionStatus(db, group.id, GROUP_STATUS.COMPLETE, nowIso);
      } catch (err) {
        // A concurrent duty run (cron tick + dev button) may have completed
        // the group between our query and this write — benign, the lock
        // above is idempotent and durable.
        if (/illegal transition "complete"/.test(err.message)) {
          console.log(`${LOG_PREFIX} group ${group.id}: already complete (concurrent run) — continuing`);
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} bracket ${bracketId} game ${group.bracketGameId} FAILED:`, err.message);
      summary.errors++;
    }
  }

  await finalizeRound(db, { bracketRef, bracket, roundNumber, nowIso, summary, getPool });
}

/**
 * Round finalization — lock the round, then champion (terminal) or
 * next-round composition. Driven ENTIRELY off the bracket doc so the
 * active-bracket sweep can resume it after the source groups have left the
 * battle query. Every step is naturally guarded (lockedAt, champion,
 * rounds.r{N+1}); the in-memory `bracket` is kept in step with each write.
 */
async function finalizeRound(db, { bracketRef, bracket, roundNumber, nowIso, summary, getPool }) {
  const roundKey = bracketRoundKey(roundNumber);
  const round = bracket.rounds?.[roundKey];
  if (!round) return;
  const games = Object.values(round.games || {});
  if (games.length === 0 || !games.every(g => g.advancers != null)) return;

  const bracketId = bracket.bracketId;

  if (round.lockedAt == null) {
    await bracketRef.update({ [`rounds.${roundKey}.lockedAt`]: nowIso, updatedAt: nowIso });
    round.lockedAt = nowIso;
    summary.roundsLocked.push(`${bracketId}:${roundKey}`);
  }

  if (games.length === 1) {
    // Terminal round — the final four decides the champion (top-1).
    if (bracket.champion == null) {
      const game = games[0];
      // P6a: the completed bracket leaves the active sweep forever, so the
      // champion write is GATED on the terminal game's side-effects stamp
      // (code review: error-isolation here previously let the champion land
      // with the championship week's RP permanently unapplied). Withholding
      // retries next tick — the bracket stays ACTIVE until it can conclude
      // with nothing owed.
      const stamped = await resumeEntrySideEffects(db, { bracketRef, roundKey, bracket, entry: game, nowIso, summary });
      if (!stamped) {
        console.error(`${LOG_PREFIX} bracket ${bracketId}: terminal side-effects incomplete — champion write WITHHELD (retries next tick)`);
        return;
      }
      const seatOrder = (game.seats || []).map(s => s.odUserId);
      const ranking = rankByScores(game.finalScores, seatOrder);
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
      bracket.champion = champion;
      bracket.recap = recap;
      bracket.status = BRACKET_STATUS.COMPLETE;
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
  const { seatsByGame: paddedSeats, cpuNs } = padGamesWithCpus(realIdsByGame, { startN });
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

  // Fresh full-universe pool (Spec §0.11) — memoized per run. The floor is
  // BOARD_DEPTH_MIN, the deepest callee precondition (CPU boards commit
  // through buildBoardCommit, which rejects boards under 15 names).
  const userPool = await getPool();
  if (userPool.length < TOURNAMENT_TUNING.BOARD_DEPTH_MIN) {
    console.error(`${LOG_PREFIX} bracket ${bracketId}: stockRankings yielded ${userPool.length} names (< ${TOURNAMENT_TUNING.BOARD_DEPTH_MIN}) — composition deferred to next tick`);
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
    let groupDoc;
    if (existing.exists) {
      groupDoc = existing.data();
    } else {
      groupDoc = createTournamentGroupDoc({
        players: seats.map(s => ({ odUserId: s.odUserId, picks: [], isCpu: s.isCpu })),
        userPool,
        roundNumber: nextRoundNumber,
        bracketGameId,
        status: GROUP_STATUS.FORMING,
        now: nowIso,
      });
      // P4 companion (a): a dev bracket composes DEV groups — the flag
      // inherits so a smoke bracket can never launder into production scope.
      if (bracket.isDev === true) groupDoc = { ...groupDoc, isDev: true };
      await groupRef.set(groupDoc);
    }
    const boards = await commitCpuUserBoards(db, { id: bracketGameId, ...groupDoc }, nowIso);
    if (boards.failed.length > 0) summary.errors++;
    nextGames[bracketGameId] = createBracketGame({ bracketGameId, gameIndex, groupId: bracketGameId, seats });
    summary.composedGroups.push(bracketGameId);
    console.log(`${LOG_PREFIX} bracket ${bracketId}: composed ${bracketGameId} — seats ${seats.map(s => s.odUserId).join(', ')}`);
  }

  const nextRoundEntry = createBracketRound({ roundNumber: nextRoundNumber, games: nextGames, composedAt: nowIso });
  await bracketRef.update({
    [`rounds.${nextKey}`]: nextRoundEntry,
    currentRound: nextRoundNumber,
    updatedAt: nowIso,
  });
  bracket.rounds[nextKey] = nextRoundEntry;
  bracket.currentRound = nextRoundNumber;
  console.log(`${LOG_PREFIX} bracket ${bracketId}: round ${nextRoundNumber} composed (${seatsByGame.length} game(s), ${cpuNs.length} CPU pad seat(s))`);
}
