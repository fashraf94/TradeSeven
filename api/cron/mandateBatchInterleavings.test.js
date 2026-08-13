// api/cron/mandateBatchInterleavings.test.js
//
// Spec 1 §3.3 (P5) — the BATCH-STATE interleavings the kickoff names, driven
// through the REAL runEvalSweep / batch transport / §3.5 execution against the
// transaction-faithful fake (the P4 harness substrate — extended here with
// batch-state scenarios; interleavings the harness can express are proven, not
// hand-waved):
//
//   (a) full cycle — submit at open30 (no model call, gate set), harvest at
//       midday (executes at the HARVEST mark), SAME-tick re-submission;
//   (b) duplicate harvest — a crash between execution and the batch-state
//       write leaves the entry undisposed; the re-harvest no-ops on the claim
//       (exactly-once), re-bills nothing, and converges the batch doc;
//   (c) harvest racing the close pass — the close commits inside the exec
//       txn's window; the txn retries against the winner and the result dies
//       base_revision (discarded, never applied at a moved state);
//   (d) escape with a REAL open batch — cancelled inside the escape txn; the
//       batch's late result no-ops on the claim (never executed);
//   (e) the LAST-TICK rule (F3) — preClose is harvest-only under batch;
//   (f) the F26 mid-flight flip — under 'direct' the tick neither harvests nor
//       re-submits a gated book; the EXPLICIT drain disposes; results are
//       never executed under the new mode;
//   (g) a failed-snapshot tick still harvests (degraded context): entries fail
//       closed, EXITS STILL FILL at carry-over (C-21 holds degraded);
//   (h) slow tier submits on its early slot by construction and its result is
//       harvested by a later fire it is tier-INELIGIBLE for.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const batchApi = { create: vi.fn(), retrieve: vi.fn(), results: vi.fn(), cancel: vi.fn() };
const directSpy = vi.fn();
vi.mock('../_utils/mandateModelCall.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    createMandateBatch: (...a) => batchApi.create(...a),
    retrieveMandateBatch: (...a) => batchApi.retrieve(...a),
    mandateBatchResults: (...a) => batchApi.results(...a),
    cancelMandateBatch: (...a) => batchApi.cancel(...a),
    callMandateModelDirect: (...a) => directSpy(...a),
  };
});

// Snapshot BUILDERS mocked for the failed-snapshot scenario only; every
// classification/marking helper stays real (the harvest depends on them).
let ensureUniverseSnapshotImpl = null;
vi.mock('../_utils/mandateUniverseSnapshot.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    ensureUniverseSnapshot: (...a) => (ensureUniverseSnapshotImpl ? ensureUniverseSnapshotImpl(...a) : actual.ensureUniverseSnapshot(...a)),
    ensureDailySnapshot: async (db, { date }) => ({ ref: db.collection('mandateUniverseDaily').doc(date) }),
  };
});

import { runEvalSweep } from './mandate-evaluate.js';
import { drainOpenBatches, MANDATE_BATCH_COLLECTION } from '../_utils/mandateBatchTransport.js';
import { buildSubmissionEnvelope } from '../_utils/mandateModelCall.js';
import { closeBook } from '../_utils/mandateClosePass.js';
import { escapeMandate } from '../_utils/mandateEscape.js';
import { makeMandateFakeDb } from '../_utils/__testsupport__/mandateFakeFirestore.js';
import { buildNewMandateDoc } from '../_utils/mandateSchema.js';

const OPEN30 = { date: '2026-08-12', slot: 'open30', tickKey: '2026-08-12_open30' };
const MIDDAY = { date: '2026-08-12', slot: 'midday', tickKey: '2026-08-12_midday' };
const PRECLOSE = { date: '2026-08-12', slot: 'preClose', tickKey: '2026-08-12_preClose' };
const T_OPEN30 = new Date('2026-08-12T14:05:00Z');  // 10:05 ET
const T_MIDDAY = new Date('2026-08-12T16:50:00Z');  // 12:50 ET
const T_PRECLOSE = new Date('2026-08-12T19:35:00Z'); // 15:35 ET

