// api/_utils/agentGuardrails.test.js
// Phase 4B: guardrail enforcement unit tests.

import { describe, it, expect } from 'vitest';
import { applyGuardrails } from './agentGuardrails.js';

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

const AMD_BENCH = {
  symbol: 'AMD',
  name: 'AMD',
  baseATR: 3.5,
  isCrypto: false,
  sector: 'Technology',
};

// ==================== TESTS ====================

describe('applyGuardrails — no-op paths', () => {
  it('returns passthrough when guardrails array is empty', () => {
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [],
      battle: makeBattle(),
      prices: {},
    });
    expect(result.decision).toBe('HOLD');
    expect(result.overrides).toEqual([]);
    expect(result.symbolOut).toBeNull();
  });

  it('returns passthrough when guardrails is undefined', () => {
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: undefined,
      battle: makeBattle(),
      prices: {},
    });
    expect(result.decision).toBe('HOLD');
    expect(result.overrides).toEqual([]);
  });

  it('returns passthrough when haikuResult is null', () => {
    const result = applyGuardrails({
      haikuResult: null,
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle: makeBattle({ star: [NVDA_POSITION] }),
      prices: { NVDA: { current: 99 } }, // only -1% — no breach
    });
    expect(result.decision).toBe('HOLD');
    expect(result.overrides).toEqual([]);
  });
});

describe('applyGuardrails — stopLoss (hard)', () => {
  it('forces SWAP when HOLD position breaches stop-loss', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD', conviction: 60, hypothesis: 'Hold' },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 90 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    expect(result.symbolIn).toBe('AMD');
    const forced = result.overrides.find(o => o.action === 'forced_exit');
    expect(forced).toBeTruthy();
    expect(forced.type).toBe('stopLoss');
    expect(forced.symbol).toBe('NVDA');
    expect(forced.actual).toBeLessThanOrEqual(-10);
    expect(result.sourceNote).toBe('guardrail_stopLoss');
  });

  it('does not trigger at exactly -7% when threshold is 8%', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 93 }, AMD: { current: 105, changePercent: 1 } },
    });
    expect(result.decision).toBe('HOLD');
    expect(result.overrides).toEqual([]);
  });

  it('reinforces rather than double-swapping when Haiku already exits the breached symbol', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'SWAP', symbolOut: 'NVDA', symbolIn: 'AMD', conviction: 80 },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 88 }, AMD: { current: 105, changePercent: 1 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    expect(result.symbolIn).toBe('AMD');
    const reinforced = result.overrides.find(o => o.action === 'reinforced_haiku');
    expect(reinforced).toBeTruthy();
  });

  it('respects LOCKED positions — does not force exit', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 85 }, AMD: { current: 105, changePercent: 1 } },
      lockedPositions: new Set(['NVDA']),
    });
    expect(result.decision).toBe('HOLD');
    const blocked = result.overrides.find(o => o.action === 'blocked_by_lock');
    expect(blocked).toBeTruthy();
    expect(blocked.symbol).toBe('NVDA');
  });

  it('defers to next tick when bench is empty', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 85 } },
    });
    expect(result.decision).toBe('HOLD');
    const deferred = result.overrides.find(o => o.action === 'forced_exit_no_bench');
    expect(deferred).toBeTruthy();
  });

  it('picks the worst breacher when multiple positions violate', () => {
    const msft = { ...NVDA_POSITION, symbol: 'MSFT', swapPrice: 400 };
    const battle = makeBattle({
      star: [NVDA_POSITION, msft],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      prices: {
        NVDA: { current: 91 }, // -9%
        MSFT: { current: 340 }, // -15% ← worse
        AMD: { current: 105, changePercent: 1.2 },
      },
    });
    expect(result.symbolOut).toBe('MSFT');
    expect(
      result.overrides.some(o => o.action === 'pending_next_tick' && o.symbol === 'NVDA')
    ).toBe(true);
  });
});

describe('applyGuardrails — trailingStop (hard)', () => {
  it('triggers when drawdown from implied peak exceeds threshold', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
      thresholdHistory: { NVDA: { maxMultiplier: 5 } }, // peak = entry * (1 + 5 * 3% / 100) = 115
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'trailingStop', value: 10, unit: '%', enforcement: 'hard' }],
      battle,
      // current = 102 → drawdown from 115 = -11.3%
      prices: { NVDA: { current: 102 }, AMD: { current: 105, changePercent: 1 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    const forced = result.overrides.find(o => o.action === 'forced_exit');
    expect(forced.type).toBe('trailingStop');
  });

  it('does not trigger when position was never in profit (peak = 0)', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
      thresholdHistory: { NVDA: { maxMultiplier: 0 } },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'trailingStop', value: 10, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 85 }, AMD: { current: 105, changePercent: 1 } },
    });
    expect(result.decision).toBe('HOLD');
    expect(result.overrides.filter(o => o.action === 'forced_exit')).toEqual([]);
  });

  it('yields to stopLoss when both would trigger on same position', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
      thresholdHistory: { NVDA: { maxMultiplier: 5 } },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [
        { type: 'stopLoss', value: 5, unit: '%', enforcement: 'hard' },
        { type: 'trailingStop', value: 10, unit: '%', enforcement: 'hard' },
      ],
      battle,
      prices: { NVDA: { current: 90 }, AMD: { current: 105, changePercent: 1 } },
    });
    expect(result.decision).toBe('SWAP');
    const forced = result.overrides.find(o => o.action === 'forced_exit');
    expect(forced.type).toBe('stopLoss'); // stop-loss wins
  });
});

