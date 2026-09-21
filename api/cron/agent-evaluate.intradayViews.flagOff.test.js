// api/cron/agent-evaluate.intradayViews.flagOff.test.js
//
// Intraday Data — Build 1, contract §3: with INTRADAY_DIAGNOSTIC_ENABLED OFF
// (the shipped value, mocked false here hermetically) the evaluator reads no
// snapshot, writes no view, adds no key to the entry, and the vintages block
// is byte-identical to today. The same harness and golden as the tick-stamps
// suites; TICK_STAMPS_ENABLED is mocked TRUE so the vintages block exists to
// be compared.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW, PRE_PHASE_B_ENTRY_KEYS, BASE_ENTRY_KEYS,
  makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeToolUseResponse, makeTickDb,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { VINTAGE_FIELDS } from '../_utils/tickStamps.js';
import { INTRADAY_ENTRY_FIELDS } from '../_utils/intraday/view.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn(),
  generateAnticipation: vi.fn(async () => null), generateTradeNarration: vi.fn(async () => null),
}));
vi.mock('@anthropic-ai/sdk', () => ({ default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } } }));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData, fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []), filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({ resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(), reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn() }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: (...args) => mocks.generateAnticipation(...args) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: (...args) => mocks.generateTradeNarration(...args) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  TICK_STAMPS_ENABLED: true,
  INTRADAY_DIAGNOSTIC_ENABLED: false,
  // Tick capture ships dark — pinned false explicitly (Phase 0 Part 3).
  TICK_CAPTURE_ENABLED: false,
}));

const { processAgentBattle } = await import('./agent-evaluate.js');
const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(resolve(HERE, '../_utils/__fixtures__/tickStampsEntryGolden.flagOff.json'), 'utf8'));
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset(); mocks.fetchIntradayBatch.mockReset(); mocks.create.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('§3 flag OFF — every surface byte-identical to today', () => {
  it('reads no snapshot, writes no view, adds no intraday key; vintages are the five keys with vwap "tick"', async () => {
    const battle = makeTickBattle();
    const prices = makePriceTable();
    mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
    mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
    const base = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
    let snapshotReads = 0; let viewWrites = 0;
    const db = {
      ...base,
      collection(col) {
        if (col === 'intradaySnapshots') return { doc: () => ({ async get() { snapshotReads += 1; return { exists: false, data: () => undefined }; } }) };
        const c = base.collection(col);
        if (col !== 'agentBattles') return c;
        return { ...c, doc: (id) => ({ ...c.doc(id), collection: () => ({ doc: () => ({ async set() { viewWrites += 1; } }) }) }) };
      },
    };
    mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
    const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
    // The handler passes null with the flag off; processAgentBattle's default is the same.
    await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
    const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations));
    const entry = finalUpdate.evaluations.at(-1);
    expect(snapshotReads).toBe(0);
    expect(viewWrites).toBe(0);
    for (const k of INTRADAY_ENTRY_FIELDS) expect(entry).not.toHaveProperty(k);
    expect(Object.keys(entry)).toEqual([...BASE_ENTRY_KEYS, 'heard', 'evidence', 'vintages']);
    expect(Object.keys(entry.vintages)).toEqual([...VINTAGE_FIELDS]);
    expect(entry.vintages.vwap).toBe('tick');
    expect(JSON.stringify(pick(entry, PRE_PHASE_B_ENTRY_KEYS))).toBe(JSON.stringify(GOLDEN.entry));
    expect(Object.keys(finalUpdate)).toEqual(GOLDEN.finalUpdateKeys);
    // The only 'intraday' in the whole payload is the legacy cronState.intradayMomentum map.
    expect(JSON.stringify(finalUpdate).replace(/cronState\.intradayMomentum/g, '').includes('intraday')).toBe(false);
  });
});
