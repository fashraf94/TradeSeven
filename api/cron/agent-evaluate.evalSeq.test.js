// api/cron/agent-evaluate.evalSeq.test.js
//
// THE MONOTONIC EVALUATION SEQUENCE (follow-up review A-13).
//
// `evalId` used to be derived from `battle.evaluations.length + 1`, and that
// array is capped at 150 (`agent-evaluate.js`, the finalUpdate's
// `.slice(-150)`). So on a battle past 150 checks the length never moved again
// and every later entry was stamped `eval_151` — the id stopped identifying
// anything, and every downstream join keyed on it (statusFeed, cronErrors, the
// anticipation queue, the `intradayViews/{evalId}` subcollection document)
// pointed at a name shared by dozens of ticks.
//
// The sequence now lives in `cronState.evalSeq`: the count of entries ever
// APPENDED, written as an EXPLICIT value (never FieldValue.increment — D-105)
// on the SAME finalUpdate that appends the entry, so the counter and the array
// cannot diverge and a tick that writes no entry advances nothing.
//
// Drives the REAL processAgentBattle through the full-Haiku path on the shared
// tick-stamps harness — the same end-to-end route the two golden suites use.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW,
  makeTickBattle,
  makePriceTable,
  makeRankingsDoc,
  makeTechDocs,
  makeIntradayCandles,
  makeHoldResult,
  makeToolUseResponse,
  makeTickDb,
} from '../_utils/__fixtures__/tickStampsHarness.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(),
  fetchIntradayBatch: vi.fn(),
  create: vi.fn(),
}));

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
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({
  ...(await importOriginal()),
  generateAnticipation: vi.fn(async () => null),
}));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({
  ...(await importOriginal()),
  generateTradeNarration: vi.fn(async () => null),
}));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({
  ...(await importOriginal()),
  logEvaluation: vi.fn(async () => false),
  logVisionTransition: vi.fn(async () => false),
  logAnticipation: vi.fn(async () => false),
}));

const { processAgentBattle } = await import('./agent-evaluate.js');

/** `n` prior entries in the shape the array actually holds after a cap slice. */
function priorEvaluations(n, { firstSeq = 1 } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    evalId: `eval_${String(firstSeq + i).padStart(3, '0')}`,
    timestamp: '2026-09-09T14:30:00.000Z',
    decision: 'HOLD',
  }));
}

function stubMarket() {
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
}

async function runTick({ battle = makeTickBattle() } = {}) {
  const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  return {
    db,
    summary,
    finalUpdate,
    entry: finalUpdate ? finalUpdate.evaluations[finalUpdate.evaluations.length - 1] : null,
  };
}

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
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('evalId is monotonic — cronState.evalSeq (review A-13)', () => {
  it('a fresh battle is unchanged: the first check is still eval_001', async () => {
    const { entry, finalUpdate } = await runTick();
    expect(entry.evalId).toBe('eval_001');
    expect(finalUpdate['cronState.evalSeq']).toBe(1);
  });

  it('a battle with no evalSeq continues from its length — the pre-fix ids are not re-issued', async () => {
    // Every battle in flight when this shipped is this case: entries, no
    // counter. Below the cap the two derivations agree by construction, so the
    // migration is a no-op on exactly the battles that have no counter yet.
    const battle = makeTickBattle({ evaluations: priorEvaluations(3) });
    delete battle.cronState.evalSeq;
    const { entry, finalUpdate } = await runTick({ battle });
    expect(entry.evalId).toBe('eval_004');
    expect(finalUpdate['cronState.evalSeq']).toBe(4);
  });

  it('past the 150 cap the ids keep moving: eval_151, then eval_152, distinct', async () => {
    // THE DEFECT, exactly: the array is pinned at its 150-entry cap, so
    // `evaluations.length + 1` is 151 on BOTH ticks. Only the counter moves.
    const atCap = makeTickBattle({
      evaluations: priorEvaluations(150, { firstSeq: 1 }),
      cronState: { ...makeTickBattle().cronState, evalSeq: 150 },
    });
    expect(atCap.evaluations).toHaveLength(150);
    const first = await runTick({ battle: atCap });
    expect(first.entry.evalId).toBe('eval_151');
    expect(first.finalUpdate['cronState.evalSeq']).toBe(151);
    // The array is still capped after the append — the length has nothing left
    // to say, which is why the old derivation could not recover.
    expect(first.finalUpdate.evaluations).toHaveLength(150);

    const nextTick = makeTickBattle({
      evaluations: first.finalUpdate.evaluations,
      cronState: { ...makeTickBattle().cronState, evalSeq: first.finalUpdate['cronState.evalSeq'] },
    });
    expect(nextTick.evaluations).toHaveLength(150);
    const second = await runTick({ battle: nextTick });
    expect(second.entry.evalId).toBe('eval_152');
    expect(second.finalUpdate['cronState.evalSeq']).toBe(152);
    expect(second.entry.evalId).not.toBe(first.entry.evalId);

    // ANTI-VACUOUS (mutation check): under the retired rule both ticks read
    // `evaluations.length + 1` — 151 and 151. This row can only be green
    // because the counter, not the length, drives the id.
    expect(atCap.evaluations.length + 1).toBe(151);
    expect(nextTick.evaluations.length + 1).toBe(151);
  });

  it('evalSeq rides the SAME update as the append, as an explicit number (D-105)', async () => {
    const { db, finalUpdate } = await runTick();
    // One write carries the sequence, and it is the one carrying the entry.
    const carriers = db.__updates.filter((u) => 'cronState.evalSeq' in u);
    expect(carriers).toHaveLength(1);
    expect(carriers[0]).toBe(finalUpdate);
    expect(Array.isArray(carriers[0].evaluations)).toBe(true);
    // An explicit value, never a Firestore increment sentinel.
    expect(typeof finalUpdate['cronState.evalSeq']).toBe('number');
    expect(finalUpdate['cronState.evalSeq']).toBe(finalUpdate.evaluations.length);
  });
});
