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
  makeHoldResult, makeSwapResult, makeToolUseResponse, deepClone, serverMeetingOverrides,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCallsDb } from '../_utils/__fixtures__/callRecordsStore.js';
import { permanentDoc } from '../_utils/__fixtures__/tickCaptureHarness.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const flags = vi.hoisted(() => ({ swapIdentity: 'off', calls: 'off' }));
/** The executor wrapper's per-row behaviour (see the header). */
const exec = vi.hoisted(() => ({ calls: [], before: null, throws: null, committed: 0 }));
/** A canned guardrail verdict for the suppression pass (the fenced evaluator wrapped, never edited). */
const guardrailHook = vi.hoisted(() => ({ result: null, throws: null }));
const carry = vi.hoisted(() => ({ calls: 0 }));
/** Forces an archetype STAGNATION verdict for the named held symbols; the real evaluator runs otherwise. */
const riskHook = vi.hoisted(() => ({ stagnant: [] }));
/**
 * Integrity build F1: both launch guards read the server-owned launch mode
 * (api/_utils/executionAuthority.js), never the battle's owner-writable
 * executionMode. The rows here that build a co-pilot battle exist to drive the
 * DORMANT proposal paths (C3/C4), so runTick mocks the launch mode to 'copilot'
 * for exactly those battles; every other row runs at the launch mode.
 */
const authority = vi.hoisted(() => ({ mode: 'autopilot' }));

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
      const out = await runReal(...args);
      exec.committed += 1;
      return out;
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
vi.mock('../_utils/agentRiskManager.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    evaluateRisk: (position, ...rest) => (
      riskHook.stagnant.includes(position?.symbol)
        ? { action: 'SWAP_OUT', reason: 'stagnation', source: 'archetype', detail: `${position.symbol} stagnant (test)` }
        : real.evaluateRisk(position, ...rest)
    ),
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
vi.mock('../_utils/executionAuthority.js', () => ({ get LAUNCH_EXECUTION_MODE() { return authority.mode; } }));
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

