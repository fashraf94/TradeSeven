// api/tournament/team-card.js
//
// GET /api/tournament/team-card?groupId=&odUserId= — Backing Beta PR 4, THE
// TEAM CARD PROJECTION (spec V1.3 §5 "Team Card — server projections only",
// ruling D-l/D-y; design brief rev2 §2–§4, rev3 §2; §12 PR 4 "projection only,
// owner lookup"). Surface B is a PROJECTION-ONLY card: every agent-derived
// field on it comes from this route, and the client never reads the `agents`
// collection (spec §5 — "No client read of the agents doc"; the agents read
// rule is one of the §11 gate-3 honesty fixes precisely because it exposes
// live rules and traits to any signed-in user).
//
// THE ORDER, the same rungs the other backing routes climb:
//   1  security middleware + rate limit
//   2  method — GET only
//   3  auth
//   4  THE FLAG — 404 while BACKING_BETA_ENABLED is dark, AFTER auth
//   5  the seat, then the projection
//
// WHAT THE CARD IS (rev2 §2): the TEAM — this person plus this agent — leads,
// the archetype demoted to a supporting tag. So the projection returns:
//   · the team unit: display name, the human's PITCH (teamPitches/{uid}, the
//     player's own words), the DERIVED LINE (src/constants/deriveWeekLine.js —
//     recorded facts only), the agent's name, archetype + display label and
//     the archetype's stated APPROACH — both read through the registry's ONE
//     read surface (api/_utils/archetypeRegistry.js getArchetypeDefinition:
//     `displayName` and `identity.disposition`, the canonical per-archetype
//     behaviour copy, ARCHETYPE_IDENTITY_CONTRACT §2; BUILD_RULES §2.3 admits
//     no new direct importer of the archetype tables; never invented here,
//     `null` for an unknown archetype), and LOADOUT
//     COUNTS ONLY — trait count, rule count. Never the contents (§3 of the
//     original brief: "counts only, never the rule contents").
//   · the known facts — COMPLETED HISTORY ONLY (rev3 §2 cut the live standing):
//     career RP and tier from tournamentRanks, prior placements from the rank
//     history, weeks played. No live standing, no current-week score. A
//     first-week team gets `known: null` and the card shows "no weeks yet"; a
//     CPU seat gets archetype and no history (spec §5).
//   · LAST WEEK's portfolios, both layers (rev2 §3): the human's three drafted
//     picks (the streams/userDraft record) and what became of them at close
//     (the roster's legs, the approved claims in claimSystem.processingLog),
//     and the agent's six (the first completed battle's frozen
//     initialPortfolio) with every recorded swap (trades[] across the week's
//     daily-chained battles) and the WHY the agent recorded on each. All of it
//     is read from COMPLETED, PUBLIC data: the player's most recent completed
//     base-layer group-week, found through the rank history's applied groups,
//     and its battles projected through the same `projectTournamentBattle` the
//     spectator read path uses — a completed battle projects to itself (the
//     Film Room unlock), so no live WHY can leak from here even by accident.
//     FACTS ON THE WIRE, WORDS IN THE COPY MODULE: each pick carries what was
//     recorded (held / flipped / swapped, the day, the counterpart symbol),
//     and the client renders the sentence, so every user-facing string sits
//     under the one copy guard.
//   · the tape link — the completed week's group and the seat to focus, for
//     the existing spectator battle view (GET /api/tournament/battle-view).
//
// NOTHING HERE IS FIXTURE DATA. There is no reasoning map, no placeholder
// tape, no default finish: a field the writers did not record is `null` and the
// card says so. (The known honesty defect at LeagueSpectate.jsx:109 — the
// fixture REASONING map — is a §11 gate-3 fix and is not reached from here.)
//
// THE OWNER LOOKUP (spec §1 D-y: "the Team Card shows the owner's current agent
// (owner lookup, clones excluded)"): `agents where ownerId == odUserId`, then
// the training-clone / casual-clone markers AND the clone id prefixes are
// excluded, the `subscribeToUserAgent` client rule mirrored server-side. CPU
// seats resolve their archetype from the id alone (`cpuArchetypeForN`, the same
// deterministic map the lobby and the leaderboard use) and their counts from
// the system agent doc when one exists.
//
// THE NAMES ARE THE ONE RESOLVER'S (Amendment C §C1, D-af): the card's human
// row keeps its display name and the agent row its agent — the human-and-agent
// unit as designed — and the projection also carries the seat's `label` (its
// primary agent's name) and `secondary` for the single-label uses the pod row,
// the stake control and the confirmation share. All of it comes from
// api/_utils/backingTeamLabels.js, whose owner lookup IS this card's (board
// production's selection, `primaryAgentDocFrom`), so the card reads the owner's
// agents once and never answers an account id: a seat whose player name
// resolves nowhere reads "Unnamed team" (the pre-flip fallback was the id).
//
// READS ONLY — this route writes nothing, ever. Imports the zero-import src/
// modules under the revised June 2026 import rule (BUILD_RULES §4); the
// co-located test's real import of THIS module is the dependency-surface guard.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { liveTeamsFor, readGroup } from '../_utils/backingPools.js';
import { labelSeatOf, primaryAgentDocFrom, resolveTeamLabels } from '../_utils/backingTeamLabels.js';
import { UNNAMED_TEAM_LABEL } from '../../src/constants/backing.js';
import { projectTournamentBattle } from '../_utils/tournamentBattleView.js';
import { readPitch } from '../_utils/teamPitch.js';
import { deriveWeekLine } from '../../src/constants/deriveWeekLine.js';
import { getArchetypeDefinition } from '../_utils/archetypeRegistry.js';
import { findForbiddenTerm } from '../../src/constants/backingLexicon.js';
// PR 5 (§2G): the backing-safe twin of a canonical approach line that fails the lexicon — this projection's alone.
import { backingSafeApproach } from '../../src/constants/backingApproach.js';
import { COMPANY_SECTORS } from '../../src/config/stockData.js';
import {
  GROUP_STATUS,
  TOURNAMENT_GAME_MODE,
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_RANKS_COLLECTION,
  STREAMS_SUBCOLLECTION,
  USER_DRAFT_STREAM_DOC_ID,
  cpuAgentDocId,
  cpuArchetypeForN,
  cpuNFromUserId,
  getWeeklyComposite,
  isWeekBanked,
  rankDocId,
} from '../../src/constants/leagueTournament.js';
import { BACKING_BETA_ENABLED } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 10 };