const VINTAGE = {
  codeId: 'analyst',
  displayVintage: 'Fundamental Investor v2',
  archetypeContent: { displayName: 'Fundamental Investor', identity: { reveal: 'You buy good businesses.', voice: 'v' }, character: { factors: {} } },
  gateConfig: { cashFloorPct: 0.02, minPositions: 5, maxPositions: 15, maxSinglePositionWeightPct: 0.35, sectorConcentrationCap: 0.30, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] },
  modelSeat: { model: 'claude-haiku-4-5-20251001', params: { temperature: 0.7, maxTokens: 600 } },
};

function seedBook(overrides = {}) {
  const doc = buildNewMandateDoc({
    mandateId: overrides.mandateId || 'm1',
    userId: 'u1', archetype: 'analyst', managerAgentId: 'mgr_analyst_x',
    vintageRef: 'archetypeVintages/analyst_x',
    cadenceTier: overrides.cadenceTier || 'fast',
    createdAt: new Date('2026-08-01T13:00:00Z'),
    quarterStartAt: new Date('2026-08-01T13:00:00Z'),
    nextRolloverAt: new Date('2026-11-02T21:00:00Z'),
    escapeHatchEligibleUntil: new Date('2026-08-15T13:00:00Z'),
  });
  return {
    ...doc,
    ...overrides,
    health: { ...doc.health, ...(overrides.health || {}) },
    execState: { ...doc.execState, ...(overrides.execState || {}) },
    portfolio: { ...doc.portfolio, ...(overrides.portfolio || {}) },
  };
}

function snap(tickKey, price, asOf) {
  return {
    tickKey,
    symbols: { AAPL: { complete: true, price, sector: 'Technology', marketCap: 3e12, priceAsOf: asOf } },
  };
}
const SNAP_OPEN30 = snap(OPEN30.tickKey, 200, '2026-08-12T14:00:00Z');
const SNAP_MIDDAY = snap(MIDDAY.tickKey, 201, '2026-08-12T16:45:00Z');

function fakeReqRes() {
  const req = { headers: { 'x-vercel-cron': '1' }, method: 'POST' };
  const captured = {};
  const res = {
    status(code) { captured.code = code; return this; },
    json(body) { captured.body = body; return this; },
  };
  return { req, res, captured };
}

function toolUse(input, usage = { input_tokens: 1200, output_tokens: 60 }) {
  return { type: 'succeeded', message: { content: [{ type: 'tool_use', name: 'submit_mandate_decision', input }], usage } };
}
function asAsyncIterable(rows) {
  return { async* [Symbol.asyncIterator]() { for (const r of rows) yield r; } };
}

function baseDb(extra = {}) {
  return makeMandateFakeDb({
    'archetypeVintages/analyst_x': VINTAGE,
    [`mandateUniverseSnapshots/${OPEN30.tickKey}`]: SNAP_OPEN30,
    [`mandateUniverseSnapshots/${MIDDAY.tickKey}`]: SNAP_MIDDAY,
    ...extra,
  });
}

beforeEach(() => {
  batchApi.create.mockReset();
  batchApi.retrieve.mockReset();
  batchApi.results.mockReset();
  batchApi.cancel.mockReset();
  directSpy.mockReset();
  ensureUniverseSnapshotImpl = null;
});

async function fire(db, tick, now, transport = 'batch') {
  const { req, res, captured } = fakeReqRes();
  await runEvalSweep(req, res, { now, tick, db, transport });
  return captured;
}

