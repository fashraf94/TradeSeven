// src/components/League/leagueAdapter.js
//
// PURE mapping core for the League real-data adapter (Phase 1). Maps the
// System-1 read-model — tournamentGroups (your group + the base-layer field),
// tournamentBrackets (the funnel), dailyScores (the composite standings), and
// the WHY-projected battles (useSpectatedTournamentBattles) — onto the
// Pod / Seat / BookItem shapes the redesign surfaces already consume
// (leagueFixtures.js §contract). No React, no Firestore, no clock read: the
// orchestration (subscriptions, the users-name read, the ET close time) lives in
// useRealLeagueState; this module is the testable transform, and its co-located
// test's import IS the dependency-surface guard (BUILD_RULES §4 — never mocked).
//
// Founder rulings wired here (Phase-1 prompt A–F + the smaller gaps):
//  • A — CPU seat names are synthesized from the deterministic CPU archetype
//        (cpuArchetypeForN, id-derived) using a client mirror of the server's
//        archetype labels, so a CPU reads the SAME across the lobby and the
//        leaderboard. Human names are injected by the hook (users/{uid} read).
//        Pod names use an evocative scheme — never "Round 2 · Game 3".
//  • C — live tape (price/change) is OUT of this adapter: book items carry tk +
//        dir. `c:0` keeps the UNCHANGED LeagueSpectate bookChange finite (no NaN);
//        `p` is omitted so PortfolioMini suppresses the price/change cells.
//  • D — arch/archName ONLY from a deployed battle's agentContext (never
//        fabricated pre-battle).
//  • Scores — pscore/score ← compositePoints (CUMULATIVE: getWeeklyComposite =
//        the FINAL banked day's snapshot, never a re-sum), read from dailyScores.
//  • Smaller gaps — `liveClock` (seconds to the ET close) is passed in by the hook
//        (computed ONCE via the centralized marketSchedule, holiday/early-close
//        aware); watchers/presence omitted; userBook weight omitted (none stored).

import {
  isCpuUserId,
  cpuNFromUserId,
  cpuArchetypeForN,
  getWeeklyComposite,
  GROUP_STATUS,
  GROUP_SIZE,
  bracketRoundKey,
} from '../../constants/leagueTournament';

// CPU ring color — mirrors leagueTokens LX.cpu; the human palette is the fixture
// COLORS set. Kept inline so this module pulls NO UI imports and stays node-clean
// (leagueTokens transitively imports the browser-side commandUI). If LX ever moves
// to a node-clean home, import it instead of duplicating.
const CPU_COLOR = '#9A8CE0';
const HUMAN_PALETTE = ['#33B4C4', '#5B8DEF', '#F0C75E', '#E8927C', '#7BD88F', '#B79CED', '#5EEAD4', '#EBA6C8'];

// Client mirror of api/_utils/agentArchetypeConfig.getArchetypeLabel for the CPU
// archetype set (that module is fenced + api-only, so it can't be imported into
// the client bundle). Kept in sync so a CPU's name matches the leaderboard/rank
// surfaces (which use the server cpuAgentName = "CPU — <label>"). If a label here
// drifts from agentArchetypeConfig, the same CPU would read two ways across
// surfaces — update both together.
const ARCHETYPE_LABELS = {
  momentum_chaser: 'Trend Follower',
  contrarian: 'Contrarian',
  diversifier: 'Diversifier',
  degen: 'Speculator',
  analyst: 'Fundamental Investor',
  guardian: 'Capital Preserver',
};

// evocative pod-name schemes (ruling A) — never "Round N · Game M".
const BRACKET_R1_NAMES = ['East', 'West', 'North', 'South', 'Northeast', 'Northwest', 'Southeast', 'Southwest'];
const SEMI_NAMES = ['Semifinal I', 'Semifinal II', 'Semifinal III', 'Semifinal IV'];
const BASE_NAME_POOL = [
  'Vanguard', 'Meridian', 'Summit', 'Apex', 'Zenith', 'Vertex',
  'Keystone', 'Pinnacle', 'Cardinal', 'Beacon', 'Horizon', 'Citadel',
];

const R1_NODE_IDS = ['east', 'west', 'north', 'south'];

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

