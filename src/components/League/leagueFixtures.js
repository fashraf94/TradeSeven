// src/components/League/leagueFixtures.js
//
// The League fixture world — FOUR-player pods and a narrowing bracket funnel
// (16 → 8 → 4 → champion). One monthly bracket, flat scoring, no skill tiers;
// "divisions" = rounds × named groups. Transcribed from the Claude Design
// prototype (league-data.jsx).
//
// These shapes ARE the spec §4 data contract the presentation layer binds to:
//   Pod   { id, name, round, group?, seats:[Seat|null]×4, status, clock, watchers, base? }
//   Seat  { id, name, kind:'human'|'cpu', arch, archName, owner?, color, score,
//           pscore, you?, userBook:BookItem[3], agentBook:BookItem[6] }
//   BookItem { tk, dir:'long'|'short', w, p, c }
//   LeagueState { fill, rounds:{r1,r2,r3}, path, yourGroup, baseGames, followLive, ... }
//
// FIXTURES-FIRST: the real Firestore read-model (subscribeBracket/Group +
// useSpectatedTournamentBattles) is mapped onto these shapes by a future adapter
// behind the single useLeagueState() seam — surfaces never read Firestore directly.

import { LX } from './leagueTokens';

// ── live tape ──────────────────────────────────────────────────────────────
const TAPE = {
  NVDA: { p: 118.4, c: -2.1 }, AMD: { p: 162.7, c: -1.6 }, SMCI: { p: 41.2, c: -3.4 }, AVGO: { p: 1684, c: -1.2 },
  ANET: { p: 372.5, c: -0.8 }, VST: { p: 138.9, c: +2.7 }, XLU: { p: 78.3, c: +1.4 }, XLP: { p: 81.6, c: +0.9 },
  XLV: { p: 146.2, c: +0.5 }, KO: { p: 71.8, c: +0.7 }, PG: { p: 169.4, c: +0.4 }, XLE: { p: 94.1, c: +1.9 },
  CVX: { p: 158.2, c: +1.1 }, OXY: { p: 58.7, c: +2.2 }, AAPL: { p: 214.3, c: -0.3 }, MSFT: { p: 449.8, c: -0.6 },
  JPM: { p: 212.6, c: +0.6 }, COIN: { p: 241.5, c: -4.8 }, GLD: { p: 241.9, c: +0.8 }, TLT: { p: 92.4, c: +0.5 },
  META: { p: 588.1, c: -1.4 }, TSLA: { p: 248.4, c: -2.6 }, GOOGL: { p: 178.2, c: -0.7 },
};
const tk = (t, dir = 'long', w) => ({ tk: t, dir, w, ...TAPE[t] });

// book templates by archetype — userBook = the human's 3 hand-picks,
// agentBook = the agent's auto-managed 6-stock book.
const USER_BOOKS = {
  momentum: [tk('NVDA'), tk('VST'), tk('COIN')],
  reverter: [tk('XLP'), tk('KO'), tk('SMCI', 'short')],
  macro: [tk('XLE'), tk('GLD'), tk('TLT')],
  sentinel: [tk('XLU'), tk('GLD'), tk('XLV')],
};
const AGENT_BOOKS = {
  momentum: [tk('NVDA', 'long', 20), tk('AMD', 'long', 16), tk('AVGO', 'long', 16), tk('ANET', 'long', 16), tk('VST', 'long', 16), tk('META', 'long', 16)],
  reverter: [tk('XLP', 'long', 20), tk('KO', 'long', 18), tk('PG', 'long', 16), tk('SMCI', 'short', 16), tk('XLV', 'long', 16), tk('TLT', 'long', 14)],
  macro: [tk('XLE', 'long', 20), tk('CVX', 'long', 18), tk('OXY', 'long', 16), tk('GLD', 'long', 16), tk('TLT', 'long', 16), tk('XLU', 'long', 14)],
  sentinel: [tk('XLU', 'long', 22), tk('TLT', 'long', 18), tk('GLD', 'long', 16), tk('XLP', 'long', 16), tk('XLV', 'long', 16), tk('KO', 'long', 12)],
};
const ARCH_NAME = { momentum: 'Momentum Hunter', reverter: 'Mean Reverter', macro: 'Macro Strategist', sentinel: 'Risk Sentinel' };
const fixW = (b) => { const each = +(100 / b.length).toFixed(0); return b.map((h) => ({ ...h, w: h.w || each })); };

