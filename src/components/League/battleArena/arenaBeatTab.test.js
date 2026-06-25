// src/components/League/battleArena/arenaBeatTab.test.js
import { describe, it, expect } from 'vitest';
import { beatTabs } from './arenaBeatTab';

const books = { agentTks: ['MSTR', 'PLTR', 'COIN'], yourTks: ['GE', 'AMZN', 'VLO'] };

describe('beatTabs — beat → mobile tab pulse', () => {
  it('starless beat (lead change / board) → pulses nothing', () => {
    expect(beatTabs(null, books)).toEqual([]);
    expect(beatTabs({ kind: 'lead', key: 3 }, books)).toEqual([]); // no tk
    expect(beatTabs({ tk: undefined, kind: 'swap', key: 1 }, books)).toEqual([]);
  });

  it("a flip is YOUR move → ['you'] (regardless of book membership)", () => {
    expect(beatTabs({ tk: 'GE', kind: 'flip', key: 1 }, books)).toEqual(['you']);
  });

  it("an agent swap → ['agent','chat'] (the six changed + a new voice line)", () => {
    expect(beatTabs({ tk: 'MSTR', kind: 'swap', key: 2 }, books)).toEqual(['agent', 'chat']);
  });

  it("a state beat on the agent's six → ['agent']", () => {
    for (const kind of ['hit', 'edge', 'danger', 'claim']) {
      expect(beatTabs({ tk: 'COIN', kind, key: 4 }, books)).toEqual(['agent']);
    }
  });

  it("a state beat on your three → ['you']", () => {
    for (const kind of ['hit', 'edge', 'danger', 'claim']) {
      expect(beatTabs({ tk: 'AMZN', kind, key: 5 }, books)).toEqual(['you']);
    }
  });

  it('a ticker in NEITHER book (a rival name) → pulses nothing', () => {
    expect(beatTabs({ tk: 'RIVL', kind: 'claim', key: 6 }, books)).toEqual([]);
  });

  it("TIE-BREAK: a symbol in BOTH books routes to your three (self-relevant wins)", () => {
    const overlap = { agentTks: ['NVDA'], yourTks: ['NVDA'] };
    // e.g. a rival's resolved claim whose addSymbol coincides with a held ticker —
    // intentional: a pulse on your own portfolio beats a watch-only one.
    expect(beatTabs({ tk: 'NVDA', kind: 'claim', key: 7 }, overlap)).toEqual(['you']);
    expect(beatTabs({ tk: 'NVDA', kind: 'hit', key: 8 }, overlap)).toEqual(['you']);
  });

  it('accepts Set or Array book membership identically', () => {
    const asSets = { agentTks: new Set(['MSTR']), yourTks: new Set(['GE']) };
    expect(beatTabs({ tk: 'MSTR', kind: 'hit', key: 9 }, asSets)).toEqual(['agent']);
    expect(beatTabs({ tk: 'GE', kind: 'edge', key: 10 }, asSets)).toEqual(['you']);
  });

  it('every star-bearing kind maps to exactly one portfolio tab (or none)', () => {
    const portfolioTabsOnly = (tabs) => tabs.filter((t) => t === 'you' || t === 'agent');
    for (const kind of ['flip', 'swap', 'hit', 'edge', 'danger', 'claim']) {
      const onAgent = portfolioTabsOnly(beatTabs({ tk: 'MSTR', kind, key: 1 }, books));
      const onYou = portfolioTabsOnly(beatTabs({ tk: 'GE', kind, key: 1 }, books));
      expect(onAgent.length).toBeLessThanOrEqual(1);
      expect(onYou.length).toBeLessThanOrEqual(1);
    }
  });
});
