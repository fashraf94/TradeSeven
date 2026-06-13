// api/_utils/tournamentAgentLedger.js
//
// P2 — League Tournament agent held-set ledger (Spec §1.2). The agent
// market's exclusivity machinery: a two-phase reserve/confirm protocol around
// the five non-fenced `executeSwapServer` call sites in agent-evaluate.js,
// candidate pre-filtering helpers, and the nightly derived reconciliation.
//
// PLACEMENT (founder ruling, June 11, 2026): the ledger is the SIBLING DOC
// tournamentGroups/{groupId}/ledger/agentHeldSet — never the group doc, so
// per-swap transactions contend with none of the user-layer writers (flips,
// claims, banking).
//
// REGULAR-BATTLE INVARIANT (the phase's governing rule): every entry point
// the eval cron touches is tournament-conditional. `resolveTournamentContext`
// answers "tournament battle?" from in-memory battle fields ONLY — a
// non-tournament battle returns null before any Firestore access, and the
// pure helpers are identity functions on a null/empty context. The
// discriminator is the battle doc's own stamp (`gameMode` +
// `groupId`, written by P4's fence entry in createAgentBattle — founder
// ruling B3, June 11, 2026): per-battle truth, so a registered player's
// still-active casual battle can never be misclassified. Until P4 stamps
// real battles, every path here is dormant in production; test fixtures and
// dev-seeded battle docs may stamp the fields directly (raw doc writes —
// never via the fenced creation path).
//
// DERIVED-REBUILDABLE: the held set's ground truth is the group's tournament
// battles' portfolios. Incremental maintenance (reserve/confirm/release)
// keeps it honest intraday; `reconcileGroupLedger` rebuilds it nightly and
// clears stale reservations, so no crash window can deadlock a symbol or
// diverge the ledger for more than a day.
//
// All ledger writes are WHOLE-DOC tx.set — symbols contain dots ('BRK.B',
// 'BTC-USD.CC'), so dotted-FieldPath updates on symbol-keyed maps are
// forbidden in this module.
//
// Imports the zero-import schema module from src/ under the revised June
// 2026 import rule (BUILD_RULES §4); the co-located test's real import of
// THIS module is the dependency-surface guard. `flattenPortfolioServer` is a
// fenced export (agentScoring.js) — CALLED read-only, never edited; it is
// the canonical portfolio→assets view, so the reconciliation can never
// re-derive portfolio shape locally.

import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_GAME_MODE,
  AGENT_LEDGER_SUBCOLLECTION,
  AGENT_LEDGER_DOC_ID,
  STREAMS_SUBCOLLECTION,
  AGENT_DRAFT_STREAM_DOC_ID,
  GROUP_STATUS,
  LEDGER_SOURCE,
  LEG_DIRECTION,
  createAgentLedgerDoc,
  createAgentLedgerEntry,
} from '../../src/constants/leagueTournament.js';
import { flattenPortfolioServer } from './agentScoring.js';
import { getGroup, getPlayer } from './tournamentGroupService.js';

const LOG_PREFIX = '[TournamentLedger]';

// A reservation older than this is STALE: claimable by rivals and cleared by
// reconciliation. 10 minutes comfortably exceeds the longest invocation that
// could still legitimately confirm it (the eval cron's 60s maxDuration) and
// sits inside one 15-minute tick, so a crash between reserve and swap can
// never deadlock a symbol across more than one tick.
export const RESERVATION_TTL_MS = 10 * 60 * 1000;

// doubleDowns event-list cap on the ledger doc (house slice(-N) pattern).
export const DOUBLE_DOWN_EVENTS_CAP = 50;

function toIso(now) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function toMs(now) {
  return now instanceof Date ? now.getTime() : new Date(now).getTime();
}

/** The sibling ledger doc ref for a group. */
export function ledgerRef(db, groupId) {
  return db
    .collection(TOURNAMENT_GROUPS_COLLECTION)
    .doc(groupId)
    .collection(AGENT_LEDGER_SUBCOLLECTION)
    .doc(AGENT_LEDGER_DOC_ID);
}

/** Read the ledger doc, defaulting to the empty shape if it doesn't exist yet. */
export async function readLedger(db, groupId, now = new Date()) {
  const snap = await ledgerRef(db, groupId).get();
  return snap.exists ? snap.data() : createAgentLedgerDoc({ now: toIso(now) });
}

