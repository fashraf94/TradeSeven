// api/cron/practiceFieldIsolation.test.js
//
// Practice Field T1a-1 — KIND ISOLATION ACROSS THE ENGINE and THE SWEEPS' IDEA-BOOK WIRING (build prompt §3, §5,
// §7a requirement 3, §9 "Isolation" and "The snapshot union"). Drives the REAL sweep drivers (runEvalSweep,
// runCloseSweep, runRolloverSweep), the REAL snapshot builders and the REAL quarterly cores against the
// transaction-faithful fake, with only the network edges mocked (the two market-fetch clients, the corporate
// actions' global fetch, the model seat).
//
//   • a populated idea book never reaches the quarterly eval, rollover, escape, batch, creation or accelerated
//     paths, WHATEVER PRACTICE_FIELD_MODE says (the guards do not read the flag);
//   • the close sweep dispatches both kinds correctly;
//   • T0c's idle check is defeated by an active idea book;
//   • the shared snapshot's build set: idea books only → no default candidate universe; a quarterly book present →
//     today's set beside the coverage symbols; funds skip the fundamentals lookup; the candidate floor is not read
//     when the default universe is absent;
//   • with the mode 'off' no Practice Field code path runs in either sweep.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const modelSpy = vi.fn(async () => { throw new Error('the model seat was called'); });
const batchApi = { create: vi.fn(), retrieve: vi.fn(), results: vi.fn(), cancel: vi.fn(async () => ({})) };
vi.mock('../_utils/mandateModelCall.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    callMandateModelDirect: (...a) => modelSpy(...a),
    createMandateBatch: (...a) => batchApi.create(...a),
    retrieveMandateBatch: (...a) => batchApi.retrieve(...a),
    mandateBatchResults: (...a) => batchApi.results(...a),
    cancelMandateBatch: (...a) => batchApi.cancel(...a),
  };
});

let quoteBook = {};
let quoteTs = 0;
const quotesSpy = vi.fn(async (symbols) => Object.fromEntries(symbols.filter((s) => quoteBook[s] !== undefined).map((s) => [s, { close: quoteBook[s], timestamp: quoteTs }])));
const VENDOR_FUNDAMENTALS = async () => ({ fundamentals: { sector: 'Vendor Sector', industry: 'Vendor Industry', marketCap: 5e11 }, cacheStatus: { fundamentals: 'fresh' } });
const fundamentalsSpy = vi.fn(VENDOR_FUNDAMENTALS);
vi.mock('../_utils/tournamentPrices.js', async (importActual) => ({ ...(await importActual()), fetchBatchQuotes: (...a) => quotesSpy(...a) }));
vi.mock('../_utils/marketDataCache.js', async (importActual) => ({ ...(await importActual()), getStockAnalysisData: (...a) => fundamentalsSpy(...a) }));

import { runEvalSweep, runCloseSweep, runBookEval, idleAcquisitionCheck, snapshotBuildInputs } from './mandate-evaluate.js';
import { runRolloverSweep } from './mandate-rollover.js';
import { makeMandateFakeDb } from '../_utils/__testsupport__/mandateFakeFirestore.js';
import { buildNewMandateDoc } from '../_utils/mandateSchema.js';
import { executeDecision, disposeSubmission } from '../_utils/mandateExecution.js';
import { closeBook } from '../_utils/mandateClosePass.js';
import { rollOneBoundary, catchUpBook } from '../_utils/mandateRollover.js';
import { escapeMandate } from '../_utils/mandateEscape.js';
import { createMandate } from '../_utils/mandateCreationService.js';
import { drainOpenBatches, submitMandateBatch, buildBatchDoc, MANDATE_BATCH_COLLECTION } from '../_utils/mandateBatchTransport.js';
import { simulateFullRollover } from '../_utils/mandateAcceleratedClock.js';
import { CANDIDATE_UNIVERSE } from '../_utils/mandateCandidateUniverse.js';
import { assembleBuildSet, ensureUniverseSnapshot, isSymbolActionable, isCoverageOnly } from '../_utils/mandateUniverseSnapshot.js';
import { splitActiveBooks } from '../_utils/mandateBookKind.js';
import { setPracticeFieldModeForTests } from '../_utils/practiceField/mode.js';
import { admitIdea } from '../_utils/practiceField/admission.js';
import { nextSessionDate } from '../_utils/practiceField/windows.js';
import { PRACTICE_FIELD_FUNDS } from '../../src/data/practiceFieldFunds.js';
import {
  seedBook as seedIdeaBook, admitAndEnter, contractOf, getBook, getIdea, getRow, etIso, etMs, tickOf, DAYS, ADMIT_ISO, countDocs,
  takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults,
} from '../_utils/practiceField/__testsupport__/fixtures.js';

const PRICES = { AAPL: 231.47, MSFT: 418.13, LLY: 803.17, SPY: 597.31, XLK: 233.59, JPM: 241.37 };
const entryQuotes = { AAPL: { price: PRICES.AAPL, marketCap: 3.4e12 }, MSFT: { price: PRICES.MSFT, marketCap: 3.1e12 }, SPY: PRICES.SPY, XLK: PRICES.XLK };

function fakeReqRes() {
  const captured = {};
  const res = { status(code) { captured.code = code; return this; }, json(body) { captured.body = body; return this; } };
  return { req: { headers: { 'x-vercel-cron': '1' }, method: 'POST' }, res, captured };
}

function quarterlyBook(overrides = {}) {
  const doc = buildNewMandateDoc({
    mandateId: overrides.mandateId || 'q1', userId: overrides.userId || 'owner-q', archetype: 'analyst', managerAgentId: 'mgr_analyst_x',
    vintageRef: 'archetypeVintages/analyst_x', cadenceTier: 'fast',
    createdAt: new Date('2026-09-01T13:00:00Z'), quarterStartAt: new Date('2026-09-01T13:00:00Z'),
    nextRolloverAt: new Date('2026-12-01T21:00:00Z'), escapeHatchEligibleUntil: new Date('2026-09-15T13:00:00Z'),
  });
  return { ...doc, ...overrides, health: { ...doc.health, ...(overrides.health || {}) }, execState: { ...doc.execState, ...(overrides.execState || {}) }, portfolio: { ...doc.portfolio, ...(overrides.portfolio || {}) } };
}

/** A read log over the fake: every doc get and every query, in order. */
function withReadLog(db) {
  const reads = [];
  const wrapDoc = (ref) => ({ ...ref, get: async () => { reads.push(`get ${ref.path}`); return ref.get(); }, collection: (c) => wrapCol(ref.collection(c), `${ref.path}/${c}`) });
  const wrapCol = (col, path) => ({
    doc: (id) => wrapDoc(col.doc(id)),
    where: (...a) => wrapCol(col.where(...a), `${path}?${a.join('')}`),
    orderBy: (...a) => wrapCol(col.orderBy(...a), path),
    limit: (n) => wrapCol(col.limit(n), path),
    startAfter: (...a) => wrapCol(col.startAfter(...a), path),
    get: async () => { reads.push(`query ${path}`); return col.get(); },
  });
  return { reads, db: { ...db, collection: (c) => wrapCol(db.collection(c), c), doc: (p) => wrapDoc(db.doc(p)) } };
}

/** One idea book with a held idea (AAPL + MSFT against XLK), entered on D1. */
async function populatedIdeaBook(db, { uid = 'owner-1', opId = 'c1' } = {}) {
  const book = await seedIdeaBook({ db, uid, opId });
  const idea = await admitAndEnter(db, book.bookId, {
    contract: contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: entryQuotes,
  });
  expect(idea.entry.outcome).toBe('entered');
  return { ...book, ideaId: idea.ideaId };
}

/** The stored documents under a prefix, without the engine's lease field (a lease is taken and released around every served book; it is not the book's state). */
const snapshotOfStore = (db, prefix) => JSON.stringify([...db._store.entries()].filter(([p]) => p.startsWith(prefix)).map(([p, e]) => {
  const { lease: _lease, ...data } = e.data;
  return [p, data];
}));
const closeTickOf = (date) => ({ date, closeKey: `${date}_close` });
const closeNow = (date) => new Date(etMs(date, 16, 30));
const evalNow = (date, slot) => new Date(etMs(date, slot === 'open30' ? 10 : slot === 'midday' ? 12 : 15, slot === 'midday' ? 46 : slot === 'preClose' ? 31 : 2));

