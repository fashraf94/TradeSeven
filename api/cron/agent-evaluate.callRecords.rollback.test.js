// api/cron/agent-evaluate.callRecords.rollback.test.js
//
// Cockpit Build 1a — THE ROLLBACK FIXTURE (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md
// §3 "Rollback fixture", §15.1).
//
// A battle that carries Build 1a state — a persisted CALL directive in the
// slot, its thread exchange in chatExchanges, an answered open call, a hit and
// pending sweep work — must, at CALL_RECORDS_MODE 'off', drive the REAL
// processAgentBattle to exactly the bytes a battle with NO directive produced
// before any Build 1a source existed: every battle write, every prompt byte
// and both capture documents. An ORDINARY directive beside cockpit filings in
// the history must still render (byte-identical to the Build 0 off golden's
// completed_hold row). And the call stores are neither read nor written.
//
// THE FIXTURE (api/_utils/__fixtures__/callRecordsRollbackGolden.json) IS
// CAPTURED FROM THE UNTOUCHED TREE — origin/main @ 9dfbea21, before any Build
// 1a source change — by running this file in regeneration mode there. Its
// SHA-256 is pinned below. Regenerate it ONLY from such a tree (never to make
// this suite green after a Build 1a change), then move the pin in the same
// commit:
//   GENERATE_CALLS_ROLLBACK_GOLDEN=1 npx vitest run api/cron/agent-evaluate.callRecords.rollback.test.js
// The generating run fails on purpose after writing, and refuses CI.
//
// The harness is the off golden's (agent-evaluate.callRecords.offGolden.test.js):
// the same mocks, the same frozen clock, the same seven-position book, capture
// ON, `executeSwapServer` doubled through a hoisted variable so the literal call
// string never appears here. Portability (branch review BR-5): the process runs
// in UTC (the first import), the fixture is LF on every platform (.gitattributes).

// FIRST, before any module can build a local-time Date.
import '../_utils/__fixtures__/pinTimezoneUtc.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs,
  makeIntradayCandles, makeHoldResult, makeToolUseResponse, deepClone, OLD_THREAD,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCallsDb, callsTouches, storedCollection, storedDoc, CALL_SUBCOLLECTIONS } from '../_utils/__fixtures__/callRecordsStore.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const { swapMock } = vi.hoisted(() => ({ swapMock: vi.fn() }));
const flagState = vi.hoisted(() => ({ tickCapture: true }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
// The fenced executor, DOUBLED in tests only (never edited).
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => ({
  ...(await importOriginal()),
  executeSwapServer: swapMock,
}));
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
// THE FLAGS — CALL_RECORDS_MODE pinned 'off' EXPLICITLY (hermetic: this
// contract must hold in every live state of the flag); capture on.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, CALL_RECORDS_MODE: 'off', get TICK_CAPTURE_ENABLED() { return flagState.tickCapture; } };
});