describe('applyGuardrails — maxSectorWeight (hard)', () => {
  it('blocks SWAP that would push sector above cap', () => {
    const tech1 = { ...NVDA_POSITION, symbol: 'NVDA', sector: 'Technology' };
    const tech2 = { ...NVDA_POSITION, symbol: 'MSFT', sector: 'Technology' };
    const fin = { ...NVDA_POSITION, symbol: 'JPM', sector: 'Financials', swapPrice: 180 };
    const amdTech = { ...AMD_BENCH, symbol: 'AMD', sector: 'Technology' };

    const battle = makeBattle({
      star: [tech1, tech2],
      core: [fin],
      bench: { stocks: [amdTech], crypto: null },
    });
    // Haiku wants to SWAP JPM (Financials) for AMD (Tech) → tech goes from 2/3 to 3/3 = 100%
    const result = applyGuardrails({
      haikuResult: { decision: 'SWAP', symbolOut: 'JPM', symbolIn: 'AMD', conviction: 80 },
      guardrails: [{ type: 'maxSectorWeight', value: 50, unit: '%', enforcement: 'hard' }],
      battle,
      prices: {
        NVDA: { current: 100 }, MSFT: { current: 100 }, JPM: { current: 185 },
        AMD: { current: 105, changePercent: 1 },
      },
    });
    expect(result.decision).toBe('HOLD');
    const blocked = result.overrides.find(o => o.action === 'blocked_swap');
    expect(blocked.type).toBe('maxSectorWeight');
  });

  it('allows SWAP when sector remains under cap', () => {
    const tech1 = { ...NVDA_POSITION, symbol: 'NVDA' };
    const fin = { ...NVDA_POSITION, symbol: 'JPM', sector: 'Financials', swapPrice: 180 };
    const health = { ...NVDA_POSITION, symbol: 'JNJ', sector: 'Healthcare', swapPrice: 160 };
    const amdTech = { ...AMD_BENCH, symbol: 'AMD', sector: 'Technology' };

    const battle = makeBattle({
      star: [tech1, fin],
      core: [health],
      bench: { stocks: [amdTech], crypto: null },
    });
    // SWAP JPM for AMD → tech 1/3 → 2/3 = 67%, cap is 70%
    const result = applyGuardrails({
      haikuResult: { decision: 'SWAP', symbolOut: 'JPM', symbolIn: 'AMD', conviction: 80 },
      guardrails: [{ type: 'maxSectorWeight', value: 70, unit: '%', enforcement: 'hard' }],
      battle,
      prices: {
        NVDA: { current: 100 }, JPM: { current: 185 }, JNJ: { current: 162 },
        AMD: { current: 105, changePercent: 1 },
      },
    });
    expect(result.decision).toBe('SWAP');
  });
});

describe('applyGuardrails — maxPosition (n/a in BaggerBomb)', () => {
  it('logs skipped_incompatible without changing decision', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'maxPosition', value: 15, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 100 }, AMD: { current: 105, changePercent: 1 } },
    });
    expect(result.decision).toBe('HOLD');
    const skipped = result.overrides.find(o => o.action === 'skipped_incompatible');
    expect(skipped).toBeTruthy();
    expect(skipped.type).toBe('maxPosition');
  });
});

describe('applyGuardrails — profitTarget (soft)', () => {
  it('surfaces a note but does not override decision', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'profitTarget', value: 15, unit: '%', enforcement: 'soft' }],
      battle,
      prices: { NVDA: { current: 120 }, AMD: { current: 105, changePercent: 1 } }, // +20%
    });
    expect(result.decision).toBe('HOLD');
    const note = result.overrides.find(o => o.action === 'note');
    expect(note).toBeTruthy();
    expect(note.type).toBe('profitTarget');
    expect(note.symbol).toBe('NVDA');
  });

  it('does not fire below the profit target', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'profitTarget', value: 15, unit: '%', enforcement: 'soft' }],
      battle,
      prices: { NVDA: { current: 110 } }, // +10%
    });
    expect(result.overrides.filter(o => o.type === 'profitTarget')).toEqual([]);
  });
});
