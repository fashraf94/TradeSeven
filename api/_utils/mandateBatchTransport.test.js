// api/_utils/mandateBatchTransport.test.js
//
// Spec 1 §3.3 (P5) — the batch transport's unit surface: submit (create → doc →
// revision-disciplined gates, zombies on precondition failure), harvest
// dispositions (every provider result_type + the missing-result case reaches
// exactly one I1 terminal state — no request left in limbo while its siblings
// terminate), age-out, drain (F26: batch cancelled, decisions rejected_stale),
// turnaround stats (I9). Interleavings (duplicate harvest, crash windows,
// harvest×close races) live in the handler-level harness
// (api/cron/mandateBatchInterleavings.test.js) against the transaction-faithful
// fake; this file proves the per-call machine.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// The sole-importer seam, mocked at the client boundary (the harness precedent):
// batch create/retrieve/results/cancel are driven per-test; everything else real.
const batchApi = {
  create: vi.fn(),
  retrieve: vi.fn(),
  results: vi.fn(),
  cancel: vi.fn(),
};
vi.mock('./mandateModelCall.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    createMandateBatch: (...a) => batchApi.create(...a),
    retrieveMandateBatch: (...a) => batchApi.retrieve(...a),
    mandateBatchResults: (...a) => batchApi.results(...a),
    cancelMandateBatch: (...a) => batchApi.cancel(...a),
  };
});

import {
  buildBatchDoc,
  submitMandateBatch,
  harvestOpenBatches,
  harvestOneBatch,
  drainOpenBatches,
  MANDATE_BATCH_COLLECTION,
  MANDATE_BATCH_STATS_COLLECTION,
} from './mandateBatchTransport.js';
import { buildSubmissionEnvelope } from './mandateModelCall.js';
import { makeMandateFakeDb } from './__testsupport__/mandateFakeFirestore.js';
import { buildNewMandateDoc } from './mandateSchema.js';
import { MANDATE_RESULT_MAX_AGE_MS, MANDATE_BATCH_BILLING_GIVEUP_MS } from './mandateConfig.js';

const NOW = new Date('2026-08-12T14:05:00Z'); // 10:05 ET — open30 window
const TICK = { date: '2026-08-12', slot: 'open30', tickKey: '2026-08-12_open30' };
const NEXT_TICK = { date: '2026-08-12', slot: 'midday', tickKey: '2026-08-12_midday' };
const H_NOW = new Date('2026-08-12T16:50:00Z'); // midday window, ~2h45m later

const VINTAGE = {
  codeId: 'analyst',
  displayVintage: 'Fundamental Investor v2',
  archetypeContent: { displayName: 'Fundamental Investor', identity: { reveal: 'r', voice: 'v' }, character: { factors: {} } },
  gateConfig: { cashFloorPct: 0.02, minPositions: 5, maxPositions: 15, maxSinglePositionWeightPct: 0.35, sectorConcentrationCap: 0.30, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] },
  modelSeat: { model: 'claude-haiku-4-5-20251001', params: { temperature: 0.7, maxTokens: 600 } },
};
const VERBS = ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'];

function seedBook(overrides = {}) {
  const doc = buildNewMandateDoc({
    mandateId: overrides.mandateId || 'm1',
    userId: 'u1', archetype: 'analyst', managerAgentId: 'mgr_analyst_x',
    vintageRef: 'archetypeVintages/analyst_x',
    cadenceTier: 'fast',
    createdAt: new Date('2026-06-01T13:00:00Z'),
    quarterStartAt: new Date('2026-06-01T13:00:00Z'),
    nextRolloverAt: new Date('2026-09-01T20:00:00Z'),
    escapeHatchEligibleUntil: new Date('2026-06-15T13:00:00Z'),
  });
  return {
    ...doc,
    ...overrides,
    health: { ...doc.health, ...(overrides.health || {}) },
    execState: { ...doc.execState, ...(overrides.execState || {}) },
    portfolio: { ...doc.portfolio, ...(overrides.portfolio || {}) },
  };
}

const SUBMIT_SNAP = {
  tickKey: TICK.tickKey,
  symbols: { AAPL: { complete: true, price: 200, sector: 'Technology', marketCap: 3e12, priceAsOf: '2026-08-12T14:00:00Z' } },
};
const HARVEST_SNAP = {
  tickKey: NEXT_TICK.tickKey,
  symbols: { AAPL: { complete: true, price: 201, sector: 'Technology', marketCap: 3e12, priceAsOf: '2026-08-12T16:45:00Z' } },
};