// archetype → display label (server-parity labels; title-case fallback for any
// key not in the curated map).
function archetypeLabel(key) {
  return ARCHETYPE_LABELS[key] || titleCaseSnake(key);
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
 * CPU seat name (ruling A): "CPU — {Archetype Label}", derived from the
 * deterministic id→archetype map and the server-parity label set — matches the
 * server cpuAgentName format so a CPU reads identically across surfaces. No doc
 * read; coverage-complete pre- and post-battle.
 */
export function cpuSeatName(odUserId) {
  const n = cpuNFromUserId(odUserId);
  if (n == null) return 'CPU';
  try {
    return `CPU — ${archetypeLabel(cpuArchetypeForN(n))}`;
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

// ── book mappers (ruling C: tk + dir only; c:0 for bookChange safety; no p) ──
/**
 * The user's 3-pick layer → BookItem[] (tk + dir). Direction is the CURRENT
 * position — the LAST leg (a flip appends a leg; legs[0] would be stale). Live
 * tape deferred.
 */
export function picksToUserBook(picks) {
  return (picks || [])
    .map((p) => {
      const legs = (p && p.legs) || [];
      const leg = legs[legs.length - 1];
      return { tk: p && p.symbol, dir: (leg && leg.direction) || 'long', c: 0 };
    })
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
 * cumulative composite score, optional picks (group docs only) and the projected
 * battle (the subscribed group only). Books degrade to [] (→ PortfolioMini's
 * "seat reserved" line). Score is always finite (Score needs it).
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
    archName: archetype ? archetypeLabel(archetype) : undefined,
    score: s,
    pscore: s,
    userBook: picksToUserBook(picks),
    agentBook: battleToAgentBook(battle),
  };
}

/** group.status → the surface's pod status. */
export function groupStatusToPodStatus(status) {
  // EXPIRED (Training-Pod P0 R2) is terminal like COMPLETE — read it 'final', not
  // the 'upcoming' fallthrough, so a retired pod never shows as pending.
  if (status === GROUP_STATUS.COMPLETE || status === GROUP_STATUS.EXPIRED) return 'final';
  // L-A: a VOIDED group is TERMINAL (never pending/live). Mapped to 'final' here as
  // a safe terminal placeholder so it can never read 'upcoming'/'live'; no card path
  // surfaces a voided group in L-A (FIELD + active-group selectors exclude it). The
  // DISTINCT voided card (its own pod status + consumer audit) is the (B) follow-up.
  if (status === GROUP_STATUS.VOIDED) return 'final';
  if (status === GROUP_STATUS.BATTLE) return 'live';
  return 'upcoming'; // forming / drafting / unknown
}

/**
 * A full group doc → Pod (the base-layer field, and the subscribed group). The
 * `liveClock` (seconds to the ET close, computed once by the hook) is applied to
 * live pods. `battlesByOwner` is supplied only for the subscribed group; else
 * agent books stay empty.
 */
export function groupToPod(group, { names = {}, uid = null, base = false, battlesByOwner = {}, name = null, liveClock = null } = {}) {
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
    clock: status === 'live' ? liveClock : null,
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
 * overlay the group's cumulative composite + the projected agent book. A game
 * with finalScores (or completedAt) is FINAL even if completedAt hasn't been
 * stamped yet (advancement writes the two in steps; a resume path may still owe
 * completedAt — but the game is decided).
 */
function bracketGameToPod(game, { bracket, myGroup, battlesByOwner, names, uid, nodeId, liveClock }) {
  const decided = game.completedAt != null || game.finalScores != null;
  const status = decided
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
    clock: status === 'live' ? liveClock : null,
    seats: seats.slice(0, GROUP_SIZE),
  };
}

/**
 * Map a real bracket onto the funnel's fixed 16→8→4 slots (the LeaguePod NODES
 * topology). The terminal round always feeds the r3 champion node; round 1 feeds
 * r1; round 2 feeds the r2 semifinal tier ONLY when the bracket has ≥3 rounds
 * (an 8-player / 2-round bracket has NO semifinal tier — round 2 IS the final, so
 * it must not be duplicated into both r2 and r3). Unfilled slots are empty
 * 'upcoming' pods. Brackets larger than 16 players are capped to the funnel's
 * shape (Phase-1 funnel topology is fixed — discovery note).
 */
export function mapBracketToRounds(bracket, { myGroup = null, battlesByOwner = {}, names = {}, uid = null, liveClock = null } = {}) {
  const ctx = { bracket, myGroup, battlesByOwner, names, uid, liveClock };
  const terminal = bracket.totalRounds || 3;
  const r1games = (terminal >= 2 ? gamesOf(bracket, 1) : []).map((g) => ({ ...g, _roundNumber: 1 }));
  const r2games = (terminal >= 3 ? gamesOf(bracket, 2) : []).map((g) => ({ ...g, _roundNumber: 2 }));
  const r3games = gamesOf(bracket, terminal).map((g) => ({ ...g, _roundNumber: terminal }));

  const r1 = R1_NODE_IDS.map((nodeId, i) => (
    r1games[i] ? bracketGameToPod(r1games[i], { ...ctx, nodeId }) : emptyPod(nodeId, bracketPodName(1, i + 1, terminal), 1)
  ));
  const r2 = ['r2a', 'r2b'].map((nodeId, i) => (
    r2games[i] ? bracketGameToPod(r2games[i], { ...ctx, nodeId }) : emptyPod(nodeId, SEMI_NAMES[i], 2)
  ));
  const r3 = r3games[0]
    ? bracketGameToPod(r3games[0], { ...ctx, nodeId: 'r3' })
    : emptyPod('r3', 'Final Four', terminal);
  return { r1, r2, r3 };
}

/** The fully-empty funnel — the honest "bracket forming" fill for a real-data
 *  session where the viewer is not in a bracket (no fixture players bleed in). */
export function emptyRounds() {
  return {
    r1: R1_NODE_IDS.map((id, i) => emptyPod(id, bracketPodName(1, i + 1, 3), 1)),
    r2: ['r2a', 'r2b'].map((id, i) => emptyPod(id, SEMI_NAMES[i], 2)),
    r3: emptyPod('r3', 'Final Four', 3),
  };
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
  const r2Node = idx < 2 ? 'r2a' : 'r2b';
  return { groups: [R1_NODE_IDS[idx], r2Node, 'r3'] };
}

/**
 * Honest hero copy for the real-data surface (headline/sub/energy). NEVER the
 * fixture fill copy — that asserts a populated bracket / settled rounds that do
 * not exist for a pre-launch, base-layer-only, or cold-start session. Derived
 * from the real state: a session with no bracket reads as pre-season with the
 * tournament forthcoming ("the bracket opens when the season locks"); a real
 * bracket reads as in-season. `energy` drives whether the mobile hero shows its
 * sub line ('high'|'mid' show it) — so the pre-season sub surfaces once there's
 * a live base layer to explain.
 */
function honestHero({ bracketPending, baseGames, rounds }) {
  const liveField = (baseGames || []).some((p) => p && p.status === 'live');
  if (bracketPending) {
    return {
      energy: liveField ? 'mid' : 'low',
      headline: liveField ? 'The base layer is live' : 'League',
      sub: 'Play your weekly group of four — it feeds the leaderboard. The bracket opens when the season locks.',
    };
  }
  const liveBracket = [...rounds.r1, ...rounds.r2, rounds.r3].some((p) => p && p.status === 'live');
  return {
    energy: liveBracket ? 'high' : 'mid',
    headline: 'League · this season',
    sub: 'Follow the funnel to the Final Four.',
  };
}

/**
 * Assemble the full LeagueState from the real read-model — the SINGLE truth-
 * mapping seam. NO fixture data ever reaches the returned state: absent sections
 * are honestly empty (empty funnel, empty field, honest hero copy), never the
 * demo fill. This holds even at cold start (no real data at all): whenever the
 * real adapter is enabled the League tab reflects reality (honest-sparse) rather
 * than a fake-full demo. `hasRealData` is still returned so the seam keeps
 * signal-capture gated off until real data is present, and `bracketPending` lets
 * the surfaces render an explicit "bracket opens when the season locks" state.
 * Returns { state, hasRealData }.
 *
 * @param {number|null} liveClock seconds to the ET close (computed by the hook)
 */
export function buildLeagueState({
  myGroup = null,
  bracket = null,
  fieldGroups = [],
  battlesByOwner = {},
  names = {},
  uid = null,
  liveClock = null,
} = {}) {
  const hasRealData = !!(bracket || myGroup || (fieldGroups && fieldGroups.length));

  // The bracket funnel — real when a bracket doc exists, else the HONEST empty
  // funnel (no fixture players bleed in). `bracketPending` drives the surfaces'
  // explicit forthcoming state instead of a TBD skeleton that reads as broken.
  const bracketPending = !bracket;
  const rounds = bracket
    ? mapBracketToRounds(bracket, { myGroup, battlesByOwner, names, uid, liveClock })
    : emptyRounds();
  const path = deriveFunnelPath(rounds, uid);
  // yourGroup must be a non-null object (LeagueLobbyRedesign derefs .id); an id
  // that matches no R1 pod hides the "Your group" card (base-layer-only players).
  const yourGroup = path.groups[0] ? { id: path.groups[0] } : { id: null };

  // The base-layer field → real pods, or an HONEST empty list (never the fixture
  // demo groups). Defense-in-depth: the read (selectBaseLayerField) already
  // excludes training pods AND VOIDED groups, but gate here too so neither a
  // training pod nor a VOIDED group (whose contaminated composite seats must never
  // reach the leaderboard `field`) can slip into THE FIELD even if this adapter is
  // fed an unfiltered list. CPUs are NOT training pods (no isTraining flag) → stay.
  const baseGames = (fieldGroups && fieldGroups.length)
    ? fieldGroups
      .filter((g) => g?.isTraining !== true && g?.status !== GROUP_STATUS.VOIDED)
      .map((g) => groupToPod(g, {
        names,
        uid,
        base: true,
        // the projection is fetched for the subscribed group only; field pods that
        // happen to be your group get its agent books, others get [].
        battlesByOwner: (myGroup && g.id === myGroup.id) ? battlesByOwner : {},
        liveClock,
      }))
    : [];

  // The leaderboard "field" ← the REAL base-layer seats (real humans + CPUs +
  // real composite scores), deduped by id. Empty {} when there is no field, so
  // the header counts + leaderboard render their honest empty state — never the
  // 16 demo players. Reuses the already-built baseGames seats (single source).
  const field = {};
  baseGames.forEach((pod) => (pod.seats || []).forEach((s) => {
    if (s && s.id && !field[s.id]) field[s.id] = s;
  }));

  return {
    state: {
      ...honestHero({ bracketPending, baseGames, rounds }),
      field,
      rounds,
      path,
      yourGroup,
      baseGames,
      followLive: [], // no presence source in Phase 1 (live-pulse is Phase 4)
      bracketPending,
    },
    hasRealData,
  };
}
