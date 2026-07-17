// src/components/Tournament/awaitingOpen/podBoard.test.js
//
// Pure-logic tests for the awaiting-open pod's user-layer derivations
// (Training Pod Draft V2 — Phase 2, L6/L7). No React, no Firestore.

import { describe, it, expect } from 'vitest';
import {
  joinPoolRows, sectorMapOf, ownedSectorCountsFrom,
  buildFreeAgentBoard, buildDraftGrid, eventsFromPlayers, heldSymbolsOf,
} from './podBoard';

const UNIVERSE = [
  { symbol: 'AAA', sectorName: 'Technology', arch_scores: { analyst: 90, momentum_chaser: 40 }, momentumRank: 5, return1W: 2.1, atrPercentile: 0.9, compositeScore: 88 },
  { symbol: 'BBB', sectorName: 'Energy', arch_scores: { analyst: 70, momentum_chaser: 95 }, momentumRank: 1, return1W: 5.0, atrPercentile: 0.5, compositeScore: 80 },
  { symbol: 'CCC', sectorName: 'Technology', arch_scores: { analyst: 50, momentum_chaser: 60 }, momentumRank: 20, return1W: -1.0, atrPercentile: 0.2, compositeScore: 55 },
];

describe('joinPoolRows', () => {
  it('joins pool symbols to universe fields and preserves order', () => {
    const rows = joinPoolRows(['bbb', 'AAA'], UNIVERSE);
    expect(rows.map((r) => r.symbol)).toEqual(['BBB', 'AAA']);
    expect(rows[0].sectorName).toBe('Energy');
    expect(rows[1].archScores.analyst).toBe(90);
  });
  it('degrades an unknown symbol to a bare row (sector Other), never drops it', () => {
    const rows = joinPoolRows(['ZZZ'], UNIVERSE);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ symbol: 'ZZZ', sectorName: 'Other', archScores: {} });
  });
});

describe('sectorMapOf / ownedSectorCountsFrom', () => {
  it('maps symbol → sector and counts held sectors', () => {
    const m = sectorMapOf(UNIVERSE);
    expect(m.get('AAA')).toBe('Technology');
    expect(ownedSectorCountsFrom(['AAA', 'CCC', 'BBB'], UNIVERSE)).toEqual({ Technology: 2, Energy: 1 });
  });
});

describe('buildFreeAgentBoard', () => {
  it('ranks the pool by archetype fit and slices topN', () => {
    const board = buildFreeAgentBoard({ poolSymbols: ['AAA', 'BBB', 'CCC'], universe: UNIVERSE, archKey: 'analyst', topN: 2 });
    expect(board).toHaveLength(2);
    // analyst fit: AAA 90 > BBB 70 > CCC 50
    expect(board[0].symbol).toBe('AAA');
    expect(board[1].symbol).toBe('BBB');
    expect(board[0].boardRank).toBe(1);
    expect(board[0]).toHaveProperty('fit');
    expect(board[0]).toHaveProperty('reason');
    expect(board[0]).toHaveProperty('volTxt');
  });
  it('reranks under a different archetype (momentum → BBB tops)', () => {
    const board = buildFreeAgentBoard({ poolSymbols: ['AAA', 'BBB', 'CCC'], universe: UNIVERSE, archKey: 'momentum_chaser', topN: 3 });
    expect(board[0].symbol).toBe('BBB');
  });
  it('membership is exactly the pool (a drafted name absent from the pool never appears)', () => {
    const board = buildFreeAgentBoard({ poolSymbols: ['AAA', 'CCC'], universe: UNIVERSE, archKey: 'analyst', topN: 12 });
    expect(board.map((r) => r.symbol).sort()).toEqual(['AAA', 'CCC']);
  });
});

describe('buildDraftGrid', () => {
  const members = ['you', 'cpu-1', 'cpu-2', 'cpu-3'];
  const events = [
    { pickNumber: 1, round: 1, odUserId: 'you', symbol: 'aaa' },
    { pickNumber: 2, round: 1, odUserId: 'cpu-1', symbol: 'bbb' },
    { pickNumber: 5, round: 2, odUserId: 'cpu-1', symbol: 'ccc' },
    { pickNumber: 8, round: 2, odUserId: 'you', symbol: 'ddd' },
  ];
  it('places picks at [round-1][seatIndex], normalizing symbols', () => {
    const grid = buildDraftGrid({ events, groupMembers: members, picksPerPlayer: 3 });
    expect(grid).toHaveLength(3);
    expect(grid[0][0]).toMatchObject({ symbol: 'AAA', odUserId: 'you' });
    expect(grid[0][1]).toMatchObject({ symbol: 'BBB', odUserId: 'cpu-1' });
    expect(grid[1][1]).toMatchObject({ symbol: 'CCC' });
    expect(grid[1][0]).toMatchObject({ symbol: 'DDD' });
    expect(grid[0][2]).toBeNull();
    expect(grid[2][0]).toBeNull();
  });
  it('ignores events for unknown seats or out-of-range rounds', () => {
    const grid = buildDraftGrid({ events: [{ round: 9, odUserId: 'you', symbol: 'x' }, { round: 1, odUserId: 'ghost', symbol: 'y' }], groupMembers: members, picksPerPlayer: 3 });
    expect(grid.flat().every((c) => c === null)).toBe(true);
  });
});

describe('eventsFromPlayers / heldSymbolsOf', () => {
  const players = [
    { odUserId: 'you', picks: [{ symbol: 'aaa' }, { symbol: 'bbb' }] },
    { odUserId: 'cpu-1', picks: ['ccc'] },
  ];
  it('derives synthetic round-ordered events (pick index + 1)', () => {
    const evs = eventsFromPlayers(players);
    expect(evs).toEqual([
      { odUserId: 'you', symbol: 'AAA', round: 1, pickNumber: null },
      { odUserId: 'you', symbol: 'BBB', round: 2, pickNumber: null },
      { odUserId: 'cpu-1', symbol: 'CCC', round: 1, pickNumber: null },
    ]);
  });
  it('heldSymbolsOf handles pick-state objects and bare symbols', () => {
    expect(heldSymbolsOf(players[0])).toEqual(['AAA', 'BBB']);
    expect(heldSymbolsOf({ picks: ['zzz'] })).toEqual(['ZZZ']);
    expect(heldSymbolsOf(null)).toEqual([]);
  });
});
