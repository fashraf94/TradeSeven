// api/cron/agent-evaluate.setupMenuLabels.test.js
//
// Measured Trend Evidence Slice 2 — the observation end to end on the REAL processAgentBattle (spec V2
// §4–§5, as amended by the founder's kickoff of 7 Nov 2026, Corrections A, C and D). The tick harness,
// the frozen clock, the seven-position book; the shared setup-evidence store is an in-memory
// `setupEvidence` collection whose reads a row can hold, fail or let through.
//
// What this suite proves:
//   · flag off (and owner not allowlisted, and capture off): ZERO reads of the store or the state, no
//     `setupMenu` key, and every pre-existing write, the model request and the record unchanged;
//   · the 64 s (calls off) and 68 s (calls shadow) model-admission boundaries decide exactly as with
//     Slice 2 off, with the store's reads held — the admission is computed before any read exists;
//   · Correction A: nothing waits. An immediate no-trigger exit takes only what is available (a state
//     read still pending is `stateRead: false`); a model call that outlasts the reads finds them; hung
//     and rejected reads cost the tick nothing; battles sharing one handler clock share the run memo;
//   · Correction C: a composer that throws leaves the record's other fields and the body identical;
//   · Correction D.2: membership is literal — original-bench, asset-map, held and unranked names;
//   · no block before the pool exists (row 1.9).
//
// `executeSwapServer` is doubled through a hoisted variable so the literal call string never appears
// here (the repo-level call-site census reads this file as a non-consumer).

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW, RANKINGS_COMPUTED_AT_MS, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs,
  makeIntradayCandles, makeHoldResult, makeToolUseResponse,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCallsDb } from '../_utils/__fixtures__/callRecordsStore.js';
import { permanentDoc, bodyDoc } from '../_utils/__fixtures__/tickCaptureHarness.js';
import { runWithTickCaptureScope } from '../_utils/tickCapture/captureContext.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const { swapMock } = vi.hoisted(() => ({ swapMock: vi.fn() }));
const flagState = vi.hoisted(() => ({ labels: true, tickCapture: true, callsMode: 'off', allow: ['owner-uid-1'] }));
const admissions = vi.hoisted(() => []);
const composeHook = vi.hoisted(() => ({ throwMessage: null, advanceMs: 0 }));

vi.mock('../_utils/executionAuthority.js', () => ({ get LAUNCH_EXECUTION_MODE() { return 'autopilot'; } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } },
}));
// importOriginal spread: the store's key and session modules need isCryptoSymbol and toEtParts.
vi.mock('../_utils/marketDataCache.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => ({ ...(await importOriginal()), executeSwapServer: swapMock }));
// The admission decision, RECORDED (never altered): its inputs and its answer, per tick.
vi.mock('../_utils/agentEvalTransport.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, shouldStartHaikuCall: (args) => { const r = real.shouldStartHaikuCall(args); admissions.push({ args: { ...args }, r: { ...r } }); return r; } };
});
vi.mock('../_utils/setupMenuLabels/compose.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, composeSetupMenuBlock: (...a) => {
    if (composeHook.throwMessage) throw new Error(composeHook.throwMessage);
    if (composeHook.advanceMs && a[1]) vi.setSystemTime(new Date(Date.now() + composeHook.advanceMs)); // a[1]: the settle's observation (null at the freeze)
    return real.composeSetupMenuBlock(...a);
  } };
});
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
vi.mock('../_utils/callRecords/allowlist.js', async (importOriginal) => ({ ...(await importOriginal()), readCockpitAllowlist: () => flagState.allow }));
vi.mock('../../src/config/setupMenuLabelsFlags.js', () => ({ get SETUP_MENU_LABELS_ENABLED() { return flagState.labels; } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    SWAP_IDENTITY_MODE: 'off',
    get CALL_RECORDS_MODE() { return flagState.callsMode; },
    get TICK_CAPTURE_ENABLED() { return flagState.tickCapture; },
  };
});

const { processAgentBattle } = await import('./agent-evaluate.js');
const { snapshotFor, breakoutRows, downRows } = await import('../_utils/setupMenuLabels/__fixtures__/menuSnapshots.js');
const { snapshotIdOf } = await import('../_utils/setupEvidence/index.js');
const { describeRuleSet } = await import('../_utils/setupEvaluator/thresholds.js');