export function isReservationStale(reservation, nowMs) {
  const at = new Date(reservation?.at ?? 0).getTime();
  return !Number.isFinite(at) || nowMs - at >= RESERVATION_TTL_MS;
}

/**
 * The cross-agent exclusion set: symbols held by OTHER agents in the group,
 * plus symbols freshly reserved by other agents. Own holdings/reservations
 * are never in the set (the agent's own-portfolio exclusion is the existing
 * `heldSymbols` mechanism). Pure.
 */
export function buildHeldByOthers(ledger, agentId, nowMs = Date.now()) {
  const out = new Set();
  for (const [symbol, entry] of Object.entries(ledger?.held || {})) {
    if (entry?.heldBy && entry.heldBy !== agentId) out.add(symbol);
  }
  for (const [symbol, resv] of Object.entries(ledger?.reservations || {})) {
    if (resv?.by && resv.by !== agentId && !isReservationStale(resv, nowMs)) out.add(symbol);
  }
  return out;
}

/**
 * Candidate-pool filter. IDENTITY by construction when there is nothing to
 * filter: returns the SAME array reference for a null/empty exclusion set or
 * a non-array input — this is the regular-battle invariance seam the test
 * battery locks (non-tournament callers pass no set and get their array
 * back untouched).
 */
export function excludeHeldByOthers(assets, heldByOthers) {
  if (!Array.isArray(assets) || !heldByOthers || heldByOthers.size === 0) return assets;
  if (!assets.some(a => a && heldByOthers.has(a.symbol))) return assets;
  return assets.filter(a => !a || !heldByOthers.has(a.symbol));
}

/**
 * String-array sibling of excludeHeldByOthers (e.g. watchlist.hotBench, whose
 * entries are bare symbols). Same identity contract: the SAME array reference
 * comes back whenever there is nothing to remove.
 */
export function excludeHeldSymbols(symbols, heldByOthers) {
  if (!Array.isArray(symbols) || !heldByOthers || heldByOthers.size === 0) return symbols;
  if (!symbols.some(s => heldByOthers.has(s))) return symbols;
  return symbols.filter(s => !heldByOthers.has(s));
}

/**
 * Own player's current user-layer picks with the LIVE leg's direction —
 * the double-down detection input (Spec §2, agent half). The live leg is the
 * last leg without `closedAt` (closed legs carry it; the field is omitted
 * until close — P0 leg factory contract). Pure.
 */
export function getOwnUserPicks(group, odUserId) {
  const player = getPlayer(group, odUserId);
  if (!player) return [];
  const picks = [];
  for (const pick of player.picks || []) {
    if (!pick?.symbol) continue;
    const legs = Array.isArray(pick.legs) ? pick.legs : [];
    // The live leg IS the last leg by construction (flips close the old leg
    // and open the new one atomically — flip.js), so the last leg's
    // direction is the pick's current stance.
    const last = legs[legs.length - 1];
    picks.push({
      symbol: pick.symbol,
      direction: last?.direction || LEG_DIRECTION.LONG,
    });
  }
  return picks;
}

/**
 * Agent-side double-down detection at confirm time (Spec §2's derived flag,
 * agent half): symbolIn ∈ own player's picks → 'formed'; symbolOut ∈ own
 * player's picks → 'broken'. Events carry the writer-readable fields the
 * spec names: symbol, agentId, odUserId, the user leg's direction at the
 * time, timestamp. Pure.
 *
 * The user-side half (a flip/claim creating or destroying alignment) is
 * deferred to P6 — it requires the cross-layer read the aggregation layer
 * will own.
 */
export function detectDoubleDownEvents({ symbolIn, symbolOut, ownUserPicks, agentId, odUserId, now }) {
  const bySymbol = new Map((ownUserPicks || []).map(p => [p.symbol, p]));
  const at = toIso(now ?? new Date());
  const events = [];
  const inPick = symbolIn ? bySymbol.get(symbolIn) : undefined;
  if (inPick) {
    events.push({ kind: 'formed', symbol: symbolIn, agentId, odUserId, userDirection: inPick.direction, at });
  }
  const outPick = symbolOut && symbolOut !== symbolIn ? bySymbol.get(symbolOut) : undefined;
  if (outPick) {
    events.push({ kind: 'broken', symbol: symbolOut, agentId, odUserId, userDirection: outPick.direction, at });
  }
  return events;
}

