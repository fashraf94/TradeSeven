// api/cron/agent-evaluate.labels.test.js
//
// Integrity follow-up 2 (8 Oct 2026), Part C — honest labels. Report:
// docs/audits/20261008_BUILD_INTEGRITY_FOLLOWUP_2.md.
//
//   Q2 — the launch-guard row's resolution is 'launch_guard_cleared' (the
//        `systemNote` is kept). The voice layer's provenance reader
//        (api/_utils/voiceLayerPrompt.js — a prompt module, read and called
//        here, never edited) counts only 'approved' / 'auto_executed', so a
//        planted proposal naming a real trade's pair no longer relabels it.
//   Q4 — every trade row's `entryMode` is the mode that governed
//        (LAUNCH_EXECUTION_MODE; the six callers are pinned by the guard's
//        behavioural half), the cron's migration writes no mode, and the
//        battle-pattern record logs the governing mode.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeSwapResult, makeToolUseResponse, deepClone,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCallsDb } from '../_utils/__fixtures__/callRecordsStore.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const patterns = vi.hoisted(() => ({ writes: [] }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn((l) => l), excludeHeldSymbols: vi.fn((l) => l),
  reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn(),
}));
// The battle-pattern logger's own Firestore handle: its writes are recorded.
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => ({
    collection: (col) => ({
      doc: (id) => ({
        get: async () => ({ exists: false, data: () => undefined }),
        collection: (sub) => ({ doc: (subId) => ({ set: async (payload) => { patterns.writes.push({ path: `${col}/${id}/${sub}/${subId}`, payload }); } }) }),
      }),
    }),
  }),
}));
vi.mock('firebase-admin/firestore', async (importOriginal) => ({ ...(await importOriginal()), FieldValue: { serverTimestamp: () => '<serverTimestamp>', arrayUnion: (...v) => ({ arrayUnion: v }) } }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
vi.mock('../_utils/learning/captureReceipt.js', () => ({
  captureSwapReceipt: vi.fn(async () => {}),
  resolveEntrySnapshot: vi.fn(async () => ({ snapshotIn: null, techDocIn: null, entrySnapshotSource: 'unavailable' })),
  classifyEntryAtrSource: vi.fn(() => 'bench_atr'),
  classifyEvidence: vi.fn(() => 'live_agent'),
}));

const { processAgentBattle } = await import('./agent-evaluate.js');
const { detectTradeProvenance } = await import('../_utils/voiceLayerPrompt.js');
const { logBattlePattern } = await import('../_utils/battlePatternLogger.js');
const { LAUNCH_EXECUTION_MODE } = await import('../_utils/executionAuthority.js');

async function runTick(battle, result = makeHoldResult()) {
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(result));
  const db = makeCallsDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  await processAgentBattle(db, battle, { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 }, Date.now(), new Map(), { everEnabled: false });
  return { db, stored: db.__store.battle };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  patterns.writes = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const PLANTED = Object.freeze({ proposalId: 'prop_x', symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0, mode: 'copilot', expiresAt: '2026-09-09T23:00:00.000Z' });

// ─────────────────────────────────────────────────────────────────────────────
describe('Q2 — the launch-guard row says what happened, and relabels nothing', () => {
  it('a new clear files `resolution: \'launch_guard_cleared\'` and keeps its `systemNote`', async () => {
    const { stored } = await runTick(makeTickBattle({ pendingProposal: deepClone(PLANTED) }));
    expect(stored.proposalHistory.at(-1)).toMatchObject({ resolution: 'launch_guard_cleared', resolvedBy: 'system', systemNote: 'launch_guard_clear' });
  });

  it('a planted proposal naming the model\'s own pair, cleared in the same check: the voice layer still reads the trade as the agent\'s (no relabel)', async () => {
    const { stored } = await runTick(makeTickBattle({ executionMode: 'copilot', pendingProposal: deepClone(PLANTED) }), makeSwapResult());
    const trade = stored.trades.find((t) => t.symbolOut === 'KO' && t.symbolIn === 'AMD');
    expect(trade).toBeTruthy();
    const guardRow = stored.proposalHistory.at(-1);
    expect(guardRow).toMatchObject({ symbolOut: 'KO', symbolIn: 'AMD', resolution: 'launch_guard_cleared' });
    // Within the reader's five-minute window, same pair — and still the agent's own trade.
    expect(Math.abs(Date.parse(trade.swappedOutAt) - Date.parse(guardRow.resolvedAt))).toBeLessThan(5 * 60 * 1000);
    expect(detectTradeProvenance(trade, stored.proposalHistory)).toBe('autopilot');
    // The row bites: under the label it carried before this build, the same history relabels the trade.
    expect(detectTradeProvenance(trade, [{ ...guardRow, resolution: 'auto_executed' }])).toBe('auto_executed_proposal');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Q4 — the governing mode, never the battle\'s own field', () => {
  it('a battle with no `executionMode`: the migration writes nothing for it (it used to write \'copilot\')', async () => {
    const battle = makeTickBattle();
    delete battle.executionMode;
    const { db, stored } = await runTick(battle);
    expect(db.__updates.some((u) => Object.hasOwn(u, 'executionMode'))).toBe(false);
    expect(stored).not.toHaveProperty('executionMode');
  });

  it('a migrated battle still migrates its other missing fields — exactly as before, minus the mode', async () => {
    const battle = makeTickBattle();
    delete battle.executionMode;
    delete battle.battleLedger;
    const { db } = await runTick(battle);
    const migration = db.__updates.find((u) => Object.hasOwn(u, 'battleLedger'));
    expect(migration).toEqual({ battleLedger: [] });
  });

  it('the trade row of a model swap on a battle whose field says copilot / manual / nothing carries the governing mode', async () => {
    for (const mode of ['copilot', 'manual', 'M'.repeat(500), 7, undefined]) {
      const battle = makeTickBattle({ executionMode: mode });
      if (mode === undefined) delete battle.executionMode;
      const { stored } = await runTick(battle, makeSwapResult());
      expect(stored.trades[0].entryMode, String(mode).slice(0, 10)).toBe(LAUNCH_EXECUTION_MODE);
    }
  });

  it('the battle-pattern record logs the governing mode — never the owner-written field or ledger toggles', async () => {
    await logBattlePattern('agent-1', 'battle-1', {
      executionMode: 'copilot', strategyPreset: 'aggressive',
      battleLedger: [{ type: 'mode_change', fromMode: 'autopilot', toMode: 'copilot', timestamp: '2026-09-09T15:00:00.000Z' }, { type: 'debate' }],
      scoreState: { currentScore: 1 },
    });
    expect(patterns.writes).toHaveLength(1);
    const { payload } = patterns.writes[0];
    expect(payload.executionMode).toEqual({ start: LAUNCH_EXECUTION_MODE, changes: [] });
    expect(payload.strategyPreset.start).toBe('aggressive');
    expect(payload.engagementCount).toBe(2);
  });

  it('the battle-pattern record is still written for malformed owner fields (it used to fail silently, losing the record)', async () => {
    for (const ledger of [7, 'x', { a: 1 }, [null, { type: 'preset_change', timestamp: { toString: 1 }, toPreset: 'defensive' }]]) {
      patterns.writes = [];
      await logBattlePattern('agent-1', 'battle-1', { executionMode: { toString: 1 }, strategyPreset: { toString: 1 }, battleLedger: ledger, scoreState: {} });
      expect(patterns.writes, JSON.stringify(ledger)).toHaveLength(1);
      expect(patterns.writes[0].payload.executionMode.start).toBe(LAUNCH_EXECUTION_MODE);
      expect(patterns.writes[0].payload.strategyPreset.start).toBe('balanced');
    }
  });
});
