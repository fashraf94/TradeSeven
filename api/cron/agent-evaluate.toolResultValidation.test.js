// api/cron/agent-evaluate.toolResultValidation.test.js
//
// T3 — the model's tool result is validated against the FULL schema before
// anything reads it (adjudication V1.1 P-3).
//
// THE DEFECT. The parse site accepted any tool_use block whose `decision` was
// a string (agent-evaluate.js, pre-fix `:2138-2139`). Three shapes the schema
// forbids sailed through into the decision pipeline:
//   · a `decision` outside the HOLD|SWAP enum,
//   · a SWAP naming no `symbolOut`/`symbolIn`,
//   · a missing or non-numeric `conviction` — which then slipped the
//     platform's `conviction < 70` floor (agentSwapExecution.js:77), because
//     `undefined < 70` and `'high' < 70` are both false.
//
// THE SEAM IS THE CRON. These rows drive the real `processAgentBattle` on the
// shared tick harness — the same one the tick-stamps suites use — with only
// the I/O collaborators doubled. The model is doubled because it is the thing
// under test: each row hands the cron one malformed tool result and asks what
// the tick did with it. `executeSwapServer` is doubled so "no swap was
// attempted" is an observation rather than an inference.
//
// EVERY FAILURE ROW ASSERTS FOUR THINGS: the tick held, the failure category
// is `invalid_tool_result`, the named field is on the record, and no swap was
// attempted. Two rows guard the other direction — a valid SWAP still executes,
// and a valid HOLD is byte-identical to the golden captured before this fix.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW, PRE_PHASE_B_ENTRY_KEYS,
  makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeSwapResult, makeToolUseResponse, makeTickDb,
} from '../_utils/__fixtures__/tickStampsHarness.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn(),
}));
// Hoisted separately and assigned BY REFERENCE below. Naming it `…Mock` keeps
// the literal text `executeSwapServer(` out of this file, so the repo-level
// call-site census in agent-evaluate.test.js still reads this suite as a
// non-consumer — the census stays exactly as strict as it was, rather than
// growing an allowlist entry. Same reason the R11 behavioral suite spells it
// this way.
const { executeSwapServerMock } = vi.hoisted(() => ({ executeSwapServerMock: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } } }));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData, fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []), filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({ resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(), reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn() }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
// The executor, doubled — the ONLY way a swap can reach the book from this
// tick. `validateTradeDecision` stays real (it is the fenced downstream floor
// whose bypass this fix closes; doubling it would hide the very ordering the
// suite is about).
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => ({
  ...(await importOriginal()),
  executeSwapServer: executeSwapServerMock,
}));
vi.mock('../_utils/learning/captureReceipt.js', () => ({
  captureSwapReceipt: vi.fn(async () => {}),
  resolveEntrySnapshot: vi.fn(async () => ({ snapshotIn: null, techDocIn: null, entrySnapshotSource: 'unavailable' })),
  classifyEntryAtrSource: vi.fn(() => 'bench_atr'),
  classifyEvidence: vi.fn(() => 'live_agent'),
}));

const { processAgentBattle } = await import('./agent-evaluate.js');
const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(resolve(HERE, '../_utils/__fixtures__/tickStampsEntryGolden.flagOff.json'), 'utf8'));
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

/** One real tick whose model returns `response`. Returns the written entry. */
async function runTick(response, { battle = makeTickBattle() } = {}) {
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => response);
  const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  return { db, summary, finalUpdate, entry: finalUpdate ? finalUpdate.evaluations.at(-1) : null };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset(); mocks.fetchIntradayBatch.mockReset(); mocks.create.mockReset();
  executeSwapServerMock.mockReset();
  executeSwapServerMock.mockImplementation(async (_db, _id, _battle, _tier, _slot, incoming) => ({
    closedTrade: { symbolIn: incoming.symbol, symbolOut: 'KO', swappedOutAt: FROZEN_NOW, entryPrice: 62.2, lockedPoints: 0 },
    incomingAsset: { ...incoming, swapPrice: 160.4 },
  }));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// ---------------------------------------------------------------------------
// The five failure kinds. Each names the shape, the field the record must
// carry, and (for the SWAP-shaped ones) the trade that must NOT have happened.

