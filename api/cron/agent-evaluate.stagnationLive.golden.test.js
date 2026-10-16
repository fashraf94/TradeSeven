// api/cron/agent-evaluate.stagnationLive.golden.test.js
//
// Film Room B1.1 item 1 (Amendment C, RC-2) — THE PROOF OF NO CHANGE ON THE
// LIVE STAGNATION PATH (exit criterion 1; review X1-3). The frozen calls-off
// and rollback goldens start every symbol on its first tick, so the
// stagnation rule never runs in them. This suite seeds the counters so it
// does — fires that execute, fires the hurdle floor vetoes, the circuit
// breaker, age pauses, resets, a threshold crossed, a quote with no
// changePercent (the `|| 0`), a degen winner test, capture off, and eight
// ticks chained from an empty state — and runs each tick through the REAL
// processAgentBattle with the fenced risk manager OBSERVED, never replaced.
//
// THE FIXTURE (api/_utils/__fixtures__/stagnationLiveGolden.json) IS CAPTURED
// FROM THE TREE BEFORE B1.1: a `git archive` of origin/main @ 1d6d5d4a with
// this file dropped in, by
//   GENERATE_STAGNATION_LIVE_GOLDEN=1 npx vitest run api/cron/agent-evaluate.stagnationLive.golden.test.js
// It holds, per tick, the SHA-256 of every compared part — the thrown
// message, the summary, every battle write (cronState included), every
// prompt, both capture documents, every writer's arguments, every
// evaluateRisk / updateStagnationCounter / clearsHurdleFloor call's inputs
// and result, and the end-state battle — plus a liveness summary in clear.
// Regenerate it ONLY from such a tree (never to make this suite green after
// a change), then move the pin in the same commit. The generating run fails
// on purpose after writing, and refuses CI.
//
// THE ONE INTENDED CHANGE is the capture's `risk.stagnation` (RC-2): lifted
// from the live capture before its digest is taken, after asserting it sits
// on exactly the tick records whose verdicts the tick computed, over those
// symbols, and that it records exactly what evaluateRisk received. Every
// other byte of every part is compared with the tree before B1.1.
//
// Built from refuter rf9's probe in the B1.1 review. `executeSwapServer` is
// doubled through a hoisted variable, so the literal call string never
// appears here (the call-site census in agent-evaluate.test.js).

// FIRST, before any module can build a local-time Date.
import '../_utils/__fixtures__/pinTimezoneUtc.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs,
  makeIntradayCandles, makeHoldResult, makeSwapResult, makeToolUseResponse, deepClone,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCaptureDb } from '../_utils/__fixtures__/tickCaptureHarness.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const { executeSwapServerMock } = vi.hoisted(() => ({ executeSwapServerMock: vi.fn() }));
const flagState = vi.hoisted(() => ({ tickCapture: true }));
const rec = vi.hoisted(() => ({ risk: [], stag: [], hurdle: [] }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => ({
  ...(await importOriginal()),
  executeSwapServer: executeSwapServerMock,
}));
// The fenced risk manager, OBSERVED, never replaced (BUILD_RULES §1: called, not edited): every call's inputs and result.
vi.mock('../_utils/agentRiskManager.js', async (importOriginal) => {
  const real = await importOriginal();
  const snap = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));
  return {
    ...real,
    evaluateRisk: (...args) => {
      const out = real.evaluateRisk(...args);
      rec.risk.push({ args: snap(args), out: snap(out) });
      return out;
    },
    updateStagnationCounter: (arg) => {
      const out = real.updateStagnationCounter(arg);
      rec.stag.push({ arg: snap(arg), out: snap(out) });
      return out;
    },
    clearsHurdleFloor: (arg) => {
      const out = real.clearsHurdleFloor(arg);
      rec.hurdle.push({ arg: snap(arg), out: snap(out) });
      return out;
    },
  };
});
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null),
  excludeHeldByOthers: vi.fn((list) => list), excludeHeldSymbols: vi.fn((list) => list),
  reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