describe('(a) full cycle — submit at open30, harvest + re-submit at midday', () => {
  it('walks the whole machine: no model call at submit; execution at the HARVEST mark; same-tick re-submission', async () => {
    const db = baseDb({ 'mandates/m1': seedBook() });
    batchApi.create.mockResolvedValueOnce({ id: 'msgbatch_a1' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Fire 1 (open30): enqueue + submit.
    const f1 = await fire(db, OPEN30, T_OPEN30);
    expect(f1.body.enqueued).toBe(1);
    expect(f1.body.batch).toMatchObject({ providerBatchId: 'msgbatch_a1', gated: 1 });
    expect(directSpy).not.toHaveBeenCalled(); // batch mode never calls the direct seam
    const gated = db._get('mandates/m1');
    const requestId = gated.execState.openBatchId;
    expect(requestId).toBeTruthy();
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_a1`).status).toBe('open');

    // Fire 2 (midday): harvest executes at the HARVEST mark; the sweep then
    // re-submits the book at its NEW revision in the same tick.
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: '2026-08-12T14:20:00Z' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: requestId, result: toolUse({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'q' }) },
    ]));
    batchApi.create.mockResolvedValueOnce({ id: 'msgbatch_a2' });

    const f2 = await fire(db, MIDDAY, T_MIDDAY);
    spy.mockRestore();
    expect(f2.body.harvest).toMatchObject({ polled: 1, harvested: 1, disposed: 1 });
    expect(f2.body.enqueued).toBe(1); // harvested THEN re-submitted, same tick

    const dec = db._get(`mandates/m1/decisions/${requestId}`);
    expect(dec.status).toBe('executed');
    expect(dec.submitTickKey).toBe(OPEN30.tickKey);   // I3: dual tick keys
    expect(dec.harvestTickKey).toBe(MIDDAY.tickKey);
    // Fill basis = HARVEST mark 201 (+ friction up), never the submit mark 200.
    expect(dec.executedPrice).toBeGreaterThan(201);

    const book = db._get('mandates/m1');
    expect(book.portfolio.positions.AAPL).toBeDefined();
    expect(book.execState.openBatchId).not.toBe(requestId); // a NEW submission is open
    expect(book.execState.openBatchId).toBeTruthy();
    expect(book.execState.openProviderBatchId).toBe('msgbatch_a2');
    expect(book.execState.submitted).toBe(1);
    expect(book.execState.executed).toBe(1);
    expect(book.costTelemetry.tokensIn).toBe(1200); // billed at harvest from result usage
  });
});

describe('(b) duplicate harvest / crash between execution and the batch-state write', () => {
  it('the re-harvest no-ops on the claim: one execution, one bill, batch doc converges', async () => {
    // CRASH SHAPE: executeDecision committed (decision + book mutation + gate
    // clear) but the process died before markDisposed — the batch doc still
    // lists the entry undisposed. The next fire re-processes it.
    const book = seedBook();
    const env = buildSubmissionEnvelope({
      mandateId: 'm1', baseRevision: 0, quarterKey: book.quarterKey, vintageRef: book.vintageRef,
      snapshotTickKey: OPEN30.tickKey, bookStatus: 'active', submittedAt: T_OPEN30.toISOString(), sessionDate: OPEN30.date,
    });
    const db = baseDb({ 'mandates/m1': seedBook({ execState: { openBatchId: env.requestId, openBatchSubmittedAt: T_OPEN30, openProviderBatchId: 'msgbatch_b' } }) });
    db._store.set(`${MANDATE_BATCH_COLLECTION}/msgbatch_b`, {
      data: {
        schemaVersion: 1, providerBatchId: 'msgbatch_b', tickKey: OPEN30.tickKey, sessionDate: OPEN30.date,
        status: 'open', submittedAt: T_OPEN30, requestCount: 1, disposed: {},
        entries: { [env.requestId]: { mandateId: 'm1', model: VINTAGE.modelSeat.model, verbs: VINTAGE.gateConfig.decisionVerbs, envelope: env } },
      },
      version: 1,
    });
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'x' });
    const result = toolUse({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'q' });
    batchApi.results.mockResolvedValue(asAsyncIterable([{ custom_id: env.requestId, result }]));

    // First harvest — the execution commits.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const f1 = await fire(db, MIDDAY, T_MIDDAY);
    expect(f1.body.harvest.disposed).toBe(1);
    const afterFirst = db._get('mandates/m1');
    const cashAfter = afterFirst.portfolio.cash;
    const revAfter = afterFirst.revision;
    const tokensAfter = afterFirst.costTelemetry.tokensIn;

    // CRASH INJECTION: wipe the batch-state write (disposed map + status) as if
    // the process died between the execution txn and markDisposed.
    const bdoc = db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_b`);
    db._store.set(`${MANDATE_BATCH_COLLECTION}/msgbatch_b`, {
      data: { ...bdoc, status: 'open', disposed: {}, harvestedAt: null, turnaroundMs: null },
      version: db._versionOf(`${MANDATE_BATCH_COLLECTION}/msgbatch_b`) + 1,
    });

    // Second harvest (the "two fires poll the same batch" shape) — must no-op.
    const f2 = await fire(db, MIDDAY, new Date(T_MIDDAY.getTime() + 5 * 60_000));
    spy.mockRestore();
    const afterSecond = db._get('mandates/m1');
    expect(afterSecond.portfolio.cash).toBe(cashAfter);          // executed ONCE (F2)
    // Revision moved only by the fire-2 re-submission gate? No — gate set does
    // not bump revision; ANY second execution would have. Assert unchanged:
    expect(afterSecond.revision).toBe(revAfter);
    expect(afterSecond.costTelemetry.tokensIn).toBe(tokensAfter); // no double bill
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_b`).status).toBe('harvested'); // converged
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_b`).disposed[env.requestId]).toBe('executed');
  });
});