const TIME_BUDGET_MS = 290_000; // agent-evaluate.js
const SESSION = '2026-09-08'; // the last completed session at FROZEN_NOW (Wed 11:00 ET)
const BATTLE_ID = 'battle-tick-1';
const STORE_COLLECTIONS = ['setupEvidence', 'setupEvidenceClaims', 'setupMenuLabelState'];
const ruleSet = describeRuleSet();
const idOf = (s) => snapshotIdOf({ session: SESSION, symbol: s, ruleSet });
class APIConnectionError extends Error {}

/**
 * The hot bench, literal (Correction D.2): AMD is on the hot bench AND in the original bench (in P and M,
 * never in the asset map); CRM, ORCL and PLTR are ranked and become asset-map bench assets (P and M);
 * NVDA is held (P only); ZZZT has no ranking row, so no asset (P only, not held).
 */
const HOT = ['AMD', 'CRM', 'ORCL', 'NVDA', 'PLTR', 'ZZZT'];
const EXTRA = ['CRM', 'ORCL', 'PLTR'];

function tfBattle(over = {}) {
  const base = makeTickBattle();
  return makeTickBattle({
    agentContext: { ...base.agentContext, archetype: 'momentum_chaser' },
    watchlist: { active: [], hotBench: [...HOT], monitoring: [], lastRefreshed: '2026-09-09T13:31:00.000Z', totalStocks: 0 },
    // Rankings already consumed and today already evaluated: the hot bench is CARRIED (no rebuild).
    cronState: { ...base.cronState, lastHotBenchComputedAt: RANKINGS_COMPUTED_AT_MS, lastEvalTradingDay: 1 },
    ...over,
  });
}
function rankings() {
  const doc = makeRankingsDoc();
  const amd = doc.stocks.find((s) => s.symbol === 'AMD');
  return { ...doc, stocks: [...doc.stocks, ...EXTRA.map((symbol) => ({ ...amd, symbol, name: symbol }))] };
}
function prices() {
  const p = makePriceTable();
  for (const s of [...EXTRA, 'ZZZT']) p[s] = { ...p.AMD };
  return p;
}
function flat(p) {
  for (const [symbol, row] of Object.entries(p)) p[symbol] = { ...row, current: row.previousClose, changePercent: 0 };
  return p;
}
function quiet(doc) {
  return { ...doc, stocks: doc.stocks.map((row) => ({ ...row, bBandwidthPercentile: 70, nr7Flag: false })) };
}
const noTrigger = () => ({
  battle: tfBattle({ evaluations: [{ evalId: 'eval_1', timestamp: '2026-09-09T14:45:00.000Z', decision: 'HOLD', symbolOut: null, symbolIn: null, tier: null, rationale: 'held', hypothesis: null }] }),
  p: flat(prices()),
  rankingsDoc: quiet(rankings()),
});

let SNAPSHOTS;
beforeAll(async () => {
  SNAPSHOTS = {
    CRM: (await snapshotFor({ session: SESSION, symbol: 'CRM', fetchedAt: '2026-09-09T13:00:00.000Z', rows: breakoutRows(SESSION) })).snapshot,
    ORCL: (await snapshotFor({ session: SESSION, symbol: 'ORCL', fetchedAt: '2026-09-09T13:00:00.000Z', rows: downRows(SESSION) })).snapshot,
  };
});

/**
 * The store beside the tick db: every access to its collections is logged; a document read can be held
 * (until `release()`), failed, or delayed in real milliseconds. Shared across battles of one run.
 */