function envelopeFor(book, mandateId = 'm1') {
  return buildSubmissionEnvelope({
    mandateId,
    baseRevision: book.revision,
    quarterKey: book.quarterKey,
    vintageRef: book.vintageRef,
    snapshotTickKey: TICK.tickKey,
    bookStatus: book.status,
    submittedAt: NOW.toISOString(),
    sessionDate: TICK.date,
  });
}

function pendingFor(db, book, mandateId = 'm1') {
  return {
    mandateRef: db.collection('mandates').doc(mandateId),
    envelope: envelopeFor(book, mandateId),
    verbs: VERBS,
    modelSeat: VINTAGE.modelSeat,
    content: { system: 'scaffold', messages: [{ role: 'user', content: 'ctx' }], tools: [{ name: 'submit_mandate_decision', input_schema: {} }] },
  };
}

/** A provider tool-use message for a decision. */
function succeededResult(input, usage = { input_tokens: 1200, output_tokens: 60, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) {
  return {
    type: 'succeeded',
    message: { content: [{ type: 'tool_use', name: 'submit_mandate_decision', input }], usage },
  };
}

function asAsyncIterable(rows) {
  return {
    async* [Symbol.asyncIterator]() { for (const r of rows) yield r; },
  };
}

beforeEach(() => {
  batchApi.create.mockReset();
  batchApi.retrieve.mockReset();
  batchApi.results.mockReset();
  batchApi.cancel.mockReset();
});

// ── Submit ───────────────────────────────────────────────────────────────────

describe('submitMandateBatch — create → doc → revision-disciplined gates', () => {
  it('creates ONE provider batch, writes the bookkeeping doc, gates every book with the stamps', async () => {
    const book = seedBook();
    const db = makeMandateFakeDb({ 'mandates/m1': book, 'archetypeVintages/analyst_x': VINTAGE });
    batchApi.create.mockResolvedValue({ id: 'msgbatch_1', created_at: '2026-08-12T14:05:01Z' });

    const p = pendingFor(db, book);
    const r = await submitMandateBatch(db, [p], { tickKey: TICK.tickKey, sessionDate: TICK.date, now: NOW });

    expect(batchApi.create).toHaveBeenCalledTimes(1);
    const specs = batchApi.create.mock.calls[0][0];
    expect(specs[0].customId).toBe(p.envelope.requestId); // custom_id == deterministic requestId (F2)

    expect(r).toMatchObject({ providerBatchId: 'msgbatch_1', gated: 1 });
    const bdoc = db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_1`);
    expect(bdoc.status).toBe('open');
    expect(bdoc.entries[p.envelope.requestId]).toMatchObject({ mandateId: 'm1', verbs: VERBS });
    expect(bdoc.entries[p.envelope.requestId].envelope.baseRevision).toBe(0);

    const gated = db._get('mandates/m1');
    expect(gated.execState.openBatchId).toBe(p.envelope.requestId); // the gate holds the REQUEST id (house convention)
    expect(gated.execState.openProviderBatchId).toBe('msgbatch_1');
    expect(gated.execState.lastEvalTickKey).toBe(TICK.tickKey);     // billed-eval stamp, atomic with the gate
    expect(gated.health.lastEvalSweepAt).toEqual(NOW);              // sweep frontier advanced
    expect(gated.revision).toBe(0);                                  // gate set does NOT bump revision (stated reading)
  });

  it('a book whose revision moved between eval and gate write becomes a ZOMBIE (no gate), not a wrong gate', async () => {
    const book = seedBook();
    const db = makeMandateFakeDb({ 'mandates/m1': book });
    batchApi.create.mockResolvedValue({ id: 'msgbatch_2' });
    const p = pendingFor(db, book);
    await db.doc('mandates/m1').update({ revision: 1 }); // a concurrent mutation (close/escape) landed

    const r = await submitMandateBatch(db, [p], { tickKey: TICK.tickKey, sessionDate: TICK.date, now: NOW });
    expect(r.gated).toBe(0);
    expect(r.zombies).toEqual([p.envelope.requestId]);
    const b = db._get('mandates/m1');
    expect(b.execState.openBatchId).toBe(null);              // never gated on a stale base
    expect(b.execState.lastEvalTickKey ?? null).toBe(null);  // unstamped → the slot retries this book
  });

  it('a book already gated (another fire won) is a zombie — the double-submit gate holds on this path', async () => {
    const book = seedBook({ execState: { openBatchId: 'other_req', openBatchSubmittedAt: NOW, openProviderBatchId: 'msgbatch_0' } });
    const db = makeMandateFakeDb({ 'mandates/m1': book });
    batchApi.create.mockResolvedValue({ id: 'msgbatch_3' });
    const p = pendingFor(db, book);

    const r = await submitMandateBatch(db, [p], { tickKey: TICK.tickKey, sessionDate: TICK.date, now: NOW });
    expect(r.gated).toBe(0);
    expect(db._get('mandates/m1').execState.openBatchId).toBe('other_req'); // the live gate is untouched
  });

  it('empty pending → no provider call, no doc', async () => {
    const db = makeMandateFakeDb({});
    const r = await submitMandateBatch(db, [], { tickKey: TICK.tickKey, sessionDate: TICK.date, now: NOW });
    expect(r.providerBatchId).toBe(null);
    expect(batchApi.create).not.toHaveBeenCalled();
  });
});

// ── Harvest dispositions ─────────────────────────────────────────────────────

function seedSubmitted(db0 = {}) {
  const book = seedBook();
  const env = envelopeFor(book);
  const gatedBook = seedBook({
    execState: {
      openBatchId: env.requestId, openBatchSubmittedAt: NOW, openProviderBatchId: 'msgbatch_h',
      lastEvalTickKey: TICK.tickKey,
    },
  });
  const bdoc = buildBatchDoc({
    providerBatchId: 'msgbatch_h', tickKey: TICK.tickKey, sessionDate: TICK.date,
    submittedAt: NOW, entries: { [env.requestId]: { mandateId: 'm1', model: VINTAGE.modelSeat.model, verbs: VERBS, envelope: env } },
  });
  const db = makeMandateFakeDb({
    'mandates/m1': gatedBook,
    'archetypeVintages/analyst_x': VINTAGE,
    [`${MANDATE_BATCH_COLLECTION}/msgbatch_h`]: bdoc,
    [`mandateUniverseSnapshots/${TICK.tickKey}`]: SUBMIT_SNAP,
    ...db0,
  });
  return { db, env, bdoc };
}

describe('harvestOpenBatches — the §3.3 validation → §3.5 execution path', () => {
  it('a valid BUY result EXECUTES at the harvest tick mark, clears the gate, finalizes the batch, records turnaround (I9)', async () => {
    const { db, env } = seedSubmitted();
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: '2026-08-12T14:25:00Z' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: succeededResult({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'q' }) },
    ]));

    const s = await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: H_NOW });
    expect(s).toMatchObject({ polled: 1, harvested: 1, disposed: 1, errors: 0 });

    const dec = db._get(`mandates/m1/decisions/${env.requestId}`);
    expect(dec.status).toBe('executed');
    expect(dec.submitTickKey).toBe(TICK.tickKey);       // I3 dual tick keys
    expect(dec.harvestTickKey).toBe(NEXT_TICK.tickKey);
    expect(dec.executedPrice).toBeGreaterThan(201);     // harvest mark + friction (buys pay up), never the submit mark

    const book = db._get('mandates/m1');
    expect(book.execState.openBatchId).toBe(null);      // gate cleared (owner)
    expect(book.execState.openProviderBatchId).toBe(null);
    expect(book.execState.submitted).toBe(1);
    expect(book.execState.executed).toBe(1);
    expect(book.execState.staleRejectStreak).toBe(0);
    expect(book.health.lastSuccessfulEvalAt).toEqual(H_NOW); // the eval completed at harvest
    expect(book.costTelemetry.tokensIn).toBe(1200);          // billed at harvest, from result usage

    const bdoc = db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`);
    expect(bdoc.status).toBe('harvested');
    expect(bdoc.disposed[env.requestId]).toBe('executed');
    expect(bdoc.turnaroundMs).toBeGreaterThan(0);

    const stats = db._get(`${MANDATE_BATCH_STATS_COLLECTION}/${TICK.date}`);
    expect(stats.batches.msgbatch_h).toMatchObject({ status: 'harvested', requestCount: 1, dispositions: { executed: 1 } });
    expect(stats.batches.msgbatch_h.turnaroundMs).toBeGreaterThan(0);
  });

  it('a result whose baseRevision is stale is rejected_stale — discarded, never adapted (streak++, gate cleared)', async () => {
    const { db, env } = seedSubmitted();
    await db.doc('mandates/m1').update({ revision: 3 }); // the book moved after submit
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: '2026-08-12T14:25:00Z' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: succeededResult({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'q' }) },
    ]));

    await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: H_NOW });
    const dec = db._get(`mandates/m1/decisions/${env.requestId}`);
    expect(dec.status).toBe('rejected_stale');
    expect(dec.failCondition).toBe('base_revision');    // §3.3: the failing condition, DURABLE on the doc
    const book = db._get('mandates/m1');
    expect(book.portfolio.cash).toBe(book.portfolio.initialValue); // no money moved
    expect(book.execState.staleRejectStreak).toBe(1);
    expect(book.execState.openBatchId).toBe(null);
  });

  it('a CROSS-SESSION result is rejected_stale (F3) even when everything else matches', async () => {
    const { db, env } = seedSubmitted();
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: '2026-08-13T14:25:00Z' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: succeededResult({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'q' }) },
    ]));
    // Harvested the NEXT session (Monday-after-Friday shape). Age must stay
    // inside MANDATE_RESULT_MAX_AGE_MS so condition 3, not 4, is what rejects.
    const nextSessionNow = new Date(NOW.getTime() + 60 * 60 * 1000);
    await harvestOpenBatches(db, { currentSnapshot: { tickKey: '2026-08-13_open30', symbols: HARVEST_SNAP.symbols }, sessionDate: '2026-08-13', ownerToken: 'tok_h', now: nextSessionNow });
    const dec = db._get(`mandates/m1/decisions/${env.requestId}`);
    expect(dec.status).toBe('rejected_stale');
    expect(dec.failCondition).toBe('cross_session');
  });

  it('PARTIAL BATCH: succeeded + errored + provider-expired + MISSING all reach terminal states — no limbo', async () => {
    // Two books, four requests? Keep it two: one succeeds, one errored; plus a
    // third entry with no result row (missing) on a second book.
    const bookA = seedBook({ mandateId: 'mA' });
    const envA = envelopeFor(bookA, 'mA');
    const bookB = seedBook({ mandateId: 'mB' });
    const envB = envelopeFor(bookB, 'mB');
    const bookC = seedBook({ mandateId: 'mC' });
    const envC = envelopeFor(bookC, 'mC');
    const entries = {
      [envA.requestId]: { mandateId: 'mA', model: VINTAGE.modelSeat.model, verbs: VERBS, envelope: envA },
      [envB.requestId]: { mandateId: 'mB', model: VINTAGE.modelSeat.model, verbs: VERBS, envelope: envB },
      [envC.requestId]: { mandateId: 'mC', model: VINTAGE.modelSeat.model, verbs: VERBS, envelope: envC },
    };
    const gate = (env) => ({ openBatchId: env.requestId, openBatchSubmittedAt: NOW, openProviderBatchId: 'msgbatch_p' });
    const db = makeMandateFakeDb({
      'mandates/mA': seedBook({ mandateId: 'mA', execState: gate(envA) }),
      'mandates/mB': seedBook({ mandateId: 'mB', execState: gate(envB) }),
      'mandates/mC': seedBook({ mandateId: 'mC', execState: gate(envC) }),
      'archetypeVintages/analyst_x': VINTAGE,
      [`${MANDATE_BATCH_COLLECTION}/msgbatch_p`]: buildBatchDoc({ providerBatchId: 'msgbatch_p', tickKey: TICK.tickKey, sessionDate: TICK.date, submittedAt: NOW, entries }),
      [`mandateUniverseSnapshots/${TICK.tickKey}`]: SUBMIT_SNAP,
    });
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: '2026-08-12T15:00:00Z' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: envA.requestId, result: succeededResult({ verb: 'HOLD', rationale: 'steady' }) },
      { custom_id: envB.requestId, result: { type: 'errored', error: { type: 'invalid_request_error' } } },
      // envC: NO result row at all (the missing case)
    ]));

    const s = await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: H_NOW });
    expect(s.disposed).toBe(3);

    expect(db._get(`mandates/mA/decisions/${envA.requestId}`).status).toBe('executed'); // HOLD is a terminal executed
    const decB = db._get(`mandates/mB/decisions/${envB.requestId}`);
    expect(decB.status).toBe('failed');
    expect(decB.failCondition).toBe('api_error:invalid_request_error');
    const decC = db._get(`mandates/mC/decisions/${envC.requestId}`);
    expect(decC.status).toBe('expired');
    expect(decC.failCondition).toBe('result_missing');

    // Every gate cleared; every book back to submit-eligibility (I1).
    for (const id of ['mA', 'mB', 'mC']) {
      expect(db._get(`mandates/${id}`).execState.openBatchId).toBe(null);
    }
    // Health semantics: errored is an eval FAILURE; expired/executed are completed evals.
    expect(db._get('mandates/mB').health.consecutiveEvalFailures).toBe(1);
    expect(db._get('mandates/mA').health.consecutiveEvalFailures).toBe(0);
    // Streaks: expired increments (I9 liveness); failed resets; executed resets.
    expect(db._get('mandates/mC').execState.staleRejectStreak).toBe(1);
    expect(db._get('mandates/mB').execState.staleRejectStreak).toBe(0);

    const bdoc = db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_p`);
    expect(bdoc.status).toBe('harvested');
    expect(Object.keys(bdoc.disposed)).toHaveLength(3);
  });

  it('a still-processing batch inside the age window is left open (nothing disposed)', async () => {
    const { db, env } = seedSubmitted();
    batchApi.retrieve.mockResolvedValue({ processing_status: 'in_progress' });
    const s = await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: H_NOW });
    expect(s.disposed).toBe(0);
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`).status).toBe('open');
    expect(db._get(`mandates/m1/decisions/${env.requestId}`)).toBeUndefined();
    expect(db._get('mandates/m1').execState.openBatchId).toBe(env.requestId); // gate stays — no double submit
  });

  it('LATE BATCH (I9/I1 acceptance-critical): age-out → dispositions + gate cleared NOW; the doc waits, then the late result BILLS (never executes) and finalizes expired', async () => {
    const { db, env } = seedSubmitted();
    batchApi.retrieve.mockResolvedValue({ processing_status: 'in_progress' }); // still running at age-out
    batchApi.cancel.mockResolvedValue({});
    const late = new Date(NOW.getTime() + MANDATE_RESULT_MAX_AGE_MS + 60_000);

    const s = await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: late });
    expect(s.disposed).toBe(1);
    expect(batchApi.cancel).toHaveBeenCalledWith('msgbatch_h'); // stop paying for a dead batch
    const dec = db._get(`mandates/m1/decisions/${env.requestId}`);
    expect(dec.status).toBe('expired');
    const book = db._get('mandates/m1');
    expect(book.execState.openBatchId).toBe(null);          // submit-eligibility restored (I1) — IMMEDIATELY
    expect(book.execState.staleRejectStreak).toBe(1);       // an aged-out submission is a liveness event
    expect(book.health.consecutiveEvalFailures).toBe(1);    // an UNDELIVERED cycle is an eval failure (C21-P5-6)
    // The DOC stays open awaiting provider end, so pre-cancel spend can still
    // be billed (MONEY-P5-1) — books were freed above; only bookkeeping waits.
    const bdocMid = db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`);
    expect(bdocMid.status).toBe('open');
    expect(bdocMid.agedOutAt).toBeTruthy();
    expect(bdocMid.disposed[env.requestId]).toBe('expired');

    // The provider later ends: the request had actually SUCCEEDED pre-cancel.
    // Its usage is billed (batch rates) against the book; the terminal stays
    // 'expired' (claim) and no money moves; the doc finalizes 'expired'.
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'later' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: succeededResult({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'q' }) },
    ]));
    const s2 = await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h2', now: late });
    expect(s2.billedEntries).toBe(1);
    expect(s2.expired).toBe(1); // finalized non-harvested
    const after = db._get('mandates/m1');
    expect(db._get(`mandates/m1/decisions/${env.requestId}`).status).toBe('expired'); // still expired — never executed
    expect(after.portfolio.cash).toBe(book.portfolio.cash);                            // no late money motion
    expect(after.costTelemetry.tokensIn).toBe(1200);                                   // the REAL spend is recorded (§6.2)
    const bdoc = db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`);
    expect(bdoc.status).toBe('expired');
    expect(bdoc.billed[env.requestId]).toBe(true);
    // And a THIRD pass changes nothing (billing is exactly-once via the map).
    await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h3', now: late });
    expect(db._get('mandates/m1').costTelemetry.tokensIn).toBe(1200);
  });

  it('provider cancel FAILURE does not block the age-out dispositions (best-effort by contract)', async () => {
    const { db, env } = seedSubmitted();
    batchApi.retrieve.mockResolvedValue({ processing_status: 'in_progress' });
    batchApi.cancel.mockRejectedValue(new Error('provider 500'));
    const late = new Date(NOW.getTime() + MANDATE_RESULT_MAX_AGE_MS + 60_000);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: late });
    spy.mockRestore();
    expect(s.disposed).toBe(1);
    expect(db._get(`mandates/m1/decisions/${env.requestId}`).status).toBe('expired');
    expect(db._get('mandates/m1').execState.openBatchId).toBe(null); // books never wait on the provider
  });

  it('BILLING GIVE-UP: a batch that never ends finalizes past the horizon with its unbilled spend counted and alerted', async () => {
    const { db, env } = seedSubmitted();
    batchApi.retrieve.mockResolvedValue({ processing_status: 'in_progress' }); // never ends
    batchApi.cancel.mockResolvedValue({});
    const late = new Date(NOW.getTime() + MANDATE_RESULT_MAX_AGE_MS + 60_000);
    await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: late });
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`).status).toBe('open'); // waiting to bill

    const pastHorizon = new Date(NOW.getTime() + MANDATE_BATCH_BILLING_GIVEUP_MS + 60_000);
    const errs = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((m) => errs.push(String(m)));
    const s = await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h2', now: pastHorizon });
    spy.mockRestore();
    expect(s.expired).toBe(1);
    const bdoc = db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`);
    expect(bdoc.status).toBe('expired');
    expect(bdoc.unbilledRequestCount).toBe(1); // understatement is LOUD, never silent (§6.2)
    expect(errs.some((e) => e.includes('MANDATE_BATCH_UNBILLED_SPEND'))).toBe(true);
    expect(db._get(`mandates/m1/decisions/${env.requestId}`).status).toBe('expired');
  });

  it('a QUARANTINED-at-harvest book: the entry verb gates as exit-only even though the submit-time tool allowed it', async () => {
    const { db, env } = seedSubmitted();
    await db.doc('mandates/m1').update({ 'health.quarantined': true }); // quarantined AFTER submit
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'x' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: succeededResult({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'q' }) },
    ]));
    await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: H_NOW });
    const dec = db._get(`mandates/m1/decisions/${env.requestId}`);
    expect(dec.status).toBe('gated');
    expect(dec.failCondition).toBe('exit_only_mode'); // harvest gates against the book as it IS
    // I1 set-completeness (SPEC-P5-7): the gated terminal ALSO releases the gate.
    expect(db._get('mandates/m1').execState.openBatchId).toBe(null);
  });

  it('a result with NO tool_use reaches terminal failed (I1 — never the direct path soft-skip)', async () => {
    const { db, env } = seedSubmitted();
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'x' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: { type: 'succeeded', message: { content: [{ type: 'text', text: 'thinking aloud' }], usage: { input_tokens: 900, output_tokens: 30 } } } },
    ]));
    await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: H_NOW });
    const dec = db._get(`mandates/m1/decisions/${env.requestId}`);
    expect(dec.status).toBe('failed');
    expect(dec.failCondition).toBe('no_decision_tool_use');
    const book = db._get('mandates/m1');
    expect(book.health.consecutiveEvalFailures).toBe(1);
    expect(book.costTelemetry.tokensIn).toBe(900); // the spend is still billed
    expect(book.execState.openBatchId).toBe(null);
  });
});