const { processAgentBattle } = await import('./agent-evaluate.js');
const { newTickCaptureScope, runInTickCaptureScope } = await import('../_utils/tickCapture/captureContext.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(HERE, '../_utils/__fixtures__/callRecordsRollbackGolden.json');
const OFF_GOLDEN_PATH = resolve(HERE, '../_utils/__fixtures__/callRecordsOffGolden.json');
/** The fixture's SHA-256 as captured from the untouched tree (the review C-9 pattern). */
const GOLDEN_SHA256 = '8b6b1e129fab9fcb7eca621e618027468ca2f21872de80656b4cd656db9fdfc3';
const ENV = globalThis.process?.env || {};
const GENERATE = ENV.GENERATE_CALLS_ROLLBACK_GOLDEN === '1';
if (GENERATE && ENV.CI) throw new Error('GENERATE_CALLS_ROLLBACK_GOLDEN is a local, deliberate act — never on CI');

const BATTLE_ID = 'battle-tick-1';
const CALL_THREAD = 'thread-call-0001';
const CALL_ID = `${BATTLE_ID}:eval_000:call:0`;
const HIT_ID = `${BATTLE_ID}:eval_000:call:1`;
const MINTED_AT = Date.parse('2026-09-09T14:00:00.000Z');
const SESSION_CLOSE = Date.parse('2026-09-09T20:00:00.000Z');

/** A persisted CALL directive (the Build 1a slot shape, spec §6) in the single slot. */
export function makeCallDirectiveSlot(overrides = {}) {
  return {
    text: "Hold off on the AMD entry until today's close.",
    expiry: 'until_ms',
    directiveThreadId: CALL_THREAD,
    createdAt: '2026-09-09T14:20:00.000Z',
    family: 'call',
    expiresAtMs: SESSION_CLOSE,
    basis: 'this_session',
    callId: CALL_ID,
    kind: 'call_hold',
    action: { direction: 'entry', symbol: 'AMD', slot: 'support', counterpart: 'KO' },
    answerId: `${CALL_ID}:answer:hold:`,
    filedAt: '2026-09-09T14:20:00.000Z',
    textVersion: 'callActions.v1',
    ...overrides,
  };
}

/** The call directive's thread exchange (chip-shaped, `source: 'cockpit'`). */
export function makeCockpitExchange(overrides = {}) {
  const slot = makeCallDirectiveSlot();
  const { createdAt, ...record } = slot;
  return {
    userMessage: null,
    agentResponse: '',
    scratchpad: null,
    hasDirective: true,
    directive: record,
    directiveThreadId: CALL_THREAD,
    suggestedActions: null,
    elicitationTarget: 'directive_filed',
    timestamp: createdAt,
    mode: 'battle',
    messageType: 'directive_filed',
    source: 'cockpit',
    groundingVersion: 1,
    callId: CALL_ID,
    ...overrides,
  };
}

/** Build 1a call-store state: an answered open call, a hit, pending sweep work. */
export function seedBuild1aRecords(battleId = BATTLE_ID) {
  const base = (callId, over) => ({
    callId, kind: 'called_shot', battleId, evalId: 'eval_000', evalSeq: 0, mintedAt: MINTED_AT,
    symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 161 },
    horizon: { phrase: 'this_session', expiresAt: SESSION_CLOSE, basis: 'this_session' },
    defaultAction: 'act', said: 'AMD into Support if it holds $161.', state: 'open',
    stateChangedAt: MINTED_AT, stateSource: 'mint',
    playerResponse: null, directiveThreadId: null, outcome: null, refused: null,
    ...over,
  });
  return {
    calls: {
      [CALL_ID]: base(CALL_ID, {
        playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: CALL_THREAD, callId: CALL_ID, filedAt: '2026-09-09T14:20:00.000Z', heardEvalId: null },
        directiveThreadId: CALL_THREAD,
      }),
      [HIT_ID]: base(HIT_ID, {
        symbol: 'KO', direction: 'exit', counterpart: 'AMD', condition: { side: 'below', level: 62.5 }, defaultAction: 'hold',
        said: 'KO below $62.50 by the close.', state: 'hit', stateChangedAt: MINTED_AT + 900_000, stateSource: 'check',
        outcome: { receiptRef: `agentBattles/${battleId}/callObservations/${HIT_ID}` },
      }),
    },
    declarations: { eval_000: { battleId, evalId: 'eval_000', calledShots: [], watching: ['AMD'], playerAsk: null, fork: null, removed: [] } },
    callObservations: { [HIT_ID]: { callId: HIT_ID, evalId: 'eval_000b', observedAtMs: MINTED_AT + 900_000, px: 62.1, source: 'model_prompt', replacedInPrompt: false } },
    queue: { battleId, nextExpiresAt: SESSION_CLOSE, pendingHeard: [CALL_ID], updatedAt: MINTED_AT },
  };
}

