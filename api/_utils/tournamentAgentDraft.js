// api/_utils/tournamentAgentDraft.js
//
// P3a — agent draft resolution (Spec §1.3; Signal Capture rider #3, agent
// side). Ledger-aware deterministic snake over the four agents' pre-committed
// boards (agentBoards subcollection, produced by tournamentAgentBoards.js):
//
//   availability = full catalog
//                  minus ledger-held / freshly-reserved symbols
//                  minus names already drafted this resolution
//                  minus RIVAL players' user-layer picks.
//
// OWN player's user picks stay available to the own agent ONLY — the drafted
// double-down (Spec §1.3, restated from §0.9's max-two-holders rule: one
// user + one agent, same player). Board exhaustion falls back to the
// highest-ranked still-available name in that agent's ARCHETYPE ranking
// (V2.1 §5's deterministic-fallback pattern, agent side — the user draft
// falls back to the ranked pool the same way).
//
// The pick-by-pick stream (streams/agentDraft) is the playback record P5
// consumes: passedOver carries the sniped-board shifts, shape-parity with
// the P1a user stream. The stream write is a single awaited transaction
// (rider #3); THEN `reserveBulk` lands all 24 names as held/'draft' — the
// Spec §0.1 reserve-before-deploy sequencing. A crash between the two is
// healed by the ensure-acquisition path: a re-run finds the stream, re-runs
// the idempotent reserveBulk from it, and never re-resolves.
//
// WHICH RECORD IS CANONICAL FOR WHAT (P3b consumes both — don't conflate):
// - streams/agentDraft.picksByAgent is THE RESOLUTION RECORD — what the
//   draft decided; the P3b Monday deploy's prescribed six reads from here.
// - ledger/agentHeldSet is the AVAILABILITY INDEX — derived-rebuildable,
//   nightly-reconciled; candidate filtering reads from here.
// - Once battles exist, BATTLE DOCS are ground truth (P2's reconciliation
//   arbitrates the ledger from them; the stream is never rewritten).
//
// SCOPE OF THE RIVAL-PICK BLOCK (deliberate asymmetry — do not "fix"): a
// rival player's user picks are blocked AT THE DRAFT only (Spec §1.3).
// Intraday swaps are NOT cross-checked against user picks — dual markets
// carry no cross-market checks (V2.1 §2), and a rival agent swapping into
// your user pick mid-week is the designed cross-layer duel storyline.
//
// Imports the zero-import schema module from src/ under the revised June
// 2026 import rule (BUILD_RULES §4); the co-located test's real import of
// THIS module is the dependency-surface guard.

import {
  TOURNAMENT_GROUPS_COLLECTION,
  AGENT_BOARDS_SUBCOLLECTION,
  STREAMS_SUBCOLLECTION,
  AGENT_DRAFT_STREAM_DOC_ID,
  GROUP_STATUS,
  GROUP_SIZE,
  AGENT_PICKS_PER_AGENT,
  AGENT_MARKET_SIZE,
  USER_HELD_NAMES_PER_GROUP,
} from '../../src/constants/leagueTournament.js';
import { readLedger, reserveBulk, isReservationStale } from './tournamentAgentLedger.js';
import { computeArchetypeRankings } from './archetypeScoring.js';
import { toIso } from './tournamentTime.js';

const LOG_PREFIX = '[TournamentAgentDraft]';

export const DRAFT_SENTINEL_PREFIX = '__resolve_agent_draft:';

function sentinel(code, detail) {
  const err = new Error(DRAFT_SENTINEL_PREFIX + code);
  err.detail = detail;
  return err;
}