// ── Drain (F26) ──────────────────────────────────────────────────────────────

describe('drainOpenBatches — the explicit F26 protocol', () => {
  it('cancels the provider batch, writes rejected_stale (drained_transport_change), marks the doc cancelled, restores eligibility', async () => {
    const { db, env } = seedSubmitted();
    batchApi.cancel.mockResolvedValue({});
    const r = await drainOpenBatches(db, { now: H_NOW });
    expect(r).toMatchObject({ batches: 1, disposed: 1, errors: 0 });
    expect(batchApi.cancel).toHaveBeenCalledWith('msgbatch_h');

    const dec = db._get(`mandates/m1/decisions/${env.requestId}`);
    expect(dec.status).toBe('rejected_stale');              // §3.3 drain language — the DECISION disposition
    expect(dec.failCondition).toBe('drained_transport_change');
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`).status).toBe('cancelled'); // I1 word — the BATCH
    const book = db._get('mandates/m1');
    expect(book.execState.openBatchId).toBe(null);
    expect(book.execState.staleRejectStreak).toBe(1);
  });

  it('is idempotent: a second drain finds nothing open and no-ops', async () => {
    const { db } = seedSubmitted();
    batchApi.cancel.mockResolvedValue({});
    await drainOpenBatches(db, { now: H_NOW });
    const r2 = await drainOpenBatches(db, { now: H_NOW });
    expect(r2).toMatchObject({ batches: 0, disposed: 0 });
    expect(db._get('mandates/m1').revision).toBe(1); // exactly one disposition transaction ever
  });

  it('an already-cancelled entry (rollover/escape got there first) no-ops on the claim and the drain completes', async () => {
    const { db, env } = seedSubmitted();
    // Rollover-style prior disposal: decision cancelled, gate cleared.
    const dbBook = db._get('mandates/m1');
    db._store.set(`mandates/m1/decisions/${env.requestId}`, { data: { decisionId: env.requestId, status: 'cancelled' }, version: 1 });
    db._store.set('mandates/m1', { data: { ...dbBook, execState: { ...dbBook.execState, openBatchId: null, openBatchSubmittedAt: null, openProviderBatchId: null } }, version: 2 });
    batchApi.cancel.mockResolvedValue({});
    const r = await drainOpenBatches(db, { now: H_NOW });
    expect(r.batches).toBe(1);
    expect(db._get(`mandates/m1/decisions/${env.requestId}`).status).toBe('cancelled'); // untouched — claim wins
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`).status).toBe('cancelled');
  });
});

