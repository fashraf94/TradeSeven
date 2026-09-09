// api/cron/agent-evaluate.tickStamps.flagOff.test.js
//
// Phase B — the tick stamps: THE FLAG-OFF GOLDEN (spec §1.1 / §3 "flag-off entry
// golden"; D-113). The survivor proof, written first.
//
// Drives the REAL processAgentBattle through the full-Haiku path (the harness
// in api/_utils/__fixtures__/tickStampsHarness.js) with TICK_STAMPS_ENABLED
// explicitly FALSE, and pins the COMPOSED EVALUATION ENTRY byte-for-byte to a
// golden captured from origin/main @ 4a8ae54a — BEFORE any stamp code existed
// in agent-evaluate.js. While the flag is off, the entry the cron writes is
// exactly the entry it wrote before Phase B: same keys, same order, same bytes.
//
// The flag is mocked to an EXPLICIT false here (the hermetic per-file value,
// Ask 2 founder decision 2) so this contract holds in every live state — the
// live value is pinned once, in src/config/tickStampsFlags.test.js. Every other
// module in the graph is the real one except the five boundary mocks the
// golden-path harness already uses (model, market data, tournament ledger,
// firebase init) plus the three fire-and-forget voice/shadow sinks.
//
// Regenerate the golden ONLY when the entry composition itself deliberately
// changes (a new pre-stamp key, a renamed field), never to make this suite
// green after a stamp change:
//   GENERATE_TICK_STAMPS_GOLDEN=1 npx vitest run api/cron/agent-evaluate.tickStamps.flagOff.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  undefinedPaths,
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
  // The session filter passes the fixture's candles through as today's RTH
  // session (the real parser is covered in marketDataCache.test.js).
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
// THE FLAG — explicit false (hermetic). Everything else in featureFlags.js is live.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  TICK_STAMPS_ENABLED: false,
}));

const { processAgentBattle } = await import('./agent-evaluate.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(HERE, '../_utils/__fixtures__/tickStampsEntryGolden.flagOff.json');
// globalThis.process: the featureFlags.js idiom — the repo's ESLint globals are the browser set.
const GENERATE = globalThis.process?.env?.GENERATE_TICK_STAMPS_GOLDEN === '1';

function stubMarket() {
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
}

async function runTick({ battle = makeTickBattle(), result = makeHoldResult(), cronStartTime = Date.now() } = {}) {
  const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  mocks.create.mockImplementation(async () => makeToolUseResponse(result));
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0 };
  await processAgentBattle(db, battle, summary, cronStartTime, new Map(), { everEnabled: false });
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  return { db, summary, finalUpdate, entry: finalUpdate ? finalUpdate.evaluations[finalUpdate.evaluations.length - 1] : null };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  stubMarket();
});
afterEach(() => { vi.useRealTimers(); });

describe('Phase B tick stamps — flag OFF: the composed entry is byte-identical to the pre-Phase-B golden', () => {
  it('the tick reaches the model and writes a full-Haiku entry (the golden is not an early return)', async () => {
    const { entry, finalUpdate, summary } = await runTick();
    expect(finalUpdate, 'no finalUpdate carrying evaluations was written').not.toBeNull();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(summary.triggered).toBe(1);
    expect(summary.evaluated).toBe(1);
    expect(entry.evalId).toBe('eval_001');
    expect(entry.decision).toBe('HOLD');
    expect(entry.haikuError).toBeNull();
    expect(entry.triggers).toEqual(['forced_open']);
    expect(undefinedPaths(finalUpdate)).toEqual([]);
  });

  it('the entry is byte-identical to the golden captured before the stamp code existed (keys, order, bytes)', async () => {
    const { entry, finalUpdate } = await runTick();
    if (GENERATE) {
      writeFileSync(GOLDEN_PATH, `${JSON.stringify({
        capturedFrom: 'origin/main @ 4a8ae54a — agent-evaluate.js before any Phase B stamp code; harness tickStampsHarness.js',
        frozenNow: FROZEN_NOW,
        finalUpdateKeys: Object.keys(finalUpdate),
        entry,
      }, null, 2)}\n`);
    }
    expect(existsSync(GOLDEN_PATH), `golden missing — run with GENERATE_TICK_STAMPS_GOLDEN=1 once, from the pre-stamp tree`).toBe(true);
    const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
    // JSON.stringify preserves key order, so this is a byte comparison of the
    // serialized entry, not a structural toEqual.
    expect(JSON.stringify(entry)).toBe(JSON.stringify(golden.entry));
    // No new TOP-LEVEL battle key rides the final update either (V2 hazard 9).
    expect(Object.keys(finalUpdate).sort()).toEqual([...golden.finalUpdateKeys].sort());
  });

  it('the entry carries exactly the 25 pre-Phase-B keys, in source order, and none of the four stamp keys', async () => {
    const { entry } = await runTick();
    expect(Object.keys(entry)).toEqual([...PRE_PHASE_B_ENTRY_KEYS]);
    for (const key of ['heard', 'evidence', 'vintages', 'candidates']) {
      expect(entry, `flag-off entry must not carry "${key}"`).not.toHaveProperty(key);
    }
    expect(JSON.stringify(entry)).not.toMatch(/"heard"|"evidence"|"vintages"|"candidates"/);
  });

  it('anti-vacuous: the golden on disk holds the 25 pre-Phase-B keys and a real HOLD decision', () => {
    const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
    expect(Object.keys(golden.entry)).toEqual([...PRE_PHASE_B_ENTRY_KEYS]);
    expect(golden.entry.decision).toBe('HOLD');
    expect(golden.entry.timestamp).toBe(FROZEN_NOW);
    expect(golden.finalUpdateKeys).toContain('evaluations');
    expect(golden.finalUpdateKeys).toContain('statusFeed');
  });
});