/** The agents collection this route READS (never writes). Reused, never modified. */
export const AGENTS_COLLECTION = 'agents';

/** The battles collection this route READS for the completed week's tape. */
export const AGENT_BATTLES_COLLECTION = 'agentBattles';

/**
 * How far back in the rank history the projection walks to find the player's
 * most recent COMPLETED base-layer group-week. Bounded so one card costs a
 * bounded number of group reads; an event beyond this window is history the
 * card does not carry (the known-facts strip still counts it).
 */
export const HISTORY_LOOKBACK = 5;

/** The last N placements the known-facts strip shows (the design's "Last 3 wks"). */
export const PRIOR_FINISHES = 3;

// ==================== SMALL PURE HELPERS ====================

/** The ET weekday label for an ISO instant — 'MON'…'SUN' — or null when unreadable. */
export function etDayLabel(iso) {
  if (typeof iso !== 'string' || iso.length === 0) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' })
    .format(date)
    .toUpperCase();
}

/**
 * The agent's public identity + LOADOUT COUNTS ONLY. The only fields of an
 * agents document that ever leave this route. Everything else on the doc —
 * activeRules (rules + params + hardness), equippedTraits, equippedBundleIds,
 * config, memory, the equipped watchlist — stays behind it.
 */
/**
 * True when the text carries none of the backing lexicon's forbidden terms —
 * the ONE matcher (src/constants/backingLexicon.js) the copy guard uses too,
 * so "bets" is caught here exactly as it would be in the copy module and
 * "between" is clean in both (R-B-5, the PR 4 review record).
 */