// ── the field — 16 players. `kind` here is the GOAL (open) state; the fill
//    level thins humans down for the earlier levels. ─────────────────────────
function P(id, name, kind, arch, owner, score) {
  return {
    id, name, kind, arch, archName: ARCH_NAME[arch], owner, score,
    color: kind === 'cpu' ? LX.cpu : COLORS[id] || LX.human,
    userBook: USER_BOOKS[arch], agentBook: fixW(AGENT_BOOKS[arch]),
  };
}
const COLORS = {
  atlas: '#33B4C4', vela: '#5B8DEF', orion: '#F0C75E', lyra: '#E8927C',
  cygnus: '#7BD88F', draco: '#B79CED', mira: '#5EEAD4', rigel: '#EBA6C8',
};

// Round-1 groups (named identity units — the "divisions" players explore).
const GROUPS = {
  east: { id: 'east', name: 'East', seats: ['atlas', 'vela', 'helios', 'ember'] },
  west: { id: 'west', name: 'West', seats: ['orion', 'lyra', 'quartz', 'cobalt'] },
  north: { id: 'north', name: 'North', seats: ['cygnus', 'draco', 'basalt', 'nova'] },
  south: { id: 'south', name: 'South', seats: ['mira', 'rigel', 'sirius', 'vega'] },
};

const FIELD = {
  // East
  atlas: P('atlas', 'Atlas', 'human', 'momentum', '@you', +6.4),
  vela: P('vela', 'Vela', 'human', 'reverter', '@dpark', +7.9),
  helios: P('helios', 'Helios', 'cpu', 'momentum', null, +2.1),
  ember: P('ember', 'Ember', 'cpu', 'reverter', null, -1.8),
  // West
  orion: P('orion', 'Orion', 'human', 'macro', '@m_renn', +9.2),
  lyra: P('lyra', 'Lyra', 'human', 'momentum', '@s_ng', +3.4),
  quartz: P('quartz', 'Quartz', 'cpu', 'macro', null, +5.1),
  cobalt: P('cobalt', 'Cobalt', 'cpu', 'momentum', null, -3.6),
  // North
  cygnus: P('cygnus', 'Cygnus', 'human', 'sentinel', '@kt', +5.7),
  draco: P('draco', 'Draco', 'human', 'macro', '@volkov', +1.2),
  basalt: P('basalt', 'Basalt', 'cpu', 'sentinel', null, +3.0),
  nova: P('nova', 'Nova', 'cpu', 'reverter', null, -0.9),
  // South
  mira: P('mira', 'Mira', 'human', 'momentum', '@chen', +8.1),
  rigel: P('rigel', 'Rigel', 'human', 'reverter', '@otto', +2.8),
  sirius: P('sirius', 'Sirius', 'cpu', 'macro', null, +4.4),
  vega: P('vega', 'Vega', 'cpu', 'sentinel', null, -2.2),
};

const YOU = 'atlas';
const FOLLOWING = ['vela', 'orion', 'cygnus', 'mira']; // who "you" follow

// ── fill levels ──────────────────────────────────────────────────────────────
// forming: day one — bracket forming, R1 just live, mostly CPU, no presence.
// filling: a third in — R1 live, humans arriving, some presence.
// open:    full — R1 resolved, R2 live, R3 upcoming, humans everywhere, busy.
const FILL = {
  forming: {
    energy: 'high', resolvedThrough: 0, liveRound: 1, humans: ['atlas', 'orion'], watchBase: 0,
    headline: 'The bracket is forming', sub: "Round 1 is seeding now — most seats are CPU until players arrive. Claim a spot; your group locks Monday.",
  },
  filling: {
    energy: 'mid', resolvedThrough: 0, liveRound: 1, humans: ['atlas', 'vela', 'orion', 'cygnus', 'mira', 'lyra'], watchBase: 9,
    headline: 'Round 1 is live', sub: "Players are filling the groups. Empty seats run as CPU — find your group and climb.",
  },
  open: {
    energy: 'low', resolvedThrough: 1, liveRound: 2, humans: 'all', watchBase: 31,
    headline: 'League · this month', sub: "Round 1 is settled, Round 2 is live. Follow the funnel to the Final Four.",
  },
};

