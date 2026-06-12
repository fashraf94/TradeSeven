// api/admin/seed-tournament-bracket.js
//
// P3b — POST /api/admin/seed-tournament-bracket. Dev/smoke-test seeding for
// the FULL bracket arc: G round-1 groups (G a power of two; default 2 → a
// two-round bracket whose terminal round is the final four), game 1 seating
// the founder + 3 CPUs, every other game 4 CPUs — all CPU seats are REAL
// system-owned agents (Ruling B1) with deterministic user boards committed
// through the real board-commit core at seed time, so the only board the
// founder owes before "Run Monday duty" is their own (BoardEditor). The
// bracket doc is written at seed (same builder shape the Friday advancement
// upserts), so the dev bracket card renders immediately.
//
// NOT a production path: real round-1 composition awaits registration
// (founder-docketed); the P3b orchestrator owns rounds 2+.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret } from '../_utils/adminSecretAuth.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { fetchRankedUserPool } from '../_utils/tournamentGroupService.js';
import { ensureCpuAgents, commitCpuUserBoards, padGamesWithCpus } from '../_utils/tournamentCpu.js';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_BRACKETS_COLLECTION,
  TOURNAMENT_TUNING,
  GROUP_STATUS,
  buildBracketGameId,
  createBracketGame,
  createBracketDoc,
  createTournamentGroupDoc,
} from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 30 };

const MAX_GAMES = 4;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!requireAdminSecret(req, res)) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { founderUserId, games = 2 } = body;
  if (!isValidForgeId(founderUserId)) {
    return res.status(400).json({ error: 'invalid_founder_user_id', message: 'founderUserId is required (the signed-in uid).' });
  }
  if (!Number.isInteger(games) || games < 1 || games > MAX_GAMES || (games & (games - 1)) !== 0) {
    return res.status(400).json({ error: 'invalid_games', message: `games must be a power of two between 1 and ${MAX_GAMES}.` });
  }

  try {
    const db = getFirebaseAdmin();
    const nowIso = new Date().toISOString();
    const bracketId = `dev-bracket-${Date.now().toString(36)}`;

    const userPool = await fetchRankedUserPool(db);
    // Floor = BOARD_DEPTH_MIN, the deepest callee precondition (CPU boards
    // commit through buildBoardCommit, which rejects boards under 15 names).
    if (userPool.length < TOURNAMENT_TUNING.BOARD_DEPTH_MIN) {
      return res.status(503).json({
        error: 'universe_unavailable',
        message: `stockRankings yielded ${userPool.length} names (< ${TOURNAMENT_TUNING.BOARD_DEPTH_MIN}) — rankings cron may not have run.`,
      });
    }

    // Game 1: founder + 3 CPUs; every other game: 4 CPUs. CPU numbering is
    // sequential across the round (per-round uniqueness rule).
    const realIdsByGame = [[founderUserId], ...Array.from({ length: games - 1 }, () => [])];
    const { seatsByGame, cpuNs } = padGamesWithCpus(realIdsByGame, { startN: 1 });

    const cpuAgents = await ensureCpuAgents(db, cpuNs, nowIso);

    const round1Games = {};
    const groupIds = [];
    for (let i = 0; i < seatsByGame.length; i++) {
      const seats = seatsByGame[i];
      const gameIndex = i + 1;
      const bracketGameId = buildBracketGameId(bracketId, 1, gameIndex);
      // Deterministic group id == bracketGameId (the composition convention).
      const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(bracketGameId);
      const groupDoc = createTournamentGroupDoc({
        players: seats.map(s => ({ odUserId: s.odUserId, picks: [], isCpu: s.isCpu })),
        userPool,
        roundNumber: 1,
        bracketGameId,
        status: GROUP_STATUS.FORMING,
        now: nowIso,
      });
      // P4 companion (a): seeded groups are DEV groups — excluded from the
      // production orchestrator's duties (dev duty buttons include them).
      groupDoc.isDev = true;
      await groupRef.set(groupDoc);

      // CPU seats + numbers derive from the group doc itself (the contract
      // flag and the one id codec) — no map to keep in sync.
      const boards = await commitCpuUserBoards(db, { id: bracketGameId, ...groupDoc }, nowIso);
      if (boards.failed.length > 0) {
        return res.status(500).json({ error: 'cpu_board_commit_failed', message: `CPU boards failed for: ${boards.failed.join(', ')}` });
      }

      round1Games[bracketGameId] = createBracketGame({ bracketGameId, gameIndex, groupId: bracketGameId, seats });
      groupIds.push(bracketGameId);
    }

    await db.collection(TOURNAMENT_BRACKETS_COLLECTION).doc(bracketId)
      // P4 companion (a): the bracket carries isDev too, so Friday
      // advancement composes DEV round-2 groups (the flag inherits).
      .set({ ...createBracketDoc({ bracketId, round1Games, now: nowIso }), isDev: true });

    const cpuSeats = seatsByGame.flat().filter(s => s.isCpu).map(s => s.odUserId);
    console.log(`[Tournament] seed-tournament-bracket: ${bracketId} — ${games} game(s), ${cpuNs.length} CPU seat(s) (${cpuAgents.created.length} agent(s) created), pool ${userPool.length}`);
    return res.status(200).json({
      bracketId,
      groupIds,
      founderGroupId: groupIds[0],
      cpuSeats,
      cpuAgentsCreated: cpuAgents.created,
      poolSize: userPool.length,
    });
  } catch (err) {
    console.error('[Tournament] seed-tournament-bracket error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
}