/**
 * USER-SIDE double-down detection (D-1, founder ruling June 12, 2026) — the
 * mirror of detectDoubleDownEvents for the user market. A user flip or claim
 * that touches a symbol the user's OWN agent already holds is a double-down
 * event: vocabulary `formed` (a claim lands an aligned name), `broken` (a
 * claim drops one), `flipped` (a flip reverses the user leg's direction while
 * the alignment persists). Events carry `side: 'user'` — the agent-side
 * sibling omits `side`, so absent ⇒ agent at every reader.
 *
 * THE CROSS-MARKET GUARD is `heldBy === ownAgentId`: a symbol held by a RIVAL
 * agent is two different players (the designed cross-layer duel), never a
 * double-down. Pre-draft (no resolved ownAgentId, or an empty held set)
 * yields zero events. Pure — the caller owns the atomic write.
 *
 * @param {Object} args
 * @param {string|null} args.ownAgentId - the user's agent in this group (the
 *   odUserId→agentId map from buildOwnerAgentMap)
 * @param {Object} args.held - ledger.held (symbol → {heldBy, ...})
 * @param {string} args.odUserId
 * @param {Array<{symbol: string, kind: string, userDirection?: string, from?: string, to?: string}>} args.candidates
 * @param {Date|string} [args.now]
 * @returns {Array<Object>} the detected user-side events (possibly empty)
 */
export function detectUserDoubleDownEvents({ ownAgentId, held, odUserId, candidates, now }) {
  if (!ownAgentId || !held || !Array.isArray(candidates)) return [];
  const at = toIso(now ?? new Date());
  const events = [];
  for (const c of candidates) {
    if (!c?.symbol || held[c.symbol]?.heldBy !== ownAgentId) continue;
    events.push({
      kind: c.kind,
      side: 'user',
      symbol: c.symbol,
      agentId: ownAgentId,
      odUserId,
      userDirection: c.userDirection ?? null,
      ...(c.from !== undefined ? { from: c.from } : {}),
      ...(c.to !== undefined ? { to: c.to } : {}),
      at,
    });
  }
  return events;
}

/**
 * The odUserId → agentId map for a group, from the IMMUTABLE agent-draft
 * stream doc (streams/agentDraft.events carry both ids —
 * tournamentAgentDraft.resolveAgentSnakeDraft). The user-side double-down
 * detection reads it to know which ledger holdings belong to the user's OWN
 * agent. The stream never rewrites post-draft, so a plain read just before a
 * transaction is race-free. Pure; tolerant of a null/empty stream (→ {}).
 */
export function buildOwnerAgentMap(streamData) {
  const map = {};
  for (const ev of streamData?.events || []) {
    if (ev?.odUserId && ev?.agentId && !map[ev.odUserId]) map[ev.odUserId] = ev.agentId;
  }
  return map;
}

/**
 * Read the odUserId→agentId map for a group from the immutable agent-draft
 * stream, defensively — the ONE home for the pre-transaction read both the
 * flip and the claims double-down hooks share. Degrades to {} on any failure
 * (the double-down must never block its host mutation). Plain read; the stream
 * never rewrites post-draft, so this is race-free before a transaction.
 */
export async function readOwnerAgentMap(db, groupId) {
  try {
    const snap = await db
      .collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId)
      .collection(STREAMS_SUBCOLLECTION).doc(AGENT_DRAFT_STREAM_DOC_ID).get();
    return buildOwnerAgentMap(snap.exists ? snap.data() : null);
  } catch (err) {
    console.warn(`${LOG_PREFIX} agent-draft stream read failed for ${groupId} — double-down detection skipped:`, err.message);
    return {};
  }
}

/**
 * The atomic side-effects of a batch of user-side double-down events (D-1) —
 * the ONE home for the recording shape so the flip and claims transactions can
 * never drift: the capped ledger doubleDowns list AND the group-feed entries
 * (`double_down` type, the renderer's contract). Pure; the caller writes them
 * in its own transaction. The durable from/to live on the ledger event; the
 * feed entry carries only what the renderer reads (kind/side/symbol/odUserId).
 */
