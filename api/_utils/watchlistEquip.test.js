// api/_utils/watchlistEquip.test.js
//
// Phase 5B1 — unit coverage for the pure equip helpers. These functions carry
// the riskiest decision-integration logic (the decide.js shortlist fold and
// the agent-evaluate hotBench union); behavioural coverage lives here rather
// than against the monolithic handlers that call them.
//
// Maps to verification matrix: V-11–V-14 (foldEquippedTickers / resolve),
// V-16 (unionEquippedIntoHotBench).

import { describe, it, expect } from 'vitest';
import {
  extractTickerSymbols,
  resolveEquippedWatchlist,
  foldEquippedTickers,
  unionEquippedIntoHotBench,
  buildEquippedSnapshot,
} from './watchlistEquip.js';

describe('extractTickerSymbols', () => {
  it('maps tickers[].symbol, uppercases, and trims', () => {
    expect(
      extractTickerSymbols([{ symbol: 'aapl' }, { symbol: '  NvDa  ' }])
    ).toEqual(['AAPL', 'NVDA']);
  });

  it('drops falsy / missing / non-string symbols', () => {
    expect(
      extractTickerSymbols([
        { symbol: '' },
        {},
        { symbol: null },
        null,
        undefined,
        { symbol: 42 },
      ])
    ).toEqual([]);
  });

  it('drops symbols that fail the whitelist (spaces, length, bad chars)', () => {
    expect(
      extractTickerSymbols([
        { symbol: 'A B' },
        { symbol: 'WAYTOOLONGSYMBOL' },
        { symbol: 'AA$' },
        { symbol: 'O\'REILLY' },
      ])
    ).toEqual([]);
  });

  it('keeps dot and dash symbols (e.g. BRK.B)', () => {
    expect(
      extractTickerSymbols([{ symbol: 'BRK.B' }, { symbol: 'ab-c' }])
    ).toEqual(['BRK.B', 'AB-C']);
  });

  it('dedupes case-insensitively', () => {
    expect(
      extractTickerSymbols([{ symbol: 'AAPL' }, { symbol: 'aapl' }, { symbol: 'AAPL' }])
    ).toEqual(['AAPL']);
  });

  it('returns [] for non-array input', () => {
    expect(extractTickerSymbols(undefined)).toEqual([]);
    expect(extractTickerSymbols(null)).toEqual([]);
    expect(extractTickerSymbols('AAPL')).toEqual([]);
  });
});

describe('resolveEquippedWatchlist', () => {
  const committed = { status: 'committed', name: 'AI plays', tickers: [] };

  it('returns the data for a committed, non-deleted watchlist', () => {
    expect(resolveEquippedWatchlist(committed)).toBe(committed);
  });

  it('returns null for a missing watchlist', () => {
    expect(resolveEquippedWatchlist(null)).toBeNull();
    expect(resolveEquippedWatchlist(undefined)).toBeNull();
  });

  it('returns null for a soft-deleted watchlist (Q3)', () => {
    expect(
      resolveEquippedWatchlist({ ...committed, deletedAt: '2026-05-16T00:00:00Z' })
    ).toBeNull();
  });

  it('returns null for a non-committed watchlist (Q4 — draft / missing status)', () => {
    expect(resolveEquippedWatchlist({ ...committed, status: 'draft' })).toBeNull();
    expect(resolveEquippedWatchlist({ name: 'x', tickers: [] })).toBeNull();
  });
});

describe('foldEquippedTickers', () => {
  it('with no equipped tickers is identical to a plain universe filter (V-14 regression)', () => {
    const validSymbols = new Set(['AAPL', 'MSFT']);
    const out = foldEquippedTickers({
      shortlist: ['AAPL', 'HALLUCINATED'],
      equippedSymbols: [],
      validSymbols,
    });
    expect(out.shortlist).toEqual(['AAPL']);
    expect(out.elevatedTickers).toEqual([]);
    expect(out.offUniverseTickers).toEqual([]);
    expect([...out.augmentedValidSymbols].sort()).toEqual(['AAPL', 'MSFT']);
  });

  it('drops Sonnet hallucinations not in the universe and not equipped', () => {
    const out = foldEquippedTickers({
      shortlist: ['AAPL', 'FAKE1', 'FAKE2'],
      equippedSymbols: [],
      validSymbols: new Set(['AAPL']),
    });
    expect(out.shortlist).toEqual(['AAPL']);
  });

  it('elevates an in-universe equipped ticker Sonnet omitted', () => {
    const out = foldEquippedTickers({
      shortlist: ['AAPL'],
      equippedSymbols: ['MSFT'],
      validSymbols: new Set(['AAPL', 'MSFT']),
    });
    expect(out.shortlist).toEqual(['AAPL', 'MSFT']);
    expect(out.elevatedTickers).toEqual(['MSFT']);
    expect(out.offUniverseTickers).toEqual([]);
  });

  it('does not double-add an equipped ticker Sonnet already included', () => {
    const out = foldEquippedTickers({
      shortlist: ['AAPL', 'MSFT'],
      equippedSymbols: ['MSFT'],
      validSymbols: new Set(['AAPL', 'MSFT']),
    });
    expect(out.shortlist).toEqual(['AAPL', 'MSFT']);
    expect(out.elevatedTickers).toEqual([]);
  });

  it('admits an off-universe equipped ticker and extends augmentedValidSymbols (Option 8C)', () => {
    const out = foldEquippedTickers({
      shortlist: ['AAPL'],
      equippedSymbols: ['ZZZZ'],
      validSymbols: new Set(['AAPL']),
    });
    expect(out.shortlist).toEqual(['AAPL', 'ZZZZ']);
    expect(out.elevatedTickers).toEqual(['ZZZZ']);
    expect(out.offUniverseTickers).toEqual(['ZZZZ']);
    expect(out.augmentedValidSymbols.has('ZZZZ')).toBe(true);
    expect(out.augmentedValidSymbols.has('AAPL')).toBe(true);
  });

  it('keeps an equipped ticker Sonnet listed even when it is off-universe', () => {
    // Sonnet echoed an off-universe equipped ticker — the plain filter would
    // drop it; the fold must keep it because it is equipped.
    const out = foldEquippedTickers({
      shortlist: ['AAPL', 'ZZZZ'],
      equippedSymbols: ['ZZZZ'],
      validSymbols: new Set(['AAPL']),
    });
    expect(out.shortlist).toEqual(['AAPL', 'ZZZZ']);
    expect(out.elevatedTickers).toEqual([]); // already present
    expect(out.offUniverseTickers).toEqual(['ZZZZ']);
  });

  it('does not mutate the input validSymbols set', () => {
    const validSymbols = new Set(['AAPL']);
    foldEquippedTickers({ shortlist: ['AAPL'], equippedSymbols: ['ZZZZ'], validSymbols });
    expect(validSymbols.has('ZZZZ')).toBe(false);
  });
});