/**
 * Pure deterministic ledger-aware snake resolution. Exported for tests; the
 * handler path below is read + persistence.
 *
 * @param {Object} group - tournamentGroups doc data (status 'battle', user
 *   picks resolved — the rival-pick blocks derive from players[].picks)
 * @param {Array<{agentId, odUserId}>} agents - draft seats in groupMembers
 *   order (snake: round 1 fwd, round 2 rev, ...)
 * @param {Object} boardsByAgent - agentId -> { board: [ranked symbols] }
 * @param {Set<string>} heldSymbols - ledger-held + freshly-reserved symbols
 *   (unavailable to everyone this resolution)
 * @param {Object} fallbackRankingByAgent - agentId -> [archetype-ranked
 *   symbols] for board exhaustion
 * @returns {{ picksByAgent: Object, events: Array }}
 */
export function resolveAgentSnakeDraft({ group, agents, boardsByAgent, heldSymbols = new Set(), fallbackRankingByAgent = {} }) {
  if (!group) throw sentinel('group_not_found');
  if (group.status !== GROUP_STATUS.BATTLE) throw sentinel('not_battle', `status is '${group.status}'`);
  if (!Array.isArray(agents) || agents.length !== GROUP_SIZE) {
    throw sentinel('boards_missing', `need ${GROUP_SIZE} seated agents, got ${agents?.length ?? 0}`);
  }
  const missing = agents.filter(a => !Array.isArray(boardsByAgent?.[a.agentId]?.board) || boardsByAgent[a.agentId].board.length === 0);
  if (missing.length > 0) {
    throw sentinel('boards_missing', `missing boards: ${missing.map(a => a.agentId).join(', ')}`);
  }

  // Rival-pick blocks: a player's user-layer picks are off-limits to every
  // agent except their own (the double-down stays open — dual markets).
  const picksByPlayer = new Map(
    (group.players || []).map(p => [p.odUserId, new Set((p.picks || []).map(pick => pick.symbol))])
  );

  const taken = new Set();
  const picksByAgent = Object.fromEntries(agents.map(a => [a.agentId, []]));
  const events = [];
  let pickNumber = 0;

  const isBlockedFor = (odUserId, symbol) => {
    if (taken.has(symbol) || heldSymbols.has(symbol)) return true;
    for (const [playerId, picks] of picksByPlayer) {
      if (playerId !== odUserId && picks.has(symbol)) return true;
    }
    return false;
  };

  for (let round = 1; round <= AGENT_PICKS_PER_AGENT; round++) {
    const order = round % 2 === 1 ? agents : [...agents].reverse();
    for (const { agentId, odUserId } of order) {
      pickNumber++;
      const board = boardsByAgent[agentId].board;
      const own = picksByAgent[agentId];

      let symbol = null;
      let boardRank = null;
      const passedOver = [];
      for (let rank = 0; rank < board.length; rank++) {
        const candidate = board[rank];
        // Own earlier picks advance the board pointer silently (the user-
        // draft precedent); everything else unavailable is a recorded pass.
        if (own.includes(candidate)) continue;
        if (isBlockedFor(odUserId, candidate)) {
          passedOver.push(candidate);
          continue;
        }
        symbol = candidate;
        boardRank = rank;
        break;
      }

      const fallback = symbol == null;
      if (fallback) {
        const ranking = fallbackRankingByAgent[agentId] || [];
        symbol = ranking.find(s => !own.includes(s) && !isBlockedFor(odUserId, s)) ?? null;
        if (symbol == null) throw sentinel('catalog_exhausted', `no available name for ${agentId} at pick ${pickNumber}`);
      }

      taken.add(symbol);
      own.push(symbol);
      events.push({ pickNumber, round, agentId, odUserId, symbol, boardRank, fallback, passedOver });
    }
  }

  return { picksByAgent, events };
}

/** picksByAgent -> reserveBulk entries ([{symbol, agentId}], 24 on a real Monday). */
export function toLedgerEntries(picksByAgent) {
  const entries = [];
  for (const [agentId, symbols] of Object.entries(picksByAgent || {})) {
    for (const symbol of symbols) entries.push({ symbol, agentId });
  }
  return entries;
}

