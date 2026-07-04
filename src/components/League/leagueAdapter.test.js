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

// ── CPU names (ruling A) ─────────────────────────────────────────────────────
describe('cpuSeatName', () => {
  it('synthesizes "CPU — {server label}" from the deterministic id→archetype map (cross-surface parity)', () => {
    // cpu-1 → CPU_ARCHETYPE_ORDER[0] === 'momentum_chaser' → server label 'Trend Follower'
    expect(cpuSeatName('cpu-1')).toBe('CPU — Trend Follower');
    expect(cpuSeatName('cpu-2')).toBe('CPU — Contrarian');
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
  it('picksToUserBook: direction follows the CURRENT (last) leg after a flip', () => {
    const flipped = [{ symbol: 'NVDA', legs: [{ direction: 'long' }, { direction: 'short' }] }];
    expect(picksToUserBook(flipped)).toEqual([{ tk: 'NVDA', dir: 'short', c: 0 }]);
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
    expect(seat).toMatchObject({ id: 'u1', kind: 'human', you: true, name: 'Alice', pscore: 10.5, score: 10.5, archName: 'Trend Follower', arch: 'momentum_chaser' });
    expect(seat.userBook).toHaveLength(2);
    expect(seat.agentBook).toHaveLength(3);
  });
  it('pre-battle seat: no arch/archName, empty books, score defaults to a finite 0', () => {
    const seat = buildSeat({ odUserId: 'cpu-1', isCpu: true, score: undefined, names: {}, uid: 'u1' });
    expect(seat.archName).toBeUndefined();
    expect(seat.arch).toBeUndefined();
    expect(seat.score).toBe(0); // never NaN — Score needs a finite value
    expect(seat.name).toBe('CPU — Trend Follower');
    expect(seat.you).toBe(false);
  });
});

// ── group → pod, and the never-re-sum scoring invariant ──────────────────────
describe('groupToPod + the scoring invariant', () => {
  it('maps status, applies the passed liveClock, reads the FINAL banked day composite (never a re-sum)', () => {
    const pod = groupToPod(group, { names: { u1: 'Alice', u2: 'Bob' }, uid: 'u1', base: true, liveClock: 3600 });
    expect(pod.base).toBe(true);
    expect(pod.status).toBe('live'); // 'battle' → 'live'
    expect(pod.clock).toBe(3600); // hook-supplied close countdown, applied to live pods
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

  it('8-player bracket (totalRounds=2): round 2 IS the final — fed to r3, NOT duplicated into r2', () => {
    // the default dev-seed shape (games=2 → totalRounds=2)
    const b2 = {
      bracketId: 'b2', status: 'active', currentRound: 2, totalRounds: 2,
      rounds: {
        r1: { roundNumber: 1, games: {
          'b2-r1-g1': { bracketGameId: 'b2-r1-g1', gameIndex: 1, groupId: 'gA', seats: [{ odUserId: 'a1' }, { odUserId: 'a2' }, { odUserId: 'a3' }, { odUserId: 'a4' }], finalScores: { a1: 9, a2: 6, a3: 3, a4: 1 }, completedAt: '2026-06-08T20:00:00Z' },
        }, composedAt: 'x' },
        r2: { roundNumber: 2, games: {
          'b2-r2-g1': { bracketGameId: 'b2-r2-g1', gameIndex: 1, groupId: 'gB', seats: [{ odUserId: 'a1' }, { odUserId: 'a2' }, { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'cpu-2', isCpu: true }], finalScores: null, completedAt: null },
        }, composedAt: 'x' },
      },
    };
    const rounds = mapBracketToRounds(b2, { uid: 'a1' });
    // the final (round 2) is the r3 champion node, with real seats
    expect(rounds.r3.seats.some((s) => s && s.id === 'a1')).toBe(true);
    // r2 (semifinal tier) does NOT exist for a 2-round bracket → empty pods, no dup
    expect(rounds.r2.every((p) => p.seats.every((s) => s === null))).toBe(true);
    expect(rounds.r2[0].id).toBe('r2a');
    // r1 shows the round-1 game (+ empty slots), not the final
    expect(rounds.r1[0].seats.some((s) => s && s.id === 'a1')).toBe(true);
  });

  it('a game with finalScores but no completedAt (resume-owed) is FINAL, not live', () => {
    const b = {
      bracketId: 'b3', status: 'active', currentRound: 2, totalRounds: 3,
      rounds: { r1: { roundNumber: 1, games: {
        g1: { bracketGameId: 'g1', gameIndex: 1, groupId: 'gX', seats: [{ odUserId: 'x1' }, { odUserId: 'x2' }, { odUserId: 'x3' }, { odUserId: 'x4' }], finalScores: { x1: 5, x2: 4, x3: 2, x4: 1 }, completedAt: null },
      }, composedAt: 'x' } },
    };
    expect(mapBracketToRounds(b, {}).r1[0].status).toBe('final');
  });
});

// ── buildLeagueState: honest-empty vs real data (NO fixture ever leaks) ───────
describe('buildLeagueState', () => {
  it('cold start (no real data) → HONEST empty state, never the fixture demo; hasRealData=false', () => {
    const out = buildLeagueState({});
    expect(out.hasRealData).toBe(false); // signal-capture stays gated off
    // no demo fill: empty field + empty base games + empty funnel, bracket forthcoming
    expect(out.state.field).toEqual({});
    expect(out.state.baseGames).toEqual([]);
    expect(out.state.bracketPending).toBe(true);
    expect(out.state.rounds.r1.every((p) => p.seats.every((s) => s === null))).toBe(true);
    expect(out.state.followLive).toEqual([]);
    // honest hero copy — never a fixture headline
    expect(out.state.headline).not.toBe('fixture');
    expect(out.state.sub).toMatch(/season locks/i);
  });

  it('real data → real sections, honest hero, presence omitted, hasRealData=true', () => {
    const out = buildLeagueState({
      myGroup: group,
      bracket,
      fieldGroups: [group],
      battlesByOwner: { u1: battle },
      names: { u1: 'Alice', u2: 'Bob' },
      uid: 'u1',
    });
    expect(out.hasRealData).toBe(true);
    expect(out.state.rounds.r1).toHaveLength(4);
    expect(out.state.baseGames).toHaveLength(1);
    expect(out.state.baseGames[0].base).toBe(true);
    expect(out.state.followLive).toEqual([]); // no presence source in Phase 1
    expect(out.state.path.groups).toEqual(['east', 'r2a', 'r3']);
    // a real bracket → not pending; hero copy is honest, never the fixture demo
    expect(out.state.bracketPending).toBe(false);
    expect(out.state.headline).not.toBe('fixture');
  });

  it('the leaderboard `field` is REAL base-layer seats (humans + CPUs), never the 16 demo players', () => {
    const out = buildLeagueState({ fieldGroups: [group], names: { u1: 'Alice', u2: 'Bob' }, uid: 'u1' });
    const { field } = out.state;
    // exactly the base-layer group's real members — no fixture ids (atlas/vela/…)
    expect(Object.keys(field).sort()).toEqual(['cpu-1', 'cpu-2', 'u1', 'u2']);
    expect(field.u1.kind).toBe('human');
    expect(field['cpu-1'].kind).toBe('cpu');
    // real human + CPU counts are both derivable (the header no longer needs 16 − humans)
    const humans = Object.values(field).filter((p) => p.kind === 'human').length;
    const cpus = Object.values(field).filter((p) => p.kind === 'cpu').length;
    expect(humans).toBe(2);
    expect(cpus).toBe(2);
  });

  it('defense-in-depth: a training pod fed to the adapter never reaches THE FIELD or the base games (isTraining !== true gate)', () => {
    // The service read (selectBaseLayerField) already strips training pods, but if
    // an unfiltered list ever reaches the adapter, the training seats must not leak
    // into the leaderboard. Distinct members so leakage would be visible.
    const trainingPod = {
      ...group,
      id: 'train-1',
      isTraining: true,
      groupMembers: ['tu1', 'tcpu-1', 'tu2', 'tcpu-2'],
      players: [
        { odUserId: 'tu1', picks: [] },
        { odUserId: 'tcpu-1', isCpu: true, picks: [] },
        { odUserId: 'tu2', picks: [] },
        { odUserId: 'tcpu-2', isCpu: true, picks: [] },
      ],
    };
    const out = buildLeagueState({
      fieldGroups: [group, trainingPod],
      names: { u1: 'Alice', u2: 'Bob' },
      uid: 'u1',
    });
    // only the real base-layer group becomes a base game
    expect(out.state.baseGames).toHaveLength(1);
    expect(out.state.baseGames[0].id).toBe('g1');
    // the training seats never appear in the leaderboard field; the real ones do
    expect(Object.keys(out.state.field)).not.toContain('tu1');
    expect(Object.keys(out.state.field)).not.toContain('tcpu-1');
    expect(Object.keys(out.state.field).sort()).toEqual(['cpu-1', 'cpu-2', 'u1', 'u2']);
  });

  it('real session without a bracket → HONEST empty funnel + bracketPending, real field still real', () => {
    const out = buildLeagueState({ myGroup: group, bracket: null, fieldGroups: [group], names: {}, uid: 'u1' });
    expect(out.hasRealData).toBe(true);
    expect(out.state.bracketPending).toBe(true);
    // an empty funnel, so fixture players never masquerade as real
    expect(out.state.rounds.r1).toHaveLength(4);
    expect(out.state.rounds.r1.every((p) => p.seats.every((s) => s === null))).toBe(true);
    // no "Your group" card (id matches no real pod, and never crashes on .id)
    expect(out.state.yourGroup).toEqual({ id: null });
    expect(out.state.baseGames).toHaveLength(1); // real field
    expect(Object.keys(out.state.field).length).toBeGreaterThan(0);
  });
});