describe('(c) harvest racing the close pass — revision discipline decides', () => {
  it('the close commits inside the exec txn window; the retried txn rejects the result base_revision', async () => {
    const book = seedBook({
      portfolio: {
        cash: 90000,
        positions: { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, lastMark: 200, lastMarkAsOf: '2026-08-11T20:00:00Z', lastMarkSource: 'snapshot', sector: 'Technology', openedAt: '2026-08-01' } },
        totalValue: 100000, initialValue: 100000, sectorWeights: {},
        lifetimeHighWaterMark: 10_000_000, lifetimeDrawdownFromPeak: 0,
        quarterHighWaterMark: 10_000_000, quarterDrawdownFromPeak: 0, frictionPaidCum: 0,
      },
    });
    const env = buildSubmissionEnvelope({
      mandateId: 'm1', baseRevision: 0, quarterKey: book.quarterKey, vintageRef: book.vintageRef,
      snapshotTickKey: OPEN30.tickKey, bookStatus: 'active', submittedAt: T_OPEN30.toISOString(), sessionDate: OPEN30.date,
    });
    const db = baseDb({
      'mandates/m1': { ...book, execState: { ...book.execState, openBatchId: env.requestId, openBatchSubmittedAt: T_OPEN30, openProviderBatchId: 'msgbatch_c' } },
    });
    db._store.set(`${MANDATE_BATCH_COLLECTION}/msgbatch_c`, {
      data: {
        schemaVersion: 1, providerBatchId: 'msgbatch_c', tickKey: OPEN30.tickKey, sessionDate: OPEN30.date,
        status: 'open', submittedAt: T_OPEN30, requestCount: 1, disposed: {},
        entries: { [env.requestId]: { mandateId: 'm1', model: VINTAGE.modelSeat.model, verbs: VINTAGE.gateConfig.decisionVerbs, envelope: env } },
      },
      version: 1,
    });
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'x' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: toolUse({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'q' }) },
    ]));
    const closeSnapshot = { tickKey: '2026-08-12_close', symbols: { AAPL: { complete: true, price: 210, sector: 'Technology', marketCap: 3e12, priceAsOf: '2026-08-12T20:05:00Z' } } };

    // Nested barrier: skip the lease txn, then fire the CLOSE inside the exec
    // txn's window — the exec txn's committed read-set is stale → retry → the
    // fresh read sees revision+1 → validateEnvelope rejects base_revision.
    // The close's `now` stays INSIDE the 4h result-age window on purpose: a
    // later close would trigger its own open-batch expiry duty and claim the
    // decision 'expired' first (a DIFFERENT correct convergence, audit-noted);
    // this test pins the base_revision path specifically.
    db.setBarrier(async () => {
      db.setBarrier(async () => {
        await closeBook(db, db.doc('mandates/m1'), {
          date: '2026-08-12', closeSnapshot, now: new Date('2026-08-12T17:00:00Z'),
          regime: { regime: 'risk_on', regimeAsOf: 'x', regimeSource: 's' },
        });
      });
    });

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = await fire(db, MIDDAY, T_MIDDAY);
    spy.mockRestore();
    expect(f.body.harvest.disposed).toBe(1);

    const dec = db._get(`mandates/m1/decisions/${env.requestId}`);
    expect(dec.status).toBe('rejected_stale');
    expect(dec.failCondition).toBe('base_revision'); // discarded, never applied at a moved state
    const after = db._get('mandates/m1');
    expect(after.portfolio.positions.AAPL.shares).toBe(50);       // no fill
    expect(after.portfolio.totalValue).toBe(90000 + 50 * 210);    // the close's marks stand
    expect(after.execState.lastCloseKey).toBe('2026-08-12');
    expect(db._txAttempts()).toBeGreaterThanOrEqual(4);           // lease + exec-first-attempt + close + exec-retry
  });
});

