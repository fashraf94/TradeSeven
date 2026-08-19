// api/cron/agent-evaluate.suppressionPass.behavior.test.js
// Exit-Behavior Tier 2 Ask 3 — R11's BEHAVIORAL half (dual-review hardening).
//
// The wiring suite (agent-evaluate.suppressionPass.test.js) is static-source;
// both adversarial reviewers named the gap: nothing EXECUTED the pass, so an
// argument-order typo inside the body would ship green. This suite runs
// runSuppressionDeterministicPass for real — the genuine applyGuardrails
// executor underneath (no guardrail mocking), with only the I/O collaborators
// (executeSwapServer, the L1 capture module) mocked — and proves the R11
// contract: a stop/target breach FIRES on a suppression tick, provenance is
// constructed from scratch (F3), the distressed replacement defers (B3), the
// LOCK defers (R6), and the dark flag no-ops the whole pass (R10).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { flagState, executeSwapServerMock, captureSwapReceiptMock } = vi.hoisted(() => ({
  flagState: { profitTarget: false },
  executeSwapServerMock: vi.fn(),
  captureSwapReceiptMock: vi.fn(async () => {}),
}));

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get PROFIT_TARGET_EXECUTOR_ENABLED() { return flagState.profitTarget; },
  // Pin the capture gates ON so the capture branch is deterministic here
  // regardless of the live flag values; the capture module itself is mocked.
  LEARNING_L1_CAPTURE_ENABLED: true,
  LEARNING_L1_CAPTURE_EXPANSION_ENABLED: true,
}));

vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => ({
  ...(await importOriginal()),
  executeSwapServer: executeSwapServerMock,
}));

vi.mock('../_utils/learning/captureReceipt.js', () => ({
  captureSwapReceipt: captureSwapReceiptMock,
  resolveEntrySnapshot: vi.fn(async () => ({ snapshotIn: null, techDocIn: null, entrySnapshotSource: 'unavailable' })),
  classifyEntryAtrSource: vi.fn(() => 'bench_atr'),
  classifyEvidence: vi.fn(() => 'live_agent'),
}));

import { runSuppressionDeterministicPass } from './agent-evaluate.js';

afterEach(() => { flagState.profitTarget = false; });
beforeEach(() => {
  executeSwapServerMock.mockReset();
  captureSwapReceiptMock.mockClear();
  executeSwapServerMock.mockImplementation(async (_db, _id, _battle, _tier, _slot, incoming, _day, _prices, _meta, _snap) => ({
    closedTrade: { symbolIn: incoming.symbol, symbolOut: 'NVDA', swappedOutAt: '2026-08-19T15:00:00.000Z', entryPrice: 100 },
    incomingAsset: { ...incoming, swapPrice: 105 },
  }));
});

// ==================== FIXTURES ====================

function makeArgs({ guardrails, prices, lockedPositions = new Set(), stockRegimes = {}, bench } = {}) {
  const battle = {
    id: 'battle_r11',
    isCpu: false,
    strategyPreset: 'balanced',
    executionMode: 'autopilot',
    agentContext: { deployedGuardrails: guardrails, archetype: 'degen' },
    portfolio: {
      star: [{ symbol: 'NVDA', name: 'NVIDIA', baseATR: 3.0, isCrypto: false, sector: 'Technology', swapPrice: 100 }],
      core: [],
      support: [],
      bench: bench ?? { stocks: [{ symbol: 'AMD', name: 'AMD', baseATR: 3.5, isCrypto: false, sector: 'Technology' }], crypto: null },
      startingPrices: {},
    },
    thresholdHistory: {},
    scoreState: { tradeCount: 0 },
    trades: [],
    scoring: { thresholds: {} },
  };
  const statusFeedEntries = [];
  const summary = { swapped: 0, evaluated: 0, held: 0 };
  const pendingNarrations = [];
  const vwapTicks = {};
  const stagnationTicks = {};
  return {
    args: {
      db: {},
      battleRef: { get: async () => ({ exists: true, data: () => ({}) }) },
      battle,
      prices,
      lockedPositions,
      stockRegimes,
      statusFeedEntries,
      pendingNarrations,
      summary,
      tournamentCtx: null,
      ctx: battle.agentContext,
      currentDay: 2,
      currentScore: 12.3,
      marketPosture: 'neutral',
      dialClamp: { provenance: null },
      momentumData: { rankingsMap: {} },
      technicalScoresMap: {},
      attributionAgentId: 'agent_r11',
      rankingsResult: { status: 'rejected' },
      vwapTicks,
      stagnationTicks,
    },
    battle, statusFeedEntries, summary, pendingNarrations, vwapTicks, stagnationTicks,
  };
}

const STOP_8 = [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }];
const TARGET_15 = [{ type: 'profitTarget', value: 15, unit: '%', enforcement: 'soft' }];

// ==================== TESTS ====================