export function buildUserDoubleDownWrites(ledger, events, nowIso) {
  const doubleDowns = [...(ledger?.doubleDowns || []), ...events].slice(-DOUBLE_DOWN_EVENTS_CAP);
  const feedEvents = events.map(ev => ({
    type: 'double_down', kind: ev.kind, side: ev.side, symbol: ev.symbol, odUserId: ev.odUserId, timestamp: nowIso,
  }));
  return { doubleDowns, feedEvents };
}

/**
 * Battle → tournament context, or null.
 *
 * THE REGULAR-BATTLE EARLY EXIT. The discriminator checks are strict
 * in-memory field equality and MUST stay ahead of any `await`: a
 * non-tournament battle performs ZERO Firestore I/O here (locked by the
 * throwing-db test in the co-located battery). Today every battle carries
 * gameMode 'baggerbomb_agent' (fenced agentBattleService.js:73, read-only
 * reference), so this returns null for the entire production population
 * until P4 stamps tournament battles with BOTH fields — that joint stamp is
 * P4's contract with this resolver.
 *
 * Malformed stamps fail SAFE and LOUD: the battle is treated as a regular
 * battle (no filtering, no reservations — never a behavior change risk) and
 * the mismatch is logged; nightly reconciliation surfaces any resulting
 * divergence.
 *
 * `groupCache` memoizes group-doc reads per cron invocation (4 agents per
 * group would otherwise re-read it each battle). The LEDGER is read fresh
 * per battle — rival swaps confirmed earlier in the same invocation must be
 * visible to this battle's candidate filtering.
 */
export async function resolveTournamentContext(db, battle, groupCache = new Map()) {
  if (!battle || battle.gameMode !== TOURNAMENT_GAME_MODE) return null;
  if (typeof battle.groupId !== 'string' || battle.groupId.length === 0) return null;
  if (typeof battle.agentId !== 'string' || battle.agentId.length === 0) {
    console.warn(`${LOG_PREFIX} battle ${battle.id} has a tournament stamp but no agentId — treating as non-tournament`);
    return null;
  }

  const groupId = battle.groupId;
  let group = groupCache.get(groupId);
  if (group === undefined) {
    group = await getGroup(db, groupId);
    groupCache.set(groupId, group);
  }

  if (!group) {
    console.warn(`${LOG_PREFIX} battle ${battle.id} stamps groupId ${groupId} but the group doesn't exist — treating as non-tournament`);
    return null;
  }
  if (group.status !== GROUP_STATUS.BATTLE) {
    console.warn(`${LOG_PREFIX} battle ${battle.id} stamps group ${groupId} with status '${group.status}' (not 'battle') — treating as non-tournament`);
    return null;
  }
  if (!Array.isArray(group.groupMembers) || !group.groupMembers.includes(battle.ownerId)) {
    console.warn(`${LOG_PREFIX} battle ${battle.id} owner ${battle.ownerId} is not a member of group ${groupId} — treating as non-tournament`);
    return null;
  }

  const ledger = await readLedger(db, groupId);
  return {
    groupId,
    agentId: battle.agentId,
    odUserId: battle.ownerId,
    // Symbols held/freshly-reserved by OTHER agents — the candidate filter
    // set. Own player's user-layer picks are never in the agent ledger
    // (dual markets), so they are never filtered: the double-down stays open.
    // Deliberately NOT on the context: the group doc (memoized per
    // invocation, can go stale across a mid-invocation flip) and the user
    // picks — confirmSwap re-reads the group at confirm time so double-down
    // events record the user leg's direction AT THE TIME (Spec §2).
    heldByOthers: buildHeldByOthers(ledger, battle.agentId),
  };
}

/**
 * Phase 1 of the two-phase protocol: transactionally claim `symbol` for
 * `agentId` ahead of the swap. Fails (without writing) when the symbol is
 * held by anyone — including this agent: within-agent duplicates remain
 * forbidden (V2.1 §1) — or freshly reserved by another agent.
 *
 * A STALE rival reservation is claimable, with one hardening read (founder-
 * accepted): the stale reserver may have crashed AFTER its swap executed but
 * BEFORE confirm, so its battle doc is checked inside the transaction — if
 * the symbol actually landed in that portfolio, the entry is converted to
 * `held` for the crashed agent and this reserve fails, closing most of the
 * crash-window duplicate-holding gap without waiting for the nightly rebuild.
 *
 * Returns { reserved: true } or { reserved: false, reason, heldBy? }.
 */
