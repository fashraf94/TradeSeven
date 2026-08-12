// src/components/League/battleArena/leagueSwapLedger.test.js
import { describe, it, expect } from 'vitest';
import { buildSwapLedger, swapPts, isSwapTrade } from './leagueSwapLedger';

describe('leagueSwapLedger — the §9 single source for the swap ledger', () => {
  it('swapPts: locked points, non-finite → 0', () => {
    expect(swapPts({ lockedPoints: 12 })).toBe(12);
    expect(swapPts({ lockedPoints: -3 })).toBe(-3);
    expect(swapPts({ lockedPoints: 0 })).toBe(0);
    expect(swapPts({})).toBe(0);
    expect(swapPts({ lockedPoints: 'x' })).toBe(0);
    expect(swapPts(null)).toBe(0);
  });

  it('isSwapTrade: a record counts only when it names a leg', () => {
    expect(isSwapTrade({ symbolOut: 'LLY' })).toBe(true);
    expect(isSwapTrade({ symbolIn: 'NVDA' })).toBe(true);
    expect(isSwapTrade({ lockedPoints: 5 })).toBe(false);
    expect(isSwapTrade(null)).toBe(false);
    expect(isSwapTrade({})).toBe(false);
  });

  it('buildSwapLedger: empty / non-array → { items:[], total:0 }', () => {
    expect(buildSwapLedger(undefined)).toEqual({ items: [], total: 0 });
    expect(buildSwapLedger(null)).toEqual({ items: [], total: 0 });
    expect(buildSwapLedger([])).toEqual({ items: [], total: 0 });
    expect(buildSwapLedger('nope')).toEqual({ items: [], total: 0 });
  });

  it('buildSwapLedger: matches the live strip agentDeparted contract exactly (§9 parity)', () => {
    // The SAME fixture buildArenaModel.test.js asserts for agentDeparted:
    // items → [[out,in,pts]] = [['LLY','NVDA',12],['PFE','AMD',-3]], total 9.
    const trades = [
      { symbolOut: 'LLY', symbolIn: 'NVDA', lockedPoints: 12, entryPrice: 100, exitPrice: 112, lockedGainPct: 12, swappedOutAt: 't1' },
      { symbolOut: 'PFE', symbolIn: 'AMD', lockedPoints: -3, entryPrice: 40, exitPrice: 38.8, lockedGainPct: -3 },
    ];
    const ledger = buildSwapLedger(trades);
    expect(ledger.total).toBe(9);
    expect(ledger.items.map((i) => [i.out, i.in, i.pts])).toEqual([['LLY', 'NVDA', 12], ['PFE', 'AMD', -3]]);
  });

  it('buildSwapLedger: drops non-swap rows, preserves order, carries display fields', () => {
    const trades = [
      { symbolOut: 'AAPL', symbolIn: 'MSFT', lockedPoints: 5, entryPrice: 10, exitPrice: 10.5, lockedGainPct: 5, swappedOutAt: 'ts-1', name: 'Apple', tier: 'A', isCrypto: false },
      { lockedPoints: 999 }, // not a swap (no leg) → dropped
      { symbolOut: 'COIN', symbolIn: 'SHOP', lockedPoints: -7 },
    ];
    const ledger = buildSwapLedger(trades);
    expect(ledger.items).toHaveLength(2);
    expect(ledger.total).toBe(-2); // 5 + (-7); the 999 non-swap is excluded
    expect(ledger.items[0]).toMatchObject({
      out: 'AAPL', in: 'MSFT', pts: 5, entryPrice: 10, exitPrice: 10.5, gainPct: 5, at: 'ts-1', name: 'Apple', tier: 'A', isCrypto: false,
    });
    // absent fields degrade to null (never a fabricated 0/price)
    expect(ledger.items[1]).toMatchObject({ out: 'COIN', in: 'SHOP', pts: -7, entryPrice: null, exitPrice: null, gainPct: null, at: null });
  });
});