describe('R11 behavioral — dark contract (R10)', () => {
  it('flag OFF: the pass is a strict no-op — no execution, no feed, no counters', async () => {
    const { args, statusFeedEntries, summary } = makeArgs({
      guardrails: STOP_8,
      prices: { NVDA: { current: 88 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    await runSuppressionDeterministicPass(args);
    expect(executeSwapServerMock).not.toHaveBeenCalled();
    expect(statusFeedEntries).toEqual([]);
    expect(summary.swapped).toBe(0);
  });
});

describe('R11 behavioral — deterministic orders fire through suppression', () => {
  it('a stop breach on a suppression tick EXECUTES: from-scratch provenance, guardrail beat, counters reset (the ruling’s red-first case)', async () => {
    flagState.profitTarget = true;
    const { args, statusFeedEntries, summary, pendingNarrations, vwapTicks, stagnationTicks } = makeArgs({
      guardrails: STOP_8,
      prices: { NVDA: { current: 88 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    await runSuppressionDeterministicPass(args);

    expect(executeSwapServerMock).toHaveBeenCalledTimes(1);
    const meta = executeSwapServerMock.mock.calls[0][8];
    expect(meta.action).toBe('SWAP');
    expect(meta.exitReason).toBe('guardrail_stopLoss');
    expect(meta.swapMotive).toBeNull();
    expect(meta.trade_reasoning).toBeNull();
    expect(meta.hypothesis).toBeNull();
    expect(meta.entryConviction).toBe(0);
    expect(meta.source).toBe('guardrail');
    expect(meta.evaluationId).toMatch(/^guardrail_stopLoss_NVDA_\d+$/); // no double prefix
    expect(meta.id).toBe('trade_001');

    const beat = statusFeedEntries.find(e => e.action === 'guardrail_forced_swap');
    expect(beat?.source).toBe('guardrail');
    expect(beat?.triggeredBy).toBe('guardrail_stopLoss');
    expect(summary.swapped).toBe(1);
    expect(pendingNarrations).toHaveLength(1);
    expect(pendingNarrations[0].evalId).toBeNull();
    expect(vwapTicks.AMD).toBe(0);
    expect(stagnationTicks.AMD).toBe(0);

    expect(captureSwapReceiptMock).toHaveBeenCalledTimes(1);
    const receipt = captureSwapReceiptMock.mock.calls[0][0];
    expect(receipt.source).toBe('guardrail');
    expect(receipt.exitReason).toBe('guardrail_stopLoss');
    expect(receipt.haikuSwapReason).toBeNull();
    expect(receipt.receiptSeq).toBe(1);
  });

  it('a target cross fires with exitReason guardrail_profitTarget (the equivalent target case)', async () => {
    flagState.profitTarget = true;
    const { args } = makeArgs({
      guardrails: TARGET_15,
      prices: { NVDA: { current: 118 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    await runSuppressionDeterministicPass(args);
    expect(executeSwapServerMock).toHaveBeenCalledTimes(1);
    expect(executeSwapServerMock.mock.calls[0][8].exitReason).toBe('guardrail_profitTarget');
  });
});

describe('R11 behavioral — the deferral surfaces (B3 / R6 / F2 physics)', () => {
  it('a distressed replacement DEFERS the exit with a visible hold beat (main-site downgrade mirrored)', async () => {
    flagState.profitTarget = true;
    const { args, statusFeedEntries } = makeArgs({
      guardrails: STOP_8,
      prices: { NVDA: { current: 88 }, AMD: { current: 105, changePercent: 1.2 } },
      stockRegimes: { AMD: 'distressed' },
    });
    await runSuppressionDeterministicPass(args);
    expect(executeSwapServerMock).not.toHaveBeenCalled();
    const defer = statusFeedEntries.find(e => e.action === 'hold');
    expect(defer?.message).toContain('distressed');
    expect(defer?.triggeredBy).toBe('guardrail_stopLoss');
  });

  it('a LOCKED breacher defers inside the executor — no execution, and the R6 deferral is a visible beat (CR5)', async () => {
    flagState.profitTarget = true;
    const { args, statusFeedEntries, summary } = makeArgs({
      guardrails: STOP_8,
      prices: { NVDA: { current: 88 }, AMD: { current: 105, changePercent: 1.2 } },
      lockedPositions: new Set(['NVDA']),
    });
    await runSuppressionDeterministicPass(args);
    expect(executeSwapServerMock).not.toHaveBeenCalled();
    expect(summary.swapped).toBe(0);
    expect(statusFeedEntries.find(e => e.action === 'guardrail_forced_swap')).toBeUndefined();
    const deferBeat = statusFeedEntries.find(e => e.action === 'hold');
    expect(deferBeat?.message).toContain('LOCKED');
    expect(deferBeat?.triggeredBy).toBe('guardrail_stopLoss');
  });

  it('an empty bench defers with the pool_empty beat (F2: fires when a replacement becomes eligible)', async () => {
    flagState.profitTarget = true;
    const { args, statusFeedEntries } = makeArgs({
      guardrails: STOP_8,
      prices: { NVDA: { current: 88 } },
      bench: { stocks: [], crypto: null },
    });
    await runSuppressionDeterministicPass(args);
    expect(executeSwapServerMock).not.toHaveBeenCalled();
    const beat = statusFeedEntries.find(e => e.action === 'pool_empty');
    expect(beat?.citedRules).toEqual(['guardrail_stopLoss']);
  });

  it('no breach → nothing happens (winner below target, loser above stop)', async () => {
    flagState.profitTarget = true;
    const { args, statusFeedEntries } = makeArgs({
      guardrails: [...STOP_8, ...TARGET_15],
      prices: { NVDA: { current: 105 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    await runSuppressionDeterministicPass(args);
    expect(executeSwapServerMock).not.toHaveBeenCalled();
    expect(statusFeedEntries).toEqual([]);
  });
});