export async function reserveSymbol(db, { groupId, symbol, agentId, battleId, now = new Date() }) {
  const nowIso = toIso(now);
  const nowMs = toMs(now);
  const ref = ledgerRef(db, groupId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const ledger = snap.exists ? snap.data() : createAgentLedgerDoc({ now: nowIso });
    const held = { ...(ledger.held || {}) };
    const reservations = { ...(ledger.reservations || {}) };

    const heldEntry = held[symbol];
    if (heldEntry) {
      return {
        reserved: false,
        reason: heldEntry.heldBy === agentId ? 'already_held_self' : 'held',
        heldBy: heldEntry.heldBy,
      };
    }

    const resv = reservations[symbol];
    if (resv && resv.by !== agentId) {
      if (!isReservationStale(resv, nowMs)) {
        return { reserved: false, reason: 'reserved', heldBy: resv.by };
      }
      // Stale rival reservation — hardening read before claiming over it.
      if (resv.battleId) {
        const staleBattleSnap = await tx.get(db.collection('agentBattles').doc(resv.battleId));
        const stalePortfolio = staleBattleSnap.exists ? staleBattleSnap.data()?.portfolio : null;
        const landed = stalePortfolio
          && flattenPortfolioServer(stalePortfolio).some(a => a?.symbol === symbol);
        if (landed) {
          console.warn(`${LOG_PREFIX} stale reservation on ${symbol} by ${resv.by} had actually landed (battle ${resv.battleId}) — converting to held`);
          held[symbol] = createAgentLedgerEntry({ heldBy: resv.by, since: nowIso, source: LEDGER_SOURCE.SWAP });
          delete reservations[symbol];
          tx.set(ref, { ...ledger, held, reservations, updatedAt: nowIso });
          return { reserved: false, reason: 'held', heldBy: resv.by };
        }
      }
      console.warn(`${LOG_PREFIX} claiming over stale reservation on ${symbol} (was ${resv.by}, age > TTL)`);
    }

    reservations[symbol] = { by: agentId, battleId: battleId ?? null, at: nowIso };
    tx.set(ref, { ...ledger, held, reservations, updatedAt: nowIso });
    return { reserved: true };
  });
}

/**
 * Phase 2: the swap executed — finalize `symbolIn` as held (source 'swap',
 * clearing its reservation) and release `symbolOut` back to the pool.
 * Double-down events (formed on symbolIn, broken on symbolOut) are detected
 * here and written ATOMICALLY with the held-set change (Signal Capture
 * pattern A — awaited in-request), then returned so the caller can mirror
 * them onto the battle's status feed.
 *
 * The own player's picks are re-read fresh here (a PLAIN read just before
 * the ledger transaction — never a transactional group-doc read, which
 * would take the lock the sibling-doc ruling exists to avoid), so the
 * event's userDirection is the user leg's direction AT CONFIRM TIME — a
 * mid-invocation flip can't stamp a stale direction onto the Spec §2 record.
 *
 * Anomalies (symbolIn already held by a rival, symbolOut not ours) are
 * logged loudly and resolved in favor of what actually happened — the swap
 * is already on the battle doc, which is the derived ground truth the
 * nightly reconciliation arbitrates from.
 */
export async function confirmSwap(db, { groupId, symbolIn, symbolOut, agentId, battleId, now = new Date(), odUserId = null }) {
  const nowIso = toIso(now);
  const ref = ledgerRef(db, groupId);

  let ownUserPicks = [];
  if (odUserId) {
    try {
      ownUserPicks = getOwnUserPicks(await getGroup(db, groupId), odUserId);
    } catch (readErr) {
      // Detection degrades to "no events" rather than failing the confirm —
      // the held-set write must land regardless.
      console.warn(`${LOG_PREFIX} confirm: fresh group read failed for ${groupId} — double-down detection skipped:`, readErr.message);
    }
  }

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const ledger = snap.exists ? snap.data() : createAgentLedgerDoc({ now: nowIso });
    const held = { ...(ledger.held || {}) };
    const reservations = { ...(ledger.reservations || {}) };

    const prevIn = held[symbolIn];
    if (prevIn && prevIn.heldBy !== agentId) {
      console.warn(`${LOG_PREFIX} confirm: ${symbolIn} was marked held by ${prevIn.heldBy}; overwriting for ${agentId} (battle ${battleId}) — reconciliation arbitrates tonight`);
    }
    held[symbolIn] = createAgentLedgerEntry({ heldBy: agentId, since: nowIso, source: LEDGER_SOURCE.SWAP });
    delete reservations[symbolIn];

    if (symbolOut && symbolOut !== symbolIn) {
      const prevOut = held[symbolOut];
      if (prevOut && prevOut.heldBy === agentId) {
        delete held[symbolOut];
      } else if (prevOut) {
        console.warn(`${LOG_PREFIX} confirm: ${symbolOut} swapped out by ${agentId} but ledger says held by ${prevOut.heldBy} — leaving entry`);
      }
    }

    const events = detectDoubleDownEvents({ symbolIn, symbolOut, ownUserPicks, agentId, odUserId, now: nowIso });
    const doubleDowns = events.length > 0
      ? [...(ledger.doubleDowns || []), ...events].slice(-DOUBLE_DOWN_EVENTS_CAP)
      : (ledger.doubleDowns || []);

    tx.set(ref, { ...ledger, held, reservations, doubleDowns, updatedAt: nowIso });
    return { confirmed: true, events };
  });
}

