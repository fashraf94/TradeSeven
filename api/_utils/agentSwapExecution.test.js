// api/_utils/agentSwapExecution.test.js
// Phase 4 — verifies the new `snapshot` parameter is threaded onto trades[i]
// inside executeSwapServer. Tests use a hand-rolled in-memory Firestore mock
// (admin SDK shape: collection().doc() + runTransaction with transaction.get
// / transaction.update). No real Firebase calls.

import { describe, it, expect, vi } from 'vitest';
import { executeSwapServer } from './agentSwapExecution.js';

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
