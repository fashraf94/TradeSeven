// api/cron/agent-evaluate.tickCapture.flagOff.test.js
//
// Tick capture — THE FLAG-OFF GUARANTEE and the flag-on delta (spec §4, and
// the Phase 0 report's Part 3, which is binding):
//
//   Flag off: every existing write is byte-identical.
//   Flag on:  every existing write is unchanged EXCEPT ONE NAMED FIELD — the
//             admission transaction also carries `cronState.tickSeq`.
//
// The strongest form of that claim is an A/B on ONE tick, so this suite runs
// the SAME battle, the same frozen clock and the same model response twice
// and diffs the recorded write payloads. The flag is mocked as a GETTER, which
// is what makes the A/B possible at all: the cron reads
// TICK_CAPTURE_ENABLED at CALL TIME (inside processAgentBattle and inside the
// admission callback), never into a module-scope constant — so flipping the
// getter between runs genuinely re-reads it.
//
// The live value stays pinned false in src/config/tickCaptureFlags.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW, BASE_ENTRY_KEYS, makeTickBattle, makePriceTable, makeRankingsDoc,
  makeTechDocs, makeIntradayCandles, makeHoldResult, makeSwapResult,
  makeToolUseResponse, undefinedPaths,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCaptureDb, permanentDoc, bodyDoc } from '../_utils/__fixtures__/tickCaptureHarness.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(),
  fetchIntradayBatch: vi.fn(),
  create: vi.fn(),
}));
// THE FLAG, as a live getter — the A/B above depends on it.
const flagState = vi.hoisted(() => ({ tickCapture: false }));

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
  resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(),
  reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, get TICK_CAPTURE_ENABLED() { return flagState.tickCapture; } };
});

const { processAgentBattle } = await import('./agent-evaluate.js');

function stubMarket() {
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
}

async function runTick({ capture, battle = makeTickBattle(), result = makeHoldResult() } = {}) {
  flagState.tickCapture = capture;
  const db = makeCaptureDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  mocks.create.mockImplementation(async () => makeToolUseResponse(result));
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  return { db, summary, finalUpdate };
}

/** The admission transaction's payload — the FIRST recorded write of the tick. */
const lockPayload = (db) => db.__updates[0];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  stubMarket();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); flagState.tickCapture = false; });

describe('FLAG OFF — the tick is byte-identical to today', () => {
  it('the admission transaction writes EXACTLY the lock, and no sequence anywhere', async () => {
    const { db } = await runTick({ capture: false });
    expect(lockPayload(db)).toEqual({ 'cronState.evaluatingAt': FROZEN_NOW });
    expect(Object.keys(lockPayload(db))).toEqual(['cronState.evaluatingAt']);
    // and NO write of the tick carries the sequence
    for (const update of db.__updates) {
      expect(JSON.stringify(update)).not.toContain('tickSeq');
    }
  });

  it('NOTHING is written to the two subcollections — no batch is even opened', async () => {
    const { db } = await runTick({ capture: false });
    expect(db.__captureWrites).toEqual([]);
    expect(db.__subStore.size).toBe(0);
  });

  it('the evaluation entry composes exactly the keys it composes today', async () => {
    const { finalUpdate } = await runTick({ capture: false });
    const entry = finalUpdate.evaluations[finalUpdate.evaluations.length - 1];
    expect(Object.keys(entry).filter((k) => BASE_ENTRY_KEYS.includes(k))).toEqual([...BASE_ENTRY_KEYS]);
    // no capture key leaked onto the entry — the record lives in its own documents
    for (const key of ['tickId', 'tickSeq', 'captureStatus', 'capture']) {
      expect(entry).not.toHaveProperty(key);
    }
  });

  it('a SWAP tick is equally inert — the trade entry is untouched by capture', async () => {
    const { db, summary } = await runTick({ capture: false, result: makeSwapResult() });
    expect(summary.swapped).toBe(1);
    expect(db.__captureWrites).toEqual([]);
    const trade = db.__store.battle.trades.at(-1);
    expect(trade.symbolOut).toBe('KO');
    for (const key of ['actionId', 'tickId']) expect(trade).not.toHaveProperty(key);
  });
});

describe('FLAG ON — every existing write unchanged except ONE named field (spec §4)', () => {
  it('A/B on one HOLD tick: the lock gains `cronState.tickSeq` and NOTHING else differs', async () => {
    const off = await runTick({ capture: false });
    const on = await runTick({ capture: true });

    // (1) the lock payload: exactly one added key, with the minted value
    expect(lockPayload(on.db)).toEqual({ ...lockPayload(off.db), 'cronState.tickSeq': 1 });

    // (2) every OTHER recorded write is deep-equal, in the same order
    expect(on.db.__updates.length).toBe(off.db.__updates.length);
    expect(on.db.__updates.slice(1)).toEqual(off.db.__updates.slice(1));

    // (3) the persisted battle differs only by the sequence
    const offBattle = off.db.__store.battle;
    const onBattle = on.db.__store.battle;
    expect(onBattle.cronState.tickSeq).toBe(1);
    delete onBattle.cronState.tickSeq;
    expect(onBattle).toEqual(offBattle);
  });

  it('A/B on one SWAP tick: same result — the trade, the entry and the feed are untouched', async () => {
    const off = await runTick({ capture: false, result: makeSwapResult() });
    const on = await runTick({ capture: true, result: makeSwapResult() });
    expect(lockPayload(on.db)).toEqual({ ...lockPayload(off.db), 'cronState.tickSeq': 1 });
    expect(on.db.__updates.slice(1)).toEqual(off.db.__updates.slice(1));
    expect(on.db.__store.battle.trades).toEqual(off.db.__store.battle.trades);
  });

  it('the sequence INCREMENTS from whatever the battle already carries, and only on acquisition', async () => {
    const battle = makeTickBattle();
    battle.cronState = { ...(battle.cronState || {}), tickSeq: 41 };
    const { db } = await runTick({ capture: true, battle });
    expect(lockPayload(db)['cronState.tickSeq']).toBe(42);
    expect(permanentDoc(db, 'battle-tick-1', 'battle-tick-1:42')).not.toBeNull();
  });

  it('the record is written, both documents, in ONE batch, and carries no `undefined`', async () => {
    const { db } = await runTick({ capture: true });
    expect(db.__captureWrites).toHaveLength(1);
    expect(db.__captureWrites[0]).toHaveLength(2);
    const permanent = permanentDoc(db, 'battle-tick-1', 'battle-tick-1:1');
    const body = bodyDoc(db, 'battle-tick-1', 'battle-tick-1:1');
    expect(permanent).not.toBeNull();
    expect(body).not.toBeNull();
    expect(undefinedPaths(permanent)).toEqual([]);
    expect(undefinedPaths(body)).toEqual([]);
    expect(permanent.tickSeq).toBe(1);
    expect(permanent.exitReason).toBe('completed');
    expect(permanent.stageReached).toBe('finalized');
  });
});