/**
 * The compensating action for a failed swap: drop this agent's reservation
 * on `symbol`. Idempotent and narrow — it never touches `held`, never
 * removes another agent's reservation, and a missing reservation is a clean
 * no-op (the catch blocks that call this must never have their original
 * error masked by bookkeeping).
 */
export async function releaseReservation(db, { groupId, symbol, agentId, now = new Date() }) {
  const nowIso = toIso(now);
  const ref = ledgerRef(db, groupId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { released: false };
    const ledger = snap.data();
    const reservations = { ...(ledger.reservations || {}) };
    const resv = reservations[symbol];
    if (!resv || resv.by !== agentId) return { released: false };
    delete reservations[symbol];
    tx.set(ref, { ...ledger, reservations, updatedAt: nowIso });
    return { released: true };
  });
}

/**
 * The Monday acquisition (Spec §0.1): atomically register the draft-resolved
 * symbols — all-or-nothing — BEFORE any deploy happens. "Reserve" in the
 * §0.1 sequencing sense: entries land directly as `held` with source
 * 'draft', not as TTL'd reservations, so the multi-minute deploy fan-out
 * faces no expiry pressure and a failed deploy never costs an agent its
 * drafted names (the orchestrator just retries the deploy).
 *
 * Built and tested at P2; WIRED BY P3's orchestrator — no production caller
 * in this phase. Draft resolution is deterministic and per-group unique, so
 * any conflict (symbol held/reserved by a different agent, duplicate symbol
 * in the input) is a caller bug: conflicts fail the whole batch with zero
 * writes; duplicate inputs throw.
 *
 * `entries`: [{ symbol, agentId }] — 24 on a real Monday.
 */
export async function reserveBulk(db, { groupId, entries, now = new Date() }) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('reserveBulk: entries must be a non-empty array of {symbol, agentId}');
  }
  const seen = new Set();
  for (const entry of entries) {
    if (typeof entry?.symbol !== 'string' || entry.symbol.length === 0 || typeof entry?.agentId !== 'string' || entry.agentId.length === 0) {
      throw new Error('reserveBulk: every entry needs a non-empty symbol and agentId');
    }
    if (seen.has(entry.symbol)) {
      throw new Error(`reserveBulk: duplicate symbol ${entry.symbol} — draft resolution must be unique per group`);
    }
    seen.add(entry.symbol);
  }

  const nowIso = toIso(now);
  const nowMs = toMs(now);
  const ref = ledgerRef(db, groupId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const ledger = snap.exists ? snap.data() : createAgentLedgerDoc({ now: nowIso });
    const held = { ...(ledger.held || {}) };
    const reservations = { ...(ledger.reservations || {}) };

    const conflicts = [];
    for (const { symbol, agentId } of entries) {
      const heldEntry = held[symbol];
      if (heldEntry && heldEntry.heldBy !== agentId) {
        conflicts.push({ symbol, reason: 'held', heldBy: heldEntry.heldBy });
        continue;
      }
      const resv = reservations[symbol];
      if (resv && resv.by !== agentId && !isReservationStale(resv, nowMs)) {
        conflicts.push({ symbol, reason: 'reserved', heldBy: resv.by });
      }
    }
    if (conflicts.length > 0) {
      return { reserved: false, conflicts };
    }

    for (const { symbol, agentId } of entries) {
      held[symbol] = held[symbol]?.heldBy === agentId
        ? held[symbol] // re-run idempotency: keep the original since/source
        : createAgentLedgerEntry({ heldBy: agentId, since: nowIso, source: LEDGER_SOURCE.DRAFT });
      delete reservations[symbol];
    }

    tx.set(ref, { ...ledger, held, reservations, updatedAt: nowIso });
    return { reserved: true, count: entries.length };
  });
}

