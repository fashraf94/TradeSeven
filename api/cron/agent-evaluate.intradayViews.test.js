// api/cron/agent-evaluate.intradayViews.test.js
//
// Intraday Data — Build 1, contract §8.1: FLAG ON, end to end. The same
// harness as the tick-stamps suites (tickStampsHarness.js), the same REAL
// processAgentBattle through the full-Haiku path, with
// INTRADAY_DIAGNOSTIC_ENABLED and TICK_STAMPS_ENABLED mocked TRUE (hermetic;
// the live values are pinned in src/config/intradayFlags.test.js and
// tickStampsFlags.test.js).
//
// What this suite proves on the REAL composed entry:
//   • With a valid snapshot: ONE view written set-merge beside the check
//     (agentBattles/{id}/intradayViews/{evalId}) for held ∪ bench, with
//     per-indicator verdicts, presetBand from the battle's preset, shadow
//     lines stored, providedToDecision false; the entry carries EXACTLY the
//     eight pointer fields; the vintages block gains the two snapshot keys and
//     `vwap` names its vintage.
//   • THE FOUR FAILURE MODES — missing snapshot, malformed snapshot, unreadable
//     snapshot, failed view write — each leave the evaluation entry, the
//     decision and the status feed byte-identical to the flag-off golden
//     apart from the pointer fields, whose status names the failure and whose
//     intradayViewRef is null; the vintages block is today's five keys.
//   • The prompt sent to the model is identical with diagnostics on and off
//     (§9.2 (d)) — asserted in agentEvalPromptAssembly.intradayDiff.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW, HELD, BENCH, PRE_PHASE_B_ENTRY_KEYS, BASE_ENTRY_KEYS,
  makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeToolUseResponse, makeTickDb, undefinedPaths, POST_GOLDEN_UPDATE_KEYS,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { VINTAGE_FIELDS, INTRADAY_VINTAGE_FIELDS } from '../_utils/tickStamps.js';
import { INTRADAY_ENTRY_FIELDS } from '../_utils/intraday/view.js';
import { runSweepCalc } from '../_utils/intraday/sweepCalc.js';
import * as CONFIG from '../_utils/intradayConfig.js';
import { makeSession, obsAt } from '../_utils/__fixtures__/intradaySessions.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(),
  fetchIntradayBatch: vi.fn(),
  create: vi.fn(),
  generateAnticipation: vi.fn(async () => null),
  generateTradeNarration: vi.fn(async () => null),
}));

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
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: (...args) => mocks.generateAnticipation(...args) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: (...args) => mocks.generateTradeNarration(...args) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
// THE FLAGS — explicit true (hermetic). Everything else in featureFlags.js is live.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  TICK_STAMPS_ENABLED: true,
  INTRADAY_DIAGNOSTIC_ENABLED: true,
  // Tick capture ships dark — pinned false explicitly so this suite's
  // flag-off-golden comparisons stay hermetic across a future flip.
  TICK_CAPTURE_ENABLED: false,
}));

