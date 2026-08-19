// api/_utils/agentGuardrails.profitTarget.test.js
// Exit-Behavior Rebalance Tier 2, Ask 3 — the profitTarget deterministic
// executor (rulings R1/R2/R3/R6 + endorsed F7/F11/F12; sanctioned fence
// contact on agentGuardrails.js per the Ask 3 kickoff).
//
// Behavioral suite over applyGuardrails with the executor flag walked via the
// same live-getter mock pattern the sector-cap suite established (the
// functions read PROFIT_TARGET_EXECUTOR_ENABLED inside the call, so the
// getter takes effect at call time). Default false keeps every fixture on
// today's soft-note semantics — the DARK contract — and individual tests
// flip it true to exercise the executor.

import { describe, it, expect, vi, afterEach } from 'vitest';

const { flagState } = vi.hoisted(() => ({ flagState: { profitTarget: false } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get PROFIT_TARGET_EXECUTOR_ENABLED() { return flagState.profitTarget; },
}));

import { applyGuardrails, targetFor } from './agentGuardrails.js';

afterEach(() => { flagState.profitTarget = false; });

// ==================== FIXTURES ====================

function makeBattle({
  star = [],
  core = [],
  support = [],
  bench = { stocks: [], crypto: null },
  startingPrices = {},
  thresholdHistory = {},
} = {}) {
  return {
    id: 'battle_test',
    portfolio: { star, core, support, bench, startingPrices },
    thresholdHistory,
    agentContext: {},
  };
}

const NVDA_POSITION = {
  symbol: 'NVDA',
  name: 'NVIDIA',
  baseATR: 3.0,
  isCrypto: false,
  sector: 'Technology',
  swapPrice: 100,
};

const MSFT_POSITION = {
  symbol: 'MSFT',
  name: 'Microsoft',
  baseATR: 2.0,
  isCrypto: false,
  sector: 'Technology',
  swapPrice: 100,
};

const AMD_BENCH = {
  symbol: 'AMD',
  name: 'AMD',
  baseATR: 3.5,
  isCrypto: false,
  sector: 'Technology',
};

const TARGET_15 = { type: 'profitTarget', value: 15, unit: '%', enforcement: 'soft' };

// ==================== DARK CONTRACT (flag false — default) ====================