/**
 * Nightly derived reconciliation for one group (Spec §1.2): rebuild the held
 * set from the group's tournament battles, diff against the ledger, log
 * every divergence, correct to the DERIVED truth, and clear stale
 * reservations.
 *
 * Derived truth = each agent's CURRENT battle — the latest-created tournament
 * battle for that agentId, active or completed. Completed counts because the
 * held set persists overnight by design (Tue–Fri deploys re-instantiate the
 * prior close's six; spec §1.3), and at reconciliation time the day's
 * fullday battles have typically already completed. Held entries whose
 * holder has NO battles in the group yet are preserved, not corrected —
 * there is no portfolio to diff against (the Monday reserve-before-deploy
 * window; a failed Monday deploy awaiting retry) — and reported as
 * 'unverifiable_holder'.
 *
 * The battles query is a single equality filter (groupId ==) — no composite
 * index required; gameMode is re-checked in memory so a stray stamp can't
 * leak a casual battle into the derivation.
 */
export async function reconcileGroupLedger(db, group, { now = new Date() } = {}) {
  const nowIso = toIso(now);
  const nowMs = toMs(now);
  const groupId = group.id;

  // Field-mask projection: battle docs are heavyweight (statusFeed, chat,
  // rankings) and the per-group result set grows daily all season — only
  // these five fields feed the derivation. select() needs no index.
  const battlesSnap = await db
    .collection('agentBattles')
    .where('groupId', '==', groupId)
    .select('agentId', 'createdAt', 'gameMode', 'ownerId', 'portfolio')
    .get();
  const derivationDivergences = [];
  const battles = [];
  battlesSnap.forEach(doc => {
    const data = doc.data();
    if (data?.gameMode !== TOURNAMENT_GAME_MODE || typeof data?.agentId !== 'string') return;
    // Same membership predicate the eval-cron resolver applies: a stamped
    // battle whose owner is not in the group is NOT derived truth (the cron
    // refuses it too, so ingesting it here would manufacture permanent
    // wrong_holder noise the cron never repairs).
    if (Array.isArray(group.groupMembers) && data.ownerId && !group.groupMembers.includes(data.ownerId)) {
      derivationDivergences.push({ type: 'foreign_battle', symbol: null, details: `battle ${doc.id} owner ${data.ownerId} not in groupMembers — excluded from derivation` });
      return;
    }
    battles.push({ id: doc.id, ...data });
  });

  // Latest battle per agent (createdAt is ISO — lexicographic order works).
  const latestByAgent = new Map();
  for (const battle of battles) {
    const prior = latestByAgent.get(battle.agentId);
    if (!prior || String(battle.createdAt) > String(prior.createdAt)) {
      latestByAgent.set(battle.agentId, battle);
    }
  }

  // Derived held set: symbol → agentId. Agents processed in sorted order so
  // duplicate-holding arbitration is deterministic (first wins, rest logged).
  const derived = new Map();
  for (const agentId of [...latestByAgent.keys()].sort()) {
    const battle = latestByAgent.get(agentId);
    for (const asset of flattenPortfolioServer(battle.portfolio)) {
      const symbol = asset?.symbol;
      if (!symbol) continue;
      if (derived.has(symbol)) {
        derivationDivergences.push({ type: 'duplicate_holding', symbol, details: `held by ${derived.get(symbol)} and ${agentId} (crash-window duplicate)` });
        continue;
      }
      derived.set(symbol, agentId);
    }
  }

  // All diff accumulators live INSIDE the transaction closure and are
  // returned from it: Firestore re-runs the closure on contention, so any
  // outer-scope push/increment would double-count divergences on retry.
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ledgerRef(db, groupId));
    const ledger = snap.exists ? snap.data() : createAgentLedgerDoc({ now: nowIso });
    const priorHeld = ledger.held || {};
    const txDivergences = [];
    let txStaleCleared = 0;

    const newHeld = {};
    for (const [symbol, agentId] of derived.entries()) {
      const prior = priorHeld[symbol];
      if (prior?.heldBy === agentId) {
        newHeld[symbol] = prior; // unchanged — keep since/source provenance
      } else {
        txDivergences.push({
          type: prior ? 'wrong_holder' : 'missing_in_ledger',
          symbol,
          details: prior ? `ledger said ${prior.heldBy}, portfolio says ${agentId}` : `portfolio says ${agentId}`,
        });
        newHeld[symbol] = createAgentLedgerEntry({ heldBy: agentId, since: nowIso, source: LEDGER_SOURCE.SWAP });
      }
    }
    for (const [symbol, entry] of Object.entries(priorHeld)) {
      if (newHeld[symbol]) continue;
      if (!latestByAgent.has(entry.heldBy)) {
        // No battle evidence either way — preserve (pre-deploy draft state).
        newHeld[symbol] = entry;
        txDivergences.push({ type: 'unverifiable_holder', symbol, details: `held by ${entry.heldBy} (no battles in group) — preserved` });
      } else {
        txDivergences.push({ type: 'not_in_portfolio', symbol, details: `ledger said ${entry.heldBy}, portfolio disagrees — removed` });
      }
    }

    const newReservations = {};
    for (const [symbol, resv] of Object.entries(ledger.reservations || {})) {
      if (isReservationStale(resv, nowMs)) {
        txStaleCleared++;
      } else {
        newReservations[symbol] = resv;
      }
    }

    tx.set(ledgerRef(db, groupId), {
      ...ledger,
      held: newHeld,
      reservations: newReservations,
      updatedAt: nowIso,
    });

    return { heldSymbols: Object.keys(newHeld), txDivergences, txStaleCleared };
  });

  const divergences = [...derivationDivergences, ...result.txDivergences];
  for (const d of divergences) {
    console.warn(`${LOG_PREFIX} reconcile ${groupId}: [${d.type}] ${d.symbol ?? ''} — ${d.details}`);
  }

  return {
    groupId,
    battles: battles.length,
    holders: latestByAgent.size,
    heldCount: result.heldSymbols.length,
    // P6b: the reconciled agent-held symbol list (one agent per symbol within
    // a group, by exclusivity). The nightly leaderboard branch threads this
    // into the consensus/contrarian feeds — read-only reuse of THIS pass's
    // ledger read, so the feeds cost zero new reads (founder ruling, Option 1).
    heldSymbols: result.heldSymbols,
    divergences,
    staleCleared: result.txStaleCleared,
  };
}

