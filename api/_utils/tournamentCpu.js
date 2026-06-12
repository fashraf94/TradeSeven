// api/_utils/tournamentCpu.js
//
// P3b — CPU system agents (founder Ruling B1, consequences ratified in
// writing; specifics ratified at the P3b Stage-0′ go, June 12, 2026).
//
// CPU seats are REAL system-owned agents — never the synthetic dev/preview
// affordance (synthetic on a real group stays a configuration error, the
// P3a contract at tournamentAgentBoards.js). The whole design is
// deterministic and idempotent:
//
// - agents/cpu-agent-{n}: deterministic doc id → get-or-create is race-free;
//   created LAZILY at group composition (Friday advancement, dev seeder) —
//   no pre-seeding step to forget. ownerId 'cpu-{n}' means the existing
//   resolveGroupAgents ownerId lookup resolves CPU agents with zero changes.
// - archetype: fixed round-robin (CPU_ARCHETYPE_ORDER[(n-1) % 6]) —
//   reproducible from the id alone; ≤4 consecutive CPUs in a group field
//   four distinct archetypes.
// - user boards (3-pick layer): ranked-slice via buildCpuUserBoard,
//   committed through the REAL board-commit core (buildBoardCommit) at
//   composition time — CPU boards can therefore never trigger the
//   finding-#5 Monday deferral; only real players' missing boards defer.
// - agent boards (6-pick layer): the deterministic fallback path, no model
//   call — the isCpu branch in produceGroupBoards (tournamentAgentBoards.js).
// - claims/flips: CPUs simply never call those endpoints — watch-not-
//   prevent (ruled); no guards added.
// - deploys: CPUs ride the same P4-gated fan-out; the battle-doc CPU/passive
//   marker is stamped at deploy — P4 contract #5, not P3b's.
//
// Imports the zero-import schema module from src/ under the revised June
// 2026 import rule (BUILD_RULES §4); the co-located test's real import of
// THIS module is the dependency-surface guard.

import {
  GROUP_SIZE,
  cpuUserId,
  cpuNFromUserId,
  cpuAgentDocId,
  cpuArchetypeForN,
  buildCpuUserBoard,
  TOURNAMENT_GROUPS_COLLECTION,
} from '../../src/constants/leagueTournament.js';
import { buildBoardCommit } from './tournamentBoards.js';
// Fenced module EXPORTS, called read-only — never edited (BUILD_RULES §1).
import { getArchetypeConfig, getArchetypeLabel } from './agentArchetypeConfig.js';

const LOG_PREFIX = '[TournamentCpu]';

/**
 * The CPU display label — ONE home for the format (P6a code review: the
 * leaderboard writer derives the same name for its rows; both sides read
 * this so a branding change can never split a CPU's identity across
 * surfaces). Pure.
 */
export function cpuAgentName(n) {
  return `CPU — ${getArchetypeLabel(cpuArchetypeForN(n))}`;
}

/**
 * The system agents doc for CPU n — the createAgent shape
 * (src/services/agentService.js:92) with neutral values and the two ratified
 * markers: ownerId 'cpu-{n}' and isCpu true. Pure.
 */
export function buildCpuAgentDoc(n, nowIso) {
  const archetype = cpuArchetypeForN(n);
  const cfg = getArchetypeConfig(archetype);
  return {
    ownerId: cpuUserId(n),
    isCpu: true,
    name: cpuAgentName(n),
    archetype,
    archetypeDrift: null,
    config: {
      risk: cfg?.defaultConfig?.risk ?? 50,
      concentration: cfg?.defaultConfig?.concentration ?? 50,
      momentum: cfg?.defaultConfig?.momentum ?? 50,
    },
    personality: { traits: ['system', 'steady'] },
    avatarColors: ['#64748b', '#94a3b8'],
    primaryColor: null,
    memory: [],
    consolidatedInsight: '',
    directives: [],
    activeRules: [],
    equippedBundleIds: [],
    equippedWatchlistId: null,
    equippedWatchlistName: null,
    equippedAt: null,
    starterKitCompleted: false,
    stats: { wins: 0, losses: 0, gamesPlayed: 0, totalScore: 0, avgScore: 0, currentStreak: 0, bestStreak: 0 },
    evolutionCycle: 0,
    createdAt: nowIso,
  };
}

