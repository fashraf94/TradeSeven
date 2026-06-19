// src/components/League/draft/boardModel.test.js
//
// Unit tests for the Training Draft Board's brain — the fit-ranked/tiered board
// derivation, the archetype mapping (design labels → real arch_scores keys), the
// real-pillar reason lines, and the client-side Diversifier overlay.

import { describe, it, expect } from 'vitest';
import {
  ARCH, archMeta, DEFAULT_ARCH, TIERS, tierFor, volTextFromAtr,
  buildFitBoard, tierGroupsOf, reasonFor,
} from './boardModel';

// a minimal pool row factory (mirrors useTrainingDraft.poolRows shape)
function row(symbol, sectorName, archScores, extra = {}) {
  return {
    symbol, sectorName, archScores,
    compositeScore: 60, momentumScore: 50, momentumRank: 10,
    fundamentalScore: 60, technicalScore: 60, baggerBombFit: 50,
    atrPercentile: 0.5, return1W: 1.2, return1M: 3, return3M: 8, returnYTD: 12,
    ...extra,
  };
}

describe('archetype mapping (design labels → real keys)', () => {
  it('keys are exactly the engine arch_scores keys', () => {
    expect(Object.keys(ARCH).sort()).toEqual(
      ['analyst', 'contrarian', 'degen', 'diversifier', 'guardian', 'momentum_chaser'].sort()
    );
  });
  it('maps real keys to the design friendly labels', () => {
    expect(archMeta('momentum_chaser').name).toBe('Trend Follower');
    expect(archMeta('degen').name).toBe('Speculator');
    expect(archMeta('analyst').name).toBe('Fundamental Investor');
    expect(archMeta('guardian').name).toBe('Capital Preserver');
  });
  it('falls back to analyst for an unknown key', () => {
    expect(archMeta('not_a_key')).toBe(ARCH[DEFAULT_ARCH]);
  });
});

describe('tiers', () => {
  it('bands on absolute fit', () => {
    expect(tierFor(90)).toBe('top');
    expect(tierFor(82)).toBe('top');
    expect(tierFor(70)).toBe('strong');
    expect(tierFor(55)).toBe('solid');
    expect(tierFor(10)).toBe('reach');
  });
  it('TIERS are ordered high→low', () => {
    expect(TIERS.map((t) => t.min)).toEqual([82, 68, 50, 0]);
  });
});

describe('volTextFromAtr', () => {
  it('bands the ATR percentile', () => {
    expect(volTextFromAtr(0.9)).toBe('Extreme');
    expect(volTextFromAtr(0.7)).toBe('High');
    expect(volTextFromAtr(0.5)).toBe('Medium');
    expect(volTextFromAtr(0.1)).toBe('Low');
    expect(volTextFromAtr(null)).toBe('—');
  });
  it('tolerates a 0–100 scale', () => {
    expect(volTextFromAtr(90)).toBe('Extreme');
  });
});