/** Ordinary chat history around a cockpit filing. */
function historyWithCockpit() {
  return [
    { userMessage: 'How are we looking?', agentResponse: 'Holding the book.', scratchpad: null, hasDirective: false, directive: null, directiveThreadId: null, suggestedActions: null, elicitationTarget: 'risk_appetite', timestamp: '2026-09-09T14:05:00.000Z', mode: 'battle' },
    makeCockpitExchange(),
    { userMessage: 'Tighten up.', agentResponse: 'Noted.', scratchpad: null, hasDirective: true, directive: { text: 'Require stronger confirmation before entering', expiry: 'end_of_battle', directiveThreadId: OLD_THREAD, adjustmentId: 'TF-02', canonicalTextVersion: 1 }, directiveThreadId: OLD_THREAD, suggestedActions: null, elicitationTarget: 'concentration_tolerance', timestamp: '2026-09-09T14:21:00.000Z', mode: 'battle', supersedes: { directiveThreadId: CALL_THREAD, at: '2026-09-09T14:21:00.000Z' } },
  ];
}

/**
 * THE SCENARIOS. `no_directive` is the frozen comparator: what a battle with
 * no directive rendered before Build 1a. The ordinary row compares to the Build
 * 0 off golden's completed_hold (the same battle, ordinary directive current).
 */
export const SCENARIOS = {
  no_directive: () => ({ battle: makeTickBattle({ directive: null }) }),
  ordinary_directive_with_cockpit_history: () => ({ battle: makeTickBattle({ chatExchanges: historyWithCockpit() }) }),
  call_directive_in_slot: () => ({ battle: makeTickBattle({ directive: makeCallDirectiveSlot(), chatExchanges: [historyWithCockpit()[0], makeCockpitExchange()] }) }),
};

async function runScenario(name) {
  const { battle, result = makeHoldResult(), prices = makePriceTable(), rankingsDoc = makeRankingsDoc(), cronStartTime = Date.now() } = SCENARIOS[name]();
  flagState.tickCapture = true;
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(result));
  const seed = seedBuild1aRecords(battle.id);
  const db = makeCallsDb({ battle, rankingsDoc, techDocs: makeTechDocs(), seed });
  swapMock.mockImplementation(async () => { throw new Error('no swap in these rows'); });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  let thrown = null;
  const captureScope = newTickCaptureScope();
  try {
    await runInTickCaptureScope(captureScope, () => processAgentBattle(db, battle, summary, cronStartTime, new Map(), { everEnabled: false }));
  } catch (err) {
    thrown = String(err?.message || err);
  }
  const prompts = mocks.create.mock.calls.map((call) => deepClone(call[0]));
  const snapshot = { thrown, summary, updates: db.__updates, prompts, capture: db.__captureWrites };
  return { snapshot, db, seed };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  swapMock.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const serialize = (v) => JSON.stringify(v);

