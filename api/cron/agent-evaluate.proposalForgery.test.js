// api/cron/agent-evaluate.proposalForgery.test.js
//
// Integrity build — client-forged proposal data (7 Oct 2026). Report:
// docs/audits/20261007_BUILD_INTEGRITY_PROPOSAL_FORGERY.md.
//
// THE ATTACKER: a signed-in player who writes, from the browser at any moment
// between ticks, any field firestore.rules lets them write on their own battle
// (the agentBattles update allowlist: executionMode, pendingProposal,
// strategyPreset, gameplanMeeting, gameplanMeetingHistory, …).
//
// THE EXPLOIT (Part A, proven on base 62d9d07e — the report holds the base
// version of the first describe, which passed there and fails here): a planted
// `executionMode: 'copilot'` opened the proposal handler's launch guard, a
// planted approved `pendingProposal` reached the executor, and its
// `evaluationMetadata` — spread onto the trade row after the executor's
// computed fields — put `lockedPoints: 9999` on `trades[]`; the next tick's
// `bankedScore` summed it. A planted expired co-pilot proposal made the cron
// trade a pair the agent never chose.
//
// THE FIX, row by row:
//   F1 — both launch guards read the server-owned LAUNCH_EXECUTION_MODE, so a
//        planted proposal lapses through the launch-guard branch, never runs;
//   F2 — on the dormant paths too (the mode mocked to 'copilot' — the paths as
//        they would run the day the authority arc revives them), no value from
//        the proposal reaches the row as a number, price, points, count, symbol
//        or id; descriptive text rides capped;
//   F3 — every proposal / meeting history row the server writes carries only
//        the server's own outcome fields.
//
// THE EXECUTOR IS REAL (wrapped, never replaced): every row runs the fenced
// executeSwapServer against the harness store.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeSwapResult, makeToolUseResponse, deepClone, serverMeetingOverrides,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCallsDb } from '../_utils/__fixtures__/callRecordsStore.js';
import { permanentDoc } from '../_utils/__fixtures__/tickCaptureHarness.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const flags = vi.hoisted(() => ({ swapIdentity: 'off' }));
/** The server-owned launch mode — 'copilot' only in the rows that drive the dormant proposal paths. */
const authority = vi.hoisted(() => ({ mode: 'autopilot' }));
const exec = vi.hoisted(() => ({ calls: [], throws: null }));

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
      if (exec.throws) throw exec.throws;
      return runReal(...args);
    },
  };
});
vi.mock('../_utils/executionAuthority.js', () => ({ get LAUNCH_EXECUTION_MODE() { return authority.mode; } }));
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
const { EXECUTOR_METADATA_KEYS, EXECUTOR_COMPUTED_KEYS, CLIENT_TEXT_MAX } = await import('../_utils/executorMetadata.js');
const { HISTORY_OUTCOME_KEYS } = await import('../_utils/historyRows.js');

