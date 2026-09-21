// api/cron/agent-evaluate.thresholdLint.test.js
//
// THE THRESHOLD LINT — the cron, end to end (rows B-1, B-2).
//
// The same harness as the Phase B tick-stamp suites (tickStampsHarness.js) and
// the same REAL processAgentBattle through the full-Haiku path, with
// TICK_STAMPS_ENABLED mocked TRUE (so the `candidates[]` stamp — the second
// persistence site — actually composes) and ANTICIPATION_THRESHOLD_LINT_MODE
// mocked per describe block to walk 'off' → 'shadow' → 'on'.
//
// THE BOOK is the Sep 14 book, mapped onto the harness: QCOM on the BENCH
// (carrying the full technical doc the bench block renders — RSI, the MACD
// cross, %B, RVOL, rsPercentile — plus a rankings `levels` object) and CRWD
// HELD (whose only lint-visible signal is the ATR multiple every held row
// carries). The intraday map stays EMPTY, as it was on Sep 14 and on every
// check since the June 12 freshness gate: no held name has a VWAP reading.
//
// THE FOUR FIXTURES are the four Sep 14 thresholds VERBATIM, quoted from
// docs/audits/20260915_PHASE0_SIGNAL_LANGUAGE.md §5.
//
// What this proves that the pure-module suite cannot: that the map the cron
// builds from its OWN in-flight objects gives those four sentences the same
// verdicts, that BOTH persistence sites move together, and that the flag-off
// path is byte-identical to the pre-lint cron.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW,
  makeTickBattle,
  makePriceTable,
  makeRankingsDoc,
  makeTechDocs,
  makeHoldResult,
  makeToolUseResponse,
  makeTickDb,
  deepClone,
} from '../_utils/__fixtures__/tickStampsHarness.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(),
  fetchIntradayBatch: vi.fn(),
  create: vi.fn(),
  generateAnticipation: vi.fn(async () => null),
  generateTradeNarration: vi.fn(async () => null),
  logAnticipation: vi.fn(async () => false),
  lintMode: { value: 'off' },
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
  generateAnticipation: (...args) => mocks.generateAnticipation(...args),
}));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({
  ...(await importOriginal()),
  generateTradeNarration: (...args) => mocks.generateTradeNarration(...args),
}));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({
  ...(await importOriginal()),
  logEvaluation: vi.fn(async () => false),
  logVisionTransition: vi.fn(async () => false),
  logAnticipation: (...args) => mocks.logAnticipation(...args),
}));
// THE FLAGS. TICK_STAMPS_ENABLED true so the second persistence site composes;
// the lint mode is a live getter so one module graph can walk all three states
// (the cron reads the binding at call time through the ES module live binding).
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    TICK_STAMPS_ENABLED: true,
    get ANTICIPATION_THRESHOLD_LINT_MODE() { return mocks.lintMode.value; },
  };
});

const { processAgentBattle } = await import('./agent-evaluate.js');

// ---------------------------------------------------------------------------
// The Sep 14 book on the harness: QCOM bench, CRWD held, the intraday map empty
// ---------------------------------------------------------------------------

/** The harness battle with KO → CRWD (support) and AMD → QCOM (bench). */
function sep14Battle() {
  const battle = makeTickBattle();
  battle.portfolio.support[0] = { symbol: 'CRWD', name: 'CrowdStrike', baseATR: 3.5, isCrypto: false, sector: 'Technology' };
  battle.portfolio.bench.stocks[0] = { symbol: 'QCOM', name: 'Qualcomm', baseATR: 2.8, isCrypto: false, sector: 'Technology' };
  delete battle.portfolio.startingPrices.KO;
  delete battle.portfolio.startingPrices.AMD;
  battle.portfolio.startingPrices.CRWD = 237.4;
  battle.portfolio.startingPrices.QCOM = 176.9;
  return battle;
}

function sep14Prices() {
  const prices = makePriceTable();
  prices.CRWD = { current: 233.1, previousClose: 236.0, changePercent: -1.23 };
  prices.QCOM = { current: 178.4, previousClose: 176.2, changePercent: 1.25 };
  return prices;
}

/** The rankings doc with CRWD/QCOM rows — QCOM's carries the 181.62 level. */
function sep14Rankings() {
  const doc = makeRankingsDoc();
  const row = (symbol, extra) => ({
    symbol, name: symbol, baseATR: 2.5, atrPercentile: 0.3, baggerBombFit: 50, sectorName: 'Technology', ...extra,
  });
  doc.stocks = doc.stocks.map((s) => {
    if (s.symbol === 'KO') return row('CRWD', { bBandwidthPercentile: 34, nr7Flag: false, dailyRange: 6.1 });
    if (s.symbol === 'AMD') {
      return row('QCOM', {
        bBandwidthPercentile: 41, nr7Flag: false, dailyRange: 3.3,
        levels: { nearestSupport: 171.4, distanceToSupportPct: -3.9, nearestResistance: 181.62, distanceToResistancePct: 1.8 },
      });
    }
    return s;
  });
  return doc;
}

