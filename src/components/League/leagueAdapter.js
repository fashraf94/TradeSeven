// src/components/League/leagueAdapter.js
//
// PURE mapping core for the League real-data adapter (Phase 1). Maps the
// System-1 read-model — tournamentGroups (your group + the base-layer field),
// tournamentBrackets (the funnel), dailyScores (the composite standings), and
// the WHY-projected battles (useSpectatedTournamentBattles) — onto the
// Pod / Seat / BookItem shapes the redesign surfaces already consume
// (leagueFixtures.js §contract). No React, no Firestore: the orchestration
// (subscriptions, the users-name read) lives in useRealLeagueState; this module
// is the testable transform, and its co-located test's import IS the
// dependency-surface guard (BUILD_RULES §4 — must never be mocked).
//
// Founder rulings wired here (Phase-1 prompt A–F + the smaller gaps):
//  • A — CPU seat names are synthesized from the deterministic CPU archetype
//        (cpuArchetypeForN, id-derived — never the fenced cpuAgentName, never a
//        doc read); human names are injected by the hook (users/{uid} read).
//        Pod names use an evocative scheme (directional bracket pods, a cycled
//        pool for base-layer pods) — never "Round 2 · Game 3".
//  • C — live tape (price/change) is OUT of this adapter: book items carry tk +
//        dir (+ weight where stored). `c:0` keeps the UNCHANGED LeagueSpectate
//        bookChange finite (no NaN); `p` is omitted so PortfolioMini suppresses
//        the price/change cells.
//  • D — arch/archName ONLY from a deployed battle's agentContext (never
//        fabricated pre-battle).
//  • Scores — pscore/score ← compositePoints (CUMULATIVE: getWeeklyComposite =
//        the FINAL banked day's snapshot, never a re-sum), read from dailyScores.
//  • Smaller gaps — clock derived from the ET close schedule (secondsToEtClose);
//        watchers/presence omitted (no source); userBook weight omitted (none stored).

import {
  isCpuUserId,
  cpuNFromUserId,
  cpuArchetypeForN,
  getWeeklyComposite,
  GROUP_STATUS,
  GROUP_SIZE,
  bracketRoundKey,
} from '../../constants/leagueTournament';

// CPU ring color — mirrors leagueTokens LX.cpu, kept inline so this module pulls
// NO UI imports and stays node-clean (the unit test imports it directly).
const CPU_COLOR = '#9A8CE0';
// Saturated human seat hues (the fixture COLORS values), assigned deterministically
// by a hash of the odUserId so a player keeps one color across surfaces.
const HUMAN_PALETTE = ['#33B4C4', '#5B8DEF', '#F0C75E', '#E8927C', '#7BD88F', '#B79CED', '#5EEAD4', '#EBA6C8'];

// evocative pod-name schemes (ruling A) — never "Round N · Game M".
const BRACKET_R1_NAMES = ['East', 'West', 'North', 'South', 'Northeast', 'Northwest', 'Southeast', 'Southwest'];
const SEMI_NAMES = ['Semifinal I', 'Semifinal II', 'Semifinal III', 'Semifinal IV'];
const BASE_NAME_POOL = [
  'Vanguard', 'Meridian', 'Summit', 'Apex', 'Zenith', 'Vertex',
  'Keystone', 'Pinnacle', 'Cardinal', 'Beacon', 'Horizon', 'Citadel',
];