export function passesBackingLexicon(text) {
  if (typeof text !== 'string' || text.length === 0) return false;
  return findForbiddenTerm(text) == null;
}

export function projectAgent(data, { archetype = data?.archetype ?? null } = {}) {
  const key = typeof archetype === 'string' && archetype.length > 0 ? archetype : null;
  // The registry's definition for a known archetype; null for anything else,
  // so an unknown archetype gets no label and no approach — never a guess,
  // never the analyst's line borrowed as a fallback.
  const definition = key ? getArchetypeDefinition(key) : null;
  // The archetype's STATED approach — the canonical per-archetype copy — and
  // ONLY when it passes the backing lexicon. A canonical line that names a
  // forbidden term (the diversifier's "Spreads the bets…") is never rewritten
  // here: PR 4 omitted it (DOM-2, the PR 4 review record); PR 5 (§2G) shows
  // its BACKING-SAFE TWIN from src/constants/backingApproach.js — a second
  // line kept alongside the canonical one, used by this projection alone —
  // and still nothing when no twin exists.
  const disposition = definition?.identity?.disposition ?? null;
  return {
    name: typeof data?.name === 'string' && data.name.length > 0 ? data.name : null,
    archetype: key,
    archetypeLabel: definition?.displayName ?? null,
    approach: passesBackingLexicon(disposition) ? disposition : backingSafeApproach(key, disposition),
    traitCount: Array.isArray(data?.equippedTraits) ? data.equippedTraits.length : null,
    ruleCount: Array.isArray(data?.activeRules) ? data.activeRules.length : null,
  };
}

/** The six symbols of a battle portfolio, star → core → support, with the recorded sector. */
function flattenPortfolio(portfolio) {
  const out = [];
  for (const tier of ['star', 'core', 'support']) {
    const slots = Array.isArray(portfolio?.[tier]) ? portfolio[tier] : [];
    for (const holding of slots) {
      const symbol = holding && (holding.symbol || holding.ticker);
      if (typeof symbol !== 'string' || symbol.length === 0) continue;
      out.push({ symbol, sector: typeof holding.sector === 'string' ? holding.sector : null });
    }
  }
  return out;
}

/** The completed-history strip's facts from a rank doc, or null when there is no history. */
export function knownFactsFrom(rank) {
  const history = Array.isArray(rank?.history) ? rank.history : [];
  const applied = rank?.appliedGroups && typeof rank.appliedGroups === 'object' ? Object.keys(rank.appliedGroups).length : 0;
  const weeksPlayed = Math.max(applied, history.length);
  if (weeksPlayed === 0) return null;
  return {
    rp: Number.isFinite(rank.rp) ? rank.rp : null,
    tier: Number.isFinite(rank.tier) ? rank.tier : null,
    tierName: typeof rank.tierName === 'string' ? rank.tierName : null,
    weeksPlayed,
    // Most recent first — the writer appends chronologically.
    priorFinishes: history.slice(-PRIOR_FINISHES).reverse()
      .map((e) => (Number.isInteger(e?.placement) ? e.placement : null)),
  };
}

// ==================== READS ====================

/**
 * The owner's current RANKED agent — clones excluded — or null. The selection
 * is the label resolver's (`primaryAgentDocFrom`: board production's first
 * non-clone document in id order), so the card's agent and the seat's label
 * can never name two different agents.
 */
export async function ownerAgentFor(db, odUserId) {
  const snap = await db.collection(AGENTS_COLLECTION).where('ownerId', '==', odUserId).get();
  const docs = [];
  snap.forEach((doc) => docs.push(doc));
  const primary = primaryAgentDocFrom(docs);
  return primary ? projectAgent(primary.data) : null;
}