const { processAgentBattle } = await import('./agent-evaluate.js');
const { readIntradaySnapshot } = await import('../_utils/intraday/evaluatorHook.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(resolve(HERE, '../_utils/__fixtures__/tickStampsEntryGolden.flagOff.json'), 'utf8'));
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

// A real snapshot for the harness's held + bench names, swept for 46 minutes
// of the frozen session (Wed Sep 9 2026, 11:00 ET) so the check finds it fresh.
const SESSION = makeSession('2026-09-09', { previousEtDate: '2026-09-08' });
const etDateOf = (ms) => new Date(ms - 4 * 3600_000).toISOString().slice(0, 10);
function makeSnapshot({ generation = 46 } = {}) {
  const stocks = [...HELD.filter((s) => s !== 'BTC'), ...BENCH];
  const actionable = new Set(stocks);
  let prev = {}; let uni = { accumulators: {} }; let docs = {}; let last = null;
  // Addendum A2 made a null-cutoff verdict age from the quote's own
  // `availableAt`, which exposed a fixture artefact: the sweep ran on session
  // minutes whose availableAt (priceAsOf + 16 min) landed 16 minutes AFTER
  // FROZEN_NOW — a quote received after the check that read it. Wound back so
  // the last sweep's availableAt IS the check's instant, as a 15-minute
  // delayed feed actually behaves.
  const startMin = 28; // priceAsOf 09:58 ET … 10:44 ET; available 10:14 … 11:00 ET
  for (let s = 0; s <= 46; s++) {
    const observations = {};
    stocks.forEach((sym, i) => {
      const p = 100 + i * 25 + Math.sin(s / 4 + i) * 1.2;
      observations[sym] = obsAt(SESSION, startMin + s, { sym, price: Number(p.toFixed(4)), volume: 20_000 * (s + 1), high: p + 1, low: p - 1, open: 100 + i * 25, extra: { averageVolume: 8_000_000, previousClose: 99 + i * 25, change: 1, changePercent: 1, size: 100 } });
    });
    observations.BTC = { ...obsAt(SESSION, startMin + s, { sym: 'BTC', price: 60000 + s, volume: 5, high: 60100, low: 59900, open: 60000 }), source: 'eodhd_live_v1_crypto' };
    last = runSweepCalc({ prevSnapshotSymbols: prev, universeState: uni, actionableDocs: docs, observations, actionableSet: actionable, cryptoSet: new Set(['BTC']), session: SESSION, etDateOf, sessionOf: () => SESSION, nowMs: SESSION.openMs + (startMin + s) * 60_000 + 16 * 60_000, sweepId: `sw${s}`, generation: s + 1, config: CONFIG });
    prev = last.snapshotSymbols; uni = last.universeState; docs = last.actionableDocs;
  }
  // The snapshot's own instant is the harness's last sweep, not a separate
  // constant — so `availableAt`, `sweepAt` and the check all agree.
  const sweepAt = SESSION.openMs + (startMin + 46) * 60_000 + 16 * 60_000;
  return { sweepId: 'sw46', generation, sweepAt, lastSuccessfulSweepAt: sweepAt, calcVersion: CONFIG.CALC_VERSION, anomalies: last.anomalies, counters: last.counters, symbols: last.snapshotSymbols, lease: null };
}
const SNAPSHOT = makeSnapshot();

/** The tick harness db, extended with intradaySnapshots/latest and the intradayViews subcollection. */
function makeIntradayDb(base, { snapshot = null, readError = null, readHang = false, writeError = null } = {}) {
  const views = [];
  const counts = { snapshotReads: 0, viewWrites: 0 };
  return {
    ...base,
    collection(col) {
      if (col === 'intradaySnapshots') {
        return { doc: (id) => ({ path: `intradaySnapshots/${id}`, async get() {
          counts.snapshotReads += 1;
          if (readError) throw readError;
          if (readHang) return new Promise(() => {});
          return { exists: snapshot != null, id, data: () => structuredClone(snapshot) };
        } }) };
      }
      const c = base.collection(col);
      if (col !== 'agentBattles') return c;
      return {
        ...c,
        doc: (id) => {
          const ref = c.doc(id);
          return { ...ref, collection: (sub) => ({ doc: (vid) => ({ path: `agentBattles/${id}/${sub}/${vid}`, async set(data, opts) {
            counts.viewWrites += 1;
            if (writeError) throw writeError;
            expect(undefinedPaths(data)).toEqual([]);
            views.push({ path: `agentBattles/${id}/${sub}/${vid}`, data: structuredClone(data), opts });
          } }) }) };
        },
      };
    },
    __views: views,
    __intradayCounts: counts,
  };
}

async function runTick({ battle = makeTickBattle(), result = makeHoldResult(), intraday = {}, context = 'read' } = {}) {
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  const db = makeIntradayDb(makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() }), intraday);
  mocks.create.mockImplementation(async () => makeToolUseResponse(result));
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  // The handler reads the snapshot ONCE per invocation and hands it to every
  // battle; the same call is made here.
  const intradayContext = context === 'read' ? await readIntradaySnapshot(db, { timeoutMs: 300 }) : context;
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false }, intradayContext);
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  return { db, summary, finalUpdate, entry: finalUpdate ? finalUpdate.evaluations[finalUpdate.evaluations.length - 1] : null, intradayContext };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset(); mocks.fetchIntradayBatch.mockReset(); mocks.create.mockReset();
  mocks.generateAnticipation.mockReset(); mocks.generateAnticipation.mockImplementation(async () => null);
  mocks.generateTradeNarration.mockReset(); mocks.generateTradeNarration.mockImplementation(async () => null);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('§8.1 flag ON — a valid snapshot', () => {
  it('writes ONE view set-merge beside the check for held ∪ bench; the entry carries exactly the eight pointer fields; the vintages gain the snapshot keys', async () => {
    const { db, entry, finalUpdate } = await runTick({ intraday: { snapshot: SNAPSHOT } });
    expect(db.__intradayCounts).toEqual({ snapshotReads: 1, viewWrites: 1 });
    const [w] = db.__views;
    expect(w.path).toBe(`agentBattles/${makeTickBattle().id}/intradayViews/${entry.evalId}`);
    expect(w.opts).toEqual({ merge: true });
    const view = w.data;
    expect(view).toMatchObject({ evalId: entry.evalId, battleId: makeTickBattle().id, sweepId: 'sw46', generation: 46, calcVersion: CONFIG.CALC_VERSION, policyVersion: 1, presetId: 'balanced', presetBand: 0.5, providedToDecision: false });
    expect(view.evaluatedAt).toBe(Date.parse(entry.timestamp));
    expect(Object.keys(view.symbols).sort()).toEqual([...new Set([...HELD, ...BENCH])].sort());
    for (const sym of HELD) expect(view.symbols[sym].indicators.vwap.verdict).toHaveProperty('state');
    // calcVersion 2: the cutoff is confirmed, so the verdict is eligible and
    // its age is measured from the indicator's OWN cutoff — the last accepted
    // trade — not from the sweep and not from the quote's availableAt (§8.3).
    const nvdaCutoff = view.symbols.NVDA.indicators.vwap.estimateCutoff;
    expect(nvdaCutoff).not.toBeNull();
    expect(view.symbols.NVDA.indicators.vwap.verdict).toEqual({ state: 'eligible', reason: null, consumer: 'display', ageMs: view.evaluatedAt - nvdaCutoff });
    expect(view.symbols.BTC.indicators.vwap.verdict.reason).toBe('no_session_anchor');
    expect(view.shadowLines.length).toBeGreaterThan(0);
    // The entry: base keys, the stamps, then EXACTLY the eight pointer fields.
    expect(Object.keys(entry)).toEqual([...BASE_ENTRY_KEYS, ...INTRADAY_ENTRY_FIELDS, 'heard', 'evidence', 'vintages']);
    expect(pick(entry, INTRADAY_ENTRY_FIELDS)).toEqual({
      intradaySnapshotId: 'sw46', intradayGeneration: 46, intradayViewRef: entry.evalId, intradayViewStatus: 'written',
      intradayEvaluatedAt: entry.timestamp, intradayPolicyVersion: 1,
      decisionStartedAt: entry.promptBuiltAt, decisionCompletedAt: entry.promptBuiltAt, // frozen clock: buildMs = callMs = 0
    });
    expect(Object.keys(entry.vintages)).toEqual([...VINTAGE_FIELDS, ...INTRADAY_VINTAGE_FIELDS]);
    expect(entry.vintages).toMatchObject({ quote: 'tick', vwap: 'diagnostic', intradaySnapshotId: 'sw46', intradayGeneration: 46 });
    // The 25 pre-Phase-B values and the finalUpdate's keys are the golden's — the decision path is untouched.
    expect(JSON.stringify(pick(entry, PRE_PHASE_B_ENTRY_KEYS))).toBe(JSON.stringify(GOLDEN.entry));
    // POST_GOLDEN_UPDATE_KEYS are lifted off this comparison — they ride every
    // write, flag on or off, and postdate the golden capture (the harness).
    expect(Object.keys(finalUpdate).filter((k) => !POST_GOLDEN_UPDATE_KEYS.includes(k)))
      .toEqual(GOLDEN.finalUpdateKeys);
    expect(undefinedPaths(finalUpdate)).toEqual([]);
    // No new top-level battle key (the legacy cronState.intradayMomentum is today's and is in the golden).
    expect(Object.keys(finalUpdate).filter((k) => /intraday/i.test(k))).toEqual(['cronState.intradayMomentum']);
  });
  it('the diagnostic view is never handed to the decision: the model request carries no diagnostic value and no shadow line', async () => {
    const { db } = await runTick({ intraday: { snapshot: SNAPSHOT } });
    const request = mocks.create.mock.calls[0][0];
    const sent = JSON.stringify(request);
    const view = db.__views[0].data;
    for (const line of view.shadowLines) expect(sent).not.toContain(line.slice(line.indexOf(': ') + 2));
    expect(sent).not.toMatch(/intradayViews|providedToDecision|Diagnostic · recorded/);
    expect(sent).not.toContain(String(view.symbols.NVDA.indicators.vwap.value));
  });
});