/**
 * The Spec §0.1 acquisition: land every drafted name as held/'draft' via the
 * idempotent all-or-nothing reserveBulk. A conflict here means the ledger
 * gained a rival holder between resolution and acquisition (impossible
 * pre-market; possible only with live battles swapping) — logged CRITICAL
 * and surfaced, never retried blindly: reconciliation arbitrates from battle
 * docs, and the founder decides.
 */
async function ensureAcquisition(db, groupId, picksByAgent, now) {
  const entries = toLedgerEntries(picksByAgent);
  if (entries.length === 0) {
    // A stream doc without picks is a corrupted record, not a retryable
    // state — surface it structurally instead of letting reserveBulk throw
    // a bare validation error into the 500 handler.
    console.error(`${LOG_PREFIX} CRITICAL: stream record for group ${groupId} carries no picks — acquisition impossible; the stream doc needs founder attention`);
    return { acquired: false, conflicts: [{ symbol: null, reason: 'empty_stream_record', heldBy: null }] };
  }
  const result = await reserveBulk(db, { groupId, entries, now });
  if (!result.reserved) {
    console.error(`${LOG_PREFIX} CRITICAL: acquisition conflict for group ${groupId} —`, JSON.stringify(result.conflicts));
    return { acquired: false, conflicts: result.conflicts };
  }
  return { acquired: true, heldCount: entries.length };
}

/**
 * Resolve one group's agent draft end-to-end: read boards + ledger, run the
 * pure snake, write streams/agentDraft in ONE awaited transaction (rider #3),
 * then reserveBulk all 24 (acquisition-as-held). Idempotent at every grain:
 * an existing stream short-circuits to ensure-acquisition; the transaction
 * re-checks the stream under contention; reserveBulk tolerates re-runs.
 */