describe('Build 1a rollback — at off a battle carrying call state renders as it did before the build', () => {
  it('GENERATE (local only) or load the frozen fixture', async () => {
    if (!GENERATE) {
      expect(existsSync(GOLDEN_PATH), 'frozen fixture missing — it is captured once, from the untouched tree').toBe(true);
      return;
    }
    const { snapshot } = await runScenario('no_directive');
    writeFileSync(GOLDEN_PATH, `${JSON.stringify({
      capturedFrom: 'origin/main @ 9dfbea21dbb1c22f2e35009d95ef60a51f00078a — the untouched tree, before any Build 1a source change; harness tickStampsHarness.js + tickCaptureHarness.js + callRecordsStore.js, capture on',
      frozenNow: FROZEN_NOW,
      scenarios: { no_directive: JSON.parse(serialize(snapshot)) },
    }, null, 2)}\n`);
    throw new Error(`frozen fixture written to ${GOLDEN_PATH} — this generating run fails on purpose; re-run WITHOUT GENERATE_CALLS_ROLLBACK_GOLDEN to verify`);
  });

  const golden = existsSync(GOLDEN_PATH) ? JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) : null;
  const offGolden = existsSync(OFF_GOLDEN_PATH) ? JSON.parse(readFileSync(OFF_GOLDEN_PATH, 'utf8')) : null;

  it('the fixture file is exactly the one captured from the untouched tree (SHA-256 pinned)', () => {
    expect(createHash('sha256').update(readFileSync(GOLDEN_PATH)).digest('hex')).toBe(GOLDEN_SHA256);
    expect(readFileSync(GOLDEN_PATH).includes(0x0d)).toBe(false);
    const attributes = readFileSync(resolve(HERE, '../../.gitattributes'), 'utf8').split(/\r?\n/).map((l) => l.trim());
    expect(attributes).toContain('api/_utils/__fixtures__/callRecordsRollbackGolden.json text eol=lf');
  });

  it('the fixture is not vacuous: the no-directive row wrote, prompted once, captured once, and rendered NO directive block', () => {
    expect(golden).not.toBeNull();
    const row = golden.scenarios.no_directive;
    expect(row.updates.length).toBeGreaterThan(0);
    expect(row.prompts).toHaveLength(1);
    expect(row.capture).toHaveLength(1);
    expect(serialize(row.prompts)).not.toContain('ACTIVE DIRECTIVE (from your Coach)');
    expect(serialize(row.prompts)).not.toContain('threadId: ');
    expect(serialize(row.prompts)).not.toContain(OLD_THREAD);
    expect(serialize(row.prompts)).not.toContain(CALL_THREAD);
  });

  it('no_directive: the live tree reproduces the frozen capture byte for byte', async () => {
    const { snapshot, db, seed } = await runScenario('no_directive');
    const live = JSON.parse(serialize(snapshot));
    const frozen = golden.scenarios.no_directive;
    expect(serialize(live.updates)).toBe(serialize(frozen.updates));
    expect(serialize(live.prompts)).toBe(serialize(frozen.prompts));
    expect(serialize(live.capture)).toBe(serialize(frozen.capture));
    expect(serialize(live.summary)).toBe(serialize(frozen.summary));
    expect(live.thrown).toBe(frozen.thrown);
    expect(callsTouches(db)).toEqual({ reads: 0, writes: 0, queries: 0 });
    for (const sub of CALL_SUBCOLLECTIONS) expect(storedCollection(db, sub)).toEqual(seed[sub]);
    expect(storedDoc(db, 'callSweepQueue')).toEqual(seed.queue);
  });

  it('an ORDINARY directive beside cockpit filings in the history (and Build 1a call state seeded): byte-identical to the Build 0 off golden completed_hold — the ordinary directive is rendered, the call stores untouched', async () => {
    expect(offGolden).not.toBeNull();
    const { snapshot, db, seed } = await runScenario('ordinary_directive_with_cockpit_history');
    const live = JSON.parse(serialize(snapshot));
    const frozen = offGolden.scenarios.completed_hold;
    expect(serialize(live.updates)).toBe(serialize(frozen.updates));
    expect(serialize(live.prompts)).toBe(serialize(frozen.prompts));
    expect(serialize(live.capture)).toBe(serialize(frozen.capture));
    expect(serialize(live.summary)).toBe(serialize(frozen.summary));
    expect(live.thrown).toBe(frozen.thrown);
    expect(serialize(live.prompts)).toContain('ACTIVE DIRECTIVE (from your Coach)');
    expect(serialize(live.prompts)).toContain(OLD_THREAD);
    expect(serialize(live.prompts)).not.toContain(CALL_THREAD);
    expect(callsTouches(db)).toEqual({ reads: 0, writes: 0, queries: 0 });
    for (const sub of CALL_SUBCOLLECTIONS) expect(storedCollection(db, sub)).toEqual(seed[sub]);
    expect(storedDoc(db, 'callSweepQueue')).toEqual(seed.queue);
    expect(serialize(live.updates)).not.toMatch(/declarationsPhase|callFlips|callsDiag/);
  });
});
