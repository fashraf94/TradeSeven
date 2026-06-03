// api/_utils/agentSwapExecution.test.js
// Phase 4 — verifies the new `snapshot` parameter is threaded onto trades[i]
// inside executeSwapServer. Tests use a hand-rolled in-memory Firestore mock
// (admin SDK shape: collection().doc() + runTransaction with transaction.get
// / transaction.update). No real Firebase calls.

import { describe, it, expect, vi } from 'vitest';

// Guard 3's day-2+ path pre-fetches a daily reference via getStockAnalysisData;
// mock it so the held-from-start swap test runs offline and deterministically.
// The existing swapPrice-path tests never reach the fetch, so the mock is inert
// for them.
vi.mock('./marketDataCache.js', () => ({
  getStockAnalysisData: vi.fn(async () => ({
    daily: [{ date: '2020-01-01', rawClose: 100, close: 100, high: 101, low: 99 }],
  })),
}));

import { executeSwapServer } from './agentSwapExecution.js';
import { getStockAnalysisData } from './marketDataCache.js';

function makeBattleData(overrides = {}) {
  return {
    portfolio: {
      star: [{ symbol: 'MU', name: 'Micron', baseATR: 2.5, isCrypto: false, swapPrice: 100 }],
      core: [],
      support: [],
      bench: { stocks: [{ symbol: 'AMD', name: 'AMD', baseATR: 2.5, isCrypto: false }], crypto: null },
      startingPrices: { MU: 100 },
    },
    scoring: { thresholds: {} },
    thresholdHistory: { MU: { maxMultiplier: 0, minMultiplier: 0 } },
    trades: [],
    scoreState: { tradeCount: 0 },
    ...overrides,
  };
}

function makeMockDb(liveData) {
  let capturedUpdates = null;
  const battleRef = { __ref: 'battleRef' };
  const transaction = {
    get: vi.fn(async () => ({ exists: true, data: () => liveData })),
    update: vi.fn((ref, updates) => { capturedUpdates = updates; }),
  };
  const db = {
    collection: vi.fn(() => ({ doc: vi.fn(() => battleRef) })),
    runTransaction: vi.fn(async (fn) => fn(transaction)),
  };
  return { db, transaction, getCapturedUpdates: () => capturedUpdates };
}

const benchAsset = { symbol: 'AMD', name: 'AMD', baseATR: 2.5, isCrypto: false };
const currentPrices = { MU: { current: 110 }, AMD: { current: 150 } };
const evaluationMetadata = { id: 'trade_001', action: 'SWAP' };

describe('executeSwapServer — Phase 4 snapshot threading', () => {
  it('spreads snapshot onto trades[i] when caller provides one', async () => {
    const liveData = makeBattleData();
    const { db, getCapturedUpdates } = makeMockDb(liveData);

    const snapshot = {
      symbolOut: { symbol: 'MU', sectorName: 'Tech', capturedAt: '2026-05-06T00:00:00.000Z' },
      symbolIn: { symbol: 'AMD', sectorName: 'Tech', capturedAt: '2026-05-06T00:00:00.000Z' },
    };

    await executeSwapServer(
      db, 'battle-1', liveData,
      'star', 0,
      benchAsset, 1, currentPrices,
      evaluationMetadata, snapshot,
    );

    const updates = getCapturedUpdates();
    expect(updates).not.toBeNull();
    expect(Array.isArray(updates.trades)).toBe(true);
    const trade = updates.trades[updates.trades.length - 1];

    expect(trade.snapshot).toEqual(snapshot);
    // Sanity: existing evaluationMetadata fields still spread in
    expect(trade.id).toBe('trade_001');
    expect(trade.action).toBe('SWAP');
    expect(trade.symbolOut).toBe('MU');
    expect(trade.symbolIn).toBe('AMD');
  });

  it('writes snapshot:null on trades[i] when caller omits it (back-compat)', async () => {
    const liveData = makeBattleData();
    const { db, getCapturedUpdates } = makeMockDb(liveData);

    // Call without the 10th positional arg — same call shape as pre-Phase-4 callers
    await executeSwapServer(
      db, 'battle-1', liveData,
      'star', 0,
      benchAsset, 1, currentPrices,
      evaluationMetadata,
    );

    const updates = getCapturedUpdates();
    const trade = updates.trades[updates.trades.length - 1];
    expect(trade).toHaveProperty('snapshot');
    expect(trade.snapshot).toBeNull();
  });
});