function makeSlice2Store({ hold = [], fail = [], delayMs = {}, state = null } = {}) {
  const access = [];
  const waiters = [];
  const store = {
    access,
    release: async () => { for (const w of waiters.splice(0)) w(); for (let i = 0; i < 10; i++) await Promise.resolve(); },
    attach(db) {
      const base = db.collection.bind(db);
      db.collection = (col) => {
        if (!STORE_COLLECTIONS.includes(col)) return base(col);
        access.push(col);
        return {
          doc: (id) => ({
            id, path: `${col}/${id}`,
            async get() {
              access.push(`${col}/${id}`);
              const key = col === 'setupMenuLabelState' ? 'state' : id;
              if (hold.includes(key) || hold.includes('*')) await new Promise((r) => waiters.push(r));
              if (Number.isFinite(delayMs[key])) await new Promise((r) => setTimeout(r, delayMs[key]));
              if (fail.includes(key)) throw new Error('read failed (injected)');
              if (col === 'setupMenuLabelState') return { exists: state !== null, id, data: () => (state === null ? undefined : structuredClone(state)) };
              const symbol = Object.keys(SNAPSHOTS).find((s) => idOf(s) === id);
              const data = symbol ? SNAPSHOTS[symbol] : undefined;
              return { exists: data !== undefined, id, data: () => structuredClone(data) };
            },
          }),
        };
      };
      return db;
    },
  };
  return store;
}

