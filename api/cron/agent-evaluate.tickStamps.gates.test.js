// api/cron/agent-evaluate.tickStamps.gates.test.js
//
// Phase B — the tick stamps: THE FAIL-SAFE AND THE PROMPT GATE, end to end.
//
// Three faults, one real processAgentBattle each, the same harness as the
// flag-on suite, TICK_STAMPS_ENABLED mocked TRUE. Every boundary double below
// is a TOGGLE (hoisted flags read at call time) so one file covers all three:
//   1. The composer throws → the entry is written UNSTAMPED (25 keys), the lock
//      is released, the fault is logged loud — the regimeAtStart / control-epoch
//      "tick continues" precedent.
//   2. resolveControls throws AT THE STAMP SITE only (the telemetry's and the
//      fenced assembler's calls stay real) → the same outcome: the fail-safe's
//      extent covers the cron's own statements, not just the composer (review
//      D-2; a `try` moved to wrap only Object.assign reddens this row).
//   3. buildLiveContextBlock throws → the prompt was never finished, so NO stamp
//      rides the entry even though `haikuAttempted` is true (review A-4 / B-1:
//      the gate is `promptBuilt`, set only after the three prompt parts exist
//      and before the transport call). The entry is the ordinary failure HOLD.

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

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(),
  fetchIntradayBatch: vi.fn(),
  create: vi.fn(),
  composerThrows: false,
  resolveThrowsAtStampSite: false,
  liveBlockThrows: false,
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
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({
  ...(await importOriginal()),
  logEvaluation: vi.fn(async () => false),
  logVisionTransition: vi.fn(async () => false),
  logAnticipation: vi.fn(async () => false),
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({ ...(await importOriginal()), TICK_STAMPS_ENABLED: true }));
// FAULT 1 — the composer.
vi.mock('../_utils/tickStamps.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    composeTickStamps: (...args) => {
      if (mocks.composerThrows) throw new Error('stamp composer exploded (test fault)');
      return real.composeTickStamps(...args);
    },
  };
});
// FAULT 2 — resolveControls, but ONLY when called from the stamp site: the
// telemetry (controlSuppressionTelemetry.js) and the fenced assembler
// (agentEvalPromptAssembly.js) call the same function and must stay real.
vi.mock('../_utils/controlPromptRenderer.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    resolveControls: (...args) => {
      const stack = new Error().stack || '';
      const fromStampSite = stack.includes('agent-evaluate.js')
        && !stack.includes('controlSuppressionTelemetry')
        && !stack.includes('agentEvalPromptAssembly');
      if (mocks.resolveThrowsAtStampSite && fromStampSite) throw new Error('resolveControls exploded at the stamp site (test fault)');
      return real.resolveControls(...args);
    },
  };
});
// FAULT 3 — the live-context builder (fenced module, DOUBLED in this test only,
// never edited): the prompt cannot be finished.
vi.mock('../_utils/agentEvalPromptAssembly.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    buildLiveContextBlock: async (...args) => {
      if (mocks.liveBlockThrows) throw new TypeError('live context builder exploded (test fault)');
      return real.buildLiveContextBlock(...args);
    },
  };
});

const { processAgentBattle } = await import('./agent-evaluate.js');

async function runTick() {
  const battle = makeTickBattle();
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
  const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  return { db, summary, finalUpdate, entry: finalUpdate ? finalUpdate.evaluations[finalUpdate.evaluations.length - 1] : null };
}

let errorSpy;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  mocks.composerThrows = false;
  mocks.resolveThrowsAtStampSite = false;
  mocks.liveBlockThrows = false;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const loggedLine = (needle) => errorSpy.mock.calls.map((c) => c.join(' ')).find((line) => line.includes(needle));

function expectUnstampedWrite({ entry, finalUpdate, summary }) {
  expect(finalUpdate, 'the finalUpdate must still be written').toBeTruthy();
  expect(Object.keys(entry)).toEqual([...PRE_PHASE_B_ENTRY_KEYS]);
  for (const key of ['heard', 'evidence', 'vintages', 'candidates']) expect(entry).not.toHaveProperty(key);
  expect(finalUpdate['cronState.evaluatingAt']).toBeNull();
  expect(summary.evaluated).toBe(1);
}

describe('Phase B tick stamps — the fail-safe: a fault inside the stamp block never costs the tick its write', () => {
  it('the composer throws → the entry is written UNSTAMPED with the 25 pre-Phase-B keys, the lock is released, and the fault is logged loud', async () => {
    mocks.composerThrows = true;
    const run = await runTick();
    expectUnstampedWrite(run);
    expect(run.entry.decision).toBe('HOLD');
    expect(run.entry.haikuError).toBeNull();
    const logged = loggedLine('tick stamps failed');
    expect(logged).toBeTruthy();
    expect(logged).toContain('battle-tick-1');
    expect(logged).toContain('entry written unstamped');
    expect(logged).toContain('stamp composer exploded');
  });

  it('resolveControls throws AT THE STAMP SITE → the same unstamped write; the telemetry\'s and the assembler\'s calls were untouched (the prompt was built and the model called once)', async () => {
    mocks.resolveThrowsAtStampSite = true;
    const run = await runTick();
    expectUnstampedWrite(run);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(run.entry.haikuError).toBeNull();
    const logged = loggedLine('tick stamps failed');
    expect(logged).toBeTruthy();
    expect(logged).toContain('resolveControls exploded at the stamp site');
  });
});

describe('Phase B tick stamps — the prompt gate: no prompt, no stamp', () => {
  it('buildLiveContextBlock throws → the model is never called, the tick degrades to the failure HOLD, and NO stamp rides the entry even though the attempt started', async () => {
    mocks.liveBlockThrows = true;
    const run = await runTick();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(run.finalUpdate).toBeTruthy();
    expect(run.entry.decision).toBe('HOLD');
    expect(run.entry.haikuError?.failureClass).toBe('TypeError');
    expect(run.entry.rationale).toBe('Haiku call failed — defaulting to HOLD');
    // the attempt DID start (totalHaikuCalls counts attempts) …
    expect(run.finalUpdate['cronState.totalHaikuCalls']).toBe(1);
    // … but the prompt never existed, so nothing was heard or seen
    expect(Object.keys(run.entry)).toEqual([...PRE_PHASE_B_ENTRY_KEYS]);
    for (const key of ['heard', 'evidence', 'vintages', 'candidates']) expect(run.entry).not.toHaveProperty(key);
    expect(JSON.stringify(run.entry)).not.toContain(OLD_THREAD);
    // and nothing was logged as a stamp failure — the gate, not the fail-safe, held
    expect(loggedLine('tick stamps failed')).toBeUndefined();
  });
});