vi.mock('../_utils/learning/captureReceipt.js', () => ({
  captureSwapReceipt: vi.fn(async () => {}),
  resolveEntrySnapshot: vi.fn(async () => ({ snapshotIn: null, techDocIn: null, entrySnapshotSource: 'unavailable' })),
  classifyEntryAtrSource: vi.fn(() => 'bench_atr'),
  classifyEvidence: vi.fn(() => 'live_agent'),
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, get TICK_CAPTURE_ENABLED() { return flagState.tickCapture; } };
});

const { processAgentBattle } = await import('./agent-evaluate.js');
const { newTickCaptureScope, runInTickCaptureScope, claimTickCaptureContext } = await import('../_utils/tickCapture/captureContext.js');
const { finalizeTickCapture } = await import('../_utils/tickCapture/captureWriter.js');
const ledger = await import('../_utils/tournamentAgentLedger.js');
const receipts = await import('../_utils/learning/captureReceipt.js');
const narration = await import('../_utils/voiceLayerTradeNarration.js');
const anticipation = await import('../_utils/voiceLayerAnticipation.js');
const shadowLog = await import('../_utils/shadowLogger.js');
const WRITERS = {
  executeSwapServer: () => executeSwapServerMock,
  reserveSymbol: () => ledger.reserveSymbol,
  confirmSwap: () => ledger.confirmSwap,
  releaseReservation: () => ledger.releaseReservation,
  captureSwapReceipt: () => receipts.captureSwapReceipt,
  generateTradeNarration: () => narration.generateTradeNarration,
  generateAnticipation: () => anticipation.generateAnticipation,
  logEvaluation: () => shadowLog.logEvaluation,
  logVisionTransition: () => shadowLog.logVisionTransition,
  logAnticipation: () => shadowLog.logAnticipation,
};

const TIME_BUDGET_MS = 290_000;
const NOW = Date.parse(FROZEN_NOW);

/** stag: { SYM: [seededCount, lastPriceFactor, minutesAgo] } — lastTickPrice = this tick's price × factor. */
function seeded({ stag = {}, prices = makePriceTable(), battle = {}, agentContext = null, trades = null } = {}) {
  const base = makeTickBattle(battle);
  const cs = { ...base.cronState, stagnationTicks: {}, lastTickPrice: {}, lastTickTimestamp: {} };
  for (const [sym, [count, factor, mins]] of Object.entries(stag)) {
    cs.stagnationTicks[sym] = count;
    cs.lastTickPrice[sym] = prices[sym].current * factor;
    cs.lastTickTimestamp[sym] = NOW - mins * 60000;
  }
  const out = { ...base, cronState: cs };
  if (agentContext) out.agentContext = { ...base.agentContext, ...agentContext };
  if (trades) { out.trades = trades; out.scoreState = { ...base.scoreState, tradeCount: trades.length }; }
  return out;
}
const pricesWith = (edit) => { const p = makePriceTable(); edit(p); return p; };
const recentSwap = (id, minutesAgo) => ({ id, symbolOut: 'PG', symbolIn: 'JPM', tier: 'support', swapDay: 1, entryPrice: 165, exitPrice: 166, lockedGainPct: 0.6, lockedPoints: 1, swappedOutAt: new Date(NOW - minutesAgo * 60000).toISOString(), exitReason: 'haiku_decision' });

const MIXED = { TSLA: [5, 1, 15], NVDA: [2, 1, 15], MSFT: [7, 1, 30], KO: [8, 1, 30], PG: [9, 1, 15], BTC: [5, 1, 15] };
const noPgChange = (p) => { delete p.PG.changePercent; };