async function runTick({
  battle = tfBattle(), result = makeHoldResult(), p = prices(), rankingsDoc = rankings(), cronStartTime = Date.now(),
  labels = true, capture = true, callsMode = 'off', allow = ['owner-uid-1'], slice2 = makeSlice2Store(), summary = {},
  modelThrows = null, modelDelayMs = 0,
} = {}) {
  flagState.labels = labels;
  flagState.tickCapture = capture;
  flagState.callsMode = callsMode;
  flagState.allow = allow;
  admissions.length = 0;
  mocks.create.mockReset();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (p[symbol] ? { price: p[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => {
    if (modelDelayMs) await new Promise((r) => setTimeout(r, modelDelayMs));
    if (modelThrows) throw modelThrows;
    return makeToolUseResponse(result);
  });
  const db = slice2.attach(makeCallsDb({ battle, rankingsDoc, techDocs: makeTechDocs() }));
  let thrown = null;
  try {
    await runWithTickCaptureScope(() => processAgentBattle(db, battle, summary, cronStartTime, new Map(), { everEnabled: false }));
  } catch (err) { thrown = err; }
  const seq = db.__updates[0]?.['cronState.tickSeq'] ?? 1;
  return {
    db, thrown, slice2, admissions: [...admissions],
    request: mocks.create.mock.calls[0]?.[0] ?? null,
    permanent: permanentDoc(db, BATTLE_ID, `${BATTLE_ID}:${seq}`),
    body: bodyDoc(db, BATTLE_ID, `${BATTLE_ID}:${seq}`),
    updates: db.__updates,
  };
}
const withoutBlock = (permanent) => { if (!permanent) return permanent; const { setupMenu, ...rest } = permanent; return rest; };
const cand = (r, symbol) => r.permanent.setupMenu.candidates.find((c) => c.symbol === symbol);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  swapMock.mockReset();
  composeHook.throwMessage = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// ─────────────────────────────────────────────────────────────────────────────
describe('disabled: nothing is read, nothing changes (rows 5.8, 1.6, G.3)', () => {
  it.each([
    ['flag off', { labels: false }],
    ['owner not on the allowlist', { allow: ['someone-else'] }],
  ])('%s: zero store/state access, no setupMenu key, and the record, the model request and every write equal a run with the store untouched', async (_l, opts) => {
    const off = await runTick({ ...opts });
    expect(off.slice2.access).toEqual([]);
    expect(off.permanent).not.toBeNull();
    expect(Object.hasOwn(off.permanent, 'setupMenu')).toBe(false);
    const on = await runTick({});
    expect(on.permanent.setupMenu).toBeTruthy();
    expect(withoutBlock(on.permanent)).toEqual(off.permanent);
    expect(on.body).toEqual(off.body);
    expect(on.request).toEqual(off.request);
    expect(on.updates).toEqual(off.updates);
  });
  it('another archetype is out of scope: nothing read, no key', async () => {
    const r = await runTick({ battle: tfBattle({ agentContext: { ...makeTickBattle().agentContext, archetype: 'analyst' } }) });
    expect(r.slice2.access).toEqual([]);
    expect(Object.hasOwn(r.permanent, 'setupMenu')).toBe(false);
  });
  it('1.6 capture off, flag on: zero reads of the store or the state, no throw, no record', async () => {
    const r = await runTick({ capture: false });
    expect(r.thrown).toBeNull();
    expect(r.slice2.access).toEqual([]);
    expect(r.db.__captureWrites).toEqual([]);
  });
});

// THE CLOCK IS FROZEN in this suite (Date only). These rows therefore prove ORDER and the ABSENCE OF A WAIT —
// the admission is computed before any read exists and nothing awaits a read — never equal CPU time: Slice 2's
// synchronous work is real and is measured, not asserted away (review SM2-2; the build report's cost table).
describe('Correction A — the model-admission boundaries are untouched (rows 1.1, 1.2)', () => {
  const at = (remainingMs) => Date.parse(FROZEN_NOW) - (TIME_BUDGET_MS - remainingMs);
  it.each([
    ['64 s, calls off: 65,000 ms left → admitted both ways', 'off', 65_000, true],
    ['64 s, calls off: 63,999 ms left → skipped both ways', 'off', 63_999, false],
    ['68 s, calls shadow: 69,000 ms left → admitted both ways', 'shadow', 69_000, true],
    ['68 s, calls shadow: 67,999 ms left → skipped both ways', 'shadow', 67_999, false],
  ])('%s, with the state read and every snapshot read HELD', async (_l, callsMode, remaining, admitted) => {
    const off = await runTick({ labels: false, callsMode, cronStartTime: at(remaining) });
    const slice2 = makeSlice2Store({ hold: ['*'] });
    const on = await runTick({ labels: true, callsMode, cronStartTime: at(remaining), slice2 });
    for (const r of [off, on]) {
      expect(r.admissions).toHaveLength(1);
      expect(r.admissions[0].r.proceed).toBe(admitted);
    }
    expect(on.admissions[0]).toEqual(off.admissions[0]); // the same inputs and answer on the frozen clock: no read was waited for before it
    expect(on.admissions[0].args.callsReserveMs).toBe(callsMode === 'shadow' ? 4_000 : 0);
    expect(on.admissions[0].r.requiredMs).toBe(callsMode === 'shadow' ? 68_000 : 64_000);
    expect(Boolean(on.request)).toBe(admitted);
    expect(Boolean(off.request)).toBe(admitted);
    expect(withoutBlock(on.permanent)).toEqual(off.permanent);
    expect(on.updates).toEqual(off.updates);
    if (!admitted) expect(on.permanent.model.failureClass ?? on.permanent.model.outcome).toBeTruthy();
    // The reads were started AFTER the admission and are still held: nothing waited for them.
    expect(on.permanent.setupMenu.blockStatus).toBe('reads_unsettled');
    await slice2.release();
  });
});

describe('Correction A — no wait: only what is already available', () => {
  it('1.3 corrected: an immediate no-trigger exit with the state read still pending → stateRead false, every s2 field null; nothing waits, and whatever had not arrived is read_unsettled', async () => {
    const slice2 = makeSlice2Store({ hold: ['state'], state: { schemaVersion: 1, attempts: { [idOf('PLTR')]: { session: SESSION, n: 1, lastOutcome: 'retryable', lastAt: 1 } } } });
    const r = await runTick({ ...noTrigger(), slice2 });
    expect(r.permanent.exitReason).toBe('no_trigger');
    expect(r.permanent.setupMenu.stateRead).toBe(false);
    for (const c of r.permanent.setupMenu.candidates) {
      expect(c).toMatchObject({ s2Entry: null, s2Reservations: null, s2LastOutcome: null, s2LastAt: null, s2Exhausted: null });
      expect(['labelled', 'absent', 'read_unsettled']).toContain(c.status);
    }
    // In this harness the exit's own awaited write settles before the snapshot reads do: they are unsettled, not waited for.
    expect(r.permanent.setupMenu.counts.unsettled).toBeGreaterThan(0);
    expect(r.permanent.setupMenu.blockStatus).toBe('reads_unsettled');
    const recorded = structuredClone(r.permanent);
    await slice2.release();
    expect(permanentDoc(r.db, BATTLE_ID, recorded.tickId)).toEqual(recorded); // a late state result patches nothing
  });
  it('A-4 a model call that naturally outlasts the reads finds them, state included — with no added wait', async () => {
    const slice2 = makeSlice2Store({ delayMs: { state: 5, [idOf('CRM')]: 5 }, state: { schemaVersion: 1, attempts: { [idOf('PLTR')]: { session: SESSION, n: 2, lastOutcome: 'retryable', lastAt: 1 } } } });
    const r = await runTick({ slice2, modelDelayMs: 40 });
    expect(r.permanent.exitReason).toBe('completed');
    expect(r.permanent.setupMenu).toMatchObject({ stateRead: true, blockStatus: 'ok' });
    expect(cand(r, 'CRM')).toMatchObject({ status: 'labelled', verdict: 'valid' });
    expect(cand(r, 'ORCL')).toMatchObject({ status: 'labelled', verdict: 'invalid', reason: 'regime' });
    expect(cand(r, 'PLTR')).toMatchObject({ status: 'absent', s2Entry: true, s2Reservations: 2, s2LastOutcome: 'retryable' });
    expect(cand(r, 'AMD')).toMatchObject({ status: 'absent', s2Entry: false });
  });
  it('1.4 hung reads: the tick completes, every candidate read_unsettled, and nothing waited for them (frozen clock: the capture budget matches the flag-off run)', async () => {
    const off = await runTick({ labels: false });
    const slice2 = makeSlice2Store({ hold: ['*'] });
    const on = await runTick({ slice2 });
    expect(on.thrown).toBeNull();
    expect(on.permanent.setupMenu.blockStatus).toBe('reads_unsettled');
    expect(on.permanent.setupMenu.candidates.every((c) => c.status === 'read_unsettled')).toBe(true);
    expect(on.permanent.capture.remainingBudgetMs).toBe(off.permanent.capture.remainingBudgetMs);
    await slice2.release();
  });
  it('rejected reads: read_failed, stateRead false, the tick unaffected', async () => {
    const off = await runTick({ labels: false });
    const on = await runTick({ slice2: makeSlice2Store({ fail: ['state', idOf('CRM'), idOf('ORCL')] }) });
    expect(on.thrown).toBeNull();
    expect(on.permanent.setupMenu.stateRead).toBe(false);
    expect([cand(on, 'CRM').status, cand(on, 'ORCL').status]).toEqual(['read_failed', 'read_failed']);
    expect(withoutBlock(on.permanent)).toEqual(off.permanent);
    expect(on.updates).toEqual(off.updates);
  });
  it('A-10 two battles on one handler clock: battle 1\'s hung reads are never waited for by battle 2 (frozen clock), are shared, and are never issued twice', async () => {
    const summary = {};
    const slice2 = makeSlice2Store({ hold: [idOf('CRM')] });
    const first = await runTick({ slice2, summary });
    const offSecond = await runTick({ labels: false });
    const second = await runTick({ slice2, summary });
    expect(first.permanent.setupMenu.readsIssued).toBeGreaterThan(0);
    expect(second.permanent.setupMenu).toMatchObject({ readsIssued: 0 });
    expect(second.permanent.setupMenu.readsShared).toBe(first.permanent.setupMenu.readsIssued);
    expect(slice2.access.filter((a) => a === `setupEvidence/${idOf('CRM')}`)).toHaveLength(1);
    expect(slice2.access.filter((a) => a === 'setupMenuLabelState/main')).toHaveLength(1);
    expect(cand(second, 'CRM').status).toBe('read_unsettled');
    expect(cand(second, 'ORCL').status).toBe('labelled');
    expect(second.permanent.capture.remainingBudgetMs).toBe(offSecond.permanent.capture.remainingBudgetMs);
    await slice2.release();
  });
});

describe('Correction C — an optional block\'s failure is contained (rows 1.7, 5.5)', () => {
  it('the composer throws at the capture stage: the error form; every other record field, and the whole body, equal the flag-off run', async () => {
    const off = await runTick({ labels: false });
    composeHook.throwMessage = 'composer exploded';
    const on = await runTick({});
    expect(on.permanent.setupMenu).toMatchObject({ blockStatus: 'error', errorCode: 'compose_failed', session: SESSION });
    expect(withoutBlock(on.permanent)).toEqual(off.permanent);
    expect(on.body).toEqual(off.body);
    expect(on.body.faults.capture).toBeNull();
  });
  it('a bench whose stocks are a truthy non-array cannot reach the fault text through the freeze', async () => {
    // The freeze's own input thunk throws inside the freeze's try — the tick's other steps are not this row's subject.
    const { freezeSetupMenuPool } = await import('../_utils/setupMenuLabels/reads.js');
    const { createTickCaptureContext } = await import('../_utils/tickCapture/captureContext.js');
    await runWithTickCaptureScope(async () => {
      const ctx = createTickCaptureContext({ battleId: 'b', tickSeq: 1, enabled: true });
      freezeSetupMenuPool(ctx, tfBattle(), () => ({ benchAtFreeze: (7).map((a) => a) }));
      expect(ctx.state.setupMenu).toMatchObject({ blockStatus: 'error', errorCode: 'freeze_failed' });
      expect(ctx.state.faulted).toBeNull();
    });
  });
});

describe('Correction D.2 — membership is literal; the real lists are unchanged (rows 6.1, 5.2)', () => {
  it('original-bench ∩ hot bench, asset-map names, a held name, an unranked name — each from the frozen sets', async () => {
    const r = await runTick({});
    const c = Object.fromEntries(r.permanent.setupMenu.candidates.map((x) => [x.symbol, x]));
    expect(r.permanent.setupMenu.candidates.map((x) => x.symbol)).toEqual(HOT);
    expect(c.AMD).toMatchObject({ source: 'hotbench', inBenchAtFreeze: true, heldAtFreeze: false });
    for (const s of EXTRA) expect(c[s]).toMatchObject({ source: 'hotbench', inBenchAtFreeze: true, heldAtFreeze: false });
    expect(c.NVDA).toMatchObject({ inBenchAtFreeze: false, heldAtFreeze: true });
    expect(c.ZZZT).toMatchObject({ inBenchAtFreeze: false, heldAtFreeze: false });
    expect(r.permanent.setupMenu).toMatchObject({ presentedCount: HOT.length + EXTRA.length, uniqueCount: HOT.length, omittedCount: 0, selector: 'carried', rebuilt: false, session: SESSION });
    // Original-bench names outside P are not candidates.
    expect(c.JPM).toBeUndefined();
  });
  it('the model sees the same bench and the same request as with Slice 2 off', async () => {
    const off = await runTick({ labels: false });
    const on = await runTick({});
    expect(on.request).toEqual(off.request);
    expect(JSON.stringify(on.request)).not.toMatch(/setupMenu|capturedBeforeFreeze|s2Reservations/);
  });
  it('a transport failure after dispatch is recorded with its own model fields beside the block', async () => {
    const r = await runTick({ modelThrows: new APIConnectionError('socket hang up') });
    expect(r.permanent.model).toMatchObject({ outcome: 'failed', attempted: true });
    expect(r.permanent.setupMenu.candidates.length).toBe(HOT.length);
  });
  it('a rebuild tick records the selector that built the menu', async () => {
    const base = tfBattle();
    const r = await runTick({ battle: tfBattle({ cronState: { ...base.cronState, lastHotBenchComputedAt: 0 } }) });
    expect(r.permanent.setupMenu).toMatchObject({ rebuilt: true });
    expect(['archetype', 'legacy']).toContain(r.permanent.setupMenu.selector);
  });
});

describe('review SM2-1 / SM2-3 — the base record\'s budget, and the error exit', () => {
  it('SM2-1 the settle\'s own CPU cannot move the capture-floor decision: a settle that costs 3 ms at 10,002 ms left still writes the record, with the flag-off budget', async () => {
    const at = Date.parse(FROZEN_NOW) - (TIME_BUDGET_MS - 10_002);
    const off = await runTick({ labels: false, cronStartTime: at });
    composeHook.advanceMs = 3; // the mocked composer moves the (frozen) clock by 3 ms when it composes at the settle
    const on = await runTick({ cronStartTime: at });
    composeHook.advanceMs = 0;
    expect(off.permanent.capture.remainingBudgetMs).toBe(10_002);
    expect(on.permanent).not.toBeNull();
    expect(on.permanent.capture.remainingBudgetMs).toBe(off.permanent.capture.remainingBudgetMs);
  });
  it('SM2-3 an error exit after the reads started is sealed at once and its record carries its own read start and counts', async () => {
    const { newTickCaptureScope, runInTickCaptureScope, claimTickCaptureContext } = await import('../_utils/tickCapture/captureContext.js');
    const { finalizeTickCapture } = await import('../_utils/tickCapture/captureWriter.js');
    flagState.labels = true; flagState.tickCapture = true; flagState.callsMode = 'off'; flagState.allow = ['owner-uid-1'];
    const p = prices();
    mocks.create.mockReset();
    mocks.getStockAnalysisData.mockImplementation(async (symbol) => (p[symbol] ? { price: p[symbol], daily: [] } : {}));
    mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
    mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
    const slice2 = makeSlice2Store({ hold: ['*'] });
    const db = slice2.attach(makeCallsDb({ battle: tfBattle(), rankingsDoc: rankings(), techDocs: makeTechDocs() }));
    // The final battle update (the one carrying evaluations) throws: a tick_error after the reads started.
    const base = db.collection.bind(db);
    db.collection = (col) => {
      const c = base(col);
      if (col !== 'agentBattles') return c;
      return { ...c, doc: (id) => { const ref = c.doc(id); return { ...ref, update: async (payload) => { if (Array.isArray(payload?.evaluations)) throw new Error('final update failed (injected)'); return ref.update(payload); } }; } };
    };
    const scope = newTickCaptureScope();
    let thrown = null;
    try { await runInTickCaptureScope(scope, () => processAgentBattle(db, tfBattle(), {}, Date.now(), new Map(), { everEnabled: false })); } catch (err) { thrown = err; }
    expect(thrown?.message).toMatch(/final update failed/);
    const ctx = claimTickCaptureContext(scope);
    await finalizeTickCapture(db, ctx, { remainingBudgetMs: 200_000 });
    const rec = permanentDoc(db, BATTLE_ID, ctx.state.tickId);
    expect(rec.exitReason).toBe('tick_error');
    expect(rec.setupMenu).toMatchObject({ blockStatus: 'reads_unsettled', readsStartedAt: expect.any(String), observedAt: expect.any(String) });
    expect(rec.setupMenu.readsIssued).toBeGreaterThan(0);
    const before = slice2.access.length;
    await slice2.release();
    expect(slice2.access.length).toBe(before); // sealed: nothing queued was started after the error
  });
});

describe('the tick never waits on Slice 2 (Correction A), in source', () => {
  it('the six Slice 2 calls in agent-evaluate.js are never awaited; the capture budget is read before the settle, which sits immediately before finalizeTickCapture; the error exit settles too', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./agent-evaluate.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const calls = [...src.matchAll(/^.*\b(freezeSetupMenuPool|startSetupMenuReads|settleSetupMenuReads|sealSetupMenuReads)\(.*$/gm)].map((m) => m[0]);
    expect(calls.filter((l) => !/^\s*import\b/.test(l))).toHaveLength(6);
    for (const line of calls) expect(line).not.toMatch(/\bawait\b/);
    expect(src).toMatch(/const captureRemainingBudgetMs = TIME_BUDGET_MS - \(Date\.now\(\) - cronStartTime\);\n(?:\s*\/\/.*\n)*\s*settleSetupMenuReads\(setupMenuReads, tickCapture\);\n\s*const captureResult = await finalizeTickCapture\(db, tickCapture, \{\n\s*remainingBudgetMs: captureRemainingBudgetMs,/);
    expect(src).toMatch(/tickCapture\.exit\('tick_error'\);\n\s*\}\);\n(?:\s*\/\/.*\n)*\s*settleSetupMenuReads\(setupMenuReads, tickCapture\);/);
    // The admission test is computed before the read start that follows it.
    expect(src.indexOf('const budget = shouldStartHaikuCall(')).toBeLessThan(src.indexOf('setupMenuReads = startSetupMenuReads({ db, tickCapture, summary });', src.indexOf('const budget = shouldStartHaikuCall(')));
  });
});

describe('no block before the pool exists (row 1.9)', () => {
  it.each([
    ['degraded_quotes', () => { const p = prices(); delete p.NVDA; return { p }; }],
    ['gameplan_created', () => ({ battle: tfBattle({ cronState: { ...tfBattle().cronState, lastGameplanDate: null } }) })],
  ])('%s: no setupMenu key and no read', async (exit, opts) => {
    const r = await runTick(opts());
    expect(r.permanent.exitReason).toBe(exit);
    expect(Object.hasOwn(r.permanent, 'setupMenu')).toBe(false);
    expect(r.slice2.access).toEqual([]);
  });
});
