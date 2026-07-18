// api/_utils/tournamentLobbyService.js
//
// P10a — the self-serve lobby service (founder-ruled June 13, 2026): the
// SYNCHRONOUS path from "register" to "in a forming group." Zero new cron
// (ruling 2): formation is an in-request call (formGroupFromLobby / quickPlay)
// the CALLER makes when a lobby fills to four humans (joinLobby / matchmakeJoin
// report `full`) or a creator starts now — the lobby-* endpoints (P10b) wire
// join→form; this module exposes the seating + formation primitives, it does
// not auto-form inside join. Any future auto-close rides an orchestrator
// branch, never a new slot. Server-side (Admin SDK); the deployed
// firestore.rules make tournamentLobby client-read-only, so every mutation
// flows through here.
//
// THE SEAM (P10 discovery finding #2): CPU padding (Ruling B1) had only ever
// been invoked by the bracket seeder and Friday round composition — both
// composing BRACKET groups. A self-serve lobby forms BASE-LAYER groups, so
// this is the FIRST path to pad a base-layer group. The padding PRIMITIVES are
// reused unchanged (padGamesWithCpus / ensureCpuAgents / commitCpuUserBoards —
// the seam-test battery proves the combination end to end: formation → Monday
// → banking → base-layer COMPLETE). Two seam facts the wiring must own that
// the bracket path got for free:
//
//   1. CPU-NUMBER UNIQUENESS ACROSS CONCURRENT GROUPS. The bracket path numbers
//      CPUs uniquely within a round (startN offset). Independently-formed
//      base-layer groups have no "round" — two solo registrations would each
//      grab cpu-1..3 and seat the SAME cpu-agent-1 in two ACTIVE battles
//      (the one-active-battle-per-agent constraint, tripped at deploy). So
//      formation reserves its CPU numbers from a TRANSACTIONAL global counter
//      (tournamentLobby/__cpuSequence), monotonic and disjoint per formation.
//   2. PRODUCTION SCOPE. A self-serve group is a PRODUCTION group — isDev is
//      NEVER set (finding #8). The production orchestrator excludes isDev
//      groups by default, so a lobby group correctly enters the Monday
//      pipeline; the dev seeders keep stamping isDev:true for their smokes.
//
// CRASH SHAPE: the group doc uses a DETERMINISTIC id (== the lobby id) and a
// get-or-create write, and the reserved CPU base is persisted on the lobby at
// claim — so an interrupted formation resumes with identical seats and
// recreates nothing (the advancement-path precedent).
//
// DEV-BRACKET CAVEAT (documented, watch item): dev-bracket smokes (isDev) also
// allocate cpu-agent-{n} starting at 1; they share the agent namespace with
// live lobby groups. The lobby counter is monotonic, so any overlap is a
// narrow window only if a founder runs a dev bracket smoke DURING live beta
// formation — founder-serialized in practice. Hard isolation (a counter start
// offset) is a one-line follow-up if ever wanted.
//
// Imports the zero-import schema module from src/ under the revised June 2026
// import rule (BUILD_RULES §4); the co-located test's real import of THIS
// module is the dependency-surface guard.

import {
  TOURNAMENT_LOBBY_COLLECTION,
  TOURNAMENT_GROUPS_COLLECTION,
  GROUP_SIZE,
  GROUP_STATUS,
  TOURNAMENT_TUNING,
  LOBBY_STATUS,
  LOBBY_MODE,
  LOBBY_MAX_HUMANS,
  LOBBY_JOIN_CODE_LEN,
  createLobbyDoc,
  createLobbyMember,
  createTournamentGroupDoc,
  lobbyHumanIds,
  lobbyHasMember,
  isoWeekString,
  BASELINE_POLICY,
} from '../../src/constants/leagueTournament.js';
import { LEAGUE_CANONICAL_OPEN_CAPTURE } from '../../src/config/featureFlags.js';
import { padGamesWithCpus, ensureCpuAgents, commitCpuUserBoards } from './tournamentCpu.js';
import { fetchRankedUserPool } from './tournamentGroupService.js';
import { findActiveGroupInBattleWeek, deriveBattleStartWeek, deriveBaseLayerWeek } from './liveDraftFormation.js';

