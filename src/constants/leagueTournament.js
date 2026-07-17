// src/constants/leagueTournament.js
//
// League Tournament — canonical schema constants and pure doc-shape factories
// for the `tournamentGroups` collection (Implementation Spec V1 §§1.1–1.2, §5;
// the spec lives at docs/FANTASYTRADES_LEAGUE_TOURNAMENT_IMPLEMENTATION_SPEC_V1.md).
//
// ZERO-IMPORT MODULE, BY RULE. Both the client (draft lobby, battle view) and
// `api/` consumers (claims branch, orchestrator — revised June 2026 import
// rule, BUILD_RULES §4) will read this module, so its transitive import
// surface must stay Node-clean. Zero imports makes that structural: this file
// can never pull in the client Firebase SDK or firebase-admin — which is also
// why the factories take timestamps as an opaque caller-supplied `now` (the
// two SDKs' timestamp sentinels differ). The co-located test enforces the
// zero-import invariant; do not add an import statement here.

// ==================== IDENTITY ====================

export const TOURNAMENT_GROUPS_COLLECTION = 'tournamentGroups';

// P2 (founder ruling, June 11, 2026): the agent held-set ledger lives in a
// SIBLING DOC — tournamentGroups/{groupId}/ledger/agentHeldSet — not on the
// group doc, exercising the relocation license recorded at P0. Rationale: the
// group doc has three transactional user-layer writers (flips, claims,
// banking); per-swap reserve/confirm transactions on the same document would
// contend with every one of them, while the sibling contends with nothing by
// construction. Server-side mutation only (api/_utils/tournamentAgentLedger.js);
// the P1a recursive subcollection rule (firestore.rules tournamentGroups
// {document=**} block) already grants spectators read access.
export const AGENT_LEDGER_SUBCOLLECTION = 'ledger';
export const AGENT_LEDGER_DOC_ID = 'agentHeldSet';

// P3a — the agent-board subcollection (rider #2) and the agent-draft stream
// doc (rider #3, agent side). Agent boards are keyed by agentId in their OWN
// subcollection — never mixed into the user `boards` subcollection, whose
// docs are keyed by odUserId (different key-space, different writer). The
// stream doc is the sibling of the P1a `streams/userDraft` record.
//
// SYNC WARNING: the P1a user-layer files reference 'streams' and 'boards'
// as string LITERALS (api/tournament/resolve-user-draft.js,
// api/admin/seed-tournament-group.js) — they predate these constants. A
// rename here without updating those literals splits the collections.
export const AGENT_BOARDS_SUBCOLLECTION = 'agentBoards';
export const STREAMS_SUBCOLLECTION = 'streams';
export const AGENT_DRAFT_STREAM_DOC_ID = 'agentDraft';
// P5 — the user-draft stream doc id, value matching the P1a string literals
// (see the SYNC WARNING above; the literals stay untouched, this constant is
// additive for the playback readers).
export const USER_DRAFT_STREAM_DOC_ID = 'userDraft';

// League Training Slice 2 — the interactive-draft live state. One sibling doc
// per pod at tournamentGroups/{id}/draft/state, client-readable under the
// deployed recursive subcollection rule; all writes stay Admin SDK (the
// training-pick endpoint + the lifecycle sweeps).
export const DRAFT_SUBCOLLECTION = 'draft';
export const DRAFT_STATE_DOC_ID = 'state';

/**
 * Battle-doc discriminator for tournament-mode agent battles (Spec §0.12 —
 * lets tournament eval ride the shared agent-evaluate cron). Sibling of the
 * legacy 'baggerbomb_agent' value on agentBattles docs
 * (api/_utils/agentBattleService.js:73 — fenced; read-only reference).
 * Consumed at P3/P4. Value ratified by founder, June 11, 2026.
 *
 * NOT stamped on tournamentGroups docs — there, the collection name is the
 * discriminator.
 */
export const TOURNAMENT_GAME_MODE = 'baggerbomb_tournament';

// ==================== GROUP SHAPE (Spec §0.9) ====================

export const GROUP_SIZE = 4;
export const PICKS_PER_PLAYER = 3;
export const USER_HELD_NAMES_PER_GROUP = GROUP_SIZE * PICKS_PER_PLAYER; // 12
export const AGENT_PICKS_PER_AGENT = 6; // the flat6 portfolio size (Spec §1.4 mode config)
export const AGENT_MARKET_SIZE = GROUP_SIZE * AGENT_PICKS_PER_AGENT; // 24

// Status vocabulary — 'battle' mirrors the legacy drafts collection's
// active-battle status (src/services/draftService.js:525), which the claims
// cron's eligibility query keys on. RATIFIED UNCHANGED at P1 (founder, June
// 11, 2026): 'drafting' is reserved for the P3 orchestrator's multi-step
// Monday sequence; P1's single-shot user-draft resolution transitions
// forming→battle atomically so a crash can never strand a group mid-state.
// Legal transitions live in api/_utils/tournamentGroupService.js.
export const GROUP_STATUS = Object.freeze({
  FORMING: 'forming',
  DRAFTING: 'drafting',
  // League Next-Arc Slice 1 (training, on-demand): a pod whose user draft is
  // resolved but whose five-day clock has NOT started — it waits here until the
  // next market open, then an orchestrator morning sweep flips it to 'battle'
  // (flipAwaitingOpenPods). Reached ONLY by the training on-demand path; ranked
  // groups never enter it, so every status-keyed consumer stays inert for them.
  AWAITING_OPEN: 'awaiting_open',
  BATTLE: 'battle',
  COMPLETE: 'complete',
});

export const LEG_DIRECTION = Object.freeze({
  LONG: 'long',
  SHORT: 'short',
});

// Leg baseline provenance — RATIFIED vocabulary (founder, June 11, 2026;
// closes the P0 free-form-string handoff). How each leg got its baseline:
// - DRAFT_RESOLUTION:  pick acquired in the Monday user draft; baselinePrice
//                      null at creation, settled at the next open (Spec §1.1).
// - CLAIM_EXECUTION:   pick acquired via an approved overnight claim at the
//                      pre-open pass; baselinePrice null until the open.
// - FLIP_MARKET_OPEN:  leg opened by a flip while the market was open;
//                      baselinePrice = the flip price, set immediately.
// - FLIP_MARKET_CLOSED: leg opened by a flip while the market was closed;
//                      baselinePrice null, settled at the next open.
// - CANONICAL_OPEN_CAPTURE: baseline settled to the round's canonical session
//                      open by the post-open capture sweep (Spec §1.1,
//                      canonical-open policy) — the SAME /real-time/ open the
//                      nightly banking pass settles from, captured live and
//                      frozen. Distinct from the nightly null-settle.
export const BASELINE_SOURCE = Object.freeze({
  DRAFT_RESOLUTION: 'draft_resolution',
  CLAIM_EXECUTION: 'claim_execution',
  FLIP_MARKET_OPEN: 'flip_market_open',
  FLIP_MARKET_CLOSED: 'flip_market_closed',
  CANONICAL_OPEN_CAPTURE: 'canonical_open_capture',
});

// Spec §1.1 — the baseline POLICY stamped on a tournamentGroups round doc at
// creation, resolved ONCE from LEAGUE_CANONICAL_OPEN_CAPTURE and never re-read
// as a mutable runtime flag — so a mid-round flag flip can't split policy
// across a cohort. LEGACY_OPEN_DEFER = today's behavior (null baseline settled
// at the nightly open). CANONICAL_OPEN = the post-open capture sweep settles the
// baseline to the round's canonical session open. Readers default an ABSENT
// stamp to LEGACY_OPEN_DEFER (older docs + flag-off paths).
export const BASELINE_POLICY = Object.freeze({
  LEGACY_OPEN_DEFER: 'legacy_open_defer',
  CANONICAL_OPEN: 'canonical_open',
});