describe('T3 — an invalid tool result is a fail-closed HOLD', () => {
  const rows = [
    {
      name: 'bad enum — a decision outside HOLD|SWAP',
      input: () => makeHoldResult({ decision: 'SELL' }),
      invalidField: 'decision',
    },
    {
      name: 'missing pair field — a SWAP that names no symbolIn',
      input: () => { const r = makeSwapResult(); delete r.symbolIn; return r; },
      invalidField: 'symbolIn',
    },
    {
      name: 'missing conviction — the field the < 70 floor reads is absent',
      input: () => { const r = makeSwapResult(); delete r.conviction; return r; },
      invalidField: 'conviction',
    },
    {
      name: 'non-numeric conviction — a string where the schema wants a number',
      input: () => makeSwapResult({ conviction: 'high' }),
      invalidField: 'conviction',
    },
    {
      name: 'parse error — a tool_use block whose input is not an object',
      input: () => '{"decision":"SWAP","symbolOut":"KO"',
      invalidField: 'input',
    },
  ];

  for (const row of rows) {
    it(`${row.name} → HOLD, invalid_tool_result, invalidField "${row.invalidField}", no swap`, async () => {
      const { entry, summary } = await runTick(makeToolUseResponse(row.input()));

      expect(entry.decision).toBe('HOLD');
      expect(entry.haikuError.failureClass).toBe('invalid_tool_result');
      expect(entry.haikuError.invalidField).toBe(row.invalidField);
      expect(entry.holdKind).toBe('default_failure');
      // Nothing was repaired or filled in from the malformed proposal: the
      // entry carries the fallback rationale, not the model's text.
      expect(entry.rationale).toBe('Haiku call failed — defaulting to HOLD');
      expect(entry.symbolOut).toBeNull();
      expect(entry.symbolIn).toBeNull();
      // The trade that must not have happened.
      expect(executeSwapServerMock).not.toHaveBeenCalled();
      expect(summary.swapped).toBe(0);
      expect(summary.held).toBe(1);
      // One call, never a retry.
      expect(mocks.create).toHaveBeenCalledTimes(1);
    });
  }

  it('the conviction rows would have slipped the < 70 floor: both reach it falsy-compared', () => {
    // Anti-vacuity for the two conviction rows. If validation were removed,
    // neither shape would be stopped by the downstream floor — which is the
    // whole reason the check had to move upstream of it.
    expect(undefined < 70).toBe(false);
    expect('high' < 70).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The other direction.

describe('T3 — the valid paths are untouched', () => {
  it('a valid SWAP still executes, carries no failure record, and holds no kind', async () => {
    const { entry, summary } = await runTick(makeToolUseResponse(makeSwapResult()));

    expect(entry.decision).toBe('SWAP');
    expect(entry.symbolOut).toBe('KO');
    expect(entry.symbolIn).toBe('AMD');
    expect(entry.conviction).toBe(72);
    expect(entry.haikuError).toBeNull();
    expect(entry.holdKind).toBeNull();
    expect(executeSwapServerMock).toHaveBeenCalledTimes(1);
    expect(summary.swapped).toBe(1);
  });

  it('NO REGRESSION — a valid HOLD is byte-identical to the pre-fix golden', async () => {
    const { entry } = await runTick(makeToolUseResponse(makeHoldResult()));

    // The golden was captured before any of this build's code existed. The
    // 25 pre-Phase-B keys must still serialize to exactly those bytes.
    expect(JSON.stringify(pick(entry, PRE_PHASE_B_ENTRY_KEYS))).toBe(JSON.stringify(GOLDEN.entry));
    // …and the one new field is present and null on a CHOSEN hold, so the
    // comparison above is not passing because the field silently vanished.
    expect(entry).toHaveProperty('holdKind');
    expect(entry.holdKind).toBeNull();
    expect(executeSwapServerMock).not.toHaveBeenCalled();
  });

  it('an ABSENT tool_use block is still truncated_response, not the new class', async () => {
    // The boundary this fix deliberately did not move: a response carrying no
    // tool_use block at all (max_tokens truncation mid-JSON) keeps its
    // original category and message. `invalid_tool_result` means a block
    // arrived and failed the schema — a different fact, kept distinguishable.
    const { entry } = await runTick({
      usage: { input_tokens: 4321, output_tokens: 210 },
      stop_reason: 'max_tokens',
      content: [{ type: 'text', text: '{"decision":"SW' }],
    });

    expect(entry.decision).toBe('HOLD');
    expect(entry.haikuError.failureClass).toBe('truncated_response');
    expect(entry.haikuError).not.toHaveProperty('invalidField');
    expect(entry.haikuError.message).toBe('response received but tool input missing/unusable (stop_reason=max_tokens)');
    expect(entry.holdKind).toBe('default_failure');
    expect(executeSwapServerMock).not.toHaveBeenCalled();
  });
});
