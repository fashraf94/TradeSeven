// src/components/League/leagueAdapter.test.js
//
// Unit guards for the PURE League real-data adapter (Phase 1). Covers the
// founder-ruled mappings: CPU name synthesis from the deterministic archetype
// (A), evocative pod names (A), books as tk+dir with NO live tape and the c:0
// bookChange-safety sentinel (C), archetype only from a deployed battle (D), and
// the load-bearing scoring invariant — pscore ← the FINAL banked day's composite,
// NEVER a re-sum over days.
//
// This file's import of leagueAdapter (→ the node-clean leagueTournament schema)
// IS the dependency-surface guard (BUILD_RULES §4): if a browser-only dep ever
// enters the adapter's import graph, this test explodes in the Node env. NEVER mock it.

import { describe, it, expect } from 'vitest';
import {
  cpuSeatName,
  seatColor,
  bracketPodName,
  baseGroupName,
  picksToUserBook,
  battleToAgentBook,
  buildSeat,
  groupStatusToPodStatus,
  groupToPod,
  mapBracketToRounds,
  deriveFunnelPath,
  buildLeagueState,
} from './leagueAdapter';

// ── shared fixtures ──────────────────────────────────────────────────────────
const group = {
  id: 'g1',
  status: 'battle',
  roundNumber: 1,
  baseLayerWeek: '2026-W24',
  groupMembers: ['u1', 'cpu-1', 'u2', 'cpu-2'],
  players: [
    { odUserId: 'u1', picks: [{ symbol: 'NVDA', legs: [{ direction: 'long' }] }, { symbol: 'SMCI', legs: [{ direction: 'short' }] }] },
    { odUserId: 'cpu-1', isCpu: true, picks: [] },
    { odUserId: 'u2', picks: [{ symbol: 'XLE', legs: [{ direction: 'long' }] }] },
    { odUserId: 'cpu-2', isCpu: true, picks: [] },
  ],
  dailyScores: {
    day1: { closeScores: { u1: { totalPoints: 2, agentPoints: 1, compositePoints: 4 }, u2: { totalPoints: 1, agentPoints: 0, compositePoints: 1.5 } } },
    day2: { closeScores: { u1: { totalPoints: 5, agentPoints: 3, compositePoints: 10.5 }, u2: { totalPoints: 2, agentPoints: 1, compositePoints: 4 } } },
  },
};

const battle = {
  ownerId: 'u1',
  status: 'active',
  agentContext: { archetype: 'momentum_chaser', agentName: 'Nova' },
  portfolio: { star: [{ symbol: 'NVDA', tierMultiplier: 1 }], core: [{ symbol: 'AMD' }], support: [{ symbol: 'AVGO' }] },
};

const bracket = {
  bracketId: 'b1',
  status: 'active',
  currentRound: 1,
  totalRounds: 3,
  rounds: {
    r1: {
      roundNumber: 1,
      games: {
        'b1-r1-g1': { bracketGameId: 'b1-r1-g1', gameIndex: 1, groupId: 'g1', seats: [{ odUserId: 'u1' }, { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'u2' }, { odUserId: 'cpu-2', isCpu: true }], finalScores: null, completedAt: null },
        'b1-r1-g2': { bracketGameId: 'b1-r1-g2', gameIndex: 2, groupId: 'g2', seats: [{ odUserId: 'u3' }, { odUserId: 'u4' }, { odUserId: 'cpu-3', isCpu: true }, { odUserId: 'cpu-4', isCpu: true }], finalScores: { u3: 8, u4: 5, 'cpu-3': 2, 'cpu-4': -1 }, completedAt: '2026-06-12T20:00:00Z' },
      },
      composedAt: '2026-06-08T00:00:00Z',
    },
  },
};

const fallback = {
  fill: 'forming',
  rounds: { r1: [{ id: 'fx' }], r2: [], r3: null },
  yourGroup: { id: 'east' },
  baseGames: [{ id: 'fxBase', base: true }],
  path: { groups: ['fixture'] },
  followLive: [{ player: { id: 'fx' } }],
  field: {},
  headline: 'fixture',
};

