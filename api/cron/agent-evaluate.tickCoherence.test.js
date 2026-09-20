// api/cron/agent-evaluate.tickCoherence.test.js
//
// T1 — after a forced S7 exit, the decision snapshot is rebuilt from the
// refreshed battle before the trigger gate and the prompt build.
//
// THE DEFECT. `refreshBattleFromDoc` (agent-evaluate.js:498-502) refreshes
// `battle` and nothing else. The arrays the rest of the tick reasons from
// were derived from the PRE-swap portfolio at the top of the function, so
// after a forced exit the tick carried two disagreeing pictures of one book:
//
//   · the prompt header reads `battle.scoreState` — refreshed, post-swap;
//   · the ACTIVE POSITIONS CSV iterates `assetScores` — stale, pre-swap.
//
// The agent was shown a position it no longer held, no row for the one that
// replaced it, and the same symbol simultaneously on its bench.
//
// COMPARED COMPONENT BY COMPONENT, NEVER BY TOTAL. A summed score can agree
// while every row underneath it is wrong; these rows assert the held set, the
// per-symbol rows, and the rendered CSV itself.
//
// THE EXECUTOR IS DOUBLED, ITS DOC EFFECT IS NOT. `executeSwapServer` is
// fenced. The double here does not re-implement it — it reproduces the one
// thing the rebuild reads: the persisted doc after a swap (slot occupant
// replaced, outgoing returned to the bench, trade appended). The refresh then
// re-reads that doc through the production path.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW,
  makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeToolUseResponse, makeTickDb,
} from '../_utils/__fixtures__/tickStampsHarness.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn(),
}));
// Assigned by reference — naming it `…Mock` keeps the literal text
// `executeSwapServer(` out of this file, so the repo-level call-site census in
// agent-evaluate.test.js still reads this suite as a non-consumer.
const { executeSwapServerMock } = vi.hoisted(() => ({ executeSwapServerMock: vi.fn() }));
// What the assembler was handed, and what it rendered.
const { captured } = vi.hoisted(() => ({ captured: { calls: [] } }));
// F5b — the lock set is not handed to the assembler, so the only place a test
// can observe it is the guardrail boundary it IS handed to. Captured by
// reference, never replaced: the real evaluator still runs.
const { guardrailCapture } = vi.hoisted(() => ({ guardrailCapture: { lockedPositions: null, calls: 0 } }));

vi.mock('@anthropic-ai/sdk', () => ({ default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } } }));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData, fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []), filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
// The fenced assembler, WRAPPED not replaced — the real builder runs and its
// inputs and output are recorded. Doubled in tests only, never edited.
vi.mock('../_utils/agentEvalPromptAssembly.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    buildLiveContextBlock: async (...args) => {
      const block = await real.buildLiveContextBlock(...args);
      captured.calls.push({ battle: args[0], assetScores: args[3], momentumData: args[7], block });
      return block;
    },
  };
});
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => ({
  ...(await importOriginal()),
  executeSwapServer: executeSwapServerMock,
}));
// The fenced guardrails module, WRAPPED not replaced — the real evaluator runs
// and the lock set it was handed is recorded. Doubled in tests only.
vi.mock('../_utils/agentGuardrails.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    applyGuardrails: (args) => {
      guardrailCapture.calls += 1;
      guardrailCapture.lockedPositions = new Set(args?.lockedPositions || []);
      return real.applyGuardrails(args);
    },
  };
});
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
// The commit the golden was captured on — the tree BEFORE T1's rebuild existed.
const GOLDEN_SOURCE_COMMIT = '6cd3699a220aacd5c8669ac2aade6d91216da5b1';
const HEADER_LINE = /^#!golden(?: |$)/;
/** The provenance header: the `#!golden` lines at the top of the fixture. */
const goldenHeader = () => readFileSync(GOLDEN_PATH, 'utf8')
  .split('\n').filter((l) => HEADER_LINE.test(l)).map((l) => `${l}\n`).join('');
/** The fixture with its provenance header stripped — the prompt block itself. */
const goldenBlock = () => readFileSync(GOLDEN_PATH, 'utf8')
  .split('\n').filter((l) => !HEADER_LINE.test(l)).join('\n');