/** A CPU seat's agent: archetype from the id, counts from the system doc when it exists. */
export async function cpuAgentFor(db, odUserId, displayName) {
  const n = cpuNFromUserId(odUserId);
  if (n == null) return null;
  let archetype = null;
  try { archetype = cpuArchetypeForN(n); } catch { archetype = null; }
  let data = {};
  try {
    const snap = await db.collection(AGENTS_COLLECTION).doc(cpuAgentDocId(n)).get();
    if (snap.exists) data = snap.data() ?? {};
  } catch (err) {
    console.warn(`[team-card] cpu agent doc unreadable for ${odUserId}:`, err?.message);
  }
  const projected = projectAgent(data, { archetype });
  // A CPU's agent IS the seat (spec §1: "CPU seats are cpu-{n}") — one name.
  return { ...projected, name: projected.name ?? displayName ?? null };
}

/** The rank doc, or null. */
async function readRank(db, odUserId, { dev = false } = {}) {
  const snap = await db.collection(TOURNAMENT_RANKS_COLLECTION).doc(rankDocId(odUserId, { dev })).get();
  return snap.exists ? snap.data() : null;
}

/** The §7 predicate's completed-week half: a banked, complete, base-layer, non-training group. */
function isCompletedBaseLayerWeek(group) {
  return group != null
    && group.status === GROUP_STATUS.COMPLETE
    && group.isTraining !== true
    && group.baseLayerWeek != null
    && isWeekBanked(group);
}

/** The owner's completed tournament battles for a group, oldest first. */
async function completedBattlesFor(db, groupId, odUserId) {
  const snap = await db.collection(AGENT_BATTLES_COLLECTION).where('groupId', '==', groupId).get();
  const raw = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (data?.ownerId !== odUserId) return;
    if (data?.gameMode !== TOURNAMENT_GAME_MODE) return;
    if (data?.status !== 'completed') return;
    raw.push({ id: doc.id, ...data });
  });
  raw.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  // Projected for a NON-owner: a completed battle projects to itself, and
  // anything not completed would come back WHAT-only. Both are what the card
  // may show — the projector is the one seam, so it is called here too.
  return raw.map((b) => projectTournamentBattle(b, { isOwner: false }));
}

/**
 * The human's three drafted picks and what became of them, from the draft
 * stream, the roster at close and the approved claims. FACTS, not sentences.
 */
export function humanLayerFrom({ drafted, player, approvedClaims }) {
  const picksAtClose = Array.isArray(player?.picks) ? player.picks : null;
  const bySymbol = new Map((picksAtClose ?? []).map((p) => [p?.symbol, p]));
  const swappedOut = new Map(approvedClaims.map((c) => [c.dropSymbol, c]));
  const swappedIn = new Map(approvedClaims.map((c) => [c.addSymbol, c]));
  // The draft record: absent (no stream, or no events for this seat) means the
  // three are UNKNOWN. The roster at close is then the only fact, and no name
  // is called drafted, held all week or claimed without a record of it
  // (FAB-6, the PR 4 review record).
  const draftKnown = Array.isArray(drafted) && drafted.length > 0;
  const rosterPick = (pick) => {
    const legs = Array.isArray(pick.legs) ? pick.legs : [];
    const last = legs[legs.length - 1];
    return {
      symbol: pick.symbol,
      heldAtClose: true,
      flips: Math.max(0, legs.length - 1),
      direction: typeof last?.direction === 'string' ? last.direction : null,
      lastFlipDay: legs.length > 1 ? etDayLabel(last?.openedAt) : null,
    };
  };

  const picks = [];
  if (draftKnown) {
    for (const symbol of drafted) {
      const pick = bySymbol.get(symbol);
      if (pick) {
        // On the roster at close. Dropped on the wire and claimed back later
        // is recorded as such — never "held all week".
        const dropped = swappedOut.get(symbol) ?? null;
        const reclaimed = swappedIn.get(symbol) ?? null;
        picks.push({
          ...rosterPick(pick),
          drafted: true,
          swappedOut: null,
          dropped: dropped && reclaimed ? { day: dropped.day, forSymbol: dropped.addSymbol } : null,
          reclaimed: dropped && reclaimed ? { day: reclaimed.day, forSymbol: reclaimed.dropSymbol } : null,
        });
      } else {
        const claim = swappedOut.get(symbol) ?? null;
        picks.push({
          symbol,
          drafted: true,
          heldAtClose: false,
          flips: null,
          direction: null,
          lastFlipDay: null,
          swappedOut: claim ? { day: claim.day, forSymbol: claim.addSymbol } : { day: null, forSymbol: null },
        });
      }
    }
    // Names claimed IN during the week — on the roster at close, not drafted.
    for (const pick of picksAtClose ?? []) {
      if (!pick?.symbol || drafted.includes(pick.symbol)) continue;
      const claim = swappedIn.get(pick.symbol) ?? null;
      picks.push({ ...rosterPick(pick), drafted: false, claimedIn: claim ? { day: claim.day, forSymbol: claim.dropSymbol } : { day: null, forSymbol: null } });
    }
  } else {
    for (const pick of picksAtClose ?? []) {
      if (!pick?.symbol) continue;
      const claim = swappedIn.get(pick.symbol) ?? null;
      picks.push({ ...rosterPick(pick), drafted: null, claimedIn: claim ? { day: claim.day, forSymbol: claim.dropSymbol } : null });
    }
  }
  return {
    drafted: draftKnown ? drafted : null,
    heldAtClose: picksAtClose ? picksAtClose.map((p) => p?.symbol).filter(Boolean) : null,
    picks,
  };
}