/**
 * The nightly pass over every in-battle group. Rides the daily-scores window
 * (snake-draft-daily-scores tournament branch) — zero new cron entries. Zero
 * groups is a clean no-op (the production state until P3+); one group's
 * failure never blocks the rest.
 */
export async function reconcileAllTournamentLedgers(db, { now = new Date() } = {}) {
  // P6b: `heldByGroup` carries each group's reconciled agent-held symbols out
  // to the leaderboard branch (banking → reconcile → leaderboard) so the
  // consensus/contrarian feeds reuse THIS pass's ledger reads. A group that
  // errors below is simply absent from the map — its feed degrades honestly
  // (omitted, not crashed), per the founder constraint on Option 1.
  const summary = { groups: 0, reconciled: 0, divergences: 0, staleCleared: 0, errors: 0, heldByGroup: {} };

  const groupsSnap = await db
    .collection(TOURNAMENT_GROUPS_COLLECTION)
    .where('status', '==', GROUP_STATUS.BATTLE)
    .get();

  const groups = [];
  groupsSnap.forEach(doc => groups.push({ id: doc.id, ...doc.data() }));
  summary.groups = groups.length;
  if (groups.length === 0) return summary;

  for (const group of groups) {
    try {
      const result = await reconcileGroupLedger(db, group, { now });
      summary.reconciled++;
      summary.divergences += result.divergences.length;
      summary.staleCleared += result.staleCleared;
      summary.heldByGroup[group.id] = result.heldSymbols;
    } catch (err) {
      console.error(`${LOG_PREFIX} reconcile failed for group ${group.id}:`, err.message);
      summary.errors++;
    }
  }

  return summary;
}
