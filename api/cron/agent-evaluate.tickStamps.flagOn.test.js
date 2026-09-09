// api/cron/agent-evaluate.tickStamps.flagOn.test.js
//
// Phase B — the tick stamps: FLAG ON, end to end (spec §1.2–1.4, §3; D-110 →
// D-113; review rounds A/B/C/D folded in). The same harness as the flag-off
// golden (tickStampsHarness.js), the same REAL processAgentBattle through the
// full-Haiku path, with TICK_STAMPS_ENABLED mocked TRUE (the hermetic per-file
// value; the live value is pinned once in src/config/tickStampsFlags.test.js).
//
// What this suite proves on the REAL composed entry, not on the pure module:
//   • Heard names the thread the prompt was rendered from — the in-memory
//     battle's directive — and never the model's echo; it is absent without a
//     directive, absent on a budget_skipped tick (nothing else is stamped
//     there either: the prompt was never built), present on a timed-out tick
//     (the prompt WAS built), `suppressed` when the epoch log killed the thread
//     and when the directive is type-corrupt.
//   • THE MID-TICK FILING FIXTURE: a directive that lands on the DOC while the
//     model is deciding is not the one stamped. The fixture mutates the doc,
//     not the object; the cron reads the doc zero times after the prompt.
//   • The evidence's eight fields are the values the prompt RENDERED for each
//     held name — the fenced scorer's Gain% and ATR multiple, the real VWAP
//     table the cron persists this same tick, the rankings doc, the real risk
//     manager's LOCK — for every held position and no bench name; the
//     vintages carry instants and a date, never a cadence word.
//   • On a Haiku SWAP tick the evidence is the PRE-swap book (what the decider
//     saw), the doc carries the swap, and Heard is unchanged.
//   • The candidates are the model's raw items, four fields plus tag,
//     `rationale` cut, and the dispatch queue admits the same items.
//   • The finalUpdate carries no new top-level key; the 25 pre-Phase-B values
//     are byte-identical to the flag-off golden; the mock write rejects any
//     `undefined` (as the SDK does) so every row guards that.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW,
  HELD,
  BENCH,
  OLD_THREAD,
  NEWER_THREAD,
  PRE_PHASE_B_ENTRY_KEYS,
  makeTickBattle,
  makeDirective,
  makePriceTable,
  makeRankingsDoc,
  makeTechDocs,
  makeIntradayCandles,
  makeHoldResult,
  makeSwapResult,
  makeAnticipationCandidates,
  makeToolUseResponse,
  makeTickDb,
  undefinedPaths,
  firestoreBytes,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { EVIDENCE_FIELDS, VINTAGE_FIELDS } from '../_utils/tickStamps.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(),
  fetchIntradayBatch: vi.fn(),
  create: vi.fn(),
  generateAnticipation: vi.fn(async () => null),
  generateTradeNarration: vi.fn(async () => null),
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
  logAnticipation: vi.fn(async () => false),
}));
// THE FLAG — explicit true (hermetic). Everything else in featureFlags.js is live.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  TICK_STAMPS_ENABLED: true,
}));