const SCENARIOS = {
  fires_executes_mixed: () => { const prices = pricesWith(noPgChange); return { battle: seeded({ stag: MIXED, prices }), prices }; },
  fires_vetoed: () => {
    const prices = pricesWith((p) => { noPgChange(p); p.AMD.changePercent = -1.0; p.JPM.changePercent = -1.0; });
    return { battle: seeded({ stag: MIXED, prices }), prices };
  },
  fires_cap_hit: () => {
    const prices = pricesWith(noPgChange);
    return { battle: seeded({ stag: MIXED, prices, trades: [recentSwap('t1', 5), recentSwap('t2', 15), recentSwap('t3', 25), recentSwap('t4', 40)] }), prices };
  },
  two_fire: () => { const prices = makePriceTable(); return { battle: seeded({ stag: { TSLA: [6, 1.001, 10], KO: [6, 0.999, 10] }, prices }), prices }; },
  all_paused: () => {
    const prices = makePriceTable();
    const stag = Object.fromEntries(['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC'].map((s) => [s, [9, 1, 25]]));
    return { battle: seeded({ stag, prices }), prices };
  },
  threshold_cross_and_reset: () => {
    const prices = makePriceTable();
    return { battle: seeded({ stag: { TSLA: [5, 1, 15], KO: [5, 1.01, 15], NVDA: [5, 1.0029, 15], AMZN: [11, 1, 20] }, prices }), prices };
  },
  fires_then_model_swap: () => {
    const prices = pricesWith(noPgChange);
    return { battle: seeded({ stag: MIXED, prices }), prices, result: makeSwapResult({ symbolOut: 'KO', symbolIn: 'JPM', status_feed_update: 'Rotating KO → JPM.' }) };
  },
  fires_then_model_swap_executes: () => {
    const prices = pricesWith((p) => { noPgChange(p); p.AMD.changePercent = 3.0; p.JPM.changePercent = 2.0; });
    return { battle: seeded({ stag: MIXED, prices }), prices, result: makeSwapResult({ symbolOut: 'KO', symbolIn: 'JPM', status_feed_update: 'Rotating KO → JPM.' }) };
  },
  fires_capture_off: () => { const prices = pricesWith(noPgChange); return { battle: seeded({ stag: MIXED, prices }), prices, capture: false }; },
  degen_small_winner_fires: () => {
    const prices = pricesWith((p) => { p.MSFT.changePercent = 0.1; p.PG.changePercent = 0.15; });
    return { battle: seeded({ stag: { MSFT: [3, 1, 15], KO: [2, 1, 15], NVDA: [3, 1, 15], PG: [1, 1.0005, 10] }, prices, agentContext: { archetype: 'degen' } }), prices };
  },
};

function swapInStore(db, tier, slotIndex, incoming, priceOf) {
  const stored = db.__store.battle;
  const outgoing = stored.portfolio[tier][slotIndex];
  stored.portfolio[tier] = stored.portfolio[tier].map((a, i) => (
    i === slotIndex ? { ...incoming, swapPrice: priceOf(incoming.symbol), swappedInAt: new Date(Date.now()).toISOString() } : a
  ));
  stored.portfolio.bench = {
    ...stored.portfolio.bench,
    stocks: [
      ...(stored.portfolio.bench.stocks || []).filter((a) => a.symbol !== incoming.symbol),
      { ...outgoing, cooldownUntil: '2026-09-10T15:00:00.000Z' },
    ],
  };
  stored.trades = [...(stored.trades || []), { id: `tr_${(stored.trades || []).length + 1}`, symbolIn: incoming.symbol, symbolOut: outgoing.symbol, lockedPoints: 0, entryPrice: 0, swappedOutAt: new Date(Date.now()).toISOString(), exitReason: 'probe' }];
  stored.scoreState = { ...stored.scoreState, tradeCount: (stored.scoreState?.tradeCount || 0) + 1 };
  return outgoing;
}