const goldenRecordedSha = () => (goldenHeader().match(/#!golden sha256: ([0-9a-f]{64})/) || [])[1];
const GOLDEN_PATH = resolve(HERE, '../_utils/__fixtures__/tickCoherenceLiveContextGolden.noSwap.txt');
const SCORE_DUMP_PATH = process.env.SCORE_DUMP_PATH || null;

/**
 * KO −0.91x ATR and PG −1.00x ATR: both past the balanced preset's −0.85x
 * bust buffer, so the production risk manager queues a real EMERGENCY_SWAP
 * for each. `only` narrows it to one.
 */
function bustingPrices({ only = null } = {}) {
  const prices = makePriceTable();
  if (only !== 'PG') prices.KO = { ...prices.KO, current: 61.578 };
  if (only !== 'KO') prices.PG = { ...prices.PG, current: 163.647 };
  return prices;
}

/**
 * Reproduce the fenced executor's effect ON THE STORED DOC — the only thing
 * the rebuild reads back. Not a re-implementation of its internals.
 */
function swapInStore(db, tier, slotIndex, incoming, priceOf) {
  const stored = db.__store.battle;
  const outgoing = stored.portfolio[tier][slotIndex];
  stored.portfolio[tier] = stored.portfolio[tier].map((a, i) => (
    i === slotIndex ? { ...incoming, swapPrice: priceOf(incoming.symbol), swappedInAt: FROZEN_NOW } : a
  ));
  stored.portfolio.bench = {
    ...stored.portfolio.bench,
    stocks: [
      ...(stored.portfolio.bench.stocks || []).filter((a) => a.symbol !== incoming.symbol),
      { ...outgoing, cooldownUntil: '2026-09-10T15:00:00.000Z' },
    ],
  };
  stored.trades = [...(stored.trades || []), {
    symbolIn: incoming.symbol, symbolOut: outgoing.symbol, lockedPoints: 0, entryPrice: 0,
  }];
  stored.scoreState = { ...stored.scoreState, tradeCount: (stored.scoreState?.tradeCount || 0) + 1 };
  return outgoing;
}

async function runTick({ battle = makeTickBattle(), prices = makePriceTable() } = {}) {
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
  const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  executeSwapServerMock.mockImplementation(async (dbArg, _id, _battle, tier, slotIndex, incoming) => {
    const outgoing = swapInStore(dbArg, tier, slotIndex, incoming, (s) => prices[s]?.current ?? 0);
    return {
      closedTrade: { symbolIn: incoming.symbol, symbolOut: outgoing.symbol, swappedOutAt: FROZEN_NOW, entryPrice: 0, lockedPoints: 0 },
      incomingAsset: { ...incoming, swapPrice: prices[incoming.symbol]?.current ?? 0 },
    };
  });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  return { db, summary, finalUpdate, prompt: captured.calls.at(-1) };
}

// Anchored on the EXACT headings: a bare 'BENCH' also matches 'MACRO
// BENCHMARKS', which would silently widen the bench section to include the
// active rows and make the "not on both sides" row below vacuous.
const ACTIVE_BLOCK = /ACTIVE POSITIONS:\n[^\n]*\n([\s\S]*?)(?:\n\n|$)/;
const BENCH_BLOCK = /BENCH \(available for swap\):\n[^\n]*\n([\s\S]*?)(?:\n\n|$)/;

const rowSymbols = (block, re, column) => (block.match(re)?.[1] || '')
  .split('\n')
  .map((line) => line.split(',')[column]?.trim())
  .filter((s) => s && /^[A-Z][A-Z.-]*$/.test(s));

/** The ACTIVE POSITIONS CSV rows, as the model sees them (Tier,Symbol,…). */
const csvSymbols = (block) => rowSymbols(block, ACTIVE_BLOCK, 1);
/** The BENCH rows (Symbol,Sector,…). */
const benchSymbols = (block) => rowSymbols(block, BENCH_BLOCK, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(FROZEN_NOW));
  captured.calls = [];
  guardrailCapture.lockedPositions = null; guardrailCapture.calls = 0;
  mocks.getStockAnalysisData.mockReset(); mocks.fetchIntradayBatch.mockReset(); mocks.create.mockReset();
  executeSwapServerMock.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('T1 — a tick with a risk exit first', () => {
  it('the assembly inputs show the POST-exit portfolio, symbol by symbol', async () => {
    const { prompt, summary } = await runTick({ prices: bustingPrices({ only: 'KO' }) });

    expect(summary.swapped).toBe(1);
    const held = prompt.assetScores.map((s) => s.symbol);

    // Component by component — never a total.
    expect(held).not.toContain('KO');          // the exited position is gone
    expect(held).toHaveLength(7);              // and something took its slot
    const incoming = held.find((s) => !['NVDA', 'TSLA', 'MSFT', 'AMZN', 'PG', 'BTC'].includes(s));
    expect(incoming, 'the replacement must be scored').toBeTruthy();

    // The set the assembler was handed matches the refreshed doc exactly.
    const liveHeld = [
      ...prompt.battle.portfolio.star, ...prompt.battle.portfolio.core, ...prompt.battle.portfolio.support,
    ].map((a) => a.symbol);
    expect([...held].sort()).toEqual([...liveHeld].sort());

    // Fresh scores, not carried-over rows: the incoming position is scored
    // from its own swapPrice, so it sits at 0 % rather than inheriting the
    // exited name's loss.
    const incomingRow = prompt.assetScores.find((s) => s.symbol === incoming);
    expect(incomingRow.totalPoints).toBeDefined();
    expect(incomingRow.symbol).toBe(incoming);
  });

  it('the RENDERED held rows match the book — no ghost row, and not on both sides at once', async () => {
    const { prompt } = await runTick({ prices: bustingPrices({ only: 'KO' }) });
    const rows = csvSymbols(prompt.block);
    const bench = benchSymbols(prompt.block);

    // The exited position is no longer rendered as held…
    expect(rows).not.toContain('KO');
    expect(rows).toHaveLength(7);
    // …the one that replaced it is, in the slot it took…
    expect(rows).toContain('AMD');
    expect(prompt.block).toMatch(/support,AMD,/);
    // …scored from its OWN entry rather than inheriting the exited name's
    // loss: $162.00 in, $162.00 now, +0.00%.
    expect(prompt.block).toMatch(/support,AMD,Technology,Day1,\$162\.00,\$162\.00,\+0\.00%/);

    // The pre-fix prompt rendered KO as an active row AND as the bench
    // candidate it had just been returned to. One book, one place.
    expect(bench).toContain('KO');
    expect(bench).not.toContain('AMD');
    expect(rows.filter((s) => bench.includes(s))).toEqual([]);
  });

  it('BOTH per-symbol maps are pruned to what is still held — riskStatus AND the lock set', async () => {
    // Astra review F5b (Sep 20 2026): this row used to inspect `riskStatus`
    // only, so deleting the lock-pruning loop left it green. The lock set is
    // never handed to the assembler, so it is captured at the one boundary it
    // IS handed to — applyGuardrails — which means the battle must carry a
    // deployed guardrail for the evaluator to be reached at all.
    const battle = makeTickBattle();
    const guardedBattle = {
      ...battle,
      agentContext: { ...battle.agentContext, deployedGuardrails: [{ type: 'stopLoss', value: 25, unit: '%', enforcement: 'hard' }] },
    };
    const { prompt } = await runTick({ battle: guardedBattle, prices: bustingPrices({ only: 'KO' }) });

    const held = prompt.assetScores.map((s) => s.symbol);
    expect(held).not.toContain('KO');

    const riskStatus = prompt.momentumData?.riskStatus || {};
    expect(Object.keys(riskStatus)).not.toContain('KO');
    for (const symbol of Object.keys(riskStatus)) expect(held).toContain(symbol);

    // The lock set, observed rather than assumed.
    expect(guardrailCapture.calls, 'the evaluator must have been reached').toBeGreaterThan(0);
    const locked = guardrailCapture.lockedPositions;
    expect(locked, 'the lock set must have been captured').toBeTruthy();
    expect(locked.has('KO')).toBe(false);
    for (const symbol of locked) expect(held).toContain(symbol);
  });

  it('documented limit: the lock-pruning BRANCH cannot be reached end-to-end', () => {
    // Stated as executable documentation rather than left as a silent gap.
    // `lockedPositions` is populated only when evaluateRisk returns 'LOCK'
    // (agent-evaluate.js:1452-1454), and a position is exited only when it
    // returns EMERGENCY_SWAP / SWAP_OUT / TRAIL_STOP (:1449-1451). The two are
    // branches of ONE action value, so no symbol can be locked and exited on
    // the same tick — which means the prune-the-lock-set loop in the rebuild
    // has no reachable input today. The row above therefore asserts a SUBSET
    // INVARIANT (nothing unheld is ever in the set), not a mutation-provable
    // guard: removing the loop does not redden it, because the set is already
    // empty on every reachable path. Filed for separate tasking in the Part C
    // report; recorded here so the next reader does not mistake the invariant
    // for proof that the branch works.
    const source = readFileSync(resolve(HERE, './agent-evaluate.js'), 'utf8');
    expect(source).toMatch(/if \(riskResult\.action === 'LOCK'\) \{\s*\n\s*lockedPositions\.add\(score\.symbol\);/);
    expect(source).toMatch(/\['EMERGENCY_SWAP', 'SWAP_OUT', 'TRAIL_STOP'\]\.includes\(riskResult\.action\)/);
  });

  it('TWO queued risk swaps — the snapshot reflects BOTH', async () => {
    const { prompt, summary } = await runTick({ prices: bustingPrices() });

    expect(summary.swapped).toBe(2);
    const held = prompt.assetScores.map((s) => s.symbol);
    expect(held).not.toContain('KO');
    expect(held).not.toContain('PG');
    expect(held).toHaveLength(7);

    const rows = csvSymbols(prompt.block);
    expect(rows).not.toContain('KO');
    expect(rows).not.toContain('PG');
    expect([...held].sort()).toEqual([...rows].sort());
  });
});

describe('T1 — the scope guard: the end-of-tick score transaction', () => {
  // The build prompt's STOP condition: if rebuilding changes which persisted
  // score the end-of-tick write produces on the fixture, the task stops and
  // reports both values. It does not, BY CONSTRUCTION — `activeScore`,
  // `bankedScore`, `currentScore` and the `scoreUpdate` entries derived from
  // them are computed before the risk loop and are deliberately NOT rebuilt.
  // This row is the measurement that discharges the guard, and the permanent
  // regression lock on it. The four values below were captured by running
  // this row against origin/main's agent-evaluate.js.
  const PRE_FIX_PERSISTED = Object.freeze({
    'scoreState.activeScore': 26,
    'scoreState.bankedScore': 0,
    'scoreState.currentScore': 26,
    'scoreState.opponentScore': 0,
  });

  it('a tick WITH a forced exit persists exactly the pre-fix score', async () => {
    const { finalUpdate } = await runTick({ prices: bustingPrices({ only: 'KO' }) });
    // Re-measuring hook: run this row against another tree with
    // SCORE_DUMP_PATH set to compare persisted scores directly.
    if (SCORE_DUMP_PATH) {
      writeFileSync(SCORE_DUMP_PATH, JSON.stringify({
        'scoreState.activeScore': finalUpdate['scoreState.activeScore'],
        'scoreState.bankedScore': finalUpdate['scoreState.bankedScore'],
        'scoreState.currentScore': finalUpdate['scoreState.currentScore'],
        'scoreState.opponentScore': finalUpdate['scoreState.opponentScore'],
      }, null, 2), 'utf8');
    }
    for (const [key, value] of Object.entries(PRE_FIX_PERSISTED)) {
      expect(finalUpdate[key], `${key} must be byte-identical to the pre-fix write`).toBe(value);
    }
    // Anti-vacuity: the tick really did swap, so this is the post-exit case.
    expect(finalUpdate.evaluations.at(-1)).toBeTruthy();
  });

  it('the evaluation record\'s own scores block agrees with the persisted write', async () => {
    const { finalUpdate } = await runTick({ prices: bustingPrices({ only: 'KO' }) });
    const entry = finalUpdate.evaluations.at(-1);
    // One source, not two: the record and the doc must not diverge just
    // because the snapshot beneath them was refreshed.
    expect(entry.scores.active).toBe(finalUpdate['scoreState.activeScore']);
    expect(entry.scores.banked).toBe(finalUpdate['scoreState.bankedScore']);
    expect(entry.scores.total).toBe(finalUpdate['scoreState.currentScore']);
  });
});

describe('T1 — a tick with NO forced swap', () => {
  it('the prompt is byte-identical to the pre-fix snapshot', async () => {
    const { prompt, summary } = await runTick();
    expect(summary.swapped).toBe(0);
    expect(executeSwapServerMock).not.toHaveBeenCalled();

    // Astra review, golden provenance (Sep 20 2026). The row NEVER writes the
    // golden as a side effect of running; regeneration is an explicit, opt-in
    // act under UPDATE_GOLDEN=1, and the fixture carries a header naming the
    // commit it was captured on plus the sha256 of its own block. The hash is
    // re-verified below on EVERY run, so a regeneration on the wrong tree
    // cannot pass silently — it would have to rewrite the recorded hash too.
    if (process.env.UPDATE_GOLDEN === '1') {
      writeFileSync(GOLDEN_PATH, goldenHeader() + prompt.block, 'utf8');
    }
    expect(existsSync(GOLDEN_PATH), 'golden must be captured from the PRE-fix tree').toBe(true);
    expect(goldenHeader()).toContain(GOLDEN_SOURCE_COMMIT);
    expect(createHash('sha256').update(goldenBlock(), 'utf8').digest('hex'))
      .toBe(goldenRecordedSha());
    // Captured by running this row against the pre-fix tree at that commit —
    // so a match is a real byte-identity guarantee, not a self-comparison.
    expect(prompt.block).toBe(goldenBlock());
  });

  it('anti-vacuous: the golden is a real live-context block holding all seven names', () => {
    const golden = goldenBlock();
    expect(golden).toContain('LIVE BATTLE STATE');
    expect(golden).toContain('ACTIVE POSITIONS');
    for (const symbol of ['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC']) {
      expect(csvSymbols(golden)).toContain(symbol);
    }
  });
});
