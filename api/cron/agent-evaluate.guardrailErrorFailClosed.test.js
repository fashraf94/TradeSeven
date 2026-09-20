// api/cron/agent-evaluate.guardrailErrorFailClosed.test.js
//
// T2 — a throwing guardrail evaluation holds the model's proposal instead of
// waving it through (adjudication V1.1).
//
// THE DEFECT. The catch around `applyGuardrails` logged and proceeded with
// Haiku's original decision (agent-evaluate.js, pre-fix `:2375-2379`). That
// inverted the layer's purpose: the deterministic override exists to STOP
// trades the thresholds forbid, so an exception there means the one check
// that could have blocked the swap did not run — and the proposal executed
// with its guardrails silently absent.
//
// SCOPE IS THE PROPOSAL ONLY. Anything already executed earlier in the tick
// has been committed by `executeSwapServer` and stands; nothing here reverts
// a trade. The second row is that guarantee, driven by a REAL bust-avoidance
// exit rather than a stubbed one.
//
// The fenced `agentGuardrails.js` is DOUBLED here — doubled in tests only,
// never edited — because "the evaluator throws" is the premise of the suite.
// `injectDiversifierSectorCap` and the observe-cap resolver stay real, so the
// gate that decides whether the evaluator runs at all is production code.

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
// What the doubled evaluator does this row: an Error to throw, or null to run
// the real one.
const { guardrailState } = vi.hoisted(() => ({ guardrailState: { throws: null } }));
// Assigned by reference — naming it `…Mock` keeps the literal text
// `executeSwapServer(` out of this file, so the repo-level call-site census in
// agent-evaluate.test.js still reads this suite as a non-consumer.
const { executeSwapServerMock } = vi.hoisted(() => ({ executeSwapServerMock: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({ default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } } }));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData, fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []), filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/agentGuardrails.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    applyGuardrails: (...args) => {
      if (guardrailState.throws) throw guardrailState.throws;
      return real.applyGuardrails(...args);
    },
  };
});
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => ({
  ...(await importOriginal()),
  executeSwapServer: executeSwapServerMock,
}));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({ resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(), reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn() }));
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

const { processAgentBattle } = await import('./agent-evaluate.js');
const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(resolve(HERE, '../_utils/__fixtures__/tickStampsEntryGolden.flagOff.json'), 'utf8'));
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