/**
 * The agent's six and every recorded swap, from the week's completed battles.
 * FACTS, not sentences; the rationale is the agent's own recorded words.
 */
export function agentLayerFrom(battles) {
  if (!Array.isArray(battles) || battles.length === 0) return null;
  const first = battles[0];
  const last = battles[battles.length - 1];
  // The opening book is the first battle's frozen `initialPortfolio`. Without
  // it the six are UNKNOWN and the closing book is the only fact — never the
  // closing book re-labelled as the draft (FAB-7, the PR 4 review record).
  const initial = first.agentContext?.initialPortfolio ? flattenPortfolio(first.agentContext.initialPortfolio) : null;
  const closing = flattenPortfolio(last.portfolio);
  const atClose = new Set(closing.map((h) => h.symbol));
  const trades = [];
  for (const battle of battles) {
    for (const t of Array.isArray(battle.trades) ? battle.trades : []) {
      if (typeof t?.symbolOut !== 'string' || typeof t?.symbolIn !== 'string') continue;
      trades.push({
        day: etDayLabel(t.swappedOutAt),
        symbolOut: t.symbolOut,
        symbolIn: t.symbolIn,
        rationale: typeof t.rationale === 'string' && t.rationale.length > 0
          ? t.rationale
          : (typeof t.hypothesis === 'string' && t.hypothesis.length > 0 ? t.hypothesis : null),
      });
    }
  }
  const out = new Map(trades.map((t) => [t.symbolOut, t]));
  const added = new Map(trades.map((t) => [t.symbolIn, t]));
  let picks;
  if (initial) {
    picks = initial.map((h) => ({
      symbol: h.symbol,
      sector: h.sector,
      drafted: true,
      heldAtClose: atClose.has(h.symbol),
      swappedOut: out.has(h.symbol) ? { day: out.get(h.symbol).day, forSymbol: out.get(h.symbol).symbolIn } : null,
    }));
    const initialSet = new Set(initial.map((h) => h.symbol));
    for (const t of trades) {
      if (initialSet.has(t.symbolIn) || picks.some((p) => p.symbol === t.symbolIn)) continue;
      picks.push({
        symbol: t.symbolIn,
        sector: null,
        drafted: false,
        heldAtClose: atClose.has(t.symbolIn),
        addedIn: { day: t.day, forSymbol: t.symbolOut },
      });
    }
  } else {
    picks = closing.map((h) => ({
      symbol: h.symbol,
      sector: h.sector ?? null,
      drafted: null,
      heldAtClose: true,
      addedIn: added.has(h.symbol) ? { day: added.get(h.symbol).day, forSymbol: added.get(h.symbol).symbolOut } : null,
    }));
  }
  return { picks, trades, swaps: trades.length, agentName: typeof first.agentContext?.agentName === 'string' ? first.agentContext.agentName : null };
}