// ── CPU names (ruling A) ─────────────────────────────────────────────────────
describe('cpuSeatName', () => {
  it('synthesizes "CPU · {Archetype}" from the deterministic id→archetype map', () => {
    // cpu-1 → CPU_ARCHETYPE_ORDER[0] === 'momentum_chaser'
    expect(cpuSeatName('cpu-1')).toBe('CPU · Momentum Chaser');
    expect(cpuSeatName('cpu-2')).toBe('CPU · Contrarian');
  });
  it('falls back to bare CPU for a non-CPU / malformed id', () => {
    expect(cpuSeatName('u1')).toBe('CPU');
    expect(cpuSeatName('cpu-')).toBe('CPU');
  });
});

// ── seat color (deterministic, CPU shares the ring) ──────────────────────────
describe('seatColor', () => {
  it('gives CPUs the identity violet and humans a stable hashed hue', () => {
    expect(seatColor('cpu-1', true)).toBe('#9A8CE0');
    expect(seatColor('u1', false)).toBe(seatColor('u1', false)); // stable
    expect(seatColor('u1', false)).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

// ── pod names (ruling A — evocative, never "Round N · Game M") ────────────────
describe('pod name synthesis', () => {
  it('bracket: directional R1, Final Four at the terminal round, Semifinal mids', () => {
    expect(bracketPodName(1, 1, 3)).toBe('East');
    expect(bracketPodName(1, 3, 3)).toBe('North');
    expect(bracketPodName(2, 1, 3)).toBe('Semifinal I');
    expect(bracketPodName(3, 1, 3)).toBe('Final Four');
  });
  it('base-layer: a pool name, deterministic by group id, never a round label', () => {
    expect(baseGroupName('g1')).toBe(baseGroupName('g1'));
    expect(baseGroupName('g1')).not.toMatch(/round/i);
  });
});

// ── books (ruling C — tk + dir, c:0 sentinel, NO price) ──────────────────────
describe('book mappers', () => {
  it('picksToUserBook: tk + dir, c:0 for bookChange safety, no price field', () => {
    const book = picksToUserBook(group.players[0].picks);
    expect(book).toEqual([
      { tk: 'NVDA', dir: 'long', c: 0 },
      { tk: 'SMCI', dir: 'short', c: 0 },
    ]);
    expect(book[0].p).toBeUndefined(); // no live tape → PortfolioMini suppresses the cells
  });
  it('battleToAgentBook: flattens star/core/support to long-only tk, c:0; empty without a battle', () => {
    expect(battleToAgentBook(battle)).toEqual([
      { tk: 'NVDA', dir: 'long', c: 0 },
      { tk: 'AMD', dir: 'long', c: 0 },
      { tk: 'AVGO', dir: 'long', c: 0 },
    ]);
    expect(battleToAgentBook(null)).toEqual([]);
  });
});

// ── seats ────────────────────────────────────────────────────────────────────
describe('buildSeat', () => {
  it('marks you, resolves human name, finite score, archName ONLY from a battle (ruling D)', () => {
    const seat = buildSeat({ odUserId: 'u1', isCpu: false, score: 10.5, picks: group.players[0].picks, battle, names: { u1: 'Alice' }, uid: 'u1' });
    expect(seat).toMatchObject({ id: 'u1', kind: 'human', you: true, name: 'Alice', pscore: 10.5, score: 10.5, archName: 'Momentum Chaser', arch: 'momentum_chaser' });
    expect(seat.userBook).toHaveLength(2);
    expect(seat.agentBook).toHaveLength(3);
  });
  it('pre-battle seat: no arch/archName, empty books, score defaults to a finite 0', () => {
    const seat = buildSeat({ odUserId: 'cpu-1', isCpu: true, score: undefined, names: {}, uid: 'u1' });
    expect(seat.archName).toBeUndefined();
    expect(seat.arch).toBeUndefined();
    expect(seat.score).toBe(0); // never NaN — Score needs a finite value
    expect(seat.name).toBe('CPU · Momentum Chaser');
    expect(seat.you).toBe(false);
  });
});

// ── group → pod, and the never-re-sum scoring invariant ──────────────────────
describe('groupToPod + the scoring invariant', () => {
  it('maps status and reads the FINAL banked day composite (never a re-sum)', () => {
    const pod = groupToPod(group, { names: { u1: 'Alice', u2: 'Bob' }, uid: 'u1', base: true });
    expect(pod.base).toBe(true);
    expect(pod.status).toBe('live'); // 'battle' → 'live'
    expect(pod.seats).toHaveLength(4);
    const u1 = pod.seats.find((s) => s && s.id === 'u1');
    // day2 composite is 10.5; the SUM of day1+day2 (4 + 10.5 = 14.5) must NOT appear.
    expect(u1.pscore).toBe(10.5);
    expect(u1.pscore).not.toBe(14.5);
  });
  it('groupStatusToPodStatus maps the lifecycle', () => {
    expect(groupStatusToPodStatus('battle')).toBe('live');
    expect(groupStatusToPodStatus('complete')).toBe('final');
    expect(groupStatusToPodStatus('forming')).toBe('upcoming');
    expect(groupStatusToPodStatus('drafting')).toBe('upcoming');
  });
});

// ── bracket → the fixed funnel topology ──────────────────────────────────────
describe('mapBracketToRounds', () => {
  it('produces the fixed 4·2·1 funnel, empty pods for unfilled slots, finalScores ranking', () => {
    const rounds = mapBracketToRounds(bracket, { myGroup: group, battlesByOwner: { u1: battle }, names: { u1: 'Alice', u2: 'Bob' }, uid: 'u1' });
    expect(rounds.r1).toHaveLength(4);
    expect(rounds.r2).toHaveLength(2);
    expect(rounds.r1[0].name).toBe('East');
    expect(rounds.r1[0].status).toBe('live'); // your live game (not completed, current round)
    expect(rounds.r1[1].status).toBe('final'); // g2 completed
    expect(rounds.r1[2].status).toBe('upcoming'); // unfilled slot
    expect(rounds.r1[2].seats.every((s) => s === null)).toBe(true);
    expect(rounds.r3.name).toBe('Final Four');
    // your own live pod overlays the live composite + the projected agent book
    const u1 = rounds.r1[0].seats.find((s) => s && s.id === 'u1');
    expect(u1.pscore).toBe(10.5);
    expect(u1.agentBook).toHaveLength(3);
    // a completed pod ranks by finalScores
    const g2 = rounds.r1[1].seats.find((s) => s && s.id === 'u3');
    expect(g2.pscore).toBe(8);
  });

  it('deriveFunnelPath highlights your R1 node → semifinal → final, empty when not in the bracket', () => {
    const rounds = mapBracketToRounds(bracket, { myGroup: group, uid: 'u1' });
    expect(deriveFunnelPath(rounds, 'u1').groups).toEqual(['east', 'r2a', 'r3']);
    expect(deriveFunnelPath(rounds, 'nobody').groups).toEqual([]);
  });
});

// ── buildLeagueState: cold start vs real data ────────────────────────────────
describe('buildLeagueState', () => {
  it('cold start (no real data) returns the fixture fallback untouched, hasRealData=false', () => {
    const out = buildLeagueState({ fallback });
    expect(out.hasRealData).toBe(false);
    expect(out.state).toBe(fallback); // pure fixtures → signal-capture stays gated off
  });

  it('real data → real sections, presence omitted, hasRealData=true', () => {
    const out = buildLeagueState({
      myGroup: group,
      bracket,
      fieldGroups: [group],
      battlesByOwner: { u1: battle },
      names: { u1: 'Alice', u2: 'Bob' },
      uid: 'u1',
      fallback,
    });
    expect(out.hasRealData).toBe(true);
    expect(out.state.rounds.r1).toHaveLength(4);
    expect(out.state.baseGames).toHaveLength(1);
    expect(out.state.baseGames[0].base).toBe(true);
    expect(out.state.followLive).toEqual([]); // no presence source in Phase 1
    expect(out.state.path.groups).toEqual(['east', 'r2a', 'r3']);
    // hero copy stays fixture-sourced (out of Phase-1 mapping scope)
    expect(out.state.headline).toBe('fixture');
  });

  it('falls back per-section: no bracket → the fixture funnel, real field still real', () => {
    const out = buildLeagueState({ myGroup: group, bracket: null, fieldGroups: [group], names: {}, uid: 'u1', fallback });
    expect(out.hasRealData).toBe(true);
    expect(out.state.rounds).toBe(fallback.rounds); // absent bracket → fixture fill
    expect(out.state.baseGames).toHaveLength(1); // real field
  });
});
