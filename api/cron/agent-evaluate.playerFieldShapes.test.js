// api/cron/agent-evaluate.playerFieldShapes.test.js
//
// Integrity follow-up 2 (8 Oct 2026), Part B — no owner-writable value can
// make the evaluation check throw. Report: docs/audits/20261008_BUILD_INTEGRITY_FOLLOWUP_2.md.
//
// THE DEFECT (the integrity build's review I1-1, its §13): a `suggestedSwaps`
// of `[null]` or a map, a `gameplanMeetingHistory` that is not a list, or a
// `strategyPreset` of 'constructor' made every check throw before it saved the
// score — and the battle's completion then decided from the frozen score.
//
// THE ROWS (acceptance 2): every owner-writable field the check reads, in
// every shape an owner can store — null, a number, a string, a map, a huge
// value, inherited names — and the check completes and saves its score. The
// executor is real (wrapped, never replaced).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeToolUseResponse, serverMeetingOverrides,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCallsDb } from '../_utils/__fixtures__/callRecordsStore.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const flags = vi.hoisted(() => ({ swapIdentity: 'off' }));

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
  resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn((l) => l), excludeHeldSymbols: vi.fn((l) => l),
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
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get SWAP_IDENTITY_MODE() { return flags.swapIdentity; },
}));

const { processAgentBattle } = await import('./agent-evaluate.js');

