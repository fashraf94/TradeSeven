// api/cron/agent-evaluate.intradayPromptDiff.honesty.test.js
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
  makeHoldResult, makeToolUseResponse, makeTickDb, undefinedPaths,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { VINTAGE_FIELDS, INTRADAY_VINTAGE_FIELDS } from '../_utils/tickStamps.js';
import { INTRADAY_ENTRY_FIELDS } from '../_utils/intraday/view.js';
import { runSweepCalc } from '../_utils/intraday/sweepCalc.js';
import * as CONFIG from '../_utils/intradayConfig.js';
import { makeSession, obsAt } from '../_utils/__fixtures__/intradaySessions.js';

const mocks = vi.hoisted(() => ({
  diag: { value: true },
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
// THE FLAG AS A LIVE GETTER — flipped between two ticks in ONE file so the
// prompt sent with diagnostics ON is compared with the prompt sent OFF under
// the same frozen clock, the same battle, the same mocked model.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  TICK_STAMPS_ENABLED: true,
  get INTRADAY_DIAGNOSTIC_ENABLED() { return mocks.diag.value; },
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
  const startMin = 44; // 10:14 ET … 11:00 ET
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
  const sweepAt = Date.parse(FROZEN_NOW) - 30_000;
  return { sweepId: 'sw46', generation, sweepAt, lastSuccessfulSweepAt: sweepAt, calcVersion: 1, anomalies: last.anomalies, counters: last.counters, symbols: last.snapshotSymbols, lease: null };
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

describe('§9.2 (d) — the sent prompt with diagnostics on and off', () => {
  it('is byte-identical under the frozen clock; no diagnostic value or shadow line is sent', async () => {
    mocks.diag.value = true;
    const on = await runTick({ intraday: { snapshot: SNAPSHOT } });
    expect(on.entry.intradayViewStatus).toBe('written');
    const requestOn = mocks.create.mock.calls[0][0];
    mocks.create.mockClear();
    mocks.diag.value = false;
    const off = await runTick({ intraday: { snapshot: SNAPSHOT }, context: null });
    expect(off.entry).not.toHaveProperty('intradayViewStatus');
    expect(off.db.__intradayCounts.viewWrites).toBe(0);
    const requestOff = mocks.create.mock.calls[0][0];
    expect(JSON.stringify(requestOn)).toBe(JSON.stringify(requestOff));
    const sent = JSON.stringify(requestOn);
    const view = on.db.__views[0].data;
    for (const line of view.shadowLines) expect(sent).not.toContain(line.slice(line.indexOf(': ') + 2));
    expect(sent).not.toMatch(/intradayViews|providedToDecision|Diagnostic · recorded|shadowLines/);
    for (const sym of HELD) {
      const est = view.symbols[sym]?.indicators?.vwap?.value;
      if (Number.isFinite(est)) expect(sent).not.toContain(est.toFixed(2));
    }
    // And the two entries differ only by the eight pointer fields + the vintage keys.
    //
    // Addendum A9: `vintages.vwap` is a REAL, pre-existing field — it was
    // previously overwritten to 'tick' on both sides before the diff, which
    // made the comparison blind to it. The review smuggled an arbitrary
    // string through it and this test stayed green. It is now ASSERTED on
    // each side and then removed, so the diff below still means "everything
    // else is identical" while nothing hides inside the normalisation.
    expect(off.entry.vintages?.vwap).toBe('tick');
    expect(on.entry.vintages?.vwap).toBe('diagnostic');
    const strip = (e) => {
      const c = { ...e };
      for (const k of INTRADAY_ENTRY_FIELDS) delete c[k];
      if (c.vintages) {
        c.vintages = { ...c.vintages };
        delete c.vintages.intradaySnapshotId;
        delete c.vintages.intradayGeneration;
        delete c.vintages.vwap; // asserted above, not normalised away
      }
      return c;
    };
    expect(JSON.stringify(strip(on.entry))).toBe(JSON.stringify(strip(off.entry)));
  });
});