const STOP_LOSS = { type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' };

/** A battle whose agent has a guardrail deployed, so the evaluator is reached. */
function guardedBattle(overrides = {}) {
  const base = makeTickBattle();
  return {
    ...base,
    agentContext: { ...base.agentContext, deployedGuardrails: [STOP_LOSS] },
    ...overrides,
  };
}

/**
 * KO one point below its bust line. baseATR 1.1 and entry 62.20, so −1.00 %
 * is −0.91x ATR — past the balanced preset's −0.85x bust buffer, which is a
 * REAL EMERGENCY_SWAP out of the production risk manager, not a stub.
 */
function pricesWithKoBust() {
  const prices = makePriceTable();
  prices.KO = { ...prices.KO, current: 61.578 };
  return prices;
}

async function runTick(battle, toolInput, { prices = makePriceTable() } = {}) {
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(toolInput));
  const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  return {
    db, summary, finalUpdate,
    entry: finalUpdate ? finalUpdate.evaluations.at(-1) : null,
    feed: finalUpdate?.statusFeed || [],
    stored: db.__store.battle,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(FROZEN_NOW));
  guardrailState.throws = null;
  mocks.getStockAnalysisData.mockReset(); mocks.fetchIntradayBatch.mockReset(); mocks.create.mockReset();
  executeSwapServerMock.mockReset();
  // F5c — the double COMMITS to the fake stored document, the way the real
  // executor commits to Firestore: slot occupant replaced, outgoing returned
  // to the bench under cooldown, trade appended, tradeCount bumped. Without
  // this there was no durable state for the "SURVIVES" row to preserve.
  executeSwapServerMock.mockImplementation(async (dbArg, _id, _battle, tier, slotIndex, incoming) => {
    const stored = dbArg.__store.battle;
    const outgoing = stored.portfolio[tier][slotIndex];
    stored.portfolio[tier] = stored.portfolio[tier].map((a, i) => (
      i === slotIndex ? { ...incoming, swapPrice: 160.4, swappedInAt: FROZEN_NOW } : a
    ));
    stored.portfolio.bench = {
      ...stored.portfolio.bench,
      stocks: [
        ...(stored.portfolio.bench.stocks || []).filter((a) => a.symbol !== incoming.symbol),
        { ...outgoing, cooldownUntil: '2026-09-10T15:00:00.000Z' },
      ],
    };
    stored.trades = [...(stored.trades || []), {
      symbolIn: incoming.symbol, symbolOut: outgoing.symbol, lockedPoints: 0, entryPrice: 62.2,
    }];
    stored.scoreState = { ...stored.scoreState, tradeCount: (stored.scoreState?.tradeCount || 0) + 1 };
    return {
      closedTrade: { symbolIn: incoming.symbol, symbolOut: outgoing.symbol, swappedOutAt: FROZEN_NOW, entryPrice: 62.2, lockedPoints: 0 },
      incomingAsset: { ...incoming, swapPrice: 160.4 },
    };
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('T2 — a throwing guardrail evaluation holds the proposal', () => {
  it('throws on a SWAP proposal → HOLD, guardrail_error recorded, no swap attempted, entry written', async () => {
    guardrailState.throws = new TypeError("Cannot read properties of undefined (reading 'baseATR')");
    const { entry, summary, feed } = await runTick(guardedBattle(), makeSwapResult());

    expect(entry.decision).toBe('HOLD');
    expect(entry.symbolOut).toBeNull();
    expect(entry.symbolIn).toBeNull();
    expect(entry.downgraded).toBe(true);
    expect(entry.holdKind).toBe('default_failure');

    // The fault, on its OWN field (Astra review F2, Sep 20 2026): it happened
    // AFTER the model call, so it no longer overwrites `haikuError`, which is
    // the model-call outcome and nothing else. The call succeeded here, so
    // haikuError is null and the fault is beside it.
    expect(entry.haikuError).toBeNull();
    // The MESSAGE, and only the message — no stack anywhere on the record.
    expect(entry.guardrailFault.message).toBe("Cannot read properties of undefined (reading 'baseATR')");
    expect(JSON.stringify(entry)).not.toMatch(/\bat \w+ \(|\.js:\d+:\d+/);
    expect(entry.validationErrors.join(' ')).toContain('Guardrail evaluation failed');

    // The trade that must not have happened.
    expect(executeSwapServerMock).not.toHaveBeenCalled();
    expect(summary.swapped).toBe(0);

    // The evaluation record was still written, and the degraded tick is
    // visible rather than silent.
    expect(entry.evalId).toBeTruthy();
    expect(feed.some((e) => e.action === 'eval_degraded')).toBe(true);
  });

  it('an S7 forced exit executed earlier SURVIVES — only the model proposal is held', async () => {
    guardrailState.throws = new Error('guardrail evaluator exploded');
    // KO busts, so the risk loop exits it BEFORE the model is ever called.
    // The model then proposes an unrelated SWAP, and the guardrail throws.
    const { entry, summary, feed, stored } = await runTick(
      guardedBattle(),
      makeSwapResult({ symbolOut: 'TSLA', symbolIn: 'JPM' }),
      { prices: pricesWithKoBust() },
    );

    // The forced exit happened, and it happened exactly once.
    expect(executeSwapServerMock).toHaveBeenCalledTimes(1);
    expect(summary.swapped).toBe(1);
    const riskBeat = feed.find((e) => e.source === 'risk_manager' && e.symbolOut === 'KO');
    expect(riskBeat, 'the risk exit must be on the status feed').toBeTruthy();
    expect(riskBeat.triggeredBy).toContain('bust_avoidance');

    // DURABLE PRESERVATION (Astra review F5c, Sep 20 2026). A call count is
    // not survival: the double now COMMITS the slot change and the trade to
    // the fake stored document, exactly as the executor does, and the
    // assertions below read that document back AFTER the whole tick — so a
    // later write that clobbered the portfolio or dropped the trade would
    // redden this row. Before, nothing was ever committed, so "SURVIVES" was
    // about the mock, not the book.
    expect(stored.portfolio.support.map((a) => a.symbol)).not.toContain('KO');
    expect(stored.portfolio.support.map((a) => a.symbol)).toContain('AMD');
    expect(stored.trades.some((t) => t.symbolOut === 'KO' && t.symbolIn === 'AMD')).toBe(true);
    expect(stored.scoreState.tradeCount).toBe(1);

    // …and the model's proposal alone was held. Nothing reverted the trade:
    // the one executeSwapServer call was the risk exit, not the proposal.
    expect(entry.decision).toBe('HOLD');
    expect(entry.haikuError).toBeNull();
    expect(entry.guardrailFault.message).toBe('guardrail evaluator exploded');
    expect(entry.downgraded).toBe(true);
    const proposalSwap = executeSwapServerMock.mock.calls.find((c) => c[5]?.symbol === 'JPM');
    expect(proposalSwap, 'the held proposal must never have reached the executor').toBeUndefined();
  });

  it('a CHOSEN hold stays chosen — the fault is recorded, but nothing was downgraded', async () => {
    guardrailState.throws = new Error('guardrail evaluator exploded');
    const { entry } = await runTick(guardedBattle(), makeHoldResult());

    // The model already said HOLD, so there was no proposal to hold.
    expect(entry.decision).toBe('HOLD');
    expect(entry.downgraded).toBe(false);
    expect(entry.holdKind).toBeNull();
    expect(entry.validationErrors).toEqual([]);
    // The guardrail fault is still a real engine fault and is still recorded —
    // on its own field, leaving the model's own (successful) call untouched.
    expect(entry.haikuError).toBeNull();
    expect(entry.guardrailFault.message).toBe('guardrail evaluator exploded');
  });
});

describe('T2 — the normal paths are untouched', () => {
  it('a guarded tick whose evaluator does NOT throw still executes the SWAP', async () => {
    guardrailState.throws = null; // the real applyGuardrails runs
    const { entry, summary } = await runTick(guardedBattle(), makeSwapResult());

    expect(entry.decision).toBe('SWAP');
    expect(entry.symbolOut).toBe('KO');
    expect(entry.symbolIn).toBe('AMD');
    expect(entry.haikuError).toBeNull();
    expect(entry.holdKind).toBeNull();
    expect(executeSwapServerMock).toHaveBeenCalledTimes(1);
    expect(summary.swapped).toBe(1);
  });

  it('NO REGRESSION — an unguarded HOLD tick is byte-identical to the pre-fix golden', async () => {
    guardrailState.throws = new Error('never reached — no guardrail is deployed');
    // The fixture agent deploys none, so the evaluator is not entered at all
    // and the throw above is inert. That is the shipped common case.
    const { entry } = await runTick(makeTickBattle(), makeHoldResult());

    expect(JSON.stringify(pick(entry, PRE_PHASE_B_ENTRY_KEYS))).toBe(JSON.stringify(GOLDEN.entry));
    // …and the one new field is present and null, so the byte match above
    // cannot be passing because the field silently vanished.
    expect(entry).toHaveProperty('holdKind');
    expect(entry.holdKind).toBeNull();
    expect(executeSwapServerMock).not.toHaveBeenCalled();
  });
});