/**
 * The technical docs. QCOM (BENCH) carries the full bench-block set including
 * the volumeProfile RVOL the bench Volume line renders; CRWD (HELD) carries a
 * doc too — deliberately, since techScoresMap is read by the BENCH block only,
 * so none of it is a signal a held-name threshold may cite.
 */
function sep14TechDocs() {
  const docs = makeTechDocs();
  const updatedAt = docs.NVDA.updatedAt;
  delete docs.KO;
  delete docs.AMD;
  docs.CRWD = {
    symbol: 'CRWD', atrPercent: 3.6, updatedAt,
    factors: { aboveSMA20: false, aboveSMA50: true, aboveSMA200: true, rsi: 47, macdHistogram: -0.2, macdAboveSignal: false, upDayVolRatio: 0.9, rsPercentile: 55 },
  };
  docs.QCOM = {
    symbol: 'QCOM', atrPercent: 2.7, updatedAt,
    bbPercentB: 0.62,
    volumeProfile: { tier: 'high', ratio: 1.34 },
    factors: { aboveSMA20: true, aboveSMA50: true, aboveSMA200: true, rsi: 71, macdHistogram: 0.3, macdAboveSignal: true, upDayVolRatio: 1.3, rsPercentile: 78 },
  };
  return docs;
}

// The four sentences, verbatim from Phase 0 §5.
const SEP14_CANDIDATES = Object.freeze([
  {
    symbol: 'QCOM', direction: 'potential_entry',
    signalSummary: 'Relative strength is building and volume is confirming.',
    threshold: "holds above the daily VWAP and the RSI pulls back below 75, I'd consider rotating it into Core",
  },
  {
    symbol: 'QCOM', direction: 'potential_entry',
    signalSummary: 'The squeeze is resolving upward.',
    threshold: 'QCOM holds above the daily VWAP and the 5-minute MACD shows a positive histogram signal (S12), and RSI pulls back below 75 (S10)',
  },
  {
    symbol: 'QCOM', direction: 'potential_entry',
    signalSummary: 'Pressing the resistance shelf with volume behind it.',
    threshold: 'QCOM breaks above 181.62 resistance and RVOL sustains above 1.2x',
  },
  {
    symbol: 'CRWD', direction: 'potential_exit',
    signalSummary: 'Drifting away from its entry with the sector soft.',
    threshold: 'CRWD falls below -0.5x ATR (approximately -$118.72)',
  },
]);

// The two that name a signal the tick did not hold, and why.
const EXPECTED_ABSENT = Object.freeze([
  { threshold: SEP14_CANDIDATES[0].threshold, absent: ['VWAP'] },
  // three names, not the brief's two: the review split MACD_HISTOGRAM out of
  // MACD_5M so the shadow evidence says which signal was actually named (L1-F4).
  { threshold: SEP14_CANDIDATES[1].threshold, absent: ['VWAP', 'MACD_5M', 'MACD_HISTOGRAM'] },
]);
const KEPT_THRESHOLDS = Object.freeze([SEP14_CANDIDATES[2].threshold, SEP14_CANDIDATES[3].threshold]);

/** One real tick on the Sep 14 book with the four candidates. */
async function runTick({ candidates = deepClone(SEP14_CANDIDATES), battle = sep14Battle() } = {}) {
  const prices = sep14Prices();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  // THE SEP 14 STATE: the intraday batch returns nothing, so the VWAP map is
  // empty on every held name — `evidence[sym].vwapDev === null`, as recorded.
  mocks.fetchIntradayBatch.mockImplementation(async () => ({}));
  const db = makeTickDb({ battle, rankingsDoc: sep14Rankings(), techDocs: sep14TechDocs() });
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult({ anticipationCandidates: candidates })));
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  const entry = finalUpdate ? finalUpdate.evaluations[finalUpdate.evaluations.length - 1] : null;
  return {
    db,
    entry,
    // SITE 1 — the anticipation queue (Gemma's input)
    dispatched: mocks.generateAnticipation.mock.calls.map(([args]) => args.anticipationCandidate),
    // SITE 2 — the evaluations[].candidates[] stamp
    stamped: entry?.candidates ?? null,
    lintLogs: mocks.logAnticipation.mock.calls
      .map(([r]) => r)
      .filter((r) => r.errorStep === 'threshold_absent_signal'),
  };
}