describe('(d) escape cancels a REAL open batch; the late result never executes', () => {
  it('escape → decision cancelled + gate cleared; the batch\'s valid result then no-ops on the claim', async () => {
    const book = seedBook();
    const env = buildSubmissionEnvelope({
      mandateId: 'm1', baseRevision: 0, quarterKey: book.quarterKey, vintageRef: book.vintageRef,
      snapshotTickKey: OPEN30.tickKey, bookStatus: 'active', submittedAt: T_OPEN30.toISOString(), sessionDate: OPEN30.date,
    });
    const db = baseDb({
      'mandates/m1': seedBook({ execState: { openBatchId: env.requestId, openBatchSubmittedAt: T_OPEN30, openProviderBatchId: 'msgbatch_d' } }),
      'userMeta/u1': { activeMandateId: 'm1', mandateEscapeHatchUsed: false },
    });
    db._store.set(`${MANDATE_BATCH_COLLECTION}/msgbatch_d`, {
      data: {
        schemaVersion: 1, providerBatchId: 'msgbatch_d', tickKey: OPEN30.tickKey, sessionDate: OPEN30.date,
        status: 'open', submittedAt: T_OPEN30, requestCount: 1, disposed: {},
        entries: { [env.requestId]: { mandateId: 'm1', model: VINTAGE.modelSeat.model, verbs: VINTAGE.gateConfig.decisionVerbs, envelope: env } },
      },
      version: 1,
    });

    // The REAL escape (P4 core), mid-window, with the batch in flight.
    const esc = await escapeMandate(db, {
      userId: 'u1', archetype: 'contrarian', now: new Date('2026-08-12T15:00:00Z'),
    });
    expect(esc.ok).toBe(true);
    expect(db._get(`mandates/m1/decisions/${env.requestId}`).status).toBe('cancelled'); // I1 lifecycle word
    expect(db._get('mandates/m1').execState.openBatchId).toBe(null);
    expect(db._get('mandates/m1').execState.openProviderBatchId).toBe(null); // the FULL gate block cleared

    // The batch later returns a perfectly-valid-looking result → claim no-op.
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'x' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: toolUse({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'q' }) },
    ]));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = await fire(db, MIDDAY, T_MIDDAY);
    spy.mockRestore();

    expect(db._get(`mandates/m1/decisions/${env.requestId}`).status).toBe('cancelled'); // unchanged — never executed
    expect(db._get('mandates/m1').status).toBe('closed'); // the voided book untouched by the late result
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_d`).status).toBe('harvested');
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_d`).disposed[env.requestId]).toBe('cancelled');
    // The replacement book is untouched by any of it.
    expect(esc.newMandateId).toBeTruthy();
    expect(db._get(`mandates/${esc.newMandateId}`).portfolio.cash).toBe(10_000_000);
  });
});