describe('profitTarget executor — DARK (flag false): soft-note semantics byte-identical', () => {
  it('a +18% winner still produces the soft note, never a forced exit', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [TARGET_15],
      battle,
      prices: { NVDA: { current: 118 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('HOLD');
    expect(result.symbolOut).toBeNull();
    expect(result.sourceNote).toBeNull();
    const note = result.overrides.find(o => o.type === 'profitTarget');
    expect(note).toBeTruthy();
    expect(note.action).toBe('note');
    expect(note.note).toContain('Soft guardrail');
  });
});

// ==================== EXECUTOR (flag true) ====================

describe('profitTarget executor — fires deterministically (R1 uniform fire-at-X)', () => {
  it('forces SWAP when a held position gains past the target (winner-side, entry baseline)', () => {
    flagState.profitTarget = true;
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD', conviction: 60 },
      guardrails: [TARGET_15],
      battle,
      prices: { NVDA: { current: 118 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    expect(result.symbolIn).toBe('AMD');
    expect(result.sourceNote).toBe('guardrail_profitTarget');
    const forced = result.overrides.find(o => o.action === 'forced_exit');
    expect(forced.type).toBe('profitTarget');
    expect(forced.symbol).toBe('NVDA');
    // threshold reports the CONFIGURED target (positive, winner-side), actual the gain.
    expect(forced.threshold).toBe(15);
    expect(forced.actual).toBeCloseTo(18, 1);
    expect(result.statusMessage).toContain('profit target');
    // No soft note remains once the executor owns the semantic.
    expect(result.overrides.filter(o => o.action === 'note')).toEqual([]);
  });

  it('below the target nothing fires (winner-side only, no loser-side inversion)', () => {
    flagState.profitTarget = true;
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [TARGET_15],
      battle,
      prices: { NVDA: { current: 110 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('HOLD');
    expect(result.overrides.filter(o => o.type === 'profitTarget')).toEqual([]);
  });

  it('a LOSING position never trips the target (gain measured from entry, not magnitude)', () => {
    flagState.profitTarget = true;
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [TARGET_15],
      battle,
      prices: { NVDA: { current: 80 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('HOLD');
    expect(result.overrides.filter(o => o.type === 'profitTarget')).toEqual([]);
  });

  it('most-breaching fires first; other over-target positions log pending_next_tick (F7 one-exit-per-eval)', () => {
    flagState.profitTarget = true;
    const battle = makeBattle({
      star: [NVDA_POSITION],
      core: [MSFT_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [TARGET_15],
      battle,
      // NVDA +18 (excess 3), MSFT +25 (excess 10) → MSFT fires, NVDA waits.
      prices: { NVDA: { current: 118 }, MSFT: { current: 125 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('MSFT');
    const pending = result.overrides.find(o => o.action === 'pending_next_tick' && o.type === 'profitTarget');
    expect(pending?.symbol).toBe('NVDA');
  });
});

describe('profitTarget executor — F7 precedence: protective wins the tick', () => {
  it('stop-loss breach outranks a simultaneous target cross (stop fires, zero target rows)', () => {
    flagState.profitTarget = true;
    const battle = makeBattle({
      star: [NVDA_POSITION],
      core: [MSFT_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }, TARGET_15],
      battle,
      // NVDA -12% (stop breach), MSFT +20% (target cross) → stop wins.
      prices: { NVDA: { current: 88 }, MSFT: { current: 120 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    expect(result.sourceNote).toBe('guardrail_stopLoss');
    expect(result.overrides.filter(o => o.type === 'profitTarget')).toEqual([]);
  });

  it('trailing-stop breach outranks a simultaneous target cross', () => {
    flagState.profitTarget = true;
    const battle = makeBattle({
      star: [{ ...NVDA_POSITION }],
      core: [MSFT_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
      // NVDA peaked at 2.0x ATR (3%) → implied peak 106; now 100.9 → -4.8% from peak.
      thresholdHistory: { NVDA: { maxMultiplier: 2.0 } },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'trailingStop', value: 4, unit: '%', enforcement: 'hard' }, TARGET_15],
      battle,
      prices: { NVDA: { current: 100.9 }, MSFT: { current: 120 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    expect(result.sourceNote).toBe('guardrail_trailingStop');
    expect(result.overrides.filter(o => o.type === 'profitTarget')).toEqual([]);
  });
});

describe('profitTarget executor — LOCK, bench physics, reinforce (R6 / F2 / mirror-stops)', () => {
  it('defers on a LOCKED position: blocked_by_lock, no forced exit (R6 — never second-guesses, never overrides the lock)', () => {
    flagState.profitTarget = true;
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [TARGET_15],
      battle,
      prices: { NVDA: { current: 118 }, AMD: { current: 105, changePercent: 1.2 } },
      lockedPositions: new Set(['NVDA']),
    });
    expect(result.decision).toBe('HOLD');
    const deferred = result.overrides.find(o => o.action === 'blocked_by_lock');
    expect(deferred?.type).toBe('profitTarget');
    expect(deferred?.symbol).toBe('NVDA');
  });

  it('empty bench defers the fire: forced_exit_no_bench, position kept (F2 — fires when a replacement becomes eligible)', () => {
    flagState.profitTarget = true;
    const battle = makeBattle({ star: [NVDA_POSITION] });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [TARGET_15],
      battle,
      prices: { NVDA: { current: 118 } },
    });
    expect(result.decision).toBe('HOLD');
    const deferred = result.overrides.find(o => o.action === 'forced_exit_no_bench');
    expect(deferred?.type).toBe('profitTarget');
  });

  it('never swaps in an already-held symbol (the held/self-excluding picker — R13 path)', () => {
    flagState.profitTarget = true;
    const battle = makeBattle({
      star: [NVDA_POSITION],
      core: [MSFT_POSITION],
      // MSFT dupes on the bench with the best momentum — must be excluded as held.
      bench: { stocks: [{ ...MSFT_POSITION, swapPrice: undefined }, AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [TARGET_15],
      battle,
      prices: { NVDA: { current: 118 }, MSFT: { current: 101, changePercent: 5.0 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    expect(result.symbolIn).toBe('AMD');
  });

  it('reinforces a Haiku SWAP of the same breaching symbol (sourceNote set so Knob B/C bypass — A2 shape for the target)', () => {
    flagState.profitTarget = true;
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'SWAP', symbolOut: 'NVDA', symbolIn: 'AMD', swap_type: 'profit_take' },
      guardrails: [TARGET_15],
      battle,
      prices: { NVDA: { current: 118 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    expect(result.sourceNote).toBe('guardrail_profitTarget');
    expect(result.overrides.find(o => o.action === 'reinforced_haiku')?.type).toBe('profitTarget');
  });

  it('a position with unusable prices is skipped, never crashes the pipeline', () => {
    flagState.profitTarget = true;
    const battle = makeBattle({
      star: [NVDA_POSITION],
      core: [MSFT_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [TARGET_15],
      battle,
      // NVDA has no usable current price; MSFT breaches cleanly.
      prices: { NVDA: { current: null }, MSFT: { current: 125 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('MSFT');
  });
});

describe('targetFor — the per-position override hook (F11, Tier-3-ready)', () => {
  it('returns the global target when no override exists', () => {
    expect(targetFor({ symbol: 'NVDA' }, 15)).toBe(15);
    expect(targetFor(null, 15)).toBe(15);
  });

  it('a numeric positive per-position override wins over the global value', () => {
    expect(targetFor({ symbol: 'NVDA', profitTargetOverridePct: 5 }, 15)).toBe(5);
  });

  it('non-numeric / non-positive overrides are ignored (fail-closed to the global)', () => {
    expect(targetFor({ profitTargetOverridePct: '5' }, 15)).toBe(15);
    expect(targetFor({ profitTargetOverridePct: 0 }, 15)).toBe(15);
    expect(targetFor({ profitTargetOverridePct: -3 }, 15)).toBe(15);
  });

  it('most-breaching means largest EXCESS over the per-position target, not largest raw gain (F7 × F11 — dual-review surviving mutation A8a closed)', () => {
    flagState.profitTarget = true;
    const battle = makeBattle({
      // A: override 5, gain +9 → excess 4. B: global 15, gain +16 → excess 1.
      // Excess-ordering fires A; raw-gain ordering would fire B.
      star: [{ ...NVDA_POSITION, profitTargetOverridePct: 5 }],
      core: [MSFT_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [TARGET_15],
      battle,
      prices: { NVDA: { current: 109 }, MSFT: { current: 116 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    const forced = result.overrides.find(o => o.action === 'forced_exit');
    expect(forced.threshold).toBe(5);
    // MSFT (+16 over 15) waits its tick as the secondary.
    expect(result.overrides.find(o => o.action === 'pending_next_tick')?.symbol).toBe('MSFT');
  });

  it('the executor resolves each position through the hook (override fires at 5% while the global needs 15%)', () => {
    flagState.profitTarget = true;
    const battle = makeBattle({
      star: [{ ...NVDA_POSITION, profitTargetOverridePct: 5 }],
      core: [MSFT_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [TARGET_15],
      battle,
      // NVDA +6% (over its 5% override), MSFT +10% (under the 15% global).
      prices: { NVDA: { current: 106 }, MSFT: { current: 110 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    const forced = result.overrides.find(o => o.action === 'forced_exit');
    expect(forced.threshold).toBe(5);
  });
});