describe('unionEquippedIntoHotBench', () => {
  it('adds equipped tickers not already on the bench (V-16)', () => {
    expect(
      unionEquippedIntoHotBench({
        hotBench: ['A', 'B'],
        equippedTickers: ['C', 'D'],
      })
    ).toEqual(['A', 'B', 'C', 'D']);
  });

  it('does not duplicate an equipped ticker already on the bench', () => {
    expect(
      unionEquippedIntoHotBench({ hotBench: ['A', 'B'], equippedTickers: ['B'] })
    ).toEqual(['A', 'B']);
  });

  it('skips equipped tickers already placed in portfolio/bench (excludeSymbols)', () => {
    expect(
      unionEquippedIntoHotBench({
        hotBench: ['A'],
        equippedTickers: ['B', 'C'],
        excludeSymbols: new Set(['B']),
      })
    ).toEqual(['A', 'C']);
  });

  it('leaves the bench unchanged when there are no equipped tickers', () => {
    expect(
      unionEquippedIntoHotBench({ hotBench: ['A', 'B'], equippedTickers: [] })
    ).toEqual(['A', 'B']);
  });

  it('keeps everything when the union is at or under the cap', () => {
    const out = unionEquippedIntoHotBench({
      hotBench: ['A', 'B', 'C'],
      equippedTickers: ['D', 'E'],
      cap: 20,
    });
    expect(out).toHaveLength(5);
  });

  it('over cap: drops lowest-baggerBombFit non-equipped, equipped always survive', () => {
    // 20 ranked bench symbols R0..R19 (fit 0..19) + 1 equipped → 21 > cap 20.
    const hotBench = Array.from({ length: 20 }, (_, i) => `R${i}`);
    const rankings = hotBench.map((symbol, i) => ({ symbol, baggerBombFit: i }));
    const out = unionEquippedIntoHotBench({
      hotBench,
      equippedTickers: ['EQ'],
      rankings,
      cap: 20,
    });
    expect(out).toHaveLength(20);
    expect(out).toContain('EQ');               // equipped survived
    expect(out).not.toContain('R0');           // lowest fit dropped
    expect(out).toContain('R19');              // highest fit kept
  });

  it('over cap: equipped tickers survive even when equipped count alone exceeds the cap', () => {
    const equipped = Array.from({ length: 25 }, (_, i) => `EQ${i}`);
    const out = unionEquippedIntoHotBench({
      hotBench: ['R0', 'R1'],
      equippedTickers: equipped,
      rankings: [{ symbol: 'R0', baggerBombFit: 5 }, { symbol: 'R1', baggerBombFit: 9 }],
      cap: 20,
    });
    expect(out).toHaveLength(25);
    for (const eq of equipped) expect(out).toContain(eq);
    expect(out).not.toContain('R0'); // all non-equipped slots consumed by equipped
  });

  it('does not mutate the input hotBench array', () => {
    const hotBench = ['A', 'B'];
    unionEquippedIntoHotBench({ hotBench, equippedTickers: ['C'] });
    expect(hotBench).toEqual(['A', 'B']);
  });
});

describe('buildEquippedSnapshot', () => {
  it('produces {watchlistId, name, tickers} with cleaned symbols and no snapshotAt', () => {
    const snap = buildEquippedSnapshot('wl-1', {
      name: 'AI plays',
      tickers: [{ symbol: 'aapl' }, { symbol: 'NVDA' }, { symbol: '' }],
    });
    expect(snap).toEqual({
      watchlistId: 'wl-1',
      name: 'AI plays',
      tickers: ['AAPL', 'NVDA'],
    });
    expect(snap).not.toHaveProperty('snapshotAt');
  });

  it('falls back to "Untitled watchlist" when name is empty or missing', () => {
    expect(buildEquippedSnapshot('wl-1', { name: '', tickers: [] }).name).toBe(
      'Untitled watchlist'
    );
    expect(buildEquippedSnapshot('wl-1', { tickers: [] }).name).toBe(
      'Untitled watchlist'
    );
  });
});