async function runTick(battle) {
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
  const db = makeCallsDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  let thrown = null;
  try {
    await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  } catch (err) { thrown = err; }
  return { db, thrown, summary, stored: db.__store.battle };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  flags.swapIdentity = 'off';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const HUGE_TEXT = 'x'.repeat(300_000);
const hugeList = (make) => Array.from({ length: 20_000 }, (_, i) => make(i));
const hugeMap = () => Object.fromEntries(Array.from({ length: 20_000 }, (_, i) => [`k${i}`, i]));

/** The shapes, per field: what an owner can store there. */
const COMMON = {
  null: null, number: 7, string: 'x', map: { a: { b: 1 } },
  'array-like map': { length: 2, 0: { symbolOut: 'KO', symbolIn: 'AMD' }, 1: null },
  'inherited names (map)': { constructor: 'KO', toString: 'AMD', hasOwnProperty: 1, valueOf: null },
  // An object no template, String() or Date can convert: its toString / valueOf are not functions.
  'unconvertible object': { toString: 1, valueOf: 2, status: { toString: 1 }, expiresAt: { toString: 1 }, timestamp: { toString: 1 } },
};
const SHAPES = {
  suggestedSwaps: { ...COMMON, list: [null], 'list of junk': [null, 7, 'KO', ['KO', 'AMD'], true], huge: hugeList((i) => ({ symbolOut: i % 2 ? 'KO' : 'AMD', symbolIn: i % 2 ? 'AMD' : 'KO' })), 'huge text': HUGE_TEXT, 'inherited names (string)': 'constructor' },
  gameplanMeeting: { ...COMMON, list: [{ status: 'approved' }], huge: hugeMap(), 'huge text': HUGE_TEXT, 'inherited names (string)': '__proto__', 'status inherited': { status: 'constructor', expiresAt: { toString: 1 } } },
  gameplanMeetingHistory: { ...COMMON, list: [null, 7], huge: hugeList((i) => ({ id: `m${i}` })), 'huge text': HUGE_TEXT, 'inherited names (string)': 'toString' },
  strategyPreset: { ...COMMON, list: ['aggressive'], huge: hugeMap(), 'huge text': HUGE_TEXT, constructor: 'constructor', toString: 'toString', __proto__: '__proto__', hasOwnProperty: 'hasOwnProperty', valueOf: 'valueOf' },
  executionMode: { ...COMMON, list: ['copilot'], huge: hugeMap(), 'huge text': HUGE_TEXT, 'inherited names (string)': 'constructor' },
  pendingProposal: { ...COMMON, list: [{ symbolOut: 'KO' }], huge: hugeMap(), 'huge text': HUGE_TEXT, 'inherited names (string)': 'toString' },
  battleLedger: { ...COMMON, list: [null, { type: 'debate', timestamp: 7 }], huge: hugeList((i) => ({ type: 'debate', i })), 'huge text': HUGE_TEXT, 'inherited names (string)': 'constructor' },
  dailyGrades: { ...COMMON, list: [null], huge: hugeMap(), 'huge text': HUGE_TEXT, 'inherited names (string)': 'constructor' },
};

const APPROVED = (suggestedSwaps) => ({ status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps });
/** Each field planted where the check reads it. */
const BATTLE_FOR = {
  // An approved meeting the server created (its copy holds KO → AMD), the legs then rewritten.
  suggestedSwaps: (v) => makeTickBattle(serverMeetingOverrides(APPROVED(v), { legs: [{ symbolOut: 'KO', symbolIn: 'AMD', swappedInAt: null }] })),
  gameplanMeeting: (v) => makeTickBattle({ gameplanMeeting: v }),
  // The history is appended to when a meeting resolves: an approved server meeting resolves this tick.
  gameplanMeetingHistory: (v) => makeTickBattle({ ...serverMeetingOverrides(APPROVED([{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'r' }])), gameplanMeetingHistory: v }),
  strategyPreset: (v) => makeTickBattle({ strategyPreset: v }),
  executionMode: (v) => makeTickBattle({ executionMode: v }),
  pendingProposal: (v) => makeTickBattle({ pendingProposal: v }),
  battleLedger: (v) => makeTickBattle({ battleLedger: v }),
  dailyGrades: (v) => makeTickBattle({ dailyGrades: v }),
};

/**
 * Review K4-4: these fields already passed every shape at the base — the rows
 * are regression guards for them, not defect rows (the defect rows are the
 * meeting, its legs, the history and the preset: 26 of them fail at c1822e39).
 */
const REGRESSION_GUARD = {
  battleLedger: 'regression guard: the check reads it only in the migration',
  dailyGrades: 'regression guard: the check reads it only in the migration',
  executionMode: 'regression guard: safe at the base, read only by a log line',
  pendingProposal: 'regression guard: safe since the launch guard of the integrity build',
};

describe('every owner-writable field, every shape: the check completes and saves its score (acceptance 2)', () => {
  for (const [field, shapes] of Object.entries(SHAPES)) {
    for (const [label, value] of Object.entries(shapes)) {
      it(`${field} = ${label}${REGRESSION_GUARD[field] ? ` (${REGRESSION_GUARD[field]})` : ''}`, async () => {
        const { thrown, db, summary } = await runTick(BATTLE_FOR[field](value));
        expect(thrown, String(thrown?.stack || thrown).slice(0, 400)).toBeNull();
        expect(summary.evaluated).toBe(1);
        const scoreWrite = db.__updates.find((u) => Object.hasOwn(u, 'scoreState.currentScore'));
        expect(scoreWrite, 'the score was saved').toBeTruthy();
        expect(db.__updates.some((u) => Object.hasOwn(u, 'cronState.cronErrors') && !u.evaluations), 'no crash record').toBe(false);
      });
    }
  }

  it('an unconvertible executionMode on a tick whose model swaps (the launch-guard log names the mode)', async () => {
    const { makeSwapResult } = await import('../_utils/__fixtures__/tickStampsHarness.js');
    mocks.create.mockImplementation(async () => makeToolUseResponse(makeSwapResult()));
    const battle = makeTickBattle({ executionMode: { toString: 1, valueOf: 2 } });
    const prices = makePriceTable();
    mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
    mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
    const db = makeCallsDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
    await expect(processAgentBattle(db, battle, { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 }, Date.now(), new Map(), { everEnabled: false })).resolves.toBeUndefined();
    expect(db.__store.battle.trades.map((t) => t.symbolIn)).toEqual(['AMD']);
    expect(db.__store.battle.trades[0].entryMode).toBe('autopilot');
  });

  it('at shadow and enforce too (the P6 belief reader sits on the meeting path)', async () => {
    for (const mode of ['shadow', 'enforce']) {
      flags.swapIdentity = mode;
      for (const value of [[null], { a: 1 }, 'x', [{ symbolOut: 'KO', symbolIn: 'AMD', swappedInAt: { lockedPoints: 1 } }]]) {
        const { thrown, db } = await runTick(BATTLE_FOR.suggestedSwaps(value));
        expect(thrown, `${mode} ${JSON.stringify(value)}`).toBeNull();
        expect(db.__updates.some((u) => Object.hasOwn(u, 'scoreState.currentScore'))).toBe(true);
      }
    }
  });
});

describe('what the malformed values become', () => {
  it('a gameplanMeetingHistory that is not a list: the server\'s append starts a fresh list (one row)', async () => {
    for (const value of [7, 'abc', { a: 1 }, { length: 1, 0: 'x' }]) {
      const { stored } = await runTick(BATTLE_FOR.gameplanMeetingHistory(value));
      expect(stored.gameplanMeetingHistory, JSON.stringify(value)).toHaveLength(1);
      expect(stored.gameplanMeetingHistory[0]).toMatchObject({ status: 'approved' });
    }
  });

  it('a well-formed history list is appended to as before', async () => {
    const prior = [{ id: 'm0', status: 'expired' }];
    const { stored } = await runTick(BATTLE_FOR.gameplanMeetingHistory(prior));
    expect(stored.gameplanMeetingHistory.map((r) => r.id ?? r.status)).toEqual(['m0', expect.any(String)]);
    expect(stored.gameplanMeetingHistory[0]).toEqual(prior[0]);
  });

  it('an inherited-name preset trades on the balanced table and stamps the preset that governed (enforce readiness, Q4 — was the capped label)', async () => {
    const { stored } = await runTick(makeTickBattle({ ...BATTLE_FOR.suggestedSwaps([{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'r' }]), strategyPreset: 'constructor' }));
    expect(stored.trades).toHaveLength(1);
    expect(stored.trades[0].entryPreset).toBe('balanced'); // the TABLE was balanced, and so is the label now
  });

  it('a meeting that is not an object reads as no meeting: the server may create a real one over it', async () => {
    const battle = makeTickBattle({ gameplanMeeting: 'planted' });
    delete battle.cronState.lastGameplanDate; // arm the detector
    const { db } = await runTick(battle);
    const created = db.__updates.find((u) => u.gameplanMeeting && typeof u.gameplanMeeting === 'object');
    expect(created?.gameplanMeeting?.status).toBe('pending');
    expect(created['cronState.gameplanMeeting'].meetingId).toBe(created.gameplanMeeting.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integrity follow-up 2, review K5 (the mutation lens): rows that kill mutants
// the rows above let survive (report §12.3; the M5-n ids are its mutant table).
describe('K5 — the meeting\'s own id is owner-writable too (M5-174)', () => {
  it('a pending meeting the copy does not name, whose id no template can convert (the "not waiting" log line names it): the check completes and saves its score', async () => {
    for (const id of [{ toString: 1, valueOf: 2 }, 'I'.repeat(300_000)]) {
      const { thrown, db, summary } = await runTick(makeTickBattle({ gameplanMeeting: { id, status: 'pending', diagnosis: 'drag', expiresAt: '2099-01-01T00:00:00.000Z', suggestedSwaps: [] } }));
      expect(thrown, String(thrown?.stack || thrown).slice(0, 400)).toBeNull();
      expect(summary.evaluated).toBe(1);
      expect(db.__updates.some((u) => Object.hasOwn(u, 'scoreState.currentScore'))).toBe(true);
      expect(db.__updates.some((u) => Object.hasOwn(u, 'cronState.cronErrors') && !u.evaluations)).toBe(false);
    }
  });
});