describe('buildFitBoard — fit is a direct read of arch_scores[archKey]', () => {
  const rows = [
    row('AAA', 'Technology', { momentum_chaser: 95, analyst: 40 }),
    row('BBB', 'Healthcare', { momentum_chaser: 60, analyst: 90 }),
    row('CCC', 'Energy',     { momentum_chaser: 30, analyst: 55 }),
  ];

  it('ranks by the chosen archetype, descending, with boardRank', () => {
    const board = buildFitBoard({ availableRows: rows, archKey: 'momentum_chaser' });
    expect(board.map((b) => b.symbol)).toEqual(['AAA', 'BBB', 'CCC']);
    expect(board.map((b) => b.fit)).toEqual([95, 60, 30]);
    expect(board.map((b) => b.boardRank)).toEqual([1, 2, 3]);
    expect(board[0].tier).toBe('top');
  });

  it('re-ranks completely for a different lens (the whole point)', () => {
    const board = buildFitBoard({ availableRows: rows, archKey: 'analyst' });
    expect(board.map((b) => b.symbol)).toEqual(['BBB', 'CCC', 'AAA']);
    expect(board[0].fit).toBe(90);
  });

  it('falls back to composite when a name has no arch_scores entry', () => {
    const r = [row('ZZZ', 'Energy', {}, { compositeScore: 73 })];
    const board = buildFitBoard({ availableRows: r, archKey: 'degen' });
    expect(board[0].fit).toBe(73);
  });

  it('does not mutate the input rows', () => {
    const input = [row('AAA', 'Technology', { degen: 80 })];
    const snapshot = JSON.stringify(input);
    buildFitBoard({ availableRows: input, archKey: 'degen' });
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('Diversifier overlay (client-side sector-doubling)', () => {
  const rows = [
    row('TECH1', 'Technology', { diversifier: 80 }),
    row('HLTH1', 'Healthcare', { diversifier: 78 }),
  ];

  it('penalizes a name whose sector you already hold and flags it in the reason', () => {
    const board = buildFitBoard({ availableRows: rows, archKey: 'diversifier', ownedSectorCounts: { Technology: 1 } });
    const tech = board.find((b) => b.symbol === 'TECH1');
    const hlth = board.find((b) => b.symbol === 'HLTH1');
    expect(tech.fit).toBe(80 - 26); // one owned pick in Technology
    expect(tech.reason).toMatch(/Doubles your Technology bet/);
    expect(hlth.fit).toBe(78); // untouched
    // the penalty flips the order — the fresh sector now leads
    expect(board.map((b) => b.symbol)).toEqual(['HLTH1', 'TECH1']);
  });

  it('only applies to the diversifier lens', () => {
    const board = buildFitBoard({ availableRows: rows, archKey: 'analyst', ownedSectorCounts: { Technology: 2 } });
    // analyst fit falls back to composite (no analyst score) — no sector penalty
    expect(board.find((b) => b.symbol === 'TECH1').reason).not.toMatch(/Doubles/);
  });
});

describe('reasonFor — keyed to the archetype dominant pillar, banded by fit', () => {
  it('momentum_chaser leads with the trend / momentum rank', () => {
    expect(reasonFor('momentum_chaser', row('X', 'Tech', {}, { momentumRank: 3 }), 90)).toMatch(/Strongest trend.*#3/);
  });
  it('contrarian leads with how beaten down (negative YTD)', () => {
    expect(reasonFor('contrarian', row('X', 'Tech', {}, { returnYTD: -30 }), 88)).toMatch(/down 30% on the year/);
  });
  it('degen leads with volatility text', () => {
    expect(reasonFor('degen', row('X', 'Tech', {}, { atrPercentile: 0.9 }), 90)).toMatch(/extreme volatility/);
  });
  it('analyst leads with the composite', () => {
    expect(reasonFor('analyst', row('X', 'Tech', {}, { compositeScore: 84 }), 90)).toMatch(/84 composite/);
  });
  it('guardian reads as defensive', () => {
    expect(reasonFor('guardian', row('X', 'Tech', {}), 90)).toMatch(/Rock-steady/);
  });
  it('diversifier names the sector when fresh', () => {
    expect(reasonFor('diversifier', row('X', 'Energy', {}), 84, {})).toMatch(/fresh sector \(Energy\)/);
  });
});

describe('tierGroupsOf', () => {
  it('groups in tier order and drops empty tiers', () => {
    const board = buildFitBoard({
      availableRows: [
        row('A', 'S', { degen: 90 }),
        row('B', 'S', { degen: 88 }),
        row('C', 'S', { degen: 30 }),
      ],
      archKey: 'degen',
    });
    const groups = tierGroupsOf(board);
    expect(groups.map((g) => g.tier)).toEqual(['top', 'reach']); // no strong/solid members
    expect(groups[0].items.map((i) => i.symbol)).toEqual(['A', 'B']);
  });
});