const LOG_PREFIX = '[TournamentLobby]';

// The reserved allocator doc id in the lobby collection — server-only writer.
export const CPU_SEQUENCE_DOC_ID = '__cpuSequence';

// Unambiguous share-code alphabet (no 0/O/1/I/L) — the doc id stays the
// authoritative key; this is display/share convenience only.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function makeJoinCode() {
  let code = '';
  for (let i = 0; i < LOBBY_JOIN_CODE_LEN; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

function lobbyRef(db, lobbyId) {
  return db.collection(TOURNAMENT_LOBBY_COLLECTION).doc(lobbyId);
}

// ==================== CREATE ====================

/**
 * Create an OPEN lobby seated by its creator. A PRIVATE lobby carries a
 * shareable join code (the founder's invite-known-beta-users path); a
 * MATCHMAKING lobby is filled FIFO by matchmakeJoin. Returns { id, doc }.
 */
export async function createLobby(db, { createdBy, displayName = null, mode = LOBBY_MODE.MATCHMAKING, now = new Date() } = {}) {
  const nowIso = now.toISOString();
  const doc = createLobbyDoc({
    createdBy,
    displayName,
    mode,
    joinCode: mode === LOBBY_MODE.PRIVATE ? makeJoinCode() : null,
    baseLayerWeek: isoWeekString(now),
    now: nowIso,
  });
  const ref = db.collection(TOURNAMENT_LOBBY_COLLECTION).doc();
  await ref.set(doc);
  console.log(`${LOG_PREFIX} created ${mode} lobby ${ref.id} by ${createdBy}`);
  return { id: ref.id, doc };
}

// ==================== JOIN ====================

/**
 * Join one OPEN lobby by id (the private/share-link path), transactionally so
 * two racing joiners can never push it over LOBBY_MAX_HUMANS. Idempotent: a
 * member already seated is a no-op (never a duplicate seat). Returns
 * { id, lobby, joined, alreadyMember, full }. Throws lobby_not_found /
 * lobby_not_open / lobby_full.
 */
export async function joinLobby(db, lobbyId, { odUserId, displayName = null, now = new Date() } = {}) {
  const nowIso = now.toISOString();
  const ref = lobbyRef(db, lobbyId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('lobby_not_found');
    const lobby = snap.data();
    if (lobby.status !== LOBBY_STATUS.OPEN) throw new Error('lobby_not_open');
    if (lobbyHasMember(lobby, odUserId)) {
      return { id: lobbyId, lobby, joined: false, alreadyMember: true, full: lobby.members.length >= LOBBY_MAX_HUMANS };
    }
    if ((lobby.members || []).length >= LOBBY_MAX_HUMANS) throw new Error('lobby_full');
    const members = [...lobby.members, createLobbyMember({ odUserId, displayName, joinedAt: nowIso })];
    tx.update(ref, { members, updatedAt: nowIso });
    return { id: lobbyId, lobby: { ...lobby, members }, joined: true, alreadyMember: false, full: members.length >= LOBBY_MAX_HUMANS };
  });
}

/**
 * Matchmake (ruling 1 — pure FIFO fill-to-4): seat the player in the OLDEST
 * open matchmaking lobby with a free seat they aren't already in; if none,
 * open a fresh one. The where-query is status-only (no composite index); mode
 * + capacity + self-membership filter in memory, then a join transaction wins
 * or yields to a racer (full/closed → try the next). Returns the joinLobby
 * shape plus `created`.
 */