describe('(e) the last-tick rule (F3): preClose is harvest-only under batch', () => {
  it('harvests but never pages or submits at the session\'s final tick; direct transport is untouched', async () => {
    const db = baseDb({
      'mandates/m1': seedBook(),
      [`mandateUniverseSnapshots/${PRECLOSE.tickKey}`]: snap(PRECLOSE.tickKey, 202, '2026-08-12T19:32:00Z'),
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = await fire(db, PRECLOSE, T_PRECLOSE, 'batch');
    expect(f.body.reason).toBe('last_tick_no_submit');
    expect(f.body.enqueued).toBe(0);
    expect(f.body.harvest).toBeDefined();          // the harvest RAN
    expect(batchApi.create).not.toHaveBeenCalled(); // no submission
    expect(directSpy).not.toHaveBeenCalled();

    // Control: DIRECT transport evaluates normally at preClose (F3 is satisfied
    // trivially — submit and harvest share the tick).
    directSpy.mockResolvedValue({ decision: { ok: true, input: { verb: 'HOLD', rationale: 'steady' } }, usage: null });
    const f2 = await fire(db, PRECLOSE, new Date(T_PRECLOSE.getTime() + 60_000), 'direct');
    spy.mockRestore();
    expect(directSpy).toHaveBeenCalledTimes(1);
    expect(f2.body.evaluated).toBe(1);
  });
});

describe('(f) F26 mid-flight flip: results are never executed under the new mode', () => {
  it("under 'direct' the tick neither harvests nor re-evals a gated book; the explicit drain disposes; post-drain the book evaluates direct", async () => {
    const book = seedBook();
    const env = buildSubmissionEnvelope({
      mandateId: 'm1', baseRevision: 0, quarterKey: book.quarterKey, vintageRef: book.vintageRef,
      snapshotTickKey: OPEN30.tickKey, bookStatus: 'active', submittedAt: T_OPEN30.toISOString(), sessionDate: OPEN30.date,
    });
    const db = baseDb({
      'mandates/m1': seedBook({ execState: { openBatchId: env.requestId, openBatchSubmittedAt: T_OPEN30, openProviderBatchId: 'msgbatch_f' } }),
    });
    db._store.set(`${MANDATE_BATCH_COLLECTION}/msgbatch_f`, {
      data: {
        schemaVersion: 1, providerBatchId: 'msgbatch_f', tickKey: OPEN30.tickKey, sessionDate: OPEN30.date,
        status: 'open', submittedAt: T_OPEN30, requestCount: 1, disposed: {},
        entries: { [env.requestId]: { mandateId: 'm1', model: VINTAGE.modelSeat.model, verbs: VINTAGE.gateConfig.decisionVerbs, envelope: env } },
      },
      version: 1,
    });

    // MODE FLIPPED: the tick under 'direct' does not poll batches (harvest is
    // never an implicit drain) and the gated book cannot submit under the new
    // mode (the F26 gate is transport-independent).
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const f1 = await fire(db, MIDDAY, T_MIDDAY, 'direct');
    expect(f1.body.harvest).toBeUndefined();
    expect(batchApi.retrieve).not.toHaveBeenCalled();
    expect(directSpy).not.toHaveBeenCalled();       // gated → no direct eval either
    expect(f1.body.skipped).toBeGreaterThanOrEqual(1);
    expect(db._get(`mandates/m1/decisions/${env.requestId}`)).toBeUndefined(); // nothing implicit happened

    // The EXPLICIT drain (founder-invoked).
    batchApi.cancel.mockResolvedValue({});
    const drained = await drainOpenBatches(db, { now: new Date(T_MIDDAY.getTime() + 60_000) });
    expect(drained).toMatchObject({ batches: 1, disposed: 1 });
    const dec = db._get(`mandates/m1/decisions/${env.requestId}`);
    expect(dec.status).toBe('rejected_stale');                    // drained per protocol —
    expect(dec.failCondition).toBe('drained_transport_change');   // — never executed under the new mode
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_f`).status).toBe('cancelled');

    // Book resumes under the new mode at its NEXT slot (the F26-gate skip
    // stamped this slot's sweep key — a one-slot cost, not a lockout).
    directSpy.mockResolvedValue({ decision: { ok: true, input: { verb: 'HOLD', rationale: 'steady' } }, usage: null });
    db._store.set(`mandateUniverseSnapshots/${PRECLOSE.tickKey}`, { data: snap(PRECLOSE.tickKey, 202, '2026-08-12T19:32:00Z'), version: 1 });
    const f2 = await fire(db, PRECLOSE, T_PRECLOSE, 'direct');
    spy.mockRestore();
    expect(directSpy).toHaveBeenCalledTimes(1);
    expect(f2.body.evaluated).toBe(1);
  });
});

describe('(g) a failed-snapshot tick still harvests — C-21 holds degraded', () => {
  it('entries fail closed at the gate; an EXIT fills at the carry-over mark', async () => {
    const held = {
      AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, lastMark: 205, lastMarkAsOf: '2026-08-11T20:00:00Z', lastMarkSource: 'snapshot', sector: 'Technology', openedAt: '2026-08-01' },
    };
    const bookA = seedBook({ mandateId: 'mExit', portfolio: { cash: 90000, positions: held, totalValue: 100250 } });
    const envA = buildSubmissionEnvelope({
      mandateId: 'mExit', baseRevision: 0, quarterKey: bookA.quarterKey, vintageRef: bookA.vintageRef,
      snapshotTickKey: OPEN30.tickKey, bookStatus: 'active', submittedAt: T_OPEN30.toISOString(), sessionDate: OPEN30.date,
    });
    const bookB = seedBook({ mandateId: 'mEntry' });
    const envB = buildSubmissionEnvelope({
      mandateId: 'mEntry', baseRevision: 0, quarterKey: bookB.quarterKey, vintageRef: bookB.vintageRef,
      snapshotTickKey: OPEN30.tickKey, bookStatus: 'active', submittedAt: T_OPEN30.toISOString(), sessionDate: OPEN30.date,
    });
    const db = baseDb({
      'mandates/mExit': { ...bookA, execState: { ...bookA.execState, openBatchId: envA.requestId, openBatchSubmittedAt: T_OPEN30, openProviderBatchId: 'msgbatch_g' } },
      'mandates/mEntry': { ...bookB, execState: { ...bookB.execState, openBatchId: envB.requestId, openBatchSubmittedAt: T_OPEN30, openProviderBatchId: 'msgbatch_g' } },
    });
    db._store.set(`${MANDATE_BATCH_COLLECTION}/msgbatch_g`, {
      data: {
        schemaVersion: 1, providerBatchId: 'msgbatch_g', tickKey: OPEN30.tickKey, sessionDate: OPEN30.date,
        status: 'open', submittedAt: T_OPEN30, requestCount: 2, disposed: {},
        entries: {
          [envA.requestId]: { mandateId: 'mExit', model: VINTAGE.modelSeat.model, verbs: VINTAGE.gateConfig.decisionVerbs, envelope: envA },
          [envB.requestId]: { mandateId: 'mEntry', model: VINTAGE.modelSeat.model, verbs: VINTAGE.gateConfig.decisionVerbs, envelope: envB },
        },
      },
      version: 1,
    });
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'x' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: envA.requestId, result: toolUse({ verb: 'SELL', ticker: 'AAPL', rationale: 'de-risk' }) },
      { custom_id: envB.requestId, result: toolUse({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'q' }) },
    ]));
    // The MIDDAY snapshot build FAILS (no doc seeded, builder throws).
    ensureUniverseSnapshotImpl = async () => { throw new Error('injected upstream outage'); };

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, {
      now: T_MIDDAY,
      tick: { ...MIDDAY, tickKey: '2026-08-12_midday_unbuilt' },
      db, transport: 'batch',
    });
    spy.mockRestore();
    expect(captured.body.reason).toBe('snapshot_failed');
    expect(captured.body.harvest.disposed).toBe(2); // the tick STILL harvested (§3.1)

    // EXIT: filled at the carry-over mark (205), never suppressed (C-21).
    const decA = db._get(`mandates/mExit/decisions/${envA.requestId}`);
    expect(decA.status).toBe('executed');
    expect(decA.fillMarkQuality).toBe('carry_over');
    expect(db._get('mandates/mExit').portfolio.positions.AAPL).toBeUndefined(); // fully exited
    // ENTRY: failed closed at the universe gate (no snapshot data).
    const decB = db._get(`mandates/mEntry/decisions/${envB.requestId}`);
    expect(decB.status).toBe('gated');
    expect(db._get('mandates/mEntry').portfolio.cash).toBe(10_000_000); // no fill
  });
});

describe('(h) slow tier — submits on its early slot by construction; harvested by a fire it is tier-ineligible for', () => {
  it('open30 submit (slow eligible), midday harvest executes even though slow is midday-ineligible', async () => {
    const db = baseDb({ 'mandates/mSlow': seedBook({ mandateId: 'mSlow', cadenceTier: 'slow' }) });
    batchApi.create.mockResolvedValueOnce({ id: 'msgbatch_s1' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const f1 = await fire(db, OPEN30, T_OPEN30);
    expect(f1.body.enqueued).toBe(1); // slow submits at open30 — F3-safe by construction
    const requestId = db._get('mandates/mSlow').execState.openBatchId;

    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'x' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: requestId, result: toolUse({ verb: 'HOLD', rationale: 'patience' }) },
    ]));
    const f2 = await fire(db, MIDDAY, T_MIDDAY);
    spy.mockRestore();
    expect(f2.body.harvest.disposed).toBe(1);          // harvest is tier-INDEPENDENT
    expect(f2.body.enqueued).toBe(0);                  // but slow does NOT re-submit at midday
    expect(f2.body.skipped).toBeGreaterThanOrEqual(1); // tier-skip stamped
    expect(db._get(`mandates/mSlow/decisions/${requestId}`).status).toBe('executed');
    expect(db._get('mandates/mSlow').execState.openBatchId).toBe(null);
  });
});