async function runTick(battle, result = makeHoldResult()) {
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(result));
  const db = makeCallsDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const feedUpdate = [...db.__updates].reverse().find((u) => Array.isArray(u.statusFeed)) || null;
  const seq = db.__updates[0]?.['cronState.tickSeq'] ?? 1;
  return { db, summary, stored: db.__store.battle, feed: feedUpdate?.statusFeed || [], permanent: permanentDoc(db, 'battle-tick-1', `battle-tick-1:${seq}`) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  flags.swapIdentity = 'off';
  authority.mode = 'autopilot';
  exec.calls = [];
  exec.throws = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

/** Values an owner can plant: every one of them must stay off the trade row and out of the score. */
const PLANTED_METADATA = Object.freeze({
  lockedPoints: 9999, entryPrice: 0.01, exitPrice: 777, lockedGainPct: 5000, symbolOut: 'FAKE', symbolIn: 'FAKE2',
  swappedOutAt: '1999-01-01T00:00:00.000Z', swapDay: 41, tradingDay: 42, evaluationId: 'forged-eval', id: 'trade_999',
  entryConviction: 99, source: 'guardrail', exitReason: 'guardrail_stopLoss', hftKnobsSource: 'user_rule', archetype: 'degen',
  swapProvenance: { dialBandVersion: 999, knobConfigVersion: 999 },
  verification: { mode: 'shadow', verdict: 'match', verificationId: 'planted' },
  rationale: 'R'.repeat(5000), hypothesis: { not: 'a string' }, trigger: 'planted trigger',
  entryRegime: 'trending', swapMotive: 'conviction',
  trade_reasoning: { thesis: 'planted thesis', strategy: 'planted', indicators: ['a', 7], conviction: 99, score: 9999 },
});
const PLANTED_SNAPSHOT = Object.freeze({ symbolOut: { rsi: 99, price: 777 }, symbolIn: { rsi: 1, price: 0.01 } });

const PLANTED_APPROVED = () => ({
  proposalId: 'prop_x', evalId: 'forged-eval', symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0, mode: 'copilot',
  createdAt: '2026-09-09T14:40:00.000Z', expiresAt: '2026-09-09T14:50:00.000Z',
  resolvedAt: '2026-09-09T14:45:00.000Z', resolution: 'approved', resolvedBy: 'owner-uid-1',
  evaluationMetadata: deepClone(PLANTED_METADATA),
  snapshot: deepClone(PLANTED_SNAPSHOT),
});
const PLANTED_EXPIRED = () => ({ ...PLANTED_APPROVED(), resolvedAt: null, resolution: null, resolvedBy: null });
/** Outcome fields an owner plants on a record the server will file into history. */
const PLANTED_OUTCOMES = Object.freeze({
  executionFailed: false, executionRefusal: { reason: 'planted' }, verification: { verdict: 'match', mode: 'shadow' },
  legRefusals: [{ reason: 'planted' }], systemNote: 'planted note', scoreAtResolution: 9999, scoreAtVeto: 9999,
  vetoedAtPrice: { KO: 1 }, vetoedAtTimestamp: '1999-01-01T00:00:00.000Z', counterfactualPoints: 9999,
  outcomePoints: 9999, lockedPoints: 9999, closedTrade: { lockedPoints: 9999 },
});

const tradeOf = (stored, symbolIn) => (stored.trades || []).find((t) => t.symbolIn === symbolIn) || null;

// ─────────────────────────────────────────────────────────────────────────────
describe('Part A — the score forgery is closed (acceptance 1); planted proposals lapse via the launch-guard branch (acceptance 4, intended off change 1)', () => {
  it('a planted co-pilot mode + approved proposal carrying lockedPoints / prices / a symbol never executes, and bankedScore is unchanged', async () => {
    const battle = makeTickBattle({ executionMode: 'copilot', pendingProposal: PLANTED_APPROVED() });
    const first = await runTick(battle);
    expect(exec.calls).toEqual([]);
    expect(first.stored.trades).toEqual([]);
    expect(first.stored.portfolio.support[0].symbol).toBe('KO');
    expect(first.stored.pendingProposal).toBeNull();
    // It lapses through the EXISTING launch-guard branch (filed 'launch_guard_cleared'
    // since integrity follow-up 2 — founder Q2; the note is kept).
    expect(first.stored.proposalHistory.at(-1)).toMatchObject({ proposalId: 'prop_x', resolution: 'launch_guard_cleared', resolvedBy: 'system', systemNote: 'launch_guard_clear' });
    const second = await runTick(deepClone(first.stored));
    expect(second.stored.scoreState.bankedScore).toBe(0);
    expect(second.stored.trades).toEqual([]);
  });

  it('a planted EXPIRED co-pilot proposal never trades the pair the agent did not choose', async () => {
    const { stored } = await runTick(makeTickBattle({ executionMode: 'copilot', pendingProposal: PLANTED_EXPIRED() }));
    expect(exec.calls).toEqual([]);
    expect(stored.trades).toEqual([]);
    expect(stored.proposalHistory.at(-1)).toMatchObject({ resolution: 'launch_guard_cleared', systemNote: 'launch_guard_clear' });
  });

  it('a deleted executionMode (the migration writes `copilot` for it) and any other planted mode lapse the same way', async () => {
    for (const mode of [undefined, 'manual', 'copilot ', 7]) {
      exec.calls = [];
      const battle = makeTickBattle({ pendingProposal: PLANTED_APPROVED() });
      if (mode === undefined) delete battle.executionMode; else battle.executionMode = mode;
      const { stored } = await runTick(battle);
      expect(exec.calls, String(mode)).toEqual([]);
      expect(stored.trades, String(mode)).toEqual([]);
      expect(stored.pendingProposal, String(mode)).toBeNull();
    }
  });

  it('at shadow and enforce too: the identity mode does not reopen the dormant paths', async () => {
    for (const mode of ['shadow', 'enforce']) {
      flags.swapIdentity = mode;
      exec.calls = [];
      const { stored } = await runTick(makeTickBattle({ executionMode: 'copilot', pendingProposal: PLANTED_APPROVED() }));
      expect(exec.calls, mode).toEqual([]);
      expect(stored.trades, mode).toEqual([]);
    }
  });

  it('the production clear, pinned exactly (review I4-7): one write clears the proposal into a launch-guard row; the tick runs on and ends `completed`', async () => {
    // A planted resolvedAt / score are ignored; a full history keeps its 50-row cap.
    const pending = { proposalId: 'p1', symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0, mode: 'copilot', expiresAt: '2026-09-09T23:00:00.000Z', resolvedAt: '1999-01-01T00:00:00.000Z', scoreAtResolution: 9999 };
    const prior = Array.from({ length: 50 }, (_, i) => ({ proposalId: `old_${i}`, resolution: 'auto_executed' }));
    const { db, permanent } = await runTick(makeTickBattle({ executionMode: 'copilot', pendingProposal: deepClone(pending), proposalHistory: deepClone(prior) }));
    const clears = db.__updates.filter((u) => Object.hasOwn(u, 'pendingProposal'));
    expect(clears).toHaveLength(1);
    expect(Object.keys(clears[0])).toEqual(['pendingProposal', 'proposalHistory']);
    expect(clears[0].proposalHistory).toHaveLength(50);
    expect(clears[0].proposalHistory[0]).toEqual(prior[1]);
    expect(Object.keys(clears[0].proposalHistory.at(-1))).toEqual(['proposalId', 'symbolOut', 'symbolIn', 'mode', 'expiresAt', 'resolvedAt', 'resolution', 'resolvedBy', 'systemNote', 'scoreAtResolution']);
    expect(clears[0].proposalHistory.at(-1).scoreAtResolution).not.toBe(9999);
    expect([{ ...clears[0], proposalHistory: clears[0].proposalHistory.slice(-1) }]).toEqual([{
      pendingProposal: null,
      // Only what the proposal NAMED (capped strings) + the server's own result — no slot, ids or numbers (review I1-3 / I1-4).
      proposalHistory: [{ proposalId: 'p1', symbolOut: 'KO', symbolIn: 'AMD', mode: 'copilot', expiresAt: '2026-09-09T23:00:00.000Z', resolvedAt: FROZEN_NOW, resolution: 'launch_guard_cleared', resolvedBy: 'system', systemNote: 'launch_guard_clear', scoreAtResolution: expect.any(Number) }],
    }]);
    expect(permanent.exitReason).toBe('completed');
    expect(exec.calls).toEqual([]);
  });

  it('the model path ignores a planted mode too (review I4-6): the model SWAP executes at once on a copilot, manual or mode-less battle — no proposal is written', async () => {
    for (const mode of ['copilot', 'manual', undefined]) {
      exec.calls = [];
      const battle = makeTickBattle({ executionMode: mode });
      if (mode === undefined) delete battle.executionMode;
      const { stored, db } = await runTick(battle, makeSwapResult());
      expect(exec.calls, String(mode)).toHaveLength(1);
      expect(tradeOf(stored, 'AMD'), String(mode)).toMatchObject({ symbolOut: 'KO', evaluationId: stored.evaluations.at(-1).evalId, source: 'haiku' });
      expect(stored.evaluations.at(-1).decision, String(mode)).toBe('SWAP');
      expect(db.__updates.some((u) => u.pendingProposal), String(mode)).toBe(false);
      expect(stored.proposalHistory, String(mode)).toEqual([]);
    }
  });

  it('a planted proposal that is not an object never spreads into the history row (review I1-3)', async () => {
    for (const planted of ['A'.repeat(5000), ['x', 'y'], 7]) {
      const { stored } = await runTick(makeTickBattle({ executionMode: 'copilot', pendingProposal: planted }));
      expect(Object.keys(stored.proposalHistory.at(-1)), JSON.stringify(planted).slice(0, 20)).toEqual(['resolvedAt', 'resolution', 'resolvedBy', 'systemNote', 'scoreAtResolution']);
      expect(stored.pendingProposal).toBeNull();
    }
  });

  it('a pending (unexpired, unresolved) planted proposal no longer mutes the model: it lapses and the tick runs on', async () => {
    const battle = makeTickBattle({ executionMode: 'copilot', pendingProposal: { ...PLANTED_EXPIRED(), expiresAt: '2026-09-09T23:00:00.000Z' } });
    const { stored } = await runTick(battle);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(stored.pendingProposal).toBeNull();
    expect(stored.evaluations).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('F3 — history rows carry only the server\'s own outcome fields (acceptance 5; intended off change 2)', () => {
  const plantedOutcomes = (record) => ({ ...record, ...deepClone(PLANTED_OUTCOMES) });
  const assertNoPlantedOutcome = (row, own = {}) => {
    // Both lists (review I5-5): the module's own, and every key this suite plants — removing a key from the module cannot remove its assertion.
    for (const key of new Set([...HISTORY_OUTCOME_KEYS, ...Object.keys(PLANTED_OUTCOMES)])) {
      if (Object.hasOwn(own, key)) expect(row[key], key).toEqual(own[key]);
      else expect(row, key).not.toHaveProperty(key);
    }
  };

  it('the launch-guard row: the planted outcome fields are gone; systemNote and scoreAtResolution are the server\'s', async () => {
    const { stored } = await runTick(makeTickBattle({ executionMode: 'copilot', pendingProposal: plantedOutcomes(PLANTED_APPROVED()) }));
    const row = stored.proposalHistory.at(-1);
    assertNoPlantedOutcome(row, { systemNote: 'launch_guard_clear', scoreAtResolution: row.scoreAtResolution });
    expect(row.scoreAtResolution).not.toBe(9999);
  });

  it('dormant approved path (mode mocked copilot), success: the row carries no executionFailed / executionRefusal / verification the owner planted', async () => {
    authority.mode = 'copilot';
    const { stored } = await runTick(makeTickBattle({ pendingProposal: plantedOutcomes(PLANTED_APPROVED()) }));
    expect(exec.calls).toHaveLength(1);
    assertNoPlantedOutcome(stored.proposalHistory.at(-1));
  });

  it('dormant approved path, failure: `executionFailed: true` is the server\'s, and a planted executionRefusal never rides along (any mode)', async () => {
    authority.mode = 'copilot';
    for (const mode of ['off', 'enforce']) {
      flags.swapIdentity = mode;
      exec.throws = new Error('Asset no longer available in slot');
      const { stored } = await runTick(makeTickBattle({ pendingProposal: plantedOutcomes(PLANTED_APPROVED()) }));
      assertNoPlantedOutcome(stored.proposalHistory.at(-1), { executionFailed: true });
    }
  });

  it('dormant vetoed path: the veto-time prices, timestamp and score are the server\'s', async () => {
    authority.mode = 'copilot';
    const vetoed = plantedOutcomes({ ...PLANTED_APPROVED(), resolution: 'vetoed', userReason: 'no' });
    const { stored } = await runTick(makeTickBattle({ pendingProposal: vetoed }));
    const row = stored.proposalHistory.at(-1);
    expect(row.vetoedAtPrice).toEqual({ AMD: makePriceTable().AMD.current, KO: makePriceTable().KO.current });
    expect(row.vetoedAtTimestamp).toBe(FROZEN_NOW);
    assertNoPlantedOutcome(row, { vetoedAtPrice: row.vetoedAtPrice, vetoedAtTimestamp: FROZEN_NOW, scoreAtVeto: row.scoreAtVeto });
    expect(row.scoreAtVeto).not.toBe(9999);
  });

  it('dormant expired path, success and failure: only this resolution\'s outcomes', async () => {
    authority.mode = 'copilot';
    let { stored } = await runTick(makeTickBattle({ pendingProposal: plantedOutcomes(PLANTED_EXPIRED()) }));
    let row = stored.proposalHistory.at(-1);
    expect(row.resolution).toBe('auto_executed');
    assertNoPlantedOutcome(row, { scoreAtResolution: row.scoreAtResolution });
    exec.throws = new Error('boom');
    ({ stored } = await runTick(makeTickBattle({ pendingProposal: plantedOutcomes(PLANTED_EXPIRED()) })));
    row = stored.proposalHistory.at(-1);
    expect(row.resolution).toBe('auto_execution_failed');
    assertNoPlantedOutcome(row, { executionFailed: true, scoreAtResolution: row.scoreAtResolution });
  });

  // A meeting the SERVER created (its copy in cronState — integrity follow-up 2,
  // Part A), with outcome fields the owner then planted on it and its legs.
  const meetingWith = (status, extra = {}) => makeTickBattle(serverMeetingOverrides({
    id: 'gpm_1', status, diagnosis: 'drag', expiresAt: '2026-09-09T14:00:00.000Z',
    suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'KO lagging', ...deepClone(PLANTED_OUTCOMES) }],
    ...deepClone(PLANTED_OUTCOMES),
    ...extra,
  }));

  it('meeting history — approved, rejected, expired: no planted outcome on the row or on any leg', async () => {
    for (const status of ['approved', 'rejected', 'pending']) {
      const { stored } = await runTick(meetingWith(status));
      const row = stored.gameplanMeetingHistory.at(-1);
      expect(row.status, status).toBe(status === 'pending' ? 'expired' : status);
      assertNoPlantedOutcome(row);
      for (const leg of row.suggestedSwaps) assertNoPlantedOutcome(leg);
    }
  });

  it('meeting history at enforce: legRefusals is the server\'s own (a departed leg), never the planted one', async () => {
    flags.swapIdentity = 'enforce';
    const { stored } = await runTick(meetingWith('approved', {
      suggestedSwaps: [{ symbolOut: 'INTC', symbolIn: 'JPM', rationale: 'gone', ...deepClone(PLANTED_OUTCOMES) }],
    }));
    const row = stored.gameplanMeetingHistory.at(-1);
    expect(row.legRefusals).toEqual([expect.objectContaining({ symbolOut: 'INTC', reason: 'outgoing_identity_mismatch', verificationId: null })]);
    for (const leg of row.suggestedSwaps) assertNoPlantedOutcome(leg);
  });

  it('a record with no planted fields files exactly as before (the key order kept)', async () => {
    authority.mode = 'copilot';
    const clean = { ...PLANTED_APPROVED(), evaluationMetadata: { exitReason: 'haiku_decision' }, snapshot: null };
    const { stored } = await runTick(makeTickBattle({ pendingProposal: deepClone(clean) }));
    expect(Object.keys(stored.proposalHistory.at(-1))).toEqual(Object.keys(clean));
    expect(stored.proposalHistory.at(-1)).toEqual(clean);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('F2 on the dormant proposal paths (defense in depth: the launch mode mocked to copilot)', () => {
  const assertServerRow = (row) => {
    expect(row).not.toBeNull();
    // The executor's own values — the slot's real occupant, its real prices, the server's day.
    expect(row).toMatchObject({ symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0, swapDay: 1, swappedOutAt: FROZEN_NOW, tradingDay: 1 });
    expect(row.exitPrice).toBe(makePriceTable().KO.current);
    expect(row.entryPrice).toBe(makeTickBattle().portfolio.startingPrices.KO);
    expect(row.lockedPoints).not.toBe(9999);
    expect(row.lockedGainPct).not.toBe(5000);
    // Ids from the server; no planted number, provenance or receipt override.
    expect(row.id).toBe('trade_001');
    expect(row.evaluationId).toBeNull(); // the server's log never made this proposal
    expect(row).not.toHaveProperty('entryConviction');
    expect(row).not.toHaveProperty('swapProvenance');
    expect(row).not.toHaveProperty('verification');
    expect(row).toMatchObject({ source: 'haiku', archetype: null, hftKnobsSource: 'archetype', exitReason: 'haiku_decision', action: 'SWAP' });
    expect(row.snapshot).toBeNull();
    // Descriptive strings ride capped; a non-string is dropped.
    expect(row.rationale).toHaveLength(CLIENT_TEXT_MAX);
    expect(row.hypothesis).toBeNull();
    expect(row.trigger).toBe('planted trigger');
    expect(row.trade_reasoning).toEqual({ thesis: 'planted thesis', strategy: 'planted', indicators: ['a'] });
    // Every key is computed by the executor or allowlisted.
    for (const key of Object.keys(row)) expect([...EXECUTOR_COMPUTED_KEYS, ...EXECUTOR_METADATA_KEYS], key).toContain(key);
  };

  it('approved: the trade row and the incoming position carry only server values', async () => {
    authority.mode = 'copilot';
    const { stored } = await runTick(makeTickBattle({ pendingProposal: PLANTED_APPROVED() }));
    expect(exec.calls).toHaveLength(1);
    expect(exec.calls[0][6]).toBe(1);     // the trading day — the server's
    expect(exec.calls[0][9]).toBeNull();  // the stored snapshot is never forwarded
    assertServerRow(tradeOf(stored, 'AMD'));
    expect(stored.portfolio.support[0]).toMatchObject({ symbol: 'AMD', swappedInDay: 1 });
    const next = await runTick(deepClone(stored));
    expect(next.stored.scoreState.bankedScore).toBe(tradeOf(stored, 'AMD').lockedPoints);
  });

  it('expired co-pilot: the same', async () => {
    authority.mode = 'copilot';
    const { stored } = await runTick(makeTickBattle({ pendingProposal: PLANTED_EXPIRED() }));
    expect(exec.calls).toHaveLength(1);
    assertServerRow(tradeOf(stored, 'AMD'));
  });

  it('a proposal the server\'s own log made keeps its evaluation id (and so P6 its verification id)', async () => {
    authority.mode = 'copilot';
    flags.swapIdentity = 'shadow';
    const proposal = { ...PLANTED_APPROVED(), evalId: 'eval_007', evaluationMetadata: { evaluationId: 'eval_007', rationale: 'rotate' } };
    const deciding = { evalId: 'eval_007', timestamp: '2026-09-09T14:40:00.000Z', decision: 'PROPOSAL', symbolOut: 'KO', symbolIn: 'AMD', tier: 'support' };
    const { stored } = await runTick(makeTickBattle({ pendingProposal: proposal, evaluations: [deciding] }));
    const row = tradeOf(stored, 'AMD');
    expect(row.evaluationId).toBe('eval_007');
    expect(row.verification.verificationId).toBe('battle-tick-1:eval_007:verify');
  });

  it('an entry with the same id that did NOT propose this pair does not lend its id', async () => {
    authority.mode = 'copilot';
    const proposal = { ...PLANTED_APPROVED(), evaluationMetadata: { evaluationId: 'eval_007' } };
    for (const entry of [
      { evalId: 'eval_007', decision: 'SWAP', symbolOut: 'KO', symbolIn: 'AMD' },
      { evalId: 'eval_007', decision: 'PROPOSAL', symbolOut: 'PG', symbolIn: 'AMD' },
      { evalId: 'eval_007', decision: 'PROPOSAL', symbolOut: 'KO', symbolIn: 'JPM' },
    ]) {
      exec.calls = [];
      const { stored } = await runTick(makeTickBattle({ pendingProposal: deepClone(proposal), evaluations: [{ timestamp: '2026-09-09T14:40:00.000Z', ...entry }] }));
      expect(tradeOf(stored, 'AMD').evaluationId, JSON.stringify(entry)).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('F2 on the live paths: the owner-writable preset, mode and meeting leg reach a row only as capped strings', () => {
  it('a planted numeric / object / overlong strategyPreset and executionMode never land on the row as such (follow-up 2 and enforce readiness, Q4: the row\'s mode and preset are always the ones that governed)', async () => {
    for (const [preset, mode, wantPreset, wantMode] of [
      [9999, 7, 'balanced', 'autopilot'],
      [{ lockedPoints: 9999 }, ['copilot'], 'balanced', 'autopilot'],
      // Enforce readiness (Q4): an unknown string is no table key — it governed as balanced, and is stamped so (was its first 64 characters).
      ['P'.repeat(500), 'M'.repeat(500), 'balanced', 'autopilot'],
    ]) {
      exec.calls = [];
      const battle = makeTickBattle({
        strategyPreset: preset,
        executionMode: mode,
        ...serverMeetingOverrides({ id: 'gpm_1', status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: { lockedPoints: 9999 } }] }),
      });
      const { stored } = await runTick(battle);
      const row = tradeOf(stored, 'AMD');
      expect(row, JSON.stringify(preset)).toMatchObject({ entryPreset: wantPreset, entryMode: wantMode, rationale: null, evaluationId: expect.stringMatching(/^gameplan_KO_AMD_\d+$/) });
    }
  });

  it('a meeting leg\'s planted symbols never reach the feed; the held-leg record keeps them only capped (review I1-5; follow-up 2, Part A)', async () => {
    // Before follow-up 2 the planted leg reached a feed beat (capped). Now a leg
    // the server's copy does not hold is never traded and writes no beat: it is
    // held, and its history record keeps what it named, capped.
    const longOut = 'X'.repeat(200);
    for (const mode of ['off', 'shadow']) {
      flags.swapIdentity = mode;
      const { feed, stored } = await runTick(makeTickBattle(serverMeetingOverrides(
        { id: 'gpm_1', status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [{ symbolOut: longOut, symbolIn: 'Y'.repeat(200), rationale: 'r' }] },
        { legs: [{ symbolOut: 'KO', symbolIn: 'AMD', swappedInAt: null }] },
      )));
      expect(feed.filter((e) => e.source === 'gameplan_meeting'), mode).toEqual([]);
      expect(JSON.stringify(feed), mode).not.toContain('X'.repeat(65));
      const row = stored.gameplanMeetingHistory.at(-1);
      expect(row.heldLegs, mode).toEqual([{ symbolOut: 'X'.repeat(64), symbolIn: 'Y'.repeat(64), reason: 'leg_not_proposed' }]);
      expect(row.heldLegCount, mode).toBe(1);
      expect(row).not.toHaveProperty('legRefusals');
      expect(stored.trades, mode).toEqual([]);
    }
  });

  it('at shadow a meeting leg\'s planted belief instant never lands on the row\'s verification (review I3-1; follow-up 2: the belief is the server copy\'s)', async () => {
    flags.swapIdentity = 'shadow';
    for (const planted of [9999, { lockedPoints: 9999 }, 'S'.repeat(3000), '2026-09-09T14:59:00.000Z']) {
      // The server stored KO's own entry instant (null — a creation-time position); the owner then planted another on the leg.
      const { stored } = await runTick(makeTickBattle(serverMeetingOverrides(
        { id: 'gpm_1', status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'r', swappedInAt: planted }] },
        { legs: [{ symbolOut: 'KO', symbolIn: 'AMD', swappedInAt: null }] },
      )));
      expect(tradeOf(stored, 'AMD').verification, JSON.stringify(planted).slice(0, 20)).toMatchObject({ expected: { symbol: 'KO', swappedInAt: null }, basis: 'symbol_and_entry', verdict: 'match' });
    }
  });

  it('a meeting leg\'s overlong rationale is capped', async () => {
    const battle = makeTickBattle(serverMeetingOverrides({ id: 'gpm_1', status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'L'.repeat(3000) }] }));
    const { stored } = await runTick(battle);
    expect(tradeOf(stored, 'AMD').rationale).toBe('L'.repeat(CLIENT_TEXT_MAX));
  });
});

// ── I5 (mutation lens) proposed rows ─────────────────────────────────────────
describe('I5 — mutation-lens rows', () => {
  it('I5-A: the dormant capture action and L1 receipt take the server values — never the proposal\'s day, exit reason, createdAt, snapshot or regime', async () => {
    const { captureSwapReceipt } = await import('../_utils/learning/captureReceipt.js');
    authority.mode = 'copilot';
    for (const make of [PLANTED_APPROVED, PLANTED_EXPIRED]) {
      captureSwapReceipt.mockClear();
      const { permanent } = await runTick(makeTickBattle({ pendingProposal: { ...make(), regime: 'planted_regime' } }));
      expect(permanent.actions, make.name).toHaveLength(1);
      expect(permanent.actions[0].exitReason, make.name).toBe('haiku_decision');
      expect(captureSwapReceipt, make.name).toHaveBeenCalledTimes(1);
      expect(captureSwapReceipt.mock.calls[0][0], make.name).toMatchObject({
        battleDay: 1, decisionAtMs: null, exitReason: 'haiku_decision', haikuSwapReason: 'haiku_decision',
        snapshotIn: null, snapshotOut: null, regimeOut: null,
      });
    }
  });

  it('I5-B: the launch-guard log names a planted proposal id only capped', async () => {
    await runTick(makeTickBattle({ pendingProposal: { ...PLANTED_APPROVED(), proposalId: 'p'.repeat(5000) } }));
    const line = console.warn.mock.calls.map((c) => String(c[0])).find((s) => s.includes('LAUNCH GUARD: pendingProposal'));
    expect(line).toContain(`proposalId=${'p'.repeat(64)})`);
  });
});