// Spec §1.1 — a user leg's canonical-open CAPTURE state, written by the Phase-2
// post-open sweep (and, at Phase 3, voided by banking). null = legacy/unswept
// (today's behavior). PENDING_OPEN = swept but no eligible open yet (retried
// next arm). CAPTURED = baseline settled from the round's canonical open.
// NO_ELIGIBLE_OPEN = void set at banking when a leg never got an eligible open
// all session (Phase 3). This void is RECOVERABLE, not strictly terminal: if the
// symbol later opens and a snapshot is captured, a subsequent sweep/banking pass
// re-settles the leg CAPTURED — but ONLY from that shared immutable canonical
// snapshot, never a fresh/divergent fetch (tournamentBanking.js Case 2) — after
// which it is locked. A PENDING_OPEN leg must always carry a matching audit
// entry (canonicalCaptureLog); on log overflow the drop is counted durably
// (canonicalCaptureLogDropped) — fail-closed is never fail-invisible.
export const CAPTURE_STATE = Object.freeze({
  PENDING_OPEN: 'PENDING_OPEN',
  CAPTURED: 'CAPTURED',
  NO_ELIGIBLE_OPEN: 'NO_ELIGIBLE_OPEN',
});

// Spec §1.2 — agentLedger entry provenance.
export const LEDGER_SOURCE = Object.freeze({
  DRAFT: 'draft',
  SWAP: 'swap',
});

// ==================== BRACKET (P3b — founder-ratified June 12, 2026) ====================
//
// One document per bracket at tournamentBrackets/{bracketId} — the whole
// bracket in one read (the P6/P7 spectator surfaces and the P3b dev card
// subscribe to it). Server-write-only, like tournamentGroups (firestore.rules
// sibling block). Rounds and games are MAPS, not arrays: Firestore cannot
// dot-path into arrays, and the Friday advancement locks one game at a time;
// `roundNumber`/`gameIndex` carry ordering for renderers.

export const TOURNAMENT_BRACKETS_COLLECTION = 'tournamentBrackets';

export const BRACKET_STATUS = Object.freeze({
  ACTIVE: 'active',
  COMPLETE: 'complete',
});

/** Round map key: 'r1', 'r2', … */
export function bracketRoundKey(roundNumber) {
  return `r${roundNumber}`;
}

/**
 * The bracketGameId stored on BOTH the group doc and the bracket doc's game
 * entry: `{bracketId}-r{N}-g{M}` — group ↔ bracket navigation is a string
 * parse in either direction, no join.
 */
export function buildBracketGameId(bracketId, roundNumber, gameIndex) {
  return `${bracketId}-r${roundNumber}-g${gameIndex}`;
}

/** Inverse of buildBracketGameId. Returns {bracketId, roundNumber, gameIndex} or null. */
export function parseBracketGameId(bracketGameId) {
  if (typeof bracketGameId !== 'string') return null;
  const match = /^(.+)-r(\d+)-g(\d+)$/.exec(bracketGameId);
  if (!match) return null;
  return { bracketId: match[1], roundNumber: Number(match[2]), gameIndex: Number(match[3]) };
}

/**
 * One game entry (a group of four) in a bracket round. `seats` carry
 * {odUserId, isCpu} so spectator surfaces mark CPUs without reading group
 * docs. `finalScores`/`finalUserScores`/`advancers`/`completedAt` are null
 * until the Friday advancement locks the game (final-snapshot weekly scores:
 * composite via getWeeklyComposite, user-layer via getWeeklyScore — ruling
 * A-1, June 12, 2026).
 */
export function createBracketGame({ bracketGameId, gameIndex, groupId, seats } = {}) {
  if (typeof bracketGameId !== 'string' || !bracketGameId) {
    throw new Error('createBracketGame: bracketGameId is required');
  }
  if (!Number.isInteger(gameIndex) || gameIndex < 1) {
    throw new Error('createBracketGame: gameIndex must be a positive integer');
  }
  if (typeof groupId !== 'string' || !groupId) {
    throw new Error('createBracketGame: groupId is required');
  }
  if (!Array.isArray(seats) || seats.length !== GROUP_SIZE) {
    throw new Error(`createBracketGame: seats must be an array of exactly ${GROUP_SIZE}`);
  }
  return {
    bracketGameId,
    gameIndex,
    groupId,
    seats: seats.map(s => ({ odUserId: s.odUserId, isCpu: s.isCpu === true })),
    // P6a ruling A-1: finalScores hold the COMPOSITE weekly snapshots (the
    // score of record); finalUserScores keep the user-layer detail alongside.
    // sideEffectsAt is the advancement's completion record for the game's
    // rank/leaderboard finalization — written only after both landed clean;
    // null/absent means the resume paths still owe work.
    finalScores: null,
    finalUserScores: null,
    advancers: null,
    completedAt: null,
    sideEffectsAt: null,
  };
}

/** One round entry. `games` = {bracketGameId → createBracketGame}. */
export function createBracketRound({ roundNumber, games, composedAt } = {}) {
  if (!Number.isInteger(roundNumber) || roundNumber < 1) {
    throw new Error('createBracketRound: roundNumber must be a positive integer');
  }
  if (games == null || typeof games !== 'object' || Object.keys(games).length === 0) {
    throw new Error('createBracketRound: games map is required');
  }
  if (composedAt == null) {
    throw new Error('createBracketRound: composedAt is required');
  }
  return { roundNumber, games: { ...games }, composedAt, lockedAt: null };
}

/**
 * The tournamentBrackets document. Round-1 game count must be a power of two
 * (games halve each round: G groups → 2G advancers → G/2 groups), so
 * totalRounds = log2(G) + 1 — the terminal round is the round with exactly
 * ONE game (the final four); its top-1 is the champion. No bye concept at
 * V1: under-filled rounds are CPU-padded (Ruling B1), recorded per-seat via
 * seats[].isCpu. `recap.finalComposite` is the championship week's composite
 * — computed live by buildChampionRecap since P6a (the P3b backfill
 * contract, closed); null only on recaps written before P6a (dev data).
 */