async function runTick({ battle, prices, result = makeHoldResult(), capture = true }) {
  flagState.tickCapture = capture;
  rec.risk = []; rec.stag = []; rec.hurdle = [];
  for (const get of Object.values(WRITERS)) get().mockClear();
  mocks.create.mockClear();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(result));
  const db = makeCaptureDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  executeSwapServerMock.mockImplementation(async (_db, _id, _b, tier, slotIndex, incoming) => {
    const outgoing = swapInStore(db, tier, slotIndex, incoming, (s) => prices[s]?.current ?? 0);
    return {
      closedTrade: { symbolIn: incoming.symbol, symbolOut: outgoing.symbol, tier, slotIndex, swappedOutAt: new Date(Date.now()).toISOString(), entryPrice: 0, lockedPoints: 1.5 },
      incomingAsset: { ...incoming, swapPrice: prices[incoming.symbol]?.current ?? 0 },
    };
  });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  const cronStartTime = Date.now();
  let thrown = null;
  const scope = capture ? newTickCaptureScope() : null;
  try {
    await runInTickCaptureScope(scope, () => processAgentBattle(db, battle, summary, cronStartTime, new Map(), { everEnabled: false }));
  } catch (err) {
    thrown = String(err?.message || err);
    const abandoned = claimTickCaptureContext(scope);
    if (abandoned) await finalizeTickCapture(db, abandoned, { remainingBudgetMs: TIME_BUDGET_MS - (Date.now() - cronStartTime) });
  }
  const argOf = (a) => {
    if (a === db) return '<db>';
    if (a === battle) return '<battle>';
    if (a && typeof a === 'object' && !Array.isArray(a) && 'db' in a) return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, k === 'db' ? '<db>' : (v === battle ? '<battle>' : v)]));
    return a;
  };
  const writers = Object.fromEntries(Object.entries(WRITERS).map(([name, get]) => [name, get().mock.calls.map((call) => deepClone(call.map(argOf)))]));
  return JSON.parse(JSON.stringify({
    thrown,
    summary,
    updates: db.__updates,
    prompts: mocks.create.mock.calls.map((call) => deepClone(call[0])),
    capture: db.__captureWrites,
    writers,
    riskCalls: rec.risk,
    stagCalls: rec.stag,
    hurdleCalls: rec.hurdle,
    stored: db.__store.battle,
  }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  executeSwapServerMock.mockReset();
  flagState.tickCapture = true;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
// Eighteen whole ticks through the real evaluator: the heavy suites' limit.
vi.setConfig({ testTimeout: 60_000 });

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(HERE, '../_utils/__fixtures__/stagnationLiveGolden.json');
const ENV = globalThis.process?.env || {};
const GENERATE = ENV.GENERATE_STAGNATION_LIVE_GOLDEN === '1';
if (GENERATE && ENV.CI) throw new Error('GENERATE_STAGNATION_LIVE_GOLDEN is a local, deliberate act — never on CI');
/** The fixture's SHA-256 as captured from the tree before B1.1 (the review C-9 pattern). */
const GOLDEN_SHA256 = '1662c95bb18720bb581f8cbed9fc34ddd8807f061c0c3f5d938dd340ccabfa93';

const PARTS = ['thrown', 'summary', 'updates', 'prompts', 'capture', 'writers', 'riskCalls', 'stagCalls', 'hurdleCalls', 'stored'];
const digest = (v) => createHash('sha256').update(JSON.stringify(v === undefined ? null : v)).digest('hex');
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isTickWrite = (w) => isObj(w) && typeof w.path === 'string' && w.path.includes('/ticks/') && isObj(w.data);

/** What a tick did, in clear: the liveness the digests cannot show. */
function livenessOf(snap) {
  const fires = snap.riskCalls.filter((c) => c.out?.action === 'SWAP_OUT' && c.out?.reason === 'stagnation').map((c) => c.args[0].symbol).sort();
  return {
    stagnationFires: fires,
    withinAgeEvaluations: snap.riskCalls.filter((c) => c.args[5]?.withinAge === true).length,
    pausedAboveZero: snap.riskCalls.filter((c) => c.args[5]?.withinAge === false && c.args[5]?.stagnationTicks > 0).length,
    swapsExecuted: (snap.writers.executeSwapServer || []).length,
    stagnationHurdleCalls: snap.hurdleCalls.filter((c) => c.arg?.reason === 'stagnation').length,
    finalStagnationTicks: snap.stored?.cronState?.stagnationTicks ?? null,
  };
}

async function runAll() {
  const out = {};
  for (const name of Object.keys(SCENARIOS)) out[name] = [await runTick(SCENARIOS[name]())];
  // eight ticks 15 minutes apart, each fed the previous tick's end state
  const prices = makePriceTable();
  let battle = makeTickBattle();
  out.multi_tick_from_empty = [];
  for (let k = 0; k < 8; k++) {
    vi.setSystemTime(new Date(NOW + k * 15 * 60000));
    const snap = await runTick({ battle, prices });
    out.multi_tick_from_empty.push(snap);
    battle = deepClone(snap.stored);
  }
  return out;
}

describe('the live stagnation path — byte-identical to the tree before B1.1, the record apart', () => {
  it('GENERATE (local only, from a tree of 1d6d5d4a) or load the frozen fixture', async () => {
    if (!GENERATE) {
      expect(existsSync(GOLDEN_PATH), 'frozen fixture missing — it is captured once, from the tree before B1.1').toBe(true);
      return;
    }
    const all = await runAll();
    const scenarios = {};
    for (const [name, ticks] of Object.entries(all)) {
      scenarios[name] = ticks.map((snap) => ({ digests: Object.fromEntries(PARTS.map((p) => [p, digest(snap[p])])), liveness: livenessOf(snap) }));
    }
    writeFileSync(GOLDEN_PATH, `${JSON.stringify({
      capturedFrom: 'a git -c core.autocrlf=false archive of origin/main @ 1d6d5d4a251f90f7f7d09e3d51653869531b4ac6 (before any Film Room B1.1 source) with this suite dropped in; harness tickStampsHarness.js + tickCaptureHarness.js; refuter rf9 (B1.1 review X1-3) scenarios',
      frozenNow: FROZEN_NOW,
      parts: PARTS,
      scenarios,
    }, null, 2)}\n`);
    throw new Error(`frozen fixture written to ${GOLDEN_PATH} — this generating run fails on purpose; pin its SHA-256 and re-run WITHOUT GENERATE_STAGNATION_LIVE_GOLDEN`);
  });

  const golden = existsSync(GOLDEN_PATH) ? JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) : null;

  it('the fixture file is exactly the one captured from the tree before B1.1 (SHA-256 pinned), LF only', () => {
    expect(createHash('sha256').update(readFileSync(GOLDEN_PATH)).digest('hex')).toBe(GOLDEN_SHA256);
    expect(readFileSync(GOLDEN_PATH).includes(0x0d)).toBe(false);
  });

  it('the fixture is not vacuous: the rule fired, rotations executed and were vetoed, counts paused, the breaker held one back', () => {
    const ticks = Object.values(golden.scenarios).flat().map((t) => t.liveness);
    expect(ticks).toHaveLength(18);
    expect(ticks.filter((l) => l.stagnationFires.length > 0).length).toBeGreaterThanOrEqual(8);
    expect(ticks.reduce((n, l) => n + l.swapsExecuted, 0)).toBeGreaterThanOrEqual(5);
    expect(ticks.some((l) => l.stagnationFires.length > 0 && l.swapsExecuted === 0)).toBe(true);
    expect(ticks.reduce((n, l) => n + l.pausedAboveZero, 0)).toBeGreaterThan(0);
    expect(golden.scenarios.multi_tick_from_empty.at(-1).liveness.stagnationFires.length).toBeGreaterThan(0);
  });

  it('every tick: every part byte-identical with `risk.stagnation` lifted; the record sits where the verdicts are and is exactly what evaluateRisk received', async () => {
    const { liftStagnationRecord, verdictSymbolsByPath } = await import('../_utils/__fixtures__/stagnationLift.js');
    const all = await runAll();
    expect(Object.keys(all).sort()).toEqual(Object.keys(golden.scenarios).sort());
    for (const [name, ticks] of Object.entries(all)) {
      expect(ticks.length, name).toBe(golden.scenarios[name].length);
      ticks.forEach((snap, i) => {
        const where = `${name}[${i}]`;
        const { rest, lifted } = liftStagnationRecord(snap.capture);
        expect(Object.fromEntries(lifted.map((l) => [l.path, Object.keys(l.stagnation).sort()])), `${where}: the record is where the verdicts are`)
          .toEqual(verdictSymbolsByPath(snap.capture));
        // RC-2 on the live path: recorded == what evaluateRisk received
        const received = {};
        for (const c of snap.riskCalls) received[c.args[0].symbol] = { ticks: c.args[5].stagnationTicks, withinAge: c.args[5].withinAge, dailyPct: c.args[0].dailyPct };
        for (const l of lifted) expect(l.stagnation, `${where}: recorded == received`).toEqual(Object.fromEntries(Object.keys(l.stagnation).map((s) => [s, received[s]])));
        const live = { ...snap, capture: rest };
        for (const p of PARTS) expect(digest(live[p]), `${where}: ${p} moved`).toBe(golden.scenarios[name][i].digests[p]);
        expect(livenessOf(snap), `${where}: liveness`).toEqual(golden.scenarios[name][i].liveness);
      });
    }
  });
});
