// api/cron/agent-evaluate.swapIdentity.test.js
//
// Pilot P6 — the six callers of the swap identity check (G01; pilot spec §7;
// Phase 0 docs/audits/20261007_PHASE0_PILOT_P6_SWAP_IDENTITY.md §9.2 rows
// A8–A11), the conditional entry key, table F on the server's player text, and
// the three honest-record fixes that ship at every mode.
//
// THE EXECUTOR IS REAL. The fenced module is wrapped, never replaced: each call
// is recorded, a row may land a COMPETING COMMIT on the stored battle the
// instant before the executor's transaction reads it (the DCR-002 P02 shape:
// another executor call moved the slot after this caller formed its belief),
// and a row may substitute a throw for the call. Everything else runs the
// production executor against the harness store — so a refusal below is the
// executor's own typed refusal, not a stub's.
//
// The harness is the tick harness (tickStampsHarness + the calls and capture
// stores): the REAL processAgentBattle, the frozen clock, the seven-position
// book. Flags: the real set, with SWAP_IDENTITY_MODE driven per row, tick
// capture on, CALL_RECORDS_MODE pinned (off unless a row says otherwise).
//
// `executeSwapServer` never appears as a literal call here (the repo-level
// census in agent-evaluate.test.js).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW, SWAP_IDENTITY_ENTRY_KEYS,
  makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeSwapResult, makeToolUseResponse, deepClone,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCallsDb } from '../_utils/__fixtures__/callRecordsStore.js';
import { permanentDoc } from '../_utils/__fixtures__/tickCaptureHarness.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const flags = vi.hoisted(() => ({ swapIdentity: 'off', calls: 'off' }));
/** The executor wrapper's per-row behaviour (see the header). */
const exec = vi.hoisted(() => ({ calls: [], before: null, throws: null }));
/** A canned guardrail verdict for the suppression pass (the fenced evaluator wrapped, never edited). */
const guardrailHook = vi.hoisted(() => ({ result: null, throws: null }));
const carry = vi.hoisted(() => ({ calls: 0 }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => {
  const real = await importOriginal();
  const runReal = real.executeSwapServer; // aliased: the census reads a literal call as a consumer
  return {
    ...real,
    executeSwapServer: async (...args) => {
      exec.calls.push(args);
      if (exec.before) exec.before(args);
      if (exec.throws) throw exec.throws;
      return runReal(...args);
    },
  };
});
vi.mock('../_utils/agentGuardrails.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    applyGuardrails: (...args) => {
      if (guardrailHook.throws) throw guardrailHook.throws;
      if (guardrailHook.result) return deepClone(guardrailHook.result);
      return real.applyGuardrails(...args);
    },
  };
});
vi.mock('../_utils/callRecords/observe.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, carryExecutorResult: (...args) => { carry.calls += 1; return real.carryExecutorResult(...args); } };
});
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
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    TICK_CAPTURE_ENABLED: true,
    PROFIT_TARGET_EXECUTOR_ENABLED: true,
    get CALL_RECORDS_MODE() { return flags.calls; },
    get SWAP_IDENTITY_MODE() { return flags.swapIdentity; },
  };
});