// Held-from-start asset (no swapPrice) swapped out on day 2+: the badge baseline
// falls through to previousClose, so Guard 3 fetches the daily reference and
// validates it. Covers the guard3NeedsRef === true path (the existing tests only
// exercise the swapPrice short-circuit).
function heldBattleData() {
  return {
    activatedAt: '2020-01-01T12:00:00.000Z', // far past → isActivationDay false (day 2+)
    portfolio: {
      star: [{ symbol: 'MU', name: 'Micron', baseATR: 2.5, isCrypto: false }], // NO swapPrice
      core: [],
      support: [],
      bench: { stocks: [{ symbol: 'AMD', name: 'AMD', baseATR: 2.5, isCrypto: false }], crypto: null },
      startingPrices: { MU: 100 },
    },
    scoring: { thresholds: { MU: { threshold: 2.5 } } },
    thresholdHistory: { MU: { maxMultiplier: 0, minMultiplier: 0 } },
    trades: [],
    scoreState: { tradeCount: 0 },
  };
}

describe('executeSwapServer — Guard 3 day-2+ baseline validation', () => {
  it('substitutes a glitched previousClose with the prior-session raw close (no false meltdown)', async () => {
    const liveData = heldBattleData();
    const { db, getCapturedUpdates } = makeMockDb(liveData);
    getStockAnalysisData.mockClear();

    // Near-flat ticker (current ~ startingPrice) but the feed's previousClose is
    // glitched high (130). Unguarded, baseline 130 → ~-23% → Bust+Crash+Meltdown
    // (-65). Guard 3 substitutes the prior-session raw close (100) → ~0% → none.
    const prices = { MU: { current: 100, previousClose: 130 }, AMD: { current: 150 } };

    await executeSwapServer(
      db, 'battle-1', liveData,
      'star', 0,
      benchAsset, 3, prices,
      { id: 'trade_g3', action: 'SWAP' },
    );

    expect(getStockAnalysisData).toHaveBeenCalledWith('MU', expect.objectContaining({ forceRefresh: true }));
    const trade = getCapturedUpdates().trades[0];
    expect(trade.lockedPoints).toBe(0); // 0, not -65 → baseline was corrected to 100
  });
});

// Residual (a) pin: for LONG positions, the persisted trades[].lockedGainPct must
// be byte-identical to the old formula (exit-entry)/entry*100, rounded — i.e. the
// short-negation refactor introduced no sign flip or magnitude change for longs.
describe('executeSwapServer — lockedGainPct byte-identical to old formula (LONG)', () => {
  for (const [label, current] of [['gain', 110], ['loss', 92], ['flat', 100]]) {
    it(`${label}: lockedGainPct === rounded (exit-entry)/entry*100`, async () => {
      const liveData = makeBattleData(); // MU swapPrice 100 (long), day 1
      const { db, getCapturedUpdates } = makeMockDb(liveData);
      const prices = { MU: { current }, AMD: { current: 150 } };

      await executeSwapServer(
        db, 'battle-1', liveData,
        'star', 0,
        benchAsset, 1, prices,
        { id: 'trade_pin', action: 'SWAP' },
      );

      const trade = getCapturedUpdates().trades[getCapturedUpdates().trades.length - 1];
      const expected = Math.round(((current - 100) / 100 * 100) * 1000) / 1000;
      expect(trade.lockedGainPct).toBe(expected);
    });
  }
});