export function createBracketDoc({ bracketId, round1Games, now } = {}) {
  if (typeof bracketId !== 'string' || !bracketId) {
    throw new Error('createBracketDoc: bracketId is required');
  }
  if (round1Games == null || typeof round1Games !== 'object') {
    throw new Error('createBracketDoc: round1Games map is required');
  }
  const gameCount = Object.keys(round1Games).length;
  if (gameCount < 1 || (gameCount & (gameCount - 1)) !== 0) {
    throw new Error(`createBracketDoc: round-1 game count must be a power of two (got ${gameCount})`);
  }
  if (now == null) {
    throw new Error('createBracketDoc: now is required (caller supplies the timestamp)');
  }
  return {
    bracketId,
    status: BRACKET_STATUS.ACTIVE,
    currentRound: 1,
    totalRounds: Math.log2(gameCount) + 1,
    slots: gameCount * GROUP_SIZE,
    rounds: {
      [bracketRoundKey(1)]: createBracketRound({ roundNumber: 1, games: round1Games, composedAt: now }),
    },
    champion: null,
    recap: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== CPU SYSTEM AGENTS (Ruling B1 — ratified June 12, 2026) ====================
//
// CPU seats are REAL system-owned agents (never the synthetic dev
// affordance): a flagged player entry `cpu-{n}` owning the agents doc
// `agents/cpu-agent-{n}` (deterministic id → get-or-create is idempotent and
// race-free; created lazily at group composition). Identity allocation is
// unique within a round — reusing one cpu-{n} in two concurrent games would
// trip the one-active-battle-per-agent constraint at P4 deploy time; reuse
// across rounds is safe (prior-round battles are completed).

export const CPU_USER_ID_PREFIX = 'cpu-';

export function cpuUserId(n) {
  if (!Number.isInteger(n) || n < 1) throw new Error('cpuUserId: n must be a positive integer');
  return `${CPU_USER_ID_PREFIX}${n}`;
}

export function isCpuUserId(odUserId) {
  return typeof odUserId === 'string' && odUserId.startsWith(CPU_USER_ID_PREFIX);
}

/**
 * Inverse of cpuUserId — co-located with its builder (the
 * parseBracketGameId precedent) so the id codec has ONE home.
 * Returns n, or null for anything that isn't a well-formed CPU id.
 */
export function cpuNFromUserId(odUserId) {
  if (!isCpuUserId(odUserId)) return null;
  const raw = odUserId.slice(CPU_USER_ID_PREFIX.length);
  if (!/^[1-9]\d*$/.test(raw)) return null;
  return Number(raw);
}

/** The agents-collection doc-id prefix for CPU system agents (`cpu-agent-{n}`). */
export const CPU_AGENT_ID_PREFIX = 'cpu-agent-';

/** The deterministic agents-collection doc id for CPU n. */
export function cpuAgentDocId(n) {
  if (!Number.isInteger(n) || n < 1) throw new Error('cpuAgentDocId: n must be a positive integer');
  return `${CPU_AGENT_ID_PREFIX}${n}`;
}

// League Training Slice 3 — the per-pod training-agent CLONE id codec. A
// player's training agent is a behavioral clone of their ranked agent with its
// OWN agentId (fence-free coexistence: the one-active-battle check is
// agentId-scoped). Per-pod (founder ruling): deterministic from groupId +
// odUserId, so the seat→agent resolver computes it directly with no ambiguous
// owner query (the cpuAgentDocId precedent). ownerId on the doc stays the
// player's, so composite banking (groupId+ownerId) counts the clone with zero
// changes; the doc carries isTrainingClone:true so every ranked owner-lookup
// can exclude it.
export const TRAINING_CLONE_ID_PREFIX = 'training-agent-';

export function trainingCloneDocId(groupId, odUserId) {
  if (typeof groupId !== 'string' || groupId.length === 0) throw new Error('trainingCloneDocId: groupId required');
  if (typeof odUserId !== 'string' || odUserId.length === 0) throw new Error('trainingCloneDocId: odUserId required');
  return `${TRAINING_CLONE_ID_PREFIX}${groupId}-${odUserId}`;
}

// Fixed assignment order (founder-ratified): any group of ≤4 consecutive
// CPUs fields four distinct archetypes, reproducible from the id alone.
// Values mirror api/_utils/archetypeScoring.js ARCHETYPE_WEIGHTS keys —
// string literals here by the zero-import rule (parity is test-locked).
export const CPU_ARCHETYPE_ORDER = Object.freeze([
  'momentum_chaser',
  'contrarian',
  'diversifier',
  'degen',
  'analyst',
  'guardian',
]);

export function cpuArchetypeForN(n) {
  if (!Number.isInteger(n) || n < 1) throw new Error('cpuArchetypeForN: n must be a positive integer');
  return CPU_ARCHETYPE_ORDER[(n - 1) % CPU_ARCHETYPE_ORDER.length];
}

/**
 * Deterministic CPU user board (the 3-pick layer): a ranked-pool slice at
 * offset (n-1)×PICKS_PER_PLAYER, depth BOARD_DEPTH_MIN, wrapping modulo pool
 * length — reproducible from the CPU id + pool alone; the 3-stagger collides
 * neighboring CPU boards so resolution produces real snipes (the seeder's
 * stagger precedent). Committed through the REAL board-commit core
 * (api/_utils/tournamentBoards.js buildBoardCommit), never the seeder path.
 */
export function buildCpuUserBoard(rankedPool, n) {
  if (!Array.isArray(rankedPool) || rankedPool.length === 0) {
    throw new Error('buildCpuUserBoard: rankedPool is required');
  }
  if (!Number.isInteger(n) || n < 1) throw new Error('buildCpuUserBoard: n must be a positive integer');
  const depth = Math.min(TOURNAMENT_TUNING.BOARD_DEPTH_MIN, rankedPool.length);
  const offset = ((n - 1) * PICKS_PER_PLAYER) % rankedPool.length;
  const board = [];
  for (let i = 0; i < depth; i++) {
    board.push(rankedPool[(offset + i) % rankedPool.length]);
  }
  return board;
}

// ==================== SELF-SERVE LOBBY (P10 — founder-ruled June 13, 2026) ====================
//
// The waiting room BEFORE a group exists. A tournamentGroups doc is born at
// EXACTLY GROUP_SIZE players (createTournamentGroupDoc throws otherwise), so a
// "filling" group can NOT be modeled as a partial group doc — the lobby is its
// own lightweight collection. Registration writes a lobby member; formation
// (FIFO fill-to-4, CPU-padded — Ruling B1) drains the lobby into a real
// base-layer group, and the existing forming→Monday→battle flow takes over
// UNCHANGED. Base-layer recomposition of completed players stays out of V1
// (re-register model — founder ruling, June 13, 2026).
//
// Server-write-only (api/_utils/tournamentLobbyService.js via the authed
// lobby-* endpoints); the deployed firestore.rules lobby block grants
// authenticated reads (the P10b "who's waiting" surface). Gated by
// LEAGUE_LOBBY_ENABLED (dark until beta).

export const TOURNAMENT_LOBBY_COLLECTION = 'tournamentLobby';

// A lobby never holds more humans than a group seats; the rest are CPU-padded
// at formation (Ruling B1) — so a single human always gets a playable four.
export const LOBBY_MAX_HUMANS = GROUP_SIZE; // 4

export const LOBBY_STATUS = Object.freeze({
  OPEN: 'open',           // accepting humans (the matchmaker fills it)
  FORMING: 'forming',     // formation claimed — the crash-safe resume window
  FORMED: 'formed',       // a base-layer group was created (terminal)
  CANCELLED: 'cancelled', // abandoned before forming (terminal)
});

export const LOBBY_MODE = Object.freeze({
  MATCHMAKING: 'matchmaking', // public; the matchmaker fills it FIFO
  PRIVATE: 'private',         // invite-only via the shareable joinCode
});

// Shareable private-lobby code length (display/share convenience; the lobby
// doc id stays the authoritative key).
export const LOBBY_JOIN_CODE_LEN = 6;

// Display-name cap on a stored lobby member (defense-in-depth; the endpoint
// also validates). User-authored text is sanitized at the render surface.
export const LOBBY_DISPLAY_NAME_MAX = 80;

/** One lobby member entry — FIFO join order, the creator first. Pure. */
export function createLobbyMember({ odUserId, displayName = null, joinedAt } = {}) {
  if (typeof odUserId !== 'string' || odUserId.length === 0) {
    throw new Error('createLobbyMember: odUserId is required');
  }
  if (joinedAt == null) {
    throw new Error('createLobbyMember: joinedAt is required (caller supplies the timestamp)');
  }
  const name = typeof displayName === 'string' && displayName.trim()
    ? displayName.trim().slice(0, LOBBY_DISPLAY_NAME_MAX)
    : null;
  return { odUserId, displayName: name, joinedAt };
}

/**
 * The tournamentLobby document (P10). `groupId` + `cpuStartN` are null until
 * formation is claimed; both are set then (the deterministic group id and the
 * RESERVED CPU base number) so an interrupted formation resumes with the same
 * seat identities — a crash can never double-allocate a cpu-agent. `now` is
 * required and opaque (this module never reads a clock). Pure.
 */
export function createLobbyDoc({
  createdBy, displayName = null, mode = LOBBY_MODE.MATCHMAKING,
  joinCode = null, baseLayerWeek, now,
} = {}) {
  if (typeof createdBy !== 'string' || createdBy.length === 0) {
    throw new Error('createLobbyDoc: createdBy is required');
  }
  if (!Object.values(LOBBY_MODE).includes(mode)) {
    throw new Error(`createLobbyDoc: invalid mode "${mode}"`);
  }
  if (typeof baseLayerWeek !== 'string' || baseLayerWeek.length === 0) {
    throw new Error('createLobbyDoc: baseLayerWeek is required');
  }
  if (now == null) {
    throw new Error('createLobbyDoc: now is required (caller supplies the timestamp)');
  }
  if (mode === LOBBY_MODE.PRIVATE && (typeof joinCode !== 'string' || joinCode.length === 0)) {
    throw new Error('createLobbyDoc: a private lobby requires a joinCode');
  }
  return {
    status: LOBBY_STATUS.OPEN,
    mode,
    ...(mode === LOBBY_MODE.PRIVATE ? { joinCode } : {}),
    createdBy,
    baseLayerWeek,
    members: [createLobbyMember({ odUserId: createdBy, displayName, joinedAt: now })],
    groupId: null,   // deterministic target group id — set at formation claim
    cpuStartN: null, // reserved CPU base number — set at formation claim (resume-safe)
    createdAt: now,
    updatedAt: now,
  };
}

/** The human odUserIds in join order (FIFO) — the formation seat source. Pure. */
export function lobbyHumanIds(lobby) {
  return (lobby?.members ?? []).map(m => m.odUserId);
}

/** Free human seats remaining (GROUP_SIZE − humans), never negative. Pure. */
export function lobbyOpenSeatCount(lobby) {
  return Math.max(0, GROUP_SIZE - (lobby?.members?.length ?? 0));
}

/** Is this human already seated in the lobby? (double-join idempotency). Pure. */
export function lobbyHasMember(lobby, odUserId) {
  return (lobby?.members ?? []).some(m => m.odUserId === odUserId);
}

/**
 * Pick the caller's ACTIVE (still-waiting) lobby from a set of lobby docs (the
 * basis for the client `subscribeMyLobby`). A lobby counts only while OPEN or
 * FORMING and the caller is a member; the most-recently-updated wins when more
 * than one matches. Returns the lobby doc or null. Pure — so the
 * lobby→group handoff is unit-tested without Firestore: the instant a lobby
 * reaches FORMED (its group now exists and surfaces via subscribeMyGroup), this
 * returns null and the group state takes over. `docs` are { id, ...lobby }.
 */
export function selectActiveLobby(docs, odUserId) {
  return (docs ?? [])
    .filter(l => (l?.status === LOBBY_STATUS.OPEN || l?.status === LOBBY_STATUS.FORMING) && lobbyHasMember(l, odUserId))
    .sort((a, b) => String(b?.updatedAt ?? '').localeCompare(String(a?.updatedAt ?? '')))[0] ?? null;
}

/**
 * Pick the caller's ACTIVE RANKED group from a set of their group docs (the
 * basis for the client `subscribeMyGroup`). A group counts only while FORMING
 * or BATTLE, the caller's membership is already guaranteed by the query, and —
 * the load-bearing addition for League Next-Arc training — it must NOT be a
 * training pod (`isTraining !== true`). Training pods share the
 * `tournamentGroups` collection and surface to the same member-scoped query, but
 * the ranked tab renders a matched group through the status-keyed ranked UI
 * (LeagueParticipantView), which would mis-render a training pod; excluding them
 * here is the safety prerequisite that keeps a live training BATTLE pod out of
 * the ranked read. Most-recently-updated wins when several match. Returns the
 * group doc or null. Pure — the exclusion is unit-tested without Firestore.
 * `docs` are { id, ...group }.
 */
export function selectMyGroup(docs) {
  return (docs ?? [])
    .filter(g => (g?.status === GROUP_STATUS.FORMING || g?.status === GROUP_STATUS.BATTLE) && g?.isTraining !== true)
    .sort((a, b) => String(b?.updatedAt ?? '').localeCompare(String(a?.updatedAt ?? '')))[0] ?? null;
}

/**
 * Pick the caller's ACTIVE TRAINING pod from a set of their group docs. ONE home
 * for the selection rule, used by BOTH the client re-entry read
 * (`subscribeMyTrainingPod`) AND the server `already_active` formation guard
 * (`findActiveTrainingPodForUser`) — so the "one active training pod at a time"
 * rule can never drift between the surface that offers re-entry and the guard
 * that blocks a second pod. A pod counts only when it IS a training pod
 * (`isTraining === true`) and is still in flight: DRAFTING, AWAITING_OPEN, or
 * BATTLE. COMPLETE is excluded, so the start CTA returns naturally once a pod
 * finishes (and an abandoned DRAFTING pod ages out via the server idle sweep).
 * Most-recently-updated wins. Returns the pod doc or null. Pure. `docs` are
 * { id, ...group }.
 */
export function selectMyTrainingPod(docs) {
  return (docs ?? [])
    .filter(g => g?.isTraining === true && (
      g?.status === GROUP_STATUS.DRAFTING ||
      g?.status === GROUP_STATUS.AWAITING_OPEN ||
      g?.status === GROUP_STATUS.BATTLE
    ))
    .sort((a, b) => String(b?.updatedAt ?? '').localeCompare(String(a?.updatedAt ?? '')))[0] ?? null;
}

// Over-fetch multiplier for the base-layer "field" read (subscribeBaseLayerGroups).
// Training pods share the tournamentGroups collection and match the same
// `baseLayerWeek ==` query, so a query-level `limit(max)` would let them consume
// field slots BEFORE the client can exclude them (a busy training week could crowd
// real base-layer groups out of the 12-doc window). We pull `max × this` by
// week+recency, drop training pods client-side (selectBaseLayerField), then take
// `max` — so training pods neither show NOR consume a slot. Read volume is trivial
// at this scale, and it avoids the query-level `where('isTraining','!=',true)`
// route, which would need a NEW composite index AND silently drop docs that omit
// the field. For the default 12-slot field this is a ~30-doc read window.
export const BASE_LAYER_FIELD_OVERFETCH = 2.5;

/**
 * Select the base-layer "field" (the leaderboard's THE FIELD surface) from a set
 * of weekly base-layer group docs — the pure predicate behind the client
 * `subscribeBaseLayerGroups`, and the direct mirror of the `selectMyGroup`
 * training exclusion. THE FIELD is base layer + bracket and INCLUDES CPUs by
 * design (absolute-score, harmless), but it must EXCLUDE training pods
 * (`isTraining !== true`): training pods share the `tournamentGroups` collection
 * and match the same `baseLayerWeek` query, so without this gate the viewer's
 * training seat + its CPUs leak into the leaderboard. Quick Play is base-layer
 * (`isTraining: false`) and STAYS — it counts. `!== true` (not `=== false`) so
 * docs that OMIT the flag (the createTournamentGroupDoc omission idiom) are
 * correctly treated as non-training — the same semantics selectMyGroup relies on.
 * Most-recently-updated first, then capped to `max` AFTER the training filter, so
 * the cap counts only real field groups (training pods never consume a slot); the
 * read over-fetches by BASE_LAYER_FIELD_OVERFETCH so this client filter has room
 * to work. Pure — the exclusion + cap are unit-tested without Firestore. `docs`
 * are { id, ...group }.
 */
export function selectBaseLayerField(docs, max = 12) {
  return (docs ?? [])
    .filter(g => g?.isTraining !== true)
    .sort((a, b) => String(b?.updatedAt ?? '').localeCompare(String(a?.updatedAt ?? '')))
    .slice(0, max);
}

// The group-doc `feed` array's retention cap, shared by every feed writer
// (the P1b rider-#4 flip feed and the P5 auto-commit entry) — one home so
// the writers can never drift (P5 code-review convergence).
export const GROUP_FEED_CAP = 50;

// ==================== P6a — COMPOSITE + LEADERBOARD + RANK IDENTITY ====================
//
// Founder rulings of record (June 12, 2026 — P6 Stage 0 §10):
// A-1 the composite IS the score of record (advancement, champion,
//     bracket finalScores), with the user-layer map kept as the
//     finalUserScores sibling; A-2 waiver priority STAYS user-layer (the
//     claim wire is a user-market mechanism — composite would let a hot
//     agent buy its human waiver position); A-3 a group-week belongs to the
//     ET month of its day-1 banking date; A-4 dev-sourced rows land in
//     dev-namespaced docs, production docs exclude isDev groups.

export const TOURNAMENT_LEADERBOARDS_COLLECTION = 'tournamentLeaderboards';
export const TOURNAMENT_RANKS_COLLECTION = 'tournamentRanks';

/** Two-decimal money-style rounding — ONE home (P6a code review: three
 * private copies converged; the pre-P6 copies elsewhere are P8-hygiene). */
export function round2(x) {
  return parseFloat((Number.isFinite(x) ? x : 0).toFixed(2));
}

/**
 * P7 — the CURRENT battle for one owner from a set of their daily-chained
 * agentBattles docs: the active battle wins; otherwise the most recent by
 * createdAt (ISO strings — lexicographic compare is chronological). ONE home so
 * the participant hook (useMyTournamentBattle) and the spectator endpoint
 * (pickCurrentBattlesByOwner) can never drift on the selection rule. Pure.
 */
export function pickCurrentTournamentBattle(battles) {
  let chosen = null;
  for (const b of battles || []) {
    if (!b) continue;
    if (!chosen) { chosen = b; continue; }
    const bActive = b.status === 'active';
    const curActive = chosen.status === 'active';
    if (bActive && !curActive) { chosen = b; continue; }
    if (curActive && !bActive) continue;
    if (String(b.createdAt || '') > String(chosen.createdAt || '')) chosen = b;
  }
  return chosen;
}

/**
 * THE one home for k (Spec §0.10): composite = agentScore + k × userScore.
 * Every composite in the system — banking snapshots, advancement locks,
 * leaderboard rows, rank inputs — comes through here.
 */
export function computeComposite(agentPoints, userPoints) {
  return (agentPoints || 0) + TOURNAMENT_TUNING.USER_LAYER_K * (userPoints || 0);
}

/**
 * THE ranking rule (ruling A-1 + the P1a tie-break): score desc, then the
 * caller-supplied order (draft order / seat order — identical by
 * construction, createTournamentGroupDoc builds both from one array).
 * ONE home for the comparator (P6a code review: four parallel copies
 * converged — lockTopTwo, the champion paths, the rank writer). Missing or
 * non-finite scores rank as 0 — callers that need stricter handling guard
 * before ranking (the rank writer refuses incomplete finalScores).
 */
export function rankByScores(scores, order) {
  const value = (id) => (Number.isFinite(scores?.[id]) ? scores[id] : 0);
  return [...(order || [])].sort((a, b) =>
    (value(b) - value(a)) || (order.indexOf(a) - order.indexOf(b)));
}

/** Month key for the seasonal leaderboard (ruling A-3): the ET month of a
 * 'YYYY-MM-DD' ET date string. Null for anything malformed. */
export function monthKeyFromEtDate(etDate) {
  if (typeof etDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(etDate)) return null;
  return etDate.slice(0, 7);
}

/** Leaderboard doc id (ruling A-4): the month key, dev-prefixed for
 * dev-group-sourced rows so smoke runs can never touch production docs. */
export function leaderboardDocId(monthKey, { dev = false } = {}) {
  return dev ? `dev-${monthKey}` : monthKey;
}

/** Rank doc id (ruling A-4 mirrored): the odUserId, dev-prefixed for
 * dev-group-sourced applications. */
export function rankDocId(odUserId, { dev = false } = {}) {
  return dev ? `dev-${odUserId}` : odUserId;
}

/** Shift a 'YYYY-MM' month key by `delta` months — the P6b leaderboard
 * surface's chevron nav. Pure; null for a malformed key. */
export function shiftMonthKey(monthKey, delta) {
  if (typeof monthKey !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return null;
  const [y, m] = monthKey.split('-').map(Number);
  const idx = (y * 12 + (m - 1)) + (delta | 0);
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}`;
}

/**
 * ISO-8601 week label (UTC), e.g. '2026-W24' — the `baseLayerWeek` key for
 * non-bracket groups. Pure: the caller supplies the date (this module never
 * reads a clock). Relocated here at P10 from the dev seeder under the
 * BUILD_RULES §4 one-home rule, so the lobby formation service and the dev
 * seeder share ONE definition.
 */
export function isoWeekString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('isoWeekString: a valid Date is required');
  }
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // nearest Thursday decides the year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ==================== CAREER RANK (founder-signed, June 12, 2026) ====================
//
// The tier ladder and RP math below are the FOUNDER-SIGNED table from the P6
// Stage 0 report §5 (the P4 calibration-table precedent): every value is a
// config entry, never code — recalibration is an edit here, nowhere else.
// V1 rank does NOT do: demotion below achieved floors, placement matches,
// decay, MMR/matchmaking input (V2.1 §11 post-launch).

export const RANK_TIERS = Object.freeze([
  Object.freeze({ tier: 1, name: 'Intern', floor: 0 }),
  Object.freeze({ tier: 2, name: 'Analyst', floor: 250 }),
  Object.freeze({ tier: 3, name: 'Associate', floor: 750 }),
  Object.freeze({ tier: 4, name: 'Strategist', floor: 1750 }),
  Object.freeze({ tier: 5, name: 'Desk Head', floor: 3500 }),
  Object.freeze({ tier: 6, name: 'Fund Manager', floor: 6500 }),
  Object.freeze({ tier: 7, name: 'Market Legend', floor: 11000 }),
]);

// Separate from TOURNAMENT_TUNING (whose exact shape is test-locked); same
// set-raw-and-watch posture (Spec §5).
export const RANK_TUNING = Object.freeze({
  RP_PER_POINT: 1.0,
  // Group-week placements 1st..4th (Spec §1.5's 100/66/33).
  PLACEMENT_BONUS: Object.freeze([100, 66, 33, 0]),
  HISTORY_CAP: 20,
});

// League Training Slice 2 — interactive-draft dials. Separate from
// TOURNAMENT_TUNING (whose exact shape is test-locked, above) — the RANK_TUNING
// precedent: training-only, set-raw-and-watch (Spec §5 posture). PICK_CLOCK_MS
// is the per-pick countdown pace (the urgent-vs-generous dial; client timer,
// the server idle-sweep is the tab-close backstop). DRAFT_IDLE_STALE_MS is the
// idle-sweep staleness threshold — set generously so a draft started in the
// same pre-open morning window as the sweep tick is never grabbed mid-session.
export const TRAINING_TUNING = Object.freeze({
  PICK_CLOCK_MS: 20000,
  DRAFT_IDLE_STALE_MS: 3 * 60 * 60 * 1000, // 3h
  // Slice 4 (claims): per-CPU, per-cycle probability of contesting the overnight
  // waiver wire (the legacy snake-draft heuristic's 0.40, ported to the flat
  // tournament pool). Raw-and-watch — dial it by feel, never test-locked here.
  CPU_CLAIM_PROBABILITY: 0.4,
});

/** The tier a given RP sits in: the highest tier whose floor is reached. */
export function tierForRp(rp) {
  const value = Number.isFinite(rp) ? rp : 0;
  let out = RANK_TIERS[0];
  for (const t of RANK_TIERS) {
    if (value >= t.floor) out = t;
  }
  return out;
}

/**
 * The CPU-farm guard (founder-signed B-2): positive RP is discounted by CPU
 * density among the OTHER three seats — 0 CPUs → 1.0, 1 → ⅔, 2 → ⅓,
 * 3 (fully padded) → 0. Signed with the conscious note that fully-padded
 * weeks earn zero positive RP at launch; revisit as a tuning entry only if
 * live feedback demands.
 */
export function cpuFarmGuard(cpuOpponents) {
  const n = Math.min(Math.max(Number.isFinite(cpuOpponents) ? cpuOpponents : 0, 0), GROUP_SIZE - 1);
  return 1 - n / (GROUP_SIZE - 1);
}

/**
 * One group-week's RP math (founder-signed B-2), returned WITH its audit
 * breakdown so writers persist exactly what was computed — never a parallel
 * re-derivation (the BUILD_RULES §4 local-copy bug class):
 *   raw   = weeklyComposite × RP_PER_POINT + PLACEMENT_BONUS[placement]
 *   guard = cpuFarmGuard(cpuOpponents)
 *   delta = raw > 0 ? raw × guard : raw
 * The guard discounts GAINS only — CPU padding can never shield a losing
 * week. Placement is 1-based (1..GROUP_SIZE).
 */
export function computeRankBreakdown({ weeklyComposite = 0, placement, cpuOpponents = 0 } = {}) {
  const bonus = RANK_TUNING.PLACEMENT_BONUS[(placement ?? GROUP_SIZE) - 1] ?? 0;
  const raw = weeklyComposite * RANK_TUNING.RP_PER_POINT + bonus;
  const guard = cpuFarmGuard(cpuOpponents);
  return { raw, guard, delta: raw > 0 ? raw * guard : raw };
}

/** The delta alone (the original signed signature, kept for direct callers). */
export function computeRankDelta(args) {
  return computeRankBreakdown(args).delta;
}

/**
 * The ratchet (founder-signed B-2), pure: within-tier RP slides freely on a
 * signed delta, but never below the highest ACHIEVED tier's floor (floors
 * are permanent) and never below 0 (no debt — V1.2 §7 carried). Crossing a
 * tier threshold permanently raises floorRp to that tier's floor.
 *
 * @param {{rp?: number, floorRp?: number, peakRp?: number}|null} state
 * @param {number} delta
 * @returns {{rp, tier, tierName, floorRp, peakRp}}
 */
export function applyRankWeek(state, delta) {
  const priorFloor = Math.max(state?.floorRp ?? 0, 0);
  const rp = round2(Math.max(priorFloor, 0, (state?.rp ?? 0) + (delta || 0)));
  const tier = tierForRp(rp);
  return {
    rp,
    tier: tier.tier,
    tierName: tier.name,
    floorRp: Math.max(priorFloor, tier.floor),
    peakRp: round2(Math.max(state?.peakRp ?? 0, rp)),
  };
}

/**
 * The DISPLAY-ONLY rank apply for CPU seats (founder ruling §7.1, June 12,
 * 2026): "CPUs never ratchet the career rank ladder. Rank means beating
 * humans, not bots." RP still moves on the signed delta so a CPU row reads
 * honestly (shown-but-frozen), but the floor NEVER climbs (`floorRp` pinned 0)
 * — so a CPU can never permanently achieve a tier, and the displayed `tier`
 * is purely a live reflection of its current RP, never a ratcheted floor.
 * The human ladder (applyRankWeek above) is untouched. Pure.
 */
export function applyRankWeekFrozen(state, delta) {
  const rp = round2(Math.max(0, (state?.rp ?? 0) + (delta || 0)));
  const tier = tierForRp(rp);
  return {
    rp,
    tier: tier.tier,
    tierName: tier.name,
    floorRp: 0, // never ratchets — a bot never locks in a tier
    peakRp: round2(Math.max(state?.peakRp ?? 0, rp)),
  };
}

/**
 * The career-rank progress view-model — the ratchet made legible for the P6b
 * rank surface: the current tier (by RP), the achieved permanent FLOOR tier,
 * the next tier + its floor, and the fraction of the way from this tier's
 * floor toward the next ("floor: Associate, climbing toward Strategist"). At
 * the top of the ladder, `withinTierPct` is 1 and the next-tier fields are
 * null. Pure; reads a rank doc's {rp, floorRp}.
 */
export function rankProgress(rank) {
  const rp = Number.isFinite(rank?.rp) ? rank.rp : 0;
  const floorRp = Number.isFinite(rank?.floorRp) ? rank.floorRp : 0;
  const tier = tierForRp(rp);
  const floorTier = tierForRp(floorRp);
  const next = RANK_TIERS.find(t => t.floor > rp) || null;
  const span = next ? next.floor - tier.floor : 0;
  const withinTierPct = next && span > 0
    ? Math.max(0, Math.min(1, (rp - tier.floor) / span))
    : 1;
  return {
    tier: tier.tier,
    tierName: tier.name,
    floorTierName: floorTier.name,
    nextTierName: next ? next.name : null,
    nextFloor: next ? next.floor : null,
    withinTierPct,
  };
}

// ==================== TUNING LEDGER (Spec §5) ====================

// Founder-set initial values. k (USER_LAYER_K) weights each user-layer point
// at aggregation: composite = agentScore + k × userScore (Spec §0.10).
export const TOURNAMENT_TUNING = Object.freeze({
  USER_LAYER_K: 1.5,
  FLIP_CAP_PER_DAY: 5,
  CLAIM_PENDING_CAP_PER_CYCLE: 3,
  BOARD_DEPTH_MIN: 15,
  BOARD_DEPTH_MAX: 20,
  PLAYBACK_MS_PER_PICK: 5000,
});

// ==================== FACTORIES ====================
//
// All factories are pure and deterministic: no I/O, no clock reads, no
// mutation of inputs. Invalid shapes throw — these guards are shape-level
// only; business rules (flip caps, claim resolution, scoring) are P1+ scope.

/**
 * claimSystem initial state — VERBATIM legacy shape (Spec §1.1: "shape
 * verbatim from the legacy system"). Initializers it mirrors:
 * src/services/draftService.js:534-538 and api/cron/snake-draft-autopick.js:323-327.
 *
 * `lastProcessedDay` is deliberately ABSENT: the legacy contract only writes
 * it after the first successful processing batch
 * (api/cron/process-draft-claims.js:99-113 documents the contract; first
 * write at :496). Pre-setting it would change isAlreadyProcessedForDay
 * semantics — the co-located test locks this with a real import of that
 * function.
 */
export function createClaimSystemState() {
  return {
    enabled: true,
    currentWaiverPriority: [],
    processingLog: [],
  };
}

/**
 * One leg of a user-layer pick (Spec §1.1). `closedAt` and `bankedScore` are
 * OMITTED, not null — they exist only once the leg is closed, matching the
 * lastProcessedDay only-exists-once-set convention and the removeUndefined
 * write ecosystem (src/services/draftService.js:544).
 *
 * `baselinePrice` may be null when the leg opens while the market is closed
 * (baseline = next open, Spec §1.1 flip rules); `baselineSource` must be a
 * BASELINE_SOURCE value (ratified June 11, 2026 — see that enum's comment).
 */
export function createLeg({
  direction = LEG_DIRECTION.LONG,
  baselinePrice = null,
  baselineSource,
  openedAt,
  // Canonical-open capture provenance (Spec §1.1 canonical-open policy). Inert
  // defaults — populated only by the post-open capture sweep (a later phase).
  baselineCapturedAt = null,
  baselinePriceTimestamp = null,
  captureJobId = null,
  baselineSession = null,
  instrumentId = null,
  // Phase 2 — the canonical-open capture lifecycle state (CAPTURE_STATE or null).
  // Default null = legacy/unswept; the sweep writes CAPTURED / PENDING_OPEN.
  captureState = null,
} = {}) {
  if (!Object.values(LEG_DIRECTION).includes(direction)) {
    throw new Error(`createLeg: invalid direction "${direction}"`);
  }
  if (!Object.values(BASELINE_SOURCE).includes(baselineSource)) {
    throw new Error(`createLeg: invalid baselineSource "${baselineSource}"`);
  }
  if (openedAt == null) {
    throw new Error('createLeg: openedAt is required');
  }
  if (baselinePrice !== null && !Number.isFinite(baselinePrice)) {
    throw new Error('createLeg: baselinePrice must be a finite number or null');
  }
  return {
    direction,
    baselinePrice,
    baselineSource,
    openedAt,
    thresholdHistory: [],
    // Present-null (like baselinePrice), NOT omitted — these are baseline
    // provenance, not closed-state lifecycle keys (closedAt/bankedScore).
    baselineCapturedAt,
    baselinePriceTimestamp,
    captureJobId,
    baselineSession,
    instrumentId,
    captureState,
  };
}

/**
 * Per-pick state: symbol + leg list + daily flip counter (Spec §1.1).
 * Symbol is uppercased on the way in (legacy precedent:
 * src/services/draftService.js:554).
 */
export function createPickState({ symbol, direction, baselinePrice, baselineSource, openedAt } = {}) {
  if (typeof symbol !== 'string' || symbol.trim().length === 0) {
    throw new Error('createPickState: symbol is required');
  }
  return {
    symbol: symbol.trim().toUpperCase(),
    legs: [createLeg({ direction, baselinePrice, baselineSource, openedAt })],
    flipCountToday: 0,
  };
}

/**
 * One per-symbol canonical-open snapshot entry, stored under a round doc's
 * `canonicalOpens` map (Spec §1.1 canonical-open policy). The captured value is
 * the round's official session open, sourced from the SAME
 * `fetchBatchQuotes(...).open` (EODHD /real-time/ item.open) the banking pass
 * settles from — captured once post-open and frozen, so the score of record is
 * immutable for the round. Pure; the server capture util (api/_utils/
 * canonicalOpen.js) builds + writes it.
 *
 * `open` MUST be a finite positive number (a real session open); a null/absent
 * open means "no eligible open yet" and is NOT stored (the leg stays
 * PENDING_OPEN and is retried on the next sweep). `capturedAt` is the caller's
 * ISO timestamp; `priceTimestamp` is the vendor open's as-of time.
 */
export function createCanonicalOpenEntry({
  open,
  capturedAt,
  priceTimestamp = null,
  captureJobId = null,
  session = null,
  instrumentId = null,
} = {}) {
  if (!Number.isFinite(open) || open <= 0) {
    throw new Error('createCanonicalOpenEntry: open must be a finite positive number');
  }
  if (typeof capturedAt !== 'string' || capturedAt.length === 0) {
    throw new Error('createCanonicalOpenEntry: capturedAt (ISO string) is required');
  }
  return {
    open,
    capturedAt,
    priceTimestamp,
    captureJobId,
    session,
    instrumentId,
  };
}

// ==================== DAILY-SCORES READ HELPERS (P1b) ====================
//
// Pure, zero-import (module rule above). Shared by api/ banking + claims and
// the client standings surface — the one legal home for both sides.

/**
 * The latest banked day entry: highest /^day(\d+)$/ key in dailyScores.
 * @returns {{dayN: number, entry: Object}|null} null before the first banking.
 */
export function getLatestDayEntry(group) {
  const dailyScores = group?.dailyScores || {};
  let dayN = 0;
  let entry = null;
  for (const key of Object.keys(dailyScores)) {
    const match = /^day(\d+)$/.exec(key);
    if (!match) continue;
    const n = Number(match[1]);
    if (n > dayN) {
      dayN = n;
      entry = dailyScores[key];
    }
  }
  return entry ? { dayN, entry } : null;
}

/**
 * Weekly score = the FINAL day's snapshot (founder ruling, June 11, 2026 —
 * P1a PR decisions register): totalPoints is the CUMULATIVE standing at each
 * close, so the week's result IS the last snapshot — NEVER a sum over days.
 * The co-located test proves this against the sum.
 */
export function getWeeklyScore(group, odUserId) {
  return getLatestDayEntry(group)?.entry?.closeScores?.[odUserId]?.totalPoints ?? 0;
}

/**
 * Weekly COMPOSITE = the final day's compositePoints snapshot (ruling A-1 —
 * the score of record; same final-snapshot-never-a-sum identity as
 * getWeeklyScore). Snapshots banked before P6 (dev data only) carry no
 * compositePoints — degrade by deriving from whatever the entry holds
 * (absent agentPoints → k × user layer), never by guessing.
 */
export function getWeeklyComposite(group, odUserId) {
  const entry = getLatestDayEntry(group)?.entry?.closeScores?.[odUserId];
  if (!entry) return 0;
  if (Number.isFinite(entry.compositePoints)) return entry.compositePoints;
  return computeComposite(entry.agentPoints ?? 0, entry.totalPoints ?? 0);
}

/** The ruled week-complete check (P3b Friday duty; the holiday-week edge is
 * documented in tournamentAdvancement.js). Hoisted here at P6a so the
 * leaderboard writer and the advancement share ONE definition —
 * tournamentAdvancement.js re-exports both names unchanged. */
export const WEEK_DAYS_REQUIRED = 5;

export function isWeekBanked(group) {
  return (getLatestDayEntry(group)?.dayN || 0) >= WEEK_DAYS_REQUIRED;
}

/**
 * §7.2 (founder ruling, June 12, 2026): a week whose FINAL banked snapshot
 * carries the banking degrade marker (`agentScoresCarried` — the agent layer
 * was carried/zeroed, not freshly read) must NOT lock. The composite of
 * record may be missing agent-layer points, and the bracket lock is permanent
 * — so the irreversible decision waits for a clean (non-carried) agent-layer
 * read, which the next banking pass self-heals. Pure; the advancement gates
 * every `lockTopTwo`/finalization site on the negation of this.
 */
export function isFinalSnapshotDegraded(group) {
  return getLatestDayEntry(group)?.entry?.agentScoresCarried === true;
}

/**
 * The group's current trading day (1-based), derived from the banking record
 * — tournament groups carry no battleStartDate, and the banking pass is
 * dailyScores' only writer. If the latest entry was banked today (ET), today
 * IS that day; otherwise today is the next one. This reproduces the legacy
 * getCurrentTradingDay value in every claim-window case: evenings
 * post-banking read N, evenings pre-banking and mornings read N(+1).
 *
 * @param {Object} group
 * @param {string} etDate - today's ET calendar date 'YYYY-MM-DD'
 *   (api/_utils/tournamentTime.js formatEtDate — passed in; this module
 *   never reads a clock)
 */
export function deriveCurrentTradingDay(group, etDate) {
  const latest = getLatestDayEntry(group);
  if (!latest) return 1;
  return latest.entry?.recordedDate === etDate ? latest.dayN : latest.dayN + 1;
}

/**
 * The agent held-set ledger document (Spec §1.2), at
 * tournamentGroups/{groupId}/ledger/agentHeldSet (P2 ruling — see the
 * AGENT_LEDGER_* constants above).
 *
 * - `held`: `{symbol → createAgentLedgerEntry}` — the exclusivity ground
 *   truth, derived-rebuildable from the group's tournament battles (nightly
 *   reconciliation in api/_utils/tournamentAgentLedger.js).
 * - `reservations`: `{symbol → {by, battleId, at}}` — the two-phase
 *   reserve/confirm protocol's in-flight claims. A reservation is STALE once
 *   older than the TTL exported by tournamentAgentLedger.js; stale
 *   reservations are claimable and reconciliation-cleared, so a crash
 *   between reserve and swap can never deadlock a symbol.
 * - `doubleDowns`: capped event list, written atomically inside the confirm
 *   transaction (Signal Capture pattern A — awaited in-request; Spec §2's
 *   derived flag, agent half).
 * - `now` is required and opaque (this module never reads a clock).
 */
export function createAgentLedgerDoc({ now } = {}) {
  if (now == null) {
    throw new Error('createAgentLedgerDoc: now is required (caller supplies the timestamp)');
  }
  return {
    held: {},
    reservations: {},
    doubleDowns: [],
    updatedAt: now,
  };
}

/**
 * One held-set entry (Spec §1.2): `{symbol → {heldBy, since, source}}`.
 */
export function createAgentLedgerEntry({ heldBy, since, source } = {}) {
  if (typeof heldBy !== 'string' || heldBy.length === 0) {
    throw new Error('createAgentLedgerEntry: heldBy is required');
  }
  if (since == null) {
    throw new Error('createAgentLedgerEntry: since is required');
  }
  if (!Object.values(LEDGER_SOURCE).includes(source)) {
    throw new Error(`createAgentLedgerEntry: invalid source "${source}"`);
  }
  return { heldBy, since, source };
}

/**
 * The tournamentGroups document (Spec §1.1).
 *
 * - `players` are mapped to exactly `{odUserId, picks}` (+ `isCpu: true` on
 *   CPU seats — Ruling B1, ratified June 12, 2026; omitted when false, the
 *   codebase's omission idiom) — `pickCategories` does not exist by
 *   construction (Spec §1.1: category system removed end to end). Empty
 *   `picks` is valid (pre-draft group). The isCpu flag is the contract for
 *   every downstream row (bracket seats, P6 aggregation/leaderboard); the
 *   `cpu-` id prefix is a readable secondary signal only.
 * - Exactly one of `bracketGameId` | `baseLayerWeek` must be provided (round
 *   metadata, Spec §1.1); the unpopulated key is omitted from the output.
 * - `isTraining: true` marks a no-stakes League Next-Arc training pod (Spec
 *   §5): it banks its own daily closes like any group but is EXCLUDED from the
 *   seasonal leaderboard, career rank, and the bracket/cut. Omitted when false
 *   (the omission idiom, like `isCpu`). A training pod still carries a
 *   `baseLayerWeek` (the XOR holds) — the exclusion keys on the flag, not the
 *   round metadata.
 * - `dailyScores` inner keying — RATIFIED (founder, June 11, 2026):
 *   dailyScores.day{N} = { closeScores: { [odUserId]: { totalPoints, picks } },
 *   recordedAt, recordedBy } — the legacy day{N} inner shape verbatim
 *   (api/cron/snake-draft-daily-scores.js:283-297) under the Spec §1.1
 *   top-level name, so the tournament waiver fallback differs from the legacy
 *   one (process-draft-claims.js:242-258, which reads dailyData) by exactly
 *   one field path. SCORING MODEL (founder correction, June 11, 2026 —
 *   recorded in the P1a PR decisions register): totalPoints is the CUMULATIVE
 *   standing at that day's close; the weekly score is the FINAL day's
 *   snapshot, not a sum over days. The P1b banking pass is the only writer.
 * - The agent held-set ledger does NOT live on this document. P0 placed an
 *   `agentLedger` field here with an explicit relocation license; P2
 *   exercised it (founder ruling, June 11, 2026) — the ledger is the sibling
 *   doc tournamentGroups/{groupId}/ledger/agentHeldSet (createAgentLedgerDoc),
 *   keeping per-swap reserve/confirm transactions off the user-layer
 *   writers' document.
 * - `now` is required and opaque (ISO string or SDK timestamp sentinel) —
 *   this module never reads a clock.
 */
export function createTournamentGroupDoc({
  players,
  userPool,
  roundNumber,
  bracketGameId = null,
  baseLayerWeek = null,
  isTraining = false,
  status = GROUP_STATUS.FORMING,
  // Spec §1.1 canonical-open policy — resolved ONCE from the flag at the
  // round-creation call site. Omission idiom: absent when null (flag-off /
  // callers that don't pass it), so today's doc shape is byte-identical.
  baselinePolicy = null,
  now,
} = {}) {
  if (!Array.isArray(players) || players.length !== GROUP_SIZE) {
    throw new Error(`createTournamentGroupDoc: players must be an array of exactly ${GROUP_SIZE}`);
  }
  const ids = players.map(p => p?.odUserId);
  if (ids.some(id => typeof id !== 'string' || id.length === 0)) {
    throw new Error('createTournamentGroupDoc: every player needs a non-empty odUserId');
  }
  if (new Set(ids).size !== GROUP_SIZE) {
    throw new Error('createTournamentGroupDoc: player odUserIds must be unique');
  }
  for (const p of players) {
    if (p.picks != null && (!Array.isArray(p.picks) || p.picks.length > PICKS_PER_PLAYER)) {
      throw new Error(`createTournamentGroupDoc: picks must be an array of at most ${PICKS_PER_PLAYER}`);
    }
  }
  if (!Array.isArray(userPool)) {
    throw new Error('createTournamentGroupDoc: userPool must be an array');
  }
  if (!Number.isInteger(roundNumber) || roundNumber < 1) {
    throw new Error('createTournamentGroupDoc: roundNumber must be a positive integer');
  }
  const hasBracket = bracketGameId != null;
  const hasBaseWeek = baseLayerWeek != null;
  if (hasBracket === hasBaseWeek) {
    throw new Error('createTournamentGroupDoc: provide exactly one of bracketGameId | baseLayerWeek');
  }
  if (!Object.values(GROUP_STATUS).includes(status)) {
    throw new Error(`createTournamentGroupDoc: invalid status "${status}"`);
  }
  if (baselinePolicy != null && !Object.values(BASELINE_POLICY).includes(baselinePolicy)) {
    throw new Error(`createTournamentGroupDoc: invalid baselinePolicy "${baselinePolicy}"`);
  }
  if (now == null) {
    throw new Error('createTournamentGroupDoc: now is required (caller supplies the timestamp)');
  }
  return {
    status,
    roundNumber,
    ...(hasBracket ? { bracketGameId } : { baseLayerWeek }),
    ...(isTraining === true ? { isTraining: true } : {}),
    ...(baselinePolicy != null ? { baselinePolicy } : {}),
    groupMembers: ids,
    players: players.map(p => ({
      odUserId: p.odUserId,
      picks: [...(p.picks ?? [])],
      ...(p.isCpu === true ? { isCpu: true } : {}),
    })),
    userPool: [...userPool],
    claimSystem: createClaimSystemState(),
    dailyScores: {},
    createdAt: now,
    updatedAt: now,
  };
}
