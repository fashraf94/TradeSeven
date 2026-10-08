// api/cron/agent-evaluate.retrySafe.test.js
//
// Integrity follow-up 2 (8 Oct 2026), Part D — retry-safe records (founder
// decision Q3). Report: docs/audits/20261008_BUILD_INTEGRITY_FOLLOWUP_2.md.
//
// THE RULE: never record a refusal, a failure or "No trade was made." for a
// trade that landed.
//
// THE DOUBLE follows the Admin SDK's retry rule (integrity build §6.3,
// node_modules/@google-cloud/firestore/build/src/transaction.js): a commit the
// backend APPLIED can still report a retryable error, and the SDK then re-runs
// the whole transaction — whose callback, reading the battle with the swap
// already in it, throws (the self-swap error at off / shadow, P6's typed
// refusal at enforce). So: ONE commit, then the callback runs again and its
// throw is what the caller sees. The executor itself is real and unedited.
//
// THE ROWS (acceptance 4 and 5), for each of the six executor callers — C1 the
// risk loop, C2 the model route, C3 / C4 the dormant proposal paths (the launch
// mode mocked to 'copilot'), C5 the suppression pass, C6 the meeting leg — at
// off, shadow and enforce:
//   - the ambiguous commit: no refusal or failure record, no "No trade was
//     made", no reservation release, and the landed trade recorded (the
//     caller's success path ran);
//   - a real refusal (nothing committed): recorded as before (C6: the table F
//     V1.3 line, written only now that a read confirms no trade);
//   - the read back fails: `executionOutcome: 'unknown'`, no line either way,
//     no release.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeSwapResult, makeToolUseResponse, deepClone, serverMeetingOverrides,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCallsDb } from '../_utils/__fixtures__/callRecordsStore.js';
import { permanentDoc } from '../_utils/__fixtures__/tickCaptureHarness.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const flags = vi.hoisted(() => ({ swapIdentity: 'off' }));
/**
 * The executor wrapper. `mode`:
 *   'real'      — as in production;
 *   'ambiguous' — the SDK retry rule: the transaction commits once, then its
 *                 callback runs again on the committed state and throws;
 *   'partial'   — commits once, another writer then moves the slot, and the
 *                 call throws (the read back finds the row but not its position);
 *   'refuse'    — throws `refusal` without committing anything.
 * `failReadAfterThrow`: the first battle read after an executor throw fails.
 */
const exec = vi.hoisted(() => ({ mode: 'real', refusal: null, calls: 0, threw: false, failReadAfterThrow: false }));
const guardrailHook = vi.hoisted(() => ({ result: null }));
const authority = vi.hoisted(() => ({ mode: 'autopilot' }));
const ledger = vi.hoisted(() => ({ releases: [], confirms: [], reserves: [] }));

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
  /** The db the executor sees: its ONE transaction follows the double's rule. */
  const doubled = (db) => new Proxy(db, {
    get(target, prop) {
      if (prop !== 'runTransaction') return Reflect.get(target, prop);
      return async (cb) => {
        if (exec.mode === 'ambiguous') {
          await target.runTransaction(cb);       // attempt 1 — COMMITS (the backend applied it) …
          return target.runTransaction(cb);      // … the reply was lost; attempt 2 re-reads and throws
        }
        if (exec.mode === 'partial') {
          await target.runTransaction(cb);
          const stored = target.__store.battle;  // another writer moves the slot before anyone reads it back
          for (const tier of ['star', 'core', 'support']) {
            stored.portfolio[tier] = stored.portfolio[tier].map((a) => (a?.symbol === 'AMD' ? { ...a, symbol: 'XOM', swappedInAt: '2026-09-09T15:00:30.000Z' } : a));
          }
          const err = new Error('4 DEADLINE_EXCEEDED: Deadline exceeded');
          err.code = 4;
          throw err;
        }
        return target.runTransaction(cb);
      };
    },
  });
  return {
    ...real,
    executeSwapServer: async (db, ...rest) => {
      exec.calls += 1;
      try {
        if (exec.mode === 'refuse') throw exec.refusal;
        return await runReal(exec.mode === 'real' ? db : doubled(db), ...rest);
      } catch (err) {
        exec.threw = true;
        throw err;
      }
    },
  };
});
vi.mock('../_utils/agentGuardrails.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, applyGuardrails: (...args) => (guardrailHook.result ? deepClone(guardrailHook.result) : real.applyGuardrails(...args)) };
});
vi.mock('../_utils/executionAuthority.js', () => ({ get LAUNCH_EXECUTION_MODE() { return authority.mode; } }));
// A tournament battle, so the reservation protocol is observable: every
// reserve lands, confirms and releases are recorded.
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => ({ groupId: 'group-1', agentId: 'agent-1', heldByOthers: new Set(), odUserId: 'owner-uid-1' })),
  excludeHeldByOthers: vi.fn((l) => l),
  excludeHeldSymbols: vi.fn((l) => l),
  reserveSymbol: vi.fn(async (_db, { symbol }) => { ledger.reserves.push(symbol); return { reserved: true }; }),
  confirmSwap: vi.fn(async (_db, { symbolIn }) => { ledger.confirms.push(symbolIn); return { events: [] }; }),
  releaseReservation: vi.fn(async (_db, { symbol }) => { ledger.releases.push(symbol); }),
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
  TICK_CAPTURE_ENABLED: true,
  PROFIT_TARGET_EXECUTOR_ENABLED: true,
  get SWAP_IDENTITY_MODE() { return flags.swapIdentity; },
}));