// apply a fill: clone the field, thin humans, scale presence, set bracket state.
export function leagueState(fill) {
  const cfg = FILL[fill] || FILL.forming;
  const field = {};
  Object.values(FIELD).forEach((p) => {
    const human = cfg.humans === 'all' ? p.kind === 'human' : cfg.humans.includes(p.id);
    field[p.id] = {
      ...p, kind: human ? 'human' : 'cpu', color: human ? (COLORS[p.id] || LX.human) : LX.cpu,
      owner: human ? p.owner : null, you: p.id === YOU,
    };
  });
  // a pod = { id, name, round, group?, seats:[Seat|null]×4, status, clock, watchers }
  const seatScore = (id, rnd) => +(field[id].score * (rnd === 2 ? 0.6 : 1) + (rnd === 2 ? 4 : 0)).toFixed(1);
  const mkPod = (id, name, round, seatIds, statusOverride) => {
    const status = statusOverride || (round < cfg.liveRound ? 'final' : round === cfg.liveRound ? 'live' : 'upcoming');
    const seats = seatIds.map((pid) => (pid ? { ...field[pid], pscore: round === 1 ? field[pid].score : seatScore(pid, round) } : null));
    return {
      id, name, round, seats, status,
      clock: 86400 * (1 + (id.charCodeAt(0) % 4)) + 3600 * (id.charCodeAt(1) % 12),
      watchers: status === 'upcoming' ? 0 : Math.round(cfg.watchBase * (1 + (id.charCodeAt(1) % 5) / 6)),
    };
  };
  // Round 1 — four named groups
  const r1 = Object.values(GROUPS).map((g) => mkPod(g.id, g.name, 1, g.seats));
  // advancers (top 2 by score) of a resolved pod
  const adv = (pod) => [...pod.seats].sort((a, b) => b.pscore - a.pscore).slice(0, 2).map((s) => s.id);
  const r1done = cfg.resolvedThrough >= 1;
  // Round 2 — two pods: (East+West), (North+South). top half feeds top.
  const r2a = mkPod('r2a', 'Semifinal I', 2, r1done ? [...adv(r1[0]), ...adv(r1[1])] : [null, null, null, null]);
  const r2b = mkPod('r2b', 'Semifinal II', 2, r1done ? [...adv(r1[2]), ...adv(r1[3])] : [null, null, null, null]);
  const r2done = cfg.resolvedThrough >= 2;
  // Round 3 — the Final Four (one championship pod)
  const r3 = mkPod('r3', 'Final Four', 3, r2done ? [...adv(r2a), ...adv(r2b)] : [null, null, null, null], cfg.liveRound >= 3 ? 'live' : 'upcoming');

  // your path through the funnel (node ids you travel)
  const yourGroup = Object.values(GROUPS).find((g) => g.seats.includes(YOU));
  const path = { groups: [yourGroup.id, 'r2a', 'r3'] }; // East → SF I → Final Four

  // ── THE BASE LAYER — always-on weekly groups of four. Everyone plays these;
  //    they feed ONLY the leaderboard and never ladder into the bracket. Same
  //    four-player card, but no advancement / no cut framing. ────────────────
  const BASE_GROUPS = [
    { id: 'wkA', name: 'Vanguard', seats: ['mira', 'helios', 'draco', 'ember'] },
    { id: 'wkB', name: 'Meridian', seats: ['orion', 'basalt', 'rigel', 'cobalt'] },
    { id: 'wkC', name: 'Summit', seats: ['vela', 'quartz', 'atlas', 'nova'] },
  ];
  const baseGames = BASE_GROUPS.map((g, i) => ({
    id: g.id, name: g.name, base: true, status: i === 2 ? 'final' : 'live',
    clock: 86400 * (2 + i) + 3600 * 5,
    watchers: cfg.watchBase ? Math.round(cfg.watchBase * (0.7 + i * 0.4)) : 0,
    seats: g.seats.map((pid) => ({ ...field[pid], pscore: +(field[pid].score * 0.8 + (i - 1) * 1.3).toFixed(1) })),
  }));

  // "live now from people you follow"
  const followLive = (cfg.watchBase === 0) ? []
    : FOLLOWING.map((id) => field[id]).filter((p) => p && p.kind === 'human')
      .map((p) => {
        const pod = [...r1, r2a, r2b].find((pd) => pd.seats.some((s) => s && s.id === p.id && pd.status === 'live'));
        return pod ? { player: p, pod } : null;
      })
      .filter(Boolean).slice(0, 4);

  return {
    fill, ...cfg, field, rounds: { r1, r2: [r2a, r2b], r3 }, path, yourGroup, baseGames, followLive,
    bracketCount: { 1: 16, 2: 8, 3: 4 },
  };
}

// rank a pod's seats; mark advancing (top 2). empty seats stay as TBD at bottom.
export function rankPod(pod) {
  const seated = pod.seats.filter(Boolean);
  const ranked = [...seated].sort((a, b) => b.pscore - a.pscore).map((s, i) => ({ ...s, rank: i + 1, advancing: i < 2 }));
  const empty = pod.seats.filter((s) => !s).map((_, i) => ({ tbd: true, rank: ranked.length + i + 1 }));
  return [...ranked, ...empty];
}

// reasoning is sealed for any pod that is not yet settled — the ONE definition
// of "locked", mirrored at the seam so reasoning is never even handed to the DOM
// for a live/upcoming pod (the server WHY-projection enforces the same rule).
export function isReasoningLocked(pod) {
  return !pod || pod.status !== 'final';
}

export { GROUPS, YOU, FOLLOWING, ARCH_NAME };