let restoreMode;
let errors;
let logs;
let fetchCalls;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('on');
  modelSpy.mockClear(); quotesSpy.mockClear(); fundamentalsSpy.mockClear(); fundamentalsSpy.mockImplementation(VENDOR_FUNDAMENTALS);
  for (const f of Object.values(batchApi)) f.mockReset();
  batchApi.cancel.mockResolvedValue({});
  quoteBook = { ...PRICES };
  for (const s of CANDIDATE_UNIVERSE) if (quoteBook[s] === undefined) quoteBook[s] = 100.01;
  quoteTs = Math.floor(etMs(DAYS.d1, 9, 45) / 1000);
  errors = []; logs = []; fetchCalls = [];
  vi.spyOn(console, 'error').mockImplementation((m) => errors.push(String(m)));
  vi.spyOn(console, 'log').mockImplementation((m) => logs.push(String(m)));
  process.env.EODHD_API_KEY = 'test-key';
  vi.stubGlobal('fetch', vi.fn(async (url) => { fetchCalls.push(String(url).replace(/api_token=[^&]+/, 'api_token=X')); return { ok: true, json: async () => [] }; }));
});
afterEach(() => {
  restoreMode(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete process.env.EODHD_API_KEY;
  for (const db of takeSeededDbs()) {
    expect(saleWordsOnMarkRows(db)).toEqual([]); // B-MARK on every valuation row the sweeps wrote
    expect(bannedWordsOnResults(db)).toEqual([]); // …and the three banned words on every result they wrote (review RH-11)
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('kind isolation on every quarterly core — unconditional (run at mode on AND at the shipped mode off)', () => {
  for (const mode of ['on', null]) {
    const label = mode === null ? "mode 'off' (shipped)" : "mode 'on'";

    it(`${label}: runBookEval never evaluates an idea book — no model call, nothing written`, async () => {
      const db = makeMandateFakeDb();
      const { bookId, bookRef } = await populatedIdeaBook(db);
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, 'mandates/');
      const out = await runBookEval(db, { book: getBook(db, bookId), mandateRef: bookRef, vintage: { gateConfig: {}, modelSeat: {} }, snapshot: { tickKey: 't', symbols: {} }, sessionDate: DAYS.d2, slot: 'open30' });
      expect(out).toEqual({ outcome: 'skipped_kind' });
      expect(modelSpy).not.toHaveBeenCalled();
      expect(snapshotOfStore(db, 'mandates/')).toBe(before);
    });

    it(`${label}: executeDecision and disposeSubmission refuse an idea book before any write`, async () => {
      const db = makeMandateFakeDb();
      const { bookRef } = await populatedIdeaBook(db);
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, 'mandates/');
      const envelope = { baseRevision: 2, quarterKey: undefined, submittedAt: new Date().toISOString(), sessionDate: DAYS.d2, requestId: 'req-1' };
      await expect(executeDecision(db, {
        mandateRef: bookRef, decisionId: 'req-1', decision: { verb: 'SELL', ticker: 'AAPL', sizeUsd: 0 }, gateResult: { passed: true },
        envelope, snapshot: { tickKey: 't', symbols: {} }, submitMark: null, currentSessionDate: DAYS.d2,
      })).rejects.toThrow(/not_quarterly/);
      await expect(disposeSubmission(db, { mandateRef: bookRef, requestId: 'req-2', status: 'expired', failCondition: 'result_age' })).rejects.toThrow(/not_quarterly/);
      expect(snapshotOfStore(db, 'mandates/')).toBe(before);
      // The replay branch too (review L2-7): a terminal decision whose id an idea book's gate field happened to hold
      // is never "healed" on the idea book — no revision bump, no field cleared.
      await bookRef.collection('decisions').doc('req-heal').set({ decisionId: 'req-heal', status: 'expired' });
      await bookRef.set({ execState: { openBatchId: 'req-heal' } }, { merge: true });
      const planted = snapshotOfStore(db, 'mandates/');
      const replay = await disposeSubmission(db, { mandateRef: bookRef, requestId: 'req-heal', status: 'expired', failCondition: 'result_age' });
      expect(replay).toEqual({ status: 'expired', applied: false, idempotent: true });
      expect(snapshotOfStore(db, 'mandates/')).toBe(planted);
    });

    it(`${label}: closeBook (the quarterly close) skips an idea book: not_quarterly, nothing written`, async () => {
      const db = makeMandateFakeDb();
      const { bookRef } = await populatedIdeaBook(db);
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, 'mandates/');
      const out = await closeBook(db, bookRef, { date: DAYS.d1, closeSnapshot: { tickKey: `${DAYS.d1}_close`, symbols: { AAPL: { price: 250, complete: true } } }, now: closeNow(DAYS.d1) });
      expect(out).toEqual({ closed: false, skipped: 'not_quarterly', alerts: [] });
      expect(snapshotOfStore(db, 'mandates/')).toBe(before);
    });

    it(`${label}: rollover never rolls an idea book — the core, the catch-up and the sweep (whose query the fake, unlike Firestore, lets it into)`, async () => {
      const db = makeMandateFakeDb({ 'mandates/q-due': quarterlyBook({ mandateId: 'q-due', nextRolloverAt: new Date('2026-11-01T21:00:00Z') }) });
      const { bookRef, bookId } = await populatedIdeaBook(db);
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, `mandates/${bookId}`);
      const versionBefore = db._versionOf(`mandates/${bookId}`);
      const vintagesBefore = countDocs(db, 'archetypeVintages/');
      expect(await rollOneBoundary(db, bookRef, { now: new Date('2027-06-01T12:00:00Z') })).toEqual({ rolled: false, skipped: 'not_quarterly' });
      expect(await catchUpBook(db, bookRef, { now: new Date('2027-06-01T12:00:00Z') })).toEqual({ processed: [], boundaries: 0, cappedOut: false });
      expect(countDocs(db, 'archetypeVintages/')).toBe(vintagesBefore); // answered before the vintage publish
      // The fake returns a doc with NO nextRolloverAt for `<= now` (real Firestore would not): the sweep must step over it itself.
      const page = await db.collection('mandates').where('status', '==', 'active').where('nextRolloverAt', '<=', new Date('2026-11-17T12:00:00Z')).get();
      expect(page.docs.map((d) => d.id)).toContain(bookId);
      const { req, res, captured } = fakeReqRes();
      await runRolloverSweep(req, res, { now: new Date('2026-11-17T12:00:00Z'), rolloverTick: { date: DAYS.d2, rolloverKey: `${DAYS.d2}_rollover` }, db });
      expect(captured.body).toMatchObject({ ok: true, rolledBooks: 1 }); // the due quarterly book rolled
      expect(db._get('mandates/q-due').quarterIndex).toBe(2);
      expect(snapshotOfStore(db, `mandates/${bookId}`)).toBe(before);
      expect(db._versionOf(`mandates/${bookId}`)).toBe(versionBefore); // not even leased: stepped over before the lease
      expect(getBook(db, bookId)).not.toHaveProperty('quarterIndex');
      expect(getBook(db, bookId)).not.toHaveProperty('vintageRef');
    });

    it(`${label}: the escape hatch refuses an idea book even if the quarterly pointer were mis-set at it`, async () => {
      const db = makeMandateFakeDb();
      const { bookId } = await populatedIdeaBook(db);
      await db.collection('userMeta').doc('owner-1').set({ activeMandateId: bookId, mandateEscapeHatchUsed: false });
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, 'mandates/');
      expect(await escapeMandate(db, { userId: 'owner-1', archetype: 'analyst', now: new Date(etIso(DAYS.d2, 12, 0)) })).toEqual({ ok: false, code: 'not_quarterly' });
      expect(snapshotOfStore(db, 'mandates/')).toBe(before);
      expect(db._get('userMeta/owner-1')).toEqual({ activeMandateId: bookId, mandateEscapeHatchUsed: false });
    });

    it(`${label}: the batch submit gate is never written on an idea book — its request rides as a zombie with no gate`, async () => {
      const db = makeMandateFakeDb();
      const { bookId, bookRef } = await populatedIdeaBook(db);
      setPracticeFieldModeForTests(mode);
      const book = getBook(db, bookId);
      batchApi.create.mockResolvedValueOnce({ id: 'msgbatch_gate', created_at: etIso(DAYS.d1, 10, 2) });
      const before = snapshotOfStore(db, 'mandates/');
      // An envelope that matches the idea book on every field the gate compares (it has no quarterKey).
      const out = await submitMandateBatch(db, [{
        mandateRef: bookRef, envelope: { requestId: 'req-gate', baseRevision: book.revision, quarterKey: book.quarterKey }, verbs: ['HOLD'],
        modelSeat: { model: 'm', params: {} }, content: { system: 's', messages: [], tools: [] },
      }], { tickKey: `${DAYS.d1}_open30`, sessionDate: DAYS.d1, now: new Date(etIso(DAYS.d1, 10, 2)) });
      expect(out).toMatchObject({ providerBatchId: 'msgbatch_gate', gated: 0, zombies: ['req-gate'] });
      expect(snapshotOfStore(db, 'mandates/')).toBe(before);
      expect(getBook(db, bookId).execState.openBatchId).toBeNull();
    });

    it(`${label}: a harvested batch result that named an idea book is never billed to it, applied to it or disposed against it`, async () => {
      const db = makeMandateFakeDb({ 'archetypeVintages/analyst_x': { gateConfig: { sectorCapConversionVersion: 1 }, modelSeat: { model: 'claude-haiku-4-5-20251001' } } });
      const { bookId } = await populatedIdeaBook(db);
      await db.collection(MANDATE_BATCH_COLLECTION).doc('batch-h').set(buildBatchDoc({
        providerBatchId: 'batch-h', tickKey: `${DAYS.d2}_open30`, sessionDate: DAYS.d2, submittedAt: new Date(etIso(DAYS.d2, 10, 1)),
        entries: { 'req-h': { mandateId: bookId, model: 'claude-haiku-4-5-20251001', verbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'], envelope: { requestId: 'req-h', baseRevision: 2, sessionDate: DAYS.d2, submittedAt: etIso(DAYS.d2, 10, 1), submitTickKey: `${DAYS.d2}_open30`, vintageRef: 'archetypeVintages/analyst_x' } } },
      }));
      setPracticeFieldModeForTests(mode);
      batchApi.retrieve.mockResolvedValue({ processing_status: 'ended', ended_at: etIso(DAYS.d2, 12, 40) });
      batchApi.results.mockResolvedValue({ async* [Symbol.asyncIterator]() { yield { custom_id: 'req-h', result: { type: 'succeeded', message: { content: [{ type: 'tool_use', name: 'submit_mandate_decision', input: { verb: 'SELL', ticker: 'AAPL', rationale: 'out' } }], usage: { input_tokens: 1000, output_tokens: 50 } } } }; } });
      const before = snapshotOfStore(db, `mandates/${bookId}`);
      quoteTs = Math.floor(etMs(DAYS.d2, 12, 30) / 1000);
      const { req, res, captured } = fakeReqRes();
      await runEvalSweep(req, res, { now: evalNow(DAYS.d2, 'midday'), tick: tickOf(DAYS.d2, 'midday'), db, transport: 'batch' });
      expect(captured.body.harvest).toMatchObject({ polled: 1, leaseSkips: 1 });
      // The book: no decision, no telemetry, no failure counter, its positions as they were (its own pass may stamp it at mode on).
      const after = getBook(db, bookId);
      expect(countDocs(db, `mandates/${bookId}/decisions/req-h`)).toBe(0);
      expect(after.costTelemetry).toEqual(JSON.parse(before)[0][1].costTelemetry);
      expect(after.portfolio).toEqual(JSON.parse(before)[0][1].portfolio);
      expect(after.health.consecutiveEvalFailures).toBe(0);
      // At mode on the idea-book pass of this fire first writes D1's missed close (its own duty; one book write) — the
      // harvest itself moves nothing at either mode.
      expect(after.revision).toBe(mode === 'on' ? 3 : 2);
      expect(after.execState.lastCloseKey ?? null).toBe(mode === 'on' ? DAYS.d1 : null);
      expect(db._get(`${MANDATE_BATCH_COLLECTION}/batch-h`).status).toBe('open'); // it never finalises against an idea book…
      expect(errors.filter((e) => /MANDATE_BATCH_ENTRY_NOT_QUARTERLY/.test(e))).toHaveLength(1); // …and it says so (review L2-5)
    });

    it(`${label}: a batch entry that named an idea book is never disposed against it (drain) — the book is untouched and the batch stays open`, async () => {
      const db = makeMandateFakeDb();
      const { bookId } = await populatedIdeaBook(db);
      await db.collection(MANDATE_BATCH_COLLECTION).doc('batch-1').set(buildBatchDoc({
        providerBatchId: 'batch-1', tickKey: `${DAYS.d1}_open30`, sessionDate: DAYS.d1, submittedAt: new Date(etIso(DAYS.d1, 10, 1)),
        entries: { 'req-1': { mandateId: bookId, envelope: { requestId: 'req-1', baseRevision: 2 }, model: 'm' } },
      }));
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, 'mandates/').replace(/"lease[^}]*}/g, '');
      const out = await drainOpenBatches(db, { now: new Date(etIso(DAYS.d1, 11, 0)) });
      expect(out).toMatchObject({ batches: 1, disposed: 0, leaseSkips: 1, incomplete: 1 });
      expect(errors.filter((e) => /MANDATE_BATCH_ENTRY_NOT_QUARTERLY/.test(e))).toHaveLength(1);
      expect(snapshotOfStore(db, 'mandates/').replace(/"lease[^}]*}/g, '')).toBe(before);
      expect(countDocs(db, `mandates/${bookId}/decisions/req-1`)).toBe(0);
      expect(db._get(`${MANDATE_BATCH_COLLECTION}/batch-1`).status).toBe('open');
    });

    it(`${label}: quarterly creation and the accelerated clock never act on the owner's idea book`, async () => {
      const db = makeMandateFakeDb();
      const { bookId } = await populatedIdeaBook(db);
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, `mandates/${bookId}`);
      const claimBefore = JSON.stringify(db._get('practiceFieldBooks/owner-1'));
      const created = await createMandate(db, { userId: 'owner-1', archetype: 'analyst', now: new Date(etIso(DAYS.d2, 12, 0)) });
      expect(created.ok).toBe(true);
      expect(created.mandateId).not.toBe(bookId);
      expect(db._get('userMeta/owner-1').activeMandateId).toBe(created.mandateId); // the quarterly product's own claim
      expect(db._get(`mandates/${created.mandateId}`)).not.toHaveProperty('kind');
      const sim = await simulateFullRollover(db, { userId: 'owner-accel', now: new Date(etIso(DAYS.d2, 12, 0)) });
      expect(sim).toBeTruthy();
      expect(snapshotOfStore(db, `mandates/${bookId}`)).toBe(before);
      expect(JSON.stringify(db._get('practiceFieldBooks/owner-1'))).toBe(claimBefore);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the shared snapshot\'s build set, by book kind (build prompt §5)', () => {
  const evalOnce = async (db, date = DAYS.d2, slot = 'open30') => {
    quoteTs = Math.floor(etMs(date, 9, 45) / 1000);
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: evalNow(date, slot), tick: tickOf(date, slot), db });
    return captured.body;
  };

  it('idea books only: NO default candidate universe is fetched; the build is the held tickers and the reserved coverage; it is not "degraded"', async () => {
    const db = makeMandateFakeDb();
    await populatedIdeaBook(db);
    const body = await evalOnce(db);
    expect(body.ok).toBe(true);
    const fetched = quotesSpy.mock.calls.flatMap((c) => c[0]).sort();
    expect(fetched).toEqual(['AAPL', 'MSFT', 'SPY', 'XLK']);
    const snap = db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`);
    expect(Object.keys(snap.symbols).sort()).toEqual(['AAPL', 'MSFT', 'SPY', 'XLK']);
    // They are COVERAGE, not quarterly holdings and not candidates: the doc says so, and no quarterly path may buy one.
    expect(snap).toMatchObject({ degraded: false, completeCandidateCount: 0, heldCount: 0, symbolCount: 4, coverageOnlySymbols: ['AAPL', 'MSFT', 'SPY', 'XLK'] });
    for (const s of ['AAPL', 'MSFT', 'SPY', 'XLK']) expect(isSymbolActionable(snap, s), s).toBe(false);
    expect(errors.filter((e) => /MANDATE_UNIVERSE_DEGRADED/.test(e))).toEqual([]);
    const daily = db._get(`mandateUniverseDaily/${DAYS.d2}`);
    expect(Object.keys(daily.symbols).sort()).toEqual(['AAPL', 'MSFT', 'SPY', 'XLK']);
    expect(daily.candidateUniverseOmitted).toBe(true);
  });

  it('a quarterly book created AFTER an idea-only build of the day gets its universe: the day doc is rebuilt once with the candidates (review L2-2)', async () => {
    const db = makeMandateFakeDb({ 'archetypeVintages/analyst_x': { gateConfig: { sectorCapConversionVersion: 1, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] }, modelSeat: { model: 'm' } } });
    await populatedIdeaBook(db);
    await evalOnce(db); // open30: idea books only
    expect(Object.keys(db._get(`mandateUniverseDaily/${DAYS.d2}`).symbols)).toHaveLength(4);
    const lookupsBefore = fundamentalsSpy.mock.calls.length;
    await db.doc('mandates/q1').set(quarterlyBook({ execState: { lastEvalTickKey: `${DAYS.d2}_midday` } }));
    // The rebuild TOPS UP (refuter RF3-2): what the first build holds is kept exactly and not fetched again — even
    // when the vendor now answers differently, or its corporate-actions feed is down.
    const firstBuild = JSON.stringify(db._get(`mandateUniverseDaily/${DAYS.d2}`).symbols.AAPL);
    fundamentalsSpy.mockImplementation(async () => ({ fundamentals: { sector: 'Later Sector', industry: 'Later Industry', marketCap: 7e11 }, cacheStatus: { fundamentals: 'fresh' } }));
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('the corporate-actions feed is down'); }));
    await evalOnce(db, DAYS.d2, 'midday');
    const daily = db._get(`mandateUniverseDaily/${DAYS.d2}`);
    expect(JSON.stringify(daily.symbols.AAPL)).toBe(firstBuild);
    expect(daily.symbols.AAPL).toMatchObject({ sector: 'Vendor Sector', marketCap: 5e11 });
    expect(daily.symbols.AAPL).not.toHaveProperty('caFetchFailed');
    expect(fundamentalsSpy.mock.calls.filter((c) => c[0] === 'AAPL')).toHaveLength(1);
    expect(Object.keys(daily.symbols).sort()).toEqual([...new Set([...CANDIDATE_UNIVERSE, 'AAPL', 'MSFT', 'SPY', 'XLK'])].sort());
    expect(daily).not.toHaveProperty('candidateUniverseOmitted');
    expect(logs.some((l) => /built without the candidate universe/.test(l))).toBe(true);
    const midday = db._get(`mandateUniverseSnapshots/${DAYS.d2}_midday`);
    expect(midday.symbols.NVDA).toMatchObject({ sector: 'Later Sector', marketCap: 7e11, complete: true }); // classified: the sector cap can be checked
    expect(midday).toMatchObject({ degraded: false, coverageOnlySymbols: ['SPY', 'XLK'] });
    // Once: the rebuilt doc carries no mark, so the next slot adopts it.
    const lookupsAfter = fundamentalsSpy.mock.calls.length;
    expect(lookupsAfter).toBeGreaterThan(lookupsBefore);
    await evalOnce(db, DAYS.d2, 'preClose');
    expect(fundamentalsSpy.mock.calls.length).toBe(lookupsAfter);
  });

  it('funds skip the fundamentals lookup — their classification is the map — and still get quotes, splits and dividends', async () => {
    const db = makeMandateFakeDb();
    await populatedIdeaBook(db);
    await evalOnce(db);
    const looked = fundamentalsSpy.mock.calls.map((c) => c[0]).sort();
    expect(looked).toEqual(['AAPL', 'MSFT']); // never SPY or XLK
    const daily = db._get(`mandateUniverseDaily/${DAYS.d2}`).symbols;
    expect(daily.XLK).toMatchObject({ sector: 'Technology', industry: 'etf', marketCap: null, complete: true });
    expect(daily.SPY).toMatchObject({ sector: 'broad_market', industry: 'etf', marketCap: null, complete: true });
    expect(daily.AAPL).toMatchObject({ sector: 'Vendor Sector', marketCap: 5e11 });
    for (const fund of ['SPY', 'XLK']) {
      expect(fetchCalls.some((u) => u.includes(`/splits/${fund}.US`))).toBe(true);
      expect(fetchCalls.some((u) => u.includes(`/div/${fund}.US`))).toBe(true);
    }
    expect(db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`).symbols.SPY).toMatchObject({ price: PRICES.SPY, complete: true });
  });

  it('a pending idea\'s symbols are covered before it holds anything (the session-before-entry rule has data to enter on)', async () => {
    const db = makeMandateFakeDb();
    const { bookId } = await seedIdeaBook({ db });
    const a = await admitIdea(db, { bookId, contract: contractOf({ names: ['LLY'] }), opId: 'p', nowIso: ADMIT_ISO });
    expect(a.ok).toBe(true);
    quoteTs = Math.floor(etMs(DAYS.d1, 9, 45) / 1000);
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: evalNow(DAYS.d1, 'open30'), tick: tickOf(DAYS.d1, 'open30'), db });
    expect(Object.keys(db._get(`mandateUniverseSnapshots/${DAYS.d1}_open30`).symbols).sort()).toEqual(['LLY', 'SPY']);
    // …and the same fire's idea-book pass entered it from that snapshot.
    expect(captured.body.ideaBooks).toMatchObject({ books: 1, served: 1, entered: 1, errors: 0 });
    expect(getIdea(db, bookId, a.ideaId).status).toBe('holding');
    expect(getIdea(db, bookId, a.ideaId).entry.snapshotKey).toBe(`${DAYS.d1}_open30`);
  });

  it('one quarterly book present: TODAY\'S set (the default universe ∪ held) beside the coverage symbols, with the candidate floor read as today', async () => {
    const db = makeMandateFakeDb({
      'mandates/q1': quarterlyBook({ portfolio: { positions: { JPM: { shares: 10, costBasisTotal: 2400, lastMark: 240 } } }, execState: { lastEvalTickKey: `${DAYS.d2}_open30` } }),
    });
    await populatedIdeaBook(db);
    await evalOnce(db);
    const snap = db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`);
    const expected = [...new Set([...CANDIDATE_UNIVERSE, 'JPM', 'AAPL', 'MSFT', 'SPY', 'XLK'])].sort();
    expect(Object.keys(snap.symbols).sort()).toEqual(expected);
    expect(snap.degraded).toBe(false);
    expect(snap.completeCandidateCount).toBeGreaterThanOrEqual(100);
    // The DAILY layer too: every default candidate is enriched (sector and market cap for the quarterly gate), as today.
    const daily = db._get(`mandateUniverseDaily/${DAYS.d2}`);
    expect(Object.keys(daily.symbols).sort()).toEqual(expected);
    expect(new Set(fundamentalsSpy.mock.calls.map((c) => c[0]))).toEqual(new Set(expected.filter((s) => s !== 'SPY' && s !== 'XLK')));
    // The quote outage that degrades a build WITH the default universe still does: the floor is read as today.
    for (const s of CANDIDATE_UNIVERSE) delete quoteBook[s];
    await evalOnce(db, DAYS.d2, 'midday');
    expect(db._get(`mandateUniverseSnapshots/${DAYS.d2}_midday`).degraded).toBe(true);
    expect(errors.some((e) => /MANDATE_UNIVERSE_DEGRADED/.test(e))).toBe(true);
  });

  it('COVERAGE NEVER CHANGES WHAT A QUARTERLY BOOK SEES OR MAY BUY (review L2-1): the model is handed the same prompt with and without an idea book, and a BUY of a covered fund is refused as outside the universe', async () => {
    const vintage = { gateConfig: { sectorCapConversionVersion: 1, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] }, modelSeat: { model: 'm' } };
    const run = async (withIdeaBook) => {
      const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook(), 'archetypeVintages/analyst_x': vintage });
      if (withIdeaBook) await populatedIdeaBook(db);
      modelSpy.mockClear();
      modelSpy.mockImplementationOnce(async () => ({ decision: { ok: true, input: { verb: 'BUY', ticker: 'XLK', sizeUsd: 5000, rationale: 'Buying the sector fund.', conviction: 60 } }, usage: null }));
      const body = await evalOnce(db);
      const decisions = [...db._store.entries()].filter(([p]) => p.startsWith('mandates/q1/decisions/')).map(([, e]) => e.data);
      return { db, body, prompt: JSON.stringify(modelSpy.mock.calls[0]), decisions, snap: db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`) };
    };
    const alone = await run(false);
    const beside = await run(true);
    expect(alone.snap).not.toHaveProperty('coverageOnlySymbols');
    expect(beside.snap.coverageOnlySymbols).toEqual(['SPY', 'XLK']); // AAPL and MSFT are candidates anyway, in their own places
    expect(beside.snap.symbols.XLK).toMatchObject({ price: PRICES.XLK, complete: true }); // present for the idea book's marks
    // The quarterly model sees the SAME thing, to the byte: same slate, same order, no fund in it.
    expect(alone.prompt).toContain('AAPL');
    expect(alone.prompt).not.toContain('XLK');
    expect(beside.prompt).toBe(alone.prompt);
    // …and its BUY of the fund meets the same refusal either way.
    for (const r of [alone, beside]) {
      expect(r.body).toMatchObject({ evaluated: 1, gated: 1, executed: 0 });
      expect(r.decisions).toHaveLength(1);
      expect(r.decisions[0]).toMatchObject({ status: 'gated', gateOutcome: { rule: 'universe', passed: false } });
      expect(r.db._get('mandates/q1').portfolio.positions).toEqual({});
    }
    // The same counts on both snapshots: coverage is not a holding and not a lost candidate.
    expect(beside.snap).toMatchObject({ heldCount: alone.snap.heldCount, completeCandidateCount: alone.snap.completeCandidateCount, degraded: false });
    expect(Object.keys(beside.snap.symbols).slice(0, CANDIDATE_UNIVERSE.length)).toEqual(Object.keys(alone.snap.symbols));
  });

  it('…in whatever order a stored snapshot returns its symbols: a coverage-only symbol at the HEAD of the map is still not on the quarterly slate', async () => {
    const tickKey = `${DAYS.d2}_open30`;
    quoteTs = Math.floor(etMs(DAYS.d2, 9, 45) / 1000);
    const fetchQuotes = async (symbols) => Object.fromEntries(symbols.map((s) => [s, { close: 100.01, timestamp: quoteTs }]));
    const built = await ensureUniverseSnapshot(makeMandateFakeDb(), { tickKey, sessionDate: DAYS.d2, heldTickers: [], coverageTickers: ['SPY', 'XLK'], fetchQuotes, now: evalNow(DAYS.d2, 'open30') });
    const { XLK, SPY, ...rest } = built.snapshot.symbols;
    const run = async (snapshot) => {
      const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook(), 'archetypeVintages/analyst_x': { gateConfig: { sectorCapConversionVersion: 1, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] }, modelSeat: { model: 'm' } } });
      await db.doc(`mandateUniverseSnapshots/${tickKey}`).set(snapshot);
      modelSpy.mockClear();
      modelSpy.mockImplementationOnce(async () => ({ decision: { ok: true, input: { verb: 'HOLD', rationale: 'Holding. Nothing to do.', conviction: 50 } }, usage: null }));
      await evalOnce(db);
      return JSON.stringify(modelSpy.mock.calls[0]);
    };
    const headFirst = await run({ ...built.snapshot, symbols: { XLK, SPY, ...rest } });
    expect(headFirst).not.toContain('XLK');
    // …and it is the prompt of a snapshot that never had them.
    const { coverageOnlySymbols: _c, ...plain } = built.snapshot;
    expect(headFirst).toBe(await run({ ...plain, symbols: rest }));
  });

  it('a quarterly book that appears in a slot whose snapshot was built for idea books only is NOT evaluated on it — no model call on an empty slate; the next slot serves it (refuter RF2-1)', async () => {
    const db = makeMandateFakeDb({ 'archetypeVintages/analyst_x': { gateConfig: { sectorCapConversionVersion: 1, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] }, modelSeat: { model: 'm' } } });
    await populatedIdeaBook(db);
    await evalOnce(db); // open30: idea books only
    expect(db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`)).toMatchObject({ candidateUniverseOmitted: true, completeCandidateCount: 0 });
    await db.doc('mandates/q1').set(quarterlyBook());
    modelSpy.mockClear();
    const sameSlot = await evalOnce(db); // a later fire of the SAME slot
    expect(modelSpy).not.toHaveBeenCalled();
    expect(sameSlot).toMatchObject({ ok: true, evaluated: 0, gated: 0 });
    expect(db._get('mandates/q1').execState.lastEvalTickKey ?? null).toBe(null); // not stamped, not billed, no decision
    expect(countDocs(db, 'mandates/q1/decisions/')).toBe(0);
    // The next slot is built WITH the universe and serves it.
    modelSpy.mockImplementationOnce(async () => ({ decision: { ok: true, input: { verb: 'HOLD', rationale: 'Holding. Nothing to do.', conviction: 50 } }, usage: null }));
    const nextSlot = await evalOnce(db, DAYS.d2, 'midday');
    expect(modelSpy).toHaveBeenCalledTimes(1);
    expect(nextSlot).toMatchObject({ evaluated: 1 });
    expect(db._get(`mandateUniverseSnapshots/${DAYS.d2}_midday`)).not.toHaveProperty('candidateUniverseOmitted');
    expect(JSON.stringify(modelSpy.mock.calls[0])).toContain(CANDIDATE_UNIVERSE[0]);
  });

  it('an open quarterly batch with no active quarterly book still gets the candidate universe beside an idea book — its harvest validates against this snapshot (refuter RF2-2)', async () => {
    const db = makeMandateFakeDb();
    await populatedIdeaBook(db);
    await db.collection(MANDATE_BATCH_COLLECTION).doc('batch-open').set(buildBatchDoc({
      providerBatchId: 'batch-open', tickKey: `${DAYS.d1}_preClose`, sessionDate: DAYS.d1, submittedAt: new Date(etIso(DAYS.d1, 15, 31)),
      entries: { 'req-q': { mandateId: 'q-escaped', envelope: { requestId: 'req-q', baseRevision: 2 }, model: 'm' } },
    }));
    await evalOnce(db);
    const snap = db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`);
    expect(snap).not.toHaveProperty('candidateUniverseOmitted');
    expect(Object.keys(snap.symbols)).toEqual(expect.arrayContaining([...CANDIDATE_UNIVERSE]));
    expect(snap.coverageOnlySymbols).toEqual(['SPY', 'XLK']);
    expect(db._get(`mandateUniverseDaily/${DAYS.d2}`)).not.toHaveProperty('candidateUniverseOmitted');
  });

  it('coverage is never dropped for the SIZE budget: a snapshot too large to store sheds uncovered candidates and keeps every covered symbol (refuter RF2-5)', async () => {
    const fetchQuotes = async (symbols) => Object.fromEntries(symbols.map((s) => [s, { close: 100.01, timestamp: quoteTs }]));
    const heavy = [{ type: 'cash_dividend', note: 'x'.repeat(9000) }];
    const dailyDoc = { symbols: Object.fromEntries([...CANDIDATE_UNIVERSE, 'SPY', 'XLK'].map((s) => [s, { sector: 'S', industry: 'I', marketCap: 1e11, corporateActions: heavy }])) };
    const covered = [CANDIDATE_UNIVERSE[CANDIDATE_UNIVERSE.length - 1], 'SPY', 'XLK'];
    const built = await ensureUniverseSnapshot(makeMandateFakeDb(), { tickKey: `${DAYS.d2}_open30`, sessionDate: DAYS.d2, heldTickers: [], coverageTickers: covered, fetchQuotes, dailyDoc, now: evalNow(DAYS.d2, 'open30') });
    expect(built.droppedForSize).toBeGreaterThan(0);
    for (const s of covered) expect(built.snapshot.symbols[s], s).toMatchObject({ complete: true });
    expect(built.snapshot.symbols[CANDIDATE_UNIVERSE[CANDIDATE_UNIVERSE.length - 2]]).toBeUndefined(); // the uncovered tail went first
  });

  it('reserved names that are ALSO default candidates still count as candidates: no false MANDATE_UNIVERSE_DEGRADED, however many are reserved (review L2-3)', async () => {
    const db = makeMandateFakeDb();
    const reserved = [...CANDIDATE_UNIVERSE.slice(0, 80), 'SPY', 'XLK'];
    const fetchQuotes = async (symbols) => Object.fromEntries(symbols.map((s) => [s, { close: 100.01, timestamp: quoteTs }]));
    const built = await ensureUniverseSnapshot(db, { tickKey: `${DAYS.d2}_open30`, sessionDate: DAYS.d2, heldTickers: ['JPM'], coverageTickers: reserved, fetchQuotes, now: evalNow(DAYS.d2, 'open30') });
    const plain = await ensureUniverseSnapshot(makeMandateFakeDb(), { tickKey: `${DAYS.d2}_open30`, sessionDate: DAYS.d2, heldTickers: ['JPM'], fetchQuotes, now: evalNow(DAYS.d2, 'open30') });
    expect(built.snapshot).toMatchObject({ degraded: false, heldCount: 1, completeCandidateCount: plain.snapshot.completeCandidateCount, coverageOnlySymbols: ['SPY', 'XLK'] });
    expect(plain.snapshot.completeCandidateCount).toBe(CANDIDATE_UNIVERSE.filter((s) => s !== 'JPM').length);
    expect(errors.filter((e) => /MANDATE_UNIVERSE_DEGRADED/.test(e))).toEqual([]);
    expect(isCoverageOnly(built.snapshot, 'xlk')).toBe(true);
    expect(isCoverageOnly(built.snapshot, CANDIDATE_UNIVERSE[0])).toBe(false);
    expect(isSymbolActionable(built.snapshot, CANDIDATE_UNIVERSE[0])).toBe(true);
  });

  it('the build set with coverage: empty coverage is the old set exactly; a covered candidate keeps its place and is never dropped for the cap; coverage-only goes last', () => {
    const cands = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
    for (const [held, cap] of [[[], 4], [['H1'], 4], [['H1', 'C2'], 3], [['H1', 'H2', 'H3', 'H4', 'H5'], 4], [[], 10]]) {
      const old = assembleBuildSet(held, { candidateUniverse: cands, cap });
      expect(old).toMatchObject({ coverageOnly: [] });
      // The old rule, restated: held first, then candidates while there is room under the cap.
      const expected = [...held];
      for (const c of cands) if (!held.includes(c) && expected.length < cap) expected.push(c);
      expect(old.symbols, `${held}/${cap}`).toEqual(expected);
      expect(old.candidateCapacity).toBe(expected.length - held.length);
      expect([...old.prioritySet]).toEqual(held);
    }
    const b = assembleBuildSet(['H1'], { candidateUniverse: cands, cap: 5, coverageTickers: ['c6', 'SPY', 'H1', 'C2'] });
    expect(b.symbols).toEqual(['H1', 'C1', 'C2', 'C6', 'SPY']); // room for ONE uncovered candidate (5 − 1 held − 3 covered)
    expect(b).toMatchObject({ coverageOnly: ['SPY'], droppedCandidates: 3, candidateCapacity: 3 });
    expect([...b.heldSet]).toEqual(['H1']);
    expect([...b.prioritySet].sort()).toEqual(['C2', 'C6', 'H1', 'SPY']);
  });

  it('quarterly books only: exactly today\'s build — no builder option, and the coverage document is never read', async () => {
    const seeded = makeMandateFakeDb({ 'mandates/q1': quarterlyBook({ execState: { lastEvalTickKey: `${DAYS.d2}_open30` } }) });
    const { db, reads } = withReadLog(seeded);
    const quarterlyOnly = await evalOnce(db);
    expect(quarterlyOnly).not.toHaveProperty('ideaBooks'); // the pass listed no book and no query failed: the body is the engine's own
    expect(reads.filter((r) => /practiceField/.test(r))).toEqual([]);
    expect(Object.keys(seeded._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`).symbols).sort()).toEqual([...CANDIDATE_UNIVERSE].sort());
    const view = splitActiveBooks([{ data: () => quarterlyBook() }], { ideaBooksLive: true });
    expect(await snapshotBuildInputs({ collection: () => { throw new Error('read'); } }, view)).toEqual({ heldTickers: [], daily: {}, tick: {} });
  });

  it('the union never exceeds the cap: with the reserved universe at its budget, the build beside a quarterly book is exactly the cap', async () => {
    const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook({ execState: { lastEvalTickKey: `${DAYS.d2}_open30` } }) });
    const { bookId } = await populatedIdeaBook(db);
    // Fill the coverage document up to the admission budget (300 − the default universe), then try one more symbol.
    const cov = db._get('practiceFieldCoverage/current');
    const inDefault = Object.keys(cov.symbols).filter((s) => CANDIDATE_UNIVERSE.includes(s)).length;
    const room = 300 - CANDIDATE_UNIVERSE.length - (Object.keys(cov.symbols).length - inDefault);
    const symbols = { ...cov.symbols };
    for (let i = 0; i < room; i += 1) { const s = `ZZ${String(i).padStart(3, '0')}`; symbols[s] = { roles: ['held'], refs: ['x/y'], byRef: { 'x/y': ['held'] } }; quoteBook[s] = 10.01; }
    await db.collection('practiceFieldCoverage').doc('current').set({ ...cov, symbols });
    const refused = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['LLY'], comparison: { type: 'sector_fund', symbols: ['XLV'] }, capitalUsd: 25000 }), opId: 'over', nowIso: etIso(DAYS.d1, 11, 0) });
    expect(refused.refusals.map((r) => r.code)).toEqual(['coverage_unavailable']); // XLV would be symbol 301
    await evalOnce(db);
    const snap = db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`);
    expect(Object.keys(snap.symbols).length).toBe(300);
    expect(snap.droppedCandidatesForCap).toBe(0); // nothing gave way: neither held nor reserved coverage nor a candidate
    for (const s of ['AAPL', 'MSFT', 'SPY', 'XLK', 'ZZ000']) expect(snap.symbols[s]).toBeTruthy();
  });

  it("mode 'off': an idea book is invisible to the build — alone it is an idle skip; beside a quarterly book the build is the quarterly book's own", async () => {
    const db = makeMandateFakeDb();
    const { bookId } = await populatedIdeaBook(db);
    setPracticeFieldModeForTests(null);
    const before = snapshotOfStore(db, '');
    const body = await evalOnce(db);
    expect(body).toMatchObject({ noop: true, reason: 'mandate_idle_skip' });
    expect(quotesSpy).not.toHaveBeenCalled();
    expect(snapshotOfStore(db, '')).toBe(before); // an idle skip writes nothing
    expect(logs.map((l) => { try { return JSON.parse(l).event; } catch { return null; } })).toContain('mandate_idle_skip');

    await db.collection('mandates').doc('q1').set(quarterlyBook({ execState: { lastEvalTickKey: `${DAYS.d2}_open30` } }));
    const logged = withReadLog(db);
    const second = await (async () => { const { req, res, captured } = fakeReqRes(); await runEvalSweep(req, res, { now: evalNow(DAYS.d2, 'open30'), tick: tickOf(DAYS.d2, 'open30'), db: logged.db }); return captured.body; })();
    expect(second.ok).toBe(true);
    expect(second).not.toHaveProperty('ideaBooks');
    expect(logged.reads.filter((r) => /practiceField/.test(r))).toEqual([]);
    expect(Object.keys(db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`).symbols).sort()).toEqual([...CANDIDATE_UNIVERSE].sort()); // no SPY, no XLK
    // The quarterly loop stepped over the idea book and rotated it; nothing else about it moved.
    const idea = getBook(db, bookId);
    expect(idea.execState).toMatchObject({ lastSweepTickKey: `${DAYS.d2}_open30` });
    expect(idea.execState).not.toHaveProperty('lastEvalTickKey'); // never evaluated
    expect(idea.execState).not.toHaveProperty('lastIdeaTickKey'); // its own pass never ran
    expect(idea.revision).toBe(2);
    expect(modelSpy).not.toHaveBeenCalled();
  });

  it('every fund in the map has a static classification and none is in the default candidate universe', () => {
    for (const fund of Object.keys(PRACTICE_FIELD_FUNDS)) expect(CANDIDATE_UNIVERSE).not.toContain(fund);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('T0c\'s idle check and an active idea book', () => {
  it('an active idea book defeats the idle skip while the Practice Field is live — with no extra read', async () => {
    const db = makeMandateFakeDb();
    await populatedIdeaBook(db);
    const active = await db.collection('mandates').where('status', '==', 'active').get();
    const view = splitActiveBooks(active.docs, { ideaBooksLive: true });
    const untouched = { collection: () => { throw new Error('a read was made'); } };
    expect(await idleAcquisitionCheck(untouched, { docs: view.visibleDocs })).toEqual({ skip: false, activeBooks: 1, outstandingDuty: null });
    // …and with the mode off it is not counted: the check falls through to the open-batch read and skips.
    const hidden = splitActiveBooks(active.docs, { ideaBooksLive: false });
    expect(await idleAcquisitionCheck(db, { docs: hidden.visibleDocs })).toEqual({ skip: true, activeBooks: 0, outstandingDuty: false });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the eval sweep: the idea-book pass beside the quarterly loop', () => {
  it('enters a pending idea at its start session\'s slot, makes no model call for it, stamps it, and does not serve it twice in one slot', async () => {
    const db = makeMandateFakeDb();
    const { bookId } = await seedIdeaBook({ db });
    const a = await admitIdea(db, { bookId, contract: contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), opId: 'i', nowIso: ADMIT_ISO });
    quoteTs = Math.floor(etMs(DAYS.d1, 9, 45) / 1000);
    const fire = async (slot = 'open30') => { const { req, res, captured } = fakeReqRes(); await runEvalSweep(req, res, { now: evalNow(DAYS.d1, slot), tick: tickOf(DAYS.d1, slot), db }); return captured.body; };
    const first = await fire();
    expect(first.ideaBooks).toEqual({ books: 1, served: 1, caughtUp: 0, sold: 0, saleWaiting: 0, resulted: 0, entered: 1, waiting: 0, cancelled: 0, errors: 0, leaseSkips: 0 });
    expect(first).toMatchObject({ ok: true, evaluated: 0, executed: 0, skipped: 1 }); // the quarterly loop stepped over it
    expect(modelSpy).not.toHaveBeenCalled();
    const book = getBook(db, bookId);
    expect(book.execState).toMatchObject({ lastIdeaTickKey: `${DAYS.d1}_open30`, lastSweepTickKey: `${DAYS.d1}_open30`, submitted: 0, executed: 0 });
    expect(book.execState).not.toHaveProperty('lastEvalTickKey'); // the model eval's stamp: never written on an idea book
    expect(book.health.lastEvalSweepAt).toBeInstanceOf(Date);
    expect(book.health.consecutiveEvalFailures).toBe(0);
    expect(getIdea(db, bookId, a.ideaId).status).toBe('holding');
    // A second generous fire in the same slot: the book is not served again, and nothing about it moves.
    const before = snapshotOfStore(db, `mandates/${bookId}`);
    const second = await fire();
    expect(second.ideaBooks).toMatchObject({ books: 1, served: 0, entered: 0 });
    expect(second.complete).toBe(true);
    expect(snapshotOfStore(db, `mandates/${bookId}`).replace(/"lease[^}]*}/g, '')).toBe(before.replace(/"lease[^}]*}/g, ''));
  });

  it('a transient failure does not cost the idea its slot: a pass with an error is NOT stamped, and the slot\'s next fire enters it (review L3-1)', async () => {
    const db = makeMandateFakeDb();
    const { bookId } = await seedIdeaBook({ db });
    const a = await admitIdea(db, { bookId, contract: contractOf(), opId: 'i', nowIso: ADMIT_ISO });
    quoteTs = Math.floor(etMs(DAYS.d1, 15, 15) / 1000);
    // The LAST entry slot. The first fire's entry transaction fails once (a transient store error).
    const realRun = db.runTransaction;
    let failures = 1;
    const flaky = { ...db, runTransaction: async (fn, opts) => { const probe = fn.toString().includes('ideaRef'); if (probe && failures > 0) { failures -= 1; throw Object.assign(new Error('ABORTED: transient'), { code: 10 }); } return realRun(fn, opts); } };
    const fire = async (handle) => { const { req, res, captured } = fakeReqRes(); await runEvalSweep(req, res, { now: evalNow(DAYS.d1, 'preClose'), tick: tickOf(DAYS.d1, 'preClose'), db: handle }); return captured.body; };
    const first = await fire(flaky);
    expect(first.ideaBooks).toMatchObject({ books: 1, served: 1, entered: 0, errors: 1 });
    expect(first.complete).toBe(false); // a pass with an error never lets the fire say "all served"
    expect(getBook(db, bookId).execState).not.toHaveProperty('lastIdeaTickKey'); // not stamped: the slot is still open to it
    expect(getIdea(db, bookId, a.ideaId).status).toBe('accepted');
    const second = await fire(db);
    expect(second.ideaBooks).toMatchObject({ books: 1, served: 1, entered: 1, errors: 0 });
    expect(second.complete).toBe(true);
    expect(getIdea(db, bookId, a.ideaId)).toMatchObject({ status: 'holding', entry: { slot: 'preClose' } });
    expect(getBook(db, bookId).execState.lastIdeaTickKey).toBe(`${DAYS.d1}_preClose`);
  });

  it('the pass is fenced from the quarterly sweep (review L2-4): its own failure does not cost the quarterly book its evaluation, and an unserved idea book keeps the fire from claiming complete', async () => {
    const vintage = { gateConfig: { sectorCapConversionVersion: 1, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] }, modelSeat: { model: 'm' } };
    const hold = async () => ({ decision: { ok: true, input: { verb: 'HOLD', rationale: 'Holding. Nothing to do.', conviction: 50 } }, usage: null });
    const fire = async (handle, slot) => { quoteTs = Math.floor(etMs(DAYS.d2, 9, 45) / 1000); const { req, res, captured } = fakeReqRes(); await runEvalSweep(req, res, { now: evalNow(DAYS.d2, slot), tick: tickOf(DAYS.d2, slot), db: handle }); return captured; };

    // (a) the pass's own query fails.
    const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook(), 'archetypeVintages/analyst_x': vintage });
    await populatedIdeaBook(db);
    const failingKindQuery = { ...db, collection: (c) => {
      const col = db.collection(c);
      if (c !== 'mandates') return col;
      return { ...col, where: (...a) => { const q = col.where(...a); return { ...q, where: (f, ...rest) => { if (f === 'kind') throw new Error('UNAVAILABLE: injected (the idea-book query)'); return q.where(f, ...rest); } }; } };
    } };
    modelSpy.mockImplementationOnce(hold);
    const a = await fire(failingKindQuery, 'open30');
    expect(a.code).toBe(200);
    expect(a.body).toMatchObject({ ok: true, evaluated: 1, executed: 1, ideaBooks: { failed: true }, complete: false });
    expect(errors.some((e) => /PRACTICE_FIELD_PASS_FAILED/.test(e))).toBe(true);
    expect(db._get('mandates/q1').execState.lastEvalTickKey).toBe(`${DAYS.d2}_open30`);
    // …and still not complete on the next fire, when the quarterly book is already served: the failed pass alone holds it back.
    const a2 = await fire(failingKindQuery, 'open30');
    expect(a2.body).toMatchObject({ ok: true, evaluated: 0, ideaBooks: { failed: true }, complete: false });

    // (b) the idea book's lease is held elsewhere: the quarterly book is served, the fire is NOT complete.
    const db2 = makeMandateFakeDb({ 'mandates/q1': quarterlyBook({ execState: { lastEvalTickKey: `${DAYS.d2}_midday` } }), 'archetypeVintages/analyst_x': vintage });
    const idea = await populatedIdeaBook(db2);
    await idea.bookRef.set({ lease: { ownerToken: 'another-fire', acquiredAt: evalNow(DAYS.d2, 'midday'), expiresAt: new Date(evalNow(DAYS.d2, 'midday').getTime() + 10 * 60_000) } }, { merge: true });
    const b1 = await fire(db2, 'midday');
    expect(b1.body).toMatchObject({ ok: true, ideaBooks: { books: 1, served: 0, leaseSkips: 1 }, complete: false });
    expect(logs.filter((l) => /all active books served/.test(l))).toEqual([]);
    // The lease gone, the next fire serves it and may say complete.
    await idea.bookRef.set({ lease: null }, { merge: true });
    await fire(db2, 'midday');
    const b3 = await fire(db2, 'midday');
    expect(b3.body.complete).toBe(true);
    expect(getBook(db2, idea.bookId).execState.lastIdeaTickKey).toBe(`${DAYS.d2}_midday`);
    // (c) under batch transport the session's LAST tick says the same: harvest-only, and not complete while an idea book is unserved.
    const lastTick = async () => { quoteTs = Math.floor(etMs(DAYS.d2, 15, 15) / 1000); const { req, res, captured } = fakeReqRes(); await runEvalSweep(req, res, { now: evalNow(DAYS.d2, 'preClose'), tick: tickOf(DAYS.d2, 'preClose'), db: db2, transport: 'batch' }); return captured.body; };
    await idea.bookRef.set({ lease: { ownerToken: 'another-fire', acquiredAt: evalNow(DAYS.d2, 'preClose'), expiresAt: new Date(evalNow(DAYS.d2, 'preClose').getTime() + 10 * 60_000) } }, { merge: true });
    expect(await lastTick()).toMatchObject({ reason: 'last_tick_no_submit', ideaBooks: { leaseSkips: 1 }, complete: false });
    await idea.bookRef.set({ lease: null }, { merge: true });
    expect(await lastTick()).toMatchObject({ reason: 'last_tick_no_submit', ideaBooks: { served: 1, leaseSkips: 0 }, complete: true });
  });

  it('under BATCH transport the session\'s last slot still runs the idea-book pass (the last-tick rule is about submissions)', async () => {
    const db = makeMandateFakeDb();
    const { bookId } = await seedIdeaBook({ db });
    const a = await admitIdea(db, { bookId, contract: contractOf(), opId: 'i', nowIso: ADMIT_ISO });
    quoteTs = Math.floor(etMs(DAYS.d1, 15, 15) / 1000);
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: evalNow(DAYS.d1, 'preClose'), tick: tickOf(DAYS.d1, 'preClose'), db, transport: 'batch' });
    expect(captured.body).toMatchObject({ ok: true, reason: 'last_tick_no_submit', ideaBooks: { books: 1, entered: 1 } });
    expect(getIdea(db, bookId, a.ideaId).entry.slot).toBe('preClose');
  });

  it('a quarterly book beside it is evaluated exactly as before, by the model seat, and the two never share a path', async () => {
    const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook(), 'archetypeVintages/analyst_x': { gateConfig: { sectorCapConversionVersion: 1, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] }, modelSeat: { model: 'm' } } });
    const { bookId } = await populatedIdeaBook(db);
    modelSpy.mockImplementationOnce(async () => ({ decision: { ok: true, input: { verb: 'HOLD', rationale: 'Holding. Nothing to do.', conviction: 50 } }, usage: null }));
    quoteTs = Math.floor(etMs(DAYS.d2, 9, 45) / 1000);
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: evalNow(DAYS.d2, 'open30'), tick: tickOf(DAYS.d2, 'open30'), db });
    expect(modelSpy).toHaveBeenCalledTimes(1); // the quarterly book only
    expect(captured.body).toMatchObject({ ok: true, evaluated: 1, executed: 1, skipped: 1, ideaBooks: { books: 1, served: 1 } });
    expect(db._get('mandates/q1').execState).toMatchObject({ submitted: 1, executed: 1, lastEvalTickKey: `${DAYS.d2}_open30` });
    expect(getBook(db, bookId).execState).toMatchObject({ submitted: 0, executed: 0 });
    expect(getBook(db, bookId).execState).not.toHaveProperty('lastEvalTickKey');
    expect(countDocs(db, `mandates/${bookId}/decisions/`)).toBe(2); // its two basket-entry receipts, nothing else
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the close sweep: dispatch by kind, and one snapshot per date (B-STAMP)', () => {
  const closeOnce = async (db, date) => {
    quoteTs = Math.floor(etMs(date, 16, 0) / 1000);
    const { req, res, captured } = fakeReqRes();
    await runCloseSweep(req, res, { now: closeNow(date), closeTick: closeTickOf(date), db });
    return captured.body;
  };

  it('an idea book goes to the idea-book close and a quarterly book to closeBook, in one sweep', async () => {
    const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook({ portfolio: { positions: { JPM: { shares: 10, costBasisTotal: 2400, lastMark: 240, openedAt: '2026-09-02' } } } }) });
    const { bookId, ideaId } = await populatedIdeaBook(db);
    const body = await closeOnce(db, DAYS.d1);
    expect(body).toMatchObject({ ok: true, closed: 2, errors: 0, ideaBooksClosed: 1 });
    // The quarterly book: its own row shape, its scoring, its quarter lens — unchanged.
    const qRow = db._get(`mandates/q1/dailyRows/${DAYS.d1}`);
    expect(qRow).toMatchObject({ date: DAYS.d1, quarterIndex: 1, markSource: 'close_snapshot' });
    expect(qRow).not.toHaveProperty('kind');
    expect(db._get('mandates/q1').scoring).toBeTruthy();
    // The idea book: its own row, its idea's row, no scoring stream.
    const iRow = db._get(`mandates/${bookId}/dailyRows/${DAYS.d1}`);
    expect(iRow).toMatchObject({ kind: 'idea_book', basis: 'mark', closeSnapshotKey: `${DAYS.d1}_close`, fullQuality: true });
    expect(iRow).not.toHaveProperty('quarterIndex');
    expect(getRow(db, bookId, ideaId, DAYS.d1)).toMatchObject({ basis: 'mark', closeSnapshotKey: `${DAYS.d1}_close` });
    expect(getBook(db, bookId)).not.toHaveProperty('scoring');
    expect(countDocs(db, `mandates/${bookId}/pendingScoringAppends/`)).toBe(0);
    expect(getBook(db, bookId).execState.lastCloseKey).toBe(DAYS.d1);
    expect(db._get('mandates/q1').execState.lastCloseKey).toBe(DAYS.d1);
  });

  it('B-STAMP — two idea books closed in two SEPARATE fires for one date carry the same snapshot key and the same mark per shared symbol; the snapshot is built once; a planted second snapshot is never read', async () => {
    const seeded = makeMandateFakeDb();
    const one = await populatedIdeaBook(seeded, { uid: 'owner-1', opId: 'c1' });
    const two = await populatedIdeaBook(seeded, { uid: 'owner-2', opId: 'c2' });
    // A second, different snapshot for the same date, planted beside the real key.
    await seeded.collection('mandateUniverseSnapshots').doc(`${DAYS.d1}_close_v2`).set({ tickKey: `${DAYS.d1}_close_v2`, sessionDate: DAYS.d1, builtAt: new Date(), symbols: { AAPL: { price: 1, complete: true, quoteTs: 1 } } });
    const { db, reads } = withReadLog(seeded);

    // Fire 1 closes book one only: book two's lease is held by another invocation.
    await seeded.collection('mandates').doc(two.bookId).set({ lease: { ownerToken: 'someone-else', expiresAt: new Date(closeNow(DAYS.d1).getTime() + 200_000) } }, { merge: true });
    const first = await closeOnce(db, DAYS.d1);
    expect(first).toMatchObject({ closed: 1, ideaBooksClosed: 1, complete: false }); // book two was lease-skipped: a second fire must serve it
    expect(getRow(seeded, two.bookId, two.ideaId, DAYS.d1)).toBeUndefined();
    const builds = quotesSpy.mock.calls.length;
    expect(builds).toBeGreaterThan(0);

    // Fire 2, later, with different live prices at the vendor: it must NOT rebuild.
    await seeded.collection('mandates').doc(two.bookId).set({ lease: null }, { merge: true });
    quoteBook.AAPL = 999.99;
    const { req, res, captured } = fakeReqRes();
    await runCloseSweep(req, res, { now: new Date(closeNow(DAYS.d1).getTime() + 20 * 60_000), closeTick: closeTickOf(DAYS.d1), db });
    expect(captured.body.ok).toBe(true);
    expect(quotesSpy.mock.calls.length).toBe(builds); // read by key, never rebuilt

    const rowOne = getRow(seeded, one.bookId, one.ideaId, DAYS.d1);
    const rowTwo = getRow(seeded, two.bookId, two.ideaId, DAYS.d1);
    expect(rowOne.closeSnapshotKey).toBe(`${DAYS.d1}_close`);
    expect(rowTwo.closeSnapshotKey).toBe(`${DAYS.d1}_close`);
    expect(rowTwo.closeSnapshotBuiltAt).toBe(rowOne.closeSnapshotBuiltAt);
    expect(rowTwo.marks).toEqual(rowOne.marks);
    expect(rowTwo.marks.AAPL.mark).toBe(PRICES.AAPL);
    expect(rowTwo.spyMarks).toEqual(rowOne.spyMarks);
    expect(reads.filter((r) => r.includes('_close_v2'))).toEqual([]);
    expect(reads.filter((r) => r === `get mandateUniverseSnapshots/${DAYS.d1}_close`).length).toBeGreaterThanOrEqual(2);

    // Fire 3: a replay. Nothing new is written for either book.
    const before = snapshotOfStore(seeded, 'mandates/').replace(/"lease[^}]*}/g, '').replace(/"lastCloseAttemptAt":"[^"]*"/g, '');
    const { req: r3, res: s3, captured: c3 } = fakeReqRes();
    await runCloseSweep(r3, s3, { now: new Date(closeNow(DAYS.d1).getTime() + 40 * 60_000), closeTick: closeTickOf(DAYS.d1), db });
    expect(c3.body).toMatchObject({ ok: true, closed: 0, complete: true });
    expect(snapshotOfStore(seeded, 'mandates/').replace(/"lease[^}]*}/g, '').replace(/"lastCloseAttemptAt":"[^"]*"/g, '')).toBe(before);
  });

  it("mode 'off': the idea book is NOT closed — not by its own close, and never by closeBook — and the sweep still completes", async () => {
    const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook() });
    const { bookId, ideaId } = await populatedIdeaBook(db);
    setPracticeFieldModeForTests(null);
    const ideaBefore = JSON.stringify(getIdea(db, bookId, ideaId));
    const positionsBefore = JSON.stringify(getBook(db, bookId).portfolio);
    const first = await closeOnce(db, DAYS.d1);
    expect(first).toMatchObject({ ok: true, closed: 1, errors: 0 }); // the quarterly book
    expect(first).not.toHaveProperty('ideaBooksClosed');
    const second = await closeOnce(db, DAYS.d1);
    expect(second).toMatchObject({ ok: true, closed: 0, complete: true });
    const book = getBook(db, bookId);
    expect(JSON.stringify(book.portfolio)).toBe(positionsBefore);
    expect(JSON.stringify(getIdea(db, bookId, ideaId))).toBe(ideaBefore);
    expect(book.execState.lastCloseKey).toBeNull();
    expect(book.revision).toBe(2);
    expect(book.health.lastCloseAttemptAt).toBeInstanceOf(Date); // rotated behind the frontier
    expect(countDocs(db, `mandates/${bookId}/dailyRows/`)).toBe(0);
    expect(Object.keys(db._get(`mandateUniverseSnapshots/${DAYS.d1}_close`).symbols)).not.toContain('XLK'); // its coverage was not built
  });

  it("mode 'off' with an idea book ALONE: an idle skip, completion and retention as with no book at all — the hidden book is not \"a book that appeared\"", async () => {
    const db = makeMandateFakeDb();
    const { bookId } = await populatedIdeaBook(db);
    setPracticeFieldModeForTests(null);
    const body = await closeOnce(db, DAYS.d1);
    expect(body).toMatchObject({ ok: true, reason: 'mandate_idle_skip', closed: 0, complete: true });
    expect(quotesSpy).not.toHaveBeenCalled();
    expect(db._get(`mandateUniverseSnapshots/${DAYS.d1}_close`)).toBeUndefined();
    expect(countDocs(db, `mandates/${bookId}/dailyRows/`)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('T1a-2a — the real sweeps: sales at the window, the lines at the close, and a DRAINING idea book (Amendment E8, E13)', () => {
  const closeOnce = async (db, date) => {
    quoteTs = Math.floor(etMs(date, 16, 0) / 1000);
    const { req, res, captured } = fakeReqRes();
    await runCloseSweep(req, res, { now: closeNow(date), closeTick: closeTickOf(date), db });
    return captured.body;
  };
  const evalOnce = async (db, date, slot = 'open30') => {
    quoteTs = Math.floor(etMs(date, 9, 45) / 1000);
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: evalNow(date, slot), tick: tickOf(date, slot), db });
    return captured.body;
  };
  const lineOf = (db, bookId, ideaId, sym) => getIdea(db, bookId, ideaId).lines.find((l) => l.symbol === sym);

  it('an ACTIVE idea book through the engine\'s own sweeps: the close recognises a line, the next window sells that holding from the slot\'s stored snapshot, and the quarterly counters never move', async () => {
    const db = makeMandateFakeDb();
    const { bookId, ideaId } = await populatedIdeaBook(db);
    quoteBook.AAPL = Math.round((lineOf(db, bookId, ideaId, 'AAPL').level - 0.02) * 100) / 100;
    expect(await closeOnce(db, DAYS.d1)).toMatchObject({ ok: true, closed: 1, ideaBooksClosed: 1, errors: 0 });
    expect(getIdea(db, bookId, ideaId)).toMatchObject({ status: 'line_hit_exit_pending', ledger: { holdings: { AAPL: { exitPending: { reason: 'line', session: DAYS.d1 } } } } });
    quoteBook.AAPL = 215.43;
    const body = await evalOnce(db, DAYS.d2);
    expect(body.ideaBooks).toEqual({ books: 1, served: 1, caughtUp: 0, sold: 1, saleWaiting: 0, resulted: 0, entered: 0, waiting: 0, cancelled: 0, errors: 0, leaseSkips: 0 });
    expect(modelSpy).not.toHaveBeenCalled();
    const idea = getIdea(db, bookId, ideaId);
    expect(idea.status).toBe('holding');
    expect(idea.ledger.saleReceipts).toEqual([expect.objectContaining({ kind: 'line_exit', symbol: 'AAPL', mark: 215.43, tickKey: `${DAYS.d2}_open30` })]);
    // The price the sale filled at is the STORED slot snapshot's.
    expect(db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`).symbols.AAPL.price).toBe(215.43);
    expect(Object.keys(getBook(db, bookId).portfolio.positions)).toEqual(['MSFT']);
    expect(getBook(db, bookId).execState).toMatchObject({ submitted: 0, executed: 0, lastIdeaTickKey: `${DAYS.d2}_open30` });
    expect(countDocs(db, `mandates/${bookId}/decisions/`)).toBe(3);
  });

  it('a DRAINING idea book — which the engine\'s active-book query cannot see — still gets its slot snapshot, its line exit, its close and its rows; it takes no entry; a second close fire finds nothing left and completes', async () => {
    const db = makeMandateFakeDb();
    const { bookId, bookRef, ideaId } = await populatedIdeaBook(db);
    // A second idea is pending for D2, and AAPL's line is hit at D1's close.
    const pending = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['JPM'], capitalUsd: 25000 }), opId: 'idea-2', nowIso: etIso(DAYS.d1, 11, 0) });
    expect(pending).toMatchObject({ ok: true, startSession: DAYS.d2 });
    quoteBook.AAPL = Math.round((lineOf(db, bookId, ideaId, 'AAPL').level - 0.02) * 100) / 100;
    await closeOnce(db, DAYS.d1);
    await bookRef.update({ status: 'draining' }); // nothing sets the status yet (T1a-2b): a fixture stands in
    expect((await db.collection('mandates').where('status', '==', 'active').get()).docs).toHaveLength(0);

    // The eval fire: NOT an idle skip — the draining book's symbols are built — and the sale fills. No entry.
    quotesSpy.mockClear();
    quoteBook.AAPL = 215.43;
    const evalBody = await evalOnce(db, DAYS.d2);
    expect(evalBody).not.toHaveProperty('reason');
    expect(evalBody.ideaBooks).toMatchObject({ books: 1, served: 1, sold: 1, entered: 0, waiting: 0, errors: 0 });
    expect(quotesSpy).toHaveBeenCalled();
    const slotDoc = db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`);
    for (const sym of ['AAPL', 'MSFT', 'XLK', 'SPY', 'JPM']) expect(Object.keys(slotDoc.symbols), sym).toContain(sym);
    expect(getIdea(db, bookId, ideaId).ledger.saleReceipts).toHaveLength(1);
    expect(getIdea(db, bookId, pending.ideaId)).toMatchObject({ status: 'accepted', lastEntryAttempt: null });

    // The close fire: the engine's page holds no book; the draining book is closed by the Practice Field's own query.
    const first = await closeOnce(db, DAYS.d2);
    expect(first).toMatchObject({ ok: true, closed: 1, ideaBooksClosed: 1, errors: 0, complete: false, drainingIdeaBooks: { books: 1, closed: 1, skipped: 0, errors: 0 } });
    expect(first).not.toHaveProperty('reason');
    expect(getBook(db, bookId)).toMatchObject({ status: 'draining', execState: { lastCloseKey: DAYS.d2 } });
    expect(getRow(db, bookId, ideaId, DAYS.d2)).toMatchObject({ basis: 'mark', closeSnapshotKey: `${DAYS.d2}_close`, fullQuality: true });
    expect(db._get(`mandates/${bookId}/dailyRows/${DAYS.d2}`)).toMatchObject({ kind: 'idea_book', observed: true });
    expect(getIdea(db, bookId, pending.ideaId)).toMatchObject({ status: 'cancelled', cancelled: { reason: 'entry_timeout' } }); // its start session passed: never entered
    const second = await closeOnce(db, DAYS.d2);
    expect(second).toMatchObject({ ok: true, closed: 0, complete: true, drainingIdeaBooks: { books: 1, closed: 0, skipped: 1 } });
    expect(modelSpy).not.toHaveBeenCalled();
  });

  it("mode 'off' with a draining idea book: no Practice Field query, no build, no pass — both sweeps are exactly the engine's own idle fires", async () => {
    const seeded = makeMandateFakeDb();
    const { bookId, bookRef } = await populatedIdeaBook(seeded);
    await bookRef.update({ status: 'draining' });
    setPracticeFieldModeForTests(null);
    const before = snapshotOfStore(seeded, `mandates/${bookId}`);
    const { db, reads } = withReadLog(seeded);
    const evalBody = await evalOnce(db, DAYS.d2);
    expect(evalBody).toMatchObject({ ok: true, noop: true, reason: 'mandate_idle_skip' });
    expect(evalBody).not.toHaveProperty('ideaBooks');
    const closeBody = await closeOnce(db, DAYS.d2);
    expect(closeBody).toMatchObject({ ok: true, reason: 'mandate_idle_skip', closed: 0, complete: true });
    expect(closeBody).not.toHaveProperty('drainingIdeaBooks');
    expect(reads.filter((r) => /kind/.test(r))).toEqual([]); // the Practice Field's own queries were never made
    expect(quotesSpy).not.toHaveBeenCalled();
    expect(snapshotOfStore(seeded, `mandates/${bookId}`)).toBe(before);
  });

  it('the draining-book close is fenced from the engine\'s sweep: its failure is logged and counted, a quarterly book still closes, and the fire does not claim complete', async () => {
    const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook({ portfolio: { positions: { JPM: { shares: 10, costBasisTotal: 2400, lastMark: 240, openedAt: '2026-09-02' } } } }) });
    const { bookRef } = await populatedIdeaBook(db);
    await bookRef.update({ status: 'draining' });
    // The Practice Field's own query fails AFTER the snapshot is built (the build's query is the second `kind` query of the fire).
    let kindQueries = 0;
    const failing = { ...db, collection: (c) => {
      const col = db.collection(c);
      if (c !== 'mandates') return col;
      return { ...col, where: (...a) => { const q = col.where(...a); return { ...q, where: (f, ...rest) => { if (f === 'kind') { kindQueries += 1; if (kindQueries > 1) throw new Error('UNAVAILABLE: injected (the draining query)'); } return q.where(f, ...rest); } }; } };
    } };
    const body = await closeOnce(failing, DAYS.d2);
    expect(body).toMatchObject({ ok: true, closed: 1, complete: false, drainingIdeaBooks: { failed: true } });
    expect(body.errors).toBe(1);
    expect(errors.some((e) => /PRACTICE_FIELD_DRAINING_CLOSE_FAILED/.test(e))).toBe(true);
    expect(db._get('mandates/q1').execState.lastCloseKey).toBe(DAYS.d2); // the quarterly book closed
  });

  // ── Review lens 3 (IS-2, IS-3, IS-6, IS-8) ─────────────────────────────────────────────────────────────────────────
  const sessionsAfter = (date, n) => { let d = date; for (let i = 0; i < n; i += 1) d = nextSessionDate(d); return d; };
  /** A handle whose Practice Field (`kind`) queries on `mandates` throw when `fails(n, status)` says so (n counts them). */
  const withFailingKindQueries = (db, fails) => {
    let n = 0;
    return { ...db, collection: (c) => {
      const col = db.collection(c);
      if (c !== 'mandates') return col;
      return { ...col, where: (field, op, status) => { const q = col.where(field, op, status); return { ...q, where: (f, ...rest) => { if (f === 'kind') { n += 1; if (fails(n, status)) throw new Error(`UNAVAILABLE: injected (kind query ${n}, ${status})`); } return q.where(f, ...rest); } }; } };
    } };
  };

  it('IS-3 — an ACTIVE idea book the close fire served and left unclosed for the date (the catch-up ran out of its bound) keeps the fire from claiming complete; so does a DRAINING one', async () => {
    for (const status of ['active', 'draining']) {
      const db = makeMandateFakeDb();
      const { bookId, bookRef } = await populatedIdeaBook(db);
      await closeOnce(db, DAYS.d1);
      if (status === 'draining') await bookRef.update({ status });
      const far = sessionsAfter(DAYS.d1, 24); // 23 missed sessions before it: more than one call catches up
      logs.length = 0;
      const first = await closeOnce(db, far);
      expect(first, status).toMatchObject({ ok: true, closed: 0, errors: 0, complete: false, ideaBooksUnclosed: 1 });
      if (status === 'draining') expect(first.drainingIdeaBooks).toEqual({ books: 1, closed: 0, skipped: 1, errors: 0 });
      expect(logs.filter((l) => /close sweep complete/.test(l)), status).toEqual([]);
      expect(getBook(db, bookId).execState.lastCloseKey, status).toBe(sessionsAfter(DAYS.d1, 20));
      // The next fire finishes the catch-up and closes the date; the one after finds nothing left and may say complete.
      const second = await closeOnce(db, far);
      expect(second, status).toMatchObject({ closed: 1, complete: false });
      expect(second).not.toHaveProperty('ideaBooksUnclosed');
      expect(getBook(db, bookId).execState.lastCloseKey).toBe(far);
      const third = await closeOnce(db, far);
      expect(third, status).toMatchObject({ closed: 0, complete: true });
      expect(third).not.toHaveProperty('ideaBooksUnclosed');
    }
  });

  it('IS-2 — the draining query fails at the snapshot build: the build falls back to the coverage document, so the draining book\'s symbols are in the ONE snapshot of that close and its row is full quality', async () => {
    const db = makeMandateFakeDb();
    const { bookId, bookRef, ideaId } = await populatedIdeaBook(db);
    await closeOnce(db, DAYS.d1);
    await bookRef.update({ status: 'draining' });
    // The first `kind` query of the fire is the build's; the second is the draining close's own, and it works.
    const body = await closeOnce(withFailingKindQueries(db, (n) => n === 1), DAYS.d2);
    expect(errors.some((e) => /PRACTICE_FIELD_DRAINING_QUERY_FAILED — the snapshot build falls back to the coverage document/.test(e))).toBe(true);
    expect(body).not.toHaveProperty('reason'); // not an idle skip: the coverage document says an idea is open
    const closeDoc = db._get(`mandateUniverseSnapshots/${DAYS.d2}_close`);
    for (const sym of ['AAPL', 'MSFT', 'XLK', 'SPY']) expect(Object.keys(closeDoc.symbols), sym).toContain(sym);
    expect(body).toMatchObject({ ok: true, closed: 1, drainingIdeaBooks: { books: 1, closed: 1, skipped: 0, errors: 0 } });
    expect(getRow(db, bookId, ideaId, DAYS.d2)).toMatchObject({ fullQuality: true, closeSnapshotKey: `${DAYS.d2}_close` });
    expect(db._get('practiceFieldCoverage/current')).toBeDefined();
    expect(Object.keys(db._get('practiceFieldCoverage/current').symbols).sort()).toEqual(['AAPL', 'MSFT', 'SPY', 'XLK']); // read, not changed
  });

  it('IS-2, continued — on that fallback fire the build makes NO second read of the coverage document: with every later read of it failing, the fire still answers 200 and closes the quarterly book and the draining idea book', async () => {
    const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook({ portfolio: { positions: { JPM: { shares: 10, costBasisTotal: 2400, lastMark: 240, openedAt: '2026-09-02' } } } }) });
    const { bookId, bookRef, ideaId } = await populatedIdeaBook(db);
    await closeOnce(db, DAYS.d1);
    await bookRef.update({ status: 'draining' });
    // The build's draining query fails; the coverage document can be read ONCE outside a transaction (the fallback).
    const queriesDown = withFailingKindQueries(db, (n) => n === 1);
    let coverageReads = 0;
    const handle = { ...queriesDown, collection: (c) => {
      const col = queriesDown.collection(c);
      if (c !== 'practiceFieldCoverage') return col;
      return { ...col, doc: (id) => { const ref = col.doc(id); return { ...ref, get: async () => { coverageReads += 1; if (coverageReads > 1) throw new Error('UNAVAILABLE: injected (coverage read #2)'); return ref.get(); } }; } };
    } };
    const { req, res, captured } = fakeReqRes();
    quoteTs = Math.floor(etMs(DAYS.d2, 16, 0) / 1000);
    await runCloseSweep(req, res, { now: closeNow(DAYS.d2), closeTick: closeTickOf(DAYS.d2), db: handle });
    expect(captured.code).toBe(200);
    expect(coverageReads).toBe(1);
    expect(captured.body).toMatchObject({ ok: true, closed: 2, errors: 0, drainingIdeaBooks: { books: 1, closed: 1 } });
    expect(db._get('mandates/q1').execState.lastCloseKey).toBe(DAYS.d2);
    const closeDoc = db._get(`mandateUniverseSnapshots/${DAYS.d2}_close`);
    for (const sym of ['AAPL', 'MSFT', 'XLK', 'SPY']) expect(Object.keys(closeDoc.symbols), sym).toContain(sym);
    expect(getRow(db, bookId, ideaId, DAYS.d2)).toMatchObject({ fullQuality: true });
  });

  it('IS-6 — a draining book whose close FAILS, or whose lease is held elsewhere, keeps the fire from claiming complete', async () => {
    const db = makeMandateFakeDb();
    const { bookId, bookRef } = await populatedIdeaBook(db);
    await closeOnce(db, DAYS.d1);
    const equity = getBook(db, bookId).portfolio.totalValue;
    // (a) its close throws (the book does not reconcile): counted, not thrown.
    await bookRef.update({ status: 'draining', 'portfolio.totalValue': Math.round((equity + 0.01) * 100) / 100 });
    const failed = await closeOnce(db, DAYS.d2);
    expect(failed).toMatchObject({ ok: true, closed: 0, errors: 1, complete: false, drainingIdeaBooks: { books: 1, closed: 0, skipped: 0, errors: 1 } });
    expect(getBook(db, bookId).execState.lastCloseKey).toBe(DAYS.d1);
    // (b) repaired, but its lease is held by another fire: not served, and the fire does not claim complete.
    await bookRef.update({ 'portfolio.totalValue': equity });
    await bookRef.set({ lease: { ownerToken: 'another-fire', acquiredAt: closeNow(DAYS.d2), expiresAt: new Date(closeNow(DAYS.d2).getTime() + 10 * 60_000) } }, { merge: true });
    logs.length = 0;
    const held = await closeOnce(db, DAYS.d2);
    expect(held).toMatchObject({ ok: true, closed: 0, errors: 0, complete: false, drainingIdeaBooks: { books: 1, closed: 0, skipped: 0, errors: 0 } });
    expect(logs.filter((l) => /close sweep complete/.test(l))).toEqual([]);
    // (c) the lease gone: it closes, and the fire after that completes.
    await bookRef.set({ lease: null }, { merge: true });
    expect(await closeOnce(db, DAYS.d2)).toMatchObject({ closed: 1, complete: false });
    expect(await closeOnce(db, DAYS.d2)).toMatchObject({ closed: 0, complete: true });
  });

  it('IS-6 — on a fire whose page loop deferred (the time budget ran out), the draining closes do not run and the fire does not claim complete', async () => {
    const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook({ portfolio: { positions: { JPM: { shares: 10, costBasisTotal: 2400, lastMark: 240, openedAt: '2026-09-02' } } } }) });
    const { bookId, bookRef } = await populatedIdeaBook(db);
    await closeOnce(db, DAYS.d1);
    await bookRef.update({ status: 'draining' });
    // The fire's clock: its first reading is the start; every later one is past the budget.
    const real = Date.now.bind(Date);
    let started = null;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => { if (started === null) { started = real(); return started; } return started + 300_000; });
    let body;
    try { body = await closeOnce(db, DAYS.d2); } finally { clock.mockRestore(); }
    expect(body).toMatchObject({ ok: true, closed: 0, complete: false });
    expect(body).not.toHaveProperty('drainingIdeaBooks'); // not run on a deferred fire: the next fire serves it
    expect(getBook(db, bookId).execState.lastCloseKey).toBe(DAYS.d1);
    expect(db._get('mandates/q1').execState.lastCloseKey).not.toBe(DAYS.d2);
    // The next fire, with its budget: both close.
    expect(await closeOnce(db, DAYS.d2)).toMatchObject({ closed: 2, drainingIdeaBooks: { books: 1, closed: 1 } });
  });

  it('IS-8 — in the eval pass one status\'s query failing does not cost the other status\'s books that fire: the active book is served, the failure is counted, and the fire is not complete', async () => {
    const db = makeMandateFakeDb();
    const { bookId, ideaId } = await populatedIdeaBook(db);
    quoteBook.AAPL = Math.round((lineOf(db, bookId, ideaId, 'AAPL').level - 0.02) * 100) / 100;
    await closeOnce(db, DAYS.d1);
    quoteBook.AAPL = 215.43;
    const body = await evalOnce(withFailingKindQueries(db, (n, status) => status === 'draining'), DAYS.d2);
    expect(errors.some((e) => /PRACTICE_FIELD_PASS_QUERY_FAILED — draining idea books/.test(e))).toBe(true);
    expect(body.ideaBooks).toMatchObject({ books: 1, served: 1, sold: 1, errors: 1 });
    expect(body.complete).toBe(false);
    expect(getIdea(db, bookId, ideaId).ledger.saleReceipts).toHaveLength(1);
    // The ACTIVE query failing with no draining book: the pass listed nobody — and the body still says a query failed.
    const db2 = makeMandateFakeDb();
    const two = await populatedIdeaBook(db2);
    await closeOnce(db2, DAYS.d1);
    const body2 = await evalOnce(withFailingKindQueries(db2, (n, status) => status === 'active' && n > 1), DAYS.d2);
    expect(body2.ideaBooks).toMatchObject({ books: 0, served: 0, errors: 1 });
    expect(body2.complete).toBe(false);
    expect(getBook(db2, two.bookId).execState.lastIdeaTickKey ?? null).not.toBe(`${DAYS.d2}_open30`);
  });
});