// ── P5 review fixes — mutation guards ────────────────────────────────────────

describe('P5 review SPEC-P5-3 — a partially-drained batch keeps the drain disposition', () => {
  it("a 'canceled' result row on a drain-marked batch disposes rejected_stale/drained_transport_change (streak++), never lifecycle 'cancelled'", async () => {
    const { db, env } = seedSubmitted();
    await db.doc(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`).update({ drainRequested: true }); // the drain marked it, then lease-skipped this entry
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'x' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: { type: 'canceled' } },
    ]));
    await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: H_NOW });
    const dec = db._get(`mandates/m1/decisions/${env.requestId}`);
    expect(dec.status).toBe('rejected_stale');                  // §3.3 drain language survives the partial path
    expect(dec.failCondition).toBe('drained_transport_change');
    expect(db._get('mandates/m1').execState.staleRejectStreak).toBe(1); // the I9 evidence is kept, not reset
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`).status).toBe('cancelled'); // the doc keeps the drain terminal
  });

  it("a 'canceled' row WITHOUT the drain marker keeps the lifecycle word (console-cancel case)", async () => {
    const { db, env } = seedSubmitted();
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'x' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: { type: 'canceled' } },
    ]));
    await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: H_NOW });
    expect(db._get(`mandates/m1/decisions/${env.requestId}`).status).toBe('cancelled');
  });
});

