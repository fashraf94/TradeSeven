// src/components/League/battleArena/leagueSwapLedger.test.js
import { describe, it, expect } from 'vitest';
import { buildSwapLedger, swapPts, isSwapTrade, swapReasonLabel } from './leagueSwapLedger';

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

describe('swapReasonLabel — one human reason per swap (Tier 1), never blank, never fabricated', () => {
  it('a declared model motive wins and maps to its human label', () => {
    expect(swapReasonLabel({ swapMotive: 'defensive_cut', exitReason: 'haiku_decision' })).toBe('defensive cut');
    expect(swapReasonLabel({ swapMotive: 'profit_take', exitReason: 'haiku_decision' })).toBe('profit take');
    expect(swapReasonLabel({ swapMotive: 'momentum_rotation', exitReason: 'haiku_decision' })).toBe('rotation');
    expect(swapReasonLabel({ swapMotive: 'upgrade', exitReason: 'haiku_decision' })).toBe('upgrade');
  });

  it('deterministic exitReasons show their protective taxonomy (no motive declared)', () => {
    expect(swapReasonLabel({ exitReason: 'bust_avoidance' })).toBe('stop (bust avoidance)');
    expect(swapReasonLabel({ exitReason: 'vwap_failure' })).toBe('VWAP failure');
    expect(swapReasonLabel({ exitReason: 'stepped_trail' })).toBe('trailing stop');
    expect(swapReasonLabel({ exitReason: 'stagnation' })).toBe('stagnation rotation');
    expect(swapReasonLabel({ exitReason: 'guardrail_stopLoss' })).toBe('stop-loss');
    expect(swapReasonLabel({ exitReason: 'guardrail_trailingStop' })).toBe('trailing stop');
  });

  it('deterministic-first: a machinery-forced exitReason OUTRANKS a (possibly stale) declared motive', () => {
    // A guardrail override can leave the model's swap_type on a swap the engine
    // forced as a stop (agent-evaluate.js spreads the prior haikuResult). The
    // protective taxonomy must win — printing "stop-loss" as "upgrade" is the
    // exact honesty failure this precedence prevents.
    expect(swapReasonLabel({ swapMotive: 'upgrade', exitReason: 'guardrail_stopLoss' })).toBe('stop-loss');
    // Ask 3 (R3, same-PR keyed-list add): the profit-target executor's stamp
    // renders its protective taxonomy — deterministic-first outranks any
    // declared motive here exactly as it does for the stops.
    expect(swapReasonLabel({ exitReason: 'guardrail_profitTarget' })).toBe('profit target');
    expect(swapReasonLabel({ swapMotive: 'upgrade', exitReason: 'guardrail_profitTarget' })).toBe('profit target');
    expect(swapReasonLabel({ swapMotive: 'profit_take', exitReason: 'bust_avoidance' })).toBe('stop (bust avoidance)');
    // an out-of-enum motive must not shadow a real deterministic reason either
    expect(swapReasonLabel({ swapMotive: 'sideways', exitReason: 'vwap_failure' })).toBe('VWAP failure');
  });

  it('a model swap that was asked but omitted the motive (swapMotive===null) renders "undeclared"', () => {
    expect(swapReasonLabel({ swapMotive: null, exitReason: 'haiku_decision' })).toBe('undeclared');
  });

  it('a legacy model swap (no swapMotive field at all) renders "agent decision" — never implies a motive', () => {
    expect(swapReasonLabel({ exitReason: 'haiku_decision' })).toBe('agent decision');
  });

  it('never blank and never a fabricated motive: unknown motive / unknown reason / empty all degrade safely', () => {
    expect(swapReasonLabel({ swapMotive: 'something_new' })).toBe('agent decision'); // unknown motive ≠ a specific one
    expect(swapReasonLabel({ exitReason: 'some_future_reason' })).toBe('agent decision');
    expect(swapReasonLabel({})).toBe('agent decision');
    expect(swapReasonLabel(null)).toBe('agent decision');
  });

  it('buildSwapLedger carries the reason label on every item (additive/inert for the live strip)', () => {
    const ledger = buildSwapLedger([
      { symbolOut: 'A', symbolIn: 'B', lockedPoints: 5, swapMotive: 'profit_take' },
      { symbolOut: 'C', symbolIn: 'D', lockedPoints: -2, exitReason: 'bust_avoidance' },
      { symbolOut: 'E', symbolIn: 'F', lockedPoints: 1, exitReason: 'haiku_decision' }, // legacy
    ]);
    expect(ledger.items.map((i) => i.reason)).toEqual(['profit take', 'stop (bust avoidance)', 'agent decision']);
  });
});