const { processAgentBattle } = await import('./agent-evaluate.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(resolve(HERE, '../_utils/__fixtures__/tickStampsEntryGolden.flagOff.json'), 'utf8'));
const TIME_BUDGET_MS = 290_000; // agent-evaluate.js TIME_BUDGET_MS — elapsed ≥ this skips the Haiku call (budget_skipped)

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

/**
 * One real tick. `onModelCall(db, request)` runs INSIDE the mocked model call —
 * after the prompt was built from the in-memory battle, before the decision
 * returns — which is where a mid-tick filing lands. `modelError` makes the call
 * reject.
 */
async function runTick({
  battle = makeTickBattle(),
  result = makeHoldResult(),
  cronStartTime = Date.now(),
  priceOverrides = {},
  onModelCall = null,
  modelError = null,
} = {}) {
  const prices = { ...makePriceTable(), ...priceOverrides };
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  mocks.create.mockImplementation(async (request) => {
    if (onModelCall) onModelCall(db, request);
    if (modelError) throw modelError;
    return makeToolUseResponse(result);
  });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, cronStartTime, new Map(), { everEnabled: false });
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  return { db, battle, summary, finalUpdate, entry: finalUpdate ? finalUpdate.evaluations[finalUpdate.evaluations.length - 1] : null };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  mocks.generateAnticipation.mockReset();
  mocks.generateAnticipation.mockImplementation(async () => null);
  mocks.generateTradeNarration.mockReset();
  mocks.generateTradeNarration.mockImplementation(async () => null);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('flag ON — Heard (D-110): the thread that was in the decider\'s prompt at this check', () => {
  it('names the in-memory directive thread; the model\'s own echo on the entry is a different field and never the source', async () => {
    // The model echoes a BOGUS thread id (the few-shot's d1 style) and claims to
    // have ignored another — self-report, persisted as before, ignored by Heard.
    const { entry } = await runTick({ result: makeHoldResult({ directiveThreadId: 'd1', ignoredDirectiveIds: ['d9'] }) });
    expect(entry.heard).toEqual({ directiveThreadId: OLD_THREAD, suppressed: null });
    expect(entry.directiveThreadId).toBe('d1');
    expect(entry.ignoredDirectiveIds).toEqual(['d9']);
    expect(entry.heard.directiveThreadId).not.toBe(entry.directiveThreadId);
  });

  it('is absent when no directive is active — the evidence and vintages still ride', async () => {
    const { entry } = await runTick({ battle: makeTickBattle({ directive: null }) });
    expect(entry).not.toHaveProperty('heard');
    expect(Object.keys(entry)).toEqual([...PRE_PHASE_B_ENTRY_KEYS, 'evidence', 'vintages']);
    expect(Object.keys(entry.evidence)).toEqual([...HELD]);
  });

  it('is absent on a budget_skipped tick — and so is every other stamp: the prompt was never built', async () => {
    const { entry, summary } = await runTick({ cronStartTime: Date.now() - TIME_BUDGET_MS });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(summary.triggered).toBe(1);
    expect(entry.haikuError?.failureClass).toBe('budget_skipped');
    expect(entry.decision).toBe('HOLD');
    expect(Object.keys(entry)).toEqual([...PRE_PHASE_B_ENTRY_KEYS]);
    for (const key of ['heard', 'evidence', 'vintages', 'candidates']) expect(entry).not.toHaveProperty(key);
  });

  it('IS present on a timed-out tick with no decision — the prompt was built and sent (hazard 2: Heard never implies decided)', async () => {
    const { entry } = await runTick({ modelError: Object.assign(new Error('Request timed out.'), { name: 'APIConnectionTimeoutError' }) });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(entry.haikuError?.failureClass).toBe('timeout');
    expect(entry.decision).toBe('HOLD');
    expect(entry.rationale).toBe('Haiku call failed — defaulting to HOLD');
    expect(entry.heard).toEqual({ directiveThreadId: OLD_THREAD, suppressed: null });
    expect(Object.keys(entry.evidence)).toEqual([...HELD]);
    expect(entry).not.toHaveProperty('candidates');
  });

  it("carries suppressed: 'epoch_killed' when the battle's controlEpochLog killed the thread — a directive that existed but was withheld is NOT Heard", async () => {
    const battle = makeTickBattle({
      controlEpochLog: [{
        epochKey: 'integrity=observe|leans=on|dial=on',
        modes: { archetypeIntegrityMode: 'observe', standingLeansEnabled: true, tempoDialEnabled: true },
        suppressedDirectiveIds: [OLD_THREAD],
        suppressedLeanIds: [],
        at: '2026-09-09T14:45:00.000Z',
      }],
    });
    const { entry } = await runTick({ battle });
    expect(entry.heard).toEqual({ directiveThreadId: OLD_THREAD, suppressed: 'epoch_killed' });
  });

  it("carries suppressed: 'malformed' for a type-corrupt directive (a non-string text) — the one malformed shape the cron's pre-gate lets through (review A-10 / D-5)", async () => {
    let promptSeen = null;
    const { entry } = await runTick({
      battle: makeTickBattle({ directive: makeDirective({ text: 42 }) }),
      onModelCall: (_db, request) => { promptSeen = request.messages[2].content; },
    });
    expect(entry.heard).toEqual({ directiveThreadId: OLD_THREAD, suppressed: 'malformed' });
    // …and the assembler withheld it: no directive block reached the decider.
    expect(promptSeen).not.toContain('Require stronger confirmation');
  });
});

describe('flag ON — the mid-tick filing fixture (discovery A2 / hazard 3): the stamp names the RENDERED thread', () => {
  it('a directive filed on the DOC while the model is deciding is not the one stamped; the cron reads the doc ZERO times after the prompt is built', async () => {
    const newer = makeDirective({ directiveThreadId: NEWER_THREAD, text: 'Take profits faster on the star slot', createdAt: '2026-09-09T15:00:05.000Z' });
    let promptSeen = null;
    let readsAtModelCall = null;
    const { entry, battle, db } = await runTick({
      onModelCall: (dbInFlight, request) => {
        // The filing lands on the persisted DOC — the chat route's write — not
        // on the object the cron is holding.
        dbInFlight.__store.battle.directive = newer;
        promptSeen = request.messages[2].content;
        readsAtModelCall = dbInFlight.__counts.battleDocGets;
      },
    });

    // The fixture mutated the doc, not the object.
    expect(db.__store.battle.directive.directiveThreadId).toBe(NEWER_THREAD);
    expect(battle.directive.directiveThreadId).toBe(OLD_THREAD);
    // The prompt the model received carried the OLD directive — the newer text never reached it.
    expect(promptSeen).toContain('Require stronger confirmation before entering');
    expect(promptSeen).not.toContain('Take profits faster');
    // The stamp names the rendered thread — the truth — never the doc's newer one.
    expect(entry.heard).toEqual({ directiveThreadId: OLD_THREAD, suppressed: null });
    expect(entry.heard.directiveThreadId).not.toBe(NEWER_THREAD);
    // Zero doc reads after the prompt was built (review D-8: the property, not
    // a fixture-specific count): every read this tick happened before the model call.
    expect(readsAtModelCall).toBeGreaterThanOrEqual(1);
    expect(db.__counts.battleDocGets).toBe(readsAtModelCall);
    // And the finalUpdate did not clobber the newer filing on the doc (the cron never writes `directive`).
    expect(db.__updates.some((u) => 'directive' in u)).toBe(false);
  });
});

describe('flag ON — the evidence (D-111): eight fields per held position, each the value a rendered line carried', () => {
  // NVDA quoted at 123.6 → +2.57 % from entry = +0.83x ATR: inside the risk
  // manager's LOCK band (0.8–1.0x), so one held position carries a non-HOLD
  // verdict with its reason; every other position is a HOLD.
  const LOCK_QUOTE = { NVDA: { current: 123.6, previousClose: 121.0, changePercent: 2.15 } };

  it('stamps every held position — the ACTIVE POSITIONS rows — and no bench name, each with exactly the eight fields', async () => {
    const { entry } = await runTick({ priceOverrides: LOCK_QUOTE });
    expect(Object.keys(entry.evidence)).toEqual([...HELD]);
    for (const sym of BENCH) expect(entry.evidence).not.toHaveProperty(sym);
    for (const sym of HELD) expect(Object.keys(entry.evidence[sym])).toEqual([...EVIDENCE_FIELDS]);
    expect(JSON.stringify(entry.evidence)).not.toMatch(/rsPct|rsPercentile/);
  });

  it('the fields are the rendered values at the rendered precision — the scorer\'s Gain% and ATR multiple, the persisted VWAP table, the rankings row, the regime word, the real risk verdict', async () => {
    const { entry, finalUpdate } = await runTick({ priceOverrides: LOCK_QUOTE });
    const { NVDA, TSLA, BTC, AMZN } = entry.evidence;
    // the CSV row: $Current, Gain% from ENTRY (123.6 − 120.5) / 120.5, ATR Mult on the activation day (from the starting price) / 3.1
    expect(NVDA.px).toBe(123.6);
    expect(NVDA.chg).toBe(2.57);
    expect(NVDA.chg).not.toBe(2.15); // the quote's session change is NOT stamped (rendered for bench names only — review A-1)
    expect(NVDA.atrX).toBe(0.83);
    // the VWAP deviation is the SAME number the cron persists this tick in cronState.intradayMomentum (one source)
    const persistedVwap = finalUpdate['cronState.intradayMomentum'].NVDA;
    expect(persistedVwap.vwapDeviation).toBeGreaterThan(0);
    expect(NVDA.vwapDev).toBe(Number(persistedVwap.vwapDeviation.toFixed(2)));
    // the INTRADAY MOMENTUM line's rankings fields and the STOCK REGIMES word
    expect(NVDA.bbPct).toBe(15);
    expect(NVDA.nr7).toBe(true);
    expect(NVDA.regime).toBe('directional_expansion');
    // the real risk manager's verdict, reason only because it is non-HOLD
    expect(NVDA.risk).toEqual({ action: 'LOCK', reason: 'threshold_proximity' });
    // a HOLD carries no reason key
    expect(TSLA.risk).toEqual({ action: 'HOLD' });
    expect(TSLA.chg).toBe(-2.08);
    expect(TSLA.regime).toBe('distressed');
    expect(TSLA.nr7).toBe(false);
    expect(TSLA.bbPct).toBe(88);
    expect(TSLA.vwapDev).toBeNull(); // no intraday session for TSLA this tick
    expect(AMZN.chg).toBe(0.65);
    // null honesty: BTC has no ranking row, no technical doc, no VWAP
    expect(BTC).toEqual({ px: 67450, chg: 0.67, atrX: BTC.atrX, vwapDev: null, bbPct: null, nr7: null, regime: null, risk: { action: 'HOLD' } });
    expect(typeof BTC.atrX).toBe('number');
    // never the verdict's prose, never a story id
    expect(JSON.stringify(entry.evidence)).not.toMatch(/detail|stories|storyId/);
  });

  it('the vintages: ONE block per entry — quote / vwap this tick, techAt and rankingsAt as instants from the docs the tick read, fundAsOf the FUNDAMENTALS header date (held + bench); never "weekly" or "daily"', async () => {
    const { entry } = await runTick();
    expect(Object.keys(entry.vintages)).toEqual([...VINTAGE_FIELDS]);
    expect(entry.vintages).toEqual({
      quote: 'tick',
      vwap: 'tick',
      techAt: '2026-09-09T14:29:55.000Z',   // the held technical docs' updatedAt (the same intraday run)
      fundAsOf: '2026-09-08',              // bench AMD's fundamentals are the newest the block rendered
      rankingsAt: '2026-09-09T14:30:00.000Z',
    });
    expect(JSON.stringify(entry.vintages)).not.toMatch(/weekly|daily/i);
    expect(JSON.stringify(entry)).not.toMatch(/weekly/i);
    // one block on the entry, none inside any position record
    for (const sym of HELD) expect(entry.evidence[sym]).not.toHaveProperty('vintages');
  });

  it('on a Haiku SWAP tick the evidence is the PRE-swap book — what the decider saw — while the doc carries the swap; Heard is unchanged (review B-4 / D-4)', async () => {
    const { entry, battle, db } = await runTick({ result: makeSwapResult() });
    expect(entry.decision).toBe('SWAP');
    expect(entry.symbolOut).toBe('KO');
    expect(entry.symbolIn).toBe('AMD');
    expect(Object.keys(entry.evidence)).toEqual([...HELD]);         // KO stamped as held, AMD absent — the rendered rows
    expect(entry.evidence.KO.px).toBe(62);
    expect(entry.evidence).not.toHaveProperty('AMD');
    expect(entry.heard).toEqual({ directiveThreadId: OLD_THREAD, suppressed: null });
    // the doc holds the swapped book; the in-memory object the prompt was rendered from still holds the pre-swap book
    const docSupport = (db.__store.battle.portfolio.support || []).filter(Boolean).map((a) => a.symbol);
    expect(docSupport).toContain('AMD');
    expect(docSupport).not.toContain('KO');
    expect(battle.portfolio.support.filter(Boolean).map((a) => a.symbol)).toContain('KO');
    expect(undefinedPaths(entry)).toEqual([]);
  });
});

describe('flag ON — the candidates (D-112): the decider\'s own output, persisted beside `hypothesis`', () => {
  it('four fields plus the tag from the model\'s raw items, `rationale` cut, the symbol-less item dropped — and the dispatch queue admits the same two', async () => {
    const { entry } = await runTick({ result: makeHoldResult({ anticipationCandidates: makeAnticipationCandidates() }) });
    expect(entry.candidates).toHaveLength(2);
    expect(entry.candidates[0]).toEqual({
      symbol: 'AMD',
      direction: 'potential_entry',
      signalSummary: 'Relative strength building against the sector and volume is confirming.',
      threshold: 'If it holds above the 20-day on the next test, I would rotate it into Core.',
      signalSource: 'relative_strength',
    });
    expect(Object.keys(entry.candidates[1])).toEqual(['symbol', 'direction', 'signalSummary', 'threshold']);
    expect(JSON.stringify(entry.candidates)).not.toMatch(/rationale|Fuller context/);
    // the same admission rule feeds the anticipation dispatch (two items, never the symbol-less third)
    expect(mocks.generateAnticipation).toHaveBeenCalledTimes(2);
    const dispatched = mocks.generateAnticipation.mock.calls.map(([args]) => args.anticipationCandidate.symbol);
    expect(dispatched).toEqual(['AMD', 'TSLA']);
    // stamped beside the decider's other output
    const keys = Object.keys(entry);
    expect(keys.indexOf('candidates')).toBeGreaterThan(keys.indexOf('hypothesis'));
  });

  it('no usable candidate → no key', async () => {
    const { entry } = await runTick({ result: makeHoldResult({ anticipationCandidates: [{ direction: 'potential_entry', signalSummary: 'x', threshold: 'y' }] }) });
    expect(entry).not.toHaveProperty('candidates');
    expect(mocks.generateAnticipation).not.toHaveBeenCalled();
  });
});

describe('flag ON — the write: additive keys on the entry, nothing else moves', () => {
  it('the entry is the 25 pre-Phase-B keys — byte-identical to the flag-off golden — followed by the stamps, in order; the persisted DOC carries the same stamped entry', async () => {
    const { entry, db } = await runTick({ result: makeHoldResult({ anticipationCandidates: makeAnticipationCandidates() }) });
    expect(Object.keys(entry)).toEqual([...PRE_PHASE_B_ENTRY_KEYS, 'heard', 'evidence', 'vintages', 'candidates']);
    expect(JSON.stringify(pick(entry, PRE_PHASE_B_ENTRY_KEYS))).toBe(JSON.stringify(GOLDEN.entry));
    // the store — what Firestore holds after the write — carries the stamped entry too (review D-1)
    const persisted = db.__store.battle.evaluations[db.__store.battle.evaluations.length - 1];
    expect(JSON.stringify(persisted)).toBe(JSON.stringify(entry));
    expect(persisted.heard).toEqual({ directiveThreadId: OLD_THREAD, suppressed: null });
  });

  it('no new top-level battle key rides the finalUpdate (V2 hazard 9), and nothing anywhere in it is undefined (the mock write rejects it, as Firestore would)', async () => {
    const { finalUpdate } = await runTick({ result: makeHoldResult({ anticipationCandidates: makeAnticipationCandidates() }) });
    expect(Object.keys(finalUpdate)).toEqual(GOLDEN.finalUpdateKeys);
    expect(undefinedPaths(finalUpdate)).toEqual([]);
    expect(finalUpdate).not.toHaveProperty('heard');
    expect(finalUpdate).not.toHaveProperty('evidence');
    expect(finalUpdate).not.toHaveProperty('candidates');
  });

  it('the size row on the REAL entry: heard + evidence + vintages for the seven-position book stay ≤ 1,100 Firestore-rule bytes', async () => {
    const { entry } = await runTick();
    const bytes = firestoreBytes(pick(entry, ['heard', 'evidence', 'vintages']));
    expect(bytes).toBeLessThanOrEqual(1100);
    expect(bytes).toBeGreaterThan(500); // anti-vacuous: a real seven-position stamp, not an empty one
  });
});
