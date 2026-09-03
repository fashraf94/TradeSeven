// src/screens/battleView/selectSymbolRoster.test.js
//
// A2.3, ruling 8 (D-73) — the battle's own universe, under the flag only.
//
// Four persisted lists, two of them string arrays and two of them arrays of
// objects. The rows below read every one of the four off a document shaped
// like the real one, and hold the two rules that matter: the opponent is never
// in the roster, and a malformed list is skipped rather than thrown on.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { selectSymbolRoster } from './selectSymbolRoster';

const DOC = {
  portfolio: {
    star: [{ symbol: 'NVDA' }, { symbol: 'SLB' }],
    core: [{ symbol: 'CF' }],
    support: [{ symbol: 'MU' }, { symbol: 'BTC-USD', isCrypto: true }],
    bench: {
      stocks: [{ symbol: 'DVN' }, { symbol: 'MOS' }],
      crypto: { symbol: 'ETH-USD', isCrypto: true },
    },
  },
  watchlist: { active: [], hotBench: ['GILD', 'XOM'], monitoring: [] },
  agentContext: { equippedWatchlist: { watchlistId: 'w1', tickers: ['AMD', 'GILD'] } },
  opponent: { portfolio: { star: [{ symbol: 'AAPL' }], core: [], support: [] } },
};

describe('selectSymbolRoster — book ∪ bench ∪ hotBench ∪ equipped', () => {
  it('reads all four persisted lists', () => {
    const roster = selectSymbolRoster(DOC);
    // the book
    for (const s of ['NVDA', 'SLB', 'CF', 'MU', 'BTC-USD']) expect(roster.has(s)).toBe(true);
    // the deploy bench, stocks and crypto
    for (const s of ['DVN', 'MOS', 'ETH-USD']) expect(roster.has(s)).toBe(true);
    // the hot bench (a STRING array, rebuilt mid-battle by the cron)
    for (const s of ['GILD', 'XOM']) expect(roster.has(s)).toBe(true);
    // the equipped watchlist (a STRING array, frozen at creation)
    expect(roster.has('AMD')).toBe(true);
    // …and the union de-duplicates: GILD is on two of the four lists.
    expect(roster.size).toBe(11);
  });

  it('NEVER the opponent\'s — the tape is own-side only', () => {
    expect(selectSymbolRoster(DOC).has('AAPL')).toBe(false);
  });

  it('MUTATION ROW — each list is load-bearing on its own', () => {
    const without = (path) => {
      const clone = JSON.parse(JSON.stringify(DOC));
      let node = clone;
      const parts = path.split('.');
      for (const part of parts.slice(0, -1)) node = node[part];
      delete node[parts[parts.length - 1]];
      return selectSymbolRoster(clone);
    };
    expect(without('portfolio.star').has('NVDA')).toBe(false);
    expect(without('portfolio.bench').has('DVN')).toBe(false);
    expect(without('watchlist').has('XOM')).toBe(false);
    expect(without('agentContext').has('AMD')).toBe(false);
    // …and dropping one list never drops another.
    expect(without('watchlist').has('NVDA')).toBe(true);
    expect(without('agentContext').has('DVN')).toBe(true);
  });

  it('takes BOTH persisted shapes at every site — a bare string or an object', () => {
    const mixed = selectSymbolRoster({
      portfolio: { star: ['NVDA', { symbol: 'SLB' }], bench: { stocks: ['DVN'], crypto: 'ETH-USD' } },
      watchlist: { hotBench: [{ symbol: 'GILD' }] },
    });
    for (const s of ['NVDA', 'SLB', 'DVN', 'ETH-USD', 'GILD']) expect(mixed.has(s)).toBe(true);
  });

  it('a malformed document is an empty roster, never a throw', () => {
    for (const bad of [null, undefined, 'nope', 42, {}, { portfolio: null }, { portfolio: { star: 'NVDA' } }]) {
      expect(selectSymbolRoster(bad).size).toBe(0);
    }
    const noisy = selectSymbolRoster({
      portfolio: { star: [null, {}, { symbol: '' }, { symbol: '  ' }, { symbol: ' NVDA ' }] },
      watchlist: { hotBench: [null, '', '  ', 'XOM'] },
    });
    expect([...noisy].sort()).toEqual(['NVDA', 'XOM']);
  });

  it('SOURCE TRIPWIRE — the four field paths are the ones the server writes', () => {
    const service = readFileSync(new URL('../../../api/_utils/agentBattleService.js', import.meta.url), 'utf8');
    // portfolio.bench.{stocks,crypto} (the deploy bench)
    expect(service).toContain('bench: {');
    expect(service).toContain('stocks: deepCopyArrayWithSector(bench?.stocks, sectorMap)');
    // watchlist.hotBench
    expect(service).toContain('hotBench: []');
    // agentContext.equippedWatchlist.tickers
    expect(service).toContain('equippedWatchlist: options.equippedWatchlist');
    // …and hotBench is a STRING array where the cron filters it.
    const ledger = readFileSync(new URL('../../../api/_utils/tournamentAgentLedger.js', import.meta.url), 'utf8');
    expect(ledger).toContain('export function excludeHeldSymbols(symbols, heldByOthers)');
    expect(ledger).toContain('symbols.filter(s => !heldByOthers.has(s))');
  });
});