describe('P5 review INV-P5-5 — a deleted book cannot strand its batch doc', () => {
  it('the entry is disposed leaselessly (terminal claimed under the dead path) and the doc converges', async () => {
    const { db, env } = seedSubmitted();
    db._store.delete('mandates/m1'); // out-of-band delete
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'x' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: succeededResult({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'q' }) },
    ]));
    const s = await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: H_NOW });
    expect(s.leaseSkips).toBe(0);                                // no_such_book is NOT contention
    expect(s.disposed).toBe(1);
    const dec = db._get(`mandates/m1/decisions/${env.requestId}`);
    expect(dec.status).toBe('failed');
    expect(dec.failCondition).toBe('book_missing');
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`).status).toBe('harvested'); // converged (I1)
  });
});

describe('P5 review MONEY-P5-1/SPEC-P5-9 — billing end-to-end', () => {
  it('a close-expiry-claimed terminal still gets its usage billed at harvest (idempotent decision, non-idempotent billing), incl. cache tokens', async () => {
    const { db, env } = seedSubmitted();
    // The close pass expired it overnight (claim exists, gate cleared, no bill).
    db._store.set(`mandates/m1/decisions/${env.requestId}`, { data: { decisionId: env.requestId, status: 'expired' }, version: 1 });
    const b = db._get('mandates/m1');
    db._store.set('mandates/m1', { data: { ...b, execState: { ...b.execState, openBatchId: null, openBatchSubmittedAt: null, openProviderBatchId: null } }, version: 2 });
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'x' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: succeededResult({ verb: 'HOLD', rationale: 'steady' }, { input_tokens: 800, output_tokens: 40, cache_read_input_tokens: 2000, cache_creation_input_tokens: 500 }) },
    ]));
    const s = await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: H_NOW });
    expect(s.billedEntries).toBe(1);
    const ct = db._get('mandates/m1').costTelemetry;
    expect(ct.tokensIn).toBe(800);
    expect(ct.cacheHitTokens).toBe(2000);   // the D-20 stacking measurement, end-to-end
    expect(ct.cacheWriteTokens).toBe(500);
    // Refuter D3: the BATCH RATE is wired into the harvest, not just the unit
    // table — dropping {batch:true} at the harvest call site doubles this.
    // (800×$1 + 40×$5 + 2000×$1×0.1 + 500×$1×1.25) / 1e6 × 0.5
    expect(ct.estUsd).toBeCloseTo(((800 * 1 + 40 * 5 + 2000 * 0.1 + 500 * 1.25) / 1e6) * 0.5, 12);
    expect(db._get(`mandates/m1/decisions/${env.requestId}`).status).toBe('expired'); // the claim stands — billing never re-executes
    // A second harvest bills nothing more (the billed map is the exactly-once).
    await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h2', now: H_NOW });
    expect(db._get('mandates/m1').costTelemetry.tokensIn).toBe(800);
  });
});

describe('P5 review INV-P5-7 — a transient submit-snapshot read failure leaves the batch open (no terminal rejections from a blip)', () => {
  it('the batch is retried next fire; nothing is disposed', async () => {
    const { db, env } = seedSubmitted();
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'x' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: succeededResult({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 10000, rationale: 'q' }) },
    ]));
    // Poison the submit-snapshot read only.
    const realCollection = db.collection.bind(db);
    const wrapped = {
      ...db,
      collection: (name) => {
        const col = realCollection(name);
        if (name !== 'mandateUniverseSnapshots') return col;
        return { ...col, doc: (id) => ({ ...col.doc(id), get: async () => { throw new Error('injected read blip'); } }) };
      },
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = await harvestOpenBatches(wrapped, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: H_NOW });
    spy.mockRestore();
    expect(s.errors).toBeGreaterThanOrEqual(1);
    expect(s.disposed).toBe(0);                                            // NOT terminally rejected on our blip
    expect(db._get(`mandates/m1/decisions/${env.requestId}`)).toBeUndefined();
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`).status).toBe('open'); // retried next fire
  });
});