/**
 * The player's most recent COMPLETED base-layer group-week, as the card shows
 * it, or null when there is none (a first-week team).
 */
export async function lastCompletedWeekFor(db, { odUserId, rank, currentGroupId, dev = false }) {
  const history = Array.isArray(rank?.history) ? rank.history : [];
  const candidates = [...history].reverse()
    .map((e) => e?.groupId)
    .filter((id) => typeof id === 'string' && id.length > 0 && id !== currentGroupId)
    .slice(0, HISTORY_LOOKBACK);

  for (const groupId of candidates) {
    const group = await readGroup(db, groupId);
    if (!isCompletedBaseLayerWeek(group)) continue;
    if (dev !== (group.isDev === true)) continue;

    const player = (group.players || []).find((p) => p?.odUserId === odUserId) ?? null;

    // The draft record — the three the human actually drafted, in pick order.
    let drafted = null;
    const streamSnap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId)
      .collection(STREAMS_SUBCOLLECTION).doc(USER_DRAFT_STREAM_DOC_ID).get();
    if (streamSnap.exists) {
      const events = Array.isArray(streamSnap.data()?.events) ? streamSnap.data().events : [];
      drafted = events
        .filter((e) => e?.odUserId === odUserId && typeof e?.symbol === 'string')
        .sort((a, b) => (a.pickNumber ?? 0) - (b.pickNumber ?? 0))
        .map((e) => e.symbol);
    }

    // The approved claims — the user layer's swaps, from the processing log.
    const log = group.claimSystem?.processingLog;
    const approvedClaims = [];
    if (Array.isArray(log)) {
      for (const entry of log) {
        for (const r of Array.isArray(entry?.results) ? entry.results : []) {
          if (r?.odUserId !== odUserId || r?.status !== 'approved') continue;
          approvedClaims.push({ dropSymbol: r.dropSymbol, addSymbol: r.addSymbol, day: etDayLabel(entry.processedAt) });
        }
      }
    }

    const battles = await completedBattlesFor(db, groupId, odUserId);
    const human = humanLayerFrom({ drafted, player, approvedClaims });
    const agent = agentLayerFrom(battles);

    // The composite from the week's banked scores (the tournament's own
    // comparator); the PLACEMENT as the rank writer recorded it for this
    // group — the career record, one source, never a re-ranking here
    // (DOM-4 / FAB-12, the PR 4 review record). No record, no finish.
    const members = (group.players || []).map((p) => p?.odUserId).filter(Boolean);
    const scores = Object.fromEntries(members.map((id) => [id, getWeeklyComposite(group, id)]));
    const recorded = rank?.appliedGroups?.[groupId]?.placement ?? history.find((e) => e?.groupId === groupId)?.placement;
    const placement = Number.isInteger(recorded) && recorded > 0 ? recorded : null;

    // The sector lookup for the LEAN clause — the repo's own map, held names only.
    const sectors = {};
    for (const symbol of human.heldAtClose ?? []) {
      if (typeof COMPANY_SECTORS[symbol] === 'string') sectors[symbol] = COMPANY_SECTORS[symbol];
    }

    return {
      facts: {
        drafted: human.drafted,
        heldAtClose: human.heldAtClose,
        userSwaps: Array.isArray(log) ? approvedClaims.length : null,
        agentSwaps: agent ? agent.swaps : null,
        sectors,
      },
      card: {
        groupId,
        baseLayerWeek: group.baseLayerWeek,
        placement,
        seatCount: members.length,
        composite: Number.isFinite(scores[odUserId]) ? scores[odUserId] : null,
        human: { drafted: human.drafted, picks: human.picks },
        agent: agent ? { agentName: agent.agentName, picks: agent.picks, trades: agent.trades, swaps: agent.swaps } : null,
        tape: { groupId, focusId: odUserId },
      },
    };
  }
  return null;
}