export async function resolveAgentDraftForGroup(db, group, { now = new Date() } = {}) {
  if (!group) throw sentinel('group_not_found');
  if (group.status !== GROUP_STATUS.BATTLE) throw sentinel('not_battle', `status is '${group.status}'`);

  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(group.id);
  const streamRef = groupRef.collection(STREAMS_SUBCOLLECTION).doc(AGENT_DRAFT_STREAM_DOC_ID);
  const nowIso = toIso(now);

  // Already resolved? Heal the crash window (stream written, acquisition
  // lost) instead of re-resolving.
  const existing = await streamRef.get();
  if (existing.exists) {
    const stored = existing.data();
    const acquisition = await ensureAcquisition(db, group.id, stored.picksByAgent, now);
    if (!acquisition.acquired) return { status: 'acquisition_conflict', conflicts: acquisition.conflicts };
    return { status: 'already_resolved', ensured: true, heldCount: acquisition.heldCount, picksByAgent: stored.picksByAgent };
  }

  // Boards — one per member, keyed by agentId, carrying odUserId + archetype.
  // produceGroupBoards deletes stale boards on agent churn, so duplicates per
  // member should not exist — but iteration order must never decide a draft:
  // if duplicates DO appear, the latest producedAt wins deterministically and
  // the ambiguity is logged loudly (re-running produce-agent-boards cleans it).
  const boardsSnap = await groupRef.collection(AGENT_BOARDS_SUBCOLLECTION).get();
  const boardByUser = {};
  boardsSnap.forEach(doc => {
    const data = doc.data();
    if (!data?.odUserId) return;
    const prior = boardByUser[data.odUserId];
    if (prior) {
      console.warn(`${LOG_PREFIX} group ${group.id}: member ${data.odUserId} has MULTIPLE board docs (${prior.agentId}, ${doc.id}) — taking the latest producedAt; run produce-agent-boards to clean the stale one`);
      if (String(prior.producedAt ?? '') >= String(data.producedAt ?? '')) return;
    }
    boardByUser[data.odUserId] = { ...data, agentId: doc.id };
  });
  const members = group.groupMembers || [];
  const missing = members.filter(id => !boardByUser[id]);
  if (members.length !== GROUP_SIZE || missing.length > 0) {
    throw sentinel('boards_missing', missing.length ? `no agent board for: ${missing.join(', ')}` : undefined);
  }

  const agents = members.map(odUserId => ({ agentId: boardByUser[odUserId].agentId, odUserId }));
  const boardsByAgent = Object.fromEntries(agents.map(a => [a.agentId, { board: boardByUser[a.odUserId].board }]));

  // Ledger-aware availability: held by anyone + fresh reservations. (Fresh
  // group => empty; the awareness matters for re-formed groups and defense.)
  const ledger = await readLedger(db, group.id, now);
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const heldSymbols = new Set(Object.keys(ledger.held || {}));
  for (const [symbol, resv] of Object.entries(ledger.reservations || {})) {
    if (!isReservationStale(resv, nowMs)) heldSymbols.add(symbol);
  }

  // Exhaustion fallback catalogs — per archetype, computed once each.
  const rankingsDoc = await db.collection('indexIntelligence').doc('stockRankings').get();
  const stocks = rankingsDoc.exists ? rankingsDoc.data().stocks : null;
  if (!Array.isArray(stocks) || stocks.length === 0) {
    throw sentinel('universe_unavailable', 'stockRankings empty — fallback catalog required');
  }
  const rankingByArchetype = new Map();
  const fallbackRankingByAgent = {};
  for (const { agentId, odUserId } of agents) {
    const archetype = boardByUser[odUserId].archetype || 'analyst';
    if (!rankingByArchetype.has(archetype)) {
      // Archetype Rank V2 (spec §4 census): explicit mode + the §3.4 pinned minimum —
      // the fallback catalog must cover 24 agent picks plus up to 12 user-held names (V-7).
      rankingByArchetype.set(archetype, computeArchetypeRankings(stocks, archetype, { gameMode: 'tournament', minCandidates: AGENT_MARKET_SIZE + USER_HELD_NAMES_PER_GROUP }).map(s => s.symbol));
    }
    fallbackRankingByAgent[agentId] = rankingByArchetype.get(archetype);
  }

  const { picksByAgent, events } = resolveAgentSnakeDraft({ group, agents, boardsByAgent, heldSymbols, fallbackRankingByAgent });

  // Rider #3 (agent side): the playback stream commits in one awaited
  // transaction, with an in-tx existence re-check so two racing callers
  // can't double-write (the loser falls through to ensure-acquisition).
  const wrote = await db.runTransaction(async (tx) => {
    const snap = await tx.get(streamRef);
    if (snap.exists) return false;
    tx.set(streamRef, {
      events,
      picksByAgent,
      roundNumber: group.roundNumber,
      ...(group.bracketGameId != null
        ? { bracketGameId: group.bracketGameId }
        : { baseLayerWeek: group.baseLayerWeek }),
      resolvedAt: nowIso,
    });
    return true;
  });

  if (!wrote) {
    console.warn(`${LOG_PREFIX} group ${group.id}: stream appeared mid-resolution (racing caller) — ensuring acquisition from the stored record`);
    const storedSnap = await streamRef.get();
    const stored = storedSnap.data();
    const acquisition = await ensureAcquisition(db, group.id, stored.picksByAgent, now);
    if (!acquisition.acquired) return { status: 'acquisition_conflict', conflicts: acquisition.conflicts };
    return { status: 'already_resolved', ensured: true, heldCount: acquisition.heldCount, picksByAgent: stored.picksByAgent };
  }

  // Spec §0.1: acquisition lands BEFORE any deploy — all 24, all-or-nothing.
  const acquisition = await ensureAcquisition(db, group.id, picksByAgent, now);
  if (!acquisition.acquired) return { status: 'acquisition_conflict', conflicts: acquisition.conflicts };

  console.log(`${LOG_PREFIX} group ${group.id}: agent draft resolved — ${events.length} picks, ${acquisition.heldCount} names held as 'draft' (${events.filter(e => e.fallback).length} fallback picks)`);
  return { status: 'resolved', picksByAgent, eventCount: events.length, heldCount: acquisition.heldCount };
}