async function runTick({ battle = makeTickBattle(), result = makeHoldResult(), prices = makePriceTable(), mutateStore = null, throwReadsAfterCommit = false } = {}) {
  authority.mode = battle.executionMode === 'copilot' ? 'copilot' : 'autopilot'; // the dormant-path mock (header)
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(result));
  const db = makeCallsDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  if (mutateStore) mutateStore(db.__store.battle);
  if (throwReadsAfterCommit) {
    // Once a swap has committed, every read of the battle doc throws (a
    // refresh that fails AFTER the trade landed — review S4-8).
    const baseCollection = db.collection.bind(db);
    db.collection = (col) => {
      const c = baseCollection(col);
      if (col !== 'agentBattles') return c;
      return {
        ...c,
        doc: (id) => {
          const ref = c.doc(id);
          return { ...ref, get: async () => { if (exec.committed > 0) throw new Error('battle read failed (injected)'); return ref.get(); } };
        },
      };
    };
  }
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
  exec.committed = 0;
  guardrailHook.result = null;
  guardrailHook.throws = null;
  carry.calls = 0;
  riskHook.stagnant = [];
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
    // Integrity F2: the evaluation id (and so the verification id) comes from the
    // server's own log — the entry that decided this proposal, as the creation
    // tick wrote it. A proposal the log does not hold gets null (proposalForgery suite).
    const deciding = { evalId: 'eval_prev', timestamp: '2026-09-09T14:40:00.000Z', decision: 'PROPOSAL', symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', rationale: 'rotate', hypothesis: 'AMD leads' };
    const { stored, feed } = await runTick({ battle: { ...copilot(APPROVED_PROPOSAL()), evaluations: [deciding] } });
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
    ...serverMeetingOverrides({ status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T23:00:00.000Z', suggestedSwaps: [] }),
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
    const b = makeTickBattle(serverMeetingOverrides({
        id: 'gpm_1', status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z',
        suggestedSwaps: [
          { symbolOut: 'INTC', symbolIn: 'JPM', rationale: 'INTC lagging', swappedInAt: null }, // INTC is no longer held
          { symbolOut: 'KO', symbolIn: 'AMD', rationale: 'KO lagging', swappedInAt: KO_THEN },
        ],
    }));
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
    // The replay runs LATER than the first run's commit (real time passes):
    // integrity follow-up 2's read-back after an executor throw matches only a
    // row swapped out at or after its own call began, so under the frozen
    // clock the first run's row would pass for the replay's own.
    vi.setSystemTime(new Date(Date.parse(FROZEN_NOW) + 60_000));
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

  // Integrity follow-up 2 (review K4-2) — the read-back's residual, pinned rather
  // than hidden by the clock. When the overlapping worker's executor call starts
  // NO LATER than the first worker's commit (truly concurrent), nothing on the
  // row tells the two calls apart (the same deciding evaluation id, slot and
  // incoming stock), so the replay adopts the landed trade as its own: the
  // approval is filed as executed — true of the approval — with no failure
  // marker and no release, and still ONE trade. (Before follow-up 2 it filed
  // "failed" and released the reservation of a stock the battle held.)
  // Dormant (the launch guard); the report lists it under what is not yet safe.
  for (const mode of ['enforce', 'off']) {
    it(`${mode} — the overlap: a replay whose call starts at the first run's commit instant adopts that trade (no failure, no release, one trade)`, async () => {
      flags.swapIdentity = mode;
      const first = await runTick({ battle: approved() });
      exec.calls = [];
      const second = await runTick({ battle: approved(), mutateStore: (s) => { for (const k of Object.keys(s)) delete s[k]; Object.assign(s, deepClone(first.stored)); } });
      expect(exec.calls).toHaveLength(1);
      expect(second.stored.trades).toHaveLength(1);
      const row = second.stored.proposalHistory.at(-1);
      expect(row).toMatchObject({ resolution: 'approved' });
      expect(row).not.toHaveProperty('executionFailed');
      expect(row).not.toHaveProperty('executionRefusal');
      expect(second.feed.findLast((e) => e.source === 'proposal_system').message).toBe('Coach approved: Swap KO → AMD');
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('A10 — shadow changes no behaviour: a full tick writes what off writes, plus the verification and the entry key', () => {
  const strip = (updates) => JSON.parse(JSON.stringify(updates), (key, value) => {
    if (key === 'verification' || key === 'executionRefusal') return undefined;
    return value;
  });

  const copilotWith = (proposal) => makeTickBattle({ executionMode: 'copilot', pendingProposal: proposal });
  const pendingMeetingWithStop = () => makeTickBattle({
    ...serverMeetingOverrides({ status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T23:00:00.000Z', suggestedSwaps: [] }),
    agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [{ type: 'stopLoss', value: 1, unit: '%', enforcement: 'hard' }] },
  });
  // Every caller that can commit, at calls off AND calls shadow (review S3-2:
  // the existing off goldens never drive the proposal, meeting or pass paths).
  const SCENARIOS = [
    ['two risk exits, then a model HOLD', 'off', () => ({ prices: bustingPrices() })],
    ['a model SWAP', 'off', () => ({ result: makeSwapResult() })],
    ['a HOLD', 'off', () => ({})],
    ['an approved proposal (C3)', 'off', () => ({ battle: copilotWith(APPROVED_PROPOSAL()) })],
    ['an expired co-pilot proposal (C4)', 'off', () => ({ battle: copilotWith(EXPIRED_PROPOSAL()) })],
    ['an approved meeting (C6)', 'off', () => ({ battle: makeTickBattle(serverMeetingOverrides({ id: 'gpm_1', status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'KO lagging' }] })) })],
    ['the suppression pass forcing an exit (C5)', 'off', () => { guardrailHook.result = { decision: 'SWAP', symbolOut: 'KO', symbolIn: 'AMD', sourceNote: 'guardrail_stopLoss', statusMessage: 'Stop hit on KO.', overrides: [] }; return { battle: pendingMeetingWithStop() }; }],
    ['two risk exits, then a model SWAP — calls shadow', 'shadow', () => ({ prices: bustingPrices(), result: makeSwapResult({ symbolOut: 'MSFT', symbolIn: 'JPM', tier: 'core' }) })],
    ['a model SWAP — calls shadow', 'shadow', () => ({ result: makeSwapResult() })],
    ['an approved meeting (C6) — calls shadow', 'shadow', () => ({ battle: makeTickBattle(serverMeetingOverrides({ id: 'gpm_1', status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'KO lagging' }] })) })],
  ];

  for (const [label, calls, args] of SCENARIOS) {
    it(label, async () => {
      flags.calls = calls;
      const off = await runTick(args());
      const offUpdates = deepClone(off.db.__updates);
      const offCapture = deepClone(off.db.__captureWrites);
      exec.calls = [];
      exec.committed = 0;
      flags.swapIdentity = 'shadow';
      const shadow = await runTick(args());
      expect(off.stored.trades.length + (off.entry ? 1 : 0), `${label}: the scenario must trade or write an entry`).toBeGreaterThan(0);
      expect(JSON.stringify(strip(shadow.db.__updates))).toBe(JSON.stringify(offUpdates));
      expect(JSON.stringify(shadow.db.__captureWrites)).toBe(JSON.stringify(offCapture));
      // …and the difference is exactly those keys: one verification per committed trade, the key on the entry.
      const shadowJson = JSON.stringify(shadow.db.__updates);
      expect(JSON.stringify(offUpdates)).not.toMatch(/verification|executionRefusal/);
      if (shadow.entry) expect(shadow.entry).toHaveProperty('executionRefusal', null);
      expect(shadow.stored.trades).toHaveLength(off.stored.trades.length);
      for (const trade of shadow.stored.trades) expect(trade.verification).toMatchObject({ mode: 'shadow', verdict: 'match' });
      expect((shadowJson.match(/"verdict":"match"/g) || []).length).toBeGreaterThanOrEqual(shadow.stored.trades.length);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('review fixes — the speaker, the slot, the belief, the beats', () => {
  const guarded = (over = {}) => makeTickBattle({
    agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [{ type: 'stopLoss', value: 1, unit: '%', enforcement: 'hard' }] },
    ...over,
  });
  const FORCED_KO = { decision: 'SWAP', symbolOut: 'KO', symbolIn: 'AMD', sourceNote: 'guardrail_stopLoss', statusMessage: 'Stop hit on KO.', overrides: [] };

  it('S2-1: a guardrail-FORCED exit on the model route that is refused speaks the PROTECTIVE line — the same as the suppression pass', async () => {
    flags.swapIdentity = 'enforce';
    guardrailHook.result = FORCED_KO;
    exec.before = once(moveKoSlot);
    const { entry } = await runTick({ battle: guarded(), result: makeHoldResult() });
    expect(entry.guardrailSourceNote).toBe('guardrail_stopLoss');
    expect(entry.decision).toBe('HOLD');
    expect(entry.executionRefusal.line).toBe(PROTECTIVE_KO);
  });

  it("S2-1: the model's OWN refused swap still speaks the agent line", async () => {
    flags.swapIdentity = 'enforce';
    exec.before = once(moveKoSlot);
    const { entry } = await runTick({ result: makeSwapResult() });
    expect(entry.executionRefusal.line).toBe(AGENT_KO_AMD);
  });

  it('S2-1: a refused archetype (stagnation) exit on the risk route speaks the AGENT line, not "Protection"', async () => {
    flags.swapIdentity = 'enforce';
    riskHook.stagnant = ['KO'];
    exec.before = once(moveKoSlot);
    const { feed } = await runTick();
    const beat = feed.findLast((e) => e.action === 'risk_swap_failed');
    expect(beat.triggeredBy).toBe('risk_stagnation');
    expect(beat.refusalReason).toBe('outgoing_identity_mismatch');
    expect(beat.message).toMatch(/^The agent tried to swap KO for [A-Z]+, but KO had already left that slot. No trade was made.$/);
  });

  it('S2-2: an owner-written proposal with no tier or slot is refused at enforce and CLEARED — no undefined reaches the write', async () => {
    flags.swapIdentity = 'enforce';
    const slotless = APPROVED_PROPOSAL();
    delete slotless.tier;
    delete slotless.slotIndex;
    const { stored, thrown } = await runTick({ battle: makeTickBattle({ executionMode: 'copilot', pendingProposal: slotless }) });
    expect(thrown).toBeNull();
    expect(stored.pendingProposal).toBeNull();
    const row = stored.proposalHistory.at(-1);
    expect(row.executionFailed).toBe(true);
    expect(row.executionRefusal.verification.slot).toEqual({ tier: null, slotIndex: null });
  });

  it('S2-3: the risk loop\'s SECOND exit is checked against the position its verdict was computed on — a returned symbol is refused, never sold', async () => {
    flags.swapIdentity = 'enforce';
    // Before the first exit reads, a competing commit swaps PG out and back in (a new entry instant).
    exec.before = once((args) => {
      const stored = args[0].__store.battle;
      stored.portfolio.support[1] = { ...stored.portfolio.support[1], swapPrice: 170, swappedInAt: '2026-09-09T14:55:00.000Z' };
    });
    const { stored, feed } = await runTick({ prices: bustingPrices() });
    expect(exec.calls.map((a) => a[10]?.expectedOut)).toEqual([{ symbol: 'KO', swappedInAt: null }, { symbol: 'PG', swappedInAt: null }]);
    expect(stored.trades.map((t) => t.symbolOut)).toEqual(['KO']); // PG′ was not sold under the original PG's verdict
    expect(feed.findLast((e) => e.action === 'risk_swap_failed')).toMatchObject({
      refusalReason: 'outgoing_identity_mismatch',
      message: 'Protection was set to sell PG, but PG had already left that slot. No trade was made.',
      verification: expect.objectContaining({ found: { symbol: 'PG', swappedInAt: '2026-09-09T14:55:00.000Z' } }),
    });
  });

  it("S2-4: a new meeting's legs store the identity from the trigger's OWN picture, even when an earlier execution this tick moved the book", async () => {
    flags.swapIdentity = 'shadow';
    const battle = makeTickBattle({
      executionMode: 'copilot',
      cronState: { ...makeTickBattle().cronState, lastGameplanDate: null },
      pendingProposal: APPROVED_PROPOSAL({ symbolOut: 'TSLA', symbolIn: 'AMD', tier: 'star', slotIndex: 1, outgoingSwappedInAt: '2026-09-09T14:10:00.000Z' }),
    });
    battle.portfolio.star[1] = { ...battle.portfolio.star[1], swapPrice: 251, swappedInAt: '2026-09-09T14:10:00.000Z' };
    const { db, stored } = await runTick({ battle });
    expect(stored.portfolio.star[1].symbol).toBe('AMD'); // C3 committed TSLA → AMD before the meeting was diagnosed
    const meeting = db.__updates.find((u) => u.gameplanMeeting)?.gameplanMeeting;
    const tslaLeg = meeting?.suggestedSwaps?.find((l) => l.symbolOut === 'TSLA');
    expect(tslaLeg).toBeDefined();
    expect(tslaLeg.swappedInAt).toBe('2026-09-09T14:10:00.000Z'); // the picture's TSLA — not dropped because the refreshed book no longer holds it
  });

  it('S2-5: an approved meeting\'s refused and departed legs show in the FEED at enforce (the card is gone once approved)', async () => {
    flags.swapIdentity = 'enforce';
    const battle = makeTickBattle(serverMeetingOverrides({
        id: 'gpm_1', status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z',
        suggestedSwaps: [
          { symbolOut: 'INTC', symbolIn: 'JPM', rationale: 'INTC lagging', swappedInAt: null },
          { symbolOut: 'KO', symbolIn: 'AMD', rationale: 'KO lagging', swappedInAt: '2026-09-09T13:45:00.000Z' },
        ],
    }));
    const { feed } = await runTick({ battle });
    const beats = feed.filter((e) => e.source === 'gameplan_meeting' && e.refusalReason);
    expect(beats.map((b) => b.message)).toEqual([
      'The agent tried to swap INTC for JPM, but INTC had already left that slot. No trade was made.',
      AGENT_KO_AMD,
    ]);
    expect(beats[1].verification).toMatchObject({ verdict: 'mismatch' });
  });

  it('S2-5: an expired co-pilot proposal refused at enforce shows in the feed too', async () => {
    flags.swapIdentity = 'enforce';
    exec.before = once(moveKoSlot);
    const { feed } = await runTick({ battle: makeTickBattle({ executionMode: 'copilot', pendingProposal: EXPIRED_PROPOSAL() }) });
    expect(feed.findLast((e) => e.source === 'proposal_system')).toMatchObject({ message: AGENT_KO_AMD, refusalReason: 'outgoing_identity_mismatch', action: 'hold' });
  });

  it('S2-5: none of those beats exists at off', async () => {
    const battle = makeTickBattle(serverMeetingOverrides({ id: 'gpm_1', status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [{ symbolOut: 'INTC', symbolIn: 'JPM', rationale: 'x' }] }));
    const { feed } = await runTick({ battle });
    expect(feed.some((e) => e.refusalReason)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('A8 / C3–C4 — the slot ALREADY moved before the tick (the P02 shape on a fresh read — review S4-3)', () => {
  // The in-memory battle and the store both hold XOM in support[0] from the
  // start: a belief read off the slot would be XOM and "match". Only the
  // belief STORED on the proposal (KO) names the stale position.
  const xomBook = (over) => {
    const b = makeTickBattle({ executionMode: 'copilot', ...over });
    b.portfolio.support = [{ ...XOM }, ...b.portfolio.support.slice(1)];
    return b;
  };
  const legacy = (p) => { delete p.outgoingSwappedInAt; return p; };
  /** XOM is held from the start here, so it needs a quote (else the tick exits on degraded quotes). */
  const withXomQuote = () => ({ ...makePriceTable(), XOM: { ...makePriceTable().KO, current: 113, previousClose: 112, changePercent: 0.9 } });

  for (const [label, proposal] of [
    ['approved, stored identity', () => APPROVED_PROPOSAL()],
    ['approved, legacy (symbol only)', () => legacy(APPROVED_PROPOSAL())],
    ['expired, stored identity', () => EXPIRED_PROPOSAL()],
    ['expired, legacy (symbol only)', () => legacy(EXPIRED_PROPOSAL())],
  ]) {
    it(`${label}: enforce refuses on the stored KO; XOM is never sold`, async () => {
      flags.swapIdentity = 'enforce';
      const { stored } = await runTick({ battle: xomBook({ pendingProposal: proposal() }), prices: withXomQuote() });
      expect(exec.calls[0][10].expectedOut.symbol).toBe('KO');
      expect(stored.trades).toEqual([]);
      expect(stored.portfolio.support[0].symbol).toBe('XOM');
      expect(stored.proposalHistory.at(-1).executionRefusal).toMatchObject({ reason: 'outgoing_identity_mismatch', verification: { found: { symbol: 'XOM' }, expected: { symbol: 'KO' } } });
    });

    it(`${label}: shadow trades as today (XOM goes out) and the row says mismatch`, async () => {
      flags.swapIdentity = 'shadow';
      const { stored } = await runTick({ battle: xomBook({ pendingProposal: proposal() }), prices: withXomQuote() });
      expect(stored.trades.at(-1)).toMatchObject({ symbolOut: 'XOM', verification: { verdict: 'mismatch', expected: { symbol: 'KO' } } });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('C5 — a fault AFTER the pass\'s swap committed is the pass\'s own fault, not an execution failure (review S4-8)', () => {
  const pending = () => makeTickBattle({
    ...serverMeetingOverrides({ status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T23:00:00.000Z', suggestedSwaps: [] }),
    agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [{ type: 'stopLoss', value: 1, unit: '%', enforcement: 'hard' }] },
  });

  it('the post-commit refresh throws: the trade stands; capture files guardrail_error as before, and the execution check is untouched', async () => {
    guardrailHook.result = { decision: 'SWAP', symbolOut: 'KO', symbolIn: 'AMD', sourceNote: 'guardrail_stopLoss', statusMessage: 'Stop hit on KO.', overrides: [] };
    const { permanent, stored } = await runTick({ battle: pending(), throwReadsAfterCommit: true });
    expect(exec.committed).toBe(1);
    expect(stored.trades.map((t) => t.symbolOut)).toEqual(['KO']);
    expect(permanent.guardrail.faultClass).toBe('guardrail_error');
    expect(permanent.checks.execution.status).not.toBe('failed');
  });
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
    // Integrity F1: it forces the server-owned launch mode, never the battle's executionMode.
    expect(CRON_SOURCE).toMatch(/const mode = LAUNCH_EXECUTION_MODE;[\s\S]{0,200}if \(\(battle\.executionMode \|\| 'autopilot'\) !== mode\) \{/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('one resolution per check', () => {
  it('the cron reads the flag through the resolver only — once per check, plus the exported pass\'s own default — never the constant itself', () => {
    const code = CRON_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    expect(code.match(/currentSwapIdentityMode\(\)/g)).toHaveLength(2);
    expect(code).toMatch(/const swapIdentityMode = currentSwapIdentityMode\(\);/);
    expect(code).toMatch(/swapIdentityMode = currentSwapIdentityMode\(\),\s*\}\) \{\s*if \(!PROFIT_TARGET_EXECUTOR_ENABLED\) return;/);
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

// ─────────────────────────────────────────────────────────────────────────────
// Rows the §2 mutation lens (S5) proved necessary: each fails under the named
// surviving mutant and passes on the code as built.
describe('S5-7 (hardening): at off the mode gates every record on C3–C6 too', () => {
  const TYPED = () => new SwapRefusalError('outgoing_identity_mismatch', { verificationId: 'v', expected: { symbol: 'KO' } }, 'Swap refused (outgoing_identity_mismatch): x');

  it('S5-7a C3: off — a typed error (impossible from the executor at off) files no executionRefusal and no refusal beat', async () => {
    exec.throws = TYPED();
    const { stored, feed } = await runTick({ battle: makeTickBattle({ executionMode: 'copilot', pendingProposal: APPROVED_PROPOSAL() }) });
    const row = stored.proposalHistory.at(-1);
    expect(row.executionFailed).toBe(true);
    expect(row).not.toHaveProperty('executionRefusal');
    expect(feed.find((e) => e.source === 'proposal_system')).not.toHaveProperty('refusalReason');
  });

  it('S5-7b C4: off — a typed error files no executionRefusal and no refusal beat', async () => {
    exec.throws = TYPED();
    const { stored, feed } = await runTick({ battle: makeTickBattle({ executionMode: 'copilot', pendingProposal: EXPIRED_PROPOSAL() }) });
    const row = stored.proposalHistory.at(-1);
    expect(row.resolution).toBe('auto_execution_failed');
    expect(row).not.toHaveProperty('executionRefusal');
    expect(feed.filter((e) => e.refusalReason)).toEqual([]);
  });

  it('S5-7c C5: off — a typed error is an execution failure (no verdict), with today\'s beat', async () => {
    exec.throws = TYPED();
    guardrailHook.result = { decision: 'SWAP', symbolOut: 'KO', symbolIn: 'AMD', sourceNote: 'guardrail_stopLoss', statusMessage: 'Stop hit on KO.', overrides: [] };
    const battle = makeTickBattle({
      ...serverMeetingOverrides({ status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T23:00:00.000Z', suggestedSwaps: [] }),
      agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [{ type: 'stopLoss', value: 1, unit: '%', enforcement: 'hard' }] },
    });
    const { permanent, feed } = await runTick({ battle });
    expect(permanent.checks.execution).toMatchObject({ status: 'failed', result: null, reason: null });
    expect(feed.find((e) => e.action === 'risk_swap_failed')).not.toHaveProperty('refusalReason');
  });

  it('S5-7d C6: off — a typed error on a leg records no legRefusals and no refusal beat (follow-up 2: the read-back confirms no trade, so the leg is marked failed and table F V1.3 renders it)', async () => {
    exec.throws = TYPED();
    const battle = makeTickBattle(serverMeetingOverrides({
      id: 'gpm_s5', status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z',
      suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'KO lagging' }],
    }));
    const meeting = deepClone(battle.gameplanMeeting);
    const { stored, feed } = await runTick({ battle });
    expect(exec.calls).toHaveLength(1);
    expect(stored.gameplanMeetingHistory.at(-1)).toEqual({ ...meeting, suggestedSwaps: [{ ...meeting.suggestedSwaps[0], executionFailed: true }] });
    expect(feed.filter((e) => e.refusalReason)).toEqual([]);
    expect(feed.findLast((e) => e.source === 'gameplan_meeting')).toMatchObject({
      message: 'The swap of KO for AMD you approved did not go through. No trade was made.', action: 'hold', symbolOut: 'KO', symbolIn: 'AMD',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integrity build, Part C item 2 — table F V1.2 (founder sign-off Q2 on PR #940):
// an equipped PROFIT TARGET whose swap is refused speaks the profit-target line —
// on the model route (the entry's refusal record) and the suppression pass (the
// feed beat) alike. The stops keep the protective line (S2-1 above).
describe('V1.2 — a refused profit-target exit speaks the profit-target line on either route', () => {
  const PROFIT_TARGET_KO = 'Your profit target was set to sell KO, but KO had already left that slot. No trade was made.';
  const withProfitTarget = (over = {}) => makeTickBattle({
    agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [{ type: 'profitTarget', value: 1, unit: '%', enforcement: 'hard' }] },
    ...over,
  });
  const FORCED_PT = { decision: 'SWAP', symbolOut: 'KO', symbolIn: 'AMD', sourceNote: 'guardrail_profitTarget', statusMessage: 'Target hit on KO.', overrides: [] };

  it('the model route: the entry\'s refusal record carries the profit-target line', async () => {
    flags.swapIdentity = 'enforce';
    guardrailHook.result = FORCED_PT;
    exec.before = once(moveKoSlot);
    const { entry } = await runTick({ battle: withProfitTarget(), result: makeHoldResult() });
    expect(entry.guardrailSourceNote).toBe('guardrail_profitTarget');
    expect(entry.decision).toBe('HOLD');
    expect(entry.executionRefusal).toMatchObject({ reason: 'outgoing_identity_mismatch', line: PROFIT_TARGET_KO });
  });

  it('the suppression pass: the beat carries the profit-target line', async () => {
    flags.swapIdentity = 'enforce';
    guardrailHook.result = FORCED_PT;
    exec.before = once(moveKoSlot);
    const { feed } = await runTick({ battle: withProfitTarget(serverMeetingOverrides({ status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T23:00:00.000Z', suggestedSwaps: [] })) });
    expect(feed.findLast((e) => e.action === 'risk_swap_failed')).toMatchObject({ message: PROFIT_TARGET_KO, refusalReason: 'outgoing_identity_mismatch', triggeredBy: 'guardrail_profitTarget' });
  });

  it('a refused STOP on the same routes still speaks the protective line', async () => {
    flags.swapIdentity = 'enforce';
    guardrailHook.result = { ...FORCED_PT, sourceNote: 'guardrail_stopLoss' };
    exec.before = once(moveKoSlot);
    const { feed } = await runTick({ battle: withProfitTarget(serverMeetingOverrides({ status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T23:00:00.000Z', suggestedSwaps: [] })) });
    expect(feed.findLast((e) => e.action === 'risk_swap_failed').message).toBe(PROTECTIVE_KO);
  });
});