// ==================== THE CARD ====================

export async function buildTeamCard(db, { group, seats, seatIndex, viewerUid }) {
  const seat = seats[seatIndex];
  const { odUserId, isCpu } = seat;
  const dev = group.isDev === true;

  // THE NAMES, from the ONE resolver (D-af): the seat's label and secondary
  // — what the pod row, the stake control and the confirmation show — and the
  // player's display name for the human row: the pod's own formation-time
  // seat name first, so the card agrees with the row that opened it (DOM-7,
  // the PR 4 review record), then the profile. Never the account id.
  const labelSeat = labelSeatOf({ group }, odUserId, isCpu);
  const labels = await resolveTeamLabels(db, [labelSeat]);
  const { label, secondary } = labels.teamLabelFor(labelSeat);
  const displayName = isCpu ? label : (labels.displayNameFor(odUserId, labelSeat.seatName) ?? UNNAMED_TEAM_LABEL);

  // The owner's agent is the one the label named — the resolver already read
  // the owner's agents, so the card projects that document (no second query).
  const primary = isCpu ? null : labels.primaryAgentFor(odUserId);
  const agent = isCpu ? await cpuAgentFor(db, odUserId, displayName) : (primary ? projectAgent(primary.data) : null);
  const pitch = isCpu ? null : await readPitch(db, odUserId);
  const rank = await readRank(db, odUserId, { dev });
  // Completed history only. A CPU seat shows archetype and no history (spec §5).
  const known = isCpu ? null : knownFactsFrom(rank);
  const lastWeek = isCpu ? null : await lastCompletedWeekFor(db, { odUserId, rank, currentGroupId: group.id, dev });

  return {
    groupId: group.id,
    odUserId,
    viewerUid,
    seat: {
      index: seatIndex + 1,
      count: seats.length,
      isCpu,
      isViewer: odUserId === viewerUid,
      viewerSeated: seats.some((s) => s.odUserId === viewerUid),
    },
    team: {
      displayName,
      label,
      secondary,
      isCpu,
      pitch,
      derived: lastWeek ? deriveWeekLine({ ...lastWeek.facts, isCpu }) : null,
      agent,
    },
    known,
    lastWeek: lastWeek ? lastWeek.card : null,
  };
}

export default async function handler(req, res) {
  // 1. Security middleware + rate limit.
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 60, windowMs: 60000 } })) return;

  // 2. Method.
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });

  // 3. Auth.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. THE FLAG, read at call time, after auth.
  if (!BACKING_BETA_ENABLED) return res.status(404).json({ error: 'Not found' });

  // 5. Input.
  const groupId = typeof req.query?.groupId === 'string' ? req.query.groupId : '';
  const odUserId = typeof req.query?.odUserId === 'string' ? req.query.odUserId : '';
  if (!isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'A valid groupId is required.' });
  }
  if (!isValidForgeId(odUserId)) {
    return res.status(400).json({ error: 'invalid_team', message: 'A valid odUserId is required.' });
  }

  const db = getFirebaseAdmin();
  try {
    const group = await readGroup(db, groupId);
    if (group == null) return res.status(404).json({ error: 'no_pod' });
    const seats = liveTeamsFor(group);
    const seatIndex = seats.findIndex((s) => s.odUserId === odUserId);
    if (seatIndex < 0) return res.status(404).json({ error: 'seat_not_present' });

    const card = await buildTeamCard(db, { group, seats, seatIndex, viewerUid: user.uid });
    return res.status(200).json(card);
  } catch (err) {
    console.error('[team-card] projection failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not load the team card.' });
  }
}