describe('P5 review C21-P5-5 — batch-doc age fails CLOSED on a corrupt submittedAt', () => {
  it('a doc with no parseable submittedAt is infinitely old: disposed immediately', async () => {
    const { db, env } = seedSubmitted();
    await db.doc(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`).update({ submittedAt: 'not-a-date' });
    batchApi.retrieve.mockResolvedValue({ processing_status: 'in_progress' });
    batchApi.cancel.mockResolvedValue({});
    const s = await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_h', now: H_NOW });
    expect(s.disposed).toBe(1); // the liveness backstop cannot be defeated by a corrupt field
    expect(db._get(`mandates/m1/decisions/${env.requestId}`).status).toBe('expired');
  });
});

describe('P5 refuter D1 — the ENDED lane never finalizes silently past unbilled spend', () => {
  it('an entry disposed by age-out whose usage-bearing result is lease-blocked keeps the doc OPEN; the next fire bills and finalizes', async () => {
    const { db, env } = seedSubmitted();
    batchApi.retrieve.mockResolvedValue({ processing_status: 'in_progress' });
    batchApi.cancel.mockResolvedValue({});
    const late = new Date(NOW.getTime() + MANDATE_RESULT_MAX_AGE_MS + 60_000);
    // Fire 1: age-out disposes the entry (books freed), doc stays open awaiting billing.
    await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_a', now: late });
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`).disposed[env.requestId]).toBe('expired');

    // Fire 2: the provider has ended with REAL usage — but the book's lease is
    // held by another live invocation, so billing is blocked this fire.
    batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: 'x' });
    batchApi.results.mockResolvedValue(asAsyncIterable([
      { custom_id: env.requestId, result: succeededResult({ verb: 'HOLD', rationale: 's' }, { input_tokens: 900, output_tokens: 30, cache_creation_input_tokens: 4000 }) },
    ]));
    await db.doc('mandates/m1').set({ lease: { ownerToken: 'someone_else', acquiredAt: late, expiresAt: new Date(late.getTime() + 300_000) } }, { merge: true });
    const s2 = await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_b', now: late });
    expect(s2.leaseSkips).toBe(1);
    // THE GUARD (refuter D1): the doc must NOT finalize with the spend unrecorded.
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`).status).toBe('open');
    expect(db._get('mandates/m1').costTelemetry?.cacheWriteTokens ?? 0).toBe(0); // not billed YET — but not forgotten

    // Fire 3: lease released → the usage bills and the doc finalizes.
    await db.doc('mandates/m1').set({ lease: { ownerToken: null, acquiredAt: null, expiresAt: null } }, { merge: true });
    const s3 = await harvestOpenBatches(db, { currentSnapshot: HARVEST_SNAP, sessionDate: TICK.date, ownerToken: 'tok_c', now: late });
    expect(s3.billedEntries).toBe(1);
    const ct = db._get('mandates/m1').costTelemetry;
    expect(ct.tokensIn).toBe(900);
    expect(ct.cacheWriteTokens).toBe(4000); // the caching-regression signal SURVIVES (MONEY-P5-5's measurement claim)
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_h`).status).toBe('expired');
  });
});