export async function matchmakeJoin(db, { odUserId, displayName = null, now = new Date() } = {}) {
  const snap = await db.collection(TOURNAMENT_LOBBY_COLLECTION)
    .where('status', '==', LOBBY_STATUS.OPEN)
    .get();
  const candidates = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.mode !== LOBBY_MODE.MATCHMAKING) return;
    if ((data.members || []).length >= LOBBY_MAX_HUMANS) return;
    if (lobbyHasMember(data, odUserId)) return; // already waiting here
    candidates.push({ id: d.id, createdAt: data.createdAt });
  });
  candidates.sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))); // FIFO

  for (const c of candidates) {
    try {
      const res = await joinLobby(db, c.id, { odUserId, displayName, now });
      if (res.joined || res.alreadyMember) return { ...res, created: false };
    } catch (err) {
      if (err.message === 'lobby_full' || err.message === 'lobby_not_open') continue; // raced — next
      throw err;
    }
  }
  const created = await createLobby(db, { createdBy: odUserId, displayName, mode: LOBBY_MODE.MATCHMAKING, now });
  return { id: created.id, lobby: created.doc, joined: true, alreadyMember: false, full: false, created: true };
}

/**
 * Resolve a shareable 6-char join code to its OPEN lobby — the P10b
 * typed/pasted private-invite path (founder ruling, June 13, 2026: the code,
 * not the 20-char doc id, is the beta share token). READS ONLY. The doc id
 * stays the authoritative key; this is a one-field lookup by the display code.
 * Codes are minted from an uppercase alphabet, so the lookup normalizes case.
 *
 * Returns { id, lobby } for the matching OPEN lobby, or **null** when no OPEN
 * lobby matches — an HONEST no-match: a typo'd / expired / already-formed code
 * resolves to null (never a throw), so the endpoint returns a clean 404 rather
 * than a 500. Only OPEN lobbies are joinable; a FORMING/FORMED/CANCELLED code
 * yields null (you cannot join a game that has already started).
 */
export async function findLobbyByJoinCode(db, code) {
  if (typeof code !== 'string' || code.trim().length === 0) return null;
  const normalized = code.trim().toUpperCase();
  const snap = await db.collection(TOURNAMENT_LOBBY_COLLECTION)
    .where('joinCode', '==', normalized)
    .get();
  let match = null;
  snap.forEach((d) => {
    if (match) return; // codes are effectively unique; take the first OPEN one
    const data = d.data();
    if (data.status === LOBBY_STATUS.OPEN) match = { id: d.id, lobby: data };
  });
  return match;
}

// ==================== FORMATION (THE SEAM) ====================

/**
 * Claim a lobby for formation, transactionally and resume-safely:
 *  - FORMED → return { alreadyFormed: true } (idempotent re-entry).
 *  - CANCELLED → throw.
 *  - FORMING → resume with the seat identities reserved on the prior claim.
 *  - OPEN → reserve the CPU number range from the global counter, stamp the
 *    deterministic groupId + cpuStartN, move to FORMING.
 * Reads (lobby, then counter) precede every write (Firestore tx contract).
 */
async function claimLobbyForFormation(db, lobbyId, nowIso) {
  const ref = lobbyRef(db, lobbyId);
  const seqRef = db.collection(TOURNAMENT_LOBBY_COLLECTION).doc(CPU_SEQUENCE_DOC_ID);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('lobby_not_found');
    const lobby = snap.data();

    if (lobby.status === LOBBY_STATUS.FORMED) return { lobby, alreadyFormed: true };
    if (lobby.status === LOBBY_STATUS.CANCELLED) throw new Error('lobby_cancelled');
    if (lobby.status === LOBBY_STATUS.FORMING) return { lobby, alreadyFormed: false }; // resume

    // OPEN → claim.
    const humanCount = (lobby.members || []).length;
    if (humanCount < 1) throw new Error('lobby_empty');
    if (humanCount > GROUP_SIZE) throw new Error('lobby_overfull');
    const cpuCount = GROUP_SIZE - humanCount;

    let cpuStartN = null;
    if (cpuCount > 0) {
      const seqSnap = await tx.get(seqRef);
      // The counter is a positive integer by construction; a non-positive or
      // non-integer value (corruption / manual seed) falls back to 1 so a
      // reserved base can never be 0 — cpuUserId(0) would throw and strand the
      // lobby in FORMING.
      const raw = seqSnap.exists ? seqSnap.data().next : null;
      const next = Number.isInteger(raw) && raw >= 1 ? raw : 1;
      cpuStartN = next;
      tx.set(seqRef, { next: next + cpuCount, updatedAt: nowIso });
    }
    const groupId = lobbyId; // deterministic 1:1 — crash-safe get-or-create
    tx.update(ref, { status: LOBBY_STATUS.FORMING, groupId, cpuStartN, updatedAt: nowIso });
    return { lobby: { ...lobby, status: LOBBY_STATUS.FORMING, groupId, cpuStartN }, alreadyFormed: false };
  });
}