describe('§8.1 flag ON — the four failure modes leave the evaluation byte-identical apart from the pointer fields', () => {
  const cases = [
    ['missing snapshot → no_snapshot', { snapshot: null }, 'no_snapshot', { snapshotId: null, generation: null }],
    ['malformed snapshot → snapshot_invalid', { snapshot: { sweepId: 'sw46', symbols: 'nope' } }, 'snapshot_invalid', { snapshotId: null, generation: null }],
    ['unreadable snapshot (throws) → read_failed', { readError: new Error('UNAVAILABLE') }, 'read_failed', { snapshotId: null, generation: null }],
    ['unreadable snapshot (hangs past the bound) → read_failed', { readHang: true }, 'read_failed', { snapshotId: null, generation: null }],
    ['view write failure → write_failed with intradayViewRef null', { snapshot: SNAPSHOT, writeError: new Error('DEADLINE_EXCEEDED') }, 'write_failed', { snapshotId: 'sw46', generation: 46 }],
  ];
  for (const [label, intraday, status, ids] of cases) {
    it(label, async () => {
      const { entry, finalUpdate, db } = await runTick({ intraday });
      expect(entry.intradayViewStatus).toBe(status);
      expect(entry.intradayViewRef).toBeNull();
      expect(entry.intradaySnapshotId).toBe(ids.snapshotId);
      expect(entry.intradayGeneration).toBe(ids.generation);
      expect(entry.intradayPolicyVersion).toBe(1);
      expect(entry.intradayEvaluatedAt).toBe(entry.timestamp);
      expect(db.__views).toEqual([]);
      // Byte-identical to the flag-off golden apart from the pointer fields.
      expect(JSON.stringify(pick(entry, PRE_PHASE_B_ENTRY_KEYS))).toBe(JSON.stringify(GOLDEN.entry));
      // POST_GOLDEN_UPDATE_KEYS are lifted off this comparison — they ride every
      // write, flag on or off, and postdate the golden capture (the harness).
      expect(Object.keys(finalUpdate).filter((k) => !POST_GOLDEN_UPDATE_KEYS.includes(k)))
        .toEqual(GOLDEN.finalUpdateKeys);
      expect(Object.keys(entry)).toEqual([...BASE_ENTRY_KEYS, ...INTRADAY_ENTRY_FIELDS, 'heard', 'evidence', 'vintages']);
      // The vintages block is today's five keys — no snapshot pointer without a written view.
      expect(Object.keys(entry.vintages)).toEqual([...VINTAGE_FIELDS]);
      expect(entry.vintages.vwap).toBe('tick');
      expect(entry.decision).toBe(GOLDEN.entry.decision);
      expect(JSON.stringify(finalUpdate.statusFeed)).toBe(JSON.stringify(GOLDEN.finalUpdate.statusFeed));
      expect(undefinedPaths(finalUpdate)).toEqual([]);
    });
  }
  it('a snapshot older than the stall window marks every symbol collectionStalled — the view is still written', async () => {
    const stale = { ...SNAPSHOT, lastSuccessfulSweepAt: Date.parse(FROZEN_NOW) - CONFIG.COLLECTION_STALL_MS - 1 };
    const { db, entry } = await runTick({ intraday: { snapshot: stale } });
    expect(entry.intradayViewStatus).toBe('written');
    const view = db.__views[0].data;
    expect(view.symbols.NVDA.collectionStalled).toBe(true);
    expect(view.symbols.NVDA.indicators.vwap.verdict.reason).toBe('collection_stalled');
  });
});