const { processAgentBattle } = await import('./agent-evaluate.js');
const { SwapRefusalError } = await import('../_utils/agentSwapExecution.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const CRON_SOURCE = readFileSync(resolve(HERE, 'agent-evaluate.js'), 'utf8');
const BATTLE_ID = 'battle-tick-1';
const NO_TRADE = 'No trade was made';
const V13_KO_AMD = 'The swap of KO for AMD you approved did not go through. No trade was made.';

async function runTick({ battle, result = makeHoldResult(), prices = makePriceTable() }) {
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(result));
  const db = makeCallsDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  // The read back after an executor throw can be made to fail (one read only).
  const baseCollection = db.collection.bind(db);
  db.collection = (col) => {
    const c = baseCollection(col);
    if (col !== 'agentBattles') return c;
    return {
      ...c,
      doc: (id) => {
        const ref = c.doc(id);
        return {
          ...ref,
          get: async () => {
            if (exec.failReadAfterThrow && exec.threw) { exec.failReadAfterThrow = false; throw new Error('14 UNAVAILABLE: read failed (injected)'); }
            return ref.get();
          },
        };
      },
    };
  };
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const finalUpdate = [...db.__updates].reverse().find((u) => Array.isArray(u.evaluations)) || null;
  const feedUpdate = [...db.__updates].reverse().find((u) => Array.isArray(u.statusFeed)) || null;
  const seq = db.__updates[0]?.['cronState.tickSeq'] ?? 1;
  return {
    db, summary, stored: db.__store.battle,
    entry: finalUpdate ? finalUpdate.evaluations.at(-1) : null,
    feed: feedUpdate?.statusFeed || [],
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
  authority.mode = 'autopilot';
  Object.assign(exec, { mode: 'real', refusal: null, calls: 0, threw: false, failReadAfterThrow: false });
  guardrailHook.result = null;
  ledger.releases = []; ledger.confirms = []; ledger.reserves = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

/** Both risk-stop candidates busted → two forced exits (KO, then PG). */
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
  snapshot: null, evaluationMetadata: { exitReason: 'haiku_decision' }, outgoingSwappedInAt: null, ...overrides,
});
const FORCED = { decision: 'SWAP', symbolOut: 'KO', symbolIn: 'AMD', sourceNote: 'guardrail_stopLoss', statusMessage: 'Stop hit on KO.', overrides: [] };
const withStop = (over) => makeTickBattle({ agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [{ type: 'stopLoss', value: 1, unit: '%', enforcement: 'hard' }] }, ...over });

/**
 * The six callers: how to drive each to its executor call, the stocks its
 * call(s) bring in, and how to read its own records.
 *   landed(r)  — its success record (the trade landed and was recorded as such)
 *   failed(r)  — its failure / refusal record, or null when none was written
 *   unknown(r) — its record carrying `executionOutcome: 'unknown'`, or null
 */
