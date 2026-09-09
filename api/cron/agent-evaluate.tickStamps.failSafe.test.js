// api/cron/agent-evaluate.tickStamps.failSafe.test.js
//
// Phase B — the tick stamps: THE FAIL-SAFE. The stamps are additive facts; a
// fault inside the composer must never cost the tick its write — the scores,
// the evaluation entry and the eval-lock release all ride the one finalUpdate
// after the stamp site. This suite mocks the composer to THROW and proves the
// real processAgentBattle still writes the entry (unstamped, the 25 pre-Phase-B
// keys), releases the lock, and logs the fault loud — the regimeAtStart /
// control-epoch precedent ("tick continues"). Same harness as the flag-on suite.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW,
  PRE_PHASE_B_ENTRY_KEYS,
  makeTickBattle,
  makePriceTable,
  makeRankingsDoc,
  makeTechDocs,
  makeIntradayCandles,
  makeHoldResult,
  makeToolUseResponse,
  makeTickDb,
} from '../_utils/__fixtures__/tickStampsHarness.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    constructor() { this.messages = { create: (...args) => mocks.create(...args) }; }
  },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null),
  excludeHeldByOthers: vi.fn(),
  excludeHeldSymbols: vi.fn(),
  reserveSymbol: vi.fn(),
  confirmSwap: vi.fn(),
  releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({
  ...(await importOriginal()),
  logEvaluation: vi.fn(async () => false),
  logVisionTransition: vi.fn(async () => false),
  logAnticipation: vi.fn(async () => false),
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({ ...(await importOriginal()), TICK_STAMPS_ENABLED: true }));
// THE FAULT: the composer explodes on every call.
vi.mock('../_utils/tickStamps.js', async (importOriginal) => ({
  ...(await importOriginal()),
  composeTickStamps: () => { throw new Error('stamp composer exploded (test fault)'); },
}));

const { processAgentBattle } = await import('./agent-evaluate.js');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockReset();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockReset();
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockReset();
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Phase B tick stamps — the fail-safe: a composer fault never costs the tick its write', () => {
  it('the entry is written UNSTAMPED with the 25 pre-Phase-B keys, the lock is released, and the fault is logged loud', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const battle = makeTickBattle();
    const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
    const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0 };

    await expect(processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false })).resolves.toBeUndefined();

    const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations));
    expect(finalUpdate, 'the finalUpdate must still be written').toBeTruthy();
    const entry = finalUpdate.evaluations[finalUpdate.evaluations.length - 1];
    expect(Object.keys(entry)).toEqual([...PRE_PHASE_B_ENTRY_KEYS]);
    for (const key of ['heard', 'evidence', 'vintages', 'candidates']) expect(entry).not.toHaveProperty(key);
    expect(entry.decision).toBe('HOLD');
    expect(entry.haikuError).toBeNull();
    expect(finalUpdate['cronState.evaluatingAt']).toBeNull();
    expect(summary.evaluated).toBe(1);
    // loud, attributable, and naming the consequence
    const logged = errorSpy.mock.calls.map((c) => c.join(' ')).find((line) => line.includes('tick stamps failed'));
    expect(logged).toBeTruthy();
    expect(logged).toContain('battle-tick-1');
    expect(logged).toContain('entry written unstamped');
    expect(logged).toContain('stamp composer exploded');
  });
});