/**
 * Lazy get-or-create for the system agents docs of the given CPU numbers.
 * Idempotent by deterministic doc id — an existing doc is never rewritten
 * (its archetype assignment is permanent by construction). Returns
 * {created: [n...], existing: [n...]}.
 */
export async function ensureCpuAgents(db, ns, nowIso) {
  const created = [];
  const existing = [];
  for (const n of ns) {
    const ref = db.collection('agents').doc(cpuAgentDocId(n));
    const snap = await ref.get();
    if (snap.exists) {
      existing.push(n);
      continue;
    }
    await ref.set(buildCpuAgentDoc(n, nowIso));
    created.push(n);
    console.log(`${LOG_PREFIX} created system agent ${cpuAgentDocId(n)} (${cpuArchetypeForN(n)})`);
  }
  return { created, existing };
}

/**
 * Commit the deterministic user boards for every CPU seat of a freshly
 * composed (forming) group — through the real board-commit core, so the
 * rider-#1 doc shape holds; marked isCpu for provenance. CPU seats and
 * their numbers are derived from the group itself (players[].isCpu — the
 * contract flag — and the one id codec, cpuNFromUserId), so call sites
 * cannot hand this function a stale or partial map. Idempotent per member:
 * an existing board doc is left alone. An unparseable CPU id is a LOUD
 * config error (returned in `failed`), never a silent skip — a silently
 * boardless CPU would later masquerade as a finding-#5 human deferral.
 */
export async function commitCpuUserBoards(db, group, nowIso) {
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(group.id);
  const committed = [];
  const skipped = [];
  const failed = [];
  for (const player of group.players || []) {
    if (player.isCpu !== true) continue;
    const odUserId = player.odUserId;
    const n = cpuNFromUserId(odUserId);
    if (n == null) {
      console.error(`${LOG_PREFIX} group ${group.id}: CPU seat '${odUserId}' has no parseable number — board NOT committed (id-codec drift; founder attention)`);
      failed.push(odUserId);
      continue;
    }
    const boardRef = groupRef.collection('boards').doc(odUserId);
    const snap = await boardRef.get();
    if (snap.exists) {
      skipped.push(odUserId);
      continue;
    }
    const commit = buildBoardCommit({
      group,
      odUserId,
      board: buildCpuUserBoard(group.userPool, n),
      prefillAsSuggested: [],
      now: nowIso,
    });
    await boardRef.set({ ...commit, isCpu: true });
    committed.push(odUserId);
  }
  return { committed, skipped, failed };
}

/**
 * Pad games (arrays of real advancer odUserIds, game order) to GROUP_SIZE
 * with sequentially numbered CPU seats — the j-th CPU seat across the
 * round's games gets cpu-{startN + j - 1}. Unique within the round by
 * construction (the one-active-battle-per-agent guard); reuse across rounds
 * is safe. Pure.
 *
 * Returns { seatsByGame: [[{odUserId, isCpu}]], cpuNs }.
 */
export function padGamesWithCpus(realIdsByGame, { startN = 1 } = {}) {
  let nextN = startN;
  const cpuNs = [];
  const seatsByGame = realIdsByGame.map((realIds) => {
    if (realIds.length > GROUP_SIZE) {
      throw new Error(`padGamesWithCpus: game has ${realIds.length} real seats (> ${GROUP_SIZE})`);
    }
    const seats = realIds.map(odUserId => ({ odUserId, isCpu: false }));
    while (seats.length < GROUP_SIZE) {
      seats.push({ odUserId: cpuUserId(nextN), isCpu: true });
      cpuNs.push(nextN);
      nextN++;
    }
    return seats;
  });
  return { seatsByGame, cpuNs };
}