const { processAgentBattle } = await import('./agent-evaluate.js');
const { SwapRefusalError } = await import('../_utils/agentSwapExecution.js');
const { REFUSAL_LINES } = await import('../_utils/swapIdentity.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const CRON_SOURCE = readFileSync(resolve(HERE, 'agent-evaluate.js'), 'utf8');
const BATTLE_ID = 'battle-tick-1';

/** The position that took support[0] in the competing commit. */
const XOM = Object.freeze({ symbol: 'XOM', name: 'Exxon', baseATR: 1.4, isCrypto: false, sector: 'Energy', swapPrice: 112, swappedInAt: '2026-09-09T14:50:00.000Z', swappedInDay: 1 });
/** The competing commit: another executor call replaced KO in support[0] with XOM. */
const moveKoSlot = (args) => {
  const stored = args[0].__store.battle;
  if (stored.portfolio.support[0]?.symbol === 'KO') stored.portfolio.support = [{ ...XOM }, ...stored.portfolio.support.slice(1)];
};
const once = (fn) => { let done = false; return (args) => { if (!done) { done = true; fn(args); } }; };

/** Both risk-stop candidates busted (the tickCoherence precedent) → two forced exits, KO first. */
function bustingPrices() {
  const prices = makePriceTable();
  prices.KO = { ...prices.KO, current: 61.578 };
  prices.PG = { ...prices.PG, current: 163.647 };
  return prices;
}

const APPROVED_PROPOSAL = (overrides = {}) => ({
  proposalId: 'prop_001', evalId: 'eval_prev', symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0,
  conviction: 80, rationale: 'rotate', hypothesis: 'AMD leads', mode: 'copilot',
  createdAt: '2026-09-09T14:40:00.000Z', expiresAt: '2026-09-09T14:50:00.000Z',
  resolvedAt: '2026-09-09T14:45:00.000Z', resolution: 'approved', resolvedBy: 'owner-uid-1',
  snapshot: null,
  evaluationMetadata: { id: 'trade_001', action: 'SWAP', evaluationId: 'eval_prev', tradingDay: 1, exitReason: 'haiku_decision' },
  outgoingSwappedInAt: null, // KO is a creation-time position
  ...overrides,
});
const EXPIRED_PROPOSAL = (overrides = {}) => APPROVED_PROPOSAL({ resolvedAt: null, resolution: null, resolvedBy: null, ...overrides });

async function runTick({ battle = makeTickBattle(), result = makeHoldResult(), prices = makePriceTable(), mutateStore = null } = {}) {
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(result));
  const db = makeCallsDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  if (mutateStore) mutateStore(db.__store.battle);
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  let thrown = null;
  try {
    await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  } catch (err) { thrown = err; }
  const finalUpdate = [...db.__updates].reverse().find((u) => Array.isArray(u.evaluations)) || null;
  const feedUpdate = [...db.__updates].reverse().find((u) => Array.isArray(u.statusFeed)) || null;
  const seq = db.__updates[0]?.['cronState.tickSeq'] ?? 1;
  return {
    db, summary, thrown, finalUpdate,
    entry: finalUpdate ? finalUpdate.evaluations.at(-1) : null,
    feed: feedUpdate?.statusFeed || [],
    stored: db.__store.battle,
    permanent: permanentDoc(db, BATTLE_ID, `${BATTLE_ID}:${seq}`),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  flags.swapIdentity = 'off';
  flags.calls = 'off';
  exec.calls = [];
  exec.before = null;
  exec.throws = null;
  guardrailHook.result = null;
  guardrailHook.throws = null;
  carry.calls = 0;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const tradeOf = (stored, symbolIn) => (stored.trades || []).find((t) => t.symbolIn === symbolIn) || null;
const PROTECTIVE_KO = 'Protection was set to sell KO, but KO had already left that slot. No trade was made.';
const AGENT_KO_AMD = 'The agent tried to swap KO for AMD, but KO had already left that slot. No trade was made.';

// ─────────────────────────────────────────────────────────────────────────────
describe('the belief each caller hands the executor (Phase 0 §4.4)', () => {
  it('off: every call keeps exactly its pre-P6 arguments — no options object reaches the executor', async () => {
    await runTick({ prices: bustingPrices(), result: makeSwapResult({ symbolOut: 'MSFT', tier: 'core' }) });
    expect(exec.calls.length).toBeGreaterThanOrEqual(2);
    for (const args of exec.calls) expect(args).toHaveLength(10);
  });

  it('shadow: the risk exits pass {symbol, swappedInAt ?? null} of the position they resolved, and the mode', async () => {
    flags.swapIdentity = 'shadow';
    const { stored } = await runTick({ prices: bustingPrices() });
    expect(exec.calls.map((a) => a.length)).toEqual([11, 11]);
    expect(exec.calls.map((a) => a[10])).toEqual([
      { identityMode: 'shadow', expectedOut: { symbol: 'KO', swappedInAt: null } },
      { identityMode: 'shadow', expectedOut: { symbol: 'PG', swappedInAt: null } },
    ]);
    // …and each committed row carries the executor's verdict on that belief.
    expect(['AMD', 'JPM'].map((s) => tradeOf(stored, s)?.verification?.verdict)).toEqual(['match', 'match']);
  });

  it('shadow: the model swap passes the position validateTradeDecision resolved — with its entry instant when it has one', async () => {
    flags.swapIdentity = 'shadow';
    const battle = makeTickBattle();
    battle.portfolio.support[0] = { ...battle.portfolio.support[0], swapPrice: 62.2, swappedInAt: '2026-09-09T14:05:00.000Z' };
    const { stored } = await runTick({ battle, result: makeSwapResult() });
    expect(exec.calls).toHaveLength(1);
    expect(exec.calls[0][10]).toEqual({ identityMode: 'shadow', expectedOut: { symbol: 'KO', swappedInAt: '2026-09-09T14:05:00.000Z' } });
    expect(tradeOf(stored, 'AMD').verification).toMatchObject({ verdict: 'match', basis: 'symbol_and_entry' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('A8 / C1 — the risk route: a refused protective exit HOLDS, never re-resolves', () => {
  it('enforce: KO left the slot → typed refusal; table F protective line + reason on the beat; the new occupant is NOT sold; the loop continues', async () => {
    flags.swapIdentity = 'enforce';
    exec.before = once(moveKoSlot);
    const { feed, stored, thrown } = await runTick({ prices: bustingPrices() });
    expect(thrown).toBeNull();
    const beat = feed.find((e) => e.action === 'risk_swap_failed');
    expect(beat).toMatchObject({
      message: PROTECTIVE_KO,
      refusalReason: 'outgoing_identity_mismatch',
      verificationId: expect.stringMatching(/^battle-tick-1:risk_\w+_KO_\d+:verify$/),
      symbolOut: 'KO', source: 'risk_manager',
    });
    // XOM still holds support[0]: no call ever named it; the slot got ONE call this tick.
    expect(stored.portfolio.support[0].symbol).toBe('XOM');
    expect(exec.calls.filter((a) => a[3] === 'support' && a[4] === 0)).toHaveLength(1);
    expect(stored.trades.some((t) => t.symbolOut === 'XOM')).toBe(false);
    // The loop went on: PG's exit committed after KO's refusal.
    expect(stored.trades.map((t) => t.symbolOut)).toEqual(['PG']);
  });

  it('a non-typed failure keeps today\'s beat exactly — no refusal fields', async () => {
    flags.swapIdentity = 'enforce';
    exec.throws = new Error('Cannot complete swap: no valid price for AMD');
    const { feed } = await runTick({ prices: bustingPrices() });
    const beat = feed.find((e) => e.action === 'risk_swap_failed');
    expect(beat.message).toBe('Risk exit of KO failed: Cannot complete swap: no valid price for AMD');
    expect(beat).not.toHaveProperty('refusalReason');
  });

  it('off: even a typed error (impossible from the executor at off) renders today\'s beat — the mode gates every record', async () => {
    exec.throws = new SwapRefusalError('outgoing_identity_mismatch', { verificationId: 'v', expected: { symbol: 'KO' } }, 'Swap refused (outgoing_identity_mismatch): x');
    const { feed } = await runTick({ prices: bustingPrices() });
    const beat = feed.find((e) => e.action === 'risk_swap_failed');
    expect(beat.message).toBe('Risk exit of KO failed: Swap refused (outgoing_identity_mismatch): x');
    expect(Object.keys(beat)).not.toContain('refusalReason');
    expect(Object.keys(beat)).not.toContain('verificationId');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('A8 / C2 — the model route: HOLD, downgraded, the prefix kept, the typed reason on the entry and in capture', () => {
  it('enforce: the slot moved under the model\'s swap → a typed refusal recorded on every channel', async () => {
    flags.swapIdentity = 'enforce';
    exec.before = once(moveKoSlot);
    const { entry, permanent, stored } = await runTick({ result: makeSwapResult() });
    expect(entry.decision).toBe('HOLD');
    expect(entry.downgraded).toBe(true);
    expect(entry.holdKind).toBeNull();
    expect(entry.validationErrors).toEqual(['Swap execution failed: Swap refused (outgoing_identity_mismatch): expected KO in support[0], found XOM']);
    expect(entry.executionRefusal).toEqual({
      reason: 'outgoing_identity_mismatch',
      verificationId: `${BATTLE_ID}:${entry.evalId}:verify`,
      verification: expect.objectContaining({
        mode: 'enforce', verdict: 'mismatch', basis: 'symbol_and_entry',
        expected: { symbol: 'KO', swappedInAt: null }, found: { symbol: 'XOM', swappedInAt: XOM.swappedInAt },
        battleStatus: 'active', slot: { tier: 'support', slotIndex: 0 },
      }),
      line: AGENT_KO_AMD,
    });
    // The conditional key rides LAST (after every unconditional key and any stamp).
    expect(Object.keys(entry).at(-1)).toBe(SWAP_IDENTITY_ENTRY_KEYS[0]);
    expect(permanent.checks.execution).toMatchObject({ status: 'evaluated', result: 'blocked', reason: 'outgoing_identity_mismatch', symbolOut: 'KO', symbolIn: 'AMD' });
    expect(permanent.actions).toEqual([]);
    expect(stored.trades).toEqual([]);
    expect(stored.portfolio.support[0].symbol).toBe('XOM');
  });

  it('shadow: no refusal → `executionRefusal: null` on the entry; the swap commits as today', async () => {
    flags.swapIdentity = 'shadow';
    const { entry, stored } = await runTick({ result: makeSwapResult() });
    expect(entry.decision).toBe('SWAP');
    expect(entry).toHaveProperty('executionRefusal', null);
    expect(tradeOf(stored, 'AMD').verification).toMatchObject({ mode: 'shadow', verdict: 'match' });
  });

  it('off: the key is ABSENT; a non-typed failure keeps `failed` in capture', async () => {
    exec.throws = new Error('Asset no longer available in slot');
    const { entry, permanent } = await runTick({ result: makeSwapResult() });
    expect(entry).not.toHaveProperty('executionRefusal');
    expect(permanent.checks.execution).toMatchObject({ status: 'failed', result: null, reason: null });
  });

  it('off: a typed error still files as `failed` with no key (the mode gates the record)', async () => {
    exec.throws = new SwapRefusalError('outgoing_identity_mismatch', { verificationId: 'v', expected: { symbol: 'KO' } }, 'Swap refused (outgoing_identity_mismatch): x');
    const { entry, permanent } = await runTick({ result: makeSwapResult() });
    expect(entry).not.toHaveProperty('executionRefusal');
    expect(permanent.checks.execution.status).toBe('failed');
  });

  it('calls shadow: a refused swap carries NO executor result to the cockpit (never `acted`); a committed one does', async () => {
    flags.calls = 'shadow';
    flags.swapIdentity = 'enforce';
    exec.before = once(moveKoSlot);
    await runTick({ result: makeSwapResult() });
    expect(carry.calls).toBe(0);
    exec.before = null;
    exec.calls = [];
    await runTick({ result: makeSwapResult() });
    expect(carry.calls).toBe(1);
  });

  it('calls shadow + identity on: the entry ends `…, declarationsPhase, executionRefusal` — both conditional keys, the calls key first', async () => {
    flags.calls = 'shadow';
    flags.swapIdentity = 'shadow';
    const { entry } = await runTick({ result: makeSwapResult() });
    expect(Object.keys(entry).slice(-2)).toEqual(['declarationsPhase', ...SWAP_IDENTITY_ENTRY_KEYS]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('A8 / C3 — an approved proposal executed on a later tick', () => {
  const copilot = (proposal) => makeTickBattle({ executionMode: 'copilot', pendingProposal: proposal });

  it('enforce: the stored belief (KO, creation-time) no longer holds the slot → refused; the history row carries the typed refusal', async () => {
    flags.swapIdentity = 'enforce';
    exec.before = once(moveKoSlot);
    const { stored, feed } = await runTick({ battle: copilot(APPROVED_PROPOSAL()) });
    expect(exec.calls[0][10]).toEqual({ identityMode: 'enforce', expectedOut: { symbol: 'KO', swappedInAt: null } });
    const row = stored.proposalHistory.at(-1);
    expect(row).toMatchObject({ proposalId: 'prop_001', resolution: 'approved', executionFailed: true });
    expect(row.executionRefusal).toMatchObject({
      reason: 'outgoing_identity_mismatch', verificationId: `${BATTLE_ID}:eval_prev:verify`, line: AGENT_KO_AMD,
      verification: { basis: 'symbol_and_entry', verdict: 'mismatch', found: { symbol: 'XOM' } },
    });
    expect(stored.pendingProposal).toBeNull();
    expect(feed.find((e) => e.source === 'proposal_system')).toMatchObject({ message: AGENT_KO_AMD, refusalReason: 'outgoing_identity_mismatch', action: 'hold' });
    expect(stored.trades).toEqual([]);
  });

  it('a legacy proposal (no stored identity) is checked by symbol only, and its verification says so', async () => {
    flags.swapIdentity = 'shadow';
    const legacy = APPROVED_PROPOSAL();
    delete legacy.outgoingSwappedInAt;
    const { stored } = await runTick({ battle: copilot(legacy) });
    expect(exec.calls[0][10].expectedOut).toEqual({ symbol: 'KO' });
    expect(tradeOf(stored, 'AMD').verification).toMatchObject({ basis: 'symbol_only', verdict: 'match', expected: { symbol: 'KO', swappedInAt: null } });
  });

  it('HONEST RECORD (every mode — here off): an approval whose execution threw is marked, never a bare `approved`', async () => {
    exec.throws = new Error('Asset no longer available in slot');
    const { stored, feed } = await runTick({ battle: copilot(APPROVED_PROPOSAL()) });
    const row = stored.proposalHistory.at(-1);
    expect(row.resolution).toBe('approved');
    expect(row.executionFailed).toBe(true);
    expect(row).not.toHaveProperty('executionRefusal');
    // The beat is today's, word for word.
    const beat = feed.find((e) => e.source === 'proposal_system');
    expect(beat).toEqual({ timestamp: FROZEN_NOW, message: 'Approved swap failed: Asset no longer available in slot', action: 'hold', source: 'proposal_system' });
  });

  it('a successful approval is filed exactly as before (no marker)', async () => {
    const { stored } = await runTick({ battle: copilot(APPROVED_PROPOSAL()) });
    const row = stored.proposalHistory.at(-1);
    expect(row).not.toHaveProperty('executionFailed');
    expect(row).toEqual(APPROVED_PROPOSAL());
    expect(tradeOf(stored, 'AMD')).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('A8 / C4 — a co-pilot proposal auto-executed at expiry', () => {
  const expired = (overrides) => makeTickBattle({ executionMode: 'copilot', pendingProposal: EXPIRED_PROPOSAL(overrides) });

  it('enforce: refused on the stored belief; the history row is NOT `auto_executed` and carries the refusal', async () => {
    flags.swapIdentity = 'enforce';
    exec.before = once(moveKoSlot);
    const { stored } = await runTick({ battle: expired() });
    const row = stored.proposalHistory.at(-1);
    expect(row.resolution).toBe('auto_execution_failed');
    expect(row.executionFailed).toBe(true);
    expect(row.executionRefusal).toMatchObject({ reason: 'outgoing_identity_mismatch', line: AGENT_KO_AMD });
    expect(stored.trades).toEqual([]);
  });

  it('HONEST RECORD (every mode — here off): a failed auto-execution is never filed `auto_executed`', async () => {
    exec.throws = new Error('Asset no longer available in slot');
    const { stored } = await runTick({ battle: expired() });
    const row = stored.proposalHistory.at(-1);
    expect(row.resolution).toBe('auto_execution_failed');
    expect(row.executionFailed).toBe(true);
    expect(row).not.toHaveProperty('executionRefusal');
  });

  it('a successful auto-execution is still `auto_executed`, with no marker', async () => {
    const { stored } = await runTick({ battle: expired() });
    const row = stored.proposalHistory.at(-1);
    expect(row.resolution).toBe('auto_executed');
    expect(row).not.toHaveProperty('executionFailed');
    expect(tradeOf(stored, 'AMD')).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('A8 / C5 — the suppression pass (a pending meeting, a guardrail-forced exit)', () => {
  const pending = () => makeTickBattle({
    gameplanMeeting: { status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T23:00:00.000Z', suggestedSwaps: [] },
    agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [{ type: 'stopLoss', value: 1, unit: '%', enforcement: 'hard' }] },
  });
  const FORCED = { decision: 'SWAP', symbolOut: 'KO', symbolIn: 'AMD', sourceNote: 'guardrail_stopLoss', statusMessage: 'Stop hit on KO.', overrides: [] };

  it('enforce: refused → capture `evaluated / blocked` with the reason; NOT a guardrail fault; the beat is table F protective', async () => {
    flags.swapIdentity = 'enforce';
    guardrailHook.result = FORCED;
    exec.before = once(moveKoSlot);
    const { permanent, feed, stored } = await runTick({ battle: pending() });
    expect(exec.calls).toHaveLength(1);
    expect(permanent.exitReason).toBe('gameplan_pending');
    expect(permanent.checks.execution).toMatchObject({ status: 'evaluated', result: 'blocked', reason: 'outgoing_identity_mismatch', stage: 'gameplan_handled', symbolOut: 'KO', symbolIn: 'AMD' });
    expect(permanent.guardrail.faultClass).toBeNull();
    expect(permanent.guardrail.suppressionPassFaulted).toBe(false);
    expect(feed.find((e) => e.action === 'risk_swap_failed')).toMatchObject({ message: PROTECTIVE_KO, refusalReason: 'outgoing_identity_mismatch', source: 'guardrail' });
    expect(stored.portfolio.support[0].symbol).toBe('XOM');
  });

  it('HONEST RECORD (every mode — here off): an executor refusal is no longer filed as `guardrail_error`', async () => {
    guardrailHook.result = FORCED;
    exec.throws = new Error('Asset no longer available in slot');
    const { permanent, feed } = await runTick({ battle: pending() });
    expect(permanent.guardrail.faultClass).toBeNull();
    expect(permanent.guardrail.suppressionPassFaulted).toBe(false);
    expect(permanent.guardrail.suppressionPassRan).toBe(true);
    expect(permanent.checks.execution).toMatchObject({ status: 'failed', result: null, reason: null, stage: 'gameplan_handled' });
    // The beat is today's.
    const beat = feed.find((e) => e.action === 'risk_swap_failed');
    expect(beat.message).toBe('Guardrail exit failed during gameplan suppression: Asset no longer available in slot');
    expect(beat).not.toHaveProperty('refusalReason');
  });

  it('the pass\'s OWN fault (the evaluator throws) is still `guardrail_error` — and the execution check is untouched', async () => {
    guardrailHook.throws = new Error('evaluator exploded');
    const { permanent } = await runTick({ battle: pending() });
    expect(permanent.guardrail.faultClass).toBe('guardrail_error');
    expect(permanent.guardrail.suppressionPassFaulted).toBe(true);
    expect(permanent.checks.execution.status).toBe('not_evaluated');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('A8 / C6 — an approved meeting with a departed leg and a returned leg', () => {
  const KO_NOW = '2026-09-09T14:40:00.000Z';   // KO's current entry instant (it left and came back)
  const KO_THEN = '2026-09-09T13:45:00.000Z';  // the instant the meeting stored for KO
  const meetingBattle = () => {
    const b = makeTickBattle({
      gameplanMeeting: {
        id: 'gpm_1', status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z',
        suggestedSwaps: [
          { symbolOut: 'INTC', symbolIn: 'JPM', rationale: 'INTC lagging', swappedInAt: null }, // INTC is no longer held
          { symbolOut: 'KO', symbolIn: 'AMD', rationale: 'KO lagging', swappedInAt: KO_THEN },
        ],
      },
    });
    b.portfolio.support[0] = { ...b.portfolio.support[0], swapPrice: 62.2, swappedInAt: KO_NOW };
    return b;
  };

  it('enforce: the departed leg is recorded (no executor call), the returned leg is refused by the executor; nothing trades', async () => {
    flags.swapIdentity = 'enforce';
    const { stored } = await runTick({ battle: meetingBattle() });
    expect(exec.calls).toHaveLength(1);
    expect(exec.calls[0]).toHaveLength(11);
    expect(exec.calls[0][9]).toBeNull(); // the padded snapshot
    expect(exec.calls[0][10]).toEqual({ identityMode: 'enforce', expectedOut: { symbol: 'KO', swappedInAt: KO_THEN } });
    const row = stored.gameplanMeetingHistory.at(-1);
    expect(row.legRefusals).toEqual([
      {
        symbolOut: 'INTC', symbolIn: 'JPM', reason: 'outgoing_identity_mismatch', verificationId: null, verification: null,
        line: 'The agent tried to swap INTC for JPM, but INTC had already left that slot. No trade was made.',
      },
      expect.objectContaining({
        symbolOut: 'KO', symbolIn: 'AMD', reason: 'outgoing_identity_mismatch', line: AGENT_KO_AMD,
        verification: expect.objectContaining({ verdict: 'mismatch', expected: { symbol: 'KO', swappedInAt: KO_THEN }, found: { symbol: 'KO', swappedInAt: KO_NOW } }),
      }),
    ]);
    expect(stored.trades).toEqual([]);
    expect(stored.gameplanMeeting).toBeNull();
  });

  it('shadow: the departed leg is recorded; the returned leg trades as today and its row says mismatch', async () => {
    flags.swapIdentity = 'shadow';
    const { stored } = await runTick({ battle: meetingBattle() });
    const row = stored.gameplanMeetingHistory.at(-1);
    expect(row.legRefusals.map((r) => r.symbolOut)).toEqual(['INTC']);
    expect(tradeOf(stored, 'AMD').verification).toMatchObject({ verdict: 'mismatch', basis: 'symbol_and_entry' });
  });

  it('off: the departed leg is skipped silently and the returned leg trades — the history row is the meeting, unchanged', async () => {
    const battle = meetingBattle();
    const meeting = deepClone(battle.gameplanMeeting); // the tick refreshes `battle` in place
    const { stored } = await runTick({ battle });
    expect(exec.calls).toHaveLength(1);
    expect(exec.calls[0]).toHaveLength(9);
    expect(stored.gameplanMeetingHistory.at(-1)).toEqual(meeting);
    expect(tradeOf(stored, 'AMD')).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('A9 — a duplicated approval: the same approved proposal processed twice', () => {
  // Two shapes. A replay on a FRESH read never reaches the executor: the
  // handler re-resolves the incoming symbol on the bench first, and AMD left
  // the bench when the first run committed — the bench-gone lapse holds it at
  // every mode (unchanged by P6). The replay that DOES reach the executor is a
  // second worker holding a snapshot taken BEFORE the first run committed (an
  // overlapping invocation after the lock ages out, Phase 0 §3.1): its stale
  // book still shows KO in the slot and AMD on the bench, while the live slot
  // already holds AMD.
  const approved = () => makeTickBattle({ executionMode: 'copilot', pendingProposal: APPROVED_PROPOSAL() });
  /** Run tick 2 on a STALE in-memory battle (the pre-tick-1 snapshot) against the store tick 1 committed. */
  async function staleReplay(first) {
    exec.calls = [];
    return runTick({ battle: approved(), mutateStore: (s) => { for (const k of Object.keys(s)) delete s[k]; Object.assign(s, deepClone(first.stored)); } });
  }

  it('a replay on a fresh read lapses on the bench check before any executor call (every mode)', async () => {
    flags.swapIdentity = 'enforce';
    const first = await runTick({ battle: approved() });
    expect(tradeOf(first.stored, 'AMD')).not.toBeNull();
    exec.calls = [];
    const second = await runTick({ battle: { ...deepClone(first.stored), pendingProposal: APPROVED_PROPOSAL() } });
    expect(exec.calls).toHaveLength(0);
    expect(second.feed.findLast((e) => e.source === 'proposal_system').message).toMatch(/bench asset no longer available/);
  });

  it('enforce: the stale worker\'s replay is refused BY IDENTITY (the slot now holds the incoming symbol), not by the self-swap check', async () => {
    flags.swapIdentity = 'enforce';
    const first = await runTick({ battle: approved() });
    const second = await staleReplay(first);
    expect(exec.calls).toHaveLength(1);
    const row = second.stored.proposalHistory.at(-1);
    expect(row.executionFailed).toBe(true);
    expect(row.executionRefusal).toMatchObject({ reason: 'outgoing_identity_mismatch', verification: { expected: { symbol: 'KO', swappedInAt: null }, found: { symbol: 'AMD' } } });
    expect(second.stored.trades).toHaveLength(1); // the first run's trade only
    expect(second.stored.portfolio.support[0].symbol).toBe('AMD');
  });

  it('off (today): the same replay fails on the self-swap invariant — and the honest record still marks it', async () => {
    const first = await runTick({ battle: approved() });
    const second = await staleReplay(first);
    expect(exec.calls).toHaveLength(1);
    const beat = second.feed.findLast((e) => e.source === 'proposal_system'); // the feed carries tick 1's beats first
    expect(beat.message).toBe('Approved swap failed: Invalid swap: AMD cannot replace itself');
    expect(second.stored.proposalHistory.at(-1).executionFailed).toBe(true);
    expect(second.stored.trades).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('A10 — shadow changes no behaviour: a full tick writes what off writes, plus the verification and the entry key', () => {
  const strip = (updates) => JSON.parse(JSON.stringify(updates), (key, value) => {
    if (key === 'verification' || key === 'executionRefusal') return undefined;
    return value;
  });

  for (const [label, args] of [
    ['two risk exits, then a model HOLD', () => ({ prices: bustingPrices() })],
    ['a model SWAP', () => ({ result: makeSwapResult() })],
    ['a HOLD', () => ({})],
  ]) {
    it(label, async () => {
      const off = await runTick(args());
      const offUpdates = deepClone(off.db.__updates);
      const offCapture = deepClone(off.db.__captureWrites);
      exec.calls = [];
      flags.swapIdentity = 'shadow';
      const shadow = await runTick(args());
      expect(JSON.stringify(strip(shadow.db.__updates))).toBe(JSON.stringify(offUpdates));
      expect(JSON.stringify(shadow.db.__captureWrites)).toBe(JSON.stringify(offCapture));
      // …and the difference is exactly those keys: one verification per committed trade, the key on the entry.
      const shadowJson = JSON.stringify(shadow.db.__updates);
      expect(JSON.stringify(offUpdates)).not.toMatch(/verification|executionRefusal/);
      expect(shadow.entry).toHaveProperty('executionRefusal', null);
      expect(shadow.stored.trades).toHaveLength(off.stored.trades.length);
      for (const trade of shadow.stored.trades) expect(trade.verification).toMatchObject({ mode: 'shadow', verdict: 'match' });
      expect((shadowJson.match(/"verdict":"match"/g) || []).length).toBeGreaterThanOrEqual(shadow.stored.trades.length);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('A11 — the creation sites store the identity (mode ≠ off only)', () => {
  const creating = () => makeTickBattle({ cronState: { ...makeTickBattle().cronState, lastGameplanDate: null } });

  it('shadow: each meeting leg stores its outgoing position\'s entry instant (null for a creation-time position)', async () => {
    flags.swapIdentity = 'shadow';
    const battle = creating();
    battle.portfolio.star[1] = { ...battle.portfolio.star[1], swapPrice: 251, swappedInAt: '2026-09-09T14:10:00.000Z' }; // TSLA swapped in
    const { db } = await runTick({ battle });
    const meeting = db.__updates.find((u) => u.gameplanMeeting)?.gameplanMeeting;
    expect(meeting?.suggestedSwaps?.length).toBeGreaterThan(0);
    for (const leg of meeting.suggestedSwaps) {
      expect(Object.hasOwn(leg, 'swappedInAt')).toBe(true);
      const held = [...battle.portfolio.star, ...battle.portfolio.core, ...battle.portfolio.support].find((a) => a.symbol === leg.symbolOut);
      expect(leg.swappedInAt).toBe(held.swappedInAt ?? null);
    }
  });

  it('off: no leg carries the key (the meeting is byte-identical to today)', async () => {
    const { db } = await runTick({ battle: creating() });
    const meeting = db.__updates.find((u) => u.gameplanMeeting)?.gameplanMeeting;
    expect(meeting?.suggestedSwaps?.length).toBeGreaterThan(0);
    for (const leg of meeting.suggestedSwaps) expect(Object.keys(leg)).toEqual(['symbolOut', 'symbolIn', 'rationale']);
  });

  it('the proposal-creation site (unreachable under the launch guard) stores `outgoingSwappedInAt` from the resolved position, at mode ≠ off only', () => {
    const literal = CRON_SOURCE.slice(CRON_SOURCE.indexOf('pendingProposalUpdate = {'), CRON_SOURCE.indexOf("decision = 'PROPOSAL';"));
    expect(literal).toMatch(/\.\.\.\(swapIdentityActive\(swapIdentityMode\)\s*\?\s*\{ outgoingSwappedInAt: storedIdentityOf\(battle\.portfolio\?\.\[validation\.resolvedTier\]\?\.\[validation\.resolvedSlotIndex\]\) \}\s*:\s*\{\}\)/);
    // The launch guard that makes it unreachable today is still in place (D6: removal belongs to the authority arc).
    expect(CRON_SOURCE).toMatch(/if \(mode !== 'autopilot'\) \{[\s\S]{0,200}mode = 'autopilot';/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('one resolution per check', () => {
  it('the cron reads the flag through ONE call, never the constant itself', () => {
    const code = CRON_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    expect(code.match(/currentSwapIdentityMode\(\)/g)).toHaveLength(1);
    expect(code).not.toMatch(/\bSWAP_IDENTITY_MODE\b/);
  });

  it('a mode flipped mid-check does not split the check: every call of one tick carries the mode it started with', async () => {
    flags.swapIdentity = 'shadow';
    exec.before = () => { flags.swapIdentity = 'enforce'; };
    const { stored } = await runTick({ prices: bustingPrices() });
    expect(exec.calls.map((a) => a[10]?.identityMode)).toEqual(['shadow', 'shadow']);
    expect(stored.trades.map((t) => t.verification.mode)).toEqual(['shadow', 'shadow']);
  });

  it('the table F lines the server writes are the module\'s constants', () => {
    expect(PROTECTIVE_KO).toBe(REFUSAL_LINES.outgoing_identity_mismatch.protective.replaceAll('[SYM]', 'KO'));
    expect(AGENT_KO_AMD).toBe(REFUSAL_LINES.outgoing_identity_mismatch.agent.replaceAll('[SYM2]', 'AMD').replaceAll('[SYM]', 'KO'));
  });
});
