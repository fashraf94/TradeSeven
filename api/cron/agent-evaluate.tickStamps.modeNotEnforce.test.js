// api/cron/agent-evaluate.tickStamps.modeNotEnforce.test.js
//
// Phase B — the tick stamps: `suppressed: 'mode_not_enforce'` END TO END
// (spec §1.2 "suppressed on each of the three reasons"; discovery hazard 17).
// Under any ARCHETYPE_INTEGRITY_MODE but 'enforce' the fenced assembler
// withholds every directive; the SAME resolution the cron re-runs at the stamp
// site says so — the stamp carries the thread with `suppressed:
// 'mode_not_enforce'`, and the prompt the model received carries no directive
// block. NOT Heard: a client must not say so. One file, because the mode is a
// module-scope string on featureFlags.js and a hermetic mock is per file.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW,
  OLD_THREAD,
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
// THE MODE — 'observe' (the live constant is 'enforce'); the stamps flag on.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  TICK_STAMPS_ENABLED: true,
  ARCHETYPE_INTEGRITY_MODE: 'observe',
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
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Phase B tick stamps — suppressed: 'mode_not_enforce' end to end (hazard 17)", () => {
  it('under observe the assembler withholds the directive and the stamp says so — the thread is named, suppressed, NOT Heard', async () => {
    let promptSeen = null;
    mocks.create.mockImplementation(async (request) => { promptSeen = request.messages[2].content; return makeToolUseResponse(makeHoldResult()); });
    const battle = makeTickBattle();
    const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
    const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
    await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
    const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations));
    const entry = finalUpdate.evaluations[finalUpdate.evaluations.length - 1];

    expect(entry.heard).toEqual({ directiveThreadId: OLD_THREAD, suppressed: 'mode_not_enforce' });
    expect(promptSeen).not.toContain('Require stronger confirmation before entering');
    expect(Object.keys(entry)).toEqual([...PRE_PHASE_B_ENTRY_KEYS, 'heard', 'evidence', 'vintages']);
    // the directive is still on the battle — data kept, rendering suppressed (the D-52 contract)
    expect(battle.directive.directiveThreadId).toBe(OLD_THREAD);
  });
});