const CALLERS = [
  {
    name: 'C1 risk loop', incoming: ['AMD', 'JPM'],
    run: () => runTick({ battle: makeTickBattle(), prices: bustingPrices() }),
    // KO's exit (the first call) is the one each row reads. When its outcome is
    // unknown the in-memory book is stale, so PG's exit may then pick AMD again
    // and fail for real (AMD already holds a slot) — PG's record is its own.
    landed: (r) => r.feed.find((e) => e.source === 'risk_manager' && /^Risk: /.test(e.message || '') && e.symbolIn === 'AMD') ?? null,
    failed: (r) => r.feed.find((e) => e.action === 'risk_swap_failed' && e.symbolOut === 'KO' && e.executionOutcome === undefined) ?? null,
    unknown: (r) => r.feed.find((e) => e.action === 'risk_swap_failed' && e.symbolOut === 'KO' && e.executionOutcome === 'unknown') ?? null,
  },
  {
    name: 'C2 model route', incoming: ['AMD'],
    run: () => runTick({ battle: makeTickBattle(), result: makeSwapResult() }),
    landed: (r) => (r.entry?.decision === 'SWAP' && r.entry.downgraded === false ? r.entry : null),
    failed: (r) => (r.entry?.downgraded && r.entry.validationErrors.some((e) => e.startsWith('Swap execution failed')) ? r.entry : null),
    unknown: (r) => (r.entry?.executionOutcome === 'unknown' ? r.entry : null),
  },
  {
    name: 'C3 approved proposal (dormant)', incoming: ['AMD'], dormant: true,
    run: () => runTick({ battle: makeTickBattle({ executionMode: 'copilot', pendingProposal: APPROVED_PROPOSAL() }) }),
    landed: (r) => { const row = r.stored.proposalHistory.at(-1); return row?.resolution === 'approved' && !row.executionFailed && !row.executionOutcome && r.feed.some((e) => /^Coach approved: /.test(e.message || '')) ? row : null; },
    failed: (r) => { const row = r.stored.proposalHistory.at(-1); return row?.executionFailed === true ? row : null; },
    unknown: (r) => { const row = r.stored.proposalHistory.at(-1); return row?.executionOutcome === 'unknown' ? row : null; },
  },
  {
    name: 'C4 expired co-pilot proposal (dormant)', incoming: ['AMD'], dormant: true,
    run: () => runTick({ battle: makeTickBattle({ executionMode: 'copilot', pendingProposal: APPROVED_PROPOSAL({ resolvedAt: null, resolution: null, resolvedBy: null }) }) }),
    landed: (r) => { const row = r.stored.proposalHistory.at(-1); return row?.resolution === 'auto_executed' && !row.executionFailed ? row : null; },
    failed: (r) => { const row = r.stored.proposalHistory.at(-1); return row?.resolution === 'auto_execution_failed' ? row : null; },
    unknown: (r) => { const row = r.stored.proposalHistory.at(-1); return row?.resolution === 'auto_execution_unknown' && row.executionOutcome === 'unknown' ? row : null; },
  },
  {
    name: 'C5 suppression pass', incoming: ['AMD'],
    run: () => { guardrailHook.result = FORCED; return runTick({ battle: withStop(serverMeetingOverrides({ status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T23:00:00.000Z', suggestedSwaps: [] })) }); },
    landed: (r) => r.feed.find((e) => e.action === 'guardrail_forced_swap' && e.symbolIn === 'AMD') ?? null,
    failed: (r) => r.feed.find((e) => e.action === 'risk_swap_failed' && e.executionOutcome === undefined) ?? null,
    unknown: (r) => r.feed.find((e) => e.action === 'risk_swap_failed' && e.executionOutcome === 'unknown') ?? null,
  },
  {
    name: 'C6 meeting leg', incoming: ['AMD'],
    run: () => runTick({ battle: makeTickBattle(serverMeetingOverrides({ status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'KO lagging' }] })) }),
    landed: (r) => { const leg = r.stored.gameplanMeetingHistory.at(-1)?.suggestedSwaps?.[0]; return leg && !leg.executionFailed && !leg.executionOutcome && r.feed.some((e) => e.message === 'Gameplan approved: KO → AMD') ? leg : null; },
    failed: (r) => { const row = r.stored.gameplanMeetingHistory.at(-1); return row?.suggestedSwaps?.[0]?.executionFailed === true || row?.legRefusals?.length ? row : null; },
    unknown: (r) => { const leg = r.stored.gameplanMeetingHistory.at(-1)?.suggestedSwaps?.[0]; return leg?.executionOutcome === 'unknown' ? leg : null; },
  },
];

/** Every record this tick wrote, as text — for the "No trade was made" sweep. */
const allText = (r) => JSON.stringify({ feed: r.feed, entry: r.entry, proposals: r.stored.proposalHistory, meetings: r.stored.gameplanMeetingHistory });

// ─────────────────────────────────────────────────────────────────────────────
describe('static — each of the six executor calls sits in its own try whose catch reads the trade back', () => {
  it('six calls, six call identities taken just before them, six read-backs in the catch of the call itself', () => {
    const code = CRON_SOURCE.replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    expect((code.match(/await executeSwapServer\(/g) || []).length).toBe(6);
    expect((code.match(/= executorCallOf\(\{ evaluationId: /g) || []).length).toBe(6);
    const sites = [...code.matchAll(/= await executeSwapServer\(/g)].map((m) => m.index);
    expect(sites).toHaveLength(6);
    for (const at of sites) {
      // The call's own try: the catch right after the call reads the trade back and never records anything itself.
      const after = code.slice(at, at + 2600);
      expect(after).toMatch(/\);\s*\} catch \((\w+)\) \{\s*\w+ = await swapResultAfterThrow\(battleRef, \w+, \1\);\s*\}/);
      const before = code.slice(Math.max(0, at - 900), at);
      expect(before).toMatch(/= executorCallOf\(\{ evaluationId: /);
      expect(before).toMatch(/try \{\s*\w+ $/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
for (const mode of ['off', 'shadow', 'enforce']) {
  describe(`${mode} — the ambiguous commit (one commit, then the retry throws)`, () => {
    for (const caller of CALLERS) {
      it(`${caller.name}: the landed trade is recorded as landed — no refusal or failure record, no "${NO_TRADE}", no reservation release`, async () => {
        flags.swapIdentity = mode;
        if (caller.dormant) authority.mode = 'copilot';
        exec.mode = 'ambiguous';
        const r = await caller.run();
        expect(exec.calls, 'the caller reached the executor').toBeGreaterThan(0);
        expect(exec.threw, 'the double really threw after its commit').toBe(true);
        // The trade landed — once per call, not twice — and the caller's success path recorded it.
        expect(r.stored.trades.map((t) => t.symbolIn)).toEqual(caller.incoming);
        expect(caller.landed(r), 'the success record').not.toBeNull();
        expect(caller.failed(r), 'a failure or refusal record').toBeNull();
        expect(caller.unknown(r)).toBeNull();
        expect(allText(r)).not.toContain(NO_TRADE);
        expect(allText(r)).not.toContain('did not go through');
        // The reservation stands, and was confirmed as for any landed trade.
        expect(ledger.releases).toEqual([]);
        expect(ledger.confirms).toEqual(caller.incoming);
        if (mode !== 'off') {
          for (const t of r.stored.trades) expect(t.verification?.mode).toBe(mode);
        }
      });
    }
  });

  describe(`${mode} — a real refusal (the executor threw, nothing committed): recorded as before`, () => {
    for (const caller of CALLERS) {
      it(`${caller.name}: the failure record is written and the reservation released`, async () => {
        flags.swapIdentity = mode;
        if (caller.dormant) authority.mode = 'copilot';
        exec.mode = 'refuse';
        exec.refusal = mode === 'enforce'
          ? new SwapRefusalError('outgoing_identity_mismatch', {
            verificationId: null, mode: 'enforce', expected: { symbol: 'KO', swappedInAt: null }, found: { symbol: 'XOM', swappedInAt: null },
            verdict: 'mismatch', basis: 'symbol_and_entry', battleStatus: 'active', slot: { tier: 'support', slotIndex: 0 }, tradeSeq: 0, checkedAt: FROZEN_NOW,
          }, 'Swap refused (outgoing_identity_mismatch): expected KO in support[0], found XOM')
          : new Error('Asset no longer available in slot');
        const r = await caller.run();
        expect(exec.calls).toBeGreaterThan(0);
        expect(r.stored.trades).toEqual([]);
        expect(caller.failed(r), 'the failure record').not.toBeNull();
        expect(caller.unknown(r)).toBeNull();
        expect(ledger.releases.length).toBeGreaterThan(0);
      });
    }
  });

  describe(`${mode} — the read back fails: \`executionOutcome: 'unknown'\`, no line either way, no release`, () => {
    for (const caller of CALLERS) {
      it(`${caller.name}: the typed marker, and nothing that claims the trade failed or landed`, async () => {
        flags.swapIdentity = mode;
        if (caller.dormant) authority.mode = 'copilot';
        exec.mode = 'ambiguous';
        exec.failReadAfterThrow = true;
        const r = await caller.run();
        expect(exec.threw).toBe(true);
        const marked = caller.unknown(r);
        expect(marked, 'the unknown marker').not.toBeNull();
        expect(caller.failed(r)).toBeNull();
        expect(allText(r)).not.toContain(NO_TRADE);
        expect(allText(r)).not.toContain('did not go through');
        expect(allText(r)).not.toContain('Swap execution failed');
        expect(ledger.releases).toEqual([]);
        // The first call's outcome is the unknown one: it carries no line of its own.
        if (marked.message !== undefined) expect(marked.message).toBeNull();
        expect(marked).not.toHaveProperty('refusalReason');
        expect(marked.executionRefusal ?? null).toBeNull(); // the entry's key is present (null) at mode ≠ off
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
describe('the shapes of the records', () => {
  it('C2 unknown: the entry stays a held decision (nothing downstream acts on a swap that may not exist), with the marker and no failure prefix', async () => {
    exec.mode = 'ambiguous';
    exec.failReadAfterThrow = true;
    const { entry, permanent } = await runTick({ battle: makeTickBattle(), result: makeSwapResult() });
    expect(entry).toMatchObject({ decision: 'HOLD', downgraded: true, executionOutcome: 'unknown' });
    expect(entry.validationErrors).toEqual([]);
    expect(entry).not.toHaveProperty('executionLanded');
    // Capture: the execution check ran and produced no verdict — never "passed", never "blocked".
    expect(permanent.checks.execution).toMatchObject({ status: 'failed', result: null });
  });

  it('C1 unknown: the risk loop stops there (the F1b refresh-failure stop) — no later exit picks from a book that may no longer exist, and no model call', async () => {
    exec.mode = 'ambiguous';
    exec.failReadAfterThrow = true;
    const { entry, feed, stored } = await runTick({ battle: makeTickBattle(), prices: bustingPrices() });
    // KO's exit landed (the double committed it) but could not be read back; PG's exit never ran.
    expect(exec.calls).toBe(1);
    expect(stored.trades.map((t) => t.symbolIn)).toEqual(['AMD']);
    expect(feed.filter((e) => e.action === 'risk_swap_failed')).toEqual([expect.objectContaining({ symbolOut: 'KO', executionOutcome: 'unknown', message: null })]);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(entry.haikuError.failureClass).toBe('refresh_failed');
    expect(entry.decision).toBe('HOLD');
    expect(ledger.releases).toEqual([]);
  });

  it('C2 landed: the entry is the SWAP it always was — no marker keys at all (the rebuilt result is exact)', async () => {
    exec.mode = 'ambiguous';
    const { entry, permanent } = await runTick({ battle: makeTickBattle(), result: makeSwapResult() });
    expect(entry.decision).toBe('SWAP');
    expect(entry).not.toHaveProperty('executionOutcome');
    expect(entry).not.toHaveProperty('executionLanded');
    expect(permanent.checks.execution).toMatchObject({ status: 'evaluated', result: 'passed' });
  });

  it('a trade confirmed after the throw whose incoming position another writer already moved: recorded as landed, marked `confirmed_after_error`', async () => {
    exec.mode = 'partial';
    const { entry, stored } = await runTick({ battle: makeTickBattle(), result: makeSwapResult() });
    expect(stored.trades.map((t) => t.symbolIn)).toEqual(['AMD']);
    expect(entry).toMatchObject({ decision: 'SWAP', downgraded: false, executionLanded: 'confirmed_after_error' });
    expect(ledger.releases).toEqual([]);
  });

  it('C1 partial: the success beat carries the marker; C6 partial: the leg on the history row does', async () => {
    exec.mode = 'partial';
    const risk = await runTick({ battle: makeTickBattle(), prices: bustingPrices() });
    expect(risk.feed.find((e) => /^Risk: /.test(e.message || '') && e.symbolIn === 'AMD')).toMatchObject({ executionLanded: 'confirmed_after_error' });
    ledger.releases = []; ledger.confirms = [];
    const meeting = await runTick({ battle: makeTickBattle(serverMeetingOverrides({ status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'r' }] })) });
    expect(meeting.stored.gameplanMeetingHistory.at(-1).suggestedSwaps[0]).toMatchObject({ executionLanded: 'confirmed_after_error' });
    expect(meeting.feed.filter((e) => e.message === V13_KO_AMD)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('table F V1.3 — the approved-meeting failure line is written only when the read confirms no trade', () => {
  const meetingBattle = () => makeTickBattle(serverMeetingOverrides({ status: 'approved', diagnosis: 'drag', expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'r' }] }));

  for (const mode of ['off', 'shadow']) {
    it(`${mode}: an untyped executor throw with nothing committed → the leg \`executionFailed: true\` and one hold beat in V1.3's words`, async () => {
      flags.swapIdentity = mode;
      exec.mode = 'refuse';
      exec.refusal = new Error('Asset no longer available in slot');
      const { stored, feed } = await runTick({ battle: meetingBattle() });
      expect(stored.gameplanMeetingHistory.at(-1).suggestedSwaps[0]).toMatchObject({ executionFailed: true });
      const beats = feed.filter((e) => e.source === 'gameplan_meeting');
      expect(beats).toEqual([expect.objectContaining({ message: V13_KO_AMD, action: 'hold', symbolOut: 'KO', symbolIn: 'AMD' })]);
      expect(beats[0]).not.toHaveProperty('refusalReason');
    });
  }

  it('enforce: a typed refusal keeps P6\'s own table F line (one beat — never the V1.3 line beside it); the leg is still marked failed', async () => {
    flags.swapIdentity = 'enforce';
    exec.mode = 'refuse';
    exec.refusal = new SwapRefusalError('battle_not_active', {
      verificationId: null, mode: 'enforce', expected: { symbol: 'KO', swappedInAt: null }, found: { symbol: 'KO', swappedInAt: null },
      verdict: 'match', basis: 'symbol_and_entry', battleStatus: 'completed', slot: { tier: 'support', slotIndex: 0 }, tradeSeq: 0, checkedAt: FROZEN_NOW,
    }, 'Swap refused (battle_not_active)');
    const { stored, feed } = await runTick({ battle: meetingBattle() });
    const beats = feed.filter((e) => e.source === 'gameplan_meeting');
    expect(beats.map((b) => b.message)).toEqual(['This trade arrived after the battle ended. No trade was made.']);
    const row = stored.gameplanMeetingHistory.at(-1);
    expect(row.legRefusals).toHaveLength(1);
    expect(row.suggestedSwaps[0]).toMatchObject({ executionFailed: true });
  });

  it('never when the read finds the trade, never when the read fails', async () => {
    exec.mode = 'ambiguous';
    const landed = await runTick({ battle: meetingBattle() });
    expect(landed.feed.some((e) => e.message === V13_KO_AMD)).toBe(false);
    Object.assign(exec, { threw: false, failReadAfterThrow: true });
    const unknown = await runTick({ battle: meetingBattle() });
    expect(unknown.feed.some((e) => e.message === V13_KO_AMD)).toBe(false);
    expect(unknown.feed.filter((e) => e.source === 'gameplan_meeting')).toEqual([]);
  });

  it('a throw that is not the executor\'s (the reserve fails) records as before: no marker, no V1.3 line', async () => {
    const { reserveSymbol } = await import('../_utils/tournamentAgentLedger.js');
    reserveSymbol.mockImplementationOnce(async () => { throw new Error('ledger down'); });
    const { stored, feed } = await runTick({ battle: meetingBattle() });
    expect(exec.calls).toBe(0);
    expect(stored.gameplanMeetingHistory.at(-1).suggestedSwaps[0]).not.toHaveProperty('executionFailed');
    expect(feed.some((e) => e.message === V13_KO_AMD)).toBe(false);
  });
});