let consoleLog;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.lintMode.value = 'off';
  for (const m of ['getStockAnalysisData', 'fetchIntradayBatch', 'create', 'generateAnticipation', 'generateTradeNarration', 'logAnticipation']) mocks[m].mockReset();
  mocks.generateAnticipation.mockImplementation(async () => null);
  mocks.generateTradeNarration.mockImplementation(async () => null);
  mocks.logAnticipation.mockImplementation(async () => false);
  consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// ---------------------------------------------------------------------------
// B-1 — the walk
// ---------------------------------------------------------------------------

describe("B-1 'off' (SHIPPED) — the lint is not called and today's path is byte-identical", () => {
  it('all four reach BOTH persistence sites, and no lint record is written', async () => {
    const { dispatched, stamped, lintLogs } = await runTick();
    expect(dispatched.map((c) => c.threshold)).toEqual(SEP14_CANDIDATES.map((c) => c.threshold));
    expect(stamped.map((c) => c.threshold)).toEqual(SEP14_CANDIDATES.map((c) => c.threshold));
    expect(lintLogs).toEqual([]);
  });

  it('the tick really is the Sep 14 tick — every held name stamps vwapDev null (the gate published nothing)', async () => {
    const { entry } = await runTick();
    expect(Object.keys(entry.evidence)).toContain('CRWD');
    for (const [sym, ev] of Object.entries(entry.evidence)) {
      expect(ev.vwapDev, `${sym} should have no VWAP reading on this tick`).toBeNull();
    }
  });
});