/**
 * Form a real base-layer group from a lobby: pad the humans to four with CPUs
 * (reserved-number-based — seam fact #1), ensure the CPU system agents, create
 * the group doc at the deterministic id (isDev NEVER set — seam fact #2), and
 * commit the CPU user boards through the real board-commit core. The existing
 * forming→Monday→battle flow then takes over with zero further wiring.
 * Idempotent / resumable. `cpuNs` are the CPU pad seats created by THIS
 * formation (empty on an idempotent re-entry). Returns
 * { groupId, humanCount, cpuNs, alreadyFormed }.
 *
 * `isTraining` (default false — the omission idiom, League Next-Arc Slice 3.1)
 * threads straight into the createTournamentGroupDoc call below: a training pod
 * is just another base-layer group the existing deploy/banking process, but the
 * Slice 3.0 spine reads the flag to keep it off the leaderboard / career rank /
 * bracket. Stamped only at creation; an idempotent re-entry reuses the frozen doc.
 */
export async function formGroupFromLobby(db, lobbyId, { now = new Date(), isTraining = false } = {}) {
  const nowIso = now.toISOString();
  const { lobby, alreadyFormed } = await claimLobbyForFormation(db, lobbyId, nowIso);
  if (alreadyFormed) {
    // A FORMED lobby always carries its groupId (set at claim, before FORMED);
    // a missing one is corrupt state, surfaced rather than reported as success.
    if (!lobby.groupId) throw new Error('lobby_formed_without_group');
    return { groupId: lobby.groupId, humanCount: (lobby.members || []).length, cpuNs: [], alreadyFormed: true };
  }

  const humanIds = lobbyHumanIds(lobby);
  const groupId = lobby.groupId;       // deterministic (== lobbyId)
  const cpuStartN = lobby.cpuStartN;   // reserved at claim (null when 4 humans)

  // THE MIRROR GUARD (Entry-Flow Consolidation P4 — the slot-side ledger note
  // at liveDraftFormation.claimSlotSeat): reject formation when any seated
  // human already holds an active non-training group that plays the SAME battle
  // week this group would. The key is BATTLE-week-normalized — the same
  // deriveBattleStartWeek Monday-anchor rule the slot side uses — NEVER
  // isoWeekString(now): slot pods stamp baseLayerWeek as their battle week, so
  // a formation-week key would silently miss a Wed/Sat/Sun slot seat whose
  // battle is next Monday (the exact bug class the slot-side #1 fix corrected).
  // Sits AFTER the alreadyFormed early-return above, so idempotent re-entry of
  // an already-formed lobby is never blocked; exceptGroupId keeps a crash
  // resume of THIS group's own formation idempotent.
  //
  // COMPETITIVE ENTRIES ONLY: a TRAINING formation (formTrainingDraft →
  // quickPlay({isTraining:true}) → here) is never guarded — practice is
  // no-stakes and independent of competitive play, exactly as the predicate
  // itself never counts training pods as blockers. The guard is symmetric:
  // training neither blocks nor is blocked.
  if (!isTraining) {
    const battleWeek = deriveBaseLayerWeek(deriveBattleStartWeek(nowIso));
    for (const humanId of humanIds) {
      const conflict = await findActiveGroupInBattleWeek(db, humanId, battleWeek, groupId);
      if (conflict) {
        throw new Error(`already_in_competitive: ${humanId} already holds ${conflict} for battle week ${battleWeek}`);
      }
    }
  }

  // Pad to GROUP_SIZE from the RESERVED base so two concurrently-forming
  // lobbies can never seat the same cpu-agent (seam fact #1).
  const { seatsByGame, cpuNs } = padGamesWithCpus([humanIds], { startN: cpuStartN ?? 1 });
  const seats = seatsByGame[0];

  if (cpuNs.length > 0) await ensureCpuAgents(db, cpuNs, nowIso);

  // Get-or-create at the deterministic id (crash-safe). PRODUCTION group:
  // isDev is never set (seam fact #2). A RESUME reuses the group's own frozen
  // userPool, so the fresh-pool fetch + floor check happen ONLY when creating —
  // a later rankings shortfall can never strand an already-created group.
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  const existing = await groupRef.get();
  let groupDoc;
  if (existing.exists) {
    groupDoc = existing.data();
  } else {
    // Fresh full-universe pool (Spec §0.11). Floor = BOARD_DEPTH_MIN — CPU
    // boards commit through buildBoardCommit, which rejects boards under 15.
    const userPool = await fetchRankedUserPool(db);
    if (userPool.length < TOURNAMENT_TUNING.BOARD_DEPTH_MIN) {
      throw new Error(`universe_unavailable: stockRankings yielded ${userPool.length} names (< ${TOURNAMENT_TUNING.BOARD_DEPTH_MIN}) — rankings cron may not have run`);
    }
    groupDoc = createTournamentGroupDoc({
      players: seats.map(s => ({ odUserId: s.odUserId, picks: [], isCpu: s.isCpu })),
      userPool,
      roundNumber: 1,
      baseLayerWeek: isoWeekString(now),
      isTraining,
      status: GROUP_STATUS.FORMING,
      // Spec §1.1 — resolve the baseline policy ONCE from the flag at round
      // creation; omitted when off (readers default an absent stamp to legacy).
      ...(LEAGUE_CANONICAL_OPEN_CAPTURE ? { baselinePolicy: BASELINE_POLICY.CANONICAL_OPEN } : {}),
      now: nowIso,
    });
    await groupRef.set(groupDoc);
  }

  // CPU user boards (3-pick layer) through the real core; idempotent per
  // member. Humans commit their own during the forming window (or the Monday
  // deadline auto-commits — the orchestrator). A failed CPU board is a LOUD
  // config error, never a silent boardless CPU.
  const boards = await commitCpuUserBoards(db, { id: groupId, ...groupDoc }, nowIso);
  if (boards.failed.length > 0) {
    throw new Error(`cpu_board_commit_failed: ${boards.failed.join(', ')}`);
  }

  // Finalize the lobby (idempotent).
  await lobbyRef(db, lobbyId).update({ status: LOBBY_STATUS.FORMED, groupId, updatedAt: nowIso });

  console.log(`${LOG_PREFIX} formed base-layer group ${groupId} from lobby ${lobbyId}: ${humanIds.length} human(s) + ${cpuNs.length} CPU pad seat(s)`);
  return { groupId, humanCount: humanIds.length, cpuNs, alreadyFormed: false };
}

/**
 * Quick Play (the solo cold-start): open a private lobby and immediately form
 * a CPU-padded group — one human + three CPUs, playable from the next Monday.
 * `isTraining` (default false, the omission idiom) forms a no-stakes League
 * Next-Arc training pod instead (Slice 3.1): the same solo-seat composition and
 * the same Monday-start cadence, threaded through formGroupFromLobby into the
 * group doc — the Slice 3.0 spine then keeps it off the leaderboard / career
 * rank / bracket while it still banks its own daily closes.
 * Returns { lobbyId, groupId, humanCount, cpuNs }.
 */
export async function quickPlay(db, { odUserId, displayName = null, now = new Date(), isTraining = false } = {}) {
  const { id } = await createLobby(db, { createdBy: odUserId, displayName, mode: LOBBY_MODE.PRIVATE, now });
  const formed = await formGroupFromLobby(db, id, { now, isTraining });
  return { lobbyId: id, ...formed };
}
