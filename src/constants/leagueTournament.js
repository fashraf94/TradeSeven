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
export const BASELINE_SOURCE = Object.freeze({
  DRAFT_RESOLUTION: 'draft_resolution',
  CLAIM_EXECUTION: 'claim_execution',
  FLIP_MARKET_OPEN: 'flip_market_open',
  FLIP_MARKET_CLOSED: 'flip_market_closed',
});

// Spec §1.2 — agentLedger entry provenance.
export const LEDGER_SOURCE = Object.freeze({
  DRAFT: 'draft',
  SWAP: 'swap',
});

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
export function createLeg({ direction = LEG_DIRECTION.LONG, baselinePrice = null, baselineSource, openedAt } = {}) {
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
 * - `players` are mapped to exactly `{odUserId, picks}` — `pickCategories`
 *   does not exist by construction (Spec §1.1: category system removed end
 *   to end). Empty `picks` is valid (pre-draft group).
 * - Exactly one of `bracketGameId` | `baseLayerWeek` must be provided (round
 *   metadata, Spec §1.1); the unpopulated key is omitted from the output.
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
  status = GROUP_STATUS.FORMING,
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
  if (now == null) {
    throw new Error('createTournamentGroupDoc: now is required (caller supplies the timestamp)');
  }
  return {
    status,
    roundNumber,
    ...(hasBracket ? { bracketGameId } : { baseLayerWeek }),
    groupMembers: ids,
    players: players.map(p => ({ odUserId: p.odUserId, picks: [...(p.picks ?? [])] })),
    userPool: [...userPool],
    claimSystem: createClaimSystemState(),
    dailyScores: {},
    createdAt: now,
    updatedAt: now,
  };
}