describe("B-1 'shadow' — everything persists, the failures are measured", () => {
  beforeEach(() => { mocks.lintMode.value = 'shadow'; });

  it('all four still reach BOTH sites — shadow NEVER drops', async () => {
    const { dispatched, stamped } = await runTick();
    expect(dispatched.map((c) => c.threshold)).toEqual(SEP14_CANDIDATES.map((c) => c.threshold));
    expect(stamped.map((c) => c.threshold)).toEqual(SEP14_CANDIDATES.map((c) => c.threshold));
  });

  it('exactly two records, with the right `absent` lists, and `dropped: false`', async () => {
    const { lintLogs } = await runTick();
    expect(lintLogs).toHaveLength(2);
    expect(lintLogs.map((r) => ({ threshold: r.candidate.threshold, absent: r.absent }))).toEqual(EXPECTED_ABSENT.map((e) => ({ threshold: e.threshold, absent: e.absent })));
    for (const r of lintLogs) {
      expect(r.errorStep).toBe('threshold_absent_signal');
      expect(r.lintMode).toBe('shadow');
      expect(r.dropped).toBe(false);
      expect(r.success).toBe(false);
      expect(r.anticipationSource).toBe('haiku');
      expect(r.battleId).toBe('battle-tick-1');
      expect(r.evalId).toBe('eval_001');
      expect(Object.keys(r.candidate)).toEqual(['symbol', 'direction', 'signalSummary', 'threshold']);
    }
    expect(lintLogs.map((r) => r.errorReason)).toEqual(['absent_VWAP', 'absent_VWAP+MACD_5M+MACD_HISTOGRAM']);
    // THE JOIN KEY (L2-F3): the record carries the instant of the check it
    // describes. evalId is monotonic since the A-13 fix (cronState.evalSeq) but
    // is still only battle-scoped, and pre-fix battles can hold repeated ids —
    // the timestamp is what the join keys on.
    for (const r of lintLogs) expect(r.timestamp).toBe(FROZEN_NOW);
  });

  it('THE SECOND RECEIPT (L4 H-3): each drop is also on the Vercel function log', async () => {
    // At 'on' a drop is a deletion from a durable record and the GCS write is
    // fire-and-forget, so the console line is the receipt that survives a
    // swallowed write. The nearer precedent this copies (cron_budget_skip)
    // already had one; deleting it used to red nothing.
    await runTick();
    const lines = consoleLog.mock.calls.map(([m]) => String(m)).filter((m) => m.includes('threshold lint'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('[shadow]');
    expect(lines[0]).toContain('flagged');
    expect(lines[0]).toContain('QCOM');
    expect(lines[0]).toContain('VWAP');
  });

  it('the two that pass are never logged — an accepted promise leaves no complaint', async () => {
    const { lintLogs } = await runTick();
    expect(lintLogs.map((r) => r.candidate.threshold)).not.toContain(KEPT_THRESHOLDS[0]);
    expect(lintLogs.map((r) => r.candidate.threshold)).not.toContain(KEPT_THRESHOLDS[1]);
  });
});

describe("B-1 'on' — the failing promise reaches neither Gemma nor the record", () => {
  beforeEach(() => { mocks.lintMode.value = 'on'; });

  it('two persist at BOTH sites — the ATR one and the levels/RVOL one; two are gone from both', async () => {
    const { dispatched, stamped, lintLogs } = await runTick();
    expect(dispatched.map((c) => c.threshold)).toEqual([...KEPT_THRESHOLDS]);
    expect(stamped.map((c) => c.threshold)).toEqual([...KEPT_THRESHOLDS]);
    expect(stamped).toHaveLength(2);
    expect(lintLogs).toHaveLength(2);
    for (const r of lintLogs) expect(r.dropped).toBe(true);
    // the dropped sentences appear NOWHERE on the persisted battle document
    const persisted = JSON.stringify(mocks.generateAnticipation.mock.calls) + JSON.stringify(stamped);
    for (const e of EXPECTED_ABSENT) expect(persisted).not.toContain(e.threshold);
  });

  it('THE SECOND RECEIPT at \'on\' says DROPPED, not flagged', async () => {
    await runTick();
    const lines = consoleLog.mock.calls.map(([m]) => String(m)).filter((m) => m.includes('threshold lint'));
    expect(lines).toHaveLength(2);
    for (const l of lines) { expect(l).toContain('[on]'); expect(l).toContain('DROPPED'); }
  });

  it('the class asymmetry is the cron\'s too: the same RSI sentence on the HELD name is dropped, on the BENCH name it is not', async () => {
    const rsi = 'the RSI pulls back below 75';
    const { dispatched, lintLogs } = await runTick({
      candidates: [
        { symbol: 'QCOM', direction: 'potential_entry', signalSummary: 's', threshold: rsi },
        { symbol: 'CRWD', direction: 'potential_exit', signalSummary: 's', threshold: rsi },
      ],
    });
    expect(dispatched.map((c) => c.symbol)).toEqual(['QCOM']);
    expect(lintLogs.map((r) => [r.candidate.symbol, r.absent])).toEqual([['CRWD', ['RSI']]]);
  });

  it('every candidate failing → no `candidates` key at all and no dispatch', async () => {
    const { stamped, entry, dispatched, lintLogs } = await runTick({
      candidates: [{ symbol: 'CRWD', direction: 'potential_exit', signalSummary: 's', threshold: 'If the 5-minute MACD rolls over' }],
    });
    expect(stamped).toBeNull();
    expect(entry).not.toHaveProperty('candidates');
    expect(dispatched).toEqual([]);
    expect(lintLogs).toHaveLength(1);
  });

  it('an item both sites already drop (no symbol) is not the lint\'s business — it passes through untouched', async () => {
    const { dispatched, stamped, lintLogs } = await runTick({
      candidates: [
        { direction: 'potential_entry', signalSummary: 'no symbol', threshold: 'holds above the daily VWAP' },
        deepClone(SEP14_CANDIDATES[3]),
      ],
    });
    expect(dispatched.map((c) => c.symbol)).toEqual(['CRWD']);
    expect(stamped.map((c) => c.symbol)).toEqual(['CRWD']);
    expect(lintLogs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// B-2 — the pin: an accepted threshold is byte-identical to the decider's output
// ---------------------------------------------------------------------------

describe('B-2 THE PIN — an accepted threshold is byte-identical to what the decider wrote', () => {
  for (const mode of ['off', 'shadow', 'on']) {
    it(`'${mode}': every persisted threshold is byte-identical at both sites, and no accepted clause was edited away`, async () => {
      mocks.lintMode.value = mode;
      const { dispatched, stamped } = await runTick();
      const byThreshold = new Map(SEP14_CANDIDATES.map((c) => [c.threshold, c]));
      for (const site of [dispatched, stamped]) {
        for (const c of site) {
          const original = byThreshold.get(c.threshold);
          // The lookup itself is the byte-identity assertion: a rewritten
          // sentence would not be a key of the decider's own output. The
          // mutant this kills is "strip the absent clause and keep the
          // candidate", which would land a sentence nobody wrote.
          expect(original, `persisted threshold is not one the decider wrote: ${JSON.stringify(c.threshold)}`).toBeTruthy();
          expect(c.threshold).toBe(original.threshold);
          expect(c.signalSummary).toBe(original.signalSummary);
          expect(c.direction).toBe(original.direction);
          expect(c.symbol).toBe(original.symbol);
        }
      }
    });
  }

  it("under 'on' the survivors are the decider's own objects, untouched — not copies with fields normalized", async () => {
    mocks.lintMode.value = 'on';
    const candidates = deepClone(SEP14_CANDIDATES);
    const before = JSON.stringify(candidates);
    const { dispatched } = await runTick({ candidates });
    // the lint mutated NONE of the items it was handed, kept or dropped
    expect(JSON.stringify(candidates)).toBe(before);
    expect(dispatched[0]).toBe(candidates[2]);
    expect(dispatched[1]).toBe(candidates[3]);
  });
});