// ── small pure helpers ──────────────────────────────────────────────────────
function hashStr(s) {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function titleCaseSnake(snake) {
  return String(snake || '')
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function num(x) {
  return Number.isFinite(x) ? x : 0;
}

/** Seat ring color — CPUs share the identity violet; humans hash to a stable hue. */
export function seatColor(odUserId, isCpu) {
  if (isCpu) return CPU_COLOR;
  return HUMAN_PALETTE[hashStr(odUserId) % HUMAN_PALETTE.length];
}

/**
 * CPU seat name (ruling A): "CPU · {Archetype Label}", derived from the
 * deterministic id→archetype map — coverage-complete pre- and post-battle, no
 * doc read, and never the fenced cpuAgentName.
 */
export function cpuSeatName(odUserId) {
  const n = cpuNFromUserId(odUserId);
  if (n == null) return 'CPU';
  try {
    return `CPU · ${titleCaseSnake(cpuArchetypeForN(n))}`;
  } catch {
    return 'CPU';
  }
}

/** Evocative bracket pod name (ruling A): directional R1, Semifinal mids, Final Four terminal. */
export function bracketPodName(roundNumber, gameIndex, totalRounds) {
  const gi = Number.isInteger(gameIndex) && gameIndex >= 1 ? gameIndex : 1;
  if (roundNumber <= 1) return BRACKET_R1_NAMES[(gi - 1) % BRACKET_R1_NAMES.length];
  if (totalRounds && roundNumber >= totalRounds) return 'Final Four';
  return SEMI_NAMES[(gi - 1) % SEMI_NAMES.length];
}

/** Evocative base-layer pod name (ruling A): a cycled pool keyed by group id. */
export function baseGroupName(groupId) {
  return BASE_NAME_POOL[hashStr(groupId) % BASE_NAME_POOL.length];
}

/**
 * Seconds until the next 4:00 PM ET close — the live-pod countdown, derived
 * client-side from the ET schedule (smaller-gaps ruling). Intl-based so it is
 * DST-correct without hand-rolled offsets. Returns null if it can't compute
 * (StatusBadge then shows a bare "LIVE").
 */
export function secondsToEtClose(now = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = fmt.formatToParts(now);
    const get = (t) => Number(parts.find((p) => p.type === t)?.value);
    let h = get('hour');
    if (h === 24) h = 0; // some engines render midnight as 24
    const secNow = h * 3600 + get('minute') * 60 + get('second');
    if (!Number.isFinite(secNow)) return null;
    const close = 16 * 3600;
    let delta = close - secNow;
    if (delta <= 0) delta += 24 * 3600;
    return delta;
  } catch {
    return null;
  }
}

// ── book mappers (ruling C: tk + dir only; c:0 for bookChange safety; no p) ──
/** The user's 3-pick layer → BookItem[] (tk + dir). Live tape deferred. */
export function picksToUserBook(picks) {
  return (picks || [])
    .map((p) => ({
      tk: p && p.symbol,
      dir: (p && p.legs && p.legs[0] && p.legs[0].direction) || 'long',
      c: 0, // no live change in Phase 1; finite so the unchanged bookChange never NaNs
    }))
    .filter((b) => b.tk);
}

/**
 * The agent's 6-stock book ← the WHY-projected battle's portfolio (live, else
 * the frozen initialPortfolio). Long-only V1. Flattens the 2/2/2 star/core/
 * support tiers; holdings carry no stored weight, so `w` is omitted.
 */
export function battleToAgentBook(battle) {
  if (!battle) return [];
  const pf = battle.portfolio || battle.agentContext?.initialPortfolio || {};
  const book = [];
  for (const tier of [pf.star, pf.core, pf.support]) {
    if (!Array.isArray(tier)) continue;
    for (const h of tier) {
      const tk = h && (h.symbol || h.ticker || h.tk);
      if (tk) book.push({ tk, dir: 'long', c: 0 });
    }
  }
  return book;
}

/**
 * One Seat from whatever data a path has: the player's id/isCpu (always), the
 * cumulative composite score, optional picks (group docs only) and the
 * projected battle (the subscribed group only). Books degrade to [] (→
 * PortfolioMini's "seat reserved" line). Score is always finite (Score needs it).
 */
export function buildSeat({ odUserId, isCpu, score, picks = null, battle = null, names = {}, uid = null }) {
  const cpu = isCpu === true || isCpuUserId(odUserId);
  const you = !!uid && odUserId === uid;
  const name = cpu ? cpuSeatName(odUserId) : (names[odUserId] || odUserId);
  // archetype ONLY from a deployed battle (ruling D) — never fabricated.
  const archetype = battle?.agentContext?.archetype || null;
  const s = num(score);
  return {
    id: odUserId,
    name,
    kind: cpu ? 'cpu' : 'human',
    you,
    owner: cpu ? undefined : (you ? undefined : name),
    color: seatColor(odUserId, cpu),
    arch: archetype || undefined,
    archName: archetype ? titleCaseSnake(archetype) : undefined,
    score: s,
    pscore: s,
    userBook: picksToUserBook(picks),
    agentBook: battleToAgentBook(battle),
  };
}

/** group.status → the surface's pod status. */
export function groupStatusToPodStatus(status) {
  if (status === GROUP_STATUS.COMPLETE) return 'final';
  if (status === GROUP_STATUS.BATTLE) return 'live';
  return 'upcoming'; // forming / drafting / unknown
}

/**
 * A full group doc → Pod. Used for the base-layer field and (for the subscribed
 * group) anywhere we have the whole doc with players[].picks and the dailyScores.
 * `battlesByOwner` (ownerId→projected battle) is supplied only for the subscribed
 * group; otherwise agent books stay empty.
 */
export function groupToPod(group, { names = {}, uid = null, base = false, battlesByOwner = {}, name = null } = {}) {
  const status = groupStatusToPodStatus(group.status);
  const seats = (group.players || []).map((p) => buildSeat({
    odUserId: p.odUserId,
    isCpu: p.isCpu === true,
    score: getWeeklyComposite(group, p.odUserId),
    picks: p.picks,
    battle: battlesByOwner[p.odUserId] || null,
    names,
    uid,
  }));
  while (seats.length < GROUP_SIZE) seats.push(null);
  return {
    id: group.id,
    name: name || baseGroupName(group.id),
    round: group.roundNumber || 1,
    base,
    status,
    clock: status === 'live' ? secondsToEtClose() : null,
    // watchers omitted (no presence source) — Watchers renders nothing for undefined
    seats: seats.slice(0, GROUP_SIZE),
  };
}

// ── bracket → the fixed funnel topology (4 R1 · 2 R2 · 1 R3) ────────────────
function gamesOf(bracket, roundNumber) {
  const round = bracket?.rounds?.[bracketRoundKey(roundNumber)];
  const games = round && round.games ? Object.values(round.games) : [];
  return games.sort((a, b) => (a.gameIndex || 0) - (b.gameIndex || 0));
}

function emptyPod(id, name, round) {
  return { id, name, round, seats: [null, null, null, null], status: 'upcoming', clock: null };
}

/**
 * One bracket game → Pod. Per-seat score comes from the game's final composite
 * snapshot (finalScores, set at advancement); for the viewer's OWN live game we
 * overlay the group's cumulative composite + the projected agent book.
 */
function bracketGameToPod(game, { bracket, myGroup, battlesByOwner, names, uid, nodeId }) {
  const status = game.completedAt
    ? 'final'
    : (game._roundNumber <= (bracket.currentRound || 1) ? 'live' : 'upcoming');
  const isMine = !!myGroup && game.groupId === myGroup.id;
  const seats = (game.seats || []).map((s) => buildSeat({
    odUserId: s.odUserId,
    isCpu: s.isCpu === true,
    score: (game.finalScores && game.finalScores[s.odUserId] != null)
      ? game.finalScores[s.odUserId]
      : (isMine ? getWeeklyComposite(myGroup, s.odUserId) : 0),
    picks: isMine ? (myGroup.players || []).find((p) => p.odUserId === s.odUserId)?.picks : null,
    battle: isMine ? (battlesByOwner[s.odUserId] || null) : null,
    names,
    uid,
  }));
  while (seats.length < GROUP_SIZE) seats.push(null);
  return {
    id: nodeId,
    name: bracketPodName(game._roundNumber, game.gameIndex, bracket.totalRounds),
    round: game._roundNumber,
    status,
    clock: status === 'live' ? secondsToEtClose() : null,
    seats: seats.slice(0, GROUP_SIZE),
  };
}

const R1_NODE_IDS = ['east', 'west', 'north', 'south'];

/**
 * Map a real bracket onto the funnel's fixed 16→8→4 slots (the LeaguePod NODES
 * topology). Real games fill r1[0..3]/r2[0..1]/r3 by gameIndex; missing slots are
 * empty 'upcoming' pods (the fixtures' pre-resolution look). Larger brackets are
 * capped to the funnel's shape (Phase-1 funnel topology is fixed — discovery note).
 */
export function mapBracketToRounds(bracket, { myGroup = null, battlesByOwner = {}, names = {}, uid = null } = {}) {
  const ctx = { bracket, myGroup, battlesByOwner, names, uid };
  const r1games = gamesOf(bracket, 1).map((g) => ({ ...g, _roundNumber: 1 }));
  const r2games = gamesOf(bracket, 2).map((g) => ({ ...g, _roundNumber: 2 }));
  const terminal = bracket.totalRounds || 3;
  const r3games = gamesOf(bracket, terminal).map((g) => ({ ...g, _roundNumber: terminal }));

  const r1 = R1_NODE_IDS.map((nodeId, i) => (
    r1games[i] ? bracketGameToPod(r1games[i], { ...ctx, nodeId }) : emptyPod(nodeId, bracketPodName(1, i + 1, terminal), 1)
  ));
  const r2 = ['r2a', 'r2b'].map((nodeId, i) => (
    r2games[i] ? bracketGameToPod(r2games[i], { ...ctx, nodeId }) : emptyPod(nodeId, bracketPodName(2, i + 1, terminal), 2)
  ));
  const r3 = r3games[0]
    ? bracketGameToPod(r3games[0], { ...ctx, nodeId: 'r3' })
    : emptyPod('r3', 'Final Four', terminal);
  return { r1, r2, r3 };
}

/**
 * Your highlighted funnel path: the R1 node holding `uid` → its semifinal
 * (east/west→r2a, north/south→r2b) → the final. Empty when you're not in the
 * bracket (base-layer-only) — the funnel then highlights nothing.
 */
export function deriveFunnelPath(rounds, uid) {
  if (!uid || !rounds) return { groups: [] };
  const idx = rounds.r1.findIndex((pod) => (pod.seats || []).some((s) => s && s.id === uid));
  if (idx < 0) return { groups: [] };
  const r1Node = R1_NODE_IDS[idx];
  const r2Node = idx < 2 ? 'r2a' : 'r2b';
  return { groups: [r1Node, r2Node, 'r3'] };
}

/** The R1 funnel node id the viewer sits in (for the "Your group" card), or null. */
export function deriveYourGroupNode(rounds, uid) {
  const path = deriveFunnelPath(rounds, uid);
  return path.groups[0] ? { id: path.groups[0] } : null;
}

/**
 * Assemble the full LeagueState. Real sections replace the fixture fallback
 * where data exists; absent reads fall back to the corresponding fixture fill
 * (cold-start ruling — reuse the fill levels, no bespoke empty UI). Returns
 * { state, hasRealData }; hasRealData=false means we're showing pure fixtures
 * (signal-capture stays gated off).
 */
export function buildLeagueState({
  myGroup = null,
  bracket = null,
  fieldGroups = [],
  battlesByOwner = {},
  names = {},
  uid = null,
  fallback,
} = {}) {
  const hasRealData = !!(bracket || myGroup || (fieldGroups && fieldGroups.length));
  if (!hasRealData) {
    return { state: fallback, hasRealData: false };
  }

  const rounds = bracket
    ? mapBracketToRounds(bracket, { myGroup, battlesByOwner, names, uid })
    : fallback.rounds;
  const path = bracket ? deriveFunnelPath(rounds, uid) : fallback.path;
  const yourGroup = bracket ? (deriveYourGroupNode(rounds, uid) || fallback.yourGroup) : fallback.yourGroup;

  const baseGames = (fieldGroups && fieldGroups.length)
    ? fieldGroups.map((g) => groupToPod(g, {
      names,
      uid,
      base: true,
      // the projection is fetched for the subscribed group only; field pods that
      // happen to be your group get its agent books, others get [].
      battlesByOwner: (myGroup && g.id === myGroup.id) ? battlesByOwner : {},
    }))
    : fallback.baseGames;

  return {
    state: {
      ...fallback, // hero copy + the fixture `field` map + bracketCount stay fixture-sourced (out of Phase-1 mapping scope)
      rounds,
      path,
      yourGroup,
      baseGames,
      followLive: [], // no presence source in Phase 1 (live-pulse is Phase 4)
    },
    hasRealData: true,
  };
}
